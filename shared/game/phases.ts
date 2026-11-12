// 단계 정의 표. 코드 분기 대신 데이터 한 곳에 둔다(roles.ts 의 ROLE_TABLE 과 같은 원칙) —
// 이후 페이즈는 이 표에 행을 더하는 방식으로만 단계를 늘린다(D-01).
// 역할 확인(roleReveal) 뒤에는 낮 단계(dayAnnounce → errand → discussion)가 돈다(errand 는 15페이즈 결정 0074). 순차 주장 단계는 7페이즈에서 없어졌다(CHAT-06).
// 기본판 낮 흐름(결정 0072, 8페이즈 결정 0060-1·DAY-07): discussion → nomination(투표, 동시 15초) → defense → verdict → execution → night → morning → dayAnnounce.
// 승패가 나면 execution·morning 의 마감에서 ended(마감 없음)로 간다. 투표 동점·0표는 결선 없이 night 다. 순차 지목(0063-1)·동점 결선 runoff(0066-4)·마지막 3인 결전 showdown(0066-5)은
// ruleset.ts 의 RULESET 이 켜졌을 때만 돈다(기본판은 모두 꺼짐). 분기(투표 동률·0표 → night 등)는 tick.ts 의 ON_DEADLINE 이
// next 로 정한다 — 이 표의 next 는 "기본 다음 단계" 데이터일 뿐이다.
// 단계 길이는 이 파일 한 곳에서만 정한다(6페이즈 플레이테스트가 여기만 고친다).
// 표는 데이터만 둔다 — 진입 전이(훅)는 tick.ts 의 ON_ENTER 표에 있다.
import type { PhaseId } from "../protocol";
import { RULESET } from "./ruleset";
import type { Ruleset } from "./ruleset";

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
export const MORNING_MAX_MS = 16_000; // 아침 길이 상한 — 결정 0079(A3) · 흔적 카드가 두 줄이 되어 3→5초, 상한 15→16초 (시간은 참고 목표)
export const DEFENSE_MS = 20_000; // 최후 변론(DAY-07, 결정 0060-1) — 변론자가 무대에서 말하는 20초
/** 판결 앞머리(결정 0066-7) — 처형 단계 맨 앞 0.6초는 화면의 느린 확대·핀 조명이 알림보다 앞선다. */
export const VERDICT_LEAD_MS = 600;
export const EXECUTION_MS = 5_000 + VERDICT_LEAD_MS; // 처형 발표 5초(D-01, VOTE-04) + 판결 앞머리 0.6초(결정 0066-7)
/** 투표(nomination) 15초 — 기본판 동시 투표(결정 0072, 8페이즈 결정 0060-3). 모이는 걷기도 이 15초 안이다. */
export const NOMINATION_MS = 15_000;
// 순차 지목(결정 0063-1·0063-4, 09.1 M-5, RULESET.pickTurn 일 때만). 모이기 → 산 사람 좌석 순서로 한 명씩 차례 → 확정 뒤 사이 → 끝 알림 → 집계. 플레이테스트 뒤 이 네 줄만 고친다.
export const NOMINATION_GATHER_MS = 3_000; // 결정 0063-1, M-5 기본값 · 플레이테스트 뒤 이 줄만 고친다 — 지목 시작 때 모이는 시간
export const PICK_TURN_MS = 8_000; // 결정 0063-1, M-5 기본값 · 플레이테스트 뒤 이 줄만 고친다 — 한 사람의 차례(못 고르면 기권)
export const PICK_GAP_MS = 900; // 결정 0063-1, M-5 기본값 · 플레이테스트 뒤 이 줄만 고친다 — 차례가 확정된 뒤 다음 차례까지
export const NOMINATION_END_MS = 2_000; // 결정 0063-1, M-5 기본값 · 플레이테스트 뒤 이 줄만 고친다 — 마지막 차례 뒤 끝 알림

/** 차례 수 turns 인 판의 지목 최악 길이(전원 기권) = 모이기 + turns × (차례 + 사이) + 끝 알림. 8명 76200ms. */
export function nominationMaxMs(turns: number): number {
  return NOMINATION_GATHER_MS + turns * (PICK_TURN_MS + PICK_GAP_MS) + NOMINATION_END_MS;
}

// 동점 결선(결정 0066-4). 앞머리 → 투표 → 결과가 서버 시각 사슬이다. 플레이테스트 뒤 이 세 줄만 고친다.
export const RUNOFF_INTRO_MS = 1_000; // 결정 0066-4 · 플레이테스트 뒤 이 줄만 고친다 — 후보 둘이 무대에 서는 앞머리
export const RUNOFF_VOTE_MS = 5_000; // 결정 0066-4 · 플레이테스트 뒤 이 줄만 고친다 — 후보가 아닌 산 사람이 둘 중 하나를 고르는 창
export const RUNOFF_END_MS = 1_500; // 결정 0066-4 · 플레이테스트 뒤 이 줄만 고친다 — 득표 수를 보여 주는 결과

// 마지막 3인 결전(결정 0066-5). 모이기 → 세 사람이 차례로 한마디 → 셋이 동시에 한 명 지목 → 동시 공개가 서버 시각 사슬이다. 플레이테스트 뒤 이 네 줄만 고친다.
export const SHOWDOWN_GATHER_MS = 2_000; // 결정 0066-5 · 플레이테스트 뒤 이 줄만 고친다 — 셋이 무대에 모이는 앞머리
export const SHOWDOWN_TURN_MS = 8_000; // 결정 0066-5 · 플레이테스트 뒤 이 줄만 고친다 — 한 사람의 '마지막 한마디' 차례(못 하면 말없이 넘어감)
export const SHOWDOWN_POINT_MS = 8_000; // 결정 0066-5 · 플레이테스트 뒤 이 줄만 고친다 — 셋이 동시에 한 명을 지목하는 창
export const SHOWDOWN_REVEAL_MS = 1_500; // 결정 0066-5 · 플레이테스트 뒤 이 줄만 고친다 — 누가 누구를 지목했는지 동시 공개

