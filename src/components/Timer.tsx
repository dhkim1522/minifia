import { formatMmSs, useCountdown } from "../net/countdown";
import "../styles/phase.css";

export interface TimerProps {
  /** 서버 시각 마감 */
  endsAt: number;
  durationMs: number;
  /** 서버 시각 − 로컬 시각 */
  offset: number;
}

// 단계 이름을 모르는 공통 타이머. 막대(왼쪽 기준 scaleX) + m:ss 숫자.
// 초마다 읽어 주는 라이브 영역 속성은 두지 않는다(role 이 timer 라 기본이 꺼짐).
export function Timer({ endsAt, durationMs, offset }: TimerProps) {
  const { seconds, urgent, ratio } = useCountdown(endsAt, durationMs, offset);
  const classes = ["mf-timer", urgent && "mf-timer--urgent"].filter(Boolean).join(" ");
  return (
    <div className={classes} role="timer" aria-label={`남은 시간 ${seconds}초`}>
      <div className="mf-timer__track">
        <div className="mf-timer__fill" style={{ transform: `scaleX(${ratio})` }} />
      </div>
      {/* key 가 초라서 초가 바뀔 때마다 새 요소가 되어 timer-pop 이 다시 돈다 */}
      <span key={seconds} className="mf-timer__num" aria-hidden="true">
        {formatMmSs(seconds)}
      </span>
    </div>
  );
}
