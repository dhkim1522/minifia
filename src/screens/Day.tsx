import type { ReactNode } from "react";
import type { RoomView } from "../../shared/protocol";
import { Backdrop } from "../components/Backdrop";
import "../styles/day.css";
import "../styles/phase.css";

// S-06a 낮 시작 발표(약 2초, 서버 단계 dayAnnounce). 타이머·테이블·행동 버튼이 없다.
// 서버가 약 2초 뒤 직업 공개(claim)로 넘긴다(D-20) — 화면은 스스로 단계를 넘기지 않고 서버 view 만 따른다.
// 일차는 서버가 주는 view.day.n 이다. 아직 싣지 않는 서버(02-04 이전)에서도 깨지지 않게 1 로 읽는다.
export function Day({ view, myRoleButton }: { view: RoomView; myRoleButton: ReactNode }) {
  const n = view.day?.n ?? 1;
  return (
    <Backdrop layout="game" scene="day" className="mf-day__backdrop">
      <main className="mf-root mf-day">
        <div className="mf-day__morning" aria-hidden="true" />
        <div className="mf-day__top">{myRoleButton}</div>
        <div className="mf-day__center">
          <p className="mf-t-heading mf-day__count">{`${n}일차`}</p>
          <h1 className="mf-t-display mf-day__title">낮이 되었습니다</h1>
          <p className="mf-day__sub">토론 전에 먼저 직업을 공개해요</p>
        </div>
      </main>
    </Backdrop>
  );
}
