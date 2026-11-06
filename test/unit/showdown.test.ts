// 마지막 3인 결전 규칙 단위 시험(09.1.1-06, POL-05, 결정 0066-5). 순수 모듈 showdown.ts 와 tick 분기.
// 진입은 산 사람 수(정확히 3)만의 함수다 — 역할·마피아 여부를 읽지 않는다(L21).
import { describe, expect, it } from "vitest";
import {
  LAST_WORD_CHIPS,
  LAST_WORD_MAX_GRAPHEMES,
  acceptLastWord,
  castShowdownPoint,
  resolveShowdown,
  routeAfterDayAnnounce,
  showdownStepMs,
  showdownViewOf,
  stepShowdown,
} from "../../shared/game/showdown";
import { DAY_ANNOUNCE_MS, PHASE_DEFS, PICK_GAP_MS, SHOWDOWN_GATHER_MS, SHOWDOWN_POINT_MS, SHOWDOWN_REVEAL_MS, SHOWDOWN_TURN_MS } from "../../shared/game/phases";
import { isAlive } from "../../shared/game/alive";
import type { RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { startedAt } from "../helpers/voteState";
import { seededRandInt } from "../helpers/seededRandom";
import { RULESET } from "../../shared/game/ruleset";

const rand = seededRandInt(9);
const idOf = (s: RoomState, seat: number): string => s.players.find((p) => p.seat === seat)!.id;

/** 4명 판에서 좌석 3 을 죽인 낮 시작 발표 — 산 사람 정확히 셋(좌석 0·1·2). */
function threeAlive(seed = 3): RoomState {
  const s = startedAt(4, seed, "dayAnnounce");
  return { ...s, players: s.players.map((p) => (p.seat === 3 ? { ...p, alive: false } : p)) };
}

/** dayAnnounce 마감을 넘긴 직후 = showdown 모이기(i -1). */
function atShowdown(seed = 3): RoomState {
  const s = threeAlive(seed);
  return tick(s, s.phaseEndsAt!, rand);
}

/** 마감에서 한 걸음(tick 의 사슬 규약: 새 마감 = 지난 마감 + 새 단계 길이). */
function step(s: RoomState): RoomState {
  return tick(s, s.phaseEndsAt!, rand);
}

// 기본판(결정 0072)에서 꺼짐 — RULESET.showdown 를 켜면 다시 돈다
describe.skipIf(!RULESET.showdown)("진입 — 산 사람 수만의 함수 (결정 0066-5, L21)", () => {
  it("낮 시작 발표 마감에 산 사람이 정확히 셋이면 토론 대신 showdown 이 열리고 길이는 모이기 2초", () => {
    const s = threeAlive();
    const deadline = s.phaseEndsAt!;
    const next = tick(s, deadline, rand);
    expect(next.phase).toBe("showdown");
    expect(next.showdown).toEqual({ order: [0, 1, 2], i: -1 });
    expect(next.phaseEndsAt).toBe(deadline + SHOWDOWN_GATHER_MS);
    expect(SHOWDOWN_GATHER_MS).toBe(2000);
    expect(PHASE_DEFS.showdown).toEqual({ durationMs: 2000, next: "night", revealsOwnRole: true });
  });

  it("산 사람이 셋이 아니면(4명·2명) 지금처럼 토론으로 간다", () => {
    const four = startedAt(4, 3, "dayAnnounce");
    expect(tick(four, four.phaseEndsAt!, rand).phase).toBe("discussion");
    const two = { ...four, players: four.players.map((p) => (p.seat >= 2 ? { ...p, alive: false } : p)) };
    expect(tick(two, two.phaseEndsAt!, rand).phase).toBe("discussion");
    expect(routeAfterDayAnnounce(four)).toEqual({ state: four, stay: false });
    expect(DAY_ANNOUNCE_MS).toBeGreaterThan(0);
  });

  it("낮 시작 청소(enterDiscussion)가 빠지지 않는다 — 지난 낮의 개인 키와 verdict 가 지워진다", () => {
    const s = threeAlive();
    const dirty: RoomState = {
      ...s,
      verdict: { passed: true, candidate: 1 },
      players: s.players.map((p) => ({ ...p, nominate: 1, verdictVote: true, endVote: true, runoffVote: 0 })),
    };
    const next = tick(dirty, dirty.phaseEndsAt!, rand);
    expect(next.phase).toBe("showdown");
    expect(next.verdict).toBeUndefined();
    expect(next.players.some((p) => p.nominate !== undefined || p.verdictVote !== undefined || p.endVote !== undefined || p.runoffVote !== undefined)).toBe(false);
  });

  it("역할 배정만 다른 두 판의 진입·순서·시각이 같다 (L21)", () => {
    const a = threeAlive();
    const b: RoomState = { ...a, players: a.players.map((p) => ({ ...p, role: p.seat === 0 ? "mafia" : "citizen" })) };
    const c: RoomState = { ...a, players: a.players.map((p) => ({ ...p, role: p.seat === 2 ? "mafia" : "citizen" })) };
    const pick = (s: RoomState): string => {
      const n = tick(s, s.phaseEndsAt!, rand);
      return JSON.stringify([n.phase, n.showdown, n.phaseEndsAt]);
    };
    expect(pick(b)).toBe(pick(c));
    expect(pick(a)).toBe(pick(b));
  });
});

// 기본판(결정 0072)에서 꺼짐 — RULESET.showdown 를 켜면 다시 돈다
describe.skipIf(!RULESET.showdown)("한마디 사슬 (stay)", () => {
  it("모이기 → 차례 0(8초) → 시간 초과면 skip → 사이 0.9초 → 차례 1 …", () => {
    let s = atShowdown();
    const gatherEnd = s.phaseEndsAt!;
    s = step(s);
    expect(s.phase).toBe("showdown");
    expect(s.showdown).toEqual({ order: [0, 1, 2], i: 0, endsAt: gatherEnd + SHOWDOWN_TURN_MS });
    expect(s.phaseEndsAt).toBe(gatherEnd + SHOWDOWN_TURN_MS);
    expect(showdownStepMs(s)).toBe(SHOWDOWN_TURN_MS);
    s = step(s);
    expect(s.showdown?.i).toBe(0);
    expect(s.showdown?.skip).toBe(true);
    expect(s.showdown?.word).toBeUndefined();
    expect(s.phaseEndsAt).toBe(gatherEnd + SHOWDOWN_TURN_MS + PICK_GAP_MS);
    s = step(s);
    expect(s.showdown?.i).toBe(1);
    expect(s.showdown?.skip).toBeUndefined();
    expect(s.showdown?.doneAt).toBeUndefined();
  });

  it("세 차례 뒤 동시 지목 창(8초) → 공개(1.5초) → 집계", () => {
    let s = atShowdown();
    for (let i = 0; i < 1 + 3 * 2; i += 1) s = step(s);
    expect(s.showdown?.i).toBe(3);
    expect(showdownStepMs(s)).toBe(SHOWDOWN_POINT_MS);
    expect(s.phaseEndsAt! - 0).toBeGreaterThan(0);
    s = step(s);
    expect(s.showdown?.i).toBe(4);
    expect(showdownStepMs(s)).toBe(SHOWDOWN_REVEAL_MS);
    expect(s.showdown?.points).toEqual([]);
  });
});

// 기본판(결정 0072)에서 꺼짐 — RULESET.showdown 를 켜면 다시 돈다
describe.skipIf(!RULESET.showdown)("한마디 확정 (acceptLastWord)", () => {
  const atTurn = (): RoomState => step(atShowdown());

  it("차례 주인의 한 줄이 그 차례의 한마디가 되고 마감은 지금 + 사이", () => {
    const s = atTurn();
    const now = s.showdown!.endsAt! - 3000;
    const r = acceptLastWord(s, idOf(s, 0), "저는 아니에요", now);
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.state.showdown).toMatchObject({ i: 0, word: "저는 아니에요", doneAt: now });
    expect(r.state.phaseEndsAt).toBe(now + PICK_GAP_MS);
    // 한 번 확정되면 같은 차례의 다음 줄은 단순 채팅이다.
    expect(acceptLastWord(r.state, idOf(s, 0), "또 말해요", now + 100).kind).toBe("none");
  });

  it("차례 아닌 사람·모이기·창 밖·다른 단계는 none(단순 채팅)", () => {
    const s = atTurn();
    const now = s.showdown!.endsAt! - 3000;
    expect(acceptLastWord(s, idOf(s, 1), "제 차례 아닌데요", now).kind).toBe("none");
    expect(acceptLastWord(s, idOf(s, 0), "너무 늦었어요", s.showdown!.endsAt!).kind).toBe("none");
    expect(acceptLastWord(atShowdown(), idOf(s, 0), "모이는 중", 0).kind).toBe("none");
    expect(acceptLastWord(startedAt(4, 3, "discussion"), "player-id-0000-aaaa", "토론", 0).kind).toBe("none");
  });

  it("30자소를 넘으면 tooLong 이고 차례는 유지된다, 30자소는 통과", () => {
    const s = atTurn();
    const now = s.showdown!.endsAt! - 3000;
    expect(LAST_WORD_MAX_GRAPHEMES).toBe(30);
    expect(acceptLastWord(s, idOf(s, 0), "가".repeat(31), now).kind).toBe("tooLong");
    expect(acceptLastWord(s, idOf(s, 0), "가".repeat(30), now).kind).toBe("ok");
    // 차례 아닌 사람의 긴 글은 거절 대상이 아니다.
    expect(acceptLastWord(s, idOf(s, 1), "가".repeat(31), now).kind).toBe("none");
  });

  it("빠른 문구 네 개가 상수 한 곳에 있고 모두 30자소 이하다", () => {
    expect(LAST_WORD_CHIPS).toEqual(["저는 아니에요", "쟤가 수상해요", "저를 믿어 주세요", "끝까지 지켜봐요"]);
    for (const c of LAST_WORD_CHIPS) expect([...c].length).toBeLessThanOrEqual(LAST_WORD_MAX_GRAPHEMES);
  });
});

