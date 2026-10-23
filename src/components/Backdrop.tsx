import type { ReactNode } from "react";
import { backdropUrl } from "../net/assets";

export interface BackdropProps {
  layout: "entry" | "game";
  variant: "lobby" | "night" | "day" | "verdict";
  className?: string;
  children?: ReactNode;
}

// 화면 뒤 배경 장면. 그림은 cover 로 채우고 기준은 가운데 위쪽이다. 같은 단계 안에서는 장면을 바꾸지 않는다.
export function Backdrop({ layout, variant, className, children }: BackdropProps) {
  const classes = ["mf-backdrop", `mf-backdrop--${variant}`, className].filter(Boolean).join(" ");
  return (
    <div className={classes}>
      <div
        className="mf-backdrop__art"
        style={{ backgroundImage: `url("${backdropUrl(layout, variant)}")`, backgroundPosition: "center top" }}
        aria-hidden="true"
      />
      {children ? <div className="mf-backdrop__content">{children}</div> : null}
    </div>
  );
}
