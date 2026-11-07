// 이동 권한 표(MAP-04, 결정 0060-6, A4). 순수 모듈이다 — 시각·난수를 읽지 않고 입력을 바꾸지 않으며, DOM·workerd API 가 없다(앱·워커 공용).
// 밤에는 산 사람 누구도 움직이지 않는다(15페이즈 D-05 — 마피아의 밤 접근 걷기가 없어졌다).
// 서버(worker/room.ts applyMove)가 막는 권위이고, 화면은 같은 표로 입력 면(맵 탭 링)만 비활성한다 — 거절은 조용히 버리고 오류 프레임이 없다.
// 채팅은 CHAT_PHASES/channelOf 가 따로 정하므로 이동 차단과 무관하다(지목·찬반 중에도 채팅은 된다).
import type { PhaseId } from "../protocol";
import { isAlive } from "./alive";
import type { Player, RoomState } from "./room";

/**
 * 지도 위에서 보이는 단계 8개. 오디언스(위치 프레임 받는 사람)와 이동 권한이 이 한 곳으로 지도 단계를 판정한다.
 * 옛 투표 단계(execVote 등)는 08-22 에 PhaseId 에서 지웠다 — 저장 방은 정규화가 discussion 으로 옮긴다.
 */
export const MAP_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>([
  "dayAnnounce",
  "errand",
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
 * 표의 본체(단계 × 생존). 로비는 모두 움직인다. 지도 단계에서 유령은 언제나 자유(A4)이고 산 사람은 낮 시작·심부름·토론에서만 움직인다.
 * 밤에는 산 사람 누구도 움직이지 않는다(D-05, 역할 무관) — 모두 어둠 속에 서 있다.
 * 화면이 view 의 단계와 내 alive 로 같은 표를 쓰게 따로 내보낸다 — 권위는 서버다.
 */
export function canMoveIn(phase: PhaseId, alive: boolean): boolean {
  if (phase === "lobby") return true;
  if (!MAP_PHASES.has(phase)) return false; // assigning·roleReveal·ended 와 옛 투표 단계
  if (!alive) return true; // 유령은 모든 지도 단계에서 자유(A4)
  return phase === "dayAnnounce" || phase === "errand" || phase === "discussion";
}

/** 이 사람이 지금 이동 요청을 낼 수 있는지(서버가 받을지). 방에 있는지는 보지 않는다 — 단계와 생존만 본다. */
export function canMove(state: RoomState, p: Player): boolean {
  return canMoveIn(state.phase, isAlive(p));
}
