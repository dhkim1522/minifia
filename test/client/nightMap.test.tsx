import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import type { RoleId } from "../../shared/game/roles";
import type { ClientMessage, PhaseId, PublicPlayer, RoomView, SpectatePicks } from "../../shared/protocol";
import type { SceneLook } from "../../src/world/presence";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 08-18: 밤·아침 임시 틀(DAY-07, GHOST-02). RoomScreen 을 거쳐 GameMap 을 그리고 WorldStage 는 진짜를 쓴다 —
// 이름표(data-pick·data-ring-kind)는 WorldStage 가 그리는 DOM 이라서다. 런타임(three)만 가짜로 바꿔 장면 표(setScene)를 읽는다. (08-17 ghostView 와 같은 방식)
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

const rt = vi.hoisted(() => ({ scenes: [] as unknown[], created: 0 }));
vi.mock("../../src/world/runtime", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/world/runtime")>();
  return {
    ...real,
    createWorldRuntime: () => {
      rt.created += 1;
      return {
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
      };
    },
  };
});

const { RoomScreen } = await import("../../src/screens/RoomScreen");

const NAMES = ["민수", "영희", "서준", "지아", "도윤", "하은", "유진", "태오"];
// 0 마피아 · 1 경찰 · 2 의사 · 3 시민 · 4 마피아 · 5 시민
const JOBS: RoleId[] = ["mafia", "police", "doctor", "citizen", "mafia", "citizen", "citizen", "citizen"];
const NOW = 1_700_000_000_000;

const player = (seat: number, extra: Partial<PublicPlayer> = {}): PublicPlayer => ({
  seat,
  nickname: NAMES[seat] ?? `p${seat}`,
  connected: true,
  isHost: seat === 0,
  ...extra,
});

interface ViewOpts {
  phase?: PhaseId;
  count?: number;
  mySeat?: number;
  dead?: number[];
  /** 서버가 이 사람에게 싣는 밤 정보 */
  pick?: number;
  allyPicks?: number[];
  /** 탈락한 본인에게 싣는 밤 선택 */
  picks?: SpectatePicks;
  morning?: { eliminated?: number; phrase?: number };
  noExecution?: "tie" | "noVotes";
}

function makeView(o: ViewOpts = {}): RoomView {
  const count = o.count ?? 6;
  const mySeat = o.mySeat ?? 0;
  const phase = o.phase ?? "night";
  const dead = o.dead ?? [];
  const meDead = dead.includes(mySeat);
  const role = JOBS[mySeat] ?? "citizen";
  const players = Array.from({ length: count }, (_, seat) => player(seat, dead.includes(seat) ? { alive: false } : {}));
  const allies = JOBS.flatMap((j, s) => (j === "mafia" && s !== mySeat && s < count ? [s] : []));
  const chat = meDead ? "ghost" : phase === "night" ? (role === "mafia" ? "mafia" : undefined) : "all";
  const view: RoomView = {
    code: "0042",
    phase,
    phaseEndsAt: NOW + 30_000,
    phaseDurationMs: 30_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: {
      seat: mySeat,
      isHost: mySeat === 0,
      role,
      ...(role === "mafia" ? { allies } : {}),
      ...(chat !== undefined ? { chat } : {}),
      ...(o.pick !== undefined ? { pick: o.pick } : {}),
      ...(o.allyPicks !== undefined ? { allyPicks: o.allyPicks } : {}),
    },
    day: {
      n: 1,
      roles: [],
      ...(o.morning ? { morning: o.morning } : {}),
      ...(o.noExecution ? { noExecution: { reason: o.noExecution } } : {}),
    },
  } as RoomView;
  if (meDead) {
    view.spectate = {
      seats: players.map((p) => ({ seat: p.seat, job: JOBS[p.seat] ?? "citizen" })),
      ...(o.picks ? { picks: o.picks } : {}),
    };
  }
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

const mount = (view: RoomView, over: Partial<RoomConnection> = {}) => {
  connectionMock.current = conn(view, over);
  const ui = () => <RoomScreen code="0042" token={"t".repeat(43)} onExit={() => {}} />;
  const r = render(ui());
  return {
    ...r,
    show: (v: RoomView, o: Partial<RoomConnection> = {}) => {
      const prev = connectionMock.current as RoomConnection;
      connectionMock.current = conn(v, { send: prev.send, onEvent: prev.onEvent, epoch: prev.epoch, ...o });
      r.rerender(ui());
    },
  };
};

const lastScene = (): SceneLook => rt.scenes[rt.scenes.length - 1] as SceneLook;
const pickSeats = (c: ParentNode): number[] => [...c.querySelectorAll<HTMLElement>("[data-pick]")].map((b) => Number(b.dataset.pick));
const ringOf = (c: ParentNode, seat: number): string | null => c.querySelector(`[data-seat="${seat}"]`)?.getAttribute("data-ring-kind") ?? null;
const ringSeats = (c: ParentNode): number[] => [...c.querySelectorAll<HTMLElement>("[data-ring-kind]")].map((t) => Number(t.dataset.seat));

beforeEach(() => {
  rt.scenes.length = 0;
  rt.created = 0;
  installMemoryStorage();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("밤 임시 틀 트레이서 — 산 마피아 이름표 하나 (A1, GHOST-02)", () => {
  it("산 마피아 밤: 자신·동료를 뺀 산 좌석만 이름표 버튼이 된다(마피아-마피아 거부 규칙을 화면이 먼저 막는다)", () => {
    const { container } = mount(makeView({ mySeat: 0 }));
    expect(container.querySelector("main.mf-game")?.getAttribute("data-phase")).toBe("night");
    expect(pickSeats(container)).toEqual([1, 2, 3, 5]);
  });

  it("이름표를 누르면 pick 을 보내고, 서버 view(me.pick·allyPicks)가 오면 고른 좌석과 동료가 고른 좌석 발밑 고리가 마피아 종류다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(makeView({ mySeat: 0 }), { send });
    expect(ringSeats(m.container)).toEqual([]);
    fireEvent.click(m.container.querySelector('[data-pick="2"]')!);
    expect(send.mock.calls.filter(([x]) => x.t === "pick")).toEqual([[{ t: "pick", target: 2 }]]);
    m.show(makeView({ mySeat: 0, pick: 2, allyPicks: [3] }));
    expect(ringOf(m.container, 2)).toBe("mafia");
    expect(ringOf(m.container, 3)).toBe("mafia");
    expect(ringSeats(m.container).sort()).toEqual([2, 3]);
    expect(m.container.querySelector('[data-pick="2"]')?.getAttribute("aria-pressed")).toBe("true");
  });

  it("산 시민 밤: 이름표 버튼 0개", () => {
    const { container } = mount(makeView({ mySeat: 3 }));
    expect(pickSeats(container)).toEqual([]);
  });

  it("낮 시작부터 아침까지 단계가 바뀌어도 맵(WorldStage)은 같은 노드이고 다시 열리지 않는다(DAY-07)", () => {
    const m = mount(makeView({ phase: "nomination", mySeat: 3 }));
    const stage = m.container.querySelector("[data-world-stage]");
    expect(stage).not.toBeNull();
    const created = rt.created;
    for (const phase of ["night", "morning", "dayAnnounce"] as const) {
      m.show(makeView({ phase, mySeat: 3 }));
      expect(m.container.querySelector("[data-world-stage]"), phase).toBe(stage);
      expect(m.container.querySelector("main.mf-game"), phase).not.toBeNull();
    }
    expect(rt.created).toBe(created);
  });
});

// 이후 Task 2·3 의 describe 가 이 아래에 이어진다.
void act;
