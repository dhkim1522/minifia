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

// 15-05·16-07·16-08·21-11: errand 단계의 맵 화면(독의 [켜기]·[건너뛰기]·진행 점·시작 카드·장소 타일·빛남·유령·역할 무관). 판 종류가 없는 view 는 확장판이라 저녁은 독이 있고 장소 위 [처리] 알약은 없다(21-11). WorldStage 는 받은 props 만 쥐는 가짜(gameMap.test 와 같은 틀) —
// 표지·링·투영은 worldStage.test 가 진짜 런타임으로 본다. 나머지(GameMap·GamePanel 분기·ErrandDots·ErrandStartCard)는 진짜.
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
  /** 서버가 센 건너뛰기 누른 수(day.skipCount) */
  skipCount?: number;
  /** 내가 건너뛰기를 눌렀다(me.skipPhase) */
  skipMine?: boolean;
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
      ...(o.skipMine === true ? { skipPhase: true as const } : {}),
    },
    day: { n: 1, roles: [], ...(o.skipCount !== undefined ? { skipCount: o.skipCount } : {}) },
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

/** 독의 [켜기](21-11): 장소 위 [처리] 알약 대신 독 안 단추 하나가 data-errand-act 를 가진다(WorldStage 는 가짜 — 알약은 어차피 그리지 않는다) */
const act$ = (c: ParentNode) => c.querySelector<HTMLElement>("[data-errand-act]");
const dock$ = (c: ParentNode) => c.querySelector<HTMLElement>("[data-scene-dock]");
const skip$ = (c: ParentNode) => c.querySelector<HTMLElement>("[data-skip-phase]");
const actId = (): string | null => stage.props!.errand!.actId;
/** [켜기] 를 짧게 누른다(손가락 뗌) */
const pressAct = (): void => {
  const b = act$(document)!;
  fireEvent.pointerDown(b);
  fireEvent.pointerUp(b);
};
const taps = (): { off: () => void; count: () => number } => {
  const got: LocalSignal[] = [];
  const off = bindSignals((sig) => got.push(sig));
  return { off, count: () => got.filter((g) => g.kind === "tap").length };
};
const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};
const dots = (c: ParentNode) => c.querySelector<HTMLElement>("[data-errand-dots]");
const card = (c: ParentNode) => c.querySelector<HTMLElement>("[data-errand-start-card]");

describe("errand 화면: 저녁 독·진행 점 (D-05·D-24, P21-1·P21-5·P21-7)", () => {
  it("산 사람(역할 무관): 독 하나(기록 두 줄·입력줄 없음)·진행 점 줄 하나·점 3·'등불 0/3', [켜기] 단추(data-errand-act)는 독 안에 하나, [처리] 알약·토론 끝내기·유언은 없다", () => {
    for (const role of ["mafia", "citizen"] as const) {
      const { container, unmount } = mount(makeView({ role }));
      expect(container.querySelectorAll("[data-scene-dock]")).toHaveLength(1);
      expect(dock$(container)!.classList.contains("mf-game__panel")).toBe(true);
      expect(dock$(container)!.querySelector("[data-chat-log]")).not.toBeNull();
      expect(container.querySelectorAll("[data-errand-dock], [data-errand-chip]")).toHaveLength(0);
      expect(container.querySelectorAll("[data-errand-dots]")).toHaveLength(1);
      expect(container.querySelectorAll("[data-errand-dot]")).toHaveLength(3);
      expect(dots(container)!.getAttribute("data-errand-progress")).toBe("0/3");
      expect(dots(container)!.getAttribute("aria-label")).toBe("등불 0/3");
      expect(container.querySelectorAll("[data-errand-act]")).toHaveLength(1);
      expect(dock$(container)!.contains(act$(container))).toBe(true);
      expect(container.querySelector(".mv-errand-act")).toBeNull();
      expect(container.querySelector("[data-chat-input]")).toBeNull();
      expect(container.querySelector("[data-end-discussion]")).toBeNull();
      expect(container.querySelector("[data-will-button]")).toBeNull();
      unmount();
    }
  });

  it("독이 있으니 WorldStage 에 dock 플래그가 간다(장소 위 알약을 그리지 않는다). 독이 없는 유령은 errand prop 이 없다", () => {
    mount(makeView());
    expect(stage.props!.errand!.dock).toBe(true);
  });

  it("유령(내가 탈락)·목록 없음: 진행 점·시작 카드·패널 모두 없다(채팅 패널도 없다)", () => {
    for (const o of [{ dead: true }, { noList: true }]) {
      const { container, unmount } = mount(makeView(o));
      expect(dots(container)).toBeNull();
      expect(card(container)).toBeNull();
      expect(container.querySelector("section[data-world-panel]")).toBeNull();
      expect(dock$(container)).toBeNull();
      expect(skip$(container)).toBeNull();
      expect(act$(container)).toBeNull();
      expect(container.querySelector("[data-chat-input]")).toBeNull();
      unmount();
    }
  });

  it("심부름 단계가 아니면 기존 GamePanel 이다(회귀) — 진행 점은 없다", () => {
    const view = { ...makeView(), phase: "discussion" as const };
    const { container } = mount(view);
    expect(dots(container)).toBeNull();
    expect(container.querySelector("section[data-world-panel]")).not.toBeNull();
  });
});

