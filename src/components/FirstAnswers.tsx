import { useEffect, useRef, useState } from "react";
import type { KeywordAnswerRow, RoomView } from "../../shared/protocol";
import { seatColorVar } from "../net/assets";
import { Button } from "./Button";
import { Sheet } from "./Sheet";
import "../styles/first-answers.css";

const TITLE = "모두의 답";
const DISMISSED_KEY = "minifia:first-answers-dismissed";

interface AnswerListProps {
  rows: readonly KeywordAnswerRow[];
  players: RoomView["players"];
}

export function FirstAnswerList({ rows, players }: AnswerListProps) {
  return (
    <ul className="mf-first-answers__list" data-answer-list="">
      {rows.map(({ seat, text, order }) => (
        <li key={seat} className="mf-first-answers__row" data-answer-row="" data-answer-order={order} data-answer-seat={seat} data-answer-none={text === null ? "" : undefined}>
          <span className="mf-first-answers__name">
            <span aria-hidden="true" style={{ background: seatColorVar(seat) }} />
            {players.find((player) => player.seat === seat)?.nickname ?? `${seat + 1}번 자리`}
          </span>
          <span className="mf-first-answers__text">{text ?? "미제출"}</span>
        </li>
      ))}
    </ul>
  );
}

function wasDismissed(id: string): boolean {
  try {
    return window.sessionStorage.getItem(DISMISSED_KEY) === id;
  } catch {
    return false;
  }
}

/** 마감은 서버가 정하고, 닫기는 이번 페이지와 새로고침에만 반영한다. */
export function FirstAnswers({ id, endsAt, offset, ...list }: AnswerListProps & { id: string; endsAt: number; offset: number }) {
  const remaining = () => endsAt - (Date.now() + offset);
  const [closed, setClosed] = useState(() => wasDismissed(id) || remaining() <= 0);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (closed) return;
    const expire = () => setClosed(true);
    const getRemaining = () => endsAt - (Date.now() + offset);
    const timer = setTimeout(expire, Math.max(0, getRemaining()));
    const onVisible = () => {
      if (document.visibilityState === "visible" && getRemaining() <= 0) expire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [endsAt, offset, closed]);

  if (closed || remaining() <= 0) return null;
  const close = () => {
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, id);
    } catch {
      // 저장소에 접근할 수 없어도 현재 화면은 닫는다.
    }
    setClosed(true);
  };
  return (
    <Sheet label={TITLE} onClose={close} initialFocusRef={heading} centered className="mf-first-answers">
      <h2 ref={heading} tabIndex={-1} className="mf-t-heading mf-first-answers__title">{TITLE}</h2>
      <FirstAnswerList {...list} />
      <Button variant="secondary" block data-first-answers-close="" onClick={close}>확인</Button>
    </Sheet>
  );
}
