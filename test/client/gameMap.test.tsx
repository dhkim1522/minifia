import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { RULESET } from "../../shared/game/ruleset";
import type { ClientMessage, PhaseId, PublicPlayer, RoleRecord, RoomView } from "../../shared/protocol";
import type { WorldStageProps } from "../../src/components/WorldStage";
import { KB_PANEL_H, LOG_H_KB, LOG_H_SHORT, LOG_H_TALL } from "../../src/game/chatUi";
import { bindSignals, type LocalSignal } from "../../src/audio/signals";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 08-13: 낮 시작~처형은 맵(WorldStage) 위 GameMap 한 화면이다. WorldStage 는 받은 props 만 쥐는 가짜로 바꾼다(캔버스·런타임은 worldStage.test 몫).
// RoomScreen 을 거쳐 그려 장면 키("gameMap")까지 함께 본다 — 연결은 반환값을 시험이 정하는 가짜다.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));

const stage = vi.hoisted(() => ({ props: null as null | WorldStageProps, mounts: 0 }));
vi.mock("../../src/components/WorldStage", async () => {
  const { createElement, useEffect } = await import("react");
  return {
    WorldStage: (props: WorldStageProps) => {
      stage.props = props;
      useEffect(() => {
        stage.mounts += 1;
      }, []);
      return createElement("div", { "data-world-stage-fake": "" });
    },
  };
});

const { RoomScreen } = await import("../../src/screens/RoomScreen");

const player = (seat: number, extra: Partial<PublicPlayer> = {}): PublicPlayer => ({
  seat,
  nickname: ["민수", "영희", "서준", "지아", "도윤", "하은", "유진", "태오"][seat] ?? `p${seat}`,
  connected: true,
  isHost: seat === 0,
  ...extra,
});

const NOW = 1_700_000_000_000;

interface ViewOpts {
  phase?: PhaseId;
  /** 일차 (기본 1) */
  n?: number;
  /** 시간 링이 없는 단계처럼 마감이 없는 view */
  noClock?: boolean;
  records?: RoleRecord[];
  verdict?: { yes: number; no: number; passed: boolean };
  candidate?: number;
  nicknames?: string[];
  /** 좌석별 생존. 기본 모두 산다 */
  dead?: number[];
  count?: number;
  mySeat?: number;
  endCount?: number;
  pressed?: boolean;
}

function makeView(o: ViewOpts = {}): RoomView {
  const count = o.count ?? 4;
  const mySeat = o.mySeat ?? 0;
  const players = Array.from({ length: count }, (_, seat) =>
    player(seat, { ...(o.dead?.includes(seat) ? { alive: false } : {}), ...(o.nicknames?.[seat] !== undefined ? { nickname: o.nicknames[seat]! } : {}) }),
  );
  return {
    code: "0042",
    phase: o.phase ?? "discussion",
    phaseEndsAt: o.noClock ? null : NOW + 90_000,
    phaseDurationMs: o.noClock ? null : 90_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: mySeat, isHost: mySeat === 0, chat: o.dead?.includes(mySeat) ? "ghost" : "all", ...(o.pressed ? { endDiscussion: true as const } : {}), ...(o.records ? { records: o.records } : {}) },
    day: {
      n: o.n ?? 1,
      roles: [],
      ...(o.endCount !== undefined ? { endCount: o.endCount } : {}),
      ...(o.verdict ? { verdict: o.verdict } : {}),
      ...(o.candidate !== undefined ? { candidate: o.candidate } : {}),
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
    send: vi.fn(),
    onEvent: vi.fn(() => () => {}),
    reconnect: vi.fn(),
    retry: vi.fn(),
    ...over,
  };
}

const mount = (view: RoomView, over: Partial<RoomConnection> = {}, onExit: (r: string) => void = () => {}) => {
  connectionMock.current = conn(view, over);
  const ui = () => <RoomScreen code="0042" token={"t".repeat(43)} onExit={onExit} />;
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

const endButton = (c: ParentNode): HTMLButtonElement | null => c.querySelector("[data-end-discussion]");
const countParts = (c: ParentNode): [number, number] => {
  const m = /^(\d+) \/ (\d+)$/.exec(c.querySelector(".mv-count")?.textContent ?? "");
  return m ? [Number(m[1]), Number(m[2])] : [-1, -1];
};
const countNow = (c: ParentNode): number => countParts(c)[0];
const countMax = (c: ParentNode): number => countParts(c)[1];

beforeEach(() => {
  stage.mounts = 0;
});
afterEach(() => {
  cleanup();
  stage.props = null;
});

describe("GameMap — 낮 토론 [토론 끝내기] (DAY-03, 08-13)", () => {
  it("산 사람의 낮 토론은 루트가 data-game-stage·data-phase 이고 [토론 끝내기] 가 하나이며 점 total = 산 사람의 과반 수", () => {
    const { container } = mount(makeView({ count: 5 }));
    const root = container.querySelector("main.mf-game") as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.hasAttribute("data-game-stage")).toBe(true);
    expect(root.getAttribute("data-phase")).toBe("discussion");
    expect(root.querySelector("[data-world-stage-fake]")).not.toBeNull();
    expect(container.querySelectorAll("[data-end-discussion]").length).toBe(1);
    expect(endButton(container)?.getAttribute("aria-label")).toBe("토론 끝내기");
    expect(endButton(container)?.getAttribute("aria-pressed")).toBe("false");
    // 5명 → 과반 3
    expect(countMax(container)).toBe(3);
    expect(countNow(container)).toBe(0);
  });

  it("과반 수는 산 사람 수로 센다: 8명 중 3명이 죽어 5명이면 3, 2명이면 2", () => {
    const eight = mount(makeView({ count: 8, dead: [5, 6, 7] }));
    expect(countMax(eight.container)).toBe(3);
    eight.unmount();
    const two = mount(makeView({ count: 4, dead: [2, 3] }));
    expect(countMax(two.container)).toBe(2);
  });

  it("누르면 endDiscussion {on: true} 를 한 번 보내고 내 눌림(aria-pressed)만 즉시 바뀐다 — 숫자는 서버가 센 값 그대로", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container } = mount(makeView(), { send });
    fireEvent.click(endButton(container)!);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ t: "endDiscussion", on: true });
    expect(endButton(container)?.getAttribute("aria-pressed")).toBe("true");
    expect(countNow(container)).toBe(0);
    // 다시 누르면 취소
    fireEvent.click(endButton(container)!);
    expect(send).toHaveBeenLastCalledWith({ t: "endDiscussion", on: false });
    expect(endButton(container)?.getAttribute("aria-pressed")).toBe("false");
  });

  it("서버 view(endCount 1, me.endDiscussion true)가 오면 숫자가 1 로 바뀌고 눌림이 서버 값을 따른다", () => {
    const m = mount(makeView());
    expect(countNow(m.container)).toBe(0);
    m.show(makeView({ endCount: 1, pressed: true }));
    expect(countNow(m.container)).toBe(1);
    expect(endButton(m.container)?.getAttribute("aria-pressed")).toBe("true");
  });

  it("서버가 눌림을 되돌린 view 를 보내면 내가 낙관적으로 바꾼 눌림도 서버 값으로 돌아온다", () => {
    const m = mount(makeView());
    fireEvent.click(endButton(m.container)!);
    expect(endButton(m.container)?.getAttribute("aria-pressed")).toBe("true");
    m.show(makeView({ endCount: 0 }));
    expect(endButton(m.container)?.getAttribute("aria-pressed")).toBe("false");
  });

  it("소켓이 닫혀 보내지 못하면(send false) 눌림을 바꾸지 않는다", () => {
    const send = vi.fn(() => false);
    const { container } = mount(makeView(), { send });
    fireEvent.click(endButton(container)!);
    expect(send).toHaveBeenCalledTimes(1);
    expect(endButton(container)?.getAttribute("aria-pressed")).toBe("false");
  });

  it("끊긴 동안(canSend 거짓) 버튼은 aria-disabled 이고 눌러도 보내지 않는다", () => {
    const send = vi.fn();
    const { container } = mount(makeView(), { send, canSend: false });
    const btn = endButton(container)!;
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(btn);
    expect(send).not.toHaveBeenCalled();
  });

  it("유령(탈락)에게는 행동 줄이 없고 채팅만 있다", () => {
    const { container } = mount(makeView({ dead: [0] }));
    expect(endButton(container)).toBeNull();
    expect(container.querySelector(".mf-act-row")).toBeNull();
    expect(container.querySelector(".mv-chat")).not.toBeNull();
  });

  it("낮 토론이 아닌 단계(낮 시작·지목)에는 [토론 끝내기] 가 없다", () => {
    for (const phase of ["dayAnnounce", "nomination", "defense", "verdict", "execution"] as const) {
      const { container, unmount } = mount(makeView({ phase }));
      expect(endButton(container)).toBeNull();
      unmount();
    }
  });

  it("다른 사람의 토론 끝내기 여부는 그리지 않는다 — 개수 숫자만 있고 이름표에 넘기는 속성도 없다", () => {
    const { container } = mount(makeView({ count: 6, endCount: 2 }));
    expect(countNow(container)).toBe(2);
    expect(countMax(container)).toBe(4);
    expect(stage.props?.tagProps).toBeUndefined();
    expect(stage.props?.pick).toBeUndefined();
  });

  it("보내는 메시지에는 신원 필드가 없다(on 하나뿐)", () => {
    const send = vi.fn();
    const { container } = mount(makeView(), { send });
    fireEvent.click(endButton(container)!);
    expect(Object.keys(send.mock.calls[0]![0] as object).sort()).toEqual(["on", "t"]);
  });
});

