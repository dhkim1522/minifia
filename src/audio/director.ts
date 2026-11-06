// 12-08: 소리 감독(director) — 공개 view 의 차이(AudioView)와 닫힌 로컬 신호·로컬 시계만으로 소리를 정한다 (D-3, D-11, D-17).
// 순수 함수다: 전역 시계·난수·엔진을 읽지 않고 `(prev, cur, local) → 출력` 만 돌려준다. 출력은 useSound 가 엔진에 적용한다.
// 소리 시작 시각은 공개 단계 시각(endsAt)·상수·로컬 시계의 함수이고 프레임 도착 시각이 아니다 (LS-11):
//   예약 지연 = endsAt − (local.now + local.offset)  — 같은 단계 view 가 늦게 도착해도 서버 시각 기준 예약 지점이 같다.
// 첫 스냅샷(직전 view 없음)·연결 번호(epoch) 변경(local.reset)은 현재 단계 침대만 낸다 — 일회성 소리·대본은 없다 (LS-10).
// 12-09 밤: 서버 프레임은 밤 소리를 만들지 않는다 — 밤에 감독이 읽는 것은 단계·마감·일차뿐이고(LS-2), 역할·살아 있음·모션 줄이기는 입력이 아니다(LS-3).
//   큐 스케줄(D-11)은 갈림 불리언 하나(local.visualCues: 시각 맥박이 큐를 내는 중인가)로만 갈린다. 거짓이면 소리 전용 스케줄러(nightCues)가,
//   참이면 TensionVignette 의 큐 신호(tensionCue)가 같은 규칙으로 같은 night.cue 를 낸다. 밤의 모든 닫힌 신호는 무음이다(LS-7).
// 12-09 아침: 진입 morning.dawn(결과와 무관) + 공개 결과 분기(평화·구출·희생자). 암살음·유언 편지·경찰 카드는 숫자뿐인 개인 사건(directEvent)으로 받는다.
//   kill.slash 는 view 만으로는 절대 나지 않는다 — killFx 가 선 본인의 입력이 있을 때만(LS-8).
// 12-10 판결: 처형 진입에서 verdictScript 를 T0 = endsAt − EXECUTION_MS(서버 시각) 기준으로 예약한다. 2600ms 앞 소리는 통과/부결에서 같아 결과가 미리 새지 않는다.
//   도착이 늦은 view 는 GRACE_MS 안에 든 항목만 지금 내고 지난 항목은 버린다. 처형 중간 합류·epoch 변경은 침대만이다(LS-10, LS-11).
// 12-10 결선·마지막 3인·핀: runoff.intro·runoff.reveal·showdown.reveal 과 pin.on 은 공개 view 차이(day.runoff.step·day.showdown.i)로만 정한다.
//   pinOfAudio 는 src/world/pinPlan.ts pinOf 의 지목·결선·마지막 3인·처형 분기를 복제한 것이고 시험이 대표 view 열에서 전이를 대조한다.
// 12-10 동작: emote 신호는 받은 프레임에서만 온다. 감독은 게이트(emoteSoundGate, 초당 3·동시 4)와 mine 에 따른 gainDb 만 정한다.
import { EXECUTION_MS, NIGHT_MS } from "../../shared/game/phases";
import type { PhaseId } from "../../shared/protocol";
import { POLICE_CARD_AT } from "../game/dayView";
import type { AudioView } from "./audioView";
import { recipeDurationMs, type BedId, type SfxId } from "./recipes";
import { EMOTE_OTHERS_DB, emoteSoundGate, flipCue, lightCues, MORNING_SLASH_AT, morningScript, nightCues, plateCues, pickTickSchedule, tickSchedule, verdictScript, willScript, type DuckSpan, type EmoteGateState, type Rng, type ScriptItem } from "./script";
import type { EmoteSignal, LocalSignal, ResultSignal } from "./signals";

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
  runoff: "runoff.intro",
};

/** 공개 카운트다운 틱을 쓰는 단계 (밤·아침·결과 제외) */
export const TICK_PHASES: readonly PhaseId[] = ["discussion", "defense", "verdict"];

/** 로비 입장 소리의 최소 간격 */
export const JOIN_GAP_MS = 1000;

/** 도착 지연 유예(LS-11): 대본 항목의 시각이 이만큼 안쪽으로 지났으면 지금 내고, 더 지났으면 버린다 (한 곳) */
export const GRACE_MS = 250;

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
const killKey = (v: AudioView): string => `kill:${v.dayN ?? 0}`;
const letterKey = (v: AudioView): string => `letter:${v.dayN ?? 0}`;
const policeCardKey = (v: AudioView): string => `card:police:${v.dayN ?? 0}`;

