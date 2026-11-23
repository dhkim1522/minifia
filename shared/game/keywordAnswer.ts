// 서버 전용(23-01): 첫날 키워드 단계의 진행 훅. 클라이언트가 import 하는 shared/game/phases.ts 는 이 모듈을 import 하지 않는다(Pitfall 8).
// 23-05·23-06 이 같은 파일에 답 접수·공개·키워드 마감 훅을 더한다.
import { countGraphemes } from "../nickname";
import { isAlive } from "./alive";
import { ANSWER_MAX_GRAPHEMES } from "./answerRules";
import { isBot } from "./bots";
import { sanitizeChatText } from "./chatRules";
import { violatesKeyword } from "./keywordGuard";
import type { KeywordForms } from "./keywordGuard";
import { BAR_CHAIR_CLOCKWISE_ANGLES, keywordPresentationOf } from "./keywordPresentation";
import { keywordEntryOf } from "./keywords";
import { barChairAssignment } from "./map";
import { firstDayAnswerPending } from "./phases";
import type { Player, RoomState } from "./room";
import type { DeadlineResult } from "./tick";

/**
 * 역할 확인 마감 훅(D-01·D-29). 키워드가 있으면 표의 기본 다음 단계(keyword)로 가고,
 * 없으면(옛 저장 방·스위치를 끈 시험) 곧장 낮 시작 발표로 간다 — 기능 전체가 keyword 키 하나로 켜지고 꺼진다.
 */
export function routeAfterRoleReveal(state: RoomState): DeadlineResult {
  return state.keyword === undefined ? { state, stay: false, next: "dayAnnounce" } : { state, stay: false };
}

/** 공개가 시작된 뒤에는 기록에서도 같은 제시어와 답을 볼 수 있다. */
export function answerOpenOf(state: RoomState): boolean {
  return state.keyword !== undefined && (state.keywordReveal !== undefined || ((state.day ?? 1) === 1 && state.phase === "answerReveal"));
}

/** 발표가 끝난 직후에 공개 상태를 저장한다. 아무 답도 없었던 첫날에도 같은 흐름을 쓴다. */
export function routeAfterKeywordPresentation(state: RoomState): DeadlineResult | undefined {
  const turn = stepKeywordPresentation(state);
  if (turn !== undefined) return turn;
  if (!firstDayAnswerPending(state)) return undefined;
  const { keywordPresentationIndex: _presentation, ...presented } = state;
  return { state: { ...presented, keywordReveal: "beforeDiscussion" }, stay: false, next: "answerReveal" };
}

/** 배포 때 이미 저녁 공개에 들어갔던 판은 토론을 되돌리지 않고 밤을 이어 간다. */
export function routeAfterKeywordReveal(state: RoomState): DeadlineResult {
  if (state.keywordReveal === "beforeDiscussion") return { state, stay: false, next: "discussion" };
  return { state: state.keyword === undefined ? state : { ...state, keywordReveal: "afterDay" }, stay: false };
}

/**
 * 금지어 판정에 쓸 형태(RESEARCH P4). 목록에 그 항목이 있으면 단어+별칭, 목록이 바뀌어 없으면 단어만.
 * keyword 가 없으면 undefined(옛 방 — 검사할 것이 없다).
 */
function formsOf(state: RoomState): KeywordForms | undefined {
  if (state.keyword === undefined) return undefined;
  return keywordEntryOf(state.keyword.genre, state.keyword.word) ?? { word: state.keyword.word, aliases: [] };
}

export function keywordAnswerBlocked(state: RoomState, text: string): boolean {
  const forms = formsOf(state);
  return forms !== undefined && violatesKeyword(text, forms);
}

export type AnswerError = "WRONG_PHASE" | "BAD_MESSAGE";

/**
 * 초안은 정리해 저장하고, 첫 확정만 제출 순서에 남긴다.
 * 제시어를 받은 사람과 서버 봇은 확정할 때 제시어를 검사한다.
 * 제시어를 모르는 사람의 확정은 본문과 관계없이 같은 경로로 접수한다.
 */
