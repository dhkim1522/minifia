/// <reference types="node" />
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoleId } from "../../shared/game/roles";
import type { GameWinner, MorningView, PhaseId, RoomView, SpectateView } from "../../shared/protocol";
import type { SceneLook } from "../../src/world/presence";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { ResultScreen } from "../../src/screens/ResultScreen";

// 분위기 두 층(05-03, LOOK-01, D-04·D-05·D-09). 08-27 에서 옛 고정 테이블 장면(밤 비네팅·아침 밝아짐 층)이 아니라 GameMap 기준으로 다시 썼다:
// 밤의 어두움·아침의 밝음은 이제 맵 장면 표의 조명(lighting)이 맡는다. v1.0 비네팅·밝아짐 층은 맵 화면 어느 단계에도 그려지지 않고,
// 역할·관전 여부가 조명을 바꾸지 않는다(D-09, T-05-07). 런타임(three)만 가짜로 바꿔 장면 표(setScene)를 읽는다. 실제로 그려지는 밝기는 08-24 E2E 몫이다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

const rt = vi.hoisted(() => ({ scenes: [] as unknown[] }));
vi.mock("../../src/world/runtime", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/world/runtime")>();
  return {
    ...real,
    createWorldRuntime: () => ({
      start: () => Promise.resolve(),
      syncPlayers: () => {},
      deny: () => {},
      setScene: (look: unknown) => rt.scenes.push(look),
      tap: () => ({ x: 1, z: 1 }),
      notifyMoveSent: () => {},
      cancelMove: () => {},
      retry: () => Promise.resolve(),
      dispose: () => {},
      sample: () => null,
      renderer: () => null,
      characterOf: () => null,
      ring: () => null,
      shown: () => null,
      status: () => ({ status: "ready" }),
      interactiveMs: () => null,
    }),
  };
});

const { RoomScreen } = await import("../../src/screens/RoomScreen");

const NOW = 10_000;
const NAMES = ["지우", "하윤", "민지", "도현", "서연"];

interface ViewOpts {
  phase?: PhaseId;
  role?: RoleId;
  allies?: number[];
  dead?: number[];
  morning?: MorningView;
  spectate?: SpectateView;
}

function makeView(o: ViewOpts = {}): RoomView {
  const me: RoomView["me"] = { seat: 0, isHost: false };
  if (o.role !== undefined) me.role = o.role;
  if (o.allies !== undefined) me.allies = o.allies;
  const dead = o.dead ?? [];
  const phase = o.phase ?? "night";
  const view: RoomView = {
    code: "0042",
    phase,
    phaseEndsAt: NOW + (phase === "morning" ? 5_000 : 30_000),
    phaseDurationMs: phase === "morning" ? 5_000 : 30_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: NAMES.map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0, alive: !dead.includes(seat) })),
    me,
    day: { n: 1, roles: ["mafia", "police", "doctor", "citizen"] },
  };
  if (o.morning !== undefined && view.day) view.day.morning = o.morning;
  if (o.spectate) view.spectate = o.spectate;
  return view;
}

function conn(view: RoomView, over: Partial<RoomConnection> = {}): RoomConnection {
  return {
    status: "open",
    banner: "hidden",
    view,
    offset: 0,
    epoch: 1,
    removedReason: null,
    canSend: true,
    send: vi.fn(() => true),
    onEvent: vi.fn(() => () => {}),
    reconnect: vi.fn(),
    retry: vi.fn(),
    ...over,
  };
}

function scene(view: RoomView) {
  connectionMock.current = conn(view);
  const ui = () => <RoomScreen code="0042" token={"t".repeat(43)} onExit={() => {}} />;
  const utils = render(ui());
  const show = (v: RoomView) => {
    const prev = connectionMock.current as RoomConnection;
    connectionMock.current = conn(v, { send: prev.send, onEvent: prev.onEvent, epoch: prev.epoch });
    utils.rerender(ui());
  };
  return { ...utils, show };
}

const lighting = (): string => (rt.scenes[rt.scenes.length - 1] as SceneLook).lighting;
/** v1.0 장면 상자 안의 분위기 층: 밤 비네팅(배경 그림 층 안)과 아침 밝아짐(테이블 앞 형제) */
const oldLayers = (c: HTMLElement) => c.querySelectorAll(".mf-backdrop__vignette, .mf-morningglow, .mf-dt__dim, .mf-backdrop__art").length;

