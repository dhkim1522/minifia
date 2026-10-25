import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { SEAT_COUNT } from "../../shared/seatLayout";
import { connectedCount } from "../../shared/game/room";
import { Backdrop } from "../components/Backdrop";
import { Button } from "../components/Button";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { Icon } from "../components/Icon";
import { ShareSheet } from "../components/ShareSheet";
import { Table } from "../components/Table";
import type { TableSeat } from "../components/Table";
import { Toast, useToast } from "../components/Toast";
import { diffRoomViews, toastForDiff } from "../net/roomDiff";
import { useSeatTransitions } from "../net/useSeatTransitions";
import "../styles/lobby.css";
import "../styles/sheet.css";
import "../styles/testtools.css";

const START_LOCK_MS = 2000;

interface LobbyProps {
  view: RoomView;
  /** 보냈으면 true, 소켓이 닫혀 못 보냈으면 false. 반환값이 없는 함수(void)는 보낸 것으로 본다 */
  send: (msg: ClientMessage) => boolean | void;
  /** 연결이 열려 있어 서버로 보낼 수 있는가. 기본 true */
  canSend?: boolean;
  /** 소켓이 새로 열릴 때마다 바뀌는 번호. 기본 0 */
  epoch?: number;
  /** [나가기] 확인 뒤 불린다. 방을 나간 결과와 관계없이 첫 화면으로 간다(01-13 의 RoomScreen 이 onExit("left") 를 넘긴다) */
  onLeave?: () => void;
  /** 테스트 방 방장의 [테스트] 버튼(결정 0022). 있으면 장면 상자 왼쪽 위에 놓는다 */
  testButton?: ReactNode;
}

// S-03 대기실: 대기 장면 위 원근 테이블, 위쪽 바(방 코드), 하단 시트.
// 화면은 서버가 보낸 view 만으로 다시 그린다. 닉네임은 React 텍스트·title 로만 그린다.
export function Lobby({ view, send, canSend = true, epoch = 0, onLeave, testButton }: LobbyProps) {
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
  // 내보내기는 누른 시점의 닉네임을 같이 들고 있어 그사이 view 가 바뀌어도 제목이 흔들리지 않는다.
  const [sheet, setSheet] = useState<{ kind: "leave" } | { kind: "share" } | { kind: "kick"; seat: number; nickname: string } | null>(null);
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
  const host = view.players.find((p) => p.isHost);
  const hostConnected = host?.connected !== false;
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
      // 방장이 끊긴 다른 사람 자리만 누를 수 있다(D-16). 판정은 서버가 다시 한다(kickPlayer).
      pressable: isHost && canSend && !p.connected && p.seat !== view.me.seat && p.transition !== "leaving",
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
            onClick={() => setSheet({ kind: "leave" })}
          />
          <div className="mf-lobby__bar-center">
            <p className="mf-t-label">방 코드</p>
            <p className="mf-lobby__code" aria-label={`방 코드 ${view.code}`}>
              {view.code}
            </p>
          </div>
          {view.code ? (
            <Button
              variant="secondary"
              compact
              className="mf-iconbtn mf-lobby__bar-right"
              aria-label="공유"
              icon={<Icon name="share" />}
              onClick={() => setSheet({ kind: "share" })}
            />
          ) : null}
        </header>
        <div className="mf-lobby__scene">
          {testButton ? <div className="mf-tt-anchor">{testButton}</div> : null}
          <Table
            seats={seats}
            mySeat={view.me.seat}
            onSeatPress={(seat) => {
              const target = view.players.find((p) => p.seat === seat);
              if (target) setSheet({ kind: "kick", seat, nickname: target.nickname });
            }}
          />
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
          ) : (
            <div className="mf-lobby__resend">
              <p className="mf-lobby__resend-text">친구가 더 오면 링크를 다시 보낼 수 있어요</p>
              <Button variant="secondary" block icon={<Icon name="share" />} onClick={() => setSheet({ kind: "share" })}>
                링크 공유
              </Button>
            </div>
          )}
        </section>
      </main>
      <Toast toast={toast} placement="top" />
      {sheet?.kind === "leave" ? (
        <ConfirmSheet
          title="방에서 나갈까요?"
          confirmLabel="나가기"
          confirmDisabled={!canSend}
          onConfirm={() => {
            // leave 가 서버에 닿지 않았는데 입장 정보를 지우면 자리만 유령으로 남는다. 보냈을 때만 나간다.
            if (send({ t: "leave" }) === false) show("연결이 불안정해요. 다시 시도해 주세요");
            else onLeave?.();
          }}
          onClose={closeSheet}
        />
      ) : null}
      {sheet?.kind === "kick" ? (
        <ConfirmSheet
          title={`${sheet.nickname}님을 내보낼까요?`}
          confirmLabel="내보내기"
          confirmDisabled={!canSend}
          onConfirm={() => send({ t: "kick", seat: sheet.seat })}
          onClose={closeSheet}
        />
      ) : null}
      {sheet?.kind === "share" ? (
        <ShareSheet code={view.code} hostNickname={host?.nickname ?? ""} full={full} onClose={closeSheet} />
      ) : null}
    </Backdrop>
  );
}
