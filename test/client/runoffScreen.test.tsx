import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import type { ClientMessage, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { readFileSync } from "node:fs";
import type { SceneLook } from "../../src/world/presence";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 09.1.1-14: 결선 화면 — 지목과 같은 부품(알약·막대·헤더 링·위 한 줄) 위에 올라간다. 아래는 08-15 지목 시험과 같은 틀.
// 08-15: 지목 화면(DAY-04·05, MAP-04). RoomScreen 을 거쳐 GameMap 을 그리고, WorldStage 는 진짜를 쓴다 —
// 이름표 버튼(data-pick)·득표 배지(data-count)·mine 은 WorldStage 가 그리는 DOM 이라서다.
// 런타임(three)만 가짜로 바꿔 건네받은 장면 표(setScene)·손사래(deny)를 기록한다. 런타임이 장면 표를 렌더러에 옮기는 일은 worldStage.test(08-12) 몫이다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

const rt = vi.hoisted(() => ({ scenes: [] as unknown[], denies: [] as number[], created: 0 }));
vi.mock("../../src/world/runtime", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../src/world/runtime")>();
  return {
    ...real,
    createWorldRuntime: () => {
      rt.created += 1;
      return {
        start: () => Promise.resolve(),
        syncPlayers: () => {},
        deny: (seat: number) => rt.denies.push(seat),
        setScene: (look: unknown) => rt.scenes.push(look),
        tap: () => ({ x: 1, z: 1 }),
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
const NOW = 1_700_000_000_000;

interface RunoffOpts {
  step?: 0 | 1 | 2;
  /** 이 단계 마감까지 남은 ms */
  left?: number;
  count?: number;
  mySeat?: number;
  dead?: number[];
  cand?: [number, number];
  voted?: number[];
  tally?: [number, number];
  /** 내가 던진 표(me.ballot) */
  ballot?: number;
  nicknames?: string[];
}

function makeRunoff(o: RunoffOpts = {}): RoomView {
  const count = o.count ?? 5;
  const step = o.step ?? 1;
  const players: PublicPlayer[] = Array.from({ length: count }, (_, seat) => ({
    seat,
    nickname: o.nicknames?.[seat] ?? NAMES[seat] ?? `p${seat}`,
    connected: true,
    isHost: seat === 0,
    ...(o.dead?.includes(seat) ? { alive: false } : {}),
  }));
  const mySeat = o.mySeat ?? 0;
  return {
    code: "0042",
    phase: "runoff",
    phaseEndsAt: NOW + (o.left ?? 5000),
    phaseDurationMs: step === 1 ? 5000 : step === 0 ? 1000 : 1500,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: mySeat, isHost: mySeat === 0, chat: o.dead?.includes(mySeat) ? "ghost" : "all", ...(o.ballot !== undefined ? { ballot: o.ballot } : {}) },
    day: {
      n: 1,
      roles: [],
      runoff: { cand: o.cand ?? [2, 3], step, ...(o.voted !== undefined ? { voted: o.voted } : {}), ...(o.tally !== undefined ? { tally: o.tally } : {}) },
    },
  };
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

const block = (c: ParentNode): HTMLElement | null => c.querySelector("[data-turn-block]");
const ring = (c: ParentNode): HTMLElement | null => c.querySelector(".mv-ring");
const line = (c: ParentNode): string | undefined => c.querySelector(".mf-turn__line.is-on")?.textContent ?? undefined;
const title = (c: ParentNode): string => c.querySelector(".mv-phase__title")?.textContent ?? "";
const hint = (c: ParentNode): string => c.querySelector(".mv-phase__hint")?.textContent ?? "";

beforeEach(() => {
  rt.scenes.length = 0;
  rt.denies.length = 0;
  rt.created = 0;
  installMemoryStorage();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("결선 화면 — 알약·막대·헤더 링·위 한 줄 (UI-SPEC D-1·D-3, 트레이서)", () => {
  it("투표(남은 4.2초): 제목 '결선', 알약에 '결선'·'5초' 두 조각만(이름·n / N 없음), 막대, 표식 tone=calm", () => {
    const { container } = mount(makeRunoff({ left: 4200 }));
    expect(title(container)).toBe("결선");
    const b = block(container)!;
    expect(container.querySelectorAll("[data-turn-block]").length).toBe(1);
    expect(b.getAttribute("data-turn-tone")).toBe("calm");
    expect(b.getAttribute("data-turn-mode")).toBe("runoff");
    expect(b.querySelector(".mf-turn__count")?.textContent).toBe("결선");
    expect(b.querySelector(".mf-turn__sec")?.textContent).toBe("5초");
    expect(b.querySelector(".mf-turn__name")).toBeNull();
    expect(b.textContent).not.toMatch(/\d+ \/ \d+/);
    expect(b.querySelector(".mf-turn__bar")).not.toBeNull();
  });

  it("헤더 링은 알약과 같은 초·같은 색: 마감까지 5초 단계라 시계가 흘러도 calm 이고 링 총합은 5초", () => {
    const { container } = mount(makeRunoff({ left: 4200 }));
    expect(ring(container)!.getAttribute("aria-label")).toBe("남은 시간 5초");
    expect(ring(container)!.classList.contains("is-urgent")).toBe(false);
    advance(1500); // 남은 2.7초 → 3초
    expect(block(container)!.querySelector(".mf-turn__sec")?.textContent).toBe("3초");
    expect(ring(container)!.getAttribute("aria-label")).toBe("남은 시간 3초");
    advance(2000); // 남은 0.7초 → 1초
    expect(block(container)!.querySelector(".mf-turn__sec")?.textContent).toBe("1초");
    expect(block(container)!.getAttribute("data-turn-tone")).toBe("calm");
    expect(ring(container)!.classList.contains("is-urgent")).toBe(false);
  });

  it("막대는 5초 기준 비율: 남은 2.5초 근처에서 폭이 절반 아래로 가고 있다", () => {
    const { container } = mount(makeRunoff({ left: 2500 }));
    const width = parseFloat(((block(container)!.querySelector(".mf-turn__fill") as HTMLElement).style.width || "0"));
    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThanOrEqual(40);
  });

  it("앞머리(step 0): 알약·막대·헤더 링이 없고, 라이브로 들어오면 위 한 줄 '동점이에요'", () => {
    const m = mount(makeRunoff({ step: 0, left: 1000 }));
    expect(title(m.container)).toBe("결선");
    expect(m.container.querySelector(".mf-turn__pill")).toBeNull();
    expect(m.container.querySelector(".mf-turn__bar")).toBeNull();
    expect(ring(m.container)).toBeNull();
  });

  it("지목 끝 알림 → 결선 앞머리: 위 한 줄 '동점이에요' 가 이어서 뜬다", () => {
    const nom = makeRunoff({ step: 0 });
    const m = mount({ ...nom, phase: "nomination", day: { n: 1, roles: [], points: [{ seat: 0, target: 2 }, { seat: 1, target: 3 }, { seat: 2, target: 3 }, { seat: 3, target: 2 }], turn: { order: [0, 1, 2, 3, 4], i: 5 } } });
    expect(line(m.container)).toBeUndefined(); // 처음 마운트 view 의 줄은 만들지 않는다
    m.show(makeRunoff({ step: 0, left: 1000 }));
    expect(line(m.container)).toBe("동점이에요");
  });

  it("지목 끝 알림(동점 둘): 위 한 줄이 '모두 골랐어요' 가 아니라 '동점이에요' 이다", () => {
    const base = (i: number) => ({ order: [0, 1, 2, 3], i });
    const mk = (i: number, points: Array<{ seat: number; target: number }>): RoomView => {
      const v = makeRunoff({ count: 4 });
      return { ...v, phase: "nomination", day: { n: 1, roles: [], points, turn: base(i) } };
    };
    const m = mount(mk(3, []));
    m.show(mk(4, [{ seat: 0, target: 2 }, { seat: 1, target: 3 }, { seat: 2, target: 3 }, { seat: 3, target: 2 }]));
    expect(line(m.container)).toBe("동점이에요");
  });

  it("결과(step 2): 알약 없음, 위 한 줄 '{이름} 님 {k}표' 또는 '또 동점이에요'", () => {
    const m = mount(makeRunoff({ step: 1 }));
    m.show(makeRunoff({ step: 2, left: 1500, tally: [3, 1] }));
    expect(m.container.querySelector(".mf-turn__pill")).toBeNull();
    expect(ring(m.container)).toBeNull();
    expect(line(m.container)).toBe("서준 님 3표");
    m.show(makeRunoff({ step: 2, left: 1500, tally: [2, 2] }));
    expect(line(m.container)).toBe("또 동점이에요");
  });

  it("지목 알약은 그대로: 결선이 아닌 지목 view 의 [data-turn-block] 은 data-turn-mode=pick", () => {
    const v = makeRunoff({ count: 4 });
    const pickView: RoomView = { ...v, phase: "nomination", day: { n: 1, roles: [], points: [], turn: { order: [0, 1, 2, 3], i: 1, endsAt: NOW + 7200 } } };
    const { container } = mount(pickView);
    expect(block(container)!.getAttribute("data-turn-mode")).toBe("pick");
    expect(block(container)!.textContent).toContain("2 / 4");
  });

  it("닉네임은 글자로 그린다: 위 한 줄에 '<b>서준</b>' 이 HTML 이 되지 않는다", () => {
    const nicknames = ["민수", "영희", "<b>서준</b>", "지아", "도윤"];
    const m = mount(makeRunoff({ step: 1, nicknames }));
    m.show(makeRunoff({ step: 2, left: 1500, tally: [3, 1], nicknames }));
    expect(line(m.container)).toBe("<b>서준</b> 님 3표");
    expect(m.container.querySelector(".mf-turn__line b")).toBeNull();
  });
});

describe("결선 화면 — 헤더 안내 (UI-SPEC D-2)", () => {
  it("후보가 아닌 산 사람: 투표 중 '둘 중 한 명을 눌러요', 앞머리·결과에는 안내 없음", () => {
    expect(hint(mount(makeRunoff({ step: 1 })).container)).toBe("둘 중 한 명을 눌러요");
    cleanup();
    expect(hint(mount(makeRunoff({ step: 0, left: 1000 })).container)).toBe("");
  });
  it("후보 본인: '결과를 기다려요'", () => {
    expect(hint(mount(makeRunoff({ step: 1, mySeat: 2 })).container)).toBe("결과를 기다려요");
  });
  it("유령: 기존 '모두의 직업이 보여요'", () => {
    expect(hint(mount(makeRunoff({ step: 1, dead: [0] })).container)).toBe("모두의 직업이 보여요");
  });
  it("앞머리가 끝나 투표가 시작되면 안내가 접혀 있었어도 다시 보인다", () => {
    const m = mount(makeRunoff({ step: 0, left: 1000 }));
    advance(3000);
    m.show(makeRunoff({ step: 1 }));
    const el = m.container.querySelector("[data-guide]") as HTMLElement;
    expect(el.textContent).toBe("둘 중 한 명을 눌러요");
    expect(el.classList.contains("is-folded")).toBe(false);
  });
});

describe("결선 — 막과 레이아웃 연결", () => {
  it("coversNext: 지목 끝 알림의 정확히 둘 동점은 막을 덮지 않고(결선이 이어진다), 결선 결과가 또 동점이면 덮는다", async () => {
    const { coversNext } = await import("../../src/components/SceneCurtain");
    const mkNom = (points: Array<{ seat: number; target: number }>): RoomView => {
      const v = makeRunoff({ count: 4 });
      return { ...v, phase: "nomination", day: { n: 1, roles: [], points, turn: { order: [0, 1, 2, 3], i: 4 } } };
    };
    expect(coversNext(mkNom([{ seat: 0, target: 2 }, { seat: 1, target: 3 }]))).toBe(false);
    expect(coversNext(mkNom([{ seat: 0, target: 1 }, { seat: 1, target: 2 }, { seat: 2, target: 3 }]))).toBe(true);
    expect(coversNext(mkNom([]))).toBe(true);
    expect(coversNext(makeRunoff({ step: 2, tally: [2, 2] }))).toBe(true);
    expect(coversNext(makeRunoff({ step: 2, tally: [3, 1] }))).toBe(false);
    expect(coversNext(makeRunoff({ step: 1 }))).toBe(false);
  });
});

// ---- Task 2: 결선 상호작용 — 이름표 직접 누르기·바꾸기·done 체크·득표 배지·내 캐릭터 가리킴 (UI-SPEC D-2·D-4) ----

const picks = (c: ParentNode): HTMLButtonElement[] => [...c.querySelectorAll<HTMLButtonElement>("[data-pick]")];
const pickOf = (c: ParentNode, seat: number): HTMLButtonElement | null => c.querySelector(`[data-pick="${seat}"]`);
const headOf = (c: ParentNode, seat: number): HTMLElement | null => c.querySelector(`[data-seat="${seat}"] .mv-head`);
const lastScene = (): SceneLook => rt.scenes.at(-1) as SceneLook;

describe("결선 투표 — 후보 이름표 직접 누르기 (UI-SPEC D-2)", () => {
  it("후보가 아닌 산 사람 투표 중: 후보 둘(2·3)만 버튼이고 이름은 '{닉네임} 님에게 투표', 묶음 role=group '결선', 둘 다 깜빡인다", () => {
    const { container } = mount(makeRunoff());
    expect(picks(container).map((b) => b.getAttribute("data-pick"))).toEqual(["2", "3"]);
    expect(pickOf(container, 2)?.getAttribute("aria-label")).toBe("서준 님에게 투표");
    expect(pickOf(container, 3)?.getAttribute("aria-label")).toBe("지아 님에게 투표");
    expect(container.querySelector('[role="group"][aria-label="결선"]')).not.toBeNull();
    expect(container.querySelectorAll(".mv-tag.is-blink").length).toBe(2);
  });

  it("후보 본인, 유령, 앞머리·결과, 연결 끊김에는 버튼이 없다", () => {
    expect(picks(mount(makeRunoff({ mySeat: 2 })).container).length).toBe(0);
    cleanup();
    expect(picks(mount(makeRunoff({ dead: [0] })).container).length).toBe(0);
    cleanup();
    expect(picks(mount(makeRunoff({ step: 0, left: 1000 })).container).length).toBe(0);
    cleanup();
    expect(picks(mount(makeRunoff({ step: 2, left: 1500, tally: [1, 1] })).container).length).toBe(0);
    cleanup();
    expect(picks(mount(makeRunoff(), { canSend: false }).container).length).toBe(0);
    cleanup();
    expect(mount(makeRunoff({ mySeat: 2 })).container.querySelectorAll(".mv-tag.is-blink").length).toBe(0);
  });

  it("후보 2 를 누르면 point {target: 2} 한 번, 그 이름표가 즉시 mine, 내 캐릭터가 후보 2 를 가리킨다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container } = mount(makeRunoff(), { send });
    fireEvent.click(pickOf(container, 2)!);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ t: "point", target: 2 });
    expect(headOf(container, 2)?.getAttribute("data-mine")).toBe("true");
    expect(headOf(container, 3)?.hasAttribute("data-mine")).toBe(false);
    expect(lastScene().seats[0]?.pointAt).toBe(2);
    // 마감까지 버튼은 남는다(바꾸기)
    expect(picks(container).length).toBe(2);
  });

  it("같은 후보를 다시 누르면 보내지 않고, 다른 후보를 누르면 보내 바꾼다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container } = mount(makeRunoff(), { send });
    fireEvent.click(pickOf(container, 3)!);
    fireEvent.click(pickOf(container, 3)!);
    expect(send).toHaveBeenCalledTimes(1);
    fireEvent.click(pickOf(container, 2)!);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith({ t: "point", target: 2 });
    expect(headOf(container, 2)?.getAttribute("data-mine")).toBe("true");
    expect(headOf(container, 3)?.hasAttribute("data-mine")).toBe(false);
    expect(lastScene().seats[0]?.pointAt).toBe(2);
  });

  it("서버 값(me.ballot)이 오면 새로 고침해도 내 선택이 이름표에 남는다(mine)", () => {
    const { container } = mount(makeRunoff({ ballot: 3 }));
    expect(headOf(container, 3)?.getAttribute("data-mine")).toBe("true");
    expect(lastScene().seats[0]?.pointAt).toBe(3);
  });

  it("소켓이 닫혀 못 보냈으면(send false) 표시도 바꾸지 않는다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => false);
    const { container } = mount(makeRunoff(), { send });
    fireEvent.click(pickOf(container, 2)!);
    expect(headOf(container, 2)?.hasAttribute("data-mine")).toBe(false);
  });

  it("마감 직후 눌러 서버가 거절하면 '지금은 고를 수 없어요' 를 띄우고 낙관 표시를 서버 값으로 되돌린다", () => {
    const listeners: Array<(e: { t: "error"; code: string }, meta: { epoch: number }) => void> = [];
    const onEvent = vi.fn((l: (typeof listeners)[number]) => {
      listeners.push(l);
      return () => {};
    }) as unknown as RoomConnection["onEvent"];
    const m = mount(makeRunoff(), { onEvent });
    fireEvent.click(pickOf(m.container, 2)!);
    expect(headOf(m.container, 2)?.getAttribute("data-mine")).toBe("true");
    act(() => listeners.forEach((l) => l({ t: "error", code: "WRONG_PHASE" }, { epoch: 1 })));
    expect(m.container.querySelector(".mv-toast__text")?.textContent).toBe("지금은 고를 수 없어요");
    expect(headOf(m.container, 2)?.hasAttribute("data-mine")).toBe(false);
  });
});

describe("결선 — 던진 사람 done 체크와 득표 배지 (UI-SPEC D-2)", () => {
  it("day.runoff.voted 의 좌석 이름표에만 done 체크가 붙는다. 남의 선택(누가 누구를)은 DOM 어디에도 없다", () => {
    const { container } = mount(makeRunoff({ voted: [1, 4], count: 6 }));
    expect([...container.querySelectorAll("[data-done]")].map((el) => el.closest("[data-seat]")?.getAttribute("data-seat"))).toEqual(["1", "4"]);
    // 후보 이름표는 버튼이지만 남이 누른 흔적(mine)은 내 것만
    expect(container.querySelectorAll("[data-mine]").length).toBe(0);
  });

  it("마감 전(앞머리·투표)에는 후보 머리 위 배지가 지목 때 받은 득표(voteLog)이고, 후보 아닌 사람에게는 배지가 없다", () => {
    const view = makeRunoff();
    const votes = [{ seat: 0, target: 2 }, { seat: 1, target: 3 }, { seat: 2, target: 3 }, { seat: 3, target: 2 }];
    const withLog: RoomView = { ...view, day: { ...view.day!, voteLog: [{ n: 1, exec: { yes: 0, no: 0, passed: false }, cand: { votes } }] } };
    const expected2 = 2;
    const expected3 = 2;
    const { container } = mount(withLog);
    expect(headOf(container, 2)?.getAttribute("data-count")).toBe(String(expected2));
    expect(headOf(container, 3)?.getAttribute("data-count")).toBe(String(expected3));
    expect(headOf(container, 1)?.hasAttribute("data-count")).toBe(false);
  });

  it("결과(step 2): 후보 배지가 결선 득표 tally 로 바뀌고 0표는 배지가 없다. 선두·유력 도장은 없다", () => {
    const { container } = mount(makeRunoff({ step: 2, left: 1500, tally: [3, 0] }));
    expect(headOf(container, 2)?.getAttribute("data-count")).toBe("3");
    expect(headOf(container, 3)?.hasAttribute("data-count")).toBe(false);
    expect(container.querySelector("[data-lead]")).toBeNull();
    expect(container.querySelector("[data-sure]")).toBeNull();
  });
});

describe("결선 — 장면 (UI-SPEC D-1, D-4)", () => {
  it("카메라는 가운데 고정 배율 1, 조명 vote, 핀은 후보 가운데 한 점(전 구간)", () => {
    for (const step of [0, 1, 2] as const) {
      cleanup();
      mount(makeRunoff({ step, ...(step === 2 ? { tally: [1, 1] as [number, number] } : {}) }));
      const look = lastScene();
      expect(look.camera).toEqual({ mode: "fixed", target: { x: 0, z: 0 }, zoom: 1 });
      expect(look.lighting).toBe("vote");
      expect(look.pin).toMatchObject({ mode: "point" });
    }
  });

  it("DOM 어둡게(dimOn): 결선 전 구간 켜짐", () => {
    for (const step of [0, 1, 2] as const) {
      cleanup();
      const { container } = mount(makeRunoff({ step, ...(step === 2 ? { tally: [1, 1] as [number, number] } : {}) }));
      expect(container.querySelector(".mf-game__dim")?.getAttribute("data-dim")).toBe("on");
    }
  });

  it("닉네임은 글자로 그린다: 버튼 이름에 '<b>' 가 HTML 이 되지 않는다", () => {
    const nicknames = ["민수", "영희", "<b>서준</b>", "지아", "도윤"];
    const { container } = mount(makeRunoff({ nicknames }));
    expect(pickOf(container, 2)?.getAttribute("aria-label")).toBe("<b>서준</b> 님에게 투표");
    expect(container.querySelector(".mf-world__tags b")).toBeNull();
  });
});
