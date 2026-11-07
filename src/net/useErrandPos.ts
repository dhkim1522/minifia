// 심부름 화면이 읽는 내 위치 표본(15-05, D-01·D-09). 위치의 진실은 서버 구간이고 이 훅은 월드 사본(store)에서 200ms 간격과 구독으로 표본한다.
// 위치 자체는 상태가 아니다(매 표본 다시 그리지 않는다) — 처리 가능 장소(actableId)와 다음 장소(nextId)가 바뀔 때만 상태를 바꾼다.
// 역할·좌석 값은 읽지 않는다(내 좌석 번호로 내 구간만 본다). 서버가 처리 여부를 다시 정한다(T-15-18).
import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaceId } from "../../shared/protocol";
import { actablePlaceOf, nextPlaceOf } from "../game/errandView";
import type { PlaceCenter } from "../game/errandView";

/** 표본 간격(ms) */
export const ERRAND_POS_SAMPLE_MS = 200;

/** WorldStore 중 이 훅이 읽는 부분 */
export interface PosStore {
  positionOf(seat: number, serverNow: number): { x: number; z: number } | null;
  subscribe(cb: () => void): () => void;
}

export interface ErrandPos {
  /** 처리 반경 안 미완료 장소(없으면 null) */
  actableId: PlaceId | null;
  /** 내 위치에서 가장 가까운 미완료 장소(위치를 모르면 첫 미완료, 없으면 null) */
  nextId: PlaceId | null;
  /** 마지막 표본의 내 월드 위치(상태 아님 — 읽을 때만 쓴다) */
  pos(): { x: number; z: number } | null;
}

export function useErrandPos(
  store: PosStore,
  mySeat: number,
  serverNow: () => number,
  centers: ReadonlyArray<PlaceCenter>,
  done: readonly PlaceId[],
  enabled: boolean,
): ErrandPos {
  const posRef = useRef<{ x: number; z: number } | null>(null);
  const nowRef = useRef(serverNow);
  nowRef.current = serverNow;
  const [ids, setIds] = useState<{ actableId: PlaceId | null; nextId: PlaceId | null }>({ actableId: null, nextId: null });
  // 같은 내용이면 같은 참조를 쓰는 키(목록·진행 배열이 렌더마다 새로 만들어져도 표본 효과를 다시 걸지 않는다)
  const centersKey = centers.map((c) => `${c.id}:${c.x}:${c.z}`).join("|");
  const doneKey = done.join("|");
  const centersRef = useRef(centers);
  centersRef.current = centers;
  const doneRef = useRef(done);
  doneRef.current = done;

  const sample = useCallback((): void => {
    const pos = store.positionOf(mySeat, nowRef.current());
    posRef.current = pos;
    const actableId = actablePlaceOf(pos, centersRef.current, doneRef.current);
    const nextId = nextPlaceOf(pos, centersRef.current, doneRef.current);
    setIds((prev) => (prev.actableId === actableId && prev.nextId === nextId ? prev : { actableId, nextId }));
  }, [store, mySeat]);

  useEffect(() => {
    if (!enabled) {
      posRef.current = null;
      setIds((prev) => (prev.actableId === null && prev.nextId === null ? prev : { actableId: null, nextId: null }));
      return;
    }
    sample();
    const off = store.subscribe(sample);
    const timer = setInterval(sample, ERRAND_POS_SAMPLE_MS);
    return () => {
      off();
      clearInterval(timer);
    };
  }, [enabled, sample, store, centersKey, doneKey]);

  return { actableId: ids.actableId, nextId: ids.nextId, pos: () => posRef.current };
}