describe("GameMap — 한 장면 키 (DAY-07, 08-13)", () => {
  it("낮 시작 → 토론 → 지목 → 최후 변론 → 찬반 → 처형: [data-world-stage-fake] 가 같은 노드이고 다시 마운트되지 않는다", () => {
    const m = mount(makeView({ phase: "dayAnnounce" }));
    const node = m.container.querySelector("[data-world-stage-fake]");
    expect(node).not.toBeNull();
    for (const phase of ["discussion", "nomination", "defense", "verdict", "execution"] as const) {
      m.show(makeView({ phase }));
      expect(m.container.querySelector("[data-world-stage-fake]")).toBe(node);
      expect((m.container.querySelector("main.mf-game") as HTMLElement).getAttribute("data-phase")).toBe(phase);
    }
    expect(stage.mounts).toBe(1);
  });

  it("여섯 단계 어디에도 v1.0 고정 테이블(.mf-dt)을 대신 그리지 않는다", () => {
    for (const phase of ["dayAnnounce", "discussion", "nomination", "defense", "verdict", "execution"] as const) {
      const { container, unmount } = mount(makeView({ phase }));
      expect(container.querySelector(".mf-dt")).toBeNull();
      expect(container.querySelector("main.mf-game")).not.toBeNull();
      unmount();
    }
  });

  it("DOM 순서는 헤더 → 맵 → 아래 패널이다(Tab 순서)", () => {
    const { container } = mount(makeView());
    const header = container.querySelector(".mf-game__header") as HTMLElement;
    const world = container.querySelector("[data-world-stage-fake]") as HTMLElement;
    const panel = container.querySelector(".mf-game__panel") as HTMLElement;
    expect(header.compareDocumentPosition(world) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(world.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("맵을 쓸 수 없는 기기의 불가 카드 [처음으로] 는 방을 떠난다(onExit gaveUp) — 옛 테이블 화면으로 대신하지 않는다", () => {
    const onExit = vi.fn();
    mount(makeView(), {}, onExit);
    act(() => stage.props?.onLeave());
    expect(onExit).toHaveBeenCalledWith("gaveUp");
  });
});

// ---- 08-13 Task 2: 헤더·패널 측정 + 키보드 (useMapInsets, 07-19 규칙 유지) ----
describe("GameMap — 스테이지 사각형 측정과 키보드 (CHAT-05, 08-13)", () => {
  const INNER_H = 844;
  const realInnerH = window.innerHeight;
  const DISCUSSION_PANEL_H = LOG_H_TALL + 154;
  let panelH = DISCUSSION_PANEL_H;
  let resizeCallbacks: Array<() => void> = [];

  interface FakeVV extends EventTarget {
    height: number;
    offsetTop: number;
  }
  const installVV = (height: number, offsetTop = 0): FakeVV => {
    const vv = Object.assign(new EventTarget(), { height, offsetTop }) as FakeVV;
    Object.defineProperty(window, "visualViewport", { value: vv, configurable: true, writable: true });
    return vv;
  };
  /** 패널·헤더의 높이를 DOM 대신 값으로 돌려준다(happy-dom 은 레이아웃이 없다) */
  const stubLayout = () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("mf-game__panel")) return panelH;
      if (this.classList.contains("mf-game__header")) return 62;
      if (this.classList.contains("mf-turn__bar")) return 4;
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
  };
  const remeasure = () => act(() => void resizeCallbacks.forEach((cb) => cb()));
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  const inputOf = (c: ParentNode) => c.querySelector("[data-chat-input]") as HTMLInputElement;
  const gameOf = (c: ParentNode) => c.querySelector("main.mf-game") as HTMLElement;
  const logHeight = (c: ParentNode) => (c.querySelector("[data-chat-log]") as HTMLElement).style.height;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "innerHeight", { value: INNER_H, configurable: true, writable: true });
    panelH = DISCUSSION_PANEL_H;
    resizeCallbacks = [];
    stubLayout();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Object.defineProperty(window, "innerHeight", { value: realInnerH, configurable: true, writable: true });
    Reflect.deleteProperty(window, "visualViewport");
  });

  const focusWithKeyboard = (container: ParentNode, vv: FakeVV, lift: number) => {
    act(() => inputOf(container).focus());
    vv.height = INNER_H - lift;
    vv.offsetTop = 0;
    act(() => void vv.dispatchEvent(new Event("resize")));
    advance(20);
  };

  it("헤더 아래 끝과 패널 높이를 재서 WorldStage stageInsets 로 넘긴다", () => {
    const { container } = mount(makeView());
    expect(container.querySelector(".mf-game__header")).not.toBeNull();
    expect(stage.props?.stageInsets).toEqual({ top: 62, bottom: DISCUSSION_PANEL_H });
  });

  // 09.1-08: 지목 동안 스테이지 윗변 = 차례 알약·막대 아랫변 + 4 (UI-SPEC A-1). 요소 위치는 offsetTop 으로 돌려준다
  const nominationTurn = (i: number): RoomView => {
    const v = makeView({ phase: "nomination" });
    return { ...v, day: { ...v.day!, points: [], turn: { order: [0, 1, 2, 3], i, ...(i >= 0 ? { endsAt: NOW + 8000 } : {}) } } };
  };
  const stubTurnTops = (blockTop: number, barTop: number) =>
    vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("mf-turn")) return blockTop;
      if (this.classList.contains("mf-turn__bar")) return barTop;
      return 0;
    });

  it("지목 차례 중: 알약·막대 아랫변(100 + 56 + 4 = 160) + 4 = 164 가 스테이지 윗변이다", () => {
    panelH = 244;
    stubTurnTops(100, 56);
    mount(nominationTurn(0));
    expect(stage.props?.stageInsets).toEqual({ top: 164, bottom: 244 });
  });

  it("지목 모이는 중(막대 아직 없음): 기본 알약 아랫변 160 → 164, 압축이면 124 → 128", () => {
    panelH = 244;
    const a = mount(nominationTurn(-1));
    expect(stage.props?.stageInsets).toEqual({ top: 164, bottom: 244 });
    a.unmount();
    Object.defineProperty(window, "innerHeight", { value: 560, configurable: true, writable: true });
    panelH = 188;
    mount(nominationTurn(-1));
    expect(stage.props?.stageInsets).toEqual({ top: 128, bottom: 188 });
  });

  it("압축형(360×560)에서 측정한 막대 아랫변(72 + 48 + 4 = 124) + 4 = 128", () => {
    Object.defineProperty(window, "innerHeight", { value: 560, configurable: true, writable: true });
    panelH = 188;
    stubTurnTops(72, 48);
    mount(nominationTurn(1));
    expect(stage.props?.stageInsets).toEqual({ top: 128, bottom: 188 });
  });

  it("지목이 끝나 변론으로 가면 헤더 아래(62)로 돌아온다", () => {
    panelH = 244;
    stubTurnTops(100, 56);
    const m = mount(nominationTurn(0));
    expect(stage.props?.stageInsets?.top).toBe(164);
    m.show(makeView({ phase: "defense" }));
    expect(stage.props?.stageInsets?.top).toBe(62);
  });

  it("패널이 자라면(ResizeObserver) 스테이지 아래 끝이 따라간다", () => {
    mount(makeView());
    panelH = LOG_H_TALL + 92;
    remeasure();
    expect(stage.props?.stageInsets).toEqual({ top: 62, bottom: LOG_H_TALL + 92 });
  });

  it("키보드 열림(포커스 + lift 336): data-kb-open, 행동 줄([토론 끝내기]) 없음, 기록 칸 72, 패널 --kb, 스테이지 아래 = 150 + 336", () => {
    const vv = installVV(INNER_H);
    const { container } = mount(makeView());
    expect(endButton(container)).not.toBeNull();
    focusWithKeyboard(container, vv, 336);
    panelH = KB_PANEL_H;
    remeasure();
    expect(gameOf(container).getAttribute("data-kb-open")).toBe("true");
    expect(endButton(container)).toBeNull();
    expect(logHeight(container)).toBe(`${LOG_H_KB}px`);
    expect(container.querySelector(".mv-chat.is-compact")).not.toBeNull();
    expect(container.querySelector(".mf-game__panel")?.classList.contains("mf-game__panel--kb")).toBe(true);
    expect(stage.props?.stageInsets).toEqual({ top: 62, bottom: KB_PANEL_H + 336 });
  });

  it("키보드 열림 경계(lift 60) 아래에서는 행동 줄이 그대로 있고, 블러하면 원래대로 돌아온다", () => {
    const vv = installVV(INNER_H);
    const { container } = mount(makeView());
    focusWithKeyboard(container, vv, 60);
    expect(gameOf(container).hasAttribute("data-kb-open")).toBe(false);
    expect(endButton(container)).not.toBeNull();
    focusWithKeyboard(container, vv, 336);
    panelH = KB_PANEL_H;
    remeasure();
    expect(endButton(container)).toBeNull();
    act(() => inputOf(container).blur());
    panelH = DISCUSSION_PANEL_H;
    remeasure();
    expect(gameOf(container).hasAttribute("data-kb-open")).toBe(false);
    expect(endButton(container)).not.toBeNull();
    expect(logHeight(container)).toBe(`${LOG_H_TALL}px`);
    expect(stage.props?.stageInsets).toEqual({ top: 62, bottom: DISCUSSION_PANEL_H });
  });

  it("기록 칸 높이는 방 높이로 한 번 정한다: 방 높이 844 → 152, 짧은 방 → 96", () => {
    const { container } = mount(makeView());
    expect([LOG_H_TALL, LOG_H_SHORT]).toContain(Number.parseInt(logHeight(container), 10));
  });
});

