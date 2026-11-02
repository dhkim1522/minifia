// 장면 상태 순수 모듈 — GHOST-01·MAP-04·DAY-04·05, 08-UI-SPEC 카메라·단계 조명·유령.
// 순수: three·DOM 이 없고 입력은 서버 view 와 화면 연출 시각뿐이다. 결정 0002 — 화면은 받은 것만 그린다.
// 서버가 보내지 않은 위치는 애초에 없다: 산 사람 viewer 의 좌석 표에는 탈락한 사람이 '숨김' 표시로도 들어가지 않는다(키 자체가 없다, T-08-25).
// 읽는 것은 공개 정보(players·alive·day.points·day.candidate)와 본인 유령 여부(spectate·내 alive)뿐이다.
import { isAlive } from "../../shared/game/alive";
import { STAGE_SPOT, UNIT } from "../../shared/game/map";
import type { PhaseId, RoomView } from "../../shared/protocol";
import { GHOST_FADE_END_MS, GHOST_RISE_MS, pointsTally } from "../game/dayView";
import { GATHER_CENTER, ZOOM_MAJORITY, ZOOM_MIN_STAGE_H } from "./camera";

/** 렌더러가 읽는 조명 단계(UI-SPEC 단계 조명). 렌더러의 LightingPhase 확장은 08-10 이 한다 */
export type LightingStage = "talk" | "vote" | "trial" | "night" | "morning";

/** 따라가기 = 내 캐릭터(6페이즈 규칙), 고정 = 모이는 자리 가운데에서 움직이지 않음(zoom 은 과반 연출) */
export type CameraMode = { mode: "follow" } | { mode: "fixed"; target: { x: number; z: number }; zoom: number };

/** 긴장 단계: 0 평상시, 1 선두·찬반(초점에 점광), 2 과반(실내등 절반) */
export interface Tension {
  level: 0 | 1 | 2;
  /** 점광이 모이는 좌석(선두·과반인 사람, 찬반이면 변론자) */
  focus?: number;
}

/** 화면에 그릴 좌석 한 곳. 표에 있는 좌석만 그린다(없는 좌석은 그리지 않는다) */
export interface SeatLook {
  show: true;
  /** 유령으로 그리는지(반투명·떠다님). 산 사람 viewer 의 표에는 처형 연출 중인 좌석만 ghost 아님으로 남는다 */
  ghost: boolean;
  /** 지금 이 좌석이 가리키는 대상 좌석(지목 단계, 공개 정보 + 내 낙관적 선택) */
  pointAt?: number;
  /** 처형 연출 시작 시각(ms). 산 사람 viewer 는 연출 끝(GHOST_FADE_END_MS)에 좌석이 사라진다 */
  fadeAt?: number;
}

export interface SceneLook {
  camera: CameraMode;
  lighting: LightingStage;
  tension: 0 | 1 | 2;
  focusSeat?: number;
  seats: Record<number, SeatLook>;
}

/** 이 viewer 가 유령인지: 서버가 탈락한 본인 view 에만 싣는 spectate 가 있거나, 내 좌석이 탈락으로 내려온 경우 */
function isGhostViewer(view: RoomView): boolean {
  if (view.spectate !== undefined) return true;
  const me = view.players.find((p) => p.seat === view.me.seat);
  return me !== undefined && !isAlive(me);
}

/**
 * 그릴 좌석 표. 산 사람 viewer 는 산 좌석만(+ 처형 연출이 아직 끝나지 않은 좌석), 유령 viewer 는 모든 좌석이고 탈락 좌석은 ghost 다.
 * fading = 좌석 → 처형 연출 시작 시각(화면이 처형 이벤트를 본 시각). now 를 생략하면 표에 있는 연출은 아직 진행 중으로 본다.
 */
