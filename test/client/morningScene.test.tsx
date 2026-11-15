import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import { openCause } from "../helpers/playable";
import type { RoleId } from "../../shared/game/roles";
import type { ClientMessage, ClueLine, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import type { WorldStageProps } from "../../src/components/WorldStage";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 21-10 아침 현장 조사 화면(D-02·D-13~D-17·D-26, UI-SPEC D): 확장판(원인 흐름) 아침은 큰 글 발표가 먼저 뜨고 그동안 띠는 빈 줄, 사라지면 피해자(미수) 집 앞 단서 지점 셋이 나타난다.
// 산 사람은 걷고 반경 안에서 [살펴보기] → inspect, 살핀 줄은 카드 줄로 쌓인다. RoomScreen 을 거쳐 GameMap 을 그리고 WorldStage 는 진짜(props 만 가로챈다)를 쓴다 — 지점·[살펴보기] DOM 은 WorldStage 가 그린다.
// 런타임(three)만 가짜: 투영·프레임 쓰기는 worldStage.test 가 본다(여기서는 DOM 의 있고 없음·속성·props).
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

const rt = vi.hoisted(() => ({ scenes: [] as unknown[] }));
vi.mock("../../src/world/runtime", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/world/runtime")>();
  return {
    ...real,
    createWorldRuntime: () => ({
      start: () => Promise.resolve(),
      syncPlayers: () => {},
      stopAllEmotes: () => {},
      deny: () => {},
      surprise: () => {},
      setScene: (look: unknown) => rt.scenes.push(look),
      tap: () => ({ x: 1, z: 1 }),
      walkTo: (x: number, z: number) => ({ x, z }),
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
    }),
  };
});

const stage = vi.hoisted(() => ({ props: null as null | WorldStageProps }));
vi.mock("../../src/components/WorldStage", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/components/WorldStage")>();
  const { createElement } = await import("react");
  return {
    ...real,
    WorldStage: (props: WorldStageProps) => {
      stage.props = props;
      return createElement(real.WorldStage, props);
    },
  };
});
const { RoomScreen } = await import("../../src/screens/RoomScreen");

const NAMES = ["민수", "영희", "서준", "지아", "도윤"];
const NOW = 1_700_000_000_000;
const LAMPS = [true, false, true, true, false, false, true, false];
const ROLES: RoleId[] = ["mafia", "police", "doctor", "citizen"];
// 집 3 의 지점(월드 단위): 발자국 (5.75, 3.75) · 옷 조각 (5.75, 4.75) · 창문 (5.75, 5.75)
const SPOT = { footprint: { x: 5.75, z: 3.75 }, cloth: { x: 5.75, z: 4.75 }, window: { x: 5.75, z: 5.75 } } as const;
const FAR = { x: -8, z: -8 };

interface Opts {
  phase?: PhaseId;
  mode?: "basic" | "extended";
  role?: RoleId;
  dead?: boolean;
  house?: number | null;
  scene?: ClueLine[];
  saved?: boolean;
}

function makeView(o: Opts = {}): RoomView {
  const phase = o.phase ?? "morning";
  const players: PublicPlayer[] = NAMES.map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0, ...(o.dead === true && seat === 0 ? { alive: false } : {}) }));
  const house = o.house === undefined ? 3 : o.house;
  const day: Record<string, unknown> = {
    n: 1,
    roles: [],
    lamps: LAMPS,
    ...(phase === "morning" ? { morning: o.saved === true ? { saved: true } : { eliminated: 3 } } : {}),
    ...(phase === "morning" && house !== null ? { scene: { house } } : {}),
  };
  const view = {
    code: "0042",
    phase,
    phaseEndsAt: NOW + 35_000,
    phaseDurationMs: 35_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    map: "town",
    mode: o.mode ?? "extended",
    me: { seat: 0, isHost: true, chat: o.dead === true ? "ghost" : "all", ...(o.role !== undefined ? { role: o.role } : {}), ...(o.scene === undefined ? {} : { scene: o.scene }) },
    day,
  } as unknown as RoomView;
  if (o.dead === true) view.spectate = { seats: players.map((p) => ({ seat: p.seat, job: "citizen" as RoleId })) };
  return view;
}