// ---- 08-13 Task 3: 헤더·[역할 카드]·결과 알림·낮 시작 연출·탭 차단·거절 (DAY-07, MAP-04, E1 #4, E5) ----
describe("GameMap — 헤더·[역할 카드] (UI-SPEC A2)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  // 14-02(U-2·U-3, TOOL-02): 기본판 헤더는 제목 + [역할 카드] 뿐이다. 안내 줄은 자막 띠가, 남은 시간은 띠의 막대 + 초가 맡는다.
  it("기본판 낮 토론 산 사람: 헤더는 제목 '낮 토론' + [역할 카드] 뿐 — 안내 줄·시간 링·타이머가 없다", () => {
    const { container } = mount(makeView());
    const header = container.querySelector(".mf-game__header") as HTMLElement;
    expect(header.querySelector(".mv-phase__title")?.textContent).toBe("낮 토론");
    expect(header.querySelectorAll(".mv-phase__title").length).toBe(1);
    expect(header.querySelector(".mv-phase__hint")).toBeNull();
    expect(header.querySelector(".mv-ring")).toBeNull();
    expect(header.querySelector('[role="timer"]')).toBeNull();
    expect(header.querySelectorAll("button").length).toBe(1);
    expect(header.querySelector("[data-guide]")).toBeNull();
  });

  it("기본판 단계 전부(낮 시작·토론·투표·변론·찬반·처형·밤·아침), 산 사람·유령 모두: 헤더에 안내 줄·시간 링·타이머가 없다", () => {
    for (const phase of ["dayAnnounce", "discussion", "nomination", "defense", "verdict", "execution", "night", "morning"] as const) {
      for (const dead of [[], [0]] as const) {
        const { container, unmount } = mount(makeView({ phase, candidate: 1, dead: [...dead] }));
        const header = container.querySelector(".mf-game__header") as HTMLElement;
        const cell = `${phase}/${dead.length === 0 ? "산 사람" : "유령"}`;
        expect(header.querySelectorAll(".mv-phase__title").length, `${cell}: 제목`).toBe(1);
        expect(header.querySelector(".mv-phase__hint"), `${cell}: 안내 줄`).toBeNull();
        expect(header.querySelector(".mv-ring"), `${cell}: 시간 링`).toBeNull();
        expect(header.querySelector('[role="timer"]'), `${cell}: 타이머`).toBeNull();
        unmount();
      }
    }
  });

  it("낮 시작에는 시간 링이 없다", () => {
    const { container } = mount(makeView({ phase: "dayAnnounce" }));
    expect(container.querySelector('.mf-game__header [role="timer"]')).toBeNull();
  });

  it("기본판 유령(탈락) 헤더에도 '모두의 직업이 보여요' 안내 줄은 없다 — 띠가 유령 줄을 말한다", () => {
    const { container } = mount(makeView({ dead: [0] }));
    expect(container.querySelector(".mv-phase__hint")).toBeNull();
    expect(container.textContent).not.toContain("모두의 직업이 보여요");
  });

  it("[내 역할] 은 아이콘 아래 한 단어 이름표 단추이고 헤더 오른쪽 끝(.mv-phase__side)에 홀로 놓인다 — aria-label '내 역할' (TOOL-01 6)", () => {
    const { container } = mount(makeView());
    const btn = container.querySelector(".mf-game__header button") as HTMLButtonElement;
    expect(btn.getAttribute("aria-label")).toBe("내 역할");
    expect(btn.getAttribute("data-tool-label")).toBe("내 역할");
    expect(btn.textContent).toBe("내 역할");
    expect(btn.querySelector("svg")).not.toBeNull();
    expect(btn.parentElement?.classList.contains("mv-phase__side")).toBe(true);
    expect(container.querySelector('.mf-game__header [role="timer"]')).toBeNull();
    // 헤더가 맵보다 DOM 앞이라 Tab 순서가 [내 역할] → 이름표 → 입력이다
    expect(container.querySelectorAll("button[aria-label='내 역할']").length).toBe(1);
  });

  it("안 읽은 일지가 있으면 이름이 '내 역할, 새 기록' 이고 gray-100 점이 붙는다(앰버 아님)", () => {
    const { container } = mount(makeView({ records: [{ n: 1, target: 1, isMafia: false }] }));
    const btn = container.querySelector(".mf-game__header button") as HTMLButtonElement;
    expect(btn.getAttribute("aria-label")).toBe("내 역할, 새 기록");
    expect(btn.querySelector(".mf-rolecard-btn__dot")).not.toBeNull();
    const css = readFileSync("src/styles/rolecard.css", "utf8");
    expect(css).toMatch(/\.mf-rolecard-btn__dot[^}]*var\(--gray-100\)/);
  });

  it("눌러 열면 역할 카드 시트가 열린다", () => {
    const { container } = mount(makeView());
    fireEvent.click(container.querySelector(".mf-game__header button")!);
    expect(document.querySelector('dialog[aria-label="역할 카드"]')).not.toBeNull();
  });
});

