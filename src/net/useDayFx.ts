// 서버 view 두 개의 공개 정보 차이(dayEvents)를 화면 연출로 적용하는 훅 (08-13, DAY-04·05·06).
// - 채팅 시스템 줄: chat.addSystem(text, { scope: "all", kind }) — 지연(at)이 있는 줄은 타이머로 나중에 더한다.
// - 결과 알림: 한 번에 하나, 새 알림이 이전 것을 바꾼다. 지연(at) 뒤에 뜨고 ms 뒤에 사라진다. 상태 `announce` 로 돌려준다.
// - 지목 위 알림(08-15): dayEvents 의 toasts 를 ToastQueue(400ms 합치기·대기 4건 상한·대기 2건 이상이면 0.8초)에 세우고, 알림이 끝날 때마다 다음을 꺼낸다. 상태 `toast` 로 돌려준다.
// - 손사래(08-15): 지목 선두가 새 사람으로 바뀌면(leaderShift) `deny` {seat, nonce} 를 갱신한다. WorldStage 가 nonce 가 바뀔 때만 한 번 손사래를 한다.
// - 처형 떠오름(08-16): dayEvents 의 fx ghostRise 를 `fading`(좌석 → 연출 시작 시각)으로 돌려준다. 처형 단계 view 는 처형된 사람이 이미 탈락으로 오므로 화면이 그 순간부터
//   연출이 끝날 때(알림 시작 + GHOST_FADE_END_MS)까지 그 좌석을 표에 붙잡아 둔다. 시작 시각은 단계 진입 + at(알림이 처형으로 바뀌는 때)이라 그 전에는 불투명 그대로 서 있다.
//   표가 렌더 한가운데에서 바뀌어야 진입 순간 한 프레임도 사라졌다 돌아오지 않으므로 이 상태는 렌더 중에 view 차이로 정하고(React 의 "이전 값 기억" 방식), 타이머는 정리만 맡는다.
//   서버가 보낸 유령 위치가 아니라 처형 이벤트 하나로 화면이 그리는 일회성 연출이다.
// 유령이 되는 순간(08-17): 직전 view 의 내가 산 사람이었고 지금 view 의 내가 탈락이면 채팅에 유령 시작 줄('유령 채팅 · 산 사람에게 안 보여요', ghost 아이콘)을 한 번 만들고
//   (직전 줄이 같은 안내면 만들지 않는다 — 07페이즈 DayScene 규칙 그대로) 화면에 `ghostEnter` 신호(번호)를 준다. 화면은 번호가 바뀔 때만 안내·직업 칩 등장을 다시 보인다.
//   재접속 첫 스냅샷·epoch 직후는 직전 view 가 없어 줄도 신호도 없다. 이전 채팅 기록은 건드리지 않는다.
// 밤·아침 임시 틀(08-18): 낮 → 밤에 산 마피아의 마피아 채널 시작 줄(DayScene 규칙을 옮김), 밤 → 아침에 v1.0 morningCardText 제목을 결과 알림으로 띄운다.
// 재접속·새로 고침으로 들어온 첫 스냅샷(직전 view 없음)과 연결 번호(epoch)가 바뀐 첫 스냅샷은 이펙트 없이 정상 상태로 둔다(6페이즈 첫 스냅샷 규칙).
// 방 화면(RoomScreen)이 이 훅을 쥔다: 낮 시작은 맵이 아닌 화면(역할 확인·밤)에서 들어오므로 맵 화면이 새로 마운트되는 순간 직전 view 를 맵 화면이 알 수 없다.
// 시계는 Date.now()/setTimeout 뿐이고 서버 단계 시간을 넘기지 않는다(표시 시간표는 dayView.ts).
import { useEffect, useRef, useState } from "react";
import { isAlive } from "../../shared/game/alive";
import type { RoomView } from "../../shared/protocol";
import { CHAT_TEXT } from "../game/chatText";
import { morningCardText } from "../game/eliminationText";
import { dayEvents, GHOST_FADE_END_MS, TOAST_MERGE_MS, ToastQueue } from "../game/dayView";
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
  /** 처형 떠오름 연출 중인 좌석 → 연출 시작 시각(ms, Date.now 기준). 연출이 끝나면 비워진다. sceneLook 의 fading 으로 그대로 넘긴다 */
  fading: ReadonlyMap<number, number>;
  /** 내가 산 사람에서 유령이 될 때마다 늘어나는 번호(0 에서 시작). 화면은 번호가 바뀔 때만 유령 안내·직업 칩 등장을 보인다 */
  ghostEnter: number;
}

/** 이 view 에서 내가 탈락했는가(내 좌석이 목록에 없으면 산 사람으로 본다 — GameMap 의 meAlive 와 같다) */
function meDead(view: RoomView): boolean {
  const me = view.players.find((p) => p.seat === view.me.seat);
  return me !== undefined && !isAlive(me);
}

