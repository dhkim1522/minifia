// 판 통계 카운터(결정 D-6, O-16): 칭호(END-04)가 쓸 수다·동작 수를 서버가 직접 센다.
// 순수 모듈이다: 시각·난수를 읽지 않고 입력을 바꾸지 않으며, DOM·workerd API 가 없다(앱·워커 두 tsconfig 에 모두 들어간다).
// 올리는 곳은 방 DO 의 applyChat(채널 all 로 받아들여진 줄)·applyEmote(게이트 통과 뒤)뿐이다. 어떤 view·프레임에도 싣지 않는다(L35).
import type { PhaseId } from "../protocol";
import type { RoomState } from "./room";

/** 세는 단계 = 판 중. 로비·역할 배정·역할 확인·결과(ended)는 뺀다 — 결과 단계 채팅은 세지 않는다(O-16). */
export const STAT_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>([
  "dayAnnounce",
  "discussion",
  "nomination",
  "runoff",
  "showdown",
  "defense",
  "verdict",
  "execution",
  "night",
  "morning",
]);

/**
 * 그 사람의 stats[kind] 를 1 올린 새 상태를 돌려준다. 세지 않는 단계이거나 방에 없는 사람이면 입력 그대로(같은 객체)를 돌려준다.
 * stats 가 없던 사람은 { say: 0, emote: 0 } 에서 시작한다.
 */
export function bumpStat(state: RoomState, playerId: string, kind: "say" | "emote"): RoomState {
  if (!STAT_PHASES.has(state.phase)) return state;
  if (!state.players.some((p) => p.id === playerId)) return state;
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.id !== playerId) return p;
      const prev = p.stats ?? { say: 0, emote: 0 };
      return { ...p, stats: { ...prev, [kind]: prev[kind] + 1 } };
    }),
  };
}
