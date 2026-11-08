// 심부름 화면의 순수 판정(15페이즈, 결정 0074 예정 — UI-SPEC U-3·U-4·"장소 표지"). DOM·window·시각을 읽지 않는다.
// 읽는 view 값은 내 심부름 목록(me.errand)과 이번 판의 맵 id(view.map)뿐이고 역할은 읽지 않는다(D-08).
// 처리 가능 판정(actablePlaceOf)은 서버 규칙(shared/game/errand.ts actErrand)의 화면 거울이다 — 단추의 켜짐·빛에만 쓰고 권위는 서버다.
// 같은 입력이면 서버와 같은 판정이 되도록 거리는 서버처럼 고정소수점(월드 × UNIT 반올림)의 정수 제곱거리로 잰다.
import { UNIT } from "../../shared/game/map";
import { mapOf } from "../../shared/game/maps";
import { ERRAND_ACT_R, ERRAND_MS } from "../../shared/game/phases";
import type { PlaceId, RoomView } from "../../shared/protocol";

/** 화면에 쓰는 글자: 단추(처리 → 3곳 완료 뒤 완료) */
export const ERRAND_TEXT = { act: "처리", done: "완료" } as const;

/** 시작 카드가 떠 있는 시간(16-08, V-19). 화면 연출이라 클라이언트 상수이고 서버 40초 시계와 무관하다 */
export const ERRAND_CARD_MS = 2_000;

/**
 * 시작 카드를 보일 시각인가 — 서버 시계 기준 단계 시작(phaseEndsAt − ERRAND_MS)부터 ERRAND_CARD_MS 안일 때만 참.
 * 목록이 없는 사람(유령·목록 0곳)·다른 단계·끝 시각을 모르면 거짓. 재접속·새로 고침으로 2초가 지난 뒤 들어오면 거짓이다.
 * 카드는 보여 주기만 하는 안내라서 놓쳐도 맵의 진행 점·타일이 같은 목록을 보인다.
 */
export function startCardOn(view: RoomView, serverNow: number): boolean {
  if (view.phase !== "errand") return false;
  const mine = view.me.errand;
  if (mine === undefined || mine.places.length === 0) return false;
  if (view.phaseEndsAt === null || view.phaseEndsAt === undefined) return false;
  return serverNow < view.phaseEndsAt - ERRAND_MS + ERRAND_CARD_MS;
}

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
  /** 타일·알약이 피할 사각형(소리 열 첫 칸 등). 화살표도 피한다 */
  avoid: ReadonlyArray<Rect>;
  /** 장소별 투영 좌표(타일 중심, px) */
  items: ReadonlyArray<{ id: PlaceId; x: number; y: number }>;
  /** 내 발밑 투영 좌표. 모르면 null */
  me: { x: number; y: number } | null;
  /** 가장 가까운 미처리 장소 id */
  nextId: PlaceId | null;
  /** 처리 반경 안 미처리 장소 id(있으면 [처리] 알약이 서고 화살표는 없다) */
  actId: PlaceId | null;
  /** 화살표만 더 피하는 사각형(내 이름표) */
  arrowAvoid?: ReadonlyArray<Rect>;
  /** 알약 폭(그 요소의 offsetWidth). 모르면 96 */
  pillW?: number;
  /** 타일 한 변(기본 64) */
  tile?: number;
  /** 스테이지 안쪽 여백(기본 8) */
  inset?: number;
  /** 화살표 글리프 한 변(기본 40) */
  arrow?: number;
  /** 내 발밑에서 화살표 중심까지(기본 56) */
  reach?: number;
  /** 겹칠 때 한 번만 당기는 거리(기본 48) */
  reachShort?: number;
  /** 알약 높이(기본 44) */
  pillH?: number;
  /** 타일과 알약 사이(기본 8) */
  gap?: number;
}

export interface MarkerPlan {
  pins: Array<{ id: PlaceId; x: number; y: number }>;
  /** angle 은 도(위쪽 0°, 시계 방향) — 내 발밑에서 그 장소 투영 점으로의 방향 */
  arrow: { id: PlaceId; x: number; y: number; angle: number } | null;
  /** [처리] 알약 중심 */
  act: { id: PlaceId; x: number; y: number } | null;
}