function conn(view: RoomView, over: Partial<RoomConnection> = {}): RoomConnection {
  return { status: "open", banner: "hidden", view, offset: 0, epoch: 1, removedReason: null, canSend: true, send: vi.fn(() => true), onEvent: vi.fn(() => () => {}), reconnect: vi.fn(), retry: vi.fn(), ...over };
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

const spots = (c: ParentNode): HTMLElement[] => [...c.querySelectorAll<HTMLElement>("[data-clue-spot]")];
const cards = (c: ParentNode): HTMLElement[] => [...c.querySelectorAll<HTMLElement>("[data-clue-card]")];
const hostLine = (c: ParentNode): string => c.querySelector("[data-host-line]")?.textContent ?? "";
const announce = (c: ParentNode): string | null => c.querySelector("[data-announce]")?.textContent ?? null;
const sentOf = (send: ReturnType<typeof vi.fn<(m: ClientMessage) => boolean>>, t: string): ClientMessage[] => send.mock.calls.map(([x]) => x).filter((x) => x.t === t);
const stateOf = (c: ParentNode): string => spots(c).map((s) => `${s.dataset.clueSpot}:${s.dataset.state}`).join(",");

/** 내(좌석 0) 위치를 월드 단위로 서 있게 한다(서버 snap) */
function standAt(x: number, z: number): void {
  act(() => {
    stage.props!.store.applyFrame({ t: "world", k: "snap", at: Date.now(), ents: [{ s: 0, p: [Math.round(x * 100), Math.round(z * 100)], t0: Date.now() - 1000, v: 180 }], near: true }, 1);
  });
}

let restore: () => void = () => {};
beforeAll(() => {
  restore = openCause();
});
afterAll(() => restore());
beforeEach(() => {
  rt.scenes.length = 0;
  installMemoryStorage();
});
afterEach(() => {
  cleanup();
  stage.props = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("큰 글 발표 뒤 지점이 나타난다 (D-02·D-16, P21-20)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  it("밤 → 아침: 발표 동안(큰 글이 뜨기 전·뜬 동안) 지점 0 건·띠 빈 줄·clues 층 없음, 발표가 사라진 뒤 3 건과 띠 '빛나는 곳을 살펴보세요'", () => {
    const { container, show } = mount(makeView({ phase: "night" }));
    expect(spots(container)).toHaveLength(0);
    show(makeView({ phase: "morning" }));
    // 큰 글이 아직 안 떴어도(0.4초 뒤에 뜬다) 발표 구간이다
    expect(spots(container)).toHaveLength(0);
    expect(stage.props!.clues).toBeUndefined();
    expect(hostLine(container)).toBe("");
    advance(450);
    expect(announce(container)).toBe("지아 님이 당했습니다"); // morning.eliminated = 좌석 3(지아)
    expect(spots(container)).toHaveLength(0);
    expect(hostLine(container)).toBe("");
    advance(2500);
    expect(announce(container)).toBeNull();
    expect(spots(container)).toHaveLength(3);
    expect(spots(container).map((s) => s.dataset.clueSpot).join(",")).toBe("footprint,cloth,window");
    expect(hostLine(container)).toBe("빛나는 곳을 살펴보세요");
  });

  it("처음부터 아침에 들어온 화면(재접속)은 발표가 없어 곧바로 지점 3 건", () => {
    const { container } = mount(makeView({ phase: "morning" }));
    expect(spots(container)).toHaveLength(3);
    expect(hostLine(container)).toBe("빛나는 곳을 살펴보세요");
  });

  it("현장 없는 밤(D-17): 밤 → 토론이면 아침 화면 없이 토론 첫머리에 '아무 일도 없었습니다' 큰 글 한 번만 뜨고 지점은 한 번도 없다", () => {
    const { container, show } = mount(makeView({ phase: "night" }));
    show(makeView({ phase: "discussion" }));
    expect(spots(container)).toHaveLength(0);
    advance(450);
    expect(announce(container)).toBe("아무 일도 없었습니다");
    advance(2500);
    expect(announce(container)).toBeNull();
    expect(spots(container)).toHaveLength(0);
    expect(cards(container)).toHaveLength(0);
  });

  it("아침 → 토론(현장이 있었던 밤)에는 그 큰 글이 다시 뜨지 않는다", () => {
    const { container, show } = mount(makeView({ phase: "morning" }));
    show(makeView({ phase: "discussion" }));
    advance(450);
    expect(announce(container)).toBeNull();
  });
});

