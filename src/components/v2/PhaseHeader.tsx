import "../../styles/v2.css";

// 단계 머리: 단계 이름 + 접히는 안내 한 줄(+ 시간 링). design/v2.0/design-system/components/bundle.js :59 를 React 19 로 옮겼다.
// 시간 링은 time·total 이 둘 다 있을 때만 그린다. 이 페이즈의 로비는 링을 쓰지 않는다 — 마크업은 원문대로 옮겨 둔다(결정 0051-5).

export interface PhaseHeaderProps {
  title: string;
  hint?: string;
  /** 단계 시작 뒤 잠깐만 true. false 면 안내가 접힌다(모션 줄이기면 전환 없이) */
  showHint?: boolean;
  /** 참이면 안내 줄이 그 화면의 "지금 할 일 한 문장"(UX-01 data-guide 계약, 화면당 하나) */
  guide?: boolean;
  /** 남은 초 */
  time?: number;
  /** 단계 전체 초. 있어야 링을 그린다 */
  total?: number;
}

const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const URGENT_SECONDS = 5;

export function PhaseHeader({ title, hint, showHint, guide, time, total }: PhaseHeaderProps) {
  const hasTime = time != null && !!total;
  const urgent = hasTime && time <= URGENT_SECONDS;
  const frac = hasTime ? Math.max(0, Math.min(1, time / total)) : 0;
  return (
    <header className="mv-phase">
      <div className="mv-phase__text">
        <span className="mv-phase__title">{title}</span>
        {hint ? (
          <span className={showHint === false ? "mv-phase__hint is-folded" : "mv-phase__hint"} {...(guide ? { "data-guide": "" } : {})}>
            {hint}
          </span>
        ) : null}
      </div>
      {hasTime ? (
        <span className={urgent ? "mv-ring is-urgent" : "mv-ring"} role="timer" aria-label={`남은 시간 ${time}초`}>
          <svg width={44} height={44} viewBox="0 0 44 44" aria-hidden="true">
            <circle cx={22} cy={22} r={RADIUS} className="mv-ring__track" />
            <circle
              cx={22}
              cy={22}
              r={RADIUS}
              className="mv-ring__bar"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - frac)}
              transform="rotate(-90 22 22)"
            />
          </svg>
          {urgent ? <span className="mv-ring__num">{time}</span> : null}
        </span>
      ) : null}
    </header>
  );
}
