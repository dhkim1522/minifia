import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "react";
import type { ReactNode } from "react";
import { isAlive } from "../../shared/game/alive";
import { CHAT_MAX_GRAPHEMES } from "../../shared/game/chatRules";
import { canMoveIn } from "../../shared/game/movement";
import { RULES } from "../../shared/game/ruleset";
import { WILL_MAX_GRAPHEMES } from "../../shared/game/will";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { emitSignal } from "../audio/signals";
import { KillFx } from "../components/KillFx";
import { PoliceResultCard } from "../components/PoliceResultCard";
import { ResultAnnounce } from "../components/ResultAnnounce";
import { QuoteCard } from "../components/v2/QuoteCard";
import { WillLetter } from "../components/v2/WillLetter";
import type { WillLetter as WillLetterState } from "../net/useWillLetter";
import { SceneCurtain } from "../components/SceneCurtain";
import { PickTurnBlock } from "../components/v2/PickTurnBlock";
import { RoleCardButton } from "../components/RoleCardButton";
import { GamePhaseHeader, PhaseGauge } from "../components/v2/GamePhaseHeader";
import { TopToast, useTopToast } from "../components/v2/TopToast";
import { suspectChipShown } from "../components/v2/HeadStack";
import { CLAIM_ICON } from "../components/v2/ClaimBadge";
import { ClaimSheet } from "../components/v2/ClaimSheet";
import { FloatAction, FloatActions } from "../components/v2/FloatAction";
import { LineSheet } from "../components/v2/LineSheet";
import { SpeakSheet } from "../components/v2/SpeakSheet";
import { WillSheet } from "../components/v2/WillSheet";
import type { WillSheetProps } from "../components/v2/WillSheet";
import { TensionVignette } from "../components/TensionVignette";
import { WorldStage } from "../components/WorldStage";
import type { WorldPick } from "../components/WorldStage";
import { DEFENSE_MS } from "../../shared/game/phases";
import { ownAnimalOf } from "../game/playerIdentity";
import { jobOutfit } from "../world/jobOutfit";
import { todOf, todWordOf } from "../game/timeOfDay";
import { nightDarkOf } from "../game/nightDark";
import { BADGE_TEXT, chipsOf, claimLook, floatLabel } from "../game/badgeView";
import { WHISPER_TEXT } from "../game/whisperView";
import { SUSPECT_TEXT, suspectStacks } from "../game/suspectView";
import { headerFor } from "../game/dayView";
import { callTargetsOf, playtestResultLine } from "../game/hostLine";
import { blockModeOf, isMyTurn, turnStageOf, turnTopLine } from "../game/pickTurn";
import { isMySpeakTurn, pointSeatsOf, quoteOf, revealCounts, SHOWDOWN_COPY, showdownStageOf, speakerOf } from "../game/showdownView";
import type { ChatStore } from "../net/chatStore";
import type { DayFx } from "../net/useDayFx";
import { useCountdown } from "../net/countdown";
import { useBadge, useBadgeFx } from "../net/useBadge";
import { useChat } from "../net/useChat";
import { useMyMotion } from "../net/useMyMotion";
import { useTurnLook } from "../net/useTurnLook";
import { useVerdictMoment } from "../net/useVerdictMoment";
import { useSendGuard } from "../net/useSendGuard";
import { useSheetLayer } from "../net/useSheetLayer";
import { useViewChoice } from "../net/useViewChoice";
import { useSuspect } from "../net/useSuspect";
import { useWhisper } from "../net/useWhisper";
import { useWill } from "../net/useWill";
import { useMapInsets } from "../net/useMapInsets";
import { useReducedMotion } from "../net/useReducedMotion";
import type { RoomConnection } from "../net/useRoomConnection";
import { sceneLook } from "../world/presence";
import type { CameraMode } from "../world/presence";
import { worldTestHooksEnabled } from "../world/testHooks";
import type { RingKind } from "../world/runtime";
import type { WorldStore } from "../world/store";
import { GamePanel } from "./GamePanel";
import "../styles/game.css";
import "../styles/sheet.css";
import "../styles/testtools.css";

/** 단계가 시작되고 안내 한 줄이 보이는 시간(결정 0051-5: 안내는 한 번, 그리고 사라진다) */
const HINT_MS = 2500;
/** 서버가 단계 어긋난 행동을 거절했을 때 위 알림(UI-SPEC Copywriting Contract, 7페이즈 "지금은 보낼 수 없어요" 문구 계열) */
const REJECT_TEXT = "지금은 고를 수 없어요";
/** 지목이 단계 어긋남이 아닌 이유로 거절됐을 때 위 알림 */
const SEND_FAIL_TEXT = "보내지 못했어요. 다시 해 보세요";
/** 쪽지 시트 입력칸 안내(UI-SPEC 쪽지: 이름 없이 아침에 공개된다) */
const NOTE_PLACEHOLDER = "이름 없이 아침에 공개돼요";
/** 지목·밤 선택을 보낸 뒤 이 시간 안의 오류 프레임은 그 선택의 거절로 본다(서버는 거절을 곧바로 돌려준다) */
const PICK_REPLY_MS = 3000;
/** 스테이지 사각형을 아직 못 쟀을 때 WorldStage 기본값(헤더 아래 62 · 패널 250)과 같은 값 — 장면 표의 확대 판정에만 쓴다 */
const DEFAULT_INSET_TOP = 62;
const DEFAULT_INSET_BOTTOM = 250;
/** 보이는 화면(visualViewport) 높이가 이보다 낮으면 유언 시트 입력칸을 2줄로 줄인다(UI-SPEC 282행) */
const COMPACT_VV_MAX = 300;

/** 거절 알림이 머무는 시간(P24-7, 2.5초) */
const SUSPECT_NOTICE_MS = 2500;

/** 암살당한 본인의 연출 시간표(UI-SPEC 247~252행, 아침 view 를 받은 시각 기준): 0.7초에 놀란 표정, 2.8초까지 막 유지 */
const KILL_SURPRISE_MS = 700;
const KILL_HOLD_MS = 2800;

declare global {
  interface Window {
    /** 시민 편 긴장 큐가 울린 로컬 시각(Date.now) 목록 — ?e2e=1 문맥·개발 빌드에서만 생긴다(E3 #22) */
    __mfTension?: number[];
  }
}

/** E2E 훅이 켜진 문맥인가(WorldStage 의 window.__mfWorld 와 같은 규칙) */
function tensionHooksOn(): boolean {
  let store: Storage | null = null;
  try {
    store = typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    store = null;
  }
  return worldTestHooksEnabled(window.location.search, store, import.meta.env.DEV);
}

type WorldTagProps = NonNullable<ComponentProps<typeof WorldStage>["tagProps"]>;

