// 마을 맵 이동 데이터(20페이즈 D-05~D-08): 방 넷 · 집 여덟 · 장애물 원문 · 48×48 이동 마스크 · 입장 지점 · 장소 8곳 · TOWN_MAP.
// 배치는 승인 시안 사본 design/v3.0/town-map/README.md 의 A 안이다: 가운데는 지금 광장 그대로, 방은 네 변 가운데, 집은 모서리에 둘씩.
// 재즈 바·광장과 같은 규칙으로 만든다 — 시각·난수 없는 순수 모듈이고(삼각함수 없이 사칙연산만), 마스크는 장애물 원문과 시험(test/unit/mapTown.test.ts)으로 묶인다.
// 마스크를 다시 만드는 명령: `MAP_PRINT=1 npx vitest run test/unit/mapTown.test.ts -t 래스터화`
import type { RoomId } from "../protocol";
import { STAGE_SPOT, parseMask } from "./map";
import type { MapDef, Obstacle, PlaceDef, RoomDef, Spawn } from "./map";
import { PLAZA_OBSTACLES, PLAZA_SPAWNS } from "./mapPlaza";

/** 고정소수점(1/100) 사각형. */
interface RectFx {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}
type Side = "n" | "s" | "e" | "w";

/** 벽 두께 0.3 */
const WALL_FX = 30;
/** 문 폭 1.5 의 절반 */
const DOOR_HALF_FX = 75;
/** 방 벽 높이 2.2, 문 위 이마 2.0~2.2, 지붕판 2.2~2.36 (UI-SPEC P20-1) */
const WALL_H = 2.2;
const LINTEL_Y0 = 2.0;
const ROOF_Y1 = 2.36;
/** 집 몸통 2.4×2.4 높이 1.8, 지붕판 2.6×2.6 높이 1.8~1.96 — 머리 꼭대기(2.0335)보다 낮아 머리를 가리지 않는다 (UI-SPEC P20-1) */
const HOUSE_HALF_FX = 120;
const HOUSE_ROOF_HALF_FX = 130;
const HOUSE_H = 1.8;
const HOUSE_ROOF_Y1 = 1.96;

/** 고정소수점 사각형을 회전 없는 장애물로. */
function box(r: RectFx, y0: number, y1: number, floor: boolean, tag: { room?: RoomId; cut?: true } = {}): Obstacle {
  return { kind: "rect", x: (r.x0 + r.x1) / 200, z: (r.z0 + r.z1) / 200, w: (r.x1 - r.x0) / 100, d: (r.z1 - r.z0) / 100, rot: 0, y0, y1, floor, ...tag };
}

/**
 * 방 넷의 바깥 벽(고정소수점)과 문 있는 벽(시안 A): 우체국 북 · 술집 동 · 진료소 남 · 경찰서 서. 문은 광장 쪽 벽 가운데, 폭 1.5.
 * 카메라는 +x·+z 쪽에서 보므로 앞벽은 남·동이다 — 우체국(남)·경찰서(동)는 문 벽이 앞벽이고 술집(서)·진료소(북)는 문 벽이 뒷벽이다(UI-SPEC P20-7).
 */
export const TOWN_ROOM_OUTER: Readonly<Record<RoomId, RectFx & { door: Side }>> = {
  post: { x0: -230, z0: -1000, x1: 230, z1: -660, door: "s" },
  pub: { x0: 660, z0: -230, x1: 1000, z1: 230, door: "w" },
  clinic: { x0: -230, z0: 660, x1: 230, z1: 1000, door: "n" },
  police: { x0: -1000, z0: -230, x1: -660, z1: 230, door: "e" },
};

/**
 * 실내 방 넷(D-06, 고정소수점). inner 는 벽 두께 0.3 을 뺀 안쪽 사각형(약 4.0×2.8), door 는 문 벽 두께의 가운데,
 * front 는 문 중심에서 바깥으로 1.0 에 가장 가까운 걷는 칸 중심(UI-SPEC P20-10), inside 는 안쪽 가운데에서 가장 가까운 걷는 칸 중심이다.
 * front·inside 는 마스크에서 구한 값을 리터럴로 적는다 — 시험이 정의식(정수 제곱거리 → 행 → 열 순)과 대조한다.
 */
export const TOWN_ROOMS: readonly RoomDef[] = [
  { id: "post", inner: { x0: -200, z0: -970, x1: 200, z1: -690 }, door: { x: 0, z: -675 }, front: { x: -25, z: -575 }, inside: { x: -25, z: -825 } },
  { id: "pub", inner: { x0: 690, z0: -200, x1: 970, z1: 200 }, door: { x: 675, z: 0 }, front: { x: 575, z: -25 }, inside: { x: 825, z: -25 } },
  { id: "clinic", inner: { x0: -200, z0: 690, x1: 200, z1: 970 }, door: { x: 0, z: 675 }, front: { x: -25, z: 575 }, inside: { x: -25, z: 825 } },
  { id: "police", inner: { x0: -970, z0: -200, x1: -690, z1: 200 }, door: { x: -675, z: 0 }, front: { x: -575, z: -25 }, inside: { x: -825, z: -25 } },
];

