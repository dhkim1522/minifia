// 구역 판정(20페이즈 D-13·D-14) — 순수 모듈: 시각·난수를 읽지 않고 삼각함수 없이 사칙연산·제곱근만 쓴다.
// 구역은 위치의 순수 함수다: 방 안쪽 사각형의 엄격한 안쪽이면 그 방, 그 밖(문턱·벽·광장·골목)은 plaza.
// 서버가 가진 구간의 위치로만 정한다 — 클라이언트 메시지에 구역 값은 없다(결정 0002). 화면은 같은 함수로 내 방의 벽을 걷는다(UI-SPEC P20-8).
import type { ZoneId } from "../protocol";
import type { MapDef } from "./map";
import { positionAtFx } from "./world";
import type { Segment, WorldState } from "./world";

/** 고정소수점 점의 구역. 방이 없는 맵(재즈 바·광장)은 늘 plaza 다. 안쪽 사각형의 경계 위(문턱의 안쪽 면 포함)는 바깥이다. */
export function zoneOf(map: Pick<MapDef, "rooms">, xFx: number, zFx: number): ZoneId {
  for (const room of map.rooms ?? []) {
    const r = room.inner;
    if (xFx > r.x0 && xFx < r.x1 && zFx > r.z0 && zFx < r.z1) return room.id;
  }
  return "plaza";
}

/** 시각 t(서버 ms)에 구간 위의 사람이 있는 구역(positionAtFx 의 반올림 위치). */
export function zoneAt(map: Pick<MapDef, "rooms">, seg: Segment, t: number): ZoneId {
  const p = positionAtFx(seg, t);
  return zoneOf(map, p.x, p.z);
}

/**
 * from 뒤로 구간을 따라가며 출발 구역(from 시각의 구역)에 머무는 길과 구역이 바뀌는 첫 정수 ms 를 찾는다 — clipToZone·nextCrossingAt 이 같이 쓴다.
 * start = max(from, seg.t0), here = 그 순간 위치, out = here 부터 출발 구역에 머무는 꼭짓점들(바뀌면 바뀌기 직전 ms 의 위치까지),
 * changeAt = 구역이 처음 달라지는 정수 ms(없으면 null). changeAt − 1 ms 의 위치가 out 의 끝점이다.
 *
 * 한 변(직선) 안에서 구역은 많아야 한 번 바뀐다고 본다: 방은 볼록한 사각형이고 벽이 둘러싸 문 하나로만 드나드므로
 * 직선 하나가 방에 들어갔다 나오거나 나왔다 들어갈 수 없다. 그래서 변의 끝 꼭짓점이 출발 구역이면 그 변에서는 찾지 않고,
 * 다르면 그 변 안에서 바뀌는 첫 정수 ms 를 이분 탐색한다.
 */
function scanZone(map: Pick<MapDef, "rooms">, seg: Segment, from: number): { start: number; here: { x: number; z: number }; out: number[]; changeAt: number | null } {
  const start = from > seg.t0 ? from : seg.t0;
  const here = positionAtFx(seg, start);
  const out: number[] = [here.x, here.z];
  const n = seg.p.length >> 1;
  if (n < 2 || !(seg.v > 0)) return { start, here, out, changeAt: null };
  const zone0 = zoneOf(map, here.x, here.z);
  let tPrev = seg.t0; // 꼭짓점 i 에 닿는 시각(실수 ms)
  for (let i = 0; i + 1 < n; i++) {
    const bx = seg.p[2 * i + 2]!;
    const bz = seg.p[2 * i + 3]!;
    const dx = bx - seg.p[2 * i]!;
    const dz = bz - seg.p[2 * i + 1]!;
    const tNext = tPrev + (Math.sqrt(dx * dx + dz * dz) * 1000) / seg.v;
    if (tNext > start) {
      if (zoneOf(map, bx, bz) === zone0) {
        out.push(bx, bz);
      } else {
        // 이 변에서 구역이 바뀐다: lo 는 출발 구역인 시각, hi 는 끝 꼭짓점에 닿은 뒤의 첫 정수 ms.
        let lo = start > tPrev ? start : Math.floor(tPrev);
        let hi = Math.ceil(tNext);
        while (hi - lo > 1) {
          const mid = Math.floor((lo + hi) / 2);
          if (zoneAt(map, seg, mid) === zone0) lo = mid;
          else hi = mid;
        }
        const end = positionAtFx(seg, lo);
        if (end.x !== out[out.length - 2] || end.z !== out[out.length - 1]) out.push(end.x, end.z);
        return { start, here, out, changeAt: hi };
      }
    }
    tPrev = tNext;
  }
  return { start, here, out, changeAt: null };
}

