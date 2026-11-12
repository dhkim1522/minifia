// 마을 장면(maps/town.ts, 20페이즈 D-05~D-10·D-20·D-21). 생김새의 기준은 승인 시안 사본 design/v3.0/town-map/ 의 A 안(README·Main·Cutaway)이다.
// 가운데는 광장 빌더(buildPlaza)를 선택 인자로 다시 불러 그대로 쓰고(연단·시계탑·벤치·나무·가로등·단계 조명 7칸 — 복사 없음),
// 그 위에 방 넷과 집 여덟을 장면 조각 하나로 덧붙인다. 방·집의 자리와 벽·문·소품은 서버와 같은 표(shared/game/mapTown.ts)에서 읽는다 — 좌표를 두 벌 두지 않는다.
// 밖에서는 지붕과 간판 그림뿐이라 안을 알 수 없고, 들어가면 지붕·앞벽이 걷힌다. 언제 걷을지는 런타임(20-05)이 정하고 이 파일은 재질만 따라간다.
// three 를 값으로 쓰므로 정적 import 경로에 두지 않는다. WebGL 없이 node 에서 만들어지고 검사된다(아틀라스는 1×1 텍스처로 대신한다).
// 3D 안에 글을 쓰지 않는다(결정 0051). 점광원을 더하지 않는다(3개 그대로) — 방 등·집 창은 재질 색 배율(TOWN_LIT)이다.
//
// 그리기 단위(광장 것에 더하는 메시, 모두 병합 — 건물은 그림자를 받기만 하고 드리우지 않는다, P20-14):
//   1 roomStatic(방 넷의 뒷벽·뒷벽에 난 문의 벽 조각과 이마·실내 바닥 널, 광장 소품 재질)  2 roomProps(방 소품, 같은 재질)
//   3 cut-{post|pub|clinic|police}(방마다 지붕판·가장자리 띠·앞벽 둘과 앞벽에 난 문의 벽 조각·이마 — 방마다 자기 재질, 불투명도 조절)
//   4 sign-{방}(방마다 지붕 위 간판 판 + 기둥, 아틀라스 텍스처를 나눠 쓰는 자기 재질 — 그 방 컷과 같은 불투명도)
//   5 emissiveIndoor(벽등 구 넷·문턱 띠 넷, TOWN_LIT.indoor)  6 glowIndoor(벽등 빛 무리 넷, 같은 열)
//   7 houseBody(집 여덟의 몸·지붕판·문 칸, 광장 소품 재질)  8 houseWinLit(주인 있는 집의 창, TOWN_LIT.houseOwned)·houseWinDark(주인 없는 집의 창)
//   9 housePlate(문 위 문패 여덟)·houseMark(지붕 위 표식 여덟 + 기둥) — 아틀라스 재질 하나.
// 강등 사다리 4단계(props reduced)는 2·4·houseMark 를 끈다(몸통·문패·창은 남는다). 그 밖의 사다리는 광장 그대로다.
import { BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, DataTexture, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, RGBAFormat, SRGBColorSpace } from "three";
import type { Texture } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TOWN_HOUSES, TOWN_OBSTACLES, TOWN_PROPS, TOWN_ROOM_OUTER, TOWN_ROOMS } from "../../../shared/game/mapTown";
import { ROOM_IDS } from "../../../shared/protocol";
import type { RoomId } from "../../../shared/protocol";
import { plateFarOf } from "../camera";
import { PLAZA_PALETTE, SEAT_COLORS, TOWN_LIT, TOWN_PALETTE as C } from "../palette";
import type { Budget, LightingPhase } from "../renderer";
import { Bundle, tf } from "./bar";
import { buildPlaza } from "./plaza";
import type { PlazaPiece, PlazaPieceCtx } from "./plaza";
import type { MapScene } from "./types";

