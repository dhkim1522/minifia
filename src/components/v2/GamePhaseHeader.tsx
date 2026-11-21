import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { RoomView } from "../../../shared/protocol";
import { hostTimeOf } from "../../game/hostLine";
import { keywordPresentationOf } from "../../game/keywordView";
import { timerTone, useCountdown } from "../../net/countdown";
import type { TimerTone } from "../../net/countdown";
import { useEarlyCalm } from "../../net/earlyCalm";
import { PhaseSkip } from "./PhaseSkip";
import type { PhaseSkipControls } from "./PhaseSkip";
import { useReducedMotion } from "../../net/useReducedMotion";
import "../../styles/phase-gauge.css";

interface GamePhaseHeaderProps {
  title: string;
  view: RoomView;
  offset: number;
  extra: ReactNode;
  timeless?: boolean;
  turnGauge?: ReactNode;
  tod?: { id: string; word: string | null };
  epoch?: number;
  skipControls?: PhaseSkipControls;
}

export function GamePhaseHeader({ title, view, offset, extra, timeless, turnGauge, tod, epoch, skipControls }: GamePhaseHeaderProps) {
  const { phaseEndsAt, phaseDurationMs } = view;
  const early = useEarlyCalm(view, epoch);
  const presentation = keywordPresentationOf(view);
  const roleReadyTimed = view.playtest === true && view.phase === "roleReveal" && phaseDurationMs !== null && phaseDurationMs >= 3000;
  const hasTime = !timeless && phaseEndsAt !== null && phaseDurationMs !== null
    && (presentation !== undefined || (view.phase !== "dayAnnounce" && (roleReadyTimed || hostTimeOf(view))));
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
      {turnGauge ?? (hasTime ? (
        <PhaseTimeGauge
          key={`${view.round ?? 1}:${view.day?.n ?? 0}:${view.phase}:${presentation?.order ?? 0}`}
          endsAt={phaseEndsAt}
          duration={phaseDurationMs}
          offset={offset}
          calm={early}
        />
      ) : null)}
      <div className="mf-game-phase-header__actions">
        {skipControls ? <PhaseSkip view={view} offset={offset} {...skipControls} /> : null}
        {extra}
      </div>
    </div>
  );
}

function PhaseTimeGauge({ endsAt, duration, offset, calm }: { endsAt: number; duration: number; offset: number; calm: boolean }) {
  const { seconds, remainingMs, ratio } = useCountdown(endsAt, duration, offset);
  return <PhaseGauge seconds={seconds} ratio={ratio} tone={calm ? "calm" : timerTone(remainingMs, duration)} clock={{ endsAt, duration, offset }} />;
}

interface GaugeClock {
  endsAt: number;
  duration: number;
  offset: number;
}

export function PhaseGauge({ seconds, ratio, tone, clock }: { seconds: number; ratio: number; tone: TimerTone; clock?: GaugeClock }) {
  const fill = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const { endsAt, duration, offset } = clock ?? {};

  useLayoutEffect(() => {
    const bar = fill.current;
    if (reduced || !bar?.animate || endsAt === undefined || duration === undefined || duration <= 0 || offset === undefined) return;
    let animation: Animation | undefined;
    // React updates the label and color. The browser moves the fill on a single timeline.
    const sync = () => {
      animation?.cancel();
      animation = bar.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], {
        duration,
        delay: endsAt - (Date.now() + offset) - duration,
        easing: "linear",
        fill: "both",
      });
      // Timing corrections and phase changes cancel the preceding animation.
      void animation.finished.catch(() => {});
    };
    const onVisible = () => { if (!document.hidden) sync(); };
    sync();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      animation?.cancel();
    };
  }, [endsAt, duration, offset, reduced]);

  return (
    <span className="mf-phase-gauge" data-phase-gauge="" data-tone={tone} role="timer" aria-label={`남은 시간 ${seconds}초`}>
      <span ref={fill} className="mf-phase-gauge__fill" aria-hidden="true" style={{ transform: `scaleX(${ratio})` }} />
    </span>
  );
}
