import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "react";
import type { ReactNode } from "react";
import { isAlive } from "../../shared/game/alive";
import { canMoveIn } from "../../shared/game/movement";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { ResultAnnounce } from "../components/ResultAnnounce";
import { RoleCardButton } from "../components/RoleCardButton";
import { PhaseHeader } from "../components/v2/PhaseHeader";
import { TopToast, useTopToast } from "../components/v2/TopToast";
import { WorldStage } from "../components/WorldStage";
import type { WorldPick } from "../components/WorldStage";
import { LOG_H_KB } from "../game/chatUi";
import { headerFor, pointsTally } from "../game/dayView";
import type { ChatStore } from "../net/chatStore";
import type { DayFx } from "../net/useDayFx";
import { useCountdown } from "../net/countdown";
import { useChat } from "../net/useChat";
import { useViewChoice } from "../net/useViewChoice";
import { useMapInsets } from "../net/useMapInsets";
import type { RoomConnection } from "../net/useRoomConnection";
import { sceneLook } from "../world/presence";
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
/** 지목을 보낸 뒤 이 시간 안의 오류 프레임은 그 지목의 거절로 본다(서버는 거절을 곧바로 돌려준다) */
const PICK_REPLY_MS = 3000;
/** 스테이지 사각형을 아직 못 쟀을 때 WorldStage 기본값(헤더 아래 62 · 패널 250)과 같은 값 — 장면 표의 확대 판정에만 쓴다 */
const DEFAULT_INSET_TOP = 62;
const DEFAULT_INSET_BOTTOM = 250;

/** 처음 보는 지목의 깜빡임을 본 적이 있는지 적는 저장소 키(6페이즈 mf-hint-walk 와 같은 방식, UI-SPEC 다르게 2) */
const POINT_HINT_KEY = "mf-hint-point";
/** 이름표 깜빡임을 보이는 시간(0.9초 × 3 = 2.7초 애니메이션이 끝난 뒤 꺼진다) */
const BLINK_MS = 3000;

function pointHintSeen(): boolean {
  try {
    return localStorage.getItem(POINT_HINT_KEY) != null;
  } catch {
    return false; // 저장소를 못 읽으면 보인다
  }
}

function rememberPointHint(): void {
  try {
    localStorage.setItem(POINT_HINT_KEY, "1");
  } catch {
    // 저장소를 못 쓰는 환경(개인 모드): 이번 방문에서만 본다
  }
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
  /** 지금 띄울 결과 알림 글자(useDayFx 가 서버 view 의 차이로 만든다). 없으면 null */
  announce?: string | null;
  /** useDayFx 가 만든 지목 위 알림(가장 최근 것). id 가 바뀔 때만 띄운다 — 처음 마운트 때의 값은 지난 알림이라 띄우지 않는다 */
  toast?: DayFx["toast"];
  /** 지목 선두가 새 사람으로 바뀌었을 때의 손사래 신호(WorldStage 로 그대로 넘긴다) */
  deny?: DayFx["deny"];
  /** 연결의 오류 프레임 구독(거절된 행동 알림에 쓴다) */
  onEvent?: RoomConnection["onEvent"];
  /** 맵을 쓸 수 없는 기기의 불가 카드 [처음으로] */
  onLeave?: () => void;
}

/** 헤더: 제목 + 접히는 안내 + (서버 마감 기준 시간 링) + 링 왼쪽 [역할 카드]. 시간 링의 250ms 다시 그리기가 맵 화면 전체로 번지지 않게 따로 둔다 */
function MapHeader({ view, offset, hintOn, extra }: { view: RoomView; offset: number; hintOn: boolean; extra: ReactNode }) {
  const head = headerFor(view);
  const { seconds } = useCountdown(view.phaseEndsAt ?? 0, view.phaseDurationMs ?? 0, offset);
  // 낮 시작은 링이 없다(2초 알림 단계). 마감이 없는 view 도 링을 그리지 않는다
  const ring = view.phase !== "dayAnnounce" && view.phaseEndsAt !== null && view.phaseDurationMs !== null;
  return (
    <PhaseHeader
      title={head.title}
      {...(head.hint !== undefined ? { hint: head.hint } : {})}
      showHint={hintOn}
      guide
      {...(ring ? { time: seconds, total: (view.phaseDurationMs ?? 0) / 1000 } : {})}
      extra={extra}
    />
  );
}

