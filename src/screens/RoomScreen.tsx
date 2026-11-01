import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { isAlive } from "../../shared/game/alive";
import { phaseKey } from "../../shared/game/audience";
import type { PhaseId, RemovedReason, RoomView } from "../../shared/protocol";
import { Button } from "../components/Button";
import { ReconnectBanner } from "../components/ReconnectBanner";
import { RoleCardButton } from "../components/RoleCardButton";
import { RoleCardSheet } from "../components/RoleCardSheet";
import type { RoleCardTab } from "../components/RoleCardSheet";
import { TestToolsButton, TestToolsSheet } from "../components/TestTools";
import { executionTitle, morningCardText } from "../game/eliminationText";
import { VERDICT_TEXT, defenseAnnounce, noExecutionPrefix, winnerText } from "../game/verdict";
import { preloadDuskAssets, preloadRoleAssets } from "../net/assets";
import { ChatStore } from "../net/chatStore";
import { usePhaseArrival } from "../net/phaseArrival";
import { loadSeenCount, saveSeenCount, unseenCount } from "../net/recordsSeen";
import { useReducedMotion } from "../net/useReducedMotion";
import { useRoomConnection } from "../net/useRoomConnection";
import { useWakeLock } from "../net/useWakeLock";
import { EXIT_CURTAIN_MS } from "../world/runtime";
import { WorldStore } from "../world/store";
import { Assigning } from "./Assigning";
import { DayScene } from "./DayScene";
import { Lobby } from "./Lobby";
import { ResultScreen } from "./ResultScreen";
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
  discussion: () => "낮 토론",
  night: nightAnnounce,
  morning: morningAnnounce,
  execVote: () => VERDICT_TEXT.announce.execVote,
  candidateVote: () => VERDICT_TEXT.announce.candidateVote,
  candidateVoteReveal: () => VERDICT_TEXT.announce.candidateVoteReveal,
  defense: defenseAnnounceOf,
  execution: executionAnnounceOf,
  // 결과가 있으면 승리 팀까지 읽는다(result 없는 옛 서버 프레임은 연결 중… 화면이라 짧은 문구)
  ended: (view) => (view.result ? winnerText(view.result.winner).announce : "게임이 끝났습니다"),
};

// 아침 안내: "아침이 밝았습니다. " + 카드 제목(무사면 '아무 일도 없었습니다. 모두 무사해요'). 카드와 같은 출처에서 만든다.
function morningAnnounce(view: RoomView): string {
  const nicknameOf = (seat: number) => view.players.find((p) => p.seat === seat)?.nickname;
  const { title, sub } = morningCardText(view.day?.morning, nicknameOf);
  return `아침이 밝았습니다. ${title}${sub ? `. ${sub}` : ""}`;
}

// 밤 안내: "{N}일차 밤. " 뒤에 내 처지에 맞는 한 줄. 탈락한 사람은 역할과 무관하게 관전 문구다(결정 0021).
// 처형 무효로 온 밤이면 그 앞에 `처형 무효. {부제}. ` 를 붙인다(04-24, UI-SPEC 7.3). 카드는 aria-hidden 이라 이 문구가 읽는다.
function nightAnnounce(view: RoomView): string {
  const noExecution = view.day?.noExecution;
  return `${noExecution ? noExecutionPrefix(noExecution.reason) : ""}${nightAnnounceBase(view)}`;
}

