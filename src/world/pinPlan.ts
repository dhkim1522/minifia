// 핀 조명 계획(결정 0066-6, UI-SPEC F): "무엇을 비출지"(PinDesc)와 "시각에 따른 위치"(pinAt)를 나눈 순수 모듈.
// 판결 순간(12)·결선(14)·마지막 3인(15) 계획이 pinOf 에 자기 단계를 더해 같은 장치(렌더러 setPin)를 재사용한다.
// L22: 대상 좌석은 서버가 모두에게 공개한 값(day.turn·day.points)에서만 나온다. 연결·스토어·개인 정보는 읽지 않는다(정적 시험 pinStaticGuard).
import { RUNOFF_SPOTS } from "../../shared/game/gather";
import { UNIT } from "../../shared/game/map";
import { EXECUTION_MS, PICK_GAP_MS } from "../../shared/game/phases";
import type { RoomView } from "../../shared/protocol";

/** 핀이 켜졌을 때 무대 점광 세기의 비율: 단계 값(0)과 선두 세기(1) 사이에서 0.9 (UI-SPEC O-14 — 육안 조정은 이 상수 한 곳) */
export const PIN_STRENGTH = 0.9;
/** 핀이 켜졌을 때 실내등(방·투표 발광)에 곱하는 값 (O-14) */
export const PIN_DIM = 0.6;
/** 켜질 때 dur-fast */
export const PIN_ON_MS = 180;
/** 꺼질 때 dur-med */
export const PIN_OFF_MS = 420;

/** 판결 순간 핀이 꺼지는 시각(처형 진입 기준 ms): 부결은 "처형 없음" 알림이 끝난 때, 처형은 유령이 사라지는 때 (verdictMoment 가 같은 값을 다시 내보낸다) */
export const PIN_OFF_NO_EXEC_AT = 4000;
export const PIN_OFF_EXEC_AT = 5000;

/**
 * 무엇을 비출지. turn = 한 사람 머리 위, slide = from 에서 to 로 미끄러짐(startAt 은 서버 시각),
 * fixed = 한 사람을 서버 시각 [startAt, endAt) 동안만 비춘다(판결 순간: 창 밖은 꺼짐),
 * point = 월드 좌표 한 점(결선: 두 후보의 가운데, 좌석과 무관)
 */
export type PinDesc =
  | { mode: "turn"; seat: number }
  | { mode: "slide"; from: number; to: number; startAt: number; durationMs: number }
  | { mode: "fixed"; seat: number; startAt: number; endAt: number }
  | { mode: "point"; x: number; z: number };

/** 결선 핀: 두 후보 자리(서버 배치 RUNOFF_SPOTS, 고정소수점)의 한가운데를 월드 단위로. 후보가 걸어 오는 동안에도 같은 점이다 */
const RUNOFF_PIN: Extract<PinDesc, { mode: "point" }> = {
  mode: "point",
  x: (RUNOFF_SPOTS[0][0] + RUNOFF_SPOTS[1][0]) / 2 / UNIT,
  z: (RUNOFF_SPOTS[0][1] + RUNOFF_SPOTS[1][1]) / 2 / UNIT,
};

/**
 * 처형 단계(판결 순간)의 핀: 변론자에게 처형 진입 시각부터 부결 4.0초·처형 5.0초까지.
 * 마지막 3인 처형(verdict.last, 09.1.1-15)은 찬반 기록(ballots)이 없고 지목으로 정해진 득표자(day.candidate)를 같은 창으로 비춘다(줌·찬반 묶음은 없다).
 */
function executionPin(view: RoomView): PinDesc | null {
  const seat = view.day?.candidate;
  const verdict = view.day?.verdict;
  if (typeof seat !== "number" || verdict === undefined) return null;
  if ((verdict.last !== true && view.day?.ballots === undefined) || view.phaseEndsAt === null) return null;
  const startAt = view.phaseEndsAt - EXECUTION_MS;
  return { mode: "fixed", seat, startAt, endAt: startAt + (verdict.passed ? PIN_OFF_EXEC_AT : PIN_OFF_NO_EXEC_AT) };
}

