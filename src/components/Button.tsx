import type { ReactNode, Ref } from "react";

export interface ButtonProps {
  variant?: "primary" | "secondary" | "text";
  block?: boolean;
  compact?: boolean;
  icon?: ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  "aria-label"?: string;
  className?: string;
  /** 첫 포커스·측정용(React 19: 함수 부품도 ref 를 prop 으로 받는다) */
  ref?: Ref<HTMLButtonElement>;
  children?: ReactNode;
}

// type 기본값은 "button" 이라 폼 안에서 실수로 제출되지 않는다. 제출 버튼만 type="submit" 을 넘긴다.
export function Button({
  variant = "primary",
  block,
  compact,
  icon,
  type = "button",
  disabled,
  onClick,
  "aria-label": ariaLabel,
  className,
  ref,
  children,
}: ButtonProps) {
  const classes = ["mf-btn", `mf-btn--${variant}`, block && "mf-btn--block", compact && "mf-btn--compact", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled} onClick={onClick} aria-label={ariaLabel}>
      {icon}
      {children}
    </button>
  );
}
