// 후보 선택 공개 → 변론 → 처형 진입·마감 훅과 처형 무효 이유. 순수 모듈이다 — 현재 시각·전역 난수를 읽지 않고, 입력 상태는 바꾸지 않는다.
// 난수는 인자 randInt 로만 받는다(방 DO 는 cryptoRandInt, 테스트는 seededRandInt).
//
// 이 파일은 플레이어의 role 을 읽지 않는다: 후보는 직업이 아니라 투표가 정하고(결정 0034), 처형 발표에는 직업을 싣지 않는다(D-09).
// 난수 호출 순서 계약(인자 0 호출은 없다 — cryptoRandInt(0) 은 RangeError):
//   enterCandidateVoteReveal: 던진 표 수 n ≥ 2 이면 셔플에서 randInt(n), randInt(n-1), …, randInt(2) (vote.ts tallyCandidateVote), n ≤ 1 이면 호출 없음.
//   enterExecution: 후보가 있을 때 처형 문구에서 randInt(후보 문구 수) 한 번, 후보가 없으면 호출 없음.
import { EXECUTION_PHRASE_COUNT } from "../protocol";
import type { NoExecutionReason } from "../protocol";
import type { RoomState } from "./room";
import type { DeadlineResult, RandInt } from "./tick";
import { tallyCandidateVote } from "./vote";

/**
 * candidateVoteReveal 진입 훅: 후보 선택을 한 번에 집계하고 서버가 정한 공개 순서로 기록한다(D-20, D-21).
 *  - 그날(n === state.day ?? 1) voteLog 줄에 cand { votes, candidate? } 를 붙인다. 그 줄은 여부 투표 마감 훅이 항상 만든다 —
 *    줄이 없으면(도달할 수 없는 경로) voteLog 는 그대로 두고 verdict 만 갱신한다.
 *  - verdict 를 { passed: true, candidate? } 로 갱신한다(후보가 있을 때만 candidate 키).
 *  - 모든 플레이어의 candidateVote 키를 지운다: 같은 내용이 공개 기록(voteLog)으로 남았으므로 서버 전용 필드를 끌고 갈 이유가 없다.
 */
export function enterCandidateVoteReveal(state: RoomState, randInt: RandInt): RoomState {
  const { votes, candidate } = tallyCandidateVote(state, randInt);
  const day = state.day ?? 1;
  const log = state.voteLog;
  const at = log === undefined ? -1 : log.map((entry) => entry.n).lastIndexOf(day);
  const next: RoomState = {
    ...state,
    players: state.players.map((p) => {
      const { candidateVote: _candidateVote, ...kept } = p;
      return kept;
    }),
    verdict: candidate === undefined ? { passed: true } : { passed: true, candidate },
  };
  if (log === undefined || at < 0) return next;
  const cand = candidate === undefined ? { votes } : { votes, candidate };
  return { ...next, voteLog: log.map((entry, i) => (i === at ? { ...entry, cand } : entry)) };
}

/**
 * candidateVoteReveal 마감 훅: 후보가 있으면 표의 기본 다음 단계(defense)로, 없으면(동률·0표) night 로 간다(D-25).
 * 공개 구간(표 수 길이, 0표 2초, 결정 0039)은 두 경우 모두 거친다(D-28). 상태는 바꾸지 않는다.
 */
export function routeAfterCandidateVote(state: RoomState): DeadlineResult {
  return state.verdict?.candidate === undefined ? { state, stay: false, next: "night" } : { state, stay: false };
}

/**
 * execution 진입 훅: 후보를 탈락(alive false)시키고 처형 발표(execution { seat, phrase })를 기록한다(D-06, D-11).
 * 직업은 어디에도 싣지 않는다(D-09) — 처형된 본인은 탈락자 관전(결정 0021)으로 모두의 직업을 받는다.
 * 문구는 1..EXECUTION_PHRASE_COUNT 에서 직전 처형 문구(lastExecPhrase)를 뺀 오름차순 후보 중 randInt(후보 수) 한 번이다(아침 문구와 따로 센다).
 * 찬반이 통과하지 않았거나(부결) 후보가 없거나 후보가 방에 없으면 입력 그대로이고 난수를 부르지 않는다(결정 0060-1, DAY-06).
 */
export function enterExecution(state: RoomState, randInt: RandInt): RoomState {
  if (state.verdict?.passed !== true) return state;
  const seat = state.verdict.candidate;
  if (seat === undefined || !state.players.some((p) => p.seat === seat)) return state;
  const phrases: number[] = [];
  for (let n = 1; n <= EXECUTION_PHRASE_COUNT; n += 1) if (n !== state.lastExecPhrase) phrases.push(n);
  const phrase = phrases[randInt(phrases.length)]!;
  return {
    ...state,
    players: state.players.map((p) => (p.seat === seat ? { ...p, alive: false } : p)),
    execution: { seat, phrase },
    lastExecPhrase: phrase,
  };
}

/**
 * 처형이 성립하지 않아 밤으로 온 그 밤 단계의 이유 코드(D-34). 새 상태 필드를 두지 않고 그날 공개 투표 기록(voteLog)에서 파생한다 —
 * 새 정보가 생기지 않고, 단계가 night 일 때만 값을 주므로 아침으로 넘어가면 저절로 사라진다(지울 상태가 없다).
 *   night 가 아니거나 그날(n === day ?? 1) 줄이 없음            → 없음
 *   줄에 cand 가 없음(옛 상태)                                  → 없음
 *   cand.candidate 가 있음(변론·찬반이 있었다)                  → 없음 — 통과든 부결이든 결과는 처형 단계에서 이미 알렸다
 *   cand.candidate 가 없고 cand.votes 가 비어 있음              → noVotes
 *   cand.candidate 가 없고 cand.votes 가 있음(최다 동률)        → tie
 * notMajority 는 더 나오지 않는다(찬반 부결은 처형 단계가 알린다). 반환은 새 객체 리터럴이다(키는 reason 하나).
 */
export function noExecutionOf(state: RoomState): { reason: NoExecutionReason } | undefined {
  if (state.phase !== "night") return undefined;
  const day = state.day ?? 1;
  const entry = (state.voteLog ?? []).find((e) => e.n === day);
  if (entry?.cand === undefined || entry.cand.candidate !== undefined) return undefined;
  return { reason: entry.cand.votes.length === 0 ? "noVotes" : "tie" };
}
