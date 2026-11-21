import { phaseDurationOf } from "./discussion";
import { keywordPresentationOf } from "./keywordPresentation";
import { turnStartOf } from "./nomination";
import { WILL_REVEAL_MS } from "./phases";
import { humanSeats } from "./playtest";
import type { RoomState } from "./room";

const SKIP_DELAY_MS = 3_000;
const MIN_SKIP_WINDOW_MS = 800;

function phaseSkipDelay(state: RoomState): number | undefined {
  switch (state.phase) {
    case "dayAnnounce":
      return keywordPresentationOf(state) === undefined ? undefined : SKIP_DELAY_MS;
    case "runoff":
      return state.runoff?.step === 1 ? SKIP_DELAY_MS : undefined;
    case "showdown": {
      const turn = state.showdown;
      return turn !== undefined && turn.i >= 0 && turn.i <= 3 && turn.doneAt === undefined ? SKIP_DELAY_MS : undefined;
    }
    case "morning": {
      const victim = state.players.find((player) => player.seat === state.morning?.eliminated);
      // 조사 결과 뒤에 시작하는 아침 발표(2.6초)와, 유언이 있을 때의 편지 접힘(2.6 + 5.42초)을 보호한다.
      return victim?.will ? 8_100 : 4_600;
    }
    case "execution":
      return WILL_REVEAL_MS + 2_000;
    case "roleReveal":
    case "keyword":
    case "discussion":
    case "verdict":
    case "defense":
    case "night":
      return SKIP_DELAY_MS;
    default:
      return undefined;
  }
}

/** 단계·차례 시작이나 필수 발표 뒤 얼마간 읽을 시간과 실제로 누를 여유를 보장한다. */
export function phaseSkipOpensAt(state: RoomState): number | undefined {
  const { phase, phaseEndsAt, earlyFrom } = state;
  if (phaseEndsAt === null) return undefined;
  if (phase === "nomination") {
    const startsAt = turnStartOf(state);
    return startsAt === undefined ? undefined : startsAt + SKIP_DELAY_MS;
  }
  const delay = phaseSkipDelay(state);
  const duration = phaseDurationOf(state);
  if (delay === undefined || duration === null || duration - delay < MIN_SKIP_WINDOW_MS) return undefined;
  // 이전 버전에서 투표의 원래 마감이 첫날 집계 상태에 남았을 수 있다.
  const resultShowing = phase === "verdict" && state.firstBallotOutcome !== undefined;
  const matchingEarly = !resultShowing && earlyFrom?.phase === phase && earlyFrom.day === (state.day ?? 0);
  const originalEnd = matchingEarly ? earlyFrom.endsAt : phaseEndsAt;
  const opensAt = (state.phaseStartsAt ?? originalEnd - duration) + delay;
  return opensAt < phaseEndsAt ? opensAt : undefined;
}

/** 접속이 끊겨도 동의권을 유지한다. 봇과 탈락자는 동의 인원에서 제외한다. */
export function phaseSkipStatus(state: RoomState, actorId: string) {
  const voters = humanSeats(state);
  const marked = state.phaseSkipVotes ?? [];
  const canVote = voters.some((player) => player.id === actorId);
  return {
    count: voters.filter((player) => marked.includes(player.id)).length,
    total: voters.length,
    canVote,
    pressed: canVote && marked.includes(actorId),
  };
}

/** 매 차례 식별자를 확인해 늦게 도착한 입력이 새 창에 반영되는 것을 막는다. */
export function votePhaseSkip(state: RoomState, actorId: string, opensAt: number, on: boolean, now: number):
  | { ok: true; state: RoomState; unanimous: boolean }
  | { ok: false; error: "WRONG_PHASE" | "BAD_MESSAGE" } {
  if (phaseSkipOpensAt(state) !== opensAt || now < opensAt || state.phaseEndsAt === null || now >= state.phaseEndsAt) {
    return { ok: false, error: "WRONG_PHASE" };
  }
  const { count, total, canVote, pressed } = phaseSkipStatus(state, actorId);
  if (!canVote) return { ok: false, error: "BAD_MESSAGE" };
  if (on === pressed) return { ok: true, state, unanimous: false };
  const current = state.phaseSkipVotes ?? [];
  const phaseSkipVotes = on ? [...current, actorId] : current.filter((id) => id !== actorId);
  return { ok: true, state: { ...state, phaseSkipVotes }, unanimous: on && count + 1 === total };
}
