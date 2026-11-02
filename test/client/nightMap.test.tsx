import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import type { RoleId } from "../../shared/game/roles";
import type { ClientMessage, PhaseId, PublicPlayer, RoomView, SpectatePicks } from "../../shared/protocol";
import type { SceneLook } from "../../src/world/presence";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 08-18: 밤·아침 임시 틀(DAY-07, GHOST-02). RoomScreen 을 거쳐 GameMap 을 그리고 WorldStage 는 진짜를 쓴다 —
// 이름표(data-pick·data-ring-kind)는 WorldStage 가 그리는 DOM 이라서다. 런타임(three)만 가짜로 바꿔 장면 표(setScene)를 읽는다. (08-17 ghostView 와 같은 방식)
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
// 0 마피아 · 1 경찰 · 2 의사 · 3 시민 · 4 마피아 · 5 시민
const JOBS: RoleId[] = ["mafia", "police", "doctor", "citizen", "mafia", "citizen", "citizen", "citizen"];
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
  /** 서버가 이 사람에게 싣는 밤 정보 */
  pick?: number;
  allyPicks?: number[];
  /** 탈락한 본인에게 싣는 밤 선택 */
  picks?: SpectatePicks;
  morning?: { eliminated?: number; phrase?: number };
  noExecution?: "tie" | "noVotes";
}

