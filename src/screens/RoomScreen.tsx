import { useCallback, useEffect, useState } from "react";
import { isAlive } from "../../shared/game/alive";
import type { PhaseId, RemovedReason, RoomView } from "../../shared/protocol";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { MyRoleSheet } from "../components/MyRoleSheet";
import { ReconnectBanner } from "../components/ReconnectBanner";
import { preloadRoleAssets } from "../net/assets";
import { useRoomConnection } from "../net/useRoomConnection";
import { Assigning } from "./Assigning";
import { Day } from "./Day";
import { DayScene } from "./DayScene";
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
const PHASE_ANNOUNCE: Record<PhaseId, (view: RoomView) => string> = {
  lobby: () => "",
  assigning: () => "직업을 배정하고 있습니다",
  roleReveal: () => "역할 확인",
  dayAnnounce: (view) => `${view.day?.n ?? 1}일차 낮이 되었습니다`,
  claim: () => "직업 공개. 주장할 직업을 고르세요",
  claimReveal: () => "직업이 공개되었습니다",
  discussion: () => "낮 토론",
  night: nightAnnounce,
  morning: () => "", // 03-10 이 카드 제목까지 붙인다
};

// 밤 안내: "{N}일차 밤. " 뒤에 내 처지에 맞는 한 줄. 탈락한 사람은 역할과 무관하게 관전 문구다(결정 0021).
function nightAnnounce(view: RoomView): string {
  const head = `${view.day?.n ?? 1}일차 밤. `;
  const me = view.players.find((p) => p.seat === view.me.seat);
  if (me && !isAlive(me)) return `${head}탈락했어요, 관전 중`;
  switch (view.me.role) {
    case "mafia":
      return `${head}함께 지목하세요`;
    case "police":
      return `${head}조사할 사람을 고르세요`;
    case "doctor":
      return `${head}지킬 사람을 고르세요`;
    default:
      return `${head}밤이 되었어요`;
  }
}

// 장면 키: 낮 세 단계와 밤·아침은 같은 장면(DayScene)이라 같은 키를 쓴다 — 테이블을 다시 마운트하지 않는다(UI-SPEC C5).
// 래퍼와 장면은 장면에 들어올 때만 mf-phase-enter 가 돈다. 그 밖은 단계 이름이 키다.
function sceneKey(phase: PhaseId): string {
  return phase === "claim" || phase === "claimReveal" || phase === "discussion" || phase === "night" || phase === "morning"
    ? "dayScene"
    : phase;
}

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

  // [내 역할] 시트 열림과 "카드가 앞면이 된 적이 있는가" 는 단계 switch 밖에서 쥔다 —
  // 단계 화면이 바뀌어도 시트가 살아 있어야 한다(Pitfall 19 ⑧, UI-SPEC E14 phase-change).
  const [myRoleOpen, setMyRoleOpen] = useState(false);
  const [seenFront, setSeenFront] = useState(false);
  const onSeenFront = useCallback(() => setSeenFront(true), []);
  // 새 판(대기실·배정)으로 돌아가면 앞면을 본 적 없는 상태로 되돌리고 시트를 닫는다.
  useEffect(() => {
    if (phase === "lobby" || phase === "assigning") {
      setSeenFront(false);
      setMyRoleOpen(false);
    }
  }, [phase]);

  // 쫓겨난 이유별 화면은 App 이 고른다(오류 화면·링크 참가 화면).
  useEffect(() => {
    if (status === "removed") onExit(removedReason ?? "room_closed");
  }, [status, removedReason, onExit]);

  // [내 역할] 버튼은 모든 역할·모든 시점에 같은 한 가지 마크업이다(D-19 개정, R14).
  const myRoleButton = (
    <Button variant="secondary" compact icon={<Icon name="card" />} onClick={() => setMyRoleOpen(true)}>
      내 역할
    </Button>
  );

  return (
    <div className="mf-root mf-room">
      {view && banner !== "hidden" && <ReconnectBanner mode={banner} />}
      <div className="mf-room__body">{renderBody()}</div>
      {view && myRoleOpen ? (
        // 역할 확인에서 앞면을 본 적이 없을 때만 뒷면. 낮부터는 항상 앞면 내용이다(D-19 의 취지).
        <MyRoleSheet view={view} showBack={view.phase === "roleReveal" && !seenFront} onClose={() => setMyRoleOpen(false)} />
      ) : null}
      {view && (
        <p className="mf-sr-only" aria-live="polite">
          {PHASE_ANNOUNCE[view.phase]?.(view) ?? ""}
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

    if (!view) return connecting();

    // 화면은 서버가 정한 단계만 따른다. key 가 장면이라 장면이 바뀔 때만 새로 나타난다(phase-enter 300ms).
    return (
      <div key={sceneKey(view.phase)} className="mf-phase-enter">
        {renderPhase(view)}
      </div>
    );
  }

  // 서버 연결 전이거나 이 번들이 모르는 단계 이름을 받았을 때(옛 번들, RESEARCH A6) 같은 안내 화면이다.
  function connecting() {
    return (
      <main className="mf-room__notice">
        <p className="mf-t-body mf-t-muted">연결 중…</p>
      </main>
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
          <RoleReveal view={view} offset={connection.offset} myRoleButton={myRoleButton} onSeenFront={onSeenFront} />
        );
      case "dayAnnounce":
        return <Day view={view} myRoleButton={myRoleButton} />;
      case "claim":
      case "claimReveal":
      case "discussion":
      case "night":
      case "morning":
        return <DayScene view={view} connection={connection} myRoleButton={myRoleButton} />;
      default:
        return connecting();
    }
  }
}
