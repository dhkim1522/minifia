// 처형 진입 훅(찬반 통과 시 변론자 탈락)과 처형 무효 이유. 순수 모듈이다 — 현재 시각·전역 난수를 읽지 않고, 입력 상태는 바꾸지 않는다.
// 난수는 인자 randInt 로만 받는다(방 DO 는 cryptoRandInt, 테스트는 seededRandInt).
//
// 이 파일은 플레이어의 role 을 읽지 않는다: 후보(변론자)는 직업이 아니라 지목이 정하고(결정 0060), 처형 발표에는 직업을 싣지 않는다(D-09).
// 난수 호출 순서 계약(인자 0 호출은 없다 — cryptoRandInt(0) 은 RangeError):
//   enterExecution: 찬반을 통과한 변론자가 있을 때 처형 문구에서 randInt(후보 문구 수) 한 번, 아니면 호출 없음.
import { EXECUTION_PHRASE_COUNT } from "../protocol";
import type { NoExecutionReason } from "../protocol";
import type { RoomState } from "./room";
import type { RandInt } from "./tick";

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
