import { useEffect } from "react";
import type { RemovedReason, RoomView } from "../../shared/protocol";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { ReconnectBanner } from "../components/ReconnectBanner";
import { preloadRoleAssets } from "../net/assets";
import { useRoomConnection } from "../net/useRoomConnection";
import { Assigning } from "./Assigning";
import { Day } from "./Day";
import { Lobby } from "./Lobby";
import { RoleReveal } from "./RoleReveal";
import "../styles/phase.css";
import "../styles/room.css";

// gaveUp: 30초 연결 실패 뒤 [처음으로]. App 은 default 분기로 입장 정보를 지우지 않고 첫 화면으로 간다.
export type ExitReason = RemovedReason | "replaced" | "gaveUp";

interface RoomScreenProps {
  code: string;
  token: string;
  onExit: (reason: ExitReason) => void;
}

// 단계가 바뀔 때만 보이지 않는 aria-live 영역이 읽는 문구. 대기실은 읽을 것이 없다.
const PHASE_ANNOUNCE = {
  lobby: "",
  assigning: "직업을 배정하고 있습니다",
  roleReveal: "역할 확인",
  day: "낮이 되었습니다",
} as const;

// 방 화면 틀: 맨 위 재접속 띠(흐름 안, 본문을 밀어냄) + 본문. 단계 화면은 본문 자리에 붙는다.
export function RoomScreen({ code, token, onExit }: RoomScreenProps) {
  const connection = useRoomConnection(code, token);
  const { status, banner, view, removedReason } = connection;

  // 대기실·배정 동안 직업 그림 4종 전부와 낮 배경을 미리 받아 둔다.
  // 어떤 역할인지와 무관하게 같은 요청 패턴이다(Pattern 13 ②, Pitfall 20).
  const phase = view?.phase;
  useEffect(() => {
    if (phase === "lobby" || phase === "assigning") preloadRoleAssets();
  }, [phase]);

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
      {view && (
        <p className="mf-sr-only" aria-live="polite">
          {PHASE_ANNOUNCE[view.phase]}
        </p>
      )}
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

    // 화면은 서버가 정한 단계만 따른다. key 가 단계라 단계가 바뀔 때만 새로 나타난다(phase-enter 300ms).
    return (
      <div key={view.phase} className="mf-phase-enter">
        {renderPhase(view)}
      </div>
    );
  }

  function renderPhase(view: RoomView) {
    switch (view.phase) {
      case "lobby":
        return (
          <Lobby
            view={view}
            send={connection.send}
            canSend={connection.canSend}
            epoch={connection.epoch}
            onLeave={() => onExit("left")}
          />
        );
      case "assigning":
        return <Assigning view={view} />;
      case "roleReveal":
        return (
          <RoleReveal view={view} offset={connection.offset} myRoleButton={myRoleButton} onSeenFront={() => {}} />
        );
      case "day":
        return <Day myRoleButton={myRoleButton} />;
    }
  }
}
