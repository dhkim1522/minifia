import { act, cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PhaseId, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { usePhaseArrival } from "../../src/net/phaseArrival";

// 08-27: 단계 도착 연출이 맵 화면(GameMap)에서 맵 재마운트 없이 도는지 보려고 방 화면(RoomScreen)을 가짜 연결·가짜 WorldStage 로 그린다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
vi.mock("../../src/components/WorldStage", async () => ({ WorldStage: (await import("../helpers/fakeWorldStage")).FakeWorldStage }));
const { RoomScreen } = await import("../../src/screens/RoomScreen");

afterEach(() => cleanup());

// usePhaseArrival(phase, epoch): 같은 접속(epoch)에서 단계가 바뀐 뒤에는 직전 단계를, 처음 렌더와 epoch 가 함께 바뀐 렌더에서는 null 을 돌려준다.
// 값은 다음 변화까지 유지된다. 역할 확인 → 낮 시작으로 맵 화면(GameMap)이 새로 마운트될 때 낮 시작 알림·연출의 근거다(맵은 재마운트 없이 단계만 따라간다 — gameMap.test 의 '한 장면 키').

type Props = { phase: PhaseId | undefined; epoch: number };
const setup = (initial: Props) => renderHook((p: Props) => usePhaseArrival(p.phase, p.epoch), { initialProps: initial });

describe("usePhaseArrival", () => {
  it("처음 렌더는 null 이다", () => {
    expect(setup({ phase: "roleReveal", epoch: 1 }).result.current).toBeNull();
  });

  it("같은 epoch 에서 단계가 바뀌면 직전 단계를 돌려주고, 같은 단계로 다시 그려도 값을 유지한다", () => {
    const { result, rerender } = setup({ phase: "roleReveal", epoch: 1 });
    rerender({ phase: "dayAnnounce", epoch: 1 });
    expect(result.current).toBe("roleReveal");
    rerender({ phase: "dayAnnounce", epoch: 1 });
    expect(result.current).toBe("roleReveal");
  });

  it("다음 단계 변화가 오면 값이 그 직전 단계로 바뀐다", () => {
    const { result, rerender } = setup({ phase: "roleReveal", epoch: 1 });
    rerender({ phase: "dayAnnounce", epoch: 1 });
    rerender({ phase: "discussion", epoch: 1 });
    expect(result.current).toBe("dayAnnounce");
  });

  it("단계와 epoch 가 함께 바뀐 렌더(재접속)는 null 이고, 이후 같은 epoch 의 변화부터 다시 직전 단계다", () => {
    const { result, rerender } = setup({ phase: "roleReveal", epoch: 1 });
    rerender({ phase: "dayAnnounce", epoch: 2 });
    expect(result.current).toBeNull();
    rerender({ phase: "dayAnnounce", epoch: 2 });
    expect(result.current).toBeNull();
    rerender({ phase: "discussion", epoch: 2 });
    expect(result.current).toBe("dayAnnounce");
  });

  it("epoch 만 바뀌고 단계는 같으면 null 로 돌아간다 (재접속 뒤에는 옛 도착을 되풀이하지 않는다)", () => {
    const { result, rerender } = setup({ phase: "roleReveal", epoch: 1 });
    rerender({ phase: "dayAnnounce", epoch: 1 });
    expect(result.current).toBe("roleReveal");
    rerender({ phase: "dayAnnounce", epoch: 2 });
    expect(result.current).toBeNull();
  });

  it("view 가 아직 없어 단계가 undefined 이다가 첫 state(epoch 증가)로 단계가 생기면 null 이다", () => {
    const { result, rerender } = setup({ phase: undefined, epoch: 0 });
    expect(result.current).toBeNull();
    rerender({ phase: "lobby", epoch: 1 });
    expect(result.current).toBeNull();
    rerender({ phase: "assigning", epoch: 1 });
    expect(result.current).toBe("lobby");
  });

  it("렌더 중 상태 조정이라 effect 를 기다리지 않는다 (바뀐 렌더가 곧바로 직전 단계를 본다)", () => {
    const seen: Array<PhaseId | null> = [];
    const { rerender } = renderHook(
      (p: Props) => {
        const from = usePhaseArrival(p.phase, p.epoch);
        seen.push(from);
        return from;
      },
      { initialProps: { phase: "roleReveal", epoch: 1 } as Props },
    );
    act(() => rerender({ phase: "dayAnnounce", epoch: 1 }));
    expect(seen.at(-1)).toBe("roleReveal");
  });
});

describe("단계 도착 — 맵 화면(GameMap)은 재마운트 없이 단계만 따라간다 (DAY-07, 08-27)", () => {
  const NOW = 1_700_000_000_000;
  const view = (phase: PhaseId): RoomView => ({
    code: "0042",
    phase,
    phaseEndsAt: NOW + 15_000,
    phaseDurationMs: 15_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: [0, 1, 2, 3].map((seat) => ({ seat, nickname: ["민수", "영희", "서준", "지아"][seat]!, connected: true, isHost: seat === 0 })),
    me: { seat: 0, isHost: true, role: "citizen", chat: "all" },
    day: { n: 1, roles: [] },
  });
  const conn = (v: RoomView, epoch: number): RoomConnection => ({
    status: "open",
    banner: "hidden",
    view: v,
    offset: 0,
    epoch,
    removedReason: null,
    canSend: true,
    send: vi.fn(() => true),
    onEvent: vi.fn(() => () => {}),
    reconnect: vi.fn(),
    retry: vi.fn(),
  });

  it("역할 확인에서 낮 시작으로 들어오면 맵 화면이 한 번 마운트되고, 낮 시작 → 토론 → 지목 → 밤으로 가도 같은 노드다", () => {
    connectionMock.current = conn(view("roleReveal"), 1);
    const ui = () => <RoomScreen code="0042" token={"t".repeat(43)} onExit={() => {}} />;
    const r = render(ui());
    expect(r.container.querySelector("main.mf-game")).toBeNull();
    connectionMock.current = conn(view("dayAnnounce"), 1);
    r.rerender(ui());
    const root = r.container.querySelector("main.mf-game");
    const stage = r.container.querySelector("[data-world-stage-fake]");
    expect(root).not.toBeNull();
    expect(stage).not.toBeNull();
    for (const phase of ["discussion", "nomination", "night"] as const) {
      connectionMock.current = conn(view(phase), 1);
      r.rerender(ui());
      expect(r.container.querySelector("main.mf-game"), phase).toBe(root);
      expect(r.container.querySelector("[data-world-stage-fake]"), phase).toBe(stage);
    }
  });

  it("재접속(epoch 변화)으로 낮 시작에 바로 들어와도 맵 화면이 그려지고 도착 단계에 기대지 않는다", () => {
    connectionMock.current = conn(view("roleReveal"), 1);
    const ui = () => <RoomScreen code="0042" token={"t".repeat(43)} onExit={() => {}} />;
    const r = render(ui());
    connectionMock.current = conn(view("dayAnnounce"), 2);
    r.rerender(ui());
    expect(r.container.querySelector("main.mf-game")?.getAttribute("data-phase")).toBe("dayAnnounce");
  });
});
