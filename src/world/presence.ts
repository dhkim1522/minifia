// 장면 상태 순수 모듈 — GHOST-01·MAP-04·DAY-04·05, 08-UI-SPEC 카메라·단계 조명·유령.
// 순수: three·DOM 이 없고 입력은 서버 view 와 화면 연출 시각뿐이다. 결정 0002 — 화면은 받은 것만 그린다.
// 탈락자는 누구든 같은 유령 그림 하나다(18.1 0083-2): 산 viewer·유령 viewer 모두 연출(fadeAt) 뒤 ghost 로 남고 의상 키가 없다(직업 단서 없음, L13)
// 위치는 서버가 새로 보내지 않는다 — 런타임이 클라이언트 월드 저장소가 마지막으로 받은 구간(WorldStore.lastSegOf)에서 세운다.
// 읽는 것은 공개 정보(players·alive·day.points·day.candidate)와 본인 유령 여부(spectate·내 alive)뿐이다.
import { isAlive } from "../../shared/game/alive";
import { STAGE_SPOT, UNIT } from "../../shared/game/map";
import type { MapId, PhaseId, RoomView } from "../../shared/protocol";
import { GHOST_FADE_END_MS, GHOST_RISE_MS, pointsTally } from "../game/dayView";
import { pointSeatsOf, revealPoints, showdownStageOf } from "../game/showdownView";
import { ZOOM_IN_MS } from "../game/verdictMoment";
import { GATHER_CENTER, ZOOM_MAJORITY, ZOOM_MIN_STAGE_H } from "./camera";
import type { OutfitId } from "./characterData";
import { pinOf, type PinDesc } from "./pinPlan";

/** 렌더러가 읽는 조명 단계(UI-SPEC 단계 조명). 렌더러의 LightingPhase 확장은 08-10 이 한다 */
export type LightingStage = "talk" | "vote" | "trial" | "night" | "nightCitizen" | "nightGhost" | "morning";

/** 따라가기 = 내 캐릭터(6페이즈 규칙), 고정 = 모이는 자리 가운데에서 움직이지 않음(zoom 은 과반 연출) */
export type CameraMode = { mode: "follow" } | { mode: "fixed"; target: { x: number; z: number }; zoom: number; zoomMs?: number };

/** 긴장 단계: 0 평상시, 1 선두·찬반(초점에 점광), 2 과반(실내등 절반) */
export interface Tension {
  level: 0 | 1 | 2;
  /** 점광이 모이는 좌석(선두·과반인 사람, 찬반이면 변론자) */
  focus?: number;
}

/** 화면에 그릴 좌석 한 곳. 표에 있는 좌석만 그린다(없는 좌석은 그리지 않는다) */
export interface SeatLook {
  show: true;
  /** 유령으로 그리는지(유령 그림·떠다님). 탈락 좌석은 처형 연출 중에만 ghost 아님이고 연출 뒤에는 ghost(유령 그림)다 */
  ghost: boolean;
  /** 지금 이 좌석이 가리키는 대상 좌석(지목 단계, 공개 정보 + 내 낙관적 선택) */
  pointAt?: number;
  /** 처형 연출 시작 시각(ms). 산 사람 viewer 는 연출 끝(GHOST_FADE_END_MS)에 이 키가 빠지고 좌석이 ghost 로 남는다 */
  fadeAt?: number;
  /**
   * 11페이즈 결과 화면 전용: 고른 look 대신 입는 직업 의상(산 사람만 — 탈락 좌석에는 주지 않는다, 0083-2).
   * 판 중 장면 표(visibleSeats)에는 키 자체가 없다 — 직업 의상이 판 중 경로로 번지지 않는다(T-11-15, L13).
   */
  costume?: OutfitId;
  /** 11페이즈 결과 화면 전용: 진 팀을 어둡게 한다(연결 끊김 어둠과 별개로 센다) */
  dim?: true;
  /**
   * 11페이즈 결과 화면 전용(11-12): 몸 불투명도(0~1). 쉬었다가 합류한 사람(sat)이 0.5 로 선다. 이름표는 흐려지지 않는다.
   * 판 중 장면 표(visibleSeats)에는 키 자체가 없다 — 처형 연출의 불투명도와 겹치면 더 낮은 쪽을 쓴다
   */
  opacity?: number;
}

export interface SceneLook {
  camera: CameraMode;
  lighting: LightingStage;
  tension: 0 | 1 | 2;
  focusSeat?: number;
  /** 핀 조명이 무엇을 비출지(결정 0066-6). 시각 의존은 런타임의 pinAt 몫이라 view 만으로 정해진다 */
  pin?: PinDesc | null;
  seats: Record<number, SeatLook>;
  /** 암살 현장 분필 자리(월드 단위). 서버 공개 값 day.chalk 를 UNIT 으로 나눈 것이고 유령·산 사람 viewer 가 같은 자리를 본다(결정 0061-14) */
  chalk?: { x: number; z: number };
}

