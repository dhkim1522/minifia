import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { EXECUTION_MS } from "../../shared/game/phases";
import { RULES } from "../../shared/game/ruleset";
import type { ClientMessage, MorningView, PhaseId, PublicPlayer, RoleRecord, RoomView } from "../../shared/protocol";
import { LineSheet } from "../../src/components/v2/LineSheet";
import { floatVisible } from "../../src/game/badgeView";
import { RESULT_PANEL_TEXT } from "../../src/game/resultText";
import { whisperVisible } from "../../src/game/whisperView";
import type { WorldStageProps } from "../../src/components/WorldStage";
import { DISCUSSION_LOG_H, DISCUSSION_PANEL_EXTRA, LOG_H } from "../../src/game/chatUi";
import { faceSrc } from "../../src/net/assets";

/** 토론 키보드 열림 패널 = 도구 58 + 기록 42 + 입력 간격 8 + 입력 44 + 하단 8 */
const KB_PANEL = 58 + 42 + 8 + 44 + 8;
import { bindSignals, type LocalSignal } from "../../src/audio/signals";
import type { RoomConnection } from "../../src/net/useRoomConnection";
const GAME_RULES = RULES;

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
const { GameMap } = await import("../../src/screens/GameMap");
const { WorldStore } = await import("../../src/world/store");
const { ChatStore } = await import("../../src/net/chatStore");

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
  /** 처형 단계의 처형자(day.execution, 22-12) */
  execution?: { seat: number; will?: string };
  candidate?: number;
  nicknames?: string[];
  /** 좌석별 생존. 기본 모두 산다 */
  dead?: number[];
  count?: number;
  mySeat?: number;
  endCount?: number;
  pressed?: boolean;
  skipOpensAt?: number;
}

function makeView(o: ViewOpts = {}): RoomView {
  const count = o.count ?? 4;
  const mySeat = o.mySeat ?? 0;
  const players = Array.from({ length: count }, (_, seat) =>
    player(seat, { ...(o.dead?.includes(seat) ? { alive: false } : {}), ...(o.nicknames?.[seat] !== undefined ? { nickname: o.nicknames[seat]! } : {}) }),
  );
  const phase = o.phase ?? "discussion";
  const alive = count - (o.dead?.length ?? 0);
  const canVote = !o.dead?.includes(mySeat);
  return {
    code: "0042",
    phase,
    phaseEndsAt: o.noClock ? null : NOW + (o.phase === "execution" ? EXECUTION_MS : 90_000),
    phaseDurationMs: o.noClock ? null : o.phase === "execution" ? EXECUTION_MS : 90_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: mySeat, isHost: mySeat === 0, chat: canVote ? "all" : "ghost", ...(o.pressed ? { phaseSkip: true as const } : {}), ...(o.records ? { records: o.records } : {}) },
    ...(phase === "discussion" || o.skipOpensAt !== undefined ? { phaseSkip: { count: o.endCount ?? 0, total: alive, opensAt: o.skipOpensAt ?? NOW, canVote } } : {}),
    day: {
      n: o.n ?? 1,
      roles: [],
      ...(o.execution ? { execution: o.execution } : {}),
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
  const m = /^(\d+) \/ (\d+)$/.exec(c.querySelector("[data-phase-skip] .mv-count")?.textContent ?? "");
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

describe("GameMap — 내 마피아 의상", () => {
  it("같은 공개 차림을 받아도 마피아 본인의 게임 맵만 내 의상을 덮어쓴다", () => {
    const view = makeView();
    view.players[0]!.look = "hood";
    view.players[1]!.look = "mafia";
    view.me.role = "mafia";
    const { show } = mount(view);
    expect(stage.props?.scene?.seats[0]?.costume).toBe("mafia");
    expect(stage.props?.scene?.seats[1]?.costume).toBeUndefined();
    expect(view.players[0]!.look).toBe("hood");

    show({ ...view, me: { ...view.me, seat: 1, isHost: false, role: "citizen" } });
    expect(Object.values(stage.props!.scene!.seats).every((seat) => seat.costume === undefined)).toBe(true);
    expect(stage.props?.view.players[1]?.look).toBe("mafia");

    const dead = makeView({ dead: [0] });
    dead.me.role = "mafia";
    show(dead);
    expect(stage.props?.scene?.seats[0]).toMatchObject({ ghost: true });
    expect(stage.props?.scene?.seats[0]?.costume).toBeUndefined();
  });

  it.each(["mafia", "police", "doctor"] as const)("동물의 비공개 %s 의상은 본인 화면에만 입힌다", (role) => {
    const view = makeView();
    view.players[0]!.animal = "rabbit";
    view.players[1]!.animal = "penguin";
    view.me.role = role;
    const { show } = mount(view);
    expect(stage.props?.scene?.seats[0]?.costume).toBe(role);
    expect(stage.props?.scene?.seats[1]?.costume).toBeUndefined();

    show({ ...view, me: { ...view.me, seat: 1, isHost: false, role: "citizen" } });
    expect(stage.props?.scene?.seats[0]?.costume).toBeUndefined();
    expect(stage.props?.view.players[0]?.animal).toBe("rabbit");
  });
});

describe("GameMap — 토론 기록", () => {
  it.each([false, true])("아침에 받은 공개 유언은 채팅 기록에 남고 인용 도구가 없다 (실험방 %s)", (playtest) => {
    const store = new WorldStore();
    const chat = new ChatStore();
    const send = vi.fn();
    const frame = (view: RoomView) => <GameMap view={playtest ? { ...view, playtest: true } : view} store={store} chat={chat} send={send} />;
    const morning = makeView({ phase: "morning", n: 1, dead: [2] });
    morning.day!.morning = { eliminated: 2 };
    const { container, rerender } = render(frame(morning));
    act(() => chat.apply({ t: "chatLog", lines: [
      { ch: "all", k: "will", at: NOW, seat: 2, seq: 1, text: "남겨 둔 말" },
    ] }, 1, NOW));
    rerender(frame(makeView({ n: 2, dead: [2] })));
    expect(container.querySelector("[data-chat-log]")?.textContent).toContain("남겨 둔 말");
    expect(container.querySelector('[data-playtest-action="clues"], [data-discussion-evidence]')).toBeNull();
    expect(endButton(container)).not.toBeNull();
  });
});

describe("GameMap — 실험방 토론 도구", () => {
  it("첫날 반응을 보내도 채팅 초안과 토론 스킵이 유지된다", () => {
    const send = vi.fn();
    const view: RoomView = { ...makeView({ count: 4 }), playtest: true };
    view.day!.keyword = { genre: "영화", answers: [{ seat: 1, order: 1, text: "공개된 단서" }] };
    const { container, getByRole } = mount(view, { send });
    const action = (name: string) => container.querySelector<HTMLButtonElement>(`[data-playtest-action="${name}"]`)!;
    const activeSurface = () => container.querySelector("[data-playtest-surface]")?.getAttribute("data-playtest-surface");
    const input = container.querySelector<HTMLInputElement>("[data-chat-input]")!;

    expect(container.querySelector("[data-guide]")).toBeNull();
    expect(container.querySelectorAll('[role="timer"]')).toHaveLength(1);
    expect(input).not.toBeNull();
    expect(container.querySelector("[data-chat-open]")).toBeNull();
    fireEvent.change(input, { target: { value: "내 초안" } });
    input.focus();
    expect(action("clues")).toBeNull();
    fireEvent.click(action("reaction"), { detail: 1 });
    expect(activeSurface()).toBe("reaction");
    fireEvent.click(getByRole("button", { name: "최고" }));
    expect(activeSurface()).toBeUndefined();
    expect(send).toHaveBeenCalledWith({ t: "emote", id: "praise", pk: "1:1:discussion" });
    expect(container.querySelector("[data-chat-input]")).toBe(input);
    expect(input.value).toBe("내 초안");
    expect(endButton(container)).not.toBeNull();
    expect(document.activeElement).toBe(input);

    expect(send.mock.calls.some(([message]) => message.t === "chat")).toBe(false);
  });

  it("스킵이 열리기 전에도 의심 모드를 쓰고 3초 뒤 서버가 지정한 스킵에 동의할 수 있다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      const send = vi.fn();
      const view: RoomView = { ...makeView({ count: 5, skipOpensAt: NOW + 3000 }), playtest: true };
      const { container } = mount(view, { send });
      expect(endButton(container)).toBeNull();

      const suspect = container.querySelector<HTMLButtonElement>('[data-playtest-action="suspect"]')!;
      fireEvent.click(suspect);
      expect(suspect.getAttribute("aria-pressed")).toBe("true");
      expect(stage.props?.canWalk).toBe(true);
      expect(stage.props?.pick?.seats.size).toBe(0);
      expect(container.textContent).toContain("조금 더 가까이 가 보세요");
      act(() => vi.advanceTimersByTime(2999));
      expect(endButton(container)).toBeNull();
      act(() => vi.advanceTimersByTime(1));
      const button = endButton(container)!;
      expect(button.getAttribute("aria-label")).toContain("5명 중 0명 동의");
      fireEvent.click(button);
      expect(send).toHaveBeenCalledWith({ t: "phaseSkip", opensAt: NOW + 3000, on: true });
      expect(button.getAttribute("aria-pressed")).toBe("true");
    } finally {
      vi.useRealTimers();
    }
  });

  it("밤 시민은 완료 버튼과 서버 확인을 보고 얼굴 고르기는 하지 않는다", () => {
    const send = vi.fn();
    const view: RoomView = { ...makeView({ phase: "night" }), playtest: true };
    view.me.role = "citizen";
    const { container, show } = mount(view, { send });
    const button = container.querySelector<HTMLButtonElement>("[data-night-done]")!;
    fireEvent.click(button);
    expect(send).toHaveBeenCalledWith({ t: "nightDone" });
    expect(container.querySelector("[data-face-list]")).toBeNull();
    expect(stage.props?.canWalk).toBe(false);
    show({ ...view, me: { ...view.me, nightDone: true } });
    expect(button.textContent).toBe("준비 완료");
    expect(button.disabled).toBe(true);
  });
});

