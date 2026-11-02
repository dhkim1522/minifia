// 결정 0059 의 예측·섞기 순수 계산. 시각은 모두 인자이고 three·DOM·Date 를 쓰지 않는다.
// 서버 위치의 진실은 그대로 서버 구간이고(결정 0002), 여기는 화면에만 쓰는 계산이다.
import type { MapDef } from "../../shared/game/map";
import { BAR_MAP } from "../../shared/game/map";
import type { Segment } from "../../shared/game/world";
import { planMoveSegment } from "../../shared/game/world";

/**
 * 내 탭의 예측 구간: 서버가 같은 시각에 같은 목적지를 받았을 때 만드는 구간(같은 공용 본체, 결정 0059-1).
 * base(지금 내 구간)가 없으면 null.
 */
export function predictSegment(base: Segment | undefined, dest: { x: number; z: number }, at: number, map: MapDef = BAR_MAP): Segment | null {
  if (base === undefined) return null;
  return planMoveSegment(base, dest, at, map);
}

/** 구간 교체 때 화면 위치 차이를 0 으로 줄이는 시간(ms). 결정 0059-3 의 100~150ms 안에서 위쪽 끝을 골라 교정 중 감속을 가장 약하게 한다.
 * smoothstep 의 최대 감소율은 평균의 1.5배(RTT 앞섬 0.14 단위 기준 약 1.4 단위/초)라 걷는 속도 1.8 보다 작아 화면에서 뒤로 걷지 않는다. */
export const SEG_BLEND_MS = 150;
/** 이보다 큰 화면 위치 차이(월드 단위)는 섞지 않고 바로 맞춘다 — 재배치 같은 순간이동용. 실제 차이(RTT 앞섬 < 1, 응답 없음 되돌림 ≤ 1.5초 × 1.8 = 2.7)는 모두 섞는다. */
export const BLEND_SNAP_DIST = 3;
/** 방향 회전 속도(rad/s): 반 바퀴를 120ms 에 — 90° 전환이 약 60ms(60Hz 4프레임)다. */
export const YAW_TURN_RATE = Math.PI / 0.12;

/** 섞기 시작 뒤 elapsedMs 가 지났을 때 남은 위치 차이 비율: 0 이하 → 1, SEG_BLEND_MS 이상 → 정확히 0, 사이는 1 − smoothstep. */
export function blendRemaining(elapsedMs: number): number {
  if (!(elapsedMs > 0)) return 1;
  if (elapsedMs >= SEG_BLEND_MS) return 0;
  const p = elapsedMs / SEG_BLEND_MS;
  return 1 - p * p * (3 - 2 * p);
}

const TWO_PI = Math.PI * 2;

/** 각을 (−π, π] 로 감는다. 이미 범위 안이면 그대로 돌려준다(정확한 값을 흩뜨리지 않는다). */
function wrapAngle(a: number): number {
  if (a > -Math.PI && a <= Math.PI) return a;
  const r = ((((a + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI) - Math.PI;
  return r === -Math.PI ? Math.PI : r;
}

/**
 * 방향 cur 를 target 쪽으로 짧은 쪽으로 돌린다. 한 프레임에 YAW_TURN_RATE × dtSec 까지만 돌고,
 * 남은 각이 그 이하면 target 을 (−π, π] 로 정규화해 그대로 돌려준다. dtSec ≤ 0 이면 cur 정규화.
 */
export function stepYaw(cur: number, target: number, dtSec: number): number {
  const c = wrapAngle(cur);
  if (!(dtSec > 0)) return c;
  const diff = wrapAngle(target - c);
  const maxStep = YAW_TURN_RATE * dtSec;
  if (Math.abs(diff) <= maxStep) return wrapAngle(target);
  return wrapAngle(c + Math.sign(diff) * maxStep);
}

/**
 * 서버 시각 t 에 걷고 있는 선분의 방향 atan2(dx, dz)(runtime 의 yaw 규약과 같다). t < t0 이면 첫 선분.
 * shared interpFx 와 같은 누적 길이 규칙으로 길이 0 선분은 건너뛴다. 끝났거나 한 점·전부 길이 0·v ≤ 0 이면 null.
 */
export function travelYaw(seg: Segment, t: number): number | null {
  const p = seg.p;
  const n = p.length >> 1;
  if (n < 2 || !(seg.v > 0)) return null;
  let remain = (seg.v * (Math.max(t, seg.t0) - seg.t0)) / 1000;
  for (let i = 0; i + 1 < n; i++) {
    const dx = p[2 * i + 2]! - p[2 * i]!;
    const dz = p[2 * i + 3]! - p[2 * i + 1]!;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len === 0) continue;
    if (remain < len) return Math.atan2(dx, dz);
    remain -= len;
  }
  return null;
}

// ---- RED 껍데기 (GREEN 에서 구현) ----
export type OwnMoveEvent = "answered" | "reset" | null;
export interface OwnMoves {
  sent(pred: Segment | null): void;
  observe(seq: number, server: Segment | undefined): OwnMoveEvent;
  expire(): boolean;
  reset(seq: number): void;
  effective(server: Segment | undefined): Segment | undefined;
  pending(): number;
}
export function createOwnMoves(_initialSeq: number): OwnMoves {
  return {
    sent: () => {},
    observe: () => null,
    expire: () => false,
    reset: () => {},
    effective: (server) => server,
    pending: () => 0,
  };
}
