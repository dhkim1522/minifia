// 모이는 자리 규칙(DAY-04·05, 결정 0060-7, UI-SPEC E8 #31). 순수 모듈이다 — 시각은 인자 now, 난수·DOM·workerd API 가 없고 입력을 바꾸지 않는다.
// 서버만 계산하고 클라이언트는 받은 구간을 그린다: 슬롯은 삼각함수 없이 상수 표로 두고(클라이언트가 다시 계산하지 않는다),
// 각도 정렬은 정수 사분면·외적 비교로 한다.
//
// 이 모듈은 '어디로 갈지'(목적지)만 낸다. 경로 만들기(planMoveSegment)·적용(forceSegment)·전송은 방 DO 의 몫이다(08-09).
// 배치는 '지금 단계가 요구하는 모습' 기준의 멱등 동기화다 — 단계 전환 이벤트에 걸지 않으므로 알람이 늦어 단계를 건너뛰어도,
// 퇴거·재시작 뒤에도 같은 판단을 한다. 이미 목적지에 선(또는 그리로 걷는 중인) 사람은 이동 목록에 없다.
import { isAlive } from "./alive";
import { STAGE_SPOT } from "./map";
import type { RoomState } from "./room";
import { positionAtFx } from "./world";
import type { LayoutMemo, WorldState } from "./world";

/** 둘레 자리 반지름(고정소수점 2.65). 8곳이 서로 2.0(200) 이상 떨어지는 최소 근처 값이다(반지름 2.5 는 1.913 이라 모자라다, RESEARCH 패턴 4). */
export const RING_RADIUS_FX = 265;

type Slot = readonly [number, number];

/**
 * 산 사람 수 n = 2..8 별 둘레 자리. 반지름 RING_RADIUS_FX 원 위 n 등분, (0, 265) 에서 시작해 한 칸씩 반시계(A1).
 * 8곳은 45° 배수라 모두 걸을 수 있고, 나머지 n 은 단위 시험(test/unit/gather.test.ts)이 걸을 수 있음·간격·무대 선분·입장 지점 경로를 고정한다.
 */
export const RING_SLOTS: Readonly<Record<number, readonly Slot[]>> = {
  2: [
    [0, 265],
    [0, -265],
  ],
  3: [
    [0, 265],
    [-229, -133],
    [229, -133],
  ],
  4: [
    [0, 265],
    [-265, 0],
    [0, -265],
    [265, 0],
  ],
  5: [
    [0, 265],
    [-252, 82],
    [-156, -214],
    [156, -214],
    [252, 82],
  ],
  6: [
    [0, 265],
    [-229, 133],
    [-229, -133],
    [0, -265],
    [229, -133],
    [229, 133],
  ],
  7: [
    [0, 265],
    [-207, 165],
    [-258, -59],
    [-115, -239],
    [115, -239],
    [258, -59],
    [207, 165],
  ],
  8: [
    [0, 265],
    [-187, 187],
    [-265, 0],
    [-187, -187],
    [0, -265],
    [187, -187],
    [265, 0],
    [187, 187],
  ],
};

/** 산 사람 n 명의 둘레 자리. n < 2·n > 8·정수가 아니면 빈 배열이다. 돌려주는 배열은 표 그 자체이니 고치지 않는다. */
export function ringSlots(n: number): readonly Slot[] {
  return Number.isInteger(n) && n >= 2 && n <= 8 ? RING_SLOTS[n]! : [];
}

interface Pt {
  x: number;
  z: number;
}

/** 무대 중심(원점) 기준 각도 순서(0 → 2π 반시계): 위쪽 반평면(z > 0 이거나 z = 0 · x ≥ 0) 먼저, 같은 반평면 안은 외적, 같은 방향이면 가까운 쪽. 삼각함수 없이 정수만. */
function byAngle(a: Pt, b: Pt): number {
  const ha = a.z > 0 || (a.z === 0 && a.x >= 0) ? 0 : 1;
  const hb = b.z > 0 || (b.z === 0 && b.x >= 0) ? 0 : 1;
  if (ha !== hb) return ha - hb;
  const cross = a.x * b.z - a.z * b.x;
  if (cross !== 0) return cross > 0 ? -1 : 1;
  return a.x * a.x + a.z * a.z - (b.x * b.x + b.z * b.z);
}

/**
 * 사람 → 둘레 자리 배정(A2): 사람과 자리를 각각 각도 순으로 세운 뒤, 순서를 보존한 채 한 칸씩 돌려 본 n 가지 중
 * 걷는 거리 제곱합이 가장 작은 돌림(동률은 작은 돌림)을 쓴다. 교차 최소화 최적화는 하지 않는다(RESEARCH A7).
 * 입력 순서와 무관하게 같은 대응이 나온다(같은 방향의 동률은 id 순). 사람 수와 자리 수가 다르면 빈 결과다.
 */