export function visibleSeats(view: RoomView, fading?: ReadonlyMap<number, number>, now?: number): Record<number, SeatLook> {
  const ghostViewer = isGhostViewer(view);
  const seats: Record<number, SeatLook> = {};
  for (const p of view.players) {
    const dead = !isAlive(p);
    const startedAt = fading?.get(p.seat);
    const fadingNow = dead && startedAt !== undefined && (now === undefined || now - startedAt < GHOST_FADE_END_MS);
    if (dead && !ghostViewer && !fadingNow) continue;
    seats[p.seat] = {
      show: true,
      ghost: dead && ghostViewer,
      ...(fadingNow ? { fadeAt: startedAt } : {}),
    };
  }
  return seats;
}

const FIXED_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>(["nomination", "defense", "verdict", "execution"]);

/**
 * 카메라 구도(UI-SPEC 카메라 표): 지목·변론·찬반·처형은 모이는 자리 가운데 고정, 그 밖(낮 시작·토론·밤·아침·로비)은 따라가기.
 * 확대 1.08 은 지목 과반이고 스테이지 높이(px)가 360 이상일 때만 — 모자라면 확대 없이 실내등과 도장만.
 */
export function cameraModeOf(view: RoomView, stageH: number): CameraMode {
  if (!FIXED_PHASES.has(view.phase)) return { mode: "follow" };
  const majority = view.phase === "nomination" && pointsTally(view).sure !== undefined;
  const zoom = majority && stageH >= ZOOM_MIN_STAGE_H ? ZOOM_MAJORITY : 1;
  return { mode: "fixed", target: { x: GATHER_CENTER.x, z: GATHER_CENTER.z }, zoom };
}

/**
 * 단계 조명(UI-SPEC): 낮 시작·토론 talk, 지목·찬반 vote, 변론·처형 trial, 밤 night, 아침 morning.
 * 로비·종료는 talk.
 */
export function lightingOf(phase: PhaseId): LightingStage {
  switch (phase) {
    case "nomination":
    case "verdict":
      return "vote";
    case "defense":
    case "execution":
      return "trial";
    case "night":
      return "night";
    case "morning":
      return "morning";
    default:
      return "talk";
  }
}

/** 긴장(UI-SPEC 단계 조명): 지목 선두 1(초점 선두), 과반 2, 찬반 1(초점 변론자), 그 밖 0 */
export function tensionOf(view: RoomView): Tension {
  if (view.phase === "nomination") {
    const tally = pointsTally(view);
    if (tally.sure !== undefined) return { level: 2, focus: tally.sure };
    if (tally.leader !== undefined) return { level: 1, focus: tally.leader };
    return { level: 0 };
  }
  if (view.phase === "verdict") {
    const candidate = view.day?.candidate;
    return candidate !== undefined ? { level: 1, focus: candidate } : { level: 0 };
  }
  return { level: 0 };
}

/** 위 계산을 한 장면으로 묶는다. stageH = 이 단계의 스테이지 사각형 높이(px), mine = 내 낙관적 지목 대상(서버 응답 전) */
export function sceneLook(view: RoomView, opts: { stageH: number; fading?: ReadonlyMap<number, number>; now?: number; mine?: number }): SceneLook {
  const tension = tensionOf(view);
  const seats = visibleSeats(view, opts.fading, opts.now);
  const pointing = pointingOf(view, opts.mine);
  for (const [seat, target] of Object.entries(pointing)) {
    const look = seats[Number(seat)];
    if (look) look.pointAt = target;
  }
  return {
    camera: cameraModeOf(view, opts.stageH),
    lighting: lightingOf(view.phase),
    tension: tension.level,
    ...(tension.focus !== undefined ? { focusSeat: tension.focus } : {}),
    seats,
  };
}

// ---- 처형 연출·유령·무대·지목 방향 ----

