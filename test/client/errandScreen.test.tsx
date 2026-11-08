import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { bindSignals } from "../../src/audio/signals";
import type { LocalSignal } from "../../src/audio/signals";
import type { RoleId } from "../../shared/game/roles";
import type { PlaceId, PublicPlayer, RoomView } from "../../shared/protocol";
import type { WorldStageProps } from "../../src/components/WorldStage";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 15-05·16-07: errand 단계의 맵 화면(독 칩·장소 타일·장소 위 [처리] 알약 전송·빛남·유령·역할 무관). WorldStage 는 받은 props 만 쥐는 가짜(gameMap.test 와 같은 틀) —
// 표지·링·투영은 worldStage.test 가 진짜 런타임으로 본다. 나머지(GameMap·GamePanel 분기·ErrandDock)는 진짜.
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
const stage = vi.hoisted(() => ({ props: null as null | WorldStageProps }));
vi.mock("../../src/components/WorldStage", async () => {
  const { createElement } = await import("react");
  return {
    WorldStage: (props: WorldStageProps) => {
      stage.props = props;
      return createElement("div", { "data-world-stage-fake": "" });
    },
  };
});
const { RoomScreen } = await import("../../src/screens/RoomScreen");

afterEach(() => {
  cleanup();
  stage.props = null;
  vi.useRealTimers();
});

const NOW = 1_700_000_000_000;
// bar 맵 장소 중심(월드 단위): glass(-3.9, -2.2) · piano(-2.6, -5.6) · sax(-0.2, -5.2) · door(5.2, 5.0)
const LIST: PlaceId[] = ["glass", "piano", "sax"];

interface Opts {
  done?: PlaceId[];
  role?: RoleId;
  dead?: boolean;
  noList?: boolean;
}

function makeView(o: Opts = {}): RoomView {
  const players: PublicPlayer[] = [0, 1, 2, 3].map((seat) => ({
    seat,
    nickname: ["민수", "영희", "서준", "지아"][seat]!,
    connected: true,
    isHost: seat === 0,
    ...(o.dead === true && seat === 0 ? { alive: false } : {}),
  }));
  return {
    code: "0042",
    phase: "errand",
    phaseEndsAt: NOW + 40_000,
    phaseDurationMs: 40_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    map: "bar",
    players,
    me: {
      seat: 0,
      isHost: true,
      chat: o.dead === true ? "ghost" : "all",
      ...(o.role !== undefined ? { role: o.role } : {}),
      ...(o.dead === true || o.noList === true ? {} : { errand: { places: [...LIST], done: [...(o.done ?? [])] } }),
    },
    day: { n: 1, roles: [] },
  };
}

function conn(view: RoomView, send: RoomConnection["send"], canSend = true): RoomConnection {
  return {
    status: "open",
    banner: "hidden",
    view,
    offset: 0,
    epoch: 1,
    removedReason: null,
    canSend,
    send,
    onEvent: vi.fn(() => () => {}),
    reconnect: vi.fn(),
    retry: vi.fn(),
  } as unknown as RoomConnection;
}

function mount(view: RoomView, send: RoomConnection["send"] = vi.fn(() => true), canSend = true) {
  connectionMock.current = conn(view, send, canSend);
  const ui = () => <RoomScreen code="0042" token={"t".repeat(43)} onExit={() => {}} />;
  const r = render(ui());
  return {
    ...r,
    send,
    show: (v: RoomView, canSendNow = canSend) => {
      connectionMock.current = conn(v, send, canSendNow);
      r.rerender(ui());
    },
  };
}

/** 내(좌석 0) 위치를 월드 단위로 서 있게 한다(서버 snap) */
function standAt(x: number, z: number): void {
  act(() => {
    stage.props!.store.applyFrame({ t: "world", k: "snap", at: Date.now(), ents: [{ s: 0, p: [Math.round(x * 100), Math.round(z * 100)], t0: Date.now() - 1000, v: 180 }], near: true }, 1);
  });
}
const FAR = { x: 5.2, z: 5.0 }; // 어느 장소와도 1.2 보다 멀다(door 근처, 내 목록 밖)

