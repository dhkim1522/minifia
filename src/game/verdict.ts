// 결과 화면·밤 패널·단계 안내가 쓰는 문구와 결과 연출 시각만 남았다(08-20). 후보 공개 시간표·테이블 기하·후광은 v1.0 테이블 화면과 함께 지웠다.
// DOM·현재 시각·난수를 읽지 않는 순수 모듈이다. 이 파일은 역할 문자열(직업 단어)을 만들지 않는다 — 입력은 서버가 모두에게 보낸 공개 타입뿐이다(D-09).
import type { GameWinner, NoExecutionReason, SummaryRow, VoteLogEntry } from "../../shared/protocol";

// ---- 결과 화면 연출 시각 (UI-SPEC 11.2) ----
export const RESULT_FLIP_AT_MS = 300; // UI-SPEC 11.2: 카드가 직업 그림으로 바뀌는 시각
export const RESULT_SUMMARY_AT_MS = 900; // UI-SPEC 11.2: 요약 카드·버튼이 나타나는 시각

// ---- 문구 정본 ----
// 화면 부품은 문자열을 직접 쓰지 않고 여기서 읽는다.
// 이름(닉네임)은 문자열로만 이어 붙이고 HTML 로 해석하지 않는다(T-04-40). 이름 뒤 '님' 은 받침을 보지 않는다(D-11).
/** 닉네임을 못 찾을 때(자리 정보가 없는 데이터 이상) 쓰는 이름. 화면이 멈추지 않게 한다. */
export const UNKNOWN_NAME = "알 수 없는 사람";
/** 자리 → 닉네임. 못 찾으면 undefined */
export type NicknameOf = (seat: number) => string | undefined;
const nameFor = (nicknameOf: NicknameOf, seat: number): string => nicknameOf(seat) ?? UNKNOWN_NAME;

export const VERDICT_TEXT = {
  // 밤 패널의 지목 줄
  candidateNone: "선택 안 함",
  /** 확정 알약은 자리 색 점과 굵은 이름이 따로 그려지므로 이름 뒤 조각만 둔다(D-19) */
  votedSuffix: "님에게 투표했어요",
  // ended
  endedTitle: "게임 종료",
  summaryTitle: "이번 판 기록",
  homeButton: "처음으로",
  roomCloseNote: "이 방은 30분 뒤에 닫혀요", // P-6
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

export interface SummaryLine {
  n: number;
  kind: "day" | "night";
  /** 앞 열: `{n}일차 낮` / `{n}일차 밤` */
  label: string;
  text: string;
}

/**
 * 판 요약 행: 일차 오름차순으로 낮 → 밤. 낮은 처형(후보 득표 수 포함)·무효 세 갈래, 밤은 사망·의사가 지킴·지목 없음.
 * exec 가 없는 일차는 낮 행이 없고 night 가 없으면 밤 행이 없다. 입력 배열은 바꾸지 않는다.
 */
export function summaryLines(
  summary: readonly SummaryRow[],
  voteLog: readonly VoteLogEntry[],
  nicknameOf: NicknameOf,
): SummaryLine[] {
  const lines: SummaryLine[] = [];
  for (const row of [...summary].sort((a, b) => a.n - b.n)) {
    const log = voteLog.find((entry) => entry.n === row.n);
    if (row.exec !== undefined) {
      const { yes, no, passed, candidate } = row.exec;
      let text: string;
      if (passed && candidate !== undefined) {
        const name = nameFor(nicknameOf, candidate);
        text =
          log?.cand === undefined
            ? `${name}님 처형`
            : `${name}님 처형 (${log.cand.votes.filter((v) => v.target === candidate).length}표)`;
      } else if (!passed) {
        text = `처형 없음 (찬성 ${yes} · 반대 ${no})`;
      } else {
        text = log?.cand !== undefined && log.cand.votes.length === 0 ? "처형 없음 (던진 표 없음)" : "처형 없음 (동률)";
      }
      lines.push({ n: row.n, kind: "day", label: `${row.n}일차 낮`, text });
    }
    if (row.night !== undefined) {
      const { target, died } = row.night;
      const text =
        target === undefined
          ? "아무 일도 없었어요"
          : died
            ? `${nameFor(nicknameOf, target)}님 사망`
            : `${nameFor(nicknameOf, target)}님을 노렸지만 의사가 지켰어요`;
      lines.push({ n: row.n, kind: "night", label: `${row.n}일차 밤`, text });
    }
  }
  return lines;
}

/** 결과 화면 부제: 요약 마지막 행에 night 가 있으면 `{n}일차 밤`, 없으면 `{n}일차 낮`, 행이 없으면 빈 문자열 */
export function endedSubtitle(summary: readonly SummaryRow[]): string {
  const last = summary[summary.length - 1];
  if (last === undefined) return "";
  return last.night !== undefined ? `${last.n}일차 밤` : `${last.n}일차 낮`;
}
