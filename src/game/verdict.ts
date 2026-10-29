// DOM·현재 시각·난수를 읽지 않는 순수 모듈 — 시각은 인자로만 받는다. 4페이즈 화면 연출의 수치는 이 파일 한 곳에서만 고친다(D-38). 공개 앞·한 표·뒤 여유는 서버 공개 길이와 같은 출처(shared/game/phases)다(결정 0039).
//
// 구성: (1) 상수 (2) 공개 시간표 revealPlan·revealStateAt·clinchedTarget (3) 기하 candidateCenter·chipAnchor·arrowEndpoints
// (4) 후광 상한 capHalos (5) 문구 정본 VERDICT_TEXT 와 문구 함수. 이 파일은 역할 문자열(직업 단어)을 만들지 않는다 —
// 입력은 서버가 모두에게 보낸 공개 타입뿐이다(D-09).
import { CANDIDATE_REVEAL_LEAD_MS, CANDIDATE_REVEAL_SLOT_MS, CANDIDATE_REVEAL_TAIL_MS } from "../../shared/game/phases";
import type { CandidateVoteLine, ExecTally, GameWinner, NoExecutionReason, SummaryRow, VoteLogEntry } from "../../shared/protocol";
import { dayTableGeometry, FIG_H, FIG_W, HALO_MAX_SIMULTANEOUS, NAME_TAG_MAX_W, TAG_H, type DaySeatPlace } from "./dayTable";

// ---- (1) 상수 (UI-SPEC 13.1, 결정 0039 개정) ----
export const EXEC_INTRO_MS = 3000; // UI-SPEC 13.1, 결정 0039: "처형 투표" 카드(§9.1). 서버 execVote 13초 안에서 뜨고 시간을 깎지 않음(카드 뒤 10초 이상 남음)
export const NO_EXEC_CARD_MS = 1600; // UI-SPEC 13.1: 처형 무효 카드(§9.2)
export const NO_EXEC_INTRO_DELAY_MS = 1600; // UI-SPEC 13.1: 무효 카드가 있을 때 밤 시작 문구를 미루는 시간
export const REVEAL_LEAD_MS = CANDIDATE_REVEAL_LEAD_MS; // 결정 0039: 공개 단계 시작 뒤 첫 화살표까지(400). 서버 공개 길이와 같은 출처
export const REVEAL_SLOT_MS = CANDIDATE_REVEAL_SLOT_MS; // 결정 0039: 한 표 슬롯(2000) 고정. 서버 공개 길이와 같은 출처
export const REVEAL_TAIL_MS = CANDIDATE_REVEAL_TAIL_MS; // 결정 0039: 마지막 슬롯 뒤 끝 문구(600). 서버 공개 길이와 같은 출처
export const REVEAL_DRAW_MS = 1200; // 결정 0039: 한 화살표가 자라는 시간(슬롯 안) = 닿는 시각
export const REVEAL_FADE_MS = 120; // UI-SPEC 13.2: 닿은 화살표가 사라지는 시간
export const REVEAL_REDUCED_HOLD_MS = REVEAL_DRAW_MS; // UI-SPEC 13.4, 결정 0039: 축소 모션에서 완성된 화살표를 닿을 때까지 보여 주고 칩 +1 과 함께 사라지게 한다(이후 REVEAL_FADE_MS 동안 사라짐)
export const CLINCH_BEAT_MS = 700; // UI-SPEC 8.3: 과반 확정 두근(캐릭터·칩 2회) 길이. 이후는 공개가 끝날 때까지 느린 박동
export const REVEAL_POP_MS = 220; // UI-SPEC 8.3: 칩 팝 길이(화면 애니메이션 시간. 팝 대상 해제는 다음 화살표 시작)
export const VERDICT_MOVE_MS = 600; // UI-SPEC 8.4: 후보 가운데 이동
export const VERDICT_DIM_FADE_MS = 400; // UI-SPEC 8.4: 어둡게 층 페이드인
export const VERDICT_CONE_DELAY_MS = 200; // UI-SPEC 8.4: 원뿔은 이동 시작 200ms 뒤
export const VERDICT_CONE_FADE_MS = 500; // UI-SPEC 8.4: 원뿔 페이드인
export const VERDICT_DIM_PERCENT = 45; // D-15·D-38
export const VERDICT_BLUR_PX = 3; // D-15·D-38
export const VERDICT_CANDIDATE_SCALE = 1.7; // UI-SPEC 4: 후보 가운데 크기 배율(72×96 → 122.4×163.2)
export const CONE_W = 300; // UI-SPEC 4: 원뿔 크기
export const CONE_H = 340; // UI-SPEC 8.4
export const GHOST_FADE_MS = 400; // UI-SPEC 13.3: 사람 → 유령 전환
export const INTRO_CARD_W = 280; // UI-SPEC 9.1: 처형 투표·처형 무효 카드 폭
export const INTRO_CARD_H = 176; // UI-SPEC 9.1: 카드 높이
export const INTRO_CARD_UP = 105; // UI-SPEC 9.1: 카드 위쪽 = 장면 위 + (cy − 105)
export const INTRO_CHEV_MIN_H = 96; // UI-SPEC 9.1: 셰브런 높이 clamp 아래
export const INTRO_CHEV_MAX_H = 230; // UI-SPEC 9.1: 셰브런 높이 clamp 위(시안 120×230)
export const INTRO_CHEV_BOTTOM = 16; // UI-SPEC 9.1: 셰브런 아래끝 = 장면 아래 − 16
export const CLINCH_VIBRATE_MS = 30; // UI-SPEC 13.1: 확정 순간 진동(선택)
export const CHIP_H = 24; // UI-SPEC 8.3: 표수 칩 높이
export const CHIP_H_LEAD = 32; // UI-SPEC 4·8.3: 강조(유일한 최다 득표) 칩 높이
export const CHIP_W = 28; // UI-SPEC 8.3: 표수 칩 최소 폭
export const CHIP_W_LEAD = 36; // UI-SPEC 8.3: 강조 칩 폭
export const DEFENSE_SENT_MS = 2000; // UI-SPEC 8.4 P-8: 후보 본인 안내 줄이 '보냈어요 · 문장' 으로 바뀌는 시간
export const RESULT_BANNER_MS = 360; // UI-SPEC 11.2: 배너 팝
export const RESULT_FLIP_AT_MS = 300; // UI-SPEC 11.2: 카드가 직업 그림으로 바뀌는 시각
export const RESULT_FLIP_MS = 360; // UI-SPEC 11.2: 카드 scale 1 → 1.06 → 1
export const RESULT_SUMMARY_AT_MS = 900; // UI-SPEC 11.2: 요약 카드·버튼이 나타나는 시각
export const RESULT_REDUCED_FADE_MS = 160; // UI-SPEC 11.2: 모션 줄이기 페이드