/** 집 한 채(좌석 n 의 집, D-07). 들어갈 수 없다(몸통 전체가 장애물). x·z 는 중심(월드 단위), face 는 문 있는 면(광장 쪽), front 는 문 앞 목적지(고정소수점). */
export interface HouseDef {
  seat: number;
  x: number;
  z: number;
  face: Side;
  front: { x: number; z: number };
}

/**
 * 집 여덟(D-07): 북서 모서리부터 시계 방향으로 좌석 0~7. 문 있는 면은 광장 쪽(0·1 남, 2·3 서, 4·5 북, 6·7 동).
 * front 는 문 있는 면 가운데에서 바깥으로 1.0 에 가장 가까운 걷는 칸 중심(리터럴, 시험이 정의식과 대조) — 21페이즈의 집 앞 조사 자리다.
 * 좌석 0·7 의 집은 문 바로 앞이 시계탑(높이 5.8) 뒤라 머리가 가려지는 칸이어서, 문 앞 자리가 문에서 약 1.3 떨어진 집 모서리 쪽 칸이다.
 */
export const TOWN_HOUSES: readonly HouseDef[] = [
  { seat: 0, x: -5.0, z: -8.4, face: "s", front: { x: -375, z: -675 } },
  { seat: 1, x: 5.0, z: -8.4, face: "s", front: { x: 475, z: -625 } },
  { seat: 2, x: 8.4, z: -5.0, face: "w", front: { x: 625, z: -525 } },
  { seat: 3, x: 8.4, z: 5.0, face: "w", front: { x: 625, z: 475 } },
  { seat: 4, x: 5.0, z: 8.4, face: "n", front: { x: 475, z: 625 } },
  { seat: 5, x: -5.0, z: 8.4, face: "n", front: { x: -525, z: 625 } },
  { seat: 6, x: -8.4, z: 5.0, face: "e", front: { x: -625, z: 475 } },
  { seat: 7, x: -8.4, z: -5.0, face: "e", front: { x: -675, z: -375 } },
];

/**
 * 방 하나의 벽·문 위 이마·지붕. 북·남 벽은 바깥 폭 전체, 서·동 벽은 그 사이를 채운다. 문 벽은 문(중심 ±0.75) 양옆 두 조각과 이마(바닥을 막지 않음)로 나뉜다.
 * 컷어웨이(cut) = 지붕 + 앞벽(남·동)과 그 벽의 이마 — 방 안에서는 걷히므로 그 방 안 칸의 머리 가림 시험에서 뺀다.
 */
function roomShell(id: RoomId): Obstacle[] {
  const o = TOWN_ROOM_OUTER[id];
  const midX = (o.x0 + o.x1) / 2;
  const midZ = (o.z0 + o.z1) / 2;
  const walls: Record<Side, RectFx> = {
    n: { x0: o.x0, z0: o.z0, x1: o.x1, z1: o.z0 + WALL_FX },
    s: { x0: o.x0, z0: o.z1 - WALL_FX, x1: o.x1, z1: o.z1 },
    w: { x0: o.x0, z0: o.z0 + WALL_FX, x1: o.x0 + WALL_FX, z1: o.z1 - WALL_FX },
    e: { x0: o.x1 - WALL_FX, z0: o.z0 + WALL_FX, x1: o.x1, z1: o.z1 - WALL_FX },
  };
  const out: Obstacle[] = [];
  for (const side of ["n", "s", "w", "e"] as const) {
    const w = walls[side];
    const tag: { room: RoomId; cut?: true } = side === "s" || side === "e" ? { room: id, cut: true } : { room: id };
    if (side !== o.door) {
      out.push(box(w, 0, WALL_H, true, tag));
    } else if (side === "n" || side === "s") {
      out.push(box({ ...w, x1: midX - DOOR_HALF_FX }, 0, WALL_H, true, tag));
      out.push(box({ ...w, x0: midX + DOOR_HALF_FX }, 0, WALL_H, true, tag));
      out.push(box({ ...w, x0: midX - DOOR_HALF_FX, x1: midX + DOOR_HALF_FX }, LINTEL_Y0, WALL_H, false, tag));
    } else {
      out.push(box({ ...w, z1: midZ - DOOR_HALF_FX }, 0, WALL_H, true, tag));
      out.push(box({ ...w, z0: midZ + DOOR_HALF_FX }, 0, WALL_H, true, tag));
      out.push(box({ ...w, z0: midZ - DOOR_HALF_FX, z1: midZ + DOOR_HALF_FX }, LINTEL_Y0, WALL_H, false, tag));
    }
  }
  out.push(box(o, WALL_H, ROOF_Y1, false, { room: id, cut: true }));
  return out;
}

