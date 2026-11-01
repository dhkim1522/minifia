import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { Object3D } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage, MemoryStorage } from "../helpers/memoryStorage";
import { BAR_MAP, snapToWalkable } from "../../shared/game/map";
import { segmentEndsAt } from "../../shared/game/world";
import type { PublicPlayer, RoomView, WorldSeg } from "../../shared/protocol";
import { WorldStage } from "../../src/components/WorldStage";
import { NETWORK_TEXT } from "../../src/net/copy";
import type { WorldStageProps } from "../../src/components/WorldStage";
import { UnsupportedRendererError } from "../../src/world/renderer";
import type { CharacterHandle, RendererStatusEvent, WorldRenderer } from "../../src/world/renderer";
import { stageOffsetY } from "../../src/world/camera";
import { ENTER_MS, EXIT_MS, MOVE_ACK_TIMEOUT_MS, WALK_CUE_KEY } from "../../src/world/runtime";
import type { WorldModules } from "../../src/world/runtime";
import { installWorldTestHooks, WORLD_TEST_KEY, worldTestHooksEnabled } from "../../src/world/testHooks";
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
    const s = await open();
    frame();
    const z0 = Number(tagOf(s.utils, 0)!.style.zIndex);
    const z1 = Number(tagOf(s.utils, 1)!.style.zIndex);
    expect(z0).toBeGreaterThan(z1); // seat 0 발 sy 310 > seat 1 발 sy 305
    move(s.store, seg(1, [200, 400], Date.now(), 180)); // seat 1 이 더 앞(z=4)으로 간다
    frame();
    expect(Number(tagOf(s.utils, 1)!.style.zIndex)).toBeGreaterThan(Number(tagOf(s.utils, 0)!.style.zIndex));
  });

  it("같은 자리에 8명이 모여도 이름표는 서로 다른 순위를 갖고 모두 같은 좌표다(밀지 않음)", async () => {
    const players = Array.from({ length: 8 }, (_, i) => player(i, `사람${i}`));
    const ents = players.map((p) => seg(p.seat, [100, 100]));
    const s = await open({}, { players, ents });
    frame();
    const styles = players.map((p) => tagOf(s.utils, p.seat)!.getAttribute("style")!.match(/translate\([^)]*\)/)![0]);
    expect(new Set(styles).size).toBe(1);
    const zs = players.map((p) => Number(tagOf(s.utils, p.seat)!.style.zIndex));
    expect(new Set(zs).size).toBe(8);
  });

  it("이름표 안에서 닉네임은 텍스트로만 그려진다", async () => {
    const players = [player(0, "<img src=x onerror=alert(1)>"), player(1, "철수")];
    const s = await open({}, { players });
    expect(s.utils.container.querySelector(".mf-world__tags img")).toBeNull();
    expect(tagOf(s.utils, 0)!.textContent).toContain("<img src=x onerror=alert(1)>");
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
    expect(s.utils.container.querySelector("[class*='mf-table'], [class*='mf-dayscene']")).toBeNull();
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
    expect(r.views.at(-1)!.target.x).toBeCloseTo(Math.min(4.8, pos.x), 6);
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
      { sample: () => null, ring: () => null, status: () => ({ status: "ready", lostAt: null }), interactiveMs: () => null, renderer: () => null },
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
