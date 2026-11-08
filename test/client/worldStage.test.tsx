import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { Object3D } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage, MemoryStorage } from "../helpers/memoryStorage";
import { BAR_MAP, snapToWalkable } from "../../shared/game/map";
import { PLAZA_MAP } from "../../shared/game/mapPlaza";
import { positionAt, segmentEndsAt } from "../../shared/game/world";
import type { Segment } from "../../shared/game/world";
import type { OutfitId, PublicPlayer, RoomView, WorldSeg } from "../../shared/protocol";
import { WorldStage } from "../../src/components/WorldStage";
import { NETWORK_TEXT } from "../../src/net/copy";
import type { WorldStageProps } from "../../src/components/WorldStage";
import { UnsupportedRendererError } from "../../src/world/renderer";
import type { CharacterHandle, LightingPhase, RendererStatusEvent, WorldRenderer } from "../../src/world/renderer";
import { gatherView, PAN_BOX, stageOffsetY, ZOOM_MAJORITY } from "../../src/world/camera";
import { predictSegment, SEG_BLEND_MS, YAW_TURN_RATE } from "../../src/world/motion";
import { GHOST_FADE_END_MS } from "../../src/game/dayView";
import { createWorldRuntime, ENTER_MS, EXIT_MS, MOVE_ACK_TIMEOUT_MS, RING_COLORS, WALK_CUE_KEY } from "../../src/world/runtime";
import type { WorldModules } from "../../src/world/runtime";
import { installWorldTestHooks, WORLD_TEST_KEY, worldTestHooksEnabled } from "../../src/world/testHooks";
import { WorldStore } from "../../src/world/store";
import { cameraModeOf } from "../../src/world/presence";
import type { SceneLook, SeatLook } from "../../src/world/presence";

// 06-13: 로비 맵 화면(WorldStage + 런타임). happy-dom 에는 WebGL 이 없어 loadModules 로 가짜 렌더러·가짜 캐릭터를 주입한다(가정 A1).
// 실제 GL 경로는 06-14(성능 스파이크)·06-17·06-18(E2E)이 브라우저에서 확인한다.
// 시간: setTimeout·Date 만 가짜로 하고 rAF 는 이 파일이 직접 쥔다(frame()) — 프레임 사이 시간을 테스트가 정한다.

// ---------- 가짜 렌더러·캐릭터 도우미 ----------

export interface FakeRenderer extends WorldRenderer {
  chars: Map<number, CharacterHandle>;
  views: { target: { x: number; z: number }; offsetY: number }[];
  markers: { kind: string; at: { x: number; z: number } | null; scale: number; opacity: number }[];
  setLighting: Mock<(phase: LightingPhase) => void>;
  setZoom: Mock<(zoom: number) => void>;
  setTension: Mock<(level: 0 | 1 | 2, focus?: { x: number; z: number }) => void>;
  setPin: Mock<(pin: { x: number; z: number; strength: number } | null, dim: number) => void>;
  setChalk: Mock<(at: { x: number; z: number } | null, opacity: number) => void>;
  setSelfLight: Mock<(at: { x: number; z: number } | null) => void>;
  emit(e: RendererStatusEvent): void;
  lost: boolean;
  renders: number;
  disposed: number;
}

export function makeFakeRenderer(): FakeRenderer {
  const cbs = new Set<(e: RendererStatusEvent) => void>();
  const emit = (e: RendererStatusEvent): void => {
    for (const cb of [...cbs]) cb(e);
  };
  const r = {
    canvas: document.createElement("canvas"),
    chars: new Map<number, CharacterHandle>(),
    views: [] as FakeRenderer["views"],
    markers: [] as FakeRenderer["markers"],
    lost: false,
    renders: 0,
    disposed: 0,
    emit,
    resize: vi.fn(),
    setView(target: { x: number; z: number }, offsetY: number) {
      r.views.push({ target: { ...target }, offsetY });
    },
    setLighting: vi.fn(),
    setZoom: vi.fn(),
    setTension: vi.fn(),
    setPin: vi.fn(),
    setChalk: vi.fn(),
    setSelfLight: vi.fn(),
    addCharacter(seat: number, c: CharacterHandle) {
      r.chars.set(seat, c);
    },
    removeCharacter(seat: number) {
      r.chars.delete(seat);
    },
    setMarker(kind: string, at: { x: number; z: number } | null, scale: number, opacity: number) {
      r.markers.push({ kind, at: at ? { ...at } : null, scale, opacity });
    },
    // 발끝(y=0)은 sy = 300 + 10z, 머리(y)는 그만큼 위. 탭 역변환은 groundAt.
    project: (p: { x: number; y: number; z: number }) => ({ sx: 200 + p.x * 10, sy: 300 + p.z * 10 - p.y * 10 }),
    groundAt: vi.fn((sx: number, sy: number) => ({ x: (sx - 200) / 10, z: (sy - 300) / 10 })),
    render() {
      r.renders++;
    },
    setBudget: vi.fn(),
    onStatus(cb: (e: RendererStatusEvent) => void) {
      cbs.add(cb);
      return () => cbs.delete(cb);
    },
    recreate: vi.fn(async () => {
      r.lost = false;
      emit({ t: "recreated" });
    }),
    isContextLost: () => r.lost,
    info: vi.fn(() => ({ calls: 7, triangles: 1, geometries: 2, textures: 3, programs: 4, pointLights: 5 })),
    debugLoseContext: vi.fn(),
    debugRestoreContext: vi.fn(),
    dispose() {
      r.disposed++;
    },
  };
  return r as unknown as FakeRenderer;
}

export interface FakeHandle extends CharacterHandle {
  playEmote?: (id: string) => void;
  stopEmote?: () => void;
  prewarm?: (face?: string) => void;
  setFace?: (id: string) => void;
  /** kit.create 가 받은 의상 id (10-04) */
  outfit?: string;
  yaws: number[];
  dims: boolean[];
  moving: boolean[];
  disposed: number;
}

export function makeFakeKit(created: FakeHandle[]): WorldModules["characterKit"] {
  return {
    create(_fig?: number, outfit?: string): CharacterHandle {
      const root = new Object3D();
      root.scale.setScalar(0.83); // 진짜 캐릭터도 root.scale = CHAR_SCALE
      const h: FakeHandle = {
        root,
        outfit,
        yaws: [],
        dims: [],
        moving: [],
        disposed: 0,
        update: vi.fn((_dt: number, _t: number, moving: boolean) => {
          h.moving.push(moving);
          return { headY: 1.8 };
        }),
        setYaw: vi.fn((y: number) => {
          h.yaws.push(y);
        }),
        setDim: vi.fn((on: boolean) => {
          h.dims.push(on);
        }),
        dispose: vi.fn(() => {
          h.disposed++;
        }),
        // 08-10 의 optional 메서드(게임 장면 시험이 호출을 본다)
        setGhost: vi.fn(),
        applyOutfit: vi.fn(),
        setOpacity: vi.fn(),
        holdPose: vi.fn(),
        setRing: vi.fn(),
        setPickMark: vi.fn(),
        playEmote: vi.fn(),
        stopEmote: vi.fn(),
        prewarm: vi.fn(),
        setFace: vi.fn(),
      };
      created.push(h);
      return h;
    },
  } as unknown as WorldModules["characterKit"];
}

interface World {
  renderers: FakeRenderer[];
  handles: FakeHandle[];
  modules: WorldModules;
  loadModules: () => Promise<WorldModules>;
  createThreeRenderer: ReturnType<typeof vi.fn>;
}

export function makeWorld(): World {
  const renderers: FakeRenderer[] = [];
  const handles: FakeHandle[] = [];
  const createThreeRenderer = vi.fn(async () => {
    const r = makeFakeRenderer();
    renderers.push(r);
    return r;
  });
  const modules = { createThreeRenderer, characterKit: makeFakeKit(handles) } as unknown as WorldModules;
  return { renderers, handles, modules, loadModules: () => Promise.resolve(modules), createThreeRenderer };
}

// ---------- 시간·프레임 ----------

let rafCbs = new Map<number, FrameRequestCallback>();
let rafSeq = 0;

function installRaf(): void {
  rafCbs = new Map();
  rafSeq = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafSeq++;
    rafCbs.set(rafSeq, cb);
    return rafSeq;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    rafCbs.delete(id);
  });
}

/** 시간을 ms 만큼 보낸 뒤 대기 중인 rAF 콜백을 한 번 돌린다 */
function frame(ms = 16): void {
  act(() => {
    vi.advanceTimersByTime(ms);
    const cbs = [...rafCbs.values()];
    rafCbs.clear();
    for (const cb of cbs) cb(Date.now());
  });
}

/** 여러 프레임. 총 ms 를 step 간격으로 쪼갠다 */
function frames(totalMs: number, step = 16): void {
  for (let t = 0; t < totalMs; t += step) frame(Math.min(step, totalMs - t));
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
}

// ---------- 방 상태 ----------

const player = (seat: number, nickname: string, extra: Partial<PublicPlayer> = {}): PublicPlayer => ({
  seat,
  nickname,
  connected: true,
  isHost: seat === 0,
  ...extra,
});

const makeView = (players: PublicPlayer[], mySeat = 0): RoomView => ({
  code: "0042",
  phase: "lobby",
  phaseEndsAt: null,
  phaseDurationMs: null,
  serverNow: 0,
  minPlayers: 4,
  maxPlayers: 8,
  players,
  me: { seat: mySeat, isHost: players.find((p) => p.seat === mySeat)?.isHost ?? false },
});

const seg = (s: number, p: number[], t0 = Date.now(), v = 180): WorldSeg => ({ s, p, t0, v });

function snap(store: WorldStore, ents: WorldSeg[], epoch = 1): void {
  store.applyFrame({ t: "world", k: "snap", at: Date.now(), ents }, epoch);
}

function move(store: WorldStore, s: WorldSeg, epoch = 1): void {
  store.applyFrame({ t: "world", k: "move", s: s.s, p: s.p, t0: s.t0, v: s.v }, epoch);
}

interface Setup {
  world: World;
  store: WorldStore;
  props: WorldStageProps;
  send: ReturnType<typeof vi.fn>;
  utils: ReturnType<typeof render>;
  rerender(over: Partial<WorldStageProps>): void;
}

const TWO = [player(0, "민지"), player(1, "철수")];

async function open(over: Partial<WorldStageProps> = {}, opts: { strict?: boolean; ents?: WorldSeg[] | null; players?: PublicPlayer[]; mySeat?: number } = {}): Promise<Setup> {
  const world = makeWorld();
  const store = new WorldStore();
  const send = vi.fn(() => true);
  const players = opts.players ?? TWO;
  const props: WorldStageProps = {
    view: makeView(players, opts.mySeat ?? 0),
    store,
    send,
    canSend: true,
    offset: 0,
    onNotice: vi.fn(),
    onKick: vi.fn(),
    onLeave: vi.fn(),
    loadModules: world.loadModules,
    ...over,
  };
  if (opts.ents !== null) snap(store, opts.ents ?? [seg(0, [200, 100]), seg(1, [-300, 50])]);
  const wrap = (p: WorldStageProps) => (opts.strict ? <StrictMode><WorldStage {...p} /></StrictMode> : <WorldStage {...p} />);
  const utils = render(wrap(props));
  await flush();
  frame();
  return {
    world,
    store,
    props,
    send,
    utils,
    rerender(o) {
      Object.assign(props, o);
      utils.rerender(wrap({ ...props }));
    },
  };
}

function surface(utils: ReturnType<typeof render>): HTMLElement {
  const el = utils.container.querySelector(".mf-world__input");
  if (!(el instanceof HTMLElement)) throw new Error("입력 면이 없다");
  return el;
}

function tapAt(el: HTMLElement, x: number, y: number, holdMs = 50, id = 1): void {
  fireEvent.pointerDown(el, { pointerId: id, clientX: x, clientY: y });
  act(() => {
    vi.advanceTimersByTime(holdMs);
  });
  fireEvent.pointerUp(el, { pointerId: id, clientX: x, clientY: y });
}

const realMatchMedia = window.matchMedia;

/** prefers-reduced-motion 을 켠다(렌더 전에 부른다). afterEach 가 되돌린다 */
function stubReducedMotion(on: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: () => ({ matches: on, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(1_000_000);
  installRaf();
  installMemoryStorage();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: realMatchMedia });
});

// ---------- Task 1: 트레이서 ----------

describe("WorldStage: 틀과 접근 가능한 장면 설명 (MAP-01)", () => {
  it("캔버스 호스트에 장면 설명 aria-label 이 있다", async () => {
    const s = await open();
    expect(screen.getByRole("img", { name: "지하 재즈 바 로비. 바닥을 누르면 그쪽으로 걸어가요" })).toBeTruthy();
    expect(s.utils.container.querySelector("[data-world-stage]")).not.toBeNull();
  });

  it("three 는 import() 로만 열리는 주입 모듈로 렌더러 하나와 캐릭터 둘을 만든다", async () => {
    const s = await open();
    expect(s.world.createThreeRenderer).toHaveBeenCalledTimes(1);
    const r = s.world.renderers[0]!;
    expect([...r.chars.keys()].sort()).toEqual([0, 1]);
    expect(r.renders).toBeGreaterThan(0);
  });
});

describe("WorldStage: window.__mfMap 훅 (11-13, L33)", () => {
  it("로비(view.map 없음)는 bar, 켜진 문맥에서만 있고 DOM 속성이 아니다", async () => {
    const s = await open();
    expect(window.__mfMap).toBe("bar");
    expect(s.utils.container.querySelectorAll("[data-map-id], [data-mf-map]")).toHaveLength(0);
    s.utils.unmount();
    expect(window.__mfMap).toBeUndefined();
  });

  it("view.map 이 plaza 면 plaza 이고, 맵이 바뀌어 새 렌더러를 만들면 따라 바뀐다", async () => {
    const s = await open({ view: { ...makeView(TWO, 0), map: "plaza" } });
    expect(window.__mfMap).toBe("plaza");
    s.rerender({ view: { ...makeView(TWO, 0), map: "bar" } });
    await flush();
    expect(window.__mfMap).toBe("bar");
  });

  it("훅이 꺼진 문맥에는 없다", async () => {
    vi.stubEnv("DEV", false);
    await open({ view: { ...makeView(TWO, 0), map: "plaza" } });
    expect(window.__mfMap).toBeUndefined();
  });
});

describe("WorldStage: 방의 맵 id 가 렌더러 장면을 고른다 (MAP-06, D-22)", () => {
  it("view.map 이 plaza 면 렌더러를 mapId plaza 로 만든다", async () => {
    const s = await open({ view: { ...makeView(TWO, 0), map: "plaza" } });
    expect(s.world.createThreeRenderer).toHaveBeenCalledTimes(1);
    expect(s.world.createThreeRenderer).toHaveBeenCalledWith(expect.objectContaining({ mapId: "plaza" }));
  });

  it("로비(view.map 없음)와 bar 는 mapId bar 로 만든다", async () => {
    const lobby = await open();
    expect(lobby.world.createThreeRenderer).toHaveBeenCalledWith(expect.objectContaining({ mapId: "bar" }));
    cleanup();
    const bar = await open({ view: { ...makeView(TWO, 0), map: "bar" } });
    expect(bar.world.createThreeRenderer).toHaveBeenCalledWith(expect.objectContaining({ mapId: "bar" }));
  });

  it("맵 id 가 바뀌면 새 런타임이 새 렌더러를 만든다(한 렌더러에서 맵을 갈아 끼우지 않는다)", async () => {
    const s = await open();
    expect(s.world.createThreeRenderer).toHaveBeenCalledTimes(1);
    s.rerender({ view: { ...makeView(TWO, 0), map: "plaza" } });
    await flush();
    expect(s.world.createThreeRenderer).toHaveBeenCalledTimes(2);
    expect(s.world.createThreeRenderer).toHaveBeenLastCalledWith(expect.objectContaining({ mapId: "plaza" }));
    expect(s.world.renderers[0]!.disposed).toBeGreaterThan(0);
  });
});

describe("WorldStage: 탭 → move (MAP-02)", () => {
  it("바닥을 한 번 누르면 move {x,z} 정수 한 번만 나가고 링이 바로 뜬다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    tapAt(surface(s.utils), 250, 340);
    expect(s.send).toHaveBeenCalledTimes(1);
    // groundAt(250, 340) = (5, 4) → 1/100 정수
    expect(s.send).toHaveBeenCalledWith({ t: "move", x: 500, z: 400 });
    frame(16);
    const ring = r.markers.filter((m) => m.kind === "ring" && m.at !== null).at(-1);
    expect(ring?.at).toEqual({ x: 5, z: 4 });
  });

  it("10px 넘게 끌면 탭이 아니다: 보내지 않고 링도 없다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    const el = surface(s.utils);
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 130, clientY: 100 });
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 130, clientY: 100 });
    frame();
    expect(s.send).not.toHaveBeenCalled();
    expect(r.markers.some((m) => m.kind === "ring" && m.at !== null)).toBe(false);
  });

  it("연결이 끊긴 동안(canSend false)은 보내지 않고 링도 띄우지 않는다", async () => {
    const s = await open({ canSend: false });
    const r = s.world.renderers[0]!;
    tapAt(surface(s.utils), 250, 340);
    frame();
    expect(s.send).not.toHaveBeenCalled();
    expect(r.markers.some((m) => m.kind === "ring" && m.at !== null)).toBe(false);
  });

  it("250ms(서버 150ms + 여유 100ms) 안의 다음 탭은 무시한다", async () => {
    const s = await open();
    const el = surface(s.utils);
    tapAt(el, 250, 340, 10);
    tapAt(el, 260, 350, 10);
    expect(s.send).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(200); // 서버 간격(150ms)은 지났지만 클라이언트 간격(250ms)은 아직
    });
    tapAt(el, 260, 350, 10);
    expect(s.send).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    tapAt(el, 260, 350, 10);
    expect(s.send).toHaveBeenCalledTimes(2);
  });

  it("목적지가 방 밖이어도 보내는 정수는 방 한계 ±700 안이다", async () => {
    const s = await open();
    tapAt(surface(s.utils), 5000, -5000);
    expect(s.send).toHaveBeenCalledWith({ t: "move", x: 700, z: -700 });
  });
});

describe("WorldStage: 입력칸에 포커스가 있을 때의 탭은 키보드만 닫는다 (D4, CHAT-05)", () => {
  const chatInput = (attr = true): HTMLInputElement => {
    const input = document.createElement("input");
    if (attr) input.setAttribute("data-chat-input", "");
    document.body.append(input);
    input.focus();
    return input;
  };
  afterEach(() => {
    for (const el of document.querySelectorAll("body > input")) el.remove();
  });

  it("입력칸 포커스 중 빈 곳을 탭하면 move 를 보내지 않고 입력칸이 blur 된다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    const input = chatInput();
    expect(document.activeElement).toBe(input);
    tapAt(surface(s.utils), 250, 340);
    expect(s.send).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(input);
    frame();
    expect(r.markers.some((m) => m.kind === "ring" && m.at !== null)).toBe(false);
  });

  it("키보드가 닫힌 뒤의 탭부터 평소처럼 걷는다", async () => {
    const s = await open();
    chatInput();
    const el = surface(s.utils);
    tapAt(el, 250, 340);
    expect(s.send).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    tapAt(el, 250, 340);
    expect(s.send).toHaveBeenCalledTimes(1);
    expect(s.send).toHaveBeenCalledWith({ t: "move", x: 500, z: 400 });
  });

  it("채팅 입력칸이 아닌 다른 입력칸에 포커스가 있을 때는 평소처럼 걷는다", async () => {
    const s = await open();
    chatInput(false);
    tapAt(surface(s.utils), 250, 340);
    expect(s.send).toHaveBeenCalledTimes(1);
  });

  it("누르는 순간 입력칸에 포커스가 없었다면(탭 도중에 생긴 포커스는 무관) 걷는다", async () => {
    const s = await open();
    const el = surface(s.utils);
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 250, clientY: 340 });
    chatInput();
    act(() => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 250, clientY: 340 });
    expect(s.send).toHaveBeenCalledTimes(1);
  });

  it("끌기(탭이 아님)는 포커스를 건드리지 않는다", async () => {
    const s = await open();
    const input = chatInput();
    const el = surface(s.utils);
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 140, clientY: 100 });
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 140, clientY: 100 });
    expect(document.activeElement).toBe(input);
    expect(s.send).not.toHaveBeenCalled();
  });
});

describe("WorldStage: 서버 구간대로 걷기와 카메라 (MAP-02, MAP-03)", () => {
  // ---- 결정 0059: 탭하면 바로 걷고, 서버 구간이 오면 튀지 않게 맞추고, 응답이 없으면 돌아간다 ----
  const DEST = { x: 500, z: 400 }; // tapAt(250, 340) 의 바닥 (5, 4) 을 1/100 정수로
  const dist = (a: { x: number; z: number }, b: { x: number; z: number }): number => Math.hypot(a.x - b.x, a.z - b.z);
  const posOf = (h: CharacterHandle): { x: number; z: number } => ({ x: h.root.position.x, z: h.root.position.z });
  const asWorldSeg = (g: Segment, t0 = g.t0): WorldSeg => ({ s: 0, p: g.p, t0, v: g.v });

  it("결정 0059: 탭하면 서버 구간을 기다리지 않고 다음 프레임부터 걷고 서버 위치는 그대로다", async () => {
    const s = await open();
    const mine = s.world.renderers[0]!.chars.get(0)!;
    tapAt(surface(s.utils), 250, 340);
    frame(16);
    expect(dist(posOf(mine), { x: 2, z: 1 })).toBeGreaterThan(0.01);
    const server = s.store.positionOf(0, Date.now())!;
    expect(server.x).toBeCloseTo(2, 6);
    expect(server.z).toBeCloseTo(1, 6);
  });

  it("결정 0059: 예측 중에는 매 프레임 서버와 같은 길(predictSegment)의 위치에 선다", async () => {
    const s = await open();
    const mine = s.world.renderers[0]!.chars.get(0)!;
    const base = s.store.segOf(0);
    tapAt(surface(s.utils), 250, 340);
    const pred = predictSegment(base, DEST, Date.now())!;
    expect(pred).not.toBeNull();
    for (let t = 0; t < 400; t += 16) {
      frame(16);
      const want = positionAt(pred, Date.now());
      expect(Math.abs(mine.root.position.x - want.x)).toBeLessThan(1e-6);
      expect(Math.abs(mine.root.position.z - want.z)).toBeLessThan(1e-6);
    }
  });

  it("결정 0059: 서버 구간이 RTT/2 늦게 와도 한 프레임에 튀지 않고 SEG_BLEND_MS 뒤 서버 위치에 맞는다", async () => {
    const s = await open();
    const mine = s.world.renderers[0]!.chars.get(0)!;
    const base = s.store.segOf(0);
    tapAt(surface(s.utils), 250, 340);
    const sent = Date.now();
    const pred = predictSegment(base, DEST, sent)!;
    frames(96);
    move(s.store, asWorldSeg(pred, sent + 77));
    const injectedAt = Date.now();
    let prev = posOf(mine);
    let maxStep = 0;
    let checked = 0;
    for (let t = 0; t < 300; t += 16) {
      frame(16);
      const cur = posOf(mine);
      maxStep = Math.max(maxStep, dist(cur, prev));
      prev = cur;
      if (Date.now() - injectedAt >= SEG_BLEND_MS + 32) {
        const server = s.store.positionOf(0, Date.now())!;
        expect(Math.abs(cur.x - server.x)).toBeLessThan(1e-6);
        expect(Math.abs(cur.z - server.z)).toBeLessThan(1e-6);
        checked++;
      }
    }
    expect(maxStep).toBeLessThanOrEqual(0.04);
    expect(checked).toBeGreaterThan(0);
    frames(MOVE_ACK_TIMEOUT_MS * 2);
    expect(s.props.onNotice).not.toHaveBeenCalled(); // 응답이 왔으니 응답 없음 시계는 멈췄다
  });

  it("결정 0059: 응답이 없으면 1.5초 뒤 알림 한 번, 링이 사라지고 내 캐릭터는 서버 위치로 150ms 에 걸쳐 돌아간다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    const mine = r.chars.get(0)!;
    tapAt(surface(s.utils), 250, 340);
    frames(MOVE_ACK_TIMEOUT_MS - 20);
    expect(s.props.onNotice).not.toHaveBeenCalled();
    const before = dist(posOf(mine), { x: 2, z: 1 });
    expect(before).toBeGreaterThan(1);
    frame(40); // 이 프레임 안에서 응답 없음 시계가 끝난다
    expect(s.props.onNotice).toHaveBeenCalledTimes(1);
    expect(s.props.onNotice).toHaveBeenCalledWith(NETWORK_TEXT);
    expect(r.markers.filter((m) => m.kind === "ring").at(-1)!.at).toBeNull();
    expect(dist(posOf(mine), { x: 2, z: 1 })).toBeGreaterThanOrEqual(before / 2); // 한 번에 돌아가지 않는다
    frames(SEG_BLEND_MS + 32);
    expect(dist(posOf(mine), { x: 2, z: 1 })).toBeLessThan(1e-6);
    frames(3000);
    expect(s.props.onNotice).toHaveBeenCalledTimes(1);
  });

  it("처음 열 때 카메라는 날아가지 않고 내 캐릭터에 바로 붙는다", async () => {
    const s = await open();
    const first = s.world.renderers[0]!.views[0]!;
    expect(first.target.x).toBeCloseTo(2, 6);
    expect(first.target.z).toBeCloseTo(1, 6);
  });

  it("서버 구간이 오면 캐릭터가 positionOf 위치에 서고 이동 방향을 보며 카메라가 따라간다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    const mine = r.chars.get(0)!;
    move(s.store, seg(0, [200, 100, 600, 100], Date.now(), 180));
    frames(500);
    const pos = s.store.positionOf(0, Date.now())!;
    expect(mine.root.position.x).toBeCloseTo(pos.x, 6);
    expect(mine.root.position.z).toBeCloseTo(pos.z, 6);
    expect(pos.x).toBeGreaterThan(2.5);
    // x 가 늘어나는 걸음: yaw = atan2(dx, dz) = π/2
    const yaw = (mine as FakeHandle).yaws.at(-1)!;
    expect(yaw).toBeCloseTo(Math.PI / 2, 4);
    const last = r.views.at(-1)!;
    expect(last.target.x).toBeGreaterThan(2.2);
    expect(last.target.x).toBeLessThanOrEqual(pos.x + 1e-6);
  });

  it("도착해 멈추면 마지막 방향을 유지한다(멈춘 프레임에 yaw 를 새로 정하지 않는다)", async () => {
    const s = await open();
    const mine = s.world.renderers[0]!.chars.get(0)! as FakeHandle;
    move(s.store, seg(0, [200, 100, 300, 100], Date.now(), 180));
    frames(1200);
    // 입장 방향에서 걷는 방향으로 짧게 돌고(결정 0059-3) 마지막 값은 걷는 방향이다. 멈춘 뒤에는 새로 정하지 않는다
    expect(mine.yaws.length).toBeGreaterThan(1);
    expect(Math.abs(mine.yaws.at(-1)! - Math.PI / 2)).toBeLessThan(1e-4);
    for (let i = 1; i < mine.yaws.length; i++) expect(Math.abs(mine.yaws[i]! - mine.yaws[i - 1]!)).toBeLessThanOrEqual(YAW_TURN_RATE * 0.016 * 1.01);
    expect(mine.moving.at(-1)).toBe(false);
    const calls = mine.yaws.length;
    frames(1000);
    expect(mine.yaws.length).toBe(calls);
  });
});

