/// <reference types="node" />
import { act, cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PhaseId, RoomView } from "../../shared/protocol";
import { setEngineForTest } from "../../src/audio/unlock";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { lastWorldStage } from "../helpers/fakeWorldStage";
import { makeRig } from "../helpers/soundRig";

// 14-01: 자막 띠(HOST-01)와 시간 막대 + 숫자(TOOL-02)를 방 화면(RoomScreen)에서 단계별로 본다.
// 문구 표 전체는 test/unit/hostLine.test.ts 가, 이 파일은 "방 틀에 띠가 한 번 그려지고 view 의 줄을 보인다" 를 고정한다.

const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
vi.mock("../../src/net/assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/net/assets")>()),
  preloadRoleAssets: vi.fn(),
  preloadDuskAssets: vi.fn(),
}));
vi.mock("../../src/components/WorldStage", async () => ({ WorldStage: (await import("../helpers/fakeWorldStage")).FakeWorldStage }));

const { RoomScreen } = await import("../../src/screens/RoomScreen");

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
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  setEngineForTest(null);
  vi.useRealTimers();
});

const bands = (c: HTMLElement) => c.querySelectorAll<HTMLElement>("[data-host-band]");

describe("자막 띠 트레이서 (HOST-01, TOOL-02)", () => {
  it("낮 토론: 띠가 하나, 문장·90초 숫자·timer 이름이 보인다", () => {
    const { container } = renderRoom(makeView({ phase: "discussion" }));
    expect(bands(container)).toHaveLength(1);
    const line = container.querySelector("[data-host-line]");
    expect(line?.textContent).toBe("토론 시간입니다. 의심 가는 사람을 이야기해 주세요.");
    const time = container.querySelector<HTMLElement>("[data-host-time]");
    expect(time?.textContent).toBe("90초");
    expect(time?.getAttribute("role")).toBe("timer");
    expect(time?.getAttribute("aria-label")).toBe("남은 시간 90초");
  });

  it("85초가 지나면 5초, 시간 표시가 urgent(진홍) 표식을 단다", () => {
    const { container } = renderRoom(makeView({ phase: "discussion" }));
    act(() => {
      vi.advanceTimersByTime(85_000);
    });
    const time = container.querySelector<HTMLElement>("[data-host-time]");
    expect(time?.textContent).toBe("5초");
    expect(time?.getAttribute("data-tone")).toBe("urgent");
  });

  it("유령 토론: 관전 줄", () => {
    const { container } = renderRoom(makeView({ phase: "discussion", ghost: true }));
    expect(container.querySelector("[data-host-line]")?.textContent).toBe("유령은 지켜보며 유령끼리 이야기할 수 있습니다.");
  });

  it("대기실: 띠는 있고 시간 행은 없다", () => {
    const { container } = renderRoom(makeView({ phase: "lobby", endsIn: null }));
    expect(bands(container)).toHaveLength(1);
    expect(container.querySelector("[data-host-time]")).toBeNull();
  });

  it("쉬는 사람 화면에는 띠가 없다 (T-14-04)", () => {
    const { container } = renderRoom(makeView({ phase: "discussion", resting: true }));
    expect(bands(container)).toHaveLength(0);
  });

  it("view 가 없는 연결 중 화면에는 띠가 없다", () => {
    connectionMock.current = conn({ status: "connecting", view: null, canSend: false });
    const { container } = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(bands(container)).toHaveLength(0);
  });

  it("소리 지원 환경이면 소리 단추가 띠 안 독에 있다 (방 틀 직속이 아님)", () => {
    const rig = makeRig();
    rig.engine.unlock();
    setEngineForTest(rig.engine);
    const { container } = renderRoom(makeView({ phase: "discussion" }));
    const button = container.querySelector("[data-sound-button]");
    expect(button).not.toBeNull();
    expect(button?.closest("[data-host-band]")).not.toBeNull();
    expect(button?.parentElement?.classList.contains("mv-host__dock")).toBe(true);
  });

  it("띠의 data 속성은 값 없는 표식뿐이다 (T-14-03)", () => {
    const { container } = renderRoom(makeView({ phase: "discussion" }));
    for (const sel of ["[data-host-band]", "[data-host-line]"]) {
      const el = container.querySelector(sel)!;
      expect(el.getAttribute(sel.slice(1, -1))).toBe("");
    }
  });
});

