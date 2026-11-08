import type { ReactElement, ReactNode, Ref } from "react";
import "../styles/v2.css";

export interface ToolButtonProps {
  /** 접근성 이름(필수, 고정 문구 — 역할·좌석 값 없음). 아이콘 단추라 글은 없고 이름은 aria-label 이 맡는다 */
  name: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  /** 빛남(15-07): 이면 is-call 과 data-call(값 없는 표식). 지금 눌러야 할 단추 하나에만 */
  call?: boolean;
  /** 열고 닫는 카드를 여는 단추면 열림 여부(aria-expanded). 없으면 속성 없음 */
  expanded?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

// 머리(헤더)의 아이콘 단추 — 면(night-800, gray-700 테두리) 하나뿐이고 글은 없다. 이름은 aria-label(16페이즈 TOOL-04, 이름표는 결정 0077·0079 로 없앴다).
// 모양은 .mv-tool(v2.css) 한 곳이다. 막힌 단추(disabled)도 이름은 남고 불투명도만 낮다. 사용자 문자열은 들어가지 않는다.
export function ToolButton({ name, icon, disabled, onClick, className, call, expanded, ref }: ToolButtonProps): ReactElement {
  const cls = ["mv-tool", "mv-tool--head", call === true && "is-call", className].filter(Boolean).join(" ");
  return (
    <button
      ref={ref}
      type="button"
      className={cls}
      aria-label={name}
      aria-expanded={expanded}
      data-call={call === true ? "" : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="mv-tool__face">{icon}</span>
    </button>
  );
}