describe("G-07-9 섞기·방향 (결정 0059)", () => {
  const dist = (a: { x: number; z: number }, b: { x: number; z: number }): number => Math.hypot(a.x - b.x, a.z - b.z);
  const posOf = (h: CharacterHandle): { x: number; z: number } => ({ x: h.root.position.x, z: h.root.position.z });
  const lastRing = (r: FakeRenderer) => r.markers.filter((m) => m.kind === "ring").at(-1);

  it("결정 0059: 남의 캐릭터는 예측하지 않는다 — 내가 탭해 예측 중이어도 남은 매 프레임 서버 위치다", async () => {
    const s = await open();
    const other = s.world.renderers[0]!.chars.get(1)!;
    move(s.store, seg(1, [-300, 50, 100, 50], Date.now(), 180));
    tapAt(surface(s.utils), 250, 340);
    for (let t = 0; t < 400; t += 16) {
      frame(16);
      const want = s.store.positionOf(1, Date.now())!;
      expect(Math.abs(other.root.position.x - want.x)).toBeLessThan(1e-6);
      expect(Math.abs(other.root.position.z - want.z)).toBeLessThan(1e-6);
    }
  });

  it("결정 0059: 남의 새 구간이 오면 위치 차이만 150ms 섞는다(바로 새 위치로 가지 않고, 한 프레임 이동 작음)", async () => {
    const s = await open();
    const other = s.world.renderers[0]!.chars.get(1)!;
    move(s.store, seg(1, [-280, 50], Date.now(), 180)); // 서 있던 (−3, 0.5) 에서 0.2 떨어진 점의 새 구간
    frame(16);
    const first = posOf(other);
    expect(first.x).toBeLessThan(-2.9);
    expect(dist(first, s.store.positionOf(1, Date.now())!)).toBeGreaterThanOrEqual(0.15);
    const started = Date.now();
    let prev = first;
    let blended = false;
    for (let t = 0; t < 300; t += 16) {
      frame(16);
      const cur = posOf(other);
      expect(dist(cur, prev)).toBeLessThanOrEqual(0.06);
      prev = cur;
      if (Date.now() - started >= SEG_BLEND_MS + 32) {
        expect(dist(cur, s.store.positionOf(1, Date.now())!)).toBeLessThan(1e-6);
        blended = true;
      }
    }
    expect(blended).toBe(true);
  });

  it("결정 0059: 3 단위 넘게 떨어진 새 구간(순간이동)은 섞지 않고 바로 맞춘다", async () => {
    const s = await open();
    const other = s.world.renderers[0]!.chars.get(1)!;
    move(s.store, seg(1, [200, 400], Date.now(), 180));
    frame(16);
    const want = s.store.positionOf(1, Date.now())!;
    expect(dist(posOf(other), want)).toBeLessThan(1e-6);
  });

  it("결정 0059: 응답이 탭 간격보다 늦어도 둘째 탭의 링과 예측은 첫 탭의 응답에 끌려가지 않고 둘째 응답에서 맞춘다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    const mine = r.chars.get(0)!;
    const root = s.utils.container.querySelector("[data-world-stage]")!;
    const base = s.store.segOf(0);
    tapAt(surface(s.utils), 250, 340);
    const sent1 = Date.now();
    const pred1 = predictSegment(base, { x: 500, z: 400 }, sent1)!;
    frames(210);
    tapAt(surface(s.utils), 150, 320); // 바닥 (−5, 2)
    const sent2 = Date.now();
    expect(lastRing(r)!.at).toEqual({ x: -5, z: 2 });
    move(s.store, { s: 0, p: pred1.p, t0: sent1 + 77, v: pred1.v }); // 첫 탭의 늦은 응답
    frame(16);
    expect(root.getAttribute("data-ring")).toBe("-5.00,2.00");
    let prev = dist(posOf(mine), { x: -5, z: 2 });
    for (let i = 0; i < 5; i++) {
      frame(16);
      const d = dist(posOf(mine), { x: -5, z: 2 });
      expect(d).toBeLessThan(prev); // 둘째 예측으로 계속 다가간다
      prev = d;
    }
    const seg1 = { p: pred1.p, t0: sent1 + 77, v: pred1.v };
    const pred2 = predictSegment(seg1, { x: -500, z: 200 }, sent2 + 77)!;
    move(s.store, { s: 0, p: pred2.p, t0: sent2 + 77, v: pred2.v }); // 둘째 탭의 응답
    frame(16);
    expect(root.getAttribute("data-ring")).toBe("-5.00,2.00");
    frames(SEG_BLEND_MS + 48);
    const want = s.store.positionOf(0, Date.now())!;
    expect(dist(posOf(mine), want)).toBeLessThan(1e-6);
    frames(MOVE_ACK_TIMEOUT_MS * 2);
    expect(s.props.onNotice).not.toHaveBeenCalled();
  });

  it("결정 0059: 탭 뒤 새 연결(epoch 변경)이면 링과 예측을 알림 없이 거두고 snap 위치에 선다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    const mine = r.chars.get(0)!;
    tapAt(surface(s.utils), 250, 340);
    frames(100);
    snap(s.store, [seg(0, [-400, -300]), seg(1, [-300, 50])], 2);
    frame(16);
    expect(lastRing(r)!.at).toBeNull();
    expect(s.utils.container.querySelector("[data-world-stage]")!.getAttribute("data-ring")).toBeNull();
    expect(dist(posOf(mine), { x: -4, z: -3 })).toBeLessThan(1e-6);
    frames(MOVE_ACK_TIMEOUT_MS * 2);
    expect(s.props.onNotice).not.toHaveBeenCalled();
  });

  it("결정 0059: 모션 줄이기면 구간 교체를 섞지 않고 바로 맞춘다(예측 출발은 그대로 한다)", async () => {
    stubReducedMotion(true);
    const s = await open();
    const mine = s.world.renderers[0]!.chars.get(0)!;
    const base = s.store.segOf(0);
    tapAt(surface(s.utils), 250, 340);
    const sent = Date.now();
    const pred = predictSegment(base, { x: 500, z: 400 }, sent)!;
    frames(96);
    expect(dist(posOf(mine), { x: 2, z: 1 })).toBeGreaterThan(0.1);
    move(s.store, { s: 0, p: pred.p, t0: sent + 77, v: pred.v });
    frame(16);
    expect(dist(posOf(mine), s.store.positionOf(0, Date.now())!)).toBeLessThan(1e-6);
  });

  it("결정 0059: +x 로 걸으면 방향은 한 프레임에 YAW_TURN_RATE × dt 까지만 돌고 150ms 안에 π/2 가 된다", async () => {
    const s = await open();
    const mine = s.world.renderers[0]!.chars.get(0)! as FakeHandle;
    const before = mine.yaws.length;
    move(s.store, seg(0, [200, 100, 600, 100], Date.now(), 180));
    const started = Date.now();
    let reached: number | null = null;
    let prev = mine.yaws.at(-1)!;
    for (let t = 0; t < 400; t += 16) {
      frame(16);
      const cur = mine.yaws.at(-1)!;
      expect(Math.abs(cur - prev)).toBeLessThanOrEqual(YAW_TURN_RATE * 0.016 * 1.01);
      prev = cur;
      if (reached === null && Math.abs(cur - Math.PI / 2) < 1e-4) reached = Date.now() - started;
    }
    expect(mine.yaws.length).toBeGreaterThan(before);
    expect(reached).not.toBeNull();
    expect(reached!).toBeLessThanOrEqual(150);
  });

  it("결정 0059: 반대쪽(−x)으로 걸을 때도 짧은 쪽으로 한 프레임 제한만큼씩 돌아 −π/2 에 닿는다", async () => {
    const s = await open();
    const mine = s.world.renderers[0]!.chars.get(0)! as FakeHandle;
    move(s.store, seg(0, [200, 100, -200, 100], Date.now(), 180));
    let prev = mine.yaws.at(-1)!;
    let changed = 0;
    for (let t = 0; t < 400; t += 16) {
      frame(16);
      const cur = mine.yaws.at(-1)!;
      expect(Math.abs(cur - prev)).toBeLessThanOrEqual(YAW_TURN_RATE * 0.016 * 1.01);
      if (cur !== prev) changed++;
      prev = cur;
    }
    expect(changed).toBeGreaterThanOrEqual(4); // 한 번에 돌지 않는다
    expect(Math.abs(prev + Math.PI / 2)).toBeLessThan(1e-4);
  });

  it("결정 0059: 모션 줄이기면 걷기 시작 다음 프레임에 방향이 바로 π/2 다", async () => {
    stubReducedMotion(true);
    const s = await open();
    const mine = s.world.renderers[0]!.chars.get(0)! as FakeHandle;
    move(s.store, seg(0, [200, 100, 600, 100], Date.now(), 180));
    frame(16);
    expect(Math.abs(mine.yaws.at(-1)! - Math.PI / 2)).toBeLessThan(1e-4);
  });
});

describe("WorldStage: 수명", () => {
  it("언마운트하면 렌더러를 한 번 dispose 하고 rAF 를 취소한다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    s.utils.unmount();
    expect(r.disposed).toBe(1);
    expect(rafCbs.size).toBe(0);
  });

  it("StrictMode 이중 마운트에서도 살아 있는 렌더러는 마지막 하나뿐이다", async () => {
    const s = await open({}, { strict: true });
    const alive = s.world.renderers.filter((r) => r.disposed === 0);
    expect(alive).toHaveLength(1);
    s.utils.unmount();
    expect(s.world.renderers.every((r) => r.disposed >= 1)).toBe(true);
  });
});

// ---------- Task 2: 이름표 층·등장/퇴장·링·손짓 링 ----------

const tagOf = (utils: ReturnType<typeof render>, seat: number): HTMLElement | null => utils.container.querySelector<HTMLElement>(`.mf-world__tags [data-seat="${seat}"]`);

describe("이름표 층 (MAP-01, MAP-07)", () => {
  it("플레이어마다 이름표 하나가 data-seat·data-me·data-away 로 있고 나는 (나) 가 붙는다", async () => {
    const players = [player(0, "민지"), player(1, "가나다라마바사아"), player(2, "영희", { connected: false })];
    const s = await open({}, { players, mySeat: 1, ents: [seg(0, [200, 100]), seg(1, [-300, 50]), seg(2, [0, 0])] });
    const mine = tagOf(s.utils, 1)!;
    expect(mine.getAttribute("data-me")).toBe("true");
    expect(mine.textContent).toBe("가나다라마바사아 (나)");
    expect(tagOf(s.utils, 0)!.getAttribute("data-me")).toBeNull();
    expect(tagOf(s.utils, 2)!.getAttribute("data-away")).toBe("true");
    expect(tagOf(s.utils, 0)!.getAttribute("data-away")).toBeNull();
    expect(s.utils.container.querySelectorAll(".mf-world__tags [data-seat]")).toHaveLength(3);
  });

  it("매 프레임 머리 꼭대기 투영 좌표에 장치 픽셀로 반올림한 translate 로 놓인다(간격 4px 위)", async () => {
    const s = await open();
    frame();
    // seat 0 = (2, 1): 머리 sy = 300 + 10 − 18 = 292, 간격 4 → 288, sx = 220
    expect(tagOf(s.utils, 0)!.getAttribute("style")).toContain("translate(220px, 288px) translate(-50%, -100%)");
    // seat 1 = (−3, 0.5): sx = 170, sy = 300 + 5 − 18 − 4 = 283
    expect(tagOf(s.utils, 1)!.getAttribute("style")).toContain("translate(170px, 283px) translate(-50%, -100%)");
  });

  it("장치 배율 3 이면 1/3 픽셀에 반올림한다", async () => {
    vi.stubGlobal("devicePixelRatio", 3);
    window.devicePixelRatio = 3;
    const s = await open({}, { ents: [seg(0, [203, 107]), seg(1, [-300, 50])] });
    frame();
    // 머리: sx = 200 + 20.3 = 220.3 → 220.333…, sy = 300 + 10.7 − 18 − 4 = 288.7 → 288.666…
    const style = tagOf(s.utils, 0)!.getAttribute("style")!;
    expect(style).toMatch(/translate\(220\.3333\d*px, 288\.6666\d*px\)/);
    window.devicePixelRatio = 1;
  });

  it("발끝 화면 y 가 큰 쪽이 위에 온다 — 이름표를 밀어서 피하지 않는다", async () => {
    // 내 이름표(seat 2)는 멀리 서 있다 — seat 0·1 의 순서는 오직 발 y 로만 정해진다
    const players = [player(0, "민지"), player(1, "철수"), player(2, "영희")];
    const s = await open({}, { players, mySeat: 2, ents: [seg(0, [200, 100]), seg(1, [-300, 50]), seg(2, [0, 0])] });
    frame();
    const z0 = Number(tagOf(s.utils, 0)!.style.zIndex);
    const z1 = Number(tagOf(s.utils, 1)!.style.zIndex);
    expect(z0).toBeGreaterThan(z1); // seat 0 발 sy 310 > seat 1 발 sy 305
    move(s.store, seg(1, [200, 400], Date.now(), 180)); // seat 1 이 더 앞(z=4)으로 간다
    frame();
    expect(Number(tagOf(s.utils, 1)!.style.zIndex)).toBeGreaterThan(Number(tagOf(s.utils, 0)!.style.zIndex));
  });

  it("같은 자리에 8명이 모여도 이름표는 서로 다른 순위를 갖고 모두 같은 좌표다(밀지 않음) — 내 이름표(seat 0)가 맨 위다", async () => {
    const players = Array.from({ length: 8 }, (_, i) => player(i, `사람${i}`));
    const ents = players.map((p) => seg(p.seat, [100, 100]));
    const s = await open({}, { players, ents });
    frame();
    const styles = players.map((p) => tagOf(s.utils, p.seat)!.getAttribute("style")!.match(/translate\([^)]*\)/)![0]);
    expect(new Set(styles).size).toBe(1);
    const zs = players.map((p) => Number(tagOf(s.utils, p.seat)!.style.zIndex));
    expect(new Set(zs).size).toBe(8);
    expect(zs[0]).toBe(Math.max(...zs));
  });

  it("내 이름표는 내 발이 뒤여도 발 sy 가 더 큰 다른 이름표보다 위다(G-06-4)", async () => {
    // seat 0 발 sy 310 > seat 1 발 sy 305 인데 내 seat 이 1 이다
    const s = await open({}, { mySeat: 1 });
    frame();
    expect(Number(tagOf(s.utils, 1)!.style.zIndex)).toBeGreaterThan(Number(tagOf(s.utils, 0)!.style.zIndex));
  });

  it("이름표 안에서 닉네임은 텍스트로만 그려진다", async () => {
    const players = [player(0, "<img src=x onerror=alert(1)>"), player(1, "철수")];
    const s = await open({}, { players });
    expect(s.utils.container.querySelector(".mf-world__tags img")).toBeNull();
    expect(tagOf(s.utils, 0)!.textContent).toContain("<img src=x onerror=alert(1)>");
  });
});

describe("이름표 위 입력 중 알약 (CHAT-04, 07-18)", () => {
  const pills = (utils: ReturnType<typeof render>): HTMLElement[] => Array.from(utils.container.querySelectorAll<HTMLElement>(".mf-world__tags .mv-typing"));

  it("typingSeats {2, 5} 이면 좌석 2·5 이름표에만 data-typing 과 알약이 있다", async () => {
    const players = Array.from({ length: 6 }, (_, i) => player(i, `사람${i}`));
    const ents = players.map((p) => seg(p.seat, [p.seat * 40, 0]));
    const s = await open({ typingSeats: new Set([2, 5]) }, { players, ents });
    const on = [0, 1, 2, 3, 4, 5].filter((i) => tagOf(s.utils, i)!.querySelector('[data-typing="true"]') !== null);
    expect(on.join(",")).toBe("2,5");
    expect(pills(s.utils)).toHaveLength(2);
  });

  it("typingSeats 가 없거나 비어 있으면 알약이 없다", async () => {
    const s = await open();
    expect(pills(s.utils)).toHaveLength(0);
    s.rerender({ typingSeats: new Set() });
    expect(pills(s.utils)).toHaveLength(0);
  });

  it("8좌석 모두 입력 중이면 알약 8개가 각자 자기 [data-seat] 이름표 안에 하나씩 있다", async () => {
    const players = Array.from({ length: 8 }, (_, i) => player(i, `사람${i}`));
    const ents = players.map((p) => seg(p.seat, [p.seat * 30, 0]));
    const s = await open({ typingSeats: new Set(players.map((p) => p.seat)) }, { players, ents });
    expect(pills(s.utils)).toHaveLength(8);
    for (const p of players) expect(tagOf(s.utils, p.seat)!.querySelectorAll(".mv-typing")).toHaveLength(1);
  });

  it("알약은 글자가 없고 이름표 층과 함께 aria-hidden 이라 읽지 않는다", async () => {
    const s = await open({ typingSeats: new Set([0]) });
    const pill = pills(s.utils)[0]!;
    expect(pill.textContent).toBe("");
    expect(pill.children).toHaveLength(3);
    expect(pill.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("알약이 켜지고 꺼지는 것은 속성 하나로 따라간다 (내 이름표 위로 즉시)", async () => {
    const s = await open();
    expect(pills(s.utils)).toHaveLength(0);
    s.rerender({ typingSeats: new Set([0]) });
    expect(tagOf(s.utils, 0)!.querySelector('[data-typing="true"]')).not.toBeNull();
    s.rerender({ typingSeats: new Set() });
    expect(pills(s.utils)).toHaveLength(0);
  });
});

describe("이름표 맨 앞 겹침 data-front (G-06-4)", () => {
  const realWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
  let reads = 0;

  beforeEach(() => {
    reads = 0;
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get(this: HTMLElement) {
        if (this.classList.contains("mf-world__tag")) {
          reads++;
          return 100;
        }
        return 0;
      },
    });
  });

  afterEach(() => {
    if (realWidth !== undefined) Object.defineProperty(HTMLElement.prototype, "offsetWidth", realWidth);
  });

  const front = (s: Setup, seat: number): string | null => tagOf(s.utils, seat)!.getAttribute("data-front");
  const three = [player(0, "민지"), player(1, "철수"), player(2, "영희")];
  const near = [seg(0, [100, 100]), seg(1, [130, 100]), seg(2, [-600, -300])];

  it("겹친 두 이름표 중 위의 것에만 붙고, 멀리 떨어지면 사라진다", async () => {
    // 내 이름표(seat 2)는 멀리. seat 0·1 은 sx 210·213 으로 폭 100 이름표가 겹치고 발 y 가 같아 seat 1 이 위
    const s = await open({}, { players: three, mySeat: 2, ents: near });
    frame();
    expect(front(s, 1)).toBe("true");
    expect(front(s, 0)).toBeNull();
    expect(front(s, 2)).toBeNull();
    move(s.store, seg(1, [1500, 100]));
    frame();
    expect(front(s, 1)).toBeNull();
    expect(front(s, 0)).toBeNull();
  });

  it("8명이 한 점에 모이면 하나만 붙고 그것은 내 이름표다", async () => {
    const players = Array.from({ length: 8 }, (_, i) => player(i, `사람${i}`));
    const s = await open({}, { players, mySeat: 3, ents: players.map((p) => seg(p.seat, [100, 100])) });
    frame();
    const marked = players.filter((p) => front(s, p.seat) === "true").map((p) => p.seat);
    expect(marked).toEqual([3]);
  });

  it("이름표 폭은 처음 한 번만 읽고 프레임마다 읽지 않으며, view 갱신 뒤에만 다시 읽는다", async () => {
    const s = await open({}, { players: three, mySeat: 2, ents: near });
    frame();
    const first = reads;
    expect(first).toBe(3);
    frames(20 * 16);
    expect(reads).toBe(first);
    s.rerender({ view: makeView([...three], 2) });
    frame();
    expect(reads).toBeGreaterThan(first);
    const second = reads;
    frames(20 * 16);
    expect(reads).toBe(second);
  });
});

describe("접근성 목록과 내보내기 이름표 (MAP-07)", () => {
  const players = [player(0, "민지"), player(1, "철수"), player(2, "영희", { connected: false })];
  const ents = [seg(0, [200, 100]), seg(1, [-300, 50]), seg(2, [0, 0])];

  it("보이지 않는 목록이 사람 수와 상태를 읽어 준다", async () => {
    const s = await open({}, { players, mySeat: 1, ents });
    const list = screen.getByRole("list", { name: "방에 있는 사람 3명" });
    const items = [...list.querySelectorAll("li")].map((li) => li.textContent);
    expect(items).toEqual(["민지 님, 방장", "철수 님, 나", "영희 님, 연결 끊김"]);
    expect(s.utils.container.querySelector(".mf-world__tags [data-seat]")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("보이지 않는 목록은 E2E G2 가 건너뛰는 읽기 전용 안내 클래스(mf-sr-only)를 함께 갖는다 (06-17: 1px 이 화면 왼쪽 밖으로 나가 G2 가 잡았다)", async () => {
    await open({}, { players, mySeat: 1, ents });
    expect(screen.getByRole("list", { name: "방에 있는 사람 3명" }).classList.contains("mf-sr-only")).toBe(true);
  });

  it("방장은 끊긴 다른 사람 이름표를 44×44 이상 누르기 영역의 버튼으로 눌러 내보내기를 시작한다", async () => {
    const s = await open({}, { players, mySeat: 0, ents });
    const btn = screen.getByRole("button", { name: "영희 님 내보내기" });
    expect(btn.classList.contains("mf-world__kick")).toBe(true);
    fireEvent.click(btn);
    expect(s.props.onKick).toHaveBeenCalledWith(2, "영희");
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("onKick 을 넘기지 않으면(게임 중 맵) 방장 화면에서도 끊긴 사람 이름표가 내보내기 버튼이 되지 않는다 (WR-02)", async () => {
    await open({ onKick: undefined }, { players, mySeat: 0, ents });
    expect(screen.queryByRole("button", { name: /내보내기/ })).toBeNull();
    expect(document.querySelector(".mf-world__kick")).toBeNull();
  });

  it("손님 화면에는 내보내기 버튼이 없다", async () => {
    await open({}, { players, mySeat: 1, ents });
    expect(screen.queryByRole("button", { name: /내보내기/ })).toBeNull();
  });

  it("연결된 사람·방장 자신에게는 버튼이 없고, 연결이 끊긴 동안(canSend false)에도 없다", async () => {
    await open({}, { players: [player(0, "민지"), player(1, "철수")], mySeat: 0 });
    expect(screen.queryByRole("button", { name: /내보내기/ })).toBeNull();
    cleanup();
    await open({ canSend: false }, { players, mySeat: 0, ents });
    expect(screen.queryByRole("button", { name: /내보내기/ })).toBeNull();
  });
});

describe("끊김 어둡게 (MAP-07)", () => {
  it("서버 connected:false 인 사람의 캐릭터만 setDim(true), 돌아오면 false", async () => {
    const players = [player(0, "민지"), player(1, "철수", { connected: false })];
    const s = await open({}, { players });
    const h1 = s.world.renderers[0]!.chars.get(1) as FakeHandle;
    const h0 = s.world.renderers[0]!.chars.get(0) as FakeHandle;
    expect(h1.dims.at(-1)).toBe(true);
    expect(h0.dims.at(-1) ?? false).toBe(false);
    s.rerender({ view: makeView([player(0, "민지"), player(1, "철수")]) });
    expect(h1.dims.at(-1)).toBe(false);
  });
});

describe("등장·퇴장 연출 (결정 0006)", () => {
  it("첫 snap 에 있던 사람은 등장 연출 없이 서 있다(크기 1)", async () => {
    const s = await open();
    const h = s.world.renderers[0]!.chars.get(1)!;
    expect(h.root.scale.x).toBeCloseTo(0.83, 6);
    expect(h.root.position.y).toBe(0);
    expect(tagOf(s.utils, 1)!.style.opacity).toBe("1");
  });

  it("뒤에 들어온 사람은 크기 0.6→1, 위 0.4→0, 이름표 0→1 로 420ms 에 걸쳐 내려앉는다", async () => {
    const players = [...TWO, player(2, "영희")];
    const s = await open();
    s.rerender({ view: makeView(players) });
    move(s.store, seg(2, [300, 300], Date.now(), 180));
    frame(1);
    const h = s.world.renderers[0]!.chars.get(2)!;
    expect(h.root.scale.x).toBeCloseTo(0.83 * 0.6, 2);
    expect(h.root.position.y).toBeGreaterThan(0.35);
    expect(tagOf(s.utils, 2)!.style.opacity).toBe("0");
    frames(ENTER_MS / 2);
    expect(h.root.scale.x).toBeGreaterThan(0.83 * 0.6 + 0.05);
    expect(h.root.position.y).toBeLessThan(0.3);
    frames(ENTER_MS);
    expect(h.root.scale.x).toBeCloseTo(0.83, 6);
    expect(h.root.position.y).toBe(0);
    expect(tagOf(s.utils, 2)!.style.opacity).toBe("1");
  });

  it("모션 줄이기면 등장은 즉시다", async () => {
    stubReducedMotion(true);
    const s = await open();
    s.rerender({ view: makeView([...TWO, player(2, "영희")]) });
    move(s.store, seg(2, [300, 300], Date.now(), 180));
    frame(1);
    const h = s.world.renderers[0]!.chars.get(2)!;
    expect(h.root.scale.x).toBeCloseTo(0.83, 6);
    expect(h.root.position.y).toBe(0);
  });

  it("나간 사람은 크기 1→0.6·이름표 1→0 으로 180ms 뒤 캐릭터와 이름표가 사라진다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    const h = r.chars.get(1) as FakeHandle;
    s.rerender({ view: makeView([player(0, "민지")]) });
    frame(EXIT_MS / 2);
    expect(r.chars.has(1)).toBe(true);
    expect(h.root.scale.x).toBeLessThan(0.83);
    expect(h.root.scale.x).toBeGreaterThan(0.83 * 0.6);
    const mid = tagOf(s.utils, 1);
    expect(mid).not.toBeNull();
    expect(Number(mid!.style.opacity)).toBeLessThan(1);
    expect(Number(mid!.style.opacity)).toBeGreaterThan(0);
    frames(EXIT_MS * 2);
    expect(r.chars.has(1)).toBe(false);
    expect(h.disposed).toBe(1);
    expect(tagOf(s.utils, 1)).toBeNull();
  });

  it("모션 줄이기면 퇴장도 즉시다", async () => {
    stubReducedMotion(true);
    const s = await open();
    const r = s.world.renderers[0]!;
    s.rerender({ view: makeView([player(0, "민지")]) });
    frame(16);
    expect(r.chars.has(1)).toBe(false);
    expect(tagOf(s.utils, 1)).toBeNull();
  });
});

describe("목적지 링 피드백 (UI-SPEC 터치해서 걷기 3~8)", () => {
  const lastRing = (r: FakeRenderer) => r.markers.filter((m) => m.kind === "ring").at(-1);

  it("루트의 data-ring 은 링이 있을 때 x,z(소수 둘째 자리)이고 없으면 속성이 없다", async () => {
    const s = await open();
    const root = s.utils.container.querySelector("[data-world-stage]")!;
    expect(root.getAttribute("data-ring")).toBeNull();
    tapAt(surface(s.utils), 250, 340);
    expect(root.getAttribute("data-ring")).toBe("5.00,4.00");
  });

  it("내 구간이 오면 링이 구간 끝점(보정된 지점)으로 180ms 안에 옮겨진다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    tapAt(surface(s.utils), 250, 340);
    // 서버가 (5, 4) 를 (4, 3) 으로 보정했다
    move(s.store, seg(0, [200, 100, 400, 300], Date.now(), 180));
    frame(16); // 이 프레임에 구간을 알아본다
    frame(50);
    const mid = lastRing(r)!;
    expect(mid.at!.x).toBeLessThan(5);
    expect(mid.at!.x).toBeGreaterThan(4);
    frames(200);
    expect(lastRing(r)!.at).toEqual({ x: 4, z: 3 });
    const root = s.utils.container.querySelector("[data-world-stage]")!;
    expect(root.getAttribute("data-ring")).toBe("4.00,3.00");
  });

  it("도착하면 링이 180ms 에 사라지고 data-ring 속성도 없어진다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    tapAt(surface(s.utils), 250, 340);
    const seg0 = seg(0, [200, 100, 400, 100], Date.now(), 180); // 길이 2 → 약 1.11초
    move(s.store, seg0);
    frames(500);
    expect(lastRing(r)!.at).not.toBeNull();
    frames(segmentEndsAt(seg0) - Date.now() + 40);
    const fading = lastRing(r)!;
    expect(fading.opacity).toBeLessThan(1);
    frames(EXIT_MS + 50);
    expect(lastRing(r)!.at).toBeNull();
    expect(s.utils.container.querySelector("[data-world-stage]")!.getAttribute("data-ring")).toBeNull();
  });

  it("링은 1100ms 주기로 1 → 1.15 → 1 맥박하고 모션 줄이기면 1 로 고정이다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    tapAt(surface(s.utils), 250, 340);
    frames(1100);
    const scales = r.markers.filter((m) => m.kind === "ring" && m.at).map((m) => m.scale);
    expect(Math.max(...scales)).toBeGreaterThan(1.14);
    expect(Math.min(...scales)).toBeGreaterThanOrEqual(1);
  });

  it("모션 줄이기면 링 맥박이 없다", async () => {
    stubReducedMotion(true);
    const s = await open();
    const r = s.world.renderers[0]!;
    tapAt(surface(s.utils), 250, 340);
    frames(1100);
    const scales = r.markers.filter((m) => m.kind === "ring" && m.at).map((m) => m.scale);
    expect(new Set(scales)).toEqual(new Set([1]));
  });

  it("1.5초 안에 내 구간이 안 오면 링이 사라지고 알림이 한 번 뜬다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    tapAt(surface(s.utils), 250, 340);
    frames(MOVE_ACK_TIMEOUT_MS - 100);
    expect(s.props.onNotice).not.toHaveBeenCalled();
    frames(200);
    expect(s.props.onNotice).toHaveBeenCalledTimes(1);
    expect(s.props.onNotice).toHaveBeenCalledWith(NETWORK_TEXT);
    expect(lastRing(r)!.at).toBeNull();
    frames(3000);
    expect(s.props.onNotice).toHaveBeenCalledTimes(1);
  });

  it("1.5초 안에 구간이 오면 알림이 없다", async () => {
    const s = await open();
    tapAt(surface(s.utils), 250, 340);
    frames(600);
    move(s.store, seg(0, [200, 100, 500, 400], Date.now(), 180));
    frames(MOVE_ACK_TIMEOUT_MS * 2);
    expect(s.props.onNotice).not.toHaveBeenCalled();
  });

  it("GR-WR-01: 둘째 탭이 서버에서 버려지고 목적지가 달라도 응답을 들었으면 시계 만료 때 알림 없이 링만 거둔다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    const el = surface(s.utils);
    tapAt(el, 250, 340);
    frames(300);
    tapAt(el, 150, 320);
    move(s.store, seg(0, [200, 100, 500, 400], Date.now(), 180)); // 첫 탭만 적용, 둘째 예측과 끝점이 다르다
    frames(MOVE_ACK_TIMEOUT_MS + 300);
    expect(s.props.onNotice).not.toHaveBeenCalled();
    expect(lastRing(r)!.at).toBeNull();
  });

  it("GR-WR-01: 숨은 탭(프레임 없음)에서 응답이 와 있어도 타이머가 먼저 관찰해 알림이 없다", async () => {
    const s = await open();
    tapAt(surface(s.utils), 250, 340);
    move(s.store, seg(0, [200, 100, 500, 400], Date.now(), 180));
    act(() => {
      vi.advanceTimersByTime(MOVE_ACK_TIMEOUT_MS + 200); // rAF 는 돌지 않는다
    });
    expect(s.props.onNotice).not.toHaveBeenCalled();
  });

  it("보내지 못했으면(send false) 링을 거두고 알림 없이 끝난다", async () => {
    const s = await open({ send: vi.fn(() => false) });
    const r = s.world.renderers[0]!;
    tapAt(surface(s.utils), 250, 340);
    frames(MOVE_ACK_TIMEOUT_MS + 200);
    expect(lastRing(r)!.at).toBeNull();
    expect(s.props.onNotice).not.toHaveBeenCalled();
  });

  it("걷는 중 다시 누르면 새 목적지로 바로 갈아탄다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    const el = surface(s.utils);
    tapAt(el, 250, 340);
    move(s.store, seg(0, [200, 100, 500, 400], Date.now(), 180));
    frames(300);
    tapAt(el, 150, 320);
    expect(lastRing(r)!.at).toEqual({ x: -5, z: 2 });
    expect(s.send).toHaveBeenCalledTimes(2);
  });
});

