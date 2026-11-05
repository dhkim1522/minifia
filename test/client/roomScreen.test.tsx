import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import type { WorldStageProps } from "../../src/components/WorldStage";
import type { RoomConnection, RoomEvent } from "../../src/net/useRoomConnection";

// 연결 훅은 반환값을 테스트가 정한다. 소켓·타이머는 useRoomConnection.test 가 본다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

// 06-15: 대기실은 맵(WorldStage) 위에 그려진다. 캔버스·런타임은 worldStage.test 가 보므로 여기서는 받은 props 만 쥐는 가짜로 바꾼다
// (lobby.test.tsx 와 같은 모양).
const stage = vi.hoisted(() => ({ props: null as null | WorldStageProps }));
vi.mock("../../src/components/WorldStage", async () => {
  const { createElement } = await import("react");
  return {
    WorldStage: (props: WorldStageProps) => {
      stage.props = props;
      return createElement("div", { "data-world-stage-fake": "" });
    },
  };
});

const { RoomScreen } = await import("../../src/screens/RoomScreen");
const { EXIT_CURTAIN_MS } = await import("../../src/world/runtime");

const view: RoomView = {
  code: "0042",
  phase: "lobby",
  phaseEndsAt: null,
  phaseDurationMs: null,
  serverNow: 1000,
  minPlayers: 4,
  maxPlayers: 8,
  players: [{ seat: 0, nickname: "민수", connected: true, isHost: true }],
  me: { seat: 0, isHost: true },
};

function conn(over: Partial<RoomConnection>): RoomConnection {
  return {
    status: "open",
    banner: "hidden",
    view,
    offset: 0,
    epoch: 1,
    removedReason: null,
    canSend: true,
    send: vi.fn(),
    onEvent: vi.fn(() => () => {}),
    reconnect: vi.fn(),
    retry: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  connectionMock.current = conn({});
});
afterEach(cleanup);

