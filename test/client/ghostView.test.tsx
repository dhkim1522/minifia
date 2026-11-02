import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import type { RoleId } from "../../shared/game/roles";
import type { ClientMessage, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import type { SceneLook } from "../../src/world/presence";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 08-17: 유령 화면(GHOST-01·02). RoomScreen 을 거쳐 GameMap 을 그리고 WorldStage 는 진짜를 쓴다 —
// 이름표(data-role-chip·data-ghost-seat)는 WorldStage 가 그리는 DOM 이라서다. 런타임(three)만 가짜로 바꿔 장면 표(setScene)와 탭(tap)을 읽는다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

const rt = vi.hoisted(() => ({ scenes: [] as unknown[], created: 0, taps: 0 }));
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
        tap: () => {
          rt.taps += 1;
          return { x: 1, z: 1 };
        },
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
const JOBS: RoleId[] = ["mafia", "police", "doctor", "citizen", "citizen", "citizen", "mafia", "citizen"];
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
  candidate?: number;
  /** true 면 서버가 탈락한 본인에게 싣는 spectate 를 만든다(내가 dead 일 때만) */
  spectate?: boolean;
}

function makeView(o: ViewOpts = {}): RoomView {
  const count = o.count ?? 5;
  const mySeat = o.mySeat ?? 0;
  const phase = o.phase ?? "discussion";
  const dead = o.dead ?? [];
  const meDead = dead.includes(mySeat);
  const players = Array.from({ length: count }, (_, seat) => player(seat, dead.includes(seat) ? { alive: false } : {}));
  const view: RoomView = {
    code: "0042",
    phase,
    phaseEndsAt: NOW + 10_000,
    phaseDurationMs: 10_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: mySeat, isHost: mySeat === 0, chat: meDead ? "ghost" : "all" },
    day: { n: 1, roles: [], ...(o.candidate !== undefined ? { candidate: o.candidate } : {}) },
  };
  if (meDead && o.spectate !== false) {
    view.spectate = { seats: players.map((p) => ({ seat: p.seat, job: JOBS[p.seat] ?? "citizen" })) };
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
const chips = (c: ParentNode): HTMLElement[] => [...c.querySelectorAll<HTMLElement>("[data-role-chip]")];

beforeEach(() => {
  rt.scenes.length = 0;
  rt.created = 0;
  rt.taps = 0;
  installMemoryStorage();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("유령 화면 — 서버가 보낸 관전 정보로 그려진다 (GHOST-02, 트레이서)", () => {
  // 산 4 · 죽은 1(나 = 4)
  const ghost = () => makeView({ mySeat: 4, dead: [4] });

  it("탈락한 내 view(+spectate): 루트에 data-ghost-view 하나, 모든 이름표에 직업 칩(직업 이름 aria-label)", () => {
    const { container } = mount(ghost());
    expect(container.querySelectorAll('[data-ghost-view="true"]').length).toBe(1);
    expect(container.querySelector("main")?.getAttribute("data-ghost-view")).toBe("true");
    expect(chips(container).length).toBe(5);
    const bySeat = (seat: number) => container.querySelector(`[data-seat="${seat}"] [data-role-chip]`);
    expect(bySeat(0)?.getAttribute("aria-label")).toBe("마피아");
    expect(bySeat(1)?.getAttribute("aria-label")).toBe("경찰");
    expect(bySeat(2)?.getAttribute("aria-label")).toBe("의사");
    expect(bySeat(3)?.getAttribute("aria-label")).toBe("시민");
    expect(bySeat(4)?.getAttribute("data-role-chip")).toBe("citizen");
  });

  it("죽은 좌석(나)의 이름표에 data-ghost-seat 와 반투명(data-ghost), 산 좌석에는 없다", () => {
    const { container } = mount(ghost());
    expect(container.querySelector('[data-seat="4"]')?.hasAttribute("data-ghost-seat")).toBe(true);
    expect(container.querySelector('[data-seat="4"] .mv-head')?.getAttribute("data-ghost")).toBe("true");
    for (const seat of [0, 1, 2, 3]) {
      expect(container.querySelector(`[data-seat="${seat}"]`)?.hasAttribute("data-ghost-seat")).toBe(false);
      expect(container.querySelector(`[data-seat="${seat}"] .mv-head`)?.hasAttribute("data-ghost")).toBe(false);
    }
  });

  it("같은 판의 산 사람 view(spectate 없음)는 data-ghost-view·직업 칩·data-ghost-seat 가 모두 0개", () => {
    const { container } = mount(makeView({ mySeat: 0, dead: [4] }));
    expect(container.querySelectorAll("[data-ghost-view]").length).toBe(0);
    expect(container.querySelectorAll("[data-role-chip]").length).toBe(0);
    expect(container.querySelectorAll("[data-ghost-seat]").length).toBe(0);
  });

  it("내 alive 가 false 여도 서버가 spectate 를 안 보냈으면 유령 분기를 그리지 않는다(받아서 감추지도 않는다)", () => {
    const { container } = mount(makeView({ mySeat: 4, dead: [4], spectate: false }));
    expect(container.querySelectorAll("[data-ghost-view]").length).toBe(0);
    expect(container.querySelectorAll("[data-role-chip]").length).toBe(0);
    expect(lastScene()).toBeDefined();
  });
});