// ---- (2) 공개 시간표 ----
/** 공개 한 단계: 투표자가 대상을 고른 화살표 하나. 시각은 모두 서버 시각(ms) 기준이다. */
export interface RevealStep {
  index: number;
  voter: number;
  target: number;
  /** 화살표가 자라기 시작하는 시각 */
  startMs: number;
  /** 화살표가 대상에 닿는 시각 = 칩 +1 */
  touchMs: number;
  /** 화살표가 완전히 사라지는 시각 */
  fadeEndMs: number;
}
/** 끝 상태의 결과 종류: 유일한 최다 득표 · 최다 동률 · 던진 표 없음 */
export type RevealOutcome = "leader" | "tie" | "none";
export interface RevealPlan {
  startMs: number;
  /** 한 표 슬롯 길이. n=0 이면 0 */
  slotMs: number;
  /** 마지막 슬롯 끝(끝 상태 시작). n=0 이면 startMs */
  endMs: number;
  steps: RevealStep[];
  /** D-31 ③: 남은 공개 표를 전부 받아도 역전할 수 없게 되는 첫 순간. 없으면 null */
  clinch: { seat: number; atMs: number; step: number } | null;
  outcome: RevealOutcome;
  /** 유일한 최다 득표 후보. outcome 이 leader 일 때만 */
  finalLeader: number | null;
  /** 유일한 최다 득표 후보의 표 수. outcome 이 leader 가 아니면 0 */
  finalLeaderVotes: number;
}

/** 1위 수가 1위 외 최댓값 + 남은 표보다 클 때만 그 자리, 아니면 null (D-31 ③). counts 는 자리 → 표 수. */
export function clinchedTarget(counts: Readonly<Record<number, number>>, remaining: number): number | null {
  const entries = Object.keys(counts).map((key) => ({ seat: Number(key), votes: counts[Number(key)] }));
  if (entries.length === 0) return null;
  entries.sort((a, b) => b.votes - a.votes);
  const c1 = entries[0].votes;
  const c2 = entries.length > 1 ? entries[1].votes : 0;
  return c1 > c2 + Math.max(0, remaining) ? entries[0].seat : null;
}

function leaderOf(counts: Readonly<Record<number, number>>): number | null {
  let best = 0;
  let seat: number | null = null;
  let tied = false;
  for (const key of Object.keys(counts)) {
    const c = counts[Number(key)];
    if (c > best) {
      best = c;
      seat = Number(key);
      tied = false;
    } else if (c === best && best > 0) {
      tied = true;
    }
  }
  return tied ? null : seat;
}