function nightAnnounceBase(view: RoomView): string {
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

// 최후 변론 안내: 후보 본인이면 `내 최후 변론`, 남이면 `{이름}님의 최후 변론`. 후보를 못 찾으면(서버 이상) `최후 변론`.
function defenseAnnounceOf(view: RoomView): string {
  const seat = view.day?.candidate;
  if (seat === undefined) return "최후 변론";
  if (seat === view.me.seat) return defenseAnnounce(null);
  const nickname = view.players.find((p) => p.seat === seat)?.nickname;
  return nickname === undefined ? "최후 변론" : defenseAnnounce(nickname);
}

// 처형 안내: 카드 제목과 같은 문장(`{이름}님이 {꼬리}`). 처형된 자리를 못 찾으면(서버 이상) `처형`.
function executionAnnounceOf(view: RoomView): string {
  const seat = view.day?.execution?.seat ?? view.day?.candidate;
  const nickname = seat === undefined ? undefined : view.players.find((p) => p.seat === seat)?.nickname;
  return nickname === undefined ? "처형" : executionTitle(view.day?.execution?.phrase, nickname);
}

// 장면 키: 낮 시작(dayAnnounce)·낮 두 단계와 밤·아침은 같은 장면(DayScene)이라 같은 키를 쓴다 — 테이블을 다시 마운트하지 않는다(UI-SPEC C5).
// 낮 시작 전용 화면은 없다(결정 0030). 래퍼와 장면은 장면에 들어올 때만 mf-phase-enter 가 돈다. 그 밖은 단계 이름이 키다.
function sceneKey(phase: PhaseId): string {
  return phase === "dayAnnounce" || phase === "discussion" || phase === "night" || phase === "morning" || phase === "execVote" || phase === "candidateVote" || phase === "candidateVoteReveal" || phase === "defense" || phase === "execution"
    ? "dayScene"
    : phase;
}

/** 채팅 입력칸에 포커스가 있는가(키보드가 열려 있을 수 있는 동안) */
function typingInChat(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLElement && el.hasAttribute("data-chat-input");
}

/**
 * 방 높이를 px 로 고정한다(07-19, UI-SPEC 패널과 키보드): 처음 그릴 때와 화면이 바뀔 때(방향 전환·주소창·창 크기)만 `--mf-room-h` 에 px 로 쓴다.
 * 채팅 입력칸에 포커스가 있는 동안(키보드)의 resize 는 무시한다 — 100dvh 로 키보드를 따라가면 캔버스가 크기를 바꾸고(WebGL 재할당·카메라 튐) 안 된다.
 * 측정은 변수를 잠깐 치워 CSS 의 100dvh 식(안전 영역 제외)이 준 높이를 읽는다. 읽은 높이가 0 이면(레이아웃 없는 환경) 변수를 쓰지 않아 그 식이 그대로 쓰인다.
 */
function useFixedRoomHeight(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    let raf = 0;
    const measure = (): void => {
      el.style.removeProperty("--mf-room-h");
      const h = el.offsetHeight;
      if (h > 0) el.style.setProperty("--mf-room-h", `${h}px`);
    };
    const onChange = (): void => {
      if (typingInChat()) return;
      // 방향 이벤트 직후에는 높이가 아직 옛 값일 수 있어 한 프레임 뒤에 읽는다
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!typingInChat()) measure();
      });
    };
    measure();
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
}

