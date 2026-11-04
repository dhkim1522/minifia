import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "react";
import type { ReactNode } from "react";
import { isAlive } from "../../shared/game/alive";
import { CHAT_MAX_GRAPHEMES } from "../../shared/game/chatRules";
import { canMoveIn } from "../../shared/game/movement";
import { WILL_MAX_GRAPHEMES } from "../../shared/game/will";
import { APPROACH_DIST_FX, approachPoint, positionAtFx } from "../../shared/game/world";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { KillFx } from "../components/KillFx";
import { PoliceResultCard } from "../components/PoliceResultCard";
import { BallotReveal } from "../components/v2/BallotReveal";
import { ResultAnnounce } from "../components/ResultAnnounce";
import { WillLetter } from "../components/v2/WillLetter";
import type { WillLetter as WillLetterState } from "../net/useWillLetter";
import { SceneCurtain } from "../components/SceneCurtain";
import { PickTurnBlock } from "../components/v2/PickTurnBlock";
import { RoleCardButton } from "../components/RoleCardButton";
import { PhaseHeader } from "../components/v2/PhaseHeader";
import { TopToast, useTopToast } from "../components/v2/TopToast";
import { CLAIM_ICON } from "../components/v2/ClaimBadge";
import { ClaimSheet } from "../components/v2/ClaimSheet";
import { FloatAction, FloatActions } from "../components/v2/FloatAction";
import { LineSheet } from "../components/v2/LineSheet";
import { SpeakSheet } from "../components/v2/SpeakSheet";
import { WillSheet } from "../components/v2/WillSheet";
import { TensionVignette } from "../components/TensionVignette";
import { WorldStage } from "../components/WorldStage";
import type { WorldPick } from "../components/WorldStage";
import { PICK_TURN_MS } from "../../shared/game/phases";
import { LOG_H_KB } from "../game/chatUi";
import { BADGE_TEXT, chipsOf, claimLook, floatLabel } from "../game/badgeView";
import { WHISPER_TEXT } from "../game/whisperView";
import { defenderVotes, headerFor, nominationVotesOf, pointsTally } from "../game/dayView";
import { blockModeOf, isMyTurn, turnStageOf, turnTopLine } from "../game/pickTurn";
import { isMySpeakTurn, pointSeatsOf, quoteOf, revealCounts, SHOWDOWN_COPY, showdownStageOf, speakerOf } from "../game/showdownView";
import type { ChatStore } from "../net/chatStore";
import type { DayFx } from "../net/useDayFx";
import { useCountdown } from "../net/countdown";
import { useBadge, useBadgeFx } from "../net/useBadge";
import { useChat } from "../net/useChat";
import { useTurnLook } from "../net/useTurnLook";
import { useVerdictMoment } from "../net/useVerdictMoment";
import { ballotsOf } from "../game/ballotsView";
import { useSendGuard } from "../net/useSendGuard";
import { useSheetLayer } from "../net/useSheetLayer";
import { useViewChoice } from "../net/useViewChoice";
import { useWhisper } from "../net/useWhisper";
import { useWill } from "../net/useWill";
import { useMapInsets } from "../net/useMapInsets";
import { useReducedMotion } from "../net/useReducedMotion";
import type { RoomConnection } from "../net/useRoomConnection";
import { sceneLook } from "../world/presence";
import { worldTestHooksEnabled } from "../world/testHooks";
import type { RingKind } from "../world/runtime";
import type { WorldStore } from "../world/store";
import { GamePanel } from "./GamePanel";
import "../styles/game.css";
import "../styles/sheet.css";
import "../styles/testtools.css";

/** 단계가 시작되고 안내 한 줄이 보이는 시간(결정 0051-5: 안내는 한 번, 그리고 사라진다) */
/** 찬반 묶음의 기본 윗변(알림 한 줄 아래: 72 + 43 + 16)과 알림 아랫변 사이 간격 — v2.css .mv-ballots 의 기본값과 같다 */
const BALLOT_TOP = 131;
const BALLOT_GAP = 16;
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
}