/**
 * 공개 시간표. votes 는 서버가 정한 순서 그대로(정렬·셔플하지 않는다), startMs 는 단계 시작의 서버 시각.
 * 슬롯 = REVEAL_SLOT_MS(2000) 고정, 단계 k 의 시작 = startMs + REVEAL_LEAD_MS + k×슬롯. endMs + REVEAL_TAIL_MS = 서버 마감(startMs + candidateRevealMs(n)), 결정 0039.
 * 입력 배열은 바꾸지 않는다.
 */
export function revealPlan(votes: readonly CandidateVoteLine[], startMs: number): RevealPlan {
  const n = votes.length;
  const slotMs = n === 0 ? 0 : REVEAL_SLOT_MS;
  const steps: RevealStep[] = votes.map((v, index) => {
    const start = startMs + REVEAL_LEAD_MS + index * slotMs;
    const touch = start + REVEAL_DRAW_MS;
    return { index, voter: v.seat, target: v.target, startMs: start, touchMs: touch, fadeEndMs: touch + REVEAL_FADE_MS };
  });
  const counts: Record<number, number> = {};
  let clinch: RevealPlan["clinch"] = null;
  steps.forEach((s, k) => {
    counts[s.target] = (counts[s.target] ?? 0) + 1;
    if (clinch === null) {
      const seat = clinchedTarget(counts, n - (k + 1));
      if (seat !== null) clinch = { seat, atMs: s.touchMs, step: k };
    }
  });
  const finalLeader = leaderOf(counts);
  const outcome: RevealOutcome = n === 0 ? "none" : finalLeader === null ? "tie" : "leader";
  return {
    startMs,
    slotMs,
    endMs: n === 0 ? startMs : startMs + REVEAL_LEAD_MS + n * slotMs,
    steps,
    clinch,
    outcome,
    finalLeader,
    finalLeaderVotes: finalLeader === null ? 0 : counts[finalLeader],
  };
}

export interface RevealArrow {
  step: number;
  voter: number;
  target: number;
  /** 0~1 선형(이징은 화면이 입힌다) */
  progress: number;
  /** 닿은 뒤 사라지는 동안 1 → 0, 그 전엔 1 */
  opacity: number;
}
export interface RevealState {
  /** 자리 → 지금까지 닿은 표 수 */
  counts: Record<number, number>;
  /** 지금 보이는 화살표 하나(쌓지 않는다, D-20) */
  arrow: RevealArrow | null;
  /** 가장 최근에 시작한 단계 번호(문구용). 첫 화살표 전엔 null */
  current: number | null;
  /** 방금 닿은 자리. 다음 화살표가 시작하거나 마지막 슬롯이 끝나면 null */
  pop: number | null;
  /** 지금 칩 수의 유일한 최다 자리. 동률 선두는 null(P-14) */
  leader: number | null;
  /** 확정 사건 시각이 지났다면 그 후보 */
  clinched: number | null;
  /** 마지막 슬롯 끝 이후 */
  ended: boolean;
  outcome: RevealOutcome;
  finalLeader: number | null;
}

/** 서버 시각 now 의 공개 상태. 같은 now 면 어느 폰에서나 같고, 중간 합류도 지금 시각의 상태다(결정 0036-5). */
export function revealStateAt(plan: RevealPlan, now: number): RevealState {
  const counts: Record<number, number> = {};
  let current: number | null = null;
  let lastTouched = -1;
  for (const s of plan.steps) {
    if (now >= s.startMs) current = s.index;
    if (now >= s.touchMs) {
      counts[s.target] = (counts[s.target] ?? 0) + 1;
      lastTouched = s.index;
    }
  }
  const ended = now >= plan.endMs;
  let arrow: RevealArrow | null = null;
  if (current !== null) {
    const s = plan.steps[current];
    if (now < s.fadeEndMs) {
      arrow = {
        step: s.index,
        voter: s.voter,
        target: s.target,
        progress: Math.min(1, (now - s.startMs) / REVEAL_DRAW_MS),
        opacity: now < s.touchMs ? 1 : 1 - (now - s.touchMs) / REVEAL_FADE_MS,
      };
    }
  }
  let pop: number | null = null;
  if (lastTouched >= 0 && !ended) {
    const next = plan.steps[lastTouched + 1];
    if (next === undefined || now < next.startMs) pop = plan.steps[lastTouched].target;
  }
  return {
    counts,
    arrow,
    current,
    pop,
    leader: leaderOf(counts),
    clinched: plan.clinch !== null && now >= plan.clinch.atMs ? plan.clinch.seat : null,
    ended,
    outcome: plan.outcome,
    finalLeader: plan.finalLeader,
  };
}

