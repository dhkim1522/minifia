// 이모티콘만 남은 옛 모듈 — 07-12 가 지운다. 순수 모듈이다: 현재 시각은 인자 now 로만 받고, DOM·workerd API 를 쓰지 않으며, 입력 상태는 바꾸지 않는다.
// 07-11: 빠른 메시지(템플릿·say)는 자유 채팅(shared/game/chatRules.ts·chatLog.ts·audience.ts, DO 의 applyChat)으로 대체돼 없어졌다.
// 이모티콘은 저장하지 않는다(결정 0017-7): 통과하면 이벤트를 돌려주기만 하고 상태에 남는 것은 보낸 사람 lastSendAt(쿨다운)뿐이다.
// 보낸 사람은 입력이 아니라 actorId 로 서버 상태에서 찾는다(T-02-08).
import { EMOJI_IDS } from "../protocol";
import type { EmojiId, PhaseId } from "../protocol";
import { isAlive } from "./alive";
import type { Player, RoomState } from "./room";

/** 서버가 받는 이모티콘 최소 전송 간격(D-14, G-02-2). 같은 사람의 마지막 전송(lastSendAt)을 기준으로 한다. */
export const SERVER_MIN_SEND_GAP_MS = 1_800;

export type ChatError = "WRONG_PHASE" | "BAD_MESSAGE" | "RATE_LIMITED";

/**
 * 거부 규칙 하나(3페이즈 확정, 결정 0016 결과·0019): 틀린 단계 → WRONG_PHASE(누구든, 탈락자도), 맞는 단계의
 * 방에 없거나 탈락한 보낸 사람 → BAD_MESSAGE, 밤의 살아 있는 비마피아 → WRONG_PHASE(그 단계에 보낼 수 없는 사람이라는 뜻일 뿐 역할 정보를 주지 않는다).
 * discussion·execVote·candidateVote·defense 는 방에 있는 생존자 누구나, night 는 살아 있는 마피아만(결정 0019-1).
 * 공개 구간(candidateVoteReveal)·처형(execution)·종료(ended)는 누구의 이모티콘도 WRONG_PHASE 다(A3).
 */
const EMOTE_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>(["discussion", "execVote", "candidateVote", "defense", "night"]);

function senderOf(state: RoomState, actorId: string, allowed: ReadonlySet<PhaseId>): ChatError | Player {
  if (!allowed.has(state.phase)) return "WRONG_PHASE";
  const sender = state.players.find((p) => p.id === actorId);
  if (!sender || !isAlive(sender)) return "BAD_MESSAGE";
  if (state.phase === "night" && sender.role !== "mafia") return "WRONG_PHASE";
  return sender;
}

const coolingDown = (sender: Player, now: number): boolean => now - (sender.lastSendAt ?? -Infinity) < SERVER_MIN_SEND_GAP_MS;

/**
 * 이모티콘(COMM-02). 앞부분(단계 → 보낸 사람 존재·생존·밤은 마피아)은 senderOf 가 판정하고, 쿨다운은 보낸 사람의 lastSendAt 을 본다(D-14). 자유 채팅과 쿨다운을 나눠 쓰지 않는다(07-11: 채팅은 chatRules 의 D5 제한).
 * 통과하면 보낸 사람 lastSendAt 만 바뀐 새 상태와 {seat, icon, at} 이벤트를 돌려준다.
 * 이모티콘도 메시지처럼 저장하지 않는다 — 재접속 복원이 없다(UI-SPEC S-08b, 결정 0017-7). 쿨다운은 플레이어 단위 영속 필드라 재접속으로 풀리지 않는다.
 */
export function emote(
  state: RoomState,
  actorId: string,
  icon: EmojiId,
  now: number,
): { ok: true; state: RoomState; event: { seat: number; icon: EmojiId; at: number } } | { ok: false; error: ChatError } {
  const sender = senderOf(state, actorId, EMOTE_PHASES);
  if (typeof sender === "string") return { ok: false, error: sender };
  if (!(EMOJI_IDS as readonly string[]).includes(icon)) return { ok: false, error: "BAD_MESSAGE" };
  if (coolingDown(sender, now)) return { ok: false, error: "RATE_LIMITED" };
  return {
    ok: true,
    event: { seat: sender.seat, icon, at: now },
    state: { ...state, players: state.players.map((p) => (p.id === sender.id ? { ...p, lastSendAt: now } : p)) },
  };
}