/**
 * from 시각의 구역에 머무는 동안의 부분 구간(D-14: 다른 구역에 든 뒤의 좌표를 그 구역 밖 사람에게 보내지 않는다).
 * 시작점은 그 순간 위치, t0 = max(from, seg.t0), v 는 그대로다. 구역이 바뀌면 바뀌기 직전 ms 의 위치에서 끝난다 —
 * 밖에서 방으로 들어가는 길은 문턱의 안쪽 면에서, 방에서 나가는 길은 그 면 바로 앞에서 끝난다.
 * 바뀌지 않으면 남은 구간 전체이고, from 이 seg.t0 이하이면 입력과 같은 값이다. 입력은 바꾸지 않는다.
 * 끝에 한 번 더 모든 꼭짓점의 구역을 확인해, 어긋나면 그 자리 한 점만 돌려준다(닫힌 쪽으로 실패).
 */
export function clipToZone(map: Pick<MapDef, "rooms">, seg: Segment, from: number): Segment {
  const { start, here, out, changeAt } = scanZone(map, seg, from);
  const rest: Segment = { p: [here.x, here.z], t0: start, v: seg.v };
  const n = seg.p.length >> 1;
  if (n < 2 || !(seg.v > 0)) return rest;
  if (changeAt === null && start === seg.t0) return { p: [...seg.p], t0: seg.t0, v: seg.v };
  if (out.length < 4) return rest;
  const zone0 = zoneOf(map, here.x, here.z);
  for (let i = 0; i + 1 < out.length; i += 2) if (zoneOf(map, out[i]!, out[i + 1]!) !== zone0) return rest;
  return { p: out, t0: start, v: seg.v };
}

/**
 * after 보다 늦은 첫 문 통과 시각(구역이 after 시각의 구역과 달라지는 첫 정수 ms). 그 시각의 구역은 새 구역이고 1ms 전은 옛 구역이다.
 * 더 넘지 않으면(서 있음·같은 구역 안 걷기·이미 지남) null, 방이 없는 맵은 늘 null 이다. 방 DO 가 이 시각에 알람을 걸어 문 통과 프레임을 낸다(D-14).
 * 한 구간이 두 번 넘으면(방 → 광장 → 다른 방) 첫 번째만 낸다 — 넘은 뒤 다시 부르면 다음 것이 나온다.
 */
export function nextCrossingAt(map: Pick<MapDef, "rooms">, seg: Segment, after: number): number | null {
  if ((map.rooms ?? []).length === 0) return null;
  return scanZone(map, seg, after).changeAt;
}

/** 구역이 바뀐 한 사람(문 통과). from·to 가운데 plaza 가 아닌 쪽이 지나간 문의 방이다. */
export interface ZoneChange {
  id: string;
  from: ZoneId;
  to: ZoneId;
}

const own = <T>(rec: Readonly<Record<string, T>> | undefined, key: string): T | undefined =>
  rec !== undefined && Object.prototype.hasOwnProperty.call(rec, key) ? rec[key] : undefined;

/**
 * 구역 기억(world.zones)을 ids 의 지금 위치로 맞춘다(D-14). 기억과 지금 구역이 다른 사람만 changes 에 ids 순서대로 담는다 —
 * 기억이 없던 사람은 알림 없이 지금 구역을 기억할 뿐이다(T-20-08: 저장값이 없거나 버려졌을 때 가짜 문 통과를 내지 않는다).
 * 구간이 없는 id 는 건너뛰고 ids 에 없는 사람의 기억은 그대로 둔다. 아무것도 안 바뀌면 같은 world 객체를 돌려준다.
 * 방이 없는 맵에서는 world 를 그대로 돌려주고 기억을 만들지 않는다. 입력은 바꾸지 않는다.
 */
export function reconcileZones(map: Pick<MapDef, "rooms">, w: WorldState, ids: readonly string[], now: number): { world: WorldState; changes: ZoneChange[] } {
  const changes: ZoneChange[] = [];
  if ((map.rooms ?? []).length === 0) return { world: w, changes };
  let zones: Record<string, ZoneId> | null = null;
  for (const id of ids) {
    const seg = own(w.segs, id);
    if (seg === undefined) continue;
    const to = zoneAt(map, seg, now);
    const from = own(zones ?? w.zones, id);
    if (from === to) continue;
    zones ??= { ...(w.zones ?? {}) };
    zones[id] = to;
    if (from !== undefined) changes.push({ id, from, to });
  }
  return { world: zones === null ? w : { ...w, zones }, changes };
}

/**
 * 알림 없이 ids 모두를 지금 구역으로 기억한다 — 서버가 사람을 한꺼번에 옮긴 뒤(순간이동·대기실 복귀) 문 통과 프레임이 나가지 않게 한다.
 * 이미 맞으면 같은 world 객체다. 방이 없는 맵에서는 world 를 그대로 돌려준다.
 */
export function settleZones(map: Pick<MapDef, "rooms">, w: WorldState, ids: readonly string[], now: number): WorldState {
  return reconcileZones(map, w, ids, now).world;
}
