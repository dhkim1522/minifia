import type { RoomView } from "../../shared/protocol";
import { Backdrop } from "../components/Backdrop";
import { Icon } from "../components/Icon";
import { DayTable } from "../components/DayTable";
import type { DayTableSeat } from "../components/DayTable";
import "../styles/phase.css";

// S-04 역할 배정(약 3초, 서버 단계). 입력도 [내 역할] 도 없고 모든 사람에게 같은 마크업이다(D-12, T-01-44):
// view.me.role·me.allies 는 읽지 않는다. 테이블에는 역할·동료 표시를 넘기지 않는다.
// 결정 0028: 낮·대기실과 같은 DayTable 이 같은 장면 상자(머리 119.2 · 빈 패널 157) 안에 있다 — 단계가 바뀌어도 테이블이 움직이지 않는다.
// 어두운 막·맥박 링·안내 문구는 화면 전체 위에 얹힌다.
export function Assigning({ view }: { view: RoomView }) {
  const seats: DayTableSeat[] = view.players.map((p) => ({
    seat: p.seat,
    nickname: p.nickname,
    connected: p.connected,
    isHost: p.isHost,
    isMe: p.seat === view.me.seat,
    isAlly: false,
  }));

  return (
    <Backdrop layout="game" scene="lobby" className="mf-assign__backdrop">
      <main className="mf-root mf-assign">
        <header className="mf-assign__bar">
          <h1 className="mf-t-heading">역할 배정</h1>
        </header>
        <div className="mf-assign__scene">
          <DayTable seats={seats} mySeat={view.me.seat} />
        </div>
        <div className="mf-assign__panel" />
        <div className="mf-assign__veil" aria-hidden="true" />
        <div className="mf-assign__center">
          <div className="mf-assign__pulse" aria-hidden="true">
            <span className="mf-assign__ring" />
            <span className="mf-assign__ring" />
            <span className="mf-assign__ring" />
            <div className="mf-assign__core">
              <Icon name="card" size={32} />
            </div>
          </div>
          <h2 className="mf-t-heading">직업을 배정하고 있습니다…</h2>
          <p className="mf-t-label">잠시만 기다려 주세요</p>
        </div>
      </main>
    </Backdrop>
  );
}
