import type { ReactNode } from "react";
import { Backdrop } from "../components/Backdrop";
import "../styles/phase.css";

// S-06 낮 시작 발표(1페이즈의 끝). 타이머·테이블·행동 버튼이 없고 이 화면에서 멈추는 것이 정상이다(D-02).
// "1일차" 는 1페이즈 고정 문구다 — 일차 번호는 낮이 반복되는 페이즈가 view 에 더한다.
export function Day({ myRoleButton }: { myRoleButton: ReactNode }) {
  return (
    <Backdrop layout="game" variant="day" className="mf-day__backdrop">
      <main className="mf-root mf-day">
        <div className="mf-day__morning" aria-hidden="true" />
        <div className="mf-day__top">{myRoleButton}</div>
        <div className="mf-day__center">
          <p className="mf-t-heading mf-day__count">1일차</p>
          <h1 className="mf-t-display mf-day__title">낮이 되었습니다</h1>
        </div>
      </main>
    </Backdrop>
  );
}
