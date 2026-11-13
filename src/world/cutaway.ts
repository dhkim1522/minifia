// 컷어웨이 판정(20페이즈 D-10·D-11, UI-SPEC P20-8) — 순수 모듈: three·DOM 을 읽지 않는다.
// 어느 방을 걷을지는 서버의 구역과 같은 함수(shared zoneOf)의 결과를 받아 정할 뿐, 화면이 따로 판단하지 않는다.
// 내가 방 안이면 그 방 하나, 유령·결과 화면(roomsOpen)이면 네 방 모두, 그 밖(광장·문턱)은 모두 덮는다.
import { HEAD_TOP_Y, TO_CAMERA, UNIT } from "../../shared/game/map";
import { TOWN_HOUSES, TOWN_OBSTACLES, TOWN_ROOMS, TOWN_ROOM_OUTER } from "../../shared/game/mapTown";
import { ROOM_IDS } from "../../shared/protocol";
import type { RoomId, ZoneId } from "../../shared/protocol";

const ALL: readonly RoomId[] = ROOM_IDS;

/** 열린(걷힌) 방의 집합. zone 은 내 그려진 위치의 구역(내 몸이 아직 없으면 null), all 은 유령·결과 화면 */
export function cutawayOf(zone: ZoneId | null, all: boolean): ReadonlySet<RoomId> {
  if (all) return new Set(ALL);
  if (zone !== null && (ALL as readonly string[]).includes(zone)) return new Set<RoomId>([zone as RoomId]);
  return new Set<RoomId>();
}

/** 두 집합이 같은 방들을 담고 있나(런타임이 바뀐 때만 렌더러에 보내려고 쓴다) */
export function sameRooms(a: ReadonlySet<RoomId>, b: ReadonlySet<RoomId>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

// ---------- 벽 뒤 이름표·건물 누르기 (20-06, D-19·P20-11·P20-12) ----------
// 광선 시험은 메시가 아니라 장애물 원문 상자로 한다(걷힌 방의 컷 메시는 꺼져 있다). 삼각함수 없이 사칙연산 — 마스크를 만든 것과 같은 슬랩 시험이다.

/** 월드 단위 3차원 점·방향 */
export interface V3 {
  x: number;
  y: number;
  z: number;
}
/** 화면 점의 광선(정사영): 원점과 방향(단위 벡터일 필요 없다) */
export interface Ray {
  origin: V3;
  dir: V3;
}
/** 축 정렬 상자(월드 단위) */
interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y0: number;
  y1: number;
}

/** 방 벽·문 위 이마·지붕·소품(room 키가 있는 회전 없는 사각형) — 머리 가림 시험의 대상. cut 은 그 방이 열리면 걷히는 것 */
const ROOM_BOXES: readonly (Box & { room: RoomId; cut: boolean })[] = TOWN_OBSTACLES.flatMap((o) =>
  o.kind === "rect" && o.room !== undefined && o.rot === 0
    ? [{ x0: o.x - o.w / 2, x1: o.x + o.w / 2, z0: o.z - o.d / 2, z1: o.z + o.d / 2, y0: o.y0, y1: o.y1, room: o.room, cut: o.cut === true }]
    : [],
);

/** 광선이 상자에 들어가는 매개변수(만나지 않거나 전부 원점 뒤면 null). 원점이 상자 안이면 음수일 수 있다 */
function slab(b: Box, o: V3, d: V3): number | null {
  let lo = Number.NEGATIVE_INFINITY;
  let hi = Number.POSITIVE_INFINITY;
  const axes: readonly (readonly [number, number, number, number])[] = [
    [o.x, d.x, b.x0, b.x1],
    [o.y, d.y, b.y0, b.y1],
    [o.z, d.z, b.z0, b.z1],
  ];
  for (const [org, dir, min, max] of axes) {
    if (Math.abs(dir) < 1e-12) {
      if (org < min || org > max) return null;
      continue;
    }
    const t1 = (min - org) / dir;
    const t2 = (max - org) / dir;
    lo = Math.max(lo, Math.min(t1, t2));
    hi = Math.min(hi, Math.max(t1, t2));
  }
  return hi > 0 && lo <= hi ? lo : null;
}

/**
 * 이 자리(월드 단위 x·z)에 선 사람의 머리 꼭대기가 닫힌 방의 벽·이마·지붕에 가려지나. 광선은 마스크를 만든 것과 같다(머리 꼭대기에서 TO_CAMERA 방향).
 * open 에 든 방의 지붕·앞벽(cut)은 걷혀 있으니 뺀다. 소품은 머리보다 낮아 광선에 닿지 않는다. 가려지면 그 사람의 이름표는 지붕 위에 떠 있으면 안 된다(P20-12)
 */
export function headVeiled(x: number, z: number, open: ReadonlySet<RoomId>): boolean {
  const origin: V3 = { x, y: HEAD_TOP_Y, z };
  for (const b of ROOM_BOXES) {
    if (b.cut && open.has(b.room)) continue;
    if (slab(b, origin, TO_CAMERA) !== null) return true;
  }
  return false;
}

