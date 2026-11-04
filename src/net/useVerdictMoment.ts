import { useEffect, useRef, useState } from "react";
import type { RoomView } from "../../shared/protocol";
import type { BallotStage } from "../components/v2/BallotReveal";
import { BALLOT_END_AT, BALLOT_NO_AT, BALLOT_YES_AT, executionStartOf, momentAt, VERDICT_ZOOM } from "../game/verdictMoment";

// 판결 순간 시계(UI-SPEC C-1, 결정 0066-7): 처형 단계 진입 시각 T = phaseEndsAt − EXECUTION_MS 를 서버 시각으로 재서
// 경계(0.6초 찬성 · 1.0초 반대 · 4.6초 끝)마다 다시 그린다. 시계는 Date.now()+offset 과 setTimeout 뿐이고(useDayFx 와 같은 방식),
// 입력은 공개 값(단계·마감 시각·day.ballots·day.verdict)뿐이라 어느 소켓에서도 같은 값이다 — 역할을 읽지 않는다(L22, T-09.1.1-36).

export interface VerdictMomentState {
  /** 이 view 가 판결 순간(처형 단계 + 찬반 기록, 마지막 3인 처형 제외)이다 */
  active: boolean;
  /** 찬반 묶음 단계: none 아직 · yes 찬성까지 · both 반대까지 · gone 사라짐 */
  stage: BallotStage | "gone";
  /** 어둡게 막이 켜져 있다 */
  darken: boolean;
  /** 카메라 목표 배율: 진행 중 VERDICT_ZOOM, 끝난 뒤 1 (이동은 런타임이 0.6초 ease-in-out 으로 한다) */
  zoom: number;
  /** 이 마운트의 첫 그림이 이미 0.6~4.6초가 지난 때(재접속·새로 고침)라 애니메이션 없이 보인다 */
  instant: boolean;
}

const OFF: VerdictMomentState = { active: false, stage: "none", darken: false, zoom: 1, instant: false };
const BOUNDS = [BALLOT_YES_AT, BALLOT_NO_AT, BALLOT_END_AT] as const;

export function useVerdictMoment(view: RoomView, offset: number): VerdictMomentState {
  const verdict = view.day?.verdict;
  const start = view.phase === "execution" && view.day?.ballots !== undefined && verdict !== undefined && verdict.last !== true ? executionStartOf(view) : null;
  const passed = verdict?.passed === true;
  const [, setTick] = useState(0);
  // 이 진입(start)의 첫 경과 — 마운트·재접속 시점이 이미 묶음 구간이면 애니메이션 없이 보인다
  const first = useRef<{ start: number; elapsed: number } | null>(null);
  if (start !== null && first.current?.start !== start) first.current = { start, elapsed: Date.now() + offset - start };

  useEffect(() => {
    if (start === null) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      const e = Date.now() + offset - start;
      const next = BOUNDS.find((b) => b > e);
      if (next === undefined) return;
      timer = setTimeout(() => {
        setTick((n) => n + 1);
        arm(); // 일찍 깨어났어도 같은 경계를 다시 건다
      }, next - e);
    };
    arm();
    return () => clearTimeout(timer);
  }, [start, offset]);

  if (start === null) return OFF;
  const elapsed = Date.now() + offset - start;
  const m = momentAt(elapsed, passed);
  const joined = first.current?.elapsed ?? 0;
  return {
    active: true,
    stage: m.end ? "gone" : m.no ? "both" : m.yes ? "yes" : "none",
    darken: m.darken,
    zoom: m.end ? 1 : VERDICT_ZOOM,
    instant: joined >= BALLOT_YES_AT && joined < BALLOT_END_AT,
  };
}
