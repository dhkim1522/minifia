import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import { TOWN_CLUE_SPOTS, TOWN_LAMPS } from "../../shared/game/mapTown";
import type { RoleId } from "../../shared/game/roles";
import type { ClientMessage, ClueLine, PublicPlayer, RoomView } from "../../shared/protocol";
import { SCENE_ON_AFTER_MS, SCENE_ON_MAX_MS, sceneDelayMs } from "../../src/game/causalView";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 21-13 Task 2 (D-08·D-13·D-16·D-23·D-26·D-27, P21-12·P21-13): 아침 · 현장 조사 화면 배선.
// RoomScreen 을 거쳐 GameMap 을 그리고 WorldStage 는 진짜를 쓴다(표식·카드·꺼진 등불이 DOM 이라서). 런타임(three)만 가짜 — 프레임 콜백(onProject)은 시험이 직접 부른다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

const rt = vi.hoisted(() => ({ deps: null as null | Record<string, unknown>, walks: [] as Array<{ x: number; z: number }> }));
vi.mock("../../src/world/runtime", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/world/runtime")>();
  return {
    ...real,
    createWorldRuntime: (deps: Record<string, unknown>) => {
      rt.deps = deps;
      return {
        start: () => Promise.resolve(),
        syncPlayers: () => {},
        stopAllEmotes: () => {},
        deny: () => {},
        surprise: () => {},
        setScene: () => {},
        tap: () => ({ x: 1, z: 1 }),
        walkTo: (x: number, z: number) => {
          rt.walks.push({ x, z });
          return { x, z };
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

const NAMES = ["민수", "영희", "서준", "지아", "도윤", "하은"];
const NOW = 1_700_000_000_000;

interface Opts {
  count?: number;
  mySeat?: number;
  role?: RoleId;
  dead?: number[];
  clues?: ClueLine[];
  /** 현장 집(없으면 day.scene 없음) */
  house?: number | null;
  lamps?: number[];
  morning?: { eliminated?: number; saved?: true };
  skipPhase?: boolean;
  skipCount?: number;
  /** 단계가 시작된 뒤 지난 ms — Date.now()=NOW 에서 본 값이다(단계 시작을 그만큼 앞으로 옮긴다) */
  elapsed?: number;
  mode?: "basic" | "extended";
}

function makeView(o: Opts = {}): RoomView {
  const count = o.count ?? 3;
  const mySeat = o.mySeat ?? 0;
  const dead = o.dead ?? [];
  const meDead = dead.includes(mySeat);
  const players: PublicPlayer[] = Array.from({ length: count }, (_, seat) => ({
    seat,
    nickname: NAMES[seat] ?? `p${seat}`,
    connected: true,
    isHost: seat === 0,
    ...(dead.includes(seat) ? { alive: false } : {}),
  }));
  const house = o.house === undefined ? 2 : o.house;
  const view = {
    code: "0042",
    phase: "morning",
    phaseEndsAt: NOW + 30_000 - (o.elapsed ?? 0),
    phaseDurationMs: 30_000,
    serverNow: NOW,
    mode: o.mode ?? "extended",
    map: "town",
    minPlayers: 3,
    maxPlayers: 8,
    players,
    me: {
      seat: mySeat,
      isHost: mySeat === 0,
      role: o.role ?? "citizen",
      chat: meDead ? "ghost" : "all",
      ...(o.clues !== undefined ? { clues: o.clues } : {}),
      ...(o.skipPhase === true ? { skipPhase: true as const } : {}),
    },
    day: {
      n: 1,
      roles: [],
      morning: o.morning ?? { eliminated: 2 },
      lamps: o.lamps ?? [1],
      ...(house === null ? {} : { scene: { house } }),
      ...(o.skipCount !== undefined ? { skipCount: o.skipCount } : {}),
    },
  } as RoomView;
  if (meDead) view.spectate = { seats: players.map((p) => ({ seat: p.seat, job: "citizen" as RoleId })) };
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
    show: (v: RoomView) => {
      const prev = connectionMock.current as RoomConnection;
      connectionMock.current = conn(v, { send: prev.send, onEvent: prev.onEvent, epoch: prev.epoch });
      r.rerender(ui());
    },
  };
};

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};
/** 결과 알림이 끝난 뒤(sceneOn)까지 시간을 보낸다 */
const sceneOn = (): void => advance(SCENE_ON_AFTER_MS + 50);

const spots = (c: ParentNode): HTMLElement[] => [...c.querySelectorAll<HTMLElement>("[data-clue-spot]")];
const states = (c: ParentNode): string[] => spots(c).map((s) => `${s.dataset.clueSpot}:${s.dataset.state}`);
const cards = (c: ParentNode): string[] => [...c.querySelectorAll<HTMLElement>("[data-clue-row] [data-clue-chip]")].map((e) => `${e.dataset.clueChip}:${e.textContent}`);
const sceneAct = (c: ParentNode): HTMLElement | null => c.querySelector<HTMLElement>("[data-scene-act]");
const lampOffs = (c: ParentNode): number[] => [...c.querySelectorAll<HTMLElement>("[data-lamp-off]")].map((e) => Number(e.dataset.lampOff));

function withHandlers(): { handlers: Array<(e: never, meta: { epoch: number }) => void>; onEvent: RoomConnection["onEvent"] } {
  const handlers: Array<(e: never, meta: { epoch: number }) => void> = [];
  const onEvent = vi.fn((cb: unknown) => {
    handlers.push(cb as (typeof handlers)[number]);
    return () => {};
  });
  return { handlers, onEvent: onEvent as unknown as RoomConnection["onEvent"] };
}
/** 내(좌석 0) 위치를 월드 단위로 서 있게 한다(서버 snap) */
function standAt(handlers: Array<(e: never, meta: { epoch: number }) => void>, x: number, z: number, seat = 0): void {
  const ents = [{ s: seat, p: [Math.round(x * 100), Math.round(z * 100)], t0: Date.now() - 1000, v: 0 }];
  act(() => handlers.forEach((h) => h({ t: "world", k: "snap", at: Date.now(), ents, near: true } as never, { epoch: 1 })));
}
const spotWorld = (house: number, spot: 1 | 2 | 3): { x: number; z: number } => ({ x: TOWN_CLUE_SPOTS[house]![spot - 1]!.x / 100, z: TOWN_CLUE_SPOTS[house]![spot - 1]!.z / 100 });
const FAR = { x: -4, z: 4 };

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
  rt.deps = null;
  rt.walks.length = 0;
  installMemoryStorage();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("sceneDelayMs: 결과 알림이 끝난 뒤 (순수)", () => {
  const base = makeView();
  it("단계 시작 직후는 기본 시각까지, 알림이 아직 보이면 최대 시각까지 기다린다", () => {
    expect(sceneDelayMs(base, NOW, false)).toBe(SCENE_ON_AFTER_MS);
    expect(sceneDelayMs(makeView({ elapsed: 1000 }), NOW, false)).toBe(SCENE_ON_AFTER_MS - 1000);
    expect(sceneDelayMs(makeView({ elapsed: SCENE_ON_AFTER_MS }), NOW, true)).toBe(SCENE_ON_MAX_MS - SCENE_ON_AFTER_MS);
    expect(sceneDelayMs(makeView({ elapsed: SCENE_ON_AFTER_MS }), NOW, false)).toBe(0);
  });
  it("재접속·늦은 합류(최대 시각을 지났다)는 알림이 보여도 바로 0", () => {
    expect(sceneDelayMs(makeView({ elapsed: SCENE_ON_MAX_MS }), NOW, true)).toBe(0);
    expect(sceneDelayMs(makeView({ elapsed: 20_000 }), NOW, false)).toBe(0);
  });
});

describe("아침 현장 화면: 결과 알림 뒤 지점 셋 (D-13·D-26)", () => {
  it("알림이 끝나기 전에는 지점·카드·살피기 단추가 없고, 끝나면 지점 셋이 모두 fresh 로 뜬다", () => {
    const { container } = mount(makeView());
    expect(spots(container)).toHaveLength(0);
    expect(sceneAct(container)?.getAttribute("aria-disabled")).toBe("true"); // 독은 처음부터 있고 단추는 비활성(자리가 흔들리지 않는다)
    advance(SCENE_ON_AFTER_MS - 100);
    expect(spots(container)).toHaveLength(0);
    sceneOn();
    expect(states(container)).toEqual(["1:fresh", "2:fresh", "3:fresh"]);
    expect(container.querySelector("[data-clue-row]")).toBeNull(); // 카드가 0장이면 줄이 없다
  });

  it("독: [살펴보기] 와 [건너뛰기] 가 있고 채팅 입력줄은 없다", () => {
    const { container } = mount(makeView());
    sceneOn();
    expect(sceneAct(container)).not.toBeNull();
    expect(container.querySelector("[data-skip-phase]")).not.toBeNull();
    expect(container.querySelector("[data-chat-input]")).toBeNull();
    expect(container.querySelector("[data-scene-dock]")).not.toBeNull();
  });

  it("현장이 없는 확장판 아침(day.scene 없음)은 지점·카드·꺼진 등불이 없고 지금의 패널 그대로다", () => {
    const { container } = mount(makeView({ house: null }));
    sceneOn();
    expect(spots(container)).toHaveLength(0);
    expect(lampOffs(container)).toEqual([]);
    expect(sceneAct(container)).toBeNull();
    expect(container.querySelector("[data-chat-input]")).not.toBeNull();
  });

  it("기본 마피아 판의 아침은 이 화면이 아니다(지점·독 없음)", () => {
    const { container } = mount(makeView({ mode: "basic" }));
    sceneOn();
    expect(spots(container)).toHaveLength(0);
    expect(sceneAct(container)).toBeNull();
  });

  it("구출된 밤(미수)도 같은 화면이다: 현장 집 day.scene.house(마피아가 노린 집)에 지점 셋", () => {
    const { container } = mount(makeView({ morning: { saved: true }, house: 4, count: 5 }));
    sceneOn();
    expect(states(container)).toEqual(["1:fresh", "2:fresh", "3:fresh"]);
  });

  it("재접속(최대 시각 이후 합류)은 연출 없이 바로 지점이 있다", () => {
    const { container } = mount(makeView({ elapsed: SCENE_ON_MAX_MS + 500 }));
    expect(states(container)).toEqual(["1:fresh", "2:fresh", "3:fresh"]);
  });
});

describe("아침 현장 화면: 살핀 결과 (D-14·D-15)", () => {
  it("발자국 둘을 받으면 지점 1 done + 카드 '발자국 둘' 한 장", () => {
    const { container } = mount(makeView({ clues: [{ spot: 1, kind: "footprint", n: 2 }] }));
    sceneOn();
    expect(states(container)).toEqual(["1:done", "2:fresh", "3:fresh"]);
    expect(cards(container)).toEqual(["footprint:발자국 둘"]);
  });

  it("먼저 손댄 흔적을 받으면 그 지점이 blurred 이고 카드 '먼저 손댄 흔적'(점선)", () => {
    const { container } = mount(makeView({ clues: [{ spot: 1, kind: "footprint", n: 2 }, { spot: 2, kind: "touched" }] }));
    sceneOn();
    expect(states(container)).toEqual(["1:done", "2:blurred", "3:fresh"]);
    expect(cards(container)).toEqual(["footprint:발자국 둘", "touched:먼저 손댄 흔적"]);
    expect(container.querySelector('[data-clue-chip="touched"]')!.className).toMatch(/is-faint/);
  });

  it("창문 단서·어두워서 못 봤어요: 살핀 차례대로 카드, 세 곳을 다 살폈으면 [살펴보기] 는 '완료'", () => {
    const clues: ClueLine[] = [
      { spot: 3, kind: "dark" },
      { spot: 1, kind: "footprint", n: 3 },
      { spot: 2, kind: "cloth", piece: "blackCloth" },
    ];
    const { container } = mount(makeView({ clues }));
    sceneOn();
    expect(states(container)).toEqual(["1:done", "2:done", "3:done"]);
    expect(cards(container).map((c) => c.split(":")[0])).toEqual(["dark", "footprint", "cloth"]);
    expect(cards(container)[0]).toBe("dark:어두워서 못 봤어요");
    expect(sceneAct(container)!.textContent).toBe("완료");
    expect(sceneAct(container)!.getAttribute("aria-disabled")).toBe("true");
  });

  it("목격·단서 없음 칩은 아침 카드 줄에 없다(보드 전용)", () => {
    const { container } = mount(makeView({ clues: [{ spot: 1, kind: "footprint", n: 1 }] }));
    sceneOn();
    expect(container.querySelector('[data-clue-chip="witness"]')).toBeNull();
    expect(container.querySelector('[data-clue-chip="none"]')).toBeNull();
  });
});

describe("아침 현장 화면: [살펴보기]·건너뛰기·걷기", () => {
  it("반경 밖은 비활성(안내 글 없음), 지점 반경 안이면 활성 + data-call, 누르면 {t:inspect}", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { handlers, onEvent } = withHandlers();
    const { container } = mount(makeView(), { send, onEvent });
    sceneOn();
    standAt(handlers, FAR.x, FAR.z);
    advance(300);
    const b = () => sceneAct(container)!;
    expect(b().getAttribute("aria-disabled")).toBe("true");
    expect(b().hasAttribute("data-call")).toBe(false);
    fireEvent.pointerDown(b());
    fireEvent.pointerUp(b());
    expect(send.mock.calls.some(([m]) => m.t === "inspect")).toBe(false);
    const p = spotWorld(2, 2);
    standAt(handlers, p.x + 0.3, p.z);
    advance(300);
    expect(b().getAttribute("aria-disabled")).toBeNull();
    expect(b().hasAttribute("data-call")).toBe(true);
    fireEvent.pointerDown(b());
    fireEvent.pointerUp(b());
    expect(send.mock.calls.map(([m]) => JSON.stringify(m)).filter((m) => m.includes("inspect"))).toEqual(['{"t":"inspect"}']);
  });

  it("이미 살핀 지점 반경 안은 활성이 아니다(안 살핀 지점만 센다)", () => {
    const { handlers, onEvent } = withHandlers();
    const { container } = mount(makeView({ clues: [{ spot: 2, kind: "cloth", piece: "blackCloth" }] }), { onEvent });
    sceneOn();
    const p = spotWorld(2, 2);
    standAt(handlers, p.x, p.z);
    advance(300);
    expect(sceneAct(container)!.getAttribute("aria-disabled")).toBe("true");
  });

  it("[건너뛰기] 는 {t:skipPhase,on:true}, 눌린 뒤 다시 누르면 on:false", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container } = mount(makeView({ skipCount: 1 }), { send });
    sceneOn();
    const skip = container.querySelector<HTMLElement>("[data-skip-phase]")!;
    expect(skip.getAttribute("aria-label")).toBe("건너뛰기 1/3");
    fireEvent.click(skip);
    expect(send).toHaveBeenLastCalledWith({ t: "skipPhase", on: true });
    fireEvent.click(skip);
    expect(send).toHaveBeenLastCalledWith({ t: "skipPhase", on: false });
  });

  it("지점 표식을 누르면 그 지점으로 걷는다(move 하나, 바닥 탭과 같은 경로)", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container } = mount(makeView(), { send });
    sceneOn();
    fireEvent.click(spots(container)[2]!);
    const p = spotWorld(2, 3);
    expect(rt.walks).toEqual([p]);
    const move = send.mock.calls.map(([m]) => m).find((m) => m.t === "move");
    expect(move).toEqual({ t: "move", x: Math.round(p.x * 100), z: Math.round(p.z * 100) });
  });
});