describe("GameMap — 지목 어둡게 막 (09.1-07, UI-SPEC A-1)", () => {
  const withTurn = (i: number): RoomView => {
    const v = makeView({ phase: "nomination" });
    return { ...v, day: { ...v.day!, points: [], turn: { order: [0, 1, 2, 3], i, ...(i >= 0 && i < 4 ? { endsAt: NOW + 8000 } : {}) } } };
  };
  const dimOf = () => {
    const { container } = render(<>{stage.props?.underlay}</>);
    return container.querySelector(".mf-game__dim");
  };

  it("지목 모이기·차례 동안 장면 층에 data-dim=on, 끝 알림은 off", () => {
    for (const [i, dim] of [[-1, "on"], [0, "on"], [3, "on"], [4, "off"]] as const) {
      const { unmount } = mount(withTurn(i));
      const el = dimOf();
      expect(`${i}:${el?.getAttribute("data-dim")}`).toBe(`${i}:${dim}`);
      expect(el?.getAttribute("aria-hidden")).toBe("true");
      unmount();
    }
  });

  it("낮 토론에서는 막이 꺼져 있다", () => {
    mount(makeView());
    expect(dimOf()?.getAttribute("data-dim")).toBe("off");
  });
});

describe("GameMap — 이동 차단 canWalk (MAP-04)", () => {
  it("산 사람은 낮 시작·토론에서만 걷고 지목·변론·찬반·처형에서는 막힌다", () => {
    const expected: Record<string, boolean> = { dayAnnounce: true, discussion: true, nomination: false, defense: false, verdict: false, execution: false };
    for (const [phase, can] of Object.entries(expected)) {
      const { unmount } = mount(makeView({ phase: phase as PhaseId }));
      expect(`${phase}:${stage.props?.canWalk}`).toBe(`${phase}:${can}`);
      unmount();
    }
  });

  it("유령은 모든 단계에서 걷는다", () => {
    for (const phase of ["dayAnnounce", "discussion", "nomination", "defense", "verdict", "execution"] as const) {
      const { unmount } = mount(makeView({ phase, dead: [0] }));
      expect(`${phase}:${stage.props?.canWalk}`).toBe(`${phase}:true`);
      unmount();
    }
  });

  it("장면 표(scene)를 넘긴다: 낮 토론은 따라가기 카메라와 talk 조명", () => {
    mount(makeView());
    expect(stage.props?.scene?.camera).toEqual({ mode: "follow" });
    expect(stage.props?.scene?.lighting).toBe("talk");
  });
});

