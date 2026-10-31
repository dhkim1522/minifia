import "../../styles/v2.css";

// 점 진행 ●●●○○. design/v2.0/design-system/components/bundle.js :74 를 React 19 로 옮겼다(결정 0051-4).
export interface DotProgressProps {
  count: number;
  total: number;
  /** 읽어 주는 이름. 예: "3명 모임". 없으면 "3/8" */
  label?: string;
}

export function DotProgress({ count, total, label }: DotProgressProps) {
  const dots: number[] = [];
  for (let i = 0; i < total; i += 1) dots.push(i);
  return (
    <span className="mv-dots" role="img" aria-label={label ?? `${count}/${total}`}>
      {dots.map((i) => (
        <span key={i} className={i < count ? "mv-dots__dot is-on" : "mv-dots__dot"} />
      ))}
    </span>
  );
}
