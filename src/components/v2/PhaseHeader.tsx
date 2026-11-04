import type { ReactNode } from "react";
import { timerTone } from "../../net/countdown";
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
  /** 시간 링 왼쪽(링이 없으면 오른쪽 끝)에 놓는 버튼 자리. 8페이즈 게임 화면의 [역할 카드] 44×44 (UI-SPEC A2) */
  extra?: ReactNode;
}

const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function PhaseHeader({ title, hint, showHint, guide, time, total, extra }: PhaseHeaderProps) {
  const hasTime = time != null && !!total;
  // 색 규칙은 역할 확인 막대 타이머와 같은 timerTone 하나(feedback-4): 10초 놋쇠, 5초 진홍, 단계가 문턱 이하로 짧으면 그 색 없음
  const tone = hasTime ? timerTone(time * 1000, total * 1000) : "calm";
  const urgent = tone === "urgent";
  const frac = hasTime ? Math.max(0, Math.min(1, time / total)) : 0;
  const ring = hasTime ? (
    <span className={tone === "calm" ? "mv-ring" : `mv-ring is-${tone}`} role="timer" aria-label={`남은 시간 ${time}초`}>
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
  ) : null;
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
      {extra ? (
        <div className="mv-phase__side">
          {extra}
          {ring}
        </div>
      ) : (
        ring
      )}
    </header>
  );
}
