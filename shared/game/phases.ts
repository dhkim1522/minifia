// 단계 정의 표. 코드 분기 대신 데이터 한 곳에 둔다(roles.ts 의 ROLE_TABLE 과 같은 원칙) —
// 이후 페이즈는 이 표에 행을 더하는 방식으로만 단계를 늘린다(D-01).
// 역할 확인(roleReveal) 뒤에는 낮 두 단계(dayAnnounce → discussion)가 돈다. 순차 주장 단계는 7페이즈에서 없어졌다(CHAT-06).
// 8페이즈 낮 흐름(결정 0060-1, DAY-07): discussion → nomination → defense → verdict → execution → night → morning → dayAnnounce.
// 승패가 나면 execution·morning 의 마감에서 ended(마감 없음)로 간다. 분기(지목 동률·0표 → night 등)는 tick.ts 의 ON_DEADLINE 이
// next 로 정한다 — 이 표의 next 는 "기본 다음 단계" 데이터일 뿐이다.
// 단계 길이는 이 파일 한 곳에서만 정한다(6페이즈 플레이테스트가 여기만 고친다).
// 후보 선택 공개 단계의 길이 공식(candidateRevealMs)도 여기다 — 화면(src/game/verdict.ts)이 같은 상수를 import 한다(결정 0039).
// 표는 데이터만 둔다 — 진입 전이(훅)는 tick.ts 의 ON_ENTER 표에 있다.
import type { PhaseId } from "../protocol";

export interface PhaseDef {
  /** 단계 길이(ms). null 이면 시간으로 끝나지 않는다. */
  durationMs: number | null;
  /** 마감이 지나면 넘어갈 단계. null 이면 거기서 멈춘다. */
  next: PhaseId | null;
  /** 이 단계의 뷰에 그 플레이어 본인의 역할을 싣는지. */
  revealsOwnRole: boolean;
}

export const ASSIGNING_MS = 3_000;
export const ROLE_REVEAL_MS = 15_000;
export const DAY_ANNOUNCE_MS = 2_000; // D-20
export const DISCUSSION_MS = 90_000; // DAY-07 — 낮 토론 90초(결정 0060-1). 과반이 토론 끝내기를 누르면 일찍 끝난다(DAY-03)
export const NIGHT_MS = 30_000; // NIGHT-05
export const MORNING_MS = 5_000; // NIGHT-06
export const EXEC_VOTE_MS = 13_000; // 처형 여부 투표(D-01, VOTE-01) — 처형 투표 카드 3초가 이 단계 안에서 뜨고 카드 뒤 10초 이상 남긴다(결정 0039)
export const CANDIDATE_VOTE_MS = 15_000; // 후보 선택(D-01, VOTE-02)
export const DEFENSE_MS = 20_000; // 최후 변론(DAY-07, 결정 0060-1) — 변론자가 무대에서 말하는 20초
export const EXECUTION_MS = 5_000; // 처형 발표(D-01, VOTE-04)
export const NOMINATION_MS = 15_000; // 지목(DAY-04, 결정 0060-1) — 마감까지 바꿀 수 있고 일찍 끝나지 않는다
export const VERDICT_MS = 10_000; // 찬반(DAY-06, 결정 0060-1·0060-4) — 조기 종료 없이 마감까지

// 후보 선택 공개 구간(결정 0039, D-21 개정): 한 표에 2초. 서버가 그날 공개된 표 수로 단계 길이를 정하고 화면이 같은 상수로 시간표를 만든다.
/** 첫 화살표가 시작하기까지의 앞 여유. */
export const CANDIDATE_REVEAL_LEAD_MS = 400;
/** 한 표(화살표 하나)가 차지하는 시간. */
export const CANDIDATE_REVEAL_SLOT_MS = 2_000;
/** 마지막 슬롯 뒤, 끝 문구를 보여 주는 뒤 여유. */
export const CANDIDATE_REVEAL_TAIL_MS = 600;
/** 0표일 때의 길이 — 끝 문구만 읽는 시간(낮 시작 발표 DAY_ANNOUNCE_MS 와 같은 2초). */
export const CANDIDATE_REVEAL_EMPTY_MS = 2_000;

/**
 * 공개 단계 길이(ms). n ≥ 1 이면 앞 여유 + n × 한 표 + 뒤 여유(8명 최악 17000), n = 0 이면 2000.
 * 음수·소수·NaN 은 0 이상 정수로 내린다. 순수 함수 — 서버(phaseDurationOf·tick)와 화면(verdict.ts)이 함께 쓴다.
 */
export function candidateRevealMs(voteCount: number): number {
  const n = Number.isFinite(voteCount) ? Math.max(0, Math.floor(voteCount)) : 0;
  if (n === 0) return CANDIDATE_REVEAL_EMPTY_MS;
  return CANDIDATE_REVEAL_LEAD_MS + n * CANDIDATE_REVEAL_SLOT_MS + CANDIDATE_REVEAL_TAIL_MS;
}

export const PHASE_DEFS: Readonly<Record<PhaseId, PhaseDef>> = Object.freeze({
  lobby: Object.freeze({ durationMs: null, next: null, revealsOwnRole: false }), // start 로만 나간다
  assigning: Object.freeze({ durationMs: ASSIGNING_MS, next: "roleReveal", revealsOwnRole: false }),
  roleReveal: Object.freeze({ durationMs: ROLE_REVEAL_MS, next: "dayAnnounce", revealsOwnRole: true }),
  dayAnnounce: Object.freeze({ durationMs: DAY_ANNOUNCE_MS, next: "discussion", revealsOwnRole: true }),
  discussion: Object.freeze({ durationMs: DISCUSSION_MS, next: "nomination", revealsOwnRole: true }),
  execVote: Object.freeze({ durationMs: EXEC_VOTE_MS, next: "candidateVote", revealsOwnRole: true }), // 불통과면 훅이 night 로
  candidateVote: Object.freeze({ durationMs: CANDIDATE_VOTE_MS, next: "candidateVoteReveal", revealsOwnRole: true }),
  // 0표 기준 값. 실제 길이는 discussion.ts 의 phaseDurationOf 가 그날 공개 표 수로 파생하고 tick 이 진입 훅 뒤에 적용한다(결정 0039).
  candidateVoteReveal: Object.freeze({ durationMs: candidateRevealMs(0), next: "defense", revealsOwnRole: true }),
  defense: Object.freeze({ durationMs: DEFENSE_MS, next: "verdict", revealsOwnRole: true }),
  execution: Object.freeze({ durationMs: EXECUTION_MS, next: "night", revealsOwnRole: true }),
  night: Object.freeze({ durationMs: NIGHT_MS, next: "morning", revealsOwnRole: true }),
  morning: Object.freeze({ durationMs: MORNING_MS, next: "dayAnnounce", revealsOwnRole: true }),
  ended: Object.freeze({ durationMs: null, next: null, revealsOwnRole: true }), // 마감이 없다 — 방 만료가 끝낸다
  // 8페이즈 새 단계(결정 0060): 흐름 전환(08-11)부터 discussion.next 가 nomination 이다. 위 execVote·candidateVote·candidateVoteReveal 행은 닿지 않는 채로 08-21·22 가 지운다.
  nomination: Object.freeze({ durationMs: NOMINATION_MS, next: "defense", revealsOwnRole: true }), // 동률·0표면 훅이 night 로
  verdict: Object.freeze({ durationMs: VERDICT_MS, next: "execution", revealsOwnRole: true }),
});