/** 이 viewer 가 유령인지: 서버가 탈락한 본인 view 에만 싣는 spectate 가 있거나, 내 좌석이 탈락으로 내려온 경우 */
function isGhostViewer(view: RoomView): boolean {
  if (view.spectate !== undefined) return true;
  const me = view.players.find((p) => p.seat === view.me.seat);
  return me !== undefined && !isAlive(me);
}

/**
 * 그릴 좌석 표. 산 viewer 는 산 좌석 + 탈락 좌석(처형 연출 중이면 ghost 아님 + fadeAt, 연출 뒤·그 밖은 ghost),
 * 유령 viewer 는 모든 좌석이고 탈락 좌석은 ghost 다. 어느 쪽이든 의상 키가 없다 — 탈락자의 모습은 직업과 무관하다(0083-2).
 * 밤·심부름은 서버가 산 사람에게 본인(+근처)만 보내는 단계라(결정 0074 D-02·D-05) 산 viewer 의 탈락 좌석을 넣지 않는다 — 역할마다 겉보기가 달라지지 않게(0074-4).
 * fading = 좌석 → 처형 연출 시작 시각(화면이 처형 이벤트를 본 시각). now 를 생략하면 표에 있는 연출은 아직 진행 중으로 본다.
 */
export function visibleSeats(view: RoomView, fading?: ReadonlyMap<number, number>, now?: number): Record<number, SeatLook> {
  const ghostViewer = isGhostViewer(view);
  const seats: Record<number, SeatLook> = {};
  // 밤·산 시민 편(시민·경찰·의사): 내 좌석 하나뿐이다. 서버가 이 밤에 남의 위치를 한 번도 보내지 않으므로(09-03·09-09, 결정 0061-3)
  // 장면 표도 그 사실을 따른다 — 받은 위치를 화면에서만 숨기는 방식이 아니다(결정 0002·0021, T-09-21). 세 역할이 같은 값이다.
  const nightCitizen = view.phase === "night" && !ghostViewer && view.me.role !== "mafia";
  const hidesDead = view.phase === "night" || view.phase === "errand";
  for (const p of view.players) {
    if (nightCitizen && p.seat !== view.me.seat) continue;
    const dead = !isAlive(p);
    const startedAt = fading?.get(p.seat);
    const fadingNow = dead && startedAt !== undefined && (now === undefined || now - startedAt < GHOST_FADE_END_MS);
    if (dead && !ghostViewer && !fadingNow && hidesDead) continue;
    seats[p.seat] = {
      show: true,
      ghost: dead && (ghostViewer || !fadingNow),
      ...(fadingNow ? { fadeAt: startedAt } : {}),
    };
  }
  return seats;
}

const FIXED_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>(["nomination", "runoff", "showdown", "defense", "verdict", "execution"]);

/**
 * 카메라 구도(UI-SPEC 카메라 표): 지목·변론·찬반·처형은 모이는 자리 가운데 고정, 그 밖(낮 시작·토론·밤·아침·로비)은 따라가기.
 * 09.1(M-4): 순차 지목(day.turn 있음)은 배지 숫자만이다 — 과반이어도 확대하지 않는다.
 * 기본판(결정 0072) 동시 투표(day.turn 없음)는 과반이고 스테이지 높이가 ZOOM_MIN_STAGE_H 이상일 때만 ZOOM_MAJORITY 로 확대한다.
 */
export function cameraModeOf(view: RoomView, stageH: number, opts: { verdictZoom?: number } = {}): CameraMode {
  if (!FIXED_PHASES.has(view.phase)) return { mode: "follow" };
  const target = { x: GATHER_CENTER.x, z: GATHER_CENTER.z };
  // 판결 순간(09.1.1-13, O-15): 처형 단계에서 호출 쪽이 배율을 주면 0.6초 ease-in-out 으로 다가갔다 돌아온다. 스테이지가 낮으면(360 미만) 줌 없이 핀 조명과 막만 한다. 역할은 보지 않는다
  if (view.phase === "execution" && opts.verdictZoom !== undefined && stageH >= ZOOM_MIN_STAGE_H) return { mode: "fixed", target, zoom: opts.verdictZoom, zoomMs: ZOOM_IN_MS };
  const majority = view.phase === "nomination" && view.day?.turn === undefined && pointsTally(view).sure !== undefined;
  return { mode: "fixed", target, zoom: majority && stageH >= ZOOM_MIN_STAGE_H ? ZOOM_MAJORITY : 1 };
}

