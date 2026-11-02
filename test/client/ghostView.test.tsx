import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import type { RoleId } from "../../shared/game/roles";
import type { ClientMessage, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import type { SceneLook } from "../../src/world/presence";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 08-17: 유령 화면(GHOST-01·02). RoomScreen 을 거쳐 GameMap 을 그리고 WorldStage 는 진짜를 쓴다 —
// 이름표(data-role-chip·data-ghost-seat)는 WorldStage 가 그리는 DOM 이라서다. 런타임(three)만 가짜로 바꿔 장면 표(setScene)와 탭(tap)을 읽는다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

const rt = vi.hoisted(() => ({ scenes: [] as unknown[], created: 0, taps: 0 }));
vi.mock("../../src/world/runtime", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/world/runtime")>();
  return {
    ...real,
    createWorldRuntime: () => {
      rt.created += 1;
      return {
        start: () => Promise.resolve(),
        syncPlayers: () => {},
        deny: () => {},
        setScene: (look: unknown) => rt.scenes.push(look),
        tap: () => {
          rt.taps += 1;
          return { x: 1, z: 1 };
        },
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
const JOBS: RoleId[] = ["mafia", "police", "doctor", "citizen", "citizen", "citizen", "mafia", "citizen"];
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
  candidate?: number;
  /** true 면 서버가 탈락한 본인에게 싣는 spectate 를 만든다(내가 dead 일 때만) */
  spectate?: boolean;
}

function makeView(o: ViewOpts = {}): RoomView {
  const count = o.count ?? 5;
  const mySeat = o.mySeat ?? 0;
  const phase = o.phase ?? "discussion";
  const dead = o.dead ?? [];
  const meDead = dead.includes(mySeat);
  const players = Array.from({ length: count }, (_, seat) => player(seat, dead.includes(seat) ? { alive: false } : {}));
  const view: RoomView = {
    code: "0042",
    phase,
    phaseEndsAt: NOW + 10_000,
    phaseDurationMs: 10_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: mySeat, isHost: mySeat === 0, chat: meDead ? "ghost" : "all" },
    day: { n: 1, roles: [], ...(o.candidate !== undefined ? { candidate: o.candidate } : {}) },
  };
  if (meDead && o.spectate !== false) {
    view.spectate = { seats: players.map((p) => ({ seat: p.seat, job: JOBS[p.seat] ?? "citizen" })) };
  }
  return view;
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

const lastScene = (): SceneLook => rt.scenes[rt.scenes.length - 1] as SceneLook;
const chips = (c: ParentNode): HTMLElement[] => [...c.querySelectorAll<HTMLElement>("[data-role-chip]")];

beforeEach(() => {
  rt.scenes.length = 0;
  rt.created = 0;
  rt.taps = 0;
  installMemoryStorage();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("유령 화면 — 서버가 보낸 관전 정보로 그려진다 (GHOST-02, 트레이서)", () => {
  // 산 4 · 죽은 1(나 = 4)
  const ghost = () => makeView({ mySeat: 4, dead: [4] });

  it("탈락한 내 view(+spectate): 루트에 data-ghost-view 하나, 모든 이름표에 직업 칩(직업 이름 aria-label)", () => {
    const { container } = mount(ghost());
    expect(container.querySelectorAll('[data-ghost-view="true"]').length).toBe(1);
    expect(container.querySelector("main")?.getAttribute("data-ghost-view")).toBe("true");
    expect(chips(container).length).toBe(5);
    const bySeat = (seat: number) => container.querySelector(`[data-seat="${seat}"] [data-role-chip]`);
    expect(bySeat(0)?.getAttribute("aria-label")).toBe("마피아");
    expect(bySeat(1)?.getAttribute("aria-label")).toBe("경찰");
    expect(bySeat(2)?.getAttribute("aria-label")).toBe("의사");
    expect(bySeat(3)?.getAttribute("aria-label")).toBe("시민");
    expect(bySeat(4)?.getAttribute("data-role-chip")).toBe("citizen");
  });

  it("죽은 좌석(나)의 이름표에 data-ghost-seat 와 반투명(data-ghost), 산 좌석에는 없다", () => {
    const { container } = mount(ghost());
    expect(container.querySelector('[data-seat="4"]')?.hasAttribute("data-ghost-seat")).toBe(true);
    expect(container.querySelector('[data-seat="4"] .mv-head')?.getAttribute("data-ghost")).toBe("true");
    for (const seat of [0, 1, 2, 3]) {
      expect(container.querySelector(`[data-seat="${seat}"]`)?.hasAttribute("data-ghost-seat")).toBe(false);
      expect(container.querySelector(`[data-seat="${seat}"] .mv-head`)?.hasAttribute("data-ghost")).toBe(false);
    }
  });

  it("같은 판의 산 사람 view(spectate 없음)는 data-ghost-view·직업 칩·data-ghost-seat 가 모두 0개", () => {
    const { container } = mount(makeView({ mySeat: 0, dead: [4] }));
    expect(container.querySelectorAll("[data-ghost-view]").length).toBe(0);
    expect(container.querySelectorAll("[data-role-chip]").length).toBe(0);
    expect(container.querySelectorAll("[data-ghost-seat]").length).toBe(0);
  });

  it("내 alive 가 false 여도 서버가 spectate 를 안 보냈으면 유령 분기를 그리지 않는다(받아서 감추지도 않는다)", () => {
    const { container } = mount(makeView({ mySeat: 4, dead: [4], spectate: false }));
    expect(container.querySelectorAll("[data-ghost-view]").length).toBe(0);
    expect(container.querySelectorAll("[data-role-chip]").length).toBe(0);
    expect(lastScene()).toBeDefined();
  });
});

// ---- Task 2: 유령이 되는 순간 · 유령 걷기 · 유령 조작 없음 · 카메라 (GHOST-01, UI Considerations E6 #20·#22) ----

const ICON_GHOST = "M5 21V11";
const input = (c: ParentNode): HTMLInputElement | null => c.querySelector("[data-chat-input]");
const hintEl = (c: ParentNode): Element | null => c.querySelector("[data-guide]");
const sysLines = (c: ParentNode) =>
  [...c.querySelectorAll("[data-chat-log] > p.mv-chat__sys")].map((p) => ({
    text: (p.textContent ?? "").trim(),
    icon: p.querySelector("svg path")?.getAttribute("d")?.slice(0, 8) ?? "",
  }));
const GHOST_LINE = "유령 채팅 · 산 사람에게 안 보여요";

describe("유령이 되는 순간 (UI Considerations E6 #20·#22)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const alive = (phase: PhaseId) => makeView({ phase, mySeat: 4, dead: [] });
  const dead = (phase: PhaseId) => makeView({ phase, mySeat: 4, dead: [4] });

  it("산 사람 → 유령으로 바뀐 view: ghost 아이콘 시스템 줄 '유령 채팅 · 산 사람에게 안 보여요' 가 한 번, 같은 유령 view 가 다시 와도 두 번째는 없다", () => {
    const m = mount(alive("discussion"));
    expect(sysLines(m.container)).toEqual([]);
    vi.setSystemTime(NOW + 500);
    m.show(dead("discussion"));
    expect(sysLines(m.container)).toEqual([{ text: GHOST_LINE, icon: ICON_GHOST }]);
    m.show(dead("discussion"));
    m.show({ ...dead("discussion"), serverNow: NOW + 900 });
    expect(sysLines(m.container)).toHaveLength(1);
  });

  it("처형(verdict → execution)으로 내가 탈락해도 줄 한 번, 이전 채팅 기록은 그대로 남는다", () => {
    const m = mount(alive("verdict"));
    const log = m.container.querySelector("[data-chat-log]");
    expect(log).not.toBeNull();
    m.show(dead("execution"));
    expect(sysLines(m.container).map((l) => l.text)).toEqual([GHOST_LINE]);
  });

  it("헤더 안내 '모두의 직업이 보여요' 가 같은 단계 안에서 유령이 된 순간 다시 2.5초 보였다 접힌다", () => {
    const m = mount(alive("discussion"));
    act(() => void vi.advanceTimersByTime(3000));
    expect(hintEl(m.container)?.classList.contains("is-folded")).toBe(true);
    m.show(dead("discussion"));
    expect(hintEl(m.container)?.textContent).toBe("모두의 직업이 보여요");
    expect(hintEl(m.container)?.classList.contains("is-folded")).toBe(false);
    act(() => void vi.advanceTimersByTime(2400));
    expect(hintEl(m.container)?.classList.contains("is-folded")).toBe(false);
    act(() => void vi.advanceTimersByTime(200));
    expect(hintEl(m.container)?.classList.contains("is-folded")).toBe(true);
  });

  it("직업 칩 등장: 유령이 된 순간에만 루트에 data-ghost-enter, 2.5초 뒤 사라진다. CSS 는 dur-med 등장 + 모션 줄이기면 none", () => {
    const m = mount(alive("discussion"));
    expect(m.container.querySelector("[data-ghost-enter]")).toBeNull();
    m.show(dead("discussion"));
    expect(m.container.querySelector("main")?.getAttribute("data-ghost-enter")).toBe("true");
    expect(chips(m.container)).toHaveLength(5);
    act(() => void vi.advanceTimersByTime(2600));
    expect(m.container.querySelector("[data-ghost-enter]")).toBeNull();
    const css = readFileSync("src/styles/game.css", "utf8");
    expect(css).toMatch(/\[data-ghost-enter\][^{]*\.mv-rolechip\s*\{[^}]*animation:[^}]*var\(--dur-med\)/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{[^}]*\[data-ghost-enter\][^}]*animation: none/);
  });

  it("재접속·새로 고침의 첫 스냅샷이 유령이면 시스템 줄도 등장 연출도 없이 칩·반투명·유령 채널만 있다", () => {
    const m = mount(dead("discussion"));
    expect(sysLines(m.container)).toEqual([]);
    expect(m.container.querySelector("[data-ghost-enter]")).toBeNull();
    expect(chips(m.container)).toHaveLength(5);
    expect(m.container.querySelector("main")?.getAttribute("data-ghost-view")).toBe("true");
    expect(m.container.querySelector('[data-seat="4"]')?.hasAttribute("data-ghost-seat")).toBe(true);
    expect(input(m.container)?.getAttribute("placeholder")).toBe("유령끼리만 보여요");
    // epoch 가 바뀐 재접속 첫 스냅샷도 같다
    m.show(alive("discussion"), { epoch: 2 });
    m.show(dead("discussion"), { epoch: 3 });
    expect(m.container.querySelector("[data-ghost-enter]")).toBeNull();
    expect(sysLines(m.container)).toEqual([]);
  });

  it("살아 있는 사람 화면은 어느 단계 변화에서도 유령 줄·등장 속성이 생기지 않는다", () => {
    const m = mount(makeView({ phase: "discussion", mySeat: 0 }));
    m.show(makeView({ phase: "discussion", mySeat: 0, dead: [4] }));
    m.show(makeView({ phase: "nomination", mySeat: 0, dead: [4] }));
    expect(sysLines(m.container).map((l) => l.text)).not.toContain(GHOST_LINE);
    expect(sysLines(m.container).filter((l) => l.icon === ICON_GHOST)).toEqual([]);
    expect(m.container.querySelector("[data-ghost-enter]")).toBeNull();
  });
});

describe("유령 조작 없음 · 걷기 · 카메라 (GHOST-01, A4)", () => {
  const phases: PhaseId[] = ["discussion", "nomination", "defense", "verdict", "execution"];
  const ghostIn = (phase: PhaseId) => makeView({ phase, mySeat: 4, dead: [4], candidate: 2 });

  it("유령 view 의 모든 낮 단계에 지목 버튼·찬반 버튼·토론 끝내기가 없다", () => {
    for (const phase of phases) {
      const { container } = mount(ghostIn(phase));
      expect(container.querySelectorAll("[data-pick]"), phase).toHaveLength(0);
      expect(container.querySelectorAll("[data-verdict]"), phase).toHaveLength(0);
      expect(container.querySelectorAll("[data-end-discussion]"), phase).toHaveLength(0);
      cleanup();
    }
  });

  it("같은 단계의 산 사람 view 에는 있다(비교): 지목 버튼 · 찬반 버튼 · 토론 끝내기", () => {
    const a = mount(makeView({ phase: "nomination", mySeat: 0, candidate: 2 }));
    expect(a.container.querySelectorAll("[data-pick]").length).toBeGreaterThan(0);
    cleanup();
    const b = mount(makeView({ phase: "verdict", mySeat: 0, candidate: 2 }));
    expect(b.container.querySelectorAll("[data-verdict]")).toHaveLength(2);
    cleanup();
    const c = mount(makeView({ phase: "discussion", mySeat: 0 }));
    expect(c.container.querySelectorAll("[data-end-discussion]")).toHaveLength(1);
  });

  it("유령은 지목 단계에서도 맵을 탭하면 move 를 보낸다, 산 사람은 지목 단계에서 보내지 않는다", () => {
    const tapMap = (container: HTMLElement) => {
      const surface = container.querySelector(".mf-world__input")!;
      fireEvent.pointerDown(surface, { pointerId: 1, clientX: 100, clientY: 300, pointerType: "touch" });
      fireEvent.pointerUp(surface, { pointerId: 1, clientX: 100, clientY: 300, pointerType: "touch" });
    };
    const sendG = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const g = mount(ghostIn("nomination"), { send: sendG });
    tapMap(g.container);
    expect(sendG.mock.calls.filter(([m]) => m.t === "move")).toHaveLength(1);
    cleanup();
    const sendL = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const l = mount(makeView({ phase: "nomination", mySeat: 0, candidate: 2 }), { send: sendL });
    tapMap(l.container);
    expect(sendL.mock.calls.filter(([m]) => m.t === "move")).toHaveLength(0);
  });

  it("카메라: 유령도 낮 토론은 내 유령을 따라가고(follow) 지목·변론·찬반·처형은 가운데 고정(fixed)", () => {
    for (const phase of phases) {
      rt.scenes.length = 0;
      mount(ghostIn(phase));
      expect(lastScene().camera.mode, phase).toBe(phase === "discussion" ? "follow" : "fixed");
      cleanup();
    }
  });

  it("유령 채팅 입력칸은 어느 채팅 단계에서든 '유령끼리만 보여요' 안내이고 입력 레이블이 유령 채널이다", () => {
    for (const phase of ["discussion", "defense"] as const) {
      const { container } = mount(ghostIn(phase));
      expect(input(container)?.getAttribute("placeholder")).toBe("유령끼리만 보여요");
      expect(input(container)?.getAttribute("aria-label")).toBe("유령 채팅 입력");
      cleanup();
    }
  });
});
