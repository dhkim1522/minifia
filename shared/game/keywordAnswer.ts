// 서버 전용(23-01): 첫날 키워드 단계의 진행 훅. 클라이언트가 import 하는 shared/game/phases.ts 는 이 모듈을 import 하지 않는다(Pitfall 8).
// 23-05·23-06 이 같은 파일에 답 접수·공개·키워드 마감 훅을 더한다.
import type { DeadlineResult } from "./tick";
import type { RoomState } from "./room";

/**
 * 역할 확인 마감 훅(D-01·D-29). 키워드가 있으면 표의 기본 다음 단계(keyword)로 가고,
 * 없으면(옛 저장 방·스위치를 끈 시험) 곧장 낮 시작 발표로 간다 — 기능 전체가 keyword 키 하나로 켜지고 꺼진다.
 */
export function routeAfterRoleReveal(state: RoomState): DeadlineResult {
  return state.keyword === undefined ? { state, stay: false, next: "dayAnnounce" } : { state, stay: false };
}

/**
 * 정답(keyword.word)을 모두의 view 에 실어도 되는지(D-03·D-14, T-23-15). view.ts 의 buildDay 가 이 함수 하나로 day.keyword.answer 를 싣는다.
 * 참인 때: 키워드가 있고 (ended 이거나, 둘째 날 이후이거나, 첫날의 answerReveal·night·morning 일 때).
 * 마피아 view 에 정답이 처음 닿는 프레임은 answerReveal 진입 프레임이다 — keyword·낮·처형 단계(첫날)에는 거짓이고, 그 전까지 키워드 문자열은 시민 편 본인의 me.keyword 에만 있다.
 * 키워드 단계는 state.day 가 아직 없어 (day ?? 1) === 1 로 거짓이다.
 */
export function answerOpenOf(state: RoomState): boolean {
  if (state.keyword === undefined) return false;
  if (state.phase === "ended") return true;
  if ((state.day ?? 1) >= 2) return true;
  return state.phase === "answerReveal" || state.phase === "night" || state.phase === "morning";
}
