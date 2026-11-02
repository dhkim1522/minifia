import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ClientMessage, PhaseId, PublicPlayer, RoleRecord, RoomView } from "../../shared/protocol";
import type { WorldStageProps } from "../../src/components/WorldStage";
import { KB_PANEL_H, LOG_H_KB, LOG_H_SHORT, LOG_H_TALL } from "../../src/game/chatUi";
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
const dotsOn = (c: ParentNode): number => c.querySelectorAll(".mv-dots__dot.is-on").length;
const dotsAll = (c: ParentNode): number => c.querySelectorAll(".mv-dots__dot").length;

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
    expect(dotsAll(container)).toBe(3);
    expect(dotsOn(container)).toBe(0);
  });

  it("과반 수는 산 사람 수로 센다: 8명 중 3명이 죽어 5명이면 3, 2명이면 2", () => {
    const eight = mount(makeView({ count: 8, dead: [5, 6, 7] }));
    expect(dotsAll(eight.container)).toBe(3);
    eight.unmount();
    const two = mount(makeView({ count: 4, dead: [2, 3] }));
    expect(dotsAll(two.container)).toBe(2);
  });

  it("누르면 endDiscussion {on: true} 를 한 번 보내고 내 눌림(aria-pressed)만 즉시 바뀐다 — 점은 서버가 센 값 그대로", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container } = mount(makeView(), { send });
    fireEvent.click(endButton(container)!);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ t: "endDiscussion", on: true });
    expect(endButton(container)?.getAttribute("aria-pressed")).toBe("true");
    expect(dotsOn(container)).toBe(0);
    // 다시 누르면 취소
    fireEvent.click(endButton(container)!);
    expect(send).toHaveBeenLastCalledWith({ t: "endDiscussion", on: false });
    expect(endButton(container)?.getAttribute("aria-pressed")).toBe("false");
  });

  it("서버 view(endCount 1, me.endDiscussion true)가 오면 점 1개가 켜지고 눌림이 서버 값을 따른다", () => {
    const m = mount(makeView());
    expect(dotsOn(m.container)).toBe(0);
    m.show(makeView({ endCount: 1, pressed: true }));
    expect(dotsOn(m.container)).toBe(1);
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

  it("다른 사람의 토론 끝내기 여부는 그리지 않는다 — 개수 점만 있고 이름표에 넘기는 속성도 없다", () => {
    const { container } = mount(makeView({ count: 6, endCount: 2 }));
    expect(dotsOn(container)).toBe(2);
    expect(dotsAll(container)).toBe(4);
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

  it("여섯 단계 어디에도 v1.0 고정 테이블(.mf-dt)·옛 장면(.mf-dayscene)을 대신 그리지 않는다", () => {
    for (const phase of ["dayAnnounce", "discussion", "nomination", "defense", "verdict", "execution"] as const) {
      const { container, unmount } = mount(makeView({ phase }));
      expect(container.querySelector(".mf-dt, .mf-dayscene")).toBeNull();
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

  it("낮 토론 산 사람: 제목 '낮 토론', 안내 '이야기하며 마피아를 찾아요' [data-guide] 하나, 서버 마감 기준 시간 링 role=timer", () => {
    const { container } = mount(makeView());
    const header = container.querySelector(".mf-game__header") as HTMLElement;
    expect(header.querySelector(".mv-phase__title")?.textContent).toBe("낮 토론");
    expect(container.querySelectorAll("[data-guide]").length).toBe(1);
    expect(header.querySelector("[data-guide]")?.textContent).toBe("이야기하며 마피아를 찾아요");
    const timer = header.querySelector('[role="timer"]');
    expect(timer).not.toBeNull();
    expect(timer?.getAttribute("aria-label")).toBe("남은 시간 90초");
  });

  it("안내는 2500ms 뒤 접히고(.is-folded) 단계가 바뀌면 새 안내가 다시 보였다 접힌다", () => {
    const m = mount(makeView());
    const hint = () => m.container.querySelector("[data-guide]") as HTMLElement;
    expect(hint().classList.contains("is-folded")).toBe(false);
    advance(2499);
    expect(hint().classList.contains("is-folded")).toBe(false);
    advance(1);
    expect(hint().classList.contains("is-folded")).toBe(true);
    m.show(makeView({ phase: "nomination" }));
    expect(hint().textContent).toBe("의심되는 사람을 눌러요");
    expect(hint().classList.contains("is-folded")).toBe(false);
    advance(2500);
    expect(hint().classList.contains("is-folded")).toBe(true);
  });

  it("낮 시작에는 시간 링이 없다", () => {
    const { container } = mount(makeView({ phase: "dayAnnounce" }));
    expect(container.querySelector('.mf-game__header [role="timer"]')).toBeNull();
  });

  it("유령(탈락)의 안내는 '모두의 직업이 보여요'", () => {
    const { container } = mount(makeView({ dead: [0] }));
    expect(container.querySelector("[data-guide]")?.textContent).toBe("모두의 직업이 보여요");
  });

  it("[역할 카드] 는 글자 없는 44×44 아이콘 버튼이고 헤더 안 시간 링 앞(왼쪽) 형제다 — aria-label '역할 카드'", () => {
    const { container } = mount(makeView());
    const btn = container.querySelector(".mf-game__header button") as HTMLButtonElement;
    expect(btn.getAttribute("aria-label")).toBe("역할 카드");
    expect(btn.textContent).toBe("");
    expect(btn.classList.contains("mf-iconbtn")).toBe(true);
    expect(btn.querySelector("svg")).not.toBeNull();
    const ring = container.querySelector('.mf-game__header [role="timer"]') as HTMLElement;
    expect(btn.parentElement).toBe(ring.parentElement);
    expect(btn.compareDocumentPosition(ring) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 헤더가 맵보다 DOM 앞이라 Tab 순서가 [역할 카드] → 이름표 → 입력이다
    expect(container.querySelectorAll("button[aria-label='역할 카드']").length).toBe(1);
  });

  it("안 읽은 일지가 있으면 이름이 '역할 카드, 새 기록' 이고 gray-100 점이 붙는다(앰버 아님)", () => {
    const { container } = mount(makeView({ records: [{ n: 1, target: 1, isMafia: false }] }));
    const btn = container.querySelector(".mf-game__header button") as HTMLButtonElement;
    expect(btn.getAttribute("aria-label")).toBe("역할 카드, 새 기록");
    expect(btn.querySelector(".mf-rolecard-btn__dot")).not.toBeNull();
    const css = readFileSync("src/styles/rolecard.css", "utf8");
    expect(css).toMatch(/\.mf-rolecard-btn--icon \.mf-rolecard-btn__dot[^}]*var\(--gray-100\)/);
  });

  it("눌러 열면 역할 카드 시트가 열린다", () => {
    const { container } = mount(makeView());
    fireEvent.click(container.querySelector(".mf-game__header button")!);
    expect(document.querySelector('dialog[aria-label="역할 카드"]')).not.toBeNull();
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

  it("밤에서 낮 시작으로 들어오면 '낮이 되었습니다'(role=status) 알림과 채팅 시스템 줄 '2일차' 가 나오고 2000ms 뒤 알림이 사라진다", () => {
    const m = mount(makeView({ phase: "night", n: 1 }));
    expect(announces(m.container).length).toBe(0);
    m.show(makeView({ phase: "dayAnnounce", n: 2, noClock: true }));
    const [el] = announces(m.container);
    expect(el?.textContent).toBe("낮이 되었습니다");
    expect(el?.getAttribute("role")).toBe("status");
    expect(logText(m.container)).toContain("2일차");
    advance(1999);
    expect(announces(m.container).length).toBe(1);
    advance(1);
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

  it("알림은 한 번에 하나다: 찬반 결과 알림 뒤 2000ms 에 '처형 없음' 이 이전 알림을 바꾼다", () => {
    const m = mount(makeView({ phase: "verdict", candidate: 1 }));
    m.show(makeView({ phase: "execution", candidate: 1, verdict: { yes: 2, no: 3, passed: false } }));
    expect(announces(m.container).map((e) => e.textContent)).toEqual(["찬성 2 · 반대 3"]);
    advance(2000);
    expect(announces(m.container).map((e) => e.textContent)).toEqual(["처형 없음"]);
  });

  it("알림 문자열은 텍스트 노드다: 닉네임 '<b>영희</b>' 가 HTML 이 아니라 글자로 보인다", () => {
    const names = ["민수", "<b>영희</b>", "서준", "지아"];
    const m = mount(makeView({ phase: "verdict", candidate: 1, nicknames: names }));
    m.show(makeView({ phase: "execution", candidate: 1, nicknames: names, verdict: { yes: 3, no: 0, passed: true } }));
    advance(2000);
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
    let listener: ((e: { t: "error"; code: string }, meta: { epoch: number }) => void) | null = null;
    const onEvent = vi.fn((l: typeof listener) => {
      listener = l;
      return () => {};
    });
    const { container } = mount(makeView(), { onEvent: onEvent as unknown as RoomConnection["onEvent"] });
    fireEvent.click(endButton(container)!);
    expect(endButton(container)?.getAttribute("aria-pressed")).toBe("true");
    act(() => listener?.({ t: "error", code: "WRONG_PHASE" }, { epoch: 1 }));
    expect(toastText(container)).toBe("지금은 고를 수 없어요");
    expect(endButton(container)?.getAttribute("aria-pressed")).toBe("false");
  });

  it("그 밖의 오류(RATE_LIMITED)는 알림도 되돌림도 만들지 않는다", () => {
    let listener: ((e: { t: "error"; code: string }, meta: { epoch: number }) => void) | null = null;
    const onEvent = vi.fn((l: typeof listener) => {
      listener = l;
      return () => {};
    });
    const { container } = mount(makeView(), { onEvent: onEvent as unknown as RoomConnection["onEvent"] });
    fireEvent.click(endButton(container)!);
    act(() => listener?.({ t: "error", code: "RATE_LIMITED" }, { epoch: 1 }));
    expect(toastText(container)).toBe("");
    expect(endButton(container)?.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("GameMap — 소스 게이트 (T-08-33)", () => {
  it("결과 알림·맵 화면·아래 패널 소스에 HTML 주입이 없다", () => {
    for (const f of ["src/components/ResultAnnounce.tsx", "src/screens/GameMap.tsx", "src/screens/GamePanel.tsx"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
    }
  });
});
