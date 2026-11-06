// 결과 화면 제목·단계 안내가 쓰는 문구만 남았다(08-20, 11-05, 12-01). 후보 공개 시간표·테이블 기하·후광은 v1.0 테이블 화면과 함께, 옛 결과 카드 화면의 연출 시각·요약 줄은 11-05 에 지웠다.
// DOM·현재 시각·난수를 읽지 않는 순수 모듈이다. 이 파일은 역할 문자열(직업 단어)을 만들지 않는다 — 입력은 서버가 모두에게 보낸 공개 타입뿐이다(D-09).
import type { GameWinner, NoExecutionReason } from "../../shared/protocol";

// ---- 문구 정본 ----
// 화면 부품은 문자열을 직접 쓰지 않고 여기서 읽는다.
// 이름(닉네임)은 문자열로만 이어 붙이고 HTML 로 해석하지 않는다(T-04-40). 이름 뒤 '님' 은 받침을 보지 않는다(D-11).
/** 결과 화면 헤더 제목(11-05, 결정 0051): 모임~승리 알림 동안은 "결과", 최종 상태는 승리 한 줄. 읽는 글은 이것뿐이다 */
export const RESULT_TEXT = {
  title: { result: "결과", citizenWin: "시민 승리", mafiaWin: "마피아 승리" },
} as const;

/** 변론 단계 안내(aria-live). name 이 null 이면 후보 본인 */
export function defenseAnnounce(name: string | null): string {
  return name === null ? "내 최후 변론" : `${name}님의 최후 변론`;
}

/** 처형 무효 카드 부제 (D-34) */
export function noExecutionText(reason: NoExecutionReason): string {
  switch (reason) {
    case "tie":
      return "동률이라 처형하지 않아요";
    case "noVotes":
      return "던진 표가 없어요";
  }
}
/** 처형 무효로 시작한 밤의 단계 안내 앞에 붙는 접두 */
export function noExecutionPrefix(reason: NoExecutionReason): string {
  return `처형 무효. ${noExecutionText(reason)}. `;
}

/** 종료 단계 읽기 문구 */
export function endedAnnounce(winner: GameWinner): string {
  return `게임이 끝났습니다. ${winner === "citizenWin" ? "시민 팀" : "마피아 팀"} 승리`;
}
/** 승리 배너 제목·부제와 읽기 문구 */
export function winnerText(winner: GameWinner): { title: string; sub: string; announce: string } {
  return winner === "citizenWin"
    ? { title: "시민 팀 승리", sub: "마피아가 모두 탈락했어요", announce: endedAnnounce(winner) }
    : { title: "마피아 팀 승리", sub: "마피아 수가 나머지 생존자 수와 같아졌어요", announce: endedAnnounce(winner) };
}
