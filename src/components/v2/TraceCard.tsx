import type { ReactElement } from "react";
import "../../styles/v2.css";
import type { TracePiece } from "../../../shared/protocol";
import { TRACE_NOTE, TRACE_TEXT } from "../../game/traceText";
import { V2Icon } from "./V2Icon";

export interface TraceCardProps {
  piece: TracePiece;
}

// 아침 흔적 카드(15-07, TRACE-02·03·D-06, UI-SPEC "아침 흔적 카드 계약"). 모든 사람(유령 포함)에게 같은 카드 — 누를 것이 아니라 빛도 단추도 없다.
// 조각 이름은 닫힌 표(TRACE_TEXT)에서만 오고, 확정 증거가 아님은 고정 문구 한 줄이 말한다. 속성 값에 조각 id·좌석·역할이 없다(T-15-28).
export function TraceCard({ piece }: TraceCardProps): ReactElement {
  return (
    <div className="mv-trace" data-trace-card="" role="status">
      <span className="mv-trace__disc">
        <V2Icon name="thread" size={24} />
      </span>
      <span className="mv-trace__text">
        <span className="mv-trace__name">{TRACE_TEXT[piece]}</span>
        <span className="mv-trace__note">{TRACE_NOTE}</span>
      </span>
    </div>
  );
}
