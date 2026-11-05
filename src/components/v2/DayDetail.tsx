import "../../styles/v2.css";
import type { DayLines } from "../../game/timelineView";
import { TlFace } from "./TimelineStrip";

// 하루 상세 (11-11, 결정 D-8·D-9, 0066-1). 선택한 일차의 줄들을 얼굴·아이콘·숫자로만 보여 준다 — 문장이 없다(보이는 글자는 숫자뿐).
// 접근성 이름(img alt·aria-label)은 닉네임·직업 이름으로 만들고, 닉네임은 React 속성으로만 그린다(T-11-37).
// 득표 배지는 숫자만 그린다(VoteBadge 의 '표' 단위가 글자라 쓰지 않는다).

export interface DayDetailProps {
  lines: DayLines;
  /** 좌석 → 닉네임(없으면 빈 이름) */
  contacts: ReadonlyMap<number, string>;
}

function Arrow() {
  return (
    <svg className="mf-tl__arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

export function DayDetail({ lines, contacts }: DayDetailProps) {
  const name = (seat: number): string => contacts.get(seat) ?? "";
  const { pointing } = lines;
  return (
    <div className="mf-tl__detail" data-day-detail={lines.n}>
      {pointing.counts.length > 0 ? (
        <div className="mf-tl__row" data-row="pointing">
          {pointing.counts.map(({ seat, count }) => (
            <div className="mf-tl__group" data-point-group={seat} key={seat}>
              <span className="mf-tl__faces" data-from="">
                {pointing.arrows.filter((a) => a.to === seat).map((a) => (
                  <TlFace key={a.from} seat={a.from} name={name(a.from)} />
                ))}
              </span>
              <Arrow />
              <span className="mf-tl__target" data-to="">
                <span className="mf-tl__votes" data-votes="">{count}</span>
                <TlFace seat={seat} name={name(seat)} />
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
