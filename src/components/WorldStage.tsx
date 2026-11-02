import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ClientMessage, PublicPlayer, RoomView } from "../../shared/protocol";
import { MOVE_COORD_LIMIT } from "../../shared/protocol";
import { useReducedMotion } from "../net/useReducedMotion";
import { HEADER_BOTTOM, PANEL_HEIGHT } from "../world/camera";
import { createTapTracker } from "../world/input";
import { createWorldRuntime, EXIT_CURTAIN_MS, EXIT_MS } from "../world/runtime";
import type { RingKind, WorldModules, WorldRuntime } from "../world/runtime";
import type { SceneLook } from "../world/presence";
import { initialMapStatus } from "../world/status";
import type { MapStatusState } from "../world/status";
import type { WorldStore } from "../world/store";
import { installWorldTestHooks, worldTestHooksEnabled } from "../world/testHooks";
import { MapStatusCard } from "./MapStatusCard";
import { HeadStack } from "./v2/HeadStack";
import type { HeadStackProps } from "./v2/HeadStack";
import "../styles/world.css";

// 로비 맵 화면: 캔버스 한 장 + 입력 면 + 이름표 층. three 는 world/runtime 의 import() 로만 열린다(이 파일은 three 를 모른다).
// 위치·카메라·투영은 런타임의 rAF 한 루프가 한다 — 프레임마다 React 가 다시 그리지 않는다. React 는 틀과 글(이름표 내용·접근성)만 맡는다.
// 닉네임은 React 텍스트 노드로만 그린다(HTML 문자열 주입 없음, T-06-29).

function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** 채팅 입력칸(ChatPanel 의 [data-chat-input])에 포커스가 있는가 — D4: 이때의 탭은 걷지 않고 키보드만 닫는다 */
function chatInputFocused(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLElement && el.matches("[data-chat-input]");
}

const SCENE_LABEL = "지하 재즈 바 로비. 바닥을 누르면 그쪽으로 걸어가요";

/** 이름표는 런타임이 첫 위치를 놓을 때까지 보이지 않는다(옛 자리 0,0 에서 한 프레임 번쩍이지 않게). 값이 늘 같아 React 가 다시 쓰지 않는다. */
const TAG_INITIAL_STYLE: CSSProperties = { opacity: 0 };

/** 지목 단계의 이름표 버튼(DAY-04): seats 의 이름표가 누르는 버튼이 된다 */
export interface WorldPick {
  seats: ReadonlySet<number>;
  /** 지금 고른 좌석(aria-pressed) */
  mine?: number;
  /** 버튼의 접근성 이름. 닉네임을 받아 문장을 만든다("{닉네임} 님 가리키기") */
  label(nickname: string): string;
  onPick(seat: number): void;
  /** 이름표 층(role=group)의 접근성 이름 */
  group: string;
}

export interface WorldStageProps {
  view: RoomView;
  store: WorldStore;
  send(msg: ClientMessage): boolean | void;
  canSend: boolean;
  /** 서버시각 − 로컬시각(ms) */
  offset: number;
  /** 스테이지 사각형의 위 끝(헤더 블록 아래, 안전 영역 포함)과 아래 패널 높이 — 06-15 의 Lobby 가 재서 넘긴다. 없으면 HEADER_BOTTOM 62 / PANEL_HEIGHT 250(로비 패널 기본값, LOG_H + 154) */
  stageInsets?: { top: number; bottom: number };
  /** 머리 위에 입력 중 알약(…)을 그릴 좌석(07-18). 서버가 보낸 신호와 내 입력만 담겨 온다 */
  typingSeats?: ReadonlySet<number>;
  /** 게임 단계의 장면 상태(08-08). 없으면 로비 — 모든 좌석을 그린다. 있으면 show 인 좌석만 캐릭터·이름표가 생긴다(GHOST-01) */
  scene?: SceneLook;
  /** 그 좌석의 캐릭터가 손사래와 놀란 표정을 한 번 한다(결정 0049 — 지목 선두가 바뀐 사람). nonce 가 바뀔 때마다 한 번 */
  deny?: { seat: number; nonce: number };
  /** 이동이 허용된 단계인가(기본 true). 거짓이면 맵 탭은 링도 move 도 보내지 않는다 — 권위는 서버 canMove 다(MAP-04) */
  canWalk?: boolean;
  /** 있으면 그 좌석들의 이름표가 지목 버튼이 된다 */
  pick?: WorldPick;
  /** 좌석별 이름표 쌓임 속성(득표 배지·선두·도장·내 선택·투표함·직업 칩 …)과 발밑 고리 종류 */
  tagProps?: (seat: number) => Partial<Omit<HeadStackProps, "name" | "color">> & { ring?: RingKind };
  onNotice(text: string): void;
  onKick(seat: number, nickname: string): void;
  onLeave(): void;
  onReady?(): void;
  exiting?: boolean;
  onExited?(): void;
  loadModules?: () => Promise<WorldModules>;
  /** [새로 고침] 카드가 부른다. 기본은 location.reload(테스트가 바꿔 끼운다) */
  reload?: () => void;
}