const overlaps = (a: Rect, b: Rect): boolean => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * 장소 타일·발밑 화살표·[처리] 알약 배치 계획(순수·결정적, 16-07).
 * 타일은 상자(tile) 전체가 스테이지 안쪽(inset) 안이고 avoid 어느 것과도 겹치지 않을 때만 그린다.
 * 화살표(actId 없음 · me·nextId 있음)는 내 발밑에서 목표 방향 reach 떨어진 곳이고 avoid·arrowAvoid 와 겹치면 reachShort 로 한 번만 당긴다(스테이지 안쪽으로 가둔다).
 * 알약(actId 있음)은 그 타일(그려지지 않았으면 투영 점을 안쪽으로 당긴 자리) 위 gap 에 서고, 위가 stage.top + inset 을 넘거나 avoid 에 막히거나(아래가 비어 있을 때) 다른 장소 타일에 걸리면 아래로 뒤집으며, 좌우는 안쪽 inset 안으로 민다.
 */
export function placeMarkerPlan(input: MarkerPlanInput): MarkerPlan {
  const { stage, avoid, items, me, nextId, actId } = input;
  const tile = input.tile ?? 64;
  const inset = input.inset ?? 8;
  const arrowSize = input.arrow ?? 40;
  const reach = input.reach ?? 56;
  const reachShort = input.reachShort ?? 48;
  const pillH = input.pillH ?? 44;
  const pillW = input.pillW ?? 96;
  const gap = input.gap ?? 8;
  const half = tile / 2;
  const inner: Rect = { left: stage.left + inset, top: stage.top + inset, right: stage.right - inset, bottom: stage.bottom - inset };

  const pins: MarkerPlan["pins"] = [];
  for (const it of items) {
    const box: Rect = { left: it.x - half, top: it.y - half, right: it.x + half, bottom: it.y + half };
    const inside = box.left >= inner.left && box.right <= inner.right && box.top >= inner.top && box.bottom <= inner.bottom;
    if (inside && !avoid.some((r) => overlaps(box, r))) pins.push({ id: it.id, x: it.x, y: it.y });
  }

  let arrow: MarkerPlan["arrow"] = null;
  if (actId === null && nextId !== null && me !== null) {
    const target = items.find((it) => it.id === nextId);
    if (target !== undefined) {
      const dx = target.x - me.x;
      const dy = target.y - me.y;
      const len = Math.hypot(dx, dy);
      const ux = len === 0 ? 0 : dx / len;
      const uy = len === 0 ? -1 : dy / len;
      const angle = len === 0 ? 0 : (Math.atan2(dx, -dy) * 180) / Math.PI;
      const ha = arrowSize / 2;
      const at = (d: number): { x: number; y: number } => ({
        x: clamp(me.x + ux * d, inner.left + ha, inner.right - ha),
        y: clamp(me.y + uy * d, inner.top + ha, inner.bottom - ha),
      });
      const blocked = (p: { x: number; y: number }): boolean => {
        const box: Rect = { left: p.x - ha, top: p.y - ha, right: p.x + ha, bottom: p.y + ha };
        return avoid.some((r) => overlaps(box, r)) || (input.arrowAvoid ?? []).some((r) => overlaps(box, r));
      };
      let p = at(reach);
      if (blocked(p)) p = at(reachShort);
      arrow = { id: nextId, x: p.x, y: p.y, angle };
    }
  }

  let act: MarkerPlan["act"] = null;
  if (actId !== null) {
    const target = items.find((it) => it.id === actId);
    if (target !== undefined) {
      const cx = clamp(target.x, inner.left + half, inner.right - half);
      const cy = clamp(target.y, inner.top + half, inner.bottom - half);
      const px = clamp(cx, inner.left + pillW / 2, inner.right - pillW / 2);
      const boxAt = (y: number): Rect => ({ left: px - pillW / 2, top: y - pillH / 2, right: px + pillW / 2, bottom: y + pillH / 2 });
      const above = cy - half - gap - pillH / 2;
      const below = cy + half + gap + pillH / 2;
      // 다른 장소의 그려진 타일에 걸리는지(16-10): 두 장소가 가까우면 위쪽 알약이 이웃 타일을 몇 px 가릴 수 있다.
      const hitsTile = (b: Rect): boolean => pins.some((p) => p.id !== actId && overlaps(b, { left: p.x - half, top: p.y - half, right: p.x + half, bottom: p.y + half }));
      const hardBlockedAbove = boxAt(above).top < inner.top || avoid.some((r) => overlaps(boxAt(above), r));
      let y = above;
      if (hardBlockedAbove) y = below;
      else if (hitsTile(boxAt(above)) && boxAt(below).bottom <= inner.bottom && !avoid.some((r) => overlaps(boxAt(below), r)) && !hitsTile(boxAt(below))) y = below;
      act = { id: actId, x: px, y };
    }
  }
  return { pins, arrow, act };
}