describe("errand 화면: 시작 카드 2초 (D-06, V-19, ERRAND-06)", () => {
  const at = (ms: number): void => {
    vi.useFakeTimers({ now: NOW + ms });
  };

  it("단계 시작 1초 뒤 들어오면 카드가 있고(내 장소 3 타일), 2초가 지나면 사라진다 — 진행 점·타일은 그대로", () => {
    at(1_000);
    const { container } = mount(makeView());
    expect(card(container)).not.toBeNull();
    expect(card(container)!.querySelectorAll("[role='img']")).toHaveLength(3);
    expect(card(container)!.querySelector("h2")!.textContent).toBe("오늘 켤 등불");
    advance(500);
    expect(card(container)).not.toBeNull();
    advance(600);
    expect(card(container)).toBeNull();
    expect(dots(container)).not.toBeNull();
    expect(stage.props!.errand!.places).toHaveLength(3);
  });

  it("재접속·새로 고침으로 2초가 지난 뒤(시작 + 3초) 마운트하면 처음부터 없다 — 그래도 점·타일은 같은 목록", () => {
    at(3_000);
    const { container } = mount(makeView());
    expect(card(container)).toBeNull();
    expect(dots(container)!.getAttribute("data-errand-progress")).toBe("0/3");
    expect(stage.props!.errand!.places.map((p) => p.id)).toEqual(LIST);
  });

  it("카드가 떠 있을 때 방 아무 곳 pointerdown 한 번이면 닫히고, 그 누름은 막히지 않는다(자식까지 도달, 기본 동작 유지)", () => {
    at(500);
    const { container } = mount(makeView());
    expect(card(container)).not.toBeNull();
    const target = container.querySelector<HTMLElement>("[data-world-stage-fake]")!;
    const reached = vi.fn();
    target.addEventListener("pointerdown", reached);
    const notPrevented = fireEvent.pointerDown(target);
    expect(notPrevented).toBe(true);
    expect(reached).toHaveBeenCalledTimes(1);
    expect(card(container)).toBeNull();
  });

  it("닫은 뒤에는 같은 단계에서 다시 뜨지 않는다(리렌더·새 view 로도)", () => {
    at(500);
    const m = mount(makeView());
    fireEvent.pointerDown(m.container.querySelector("[data-world-stage-fake]")!);
    expect(card(m.container)).toBeNull();
    m.show(makeView({ done: ["glass"] }));
    expect(card(m.container)).toBeNull();
  });

  it("18.1-12: 시작 카드가 떠 있는 동안 띠 문장은 빈 글이고(초·막대는 있다), 걷히면 '등불 세 곳을 켜 주세요' 가 나온다", () => {
    const bandLine = (c: ParentNode) => c.querySelector("[data-host-line]")?.textContent;
    at(500);
    const { container } = mount(makeView());
    expect(card(container)).not.toBeNull();
    expect(bandLine(container)).toBe("");
    expect(container.querySelector("[data-host-time]")).not.toBeNull();
    expect(container.querySelector(".mv-host__band")!.classList.contains("is-off")).toBe(false);
    advance(2_000);
    expect(card(container)).toBeNull();
    expect(bandLine(container)).toBe("등불 세 곳을 켜 주세요");
  });

  it("18.1-12: 카드를 눌러 닫으면 띠 문장이 바로 나온다", () => {
    at(500);
    const { container } = mount(makeView());
    expect(container.querySelector("[data-host-line]")?.textContent).toBe("");
    fireEvent.pointerDown(container.querySelector("[data-world-stage-fake]")!);
    expect(container.querySelector("[data-host-line]")?.textContent).toBe("등불 세 곳을 켜 주세요");
  });

  it("카드·막은 눌림을 통과한다(CSS)·마피아와 시민의 카드 마크업이 같다", () => {
    at(500);
    const htmls: string[] = [];
    for (const role of ["mafia", "citizen", "police"] as const) {
      const { container, unmount } = mount(makeView({ role }));
      htmls.push(card(container)!.outerHTML);
      unmount();
    }
    expect(new Set(htmls).size).toBe(1);
  });
});