describe("처음 방문 손짓 링 (UI-SPEC 안내)", () => {
  const cues = (r: FakeRenderer) => r.markers.filter((m) => m.kind === "cue");

  it("저장소에 키가 없으면 맵이 열린 600ms 뒤 내 앞 걸을 수 있는 곳에 3번 맥박하고 사라지며 키가 저장된다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    frames(590);
    expect(cues(r).filter((m) => m.at)).toHaveLength(0);
    frames(40);
    const first = cues(r).find((m) => m.at)!;
    expect(first).toBeTruthy();
    // 내 위치(2, 1) 앞(+x+z) 약 2 단위, 걸을 수 있는 칸으로 보정
    const want = snapToWalkable(BAR_MAP, { x: Math.round((2 + Math.SQRT1_2 * 2) * 100), z: Math.round((1 + Math.SQRT1_2 * 2) * 100) });
    expect(first.at!.x).toBeCloseTo(want.x / 100, 6);
    expect(first.at!.z).toBeCloseTo(want.z / 100, 6);
    frames(3300);
    const shown = cues(r).filter((m) => m.at);
    expect(Math.max(...shown.map((m) => m.scale))).toBeGreaterThan(1.14);
    expect(cues(r).at(-1)!.at).toBeNull();
    expect(localStorage.getItem(WALK_CUE_KEY)).not.toBeNull();
  });


  it("광장(view.map plaza)에서는 손짓 링 보정이 광장 마스크를 쓴다 — 재즈 바 마스크로는 걸을 수 있는 칸이 광장에서는 막혀 있다 (T-11-35)", async () => {
    // 내 위치에서 앞(+x+z)으로 2 단위 갔을 때 (−4.25, −3.25): 재즈 바는 걸을 수 있고 광장은 시계탑 쪽이라 막힌 칸
    const px = -566;
    const pz = -466;
    const aim = { x: Math.round((px / 100 + Math.SQRT1_2 * 2) * 100), z: Math.round((pz / 100 + Math.SQRT1_2 * 2) * 100) };
    const wantBar = snapToWalkable(BAR_MAP, aim);
    const wantPlaza = snapToWalkable(PLAZA_MAP, aim);
    expect(wantBar.snapped).toBe(false);
    expect(wantPlaza.snapped).toBe(true);
    const s = await open({ view: { ...makeView(TWO, 0), map: "plaza" } }, { ents: [seg(0, [px, pz]), seg(1, [-300, 50])] });
    const r = s.world.renderers[0]!;
    frames(640);
    const first = cues(r).find((m) => m.at)!;
    expect(first).toBeTruthy();
    expect(first.at!.x).toBeCloseTo(wantPlaza.x / 100, 6);
    expect(first.at!.z).toBeCloseTo(wantPlaza.z / 100, 6);
  });
  it("키가 이미 있으면 손짓 링이 뜨지 않는다", async () => {
    localStorage.setItem(WALK_CUE_KEY, "1");
    const s = await open();
    frames(5000);
    expect(cues(s.world.renderers[0]!).filter((m) => m.at)).toHaveLength(0);
  });

  it("첫 탭이면 즉시 사라진다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    frames(900);
    expect(cues(r).at(-1)!.at).not.toBeNull();
    tapAt(surface(s.utils), 250, 340);
    expect(cues(r).at(-1)!.at).toBeNull();
    expect(localStorage.getItem(WALK_CUE_KEY)).not.toBeNull();
  });

  it("모션 줄이기면 맥박 없이 2.5초 고정으로 보이다 사라진다", async () => {
    stubReducedMotion(true);
    const s = await open();
    const r = s.world.renderers[0]!;
    frames(700);
    frames(2300);
    expect(cues(r).at(-1)!.at).not.toBeNull();
    expect(new Set(cues(r).filter((m) => m.at).map((m) => m.scale))).toEqual(new Set([1]));
    frames(300);
    expect(cues(r).at(-1)!.at).toBeNull();
  });
});

// ---------- Task 3: 맵 상태 카드·소실/복구·숨김 복귀·나가는 가림막·E2E 훅 (MAP-05) ----------

const rootOf = (utils: ReturnType<typeof render>): HTMLElement => utils.container.querySelector<HTMLElement>("[data-world-stage]")!;

function setVisibility(state: "hidden" | "visible"): void {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

afterEach(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  vi.unstubAllEnvs();
});

describe("맵 상태 카드: 불러오는 중 → 열림 (E1 loading)", () => {
  it("첫 snap 전에는 카드만 보이고, snap 과 렌더러가 모두 준비되면 카드가 사라지고 열림 클래스가 붙고 onReady 가 한 번 불린다", async () => {
    const onReady = vi.fn();
    const s = await open({ onReady }, { ents: null });
    expect(screen.getByText("맵을 불러오는 중…")).toBeTruthy();
    expect(rootOf(s.utils).classList.contains("is-open")).toBe(false);
    expect(s.world.renderers).toHaveLength(1); // 렌더러만 준비됨
    frames(200);
    expect(screen.getByText("맵을 불러오는 중…")).toBeTruthy();
    expect(onReady).not.toHaveBeenCalled();
    snap(s.store, [seg(0, [200, 100]), seg(1, [-300, 50])]);
    frames(100);
    expect(screen.queryByText("맵을 불러오는 중…")).toBeNull();
    expect(rootOf(s.utils).classList.contains("is-open")).toBe(true);
    expect(onReady).toHaveBeenCalledTimes(1);
    frames(500);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("준비 전에는 탭을 무시한다(링도 move 도 없다)", async () => {
    const s = await open({}, { ents: null });
    tapAt(surface(s.utils), 250, 340);
    expect(s.send).not.toHaveBeenCalled();
  });

  it("map-interactive 표식은 열린 뒤 한 번만 찍힌다", async () => {
    const mark = vi.spyOn(performance, "mark");
    const s = await open();
    frames(300);
    const marks = mark.mock.calls.filter((c) => c[0] === "map-interactive");
    expect(marks).toHaveLength(1);
    s.world.renderers[0]!.emit({ t: "lost" });
    s.world.renderers[0]!.emit({ t: "restored" });
    frames(300);
    expect(mark.mock.calls.filter((c) => c[0] === "map-interactive")).toHaveLength(1);
    mark.mockRestore();
  });
});

describe("맵 상태 카드: 실패 (E1 error)", () => {
  it("모듈을 못 받으면 불러오기 실패 카드와 [다시 시도] — 누르면 다시 불러온다", async () => {
    const world = makeWorld();
    const loadModules = vi.fn().mockRejectedValueOnce(new Error("network")).mockImplementation(() => Promise.resolve(world.modules));
    const s = await open({ loadModules });
    expect(screen.getByText("맵을 불러오지 못했어요")).toBeTruthy();
    expect(screen.getByText("네트워크를 확인해 주세요")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(screen.getByText("맵을 불러오는 중…")).toBeTruthy();
    await flush();
    frames(100);
    expect(loadModules).toHaveBeenCalledTimes(2);
    expect(world.renderers).toHaveLength(1);
    expect(rootOf(s.utils).classList.contains("is-open")).toBe(true);
    expect(screen.queryByText("맵을 불러오지 못했어요")).toBeNull();
  });

  it("렌더러를 만들 수 없으면 '열 수 없어요' 카드와 [나가기] — v1.0 고정 테이블로 몰래 대체하지 않는다", async () => {
    const world = makeWorld();
    world.createThreeRenderer.mockRejectedValue(new UnsupportedRendererError("no webgl"));
    const s = await open({ loadModules: world.loadModules });
    expect(screen.getByText("이 기기에서는 맵을 열 수 없어요")).toBeTruthy();
    expect(screen.getByText("다른 브라우저로 열어 주세요")).toBeTruthy();
    expect(s.utils.container.querySelector("canvas")).toBeNull();
    expect(s.utils.container.querySelector("[class*='mf-table']")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "나가기" }));
    expect(s.props.onLeave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
  });

  it("불러오는 중에 컨텍스트를 잃으면 불러오기 실패로 가고 렌더러를 정리한다", async () => {
    const s = await open({}, { ents: null });
    const r = s.world.renderers[0]!;
    act(() => r.emit({ t: "lost" }));
    expect(screen.getByText("맵을 불러오지 못했어요")).toBeTruthy();
    expect(r.disposed).toBe(1);
  });
});

describe("WebGL 컨텍스트 소실·복구 (MAP-05)", () => {
  it("소실하면 40% 가림막과 한 줄 카드가 뜨고 탭은 무시되며 이름표는 서버 위치를 계속 따라간다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    r.lost = true;
    act(() => r.emit({ t: "lost" }));
    expect(screen.getByText("화면을 다시 그리는 중…")).toBeTruthy();
    expect(rootOf(s.utils).classList.contains("is-redrawing")).toBe(true);
    const renders = r.renders;
    const before = tagOf(s.utils, 0)!.getAttribute("style");
    move(s.store, seg(0, [200, 100, 600, 100], Date.now(), 180));
    frames(600);
    expect(r.renders).toBe(renders); // GL 은 그리지 않는다
    expect(tagOf(s.utils, 0)!.getAttribute("style")).not.toBe(before);
    tapAt(surface(s.utils), 250, 340);
    expect(s.send).not.toHaveBeenCalled();
  });

  it("복구하면 가림막이 걷히고 다음 프레임에 모든 캐릭터가 positionOf 위치에 있다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    r.lost = true;
    act(() => r.emit({ t: "lost" }));
    move(s.store, seg(1, [-300, 50, -300, 450], Date.now(), 180));
    frames(1000);
    r.lost = false;
    act(() => r.emit({ t: "restored" }));
    expect(screen.queryByText("화면을 다시 그리는 중…")).toBeNull();
    expect(rootOf(s.utils).classList.contains("is-open")).toBe(true);
    const renders = r.renders;
    frame(16);
    expect(r.renders).toBeGreaterThan(renders);
    for (const seat of [0, 1]) {
      const pos = s.store.positionOf(seat, Date.now())!;
      const root = r.chars.get(seat)!.root;
      expect(root.position.x).toBeCloseTo(pos.x, 6);
      expect(root.position.z).toBeCloseTo(pos.z, 6);
    }
    // 복구 직후 카메라는 날아가지 않고 바로 붙는다
    expect(r.views.at(-1)!.target.x).toBeCloseTo(2, 6);
  });

  it("소실 3초 뒤 렌더러를 한 번 다시 만들고, 만들어지면 다시 열린다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    r.lost = true;
    act(() => r.emit({ t: "lost" }));
    frames(2900);
    expect(r.recreate).not.toHaveBeenCalled();
    frames(300);
    await flush();
    expect(r.recreate).toHaveBeenCalledTimes(1);
    frames(3000);
    expect(r.recreate).toHaveBeenCalledTimes(1);
    expect(rootOf(s.utils).classList.contains("is-open")).toBe(true);
    expect(screen.queryByText("화면을 다시 그리는 중…")).toBeNull();
  });

  it("소실 5초가 지나도 못 그리면 '다시 그리지 못했어요' 카드와 [새로 고침] 이고 누르면 reload 가 불린다", async () => {
    const reload = vi.fn();
    const s = await open({ reload });
    const r = s.world.renderers[0]!;
    r.recreate = vi.fn(() => new Promise<void>(() => {}));
    r.lost = true;
    act(() => r.emit({ t: "lost" }));
    frames(5100);
    expect(screen.getByText("화면을 다시 그리지 못했어요")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "새로 고침" }));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(r.recreate).toHaveBeenCalledTimes(1);
  });
});

describe("프레임 루프 예외 내성 (06 리뷰 WR-01)", () => {
  it("한 프레임에서 렌더러가 던져도 다음 프레임이 예약되고, 다음 프레임에서 그리기가 이어진다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    let boom = true;
    const draw = r.render.bind(r);
    r.render = () => {
      if (boom) {
        boom = false;
        throw new Error("render 실패");
      }
      draw();
    };
    const before = r.renders;
    frame();
    expect(rafCbs.size).toBe(1); // 던진 프레임 뒤에도 루프가 살아 있다
    expect(r.renders).toBe(before);
    frame();
    expect(r.renders).toBe(before + 1);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("연속으로 던져도 루프는 계속 돌고 오류 로그는 프레임마다 쏟아지지 않는다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    r.render = () => {
      throw new Error("항상 실패");
    };
    frames(480); // 약 30 프레임
    expect(rafCbs.size).toBe(1);
    expect(err.mock.calls.length).toBeGreaterThan(0);
    expect(err.mock.calls.length).toBeLessThan(5);
    err.mockRestore();
  });
});

describe("화면 숨김·복귀 (UI-SPEC 연결·복귀 상태)", () => {
  it("숨겨지면 그리기를 멈추고, 다시 보이면 한 프레임을 서버 위치로 맞춘다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    setVisibility("hidden");
    expect(rafCbs.size).toBe(0);
    move(s.store, seg(0, [200, 100, 600, 100], Date.now(), 180));
    const renders = r.renders;
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(r.renders).toBe(renders);
    setVisibility("visible");
    expect(rafCbs.size).toBe(1);
    frame(0);
    expect(r.renders).toBe(renders + 1);
    const pos = s.store.positionOf(0, Date.now())!;
    expect(r.chars.get(0)!.root.position.x).toBeCloseTo(pos.x, 6);
    // 숨어 있던 3초를 따라잡느라 걷지 않는다: 카메라는 서버 위치에 바로 붙는다
    expect(r.views.at(-1)!.target.x).toBeCloseTo(Math.min(PAN_BOX.maxX, pos.x), 6);
  });

  it("숨은 채 소실되면 숨은 시간은 세지 않는다: 오래 숨었다 돌아와도 곧바로 실패 카드가 되지 않고 돌아온 때부터 센다 (WR-02)", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    setVisibility("hidden");
    r.lost = true;
    act(() => r.emit({ t: "lost" }));
    act(() => {
      vi.advanceTimersByTime(20000); // 숨어 있는 20초 — 예전에는 3초에 재생성, 5초에 영구 실패
    });
    expect(r.recreate).not.toHaveBeenCalled();
    expect(screen.queryByText("화면을 다시 그리지 못했어요")).toBeNull();
    setVisibility("visible");
    expect(screen.getByText("화면을 다시 그리는 중…")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.queryByText("화면을 다시 그리지 못했어요")).toBeNull();
    expect(r.recreate).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2200); // 돌아온 뒤 3초 → 재생성 한 번
    });
    await flush();
    expect(r.recreate).toHaveBeenCalledTimes(1);
    expect(rootOf(s.utils).classList.contains("is-open")).toBe(true);
  });

  it("재생성 중에 숨었다 돌아와도 숨은 시간 때문에 영구 실패로 굳지 않는다 (WR-02)", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    r.recreate = vi.fn(() => new Promise<void>(() => {}));
    r.lost = true;
    act(() => r.emit({ t: "lost" }));
    frames(3200); // 재생성 시작
    expect(r.recreate).toHaveBeenCalledTimes(1);
    setVisibility("hidden");
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(screen.queryByText("화면을 다시 그리지 못했어요")).toBeNull();
    setVisibility("visible");
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.queryByText("화면을 다시 그리지 못했어요")).toBeNull();
    expect(r.recreate).toHaveBeenCalledTimes(1);
  });

  it("다시 보일 때 컨텍스트가 이미 소실돼 있으면 소실 경로로 들어간다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    setVisibility("hidden");
    r.lost = true;
    setVisibility("visible");
    expect(screen.getByText("화면을 다시 그리는 중…")).toBeTruthy();
  });
});

