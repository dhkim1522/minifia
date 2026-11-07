// 심부름 화면의 순수 판정(15페이즈, 결정 0074 예정 — UI-SPEC U-3·U-4·"장소 표지"). DOM·window·시각을 읽지 않는다.
// 읽는 view 값은 내 심부름 목록(me.errand)과 이번 판의 맵 id(view.map)뿐이고 역할은 읽지 않는다(D-08).
// 처리 가능 판정(actablePlaceOf)은 서버 규칙(shared/game/errand.ts actErrand)의 화면 거울이다 — 단추의 켜짐·빛에만 쓰고 권위는 서버다.
// 같은 입력이면 서버와 같은 판정이 되도록 거리는 서버처럼 고정소수점(월드 × UNIT 반올림)의 정수 제곱거리로 잰다.
import { UNIT } from "../../shared/game/map";
import { mapOf } from "../../shared/game/maps";
import { ERRAND_ACT_R } from "../../shared/game/phases";
import type { PlaceId, RoomView } from "../../shared/protocol";

/** 화면에 쓰는 글자: 단추(처리 → 3곳 완료 뒤 완료) */
export const ERRAND_TEXT = { act: "처리", done: "완료" } as const;

/** 접근성·스크린리더용 진행 문장 */
export function progressLabel(n: number, total: number): string {
  return `진행 ${n}/${total}`;
}

export interface ErrandProgress {
  places: PlaceId[];
  done: PlaceId[];
  n: number;
  total: number;
  complete: boolean;
}

/** 내 심부름 진행. me.errand 가 없으면 null */
export function errandProgress(view: RoomView): ErrandProgress | null {
  const mine = view.me.errand;
  if (mine === undefined) return null;
  const places = [...mine.places];
  const done = [...mine.done];
  const total = places.length;
  return { places, done, n: done.length, total, complete: total > 0 && done.length >= total };
}

export interface PlaceCenter {
  id: PlaceId;
  x: number;
  z: number;
}

/** 내 목록 장소마다 맵 데이터의 좌표(월드 단위). view.map 이 없거나 맵에서 못 찾는 장소는 뺀다 */
export function placeCentersOf(view: RoomView): PlaceCenter[] {
  const mapId = view.map;
  const mine = view.me.errand;
  if (mapId === undefined || mine === undefined) return [];
  const defs = mapOf(mapId).places ?? [];
  const out: PlaceCenter[] = [];
  for (const id of mine.places) {
    const def = defs.find((p) => p.id === id);
    if (def !== undefined) out.push({ id, x: def.x, z: def.z });
  }
  return out;
}

interface Pos {
  x: number;
  z: number;
}

/** 서버와 같은 환산: 월드 → 고정소수점(정수)의 제곱거리 */
function distSqFx(a: Pos, b: Pos): number {
  const dx = Math.round(a.x * UNIT) - Math.round(b.x * UNIT);
  const dz = Math.round(a.z * UNIT) - Math.round(b.z * UNIT);
  return dx * dx + dz * dz;
}

/** 내 위치에서 가장 가까운 미완료 장소(같으면 목록 앞). 위치를 모르면 첫 미완료, 없으면 null */
export function nextPlaceOf(pos: Pos | null | undefined, centers: ReadonlyArray<PlaceCenter>, done: readonly PlaceId[]): PlaceId | null {
  let best: PlaceId | null = null;
  let bestD = Infinity;
  for (const c of centers) {
    if (done.includes(c.id)) continue;
    if (pos === null || pos === undefined) return c.id;
    const d = distSqFx(c, pos);
    if (d < bestD) {
      bestD = d;
      best = c.id;
    }
  }
  return best;
}

/** 처리 반경 안(경계 포함)의 미완료 장소 중 가장 가까운 것(같으면 목록 앞). 위치를 모르면 null */
export function actablePlaceOf(
  pos: Pos | null | undefined,
  centers: ReadonlyArray<PlaceCenter>,
  done: readonly PlaceId[],
  radius: number = ERRAND_ACT_R,
): PlaceId | null {
  if (pos === null || pos === undefined) return null;
  const reach = Math.round(radius * UNIT);
  let best: PlaceId | null = null;
  let bestD = Infinity;
  for (const c of centers) {
    if (done.includes(c.id)) continue;
    const d = distSqFx(c, pos);
    if (d <= reach * reach && d < bestD) {
      bestD = d;
      best = c.id;
    }
  }
  return best;
}

