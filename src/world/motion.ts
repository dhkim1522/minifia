// 결정 0059 의 예측·섞기와 결정 0085 의 내 캐릭터 시각 앞섬 순수 계산. 시각은 모두 인자이고 three·DOM·Date 를 쓰지 않는다.
// 서버 위치의 진실은 그대로 서버 구간이고(결정 0002), 여기는 화면에만 쓰는 계산이다.
import type { MapDef } from "../../shared/game/map";
import { BAR_MAP } from "../../shared/game/map";
import type { Segment } from "../../shared/game/world";
import { planMoveSegment, segmentEndsAt } from "../../shared/game/world";

/**
 * 내 탭의 예측 구간: 서버가 같은 시각에 같은 목적지를 받았을 때 만드는 구간(같은 공용 본체, 결정 0059-1).
 * base(지금 내 구간)가 없으면 null.
 */
export function predictSegment(base: Segment | undefined, dest: { x: number; z: number }, at: number, map: MapDef = BAR_MAP): Segment | null {
  if (base === undefined) return null;
  return planMoveSegment(base, dest, at, map);
}

/** 구간 교체 때 화면 위치 차이를 0 으로 줄이는 시간(ms). 결정 0059-3 의 100~150ms 안에서 위쪽 끝을 골라 교정 중 감속을 가장 약하게 한다.
 * smoothstep 의 최대 감소율은 평균의 1.5배(초당 차이의 10배)라 차이가 0.18 단위(걷는 속도 1.8 × 100ms)를 넘으면 걷는 속도보다 빨리 당긴다.
 * 그래서 내 예측 → 서버 구간 교체에서 생기는 업링크만큼의 앞섬은 위치 차이로 당기지 않고 시각 앞섬(OwnMoves.lead)으로 넘긴다 — 여기서 섞는 것은 남는 작은 차이뿐이다. */
export const SEG_BLEND_MS = 150;
/**
 * 내 캐릭터를 그리는 시각이 서버 시각보다 앞설 수 있는 상한(ms). 앞섬 = 서버가 내 탭을 받기까지 걸린 시간(업링크 + 시계 추정 오차)이고,
 * 응답 없음 시계(1.5초) 안의 값만 생긴다. 이 값을 넘는 느린 연결은 넘는 만큼만 위치 차이로 섞는다(잘못 잰 값이 화면을 멀리 끌고 가지 않게 하는 울타리).
 */
export const OWN_LEAD_MAX_MS = 600;
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

/** observe 결과: answered = 내 예측을 서버 구간으로 바꿔야 함, reset = 연결이 새로 시작됨(예측을 비움), null = 변화 없음 */
export type OwnMoveEvent = "answered" | "reset" | null;

/**
 * 내 이동 추적기(결정 0059-2). 보낸 move 수와 서버가 내 자리에 적용한 move 수(WorldStore.moveSeqOf)를 맞춰
 * "내가 마지막으로 보낸 이동의 응답이 왔는가"를 판정한다. 응답이 늦어 앞선 탭의 응답이 먼저 와도 마지막 탭의 예측을 끊지 않는다.
 */
