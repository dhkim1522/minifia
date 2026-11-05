import { describe, expect, it } from "vitest";
import { CHAT_PHASES, audience, channelOf } from "../../shared/game/audience";
import { PHASE_DEFS } from "../../shared/game/phases";
import { ROOM_TTL_MS } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import type { PhaseId } from "../../shared/protocol";

const mk = (i: number, extra: Partial<Player> = {}): Player => ({
  id: `p${i}`, token: `token-p${i}-0123456789`, seat: i, nickname: `이름${i}`, nicknameKey: `이름${i}`,
  joinSeq: i, connected: true, connId: `c${i}`, role: i === 1 ? "mafia" : "citizen", ...extra,
});
const room = (phase: PhaseId, deadSeats: number[] = []): RoomState => ({
  code: "0420", createdAt: 0, expiresAt: ROOM_TTL_MS, phase, phaseEndsAt: 100_000, day: 1, hostId: "p0", nextJoinSeq: 5,
  players: [0, 1, 2, 3, 4].map((i) => mk(i, deadSeats.includes(i) ? { alive: false } : {})),
  ...(phase === "defense" ? { verdict: { candidate: 2 } as RoomState["verdict"] } : {}),
});

// 07-11: 빠른 메시지(say)가 사라져 단계 행렬은 서버가 채팅을 받는 단계(CHAT_PHASES)와 audience/channelOf 가 한 곳에서 정한다 (CHAT-02·03, COMM-04).
// 채팅 줄은 로비·낮 전 단계(화면이 없는 단계 포함)·밤·아침에서 받는다. 역할 확인·배정·종료는 받지 않는다.
const phases = Object.keys(PHASE_DEFS) as PhaseId[];

describe("채팅 단계별 채널 행렬 (모든 단계 전수)", () => {
  it.each(phases)("%s: 시민 생존자의 채널은 서버 채팅 단계에서만 all, 밤은 채널 없음", (phase) => {
    const expected = !CHAT_PHASES.has(phase) || phase === "night" ? "null" : "all";
    expect(String(channelOf(room(phase), "p3"))).toBe(expected);
  });

  it.each(phases)("%s: 마피아 생존자의 채널은 밤에 mafia, 그 밖의 서버 채팅 단계에서 all", (phase) => {
    const expected = !CHAT_PHASES.has(phase) ? "null" : phase === "night" ? "mafia" : "all";
    expect(String(channelOf(room(phase), "p1"))).toBe(expected);
  });

  it.each(phases)("%s: 탈락자의 채널은 서버 채팅 단계에서 ghost", (phase) => {
    expect(String(channelOf(room(phase, [3]), "p3"))).toBe(CHAT_PHASES.has(phase) ? "ghost" : "null");
  });

  it.each(phases)("%s: 받는 사람 집합은 채널·단계로만 정해지고 서버 채팅 단계 밖에서는 비어 있다", (phase) => {
    const state = room(phase, [3]);
    const ids = (ch: "all" | "mafia" | "ghost"): string => [...audience(state, { k: "chat", ch })].sort().join(",");
    if (phase === "ended") {
      // 결과 단계(11-03, D-11): all 채널만 모두에게 열린다. mafia·ghost 채널은 비어 있다.
      expect(`${ids("all")}|${ids("mafia")}|${ids("ghost")}`).toBe("p0,p1,p2,p3,p4||");
      return;
    }
    if (!CHAT_PHASES.has(phase)) {
      expect(`${ids("all")}|${ids("mafia")}|${ids("ghost")}`).toBe("||");
      return;
    }
    expect(ids("all")).toBe("p0,p1,p2,p3,p4");
    expect(ids("ghost")).toBe("p3");
    expect(ids("mafia")).toBe(phase === "night" ? "p1,p3" : "");
  });

  it("방에 없는 보낸 사람은 채널이 없다", () => {
    expect(String(channelOf(room("discussion"), "ghost"))).toBe("null");
  });
});