describe("지점 표지와 [살펴보기] (D-13, P21-10·P21-11)", () => {
  it("지점 셋은 지점 id·data-state 를 갖고 모두 new 이다. 장소 이름 글자는 없다", () => {
    const { container } = mount(makeView());
    expect(stateOf(container)).toBe("footprint:new,cloth:new,window:new");
    for (const s of spots(container)) expect(s.textContent).toBe("");
  });

  it("살필 수 있는 지점이 없으면(반경 밖) 안 살핀 지점 셋이 빛나고 [살펴보기] 는 DOM 에 없다", () => {
    const { container } = mount(makeView());
    standAt(FAR.x, FAR.z);
    expect(container.querySelector("[data-errand-act]")).toBeNull();
    expect(stage.props!.clues!.actId).toBeNull();
    expect([...(stage.props!.clues!.callSpots ?? [])]).toEqual(["footprint", "cloth", "window"]);
  });

  it("옷 조각 지점 반경 안이면 [살펴보기](돋보기, 접근성 '옷 조각 살펴보기')가 뜨고 지점 빛남은 꺼지며, 누르면 inspect 를 보낸다(필드 없음)", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container } = mount(makeView(), { send });
    standAt(SPOT.cloth.x, SPOT.cloth.z);
    const pill = container.querySelector<HTMLElement>("[data-errand-act]");
    expect(pill).not.toBeNull();
    expect(pill!.textContent).toBe("살펴보기");
    expect(pill!.getAttribute("aria-label")).toBe("옷 조각 살펴보기");
    expect(stage.props!.clues!.actId).toBe("cloth");
    expect(stage.props!.clues!.callSpots ?? []).toHaveLength(0);
    fireEvent.click(pill!);
    expect(sentOf(send, "inspect")).toEqual([{ t: "inspect" }]);
  });

  it("연결이 끊겨(canSend 거짓) 있으면 [살펴보기] 를 눌러도 보내지 않는다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container } = mount(makeView(), { send, canSend: false });
    standAt(SPOT.cloth.x, SPOT.cloth.z);
    fireEvent.click(container.querySelector("[data-errand-act]")!);
    expect(sentOf(send, "inspect")).toEqual([]);
  });

  it("이미 살핀 지점 위에서는 [살펴보기] 가 없다(안 살핀 다른 지점이 반경 밖일 때)", () => {
    const { container } = mount(makeView({ scene: [{ spot: "footprint", r: "clue", n: 2 }] }));
    standAt(SPOT.footprint.x - 0.8, SPOT.footprint.z - 0.8);
    expect(container.querySelector("[data-errand-act]")).toBeNull();
  });

  it("지점 표지를 누르면 그 지점으로 걷는다(move)", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container } = mount(makeView(), { send });
    fireEvent.click(spots(container)[1]!);
    expect(sentOf(send, "move")).toEqual([{ t: "move", x: 575, z: 475 }]);
  });
});

