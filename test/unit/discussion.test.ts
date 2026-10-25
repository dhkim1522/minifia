import { describe, expect, it } from "vitest";
import * as discussionModule from "../../shared/game/discussion";
import { phaseDurationOf } from "../../shared/game/discussion";
import * as phasesModule from "../../shared/game/phases";
import { ROOM_TTL_MS } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import type { PhaseId } from "../../shared/protocol";

function player(i: number): Player {
  return {
    id: `p${i}`,
    token: `token-p${i}-0123456789`,
    seat: i,
    nickname: `이름${i}`,
    nicknameKey: `이름${i}`,
    joinSeq: i,
    connected: true,
    connId: `c${i}`,
  };
}

/** 5명 방, 방장은 p0. */
function room(phase: PhaseId, phaseEndsAt: number | null, extra: Record<string, unknown> = {}): RoomState {
  return {
    code: "0420",
    createdAt: 0,
    expiresAt: ROOM_TTL_MS,
    phase,
    phaseEndsAt,
    day: 1,
    hostId: "p0",
    nextJoinSeq: 5,
    players: [0, 1, 2, 3, 4].map(player),
    ...extra,
  } as RoomState;
}

// 결과는 한 줄 문자열로 비교한다(TAP 증거 규칙).
describe("phaseDurationOf - 단계 길이 파생 (결정 0017-5, Pitfall 3)", () => {
  it("phaseDurationOf 는 단계 표 길이 그대로다: discussion 90000, claim 8000(한 차례), dayAnnounce 2000, lobby null", () => {
    const got = (["discussion", "claim", "dayAnnounce", "lobby"] as const)
      .map((phase) => `${phase}:${phaseDurationOf(room(phase, phase === "lobby" ? null : 100_000))}`)
      .join(" ");
    expect(got).toBe("discussion:90000 claim:8000 dayAnnounce:2000 lobby:null");
  });

  it("저장된 옛 상태에 연장 표시(extendUsed true)가 남아 있어도 discussion 길이는 90000 이다", () => {
    expect(phaseDurationOf(room("discussion", 100_000, { extendUsed: true }))).toBe(90_000);
  });

  it("discussion 모듈이 내보내는 것은 phaseDurationOf 하나다", () => {
    expect(Object.keys(discussionModule).sort().join(",")).toBe("phaseDurationOf");
  });

  it("phases 모듈에 연장 길이 상수가 없다", () => {
    expect(Object.keys(phasesModule).filter((k) => k.startsWith("EXTEND")).join(",")).toBe("");
  });
});