// 기본판(결정 0072)에서 꺼짐 — RULESET.showdown 를 켜면 다시 돈다
describe.skipIf(!RULESET.showdown)("동시 지목 (castShowdownPoint)", () => {
  const atPoint = (): RoomState => {
    let s = atShowdown();
    for (let i = 0; i < 1 + 3 * 2; i += 1) s = step(s);
    return s;
  };

  it("지목 창에서 산 사람이 자기 외 산 사람을 지목하고 마감 전에 바꿀 수 있다", () => {
    const s = atPoint();
    const now = s.phaseEndsAt! - 5000;
    const r = castShowdownPoint(s, idOf(s, 0), 1, now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.players.find((p) => p.seat === 0)?.showdownPick).toBe(1);
    const same = castShowdownPoint(r.state, idOf(s, 0), 1, now);
    expect(same.ok && same.state === r.state).toBe(true);
    const changed = castShowdownPoint(r.state, idOf(s, 0), 2, now + 100);
    expect(changed.ok && changed.state.players.find((p) => p.seat === 0)?.showdownPick).toBe(2);
  });

  it("거절: 단계 밖 WRONG_PHASE · 창 밖(한마디 중·마감 뒤) WRONG_PHASE · 자기 자신·죽은 대상·유령 BAD_MESSAGE", () => {
    const s = atPoint();
    const now = s.phaseEndsAt! - 5000;
    expect(castShowdownPoint(startedAt(4, 3, "discussion"), "player-id-0000-aaaa", 1, 0)).toEqual({ ok: false, error: "WRONG_PHASE" });
    expect(castShowdownPoint(step(atShowdown()), idOf(s, 0), 1, 0)).toEqual({ ok: false, error: "WRONG_PHASE" });
    expect(castShowdownPoint(s, idOf(s, 0), 1, s.phaseEndsAt!)).toEqual({ ok: false, error: "WRONG_PHASE" });
    expect(castShowdownPoint(s, idOf(s, 0), 0, now)).toEqual({ ok: false, error: "BAD_MESSAGE" });
    expect(castShowdownPoint(s, idOf(s, 0), 3, now)).toEqual({ ok: false, error: "BAD_MESSAGE" });
    expect(castShowdownPoint(s, idOf(s, 0), 9, now)).toEqual({ ok: false, error: "BAD_MESSAGE" });
    expect(castShowdownPoint(s, "nobody", 1, now)).toEqual({ ok: false, error: "BAD_MESSAGE" });
    const ghost = s.players.find((p) => p.seat === 3)!;
    expect(castShowdownPoint(s, ghost.id, 1, now)).toEqual({ ok: false, error: "BAD_MESSAGE" });
    // 거절이면 입력 상태는 그대로다.
    expect(s.players.some((p) => p.showdownPick !== undefined)).toBe(false);
  });
});

