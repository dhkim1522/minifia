// 23-03: 키워드 단계 답의 길이·간격 상수(D-07). 클라이언트가 import 해도 되는 가벼운 파일이다 — 의존이 없다.
// 판정 로직은 keywordGuard·keywordAnswer(서버 전용)에 있고, src/ 는 그것들을 import 하지 않는다(keywordStaticGuard.test).

/** 답 상한(자소). 서버와 화면(입력 카운터)이 같은 값을 쓴다. */
export const ANSWER_MAX_GRAPHEMES = 20;

/**
 * 사람마다 초안·확정 각각의 최소 간격(ms). 수락·거절 모두 센다 — 마피아의 떠보기를 400ms 당 1회로 묶는다(RESEARCH P2).
 * 안의 요청은 방 DO 가 오류 없이 버린다(서버 한 곳이 잰다).
 */
export const ANSWER_MIN_GAP_MS = 400;