describe("GameMap — 낮 시작 결과 알림과 채팅 줄 (E5 #17~#19)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  const announces = (c: ParentNode) => Array.from(c.querySelectorAll("[data-announce]"));
  const logText = (c: ParentNode) => c.querySelector("[data-chat-log]")?.textContent ?? "";

  it("밤에서 낮 시작으로 들어오면 36px '낮이 되었습니다' 알림은 없고(U-5 띠가 대신 말한다) 채팅 시스템 줄 '2일차' 는 나온다", () => {
    const m = mount(makeView({ phase: "night", n: 1 }));
    expect(announces(m.container).length).toBe(0);
    m.show(makeView({ phase: "dayAnnounce", n: 2, noClock: true }));
    expect(announces(m.container).length).toBe(0);
    expect(logText(m.container)).toContain("2일차");
    advance(2000);
    expect(announces(m.container).length).toBe(0);
  });

  it("처음 받은 스냅샷이 낮 시작이면(재접속·새로 고침) 알림도 '일차' 줄도 없다", () => {
    const { container } = mount(makeView({ phase: "dayAnnounce", n: 2, noClock: true }));
    expect(announces(container).length).toBe(0);
    expect(logText(container)).not.toContain("2일차");
  });

  it("연결 번호(epoch)가 바뀐 첫 낮 시작 스냅샷도 이펙트 없이 정상 상태로 그린다", () => {
    const m = mount(makeView({ phase: "night" }));
    m.show(makeView({ phase: "dayAnnounce", n: 2, noClock: true }), { epoch: 2 });
    expect(announces(m.container).length).toBe(0);
    expect(logText(m.container)).not.toContain("2일차");
  });

  it("알림은 한 번에 하나다: 판결 앞머리 600ms 뒤 찬반 결과 알림, 그 뒤 2000ms 에 '처형 없음' 이 이전 알림을 바꾼다", () => {
    const m = mount(makeView({ phase: "verdict", candidate: 1 }));
    m.show(makeView({ phase: "execution", candidate: 1, verdict: { yes: 2, no: 3, passed: false } }));
    expect(announces(m.container).length).toBe(0);
    advance(600);
    expect(announces(m.container).map((e) => e.textContent)).toEqual(["찬성 2 · 반대 3"]);
    advance(2000);
    expect(announces(m.container).map((e) => e.textContent)).toEqual(["처형 없음"]);
  });

  it("알림 문자열은 텍스트 노드다: 닉네임 '<b>영희</b>' 가 HTML 이 아니라 글자로 보인다", () => {
    const names = ["민수", "<b>영희</b>", "서준", "지아"];
    const m = mount(makeView({ phase: "verdict", candidate: 1, nicknames: names }));
    m.show(makeView({ phase: "execution", candidate: 1, nicknames: names, verdict: { yes: 3, no: 0, passed: true } }));
    advance(2600);
    const el = announces(m.container)[0]!;
    expect(el.textContent).toBe("<b>영희</b> 님 처형");
    expect(el.querySelector("b")).toBeNull();
  });

  it("결과가 없으면 알림 요소를 만들지 않는다", () => {
    const { container } = mount(makeView());
    expect(container.querySelector("[data-announce]")).toBeNull();
  });

  it("알림 CSS: 위 240·36px 한 줄(keep-all, 28px 로 줄이지 않음)·뒤 night-950 62% 어둡게·움직임 줄이기", () => {
    const css = readFileSync("src/styles/game.css", "utf8");
    expect(css).toMatch(/\.mf-announce\s*\{[^}]*240px/);
    expect(css).toMatch(/\.mf-announce__text\s*\{[^}]*font-size:\s*36px/);
    expect(css).toMatch(/keep-all/);
    expect(css).not.toMatch(/font-size:\s*28px/);
    expect(css).toContain("color-mix(in srgb, var(--night-950) 62%, transparent)");
    expect(css).toMatch(/prefers-reduced-motion/);
  });
});

describe("GameMap — 거절과 끊김 (E1 #4)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());
  const toastText = (c: ParentNode) => c.querySelector(".mv-toast__text")?.textContent ?? "";

  it("토론 끝내기가 거절되면(WRONG_PHASE) 위 알림 '지금은 고를 수 없어요' 뒤 눌림이 서버 값(눌리지 않음)으로 돌아온다", () => {
    // 방 화면과 맵 화면이 각각 구독한다 — 모든 구독자에게 같은 프레임을 보낸다
    const listeners: Array<(e: { t: "error"; code: string }, meta: { epoch: number }) => void> = [];
    const onEvent = vi.fn((l: (typeof listeners)[number]) => {
      listeners.push(l);
      return () => {};
    });
    const listener = (e: { t: "error"; code: string }, meta: { epoch: number }) => listeners.forEach((l) => l(e, meta));
    const { container } = mount(makeView(), { onEvent: onEvent as unknown as RoomConnection["onEvent"] });
    fireEvent.click(endButton(container)!);
    expect(endButton(container)?.getAttribute("aria-pressed")).toBe("true");
    act(() => listener({ t: "error", code: "WRONG_PHASE" }, { epoch: 1 }));
    expect(toastText(container)).toBe("지금은 고를 수 없어요");
    expect(endButton(container)?.getAttribute("aria-pressed")).toBe("false");
  });

  it("그 밖의 오류(RATE_LIMITED)는 알림도 되돌림도 만들지 않는다", () => {
    // 방 화면과 맵 화면이 각각 구독한다 — 모든 구독자에게 같은 프레임을 보낸다
    const listeners: Array<(e: { t: "error"; code: string }, meta: { epoch: number }) => void> = [];
    const onEvent = vi.fn((l: (typeof listeners)[number]) => {
      listeners.push(l);
      return () => {};
    });
    const listener = (e: { t: "error"; code: string }, meta: { epoch: number }) => listeners.forEach((l) => l(e, meta));
    const { container } = mount(makeView(), { onEvent: onEvent as unknown as RoomConnection["onEvent"] });
    fireEvent.click(endButton(container)!);
    act(() => listener({ t: "error", code: "RATE_LIMITED" }, { epoch: 1 }));
    expect(toastText(container)).toBe("");
    expect(endButton(container)?.getAttribute("aria-pressed")).toBe("true");
  });
});