/** 처형된 사람의 반투명 불투명도(UI-SPEC 유령 모양: 블록아웃 setGhost 의 0.35 보다 UI-SPEC 0.6 이 이긴다) */
export const GHOST_OPACITY = 0.6;
/** 처형 연출에서 위로 떠오르는 높이(월드 단위, UI-SPEC 처형 +1.2) */
export const EXEC_RISE_Y = 1.2;
/** 유령이 떠 있는 기본 높이(월드 단위) */
export const GHOST_BASE_Y = 0.35;
/** 유령 흔들림 진폭(월드 단위) */
export const GHOST_BOB_Y = 0.08;
/** 무대 위 윗면 반경(월드 단위). 이 안이면 발이 무대 높이에 선다(블록아웃 bar.js ctx.center 와 같은 점) */
export const STAGE_TOP_R = 1.18;
/** 무대 위 발 높이(월드 단위, 블록아웃 ctx.center.y) */
export const STAGE_TOP_Y = 0.29;

/**
 * 처형 연출 시간표(UI-SPEC 처형, 알림 시작 기준 ms): 0~1400 불투명도 1 → 0.6·높이 0 → 1.2, 1400~2400 불투명도 0.6 → 0 (높이 유지), 2400 부터 숨김.
 * 모션 줄이기면 떠오름 없이 0.6 으로 곧바로 서 있다가 2400 에 사라진다. 음수는 0 으로 본다.
 */
export function executionFade(elapsedMs: number, reduced: boolean): { opacity: number; rise: number; hidden: boolean } {
  const t = Math.max(0, elapsedMs);
  if (t >= GHOST_FADE_END_MS) return { opacity: 0, rise: reduced ? 0 : EXEC_RISE_Y, hidden: true };
  if (reduced) return { opacity: GHOST_OPACITY, rise: 0, hidden: false };
  if (t < GHOST_RISE_MS) {
    const k = t / GHOST_RISE_MS;
    return { opacity: 1 - (1 - GHOST_OPACITY) * k, rise: EXEC_RISE_Y * k, hidden: false };
  }
  const k = (t - GHOST_RISE_MS) / (GHOST_FADE_END_MS - GHOST_RISE_MS);
  return { opacity: GHOST_OPACITY * (1 - k), rise: EXEC_RISE_Y, hidden: false };
}

/** 유령 떠다님 높이(월드 단위) = 0.35 + sin(2t) × 0.08, t 는 초(주기 π초). 모션 줄이기면 0.35 고정 */
export function ghostFloatY(tSec: number, reduced: boolean): number {
  return reduced ? GHOST_BASE_Y : GHOST_BASE_Y + Math.sin(2 * tSec) * GHOST_BOB_Y;
}

/** 단위 좌표 발 위치의 무대 위 높이: 무대 윗면 반경 1.18 안(경계 포함)이면 0.29, 아니면 0 */
export function stageLiftY(pos: { x: number; z: number }): number {
  return Math.hypot(pos.x - STAGE_SPOT.x / UNIT, pos.z - STAGE_SPOT.z / UNIT) <= STAGE_TOP_R ? STAGE_TOP_Y : 0;
}

/**
 * 좌석 → 가리키는 대상 좌석 표(지목 단계). 남의 지목은 서버가 공개한 day.points 만 쓰고(서버 응답 전에 남의 표를 미리 그리지 않는다, T-08-26),
 * 내 낙관적 선택(mine)이 있으면 내 좌석 한 줄만 덮는다. 내가 유령이거나 나를 고른 값은 덮지 않는다.
 */
export function pointingOf(view: RoomView, mine?: number): Record<number, number> {
  if (view.phase !== "nomination") return {};
  const out: Record<number, number> = {};
  for (const line of view.day?.points ?? []) out[line.seat] = line.target;
  if (mine !== undefined) {
    const me = view.players.find((p) => p.seat === view.me.seat);
    if (me !== undefined && isAlive(me) && mine !== view.me.seat) out[view.me.seat] = mine;
  }
  return out;
}

/** 선두가 새 사람으로 바뀌었으면 그 좌석(결정 0049 손사래 한 번), 아니면 null. 이전 view 가 없으면(첫 스냅샷·재접속) 효과 없이 null */
export function leaderShift(prev: RoomView | null, cur: RoomView): number | null {
  if (prev === null) return null;
  const now = pointsTally(cur).leader;
  if (now === undefined) return null;
  return pointsTally(prev).leader === now ? null : now;
}
