import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import { approachPoint } from "../../shared/game/world";
import type { RoleId } from "../../shared/game/roles";
import { setEngineForTest } from "../../src/audio/unlock";
import { faceSrc } from "../../src/net/assets";
import { makeRig } from "../helpers/soundRig";
import type { ClientMessage, InvestigationRecord, PhaseId, PublicPlayer, RoomView, SpectatePicks } from "../../shared/protocol";
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
        stopAllEmotes: () => {},
        deny: () => {},
        surprise: () => {},
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
  /** 서버가 산 마피아에게 싣는 선택 수 집계와 전원 일치 확정 좌석(결정 0061-7) */
  nightTally?: Array<{ seat: number; n: number }>;
  nightSure?: number;
  /** 탈락한 본인에게 싣는 밤 선택 */
  picks?: SpectatePicks;
  morning?: { eliminated?: number; saved?: true };
  /** 경찰 본인에게 싣는 조사 기록 */
  records?: InvestigationRecord[];
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
      ...(o.nightTally !== undefined ? { nightTally: o.nightTally } : {}),
      ...(o.nightSure !== undefined ? { nightSure: o.nightSure } : {}),
      ...(o.records !== undefined ? { records: o.records } : {}),
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

/** 이 연결의 world 프레임 구독자에게 snap 한 번을 먹인다(RoomScreen 이 WorldStore 로 넘긴다). 좌표는 고정소수점 정수이고 구간은 제자리(v 0)다 */
function feedSnap(handlers: Array<(e: never, meta: { epoch: number }) => void>, pos: Record<number, [number, number]>): void {
  const ents = Object.entries(pos).map(([s, p]) => ({ s: Number(s), p: [...p], t0: NOW - 1000, v: 0 }));
  act(() => handlers.forEach((h) => h({ t: "world", k: "snap", at: NOW, ents } as never, { epoch: 1 })));
}
function withHandlers(): { handlers: Array<(e: never, meta: { epoch: number }) => void>; onEvent: RoomConnection["onEvent"] } {
  const handlers: Array<(e: never, meta: { epoch: number }) => void> = [];
  const onEvent = vi.fn((cb: unknown) => {
    handlers.push(cb as (typeof handlers)[number]);
    return () => {};
  });
  return { handlers, onEvent: onEvent as unknown as RoomConnection["onEvent"] };
}
const moves = (send: ReturnType<typeof vi.fn<(m: ClientMessage) => boolean>>): ClientMessage[] => send.mock.calls.map(([x]) => x).filter((x) => x.t === "move");
const nightSends = (send: ReturnType<typeof vi.fn<(m: ClientMessage) => boolean>>): ClientMessage[] => send.mock.calls.map(([x]) => x).filter((x) => x.t === "pick" || x.t === "move");
const tapFloor = (c: HTMLElement): void => {
  const surface = c.querySelector(".mf-world__input")!;
  fireEvent.pointerDown(surface, { pointerId: 1, clientX: 100, clientY: 300, pointerType: "touch" });
  fireEvent.pointerUp(surface, { pointerId: 1, clientX: 100, clientY: 300, pointerType: "touch" });
};

