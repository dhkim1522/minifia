import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { phaseKey } from "../../shared/game/audience";
import type { ClientMessage, EmoteId, MapId, PlaceId, PublicPlayer, RoomView } from "../../shared/protocol";
import { MOVE_COORD_LIMIT } from "../../shared/protocol";
import { placeMarkerPlan } from "../game/errandView";
import type { Rect } from "../game/errandView";
import { useReducedMotion } from "../net/useReducedMotion";
import { HEADER_BOTTOM, PANEL_HEIGHT } from "../world/camera";
import { createTapTracker } from "../world/input";
import { createWorldRuntime, EXIT_CURTAIN_MS, EXIT_MS, ringKindAttr } from "../world/runtime";
import type { RingKind, WorldModules, WorldRuntime } from "../world/runtime";
import type { SceneLook } from "../world/presence";
import { initialMapStatus } from "../world/status";
import type { MapStatusState } from "../world/status";
import type { WorldStore } from "../world/store";
import { installEmotesHook, installGhostsHook, installLooksHook, installMapHook, installPinHook, installWorldTestHooks, worldTestHooksEnabled } from "../world/testHooks";
import { MapStatusCard } from "./MapStatusCard";
import { ErrandAct } from "./v2/ErrandAct";
import { ErrandArrow, ErrandMarker } from "./v2/ErrandMarker";
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
  /** 참이면(연결 끊김 등) 이름표 버튼은 aria-disabled="true" 이고 눌러도 onPick 을 부르지 않는다. 누르기 영역·모양은 그대로 */
  disabled?: boolean;
}

/** 심부름 층 입력: 장소 중심(월드 단위)·처리 여부, 가장 가까운 미처리 장소, 처리 반경 안 미처리 장소, 빛남 여부, 근처 반경(월드 단위) */
export interface ErrandLayerProps {
  places: ReadonlyArray<{ id: PlaceId; x: number; z: number; done: boolean }>;
  nextId: PlaceId | null;
  /** 처리 반경 안 미처리 장소. 있을 때만 그 타일 위에 [처리] 알약이 서고(그때 화살표·타일 빛은 꺼진다) 알약이 빛난다 */
  actId: PlaceId | null;
  /** 가장 가까운 미처리 타일을 빛나게 할지 — 처리 반경 안에 미완료가 있거나 3곳 완료·유령이면 거짓. 화살표는 빛나지 않는다 */
  callPlace: boolean;
  nearR: number;
  /** 타일을 눌렀다는 알림(걷기는 이 층이 바닥 탭과 같은 경로로 한다) */
  onWalk?(id: PlaceId): void;
  /** [처리] 알약을 눌렀다는 알림(처리 메시지는 쓰는 쪽이 보낸다) */
  onAct?(): void;
}

const NEAR_RING_POINTS = 24;
/** 링 svg 의 처음 마운트 스타일(위치를 아직 모른다). 값이 늘 같아 React 가 다시 쓰지 않는다 */
const RING_HIDDEN: CSSProperties = { display: "none" };
const TILE_HALF = 32; // 타일 64 의 절반
const ARROW_HALF = 20; // 화살표 글리프 40 의 절반
const PILL_H = 44; // [처리] 알약 높이
const PILL_W_FALLBACK = 96; // 알약 폭을 아직 잴 수 없을 때(그리기 전)
const RECT_TTL_MS = 250; // 소리 열·이름표 사각형을 다시 재는 간격(프레임마다 레이아웃을 강제하지 않는다)

interface ErrandWriteCache {
  at: number;
  stage: Rect;
  /** 소리 열 첫 칸·오른쪽 열 단추들과 진행 점 줄(윗변 − 8 부터)을 타일·알약·화살표가 피한다 */
  avoid: Rect[];
  /** 내 이름표 사각형(화살표만 피한다) */
  tag: Rect | null;
}

