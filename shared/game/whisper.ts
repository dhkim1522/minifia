// 귓속말 규칙(결정 0066-2, 09.1.1-02). 낮 토론에서 산 사람이 산 다른 사람 한 명에게 하루 1번 30자소 이하 한 줄을 보낸다.
// 순수 모듈이다 — 시각은 인자로만 받고 입력 상태를 바꾸지 않는다. 본문 보관(RoomState.whispers)만 쓰고 어떤 view 에도 싣지 않는다(O-20).
// 누구에게 가는지(당사자 둘 = 본문, 나머지 = 사실 줄)는 방 DO 가 audience·마스크로 정한다 — 이 모듈은 받는 사람을 모른다.
import { countGraphemes } from "../nickname";
import type { PhaseId } from "../protocol";
import { isAlive } from "./alive";
import { sanitizeChatText } from "./chatRules";
import type { VoteError } from "./discussion";
import type { RoomState, WhisperRecord } from "./room";

/** 귓속말 본문 상한(자소). 정리(sanitizeChatText) 뒤 값에 적용한다. */
export const WHISPER_MAX_GRAPHEMES = 30;
/** 낮마다(일차별) 한 사람이 보낼 수 있는 귓속말 수. */
export const WHISPER_PER_DAY = 1;
/** 귓속말을 보낼 수 있는 단계(O-3): 낮 토론뿐. */
export const WHISPER_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>(["discussion"]);

/** 이번 일차에 그 좌석이 이미 보낸 귓속말 수. */
export function whisperUsedToday(state: RoomState, seat: number): number {
  const day = state.day ?? 1;
  return (state.whispers ?? []).filter((w) => w.from === seat && w.n === day).length;
}

/**
 * 귓속말 보내기. 검사 순서가 계약이다: 단계(WHISPER_PHASES 밖이면 WRONG_PHASE) → 행위자(방에 있고 산 사람) → 대상(정수·방에 앉은 산 사람·자기 자신 아님)
 * → 오늘 횟수(WHISPER_PER_DAY 미만) → 본문(sanitizeChatText 통과·30자소 이하). 단계 어긋남 말고는 모두 같은 BAD_MESSAGE 다 — 거절 사유로 상대·역할이 드러나지 않는다(오라클 금지).
 * 연결이 끊긴 대상에게도 보낼 수 있다(O-5): 돌아오면 채팅 복원으로 받는다. 입력 상태는 바꾸지 않는다.
 */
export function sendWhisper(
  state: RoomState,
  actorId: string,
  toSeat: number,
  rawText: string,
  now: number,
): { ok: true; state: RoomState; record: WhisperRecord } | { ok: false; error: VoteError } {
  if (!WHISPER_PHASES.has(state.phase)) return { ok: false, error: "WRONG_PHASE" };
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !isAlive(actor)) return { ok: false, error: "BAD_MESSAGE" };
  if (!Number.isInteger(toSeat)) return { ok: false, error: "BAD_MESSAGE" };
  const target = state.players.find((p) => p.seat === toSeat);
  if (!target || !isAlive(target) || target.id === actor.id) return { ok: false, error: "BAD_MESSAGE" };
  if (whisperUsedToday(state, actor.seat) >= WHISPER_PER_DAY) return { ok: false, error: "BAD_MESSAGE" };
  const clean = sanitizeChatText(rawText);
  if (!clean.ok || countGraphemes(clean.text) > WHISPER_MAX_GRAPHEMES) return { ok: false, error: "BAD_MESSAGE" };
  const record: WhisperRecord = { n: state.day ?? 1, from: actor.seat, to: target.seat, text: clean.text, at: now };
  return { ok: true, state: { ...state, whispers: [...(state.whispers ?? []), record] }, record };
}
