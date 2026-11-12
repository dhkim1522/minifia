import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ClientMessage, MapChoice, RoomView } from "../../shared/protocol";
import { PLAYABLE_MAPS } from "../../shared/game/maps";
import { lockedOutfits } from "../../shared/game/look";
import { modeOf } from "../../shared/game/ruleset";
import { connectedCount } from "../../shared/game/room";
import { ActionButton, ActionRow } from "../components/ActionButton";
import { BotSheet } from "../components/BotSheet";
import { ToolButton } from "../components/ToolButton";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { Icon } from "../components/Icon";
import { ModeSheet } from "../components/ModeSheet";
import { ShareSheet } from "../components/ShareSheet";
import { ChatPanel } from "../components/v2/ChatPanel";
import { DressSheet } from "../components/v2/DressSheet";
import { FloatAction } from "../components/v2/FloatAction";
import { HostRail } from "../components/v2/HostRail";
import { HostRailButton } from "../components/v2/HostRailButton";
import { MapChip } from "../components/v2/MapChip";
import { ModeChip } from "../components/v2/ModeChip";
import { PhaseHeader } from "../components/v2/PhaseHeader";
import { SideColumn } from "../components/v2/SideColumn";
import { TopToast, useTopToast } from "../components/v2/TopToast";
import { WorldStage } from "../components/WorldStage";
import { emitSignal } from "../audio/signals";
import type { ChatStore } from "../net/chatStore";
import { CHAT_TEXT } from "../game/chatText";
import { DRESS_TEXT } from "../game/dressText";
import { callTargetsOf } from "../game/hostLine";
import { LOG_H } from "../game/chatUi";
import { MODE_TEXT } from "../game/modeText";
import { diffRoomViews, modeToastOf, toastForDiff } from "../net/roomDiff";
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
  /** 테스트 방 방장의 [테스트] 버튼(결정 0022). 있으면 헤더 아래 왼쪽에 놓는다. 방장 줄·판 종류 칩은 그 아래로 내려간다(19-04, P19-5) */
  testButton?: ReactNode;
}

