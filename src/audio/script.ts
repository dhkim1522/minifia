// 12-02: 단계별 순수 대본 (SOUND-02, D-10, D-11, D-13, D-15, LS-6, LS-11).
// 대본의 시각은 상수의 함수이고, 난수는 인자로만 받는다. 시계·서버 프레임·역할·밤 선택·채팅 본문은 입력에 없다.
// 시각 상수는 화면 모듈에서 읽어 온다(복사하지 않는다). 11페이즈 모듈은 LS-6 때문에 import 하지 못해 RESULT_AT 에 모았다.
// 시각은 모두 "그 단계 기준 시각 T0 부터 ms" 다. 시계(T0 와 현재 시각)는 부르는 쪽(감독)이 준다.
import { ANNOUNCE_LEAD_MS, ANNOUNCE_MORNING_AT, ANNOUNCE_TALLY_MS, ANNOUNCE_VICTIM_AT } from "../game/dayView";
import { BALLOT_END_AT, BALLOT_NO_AT, BALLOT_YES_AT } from "../game/verdictMoment";
import { LETTER_FOLD_AT_MS, LETTER_SEAL_GAP_MS, LETTER_WRITE_AT_MS } from "../game/willLetter";
import type { BedId, SfxId } from "./recipes";

export type Rng = () => number;

/** 대본 한 줄: ms 시각에 효과음 한 번. gainDb 는 레시피 위에 더하는 dB, cents 는 음높이 이동 */
export interface ScriptItem {
  at: number;
  id: SfxId;
  gainDb?: number;
  cents?: number;
}

/** 침대 덕킹 구간: fromMs 에 db 만큼 내렸다가 toMs 에서 returnMs 에 걸쳐 복귀 */
export interface DuckSpan {
  fromMs: number;
  toMs: number;
  db: number;
  returnMs: number;
}

export interface Script {
  items: ScriptItem[];
  duck: DuckSpan | null;
}

// ───────────────────────── 시각 상수 ─────────────────────────

/** 판결 앞머리 심장 박동(lub) 시각 — 박 간격 800·700·550·350 으로 빨라진다. dub 는 레시피 안(+160ms) */
export const HEART_AT: readonly number[] = [0, 800, 1500, 2050, 2400];
/** 판결 앞머리 침대 덕킹 */
export const VERDICT_DUCK_DB = -14;
export const VERDICT_DUCK_RETURN_MS = 800;

/**
 * 결과·시상 시각 — 11페이즈 시간표와 같은 값, 12-11 의 시험이 대조한다.
 * (소리 모듈은 11페이즈 모듈을 import 하지 못한다: LS-6)
 */
export const RESULT_AT = {
  flipFirst: 1200,
  flipStep: 400,
  flipMax: 8,
  flipCents: 20,
  verdict: 4600,
  awardBase: 5600,
  awardStep: 2500,
  awardLead: 900,
} as const;
export const RESULT_CLAP_DB = -10;
export const RESULT_DUCK = { db: -6, holdMs: 1400, returnMs: 250 } as const;
export const AWARD_CLAP_DB = -12;
/** 박수 소리 셋의 간격 */
export const CLAP_STEP_MS = 80;
export const CLAP_COUNT = 3;

/** 밤 큐 규칙 — src/world/tension.ts 의 planTensionCues 와 같은 규칙의 복제(시험이 대조한다) */
export const NIGHT_CUE = {
  countMin: 2,
  countMax: 4,
  firstMin: 5000,
  firstSpread: 4000,
  gapMin: 4000,
  gapMax: 9000,
  windowMs: 28000,
  rejoinMarginMs: 1000,
} as const;

/** 편지 쓰기 조각 길이 */
export const QUILL_PIECE_MS = 60;

// ───────────────────────── 판결 ─────────────────────────

export interface VerdictInput {
  passed: boolean;
  last: boolean;
  hasBallots: boolean;
}

/**
 * 처형 진입(T0) 기준 판결 대본. 2600(= ANNOUNCE_LEAD_MS + ANNOUNCE_TALLY_MS) 앞의 목록은 통과/부결에서 같다.
 * 마지막 3인 처형은 0ms 에 gavel + rise 만.
 */
export function verdictScript(input: VerdictInput): Script {
  const { passed, last, hasBallots } = input;
  if (last) {
    return {
      items: [
        { at: 0, id: "execution.gavel" },
        { at: 0, id: "execution.rise" },
      ],
      duck: null,
    };
  }
  const items: ScriptItem[] = HEART_AT.map((at) => ({ at, id: "verdict.heart" }));
  if (hasBallots) {
    items.push({ at: BALLOT_YES_AT, id: "ballot.yes" });
    items.push({ at: BALLOT_NO_AT, id: "ballot.no" });
    items.push({ at: BALLOT_END_AT, id: "ui.card" });
  }
  const announceAt = ANNOUNCE_LEAD_MS + ANNOUNCE_TALLY_MS;
  if (passed) {
    items.push({ at: announceAt, id: "execution.gavel" });
    items.push({ at: announceAt, id: "execution.rise" });
  } else {
    items.push({ at: announceAt, id: "verdict.reject" });
  }
  items.sort((a, b) => a.at - b.at);
  return { items, duck: { fromMs: 0, toMs: BALLOT_END_AT, db: VERDICT_DUCK_DB, returnMs: VERDICT_DUCK_RETURN_MS } };
}

