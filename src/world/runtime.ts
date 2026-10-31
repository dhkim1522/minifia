// 로비 맵 런타임: rAF 한 루프가 서버 시각의 위치로 모든 캐릭터를 놓고, 카메라가 내 캐릭터를 따라가고, 렌더하고, 이름표를 투영한다.
// 위치의 진실은 서버 구간이다 — 이 파일에 예측 이동은 없다(결정 0044-17). 탭은 목적지 링만 먼저 띄운다.
//
// three 는 loadWorld() 의 import() 두 줄로만 끌려온다(이 파일에 three 값 import 가 없다 — 메인 번들 분리, RESEARCH 번들 측정).
// 렌더러·캐릭터 모듈은 deps.loadModules 로 바꿔 끼울 수 있다(happy-dom 테스트의 가짜, 06-14 의 시나리오 스토어).
import { FIGS } from "./characterData";
import { clampTarget, DEFAULT_TARGET, followStep, RESIZE_SETTLE_MS, stageOffsetY } from "./camera";
import { createTapGate } from "./input";
import { DEFAULT_BUDGET_STEP } from "./renderer";
import type { CharacterHandle, WorldRenderer } from "./renderer";
import { initialMapStatus, mapStatusReducer, inputBlocked } from "./status";
import type { MapStatusEvent, MapStatusState } from "./status";
import type { WorldStore } from "./store";
import type { characterKit as CharacterKitType } from "./character";
import type { createThreeRenderer as CreateThreeRendererType } from "./threeRenderer";
import { BAR_SPAWNS } from "../../shared/game/map";

export interface WorldModules {
  createThreeRenderer: typeof CreateThreeRendererType;
  characterKit: typeof CharacterKitType;
}

let modulesPromise: Promise<WorldModules> | null = null;

/**
 * 월드 모듈(렌더러 + 캐릭터)을 받는다. 이 두 import() 가 three 를 끌어오는 유일한 경로다.
 * 실패한 약속은 캐시하지 않는다 — [다시 시도]가 새로 받게 한다.
 */
export function loadWorld(): Promise<WorldModules> {
  if (modulesPromise === null) {
    const p = Promise.all([import("./threeRenderer"), import("./character")]).then(
      ([renderer, character]): WorldModules => ({ createThreeRenderer: renderer.createThreeRenderer, characterKit: character.characterKit }),
    );
    modulesPromise = p;
    p.catch(() => {
      if (modulesPromise === p) modulesPromise = null;
    });
  }
  return modulesPromise;
}

/** 방 입장 화면에서 미리 받아 둔다(06-15 가 부른다). 실패는 삼킨다 — 맵을 열 때 loadWorld 가 다시 시도한다. */
export function preloadWorld(): void {
  loadWorld().catch(() => {});
}

export const WALK_CUE_KEY = "mf-hint-walk";
/** 새 사람 등장 연출 길이(ms) = dur-med */
export const ENTER_MS = 420;
/** 나간 사람 퇴장 연출 길이(ms) = dur-fast */
export const EXIT_MS = 180;
/** 탭 뒤 이 시간 안에 내 서버 구간이 없으면 응답 없음 */
export const MOVE_ACK_TIMEOUT_MS = 1500;

/** 링 맥박 주기(ms) = dur-pulse */
const PULSE_MS = 1100;
/** 맥박 최대 배율 */
const PULSE_MAX = 1.15;
/** 크기 변화를 다시 재기 전 기다리는 시간(ms) */
const RESIZE_DEBOUNCE_MS = 150;
/** 한 프레임 dt 상한(초) — 탭이 숨었다 돌아와도 걸음 계산이 튀지 않게 */
const MAX_DT = 0.05;
/** 이동으로 보는 한 프레임 위치 변화(월드 단위) */
const MOVE_EPS = 1e-6;
/** 6페이즈는 모두 기본 코트(의상 교체는 10페이즈) */
const OUTFIT = "coat";

export interface WorldRuntimeDeps {
  host: HTMLElement;
  tagLayer: HTMLElement;
  store: WorldStore;
  serverNow(): number;
  mySeat(): number;
  players(): readonly { seat: number; nickname: string; connected: boolean }[];
  reducedMotion(): boolean;
  /** 스테이지 사각형의 위·아래 끝(px, 캔버스 위 끝 기준) */
  stageRect(): { top: number; bottom: number };
  onStatus(s: MapStatusState): void;
  onNotice(text: string): void;
  allowSoftware: boolean;
  budgetStep?: number;
  lighting?: "talk" | "vote";
  loadModules?: () => Promise<WorldModules>;
  raf?: (cb: FrameRequestCallback) => number;
  caf?: (id: number) => void;
  storage?: Storage | null;
}