// 8페이즈 게임 맵 화면 틀(08-13, UI-SPEC "게임 화면 틀"): 지하 재즈 바 맵(WorldStage) 위에 위쪽 가림막, 헤더(단계 이름 + 접히는 안내 + 시간 링 + [역할 카드]), [테스트], 결과 알림, 아래 패널을 얹는다.
// 낮 시작·낮 토론·지목·최후 변론·찬반·처형이 이 화면 하나를 같은 장면 키로 그려 단계가 바뀌어도 맵이 다시 만들어지지 않는다.
// 화면은 서버가 보낸 view 만으로 다시 그린다. 닉네임(이름표)·알림 글자는 React 텍스트 노드로만 그린다.
export function GameMap({ view, store, chat, send, canSend = true, offset = 0, roleCard, testButton, announce = null, toast: toastShow = null, deny, onEvent, onLeave }: GameMapProps) {
  const toast = useTopToast();
  const { show } = toast;
  // 측정(스테이지 사각형)·키보드·기록 칸 높이는 대기실과 같은 훅이다. 키보드가 열려 있으면 행동 줄을 숨기고 기록 칸을 72 로 줄인다(07-19).
  const { rootRef, headerRef, panelRef, inputRef, kbOpen, logH, stageInsets } = useMapInsets();
  const { typingSeats, ...binding } = useChat({ store: chat, connection: { send, canSend }, view });

  // 안내 한 줄: 단계가 시작되면 보이고 2.5초 뒤 접힌다. 단계가 바뀔 때마다 다시 보인다.
  const phase = view.phase;
  const [hintOn, setHintOn] = useState(true);
  useEffect(() => {
    setHintOn(true);
    const timer = setTimeout(() => setHintOn(false), HINT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // 서버가 행동을 거절하면(마감 직후 누름 등) 위 알림을 띄우고 내 낙관적 눌림·선택을 서버 값으로 되돌린다. 이동은 조용히 버려지고 오류 프레임이 없다.
  // 지목 직후(PICK_REPLY_MS 안, 서버가 아직 내 선택을 확인하지 않았을 때)의 거절은 지목 거절이다: 단계 어긋남(WRONG_PHASE)은 REJECT_TEXT,
  // 그 밖의 코드는 SEND_FAIL_TEXT. 지목을 보낸 적 없으면 그 밖의 코드는 알림도 되돌림도 만들지 않는다(채팅 속도 제한 등).
  const [rejects, setRejects] = useState(0);
  const pointSent = useRef<{ target: number; at: number } | null>(null);
  useEffect(() => {
    if (!onEvent) return;
    return onEvent((e) => {
      if (e.t !== "error") return;
      const sent = pointSent.current;
      if (sent !== null && Date.now() - sent.at < PICK_REPLY_MS) {
        pointSent.current = null;
        show(e.code === "WRONG_PHASE" ? REJECT_TEXT : SEND_FAIL_TEXT);
        setRejects((n) => n + 1);
        return;
      }
      if (e.code !== "WRONG_PHASE" && e.code !== "BAD_MESSAGE") return;
      show(REJECT_TEXT);
      setRejects((n) => n + 1);
    });
  }, [onEvent, show]);

  // 지목 위 알림(useDayFx 의 ToastQueue 가 순서·합치기·길이를 정한다): id 가 바뀔 때만 띄운다. 처음 마운트 때의 알림은 지난 것이라 띄우지 않는다.
  const seenToast = useRef(toastShow?.id);
  useEffect(() => {
    if (toastShow === null || toastShow.id === seenToast.current) return;
    seenToast.current = toastShow.id;
    show(toastShow.text, toastShow.icon, toastShow.durationMs);
  }, [toastShow, show]);

  // 이동 권한: 산 사람은 낮 시작·토론에서만, 유령은 언제나(MAP-04). 권위는 서버 canMove 이고 화면은 같은 표로 맵 탭만 막는다.
  const me = view.players.find((p) => p.seat === view.me.seat);
  const meAlive = me === undefined || isAlive(me);
  const canWalk = canMoveIn(view.phase, meAlive);

  // 장면 표(보임·유령·카메라·조명·긴장): 서버 공개 정보로만 만든다. view 가 바뀔 때만 새로 만든다(타이머 틱으로 WorldStage 를 흔들지 않는다).
  const stageH = Math.max(0, window.innerHeight - (stageInsets?.top ?? DEFAULT_INSET_TOP) - (stageInsets?.bottom ?? DEFAULT_INSET_BOTTOM));

  // 지목 단계(DAY-04): 산 사람은 나를 뺀 산 사람의 이름표를 눌러 가리킨다. 내 선택만 서버 응답 전에 보이고(낙관적), 서버 view 가 오면 서버 값(day.points 의 내 줄, 가정 A1)이 이긴다.
  // 남의 지목·득표·선두·과반은 서버가 보낸 day.points 로만 그린다(T-08-38).
  const nominating = view.phase === "nomination";
  const canPick = nominating && meAlive;
  const serverMine = nominating ? view.day?.points?.find((l) => l.seat === view.me.seat)?.target : undefined;
  const [mine, chooseMine] = useViewChoice<number | undefined>(view, serverMine);
  // 서버가 내 선택을 확인했으면 더는 거절을 기다리지 않는다. 거절이 오면 내 선택을 서버 값으로 되돌린다(처음 그릴 때는 아무것도 하지 않는다).
  useEffect(() => {
    if (pointSent.current !== null && serverMine === pointSent.current.target) pointSent.current = null;
  }, [view, serverMine]);
  const seenRejects = useRef(rejects);
  useEffect(() => {
    if (seenRejects.current === rejects) return;
    seenRejects.current = rejects;
    chooseMine(serverMine);
    // chooseMine 은 렌더마다 새 함수지만 setState 만 부른다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejects]);
  const pickSeats = useMemo(
    () => (canPick ? new Set(view.players.filter((p) => isAlive(p) && p.seat !== view.me.seat).map((p) => p.seat)) : null),
    [canPick, view.players, view.me.seat],
  );
  // 처음 보는 지목에서만 누를 수 있는 이름표가 3초 깜빡인다(결정 0051-5 "처음 하는 사람에게만 손짓"). 보고 나면 저장소에 적어 다시 깜빡이지 않고, 누르면 즉시 멈춘다.
  // 기록은 끝낼 때 한다(개발 모드 이중 실행이 첫 실행의 기록을 읽고 깜빡임을 꺼 버리지 않게). 저장소를 못 쓰면 깜빡인다.
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (!canPick || pointHintSeen()) {
      setBlink(false);
      return;
    }
    setBlink(true);
    const timer = setTimeout(() => {
      setBlink(false);
      rememberPointHint();
    }, BLINK_MS);
    return () => clearTimeout(timer);
  }, [canPick]);

  const pick: WorldPick | undefined = pickSeats
    ? {
        seats: pickSeats,
        ...(mine !== undefined ? { mine } : {}),
        label: (nickname) => `${nickname} 님 가리키기`,
        onPick: (seat) => {
          if (seat === mine) return; // 같은 사람을 다시 눌러도 변하지 않는다(취소 없음)
          if (send({ t: "point", target: seat }) === false) return; // 소켓이 닫혀 못 보냈으면 표시도 바꾸지 않는다
          pointSent.current = { target: seat, at: Date.now() };
          chooseMine(seat);
          if (blink) {
            setBlink(false);
            rememberPointHint();
          }
        },
        group: "지목",
      }
    : undefined;

  // 이름표 쌓임: 득표 배지·선두(맥박)·과반 도장은 서버가 센 집계에서만 나온다. 0표 이름표에는 배지가 없다.
  const tagProps = useMemo<WorldTagProps | undefined>(() => {
    if (!nominating) return undefined;
    const tally = pointsTally(view);
    return (seat) => {
      const count = tally.counts[seat] ?? 0;
      return {
        ...(blink && pickSeats?.has(seat) ? { blink: true } : {}),
        ...(count >= 1 ? { count } : {}),
        ...(tally.leader === seat ? { lead: true } : {}),
        ...(tally.sure === seat ? { sure: true } : {}),
      };
    };
  }, [nominating, view, blink, pickSeats]);

  const scene = useMemo(() => sceneLook(view, { stageH, ...(mine !== undefined ? { mine } : {}) }), [view, stageH, mine]);

  return (
    <main ref={rootRef} className="mf-root mf-game" data-game-stage="" data-phase={view.phase} data-kb-open={kbOpen ? "true" : undefined}>
      {/* DOM 순서 = Tab 순서: 헤더([역할 카드]) → 맵(이름표) → 아래 패널(입력). 층 순서는 z 가 정한다 */}
      <div className="mf-game__scrim" aria-hidden="true" />
      <header ref={headerRef} className="mf-game__header">
        <MapHeader
          view={view}
          offset={offset}
          hintOn={hintOn}
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
        {...(deny ? { deny } : {})}
        {...(pick ? { pick } : {})}
        {...(tagProps ? { tagProps } : {})}
        onNotice={(text) => show(text)}
        onKick={() => {}}
        onLeave={() => onLeave?.()}
      />
      <TopToast {...toast.props} />
      {testButton ? <div className="mf-game__test">{testButton}</div> : null}
      <ResultAnnounce text={announce} />
      <GamePanel
        view={view}
        send={send}
        canSend={canSend}
        binding={binding}
        logHeight={kbOpen ? LOG_H_KB : logH}
        kbOpen={kbOpen}
        rejected={rejects}
        inputRef={inputRef}
        panelRef={panelRef}
      />
    </main>
  );
}
