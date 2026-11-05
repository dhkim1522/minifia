import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { isAlive } from "../../shared/game/alive";
import type { ClientMessage, EmoteId, PhaseId, RoomView } from "../../shared/protocol";
import { Button } from "../components/Button";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { Icon } from "../components/Icon";
import { ChatPanel } from "../components/v2/ChatPanel";
import { ResultPanel } from "../components/v2/ResultPanel";
import type { ResultTab } from "../components/v2/ResultPanel";
import { TopToast, useTopToast } from "../components/v2/TopToast";
import { V2Icon } from "../components/v2/V2Icon";
import { WorldStage } from "../components/WorldStage";
import { LOG_H_KB } from "../game/chatUi";
import { castOf, holdSnap, markTimes, RESULT_TIMELINE, resultPanelHeight, slotsFor, stateAt, walkSnap } from "../game/resultDirector";
import type { ResultState } from "../game/resultDirector";
import { RESULT_TEXT } from "../game/verdict";
import type { ChatStore } from "../net/chatStore";
import type { ResultLogStore } from "../net/resultLogStore";
import { useChat } from "../net/useChat";
import { useMapInsets } from "../net/useMapInsets";
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
// 모두 직업 의상을 입고, 진 팀은 어둡고 이긴 팀은 무대 가운데 조명을 받는다. 읽는 글은 헤더의 승리 한 줄뿐이다(결정 0051).
// 직업은 view.result.seats 에서만 읽고(resultDirector.castOf) 판 중 장면 경로(visibleSeats)에는 두지 않는다(T-11-15).
// 연출 값(누가 어디에 서고 언제 뒤집히는지)은 resultDirector 만 계산하고 이 파일은 그 값을 그린다.
// 아래 패널은 접힌 게임 패널과 같은 높이의 전체 채팅 한 줄이다(동작 버튼 없음). 헤더 [나가기]는 로비와 같은 확인 시트를 연다.

