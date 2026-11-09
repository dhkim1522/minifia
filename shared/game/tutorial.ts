// 튜토리얼 함께 진행 규칙(17페이즈, 결정 0078·0080-10·11). 순수 모듈 — 입력 상태를 바꾸지 않고, 시각·난수·DOM 을 쓰지 않는다.
// 방장이 켜고 시작하면 방이 tutorial 단계로 가고, 앉은 사람(봇 제외) 모두가 끝났음을 보내거나 연결이 끊기면 서버가 다음 단계(assigning)로 넘긴다.
// 누가 끝냈는지(RoomState.tutorialPassed)는 서버 전용이다 — 공개되는 것은 done·total 두 숫자와 본인 값뿐이다.
import type { RoomState } from "./room";
import { isBot } from "./bots";

/** 앉은 사람(봇 제외) 수와 그중 끝났음을 보냈거나 연결이 끊긴 수. 끊긴 사람은 기다리지 않는다(결정 0080-10). */
export function tutorialProgress(state: RoomState): { done: number; total: number } {
  const humans = state.players.filter((p) => !isBot(p));
  const passed = new Set(state.tutorialPassed ?? []);
  return { total: humans.length, done: humans.filter((p) => passed.has(p.id) || !p.connected).length };
}

/**
 * 끝났음 표시. 검사 순서가 계약이다: 단계(tutorial 아니면 WRONG_PHASE) → 방 안 사람(아니면 BAD_MESSAGE)
 * → 이미 표시됐으면 같은 객체(저장·전송 없음) → tutorialPassed 에 한 줄 더한 새 상태.
 */
export function markTutorialDone(
  state: RoomState,
  actorId: string,
): { ok: true; state: RoomState } | { ok: false; error: "WRONG_PHASE" | "BAD_MESSAGE" } {
  if (state.phase !== "tutorial") return { ok: false, error: "WRONG_PHASE" };
  if (!state.players.some((p) => p.id === actorId)) return { ok: false, error: "BAD_MESSAGE" };
  const passed = state.tutorialPassed ?? [];
  if (passed.includes(actorId)) return { ok: true, state };
  return { ok: true, state: { ...state, tutorialPassed: [...passed, actorId] } };
}

/** 전원 완료인가 — 연결된 사람이 0명이어도 참이다(기다릴 이유가 없다). */
export function allTutorialDone(state: RoomState): boolean {
  const { done, total } = tutorialProgress(state);
  return done >= total;
}

/** tutorial 을 떠날 때 서버 전용 tutorialPassed 를 키째 지운다. 키가 없으면 같은 객체. */
export function clearTutorial(state: RoomState): RoomState {
  if (state.tutorialPassed === undefined) return state;
  const { tutorialPassed: _passed, ...kept } = state;
  return kept;
}
