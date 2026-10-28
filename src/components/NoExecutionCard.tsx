import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import type { NoExecutionReason } from "../../shared/protocol";
import { NO_EXEC_CARD_MS, VERDICT_TEXT, introCardGeometry, noExecutionText } from "../game/verdict";
import "../styles/verdict.css";

export interface NoExecutionCardProps {
  /** DayTable 의 layer 슬롯이 주는 장면 크기. 위치는 처형 투표 카드와 같다(introCardGeometry) */
  layout: { sceneW: number; sceneH: number; pad?: number };
  /** 서버가 보낸 이유 코드 하나(view.day.noExecution.reason). 그릴 데이터는 이것뿐이다(누가 반대했는지는 입력에 없다) */
  reason: NoExecutionReason;
  /** 1.6초가 지나면 부른다. 마운트 때 한 번만 건 타이머가 부른다(부모가 다시 그려도 리셋·연장되지 않는다) */
  onDone: () => void;
}

// 처형 무효 카드(04-24, UI-SPEC 9.2, D-34·P-3): 처형이 성립하지 않아 밤으로 올 때 처형 투표 카드와 같은 모양·낙하로, 색은 회색, 셰브런·질문 강조는 없다.
// 0~420ms 낙하(바운스 없음) → 정지 → 1300~1600ms 페이드아웃. 클라이언트 연출이라 서버 밤 시간은 늘지 않고 터치를 막지 않는다(밤 행동이 처음부터 가능).
// 이유 문구는 noExecutionText 한 곳에서만 온다. 읽기는 밤 단계 안내(`처형 무효. {부제}. …`)가 하므로 카드는 aria-hidden 이다.
export function NoExecutionCard({ layout, reason, onDone }: NoExecutionCardProps): ReactElement {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const id = setTimeout(() => doneRef.current(), NO_EXEC_CARD_MS);
    return () => clearTimeout(id);
  }, []);
  const { top } = introCardGeometry(layout.sceneW, layout.sceneH, layout.pad);
  return (
    <div className="mf-vintro mf-vintro--void" aria-hidden="true">
      <div className="mf-vintro__veil" />
      <div className="mf-vintro__drop" style={{ top: `${top}px` }}>
        <div className="mf-vintro__face">
          <svg className="mf-vintro__ln" viewBox="0 0 150 10" aria-hidden="true">
            <path className="mf-vintro__ln-line" d="M0 5H62M88 5H150" />
            <path className="mf-vintro__ln-dia" d="M75 0L81 5L75 10L69 5Z" />
          </svg>
        </div>
        <div className="mf-vintro__body">
          <p className="mf-vintro__title">{VERDICT_TEXT.noExecCardTitle}</p>
          <p className="mf-vintro__sub">{noExecutionText(reason)}</p>
        </div>
      </div>
    </div>
  );
}