// ---------- 치수(UI-SPEC 치수표 B·C. 자리는 mapTown 의 표가 원천이고 여기에는 생김새 치수만 둔다) ----------
/** 방 벽 꼭대기 = 지붕판 아랫면. mapTown 의 방 장애물 중 이 높이에서 시작하는 것이 지붕판이다 */
const WALL_TOP = 2.2;
/** 지붕 가장자리 띠 폭 */
const ROOF_EDGE = 0.1;
/** 실내 바닥 널: 바닥 판(윗면 −0.01) 위 0.02, 널 폭 약 0.4 */
const FLOOR_H = 0.02;
const FLOOR_TOP = 0.01;
const PLANK = 0.4;
/** 문 폭 1.5 의 절반 */
const DOOR_HALF = 0.75;
/** 벽등: 뒷벽 안쪽 면에서 0.1, 높이 1.5, 구 반지름 0.12, 빛 무리 쿼드 2.0 */
const LAMP_Y = 1.5;
const LAMP_R = 0.12;
const LAMP_GLOW = 2.0;
/** 문턱 띠: 문 폭 × 깊이 0.12, 문 바깥 모서리. 광장 자갈(윗면 0.08) 위에 놓인다 */
const SILL_D = 0.12;
const SILL_Y = 0.09;
/** 방 간판(P20-4): 지붕 위 기둥 0.3 위에 서는 1.2×1.2 판 */
const SIGN = 1.2;
const SIGN_POST = 0.3;
/** 집(치수표 C): 몸 2.4×2.4×1.8, 지붕판 2.6×2.6×0.16(꼭대기 1.96), 문 칸 0.7×1.2, 창 0.4×0.5 */
const HOUSE_HALF = 1.2;
const HOUSE_H = 1.8;
const HOUSE_ROOF = 2.6;
const HOUSE_ROOF_H = 0.16;
const HOUSE_TOP = HOUSE_H + HOUSE_ROOF_H;
/** 집 문패(P20-6): 문 위 벽에 붙는 0.5×0.5 — 지붕판 처마(1.8~1.96, 0.1 내밈) 아래에 들어가게 가운데 높이 1.5(1.25~1.75) */
const PLAQUE = 0.5;
const PLAQUE_Y = 1.5;
/** 집 지붕 표식(P20-6): 기둥 0.25 위에 서는 0.9×0.9 판 */
const MARK = 0.9;
const MARK_POST = 0.25;

type Side = "n" | "s" | "e" | "w";
/** 면의 바깥 법선(x, z)과 그 면을 보는 판의 rotation.y */
const FACE: Readonly<Record<Side, { nx: number; nz: number; ry: number }>> = {
  s: { nx: 0, nz: 1, ry: 0 },
  e: { nx: 1, nz: 0, ry: Math.PI / 2 },
  n: { nx: 0, nz: -1, ry: Math.PI },
  w: { nx: -1, nz: 0, ry: -Math.PI / 2 },
};
/**
 * 벽등 자리(방마다 하나, 뒷벽 = 북·서): 걸이 소품과 겹치지 않는 뒷벽 가운데. 술집은 북벽에 술병 선반이 걸려 있고 서벽 가운데가 문이라
 * 서벽의 문 옆(남쪽 조각 가운데)에 단다.
 */
const LAMP_AT: Readonly<Record<RoomId, { wall: "n" | "w"; besideDoor: boolean }>> = {
  post: { wall: "n", besideDoor: false },
  pub: { wall: "w", besideDoor: true },
  clinic: { wall: "w", besideDoor: false },
  police: { wall: "w", besideDoor: false },
};

// ---------- 아틀라스(간판 4 + 좌석 8 + 빈 판 1, 한 장) ----------
/** 아틀라스 칸 배치. 간판은 ROOM_IDS 순서, 좌석 n 은 seat0 + n, 주인 없는 집은 blank */
export const TOWN_ATLAS = { cols: 4, rows: 4, cellPx: 256, sign: { post: 0, pub: 1, clinic: 2, police: 3 } as Readonly<Record<RoomId, number>>, seat0: 4, blank: 12 } as const;
/** 칸 가장자리 안쪽으로 들이는 UV(밉맵에서 옆 칸이 번지지 않게) */
const UV_INSET = 2 / (TOWN_ATLAS.cols * TOWN_ATLAS.cellPx);