// 12-10: 거절 알림(토스트)이 뜨는 네 지점이 각각 값 없는 deny 신호를 보낸다 (LS-7)
describe("GameMap — 거절 알림의 소리 신호 (12-10, ui.deny)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());
  const errFeed = () => {
    const listeners: Array<(e: { t: "error"; code: string }, meta: { epoch: number }) => void> = [];
    const onEvent = vi.fn((l: (typeof listeners)[number]) => {
      listeners.push(l);
      return () => {};
    });
    return {
      onEvent: onEvent as unknown as RoomConnection["onEvent"],
      error: (code: string) => act(() => listeners.forEach((l) => l({ t: "error", code }, { epoch: 1 }))),
    };
  };
  const withSignals = (): { seen: LocalSignal[]; stop: () => void } => {
    const seen: LocalSignal[] = [];
    return { seen, stop: bindSignals((s) => seen.push(s)) };
  };
  const nominationMine = (): RoomView => {
    const v = makeView({ phase: "nomination" });
    return { ...v, day: { ...v.day!, points: [], turn: { order: [0, 1, 2, 3], i: 0, endsAt: NOW + 8000 } } };
  };
  const denies = (seen: LocalSignal[]): LocalSignal[] => seen.filter((s) => s.kind === "deny");

  it("① 그 밖의 거절(토론 끝내기 WRONG_PHASE): deny 한 번 · 속도 제한 오류는 없음", () => {
    const f = errFeed();
    const { container } = mount(makeView(), { onEvent: f.onEvent });
    const sig = withSignals();
    fireEvent.click(endButton(container)!);
    f.error("RATE_LIMITED");
    expect(denies(sig.seen)).toEqual([]);
    f.error("WRONG_PHASE");
    sig.stop();
    expect(denies(sig.seen)).toEqual([{ kind: "deny" }]);
  });

  it("② 지목 거절(SEND_FAIL/REJECT 알림): deny 한 번", () => {
    const f = errFeed();
    mount(nominationMine(), { onEvent: f.onEvent });
    const sig = withSignals();
    act(() => stage.props!.pick!.onPick(2));
    f.error("WRONG_PHASE");
    sig.stop();
    expect(denies(sig.seen)).toEqual([{ kind: "deny" }]);
  });

  // 기본판(결정 0072)에서 꺼짐 — RULESET.badge·whisper 를 켜면 다시 돈다(떠 있는 버튼이 있어야 성립한다)
  it.skipIf(!RULESET.badge)("③ 직업 배지 거절: deny 한 번", () => {
    const f = errFeed();
    const { container } = mount(makeView({ count: 6 }), { onEvent: f.onEvent });
    const sig = withSignals();
    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-float="claim"]')!);
    const chip = [...container.querySelectorAll<HTMLButtonElement>(".mv-claim-sheet .mv-claim-chip")].find((b) => b.textContent === "의사")!;
    fireEvent.click(chip);
    f.error("WRONG_PHASE");
    sig.stop();
    expect(denies(sig.seen)).toEqual([{ kind: "deny" }]);
  });

  it.skipIf(!RULESET.whisper)("④ 귓속말 거절: deny 한 번", () => {
    const f = errFeed();
    const { container } = mount(makeView(), { onEvent: f.onEvent });
    const sig = withSignals();
    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-float="whisper"]')!);
    act(() => stage.props!.pick!.onPick(2));
    fireEvent.change(container.querySelector<HTMLInputElement>("[data-line-input]")!, { target: { value: "비밀이에요" } });
    fireEvent.click(container.querySelector<HTMLButtonElement>("[data-line-send]")!);
    f.error("WRONG_PHASE");
    sig.stop();
    expect(denies(sig.seen)).toEqual([{ kind: "deny" }]);
  });
});

// 12-10: 받은 동작 프레임이 몸 동작 재생 자리에서 emote 신호 하나를 만든다 (LS-4)
describe("RoomScreen — 동작 프레임의 소리 신호 (12-10)", () => {
  const feed = () => {
    const listeners: Array<(e: never, meta: { epoch: number }) => void> = [];
    const onEvent = vi.fn((l: (typeof listeners)[number]) => {
      listeners.push(l);
      return () => {};
    });
    return { onEvent: onEvent as unknown as RoomConnection["onEvent"], emit: (e: unknown, epoch = 1) => act(() => listeners.forEach((l) => l(e as never, { epoch }))) };
  };
  const collect = () => {
    const seen: LocalSignal[] = [];
    return { seen, stop: bindSignals((s) => seen.push(s)) };
  };

  it("남이 보낸 프레임 하나가 {kind:emote, id, mine:false} 하나, 내 좌석 프레임은 mine:true", () => {
    const f = feed();
    mount(makeView(), { onEvent: f.onEvent });
    const sig = collect();
    f.emit({ t: "emote", seat: 2, id: "clap", n: 1 });
    f.emit({ t: "emote", seat: 0, id: "cry", n: 2 });
    sig.stop();
    expect(sig.seen).toEqual([
      { kind: "emote", id: "clap", mine: false },
      { kind: "emote", id: "cry", mine: true },
    ]);
  });

  it("world·chat·typing 프레임은 emote 신호가 없다", () => {
    const f = feed();
    mount(makeView(), { onEvent: f.onEvent });
    const sig = collect();
    f.emit({ t: "typing", seat: 2, on: true });
    f.emit({ t: "chat", seat: 2, ch: "all", seq: 1, text: "안녕", at: NOW });
    f.emit({ t: "world", k: "snap", at: NOW, ents: [] });
    sig.stop();
    expect(sig.seen.filter((s) => s.kind === "emote")).toEqual([]);
  });

  it("신호에는 id 와 mine 불리언뿐이다 (좌석·시각 없음)", () => {
    const f = feed();
    mount(makeView(), { onEvent: f.onEvent });
    const sig = collect();
    f.emit({ t: "emote", seat: 3, id: "dance", n: 5 });
    sig.stop();
    expect(Object.keys(sig.seen[0]!).sort()).toEqual(["id", "kind", "mine"]);
  });
});

