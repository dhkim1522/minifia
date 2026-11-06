// 12-08: 소리 감독(director) — 공개 view 의 차이(AudioView)와 닫힌 로컬 신호·로컬 시계만으로 소리를 정한다 (D-3, D-11, D-17).
// 순수 함수다: 전역 시계·난수·엔진을 읽지 않고 `(prev, cur, local) → 출력` 만 돌려준다. 출력은 useSound 가 엔진에 적용한다.
// 소리 시작 시각은 공개 단계 시각(endsAt)·상수·로컬 시계의 함수이고 프레임 도착 시각이 아니다 (LS-11):
//   예약 지연 = endsAt − (local.now + local.offset)  — 같은 단계 view 가 늦게 도착해도 서버 시각 기준 예약 지점이 같다.
// 첫 스냅샷(직전 view 없음)·연결 번호(epoch) 변경(local.reset)은 현재 단계 침대만 낸다 — 일회성 소리·대본은 없다 (LS-10).
// 12-09 밤: 서버 프레임은 밤 소리를 만들지 않는다 — 밤에 감독이 읽는 것은 단계·마감·일차뿐이고(LS-2), 역할·살아 있음·모션 줄이기는 입력이 아니다(LS-3).
//   큐 스케줄(D-11)은 갈림 불리언 하나(local.visualCues: 시각 맥박이 큐를 내는 중인가)로만 갈린다. 거짓이면 소리 전용 스케줄러(nightCues)가,
//   참이면 TensionVignette 의 큐 신호(tensionCue)가 같은 규칙으로 같은 night.cue 를 낸다. 밤의 모든 닫힌 신호는 무음이다(LS-7).
// 12-10(판결·동작)은 이 파일의 ENTER_SOUND·inPhase 규칙에 더한다.
import { NIGHT_MS } from "../../shared/game/phases";
import type { PhaseId } from "../../shared/protocol";
import type { AudioView } from "./audioView";
import type { BedId, SfxId } from "./recipes";
import { nightCues, pickTickSchedule, tickSchedule, type DuckSpan, type Rng, type ScriptItem } from "./script";
import type { LocalSignal } from "./signals";

/** 단계 → 침대 표: 14개 단계 전수. null 은 침대 없음(assigning: 침대가 페이드아웃). 맵에 따라 바꾸지 않는다 (O-7) */
export const BED_OF: Readonly<Record<PhaseId, BedId | null>> = {
  lobby: "bed.lobby",
  assigning: null,
  roleReveal: "bed.reveal",
  dayAnnounce: "bed.day",
  discussion: "bed.day",
  nomination: "bed.vote",
  runoff: "bed.vote",
  showdown: "bed.vote",
  defense: "bed.vote",
  verdict: "bed.vote",
  execution: "bed.vote",
  night: "bed.night",
  morning: "bed.dawn",
  ended: "bed.result",
};

/** 진입 소리: 단계가 바뀌어 들어올 때 모두에게 한 번 */
const ENTER_SOUND: Partial<Record<PhaseId, SfxId>> = {
  assigning: "game.start",
  roleReveal: "role.flip",
  dayAnnounce: "day.start",
  nomination: "phase.vote",
};

/** 공개 카운트다운 틱을 쓰는 단계 (밤·아침·결과 제외) */
export const TICK_PHASES: readonly PhaseId[] = ["discussion", "defense", "verdict"];

/** 로비 입장 소리의 최소 간격 */
export const JOIN_GAP_MS = 1000;

/** 로컬 시계와 연결 상태. 감독은 전역 시계를 읽지 않는다 */
export interface LocalClock {
  /** 로컬 ms (Date.now 에 해당) */
  now: number;
  /** 서버 시각 − 로컬 시각 (connection.offset) */
  offset: number;
  /** 연결 번호가 바뀐 렌더 (LS-10) */
  reset: boolean;
  /** 마지막으로 lobby.join 을 낸 로컬 시각 */
  lastJoinAt: number | null;
  /** 밤 큐의 난수(각자 폰의 난수, 시험은 시드). 없으면 고정열 — 전역 난수를 읽지 않는다 */
  rng?: Rng;
  /** 시각 맥박(TensionVignette)이 큐를 내고 있는가 — RoomScreen 이 nightDarkOf(view) && !reducedMotion 으로 계산한 불리언 하나(D-11). 감독은 역할을 읽지 않는다 */
  visualCues?: boolean;
}

const FALLBACK_RNG: Rng = () => 0.5;

export interface SoundCall {
  id: SfxId;
  gainDb?: number;
  cents?: number;
}

export interface ScriptRun {
  key: string;
  items: ScriptItem[];
  duck: DuckSpan | null;
}

