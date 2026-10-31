import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { MOVE_COORD_LIMIT } from "../../shared/protocol";
import { useReducedMotion } from "../net/useReducedMotion";
import { HEADER_BOTTOM, PANEL_HEIGHT } from "../world/camera";
import { createTapTracker } from "../world/input";
import { createWorldRuntime } from "../world/runtime";
import type { WorldModules, WorldRuntime } from "../world/runtime";
import { initialMapStatus } from "../world/status";
import type { MapStatusState } from "../world/status";
import type { WorldStore } from "../world/store";
import "../styles/world.css";

// 로비 맵 화면: 캔버스 한 장 + 입력 면 + 이름표 층. three 는 world/runtime 의 import() 로만 열린다(이 파일은 three 를 모른다).
// 위치·카메라·투영은 런타임의 rAF 한 루프가 한다 — 프레임마다 React 가 다시 그리지 않는다. React 는 틀과 글(이름표 내용·접근성)만 맡는다.
// 닉네임은 React 텍스트 노드로만 그린다(innerHTML 없음, T-06-29).

const SCENE_LABEL = "지하 재즈 바 로비. 바닥을 누르면 그쪽으로 걸어가요";

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
}

export function WorldStage(props: WorldStageProps) {
  const reduced = useReducedMotion();
  const live = useRef({ props, reduced });
  useLayoutEffect(() => {
    live.current = { props, reduced };
  });

  const hostRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<WorldRuntime | null>(null);
  const [tracker] = useState(createTapTracker);
  const [, setMapStatus] = useState<MapStatusState>(initialMapStatus);

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

  // 탭 하나: 링을 바로 띄우고(런타임) 목적지 정수 두 개만 보낸다. 위치는 서버 구간이 와야 정해진다(예측 이동 없음).
  const onTap = (clientX: number, clientY: number): void => {
    const { props: p } = live.current;
    const runtime = runtimeRef.current;
    if (runtime === null || !p.canSend) return;
    const at = runtime.tap(clientX, clientY);
    if (at === null) return;
    const clamp = (v: number): number => Math.max(-MOVE_COORD_LIMIT, Math.min(MOVE_COORD_LIMIT, Math.round(v * 100)));
    const sent = p.send({ t: "move", x: clamp(at.x), z: clamp(at.z) });
    if (sent !== false) runtime.notifyMoveSent(Date.now() + p.offset);
  };

  return (
    <div className="mf-world" data-world-stage>
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
      <div ref={tagRef} className="mf-world__tags" />
    </div>
  );
}
