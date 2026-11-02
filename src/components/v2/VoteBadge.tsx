import "../../styles/v2.css";

// 득표 배지(VoteBadge). design/v2.0/design-system/components/bundle.js 의 VoteBadge 와 bundle.css 44-46 을 React 19 로 옮겼다(승인 2026-10-31).
// 지목받은 사람 머리 위에 받은 표 수를 "3표" 로 보인다(결정 0049). 0표(이하)면 아무것도 그리지 않는다.
// lead: 최다 득표가 한 명일 때만 부르는 쪽이 켠다(배지는 동점·선두를 판단하지 않는다).
// 숫자가 바뀌어도 같은 요소에서 글자만 바뀐다 — 부르는 쪽은 key 를 바꾸지 않는다.
// 숫자 글자 스타일(badge-number)은 08-05 의 토큰이 정한다 — 그 전에는 CSS 의 명조 대체값으로 그린다(계획 A1).
//
// 숫자는 React 텍스트 노드로만 그린다(innerHTML 없음, T-08-09).

export interface VoteBadgeProps {
  /** 받은 표 수. 1 미만이면 그리지 않는다 */
  count: number;
  /** 최다 득표 한 명: 크림 빛과 맥박 */
  lead?: boolean;
}

export function VoteBadge({ count, lead }: VoteBadgeProps) {
  if (!(count >= 1)) return null;
  const cls = ["mv-badge", lead && "is-lead"].filter(Boolean).join(" ");
  return (
    <span className={cls} data-count={count}>
      <span className="mv-badge__num">{count}</span>
      <span className="mv-badge__unit">표</span>
    </span>
  );
}
