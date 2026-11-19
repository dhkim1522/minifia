import type { KeywordAnswerRow, RoomView } from "../../shared/protocol";

/** 첫날 정답 공개 연출에 쓰는 제시어. */
export function keywordAnswerOf(view: RoomView): string | undefined {
  return view.phase === "answerReveal" && view.day?.n === 1 ? view.day.keyword?.answer : undefined;
}

/** 첫날 토론이 시작되면 전원에게 같은 순서로 공개하는 답안. */
export function keywordAnswersOf(view: RoomView): KeywordAnswerRow[] | undefined {
  return view.phase === "discussion" && view.day?.n === 1 ? view.day.keyword?.answers : undefined;
}