export function assignSlots(people: readonly { id: string; x: number; z: number }[], slots: readonly Slot[]): Record<string, Slot> {
  const n = people.length;
  const out: Record<string, Slot> = {};
  if (n === 0 || slots.length !== n) return out;
  const ps = [...people].sort((a, b) => byAngle(a, b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const ss = [...slots].sort((a, b) => byAngle({ x: a[0], z: a[1] }, { x: b[0], z: b[1] }));
  let bestRot = 0;
  let bestCost = Infinity;
  for (let r = 0; r < n; r += 1) {
    let cost = 0;
    for (let i = 0; i < n; i += 1) {
      const s = ss[(i + r) % n]!;
      cost += (ps[i]!.x - s[0]) * (ps[i]!.x - s[0]) + (ps[i]!.z - s[1]) * (ps[i]!.z - s[1]);
    }
    if (cost < bestCost) {
      bestCost = cost;
      bestRot = r;
    }
  }
  for (let i = 0; i < n; i += 1) {
    const s = ss[(i + bestRot) % n]!;
    out[ps[i]!.id] = [s[0], s[1]];
  }
  return out;
}

/** 지금 단계가 요구하는 배치의 키: 지목 '{일차}:ring' · 변론·찬반 '{일차}:stage' · 처형 '{일차}:exec' · 그 밖은 null(아무것도 안 한다). */
export function layoutKey(state: RoomState): string | null {
  const day = state.day ?? 0;
  switch (state.phase) {
    case "nomination":
      return `${day}:ring`;
    case "defense":
    case "verdict":
      return `${day}:stage`;
    case "execution":
      return `${day}:exec`;
    default:
      return null;
  }
}

/** 그날 찬반 결과: voteLog 의 그날 줄(exec.passed)을 먼저 보고, 줄이 없으면 verdict.passed 를 따른다. */
function verdictPassed(state: RoomState): boolean {
  const day = state.day ?? 0;
  const log = state.voteLog ?? [];
  const at = log.map((entry) => entry.n).lastIndexOf(day);
  return at >= 0 ? log[at]!.exec.passed : state.verdict?.passed === true;
}

export interface GatherLayout {
  /** 이 배치의 키(layoutKey). 적용한 뒤 world.lay 에 slots 와 함께 저장하면 다음 호출이 같은 자리를 쓴다. */
  key: string;
  /** 참가자(산 사람 + 재판 단계의 변론자)마다 기억해 둘 둘레 자리. 변론자가 무대에서 돌아올 자리도 여기 있다. */
  slots: Record<string, Slot>;
  /** 아직 목적지에 없는 사람의 이동(좌석 오름차순). 이미 그 목적지에 선(또는 걷는 중인) 사람은 없다. */
  moves: { playerId: string; dest: { x: number; z: number } }[];
}

/**
 * 지금 단계가 요구하는 배치(멱등). 단계가 배치 단계가 아니면 null.
 *   nomination      산 사람 → 둘레 자리
 *   defense·verdict 변론자 → 무대(STAGE_SPOT), 나머지 산 사람 → 자기 둘레 자리
 *   execution       통과면 변론자 목적지 없음(무대 유지, 유령이 되어 떠오른다), 부결이면 변론자 → 자기 둘레 자리
 * 자리 배정은 w.lay 를 우선한다 — 지목은 같은 키(같은 날 지목)일 때, 변론·처형은 같은 날 기억일 때. 그래야 걷는 도중에 다시 불러도 자리가 뒤섞이지 않는다.
 * 기억에 없는 사람(재접속 등)만 남은 자리를 현재 위치로 배정받는다. 위치는 positionAtFx(구간, now), 도착은 구간 끝점 = 목적지 로 본다.
 * 월드에 구간이 없는 사람은 건너뛴다. 입력은 바꾸지 않는다.
 */
export function layoutFor(state: RoomState, w: WorldState, now: number): GatherLayout | null {
  const key = layoutKey(state);
  if (key === null) return null;
  const day = state.day ?? 0;
  const trial = state.phase !== "nomination";
  const defender = trial ? state.verdict?.candidate : undefined;

  const participants = [...state.players]
    .sort((a, b) => a.seat - b.seat)
    .filter((p) => Object.prototype.hasOwnProperty.call(w.segs, p.id) && (isAlive(p) || p.seat === defender));
  const empty: GatherLayout = { key, slots: {}, moves: [] };
  const table = ringSlots(participants.length);
  if (table.length === 0) return empty;

  const memo: LayoutMemo | undefined = w.lay;
  const reuse = memo !== undefined && (trial ? memo.key.startsWith(`${day}:`) : memo.key === key) ? memo : null;

  const free = table.map((s): Slot => [s[0], s[1]]);
  const slots: Record<string, Slot> = {};
  const unplaced: { id: string; x: number; z: number }[] = [];
  for (const p of participants) {
    const kept = reuse !== null && Object.prototype.hasOwnProperty.call(reuse.slots, p.id) ? reuse.slots[p.id] : undefined;
    const at = kept === undefined ? -1 : free.findIndex((s) => s[0] === kept[0] && s[1] === kept[1]);
    if (kept !== undefined && at >= 0) {
      slots[p.id] = [kept[0], kept[1]];
      free.splice(at, 1);
    } else {
      const pos = positionAtFx(w.segs[p.id]!, now);
      unplaced.push({ id: p.id, x: pos.x, z: pos.z });
    }
  }
  Object.assign(slots, assignSlots(unplaced, free));

  const passed = state.phase === "execution" ? verdictPassed(state) : false;
  const moves: GatherLayout["moves"] = [];
  for (const p of participants) {
    const isDefender = p.seat === defender;
    let dest: { x: number; z: number } | null;
    if (isDefender && (state.phase === "defense" || state.phase === "verdict")) dest = { x: STAGE_SPOT.x, z: STAGE_SPOT.z };
    else if (isDefender && passed) dest = null; // 통과: 무대에 남는다
    else {
      const s = slots[p.id];
      dest = s === undefined ? null : { x: s[0], z: s[1] };
    }
    if (dest === null) continue;
    const p0 = w.segs[p.id]!.p;
    if (p0[p0.length - 2] === dest.x && p0[p0.length - 1] === dest.z) continue;
    moves.push({ playerId: p.id, dest });
  }
  return { key, slots, moves };
}
