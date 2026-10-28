// 후보 선택 공개(candidateVoteReveal) 상태 훅 (04-19, VOTE-02). 공개 시간표(revealPlan)와 한 시각의 상태(revealStateAt)는 game/verdict.ts 의
// 순수 함수고, 이 훅은 그것을 서버 시각에 적용한다. 서버 시각 = Date.now() + connection.offset 이므로 모든 폰이 같은 순서·같은 시각에 같은 칩 수를 본다.
// votes 는 서버가 셔플해 보낸 view.day.voteLog 의 그날 cand.votes 배열이고, 여기서 다시 정렬·섞지 않는다(T-04-53).
// 다시 그리는 때는 시간표의 경계 시각(화살표 시작·닿음·사라짐 끝·마지막 슬롯 끝·확정 두근 끝)뿐이다 — 이 훅에 애니메이션 프레임 갱신은 없다(화살표 이동은 RevealLayer 가 따로 프레임으로 한다, 04-20).
// 중간 합류는 지금 시각의 상태로 시작하고 지난 경계는 건너뛴다. 단계를 벗어나거나 언마운트되면 타이머를 정리한다(T-04-54).
import { useEffect, useMemo, useState } from "react";
import type { CandidateVoteLine, RoomView } from "../../shared/protocol";
import { CLINCH_BEAT_MS, REVEAL_FADE_MS, revealCaption, revealPlan, revealStateAt } from "../game/verdict";
import type { RevealPlan, RevealState } from "../game/verdict";

export interface RevealView {
  plan: RevealPlan;
  state: RevealState;
  /** 화살표 사이 틈·첫 화살표 전에는 null(화면은 기본 제목을 쓴다) */
  caption: { title: string; hint: string } | null;
}

const NO_VOTES: readonly CandidateVoteLine[] = [];

/** 서버 시각(ms). 서버 시각 = 로컬 시각 + offset. 시험은 vi.setSystemTime 으로 이 값을 정한다. */
function serverNow(offset: number): number {
  return Date.now() + offset;
}

/** 지금(서버 시각) 이후 가장 이른 경계 시각. 더 없으면 null. */
export function nextBoundary(plan: RevealPlan, now: number): number | null {
  let next: number | null = null;
  const consider = (t: number): void => {
    if (t > now && (next === null || t < next)) next = t;
  };
  for (const s of plan.steps) {
    consider(s.startMs);
    consider(s.touchMs);
    consider(s.touchMs + REVEAL_FADE_MS);
  }
  consider(plan.endMs);
  // 확정 두근(CLINCH_BEAT_MS)이 끝나 느린 박동으로 넘어가는 시각(04-20). 확정 뒤 같은 후보에게 닿는 표마다 두근을 다시 돌므로 그 닿음 + CLINCH_BEAT_MS 도 경계다.
  if (plan.clinch !== null) {
    consider(plan.clinch.atMs + CLINCH_BEAT_MS);
    for (const s of plan.steps) if (s.index > plan.clinch.step && s.target === plan.clinch.seat) consider(s.touchMs + CLINCH_BEAT_MS);
  }
  return next;
}

/** 그날 공개 투표 줄. 일차가 맞는 줄의 cand.votes, 없으면 빈 배열 */
function votesOf(view: RoomView): readonly CandidateVoteLine[] {
  const n = view.day?.n;
  if (n === undefined) return NO_VOTES;
  return view.day?.voteLog?.find((entry) => entry.n === n)?.cand?.votes ?? NO_VOTES;
}

export function useRevealState(view: RoomView, offset: number): RevealView | null {
  const [tick, setTick] = useState(0);
  const active = view.phase === "candidateVoteReveal";
  const { phaseEndsAt, phaseDurationMs } = view;
  const startMs = active && phaseEndsAt !== null && phaseDurationMs !== null ? phaseEndsAt - phaseDurationMs : null;
  const votes = active ? votesOf(view) : NO_VOTES;
  // 안정 키: 시작 시각 + `seat>target` 줄. 같은 votes·같은 시작이면 view 객체가 바뀌어도 plan 이 새로 만들어지지 않는다.
  const planKey = startMs === null ? null : `${startMs}|${votes.map((v) => `${v.seat}>${v.target}`).join(",")}`;
  const plan = useMemo(
    () => (planKey === null || startMs === null ? null : revealPlan(votes, startMs)),
    // votes 는 planKey 에 담겨 있다(내용이 같으면 다시 만들지 않는다)
    [planKey],
  );

  // 다음 경계 시각까지만 기다리는 타이머 하나. tick 이 바뀌면(경계에서 다시 그렸으면) 다음 경계를 다시 잡는다.
  useEffect(() => {
    if (plan === null) return;
    const next = nextBoundary(plan, serverNow(offset));
    if (next === null) return;
    const id = setTimeout(() => setTick((t) => t + 1), Math.max(0, next - serverNow(offset)));
    return () => clearTimeout(id);
  }, [plan, offset, tick]);

  if (plan === null) return null;
  const state = revealStateAt(plan, serverNow(offset));
  const nicknameOf = (seat: number): string | undefined => view.players.find((p) => p.seat === seat)?.nickname;
  return { plan, state, caption: revealCaption(plan, state, nicknameOf) };
}
