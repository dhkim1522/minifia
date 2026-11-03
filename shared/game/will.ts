// 유언·쪽지 규칙(09-12, WILL-01·NIGHT-12, 결정 0061-9·10). 순수 모듈이다 — 현재 시각·난수를 읽지 않고, 입력 상태는 바꾸지 않는다.
// 같은 값을 다시 저장하면 입력 객체를 그대로 돌려준다(호출부가 `next === state` 로 저장·전송 여부를 판단한다).
// 간격(WILL_MIN_GAP_MS)은 시각이 필요해 방 DO 가 인메모리로 재고, 이 파일은 상수만 내보낸다.
// 읽는 것은 본문 정리(sanitizeChatText)뿐이고 본문은 어떤 view 에도 이 파일이 직접 싣지 않는다 — 받는 사람 한정은 view.ts·방 DO 몫이다(L7).
import { isAlive } from "./alive";
import { sanitizeChatText } from "./chatRules";
import { MAP_PHASES } from "./movement";
import type { Player, RoomState } from "./room";

/** 사람마다 유언·쪽지 저장 최소 간격(ms, 가정 A1·연구 A5). 안의 요청은 방 DO 가 오류 없이 버린다 — 서버 한 곳. */
export const WILL_MIN_GAP_MS = 500;

export type WillError = "WRONG_PHASE" | "BAD_MESSAGE";

/** 본문 판정: 공백뿐이면 지움(erase), 아니면 정리한 글, 정리 실패(보이는 글자 없음·100 자소 초과)면 null. */
function readBody(raw: string): { erase: true } | { erase: false; text: string } | null {
  if (raw.trim().length === 0) return { erase: true };
  const clean = sanitizeChatText(raw);
  return clean.ok ? { erase: false, text: clean.text } : null;
}

/**
 * 유언 저장(WILL-01). 검사 순서가 계약이다: 단계(지도 단계 dayAnnounce~morning 이 아니면 WRONG_PHASE) → 행위자(방에 있고 산 사람, 아니면 BAD_MESSAGE)
 * → 본문(공백뿐이면 지움, 아니면 sanitizeChatText, 실패면 BAD_MESSAGE) → 같은 값이면 입력 객체 그대로 → 그 사람의 will 만 바뀐 새 상태(지움은 키째 삭제).
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
  const body = readBody(text);
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
