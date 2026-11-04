import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import type { ClientMessage, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { readFileSync } from "node:fs";
import type { SceneLook } from "../../src/world/presence";
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
  /** 순차 지목 차례(09.1). 생략하면 내 차례(남은 8초), null 이면 day.turn 없음 */
  turn?: TurnOpts | null;
}

interface TurnOpts {
  /** -1 모이는 중 · 0.. 차례 · order.length 끝 알림 */
  i: number;
  order?: number[];
  /** 차례 마감까지 남은 ms(시험 시각 NOW 기준). 기본 8000 */
  left?: number;
  /** 확정 시점의 남은 ms. 있으면 doneAt = endsAt − doneLeft */
  doneLeft?: number;
  skip?: boolean;
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
      ...((o.phase ?? "nomination") === "nomination"
        ? { points: (o.points ?? []).map(([seat, target]) => ({ seat, target })), ...turnPart(o, players, mySeat) }
        : {}),
    },
  };
}

function turnPart(o: ViewOpts, players: PublicPlayer[], mySeat: number): { turn?: NonNullable<RoomView["day"]>["turn"] } {
  if (o.turn === null) return {};
  const alive = players.filter((p) => p.alive !== false).map((p) => p.seat);
  const t = o.turn ?? { i: Math.max(0, alive.indexOf(mySeat)) };
  const order = t.order ?? alive;
  const endsAt = NOW + (t.left ?? 8000);
  const inTurn = t.i >= 0 && t.i < order.length;
  return {
    turn: {
      order,
      i: t.i,
      ...(inTurn ? { endsAt } : {}),
      ...(inTurn && t.doneLeft !== undefined ? { doneAt: endsAt - t.doneLeft } : {}),
      ...(t.skip === true ? { skip: true as const } : {}),
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

// ---- Task 2: 위 알림 큐·채팅 줄·첫 스냅샷 무연출·처음 지목 깜빡임 (UI Considerations E2 #9·#10) ----

describe("지목 화면 — 채팅 줄·위 알림 없음 (E2 #9 → 09.1)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  const toastText = (c: ParentNode) => c.querySelector(".mv-toast__text")?.textContent ?? "";
  const logText = (c: ParentNode) => c.querySelector("[data-chat-log]")?.textContent ?? "";
  const sysLines = (c: ParentNode, kind: "vote" | "hot"): string[] =>
    [...c.querySelectorAll(`.mv-chat__sys.is-${kind}`)].map((el) => el.textContent ?? "");

  it("지목해도 TopToast 가 뜨지 않는다(09.1): 채팅 vote 줄 '영희 → 서준' 만 바로 남는다", () => {
    const m = mount(makeView());
    m.show(makeView({ points: [[1, 2]] }));
    expect(sysLines(m.container, "vote")).toEqual(["영희 → 서준"]);
    advance(2000);
    expect(toastText(m.container)).toBe("");
    expect(m.container.querySelector(".mv-toast.is-on")).toBeNull();
  });

  it("여러 지목이 겹쳐도 알림은 없고 채팅 줄만 쌓인다 — '(바꿈)'·합친 이름도 없다", () => {
    const m = mount(makeView());
    m.show(makeView({ points: [[1, 2]] }));
    advance(100);
    m.show(makeView({ points: [[1, 2], [3, 2]] }));
    advance(2000);
    expect(toastText(m.container)).toBe("");
    expect(sysLines(m.container, "vote")).toEqual(["영희 → 서준", "지아 → 서준"]);
    expect(logText(m.container)).not.toContain("바꿈");
  });

  it("거절 알림은 그대로 뜬다: 지목 뒤 WRONG_PHASE 를 받으면 '지금은 고를 수 없어요'", () => {
    const listeners: Array<(e: { t: "error"; code: string }, meta: { epoch: number }) => void> = [];
    const onEvent = vi.fn((l: (typeof listeners)[number]) => {
      listeners.push(l);
      return () => {};
    }) as unknown as RoomConnection["onEvent"];
    const m = mount(makeView(), { onEvent });
    fireEvent.click(pickOf(m.container, 2)!);
    act(() => listeners.forEach((l) => l({ t: "error", code: "WRONG_PHASE" }, { epoch: 1 })));
    expect(toastText(m.container)).toBe("지금은 고를 수 없어요");
  });

  it("지목이 시작되면(낮 토론 → 지목) 채팅 system 줄 '지목 시작' 이 남는다", () => {
    const m = mount(makeView({ phase: "discussion" }));
    m.show(makeView());
    expect(logText(m.container)).toContain("지목 시작");
    expect(sysLines(m.container, "hot")).toEqual([]);
  });

  it("선두·과반이 생겨도 hot 줄('앞서요'·'과반')이 없다 — 득표는 배지 숫자만(09.1, M-4)", () => {
    const m = mount(makeView());
    m.show(makeView({ points: [[1, 2]] }));
    m.show(makeView({ points: [[1, 2], [3, 2], [4, 2]] }));
    expect(sysLines(m.container, "hot")).toEqual([]);
    expect(logText(m.container)).not.toContain("앞서요");
    expect(logText(m.container)).not.toContain("과반");
    expect(sysLines(m.container, "vote")).toEqual(["영희 → 서준", "지아 → 서준", "도윤 → 서준"]);
  });

  it("재접속·새로 고침 첫 화면(직전 view 없음): 배지·선두는 상태로 바로 보이지만 알림·채팅 줄은 새로 만들지 않는다", () => {
    const { container } = mount(makeView({ points: [[1, 2], [3, 2]] }));
    expect(headOf(container, 2)?.getAttribute("data-count")).toBe("2");
    expect(headOf(container, 2)?.getAttribute("data-lead")).toBe("true");
    advance(2000);
    expect(toastText(container)).toBe("");
    expect(container.querySelectorAll(".mv-chat__sys").length).toBe(0);
  });

  it("연결 번호(epoch)가 바뀐 직후 view 도 이벤트가 없다", () => {
    const m = mount(makeView());
    m.show(makeView({ points: [[1, 2]] }), { epoch: 2 });
    advance(2000);
    expect(headOf(m.container, 2)?.getAttribute("data-count")).toBe("1");
    expect(toastText(m.container)).toBe("");
    expect(m.container.querySelectorAll(".mv-chat__sys").length).toBe(0);
  });

  it("닉네임은 글자로 그린다: '<b>영희</b>' 가 채팅 줄 안에서 HTML 이 되지 않는다", () => {
    const nicknames = ["민수", "<b>영희</b>", "서준", "지아", "도윤"];
    const m = mount(makeView({ nicknames }));
    m.show(makeView({ nicknames, points: [[1, 2]] }));
    expect(sysLines(m.container, "vote")).toEqual(["<b>영희</b> → 서준"]);
    expect(m.container.querySelector("[data-chat-log] b")).toBeNull();
  });
});

describe("지목 화면 — 처음 보는 지목 깜빡임 (UI-SPEC 다르게 2)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  const blinking = (c: ParentNode): number => c.querySelectorAll(".mv-tag.is-blink").length;

  it("기록이 없으면 누를 수 있는 이름표 4개가 깜빡이고(내 이름표는 아님) 3초 뒤 꺼지며 mf-hint-point 가 남는다", () => {
    const { container } = mount(makeView());
    expect(blinking(container)).toBe(4);
    expect(headOf(container, 0)?.querySelector(".is-blink")).toBeNull();
    advance(2999);
    expect(blinking(container)).toBe(4);
    advance(1);
    expect(blinking(container)).toBe(0);
    expect(localStorage.getItem("mf-hint-point")).not.toBeNull();
  });

  it("한 번 본 사람은 다음 지목 단계에서 깜빡이지 않는다", () => {
    const first = mount(makeView());
    advance(3000);
    first.unmount();
    const { container } = mount(makeView());
    expect(blinking(container)).toBe(0);
  });

  it("이름표를 누르면 즉시 멈추고 기록한다", () => {
    const { container } = mount(makeView());
    expect(blinking(container)).toBe(4);
    fireEvent.click(pickOf(container, 2)!);
    expect(blinking(container)).toBe(0);
    expect(localStorage.getItem("mf-hint-point")).not.toBeNull();
  });

  it("저장소를 읽거나 쓸 수 없으면(개인 모드) 깜빡이고, 3초 뒤 끄는 데도 오류가 나지 않는다", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    vi.stubGlobal("localStorage", broken);
    const { container } = mount(makeView());
    expect(blinking(container)).toBe(4);
    advance(3000);
    expect(blinking(container)).toBe(0);
  });

  it("지목이 아닌 단계와 유령 화면에는 깜빡임이 없고 기록도 하지 않는다", () => {
    const talk = mount(makeView({ phase: "discussion" }));
    expect(blinking(talk.container)).toBe(0);
    talk.unmount();
    const ghost = mount(makeView({ dead: [0] }));
    expect(blinking(ghost.container)).toBe(0);
    advance(3000);
    expect(localStorage.getItem("mf-hint-point")).toBeNull();
  });
});