describe("RoomScreen: 재접속 띠 (C-02)", () => {
  it("view 가 있고 reconnecting 이면 본문보다 앞에 52px 띠 '연결이 끊겼어요 · 다시 연결하는 중'", () => {
    connectionMock.current = conn({ status: "reconnecting", banner: "reconnecting", canSend: false });
    const { container } = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    const banner = container.querySelector(".mf-reconnect") as HTMLElement;
    expect(banner.textContent).toContain("연결이 끊겼어요 · 다시 연결하는 중");
    expect(banner.className).toContain("mf-reconnect");
    const body = container.querySelector(".mf-room__body") as HTMLElement;
    expect(body).not.toBeNull();
    // 띠가 본문 앞에 온다(문서 순서) — 띠가 생기면 본문이 그만큼 줄어든다.
    expect(banner.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 끊긴 동안에도 마지막 화면(대기실)은 그대로 그려진다.
    expect(container.querySelector("main.mf-lobby [data-world-stage-fake]")).not.toBeNull();
  });

  it("restored 면 '다시 연결됐어요'", () => {
    connectionMock.current = conn({ banner: "restored" });
    const { container } = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(container.querySelector(".mf-reconnect")?.textContent).toContain("다시 연결됐어요");
  });

  it("banner 가 hidden 이면 띠가 없다", () => {
    const { container } = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(container.querySelector(".mf-reconnect")).toBeNull();
  });

  it("view 가 없으면 띠 대신 전체 화면 '연결 중…'", () => {
    connectionMock.current = conn({ status: "connecting", view: null, canSend: false });
    render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(screen.getByText("연결 중…")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("replaced 면 '다른 창에서 이 방에 들어갔어요' + [다시 연결] + [처음으로](onExit replaced)", () => {
    const onExit = vi.fn();
    const reconnect = vi.fn();
    connectionMock.current = conn({ status: "replaced", canSend: false, reconnect });
    render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={onExit} />);
    expect(screen.getByText("다른 창에서 이 방에 들어갔어요")).toBeTruthy();
    screen.getByRole("button", { name: "다시 연결" }).click();
    expect(reconnect).toHaveBeenCalledTimes(1);
    screen.getByRole("button", { name: "처음으로" }).click();
    expect(onExit).toHaveBeenCalledWith("replaced");
  });
});

describe("RoomScreen: 포기·나가게 된 이유 (C-02, Pitfall 22)", () => {
  it("failed 면 '연결할 수 없어요' + [다시 시도](retry) + [처음으로](onExit gaveUp)", () => {
    const onExit = vi.fn();
    const retry = vi.fn();
    connectionMock.current = conn({ status: "failed", canSend: false, retry });
    render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={onExit} />);
    expect(screen.getByText("연결할 수 없어요")).toBeTruthy();
    screen.getByRole("button", { name: "다시 시도" }).click();
    expect(retry).toHaveBeenCalledTimes(1);
    screen.getByRole("button", { name: "처음으로" }).click();
    expect(onExit).toHaveBeenCalledWith("gaveUp");
    // 포기 화면에는 띠가 없다
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("removed·kicked 면 방 화면을 떠나며 onExit('kicked') 를 한 번 부른다", () => {
    const onExit = vi.fn();
    connectionMock.current = conn({ status: "removed", removedReason: "kicked", canSend: false });
    const { rerender } = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={onExit} />);
    rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={onExit} />);
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledWith("kicked");
  });

  it("canSend 가 거짓이어도 화면은 바뀌지 않는다(띠만)", () => {
    connectionMock.current = conn({ canSend: false, banner: "reconnecting", status: "reconnecting" });
    render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(screen.getByText("대기실")).toBeTruthy();
    expect(screen.queryByText("연결할 수 없어요")).toBeNull();
  });
});

describe("RoomScreen: 헤더 역할 카드 버튼 (03.1-11, D-08)", () => {
  it("대기실에는 `역할 카드`·`내 역할`·`수사 기록` 버튼이 없다", () => {
    render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(document.querySelector(".mf-rolecard-btn") === null ? "없음" : "있음").toBe("없음");
    expect(screen.queryByRole("button", { name: "내 역할" })).toBeNull();
    expect(screen.queryByRole("button", { name: /수사 기록/ })).toBeNull();
  });
});

describe("RoomScreen: 화면 꺼짐 방지 연결 (CONN-03, D-12, P5-7)", () => {
  const wake = () => import("../helpers/wakeLockFake");
  const players: RoomView["players"] = [
    { seat: 0, nickname: "민수", connected: true, isHost: true },
    { seat: 1, nickname: "하윤", connected: true, isHost: false },
    { seat: 2, nickname: "지우", connected: true, isHost: false },
    { seat: 3, nickname: "서연", connected: true, isHost: false },
  ];
  const at = (phase: RoomView["phase"]): RoomView => ({
    ...view,
    phase,
    players,
    me: { seat: 0, isHost: true, role: "citizen" },
  });
  const mount = () => render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  const settle = () => act(async () => {});
  let w: Awaited<ReturnType<typeof wake>>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    w = await wake();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    w.removeWakeLock();
    w.resetVisibility();
    vi.restoreAllMocks();
  });

  it("대기실(status open)에서 request(\"screen\") 가 정확히 1번 불린다", async () => {
    const fake = w.installWakeLock();
    mount();
    await settle();
    expect(fake.request).toHaveBeenCalledTimes(1);
    expect(fake.request).toHaveBeenCalledWith("screen");
  });

  it("같은 대기실 리렌더와 assigning → roleReveal → dayAnnounce 전환에서도 다시 요청하지 않는다", async () => {
    const fake = w.installWakeLock();
    const { rerender } = mount();
    await settle();
    rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    for (const phase of ["assigning", "roleReveal", "dayAnnounce"] as const) {
      connectionMock.current = conn({ view: at(phase) });
      rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
      await settle();
    }
    expect(fake.request).toHaveBeenCalledTimes(1);
    expect(fake.sentinels[0]!.releaseCalls).toBe(0);
  });

  it("view 가 없으면(연결 중…) 요청하지 않는다", async () => {
    const fake = w.installWakeLock();
    connectionMock.current = conn({ status: "connecting", view: null, canSend: false });
    mount();
    await settle();
    expect(fake.request).not.toHaveBeenCalled();
  });

  it("ended 로 바뀌면 잡고 있던 잠금을 1번 release 하고 이후 visible 이벤트에 요청하지 않는다", async () => {
    const fake = w.installWakeLock();
    const { rerender } = mount();
    await settle();
    connectionMock.current = conn({ view: at("ended") });
    rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    await settle();
    expect(fake.sentinels[0]!.releaseCalls).toBe(1);
    w.setVisibility("visible");
    await settle();
    expect(fake.request).toHaveBeenCalledTimes(1);
  });

  it.each(["failed", "replaced"] as const)("status 가 %s 로 바뀌면 release 1번, 이후 요청 없음", async (status) => {
    const fake = w.installWakeLock();
    const { rerender } = mount();
    await settle();
    connectionMock.current = conn({ status, canSend: false });
    rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    await settle();
    expect(fake.sentinels[0]!.releaseCalls).toBe(1);
    w.setVisibility("visible");
    await settle();
    expect(fake.request).toHaveBeenCalledTimes(1);
  });

  it("reconnecting 동안에는 잠금을 유지한다(해제하지 않는다)", async () => {
    const fake = w.installWakeLock();
    const { rerender } = mount();
    await settle();
    connectionMock.current = conn({ status: "reconnecting", banner: "reconnecting", canSend: false });
    rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    await settle();
    expect(fake.request).toHaveBeenCalledTimes(1);
    expect(fake.sentinels[0]!.releaseCalls).toBe(0);
  });

  it("navigator.wakeLock 이 없어도 대기실이 정상으로 그려지고 콘솔 호출 0, 마크업에 화면 꺼짐 문구가 없다", async () => {
    w.removeWakeLock();
    const { container } = mount();
    await settle();
    expect(screen.getByText("대기실")).toBeTruthy();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(container.textContent).not.toMatch(/화면 꺼짐|wake/i);
  });

  it("언마운트하면 release 1번", async () => {
    const fake = w.installWakeLock();
    const { unmount } = mount();
    await settle();
    unmount();
    expect(fake.sentinels[0]!.releaseCalls).toBe(1);
  });
});