// 기본판(결정 0072)에서 꺼짐 — RULESET.showdown 를 켜면 다시 돈다
describe.skipIf(!RULESET.showdown)("집계 (resolveShowdown)", () => {
  /** 지목 창에서 seat → target 을 던지고 공개(i 4) 자리까지. */
  function pointed(picks: Record<number, number>): RoomState {
    let s = atShowdown();
    for (let i = 0; i < 1 + 3 * 2; i += 1) s = step(s);
    const now = s.phaseEndsAt! - 4000;
    for (const [seat, target] of Object.entries(picks)) {
      const r = castShowdownPoint(s, idOf(s, Number(seat)), target, now);
      if (!r.ok) throw new Error(`cast rejected: ${r.error}`);
      s = r.state;
    }
    return step(s);
  }

  it("2표 이상 받은 사람이 있으면 변론·찬반 없이 처형 단계로 — 후보 탈락, verdict last, voteLog last", () => {
    const revealed = pointed({ 0: 2, 1: 2, 2: 0 });
    expect(revealed.showdown?.i).toBe(4);
    expect(revealed.showdown?.points).toEqual([
      { seat: 0, target: 2 },
      { seat: 1, target: 2 },
      { seat: 2, target: 0 },
    ]);
    const exec = step(revealed);
    expect(exec.phase).toBe("execution");
    expect(exec.execution).toEqual({ seat: 2 });
    expect(exec.players.find((p) => p.seat === 2)!.alive).toBe(false);
    expect(exec.verdict).toMatchObject({ passed: true, candidate: 2 });
    const line = exec.voteLog!.at(-1)!;
    expect(line).toMatchObject({ n: exec.day, exec: { yes: 0, no: 0, passed: true }, cand: { candidate: 2 }, last: true });
    expect(line.cand!.votes.length).toBe(3);
    expect(exec.showdown).toBeUndefined();
    expect(exec.players.some((p) => p.showdownPick !== undefined)).toBe(false);
  });

  it("1-1-1(서로 한 명씩 돌려 지목)이면 처형 없이 밤 — 이유는 tie", () => {
    const night = step(pointed({ 0: 1, 1: 2, 2: 0 }));
    expect(night.phase).toBe("night");
    expect(night.players.filter(isAlive).length).toBe(3);
    const line = night.voteLog!.at(-1)!;
    expect(line.cand?.candidate).toBeUndefined();
    expect(line.exec.passed).toBe(false);
    expect(line.last).toBe(true);
    expect(night.showdown).toBeUndefined();
  });

  it("아무도 안 던지면 처형 없는 밤 — 이유는 noVotes", () => {
    const night = step(pointed({}));
    expect(night.phase).toBe("night");
    expect(night.voteLog!.at(-1)!.cand?.votes).toEqual([]);
  });

  it("resolveShowdown 은 showdown 이 없으면 안전하게 밤으로 보낸다", () => {
    const s = threeAlive();
    expect(resolveShowdown(s).next).toBe("night");
  });
});

