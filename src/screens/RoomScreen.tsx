import { useEffect } from "react";
import type { RemovedReason } from "../../shared/protocol";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { ReconnectBanner } from "../components/ReconnectBanner";
import { useRoomConnection } from "../net/useRoomConnection";
import { Lobby } from "./Lobby";
import { RoleReveal } from "./RoleReveal";
import "../styles/room.css";

// gaveUp: 30초 연결 실패 뒤 [처음으로]. App 은 default 분기로 입장 정보를 지우지 않고 첫 화면으로 간다.
export type ExitReason = RemovedReason | "replaced" | "gaveUp";

interface RoomScreenProps {
  code: string;
  token: string;
  onExit: (reason: ExitReason) => void;
}

// 방 화면 틀: 맨 위 재접속 띠(흐름 안, 본문을 밀어냄) + 본문. 단계 화면은 본문 자리에 붙는다.
export function RoomScreen({ code, token, onExit }: RoomScreenProps) {
  const connection = useRoomConnection(code, token);
  const { status, banner, view, removedReason } = connection;

  // 쫓겨난 이유별 화면은 App 이 고른다(오류 화면·링크 참가 화면).
  useEffect(() => {
    if (status === "removed") onExit(removedReason ?? "room_closed");
  }, [status, removedReason, onExit]);

  // [내 역할] 버튼은 모든 역할·모든 시점에 같은 한 가지 마크업이다(D-19 개정, R14).
  const myRoleButton = (
    <Button variant="secondary" compact icon={<Icon name="card" />}>
      내 역할
    </Button>
  );

  return (
    <div className="mf-root mf-room">
      {view && banner !== "hidden" && <ReconnectBanner mode={banner} />}
      <div className="mf-room__body">{renderBody()}</div>
    </div>
  );

  function renderBody() {
    if (status === "replaced") {
      return (
        <main className="mf-room__notice">
          <h1 className="mf-t-heading">다른 창에서 이 방에 들어갔어요</h1>
          <Button variant="primary" onClick={connection.reconnect}>
            다시 연결
          </Button>
          <Button variant="secondary" onClick={() => onExit("replaced")}>
            처음으로
          </Button>
        </main>
      );
    }

    if (status === "failed") {
      return (
        <main className="mf-room__notice">
          <h1 className="mf-t-heading">연결할 수 없어요</h1>
          <Button variant="primary" onClick={connection.retry}>
            다시 시도
          </Button>
          <Button variant="secondary" onClick={() => onExit("gaveUp")}>
            처음으로
          </Button>
        </main>
      );
    }

    if (!view) {
      return (
        <main className="mf-room__notice">
          <p className="mf-t-body mf-t-muted">연결 중…</p>
        </main>
      );
    }

    switch (view.phase) {
      case "lobby":
        return <Lobby view={view} send={connection.send} />;
      case "roleReveal":
        return (
          <RoleReveal
            view={view}
            offset={connection.offset}
            myRoleButton={myRoleButton}
            onSeenFront={() => {}}
          />
        );
      // 배정·낮 화면은 아래 Task 에서 붙인다.
      case "assigning":
      case "day":
        return <main className="mf-phase" data-phase={view.phase} />;
    }
  }
}
