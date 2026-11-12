// 판 종류 고르기(결정 0081-6, 19페이즈 D-05·D-06) — 순수 모듈: 시각·난수를 읽지 않고 입력 상태를 바꾸지 않는다.
// 방장이 대기실·결과 단계에서만 고른다. 판이 진행 중이면 바꿀 수 없고(D-06), 고른 값은 다시 하기·대기실 복귀 뒤에도 남는다.
// 거절은 사유를 구별하지 않는다(L40) — 방장 아님·단계 틀림·허용 밖 값의 응답이 같아야 오라클이 되지 않는다.
import { GAME_MODES } from "../protocol";
import type { GameMode } from "../protocol";
import type { RoomState } from "./room";
import { modeOf } from "./ruleset";

/**
 * 방장의 판 종류 고르기(D-05). 검사 순서는 맵 선택(pickMap)과 같다: 방장 아님 → 단계(lobby·ended 아님) → 허용 밖 값.
 * 같은 값이면 입력 그대로를 돌려준다(저장·전송을 건너뛰는 근거) — mode 없는 방에서 기본값(extended)을 고르는 것도 같은 값이다.
 */
export function pickMode(state: RoomState, actorId: string, mode: GameMode): { ok: true; state: RoomState } | { ok: false } {
  if (actorId !== state.hostId) return { ok: false };
  if (state.phase !== "lobby" && state.phase !== "ended") return { ok: false };
  if (!(GAME_MODES as readonly unknown[]).includes(mode)) return { ok: false };
  if (modeOf(state) === mode) return { ok: true, state };
  return { ok: true, state: { ...state, mode } };
}