// ---- Task 3: 손가락·고정 카메라·조명·긴장·손사래·거절 알림·끊김 (DAY-04·05, MAP-04, 결정 0049) ----

const lastScene = (): SceneLook => rt.scenes.at(-1) as SceneLook;

describe("지목 화면 — 장면 상태 (손가락·카메라·조명·긴장)", () => {
  const realInnerH = window.innerHeight;
  const setStageHeight = (stageH: number) => {
    // 스테이지 높이 = 창 높이 − 헤더 아래 62 − 패널 250 (사각형을 못 쟀을 때의 기본값)
    Object.defineProperty(window, "innerHeight", { value: stageH + 62 + 250, configurable: true, writable: true });
  };
  afterEach(() => {
    Object.defineProperty(window, "innerHeight", { value: realInnerH, configurable: true, writable: true });
  });

  it("일부만 골랐으면 고른 사람(1·3)만 대상(2)을 가리키고 안 고른 사람(0·2·4)은 pointAt 이 없다 — 조명 vote, 선두가 있어도 긴장 0(09.1, M-4)", () => {
    mount(makeView({ points: [[1, 2], [3, 2]] }));
    const look = lastScene();
    expect(look.seats[1]?.pointAt).toBe(2);
    expect(look.seats[3]?.pointAt).toBe(2);
    for (const seat of [0, 2, 4]) expect(look.seats[seat]?.pointAt).toBeUndefined();
    expect(look.lighting).toBe("vote");
    expect(look.tension).toBe(0);
    expect(look.focusSeat).toBeUndefined();
    expect(look.camera.mode).toBe("fixed");
  });

  it("아무도 고르지 않았으면 모두 손을 내린 채, 긴장 0", () => {
    mount(makeView());
    const look = lastScene();
    expect(Object.values(look.seats).every((s) => s.pointAt === undefined)).toBe(true);
    expect(look.tension).toBe(0);
    expect(look.camera.mode === "fixed" && look.camera.zoom).toBe(1);
  });

  it("동점이면 선두 효과를 풀어 긴장 0: 2표 대 2표", () => {
    mount(makeView({ count: 6, points: [[0, 2], [1, 2], [3, 4], [5, 4]] }));
    expect(lastScene().tension).toBe(0);
    expect(lastScene().focusSeat).toBeUndefined();
  });

  it("과반(산 5명 중 3표)이어도 긴장 0·확대 1 — 스테이지 400 이든 300 이든 같다(09.1, M-4)", () => {
    setStageHeight(400);
    const wide = mount(makeView({ points: [[1, 2], [3, 2], [4, 2]] }));
    expect(lastScene().tension).toBe(0);
    const cam = lastScene().camera;
    expect(cam.mode === "fixed" && cam.zoom).toBe(1);
    expect(headOf(wide.container, 2)?.getAttribute("data-sure")).toBe("true");
    wide.unmount();
    setStageHeight(300);
    mount(makeView({ points: [[1, 2], [3, 2], [4, 2]] }));
    expect(lastScene().tension).toBe(0);
    const small = lastScene().camera;
    expect(small.mode === "fixed" && small.zoom).toBe(1);
  });

  it("과반이 풀리면(한 명이 바꿈) 도장이 원래대로 돌아오고 긴장은 내내 0", () => {
    const m = mount(makeView({ points: [[1, 2], [3, 2], [4, 2]] }));
    expect(headOf(m.container, 2)?.getAttribute("data-sure")).toBe("true");
    m.show(makeView({ points: [[1, 2], [3, 2], [4, 0]] }));
    expect(headOf(m.container, 2)?.hasAttribute("data-sure")).toBe(false);
    expect(headOf(m.container, 2)?.getAttribute("data-lead")).toBe("true");
    expect(lastScene().tension).toBe(0);
  });

  it("내가 누르면 서버 응답 전에도 내 캐릭터가 그쪽을 가리킨다(남의 지목은 서버 값만)", () => {
    const m = mount(makeView());
    fireEvent.click(pickOf(m.container, 2)!);
    expect(lastScene().seats[0]?.pointAt).toBe(2);
    expect(lastScene().seats[1]?.pointAt).toBeUndefined();
    expect(headOf(m.container, 2)?.hasAttribute("data-count")).toBe(false); // 내 표도 서버가 세어 주기 전에는 배지가 없다
  });

  it("지목 단계의 산 사람이 맵을 탭해도 걷지 않는다(낮 토론에서는 걷는다)", () => {
    const tap = (c: ParentNode) => {
      const surface = c.querySelector(".mf-world__input")!;
      fireEvent.pointerDown(surface, { pointerId: 1, clientX: 100, clientY: 300, button: 0 });
      fireEvent.pointerUp(surface, { pointerId: 1, clientX: 100, clientY: 300, button: 0 });
    };
    const talkSend = vi.fn(() => true);
    const talk = mount(makeView({ phase: "discussion" }), { send: talkSend });
    tap(talk.container);
    expect(talkSend).toHaveBeenCalledWith(expect.objectContaining({ t: "move" }));
    talk.unmount();
    const send = vi.fn(() => true);
    const { container } = mount(makeView(), { send });
    tap(container);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("지목 화면 — 손사래 (결정 0049)", () => {
  it("선두가 서준(2) → 도윤(4) 로 바뀌면 도윤이 손사래를 한 번 한다", () => {
    const m = mount(makeView({ points: [[1, 2]] }));
    expect(rt.denies).toEqual([]); // 첫 스냅샷의 선두는 지난 일
    m.show(makeView({ points: [[1, 4], [3, 4]] }));
    expect(rt.denies).toEqual([4]);
  });

  it("선두가 처음 생기는 순간에도 한 번, 같은 선두가 이어지면 다시 하지 않고 동점이면 하지 않는다", () => {
    const m = mount(makeView());
    m.show(makeView({ points: [[1, 2]] }));
    expect(rt.denies).toEqual([2]);
    m.show(makeView({ points: [[1, 2], [3, 2]] }));
    expect(rt.denies).toEqual([2]);
    m.show(makeView({ points: [[1, 2], [3, 4]] })); // 동점 → 선두 없음
    expect(rt.denies).toEqual([2]);
  });

  it("재접속 직후(epoch 가 바뀐 view)의 선두는 손사래를 하지 않는다", () => {
    const m = mount(makeView());
    m.show(makeView({ points: [[1, 2]] }), { epoch: 2 });
    expect(rt.denies).toEqual([]);
  });
});

describe("지목 화면 — 거절·끊김", () => {
  const listeners: Array<(e: { t: "error"; code: string }, meta: { epoch: number }) => void> = [];
  const onEvent = () =>
    vi.fn((l: (typeof listeners)[number]) => {
      listeners.push(l);
      return () => {};
    }) as unknown as RoomConnection["onEvent"];
  const emit = (code: string) => act(() => listeners.forEach((l) => l({ t: "error", code }, { epoch: 1 })));
  const toastText = (c: ParentNode) => c.querySelector(".mv-toast__text")?.textContent ?? "";
  beforeEach(() => {
    listeners.length = 0;
  });

  it("단계 어긋남(WRONG_PHASE)은 '지금은 고를 수 없어요' 뒤 내 선택이 서버 값(고르지 않음)으로 돌아온다", () => {
    const { container } = mount(makeView(), { onEvent: onEvent() });
    fireEvent.click(pickOf(container, 2)!);
    expect(headOf(container, 2)?.getAttribute("data-mine")).toBe("true");
    emit("WRONG_PHASE");
    expect(toastText(container)).toBe("지금은 고를 수 없어요");
    expect(headOf(container, 2)?.hasAttribute("data-mine")).toBe(false);
    expect(lastScene().seats[0]?.pointAt).toBeUndefined();
  });

  it("그 밖의 오류(RATE_LIMITED)가 지목 직후 오면 '보내지 못했어요. 다시 해 보세요' 뒤 서버 값으로 돌아온다", () => {
    const { container } = mount(makeView({ points: [[0, 1]] }), { onEvent: onEvent() });
    fireEvent.click(pickOf(container, 3)!);
    expect(headOf(container, 3)?.getAttribute("data-mine")).toBe("true");
    emit("RATE_LIMITED");
    expect(toastText(container)).toBe("보내지 못했어요. 다시 해 보세요");
    expect(headOf(container, 3)?.hasAttribute("data-mine")).toBe(false);
    expect(headOf(container, 1)?.getAttribute("data-mine")).toBe("true"); // 서버가 아는 내 선택
  });

  it("지목을 보낸 적 없을 때의 그 밖의 오류는 알림을 만들지 않는다", () => {
    const { container } = mount(makeView(), { onEvent: onEvent() });
    emit("RATE_LIMITED");
    expect(toastText(container)).toBe("");
  });

  it("연결이 끊긴 동안 지목 버튼은 모두 aria-disabled 이고 눌러도 보내지 않는다", () => {
    const send = vi.fn(() => true);
    const { container } = mount(makeView(), { send, canSend: false });
    expect(picks(container).length).toBe(4);
    expect(picks(container).every((b) => b.getAttribute("aria-disabled") === "true")).toBe(true);
    fireEvent.click(pickOf(container, 2)!);
    expect(send).not.toHaveBeenCalled();
    expect(headOf(container, 2)?.hasAttribute("data-mine")).toBe(false);
  });

  it("소켓이 닫혀 보내지 못하면(send false) 내 선택 표시를 바꾸지 않는다", () => {
    const send = vi.fn(() => false);
    const { container } = mount(makeView(), { send });
    fireEvent.click(pickOf(container, 2)!);
    expect(headOf(container, 2)?.hasAttribute("data-mine")).toBe(false);
  });

  it("같은 사람을 다시 눌러도 다시 보내지 않고 표시도 변하지 않는다(취소 없음)", () => {
    const send = vi.fn(() => true);
    const { container } = mount(makeView(), { send });
    fireEvent.click(pickOf(container, 2)!);
    fireEvent.click(pickOf(container, 2)!);
    expect(send).toHaveBeenCalledTimes(1);
    expect(headOf(container, 2)?.getAttribute("data-mine")).toBe("true");
  });
});

describe("지목 화면 — 역할 표식 없음·8명·긴 닉네임 (T-08-40)", () => {
  it("지목·배지·선두·도장·mine 이 다 켜진 화면에 crimson·역할 칩이 없고 맵 위에 선·투표 장치도 없다", () => {
    const m = mount(makeView({ points: [[1, 2], [3, 2], [4, 2]] }));
    fireEvent.click(pickOf(m.container, 3)!);
    const html = m.container.innerHTML;
    expect(html).not.toMatch(/crimson/i);
    expect(m.container.querySelector("[data-role-chip]")).toBeNull();
    expect(m.container.querySelector(".mf-world svg line, .mf-world svg polyline, .mf-world canvas ~ svg")).toBeNull();
    for (const f of ["src/screens/GameMap.tsx", "src/net/useDayFx.ts"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/crimson|innerHTML/);
    }
  });

  it("산 8명의 지목 단계: 나를 뺀 7개 버튼이 각각 44×44 이상의 누르는 면을 갖는 규칙(.mf-world__pick)을 따른다", () => {
    const { container } = mount(makeView({ count: 8 }));
    expect(picks(container).length).toBe(7);
    const css = readFileSync("src/styles/world.css", "utf8");
    expect(css).toMatch(/\.mf-world__pick[\s\S]*?min-(width|height):\s*44px|\.mf-world__pick[\s\S]*?padding:\s*11px/);
  });

  it("8자 닉네임 이름표 버튼도 닉네임을 말줄임 없이 그대로 담는다", () => {
    const nicknames = ["민수", "영희", "가나다라마바사아", "지아", "도윤"];
    const { container } = mount(makeView({ nicknames }));
    expect(pickOf(container, 2)?.textContent).toContain("가나다라마바사아");
    expect(pickOf(container, 2)?.getAttribute("aria-label")).toBe("가나다라마바사아 님 가리키기");
    expect(readFileSync("src/styles/v2.css", "utf8")).not.toMatch(/\.mv-tag__name[^}]*text-overflow:\s*ellipsis/);
  });
});


// ---- 09.1-07 Task 1: 차례 알약 · 막대 · 위 한 줄 · 헤더 링 (UI-SPEC A-1~A-6) ----

describe("차례 알약 (결정 0063-1, UI-SPEC A-1~A-6)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  const block = (c: ParentNode): HTMLElement | null => c.querySelector("[data-turn-block]");
  const ring = (c: ParentNode): HTMLElement | null => c.querySelector(".mv-ring");
  const line = (c: ParentNode): string | undefined => c.querySelector(".mf-turn__line.is-on")?.textContent ?? undefined;
  const readable = (el: Element): string => {
    const copy = el.cloneNode(true) as Element;
    copy.querySelectorAll("[aria-hidden='true']").forEach((n) => n.remove());
    return copy.textContent ?? "";
  };
  // 4명, 내 좌석 0, 차례는 1번(영희) — 2 / 4
  const turn4 = (turn: TurnOpts, extra: Partial<ViewOpts> = {}) => makeView({ count: 4, turn, ...extra });

  it("차례 중(남은 7.2초, 2/4): 알약에 '2 / 4'·'영희 님 차례'·'8초', 표식 no·seat·tone=calm, 읽히는 글은 이름만", () => {
    const { container } = mount(turn4({ i: 1, left: 7200 }));
    expect(container.querySelectorAll("[data-turn-block]").length).toBe(1);
    const b = block(container)!;
    expect(b.getAttribute("data-turn-no")).toBe("2");
    expect(b.getAttribute("data-turn-seat")).toBe("1");
    expect(b.getAttribute("data-turn-tone")).toBe("calm");
    expect(b.textContent).toContain("2 / 4");
    expect(b.textContent).toContain("영희 님 차례");
    expect(b.textContent).toContain("8초");
    const status = b.querySelector('[role="status"]')!;
    expect(readable(status)).toBe("영희 님 차례");
    expect(b.querySelector(".mf-turn__bar")).not.toBeNull();
  });

  it("남은 5.0초 근처 세 시각(4.9·5.0·5.1)에서 알약 표식과 헤더 링 색이 일치한다", () => {
    for (const [left, tone] of [[4900, "urgent"], [5000, "urgent"], [5100, "calm"]] as const) {
      const { container, unmount } = mount(turn4({ i: 1, left }));
      expect(block(container)!.getAttribute("data-turn-tone"), `${left}`).toBe(tone);
      expect(ring(container)!.classList.contains("is-urgent"), `${left}`).toBe(tone === "urgent");
      unmount();
    }
  });

  it("시계가 흘러 5초 이하가 되면 알약·헤더 링이 같은 순간 진홍으로 바뀐다", () => {
    const { container } = mount(turn4({ i: 1, left: 6500 }));
    expect(block(container)!.getAttribute("data-turn-tone")).toBe("calm");
    expect(block(container)!.textContent).toContain("7초");
    advance(1499);
    expect(block(container)!.textContent).toContain("6초");
    expect(block(container)!.getAttribute("data-turn-tone")).toBe("calm");
    advance(1);
    expect(block(container)!.textContent).toContain("5초");
    expect(block(container)!.getAttribute("data-turn-tone")).toBe("urgent");
    expect(ring(container)!.classList.contains("is-urgent")).toBe(true);
    expect(ring(container)!.getAttribute("aria-label")).toBe("남은 시간 5초");
  });

  it("헤더 링은 차례 초 / 8: 지목 단계 마감이 아니라 차례 마감을 쓴다", () => {
    const { container } = mount(turn4({ i: 1, left: 7200 }));
    expect(ring(container)!.getAttribute("aria-label")).toBe("남은 시간 8초");
  });

  it("확정된 차례는 그 값에서 멈춘다: 시계를 옮겨도 초·막대 폭이 그대로", () => {
    const { container } = mount(turn4({ i: 1, left: 8000, doneLeft: 3000 }, { points: [[1, 2]] }));
    const width = (): string => (block(container)!.querySelector(".mf-turn__fill") as HTMLElement).style.width;
    expect(block(container)!.textContent).toContain("3초");
    expect(width()).toBe("37.5%");
    advance(2000);
    expect(block(container)!.textContent).toContain("3초");
    expect(width()).toBe("37.5%");
    expect(ring(container)!.getAttribute("aria-label")).toBe("남은 시간 3초");
  });

  it("모이는 중: 알약·막대·헤더 링이 없고, 라이브로 들어오면 위 한 줄 '가운데로 모여요'", () => {
    const m = mount(makeView({ count: 4, phase: "discussion" }));
    expect(block(m.container)).toBeNull();
    m.show(turn4({ i: -1 }));
    expect(block(m.container)).not.toBeNull();
    expect(m.container.querySelector(".mf-turn__pill")).toBeNull();
    expect(m.container.querySelector(".mf-turn__bar")).toBeNull();
    expect(ring(m.container)).toBeNull();
    expect(line(m.container)).toBe("가운데로 모여요");
  });

  it("끝 알림: 알약 없음, 위 한 줄 '모두 골랐어요 · {이름} 님 {k}표'(단독 최다) 또는 '모두 골랐어요'", () => {
    const m = mount(turn4({ i: 3 }));
    m.show(turn4({ i: 4 }, { points: [[0, 2], [1, 2], [3, 1]] }));
    expect(m.container.querySelector(".mf-turn__pill")).toBeNull();
    expect(ring(m.container)).toBeNull();
    expect(line(m.container)).toBe("모두 골랐어요 · 서준 님 2표");
    m.show(turn4({ i: 4 }, { points: [[0, 2], [1, 3]] }));
    expect(line(m.container)).toBe("모두 골랐어요");
  });

  it("재접속 첫 화면(확정 직후 차례): 알약은 지금 값으로 바로 보이고 위 한 줄은 만들지 않는다. 그 뒤 차례가 넘어가면 줄이 생긴다", () => {
    const m = mount(turn4({ i: 1, left: 8000, doneLeft: 3000 }, { points: [[1, 2]] }));
    expect(m.container.querySelector(".mf-turn__pill")).not.toBeNull();
    expect(m.container.querySelector(".mf-turn__pill.is-still")).not.toBeNull();
    expect(line(m.container)).toBeUndefined();
    m.show(turn4({ i: 2, left: 8000 }, { points: [[1, 2]] }));
    expect(line(m.container)).toBeUndefined(); // 차례 중에는 줄이 없다
    m.show(turn4({ i: 2, left: 8000, doneLeft: 2000 }, { points: [[1, 2], [2, 3]] }));
    expect(line(m.container)).toBe("서준 님이 지아 님을 가리켜요");
  });

  it("지목이 아닌 단계에는 [data-turn-block] 이 없다", () => {
    const { container } = mount(makeView({ phase: "discussion" }));
    expect(block(container)).toBeNull();
  });

  it("day.turn 이 없는 지목 view 에는 알약도 헤더 링도 없다", () => {
    const { container } = mount(makeView({ turn: null }));
    expect(container.querySelector(".mf-turn__pill")).toBeNull();
    expect(ring(container)).toBeNull();
  });

  it("닉네임은 글자로 그린다: '<b>영희</b>' 가 알약 안에서 HTML 이 되지 않는다", () => {
    const { container } = mount(turn4({ i: 1 }, { nicknames: ["민수", "<b>영희</b>", "서준", "지아"] }));
    expect(block(container)!.textContent).toContain("<b>영희</b> 님 차례");
    expect(block(container)!.querySelector("b")).toBeNull();
  });

  it("game.css 규칙: .mf-turn · .mf-turn__pill · .mf-turn__fill · .mf-game__dim 이 있고 위 100·pointer-events none", () => {
    const css = readFileSync("src/styles/game.css", "utf8");
    expect(css).toMatch(/\.mf-turn\s*\{[^}]*top:\s*100px[^}]*pointer-events:\s*none/);
    expect(css).toMatch(/\.mf-turn\.is-compact\s*\{[^}]*top:\s*72px/);
    expect(css).toMatch(/\.mf-turn__pill\s*\{/);
    expect(css).toMatch(/\.mf-turn__fill\s*\{/);
    expect(css).toMatch(/\.mf-game__dim\s*\{[^}]*pointer-events:\s*none/);
    expect(css).toMatch(/\.mf-game__dim\[data-dim="on"\]\s*\{[^}]*opacity:\s*0\.4/);
  });
});