// 방 화면 틀: 재접속 띠(대기실에서는 맵 위에 떠 있고, 그 밖의 단계에서는 흐름 안에서 본문을 밀어냄) + 본문. 단계 화면은 본문 자리에 붙는다.
export function RoomScreen({ code, token, onExit }: RoomScreenProps) {
  const connection = useRoomConnection(code, token);
  const { status, banner, view, removedReason } = connection;
  const roomRef = useRef<HTMLDivElement>(null);
  useFixedRoomHeight(roomRef);

  // 로비 맵의 위치 스토어: 연결과 같은 수명이다. 연결 훅 바로 뒤에 world 프레임을 구독해 첫 snap 을 놓치지 않는다(MAP-05).
  // 로비를 떠났다 돌아와도 같은 스토어를 쓴다 — 돌아오면 서버가 다시 보낸 snap 이 구간을 통째로 바꾼다.
  const [store] = useState(() => new WorldStore());
  // 채팅 저장소도 연결과 같은 수명이다 — 로비 줄이 게임이 시작돼도 같은 흐름으로 이어진다(방 한 번 들어오면 한 흐름, 리서치 Pattern 5).
  // 같은 구독 하나로 world 와 채팅 프레임을 나눠 먹인다. 시각은 저장소가 읽지 않고 받은 때를 넘긴다.
  const [chat] = useState(() => new ChatStore());
  const { onEvent } = connection;
  useEffect(
    () =>
      onEvent((e, meta) => {
        if (e.t === "world") store.applyFrame(e, meta.epoch);
        else if (e.t === "chat" || e.t === "typing" || e.t === "chatLog" || e.t === "chatReject") chat.apply(e, meta.epoch, Date.now());
      }),
    [onEvent, store, chat],
  );

  // 게임이 시작되어 로비를 떠날 때: 마지막 로비 view 로 Lobby 를 EXIT_CURTAIN_MS(dur-med) 동안 더 그려 맵을 night-900 으로 덮은 뒤 v1.0 단계 화면으로 넘어간다.
  // 모션 줄이기면 가림막 없이 바로 넘어간다. 대기실로 돌아오거나 로비 밖에서 로비 밖으로 가는 전환에는 없다.
  const reducedMotion = useReducedMotion();
  const [lastView, setLastView] = useState<RoomView | null>(view);
  const [curtain, setCurtain] = useState<RoomView | null>(null);
  if (view !== lastView) {
    setLastView(view);
    if (view === null || view.phase === "lobby") {
      if (curtain !== null) setCurtain(null);
    } else if (lastView?.phase === "lobby" && !reducedMotion) {
      setCurtain(lastView);
    }
  }
  useEffect(() => {
    if (curtain === null) return;
    const timer = setTimeout(() => setCurtain(null), EXIT_CURTAIN_MS);
    return () => clearTimeout(timer);
  }, [curtain]);
  // 지금 화면에 그리는 view: 가림막 동안은 마지막 로비 view 다.
  const shown = curtain ?? view;

  // 방을 보여 주는 동안 화면이 꺼지지 않게 한다(D-12, P5-7 기본값: 대기실 포함 — 꺼지면 소켓이 끊겨 친구에게 "나갔다" 로 보인다).
  useWakeLock(view !== null && view.phase !== "ended" && status !== "replaced" && status !== "failed" && status !== "removed");

  // 대기실·배정 동안 직업 그림 4종 전부와 낮 배경을 미리 받아 둔다.
  // 어떤 역할인지와 무관하게 같은 요청 패턴이다(Pattern 13 ②, Pitfall 20).
  const phase = view?.phase;
  // 대기실로 돌아오면(테스트 방 되돌리기·다시 하기) 지난 판의 줄을 비운다. 판정은 "직전 단계가 대기실이 아니고 지금 대기실"이다 —
  // 처음 들어오는 대기실이나 대기실에서 대기실(같은 판)은 비우지 않는다. setContext 보다 먼저 선언해 같은 커밋에서 비운 뒤 문맥을 넣는다.
  const prevPhase = useRef<PhaseId | undefined>(undefined);
  useEffect(() => {
    const prev = prevPhase.current;
    prevPhase.current = phase;
    if (phase === "lobby" && prev !== undefined && prev !== "lobby") chat.reset();
  }, [phase, chat]);
  // view 가 바뀔 때마다 단계 키·내 채널·연결 epoch 를 알린다(셋 중 하나가 바뀌면 저장소가 입력 중을 끈다).
  const chatEpoch = connection.epoch;
  useEffect(() => {
    if (view === null) return;
    const day = view.day?.n;
    chat.setContext({ pk: phaseKey(day === undefined ? { phase: view.phase } : { phase: view.phase, day }), channel: view.me.chat ?? null, epoch: chatEpoch });
  }, [chat, view, chatEpoch]);
  // 같은 접속에서 단계가 바뀌어 온 직전 단계. 역할 확인 → 낮 시작으로 DayScene 이 새로 마운트될 때 문구·배경 전환의 근거다(재접속·처음엔 null).
  const arrivedFrom = usePhaseArrival(phase, connection.epoch);
  useEffect(() => {
    if (phase === "lobby" || phase === "assigning") preloadRoleAssets();
  }, [phase]);
  // 낮 토론에 들어서면 투표 단계가 쓸 해질녘 배경 하나를 미리 받는다(P-17). 어떤 역할이든 같은 요청 하나다(Pitfall 20).
  useEffect(() => {
    if (phase === "discussion") preloadDuskAssets();
  }, [phase]);

  // 역할 카드 시트(결정 0026): 열림·선택 탭과 "카드가 앞면이 된 적이 있는가" 는 단계 switch 밖에서 쥔다 —
  // 단계 화면이 바뀌어도 시트가 살아 있어야 한다(Pitfall 19 ⑧, UI-SPEC D).
  const [roleCard, setRoleCard] = useState<{ open: boolean; tab: RoleCardTab }>({ open: false, tab: "role" });
  const [seenFront, setSeenFront] = useState(false);
  const onSeenFront = useCallback(() => setSeenFront(true), []);

  // 읽은 일지 수: 폰에는 이 개수만 남긴다. 기록 내용은 서버 view(me.records) 에서만 온다(가정 A4, T-03.1-32).
  // 활동 기록 탭이 보이는 순간 현재 길이로 올려 버튼 점·탭 점이 함께 사라지고, 그때 안 읽었던 만큼이 이 시트를 닫을 때까지 NEW 로 남는다(D-11).
  const recordsLen = view?.me.records?.length ?? 0;
  const [seen, setSeen] = useState(() => loadSeenCount(code));
  const [newCount, setNewCount] = useState(0);
  const showBack = view?.phase === "roleReveal" && !seenFront;
  const activityVisible = roleCard.open && roleCard.tab === "activity" && !showBack;
  // 탭이 보이는 동안은 안 읽은 것이 없다(효과가 읽음으로 올리기 전 한 번의 그리기에도 점이 깜빡이지 않게).
  const unread = activityVisible ? 0 : unseenCount(recordsLen, seen);
  useEffect(() => {
    if (!activityVisible) return;
    const fresh = unseenCount(recordsLen, seen);
    if (fresh === 0) return;
    setNewCount((c) => c + fresh);
    setSeen(recordsLen);
    saveSeenCount(code, recordsLen);
  }, [activityVisible, recordsLen, seen, code]);
  const closeRoleCard = () => {
    setRoleCard({ open: false, tab: "role" });
    setNewCount(0);
  };

  // 새 판(대기실·배정)으로 돌아가면 앞면을 본 적 없는 상태로 되돌리고 시트를 닫는다.
  // 읽은 개수도 0 으로 되돌린다 — 같은 방 코드로 새 판이 열려도 옛 값이 남지 않는다.
  useEffect(() => {
    if (phase === "lobby" || phase === "assigning") {
      setSeenFront(false);
      setRoleCard({ open: false, tab: "role" });
      setNewCount(0);
      setSeen(0);
      saveSeenCount(code, 0);
    }
  }, [phase, code]);

  // 테스트 방 방장 도구(결정 0022): 방장 본인 view 의 me.testMode 가 있을 때만 [테스트] 버튼과 시트가 있다.
  // 시트는 대기실에서도 쓰므로(내 직업 고르기) 대기실·배정 진입 효과에서 닫지 않는다 — 단계가 바뀌어도 열린 채다.
  const [testOpen, setTestOpen] = useState(false);
  // 판이 끝나면 열려 있던 역할 카드·테스트 시트를 닫는다 — 결과 화면에는 두 버튼이 없고, 열린 시트가 [처음으로] 를 가리지 않게 한다(UI-SPEC 11, 04-25).
  useEffect(() => {
    if (phase === "ended") {
      setRoleCard({ open: false, tab: "role" });
      setNewCount(0);
      setTestOpen(false);
    }
  }, [phase]);
  const testTools = view !== null && view.me.isHost && view.me.testMode === true;

  // 쫓겨난 이유별 화면은 App 이 고른다(오류 화면·링크 참가 화면).
  useEffect(() => {
    if (status === "removed") onExit(removedReason ?? "room_closed");
  }, [status, removedReason, onExit]);

  // 헤더 오른쪽 슬롯은 모든 역할·모든 시점에 [역할 카드] 하나다(D-08). 안 읽은 일지가 있으면 앰버 점이 붙는다.
  // 화면들이 받는 prop 이름은 myRoleButton 그대로다.
  const myRoleButton = <RoleCardButton unread={unread > 0} onOpen={() => setRoleCard({ open: true, tab: "role" })} />;

  // 위쪽 바처럼 장면에 빈 왼쪽 위가 없는 단계(역할 확인)에서는 [테스트] 가 [역할 카드] 왼쪽 같은 칸에 놓인다.
  const testButton = testTools ? <TestToolsButton onOpen={() => setTestOpen(true)} /> : null;
  const withTest = (buttons: ReactNode) =>
    testButton ? (
      <>
        {testButton}
        {buttons}
      </>
    ) : (
      buttons
    );

  return (
    <div ref={roomRef} className="mf-root mf-room">
      {view && banner !== "hidden" && <ReconnectBanner mode={banner} floating={shown?.phase === "lobby"} />}
      <div className="mf-room__body">{renderBody()}</div>
      {view && roleCard.open ? (
        // 역할 확인에서 앞면을 본 적이 없을 때만 뒷면. 낮부터는 항상 앞면 내용이다(D-19 의 취지).
        <RoleCardSheet
          view={view}
          showBack={showBack}
          tab={roleCard.tab}
          onTab={(tab) => setRoleCard((s) => ({ ...s, tab }))}
          unread={unread}
          newCount={newCount}
          onClose={closeRoleCard}
        />
      ) : null}
      {view && testTools && testOpen ? (
        <TestToolsSheet view={view} canSend={connection.canSend} send={connection.send} onClose={() => setTestOpen(false)} />
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
    // 가림막 동안은 마지막 로비 view 와 로비 키를 그대로 써 Lobby·맵이 다시 마운트되지 않는다.
    const current = curtain ?? view;
    return (
      <div key={sceneKey(current.phase)} className="mf-phase-enter">
        {renderPhase(current)}
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
            store={store}
            chat={chat}
            offset={connection.offset}
            bannerVisible={banner !== "hidden"}
            exiting={curtain !== null}
            onLeave={() => onExit("left")}
            testButton={testButton}
          />
        );
      case "assigning":
        return <Assigning view={view} />;
      case "roleReveal":
        return (
          <RoleReveal view={view} offset={connection.offset} myRoleButton={withTest(myRoleButton)} onSeenFront={onSeenFront} />
        );
      case "dayAnnounce":
      case "discussion":
      case "night":
      case "morning":
      case "execVote":
      case "candidateVote":
      case "candidateVoteReveal":
      case "defense":
      case "execution":
        return (
          <DayScene
            view={view}
            connection={connection}
            chat={chat}
            myRoleButton={myRoleButton}
            testButton={testButton}
            arrivedFrom={arrivedFrom}
          />
        );
      case "ended":
        // 결과는 서버가 ended 에서만 모두에게 같게 싣는다(D-17). 없는 프레임(옛 서버 등)은 안내 화면으로 안전하게 폴백한다.
        return view.result ? <ResultScreen view={{ ...view, result: view.result }} onExit={() => onExit("left")} arrivedFrom={arrivedFrom} /> : connecting();
      default:
        return connecting();
    }
  }
}
