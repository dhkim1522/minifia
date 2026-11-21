import { describe, expect, it, vi } from "vitest";
import * as discussionModule from "../../shared/game/discussion";
import { enterDiscussion, morningMsOf, phaseDurationOf } from "../../shared/game/discussion";
import * as phasesModule from "../../shared/game/phases";
import { DISCUSSION_MS, MORNING_MAX_MS, MORNING_MS } from "../../shared/game/phases";
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
  it("phaseDurationOf 는 단계 표 길이 그대로다: discussion 90000, dayAnnounce 2000, lobby null", () => {
    const got = (["discussion", "dayAnnounce", "lobby"] as const)
      .map((phase) => `${phase}:${phaseDurationOf(room(phase, phase === "lobby" ? null : 100_000))}`)
      .join(" ");
    expect(got).toBe("discussion:90000 dayAnnounce:2000 lobby:null");
  });

  it("저장된 옛 상태에 연장 표시(extendUsed true)가 남아 있어도 discussion 길이는 DISCUSSION_MS(90000) 이다", () => {
    expect(phaseDurationOf(room("discussion", 100_000, { extendUsed: true }))).toBe(DISCUSSION_MS);
  });

  it("discussion 모듈은 단계 길이와 낮 시작 상태 정리를 제공한다", () => {
    expect(Object.keys(discussionModule).sort().join(",")).toBe("enterDiscussion,morningMsOf,phaseDurationOf");
  });

  it("phases 모듈에 연장 길이 상수가 없다", () => {
    expect(Object.keys(phasesModule).filter((k) => k.startsWith("EXTEND")).join(",")).toBe("");
  });
});

describe("enterDiscussion — 낮 시작 청소 (결정 0060-2, Pitfall 1)", () => {
  const dirty = (): RoomState => {
    const base = room("dayAnnounce", 100_000, {
      verdict: { passed: true, candidate: 2 },
      execution: { seat: 2, phrase: 1 },
      voteLog: [{ n: 1, exec: { yes: 4, no: 1, passed: true }, cand: { votes: [{ seat: 0, target: 2 }], candidate: 2 } }],
    });
    return {
      ...base,
      players: base.players.map((p) => ({ ...p, nominate: 2, verdictVote: true, endVote: true as const, ...(p.seat === 4 ? { alive: false } : {}) })),
    };
  };

  it("verdict·execution 과 모든 플레이어의 nominate·verdictVote·endVote 를 키째 지운다", () => {
    const r = enterDiscussion(dirty());
    const stale = r.players.filter((p) => "nominate" in p || "verdictVote" in p || "endVote" in p).length;
    expect(`${"verdict" in r} ${"execution" in r} ${stale}`).toBe("false false 0");
  });

  it("voteLog 와 그 밖의 키·플레이어 값은 그대로 둔다", () => {
    const before = dirty();
    const r = enterDiscussion(before);
    expect(r.voteLog === before.voteLog).toBe(true);
    expect(`${r.day} ${r.players.find((p) => p.seat === 4)?.alive} ${r.players.length}`).toBe("1 false 5");
  });
});

// ---- 09-07 Task 2: 아침 길이 공식 (MORN-04, L6, 결정 0061-13) ----
describe("morningMsOf - 아침 길이는 공개 내용만의 함수 (MORN-04, 결정 0061-13)", () => {
  const withWill = (seat: number, will: string): Partial<RoomState> => ({
    players: [0, 1, 2, 3, 4].map((i) => (i === seat ? { ...player(i), will } : player(i))),
  });

  it("morning 이 없거나 {} 이거나 { saved: true } 이면 5000 이다", () => {
    expect(
      [room("morning", 1), room("morning", 1, { morning: {} }), room("morning", 1, { morning: { saved: true } })]
        .map(morningMsOf)
        .join(","),
    ).toBe(`${MORNING_MS},${MORNING_MS},${MORNING_MS}`);
    expect(MORNING_MS).toBe(5000);
  });

  it("탈락이면 기본 5000 + 2000, 유언이 있으면 +2000, 쪽지까지 있으면 +2000 이다", () => {
    const base = { morning: { eliminated: 1 } };
    expect(morningMsOf(room("morning", 1, base))).toBe(7000);
    expect(morningMsOf(room("morning", 1, { ...base, ...withWill(1, "유언") }))).toBe(9000);
    expect(morningMsOf(room("morning", 1, { ...base, ...withWill(1, "유언"), nightNote: "쪽지" }))).toBe(11000);
    expect(morningMsOf(room("morning", 1, { ...base, nightNote: "쪽지" }))).toBe(9000);
  });

  it("공백 문자열 유언은 유언 없음으로 센다(빈 문자열)", () => {
    expect(morningMsOf(room("morning", 1, { morning: { eliminated: 1 }, ...withWill(1, "") }))).toBe(7000);
  });

  it("다른 사람의 유언·쪽지는 길이에 들지 않는다(피해자의 유언만)", () => {
    expect(morningMsOf(room("morning", 1, { morning: { eliminated: 1 }, ...withWill(2, "남의 유언") }))).toBe(7000);
  });

  it("MORNING_MAX_MS(16000)로 자른다 — 가산 상수를 크게 바꾼 가상 값으로도 넘지 않는다", async () => {
    expect(MORNING_MAX_MS).toBe(16_000);
    vi.resetModules();
    vi.doMock("../../shared/game/phases", async (orig) => ({
      ...(await orig<typeof import("../../shared/game/phases")>()),
      MORNING_VICTIM_MS: 9_000,
      MORNING_WILL_MS: 9_000,
      MORNING_NOTE_MS: 9_000,
    }));
    try {
      const fresh = await import("../../shared/game/discussion");
      // 모듈을 새로 읽으면 규칙 모듈의 시험 잠금(원인 흐름)도 새로 시작해 제품 값이 된다 — 상한 자체를 보는 시험이라 현장 시간이 붙지 않는 기본 마피아 판으로 확인한다(21-01).
      const s = room("morning", 1, { morning: { eliminated: 1 }, nightNote: "쪽지", ...withWill(1, "유언") });
      expect(fresh.morningMsOf(s)).toBe(MORNING_MAX_MS);
    } finally {
      vi.doUnmock("../../shared/game/phases");
      vi.resetModules();
    }
  });

  it("phaseDurationOf: morning 이면 morningMsOf, 다른 단계는 표 값이다", () => {
    const m = room("morning", 1, { morning: { eliminated: 1 }, nightNote: "쪽지" });
    expect(phaseDurationOf(m)).toBe(morningMsOf(m));
    expect(phaseDurationOf(m)).toBe(9000);
    expect(phaseDurationOf(room("night", 1))).toBe(30_000);
  });
});
