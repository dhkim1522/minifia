// 판 종류(19페이즈)의 고정 문구 한 곳: 시트 제목·칸 이름·한 줄 설명·접근성 글·알림 글. 사용자 문자열은 없다.
// 글은 최소로(결정 0051) — 방장 단추에는 보이는 글이 없고(D-15) 보이는 새 글은 시트 제목·칸 이름·한 줄 설명·칩 이름·알림 한 줄이 전부다(19-UI-SPEC Copywriting).
// 방장이 아닌 사람은 '참가자'라고 부른다. 판 종류는 공개 값이라 이 문구에 역할·좌석 정보가 실리지 않는다.
import type { GameMode } from "../../shared/protocol";

/** 시트 칸 순서(고정): 기본 마피아 · 확장판. 기본 선택은 서버 기본값(확장판, D-01)이다 */
export const MODE_ORDER: readonly GameMode[] = ["basic", "extended"];

const NAME: Readonly<Record<GameMode, string>> = { basic: "기본 마피아", extended: "확장판" };
const DESC: Readonly<Record<GameMode, string>> = { basic: "토론하고 투표해요", extended: "증거를 찾아 추리해요" };

export const MODE_TEXT = {
  /** 시트 제목·시트 접근성 이름 */
  title: "판 종류",
  /** 칸 이름·참가자 칩 글 */
  name: NAME,
  /** 칸 한 줄 설명 */
  desc: DESC,
  /** [판 종류] 단추의 접근성 이름(지금 값) */
  aria: (mode: GameMode): string => `판 종류: ${NAME[mode]}`,
  /** 판 종류가 바뀌었을 때 참가자에게 띄우는 한 줄(P19-9). 조사를 피한 고정 문구 */
  changed: (mode: GameMode): string => `판 종류: ${NAME[mode]}`,
  /** [튜토리얼 먼저] 토글을 켜고 끌 때의 한 줄(P19-8) */
  tutorialOn: "튜토리얼 먼저 켰어요",
  tutorialOff: "튜토리얼 껐어요",
  /** 방장 줄·왕관 표식의 접근성 이름 */
  rail: "방장 전용",
} as const;
