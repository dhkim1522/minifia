// 21페이즈 — 받은 view 값만 읽는 순수 계산(단서 칩·지점 상태·꺼진 등불·집 판·같은 옷 배지). 화면 부품(21-10~21-13)이 이것을 쓴다.
// 역할을 읽지 않는다(겉보기 같음 규칙): 입력은 공개 값(day.lamps·players[].alive·look)과 본인에게만 온 me.clues·me.record 뿐이고,
// 서버 전용 값은 이 파일에 없다. 시각·난수·DOM 을 읽지 않는다. 글은 TRACE_TEXT 와 UI-SPEC Copywriting 닫힌 표(발자국 하나~여덟·먼저 손댄 흔적·
// 어두워서 못 봤어요·목격 n·단서 없음)에서만 온다 — 역할 연상어·'범인'·'증거'·'확정' 이 없다. 사람은 '참가자' 로 부른다.
import { isAlive } from "../../shared/game/alive";
import { UNIT } from "../../shared/game/map";
import { TOWN_CLUE_SPOTS } from "../../shared/game/mapTown";
import { ERRAND_ACT_R, MORNING_SCENE_MS } from "../../shared/game/phases";
import { modeOf, rulesetOf } from "../../shared/game/ruleset";
import type { ClueLine, ClueSpotId, PublicPlayer, RecordLine, RoomView } from "../../shared/protocol";
import type { V2IconName } from "../components/v2/V2Icon";
import { ANNOUNCE_MORNING_AT, ANNOUNCE_MORNING_MS, ANNOUNCE_POLICE_AT, ANNOUNCE_POLICE_MS } from "./dayView";
import { sameOutfitSeats } from "./traceMark";
import { TRACE_TEXT } from "./traceText";

/** 발자국 수사(UI-SPEC 카드 글): 1~8 → 하나…여덟. 서버가 싣는 발자국 수는 1~7 이라 0·9 는 쓰지 않는다 */
export const KOREAN_COUNT: Readonly<Record<number, string>> = Object.freeze({ 1: "하나", 2: "둘", 3: "셋", 4: "넷", 5: "다섯", 6: "여섯", 7: "일곱", 8: "여덟" });

export const NO_CLUE_TEXT = "단서 없음";
export const TOUCHED_TEXT = "먼저 손댄 흔적";
export const DARK_TEXT = "어두워서 못 봤어요";

/** 의심 보드 칩 종류. none 은 단서도 목격도 없을 때 하나 */
export type ClueChipKind = "footprint" | "cloth" | "window" | "touched" | "dark" | "witness" | "none";

export interface ClueChip {
  kind: ClueChipKind;
  /** 선 아이콘(none 은 없다) */
  icon: V2IconName | null;
  text: string;
  /** 단서 지점 번호 — touched 는 그 지점의 아이콘을 회색으로 앞에 단다 */
  spot?: ClueSpotId;
}

/** 지점 번호 → 그 지점의 아이콘(① 발자국 ② 옷 조각 ③ 창문) */
const SPOT_ICON: Readonly<Record<ClueSpotId, V2IconName>> = { 1: "footprint", 2: "cloth", 3: "window" };

function chipOf(c: ClueLine): ClueChip {
  switch (c.kind) {
    case "footprint": {
      const count = c.n === undefined ? undefined : KOREAN_COUNT[c.n];
      return { kind: "footprint", icon: "footprint", text: count === undefined ? "발자국" : `발자국 ${count}`, spot: c.spot };
    }
    case "cloth":
      return { kind: "cloth", icon: "cloth", text: c.piece === undefined ? "" : TRACE_TEXT[c.piece], spot: c.spot };
    case "window":
      return { kind: "window", icon: "window", text: c.piece === undefined ? "" : TRACE_TEXT[c.piece], spot: c.spot };
    case "touched":
      return { kind: "touched", icon: SPOT_ICON[c.spot], text: TOUCHED_TEXT, spot: c.spot };
    case "dark":
      return { kind: "dark", icon: "window", text: DARK_TEXT, spot: c.spot };
  }
}

/**
 * 의심 보드 칩 목록: 받은 단서를 살핀 차례대로, 목격 기록이 있으면 끝에 '목격 n' 하나. 둘 다 없으면 '단서 없음' 하나.
 * 목격 기록이 빈 배열이면 목격 칩은 없다(펼칠 줄이 없다).
 */
export function clueChipsOf(clues: readonly ClueLine[] | undefined, record: readonly RecordLine[] | undefined): ClueChip[] {
  const out = (clues ?? []).map(chipOf);
  const seen = record?.length ?? 0;
  if (seen > 0) out.push({ kind: "witness", icon: "eye", text: `목격 ${seen}` });
  if (out.length === 0) out.push({ kind: "none", icon: null, text: NO_CLUE_TEXT });
  return out;
}

