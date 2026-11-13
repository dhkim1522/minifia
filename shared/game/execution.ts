// 처형 진입 훅(찬반 통과 시 변론자 탈락)과 처형 무효 이유. 순수 모듈이다 — 현재 시각·전역 난수를 읽지 않고, 입력 상태는 바꾸지 않는다.
// 난수를 부르지 않는다 — 처형 문구 번호는 08-22 에 없어졌다(결정 0060-5).
//
// 이 파일은 플레이어의 role 을 읽지 않는다: 후보(변론자)는 직업이 아니라 지목이 정하고(결정 0060), 처형 발표에는 직업을 싣지 않는다(D-09).
import type { NoExecutionReason } from "../protocol";
import type { RoomState } from "./room";
import { modeOf, rulesetOf } from "./ruleset";

/**
 * execution 진입 훅: 후보를 탈락(alive false)시키고 처형 발표(execution { seat, phrase })를 기록한다(D-06, D-11).
 * 직업은 어디에도 싣지 않는다(D-09) — 처형된 본인은 탈락자 관전(결정 0021)으로 모두의 직업을 받는다.
 * 발표에는 탈락한 seat 뿐이다(문구 번호 없음, 결정 0060-5) — 난수를 부르지 않는다.
 * 찬반이 통과하지 않았거나(부결) 후보가 없거나 후보가 방에 없으면 입력 그대로다(결정 0060-1, DAY-06).
 */
export function enterExecution(state: RoomState): RoomState {
  if (state.verdict?.passed !== true) return state;
  const seat = state.verdict.candidate;
  if (seat === undefined || !state.players.some((p) => p.seat === seat)) return state;
  return {
    ...state,
    players: state.players.map((p) => (p.seat === seat ? { ...p, alive: false } : p)),
    execution: { seat },
  };
}

/**
 * 처형이 성립하지 않아 다음 밤을 향해 온 그 단계의 이유 코드(D-34). 새 상태 필드를 두지 않고 그날 공개 투표 기록(voteLog)에서 파생한다 —
 * 새 정보가 생기지 않고, 이유를 주는 단계에서만 값을 주므로 다음 단계로 넘어가면 저절로 사라진다(지울 상태가 없다).
 * 기본 마피아는 단계가 night 이고 그날(day) 줄을 본다. 확장판(21페이즈 D-01)은 처형 없는 날 다음이 저녁이고 저녁 진입이 일차를 올리므로
 * 단계가 errand 이고 전날(day − 1) 줄을 본다 — 첫 저녁(전날 줄 없음)은 없음이다.
 *   이유를 주는 단계가 아님                                     → 없음
 *   그날 줄이 없음                                              → 없음
 *   줄에 cand 가 없음(옛 상태)                                  → 없음
 *   cand.candidate 가 있음(변론·찬반이 있었다)                  → 없음 — 통과든 부결이든 결과는 처형 단계에서 이미 알렸다
 *   cand.candidate 가 없고 cand.votes 가 비어 있음              → noVotes
 *   cand.candidate 가 없고 cand.votes 가 있음(최다 동률)        → tie
 * 찬반 부결은 처형 단계가 알린다(이유 코드는 tie·noVotes 둘뿐). 반환은 새 객체 리터럴이다(키는 reason 하나).
 */
export function noExecutionOf(state: RoomState): { reason: NoExecutionReason } | undefined {
  const extended = rulesetOf(modeOf(state)).errand;
  if (state.phase !== (extended ? "errand" : "night")) return undefined;
  const day = (state.day ?? 1) - (extended ? 1 : 0);
  const entry = (state.voteLog ?? []).find((e) => e.n === day);
  if (entry?.cand === undefined || entry.cand.candidate !== undefined) return undefined;
  return { reason: entry.cand.votes.length === 0 ? "noVotes" : "tie" };
}