describe("GameMap — 단계 스킵", () => {
  it("산 사람의 토론에는 머리 쪽에 스킵과 전원 동의 집계가 있다", () => {
    const { container } = mount(makeView({ count: 5 }));
    const root = container.querySelector("main.mf-game") as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.hasAttribute("data-game-stage")).toBe(true);
    expect(root.getAttribute("data-phase")).toBe("discussion");
    expect(root.querySelector("[data-world-stage-fake]")).not.toBeNull();
    expect(container.querySelectorAll(".mf-game__header [data-phase-skip]").length).toBe(1);
    expect(container.querySelector("[data-world-panel] [data-phase-skip]")).toBeNull();
    expect(endButton(container)?.getAttribute("aria-label")).toBe("스킵, 5명 중 0명 동의");
    expect(endButton(container)?.getAttribute("aria-pressed")).toBe("false");
    expect(countMax(container)).toBe(5);
    expect(countNow(container)).toBe(0);
  });

  it("서버가 제공한 분모를 표시한다", () => {
    const eight = mount(makeView({ count: 8, dead: [5, 6, 7] }));
    expect(countMax(eight.container)).toBe(5);
    eight.unmount();
    const two = mount(makeView({ count: 4, dead: [2, 3] }));
    expect(countMax(two.container)).toBe(2);
  });

  it("동의와 취소는 현재 단계의 opensAt 를 보내고 숫자는 서버 집계를 따른다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container } = mount(makeView(), { send });
    fireEvent.click(endButton(container)!);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ t: "phaseSkip", opensAt: NOW, on: true });
    expect(endButton(container)?.getAttribute("aria-pressed")).toBe("true");
    expect(countNow(container)).toBe(0);
    // 다시 누르면 취소
    fireEvent.click(endButton(container)!);
    expect(send).toHaveBeenLastCalledWith({ t: "phaseSkip", opensAt: NOW, on: false });
    expect(endButton(container)?.getAttribute("aria-pressed")).toBe("false");
  });

  it("서버 view 가 오면 숫자와 눌림이 서버 값을 따른다", () => {
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

  it("서버가 스킵 창을 주지 않은 단계에는 버튼이 없다", () => {
    for (const phase of ["dayAnnounce", "nomination", "defense", "verdict", "execution"] as const) {
      const { container, unmount } = mount(makeView({ phase }));
      expect(container.querySelector("[data-phase-skip]")).toBeNull();
      unmount();
    }
  });

  it("다른 사람의 동의 여부는 집계로만 보이고 이름표에는 표시하지 않는다", () => {
    const { container } = mount(makeView({ count: 6, endCount: 2 }));
    expect(countNow(container)).toBe(2);
    expect(countMax(container)).toBe(6);
    expect(stage.props?.tagProps).toBeUndefined();
    expect(stage.props?.pick).toBeUndefined();
  });

  it("스킵 창이 바뀌면 이전 동의 상태가 사라지고 새 창에 동의할 수 있다", () => {
    const send = vi.fn();
    const m = mount(makeView({ pressed: true }), { send });
    expect(endButton(m.container)?.getAttribute("aria-pressed")).toBe("true");
    m.show(makeView({ phase: "verdict", skipOpensAt: NOW + 1 }));
    const button = m.container.querySelector("[data-phase-skip]")!;
    expect(button.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(button);
    expect(send).toHaveBeenCalledWith({ t: "phaseSkip", opensAt: NOW + 1, on: true });
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
  const DISCUSSION_PANEL_H = DISCUSSION_LOG_H + DISCUSSION_PANEL_EXTRA;
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
    panelH = LOG_H + 92;
    remeasure();
    expect(stage.props?.stageInsets).toEqual({ top: 62, bottom: LOG_H + 92 });
  });

  it("키보드가 열려도 토론 스킵은 같은 줄에 있고 기록 칸을 42px로 줄여 패널을 336px 올린다", () => {
    const vv = installVV(INNER_H);
    const { container } = mount(makeView());
    const vote = endButton(container);
    expect(vote).not.toBeNull();
    focusWithKeyboard(container, vv, 336);
    panelH = KB_PANEL;
    remeasure();
    expect(gameOf(container).getAttribute("data-kb-open")).toBe("true");
    expect(endButton(container)).toBe(vote);
    expect(logHeight(container)).toBe("42px");
    expect(container.querySelector("[data-chat-log]")?.classList.contains("is-fixed")).toBe(true);
    expect(container.querySelector(".mv-chat.is-compact")).not.toBeNull();
    expect(container.querySelector(".mf-game__panel")?.classList.contains("mf-game__panel--kb")).toBe(true);
    expect(stage.props?.stageInsets).toEqual({ top: 62, bottom: KB_PANEL + 336 });
  });

  it("키보드가 열려 있을 때 반응 도구를 누르면 초안을 유지하고 키보드를 접는다", () => {
    const vv = installVV(INNER_H);
    const view = makeView();
    view.day!.keyword = { genre: "영화", answers: [{ seat: 0, text: "무대", order: 1 }] };
    const { container } = mount(view);
    focusWithKeyboard(container, vv, 336);
    const input = inputOf(container);
    fireEvent.change(input, { target: { value: "쓰던 말" } });
    fireEvent.click(container.querySelector('[data-playtest-action="reaction"]')!);
    advance(20);
    expect(document.activeElement).not.toBe(input);
    expect(input.value).toBe("쓰던 말");
    expect(container.querySelector('[data-playtest-surface="reaction"]')).not.toBeNull();
  });

  it("키보드 열림 경계(lift 60) 아래에서는 기록 칸이 144px이고, 블러하면 144px로 돌아온다", () => {
    const vv = installVV(INNER_H);
    const { container } = mount(makeView());
    focusWithKeyboard(container, vv, 60);
    expect(gameOf(container).hasAttribute("data-kb-open")).toBe(false);
    expect(endButton(container)).not.toBeNull();
    expect(logHeight(container)).toBe("144px");
    focusWithKeyboard(container, vv, 336);
    panelH = KB_PANEL;
    remeasure();
    expect(logHeight(container)).toBe("42px");
    act(() => inputOf(container).blur());
    panelH = DISCUSSION_PANEL_H;
    remeasure();
    expect(gameOf(container).hasAttribute("data-kb-open")).toBe(false);
    expect(endButton(container)).not.toBeNull();
    expect(logHeight(container)).toBe("144px");
    expect(stage.props?.stageInsets).toEqual({ top: 62, bottom: DISCUSSION_PANEL_H });
  });

  it("키보드가 닫힌 토론에서 기록 높이의 CSS 상한은 144px이다", () => {
    for (const h of [560, 640, 844, 932]) {
      Object.defineProperty(window, "innerHeight", { value: h, configurable: true, writable: true });
      const { container, unmount } = mount(makeView());
      expect(logHeight(container)).toBe("144px");
      unmount();
    }
    expect(LOG_H).toBe(68);
    expect(DISCUSSION_PANEL_H).toBe(274);
    expect(LOG_H + 92).toBe(160);
    expect(KB_PANEL).toBe(160);
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

  it("기본판 낮 토론 헤더에 제목과 게이지, 스킵·게임 메뉴가 있다", () => {
    const { container } = mount(makeView());
    const header = container.querySelector(".mf-game__header") as HTMLElement;
    expect(header.querySelector(".mv-phase__title")?.textContent).toBe("토론");
    expect(header.querySelectorAll(".mv-phase__title").length).toBe(1);
    expect(header.querySelector(".mv-phase__hint")).toBeNull();
    expect(header.querySelector(".mv-ring")).toBeNull();
    const gauge = header.querySelector('[role="timer"][data-phase-gauge]');
    expect(gauge?.textContent).toBe("");
    expect(gauge?.getAttribute("aria-label")).toBe("남은 시간 90초");
    expect(header.querySelectorAll("button").length).toBe(2);
    expect(header.querySelector("[data-guide]")).toBeNull();
  });

  it("기본판 산 사람과 유령의 헤더에서 안내 줄과 시간 링을 중복 표시하지 않는다", () => {
    for (const phase of ["dayAnnounce", "discussion", "nomination", "defense", "verdict", "execution", "night", "morning"] as const) {
      for (const dead of [[], [0]] as const) {
        const { container, unmount } = mount(makeView({ phase, candidate: 1, dead: [...dead] }));
        const header = container.querySelector(".mf-game__header") as HTMLElement;
        const cell = `${phase}/${dead.length === 0 ? "산 사람" : "유령"}`;
        expect(header.querySelectorAll(".mv-phase__title").length, `${cell}: 제목`).toBe(1);
        expect(header.querySelector(".mv-phase__hint"), `${cell}: 안내 줄`).toBeNull();
        expect(header.querySelector(".mv-ring"), `${cell}: 시간 링`).toBeNull();
        expect(header.querySelectorAll("[data-phase-gauge]").length, `${cell}: 게이지`).toBe(phase === "dayAnnounce" ? 0 : 1);
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

  it("토론 메뉴는 스킵 옆에 글 없는 메뉴 아이콘으로 표시한다", () => {
    const { container } = mount(makeView());
    const btn = container.querySelector("[data-game-menu]") as HTMLButtonElement;
    expect(btn.getAttribute("aria-label")).toBe("메뉴");
    expect(btn.hasAttribute("data-tool-label")).toBe(false);
    expect(btn.querySelector(".mf-rolecard-btn__label")).toBeNull();
    expect(btn.textContent).toBe("");
    expect(btn.querySelector("svg path")).not.toBeNull();
    expect(btn.parentElement?.classList.contains("mf-game-phase-header__actions")).toBe(true);
    expect(btn.previousElementSibling).toBe(endButton(container));
    expect(container.querySelector(".mf-game__header [data-phase-gauge]")).not.toBeNull();
    expect(container.querySelectorAll("button[data-game-menu]").length).toBe(1);
  });

  it("안 읽은 일지가 있으면 토론 메뉴 이름과 점으로 새 기록을 알린다", () => {
    const { container } = mount(makeView({ records: [{ n: 1, target: 1, isMafia: false }] }));
    const btn = container.querySelector("[data-game-menu]") as HTMLButtonElement;
    expect(btn.getAttribute("aria-label")).toBe("메뉴, 새 기록");
    expect(btn.querySelector(".mf-rolecard-btn__dot")).not.toBeNull();
    const css = readFileSync("src/styles/rolecard.css", "utf8");
    expect(css).toMatch(/\.mf-rolecard-btn__dot[^}]*var\(--gray-100\)/);
  });

  it("메뉴에서 내 역할과 기록을 누르면 역할 카드 시트가 열린다", () => {
    const { container } = mount(makeView());
    fireEvent.click(container.querySelector("[data-game-menu]")!);
    fireEvent.click(container.querySelector("[data-game-menu-role]")!);
    expect(document.querySelector('dialog[aria-label="역할 카드"]')).not.toBeNull();
  });
});

describe("GameMap — 헤더 시간대 글자 (0083-1)", () => {
  const header = (c: ParentNode) => c.querySelector(".mf-game__header") as HTMLElement;
  const word = (c: ParentNode) => header(c).querySelector(".mv-phase__tod");

  it("낮 토론은 시간대를 보존하고 제목 '토론', 숫자 없는 게이지, 메뉴만 보인다", () => {
    const { container } = mount(makeView());
    const lines = header(container).querySelectorAll("[data-tod]");
    expect(lines.length).toBe(1);
    expect(lines[0]?.getAttribute("data-tod")).toBe("day");
    expect(lines[0]?.classList.contains("mv-phase__line")).toBe(true);
    expect(word(container)).toBeNull();
    expect(lines[0]?.querySelector(".mv-phase__sep")).toBeNull();
    expect(lines[0]?.querySelector(".mv-phase__title")?.textContent).toBe("토론");
    expect(header(container).querySelectorAll("img").length).toBe(0);
    expect(header(container).querySelectorAll("[data-game-menu]").length).toBe(1);
  });

  it("토론에서 지목으로 넘어가면 '토론'이 '저녁 · 지목'으로 바뀐다", () => {
    const m = mount(makeView());
    expect(header(m.container).querySelector("[data-tod]")?.getAttribute("data-tod")).toBe("day");
    m.show(makeView({ phase: "nomination", candidate: 1 }));
    expect(header(m.container).querySelectorAll("[data-tod]").length).toBe(1);
    expect(header(m.container).querySelector("[data-tod]")?.getAttribute("data-tod")).toBe("dusk");
    expect(word(m.container)?.textContent).toBe("저녁");
    expect(header(m.container).querySelector(".mv-phase__title")?.textContent).toBe("지목");
  });

  it("단계마다 todOf 대응: 낱말·제목", () => {
    const cells: Array<[PhaseId, string, string | null, string]> = [
      ["dayAnnounce", "day", "낮", "토론"],
      ["nomination", "dusk", "저녁", "지목"],
      ["defense", "dusk", "저녁", "유언"],
      ["verdict", "day", "낮", "찬반"], // 22-13(P22-3): 찬반은 토론 장면(낮) 그대로
      ["execution", "dusk", "저녁", "처형"],
    ];
    for (const [phase, tod, w, title] of cells) {
      const { container, unmount } = mount(makeView({ phase, candidate: 1 }));
      const lines = header(container).querySelectorAll("[data-tod]");
      expect(lines.length, phase).toBe(1);
      expect(lines[0]?.getAttribute("data-tod"), phase).toBe(tod);
      expect(word(container)?.textContent ?? null, phase).toBe(w);
      expect(header(container).querySelector(".mv-phase__title")?.textContent, phase).toBe(title);
      unmount();
    }
  });

  it("밤·아침은 한 단어: 낱말 요소·가운뎃점 0개, data-tod 는 night·morning", () => {
    for (const [phase, tod, title] of [["night", "night", "밤"], ["morning", "morning", "아침"]] as const) {
      const { container, unmount } = mount(makeView({ phase }));
      expect(header(container).querySelector("[data-tod]")?.getAttribute("data-tod"), phase).toBe(tod);
      expect(word(container), phase).toBeNull();
      expect(header(container).querySelector(".mv-phase__sep"), phase).toBeNull();
      expect(header(container).querySelector(".mv-phase__title")?.textContent, phase).toBe(title);
      unmount();
    }
  });

  it("tod={false} 로 그리면 [data-tod] 가 없다", () => {
    const { container } = render(<GameMap view={makeView()} store={new WorldStore()} chat={new ChatStore()} send={() => true} tod={false} />);
    expect(container.querySelectorAll("[data-tod]").length).toBe(0);
    expect(container.querySelector(".mv-phase__tod")).toBeNull();
    expect(container.querySelector(".mv-phase__title")?.textContent).toBe("토론");
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

  it("18.1-12: 낮 시작은 큰 글 없이 띠 한 구절이다 — 산 사람 '모두 모여 주세요', 유령 '지켜봐 주세요', 시간 행은 없다", () => {
    const line = (c: ParentNode) => c.querySelector("[data-host-line]")?.textContent;
    const alive = mount(makeView({ phase: "dayAnnounce", n: 2, noClock: true }));
    expect(announces(alive.container).length).toBe(0);
    expect(line(alive.container)).toBe("모두 모여 주세요");
    alive.unmount();
    const ghost = mount(makeView({ phase: "dayAnnounce", n: 2, noClock: true, dead: [0] }));
    expect(announces(ghost.container).length).toBe(0);
    expect(line(ghost.container)).toBe("지켜봐 주세요");
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

  it("처형 알림은 유언 카드(0~3.0초) 뒤에 선다: 3.0초 전에는 알림이 없고 3.0초에 '{이름} 님 처형' 하나, 큰 글 3.0초 뒤 사라진다(22-12 P22-13)", () => {
    const m = mount(makeView({ phase: "verdict", candidate: 1 }));
    m.show(makeView({ phase: "execution", candidate: 1, execution: { seat: 1 } }));
    expect(announces(m.container).length).toBe(0);
    advance(2999);
    expect(announces(m.container).length).toBe(0);
    advance(1);
    expect(announces(m.container).map((e) => e.textContent)).toEqual(["영희 님 처형"]);
    advance(3000);
    expect(announces(m.container).length).toBe(0);
  });

  it("알림 문자열은 텍스트 노드다: 닉네임 '<b>영희</b>' 가 HTML 이 아니라 글자로 보인다", () => {
    const names = ["민수", "<b>영희</b>", "서준", "지아"];
    const m = mount(makeView({ phase: "verdict", candidate: 1, nicknames: names }));
    m.show(makeView({ phase: "execution", candidate: 1, nicknames: names, execution: { seat: 1 } }));
    advance(3000);
    const el = announces(m.container)[0]!;
    expect(el.textContent).toBe("<b>영희</b> 님 처형");
    expect(el.querySelector("b")).toBeNull();
  });

  it("결과가 없으면 알림 요소를 만들지 않는다", () => {
    const { container } = mount(makeView());
    expect(container.querySelector("[data-announce]")).toBeNull();
  });

  it("알림 CSS: 패널 위 무대 가운데·36px 한 줄(keep-all, 28px 로 줄이지 않음)·뒤 night-950 62% 어둡게·움직임 줄이기", () => {
    const css = readFileSync("src/styles/game.css", "utf8");
    expect(css).toMatch(/\.mf-announce\s*\{[^}]*--mf-panel-h/);
    expect(css).toMatch(/\.mf-announce__text\s*\{[^}]*font:\s*var\(--type-headline\)/);
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

  // 기본판(결정 0072)에서 꺼짐 — 판 규칙의 badge·whisper 를 켜면 다시 돈다(떠 있는 버튼이 있어야 성립한다)
  it.skipIf(!GAME_RULES.badge)("③ 직업 배지 거절: deny 한 번", () => {
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

  it.skipIf(!GAME_RULES.whisper)("④ 귓속말 거절: deny 한 번", () => {
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

  it("산 사람의 공용 채팅은 입력칸·보내기·스크롤되는 기록이 함께 있고 채널 아이콘은 없다", () => {
    const { container } = mount(makeView());
    const panel = container.querySelector<HTMLElement>("[data-chat-panel]")!;
    expect(panel.getAttribute("data-chat-channel")).toBe("all");
    const input = panel.querySelector<HTMLInputElement>("[data-chat-input]")!;
    expect(input.getAttribute("aria-label")).toBe("채팅 입력");
    expect(input.getAttribute("placeholder")).toBe("메시지 입력");
    expect(panel.querySelector("[data-chat-send]")?.getAttribute("aria-disabled")).toBe("true");
    expect(panel.querySelector("[data-chat-open]")).toBeNull();
    expect(container.querySelector('[role="log"]')?.getAttribute("aria-label")).toBe("채팅 기록");
    expect(container.querySelector('[role="log"]')?.getAttribute("tabindex")).toBe("0");
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
    expect(line?.querySelector(".mv-chat__byline .mv-chat__name")?.textContent).toBe("나");
    expect(line?.querySelector(".mv-chat__avatar")?.getAttribute("src")).toBe(faceSrc(0));
    expect(line?.querySelector(".mv-chat__avatar")?.getAttribute("alt")).toBe("");
    expect(line?.querySelector(".mv-chat__byline")?.nextElementSibling?.textContent).toBe("저는 시민이에요");
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

// 22-10: 순차 지목의 이름표 계약(결정 0063-1, D-12). 동시 투표 화면(득표 배지·선두·도장·과반 확대·표마다 위 알림)은 지웠다. WorldStage 는 가짜라 pick·tagProps 로 이름표 계약을 본다
describe("GameMap — 순차 지목 이름표 (22-10, D-12)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  /** 지목 단계 view — pairs 는 [누가, 누구를], 차례는 기본으로 내 차례(좌석 0, i 0) */
  const voteView = (pairs: [number, number][] = [], o: ViewOpts & { i?: number } = {}): RoomView => {
    const { i = 0, ...rest } = o;
    const v = makeView({ phase: "nomination", ...rest });
    const order = v.players.filter((p) => p.alive !== false).map((p) => p.seat);
    return {
      ...v,
      phaseEndsAt: NOW + 15_000,
      phaseDurationMs: 15_000,
      day: { ...v.day!, points: pairs.map(([seat, target]) => ({ seat, target })), turn: { order, i, endsAt: NOW + 8000 } },
    };
  };
  const toastText = (c: ParentNode) => c.querySelector(".mv-toast__text")?.textContent ?? "";
  const sendOf = (): ReturnType<typeof vi.fn> => (connectionMock.current as RoomConnection).send as ReturnType<typeof vi.fn>;
  const tag = (seat: number) => stage.props?.tagProps?.(seat) ?? {};

  it("재즈 바 지목은 얼굴판에서만 보낸다. 확정 뒤 후보에게 이름표 강조나 핀 조명을 주지 않는다", () => {
    const view: RoomView = { ...voteView(), map: "bar" };
    const m = mount(view);
    const face = () => m.container.querySelector<HTMLButtonElement>('[data-table-seat="2"]')!;
    expect(stage.props?.pick).toBeUndefined();
    expect(tag(2)).toEqual({});
    expect(stage.props?.scene?.pin).toEqual({ mode: "turn", seat: 0 });
    expect(face().getAttribute("data-pick")).toBe("2");

    act(() => stage.props?.onTableSeat?.(2));
    expect(sendOf()).not.toHaveBeenCalled();
    fireEvent.click(face());
    expect(sendOf()).toHaveBeenCalledExactlyOnceWith({ t: "point", target: 2 });
    expect(face()).toBeNull();
    expect(m.container.querySelector("[data-table-dock]")?.getAttribute("data-dock-open")).toBe("closed");
    expect(tag(2)).toEqual({});

    const done = voteView([[0, 2]]);
    m.show({ ...done, map: "bar", day: { ...done.day!, turn: { ...done.day!.turn!, doneAt: NOW } } });
    expect(stage.props?.scene?.pin).toEqual({ mode: "turn", seat: 0 });
    expect(stage.props?.scene?.seats[0]?.pointAt).toBe(2);
    fireEvent.click(m.container.querySelector('[data-dock-tab="people"]')!);
    expect(face().getAttribute("aria-pressed")).toBe("true");
    expect(face().hasAttribute("data-pick")).toBe(false);
    expect(tag(2)).toEqual({});
  });

  it("다른 사람 차례의 채팅을 쓰다 내 차례가 오면 초점을 유지하고, 지목 후 초안을 이어 쓴다", () => {
    const chat = new ChatStore();
    const store = new WorldStore();
    const send = vi.fn();
    const frame = (i: number) => <GameMap view={{ ...voteView([], { count: 8, i }), map: "bar" }} store={store} chat={chat} send={send} />;
    chat.apply({ t: "chat", ch: "all", seq: 1, at: NOW, seat: 1, text: "첫 단서" }, 1, NOW);
    const { container, rerender } = render(frame(1));
    const mode = () => container.querySelector("[data-table-dock]")?.getAttribute("data-dock-open");
    expect(mode()).toBe("closed");
    const preview = container.querySelector("[data-dock-peek]")!;
    expect(preview.textContent).toContain("첫 단서");
    fireEvent.click(preview);
    const input = container.querySelector<HTMLInputElement>("[data-chat-input]")!;
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "쓰던 단서" } });
    rerender(frame(0));
    expect(mode()).toBe("chat");
    expect(document.activeElement).toBe(input);
    expect(container.querySelector('[data-dock-tab="people"][data-dock-vote]')?.textContent).toBe("지목");
    const vote = container.querySelector("[data-dock-vote]")!;
    expect(fireEvent.pointerDown(vote, { pointerType: "touch", pointerId: 1, button: 0 })).toBe(false);
    expect(fireEvent.mouseDown(vote)).toBe(false);
    expect(document.activeElement).toBe(input);
    fireEvent.click(vote);
    expect(mode()).toBe("people");
    expect(document.activeElement).not.toBe(input);
    expect(container.querySelectorAll("[data-dock-pane]")).toHaveLength(1);
    expect(container.querySelectorAll("[data-table-seat][data-pick]")).toHaveLength(7);
    fireEvent.click(container.querySelector('[data-table-seat="2"]')!);
    expect(send).toHaveBeenCalledWith({ t: "point", target: 2 });
    expect(mode()).toBe("closed");
    fireEvent.click(container.querySelector('[data-dock-tab="chat"]')!);
    expect(container.querySelector<HTMLInputElement>("[data-chat-input]")?.value).toBe("쓰던 단서");
  });

  it("토론의 하단 판은 하나만 열고, 닫힌 채팅에는 내 채널의 새 메시지만 센다", () => {
    const chat = new ChatStore();
    const store = new WorldStore();
    const room = { ...makeView(), map: "bar" as const };
    const { container } = render(<GameMap view={room} store={store} chat={chat} send={vi.fn()} />);
    const tab = (name: string) => container.querySelector<HTMLButtonElement>(`[data-dock-tab="${name}"]`)!;
    const mode = () => container.querySelector("[data-table-dock]")?.getAttribute("data-dock-open");
    const unread = () => container.querySelector("[data-dock-unread]")?.textContent;
    expect(mode()).toBe("chat");
    expect(tab("people").textContent).toBe("");
    fireEvent.click(tab("tools"));
    expect(mode()).toBe("tools");
    expect(container.querySelectorAll("[data-dock-pane]")).toHaveLength(1);
    expect(container.querySelector("[data-suspect-btn]")).not.toBeNull();
    expect(container.querySelector("[data-chat-input]")).toBeNull();
    act(() => {
      chat.apply({ t: "chat", ch: "all", seq: 1, at: NOW, seat: 1, text: "읽지 않은 단서" }, 1, NOW);
      chat.apply({ t: "chat", ch: "all", seq: 2, at: NOW, seat: 0, text: "내가 보낸 단서" }, 1, NOW);
      chat.apply({ t: "chat", ch: "ghost", seq: 1, at: NOW, seat: 2, text: "다른 채널" }, 1, NOW);
    });
    expect(unread()).toBe("1");
    fireEvent.click(tab("chat"));
    expect(unread()).toBeUndefined();
    expect(container.querySelector("[data-chat-log]")?.textContent).toContain("읽지 않은 단서");
    expect(container.querySelector("[data-chat-log]")?.textContent).not.toContain("다른 채널");
    fireEvent.click(tab("people"));
    expect(unread()).toBeUndefined();
    expect(mode()).toBe("people");
    expect(container.querySelector("[data-pick]")).toBeNull();
    fireEvent.click(container.querySelector("[data-dock-handle]")!);
    expect(mode()).toBe("closed");
    expect(document.activeElement).toBe(tab("people"));
  });

  it("차례가 마감되면 다음 프레임을 받기 전에도 지목 얼굴판을 접는다", () => {
    const { container } = mount({ ...voteView(), map: "bar" });
    const dock = container.querySelector("[data-table-dock]")!;
    expect(dock.getAttribute("data-dock-open")).toBe("people");
    act(() => vi.advanceTimersByTime(8000));
    expect(dock.getAttribute("data-dock-open")).toBe("closed");
    expect(dock.querySelector("[data-dock-vote]")).toBeNull();
    expect(sendOf()).not.toHaveBeenCalled();
  });

  it("다음 날 같은 차례 번호에도 지목 얼굴판을 다시 연다", () => {
    const m = mount({ ...voteView(), map: "bar" });
    fireEvent.click(m.container.querySelector('[data-pick="2"]')!);
    expect(m.container.querySelector("[data-dock-vote]")).toBeNull();
    m.show({ ...voteView([], { n: 2 }), map: "bar" });
    expect(m.container.querySelector('[data-dock-pane="people"] [data-pick="2"]')).not.toBeNull();
  });

  it("산 사람 4명, 내 차례: 나를 뺀 세 이름표가 누를 수 있고 묶음 '지목', 이름 '{닉네임} 님 가리키기'", () => {
    mount(voteView());
    const pick = stage.props?.pick;
    expect([...(pick?.seats ?? [])].sort()).toEqual([1, 2, 3]);
    expect(pick?.group).toBe("지목");
    expect(pick?.label("영희")).toBe("영희 님 가리키기");
    expect(pick?.mine).toBeUndefined();
  });

  it("남의 차례에는 누를 수 있는 이름표가 없다(P22-17: 차례 밖은 비활성)", () => {
    mount(voteView([], { i: 1 }));
    expect(stage.props?.pick).toBeUndefined();
  });

  it("누르면 point 를 한 번 보내고 내 선택(mine)만 바로 바뀌며 이름표는 더 눌리지 않는다(취소·바꾸기 없음)", () => {
    mount(voteView());
    act(() => stage.props!.pick!.onPick(2));
    expect(sendOf()).toHaveBeenCalledTimes(1);
    expect(sendOf()).toHaveBeenLastCalledWith({ t: "point", target: 2 });
    expect(stage.props?.pick).toBeUndefined();
    expect(tag(2).mine).toBe(true);
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
    expect(tag(2).mine).toBe(true);
    act(() => listeners.forEach((l) => l({ t: "error", code: "WRONG_PHASE" }, { epoch: 1 })));
    expect(toastText(container)).toBe("지금은 고를 수 없어요");
    expect(tag(2).mine).toBeUndefined();
    expect(stage.props?.pick?.mine).toBeUndefined();
  });

  it("내 서버 표가 있으면 mine 이고 유령은 누를 수 있는 이름표가 없다", () => {
    mount(voteView([[0, 2]]));
    expect(tag(2).mine).toBe(true);
    cleanup();
    mount(voteView([], { dead: [0] }));
    expect(stage.props?.pick).toBeUndefined();
  });

  it("득표 배지·선두·도장이 없다: 3표를 받은 이름표도 count·lead·sure 가 없고 mine 만 있다(산 5명 과반·산 8명 선두 모두)", () => {
    mount(voteView([[0, 2], [1, 2], [3, 2], [4, 0]], { count: 5 }));
    expect(tag(2)).toEqual({ mine: true });
    expect(tag(0).count).toBeUndefined();
    cleanup();
    mount(voteView([[0, 2], [1, 2], [3, 2], [4, 5]], { count: 8 }));
    expect(tag(2)).toEqual({ mine: true });
    expect(tag(5)).toEqual({});
  });

  it("카메라·조명: 과반이어도 확대 1, 긴장 0 (과반 확대 삭제)", () => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
    mount(voteView([[0, 2], [1, 2], [3, 2]], { count: 5 }));
    expect(stage.props?.scene?.tension).toBe(0);
    expect(stage.props?.scene?.focusSeat).toBeUndefined();
    expect((stage.props?.scene?.camera as { zoom?: number }).zoom).toBe(1);
  });

  it("내 차례에는 누를 수 있는 이름표가 깜빡이고(blink) 차례 밖에서는 깜빡임이 없다", () => {
    mount(voteView());
    expect(tag(1).blink).toBe(true);
    expect(tag(1).call).toBeUndefined();
    expect(tag(0).blink).toBeUndefined();
    cleanup();
    mount(voteView([], { i: 2 }));
    expect(tag(1).blink).toBeUndefined();
  });

  it("지목 단계: 차례 알약·막대가 있고(헤더 링은 차례 초) 차례 동안 어둡게 막이 on", () => {
    const { container } = mount(voteView());
    expect(container.querySelector("[data-turn-block]")).not.toBeNull();
    const { container: under } = render(<>{stage.props?.underlay}</>);
    expect(under.querySelector(".mf-game__dim")?.getAttribute("data-dim")).toBe("on");
  });

  it("표마다 위 알림도 채팅 줄도 없다 — 새 표가 와도 TopToast 가 뜨지 않는다", () => {
    const m = mount(makeView({ phase: "discussion" }));
    m.show(voteView());
    expect(toastText(m.container)).toBe("");
    m.show(voteView([[1, 2]], { i: 2 }));
    expect(toastText(m.container)).toBe("");
    m.show(voteView([[1, 2], [3, 2]], { i: 3 }));
    expect(toastText(m.container)).toBe("");
    const log = m.container.querySelector("[data-chat-log]")?.textContent ?? "";
    expect(log).not.toContain("→"); // 22-10: 지목 줄은 채팅에 쌓이지 않는다
  });

  it("재접속 첫 스냅샷은 위 알림·채팅 줄 없이 지금 표를 바로 그린다", () => {
    const { container } = mount(voteView([[1, 2], [3, 2], [0, 2]], { count: 5, i: 4 }));
    expect(toastText(container)).toBe("");
    expect(container.querySelector("[data-chat-log]")?.textContent ?? "").not.toContain("→");
    expect(tag(2)).toEqual({ mine: true });
  });

  it("닉네임의 HTML 은 어디서도 요소가 되지 않는다", () => {
    const nicknames = ["민수", "<b>영희</b>", "서준", "지아"];
    const m = mount(makeView({ phase: "discussion", nicknames }));
    m.show(voteView([], { nicknames, i: 2 }));
    m.show(voteView([[1, 2]], { nicknames, i: 3 }));
    expect(m.container.querySelector("[data-turn-block]")?.textContent).not.toContain("<b>영희</b> 님이"); // 위 한 줄은 글자로만(차례 알약)
    expect(m.container.querySelector("[data-chat-log] b")).toBeNull();
  });

  it("연결이 끊기면(canSend 거짓) 이름표 버튼이 disabled 이다", () => {
    mount(voteView(), { canSend: false });
    expect(stage.props?.pick?.disabled).toBe(true);
    cleanup();
    mount(voteView());
    expect(stage.props?.pick?.disabled).toBeUndefined();
  });
});

// 19-02(D-03·D-09, UI-SPEC E-1): 기본 마피아 판 화면. 서버가 기록·흔적 키를 싣지 않고 화면은 키가 없으면 그리지 않는다 — 숨김이 아니라 DOM 에 없다.
// 화면의 규칙 판정은 상수 RULES 다(22-07: 판 종류가 없다).
describe("GameMap — 꺼진 장치의 화면 (19-02, D-09, 22-07)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  /** 서버가 싣는 모양 그대로: me.record·day.evidence·morning.trace·seen 키가 없다 */
  const modeView = (o: ViewOpts = {}, extra: { morning?: MorningView; endsInMs?: number } = {}): RoomView => {
    const v = makeView(o);
    return {
      ...v,
      ...(extra.endsInMs !== undefined ? { phaseEndsAt: NOW + extra.endsInMs } : {}),
      day: { ...v.day!, ...(extra.morning !== undefined ? { morning: extra.morning } : {}) },
    };
  };
  /** 기록·흔적·증거 요소의 DOM 수와 이름표 표시 수 */
  const census = (c: ParentNode): string => {
    const n = (sel: string): number => c.querySelectorAll(sel).length;
    const tags = [0, 1, 2, 3].map((seat) => (stage.props?.tagProps?.(seat) ?? {}) as { traceMark?: unknown; seenMark?: unknown });
    const marks = tags.filter((t) => t.traceMark !== undefined || t.seenMark !== undefined).length;
    return `기록 단추 ${n("button[aria-label='기록']")}·칸 ${n("[data-record-button]")}·카드 ${n("[data-record-card]")}·증거 카드 ${n("[data-trace-card]")}·목격 줄 ${n("[data-lastseen-row]")}·이름표 표시 ${marks}`;
  };
  const NONE = "기록 단추 0·칸 0·카드 0·증거 카드 0·목격 줄 0·이름표 표시 0";
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  it("토론: [기록] 머리 단추·목격 기록 카드·증거 카드·이름표 표시가 DOM 에 없고 [내 역할] 과 사회자 줄(토론 문구)은 그대로다", () => {
    const { container } = mount(modeView({ phase: "discussion" }));
    expect(census(container)).toBe(NONE);
    expect(container.querySelector("[data-host-line]")?.textContent).toBe("의심 가는 사람을 이야기해 주세요");
    expect(container.querySelectorAll("[data-end-discussion]").length).toBe(1);
  });

  it("아침(morning.eliminated 뿐): 흔적 구간이 지나도 증거 카드·이름표 표시가 없고 탈락 발표는 그대로 있다", () => {
    const { container } = mount(modeView({ phase: "morning", dead: [2] }, { morning: { eliminated: 2 }, endsInMs: 7000 }));
    expect(census(container)).toBe(NONE);
    advance(2500);
    expect(census(container)).toBe(NONE);
    expect(container.textContent).toContain("서준 님이 밤사이 탈락했어요");
  });

  it("낮 단계(투표·변론·찬반·처형) 어디에도 기록·흔적·증거 요소가 없다", () => {
    const phases: PhaseId[] = ["nomination", "defense", "verdict", "execution"];
    const seen = phases.map((phase) => {
      const { container, unmount } = mount(modeView({ phase, candidate: 1, ...(phase === "execution" ? { execution: { seat: 1 } } : {}) }));
      const row = `${phase}:${census(container) === NONE}`;
      unmount();
      return row;
    });
    expect(seen.join(" ")).toBe("nomination:true defense:true verdict:true execution:true");
  });

  it("귓속말·배지 진입점이 없다 (정치 장치는 RULES 에서 꺼짐)", () => {
    const v = modeView({ phase: "discussion" });
    const { container } = mount(v);
    expect(`${whisperVisible(v)}/${floatVisible(v)}/${container.querySelectorAll("[data-badge-live]").length}`).toBe("false/false/0");
  });
});

// 19-02(D-03): 귓속말 시트의 공개 예고 문구는 전역 값이 아니라 받은 규칙 값으로 정한다 — LineSheet 는 whisper 속성을, 문구 표는 인자를 받는다.
describe("공개 예고 문구 — 규칙은 인자다 (19-02, D-03)", () => {
  const noticeOf = (whisper?: boolean): string => {
    const { container, unmount } = render(
      <LineSheet peer={{ seat: 1, name: "영희" }} value="" onChange={() => {}} onSend={() => {}} onClose={() => {}} {...(whisper === undefined ? {} : { whisper })} />,
    );
    const text = container.querySelector("[data-pre-notice]")?.textContent ?? "";
    unmount();
    return text;
  };

  it("문구 표: 귓속말이 꺼진 판은 '끝나면 밤 대화가 공개돼요', 켜진 규칙은 귓속말을 함께 말한다", () => {
    expect(RESULT_PANEL_TEXT.preNotice(false)).toBe("끝나면 밤 대화가 공개돼요");
    expect(RESULT_PANEL_TEXT.preNotice(true)).toBe("끝나면 밤 대화와 귓속말이 공개돼요");
  });

  it("LineSheet: whisper 속성이 없거나 false 면 밤 대화만, true 면 귓속말을 함께 말한다", () => {
    expect([noticeOf(), noticeOf(false), noticeOf(true)].join(" | ")).toBe("끝나면 밤 대화가 공개돼요 | 끝나면 밤 대화가 공개돼요 | 끝나면 밤 대화와 귓속말이 공개돼요");
  });
});

// 24-03(D-31): 튜토리얼이 쓸 GameMap 선택 prop. 주지 않으면 기존 동작 그대로(실제 판은 넘기지 않는다).
describe("GameMap — bottomExtra 는 스테이지 아래 여백에 더해진다 (24-03)", () => {
  const PANEL_H = LOG_H + 154;
  const realInnerH = window.innerHeight;
  beforeEach(() => {
    Object.defineProperty(window, "innerHeight", { value: 844, configurable: true, writable: true });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("mf-game__panel")) return PANEL_H;
      if (this.classList.contains("mf-game__header")) return 62;
      return 0;
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Object.defineProperty(window, "innerHeight", { value: realInnerH, configurable: true, writable: true });
  });

  const mountMap = (extra: { bottomExtra?: number }) =>
    render(<GameMap view={makeView()} store={new WorldStore()} chat={new ChatStore()} send={() => true} tod={false} {...extra} />);

  it("주지 않으면 패널 높이 그대로다", () => {
    mountMap({});
    expect(stage.props?.stageInsets).toEqual({ top: 62, bottom: PANEL_H });
  });
  it("bottomExtra 60 → 아래 여백이 60 늘고 위는 그대로다", () => {
    mountMap({ bottomExtra: 60 });
    expect(stage.props?.stageInsets).toEqual({ top: 62, bottom: PANEL_H + 60 });
  });
});
