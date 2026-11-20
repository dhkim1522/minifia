// 단계 정의 표. 코드 분기 대신 데이터 한 곳에 둔다(roles.ts 의 ROLE_TABLE 과 같은 원칙) —
// 이후 페이즈는 이 표에 행을 더하는 방식으로만 단계를 늘린다(D-01).
// 역할 확인(roleReveal) 뒤에는 낮 단계(dayAnnounce → discussion)가 돈다. 순차 주장 단계는 7페이즈에서 없어졌다(CHAT-06).
// 낮 시작 발표 다음은 곧바로 토론이다(22페이즈 D-04 — 심부름 단계가 없어졌다). 기본 다음 단계는 nextPhaseOf 가 표에서 읽는다.
// 낮 흐름(결정 0089-18, D-10): discussion → verdict(찬반, 후보 없음) → nomination(순차 지목) → defense(유언 자리) → execution → night → morning → dayAnnounce.
// 단계 id 는 새로 만들지 않고 순서와 의미만 바꿨다(21페이즈와 같은 방식). 승패가 나면 execution·morning 의 마감에서 ended(마감 없음)로 간다.
// 찬반 부결·지목 동점·0표는 결선 없이 night 다(첫날 키워드가 있는 판은 night 앞에 정답 공개 answerReveal 이 끼고, 승패가 나면 건너뛴다 — D-02). 동점 결선 runoff(0066-4)·마지막 3인 결전 showdown(0066-5)은
// 판 규칙(ruleset.ts 의 RULES)이 켜졌을 때만 돈다(둘 다 꺼짐). 분기(찬반 부결·지목 동률·0표 → night 등)는 tick.ts 의 ON_DEADLINE 이
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
// 첫날 키워드 단계(결정 0089-3·4, D-01): 읽기 3초 + 쓰기 10초 = 13초. 시간은 참고 목표라 연출을 줄이는 근거로 쓰지 않는다.
export const KEYWORD_READ_MS = 3_000; // 결정 0089-3 — 카드를 읽는 시간(답 시간에서 뺀다, 입력줄은 이 동안 잠긴다)
export const KEYWORD_WRITE_MS = 10_000; // 결정 0089-4 — 떠오르는 말을 적는 시간
export const KEYWORD_MS = KEYWORD_READ_MS + KEYWORD_WRITE_MS;
export const FIRST_ANSWER_TURN_MS = 5_000; // 첫날 원탁에서 한 사람의 답을 공개하는 시간
// 첫날 정답 공개 단계(D-02, P23-20): 처형 뒤(또는 처형 없는 첫날 뒤) 밤 직전 3초. 처형이 없으면 "처형 없음" 큰 글 1.4초가 앞에 붙는다(D-22). 시간은 참고 목표라 연출을 줄이는 근거로 쓰지 않는다.
export const ANSWER_REVEAL_MS = 3_000;
export const NO_EXECUTION_MS = 1_400; // 처형 없음 큰 글 시간 — src/game/dayView.ts 의 ANNOUNCE_NOEXEC_MS 가 같은 값을 쓴다(23-07)
export const DAY_ANNOUNCE_MS = 2_000; // D-20
export const DISCUSSION_MS = 90_000; // DAY-07 — 낮 토론 90초(결정 0060-1). 과반이 토론 끝내기를 누르면 일찍 끝난다(DAY-03)
export const NIGHT_MS = 30_000; // NIGHT-05
// 아침 기본 길이 — 무사·구출·미선택(NIGHT-06, 결정 0061-13). 탈락이 있으면 morningMsOf(discussion.ts)가 아래 가산을 더한다.
export const MORNING_MS = 5_000;
export const MORNING_VICTIM_MS = 2_000; // 탈락 발표(MORN-04)
export const MORNING_WILL_MS = 2_000; // 피해자 유언이 비어 있지 않을 때
export const MORNING_NOTE_MS = 2_000; // 마피아 쪽지가 비어 있지 않을 때(탈락한 밤에만 남는다)
export const MORNING_MAX_MS = 16_000; // 아침 길이 상한 — 결정 0079(A3) · 흔적 카드가 두 줄이 되어 3→5초, 상한 15→16초 (시간은 참고 목표)
export const DEFENSE_MS = 10_000; // 유언 단계(결정 0089-19, D-15) — 처형자가 스포트라이트 아래 마지막 한마디를 쓰는 10초. 단계 id 는 defense 그대로다. [남기기]로 일찍 끝날 수 있다
// 처형 시간표 한 표(22-12, D-27·P22-13): 단계 시작 0~3.0초 유언 공개 카드 → 3.0초 "{닉네임} 님 처형" 큰 글과 유령 올라옴 → 6.0초 핀·콘 끔 → 6.6초 밤.
// 핀·판결 순간(어둡게 막·줌)·소리·알림·smoke 사본이 모두 이 표에서 나온다. 한 판 길이는 고정 제한이 아니라 참고 목표다.
export const WILL_REVEAL_MS = 3_000; // 유언 카드(QuoteCard)가 모두의 화면에 보이는 시간 — 3초 규칙의 읽는 시간 최소
export const EXEC_ANNOUNCE_MS = 3_000; // 처형 큰 글 + 유령 올라옴
export const EXEC_TAIL_MS = 600; // 핀·콘이 꺼지고 줌이 1 로 돌아오는 꼬리
export const EXECUTION_MS = WILL_REVEAL_MS + EXEC_ANNOUNCE_MS + EXEC_TAIL_MS; // 6.6초
/** 핀·콘·어둡게 막이 꺼지는 시각(처형 진입 기준 ms) — 6.0초 */
export const PIN_OFF_EXEC_AT = EXECUTION_MS - EXEC_TAIL_MS;
/** 지목(nomination)의 단계 표 자리 값 15초 — 동시 투표는 22-09 에서 지웠다. 진입 훅(enterNomination) 직전의 임시 마감일 뿐이고, 훅 뒤 길이는 phaseDurationOf(모이기 → 차례 사슬)가 다시 구한다. */
export const NOMINATION_MS = 15_000;
// 순차 지목(결정 0063-1·0063-4, 09.1 M-5, 판 규칙의 pickTurn 일 때만). 모이기 → 산 사람 좌석 순서로 한 명씩 차례 → 확정 뒤 사이 → 끝 알림 → 집계. 플레이테스트 뒤 이 네 줄만 고친다.
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