describe("나가는 가림막 (로비에서 맵으로 들어가고 나오기)", () => {
  it("exiting 이 되면 night-900 가림막을 켜고 420ms 뒤 렌더러를 정리하고 onExited 를 부른다", async () => {
    const onExited = vi.fn();
    const s = await open({ onExited });
    const r = s.world.renderers[0]!;
    s.rerender({ exiting: true });
    expect(rootOf(s.utils).classList.contains("is-exiting")).toBe(true);
    frames(400);
    expect(r.disposed).toBe(0);
    expect(onExited).not.toHaveBeenCalled();
    frames(40);
    expect(r.disposed).toBe(1);
    expect(onExited).toHaveBeenCalledTimes(1);
    frames(1000);
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  it("나가는 중에는 탭을 받지 않는다", async () => {
    const s = await open();
    s.rerender({ exiting: true });
    tapAt(surface(s.utils), 250, 340);
    expect(s.send).not.toHaveBeenCalled();
  });
});

describe("E2E 훅 (T-06-27)", () => {
  it("worldTestHooksEnabled: ?e2e=1 은 켜고 저장, 저장만 있으면 켜짐, ?e2e=0 은 끄고 지움, 아무것도 없으면 꺼짐, 개발 빌드는 켜짐", () => {
    const st = new MemoryStorage();
    expect(worldTestHooksEnabled("", st, false)).toBe(false);
    expect(worldTestHooksEnabled("?e2e=1", st, false)).toBe(true);
    expect(st.getItem(WORLD_TEST_KEY)).toBe("1");
    expect(worldTestHooksEnabled("", st, false)).toBe(true);
    expect(worldTestHooksEnabled("?e2e=0", st, false)).toBe(false);
    expect(st.getItem(WORLD_TEST_KEY)).toBeNull();
    expect(worldTestHooksEnabled("", st, false)).toBe(false);
    expect(worldTestHooksEnabled("", null, false)).toBe(false);
    expect(worldTestHooksEnabled("", st, true)).toBe(true);
  });

  it("개발 빌드(또는 ?e2e=1)에서는 window.__mfWorld 가 같은 시각 위치·투영·렌더러 정보를 준다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    const hooks = window.__mfWorld!;
    expect(hooks).toBeTruthy();
    const t = Date.now() + 500;
    expect(hooks.sample(0, t)).toEqual(s.store.positionOf(0, t));
    expect(hooks.screenOf(1, 2)).toEqual(r.project({ x: 1, y: 0, z: 2 }));
    expect(hooks.debug.info()).toEqual(r.info());
    expect(hooks.seats()).toEqual([0, 1]);
    expect(hooks.status()).toBe("ready");
    expect(typeof hooks.interactiveMs()).toBe("number");
    expect(hooks.ring()).toBeNull();
    tapAt(surface(s.utils), 250, 340);
    expect(hooks.ring()).toEqual({ x: 5, z: 4 });
    hooks.debug.loseContext();
    expect(r.debugLoseContext).toHaveBeenCalledTimes(1);
    hooks.debug.restoreContext();
    expect(r.debugRestoreContext).toHaveBeenCalledTimes(1);
    s.utils.unmount();
    expect(window.__mfWorld).toBeUndefined();
  });

  it("결정 0059: __mfWorld.shown(seat) 은 마지막 프레임에 그린 위치와 프레임 시각이고, sample 은 여전히 서버 구간 값이다", async () => {
    const s = await open();
    const hooks = window.__mfWorld!;
    const mine = s.world.renderers[0]!.chars.get(0)!;
    expect(hooks.shown(9)).toBeNull();
    tapAt(surface(s.utils), 250, 340);
    frame(16);
    const shown = hooks.shown(0)!;
    expect(shown).not.toBeNull();
    expect(shown.x).toBeCloseTo(mine.root.position.x, 6);
    expect(shown.z).toBeCloseTo(mine.root.position.z, 6);
    expect(shown.at).toBe(Date.now());
    // 서버 구간은 탭 직후에도 (2, 1) 에 서 있다 — sample 이 화면 위치로 바뀌지 않았다
    const sampled = hooks.sample(0)!;
    expect(sampled.x).toBeCloseTo(2, 6);
    expect(sampled.z).toBeCloseTo(1, 6);
    expect(Math.hypot(shown.x - sampled.x, shown.z - sampled.z)).toBeGreaterThan(0.01);
  });

  it("개발 빌드가 아니고 ?e2e=1 도 없으면 window.__mfWorld 가 없고 소프트웨어 렌더러를 허용하지 않는다", async () => {
    vi.stubEnv("DEV", false);
    const s = await open();
    expect(window.__mfWorld).toBeUndefined();
    expect(s.world.createThreeRenderer).toHaveBeenCalledWith(expect.objectContaining({ allowSoftware: false }));
  });

  it("훅이 켜진 때는 소프트웨어 렌더러를 허용한다(E2E 헤드리스)", async () => {
    const s = await open();
    expect(s.world.createThreeRenderer).toHaveBeenCalledWith(expect.objectContaining({ allowSoftware: true }));
  });

  it("installWorldTestHooks 가 돌려준 함수를 부르면 전역을 지운다", () => {
    const off = installWorldTestHooks(
      { sample: () => null, shown: () => null, ring: () => null, status: () => ({ status: "ready", lostAt: null }), interactiveMs: () => null, renderer: () => null },
      new WorldStore(),
    );
    expect(window.__mfWorld).toBeTruthy();
    expect(window.__mfWorld!.screenOf(0, 0)).toBeNull();
    off();
    expect(window.__mfWorld).toBeUndefined();
  });
});

// ---------- 카메라 맞춤: 새 연결·크기 변화 (MAP-03, UI-SPEC E4) ----------

describe("카메라: 날아가지 않고 붙는다, 크기 변화는 다시 맞춘다", () => {
  it("재접속(새 epoch 의 snap)한 첫 프레임에는 카메라가 새 서버 위치에 바로 붙는다", async () => {
    const s = await open();
    const r = s.world.renderers[0]!;
    // 내가 멀리 걸어가 카메라가 따라가는 중
    move(s.store, seg(0, [200, 100, 600, 100], Date.now(), 180));
    frames(300);
    const lagging = r.views.at(-1)!.target.x;
    expect(lagging).toBeLessThan(s.store.positionOf(0, Date.now())!.x + 1e-6);
    // 다시 연결: 새 epoch 의 snap 이 내 위치를 반대쪽 끝으로 준다
    snap(s.store, [seg(0, [-400, -300]), seg(1, [-300, 50])], 2);
    frame(16);
    expect(r.views.at(-1)!.target.x).toBeCloseTo(-4, 6);
    expect(r.views.at(-1)!.target.z).toBeCloseTo(-3, 6);
    // 등장 연출도 없다: 캐릭터 크기는 그대로 1
    expect(r.chars.get(0)!.root.scale.x).toBeCloseTo(0.83, 6);
  });

  it("크기가 바뀌면 150ms 디바운스 뒤 렌더러를 한 번 다시 재고, 카메라 중심은 180ms 에 걸쳐 새 스테이지 가운데로 간다", async () => {
    const s = await open({ stageInsets: { top: 62, bottom: 88 } });
    const r = s.world.renderers[0]!;
    const host = s.utils.container.querySelector<HTMLElement>(".mf-world__canvas")!;
    Object.defineProperty(host, "clientWidth", { configurable: true, value: 360 });
    Object.defineProperty(host, "clientHeight", { configurable: true, value: 640 });
    frame(16);
    expect(r.resize).not.toHaveBeenCalled();
    frame(60);
    expect(r.resize).not.toHaveBeenCalled();
    frames(120);
    expect(r.resize).toHaveBeenCalledTimes(1);
    expect(r.resize).toHaveBeenCalledWith(360, 640);
    frames(300);
    const settled = r.views.at(-1)!.offsetY;
    expect(settled).toBeCloseTo(stageOffsetY(640, 62, 640 - 88), 6);
    // 렌더러는 다시 만들지 않는다(크기 변화는 WebGL 재할당이라 끊김의 원인)
    expect(s.world.createThreeRenderer).toHaveBeenCalledTimes(1);
    // 한 프레임 만에 뛰지 않는다: 아래 패널이 자라면(7페이즈 채팅) 장면은 중간 값을 지나 새 가운데로 간다
    s.rerender({ stageInsets: { top: 62, bottom: 220 } });
    frame(16);
    frame(60);
    const mid = r.views.at(-1)!.offsetY;
    const to = stageOffsetY(640, 62, 640 - 220);
    expect(to).not.toBeCloseTo(settled, 3);
    expect(Math.abs(mid - settled)).toBeGreaterThan(0.01);
    expect(Math.abs(mid - to)).toBeGreaterThan(0.01);
    frames(300);
    expect(r.views.at(-1)!.offsetY).toBeCloseTo(to, 6);
  });

  it("모션 줄이기면 카메라는 감쇠 없이 내 캐릭터에 붙는다", async () => {
    stubReducedMotion(true);
    const s = await open();
    const r = s.world.renderers[0]!;
    move(s.store, seg(0, [200, 100, 600, 100], Date.now(), 180));
    frames(500);
    const pos = s.store.positionOf(0, Date.now())!;
    expect(r.views.at(-1)!.target.x).toBeCloseTo(pos.x, 6);
  });
});

// ---------- 게임 장면 (08-12) ----------

/** 장면 상태 도우미: seats 에 적은 좌석만 그린다(show). 나머지 칸은 기본값 — 따라가기·talk·긴장 0 */
const sceneOf = (seats: Record<number, Partial<Omit<SeatLook, "show">>>, over: Partial<SceneLook> = {}): SceneLook => ({
  camera: { mode: "follow" },
  lighting: "talk",
  tension: 0,
  seats: Object.fromEntries(Object.entries(seats).map(([k, v]) => [k, { show: true, ghost: false, ...v } as SeatLook])),
  ...over,
});

const FOUR = [player(0, "민지"), player(1, "철수"), player(2, "영희"), player(3, "바다")];
const FOUR_ENTS = (): WorldSeg[] => [seg(0, [200, 100]), seg(1, [-300, 50]), seg(2, [-100, 400]), seg(3, [400, -200])];

describe("게임 장면: 보임·유령 (GHOST-01)", () => {
  it("scene 이 없으면(로비) 모든 좌석의 캐릭터·이름표가 6페이즈 그대로 생긴다", async () => {
    const s = await open({}, { players: FOUR, ents: FOUR_ENTS() });
    expect([...s.world.renderers[0]!.chars.keys()].sort()).toEqual([0, 1, 2, 3]);
    for (const seat of [0, 1, 2, 3]) expect(tagOf(s.utils, seat)).not.toBeNull();
    for (const h of s.world.handles) expect(h.setGhost).not.toHaveBeenCalled();
  });

  it("scene 에 show 가 없는 좌석은 캐릭터를 만들지 않고 이름표 DOM 도 없다", async () => {
    const s = await open({ scene: sceneOf({ 0: {}, 1: {}, 2: {} }) }, { players: FOUR, ents: FOUR_ENTS() });
    const r = s.world.renderers[0]!;
    expect([...r.chars.keys()].sort()).toEqual([0, 1, 2]);
    expect(tagOf(s.utils, 3)).toBeNull();
    expect(s.utils.container.querySelectorAll(".mf-world__tags [data-seat]")).toHaveLength(3);
  });

  it("그리던 좌석이 scene 에서 빠지면 퇴장 연출 뒤 캐릭터가 지워지고 이름표가 바로 사라진다", async () => {
    const s = await open({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: {} }) }, { players: FOUR, ents: FOUR_ENTS() });
    const r = s.world.renderers[0]!;
    const h3 = r.chars.get(3) as FakeHandle;
    expect(tagOf(s.utils, 3)).not.toBeNull();
    s.rerender({ scene: sceneOf({ 0: {}, 1: {}, 2: {} }) });
    expect(tagOf(s.utils, 3)).toBeNull();
    frames(EXIT_MS * 2);
    expect(r.chars.has(3)).toBe(false);
    expect(h3.disposed).toBe(1);
    frames(200);
    expect(r.chars.has(3)).toBe(false); // 서버 구간이 남아 있어도 다시 만들지 않는다
  });

  it("scene 에 다시 들어오면 캐릭터가 새로 생긴다", async () => {
    const s = await open({ scene: sceneOf({ 0: {}, 1: {}, 2: {} }) }, { players: FOUR, ents: FOUR_ENTS() });
    const r = s.world.renderers[0]!;
    expect(r.chars.has(3)).toBe(false);
    s.rerender({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: {} }) });
    frame();
    expect(r.chars.has(3)).toBe(true);
    expect(tagOf(s.utils, 3)).not.toBeNull();
  });

  it("ghost 좌석은 setGhost(true) 를 부르고 이름표에 data-ghost 가 붙는다. 해제하면 setGhost(false)", async () => {
    const s = await open({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: { ghost: true } }) }, { players: FOUR, ents: FOUR_ENTS() });
    const r = s.world.renderers[0]!;
    const h3 = r.chars.get(3) as FakeHandle;
    const h2 = r.chars.get(2) as FakeHandle;
    expect(h3.setGhost).toHaveBeenCalledWith(true);
    expect(h3.setGhost).toHaveBeenCalledTimes(1);
    expect(h2.setGhost).not.toHaveBeenCalled();
    expect(tagOf(s.utils, 3)!.querySelector(".mv-head")!.getAttribute("data-ghost")).toBe("true");
    expect(tagOf(s.utils, 2)!.querySelector(".mv-head")!.hasAttribute("data-ghost")).toBe(false);
    frames(100);
    expect(h3.setGhost).toHaveBeenCalledTimes(1); // 프레임마다 다시 부르지 않는다
    s.rerender({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: {} }) });
    frame();
    expect(h3.setGhost).toHaveBeenLastCalledWith(false);
  });
});

// ---------- 10-04: 좌석별 의상 (D-6, AVTR-04, L33) ----------
describe("좌석별 의상 (D-6, L33)", () => {
  const lookPlayers = (looks: Partial<Record<number, OutfitId>>): PublicPlayer[] =>
    [0, 1, 2, 3].map((i) => player(i, `손님${i}`, looks[i] === undefined ? {} : { look: looks[i] }));
  const openLooks = (looks: Partial<Record<number, OutfitId>>, over: Partial<WorldStageProps> = {}) =>
    open({ view: makeView(lookPlayers(looks)), ...over }, { players: lookPlayers(looks), ents: FOUR_ENTS() });
  const handleOf = (s: Setup, seat: number): FakeHandle => s.world.renderers[0]!.chars.get(seat) as FakeHandle;

  it("만들 때 view.players[].look 으로 만든다(없으면 coat)", async () => {
    const s = await openLooks({ 1: "mafia" });
    expect(handleOf(s, 1).outfit).toBe("mafia");
    for (const seat of [0, 2, 3]) expect(handleOf(s, seat).outfit).toBe("coat");
  });

  it("view 의 look 이 바뀌면 그 좌석만 applyOutfit 한 번, 같은 look 으로 여러 번 맞춰도 늘지 않는다", async () => {
    const s = await openLooks({ 1: "mafia" });
    for (const h of s.world.handles) expect(h.applyOutfit).not.toHaveBeenCalled();
    s.rerender({ view: makeView(lookPlayers({ 1: "doctor" })) });
    frame();
    expect(handleOf(s, 1).applyOutfit).toHaveBeenCalledTimes(1);
    expect(handleOf(s, 1).applyOutfit).toHaveBeenCalledWith("doctor");
    // 좌석 1 의 look 이 mafia → doctor 로 바뀌었지만 좌석 2 는 그대로 coat
    expect(handleOf(s, 2).applyOutfit).not.toHaveBeenCalled();
    s.rerender({ view: makeView(lookPlayers({ 1: "doctor" })) });
    s.rerender({ view: makeView(lookPlayers({ 1: "doctor" })) });
    frames(50);
    expect(handleOf(s, 1).applyOutfit).toHaveBeenCalledTimes(1);
    // look 이 사라지면(키 없음) coat 로 읽는다
    s.rerender({ view: makeView(lookPlayers({})) });
    expect(handleOf(s, 1).applyOutfit).toHaveBeenLastCalledWith("coat");
    expect(handleOf(s, 1).applyOutfit).toHaveBeenCalledTimes(2);
  });

  it("window.__mfLooks 는 그리는 모든 좌석의 고른 의상 표이고 look 이 바뀌면 갱신되며 DOM 속성이 아니다", async () => {
    const s = await openLooks({ 1: "mafia" });
    expect(window.__mfLooks).toEqual({ 0: "coat", 1: "mafia", 2: "coat", 3: "coat" });
    s.rerender({ view: makeView(lookPlayers({ 1: "doctor" })) });
    expect(window.__mfLooks).toEqual({ 0: "coat", 1: "doctor", 2: "coat", 3: "coat" });
    expect(s.utils.container.querySelectorAll("[data-look], [data-looks], [data-outfit]")).toHaveLength(0);
    s.utils.unmount();
    expect(window.__mfLooks).toBeUndefined();
  });

  it("훅이 꺼진 문맥에는 window.__mfLooks 가 없다", async () => {
    vi.stubEnv("DEV", false);
    await openLooks({ 1: "mafia" });
    expect(window.__mfLooks).toBeUndefined();
  });
});

// ---------- 10-04: 유령 안개가 고른 의상을 덮고 끝나면 돌려준다 (D-7, L32) ----------
describe("유령 직업 의상 안개 우선·복원 (D-7, L32)", () => {
  const playersWith = (looks: Partial<Record<number, OutfitId>>): PublicPlayer[] =>
    [0, 1, 2, 3].map((i) => player(i, `손님${i}`, looks[i] === undefined ? {} : { look: looks[i] }));
  const viewWith = (looks: Partial<Record<number, OutfitId>>) => makeView(playersWith(looks));
  const ALIVE = { 0: {}, 1: {}, 2: {}, 3: {} };
  const outfitCalls = (h: FakeHandle): unknown[] => vi.mocked(h.applyOutfit!).mock.calls.map((c) => c[0]);
  const handleOf = (s: Setup, seat: number): FakeHandle => s.world.renderers[0]!.chars.get(seat) as FakeHandle;
  const openWith = (looks: Partial<Record<number, OutfitId>>, seats: Parameters<typeof sceneOf>[0]) =>
    open({ view: viewWith(looks), scene: sceneOf(seats) }, { players: playersWith(looks), ents: FOUR_ENTS() });

  it("안개 의상이 고른 의상을 덮어쓰고(고른 look 은 hood), 안개가 끝나면 setGhost(false) 다음 고른 의상으로 돌아온다", async () => {
    const s = await openWith({ 3: "hood" }, { ...ALIVE, 3: { ghost: true, outfit: "police" } });
    const h3 = handleOf(s, 3);
    expect(h3.outfit).toBe("hood");
    expect(outfitCalls(h3)).toEqual(["police"]);
    frames(100);
    expect(outfitCalls(h3)).toEqual(["police"]);
    s.rerender({ scene: sceneOf(ALIVE) });
    frame();
    expect(outfitCalls(h3)).toEqual(["police", "hood"]);
    expect(vi.mocked(h3.setGhost!).mock.lastCall).toEqual([false]);
    // setGhost(false) 가 먼저, 그다음 고른 의상 복원
    const lastGhost = Math.max(...vi.mocked(h3.setGhost!).mock.invocationCallOrder);
    const lastOutfit = Math.max(...vi.mocked(h3.applyOutfit!).mock.invocationCallOrder);
    expect(lastOutfit).toBeGreaterThan(lastGhost);
    frames(100);
    expect(outfitCalls(h3)).toEqual(["police", "hood"]);
  });

  it("안개 중에 view 의 look 이 바뀌어도 안개 의상을 건드리지 않고, 안개가 끝나면 최신 look 으로 돌아온다", async () => {
    const s = await openWith({ 3: "hood" }, { ...ALIVE, 3: { ghost: true, outfit: "police" } });
    const h3 = handleOf(s, 3);
    s.rerender({ view: viewWith({ 3: "doctor" }) });
    frame();
    expect(outfitCalls(h3)).toEqual(["police"]);
    expect(window.__mfLooks![3]).toBe("doctor"); // 고른 의상 표는 안개와 무관하다
    s.rerender({ scene: sceneOf(ALIVE) });
    frame();
    expect(outfitCalls(h3)).toEqual(["police", "doctor"]);
  });

  it("산 사람 화면(장면 표에 outfit 없음): 어떤 좌석에도 직업 의상이 적용되지 않고 처형 연출 동안 고른 의상 그대로 사라진다", async () => {
    const s = await openWith({ 3: "mafia" }, { ...ALIVE, 3: { fadeAt: Date.now() } });
    frames(GHOST_FADE_END_MS - 50);
    const h3 = handleOf(s, 3);
    expect(h3.outfit).toBe("mafia");
    for (const h of s.world.handles) expect(h.applyOutfit).not.toHaveBeenCalled();
    expect(window.__mfGhostOutfits ?? {}).toEqual({});
  });

  it("outfit 없는 유령(spectate 없음)은 고른 의상 그대로 setGhost(true) 만 된다", async () => {
    const s = await openWith({ 3: "mafia" }, { ...ALIVE, 3: { ghost: true } });
    const h3 = handleOf(s, 3);
    expect(h3.outfit).toBe("mafia");
    expect(h3.applyOutfit).not.toHaveBeenCalled();
  });

  describe("의상이 바뀐 뒤 표정 prewarm 을 다시 건다", () => {
    let queue: { id: number; cb: () => void }[];
    const installIdle = (): void => {
      queue = [];
      let n = 0;
      vi.stubGlobal("requestIdleCallback", (cb: () => void) => {
        queue.push({ id: ++n, cb });
        return n;
      });
      vi.stubGlobal("cancelIdleCallback", (id: number) => {
        queue = queue.filter((q) => q.id !== id);
      });
    };
    const drain = (): void => {
      let guard = 0;
      while (queue.length > 0 && guard++ < 200) queue.shift()!.cb();
    };

    it("고른 look 이 바뀐 좌석만 prewarm 5 개를 다시 받는다", async () => {
      installIdle();
      const s = await openWith({}, ALIVE);
      frames(32);
      drain();
      for (const h of s.world.handles) expect(h.prewarm).toHaveBeenCalledTimes(5);
      s.rerender({ view: viewWith({ 2: "doctor" }) });
      expect(queue.length).toBe(1); // 좌석 2 의 첫 작업 하나
      drain();
      expect(handleOf(s, 2).prewarm).toHaveBeenCalledTimes(10);
      for (const seat of [0, 1, 3]) expect(handleOf(s, seat).prewarm).toHaveBeenCalledTimes(5);
    });

    it("안개가 끝나 고른 의상으로 돌아올 때도 다시 건다", async () => {
      installIdle();
      const s = await openWith({ 3: "hood" }, { ...ALIVE, 3: { ghost: true, outfit: "police" } });
      frames(32);
      drain();
      const h3 = handleOf(s, 3);
      const before = vi.mocked(h3.prewarm!).mock.calls.length;
      s.rerender({ scene: sceneOf(ALIVE) });
      frame();
      drain();
      expect(vi.mocked(h3.prewarm!).mock.calls.length).toBe(before + 5);
    });
  });
});

// ---------- 09.1-09: 유령 직업 의상 + 안개 (UI-SPEC B-1·B-3, L13) ----------
describe("유령 직업 의상 안개 (09.1-09)", () => {
  const MIST_GLOW = { color: "#d8e4ff", intensity: 0.85 };
  const calls = (h: FakeHandle) => [
    ...(h.applyOutfit as ReturnType<typeof vi.fn>).mock.invocationCallOrder.map((o, i) => ({ o, name: "applyOutfit", args: (h.applyOutfit as ReturnType<typeof vi.fn>).mock.calls[i] })),
    ...(h.setGhost as ReturnType<typeof vi.fn>).mock.invocationCallOrder.map((o, i) => ({ o, name: "setGhost", args: (h.setGhost as ReturnType<typeof vi.fn>).mock.calls[i] })),
  ].sort((a, b) => a.o - b.o);

  it("ghost + outfit 좌석: 같은 프레임에 applyOutfit(직업 의상) 다음 setGhost(true, 0.26, 발광) 이 한 번씩", async () => {
    const s = await open({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: { ghost: true, outfit: "mafia" } }) }, { players: FOUR, ents: FOUR_ENTS() });
    const h3 = s.world.renderers[0]!.chars.get(3) as FakeHandle;
    expect(calls(h3).map((c) => c.name)).toEqual(["applyOutfit", "setGhost"]);
    expect(h3.applyOutfit).toHaveBeenCalledWith("mafia");
    expect(h3.setGhost).toHaveBeenCalledWith(true, 0.26, MIST_GLOW);
    frames(100);
    expect(h3.applyOutfit).toHaveBeenCalledTimes(1); // 바뀔 때만
    expect(h3.setGhost).toHaveBeenCalledTimes(1);
    // 산 좌석은 아무것도 받지 않는다
    for (const seat of [0, 1, 2]) {
      const h = s.world.renderers[0]!.chars.get(seat) as FakeHandle;
      expect(h.applyOutfit).not.toHaveBeenCalled();
      expect(h.setGhost).not.toHaveBeenCalled();
    }
  });

  it("의상이 바뀌면(드문 경우) 한 번 더 applyOutfit, 같은 의상이면 다시 부르지 않는다", async () => {
    const s = await open({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: { ghost: true, outfit: "police" } }) }, { players: FOUR, ents: FOUR_ENTS() });
    const h3 = s.world.renderers[0]!.chars.get(3) as FakeHandle;
    s.rerender({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: { ghost: true, outfit: "police" } }) });
    frame();
    expect(h3.applyOutfit).toHaveBeenCalledTimes(1);
    s.rerender({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: { ghost: true, outfit: "doctor" } }) });
    frame();
    expect(h3.applyOutfit).toHaveBeenLastCalledWith("doctor");
  });

  it("유령 좌석의 불투명도 유지값은 안개 0.26(처형 연출의 0.6 이 아니다) — 연출이 없는 프레임에 setOpacity 를 덮어쓰지 않는다", async () => {
    const s = await open({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: { ghost: true, outfit: "coat" } }) }, { players: FOUR, ents: FOUR_ENTS() });
    const h3 = s.world.renderers[0]!.chars.get(3) as FakeHandle;
    frames(100);
    for (const c of (h3.setOpacity as ReturnType<typeof vi.fn>).mock.calls) expect(c[0]).not.toBe(0.6);
  });

  it("산 사람 화면(outfit 없음): applyOutfit 호출 0, 처형 연출은 기본 코트에서 0.6 → 0 으로 그대로 (T-09.1-24)", async () => {
    const s = await open({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: { fadeAt: Date.now() } }) }, { players: FOUR, ents: FOUR_ENTS() });
    frames(GHOST_FADE_END_MS - 50);
    for (const h of s.world.handles) {
      expect(h.applyOutfit).not.toHaveBeenCalled();
      expect(h.setGhost).not.toHaveBeenCalled();
    }
  });

  it("ghost 이지만 outfit 이 없으면(spectate 없는 유령) 지금처럼 setGhost(true) 만 — 의상 호출 없음", async () => {
    const s = await open({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: { ghost: true } }) }, { players: FOUR, ents: FOUR_ENTS() });
    const h3 = s.world.renderers[0]!.chars.get(3) as FakeHandle;
    expect(h3.applyOutfit).not.toHaveBeenCalled();
    expect(h3.setGhost).toHaveBeenCalledWith(true);
  });
});

describe("E2E 훅 window.__mfGhostOutfits (09.1-09, T-09.1-23)", () => {
  it("유령 의상이 입혀지면 좌석 → 의상 id 표가 생기고, 산 사람 장면에서는 빈 표이며, 언마운트 때 지워진다", async () => {
    const s = await open({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: { ghost: true, outfit: "doctor" } }) }, { players: FOUR, ents: FOUR_ENTS() });
    expect(window.__mfGhostOutfits).toEqual({ 3: "doctor" });
    s.rerender({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: { ghost: true, outfit: "doctor" }, }) });
    frames(50);
    expect(window.__mfGhostOutfits).toEqual({ 3: "doctor" });
    s.utils.unmount();
    expect(window.__mfGhostOutfits).toBeUndefined();
  });

  it("산 사람 화면: 표는 없거나 비어 있고 DOM 에 [data-ghost-outfit] 은 없다", async () => {
    const s = await open({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: {} }) }, { players: FOUR, ents: FOUR_ENTS() });
    expect(window.__mfGhostOutfits ?? {}).toEqual({});
    expect(s.utils.container.querySelectorAll("[data-ghost-outfit]")).toHaveLength(0);
  });

  it("WorldStage 소스는 의상을 DOM 속성으로 싣지 않는다", () => {
    expect(readFileSync("src/components/WorldStage.tsx", "utf8")).not.toContain("data-ghost-outfit");
    expect(readFileSync("src/components/v2/HeadStack.tsx", "utf8")).not.toContain("data-ghost-outfit");
  });

  it("다른 설치가 덮어썼으면 언마운트가 지우지 않는다", async () => {
    const s = await open({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: { ghost: true, outfit: "mafia" } }) }, { players: FOUR, ents: FOUR_ENTS() });
    const other = { 9: "coat" };
    window.__mfGhostOutfits = other;
    s.utils.unmount();
    expect(window.__mfGhostOutfits).toBe(other);
    delete window.__mfGhostOutfits;
  });
});

