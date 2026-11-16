// 판결 순간 시간표(UI-SPEC C-1, 22-12 P22-13·P22-14, D-27). 처형 단계 진입 시각 T 를 0 으로 본 경과 ms → 그 순간의 연출 상태.
// 순수: 시각·난수·DOM 을 읽지 않는다. 시계는 부르는 쪽(GameMap)이 서버 시각으로 재서 elapsedMs 를 준다.
// 모든 값은 공개 정보(처형자 존재·처형 진입 시각)의 함수라 어느 소켓에서도 같다 — 역할을 읽지 않는다(C-4).
// 찬반 묶음(yes·no·end)은 없다(D-14). 어둡게 막·줌·핀이 [0, PIN_OFF_EXEC_AT) 창이고 줌은 창이 끝나는 6.0초부터 0.6초에 1 로 돌아온다(처형 단계 끝 6.6초).
import { EXECUTION_MS, PIN_OFF_EXEC_AT } from "../../shared/game/phases";
import type { RoomView } from "../../shared/protocol";
import { easeInOut } from "../world/pinPlan";

/** 판결 순간 카메라 줌 배율(O-15). 한 곳에서만 정한다 */
export const VERDICT_ZOOM = 1.1;
/** 줌 1 → VERDICT_ZOOM 이 걸리는 시간 */
export const ZOOM_IN_MS = 600;
/** 창이 끝난 뒤 줌이 1 로 돌아오는 시간(= 처형 꼬리 EXEC_TAIL_MS) */
export const ZOOM_BACK_MS = 600;
/** 어둡게 막(night-950)의 불투명도 */
export const DARKEN_ALPHA = 0.45;

export interface VerdictMoment {
  /** 어둡게 막이 켜져 있다 */
  darken: boolean;
  /** 카메라 배율 1 ~ VERDICT_ZOOM (복귀 중 값 포함) */
  zoom: number;
  /** 처형자에게 핀 조명이 켜져 있다 */
  pin: boolean;
}

/** 처형 단계 시작 시각(서버 시계 ms). 마감 시각이 없으면 null */
export function executionStartOf(view: Pick<RoomView, "phaseEndsAt">): number | null {
  return view.phaseEndsAt === null ? null : view.phaseEndsAt - EXECUTION_MS;
}

/** 처형 진입 후 elapsedMs 의 연출 상태 */
export function momentAt(elapsedMs: number): VerdictMoment {
  const t = Math.max(0, elapsedMs);
  let zoom = VERDICT_ZOOM;
  if (t < ZOOM_IN_MS) zoom = 1 + (VERDICT_ZOOM - 1) * easeInOut(t / ZOOM_IN_MS);
  else if (t >= PIN_OFF_EXEC_AT) zoom = 1 + (VERDICT_ZOOM - 1) * (1 - easeInOut((t - PIN_OFF_EXEC_AT) / ZOOM_BACK_MS));
  return {
    darken: t < PIN_OFF_EXEC_AT,
    zoom,
    pin: t < PIN_OFF_EXEC_AT,
  };
}
