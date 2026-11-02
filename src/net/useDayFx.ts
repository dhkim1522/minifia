// 서버 view 두 개의 공개 정보 차이(dayEvents)를 화면 연출로 적용하는 훅 (08-13, DAY-04·05·06).
// - 채팅 시스템 줄: chat.addSystem(text, { scope: "all", kind }) — 지연(at)이 있는 줄은 타이머로 나중에 더한다.
// - 결과 알림: 한 번에 하나, 새 알림이 이전 것을 바꾼다. 지연(at) 뒤에 뜨고 ms 뒤에 사라진다. 상태 `announce` 로 돌려준다.
// - 지목 위 알림(08-15): dayEvents 의 toasts 를 ToastQueue(400ms 합치기·대기 4건 상한·대기 2건 이상이면 0.8초)에 세우고, 알림이 끝날 때마다 다음을 꺼낸다. 상태 `toast` 로 돌려준다.
// - 손사래(08-15): 지목 선두가 새 사람으로 바뀌면(leaderShift) `deny` {seat, nonce} 를 갱신한다. WorldStage 가 nonce 가 바뀔 때만 한 번 손사래를 한다.
// 재접속·새로 고침으로 들어온 첫 스냅샷(직전 view 없음)과 연결 번호(epoch)가 바뀐 첫 스냅샷은 이펙트 없이 정상 상태로 둔다(6페이즈 첫 스냅샷 규칙).
// 방 화면(RoomScreen)이 이 훅을 쥔다: 낮 시작은 맵이 아닌 화면(역할 확인·밤)에서 들어오므로 맵 화면이 새로 마운트되는 순간 직전 view 를 맵 화면이 알 수 없다.
// 시계는 Date.now()/setTimeout 뿐이고 서버 단계 시간을 넘기지 않는다(표시 시간표는 dayView.ts).
import { useEffect, useRef, useState } from "react";
import type { RoomView } from "../../shared/protocol";
import { dayEvents, TOAST_MERGE_MS, ToastQueue } from "../game/dayView";
import type { ToastShow } from "../game/dayView";
import { leaderShift } from "../world/presence";
import type { ChatStore } from "./chatStore";

/** 위 알림 한 건. id 는 새 알림마다 늘어나 화면이 "새 알림이 왔다" 를 알아본다 */
export interface PointToastShow extends ToastShow {
  id: number;
}

export interface DayFx {
  /** 지금 띄울 결과 알림 글자. 없으면 null */
  announce: string | null;
  /** 지목 위 알림(가장 최근 것). 없으면 null. 화면은 id 가 바뀔 때만 TopToast 에 띄운다 */
  toast: PointToastShow | null;
  /** 지목 선두가 새 사람으로 바뀌었을 때 손사래를 할 좌석. nonce 가 바뀔 때마다 한 번 */
  deny: { seat: number; nonce: number } | undefined;
}

export function useDayFx({ view, epoch, chat }: { view: RoomView | null; epoch: number; chat: ChatStore }): DayFx {
  const [announce, setAnnounce] = useState<string | null>(null);
  const [toast, setToast] = useState<PointToastShow | null>(null);
  const [deny, setDeny] = useState<{ seat: number; nonce: number } | undefined>(undefined);
  const queue = useRef(new ToastQueue());
  const counter = useRef(0);
  const prevView = useRef<RoomView | null>(null);
  const prevEpoch = useRef(epoch);
  /** 아직 불리지 않은 타이머들(지연 줄·지연 알림·알림 끄기) */
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const later = (ms: number, fn: () => void): void => {
    if (ms <= 0) {
      fn();
      return;
    }
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  };

  const clearAll = (): void => {
    for (const id of timers.current) clearTimeout(id);
    timers.current.clear();
    if (hideTimer.current !== undefined) clearTimeout(hideTimer.current);
    hideTimer.current = undefined;
  };

  // 언마운트 때 모든 타이머를 푼다(사라진 화면에 상태·기록을 쓰지 않는다)
  useEffect(() => clearAll, []);

  useEffect(() => {
    const reset = prevEpoch.current !== epoch;
    if (reset) {
      prevEpoch.current = epoch;
      clearAll();
      prevView.current = null;
      queue.current = new ToastQueue();
      setAnnounce(null);
      setToast(null);
    }
    if (view === null) {
      prevView.current = null;
      return;
    }
    const prev = prevView.current;
    prevView.current = view;
    if (prev === view) return; // 같은 view 로 다시 실행됨(개발 모드 이중 실행)
    const ev = dayEvents(prev, view, reset ? { reset: true } : {});

    // 위 알림: 줄 끝에 세우고, 합치기 창이 닫힌 뒤(+1ms) 꺼낸다. 알림이 나오면 그 길이가 끝난 뒤(+1ms) 다시 꺼내 본다(대기가 있으면 이어받는다)
    const pump = (): void => {
      const show = queue.current.next(Date.now());
      if (show === null) return;
      counter.current += 1;
      setToast({ ...show, id: counter.current });
      later(show.durationMs + 1, pump);
    };
    if (ev.toasts.length > 0) {
      const now = Date.now();
      for (const t of ev.toasts) queue.current.push(t, now);
      later(TOAST_MERGE_MS + 1, pump);
    }
    // 손사래: 선두가 새 사람으로 바뀔 때마다 한 번(첫 스냅샷·재접속은 leaderShift 가 null)
    const shifted = reset ? null : leaderShift(prev, view);
    if (shifted !== null) setDeny((d) => ({ seat: shifted, nonce: (d?.nonce ?? 0) + 1 }));

    for (const line of ev.lines) {
      later(line.at ?? 0, () => chat.addSystem(line.text, { scope: "all", kind: line.kind, at: Date.now() }));
    }
    for (const a of ev.announces) {
      later(a.at, () => {
        setAnnounce(a.text);
        if (hideTimer.current !== undefined) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => {
          hideTimer.current = undefined;
          setAnnounce(null);
        }, a.ms);
      });
    }
    // eslint 규칙 없음 — later/clearAll 은 ref 와 setState 만 쓰므로 의존성에 넣지 않는다
  }, [view, epoch, chat]);

  return { announce, toast, deny };
}