const NO_FADING: ReadonlyMap<number, number> = new Map();

/** 아침 알림을 띄우는 시간의 기본값(서버가 단계 길이를 안 보냈을 때만). 아침은 5초(A3) */
const MORNING_ANNOUNCE_MS = 5000;

export function useDayFx({ view, epoch, chat }: { view: RoomView | null; epoch: number; chat: ChatStore }): DayFx {
  const [announce, setAnnounce] = useState<string | null>(null);
  const [toast, setToast] = useState<PointToastShow | null>(null);
  const [deny, setDeny] = useState<{ seat: number; nonce: number } | undefined>(undefined);
  const [fading, setFading] = useState<ReadonlyMap<number, number>>(NO_FADING);
  const [ghostEnter, setGhostEnter] = useState(0);
  const [seen, setSeen] = useState<{ view: RoomView | null; epoch: number }>({ view, epoch });
  if (seen.view !== view || seen.epoch !== epoch) {
    // 렌더 중 상태 갱신: 새 view 가 처형 단계로 들어오면 처형된 좌석을 같은 렌더에서 표에 붙잡는다(첫 스냅샷·epoch 직후는 이벤트가 없다)
    const reset = seen.epoch !== epoch;
    setSeen({ view, epoch });
    if (!reset && seen.view !== null && view !== null && meDead(view) && !meDead(seen.view)) setGhostEnter((n) => n + 1);
    const rises = view === null ? [] : dayEvents(reset ? null : seen.view, view, reset ? { reset: true } : {}).fx;
    if (reset || rises.length > 0) {
      const next = new Map(reset ? NO_FADING : fading);
      const now = Date.now();
      for (const f of rises) if (f.kind === "ghostRise") next.set(f.seat, now + f.at);
      setFading(next);
    }
  }
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

    // 유령이 되는 순간의 채팅 시작 줄: 같은 안내가 방금 마지막 줄이면 만들지 않는다(밤 DayScene 이 이미 만든 경우 포함)
    if (!reset && prev !== null && meDead(view) && !meDead(prev)) {
      const last = chat.lines().at(-1);
      const repeated = last !== undefined && last.kind === "system" && last.text === CHAT_TEXT.channelStart.ghost;
      if (!repeated) chat.addSystem(CHAT_TEXT.channelStart.ghost, { scope: "ghost", icon: "ghost", at: Date.now() });
    }

    // 마피아 채널 시작 줄(밤, 08-18 이 DayScene 규칙을 옮김): 같은 접속에서 낮 → 밤으로 넘어올 때, 또는 밤 안에서 내 채널이 mafia 로 바뀔 때 한 번.
    // 서버가 내 채널을 mafia 로 보낸 view 에서만 문구를 꺼낸다 — 시민 편 화면에는 이 문구가 들어오지 않는다(T-07-40·T-08-47). 재접속 첫 스냅샷은 줄이 없다.
    if (!reset && prev !== null && view.phase === "night" && view.me.chat === "mafia" && (prev.phase !== "night" || prev.me.chat !== "mafia")) {
      chat.addSystem(CHAT_TEXT.channelStart.mafia, { scope: "mafia", icon: "roleMafia", at: Date.now() });
    }

    // 처형 떠오름이 끝나면(알림 시작 + 2.4초) 좌석을 놓아준다 — 산 사람 화면에서 그 사람은 영영 없다
    for (const f of ev.fx) {
      if (f.kind !== "ghostRise") continue;
      later(f.at + GHOST_FADE_END_MS, () =>
        setFading((m) => {
          if (!m.has(f.seat)) return m;
          const next = new Map(m);
          next.delete(f.seat);
          return next;
        }),
      );
    }
    for (const line of ev.lines) {
      later(line.at ?? 0, () => chat.addSystem(line.text, { scope: "all", kind: line.kind, at: Date.now() }));
    }
    // 아침 알림(08-18 임시 틀): 같은 접속에서 아침으로 들어오는 순간 v1.0 morningCardText 의 제목 한 줄을 서버 마감까지 띄운다(새 문구 없음).
    // 첫 스냅샷·재접속은 prev 가 없거나 reset 이라 알림이 없다. 밤에 당한 사람은 이 알림과 함께 산 사람 화면에서 사라진다(떠오름 없음 — dayEvents 에 fx 가 없다).
    const announces = [...ev.announces];
    if (!reset && prev !== null && view.phase === "morning" && prev.phase !== "morning") {
      const nicknameOf = (seat: number): string | undefined => view.players.find((p) => p.seat === seat)?.nickname;
      announces.push({ text: morningCardText(view.day?.morning, nicknameOf).title, at: 0, ms: view.phaseDurationMs ?? MORNING_ANNOUNCE_MS });
    }
    for (const a of announces) {
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

  return { announce, toast, deny, fading, ghostEnter };
}
