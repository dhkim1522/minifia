import { act, cleanup } from "@testing-library/react";
import { Object3D } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import type { PublicPlayer, WorldSeg } from "../../shared/protocol";
import type { CharacterHandle, WorldRenderer } from "../../src/world/renderer";
import { createWorldRuntime } from "../../src/world/runtime";
import type { WorldModules } from "../../src/world/runtime";
import type { SceneLook, SeatLook } from "../../src/world/presence";
import { installWorldTestHooks } from "../../src/world/testHooks";
import { WorldStore } from "../../src/world/store";

// 24-05: SceneLook.notes → 런타임 setScene → 캐릭터 핸들 setNotes. 가짜 렌더러·가짜 캐릭터(setNotes 호출을 기록)로 호출 값·횟수를 단언한다.
// rAF 는 이 파일이 쥔다(frame()). 진짜 three·캐릭터는 24-04 가 단위 시험으로, 모양은 24-10 스크린샷이 본다.

interface NoteCall {
  from: number[];
  animate: boolean;
}
interface FakeHandle extends CharacterHandle {
  noteCalls: NoteCall[];
  ghostCalls: boolean[];
}

function makeFakeRenderer(): WorldRenderer {
  const chars = new Map<number, CharacterHandle>();
  const r = {
    canvas: document.createElement("canvas"),
    chars,
    resize: vi.fn(),
    setView: vi.fn(),
    setLighting: vi.fn(),
    setZoom: vi.fn(),
    setTension: vi.fn(),
    setPin: vi.fn(),
    setChalk: vi.fn(),
    setSelfLight: vi.fn(),
    addCharacter: (seat: number, c: CharacterHandle) => chars.set(seat, c),
    removeCharacter: (seat: number) => chars.delete(seat),
    setMarker: vi.fn(),
    project: (p: { x: number; y: number; z: number }) => ({ sx: 200 + p.x * 10, sy: 300 + p.z * 10 - p.y * 10 }),
    groundAt: vi.fn(() => ({ x: 0, z: 0 })),
    render: vi.fn(),
    setBudget: vi.fn(),
    onStatus: () => () => {},
    recreate: vi.fn(async () => {}),
    isContextLost: () => false,
    info: vi.fn(() => ({ calls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0, pointLights: 0 })),
    debugLoseContext: vi.fn(),
    debugRestoreContext: vi.fn(),
    dispose: vi.fn(),
  };
  return r as unknown as WorldRenderer;
}

