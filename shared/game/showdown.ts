// 마지막 3인 결전 규칙(09.1.1-06, POL-05, 결정 0066-5). 순수 모듈이다 — 현재 시각·난수를 읽지 않고, 입력 상태는 바꾸지 않는다.
// 진입은 낮 시작 발표(dayAnnounce) 마감 훅 한 곳이고 조건은 산 사람 수(정확히 3)뿐이다 — 역할·마피아 여부·연결을 읽지 않는다(L21, T-09.1.1-16).
// 흐름: 모이기(i -1) → 좌석 오름차순 세 사람이 차례로 '마지막 한마디'(i 0..2, 확정 또는 시간 초과 뒤 사이) → 셋이 동시에 한 명 지목(i 3) → 동시 공개(i 4) → 집계(resolveShowdown).
// 한마디는 기존 chat 이고(acceptLastWord), 지목은 기존 point 다(castShowdownPoint). 모든 시간은 phases.ts 의 서버 시각 사슬이다(tick 의 stay).
import { countGraphemes } from "../nickname";
import type { ShowdownView, PointLine } from "../protocol";
import { isAlive } from "./alive";
import type { VoteError } from "./discussion";
import { enterDiscussion } from "./discussion";
import { PICK_GAP_MS, SHOWDOWN_GATHER_MS, SHOWDOWN_POINT_MS, SHOWDOWN_REVEAL_MS, SHOWDOWN_TURN_MS } from "./phases";
import type { RoomState, ShowdownState } from "./room";
import type { DeadlineResult } from "./tick";

/** 빠른 문구(O-11) — 한마디 입력 곁 칩. 상수 한 곳이다(봇과 화면이 같이 쓴다). 모두 30자소 이하. */
export const LAST_WORD_CHIPS: readonly string[] = Object.freeze(["저는 아니에요", "쟤가 수상해요", "저를 믿어 주세요", "끝까지 지켜봐요"]);

/** 한마디 최대 길이(자소). 넘으면 chatReject length 이고 차례는 유지된다. */
export const LAST_WORD_MAX_GRAPHEMES = 30;

/** 산 사람 수가 정확히 이 값일 때 낮 시작 발표 뒤 showdown 이 열린다. */
const SHOWDOWN_ALIVE = 3;

/** 지금 showdown 세부 단계의 길이(ms): 모이기 · 한마디 차례 · 확정 뒤 사이 · 동시 지목 · 공개. showdown 상태가 없으면 모이기 길이. */
export function showdownStepMs(state: RoomState): number {
  const sd = state.showdown;
  if (sd === undefined || sd.i < 0) return SHOWDOWN_GATHER_MS;
  if (sd.i <= 2) return sd.doneAt === undefined ? SHOWDOWN_TURN_MS : PICK_GAP_MS;
  return sd.i === 3 ? SHOWDOWN_POINT_MS : SHOWDOWN_REVEAL_MS;
}

/**
 * 진입: 낮 시작 청소(enterDiscussion — 토론을 건너뛰어도 빠지지 않는다)를 하고 산 사람 좌석 오름차순을 차례 순서로 고정한다(i -1 = 모이는 중).
 * 마감은 호출한 쪽(tick)이 건다.
 */
export function startShowdown(state: RoomState): RoomState {
  const cleaned = enterDiscussion(state);
  const order = cleaned.players
    .filter(isAlive)
    .map((p) => p.seat)
    .sort((a, b) => a - b);
  return { ...cleaned, showdown: { order, i: -1 } };
}

/** dayAnnounce 마감 훅: 산 사람이 정확히 셋이면 showdown, 아니면 기본(discussion)으로. 역할·연결은 읽지 않는다(L21). */
export function routeAfterDayAnnounce(state: RoomState): DeadlineResult {
  if (state.players.filter(isAlive).length !== SHOWDOWN_ALIVE) return { state, stay: false };
  return { state: startShowdown(state), stay: false, next: "showdown" };
}