/**
 * 방 소품(UI-SPEC 치수표 B·P20-19): 뒷벽(북·서) 쪽 한 줄(깊이 ≤ 0.5)에만 두고 높이 ≤ 1.2, 벽 걸이는 바닥을 막지 않고 높이 ≥ 1.2 다.
 * 순서: 우체국 분류함 · 소포 상자 둘 / 술집 바 카운터 · 술병 선반(걸이) / 진료소 침상 · 약장 / 경찰서 책상 · 게시판(걸이).
 */
export const TOWN_PROPS: readonly Obstacle[] = [
  box({ x0: -100, z0: -970, x1: 100, z1: -930 }, 0, 1.1, true, { room: "post" }),
  box({ x0: -200, z0: -920, x1: -150, z1: -870 }, 0, 0.5, true, { room: "post" }),
  box({ x0: -200, z0: -860, x1: -150, z1: -810 }, 0, 0.5, true, { room: "post" }),
  box({ x0: 710, z0: -200, x1: 950, z1: -150 }, 0, 1.0, true, { room: "pub" }),
  box({ x0: 730, z0: -200, x1: 930, z1: -185 }, 1.3, 1.7, false, { room: "pub" }),
  box({ x0: -200, z0: 760, x1: -150, z1: 940 }, 0, 0.5, true, { room: "clinic" }),
  box({ x0: -200, z0: 690, x1: -100, z1: 730 }, 0, 1.1, true, { room: "clinic" }),
  box({ x0: -970, z0: -80, x1: -920, z1: 80 }, 0, 0.8, true, { room: "police" }),
  box({ x0: -900, z0: -200, x1: -760, z1: -192 }, 1.2, 1.9, false, { room: "police" }),
];

/** 집 한 채의 몸통(바닥을 막는다)과 지붕판(둘레 0.1 내민다, 바닥을 막지 않는다). */
function houseShell(h: HouseDef): Obstacle[] {
  const cx = Math.round(h.x * 100);
  const cz = Math.round(h.z * 100);
  return [
    box({ x0: cx - HOUSE_HALF_FX, z0: cz - HOUSE_HALF_FX, x1: cx + HOUSE_HALF_FX, z1: cz + HOUSE_HALF_FX }, 0, HOUSE_H, true),
    box({ x0: cx - HOUSE_ROOF_HALF_FX, z0: cz - HOUSE_ROOF_HALF_FX, x1: cx + HOUSE_ROOF_HALF_FX, z1: cz + HOUSE_ROOF_HALF_FX }, HOUSE_H, HOUSE_ROOF_Y1, false),
  ];
}

/**
 * 마을 장애물 원문 = 광장 원문 그대로 + 방 넷(벽·이마·지붕) + 방 소품 + 집 여덟(몸통·지붕판). 새로 더한 것은 모두 회전 없는 사각형이다.
 * 지붕 위 간판 판·집 지붕 표식·문패는 얇은 장식이라 넣지 않는다(걷기·머리 가림과 무관).
 */
export const TOWN_OBSTACLES: readonly Obstacle[] = [
  ...PLAZA_OBSTACLES,
  ...roomShell("post"),
  ...roomShell("pub"),
  ...roomShell("clinic"),
  ...roomShell("police"),
  ...TOWN_PROPS,
  ...TOWN_HOUSES.flatMap(houseShell),
];

/**
 * 문 앞 칸 면제(UI-SPEC P20-10, 월드 단위): 문 중심에서 바깥으로 깊이 1.0 × 폭 1.5 와 문 벽 두께. 마스크를 만들 때 이 안의 칸은
 * "머리가 가려진다" 시험에서만 뺀다(문 위 이마·지붕이 문턱의 머리를 덮는다) — 바닥 막힘은 그대로다. 서버 판정에는 쓰지 않는다.
 */
export const TOWN_DOOR_EXEMPT: Readonly<Record<RoomId, { x0: number; z0: number; x1: number; z1: number }>> = {
  post: { x0: -0.75, z0: -6.9, x1: 0.75, z1: -5.75 },
  pub: { x0: 5.75, z0: -0.75, x1: 6.9, z1: 0.75 },
  clinic: { x0: -0.75, z0: 5.75, x1: 0.75, z1: 6.9 },
  police: { x0: -6.9, z0: -0.75, x1: -5.75, z1: 0.75 },
};

