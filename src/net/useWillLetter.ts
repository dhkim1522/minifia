// 같은 연결에서 밤 → 아침에 실시간으로 받은 공개 유언만 편지에 띄운다. 채팅 공개 시각은 편지 닫기와 별개다.
import { useEffect, useRef, useState } from "react";
import { MAP_PHASES } from "../../shared/game/movement";
import type { RoomView } from "../../shared/protocol";
import { dayEvents } from "../game/dayView";
import type { AnnounceIcon } from "../game/dayView";
import { LETTER_CHAT_AT_MS, letterT0, oneParagraph } from "../game/willLetter";
import type { ChatStore } from "./chatStore";

/** 지금 뜰 편지 한 통. t0 는 아침 알림과 카드 도착 중 늦은 시각이다. */
export interface WillLetter {
  seat: number;
  /** 유언을 남긴 사람 이름(머리글 "{이름} 님의 유언") */
  name: string;
  /** 줄바꿈을 공백으로 이은 한 문단 */
  text: string;
  t0: number;
  /** 같은 아침에 편지 위에 표시할 알림 */
  announce: { text: string; icon?: AnnounceIcon };
}

export function useWillLetter({ view, epoch, chat }: { view: RoomView | null; epoch: number; chat: ChatStore }): WillLetter | null {
  const [letter, setLetter] = useState<WillLetter | null>(null);
  const prevView = useRef<RoomView | null>(null);
  const prevEpoch = useRef(epoch);
  const stopWaiting = useRef<(() => void) | null>(null);
  const cancelWait = (): void => {
    stopWaiting.current?.();
    stopWaiting.current = null;
  };
  useEffect(() => cancelWait, []);

  useEffect(() => {
    const reset = prevEpoch.current !== epoch;
    if (reset) {
      prevEpoch.current = epoch;
      cancelWait();
      prevView.current = null;
      setLetter(null);
    }
    if (view === null || !MAP_PHASES.has(view.phase)) {
      cancelWait();
      prevView.current = null;
      setLetter(null);
      return;
    }
    const prev = prevView.current;
    prevView.current = view;
    if (prev === view) return; // 같은 view 로 다시 실행됨(개발 모드 이중 실행)
    if (view.phase !== "morning") {
      cancelWait();
      return;
    }

    const rel = letterT0(prev, view, reset ? { reset: true } : {});
    const seat = view.day?.morning?.eliminated;
    if (rel === null || seat === undefined) return;

    cancelWait();
    const t0 = Date.now() + rel;
    const chatAt = t0 + LETTER_CHAT_AT_MS;
    const name = view.players.find((p) => p.seat === seat)?.nickname ?? "";
    const a = dayEvents(prev, view).announces[0];
    const announce = a === undefined ? { text: "" } : { text: a.text, ...(a.icon !== undefined ? { icon: a.icon } : {}) };

    /** 공개 전에 도착한 카드로 편지를 시작한다. 더 기다릴 필요가 없으면 true */
    const tryStart = (): boolean => {
      const now = Date.now();
      if (now >= chatAt) return true;
      const card = chat.liveCard("will", seat);
      if (card === undefined) return false;
      const text = oneParagraph(card.text);
      if (text === "") return true;
      cancelWait();
      chat.holdCardsUntil(chatAt, now);
      setLetter({ seat, name, text, t0: Math.max(t0, now), announce });
      return true;
    };

    if (tryStart()) return;
    const unsub = chat.subscribe(() => {
      if (tryStart()) cancelWait();
    });
    const timeout = setTimeout(cancelWait, Math.max(0, chatAt - Date.now()));
    stopWaiting.current = () => {
      unsub();
      clearTimeout(timeout);
    };
  }, [view, epoch, chat]);

  return letter;
}
