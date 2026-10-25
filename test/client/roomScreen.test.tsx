import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 연결 훅은 반환값을 테스트가 정한다. 소켓·타이머는 useRoomConnection.test 가 본다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

const { RoomScreen } = await import("../../src/screens/RoomScreen");

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
    const banner = screen.getByRole("status");
    expect(banner.textContent).toContain("연결이 끊겼어요 · 다시 연결하는 중");
    expect(banner.className).toContain("mf-reconnect");
    const body = container.querySelector(".mf-room__body") as HTMLElement;
    expect(body).not.toBeNull();
    // 띠가 본문 앞에 온다(문서 순서) — 띠가 생기면 본문이 그만큼 줄어든다.
    expect(banner.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 끊긴 동안에도 마지막 화면(대기실)은 그대로 그려진다.
    expect(screen.getByText("0042")).toBeTruthy();
  });

  it("restored 면 '다시 연결됐어요'", () => {
    connectionMock.current = conn({ banner: "restored" });
    render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toContain("다시 연결됐어요");
  });

  it("banner 가 hidden 이면 띠가 없다", () => {
    render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(screen.queryByRole("status")).toBeNull();
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
    expect(screen.getByText("0042")).toBeTruthy();
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
