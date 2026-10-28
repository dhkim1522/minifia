// 승패 판정. 순수 모듈이다 — 현재 시각·난수를 읽지 않고, 입력 상태는 바꾸지 않는다.
//
// 이 파일은 역할을 읽지만 팀 문자열 하나만 돌려준다(결정 0002): 반환값에 seat·직업·인원 수는 없다.
// 분모는 연결과 무관한 생존자다(D-05) — 끊긴 사람도 살아 있으면 센다. 그래서 이 파일은 연결 상태를 읽지 않는다.
// 호출은 처형·아침 마감 훅에서만 한다(Pitfall 19, endgame.ts): 진입 훅에서 부르면 암살 발표 5초가 끊긴다(D-10).
// 규칙표(END-01):
//   역할이 한 명에게도 배정되지 않음(대기실·역할 없는 테스트 상태) → null (거짓 승리 금지, T-04-19)
//   살아 있는 마피아 0                                              → citizen
//   살아 있는 마피아 수 >= 나머지 생존자 수                          → mafia
//   그 밖                                                           → null
import { isAlive } from "./alive";
import type { RoomState } from "./room";

/** 내부 승리 팀. 상태·와이어의 GameWinner("citizenWin"·"mafiaWin")로의 변환은 endgame.ts enterEnded 한 곳에서 한다. */
export type Winner = "citizen" | "mafia";

export function checkWinner(state: RoomState): Winner | null {
  if (!state.players.some((p) => p.role !== undefined)) return null;
  const living = state.players.filter(isAlive);
  const mafia = living.filter((p) => p.role === "mafia").length;
  const others = living.length - mafia;
  if (mafia === 0) return "citizen";
  if (mafia >= others) return "mafia";
  return null;
}