/** 마지막 3인 한마디(09.1.1-15, UI-SPEC E-1·F): 말하는 사람(차례 중·확정/시간 초과 뒤 사이)에게 켜 둔다. 모이는 중·동시 지목·공개에는 꺼진다(차례 사이의 교차는 렌더러 몫) */
function showdownPin(view: RoomView): PinDesc | null {
  const sd = view.day?.showdown;
  if (sd === undefined || !Number.isInteger(sd.i) || sd.i < 0 || sd.i > 2) return null;
  const seat = sd.order[sd.i];
  return typeof seat === "number" ? { mode: "turn", seat } : null;
}

/** 단계별 핀. 순차 지목(차례·이동)·결선(후보 가운데 한 점)·마지막 3인 한마디(말하는 사람)·판결 순간(변론자 고정). 다른 단계의 핀은 각 계획이 이 함수를 확장한다 */
export function pinOf(view: RoomView): PinDesc | null {
  if (view.phase === "execution") return executionPin(view);
  if (view.phase === "runoff") return RUNOFF_PIN;
  if (view.phase === "showdown") return showdownPin(view);
  if (view.phase !== "nomination") return null;
  const turn = view.day?.turn;
  if (turn === undefined) return null;
  const { order, i } = turn;
  if (!Number.isInteger(i) || i < 0 || i >= order.length) return null; // 모이는 중·끝 알림·이상한 값
  const seat = order[i];
  if (typeof seat !== "number") return null;
  if (turn.doneAt === undefined) return { mode: "turn", seat };
  if (turn.skip === true) return null; // 기권: 이동 없이 꺼진다
  const line = view.day?.points?.find((p) => p.seat === seat);
  if (line === undefined) return null;
  return { mode: "slide", from: seat, to: line.target, startAt: turn.doneAt, durationMs: PICK_GAP_MS };
}

/** 0→0, 0.5→0.5, 1→1 인 부드러운 가감속(smoothstep) */
export function easeInOut(p: number): number {
  const k = Math.min(1, Math.max(0, p));
  return k * k * (3 - 2 * k);
}

export interface PinAt {
  on: boolean;
  /** 지금 비추는 좌석: turn 은 그 좌석, slide 는 진행 0.5 이전 from · 이후 to. point 는 없다 */
  seat?: number;
  /** point 모드의 월드 좌표 */
  x?: number;
  z?: number;
  from?: number;
  to?: number;
  /** slide 진행(0~1, ease 적용). turn·꺼짐은 0 */
  t: number;
  /** slide 가 이동하는 중 */
  moving: boolean;
}

/** 서버 시각 serverNow 의 핀 모양. 모션 줄이기면 slide 는 곧바로 도착(t 1)이다 */
export function pinAt(desc: PinDesc | null, serverNow: number, reduced: boolean): PinAt {
  if (desc === null) return { on: false, t: 0, moving: false };
  if (desc.mode === "turn") return { on: true, seat: desc.seat, t: 0, moving: false };
  if (desc.mode === "point") return { on: true, x: desc.x, z: desc.z, t: 0, moving: false };
  if (desc.mode === "fixed") return serverNow >= desc.startAt && serverNow < desc.endAt ? { on: true, seat: desc.seat, t: 0, moving: false } : { on: false, t: 0, moving: false };
  const raw = desc.durationMs > 0 ? (serverNow - desc.startAt) / desc.durationMs : 1;
  const t = reduced ? 1 : easeInOut(raw);
  const moving = !reduced && raw > 0 && raw < 1;
  return { on: true, seat: t >= 0.5 ? desc.to : desc.from, from: desc.from, to: desc.to, t, moving };
}

/** 켜짐 수준 k(0~1)를 dtMs 만큼 목표(on)로 옮긴다. 모션 줄이기는 계단식 */
export function pinLevel(k: number, on: boolean, dtMs: number, reduced: boolean): number {
  if (reduced) return on ? 1 : 0;
  const next = on ? k + dtMs / PIN_ON_MS : k - dtMs / PIN_OFF_MS;
  return Math.min(1, Math.max(0, next));
}

/** 켜짐 수준 k 의 렌더러 값: 점광 세기 비율과 실내등 곱 */
export function pinLights(k: number): { strength: number; dim: number } {
  return { strength: PIN_STRENGTH * k, dim: 1 - (1 - PIN_DIM) * k };
}