/** 사각형(px) */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface MarkerPlanInput {
  /** 스테이지 사각형(띠 아랫변 ~ 아래 패널 윗변) */
  stage: Rect;
  /** 독 줄 사각형(소리 단추 줄). 없으면 null */
  dock: Rect | null;
  /** 장소별 투영 좌표(표지 중심, px) */
  items: ReadonlyArray<{ id: PlaceId; x: number; y: number }>;
  /** 다음 장소 id */
  nextId: PlaceId | null;
  /** 표지 원 지름(기본 36) — 계산에는 누르기 상자(tap)만 쓴다 */
  pin?: number;
  /** 표지 누르기 상자 한 변(기본 44) */
  tap?: number;
  /** 스테이지 안쪽 여백(기본 8) */
  inset?: number;
  /** 화살표 칩 지름(기본 36) */
  chip?: number;
}

export interface MarkerPlan {
  pins: Array<{ id: PlaceId; x: number; y: number }>;
  /** 화살표는 항상 하나뿐. angle 은 도(위쪽 0°, 시계 방향) — 스테이지 중심에서 그 장소 투영 점으로의 방향 */
  arrow: { id: PlaceId; x: number; y: number; angle: number } | null;
}

const overlaps = (a: Rect, b: Rect): boolean => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/**
 * 표지 배치 계획(순수·결정적). 표지는 누르기 상자(tap) 전체가 스테이지 안쪽(inset) 안이고 독 줄과 교차하지 않을 때만 그린다.
 * 그리지 못한 장소가 다음 장소면 화살표 한 개가 스테이지 가장자리(안쪽 inset + chip/2)에 붙어 그 방향을 가리킨다.
 * 화살표가 독 줄과 겹치면 아래로 비키고, 띠 아래(stage.top + inset)보다 위로는 올라가지 않는다.
 */
export function placeMarkerPlan(input: MarkerPlanInput): MarkerPlan {
  const { stage, dock, items, nextId } = input;
  const tap = input.tap ?? 44;
  const inset = input.inset ?? 8;
  const chip = input.chip ?? 36;
  const half = tap / 2;
  const pins: MarkerPlan["pins"] = [];
  for (const it of items) {
    const box: Rect = { left: it.x - half, top: it.y - half, right: it.x + half, bottom: it.y + half };
    const inside = box.left >= stage.left + inset && box.right <= stage.right - inset && box.top >= stage.top + inset && box.bottom <= stage.bottom - inset;
    if (inside && !(dock !== null && overlaps(box, dock))) pins.push({ id: it.id, x: it.x, y: it.y });
  }
  if (nextId === null || pins.some((p) => p.id === nextId)) return { pins, arrow: null };
  const target = items.find((it) => it.id === nextId);
  if (target === undefined) return { pins, arrow: null };

  const cx = (stage.left + stage.right) / 2;
  const cy = (stage.top + stage.bottom) / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;
  const reach = inset + chip / 2;
  const hx = (stage.right - stage.left) / 2 - reach;
  const hy = (stage.bottom - stage.top) / 2 - reach;
  let ax: number;
  let ay: number;
  let angle: number;
  if (dx === 0 && dy === 0) {
    ax = cx;
    ay = stage.top + reach;
    angle = 0;
  } else {
    // 중심에서 그 방향으로 뻗은 선이 안쪽 사각형(가장자리에서 reach 안쪽)과 만나는 점
    const t = Math.min(dx === 0 ? Infinity : hx / Math.abs(dx), dy === 0 ? Infinity : hy / Math.abs(dy));
    ax = cx + dx * t;
    ay = cy + dy * t;
    angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
  }
  if (dock !== null) {
    const chipBox = (y: number): Rect => ({ left: ax - chip / 2, top: y - chip / 2, right: ax + chip / 2, bottom: y + chip / 2 });
    if (overlaps(chipBox(ay), dock)) ay = Math.min(dock.bottom + chip / 2, stage.bottom - reach);
  }
  return { pins, arrow: { id: nextId, x: ax, y: Math.max(ay, stage.top + reach), angle } };
}
