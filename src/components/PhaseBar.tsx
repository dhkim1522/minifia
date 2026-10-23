import type { ReactNode } from "react";
import "../styles/phase.css";

export interface PhaseBarProps {
  /** 단계 제목(heading) */
  title: string;
  /** 제목 아래 안내(label) */
  instruction: string;
  /** 오른쪽 슬롯. 단계 화면은 [내 역할] 을 넘긴다 */
  extra?: ReactNode;
  /** 아래 줄 타이머 */
  timer?: ReactNode;
}

// 단계 화면 위쪽 바(UI-SPEC S-05 배치): 윗줄 왼쪽 제목 + 안내, 오른쪽 extra, 아랫줄 타이머.
// 참고 구현(bundle.js PhaseBar)의 구조에서 단계 이름 14px · 지금 할 일 16px 를 제목 24px · 안내 14px 로 바꿨다.
export function PhaseBar({ title, instruction, extra, timer }: PhaseBarProps) {
  return (
    <header className="mf-phasebar">
      <div className="mf-phasebar__row">
        <div className="mf-phasebar__text">
          <h1 className="mf-t-heading">{title}</h1>
          <p className="mf-phasebar__do">{instruction}</p>
        </div>
        {extra ? <div className="mf-phasebar__extra">{extra}</div> : null}
      </div>
      {timer}
    </header>
  );
}
