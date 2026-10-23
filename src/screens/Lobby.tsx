import { useEffect, useRef, useState } from "react";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { SEAT_COUNT } from "../../shared/seatLayout";
import { connectedCount } from "../../shared/game/room";
import { Backdrop } from "../components/Backdrop";
import { Button } from "../components/Button";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { Icon } from "../components/Icon";
import { Table } from "../components/Table";
import type { TableSeat } from "../components/Table";
import { Toast, useToast } from "../components/Toast";
import { diffRoomViews, toastForDiff } from "../net/roomDiff";
import { useSeatTransitions } from "../net/useSeatTransitions";
import "../styles/lobby.css";
import "../styles/sheet.css";

const START_LOCK_MS = 2000;

interface LobbyProps {
  view: RoomView;
  send: (msg: ClientMessage) => void;
  /** 연결이 열려 있어 서버로 보낼 수 있는가. 기본 true */
  canSend?: boolean;
  /** 소켓이 새로 열릴 때마다 바뀌는 번호. 기본 0 */
  epoch?: number;
  /** [나가기] 확인 뒤 불린다. 방을 나간 결과와 관계없이 첫 화면으로 간다(01-13 의 RoomScreen 이 onExit("left") 를 넘긴다) */
  onLeave?: () => void;
}

// S-03 대기실: 대기 장면 위 원근 테이블, 위쪽 바(방 코드), 하단 시트.
// 화면은 서버가 보낸 view 만으로 다시 그린다. 닉네임은 React 텍스트·title 로만 그린다.
export function Lobby({ view, send, canSend = true, epoch = 0, onLeave }: LobbyProps) {
  // 입장·방장 변경 토스트: 서버가 보낸 스냅샷 두 개의 차이로만 만든다. 처음 열 때·epoch 가 바뀐 직후(재연결)에는
  // 직전 스냅샷을 비워 지난 일을 다시 알리지 않는다.
  const { toast, show } = useToast();
  const prevView = useRef<RoomView | null>(null);
  const prevEpoch = useRef(epoch);
  useEffect(() => {
    if (prevEpoch.current !== epoch) {
      prevEpoch.current = epoch;
      prevView.current = null;
    }
    const text = toastForDiff(diffRoomViews(prevView.current, view));
    prevView.current = view;
    if (text) show(text);
  }, [view, epoch, show]);

  const seated = useSeatTransitions(view.players, epoch);

  // 열려 있는 시트. 화면이 기억하는 상태는 이것과 [게임 시작] 잠금뿐이다.
  const [sheet, setSheet] = useState<"leave" | null>(null);
  const closeSheet = () => setSheet(null);

  // [게임 시작] 2초 잠금 — 화면이 기억하는 상태는 이것뿐이다. 시작이 거절되면 서버가 다시 보낸 view 대로 그린다.
  const [locked, setLocked] = useState(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      if (lockTimer.current !== undefined) clearTimeout(lockTimer.current);
    },
    [],
  );

  const connected = connectedCount(view.players);
  const isHost = view.me.isHost;
  const hostConnected = view.players.find((p) => p.isHost)?.connected !== false;
  const full = view.players.length >= view.maxPlayers;
  // 서버 checkStart 와 같은 기준(연결된 사람 수)을 쓴다. 버튼 활성은 표시용이고 판정은 서버가 한다.
  const enoughPlayers = connected >= view.minPlayers;
  const guide = isHost
    ? enoughPlayers
      ? "모두 모였으면 시작하세요"
      : `${view.minPlayers}명부터 시작할 수 있어요`
    : hostConnected
      ? "방장이 시작하길 기다리는 중이에요"
      : "방장 연결을 기다리는 중이에요";
  const countText = full ? `${view.maxPlayers} / ${view.maxPlayers}명 · 가득 찼어요` : `${connected} / ${view.maxPlayers}명`;

  const start = () => {
    if (!canSend || locked || !enoughPlayers) return;
    send({ t: "start" });
    setLocked(true);
    lockTimer.current = setTimeout(() => {
      lockTimer.current = undefined;
      setLocked(false);
    }, START_LOCK_MS);
  };

  const allies = view.me.allies ?? [];
  const seats: (TableSeat | null)[] = Array.from({ length: SEAT_COUNT }, () => null);
  for (const p of seated) {
    seats[p.seat] = {
      transition: p.transition,
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
          <Button
            variant="secondary"
            compact
            className="mf-iconbtn mf-lobby__bar-left"
            aria-label="나가기"
            icon={<Icon name="back" />}
            disabled={!canSend}
            onClick={() => setSheet("leave")}
          />
          <div className="mf-lobby__bar-center">
            <p className="mf-t-label">방 코드</p>
            <p className="mf-lobby__code" aria-label={`방 코드 ${view.code}`}>
              {view.code}
            </p>
          </div>
        </header>
        <div className="mf-lobby__scene">
          <Table seats={seats} mySeat={view.me.seat} />
        </div>
        <section className="mf-lobby__sheet">
          <div className="mf-lobby__status">
            <p className="mf-lobby__guide">{guide}</p>
            <p className="mf-lobby__count">{countText}</p>
          </div>
          {isHost ? (
            <Button variant="primary" block disabled={!enoughPlayers || !canSend || locked} onClick={start}>
              게임 시작
            </Button>
          ) : null}
        </section>
      </main>
      <Toast toast={toast} placement="top" />
      {sheet === "leave" ? (
        <ConfirmSheet
          title="방에서 나갈까요?"
          confirmLabel="나가기"
          onConfirm={() => {
            send({ t: "leave" });
            onLeave?.();
          }}
          onClose={closeSheet}
        />
      ) : null}
    </Backdrop>
  );
}