/** 단서 지점 상태: 안 살핌 fresh · 살핌 done · 먼저 손댄 흔적을 받은 지점 blurred (내가 살핀 결과 — 살피기 전에는 모두 fresh) */
export type SpotState = "fresh" | "done" | "blurred";

export function clueSpotStates(clues: readonly ClueLine[] | undefined): Record<ClueSpotId, SpotState> {
  const out: Record<ClueSpotId, SpotState> = { 1: "fresh", 2: "fresh", 3: "fresh" };
  for (const c of clues ?? []) out[c.spot] = c.kind === "touched" ? "blurred" : "done";
  return out;
}

const ascending = (list: readonly number[]): number[] => [...list].sort((a, b) => a - b);

/**
 * 꺼진 등불(아침 공개): 주인 있는 집(ownerSeats — 사람이 앉은 좌석)의 가로등 중 켜진 목록(day.lamps)에 없는 번호, 오름차순.
 * 가로등 n 은 좌석 n 의 집 앞이다. 주인 없는 집의 가로등은 표식하지 않는다(소음을 줄이는 쪽 — UI-SPEC 이 정하지 않은 곳의 계획 가정).
 */
export function lampsOffOf(lamps: readonly number[], ownerSeats: readonly number[]): number[] {
  return ascending(ownerSeats.filter((seat) => !lamps.includes(seat)));
}

/** 창 켜짐(D-25): 주인 좌석 ∩ 켜진 등불, 오름차순. 켜진 가로등이 있는 집의 창에 불이 켜진다 */
export function windowsLitOf(ownerSeats: readonly number[], lamps: readonly number[]): number[] {
  return ascending(ownerSeats.filter((seat) => lamps.includes(seat)));
}

/** 밤 집 판 하나: 산 사람 좌석의 집, me 는 내 집 */
export interface HousePlate {
  seat: number;
  me: boolean;
}

/** 밤 집 판 목록(D-26): 산 사람(나 포함) 좌석만, 좌석 오름차순. 역할과 무관하게 모두 같은 목록이다 */
export function housePlatesOf(view: Pick<RoomView, "players" | "me">): HousePlate[] {
  return view.players
    .filter((p) => isAlive(p))
    .map((p) => ({ seat: p.seat, me: p.seat === view.me.seat }))
    .sort((a, b) => a.seat - b.seat);
}

/**
 * 밤 집 판 화면인가(21-12, D-25): 확장판의 마을 맵 밤. 집이 있는 맵에서만 판을 그린다 — 카메라(cameraModeOf)와 같은 조건이다.
 * 산 사람인지(유령은 판이 없다)는 부르는 쪽이 본다. 역할을 읽지 않는다
 */
export function houseNightOf(view: Pick<RoomView, "phase" | "map" | "mode">): boolean {
  return view.phase === "night" && view.map === "town" && rulesetOf(modeOf(view)).errand;
}

/** 집 판 누르기 반경 — 판 중심에서 이 거리(px) 안에서 가장 가까운 판 하나를 고른다(UI-SPEC P21-9) */
export const PLATE_TAP_MAX = 28;

/**
 * 최근접 누르기: 누른 점(sx, sy)에서 중심 거리가 max 이하인 판 중 가장 가까운 판의 좌석. 밖이면 null.
 * 같은 거리면 낮은 좌석(목록 순서와 무관하게 정해진다).
 */
export function nearestPlate(points: ReadonlyArray<{ seat: number; x: number; y: number }>, sx: number, sy: number, max: number = PLATE_TAP_MAX): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  for (const p of points) {
    const d = Math.hypot(p.x - sx, p.y - sy);
    if (d > max) continue;
    if (d < bestD || (d === bestD && best !== null && p.seat < best)) {
      best = p.seat;
      bestD = d;
    }
  }
  return best;
}

/** 얼굴 줄 같은 옷 배지 종류: 옷 조각 칩(②) → cloth, 창문 칩(③) → window */
export type OutfitMark = "cloth" | "window";

/**
 * 얼굴 줄의 같은 옷 배지(D-18): 받은 옷 조각(②·③)마다 그 조각과 같은 옷을 입은 산 사람(나 포함)의 좌석에 배지를 단다.
 * 한 좌석이 두 조각에 걸리면 배지 둘(cloth, window 순). 배지가 없는 좌석은 키가 없다. 발자국·먼저 손댄 흔적·어두워서 못 봄은 배지를 만들지 않는다.
 * 옷은 누구나 입을 수 있어 확정이 아니다 — 배지는 같은 옷이라는 사실만 말한다.
 */
export function boardMarksOf(players: ReadonlyArray<Pick<PublicPlayer, "seat" | "alive" | "look">>, clues: readonly ClueLine[] | undefined): Record<number, OutfitMark[]> {
  const out: Record<number, OutfitMark[]> = {};
  for (const kind of ["cloth", "window"] as const) {
    for (const c of clues ?? []) {
      if (c.kind !== kind || c.piece === undefined) continue;
      for (const seat of sameOutfitSeats(players, c.piece)) {
        const marks = out[seat] ?? (out[seat] = []);
        if (!marks.includes(kind)) marks.push(kind);
      }
    }
  }
  return out;
}

