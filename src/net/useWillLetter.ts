// 유언 편지 상태(결정 0063-3). 본문은 죽을 때 all 채널로 온 k:'will' 카드에서만(L16). 시각은 Date.now·setTimeout, 수명은 아침 시작 시계 기준(animationend 에 기대지 않는다, C-1).
// 같은 epoch 에서 밤 → 아침 view 가 오고 탈락자가 있으면 그 좌석의 라이브 유언 카드를 기다린다: 이미 있거나 T0 + 5초 전에 오면 편지를 돌려주고,
// 그 아침의 카드(유언·쪽지)를 편지가 접히는 시각까지 chat.holdCardsUntil 로 보류한다. 늦은 카드·빈 유언·재접속·구출·처형은 편지를 만들지 않는다(보류는 9페이즈 그대로).
// useDayFx 와 같은 판정 규칙(직전 view·epoch 로 reset)을 쓴다. 이 계획에서는 화면에 걸지 않는다(09.1-11).
import { useEffect, useRef, useState } from "react";
import type { RoomView } from "../../shared/protocol";
import { dayEvents } from "../game/dayView";
import type { AnnounceIcon } from "../game/dayView";
import { LETTER_END_AT_MS, LETTER_FOLD_AT_MS, letterT0, oneParagraph } from "../game/willLetter";
import type { ChatStore } from "./chatStore";

/** 지금 뜰 편지 한 통. t0 는 Date.now 기준 편지 시작 시각(렌더 시각 + 그 화면의 아침 알림 시각) */
export interface WillLetter {
  seat: number;
  /** 유언을 남긴 사람 이름(머리글 "{이름} 님의 유언") */
  name: string;
  /** 줄바꿈을 공백으로 이은 한 문단 */
  text: string;
  t0: number;
  /** 편지 위 자리로 올라가 유지될 아침 알림 */
  announce: { text: string; icon?: AnnounceIcon };
}

export function useWillLetter({ view, epoch, chat }: { view: RoomView | null; epoch: number; chat: ChatStore }): WillLetter | null {
  const [letter, setLetter] = useState<WillLetter | null>(null);
  const prevView = useRef<RoomView | null>(null);
  const prevEpoch = useRef(epoch);
  /** 카드를 기다리는 구독과 끝 타이머 — 새 아침·reset·언마운트에 정리한다 */
  const cleanups = useRef(new Set<() => void>());

  const clearAll = (): void => {
    for (const fn of [...cleanups.current]) fn();
    cleanups.current.clear();
  };
  useEffect(() => clearAll, []);

  useEffect(() => {
    const reset = prevEpoch.current !== epoch;
    if (reset) {
      prevEpoch.current = epoch;
      clearAll();
      prevView.current = null;
      setLetter(null);
    }
    if (view === null) {
      prevView.current = null;
      return;
    }
    const prev = prevView.current;
    prevView.current = view;
    if (prev === view) return; // 같은 view 로 다시 실행됨(개발 모드 이중 실행)

    const rel = letterT0(prev, view, reset ? { reset: true } : {});
    const seat = view.day?.morning?.eliminated;
    if (rel === null || seat === undefined) return;

    clearAll();
    setLetter(null);
    const t0 = Date.now() + rel;
    const foldAt = t0 + LETTER_FOLD_AT_MS;
    const endAt = t0 + LETTER_END_AT_MS;
    const name = view.players.find((p) => p.seat === seat)?.nickname ?? "";
    const a = dayEvents(prev, view).announces[0];
    const announce = a === undefined ? { text: "" } : { text: a.text, ...(a.icon !== undefined ? { icon: a.icon } : {}) };

    const timers = new Set<ReturnType<typeof setTimeout>>();
    let unsub: (() => void) | null = null;
    const stopWatching = (): void => {
      unsub?.();
      unsub = null;
    };
    const cancel = (): void => {
      stopWatching();
      for (const id of timers) clearTimeout(id);
      timers.clear();
      cleanups.current.delete(cancel);
    };
    cleanups.current.add(cancel);
    const later = (at: number, fn: () => void): void => {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, Math.max(0, at - Date.now()));
      timers.add(id);
    };

    /** 카드가 있고 접힘 전이면 편지를 시작한다. 시작했거나 더 기다릴 필요가 없으면 true */
    const tryStart = (): boolean => {
      if (Date.now() >= foldAt) return true;
      const card = chat.liveCard("will", seat);
      if (card === undefined) return false;
      const text = oneParagraph(card.text);
      if (text === "") return true;
      chat.holdCardsUntil(foldAt, Date.now());
      setLetter({ seat, name, text, t0, announce });
      later(endAt, () => {
        setLetter(null);
        cancel();
      });
      return true;
    };

    if (tryStart()) return;
    unsub = chat.subscribe(() => {
      if (tryStart()) stopWatching();
    });
    later(foldAt, stopWatching);
  }, [view, epoch, chat]);

  return letter;
}