describe("RoomScreen: 맵 로비 연결 (MAP-01, MAP-05, CONN-04, 06-15)", () => {
  const mount = () => render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  const snap: RoomEvent = { t: "world", k: "snap", at: 1000, ents: [{ s: 0, p: [0, 0], t0: 1000, v: 0 }] };
  const players4: RoomView["players"] = [
    { seat: 0, nickname: "민수", connected: true, isHost: true },
    { seat: 1, nickname: "하윤", connected: true, isHost: false },
    { seat: 2, nickname: "지우", connected: true, isHost: false },
    { seat: 3, nickname: "서연", connected: true, isHost: false },
  ];
  const at = (phase: RoomView["phase"]): RoomView => ({ ...view, phase, players: players4, me: { seat: 0, isHost: true, role: "citizen" } });
  const setReduced = (reduced: boolean) =>
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: reduced && q.includes("reduce"),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }));

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    stage.props = null;
  });

  it("연결 훅 바로 뒤에 world 프레임을 구독해, 흘러온 첫 snap 이 Lobby 에 넘긴 스토어에 들어간다", () => {
    let listener: ((e: RoomEvent, meta: { epoch: number }) => void) | undefined;
    const onEvent = vi.fn((l: (e: RoomEvent, meta: { epoch: number }) => void) => {
      listener = l;
      return () => {};
    });
    connectionMock.current = conn({ onEvent });
    mount();
    expect(onEvent).toHaveBeenCalledTimes(1);
    const store = stage.props!.store;
    expect(store.isReady()).toBe(false);
    act(() => listener!(snap, { epoch: 1 }));
    expect(store.isReady()).toBe(true);
    expect(store.seats()).toEqual([0]);
    expect(store.currentEpoch()).toBe(1);
  });

  it("world 가 아닌 프레임(chat·error)은 스토어에 닿지 않는다", () => {
    let listener: ((e: RoomEvent, meta: { epoch: number }) => void) | undefined;
    connectionMock.current = conn({
      onEvent: vi.fn((l: (e: RoomEvent, meta: { epoch: number }) => void) => {
        listener = l;
        return () => {};
      }),
    });
    mount();
    const store = stage.props!.store;
    act(() => listener!({ t: "error", code: "bad_message" } as unknown as RoomEvent, { epoch: 1 }));
    expect(store.isReady()).toBe(false);
    expect(store.currentEpoch()).toBe(-1);
  });

  it("스토어는 연결과 같은 수명이다: 리렌더·단계 전환에도 같은 객체이고, 언마운트하면 구독을 푼다", () => {
    const off = vi.fn();
    const onEvent = vi.fn(() => off);
    connectionMock.current = conn({ onEvent });
    const { rerender, unmount } = mount();
    const first = stage.props!.store;
    rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(stage.props!.store).toBe(first);
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(off).not.toHaveBeenCalled();
    unmount();
    expect(off).toHaveBeenCalledTimes(1);
  });

  it("서버시각 차이(offset)·canSend·send 를 Lobby 를 거쳐 WorldStage 에 넘긴다", () => {
    const send = vi.fn();
    connectionMock.current = conn({ offset: 321, canSend: false, send });
    mount();
    expect(stage.props!.offset).toBe(321);
    expect(stage.props!.canSend).toBe(false);
    expect(stage.props!.send).toBe(send);
  });

  it("로비 → assigning: 420ms 동안 마지막 로비 view 로 Lobby 가 나가는 가림막(exiting)에 남고, 그 뒤 Assigning 이 나온다", () => {
    vi.useFakeTimers();
    setReduced(false);
    connectionMock.current = conn({ view: at("lobby") });
    const { container, rerender } = mount();
    expect(stage.props!.exiting).toBeFalsy();
    connectionMock.current = conn({ view: at("assigning") });
    rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(container.querySelector("main.mf-lobby")).not.toBeNull();
    expect(container.querySelector("main.mf-assign")).toBeNull();
    expect(stage.props!.exiting).toBe(true);
    expect(stage.props!.view.phase).toBe("lobby");
    act(() => {
      vi.advanceTimersByTime(EXIT_CURTAIN_MS - 1);
    });
    expect(container.querySelector("main.mf-lobby")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(container.querySelector("main.mf-lobby")).toBeNull();
    expect(container.querySelector(".mf-assign, main.mf-assign")).not.toBeNull();
  });

  it("가림막 시간은 dur-med 420ms 이다", () => {
    expect(EXIT_CURTAIN_MS).toBe(420);
  });

  it("모션 줄이기면 가림막 없이 바로 Assigning 이다", () => {
    vi.useFakeTimers();
    setReduced(true);
    connectionMock.current = conn({ view: at("lobby") });
    const { container, rerender } = mount();
    connectionMock.current = conn({ view: at("assigning") });
    rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(container.querySelector("main.mf-lobby")).toBeNull();
    expect(container.querySelector(".mf-assign, main.mf-assign")).not.toBeNull();
  });

  it("대기실로 돌아오면 맵을 다시 만든다(Lobby 가 새로 마운트되고 exiting 이 아니다)", () => {
    vi.useFakeTimers();
    setReduced(true);
    connectionMock.current = conn({ view: at("lobby") });
    const { container, rerender } = mount();
    connectionMock.current = conn({ view: at("assigning") });
    rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    stage.props = null;
    connectionMock.current = conn({ view: at("lobby") });
    rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(container.querySelector("main.mf-lobby")).not.toBeNull();
    expect(stage.props).not.toBeNull();
    expect(stage.props!.exiting).toBeFalsy();
  });

  it("가림막 동안 로비로 되돌아오면 가림막이 풀린다", () => {
    vi.useFakeTimers();
    setReduced(false);
    connectionMock.current = conn({ view: at("lobby") });
    const { rerender } = mount();
    connectionMock.current = conn({ view: at("assigning") });
    rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(stage.props!.exiting).toBe(true);
    connectionMock.current = conn({ view: at("lobby") });
    rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(stage.props!.exiting).toBeFalsy();
  });

  it("로비 밖(assigning → roleReveal)의 전환에는 가림막이 없다 — v1.0 흐름 그대로", () => {
    vi.useFakeTimers();
    setReduced(false);
    connectionMock.current = conn({ view: at("assigning") });
    const { container, rerender } = mount();
    expect(container.querySelector("main.mf-lobby")).toBeNull();
    connectionMock.current = conn({ view: at("roleReveal") });
    rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(container.querySelector("main.mf-lobby")).toBeNull();
    // feedback-3: 배정·확인은 3D 무대(PreGame) 위. 무대는 가림막(exiting)·걷기 없이 깔리고 두 단계 사이에 이어진다
    expect(stage.props).not.toBeNull();
    expect(stage.props!.exiting).toBeFalsy();
    expect(stage.props!.canWalk).toBe(false);
  });

  it("로비의 재접속 띠는 떠 있는 변형이다(.mf-reconnect--floating), 문구·아이콘·role 은 v1.0 그대로", () => {
    connectionMock.current = conn({ status: "reconnecting", banner: "reconnecting", canSend: false });
    render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    const banner = document.querySelector(".mf-reconnect") as HTMLElement;
    expect(banner.classList.contains("mf-reconnect--floating")).toBe(true);
    expect(banner.classList.contains("mf-reconnect--reconnecting")).toBe(true);
    expect(banner.getAttribute("role")).toBe("status");
    expect(banner.textContent).toContain("연결이 끊겼어요 · 다시 연결하는 중");
    expect(banner.querySelector("svg")).not.toBeNull();
  });

  it("restored 띠도 로비에서는 떠 있다", () => {
    connectionMock.current = conn({ banner: "restored" });
    render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    const banner = document.querySelector(".mf-reconnect") as HTMLElement;
    expect(banner.classList.contains("mf-reconnect--floating")).toBe(true);
    expect(banner.textContent).toContain("다시 연결됐어요");
  });

  it("다른 단계에서는 floating 클래스 없이 기존 흐름 안 띠이다", () => {
    connectionMock.current = conn({ view: at("assigning"), status: "reconnecting", banner: "reconnecting", canSend: false });
    render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    const banner = document.querySelector(".mf-reconnect") as HTMLElement;
    expect(banner.className).toBe("mf-reconnect mf-reconnect--reconnecting");
  });

  it("띠가 떠 있는 동안 Lobby 는 알림을 억제한다(bannerVisible) — 띠 아래로 사람이 들어와도 알림이 없다", () => {
    connectionMock.current = conn({ banner: "restored", epoch: 1 });
    const { rerender, container } = mount();
    connectionMock.current = conn({ banner: "restored", epoch: 1, view: { ...at("lobby"), players: [...players4, { seat: 4, nickname: "하준", connected: true, isHost: false }] } });
    rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(container.querySelector(".mv-toast__text")?.textContent ?? "").toBe("");
  });
});