export const VERDICT_MS = 10_000; // 찬반(DAY-06, 결정 0060-1·0060-4) — 산 사람 전원이 던지면 마지막 표 뒤 1.5초로 줄고 번복은 연장한다(0089-26, 줄이는 쪽은 방 DO 의 maybeAdvanceEarly)

export const PHASE_DEFS: Readonly<Record<PhaseId, PhaseDef>> = Object.freeze({
  lobby: Object.freeze({ durationMs: null, next: null, revealsOwnRole: false }), // start 로만 나간다
  assigning: Object.freeze({ durationMs: ASSIGNING_MS, next: "roleReveal", revealsOwnRole: false }),
  // 역할 확인 다음은 keyword(D-01). 방 상태에 keyword 가 없으면 마감 훅(routeAfterRoleReveal, keywordAnswer.ts)이 곧장 dayAnnounce 로 보낸다(D-29).
  roleReveal: Object.freeze({ durationMs: ROLE_REVEAL_MS, next: "keyword", revealsOwnRole: true }),
  keyword: Object.freeze({ durationMs: KEYWORD_MS, next: "dayAnnounce", revealsOwnRole: true }), // 첫날만 — 걷기·채팅·몸동작 없는 조용히 쓰는 시간
  dayAnnounce: Object.freeze({ durationMs: DAY_ANNOUNCE_MS, next: "discussion", revealsOwnRole: true }),
  discussion: Object.freeze({ durationMs: DISCUSSION_MS, next: "verdict", revealsOwnRole: true }),
  defense: Object.freeze({ durationMs: DEFENSE_MS, next: "execution", revealsOwnRole: true }),
  execution: Object.freeze({ durationMs: EXECUTION_MS, next: "night", revealsOwnRole: true }),
  // 첫날만(D-02) — 마감 훅 routeAfterExecution·afterDayOf 가 keyword 가 있는 첫날에만 이 단계로 보낸다. execution.next 는 둘째 날 이후가 쓰는 night 그대로다.
  answerReveal: Object.freeze({ durationMs: ANSWER_REVEAL_MS, next: "night", revealsOwnRole: true }),
  night: Object.freeze({ durationMs: NIGHT_MS, next: "morning", revealsOwnRole: true }),
  morning: Object.freeze({ durationMs: MORNING_MS, next: "dayAnnounce", revealsOwnRole: true }),
  ended: Object.freeze({ durationMs: null, next: null, revealsOwnRole: true }), // 마감이 없다 — 방 만료가 끝낸다
  // 8페이즈 단계(결정 0060): discussion.next 가 nomination 이다. 옛 처형 여부·후보 선택·후보 공개 행은 08-22 에 지웠다.
  // 지목(순차, 22-09 D-12). durationMs 는 자리 값이다 — 진입 훅 enterNomination 이 state.pickTurn 을 만들고 tick 이 진입 훅 뒤 phaseDurationOf 로 길이를 다시 구한다(nominationStepMs 의 모이기 길이, 그 뒤는 차례 사슬). 동률·0표면 훅이 night 로
  nomination: Object.freeze({ durationMs: NOMINATION_MS, next: "defense", revealsOwnRole: true }),
  runoff: Object.freeze({ durationMs: RUNOFF_INTRO_MS, next: "defense", revealsOwnRole: true }), // 지목 동점(최다 정확히 둘) 결선 — 진입 길이 = 앞머리, 그 뒤 길이는 runoffStepMs. 결선도 동점이면 훅이 night 로
  showdown: Object.freeze({ durationMs: SHOWDOWN_GATHER_MS, next: "night", revealsOwnRole: true }), // 마지막 3인 결전 — 진입 길이 = 모이기, 그 뒤 길이는 showdownStepMs. 2표 이상이면 훅이 execution 으로
  verdict: Object.freeze({ durationMs: VERDICT_MS, next: "nomination", revealsOwnRole: true }),
});

