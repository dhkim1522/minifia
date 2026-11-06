/// <reference types="node" />
import { act, cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PhaseId, RoomView } from "../../shared/protocol";
import { setEngineForTest } from "../../src/audio/unlock";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { lastWorldStage } from "../helpers/fakeWorldStage";
import { makeRig } from "../helpers/soundRig";

// 14-03: 자막 띠의 단계가 바뀐 프레임에 사회자 알림음 신호(host)가 한 번 나간다(HOST-02).
// 판정식 hostChimeOf 자체는 test/unit/hostLine.test.ts 가, 이 파일은 RoomScreen 이 그 식을 어느 프레임에 부르는가를 고정한다.

const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
vi.mock("../../src/net/assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/net/assets")>()),
  preloadRoleAssets: vi.fn(),
  preloadDuskAssets: vi.fn(),
}));
const signalLog = vi.hoisted(() => ({ host: 0 }));
vi.mock("../../src/audio/signals", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/audio/signals")>();
  return {
    ...real,
    emitSignal: (s: import("../../src/audio/signals").LocalSignal) => {
      if (s.kind === "host") signalLog.host += 1;
      real.emitSignal(s);
    },
  };
});
vi.mock("../../src/components/WorldStage", async () => ({ WorldStage: (await import("../helpers/fakeWorldStage")).FakeWorldStage }));

const { RoomScreen } = await import("../../src/screens/RoomScreen");
const { EXIT_CURTAIN_MS } = await import("../../src/world/runtime");

const NOW = 1_700_000_000_000;

interface ViewOpts {
  phase: PhaseId;
  ghost?: boolean;
  endsIn?: number | null;
  durationMs?: number;
  resting?: boolean;
}

function makeView(o: ViewOpts): RoomView {
  const endsIn = o.endsIn === undefined ? 90_000 : o.endsIn;
  return {
    code: "0042",
    phase: o.phase,
    phaseEndsAt: endsIn === null ? null : NOW + endsIn,
    phaseDurationMs: endsIn === null ? null : (o.durationMs ?? endsIn),
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: [
      { seat: 0, nickname: "지우", connected: true, isHost: true, ...(o.ghost ? { alive: false } : {}) },
      { seat: 1, nickname: "하윤", connected: true, isHost: false },
      { seat: 2, nickname: "민지", connected: true, isHost: false },
      { seat: 3, nickname: "도현", connected: true, isHost: false },
    ],
    me: { seat: 0, isHost: true, role: "citizen" },
    day: { n: 1, roles: ["mafia", "police", "citizen"] },
    ...(o.resting ? { resting: true as const } : {}),
  } as RoomView;
}

function conn(over: Partial<RoomConnection>): RoomConnection {
  return {
    status: "open",
    banner: "hidden",
    view: null,
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

function renderRoom(view: RoomView, over: Partial<RoomConnection> = {}) {
  connectionMock.current = conn({ view, ...over });
  return render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
}

beforeEach(() => {
  signalLog.host = 0;
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  setEngineForTest(null);
  vi.useRealTimers();
});

const bands = (c: HTMLElement) => c.querySelectorAll<HTMLElement>("[data-host-band]");

function rerenderRoom(r: ReturnType<typeof renderRoom>, view: RoomView, over: Partial<RoomConnection> = {}) {
  connectionMock.current = conn({ view, ...over });
  r.rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
}

describe("사회자 알림음 발신 (HOST-02, 14-03)", () => {
  it("처음 마운트(토론)는 소리 신호가 없다 — UI#3 첫 프레임", () => {
    renderRoom(makeView({ phase: "discussion" }));
    expect(signalLog.host).toBe(0);
  });

  it("토론 → 지목 → 같은 지목(view 만 새로) → 변론: 단계가 바뀔 때만 한 번씩", () => {
    const r = renderRoom(makeView({ phase: "discussion" }));
    rerenderRoom(r, makeView({ phase: "nomination" }));
    expect(signalLog.host).toBe(1);
    rerenderRoom(r, makeView({ phase: "nomination", endsIn: 80_000 })); // 같은 단계 안 view 변화(선두·점수 등)
    rerenderRoom(r, makeView({ phase: "nomination", endsIn: 70_000 }));
    expect(signalLog.host).toBe(1);
    rerenderRoom(r, makeView({ phase: "defense" }));
    expect(signalLog.host).toBe(2);
  });

  it("연결 번호가 바뀐 같은 프레임에 단계도 바뀜(재접속)은 울리지 않고, 그다음 전환은 다시 센다", () => {
    const r = renderRoom(makeView({ phase: "discussion" }), { epoch: 1 });
    rerenderRoom(r, makeView({ phase: "nomination" }), { epoch: 2 });
    expect(signalLog.host).toBe(0);
    rerenderRoom(r, makeView({ phase: "defense" }), { epoch: 2 });
    expect(signalLog.host).toBe(1);
  });

  it("낮 시작은 울리고 이어지는 토론 진입은 울리지 않는다 — UI#5 알림음은 한 번", () => {
    const r = renderRoom(makeView({ phase: "roleReveal" }));
    rerenderRoom(r, makeView({ phase: "dayAnnounce", endsIn: 2_000 }));
    expect(signalLog.host).toBe(1);
    rerenderRoom(r, makeView({ phase: "discussion" }));
    expect(signalLog.host).toBe(1);
  });

  it("처형 → 밤은 한 번 울린다(밤 진입도 모두에게 같은 공개 전환)", () => {
    const r = renderRoom(makeView({ phase: "execution" }));
    rerenderRoom(r, makeView({ phase: "night" }));
    expect(signalLog.host).toBe(1);
  });

  it("쉬는 사람 view 로의 전환은 울리지 않는다 (띠가 없다)", () => {
    const r = renderRoom(makeView({ phase: "discussion" }));
    rerenderRoom(r, makeView({ phase: "nomination", resting: true }));
    expect(signalLog.host).toBe(0);
    expect(bands(r.container)).toHaveLength(0);
  });

  it("대기실 가림막 동안은 소리가 없고, 가림막이 걷혀 배정이 보이는 프레임에 한 번", () => {
    const r = renderRoom(makeView({ phase: "lobby", endsIn: null }));
    rerenderRoom(r, makeView({ phase: "assigning" })); // 가림막 시작: 띠는 아직 대기실
    expect(signalLog.host).toBe(0);
    act(() => {
      vi.advanceTimersByTime(EXIT_CURTAIN_MS + 10);
    });
    expect(signalLog.host).toBe(1);
  });
});