export function submitAnswer(
  state: RoomState,
  actorId: string,
  text: string,
  final: boolean,
  source: "player" | "bot" = "player",
): { ok: true; state: RoomState } | { ok: false; error: AnswerError } {
  if (state.phase !== "keyword") return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  const automatic = source === "bot";
  if (actor === undefined || !isAlive(actor) || isBot(actor) !== automatic || (automatic && !final)) return { ok: false, error: "BAD_MESSAGE" };
  if ((state.answerSubmits ?? []).some((s) => s.seat === actor.seat)) return { ok: true, state };
  const blank = text.trim().length === 0;
  let clean = "";
  if (!blank) {
    const cleaned = sanitizeChatText(text);
    if (!cleaned.ok) return { ok: false, error: "BAD_MESSAGE" };
    // 코드 단위가 상한 이하면 자소도 상한 이하다. 그 위에서만 센다(will.ts readBody 와 같은 지름길).
    if (cleaned.text.length > ANSWER_MAX_GRAPHEMES && countGraphemes(cleaned.text) > ANSWER_MAX_GRAPHEMES) return { ok: false, error: "BAD_MESSAGE" };
    clean = cleaned.text;
  }
  if (!final) {
    if (blank) {
      if (actor.answerDraft === undefined) return { ok: true, state };
      return {
        ok: true,
        state: {
          ...state,
          players: state.players.map((p): Player => {
            if (p.id !== actorId) return p;
            const { answerDraft: _d, ...kept } = p;
            return kept;
          }),
        },
      };
    }
    if (actor.answerDraft === clean) return { ok: true, state };
    return { ok: true, state: { ...state, players: state.players.map((p) => (p.id === actorId ? { ...p, answerDraft: clean } : p)) } };
  }
  if (blank) return { ok: false, error: "BAD_MESSAGE" };
  const knowsKeyword = actor.role !== undefined && actor.role !== "mafia";
  if ((automatic || knowsKeyword) && keywordAnswerBlocked(state, clean)) {
    return { ok: false, error: "BAD_MESSAGE" };
  }
  return {
    ok: true,
    state: {
      ...state,
      answerSubmits: [...(state.answerSubmits ?? []), { seat: actor.seat, text: clean }],
      players: state.players.map((p): Player => {
        if (p.id !== actorId) return p;
        const { answerDraft: _d, ...kept } = p;
        return kept;
      }),
    },
  };
}

/** 공개할 답안을 검증한 뒤 첫 유효한 확정 제출자부터 실제 의자 순으로 돌아간다. */
export function closeKeyword(state: RoomState): DeadlineResult {
  const forms = formsOf(state);
  const publishable = (text: string): string | null => forms !== undefined && violatesKeyword(text, forms) ? null : text;
  const participants = state.players.filter((p) => p.sat !== true);
  const alive = participants.filter(isAlive);
  const fallbackChairs = barChairAssignment(participants.map((p) => p.seat));
  const angleOf = (seat: number): number =>
    BAR_CHAIR_CLOCKWISE_ANGLES[state.barChairs?.[seat] ?? fallbackChairs[seat] ?? seat] ?? Number.POSITIVE_INFINITY;
  const aroundTable = alive.sort((a, b) => angleOf(a.seat) - angleOf(b.seat) || a.seat - b.seat);
  const aliveSeats = new Set(aroundTable.map((p) => p.seat));
  const submissions = (state.answerSubmits ?? [])
    .filter(({ seat }) => aliveSeats.has(seat))
    .map(({ seat, text }) => ({ seat, text: publishable(text) }));
  const first = submissions.find(({ text }) => text !== null)?.seat;
  const start = first === undefined ? 0 : aroundTable.findIndex((p) => p.seat === first);
  const order = [...aroundTable.slice(start), ...aroundTable.slice(0, start)];
  const submittedBySeat = new Map(submissions.map(({ seat, text }) => [seat, text]));
  const answerOf = (p: Player): string | null => {
    const submitted = submittedBySeat.get(p.seat);
    if (submitted !== undefined) return submitted;
    return isBot(p) || p.answerDraft === undefined ? null : publishable(p.answerDraft);
  };
  const { answerSubmits: _submits, keywordPresentationIndex: _prevIndex, ...clean } = state;
  return {
    state: {
      ...clean,
      keywordAnswers: order.map((p, i) => ({ order: i + 1, seat: p.seat, text: answerOf(p) })),
      ...(state.keyword !== undefined && order.length > 0 ? { keywordPresentationIndex: 0 } : {}),
      players: state.players.map(({ answerDraft: _d, ...p }) => p),
    },
    stay: false,
  };
}

/** 발표할 답이 남았을 때만 같은 단계에서 다음 자리로 넘어간다. */
export function stepKeywordPresentation(state: RoomState): DeadlineResult | undefined {
  const presentation = keywordPresentationOf(state);
  if (presentation === undefined || presentation.order >= presentation.total) return undefined;
  return { state: { ...state, keywordPresentationIndex: presentation.order }, stay: true };
}