// ───────────────────────── 밤 ─────────────────────────

/**
 * 밤 큐 시각 목록(밤 진입 기준 ms). elapsedMs 0 이면 planTensionCues(rng) 와 같은 난수열에서 같은 목록이다.
 * elapsedMs 가 양수(밤 중간 합류)면 모든 큐가 elapsedMs + 1000 보다 뒤이고 창 안에 든다(남은 시간 안에서 다시 뽑는다).
 */
export function nightCues(rng: Rng, elapsedMs = 0): number[] {
  const r = NIGHT_CUE;
  const count = r.countMin + Math.floor(rng() * (r.countMax - r.countMin + 1));
  const cues: number[] = [];
  const base = Math.max(r.firstMin, Math.max(0, elapsedMs) + r.rejoinMarginMs + 1);
  let at = base + Math.floor(rng() * r.firstSpread);
  for (let i = 0; i < count; i += 1) {
    if (i > 0) at += r.gapMin + Math.floor(rng() * (r.gapMax - r.gapMin + 1));
    if (at >= r.windowMs) break;
    cues.push(at);
  }
  return cues;
}

/** 밤 대본: 처음부터면 night.fall(0) + 큐. 중간 합류(elapsedMs > 0)면 큐만 */
export function nightScript(rng: Rng, elapsedMs = 0): Script {
  const items: ScriptItem[] = [];
  if (elapsedMs <= 0) items.push({ at: 0, id: "night.fall" });
  for (const at of nightCues(rng, elapsedMs)) items.push({ at, id: "night.cue" });
  return { items, duck: null };
}

// ───────────────────────── 아침 ─────────────────────────

export type MorningOutcome = "calm" | "saved" | "victim";

export interface MorningInput {
  outcome: MorningOutcome;
  /** 암살 피해자가 바로 이 화면의 사람인가(killFx 가 선 본인만) */
  mine: boolean;
}

/** 칼날 소리 시각: 아침 view 도착 +50ms (killFx) */
export const MORNING_SLASH_AT = 50;

/** 아침 대본이 깔 침대 */
export interface MorningScript extends Script {
  bed: BedId;
}

/**
 * 아침 진입 기준 대본(C-5): 0 morning.dawn(+ 침대 bed.dawn, 결과와 무관) · 50 kill.slash(내가 암살 피해자일 때만) ·
 * 400 morning.calm(평화) / 400 morning.saved(구출) / 700 chalk.draw(희생자). 시각은 dayView 상수에서 읽는다.
 */
export function morningScript(input: MorningInput): MorningScript {
  const items: ScriptItem[] = [{ at: 0, id: "morning.dawn" }];
  if (input.outcome === "victim") {
    if (input.mine) items.push({ at: MORNING_SLASH_AT, id: "kill.slash" });
    items.push({ at: ANNOUNCE_VICTIM_AT, id: "chalk.draw" });
  } else {
    items.push({ at: ANNOUNCE_MORNING_AT, id: input.outcome === "saved" ? "morning.saved" : "morning.calm" });
  }
  items.sort((a, b) => a.at - b.at);
  return { items, duck: null, bed: "bed.dawn" };
}

// ───────────────────────── 결과·시상 ─────────────────────────

export interface ResultInput {
  n: number;
  win: boolean;
}

function clapsAt(at: number, gainDb: number): ScriptItem[] {
  return Array.from({ length: CLAP_COUNT }, (_, i) => ({ at: at + i * CLAP_STEP_MS, id: "emote.clap" as const, gainDb }));
}

/** 결과 진입 기준: 직업 뒤집기(최대 8, 오를수록 +20 cents) → 승패 소리 + 박수 + 침대 덕킹 */
export function resultScript(input: ResultInput): Script {
  const flips = Math.min(Math.max(0, Math.floor(input.n)), RESULT_AT.flipMax);
  const items: ScriptItem[] = [];
  for (let i = 0; i < flips; i += 1) {
    items.push({ at: RESULT_AT.flipFirst + RESULT_AT.flipStep * i, id: "role.flip", cents: RESULT_AT.flipCents * i });
  }
  items.push({ at: RESULT_AT.verdict, id: input.win ? "result.win" : "result.lose" });
  items.push(...clapsAt(RESULT_AT.verdict, RESULT_CLAP_DB));
  items.sort((a, b) => a.at - b.at);
  return {
    items,
    duck: {
      fromMs: RESULT_AT.verdict,
      toMs: RESULT_AT.verdict + RESULT_DUCK.holdMs,
      db: RESULT_DUCK.db,
      returnMs: RESULT_DUCK.returnMs,
    },
  };
}

