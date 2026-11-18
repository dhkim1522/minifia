import type { ReactNode } from "react";
import type { RoomView } from "../../../shared/protocol";
import { useCountdown } from "../../net/countdown";

interface PlaytestHeaderProps {
  title: string;
  view: RoomView;
  offset: number;
  extra: ReactNode;
  timeless?: boolean;
}

export function PlaytestHeader({ title, view, offset, extra, timeless }: PlaytestHeaderProps) {
  const { phaseEndsAt, phaseDurationMs } = view;
  return (
    <div className="mf-playtest__header" data-playtest-header="">
      <span className="mv-phase__title">{title}</span>
      {!timeless && phaseEndsAt !== null && phaseDurationMs !== null ? <PlaytestTimer endsAt={phaseEndsAt} duration={phaseDurationMs} offset={offset} /> : <span />}
      <div className="mf-playtest__header-actions">{extra}</div>
    </div>
  );
}

function PlaytestTimer({ endsAt, duration, offset }: { endsAt: number; duration: number; offset: number }) {
  const { seconds } = useCountdown(endsAt, duration, offset);
  return <span className="mf-playtest__timer" data-playtest-timer="" role="timer" aria-label={`남은 시간 ${seconds}초`}><b>{seconds}</b>초</span>;
}