/**
 * 기본 다음 단계. 단계 표(PHASE_DEFS)의 next 그대로다 — roleReveal → dayAnnounce → discussion … execution → night → morning → dayAnnounce(첫날 키워드 판의 execution·처형 없는 낮 뒤에는 훅이 answerReveal 을 끼운다).
 * 마감 훅이 돌려준 분기(next)가 이 값보다 먼저다(tick.ts). 처형이 없는 낮의 다음 단계는 훅이 afterDayOf 로 정한다.
 */
export function nextPhaseOf(phase: PhaseId): PhaseId | null {
  return PHASE_DEFS[phase].next;
}

/**
 * 첫날 정답 공개가 남았는지(D-02·D-29): 방 상태에 keyword 가 있고 첫날((day ?? 1) === 1)일 때만 참이다.
 * 키의 존재만 본다 — 이 파일은 클라이언트가 import 하므로 키워드 모듈을 끌어오지 않는다(Pitfall 8).
 */
export function firstDayAnswerPending(state: { day?: number; keyword?: unknown }): boolean {
  return state.keyword !== undefined && (state.day ?? 1) === 1;
}

/**
 * 처형 없이 끝난 낮(투표 동률·0표·결선·결전 무승부)의 다음 단계 한 곳 — 첫날(키워드가 있는 판)이면 answerReveal, 아니면 밤이다(D-02·D-10).
 * 낮 마감 분기의 리터럴을 이 함수 하나로 모은다. 처형이 있었던 날은 마감 훅 routeAfterExecution 이 같은 규칙(firstDayAnswerPending)으로 가른다.
 */
export function afterDayOf(state: { day?: number; keyword?: unknown }): PhaseId {
  return firstDayAnswerPending(state) ? "answerReveal" : "night";
}