describe("아침 현장 화면: 꺼진 등불 (D-08)", () => {
  it("day.lamps [1], 주인 좌석 0·1·2 → 꺼진 등불은 0·2 (누가 껐는지는 알 수 없다)", () => {
    const { container } = mount(makeView({ lamps: [1] }));
    sceneOn();
    expect(lampOffs(container)).toEqual([0, 2]);
    expect(container.querySelector("[data-lamp-off]")!.getAttribute("aria-label")).toBe("꺼진 등불");
  });

  it("유령도 꺼진 등불은 보이고 지점·카드·[살펴보기] 는 없다(채팅 패널 그대로)", () => {
    const { container } = mount(makeView({ mySeat: 0, dead: [0], lamps: [1] }));
    sceneOn();
    expect(lampOffs(container)).toEqual([0, 2]);
    expect(spots(container)).toHaveLength(0);
    expect(container.querySelector("[data-clue-row]")).toBeNull();
    expect(sceneAct(container)).toBeNull();
    expect(container.querySelector("[data-scene-dock]")).toBeNull();
  });
});

describe("아침 현장 화면: 프레임 투영 (P21-12·P21-13)", () => {
  type Project = (x: number, z: number) => { sx: number; sy: number } | null;
  type At = (x: number, y: number, z: number) => { sx: number; sy: number } | null;
  const frame = (project: Project, at: At): void => {
    act(() => {
      (rt.deps!.onProject as (p: Project, now: number, at: At) => void)(project, Date.now(), at);
    });
  };
  const ident: Project = (x, z) => ({ sx: 180 + x * 10, sy: 300 + z * 10 });

  it("지점은 바닥(y 0), 꺼진 등불은 가로등 기둥 구 높이 y 2.6 에서 투영해 자리를 쓴다", () => {
    const { container } = mount(makeView({ lamps: [1] }));
    sceneOn();
    const heights: number[] = [];
    frame(ident, (x, y, z) => {
      heights.push(y);
      return { sx: 180 + x * 10, sy: 300 + z * 10 - y * 10 };
    });
    expect(new Set(heights)).toEqual(new Set([2.6]));
    const spot1 = spots(container)[0]!;
    const w = spotWorld(2, 1);
    expect(spot1.hidden).toBe(false);
    expect(spot1.style.transform).toBe(`translate(${Math.round(180 + w.x * 10 - 26)}px, ${Math.round(300 + w.z * 10 - 26)}px)`);
    const lamp0 = container.querySelector<HTMLElement>('[data-lamp-off="0"]')!;
    const pole = TOWN_LAMPS[0]!.pole;
    expect(lamp0.hidden).toBe(false);
    expect(lamp0.style.transform).toBe(`translate(${Math.round(180 + pole.x * 10 - 18)}px, ${Math.round(300 + pole.z * 10 - 26 - 18)}px)`);
  });

  it("화면 밖 지점은 숨기고 가장 가까운 안 살핀 지점 쪽을 화살표로 가리킨다. 화면 밖 꺼진 등불은 그리지 않는다", () => {
    const { container } = mount(makeView({ lamps: [1] }));
    sceneOn();
    frame(
      (x, z) => ({ sx: 5000 + x, sy: 5000 + z }),
      (x, _y, z) => ({ sx: 5000 + x, sy: 5000 + z }),
    );
    expect(spots(container).every((s) => s.hidden)).toBe(true);
    expect([...container.querySelectorAll<HTMLElement>("[data-lamp-off]")].every((l) => l.hidden)).toBe(true);
  });

  it("가장 가까운 안 살핀 한 곳만 is-call 이다(반경 밖일 때)", () => {
    const { handlers, onEvent } = withHandlers();
    const { container } = mount(makeView(), { onEvent });
    sceneOn();
    const p = spotWorld(2, 3);
    standAt(handlers, p.x + 2.5, p.z);
    advance(300);
    frame(ident, (x, y, z) => ({ sx: 180 + x * 10, sy: 300 + z * 10 - y * 10 }));
    expect(spots(container).map((s) => s.hasAttribute("data-call"))).toEqual([false, false, true]);
  });
});