describe("E2E 훅 window.__mfPin (09.1.1-11, T-09.1.1-31)", () => {
  const pinScene = (pin: SceneLook["pin"]) => sceneOf({ 0: {}, 1: {}, 2: {}, 3: {} }, { pin });
  const openPin = (pin: SceneLook["pin"] = null) => open({ scene: pinScene(pin) }, { players: FOUR, ents: FOUR_ENTS() });

  it("훅이 켜진 문맥: 처음엔 꺼짐 상태, 차례가 시작되면 seat 와 strength 가 오르고, 사라지면 seat null · strength 0, 언마운트 때 지워진다", async () => {
    const s = await openPin();
    frames(32);
    expect(window.__mfPin).toEqual({ seat: null, moving: false, strength: 0, zoom: 1 });
    s.rerender({ scene: pinScene({ mode: "turn", seat: 2 }) });
    frames(100);
    expect(window.__mfPin!.seat).toBe(2);
    expect(window.__mfPin!.moving).toBe(false);
    expect(window.__mfPin!.strength).toBeGreaterThan(0.3);
    frames(300);
    expect(window.__mfPin!.strength).toBeCloseTo(1, 6);
    s.rerender({ scene: pinScene(null) });
    frames(600);
    expect(window.__mfPin).toEqual({ seat: null, moving: false, strength: 0, zoom: 1 });
    s.utils.unmount();
    expect(window.__mfPin).toBeUndefined();
  });

  it("zoom: 카메라 줌을 소수 셋째 자리로 싣는다(처음 1, 느린 확대 뒤 1.1, 돌아오면 1)", async () => {
    const s = await openPin();
    frames(32);
    expect(window.__mfPin!.zoom).toBe(1);
    const cam = (zoom: number): SceneLook["camera"] => ({ mode: "fixed", target: { x: 0, z: 0 }, zoom, zoomMs: 600 });
    s.rerender({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: {} }, { camera: cam(1.1) }) });
    frames(300);
    expect(window.__mfPin!.zoom).toBeGreaterThan(1.03);
    expect(window.__mfPin!.zoom).toBeLessThan(1.07);
    frames(500);
    expect(window.__mfPin!.zoom).toBe(1.1);
    s.rerender({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: {} }, { camera: cam(1) }) });
    frames(800);
    expect(window.__mfPin!.zoom).toBe(1);
  });

  it("slide: 이동 중에는 moving 이 참, 진행 0.5 이후 seat 가 지목받은 사람, 끝나면 moving 거짓", async () => {
    const s = await openPin({ mode: "turn", seat: 1 });
    frames(400);
    expect(window.__mfPin!.seat).toBe(1);
    s.rerender({ scene: pinScene({ mode: "slide", from: 1, to: 3, startAt: Date.now(), durationMs: 900 }) });
    frames(200);
    expect(window.__mfPin).toMatchObject({ seat: 1, moving: true });
    frames(300);
    expect(window.__mfPin).toMatchObject({ seat: 3, moving: true });
    frames(500);
    expect(window.__mfPin).toMatchObject({ seat: 3, moving: false });
  });

  it("대상 좌석의 캐릭터가 없으면 seat 는 null (핀이 꺼진다)", async () => {
    const s = await openPin();
    s.rerender({ scene: pinScene({ mode: "turn", seat: 7 }) });
    frames(300);
    expect(window.__mfPin).toEqual({ seat: null, moving: false, strength: 0, zoom: 1 });
  });

  it("훅이 꺼진 문맥(?e2e=0)에서는 객체 자체가 없다", async () => {
    const before = window.location.href;
    window.history.replaceState({}, "", "/?e2e=0");
    try {
      const s = await openPin({ mode: "turn", seat: 2 });
      frames(300);
      expect(window.__mfPin).toBeUndefined();
      expect(s.world.renderers[0]!.setPin).toHaveBeenCalled(); // 핀 조명 자체는 제품에서도 그려진다
    } finally {
      window.history.replaceState({}, "", before);
    }
  });

  it("다른 설치가 덮어썼으면 언마운트가 지우지 않는다", async () => {
    const s = await openPin();
    const other = { seat: 9, moving: false, strength: 0, zoom: 1 };
    window.__mfPin = other;
    s.utils.unmount();
    expect(window.__mfPin).toBe(other);
    delete window.__mfPin;
  });
});

describe("게임 장면(08-12): 카메라·조명·긴장·떠다님·처형 연출·지목 자세", () => {
  const INSETS = { top: 62, bottom: 250 };
  const FIXED = (zoom = 1): SceneLook["camera"] => ({ mode: "fixed", target: { x: 0, z: 0 }, zoom });
  const ALL = { 0: {}, 1: {}, 2: {}, 3: {} };
  const openGame = (over: Partial<WorldStageProps> = {}) => open({ stageInsets: INSETS, scene: sceneOf(ALL), ...over }, { players: FOUR, ents: FOUR_ENTS() });
  /** 이 시험 환경의 고정 구도 목표 */
  const gatherGoal = (zoom = 1) => gatherView({ top: INSETS.top, bottom: window.innerHeight - INSETS.bottom }, { w: window.innerWidth, h: window.innerHeight }, { zoom });
  const yOf = (s: Setup, seat: number): number => s.world.renderers[0]!.chars.get(seat)!.root.position.y;

  describe("카메라", () => {
    it("fixed 는 800ms 에 걸쳐 모이는 자리 구도로 옮기고 그 뒤 내 캐릭터가 걸어도 움직이지 않는다", async () => {
      const s = await openGame();
      const r = s.world.renderers[0]!;
      const start = r.views.at(-1)!;
      expect(start.target.x).toBeCloseTo(2, 6); // 따라가기: 내 캐릭터
      s.rerender({ scene: sceneOf(ALL, { camera: FIXED() }) });
      frames(400);
      const mid = r.views.at(-1)!;
      const goal = gatherGoal();
      expect(mid.target.x).toBeLessThan(start.target.x - 0.05); // 가는 중
      expect(mid.target.x).toBeGreaterThan(goal.target.x + 0.01);
      frames(500);
      const done = r.views.at(-1)!;
      expect(done.target.x).toBeCloseTo(goal.target.x, 2);
      expect(done.target.z).toBeCloseTo(goal.target.z, 2);
      expect(done.offsetY).toBeCloseTo(goal.offsetY, 1);
      move(s.store, seg(0, [200, 100, 600, 100], Date.now(), 180));
      frames(600);
      expect(r.views.at(-1)!.target.x).toBeCloseTo(goal.target.x, 6);
      expect(r.views.at(-1)!.target.z).toBeCloseTo(goal.target.z, 6);
    });

    it("zoom 은 같은 800ms 에 1 → 1.08 로 setZoom 한다", async () => {
      const s = await openGame();
      const r = s.world.renderers[0]!;
      s.rerender({ scene: sceneOf(ALL, { camera: FIXED(ZOOM_MAJORITY) }) });
      frames(400);
      const mid = r.setZoom.mock.calls.at(-1)![0] as number;
      expect(mid).toBeGreaterThan(1.001);
      expect(mid).toBeLessThan(ZOOM_MAJORITY - 0.001);
      frames(500);
      expect(r.setZoom.mock.calls.at(-1)![0]).toBeCloseTo(ZOOM_MAJORITY, 6);
      const calls = r.setZoom.mock.calls.length;
      frames(300);
      expect(r.setZoom.mock.calls.length).toBe(calls); // 값이 같으면 다시 부르지 않는다
      const goal = gatherGoal(ZOOM_MAJORITY);
      expect(r.views.at(-1)!.offsetY).toBeCloseTo(goal.offsetY, 1);
    });

    // 09.1.1-13(O-15): zoomMs 가 있는 고정 구도는 그 시간에 ease-in-out 으로 줌한다(위치·세로 오프셋도 같은 진행)
    const SLOW = (zoom: number): SceneLook["camera"] => ({ mode: "fixed", target: { x: 0, z: 0 }, zoom, zoomMs: 600 });
    it("zoomMs 600: 1 → 1.10 이 ease-in-out — 300ms 에 중점, 600ms 에 1.10, 끝나면 다시 부르지 않는다", async () => {
      const s = await openGame();
      const r = s.world.renderers[0]!;
      s.rerender({ scene: sceneOf(ALL, { camera: FIXED() }) });
      frames(1000);
      s.rerender({ scene: sceneOf(ALL, { camera: SLOW(1.1) }) });
      frames(300);
      expect(r.setZoom.mock.calls.at(-1)![0]).toBeCloseTo(1.05, 2);
      frames(100);
      const near = r.setZoom.mock.calls.at(-1)![0] as number;
      expect(near).toBeGreaterThan(1.05);
      expect(near).toBeLessThan(1.1);
      frames(250);
      expect(r.setZoom.mock.calls.at(-1)![0]).toBeCloseTo(1.1, 6);
      const calls = r.setZoom.mock.calls.length;
      frames(300);
      expect(r.setZoom.mock.calls.length).toBe(calls);
    });

    it("zoomMs 600: 1.10 → 1 로 돌아올 때도 같은 시간(300ms 에 1.05)", async () => {
      const s = await openGame();
      const r = s.world.renderers[0]!;
      s.rerender({ scene: sceneOf(ALL, { camera: SLOW(1.1) }) });
      frames(1500);
      expect(r.setZoom.mock.calls.at(-1)![0]).toBeCloseTo(1.1, 6);
      s.rerender({ scene: sceneOf(ALL, { camera: SLOW(1) }) });
      frames(300);
      expect(r.setZoom.mock.calls.at(-1)![0]).toBeCloseTo(1.05, 2);
      frames(350);
      expect(r.setZoom.mock.calls.at(-1)![0]).toBeCloseTo(1, 6);
    });

    it("첫 장면(재접속·새로 고침)이 이미 1.10 이면 애니메이션 없이 곧바로 1.10", async () => {
      const s = await openGame({ scene: sceneOf(ALL, { camera: SLOW(1.1) }) });
      const r = s.world.renderers[0]!;
      frames(300);
      expect(r.setZoom.mock.calls.at(-1)![0]).toBeCloseTo(1.1, 6); // 첫 프레임 뒤 1 로 되돌아가 다시 다가오지 않는다
      expect(r.setZoom.mock.calls.every((c) => c[0] === 1.1)).toBe(true);
    });

    it("모션 줄이기: zoomMs 장면도 줌하지 않는다(1 유지)", async () => {
      stubReducedMotion(true);
      const s = await openGame();
      const r = s.world.renderers[0]!;
      s.rerender({ scene: sceneOf(ALL, { camera: SLOW(1.1) }) });
      frames(800);
      expect(r.setZoom.mock.calls.every((c) => c[0] === 1)).toBe(true);
    });

    it("높이 360 미만 스테이지: sceneLook 이 줌 없는 카메라를 주므로 렌더러는 1.10 을 받지 않는다", async () => {
      const s = await openGame();
      const r = s.world.renderers[0]!;
      const small = cameraModeOf({ phase: "execution" } as RoomView, 359, { verdictZoom: 1.1 });
      s.rerender({ scene: sceneOf(ALL, { camera: small }) });
      frames(1000);
      expect(r.setZoom.mock.calls.every((c) => (c[0] as number) <= 1.0001)).toBe(true);
    });

    it("모션 줄이기면 구도와 확대가 첫 프레임에 바로 바뀐다", async () => {
      stubReducedMotion(true);
      const s = await openGame();
      const r = s.world.renderers[0]!;
      s.rerender({ scene: sceneOf(ALL, { camera: FIXED(ZOOM_MAJORITY) }) });
      frame(16);
      const goal = gatherGoal(ZOOM_MAJORITY);
      expect(r.views.at(-1)!.target.x).toBeCloseTo(goal.target.x, 6);
      expect(r.views.at(-1)!.offsetY).toBeCloseTo(goal.offsetY, 6);
      expect(r.setZoom.mock.calls.at(-1)![0]).toBeCloseTo(ZOOM_MAJORITY, 6);
    });

    it("follow 로 돌아오면 내 캐릭터를 다시 따라가고 확대가 1 로 돌아온다", async () => {
      const s = await openGame();
      const r = s.world.renderers[0]!;
      s.rerender({ scene: sceneOf(ALL, { camera: FIXED(ZOOM_MAJORITY) }) });
      frames(1000);
      s.rerender({ scene: sceneOf(ALL) });
      frames(1500);
      expect(r.views.at(-1)!.target.x).toBeCloseTo(2, 2);
      expect(r.views.at(-1)!.target.z).toBeCloseTo(1, 2);
      expect(r.setZoom.mock.calls.at(-1)![0]).toBeCloseTo(1, 6);
      expect(r.views.at(-1)!.offsetY).toBeCloseTo(stageOffsetY(window.innerHeight, INSETS.top, window.innerHeight - INSETS.bottom), 1);
    });
  });

  describe("조명·긴장", () => {
    it("lighting 이 바뀌면 setLighting 을 한 번 부르고 같은 값이면 다시 부르지 않는다", async () => {
      const s = await openGame();
      const r = s.world.renderers[0]!;
      expect(r.setLighting.mock.calls).toEqual([["talk"]]);
      s.rerender({ scene: sceneOf(ALL, { lighting: "trial" }) });
      frames(100);
      s.rerender({ scene: sceneOf(ALL, { lighting: "trial" }) });
      frames(100);
      expect(r.setLighting.mock.calls).toEqual([["talk"], ["trial"]]);
    });

    it("tension 1 + focusSeat 2 면 그 좌석 위치로 setTension, 0 으로 돌아오면 setTension(0)", async () => {
      const s = await openGame();
      const r = s.world.renderers[0]!;
      expect(r.setTension).not.toHaveBeenCalled();
      s.rerender({ scene: sceneOf(ALL, { tension: 1, focusSeat: 2 }) });
      frames(100);
      const [level, at] = r.setTension.mock.calls.at(-1)! as [number, { x: number; z: number }];
      expect(level).toBe(1);
      expect(at.x).toBeCloseTo(-1, 6);
      expect(at.z).toBeCloseTo(4, 6);
      const n = r.setTension.mock.calls.length;
      frames(200);
      expect(r.setTension.mock.calls.length).toBe(n);
      s.rerender({ scene: sceneOf(ALL) });
      frames(50);
      expect(r.setTension.mock.calls.at(-1)![0]).toBe(0);
    });
  });

  describe("핀 조명 (결정 0066-6, 09.1.1-11)", () => {
    // 좌석 2 는 (-1,4), 좌석 1 은 (-3,0.5): 5 번 줄(FOUR_ENTS 와 같은 좌표)
    const turnScene = (seat: number) => sceneOf(ALL, { pin: { mode: "turn", seat } });

    it("차례 핀: 처음엔 부르지 않고, 켜지면 그 좌석 위치로 세기가 180ms 에 걸쳐 0.9 까지, 실내등은 0.6 까지", async () => {
      const s = await openGame();
      const r = s.world.renderers[0]!;
      expect(r.setPin).not.toHaveBeenCalled();
      s.rerender({ scene: turnScene(2) });
      frames(40);
      const first = r.setPin.mock.calls.at(-1)!;
      expect(first[0]).not.toBeNull();
      expect(first[0]!.x).toBeCloseTo(-1, 6);
      expect(first[0]!.z).toBeCloseTo(4, 6);
      expect(first[0]!.strength).toBeGreaterThan(0);
      expect(first[0]!.strength).toBeLessThan(0.9);
      frames(300);
      const full = r.setPin.mock.calls.at(-1)!;
      expect(full[0]!.strength).toBeCloseTo(0.9, 6);
      expect(full[1]).toBeCloseTo(0.6, 6);
      const n = r.setPin.mock.calls.length;
      frames(300);
      expect(r.setPin.mock.calls.length).toBe(n); // 값이 안 바뀌면 다시 부르지 않는다
    });

    it("pin 이 사라지면 420ms 에 걸쳐 꺼지고 setPin(null, 1) 로 끝난다, 그 뒤엔 부르지 않는다", async () => {
      const s = await openGame();
      const r = s.world.renderers[0]!;
      s.rerender({ scene: turnScene(2) });
      frames(400);
      s.rerender({ scene: sceneOf(ALL) });
      frames(200);
      const mid = r.setPin.mock.calls.at(-1)!;
      expect(mid[0]).not.toBeNull();
      expect(mid[0]!.strength).toBeGreaterThan(0);
      expect(mid[0]!.strength).toBeLessThan(0.9);
      frames(400);
      expect(r.setPin.mock.calls.at(-1)).toEqual([null, 1]);
      const n = r.setPin.mock.calls.length;
      frames(300);
      expect(r.setPin.mock.calls.length).toBe(n);
    });

    it("slide 핀: 도착까지 from → to 위치를 ease 로 지나간다 (끝 위치는 to 좌석)", async () => {
      const s = await openGame();
      const r = s.world.renderers[0]!;
      s.rerender({ scene: turnScene(1) });
      frames(400);
      const start = Date.now();
      s.rerender({ scene: sceneOf(ALL, { pin: { mode: "slide", from: 1, to: 2, startAt: start, durationMs: 900 } }) });
      frames(450);
      const mid = r.setPin.mock.calls.at(-1)![0]!;
      const x1 = -3;
      const x2 = -1;
      expect(mid.x).toBeGreaterThan(x1);
      expect(mid.x).toBeLessThan(x2);
      frames(600);
      const end = r.setPin.mock.calls.at(-1)![0]!;
      expect(end.x).toBeCloseTo(x2, 2); // 값은 소수 둘째 자리 단위로 바뀔 때만 보낸다
      expect(end.z).toBeCloseTo(4, 2);
    });

    it("모션 줄이기: 이동 없이 대상 위치로 즉시, 세기도 즉시 0.9", async () => {
      stubReducedMotion(true);
      const s = await openGame();
      const r = s.world.renderers[0]!;
      s.rerender({ scene: sceneOf(ALL, { pin: { mode: "slide", from: 1, to: 2, startAt: Date.now(), durationMs: 900 } }) });
      frames(32);
      const call = r.setPin.mock.calls.at(-1)!;
      expect(call[0]!.x).toBeCloseTo(-1, 6);
      expect(call[0]!.strength).toBeCloseTo(0.9, 6);
      expect(call[1]).toBeCloseTo(0.6, 6);
    });

    it("대상 좌석의 캐릭터가 없으면 핀을 켜지 않는다 (예외 없음)", async () => {
      const s = await openGame();
      const r = s.world.renderers[0]!;
      s.rerender({ scene: sceneOf(ALL, { pin: { mode: "turn", seat: 7 } }) });
      frames(500);
      expect(r.setPin).not.toHaveBeenCalled();
    });

    it("다음 차례로 건너뛰면(다른 좌석) 세기를 0 에서 다시 켠다", async () => {
      const s = await openGame();
      const r = s.world.renderers[0]!;
      s.rerender({ scene: turnScene(1) });
      frames(500);
      s.rerender({ scene: turnScene(2) });
      frames(16);
      const call = r.setPin.mock.calls.at(-1)![0]!;
      expect(call.x).toBeCloseTo(-1, 6);
      expect(call.strength).toBeLessThan(0.45);
      frames(300);
      expect(r.setPin.mock.calls.at(-1)![0]!.strength).toBeCloseTo(0.9, 6);
    });
  });

  describe("분필 (MORN-01, E5 #28·#29)", () => {
    it("scene.chalk 가 있으면 이름표 층 루트에 data-chalk=\"x,z\"(소수 둘째 자리), 없으면 속성이 없다", async () => {
      const s = await openGame({ scene: sceneOf(ALL, { chalk: { x: 1.2, z: -3.4 } }) });
      const tags = s.utils.container.querySelector(".mf-world__tags")!;
      expect(tags.getAttribute("data-chalk")).toBe("1.20,-3.40");
      s.rerender({ scene: sceneOf(ALL) });
      expect(tags.hasAttribute("data-chalk")).toBe(false);
    });

    it("처음 장면(재접속)부터 chalk 가 있으면 첫 프레임에 setChalk(자리, 0.85). 없어지면 setChalk(null)", async () => {
      const s = await openGame({ scene: sceneOf(ALL, { chalk: { x: 1.2, z: -3.4 } }) });
      const r = s.world.renderers[0]!;
      frames(50);
      expect(r.setChalk.mock.calls[0]).toEqual([{ x: 1.2, z: -3.4 }, 0.85]);
      s.rerender({ scene: sceneOf(ALL) });
      frames(50);
      expect(r.setChalk.mock.calls.at(-1)![0]).toBeNull();
    });

    it("같은 자리면 프레임마다 다시 보내지 않는다", async () => {
      const s = await openGame({ scene: sceneOf(ALL, { chalk: { x: 1.2, z: -3.4 } }) });
      const r = s.world.renderers[0]!;
      frames(100);
      const n = r.setChalk.mock.calls.length;
      frames(300);
      expect(r.setChalk.mock.calls.length).toBe(n);
    });

    it("렌더러에 setChalk 가 없어도(가짜 렌더러 호환) 예외 없이 돈다", async () => {
      const s = await openGame({ scene: sceneOf(ALL) });
      const r = s.world.renderers[0]!;
      delete (r as { setChalk?: unknown }).setChalk;
      s.rerender({ scene: sceneOf(ALL, { chalk: { x: 1, z: 1 } }) });
      expect(() => frames(100)).not.toThrow();
    });
  });

  describe("분필 그려짐 연출 (UI-SPEC 262행, E5 #29)", () => {
    const withChalk = (): SceneLook => sceneOf(ALL, { chalk: { x: 1.2, z: -3.4 } });
    const opacities = (r: FakeRenderer): number[] => r.setChalk.mock.calls.filter((c) => c[0] !== null).map((c) => c[1] as number);

    it("같은 연결에서 분필이 없다가 생기면 800ms 동안 0 → 0.85 로 여러 번 부르고 끝에 정확히 0.85", async () => {
      const s = await openGame();
      const r = s.world.renderers[0]!;
      frames(100);
      expect(r.setChalk.mock.calls.every((c) => c[0] === null) || r.setChalk.mock.calls.length === 0).toBe(true);
      s.rerender({ scene: withChalk() });
      frames(400);
      const mid = opacities(r);
      expect(mid.length).toBeGreaterThan(5);
      expect(mid[0]!).toBeLessThan(0.1);
      expect(Math.max(...mid)).toBeLessThan(0.85);
      expect(mid.every((v, i) => i === 0 || v >= mid[i - 1]!)).toBe(true);
      frames(600);
      const all = opacities(r);
      expect(all.at(-1)).toBe(0.85);
      expect(all.every((v) => v >= 0 && v <= 0.85)).toBe(true);
      const n = r.setChalk.mock.calls.length;
      frames(300);
      expect(r.setChalk.mock.calls.length).toBe(n);
    });

    it("첫 장면(재접속)부터 분필이 있으면 첫 호출부터 0.85", async () => {
      const s = await openGame({ scene: withChalk() });
      frames(100);
      expect(opacities(s.world.renderers[0]!)[0]).toBe(0.85);
    });

    it("모션 줄이기면 새로 생겨도 첫 호출부터 0.85", async () => {
      stubReducedMotion(true);
      const s = await openGame();
      const r = s.world.renderers[0]!;
      frames(50);
      s.rerender({ scene: withChalk() });
      frames(100);
      expect(opacities(r)[0]).toBe(0.85);
    });

    it("분필이 사라졌다가 다시 생기면 다시 그려진다(첫 장면이 아니다)", async () => {
      const s = await openGame({ scene: withChalk() });
      const r = s.world.renderers[0]!;
      frames(100);
      s.rerender({ scene: sceneOf(ALL) });
      frames(100);
      expect(r.setChalk.mock.calls.at(-1)![0]).toBeNull();
      r.setChalk.mockClear();
      s.rerender({ scene: withChalk() });
      frames(100);
      expect(opacities(r)[0]!).toBeLessThan(0.1);
    });
  });

  describe("내 캐릭터 빛 (NIGHT-07, UI-SPEC 단계 조명)", () => {
    it("nightCitizen 조명에서는 내 캐릭터 자리로 setSelfLight, 다른 단계에서는 null", async () => {
      const s = await openGame({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: {} }, { lighting: "nightCitizen" }) });
      const r = s.world.renderers[0]!;
      frames(100);
      const at = r.setSelfLight.mock.calls.at(-1)![0] as { x: number; z: number };
      expect(at.x).toBeCloseTo(2, 2);
      expect(at.z).toBeCloseTo(1, 2);
      expect(r.setLighting.mock.calls.at(-1)).toEqual(["nightCitizen"]);
      const n = r.setSelfLight.mock.calls.length;
      frames(200);
      expect(r.setSelfLight.mock.calls.length).toBe(n);
      s.rerender({ scene: sceneOf(ALL, { lighting: "night" }) });
      frames(50);
      expect(r.setSelfLight.mock.calls.at(-1)![0]).toBeNull();
    });

    it("렌더러에 setSelfLight 가 없어도 예외 없이 돈다", async () => {
      const s = await openGame({ scene: sceneOf(ALL) });
      delete (s.world.renderers[0] as { setSelfLight?: unknown }).setSelfLight;
      s.rerender({ scene: sceneOf(ALL, { lighting: "nightCitizen" }) });
      expect(() => frames(100)).not.toThrow();
    });
  });

  describe("떠다님·무대 높이·처형 연출", () => {
    it("ghost 좌석은 높이 0.35 ± 0.08 안에서 시간에 따라 떠다닌다", async () => {
      const s = await openGame({ scene: sceneOf({ ...ALL, 3: { ghost: true } }) });
      const ys: number[] = [];
      for (let t = 0; t < 3200; t += 16) {
        frame(16);
        ys.push(yOf(s, 3));
      }
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(0.35 - 0.08 - 1e-6);
      expect(Math.max(...ys)).toBeLessThanOrEqual(0.35 + 0.08 + 1e-6);
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.1);
      expect(yOf(s, 2)).toBe(0); // 산 사람은 뜨지 않는다
    });

    it("모션 줄이기면 유령 높이는 0.35 로 고정이다", async () => {
      stubReducedMotion(true);
      const s = await openGame({ scene: sceneOf({ ...ALL, 3: { ghost: true } }) });
      for (let t = 0; t < 1000; t += 16) {
        frame(16);
        expect(yOf(s, 3)).toBeCloseTo(0.35, 6);
      }
    });

    it("무대(0,0) 위에 선 좌석은 높이 0.29 다", async () => {
      const ents = [seg(0, [200, 100]), seg(1, [-300, 50]), seg(2, [-100, 400]), seg(3, [0, 0])];
      const s = await open({ scene: sceneOf(ALL) }, { players: FOUR, ents });
      expect(yOf(s, 3)).toBeCloseTo(0.29, 6);
      expect(yOf(s, 2)).toBe(0);
    });

    it("fadeAt 좌석은 떠오르며 흐려지고 2400ms 뒤 캐릭터가 지워진다. 이름표도 같이 흐려진다", async () => {
      const s = await openGame();
      const r = s.world.renderers[0]!;
      const h3 = r.chars.get(3) as FakeHandle;
      s.rerender({ scene: sceneOf({ ...ALL, 3: { fadeAt: Date.now() } }) });
      frames(700);
      const op = (h3.setOpacity as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0] as number;
      expect(op).toBeGreaterThan(0.77);
      expect(op).toBeLessThan(0.83);
      expect(yOf(s, 3)).toBeGreaterThan(0.5);
      expect(yOf(s, 3)).toBeLessThan(0.7);
      expect(Number(tagOf(s.utils, 3)!.style.opacity)).toBeLessThan(0.85);
      frames(GHOST_FADE_END_MS - 700 - 16);
      expect(r.chars.has(3)).toBe(true);
      frames(100);
      expect(r.chars.has(3)).toBe(false);
      expect(h3.disposed).toBe(1);
      frames(300);
      expect(r.chars.has(3)).toBe(false); // 표에 아직 남아 있어도 다시 만들지 않는다
    });

    it("유령 시점의 ghost 좌석은 fadeAt 이 있어도 지워지지 않고 유령으로 남는다", async () => {
      const s = await openGame();
      const r = s.world.renderers[0]!;
      s.rerender({ scene: sceneOf({ ...ALL, 3: { ghost: true, fadeAt: Date.now() } }) });
      frames(GHOST_FADE_END_MS + 200);
      expect(r.chars.has(3)).toBe(true);
    });
  });

  describe("지목 자세·손사래", () => {
    it("pointAt 이 있는 좌석은 holdPose('point') 한 번과 대상 쪽 방향을 얻고, 없어지면 holdPose(null)", async () => {
      const s = await openGame();
      const r = s.world.renderers[0]!;
      const h1 = r.chars.get(1) as FakeHandle;
      s.rerender({ scene: sceneOf({ ...ALL, 1: { pointAt: 2 } }) });
      frames(300);
      expect(h1.holdPose).toHaveBeenCalledTimes(1);
      expect(h1.holdPose).toHaveBeenCalledWith("point");
      // 좌석 1 (-3, 0.5) → 좌석 2 (-1, 4)
      expect(h1.yaws.at(-1)!).toBeCloseTo(Math.atan2(2, 3.5), 4);
      s.rerender({ scene: sceneOf(ALL) });
      frames(50);
      expect(h1.holdPose).toHaveBeenCalledTimes(2);
      expect(h1.holdPose).toHaveBeenLastCalledWith(null);
    });

    it("방향은 180ms 안에 돈다(한 프레임에 튀지 않는다)", async () => {
      const s = await openGame();
      const h1 = s.world.renderers[0]!.chars.get(1) as FakeHandle;
      s.rerender({ scene: sceneOf({ ...ALL, 1: { pointAt: 3 } }) });
      const before = h1.yaws.length;
      frames(200);
      const turn = h1.yaws.slice(before);
      for (let i = 1; i < turn.length; i++) expect(Math.abs(turn[i]! - turn[i - 1]!)).toBeLessThanOrEqual(YAW_TURN_RATE * 0.016 * 1.01);
    });

    it("deny 속성(seat, nonce)이 바뀔 때마다 그 좌석이 손사래(deny)와 놀란 표정을 한 번 한다", async () => {
      const s = await openGame();
      const h2 = s.world.renderers[0]!.chars.get(2) as FakeHandle;
      expect(h2.playEmote).not.toHaveBeenCalled();
      s.rerender({ deny: { seat: 2, nonce: 1 } });
      expect(h2.playEmote).toHaveBeenCalledTimes(1);
      expect(h2.playEmote).toHaveBeenCalledWith("deny");
      expect(h2.setFace).toHaveBeenCalledWith("surprise");
      frames(100);
      expect(h2.playEmote).toHaveBeenCalledTimes(1);
      s.rerender({ deny: { seat: 2, nonce: 2 } });
      expect(h2.playEmote).toHaveBeenCalledTimes(2);
    });

    it("surprise 속성(seat, nonce)이 바뀔 때마다 그 좌석이 놀란 표정만 짓는다(손사래 없음, 09-20 피해자 연출)", async () => {
      const s = await openGame();
      const h2 = s.world.renderers[0]!.chars.get(2) as FakeHandle;
      expect(h2.setFace).not.toHaveBeenCalledWith("surprise");
      s.rerender({ surprise: { seat: 2, nonce: 1 } });
      expect(h2.setFace).toHaveBeenCalledWith("surprise");
      expect(h2.playEmote).not.toHaveBeenCalled();
      const faceCalls = (): number => vi.mocked(h2.setFace!).mock.calls.length;
      const calls = faceCalls();
      frames(100);
      expect(faceCalls()).toBe(calls);
      s.rerender({ surprise: { seat: 2, nonce: 2 } });
      expect(faceCalls()).toBe(calls + 1);
    });
  });
});

