// 유언·쪽지 규칙(09-12, WILL-01·NIGHT-12, 결정 0061-9·10). 순수 모듈이다 — 현재 시각·난수를 읽지 않고, 입력 상태는 바꾸지 않는다.
// 같은 값을 다시 저장하면 입력 객체를 그대로 돌려준다(호출부가 `next === state` 로 저장·전송 여부를 판단한다).
// 간격(WILL_MIN_GAP_MS)은 시각이 필요해 방 DO 가 인메모리로 재고, 이 파일은 상수만 내보낸다.
// 읽는 것은 본문 정리(sanitizeChatText)뿐이고 본문은 어떤 view 에도 이 파일이 직접 싣지 않는다 — 받는 사람 한정은 view.ts·방 DO 몫이다(L7).
import { isAlive } from "./alive";
import { CHAT_MAX_GRAPHEMES, sanitizeChatText } from "./chatRules";
import { countGraphemes } from "../nickname";
import { MAP_PHASES } from "./movement";
import { confirmedTarget } from "./night";
import type { Player, RoomState } from "./room";

/** 사람마다 유언·쪽지 저장 최소 간격(ms, 가정 A1·연구 A5). 안의 요청은 방 DO 가 오류 없이 버린다 — 서버 한 곳. */
export const WILL_MIN_GAP_MS = 500;

/**
 * 유언 상한(자소, 사용자 결정 2026-11-05 — 결정 0061-10 개정). 채팅·쪽지는 CHAT_MAX_GRAPHEMES(100) 그대로다.
 * 서버(saveWill)와 시트(WillSheet 기본 max·카운터)가 이 한 값을 쓴다. 넘는 글은 채팅 100 초과처럼 자르지 않고 거절한다(BAD_MESSAGE).
 * 옛 상한(100)으로 이미 저장된 긴 유언은 정규화가 건드리지 않는다 — 쓴 사람의 글을 몰래 자르지 않고, 편지 3단 맞춤은 100자까지 견딘다.
 */
export const WILL_MAX_GRAPHEMES = 50;

export type WillError = "WRONG_PHASE" | "BAD_MESSAGE";

/** 본문 판정: 공백뿐이면 지움(erase), 아니면 정리한 글, 정리 실패(보이는 글자 없음·max 자소 초과)면 null. 정리는 채팅과 같은 sanitizeChatText 다. */
function readBody(raw: string, max: number): { erase: true } | { erase: false; text: string } | null {
  if (raw.trim().length === 0) return { erase: true };
  const clean = sanitizeChatText(raw);
  if (!clean.ok) return null;
  // 코드 단위가 max 이하면 자소는 max 이하다. 그 위에서만 센다(sanitizeChatText 와 같은 지름길).
  if (clean.text.length > max && countGraphemes(clean.text) > max) return null;
  return { erase: false, text: clean.text };
}

/**
 * 유언 저장(WILL-01). 검사 순서가 계약이다: 단계(지도 단계 dayAnnounce~morning 이 아니면 WRONG_PHASE) → 행위자(방에 있고 산 사람, 아니면 BAD_MESSAGE)
 * → 본문(공백뿐이면 지움, 아니면 sanitizeChatText 뒤 WILL_MAX_GRAPHEMES(50) 자소, 실패면 BAD_MESSAGE) → 같은 값이면 입력 객체 그대로 → 그 사람의 will 만 바뀐 새 상태(지움은 키째 삭제).
 * 죽은 사람은 고칠 수 없다(E7 #36). 로비·역할 확인·종료는 받지 않는다.
 */
export function saveWill(
  state: RoomState,
  actorId: string,
  text: string,
): { ok: true; state: RoomState } | { ok: false; error: WillError } {
  if (!MAP_PHASES.has(state.phase)) return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor)) return { ok: false, error: "BAD_MESSAGE" };
  const body = readBody(text, WILL_MAX_GRAPHEMES);
  if (body === null) return { ok: false, error: "BAD_MESSAGE" };
  if (body.erase) {
    if (actor.will === undefined) return { ok: true, state };
    const next = state.players.map((p): Player => {
      if (p.id !== actorId) return p;
      const { will: _will, ...kept } = p;
      return kept;
    });
    return { ok: true, state: { ...state, players: next } };
  }
  if (actor.will === body.text) return { ok: true, state };
  return {
    ok: true,
    state: { ...state, players: state.players.map((p) => (p.id === actorId ? { ...p, will: body.text } : p)) },
  };
}

/**
 * 쪽지 저장(NIGHT-12, 결정 0061-9). 검사 순서가 계약이다: 단계(night 아니면 WRONG_PHASE) → 행위자(산 마피아, 아니면 BAD_MESSAGE)
 * → 확정 대상(confirmedTarget)이 없으면 BAD_MESSAGE → 본문(공백뿐이면 지움, 아니면 sanitizeChatText 의 채팅 100 자소, 실패면 BAD_MESSAGE) → 같은 값이면 입력 그대로 → nightNote 만 바뀐 새 상태.
 * 작성자를 저장하지 않는다 — 마지막 저장이 이기고 누가 썼는지는 상태 어디에도 없다. 지움도 확정일 때만 받는다(가정 A2: 확정이 풀리면 글은 임시로 남고 아침 판정이 버린다).
 */
export function saveNote(
  state: RoomState,
  actorId: string,
  text: string,
): { ok: true; state: RoomState } | { ok: false; error: WillError } {
  if (state.phase !== "night") return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor) || actor.role !== "mafia") return { ok: false, error: "BAD_MESSAGE" };
  if (confirmedTarget(state) === undefined) return { ok: false, error: "BAD_MESSAGE" };
  const body = readBody(text, CHAT_MAX_GRAPHEMES);
  if (body === null) return { ok: false, error: "BAD_MESSAGE" };
  if (body.erase) {
    if (state.nightNote === undefined) return { ok: true, state };
    const { nightNote: _nightNote, ...rest } = state;
    return { ok: true, state: rest };
  }
  if (state.nightNote === body.text) return { ok: true, state };
  return { ok: true, state: { ...state, nightNote: body.text } };
}

/**
 * 쪽지 저장 뒤 state 를 받는 사람 — 산 마피아뿐이다(seat 오름차순). 유령(관전자)에게는 보내지 않는다: 쪽지는 아침에 카드로 공개될 때까지
 * 마피아끼리의 것이고, 보내면 '쓰는 중' 타이밍이 샌다(L7 "본인과 산 마피아끼리의 쪽지 제외"). pickRecipientIds 와 달리 spectators 를 더하지 않는다.
 */
export function noteRecipientIds(state: RoomState): string[] {
  return state.players
    .filter((p) => p.role === "mafia" && isAlive(p))
    .sort((a, b) => a.seat - b.seat)
    .map((p) => p.id);
}
