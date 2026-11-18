import { useId, useState } from "react";
import type { DiscussionEvidence as Evidence, DiscussionEvidenceRow } from "../../game/discussionEvidence";
import { seatColorVar } from "../../net/assets";
import { V2Icon } from "./V2Icon";
import "../../styles/discussion-evidence.css";

export type QuoteResult = "added" | "busy" | "full";

/** 채팅 안에서 공개 답과 유언을 읽고, 입력칸에 옮긴다. */
export function DiscussionEvidence({ evidence, hidden, onQuote }: {
  evidence: Evidence;
  hidden: boolean;
  onQuote: (row: DiscussionEvidenceRow) => QuoteResult;
}) {
  const listId = useId();
  const [open, setOpen] = useState(true);
  const [notice, setNotice] = useState<"busy" | "full" | null>(null);

  return (
    <section className="mf-discussion-evidence" data-discussion-evidence="" hidden={hidden}>
      <button
        type="button"
        className="mf-discussion-evidence__toggle"
        data-evidence-toggle=""
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => { setOpen(!open); setNotice(null); }}
      >
        {evidence.label}
        <V2Icon name="chevronRight" size={16} />
      </button>
      <div id={listId} hidden={!open}>
        <ul className="mf-discussion-evidence__list" aria-label={evidence.label}>
          {evidence.rows.map((row) => {
            const content = (
              <>
                {row.order === undefined ? null : <span className="mf-discussion-evidence__order">{row.order}</span>}
                <span className="mf-discussion-evidence__name">
                  <i aria-hidden="true" style={{ background: seatColorVar(row.seat) }} />
                  {row.name}
                </span>
                <span className="mf-discussion-evidence__text">{row.text ?? "답 없음"}</span>
              </>
            );
            return (
              <li key={row.seat} data-evidence-row="" data-evidence-seat={row.seat} data-evidence-order={row.order} data-evidence-none={row.text === null ? "" : undefined}>
                {row.text === null ? <div className="mf-discussion-evidence__row">{content}</div> : (
                  <button
                    type="button"
                    className="mf-discussion-evidence__row"
                    data-evidence-quote=""
                    aria-label={`${row.name}의 ${evidence.label === "아침 유언" ? "유언" : "답"} 인용, ${row.text}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      const result = onQuote(row);
                      if (result === "added") { setOpen(false); setNotice(null); }
                      else setNotice(result);
                    }}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {notice !== null ? (
          <p className="mf-discussion-evidence__notice" role="status">
            {notice === "full" ? "입력 글을 줄이면 인용할 수 있어요" : "입력을 마친 뒤 눌러 주세요"}
          </p>
        ) : null}
      </div>
    </section>
  );
}
