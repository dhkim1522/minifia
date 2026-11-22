import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import type { RoleId } from "../../shared/game/roles";
import type { ClientMessage, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import type { SceneLook } from "../../src/world/presence";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 08-17: 유령 화면(GHOST-01·02). RoomScreen 을 거쳐 GameMap 을 그리고 WorldStage 는 진짜를 쓴다 —
// 떠 있는 이름표의 DOM과 장면 표(setScene), 탭(tap)을 함께 읽는다. 런타임(three)만 가짜로 바꾼다.
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
        stopAllEmotes: () => {},
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
    phaseSkip: phase === "discussion" ? { opensAt: NOW, count: 0, total: count - dead.length, canVote: !meDead } : undefined,
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

  it("탈락한 내 view(+spectate): 관전 모드, 머리 위 이름표와 직업 칩 없음", () => {
    const { container } = mount(ghost());
    expect(container.querySelectorAll('[data-ghost-view="true"]').length).toBe(1);
    expect(container.querySelector("main")?.getAttribute("data-ghost-view")).toBe("true");
    expect(chips(container)).toHaveLength(0);
    expect(container.querySelectorAll(".mf-world__tag")).toHaveLength(0);
  });

  it("장면 표에서만 죽은 좌석을 반투명으로 지정하고 머리 위에는 표식을 붙이지 않는다", () => {
    const { container } = mount(ghost());
    expect(container.querySelectorAll("[data-ghost-seat]")).toHaveLength(0);
    expect(lastScene().seats[4]?.ghost).toBe(true);
    for (const seat of [0, 1, 2, 3]) expect(lastScene().seats[seat]?.ghost).toBe(false);
  });

  it("같은 판의 생존자 화면에는 관전 UI와 탈락 좌석 이름표가 없다", () => {
    const { container } = mount(makeView({ mySeat: 0, dead: [4] }));
    expect(container.querySelectorAll("[data-ghost-view]").length).toBe(0);
    expect(container.querySelectorAll("[data-role-chip]").length).toBe(0);
    expect(container.querySelectorAll("[data-ghost-seat]").length).toBe(0);
    expect(container.querySelectorAll(".mv-tag.is-ghost")).toHaveLength(0);
    expect(container.querySelector('[data-seat="4"] .mv-tag')).toBeNull();
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
const hintEl = (c: ParentNode): Element | null => c.querySelector(".mv-phase__hint");
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

  it("유령이 된 순간에도 헤더 안내 줄을 다시 띄우지 않고 이름표를 즉시 걷는다", () => {
    const m = mount(alive("discussion"));
    act(() => void vi.advanceTimersByTime(3000));
    expect(hintEl(m.container)).toBeNull();
    m.show(dead("discussion"));
    expect(hintEl(m.container)).toBeNull();
    expect(m.container.textContent).not.toContain("모두의 직업이 보여요");
    expect(m.container.querySelectorAll(".mf-world__tag")).toHaveLength(0);
    expect(lastScene().seats[1]?.costume).toBe("police");
  });

  it("재접속·새로 고침의 첫 스냅샷이 유령이면 역할 의상, 반투명 캐릭터와 유령 채널이 바로 보인다", () => {
    const m = mount(dead("discussion"));
    expect(sysLines(m.container)).toEqual([]);
    expect(chips(m.container)).toHaveLength(0);
    expect(m.container.querySelector("main")?.getAttribute("data-ghost-view")).toBe("true");
    expect(lastScene().seats[4]).toEqual({ show: true, ghost: true, costume: "coat" });
    expect(input(m.container)?.getAttribute("placeholder")).toBe("유령끼리만 보여요");
    // epoch 가 바뀐 재접속 첫 스냅샷도 같다
    m.show(alive("discussion"), { epoch: 2 });
    m.show(dead("discussion"), { epoch: 3 });
    expect(sysLines(m.container)).toEqual([]);
  });

  it("살아 있는 사람 화면은 어느 단계 변화에서도 유령 줄을 띄우지 않는다", () => {
    const m = mount(makeView({ phase: "discussion", mySeat: 0 }));
    m.show(makeView({ phase: "discussion", mySeat: 0, dead: [4] }));
    m.show(makeView({ phase: "nomination", mySeat: 0, dead: [4] }));
    expect(sysLines(m.container).map((l) => l.text)).not.toContain(GHOST_LINE);
    expect(sysLines(m.container).filter((l) => l.icon === ICON_GHOST)).toEqual([]);
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
    // 순차 지목(09.1): 지목 버튼은 내 차례에만 있다 — 내 차례(0번)인 view 로 비교한다
    const mine = makeView({ phase: "nomination", mySeat: 0, candidate: 2 });
    const a = mount({ ...mine, day: { ...mine.day!, turn: { order: [0, 1, 2, 3, 4], i: 0, endsAt: mine.serverNow + 8000 } } });
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

  it("카메라: 유령도 낮 토론·찬반은 내 유령을 따라가고(follow) 지목·유언·처형은 가운데 고정(fixed)", () => {
    for (const phase of phases) {
      rt.scenes.length = 0;
      mount(ghostIn(phase));
      expect(lastScene().camera.mode, phase).toBe(phase === "discussion" || phase === "verdict" ? "follow" : "fixed");
      cleanup();
    }
  });

  it("유령 채팅 입력칸은 어느 채팅 단계에서든 '유령끼리만 보여요' 안내이고 입력 레이블이 유령 채널이다", () => {
    for (const phase of ["discussion", "verdict"] as const) { // 유언 단계(defense)는 유령도 잠긴다(22-11 D-16) — 아래 willFlow 묶음이 본다
      const { container } = mount(ghostIn(phase));
      expect(input(container)?.getAttribute("placeholder")).toBe("유령끼리만 보여요");
      expect(input(container)?.getAttribute("aria-label")).toBe("유령 채팅 입력");
      cleanup();
    }
  });
});

// ---- Task 3: 산 사람 화면 유령 흔적 0건 — 단계 전수 (GHOST-01·02, UI Considerations E6 #23 backstop) ----

describe("산 사람 화면에는 유령의 흔적이 없다 (결정 0021, T-08-44)", () => {
  const ALL: PhaseId[] = ["dayAnnounce", "discussion", "nomination", "defense", "verdict", "execution"];
  // 유령 둘(3·4)이 있는 판의 산 사람(0) view — 서버는 산 사람 view 에 spectate 를 싣지 않는다
  const living = (phase: PhaseId) => makeView({ phase, count: 6, mySeat: 0, dead: [3, 4], candidate: 2 });
  const aliveSeats = [0, 1, 2, 5];

  it("주요 낮 단계에서 생존자 화면에는 관전 UI와 탈락 이름표가 없다", () => {
    for (const phase of ALL) {
      const { container } = mount(living(phase));
      expect(container.querySelectorAll("[data-ghost-view]"), phase).toHaveLength(0);
      expect(container.querySelectorAll("[data-role-chip]"), phase).toHaveLength(0);
      expect(container.querySelectorAll("[data-ghost-seat]"), phase).toHaveLength(0);
      expect(container.querySelectorAll(".mv-head[data-ghost]"), phase).toHaveLength(0);
      expect(container.querySelectorAll(".mv-tag.is-ghost"), phase).toHaveLength(0);
      for (const seat of [3, 4]) expect(container.querySelector(`[data-seat="${seat}"] .mv-head`), phase).toBeNull();
      for (const seat of aliveSeats) expect(container.querySelector(`[data-seat="${seat}"] .mv-head`)?.hasAttribute("data-ghost"), phase).toBe(false);
      expect(container.querySelectorAll(".mv-rolechip"), phase).toHaveLength(0);
      const text = container.textContent ?? "";
      expect(text, phase).not.toContain("유령끼리만 보여요");
      expect(text, phase).not.toContain("유령 채팅");
      expect(text, phase).not.toContain("모두의 직업이 보여요");
      cleanup();
    }
  });

  it("생존자의 이름표와 장면에는 생존 좌석이 들어간다", () => {
    for (const phase of ALL) {
      rt.scenes.length = 0;
      const { container } = mount(living(phase));
      const seats = [...container.querySelectorAll<HTMLElement>("[data-seat].mf-world__tag")].map((t) => Number(t.dataset.seat));
      expect(seats, phase).toEqual(aliveSeats);
      const scene = lastScene().seats;
      expect(Object.keys(scene).map(Number).sort((a, b) => a - b), phase).toEqual(aliveSeats);
      for (const seat of aliveSeats) expect(scene[seat]?.ghost, phase).toBe(false);
      cleanup();
    }
  });

  it("밤(산 시민 편)의 장면 표는 내 좌석 하나뿐이고, 밤의 산 사람 화면에는 유령 좌석이 없다", () => {
    for (const phase of ["night"] as PhaseId[]) {
      rt.scenes.length = 0;
      mount(makeView({ phase, count: 6, mySeat: 0, dead: [3, 4] }));
      const scene = lastScene().seats;
      expect(Object.values(scene).some((l) => l.ghost), phase).toBe(false);
      expect(3 in scene || 4 in scene, phase).toBe(false);
      cleanup();
    }
  });

  it("생존자 렌더러가 받은 모든 장면에서 기존 탈락 좌석은 빠진다", () => {
    mount(living("discussion"));
    for (const look of rt.scenes as SceneLook[]) {
      for (const seat of [3, 4]) expect(look.seats[seat]).toBeUndefined();
    }
  });

  it("받아서 감추는 방식이 아니다: 산 사람 view 에 spectate 가 잘못 섞여 와도 유령 분기를 그리지 않는다(내가 산 사람이므로)", () => {
    const stray: RoomView = { ...living("discussion"), spectate: { seats: [0, 1, 2, 3, 4, 5].map((seat) => ({ seat, job: "mafia" as RoleId })) } };
    const { container } = mount(stray);
    expect(container.querySelectorAll("[data-ghost-view]")).toHaveLength(0);
    expect(container.querySelectorAll("[data-role-chip]")).toHaveLength(0);
  });

  it("유령 채널의 채팅·입력 중 신호가 산 사람 연결로 와도(서버가 보내지 않지만) 기록 칸과 이름표에 나타나지 않는다", () => {
    let handler: ((e: never, meta: { epoch: number }) => void) | undefined;
    const onEvent = vi.fn((cb: unknown) => {
      handler = cb as typeof handler;
      return () => {};
    });
    const { container } = mount(living("discussion"), { onEvent: onEvent as unknown as RoomConnection["onEvent"] });
    act(() => {
      handler?.({ t: "chat", ch: "ghost", seat: 3, seq: 1, text: "유령끼리 수다", at: NOW } as never, { epoch: 1 });
      handler?.({ t: "typing", seat: 3, on: true } as never, { epoch: 1 });
    });
    expect(container.textContent).not.toContain("유령끼리 수다");
    expect(container.querySelectorAll('.mv-head[data-typing="true"]')).toHaveLength(0);
    expect(container.querySelector('[data-seat="3"] [data-role-chip]')).toBeNull();
  });
});

describe("유령은 산 사람과 상호작용하지 않는다 (REQUIREMENTS Out of Scope, T-08-45)", () => {
  it("유령이 보내는 메시지는 move 와 채팅뿐이다: 어느 낮 단계에서 맵을 탭하고 이름표를 눌러 봐도 point·verdict·endDiscussion 은 나가지 않는다", () => {
    for (const phase of ["discussion", "nomination", "defense", "verdict", "execution"] as const) {
      const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
      const { container } = mount(makeView({ phase, mySeat: 4, dead: [4], candidate: 2 }), { send });
      for (const tag of container.querySelectorAll<HTMLElement>(".mf-world__tag")) fireEvent.click(tag);
      for (const b of container.querySelectorAll<HTMLElement>("button")) fireEvent.click(b);
      const kinds = send.mock.calls.map(([m]) => m.t);
      expect(kinds.filter((t) => t === "point" || t === "verdict" || t === "endDiscussion"), phase).toEqual([]);
      cleanup();
    }
  });
});

describe("관전 전용 장면의 실제 직업 의상", () => {
  const outfitSeats = (scene: SceneLook) => Object.entries(scene.seats).filter(([, s]) => "outfit" in s || "costume" in s);

  it("유령 view: 시민 탈락자는 기본 코트, 생존자들은 각각 실제 의상을 입는다", () => {
    mount(makeView({ mySeat: 4, dead: [4] }));
    expect(lastScene().seats[4]?.ghost).toBe(true);
    expect(outfitSeats(lastScene()).map(([seat, look]) => [seat, look.costume])).toEqual([
      ["0", "mafia"], ["1", "police"], ["2", "doctor"], ["3", "coat"], ["4", "coat"],
    ]);
  });

  it("마피아였던 탈락자와 시민이었던 탈락자는 서로 다른 직업 의상을 입는다", () => {
    mount(makeView({ mySeat: 4, dead: [0, 4] }));
    expect(lastScene().seats[0]).toEqual({ show: true, ghost: true, costume: "mafia" });
    expect(lastScene().seats[4]).toEqual({ show: true, ghost: true, costume: "coat" });
  });

  it("같은 판의 산 사람 view: 장면 표 어디에도 의상 키가 없고 DOM 에 [data-ghost-outfit] 도 없다", () => {
    const { container } = mount(makeView({ mySeat: 0, dead: [4] }));
    expect(outfitSeats(lastScene())).toEqual([]);
    expect(container.querySelectorAll("[data-ghost-outfit]").length).toBe(0);
  });

  it("유령 view 의 DOM 에도 [data-ghost-outfit] 는 없다(의상은 DOM 이 아니다)", () => {
    const { container } = mount(makeView({ mySeat: 4, dead: [4] }));
    expect(container.querySelectorAll("[data-ghost-outfit]").length).toBe(0);
  });
});
