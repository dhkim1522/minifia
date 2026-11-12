import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { RefObject } from "react";
import { isAlive } from "../../shared/game/alive";
import { lockedOutfits } from "../../shared/game/look";
import { PLAYABLE_MAPS } from "../../shared/game/maps";
import { modeOf } from "../../shared/game/ruleset";
import type { ClientMessage, EmoteId, MapChoice, MapId, PhaseId, RoomView } from "../../shared/protocol";
import { emitSignal } from "../audio/signals";
import { Button } from "../components/Button";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { ModeSheet } from "../components/ModeSheet";
import { Sheet } from "../components/Sheet";
import { ToolButton } from "../components/ToolButton";
import { Icon } from "../components/Icon";
import { ChatPanel } from "../components/v2/ChatPanel";
import { DressSheet } from "../components/v2/DressSheet";
import { FloatAction } from "../components/v2/FloatAction";
import { HostRail } from "../components/v2/HostRail";
import { HostRailButton } from "../components/v2/HostRailButton";
import { MapChip } from "../components/v2/MapChip";
import { ModeChip } from "../components/v2/ModeChip";
import { SideColumn } from "../components/v2/SideColumn";
import { ReadyPill } from "../components/v2/ReadyPill";
import { ResultPanel } from "../components/v2/ResultPanel";
import type { ResultTab } from "../components/v2/ResultPanel";
import { TopToast, useTopToast } from "../components/v2/TopToast";
import { V2Icon } from "../components/v2/V2Icon";
import { WorldStage } from "../components/WorldStage";
import { DRESS_TEXT } from "../game/dressText";
import { LOG_H } from "../game/chatUi";
import { MODE_TEXT } from "../game/modeText";
import { castOf, holdSnap, markTimes, RESULT_TIMELINE, resultPanelHeight, satSlots, slotsFor, stateAt, walkSnap, winningTeam } from "../game/resultDirector";
import type { ResultState } from "../game/resultDirector";
import { READY_TEXT } from "../game/resultText";
import { RESULT_TEXT } from "../game/verdict";
import { faceSrc } from "../net/assets";
import type { ChatStore } from "../net/chatStore";
import type { ResultLogStore } from "../net/resultLogStore";
import { useChat } from "../net/useChat";
import { useDress } from "../net/useDress";
import { diffRoomViews, modeToastOf, toastForDiff } from "../net/roomDiff";
import { useMapInsets } from "../net/useMapInsets";
import { useReady } from "../net/useReady";
import { useReducedMotion } from "../net/useReducedMotion";
import { GATHER_CENTER } from "../world/camera";
import type { SceneLook, SeatLook } from "../world/presence";
import type { WorldStore } from "../world/store";
import { installResultHook, worldTestHooksEnabled } from "../world/testHooks";
import "../styles/game.css";
import "../styles/result.css";
import "../styles/sheet.css";

export interface ResultScreenProps {
  /** result 가 있는 ended view. RoomScreen 이 result 없는 프레임은 이 화면으로 보내지 않는다 */
  view: RoomView & { result: NonNullable<RoomView["result"]> };
  /** 위치 스토어. 연출 걷기·최종 자리는 이 스토어에 클라이언트가 만든 snap 한 프레임으로 먹인다(서버 상태는 바꾸지 않는다, T-11-16) */
  store: WorldStore;
  chat: ChatStore;
  /** 결과 공개(resultLog) 프레임 저장소. RoomScreen 이 연결과 같은 수명으로 만들어 먹인다(11-07) */
  resultLog: ResultLogStore;
  send: (msg: ClientMessage) => boolean | void;
  canSend: boolean;
  /** 서버시각 − 로컬시각(ms) */
  offset: number;
  /** 연결 epoch. 스토어 snap 에 실린다 */
  epoch: number;
  /** 나가기 확인 뒤(leave 가 보내졌을 때) 부른다. RoomScreen 이 "left" 로 잇는다 */
  onExit: () => void;
  /**
   * 같은 접속에서 이 화면으로 오기 직전 단계(RoomScreen 의 usePhaseArrival). execution·morning 에서 온 마운트만 시간표를 돈다.
   * 재접속·처음 마운트는 null/없음이라 곧바로 최종 상태다
   */
  arrivedFrom?: PhaseId | null | undefined;
}

