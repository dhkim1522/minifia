// 단계 정의 표. 코드 분기 대신 데이터 한 곳에 둔다(roles.ts 의 ROLE_TABLE 과 같은 원칙) —
// 이후 페이즈는 이 표에 행을 더하는 방식으로만 단계를 늘린다(D-01).
// 역할 확인(roleReveal) 뒤에는 낮 네 단계(dayAnnounce → claim → claimReveal → discussion)가 돌고,
// discussion 이 끝나면 다음 낮 시작 발표로 돌아온다 — 이 한 줄은 임시다(D-19, 3페이즈가 밤으로 바꾼다).
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
export const CLAIM_MS = 15_000; // D-02
export const CLAIM_REVEAL_MS = 2_000; // D-04 의 약 2초
export const DISCUSSION_MS = 90_000; // DAY-01

export const PHASE_DEFS: Readonly<Record<PhaseId, PhaseDef>> = Object.freeze({
  lobby: Object.freeze({ durationMs: null, next: null, revealsOwnRole: false }), // start 로만 나간다
  assigning: Object.freeze({ durationMs: ASSIGNING_MS, next: "roleReveal", revealsOwnRole: false }),
  roleReveal: Object.freeze({ durationMs: ROLE_REVEAL_MS, next: "dayAnnounce", revealsOwnRole: true }),
  dayAnnounce: Object.freeze({ durationMs: DAY_ANNOUNCE_MS, next: "claim", revealsOwnRole: true }),
  claim: Object.freeze({ durationMs: CLAIM_MS, next: "claimReveal", revealsOwnRole: true }),
  claimReveal: Object.freeze({ durationMs: CLAIM_REVEAL_MS, next: "discussion", revealsOwnRole: true }),
  discussion: Object.freeze({ durationMs: DISCUSSION_MS, next: "dayAnnounce", revealsOwnRole: true }), // 임시 낮 루프(D-19) — 3페이즈가 밤으로 바꾼다
});
