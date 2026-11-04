// 판결 순간 시간표(UI-SPEC C-1, 결정 0066-7). 처형 단계 진입 시각 T 를 0 으로 본 경과 ms → 그 순간의 연출 상태.
// 순수: 시각·난수·DOM 을 읽지 않는다. 시계는 부르는 쪽(GameMap, 09.1.1-13)이 서버 시각으로 재서 elapsedMs 를 준다.
// 모든 값은 공개 정보(처형 단계 진입 시각·통과 여부)의 함수라 어느 소켓에서도 같다 — 역할을 읽지 않는다(C-4).
import { EXECUTION_MS } from "../../shared/game/phases";
import type { RoomView } from "../../shared/protocol";
import { easeInOut } from "../world/pinPlan";

/** 판결 순간 카메라 줌 배율(O-15). 한 곳에서만 정한다 */
export const VERDICT_ZOOM = 1.1;
/** 줌 1 → VERDICT_ZOOM 이 걸리는 시간 = 판결 앞머리 */
export const ZOOM_IN_MS = 600;
/** 묶음이 사라진 뒤 줌이 1 로 돌아오는 시간 */
export const ZOOM_BACK_MS = 600;
/** 찬성 묶음 등장(= 서버 판결 앞머리 VERDICT_LEAD_MS, 줌이 끝나는 때) */
export const BALLOT_YES_AT = 600;
/** 반대 묶음 등장(찬성 묶음 뒤 0.4초) */
export const BALLOT_NO_AT = 1000;
/** 묶음이 사라지고 채팅 카드가 도착하는 시각. 어둡게 막도 이때 걷힌다 */
export const BALLOT_END_AT = 4600;
/** 핀 조명이 꺼지는 시각: 부결은 "처형 없음" 알림이 끝난 때, 처형은 유령이 사라지는 때 */
export const PIN_OFF_NO_EXEC_AT = 4000;
export const PIN_OFF_EXEC_AT = 5000;
/** 어둡게 막(night-950)의 불투명도 */
export const DARKEN_ALPHA = 0.45;

export interface VerdictMoment {
  /** 어둡게 막이 켜져 있다 */
  darken: boolean;
  /** 카메라 배율 1 ~ VERDICT_ZOOM (복귀 중 값 포함) */
  zoom: number;
  /** 찬성 묶음이 보인다 */
  yes: boolean;
  /** 반대 묶음이 보인다 */
  no: boolean;
  /** 변론자에게 핀 조명이 켜져 있다 */
  pin: boolean;
  /** 묶음이 사라졌다(채팅 카드가 대신한다) */
  end: boolean;
}

/** 처형 단계 시작 시각(서버 시계 ms). 마감 시각이 없으면 null */
export function executionStartOf(view: Pick<RoomView, "phaseEndsAt">): number | null {
  return view.phaseEndsAt === null ? null : view.phaseEndsAt - EXECUTION_MS;
}

/** 처형 진입 후 elapsedMs 의 연출 상태. passed = 처형이 성립했는가(핀이 꺼지는 시각이 다르다) */
export function momentAt(elapsedMs: number, passed: boolean): VerdictMoment {
  const t = Math.max(0, elapsedMs);
  let zoom = VERDICT_ZOOM;
  if (t < ZOOM_IN_MS) zoom = 1 + (VERDICT_ZOOM - 1) * easeInOut(t / ZOOM_IN_MS);
  else if (t >= BALLOT_END_AT) zoom = 1 + (VERDICT_ZOOM - 1) * (1 - easeInOut((t - BALLOT_END_AT) / ZOOM_BACK_MS));
  return {
    darken: t < BALLOT_END_AT,
    zoom,
    yes: t >= BALLOT_YES_AT,
    no: t >= BALLOT_NO_AT,
    pin: t < (passed ? PIN_OFF_EXEC_AT : PIN_OFF_NO_EXEC_AT),
    end: t >= BALLOT_END_AT,
  };
}

