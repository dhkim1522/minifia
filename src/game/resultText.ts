// 결과 탭 패널·공개 예고의 고정 문구 한 곳 (11-07, UI-SPEC A-3·A-4). 사용자 입력 문자열은 여기 없다 — 닉네임·본문은 화면이 React 텍스트 노드로만 그린다(T-11-22).
// 마피아·유령 단어가 든 문구(탭 라벨·접근성 이름)는 결과 화면(ended 전용 ResultPanel)에서만 읽는다 — 판 중 화면에는 닿지 않는다(T-11-23).
import { RULESET } from "../../shared/game/ruleset";

/** 결과 탭 아이디. 표시 순서가 이 배열의 순서다 */
export const RESULT_TABS = ["all", "mafia", "ghost", "whisper", "log"] as const;
export type ResultTabId = (typeof RESULT_TABS)[number];

/**
 * 화면에 실제로 그리는 탭(순서는 RESULT_TABS 와 같다). 기본판(결정 0072)에서는 귓속말이 꺼져 있어 귓속말 탭을 뺀다(U-8) — RESULT_TABS 와 ResultTabId 는 그대로 둔다(RULESET.whisper 를 켜면 다시 보인다).
 */
export const RESULT_TABS_SHOWN: readonly ResultTabId[] = RESULT_TABS.filter((id) => id !== "whisper" || RULESET.whisper);

export const RESULT_PANEL_TEXT = {
  /** 선택된 탭의 라벨(14px, 아이콘 옆) */
  tab: { all: "전체", mafia: "마피아", ghost: "유령", whisper: "귓속말", log: "기록" },
  /** 탭 접근성 이름(아이콘만 있는 버튼) */
  tabName: { all: "전체 대화", mafia: "마피아 밤 대화", ghost: "유령 대화", whisper: "귓속말 기록", log: "판 기록" },
  /** 공개 예고(역할 확인 단계 아래쪽 4초, 귓속말 보내기 시트 위쪽 항상). 모두에게 같은 문구라 역할 정보를 나르지 않는다 */
  // 기본판(결정 0072)에서는 귓속말이 꺼져 있어 문구에서도 뺀다(U-8: 꺼진 장치의 글이 없다). RULESET.whisper 를 켜면 원래 문구다.
  preNotice: RULESET.whisper ? "끝나면 밤 대화와 귓속말이 공개돼요" : "끝나면 밤 대화가 공개돼요",
} as const;

/** 마피아 탭의 구분선: 줄의 n 이 바뀔 때마다 앞에 한 번 */
export const nightDivider = (n: number): string => `${n}밤`;
/** 유령·귓속말 탭의 구분선 */
export const dayDivider = (n: number): string => `${n}일차`;

/** 공개 예고가 역할 확인 단계에서 보이는 시간(ms). 모든 역할이 같다(T-11-24) */
export const PRE_NOTICE_MS = 4000;

// ---- 다시 하기 (11-12, 결정 D-11~D-13, UI-SPEC D) ----
// 고정 문구 한 곳. 닉네임·본문 같은 사용자 문자열은 여기 없다 — 화면이 React 텍스트 노드로만 그린다. 모두 해요체, 마침표 없음.

export const READY_TEXT = {
  /** 손님 알약 라벨(꺼짐 / 켜짐) */
  ready: "준비",
  readyOn: "준비됨",
  /** 켜진 손님 알약의 접근성 이름 */
  readyOnLabel: "준비됨, 눌러서 취소",
  /** 방장 알약 윗줄 */
  start: "시작",
  /** 방장 알약 접근성 이름 */
  startLabel: (n: number): string => `다음 판 시작, ${n}명 준비`,
  /** 이름표 체크의 접근성 이름(결과 화면) */
  tagDone: "준비됨",
  /** 쉬게 될 사람 확인 시트 / 쉬는 사람 화면의 한 줄 */
  rest: "이번 판은 쉬어요",
  /** 확인 시트 버튼 */
  confirmStart: "시작",
  confirmCancel: "취소",
  /** 인원이 모자라 눌렀을 때 토스트(로비와 같은 문구) */
  needPlayers: (min: number): string => `${min}명부터 시작해요`,
  /** 쉬는 사람 화면 [나가기] */
  leave: "나가기",
} as const;
