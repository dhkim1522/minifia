// 단계 길이 파생 한 곳 — 단계 표 길이 그대로다(후보 공개 단계의 표 수 길이 공식은 08-22 에 없어졌다). 방장 연장·넘기기는 결정 0017-5 로 없앴다.
// 청소는 discussion 진입 한 곳 — 지난 낮의 verdict·execution 과 개인 키(nominate·verdictVote·endVote)가 다음 낮에 새지 않게 한다(RESEARCH Pitfall 1).
// tick 표의 ON_ENTER.discussion 이 enterDiscussion 을 건다(08-11).
// 순수 모듈이다 — 입력 상태는 바꾸지 않는다.
import { noExecutionOf } from "./execution";
import { keywordPresentationOf } from "./keywordPresentation";
import { nominationStepMs } from "./nomination";
import { firstPlaytestDay, PLAYTEST_BALLOT_MS, PLAYTEST_DISCUSSION_MS, PLAYTEST_KEYWORD_MS, PLAYTEST_MORNING_EXTRA_MS, PLAYTEST_RESULT_MS, PLAYTEST_ROLE_MS } from "./playtest";
import { runoffStepMs } from "./runoff";
import { showdownStepMs } from "./showdown";
import { ANSWER_REVEAL_MS, FIRST_ANSWER_TURN_MS, MORNING_MAX_MS, MORNING_MS, MORNING_NOTE_MS, MORNING_VICTIM_MS, MORNING_WILL_MS, NO_EXECUTION_MS, PHASE_DEFS } from "./phases";
import type { RoomState } from "./room";

/** 낮 투표의 거부 코드. 단계가 아니면 WRONG_PHASE, 그 밖의 잘못된 입력은 BAD_MESSAGE. */
export type VoteError = "WRONG_PHASE" | "BAD_MESSAGE";

/**
 * 아침 길이(ms, MORN-04, 결정 0061-13): 탈락이 없으면 MORNING_MS, 있으면 MORNING_MS + 탈락 + (피해자 유언이 비어 있지 않으면 유언) + (쪽지가 비어 있지 않으면 쪽지), 상한 MORNING_MAX_MS.
 * 공개 내용만의 함수다(L6) — 구출·무효 밤은 enterMorning 이 쪽지를 이미 지워서 5초이고, 경찰 선택·마피아 이동·보호 대상은 읽지 않는다.
 * 피해자 유언은 죽은 뒤 바꿀 수 없어(A2) 아침 동안 길이가 변하지 않는다.
 */
export function morningMsOf(state: RoomState): number {
  const seat = state.morning?.eliminated;
  if (seat === undefined) return MORNING_MS;
  const will = state.players.find((p) => p.seat === seat)?.will;
  const ms =
    MORNING_MS +
    MORNING_VICTIM_MS +
    (will !== undefined && will !== "" ? MORNING_WILL_MS : 0) +
    (state.nightNote !== undefined && state.nightNote !== "" ? MORNING_NOTE_MS : 0);
  return Math.min(MORNING_MAX_MS, ms);
}

/**
 * 지금 단계의 전체 길이(ms). 단계 표 길이 그대로이고(아침은 morningMsOf), 길이가 없는 단계는 null. buildView 가 이 함수로 phaseDurationMs 를 만든다.
 */
export function phaseDurationOf(state: RoomState): number | null {
  if (firstPlaytestDay(state)) {
    if (state.phase === "roleReveal") return PLAYTEST_ROLE_MS;
    if (state.phase === "keyword") return PLAYTEST_KEYWORD_MS;
    if (state.phase === "discussion") return PLAYTEST_DISCUSSION_MS;
    if (state.phase === "verdict") return state.firstBallotOutcome === undefined ? PLAYTEST_BALLOT_MS : PLAYTEST_RESULT_MS;
    if (state.phase === "morning") return morningMsOf(state) + PLAYTEST_MORNING_EXTRA_MS;
  }
  if (keywordPresentationOf(state) !== undefined) return FIRST_ANSWER_TURN_MS;
  if (state.phase === "morning") return morningMsOf(state);
  // 첫날 정답 공개(D-22): 처형이 있었으면 3초, 처형 없는 첫날이면 "처형 없음" 큰 글 1.4초가 앞에 붙어 4.4초다. 처형 없음 여부는 이미 공개된 값(day.noExecution)이라 길이로 새는 정보가 없다.
  if (state.phase === "answerReveal") return ANSWER_REVEAL_MS + (noExecutionOf(state) === undefined ? 0 : NO_EXECUTION_MS);
  if (state.phase === "nomination" && state.pickTurn !== undefined) return nominationStepMs(state);
  if (state.phase === "runoff" && state.runoff !== undefined) return runoffStepMs(state);
  if (state.phase === "showdown" && state.showdown !== undefined) return showdownStepMs(state);
  return PHASE_DEFS[state.phase].durationMs;
}

/**
 * discussion 진입 훅: 지난 낮의 verdict·execution 과 모든 플레이어의 nominate·verdictVote·endVote 를 키째 지운다.
 * 날짜별 기록(voteLog)과 그 밖의 키는 그대로 둔다.
 */
export function enterDiscussion(state: RoomState): RoomState {
  const {
    verdict: _verdict, execution: _execution, pickTurn: _pickTurn, runoff: _runoff,
    showdown: _showdown, firstBallotOutcome: _firstBallotOutcome, keywordPresentationIndex: _presentation, ...rest
  } = state;
  return {
    ...rest,
    players: state.players.map((p) => {
      const { nominate: _nominate, verdictVote: _verdictVote, endVote: _endVote, runoffVote: _runoffVote, showdownPick: _showdownPick, roleReady: _roleReady, firstBallot: _firstBallot, ...kept } = p;
      return kept;
    }),
  };
}
