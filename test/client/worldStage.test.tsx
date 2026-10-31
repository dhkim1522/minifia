import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { Object3D } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import type { PublicPlayer, RoomView, WorldSeg } from "../../shared/protocol";
import { WorldStage } from "../../src/components/WorldStage";
import type { WorldStageProps } from "../../src/components/WorldStage";
import type { CharacterHandle, RendererStatusEvent, WorldRenderer } from "../../src/world/renderer";
import type { WorldModules } from "../../src/world/runtime";
import { WorldStore } from "../../src/world/store";

// 06-13: 로비 맵 화면(WorldStage + 런타임). happy-dom 에는 WebGL 이 없어 loadModules 로 가짜 렌더러·가짜 캐릭터를 주입한다(가정 A1).
// 실제 GL 경로는 06-14(성능 스파이크)·06-17·06-18(E2E)이 브라우저에서 확인한다.
// 시간: setTimeout·Date 만 가짜로 하고 rAF 는 이 파일이 직접 쥔다(frame()) — 프레임 사이 시간을 테스트가 정한다.

// ---------- 가짜 렌더러·캐릭터 도우미 ----------

export interface FakeRenderer extends WorldRenderer {
  chars: Map<number, CharacterHandle>;
  views: { target: { x: number; z: number }; offsetY: number }[];
  markers: { kind: string; at: { x: number; z: number } | null; scale: number; opacity: number }[];
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
  yaws: number[];
  dims: boolean[];
  moving: boolean[];
  disposed: number;
}

export function makeFakeKit(created: FakeHandle[]): WorldModules["characterKit"] {
  return {
    create(): CharacterHandle {
      const root = new Object3D();
      root.scale.setScalar(0.83); // 진짜 캐릭터도 root.scale = CHAR_SCALE
      const h: FakeHandle = {
        root,
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

async function open(over: Partial<WorldStageProps> = {}, opts: { strict?: boolean; ents?: WorldSeg[]; players?: PublicPlayer[]; mySeat?: number } = {}): Promise<Setup> {
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
  snap(store, opts.ents ?? [seg(0, [200, 100]), seg(1, [-300, 50])]);
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

  it("150ms 안의 다음 탭은 무시한다", async () => {
    const s = await open();
    const el = surface(s.utils);
    tapAt(el, 250, 340, 10);
    tapAt(el, 260, 350, 10);
    expect(s.send).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(200);
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

describe("WorldStage: 서버 구간대로 걷기와 카메라 (MAP-02, MAP-03)", () => {
  it("서버 구간 전에는 내 캐릭터가 움직이지 않는다(예측 이동 없음)", async () => {
    const s = await open();
    const mine = s.world.renderers[0]!.chars.get(0)!;
    const x0 = mine.root.position.x;
    tapAt(surface(s.utils), 250, 340);
    frames(400);
    expect(mine.root.position.x).toBeCloseTo(x0, 6);
    expect(mine.root.position.z).toBeCloseTo(1, 6);
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
    // 첫 값은 입장 지점의 방향, 그 뒤는 걷는 동안의 이동 방향뿐이다(멈춘 뒤에도 바뀌지 않는다)
    const afterSpawn = mine.yaws.slice(1);
    expect(afterSpawn.length).toBeGreaterThan(0);
    expect(afterSpawn.every((y) => Math.abs(y - Math.PI / 2) < 1e-4)).toBe(true);
    expect(mine.moving.at(-1)).toBe(false);
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
