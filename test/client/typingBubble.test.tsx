import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import type { WorldStageProps } from "../../src/components/WorldStage";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// feedback-1 (09-24): 게임 맵에서 서버 typing 프레임 → 머리 위 '…' 알약(typingSeats) 회귀 시험.
// 사람의 입력 중 경로(07-10·07-18)는 이미 있다. 사용자 테스트 방은 봇 방이라 봇이 보내는 typing(서버 안 중계)이 같은 프레임으로 오면 알약이 켜지고,
// 같은 좌석의 chat 줄이 오면 꺼지는 것을 낮 토론·밤 마피아 채널 양쪽에서 고정한다. WorldStage 는 받은 props 만 쥐는 가짜다(gameMap.test 와 같은 방식).
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

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

const NOW = 1_700_000_000_000;
const NAMES = ["민수", "영희", "서준", "지아", "도윤", "하은"];

const player = (seat: number): PublicPlayer => ({ seat, nickname: NAMES[seat] ?? `p${seat}`, connected: true, isHost: seat === 0 });

function makeView(phase: PhaseId, me: RoomView["me"]): RoomView {
  return {
    code: "0042",
    phase,
    phaseEndsAt: NOW + 60_000,
    phaseDurationMs: 60_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: Array.from({ length: 6 }, (_, seat) => player(seat)),
    me,
    day: { n: 1, roles: [] },
  };
}

const feed = () => {
  const listeners: Array<(e: never, meta: { epoch: number }) => void> = [];
  const onEvent = vi.fn((l: (typeof listeners)[number]) => {
    listeners.push(l);
    return () => {};
  });
  return { onEvent: onEvent as unknown as RoomConnection["onEvent"], emit: (e: unknown) => act(() => listeners.forEach((l) => l(e as never, { epoch: 1 }))) };
};

function mount(view: RoomView, onEvent: RoomConnection["onEvent"]) {
  connectionMock.current = {
    status: "open",
    banner: "hidden",
    view,
    offset: 0,
    epoch: 1,
    removedReason: null,
    canSend: true,
    send: vi.fn(),
    onEvent,
    reconnect: vi.fn(),
    retry: vi.fn(),
  } satisfies RoomConnection;
  return render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={() => {}} />);
}

const seatsOf = (): number[] => [...(stage.props?.typingSeats ?? [])].sort((a, b) => a - b);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  stage.props = null;
  vi.useRealTimers();
});

describe("게임 맵 입력 중 알약 (feedback-1)", () => {
  it("낮 토론: typing on 프레임이 오면 그 좌석이 알약 좌석이 되고, 같은 좌석의 chat 줄이 오면 사라진다", () => {
    const f = feed();
    mount(makeView("discussion", { seat: 0, isHost: true, chat: "all" }), f.onEvent);
    expect(seatsOf()).toEqual([]);
    f.emit({ t: "typing", seat: 2, on: true });
    expect(seatsOf()).toEqual([2]);
    f.emit({ t: "chat", seat: 2, ch: "all", seq: 1, text: "저 아니에요", at: NOW });
    expect(seatsOf()).toEqual([]);
  });

  it("밤 산 마피아: 마피아 채널 typing 프레임도 같은 방식으로 알약 좌석이 된다", () => {
    const f = feed();
    mount(makeView("night", { seat: 0, isHost: true, role: "mafia", allies: [4], chat: "mafia" }), f.onEvent);
    f.emit({ t: "typing", seat: 4, on: true });
    expect(seatsOf()).toEqual([4]);
    f.emit({ t: "chat", seat: 4, ch: "mafia", seq: 1, text: "저쪽이 수상해", at: NOW });
    expect(seatsOf()).toEqual([]);
  });

  it("typing off 프레임이 오면 꺼진다", () => {
    const f = feed();
    mount(makeView("discussion", { seat: 0, isHost: true, chat: "all" }), f.onEvent);
    f.emit({ t: "typing", seat: 3, on: true });
    expect(seatsOf()).toEqual([3]);
    f.emit({ t: "typing", seat: 3, on: false });
    expect(seatsOf()).toEqual([]);
  });
});