/** 과반 확정 연출의 모양: 마지막 닿음(확정 순간 또는 확정 뒤 같은 후보에게 닿은 표)부터 CLINCH_BEAT_MS 동안 clinch(크게 두근), 그 뒤는 slow(작은 느린 박동) */
export type ClinchBeatKind = "clinch" | "slow";
/**
 * 서버 시각 now 에서 두근 중인 확정 후보. 확정 사건 전이거나 확정이 없는 판(동률·미확정·표 없음)이면 null. 중간 합류도 지금 시각의 모양이다.
 * 확정 뒤 같은 후보에게 표가 더 닿으면 그 닿음부터 두근을 처음부터 다시 돈다 — 창 = 마지막 닿음 + CLINCH_BEAT_MS.
 * replay = now 까지 확정 뒤 같은 후보에게 닿은 횟수(첫 확정 0). 화면이 두근 애니메이션을 다시 시작할 때 키로 쓴다.
 */
export function clinchBeat(plan: RevealPlan, now: number): { seat: number; beat: ClinchBeatKind; replay: number } | null {
  const clinch = plan.clinch;
  if (clinch === null || now < clinch.atMs) return null;
  let lastTouchMs = clinch.atMs;
  let replay = 0;
  for (const s of plan.steps) {
    if (s.index > clinch.step && s.target === clinch.seat && s.touchMs <= now) {
      lastTouchMs = s.touchMs;
      replay += 1;
    }
  }
  return { seat: clinch.seat, beat: now - lastTouchMs < CLINCH_BEAT_MS ? "clinch" : "slow", replay };
}

// ---- (3) 기하 — 장면 좌표 공식은 dayTableGeometry·daySeatLayout 한 곳이고 여기서는 그 결과(x, y, scale)만 쓴다 ----
/** 자리 배치가 주는 발 위치와 배율 */
export interface FootPlace {
  x: number;
  y: number;
  scale: number;
}
export interface CandidateCenter {
  /** 가운데 x = 장면 폭 / 2 */
  x: number;
  /** 발 y = min(cy + 80, 장면 높이 − 38) — 짧은 폰에서 이름표 아래끝이 패널에 닿지 않는다(P-15) */
  footY: number;
  scale: number;
  /** 이름표 위 = 발 y + 8, 높이 22 */
  tagTop: number;
}
const CANDIDATE_FOOT_BELOW_CY = 80; // UI-SPEC 8.4
// 이름표 간격 8 + 이름표 상자 높이 26 + 아래 여유 4. 상자는 알약(22)보다 4 크다(인라인 줄 상자) — 04-22 가 하단을 236 으로 키워 360×640 에서 처음 드러났다(UI-SPEC 8.4 의 34 는 22 로 센 값)
const CANDIDATE_FOOT_ABOVE_BOTTOM = 38;
const CANDIDATE_TAG_GAP = 8; // UI-SPEC 8.4: 이름표는 발 y + 8

/** 변론·처형 후보가 서는 가운데 자리 (UI-SPEC 8.4) */
export function candidateCenter(sceneW: number, sceneH: number, pad: number): CandidateCenter {
  const { cx, cy } = dayTableGeometry(sceneW, sceneH, pad);
  const footY = Math.min(cy + CANDIDATE_FOOT_BELOW_CY, sceneH - CANDIDATE_FOOT_ABOVE_BOTTOM);
  return { x: cx, footY, scale: VERDICT_CANDIDATE_SCALE, tagTop: footY + CANDIDATE_TAG_GAP };
}

export type ChipTone = "normal" | "lead";
export interface ChipRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
const CHIP_GAP_ABOVE_HEAD = 8; // UI-SPEC 8.3: 칩 아래끝이 머리 위 8px
const CHIP_TOP_MIN = 4; // P-14: 헤더 타이머 영역으로 나가지 않는다

/** 대상 머리 위 가운데의 표수 칩 사각형. 위는 max(4, 머리 위 − 8 − 높이), 좌우는 장면 안으로 민다. */
export function chipAnchor(place: FootPlace, tone: ChipTone, sceneW: number): ChipRect {
  const width = tone === "lead" ? CHIP_W_LEAD : CHIP_W;
  const height = tone === "lead" ? CHIP_H_LEAD : CHIP_H;
  const headTop = place.y - FIG_H * place.scale;
  const left = Math.min(Math.max(0, place.x - width / 2), Math.max(0, sceneW - width));
  return { left, top: Math.max(CHIP_TOP_MIN, headTop - CHIP_GAP_ABOVE_HEAD - height), width, height };
}

