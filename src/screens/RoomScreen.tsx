import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { isAlive } from "../../shared/game/alive";
import { phaseKey } from "../../shared/game/audience";
import type { PhaseId, RemovedReason, RoomView } from "../../shared/protocol";
import { emitSignal } from "../audio/signals";
import { useSound } from "../audio/useSound";
import { hostChimeOf, type HostLocal } from "../game/hostLine";
import { nightDarkOf } from "../game/nightDark";
import { LETTER_MS_PER_CHAR, LETTER_WRITE_MAX_MS, oneParagraph } from "../game/willLetter";
import { countGraphemes } from "../../shared/nickname";
import { Button } from "../components/Button";
import { ReconnectBanner } from "../components/ReconnectBanner";
import { RoleCardButton } from "../components/RoleCardButton";
import { RoleCardSheet } from "../components/RoleCardSheet";
import type { RoleCardTab } from "../components/RoleCardSheet";
import { TestToolsButton, TestToolsSheet } from "../components/TestTools";
import { HostBand, HostDock } from "../components/v2/HostBand";
import { TutorialWait } from "../components/v2/TutorialWait";
import { MORNING_TEXT, morningText } from "../game/eliminationText";
import { READY_TEXT } from "../game/resultText";
import { defenseAnnounce, noExecutionPrefix, winnerText } from "../game/verdict";
import { preloadDuskAssets, preloadRoleAssets } from "../net/assets";
import { ChatStore } from "../net/chatStore";
import { ResultLogStore } from "../net/resultLogStore";
import { usePhaseArrival } from "../net/phaseArrival";
import { useFixedRoomHeight } from "../net/useFixedRoomHeight";
import { loadSeenCount, saveSeenCount, unseenCount } from "../net/recordsSeen";
import { useDayFx } from "../net/useDayFx";
import { useWillLetter } from "../net/useWillLetter";
import { useReducedMotion } from "../net/useReducedMotion";
import { useRoomConnection } from "../net/useRoomConnection";
import { useWakeLock } from "../net/useWakeLock";
import { EXIT_CURTAIN_MS, preloadWorld } from "../world/runtime";
import { WorldStore } from "../world/store";
import { worldTestHooksEnabled } from "../world/testHooks";
import { PreGame } from "./PreGame";
import { Assigning } from "./Assigning";
import { BenchView } from "./BenchView";
import { GameMap } from "./GameMap";
import { Lobby } from "./Lobby";
import { ResultScreen } from "./ResultScreen";
import { TutorialScreen } from "./TutorialScreen";
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
  tutorial: () => "튜토리얼", // 17페이즈(결정 0080)
  assigning: () => "직업을 배정하고 있습니다",
  roleReveal: () => "역할 확인",
  dayAnnounce: (view) => `${view.day?.n ?? 1}일차 낮이 되었습니다`,
  errand: () => "심부름", // 15페이즈(결정 0074)
  discussion: () => "낮 토론",
  night: nightAnnounce,
  morning: morningAnnounce,
  defense: defenseAnnounceOf,
  execution: executionAnnounceOf,
  nomination: () => "지목", // 8페이즈: 서버가 아직 이 단계를 만들지 않는다 — 문구는 08-13 이 다시 본다
  runoff: () => "결선", // 09.1.1-14: 동점 결선 화면(GameMap)
  showdown: () => "마지막 셋", // 09.1.1-15: 마지막 3인 결전 화면(GameMap)
  verdict: () => "찬반",
  // 결과가 있으면 승리 팀까지 읽는다(result 없는 옛 서버 프레임은 연결 중… 화면이라 짧은 문구)
  ended: (view) => (view.result ? winnerText(view.result.winner).announce : "게임이 끝났습니다"),
};