/** 칸의 UV 사각형. 캔버스는 위에서 아래로 그리고 텍스처는 뒤집혀 올라가므로 v 는 위 줄이 크다 */
export function atlasUv(cell: number): { u0: number; v0: number; u1: number; v1: number } {
  const col = cell % TOWN_ATLAS.cols;
  const row = Math.floor(cell / TOWN_ATLAS.cols);
  return {
    u0: col / TOWN_ATLAS.cols + UV_INSET,
    u1: (col + 1) / TOWN_ATLAS.cols - UV_INSET,
    v0: 1 - (row + 1) / TOWN_ATLAS.rows + UV_INSET,
    v1: 1 - row / TOWN_ATLAS.rows - UV_INSET,
  };
}
/** UV 한 점이 가리키는 칸(시험·검사용) */
export function atlasCellAt(u: number, v: number): number {
  return Math.floor((1 - v) * TOWN_ATLAS.rows) * TOWN_ATLAS.cols + Math.floor(u * TOWN_ATLAS.cols);
}

/** 간판 그림(UI-SPEC 치수표 D, 24 격자 경로). 봉투의 사각(x5 y7 폭 14 높이 11 모서리 2)은 같은 모양의 경로로 적는다. 방패는 V2Icon shield 와 같다 */
const SIGN_PATHS: Readonly<Record<RoomId, readonly string[]>> = {
  post: ["M7 7h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z", "M5 9l7 5 7-5"],
  pub: ["M5 5h14l-7 8z", "M12 13v6", "M8 19h8"],
  clinic: ["M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"],
  police: ["M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z", "M12 9v6", "M9 12h6"],
};
/** 간판 그림이 판에서 차지하는 비율(24 격자를 칸의 0.8 로) */
const SIGN_FILL = 0.8;

/** 아틀라스 그리기 함수가 쓰는 캔버스 2D 문맥의 부분. 시험이 흉내 객체로 부를 수 있게 인자로 받는다 */
export type AtlasCtx = Pick<
  CanvasRenderingContext2D,
  "save" | "restore" | "beginPath" | "closePath" | "moveTo" | "arcTo" | "arc" | "fill" | "stroke" | "clip" | "clearRect" | "fillRect" | "drawImage" | "translate" | "scale" | "fillStyle" | "strokeStyle" | "lineWidth" | "lineCap" | "lineJoin"
>;
const cellRect = (cell: number): { x: number; y: number; s: number } => ({ x: (cell % TOWN_ATLAS.cols) * TOWN_ATLAS.cellPx, y: Math.floor(cell / TOWN_ATLAS.cols) * TOWN_ATLAS.cellPx, s: TOWN_ATLAS.cellPx });
const seatIndex = (seat: number): number => ((seat % 8) + 8) % 8;

/** 방 간판 칸: 어두운 판 바탕 위에 램프 금빛 선 그림(선 1.8·둥근 끝). 글자는 쓰지 않는다 */
export function drawSignCell(ctx: AtlasCtx, cell: number, room: RoomId): void {
  const { x, y, s } = cellRect(cell);
  const k = (s * SIGN_FILL) / 24;
  ctx.save();
  ctx.fillStyle = C.plate;
  ctx.fillRect(x, y, s, s);
  ctx.translate(x + (s - 24 * k) / 2, y + (s - 24 * k) / 2);
  ctx.scale(k, k);
  ctx.strokeStyle = C.sign;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const d of SIGN_PATHS[room]) ctx.stroke(new Path2D(d));
  ctx.restore();
}