/** 동시 지목 줄: 산 지목자가 산 대상을 가리킨 것만, 좌석 오름차순. 죽은 사람의 남은 표·죽은 대상을 가리킨 표는 줄이 없다. */
function pointLinesOfShowdown(state: RoomState): PointLine[] {
  const seated = new Map(state.players.map((p) => [p.seat, p]));
  const lines: PointLine[] = [];
  for (const p of [...state.players].sort((a, b) => a.seat - b.seat)) {
    if (!isAlive(p) || p.showdownPick === undefined) continue;
    const target = seated.get(p.showdownPick);
    if (!target || !isAlive(target)) continue;
    lines.push({ seat: p.seat, target: target.seat });
  }
  return lines;
}

/**
 * 마감이 지났을 때의 한 걸음(at = 지난 마감 시각). 새 마감은 호출한 쪽이 at + showdownStepMs(새 상태)로 건다.
 *   모이기 끝 → 차례 0 · 미확정 차례 → 시간 초과 skip 확정 · 확정 뒤 → 다음 차례, 마지막이면 동시 지목 ·
 *   동시 지목 끝 → 지목 줄 확정(공개, i 4) · 공개 끝 → 집계.
 * showdown 상태가 없으면 안전장치로 처형 없이 밤으로 보낸다.
 */
export function stepShowdown(state: RoomState, at: number): DeadlineResult {
  const sd = state.showdown;
  if (sd === undefined) return { state, stay: false, next: "night" };
  if (sd.i >= 4) return resolveShowdown(state);
  const withShowdown = (next: ShowdownState): DeadlineResult => ({ state: { ...state, showdown: next }, stay: true });
  const turn = (i: number): DeadlineResult =>
    withShowdown(i >= 3 ? { order: sd.order, i: 3, endsAt: at + SHOWDOWN_POINT_MS } : { order: sd.order, i, endsAt: at + SHOWDOWN_TURN_MS });
  if (sd.i < 0) return turn(0);
  if (sd.i <= 2) {
    if (sd.doneAt === undefined) return withShowdown({ ...sd, doneAt: at, skip: true });
    return turn(sd.i + 1);
  }
  return withShowdown({ order: sd.order, i: 4, points: pointLinesOfShowdown(state) });
}

/**
 * 동시 지목 한 표. 마지막 값이 유효하다(마감 전 번복 가능, O-12 — 조기 종료 없음).
 * 검사 순서가 계약이다: 단계(showdown 아니면 WRONG_PHASE) → 행위자(방에 있고 산 사람, 아니면 BAD_MESSAGE)
 * → 지목 창(i 3 이고 now < phaseEndsAt, 아니면 WRONG_PHASE) → 대상(셋 가운데 산 사람이고 자기 자신이 아님, 아니면 BAD_MESSAGE)
 * → 같은 값이면 입력 상태 그대로 ok → 그 사람의 showdownPick 만 바뀐 새 상태. 거절이면 입력 상태는 그대로다. 연결 상태는 읽지 않는다.
 */
export function castShowdownPoint(
  state: RoomState,
  actorId: string,
  target: number,
  now: number,
): { ok: true; state: RoomState } | { ok: false; error: VoteError } {
  const sd = state.showdown;
  if (state.phase !== "showdown" || sd === undefined) return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor) || !sd.order.includes(actor.seat)) return { ok: false, error: "BAD_MESSAGE" };
  if (sd.i !== 3 || state.phaseEndsAt === null || now >= state.phaseEndsAt) return { ok: false, error: "WRONG_PHASE" };
  const chosen = Number.isInteger(target) ? state.players.find((p) => p.seat === target) : undefined;
  if (!chosen || !isAlive(chosen) || chosen.seat === actor.seat || !sd.order.includes(chosen.seat)) return { ok: false, error: "BAD_MESSAGE" };
  if (actor.showdownPick === target) return { ok: true, state };
  return { ok: true, state: { ...state, players: state.players.map((p) => (p.id === actorId ? { ...p, showdownPick: target } : p)) } };
}

/**
 * 한마디 확정(채팅 재사용): 차례 주인이 자기 미확정 차례 창 안에서 보낸 정리된 글이 그 차례의 한마디가 된다.
 *   none     — 차례 주인의 미확정 창이 아니다(차례 아닌 사람·모이기·확정 뒤·창 밖·다른 단계): 호출부는 그냥 채팅으로 둔다.
 *   tooLong  — 30자소를 넘는다: 호출부는 chatReject length 로 거절하고 차례는 유지된다.
 *   ok       — word·doneAt = now 기록, 마감 = now + PICK_GAP_MS.
 */