describe("아침 현장 화면: 역할을 읽지 않는다 (D-15·D-21, T-21-31)", () => {
  it("같은 view 의 네 역할 렌더에서 지점 층·카드 줄·독이 같은 마크업이다", () => {
    const roles: RoleId[] = ["mafia", "citizen", "police", "doctor"];
    const clues: ClueLine[] = [{ spot: 1, kind: "footprint", n: 2 }, { spot: 3, kind: "dark" }];
    const html = roles.map((role) => {
      const { container, unmount } = mount(makeView({ role, clues, skipCount: 1 }));
      sceneOn();
      const out = [
        container.querySelector("[data-clue-layer]")?.outerHTML,
        container.querySelector("[data-clue-row]")?.outerHTML,
        container.querySelector("[data-scene-dock]")?.outerHTML,
      ].join("\n");
      unmount();
      return out;
    });
    expect(html[0]).toContain("data-clue-spot");
    expect(html[0]).toContain("data-clue-chip");
    for (const h of html) expect(h).toBe(html[0]);
  });

  it("살피기 전 마피아·시민의 아침 화면 지점 층은 같다(상태는 내가 받은 값뿐)", () => {
    const html = (["mafia", "citizen"] as RoleId[]).map((role) => {
      const { container, unmount } = mount(makeView({ role }));
      sceneOn();
      const out = container.querySelector("[data-clue-layer]")!.outerHTML;
      unmount();
      return out;
    });
    expect(html[0]).toBe(html[1]);
  });
});