// S-03 대기실(06-15, 07-13): 지하 재즈 바 맵(WorldStage) 위에 승인 로비 틀을 얹는다 — 위쪽 가림막, 헤더([나가기]·PhaseHeader "대기실"·[공유]),
// 위 알림(TopToast), 아래 패널의 채팅 기록 + 입력줄 + 행동 줄 하나. 방 코드는 공유 시트 안에서만 보인다. 읽을 글은 "대기실" 과 접히는 한 줄뿐이다(3초 규칙).
// 19-04(D-13): 방장 전용 조작([판 종류]·[맵]·[봇]·[튜토리얼 먼저])은 왼쪽 세로 줄(HostRail)에 모으고 오른쪽 열은 모두가 쓰는 [소리]·[옷장]만 둔다. 참가자에게는 줄 마크업이 없고 읽기 전용 판 종류 칩 하나가 있다.
// 화면은 서버가 보낸 view 만으로 다시 그린다. 닉네임(이름표)은 WorldStage 가 React 텍스트 노드로만 그린다.
export function Lobby({ view, store, chat, send, canSend = true, epoch = 0, offset = 0, bannerVisible = false, exiting = false, onLeave, testButton }: LobbyProps) {
  // 입장·퇴장·방장 변경 알림: 서버가 보낸 스냅샷 두 개의 차이로만 만든다. 처음 열 때·epoch 가 바뀐 직후(재연결)에는
  // 직전 스냅샷을 비워 지난 일을 다시 알리지 않는다. 재접속 띠가 떠 있는 동안은 알림을 띄우지 않되 기준선은 갱신한다.
  // 판 종류 바뀜(19-04, P19-9)도 같은 규칙으로 참가자에게만 한 줄 — 한 번에 하나라 순서는 방장 변경 > 입장 > 퇴장 > 판 종류다.
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
    const prev = prevView.current;
    const diff = diffRoomViews(prev, view);
    prevView.current = view;
    const t = toastForDiff(diff);
    const modeText = t ? null : modeToastOf(prev, view);
    if (!bannerVisible) {
      if (t) show(t.text, t.icon);
      else if (modeText) show(modeText);
    }
    // 입장·퇴장은 위 알림과 같은 문구로 기록 칸에도 시스템 줄로 남긴다. 재접속 띠가 떠 있어도 기록은 남기고,
    // 재연결 첫 상태(prevView 가 비어 diff 가 빈 결과)에서는 만들지 않는다. 방장 변경은 crown 시스템 줄로 남긴다(UI-SPEC E.1, 로컬 생성·저장 안 함).
    const at = Date.now() + offsetRef.current; // 서버 줄은 서버 시각이다 — 같은 기준으로 끼워 넣는다(WR-02)
    for (const p of diff.joined) chat.addSystem(CHAT_TEXT.joined(p.nickname), { scope: "all", at });
    for (const p of diff.left) chat.addSystem(CHAT_TEXT.left(p.nickname), { scope: "all", at });
    if (diff.newHost) chat.addSystem(CHAT_TEXT.hostChanged(diff.newHost.nickname), { scope: "all", icon: "crown", at });
  }, [view, epoch, bannerVisible, show, chat]);

  // 열려 있는 시트. 화면이 기억하는 상태는 이것과 [시작] 잠금뿐이다.
  // 내보내기는 누른 시점의 닉네임을 같이 들고 있어 그사이 view 가 바뀌어도 제목이 흔들리지 않는다.
  const [sheet, setSheet] = useState<{ kind: "leave" } | { kind: "share" } | { kind: "bots" } | { kind: "mode" } | { kind: "kick"; seat: number; nickname: string } | null>(null);
  const closeSheet = () => setSheet(null);

  // [시작] 2초 잠금. 시작이 거절되면 서버가 다시 보낸 view 대로 그린다.
  const [locked, setLocked] = useState(false);
  // [시작] 빛남(HOST-03): 한 번 눌러 보냈으면 이 대기실 안에서는 되살아나지 않는다(거절돼 잠금이 풀려도).
  const [startPressed, setStartPressed] = useState(false);
  // 방장 스위치 '튜토리얼 먼저'(17-07, 결정 0078-3·0080-1·3) — 방장 줄 토글(19-04, 0083-3 의 패널 줄을 대신): 화면 로컬 상태이고 서버에 방송하지 않는다 — [시작] 순간의 값이 start 메시지로 간다.
  // 초기값은 첫 판 켜짐, 다시 하기(2판째)와 테스트 방 꺼짐(토글은 보인다). 기본 마피아면 토글을 그리지 않지만 값은 남아 확장판으로 돌아오면 이전 값이 보인다(D-10).
  const [tutorialOn, setTutorialOn] = useState(() => (view.round ?? 1) === 1 && view.me.testMode !== true);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      if (lockTimer.current !== undefined) clearTimeout(lockTimer.current);
    },
    [],
  );

  // 키보드(07-19, CHAT-05)·스테이지 사각형 측정(06-15)·기록 칸 높이는 게임 맵(GameMap)과 같은 훅 하나가 맡는다(08-13).
  // 키보드가 열려 있으면(kbOpen) 행동 줄을 숨기고 패널이 키보드 위로 올라간다. 기록 칸은 LOG_H(68) 한 값.
  const { rootRef, headerRef, panelRef, inputRef, kbOpen, sideMaxH, stageInsets } = useMapInsets();
  const motion = useMyMotion(store, view.me.seat, () => Date.now() + offset);
  const { typingSeats, ...binding } = useChat({ store: chat, connection: { send, canSend }, view, motion });

  // 꾸미기(10-07): 오른쪽 열의 hanger 버튼 → 패널을 덮는 카드 띠 시트. 아래 패널 높이(--mf-panel-h)는 DOM 에서 재서 루트에 정한다
  // (시트가 그 값을 읽는다 — GameMap 과 같은 방식). 시트가 열린 동안·키보드가 열린 동안 오른쪽 열은 그리지 않는다.
  const [dressOpen, setDressOpen] = useState(false);
  useLayoutEffect(() => {
    rootRef.current?.style.setProperty("--mf-panel-h", `${panelRef.current?.offsetHeight ?? 0}px`);
  });
  // 미리 보기·되돌림·전송 간격은 훅이 쥔다. WorldStage 에만 미리 보기가 반영된 stageView 를 넘기고 그 밖(채팅·헤더)은 서버 view 를 쓴다.
  const dress = useDress({ view, send, canSend });
  // 18-05(D-02): 다른 참가자가 직접 고른 옷 — 서버 view.players 에서 나를 빼고 매 방송 다시 계산한다(서버 잠금과 같은 함수)
  const taken = useMemo(() => lockedOutfits(view.players.filter((p) => p.seat !== view.me.seat)), [view.players, view.me.seat]);
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
  // 판 종류(19-04, D-05): 단추 이름·시트의 고른 칸·참가자 칩은 서버가 방송한 view.mode 만 따른다. 고르면 보내기만 하고 미리 바꾸지 않는다(P19-6)
  const mode = modeOf(view);
  const modeBtnRef = useRef<HTMLButtonElement>(null);
  const restoreModeFocus = useRef(false);
  const openMode = () => {
    inputRef.current?.blur();
    setSheet({ kind: "mode" });
  };
  const closeMode = () => {
    restoreModeFocus.current = true;
    setSheet(null);
  };
  const modeOpen = sheet?.kind === "mode";
  // 시트를 닫으면 초점을 [판 종류] 단추로 돌려준다(꾸미기 시트의 restoreDressFocus 와 같은 방식)
  useEffect(() => {
    if (modeOpen || !restoreModeFocus.current) return;
    restoreModeFocus.current = false;
    modeBtnRef.current?.focus();
  }, [modeOpen]);
  // 방장을 넘겨주면 열려 있던 판 종류 시트는 닫는다 — 다시 방장이 됐을 때 저절로 뜨지 않게
  useEffect(() => {
    if (!isHost) setSheet((s) => (s?.kind === "mode" ? null : s));
  }, [isHost]);
  // [튜토리얼 먼저] 누름: 옛 스위치 줄과 같은 누름 소리 신호 뒤 값을 뒤집고, 글 없는 단추라 한 줄 알림으로 뜻을 보탠다(P19-8). 서버로는 아무것도 보내지 않는다
  const pressTutorial = () => {
    emitSignal({ kind: "tap" });
    const next = !tutorialOn;
    setTutorialOn(next);
    show(next ? MODE_TEXT.tutorialOn : MODE_TEXT.tutorialOff);
  };
  // 테스트 방([테스트] 단추가 왼쪽 위에 있음): 줄·칩이 그 아래(48)에서 시작하고 줄 최대 높이도 그만큼 줄어든다(P19-5, F-1)
  const testShift = Boolean(testButton);
  // 맵 선택(11-13): 칩과 카드는 서버가 방송한 view.mapChoice 만 따른다. 보내기만 하고 미리 바꾸지 않는다
  const mapChoice: MapChoice = view.mapChoice ?? "random";
  const pickMap = (map: MapChoice) => {
    if (canSend) send({ t: "mapPick", map });
  };
  // 맵 단추는 방장에게만 그린다(16-06 V-5, T-16-13): 참가자는 맵을 고르지 못하고 서버도 방장의 mapPick 만 받는다.
  // 19-04: 방장 줄의 칸이다(rail). 연결이 끊기면 다른 줄 단추처럼 눌러도 아무 일 없다. 눌림 속성은 결과 화면과 같은 모양으로 둔다(꾸미기 시트가 열리면 줄을 그리지 않는다)
  const mapChip = mapsOn && isHost ? <MapChip key="map" rail pressed={dressOpen && dressTab === "map"} choice={mapChoice} host={canSend} onPress={() => openDress("map")} /> : null;
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
    // 기본 마피아에는 튜토리얼이 없다(D-10) — 숨은 토글 값이 켜져 있어도 false 를 보낸다. 서버도 같은 규칙으로 다시 판정한다(T-19-14)
    send({ t: "start", tutorial: tutorialOn && mode === "extended" });
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
      {testButton ? <div className="mf-lobby__test">{testButton}</div> : null}
      <section ref={panelRef} className={kbOpen ? "mf-lobby__panel mf-lobby__panel--kb" : "mf-lobby__panel"} data-world-panel="">
        <ChatPanel {...binding} logHeight={LOG_H} compact={kbOpen} inputRef={inputRef} />
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
      {/* 꾸미기 시트·키보드가 열린 동안에는 줄·칩·오른쪽 열을 그리지 않는다(P19-16) */}
      {dressOpen || kbOpen ? null : isHost ? (
        // 방장 전용 왼쪽 세로 줄(19-04 D-13): 판 종류 · 맵(허용 맵 둘 이상) · 봇(봇 도구가 켜진 방) · 튜토리얼 먼저(확장판만). 방장 판정은 서버 view 의 isHost 뿐이고 참가자에게는 마크업이 없다(T-19-13)
        <HostRail maxHeight={testShift ? Math.max(0, sideMaxH - 48) : sideMaxH} testShift={testShift}>
          <HostRailButton key="mode" ref={modeBtnRef} id="mode" icon="deck" label={MODE_TEXT.aria(mode)} pressed={modeOpen} disabled={!canSend} onPress={openMode} />
          {mapChip}
          {/* 결정 0075: 방장만 [봇] — 서버가 방장 대기실 view 에만 me.testBots 를 싣는다 */}
          {botsOn ? <HostRailButton key="bots" id="bots" icon="bot" label="봇" pressed={sheet?.kind === "bots"} disabled={!canSend} onPress={() => setSheet({ kind: "bots" })} /> : null}
          {/* 맨 아래 칸이라 사라져도 위 칸들의 자리가 움직이지 않는다. [시작] 잠금 2초 동안은 눌리지 않는다 */}
          {mode === "extended" ? <HostRailButton key="tutorial" id="tutorial" icon="book" label="튜토리얼 먼저" switchOn={tutorialOn} disabled={!canSend || locked} onPress={pressTutorial} /> : null}
        </HostRail>
      ) : (
        // 참가자: 읽기 전용 판 종류 칩 하나(D-07)
        <ModeChip mode={mode} testShift={testShift} />
      )}
      {dressOpen || kbOpen ? null : (
        // 오른쪽 세로 한 줄: 방장도 소리 · 옷장(19-04, 방장 전용은 왼쪽 줄)
        <SideColumn soundSlot maxHeight={sideMaxH}>
          <FloatAction key="dress" ref={dressBtnRef} kind="dress" side="dress" icon="hanger" label={DRESS_TEXT.open} disabled={!canSend} onPress={() => openDress()} />
        </SideColumn>
      )}
      {dressOpen ? (
        <DressSheet
          value={dress.look}
          onPick={dress.pick}
          onClose={closeDress}
          disabled={!canSend}
          taken={taken}
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
      {modeOpen && isHost ? (
        <ModeSheet
          mode={mode}
          canSend={canSend}
          onPick={(next) => {
            // 보내기만 한다 — 표시는 서버가 방송한 view.mode 가 바꾼다. 방장 판정·거절은 서버 몫이다(결정 0002)
            if (canSend) send({ t: "modePick", mode: next });
          }}
          onClose={closeMode}
        />
      ) : null}
      {sheet?.kind === "share" ? <ShareSheet code={view.code} hostNickname={host?.nickname ?? ""} full={full} onClose={closeSheet} /> : null}
    </main>
  );
}
