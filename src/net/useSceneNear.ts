// 아침 현장 화면이 읽는 내 위치 표본(21-13, D-13). useErrandPos 와 같은 방식 — 위치의 진실은 서버 구간이고 이 훅은 월드 사본(store)에서 200ms 간격과 구독으로 표본한다.
// 위치 자체는 상태가 아니다 — 처리 가능 지점(act)과 가장 가까운 안 살핀 지점(next)이 바뀔 때만 상태를 바꾼다. 역할·좌석 값은 읽지 않는다(내 좌석 번호로 내 구간만 본다).
// 서버가 살피기 여부를 다시 정한다(못 살피는 이유는 응답이 같다) — 이 값은 [살펴보기] 의 모양(활성·빛남)을 정할 뿐이다.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClueSpotId } from "../../shared/protocol";
import { sceneNearOf } from "../game/causalView";
import { ERRAND_POS_SAMPLE_MS } from "./useErrandPos";
import type { PosStore } from "./useErrandPos";

export interface SceneNear {
  /** 처리 반경 안 안 살핀 지점(없으면 null) */
  act: ClueSpotId | null;
  /** 가장 가까운 안 살핀 지점(없으면 null) */
  next: ClueSpotId | null;
  /** 마지막 표본의 내 월드 위치(상태 아님) */
  pos(): { x: number; z: number } | null;
}

export function useSceneNear(
  store: PosStore,
  mySeat: number,
  serverNow: () => number,
  house: number | undefined,
  inspected: readonly ClueSpotId[],
  enabled: boolean,
): SceneNear {
  const posRef = useRef<{ x: number; z: number } | null>(null);
  const nowRef = useRef(serverNow);
  nowRef.current = serverNow;
  const [ids, setIds] = useState<{ act: ClueSpotId | null; next: ClueSpotId | null }>({ act: null, next: null });
  const doneKey = inspected.join("|");
  const inputRef = useRef({ house, inspected });
  inputRef.current = { house, inspected };

  const sample = useCallback((): void => {
    const pos = store.positionOf(mySeat, nowRef.current());
    posRef.current = pos;
    const { act, next } = sceneNearOf(pos, inputRef.current.house, inputRef.current.inspected);
    setIds((prev) => (prev.act === act && prev.next === next ? prev : { act, next }));
  }, [store, mySeat]);

  useEffect(() => {
    if (!enabled) {
      posRef.current = null;
      setIds((prev) => (prev.act === null && prev.next === null ? prev : { act: null, next: null }));
      return;
    }
    sample();
    const off = store.subscribe(sample);
    const timer = setInterval(sample, ERRAND_POS_SAMPLE_MS);
    return () => {
      off();
      clearInterval(timer);
    };
  }, [enabled, sample, store, house, doneKey]);

  return { act: ids.act, next: ids.next, pos: () => posRef.current };
}