// 08-27: 옛 낮 토론 화면 시험(discussion.test)에서 사용자에게 보이는 뜻만 GameMap 기준으로 옮긴 것이다.
describe("GameMap — 낮 토론 채팅 패널·방장 줄 없음 (CHAT-06, DAY-01, 08-27 옮김)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  /** 방 화면과 맵 화면이 각각 구독한다 — 모든 구독자에게 같은 프레임을 보낸다 */
  const feed = () => {
    const listeners: Array<(e: never, meta: { epoch: number }) => void> = [];
    const onEvent = vi.fn((l: (typeof listeners)[number]) => {
      listeners.push(l);
      return () => {};
    });
    return { onEvent: onEvent as unknown as RoomConnection["onEvent"], emit: (e: unknown) => act(() => listeners.forEach((l) => l(e as never, { epoch: 1 }))) };
  };
  const sentTypes = (send: unknown): string[] => (send as ReturnType<typeof vi.fn>).mock.calls.map((c) => (c[0] as ClientMessage).t);

  it("산 사람의 낮 토론 아래는 채널 all 채팅 패널이다: 입력칸 '채팅 입력'(안내 문구 없음)·보내기·기록 칸 role=log, 채널 아이콘·빠른 메시지·이모티콘 버튼 없음", () => {
    const { container } = mount(makeView());
    const panel = container.querySelector<HTMLElement>("[data-chat-panel]")!;
    expect(panel.getAttribute("data-chat-channel")).toBe("all");
    const input = panel.querySelector<HTMLInputElement>("[data-chat-input]")!;
    expect(input.getAttribute("aria-label")).toBe("채팅 입력");
    expect(input.getAttribute("placeholder") ?? "").toBe("");
    expect(panel.querySelector("[data-chat-send]")?.getAttribute("aria-label")).toBe("보내기");
    expect(container.querySelector('[role="log"]')?.getAttribute("aria-label")).toBe("채팅 기록");
    expect(panel.querySelector(".mv-chat__chan")).toBeNull();
    expect(container.querySelector('button[aria-label="빠른 메시지"], button[aria-label="이모티콘"]')).toBeNull();
  });

  it("보낸 줄은 단계 키(1:discussion)와 본문만 서버로 가고, 내 줄은 서버가 방송해야 기록 칸에 나타난다", () => {
    const f = feed();
    const { container } = mount(makeView(), { onEvent: f.onEvent });
    const input = container.querySelector<HTMLInputElement>("[data-chat-input]")!;
    fireEvent.change(input, { target: { value: "저는 시민이에요" } });
    fireEvent.submit(input.closest("form")!);
    const send = (connectionMock.current as RoomConnection).send;
    // 입력 중 신호(typing)는 글을 넣을 때 따로 나간다 — 채팅 메시지만 가려 본다.
    const chats = (send as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as ClientMessage).filter((m) => m.t === "chat");
    expect(chats).toEqual([{ t: "chat", text: "저는 시민이에요", pk: "1:1:discussion" }]);
    expect(container.querySelector("[data-chat-log] .mv-chat__msg")).toBeNull();
    f.emit({ t: "chat", seat: 0, ch: "all", seq: 1, text: "저는 시민이에요", at: NOW });
    const line = container.querySelector("[data-chat-log] .mv-chat__msg");
    expect(line?.getAttribute("data-ch")).toBe("all");
    expect(line?.querySelector(".mv-chat__name")?.textContent).toBe("나");
  });

  it("서버가 보낸 입력 중 좌석만 이름표에 입력 중 신호(typingSeats)로 넘기고 4.5초 뒤 저절로 꺼진다 (CHAT-04)", () => {
    const f = feed();
    mount(makeView(), { onEvent: f.onEvent });
    expect(stage.props?.typingSeats?.size ?? 0).toBe(0);
    f.emit({ t: "typing", seat: 2, on: true });
    expect([...(stage.props?.typingSeats ?? [])]).toEqual([2]);
    advance(4500);
    expect(stage.props?.typingSeats?.size ?? 0).toBe(0);
  });

  it("내가 입력칸에 글자를 넣으면 서버 왕복 없이 내 좌석이 입력 중이고, 비우면 꺼진다 (CHAT-04)", () => {
    const { container } = mount(makeView());
    const input = container.querySelector<HTMLInputElement>("[data-chat-input]")!;
    fireEvent.change(input, { target: { value: "가" } });
    expect([...(stage.props?.typingSeats ?? [])]).toEqual([0]);
    fireEvent.change(input, { target: { value: "" } });
    expect(stage.props?.typingSeats?.size ?? 0).toBe(0);
  });

  it("방장(me.isHost)에게도 연장·넘기기 버튼이 없고 화면은 extend·skip 을 보내지 않는다. 옛 서버의 연장 표시가 와도 토스트가 없다 (결정 0017-5)", () => {
    const view = makeView();
    expect(view.me.isHost).toBe(true);
    const m = mount(view);
    const labels = [...m.container.querySelectorAll("button")].map((b) => `${b.textContent ?? ""}|${b.getAttribute("aria-label") ?? ""}`).join("||");
    expect(/\+30초 연장|넘기기|이미 연장했어요|빠른 메시지/.test(labels)).toBe(false);
    // 옛 서버가 보내던 연장 표시를 키로만 넣는다(타입 선언에 기대지 않는다)
    m.show({ ...view, phaseEndsAt: NOW + 115_000, phaseDurationMs: 120_000, day: { ...view.day!, extendUsed: true } } as unknown as RoomView);
    advance(100);
    expect(m.container.textContent).not.toContain("30초를 늘렸어요");
    expect(m.container.querySelector(".mv-toast__text")?.textContent ?? "").toBe("");
    const types = sentTypes((connectionMock.current as RoomConnection).send);
    expect(types.filter((t) => t === "extend" || t === "skip")).toEqual([]);
  });

  it("다음 낮 시작 view 로 바뀌어도 시트·대화창이 문서에 남지 않는다", () => {
    const m = mount(makeView());
    m.show(makeView({ phase: "dayAnnounce", n: 2 }));
    expect(document.querySelector("dialog")).toBeNull();
  });
});

