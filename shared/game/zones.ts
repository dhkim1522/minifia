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
 * from 시각의 구역에 머무는 동안의 부분 구간(D-14: 다른 구역에 든 뒤의 좌표를 그 구역 밖 사람에게 보내지 않는다).
 * 시작점은 그 순간 위치, t0 = max(from, seg.t0), v 는 그대로다. 구역이 바뀌면 바뀌기 직전 ms 의 위치에서 끝난다 —
 * 밖에서 방으로 들어가는 길은 문턱의 안쪽 면에서, 방에서 나가는 길은 그 면 바로 앞에서 끝난다.
 * 바뀌지 않으면 남은 구간 전체이고, from 이 seg.t0 이하이면 입력과 같은 값이다. 입력은 바꾸지 않는다.
 *
 * 한 변(직선) 안에서 구역은 많아야 한 번 바뀐다고 본다: 방은 볼록한 사각형이고 벽이 둘러싸 문 하나로만 드나드므로
 * 직선 하나가 방에 들어갔다 나오거나 나왔다 들어갈 수 없다. 그래서 변의 끝 꼭짓점이 출발 구역이면 그 변에서는 찾지 않고,
 * 다르면 그 변 안에서 바뀌는 첫 정수 ms 를 이분 탐색한다. 끝에 한 번 더 모든 꼭짓점의 구역을 확인해, 어긋나면 그 자리 한 점만 돌려준다(닫힌 쪽으로 실패).
 */
export function clipToZone(map: Pick<MapDef, "rooms">, seg: Segment, from: number): Segment {
  const start = from > seg.t0 ? from : seg.t0;
  const here = positionAtFx(seg, start);
  const rest: Segment = { p: [here.x, here.z], t0: start, v: seg.v };
  const n = seg.p.length >> 1;
  if (n < 2 || !(seg.v > 0)) return rest;
  const zone0 = zoneOf(map, here.x, here.z);
  const out: number[] = [here.x, here.z];
  let tPrev = seg.t0; // 꼭짓점 i 에 닿는 시각(실수 ms)
  let changed = false;
  for (let i = 0; i + 1 < n && !changed; i++) {
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
        changed = true;
      }
    }
    tPrev = tNext;
  }
  if (!changed && start === seg.t0) return { p: [...seg.p], t0: seg.t0, v: seg.v };
  if (out.length < 4) return rest;
  for (let i = 0; i + 1 < out.length; i += 2) if (zoneOf(map, out[i]!, out[i + 1]!) !== zone0) return rest;
  return { p: out, t0: start, v: seg.v };
}

/** 구역이 바뀐 한 사람(문 통과). from·to 가운데 plaza 가 아닌 쪽이 지나간 문의 방이다. */
export interface ZoneChange {
  id: string;
  from: ZoneId;
  to: ZoneId;
}

// 자리 함수(20-02 RED): 구현은 다음 커밋.
export function nextCrossingAt(_map: Pick<MapDef, "rooms">, _seg: Segment, _after: number): number | null {
  return null;
}

export function reconcileZones(_map: Pick<MapDef, "rooms">, w: WorldState, _ids: readonly string[], _now: number): { world: WorldState; changes: ZoneChange[] } {
  return { world: w, changes: [] };
}

export function settleZones(_map: Pick<MapDef, "rooms">, w: WorldState, _ids: readonly string[], _now: number): WorldState {
  return w;
}