/** 주인 없는 집의 빈 판: 어두운 판 + 윤곽만 */
export function drawBlankCell(ctx: AtlasCtx, cell: number): void {
  const { x, y, s } = cellRect(cell);
  const m = s * 0.06;
  const r = s * 0.12;
  const x0 = x + m;
  const y0 = y + m;
  const x1 = x + s - m;
  const y1 = y + s - m;
  ctx.save();
  ctx.clearRect(x, y, s, s);
  ctx.beginPath();
  ctx.moveTo(x0 + r, y0);
  ctx.arcTo(x1, y0, x1, y1, r);
  ctx.arcTo(x1, y1, x0, y1, r);
  ctx.arcTo(x0, y1, x0, y0, r);
  ctx.arcTo(x0, y0, x1, y0, r);
  ctx.closePath();
  ctx.fillStyle = C.plate;
  ctx.fill();
  ctx.strokeStyle = C.roomEdge;
  ctx.lineWidth = s * 0.04;
  ctx.stroke();
  ctx.restore();
}

/** 좌석 칸: 좌석 색 원(얼굴 그림을 얹는 것은 Task 2) */
function drawSeatCell(ctx: AtlasCtx, cell: number, seat: number): void {
  const { x, y, s } = cellRect(cell);
  const r = s / 2 - s * 0.03;
  ctx.save();
  ctx.clearRect(x, y, s, s);
  ctx.beginPath();
  ctx.arc(x + s / 2, y + s / 2, r, 0, Math.PI * 2);
  ctx.fillStyle = SEAT_COLORS[seatIndex(seat)]!;
  ctx.fill();
  ctx.restore();
}

interface Atlas {
  texture: Texture;
  dispose(): void;
}

function canvas2d(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === "undefined" || typeof Path2D === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = TOWN_ATLAS.cols * TOWN_ATLAS.cellPx;
    canvas.height = TOWN_ATLAS.rows * TOWN_ATLAS.cellPx;
    const ctx = canvas.getContext("2d");
    return ctx ? { canvas, ctx } : null;
  } catch {
    return null;
  }
}

/**
 * 아틀라스 한 장. 브라우저에서는 캔버스 2D 로 그린다. 캔버스가 없는 환경(node 시험)에서는 판 바탕색 1×1 텍스처로 대신하고 UV·메시 구성은 같다.
 * 얼굴은 같은 출처의 정적 파일(faceSrc)만 읽는다 — 바깥 주소가 없다(T-20-16).
 */
function makeAtlas(): Atlas {
  const c = canvas2d();
  if (c === null) {
    const texture = new DataTexture(new Uint8Array([0x0e, 0x13, 0x26, 255]), 1, 1, RGBAFormat);
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    return { texture, dispose: () => texture.dispose() };
  }
  const { canvas, ctx } = c;
  for (const id of ROOM_IDS) drawSignCell(ctx, TOWN_ATLAS.sign[id], id);
  for (let n = 0; n < 8; n++) drawSeatCell(ctx, TOWN_ATLAS.seat0 + n, n);
  drawBlankCell(ctx, TOWN_ATLAS.blank);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return { texture, dispose: () => texture.dispose() };
}

// ---------- 아틀라스 판 지오메트리 ----------
/** PlaneGeometry 의 정점 순서(왼위·오른위·왼아래·오른아래)에 맞춘 단위 UV */
const QUAD_UV: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 1],
  [0, 0],
  [1, 0],
];
/** 병합 지오메트리의 quad 번째 판(정점 4개)이 cell 칸을 가리키게 UV 를 쓴다 */
function setCellUv(uv: BufferAttribute, quad: number, cell: number): void {
  const { u0, v0, u1, v1 } = atlasUv(cell);
  QUAD_UV.forEach(([bu, bv], k) => uv.setXY(quad * 4 + k, u0 + (u1 - u0) * bu, v0 + (v1 - v0) * bv));
  uv.needsUpdate = true;
}
function atlasQuad(w: number, h: number, m: Matrix4, cell: number): BufferGeometry {
  const g = new PlaneGeometry(w, h);
  setCellUv(g.getAttribute("uv") as BufferAttribute, 0, cell);
  return g.applyMatrix4(m);
}
/** 기둥: 모든 정점이 빈 판 칸 가운데(어두운 판 색)를 가리킨다 */
function atlasPost(w: number, h: number, x: number, y: number, z: number): BufferGeometry {
  const g = new BoxGeometry(w, h, w);
  const uv = g.getAttribute("uv") as BufferAttribute;
  const { u0, v0, u1, v1 } = atlasUv(TOWN_ATLAS.blank);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (u0 + u1) / 2, (v0 + v1) / 2);
  return g.applyMatrix4(tf(x, y + h / 2, z));
}
function merged(parts: BufferGeometry[], name: string): BufferGeometry {
  const geo = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!geo) throw new Error(`병합 실패: ${name}`);
  return geo;
}

