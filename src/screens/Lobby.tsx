import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ClientMessage, MapChoice, RoomView } from "../../shared/protocol";
import { PLAYABLE_MAPS } from "../../shared/game/maps";
import { connectedCount } from "../../shared/game/room";
import { ActionButton, ActionRow } from "../components/ActionButton";
import { BotSheet } from "../components/BotSheet";
import { ToolButton } from "../components/ToolButton";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { Icon } from "../components/Icon";
import { ShareSheet } from "../components/ShareSheet";
import { ChatPanel } from "../components/v2/ChatPanel";
import { DressSheet } from "../components/v2/DressSheet";
import { FloatAction, FloatActions } from "../components/v2/FloatAction";
import { MapChip } from "../components/v2/MapChip";
import { PhaseHeader } from "../components/v2/PhaseHeader";
import { TopToast, useTopToast } from "../components/v2/TopToast";
import { WorldStage } from "../components/WorldStage";
import type { ChatStore } from "../net/chatStore";
import { CHAT_TEXT } from "../game/chatText";
import { DRESS_TEXT } from "../game/dressText";
import { callTargetsOf } from "../game/hostLine";
import { LOG_H_KB } from "../game/chatUi";
import { diffRoomViews, toastForDiff } from "../net/roomDiff";
import { useChat } from "../net/useChat";
import { useDress } from "../net/useDress";
import { useMyMotion } from "../net/useMyMotion";
import { useMapInsets } from "../net/useMapInsets";
import type { WorldStore } from "../world/store";
import "../styles/game.css";
import "../styles/lobby.css";
import "../styles/sheet.css";
import "../styles/testtools.css";

const START_LOCK_MS = 2000;

interface LobbyProps {
  view: RoomView;
  /** RoomScreen 이 연결과 같은 수명으로 만들어 world 프레임을 먹이는 위치 스토어 */
  store: WorldStore;
  /** RoomScreen 이 연결과 같은 수명으로 만들어 채팅 프레임을 먹이는 채팅 저장소 */
  chat: ChatStore;
  /** 보냈으면 true, 소켓이 닫혀 못 보냈으면 false. 반환값이 없는 함수(void)는 보낸 것으로 본다 */
  send: (msg: ClientMessage) => boolean | void;
  /** 연결이 열려 있어 서버로 보낼 수 있는가. 기본 true */
  canSend?: boolean;
  /** 소켓이 새로 열릴 때마다 바뀌는 번호. 기본 0 */
  epoch?: number;
  /** 서버시각 − 로컬시각(ms). 위치를 서버 시각으로 읽는 데 쓴다 */
  offset?: number;
  /** 재접속 띠가 떠 있는가. 떠 있는 동안은 입장·방장 알림을 띄우지 않는다(UI-SPEC 화면 틀) */
  bannerVisible?: boolean;
  /** 게임이 시작되어 로비를 떠나는 중. 맵을 night-900 으로 덮고 자원을 해제한다 */
  exiting?: boolean;
  /** [나가기] 확인 뒤 불린다. 방을 나간 결과와 관계없이 첫 화면으로 간다(01-13 의 RoomScreen 이 onExit("left") 를 넘긴다) */
  onLeave?: () => void;
  /** 테스트 방 방장의 [테스트] 버튼(결정 0022). 있으면 헤더 아래 왼쪽에 놓는다 */
  testButton?: ReactNode;
}