function makeKit(): WorldModules["characterKit"] {
  return {
    ghostReady: () => true,
    create(): CharacterHandle {
      const root = new Object3D();
      root.scale.setScalar(0.83);
      let last: number[] = [];
      const h: FakeHandle = {
        root,
        noteCalls: [],
        ghostCalls: [],
        update: vi.fn(() => ({ headY: 1.8 })),
        setYaw: vi.fn(),
        setDim: vi.fn(),
        dispose: vi.fn(),
        setGhost: vi.fn((on: boolean) => {
          h.ghostCalls.push(on);
          if (on) last = [];
        }),
        applyOutfit: vi.fn(),
        setOpacity: vi.fn(),
        holdPose: vi.fn(),
        setRing: vi.fn(),
        setPickMark: vi.fn(),
        playEmote: vi.fn(),
        stopEmote: vi.fn(),
        prewarm: vi.fn(),
        setFace: vi.fn(),
        setNotes: vi.fn((from: readonly number[], opts: { animate: boolean }) => {
          h.noteCalls.push({ from: [...from], animate: opts.animate });
          last = [...from];
        }),
        noteCounts: () => ({ total: last.length, visible: Math.min(3, last.length) }),
      } as FakeHandle;
      return h;
    },
  } as unknown as WorldModules["characterKit"];
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

function frame(ms = 16): void {
  act(() => {
    vi.advanceTimersByTime(ms);
    const cbs = [...rafCbs.values()];
    rafCbs.clear();
    for (const cb of cbs) cb(Date.now());
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
});

// ---------- 장면 ----------

const player = (seat: number): PublicPlayer => ({ seat, nickname: `p${seat}`, connected: true, isHost: seat === 0 });
const seg = (s: number, p: number[]): WorldSeg => ({ s, p, t0: Date.now(), v: 180 });

const sceneOf = (seats: Record<number, Partial<Omit<SeatLook, "show">>>, notes?: Record<number, number[]>): SceneLook => ({
  camera: { mode: "follow" },
  lighting: "talk",
  tension: 0,
  seats: Object.fromEntries(Object.entries(seats).map(([k, v]) => [k, { show: true, ghost: false, ...v } as SeatLook])),
  ...(notes !== undefined ? { notes } : {}),
});

const ENTS = (): WorldSeg[] => [seg(0, [200, 100]), seg(1, [-300, 50]), seg(2, [-100, 400]), seg(3, [400, -200])];

interface Boot {
  runtime: ReturnType<typeof createWorldRuntime>;
  store: WorldStore;
  handles: Map<number, FakeHandle>;
}

/** 좌석 → 핸들 대응은 렌더러가 addCharacter 로 받은 표를 쓴다 */
async function boot(first: SceneLook | null, opts: { reduced?: boolean; ents?: WorldSeg[] } = {}): Promise<Boot> {
  const renderer = makeFakeRenderer();
  const store = new WorldStore();
  const host = document.createElement("div");
  const tagLayer = document.createElement("div");
  document.body.append(host, tagLayer);
  for (const seat of [0, 1, 2, 3]) {
    const el = document.createElement("div");
    el.setAttribute("data-seat", String(seat));
    tagLayer.append(el);
  }
  store.applyFrame({ t: "world", k: "snap", at: Date.now(), ents: opts.ents ?? ENTS() }, 1);
  const players = [0, 1, 2, 3].map(player);
  const kit = makeKit();
  const modules = { createThreeRenderer: vi.fn(async () => renderer), characterKit: kit } as unknown as WorldModules;
  const runtime = createWorldRuntime({
    host,
    tagLayer,
    store,
    serverNow: () => Date.now(),
    mySeat: () => 0,
    players: () => players,
    reducedMotion: () => opts.reduced === true,
    stageRect: () => ({ top: 60, bottom: 500 }),
    onStatus: () => {},
    onNotice: () => {},
    allowSoftware: true,
    loadModules: () => Promise.resolve(modules),
    mapId: () => "bar",
  });
  runtime.setScene(first);
  await act(async () => {
    void runtime.start();
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
  frame();
  const chars = (renderer as unknown as { chars: Map<number, FakeHandle> }).chars;
  return { runtime, store, handles: chars };
}

describe("종이 장면 배선 (24-05, D-06·D-11, P24-15)", () => {
  it("첫 프레임의 notes 는 모션 없이 상태만 맞춘다(animate false)", async () => {
    const b = await boot(sceneOf({ 0: {}, 1: {}, 2: {}, 3: {} }, { 2: [0] }));
    expect(b.handles.get(2)!.noteCalls).toEqual([{ from: [0], animate: false }]);
    expect(b.handles.get(0)!.noteCalls).toEqual([]);
    b.runtime.dispose();
  });

  it("다음 setScene 에서 목록이 늘면 animate true, 같은 목록이면 다시 부르지 않는다(T-24-15)", async () => {
    const seats = { 0: {}, 1: {}, 2: {}, 3: {} };
    const b = await boot(sceneOf(seats, { 2: [0] }));
    b.runtime.setScene(sceneOf(seats, { 2: [0, 1] }));
    frame();
    expect(b.handles.get(2)!.noteCalls).toEqual([
      { from: [0], animate: false },
      { from: [0, 1], animate: true },
    ]);
    b.runtime.setScene(sceneOf(seats, { 2: [0, 1] }));
    frame();
    frame();
    expect(b.handles.get(2)!.noteCalls).toHaveLength(2);
    b.runtime.dispose();
  });

  it("옮김(같은 길이·다른 원소)도 다시 부른다", async () => {
    const seats = { 0: {}, 1: {}, 2: {}, 3: {} };
    const b = await boot(sceneOf(seats, { 2: [0] }));
    b.runtime.setScene(sceneOf(seats, { 3: [0] }));
    frame();
    expect(b.handles.get(2)!.noteCalls.at(-1)).toEqual({ from: [], animate: true });
    expect(b.handles.get(3)!.noteCalls).toEqual([{ from: [0], animate: true }]);
    b.runtime.dispose();
  });

  it("notes 가 빈 look(다음 날)이 오면 animate true 로 빈 목록(떨어짐)", async () => {
    const seats = { 0: {}, 1: {}, 2: {}, 3: {} };
    const b = await boot(sceneOf(seats, { 2: [0, 1] }));
    b.runtime.setScene(sceneOf(seats));
    frame();
    expect(b.handles.get(2)!.noteCalls.at(-1)).toEqual({ from: [], animate: true });
    b.runtime.dispose();
  });

  it("모션 줄이기면 늘 animate false", async () => {
    const seats = { 0: {}, 1: {}, 2: {}, 3: {} };
    const b = await boot(sceneOf(seats, { 2: [0] }), { reduced: true });
    b.runtime.setScene(sceneOf(seats, { 2: [0, 1] }));
    frame();
    b.runtime.setScene(sceneOf(seats));
    frame();
    expect(b.handles.get(2)!.noteCalls.map((c) => c.animate)).toEqual([false, false, false]);
    b.runtime.dispose();
  });

  it("핸들이 나중에 생긴 좌석은 생기는 순간 현재 목록을 animate false 로 받는다", async () => {
    const seats = { 0: {}, 1: {}, 2: {}, 3: {} };
    const b = await boot(sceneOf(seats, { 3: [1] }), { ents: [seg(0, [200, 100]), seg(1, [-300, 50]), seg(2, [-100, 400])] });
    expect(b.handles.has(3)).toBe(false);
    b.runtime.setScene(sceneOf(seats, { 3: [1, 2] }));
    frame();
    b.store.applyFrame({ t: "world", k: "move", s: 3, p: [400, -200], t0: Date.now(), v: 180 }, 1);
    frame();
    frame();
    expect(b.handles.get(3)!.noteCalls).toEqual([{ from: [1, 2], animate: false }]);
    b.runtime.dispose();
  });

  it("좌석이 ghost 가 되면 모션 없이 빈 목록(P24-17), 다시 산 사람이 되면 목록을 모션 없이 다시 받는다", async () => {
    const b = await boot(sceneOf({ 0: {}, 1: {}, 2: {}, 3: {} }, { 2: [0] }));
    b.runtime.setScene(sceneOf({ 0: {}, 1: {}, 2: { ghost: true }, 3: {} }, { 2: [0] }));
    frame();
    expect(b.handles.get(2)!.noteCalls.at(-1)).toEqual({ from: [], animate: false });
    b.runtime.setScene(sceneOf({ 0: {}, 1: {}, 2: {}, 3: {} }, { 2: [0] }));
    frame();
    expect(b.handles.get(2)!.noteCalls.at(-1)).toEqual({ from: [0], animate: false });
    b.runtime.dispose();
  });

  it("처음부터 ghost 인 좌석에는 notes 가 와도 붙이지 않는다", async () => {
    const b = await boot(sceneOf({ 0: {}, 1: {}, 2: { ghost: true }, 3: {} }, { 2: [0] }));
    expect(b.handles.get(2)!.noteCalls.every((c) => c.from.length === 0)).toBe(true);
    b.runtime.dispose();
  });

  it("장면이 없으면(로비) setNotes 를 부르지 않는다", async () => {
    const b = await boot(null);
    for (const h of b.handles.values()) expect(h.noteCalls).toEqual([]);
    b.runtime.dispose();
  });

  it("suspectNotes() 는 핸들 noteCounts 로 좌석별 {total, visible} 을 돌려주고 종이 없는 좌석은 키가 없다", async () => {
    const b = await boot(sceneOf({ 0: {}, 1: {}, 2: {}, 3: {} }, { 2: [0, 1, 3, 1, 0] }));
    expect(b.runtime.suspectNotes()).toEqual({ 2: { total: 5, visible: 3 } });
    b.runtime.dispose();
  });
});

describe("window.__mfWorld.suspectNotes (24-05, D-27, T-24-14)", () => {
  it("런타임의 suspectNotes 를 그대로 노출한다(공개 값 {total, visible} 뿐)", () => {
    const rt = {
      sample: () => null,
      shown: () => null,
      ring: () => null,
      status: () => ({ status: "ready" as const }),
      interactiveMs: () => null,
      renderer: () => null,
      suspectNotes: () => ({ 2: { total: 4, visible: 3 } }),
    };
    const off = installWorldTestHooks(rt as never, new WorldStore());
    expect(window.__mfWorld?.suspectNotes()).toEqual({ 2: { total: 4, visible: 3 } });
    off();
    expect(window.__mfWorld).toBeUndefined();
  });

  it("런타임이 훅을 내주지 않으면 빈 표", () => {
    const rt = { sample: () => null, shown: () => null, ring: () => null, status: () => ({ status: "ready" as const }), interactiveMs: () => null, renderer: () => null };
    const off = installWorldTestHooks(rt as never, new WorldStore());
    expect(window.__mfWorld?.suspectNotes()).toEqual({});
    off();
  });
});