describe("게임 이름표: 지목 버튼·tagProps·canWalk (DAY-04, MAP-04)", () => {
  afterEach(() => {
    for (const el of document.querySelectorAll("body > input")) el.remove();
  });
  const FIVE = [...FOUR, player(4, "다온")];
  const FIVE_ENTS = (): WorldSeg[] => [...FOUR_ENTS(), seg(4, [300, 300])];
  const SCENE5 = sceneOf({ 0: {}, 1: {}, 2: {}, 3: {}, 4: {} });
  const pickOf = (over: Partial<NonNullable<WorldStageProps["pick"]>> = {}): NonNullable<WorldStageProps["pick"]> => ({
    seats: new Set([1, 2, 4]),
    mine: 2,
    label: (n) => `${n} 님 가리키기`,
    onPick: vi.fn(),
    group: "지목",
    ...over,
  });
  const openPick = (over: Partial<WorldStageProps> = {}) => open({ scene: SCENE5, pick: pickOf(), ...over }, { players: FIVE, ents: FIVE_ENTS() });
  const pickBtn = (s: Setup, seat: number): HTMLButtonElement => s.utils.container.querySelector<HTMLButtonElement>(`button[data-pick="${seat}"]`)!;

  describe("지목 버튼", () => {
    it("pick 좌석의 이름표만 button[data-pick] 이 되고 aria-label·aria-pressed 가 붙는다", async () => {
      const s = await openPick();
      expect(s.utils.container.querySelectorAll("button[data-pick]")).toHaveLength(3);
      expect(pickBtn(s, 1).getAttribute("aria-label")).toBe("철수 님 가리키기");
      expect(pickBtn(s, 1).getAttribute("type")).toBe("button");
      expect(pickBtn(s, 2).getAttribute("aria-pressed")).toBe("true");
      expect(pickBtn(s, 1).getAttribute("aria-pressed")).toBe("false");
      expect(pickBtn(s, 4).getAttribute("aria-pressed")).toBe("false");
      expect(pickBtn(s, 0)).toBeNull();
      expect(pickBtn(s, 3)).toBeNull();
    });

    it("이름표 층은 role=group 이고 aria-label 이 pick.group 이다. pick 이름표만 aria-hidden 이 없다", async () => {
      const s = await openPick();
      const layer = s.utils.container.querySelector(".mf-world__tags")!;
      expect(layer.getAttribute("role")).toBe("group");
      expect(layer.getAttribute("aria-label")).toBe("지목");
      for (const seat of [1, 2, 4]) expect(tagOf(s.utils, seat)!.hasAttribute("aria-hidden")).toBe(false);
      for (const seat of [0, 3]) expect(tagOf(s.utils, seat)!.getAttribute("aria-hidden")).toBe("true");
    });

    it("pick 이 없으면 이름표 층에 role 이 없고 버튼도 없다(로비)", async () => {
      const s = await open();
      const layer = s.utils.container.querySelector(".mf-world__tags")!;
      expect(layer.hasAttribute("role")).toBe(false);
      expect(s.utils.container.querySelector("button[data-pick]")).toBeNull();
    });

    it("버튼을 누르면 onPick(seat) 이 한 번 불리고, mousedown 은 기본 동작이 막혀 입력칸 포커스를 뺏지 않는다", async () => {
      const pick = pickOf();
      const s = await openPick({ pick });
      const input = document.createElement("input");
      input.setAttribute("data-chat-input", "");
      document.body.append(input);
      input.focus();
      const notPrevented = fireEvent.mouseDown(pickBtn(s, 4));
      expect(notPrevented).toBe(false);
      expect(document.activeElement).toBe(input);
      fireEvent.click(pickBtn(s, 4));
      expect(pick.onPick).toHaveBeenCalledTimes(1);
      expect(pick.onPick).toHaveBeenCalledWith(4);
      input.remove();
    });

    it("canSend 가 거짓이면 aria-disabled 이고 눌러도 onPick 이 없다", async () => {
      const pick = pickOf();
      const s = await openPick({ pick, canSend: false });
      expect(pickBtn(s, 1).getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(pickBtn(s, 1));
      expect(pick.onPick).not.toHaveBeenCalled();
    });

    it("pick.disabled 이면 canSend 가 참이어도 aria-disabled 이고 눌러도 onPick 이 없다 (13-03)", async () => {
      const pick = pickOf({ disabled: true });
      const s = await openPick({ pick });
      expect(pickBtn(s, 1).getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(pickBtn(s, 1));
      expect(pick.onPick).not.toHaveBeenCalled();
    });

    it("버튼 안에는 이름표 쌓임이 그대로 있고 닉네임은 텍스트로만 들어간다", async () => {
      const s = await open({ scene: SCENE5, pick: pickOf() }, { players: [...FOUR, player(4, "<img src=x onerror=alert(1)>")], ents: FIVE_ENTS() });
      expect(pickBtn(s, 4).querySelector(".mv-head")).not.toBeNull();
      expect(pickBtn(s, 4).querySelector("img")).toBeNull();
      expect(pickBtn(s, 4).textContent).toContain("<img src=x onerror=alert(1)>");
    });

    it("tagProps 의 call 은 이름표 is-call 과 누르는 단추 data-call(값 없음)로 간다 — call 이 없는 좌석은 둘 다 없다(14-04)", async () => {
      const s = await open(
        { scene: SCENE5, pick: pickOf(), tagProps: (seat) => (seat === 1 || seat === 4 ? { call: true } : {}) },
        { players: FIVE, ents: FIVE_ENTS() },
      );
      const lit = [...s.utils.container.querySelectorAll("button[data-pick][data-call]")].map((b) => b.getAttribute("data-pick"));
      expect(lit).toEqual(["1", "4"]);
      expect(pickBtn(s, 1).getAttribute("data-call")).toBe("");
      expect(pickBtn(s, 1).querySelector(".mv-tag.is-call")).not.toBeNull();
      expect(pickBtn(s, 2).querySelector(".is-call")).toBeNull();
    });

    it("방장이 끊긴 사람을 내보내는 버튼과 같은 이름표에 겹치지 않는다(pick 좌석이 먼저)", async () => {
      const players = [player(0, "민지"), player(1, "철수", { connected: false })];
      const s = await open({ scene: sceneOf({ 0: {}, 1: {} }), pick: pickOf({ seats: new Set([1]), mine: undefined }) }, { players });
      expect(s.utils.container.querySelectorAll("button[data-pick]")).toHaveLength(1);
      expect(s.utils.container.querySelector(".mf-world__kick")).toBeNull();
    });

    it("world.css 에 .mf-world__pick 규칙: 안쪽 11 · 바깥 −11 · pointer-events auto · 포커스 링 gray-100 2px", () => {
      const css = readFileSync("src/styles/world.css", "utf8");
      const rule = /\.mf-world__pick\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
      expect(rule).toMatch(/padding:\s*11px/);
      expect(rule).toMatch(/margin:\s*-11px/);
      expect(rule).toMatch(/pointer-events:\s*auto/);
      expect(css).toMatch(/\.mf-world__pick:focus-visible\s*\{[^}]*2px solid var\(--gray-100\)/);
    });
  });

  describe("tagProps", () => {
    it("tagProps(seat) 가 주는 속성이 그 이름표 쌓임에 들어간다", async () => {
      const s = await open(
        { scene: SCENE5, tagProps: (seat) => (seat === 2 ? { count: 3, lead: true } : seat === 4 ? { sure: true, done: true } : {}) },
        { players: FIVE, ents: FIVE_ENTS() },
      );
      const head2 = tagOf(s.utils, 2)!.querySelector(".mv-head")!;
      expect(head2.getAttribute("data-count")).toBe("3");
      expect(head2.getAttribute("data-lead")).toBe("true");
      expect(head2.querySelector(".mv-badge.is-lead")).not.toBeNull();
      const head4 = tagOf(s.utils, 4)!.querySelector(".mv-head")!;
      expect(head4.getAttribute("data-sure")).toBe("true");
      expect(head4.getAttribute("data-done")).toBe("true");
      expect(tagOf(s.utils, 1)!.querySelector(".mv-head")!.hasAttribute("data-count")).toBe(false);
    });

    it("선두 이름표의 z-index 는 다른 이름표보다 높다(순위 + 10)", async () => {
      const s = await open({ scene: SCENE5, tagProps: (seat) => (seat === 1 ? { count: 2, lead: true } : {}) }, { players: FIVE, ents: FIVE_ENTS() });
      frame();
      const z = (seat: number): number => Number(tagOf(s.utils, seat)!.style.zIndex);
      const others = [0, 2, 3, 4].map(z);
      expect(Math.max(...others)).toBeLessThanOrEqual(7);
      expect(z(1)).toBeGreaterThanOrEqual(10);
      expect(z(1)).toBeGreaterThan(Math.max(...others));
    });

    it("ring 이 있는 좌석은 이름표에 data-ring-kind 가 붙고 그 캐릭터 발밑 고리 색이 정해진다. 없어지면 고리를 뗀다", async () => {
      const s = await open({ scene: SCENE5, tagProps: (seat) => (seat === 3 ? { ring: "police" } : seat === 4 ? { ring: "mafia" } : {}) }, { players: FIVE, ents: FIVE_ENTS() });
      expect(tagOf(s.utils, 3)!.getAttribute("data-ring-kind")).toBe("police");
      expect(tagOf(s.utils, 4)!.getAttribute("data-ring-kind")).toBe("mafia");
      expect(tagOf(s.utils, 2)!.hasAttribute("data-ring-kind")).toBe(false);
      const r = s.world.renderers[0]!;
      const h3 = r.chars.get(3) as FakeHandle;
      frame();
      expect(h3.setRing).toHaveBeenCalledTimes(1);
      expect(h3.setRing).toHaveBeenCalledWith("#7a8fb8");
      expect((r.chars.get(4) as FakeHandle).setRing).toHaveBeenCalledWith("#c8102e");
      expect((r.chars.get(2) as FakeHandle).setRing).not.toHaveBeenCalled();
      s.rerender({ tagProps: () => ({}) });
      frame();
      expect(h3.setRing).toHaveBeenLastCalledWith(null);
      expect(tagOf(s.utils, 3)!.hasAttribute("data-ring-kind")).toBe(false);
    });
  });

  describe("차례 고리 turn (09.1-07, UI-SPEC A-1)", () => {
    it("RING_COLORS.turn 은 gray-100 과 같은 값 #e6e8ee 이고 밤 고리 넷은 그대로", () => {
      expect(RING_COLORS.turn).toBe("#e6e8ee");
      expect(RING_COLORS.mafia).toBe("#c8102e");
      expect(RING_COLORS.police).toBe("#7a8fb8");
      expect(RING_COLORS.doctor).toBe("#6fa59a");
    });

    it("ring \"turn\" 좌석의 이름표는 data-ring-kind=\"turn\" 이고 그 캐릭터 발밑 고리가 #e6e8ee 로 정해진다", async () => {
      const s = await open({ scene: SCENE5, tagProps: (seat) => (seat === 3 ? { ring: "turn" } : {}) }, { players: FIVE, ents: FIVE_ENTS() });
      expect(tagOf(s.utils, 3)!.getAttribute("data-ring-kind")).toBe("turn");
      frame();
      expect((s.world.renderers[0]!.chars.get(3) as FakeHandle).setRing).toHaveBeenCalledWith("#e6e8ee");
    });

    it("turn: true 인 이름표는 data-turn=\"true\" 이고 z-index 가 다른 이름표보다 높다. turn 이 없으면 속성도 없다", async () => {
      const s = await open({ scene: SCENE5, tagProps: (seat) => (seat === 1 ? { turn: true } : {}) }, { players: FIVE, ents: FIVE_ENTS() });
      frame();
      const z = (seat: number): number => Number(tagOf(s.utils, seat)!.style.zIndex);
      expect(tagOf(s.utils, 1)!.getAttribute("data-turn")).toBe("true");
      expect(tagOf(s.utils, 2)!.hasAttribute("data-turn")).toBe(false);
      expect(z(1)).toBeGreaterThanOrEqual(10);
      expect(z(1)).toBeGreaterThan(Math.max(...[0, 2, 3, 4].map(z)));
      expect(s.utils.container.querySelector(".mv-head[data-turn]")).toBeNull(); // HeadStack 으로는 넘기지 않는다
    });
  });

  describe("마피아 전용 밤 표시 없음 (15페이즈 D-05)", () => {
    it("RING_COLORS 에는 동료 고리(mafiaAlly)가 없고 mafia 는 유령 화면용으로 crimson-500 그대로", () => {
      expect(Object.keys(RING_COLORS).sort()).toEqual(["doctor", "mafia", "police", "turn"]);
      expect(RING_COLORS.mafia).toBe("#c8102e");
    });

    it("밤 선택 효과(aim)가 없다: 후보 이름표 버튼은 늘 mf-world__pick 하나이고 누르는 중에도 클래스·data-night-pick·표식이 없다", async () => {
      const s = await open(
        { scene: SCENE5, pick: { seats: new Set([2, 3, 4]), mine: 3, label: (n: string) => `${n} 님 가리키기`, onPick: () => {}, group: "지목" } },
        { players: FIVE, ents: FIVE_ENTS() },
      );
      expect(s.utils.container.querySelector("[data-night-pick], [data-night-mark]")).toBeNull();
      const b = tagOf(s.utils, 2)!.querySelector("button.mf-world__pick")!;
      expect(b.className).toBe("mf-world__pick");
      fireEvent.pointerDown(b, { pointerId: 5, pointerType: "touch" });
      expect(b.className).toBe("mf-world__pick");
      expect(s.utils.container.querySelector(".mv-tag.is-mine")).not.toBeNull(); // 낮 지목의 눌린 이름표 스타일 유지
      expect((s.world.renderers[0]!.chars.get(3) as FakeHandle).setPickMark).not.toHaveBeenCalled();
    });

    it("world.css 에는 밤 선택 효과 규칙(is-cand·is-preview·is-picked·aimmark)이 없다", () => {
      const css = readFileSync("src/styles/world.css", "utf8");
      expect(css).not.toMatch(/is-cand|is-preview|is-picked|aimmark|mf-aim-beat/);
    });
  });

  describe("canWalk (MAP-04)", () => {
    it("canWalk 가 거짓이면 맵 탭은 링도 move 도 보내지 않는다", async () => {
      const s = await open({ canWalk: false });
      tapAt(surface(s.utils), 250, 340);
      expect(s.send).not.toHaveBeenCalled();
      expect(s.utils.container.querySelector("[data-world-stage]")!.hasAttribute("data-ring")).toBe(false);
      expect(s.world.renderers[0]!.markers.filter((m) => m.kind === "ring")).toHaveLength(0);
    });

    it("canWalk 를 켜면(기본값도 켜짐) 다시 걷는다", async () => {
      const s = await open({ canWalk: false });
      s.rerender({ canWalk: true });
      tapAt(surface(s.utils), 250, 340);
      expect(s.send).toHaveBeenCalledTimes(1);
    });

    it("canWalk 가 거짓이어도 입력칸 포커스 중 탭은 키보드만 닫는다(D4 그대로)", async () => {
      const s = await open({ canWalk: false });
      const input = document.createElement("input");
      input.setAttribute("data-chat-input", "");
      document.body.append(input);
      input.focus();
      tapAt(surface(s.utils), 250, 340);
      expect(document.activeElement).not.toBe(input);
      expect(s.send).not.toHaveBeenCalled();
      input.remove();
    });
  });
});

describe("머리 위 표시 없음·훅 게이트 (L31, L33)", () => {
  const handleOf = (s: Setup, seat: number): FakeHandle => s.world.renderers[0]!.chars.get(seat) as FakeHandle;
  const ALL4 = { 0: {}, 1: {}, 2: {}, 3: {} };
  const openAll = () => open({ scene: sceneOf(ALL4) }, { players: FOUR, ents: FOUR_ENTS() });

  it("동작이 재생되는 동안 이름표 층에 [data-emote] 도 emote 가 든 속성 이름도 없고 이름표 DOM 도 바뀌지 않는다", async () => {
    const s = await openAll();
    frames(32);
    const tags = s.utils.container.querySelector(".mf-world__tags")!;
    const htmlBefore = tags.innerHTML;
    act(() => s.store.applyEmote({ t: "emote", seat: 2, id: "dance", n: 1 }, 1));
    frames(200);
    expect(handleOf(s, 2).playEmote).toHaveBeenCalledTimes(1);
    expect(window.__mfEmotes!.playing).toEqual([2]);
    expect(tags.querySelectorAll("[data-emote]")).toHaveLength(0);
    for (const el of [tags, ...Array.from(tags.querySelectorAll("*"))]) {
      for (const name of el.getAttributeNames()) expect(name.toLowerCase()).not.toContain("emote");
    }
    expect(s.utils.container.querySelectorAll("[data-emote]")).toHaveLength(0);
    expect(tags.innerHTML).not.toMatch(/emote/i);
    // 이름표 층의 구조(요소 수)는 동작 전후로 같다 — 표시 슬롯이 늘지 않는다
    expect(tags.innerHTML.replace(/style="[^"]*"/g, "")).toBe(htmlBefore.replace(/style="[^"]*"/g, ""));
  });

  it("훅이 꺼진 문맥에서는 __mfEmotes·__mfLooks 가 모두 없다", async () => {
    vi.stubEnv("DEV", false);
    const s = await openAll();
    frames(32);
    act(() => s.store.applyEmote({ t: "emote", seat: 1, id: "clap", n: 1 }, 1));
    expect(window.__mfEmotes).toBeUndefined();
    expect(window.__mfLooks).toBeUndefined();
  });

  it("켜진 문맥에서는 둘 다 있고 언마운트하면 사라지며 값이 DOM 속성(data-*)으로 새지 않는다", async () => {
    const s = await openAll();
    frames(32);
    act(() => s.store.applyEmote({ t: "emote", seat: 1, id: "clap", n: 1 }, 1));
    expect(window.__mfEmotes).toBeDefined();
    expect(window.__mfLooks).toBeDefined();
    const all = Array.from(s.utils.container.querySelectorAll("*"));
    for (const el of all) {
      for (const name of el.getAttributeNames()) expect(name).not.toMatch(/^data-(mf-)?(looks?|emotes?|outfit)$/);
    }
    s.utils.unmount();
    expect(window.__mfEmotes).toBeUndefined();
    expect(window.__mfLooks).toBeUndefined();
  });
});

describe("동작 프레임 재생 (D-9, L33)", () => {
  const ALL4 = { 0: {}, 1: {}, 2: {}, 3: {} };
  const openEmote = (over: Partial<WorldStageProps> = {}) => open({ scene: sceneOf(ALL4), ...over }, { players: FOUR, ents: FOUR_ENTS() });
  const handleOf = (s: Setup, seat: number): FakeHandle => s.world.renderers[0]!.chars.get(seat) as FakeHandle;
  const emoteArg = (h: FakeHandle, i = 0): unknown => vi.mocked(h.playEmote!).mock.calls[i]?.[0];

  it("서버 emote 프레임이 store 를 지나 그 좌석 캐릭터의 playEmote 가 정확히 한 번 된다", async () => {
    const s = await openEmote();
    frames(32);
    const h3 = handleOf(s, 3);
    expect(h3.playEmote).not.toHaveBeenCalled();
    act(() => s.store.applyEmote({ t: "emote", seat: 3, id: "clap", n: 1 }, 1));
    expect(h3.playEmote).toHaveBeenCalledTimes(1);
    expect(emoteArg(h3)).toBe("clap");
    for (const seat of [0, 1, 2]) expect(handleOf(s, seat).playEmote).not.toHaveBeenCalled();
  });

  it("로비 장면(scene 없음)에서도 재생한다", async () => {
    const s = await open({}, { players: FOUR, ents: FOUR_ENTS() });
    frames(32);
    act(() => s.store.applyEmote({ t: "emote", seat: 2, id: "dance", n: 1 }, 1));
    expect(emoteArg(handleOf(s, 2))).toBe("dance");
  });

  it("그릴 캐릭터가 없는 좌석(장면 표에 없음·구간 없음)의 프레임은 무시된다 — 훅도 바뀌지 않는다", async () => {
    const s = await openEmote({ scene: sceneOf({ 0: {}, 1: {}, 2: {} }) });
    frames(32);
    act(() => s.store.applyEmote({ t: "emote", seat: 3, id: "clap", n: 1 }, 1));
    act(() => s.store.applyEmote({ t: "emote", seat: 7, id: "clap", n: 2 }, 1));
    for (const h of s.world.handles) expect(h.playEmote).not.toHaveBeenCalled();
    expect(window.__mfEmotes).toEqual({ last: null, playing: [] });
  });

  it("퇴장 중인 좌석의 프레임은 무시된다", async () => {
    const s = await openEmote();
    frames(32);
    const h3 = handleOf(s, 3);
    s.rerender({ view: makeView(FOUR.slice(0, 3)) });
    frames(40);
    act(() => s.store.applyEmote({ t: "emote", seat: 3, id: "clap", n: 1 }, 1));
    expect(h3.playEmote).not.toHaveBeenCalled();
  });

  it("끊긴 사람(dim)의 캐릭터에도 재생된다", async () => {
    const s = await openEmote();
    frames(32);
    s.rerender({ view: makeView([player(0, "민지"), player(1, "철수"), player(2, "영희", { connected: false }), player(3, "바다")]) });
    frames(32);
    act(() => s.store.applyEmote({ t: "emote", seat: 2, id: "cry", n: 1 }, 1));
    expect(emoteArg(handleOf(s, 2))).toBe("cry");
  });

  it("훅이 켜진 문맥: window.__mfEmotes 가 처음엔 비어 있다가 받은 프레임의 사본으로 바뀌고 언마운트에서 지워진다", async () => {
    const s = await openEmote();
    frames(32);
    expect(window.__mfEmotes).toEqual({ last: null, playing: [] });
    act(() => s.store.applyEmote({ t: "emote", seat: 3, id: "clap", n: 1 }, 1));
    expect(window.__mfEmotes).toEqual({ last: { seat: 3, id: "clap", n: 1 }, playing: [3] });
    s.utils.unmount();
    expect(window.__mfEmotes).toBeUndefined();
  });

  it("훅이 꺼진 문맥(?e2e=0)에는 객체가 없고 동작은 그래도 재생된다", async () => {
    const before = window.location.href;
    window.history.replaceState({}, "", "/?e2e=0");
    try {
      const s = await openEmote();
      frames(32);
      act(() => s.store.applyEmote({ t: "emote", seat: 3, id: "clap", n: 1 }, 1));
      expect(window.__mfEmotes).toBeUndefined();
      expect(emoteArg(handleOf(s, 3))).toBe("clap");
    } finally {
      window.history.replaceState({}, "", before);
    }
  });

  it("DOM 속성에는 동작을 싣지 않는다", async () => {
    const s = await openEmote();
    frames(32);
    act(() => s.store.applyEmote({ t: "emote", seat: 3, id: "clap", n: 1 }, 1));
    const attrs = [...s.utils.container.querySelectorAll("*")].flatMap((el) => [...el.getAttributeNames()]);
    expect(attrs.filter((a) => /emote/i.test(a))).toEqual([]);
    expect(s.utils.container.innerHTML).not.toMatch(/clap/);
  });

  it("다른 설치가 덮어썼으면 언마운트가 지우지 않는다", async () => {
    const s = await openEmote();
    const other = { last: null, playing: [] as number[] };
    window.__mfEmotes = other;
    s.utils.unmount();
    expect(window.__mfEmotes).toBe(other);
    delete window.__mfEmotes;
  });

  it("언마운트 뒤의 프레임은 아무것도 부르지 않는다(구독 해제)", async () => {
    const s = await openEmote();
    frames(32);
    const h3 = handleOf(s, 3);
    s.utils.unmount();
    act(() => s.store.applyEmote({ t: "emote", seat: 3, id: "clap", n: 1 }, 1));
    expect(h3.playEmote).not.toHaveBeenCalled();
  });
});

describe("동작 동시 상한 4·단계 전환·deny 건너뛰기 (D-13, T-10-10)", () => {
  const SIX = [0, 1, 2, 3, 4, 5].map((i) => player(i, `손님${i}`));
  const SIX_ENTS = (): WorldSeg[] => SIX.map((p, i) => seg(p.seat, [-400 + i * 150, 100 + (i % 3) * 100]));
  const ALL6 = Object.fromEntries(SIX.map((p) => [p.seat, {}]));
  const openSix = (over: Partial<WorldStageProps> = {}) => open({ view: makeView(SIX), scene: sceneOf(ALL6), ...over }, { players: SIX, ents: SIX_ENTS() });
  const handleOf = (s: Setup, seat: number): FakeHandle => s.world.renderers[0]!.chars.get(seat) as FakeHandle;
  let seq = 0;
  const emit = (s: Setup, seat: number, id: "clap" | "dance" | "cry" = "clap"): void => {
    act(() => s.store.applyEmote({ t: "emote", seat, id, n: ++seq }, 1));
  };

  it("다섯 번째 프레임에서 가장 먼저 시작한 좌석의 stopEmote 가 한 번 불리고 다섯 번째 playEmote 도 불린다", async () => {
    const s = await openSix();
    frames(32);
    for (const seat of [0, 1, 2, 3]) emit(s, seat);
    for (const seat of [0, 1, 2, 3]) expect(handleOf(s, seat).stopEmote).not.toHaveBeenCalled();
    expect(window.__mfEmotes!.playing).toEqual([0, 1, 2, 3]);
    emit(s, 4);
    expect(handleOf(s, 0).stopEmote).toHaveBeenCalledTimes(1);
    for (const seat of [1, 2, 3, 4]) expect(handleOf(s, seat).stopEmote).not.toHaveBeenCalled();
    expect(handleOf(s, 4).playEmote).toHaveBeenCalledTimes(1);
    expect(window.__mfEmotes!.playing).toEqual([1, 2, 3, 4]);
  });

  it("같은 좌석이 다시 하면 상한을 두 번 세지 않고, 다시 한 좌석은 가장 늦게 도착한 것이 된다", async () => {
    const s = await openSix();
    frames(32);
    emit(s, 0);
    emit(s, 1);
    emit(s, 0);
    emit(s, 2);
    emit(s, 3);
    for (const seat of [0, 1, 2, 3]) expect(handleOf(s, seat).stopEmote).not.toHaveBeenCalled();
    expect(handleOf(s, 0).playEmote).toHaveBeenCalledTimes(2);
    emit(s, 4);
    expect(handleOf(s, 1).stopEmote).toHaveBeenCalledTimes(1);
    expect(handleOf(s, 0).stopEmote).not.toHaveBeenCalled();
  });

  it("끝난 동작은 상한을 채우지 않는다", async () => {
    const s = await openSix();
    frames(32);
    for (const seat of [0, 1, 2, 3]) emit(s, seat);
    frames(2500); // 가장 긴 동작(춤 2.08초)보다 오래
    expect(window.__mfEmotes!.playing).toEqual([]);
    emit(s, 4);
    for (const seat of [0, 1, 2, 3]) expect(handleOf(s, seat).stopEmote).not.toHaveBeenCalled();
    expect(window.__mfEmotes!.playing).toEqual([4]);
  });

  it("걷는 중이라고 알려진 좌석은 재생 목록에서 빠진다", async () => {
    const s = await openSix();
    frames(32);
    emit(s, 1);
    emit(s, 2);
    expect(window.__mfEmotes!.playing).toEqual([1, 2]);
    act(() => move(s.store, seg(1, [-250, 200, 300, 200], Date.now())));
    frames(64);
    expect(window.__mfEmotes!.playing).toEqual([2]);
  });

  it("deny: 그 좌석이 사람 동작을 재생 중이면 playEmote('deny') 도 놀란 표정도 없고 목록이 늘지 않는다", async () => {
    const s = await openSix();
    frames(32);
    emit(s, 2, "dance");
    const h2 = handleOf(s, 2);
    s.rerender({ deny: { seat: 2, nonce: 1 } });
    expect(h2.playEmote).toHaveBeenCalledTimes(1);
    expect(vi.mocked(h2.playEmote!).mock.calls[0]![0]).toBe("dance");
    expect(h2.setFace).not.toHaveBeenCalledWith("surprise");
    expect(window.__mfEmotes!.playing).toEqual([2]);
  });

  it("deny: 재생 중이 아니면 기존대로 손사래를 하고 목록에 넣지 않는다 — 동작이 끝난 뒤에도 그렇다", async () => {
    const s = await openSix();
    frames(32);
    s.rerender({ deny: { seat: 3, nonce: 1 } });
    expect(vi.mocked(handleOf(s, 3).playEmote!).mock.calls.map((c) => c[0])).toEqual(["deny"]);
    expect(window.__mfEmotes!.playing).toEqual([]);
    emit(s, 2, "cry");
    frames(2500);
    s.rerender({ deny: { seat: 2, nonce: 2 } });
    expect(vi.mocked(handleOf(s, 2).playEmote!).mock.calls.map((c) => c[0])).toEqual(["cry", "deny"]);
  });

  it("deny 는 상한 계산에 넣지 않는다 — 사람 동작 4개 + deny 한 번이어도 아무도 멈추지 않는다", async () => {
    const s = await openSix();
    frames(32);
    for (const seat of [0, 1, 2, 3]) emit(s, seat);
    s.rerender({ deny: { seat: 5, nonce: 1 } });
    for (const seat of [0, 1, 2, 3]) expect(handleOf(s, seat).stopEmote).not.toHaveBeenCalled();
  });

  it("단계(phaseKey)가 바뀌면 재생 중인 모든 좌석의 stopEmote 가 불리고 목록이 비며 훅 playing 이 []이다", async () => {
    const s = await openSix({ view: { ...makeView(SIX), phase: "night", day: { n: 1, roles: [] } as unknown as RoomView["day"] } });
    frames(32);
    emit(s, 0);
    emit(s, 3);
    // 같은 단계의 새 view 객체는 정리하지 않는다
    s.rerender({ view: { ...s.props.view } });
    expect(handleOf(s, 0).stopEmote).not.toHaveBeenCalled();
    s.rerender({ view: { ...s.props.view, phase: "morning" } });
    expect(handleOf(s, 0).stopEmote).toHaveBeenCalledTimes(1);
    expect(handleOf(s, 3).stopEmote).toHaveBeenCalledTimes(1);
    expect(handleOf(s, 1).stopEmote).not.toHaveBeenCalled();
    expect(window.__mfEmotes!.playing).toEqual([]);
    expect(window.__mfEmotes!.last).toMatchObject({ seat: 3 });
  });

  it("일차만 바뀌어도(밤 → 다음 밤) 정리한다", async () => {
    const s = await openSix({ view: { ...makeView(SIX), phase: "night", day: { n: 1, roles: [] } as unknown as RoomView["day"] } });
    frames(32);
    emit(s, 1);
    s.rerender({ view: { ...s.props.view, day: { n: 2, roles: [] } as unknown as RoomView["day"] } });
    expect(handleOf(s, 1).stopEmote).toHaveBeenCalledTimes(1);
  });

  it("판 번호만 바뀌어도(1판 → 2판) 정리한다 (D-26)", async () => {
    const s = await openSix({ view: { ...makeView(SIX), phase: "night", round: 1, day: { n: 1, roles: [] } as unknown as RoomView["day"] } });
    frames(32);
    emit(s, 1);
    s.rerender({ view: { ...s.props.view, round: 2 } });
    expect(handleOf(s, 1).stopEmote).toHaveBeenCalledTimes(1);
  });

  it("처음 마운트에서는 정리를 부르지 않는다", async () => {
    const s = await openSix();
    frames(32);
    for (const h of s.world.handles) expect(h.stopEmote).not.toHaveBeenCalled();
  });

  it("끊긴 사람(dim) 좌석에도 재생되고 상한에 센다", async () => {
    const s = await openSix();
    s.rerender({ view: makeView(SIX.map((p) => (p.seat === 0 ? { ...p, connected: false } : p))) });
    frames(32);
    for (const seat of [0, 1, 2, 3]) emit(s, seat);
    expect(handleOf(s, 0).playEmote).toHaveBeenCalledTimes(1);
    emit(s, 4);
    expect(handleOf(s, 0).stopEmote).toHaveBeenCalledTimes(1);
  });
});

describe("모션 줄이기·표정 선행 병합 (O-5, O-10)", () => {
  const SIX = [0, 1, 2, 3].map((i) => player(i, `손님${i}`));
  const openSix = () => open({ view: makeView(SIX) }, { players: SIX, ents: FOUR_ENTS() });
  const handleOf = (s: Setup, seat: number): FakeHandle => s.world.renderers[0]!.chars.get(seat) as FakeHandle;

  it("런타임은 reducedMotion() 값을 playEmote 옵션으로 넘긴다", async () => {
    const s = await openSix();
    frames(32);
    act(() => s.store.applyEmote({ t: "emote", seat: 1, id: "dance", n: 1 }, 1));
    expect(vi.mocked(handleOf(s, 1).playEmote!).mock.calls[0]).toEqual(["dance", { reduced: false }]);
  });

  it("모션 줄이기: 옵션 reduced=true 로 재생하고 반복 2 번 길이(1.04초)가 지나면 재생 목록에서 빠진다", async () => {
    stubReducedMotion(true);
    const s = await openSix();
    frames(32);
    act(() => s.store.applyEmote({ t: "emote", seat: 1, id: "dance", n: 1 }, 1));
    expect(vi.mocked(handleOf(s, 1).playEmote!).mock.calls[0]).toEqual(["dance", { reduced: true }]);
    expect(window.__mfEmotes!.playing).toEqual([1]);
    frames(900);
    expect(window.__mfEmotes!.playing).toEqual([1]);
    frames(250);
    expect(window.__mfEmotes!.playing).toEqual([]);
  });

  it("보통은 같은 동작이 2.08초 동안 목록에 남는다", async () => {
    const s = await openSix();
    frames(32);
    act(() => s.store.applyEmote({ t: "emote", seat: 1, id: "dance", n: 1 }, 1));
    frames(1250);
    expect(window.__mfEmotes!.playing).toEqual([1]);
    frames(900);
    expect(window.__mfEmotes!.playing).toEqual([]);
  });

  describe("requestIdleCallback", () => {
    let queue: { id: number; cb: () => void }[];
    let cancelled: number[];
    const installIdle = (): void => {
      queue = [];
      cancelled = [];
      let n = 0;
      vi.stubGlobal("requestIdleCallback", (cb: () => void) => {
        queue.push({ id: ++n, cb });
        return n;
      });
      vi.stubGlobal("cancelIdleCallback", (id: number) => {
        cancelled.push(id);
        queue = queue.filter((q) => q.id !== id);
      });
    };
    /** 대기 중인 유휴 작업을 하나씩 돌린다(돌린 일이 새 작업을 걸 수 있다) */
    const drain = (max = 200): number => {
      let ran = 0;
      while (queue.length > 0 && ran < max) {
        const job = queue.shift()!;
        job.cb();
        ran++;
      }
      return ran;
    };

    it("캐릭터를 만든 뒤 표정마다 따로 유휴 작업으로 prewarm 한다", async () => {
      installIdle();
      const s = await openSix();
      frames(32);
      for (const h of s.world.handles) expect(h.prewarm).not.toHaveBeenCalled(); // 유휴 시간이 오기 전에는 하지 않는다
      expect(queue.length).toBe(s.world.handles.length); // 캐릭터마다 첫 작업 하나
      queue[0]!.cb();
      queue.shift();
      const first = s.world.handles[0]!;
      expect(first.prewarm).toHaveBeenCalledTimes(1); // 한 작업에 표정 하나
      drain();
      for (const h of s.world.handles) {
        expect(vi.mocked(h.prewarm!).mock.calls.map((c) => c[0])).toEqual(["angry", "sus", "surprise", "happy", "cry"]);
      }
    });

    it("requestIdleCallback 이 없으면 아무것도 하지 않는다", async () => {
      vi.stubGlobal("requestIdleCallback", undefined);
      const s = await openSix();
      frames(64);
      for (const h of s.world.handles) expect(h.prewarm).not.toHaveBeenCalled();
    });

    it("퇴장으로 캐릭터가 사라지면 걸어 둔 유휴 작업을 취소하고 돌려도 prewarm 하지 않는다", async () => {
      installIdle();
      const s = await openSix();
      frames(32);
      const gone = handleOf(s, 3);
      const pending = queue.length;
      s.rerender({ view: makeView(SIX.slice(0, 3)) });
      frames(EXIT_MS + 100);
      expect(cancelled.length).toBe(1);
      expect(queue.length).toBe(pending - 1);
      drain();
      expect(gone.prewarm).not.toHaveBeenCalled();
    });

    it("dispose 에서 남은 작업을 모두 취소한다", async () => {
      installIdle();
      const s = await openSix();
      frames(32);
      const handles = [...s.world.handles];
      const pending = queue.length;
      s.utils.unmount();
      expect(cancelled.length).toBe(pending);
      expect(queue.length).toBe(0);
      for (const h of handles) expect(h.prewarm).not.toHaveBeenCalled();
    });
  });
});

describe("지목 유지 자세 위의 동작 · 위치와 방향 불변 (AVTR-05, 10-08)", () => {
  const ALL4 = { 0: {}, 1: {}, 2: {}, 3: {} };
  const openGame = (scene = sceneOf(ALL4)) => open({ scene }, { players: FOUR, ents: FOUR_ENTS() });
  const handleOf = (s: Setup, seat: number): FakeHandle => s.world.renderers[0]!.chars.get(seat) as FakeHandle;

  it("지목 단계(장면 표 pointAt)의 좌석에 emote 프레임이 와도 holdPose(null) 은 불리지 않고 playEmote 만 불린다", async () => {
    const s = await openGame(sceneOf({ ...ALL4, 1: { pointAt: 2 } }));
    frames(300);
    const h1 = handleOf(s, 1);
    expect(h1.holdPose).toHaveBeenCalledTimes(1);
    expect(h1.holdPose).toHaveBeenCalledWith("point");
    act(() => s.store.applyEmote({ t: "emote", seat: 1, id: "clap", n: 1 }, 1));
    expect(h1.playEmote).toHaveBeenCalledTimes(1);
    frames(2500); // 동작이 끝나고 한참 지난 뒤까지
    expect(h1.holdPose).toHaveBeenCalledTimes(1); // 풀었다 다시 거는 일이 없다
    expect(vi.mocked(h1.holdPose!).mock.calls.some((c) => c[0] === null)).toBe(false);
  });

  it("서 있는 지목 좌석의 동작은 방향(setYaw)과 위치를 바꾸지 않고 프레임당 위치 갱신 횟수도 그대로다", async () => {
    const s = await openGame(sceneOf({ ...ALL4, 1: { pointAt: 2 } }));
    frames(500); // 대상 쪽 방향에 닿을 때까지
    const h1 = handleOf(s, 1);
    const setPos = vi.spyOn(h1.root.position, "set");
    frames(160);
    const perWindow = setPos.mock.calls.length;
    const yawsBefore = h1.yaws.length;
    const yawBefore = h1.yaws.at(-1);
    const posBefore = h1.root.position.toArray();
    setPos.mockClear();
    act(() => s.store.applyEmote({ t: "emote", seat: 1, id: "dance", n: 1 }, 1));
    frames(160);
    expect(setPos.mock.calls.length).toBe(perWindow); // 프레임 때문에 늘지 않는다
    expect(h1.yaws.length).toBe(yawsBefore);
    expect(h1.yaws.at(-1)).toBe(yawBefore);
    expect(h1.root.position.toArray()).toEqual(posBefore);
  });

  it("모이기에서 걷는 좌석에 emote 프레임이 와도 걷기 방향과 서버 구간 위치는 그대로 이어진다", async () => {
    const s = await openGame();
    frames(100);
    const h2 = handleOf(s, 2);
    move(s.store, seg(2, [-100, 400, 500, 400], Date.now(), 180));
    frames(400); // 걷는 방향(+x)에 닿았다
    const yawsBefore = h2.yaws.length;
    act(() => s.store.applyEmote({ t: "emote", seat: 2, id: "clap", n: 1 }, 1));
    frames(160);
    expect(h2.yaws.length).toBe(yawsBefore); // 프레임 때문에 방향을 새로 정하지 않는다
    expect(h2.yaws.at(-1)!).toBeCloseTo(Math.PI / 2, 4);
    const pos = s.store.positionOf(2, Date.now())!;
    expect(h2.root.position.x).toBeCloseTo(pos.x, 6);
    expect(h2.root.position.z).toBeCloseTo(pos.z, 6);
  });
});

// ---------- 11-05: 결과 화면의 직업 의상(costume)·진 팀 어둠(dim) (D-1, T-11-15) ----------
describe("결과 장면: costume·dim 적용과 onCostumes (11-05)", () => {
  const handleOf = (s: Setup, seat: number): FakeHandle => s.world.renderers[0]!.chars.get(seat) as FakeHandle;
  const openResult = (seats: Record<number, Partial<Omit<SeatLook, "show">>>, over: Partial<WorldStageProps> = {}) =>
    open({ scene: sceneOf(seats), ...over }, { players: FOUR, ents: FOUR_ENTS() });

  it("costume 이 있는 좌석만 그 의상을 한 번 입는다 (같은 값으로 다시 와도 늘지 않는다)", async () => {
    const s = await openResult({ 0: {}, 1: { costume: "police" }, 2: { costume: "doctor" }, 3: {} });
    frames(50);
    expect(handleOf(s, 1).applyOutfit).toHaveBeenCalledTimes(1);
    expect(handleOf(s, 1).applyOutfit).toHaveBeenCalledWith("police");
    expect(handleOf(s, 2).applyOutfit).toHaveBeenCalledWith("doctor");
    expect(handleOf(s, 0).applyOutfit).not.toHaveBeenCalled();
    s.rerender({ scene: sceneOf({ 0: {}, 1: { costume: "police" }, 2: { costume: "doctor" }, 3: {} }) });
    frames(50);
    expect(handleOf(s, 1).applyOutfit).toHaveBeenCalledTimes(1);
  });

  it("costume 이 사라지면 고른 의상(look)으로 돌아온다", async () => {
    const s = await openResult({ 0: {}, 1: { costume: "mafia" }, 2: {}, 3: {} });
    frames(50);
    s.rerender({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: {} }) });
    frames(50);
    expect(handleOf(s, 1).applyOutfit).toHaveBeenLastCalledWith("coat");
  });

  it("탈락자(ghost) 는 지금의 반투명 유령 모양에 직업 의상을 입는다 — 안개 outfit 이 아니다", async () => {
    const s = await openResult({ 0: {}, 1: {}, 2: {}, 3: { ghost: true, costume: "mafia" } });
    frames(50);
    const h3 = handleOf(s, 3);
    expect(h3.applyOutfit).toHaveBeenCalledWith("mafia");
    expect(h3.setGhost).toHaveBeenCalledWith(true);
    expect(window.__mfGhostOutfits ?? {}).toEqual({});
  });

  it("안개 outfit 이 있으면 안개가 우선이다 (costume 을 입지 않는다)", async () => {
    const s = await openResult({ 0: {}, 1: {}, 2: {}, 3: { ghost: true, outfit: "doctor", costume: "mafia" } });
    frames(50);
    expect(handleOf(s, 3).applyOutfit).toHaveBeenCalledTimes(1);
    expect(handleOf(s, 3).applyOutfit).toHaveBeenCalledWith("doctor");
  });

  it("costume 중에 서버 look 이 바뀌어도 의상을 덮지 않는다", async () => {
    const s = await openResult({ 0: {}, 1: { costume: "police" }, 2: {}, 3: {} });
    frames(50);
    const before = vi.mocked(handleOf(s, 1).applyOutfit!).mock.calls.length;
    s.rerender({ view: makeView(FOUR.map((p) => (p.seat === 1 ? { ...p, look: "hood" as OutfitId } : p))) });
    frames(50);
    expect(vi.mocked(handleOf(s, 1).applyOutfit!).mock.calls.length).toBe(before);
  });

  it("dim 인 좌석만 setDim(true), 걷히면 false — 연결 끊김 어둠과 따로 센다", async () => {
    const s = await openResult({ 0: {}, 1: { dim: true }, 2: {}, 3: {} });
    frames(50);
    expect(handleOf(s, 1).dims.at(-1)).toBe(true);
    expect(handleOf(s, 0).dims.at(-1) ?? false).toBe(false);
    s.rerender({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: {} }) });
    frames(50);
    expect(handleOf(s, 1).dims.at(-1)).toBe(false);
    // 연결이 끊긴 좌석은 scene 의 dim 이 없어도 어둡다
    s.rerender({ view: makeView(FOUR.map((p) => (p.seat === 2 ? { ...p, connected: false } : p))) });
    frames(50);
    expect(handleOf(s, 2).dims.at(-1)).toBe(true);
  });

  it("onCostumes 는 입은 의상 표(좌석 → 의상)와 어두워진 좌석을 바뀔 때만 한 번씩 알린다", async () => {
    const onCostumes = vi.fn();
    const s = await openResult({ 0: { costume: "coat" }, 1: {}, 2: {}, 3: {} }, { onCostumes });
    frames(50);
    expect(onCostumes).toHaveBeenLastCalledWith({ 0: "coat" }, []);
    const n = onCostumes.mock.calls.length;
    frames(100);
    expect(onCostumes.mock.calls.length).toBe(n);
    s.rerender({ scene: sceneOf({ 0: { costume: "coat" }, 1: { costume: "police", dim: true }, 2: { dim: true }, 3: {} }) });
    frames(50);
    expect(onCostumes).toHaveBeenLastCalledWith({ 0: "coat", 1: "police" }, [1, 2]);
    expect(onCostumes.mock.calls.length).toBe(n + 1);
  });

  it("산 사람 장면(costume·dim 없음)은 어떤 의상 호출도 받지 않는다", async () => {
    const onCostumes = vi.fn();
    const s = await openResult({ 0: {}, 1: {}, 2: {}, 3: {} }, { onCostumes });
    frames(100);
    for (const h of s.world.handles) expect(h.applyOutfit).not.toHaveBeenCalled();
    expect(onCostumes).not.toHaveBeenCalled();
  });
});

