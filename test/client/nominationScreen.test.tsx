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

// ---- Task 2: 위 알림 큐·채팅 줄·첫 스냅샷 무연출·처음 지목 깜빡임 (UI Considerations E2 #9·#10) ----

describe("지목 화면 — 위 알림·채팅 줄 (E2 #9)", () => {
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

  it("새 지목: 합치기 창(400ms)이 닫힌 뒤 위 알림 '영희 → 서준'(point 아이콘)이 뜨고, 채팅 vote 줄은 바로 같은 글자로 남는다", () => {
    const m = mount(makeView());
    m.show(makeView({ points: [[1, 2]] }));
    expect(sysLines(m.container, "vote")).toEqual(["영희 → 서준"]);
    expect(toastText(m.container)).toBe("");
    advance(401);
    expect(toastText(m.container)).toBe("영희 → 서준");
    expect(m.container.querySelector(".mv-toast .mv-toast__text svg")).not.toBeNull();
  });

  it("바꾸면 '(바꿈)': 영희가 서준 → 도윤으로 바꾼 지목은 단독 알림과 vote 줄에 (바꿈)이 붙는다", () => {
    const m = mount(makeView({ points: [[1, 2]] }));
    m.show(makeView({ points: [[1, 4]] }));
    expect(sysLines(m.container, "vote")).toEqual(["영희 → 도윤 (바꿈)"]);
    advance(401);
    expect(toastText(m.container)).toBe("영희 → 도윤 (바꿈)");
  });

  it("400ms 안에 같은 대상을 가리킨 두 표는 알림 하나 '영희·지아 → 서준' 으로 합치고 채팅 줄은 둘이다", () => {
    const m = mount(makeView());
    m.show(makeView({ points: [[1, 2]] }));
    advance(100);
    m.show(makeView({ points: [[1, 2], [3, 2]] }));
    advance(301);
    expect(toastText(m.container)).toBe("영희·지아 → 서준");
    expect(sysLines(m.container, "vote")).toEqual(["영희 → 서준", "지아 → 서준"]);
  });

  it("서로 다른 대상 둘은 줄을 세워 하나씩 보인다: 첫 알림 뒤 0.8초 만에 둘째가 이어받는다", () => {
    const m = mount(makeView());
    m.show(makeView({ points: [[1, 2]] }));
    advance(50);
    m.show(makeView({ points: [[1, 2], [3, 4]] }));
    advance(351);
    expect(toastText(m.container)).toBe("영희 → 서준");
    advance(801);
    expect(toastText(m.container)).toBe("지아 → 도윤");
  });

  it("지목이 시작되면(낮 토론 → 지목) 채팅 system 줄 '지목 시작' 이 남는다", () => {
    const m = mount(makeView({ phase: "discussion" }));
    m.show(makeView());
    expect(logText(m.container)).toContain("지목 시작");
    expect(sysLines(m.container, "hot")).toEqual([]);
  });

  it("선두가 처음 생기면 hot '서준 님이 앞서요', 과반(산 5명 중 3표)이 되면 hot '서준 님 과반' — vote 줄 다음에 온다", () => {
    const m = mount(makeView());
    m.show(makeView({ points: [[1, 2]] }));
    expect(sysLines(m.container, "hot")).toEqual(["서준 님이 앞서요"]);
    m.show(makeView({ points: [[1, 2], [3, 2], [4, 2]] }));
    expect(sysLines(m.container, "hot")).toEqual(["서준 님이 앞서요", "서준 님 과반"]);
    const texts = [...m.container.querySelectorAll(".mv-chat__sys")].map((el) => el.textContent);
    expect(texts.indexOf("영희 → 서준")).toBeLessThan(texts.indexOf("서준 님이 앞서요"));
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

  it("닉네임은 글자로 그린다: '<b>영희</b>' 가 알림 안에서 HTML 이 되지 않는다", () => {
    const nicknames = ["민수", "<b>영희</b>", "서준", "지아", "도윤"];
    const m = mount(makeView({ nicknames }));
    m.show(makeView({ nicknames, points: [[1, 2]] }));
    advance(401);
    expect(toastText(m.container)).toBe("<b>영희</b> → 서준");
    expect(m.container.querySelector(".mv-toast b")).toBeNull();
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

  it("일부만 골랐으면 고른 사람(1·3)만 대상(2)을 가리키고 안 고른 사람(0·2·4)은 pointAt 이 없다 — 조명 vote, 선두 1 에 긴장 1", () => {
    mount(makeView({ points: [[1, 2], [3, 2]] }));
    const look = lastScene();
    expect(look.seats[1]?.pointAt).toBe(2);
    expect(look.seats[3]?.pointAt).toBe(2);
    for (const seat of [0, 2, 4]) expect(look.seats[seat]?.pointAt).toBeUndefined();
    expect(look.lighting).toBe("vote");
    expect(look.tension).toBe(1);
    expect(look.focusSeat).toBe(2);
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

  it("과반(산 5명 중 3표)이면 긴장 2 — 스테이지 400 이면 1.08 확대, 300 이면 확대 없이 1", () => {
    setStageHeight(400);
    const wide = mount(makeView({ points: [[1, 2], [3, 2], [4, 2]] }));
    expect(lastScene().tension).toBe(2);
    const cam = lastScene().camera;
    expect(cam.mode === "fixed" && cam.zoom).toBe(1.08);
    expect(headOf(wide.container, 2)?.getAttribute("data-sure")).toBe("true");
    wide.unmount();
    setStageHeight(300);
    mount(makeView({ points: [[1, 2], [3, 2], [4, 2]] }));
    expect(lastScene().tension).toBe(2);
    const small = lastScene().camera;
    expect(small.mode === "fixed" && small.zoom).toBe(1);
  });

  it("과반이 풀리면(한 명이 바꿈) 도장과 긴장이 원래대로 돌아온다", () => {
    const m = mount(makeView({ points: [[1, 2], [3, 2], [4, 2]] }));
    expect(headOf(m.container, 2)?.getAttribute("data-sure")).toBe("true");
    m.show(makeView({ points: [[1, 2], [3, 2], [4, 0]] }));
    expect(headOf(m.container, 2)?.hasAttribute("data-sure")).toBe(false);
    expect(headOf(m.container, 2)?.getAttribute("data-lead")).toBe("true");
    expect(lastScene().tension).toBe(1);
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
