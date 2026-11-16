import type { KeywordAnswerRow, RoomView } from "../../shared/protocol";

// 첫날 키워드의 공개 값을 읽는 선택기(23-11, UI-SPEC 남은 위험 "한 선택기").
// 시트(첫날 답 탭)·사회자 줄(결과 정답)·자동 열림이 모두 이 함수만 거친다 — 값이 없으면 undefined 라 그 화면은 아무것도 그리지 않는다.
// 서버가 answerReveal 전에는 정답을 보내지 않으므로(23-05, T-23-40) 여기서 따로 걸러 내지 않는다.

/** 정답 키워드. answerReveal 진입 프레임부터 모두에게 같은 값 — 그 전에는 undefined */
export function keywordAnswerOf(view: RoomView): string | undefined {
  return view.day?.keyword?.answer;
}

/** 첫날 답 공개 목록(낸 순서 → 답 없음). keyword 단계가 끝난 뒤 판 내내 남고 그 전에는 undefined */
export function keywordAnswersOf(view: RoomView): KeywordAnswerRow[] | undefined {
  return view.day?.keyword?.answers;
}

/** 장르 라벨(예: "영화"). 키워드 기능이 켜지지 않았거나 아직 없으면 undefined */
export function keywordGenreOf(view: RoomView): string | undefined {
  return view.day?.keyword?.genre;
}
