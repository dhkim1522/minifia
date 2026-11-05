// 로비 의상 규칙 단위 시험(10-02, 결정 D-6·L25). 결과는 한 줄 문자열로 비교한다(TAP 증거 규칙).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_LOOK, LOOK_MIN_GAP_MS, setLook } from "../../shared/game/look";
import { ROOM_TTL_MS } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { OUTFIT_IDS } from "../../shared/protocol";
import type { OutfitId, PhaseId } from "../../shared/protocol";
import { OUTFITS } from "../../src/world/characterData";

function player(i: number, extra: Partial<Player> = {}): Player {
  return {
    id: `p${i}`,
    token: `token-p${i}-0123456789`,
    seat: i,
    nickname: `이름${i}`,
    nicknameKey: `이름${i}`,
    joinSeq: i,
    connected: true,
    connId: `c${i}`,
    ...extra,
  };
}

function room(phase: PhaseId, n = 4, edit: (p: Player) => Player = (p) => p): RoomState {
  return {
    code: "0420",
    createdAt: 0,
    expiresAt: ROOM_TTL_MS,
    phase,
    phaseEndsAt: phase === "lobby" ? null : 100_000,
    hostId: "p0",
    nextJoinSeq: n,
    players: Array.from({ length: n }, (_, i) => edit(player(i))),
  } as RoomState;
}

const res = (r: ReturnType<typeof setLook>): string => (r.ok ? "ok" : r.error);

describe("setLook — 표 (D-6)", () => {
  it("대기실에서 고르면 ok 이고 그 사람의 look 만 바뀐다", () => {
    const s = room("lobby");
    const r = setLook(s, "p1", "mafia");
    expect(res(r)).toBe("ok");
    if (!r.ok) return;
    expect(r.state.players.map((p) => p.look ?? "-").join(",")).toBe("-,mafia,-,-");
    expect(s.players.every((p) => p.look === undefined)).toBe(true); // 입력은 바뀌지 않는다
  });

  it("같은 look 재선택은 같은 객체다", () => {
    const s = room("lobby", 4, (p) => (p.id === "p1" ? { ...p, look: "hood" } : p));
    const r = setLook(s, "p1", "hood");
    expect(res(r)).toBe("ok");
    expect(r.ok && r.state === s).toBe(true);
  });

  it("look 이 없던 사람이 coat 를 골라도 같은 객체다(기본값과 같다)", () => {
    const s = room("lobby");
    const r = setLook(s, "p2", "coat");
    expect(r.ok && r.state === s).toBe(true);
  });

  it("다른 의상을 고른 사람이 coat 로 돌아가면 look 이 coat 로 저장된다", () => {
    const s = room("lobby", 4, (p) => (p.id === "p1" ? { ...p, look: "hood" } : p));
    const r = setLook(s, "p1", "coat");
    expect(r.ok && r.state.players[1]!.look).toBe("coat");
  });

  it.each(["assigning", "roleReveal", "dayAnnounce", "discussion", "night", "morning", "nomination", "execution"] as PhaseId[])(
    "대기실·결과 단계 밖(%s)은 WRONG_PHASE 다 (결과 단계는 11-08 D-16 으로 열렸다)",
    (phase) => {
      expect(res(setLook(room(phase), "p1", "mafia"))).toBe("WRONG_PHASE");
    },
  );

  it("방에 없는 id 는 BAD_MESSAGE 다", () => {
    expect(res(setLook(room("lobby"), "nobody", "mafia"))).toBe("BAD_MESSAGE");
  });

  it("알 수 없는 look 은 BAD_MESSAGE 다", () => {
    expect(res(setLook(room("lobby"), "p1", "wizard" as OutfitId))).toBe("BAD_MESSAGE");
  });

  it("결과 단계(ended)에서도 고를 수 있다 — 참가자·sat 모두, 게임 중은 그대로 WRONG_PHASE (D-16)", () => {
    const ended = room("ended", 4, (p) => (p.seat === 3 ? { ...p, sat: true as const } : { ...p, role: "citizen" as const }));
    expect(res(setLook(ended, "p1", "hood"))).toBe("ok");
    expect(res(setLook(ended, "p3", "noir"))).toBe("ok");
    const changed = setLook(ended, "p3", "noir");
    expect(changed.ok && changed.state.players.find((p) => p.id === "p3")?.look).toBe("noir");
    for (const phase of ["assigning", "roleReveal", "dayAnnounce", "discussion", "night", "morning"] as const) {
      expect(res(setLook(room(phase), "p1", "hood"))).toBe("WRONG_PHASE");
    }
  });

  it("검사 순서: 단계가 먼저다(대기실 밖 + 방에 없는 id → WRONG_PHASE)", () => {
    expect(res(setLook(room("night"), "nobody", "mafia"))).toBe("WRONG_PHASE");
  });

  it("역할은 상관없다: 시민이 mafia 를, 마피아가 doctor 를 입어도 ok", () => {
    const s = room("lobby", 4, (p) => ({ ...p, role: p.seat === 0 ? "mafia" : "citizen" }));
    expect(res(setLook(s, "p1", "mafia"))).toBe("ok");
    expect(res(setLook(s, "p0", "doctor"))).toBe("ok");
  });

  it("상수: 기본은 coat, 간격은 250ms", () => {
    expect(`${DEFAULT_LOOK}|${LOOK_MIN_GAP_MS}`).toBe("coat|250");
  });
});

describe("의상 id 표", () => {
  it("OUTFIT_IDS 의 키 집합이 클라이언트 OUTFITS 와 같다(9종, 순서는 coat 가 처음)", () => {
    expect([...OUTFIT_IDS].sort().join(",")).toBe(Object.keys(OUTFITS).sort().join(","));
    expect(OUTFIT_IDS.length).toBe(9);
    expect(OUTFIT_IDS[0]).toBe("coat");
  });
});

describe("look.ts 구조 — 실제 역할을 읽지 않는다 (L25)", () => {
  it("소스에 .role 속성 접근이 없다(주석 제외)", () => {
    const src = readFileSync(new URL("../../shared/game/look.ts", import.meta.url), "utf8");
    const code = src
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");
    expect(code.match(/\.\s*role\b/g) ?? []).toEqual([]);
    expect(code.match(/\bplayer\.role\b|\bactor\.role\b/g) ?? []).toEqual([]);
  });
});
