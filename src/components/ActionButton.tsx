import { Children } from "react";
import type { MouseEventHandler, ReactNode } from "react";
import "../styles/v2.css";
import { DotProgress } from "./v2/DotProgress";
import { V2Icon } from "./v2/V2Icon";
import type { V2IconName } from "./v2/V2Icon";

// 단계 버튼(승인 보드 Main.dc.html 의 act())과 행동 줄. 부품이 아니라 보드의 인라인 규칙이라 v2/ 밖에 둔다.
// 높이 52·반경 14·테두리 1px·글자 16px 700·안쪽 0 12px·아이콘 22px + 라벨 + 점(간격 8)은 v2.css 의 .mf-act 가 정한다.
//
// 세 모양
//   primary  — gray-100 면·night-900 글자. 눌러서 진행하는 버튼([시작])
//   inactive — night-700 면·gray-100 글자·night-600 테두리·불투명도 0.45·aria-disabled.
//              disabled 속성이 아니라서 눌림은 부르는 쪽에 전달된다(왜 못 하는지 알려 줄 수 있다)
//   flat     — 투명·gray-300·disabled. 손님의 "방장을 기다리는 중…" 같은 평평한 비활성

export type ActionVariant = "primary" | "inactive" | "flat";

export interface ActionButtonProps {
  variant: ActionVariant;
  label: string;
  icon?: V2IconName;
  /** 라벨 뒤 점 진행. 예: 시작 + 모인 사람 수 */
  dots?: { count: number; total: number };
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** 읽어 주는 이름이 라벨과 다를 때. 예: "게임 시작, 5명 모임" */
  "aria-label"?: string;
}

export function ActionButton({ variant, label, icon, dots, onClick, "aria-label": ariaLabel }: ActionButtonProps) {
  return (
    <button
      type="button"
      className={`mf-act mf-act--${variant}`}
      aria-label={ariaLabel ?? label}
      aria-disabled={variant === "inactive" ? "true" : undefined}
      disabled={variant === "flat"}
      onClick={onClick}
    >
      {icon ? <V2Icon name={icon} size={22} /> : null}
      <span className="mf-act__label">{label}</span>
      {dots ? <DotProgress count={dots.count} total={dots.total} label={label} /> : null}
    </button>
  );
}

export interface ActionRowProps {
  children: ReactNode;
  /** 줄을 읽어 주는 이름. 기본 "행동" */
  label?: string;
}

// 자식 수 n 으로 repeat(n, minmax(0, 1fr)) — 버튼이 한 칸이어도 두 칸이어도 폭이 칸 안에서 줄어든다(minmax 0).
export function ActionRow({ children, label = "행동" }: ActionRowProps) {
  const n = Math.max(1, Children.toArray(children).length);
  return (
    <div className="mf-act-row" role="group" aria-label={label} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      {children}
    </div>
  );
}