function inTurn(v: AudioView): boolean {
  const t = v.turn;
  return v.phase === "nomination" && t !== null && Number.isInteger(t.i) && t.i >= 0 && t.i < t.order.length;
}

/** 이 view 가 만들었을 수 있는 대본 키(취소 대상 계산용) */
function scriptKeys(v: AudioView): string[] {
  const keys: string[] = [];
  if (TICK_PHASES.includes(v.phase)) keys.push(phaseKey(v));
  if (v.phase === "night") keys.push(nightKey(v));
  if (v.phase === "morning") keys.push(phaseKey(v), killKey(v), letterKey(v), policeCardKey(v));
  if (v.phase === "execution") keys.push(phaseKey(v));
  if (v.phase === "ended") {
    keys.push(RESULT_LIGHT_KEY);
    for (let k = 0; k < RESULT_PLATE_KEYS_MAX; k += 1) keys.push(`${RESULT_PLATE_KEY}${k}`);
  }
  if (inTurn(v) && v.turn!.doneAt === undefined) keys.push(pickKey(v));
  return keys;
}

/** 결과 사건 대본 키: 박수 꼬리(80·160ms)가 로비로 넘어가면 취소되게 scriptKeys 가 ended 에서 이 키들을 낸다 */
const RESULT_LIGHT_KEY = "result:light";
const RESULT_PLATE_KEY = "result:plate:";
const RESULT_PLATE_KEYS_MAX = 16;
const pickKey = (v: AudioView): string => `pick:${v.dayN ?? 0}:${v.turn?.i ?? -1}`;

// ───────────────────────── 지목 핀 (src/world/pinPlan.ts pinOf 의 nomination 부분 복제) ─────────────────────────
// 소리 모듈은 pinPlan 을 import 하지 못한다(LS-6). test/unit/soundDirector.test.ts 가 대표 view 열에서 pinOf 전이와 대조한다.

type Pin = { mode: "turn"; seat: number } | { mode: "slide"; from: number; to: number; startAt: number } | { mode: "fixed"; seat: number } | { mode: "point" };