// 결과 화면(11-05, 결정 D-1·D-11, UI-SPEC A-1·A-5): 3D 무대 위의 한 장면이다. 모든 사람이 무대 둘레 자리에 서 있고, 머리 위 직업 칩이 뒤집혀 있고,
// 산 사람은 직업 의상을 입고 탈락자는 유령 그림으로 서며(0083-2), 진 팀은 어둡고 이긴 팀은 무대 가운데 조명을 받는다. 읽는 글은 헤더의 승리 한 줄뿐이다(결정 0051).
// 직업은 view.result.seats 에서만 읽고(resultDirector.castOf) 판 중 장면 경로(visibleSeats)에는 두지 않는다(T-11-15).
// 연출 값(누가 어디에 서고 언제 뒤집히는지)은 resultDirector 만 계산하고 이 파일은 그 값을 그린다.
// 아래 패널은 접힌 게임 패널과 같은 높이의 전체 채팅 한 줄이다(동작 버튼 없음). 헤더 [나가기]는 로비와 같은 확인 시트를 연다.

/** 결과 화면 장면: 카메라 무대 중심 고정, 밤 조명, 이긴 팀 조명 구간에만 무대 가운데 점 조명 */
function sceneOf(cast: ReturnType<typeof castOf>, state: ResultState, sat: readonly number[] = []): SceneLook {
  const seats: Record<number, SeatLook> = {};
  // 쉬었다가 합류한 사람(11-12, D-13): 참가자 밖 별도 자리에 반투명 0.5 로 선다. 직업 의상·어둠·칩이 없다
  for (const seat of sat) seats[seat] = { show: true, ghost: false, opacity: SAT_OPACITY };
  for (const c of cast) {
    const costume = state.costumes[c.seat]; // 탈락 좌석은 표에 없다 — 유령 그림(진 팀이면 어둡게)
    seats[c.seat] = { show: true, ghost: !c.alive, ...(costume !== undefined ? { costume } : {}), ...(state.dimmed.includes(c.seat) ? { dim: true as const } : {}) };
  }
  return {
    camera: { mode: "fixed", target: { x: GATHER_CENTER.x, z: GATHER_CENTER.z }, zoom: 1 },
    lighting: "night",
    tension: 0,
    pin: state.lit ? { mode: "point", x: GATHER_CENTER.x, z: GATHER_CENTER.z } : null,
    seats,
  };
}

function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** 쉬었던 사람(sat)의 몸 불투명도(UI-SPEC A-5) */
const SAT_OPACITY = 0.5;

