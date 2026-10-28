// 종료 분기와 종단 단계 진입. 순수 모듈이다 — 현재 시각·전역 난수를 읽지 않고, 입력 상태는 바꾸지 않는다.
//
// 승패는 처형(execution)과 아침(morning)의 마감 훅에서만 판정한다(D-10, Pitfall 19): 진입 훅에서 판정하면 암살 발표 5초가 끊긴다.
// 마감 훅이 next "ended" 를 돌려주면 tick 이 종단 단계로 가고, 아니면 표의 기본 다음 단계(처형 → 밤, 아침 → 낮 시작)로 간다.
// 종료 방 정리는 새 타이머가 아니라 만료(expiresAt)를 앞당기는 것뿐이다: nextWakeAt 이 이미 만료를 알람으로 쓰고, 만료되면 DO 가 방을 닫는다.
// 승리 값 변환은 enterEnded 한 곳: 내부 checkWinner 의 "citizen"·"mafia" → 상태·와이어의 GameWinner "citizenWin"·"mafiaWin"(역할 단어와 겹치지 않는다, Pitfall 10).
import type { GameWinner, SummaryRow } from "../protocol";
import type { RoomState } from "./room";
import type { DeadlineResult, RandInt } from "./tick";
import { checkWinner } from "./win";

/** 종료 뒤 방이 남아 있는 시간(D-28). 진입 시각 + 이 값이 기존 만료보다 이르면 만료를 앞당긴다. */
export const ENDED_ROOM_TTL_MS = 30 * 60 * 1000;

const WIRE_WINNER: Readonly<Record<"citizen" | "mafia", GameWinner>> = Object.freeze({
  citizen: "citizenWin",
  mafia: "mafiaWin",
});

function routeByWinner(state: RoomState): DeadlineResult {
  return checkWinner(state) === null ? { state, stay: false } : { state, stay: false, next: "ended" };
}

/** execution 마감 훅: 승패가 났으면 ended, 아니면 기본 다음 단계(night). 상태는 바꾸지 않는다. */
export function routeAfterExecution(state: RoomState): DeadlineResult {
  return routeByWinner(state);
}

/** morning 마감 훅: 승패가 났으면 ended(아침 5초를 다 보여 준 뒤), 아니면 기본 다음 단계(dayAnnounce). 상태는 바꾸지 않는다. */
export function routeAfterMorning(state: RoomState): DeadlineResult {
  return routeByWinner(state);
}

/**
 * ended 진입 훅: winner 를 와이어 값으로 기록하고 만료를 min(기존, 진입 시각 + 30분)으로 앞당긴다. 난수를 부르지 않는다.
 * 승패가 없으면(마감 훅이 막아 도달할 수 없다) winner 키를 만들지 않는다.
 */
export function enterEnded(state: RoomState, _randInt: RandInt, at: number): RoomState {
  const team = checkWinner(state);
  return {
    ...state,
    expiresAt: Math.min(state.expiresAt, at + ENDED_ROOM_TTL_MS),
    ...(team === null ? {} : { winner: WIRE_WINNER[team] }),
  };
}

/**
 * 판 요약(END-02, D-27): 공개 기록(voteLog)과 서버 전용 밤 기록(nightLog)을 일차별로 합쳐 날짜 오름차순 한 줄씩 만든다.
 * 줄과 하위 객체는 필드별로 새로 만든다 — Player·상태를 펼쳐 복사하지 않는다(Pitfall 22). 조건을 채울 때만 키가 생긴다:
 *   exec  : 그날 voteLog 줄이 있을 때 { yes, no, passed }, 후보가 있으면 candidate
 *   night : 그날 nightLog 줄이 있을 때 { died }, 지목이 있으면 target (died false + target 은 지목했는데 아무도 안 죽은 밤 — 의사 구출, D-27)
 * nightLog 를 읽는 곳은 이 함수 하나이고, view 가 ended 단계에서만 이 함수를 부른다 — 판 중에는 어떤 view 에도 실리지 않는다(결정 0020-3, T-04-18).
 */
export function buildSummary(state: RoomState): SummaryRow[] {
  const votes = state.voteLog ?? [];
  const nights = state.nightLog ?? [];
  const days = [...new Set([...votes.map((v) => v.n), ...nights.map((night) => night.n)])].sort((a, b) => a - b);
  return days.map((n) => {
    const row: SummaryRow = { n };
    const vote = votes.find((v) => v.n === n);
    if (vote !== undefined) {
      row.exec = { yes: vote.exec.yes, no: vote.exec.no, passed: vote.exec.passed };
      if (vote.cand?.candidate !== undefined) row.exec.candidate = vote.cand.candidate;
    }
    const night = nights.find((entry) => entry.n === n);
    if (night !== undefined) {
      row.night = night.target === undefined ? { died: night.died } : { target: night.target, died: night.died };
    }
    return row;
  });
}
