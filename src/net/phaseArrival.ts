import { useState } from "react";
import type { PhaseId } from "../../shared/protocol";

interface Arrival {
  phase: PhaseId | undefined;
  epoch: number;
  from: PhaseId | null;
}

/**
 * 같은 접속(epoch)에서 단계가 바뀐 뒤에는 직전 단계를, 처음 렌더와 epoch 가 함께(또는 홀로) 바뀐 렌더에서는 null 을 돌려준다.
 * 값은 다음 변화 전까지 유지된다. 역할 확인 → 낮 시작처럼 장면 화면이 새로 마운트될 때 '방금 단계가 바뀌어 왔다' 는 근거다
 * (마운트 직후엔 화면이 자기 이전 단계를 모르므로). 재접속은 첫 state 가 epoch 를 올리므로 어느 쪽에서도 null 이다.
 * 렌더 중 상태 조정이라 효과를 기다리지 않고 바뀐 렌더에서 곧바로 맞는다.
 */
export function usePhaseArrival(phase: PhaseId | undefined, epoch: number): PhaseId | null {
  const [s, setS] = useState<Arrival>({ phase, epoch, from: null });
  if (s.phase !== phase || s.epoch !== epoch) {
    const from = s.epoch === epoch && s.phase !== undefined && phase !== undefined ? s.phase : null;
    setS({ phase, epoch, from });
    return from;
  }
  return s.from;
}