/** 헤더: 제목 + 접히는 안내 + (서버 마감 기준 시간 링) + 링 왼쪽 [역할 카드]. 시간 링의 다시 그리기가 맵 화면 전체로 번지지 않게 따로 둔다 */
function MapHeader({ view, offset, hintOn, hintOverride, extra }: { view: RoomView; offset: number; hintOn: boolean; hintOverride?: string; extra: ReactNode }) {
  const head = headerFor(view);
  // 지목·결선은 단계 마감이 아니라 알약·막대와 같은 값(blockLook)으로 링을 그린다(UI-SPEC A-3·D-3). 지목의 세부 단계 길이 3000/8000/900/2000 이나 결선 앞머리 1000 은 링 비율에 쓰지 않는다.
  const blocked = view.phase === "nomination" || view.phase === "runoff" || view.phase === "showdown";
  const look = useTurnLook(view, offset);
  const { seconds } = useCountdown(blocked ? 0 : (view.phaseEndsAt ?? 0), view.phaseDurationMs ?? 0, offset);
  // 낮 시작은 링이 없다(2초 알림 단계). 마감이 없는 view 도 링을 그리지 않는다. 지목의 모이는 중·끝 알림, 결선의 앞머리·결과에도 없다
  const timing = blocked ? look !== null && (look.stage === "turn" || look.stage === "done") : view.phase !== "dayAnnounce" && view.phaseEndsAt !== null && view.phaseDurationMs !== null;
  const time = blocked ? (look?.seconds ?? 0) : seconds;
  const total = blocked ? (look?.totalMs ?? PICK_TURN_MS) / 1000 : (view.phaseDurationMs ?? 0) / 1000;
  return (
    <PhaseHeader
      title={head.title}
      {...(hintOverride !== undefined ? { hint: hintOverride } : head.hint !== undefined ? { hint: head.hint } : {})}
      showHint={hintOverride !== undefined || hintOn}
      guide
      {...(timing ? { time, total } : {})}
      extra={extra}
    />
  );
}

/** 차례 알약·막대·위 한 줄. 초 경계마다 다시 그리는 시계(useTurnLook)를 이 부품 안에 가둔다 */
function TurnBlock({ view, offset, line, compact, reducedMotion }: { view: RoomView; offset: number; line: string | null; compact: boolean; reducedMotion: boolean }) {
  const look = useTurnLook(view, offset);
  const quote = quoteOf(view);
  return <PickTurnBlock look={look} line={line} quote={quote === null ? null : { text: quote.text }} compact={compact} reducedMotion={reducedMotion} />;
}