// ---- 14-01 Task 3: 띠 아래로 자리 정리 ----
describe("띠 아래 자리 (U-1·U-6·U-8)", () => {
  let bandH = 48;
  let headerButtonBottom = 0;
  let layoutOn = true;
  let resizeCallbacks: Array<() => void> = [];

  const rect = (top: number, bottom: number): DOMRect => ({ top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
  const room = () => document.querySelector<HTMLElement>(".mf-room")!;
  const roomVar = (name: string) => room().style.getPropertyValue(name);

  beforeEach(() => {
    bandH = 48;
    headerButtonBottom = 0;
    layoutOn = true;
    resizeCallbacks = [];
    // happy-dom 에는 레이아웃이 없다: 헤더 62·띠 높이 bandH 를 값으로 돌려준다. 띠 위 끝은 방 틀에 쓴 --mf-host-top(없으면 70)을 따른다 — 변수를 먼저 쓴 뒤 재는지도 함께 본다
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      if (!layoutOn) return rect(0, 0);
      const cls = this.classList;
      if (cls.contains("mf-game__header")) return rect(0, 62);
      if (this.tagName === "BUTTON" && this.closest(".mf-game__header") !== null) return rect(18, headerButtonBottom || 62);
      const hostTop = Number.parseFloat(document.querySelector<HTMLElement>(".mf-room")?.style.getPropertyValue("--mf-host-top") || "") || 70;
      if (cls.contains("mv-host__band")) return rect(hostTop, hostTop + bandH);
      if (cls.contains("mv-host__dock")) return rect(hostTop + bandH + 8, hostTop + bandH + 8 + 4 + 52); // 독 위 안쪽 여백 4 + 소리 원 52
      return rect(0, 0);
    });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("mf-game__panel")) return 244;
      if (this.classList.contains("mf-game__header")) return 62;
      return 0;
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          resizeCallbacks.push(cb);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const rig = makeRig();
    rig.engine.unlock();
    setEngineForTest(rig.engine);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("헤더 아랫변 + 8, 띠 면 아랫변, 독 아랫변이 방 틀 변수로 쓰인다", () => {
    renderRoom(makeView({ phase: "discussion" }));
    expect(roomVar("--mf-host-top")).toBe("70px");
    expect(roomVar("--mf-host-bottom")).toBe("118px");
    expect(roomVar("--mf-host-dock")).toBe("182px"); // 띠 아랫변 118 + 64 (16-06 V-4)
  });

  it("헤더 안 단추가 헤더보다 아래로 나오면 단추 아랫변을 쓴다 (띠가 이름표 단추를 덮지 않게)", () => {
    headerButtonBottom = 80;
    renderRoom(makeView({ phase: "discussion" }));
    expect(roomVar("--mf-host-top")).toBe("88px");
    expect(roomVar("--mf-host-bottom")).toBe("136px");
  });

  it("측정이 0 이면 변수를 쓰지 않는다 (CSS 기본값 70·62·80 이 옛 자리)", () => {
    layoutOn = false;
    renderRoom(makeView({ phase: "discussion" }));
    expect(roomVar("--mf-host-top")).toBe("");
    expect(roomVar("--mf-host-bottom")).toBe("");
    expect(roomVar("--mf-host-dock")).toBe("");
  });

  it("띠가 사라지면(쉬는 사람) 변수도 지워진다", () => {
    const { rerender } = renderRoom(makeView({ phase: "discussion" }));
    expect(roomVar("--mf-host-top")).toBe("70px");
    connectionMock.current = conn({ view: makeView({ phase: "discussion", resting: true }) });
    rerender(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
    expect(document.querySelector("[data-host-band]")).toBeNull();
    expect(roomVar("--mf-host-top")).toBe("");
    expect(roomVar("--mf-host-bottom")).toBe("");
  });

  it("연결이 끊겨도 띠는 마지막 문장과 시간 행을 유지한다 (U-9)", () => {
    const { container } = renderRoom(makeView({ phase: "discussion" }), { status: "reconnecting", banner: "reconnecting", canSend: false });
    expect(container.querySelector("[data-host-line]")?.textContent).toBe("토론 시간입니다. 의심 가는 사람을 이야기해 주세요.");
    expect(container.querySelector("[data-host-time]")?.textContent).toBe("90초");
  });

  it("스테이지 위쪽 안전선 = max(헤더 62, 띠 면 아랫변), 띠가 높아지면 따라 내려간다", () => {
    renderRoom(makeView({ phase: "discussion" }));
    expect(lastWorldStage.props?.stageInsets?.top).toBe(118);
    bandH = 80;
    act(() => void resizeCallbacks.forEach((cb) => cb()));
    expect(lastWorldStage.props?.stageInsets?.top).toBe(150);
  });

  it("자리 규칙이 CSS 에 있다: 테스트 단추·오른쪽 열은 띠 면 아래, 위 알림은 독 아래", () => {
    const css = (file: string) => readFileSync(`src/styles/${file}.css`, "utf8");
    expect(css("lobby")).toMatch(/\.mf-lobby__test\s*\{[^}]*--mf-host-bottom/);
    expect(css("v2")).toMatch(/\.mv-side\s*\{[^}]*--mf-host-bottom/); // 오른쪽 열(맵 칩 포함): 띠 아랫변 + 12 (16-06)
    expect(css("game")).toMatch(/\.mf-game__test\s*\{[^}]*--mf-host-bottom/);
    expect(css("v2")).toMatch(/\.mv-toast--top\s*\{[^}]*--mf-host-dock/);
    expect(css("v2")).toMatch(/\.mv-host\s*\{[^}]*--mf-host-top/);
  });
});