function makeView(o: ViewOpts = {}): RoomView {
  const count = o.count ?? 6;
  const mySeat = o.mySeat ?? 0;
  const phase = o.phase ?? "night";
  const dead = o.dead ?? [];
  const meDead = dead.includes(mySeat);
  const role = JOBS[mySeat] ?? "citizen";
  const players = Array.from({ length: count }, (_, seat) => player(seat, dead.includes(seat) ? { alive: false } : {}));
  const allies = JOBS.flatMap((j, s) => (j === "mafia" && s !== mySeat && s < count ? [s] : []));
  const chat = meDead ? "ghost" : phase === "night" ? (role === "mafia" ? "mafia" : undefined) : "all";
  const view: RoomView = {
    code: "0042",
    phase,
    phaseEndsAt: NOW + 30_000,
    phaseDurationMs: 30_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: {
      seat: mySeat,
      isHost: mySeat === 0,
      role,
      ...(role === "mafia" ? { allies } : {}),
      ...(chat !== undefined ? { chat } : {}),
      ...(o.pick !== undefined ? { pick: o.pick } : {}),
      ...(o.allyPicks !== undefined ? { allyPicks: o.allyPicks } : {}),
    },
    day: {
      n: 1,
      roles: [],
      ...(o.morning ? { morning: o.morning } : {}),
      ...(o.noExecution ? { noExecution: { reason: o.noExecution } } : {}),
    },
  } as RoomView;
  if (meDead) {
    view.spectate = {
      seats: players.map((p) => ({ seat: p.seat, job: JOBS[p.seat] ?? "citizen" })),
      ...(o.picks ? { picks: o.picks } : {}),
    };
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
const pickSeats = (c: ParentNode): number[] => [...c.querySelectorAll<HTMLElement>("[data-pick]")].map((b) => Number(b.dataset.pick));
const ringOf = (c: ParentNode, seat: number): string | null => c.querySelector(`[data-seat="${seat}"]`)?.getAttribute("data-ring-kind") ?? null;
const ringSeats = (c: ParentNode): number[] => [...c.querySelectorAll<HTMLElement>("[data-ring-kind]")].map((t) => Number(t.dataset.seat));

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

describe("밤 임시 틀 트레이서 — 산 마피아 이름표 하나 (A1, GHOST-02)", () => {
  it("산 마피아 밤: 자신·동료를 뺀 산 좌석만 이름표 버튼이 된다(마피아-마피아 거부 규칙을 화면이 먼저 막는다)", () => {
    const { container } = mount(makeView({ mySeat: 0 }));
    expect(container.querySelector("main.mf-game")?.getAttribute("data-phase")).toBe("night");
    expect(pickSeats(container)).toEqual([1, 2, 3, 5]);
  });

  it("이름표를 누르면 pick 을 보내고, 서버 view(me.pick·allyPicks)가 오면 고른 좌석과 동료가 고른 좌석 발밑 고리가 마피아 종류다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(makeView({ mySeat: 0 }), { send });
    expect(ringSeats(m.container)).toEqual([]);
    fireEvent.click(m.container.querySelector('[data-pick="2"]')!);
    expect(send.mock.calls.filter(([x]) => x.t === "pick")).toEqual([[{ t: "pick", target: 2 }]]);
    m.show(makeView({ mySeat: 0, pick: 2, allyPicks: [3] }));
    expect(ringOf(m.container, 2)).toBe("mafia");
    expect(ringOf(m.container, 3)).toBe("mafia");
    expect(ringSeats(m.container).sort()).toEqual([2, 3]);
    expect(m.container.querySelector('[data-pick="2"]')?.getAttribute("aria-pressed")).toBe("true");
  });

  it("산 시민 밤: 이름표 버튼 0개", () => {
    const { container } = mount(makeView({ mySeat: 3 }));
    expect(pickSeats(container)).toEqual([]);
  });

  it("낮 시작부터 아침까지 단계가 바뀌어도 맵(WorldStage)은 같은 노드이고 다시 열리지 않는다(DAY-07)", () => {
    const m = mount(makeView({ phase: "nomination", mySeat: 3 }));
    const stage = m.container.querySelector("[data-world-stage]");
    expect(stage).not.toBeNull();
    const created = rt.created;
    for (const phase of ["night", "morning", "dayAnnounce"] as const) {
      m.show(makeView({ phase, mySeat: 3 }));
      expect(m.container.querySelector("[data-world-stage]"), phase).toBe(stage);
      expect(m.container.querySelector("main.mf-game"), phase).not.toBeNull();
    }
    expect(rt.created).toBe(created);
  });
});

// ---- Task 2: 밤 역할별 패널·안내·조명·유령 고리·거절 알림 (A1, GHOST-02, UI Considerations E7 #25~#27) ----

const sysLines = (c: ParentNode): string[] => [...c.querySelectorAll("[data-chat-log] > p.mv-chat__sys")].map((p) => (p.textContent ?? "").trim());
const panelTitle = (c: ParentNode): string | null => c.querySelector(".mf-game__panel .mf-nightpanel h2")?.textContent ?? null;
const chatChannel = (c: ParentNode): string | null => c.querySelector("[data-chat-panel]")?.getAttribute("data-chat-channel") ?? null;
const hintText = (c: ParentNode): string | null => c.querySelector(".mf-game__header [data-guide]")?.textContent ?? null;
const titleText = (c: ParentNode): string | null => c.querySelector(".mf-game__header .mv-phase__title")?.textContent ?? null;

describe("밤 임시 틀 — 역할별 하단 패널 (v1.0 문구 그대로)", () => {
  it("산 경찰: 제목 '조사할 사람을 고르세요' + 선택 알약, 채팅 패널 없음, 헤더 제목 '밤'과 30초 링", () => {
    const { container } = mount(makeView({ mySeat: 1 }));
    expect(titleText(container)).toBe("밤");
    expect(container.querySelector('.mf-game__header [role="timer"]')).not.toBeNull();
    expect(panelTitle(container)).toBe("조사할 사람을 고르세요");
    expect(container.querySelector(".mf-game__panel .mf-pk")).not.toBeNull();
    expect(container.querySelector("[data-chat-panel]")).toBeNull();
    // 자신을 포함한 모든 산 좌석이 아니라 v1.0 규칙: 경찰은 자신도 고를 수 있다(서버 pickTarget 은 마피아만 막는다)
    expect(pickSeats(container)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("산 의사: 제목 '지킬 사람을 고르세요', 자기 좌석도 [data-pick], 서버 pick 이 오면 알약에 그 이름", () => {
    const m = mount(makeView({ mySeat: 2 }));
    expect(panelTitle(m.container)).toBe("지킬 사람을 고르세요");
    expect(pickSeats(m.container)).toContain(2);
    m.show(makeView({ mySeat: 2, pick: 2 }));
    expect(m.container.querySelector(".mf-game__panel .mf-pk")?.textContent).toContain("나");
    expect(ringOf(m.container, 2)).toBe("doctor");
  });

  it("산 경찰의 선택: 고른 좌석 한 곳에만 police 고리", () => {
    const m = mount(makeView({ mySeat: 1, pick: 4 }));
    expect(ringSeats(m.container)).toEqual([4]);
    expect(ringOf(m.container, 4)).toBe("police");
    expect(m.container.querySelector(".mf-game__panel .mf-pk")?.textContent).toContain("도윤");
  });

  it("산 시민: 제목 '밤이 되었어요' + 알약 '이번 밤에는 할 수 있는 행동이 없어요', 이름표 버튼·채팅 패널·고리 0개", () => {
    const { container } = mount(makeView({ mySeat: 3 }));
    expect(panelTitle(container)).toBe("밤이 되었어요");
    expect(container.querySelector(".mf-game__panel .mf-pk")?.textContent).toBe("이번 밤에는 할 수 있는 행동이 없어요");
    expect(pickSeats(container)).toEqual([]);
    expect(container.querySelector("[data-chat-panel]")).toBeNull();
    expect(ringSeats(container)).toEqual([]);
  });

  it("산 마피아: 마피아 채널 채팅 패널과 헤더 안내 '없앨 사람을 눌러요', 밤 알약은 없다", () => {
    const { container } = mount(makeView({ mySeat: 0 }));
    expect(chatChannel(container)).toBe("mafia");
    expect(hintText(container)).toBe("없앨 사람을 눌러요");
    expect(container.querySelector(".mf-game__panel .mf-nightpanel")).toBeNull();
  });

  it("마피아 채팅 패널은 서버 view.me.chat 이 mafia 일 때만 그린다(T-08-47): 채널이 없으면 패널도 마피아 문구도 없다", () => {
    const v = makeView({ mySeat: 0 });
    delete v.me.chat;
    const { container } = mount(v);
    expect(container.querySelector("[data-chat-panel]")).toBeNull();
    expect(container.textContent).not.toContain("마피아끼리만 보여요");
    expect(container.textContent).not.toContain("마피아 채팅");
  });

  it("시스템 줄 '밤 · 마피아 채팅' 은 낮에서 밤으로 넘어올 때 한 번, 같은 밤에 다시 그려도 늘지 않는다. 밤 첫 스냅샷(재접속)은 줄이 없다", () => {
    const m = mount(makeView({ phase: "nomination", mySeat: 0 }));
    expect(sysLines(m.container)).not.toContain("밤 · 마피아 채팅");
    m.show(makeView({ mySeat: 0 }));
    expect(sysLines(m.container).filter((t) => t === "밤 · 마피아 채팅")).toHaveLength(1);
    m.show(makeView({ mySeat: 0, pick: 2 }));
    m.show({ ...makeView({ mySeat: 0 }), serverNow: NOW + 900 });
    expect(sysLines(m.container).filter((t) => t === "밤 · 마피아 채팅")).toHaveLength(1);
    cleanup();
    const fresh = mount(makeView({ mySeat: 0 }));
    expect(sysLines(fresh.container)).toEqual([]);
  });

  it("시민·경찰·의사 화면의 어느 밤 단계에도 마피아 채널 문구가 없다(T-07-08 계열)", () => {
    for (const seat of [1, 2, 3]) {
      const m = mount(makeView({ phase: "nomination", mySeat: seat }));
      m.show(makeView({ mySeat: seat }));
      expect(m.container.textContent, `seat ${seat}`).not.toContain("마피아 채팅");
      expect(m.container.textContent, `seat ${seat}`).not.toContain("마피아끼리만 보여요");
      expect(m.container.textContent, `seat ${seat}`).not.toContain("없앨 사람을 눌러요");
      cleanup();
    }
  });
});

describe("밤 임시 틀 — 조명·이동·거절 (UI Considerations E7 #27)", () => {
  it("밤 조명이고 산 사람은 맵을 탭해도 move 가 나가지 않는다, 유령은 나간다(A4)", () => {
    const tap = (c: HTMLElement) => {
      const surface = c.querySelector(".mf-world__input")!;
      fireEvent.pointerDown(surface, { pointerId: 1, clientX: 100, clientY: 300, pointerType: "touch" });
      fireEvent.pointerUp(surface, { pointerId: 1, clientX: 100, clientY: 300, pointerType: "touch" });
    };
    const sendL = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const l = mount(makeView({ mySeat: 3 }), { send: sendL });
    expect(lastScene().lighting).toBe("night");
    tap(l.container);
    expect(sendL.mock.calls.filter(([m]) => m.t === "move")).toHaveLength(0);
    cleanup();
    const sendG = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const g = mount(makeView({ mySeat: 3, dead: [3] }), { send: sendG });
    tap(g.container);
    expect(sendG.mock.calls.filter(([m]) => m.t === "move")).toHaveLength(1);
  });

  it("선택이 거절되면 위 알림 '보내지 못했어요. 다시 해 보세요' 뒤 내 눌림이 서버 값으로 돌아간다", () => {
    const handlers: Array<(e: never, meta: { epoch: number }) => void> = [];
    const onEvent = vi.fn((cb: unknown) => {
      handlers.push(cb as (typeof handlers)[number]);
      return () => {};
    });
    const m = mount(makeView({ mySeat: 1, pick: 4 }), { onEvent: onEvent as unknown as RoomConnection["onEvent"] });
    expect(m.container.querySelector('[data-pick="4"]')?.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(m.container.querySelector('[data-pick="3"]')!);
    expect(m.container.querySelector('[data-pick="3"]')?.getAttribute("aria-pressed")).toBe("true");
    act(() => handlers.forEach((h) => h({ t: "error", code: "BAD_MESSAGE" } as never, { epoch: 1 })));
    expect(m.container.querySelector(".mv-toast__text")?.textContent).toBe("보내지 못했어요. 다시 해 보세요");
    expect(m.container.querySelector('[data-pick="3"]')?.getAttribute("aria-pressed")).toBe("false");
    expect(m.container.querySelector('[data-pick="4"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(ringOf(m.container, 4)).toBe("police");
    expect(ringOf(m.container, 3)).toBeNull();
  });
});

describe("밤 임시 틀 — 유령이 보는 밤 행동 (GHOST-02, T-08-46)", () => {
  const PICKS: SpectatePicks = { mafia: [2], police: [3], doctor: [2] };
  const ghostNight = () => makeView({ mySeat: 5, dead: [5], picks: PICKS });

  it("서버가 유령에게만 보낸 spectate.picks 만큼 대상 발밑에 고리: 한 좌석에 여럿이면 마피아 우선 하나", () => {
    const { container } = mount(ghostNight());
    expect(ringOf(container, 2)).toBe("mafia");
    expect(ringOf(container, 3)).toBe("police");
    expect(ringSeats(container).sort()).toEqual([2, 3]);
  });

  it("유령 화면: 유령 채널 채팅 패널, 헤더 안내 '모두의 직업과 밤 행동이 보여요', 이름표 버튼 0개, 직업 칩", () => {
    const { container } = mount(ghostNight());
    expect(chatChannel(container)).toBe("ghost");
    expect(hintText(container)).toBe("모두의 직업과 밤 행동이 보여요");
    expect(pickSeats(container)).toEqual([]);
    expect(container.querySelectorAll("[data-role-chip]").length).toBeGreaterThan(0);
    expect(container.querySelector(".mf-game__panel .mf-nightpanel")).toBeNull();
  });

  it("picks 가 비어 있으면(밤 선택 없음) 고리 0개", () => {
    const { container } = mount(makeView({ mySeat: 5, dead: [5], picks: { mafia: [], police: [], doctor: [] } }));
    expect(ringSeats(container)).toEqual([]);
  });

  it("산 사람 화면에는 남의 선택 고리가 없다: 산 시민 view 에 spectate.picks 가 잘못 섞여 와도 고리 0개(내가 산 사람이므로)", () => {
    const stray: RoomView = { ...makeView({ mySeat: 3 }), spectate: { seats: [], picks: PICKS } };
    expect(ringSeats(mount(stray).container)).toEqual([]);
    cleanup();
    const strayPolice: RoomView = { ...makeView({ mySeat: 1, pick: 4 }), spectate: { seats: [], picks: PICKS } };
    expect(ringSeats(mount(strayPolice).container)).toEqual([4]);
  });

  it("산 경찰·의사·시민 화면의 고리는 서버가 보낸 내 선택뿐이고 allyPicks 가 와도 마피아 고리가 아니다", () => {
    const police: RoomView = { ...makeView({ mySeat: 1, pick: 4 }) };
    police.me = { ...police.me, allyPicks: [2] };
    const { container } = mount(police);
    expect(ringSeats(container)).toEqual([4]);
    expect(container.querySelectorAll('[data-ring-kind="mafia"]')).toHaveLength(0);
  });

  it("낮 단계(지목)에는 고리가 없다 — 밤 고리 재료가 단계를 넘지 않는다", () => {
    const v = makeView({ phase: "nomination", mySeat: 5, dead: [5], picks: PICKS });
    expect(ringSeats(mount(v).container)).toEqual([]);
  });
});

// 이후 Task 3 의 describe 가 이 아래에 이어진다.
void act;