export interface WorldRuntime {
  start(): Promise<void>;
  syncPlayers(): void;
  /** 화면 좌표의 탭. 받아들이면 바닥 교점(월드 단위)을 돌려주고 목적지 링을 바로 띄운다 */
  tap(clientX: number, clientY: number): { x: number; z: number } | null;
  /** move 를 보낸 직후 부른다(응답 없음 시계의 시작) */
  notifyMoveSent(at: number): void;
  retry(): Promise<void>;
  dispose(): void;
  /** 서버 시각 t(기본: 지금)의 seat 위치 */
  sample(seat: number, t?: number): { x: number; z: number } | null;
  renderer(): WorldRenderer | null;
}

/** 06-11 figForSeat 와 같은 식(character.ts 는 three 를 끌고 와서 정적으로 가져오지 않는다) */
function figIndexForSeat(seat: number): number {
  return ((seat % FIGS.length) + FIGS.length) % FIGS.length;
}

/** 입장 지점의 방향. 없는 곳은 카메라 쪽(π/4) */
function spawnYaw(seat: number): number {
  const n = BAR_SPAWNS.length;
  return BAR_SPAWNS[((seat % n) + n) % n]?.yaw ?? Math.PI / 4;
}

interface Actor {
  seat: number;
  handle: CharacterHandle;
  base: number;
  pos: { x: number; z: number };
  yaw: number;
  headY: number;
}