beforeEach(() => {
  rt.scenes.length = 0;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("밤 분위기 — 맵 조명 night (D-04·D-05)", () => {
  it("밤 렌더(재접속처럼 첫 렌더가 밤): 조명 night 이고 v1.0 비네팅·그림 층은 그려지지 않는다", () => {
    const { container } = scene(makeView({ phase: "night", role: "citizen" }));
    expect(lighting()).toBe("nightCitizen"); // 09-10: 밤·산 시민 편은 거의 깜깜한 조명
    expect(oldLayers(container)).toBe(0);
  });

  it("밤이 아닌 낮 단계(낮 시작·토론·지목·변론·찬반·처형)와 아침의 조명은 night 가 아니다", () => {
    const seen = (["dayAnnounce", "discussion", "nomination", "defense", "verdict", "execution", "morning"] as PhaseId[]).map((phase) => {
      rt.scenes.length = 0;
      const r = scene(makeView({ phase, role: "citizen", ...(phase === "morning" ? { morning: {} } : {}) }));
      const l = lighting();
      r.unmount();
      return `${phase}:${l}`;
    });
    expect(seen.join(",")).toBe("dayAnnounce:talk,discussion:talk,nomination:vote,defense:trial,verdict:vote,execution:trial,morning:morning");
  });

  it("결과 화면(ended, 같은 night 그림)에는 비네팅이 0개", () => {
    const seats = NAMES.map((_, seat) => ({ seat, job: (seat === 3 ? "mafia" : "citizen") as RoleId }));
    const view = {
      ...makeView({ phase: "ended", role: "citizen" }),
      result: { winner: "citizenWin" as GameWinner, seats, summary: [] },
    } as RoomView & { result: NonNullable<RoomView["result"]> };
    const { container } = render(<ResultScreen view={view} onExit={() => {}} />);
    expect(container.querySelector('.mf-backdrop__art[data-scene="night"]') !== null).toBe(true);
    expect(container.querySelectorAll(".mf-backdrop__vignette").length).toBe(0);
  });

  it("discussion → night → morning: 조명이 단계를 따라 talk → night → morning 으로 바뀌고 같은 맵 장면 안에서 바뀐다(층이 새로 생기지 않는다)", () => {
    const r = scene(makeView({ phase: "discussion", role: "citizen" }));
    const stage = r.container.querySelector("[data-game-stage]");
    expect(lighting()).toBe("talk");
    r.show(makeView({ phase: "night", role: "citizen" }));
    expect(lighting()).toBe("nightCitizen");
    expect(oldLayers(r.container)).toBe(0);
    r.show(makeView({ phase: "morning", role: "citizen", morning: {} }));
    expect(lighting()).toBe("morning");
    expect(oldLayers(r.container)).toBe(0);
    expect(r.container.querySelector("[data-game-stage]")).toBe(stage);
  });

  it("4역할·관전자 viewer 의 밤 렌더에서 조명이 시민 편 셋 같고(마피아·유령은 따로) v1.0 층이 없다 (D-09, T-05-07)", () => {
    const spectate: SpectateView = { seats: NAMES.map((_, seat) => ({ seat, job: seat === 1 ? "mafia" : "citizen" })) };
    const cases: Array<[string, ViewOpts]> = [
      ["citizen", { role: "citizen" }],
      ["mafia", { role: "mafia", allies: [1] }],
      ["police", { role: "police" }],
      ["doctor", { role: "doctor" }],
      ["spectator", { role: "citizen", dead: [0], spectate }],
    ];
    const out = cases.map(([name, o]) => {
      rt.scenes.length = 0;
      const r = scene(makeView({ phase: "night", ...o }));
      const s = `${lighting()}|${oldLayers(r.container)}`;
      r.unmount();
      return [name, s] as const;
    });
    // 09-10: 밤 조명은 보는 사람마다 다르다 — 시민·경찰·의사 nightCitizen, 마피아 night, 유령 nightGhost. v1.0 층은 누구에게도 없다.
    const byName = Object.fromEntries(out);
    expect(byName).toEqual({ citizen: "nightCitizen|0", mafia: "night|0", police: "nightCitizen|0", doctor: "nightCitizen|0", spectator: "nightGhost|0" });
  });
});

describe("아침 분위기 — 맵 조명 morning (D-05)", () => {
  it("재접속처럼 첫 렌더가 아침: 조명 morning 이고 v1.0 밝아짐 층·어둡게 층은 없다", () => {
    const { container } = scene(makeView({ phase: "morning", role: "citizen", morning: { eliminated: 2 } }));
    expect(lighting()).toBe("morning");
    expect(oldLayers(container)).toBe(0);
  });

  it("morning 을 벗어나면(다음 낮 토론) 조명이 morning 에서 talk 로 돌아온다", () => {
    const r = scene(makeView({ phase: "night", role: "citizen" }));
    r.show(makeView({ phase: "morning", role: "citizen", morning: {} }));
    expect(lighting()).toBe("morning");
    r.show(makeView({ phase: "discussion", role: "citizen" }));
    expect(lighting()).toBe("talk");
  });

  it("4역할·관전자 viewer 의 아침 렌더에서 조명이 같고 v1.0 층이 없다 (D-09, T-05-07)", () => {
    const spectate: SpectateView = { seats: NAMES.map((_, seat) => ({ seat, job: seat === 1 ? "mafia" : "citizen" })) };
    const cases: Array<[string, ViewOpts]> = [
      ["citizen", { role: "citizen" }],
      ["mafia", { role: "mafia", allies: [1] }],
      ["police", { role: "police" }],
      ["doctor", { role: "doctor" }],
      ["spectator", { role: "citizen", dead: [0], spectate }],
    ];
    const out = cases.map(([name, o]) => {
      rt.scenes.length = 0;
      const r = scene(makeView({ phase: "morning", morning: { eliminated: 2 }, ...o }));
      const s = `${lighting()}|${oldLayers(r.container)}`;
      r.unmount();
      return [name, s] as const;
    });
    expect(out[0]![1]).toBe("morning|0");
    expect(out.filter(([, s]) => s !== out[0]![1]).map(([n]) => n).join(",")).toBe("");
  });
});
