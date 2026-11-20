import type { RoomView } from "../../shared/protocol";

/** 첫날 정답 공개 연출에 쓰는 제시어. */
export function keywordAnswerOf(view: RoomView): string | undefined {
  return view.phase === "answerReveal" && view.day?.n === 1 ? view.day.keyword?.answer : undefined;
}

/** 첫날 답안 발표의 현재 차례만 읽는다. */
export function keywordPresentationOf(view: RoomView) {
  return view.phase === "dayAnnounce" && view.day?.n === 1 ? view.day.keyword?.presentation : undefined;
}