/** 결과 화면 장면: 카메라 무대 중심 고정, 밤 조명, 이긴 팀 조명 구간에만 무대 가운데 점 조명 */
function sceneOf(cast: ReturnType<typeof castOf>, state: ResultState): SceneLook {
  const seats: Record<number, SeatLook> = {};
  for (const c of cast) {
    const costume = state.costumes[c.seat];
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

/** 탭 행(44)이 패널 위 여백(14)을 먹고 아래 간격 10 을 더해, 접힌 패널 높이를 게임 패널과 같게 두려고 기록 칸에서 덜어 내는 높이(44 + 10 − 14) */
const TAB_ROW_H = 40;

/** 박수 큐 한 묶음(WorldStage emoteCues). nonce 가 새로 보일 때마다 한 번 재생한다 */
type ClapCues = readonly { seat: number; id: EmoteId; nonce: number }[];

export function ResultScreen({ view, store, chat, resultLog, send, canSend, offset, epoch, onExit, arrivedFrom }: ResultScreenProps) {
  const { result } = view;
  const toast = useTopToast();
  const { show } = toast;
  const [leaveOpen, setLeaveOpen] = useState(false);
  const { rootRef, headerRef, panelRef, inputRef, kbOpen, logH, stageInsets } = useMapInsets();

  // 탭 패널(11-07): 현재 탭과 열어 본 탭 집합은 이 화면이 쥔다. 전체가 아닌 탭이면 패널이 확장되고 연출 시계가 멈춘다(D-3, D-25)
  const [tab, setTab] = useState<ResultTab>("all");
  const [opened, setOpened] = useState<ReadonlySet<ResultTab>>(() => new Set<ResultTab>(["all"]));
  const expanded = tab !== "all";
  const pickTab = useCallback((next: ResultTab) => {
    setTab(next);
    setOpened((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
  }, []);
  const logRevision = useSyncExternalStore(
    useCallback((cb: () => void) => resultLog.subscribe(cb), [resultLog]),
    useCallback(() => resultLog.revision(), [resultLog]),
  );
  const logLines = useMemo(() => resultLog.snapshot(), [resultLog, logRevision]); // eslint-disable-line react-hooks/exhaustive-deps
  const contacts = useMemo(() => new Map(view.players.map((p) => [p.seat, p.nickname] as const)), [view.players]);
  // 확장 높이: 방 높이(루트 높이)로 한 번 정하고 화면 방향·크기가 바뀔 때만 다시 잰다(키보드·주소창으로는 다시 정하지 않는다, useChatLogHeight 와 같은 길)
  const [roomH, setRoomH] = useState(0);
  useLayoutEffect(() => {
    const measure = (): void => setRoomH(rootRef.current?.clientHeight || window.innerHeight);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [rootRef]);

  // 출연자 표는 내용이 바뀔 때만 다시 만든다 — 같은 결과가 다시 와도(닉네임·연결 상태만 바뀐 view) 시계·자리 snap 을 다시 시작하지 않는다
  const castKey = `${result.seats.map((s) => `${s.seat}:${s.job}`).join(",")}|${view.players.map((p) => `${p.seat}:${isAlive(p) ? 1 : 0}`).join(",")}`;
  const cast = useMemo(() => castOf(view), [castKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const winner = result.winner;
  const tl = RESULT_TIMELINE;

  // 연출 시계(각자 폰 안): 마운트 때 한 번 정한 연출 여부. 직전 단계가 처형·아침인 마운트에서만 시간표를 돈다. 재접속·처음 마운트·모션 줄이기는 곧바로 최종 상태다(이후 view 가 다시 와도 되돌아가지 않는다)
  const reduced = useReducedMotion();
  const [reveal] = useState<boolean>(() => !reduced && (arrivedFrom === "execution" || arrivedFrom === "morning"));
  // mark = 마지막으로 닿은 시간표 시각. 상태는 mark 의 순수 함수(stateAt)라 프레임마다 다시 그리지 않고 표시각마다 한 번 바꾼다
  const [mark, setMark] = useState<number>(reveal ? 0 : tl.ceremonyStartMs);
  const [skipped, setSkipped] = useState(false);
  const [cues, setCues] = useState<ClapCues>([]);
  const markRef = useRef(mark);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nonce = useRef(0);

  const state = useMemo(() => stateAt(mark, cast, winner), [mark, cast, winner]);
  const scene = useMemo(() => sceneOf(cast, state), [cast, state]);

  // 위치: 모두 자기 둘레 자리로. 연출이면 스토어의 마지막 위치에서 걷는 구간(1200ms), 아니면 한 점 구간이다. 런타임이 만들어지기 전(레이아웃 효과)에 먹여 첫 프레임부터 맞다.
  // 서버 상태가 아니라 이 폰의 연출이다 — 서버 시각 기준(t0 = 지금 + offset)으로 만들어 런타임이 서버 구간과 똑같이 그린다. 새 연결(epoch)이면 다시 먹인다
  const slots = useMemo(() => slotsFor(cast), [cast]);
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
  const goto = useCallback(
    (m: number) => {
      markRef.current = m;
      setMark(m);
      const clap = stateAt(m, cast, winner).clap;
      if (clap.length > 0) setCues(clap.map((seat) => ({ seat, id: "clap" as const, nonce: ++nonce.current })));
    },
    [cast, winner],
  );
  const schedule = useCallback(
    (from: number) => {
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
  const tagProps = useCallback((seat: number) => (flipped.has(seat) ? { role: jobBySeat.get(seat)! } : {}), [flipped, jobBySeat]);

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
  const onCostumes = useCallback((costumes: Readonly<Record<number, string>>, dimmed: readonly number[]) => {
    hook.current?.patch({ costumes: { ...costumes }, dimmed: [...dimmed] });
  }, []);

  // 채팅: 결과 단계에서 서버는 typing·emote 를 버린다 — 클라이언트가 보내지 않게 한 겹 막는다. 보낼 수 있는 건 view.me.chat 이 all 일 때뿐이다(D-11)
  const guardedSend = useCallback((msg: ClientMessage) => (msg.t === "typing" || msg.t === "emote" ? true : send(msg)), [send]);
  const binding = useChat({ store: chat, connection: { send: guardedSend, canSend }, view });
  const chatOpen = view.me.chat === "all";

  const title = RESULT_TEXT.title[state.title];
  return (
    <main ref={rootRef} className="mf-root mf-result" data-result-stage={state.stage} data-reveal={String(reveal)} data-winner={winner} data-kb-open={kbOpen ? "true" : undefined}>
      <WorldStage
        view={view}
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
        <Button variant="secondary" compact className="mf-iconbtn" aria-label="나가기" icon={<Icon name="back" />} disabled={!canSend} onClick={() => setLeaveOpen(true)} />
        <h1 className="mf-result__title" data-title={state.title} data-guide="">
          {state.title === "result" ? null : <V2Icon name={state.title === "mafiaWin" ? "roleMafia" : "roleCitizen"} size={28} className={state.title === "mafiaWin" ? "mf-result__title-icon is-mafia" : "mf-result__title-icon"} />}
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
        onTab={pickTab}
        expanded={expanded}
        {...(resultPanelHeight(roomH) !== undefined ? { expandedHeight: resultPanelHeight(roomH)! } : {})}
        tabsVisible
        lines={logLines}
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
            logHeight={kbOpen ? LOG_H_KB : logH - TAB_ROW_H}
            compact={kbOpen}
            inputRef={inputRef}
          />
        }
      />
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