// ---------- 11-05 Task 2: 무대 탭 알림(onStageTap)과 화면 연출 동작 큐(emoteCues) ----------
describe("결과 장면: onStageTap · emoteCues (11-05, D-25)", () => {
  const handleOf = (s: Setup, seat: number): FakeHandle => s.world.renderers[0]!.chars.get(seat) as FakeHandle;
  const openResult = (over: Partial<WorldStageProps> = {}) =>
    open({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: {} }), canWalk: false, ...over }, { players: FOUR, ents: FOUR_ENTS() });

  it("무대 빈 곳을 한 번 탭하면 onStageTap 이 한 번 불리고, canWalk 가 거짓이라 move 는 가지 않는다", async () => {
    const onStageTap = vi.fn();
    const s = await openResult({ onStageTap });
    tapAt(surface(s.utils), 120, 340);
    expect(onStageTap).toHaveBeenCalledTimes(1);
    expect(s.send).not.toHaveBeenCalled();
  });

  it("끌기(탭이 아님)·입력칸 포커스 중 탭(키보드 닫기)에는 부르지 않는다", async () => {
    const onStageTap = vi.fn();
    const s = await openResult({ onStageTap });
    const el = surface(s.utils);
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 100, clientY: 300 });
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 160, clientY: 300 });
    fireEvent.pointerUp(el, { pointerId: 1, clientX: 160, clientY: 300 });
    expect(onStageTap).not.toHaveBeenCalled();
    const input = document.createElement("input");
    input.setAttribute("data-chat-input", "");
    document.body.appendChild(input);
    input.focus();
    tapAt(el, 120, 340);
    expect(onStageTap).not.toHaveBeenCalled();
    input.remove();
  });

  it("emoteCues: nonce 가 바뀔 때마다 그 좌석의 캐릭터가 동작을 한 번 재생한다", async () => {
    const s = await openResult({ emoteCues: [{ seat: 1, id: "clap", nonce: 1 }, { seat: 3, id: "clap", nonce: 2 }] });
    frames(50);
    // 처음 마운트 때의 값은 지난 일이다
    expect(handleOf(s, 1).playEmote).not.toHaveBeenCalled();
    s.rerender({ emoteCues: [{ seat: 1, id: "clap", nonce: 3 }, { seat: 3, id: "clap", nonce: 2 }] });
    frames(50);
    expect(handleOf(s, 1).playEmote).toHaveBeenCalledTimes(1);
    expect(vi.mocked(handleOf(s, 1).playEmote!).mock.calls[0]![0]).toBe("clap");
    expect(handleOf(s, 3).playEmote).not.toHaveBeenCalled();
    s.rerender({ emoteCues: [{ seat: 1, id: "clap", nonce: 3 }, { seat: 3, id: "clap", nonce: 2 }] });
    frames(50);
    expect(handleOf(s, 1).playEmote).toHaveBeenCalledTimes(1); // 같은 nonce 는 다시 재생하지 않는다
  });

  it("서버 동작과 같은 재생 목록·상한(4)을 쓰고 E2E 훅 playing 에 나타난다", async () => {
    const s = await openResult();
    s.rerender({ emoteCues: [0, 1, 2, 3].map((seat) => ({ seat, id: "clap" as const, nonce: 10 + seat })) });
    frames(50);
    for (const seat of [0, 1, 2, 3]) expect(handleOf(s, seat).playEmote).toHaveBeenCalledTimes(1);
    expect(window.__mfEmotes?.playing).toEqual([0, 1, 2, 3]);
    expect(window.__mfEmotes?.last).toBeNull(); // 받은 프레임이 아니라 화면 연출이다
  });
});