// 아침 안내: "아침이 밝았습니다. " + 36px 알림과 같은 출처의 세 문장 중 하나(결정 0061-17). 피해자 본인(이번 아침 탈락자가 나)은 '암살당했습니다'.
function morningAnnounce(view: RoomView): string {
  const morning = view.day?.morning;
  if (morning?.eliminated !== undefined && morning.eliminated === view.me.seat) return `아침이 밝았습니다. ${MORNING_TEXT.victim}`;
  const nicknameOf = (seat: number) => view.players.find((p) => p.seat === seat)?.nickname;
  return `아침이 밝았습니다. ${morningText(morning, nicknameOf).text}`;
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

// 처형 안내(결정 0060-5): `{닉네임} 님 처형` 하나뿐이다(문구 번호 없음). 처형된 자리를 못 찾으면(서버 이상) `처형`.
// 찬반이 부결이면 서버는 day.execution 을 싣지 않고 candidate 만 남기므로, 통과가 아니면 처형 문구를 만들지 않고 `처형 없음` 을 읽는다
// (화면의 시각 알림 dayView.phaseEntry 가 verdict.passed 로 가르는 것과 같은 기준).
function executionAnnounceOf(view: RoomView): string {
  if (view.day?.verdict?.passed !== true) return "처형 없음";
  const seat = view.day.execution?.seat ?? view.day.candidate;
  const nickname = seat === undefined ? undefined : view.players.find((p) => p.seat === seat)?.nickname;
  return nickname === undefined ? "처형" : `${nickname} 님 처형`;
}

// 장면 키: 낮 시작·토론·지목·최후 변론·찬반·처형(8페이즈 지도 단계)은 같은 장면(GameMap)이라 같은 키를 쓴다 — 단계가 바뀌어도 맵(three 렌더러)을 다시 만들지 않는다(DAY-07).
// 밤·아침(08-18 임시 틀, UI-SPEC A1)도 같은 맵이다. 옛 투표 세 단계는 08-19 에 화면을 지웠고 08-22 에 PhaseId 에서도 지웠다. 낮 시작 전용 화면은 없다(결정 0030).
// 래퍼와 장면은 장면에 들어올 때만 mf-phase-enter 가 돈다. 그 밖은 단계 이름이 키다.
function sceneKey(phase: PhaseId): string {
  switch (phase) {
    case "dayAnnounce":
    case "errand":
    case "discussion":
    case "nomination":
    case "runoff":
    case "showdown":
    case "defense":
    case "verdict":
    case "execution":
    case "night":
    case "morning":
      return "gameMap";
    // 역할 배정·역할 확인은 같은 3D 무대(PreGame)라 같은 키 — 두 단계 사이에 무대를 다시 만들지 않는다(feedback-3).
    case "assigning":
    case "roleReveal":
      return "preGame";
    default:
      return phase;
  }
}

/** E2E 훅이 켜진 문맥인가(?e2e=1·개발 빌드). 소리 훅 window.__mfSound 의 켜짐 판정이다 */
function soundHookOn(): boolean {
  let store: Storage | null = null;
  try {
    store = typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    store = null;
  }
  return worldTestHooksEnabled(window.location.search, store, import.meta.env.DEV);
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
  // 결과 공개 기록(resultLog)도 연결과 같은 수명이다 — ended 에서만 오고, 대기실로 돌아가면 비운다(11-07)
  const [resultLog] = useState(() => new ResultLogStore());
  const { onEvent } = connection;
  // world snap 이 도착한 횟수. 판 번호가 바뀐 view 를 그리기 전에 새 판 snap 이 먼저 와 있으면 월드 저장소를 비우지 않는다(방금 받은 위치를 지우지 않는다, 11-12)
  const worldSnaps = useRef(0);
  // 낮 연출(채팅 시스템 줄·결과 알림): 서버 view 두 개의 공개 정보 차이로만 만든다. 낮 시작은 역할 확인·밤에서 들어오므로 맵 화면이 아니라 방 화면이 직전 view 를 쥐어야 한다.
  const { announce, toast, deny, fading, ghostEnter, killFx, policeResult } = useDayFx({ view, epoch: connection.epoch, chat });
  // 암살 유언 편지(결정 0063-3): 같은 ChatStore 의 라이브 유언 카드와 view 차이로만 만든다
  const letter = useWillLetter({ view, epoch: connection.epoch, chat });
  // 12-10: 받은 동작 프레임의 소리 신호가 "내 동작" 인지 가를 내 좌석(구독은 한 번만 걸리므로 ref 로 읽는다)
  const mySeatRef = useRef<number | null>(null);
  mySeatRef.current = view?.me.seat ?? null;
  useEffect(
    () =>
      onEvent((e, meta) => {
        if (e.t === "world") {
          if (e.k === "snap") worldSnaps.current += 1;
          store.applyFrame(e, meta.epoch);
        }
        else if (e.t === "emote") {
          store.applyEmote(e, meta.epoch); // 동작은 채팅 저장소로 보내지 않는다(10-03)
          // 12-10: 몸 동작을 재생하는 바로 그 자리에서 소리 신호 하나. 받지 못한 프레임·옛 연결 번호의 프레임(저장소가 버리는 것)은 신호도 없다(LS-4)
          if (meta.epoch >= store.currentEpoch()) emitSignal({ kind: "emote", id: e.id, mine: e.seat === mySeatRef.current });
        }
        else if (e.t === "resultLog") resultLog.apply(e, meta.epoch);
        else if (e.t === "chat" || e.t === "typing" || e.t === "chatLog" || e.t === "chatReject") {
          chat.apply(e, meta.epoch, Date.now());
          // 12-09: 방금 받은 라이브 유언·쪽지 카드가 화면에 보일 시각에 ui.card 한 번. 숫자(남은 ms)만 보낸다 — 카드 종류·글은 소리 쪽으로 가지 않는다(LS-5).
          // ballots 카드·귓속말·재접속 복원 줄은 접근자가 null 이라 신호가 없다(찬반 카드는 12-10 의 판결 대본이 낸다).
          if (e.t === "chat" && (e.k === "will" || e.k === "note")) {
            const revealAt = chat.lastLiveCardRevealAt();
            if (revealAt !== null) emitSignal({ kind: "card", delayMs: Math.max(0, revealAt - Date.now()) });
          }
        }
      }),
    [onEvent, store, chat, resultLog],
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

  // 소리(12-07): 방 화면이 보이는 동안 제스처 resume·탭 가시성을 이어 주고, 소리 단추를 한 번 그린다. 소리 설정은 서버로 가지 않는다.
  const [soundHook] = useState(soundHookOn);
  // 12-08: 같은 훅이 view 차이(공개 필드만)를 소리 감독에 넣는다. 연결 번호가 바뀐 렌더는 침대만 낸다.
  // 12-09: 밤 큐의 갈림 불리언 하나. 시각 맥박(TensionVignette)이 실제로 큐를 내는 조건과 같은 식(GameMap 의 nightDark && !reducedMotion).
  // 소리 쪽에는 이 불리언만 간다 — 역할 값은 가지 않고, 두 갈래의 소리 id·큐 개수는 같다(LS-3).
  const visualCues = view !== null && nightDarkOf(view) && !reducedMotion;
  // 개인 사건은 숫자만 넘긴다: 유언 편지(시작 t0 + 쓰는 길이), 경찰 카드 도착 번호, 암살 본인의 killFx. 편지 글·조사 결과·좌석은 가지 않는다.
  const letterT0 = letter?.t0 ?? null;
  const letterText = letter?.text ?? "";
  const letterSound = useMemo(
    () => (letterT0 === null ? null : { t0: letterT0, writeMs: Math.min(LETTER_WRITE_MAX_MS, LETTER_MS_PER_CHAR * countGraphemes(oneParagraph(letterText))) }),
    [letterT0, letterText],
  );
  const sound = useSound({
    // tutorial 단계(17-07, 0080-14·Pitfall 4): 첫 사건 화면(TutorialScreen)이 자기 useSound 하나로 신호를 받는다 — 방 화면의 것은 끄고 문서 이벤트·신호 바인딩을 걸지 않는다
    active: view !== null && view.phase !== "tutorial",
    hook: soundHook,
    view,
    epoch: connection.epoch,
    offset: connection.offset,
    visualCues,
    kill: killFx,
    letter: letterSound,
    policeCard: policeResult?.id ?? null,
  });

  // 사회자 알림음(14-03, HOST-02): 자막 띠가 그리는 view(본문과 같은 curtain ?? view)의 단계가 바뀐 프레임에 신호 하나({ kind: "host" }, 인자 없음).
  // 처음 마운트·연결 번호(epoch)가 바뀐 첫 프레임·같은 단계 안 변화·낮 시작 → 토론은 hostChimeOf 가 거른다. 띠가 없는 화면(쉬는 사람·안내)은 이전 단계만 갱신하고 보내지 않는다.
  // 기존 prevPhase(대기실 복귀 비움)와 별개의 ref 다. 소리 끄기·잠김은 엔진이 따른다.
  const bandPhase = shown !== null && !shown.resting && status !== "replaced" && status !== "failed" ? shown.phase : null;
  const shownPhase = shown?.phase;
  const hostPrev = useRef<{ phase: PhaseId; epoch: number } | null>(null);
  useEffect(() => {
    if (shownPhase === undefined) return;
    const prev = hostPrev.current;
    hostPrev.current = { phase: shownPhase, epoch: connection.epoch };
    if (bandPhase === null || prev === null) return;
    if (hostChimeOf(prev.phase, shownPhase, prev.epoch !== connection.epoch)) emitSignal({ kind: "host" });
  }, [shownPhase, bandPhase, connection.epoch]);

  // 대기실·배정 동안 직업 그림 4종 전부와 낮 배경을 미리 받아 둔다.
  // 어떤 역할인지와 무관하게 같은 요청 패턴이다(Pattern 13 ②, Pitfall 20).
  const phase = view?.phase;
  // 대기실로 돌아오면(테스트 방 되돌리기·다시 하기) 지난 판의 줄을 비운다. 판정은 "직전 단계가 대기실이 아니고 지금 대기실"이다 —
  // 처음 들어오는 대기실이나 대기실에서 대기실(같은 판)은 비우지 않는다. setContext 보다 먼저 선언해 같은 커밋에서 비운 뒤 문맥을 넣는다.
  const prevPhase = useRef<PhaseId | undefined>(undefined);
  useEffect(() => {
    const prev = prevPhase.current;
    prevPhase.current = phase;
    if (phase === "lobby" && prev !== undefined && prev !== "lobby") {
      chat.reset();
      resultLog.reset();
    }
  }, [phase, chat, resultLog]);
  // 판 번호(round)가 바뀐 view(다시 하기, 결정 D-26)는 처음 접속한 것처럼 그린다: 보관한 채팅·결과 기록·월드 저장소를 비운다(이전 판 흔적 0, T-11-39).
  // 처음 받은 view 에는 하지 않는다. 월드는 서버 snap 이 통째로 바꾸므로 그 snap 이 이미 와 있으면 건드리지 않는다. setContext 보다 먼저 선언해 같은 커밋에서 비운 뒤 문맥을 넣는다.
  const prevRound = useRef<number | undefined>(undefined);
  const snapsSeen = useRef(0);
  useEffect(() => {
    if (view === null) return;
    const round = view.round ?? 1;
    const before = prevRound.current;
    prevRound.current = round;
    const freshSnap = worldSnaps.current !== snapsSeen.current;
    snapsSeen.current = worldSnaps.current;
    if (before === undefined || before === round) return;
    chat.reset();
    resultLog.reset();
    if (!freshSnap) store.reset();
  }, [view, chat, resultLog, store]);
  // view 가 바뀔 때마다 단계 키·내 채널·연결 epoch 를 알린다(셋 중 하나가 바뀌면 저장소가 입력 중을 끈다).
  const chatEpoch = connection.epoch;
  useEffect(() => {
    if (view === null) return;
    const day = view.day?.n;
    chat.setContext({ pk: phaseKey({ phase: view.phase, day, round: view.round }), channel: view.me.chat ?? null, epoch: chatEpoch });
  }, [chat, view, chatEpoch]);
  // 같은 접속에서 단계가 바뀌어 온 직전 단계. 역할 확인 → 낮 시작으로 DayScene 이 새로 마운트될 때 문구·배경 전환의 근거다(재접속·처음엔 null).
  const arrivedFrom = usePhaseArrival(phase, connection.epoch);
  useEffect(() => {
    if (phase === "lobby" || phase === "assigning") preloadRoleAssets();
  }, [phase]);
  // 맵 청크(three)는 역할 확인에서 낮 시작으로 넘어가기 전에 받아 둔다 — 낮 화면이 열릴 때 검은 화면이 단계 시간을 먹지 않게 한다(UI Considerations #32).
  useEffect(() => {
    if (phase === "assigning" || phase === "roleReveal") preloadWorld();
  }, [phase]);
  // 낮 토론에 들어서면 투표 단계가 쓸 해질녘 배경 하나를 미리 받는다(P-17). 어떤 역할이든 같은 요청 하나다(Pitfall 20).
  useEffect(() => {
    if (phase === "discussion") preloadDuskAssets();
  }, [phase]);

  // 역할 카드 시트(결정 0026): 열림·선택 탭과 "카드가 앞면이 된 적이 있는가" 는 단계 switch 밖에서 쥔다 —
  // 단계 화면이 바뀌어도 시트가 살아 있어야 한다(Pitfall 19 ⑧, UI-SPEC D).
  const [roleCard, setRoleCard] = useState<{ open: boolean; tab: RoleCardTab }>({ open: false, tab: "role" });
  const [seenFront, setSeenFront] = useState(false);
  // 맵 화면이 알리는 띠용 클라이언트 상태(15-07): 목격 기록을 열었는가·아침 흔적 구간인가. 같은 값이면 상태를 바꾸지 않는다
  // 18.1-12: 심부름 시작 카드가 떠 있는가(startCard)도 함께 — 카드가 같은 말을 하는 동안 띠 문장이 비는 데 쓴다
  const [hostLocal, setHostLocal] = useState<Pick<HostLocal, "recordOpened" | "traceOn" | "startCard">>({});
  const onHostLocal = useCallback((next: Pick<HostLocal, "recordOpened" | "traceOn" | "startCard">): void => {
    setHostLocal((prev) => (prev.recordOpened === next.recordOpened && prev.traceOn === next.traceOn && prev.startCard === next.startCard ? prev : next));
  }, []);
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

  // 함께 진행 튜토리얼(17-07, 결정 0080-15): 끝났음을 보낸 연결 번호. 서버로 가는 게임 메시지는 이 하나뿐이고 연결 번호당 한 번만 보낸다.
  // 같은 프레임에 [다음]·[건너뛰기]가 겹쳐도 ref 가 막는다. 연결 번호가 바뀌면(재접속) 화면의 로컬 끝남 표시는 어긋나 서버 값(me.tutorialDone)만 따른다.
  // tutorial 단계를 벗어나면 비운다 — 같은 연결에서 다음 판이 다시 튜토리얼을 거쳐도 기다림으로 바로 가지 않는다.
  const tutorialSentRef = useRef<number | null>(null);
  const [tutorialSentEpoch, setTutorialSentEpoch] = useState<number | null>(null);
  useEffect(() => {
    if (phase === "tutorial") return;
    tutorialSentRef.current = null;
    setTutorialSentEpoch(null);
  }, [phase]);
  const sendTutorialDone = (): void => {
    if (tutorialSentRef.current === connection.epoch) return;
    if (connection.send({ t: "tutorialDone" }) === false) return;
    tutorialSentRef.current = connection.epoch;
    setTutorialSentEpoch(connection.epoch);
  };

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
      {shown?.phase === "tutorial" && !shown.resting ? null : shown && !shown.resting && status !== "replaced" && status !== "failed" ? (
        <HostBand view={shown} offset={connection.offset} cardSeen={seenFront} local={hostLocal} sound={sound.supported ? sound : null} />
      ) : view && sound.supported ? (
        // 쉬는 사람·안내 화면에는 띠가 없다(T-14-04). 소리 단추만 옛 자리의 독으로 둔다
        <HostDock sound={sound} />
      ) : null}
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
          {view.resting ? READY_TEXT.rest : (PHASE_ANNOUNCE[view.phase]?.(view) ?? "")}
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

    // 쉬는 사람(11-12, D-3): 단계와 무관하게 BenchView 하나만 본다. 서버가 준 자기 한 줄 view 라 PreGame·GameMap 은 마운트하지 않는다(T-11-40)
    if (view.resting) {
      return (
        <div key="bench" className="mf-phase-enter">
          <BenchView view={view} store={store} send={connection.send} canSend={connection.canSend} offset={connection.offset} epoch={connection.epoch} onExit={() => onExit("left")} />
        </div>
      );
    }

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
      case "tutorial":
        // 서버가 이미 끝났음을 받았거나(me.tutorialDone) 이 연결에서 보냈으면 기다림, 아니면 장면 1 부터(T-20). 첫 사건 화면은 실제 연결을 받지 않고 onEnd 로만 끝났음을 알린다
        return view.me.tutorialDone === true || tutorialSentEpoch === connection.epoch ? (
          <TutorialWait view={view} offset={connection.offset} />
        ) : (
          <TutorialScreen mode="together" onEnd={sendTutorialDone} />
        );
      case "assigning":
      case "roleReveal":
        return (
          <PreGame view={view} store={store} send={connection.send} canSend={connection.canSend} offset={connection.offset} onLeave={() => onExit("gaveUp")}>
            {view.phase === "assigning" ? (
              <Assigning view={view} />
            ) : (
              <RoleReveal view={view} offset={connection.offset} myRoleButton={withTest(myRoleButton)} onSeenFront={onSeenFront} />
            )}
          </PreGame>
        );
      case "dayAnnounce":
      case "errand":
      case "discussion":
      case "nomination":
      case "runoff":
      case "showdown":
      case "defense":
      case "verdict":
      case "execution":
      case "night":
      case "morning":
        return (
          <GameMap
            view={view}
            send={connection.send}
            canSend={connection.canSend}
            offset={connection.offset}
            store={store}
            chat={chat}
            roleCard={{ unread: unread > 0, onOpen: () => setRoleCard({ open: true, tab: "role" }) }}
            testButton={testButton}
            announce={announce}
            toast={toast}
            deny={deny}
            fading={fading}
            ghostEnter={ghostEnter}
            killFx={killFx}
            policeResult={policeResult}
            letter={letter}
            onEvent={connection.onEvent}
            epoch={connection.epoch}
            onHostLocal={onHostLocal}
            onLeave={() => onExit("gaveUp")}
          />
        );
      case "ended":
        // 결과는 서버가 ended 에서만 모두에게 같게 싣는다(D-17). 없는 프레임(옛 서버 등)은 안내 화면으로 안전하게 폴백한다.
        return view.result ? (
          <ResultScreen
            view={{ ...view, result: view.result }}
            store={store}
            chat={chat}
            resultLog={resultLog}
            send={connection.send}
            canSend={connection.canSend}
            offset={connection.offset}
            epoch={connection.epoch}
            onExit={() => onExit("left")}
            arrivedFrom={arrivedFrom}
          />
        ) : (
          connecting()
        );
      default:
        return connecting();
    }
  }
}