const TAG_BOX_EXTRA_H = 4; // 실제 이름표 상자는 알약(TAG_H 22)보다 인라인 줄 상자만큼(4) 크다(daytable.css .mf-dt__tag)
const CHIP_TAG_MARGIN = 4; // 칩 팝(scale 1.25)이 커지는 만큼의 여유 — 정지 상태뿐 아니라 팝 중에도 이름표와 안 겹친다
const CHIP_RAISE_MAX = 64; // 옆으로 피할 수 없을 때 머리 위에서 더 올리는 최대 거리
const CHIP_SEARCH_STEP = 1;

/** 모든 자리의 이름표 상자(최악 폭 NAME_TAG_MAX_W, 높이는 인라인 줄 상자). 칩 위치가 피해야 하는 영역이다. */
export function tagBoxesOf(places: readonly Pick<DaySeatPlace, "tagLeft" | "tagTop">[]): ChipRect[] {
  return places.map((p) => ({ left: p.tagLeft - NAME_TAG_MAX_W / 2, top: p.tagTop, width: NAME_TAG_MAX_W, height: TAG_H + TAG_BOX_EXTRA_H }));
}

const hitsAny = (r: ChipRect, boxes: readonly ChipRect[]): boolean =>
  boxes.some((b) => r.left < b.left + b.width + CHIP_TAG_MARGIN && b.left - CHIP_TAG_MARGIN < r.left + r.width && r.top < b.top + b.height + CHIP_TAG_MARGIN && b.top - CHIP_TAG_MARGIN < r.top + r.height);

/**
 * 표수 칩의 실제 위치(UI-SPEC 8.3 + 04-32 Rule-1). 기본은 chipAnchor(머리 위 8px 가운데). 앞줄 자리의 이름표가 뒷줄 자리의 머리 위로 올라와 있어
 * 기본 자리가 이름표와 겹치면(E2E P10), ① 캐릭터 폭 안에서 칩을 옆으로 옮기고(가장 적게), ② 그래도 안 되면 위로 올린다. 못 찾으면 기본 자리다.
 * tags 는 tagBoxesOf — 대상 자신의 이름표(발 아래)는 칩과 겹칠 수 없으니 그대로 넣어도 된다.
 */
export function chipPlacement(place: FootPlace, tone: ChipTone, sceneW: number, tags: readonly ChipRect[]): ChipRect {
  const base = chipAnchor(place, tone, sceneW);
  if (!hitsAny(base, tags)) return base;
  const maxLeft = Math.max(0, sceneW - base.width);
  const halfHead = (FIG_W * place.scale) / 2;
  const outward = place.x < sceneW / 2 ? -1 : 1;
  for (let rise = 0; rise <= CHIP_RAISE_MAX; rise += 2) {
    const top = base.top - rise;
    if (top < CHIP_TOP_MIN) break;
    for (let d = 0; d <= halfHead; d += CHIP_SEARCH_STEP) {
      for (const sign of d === 0 ? [1] : [outward, -outward]) {
        const left = Math.min(maxLeft, Math.max(0, base.left + sign * d));
        if (Math.abs(left + base.width / 2 - place.x) > halfHead + 1e-9) continue;
        const cand = { left, top, width: base.width, height: base.height };
        if (!hitsAny(cand, tags)) return cand;
      }
    }
  }
  return base;
}

export interface Point {
  x: number;
  y: number;
}
const BODY_CENTER_RATIO = 48; // UI-SPEC 8.3: 몸 중심 = 발 y − 48×배율
const ARROW_START_OFFSET = 32; // 투표자 몸 중심에서 대상 방향으로
const ARROW_END_OFFSET = 26; // 대상 몸 중심에서 투표자 방향으로

function bodyCenter(p: FootPlace): Point {
  return { x: p.x, y: p.y - BODY_CENTER_RATIO * p.scale };
}

/** 화살표 선의 시작·끝 (UI-SPEC 8.3). 두 몸이 너무 가까우면 가운데 한 점으로 모은다. */
export function arrowEndpoints(from: FootPlace, to: FootPlace): { start: Point; end: Point } {
  const a = bodyCenter(from);
  const b = bodyCenter(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len <= ARROW_START_OFFSET + ARROW_END_OFFSET) {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return { start: mid, end: { ...mid } };
  }
  const ux = dx / len;
  const uy = dy / len;
  return {
    start: { x: a.x + ux * ARROW_START_OFFSET, y: a.y + uy * ARROW_START_OFFSET },
    end: { x: b.x - ux * ARROW_END_OFFSET, y: b.y - uy * ARROW_END_OFFSET },
  };
}

/**
 * 처형 투표·처형 무효 카드의 위치: 위쪽 = cy − 105(장면 위 기준), 셰브런 높이 = clamp(96, 장면 아래 − 카드 아래끝 − 16, 230).
 * cy 는 dayTableGeometry 한 곳에서만 나온다(여백 pad 와 무관하지만 같은 호출을 쓴다).
 */
