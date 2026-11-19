import { useId, type ReactNode } from "react";
import "../styles/phase-event.css";

interface PhaseEventProps {
  kind: string;
  title: string;
  children?: ReactNode;
  className?: string;
  interactive?: boolean;
}

/** 한 단계의 질문·선택 또는 결과를 맵 위에 보여 준다. */
export function PhaseEvent({ kind, title, children, className, interactive = true }: PhaseEventProps) {
  const titleId = useId();
  return (
    <div className={className ? `mf-phase-event ${className}` : "mf-phase-event"} data-phase-event={kind}>
      <section
        className="mf-phase-event__card"
        data-event-interactive={interactive ? "" : undefined}
        role={interactive ? "group" : "status"}
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="mf-phase-event__title">{title}</h2>
        {children}
      </section>
    </div>
  );
}
