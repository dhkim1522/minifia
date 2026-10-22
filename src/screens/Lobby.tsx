import type { ClientMessage, RoomView } from "../../shared/protocol";

interface LobbyProps {
  view: RoomView;
  send: (msg: ClientMessage) => void;
}

// 2.5D 테이블은 01-06 이 이 파일을 교체한다. 닉네임은 React 텍스트로만 그린다.
export function Lobby({ view }: LobbyProps) {
  return (
    <main className="screen lobby">
      <p className="lobby-code-label">방 코드</p>
      <p className="lobby-code" aria-label={`방 코드 ${view.code}`}>
        {view.code}
      </p>
      <p className="lobby-count">
        {view.players.length}/{view.maxPlayers}명
      </p>
      <ul className="lobby-players">
        {view.players.map((p) => (
          <li key={p.seat} className={p.connected ? "lobby-player" : "lobby-player is-away"}>
            <span className="lobby-player-name">{p.nickname}</span>
            {p.isHost && <span className="lobby-host">방장</span>}
            {!p.connected && <span className="lobby-away">(연결 끊김)</span>}
          </li>
        ))}
      </ul>
    </main>
  );
}