export function introCardGeometry(sceneW: number, sceneH: number, pad?: number): { top: number; chevH: number } {
  const { cy } = dayTableGeometry(sceneW, sceneH, pad);
  const top = cy - INTRO_CARD_UP;
  const chevH = Math.min(INTRO_CHEV_MAX_H, Math.max(INTRO_CHEV_MIN_H, sceneH - (top + INTRO_CARD_H) - INTRO_CHEV_BOTTOM));
  return { top, chevH };
}

// ---- (4) 후광 상한 (결정 0030, D-33, UI-SPEC 12.4) ----
/** 후광 종류. 색 자체는 화면 계획이 입힌다. 우선순위는 white > amber > crimson. */
export type HaloKind = "white" | "amber" | "crimson";
export interface HaloRequest {
  seat: number;
  kind: HaloKind;
}
export interface CappedHalos {
  /** 자리 → 남은 후광 종류 */
  kinds: Map<number, HaloKind>;
  /** 상한 때문에 꺼진 자리(오름차순) */
  off: number[];
}
const HALO_RANK: Record<HaloKind, number> = { white: 0, amber: 1, crimson: 2 };

/**
 * 한 자리에는 후광 하나(가장 높은 우선순위)만 남기고, 합이 max 를 넘으면 낮은 우선순위(진홍 → 앰버)부터,
 * 같은 순위에서는 자리 번호가 큰 쪽부터 뺀다. 흰은 상한과 상관없이 항상 남는다.
 */
export function capHalos(requests: readonly HaloRequest[], max: number = HALO_MAX_SIMULTANEOUS): CappedHalos {
  const best = new Map<number, HaloKind>();
  for (const r of requests) {
    const cur = best.get(r.seat);
    if (cur === undefined || HALO_RANK[r.kind] < HALO_RANK[cur]) best.set(r.seat, r.kind);
  }
  const removable = [...best.entries()]
    .filter(([, kind]) => kind !== "white")
    .sort((a, b) => HALO_RANK[b[1]] - HALO_RANK[a[1]] || b[0] - a[0]);
  const off: number[] = [];
  let total = best.size;
  for (const [seat] of removable) {
    if (total <= max) break;
    best.delete(seat);
    off.push(seat);
    total -= 1;
  }
  return { kinds: best, off: off.sort((a, b) => a - b) };
}

// ---- (5) 문구 정본 (UI-SPEC 7.2·7.3) ----
// 화면 부품은 문자열을 직접 쓰지 않고 여기서 읽는다. 처형 문장 네 개는 eliminationText.ts 의 executionTitle 이 이미 갖고 있다.
// 이름(닉네임)은 문자열로만 이어 붙이고 HTML 로 해석하지 않는다(T-04-40). 이름 뒤 '님' 은 받침을 보지 않는다(D-11).
/** 닉네임을 못 찾을 때(자리 정보가 없는 데이터 이상) 쓰는 이름. 화면이 멈추지 않게 한다. */
export const UNKNOWN_NAME = "알 수 없는 사람";
/** 자리 → 닉네임. 못 찾으면 undefined */
export type NicknameOf = (seat: number) => string | undefined;
const nameFor = (nicknameOf: NicknameOf, seat: number): string => nicknameOf(seat) ?? UNKNOWN_NAME;

export const VERDICT_TEXT = {
  // execVote
  execTitle: "오늘 처형을 할까요?", // UI-SPEC 7.2 execVote 하단 제목, 처형 투표 카드의 질문
  execIntroHint: "카드 뒤에서도 바로 고를 수 있어요", // 인트로 카드가 떠 있는 처음 3초의 회색 부분
  spectatorPill: "관전 중 · 볼 수만 있어요", // D-35, P-4
  execIntroCardTitle: "처형 투표", // §9.1
  // candidateVote
  candidateTitle: "처형할 사람을 고르세요",
  candidateHint: "자기 자신은 고를 수 없어요 · 마감까지 바꿀 수 있어요",
  candidateNone: "선택 안 함",
  /** 확정 알약은 자리 색 점과 굵은 이름이 따로 그려지므로 이름 뒤 조각만 둔다(D-19) */
  votedSuffix: "님에게 투표했어요",
  candidateSpectatorTitle: "처형할 사람을 고르는 중이에요",
  candidateSpectatorHint: "누구를 골랐는지는 공개될 때 볼 수 있어요",
  // candidateVoteReveal: 첫 화살표(단계 시작 400ms 뒤) 전에만 보이는 기본 제목. 진행 중·끝 상태 문구는 revealCaption 이 만든다
  revealIntroTitle: "투표 공개",
  // defense
  defenseChooseTitle: "변론할 말을 고르세요",
  defenseChooseHint: "한 번에 하나씩 보낼 수 있어요",
  // execution
  executionCardSub: "처형이 집행됐어요",
  executionDoneTitle: "처형이 끝났어요", // P-10: 이 시점 클라이언트는 승패를 모른다
  executionDoneHint: "곧 다음으로 넘어가요",
  // 처형 무효 카드
  noExecCardTitle: "처형 무효", // §9.2, P-3
  // ended
  endedTitle: "게임 종료",
  summaryTitle: "이번 판 기록",
  homeButton: "처음으로",
  roomCloseNote: "이 방은 30분 뒤에 닫혀요", // P-6
  // 기록 카드(§10)
  noRecord: "아직 기록이 없어요",
  /** 단계 안내(aria-live) 중 고정 문구 (UI-SPEC 7.3). 변론·종료는 이름·승패가 들어가 함수다. */
  announce: {
    execVote: "처형 여부 투표. 오늘 처형을 할까요?",
    candidateVote: "후보 선택 투표. 처형할 사람을 고르세요",
    candidateVoteReveal: "투표 공개",
  },
} as const;