export interface DirectOutput {
  /** 취소할 대본 키 */
  cancel: string[];
  /** 침대 요청. 키가 없으면 변화 없음, null 이면 페이드아웃 */
  bed?: BedId | null;
  /** 추가 덕킹(레시피에 덕킹이 없는 경우). 이 계획은 쓰지 않는다(game.start 의 −10dB 는 레시피에 있다) */
  duck: DuckSpan | null;
  /** 예약할 대본(같은 키는 교체) */
  scripts: ScriptRun[];
  /** 즉시 낼 소리 */
  now: SoundCall[];
}

export function emptyOutput(): DirectOutput {
  return { cancel: [], duck: null, scripts: [], now: [] };
}

// ───────────────────────── 대본 키 ─────────────────────────

const phaseKey = (v: AudioView): string => `phase:${v.phase}:${v.dayN ?? 0}`;
const nightKey = (v: AudioView): string => `night:${v.dayN ?? 0}`;

function inTurn(v: AudioView): boolean {
  const t = v.turn;
  return v.phase === "nomination" && t !== null && Number.isInteger(t.i) && t.i >= 0 && t.i < t.order.length;
}

/** 이 view 가 만들었을 수 있는 대본 키(취소 대상 계산용) */
function scriptKeys(v: AudioView): string[] {
  const keys: string[] = [];
  if (TICK_PHASES.includes(v.phase)) keys.push(phaseKey(v));
  if (v.phase === "night") keys.push(nightKey(v));
  if (inTurn(v) && v.turn!.doneAt === undefined) keys.push(pickKey(v));
  return keys;
}

const pickKey = (v: AudioView): string => `pick:${v.dayN ?? 0}:${v.turn?.i ?? -1}`;

// ───────────────────────── 지목 핀 (src/world/pinPlan.ts pinOf 의 nomination 부분 복제) ─────────────────────────
// 소리 모듈은 pinPlan 을 import 하지 못한다(LS-6). test/unit/soundDirector.test.ts 가 대표 view 열에서 pinOf 전이와 대조한다.

type Pin = { mode: "turn"; seat: number } | { mode: "slide"; from: number; to: number; startAt: number };

function pinOfAudio(v: AudioView): Pin | null {
  if (v.phase !== "nomination" || v.turn === null) return null;
  const { order, i } = v.turn;
  if (!Number.isInteger(i) || i < 0 || i >= order.length) return null;
  const seat = order[i];
  if (typeof seat !== "number") return null;
  if (v.turn.doneAt === undefined) return { mode: "turn", seat };
  if (v.turn.skip === true) return null; // 기권: 이동 없이 꺼진다
  const line = v.points.find((p) => p.seat === seat);
  if (line === undefined) return null;
  return { mode: "slide", from: seat, to: line.target, startAt: v.turn.doneAt };
}

// ───────────────────────── 감독 ─────────────────────────

/** 서버 시각 기준 남은 ms. endsAt 이 없으면 null */
function remainingMs(endsAt: number | null | undefined, local: LocalClock): number | null {
  if (endsAt === null || endsAt === undefined) return null;
  return endsAt - (local.now + local.offset);
}

/**
 * 소리 전용 밤 큐 대본(D-11). visualCues 가 참이면 만들지 않는다(시각 맥박의 큐 신호가 대신 낸다).
 * 지난 시간은 마감(endsAt)에서 환산한다 — 도착이 늦거나 밤 중간에 합류해도 큐는 남은 시간 안에서만 서고(LS-10, LS-11),
 * 같은 서버 시각의 밤이면 도착 지연과 무관하게 예약 지점이 같다. 시각은 "지금부터 ms" 다.
 */
function nightCueRun(cur: AudioView, local: LocalClock, out: DirectOutput): void {
  if (local.visualCues === true) return;
  const rest = remainingMs(cur.endsAt, local);
  const elapsed = rest === null ? 0 : Math.min(NIGHT_MS, Math.max(0, NIGHT_MS - rest));
  const items: ScriptItem[] = nightCues(local.rng ?? FALLBACK_RNG, elapsed).map((at) => ({ at: at - elapsed, id: "night.cue" as const }));
  out.scripts.push({ key: nightKey(cur), items, duck: null });
}

/** 단계 전환(직전 view 와 단계가 다름) */
function onPhaseChange(prev: AudioView, cur: AudioView, local: LocalClock, out: DirectOutput): void {
  const bed = BED_OF[cur.phase];
  if (bed !== BED_OF[prev.phase]) out.bed = bed;
  const enter = ENTER_SOUND[cur.phase];
  if (enter !== undefined) out.now.push({ id: enter });
  // 밤 진입: night.fall 은 진입 즉시, 큐는 소리 전용 갈래에서만 대본으로(침대는 위 BED_OF)
  if (cur.phase === "night") {
    out.now.push({ id: "night.fall" });
    nightCueRun(cur, local, out);
  }
}

