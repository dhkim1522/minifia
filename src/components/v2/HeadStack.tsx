import "../../styles/v2.css";

// 이름표(NameTag)와 머리 위 쌓임(HeadStack). design/v2.0/design-system/components/bundle.js :81·:98 을 React 19 로 옮겼다.
// 같은 마크업·클래스 이름(mv-tag·mv-head)을 쓴다. 이 페이즈 속성은 name·color·me·away 뿐이다.
// 위 칸(입력 중·직업 표시·도장·배지)과 mine·done·blink 는 7·8페이즈 UI-SPEC 이 정해 더한다.
//
// 닉네임은 React 텍스트 노드로만 그린다(innerHTML 없음, T-06-26). 말줄임도 하지 않는다:
// 최대 폭이 없고(white-space: nowrap) 전각 8자 + " (나)" 도 잘리지 않는다(MAP-07, 결정 0052-2).

export interface NameTagProps {
  name: string;
  /** 자리 구분색 — `var(--seat-1)` ~ `var(--seat-8)` 값 */
  color: string;
  /** 내 캐릭터: 닉네임 뒤에 " (나)" 와 안쪽 테두리 */
  me?: boolean;
  /** 연결 끊김: 불투명도 0.55, 점 gray-700 */
  away?: boolean;
}

export function NameTag({ name, color, me, away }: NameTagProps) {
  const cls = ["mv-tag", me && "is-me", away && "is-away"].filter(Boolean).join(" ");
  return (
    <span className={cls}>
      <span className="mv-tag__dot" style={{ background: color }} />
      <span className="mv-tag__name">{me ? `${name} (나)` : name}</span>
    </span>
  );
}

export type HeadStackProps = NameTagProps;

// 바닥 가운데를 캐릭터 머리 꼭대기에 translate(-50%, -100%) 로 놓는 일은 쓰는 쪽(이름표 층, 06-13)이 한다.
export function HeadStack({ name, color, me, away }: HeadStackProps) {
  return (
    <div className="mv-head">
      <NameTag name={name} color={color} me={me} away={away} />
    </div>
  );
}