/** 후보 선택 좌석 버튼의 읽기 이름: `{닉네임}{ (나)}, 투표 대상` */
export function candidateSeatLabel(name: string, isMe: boolean): string {
  return `${name}${isMe ? " (나)" : ""}, 투표 대상`;
}
/** 변론 하단 상태 줄 (남의 변론) */
export function defenseStatus(name: string): string {
  return `${name}님이 변론하는 중`;
}
/** 후보가 연결이 끊겨 있을 때의 상태 줄 (P-5, D-05) */
export function defenseDisconnected(name: string): string {
  return `${name}님은 연결이 끊겨 있어요`;
}
/** 변론 헤더 안내. name 이 null 이면 후보 본인 */
export function defenseInstruction(n: number, name: string | null): string {
  return name === null ? `${n}일차 · 내 변론` : `${n}일차 · ${name}님의 변론`;
}
/** 후보 본인이 말을 보낸 직후 DEFENSE_SENT_MS 동안의 안내 줄 (P-8) */
export function defenseSent(sentence: string): string {
  return `보냈어요 · ${sentence}`;
}
/** 변론 단계 안내(aria-live). name 이 null 이면 후보 본인 */
export function defenseAnnounce(name: string | null): string {
  return name === null ? "내 최후 변론. 변론할 말을 고르세요" : `${name}님의 최후 변론`;
}

/** 처형 여부 투표 집계 줄: 앞(굵게)과 뒤(회색). 남은 사람 수 = 생존자 − (찬성 + 반대), 음수면 0 (D-35) */
export function execTallyText(tally: ExecTally, alive: number): { strong: string; rest: string } {
  const left = Math.max(0, alive - (tally.yes + tally.no));
  // 0명 남은 문구는 360 폭에서 앞(`찬성 N · 반대 M`, 굵게)과 한 줄에 들어가야 한다 — `모두 투표했어요` 는 15px 넘쳐 말줄임표로 잘렸다(E2E G2, 04-33)
  const rest = left === 0 ? "모두 냈어요 · 마감까지 바꿀 수 있어요" : `아직 ${left}명 · 마감까지 바꿀 수 있어요`;
  return { strong: `찬성 ${tally.yes} · 반대 ${tally.no}`, rest };
}

/** 공개 단계 첫 화살표 전 기본 안내: `모두 {n}표` (진행 중 안내 `{k}번째 표 · 모두 {n}표` 의 뒷부분) */
export function revealIntroHint(total: number): string {
  return `모두 ${total}표`;
}

/** 공개 단계 제목·안내. 화살표 사이 틈에서는 직전 화살표 문구를 유지하고, 첫 화살표 전에는 null (화면은 기본 제목을 쓴다). */
export function revealCaption(
  plan: RevealPlan,
  state: RevealState,
  nicknameOf: NicknameOf,
): { title: string; hint: string } | null {
  if (state.ended) {
    if (plan.outcome === "leader" && plan.finalLeader !== null) {
      return { title: `${nameFor(nicknameOf, plan.finalLeader)}님이 가장 많은 표를 받았어요`, hint: `${plan.finalLeaderVotes}표 · 곧 최후 변론이 시작돼요` };
    }
    if (plan.outcome === "tie") return { title: "표가 갈렸어요", hint: "동률이라 처형하지 않아요 · 곧 밤이 시작돼요" };
    return { title: "투표한 사람이 없어요", hint: "던진 표가 없어요 · 곧 밤이 시작돼요" };
  }
  if (state.current === null) return null;
  const step = plan.steps[state.current];
  return {
    title: `${nameFor(nicknameOf, step.voter)}님이 ${nameFor(nicknameOf, step.target)}님을 골랐어요`,
    hint: `${step.index + 1}번째 표 · 모두 ${plan.steps.length}표`,
  };
}