export interface OwnMoves {
  /** move 를 보낸 직후: 대기 +1, 예측 = pred(null 이면 예측 없음) */
  sent(pred: Segment | null): void;
  /** 프레임마다 moveSeqOf(내 자리)·segOf(내 자리)를 넘긴다 */
  observe(seq: number, server: Segment | undefined): OwnMoveEvent;
  /**
   * 응답 없음 1.5초: 대기가 있었으면 대기·예측을 비우고 cleared. 마지막으로 보낸 뒤 응답을 하나라도 들었으면 silent
   * (서버가 마지막 탭만 조용히 버린 경우 — 네트워크 문제가 아니니 알림 없이 비운다, GR-WR-01)
   */
  expire(): { cleared: boolean; silent: boolean };
  /** 새 연결(epoch 변경): 대기·예측을 비우고 기준 seq 를 다시 잡는다 */
  reset(seq: number): void;
  /** 그릴 구간: 예측 중이면 예측, 아니면 server */
  effective(server: Segment | undefined): Segment | undefined;
  pending(): number;
  /**
   * 내 캐릭터를 그리는 시각이 서버 시각보다 앞선 양(ms, 0 ~ OWN_LEAD_MAX_MS). 그릴 위치 = positionAt(effective, 서버 시각 + lead), 새 예측의 출발 시각도 탭 시각 + lead 다.
   * 서버는 탭을 업링크만큼 늦게 받아 같은 길을 그만큼 늦게 출발시킨다. 응답 때 예측을 서버 구간으로 바꾸면서 그 시간차를 여기에 더하면
   * 화면 위치가 이어진다(뒤로 끌려가지 않는다). 서버 구간의 길·끝점·속도는 그대로 따르고(결정 0002), 다른 사람 화면과 서버 판정에는 영향이 없다.
   */
  lead(): number;
  /** 프레임마다: 예측 중이 아니고 서버 구간이 서버 시각 serverNow 로도 끝났으면(또는 없으면) 앞섬을 0 으로 되돌린다 — 서 있는 자리는 시각과 무관해 화면이 변하지 않는다 */
  settle(serverNow: number, server: Segment | undefined): void;
}

/** 두 구간의 끝점(마지막 두 수)이 같은가 */
function sameEnd(a: Segment, b: Segment): boolean {
  const n = a.p.length;
  const m = b.p.length;
  if (n < 2 || m < 2) return false;
  return a.p[n - 2] === b.p[m - 2] && a.p[n - 1] === b.p[m - 1];
}

export function createOwnMoves(initialSeq: number): OwnMoves {
  let base = initialSeq;
  let waiting = 0;
  let predicted: Segment | null = null;
  let heardSinceSent = false;
  let lead = 0;
  const clear = (): void => {
    waiting = 0;
    predicted = null;
    heardSinceSent = false;
  };
  return {
    sent(pred) {
      waiting += 1;
      predicted = pred;
      heardSinceSent = false;
    },
    observe(seq, server) {
      if (seq < base) {
        base = seq;
        clear();
        return "reset";
      }
      if (seq === base) return null;
      const d = seq - base;
      base = seq;
      if (waiting === 0) return null; // 내가 보낸 것의 응답이 아니다
      waiting = Math.max(0, waiting - d);
      heardSinceSent = true;
      const pred = predicted;
      const reachedPrediction = pred !== null && server !== undefined && sameEnd(server, pred);
      if (waiting === 0 || reachedPrediction) {
        // 같은 끝점으로 가는 서버 구간이면 예측과의 출발 시각 차이(= 서버가 탭을 늦게 받은 시간)를 앞섬으로 넘긴다.
        // 예측은 (탭 시각 + 지금 앞섬)에 출발했으므로 이렇게 바꾸면 "출발 뒤 흐른 시간"이 같아 그리던 걸음이 이어진다.
        if (reachedPrediction) lead = Math.min(OWN_LEAD_MAX_MS, Math.max(0, lead + (server.t0 - pred.t0)));
        clear();
        return "answered";
      }
      return null; // 앞선 탭의 응답 — 마지막 탭의 예측을 끊지 않는다
    },
    expire() {
      if (waiting === 0) return { cleared: false, silent: false };
      const silent = heardSinceSent;
      clear();
      return { cleared: true, silent };
    },
    reset(seq) {
      base = seq;
      lead = 0;
      clear();
    },
    effective(server) {
      return predicted ?? server;
    },
    pending() {
      return waiting;
    },
    lead() {
      return lead;
    },
    settle(serverNow, server) {
      if (lead === 0 || predicted !== null) return;
      if (server === undefined || serverNow >= segmentEndsAt(server)) lead = 0;
    },
  };
}