/** 장소 위 [처리] 알약은 WorldStage 층이 그린다(여기 WorldStage 는 가짜) — GameMap 은 actId·onAct 만 넘긴다 */
const act$ = (c: ParentNode) => c.querySelector<HTMLElement>("[data-errand-act]");
const actId = (): string | null => stage.props!.errand!.actId;
/** [처리] 알약을 누른다 */
const pressAct = (): void => {
  act(() => stage.props!.errand!.onAct?.());
};
const taps = (): { off: () => void; count: () => number } => {
  const got: LocalSignal[] = [];
  const off = bindSignals((sig) => got.push(sig));
  return { off, count: () => got.filter((g) => g.kind === "tap").length };
};
const dock = (c: ParentNode) => c.querySelector<HTMLElement>("[data-errand-dock]");

describe("errand 화면: 아래 패널 (D-09, U-1·U-16)", () => {
  it("산 사람(역할 무관): 독 하나·칩 3·진행 0/3·독에는 [처리] 가 없다, 채팅 입력·[토론 끝내기]·유언·행동 줄은 없고 패널 section 에 data-world-panel 이 있다", () => {
    for (const role of ["mafia", "citizen"] as const) {
      const { container, unmount } = mount(makeView({ role }));
      expect(container.querySelectorAll("[data-errand-dock]")).toHaveLength(1);
      expect(container.querySelectorAll("[data-errand-chip]")).toHaveLength(3);
      expect(container.querySelector("[data-errand-progress]")!.getAttribute("data-errand-progress")).toBe("0/3");
      expect(container.querySelectorAll("[data-errand-act]")).toHaveLength(0);
      expect(dock(container)!.querySelector("button")).toBeNull();
      expect(container.querySelector("[data-chat-input]")).toBeNull();
      expect(container.querySelector("[data-end-discussion]")).toBeNull();
      expect(container.querySelector("[data-will-button]")).toBeNull();
      const panel = container.querySelector("section[data-world-panel]")!;
      expect(panel.className).toContain("mf-game__panel--errand");
      expect(panel.contains(dock(container))).toBe(true);
      unmount();
    }
  });

  it("유령(내가 탈락): 같은 높이 패널 section 이 있되 독·칩·[처리] 는 0개, 채팅 패널도 없다", () => {
    const { container } = mount(makeView({ dead: true }));
    const panel = container.querySelector("section[data-world-panel]")!;
    expect(panel).not.toBeNull();
    expect(panel.className).toContain("mf-game__panel--errand");
    expect(dock(container)).toBeNull();
    expect(container.querySelectorAll("[data-errand-chip]")).toHaveLength(0);
    expect(act$(container)).toBeNull();
    expect(container.querySelector("[data-chat-input]")).toBeNull();
  });

  it("심부름 단계가 아니면 기존 GamePanel 이다(회귀) — 독은 없다", () => {
    const view = { ...makeView(), phase: "discussion" as const };
    const { container } = mount(view);
    expect(dock(container)).toBeNull();
    expect(container.querySelector("section[data-world-panel]")!.className).not.toContain("mf-game__panel--errand");
  });
});

describe("errand 화면: [처리] 알약 전송 (D-01·D-06, ERRAND-02·03)", () => {
  it("처리 반경 안 미완료 장소가 있으면 actId 가 그 장소이고 알약을 누르면 { t: 'errand' } 가 한 번, ui.tap 신호가 한 번 간다", () => {
    const { send } = mount(makeView());
    const t = taps();
    standAt(-3.9, -2.2);
    expect(actId()).toBe("glass");
    pressAct();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ t: "errand" });
    expect(t.count()).toBe(1);
    t.off();
  });

  it("반경 밖에서는 actId 가 없고(알약이 DOM 에 없다) 눌러도 보내지 않으며 알림도 소리도 없다", () => {
    const { container, send } = mount(makeView());
    const t = taps();
    standAt(FAR.x, FAR.z);
    expect(actId()).toBeNull();
    expect(act$(container)).toBeNull();
    pressAct();
    expect(send).not.toHaveBeenCalled();
    expect(t.count()).toBe(0);
    expect(container.querySelector("[role=alert]")).toBeNull();
    t.off();
  });

  it("이미 처리한 장소 위에서는 알약이 없다", () => {
    const { send } = mount(makeView({ done: ["glass"] }));
    standAt(-3.9, -2.2);
    expect(actId()).toBeNull();
    pressAct();
    expect(send).not.toHaveBeenCalled();
  });

  it("canSend 가 거짓이면 반경 안에서도 보내지 않는다", () => {
    const { send } = mount(makeView(), vi.fn(() => true), false);
    const t = taps();
    standAt(-3.9, -2.2);
    pressAct();
    expect(send).not.toHaveBeenCalled();
    expect(t.count()).toBe(0);
    t.off();
  });

  it("send 가 false(소켓 닫힘)를 돌려줘도 화면은 그대로다", () => {
    const send = vi.fn(() => false);
    const { container } = mount(makeView(), send);
    standAt(-3.9, -2.2);
    const before = container.innerHTML;
    pressAct();
    expect(send).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe(before);
  });

  it("독에는 [처리] 단추가 없다(처리 입구는 장소 위 알약 하나)", () => {
    const { container } = mount(makeView());
    standAt(-3.9, -2.2);
    expect(dock(container)!.querySelectorAll("button, [data-errand-act]")).toHaveLength(0);
  });
});