// 심부름(15페이즈, 결정 0074). 낮 시작 다음 40초. 거리는 월드 단위(1 단위 = 칸 하나). 플레이테스트 뒤 이 블록의 줄만 고친다 — 다른 곳에 같은 값을 쓰지 않는다.
export const ERRAND_MS = 40_000; // 결정 0074 · 플레이테스트 뒤 이 줄만 고친다 — 심부름 단계 길이(D-01)
export const ERRAND_COUNT = 3; // 결정 0074 — 산 사람마다 받는 장소 수(D-01)
export const ERRAND_ACT_R = 1.2; // 결정 0074 — 처리 반경(월드 단위)
export const ERRAND_NEAR_R = 3.0; // 결정 0074 — 근처 반경(월드 단위, 근처 사람만 보인다 D-02)
export const ERRAND_TICK_MS = 1_000; // 결정 0074 — 근처·목격 표본 간격
export const ERRAND_VIEW_HORIZON_MS = 1_500; // 결정 0074 — 근처 사람 이동 구간을 자르는 길이
export const ERRAND_MIN_GAP_MS = 250; // 결정 0074 — 같은 사람의 처리 요청 최소 간격(연타 방어)
export const RECORD_MAX = 6; // 결정 0074 — 목격 기록 줄 상한
export const MORNING_TRACE_MS = 5_000; // 결정 0079(A3) · 흔적 카드가 두 줄이 되어 3→5초, 상한 15→16초 — 시간은 참고 목표(결정 0074 의 흔적 공개 구간)

export const TUTORIAL_MS = 150_000; // 결정 0078·0080 — 함께 진행 튜토리얼 상한(T-6). 이 줄만 고친다

export const VERDICT_MS = 10_000; // 찬반(DAY-06, 결정 0060-1·0060-4) — 조기 종료 없이 마감까지

export const PHASE_DEFS: Readonly<Record<PhaseId, PhaseDef>> = Object.freeze({
  lobby: Object.freeze({ durationMs: null, next: null, revealsOwnRole: false }), // start 로만 나간다
  tutorial: Object.freeze({ durationMs: TUTORIAL_MS, next: "assigning", revealsOwnRole: false }), // 17페이즈(결정 0080): 방장이 켰을 때만 start 다음에 낀다 — 전원 완료나 150초 마감이 assigning 으로
  assigning: Object.freeze({ durationMs: ASSIGNING_MS, next: "roleReveal", revealsOwnRole: false }),
  roleReveal: Object.freeze({ durationMs: ROLE_REVEAL_MS, next: "dayAnnounce", revealsOwnRole: true }),
  dayAnnounce: Object.freeze({ durationMs: DAY_ANNOUNCE_MS, next: "errand", revealsOwnRole: true }),
  errand: Object.freeze({ durationMs: ERRAND_MS, next: "discussion", revealsOwnRole: true }), // 15페이즈(결정 0074) — 낮 시작 다음 40초 심부름, 끝나면 토론
  discussion: Object.freeze({ durationMs: DISCUSSION_MS, next: "nomination", revealsOwnRole: true }),
  defense: Object.freeze({ durationMs: DEFENSE_MS, next: "verdict", revealsOwnRole: true }),
  execution: Object.freeze({ durationMs: EXECUTION_MS, next: "night", revealsOwnRole: true }),
  night: Object.freeze({ durationMs: NIGHT_MS, next: "morning", revealsOwnRole: true }),
  morning: Object.freeze({ durationMs: MORNING_MS, next: "dayAnnounce", revealsOwnRole: true }),
  ended: Object.freeze({ durationMs: null, next: null, revealsOwnRole: true }), // 마감이 없다 — 방 만료가 끝낸다
  // 8페이즈 단계(결정 0060): discussion.next 가 nomination 이다. 옛 처형 여부·후보 선택·후보 공개 행은 08-22 에 지웠다.
  nomination: Object.freeze({ durationMs: RULESET.pickTurn ? NOMINATION_GATHER_MS : NOMINATION_MS, next: "defense", revealsOwnRole: true }), // 기본판 투표 15초 동시. 순차 지목이 켜지면 진입 길이 = 모이기, 그 뒤 길이는 차례 사슬 nominationStepMs. 동률·0표면 훅이 night 로
  runoff: Object.freeze({ durationMs: RUNOFF_INTRO_MS, next: "defense", revealsOwnRole: true }), // 지목 동점(최다 정확히 둘) 결선 — 진입 길이 = 앞머리, 그 뒤 길이는 runoffStepMs. 결선도 동점이면 훅이 night 로
  showdown: Object.freeze({ durationMs: SHOWDOWN_GATHER_MS, next: "night", revealsOwnRole: true }), // 마지막 3인 결전 — 진입 길이 = 모이기, 그 뒤 길이는 showdownStepMs. 2표 이상이면 훅이 execution 으로
  verdict: Object.freeze({ durationMs: VERDICT_MS, next: "execution", revealsOwnRole: true }),
});

/** 기본 다음 단계(자리 함수, 19-01 RED). */
export function nextPhaseOf(phase: PhaseId, _rules: Ruleset): PhaseId | null {
  return PHASE_DEFS[phase].next;
}