describe("GameMap — 소스 게이트 (T-08-33)", () => {
  it("결과 알림·맵 화면·아래 패널 소스에 HTML 주입이 없다", () => {
    for (const f of ["src/components/ResultAnnounce.tsx", "src/screens/GameMap.tsx", "src/screens/GamePanel.tsx"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
    }
  });
});

// 13-03: 기본판 동시 투표 화면 (결정 0072, UI-SPEC 투표). WorldStage 는 가짜라 pick·tagProps 로 이름표 계약을 본다
describe("GameMap — 기본판 투표 (결정 0072)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  /** 투표 단계(day.turn 없음) view — pairs 는 [누가, 누구를] */
  const voteView = (pairs: [number, number][] = [], o: ViewOpts = {}): RoomView => {
    const v = makeView({ phase: "nomination", ...o });
    return { ...v, phaseEndsAt: NOW + 15_000, phaseDurationMs: 15_000, day: { ...v.day!, points: pairs.map(([seat, target]) => ({ seat, target })) } };
  };
  const toastText = (c: ParentNode) => c.querySelector(".mv-toast__text")?.textContent ?? "";
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  const sendOf = (): ReturnType<typeof vi.fn> => (connectionMock.current as RoomConnection).send as ReturnType<typeof vi.fn>;
  const tag = (seat: number) => stage.props?.tagProps?.(seat) ?? {};

  it("산 사람 4명: 나를 뺀 세 이름표가 누를 수 있고 묶음 '투표', 이름 '{닉네임} 님 가리키기'", () => {
    mount(voteView());
    const pick = stage.props?.pick;
    expect([...(pick?.seats ?? [])].sort()).toEqual([1, 2, 3]);
    expect(pick?.group).toBe("투표");
    expect(pick?.label("영희")).toBe("영희 님 가리키기");
    expect(pick?.mine).toBeUndefined();
  });

  it("누르면 point 를 한 번 보내고 내 선택(mine)만 바로 바뀌며, 같은 이름표를 다시 누르면 보내지 않고, 다른 이름표를 누르면 옮겨 간다", () => {
    mount(voteView());
    act(() => stage.props!.pick!.onPick(2));
    expect(sendOf()).toHaveBeenCalledTimes(1);
    expect(sendOf()).toHaveBeenLastCalledWith({ t: "point", target: 2 });
    expect(stage.props?.pick?.mine).toBe(2);
    act(() => stage.props!.pick!.onPick(2));
    expect(sendOf()).toHaveBeenCalledTimes(1);
    act(() => stage.props!.pick!.onPick(3));
    expect(sendOf()).toHaveBeenCalledTimes(2);
    expect(sendOf()).toHaveBeenLastCalledWith({ t: "point", target: 3 });
    expect(stage.props?.pick?.mine).toBe(3);
  });

  it("서버 응답 전에는 남의 표·배지·선두를 만들지 않는다 (내 선택 mine 만)", () => {
    mount(voteView());
    act(() => stage.props!.pick!.onPick(2));
    expect(tag(2)).toEqual({ mine: true });
    expect(tag(1)).toEqual({});
  });

  it("거절되면(WRONG_PHASE) 알림 '지금은 고를 수 없어요' 뒤 내 선택이 서버 값으로 돌아온다", () => {
    const listeners: Array<(e: { t: "error"; code: string }, meta: { epoch: number }) => void> = [];
    const onEvent = vi.fn((l: (typeof listeners)[number]) => {
      listeners.push(l);
      return () => {};
    });
    const { container } = mount(voteView(), { onEvent: onEvent as unknown as RoomConnection["onEvent"] });
    act(() => stage.props!.pick!.onPick(2));
    expect(stage.props?.pick?.mine).toBe(2);
    act(() => listeners.forEach((l) => l({ t: "error", code: "WRONG_PHASE" }, { epoch: 1 })));
    expect(toastText(container)).toBe("지금은 고를 수 없어요");
    expect(stage.props?.pick?.mine).toBeUndefined();
  });

  it("내 서버 표가 있으면 mine 이고 유령은 누를 수 있는 이름표가 없다", () => {
    mount(voteView([[0, 2]]));
    expect(stage.props?.pick?.mine).toBe(2);
    cleanup();
    mount(voteView([], { dead: [0] }));
    expect(stage.props?.pick).toBeUndefined();
  });

  it("3:1(과반, 산 5명)이면 그 이름표가 count 3·lead·sure, 2:2 동점이면 lead·sure 없음", () => {
    mount(voteView([[0, 2], [1, 2], [3, 2], [4, 0]], { count: 5 }));
    // seat 0 은 나이고 2 를 가리켰다(서버 값) → mine
    expect(tag(2)).toEqual({ mine: true, count: 3, lead: true, sure: true });
    expect(tag(0)).toEqual({ count: 1 });
    cleanup();
    mount(voteView([[0, 2], [1, 2], [3, 0], [4, 0]], { count: 5 }));
    expect(tag(2)).toEqual({ mine: true, count: 2 });
    expect(tag(0)).toEqual({ count: 2 });
  });

  it("선두만(과반 아님)은 lead 만 있다. 8명 3표(과반 5 미만)", () => {
    mount(voteView([[0, 2], [1, 2], [3, 2], [4, 5]], { count: 8 }));
    expect(tag(2)).toEqual({ mine: true, count: 3, lead: true });
    expect(tag(5)).toEqual({ count: 1 });
    expect(tag(6)).toEqual({});
  });

  it("카메라·조명: 과반 + 스테이지 360 이상이면 확대 1.08, 긴장 2", () => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
    mount(voteView([[0, 2], [1, 2], [3, 2]], { count: 5 }));
    expect(stage.props?.scene?.tension).toBe(2);
    expect(stage.props?.scene?.focusSeat).toBe(2);
    expect((stage.props?.scene?.camera as { zoom?: number }).zoom).toBe(1.08);
  });

  it("기본판 투표 이름표는 is-blink 없음 — 13 의 처음 깜빡임은 빛남(call)이 대체한다(U-7)", () => {
    mount(voteView());
    expect(tag(1).blink).toBeUndefined();
    expect(tag(1).call).toBe(true);
    advance(2700);
    expect(tag(1).blink).toBeUndefined();
    expect(tag(1).call).toBe(true); // 시간으로 꺼지지 않는다 — 쓰면 꺼진다
    expect(tag(0).call).toBeUndefined();
    act(() => stage.props!.pick!.onPick(1));
    expect(tag(3).call).toBeUndefined();
  });

  it("재접속으로 이미 지난 투표도, 이미 골랐어도 blink 는 없다(빛남은 이미 골랐으면 켜지 않는다)", () => {
    const old = voteView();
    mount({ ...old, phaseEndsAt: NOW + 5_000 });
    expect(tag(1).blink).toBeUndefined();
    cleanup();
    mount(voteView([[0, 2]]));
    expect(tag(1).blink).toBeUndefined();
    expect(tag(1).call).toBeUndefined();
  });

  it("기본판 투표: 제목 '투표'뿐(안내 줄·시간 링 없음, 남은 시간은 띠 몫), 차례 알약·막대는 DOM 에 없고 어둡게 막은 off", () => {
    const { container } = mount(voteView());
    expect(container.querySelector(".mv-phase__title")?.textContent).toBe("투표");
    expect(container.querySelector(".mv-phase__hint")).toBeNull();
    expect(container.querySelector(".mv-ring")).toBeNull();
    expect(container.querySelector(".mf-game__header [role=timer]")).toBeNull();
    expect(container.querySelector("[data-turn-block]")).toBeNull();
    const { container: under } = render(<>{stage.props?.underlay}</>);
    expect(under.querySelector(".mf-game__dim")?.getAttribute("data-dim")).toBe("off");
  });

  it("투표 시작 채팅 줄과 표마다 위 알림 '영희 → 서준', 바꾸면 '(바꿈)', 새 표가 이전 알림을 바꾼다", () => {
    const m = mount(makeView({ phase: "discussion" }));
    m.show(voteView());
    expect(m.container.querySelector("[data-chat-log]")?.textContent).toContain("투표 시작");
    expect(toastText(m.container)).toBe("");
    m.show(voteView([[1, 2]]));
    expect(toastText(m.container)).toBe("영희 → 서준");
    m.show(voteView([[1, 2], [3, 2]]));
    expect(toastText(m.container)).toBe("지아 → 서준");
    m.show(voteView([[1, 3], [3, 2]]));
    expect(toastText(m.container)).toBe("영희 → 지아 (바꿈)");
    const log = m.container.querySelector("[data-chat-log]")?.textContent ?? "";
    expect(log).toContain("영희 → 서준");
    expect(log).toContain("지아 → 서준");
    expect(log).toContain("영희 → 지아 (바꿈)");
  });

  it("재접속 첫 스냅샷은 위 알림·채팅 줄 없이 지금 표를 바로 그린다", () => {
    const { container } = mount(voteView([[1, 2], [3, 2], [0, 2]], { count: 5 }));
    expect(toastText(container)).toBe("");
    expect(container.querySelector("[data-chat-log]")?.textContent ?? "").not.toContain("→");
    expect(tag(2)).toEqual({ mine: true, count: 3, lead: true, sure: true });
    expect(stage.props?.pick?.mine).toBe(2);
  });

  it("닉네임의 HTML 은 위 알림에서 글자 그대로다", () => {
    const m = mount(makeView({ phase: "discussion", nicknames: ["민수", "<b>영희</b>", "서준", "지아"] }));
    m.show(voteView([], { nicknames: ["민수", "<b>영희</b>", "서준", "지아"] }));
    m.show(voteView([[1, 2]], { nicknames: ["민수", "<b>영희</b>", "서준", "지아"] }));
    expect(toastText(m.container)).toBe("<b>영희</b> → 서준");
    expect(m.container.querySelector(".mv-toast b")).toBeNull();
  });

  it("연결이 끊기면(canSend 거짓) 이름표 버튼이 disabled 이고 순차 지목(day.turn 있음)은 이 경로를 쓰지 않는다", () => {
    mount(voteView(), { canSend: false });
    expect(stage.props?.pick?.disabled).toBe(true);
    cleanup();
    mount(voteView());
    expect(stage.props?.pick?.disabled).toBeUndefined();
    cleanup();
    const seq = voteView();
    mount({ ...seq, day: { ...seq.day!, turn: { order: [0, 1, 2, 3], i: 0, endsAt: NOW + 8000 } } });
    expect(stage.props?.pick?.group).toBe("지목");
    expect(document.querySelector("[data-turn-block]")).not.toBeNull();
  });
});