/** 입장 지점 8곳 = 광장 그대로(D-08, 연단 둘레). */
export const TOWN_SPAWNS: readonly Spawn[] = PLAZA_SPAWNS;

/**
 * 마을 심부름 장소 8곳(D-08): 방 안 넷 + 광장 넷. 새 장소 id·그림을 만들지 않고 기존 PLACE_IDS 를 다시 쓴다(UI-SPEC P20-20).
 * 방 안 넷은 우체국 mail · 술집 glass · 진료소 flower · 경찰서 poster — 그 방의 걷는 칸 중심이고 소품에서 한 칸(0.5) 이상 떨어져 있다.
 * 광장 넷(clock·bench·tree·fountain)은 PLAZA_PLACES 좌표 그대로다. 서로 2.0 이상(시험이 지킨다).
 */
export const TOWN_PLACES: readonly PlaceDef[] = [
  { id: "mail", x: 0.75, z: -8.75 },
  { id: "glass", x: 8.75, z: -0.75 },
  { id: "flower", x: 0.75, z: 8.75 },
  { id: "poster", x: -7.75, z: -1.25 },
  { id: "clock", x: -2.4, z: -2.6 },
  { id: "bench", x: 4.6, z: -2.2 },
  { id: "tree", x: -4.6, z: 2.8 },
  { id: "fountain", x: 1.6, z: 1.6 },
];

/**
 * 마을 이동 마스크 48×48: '.' 걷기 · '#' 막힘. 줄 = z −11.75 → 11.75, 글자 = x −11.75 → 11.75 (칸 0.5, 원점 −12, 바깥 판 ±12).
 * 재즈 바·광장과 같은 규칙으로 TOWN_OBSTACLES 에서 만든다: 칸 중심이 바닥 장애물을 캐릭터 반지름 0.35 만큼 부풀린 곳, |x|·|z| > 10(이동 한계),
 * 머리 꼭대기(y 2.0335)에서 카메라 쪽 평행 광선이 장애물에 막히는 자리(문 앞 면제 칸은 빼고, 방 안 칸은 그 방의 지붕·앞벽을 빼고), 입장 지점에서 닿지 않는 닫힌 구멍이면 '#'.
 * 바꾸려면 위 표를 고치고 머리 주석의 명령 출력으로 다시 만든다 — test/unit/mapTown.test.ts 가 이 글자들과 래스터화가 같음을 지킨다.
 * 걷는 칸 943개. 북서 모서리 마당은 시계탑 뒤라 머리가 가려지고, 남은 가장자리 13칸(x −9.75 줄·z −9.75 줄)은 닿을 수 없어 메웠다. 나머지 세 모서리 마당은 열려 있다.
 */
export const TOWN_MASK: readonly string[] = [
  "################################################",
  "################################################",
  "################################################",
  "################################################",
  "#################..##########..######.......####",
  "#################..##########..######.......####",
  "#################..###.....##..######.......####",
  "#################..###.....##..######.......####",
  "#################..##......##..######.......####",
  "#################..##......##..######.......####",
  "################...####..####...............####",
  "#################.....................##########",
  "###################...................##########",
  "###################............###....##########",
  "###################............###....##########",
  "###################.....#......###....##########",
  "##########.########......##....####...##########",
  "####........#######............####.........####",
  "####........######.............#............####",
  "###########....................#.....###########",
  "###########..........................###########",
  "#####.....#...........####...........###########",
  "######....#..........######..........#.....#####",
  "######...............######................#####",
  "######.........#.....######................#####",
  "######....#.....#....######..........#.....#####",
  "#####.....#.....#.....####...........#.....#####",
  "###########..........................###########",
  "###########..........................###########",
  "####........................................####",
  "####........................................####",
  "##########...#######..................##########",
  "##########...#####....................##########",
  "##########...#####....................##########",
  "##########......##....................##########",
  "##########............................##########",
  "##########............................##########",
  "####...............####..####...............####",
  "####.......######..####....##..######.......####",
  "####.......######..###.....##..######.......####",
  "####.......######..###.....##..######.......####",
  "####.......######..###.....##..######.......####",
  "####.......######..###.....##..######.......####",
  "####.......######..##########..######.......####",
  "################################################",
  "################################################",
  "################################################",
  "################################################",
];

/** 마을 이동 맵(UI-SPEC P20-0): 48×48 · 칸 0.5 · 원점 −12 · 걷기 한계 ±10. 무대 자리는 광장 연단 그대로다. */
export const TOWN_MAP: MapDef = { id: "town", size: 48, origin: -12, walkHalf: 10, mask: parseMask(TOWN_MASK), spawns: TOWN_SPAWNS, stage: STAGE_SPOT, places: TOWN_PLACES, rooms: TOWN_ROOMS };