/** 공개 끝 상태의 읽기용 한 줄(aria-live polite, 한 번만) */
export function revealResultLine(plan: RevealPlan, nicknameOf: NicknameOf): string {
  if (plan.outcome === "leader" && plan.finalLeader !== null) {
    return `${nameFor(nicknameOf, plan.finalLeader)}님이 ${plan.finalLeaderVotes}표로 가장 많은 표를 받았어요`;
  }
  if (plan.outcome === "tie") return "표가 갈렸어요. 동률이라 처형하지 않아요";
  return "투표한 사람이 없어요";
}

/** 처형 무효 카드 부제 (D-34) */
export function noExecutionText(reason: NoExecutionReason): string {
  switch (reason) {
    case "notMajority":
      return "찬성이 과반이 아니에요";
    case "tie":
      return "동률이라 처형하지 않아요";
    case "noVotes":
      return "던진 표가 없어요";
  }
}
/** 처형 무효로 시작한 밤의 단계 안내 앞에 붙는 접두 */
export function noExecutionPrefix(reason: NoExecutionReason): string {
  return `처형 무효. ${noExecutionText(reason)}. `;
}

/** 종료 단계 읽기 문구 */
export function endedAnnounce(winner: GameWinner): string {
  return `게임이 끝났습니다. ${winner === "citizenWin" ? "시민 팀" : "마피아 팀"} 승리`;
}
/** 승리 배너 제목·부제와 읽기 문구 */
export function winnerText(winner: GameWinner): { title: string; sub: string; announce: string } {
  return winner === "citizenWin"
    ? { title: "시민 팀 승리", sub: "마피아가 모두 탈락했어요", announce: endedAnnounce(winner) }
    : { title: "마피아 팀 승리", sub: "마피아 수가 나머지 생존자 수와 같아졌어요", announce: endedAnnounce(winner) };
}

export interface SummaryLine {
  n: number;
  kind: "day" | "night";
  /** 앞 열: `{n}일차 낮` / `{n}일차 밤` */
  label: string;
  text: string;
}

/**
 * 판 요약 행: 일차 오름차순으로 낮 → 밤. 낮은 처형(후보 득표 수 포함)·무효 세 갈래, 밤은 사망·의사가 지킴·지목 없음.
 * exec 가 없는 일차는 낮 행이 없고 night 가 없으면 밤 행이 없다. 입력 배열은 바꾸지 않는다.
 */
export function summaryLines(
  summary: readonly SummaryRow[],
  voteLog: readonly VoteLogEntry[],
  nicknameOf: NicknameOf,
): SummaryLine[] {
  const lines: SummaryLine[] = [];
  for (const row of [...summary].sort((a, b) => a.n - b.n)) {
    const log = voteLog.find((entry) => entry.n === row.n);
    if (row.exec !== undefined) {
      const { yes, no, passed, candidate } = row.exec;
      let text: string;
      if (passed && candidate !== undefined) {
        const name = nameFor(nicknameOf, candidate);
        text =
          log?.cand === undefined
            ? `${name}님 처형`
            : `${name}님 처형 (${log.cand.votes.filter((v) => v.target === candidate).length}표)`;
      } else if (!passed) {
        text = `처형 없음 (찬성 ${yes} · 반대 ${no})`;
      } else {
        text = log?.cand !== undefined && log.cand.votes.length === 0 ? "처형 없음 (던진 표 없음)" : "처형 없음 (동률)";
      }
      lines.push({ n: row.n, kind: "day", label: `${row.n}일차 낮`, text });
    }
    if (row.night !== undefined) {
      const { target, died } = row.night;
      const text =
        target === undefined
          ? "아무 일도 없었어요"
          : died
            ? `${nameFor(nicknameOf, target)}님 사망`
            : `${nameFor(nicknameOf, target)}님을 노렸지만 의사가 지켰어요`;
      lines.push({ n: row.n, kind: "night", label: `${row.n}일차 밤`, text });
    }
  }
  return lines;
}

/** 결과 화면 부제: 요약 마지막 행에 night 가 있으면 `{n}일차 밤`, 없으면 `{n}일차 낮`, 행이 없으면 빈 문자열 */
export function endedSubtitle(summary: readonly SummaryRow[]): string {
  const last = summary[summary.length - 1];
  if (last === undefined) return "";
  return last.night !== undefined ? `${last.n}일차 밤` : `${last.n}일차 낮`;
}
