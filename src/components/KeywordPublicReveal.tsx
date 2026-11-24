import type { RoomView } from "../../shared/protocol";
import { PlayerName } from "./PlayerName";
import "../styles/keyword-review.css";

export function KeywordPublicReveal({ view, still }: { view: RoomView; still?: boolean }) {
  const keyword = view.day?.keyword;
  if (view.phase !== "answerReveal" || view.day?.n !== 1 || keyword?.answer === undefined) return null;
  return (
    <div className="mf-phase-event mf-keyword-review" data-phase-event="keyword-public-reveal">
      <section className="mf-phase-event__card mf-keyword-review__card" aria-label="제시어와 답안">
        <div className={still ? "mf-keyword-review__word is-still" : "mf-keyword-review__word"} data-announce="" role="status">
          <span data-announce-label="" className="mf-keyword-review__label">제시어</span>{" "}
          <strong className="mf-announce__text">{keyword.answer}</strong>
        </div>
        {!!keyword.answers?.length && (<>
          <div className="mf-keyword-review__summary"><span>참가자 답안</span><span>{keyword.answers.length}명</span></div>
          <ol className="mf-keyword-review__answers" tabIndex={0} aria-label="참가자 답안">
            {keyword.answers.map(({ order, seat, text }) => (
              <li key={seat} className="mf-keyword-review__answer">
                <span className="mf-keyword-review__order">{order}</span>
                <div>
                  <PlayerName seat={seat}>{view.players.find(p => p.seat === seat)?.nickname ?? `${seat + 1}번 자리`}</PlayerName>
                  <span className="mf-keyword-review__text">{text ?? "미제출"}</span>
                </div>
              </li>
            ))}
          </ol>
        </>)}
      </section>
    </div>
  );
}
