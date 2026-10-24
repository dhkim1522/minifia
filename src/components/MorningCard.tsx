import type { ReactElement } from "react";
import "../styles/day.css";
import "../styles/night.css";

export interface MorningCardProps {
  title: string;
  /** 있으면 보조 문단(무사한 아침 '모두 무사해요'). 탈락 문구에는 없다 */
  sub?: string;
}

// 아침 발표 카드(시안 .bn): 낮 테이블 위 가운데. 진입은 낮 장면의 300ms 페이드를 재사용한다(UI-SPEC Motion card-enter, 가정).
export function MorningCard({ title, sub }: MorningCardProps): ReactElement {
  return (
    <div className="mf-morningcard mf-dayscene__enter">
      <p className="mf-morningcard__t">{title}</p>
      {sub ? <p className="mf-morningcard__s">{sub}</p> : null}
    </div>
  );
}