describe("errand 화면: [켜기] 전송 (D-01·D-06·D-24, P21-5·P21-8)", () => {
  it("반경 안 미완료 장소가 있으면 [켜기] 가 활성(data-call, aria-disabled 없음)이고 짧게 누르면 { t: 'errand' } 가 한 번, ui.tap 신호가 한 번 간다", () => {
    const { container, send } = mount(makeView());
    const t = taps();
    standAt(-3.9, -2.2);
    expect(actId()).toBe("glass");
    expect(act$(container)!.hasAttribute("data-call")).toBe(true);
    expect(act$(container)!.hasAttribute("aria-disabled")).toBe(false);
    pressAct();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ t: "errand" });
    expect(t.count()).toBe(1);
    t.off();
  });

  it("0.6초 이상 누르고 떼면 hold 를 실은 { t: 'errand', hold: true } 가 한 번 간다(소리도 한 번)", () => {
    vi.useFakeTimers({ now: NOW + 5_000 });
    const { container, send } = mount(makeView());
    const t = taps();
    standAt(-3.9, -2.2);
    const b = act$(container)!;
    fireEvent.pointerDown(b);
    advance(700);
    fireEvent.pointerUp(b);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ t: "errand", hold: true });
    expect(t.count()).toBe(1);
    t.off();
  });

  it("반경 밖에서는 [켜기] 가 aria-disabled=true·data-call 없음이고 눌러도 보내지 않으며 알림도 소리도 없다(안내 글 없음)", () => {
    const { container, send } = mount(makeView());
    const t = taps();
    standAt(FAR.x, FAR.z);
    expect(actId()).toBeNull();
    expect(act$(container)!.getAttribute("aria-disabled")).toBe("true");
    expect(act$(container)!.hasAttribute("data-call")).toBe(false);
    pressAct();
    expect(send).not.toHaveBeenCalled();
    expect(t.count()).toBe(0);
    expect(container.querySelector("[role=alert]")).toBeNull();
    t.off();
  });

  it("이미 켠 장소 위에서는 [켜기] 가 비활성이다", () => {
    const { container, send } = mount(makeView({ done: ["glass"] }));
    standAt(-3.9, -2.2);
    expect(actId()).toBeNull();
    expect(act$(container)!.getAttribute("aria-disabled")).toBe("true");
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

  it("send 가 false(소켓 닫힘)를 돌려줘도 화면은 그대로다(이유 글 없음)", () => {
    const send = vi.fn(() => false);
    const { container } = mount(makeView(), send);
    standAt(-3.9, -2.2);
    const before = container.innerHTML;
    pressAct();
    expect(send).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe(before);
  });
});

