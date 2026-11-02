// 단계 정의 표. 코드 분기 대신 데이터 한 곳에 둔다(roles.ts 의 ROLE_TABLE 과 같은 원칙) —
// 이후 페이즈는 이 표에 행을 더하는 방식으로만 단계를 늘린다(D-01).
// 역할 확인(roleReveal) 뒤에는 낮 두 단계(dayAnnounce → discussion)가 돈다. 순차 주장 단계는 7페이즈에서 없어졌다(CHAT-06).
// 8페이즈 낮 흐름(결정 0060-1, DAY-07): discussion → nomination → defense → verdict → execution → night → morning → dayAnnounce.
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
export const MORNING_MS = 5_000; // NIGHT-06
export const DEFENSE_MS = 20_000; // 최후 변론(DAY-07, 결정 0060-1) — 변론자가 무대에서 말하는 20초
export const EXECUTION_MS = 5_000; // 처형 발표(D-01, VOTE-04)
export const NOMINATION_MS = 15_000; // 지목(DAY-04, 결정 0060-1) — 마감까지 바꿀 수 있고 일찍 끝나지 않는다
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
  nomination: Object.freeze({ durationMs: NOMINATION_MS, next: "defense", revealsOwnRole: true }), // 동률·0표면 훅이 night 로
  verdict: Object.freeze({ durationMs: VERDICT_MS, next: "execution", revealsOwnRole: true }),
});
