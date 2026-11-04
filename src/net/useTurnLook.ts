// 차례 시계 훅(결정 0063-1, UI-SPEC A-3): 알약·막대·헤더 링이 같은 초 경계에서 같이 바뀌게 한다.
// 250ms 간격 타이머 대신 "남은 초가 바뀌는 순간"에 맞춰 setTimeout 하나를 건다. 확정·모이기·끝에는 타이머가 없다.
import { useEffect, useState } from "react";
import type { RoomView } from "../../shared/protocol";
import { blockLook, type BlockLook } from "../game/pickTurn";

/** 지금 보이는 올림 초가 다음에 바뀔 때까지 남은 ms(1~1000). 차례 중이 아니거나 마감이 지났으면 null */
export function msToNextSecond(look: BlockLook | null): number | null {
  if (look === null || look.stage !== "turn" || look.remainingMs <= 0) return null;
  return look.remainingMs - (look.seconds - 1) * 1000;
}

/** offset = 서버시각 − 로컬시각(ms). 지목(day.turn)도 결선(day.runoff)도 아니면 null */
export function useTurnLook(view: RoomView, offset: number): BlockLook | null {
  const [tick, setTick] = useState(0);
  const look = blockLook(view, Date.now() + offset);
  const delay = msToNextSecond(look);
  const seconds = look?.seconds;

  useEffect(() => {
    if (delay === null) return;
    const id = setTimeout(() => setTick((t) => t + 1), delay);
    return () => clearTimeout(id);
    // tick: 타이머가 경계보다 일찍 울려 값이 그대로여도 다시 걸리게 한다
  }, [delay, seconds, tick]);

  useEffect(() => {
    const onVisible = () => setTick((t) => t + 1);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return look;
}