export function acceptLastWord(
  state: RoomState,
  actorId: string,
  cleanText: string,
  now: number,
): { kind: "none" } | { kind: "tooLong" } | { kind: "ok"; state: RoomState } {
  const sd = state.showdown;
  if (state.phase !== "showdown" || sd === undefined || sd.i < 0 || sd.i > 2) return { kind: "none" };
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor) || sd.order[sd.i] !== actor.seat) return { kind: "none" };
  if (sd.doneAt !== undefined || sd.endsAt === undefined || now >= sd.endsAt) return { kind: "none" };
  if (cleanText.length > LAST_WORD_MAX_GRAPHEMES && countGraphemes(cleanText) > LAST_WORD_MAX_GRAPHEMES) return { kind: "tooLong" };
  return {
    kind: "ok",
    state: { ...state, showdown: { ...sd, word: cleanText, doneAt: now }, phaseEndsAt: now + PICK_GAP_MS },
  };
}

/**
 * 집계(결정 0066-5): 2표 이상 받은 사람이 있으면 최후 변론·찬반 없이 처형 단계로 — 그날 voteLog 줄 {exec 0·0 passed, cand {votes, candidate}, last} ·
 * verdict {passed:true, candidate} · next "execution"(기존 enterExecution 이 후보를 탈락시킨다). 없으면 처형 없음 — voteLog 줄(passed false, candidate 없음, last) ·
 * verdict {passed:false} · next "night"(votes 가 비면 noVotes, 아니면 tie 이유가 기존 noExecutionOf 로 파생된다).
 * showdown·showdownPick 은 키째 지운다.
 */
export function resolveShowdown(state: RoomState): DeadlineResult {
  const { showdown: _showdown, ...rest } = state;
  const votes = pointLinesOfShowdown(state);
  const players = state.players.map((p) => {
    const { showdownPick: _showdownPick, ...kept } = p;
    return kept;
  });
  const counts = new Map<number, number>();
  for (const v of votes) counts.set(v.target, (counts.get(v.target) ?? 0) + 1);
  let candidate: number | undefined;
  for (const [seat, count] of [...counts].sort((a, b) => a[0] - b[0])) {
    if (count >= 2) candidate = seat;
  }
  const n = state.day ?? 1;
  if (candidate === undefined) {
    const line = { n, exec: { yes: 0, no: 0, passed: false }, cand: { votes }, last: true as const };
    return { state: { ...rest, players, voteLog: [...(state.voteLog ?? []), line], verdict: { passed: false } }, stay: false, next: "night" };
  }
  const line = { n, exec: { yes: 0, no: 0, passed: true }, cand: { votes, candidate }, last: true as const };
  return {
    state: { ...rest, players, voteLog: [...(state.voteLog ?? []), line], verdict: { passed: true, candidate } },
    stay: false,
    next: "execution",
  };
}

/**
 * 공개 결전 정보(day.showdown). 필드별로 복사하고 없는 키는 만들지 않는다 — 역할·연결·개인 선택을 읽지 않는다(L21).
 * i 3 은 던진 좌석(voted, 오름차순)뿐, i 4 는 확정된 지목 줄(points)뿐이다. showdown 이 없으면 undefined.
 */
export function showdownViewOf(state: RoomState): ShowdownView | undefined {
  const sd = state.showdown;
  if (sd === undefined) return undefined;
  const view: ShowdownView = { order: [...sd.order], i: sd.i };
  if (sd.endsAt !== undefined) view.endsAt = sd.endsAt;
  if (sd.doneAt !== undefined) view.doneAt = sd.doneAt;
  if (sd.skip === true) view.skip = true;
  if (sd.word !== undefined) view.word = sd.word;
  if (sd.i === 3) {
    view.voted = state.players
      .filter((p) => isAlive(p) && sd.order.includes(p.seat) && p.showdownPick !== undefined)
      .map((p) => p.seat)
      .sort((a, b) => a - b);
  }
  if (sd.i === 4 && sd.points !== undefined) view.points = sd.points.map((l) => ({ seat: l.seat, target: l.target }));
  return view;
}