// 8페이즈 게임 맵 화면 틀(08-13, UI-SPEC "게임 화면 틀"): 지하 재즈 바 맵(WorldStage) 위에 위쪽 가림막, 헤더(단계 이름 + 접히는 안내 + 시간 링 + [역할 카드]), [테스트], 결과 알림, 아래 패널을 얹는다.
// 낮 시작·낮 토론·지목·최후 변론·찬반·처형이 이 화면 하나를 같은 장면 키로 그려 단계가 바뀌어도 맵이 다시 만들어지지 않는다.
// 화면은 서버가 보낸 view 만으로 다시 그린다. 닉네임(이름표)·알림 글자는 React 텍스트 노드로만 그린다.
export function GameMap({ view, store, chat, send, canSend = true, offset = 0, roleCard, testButton, announce = null, deny, fading, ghostEnter = 0, killFx = null, policeResult = null, letter = null, onEvent, epoch = 0, onLeave }: GameMapProps) {
  const toast = useTopToast();
  const { show } = toast;
  // 측정(스테이지 사각형)·키보드·기록 칸 높이는 대기실과 같은 훅이다. 키보드가 열려 있으면 행동 줄을 숨기고 기록 칸을 72 로 줄인다(07-19).
  // 지목이면 스테이지 윗변을 차례 알약 아랫변 + 4 로 내리고(UI-SPEC A-1) 작은 폰은 압축형 알약을 받는다(turnCompact). 알약 요소는 훅이 루트에서 `[data-turn-block]` 으로 찾는다.
  const { rootRef, headerRef, panelRef, inputRef, kbOpen: kbLifted, kbInSheet, logH, turnCompact: compactTurn, stageInsets } = useMapInsets(blockModeOf(view) !== null);
  // 키보드가 시트의 textarea 때문에 열린 것이면 채팅 패널을 줄이거나 행동 줄을 숨기지 않는다(시트를 연 버튼이 남아야 닫을 때 초점이 돌아온다). 패널은 키보드 위로 올라간다(lifted).
  const kbOpen = kbLifted && !kbInSheet;
  const { typingSeats, liveWhisperIn, ...binding } = useChat({ store: chat, connection: { send, canSend }, view });

  // 안내 한 줄: 단계가 시작되면 보이고 2.5초 뒤 접힌다. 단계가 바뀔 때마다 다시 보인다.
  // 지목은 내 차례가 시작될 때도 다시 보인다(UI-SPEC A-4 "의심되는 사람을 눌러요"): myTurnNo = 내 차례의 번호, 아니면 undefined.
  const phase = view.phase;
  const myTurnNo = isMyTurn(view) ? view.day?.turn?.i : undefined;
  // 결선은 앞머리(1초) 뒤 투표가 열릴 때 안내 '둘 중 한 명을 눌러요' 를 다시 보인다(UI-SPEC D-1): 단계(step)가 바뀔 때마다 한 번 더
  const runoffStep = phase === "runoff" ? view.day?.runoff?.step : undefined;
  // 마지막 3인(09.1.1-15): 내 한마디 차례가 시작될 때(차례 번호)와 동시 지목이 열릴 때(세부 단계)도 안내를 다시 보인다
  const showdownStage = showdownStageOf(view);
  const speakNo = isMySpeakTurn(view) ? view.day?.showdown?.i : undefined;
  const [hintOn, setHintOn] = useState(true);
  useEffect(() => {
    setHintOn(true);
    const timer = setTimeout(() => setHintOn(false), HINT_MS);
    return () => clearTimeout(timer);
  }, [phase, myTurnNo, runoffStep, showdownStage, speakNo]);

  // 유령이 된 순간(같은 단계 안이어도): 안내 '모두의 직업이 보여요' 를 2.5초 다시 보이고 직업 칩 등장 연출을 켠다. 처음 마운트 때의 번호는 지난 일이라 연출하지 않는다.
  const seenGhostEnter = useRef(ghostEnter);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [entering, setEntering] = useState(false);
  useEffect(() => {
    if (ghostEnter === seenGhostEnter.current) return;
    seenGhostEnter.current = ghostEnter;
    setHintOn(true);
    setEntering(true);
    clearTimeout(enterTimer.current);
    // 타이머는 이 효과의 정리가 아니라 언마운트 때만 푼다(개발 모드 이중 실행이 첫 실행의 타이머를 지워 연출이 켜진 채 남지 않게)
    enterTimer.current = setTimeout(() => {
      setHintOn(false);
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
  const shownAnnounce = letter !== null ? (letterLive ? letter.announce : null) : announce;
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
        setWhisperRejects((n) => n + 1);
        return;
      }
      // 직업 배지: 최근 3초 안에 보냈고 단계 어긋남·잘못된 요청이면 그 거절이다. 그 밖의 코드는 이 분기를 지나친다
      if ((e.code === "WRONG_PHASE" || e.code === "BAD_MESSAGE") && sendGuard.take() === "badge") {
        show(BADGE_TEXT.reject);
        setBadgeRejects((n) => n + 1);
        return;
      }
      const sent = pointSent.current;
      if (sent !== null && Date.now() - sent.at < PICK_REPLY_MS) {
        pointSent.current = null;
        show(e.code === "WRONG_PHASE" ? REJECT_TEXT : SEND_FAIL_TEXT);
        setRejects((n) => n + 1);
        return;
      }
      if (e.code !== "WRONG_PHASE" && e.code !== "BAD_MESSAGE") return;
      // 유언·쪽지 저장 중의 거절은 useWill 이 "보내지 못했어요" 한 번으로 알린다(알림 이중 방지)
      if (!willBusy.current) show(REJECT_TEXT);
      setRejects((n) => n + 1);
    });
  }, [onEvent, show, sendGuard]);

  // 09.1: 지목마다 띄우던 위 알림은 없다(차례 위 한 줄이 대신, UI-SPEC A-7). TopToast 는 거절 알림(REJECT_TEXT)에만 쓴다.

  // 이동 권한: 산 사람은 낮 시작·토론에서만, 유령은 언제나(MAP-04). 권위는 서버 canMove 이고 화면은 같은 표로 맵 탭만 막는다.
  const me = view.players.find((p) => p.seat === view.me.seat);
  const meAlive = me === undefined || isAlive(me);
  // 밤에는 산 마피아만 걷는다(NIGHT-07, 결정 0061-2). 역할은 서버가 이 사람에게만 보낸 view.me.role 이다.
  const canWalk = canMoveIn(view.phase, meAlive, view.me.role === "mafia");
  // 유령 화면(GHOST-02, 결정 0021): 내가 탈락했고 서버가 관전 정보(spectate)를 보냈을 때만 그린다. 서버가 안 보낸 view 에서는 이 분기가 아예 없다 — 받아서 감추는 방식이 아니다.
  const spectate = !meAlive ? view.spectate : undefined;
  const ghost = spectate !== undefined;

  // 장면 표(보임·유령·카메라·조명·긴장): 서버 공개 정보로만 만든다. view 가 바뀔 때만 새로 만든다(타이머 틱으로 WorldStage 를 흔들지 않는다).
  const stageH = Math.max(0, window.innerHeight - (stageInsets?.top ?? DEFAULT_INSET_TOP) - (stageInsets?.bottom ?? DEFAULT_INSET_BOTTOM));

  // 지목 단계(DAY-04): 산 사람은 나를 뺀 산 사람의 이름표를 눌러 가리킨다. 내 선택만 서버 응답 전에 보이고(낙관적), 서버 view 가 오면 서버 값(day.points 의 내 줄, 가정 A1)이 이긴다.
  // 남의 지목·득표·선두·과반은 서버가 보낸 day.points 로만 그린다(T-08-38).
  const nominating = view.phase === "nomination";
  // 밤 선택: 산 마피아만 지도 이름표를 눌러 대상을 보낸다(결정 0061-6). 경찰·의사는 아래 패널 얼굴 목록(GamePanel)으로 고른다(NIGHT-09). 서버 값은 view.me.pick(본인에게만 온다).
  const nighting = view.phase === "night";
  const nightMafia = nighting && meAlive && view.me.role === "mafia";
  // 시민 편(산 시민·경찰·의사)의 밤: 같은 어둠 표식과 긴장 비네트를 본다. 역할마다 다르지 않다(NIGHT-10, E3 #20). 마피아·유령·낮에는 없다.
  const nightDark = nighting && meAlive && !nightMafia;
  const recordCue = useMemo(
    () =>
      tensionHooksOn()
        ? (): void => {
            (window.__mfTension ??= []).push(Date.now());
          }
        : undefined,
    [],
  );
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
  // 누를 수 있는 좌석: 지목은 나를 뺀 산 사람. 밤은 산 마피아가 자신·동료를 뺀 산 사람(권위는 서버 pickTarget).
  const allies = view.me.allies;
  const runoffCand = runoff?.cand;
  const pickSeats = useMemo(() => {
    if (canPick) return new Set(view.players.filter((p) => isAlive(p) && p.seat !== view.me.seat).map((p) => p.seat));
    if (runoffVoting && runoffCand !== undefined) return new Set<number>(runoffCand);
    if (showdownPointing) return new Set<number>(pointSeatsOf(view));
    if (!nightMafia) return null;
    return new Set(view.players.filter((p) => isAlive(p) && p.seat !== view.me.seat && !(allies ?? []).includes(p.seat)).map((p) => p.seat));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPick, runoffVoting, runoffCand, showdownPointing, nightMafia, allies, view.players, view.me.seat, view.day?.showdown?.order]);
  // 마피아 다가가기(UI-SPEC 다르게 하는 곳 6): 고른 사람 옆 목적지를 일반 move 로 보낸다. 서버 applyMove 가 걷기 가능 칸으로 보정한다.
  // 대상이나 내 위치를 store 가 모르면 pick 만 나간다(A3).
  const approach = (target: number): void => {
    const now = Date.now() + offset;
    const targetSeg = store.segOf(target);
    const mySeg = store.segOf(view.me.seat);
    if (targetSeg === undefined || mySeg === undefined) return;
    const dest = approachPoint(positionAtFx(targetSeg, now), positionAtFx(mySeg, now), APPROACH_DIST_FX);
    send({ t: "move", x: dest.x, z: dest.z });
  };

  // 귓속말(09.1.1-09, UI-SPEC B): 모드·한 줄 시트·보내기는 useWhisper 가 쥔다. 모드에서는 나를 뺀 산 사람의 이름표가 버튼이 된다(낮 토론이라 지목·밤 선택의 pickSeats 와 겹치지 않는다).
  const whisper = useWhisper({ view, send, canSend, rejected: whisperRejects, guard: sendGuard });
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
  const pick: WorldPick | undefined = whisper.mode
    ? { seats: whisper.targets, label: WHISPER_TEXT.tagLabel, onPick: whisper.pick, group: WHISPER_TEXT.groupLabel }
    : pickSeats
    ? {
        seats: pickSeats,
        ...(mine !== undefined ? { mine } : {}),
        label: (nickname) => (nighting ? `${nickname} 님에게 다가가기` : runoffVoting ? `${nickname} 님에게 투표` : showdownPointing ? SHOWDOWN_COPY.pointLabel(nickname) : `${nickname} 님 가리키기`),
        onPick: (seat) => {
          if (seat === mine) return; // 이미 고른 후보를 다시 눌러도 보내지 않는다. 다른 후보를 누르면 마감까지 바꿀 수 있다(결선)
          if (send(nighting ? { t: "pick", target: seat } : { t: "point", target: seat }) === false) return; // 소켓이 닫혀 못 보냈으면 표시도 바꾸지 않는다
          pointSent.current = { target: seat, at: Date.now() };
          chooseMine(seat);
          if (nominating) setPickedTurn(myTurnNo);
          if (nightMafia) approach(seat);
        },
        group: nighting ? "밤 대상" : runoffVoting ? "결선" : showdownPointing ? SHOWDOWN_COPY.pointGroup : "지목",
        // 마피아 밤 선택 효과(결정 0065): nightMafia(산 마피아의 밤)일 때만. mine 은 서버가 마피아에게만 준 me.pick 이다
        ...(nightMafia ? { aim: true as const } : {}),
      }
    : undefined;

  // 이름표 쌓임: 득표 배지·선두(맥박)·과반 도장은 서버가 센 집계에서만 나온다. 0표 이름표에는 배지가 없다.
  const verdicting = view.phase === "verdict";
  const defending = view.phase === "defense";
  const baseTagProps = useMemo<WorldTagProps | undefined>(() => {
    // 찬반(DAY-06): 던진 사람의 이름표에 체크만 붙는다. 서버 day.voted 는 좌석뿐이고 무엇을 골랐는지는 어디에도 없다(결정 0053)
    if (verdicting) {
      const voted = new Set(view.day?.voted ?? []);
      return (seat) => (voted.has(seat) ? { done: true } : {});
    }
    // 최후 변론(DAY-05): 변론자 이름표만 지목 때 받은 득표 배지와 유력 도장을 유지하고 다른 이름표의 배지는 사라진다(공개 기록 voteLog 에서)
    if (defending) {
      const candidate = view.day?.candidate;
      const votes = defenderVotes(view);
      if (candidate === undefined || votes === undefined || votes < 1) return undefined;
      return (seat) => (seat === candidate ? { count: votes, sure: true } : {});
    }
    // 밤 발밑 고리(A2 임시 예외): 서버가 이 사람에게 보낸 값만 그린다. 산 마피아는 내 선택·동료 선택(allyPicks),
    // 유령은 서버가 유령에게만 보낸 spectate.picks(한 좌석에 여럿이면 마피아 → 경찰 → 의사 하나). 산 시민·경찰·의사 화면에는 고리가 없다(T-08-46, 경찰·의사의 선택은 얼굴 목록이 보인다).
    if (nighting) {
      const rings = new Map<number, RingKind>();
      const put = (seat: number, kind: RingKind): void => {
        if (!rings.has(seat)) rings.set(seat, kind);
      };
      if (spectate?.picks) {
        for (const kind of ["mafia", "police", "doctor"] as const) for (const seat of spectate.picks[kind]) put(seat, kind);
      } else if (nightMafia) {
        if (mine !== undefined) put(mine, "mafia");
        // 내가 고른 좌석이 먼저 서므로 동료도 같은 좌석을 골랐으면 내 고리(mafia)가 이긴다. 동료만 고른 좌석은 연한 고리(mafiaAlly)
        for (const seat of view.me.allyPicks ?? []) put(seat, "mafiaAlly");
      }
      // 선택 수 배지·확정 도장(결정 0061-7): 서버가 산 마피아에게만 보낸 집계(me.nightTally·nightSure)를 그대로 그린다. 마피아가 아니면 읽지 않는다.
      // 확정 좌석은 배지 대신 "확정" 도장 하나. 확정이 깨지면 서버가 nightSure 를 빼므로 도장이 사라지고 배지로 돌아간다.
      const counts = new Map<number, number>();
      let sureSeat: number | undefined;
      if (nightMafia) {
        for (const t of view.me.nightTally ?? []) if (t.n >= 1) counts.set(t.seat, t.n);
        sureSeat = view.me.nightSure;
      }
      if (rings.size === 0 && counts.size === 0 && sureSeat === undefined) return undefined;
      return (seat) => {
        const ring = rings.get(seat);
        const count = counts.get(seat);
        return {
          ...(ring !== undefined ? { ring } : {}),
          ...(seat === sureSeat ? { sure: true, sureLabel: "확정" } : count !== undefined ? { count } : {}),
        };
      };
    }
    // 동점 결선(09.1.1-14, UI-SPEC D-2): 던진 사람 이름표에 done 체크만(누가 누구를은 서버가 주지 않는다). 후보 머리 위 배지는 마감 전엔 지목 때 받은 득표, 결과(step 2)에는 결선 득표 tally 의 두 값
    if (runoff !== undefined) {
      const voted = new Set(runoff.voted ?? []);
      const nomVotes = nominationVotesOf(view);
      return (seat) => {
        const ci = runoff.cand.indexOf(seat);
        const count = ci < 0 ? 0 : runoff.step === 2 ? (runoff.tally?.[ci] ?? 0) : (nomVotes[seat] ?? 0);
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
    // 득표는 배지 숫자만(선두 맥박·과반 도장 없음, 09.1 M-4). 내가 방금 누른 표는 서버가 세어 주기 전에도 +1 로 바로 보인다(UI-SPEC A-4).
    // 차례인 사람은 발밑 흰 고리와 맨 앞 이름표(모이는 중·끝 알림에는 없다).
    const tally = pointsTally(view);
    const stage = turnStageOf(view);
    const turn = view.day?.turn;
    const turnSeat = (stage === "turn" || stage === "done") && turn !== undefined ? turn.order[turn.i] : undefined;
    return (seat) => {
      const count = (tally.counts[seat] ?? 0) + (mine === seat && serverMine !== seat ? 1 : 0);
      return {
        ...(canPick && pickSeats?.has(seat) ? { blink: true } : {}),
        ...(mine === seat ? { mine: true } : {}),
        ...(count >= 1 ? { count } : {}),
        ...(turnSeat === seat ? { ring: "turn" as const, turn: true } : {}),
      };
    };
  }, [nominating, nighting, nightMafia, mine, serverMine, spectate, verdicting, defending, view, canPick, pickSeats, runoff, runoffVoting, showdownPointing, showdownStage]);

  // 유령 화면의 이름표: 모든 이름표 위에 그 사람의 직업 칩(spectate.seats 의 job), 죽은 좌석은 반투명. 산 사람 view 에는 spectate 가 없어 이 겹침이 없다.
  const tagProps = useMemo<WorldTagProps | undefined>(() => {
    if (spectate === undefined) return baseTagProps;
    const jobs = new Map(spectate.seats.map((s) => [s.seat, s.job] as const));
    const deadSeats = new Set(view.players.filter((p) => !isAlive(p)).map((p) => p.seat));
    return (seat) => {
      const job = jobs.get(seat);
      return { ...(baseTagProps?.(seat) ?? {}), ...(job !== undefined ? { role: job } : {}), ...(deadSeats.has(seat) ? { ghost: true } : {}) };
    };
  }, [spectate, baseTagProps, view.players]);

  // 유언·쪽지 시트(WILL-01·NIGHT-12): 상태와 저장 흐름은 useWill 이 쥔다. 실패 알림은 위 알림 한 문구다.
  const will = useWill({ view, send, canSend, rejected: rejects, onFail: () => show(SEND_FAIL_TEXT), busyRef: willBusy });

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
  const { layerRef, veiled, vvHeight } = useSheetLayer({ open: layerKind !== null, panelRef, stageTop: stageInsets?.top ?? DEFAULT_INSET_TOP });

  // 이름표 모서리 배지: 서버 view.players 에서만 만든다(내 좌석만 낙관 값을 겹친다). 기존 키는 덮어쓰지 않는다. 주장이 하나도 없고 낙관 값도 없으면 기존 함수 그대로(이름표에 넘기는 속성이 없다)
  const badgeFx = useBadgeFx(view, epoch, reducedMotion);
  const { pops: claimPops, notices: claimNotices } = badgeFx;
  const claimTagProps = useMemo<WorldTagProps | undefined>(() => {
    const anyClaim = view.players.some((p) => p.badge !== undefined);
    if (!anyClaim && badge.shown === badge.server) return tagProps;
    return (seat) => {
      const base = tagProps?.(seat) ?? {};
      const look = claimLook(view, seat, seat === view.me.seat ? badge.shown : undefined);
      if (look === null) return base;
      const pop = claimPops.get(seat);
      return { claim: look.claim, claimSwapped: look.swapped, ...(pop !== undefined ? { claimPop: pop } : {}), ...(claimNotices.has(seat) ? { claimNotice: true } : {}), ...base };
    };
  }, [tagProps, view, badge.shown, badge.server, claimPops, claimNotices]);

  // 귓속말 모드: 대상 이름표가 깜빡이는 버튼이 된다(모션 줄이기는 CSS 가 gray-100 2px 고정 테두리). 모드가 아니면 위 함수 그대로(이름표에 넘기는 속성이 없다)
  const stageTagProps = useMemo<WorldTagProps | undefined>(() => {
    if (!whisper.mode) return claimTagProps;
    return (seat) => ({ ...(claimTagProps?.(seat) ?? {}), ...(whisper.targets.has(seat) ? { blink: true } : {}) });
  }, [whisper.mode, whisper.targets, claimTagProps]);

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

  // 판결 순간(09.1.1-13, UI-SPEC C-1): 처형 진입 시각 기준 어둡게 막·찬반 묶음·카메라 줌. 모션 줄이기는 줌 없이 막·핀·묶음만 쓴다
  const moment = useVerdictMoment(view, offset);
  const verdictZoom = moment.active && !reducedMotion ? moment.zoom : undefined;
  const ballots = moment.active && moment.stage !== "none" && moment.stage !== "gone" ? ballotsOf(view) : null;

  // 찬반 묶음 윗변(--mf-ballot-top): 기본은 알림 한 줄 아래(131). 8자 이름 "… 님 처형" 처럼 알림이 두 줄로 감기면 알림 아랫변 + 16 으로 내려간다 — 묶음은 알림과 겹치지 않는다
  const announceText = shownAnnounce?.text;
  const [ballotTop, setBallotTop] = useState(BALLOT_TOP);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (ballots === null) {
      root.style.removeProperty("--mf-ballot-top");
      setBallotTop(BALLOT_TOP);
      return;
    }
    const body = root.querySelector<HTMLElement>("[data-announce] .mf-announce__body");
    const bottom = body ? body.getBoundingClientRect().bottom - root.getBoundingClientRect().top : 0;
    const top = Math.max(BALLOT_TOP, Math.ceil(bottom + BALLOT_GAP));
    root.style.setProperty("--mf-ballot-top", `${top}px`);
    setBallotTop(top);
  }, [ballots === null, announceText]);

  const scene = useMemo(
    () => sceneLook(view, { stageH, ...(fading ? { fading } : {}), ...(mine !== undefined ? { mine } : {}), ...(verdictZoom !== undefined ? { verdictZoom } : {}) }),
    [view, stageH, fading, mine, verdictZoom],
  );

  return (
    <main ref={rootRef} className="mf-root mf-game" data-game-stage="" data-phase={view.phase} data-night-dark={nightDark ? "true" : undefined} data-ghost-view={ghost ? "true" : undefined} data-ghost-enter={ghost && entering ? "true" : undefined} data-kb-open={kbLifted ? "true" : undefined}>
      {/* DOM 순서 = Tab 순서: 헤더([역할 카드]) → 맵(이름표) → 아래 패널(입력). 층 순서는 z 가 정한다 */}
      <div className="mf-game__scrim" aria-hidden="true" />
      <header ref={headerRef} className="mf-game__header">
        <MapHeader
          view={view}
          offset={offset}
          hintOn={hintOn}
          {...(whisper.mode ? { hintOverride: WHISPER_TEXT.modeHint } : {})}
          extra={roleCard ? <RoleCardButton iconOnly unread={roleCard.unread} onOpen={roleCard.onOpen} /> : null}
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
          nightDark ? (
            <TensionVignette reducedMotion={reducedMotion} {...(recordCue ? { onCue: recordCue } : {})} />
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
      <TopToast {...toast.props} />
      {/* 누가 배지를 걸거나 바꿨을 때 읽히는 한 줄(화면에는 안 보인다) */}
      <div className="mf-sr-only" role="status" data-badge-live="">
        {badgeFx.said}
      </div>
      <TurnBlock view={view} offset={offset} line={topLine} compact={compactTurn} reducedMotion={reducedMotion} />
      {testButton ? <div className="mf-game__test">{testButton}</div> : null}
      {/* 장면 전환 막(09-20): 결과 알림보다 앞(DOM 순서)에 두어 막을 붙잡는 동안 알림이 막 위로 올라올 수 있게 한다. 덮기는 공개 마감만의 함수다 */}
      <SceneCurtain view={view} offset={offset} reducedMotion={reducedMotion} {...(killFx !== null ? { holdUntil: killFx.at + KILL_HOLD_MS } : {})} />
      <KillFx nonce={killNonce} reducedMotion={reducedMotion} />
      <ResultAnnounce text={shownAnnounce?.text || null} {...(shownAnnounce?.icon !== undefined ? { icon: shownAnnounce.icon } : {})} {...(letter !== null || moment.active ? { placement: "top" as const } : {})} />
      {ballots !== null ? <BallotReveal yes={ballots.yes} no={ballots.no} stage={moment.stage === "yes" ? "yes" : "both"} instant={moment.instant} reducedMotion={reducedMotion} fitKey={ballotTop} /> : null}
      {letter !== null ? <WillLetter key={`${letter.t0}:${letter.seat}`} letter={letter} reducedMotion={reducedMotion} getInputTop={letterInputTop} onLive={setLetterLive} /> : null}
      {policeResult !== null ? (
        <PoliceResultCard
          key={policeResult.id}
          seat={policeResult.seat}
          name={view.players.find((p) => p.seat === policeResult.seat)?.nickname ?? ""}
          isMafia={policeResult.isMafia}
          reducedMotion={reducedMotion}
        />
      ) : null}
      <GamePanel
        view={view}
        send={send}
        canSend={canSend}
        binding={binding}
        logHeight={kbOpen ? LOG_H_KB : logH}
        kbOpen={kbOpen}
        lifted={kbLifted}
        veiled={veiled || (speakOpen && !speakWriting)}
        rejected={rejects}
        onNightPickSent={(target) => {
          pointSent.current = { target, at: Date.now() };
        }}
        onOpenWill={(opener) => {
          badge.setOpen(false);
          whisper.off();
          whisper.close();
          will.openSheet("will", opener);
        }}
        willOpen={will.open === "will"}
        willSaved={will.hasWill}
        onOpenNote={(opener) => {
          badge.setOpen(false);
          whisper.off();
          whisper.close();
          will.openSheet("note", opener);
        }}
        noteOpen={will.open === "note"}
        noteReady={will.noteReady}
        inputRef={inputRef}
        panelRef={panelRef}
      />
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
            <WillSheet
              key={will.open}
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
              peer={{ seat: whisper.target, name: view.players.find((p) => p.seat === whisper.target)?.nickname ?? "" }}
              placeholder={WHISPER_TEXT.placeholder(view.players.find((p) => p.seat === whisper.target)?.nickname ?? "")}
              value={whisper.draft}
              onChange={whisper.setDraft}
              onSend={whisper.send}
              onClose={whisper.close}
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