describe("errand 화면: [건너뛰기] (D-23, P21-6)", () => {
  it("표식 data-skip-phase·data-skip-count 는 서버 값(day.skipCount), 접근성 이름 '건너뛰기 n/m'(m = 산 사람 수)", () => {
    const { container } = mount(makeView({ skipCount: 2 }));
    const b = skip$(container)!;
    expect(b.getAttribute("data-skip-count")).toBe("2");
    expect(b.getAttribute("aria-label")).toBe("건너뛰기 2/4");
    expect(b.getAttribute("aria-pressed")).toBe("false");
  });

  it("누르면 { t: 'skipPhase', on: true } 를 보내고 눌림이 바로 보이며, 다시 누르면 on:false(해제)", () => {
    const { container, send } = mount(makeView());
    fireEvent.click(skip$(container)!);
    expect(send).toHaveBeenLastCalledWith({ t: "skipPhase", on: true });
    expect(skip$(container)!.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(skip$(container)!);
    expect(send).toHaveBeenLastCalledWith({ t: "skipPhase", on: false });
    expect(skip$(container)!.getAttribute("aria-pressed")).toBe("false");
  });

  it("서버가 준 내 눌림(me.skipPhase)이 눌림 모양이고, 새 view 가 오면 서버 값이 이긴다(거절 때 되돌림)", () => {
    const m = mount(makeView({ skipMine: true, skipCount: 1 }));
    expect(skip$(m.container)!.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(skip$(m.container)!);
    expect(skip$(m.container)!.getAttribute("aria-pressed")).toBe("false");
    m.show(makeView({ skipMine: true, skipCount: 1 }));
    expect(skip$(m.container)!.getAttribute("aria-pressed")).toBe("true");
  });

  it("canSend 가 거짓이면 눌러도 보내지 않는다", () => {
    const { container, send } = mount(makeView(), vi.fn(() => true), false);
    fireEvent.click(skip$(container)!);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("errand 화면: 진행 (U-6)", () => {
  it("view.me.errand.done 이 늘면 점이 채워지고 표지(errand prop)가 done 이 되며 진행 n/3 이 갱신된다, 3/3 이면 [켜기] 는 완료·점 3 모두 채움", () => {
    const m = mount(makeView());
    standAt(FAR.x, FAR.z);
    expect(stage.props!.errand!.places.map((p) => p.done)).toEqual([false, false, false]);
    m.show(makeView({ done: ["glass"] }));
    expect(m.container.querySelectorAll("[data-errand-dot][data-done]")).toHaveLength(1);
    expect(dots(m.container)!.getAttribute("data-errand-progress")).toBe("1/3");
    expect(stage.props!.errand!.places.find((p) => p.id === "glass")!.done).toBe(true);
    m.show(makeView({ done: ["glass", "piano", "sax"] }));
    expect(actId()).toBeNull();
    // 3곳을 다 켜면 [켜기] 자리가 '완료' 비활성이다(21-11)
    expect(act$(m.container)!.textContent).toBe("완료");
    expect(act$(m.container)!.getAttribute("aria-disabled")).toBe("true");
    expect(dots(m.container)!.getAttribute("aria-label")).toBe("등불 3/3");
    expect(dots(m.container)!.getAttribute("data-errand-progress")).toBe("3/3");
    expect(m.container.querySelectorAll("[data-errand-dot][data-done]")).toHaveLength(3);
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
  // 독의 [켜기](반경 안, data-call)와 가장 가까운 타일(callPlace) 중 하나만 빛난다. 타일의 실제 빛은 WorldStage 층이 쓴다(worldStage.test)
  const glowCount = (c: ParentNode): number => c.querySelectorAll("[data-call]").length + (stage.props?.errand?.callPlace === true ? 1 : 0);

  it("반경 밖: 다음 장소 타일(callPlace)만 빛나고 [켜기] 는 비활성이다", () => {
    const { container } = mount(makeView());
    standAt(FAR.x, FAR.z);
    expect(stage.props!.errand!.callPlace).toBe(true);
    expect(actId()).toBeNull();
    expect(glowCount(container)).toBe(1);
  });

  it("반경 안: [켜기] 만 빛나고 타일 빛(callPlace)은 꺼진다", () => {
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

  it("빛은 14페이즈의 '이미 썼는가' 와 무관하다: [켜기] 를 눌러도 위치·진행이 그대로면 빛이 남는다", () => {
    mount(makeView());
    standAt(-3.9, -2.2);
    pressAct();
    expect(actId()).toBe("glass");
    expect(act$(document)!.hasAttribute("data-call")).toBe(true);
  });
});

describe("errand 화면: 마피아와 시민은 같은 DOM (D-03, ERRAND-04, T-15-20)", () => {
  const attrNames = (c: HTMLElement): string[] => {
    const set = new Set<string>();
    for (const el of c.querySelectorAll("*")) for (const a of el.getAttributeNames()) if (a.startsWith("data-") || a.startsWith("aria-")) set.add(`${el.tagName}.${a}`);
    return [...set].sort();
  };
  const panelOf = (c: HTMLElement): HTMLElement => c.querySelector<HTMLElement>("[data-errand-dots]")!;

  it("역할만 바꾼 렌더 네 번: 진행 점 줄의 마크업과 errand prop 이 같다", () => {
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

  it("처리 반경 안(알약이 있을 때)도 역할만 다른 네 렌더의 진행 점 마크업·errand prop 이 같다(가짜 장소를 모른다, V-25)", () => {
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

  it("21-11: 역할만 바꾼 네 렌더의 독(기록·[켜기]·[건너뛰기])·진행 점 마크업이 반경 밖·안·길게 누르는 동안 모두 같다(T-21-27)", () => {
    const stages: Array<{ name: string; run: () => void }> = [
      { name: "밖", run: () => standAt(FAR.x, FAR.z) },
      { name: "안", run: () => standAt(-3.9, -2.2) },
      { name: "누름", run: () => fireEvent.pointerDown(act$(document)!) },
    ];
    const byStage: Record<string, string[]> = { 밖: [], 안: [], 누름: [] };
    for (const role of ["mafia", "citizen", "police", "doctor"] as const) {
      const { container, unmount } = mount(makeView({ role, done: ["piano"], skipCount: 1 }));
      for (const st of stages) {
        st.run();
        byStage[st.name]!.push(dock$(container)!.outerHTML + "|" + dots(container)!.outerHTML);
      }
      unmount();
    }
    for (const name of Object.keys(byStage)) {
      for (const html of byStage[name]!.slice(1)) expect(html, name).toBe(byStage[name]![0]);
    }
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
