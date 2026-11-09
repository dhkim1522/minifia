import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import "../helpers/singleLineErrors";
import type { PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { bindSignals } from "../../src/audio/signals";
import type { LocalSignal } from "../../src/audio/signals";
import type { WorldStageProps } from "../../src/components/WorldStage";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 17-07: 함께 진행 — RoomScreen 의 tutorial 단계 분기. 연결은 모킹하고, 실제 TutorialScreen 은 onEnd 만 부르는 가짜로 바꾼다
// (장면 재생은 tutorialScreen.test 가 따로 본다). WorldStage 도 가짜 — 배정 화면(PreGame)이 쓴다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
vi.mock("../../src/components/WorldStage", async () => {
  const { createElement } = await import("react");
  return {
    WorldStage: (_props: WorldStageProps) => createElement("div", { "data-world-stage-fake": "" }),
  };
});
vi.mock("../../src/screens/TutorialScreen", async () => {
  const { createElement } = await import("react");
  return {
    TutorialScreen: (props: { mode: string; onEnd: (reason: "done" | "skipped") => void }) =>
      createElement(
        "div",
        { "data-tutorial-screen": "", "data-mode": props.mode },
        createElement("button", { "data-fake-end": "", onClick: () => props.onEnd("done") }, "끝"),
        createElement("button", { "data-fake-skip": "", onClick: () => props.onEnd("skipped") }, "건너뛰기"),
      ),
  };
});
const { RoomScreen } = await import("../../src/screens/RoomScreen");

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const NOW = 1_700_000_000_000;

interface Opts {
  phase?: PhaseId;
  done?: number;
  total?: number;
  meDone?: boolean;
  noTutorial?: boolean;
}

function makeView(o: Opts = {}): RoomView {
  const players: PublicPlayer[] = [0, 1, 2].map((seat) => ({
    seat,
    nickname: ["민수", "영희", "서준"][seat]!,
    connected: true,
    isHost: seat === 0,
  }));
  return {
    code: "0042",
    round: 1,
    phase: o.phase ?? "tutorial",
    phaseEndsAt: NOW + 150_000,
    phaseDurationMs: 150_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    map: "bar",
    players,
    me: { seat: 1, isHost: false, ...(o.meDone === true ? { tutorialDone: true as const } : {}) },
    ...(o.phase !== undefined && o.phase !== "tutorial" ? {} : o.noTutorial === true ? {} : { tutorial: { done: o.done ?? 0, total: o.total ?? 3, endsAt: NOW + 150_000 } }),
  };
}

function conn(view: RoomView, send: RoomConnection["send"], epoch = 1): RoomConnection {
  return {
    status: "open",
    banner: "hidden",
    view,
    offset: 0,
    epoch,
    removedReason: null,
    canSend: true,
    send,
    onEvent: vi.fn(() => () => {}),
    reconnect: vi.fn(),
    retry: vi.fn(),
  } as unknown as RoomConnection;
}

function mount(view: RoomView, send: Mock<RoomConnection["send"]> = vi.fn<RoomConnection["send"]>(() => true), epoch = 1) {
  connectionMock.current = conn(view, send, epoch);
  const ui = () => <RoomScreen code="0042" token={"t".repeat(43)} onExit={() => {}} />;
  const r = render(ui());
  return {
    ...r,
    send,
    show: (v: RoomView, nextEpoch = epoch) => {
      connectionMock.current = conn(v, send, nextEpoch);
      r.rerender(ui());
    },
  };
}

const q = (c: ParentNode, sel: string) => c.querySelector<HTMLElement>(sel);

describe("RoomScreen — tutorial 단계 분기 (17-07, TUT-02·TUT-05, T-17-17)", () => {
  it("tutorial 단계: 첫 사건 화면이 함께 모드로 보이고 기다림 화면은 아직 없다", () => {
    const { container } = mount(makeView());
    const screen = q(container, "[data-tutorial-screen]");
    expect(screen).not.toBeNull();
    expect(screen?.getAttribute("data-mode")).toBe("together");
    expect(q(container, "[data-tutorial-wait]")).toBeNull();
  });

  it("끝내면 { t: 'tutorialDone' } 를 정확히 한 번 보내고 기다림 화면(0 / 3)이 된다 — 같은 프레임의 건너뛰기는 추가 send 0", () => {
    const { container, send } = mount(makeView({ done: 0, total: 3 }));
    const end = q(container, "[data-fake-end]")!;
    const skip = q(container, "[data-fake-skip]")!;
    act(() => {
      fireEvent.click(end);
      fireEvent.click(skip);
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ t: "tutorialDone" });
    expect(q(container, "[data-tutorial-screen]")).toBeNull();
    expect(q(container, "[data-tutorial-wait]")).not.toBeNull();
    expect(q(container, "[data-tutorial-count]")?.getAttribute("data-tutorial-count")).toBe("0/3");
  });

  it("건너뛰기도 같은 한 메시지 — 튜토리얼 동안 다른 send 는 0", () => {
    const { container, send } = mount(makeView());
    act(() => {
      fireEvent.click(q(container, "[data-fake-skip]")!);
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toEqual({ t: "tutorialDone" });
  });

  it("보낼 수 없으면(send 가 false) 기다림으로 가지 않고 다시 누르면 다시 보낸다", () => {
    const send = vi.fn<RoomConnection["send"]>(() => false);
    const { container } = mount(makeView(), send);
    act(() => {
      fireEvent.click(q(container, "[data-fake-end]")!);
    });
    expect(q(container, "[data-tutorial-wait]")).toBeNull();
    expect(q(container, "[data-tutorial-screen]")).not.toBeNull();
    send.mockImplementation(() => true);
    act(() => {
      fireEvent.click(q(container, "[data-fake-end]")!);
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(q(container, "[data-tutorial-wait]")).not.toBeNull();
  });

  it("다음 view(done 1, me.tutorialDone) 는 서버 값 1 / 3 을 그린다", () => {
    const { container, show } = mount(makeView({ done: 0, total: 3 }));
    act(() => {
      fireEvent.click(q(container, "[data-fake-end]")!);
    });
    show(makeView({ done: 1, total: 3, meDone: true }));
    expect(q(container, "[data-tutorial-count]")?.getAttribute("data-tutorial-count")).toBe("1/3");
  });

  it("서버가 assigning 으로 넘기면 기존 배정 화면(PreGame)이 이어지고 첫 사건·기다림 화면은 사라진다", () => {
    const { container, show } = mount(makeView());
    act(() => {
      fireEvent.click(q(container, "[data-fake-end]")!);
    });
    show(makeView({ phase: "assigning" }));
    expect(q(container, "[data-tutorial-screen]")).toBeNull();
    expect(q(container, "[data-tutorial-wait]")).toBeNull();
    expect(q(container, ".mf-assign__scene") ?? q(container, "[data-world-stage-fake]")).not.toBeNull();
  });
});

describe("RoomScreen — tutorial 단계의 띠·알림음·소리 소유·재접속 (17-07, 0080-14·15, T-20)", () => {
  it("tutorial 단계에는 실제 사회자 띠·소리 독이 없다(첫 사건 화면이 자기 띠를 그린다) — 기다림 화면에도 없다", () => {
    const { container } = mount(makeView());
    expect(container.querySelectorAll("[data-host-band]:not([data-tutorial-host])")).toHaveLength(0);
    expect(container.querySelectorAll(".mv-host")).toHaveLength(0);
    expect(container.querySelectorAll("[data-sound-button]")).toHaveLength(0);
    act(() => {
      fireEvent.click(q(container, "[data-fake-end]")!);
    });
    expect(q(container, "[data-tutorial-wait]")).not.toBeNull();
    expect(container.querySelectorAll(".mv-host")).toHaveLength(0);
    expect(container.querySelectorAll("[data-sound-button]")).toHaveLength(0);
  });

  it("대기실 → tutorial → assigning 전환에는 사회자 알림음 신호가 없다", () => {
    const got: LocalSignal[] = [];
    const off = bindSignals((sig) => got.push(sig));
    try {
      const { show } = mount(makeView({ phase: "lobby" }));
      show(makeView());
      show(makeView({ phase: "assigning" }));
      expect(got.filter((g) => g.kind === "host")).toHaveLength(0);
    } finally {
      off();
    }
  });

  it("끝났음을 보낸 뒤 연결 번호가 바뀌고 me.tutorialDone 이 없으면 장면 1 부터 다시, 있으면 기다림 화면", () => {
    const { container, show } = mount(makeView(), vi.fn<RoomConnection["send"]>(() => true), 1);
    act(() => {
      fireEvent.click(q(container, "[data-fake-end]")!);
    });
    expect(q(container, "[data-tutorial-wait]")).not.toBeNull();
    show(makeView(), 2);
    expect(q(container, "[data-tutorial-screen]")).not.toBeNull();
    expect(q(container, "[data-tutorial-wait]")).toBeNull();
    show(makeView({ meDone: true }), 3);
    expect(q(container, "[data-tutorial-wait]")).not.toBeNull();
    expect(q(container, "[data-tutorial-screen]")).toBeNull();
  });

  it("같은 연결에서 다음 판이 다시 tutorial 을 거치면 기다림이 아니라 장면 1 부터다(단계를 벗어나면 로컬 끝남 표시를 비운다)", () => {
    const { container, show } = mount(makeView());
    act(() => {
      fireEvent.click(q(container, "[data-fake-end]")!);
    });
    show(makeView({ phase: "assigning" }));
    show(makeView());
    expect(q(container, "[data-tutorial-screen]")).not.toBeNull();
  });
});