interface CutState {
  /** 지금 불투명도(1 = 덮임, 0 = 걷힘)와 목표 */
  alpha: number;
  want: number;
  mesh: Mesh;
  sign: Mesh;
  mats: readonly MeshStandardMaterial[];
}

/** 방 넷·집 여덟을 광장 빌더에 덧붙이는 장면 조각 */
function townPiece(ctx: PlazaPieceCtx): PlazaPiece {
  const { matProp, facing, up, glow } = ctx;
  const atlas = makeAtlas();
  // 문패·지붕 표식: 원·둥근 판 밖은 알파 시험으로 잘라 낸다(투명 합성 없음)
  const matAtlas = new MeshStandardMaterial({ map: atlas.texture, roughness: 0.85, metalness: 0, alphaTest: 0.5 });
  const matEmIndoor = new MeshBasicMaterial({ vertexColors: true });
  const matEmHouse = new MeshBasicMaterial({ vertexColors: true });
  const matGlowIndoor = ctx.glowMat();

  const roomStatic = new Bundle();
  const roomProps = new Bundle();
  const emIndoor = new Bundle();
  const glowIndoor = new Bundle(true);
  const houseBody = new Bundle();
  const meshes: Record<string, Mesh> = {};
  const cuts = {} as Record<RoomId, CutState>;

  // ----- 방 넷 -----
  for (const room of TOWN_ROOMS) {
    const id = room.id;
    const outer = TOWN_ROOM_OUTER[id];
    const ox0 = outer.x0 / 100;
    const ox1 = outer.x1 / 100;
    const oz0 = outer.z0 / 100;
    const oz1 = outer.z1 / 100;
    const cx = (ox0 + ox1) / 2;
    const cz = (oz0 + oz1) / 2;
    let roofTop = WALL_TOP;

    // 벽·이마·지붕·소품: 서버의 장애물 원문을 그대로 상자로 세운다. cut 표시(지붕·남벽·동벽과 그 이마)가 걷히는 덩어리다
    const cut = new Bundle();
    for (const o of TOWN_OBSTACLES) {
      if (o.room !== id || o.kind !== "rect") continue;
      const h = o.y1 - o.y0;
      const at = tf(o.x, (o.y0 + o.y1) / 2, o.z);
      if (TOWN_PROPS.includes(o)) roomProps.box(o.w, h, o.d, C.prop, at);
      else if (!o.cut) roomStatic.box(o.w, h, o.d, C.roomWall, at);
      else if (o.y0 < WALL_TOP) cut.box(o.w, h, o.d, C.roomWall, at);
      else {
        // 지붕판: 안쪽 판 + 둘레 띠 넷(같은 두께라 꼭대기가 그대로다)
        roofTop = o.y1;
        cut.box(o.w - ROOF_EDGE * 2, h, o.d - ROOF_EDGE * 2, C.roomRoof, at);
        for (const s of [-1, 1]) {
          cut.box(o.w, h, ROOF_EDGE, C.roomEdge, tf(o.x, (o.y0 + o.y1) / 2, o.z + s * (o.d / 2 - ROOF_EDGE / 2)));
          cut.box(ROOF_EDGE, h, o.d - ROOF_EDGE * 2, C.roomEdge, tf(o.x + s * (o.w / 2 - ROOF_EDGE / 2), (o.y0 + o.y1) / 2, o.z));
        }
      }
    }

    // 실내 바닥 널: 긴 변을 따라 두 색을 번갈아 깐다
    const ix0 = room.inner.x0 / 100;
    const ix1 = room.inner.x1 / 100;
    const iz0 = room.inner.z0 / 100;
    const iz1 = room.inner.z1 / 100;
    const iw = ix1 - ix0;
    const id2 = iz1 - iz0;
    const alongX = iw >= id2;
    const planks = Math.round((alongX ? id2 : iw) / PLANK);
    const pw = (alongX ? id2 : iw) / planks;
    for (let i = 0; i < planks; i++) {
      const hex = i % 2 === 0 ? C.floorA : C.floorB;
      if (alongX) roomStatic.box(iw, FLOOR_H, pw, hex, tf((ix0 + ix1) / 2, FLOOR_TOP - FLOOR_H / 2, iz0 + pw * (i + 0.5)));
      else roomStatic.box(pw, FLOOR_H, id2, hex, tf(ix0 + pw * (i + 0.5), FLOOR_TOP - FLOOR_H / 2, (iz0 + iz1) / 2));
    }

    // 벽등 하나(구 + 빛 무리)와 문턱 띠: 발광 재질 색 배율로만 밝기가 바뀐다
    const lamp = LAMP_AT[id];
    const side = lamp.besideDoor ? (DOOR_HALF + (lamp.wall === "n" ? iw : id2) / 2) / 2 : 0;
    const lx = lamp.wall === "n" ? (ix0 + ix1) / 2 + side : ix0 + 0.1;
    const lz = lamp.wall === "n" ? iz0 + 0.1 : (iz0 + iz1) / 2 + side;
    emIndoor.sph(LAMP_R, PLAZA_PALETTE.lampBulb, tf(lx, LAMP_Y, lz), 1.5);
    glow(glowIndoor, PLAZA_PALETTE.lampBulb, LAMP_GLOW, lx, LAMP_Y, lz, 0.7);
    const f = FACE[outer.door];
    // 문 벽의 바깥 면에서 바깥으로 SILL_D
    const edgeX = f.nx > 0 ? ox1 : f.nx < 0 ? ox0 : cx;
    const edgeZ = f.nz > 0 ? oz1 : f.nz < 0 ? oz0 : cz;
    emIndoor.box(f.nx === 0 ? DOOR_HALF * 2 : SILL_D, 0.02, f.nz === 0 ? DOOR_HALF * 2 : SILL_D, C.sign, tf(edgeX + (f.nx * SILL_D) / 2, SILL_Y, edgeZ + (f.nz * SILL_D) / 2));

    // 컷 메시(방마다 자기 재질)와 간판(지붕 가운데 기둥 위, 정지 카메라를 보는 판 — 아랫변이 기둥 꼭대기에 닿는다)
    const matCut = matProp.clone();
    const mesh = cut.build(matCut, `cut-${id}`);
    mesh.receiveShadow = true;
    const matSign = new MeshStandardMaterial({ map: atlas.texture, roughness: 0.85, metalness: 0 });
    const plate = atlasQuad(SIGN, SIGN, facing.clone().setPosition(cx + (up.x * SIGN) / 2, roofTop + SIGN_POST + (up.y * SIGN) / 2, cz + (up.z * SIGN) / 2), TOWN_ATLAS.sign[id]);
    const sign = new Mesh(merged([plate, atlasPost(0.06, SIGN_POST, cx, roofTop, cz)], `sign-${id}`), matSign);
    sign.name = `sign-${id}`;
    meshes[mesh.name] = mesh;
    meshes[sign.name] = sign;
    cuts[id] = { alpha: 1, want: 1, mesh, sign, mats: [matCut, matSign] };
  }

  // ----- 집 여덟 -----
  const plates: BufferGeometry[] = [];
  const marks: BufferGeometry[] = [];
  const markPosts: BufferGeometry[] = [];
  /** 집마다 창 8칸의 자리(면마다 둘, 문 있는 면은 문 양옆) */
  const windows: Matrix4[][] = [];
  for (const h of TOWN_HOUSES) {
    houseBody.box(HOUSE_HALF * 2, HOUSE_H, HOUSE_HALF * 2, C.houseWall, tf(h.x, HOUSE_H / 2, h.z));
    houseBody.box(HOUSE_ROOF, HOUSE_ROOF_H, HOUSE_ROOF, C.houseRoof, tf(h.x, HOUSE_H + HOUSE_ROOF_H / 2, h.z));
    const door = FACE[h.face];
    // 문은 그림으로만: 문 있는 면 가운데 바닥에서 서는 어두운 칸
    houseBody.add(new PlaneGeometry(0.7, 1.2), C.paneDark, tf(h.x + door.nx * (HOUSE_HALF + 0.01), 0.6, h.z + door.nz * (HOUSE_HALF + 0.01), 0, door.ry, 0));
    plates.push(atlasQuad(PLAQUE, PLAQUE, tf(h.x + door.nx * (HOUSE_HALF + 0.02), PLAQUE_Y, h.z + door.nz * (HOUSE_HALF + 0.02), 0, door.ry, 0), TOWN_ATLAS.blank));
    marks.push(atlasQuad(MARK, MARK, facing.clone().setPosition(h.x + (up.x * MARK) / 2, HOUSE_TOP + MARK_POST + (up.y * MARK) / 2, h.z + (up.z * MARK) / 2), TOWN_ATLAS.blank));
    markPosts.push(atlasPost(0.05, MARK_POST, h.x, HOUSE_TOP, h.z));
    const panes: Matrix4[] = [];
    for (const s of ["s", "e", "n", "w"] as const) {
      const n = FACE[s];
      const off = s === h.face ? 0.8 : 0.6;
      for (const k of [-1, 1]) panes.push(tf(h.x + n.nx * (HOUSE_HALF + 0.01) - n.nz * k * off, 1.05, h.z + n.nz * (HOUSE_HALF + 0.01) + n.nx * k * off, 0, n.ry, 0));
    }
    windows.push(panes);
  }

  // ----- 메시 만들기 -----
  meshes.roomStatic = roomStatic.build(matProp, "roomStatic");
  meshes.roomProps = roomProps.build(matProp, "roomProps");
  meshes.houseBody = houseBody.build(matProp, "houseBody");
  for (const n of ["roomStatic", "roomProps", "houseBody"] as const) meshes[n]!.receiveShadow = true;
  meshes.emissiveIndoor = emIndoor.build(matEmIndoor, "emissiveIndoor");
  meshes.glowIndoor = glowIndoor.build(matGlowIndoor, "glowIndoor");
  meshes.glowIndoor.renderOrder = 2;
  const housePlate = new Mesh(merged(plates, "housePlate"), matAtlas);
  housePlate.name = "housePlate";
  // 표식 판 여덟이 앞, 기둥이 뒤다 — setOwners 가 앞 32 정점의 UV 만 고친다
  const houseMark = new Mesh(merged([...marks, ...markPosts], "houseMark"), matAtlas);
  houseMark.name = "houseMark";
  const winLit = new Mesh(new BufferGeometry(), matEmHouse);
  winLit.name = "houseWinLit";
  const winDark = new Mesh(new BufferGeometry(), matProp);
  winDark.name = "houseWinDark";
  winDark.receiveShadow = true;
  Object.assign(meshes, { housePlate, houseMark, houseWinLit: winLit, houseWinDark: winDark });
  const graded = [meshes.roomStatic, meshes.roomProps, meshes.houseBody, ...ROOM_IDS.map((id) => cuts[id].mesh)];

  // ----- 집 주인: 창 두 묶음을 다시 만들고 문패·표식의 UV 를 좌석 칸이나 빈 판 칸으로 돌린다(판 시작 때 한 번) -----
  const setWindows = (mesh: Mesh, b: Bundle, mat: MeshBasicMaterial | MeshStandardMaterial, hex: string, list: readonly Matrix4[]): void => {
    for (const m of list) b.add(new PlaneGeometry(0.4, 0.5), hex, m);
    mesh.geometry.dispose();
    mesh.geometry = list.length > 0 ? b.build(mat, mesh.name).geometry : new BufferGeometry();
    mesh.visible = list.length > 0;
  };
  const fillHouses = (seats: readonly number[]): void => {
    const owned = new Set(seats.filter((s) => Number.isInteger(s) && s >= 0 && s < 8));
    const lit: Matrix4[] = [];
    const dark: Matrix4[] = [];
    const plateUv = housePlate.geometry.getAttribute("uv") as BufferAttribute;
    const markUv = houseMark.geometry.getAttribute("uv") as BufferAttribute;
    TOWN_HOUSES.forEach((h, i) => {
      const has = owned.has(h.seat);
      (has ? lit : dark).push(...windows[i]!);
      const cell = has ? TOWN_ATLAS.seat0 + h.seat : TOWN_ATLAS.blank;
      setCellUv(plateUv, i, cell);
      setCellUv(markUv, i, cell);
    });
    setWindows(winLit, new Bundle(), matEmHouse, C.paneLit, lit);
    setWindows(winDark, new Bundle(), matProp, C.paneDark, dark);
  };
  fillHouses([]);

  // ----- 컷어웨이: 방마다 지붕·앞벽·간판의 불투명도 하나 -----
  let propsFull = true;
  const applyCut = (c: CutState): void => {
    // 덮임(1) = 불투명 재질·깊이 쓰기 켬, 도중 = 투명·깊이 쓰기 끔, 걷힘(0) = 메시를 끈다(그리기 호출 절약)
    const solid = c.alpha >= 1;
    for (const m of c.mats) {
      if (m.transparent === solid) {
        m.transparent = !solid;
        m.depthWrite = solid;
        // 불투명 ↔ 투명은 셰이더 변형이 다르다(불투명은 알파를 1 로 고정한다)
        m.needsUpdate = true;
      }
      m.opacity = c.alpha;
    }
    c.mesh.visible = c.alpha > 0;
    c.sign.visible = c.alpha > 0 && propsFull;
  };

  return {
    meshes,
    graded,
    setLook(phase: LightingPhase, budget: Budget, dim: number): void {
      const lit = TOWN_LIT[phase];
      matEmIndoor.color.setScalar(lit.indoor * dim);
      matEmHouse.color.setScalar(lit.houseOwned * dim);
      matGlowIndoor.opacity = lit.indoor;
      meshes.glowIndoor!.visible = budget.glows && lit.indoor > 0;
    },
    applyBudget(b: Budget): void {
      // 소품 reduced: 간판·지붕 표식·방 소품을 끈다(몸통·문패 벽 부착·창은 남는다)
      propsFull = b.props === "full";
      meshes.roomProps!.visible = propsFull;
      houseMark.visible = propsFull;
      for (const id of ROOM_IDS) applyCut(cuts[id]);
    },
    dispose: () => atlas.dispose(),
    // 자리(Task 2 가 채운다): 걷힘 따라가기와 집 주인. 지금은 네 방 모두 덮여 있고 모든 집이 주인 없는 집이다
    hooks: {
      setCutaway: () => undefined,
      setOwners: () => undefined,
      roofs: () => ({ post: cuts.post.alpha, pub: cuts.pub.alpha, clinic: cuts.clinic.alpha, police: cuts.police.alpha }),
    },
  };
}

/** 마을 장면: 가운데 광장(건물 앞면 없음) + 바닥 판 24×24 + 방 넷·집 여덟 */
export function buildTownScene(budget: Budget): MapScene {
  return buildPlaza(budget, { facades: false, floorHalf: 12, plateFar: plateFarOf("town"), piece: townPiece });
}
