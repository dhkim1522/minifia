import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import type { ClientMessage, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 08-15: 지목 화면(DAY-04·05, MAP-04). RoomScreen 을 거쳐 GameMap 을 그리고, WorldStage 는 진짜를 쓴다 —
// 이름표 버튼(data-pick)·득표 배지(data-count)·mine 은 WorldStage 가 그리는 DOM 이라서다.
// 런타임(three)만 가짜로 바꿔 건네받은 장면 표(setScene)·손사래(deny)를 기록한다. 런타임이 장면 표를 렌더러에 옮기는 일은 worldStage.test(08-12) 몫이다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

const rt = vi.hoisted(() => ({ scenes: [] as unknown[], denies: [] as number[], created: 0 }));
vi.mock("../../src/world/runtime", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/world/runtime")>();
  return {
    ...real,
    createWorldRuntime: () => {
      rt.created += 1;
      return {
        start: () => Promise.resolve(),
        syncPlayers: () => {},
        deny: (seat: number) => rt.denies.push(seat),
        setScene: (look: unknown) => rt.scenes.push(look),
        tap: () => null,
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
  /** [지목한 사람, 대상] 쌍 */
  points?: Array<[number, number]>;
  nicknames?: string[];
}

function makeView(o: ViewOpts = {}): RoomView {
  const count = o.count ?? 5;
  const mySeat = o.mySeat ?? 0;
  const players = Array.from({ length: count }, (_, seat) =>
    player(seat, { ...(o.dead?.includes(seat) ? { alive: false } : {}), ...(o.nicknames?.[seat] !== undefined ? { nickname: o.nicknames[seat]! } : {}) }),
  );
  return {
    code: "0042",
    phase: o.phase ?? "nomination",
    phaseEndsAt: NOW + 15_000,
    phaseDurationMs: 15_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: mySeat, isHost: mySeat === 0, chat: o.dead?.includes(mySeat) ? "ghost" : "all" },
    day: {
      n: 1,
      roles: [],
      ...((o.phase ?? "nomination") === "nomination" ? { points: (o.points ?? []).map(([seat, target]) => ({ seat, target })) } : {}),
    },
  };
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

const picks = (c: ParentNode): HTMLButtonElement[] => [...c.querySelectorAll<HTMLButtonElement>("[data-pick]")];
const pickOf = (c: ParentNode, seat: number): HTMLButtonElement | null => c.querySelector(`[data-pick="${seat}"]`);
const headOf = (c: ParentNode, seat: number): HTMLElement | null => c.querySelector(`[data-seat="${seat}"] .mv-head`);

beforeEach(() => {
  rt.scenes.length = 0;
  rt.denies.length = 0;
  rt.created = 0;
  installMemoryStorage();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("지목 화면 — 이름표 하나 누르기 (DAY-04, 트레이서)", () => {
  it("산 5명의 지목 단계: 나를 뺀 4명이 data-pick 버튼이고 이름은 '{닉네임} 님 가리키기', 층은 role=group '지목'", () => {
    const { container } = mount(makeView());
    expect(picks(container).map((b) => b.getAttribute("data-pick"))).toEqual(["1", "2", "3", "4"]);
    expect(pickOf(container, 2)?.getAttribute("aria-label")).toBe("서준 님 가리키기");
    expect(container.querySelector('[role="group"][aria-label="지목"]')).not.toBeNull();
    expect(pickOf(container, 0)).toBeNull();
  });

  it("좌석 2 를 누르면 point {target: 2} 를 보내고 그 이름표만 즉시 mine, 전에 고른 것은 풀린다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container } = mount(makeView(), { send });
    fireEvent.click(pickOf(container, 2)!);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ t: "point", target: 2 });
    expect(headOf(container, 2)?.getAttribute("data-mine")).toBe("true");
    expect(pickOf(container, 2)?.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(pickOf(container, 3)!);
    expect(send).toHaveBeenLastCalledWith({ t: "point", target: 3 });
    expect(headOf(container, 3)?.getAttribute("data-mine")).toBe("true");
    expect(headOf(container, 2)?.getAttribute("data-mine")).toBeNull();
  });

  it("서버 view(내가 2, 3 번이 2)가 오면 좌석 2 의 배지가 data-count=2 이고 0표 이름표에는 배지가 없다", () => {
    const m = mount(makeView());
    expect(m.container.querySelectorAll("[data-count]").length).toBe(0);
    m.show(makeView({ points: [[0, 2], [3, 2]] }));
    expect(headOf(m.container, 2)?.getAttribute("data-count")).toBe("2");
    expect(headOf(m.container, 1)?.hasAttribute("data-count")).toBe(false);
  });

  it("유령(탈락한 나)의 지목 화면에는 지목 버튼이 하나도 없다", () => {
    const { container } = mount(makeView({ dead: [0] }));
    expect(picks(container).length).toBe(0);
  });
});