// S-03 대기실(06-15, 07-13): 지하 재즈 바 맵(WorldStage) 위에 승인 로비 틀을 얹는다 — 위쪽 가림막, 헤더([나가기]·PhaseHeader "대기실"·[공유]),
// 위 알림(TopToast), 아래 패널의 채팅 기록 + 입력줄 + 행동 줄 하나. 방 코드는 공유 시트 안에서만 보인다. 읽을 글은 "대기실" 과 접히는 한 줄뿐이다(3초 규칙).
// 화면은 서버가 보낸 view 만으로 다시 그린다. 닉네임(이름표)은 WorldStage 가 React 텍스트 노드로만 그린다.
export function Lobby({ view, store, chat, send, canSend = true, epoch = 0, offset = 0, bannerVisible = false, exiting = false, onLeave, testButton }: LobbyProps) {
  // 입장·퇴장·방장 변경 알림: 서버가 보낸 스냅샷 두 개의 차이로만 만든다. 처음 열 때·epoch 가 바뀐 직후(재연결)에는
  // 직전 스냅샷을 비워 지난 일을 다시 알리지 않는다. 재접속 띠가 떠 있는 동안은 알림을 띄우지 않되 기준선은 갱신한다.
  const toast = useTopToast();
  const { show } = toast;
  const prevView = useRef<RoomView | null>(null);
  const prevEpoch = useRef(epoch);
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  useEffect(() => {
    if (prevEpoch.current !== epoch) {
      prevEpoch.current = epoch;
      prevView.current = null;
    }
    const diff = diffRoomViews(prevView.current, view);
    prevView.current = view;
    const t = toastForDiff(diff);
    if (t && !bannerVisible) show(t.text, t.icon);
    // 입장·퇴장은 위 알림과 같은 문구로 기록 칸에도 시스템 줄로 남긴다. 재접속 띠가 떠 있어도 기록은 남기고,
    // 재연결 첫 상태(prevView 가 비어 diff 가 빈 결과)에서는 만들지 않는다. 방장 변경은 crown 시스템 줄로 남긴다(UI-SPEC E.1, 로컬 생성·저장 안 함).
    const at = Date.now() + offsetRef.current; // 서버 줄은 서버 시각이다 — 같은 기준으로 끼워 넣는다(WR-02)
    for (const p of diff.joined) chat.addSystem(CHAT_TEXT.joined(p.nickname), { scope: "all", at });
    for (const p of diff.left) chat.addSystem(CHAT_TEXT.left(p.nickname), { scope: "all", at });
    if (diff.newHost) chat.addSystem(CHAT_TEXT.hostChanged(diff.newHost.nickname), { scope: "all", icon: "crown", at });
  }, [view, epoch, bannerVisible, show, chat]);

  // 열려 있는 시트. 화면이 기억하는 상태는 이것과 [시작] 잠금뿐이다.
  // 내보내기는 누른 시점의 닉네임을 같이 들고 있어 그사이 view 가 바뀌어도 제목이 흔들리지 않는다.
  const [sheet, setSheet] = useState<{ kind: "leave" } | { kind: "share" } | { kind: "bots" } | { kind: "kick"; seat: number; nickname: string } | null>(null);
  const closeSheet = () => setSheet(null);

  // [시작] 2초 잠금. 시작이 거절되면 서버가 다시 보낸 view 대로 그린다.
  const [locked, setLocked] = useState(false);
  // [시작] 빛남(HOST-03): 한 번 눌러 보냈으면 이 대기실 안에서는 되살아나지 않는다(거절돼 잠금이 풀려도).
  const [startPressed, setStartPressed] = useState(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      if (lockTimer.current !== undefined) clearTimeout(lockTimer.current);
    },
    [],
  );

  // 키보드(07-19, CHAT-05)·스테이지 사각형 측정(06-15)·기록 칸 높이는 게임 맵(GameMap)과 같은 훅 하나가 맡는다(08-13).
  // 키보드가 열려 있으면(kbOpen) 행동 줄을 숨기고 기록 칸을 72 로 줄이며 패널이 키보드 위로 올라간다. 아래 패널의 채팅 기록 칸 높이 logH 는 방 높이로 한 번 정한다.
  const { rootRef, headerRef, panelRef, inputRef, kbOpen, logH, stageInsets } = useMapInsets();
  const motion = useMyMotion(store, view.me.seat, () => Date.now() + offset);
  const { typingSeats, ...binding } = useChat({ store: chat, connection: { send, canSend }, view, motion });

  // 꾸미기(10-07): 오른쪽 아래 떠 있는 hanger 버튼 → 패널을 덮는 카드 띠 시트. 아래 패널 높이(--mf-panel-h)는 DOM 에서 재서 루트에 정한다
  // (떠 있는 버튼 묶음과 시트가 같은 값을 읽는다 — GameMap 과 같은 방식). 시트가 열린 동안 떠 있는 버튼은 그리지 않는다.
  const [dressOpen, setDressOpen] = useState(false);
  useLayoutEffect(() => {
    rootRef.current?.style.setProperty("--mf-panel-h", `${panelRef.current?.offsetHeight ?? 0}px`);
  });
  // 미리 보기·되돌림·전송 간격은 훅이 쥔다. WorldStage 에만 미리 보기가 반영된 stageView 를 넘기고 그 밖(채팅·헤더)은 서버 view 를 쓴다.
  const dress = useDress({ view, send, canSend });
  const dressBtnRef = useRef<HTMLButtonElement>(null);
  const restoreDressFocus = useRef(false);
  // 시트 탭(11-13): 지도 칩 → 맵 탭, 꾸미기 버튼 → 의상 탭. 칩·맵 탭은 허용 맵이 둘 이상일 때만 있다
  const [dressTab, setDressTab] = useState<"map" | "dress">("dress");
  const mapsOn = PLAYABLE_MAPS.length > 1;
  const openDress = (tab: "map" | "dress" = "dress") => {
    inputRef.current?.blur();
    setDressTab(tab);
    setDressOpen(true);
  };
  const closeDress = () => {
    restoreDressFocus.current = true;
    setDressOpen(false);
  };
  // 시트를 닫으면 초점을 꾸미기 버튼으로 돌려준다(버튼은 시트가 닫힌 뒤에 다시 그려진다)
  useEffect(() => {
    if (dressOpen || !restoreDressFocus.current) return;
    restoreDressFocus.current = false;
    dressBtnRef.current?.focus();
  }, [dressOpen]);

  const connected = connectedCount(view.players);
  const isHost = view.me.isHost;
  const botsOn = isHost && view.me.testBots !== undefined;
  // 맵 선택(11-13): 칩과 카드는 서버가 방송한 view.mapChoice 만 따른다. 보내기만 하고 미리 바꾸지 않는다
  const mapChoice: MapChoice = view.mapChoice ?? "random";
  const pickMap = (map: MapChoice) => {
    if (canSend) send({ t: "mapPick", map });
  };
  const mapChip = mapsOn ? <MapChip choice={mapChoice} host={isHost} onPress={() => openDress("map")} /> : null;
  const host = view.players.find((p) => p.isHost);
  const full = view.players.length >= view.maxPlayers;
  // 서버 checkStart 와 같은 기준(연결된 사람 수)을 쓴다. 버튼 모양은 표시용이고 판정은 서버가 한다.
  const enoughPlayers = connected >= view.minPlayers;

  const pressStart = () => {
    if (!canSend || locked) return;
    if (!enoughPlayers) {
      show(`${view.minPlayers}명부터 시작해요`);
      return;
    }
    send({ t: "start" });
    setStartPressed(true);
    setLocked(true);
    lockTimer.current = setTimeout(() => {
      lockTimer.current = undefined;
      setLocked(false);
    }, START_LOCK_MS);
  };
  // 사회자 줄이 [시작]을 부르는 때(방장·시작 가능 인원) + 보낼 수 있고 아직 안 눌렀을 때만 빛난다. 판정은 callTargetsOf 하나다
  const callTarget = callTargetsOf(view);
  const callStart = callTarget?.kind === "tool" && callTarget.tool === "start" && canSend && !startPressed;
  const startLabel = enoughPlayers ? `게임 시작, ${connected}명 모임` : `게임 시작, ${connected}명 모임, ${view.minPlayers}명부터 시작할 수 있어요`;

  return (
    <main ref={rootRef} className="mf-root mf-lobby" data-kb-open={kbOpen ? "true" : undefined}>
      <WorldStage
        view={dress.stageView}
        store={store}
        send={send}
        canSend={canSend}
        offset={offset}
        {...(stageInsets ? { stageInsets } : {})}
        typingSeats={typingSeats}
        onNotice={(text) => show(text)}
        onKick={(seat, nickname) => setSheet({ kind: "kick", seat, nickname })}
        onLeave={() => setSheet({ kind: "leave" })}
        exiting={exiting}
      />
      <div className="mf-lobby__scrim" aria-hidden="true" />
      <header ref={headerRef} className="mf-lobby__header">
        {/* 머리 단추: 아이콘 단추, 이름은 aria-label(이름표는 결정 0077·0079 로 없앴다) */}
        <ToolButton name="나가기" icon={<Icon name="back" />} disabled={!canSend} onClick={() => setSheet({ kind: "leave" })} />
        <PhaseHeader title="대기실" />
        {view.code ? (
          <ToolButton name="공유" icon={<Icon name="share" />} onClick={() => setSheet({ kind: "share" })} />
        ) : (
          <span className="mf-lobby__header-gap" aria-hidden="true" />
        )}
      </header>
      <TopToast {...toast.props} />
      {testButton ? (
        <div className="mf-lobby__test">
          {testButton}
          {mapChip}
        </div>
      ) : mapChip ? (
        <div className="mf-lobby__map">{mapChip}</div>
      ) : null}
      <section ref={panelRef} className={kbOpen ? "mf-lobby__panel mf-lobby__panel--kb" : "mf-lobby__panel"} data-world-panel="">
        <ChatPanel {...binding} logHeight={kbOpen ? LOG_H_KB : logH} compact={kbOpen} inputRef={inputRef} />
        {kbOpen ? null : (
          <ActionRow>
            {isHost ? (
              <ActionButton
                variant={enoughPlayers && canSend && !locked ? "primary" : "inactive"}
                label="시작"
                icon="play"
                count={{ count: connected, total: view.maxPlayers }}
                aria-label={startLabel}
                data={{ "data-lobby-start": "" }}
                call={callStart}
                onClick={pressStart}
              />
            ) : (
              <ActionButton variant="flat" label="방장을 기다리는 중…" />
            )}
          </ActionRow>
        )}
      </section>
      {dressOpen ? null : (
        <FloatActions single={!botsOn}>
          {/* 결정 0075: 방장만 [봇] — 서버가 방장 대기실 view 에만 me.testBots 를 싣는다 */}
          {botsOn ? (
            <FloatAction kind="bots" icon="bot" label="봇" pressed={sheet?.kind === "bots"} disabled={!canSend} onPress={() => setSheet({ kind: "bots" })} />
          ) : null}
          <FloatAction ref={dressBtnRef} kind="dress" icon="hanger" label={DRESS_TEXT.open} disabled={!canSend} onPress={() => openDress()} />
        </FloatActions>
      )}
      {dressOpen ? (
        <DressSheet
          value={dress.look}
          onPick={dress.pick}
          onClose={closeDress}
          disabled={!canSend}
          host={isHost && mapsOn}
          tab={dressTab}
          mapChoice={mapChoice}
          onPickMap={pickMap}
        />
      ) : null}
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
      {sheet?.kind === "bots" && botsOn ? <BotSheet view={view} canSend={canSend} send={send} onClose={closeSheet} /> : null}
      {sheet?.kind === "share" ? <ShareSheet code={view.code} hostNickname={host?.nickname ?? ""} full={full} onClose={closeSheet} /> : null}
    </main>
  );
}