/** 자리 구분색: seat 0~7 → --seat-1~8 */
const seatColor = (seat: number): string => `var(--seat-${(((seat % 8) + 8) % 8) + 1})`;

/** 접근성 목록 항목: "{닉네임} 님" + ", 방장" · ", 나" · ", 연결 끊김" */
function listLabel(p: PublicPlayer, mySeat: number): string {
  return `${p.nickname} 님${p.isHost ? ", 방장" : ""}${p.seat === mySeat ? ", 나" : ""}${p.connected ? "" : ", 연결 끊김"}`;
}

export function WorldStage(props: WorldStageProps) {
  const { view } = props;
  const reduced = useReducedMotion();
  const live = useRef({ props, reduced });
  useLayoutEffect(() => {
    live.current = { props, reduced };
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<WorldRuntime | null>(null);
  const [tracker] = useState(createTapTracker);
  // 손가락을 대는 순간 입력칸에 포커스가 있었던 포인터(D4). 떼는 순간에 정하지 않는 이유: 마우스는 누르는 동안 브라우저가 포커스를 옮긴다.
  const downWhileTyping = useRef(new Set<number>());
  const [mapStatus, setMapStatus] = useState<MapStatusState>(initialMapStatus);
  const readyReported = useRef(false);

  // 방을 나간 사람의 이름표는 퇴장 연출(180ms) 동안 남겨 둔다. view 가 바뀐 같은 렌더에서 계산해 한 프레임도 비지 않게 한다.
  const [seenPlayers, setSeenPlayers] = useState(view.players);
  const [leaving, setLeaving] = useState<PublicPlayer[]>([]);
  if (seenPlayers !== view.players) {
    setSeenPlayers(view.players);
    const here = new Set(view.players.map((p) => p.seat));
    const gone = reduced ? [] : seenPlayers.filter((p) => !here.has(p.seat));
    setLeaving((l) => [...l.filter((x) => !here.has(x.seat) && !gone.some((g) => g.seat === x.seat)), ...gone]);
  }
  useEffect(() => {
    if (leaving.length === 0) return;
    const snapshot = leaving;
    const timer = setTimeout(() => setLeaving((l) => l.filter((x) => !snapshot.includes(x))), EXIT_MS + 30);
    return () => clearTimeout(timer);
  }, [leaving]);

  // 런타임은 마운트 한 번에 하나다. 바뀌는 prop 은 live ref 로 읽는다(재시작 없이 최신 값).
  useEffect(() => {
    const host = hostRef.current;
    const tagLayer = tagRef.current;
    if (host === null || tagLayer === null) return;
    // 테스트 훅은 ?e2e=1(세션 저장) 또는 개발 빌드에서만 — 같은 조건에서 소프트웨어 렌더러도 허용한다(E2E 헤드리스, RESEARCH A13)
    const hooksOn = worldTestHooksEnabled(window.location.search, sessionStore(), import.meta.env.DEV);
    const runtime = createWorldRuntime({
      host,
      tagLayer,
      store: live.current.props.store,
      serverNow: () => Date.now() + live.current.props.offset,
      mySeat: () => live.current.props.view.me.seat,
      players: () => live.current.props.view.players,
      reducedMotion: () => live.current.reduced,
      stageRect: () => {
        const ins = live.current.props.stageInsets;
        const h = host.clientHeight || window.innerHeight;
        return { top: ins?.top ?? HEADER_BOTTOM, bottom: h - (ins?.bottom ?? PANEL_HEIGHT) };
      },
      onStatus: setMapStatus,
      onNotice: (text) => live.current.props.onNotice(text),
      onRing: (at) => {
        const root = rootRef.current;
        if (root === null) return;
        if (at === null) root.removeAttribute("data-ring");
        else root.setAttribute("data-ring", `${at.x.toFixed(2)},${at.z.toFixed(2)}`);
      },
      allowSoftware: hooksOn,
      loadModules: live.current.props.loadModules,
    });
    runtimeRef.current = runtime;
    runtime.setScene(live.current.props.scene ?? null);
    const offHooks = hooksOn ? installWorldTestHooks(runtime, live.current.props.store) : null;
    void runtime.start();
    return () => {
      offHooks?.();
      runtime.dispose();
      if (runtimeRef.current === runtime) runtimeRef.current = null;
    };
  }, []);

  // 맵이 처음 열리면 한 번 알린다(06-15 가 PhaseHeader 안내를 접는 데 쓴다)
  useEffect(() => {
    if (mapStatus.status !== "ready" || readyReported.current) return;
    readyReported.current = true;
    live.current.props.onReady?.();
  }, [mapStatus.status]);

  // 나가기: night-900 으로 420ms 덮은 뒤 렌더러·캐릭터 자원을 해제하고 알린다. 걷던 캐릭터는 그 자리에서 멈춘다.
  const exiting = props.exiting === true;
  useEffect(() => {
    if (!exiting) return;
    const timer = setTimeout(() => {
      runtimeRef.current?.dispose();
      live.current.props.onExited?.();
    }, EXIT_CURTAIN_MS);
    return () => clearTimeout(timer);
  }, [exiting]);

  // view 가 바뀌면 퇴장·끊김 표시를 런타임에 맞춘다(그리기 전에)
  useLayoutEffect(() => {
    runtimeRef.current?.syncPlayers();
  }, [view.players]);

  // 장면 상태가 바뀌면 런타임에 건넨다(그리기 전에)
  useLayoutEffect(() => {
    runtimeRef.current?.setScene(props.scene ?? null);
  }, [props.scene]);

  // 손사래: 처음 마운트 때의 값은 지난 일이라 하지 않는다(재접속·화면 전환에서 되살리지 않는다)
  const denySeen = useRef(props.deny?.nonce);
  useLayoutEffect(() => {
    const d = props.deny;
    if (d === undefined || d.nonce === denySeen.current) return;
    denySeen.current = d.nonce;
    runtimeRef.current?.deny(d.seat);
  }, [props.deny]);

  // 탭 하나: 링을 바로 띄우고 목적지 정수 두 개만 보낸다. 내 캐릭터는 같은 길로 바로 걷고 서버 구간이 오면 맞춘다(결정 0059).
  const onTap = (clientX: number, clientY: number): void => {
    const { props: p } = live.current;
    const runtime = runtimeRef.current;
    if (p.canWalk === false || runtime === null || !p.canSend || p.exiting) return;
    const at = runtime.tap(clientX, clientY);
    if (at === null) return;
    const clamp = (v: number): number => Math.max(-MOVE_COORD_LIMIT, Math.min(MOVE_COORD_LIMIT, Math.round(v * 100)));
    const dest = { x: clamp(at.x), z: clamp(at.z) };
    const sent = p.send({ t: "move", x: dest.x, z: dest.z });
    if (sent === false) runtime.cancelMove();
    else runtime.notifyMoveSent(Date.now() + p.offset, dest);
  };

  const mySeat = view.me.seat;
  const here = new Set(view.players.map((p) => p.seat));
  const scene = props.scene;
  const shown = (seat: number): boolean => scene === undefined || scene.seats[seat]?.show === true;
  // 보이지 않는 좌석은 이름표도 만들지 않는다(T-08-30)
  const roster = [...view.players, ...leaving.filter((p) => !here.has(p.seat))].filter((p) => shown(p.seat));
  const canKick = view.me.isHost && props.canSend;
  const pick = props.pick;

  const stateClass = exiting ? "is-exiting" : mapStatus.status === "ready" ? "is-open" : mapStatus.status === "lost" || mapStatus.status === "recreating" ? "is-redrawing" : "";

  return (
    <div ref={rootRef} className={stateClass ? `mf-world ${stateClass}` : "mf-world"} data-world-stage>
      <div ref={hostRef} className="mf-world__canvas" role="img" aria-label={SCENE_LABEL} />
      <div
        className="mf-world__input"
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          if (chatInputFocused()) downWhileTyping.current.add(e.pointerId);
          else downWhileTyping.current.delete(e.pointerId);
          tracker.down(e.pointerId, e.clientX, e.clientY, Date.now());
        }}
        onPointerMove={(e) => tracker.move(e.pointerId, e.clientX, e.clientY)}
        onPointerUp={(e) => {
          const at = tracker.up(e.pointerId, e.clientX, e.clientY, Date.now());
          const typing = downWhileTyping.current.delete(e.pointerId);
          if (at === null) return;
          // D4: 입력칸에 포커스가 있는 동안의 탭은 키보드만 닫는다(blur). 걷기 요청도 링도 없다. 닫힌 뒤의 탭부터 평소처럼 걷는다.
          if (typing) {
            if (chatInputFocused()) (document.activeElement as HTMLElement).blur();
            return;
          }
          onTap(at.x, at.y);
        }}
        onPointerCancel={(e) => {
          downWhileTyping.current.delete(e.pointerId);
          tracker.cancel(e.pointerId);
        }}
      />
      <div ref={tagRef} className="mf-world__tags" role={pick ? "group" : undefined} aria-label={pick?.group}>
        {/* 지목 단계에는 이름표 버튼이 같은 사람들을 읽으므로 목록은 읽히지 않게 한다(한 벌만 둔다) */}
        <ul className="mf-world__sr mf-sr-only" aria-label={`방에 있는 사람 ${view.players.length}명`} aria-hidden={pick ? true : undefined}>
          {view.players.map((p) => (
            <li key={p.seat}>{listLabel(p, mySeat)}</li>
          ))}
        </ul>
        {roster.map((p) => {
          const current = here.has(p.seat);
          const me = p.seat === mySeat;
          const away = !p.connected;
          const pickable = current && pick !== undefined && pick.seats.has(p.seat);
          const kickable = !pickable && current && canKick && away && !me;
          const { ring, ...extra } = props.tagProps?.(p.seat) ?? {};
          const stack = (
            <HeadStack
              name={p.nickname}
              color={seatColor(p.seat)}
              me={me}
              away={away}
              typing={props.typingSeats?.has(p.seat) === true}
              ghost={scene?.seats[p.seat]?.ghost === true ? true : undefined}
              mine={pickable && pick.mine === p.seat ? true : undefined}
              {...extra}
            />
          );
          return (
            <div
              key={p.seat}
              className="mf-world__tag"
              data-seat={p.seat}
              data-me={me ? "true" : undefined}
              data-away={away ? "true" : undefined}
              data-lead={extra.lead ? "true" : undefined}
              data-ring-kind={ring}
              aria-hidden={kickable || pickable ? undefined : true}
              style={TAG_INITIAL_STYLE}
            >
              {pickable ? (
                <button
                  type="button"
                  className="mf-world__pick"
                  data-pick={p.seat}
                  aria-label={pick.label(p.nickname)}
                  aria-pressed={pick.mine === p.seat}
                  aria-disabled={props.canSend ? undefined : true}
                  // 버튼을 눌러도 채팅 입력칸의 포커스(키보드)를 뺏지 않는다
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (live.current.props.canSend) live.current.props.pick?.onPick(p.seat);
                  }}
                >
                  {stack}
                </button>
              ) : kickable ? (
                <button type="button" className="mf-world__kick" aria-label={`${p.nickname} 님 내보내기`} onClick={() => live.current.props.onKick(p.seat, p.nickname)}>
                  {stack}
                </button>
              ) : (
                stack
              )}
            </div>
          );
        })}
      </div>
      <div className="mf-world__veil">
        <MapStatusCard
          status={mapStatus.status}
          onRetry={() => void runtimeRef.current?.retry()}
          onLeave={() => live.current.props.onLeave()}
          onReload={() => (live.current.props.reload ?? (() => window.location.reload()))()}
        />
      </div>
    </div>
  );
}
