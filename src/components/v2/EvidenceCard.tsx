import type { ReactElement } from "react";
import "../../styles/v2.css";
import "../../styles/evidence.css";
import type { PlaceId, TracePiece } from "../../../shared/protocol";
import { placeIconOf } from "../../game/placeText";
import { TRACE_NOTE, TRACE_TEXT } from "../../game/traceText";
import { V2Icon } from "./V2Icon";

export interface EvidenceCardProps {
  piece: TracePiece;
  /** 피해자 이름·자리색. 좌석을 못 찾으면 null(2행에서 이름 칸을 비운다). */
  victim: { name: string; color: string } | null;
  /** 마지막 목격자 이름·자리색·피해자 곁 장소. 목격자가 없으면 null — 눈 아이콘과 "0" 만 보인다. */
  witness: { name: string; color: string; place: PlaceId } | null;
}

// 증거 카드(16-01, V-28·V-30, D-10): 1행 흔적(15 흔적 카드 그대로 — .mv-trace__name·.mv-trace__note 를 E2E 가 잰다), 구분선, 2행 마지막 목격
// (피해자 이름 취소선 → 눈 → 목격자 이름 → 장소 그림). 모든 사람(유령 포함)에게 같은 카드 — 역할 prop 이 없고 누를 것이 아니라 빛도 단추도 없다.
// 닉네임은 React 텍스트 노드로만 그린다(innerHTML 없음). 속성 값에는 좌석·역할·조각 id 가 없다(자리색은 스타일 값뿐). 얼굴 그림은 쓰지 않는다.
export function EvidenceCard({ piece, victim, witness }: EvidenceCardProps): ReactElement {
  return (
    <div className="mv-evidence mv-trace" data-trace-card="" role="status">
      <div className="mv-evidence__trace">
        <span className="mv-trace__disc">
          <V2Icon name="thread" size={24} />
        </span>
        <span className="mv-trace__text">
          <span className="mv-trace__name">{TRACE_TEXT[piece]}</span>
          <span className="mv-trace__note">{TRACE_NOTE}</span>
        </span>
      </div>
      <div className="mv-evidence__rule" aria-hidden="true" />
      <div className="mv-evidence__row" data-lastseen-row="" data-lastseen-count={witness === null ? "0" : "1"}>
        {victim === null ? null : (
          <span className="mv-evidence__who">
            <span className="mv-evidence__dot" style={{ background: victim.color }} />
            <span className="mv-evidence__victim">{victim.name}</span>
          </span>
        )}
        <span className="mv-evidence__eye">
          <V2Icon name="eye" size={24} />
        </span>
        {witness === null ? (
          <span className="mv-evidence__zero">0</span>
        ) : (
          <>
            <span className="mv-evidence__who">
              <span className="mv-evidence__dot" style={{ background: witness.color }} />
              <span className="mv-evidence__witness">{witness.name}</span>
            </span>
            <span className="mv-evidence__place">
              <V2Icon name={placeIconOf(witness.place)} size={32} />
            </span>
          </>
        )}
      </div>
    </div>
  );
}
