import { useEffect, useId, useRef, useState } from "react";
import type { ReactElement } from "react";
import { REVEAL_FADE_MS, REVEAL_REDUCED_HOLD_MS, arrowEndpoints, revealStateAt } from "../game/verdict";
import type { RevealPlan } from "../game/verdict";
import type { DayTableLayout } from "./DayTable";

// 후보 선택 공개의 화살표 층 (04-20, D-20·D-32, UI-SPEC 8.3·13.2·13.4). 투표자 몸 중심에서 대상 쪽으로 자라며 나가는 앰버 직선 + 삼각 머리 하나.
// 화살표는 동시에 최대 하나다(쌓지 않는다). 그림 에셋이 아니라 SVG 코드다(D-22). 색은 토큰 변수만 쓰고 진홍은 쓰지 않는다(D-33).
// 선이 자라는 동안 머리가 끝을 따라가야 하므로 CSS dash 가 아니라 requestAnimationFrame 한 줄기로 끝점(x2, y2)을 보간한다.
// 시각은 서버 시각이다(serverNow 가 Date.now() + connection.offset 을 준다) — 모든 폰이 같은 모양을 같은 시각에 본다.
// 마지막 화살표가 사라진 뒤에는 프레임 요청을 멈추고, 언마운트하면 예약된 요청을 취소한다(T-04-55).
// 입력은 서버가 모두에게 보낸 공개 투표 줄뿐이고 읽기 전용이다. 좌석을 못 찾으면 그 화살표만 건너뛴다(T-04-56).

export interface RevealLayerProps {
  layout: DayTableLayout;
  plan: RevealPlan;
  /** 서버 시각(ms) */
  serverNow: () => number;
  /** 움직임 줄이기: 자라는 동작 없이 완성된 모습을 잠깐 보였다가 사라진다 */
  reduced: boolean;
}

interface Frame {
  step: number;
  voter: number;
  target: number;
  /** 끝점 보간 비율(이징이 이미 입혀진 값, 0~1) */
  progress: number;
  opacity: number;
}

const easeOutCubic = (p: number): number => 1 - (1 - p) ** 3;

/** 서버 시각 now 의 화살표 프레임. 없으면 null. */
function frameAt(plan: RevealPlan, now: number, reduced: boolean): Frame | null {
  const arrow = revealStateAt(plan, now).arrow;
  if (arrow === null) return null;
  if (!reduced) {
    return { step: arrow.step, voter: arrow.voter, target: arrow.target, progress: easeOutCubic(arrow.progress), opacity: arrow.opacity };
  }
  const elapsed = now - plan.steps[arrow.step].startMs;
  if (elapsed >= REVEAL_REDUCED_HOLD_MS + REVEAL_FADE_MS) return null;
  return {
    step: arrow.step,
    voter: arrow.voter,
    target: arrow.target,
    progress: 1,
    opacity: elapsed < REVEAL_REDUCED_HOLD_MS ? 1 : 1 - (elapsed - REVEAL_REDUCED_HOLD_MS) / REVEAL_FADE_MS,
  };
}

export function RevealLayer({ layout, plan, serverNow, reduced }: RevealLayerProps): ReactElement | null {
  const markerId = `mf-varrow-head-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const [frame, setFrame] = useState<Frame | null>(null);
  // 프레임 반복은 plan·reduced 가 바뀔 때만 다시 시작한다. 장면 크기·시계 함수는 최신 값을 ref 로 읽는다.
  const nowRef = useRef(serverNow);
  nowRef.current = serverNow;

  useEffect(() => {
    const last = plan.steps[plan.steps.length - 1];
    if (last === undefined) {
      setFrame(null);
      return;
    }
    let raf = 0;
    let stopped = false;
    const tick = (): void => {
      if (stopped) return;
      const now = nowRef.current();
      setFrame(frameAt(plan, now, reduced));
      // 마지막 화살표가 사라진 뒤에는 더 요청하지 않는다
      if (now >= last.fadeEndMs) return;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [plan, reduced]);

  if (frame === null) return null;
  const place = (seat: number) => {
    const p = layout.places.find((x) => x.seat === seat);
    return p === undefined ? null : { x: p.x, y: p.y, scale: p.scale };
  };
  const from = place(frame.voter);
  const to = place(frame.target);
  if (from === null || to === null) return null;
  const { start, end } = arrowEndpoints(from, to);
  const x2 = start.x + (end.x - start.x) * frame.progress;
  const y2 = start.y + (end.y - start.y) * frame.progress;
  return (
    <svg className="mf-varrow" aria-hidden="true" focusable="false" data-step={frame.step} style={{ opacity: frame.opacity }}>
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0L10 5L0 10z" fill="var(--amber-400)" />
        </marker>
      </defs>
      <line x1={start.x} y1={start.y} x2={x2} y2={y2} stroke="var(--night-950)" strokeOpacity={0.55} strokeWidth={9} strokeLinecap="round" />
      <line
        className="mf-varrow__line"
        x1={start.x}
        y1={start.y}
        x2={x2}
        y2={y2}
        stroke="var(--amber-400)"
        strokeWidth={5}
        strokeLinecap="round"
        markerEnd={`url(#${markerId})`}
      />
    </svg>
  );
}