/** 같은 단계 안의 변화 */
function inPhase(prev: AudioView, cur: AudioView, local: LocalClock, out: DirectOutput): void {
  if (cur.phase === "lobby" && cur.players.length > prev.players.length) {
    if (local.lastJoinAt === null || local.now - local.lastJoinAt >= JOIN_GAP_MS) out.now.push({ id: "lobby.join" });
  }
  if (cur.phase !== "nomination") return;
  const pPin = pinOfAudio(prev);
  const cPin = pinOfAudio(cur);
  // 핀 조명이 새 좌석에 켜짐 → 모두 pin.on, 내 차례면 pick.turn 과 마지막 3초 틱
  if (cPin !== null && cPin.mode === "turn" && !(pPin !== null && pPin.mode === "turn" && pPin.seat === cPin.seat)) {
    out.now.push({ id: "pin.on" });
    if (cPin.seat === cur.mySeat) {
      out.now.push({ id: "pick.turn" });
      const rest = remainingMs(cur.turn?.endsAt, local);
      if (rest !== null) {
        const items: ScriptItem[] = pickTickSchedule(rest).map((at) => ({ at, id: "pick.tick" }));
        if (items.length > 0) out.scripts.push({ key: pickKey(cur), items, duck: null });
      }
    }
  }
  // 확정 → 가리킴(pick.point)과 핀 이동(pin.move)이 같은 순간
  if (cPin !== null && cPin.mode === "slide" && !(pPin !== null && pPin.mode === "slide" && pPin.startAt === cPin.startAt)) {
    out.now.push({ id: "pick.point" }, { id: "pin.move" });
  }
  // 기권(공개): 이번 차례의 doneAt 이 새로 섰고 skip
  const pt = prev.turn;
  const ct = cur.turn;
  if (ct !== null && ct.skip === true && ct.doneAt !== undefined && !(pt !== null && pt.i === ct.i && pt.doneAt !== undefined)) {
    out.now.push({ id: "pick.skip" });
  }
}

/** 단계 시작 또는 마감이 바뀐 때의 카운트다운 틱 대본 */
function tickRun(cur: AudioView, local: LocalClock, out: DirectOutput): void {
  if (!TICK_PHASES.includes(cur.phase)) return;
  const rest = remainingMs(cur.endsAt, local);
  if (rest === null) return;
  const items: ScriptItem[] = tickSchedule(rest).map((at) => ({ at, id: "timer.tick" }));
  out.scripts.push({ key: phaseKey(cur), items, duck: null });
}

export function direct(prev: AudioView | null, cur: AudioView | null, local: LocalClock): DirectOutput {
  const out = emptyOutput();
  if (cur === null) return out;
  if (prev === null) {
    out.bed = BED_OF[cur.phase];
    if (cur.phase === "night") nightCueRun(cur, local, out); // 밤 중간 합류: 침대 + 남은 시간 안의 새 큐 (night.fall 없음)
    return out;
  }
  if (local.reset) {
    out.bed = BED_OF[cur.phase];
    out.cancel = scriptKeys(prev);
    if (cur.phase === "night") nightCueRun(cur, local, out);
    return out;
  }
  const phaseChanged = prev.phase !== cur.phase;
  if (phaseChanged) onPhaseChange(prev, cur, local, out);
  else inPhase(prev, cur, local, out);
  if (phaseChanged || prev.endsAt !== cur.endsAt) tickRun(cur, local, out);
  // 이전 view 의 대본 가운데 지금도 유효한 키(같은 키는 runScript 가 교체한다)가 아니면 취소한다
  const live = scriptKeys(cur);
  out.cancel = scriptKeys(prev).filter((k) => !live.includes(k));
  return out;
}

/** 신호 처리에 필요한 로컬 값 — RoomScreen 이 넘긴 불리언뿐이다 */
export interface SignalContext {
  visualCues?: boolean;
}

/**
 * 로컬 신호 처리. 소리를 낼지·어떤 id 인지는 여기서 정한다.
 * 밤에는 모든 닫힌 신호가 무음이다(LS-7) — 시각 큐 갈래의 tensionCue 하나만 night.cue 를 낸다(박자를 시각과 맞춘다, D-11).
 */
export function directSignal(signal: LocalSignal, cur: AudioView | null, ctx: SignalContext = {}): DirectOutput {
  const out = emptyOutput();
  if (cur === null) return out;
  if (cur.phase === "night") {
    if (signal.kind === "tensionCue" && ctx.visualCues === true) out.now.push({ id: "night.cue" });
    return out;
  }
  switch (signal.kind) {
    case "tap":
      out.now.push({ id: "ui.tap" });
      break;
    case "card": {
      // 카드가 화면에 보이는 시각에 ui.card 한 번 — 카드 종류·글은 신호에 없다(LS-5)
      const d = Number.isFinite(signal.delayMs) ? Math.max(0, Math.round(signal.delayMs)) : 0;
      if (d === 0) out.now.push({ id: "ui.card" });
      else out.scripts.push({ key: `card:${cur.dayN ?? 0}:${d}`, items: [{ at: d, id: "ui.card" }], duck: null });
      break;
    }
    case "tensionCue":
      break; // 밤이 아니면 시각 큐도 소리가 없다
  }
  return out;
}
