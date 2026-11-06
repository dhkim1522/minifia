import type { ReactNode, Ref } from "react";
import { emitSignal } from "../audio/signals";

export interface ButtonProps {
  variant?: "primary" | "secondary" | "text";
  block?: boolean;
  compact?: boolean;
  icon?: ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  "aria-label"?: string;
  /** 이름표 단추의 낱말(TOOL-01). 값은 고정 문구뿐이다 — 역할·좌석 값 없음(T-14-16) */
  "data-tool-label"?: string;
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
  "data-tool-label": toolLabel,
  className,
  ref,
  children,
}: ButtonProps) {
  const classes = ["mf-btn", `mf-btn--${variant}`, block && "mf-btn--block", compact && "mf-btn--compact", className]
    .filter(Boolean)
    .join(" ");
  // 주요(primary) 버튼의 클릭만 닫힌 신호 tap 을 보낸다(12-08). 어떤 소리를 낼지·밤에 무음일지는 소리 감독이 정한다. 비활성은 클릭이 오지 않는다
  const handleClick =
    variant === "primary"
      ? () => {
          emitSignal({ kind: "tap" });
          onClick?.();
        }
      : onClick;
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled} onClick={handleClick} aria-label={ariaLabel} data-tool-label={toolLabel}>
      {icon}
      {children}
    </button>
  );
}