/**
 * 단계 조명(UI-SPEC): 낮 시작·토론 talk, 지목·결선·찬반 vote, 변론·처형 trial, 밤 night, 아침 morning.
 * 로비·종료는 talk.
 */
export function lightingOf(phase: PhaseId): LightingStage {
  switch (phase) {
    case "nomination":
    case "runoff":
    case "showdown":
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

/**
 * 보는 사람의 단계 조명(NIGHT-07·10): 밤에는 유령 nightGhost, 산 마피아 night, 산 비마피아 nightCitizen.
 * 밤이 아니면 lightingOf(phase) — 아침 이후는 역할과 무관하다.
 */
export function lightingFor(view: RoomView): LightingStage {
  if (view.phase !== "night") return lightingOf(view.phase);
  if (isGhostViewer(view)) return "nightGhost";
  return view.me.role === "mafia" ? "night" : "nightCitizen";
}

/** 긴장(UI-SPEC 단계 조명): 찬반 1(초점 변론자), 그 밖 0. 09.1(M-4): 순차 지목은 배지 숫자만이라 선두·과반이어도 0 이다. 기본판 동시 투표(day.turn 없음, 결정 0072)는 과반 2·선두 1(초점 그 좌석) */
export function tensionOf(view: RoomView): Tension {
  if (view.phase === "nomination" && view.day?.turn === undefined) {
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
export function sceneLook(view: RoomView, opts: { stageH: number; fading?: ReadonlyMap<number, number>; now?: number; mine?: number; verdictZoom?: number }): SceneLook {
  const tension = tensionOf(view);
  const seats = visibleSeats(view, opts.fading, opts.now);
  const pointing = pointingOf(view, opts.mine);
  const chalk = view.day?.chalk;
  for (const [seat, target] of Object.entries(pointing)) {
    const look = seats[Number(seat)];
    if (look && !look.ghost) look.pointAt = target; // 탈락한 좌석(유령)은 가리키지 않는다
  }
  return {
    camera: cameraModeOf(view, opts.stageH, opts.verdictZoom !== undefined ? { verdictZoom: opts.verdictZoom } : {}),
    lighting: lightingFor(view),
    tension: tension.level,
    ...(tension.focus !== undefined ? { focusSeat: tension.focus } : {}),
    pin: pinOf(view),
    seats,
    ...(chalk !== undefined ? { chalk: { x: chalk.x / UNIT, z: chalk.z / UNIT } } : {}),
  };
}

// ---- 처형 연출·유령·무대·지목 방향 ----

/** 처형된 사람의 반투명 불투명도(UI-SPEC 유령 모양: 블록아웃 setGhost 의 0.35 보다 UI-SPEC 0.6 이 이긴다) */
export const GHOST_OPACITY = 0.6;
/** 처형 연출 끝점의 몸 불투명도(18.1 C-4 값 그대로). 이름표 흐려짐 식도 이 값을 쓴다 */
export const EXEC_END_OPACITY = 0.26;

/**
 * 유령 그림(ghost_default, 0083-2) 값: 불투명도 0.88(85~90%), 등장 시간 0.3초(처형 연출이 끝나 좌석이 ghost 가 될 때), 폭:높이 = 3:4.
 * 키는 캐릭터와 같다(character.ts 의 로컬 높이 2.45 = 이름표가 서는 머리 꼭대기).
 */
export const GHOST_SPRITE = { opacity: 1, inMs: 300, aspect: 0.75 } as const;

/**
 * 조명 단계별 유령 그림 밝기 배율(0.45~1). 어두운 장면에서는 밝기만 낮춘다 — 색조·채도는 그대로(0083-2).
 * 밤 계열 < 저녁 계열(vote·trial) ≤ 낮(talk). 끊긴 사람·결과의 진 팀 어둠은 이 배율에 0.6 을 곱한다(runtime).
 */
const GHOST_TINT: Readonly<Record<LightingStage, number>> = {
  talk: 1,
  morning: 0.95,
  vote: 0.85,
  trial: 0.8,
  night: 0.6,
  nightCitizen: 0.6,
  nightGhost: 0.7,
};
export function ghostTintOf(lighting: LightingStage): number {
  return GHOST_TINT[lighting];
}
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
 * 처형 연출 시간표(UI-SPEC 처형 + 18.1 C-4, 알림 시작 기준 ms): 0~1400 불투명도 1 → 0.6·높이 0 → 1.2,
 * 1400~2400 불투명도 0.6 → 0.26(EXEC_END_OPACITY)·높이 1.2 → 0.35(GHOST_BASE_Y), 2400 부터는 그 끝점 그대로 — 사라지지 않고 서 있다가 좌석이 ghost 가 되면 유령 그림이 나타난다.
 * 모션 줄이기면 모든 시각에 끝점(0.26·0.35)이다. 음수는 0 으로 본다.
 */
export function executionFade(elapsedMs: number, reduced: boolean): { opacity: number; rise: number } {
  const t = Math.max(0, elapsedMs);
  if (reduced || t >= GHOST_FADE_END_MS) return { opacity: EXEC_END_OPACITY, rise: GHOST_BASE_Y };
  if (t < GHOST_RISE_MS) {
    const k = t / GHOST_RISE_MS;
    return { opacity: 1 - (1 - GHOST_OPACITY) * k, rise: EXEC_RISE_Y * k };
  }
  const k = (t - GHOST_RISE_MS) / (GHOST_FADE_END_MS - GHOST_RISE_MS);
  return { opacity: GHOST_OPACITY + (EXEC_END_OPACITY - GHOST_OPACITY) * k, rise: EXEC_RISE_Y + (GHOST_BASE_Y - EXEC_RISE_Y) * k };
}

/** 유령 떠다님 높이(월드 단위) = 0.35 + sin(2t) × 0.08, t 는 초(주기 π초). 모션 줄이기면 0.35 고정 */
export function ghostFloatY(tSec: number, reduced: boolean): number {
  return reduced ? GHOST_BASE_Y : GHOST_BASE_Y + Math.sin(2 * tSec) * GHOST_BOB_Y;
}

/**
 * 맵별 무대 윗면 표(월드 단위, MAP-06 D-22): 재즈 바 반경 1.18·높이 0.29(STAGE_TOP_R·STAGE_TOP_Y), 광장 위 단 반경 1.05·높이 0.46.
 * 맵을 늘리면 한 줄을 더한다 — Record 라 빠뜨리면 컴파일이 실패한다
 */
export const STAGE_TOPS: Readonly<Record<MapId, { r: number; y: number }>> = {
  bar: { r: STAGE_TOP_R, y: STAGE_TOP_Y },
  plaza: { r: 1.05, y: 0.46 },
  town: { r: 1.05, y: 0.46 }, // 마을 가운데는 광장 연단 그대로다(20페이즈 D-05)
};

/** 단위 좌표 발 위치의 무대 위 높이: 그 맵의 무대 윗면 반경 안(경계 포함)이면 윗면 높이, 아니면 0. 맵 id 를 안 주면 재즈 바(0.29, 반경 1.18) */
export function stageLiftY(pos: { x: number; z: number }, mapId: MapId = "bar"): number {
  const top = STAGE_TOPS[mapId];
  return Math.hypot(pos.x - STAGE_SPOT.x / UNIT, pos.z - STAGE_SPOT.z / UNIT) <= top.r ? top.y : 0;
}

/**
 * 좌석 → 가리키는 대상 좌석 표(지목 단계). 남의 지목은 서버가 공개한 day.points 만 쓰고(서버 응답 전에 남의 표를 미리 그리지 않는다, T-08-26),
 * 내 낙관적 선택(mine)이 있으면 내 좌석 한 줄만 덮는다. 내가 유령이거나 나를 고른 값은 덮지 않는다.
 */
export function pointingOf(view: RoomView, mine?: number): Record<number, number> {
  // 결선(09.1.1-14): 서버가 마감 전 남의 선택을 주지 않으므로(T-09.1.1-39) 내 낙관 선택(후보 둘 중 하나)만 그린다. 후보 본인·유령·후보 밖 대상은 그리지 않는다
  if (view.phase === "runoff") {
    const runoff = view.day?.runoff;
    const me = view.players.find((p) => p.seat === view.me.seat);
    if (runoff === undefined || mine === undefined || !runoff.cand.includes(mine)) return {};
    if (me === undefined || !isAlive(me) || runoff.cand.includes(view.me.seat)) return {};
    return { [view.me.seat]: mine };
  }
  // 마지막 3인(09.1.1-15, T-09.1.1-42): 동시 지목 창에는 서버가 남의 선택을 주지 않으므로 내 낙관 선택(나를 뺀 산 두 사람 중 하나)만 그린다. 공개(i 4)에는 확정된 줄 전체를 같은 순간에 그린다
  if (view.phase === "showdown") {
    const stage = showdownStageOf(view);
    if (stage === "reveal") return Object.fromEntries(revealPoints(view).map((line) => [line.seat, line.target]));
    if (stage === "point" && mine !== undefined && pointSeatsOf(view).includes(mine)) return { [view.me.seat]: mine };
    return {};
  }
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
