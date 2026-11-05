// 로비 의상 규칙(결정 D-6, 10-02). 의상은 꾸미기 값이고 실제 역할의 함수가 아니다 — 이 모듈은 Player.role 을 읽지 않는다(L25, 결정 0015).
// 서버가 정하는 것은 단계·행위자·값의 형식뿐이다. 마피아 의상을 시민이 입어도 거절하지 않고 참·거짓을 판정하지 않는다.
// 순수 모듈이다 — 시각·난수를 읽지 않고 입력 상태를 바꾸지 않는다.
import { OUTFIT_IDS } from "../protocol";
import type { OutfitId } from "../protocol";
import type { VoteError } from "./discussion";
import type { RoomState } from "./room";

/** 고르지 않은 사람의 의상(역할에 따른 기본값·무작위 기본값은 없다). */
export const DEFAULT_LOOK: OutfitId = "coat";

/** 같은 사람의 의상 요청 최소 간격(ms, O-8). 안의 요청은 방 DO 가 오류 없이 버리고 보낸 소켓에 자기 state 만 보낸다. */
export const LOOK_MIN_GAP_MS = 250;

/**
 * 의상 고르기. 검사 순서가 계약이다: 단계(lobby 가 아니면 WRONG_PHASE) → 행위자(방에 있음, 아니면 BAD_MESSAGE)
 * → 값(OUTFIT_IDS 안, 아니면 BAD_MESSAGE) → 같은 값(저장값 ?? 기본 coat 와 같으면 입력 상태 그대로 ok) → 그 사람의 look 만 바뀐 새 상태.
 */
export function setLook(
  state: RoomState,
  actorId: string,
  look: OutfitId,
): { ok: true; state: RoomState } | { ok: false; error: VoteError } {
  if (state.phase !== "lobby") return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor) return { ok: false, error: "BAD_MESSAGE" };
  if (!(OUTFIT_IDS as readonly string[]).includes(look)) return { ok: false, error: "BAD_MESSAGE" };
  if ((actor.look ?? DEFAULT_LOOK) === look) return { ok: true, state };
  return { ok: true, state: { ...state, players: state.players.map((p) => (p.id === actorId ? { ...p, look } : p)) } };
}
