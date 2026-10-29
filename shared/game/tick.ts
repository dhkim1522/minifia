// 순수 단계 진행. 시각은 인자 now(호출자인 방 Durable Object 의 서버 시각) 하나뿐이다 —
// 이 파일은 현재 시각을 스스로 읽지 않고, 클라이언트가 보낸 값도 받지 않는다.
// 연결 여부·인원은 보지 않는다: 끊긴 사람을 기다리지 않고 서버 시각대로 진행한다(D-05, D-18).
//
// 진입 훅 표(ON_ENTER)의 규칙: 어떤 단계에 들어갈 때 일어나야 하는 상태 변화는 이 표에 한 줄로 둔다.
// 훅은 tick 루프 안에서만 부른다 — 알람이 늦어 여러 단계를 한 번에 따라잡아도 중간 단계 훅이 순서대로 모두 돈다.
// 알람 핸들러나 DO 에서 훅을 직접 부르지 않는다. 3·4페이즈도 같은 표에 행을 더한다.
// claim: 이번 낮 차례 순서·시작 자리, night: 선택·지난 아침 비움, morning: 판정(난수 사용),
// execVote: 지난 투표 흔적 청소, candidateVoteReveal: 후보 선택 집계·서버 셔플 공개 순서(난수 사용), execution: 후보 탈락·처형 문구(난수 사용), ended: winner 기록·방 만료를 진입 + 30분으로 앞당김(endgame.ts).
// 마감 훅(ON_DEADLINE): 같은 단계에 머무는 단계(claim 의 차례)의 마감 처리. 진입 훅과 같이 tick 루프 안에서만 부른다(결정 0016-2).
// 마감 훅 행: claim(차례 넘김), execVote(여부 집계 → 통과 아니면 night), candidateVoteReveal(후보 없음 → night). execution·morning(승패면 next ended, 아니면 기본 단계 — 판정은 마감 훅에서만, D-10). ended 는 마감이 없는 종단 단계다.
// 새 마감 = 이전 마감 + phaseDurationOf(진입 훅 뒤 상태) — 공개 단계는 훅이 집계한 표 수로 길이가 정해진다(결정 0039).
// 훅이 stay 를 돌려주면 다음 단계로 가지 않고 같은 단계에서 마감만 "이전 마감 + 단계 길이" 로 옮긴다.
// 난수는 세 번째 인자로만 받는다 — 방 DO 는 cryptoRandInt, 테스트는 seededRandInt.
// 분기(4페이즈): 마감 훅이 next 를 돌려주면 그 단계로, 없으면 단계 표(PHASE_DEFS)의 기본 next 로 간다. 표는 데이터만 두고 분기는 훅이 정한다.
// 진입 훅의 세 번째 인자 at 은 진입 시각(= 이전 마감)이다 — 시각을 스스로 읽지 않는 순수 규칙이 "진입 + 30분" 같은 계산을 할 때 쓴다.
import type { PhaseId } from "../protocol";
import { enterClaim, resolveClaimTurn } from "./claim";
import { phaseDurationOf } from "./discussion";
import { enterEnded, routeAfterExecution, routeAfterMorning } from "./endgame";
import { enterCandidateVoteReveal, enterExecution, routeAfterCandidateVote } from "./execution";
import { enterMorning, enterNight } from "./night";
import { PHASE_DEFS } from "./phases";
import type { RoomState } from "./room";
import { enterExecVote, resolveExecVote } from "./vote";

/** 낮 시작 발표 진입: 일차 +1. 메시지는 서버에 없고(결정 0017-7) 연장은 없다(결정 0017-5). nextMessageSeq 는 건드리지 않는다. */
export function enterDayAnnounce(state: RoomState): RoomState {
  return { ...state, day: (state.day ?? 0) + 1 };
}

/** [0, n) 정수를 돌려주는 난수 함수. roles.ts 의 randInt 와 같은 계약이다. */
export type RandInt = (n: number) => number;

/** 기본값: 난수가 필요한 진입을 난수 없이 부르면 조용히 틀리지 않고 바로 오류를 던진다. */
const NO_RANDOM: RandInt = () => {
  throw new Error("tick: randInt is required for this phase transition");
};

/** 마감 훅의 반환. stay 면 같은 단계에 머물고, next 가 있으면 표의 기본 다음 단계 대신 그 단계로 간다. */
export type DeadlineResult = { state: RoomState; stay: boolean; next?: PhaseId };

/** 진입 훅. at 은 진입 시각(= 이전 마감)이다. 인자를 쓰지 않는 훅은 앞의 둘만 받아도 타입이 맞는다. */
const ON_ENTER: Partial<Record<PhaseId, (s: RoomState, randInt: RandInt, at: number) => RoomState>> = {
  dayAnnounce: enterDayAnnounce,
  claim: enterClaim,
  execVote: enterExecVote,
  candidateVoteReveal: enterCandidateVoteReveal,
  execution: enterExecution,
  night: enterNight,
  morning: enterMorning,
  ended: enterEnded,
};

/** 마감 훅. stay 면 같은 단계에 머문다(claim 의 다음 차례). 상태만 바꾸고 시각은 tick 이 정한다. */
const ON_DEADLINE: Partial<Record<PhaseId, (s: RoomState) => DeadlineResult>> = {
  claim: resolveClaimTurn,
  execVote: resolveExecVote,
  candidateVoteReveal: routeAfterCandidateVote,
  execution: routeAfterExecution,
  morning: routeAfterMorning,
};

/**
 * 마감이 지난 단계를 다음 단계로 넘긴다. 새 마감은 now 가 아니라 "이전 마감 + 다음 단계 길이" 로 연쇄 계산해,
 * 알람이 늦게 와도 마감이 밀리지 않고 모든 폰이 같은 마감 시각을 받는다(GAME-01).
 * 늦게 불리면 여러 단계를 한 번에 따라잡는다. 바뀐 게 없으면 입력 객체를 그대로 돌려준다.
 */
export function tick(state: RoomState, now: number, randInt: RandInt = NO_RANDOM): RoomState {
  let current = state;
  while (current.phaseEndsAt !== null && now >= current.phaseEndsAt) {
    const deadline = current.phaseEndsAt;
    const onDeadline = ON_DEADLINE[current.phase];
    let closing = current;
    let branch: PhaseId | undefined;
    if (onDeadline !== undefined) {
      const resolved = onDeadline(current);
      const turnMs = PHASE_DEFS[current.phase].durationMs;
      if (resolved.stay && turnMs !== null) {
        current = { ...resolved.state, phaseEndsAt: deadline + turnMs };
        continue;
      }
      closing = resolved.state;
      branch = resolved.next;
    }
    const next = branch ?? PHASE_DEFS[closing.phase].next;
    if (next === null) break;
    const duration = PHASE_DEFS[next].durationMs;
    const entered: RoomState = {
      ...closing,
      phase: next,
      phaseEndsAt: duration === null ? null : deadline + duration,
    };
    const hook = ON_ENTER[next];
    const hooked = hook ? hook(entered, randInt, deadline) : entered;
    // 진입 훅이 만든 상태(공개 단계의 표)로 길이를 구해 마감을 다시 정한다. 훅 입력의 임시 마감은 표 값이다.
    const length = phaseDurationOf(hooked);
    current = { ...hooked, phaseEndsAt: length === null ? null : deadline + length };
  }
  return current;
}

/** DO 알람 하나로 단계 마감과 방 만료를 함께 다룬다. */
export function nextWakeAt(state: RoomState): number {
  return Math.min(state.phaseEndsAt ?? Number.POSITIVE_INFINITY, state.expiresAt);
}
