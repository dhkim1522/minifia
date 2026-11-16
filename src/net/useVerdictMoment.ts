import { useEffect, useRef, useState } from "react";
import { PIN_OFF_EXEC_AT, WILL_REVEAL_MS } from "../../shared/game/phases";
import type { RoomView } from "../../shared/protocol";
import { willCardOf } from "../game/dayView";
import { executionStartOf, momentAt, VERDICT_ZOOM } from "../game/verdictMoment";

// 판결 순간 시계(UI-SPEC C-1, 22-12 P22-13·P22-14): 처형 단계 진입 시각 T = phaseEndsAt − EXECUTION_MS 를 서버 시각으로 재서
// 경계(3.0초 유언 카드 끝 · 6.0초 막·핀 끝)마다 다시 그린다. 시계는 Date.now()+offset 과 setTimeout 뿐이고(useDayFx 와 같은 방식),
// 입력은 공개 값(단계·마감 시각·day.execution{seat, will})뿐이라 어느 소켓에서도 같은 값이다 — 역할을 읽지 않는다(L22, T-09.1.1-36).
// 켜짐 조건은 찬반 기록이 아니라 처형자 존재(day.execution)다. 부결·동점·0표는 처형 단계가 없어 켜질 일이 없다.

export interface WillCardState {
  /** 카드 글: 처형자의 유언 또는 "말없이 떠났어요"(빈 유언) */
  text: string;
  /** 처형 단계 0~3.0초 동안 참 */
  visible: boolean;
  /** 이 마운트의 첫 그림이 이미 시작 뒤(재접속·새로 고침)라 등장 모션 없이 바로 보인다 */
  still: boolean;
}

export interface VerdictMomentState {
  /** 이 view 가 판결 순간(처형 단계 + 처형자 존재)이다 */
  active: boolean;
  /** 어둡게 막이 켜져 있다 */
  darken: boolean;
  /** 카메라 목표 배율: 진행 중 VERDICT_ZOOM, 끝난 뒤 1 (이동은 런타임이 0.6초 ease-in-out 으로 한다) */
  zoom: number;
  /** 유언 공개 카드(처형 단계 동안 마운트, 0~3.0초만 visible). 처형 단계가 아니면 null */
  will: WillCardState | null;
}

const OFF: VerdictMomentState = { active: false, darken: false, zoom: 1, will: null };
const BOUNDS = [WILL_REVEAL_MS, PIN_OFF_EXEC_AT] as const;
/** 첫 그림이 진입 뒤 이만큼 지났으면 재접속으로 보고 등장 모션을 줄인다(보통의 도착 지연은 이보다 짧다) */
const LATE_JOIN_MS = 600;

export function useVerdictMoment(view: RoomView, offset: number): VerdictMomentState {
  const card = view.phase === "execution" ? willCardOf(view) : null;
  const start = card !== null ? executionStartOf(view) : null;
  const [, setTick] = useState(0);
  // 이 진입(start)의 첫 경과 — 마운트·재접속 시점이 이미 진행 중이면 카드는 모션 없이 보인다
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

  if (start === null || card === null) return OFF;
  const elapsed = Date.now() + offset - start;
  const m = momentAt(elapsed);
  const joined = first.current?.elapsed ?? 0;
  return {
    active: true,
    darken: m.darken,
    zoom: elapsed >= PIN_OFF_EXEC_AT ? 1 : VERDICT_ZOOM,
    will: { text: card.text, visible: elapsed < WILL_REVEAL_MS, still: joined >= LATE_JOIN_MS && joined < PIN_OFF_EXEC_AT },
  };
}