// 기본판(결정 0072)에서 꺼짐 — RULESET.showdown 를 켜면 다시 돈다
describe.skipIf(!RULESET.showdown)("공개 모양 (showdownViewOf)", () => {
  it("모이기에는 order·i 뿐이고, 차례에는 endsAt, 확정에는 word·doneAt", () => {
    const gather = atShowdown();
    expect(showdownViewOf(gather)).toEqual({ order: [0, 1, 2], i: -1 });
    const turn = step(gather);
    expect(showdownViewOf(turn)).toEqual({ order: [0, 1, 2], i: 0, endsAt: turn.showdown!.endsAt });
    const done = acceptLastWord(turn, idOf(turn, 0), "저는 아니에요", turn.showdown!.endsAt! - 1000);
    if (done.kind !== "ok") throw new Error("expected ok");
    const v = showdownViewOf(done.state)!;
    expect(v.word).toBe("저는 아니에요");
    expect(v.doneAt).toBeDefined();
    expect(Object.keys(v).sort()).toEqual(["doneAt", "endsAt", "i", "order", "word"]);
  });

  it("showdown 이 없으면 undefined", () => {
    expect(showdownViewOf(threeAlive())).toBeUndefined();
  });
});

describe("stepShowdown 안전장치", () => {
  it("showdown 상태가 없으면 밤으로", () => {
    expect(stepShowdown(threeAlive(), 0)).toMatchObject({ stay: false, next: "night" });
  });
});