describe("errand 화면: 진행 (U-6)", () => {
  it("view.me.errand.done 이 늘면 칩이 채워지고 표지(errand prop)가 done 이 되며 n/3 이 갱신된다, 3/3 이면 알약 없음", () => {
    const m = mount(makeView());
    standAt(FAR.x, FAR.z);
    expect(stage.props!.errand!.places.map((p) => p.done)).toEqual([false, false, false]);
    m.show(makeView({ done: ["glass"] }));
    expect(m.container.querySelectorAll("[data-errand-chip][data-done]")).toHaveLength(1);
    expect(m.container.querySelector("[data-errand-progress]")!.getAttribute("data-errand-progress")).toBe("1/3");
    expect(stage.props!.errand!.places.find((p) => p.id === "glass")!.done).toBe(true);
    m.show(makeView({ done: ["glass", "piano", "sax"] }));
    expect(actId()).toBeNull();
    expect(act$(m.container)).toBeNull();
    expect(m.container.querySelector("[data-errand-progress]")!.getAttribute("data-errand-progress")).toBe("3/3");
  });
});

describe("errand 화면: WorldStage errand prop (D-02, U-3·U-5)", () => {
  it("내 목록 3곳의 월드 중심·nearR(3)·다음 장소를 넘기고, 유령·목록 없음이면 prop 이 없다", () => {
    mount(makeView());
    const e = stage.props!.errand!;
    expect(e.places).toEqual([
      { id: "glass", x: -3.9, z: -2.2, done: false },
      { id: "piano", x: -2.6, z: -5.6, done: false },
      { id: "sax", x: -0.2, z: -5.2, done: false },
    ]);
    expect(e.nearR).toBe(3);
    cleanup();
    mount(makeView({ dead: true }));
    expect(stage.props!.errand).toBeUndefined();
    cleanup();
    mount(makeView({ noList: true }));
    expect(stage.props!.errand).toBeUndefined();
  });

  it("다음 장소는 내 위치에서 가장 가까운 미완료이고 위치가 바뀌면 옮겨 간다", () => {
    mount(makeView());
    standAt(-3.9, -2.2);
    expect(stage.props!.errand!.nextId).toBe("glass");
    standAt(-0.2, -5.0);
    expect(stage.props!.errand!.nextId).toBe("sax");
  });

  it("표지를 눌러 걷는 일은 WorldStage 몫이고 GameMap 은 처리 메시지를 보내지 않는다", () => {
    const { send } = mount(makeView());
    stage.props!.errand!.onWalk?.("glass");
    expect(send).not.toHaveBeenCalled();
  });
});