/** 닫힌 방 몸통(바깥 윤곽 × 지붕판 윗면 2.36) */
const ROOM_BODY_Y1 = 2.36;
/** 집 몸통 2.4×2.4 높이 1.8 과 지붕판 2.6×2.6 높이 1.8~1.96 */
const HOUSE_HALF = 1.2;
const HOUSE_ROOF_HALF = 1.3;
const HOUSE_BODY_Y1 = 1.8;
const HOUSE_ROOF_Y1 = 1.96;
/** 방 뒷벽의 높이(문 위 이마 포함) — 소품(≤ 1.9)과 구별한다 */
const BACK_WALL_Y1 = 2.2;
/** 열린 방 뒷벽을 누르면 안쪽 사각형을 이만큼 줄인 사각형 안으로 간다 */
const WALL_INSET = 0.4;
/** 방 문 앞에 선 것으로 보는 거리(문 앞 목적지 1.0 안) — 이 안에서 같은 방을 다시 누르면 방 안으로 들어간다 */
const AT_FRONT = 1.0;

const fx = (v: number): number => v / UNIT;
const rect = (r: { x0: number; z0: number; x1: number; z1: number }, y0: number, y1: number): Box => ({ x0: fx(r.x0), x1: fx(r.x1), z0: fx(r.z0), z1: fx(r.z1), y0, y1 });

const ROOM_BODIES: readonly { room: RoomId; box: Box }[] = ROOM_IDS.map((room) => ({ room, box: rect(TOWN_ROOM_OUTER[room], 0, ROOM_BODY_Y1) }));
const HOUSE_BOXES: readonly { front: { x: number; z: number }; box: Box }[] = TOWN_HOUSES.flatMap((h) => {
  const front = { x: fx(h.front.x), z: fx(h.front.z) };
  const mk = (half: number, y0: number, y1: number): Box => ({ x0: h.x - half, x1: h.x + half, z0: h.z - half, z1: h.z + half, y0, y1 });
  return [
    { front, box: mk(HOUSE_HALF, 0, HOUSE_BODY_Y1) },
    { front, box: mk(HOUSE_ROOF_HALF, HOUSE_BODY_Y1, HOUSE_ROOF_Y1) },
  ];
});
const BACK_WALLS: readonly { room: RoomId; box: Box }[] = ROOM_BOXES.filter((b) => !b.cut && b.y1 >= BACK_WALL_Y1).map((b) => ({ room: b.room, box: b }));
const ROOM_DEF: Readonly<Record<RoomId, (typeof TOWN_ROOMS)[number]>> = Object.fromEntries(TOWN_ROOMS.map((r) => [r.id, r])) as Record<RoomId, (typeof TOWN_ROOMS)[number]>;

/**
 * 화면 광선이 먼저 닿는 건물에 따른 걷기 목적지(월드 단위). 없으면 null — 호출한 쪽이 바닥 교점으로 간다.
 * - 닫힌 방의 지붕·벽: 그 방 front. me 가 이미 front 에서 1.0 안이면 방 안 자리 inside(두 번 눌러 들어간다)
 * - 집 몸통·지붕: 그 집 front
 * - 열린 방의 뒷벽: 맞은 점을 바닥으로 내려 그 방 안쪽 사각형을 0.4 줄인 사각형 안으로 자른 점(벽 바로 안쪽)
 * 후보가 여럿이면 광선 매개변수가 가장 작은(카메라에 가까운) 쪽. me 가 없으면(몸이 아직 없음) 늘 front 다
 */
export function tapTarget(ray: Ray, me: { x: number; z: number } | null, open: ReadonlySet<RoomId>): { x: number; z: number } | null {
  let bestT = Number.POSITIVE_INFINITY;
  let result: { x: number; z: number } | null = null;
  const consider = (t: number | null, pick: (t: number) => { x: number; z: number }): void => {
    if (t === null) return;
    const at = Math.max(t, 0);
    if (at >= bestT) return;
    bestT = at;
    result = pick(at);
  };
  for (const { room, box } of ROOM_BODIES) {
    if (open.has(room)) continue;
    consider(slab(box, ray.origin, ray.dir), () => {
      const def = ROOM_DEF[room];
      const front = { x: fx(def.front.x), z: fx(def.front.z) };
      if (me !== null && (me.x - front.x) * (me.x - front.x) + (me.z - front.z) * (me.z - front.z) <= AT_FRONT * AT_FRONT) return { x: fx(def.inside.x), z: fx(def.inside.z) };
      return front;
    });
  }
  for (const h of HOUSE_BOXES) consider(slab(h.box, ray.origin, ray.dir), () => ({ x: h.front.x, z: h.front.z }));
  for (const { room, box } of BACK_WALLS) {
    if (!open.has(room)) continue;
    consider(slab(box, ray.origin, ray.dir), (t) => {
      const i = ROOM_DEF[room].inner;
      const hx = ray.origin.x + ray.dir.x * t;
      const hz = ray.origin.z + ray.dir.z * t;
      return {
        x: Math.min(Math.max(hx, fx(i.x0) + WALL_INSET), fx(i.x1) - WALL_INSET),
        z: Math.min(Math.max(hz, fx(i.z0) + WALL_INSET), fx(i.z1) - WALL_INSET),
      };
    });
  }
  return result;
}
