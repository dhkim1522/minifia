import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ClientMessage, PublicPlayer, RoomView } from "../../shared/protocol";
import { MOVE_COORD_LIMIT } from "../../shared/protocol";
import { useReducedMotion } from "../net/useReducedMotion";
import { HEADER_BOTTOM, PANEL_HEIGHT } from "../world/camera";
import { createTapTracker } from "../world/input";
import { createWorldRuntime, EXIT_MS } from "../world/runtime";
import type { WorldModules, WorldRuntime } from "../world/runtime";
import { initialMapStatus } from "../world/status";
import type { MapStatusState } from "../world/status";
import type { WorldStore } from "../world/store";
import { HeadStack } from "./v2/HeadStack";
import "../styles/world.css";

// 로비 맵 화면: 캔버스 한 장 + 입력 면 + 이름표 층. three 는 world/runtime 의 import() 로만 열린다(이 파일은 three 를 모른다).
// 위치·카메라·투영은 런타임의 rAF 한 루프가 한다 — 프레임마다 React 가 다시 그리지 않는다. React 는 틀과 글(이름표 내용·접근성)만 맡는다.
// 닉네임은 React 텍스트 노드로만 그린다(innerHTML 없음, T-06-29).

const SCENE_LABEL = "지하 재즈 바 로비. 바닥을 누르면 그쪽으로 걸어가요";

/** 이름표는 런타임이 첫 위치를 놓을 때까지 보이지 않는다(옛 자리 0,0 에서 한 프레임 번쩍이지 않게). 값이 늘 같아 React 가 다시 쓰지 않는다. */
const TAG_INITIAL_STYLE: CSSProperties = { opacity: 0 };

export interface WorldStageProps {
  view: RoomView;
  store: WorldStore;
  send(msg: ClientMessage): boolean | void;
  canSend: boolean;
  /** 서버시각 − 로컬시각(ms) */
  offset: number;
  /** 스테이지 사각형의 위 끝(헤더 블록 아래, 안전 영역 포함)과 아래 패널 높이 — 06-15 의 Lobby 가 재서 넘긴다. 없으면 HEADER_BOTTOM 62 / PANEL_HEIGHT 88 */
  stageInsets?: { top: number; bottom: number };
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
  const [, setMapStatus] = useState<MapStatusState>(initialMapStatus);

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
      allowSoftware: false,
      loadModules: live.current.props.loadModules,
    });
    runtimeRef.current = runtime;
    void runtime.start();
    return () => {
      runtime.dispose();
      if (runtimeRef.current === runtime) runtimeRef.current = null;
    };
  }, []);

  // view 가 바뀌면 퇴장·끊김 표시를 런타임에 맞춘다(그리기 전에)
  useLayoutEffect(() => {
    runtimeRef.current?.syncPlayers();
  }, [view.players]);

  // 탭 하나: 링을 바로 띄우고(런타임) 목적지 정수 두 개만 보낸다. 위치는 서버 구간이 와야 정해진다(예측 이동 없음).
  const onTap = (clientX: number, clientY: number): void => {
    const { props: p } = live.current;
    const runtime = runtimeRef.current;
    if (runtime === null || !p.canSend) return;
    const at = runtime.tap(clientX, clientY);
    if (at === null) return;
    const clamp = (v: number): number => Math.max(-MOVE_COORD_LIMIT, Math.min(MOVE_COORD_LIMIT, Math.round(v * 100)));
    const sent = p.send({ t: "move", x: clamp(at.x), z: clamp(at.z) });
    if (sent === false) runtime.cancelMove();
    else runtime.notifyMoveSent(Date.now() + p.offset);
  };

  const mySeat = view.me.seat;
  const here = new Set(view.players.map((p) => p.seat));
  const roster = [...view.players, ...leaving.filter((p) => !here.has(p.seat))];
  const canKick = view.me.isHost && props.canSend;

  return (
    <div ref={rootRef} className="mf-world" data-world-stage>
      <div ref={hostRef} className="mf-world__canvas" role="img" aria-label={SCENE_LABEL} />
      <div
        className="mf-world__input"
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          tracker.down(e.pointerId, e.clientX, e.clientY, Date.now());
        }}
        onPointerMove={(e) => tracker.move(e.pointerId, e.clientX, e.clientY)}
        onPointerUp={(e) => {
          const at = tracker.up(e.pointerId, e.clientX, e.clientY, Date.now());
          if (at !== null) onTap(at.x, at.y);
        }}
        onPointerCancel={(e) => tracker.cancel(e.pointerId)}
      />
      <div ref={tagRef} className="mf-world__tags">
        <ul className="mf-world__sr" aria-label={`방에 있는 사람 ${view.players.length}명`}>
          {view.players.map((p) => (
            <li key={p.seat}>{listLabel(p, mySeat)}</li>
          ))}
        </ul>
        {roster.map((p) => {
          const current = here.has(p.seat);
          const me = p.seat === mySeat;
          const away = !p.connected;
          const kickable = current && canKick && away && !me;
          const stack = <HeadStack name={p.nickname} color={seatColor(p.seat)} me={me} away={away} />;
          return (
            <div
              key={p.seat}
              className="mf-world__tag"
              data-seat={p.seat}
              data-me={me ? "true" : undefined}
              data-away={away ? "true" : undefined}
              aria-hidden={kickable ? undefined : true}
              style={TAG_INITIAL_STYLE}
            >
              {kickable ? (
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
    </div>
  );
}