export interface AwardInput {
  k: number;
  total: number;
}

/** 시상 k번째 패(결과 진입 기준): 패 소리 + 같은 시각 박수. 마지막 패는 award.final */
export function awardScript(input: AwardInput): Script {
  const at = RESULT_AT.awardBase + RESULT_AT.awardStep * input.k + RESULT_AT.awardLead;
  const id: SfxId = input.k >= input.total - 1 ? "award.final" : "award.plate";
  return { items: [{ at, id }, ...clapsAt(at, AWARD_CLAP_DB)], duck: null };
}

// ───────────────────────── 유언 편지 ─────────────────────────

export interface WillInput {
  writeMs: number;
}

/** 편지 T0 기준: 쓰기 조각 → 인장 → 접힘. writeMs 0 이하면 빈 목록 */
export function willScript(input: WillInput): Script {
  if (!(input.writeMs > 0)) return { items: [], duck: null };
  const items: ScriptItem[] = [];
  const pieces = Math.floor(input.writeMs / QUILL_PIECE_MS);
  for (let j = 0; j < pieces; j += 1) items.push({ at: LETTER_WRITE_AT_MS + j * QUILL_PIECE_MS, id: "will.quill" });
  items.push({ at: LETTER_WRITE_AT_MS + input.writeMs + LETTER_SEAL_GAP_MS, id: "will.seal" });
  items.push({ at: LETTER_FOLD_AT_MS, id: "will.fold" });
  items.sort((a, b) => a.at - b.at);
  return { items, duck: null };
}

// ───────────────────────── 동작 소리 게이트 (12-10, D-14, T-12-39) ─────────────────────────

/** 동작 소리: 1초(창) 안에 3개까지 */
export const EMOTE_SOUND_PER_SEC = 3;
export const EMOTE_SOUND_WINDOW_MS = 1000;
/** 동시에 울리는 동작 소리 상한 — src/world/emoteCap.ts 의 EMOTE_RENDER_MAX 와 같은 값이다(소리 모듈은 world/ 를 import 하지 못해 시험이 대조한다) */
export const EMOTE_SOUND_MAX = 4;
/** 남의 동작 소리는 레시피 위에 이만큼 낮춘다(내 동작은 0dB) */
export const EMOTE_OTHERS_DB = -6;

/** 게이트 상태: 최근 수락한 동작 소리의 시작 시각과 끝날 것으로 추정한 시각(수락 시각 + 그 레시피 길이) */
export interface EmoteGateState {
  accepted: readonly { at: number; endAt: number }[];
}
export const EMOTE_GATE_EMPTY: EmoteGateState = Object.freeze({ accepted: Object.freeze([]) });

/**
 * 동작 소리 한 개를 받아들일지 정한다(순수, 시각은 인자). 최근 1000ms 안 수락이 3개이거나 활성 추정이 4개 이상이면 거절 —
 * 거절은 조용히 버리고 상태를 바꾸지 않는다(같은 객체). 수락하면 지난 항목을 정리한 새 상태를 준다. durationMs 는 이 소리의 레시피 길이.
 */
export function emoteSoundGate(state: EmoteGateState, now: number, durationMs: number): { ok: boolean; next: EmoteGateState } {
  const recent = state.accepted.filter((a) => now - a.at < EMOTE_SOUND_WINDOW_MS);
  const active = state.accepted.filter((a) => a.endAt > now);
  if (recent.length >= EMOTE_SOUND_PER_SEC || active.length >= EMOTE_SOUND_MAX) return { ok: false, next: state };
  const kept = state.accepted.filter((a) => now - a.at < EMOTE_SOUND_WINDOW_MS || a.endAt > now);
  return { ok: true, next: { accepted: [...kept, { at: now, endAt: now + Math.max(0, durationMs) }] } };
}

// ───────────────────────── 카운트다운 ─────────────────────────

function boundaryDelays(remainingMs: number, seconds: readonly number[]): number[] {
  const out: number[] = [];
  for (const s of seconds) {
    const delay = remainingMs - s * 1000;
    if (delay >= 0) out.push(delay);
  }
  return out;
}

/** 공개 카운트다운 timer.tick: 남은 5·4·3·2·1초 경계까지 남은 ms(이미 지난 경계는 뺀다). 밤·아침·결과 제외는 감독 몫 */
export function tickSchedule(remainingMs: number): number[] {
  return boundaryDelays(remainingMs, [5, 4, 3, 2, 1]);
}

/** 내 차례 pick.tick: 남은 3·2·1초 경계까지 남은 ms */
export function pickTickSchedule(remainingMs: number): number[] {
  return boundaryDelays(remainingMs, [3, 2, 1]);
}