/**
 * 아침 · 현장 조사 화면인가(21-13, D-13·D-16): 확장판의 아침이고 현장(피해자 집, 미수면 노린 집)이 있다. 현장이 없는 밤은 아침 단계 자체가 없다(D-17).
 * 산 사람인지(유령은 지점·카드·[살펴보기] 가 없다)는 부르는 쪽이 본다. 역할을 읽지 않는다
 */
export function sceneMorningOf(view: Pick<RoomView, "phase" | "mode" | "day">): boolean {
  return view.phase === "morning" && rulesetOf(modeOf(view)).errand && view.day?.scene !== undefined;
}

/** 결과 알림(큰 글) 뒤 지점이 서는 시각(단계 시작 기준 ms): 보통 알림(0.4초 뒤 2.4초 동안)이 끝나는 때 */
export const SCENE_ON_AFTER_MS = ANNOUNCE_MORNING_AT + ANNOUNCE_MORNING_MS;
/** 알림이 더 길게 보이는 아침(경찰 결과 알림 2.6초 뒤 2.2초)의 끝. 이때가 지나면 알림이 보이든 말든 선다 — 역할을 읽지 않고 알림이 아직 떠 있는지(announceShown)만 본다 */
export const SCENE_ON_MAX_MS = ANNOUNCE_POLICE_AT + ANNOUNCE_POLICE_MS;

/**
 * 아침 지점이 서기까지 남은 ms(0 이면 지금). 서버 시계 기준이다 — 단계 시작 = phaseEndsAt − 단계 길이.
 * 기본 시각(SCENE_ON_AFTER_MS)이 지나도 결과 알림이 아직 보이면(announceShown) 최대 시각까지 기다린다. 재접속·늦은 합류는 0 이라 연출 없이 바로 선다.
 */
export function sceneDelayMs(view: Pick<RoomView, "phaseEndsAt" | "phaseDurationMs">, serverNow: number, announceShown: boolean): number {
  if (view.phaseEndsAt === null) return 0;
  const start = view.phaseEndsAt - (view.phaseDurationMs ?? MORNING_SCENE_MS);
  const elapsed = serverNow - start;
  if (elapsed >= SCENE_ON_MAX_MS) return 0;
  if (elapsed >= SCENE_ON_AFTER_MS) return announceShown ? SCENE_ON_MAX_MS - elapsed : 0;
  return SCENE_ON_AFTER_MS - elapsed;
}

/** 현장 집의 단서 지점 세 곳(월드 단위). 집이 없거나 표가 없으면 빈 배열. 번호 1~3 순서 */
export function clueSpotPointsOf(house: number | undefined): Array<{ spot: ClueSpotId; x: number; z: number }> {
  const pts = house === undefined ? undefined : TOWN_CLUE_SPOTS[house];
  if (pts === undefined) return [];
  return ([1, 2, 3] as const).map((spot) => ({ spot, x: pts[spot - 1]!.x / UNIT, z: pts[spot - 1]!.z / UNIT }));
}

/**
 * 내 발밑 기준 지점: act = 처리 반경(ERRAND_ACT_R) 안의 안 살핀 지점 중 가장 가까운 것(같으면 번호 작은 것, 서버 판정과 같은 고정소수점 거리),
 * next = 위치와 무관하게 안 살핀 지점 중 가장 가까운 것(위치를 모르면 첫 번째). 안 살핀 지점이 없으면 둘 다 null. 살핀 결과(touched 포함)는 모두 살핀 것이다
 */
export function sceneNearOf(
  pos: { x: number; z: number } | null | undefined,
  house: number | undefined,
  inspected: readonly ClueSpotId[],
): { act: ClueSpotId | null; next: ClueSpotId | null } {
  let act: ClueSpotId | null = null;
  let actD = Infinity;
  let next: ClueSpotId | null = null;
  let nextD = Infinity;
  const reach = Math.round(ERRAND_ACT_R * UNIT);
  for (const pt of clueSpotPointsOf(house)) {
    if (inspected.includes(pt.spot)) continue;
    if (pos === null || pos === undefined) {
      next ??= pt.spot;
      continue;
    }
    const dx = Math.round(pt.x * UNIT) - Math.round(pos.x * UNIT);
    const dz = Math.round(pt.z * UNIT) - Math.round(pos.z * UNIT);
    const d = dx * dx + dz * dz;
    if (d < nextD) {
      nextD = d;
      next = pt.spot;
    }
    if (d <= reach * reach && d < actD) {
      actD = d;
      act = pt.spot;
    }
  }
  return { act, next };
}
