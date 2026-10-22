import { useEffect } from "react";
import type { RemovedReason } from "../../shared/protocol";
import { useRoomConnection } from "../net/useRoomConnection";
import { Lobby } from "./Lobby";

export type ExitReason = RemovedReason | "replaced";

interface RoomScreenProps {
  code: string;
  token: string;
  onExit: (reason: ExitReason) => void;
}

export function RoomScreen({ code, token, onExit }: RoomScreenProps) {
  const connection = useRoomConnection(code, token);
  const { status, view, removedReason } = connection;

  // 쫓겨난 이유별 화면은 01-05 가 붙인다. 이 계획의 App 은 어떤 이유든 처음 화면으로 돌아간다.
  useEffect(() => {
    if (status === "removed") onExit(removedReason ?? "room_closed");
  }, [status, removedReason, onExit]);

  if (status === "replaced") {
    return (
      <main className="screen notice">
        <p className="notice-text">다른 창에서 이 방에 들어갔어요</p>
        <button className="btn btn-primary" type="button" onClick={connection.reconnect}>
          다시 연결
        </button>
        <button className="btn" type="button" onClick={() => onExit("replaced")}>
          처음으로
        </button>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="screen notice">
        <p className="notice-text">연결 중…</p>
      </main>
    );
  }

  switch (view.phase) {
    case "lobby":
      return <Lobby view={view} send={connection.send} />;
    // 아래 단계 화면은 01-09 가 붙일 자리다.
    case "assigning":
    case "roleReveal":
    case "day":
      return <main className="screen" data-phase={view.phase} />;
  }
}
