import { formatMmSs, timerTone, useCountdown } from "../net/countdown";
import "../styles/phase.css";

export interface TimerProps {
  /** 서버 시각 마감 */
  endsAt: number;
  durationMs: number;
  /** 서버 시각 − 로컬 시각 */
  offset: number;
  /** true 면 경고·진홍 색을 쓰지 않는다. 단계 전체가 문턱 이하로 짧을 때의 생략은 timerTone 이 이미 하므로 이 속성은 그 밖의 강제용이다(UI-SPEC 확인 필요 10) */
  calm?: boolean;
}

// 단계 이름을 모르는 공통 타이머. 막대(왼쪽 기준 scaleX) + m:ss 숫자.
// 초마다 읽어 주는 라이브 영역 속성은 두지 않는다(role 이 timer 라 기본이 꺼짐).
export function Timer({ endsAt, durationMs, offset, calm = false }: TimerProps) {
  const { seconds, remainingMs, ratio } = useCountdown(endsAt, durationMs, offset);
  // 색 규칙은 timerTone 하나(feedback-4). calm 이면 경고·urgent 클래스를 붙이지 않는다(숫자 팝 애니메이션도 urgent 클래스와 같이 꺼진다)
  const tone = calm ? "calm" : timerTone(remainingMs, durationMs);
  const classes = ["mf-timer", tone !== "calm" && `mf-timer--${tone}`].filter(Boolean).join(" ");
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
