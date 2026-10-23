import { describe, expect, it } from "vitest";
import { extendDiscussion, phaseDurationOf, skipDiscussion } from "../../shared/game/discussion";
import { CLAIM_MS, CLAIM_REVEAL_MS, DAY_ANNOUNCE_MS, DISCUSSION_MS, EXTEND_MS } from "../../shared/game/phases";
import { ROOM_TTL_MS } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import type { ChatLine, PhaseId } from "../../shared/protocol";

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

const LINES: ChatLine[] = [
  { seq: 1, seat: 1, template: "innocent", at: 1 },
  { seq: 2, seat: 2, template: "suspect", target: 3, at: 2 },
];

/** 5명 방, 방장은 p0. */
function room(phase: PhaseId, phaseEndsAt: number | null, extra: Partial<RoomState> = {}): RoomState {
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
  };
}

// 객체 toEqual 의 여러 줄 diff 는 TAP 증거를 깨뜨린다(02-02 선례) — 결과는 한 줄 문자열로 비교한다.
const outcome = (r: { ok: true } | { ok: false; error: string }): string => (r.ok ? "ok" : r.error);
const brief = (s: RoomState): string =>
  `${s.phase}/${s.phaseEndsAt}/day${s.day}/msgs${(s.messages ?? []).length}/ext${s.extendUsed ?? false}`;

describe("extendDiscussion - 방장 연장 (D-18, DAY-01)", () => {
  it("비방장은 NOT_HOST", () => {
    expect(outcome(extendDiscussion(room("discussion", 100_000), "p1"))).toBe("NOT_HOST");
  });

  it("방장이 discussion 이 아닌 단계에서 하면 WRONG_PHASE", () => {
    expect(outcome(extendDiscussion(room("claim", 100_000), "p0"))).toBe("WRONG_PHASE");
  });

  it("비방장이 claim 단계에서 하면 NOT_HOST — 방장 검사가 먼저다", () => {
    expect(outcome(extendDiscussion(room("claim", 100_000), "p1"))).toBe("NOT_HOST");
  });

  it("방에 없는 actorId 는 NOT_HOST", () => {
    expect(outcome(extendDiscussion(room("discussion", 100_000), "ghost"))).toBe("NOT_HOST");
  });

  it("방장·discussion 이면 마감이 30초 늘고 extendUsed 가 true 다", () => {
    const state = room("discussion", 100_000);
    const before = JSON.stringify(state);
    const r = extendDiscussion(state, "p0");
    expect(outcome(r)).toBe("ok");
    if (!r.ok) return;
    expect(brief(r.state)).toBe(`discussion/${100_000 + EXTEND_MS}/day1/msgs0/exttrue`);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("같은 낮에 다시 하면 ALREADY_EXTENDED", () => {
    const first = extendDiscussion(room("discussion", 100_000), "p0");
    if (!first.ok) throw new Error("setup");
    expect(outcome(extendDiscussion(first.state, "p0"))).toBe("ALREADY_EXTENDED");
  });

  it("phaseEndsAt 이 비어 있는 비정상 상태는 WRONG_PHASE", () => {
    expect(outcome(extendDiscussion(room("discussion", null), "p0"))).toBe("WRONG_PHASE");
  });
});

describe("skipDiscussion - 방장 넘기기 (D-18, D-19)", () => {
  const NOW = 50_000;

  it("비방장은 NOT_HOST, discussion 이 아니면 WRONG_PHASE", () => {
    expect(outcome(skipDiscussion(room("discussion", NOW + 50_000), "p1", NOW))).toBe("NOT_HOST");
    expect(outcome(skipDiscussion(room("claim", NOW + 5_000), "p0", NOW))).toBe("WRONG_PHASE");
    expect(outcome(skipDiscussion(room("claim", NOW + 5_000), "p1", NOW))).toBe("NOT_HOST");
  });

  it("방장이 넘기면 즉시 다음 낮 시작 발표(마감 now+2000, day+1, 메시지 비움, 연장 초기화)로 간다", () => {
    const state = room("discussion", NOW + 50_000, { messages: LINES, extendUsed: true, nextMessageSeq: 3 });
    const before = JSON.stringify(state);
    const r = skipDiscussion(state, "p0", NOW);
    expect(outcome(r)).toBe("ok");
    if (!r.ok) return;
    expect(brief(r.state)).toBe(`dayAnnounce/${NOW + DAY_ANNOUNCE_MS}/day2/msgs0/extfalse`);
    expect(r.state.nextMessageSeq).toBe(3);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("phaseDurationOf - 단계 길이 파생 (Pitfall 3)", () => {
  it("discussion 은 90000, 연장하면 120000, claim 15000, lobby 는 null", () => {
    const rows = [
      phaseDurationOf(room("discussion", 1)),
      phaseDurationOf(room("discussion", 1, { extendUsed: false })),
      phaseDurationOf(room("discussion", 1, { extendUsed: true })),
      phaseDurationOf(room("claim", 1)),
      phaseDurationOf(room("claim", 1, { extendUsed: true })),
      phaseDurationOf(room("lobby", null)),
    ];
    expect(rows.map(String).join(",")).toBe(`${DISCUSSION_MS},${DISCUSSION_MS},${DISCUSSION_MS + EXTEND_MS},${CLAIM_MS},${CLAIM_MS},null`);
    expect(`${DISCUSSION_MS}/${EXTEND_MS}`).toBe("90000/30000"); // 계획이 못 박은 값(연장 전 90000, 연장 뒤 120000)
  });

  it("연장 뒤 넘겨서 다음 낮 discussion 까지 가면 extendUsed false 에 90000 으로 돌아온다", () => {
    const NOW = 50_000;
    const ext = extendDiscussion(room("discussion", NOW + 50_000), "p0");
    if (!ext.ok) throw new Error("setup");
    expect(phaseDurationOf(ext.state)).toBe(DISCUSSION_MS + EXTEND_MS);
    const skipped = skipDiscussion(ext.state, "p0", NOW);
    if (!skipped.ok) throw new Error("setup");
    const nextDiscussionAt = NOW + DAY_ANNOUNCE_MS + CLAIM_MS + CLAIM_REVEAL_MS;
    const next = tick(skipped.state, nextDiscussionAt);
    expect(brief(next)).toBe(`discussion/${nextDiscussionAt + DISCUSSION_MS}/day2/msgs0/extfalse`);
    expect(phaseDurationOf(next)).toBe(DISCUSSION_MS);
    // 다음 낮에 연장을 다시 한 번 쓸 수 있다
    expect(outcome(extendDiscussion(next, "p0"))).toBe("ok");
  });
});