/** 프레임 투영 쓰기 — 숨김·transform·빛남·후광·링 점만 DOM 에 직접 쓴다. 값이 같으면 쓰지 않는다 */
function writeErrandLayer(
  layer: HTMLElement,
  actLayer: HTMLElement | null,
  host: HTMLElement,
  cfg: ErrandLayerProps,
  project: (x: number, z: number) => { sx: number; sy: number } | null,
  mine: { x: number; z: number } | null,
  insets: { top: number; bottom: number },
  cache: { current: ErrandWriteCache | null },
  now: number,
): void {
  if (cache.current === null || now - cache.current.at >= RECT_TTL_MS) {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    const base = host.getBoundingClientRect();
    const rel = (el: Element): Rect => {
      const d = el.getBoundingClientRect();
      return { left: d.left - base.left, top: d.top - base.top, right: d.right - base.left, bottom: d.bottom - base.top };
    };
    const avoid = [...host.ownerDocument.querySelectorAll("[data-side-button]")].map(rel);
    // 진행 점 줄(16-08, V-23): 아래 패널이 없는 심부름 스테이지는 화면 아래까지 넓어서 타일·알약은 점 줄 윗변 − 8 위에만 놓는다.
    // 스테이지 아래 끝을 점 줄 윗변으로 올리고(안쪽 여백 8 이 윗변 − 8 이 된다) 줄 자체도 피할 사각형에 더한다.
    let stageBottom = h - insets.bottom;
    const dotsEl = host.ownerDocument.querySelector("[data-errand-dots]");
    if (dotsEl !== null) {
      const dr = rel(dotsEl);
      if (dr.bottom > dr.top) {
        avoid.push({ left: dr.left, top: dr.top - 8, right: dr.right, bottom: dr.bottom });
        stageBottom = Math.min(stageBottom, dr.top);
      }
    }
    const tagEl = host.querySelector(".mf-world__tag[data-me]");
    cache.current = { at: now, stage: { left: 0, top: insets.top, right: w, bottom: stageBottom }, avoid, tag: tagEl === null ? null : rel(tagEl) };
  }
  const { stage, avoid, tag } = cache.current;
  const items: Array<{ id: PlaceId; x: number; y: number }> = [];
  for (const pl of cfg.places) {
    const pt = project(pl.x, pl.z);
    if (pt !== null) items.push({ id: pl.id, x: pt.sx, y: pt.sy });
  }
  const me = mine === null ? null : project(mine.x, mine.z);
  const actEl = actLayer?.querySelector<HTMLElement>("[data-errand-act]") ?? null;
  const pillW = actEl !== null && actEl.offsetWidth > 0 ? actEl.offsetWidth : PILL_W_FALLBACK;
  const plan = placeMarkerPlan({
    stage,
    avoid,
    items,
    me: me === null ? null : { x: me.sx, y: me.sy },
    nextId: cfg.nextId,
    actId: cfg.actId,
    ...(tag !== null ? { arrowAvoid: [tag] } : {}),
    pillW,
  });
  const shownPins = new Map(plan.pins.map((p) => [p.id, p]));
  const toggle = (el: Element, name: string, on: boolean): void => {
    if (on === el.hasAttribute(name)) return;
    if (on) el.setAttribute(name, "");
    else el.removeAttribute(name);
  };
  const lit = (on: boolean, el: Element): void => {
    el.classList.toggle("is-call", on);
    toggle(el, "data-call", on);
  };
  const place = (el: HTMLElement, x: number, y: number, halfX: number, halfY: number): void => {
    const t = `translate(${Math.round(x - halfX)}px, ${Math.round(y - halfY)}px)`;
    if (el.style.transform !== t) el.style.transform = t;
    if (el.hidden) el.hidden = false;
  };
  const doneIds = new Set(cfg.places.filter((p) => p.done).map((p) => p.id));
  for (const el of layer.querySelectorAll<HTMLElement>("button[data-errand-place]")) {
    const id = el.getAttribute("data-errand-place") as PlaceId;
    const pin = shownPins.get(id);
    if (pin === undefined) {
      if (!el.hidden) el.hidden = true;
      lit(false, el);
      toggle(el, "data-rest", false);
      continue;
    }
    place(el, pin.x, pin.y, TILE_HALF, TILE_HALF);
    // 빛남 우선: 알약이 있으면 알약만 빛나고(타일은 꺼짐), 아니면 가장 가까운 미처리 타일. 남은 곳 정지 후광(data-rest)은 빛남과 무관하게 유지
    const on = cfg.actId === null && cfg.callPlace && cfg.nextId === id;
    lit(on, el);
    toggle(el, "data-rest", !doneIds.has(id) && !on);
  }
  const arrowEl = layer.querySelector<HTMLElement>("[data-errand-arrow]");
  if (arrowEl !== null) {
    if (plan.arrow === null) {
      if (!arrowEl.hidden) arrowEl.hidden = true;
    } else {
      place(arrowEl, plan.arrow.x, plan.arrow.y, ARROW_HALF, ARROW_HALF);
      const turn = arrowEl.querySelector<HTMLElement>(".mv-errand-arrow__turn");
      const rot = `rotate(${Math.round(plan.arrow.angle * 10) / 10}deg)`;
      if (turn !== null && turn.style.transform !== rot) turn.style.transform = rot;
    }
  }
  if (actEl !== null) {
    if (plan.act === null) {
      if (!actEl.hidden) actEl.hidden = true;
    } else {
      place(actEl, plan.act.x, plan.act.y, pillW / 2, PILL_H / 2);
      lit(true, actEl);
    }
  }
  const ring = layer.querySelector<SVGElement>("svg[data-near-ring]");
  if (ring !== null) {
    let pts: string | null = null;
    if (mine !== null) {
      const parts: string[] = [];
      for (let i = 0; i < NEAR_RING_POINTS; i++) {
        const a = (i / NEAR_RING_POINTS) * Math.PI * 2;
        const pt = project(mine.x + Math.cos(a) * cfg.nearR, mine.z + Math.sin(a) * cfg.nearR);
        if (pt === null) {
          parts.length = 0;
          break;
        }
        parts.push(`${pt.sx.toFixed(1)},${pt.sy.toFixed(1)}`);
      }
      if (parts.length === NEAR_RING_POINTS) pts = parts.join(" ");
    }
    const poly = ring.querySelector("polygon");
    // svg 는 hidden 속성이 타입에도 브라우저 기본 스타일에도 없다 — display 로 숨긴다(처음 마운트 값 RING_HIDDEN 과 같은 쪽)
    if (pts === null) {
      if (ring.style.display !== "none") ring.style.display = "none";
    } else {
      if (poly !== null && poly.getAttribute("points") !== pts) poly.setAttribute("points", pts);
      if (ring.style.display === "none") ring.style.display = "";
    }
  }
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
  /** 그 좌석의 캐릭터가 놀란 표정만 한 번 짓는다(손사래 없음 — 암살당한 본인의 연출, 09-20). nonce 가 바뀔 때마다 한 번 */
  surprise?: { seat: number; nonce: number };
  /** 이동이 허용된 단계인가(기본 true). 거짓이면 맵 탭은 링도 move 도 보내지 않는다 — 권위는 서버 canMove 다(MAP-04) */
  canWalk?: boolean;
  /** 있으면 그 좌석들의 이름표가 지목 버튼이 된다 */
  pick?: WorldPick;
  /**
   * 무대(캐릭터 빈 곳 포함) 탭 한 번마다 불린다 — 결과 화면의 건너뛰기(11-05, D-25). 끌기·입력칸 포커스 중 탭(키보드 닫기)에는 부르지 않는다.
   * canWalk 가 거짓이어도 부른다(걷기 요청과 무관한 알림이다)
   */
  onStageTap?(): void;
  /**
   * 화면 연출 동작 큐(결과 화면의 박수, 11-05): 각 항목의 nonce 가 새로 보일 때마다 그 좌석의 캐릭터가 동작을 한 번 재생한다(deny·surprise 와 같은 규칙 — 처음 마운트 때의 값은 지난 일이다).
   * 서버 동작과 같은 재생 목록·동시 상한을 쓰고 서버로는 아무것도 보내지 않는다
   */
  emoteCues?: readonly { seat: number; id: EmoteId; nonce: number }[];
  /** 결과 장면에서 런타임이 실제로 입힌 직업 의상 표(좌석 → 의상 id)와 어두워진 좌석이 바뀔 때만 불린다(E2E 훅용, 11-05) */
  onCostumes?(costumes: Readonly<Record<number, string>>, dimmed: readonly number[]): void;
  /** 캔버스·입력 면 위, 이름표 층 아래에 깔리는 장식(시민 편 긴장 비네트). 터치를 막지 않는 부품만 넣는다 */
  underlay?: ReactNode;
  /** 좌석별 이름표 쌓임 속성(득표 배지·선두·도장·내 선택·투표함·직업 칩 …)과 발밑 고리 종류 */
  tagProps?: (seat: number) => Partial<Omit<HeadStackProps, "name" | "color">> & { ring?: RingKind; turn?: boolean };
  /**
   * 심부름 층(15·16페이즈, errand 단계만). 있으면 이름표 층 아래에 내 장소 타일·발밑 화살표·근처 반경 링을, 위에 [처리] 알약을 그린다.
   * 위치는 런타임 프레임 콜백에서 투영해 DOM 에 직접 쓴다(React 상태를 프레임마다 바꾸지 않는다). 좌석·역할은 이 층에 들어오지 않는다
   */
  errand?: ErrandLayerProps;
  onNotice(text: string): void;
  /** 있을 때만 연결이 끊긴 사람의 이름표가 [내보내기] 버튼이 된다(대기실 전용 — 게임 중 서버는 CANNOT_KICK) */
  onKick?(seat: number, nickname: string): void;
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
  // 방의 맵 id(MAP-06, D-22): 로비·시작 전(view.map 없음)은 bar. 렌더러는 생성 때 한 번 장면을 고르므로 맵이 바뀌면 런타임을 새로 만든다(아래 효과의 의존)
  const mapId: MapId = view.map ?? "bar";
  const reduced = useReducedMotion();
  const live = useRef({ props, reduced });
  useLayoutEffect(() => {
    live.current = { props, reduced };
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const errandRef = useRef<HTMLDivElement>(null);
  const errandActRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<WorldRuntime | null>(null);
  const [tracker] = useState(createTapTracker);
  const [errandCache] = useState<{ current: ErrandWriteCache | null }>(() => ({ current: null }));
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

  // 런타임은 마운트 한 번에 하나다(맵 id 가 바뀔 때만 새로 만든다). 바뀌는 prop 은 live ref 로 읽는다(재시작 없이 최신 값).
  useEffect(() => {
    const host = hostRef.current;
    const tagLayer = tagRef.current;
    if (host === null || tagLayer === null) return;
    // 테스트 훅은 ?e2e=1(세션 저장) 또는 개발 빌드에서만 — 같은 조건에서 소프트웨어 렌더러도 허용한다(E2E 헤드리스, RESEARCH A13)
    const hooksOn = worldTestHooksEnabled(window.location.search, sessionStore(), import.meta.env.DEV);
    // window.__mfGhosts(유령 그림으로 그리는 좌석·그림 준비 여부, 0083-2): 같은 훅 문맥에서만. 좌석 번호뿐이고 DOM 속성이 아니다(L13)
    const ghostsHook = hooksOn ? installGhostsHook() : null;
    // window.__mfPin(핀 조명 대상·이동 중 여부, 09.1.1-11): 같은 훅 문맥에서만. DOM 이 아니다
    const pinHook = hooksOn ? installPinHook() : null;
    // window.__mfEmotes(받은 동작 프레임·재생 중 좌석, 10-03, L33): 같은 훅 문맥에서만. DOM 이 아니다
    const emotesHook = hooksOn ? installEmotesHook() : null;
    // window.__mfLooks(좌석별 고른 의상, 10-04, L33): 같은 훅 문맥에서만. DOM 이 아니다
    const looksHook = hooksOn ? installLooksHook() : null;
    // window.__mfMap(이 렌더러에 올린 맵 id, 11-13, L33): 같은 훅 문맥에서만. DOM 이 아니다
    const mapHook = hooksOn ? installMapHook(mapId) : null;
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
      onGhosts: ghostsHook?.set,
      onPin: pinHook?.set,
      onEmotes: emotesHook?.set,
      onLooks: looksHook?.set,
      onCostumes: (costumes, dimmed) => live.current.props.onCostumes?.(costumes, dimmed),
      onZoom: pinHook?.setZoom,
      onProject: (project, now) => {
        const { props: p } = live.current;
        const layer = errandRef.current;
        if (layer === null || p.errand === undefined) return;
        const mine = p.store.positionOf(p.view.me.seat, now + p.offset);
        const ins = p.stageInsets;
        writeErrandLayer(layer, errandActRef.current, host, p.errand, project, mine, { top: ins?.top ?? HEADER_BOTTOM, bottom: ins?.bottom ?? PANEL_HEIGHT }, errandCache, now);
      },
      allowSoftware: hooksOn,
      loadModules: live.current.props.loadModules,
      mapId: () => mapId,
    });
    runtimeRef.current = runtime;
    runtime.setScene(live.current.props.scene ?? null);
    const offHooks = hooksOn ? installWorldTestHooks(runtime, live.current.props.store) : null;
    void runtime.start();
    return () => {
      offHooks?.();
      ghostsHook?.off();
      pinHook?.off();
      emotesHook?.off();
      looksHook?.off();
      mapHook?.off();
      runtime.dispose();
      if (runtimeRef.current === runtime) runtimeRef.current = null;
    };
  }, [mapId]);

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

  // 단계(판:일차:단계)가 바뀌면 재생 중인 동작을 모두 끝낸다 — 밤 → 아침으로 동작이 이어져 보이지 않게(T-10-10). 처음 마운트에서는 부르지 않는다
  const phaseKeySeen = useRef<string | null>(null);
  const currentPhaseKey = phaseKey({ phase: view.phase, day: view.day?.n, round: view.round });
  useLayoutEffect(() => {
    if (phaseKeySeen.current !== null && phaseKeySeen.current !== currentPhaseKey) runtimeRef.current?.stopAllEmotes();
    phaseKeySeen.current = currentPhaseKey;
  }, [currentPhaseKey]);

  // 손사래: 처음 마운트 때의 값은 지난 일이라 하지 않는다(재접속·화면 전환에서 되살리지 않는다)
  const denySeen = useRef(props.deny?.nonce);
  useLayoutEffect(() => {
    const d = props.deny;
    if (d === undefined || d.nonce === denySeen.current) return;
    denySeen.current = d.nonce;
    runtimeRef.current?.deny(d.seat);
  }, [props.deny]);

  // 놀란 표정: deny 와 같은 규칙(처음 마운트 때의 값은 지난 일이다)
  const surpriseSeen = useRef(props.surprise?.nonce);
  useLayoutEffect(() => {
    const d = props.surprise;
    if (d === undefined || d.nonce === surpriseSeen.current) return;
    surpriseSeen.current = d.nonce;
    runtimeRef.current?.surprise(d.seat);
  }, [props.surprise]);

  // 화면 연출 동작 큐: 새로 보이는 (좌석, nonce) 마다 한 번. 처음 마운트 때의 값은 이미 본 것으로 친다
  const cuesSeen = useRef(new Set((props.emoteCues ?? []).map((c) => `${c.seat}:${c.nonce}`)));
  useLayoutEffect(() => {
    for (const c of props.emoteCues ?? []) {
      const key = `${c.seat}:${c.nonce}`;
      if (cuesSeen.current.has(key)) continue;
      cuesSeen.current.add(key);
      runtimeRef.current?.emote(c.seat, c.id);
    }
  }, [props.emoteCues]);

  // 목적지 하나(탭·표지 공통): 정수 두 개만 보낸다. 내 캐릭터는 같은 길로 바로 걷고 서버 구간이 오면 맞춘다(결정 0059).
  const sendWalk = (at: { x: number; z: number }): void => {
    const { props: p } = live.current;
    const runtime = runtimeRef.current;
    if (runtime === null) return;
    const clamp = (v: number): number => Math.max(-MOVE_COORD_LIMIT, Math.min(MOVE_COORD_LIMIT, Math.round(v * 100)));
    const dest = { x: clamp(at.x), z: clamp(at.z) };
    const sent = p.send({ t: "move", x: dest.x, z: dest.z });
    if (sent === false) runtime.cancelMove();
    else runtime.notifyMoveSent(Date.now() + p.offset, dest);
  };

  // 탭 하나: 링을 바로 띄우고 목적지 정수 두 개만 보낸다.
  const onTap = (clientX: number, clientY: number): void => {
    const { props: p } = live.current;
    const runtime = runtimeRef.current;
    p.onStageTap?.();
    if (p.canWalk === false || runtime === null || !p.canSend || p.exiting) return;
    const at = runtime.tap(clientX, clientY);
    if (at === null) return;
    sendWalk(at);
  };

  // 심부름 표지: 그 장소 중심으로 걷는다(바닥 탭과 같은 경로 — 서버로 가는 메시지는 move 하나뿐). 처리는 [처리] 로만 한다
  const onErrandPin = (id: PlaceId): void => {
    const { props: p } = live.current;
    const runtime = runtimeRef.current;
    const errand = p.errand;
    const pl = errand?.places.find((x) => x.id === id);
    if (errand === undefined || pl === undefined) return;
    errand.onWalk?.(id);
    if (p.canWalk === false || runtime === null || !p.canSend || p.exiting) return;
    const at = runtime.walkTo(pl.x, pl.z);
    if (at === null) return;
    sendWalk(at);
  };

  const mySeat = view.me.seat;
  const here = new Set(view.players.map((p) => p.seat));
  const scene = props.scene;
  const shown = (seat: number): boolean => scene === undefined || scene.seats[seat]?.show === true;
  // 보이지 않는 좌석은 이름표도 만들지 않는다(T-08-30)
  const roster = [...view.players, ...leaving.filter((p) => !here.has(p.seat))].filter((p) => shown(p.seat));
  const canKick = view.me.isHost && props.canSend && props.onKick !== undefined;
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
      {props.underlay}
      {props.errand ? (
        <div ref={errandRef} className="mf-world__errand" data-errand-layer="">
          <svg className="mf-world__ring" data-near-ring={String(props.errand.nearR)} aria-hidden="true" focusable="false" style={RING_HIDDEN}>
            <polygon points="" />
          </svg>
          {props.errand.places.map((pl) => (
            <ErrandMarker key={pl.id} id={pl.id} done={pl.done} call={false} hidden onWalk={() => onErrandPin(pl.id)} />
          ))}
          <ErrandArrow angle={0} call={false} hidden />
        </div>
      ) : null}
      {/* [처리] 알약은 타일·화살표 층보다 위(z-tags + 1)라 층을 따로 둔다. 처리 반경 안 미처리 장소가 있을 때만 DOM 에 있다 */}
      {props.errand ? (
        <div ref={errandActRef} className="mf-world__errand-act" data-errand-act-layer="">
          {props.errand.actId !== null ? <ErrandAct id={props.errand.actId} call={false} hidden onPress={() => live.current.props.errand?.onAct?.()} /> : null}
        </div>
      ) : null}
      <div
        ref={tagRef}
        className="mf-world__tags"
        data-chalk={scene?.chalk === undefined ? undefined : `${scene.chalk.x.toFixed(2)},${scene.chalk.z.toFixed(2)}`}
        role={pick ? "group" : undefined}
        aria-label={pick?.group}
      >
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
          const { ring, turn, ...extra } = props.tagProps?.(p.seat) ?? {};
          // 죽은 자리 표식(유령 시점에서만): GameMap roleTagProps 가 spectate 가 있을 때만 tagProps.ghost 를 준다.
          // 산 사람 화면의 유령(장면 표 ghost)은 HeadStack is-ghost 만 — 표식·직업 칩은 없다(18.1 C-2·C-5)
          const ghostSeat = extra.ghost === true;
          // 산 사람 화면에서 유령의 입력 중 신호는 그리지 않는다(유령 채널은 산 사람에게 보이지 않는다, T-08-44)
          const hideTyping = scene?.seats[p.seat]?.ghost === true && !ghostSeat;
          const stack = (
            <HeadStack
              name={p.nickname}
              color={seatColor(p.seat)}
              me={me}
              away={away}
              typing={!hideTyping && props.typingSeats?.has(p.seat) === true}
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
              data-ghost-seat={ghostSeat ? "true" : undefined}
              data-lead={extra.lead ? "true" : undefined}
              // 지목에서 지금 차례인 사람: 런타임이 이름표를 겹침 맨 앞으로 올린다(HeadStack 으로는 넘기지 않는다)
              data-turn={turn ? "true" : undefined}
              data-ring-kind={ring === undefined ? undefined : ringKindAttr(ring)}
              aria-hidden={kickable || pickable ? undefined : true}
              style={TAG_INITIAL_STYLE}
            >
              {pickable ? (
                <button
                  type="button"
                  className="mf-world__pick"
                  data-pick={p.seat}
                  data-call={extra.call ? "" : undefined}
                  aria-label={pick.label(p.nickname)}
                  aria-pressed={pick.mine === p.seat}
                  aria-disabled={props.canSend && pick.disabled !== true ? undefined : true}
                  // 버튼을 눌러도 채팅 입력칸의 포커스(키보드)를 뺏지 않는다
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const pickNow = live.current.props.pick;
                    if (live.current.props.canSend && pickNow?.disabled !== true) pickNow?.onPick(p.seat);
                  }}
                >
                  {stack}
                </button>
              ) : kickable ? (
                <button type="button" className="mf-world__kick" aria-label={`${p.nickname} 님 내보내기`} onClick={() => live.current.props.onKick?.(p.seat, p.nickname)}>
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
