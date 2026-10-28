import type { CSSProperties, ReactElement } from "react";
import "../styles/day.css";
import "../styles/night.css";
import "../styles/verdict.css";

export interface MorningCardProps {
  title: string;
  /** 있으면 보조 문단(무사한 아침 '모두 무사해요'). 탈락 문구에는 없다 */
  sub?: string;
  /** 퇴장 페이드를 시작하기까지의 지연(ms). exitDelayOf(단계 남은 시간)로 만든다 */
  exitDelayMs: number;
  /** "amber": 처형 단계 카드(테두리·위 띠·그림자가 앰버, D-33). 없으면 아침 카드 그대로 */
  tone?: "amber";
  /** "scene": 장면 상자(.mf-dayscene__scene) 안 위 8px 에 놓는다(처형 카드). 없으면 루트 기준 top 168(아침 카드) */
  anchor?: "scene";
}

/**
 * 퇴장 지연 = 단계 남은 시간 − 300ms (퇴장 페이드가 단계 끝에 맞춰 끝난다). 음수는 0 으로 자른다.
 * 재접속으로 중간에 들어오면 그때의 남은 시간 기준이라 카드가 남은 만큼만 보인다(UI-SPEC F.5 허용된 단순화).
 */
export function exitDelayOf(remainingMs: number): number {
  return Math.max(0, remainingMs - 300);
}

// 아침 발표 카드(시안 .bn): 낮 테이블 위 가운데. 등장은 팝(scale .92→1 + 투명도 300ms), 퇴장은 마지막 300ms 의 페이드(night.css).
// 지연은 CSS 변수로 싣는다 — 어둡게 층(--mf-dim-exit-delay)과 같은 값을 DayScene 이 넘긴다.
// 처형 카드(04-23)는 같은 부품의 변형이다: tone·anchor 를 주면 클래스만 더해지고 기본 호출의 마크업·클래스는 그대로다.
export function MorningCard({ title, sub, exitDelayMs, tone, anchor }: MorningCardProps): ReactElement {
  const className = `mf-morningcard${tone === "amber" ? " mf-morningcard--amber" : ""}${anchor === "scene" ? " mf-morningcard--scene" : ""}`;
  return (
    <div className={className} style={{ "--mf-morning-exit-delay": `${exitDelayMs}ms` } as CSSProperties}>
      <p className="mf-morningcard__t">{title}</p>
      {sub ? <p className="mf-morningcard__s">{sub}</p> : null}
    </div>
  );
}