function pinOfAudio(v: AudioView): Pin | null {
  if (v.phase === "runoff") return { mode: "point" }; // 결선: 두 후보 가운데 한 점(위치는 소리에 필요 없다)
  if (v.phase === "showdown") {
    // 마지막 3인 한마디: 차례 중(i 0..2)에 말하는 사람
    const sd = v.showdown;
    if (sd === null || !Number.isInteger(sd.i) || sd.i < 0 || sd.i > 2) return null;
    const seat = sd.order[sd.i];
    return typeof seat === "number" ? { mode: "turn", seat } : null;
  }
  if (v.phase === "execution") {
    // 처형 핀(pinPlan executionPin): 변론자가 있고 (마지막 3인 처형이거나 찬반 기록이 있고) 마감이 있을 때
    if (typeof v.candidate !== "number" || v.verdict === null) return null;
    if ((!v.verdict.last && !v.hasBallots) || v.endsAt === null) return null;
    return { mode: "fixed", seat: v.candidate };
  }
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

/** 지금(0) 이하의 줄은 즉시 소리로, 앞의 줄은 키 대본으로 낸다. 이미 지난(음수) 줄은 버린다 */
function emitTimed(key: string, items: ScriptItem[], out: DirectOutput): void {
  const later: ScriptItem[] = [];
  for (const item of items) {
    if (item.at < 0) continue;
    if (item.at === 0) out.now.push({ id: item.id, ...(item.gainDb !== undefined ? { gainDb: item.gainDb } : {}), ...(item.cents !== undefined ? { cents: item.cents } : {}) });
    else later.push(item);
  }
  if (later.length > 0) out.scripts.push({ key, items: later, duck: null });
}

/**
 * 처형 진입 판결 대본(C-3, D-13). T0 = endsAt − EXECUTION_MS(서버 시각). 항목의 지금 대비 지연 = T0 + at − serverNow.
 * 지연이 −GRACE_MS 이상 0 미만이면 지금(0), 그보다 지났으면 버린다. 덕킹은 남은 구간만 건다.
 * 찬반 기록이 있거나 마지막 3인 처형이고 변론자(candidate)가 있으면 처형 진입에 핀 조명(pin.on)이 함께 켜진다 — pinOf 의 처형 핀과 같은 조건이다.
 */
function verdictRun(cur: AudioView, local: LocalClock, out: DirectOutput): void {
  const v = cur.verdict;
  const rest = remainingMs(cur.endsAt, local);
  if (v === null || rest === null) return;
  const elapsed = EXECUTION_MS - rest; // = serverNow − T0
  const script = verdictScript({ passed: v.passed, last: v.last, hasBallots: cur.hasBallots });
  const nominal: ScriptItem[] = [...script.items];
  if (pinOfAudio(cur) !== null) nominal.unshift({ at: 0, id: "pin.on" });
  const kept: ScriptItem[] = [];
  for (const item of nominal) {
    const delay = item.at - elapsed;
    if (delay < -GRACE_MS) continue;
    kept.push({ ...item, at: Math.max(0, delay) });
  }
  const later: ScriptItem[] = [];
  for (const i of kept) {
    if (i.at > 0) later.push(i);
    else out.now.push({ id: i.id, ...(i.gainDb !== undefined ? { gainDb: i.gainDb } : {}), ...(i.cents !== undefined ? { cents: i.cents } : {}) });
  }
  const d = script.duck;
  const duck: DuckSpan | null =
    d !== null && d.toMs - elapsed > 0 ? { fromMs: Math.max(0, d.fromMs - elapsed), toMs: d.toMs - elapsed, db: d.db, returnMs: d.returnMs } : null;
  if (later.length > 0 || duck !== null) out.scripts.push({ key: phaseKey(cur), items: later, duck });
}

/** 아침 진입 대본(C-5): 시각은 아침 view 도착 기준 — 아침 길이가 가변이라 마감에서 역산하지 않는다. 암살음은 여기 없다(killFx 입력만) */
function morningEnter(cur: AudioView, out: DirectOutput): void {
  const m = cur.morning;
  const outcome = m !== null && m.eliminated ? "victim" : m !== null && m.saved ? "saved" : "calm";
  emitTimed(phaseKey(cur), morningScript({ outcome, mine: false }).items, out);
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
  if (cur.phase === "morning") morningEnter(cur, out);
  if (cur.phase === "runoff" || cur.phase === "showdown") {
    if (pinOfAudio(cur) !== null) out.now.push({ id: "pin.on" }); // 결선은 진입에 점 핀, 마지막 3인은 처음부터 차례가 서 있을 때만
  }
  if (cur.phase === "execution") verdictRun(cur, local, out);
}

/** 같은 단계 안의 변화 */
function inPhase(prev: AudioView, cur: AudioView, local: LocalClock, out: DirectOutput): void {
  if (cur.phase === "lobby" && cur.players.length > prev.players.length) {
    if (local.lastJoinAt === null || local.now - local.lastJoinAt >= JOIN_GAP_MS) out.now.push({ id: "lobby.join" });
  }
  if (cur.phase === "runoff") {
    // 득표 수 공개: step 이 2 로 바뀌는 순간 한 번
    if (cur.runoff !== null && cur.runoff.step === 2 && !(prev.runoff !== null && prev.runoff.step === 2)) out.now.push({ id: "runoff.reveal" });
    return;
  }
  if (cur.phase !== "nomination" && cur.phase !== "showdown") return;
  const pPin = pinOfAudio(prev);
  const cPin = pinOfAudio(cur);
  // 핀 조명이 새 좌석에 켜짐 → 모두 pin.on, 지목에서 내 차례면 pick.turn 과 마지막 3초 틱
  if (cPin !== null && cPin.mode === "turn" && !(pPin !== null && pPin.mode === "turn" && pPin.seat === cPin.seat)) {
    out.now.push({ id: "pin.on" });
    if (cur.phase === "nomination" && cPin.seat === cur.mySeat) {
      out.now.push({ id: "pick.turn" });
      const rest = remainingMs(cur.turn?.endsAt, local);
      if (rest !== null) {
        const items: ScriptItem[] = pickTickSchedule(rest).map((at) => ({ at, id: "pick.tick" }));
        if (items.length > 0) out.scripts.push({ key: pickKey(cur), items, duck: null });
      }
    }
  }
  if (cur.phase === "showdown") {
    // 동시 지목 공개(i 4): 화살표가 한꺼번에 드러나는 순간 한 번
    if (cur.showdown !== null && cur.showdown.i === 4 && !(prev.showdown !== null && prev.showdown.i === 4)) out.now.push({ id: "showdown.reveal" });
    return;
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

/** 결과 사건 하나의 소리(12-11, C-6). ended 단계에서만 난다 — 다른 단계의 result 신호는 무시한다(T-12-41). 사건이 시계에서 한 번 나가므로 감독은 상태를 쥐지 않는다 */
function resultSignal(signal: ResultSignal, cur: AudioView, out: DirectOutput): void {
  if (cur.phase !== "ended") return;
  if (signal.step === "flip") {
    emitTimed(`result:flip:${signal.i}`, flipCue(signal.i), out);
    return;
  }
  if (signal.step === "light") {
    const s = lightCues({ win: signal.win });
    emitTimed(RESULT_LIGHT_KEY, s.items, out);
    out.duck = s.duck;
    return;
  }
  emitTimed(`${RESULT_PLATE_KEY}${signal.k}`, plateCues({ k: signal.k, total: signal.total }), out);
}

/**
 * 로컬 신호 처리. 소리를 낼지·어떤 id 인지는 여기서 정한다.
 * 밤에는 사용자 행동 신호가 모두 무음이다(LS-7) — 시각 큐 갈래의 tensionCue 하나만 night.cue 를 낸다(박자를 시각과 맞춘다, D-11).
 * 예외는 host 하나: 자막 띠의 공개 단계 전환(HOST-02)이라 밤 진입에도 모든 역할에게 같은 프레임에 같은 ui.host 가 난다 —
 * LS-7 은 '내 행동·내 역할이 소리로 드러나지 않게' 하는 규칙이고, host 는 인자가 없고 모두에게 같다(결정 0073, T-14-08).
 */
export function directSignal(signal: LocalSignal, cur: AudioView | null, ctx: SignalContext = {}): DirectOutput {
  const out = emptyOutput();
  if (cur === null) return out;
  if (signal.kind === "host") {
    out.now.push({ id: "ui.host" });
    return out;
  }
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
    case "vote":
      out.now.push({ id: "vote.cast" }); // 찬성·반대 구분 없는 한 가지 소리(LS-7). 120ms 안 되풀이는 레시피 gapMs 가 막는다
      break;
    case "deny":
      out.now.push({ id: "ui.deny" });
      break;
    case "emote":
      break; // 동작 소리는 게이트 상태가 필요해 directEmote 가 맡는다
    case "result":
      resultSignal(signal, cur, out);
      break;
    case "tensionCue":
      break; // 밤이 아니면 시각 큐도 소리가 없다
  }
  return out;
}

/**
 * 받은 동작 프레임의 소리(12-10, D-14, LS-4). 신호는 방 화면이 서버에서 받은 프레임을 처리하는 자리에서만 오므로 받지 못한 프레임은 소리도 없다.
 * 밤에도 받은 프레임이면 난다(수신자는 서버가 정한 마피아·유령). 내 동작 0dB, 남의 동작 −6dB. 게이트(초당 3·동시 4)가 거절하면 아무것도 내지 않는다.
 * 모션 줄이기는 입력에 없다(O-5). 게이트 상태는 부르는 쪽이 쥐고 돌려받은 값을 다음 호출에 넘긴다.
 */
export function directEmote(signal: EmoteSignal, cur: AudioView | null, gate: EmoteGateState, now: number): { out: DirectOutput; gate: EmoteGateState } {
  const out = emptyOutput();
  if (cur === null) return { out, gate };
  const id: SfxId = `emote.${signal.id}`;
  const r = emoteSoundGate(gate, now, recipeDurationMs(id));
  if (!r.ok) return { out, gate };
  out.now.push({ id, gainDb: signal.mine ? 0 : EMOTE_OTHERS_DB });
  return { out, gate: r.next };
}

/**
 * 숫자뿐인 개인 사건(12-09). 글·결과·좌석은 받지 않는다 — 시각은 로컬 시계의 함수다.
 *   kill: killFx 가 선 본인의 화면에서만 들어온다(의사가 살린 사람·남의 화면·재접속에는 입력이 없다, LS-8). killFx.at(로컬 ms) + 50ms 에 한 번.
 *   letter: 편지 시작 t0(로컬 ms)와 쓰는 길이 writeMs — willScript 를 t0 기준으로 옮긴다. 편지가 늦게 떠서 이미 지난 줄은 버린다.
 *   policeCard: 경찰 카드 도착 — POLICE_CARD_AT 에 ui.card 한 번(모든 카드가 같은 소리, LS-5).
 * 아침 단계가 아니면 모두 무음이다(밤 중 암살음 0).
 */
export type PersonalEvent = { kind: "kill"; at: number } | { kind: "letter"; t0: number; writeMs: number } | { kind: "policeCard" };

export function directEvent(event: PersonalEvent, cur: AudioView | null, local: Pick<LocalClock, "now">): DirectOutput {
  const out = emptyOutput();
  if (cur === null || cur.phase !== "morning") return out;
  switch (event.kind) {
    case "kill":
      emitTimed(killKey(cur), [{ at: Math.max(0, event.at + MORNING_SLASH_AT - local.now), id: "kill.slash" }], out);
      break;
    case "letter": {
      const shift = event.t0 - local.now;
      emitTimed(letterKey(cur), willScript({ writeMs: event.writeMs }).items.map((i) => ({ ...i, at: i.at + shift })), out);
      break;
    }
    case "policeCard":
      emitTimed(policeCardKey(cur), [{ at: POLICE_CARD_AT, id: "ui.card" }], out);
      break;
  }
  return out;
}
