// 서버 전용(23-01): 첫날 키워드 단계의 진행 훅. 클라이언트가 import 하는 shared/game/phases.ts 는 이 모듈을 import 하지 않는다(Pitfall 8).
// 23-05·23-06 이 같은 파일에 답 접수·공개·키워드 마감 훅을 더한다.
import { countGraphemes } from "../nickname";
import { isAlive } from "./alive";
import { ANSWER_MAX_GRAPHEMES } from "./answerRules";
import { isBot } from "./bots";
import { sanitizeChatText } from "./chatRules";
import { violatesKeyword } from "./keywordGuard";
import type { KeywordForms } from "./keywordGuard";
import { keywordEntryOf } from "./keywords";
import type { Player, RoomState } from "./room";
import type { DeadlineResult } from "./tick";

/**
 * 역할 확인 마감 훅(D-01·D-29). 키워드가 있으면 표의 기본 다음 단계(keyword)로 가고,
 * 없으면(옛 저장 방·스위치를 끈 시험) 곧장 낮 시작 발표로 간다 — 기능 전체가 keyword 키 하나로 켜지고 꺼진다.
 */
export function routeAfterRoleReveal(state: RoomState): DeadlineResult {
  return state.keyword === undefined ? { state, stay: false, next: "dayAnnounce" } : { state, stay: false };
}

/** 정답은 첫날 라이어 게임의 정답 공개 장면에서만 모두에게 보낸다. */
export function answerOpenOf(state: RoomState): boolean {
  return state.keyword !== undefined && (state.day ?? 1) === 1 && state.phase === "answerReveal";
}

/**
 * 금지어 판정에 쓸 형태(RESEARCH P4). 목록에 그 항목이 있으면 단어+별칭, 목록이 바뀌어 없으면 단어만.
 * keyword 가 없으면 undefined(옛 방 — 검사할 것이 없다).
 */
function formsOf(state: RoomState): KeywordForms | undefined {
  if (state.keyword === undefined) return undefined;
  return keywordEntryOf(state.keyword.genre, state.keyword.word) ?? { word: state.keyword.word, aliases: [] };
}

export type AnswerError = "WRONG_PHASE" | "BAD_MESSAGE";

/**
 * 키워드 답 제출(D-07·D-09, SC2). 검사 순서가 계약이다:
 * 1 단계(keyword 아니면 WRONG_PHASE) → 2 행위자(방에 있고 산 사람이며 봇이 아님, 아니면 BAD_MESSAGE) → 3 이미 확정했으면 같은 객체(조용히 무변화)
 * → 4 본문 정리(sanitizeChatText 뒤 20자소 이하, 실패면 BAD_MESSAGE) → 5 초안(final:false)은 저장(공백뿐이면 키째 삭제, 같은 값이면 같은 객체, 금지어 검사 없음)
 * → 6 확정(final:true)인데 빈 글이면 BAD_MESSAGE → 7 확정에 금지어가 있으면 BAD_MESSAGE
 * → 8 통과: answerSubmits 끝에 { seat, text } 를 더하고(낸 순서가 곧 배열 순서) 그 사람의 초안을 지운다.
 * 7 의 거절은 시민과 마피아가 똑같은 반환(ok:false, BAD_MESSAGE)이다 — 다른 점은 보낸 사람이 마피아이고 keywordProbed 가 아직 없을 때만 state 에 { keywordProbed: true } 를 싣는 것뿐이고,
 * 방 DO 는 그 state 를 저장한 뒤 시민의 거절과 같은 두 프레임(오류 + 본인 state)을 보낸다. 응답에서는 저장 여부를 알 수 없다(T-23-18).
 */
export function submitAnswer(
  state: RoomState,
  actorId: string,
  text: string,
  final: boolean,
): { ok: true; state: RoomState } | { ok: false; error: AnswerError; state?: RoomState } {
  if (state.phase !== "keyword") return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  if (actor === undefined || !isAlive(actor) || isBot(actor)) return { ok: false, error: "BAD_MESSAGE" };
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
  const forms = formsOf(state);
  if (forms !== undefined && violatesKeyword(clean, forms)) {
    if (actor.role === "mafia" && state.keywordProbed !== true) return { ok: false, error: "BAD_MESSAGE", state: { ...state, keywordProbed: true } };
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

/**
 * keyword 마감 훅(D-03·D-07·D-24). 공개 목록 keywordAnswers 를 확정한다:
 * ① 확정 제출을 낸 순서 → ② 마감에 쓰던 글(초안, 금지어 없음)로 나간 산 사람(좌석 순) → ③ 답 없음(text:null, 좌석 순, 봇은 늘 여기).
 * 서버 전용 answerSubmits 와 모든 answerDraft 는 키째 지우고, 죽은 사람은 목록에 없다. 단계는 표의 기본 다음(dayAnnounce)으로 간다.
 */
export function closeKeyword(state: RoomState): DeadlineResult {
  const forms = formsOf(state);
  const submitted = state.answerSubmits ?? [];
  const done = new Set(submitted.map((s) => s.seat));
  const rest = state.players.filter((p) => isAlive(p) && !done.has(p.seat)).sort((a, b) => a.seat - b.seat);
  const draftOf = (p: Player): string | undefined => {
    if (isBot(p) || p.answerDraft === undefined) return undefined;
    return forms !== undefined && violatesKeyword(p.answerDraft, forms) ? undefined : p.answerDraft;
  };
  const drafted = rest.flatMap((p) => {
    const text = draftOf(p);
    return text === undefined ? [] : [{ seat: p.seat, text }];
  });
  const draftedSeats = new Set(drafted.map((r) => r.seat));
  const rows: Array<{ seat: number; text: string | null }> = [
    ...submitted.map((s) => ({ seat: s.seat, text: s.text })),
    ...drafted,
    ...rest.filter((p) => !draftedSeats.has(p.seat)).map((p) => ({ seat: p.seat, text: null })),
  ];
  const { answerSubmits: _submits, ...clean } = state;
  return {
    state: {
      ...clean,
      keywordAnswers: rows.map((r, i) => ({ order: i + 1, ...r })),
      players: state.players.map(({ answerDraft: _d, ...p }) => p),
    },
    stay: false,
  };
}