// ---------- 11-12: 결과 장면의 반투명 좌석(쉬었던 사람, SeatLook.opacity) ----------
describe("결과 장면: opacity 0.5 좌석 (11-12)", () => {
  const handleOf = (s: Setup, seat: number): FakeHandle => s.world.renderers[0]!.chars.get(seat) as FakeHandle;
  const openResult = (seats: Record<number, Partial<Omit<SeatLook, "show">>>) => open({ scene: sceneOf(seats) }, { players: FOUR, ents: FOUR_ENTS() });
  const opacities = (h: FakeHandle): number[] => (h.setOpacity as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as number);

  it("opacity 가 있는 좌석만 그 값으로 setOpacity 하고 다른 좌석에는 영향이 없다", async () => {
    const s = await openResult({ 0: {}, 1: { opacity: 0.5 }, 2: {}, 3: {} });
    frames(50);
    expect(opacities(handleOf(s, 1)).at(-1)).toBe(0.5);
    expect(opacities(handleOf(s, 0))).toEqual([]);
    expect(opacities(handleOf(s, 2))).toEqual([]);
  });

  it("같은 값이 계속 와도 setOpacity 를 다시 부르지 않는다", async () => {
    const s = await openResult({ 0: {}, 1: { opacity: 0.5 }, 2: {}, 3: {} });
    frames(50);
    const n = opacities(handleOf(s, 1)).length;
    frames(100);
    expect(opacities(handleOf(s, 1)).length).toBe(n);
  });

  it("opacity 가 사라지면 1 로 돌아온다", async () => {
    const s = await openResult({ 0: {}, 1: { opacity: 0.5 }, 2: {}, 3: {} });
    frames(50);
    s.rerender({ scene: sceneOf({ 0: {}, 1: {}, 2: {}, 3: {} }) });
    frames(50);
    expect(opacities(handleOf(s, 1)).at(-1)).toBe(1);
  });

  it("이름표는 흐려지지 않는다 (몸만 반투명, 연결 끊김과 따로)", async () => {
    const s = await openResult({ 0: {}, 1: { opacity: 0.5 }, 2: {}, 3: {} });
    frames(50);
    expect(tagOf(s.utils, 1)!.style.opacity).toBe("1");
  });
});

// ---------- 15-05 Task 1: 근처 snap 등장·퇴장, onProject, walkTo ----------

describe("런타임 직접: 근처 snap·onProject·walkTo (15페이즈 D-02, UI-SPEC U-17)", () => {
  async function bootRuntime(over: { reduced?: boolean; onProject?: (p: (x: number, z: number) => { sx: number; sy: number } | null, now: number) => void } = {}) {
    const world = makeWorld();
    const store = new WorldStore();
    const host = document.createElement("div");
    const tagLayer = document.createElement("div");
    document.body.append(host, tagLayer);
    for (const seat of [0, 1, 2]) {
      const el = document.createElement("div");
      el.setAttribute("data-seat", String(seat));
      tagLayer.append(el);
    }
    snap(store, [seg(0, [200, 100]), seg(1, [-300, 50])]);
    const players = [player(0, "민지"), player(1, "철수"), player(2, "영희")];
    const runtime = createWorldRuntime({
      host,
      tagLayer,
      store,
      serverNow: () => Date.now(),
      mySeat: () => 0,
      players: () => players,
      reducedMotion: () => over.reduced === true,
      stageRect: () => ({ top: 60, bottom: 500 }),
      onStatus: () => {},
      onNotice: () => {},
      allowSoftware: true,
      loadModules: world.loadModules,
      mapId: () => "bar",
      onProject: over.onProject,
    });
    await act(async () => {
      void runtime.start();
      for (let i = 0; i < 8; i++) await Promise.resolve();
    });
    frame();
    return { world, store, host, tagLayer, runtime };
  }

  function nearSnapFrame(store: WorldStore, ents: WorldSeg[], epoch = 1): void {
    store.applyFrame({ t: "world", k: "snap", at: Date.now(), ents, near: true }, epoch);
  }

  it("onProject 는 프레임마다 한 번 불리고 project(x, z) 는 renderer.project 의 발끝 좌표와 같다", async () => {
    const calls: { sx: number; sy: number }[] = [];
    let n = 0;
    const { runtime } = await bootRuntime({
      onProject: (project) => {
        n++;
        const p = project(3, 2);
        if (p) calls.push(p);
      },
    });
    const before = n;
    frame();
    expect(n).toBe(before + 1);
    expect(calls.at(-1)).toEqual({ sx: 200 + 30, sy: 300 + 20 });
    runtime.dispose();
  });

  it("onProject 를 안 주면 아무 일도 없다", async () => {
    const { runtime } = await bootRuntime();
    frame();
    runtime.dispose();
  });

  it("near snap 으로 새 좌석은 등장 연출(크기 0.6)으로 나타난다", async () => {
    const { world, store, runtime } = await bootRuntime();
    nearSnapFrame(store, [seg(0, [200, 100]), seg(1, [-300, 50]), seg(2, [300, 300])]);
    frame(1);
    const h = world.renderers[0]!.chars.get(2)!;
    expect(h.root.scale.x).toBeCloseTo(0.83 * 0.6, 2);
    frames(ENTER_MS + 40);
    expect(h.root.scale.x).toBeCloseTo(0.83, 6);
    runtime.dispose();
  });

  it("near snap 으로 빠진 좌석은 퇴장 연출을 하고 EXIT_MS 뒤 캐릭터가 사라지며 이름표도 같이 흐려진다", async () => {
    const { world, store, tagLayer, runtime } = await bootRuntime();
    const r = world.renderers[0]!;
    const h = r.chars.get(1)!;
    nearSnapFrame(store, [seg(0, [200, 100])]);
    frame(1); // 첫 프레임이 구간 없음을 알아보고 퇴장을 시작한다
    frame(EXIT_MS / 2);
    expect(r.chars.has(1)).toBe(true);
    expect(h.root.scale.x).toBeLessThan(0.83);
    const tag = tagLayer.querySelector<HTMLElement>('[data-seat="1"]')!;
    expect(Number(tag.style.opacity)).toBeLessThan(1);
    frames(EXIT_MS * 2);
    expect(r.chars.has(1)).toBe(false);
    expect(tag.style.opacity).toBe("0");
    runtime.dispose();
  });

  it("모션 줄이기면 near snap 의 퇴장은 즉시, 등장은 연출 없이 바로 보인다", async () => {
    const { world, store, runtime } = await bootRuntime({ reduced: true });
    nearSnapFrame(store, [seg(0, [200, 100]), seg(2, [300, 300])]);
    frame(16);
    const r = world.renderers[0]!;
    expect(r.chars.has(1)).toBe(false);
    expect(r.chars.get(2)!.root.scale.x).toBeCloseTo(0.83, 6);
    runtime.dispose();
  });

  it("walkTo(x, z) 는 탭과 같이 목적지 링을 띄우고 그 월드 좌표를 돌려준다", async () => {
    const { runtime } = await bootRuntime();
    const at = runtime.walkTo(4, 2.5);
    expect(at).toEqual({ x: 4, z: 2.5 });
    expect(runtime.ring()).toEqual({ x: 4, z: 2.5 });
    runtime.dispose();
  });
});

// ---------- 15-05 Task 2·16-07: errand 층(장소 타일·발밑 화살표·장소 위 [처리] 알약·근처 링) ----------

describe("WorldStage: errand 층 (15페이즈 D-02·D-09, 16페이즈 D-06·D-07, UI-SPEC V-20~V-22)", () => {
  const INS = { top: 60, bottom: 84 };
  // 가짜 렌더러: 발끝 (x, z) → sx = 200 + 10x, sy = 300 + 10z. 내 위치(기본 ents)는 (2, 1) → (220, 310)
  const A = { id: "glass" as const, x: 0, z: 0, done: false }; // (200, 300) 안
  const B = { id: "piano" as const, x: -100, z: 0, done: false }; // (-800, 300) 밖
  const C = { id: "sax" as const, x: 5, z: 5, done: true }; // (250, 350) 안
  const errandProp = (over: Partial<NonNullable<WorldStageProps["errand"]>> = {}): NonNullable<WorldStageProps["errand"]> => ({
    places: [A, B, C],
    nextId: "glass",
    actId: null,
    callPlace: false,
    nearR: 3,
    onWalk: vi.fn(),
    ...over,
  });
  const layer = (s: Setup) => s.utils.container.querySelector<HTMLElement>(".mf-world__errand");
  const actLayer = (s: Setup) => s.utils.container.querySelector<HTMLElement>(".mf-world__errand-act");
  const pin = (s: Setup, id: string) => s.utils.container.querySelector<HTMLElement>(`button[data-errand-place="${id}"]`)!;
  const arrow = (s: Setup) => s.utils.container.querySelector<HTMLElement>("[data-errand-arrow]")!;
  const act = (s: Setup) => s.utils.container.querySelector<HTMLElement>("button[data-errand-act]");

  it("errand prop 이 없으면 층이 DOM 에 없다(회귀)", async () => {
    const s = await open({ stageInsets: INS });
    expect(layer(s)).toBeNull();
    expect(actLayer(s)).toBeNull();
    expect(s.utils.container.querySelector("[data-near-ring]")).toBeNull();
  });

  it("errand prop 이 있으면 장소마다 타일 버튼, 화살표 하나, 링 svg(data-near-ring=nearR) 가 마운트되고 알약은 actId 가 있을 때만 하나다", async () => {
    const s = await open({ stageInsets: INS, errand: errandProp() });
    expect(layer(s)).not.toBeNull();
    expect(s.utils.container.querySelectorAll("button[data-errand-place]")).toHaveLength(3);
    expect(s.utils.container.querySelectorAll("[data-errand-arrow]")).toHaveLength(1);
    expect(s.utils.container.querySelector("svg[data-near-ring]")!.getAttribute("data-near-ring")).toBe("3");
    expect(pin(s, "sax").hasAttribute("data-done")).toBe(true);
    expect(pin(s, "glass").hasAttribute("data-done")).toBe(false);
    expect(s.utils.container.querySelectorAll("[data-errand-act]")).toHaveLength(0);
    s.rerender({ errand: errandProp({ actId: "glass" }) });
    expect(s.utils.container.querySelectorAll("[data-errand-act]")).toHaveLength(1);
    expect(act(s)!.getAttribute("aria-label")).toBe("술잔에서 처리");
    s.rerender({ errand: errandProp({ actId: null }) });
    expect(s.utils.container.querySelectorAll("[data-errand-act]")).toHaveLength(0);
  });

  it("층은 이름표 층보다 DOM 앞에 있고(알약 층도 같다 — z 는 CSS) nearR 값이 바뀌면 속성이 따라간다", async () => {
    const s = await open({ stageInsets: INS, errand: errandProp({ actId: "glass" }) });
    const kids = [...s.utils.container.querySelector("[data-world-stage]")!.children];
    const tags = s.utils.container.querySelector(".mf-world__tags")!;
    expect(kids.indexOf(layer(s)!)).toBeLessThan(kids.indexOf(tags));
    expect(kids.indexOf(actLayer(s)!)).toBeLessThan(kids.indexOf(tags));
    expect(actLayer(s)!.contains(act(s))).toBe(true);
    s.rerender({ errand: errandProp({ nearR: 4 }) });
    expect(s.utils.container.querySelector("svg[data-near-ring]")!.getAttribute("data-near-ring")).toBe("4");
  });

  it("타일을 누르면 onWalk(id) 가 불리고 그 장소로 걷는 move 가 한 번 간다(처리 메시지 없음)", async () => {
    const onWalk = vi.fn();
    const s = await open({ stageInsets: INS, errand: errandProp({ onWalk }) });
    frame();
    fireEvent.click(pin(s, "sax"));
    expect(onWalk).toHaveBeenCalledWith("sax");
    expect(s.send).toHaveBeenCalledTimes(1);
    expect(s.send).toHaveBeenCalledWith({ t: "move", x: 500, z: 500 });
  });

  it("canWalk 가 거짓이면 타일을 눌러도 걷지 않는다", async () => {
    const s = await open({ stageInsets: INS, canWalk: false, errand: errandProp() });
    frame();
    fireEvent.click(pin(s, "sax"));
    expect(s.send).not.toHaveBeenCalled();
  });

  it("프레임마다 스테이지 안(안쪽 8)의 타일은 64 상자 중심이 투영 좌표로 놓이고 화면 밖 타일은 hidden 이다", async () => {
    const s = await open({ stageInsets: INS, errand: errandProp() });
    frame();
    expect(pin(s, "glass").hidden).toBe(false);
    expect(pin(s, "glass").style.transform).toBe("translate(168px, 268px)");
    expect(pin(s, "sax").hidden).toBe(false);
    expect(pin(s, "sax").style.transform).toBe("translate(218px, 318px)");
    expect(pin(s, "piano").hidden).toBe(true);
  });

  it("화살표: 알약이 없으면 내 발밑(220, 310)에서 가장 가까운 장소(glass) 방향으로 56 떨어진 자리에 40 글리프가 선다(타일이 보여도)", async () => {
    const s = await open({ stageInsets: INS, errand: errandProp({ nextId: "glass" }) });
    frame();
    expect(arrow(s).hidden).toBe(false);
    // 방향 (-20, -10)/22.36 → 중심 (220 - 50.08, 310 - 25.04) → 왼쪽 위 모서리 (150, 265)
    expect(arrow(s).style.transform).toBe("translate(150px, 265px)");
    const turn = arrow(s).querySelector<HTMLElement>(".mv-errand-arrow__turn")!;
    const deg = Number(/rotate\((-?[\d.]+)deg\)/.exec(turn.style.transform)![1]);
    expect(deg).toBeCloseTo(-63.4, 1);
    // 목표가 화면 밖(piano, 왼쪽)이어도 같은 규칙: 왼쪽(약 -90°)
    s.rerender({ errand: errandProp({ nextId: "piano" }) });
    frame();
    const deg2 = Number(/rotate\((-?[\d.]+)deg\)/.exec(arrow(s).querySelector<HTMLElement>(".mv-errand-arrow__turn")!.style.transform)![1]);
    expect(deg2).toBeLessThan(-80);
    expect(deg2).toBeGreaterThan(-100);
    // 눌림 통과·포커스 없음: 요소는 span·aria-hidden
    expect(arrow(s).getAttribute("aria-hidden")).toBe("true");
    expect(arrow(s).tagName).toBe("SPAN");
  });

  it("내 위치를 모르거나 다음 장소가 없으면 화살표는 hidden 이고 알약이 있으면 화살표도 hidden 이다", async () => {
    const s = await open({ stageInsets: INS, errand: errandProp({ nextId: "glass" }) }, { ents: [seg(1, [-300, 50])] });
    frame();
    expect(arrow(s).hidden).toBe(true);
    const t = await open({ stageInsets: INS, errand: errandProp({ nextId: null }) });
    frame();
    expect(arrow(t).hidden).toBe(true);
    const u = await open({ stageInsets: INS, errand: errandProp({ nextId: "glass", actId: "glass" }) });
    frame();
    expect(arrow(u).hidden).toBe(true);
  });

  it("알약: actId 장소 타일 위 8 에 서고(중심 y = 300 - 32 - 8 - 22, 폭을 모르면 96) 누르면 onAct 가 한 번 불린다", async () => {
    const onAct = vi.fn();
    const s = await open({ stageInsets: INS, errand: errandProp({ actId: "glass", onAct }) });
    frame();
    const pill = act(s)!;
    expect(pill.hidden).toBe(false);
    expect(pill.style.transform).toBe("translate(152px, 216px)");
    fireEvent.click(pill);
    expect(onAct).toHaveBeenCalledTimes(1);
    expect(s.send).not.toHaveBeenCalled(); // 처리 메시지는 GameMap 몫(onAct) — 층은 보내지 않는다
  });

  it("알약 위가 막히면(스테이지 위 안쪽 8) 타일 아래 8 로 뒤집는다", async () => {
    const s = await open({ stageInsets: { top: 250, bottom: 84 }, errand: errandProp({ actId: "glass" }) });
    frame();
    // 스테이지 top 250 → 안쪽 258, 알약 위 상자 top = 216 < 258 → 아래: 중심 y = 300 + 32 + 8 + 22 = 362 → top 340
    expect(act(s)!.style.transform).toBe("translate(152px, 340px)");
  });

  it("소리 열·오른쪽 열 단추([data-side-button])와 겹치는 타일은 그리지 않는다", async () => {
    const btn = document.createElement("button");
    btn.setAttribute("data-side-button", "sound");
    btn.getBoundingClientRect = () => ({ left: 190, top: 290, right: 242, bottom: 342, width: 52, height: 52, x: 190, y: 290, toJSON() {} }) as DOMRect;
    document.body.append(btn);
    const s = await open({ stageInsets: INS, errand: errandProp({ nextId: "glass" }) });
    frame(600);
    expect(pin(s, "glass").hidden).toBe(true);
    expect(pin(s, "sax").hidden).toBe(true); // (250, 350) 상자 218..282 × 318..382 도 단추(~242, ~342)와 겹친다
    expect(arrow(s).hidden).toBe(false);
    btn.remove();
  });

  it("빛남·후광: 미처리·빛나지 않는 보이는 타일은 data-rest, callPlace 면 가장 가까운 타일만 data-call(is-call), 알약이 있으면 알약만 data-call, 화살표는 켜지지 않는다", async () => {
    const s = await open({ stageInsets: INS, errand: errandProp({ callPlace: true, nextId: "glass" }) });
    frame();
    expect(s.utils.container.querySelectorAll("[data-call]")).toHaveLength(1);
    expect(pin(s, "glass").hasAttribute("data-call")).toBe(true);
    expect(pin(s, "glass").classList.contains("is-call")).toBe(true);
    expect(pin(s, "glass").hasAttribute("data-rest")).toBe(false);
    expect(arrow(s).hasAttribute("data-call")).toBe(false);
    expect(pin(s, "sax").hasAttribute("data-rest")).toBe(false); // 처리한 곳은 후광이 아니다
    expect(pin(s, "piano").hasAttribute("data-rest")).toBe(false); // 안 보이는 타일
    // 다음 장소가 안 보이는 곳이면 어느 타일도 빛나지 않는다(화살표는 방향만 알린다)
    s.rerender({ errand: errandProp({ callPlace: true, nextId: "piano" }) });
    frame();
    expect(s.utils.container.querySelectorAll("[data-call]")).toHaveLength(0);
    expect(pin(s, "glass").hasAttribute("data-rest")).toBe(true);
    // 알약이 있으면 알약만 빛난다(callPlace 가 우연히 참이어도 타일은 켜지 않는다)
    s.rerender({ errand: errandProp({ callPlace: true, nextId: "glass", actId: "glass" }) });
    frame();
    expect(s.utils.container.querySelectorAll("[data-call]")).toHaveLength(1);
    expect(act(s)!.hasAttribute("data-call")).toBe(true);
    expect(act(s)!.classList.contains("is-call")).toBe(true);
    expect(pin(s, "glass").hasAttribute("data-call")).toBe(false);
    expect(pin(s, "glass").hasAttribute("data-rest")).toBe(true); // 후광은 유지
    // 3곳 완료(callPlace 거짓·알약 없음): 맥박 빛 없음
    s.rerender({ errand: errandProp({ callPlace: false, nextId: null, actId: null, places: [{ ...A, done: true }, B, { ...C, done: true }] }) });
    frame();
    expect(s.utils.container.querySelectorAll("[data-call]")).toHaveLength(0);
  });

  it("링: 내 위치를 중심으로 반경 nearR 월드 단위의 24점 다각형이 투영되어 points 가 갱신되고 내 위치가 없으면 hidden", async () => {
    const s = await open({ stageInsets: INS, errand: errandProp() }, { ents: [seg(0, [200, 100]), seg(1, [-300, 50])] });
    frame();
    const ring = s.utils.container.querySelector<SVGElement>("svg[data-near-ring]")!;
    expect(ring.style.display).toBe("");
    const pts = ring.querySelector("polygon")!.getAttribute("points")!.trim().split(/\s+/).map((p) => p.split(",").map(Number));
    expect(pts).toHaveLength(24);
    // 내 위치 (2, 1) → 투영 중심 (220, 310), 반경 3 → 30px
    for (const [x, y] of pts) expect(Math.hypot(x! - 220, y! - 310)).toBeCloseTo(30, 0);
    s.rerender({ view: makeView(TWO, 7) });
    frame();
    expect(ring.style.display).toBe("none");
  });

  it("스타일: 층은 pointer-events none·타일 버튼만 auto, 타일·화살표는 이름표 층보다 한 단 아래, 알약 층은 한 단 위, 링은 점선 굵기 2·정지, hex 없음", () => {
    const css = readFileSync("src/styles/game.css", "utf8");
    const block = (sel: string): string => new RegExp(`${sel.replace(/[.[\]]/g, "\\$&")}\\s*\\{[^}]*\\}`).exec(css)?.[0] ?? "";
    const layerCss = block(".mf-world__errand");
    expect(layerCss).toContain("pointer-events: none");
    expect(layerCss).toContain("calc(var(--z-tags) - 1)");
    const actCss = block(".mf-world__errand-act");
    expect(actCss).toContain("pointer-events: none");
    expect(actCss).toContain("calc(var(--z-tags) + 1)");
    const ringCss = block(".mf-world__ring");
    expect(ringCss).toContain("stroke-dasharray");
    expect(ringCss).toContain("stroke-width: 2");
    expect(ringCss).toContain("var(--gray-50)");
    expect(ringCss).not.toContain("animation");
    expect(layerCss + actCss + ringCss).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    expect(css).toMatch(/\.mf-world__errand > \.mv-errand-pin\s*\{[^}]*pointer-events: auto/);
    expect(css).toMatch(/\.mf-world__errand-act > \.mv-errand-act\s*\{[^}]*left: 0[^}]*top: 0/);
  });

  it("모션 줄이기: 층 쪽에는 애니메이션이 없다(링·타일 채움은 즉시)", async () => {
    stubReducedMotion(true);
    const s = await open({ stageInsets: INS, errand: errandProp() });
    frame();
    const ring = s.utils.container.querySelector<SVGElement>("svg[data-near-ring]")!;
    expect(ring.getAttribute("style") ?? "").not.toContain("animation");
    const css = readFileSync("src/styles/game.css", "utf8");
    expect(css).not.toMatch(/\.mf-world__ring[^{]*\{[^}]*animation/);
  });
});
