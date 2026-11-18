import type { ReactNode } from "react";
import type { RoomView } from "../../../shared/protocol";
import { hostTimeOf } from "../../game/hostLine";
import { timerTone, useCountdown } from "../../net/countdown";
import { useEarlyCalm } from "../../net/earlyCalm";
import "../../styles/phase-gauge.css";

interface GamePhaseHeaderProps {
  title: string;
  view: RoomView;
  offset: number;
  extra: ReactNode;
  timeless?: boolean;
  tod?: { id: string; word: string | null };
  epoch?: number;
}

export function GamePhaseHeader({ title, view, offset, extra, timeless, tod, epoch }: GamePhaseHeaderProps) {
  const { phaseEndsAt, phaseDurationMs } = view;
  const early = useEarlyCalm(view, epoch);
  const roleReadyTimed = view.playtest === true && view.phase === "roleReveal" && phaseDurationMs !== null && phaseDurationMs >= 3000;
  const hasTime = !timeless && view.phase !== "dayAnnounce" && phaseEndsAt !== null && phaseDurationMs !== null && (roleReadyTimed || hostTimeOf(view));
  return (
    <div className="mf-game-phase-header" data-phase-header="" data-discussion-header={view.phase === "discussion" ? "" : undefined} data-early={early ? "" : undefined}>
      <span className="mv-phase__line" data-tod={tod?.id}>
        {tod?.word ? (
          <>
            <span className="mv-phase__tod">{tod.word}</span>
            <span className="mv-phase__sep" aria-hidden="true">·</span>
          </>
        ) : null}
        <span className="mv-phase__title">{title}</span>
      </span>
      {hasTime ? (
        <PhaseTimeGauge
          key={`${view.round ?? 1}:${view.day?.n ?? 0}:${view.phase}`}
          endsAt={phaseEndsAt}
          duration={phaseDurationMs}
          offset={offset}
          calm={early}
        />
      ) : null}
      <div className="mf-game-phase-header__actions">{extra}</div>
    </div>
  );
}

function PhaseTimeGauge({ endsAt, duration, offset, calm }: { endsAt: number; duration: number; offset: number; calm: boolean }) {
  const { seconds, remainingMs, ratio } = useCountdown(endsAt, duration, offset);
  const tone = calm ? "calm" : timerTone(remainingMs, duration);
  return (
    <span className="mf-phase-gauge" data-phase-gauge="" data-tone={tone} role="timer" aria-label={`남은 시간 ${seconds}초`}>
      <span className="mf-phase-gauge__fill" aria-hidden="true" style={{ transform: `scaleX(${ratio})` }} />
    </span>
  );
}
