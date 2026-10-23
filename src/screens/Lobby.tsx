import type { ClientMessage, RoomView } from "../../shared/protocol";
import { SEAT_COUNT } from "../../shared/seatLayout";
import { connectedCount } from "../../shared/game/room";
import { Backdrop } from "../components/Backdrop";
import { Table } from "../components/Table";
import type { TableSeat } from "../components/Table";
import "../styles/lobby.css";

interface LobbyProps {
  view: RoomView;
  send: (msg: ClientMessage) => void;
  /** 연결이 열려 있어 서버로 보낼 수 있는가. 기본 true */
  canSend?: boolean;
  /** 소켓이 새로 열릴 때마다 바뀌는 번호. 기본 0 */
  epoch?: number;
}

// S-03 대기실: 대기 장면 위 원근 테이블, 위쪽 바(방 코드), 하단 시트.
// 화면은 서버가 보낸 view 만으로 다시 그린다. 닉네임은 React 텍스트·title 로만 그린다.
export function Lobby({ view }: LobbyProps) {
  const allies = view.me.allies ?? [];
  const seats: (TableSeat | null)[] = Array.from({ length: SEAT_COUNT }, () => null);
  for (const p of view.players) {
    seats[p.seat] = {
      nickname: p.nickname,
      connected: p.connected,
      isHost: p.isHost,
      isMe: p.seat === view.me.seat,
      isAlly: allies.includes(p.seat),
    };
  }

  return (
    <Backdrop layout="game" variant="lobby" className="mf-lobby__backdrop">
      <main className="mf-root mf-lobby">
        <header className="mf-lobby__bar">
          <p className="mf-t-label">방 코드</p>
          <p className="mf-lobby__code" aria-label={`방 코드 ${view.code}`}>
            {view.code}
          </p>
        </header>
        <div className="mf-lobby__scene">
          <Table seats={seats} mySeat={view.me.seat} />
        </div>
        <section className="mf-lobby__sheet">
          <div className="mf-lobby__status">
            <p className="mf-lobby__count">{`${connectedCount(view.players)} / ${view.maxPlayers}명`}</p>
          </div>
        </section>
      </main>
    </Backdrop>
  );
}
