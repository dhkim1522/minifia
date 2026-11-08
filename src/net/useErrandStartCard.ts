// 심부름 시작 카드("오늘 갈 곳", 16-08, V-19)를 지금 보일지 정한다.
// 보이는 조건은 startCardOn(서버 시계 기준 단계 시작 + 2초 안)이고 이번 단계에서 아직 닫지 않았을 때다. 2초가 지나면 스스로 사라진다(타이머로 한 번 다시 그린다).
// 닫기: 카드가 떠 있는 동안만 방 루트에 캡처 단계 pointerdown 리스너를 단다 — 첫 누름에 닫고 그 누름은 막지 않는다(전파·기본 동작을 건드리지 않아
// 같은 누름이 바닥 걷기로 그대로 간다, Pitfall 5). 2초 뒤·닫힘·언마운트 때 리스너와 타이머를 푼다.
// 카드는 보여 주기만 하는 안내다 — 이 훅은 서버 값도 역할도 읽지 않는다(me.errand 목록과 단계 시각뿐).
import { useEffect, useState } from "react";
import type { RefObject } from "react";
import type { RoomView } from "../../shared/protocol";
import { ERRAND_CARD_MS, startCardOn } from "../game/errandView";
import { ERRAND_MS } from "../../shared/game/phases";

export function useErrandStartCard(view: RoomView, offset: number, rootRef: RefObject<HTMLElement | null>): boolean {
  const [, setTick] = useState(0);
  // 닫은 단계(phaseEndsAt 로 구분). 다음 판의 심부름은 끝 시각이 달라 다시 뜬다
  const [closedFor, setClosedFor] = useState<number | null>(null);
  const endsAt = view.phaseEndsAt;
  const on = startCardOn(view, Date.now() + offset) && closedFor !== endsAt;
  useEffect(() => {
    if (!on || endsAt === null) return;
    const root = rootRef.current;
    const left = endsAt - ERRAND_MS + ERRAND_CARD_MS - (Date.now() + offset);
    const timer = setTimeout(() => setTick((n) => n + 1), Math.max(0, left));
    const close = (): void => setClosedFor(endsAt);
    root?.addEventListener("pointerdown", close, { capture: true, once: true });
    return () => {
      clearTimeout(timer);
      root?.removeEventListener("pointerdown", close, true);
    };
  }, [on, endsAt, offset, rootRef]);
  return on;
}