export function createWorldRuntime(deps: WorldRuntimeDeps): WorldRuntime {
  const { host, store } = deps;
  const raf = deps.raf ?? ((cb: FrameRequestCallback) => requestAnimationFrame(cb));
  const caf = deps.caf ?? ((id: number) => cancelAnimationFrame(id));

  let disposed = false;
  let bootGen = 0;
  let renderer: WorldRenderer | null = null;
  let kit: WorldModules["characterKit"] | null = null;
  let rafId: number | null = null;
  let status: MapStatusState = initialMapStatus;

  const actors = new Map<number, Actor>();
  const gate = createTapGate();
  let ring: { at: { x: number; z: number } } | null = null;

  let lastFrameAt = 0;
  let cam: { x: number; z: number } | null = null;
  let lastEpoch = store.currentEpoch();
  let resync = true;
  let offsetCur: number | null = null;
  let offsetTarget = 0;
  let offsetFrom = 0;
  let offsetStart = 0;
  let appliedSize = { w: 0, h: 0 };
  let seenSize = { w: 0, h: 0 };
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;

  function size(): { w: number; h: number } {
    const w = host.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 0) || 1;
    const h = host.clientHeight || (typeof window !== "undefined" ? window.innerHeight : 0) || 1;
    return { w, h };
  }

  // ---------- 상태기계 ----------

  function dispatch(e: MapStatusEvent): void {
    const prev = status;
    const next = mapStatusReducer(prev, e);
    if (next === prev) return;
    status = next;
    deps.onStatus(next);
    if (prev.status !== "ready" && next.status === "ready") markInteractive();
  }

  function markInteractive(): void {
    try {
      performance.mark("map-interactive");
    } catch {
      // performance.mark 가 없는 환경: 표식만 없다
    }
  }

  // ---------- 불러오기 ----------

  async function boot(): Promise<void> {
    const gen = ++bootGen;
    const alive = (): boolean => !disposed && gen === bootGen;
    let mods: WorldModules;
    try {
      mods = await (deps.loadModules ?? loadWorld)();
    } catch {
      if (alive()) dispatch({ t: "loadError" });
      return;
    }
    if (!alive()) return;
    const s = size();
    let r: WorldRenderer;
    try {
      r = await mods.createThreeRenderer({ host, width: s.w, height: s.h, budgetStep: deps.budgetStep ?? DEFAULT_BUDGET_STEP, allowSoftware: deps.allowSoftware });
    } catch {
      if (alive()) dispatch({ t: "unsupported" });
      return;
    }
    if (!alive()) {
      r.dispose();
      return;
    }
    renderer = r;
    kit = mods.characterKit;
    appliedSize = s;
    seenSize = s;
    r.setLighting(deps.lighting ?? "talk");
    lastFrameAt = Date.now();
    schedule();
  }

  // ---------- 프레임 ----------

  function schedule(): void {
    if (disposed || rafId !== null || renderer === null) return;
    rafId = raf(frame);
  }

  function pulse(now: number): number {
    if (deps.reducedMotion()) return 1;
    return 1 + (PULSE_MAX - 1) * Math.sin(Math.PI * ((now % PULSE_MS) / PULSE_MS));
  }

  function createActor(seat: number): Actor | null {
    if (renderer === null || kit === null) return null;
    const handle = kit.create(figIndexForSeat(seat), OUTFIT);
    const at = store.positionOf(seat, deps.serverNow());
    const a: Actor = { seat, handle, base: handle.root.scale.x, pos: at ?? { x: 0, z: 0 }, yaw: spawnYaw(seat), headY: 0 };
    handle.setYaw(a.yaw);
    handle.root.position.set(a.pos.x, 0, a.pos.z);
    renderer.addCharacter(seat, handle);
    actors.set(seat, a);
    return a;
  }

  function frame(): void {
    rafId = null;
    const r = renderer;
    if (disposed || r === null) return;
    const now = Date.now();
    const dt = Math.min(Math.max((now - lastFrameAt) / 1000, 0), MAX_DT);
    lastFrameAt = now;
    const sNow = deps.serverNow();
    const reduced = deps.reducedMotion();

    // 새 연결의 첫 프레임: 날아가지 않고 서버 위치에 바로 붙는다
    const epoch = store.currentEpoch();
    if (epoch !== lastEpoch) {
      lastEpoch = epoch;
      resync = true;
    }

    for (const seat of store.seats()) {
      if (!actors.has(seat)) createActor(seat);
    }

    for (const a of actors.values()) {
      const at = store.positionOf(a.seat, sNow) ?? a.pos;
      const dx = at.x - a.pos.x;
      const dz = at.z - a.pos.z;
      let moving = false;
      if (!resync && dx * dx + dz * dz > MOVE_EPS * MOVE_EPS) {
        moving = true;
        a.yaw = Math.atan2(dx, dz);
        a.handle.setYaw(a.yaw);
      }
      a.pos = { x: at.x, z: at.z };
      a.handle.root.position.set(at.x, 0, at.z);
      a.headY = a.handle.update(dt, now / 1000, moving).headY;
    }

    // 카메라: 내 캐릭터를 따라간다(한계 상자 안에서)
    const mine = actors.get(deps.mySeat());
    const goal = clampTarget(mine ? mine.pos : DEFAULT_TARGET);
    cam = cam === null || resync ? goal : followStep(cam, goal, dt * 1000, reduced);

    // 스테이지 사각형이 바뀌면(패널 높이·헤더) 장면을 dur-fast 에 걸쳐 옮긴다
    const s = size();
    const rect = deps.stageRect();
    const target = stageOffsetY(s.h, rect.top, rect.bottom);
    if (offsetCur === null || resync || reduced) {
      offsetCur = target;
      offsetTarget = target;
    } else {
      if (target !== offsetTarget) {
        offsetFrom = offsetCur;
        offsetTarget = target;
        offsetStart = now;
      }
      const p = Math.min(1, (now - offsetStart) / RESIZE_SETTLE_MS);
      offsetCur = offsetFrom + (offsetTarget - offsetFrom) * p;
    }
    r.setView(cam, offsetCur);

    if (s.w !== seenSize.w || s.h !== seenSize.h) {
      seenSize = s;
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        if (disposed || renderer === null) return;
        appliedSize = seenSize;
        renderer.resize(appliedSize.w, appliedSize.h);
      }, RESIZE_DEBOUNCE_MS);
    }

    if (ring !== null) r.setMarker("ring", ring.at, pulse(now), 1);

    r.render();
    resync = false;

    if (status.status === "loading" && store.isReady()) dispatch({ t: "ready" });

    schedule();
  }

  // ---------- 입력 ----------

  function tap(clientX: number, clientY: number): { x: number; z: number } | null {
    if (disposed || renderer === null || inputBlocked(status)) return null;
    if (!gate.accept(Date.now())) return null;
    const rect = host.getBoundingClientRect();
    const at = renderer.groundAt(clientX - rect.left, clientY - rect.top);
    ring = { at: { x: at.x, z: at.z } };
    renderer.setMarker("ring", ring.at, 1, 1);
    return { x: at.x, z: at.z };
  }

  return {
    async start() {
      await boot();
    },
    syncPlayers() {},
    tap,
    notifyMoveSent() {},
    async retry() {
      dispatch({ t: "retry" });
      await boot();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      bootGen++;
      if (rafId !== null) caf(rafId);
      rafId = null;
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      const r = renderer;
      renderer = null;
      for (const a of actors.values()) {
        r?.removeCharacter(a.seat);
        a.handle.dispose();
      }
      actors.clear();
      r?.dispose();
    },
    sample(seat, t) {
      return store.positionOf(seat, t ?? deps.serverNow());
    },
    renderer() {
      return renderer;
    },
  };
}