describe("RoomScreen: 채팅 저장소 연결 (CHAT-01, 07-13)", () => {
  const mount = () => render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  const again = (rerender: (ui: React.ReactElement) => void) => rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  const players2: RoomView["players"] = [
    { seat: 0, nickname: "민수", connected: true, isHost: true },
    { seat: 1, nickname: "하윤", connected: true, isHost: false },
  ];
  const at = (phase: RoomView["phase"], extra: Partial<RoomView> = {}): RoomView => ({ ...view, phase, players: players2, me: { seat: 1, isHost: false }, ...extra });
  const chatFrame = (seq: number, text: string): RoomEvent => ({ t: "chat", ch: "all", seat: 0, seq, text, at: 1000 + seq });
  const texts = (container: HTMLElement): string => [...container.querySelectorAll(".mv-chat__msg .mv-chat__text")].map((el) => el.textContent ?? "").join("|");
  let listener: ((e: RoomEvent, meta: { epoch: number }) => void) | undefined;
  const withListener = (over: Partial<RoomConnection> = {}) => {
    listener = undefined;
    connectionMock.current = conn({
      onEvent: vi.fn((l: (e: RoomEvent, meta: { epoch: number }) => void) => {
        listener = l;
        return () => {};
      }),
      ...over,
    });
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    stage.props = null;
  });

  it("연결과 같은 구독 하나로 chat 프레임이 로비 기록 칸에 들어온다", () => {
    withListener({ view: at("lobby") });
    const { container } = mount();
    expect(texts(container)).toBe("");
    act(() => listener!(chatFrame(1, "안녕하세요"), { epoch: 1 }));
    expect(texts(container)).toBe("안녕하세요");
    expect((connectionMock.current as RoomConnection).onEvent).toHaveBeenCalledTimes(1);
  });

  it("chatLog 가 줄을 다시 채운다", () => {
    withListener({ view: at("lobby") });
    const { container } = mount();
    act(() => listener!({ t: "chatLog", lines: [{ ch: "all", seat: 0, seq: 1, text: "복원 줄", at: 1001 }] }, { epoch: 1 }));
    expect(texts(container)).toBe("복원 줄");
  });

  it("같은 판의 대기실 → 대기실(새 view 객체)에서는 줄을 비우지 않는다", () => {
    withListener({ view: at("lobby") });
    const { container, rerender } = mount();
    act(() => listener!(chatFrame(1, "남는 줄"), { epoch: 1 }));
    connectionMock.current = { ...(connectionMock.current as RoomConnection), view: at("lobby", { serverNow: 2000 }) };
    again(rerender);
    expect(texts(container)).toBe("남는 줄");
  });

  it("게임으로 갔다가 대기실로 돌아오면 줄을 비운다 (A2)", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }));
    withListener({ view: at("lobby") });
    const { container, rerender } = mount();
    act(() => listener!(chatFrame(1, "지난 판 줄"), { epoch: 1 }));
    expect(texts(container)).toBe("지난 판 줄");
    connectionMock.current = { ...(connectionMock.current as RoomConnection), view: at("assigning") };
    again(rerender);
    connectionMock.current = { ...(connectionMock.current as RoomConnection), view: at("lobby") };
    again(rerender);
    expect(texts(container)).toBe("");
  });

  it("처음 받는 view 가 대기실이어도 비우기는 일어나지 않는다 (줄은 그 뒤에 들어온다)", () => {
    withListener({ view: at("lobby") });
    const { container } = mount();
    act(() => listener!(chatFrame(1, "첫 줄"), { epoch: 1 }));
    expect(texts(container)).toBe("첫 줄");
  });

  it("거절 프레임은 기록 칸 맨 아래 알림으로 뜬다", () => {
    withListener({ view: at("lobby") });
    const { container } = mount();
    act(() => listener!({ t: "chatReject", why: "rate" }, { epoch: 1 }));
    expect(container.querySelector("[data-chat-notice]")?.textContent).toBe("조금 천천히 보내요");
  });

  it("보내기는 연결의 send 로 chat 메시지를 보낸다", () => {
    const send = vi.fn((_msg: ClientMessage) => true);
    withListener({ view: at("lobby"), send });
    const { container } = mount();
    const input = container.querySelector("[data-chat-input]") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "하이" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    // 입력 중 신호(typing)는 07-18 부터 글을 넣을 때 따로 나간다 — 채팅 메시지만 가려 본다.
    const chats = send.mock.calls.map((c) => c[0]).filter((m) => m.t === "chat");
    expect(JSON.stringify(chats[0])).toBe(JSON.stringify({ t: "chat", text: "하이", pk: "1:0:lobby" }));
  });

  it("2판(view.round 2)이면 보내는 단계 키가 2: 로 시작한다 (D-26)", () => {
    const send = vi.fn((_msg: ClientMessage) => true);
    withListener({ view: { ...at("lobby"), round: 2 }, send });
    const { container } = mount();
    const input = container.querySelector("[data-chat-input]") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "하이" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    const chats = send.mock.calls.map((c) => c[0]).filter((m) => m.t === "chat");
    expect((chats[0] as { pk: string }).pk).toBe("2:0:lobby");
  });
});


