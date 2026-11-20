import { useState } from "react";
import type { CSSProperties } from "react";
import type { RoomView } from "../../shared/protocol";
import { PHASE_INTRO_MS } from "../../shared/game/phases";
import { headerFor } from "../game/dayView";
import "../styles/phase-intro.css";

export function PhaseIntro({ view, startsAt, offset, summary }: { view: RoomView; startsAt: number; offset: number; summary?: string | undefined }) {
  const [elapsed] = useState(() => Math.max(0, Date.now() + offset - (startsAt - PHASE_INTRO_MS)));
  const title = view.phase === "roleReveal" ? "역할 확인"
    : view.phase === "dayAnnounce" ? "답안 공개"
    : view.phase === "verdict" && view.day?.firstBallot !== undefined ? "투표"
    : headerFor(view).title;
  const timing = { "--mf-intro-duration": `${PHASE_INTRO_MS}ms`, "--mf-intro-delay": `${-elapsed}ms` } as CSSProperties;
  return (
    <div className="mf-phase-intro" data-phase-intro={view.phase} aria-hidden="true">
      <span className="mf-phase-intro__title" style={timing}>
        <span data-phase-intro-title="">{title}</span>
        {summary !== undefined ? <small className="mf-phase-intro__summary">{summary}</small> : null}
      </span>
    </div>
  );
}
