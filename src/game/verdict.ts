// DOM·현재 시각·난수를 읽지 않는 순수 모듈 — 시각은 인자로만 받는다. 4페이즈 화면 연출의 수치는 이 파일 한 곳에서만 고친다(D-38).
//
// 구성: (1) 상수 (2) 공개 시간표 revealPlan·revealStateAt·clinchedTarget (3) 기하 candidateCenter·chipAnchor·arrowEndpoints
// (4) 후광 상한 capHalos (5) 문구 정본 VERDICT_TEXT 와 문구 함수. 이 파일은 역할 문자열(직업 단어)을 만들지 않는다 —
// 입력은 서버가 모두에게 보낸 공개 타입뿐이다(D-09).
import type { CandidateVoteLine } from "../../shared/protocol";
import { dayTableGeometry, FIG_H, HALO_MAX_SIMULTANEOUS } from "./dayTable";

// ---- (1) 상수 (UI-SPEC 13.1 값 그대로) ----
export const EXEC_INTRO_MS = 1600; // UI-SPEC 13.1: "처형 투표" 카드(§9.1). 서버 execVote 10초와 동시, 시간을 깎지 않음
export const NO_EXEC_CARD_MS = 1600; // UI-SPEC 13.1: 처형 무효 카드(§9.2)
export const NO_EXEC_INTRO_DELAY_MS = 1600; // UI-SPEC 13.1: 무효 카드가 있을 때 밤 시작 문구를 미루는 시간
export const REVEAL_LEAD_MS = 200; // D-21: 공개 단계 시작 뒤 첫 화살표까지
export const REVEAL_SLOT_MAX_MS = 500; // D-21: 한 표 슬롯 상한
export const REVEAL_BUDGET_MS = 3600; // D-21: 화살표 연출 전체 예산(4초 − 앞 200 − 뒤 200)
export const REVEAL_DRAW_MS = 280; // D-21: 한 화살표가 자라는 시간(슬롯 안) = 닿는 시각
export const REVEAL_FADE_MS = 120; // UI-SPEC 13.2: 닿은 화살표가 사라지는 시간
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
 * 슬롯 = floor(min(500, 3600/n)), 단계 k 의 시작 = startMs + 200 + k×슬롯. 입력 배열은 바꾸지 않는다.
 */
export function revealPlan(votes: readonly CandidateVoteLine[], startMs: number): RevealPlan {
  const n = votes.length;
  const slotMs = n === 0 ? 0 : Math.floor(Math.min(REVEAL_SLOT_MAX_MS, REVEAL_BUDGET_MS / n));
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
  /** 발 y = min(cy + 80, 장면 높이 − 34) — 짧은 폰에서 이름표 아래끝이 패널에 닿지 않는다(P-15) */
  footY: number;
  scale: number;
  /** 이름표 위 = 발 y + 8, 높이 22 */
  tagTop: number;
}
const CANDIDATE_FOOT_BELOW_CY = 80; // UI-SPEC 8.4
const CANDIDATE_FOOT_ABOVE_BOTTOM = 34; // 이름표 간격 8 + 높이 22 + 아래 여유 4
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