describe("밤 마피아 — 다가가기(결정 0061-2·6, NIGHT-07·08, E2 #9)", () => {
  it("산 마피아 밤: 자신·동료를 뺀 산 좌석만 이름표 버튼이 되고 접근성 이름은 '{닉네임} 님에게 다가가기', 묶음은 '밤 대상'이다", () => {
    const { container } = mount(makeView({ mySeat: 0 }));
    expect(container.querySelector("main.mf-game")?.getAttribute("data-phase")).toBe("night");
    expect(pickSeats(container)).toEqual([1, 2, 3, 5]);
    expect(container.querySelector('[data-pick="2"]')?.getAttribute("aria-label")).toBe("서준 님에게 다가가기");
    expect(container.querySelector('[role="group"][aria-label="밤 대상"]')).not.toBeNull();
  });

  it("이름표를 누르면 pick 뒤에 그 사람 옆(approachPoint) 목적지로 move 를 보낸다. 같은 사람을 다시 누르면 아무것도 보내지 않고, 다른 사람은 다시 pick + move", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { handlers, onEvent } = withHandlers();
    const m = mount(makeView({ mySeat: 0 }), { send, onEvent });
    feedSnap(handlers, { 0: [100, 100], 2: [500, 100], 3: [100, 700] });
    fireEvent.click(m.container.querySelector('[data-pick="2"]')!);
    expect(nightSends(send)).toEqual([{ t: "pick", target: 2 }, { t: "move", ...approachPoint({ x: 500, z: 100 }, { x: 100, z: 100 }, 80) }]);
    expect(m.container.querySelector('[data-pick="2"]')?.getAttribute("aria-pressed")).toBe("true");
    send.mockClear();
    fireEvent.click(m.container.querySelector('[data-pick="2"]')!);
    expect(nightSends(send)).toEqual([]);
    fireEvent.click(m.container.querySelector('[data-pick="3"]')!);
    expect(nightSends(send)).toEqual([{ t: "pick", target: 3 }, { t: "move", ...approachPoint({ x: 100, z: 700 }, { x: 100, z: 100 }, 80) }]);
    expect(m.container.querySelector('[data-pick="3"]')?.getAttribute("aria-pressed")).toBe("true");
  });

  it("대상 위치를 store 가 모르면 pick 만 나간다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(makeView({ mySeat: 0 }), { send });
    fireEvent.click(m.container.querySelector('[data-pick="2"]')!);
    expect(nightSends(send)).toEqual([{ t: "pick", target: 2 }]);
  });

  it("서버 view(me.pick·allyPicks)가 오면 내가 고른 좌석은 mafia 고리, 동료만 고른 좌석은 mafia-ally 고리다. 아무도 안 골랐으면 고리가 없다", () => {
    const m = mount(makeView({ mySeat: 0 }));
    expect(ringSeats(m.container)).toEqual([]);
    m.show(makeView({ mySeat: 0, pick: 2, allyPicks: [3] }));
    expect(ringOf(m.container, 2)).toBe("mafia");
    expect(ringOf(m.container, 3)).toBe("mafia-ally");
    expect(ringSeats(m.container).sort()).toEqual([2, 3]);
    expect(m.container.querySelector('[data-pick="2"]')?.getAttribute("aria-pressed")).toBe("true");
    // 같은 좌석을 나도 동료도 골랐으면 내 고리(mafia)가 이긴다
    m.show(makeView({ mySeat: 0, pick: 2, allyPicks: [2] }));
    expect(ringOf(m.container, 2)).toBe("mafia");
  });

  it("산 마피아는 밤에 바닥을 눌러 걷는다(NIGHT-07), 산 시민·경찰·의사는 걷지 못한다", () => {
    const sendM = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const a = mount(makeView({ mySeat: 0 }), { send: sendM });
    tapFloor(a.container);
    expect(moves(sendM)).toHaveLength(1);
    cleanup();
    for (const seat of [1, 2, 3]) {
      const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
      const b = mount(makeView({ mySeat: seat }), { send });
      tapFloor(b.container);
      expect(moves(send), `seat ${seat}`).toHaveLength(0);
      cleanup();
    }
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

const aimOf = (c: ParentNode, seat: number): string | null => c.querySelector(`[data-seat="${seat}"]`)?.getAttribute("data-night-pick") ?? null;
const aimSeats = (c: ParentNode): number[] => [...c.querySelectorAll<HTMLElement>("[data-night-pick]")].map((t) => Number(t.dataset.seat));

describe("마피아 밤 선택 효과 (09.1-q2, 결정 0065)", () => {
  it("산 마피아: 후보(나·동료 제외) 이름표만 cand, 고르면 그 좌석만 mine(클래스 is-picked·표식), 나·동료는 속성이 없다", () => {
    const m = mount(makeView({ mySeat: 0 }));
    // 0 나, 4 동료 → 후보는 1·2·3·5
    expect(aimSeats(m.container)).toEqual([1, 2, 3, 5]);
    expect([1, 2, 3, 5].every((s) => aimOf(m.container, s) === "cand")).toBe(true);
    expect(m.container.querySelector('[data-pick="2"]')?.classList.contains("is-cand")).toBe(true);
    fireEvent.click(m.container.querySelector('[data-pick="2"]')!);
    expect(aimOf(m.container, 2)).toBe("mine");
    expect(aimOf(m.container, 3)).toBe("cand");
    const b = m.container.querySelector('[data-pick="2"]')!;
    expect(b.classList.contains("is-picked")).toBe(true);
    expect(b.querySelector("[data-night-mark]")).not.toBeNull();
    expect(m.container.querySelectorAll("[data-night-mark]")).toHaveLength(1);
  });

  it("서버 view(me.pick)가 오면 그 좌석이 mine. 동료만 고른 좌석(allyPicks)은 cand 그대로 — 동료 선택에는 테두리 효과가 없다", () => {
    const m = mount(makeView({ mySeat: 0 }));
    m.show(makeView({ mySeat: 0, pick: 2, allyPicks: [3] }));
    expect(aimOf(m.container, 2)).toBe("mine");
    expect(aimOf(m.container, 3)).toBe("cand");
    expect(m.container.querySelectorAll("[data-night-mark]")).toHaveLength(1);
  });

  it("누르는 동안 preview, 떼면 cand", () => {
    const m = mount(makeView({ mySeat: 0 }));
    const b = m.container.querySelector('[data-pick="3"]')!;
    fireEvent.pointerDown(b, { pointerId: 2, pointerType: "touch" });
    expect(aimOf(m.container, 3)).toBe("preview");
    expect(b.classList.contains("is-preview")).toBe(true);
    fireEvent.pointerUp(b, { pointerId: 2, pointerType: "touch" });
    expect(aimOf(m.container, 3)).toBe("cand");
  });

  it("누설 규칙: 산 시민·경찰·의사·유령 화면에는 data-night-pick·표식·is-cand 가 0개다(서버 me.pick 이 섞여 와도)", () => {
    for (const seat of [3, 1, 2]) {
      const m = mount(makeView({ mySeat: seat, pick: 5 }));
      expect(aimSeats(m.container), `seat ${seat}`).toEqual([]);
      expect(m.container.querySelectorAll("[data-night-mark], .is-cand, .is-picked, .is-preview"), `seat ${seat}`).toHaveLength(0);
      cleanup();
    }
    const g = mount(makeView({ mySeat: 5, dead: [5], picks: { mafia: [2], police: [], doctor: [] } }));
    expect(aimSeats(g.container)).toEqual([]);
    expect(g.container.querySelectorAll("[data-night-mark], .is-cand, .is-picked, .is-preview")).toHaveLength(0);
    cleanup();
    // 탈락한 마피아도 없다
    const dead = mount(makeView({ mySeat: 0, dead: [0] }));
    expect(aimSeats(dead.container)).toEqual([]);
  });

  it("낮 지목 단계의 이름표 버튼은 그대로다: 밤 효과 속성·클래스·표식이 없다", () => {
    const m = mount(makeView({ phase: "nomination", mySeat: 0 }));
    expect(aimSeats(m.container)).toEqual([]);
    expect(m.container.querySelectorAll("[data-night-mark], .is-cand, .is-picked, .is-preview")).toHaveLength(0);
    for (const b of m.container.querySelectorAll("button.mf-world__pick")) expect(b.className).toBe("mf-world__pick");
  });
});

const headOf = (c: ParentNode, seat: number): Element | null => c.querySelector(`[data-seat="${seat}"] .mv-head`);
const countOf = (c: ParentNode, seat: number): string | null => headOf(c, seat)?.getAttribute("data-count") ?? null;
const sureOf = (c: ParentNode, seat: number): string | null => headOf(c, seat)?.getAttribute("data-sure") ?? null;

describe("밤 마피아 — 선택 수 배지·'확정' 도장 (서버 집계, 결정 0061-7, E2 #10~#12)", () => {
  it("서로 다른 대상을 고르면 각 좌석에 배지 1, 도장 없음", () => {
    const { container } = mount(makeView({ mySeat: 0, pick: 2, allyPicks: [5], nightTally: [{ seat: 2, n: 1 }, { seat: 5, n: 1 }] }));
    expect(countOf(container, 2)).toBe("1");
    expect(countOf(container, 5)).toBe("1");
    expect(sureOf(container, 2)).toBeNull();
    expect(container.querySelectorAll(".mv-stamp")).toHaveLength(0);
    expect(container.querySelectorAll(".mv-badge")).toHaveLength(2);
  });

  it("전원 일치(nightSure)면 그 좌석은 배지 대신 '확정' 도장이다. 일치가 깨지면 도장이 사라지고 배지로 돌아간다", () => {
    const m = mount(makeView({ mySeat: 0, pick: 2, allyPicks: [2], nightTally: [{ seat: 2, n: 2 }], nightSure: 2 }));
    expect(sureOf(m.container, 2)).toBe("true");
    expect(countOf(m.container, 2)).toBeNull();
    expect(headOf(m.container, 2)?.querySelector(".mv-stamp")?.textContent).toBe("확정");
    expect(headOf(m.container, 2)?.querySelector(".mv-badge")).toBeNull();
    m.show(makeView({ mySeat: 0, pick: 2, allyPicks: [3], nightTally: [{ seat: 2, n: 1 }, { seat: 3, n: 1 }] }));
    expect(m.container.querySelectorAll(".mv-stamp")).toHaveLength(0);
    expect(countOf(m.container, 2)).toBe("1");
    expect(countOf(m.container, 3)).toBe("1");
  });

  it("마피아 1명 방: 고르는 즉시 도장이다(서버 집계가 확정으로 보낸다)", () => {
    const { container } = mount(makeView({ mySeat: 0, pick: 2, nightTally: [{ seat: 2, n: 1 }], nightSure: 2 }));
    expect(sureOf(container, 2)).toBe("true");
    expect(headOf(container, 2)?.querySelector(".mv-stamp")?.textContent).toBe("확정");
  });

  it("아무도 안 골랐으면(nightTally 빈 배열) 배지·도장·고리가 없다", () => {
    const { container } = mount(makeView({ mySeat: 0, nightTally: [] }));
    expect(container.querySelectorAll(".mv-badge, .mv-stamp")).toHaveLength(0);
    expect(ringSeats(container)).toEqual([]);
  });

  it("마피아가 아닌 view(시민·경찰·의사·유령)에 nightTally·nightSure 가 섞여 와도 배지·도장이 0개다 — 마피아 분기에서만 읽는다", () => {
    for (const [seat, dead] of [[3, []], [1, []], [2, []], [5, [5]]] as const) {
      const base = makeView({ mySeat: seat, dead: [...dead], ...(dead.length ? { picks: { mafia: [2], police: [], doctor: [] } } : {}) });
      const v: RoomView = { ...base, me: { ...base.me, nightTally: [{ seat, n: 2 }, { seat: 2, n: 2 }], nightSure: seat } };
      const { container } = mount(v);
      expect(container.querySelectorAll(".mv-badge, .mv-stamp"), `seat ${seat}`).toHaveLength(0);
      cleanup();
    }
  });

  it("배지·도장 요소에 진홍 클래스가 없다(진홍은 고리·동료 칩·채널 이름에만, UI-SPEC 230행)", () => {
    const { container } = mount(makeView({ mySeat: 0, pick: 2, allyPicks: [3], nightTally: [{ seat: 2, n: 1 }, { seat: 3, n: 1 }] }));
    for (const el of container.querySelectorAll(".mv-head, .mv-head *")) expect(el.className.toString(), el.outerHTML.slice(0, 80)).not.toMatch(/crimson/);
  });
});

// ---- Task 2: 밤 역할별 패널·안내·조명·유령 고리·거절 알림 (A1, GHOST-02, UI Considerations E7 #25~#27) ----

const sysLines = (c: ParentNode): string[] => [...c.querySelectorAll("[data-chat-log] > p.mv-chat__sys")].map((p) => (p.textContent ?? "").trim());
const chatChannel = (c: ParentNode): string | null => c.querySelector("[data-chat-panel]")?.getAttribute("data-chat-channel") ?? null;
// 14-02(U-2): 헤더 안내 줄은 없다 — 밤 할 일 줄은 자막 띠가 말한다. 역할별 줄과 다른 역할 줄 부재(HOST-05)는 guide.test.tsx 가 이어받는다.
const hintText = (c: ParentNode): string | null => c.querySelector(".mf-game__header .mv-phase__hint")?.textContent ?? null;
const titleText = (c: ParentNode): string | null => c.querySelector(".mf-game__header .mv-phase__title")?.textContent ?? null;

const faceSeats = (c: ParentNode): number[] => [...c.querySelectorAll<HTMLElement>("[data-face]")].map((b) => Number(b.dataset.face));
const faceOf = (c: ParentNode, seat: number): HTMLElement | null => c.querySelector<HTMLElement>(`[data-face="${seat}"]`);
const pressed = (c: ParentNode, seat: number): string | null => faceOf(c, seat)?.getAttribute("aria-pressed") ?? null;
const pickMsgs = (send: ReturnType<typeof vi.fn<(m: ClientMessage) => boolean>>): ClientMessage[] => send.mock.calls.map(([x]) => x).filter((x) => x.t === "pick");

describe("밤 경찰·의사 — 얼굴 목록(NIGHT-09, E1 #1·#3·#6·#7)", () => {
  it("산 경찰: 묶음 '조사할 사람', 자기 칸 없는 산 사람 5칸, 칸 이름 '{닉네임} 조사', 그림은 faceSrc(seat), 이름표 버튼·밤 알약·채팅 패널은 없다", () => {
    const { container } = mount(makeView({ mySeat: 1 }));
    expect(container.querySelector("[data-face-list]")?.getAttribute("aria-label")).toBe("조사할 사람");
    expect(faceSeats(container)).toEqual([0, 2, 3, 4, 5]);
    expect(faceOf(container, 2)?.getAttribute("aria-label")).toBe("서준 조사");
    expect(faceOf(container, 2)?.querySelector("img")?.getAttribute("src")).toBe(faceSrc(2));
    expect(pickSeats(container)).toEqual([]);
    expect(container.querySelector(".mf-game__panel .mf-nightpanel, .mf-game__panel .mf-pk")).toBeNull();
    expect(container.querySelector("[data-chat-panel]")).toBeNull();
    expect(titleText(container)).toBe("밤");
    expect(container.querySelector('.mf-game__header [role="timer"]')).toBeNull(); // 14-02: 시간은 띠의 막대 + 초가 맡는다
  });

  it("산 의사: 묶음 '지킬 사람', 자기 포함 6칸, 칸 이름 '{닉네임} 보호', 서버 pick 이 오면 그 칸이 눌린다", () => {
    const m = mount(makeView({ mySeat: 2 }));
    expect(m.container.querySelector("[data-face-list]")?.getAttribute("aria-label")).toBe("지킬 사람");
    expect(faceSeats(m.container)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(faceOf(m.container, 2)?.getAttribute("aria-label")).toBe("서준 보호");
    expect(pickSeats(m.container)).toEqual([]);
    m.show(makeView({ mySeat: 2, pick: 2 }));
    expect(pressed(m.container, 2)).toBe("true");
    expect(pressed(m.container, 3)).toBe("false");
  });

  it("탈락한 좌석은 산 경찰의 얼굴 목록에 없다", () => {
    const { container } = mount(makeView({ mySeat: 1, dead: [4] }));
    expect(faceSeats(container)).toEqual([0, 2, 3, 5]);
  });

  it("얼굴을 누르면 pick 한 번과 즉시 눌림, 같은 칸 재클릭은 보내지 않고, 서버 view(me.pick)가 오면 서버 값이 이긴다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const m = mount(makeView({ mySeat: 1 }), { send });
    fireEvent.click(faceOf(m.container, 2)!);
    expect(pickMsgs(send)).toEqual([{ t: "pick", target: 2 }]);
    expect(pressed(m.container, 2)).toBe("true");
    fireEvent.click(faceOf(m.container, 2)!);
    expect(pickMsgs(send)).toHaveLength(1);
    m.show(makeView({ mySeat: 1, pick: 3 }));
    expect(pressed(m.container, 3)).toBe("true");
    expect(pressed(m.container, 2)).toBe("false");
    // 경찰은 지도에 내 고리를 그리지 않는다(UI-SPEC: 고리는 마피아·유령 화면만)
    expect(ringSeats(m.container)).toEqual([]);
  });

  it("소켓이 닫혀 못 보냈으면(send false) 눌림도 바뀌지 않는다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => false);
    const m = mount(makeView({ mySeat: 1 }), { send });
    fireEvent.click(faceOf(m.container, 2)!);
    expect(pressed(m.container, 2)).toBe("false");
  });

  it("선택이 거절되면 위 알림 '보내지 못했어요. 다시 해 보세요' 뒤 눌림이 서버 값으로 돌아간다", () => {
    const { handlers, onEvent } = withHandlers();
    const m = mount(makeView({ mySeat: 1, pick: 4 }), { onEvent });
    expect(pressed(m.container, 4)).toBe("true");
    fireEvent.click(faceOf(m.container, 3)!);
    expect(pressed(m.container, 3)).toBe("true");
    act(() => handlers.forEach((h) => h({ t: "error", code: "BAD_MESSAGE" } as never, { epoch: 1 })));
    expect(m.container.querySelector(".mv-toast__text")?.textContent).toBe("보내지 못했어요. 다시 해 보세요");
    expect(pressed(m.container, 3)).toBe("false");
    expect(pressed(m.container, 4)).toBe("true");
  });

  it("연결이 끊긴 동안(canSend 거짓) 모든 칸이 aria-disabled 이고 눌러도 보내지 않는다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container } = mount(makeView({ mySeat: 1 }), { send, canSend: false });
    const faces = [...container.querySelectorAll<HTMLElement>("[data-face]")];
    expect(faces).toHaveLength(5);
    expect(faces.every((b) => b.getAttribute("aria-disabled") === "true")).toBe(true);
    fireEvent.click(faceOf(container, 2)!);
    expect(pickMsgs(send)).toEqual([]);
  });

  it("후보가 0명(경찰 혼자 산 가짜 view)이면 얼굴 목록도 경고 글도 없다", () => {
    const { container } = mount(makeView({ mySeat: 1, dead: [0, 2, 3, 4, 5] }));
    expect(container.querySelector("[data-face-list]")).toBeNull();
    // 얼굴 목록 대신 아래 행동 줄 [유언] 하나만 남는다(09-17, 경고 글 없음)
    expect(container.querySelector(".mf-game__panel")?.textContent ?? "").toBe("유언");
  });

  it("아무것도 안 골랐으면 눌린 칸이 없고 경고 글이 없다", () => {
    const { container } = mount(makeView({ mySeat: 2 }));
    expect([...container.querySelectorAll("[data-face]")].every((b) => b.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(container.querySelector(".mf-game__panel")?.textContent).not.toMatch(/고르지|선택 안|경고/);
  });

  it("산 시민 밤: 아래 패널은 [유언] 행동 줄뿐이고(밤 알약 없음) 얼굴 목록·이름표 버튼·채팅 패널·고리가 0개다", () => {
    const { container } = mount(makeView({ mySeat: 3 }));
    expect(container.querySelector(".mf-game__panel .mf-nightpanel, .mf-game__panel .mf-pk")).toBeNull();
    expect(container.querySelector("[data-face-list]")).toBeNull();
    expect(pickSeats(container)).toEqual([]);
    expect(container.querySelector("[data-chat-panel]")).toBeNull();
    expect(ringSeats(container)).toEqual([]);
  });

  it("산 마피아·유령 화면에는 얼굴 목록이 없다", () => {
    expect(mount(makeView({ mySeat: 0 })).container.querySelector("[data-face-list]")).toBeNull();
    cleanup();
    expect(mount(makeView({ mySeat: 5, dead: [5], picks: { mafia: [], police: [], doctor: [] } })).container.querySelector("[data-face-list]")).toBeNull();
  });
});

describe("밤 마피아·유령 하단 패널 — 채팅 (T-08-47)", () => {
  it("산 마피아: 마피아 채널 채팅 패널과 헤더 안내 줄 없음(띠 몫), 밤 알약은 없다", () => {
    const { container } = mount(makeView({ mySeat: 0 }));
    expect(chatChannel(container)).toBe("mafia");
    expect(hintText(container)).toBeNull();
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
      expect(m.container.textContent, `seat ${seat}`).not.toContain("다가가요");
      cleanup();
    }
    // 유령(마피아였어도)은 모두의 직업과 밤 행동 안내 그대로, 마피아 안내 문자열이 DOM 에 없다
    const ghost = mount(makeView({ mySeat: 5, dead: [5], picks: { mafia: [2], police: [], doctor: [] } }));
    expect(ghost.container.textContent).not.toContain("다가가요");
    expect(ghost.container.textContent).not.toContain("확정");
  });

  it("마피아 확정이 새로 서면 마피아 채팅에 hot 줄 '{이름} · 확정' 이 한 번 남고, 같은 확정을 다시 받아도 늘지 않는다. 첫 스냅샷에서는 줄이 없다", () => {
    const hotLines = (c: ParentNode): string[] => [...c.querySelectorAll("[data-chat-log] > p.is-hot")].map((p) => (p.textContent ?? "").trim());
    const m = mount(makeView({ mySeat: 0, pick: 2, nightTally: [{ seat: 2, n: 1 }] }));
    expect(hotLines(m.container)).toEqual([]);
    m.show(makeView({ mySeat: 0, pick: 2, allyPicks: [2], nightTally: [{ seat: 2, n: 2 }], nightSure: 2 }));
    expect(hotLines(m.container)).toEqual(["서준 · 확정"]);
    m.show({ ...makeView({ mySeat: 0, pick: 2, allyPicks: [2], nightTally: [{ seat: 2, n: 2 }], nightSure: 2 }), serverNow: NOW + 900 });
    expect(hotLines(m.container)).toEqual(["서준 · 확정"]);
    cleanup();
    const fresh = mount(makeView({ mySeat: 0, pick: 2, allyPicks: [2], nightTally: [{ seat: 2, n: 2 }], nightSure: 2 }));
    expect(hotLines(fresh.container)).toEqual([]);
    expect(sureOf(fresh.container, 2)).toBe("true");
  });
});

describe("밤 조명·이동 (UI Considerations E7 #27)", () => {
  it("밤 조명이고 산 사람은 맵을 탭해도 move 가 나가지 않는다, 유령은 나간다(A4)", () => {
    const tap = (c: HTMLElement) => {
      const surface = c.querySelector(".mf-world__input")!;
      fireEvent.pointerDown(surface, { pointerId: 1, clientX: 100, clientY: 300, pointerType: "touch" });
      fireEvent.pointerUp(surface, { pointerId: 1, clientX: 100, clientY: 300, pointerType: "touch" });
    };
    const sendL = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const l = mount(makeView({ mySeat: 3 }), { send: sendL });
    expect(lastScene().lighting).toBe("nightCitizen"); // 09-10: 밤·산 시민 편은 거의 깜깜한 조명
    tap(l.container);
    expect(sendL.mock.calls.filter(([m]) => m.t === "move")).toHaveLength(0);
    cleanup();
    const sendG = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const g = mount(makeView({ mySeat: 3, dead: [3] }), { send: sendG });
    tap(g.container);
    expect(sendG.mock.calls.filter(([m]) => m.t === "move")).toHaveLength(1);
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

  it("유령 화면: 유령 채널 채팅 패널, 헤더 안내 줄 없음(띠 몫), 이름표 버튼 0개, 직업 칩", () => {
    const { container } = mount(ghostNight());
    expect(chatChannel(container)).toBe("ghost");
    expect(hintText(container)).toBeNull();
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
    expect(ringSeats(mount(strayPolice).container)).toEqual([]); // 경찰의 선택은 지도 고리가 아니라 얼굴 목록이 보인다(09-15)
  });

  it("산 경찰·의사·시민 화면의 고리는 서버가 보낸 내 선택뿐이고 allyPicks 가 와도 마피아 고리가 아니다", () => {
    const police: RoomView = { ...makeView({ mySeat: 1, pick: 4 }) };
    police.me = { ...police.me, allyPicks: [2] };
    const { container } = mount(police);
    // 밤 시민 편은 지도에 내 이름표뿐이고 경찰의 선택 표시는 얼굴 목록(09-15)이 맡는다. 마피아 고리는 없다.
    expect(ringSeats(container)).toEqual([]);
    expect(container.querySelectorAll('[data-ring-kind="mafia"]')).toHaveLength(0);
  });

  it("낮 단계(지목)에는 고리가 없다 — 밤 고리 재료가 단계를 넘지 않는다", () => {
    const v = makeView({ phase: "nomination", mySeat: 5, dead: [5], picks: PICKS });
    expect(ringSeats(mount(v).container)).toEqual([]);
  });
});

// ---- Task 3: 아침 임시 틀 · 밤 탈락자 사라짐 · 처형 없음 밤 알림 (DAY-07, UI-SPEC 아침) ----

const announceText = (c: ParentNode): string => c.querySelector("[data-announce]")?.textContent ?? "";
const rosterSeats = (c: ParentNode): number[] => [...c.querySelectorAll<HTMLElement>(".mf-world__tag")].map((t) => Number(t.dataset.seat));
const GHOST_LINE = "유령 채팅 · 산 사람에게 안 보여요";

describe("아침 알림 (MORN-03, UI-SPEC 아침)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  const night = (mySeat = 3, dead: number[] = []) => makeView({ phase: "night", mySeat, dead });
  const morning = (mySeat: number, eliminated?: number, dead: number[] = [], saved = false) =>
    makeView({
      phase: "morning",
      mySeat,
      dead,
      morning: eliminated !== undefined ? { eliminated } : saved ? { saved: true } : {},
    });

  it("밤 → 아침(탈락 있음): 0.4초에 36px 알림 '{닉네임} 님이 당했습니다'(target 아이콘 56), 채팅 패널 all, 아침 조명, 탈락자 캐릭터·이름표가 산 사람 화면에서 사라진다(떠오름 없음)", () => {
    const m = mount(night());
    expect(announceText(m.container)).toBe("");
    expect(rosterSeats(m.container)).toEqual([3]); // 09-10: 밤 시민 편 이름표 층에는 내 이름표 하나뿐이다
    m.show(morning(3, 2, [2]));
    expect(announceText(m.container)).toBe(""); // 막이 걷히는 0.4초 전
    advance(399);
    expect(announceText(m.container)).toBe("");
    advance(1);
    expect(announceText(m.container)).toBe("서준 님이 당했습니다");
    expect(m.container.querySelector('[data-announce]')?.getAttribute("role")).toBe("status");
    const icon = m.container.querySelector<SVGElement>("[data-announce] svg");
    expect(icon?.getAttribute("width")).toBe("56");
    expect(icon?.classList.contains("is-death")).toBe(true);
    expect(lastScene().lighting).toBe("morning");
    expect(rosterSeats(m.container)).toEqual([0, 1, 3, 4, 5]);
    expect(lastScene().seats[2]).toBeUndefined();
    expect(Object.values(lastScene().seats).some((look) => look.fadeAt !== undefined)).toBe(false);
    expect(chatChannel(m.container)).toBe("all");
    expect(titleText(m.container)).toBe("아침");
    // 같은 시각 채팅에 같은 문장의 hot 줄(범위 all)
    expect([...m.container.querySelectorAll("[data-chat-log] > p.is-hot")].map((p) => (p.textContent ?? "").trim())).toEqual(["서준 님이 당했습니다"]);
  });

  it("무사한 아침: 0.4초에 아이콘 없는 '아무 일도 없었습니다', 전원이 그대로 서 있다", () => {
    const m = mount(night());
    m.show(morning(3));
    advance(400);
    expect(announceText(m.container)).toBe("아무 일도 없었습니다");
    expect(m.container.querySelector("[data-announce] svg")).toBeNull();
    expect(rosterSeats(m.container)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("의사가 살린 아침: '누군가 살아났습니다'(heal 아이콘, 진홍 아님)가 0.4~2.8초에 뜨고 사라진다. 구출된 사람 화면과 다른 시민 화면이 같다 (T-09-41)", () => {
    const seenBy = (seat: number): string[] => {
      const m = mount(night(seat));
      m.show(morning(seat, undefined, [], true));
      advance(400);
      const out = [announceText(m.container), m.container.querySelector("[data-announce] svg")?.getAttribute("class") ?? ""];
      advance(2_399);
      out.push(announceText(m.container));
      advance(1);
      out.push(announceText(m.container) === "" ? "gone" : "still");
      cleanup();
      return out;
    };
    const saved = seenBy(2); // 의사가 지킨 좌석 자리의 시민 편 화면이라고 가정(공개 view 는 누구인지 싣지 않는다)
    const other = seenBy(3);
    expect(saved).toEqual(other);
    expect(saved[0]).toBe("누군가 살아났습니다");
    expect(saved[1]).not.toContain("is-death");
    expect(saved[2]).toBe("누군가 살아났습니다");
    expect(saved[3]).toBe("gone");
  });

  it("밤에 당한 본인(좌석 2): 아침에 유령 view 로 바뀌며 08-17 유령 시작 줄이 한 번 생기고 직업 칩이 보인다", () => {
    const m = mount(night(2));
    expect(sysLines(m.container)).not.toContain(GHOST_LINE);
    m.show(morning(2, 2, [2]));
    expect(sysLines(m.container).filter((t) => t === GHOST_LINE)).toHaveLength(1);
    expect(m.container.querySelector("main.mf-game")?.getAttribute("data-ghost-view")).toBe("true");
    expect(chatChannel(m.container)).toBe("ghost");
  });

  it("첫 스냅샷이 아침이면(재접속) 알림이 없다", () => {
    const { container } = mount(morning(3, 2, [2]));
    expect(announceText(container)).toBe("");
    expect(lastScene().lighting).toBe("morning");
  });

  it("지목 동률·0표로 온 밤(U-5): '처형 없음' 알림이 1.4초 떴다가 사라지고, '밤이 되었습니다' 알림은 이어지지 않는다(띠가 말한다)", () => {
    const m = mount(makeView({ phase: "nomination", mySeat: 3 }));
    m.show(makeView({ phase: "night", mySeat: 3, noExecution: "tie" }));
    expect(announceText(m.container)).toBe("처형 없음");
    advance(1_399);
    expect(announceText(m.container)).toBe("처형 없음");
    advance(1);
    expect(announceText(m.container)).toBe("");
    advance(2_000);
    expect(announceText(m.container)).toBe("");
  });

  it("처형이 이뤄진 밤(U-5): 알림이 없다(처형 단계가 이미 알렸고 띠가 밤을 말한다). 재접속 첫 스냅샷 밤에도 없다", () => {
    const a = mount(makeView({ phase: "execution", mySeat: 3 }));
    a.show(makeView({ phase: "night", mySeat: 3 }));
    expect(announceText(a.container)).toBe("");
    expect(a.container.querySelector("[data-announce]")).toBeNull();
    advance(1_600);
    expect(announceText(a.container)).toBe("");
    cleanup();
    const b = mount(makeView({ phase: "night", mySeat: 3, noExecution: "tie" }));
    expect(announceText(b.container)).toBe("");
  });

  it("밤에 당한 본인(좌석 2): 다른 문장 대신 0.7초에 '암살당했습니다'(ghost 아이콘, 진홍 아님)가 2초 뜨고, 채팅 hot 줄은 다른 사람과 같은 문장이다", () => {
    const m = mount(night(2));
    m.show(morning(2, 2, [2]));
    advance(699);
    expect(announceText(m.container)).toBe("");
    advance(1);
    expect(announceText(m.container)).toBe("암살당했습니다");
    const icon = m.container.querySelector<SVGElement>("[data-announce] svg");
    expect(icon?.getAttribute("width")).toBe("56");
    expect(icon?.classList.contains("is-death")).toBe(false);
    expect([...m.container.querySelectorAll("[data-chat-log] > p.is-hot")].map((p) => (p.textContent ?? "").trim())).toEqual(["서준 님이 당했습니다"]);
    advance(1_999);
    expect(announceText(m.container)).toBe("암살당했습니다");
    advance(1);
    expect(announceText(m.container)).toBe("");
  });

  describe("경찰 조사 결과 (E6 #35, L8, T-09-40)", () => {
    const POLICE = 1;
    const cards = (c: ParentNode): HTMLElement[] => [...c.querySelectorAll<HTMLElement>('[data-card="eye"]')];
    const police = (phase: PhaseId, records: InvestigationRecord[], extra: Partial<ViewOpts> = {}): RoomView =>
      makeView({ phase, mySeat: POLICE, records, ...extra });

    it("경찰 화면: 알림이 2.6초에 시작해 2.2초, 2.4초에 eye 카드(제목 대상 닉네임·본문 '마피아 아님')가 이 화면 채팅에 한 장", () => {
      const m = mount(police("night", []));
      m.show(police("morning", [{ n: 1, target: 3, isMafia: false }], { morning: {} }));
      advance(2_399);
      expect(cards(m.container)).toHaveLength(0);
      expect(announceText(m.container)).toBe("");
      advance(1);
      const [card] = cards(m.container);
      expect(card?.querySelector(".mv-chat__card-title")?.textContent).toBe("지아");
      expect(card?.querySelector(".mv-chat__card-text")?.textContent).toBe("마피아 아님");
      advance(199);
      expect(announceText(m.container)).toBe("");
      advance(1);
      expect(announceText(m.container)).toBe("아무 일도 없었습니다");
      advance(2_199);
      expect(announceText(m.container)).toBe("아무 일도 없었습니다");
      advance(1);
      expect(announceText(m.container)).toBe("");
      expect(cards(m.container)).toHaveLength(1);
    });

    it("대상이 마피아면 본문 '마피아'", () => {
      const m = mount(police("night", []));
      m.show(police("morning", [{ n: 1, target: 4, isMafia: true }], { morning: {} }));
      advance(2_400);
      expect(cards(m.container)[0]?.querySelector(".mv-chat__card-text")?.textContent).toBe("마피아");
    });

    it("경찰이 그 밤에 안 골랐으면 카드가 없고 알림은 0.4초다", () => {
      const m = mount(police("night", []));
      m.show(police("morning", [], { morning: {} }));
      advance(400);
      expect(announceText(m.container)).toBe("아무 일도 없었습니다");
      advance(3_000);
      expect(cards(m.container)).toHaveLength(0);
    });

    it("경찰이 그 밤에 당했어도 카드는 받고 알림은 '암살당했습니다' 0.7초", () => {
      const m = mount(police("night", []));
      m.show(police("morning", [{ n: 1, target: 3, isMafia: false }], { morning: { eliminated: POLICE }, dead: [POLICE] }));
      advance(700);
      expect(announceText(m.container)).toBe("암살당했습니다");
      advance(1_700);
      expect(cards(m.container)).toHaveLength(1);
    });

    it("시민 화면에는 카드도 결과 문구도 없다", () => {
      const m = mount(makeView({ phase: "night", mySeat: 3 }));
      m.show(makeView({ phase: "morning", mySeat: 3, morning: {} }));
      advance(5_000);
      expect(cards(m.container)).toHaveLength(0);
      expect(m.container.textContent).not.toContain("마피아 아님");
    });

    it("재접속 첫 스냅샷이 아침(경찰 기록 있음)이면 카드도 알림도 없다", () => {
      const m = mount(police("morning", [{ n: 1, target: 3, isMafia: false }], { morning: {} }));
      advance(5_000);
      expect(cards(m.container)).toHaveLength(0);
      expect(announceText(m.container)).toBe("");
    });
  });

  it("고정 테이블 화면(.mf-dt)은 낮 시작부터 아침까지 어느 단계에서도 그려지지 않는다(DAY-07)", () => {
    const phases: PhaseId[] = ["dayAnnounce", "discussion", "nomination", "defense", "verdict", "execution", "night", "morning"];
    for (const phase of phases) {
      const { container } = mount(makeView({ phase, mySeat: 3, ...(phase === "morning" ? { morning: {} } : {}) }));
      expect(container.querySelector("main.mf-game"), phase).not.toBeNull();
      expect(container.querySelector(".mf-dt"), phase).toBeNull();
      cleanup();
    }
  });
});

// ---- 09-15 Task 3: 시민 편 어둠 표식 + 긴장 비네트 (NIGHT-10, L3·L10, E3 #20~#22) ----

describe("밤 시민 편 — 어둠 표식과 긴장 비네트 (NIGHT-10, E3 #20~#22)", () => {
  const vignettes = (c: ParentNode): HTMLElement[] => [...c.querySelectorAll<HTMLElement>('[data-tension-pulse="true"]')];
  const darkOf = (c: ParentNode): string | null => c.querySelector("main.mf-game")?.getAttribute("data-night-dark") ?? null;
  const cued = (c: ParentNode): boolean => vignettes(c)[0]?.classList.contains("is-cue") === true;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(NOW);
    vi.spyOn(Math, "random").mockReturnValue(0); // 큐 2개: 5000ms, 9000ms (planTensionCues)
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    sessionStorage.removeItem("minifia:e2e");
    window.history.replaceState({}, "", "/");
    delete window.__mfTension;
  });

  it("밤 산 시민·경찰·의사: 게임 맵 루트에 data-night-dark='true'(세 역할 같은 값)와 aria-hidden 비네트 하나, 산 마피아·유령·낮·아침 화면에는 둘 다 없다", () => {
    const values: Array<string | null> = [];
    for (const seat of [1, 2, 3]) {
      const { container } = mount(makeView({ mySeat: seat }));
      values.push(darkOf(container));
      expect(vignettes(container), `seat ${seat}`).toHaveLength(1);
      expect(vignettes(container)[0]?.getAttribute("aria-hidden")).toBe("true");
      cleanup();
    }
    expect(values).toEqual(["true", "true", "true"]);
    const none: Array<[string, RoomView]> = [
      ["산 마피아", makeView({ mySeat: 0 })],
      ["유령", makeView({ mySeat: 3, dead: [3] })],
      ["토론", makeView({ phase: "discussion", mySeat: 3 })],
      ["아침", makeView({ phase: "morning", mySeat: 3, morning: {} })],
    ];
    for (const [name, view] of none) {
      const { container } = mount(view);
      expect(darkOf(container), name).toBeNull();
      expect(vignettes(container), name).toHaveLength(0);
      cleanup();
    }
  });

  it("비네트는 이름표 층 아래에 있다(맵 상자 안, 이름표 층보다 앞) — 이름표가 비네트 위에 그려진다", () => {
    const { container } = mount(makeView({ mySeat: 3 }));
    const v = vignettes(container)[0]!;
    const tags = container.querySelector(".mf-world__tags")!;
    expect(v.closest("[data-world-stage]")).not.toBeNull();
    expect(tags.contains(v)).toBe(false);
    expect(v.compareDocumentPosition(tags) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("밤이 끝나 단계가 바뀌면 비네트가 사라진다", () => {
    const m = mount(makeView({ mySeat: 3 }));
    expect(vignettes(m.container)).toHaveLength(1);
    m.show(makeView({ phase: "morning", mySeat: 3, morning: {} }));
    expect(vignettes(m.container)).toHaveLength(0);
    expect(darkOf(m.container)).toBeNull();
  });

  it("큐 시각에 강한 맥박 클래스(is-cue)가 잠깐 붙었다 떨어진다. 평소에는 맥박 클래스(is-beat)가 있다", () => {
    const m = mount(makeView({ mySeat: 3 }));
    expect(vignettes(m.container)[0]?.classList.contains("is-beat")).toBe(true);
    expect(cued(m.container)).toBe(false);
    act(() => void vi.advanceTimersByTime(4_999));
    expect(cued(m.container)).toBe(false);
    act(() => void vi.advanceTimersByTime(2));
    expect(cued(m.container)).toBe(true);
    act(() => void vi.advanceTimersByTime(1_400));
    expect(cued(m.container)).toBe(false);
    act(() => void vi.advanceTimersByTime(3_000)); // 9000ms 의 두 번째 큐
    expect(cued(m.container)).toBe(true);
  });

  it("모션 줄이기: 맥박 클래스·큐가 없고 인라인 불투명도가 0.4 로 고정이다", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
    const m = mount(makeView({ mySeat: 3 }));
    const v = vignettes(m.container)[0]!;
    expect(v.classList.contains("is-beat")).toBe(false);
    expect(v.style.opacity).toBe("0.4");
    act(() => void vi.advanceTimersByTime(30_000));
    expect(v.classList.contains("is-cue")).toBe(false);
  });

  it("?e2e=1 문맥에서는 큐가 울릴 때마다 window.__mfTension 에 시각이 쌓이고, 언마운트하면 남은 큐가 멈춘다", () => {
    vi.stubEnv("DEV", false);
    window.history.replaceState({}, "", "/?e2e=1");
    const m = mount(makeView({ mySeat: 3 }));
    expect(window.__mfTension ?? []).toEqual([]);
    act(() => void vi.advanceTimersByTime(5_001));
    expect(window.__mfTension).toHaveLength(1);
    m.unmount();
    act(() => void vi.advanceTimersByTime(30_000));
    expect(window.__mfTension).toHaveLength(1);
  });

  it("개발 빌드가 아니고 ?e2e=1 도 없으면 큐가 울려도 window.__mfTension 이 없다", () => {
    vi.stubEnv("DEV", false);
    mount(makeView({ mySeat: 3 }));
    act(() => void vi.advanceTimersByTime(30_000));
    expect(window.__mfTension).toBeUndefined();
  });

  it("L10: 밤 산 시민 DOM 에는 내 이름표 외 이름표가 없고 직업 칩·채팅 패널도 없다", () => {
    const { container } = mount(makeView({ mySeat: 3 }));
    expect(rosterSeats(container)).toEqual([3]);
    expect(container.querySelectorAll("[data-role-chip]")).toHaveLength(0);
    expect(container.querySelectorAll("[data-chat-panel]")).toHaveLength(0);
  });
});

// ---- 12-09: 밤 소리 갈래 — RoomScreen 이 계산한 visualCues 불리언 하나로만 갈리고 두 갈래의 소리는 같다 (D-11, LS-3) ----

describe("밤 소리: 시각 큐 갈래와 소리 전용 갈래는 같은 소리 id 와 같은 큐 개수를 낸다 (LS-3, T-12-33)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(NOW);
    vi.spyOn(Math, "random").mockReturnValue(0); // 큐 2개: 5000ms, 9000ms
  });
  afterEach(() => {
    setEngineForTest(null);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /** 한 사람의 밤 진입 → 9.1초 동안 엔진 로그 */
  function nightLog(mySeat: number, opts: { dead?: number[]; reduced?: boolean } = {}): string[] {
    const rig = makeRig();
    setEngineForTest(rig.engine);
    if (opts.reduced === true) vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
    vi.setSystemTime(NOW); // 앞 사람의 9.1초가 이 사람의 밤 마감을 앞지르지 않게
    const m = mount(makeView({ phase: "execution", mySeat, ...(opts.dead ? { dead: opts.dead } : {}) }));
    m.show(makeView({ mySeat, ...(opts.dead ? { dead: opts.dead } : {}) }));
    act(() => void vi.advanceTimersByTime(9_100)); // 시각 맥박(시민 편)은 이 타이머로 큐를 낸다
    act(() => rig.fake.clock.advance(9_100)); // 소리 전용 스케줄러(그 밖)는 엔진 시계로 낸다
    const log = rig.engine.log().map((e) => e.id);
    m.unmount();
    cleanup();
    vi.unstubAllGlobals();
    return log;
  }

  it("산 시민·경찰·의사(시각 큐)·산 마피아·유령·모션 줄이기 시민(소리 전용)의 밤 로그가 같다", () => {
    const logs = [nightLog(3), nightLog(1), nightLog(2), nightLog(0), nightLog(3, { dead: [3] }), nightLog(3, { reduced: true })];
    const night = (l: string[]): string[] => l.filter((id) => id === "bed.night" || id === "night.fall" || id === "night.cue");
    for (const l of logs) {
      expect(night(l)).toEqual(["bed.night", "night.fall", "night.cue", "night.cue"]);
      // 14-03: 밤 진입의 사회자 알림음 ui.host 는 공개 단계 전환이라 모든 역할이 정확히 한 번씩 듣는다(밤 무음 LS-7 의 유일한 예외). 그 밖 ui.* 는 0
      expect(l.filter((id) => id.startsWith("ui.") && id !== "ui.host")).toEqual([]);
      expect(l.filter((id) => id === "ui.host")).toHaveLength(1);
    }
  });
});
