import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import type { RoomView } from "../../shared/protocol";
import { playerNameColor } from "../game/playerIdentity";
import { SUSPECT_TEXT } from "../game/suspectView";
import { Button } from "./Button";
import { V2Icon } from "./v2/V2Icon";
import "../styles/keyword-review.css";

interface PublicSuspectAction {
  canChange(seat: number): boolean;
  change(seat: number): void;
}

export function KeywordPublicReveal({ view, still, suspect }: { view: RoomView; still?: boolean; suspect?: PublicSuspectAction }) {
  const keyword = view.phase === "answerReveal" && view.day?.n === 1 ? view.day.keyword : undefined;
  const listRef = useRef<HTMLOListElement>(null);
  const hintId = useId();
  const [hasMoreBelow, setHasMoreBelow] = useState(false);
  const answerCount = keyword?.answers?.length ?? 0;
  const measure = useCallback((list: HTMLOListElement) => {
    // scrollTop can be fractional at some device scales.
    setHasMoreBelow(list.scrollHeight - list.clientHeight - list.scrollTop > 1);
  }, []);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list === null) return;
    measure(list);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure(list));
    observer.observe(list);
    for (const row of list.children) observer.observe(row);
    return () => observer.disconnect();
  }, [answerCount, measure]);
  if (keyword?.answer === undefined) return null;
  return (
    <div className="mf-phase-event mf-keyword-review" data-phase-event="keyword-public-reveal">
      <section className="mf-phase-event__card mf-keyword-review__card" aria-label="제시어와 답안">
        <div className={still ? "mf-keyword-review__word is-still" : "mf-keyword-review__word"} data-announce="" role="status">
          <span data-announce-label="" className="mf-keyword-review__label">제시어</span>{" "}
          <strong className="mf-announce__text">{keyword.answer}</strong>
        </div>
        {!!keyword.answers?.length && (<>
          <div className="mf-keyword-review__summary">
            <span>참가자 답안</span>
            {hasMoreBelow ? <span id={hintId} className="mf-keyword-review__scroll-hint" data-public-answer-scroll-hint="">
              아래에 답안 더 있음 <V2Icon name="chevronRight" size={12} />
            </span> : null}
            <span>{answerCount}명</span>
          </div>
          <ol ref={listRef} className="mf-keyword-review__answers" tabIndex={0} aria-label="참가자 답안"
            aria-describedby={hasMoreBelow ? hintId : undefined} onScroll={(event) => measure(event.currentTarget)}>
            {keyword.answers.map(({ order, seat, text }) => {
              const name = view.players.find(p => p.seat === seat)?.nickname ?? `${seat + 1}번 자리`;
              const marked = view.me.suspectTo === seat;
              return (
                <li key={seat} className="mf-keyword-review__answer">
                  <span className="mf-keyword-review__order">{order}</span>
                  <div className="mf-keyword-review__entry">
                    <span className="mf-keyword-review__dot" aria-hidden="true" style={{ backgroundColor: playerNameColor(seat) }} />
                    <span className="mf-keyword-review__name">{name}</span>
                    <span className="mf-keyword-review__text" data-answer-missing={text === null ? "" : undefined}>{text ?? "미제출"}</span>
                  </div>
                  {suspect !== undefined && seat !== view.me.seat && (
                    <Button variant="secondary" compact className="mf-keyword-review__suspect"
                      data-public-suspect={String(seat)} aria-label={SUSPECT_TEXT.target(name, marked)}
                      aria-pressed={marked} disabled={!suspect.canChange(seat)}
                      icon={<V2Icon name={marked ? "postitFilled" : "postit"} size={16} />}
                      onClick={() => suspect.change(seat)} />
                  )}
                </li>
              );
            })}
          </ol>
        </>)}
      </section>
    </div>
  );
}