// ---------- 07-19: 방 높이는 px 로 고정한다 (CHAT-05, UI-SPEC 패널과 키보드 — 100dvh 로 키보드를 따라가지 않는다) ----------

describe("RoomScreen: 방 높이 --mf-room-h (CHAT-05)", () => {
  let height = 700;
  const root = (container: HTMLElement) => container.querySelector(".mf-room") as HTMLElement;
  const roomH = (container: HTMLElement) => root(container).style.getPropertyValue("--mf-room-h");
  const settle = () => act(() => void vi.advanceTimersByTime(50));

  beforeEach(() => {
    vi.useFakeTimers();
    height = 700;
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("mf-room") ? height : 0;
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("처음 그릴 때 측정한 방 높이를 px 로 쓴다", () => {
    const { container } = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(roomH(container)).toBe("700px");
  });

  it("입력칸에 포커스가 없을 때 화면 크기가 바뀌면(방향 전환·주소창) 다시 정한다", () => {
    const { container } = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    height = 390;
    act(() => void window.dispatchEvent(new Event("orientationchange")));
    settle();
    expect(roomH(container)).toBe("390px");
    height = 420;
    act(() => void window.dispatchEvent(new Event("resize")));
    settle();
    expect(roomH(container)).toBe("420px");
  });

  it("채팅 입력칸에 포커스가 있는 동안의 resize(키보드)는 방 높이를 바꾸지 않는다", () => {
    const { container } = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    const input = container.querySelector("[data-chat-input]") as HTMLInputElement;
    act(() => input.focus());
    height = 380;
    act(() => void window.dispatchEvent(new Event("resize")));
    settle();
    expect(roomH(container)).toBe("700px");
    act(() => input.blur());
    act(() => void window.dispatchEvent(new Event("resize")));
    settle();
    expect(roomH(container)).toBe("380px");
  });

  it("높이를 읽지 못하면(레이아웃 없음) 변수를 쓰지 않아 100dvh 식이 그대로 쓰인다", () => {
    height = 0;
    const { container } = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(roomH(container)).toBe("");
  });
});

// ---------- 11-12: 판 번호(round)가 바뀐 view 는 처음 접속한 것처럼 그린다 (D-26, T-11-39) ----------

describe("RoomScreen: round 변화 초기화 (11-12)", () => {
  const mount = () => render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  const again = (rerender: (ui: React.ReactElement) => void) => rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
  const players2: RoomView["players"] = [
    { seat: 0, nickname: "민수", connected: true, isHost: true },
    { seat: 1, nickname: "하윤", connected: true, isHost: false },
  ];
  const lobbyAt = (round: number | undefined): RoomView => ({ ...view, phase: "lobby", players: players2, me: { seat: 1, isHost: false }, ...(round !== undefined ? { round } : {}) });
  const texts = (container: HTMLElement): string => [...container.querySelectorAll(".mv-chat__msg .mv-chat__text")].map((el) => el.textContent ?? "").join("|");
  let listener: ((e: RoomEvent, meta: { epoch: number }) => void) | undefined;
  const withListener = (v: RoomView) => {
    listener = undefined;
    connectionMock.current = conn({
      view: v,
      onEvent: vi.fn((l: (e: RoomEvent, meta: { epoch: number }) => void) => {
        listener = l;
        return () => {};
      }),
    });
  };
  const setView = (v: RoomView) => {
    connectionMock.current = { ...(connectionMock.current as RoomConnection), view: v };
  };
  const chatFrame = (seq: number, text: string): RoomEvent => ({ t: "chat", ch: "all", seat: 0, seq, text, at: 1000 + seq });

  afterEach(() => {
    vi.restoreAllMocks();
    stage.props = null;
  });

  it("round 가 1 → 2 로 바뀌면 보관한 채팅 줄을 비운다", async () => {
    withListener(lobbyAt(1));
    const { container, rerender } = mount();
    act(() => listener!({ t: "chat", ch: "all", seat: 0, seq: 1, text: "지난 판 줄", at: 1001 }, { epoch: 1 }));
    expect(texts(container)).toBe("지난 판 줄");
    setView(lobbyAt(2));
    again(rerender);
    expect(texts(container)).toBe("");
  });

  it("chat·resultLog·world 저장소의 reset 이 각각 불린다 (그 사이 새 snap 이 없었을 때)", async () => {
    const { ChatStore } = await import("../../src/net/chatStore");
    const { ResultLogStore } = await import("../../src/net/resultLogStore");
    const { WorldStore } = await import("../../src/world/store");
    const chatReset = vi.spyOn(ChatStore.prototype, "reset");
    const logReset = vi.spyOn(ResultLogStore.prototype, "reset");
    const worldReset = vi.spyOn(WorldStore.prototype, "reset");
    withListener(lobbyAt(1));
    const { rerender } = mount();
    expect(chatReset).not.toHaveBeenCalled(); // 처음 받은 view 에는 부르지 않는다
    expect(logReset).not.toHaveBeenCalled();
    expect(worldReset).not.toHaveBeenCalled();
    setView(lobbyAt(2));
    again(rerender);
    expect(chatReset).toHaveBeenCalledTimes(1);
    expect(logReset).toHaveBeenCalledTimes(1);
    expect(worldReset).toHaveBeenCalledTimes(1);
  });

  it("새 판 snap 이 이미 와 있으면(view 보다 먼저 도착) 월드 저장소는 비우지 않는다 — 방금 받은 위치를 지우지 않는다", async () => {
    const { WorldStore } = await import("../../src/world/store");
    const worldReset = vi.spyOn(WorldStore.prototype, "reset");
    withListener(lobbyAt(1));
    const { rerender } = mount();
    act(() => listener!({ t: "world", k: "snap", at: 1000, ents: [] }, { epoch: 1 }));
    setView(lobbyAt(2));
    again(rerender);
    expect(worldReset).not.toHaveBeenCalled();
  });

  it("같은 round 의 새 view 객체나 round 가 없는 view 는 비우지 않는다", async () => {
    const { ChatStore } = await import("../../src/net/chatStore");
    const chatReset = vi.spyOn(ChatStore.prototype, "reset");
    withListener(lobbyAt(1));
    const { container, rerender } = mount();
    act(() => listener!(chatFrame(1, "남는 줄"), { epoch: 1 }));
    setView({ ...lobbyAt(1), serverNow: 2000 });
    again(rerender);
    expect(texts(container)).toBe("남는 줄");
    expect(chatReset).not.toHaveBeenCalled();
    // round 없는 view(옛 서버)는 1 로 읽는다 — 1 → (없음) 은 변화가 아니다
    setView(lobbyAt(undefined));
    again(rerender);
    expect(chatReset).not.toHaveBeenCalled();
  });
});
