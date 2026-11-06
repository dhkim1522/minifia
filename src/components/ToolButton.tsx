import type { ReactElement, ReactNode, Ref } from "react";
import "../styles/v2.css";

export interface ToolButtonProps {
  /** 아이콘 아래 보이는 한 단어(3자 이하, 고정 문구). data-tool-label 과 접근성 이름의 바탕이 된다 */
  word: string;
  icon: ReactNode;
  /** 접근성 이름. 없으면 word. 있으면 word 를 포함해야 한다(WCAG 2.5.3 — 예: "내 역할, 새 기록") */
  name?: string;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
}

// 14페이즈 TOOL-01: 머리(헤더)의 아이콘 단추 — 면 36(night-800, gray-700 테두리) 위 + 4 + 라벨 아래. 모양은 .mv-tool(v2.css) 한 곳이다.
// 막힌 단추(disabled)도 라벨은 보이고 불투명도만 낮다(UI#10 partial). 사용자 문자열은 들어가지 않는다.
export function ToolButton({ word, icon, name, disabled, onClick, className, ref }: ToolButtonProps): ReactElement {
  const cls = ["mv-tool", "mv-tool--head", className].filter(Boolean).join(" ");
  return (
    <button ref={ref} type="button" className={cls} aria-label={name ?? word} data-tool-label={word} disabled={disabled} onClick={onClick}>
      <span className="mv-tool__face">{icon}</span>
      <span className="mv-tool__label">{word}</span>
    </button>
  );
}
