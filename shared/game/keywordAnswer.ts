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
