import { useState } from "react";
import type { RoomView } from "../../shared/protocol";

// 낙관적 선택 훅(04-18): 누른 즉시 화면에 보이되, 새 서버 view 가 오면 서버 값이 이긴다.
// 선택은 "어느 view 를 보고 있을 때 골랐는가" 와 함께 기억한다 — ClaimPanel·밤 선택·여부 투표와 같은 규칙이다.
// 값이 view 객체 동일성에 묶이므로 서버가 행동을 거절해 state 를 다시 보내면(다른 view 객체) 자동으로 서버 값으로 돌아온다.
// 같은 view 객체가 다시 그려지는 동안(타이머 틱 등)에는 고른 값이 유지된다.

/** [지금 보일 값, 고르기]. 고른 적 없거나 view 가 바뀌었으면 serverValue */
export function useViewChoice<T>(view: RoomView, serverValue: T | undefined): readonly [T | undefined, (value: T) => void] {
  const [pending, setPending] = useState<{ view: RoomView; value: T } | null>(null);
  const shown = pending !== null && pending.view === view ? pending.value : serverValue;
  const choose = (value: T): void => setPending({ view, value });
  return [shown, choose] as const;
}