describe("내가 받은 단서 카드 줄 (D-14·D-15, P21-12)", () => {
  it("살핀 줄이 없으면 카드 줄 자체가 없다(0장)", () => {
    const { container } = mount(makeView());
    expect(container.querySelector("[data-clue-cards]")).toBeNull();
    expect(cards(container)).toHaveLength(0);
  });

  it("옷 조각을 살피면 그 표지는 done 이고 카드 한 장(data-clue-card=cloth)이 더해진다", () => {
    const { container, show } = mount(makeView());
    show(makeView({ scene: [{ spot: "cloth", r: "clue", piece: "blackCloth" }] }));
    expect(stateOf(container)).toBe("footprint:new,cloth:done,window:new");
    expect(cards(container).map((c) => c.dataset.clueCard)).toEqual(["cloth"]);
    expect(cards(container)[0]!.textContent).toBe("검은 천 조각");
  });

  it("셋을 다 살피면 카드 셋(살핀 순서)·손댄 흔적·어두운 창 두 표지는 dim, 카드 줄은 패널 위 한 줄에 있다", () => {
    const { container } = mount(makeView({ scene: [{ spot: "cloth", r: "clue", piece: "blackCloth" }, { spot: "window", r: "dark" }, { spot: "footprint", r: "touched" }] }));
    expect(stateOf(container)).toBe("footprint:dim,cloth:done,window:dim");
    expect(cards(container).map((c) => c.dataset.clueCard)).toEqual(["cloth", "window", "footprint"]);
    expect(cards(container).map((c) => c.textContent)).toEqual(["검은 천 조각", "어두워서 못 봤어요", "먼저 손댄 흔적"]);
    expect(container.querySelectorAll("[data-clue-cards]")).toHaveLength(1);
    // 모두 살폈으면 빛남이 없다(띠는 곧 토론이 시작됩니다)
    expect(stage.props!.clues!.actId).toBeNull();
    expect(stage.props!.clues!.callSpots ?? []).toHaveLength(0);
    expect(hostLine(container)).toBe("곧 토론이 시작됩니다");
  });

  it("발자국 카드는 숫자만(data-count)이고 '범인'·'증거'·'확정'이 화면에 없다", () => {
    const { container } = mount(makeView({ scene: [{ spot: "footprint", r: "clue", n: 3 }, { spot: "window", r: "clue", piece: "grayThread" }] }));
    const fp = container.querySelector<HTMLElement>('[data-clue-card="footprint"]')!;
    expect(fp.dataset.count).toBe("3");
    expect(fp.textContent).toBe("3");
    expect(container.textContent).not.toMatch(/범인|증거|확정/);
  });
});

describe("걷기·기본판·유령·직업 비노출", () => {
  it("확장판 아침: 산 사람은 걷는다(canWalk 참). 기본판 아침은 지금처럼 걷기 없음·지점 없음", () => {
    mount(makeView());
    expect(stage.props!.canWalk).toBe(true);
    cleanup();
    const basic = mount(makeView({ mode: "basic" }));
    expect(stage.props!.canWalk).toBe(false);
    expect(spots(basic.container)).toHaveLength(0);
  });

  it("유령 화면: 지점 표지·카드 줄·[살펴보기] 가 없다", () => {
    const { container } = mount(makeView({ dead: true }));
    expect(spots(container)).toHaveLength(0);
    expect(cards(container)).toHaveLength(0);
    expect(container.querySelector("[data-errand-act]")).toBeNull();
  });

  it("의사가 막은 아침(morning.saved): 지점 셋이 그 집 앞에 있고 화면 어디에도 직업 글자가 없다(직업은 그림에도 글에도 없다)", () => {
    const { container } = mount(makeView({ saved: true }));
    expect(spots(container)).toHaveLength(3);
    expect(container.textContent).not.toMatch(/의사|경찰|마피아|시민|직업/);
    for (const s of spots(container)) expect(s.getAttribute("aria-label")).not.toMatch(/의사|경찰|마피아|시민|직업/);
  });

  it("같은 view 의 me.role 만 바꾼 네 역할 렌더의 지점·카드 줄·아래 패널 구조가 같다", () => {
    const scene: ClueLine[] = [{ spot: "cloth", r: "clue", piece: "pin" }, { spot: "window", r: "dark" }];
    const sig = (c: ParentNode): string => {
      const layer = c.querySelector("[data-clue-layer]");
      const panel = c.querySelector<HTMLElement>("[data-world-panel]");
      return JSON.stringify({
        layer: layer === null ? null : layer.outerHTML,
        cards: c.querySelector("[data-clue-cards]")?.outerHTML ?? null,
        panel: panel === null ? null : [panel.className, [...panel.children].filter((el) => !el.classList.contains("mf-sr-only")).map((el) => el.className.replace(/\s+/g, " "))],
        host: hostLine(c),
      });
    };
    const base = (() => {
      const { container, unmount } = mount(makeView({ role: "citizen", scene }));
      const s = sig(container);
      unmount();
      return s;
    })();
    for (const role of ROLES) {
      const { container, unmount } = mount(makeView({ role, scene }));
      expect(sig(container), role).toBe(base);
      unmount();
    }
  });
});