/** 쉬게 될 사람 확인 시트(11-12, D-12): 쉬게 될 사람 얼굴 줄(이름 글자 없음, 접근성 이름은 닉네임) + 한 줄 + [시작][취소]. 초점은 [취소] — 엔터 한 번으로 시작되지 않는다 */
function RestSheet({ faces, onStart, onCancel }: { faces: readonly { seat: number; nickname: string }[]; onStart: () => void; onCancel: () => void }) {
  const cancelRef: RefObject<HTMLButtonElement | null> = useRef<HTMLButtonElement>(null);
  return (
    <Sheet label={READY_TEXT.rest} onClose={onCancel} initialFocusRef={cancelRef}>
      {(requestClose, closing) => (
        <>
          <div className="mf-rest__faces" data-rest-faces="">
            {faces.slice(0, REST_FACES_MAX).map((f) => (
              <img key={f.seat} className="mf-rest__face" data-rest-face="" src={faceSrc(f.seat)} alt={f.nickname} width={40} height={40} />
            ))}
          </div>
          <h2 className="mf-t-heading mf-sheet__title">{READY_TEXT.rest}</h2>
          <div className="mf-sheet__actions">
            <Button variant="primary" block disabled={closing} onClick={onStart}>
              {READY_TEXT.confirmStart}
            </Button>
            <Button ref={cancelRef} variant="secondary" block disabled={closing} onClick={requestClose}>
              {READY_TEXT.confirmCancel}
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}

/** 확인 시트 얼굴 줄의 최대 개수 */
const REST_FACES_MAX = 7;

/** 박수 큐 한 묶음(WorldStage emoteCues). nonce 가 새로 보일 때마다 한 번 재생한다 */
type ClapCues = readonly { seat: number; id: EmoteId; nonce: number }[];

export function ResultScreen({ view, store, chat, resultLog, send, canSend, offset, epoch, onExit, arrivedFrom }: ResultScreenProps) {
  const { result } = view;
  const toast = useTopToast();
  const { show } = toast;
  const [leaveOpen, setLeaveOpen] = useState(false);
  const { rootRef, headerRef, panelRef, inputRef, kbOpen, sideMaxH, stageInsets } = useMapInsets();

  // 탭 패널(11-07): 현재 탭과 열어 본 탭 집합은 이 화면이 쥔다. 전체가 아닌 탭이면 패널이 확장되고 연출 시계가 멈춘다(D-3, D-25)
  // 18.1: 결과 화면은 RESULT_TABS_SHOWN 이 전체 하나라 tab 은 늘 all 이고 확장·정지 경로에 닿지 않는다(P181-7). 경로는 되돌리기 쉽게 남긴다
  const [tab, setTab] = useState<ResultTab>("all");
  const [opened, setOpened] = useState<ReadonlySet<ResultTab>>(() => new Set<ResultTab>(["all"]));
  const expanded = tab !== "all";
  const pickTab = useCallback((next: ResultTab) => {
    setTab(next);
    setOpened((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
  }, []);
  // 기록 탭의 귓속말 쌍(11-11): 귓속말 탭으로 옮기고 그날 구분선을 보이게 한다. 탭 행으로 직접 고르면 이 일차는 지운다
  const [jumpDay, setJumpDay] = useState<number | null>(null);
  const jumpWhisper = useCallback(
    (n: number) => {
      setJumpDay(n);
      pickTab("whisper");
    },
    [pickTab],
  );
  const onTabRow = useCallback(
    (next: ResultTab) => {
      setJumpDay(null);
      pickTab(next);
    },
    [pickTab],
  );
  const logRevision = useSyncExternalStore(
    useCallback((cb: () => void) => resultLog.subscribe(cb), [resultLog]),
    useCallback(() => resultLog.revision(), [resultLog]),
  );
  const logLines = useMemo(() => resultLog.snapshot(), [resultLog, logRevision]); // eslint-disable-line react-hooks/exhaustive-deps
  const contacts = useMemo(() => new Map(view.players.map((p) => [p.seat, p.nickname] as const)), [view.players]);
  // 확장 높이: 방 높이(루트 높이)로 한 번 정하고 화면 방향·크기가 바뀔 때만 다시 잰다(키보드·주소창으로는 다시 정하지 않는다)
  const [roomH, setRoomH] = useState(0);
  useLayoutEffect(() => {
    const measure = (): void => setRoomH(rootRef.current?.clientHeight || window.innerHeight);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [rootRef]);

  // 아래 패널 높이(--mf-panel-h)는 DOM 에서 재서 루트에 정한다(패널이 자라도 따라간다). 떠 있는 [넘기기] 묶음(아래 끝 = 키보드 올림 + 패널 높이 + 8)이 CSS 상속으로 읽는다
  useLayoutEffect(() => {
    rootRef.current?.style.setProperty("--mf-panel-h", `${panelRef.current?.offsetHeight ?? 0}px`);
  });

  // 출연자 표는 내용이 바뀔 때만 다시 만든다 — 같은 결과가 다시 와도(닉네임·연결 상태만 바뀐 view) 시계·자리 snap 을 다시 시작하지 않는다
  const castKey = `${result.seats.map((s) => `${s.seat}:${s.job}`).join(",")}|${view.players.map((p) => `${p.seat}:${isAlive(p) ? 1 : 0}`).join(",")}`;
  const cast = useMemo(() => castOf(view), [castKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const winner = result.winner;
  const tl = RESULT_TIMELINE;

  // 연출 시계(각자 폰 안): 마운트 때 한 번 정한 연출 여부. 직전 단계가 처형·아침인 마운트에서만 시간표를 돈다. 재접속·처음 마운트·모션 줄이기는 곧바로 최종 상태다(이후 view 가 다시 와도 되돌아가지 않는다)
  const reduced = useReducedMotion();
  const arrival = arrivedFrom === "execution" || arrivedFrom === "morning";
  const [reveal] = useState<boolean>(() => !reduced && arrival);
  // 서버가 view.result 에 싣는 칭호 목록은 읽지도 그리지도 않는다(결정 0083-7). 연출은 시간표가 5600ms 최종 상태에서 끝난다
  // mark = 마지막으로 닿은 시간표 시각. 상태는 mark 의 순수 함수(stateAt)라 프레임마다 다시 그리지 않고 표시각마다 한 번 바꾼다
  const [mark, setMark] = useState<number>(reveal ? 0 : tl.finalAtMs);
  const [skipped, setSkipped] = useState(false);
  const [cues, setCues] = useState<ClapCues>([]);
  const markRef = useRef(mark);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // 연출 경과 시계: schedule(from) 이 from 에서 다시 시작한 시각을 적는다. 패널이 확장되어 멈추면 경과를 보존하고 접히면 거기서 이어간다
  const clock = useRef({ base: 0, since: 0 });
  const pausedAt = useRef<number | null>(null);
  const nonce = useRef(0);

  // 쉬었던 사람(sat, 11-12): 참가자 링 밖 별도 자리. 방의 맵(view.map, 없으면 재즈 바)에서 걸을 수 있는 칸으로 보정한다
  const satKey = view.players.filter((p) => p.sat === true).map((p) => p.seat).sort((a, b) => a - b).join(",");
  const satSeats = useMemo<number[]>(() => (satKey === "" ? [] : satKey.split(",").map(Number)), [satKey]);
  const mapId: MapId = view.map ?? "bar";

  const state = useMemo(() => stateAt(mark, cast, winner), [mark, cast, winner]);
  const scene = useMemo(() => sceneOf(cast, state, satSeats), [cast, state, satSeats]);

  // 위치: 모두 자기 둘레 자리로. 연출이면 스토어의 마지막 위치에서 걷는 구간(1200ms), 아니면 한 점 구간이다. 런타임이 만들어지기 전(레이아웃 효과)에 먹여 첫 프레임부터 맞다.
  // 서버 상태가 아니라 이 폰의 연출이다 — 서버 시각 기준(t0 = 지금 + offset)으로 만들어 런타임이 서버 구간과 똑같이 그린다. 새 연결(epoch)이면 다시 먹인다
  const slots = useMemo(() => ({ ...slotsFor(cast), ...satSlots(satSeats, mapId) }), [cast, satSeats, mapId]);
  const offsetRef = useRef(offset);
  offsetRef.current = offset; // 시계 보정이 흔들려도 snap 을 다시 먹이지 않는다(먹일 때만 읽는다)
  const feed = useCallback(
    (walk: boolean) => {
      const t0 = Date.now() + offsetRef.current;
      let ents;
      if (walk) {
        const starts: Record<number, { x: number; z: number } | undefined> = {};
        for (const seat of Object.keys(slots).map(Number)) starts[seat] = store.positionOf(seat, t0) ?? undefined;
        ents = walkSnap(slots, starts, t0);
      } else {
        ents = holdSnap(slots, t0);
      }
      store.applyFrame({ t: "world", k: "snap", at: t0, ents }, Math.max(store.currentEpoch(), epoch));
    },
    [store, slots, epoch],
  );
  useLayoutEffect(() => {
    feed(reveal && markRef.current < tl.flipStartMs);
  }, [feed]); // eslint-disable-line react-hooks/exhaustive-deps

  // 표시각마다 setTimeout 으로 단계를 바꾼다. 조명이 켜지는 순간 이긴 팀 박수 큐(최대 4)를 만든다(T-11-17)
  // 소리 신호(12-11, D-15): 시계가 단계·뒤집힘 수를 바꾸는 이 goto 에서만, 사건마다 한 번 나간다(flip·light 둘). 건너뛰어 지나친 마크는 goto 를 거치지 않으니 신호도 없다.
  // 연출 없는 마운트(재접속·처음 마운트)는 reveal 이 없어 신호가 없다. 인자는 정수·불리언뿐이다(좌석·직업·닉네임 없음)
  const myCast = cast.find((c) => c.seat === view.me.seat);
  const iWin = myCast === undefined ? true : myCast.team === winningTeam(winner);
  const iWinRef = useRef(iWin);
  iWinRef.current = iWin;
  const goto = useCallback(
    (m: number) => {
      markRef.current = m;
      setMark(m);
      const clap = stateAt(m, cast, winner).clap;
      if (clap.length > 0) setCues(clap.map((seat) => ({ seat, id: "clap" as const, nonce: ++nonce.current })));
      if (reveal && m >= tl.flipStartMs && m < tl.lightAtMs) {
        const i = (m - tl.flipStartMs) / tl.flipGapMs;
        if (Number.isInteger(i) && i < cast.length) emitSignal({ kind: "result", step: "flip", i });
      }
      if (reveal && m === tl.lightAtMs) emitSignal({ kind: "result", step: "light", win: iWinRef.current });
    },
    [cast, winner, reveal], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // 모션 줄이기로 곧바로 최종 상태가 열린 도착: 승패 소리 한 번만(뒤집기·조명 시계가 없다). 부모의 소리 훅 효과가 같은 커밋에서 새 단계를 먼저 받도록 한 틱 미룬다
  const lightSent = useRef(false);
  useEffect(() => {
    if (!arrival || reveal || lightSent.current) return;
    const t = setTimeout(() => {
      lightSent.current = true;
      emitSignal({ kind: "result", step: "light", win: iWinRef.current });
    }, 0);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const schedule = useCallback(
    (from: number) => {
      clock.current = { base: from, since: Date.now() };
      for (const t of timers.current) clearTimeout(t);
      timers.current = markTimes(cast.length)
        .filter((m) => m > from)
        .map((m) => setTimeout(() => goto(m), m - from));
    },
    [cast.length, goto],
  );
  useEffect(() => {
    if (!reveal) return;
    schedule(0);
    goto(0);
    return () => {
      for (const t of timers.current) clearTimeout(t);
      timers.current = [];
    };
    // 마운트 한 번: 연출은 처음 받은 결과에서만 돈다(이후 같은 result 가 다시 와도 시계를 다시 시작하지 않는다)
  }, [reveal]); // eslint-disable-line react-hooks/exhaustive-deps

  // 확장 중 정지(D-25): 전체가 아닌 탭이 열려 있는 동안 대기 타이머를 취소하고 경과를 보존한다. 접히면 그 경과부터 남은 표시각을 다시 건다. 연출이 아닌 마운트는 타이머가 없어 아무 일도 없다
  useEffect(() => {
    if (!reveal) return;
    if (expanded) {
      if (pausedAt.current !== null) return;
      pausedAt.current = clock.current.base + (Date.now() - clock.current.since);
      for (const t of timers.current) clearTimeout(t);
      timers.current = [];
    } else if (pausedAt.current !== null) {
      const from = pausedAt.current;
      pausedAt.current = null;
      schedule(from);
    }
  }, [expanded, reveal, schedule]);

  // 건너뛰기(D-25): 4600 전의 무대 탭 한 번이면 4600 상태로 점프한다(전원 뒤집힘 + 조명, 승리 알림은 건너뜀). 남은 시간표는 이어진다. 4600 이후 탭은 아무 일 없다
  const skip = useCallback(() => {
    if (!reveal || markRef.current >= tl.lightAtMs) return;
    schedule(tl.lightAtMs);
    setSkipped(true);
    feed(false);
    goto(tl.lightAtMs);
  }, [reveal, schedule, feed, goto]); // eslint-disable-line react-hooks/exhaustive-deps

  // 무대 탭: 패널이 확장되어 있으면 접기만 한다(건너뛰기는 하지 않는다, D-3). 아니면 건너뛰기
  const onStageTap = useCallback(() => {
    if (tab !== "all") setTab("all");
    else skip();
  }, [tab, skip]);

  // 머리 위 직업 칩: 뒤집힌 사람만. 결과 화면의 ended 경로에서만 만든다(산 사람 장면 표는 건드리지 않는다)
  const jobBySeat = useMemo(() => new Map(cast.map((c) => [c.seat, c.job])), [cast]);
  const flipped = useMemo(() => new Set(state.flipped), [state]);
  // 18-05(D-02): 다른 참가자가 직접 고른 옷(나간 사람 포함) — 서버 view.players 에서 나를 빼고 다시 계산한다(로비와 같은 규칙)
  const takenOutfits = useMemo(() => lockedOutfits(view.players.filter((p) => p.seat !== view.me.seat)), [view.players, view.me.seat]);
  // 다시 하기 준비(11-12, D-12): 준비한 사람의 이름표에 체크('준비됨')가 모두에게 같게 붙는다. 서버가 실은 공개 값(players[].ready)뿐이다
  const readySeats = useMemo(() => new Set(view.players.filter((p) => p.ready === true && p.connected).map((p) => p.seat)), [view.players]);
  const tagProps = useCallback(
    (seat: number) => ({
      ...(flipped.has(seat) ? { role: jobBySeat.get(seat)! } : {}),
      ...(readySeats.has(seat) ? { done: true, doneLabel: READY_TEXT.tagDone } : {}),
    }),
    [flipped, jobBySeat, readySeats],
  );

  // E2E 훅(window.__mfResult): 켜진 문맥에서만. stage·chips 는 연출 시계, costumes·dimmed 는 런타임이 실제로 적용한 값
  const hook = useRef<ReturnType<typeof installResultHook> | null>(null);
  useLayoutEffect(() => {
    if (!worldTestHooksEnabled(window.location.search, sessionStore(), import.meta.env.DEV)) return;
    const h = installResultHook();
    hook.current = h;
    return () => {
      h.off();
      hook.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    hook.current?.patch({ stage: state.stage, chips: state.flipped.length });
  }, [state]);
  useLayoutEffect(() => {
    hook.current?.patch({ tab });
  }, [tab]);
  // 쉬었던 사람 훅(11-12): sat 좌석 오름차순. 값은 좌석 번호뿐이다(DOM 속성이 아니다)
  useLayoutEffect(() => {
    hook.current?.patch({ sat: satSeats });
  }, [satSeats]);
  const onCostumes = useCallback((costumes: Readonly<Record<number, string>>, dimmed: readonly number[]) => {
    hook.current?.patch({ costumes: { ...costumes }, dimmed: [...dimmed] });
  }, []);

  // 채팅: 결과 단계에서 서버는 typing·emote 를 버린다 — 클라이언트가 보내지 않게 한 겹 막는다. 보낼 수 있는 건 view.me.chat 이 all 일 때뿐이다(D-11)
  const guardedSend = useCallback((msg: ClientMessage) => (msg.t === "typing" || msg.t === "emote" ? true : send(msg)), [send]);
  const binding = useChat({ store: chat, connection: { send: guardedSend, canSend }, view });
  const chatOpen = view.me.chat === "all";

  // 다시 하기 알약(11-12, D-11·D-12): 승리 조명(4600) 때 활성이 된다. 상태·잠금·시작 확인은 훅이 쥐고 이 화면은 그린다. 거절은 알리지 않는다(서버가 다시 보낸 state 대로 그린다, L40)
  const pillActive = mark >= tl.lightAtMs;
  const rematch = useReady({ view, send, canSend, stageActive: pillActive });
  const rematchToast = rematch.toast;
  useEffect(() => {
    if (rematchToast !== null) show(rematchToast.text);
  }, [rematchToast, show]);
  // 방장 이양 알림(11-12, D-17): 서버 view 두 개의 차이로만 만든다(방장이 다른 좌석으로 바뀐 것). 첫 스냅샷·재연결 직후에는 없다. 입장·퇴장 알림과 기록 줄은 결과 단계에 없다
  // 판 종류 바뀜(19-05, P19-9)도 같은 규칙으로 참가자에게만 한 줄 — 한 번에 하나라 방장 변경이 먼저다. 연출 중에도 뜬다(칩은 연출이 끝난 뒤에 나온다)
  const prevView = useRef<RoomView | null>(null);
  const prevEpoch = useRef(epoch);
  useEffect(() => {
    if (prevEpoch.current !== epoch) {
      prevEpoch.current = epoch;
      prevView.current = null;
    }
    const prev = prevView.current;
    const diff = diffRoomViews(prev, view);
    prevView.current = view;
    const t = toastForDiff({ joined: [], left: [], newHost: diff.newHost });
    const modeText = t ? null : modeToastOf(prev, view);
    if (t) show(t.text, t.icon);
    else if (modeText) show(modeText);
  }, [view, epoch, show]);

  // 꾸미기(11-12, D-16): 연출이 끝난 최종 상태에서 오른쪽 열에 [꾸미기]. 로비와 같은 DressSheet·useDress(서버 dress 문이 ended 를 연다). 바꾼 의상은 직업 의상에 가려 다음 판 대기실에서 보인다
  const [dressOpen, setDressOpen] = useState(false);
  const dress = useDress({ view, send, canSend });
  const dressBtnRef = useRef<HTMLButtonElement>(null);
  const restoreDressFocus = useRef(false);
  // 시트 탭(11-13): 지도 칩 → 맵 탭, [꾸미기] → 의상 탭. 칩·맵 탭은 허용 맵이 둘 이상일 때만 있다. 결과 단계의 선택은 다음 판 설정이다(서버가 ended 에서 받는다). 19-05: 지도 칩은 방장 줄의 칸이다
  const [dressTab, setDressTab] = useState<"map" | "dress">("dress");
  const mapsOn = PLAYABLE_MAPS.length > 1;
  const mapChoice: MapChoice = view.mapChoice ?? "random";
  const pickMap = (map: MapChoice) => {
    if (canSend) send({ t: "mapPick", map });
  };
  const openDress = (tab: "map" | "dress" = "dress") => {
    inputRef.current?.blur();
    setDressTab(tab);
    setDressOpen(true);
  };
  const closeDress = () => {
    restoreDressFocus.current = true;
    setDressOpen(false);
  };
  useEffect(() => {
    if (dressOpen || !restoreDressFocus.current) return;
    restoreDressFocus.current = false;
    dressBtnRef.current?.focus();
  }, [dressOpen]);
  const finished = mark >= tl.finalAtMs;

  // 판 종류(19-05, D-05·D-06): 결과 단계의 선택은 다음 판 설정이다(서버가 ended 에서 받는다). 단추 이름·시트의 고른 칸·참가자 칩은 서버가 방송한 view.mode 만 따른다.
  // 고르면 보내기만 하고 미리 바꾸지 않는다(P19-6). 눌러 둔 다시 하기 준비는 건드리지 않는다(P19-13)
  const isHost = view.me.isHost;
  const mode = modeOf(view);
  const [modeOpen, setModeOpen] = useState(false);
  const modeBtnRef = useRef<HTMLButtonElement>(null);
  const restoreModeFocus = useRef(false);
  const openMode = () => {
    inputRef.current?.blur();
    setModeOpen(true);
  };
  const closeMode = () => {
    restoreModeFocus.current = true;
    setModeOpen(false);
  };
  // 시트를 닫으면 초점을 [판 종류] 단추로 돌려준다(꾸미기 시트의 restoreDressFocus 와 같은 방식)
  useEffect(() => {
    if (modeOpen || !restoreModeFocus.current) return;
    restoreModeFocus.current = false;
    modeBtnRef.current?.focus();
  }, [modeOpen]);
  // 방장을 넘겨주면 열려 있던 판 종류 시트는 닫는다 — 다시 방장이 됐을 때 저절로 뜨지 않게
  useEffect(() => {
    if (!isHost) setModeOpen(false);
  }, [isHost]);

  const readyPill = <ReadyPill host={rematch.isHost} on={rematch.mine} n={rematch.ready} m={rematch.total} dim={rematch.isHost && !rematch.canStart} inactive={!pillActive || !canSend} onPress={rematch.press} />;

  const title = RESULT_TEXT.title[state.title];
  return (
    <main ref={rootRef} className="mf-root mf-result" data-result-stage={state.stage} data-reveal={String(reveal)} data-winner={winner} data-kb-open={kbOpen ? "true" : undefined}>
      <WorldStage
        view={dress.stageView}
        store={store}
        send={send}
        canSend={canSend}
        offset={offset}
        {...(stageInsets ? { stageInsets } : {})}
        scene={scene}
        canWalk={false}
        tagProps={tagProps}
        onCostumes={onCostumes}
        onStageTap={onStageTap}
        emoteCues={cues}
        onNotice={(text) => show(text)}
        onLeave={() => setLeaveOpen(true)}
      />
      <div className="mf-result__scrim" aria-hidden="true" />
      <header ref={headerRef} className="mf-result__header">
        {/* 머리 단추: 아이콘 단추, 이름은 aria-label "나가기" */}
        <ToolButton name="나가기" icon={<Icon name="back" />} disabled={!canSend} onClick={() => setLeaveOpen(true)} />
        <h1 className="mf-result__title" data-title={state.title}>
          {state.title === "result" ? null : (
            <V2Icon name={state.title === "mafiaWin" ? "roleMafia" : "roleCitizen"} size={28} className={state.title === "mafiaWin" ? "mf-result__title-icon is-mafia" : "mf-result__title-icon"} />
          )}
          <span>{title}</span>
        </h1>
        <span className="mf-result__header-gap" aria-hidden="true" />
      </header>
      <TopToast {...toast.props} />
      {/* 4600~5200 중앙 승리 알림: 36px 한 줄 + 아이콘, 배경 어둡게 80%, 터치 통과. 읽기용 안내는 RoomScreen 이 이미 하므로 live 영역이 아니다(role img) */}
      {state.announce && !skipped ? (
        <div className="mf-result__announce" data-result-announce="" data-winner={winner} role="img" aria-label={RESULT_TEXT.title[winner]}>
          <V2Icon name={winner === "mafiaWin" ? "roleMafia" : "roleCitizen"} size={56} className={winner === "mafiaWin" ? "mf-result__announce-icon is-mafia" : "mf-result__announce-icon"} />
          <span className="mf-result__announce-text">{RESULT_TEXT.title[winner]}</span>
        </div>
      ) : null}
      <ResultPanel
        panelRef={panelRef}
        kb={kbOpen}
        tab={tab}
        onTab={onTabRow}
        expanded={expanded}
        {...(resultPanelHeight(roomH) !== undefined ? { expandedHeight: resultPanelHeight(roomH)! } : {})}
        tabsVisible={state.tabsVisible}
        lines={logLines}
        view={view}
        onJumpWhisper={jumpWhisper}
        {...(jumpDay !== null ? { focusDay: jumpDay } : {})}
        contacts={contacts}
        opened={opened}
        allSlot={
          <ChatPanel
            messages={binding.messages}
            value={binding.value}
            onChange={binding.onChange}
            {...(binding.onComposingChange ? { onComposingChange: binding.onComposingChange } : {})}
            {...(binding.onInputBlur ? { onInputBlur: binding.onInputBlur } : {})}
            onSend={binding.onSend}
            channel="all"
            sendDisabled={binding.sendDisabled === true || !chatOpen}
            sendDim={binding.sendDim === true}
            notice={binding.notice ?? null}
            {...(binding.quiet ? { quiet: true } : {})}
            logHeight={LOG_H}
            compact={kbOpen}
            inputRef={inputRef}
            trailing={readyPill}
          />
        }
        pill={readyPill}
      />
      {/* 연출이 끝나면(5600) 방장 전용 왼쪽 세로 줄(19-05 D-13, 대기실과 같은 규칙): 판 종류 · 맵(허용 맵 둘 이상). [봇]·[튜토리얼 먼저]는 대기실 전용이라 없다.
          방장 판정은 서버 view 의 isHost 뿐이고 참가자에게는 줄 마크업이 없다(T-19-16) — 참가자는 읽기 전용 판 종류 칩 하나를 본다(P19-10) */}
      {!finished ? null : isHost ? (
        <HostRail maxHeight={sideMaxH}>
          <HostRailButton key="mode" ref={modeBtnRef} id="mode" icon="deck" label={MODE_TEXT.aria(mode)} pressed={modeOpen} disabled={!canSend} onPress={openMode} />
          {mapsOn ? <MapChip key="map" rail pressed={dressOpen && dressTab === "map"} choice={mapChoice} host={canSend} onPress={() => openDress("map")} /> : null}
        </HostRail>
      ) : (
        <ModeChip mode={mode} />
      )}
      {/* 연출이 끝나면(5600) 오른쪽 세로 한 줄(16-06 D-05·V-5): 방장도 소리 · 옷장, 방장 전용은 왼쪽 줄(19-05) */}
      {finished && !expanded && !dressOpen ? (
        <SideColumn soundSlot maxHeight={sideMaxH}>
          <FloatAction key="dress" ref={dressBtnRef} kind="dress" side="dress" icon="hanger" label={DRESS_TEXT.open} disabled={!canSend} onPress={() => openDress()} />
        </SideColumn>
      ) : null}
      {dressOpen ? (
        <DressSheet
          value={dress.look}
          onPick={dress.pick}
          onClose={closeDress}
          disabled={!canSend}
          taken={takenOutfits}
          host={view.me.isHost && mapsOn}
          tab={dressTab}
          mapChoice={mapChoice}
          onPickMap={pickMap}
        />
      ) : null}
      {modeOpen && isHost ? (
        <ModeSheet
          mode={mode}
          canSend={canSend}
          onPick={(next) => {
            // 보내기만 한다 — 표시는 서버가 방송한 view.mode 가 바꾼다. 방장·단계 판정과 거절은 서버 몫이다(결정 0002)
            if (canSend) send({ t: "modePick", mode: next });
          }}
          onClose={closeMode}
        />
      ) : null}
      {rematch.confirm !== null ? <RestSheet faces={rematch.confirm.resting} onStart={rematch.confirmStart} onCancel={rematch.cancelConfirm} /> : null}
      {leaveOpen ? (
        <ConfirmSheet
          title="방에서 나갈까요?"
          confirmLabel="나가기"
          confirmDisabled={!canSend}
          onConfirm={() => {
            // leave 가 서버에 닿지 않았는데 입장 정보를 지우면 자리만 유령으로 남는다. 보냈을 때만 나간다
            if (send({ t: "leave" }) === false) show("연결이 불안정해요. 다시 시도해 주세요");
            else onExit();
          }}
          onClose={() => setLeaveOpen(false)}
        />
      ) : null}
    </main>
  );
}
