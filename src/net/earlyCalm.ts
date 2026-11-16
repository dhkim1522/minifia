import { useState } from "react";
import type { RoomView } from "../../shared/protocol";

// 조기 진행 감지(23-11, P23-23·24, D-11). 전원이 끝내 서버가 마감을 줄이면 view.phaseEndsAt 만 작아지고 phaseDurationMs 는 그대로다.
// 같은 단계(판·일차·단계·연결) 안에서 마감이 작아진 것을 한 번이라도 보았으면 그 단계 동안 true — 막대·초·머리 링 색을 calm 으로 고정한다
// (알람색은 "시간이 없다"는 뜻이라 좋은 소식에 쓰면 안 된다). 번복으로 마감이 다시 늘어도 그 단계 동안 true 가 유지된다.
// 단계·일차·판·연결이 바뀌면 풀린다. 처음 본 프레임(재접속·새로고침의 첫 프레임)에는 켜지지 않는다.
// 읽는 값은 모두에게 같은 공개 값(phase·day.n·round·phaseEndsAt)뿐이다 — 역할 조건 없음(T-23-42).

export interface EarlyCalmMemo {
  /** 판·일차·단계·연결을 묶은 키. 바뀌면 기억을 새로 시작한다 */
  key: string;
  /** 직전에 본 마감(서버 시각). 마감이 없는 프레임은 값을 건드리지 않는다 */
  endsAt: number | null;
  early: boolean;
}

function keyOf(view: RoomView, epoch: number): string {
  return `${epoch}:${view.round ?? 1}:${view.day?.n ?? 0}:${view.phase}`;
}

/** 순수 판정: 직전 기억과 지금 view 로 다음 기억을 만든다 */
export function earlyCalmNext(prev: EarlyCalmMemo | null, view: RoomView, epoch = 0): EarlyCalmMemo {
  const key = keyOf(view, epoch);
  const endsAt = view.phaseEndsAt;
  if (prev === null || prev.key !== key) return { key, endsAt, early: false };
  if (endsAt === null) return prev;
  const shortened = prev.endsAt !== null && endsAt < prev.endsAt;
  if (!shortened && endsAt === prev.endsAt) return prev;
  return { key, endsAt, early: prev.early || shortened };
}

/**
 * 이 단계에서 마감이 줄어든 것을 보았는가. 렌더 중 상태 조정이라(usePhaseArrival 과 같은 방식) 효과를 기다리지 않고 바뀐 렌더에서 곧바로 맞는다.
 * 계속 마운트되어 있는 부품(HostBand 등)에서 부른다 — 단계 중간에 새로 마운트되면 그 전의 단축은 보지 못한다.
 */
export function useEarlyCalm(view: RoomView, epoch = 0): boolean {
  const [memo, setMemo] = useState<EarlyCalmMemo>(() => earlyCalmNext(null, view, epoch));
  const next = earlyCalmNext(memo, view, epoch);
  if (next !== memo) setMemo(next);
  return next.early;
}
