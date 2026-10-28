import type { MorningView } from "../../shared/protocol";

// 아침 발표 카드의 문장 표 한 곳(UI-SPEC M, 시안 M1·M2). 서버는 문구 번호(1..MORNING_PHRASE_COUNT)와 탈락 seat 만 보내고,
// 문장은 화면이 만든다. 이름 뒤에는 받침과 상관없이 항상 '님이' 를 붙인다(받침 판정 없음).
// 문자열만 만든다 — 호출자가 React 텍스트로 그린다(HTML 해석 없음).
// 처형 발표 문구(D-11, 결정 0036 7항) — 서버는 번호 1..EXECUTION_PHRASE_COUNT 만 보낸다. 아침 묶음과 따로 센다.

/** 번호 1..7 의 꼬리 문장(이름과 '님이' 뒤에 붙는다). 길이는 서버 MORNING_PHRASE_COUNT 와 같아야 한다(단위 테스트가 단언) */
export const ELIMINATION_TAILS = [
  "조용히 눈을 감았습니다",
  "억울하게 목숨을 잃었습니다",
  "차갑게 식은 채 발견되었습니다",
  "끝내 아침을 맞지 못했습니다",
  "어둠 속으로 사라졌습니다",
  "마지막 숨을 거두었습니다",
  "밤사이 변을 당했습니다",
] as const;

/** 탈락자 제목 한 줄. 번호가 1..7 정수가 아니면(옛·새 버전 차이) 첫 문구를 쓴다 — 예외 없음 */
export function eliminationTitle(phrase: number | undefined, nickname: string): string {
  const ok = typeof phrase === "number" && Number.isInteger(phrase) && phrase >= 1 && phrase <= ELIMINATION_TAILS.length;
  const tail = ELIMINATION_TAILS[ok ? phrase - 1 : 0];
  return `${nickname}님이 ${tail}`;
}

/** 처형 번호 1..4 의 꼬리 문장(D-11). 길이는 서버 EXECUTION_PHRASE_COUNT 와 같아야 한다(단위 테스트가 단언) */
export const EXECUTION_TAILS = [
  "더는 함께할 수 없게 되었습니다",
  "형장의 이슬이 되었습니다",
  "잔혹하게 처형되었습니다",
  "처형대에 올랐습니다",
] as const;

/** 처형 발표 제목 한 줄. 번호가 1..4 정수가 아니면 첫 문구를 쓴다 — 예외 없음. 이름 뒤에는 항상 '님이' */
export function executionTitle(phrase: number | undefined, nickname: string): string {
  const ok = typeof phrase === "number" && Number.isInteger(phrase) && phrase >= 1 && phrase <= EXECUTION_TAILS.length;
  const tail = EXECUTION_TAILS[ok ? phrase - 1 : 0];
  return `${nickname}님이 ${tail}`;
}

/** 탈락자가 없거나 의사가 지킨 아침(D-13: 둘은 화면에서 구분되지 않는다) */
export const MORNING_SAFE = { title: "아무 일도 없었습니다", sub: "모두 무사해요" } as const;

export interface MorningCardContent {
  title: string;
  sub?: string;
}

/** 카드(와 아침 단계 안내)가 읽는 문장. 탈락자가 있고 닉네임을 찾으면 제목 하나, 아니면 무사 문구 */
export function morningCardText(
  morning: MorningView | undefined,
  nicknameOf: (seat: number) => string | undefined,
): MorningCardContent {
  if (morning?.eliminated !== undefined) {
    const name = nicknameOf(morning.eliminated);
    if (name !== undefined) return { title: eliminationTitle(morning.phrase, name) };
  }
  return { title: MORNING_SAFE.title, sub: MORNING_SAFE.sub };
}