interface GameMapProps {
  view: RoomView;
  /** RoomScreen 이 연결과 같은 수명으로 만들어 world 프레임을 먹이는 위치 스토어 */
  store: WorldStore;
  /** RoomScreen 이 연결과 같은 수명으로 만들어 채팅 프레임을 먹이는 채팅 저장소 */
  chat: ChatStore;
  /** 보냈으면 true, 소켓이 닫혀 못 보냈으면 false. 반환값이 없는 함수(void)는 보낸 것으로 본다 */
  send: (msg: ClientMessage) => boolean | void;
  /** 연결이 열려 있어 서버로 보낼 수 있는가. 기본 true */
  canSend?: boolean;
  /** 서버시각 − 로컬시각(ms) */
  offset?: number;
  /** 헤더의 [역할 카드] 아이콘 버튼 재료: 안 읽은 일지가 있는가와 여는 동작 */
  roleCard?: { unread: boolean; onOpen: () => void };
  headerAction?: ReactNode;
  /** 헤더 시간대 글자(0083-1, "낮 · 토론"). 튜토리얼만 false — 17·18 레이아웃을 건드리지 않는다. 기본 true */
  tod?: boolean;
  /** 아래 패널을 그리지 않는 지도 장면(18-03) */
  panelless?: boolean;
  /** 튜토리얼이 카메라를 정해 덮어쓴다(18-03, P18-8). 없으면 sceneLook 의 카메라 그대로 — 실제 판은 넘기지 않는다 */
  camera?: CameraMode;
  /** 테스트 방 방장의 [테스트] 버튼(결정 0022). 있으면 헤더 아래 왼쪽에 놓는다 */
  testButton?: ReactNode;
  /** 지금 띄울 결과 알림 글자·아이콘(useDayFx 가 서버 view 의 차이로 만든다). 없으면 null */
  announce?: DayFx["announce"];
  /** 처형 떠오름 연출 중인 좌석 → 시작 시각(useDayFx). 처형된 사람이 연출이 끝날 때까지 표에 남는다 */
  fading?: DayFx["fading"];
  /** 내가 유령이 된 순간마다 늘어나는 번호(useDayFx). 번호가 바뀔 때만 안내 한 줄과 직업 칩 등장을 다시 보인다 — 처음 마운트 때의 값은 지난 일이다 */
  ghostEnter?: DayFx["ghostEnter"];
  /** 암살당한 본인의 아침 연출 신호(useDayFx). 번호가 바뀔 때만 번쩍임·베기·놀란 표정을 한 번 재생하고 막을 2.8초까지 붙잡는다 — 처음 마운트 때의 값은 지난 일이다 */
  killFx?: DayFx["killFx"];
  /** 경찰 조사 결과 카드 신호(useDayFx). 값이 있는 0~2.4초 동안만 카드를 그린다 — 경찰 본인 화면에서만 값이 생긴다 */
  policeResult?: DayFx["policeResult"];
  /** 암살 유언 편지(useWillLetter, 결정 0063-3). 있으면 T0 에 화면 가운데로 올라오고, 편지가 보이는 동안 아침 알림은 편지 쪽(letter.announce)이 대신한다 */
  letter?: WillLetterState | null;
  /** 지목 선두가 새 사람으로 바뀌었을 때의 손사래 신호(WorldStage 로 그대로 넘긴다) */
  deny?: DayFx["deny"];
  /** 연결의 오류 프레임 구독(거절된 행동 알림에 쓴다) */
  onEvent?: RoomConnection["onEvent"];
  /** 연결 번호. 바뀐 첫 스냅샷은 배지 효과(팝·알약)를 내지 않고 현재 상태로 바로 그린다(09.1.1-08). 기본 0 */
  epoch?: number;
  /** 맵을 쓸 수 없는 기기의 불가 카드 [처음으로] */
  onLeave?: () => void;
  /** 튜토리얼 전용(24 D-31): 스테이지 아래 여백에 더하는 px(예: 튜토리얼 띠 묶음 60). 실제 판은 넘기지 않는다 — 기본 0 */
  bottomExtra?: number;
  /** 튜토리얼 전용(24 D-31): 참이면 머리의 시간 링·시간 행이 없다(머리에는 마감을 지운 view 사본을 주고, 스테이지·연출 부품에는 원래 view 를 준다). 실제 판은 넘기지 않는다 */
  timeless?: boolean;
}

/** 차례와 일반 단계는 같은 위치의 게이지를 쓰고, 차례 이름은 TurnBlock에서 보여 준다. */
function MapHeader({ view, offset, extra, tod, epoch, timeless }: { view: RoomView; offset: number; extra: ReactNode; tod: boolean; epoch: number; timeless: boolean }) {
  const blocked = blockModeOf(view) !== null;
  const turn = useTurnLook(view, offset);
  const title = view.phase === "verdict" && view.day?.firstBallot !== undefined ? "투표" : headerFor(view).title;
  const showTurnGauge = !timeless && turn !== null && (turn.stage === "turn" || turn.stage === "done");
  return (
    <GamePhaseHeader
      title={title}
      view={view}
      offset={offset}
      epoch={epoch}
      timeless={timeless || blocked}
      turnGauge={showTurnGauge ? <PhaseGauge seconds={turn.seconds} ratio={turn.ratio} tone={turn.tone} /> : null}
      {...(tod ? { tod: { id: todOf(view.phase), word: view.phase === "discussion" ? null : todWordOf(view.phase, title) } } : {})}
      extra={extra}
    />
  );
}

/**
 * 유언 시트. 유언 단계의 처형자(defenseEndsAt 가 있다)에게는 [남기기]·남은 초(P22-7·8)를 붙인다 — 남은 초 시계(useCountdown, 250ms)는 이 부품 안에 가둔다(화면 틀 전체가 다시 그려지지 않게).
 * 그 밖(밤 유언·낮 깃펜·쪽지)은 WillSheet 그대로다.
 */
function DefenseAwareWillSheet({ defenseEndsAt, offset, ...sheet }: WillSheetProps & { defenseEndsAt: number | null; offset: number }) {
  const { seconds } = useCountdown(defenseEndsAt ?? 0, DEFENSE_MS, offset);
  if (defenseEndsAt === null) return <WillSheet {...sheet} />;
  return <WillSheet {...sheet} saveLabel="남기기" savedLabel="남김" secondsLeft={seconds} />;
}

/** 차례 알약·막대·위 한 줄. 초 경계마다 다시 그리는 시계(useTurnLook)를 이 부품 안에 가둔다 */
function TurnBlock({ view, offset, line, compact, reducedMotion }: { view: RoomView; offset: number; line: string | null; compact: boolean; reducedMotion: boolean }) {
  const look = useTurnLook(view, offset);
  const quote = quoteOf(view);
  return <PickTurnBlock look={look} line={line} quote={quote === null ? null : { text: quote.text }} compact={compact} showClock={false} reducedMotion={reducedMotion} />;
}

