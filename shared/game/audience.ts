// 채팅·입력 중·동작·로비 위치의 받는 사람을 정하는 함수 하나(ROADMAP 계획 메모, 결정 0002·0021·0058).
// 서버(worker/room.ts)와 화면이 같은 규칙을 쓴다. 화면에서 거르는 방식으로 대신하지 않는다 — 받을 권리가 없는 폰에는 네트워크로도 가지 않는다.
// 순수 모듈이다: 시각·난수를 읽지 않고 입력을 바꾸지 않으며, DOM·workerd API 가 없다(앱·워커 두 tsconfig 에 모두 들어간다).
// 채널은 클라이언트 입력에서 받지 않는다 — channelOf 의 입력은 서버 상태와 보낸 사람 id 뿐이다.
import type { ChatChannel, PhaseId } from "../protocol";
import { isAlive } from "./alive";
import type { Player, RoomState } from "./room";

/** 이벤트 종류와 채널. world 는 로비 위치 프레임(채널이 없다). */
export type AudienceEvent = { k: "chat" | "typing" | "emote"; ch: ChatChannel } | { k: "world" };

/**
 * 서버가 채팅을 받는 단계. 화면이 없는 낮 단계도 받는다(UI-SPEC D1, 결정 0044-23) — 8·9페이즈는 화면만 붙이면 된다.
 * assigning·roleReveal 은 패널이 없고 ended 는 11페이즈 결과 화면이다. 옛 claim 은 07-08 이 PhaseId 에서 지울 때까지 여기에 들지 않는다.
 */
export const CHAT_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>([
  "lobby",
  "dayAnnounce",
  "discussion",
  "execVote",
  "candidateVote",
  "candidateVoteReveal",
  "defense",
  "execution",
  "night",
  "morning",
]);

/** 단계 한 번(instance)을 가리키는 키 '일차:단계'. 서버 상태와 클라이언트 view(day.n)가 같은 함수로 만든다. */
export function phaseKey(s: { phase: PhaseId; day?: number }): string {
  return `${s.day ?? 0}:${s.phase}`;
}

/**
 * 보낸 사람의 서버 상태로 정한 채널. 말할 수 없으면 null(호출부는 폐기하고, 더 넓은 채널로 돌리지 않는다).
 * 보낸 사람 상태는 한 단계 안에서 바뀌지 않는다 — 탈락은 처형·아침 진입 훅에서만 일어난다.
 */
export function channelOf(state: RoomState, senderId: string): ChatChannel | null {
  if (!CHAT_PHASES.has(state.phase)) return null;
  const me = state.players.find((p) => p.id === senderId);
  if (me === undefined) return null;
  if (!isAlive(me)) return "ghost";
  if (state.phase === "night") return me.role === "mafia" ? "mafia" : null;
  return "all";
}

/**
 * 받는 사람 player id 집합. 방어 장치(호출부 버그에도 안전하도록 이 함수가 막는다):
 * CHAT_PHASES 밖이면 빈 집합, mafia 인데 night 가 아니면 빈 집합, ghost 는 탈락자만.
 * world 는 로비일 때 방의 모든 사람, 그 밖은 빈 집합(6페이즈 emitWorld 와 같다).
 */
export function audience(state: RoomState, ev: AudienceEvent): ReadonlySet<string> {
  const pick = (pred: (p: Player) => boolean): Set<string> => new Set(state.players.filter(pred).map((p) => p.id));
  if (ev.k === "world") return state.phase === "lobby" ? pick(() => true) : new Set();
  if (!CHAT_PHASES.has(state.phase)) return new Set();
  switch (ev.ch) {
    case "all":
      return pick(() => true);
    case "mafia":
      // 밤의 마피아 채팅은 산 마피아와 탈락자 관전만 받는다(결정 0019·0021). 탈락한 마피아는 관전자로 든다(보낼 수는 없다).
      return state.phase === "night" ? pick((p) => !isAlive(p) || p.role === "mafia") : new Set();
    case "ghost":
      return pick((p) => !isAlive(p));
  }
}