describe("errand 화면: 빛남은 한 화면 한 종류 (UI-SPEC 빛남 우선순위)", () => {
  // 알약(actId)과 가장 가까운 타일(callPlace) 중 하나만 빛난다. 알약·타일의 실제 빛은 WorldStage 층이 쓴다(worldStage.test)
  const glowCount = (c: ParentNode): number => c.querySelectorAll("[data-call]").length + (stage.props?.errand?.callPlace === true ? 1 : 0) + (stage.props?.errand?.actId != null ? 1 : 0);

  it("반경 밖: 다음 장소 타일(callPlace)만 빛나고 알약은 없다", () => {
    const { container } = mount(makeView());
    standAt(FAR.x, FAR.z);
    expect(stage.props!.errand!.callPlace).toBe(true);
    expect(actId()).toBeNull();
    expect(glowCount(container)).toBe(1);
  });

  it("반경 안: 알약만 빛나고 타일 빛(callPlace)은 꺼진다", () => {
    const { container } = mount(makeView());
    standAt(-3.9, -2.2);
    expect(stage.props!.errand!.callPlace).toBe(false);
    expect(actId()).toBe("glass");
    expect(glowCount(container)).toBe(1);
  });

  it("3곳 완료·유령·목록 없음은 빛이 없다", () => {
    const done = mount(makeView({ done: [...LIST] }));
    standAt(FAR.x, FAR.z);
    expect(glowCount(done.container)).toBe(0);
    cleanup();
    const ghost = mount(makeView({ dead: true }));
    expect(glowCount(ghost.container)).toBe(0);
  });

  it("빛은 14페이즈의 '이미 썼는가' 와 무관하다: [처리] 를 눌러도 위치·진행이 그대로면 알약이 남는다", () => {
    mount(makeView());
    standAt(-3.9, -2.2);
    pressAct();
    expect(actId()).toBe("glass");
  });
});

describe("errand 화면: 마피아와 시민은 같은 DOM (D-03, ERRAND-04, T-15-20)", () => {
  const attrNames = (c: HTMLElement): string[] => {
    const set = new Set<string>();
    for (const el of c.querySelectorAll("*")) for (const a of el.getAttributeNames()) if (a.startsWith("data-") || a.startsWith("aria-")) set.add(`${el.tagName}.${a}`);
    return [...set].sort();
  };
  const panelOf = (c: HTMLElement): HTMLElement => c.querySelector<HTMLElement>("section[data-world-panel]")!;

  it("역할만 바꾼 렌더 네 번: 아래 패널의 마크업과 errand prop 이 같다", () => {
    const outs: { html: string; names: string[]; prop: string }[] = [];
    for (const role of ["mafia", "citizen", "police", "doctor"] as const) {
      const { container, unmount } = mount(makeView({ role, done: ["glass"] }));
      standAt(FAR.x, FAR.z);
      outs.push({ html: panelOf(container).outerHTML, names: attrNames(panelOf(container)), prop: JSON.stringify({ ...stage.props!.errand, onWalk: undefined, onAct: undefined }) });
      unmount();
    }
    for (const o of outs.slice(1)) {
      expect(o.html).toBe(outs[0]!.html);
      expect(o.names).toEqual(outs[0]!.names);
      expect(o.prop).toBe(outs[0]!.prop);
    }
  });

  it("처리 반경 안(알약이 있을 때)도 역할만 다른 네 렌더의 패널 마크업·errand prop 이 같다(가짜 장소를 모른다, V-25)", () => {
    const outs: { html: string; prop: string }[] = [];
    for (const role of ["mafia", "citizen", "police", "doctor"] as const) {
      const { container, unmount } = mount(makeView({ role }));
      standAt(-3.9, -2.2);
      outs.push({ html: panelOf(container).outerHTML, prop: JSON.stringify({ ...stage.props!.errand, onWalk: undefined, onAct: undefined }) });
      unmount();
    }
    for (const o of outs.slice(1)) {
      expect(o.html).toBe(outs[0]!.html);
      expect(o.prop).toBe(outs[0]!.prop);
    }
    expect(outs[0]!.prop).toContain('"actId":"glass"');
  });

  it("errand 분기 코드가 역할(me.role)·동료(allies)를 읽지 않는다", () => {
    const src = readFileSync("src/screens/GameMap.tsx", "utf8");
    const lines = src
      .split("\n")
      .filter((l) => !/^\s*\/\//.test(l))
      .filter((l) => /errand/i.test(l));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.filter((l) => /me\.role|allies/.test(l))).toEqual([]);
    const hook = readFileSync("src/net/useErrandPos.ts", "utf8");
    expect(hook).not.toMatch(/\.role\b|allies/);
  });
});
