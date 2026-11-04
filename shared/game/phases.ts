// 단계 정의 표. 코드 분기 대신 데이터 한 곳에 둔다(roles.ts 의 ROLE_TABLE 과 같은 원칙) —
// 이후 페이즈는 이 표에 행을 더하는 방식으로만 단계를 늘린다(D-01).
// 역할 확인(roleReveal) 뒤에는 낮 두 단계(dayAnnounce → discussion)가 돈다. 순차 주장 단계는 7페이즈에서 없어졌다(CHAT-06).
// 8페이즈 낮 흐름(결정 0060-1, DAY-07, 지목은 순차 — 결정 0063-1): discussion → nomination → defense → verdict → execution → night → morning → dayAnnounce.
// 승패가 나면 execution·morning 의 마감에서 ended(마감 없음)로 간다. 분기(지목 동률·0표 → night 등)는 tick.ts 의 ON_DEADLINE 이
// next 로 정한다 — 이 표의 next 는 "기본 다음 단계" 데이터일 뿐이다.
// 단계 길이는 이 파일 한 곳에서만 정한다(6페이즈 플레이테스트가 여기만 고친다).
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
// 아침 기본 길이 — 무사·구출·미선택(NIGHT-06, 결정 0061-13). 탈락이 있으면 morningMsOf(discussion.ts)가 아래 가산을 더한다.
export const MORNING_MS = 5_000;
export const MORNING_VICTIM_MS = 2_000; // 탈락 발표(MORN-04)
export const MORNING_WILL_MS = 2_000; // 피해자 유언이 비어 있지 않을 때
export const MORNING_NOTE_MS = 2_000; // 마피아 쪽지가 비어 있지 않을 때(탈락한 밤에만 남는다)
export const MORNING_MAX_MS = 15_000; // 아침 길이 상한
export const DEFENSE_MS = 20_000; // 최후 변론(DAY-07, 결정 0060-1) — 변론자가 무대에서 말하는 20초
export const EXECUTION_MS = 5_000; // 처형 발표(D-01, VOTE-04)
// 순차 지목(결정 0063-1·0063-4, 09.1 M-5). 모이기 → 산 사람 좌석 순서로 한 명씩 차례 → 확정 뒤 사이 → 끝 알림 → 집계. 플레이테스트 뒤 이 네 줄만 고친다.
export const NOMINATION_GATHER_MS = 3_000; // 결정 0063-1, M-5 기본값 · 플레이테스트 뒤 이 줄만 고친다 — 지목 시작 때 모이는 시간
export const PICK_TURN_MS = 8_000; // 결정 0063-1, M-5 기본값 · 플레이테스트 뒤 이 줄만 고친다 — 한 사람의 차례(못 고르면 기권)
export const PICK_GAP_MS = 900; // 결정 0063-1, M-5 기본값 · 플레이테스트 뒤 이 줄만 고친다 — 차례가 확정된 뒤 다음 차례까지
export const NOMINATION_END_MS = 2_000; // 결정 0063-1, M-5 기본값 · 플레이테스트 뒤 이 줄만 고친다 — 마지막 차례 뒤 끝 알림

/** 차례 수 turns 인 판의 지목 최악 길이(전원 기권) = 모이기 + turns × (차례 + 사이) + 끝 알림. 8명 76200ms. */
export function nominationMaxMs(turns: number): number {
  return NOMINATION_GATHER_MS + turns * (PICK_TURN_MS + PICK_GAP_MS) + NOMINATION_END_MS;
}

export const VERDICT_MS = 10_000; // 찬반(DAY-06, 결정 0060-1·0060-4) — 조기 종료 없이 마감까지

export const PHASE_DEFS: Readonly<Record<PhaseId, PhaseDef>> = Object.freeze({
  lobby: Object.freeze({ durationMs: null, next: null, revealsOwnRole: false }), // start 로만 나간다
  assigning: Object.freeze({ durationMs: ASSIGNING_MS, next: "roleReveal", revealsOwnRole: false }),
  roleReveal: Object.freeze({ durationMs: ROLE_REVEAL_MS, next: "dayAnnounce", revealsOwnRole: true }),
  dayAnnounce: Object.freeze({ durationMs: DAY_ANNOUNCE_MS, next: "discussion", revealsOwnRole: true }),
  discussion: Object.freeze({ durationMs: DISCUSSION_MS, next: "nomination", revealsOwnRole: true }),
  defense: Object.freeze({ durationMs: DEFENSE_MS, next: "verdict", revealsOwnRole: true }),
  execution: Object.freeze({ durationMs: EXECUTION_MS, next: "night", revealsOwnRole: true }),
  night: Object.freeze({ durationMs: NIGHT_MS, next: "morning", revealsOwnRole: true }),
  morning: Object.freeze({ durationMs: MORNING_MS, next: "dayAnnounce", revealsOwnRole: true }),
  ended: Object.freeze({ durationMs: null, next: null, revealsOwnRole: true }), // 마감이 없다 — 방 만료가 끝낸다
  // 8페이즈 단계(결정 0060): discussion.next 가 nomination 이다. 옛 처형 여부·후보 선택·후보 공개 행은 08-22 에 지웠다.
  nomination: Object.freeze({ durationMs: NOMINATION_GATHER_MS, next: "defense", revealsOwnRole: true }), // 지목 진입 길이 = 모이기, 그 뒤 길이는 차례 사슬 nominationStepMs. 동률·0표면 훅이 night 로
  verdict: Object.freeze({ durationMs: VERDICT_MS, next: "execution", revealsOwnRole: true }),
});
