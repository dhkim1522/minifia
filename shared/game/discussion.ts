// 단계 길이 파생 한 곳. 방장 연장·넘기기는 결정 0017-5 로 없앴다 — 3·4페이즈가 길이를 바꿀 일이 생기면 여기서 파생한다.
// 순수 모듈이다 — 입력 상태는 바꾸지 않는다.
import { PHASE_DEFS } from "./phases";
import type { RoomState } from "./room";

/** 지금 단계의 전체 길이(ms). 단계 표 길이 그대로이고, 길이가 없는 단계는 null. buildView 가 이 함수로 phaseDurationMs 를 만든다. */
export function phaseDurationOf(state: RoomState): number | null {
  return PHASE_DEFS[state.phase].durationMs;
}
