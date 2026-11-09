import { describe, expect, it } from "vitest";
import { attachConnection, detachConnection, startGame } from "../../shared/game/room";
import type { RoomState } from "../../shared/game/room";
import { ROLE_IDS, ROLE_TABLE } from "../../shared/game/roles";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import { nicknameKey } from "../../shared/nickname";
import { seededRandInt } from "../helpers/seededRandom";

const COUNTS = [4, 5, 6, 7, 8] as const;

function lobby(n: number): RoomState {
  return {
    code: "0420",
    createdAt: 0,
    expiresAt: 10_800_000,
    phase: "lobby",
    phaseEndsAt: null,
    hostId: "p0",
    nextJoinSeq: n,
    players: Array.from({ length: n }, (_, i) => ({
      id: `p${i}`,
      token: `token-p${i}-0123456789`,
      seat: i,
      nickname: `이름${i}`,
      nicknameKey: nicknameKey(`이름${i}`),
      joinSeq: i,
      connected: true,
      connId: `c${i}`,
    })),
  } as RoomState;
}

function toRoleReveal(n: number, seed: number): RoomState {
  const r = startGame(lobby(n), "p0", 0, seededRandInt(seed));
  if (!r.ok) throw new Error(r.error);
  const s = tick(r.state, r.state.phaseEndsAt!, seededRandInt(seed));
  expect(s.phase).toBe("roleReveal");
  return s;
}

describe("Phase 1 역할 흐름 (ROLE-01·ROLE-02·CONN-01) - 시작부터 역할 확인까지", () => {
  for (const n of COUNTS) {
    it(`${n}명: 시작→배정→역할 확인에서 구성표 그대로 배정되고 마피아끼리만 서로를 안다`, () => {
      for (let seed = 1; seed <= 10; seed += 1) {
        const s = toRoleReveal(n, seed);
        for (const role of ROLE_IDS) {
          expect(s.players.filter((p) => p.role === role).length).toBe(ROLE_TABLE[n][role]);
        }
        const mafiaSeats = s.players.filter((p) => p.role === "mafia").map((p) => p.seat).sort((a, b) => a - b);
        for (const p of s.players) {
          const me = buildView(s, p.id, s.phaseEndsAt! - 1).me;
          expect(me.role).toBe(p.role);
          if (p.role === "mafia") {
            expect(me.allies).toEqual(mafiaSeats.filter((x) => x !== p.seat));
          } else {
            expect(me.allies).toBeUndefined();
          }
        }
      }
    });
  }

  it("끊겼다 같은 토큰으로 돌아와도 같은 자리·같은 역할·같은 마감을 받는다", () => {
    const s = toRoleReveal(6, 3);
    for (const p of s.players) {
      const before = buildView(s, p.id, s.phaseEndsAt! - 5000);
      const gone = detachConnection(s, p.id, p.connId!);
      const back = attachConnection(gone, p.id, "c-new");
      const after = buildView(back, p.id, s.phaseEndsAt! - 5000);
      expect(after.me.role).toBe(before.me.role);
      expect(after.me.seat).toBe(before.me.seat);
      expect(after.me.allies).toEqual(before.me.allies);
      expect(after.phaseEndsAt).toBe(before.phaseEndsAt);
    }
  });

  it("직렬화된 view 어디에도 남의 역할 이름이나 토큰이 실리지 않는다 (비마피아 viewer)", () => {
    const s = toRoleReveal(8, 5);
    const viewer = s.players.find((p) => p.role === "citizen")!;
    // players[].look 은 역할과 무관한 공개 의상이라(L25, D-01 — 시작 때 풀린 옷에 직업 이름이 나올 수 있다) 의상 열을 뺀 나머지를 본다.
    const view = buildView(s, viewer.id, s.phaseEndsAt! - 1);
    const json = JSON.stringify({ ...view, players: view.players.map(({ look: _look, ...rest }) => rest) });
    expect(json).not.toContain("mafia");
    expect(json).not.toContain("police");
    expect(json).not.toContain("doctor");
    for (const p of s.players) expect(json).not.toContain(p.token);
  });
});