// 8페이즈 게임 맵 화면 틀(08-13, UI-SPEC "게임 화면 틀"): 지하 재즈 바 맵(WorldStage) 위에 위쪽 가림막, 헤더(단계 이름 + 접히는 안내 + 시간 링 + [역할 카드]), [테스트], 결과 알림, 아래 패널을 얹는다.
// 낮 시작·낮 토론·찬반·지목·유언·처형이 이 화면 하나를 같은 장면 키로 그려 단계가 바뀌어도 맵이 다시 만들어지지 않는다.
// 화면은 서버가 보낸 view 만으로 다시 그린다. 닉네임(이름표)·알림 글자는 React 텍스트 노드로만 그린다.
export function GameMap({ view, store, chat, send, canSend = true, offset = 0, roleCard, headerAction, tod = true, panelless, camera, testButton, announce = null, deny, fading, ghostEnter = 0, killFx = null, policeResult = null, letter = null, onEvent, epoch = 0, onLeave, bottomExtra = 0, timeless = false }: GameMapProps) {
  const toast = useTopToast();
  const { show } = toast;
  // 스테이지 측정과 키보드 올림은 대기실과 같은 훅이다. 토론은 키보드가 열리면 기록 칸만 줄인다.
  // 지목이면 스테이지 윗변을 차례 알약 아랫변 + 4 로 내리고(UI-SPEC A-1) 작은 폰은 압축형 알약을 받는다(turnCompact). 알약 요소는 훅이 루트에서 `[data-turn-block]` 으로 찾는다.
  // 튜토리얼 지도 장면(panelless prop, 18-03)은 아래 패널이 없다: 스테이지가 띠 아래부터 화면 아래까지 넓어진다
  const playtest = view.playtest === true;
  const mapResult = playtest ? playtestResultLine(view) : undefined;
  const policeName = policeResult ? view.players.find((player) => player.seat === policeResult.seat)?.nickname ?? "" : "";
  const privateResult = playtest && policeResult ? `조사 결과 · ${policeName} · ${policeResult.isMafia ? "마피아" : "마피아 아님"}` : undefined;
  const toastText = playtest && toast.props.visible ? toast.props.text : undefined;
  const playtestPanel = mapResult !== undefined || privateResult !== undefined || toastText !== undefined || view.me.chat === "ghost" || view.phase === "discussion" || view.phase === "night" && view.spectate === undefined || view.phase === "verdict" || view.phase === "defense" && view.day?.candidate === view.me.seat;
  const noPanel = panelless === true || (playtest && !playtestPanel);
  const { rootRef, headerRef, panelRef, inputRef, kbOpen: kbLifted, kbInSheet, turnCompact: compactTurn, stageInsets: measuredInsets } = useMapInsets(blockModeOf(view) !== null, noPanel);
  // 튜토리얼(24 D-31): 아래 여백에 bottomExtra 를 더한다. 키보드 높이를 프레임마다 읽는 getter 는 그대로 살린다. 실제 판은 0 이라 측정값 그대로다.
  const stageInsets = useMemo(
    () =>
      measuredInsets !== undefined && bottomExtra > 0
        ? {
            top: measuredInsets.top,
            get bottom() {
              return measuredInsets.bottom + bottomExtra;
            },
          }
        : measuredInsets,
    [measuredInsets, bottomExtra],
  );
  // 머리용 view: 튜토리얼은 마감을 지워 시간 링이 없다. 스테이지·연출 부품은 원래 view 를 받는다
  const headerView = useMemo<RoomView>(() => (timeless ? { ...view, phaseEndsAt: null, phaseDurationMs: null } : view), [view, timeless]);
  // 키보드가 시트의 textarea 때문에 열린 것이면 채팅 패널을 줄이거나 행동 줄을 숨기지 않는다(시트를 연 버튼이 남아야 닫을 때 초점이 돌아온다). 패널은 키보드 위로 올라간다(lifted).
  const kbOpen = kbLifted && !kbInSheet;
  const motion = useMyMotion(store, view.me.seat, () => Date.now() + offset);
  const { typingSeats, liveWhisperIn, ...binding } = useChat({ store: chat, connection: { send, canSend }, view, motion });

  const myTurnNo = isMyTurn(view) ? view.day?.turn?.i : undefined;
  const showdownStage = showdownStageOf(view);

  // 유령이 된 순간(같은 단계 안이어도): 직업 칩 등장 연출을 2.5초 켠다(14-02: 헤더 안내 줄은 다시 띄우지 않는다 — 띠가 유령 줄을 말한다). 처음 마운트 때의 번호는 지난 일이라 연출하지 않는다.
  const seenGhostEnter = useRef(ghostEnter);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [entering, setEntering] = useState(false);
  useEffect(() => {
    if (ghostEnter === seenGhostEnter.current) return;
    seenGhostEnter.current = ghostEnter;
    setEntering(true);
    clearTimeout(enterTimer.current);
    // 타이머는 이 효과의 정리가 아니라 언마운트 때만 푼다(개발 모드 이중 실행이 첫 실행의 타이머를 지워 연출이 켜진 채 남지 않게)
    enterTimer.current = setTimeout(() => {
      setEntering(false);
    }, HINT_MS);
  }, [ghostEnter]);
  useEffect(() => () => clearTimeout(enterTimer.current), []);

  // 암살당한 본인: 번호가 바뀐 뒤 0.7초에 내 캐릭터가 놀란 표정을 짓는다(모션 줄이기면 표정 연출도 없이 바로 유령 상태). 처음 마운트 때의 번호는 지난 일이라 하지 않는다.
  // 번쩍임·베기는 KillFx 가, 막 붙잡기는 SceneCurtain(holdUntil)이 맡는다. 타이머는 언마운트 때만 푼다(ghostEnter 와 같은 이유).
  const reducedMotion = useReducedMotion();
  // 유언 편지: 편지가 화면에 보이는 동안(letterLive) 아침 알림은 편지가 대신 쥔다. 편지가 걷히면 알림도 함께 걷힌다(알림 시간은 편지보다 짧다)
  const [letterLive, setLetterLive] = useState(false);
  const letterInputTop = (): number | null => {
    const root = rootRef.current;
    const input = inputRef.current;
    return root !== null && input !== null ? input.getBoundingClientRect().top - root.getBoundingClientRect().top : null;
  };
  const shownAnnounce: DayFx["announce"] = letter !== null ? (letterLive ? letter.announce : null) : announce;
  const killNonce = killFx?.nonce ?? 0;
  const seenKill = useRef(killNonce);
  const killTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [surprise, setSurprise] = useState<{ seat: number; nonce: number } | undefined>(undefined);
  useEffect(() => {
    if (killNonce === seenKill.current) return;
    seenKill.current = killNonce;
    if (reducedMotion) return;
    const seat = view.me.seat;
    clearTimeout(killTimer.current);
    killTimer.current = setTimeout(() => setSurprise((s) => ({ seat, nonce: (s?.nonce ?? 0) + 1 })), KILL_SURPRISE_MS);
    // view 는 번호가 바뀐 그 렌더의 값(내 좌석)만 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [killNonce]);
  useEffect(() => () => clearTimeout(killTimer.current), []);

  // 서버가 행동을 거절하면(마감 직후 누름 등) 위 알림을 띄우고 내 낙관적 눌림·선택을 서버 값으로 되돌린다. 이동은 조용히 버려지고 오류 프레임이 없다.
  // 지목 직후(PICK_REPLY_MS 안, 서버가 아직 내 선택을 확인하지 않았을 때)의 거절은 지목 거절이다: 단계 어긋남(WRONG_PHASE)은 REJECT_TEXT,
  // 그 밖의 코드는 SEND_FAIL_TEXT. 지목을 보낸 적 없으면 그 밖의 코드는 알림도 되돌림도 만들지 않는다(채팅 속도 제한 등).
  const [rejects, setRejects] = useState(0);
  // 직업 배지(09.1.1-08)의 거절은 따로 센다 — 지목·유언 되돌림(rejects)과 섞이지 않게
  const [badgeRejects, setBadgeRejects] = useState(0);
  // 귓속말(09.1.1-09)의 거절도 따로 센다
  const [whisperRejects, setWhisperRejects] = useState(0);
  const sendGuard = useSendGuard();
  // 의심 거절·근처 0명 알림은 한 문구(P24-7): 위 알림 2.5초 + 소리 deny. 모드는 되돌리지 않는다
  const denySuspect = useCallback((): void => {
    show(SUSPECT_TEXT.tooFar, "postit", SUSPECT_NOTICE_MS, "data-suspect-notice");
    emitSignal({ kind: "deny" });
  }, [show]);
  const willBusy = useRef(false); // 유언·쪽지 저장 확인을 기다리는 중(useWill 이 쓴다)
  const pointSent = useRef<{ target: number; at: number } | null>(null);
  useEffect(() => {
    if (!onEvent) return;
    return onEvent((e) => {
      if (e.t !== "error") return;
      // 귓속말: 최근 3초 안에 보냈으면 어떤 오류 코드든 그 거절이다. 단계 어긋남은 "지금은 보낼 수 없어요", 그 밖은 "보내지 못했어요". 시트·입력은 그대로 둔다(고쳐 다시 보낼 수 있다)
      if (sendGuard.peek() === "whisper") {
        sendGuard.take();
        show(e.code === "WRONG_PHASE" ? WHISPER_TEXT.rejectPhase : WHISPER_TEXT.rejectOther);
        emitSignal({ kind: "deny" });
        setWhisperRejects((n) => n + 1);
        return;
      }
      // 의심(24-03): 최근 3초 안에 보냈으면 이 오류는 그 거절이다. 귓속말 바로 뒤·배지 분기 앞에 둔다 — take() 는 종류와 무관하게 기억을 지우므로 배지 분기가 먼저면 의심 거절이 삼켜진다.
      // 거절은 사유 구별 없이 BAD_MESSAGE 하나(D-26, 단계 어긋남 코드는 오지 않는다). 그 밖의 코드(채팅 속도 제한 등)는 알림 없이 기억만 지운다
      if (sendGuard.peek() === "suspect") {
        sendGuard.take();
        if (e.code === "BAD_MESSAGE") denySuspect();
        return;
      }
      // 직업 배지: 최근 3초 안에 보냈고 단계 어긋남·잘못된 요청이면 그 거절이다. 그 밖의 코드는 이 분기를 지나친다
      if ((e.code === "WRONG_PHASE" || e.code === "BAD_MESSAGE") && sendGuard.take() === "badge") {
        show(BADGE_TEXT.reject);
        emitSignal({ kind: "deny" });
        setBadgeRejects((n) => n + 1);
        return;
      }
      const sent = pointSent.current;
      if (sent !== null && Date.now() - sent.at < PICK_REPLY_MS) {
        pointSent.current = null;
        show(e.code === "WRONG_PHASE" ? REJECT_TEXT : SEND_FAIL_TEXT);
        emitSignal({ kind: "deny" });
        setRejects((n) => n + 1);
        return;
      }
      if (e.code !== "WRONG_PHASE" && e.code !== "BAD_MESSAGE") return;
      // 유언·쪽지 저장 중의 거절은 useWill 이 "보내지 못했어요" 한 번으로 알린다(알림 이중 방지)
      if (!willBusy.current) {
        show(REJECT_TEXT);
        emitSignal({ kind: "deny" });
      }
      setRejects((n) => n + 1);
    });
  }, [onEvent, show, sendGuard, denySuspect]);

  // 지목에는 표마다 띄우는 위 알림이 없다(차례 위 한 줄이 대신, UI-SPEC A-7). 동시 투표 화면은 22-10 에서 지웠다(D-12).

  // 이동 권한: 산 사람은 낮 시작·토론에서만, 유령은 언제나(MAP-04). 권위는 서버 canMove 이고 화면은 같은 표로 맵 탭만 막는다.
  const me = view.players.find((p) => p.seat === view.me.seat);
  const meAlive = me === undefined || isAlive(me);
  // 밤에는 산 사람 누구도 걷지 않는다(15페이즈 D-05) — 서버와 같은 이동 권한 표(canMoveIn)다.
  const canWalk = canMoveIn(view.phase, meAlive);
  // 유령 화면(GHOST-02, 결정 0021): 내가 탈락했고 서버가 관전 정보(spectate)를 보냈을 때만 그린다. 서버가 안 보낸 view 에서는 이 분기가 아예 없다 — 받아서 감추는 방식이 아니다.
  const spectate = !meAlive ? view.spectate : undefined;
  const ghost = spectate !== undefined;

  // 장면 표(보임·유령·카메라·조명·긴장): 서버 공개 정보로만 만든다. view 가 바뀔 때만 새로 만든다(타이머 틱으로 WorldStage 를 흔들지 않는다).
  const stageH = Math.max(0, window.innerHeight - (stageInsets?.top ?? DEFAULT_INSET_TOP) - (stageInsets?.bottom ?? DEFAULT_INSET_BOTTOM));

  // 지목 단계(DAY-04): 산 사람은 나를 뺀 산 사람의 이름표를 눌러 가리킨다. 내 선택만 서버 응답 전에 보이고(낙관적), 서버 view 가 오면 서버 값(day.points 의 내 줄, 가정 A1)이 이긴다.
  // 남의 지목·득표·선두·과반은 서버가 보낸 day.points 로만 그린다(T-08-38).
  const nominating = view.phase === "nomination";
  // 밤 선택: 산 사람 모두 아래 패널 얼굴 목록(GamePanel)으로 고른다(D-05) — 지도 이름표로 고르는 길은 없다.
  const nighting = view.phase === "night";
  // 시민 편(산 시민·경찰·의사)의 밤: 같은 어둠 표식과 긴장 비네트를 본다. 역할마다 다르지 않다(NIGHT-10, E3 #20). 마피아·유령·낮에는 없다.
  // 판정식은 nightDarkOf 하나다 — RoomScreen 이 같은 식으로 소리의 시각 큐 갈래를 정한다(12-09).
  const nightDark = !playtest && nightDarkOf(view);
  const recordCue = useMemo(
    () =>
      tensionHooksOn()
        ? (): void => {
            (window.__mfTension ??= []).push(Date.now());
          }
        : undefined,
    [],
  );
  // 시각 큐가 울릴 때마다 소리에 신호 하나(12-09, D-11). 인자 없음 — 소리는 시각 맥박과 같은 박자로만 난다. E2E 기록(recordCue)은 그대로 부른다.
  const onTensionCue = useCallback((): void => {
    emitSignal({ kind: "tensionCue" });
    recordCue?.();
  }, [recordCue]);
  // 동점 결선(09.1.1-14): 후보가 아닌 산 사람이 투표 창(step 1)에 후보 둘 중 하나를 누른다. 서버 값은 view.me.ballot(본인에게만 온다)
  const runoff = view.phase === "runoff" ? view.day?.runoff : undefined;
  const runoffVoting = runoff !== undefined && runoff.step === 1 && meAlive && canSend && !runoff.cand.includes(view.me.seat);
  // 마지막 3인 동시 지목(09.1.1-15, UI-SPEC E-3): 산 세 사람이 나를 뺀 두 사람의 이름표를 직접 눌러 가리킨다(마감까지 바꾸기 가능). 서버 값은 view.me.ballot(본인에게만 온다)
  const showdownPointing = showdownStage === "point" && canSend && pointSeatsOf(view).length > 0;
  const serverMine = nominating
    ? view.day?.points?.find((l) => l.seat === view.me.seat)?.target
    : nighting
    ? view.me.pick
    : runoff !== undefined || showdownStage === "point"
    ? view.me.ballot
    : undefined;
  const [mine, chooseMine] = useViewChoice<number | undefined>(view, serverMine);
  // 순차 지목(결정 0063-1): 이름표는 내 차례에만 버튼이다. 누르면 그 차례는 끝난다 — 깜빡임·버튼이 사라지고 취소·바꾸기는 없다.
  // pickedTurn = 내가 이미 누른 차례 번호. 서버가 거절하면 비워 다시 고를 수 있게 한다.
  const [pickedTurn, setPickedTurn] = useState<number | undefined>(undefined);
  const canPick = nominating && meAlive && myTurnNo !== undefined && pickedTurn !== myTurnNo && mine === undefined;
  // 빛남(14-04, HOST-03·04, U-7): 13 의 투표 처음 3초 깜빡임을 대체한다. 대상은 callTargetsOf(view)(공개 정보·내 역할만) 하나가 정하고,
  // 같은 단계 안에서 내가 그 도구를 쓰면 즉시 꺼져 되살아나지 않는다(서버가 거절해도 다시 켜지 않는다). "썼음" 은 단계 키(단계·일차·변론자) 하나로 쥐어 키가 바뀌면 자동으로 풀린다.
  // 내 행동만으로 끄는 로컬 상태이고 남의 행동·서버 값을 미리 그리지 않는다(T-14-13). 빛은 소리를 내지 않는다.
  const callKey = `${view.phase}:${view.day?.n ?? 0}:${view.day?.candidate ?? ""}`;
  const [callUsedKey, setCallUsedKey] = useState<string | null>(null);
  const markCallUsed = useCallback((): void => setCallUsedKey(callKey), [callKey]);
  const callUsed = callUsedKey === callKey;
  // 서버가 내 선택을 확인했으면 더는 거절을 기다리지 않는다. 거절이 오면 내 선택을 서버 값으로 되돌린다(처음 그릴 때는 아무것도 하지 않는다).
  useEffect(() => {
    if (pointSent.current !== null && serverMine === pointSent.current.target) pointSent.current = null;
  }, [view, serverMine]);
  const seenRejects = useRef(rejects);
  useEffect(() => {
    if (seenRejects.current === rejects) return;
    seenRejects.current = rejects;
    chooseMine(serverMine);
    setPickedTurn(undefined);
    // chooseMine 은 렌더마다 새 함수지만 setState 만 부른다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejects]);
  // 누를 수 있는 좌석: 지목은 나를 뺀 산 사람(밤 고르기는 아래 패널 얼굴 목록이 한다).
  const runoffCand = runoff?.cand;
  const pickSeats = useMemo(() => {
    if (canPick) return new Set(view.players.filter((p) => isAlive(p) && p.seat !== view.me.seat).map((p) => p.seat));
    if (runoffVoting && runoffCand !== undefined) return new Set<number>(runoffCand);
    if (showdownPointing) return new Set<number>(pointSeatsOf(view));
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPick, runoffVoting, runoffCand, showdownPointing, view.players, view.me.seat, view.day?.showdown?.order]);
  // 귓속말(09.1.1-09, UI-SPEC B): 모드·한 줄 시트·보내기는 useWhisper 가 쥔다. 모드에서는 나를 뺀 산 사람의 이름표가 버튼이 된다(낮 토론이라 지목·밤 선택의 pickSeats 와 겹치지 않는다).
  const whisper = useWhisper({ view, send, canSend, rejected: whisperRejects, guard: sendGuard });
  // [의심](24-03, D-10): 모드·근처 판정(서버 구간)·보내기는 useSuspect 가 쥔다. 귓속말 모드와 동시에 켜지지 않는다(D-24) — 한쪽 단추가 먼저 다른 쪽을 끈다.
  const suspect = useSuspect({ view, store, offset, send, canSend, guard: sendGuard });
  // 받은 순간 위 알림 "{A} 님의 귓속말"(본문 없음). 라이브로 받은 줄만 번호가 바뀐다 — 재접속 복원 줄·내가 보낸 줄은 알림이 없다. 처음 마운트 때의 번호는 지난 일이다
  const whisperInNonce = liveWhisperIn?.nonce ?? 0;
  const seenWhisperIn = useRef(whisperInNonce);
  useEffect(() => {
    if (liveWhisperIn === null || whisperInNonce === seenWhisperIn.current) return;
    seenWhisperIn.current = whisperInNonce;
    show(WHISPER_TEXT.received(view.players.find((p) => p.seat === liveWhisperIn.seat)?.nickname ?? ""), "whisper");
    // 번호가 바뀔 때만 한 번 — 알림 글자는 그 렌더의 view 로 만든다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whisperInNonce]);
  const pick: WorldPick | undefined = suspect.mode
    ? {
        seats: suspect.targets,
        // 연결이 끊긴 동안은 버튼이 aria-disabled 이고 눌러도 보내지 않는다
        ...(canSend ? {} : { disabled: true as const }),
        label: SUSPECT_TEXT.target,
        onPick: (seat) => {
          suspect.pick(seat);
          panelRef.current?.querySelector<HTMLButtonElement>('[data-suspect-btn]')?.focus({ preventScroll: true });
        },
        group: SUSPECT_TEXT.ready,
        attr: "data-suspect-tag",
      }
    : whisper.mode
    ? { seats: whisper.targets, label: WHISPER_TEXT.tagLabel, onPick: whisper.pick, group: WHISPER_TEXT.groupLabel }
    : pickSeats
    ? {
        seats: pickSeats,
        ...(mine !== undefined ? { mine } : {}),
        // 연결이 끊긴 동안은 버튼이 aria-disabled 이고 눌러도 보내지 않는다(UI-SPEC "연결 끊김")
        ...(canSend ? {} : { disabled: true as const }),
        label: (nickname) => (runoffVoting ? `${nickname} 님에게 투표` : showdownPointing ? SHOWDOWN_COPY.pointLabel(nickname) : `${nickname} 님 가리키기`),
        onPick: (seat) => {
          if (seat === mine) return; // 이미 고른 후보를 다시 눌러도 보내지 않는다. 다른 후보를 누르면 마감까지 바꿀 수 있다(결선)
          if (send({ t: "point", target: seat }) === false) return; // 소켓이 닫혀 못 보냈으면 표시도 바꾸지 않는다
          pointSent.current = { target: seat, at: Date.now() };
          chooseMine(seat);
          if (nominating) setPickedTurn(myTurnNo);
        },
        group: runoffVoting ? "결선" : showdownPointing ? SHOWDOWN_COPY.pointGroup : "지목",
      }
    : undefined;

  // 이름표 쌓임: 득표 배지·선두(맥박)·과반 도장은 서버가 센 집계에서만 나온다. 0표 이름표에는 배지가 없다.
  const verdicting = view.phase === "verdict";
  const defending = view.phase === "defense";
  const baseTagProps = useMemo<WorldTagProps | undefined>(() => {
    // 찬반(22-10, D-26): 이름표에 아무것도 붙이지 않는다 — 누가 던졌는지는 서버도 보내지 않고 집계 수는 아래 패널 숫자 줄이 보인다
    if (verdicting) return undefined;
    // 유언 단계(22-11 P22-10, UI-SPEC D): 이름표에 아무것도 붙이지 않는다 — 득표 배지·유력 도장·손가락 없이 처형자 스포트라이트(핀·콘 조명)만 비춘다
    if (defending) return undefined;
    // 밤 발밑 고리(A2 임시 예외): 유령만 — 서버가 유령에게만 보낸 spectate.picks(한 좌석에 여럿이면 마피아 → 경찰 → 의사 하나).
    // 산 사람 화면(마피아 포함)에는 고리·배지가 없다(D-05) — 선택은 아래 얼굴 목록이 보인다.
    if (nighting) {
      if (!spectate?.picks) return undefined;
      const rings = new Map<number, RingKind>();
      for (const kind of ["mafia", "police", "doctor"] as const) for (const seat of spectate.picks[kind]) if (!rings.has(seat)) rings.set(seat, kind);
      if (rings.size === 0) return undefined;
      return (seat) => {
        const ring = rings.get(seat);
        return ring !== undefined ? { ring } : {};
      };
    }
    // 동점 결선(09.1.1-14, UI-SPEC D-2): 던진 사람 이름표에 done 체크만(누가 누구를은 서버가 주지 않는다). 후보 머리 위 배지는 결과(step 2)에만 결선 득표 tally 의 두 값 — 지목 때 받은 득표 기록은 없다(22-12 D-25)
    if (runoff !== undefined) {
      const voted = new Set(runoff.voted ?? []);
      return (seat) => {
        const ci = runoff.cand.indexOf(seat);
        const count = ci < 0 || runoff.step !== 2 ? 0 : (runoff.tally?.[ci] ?? 0);
        return {
          ...(runoffVoting && pickSeats?.has(seat) ? { blink: true } : {}),
          ...(mine === seat ? { mine: true } : {}),
          ...(voted.has(seat) ? { done: true } : {}),
          ...(count >= 1 ? { count } : {}),
        };
      };
    }
    // 마지막 3인(09.1.1-15, UI-SPEC E-2·E-3): 말하는 사람(차례 중·확정 뒤 사이)에게 발밑 흰 고리와 맨 앞 이름표.
    // 동시 지목에는 눌러야 할 이름표가 깜빡이고, 던진 사람(day.showdown.voted)에게 done 체크만 붙는다(누가 누구를은 마감 전에 없다). 득표 배지는 공개(i 4)에서 한꺼번에 뜬다
    if (view.phase === "showdown") {
      const speaker = speakerOf(view);
      const voted = new Set(view.day?.showdown?.voted ?? []);
      const counts = revealCounts(view);
      return (seat) => ({
        ...(showdownPointing && pickSeats?.has(seat) ? { blink: true } : {}),
        ...(showdownStage === "point" && mine === seat ? { mine: true } : {}),
        ...(voted.has(seat) ? { done: true } : {}),
        ...((counts[seat] ?? 0) >= 1 ? { count: counts[seat] } : {}),
        ...(speaker === seat ? { ring: "turn" as const, turn: true } : {}),
      });
    }
    if (!nominating) return undefined;
    // 순차 지목(22-10): 득표 배지·선두·도장은 없다(D-12) — 누가 누구를 골랐는지는 위 한 줄·핀·손가락이 보이고 집계는 끝 줄이 말한다.
    // 차례인 사람은 발밑 흰 고리와 맨 앞 이름표(모이는 중·끝 알림에는 없다).
    const stage = turnStageOf(view);
    const turn = view.day?.turn;
    const turnSeat = (stage === "turn" || stage === "done") && turn !== undefined ? turn.order[turn.i] : undefined;
    return (seat) => {
      return {
        ...(canPick && pickSeats?.has(seat) ? { blink: true } : {}),
        ...(mine === seat ? { mine: true } : {}),
        ...(turnSeat === seat ? { ring: "turn" as const, turn: true } : {}),
      };
    };
  }, [nominating, nighting, mine, spectate, verdicting, defending, view, canPick, pickSeats, runoff, runoffVoting, showdownPointing, showdownStage]);

  // 유령 화면의 이름표: 모든 이름표 위에 그 사람의 직업 칩(spectate.seats 의 job), 죽은 좌석은 반투명. 산 사람 view 에는 spectate 가 없어 이 겹침이 없다.
  const roleTagProps = useMemo<WorldTagProps | undefined>(() => {
    if (spectate === undefined) return baseTagProps;
    const jobs = new Map(spectate.seats.map((s) => [s.seat, s.job] as const));
    const deadSeats = new Set(view.players.filter((p) => !isAlive(p)).map((p) => p.seat));
    return (seat) => {
      const job = jobs.get(seat);
      return { ...(baseTagProps?.(seat) ?? {}), ...(job !== undefined ? { role: job } : {}), ...(deadSeats.has(seat) ? { ghost: true } : {}) };
    };
  }, [spectate, baseTagProps, view.players]);
  // 유언·쪽지 시트(WILL-01·NIGHT-12): 상태와 저장 흐름은 useWill 이 쥔다. 실패 알림은 위 알림 한 문구다.
  const will = useWill({ view, send, canSend, offset, rejected: rejects, onFail: () => show(SEND_FAIL_TEXT), busyRef: willBusy });
  // 유언 단계의 처형자 시트는 아래 패널을 대신한다(22-11 P22-6): 패널이 가려지고 시트가 패널 자리(키보드 위 또는 화면 아래)에 앉는다.
  const sheetReplacesPanel = will.open === "will" && will.condemned;

  // 마지막 3인 한마디(09.1.1-15, UI-SPEC E-2): 내 미확정 차례에 채팅 패널 자리를 칩 시트가 덮는다. 칩·직접 쓰기 모두 기존 채팅 전송(binding.onSend)이고 서버가 차례 주인의 글을 한마디로 확정한다.
  // 한 차례에 한 번뿐이다: 보낸 차례 번호(spokenTurn)를 기억해 서버가 확정하기 전에도 시트를 다시 열지 않는다. 보낸 뒤 서버가 채팅을 거절하면(새 chatReject) 다시 연다.
  const speakTurn = isMySpeakTurn(view) ? view.day?.showdown?.i : undefined;
  const [spokenTurn, setSpokenTurn] = useState<number | undefined>(undefined);
  const [speakWriting, setSpeakWriting] = useState(false);
  const [speakDraft, setSpeakDraft] = useState("");
  const speakOpen = speakTurn !== undefined && spokenTurn !== speakTurn;
  const chatRejectN = chat.lastReject()?.n ?? 0;
  const sentRejectN = useRef(chatRejectN);
  useEffect(() => {
    setSpeakWriting(false);
    setSpeakDraft("");
    if (speakTurn === undefined) setSpokenTurn(undefined);
  }, [speakTurn]);
  useEffect(() => {
    if (spokenTurn !== undefined && chatRejectN !== sentRejectN.current) setSpokenTurn(undefined);
    // 새 거절이 올 때만 본다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatRejectN]);
  // 시트가 완전히 닫히면(보냄·확정) 시트 안에 있던 초점을 채팅 입력으로 돌려준다(UI-SPEC 접근성). 터치 기기는 키보드가 불쑥 올라오지 않게 정밀 포인터(PC)에서만 한다.
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (speakOpen || !restoreFocus.current) return;
    restoreFocus.current = false;
    if (typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus({ preventScroll: true });
  }, [speakOpen, inputRef]);
  const sendWord = (text: string): void => {
    if (speakTurn === undefined || !canSend) return;
    restoreFocus.current = document.activeElement?.closest("[data-speak-sheet],[data-line-sheet]") != null;
    sentRejectN.current = chatRejectN;
    setSpokenTurn(speakTurn);
    setSpeakWriting(false);
    binding.onSend?.(text);
  };

  // 직업 주장 배지(09.1.1-08, UI-SPEC A): 칩 시트·낙관 값·거절 되돌림은 useBadge 가 쥔다. 유언 시트와 배지 시트는 같은 시트 층을 번갈아 쓴다(동시에 열리지 않는다).
  const badge = useBadge({ view, send, canSend, rejected: badgeRejects, guard: sendGuard });
  // 시트 층 하나를 유언·배지·귓속말 한 줄 시트가 번갈아 쓴다 — 한 번에 시트 하나만(귓속말은 열려 있는 다른 시트를 닫고 열린다)
  const layerKind: "will" | "claim" | "line" | "speak" | null =
    will.open !== null ? "will" : badge.open && badge.allowed ? "claim" : whisper.target !== null && whisper.allowed ? "line" : speakOpen && speakWriting ? "speak" : null;
  // 시트 층의 아래 끝 = 아래 패널 위 끝 + 8 (키보드 위). 패널을 가릴지 판정하는 논리는 useSheetLayer 로 옮겼다(논리 변경 없음).
  const sheetLayer = useSheetLayer({ open: layerKind !== null, panelRef, stageTop: stageInsets?.top ?? DEFAULT_INSET_TOP });
  const { layerRef, vvHeight } = sheetLayer;
  const veiled = sheetLayer.veiled || sheetReplacesPanel;

  // 이름표 모서리 배지: 서버 view.players 에서만 만든다(내 좌석만 낙관 값을 겹친다). 기존 키는 덮어쓰지 않는다. 주장이 하나도 없고 낙관 값도 없으면 기존 함수 그대로(이름표에 넘기는 속성이 없다)
  const badgeFx = useBadgeFx(view, epoch, reducedMotion);
  const { pops: claimPops, notices: claimNotices } = badgeFx;
  const claimTagProps = useMemo<WorldTagProps | undefined>(() => {
    const anyClaim = view.players.some((p) => p.badge !== undefined);
    if (!anyClaim && badge.shown === badge.server) return roleTagProps;
    return (seat) => {
      const base = roleTagProps?.(seat) ?? {};
      const look = claimLook(view, seat, seat === view.me.seat ? badge.shown : undefined);
      if (look === null) return base;
      const pop = claimPops.get(seat);
      return { claim: look.claim, claimSwapped: look.swapped, ...(pop !== undefined ? { claimPop: pop } : {}), ...(claimNotices.has(seat) ? { claimNotice: true } : {}), ...base };
    };
  }, [roleTagProps, view, badge.shown, badge.server, claimPops, claimNotices]);

  // 귓속말 모드: 대상 이름표가 깜빡이는 버튼이 된다(모션 줄이기는 CSS 가 gray-100 2px 고정 테두리). 모드가 아니면 위 함수 그대로(이름표에 넘기는 속성이 없다)
  // 빛남 대상(14-04): 열린 시트·키보드·귓속말 모드·이미 썼음이면 켜지 않는다. 한 화면에는 한 종류(tool 하나 / 이름표 무리 / 얼굴 칸 무리)만 나온다.
  // 마피아 밤·산 시민·유령·할 일 없는 사람은 callTargetsOf 가 null 이라 빛이 0개다(HOST-05).
  const callTarget = useMemo(() => callTargetsOf(view), [view]);
  const callOn = !playtest && callTarget !== null && !callUsed && layerKind === null && !kbOpen && !whisper.mode && !suspect.mode;
  const callTool = callOn && callTarget.kind === "tool" ? callTarget.tool : null;
  const callFaceSeats = useMemo<ReadonlySet<number> | undefined>(
    () => (callOn && callTarget.kind === "tag" && nighting && view.me.pick === undefined ? new Set(callTarget.seats) : undefined),
    [callOn, callTarget, nighting, view.me.pick],
  );
  // 의심 칩 값(P24-16): 받은 종이 수. 남은 4장 이상, 나는 1장 이상일 때만 이름표에 값이 실린다(공개 view 값 — 누설 없음)
  const suspectStack = useMemo(() => suspectStacks(view), [view]);
  const suspectChips = useMemo(() => {
    const out = new Map<number, number>();
    for (const [seat, from] of suspectStack) if (suspectChipShown(from.length, seat === view.me.seat)) out.set(seat, from.length);
    return out;
  }, [suspectStack, view.me.seat]);
  const stageTagProps = useMemo<WorldTagProps | undefined>(() => {
    if (!whisper.mode && !suspect.mode && suspectChips.size === 0) return claimTagProps;
    return (seat) => ({
      ...(claimTagProps?.(seat) ?? {}),
      ...(whisper.mode && whisper.targets.has(seat) ? { blink: true } : {}),
      ...(suspect.mode && suspect.targets.has(seat) ? { blink: true } : {}),
      ...(suspectChips.has(seat) ? { suspect: suspectChips.get(seat) } : {}),
    });
  }, [whisper.mode, whisper.targets, suspect.mode, suspect.targets, suspectChips, claimTagProps]);
  // E2E 표식 data-suspects="좌석:장수,…"(0장 생략, 공개 값). ?e2e=1 문맥에서만(recordCue 와 같은 판정) — 3D 종이는 DOM 이 아니라서 이것으로 거울을 본다
  const suspectsMirror = useMemo(
    () => (recordCue === undefined || suspectStack.size === 0 ? undefined : [...suspectStack].sort((a, b) => a[0] - b[0]).map(([seat, from]) => `${seat}:${from.length}`).join(",")),
    [recordCue, suspectStack],
  );

  // 아래 패널 높이(--mf-panel-h)는 DOM 에서 재서 루트에 한 번 정한다(패널이 자라도 따라간다). 떠 있는 버튼 묶음(아래 끝 = 키보드 올림 + 패널 높이 + 8)과
  // 찬반 기록 묶음(09.1.1-13)이 CSS 상속으로 같은 값을 읽는다
  const floatRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    rootRef.current?.style.setProperty("--mf-panel-h", `${panelRef.current?.offsetHeight ?? 0}px`);
  });

  // 위 한 줄: 처음 마운트한 view(재접속·새로 고침)의 (단계, 차례) 와 같은 동안은 만들지 않는다(A-6). 결선은 (결선, step)
  const blockMode = blockModeOf(view);
  const turnKey =
    blockMode === "runoff"
      ? `runoff:${view.day?.runoff?.step}`
      : showdownStage !== null
      ? `showdown:${showdownStage}:${view.day?.showdown?.i}`
      : turnStageOf(view) === null
      ? null
      : `${turnStageOf(view)}:${view.day?.turn?.i}`;
  const firstTurnKey = useRef<string | null | undefined>(undefined);
  if (firstTurnKey.current === undefined) firstTurnKey.current = turnKey;
  const topLine = turnKey !== null && turnKey === firstTurnKey.current ? null : turnTopLine(view);

  const turnStage = turnStageOf(view);
  // 결선은 전 구간 어둡게(UI-SPEC D-1: 실내등 0.6배)
  // 마지막 3인(09.1.1-15)은 모이기·한마디·동시 지목에 어둡게, 공개에는 걷는다
  const dimOn = turnStage === "gather" || turnStage === "turn" || turnStage === "done" || blockMode === "runoff" || showdownStage === "gather" || showdownStage === "speak" || showdownStage === "point";

  // 판결 순간(UI-SPEC C-1, 22-12 P22-13·P22-14): 처형자 존재 기준 처형 진입 시각의 어둡게 막·카메라 줌·유언 공개 카드(0~3.0초). 모션 줄이기는 줌 없이 막·핀·카드만 쓴다
  const moment = useVerdictMoment(view, offset);
  const verdictZoom = moment.active && !reducedMotion && !playtest ? moment.zoom : undefined;
  const investigated = policeResult === null ? undefined : view.players.find((player) => player.seat === policeResult.seat);
  const whisperPeer = whisper.target === null ? undefined : view.players.find((player) => player.seat === whisper.target);

  const scene = useMemo(() => {
    const look = sceneLook(view, { stageH, ...(fading ? { fading } : {}), ...(mine !== undefined ? { mine } : {}), ...(verdictZoom !== undefined ? { verdictZoom } : {}) });
    if (camera) look.camera = camera;
    // 역할 확인을 마친 게임 맵에서만 내 비공개 역할을 내 모델에 입힌다. 공개 의상과 다른 좌석은 그대로다.
    const ownSeat = look.seats[view.me.seat];
    const role = view.me.role;
    const ownRoleOutfit = role === "mafia" || (ownAnimalOf(view) !== undefined && (role === "police" || role === "doctor"));
    if (ownSeat && meAlive && view.spectate === undefined && ownRoleOutfit) ownSeat.costume = jobOutfit(role);
    return look;
  }, [view, stageH, fading, mine, verdictZoom, camera, meAlive]);

  return (
    <main ref={rootRef} className="mf-root mf-game" data-game-stage="" data-phase={view.phase} data-night-dark={nightDark ? "true" : undefined} data-ghost-view={ghost ? "true" : undefined} data-ghost-enter={ghost && entering ? "true" : undefined} data-kb-open={kbLifted ? "true" : undefined} data-suspect-mode={suspect.mode ? "on" : "off"} data-suspects={suspectsMirror}>
      {/* DOM 순서 = Tab 순서: 헤더 조작 → 맵 이름표 → 아래 패널 입력 */}
      <div className="mf-game__scrim" aria-hidden="true" />
      <header ref={headerRef} className="mf-game__header">
        <MapHeader
          view={headerView}
          offset={offset}
          epoch={epoch}
          timeless={timeless}
          tod={tod && !playtest}
          extra={(
            <>
              {testButton ? <div className="mf-game__test">{testButton}</div> : null}
              {headerAction ?? (roleCard ? <RoleCardButton iconOnly unread={roleCard.unread} onOpen={roleCard.onOpen} /> : null)}
            </>
          )}
        />
      </header>
      <WorldStage
        view={view}
        store={store}
        send={send}
        canSend={canSend}
        offset={offset}
        {...(stageInsets ? { stageInsets } : {})}
        typingSeats={typingSeats}
        scene={scene}
        canWalk={canWalk}
        underlay={
          playtest ? null : nightDark ? (
            <TensionVignette reducedMotion={reducedMotion} onCue={onTensionCue} />
          ) : (
            // 지목 동안 화면을 살짝 어둡게(UI-SPEC A-1): 모이기·차례·확정에 켜고 끝 알림에 걷는다. 캔버스 위·이름표 층 아래라서 WorldStage 의 underlay 자리에 둔다
            <div className="mf-game__dim" aria-hidden="true" data-dim={moment.darken ? "verdict" : dimOn ? "on" : "off"} />
          )
        }
        {...(deny ? { deny } : {})}
        {...(surprise ? { surprise } : {})}
        {...(pick ? { pick } : {})}
        {...(stageTagProps ? { tagProps: stageTagProps } : {})}
        onNotice={(text) => show(text)}
        onLeave={() => onLeave?.()}
      />
      {!playtest ? <TopToast {...toast.props} /> : null}
      {/* 붙인 사람에게만 읽히는 한 줄(P24-8) — 서버 view(me.suspectTo)가 확인한 뒤에만 채워진다. 화면에는 안 보인다 */}
      {suspect.visible ? (
        <div className="mf-sr-only" role="status" data-suspect-said="">
          {suspect.said}
        </div>
      ) : null}
      {/* 누가 배지를 걸거나 바꿨을 때 읽히는 한 줄(화면에는 안 보인다). 판 규칙 RULES 에서 주장이 꺼져 있으면 줄 자체를 만들지 않는다(결정 0072·U-8, E2E basic-off) */}
      {RULES.badge ? (
        <div className="mf-sr-only" role="status" data-badge-live="">
          {badgeFx.said}
        </div>
      ) : null}
      {/* 알약·막대·위 한 줄은 순차 지목·결선·마지막 3인에만 있다. 기본판 동시 투표(day.turn 없음)는 DOM 이 없다([data-turn-block] 0) */}
      {blockMode !== null ? <TurnBlock view={view} offset={offset} line={topLine} compact={compactTurn} reducedMotion={reducedMotion} /> : null}
      {/* 장면 전환 막(09-20): 결과 알림보다 앞(DOM 순서)에 두어 막을 붙잡는 동안 알림이 막 위로 올라올 수 있게 한다. 덮기는 공개 마감만의 함수다 */}
      {!playtest ? <SceneCurtain view={view} offset={offset} reducedMotion={reducedMotion} {...(killFx !== null ? { holdUntil: killFx.at + KILL_HOLD_MS } : {})} /> : null}
      {!playtest ? <KillFx nonce={killNonce} reducedMotion={reducedMotion} /> : null}
      {!playtest ? <ResultAnnounce text={shownAnnounce?.text || null} {...(shownAnnounce?.icon !== undefined ? { icon: shownAnnounce.icon } : {})} {...(shownAnnounce?.label !== undefined ? { label: shownAnnounce.label } : {})} {...(shownAnnounce?.still === true ? { still: true } : {})} {...(letter !== null || moment.active ? { placement: "top" as const } : {})} /> : null}
      {/* 유언 공개 카드(P22-11): 처형 단계 0~3.0초 모두의 화면. 독 아랫변 + 8, 폭 = 화면 − 32, 누를 수 없다. 사라질 때는 dur-med 페이드 */}
      {!playtest && moment.will !== null ? (
        <div className="mv-will-reveal">
          <QuoteCard text={moment.will.text} visible={moment.will.visible} still={moment.will.still} will />
        </div>
      ) : null}
      {!playtest && letter !== null ? <WillLetter key={`${letter.t0}:${letter.seat}`} letter={letter} reducedMotion={reducedMotion} getInputTop={letterInputTop} onLive={setLetterLive} /> : null}
      {!playtest && policeResult !== null ? (
        <PoliceResultCard
          key={policeResult.id}
          seat={policeResult.seat}
          name={investigated?.nickname ?? ""}
          animal={investigated?.animal}
          isMafia={policeResult.isMafia}
          reducedMotion={reducedMotion}
        />
      ) : null}
      {noPanel ? null : (
        <GamePanel
          view={view}
          offset={offset}
          send={send}
          canSend={canSend}
          binding={binding}
          kbOpen={kbOpen}
          lifted={kbLifted}
          veiled={veiled || (speakOpen && !speakWriting)}
          suspect={suspect.visible && (!playtest || layerKind === null) ? {
            ...suspect,
            disabled: layerKind !== null || suspect.disabled,
            toggleMode: () => {
              whisper.off();
              const result = suspect.toggleMode();
              if (result === "deny") denySuspect();
              return result;
            },
            ...(!playtest && canSend && layerKind === null && suspect.targets.size === 0 ? { deny: denySuspect } : {}),
          } : undefined}
          result={mapResult}
          notice={playtest ? (
            <>
              {toastText ? <p className="mf-playtest__feedback" role="status" {...(toast.props.marker ? { [toast.props.marker]: "" } : {})}>{toastText}</p> : null}
              {privateResult ? <p className="mf-playtest__result" role="status">{privateResult}</p> : null}
              {moment.will?.visible ? <p className="mf-playtest__result" role="status">유언 · {moment.will.text}</p> : null}
              {view.phase === "morning" && letter?.text ? <p className="mf-playtest__result" role="status">유언 · {letter.text}</p> : null}
            </>
          ) : undefined}
          call={{
            ...(callTool === "chat" ? { chat: true } : {}),
            ...(callTool === "will" ? { will: true } : {}),
            ...(callTool === "verdict" && view.me.verdictVote === undefined ? { verdict: true } : {}),
            ...(callFaceSeats !== undefined ? { faces: callFaceSeats } : {}),
          }}
          onCallUsed={markCallUsed}
          rejected={rejects}
          onNightPickSent={(target) => {
            pointSent.current = { target, at: Date.now() };
          }}
          onOpenWill={(opener) => {
            badge.setOpen(false);
            suspect.off();
            whisper.off();
            whisper.close();
            will.openSheet("will", opener);
          }}
          willOpen={will.open === "will"}
          willSaved={will.hasWill}
          onOpenNote={(opener) => {
            badge.setOpen(false);
            suspect.off();
            whisper.off();
            whisper.close();
            will.openSheet("note", opener);
          }}
          noteOpen={will.open === "note"}
          noteReady={will.noteReady}
          inputRef={inputRef}
          panelRef={panelRef}
        />
      )}
      {badge.allowed || whisper.allowed ? (
        <FloatActions ref={floatRef}>
          {badge.allowed ? (
            <FloatAction
              ref={badge.buttonRef}
              kind="claim"
              icon={CLAIM_ICON[badge.shown]}
              label={floatLabel(badge.shown)}
              pressed={layerKind === "claim"}
              disabled={!canSend}
              onPress={() => {
                if (will.open !== null) return;
                whisper.off();
                whisper.close();
                badge.toggle();
              }}
            />
          ) : null}
          {whisper.allowed ? (
            <FloatAction
              ref={whisper.buttonRef}
              kind="whisper"
              icon="whisper"
              label={whisper.used ? WHISPER_TEXT.floatUsed : WHISPER_TEXT.floatReady}
              pressed={whisper.mode}
              disabled={whisper.disabled}
              dot={!whisper.disabled}
              left={whisper.used ? 0 : 1}
              onPress={() => {
                if (will.open !== null) return;
                badge.setOpen(false);
                suspect.off();
                whisper.toggleMode();
              }}
            />
          ) : null}
        </FloatActions>
      ) : null}
      {speakOpen && !speakWriting ? <SpeakSheet chips={SHOWDOWN_COPY.chips} onPick={sendWord} onWrite={() => setSpeakWriting(true)} {...(canSend ? {} : { disabled: true })} /> : null}
      {layerKind !== null ? (
        <div ref={layerRef} className="mf-will-layer" data-sheet-layer={layerKind} {...(veiled ? { "data-panel-hidden": "true" } : {})}>
          {layerKind === "will" && will.open !== null ? (
            <DefenseAwareWillSheet
              key={will.open}
              defenseEndsAt={sheetReplacesPanel ? (view.phaseEndsAt ?? 0) : null}
              offset={offset}
              {...(will.open === "note" ? { title: "쪽지", icon: "note" as const, tone: "mafia" as const, placeholder: NOTE_PLACEHOLDER, max: CHAT_MAX_GRAPHEMES } : { max: WILL_MAX_GRAPHEMES })}
              value={will.draft}
              onChange={will.setDraft}
              onSave={will.save}
              onClose={will.close}
              saved={will.saved}
              {...(vvHeight < COMPACT_VV_MAX ? { compact: true } : {})}
              {...(canSend ? {} : { disabled: true })}
            />
          ) : layerKind === "speak" ? (
            <LineSheet
              title={SHOWDOWN_COPY.writeTitle}
              icon="quill"
              max={SHOWDOWN_COPY.max}
              inputLabel={`${SHOWDOWN_COPY.writeTitle} 입력`}
              value={speakDraft}
              onChange={setSpeakDraft}
              onSend={sendWord}
              onClose={() => setSpeakWriting(false)}
              {...(canSend ? {} : { disabled: true })}
            />
          ) : layerKind === "line" && whisper.target !== null ? (
            <LineSheet
              key={whisper.target}
              peer={{ seat: whisper.target, name: whisperPeer?.nickname ?? "", animal: whisperPeer?.animal }}
              placeholder={WHISPER_TEXT.placeholder(whisperPeer?.nickname ?? "")}
              value={whisper.draft}
              onChange={whisper.setDraft}
              onSend={whisper.send}
              onClose={whisper.close}
              whisper={RULES.whisper}
              {...(canSend ? {} : { disabled: true })}
            />
          ) : (
            <ClaimSheet chips={chipsOf(view)} value={badge.shown} onPick={badge.pick} onClose={() => badge.setOpen(false)} {...(canSend ? {} : { disabled: true })} />
          )}
        </div>
      ) : null}
    </main>
  );
}
