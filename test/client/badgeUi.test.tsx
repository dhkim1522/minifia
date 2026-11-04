import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { BadgeId, ClientMessage, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import type { WorldStageProps } from "../../src/components/WorldStage";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 09.1.1-08 UI-SPEC A: 오른쪽 아래 떠 있는 버튼 → 칩 시트 → {t:"badge", role}, 그리고 view 의 주장이 이름표 모서리 배지로.
// RoomScreen → GameMap 을 진짜로 그리고 연결과 WorldStage 만 가짜로 바꾼다(gameMap.test 와 같은 틀).
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
const { HeadStack } = await import("../../src/components/v2/HeadStack");

const NAMES = ["민수", "영희", "서준", "지아", "도윤", "하은", "유진", "태오"];
const NOW = 1_700_000_000_000;

interface Opt {
  phase?: PhaseId;
  count?: number;
  mySeat?: number;
  dead?: number[];
  badges?: Record<number, BadgeId>;
  swapped?: number[];
}

function makeView(o: Opt = {}): RoomView {
  const count = o.count ?? 6;
  const mySeat = o.mySeat ?? 0;
  const players: PublicPlayer[] = Array.from({ length: count }, (_, seat) => ({
    seat,
    nickname: NAMES[seat] ?? `p${seat}`,
    connected: true,
    isHost: seat === 0,
    ...(o.dead?.includes(seat) ? { alive: false } : {}),
    ...(o.badges?.[seat] !== undefined ? { badge: o.badges[seat] } : {}),
    ...(o.swapped?.includes(seat) ? { badgeSwapped: true as const } : {}),
  }));
  const meDead = o.dead?.includes(mySeat) === true;
  const view = {
    code: "0042",
    phase: o.phase ?? "discussion",
    phaseEndsAt: NOW + 90_000,
    phaseDurationMs: 90_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: mySeat, isHost: mySeat === 0, chat: meDead ? "ghost" : "all" },
    day: { n: 1, roles: [] },
  } as RoomView;
  if (meDead) view.spectate = { seats: players.map((p) => ({ seat: p.seat, job: p.seat === 1 ? "mafia" : "citizen" })) };
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

type Send = ReturnType<typeof vi.fn<(m: ClientMessage) => boolean>>;
const sent = (send: Send): ClientMessage[] => send.mock.calls.map(([x]) => x);
const floatBtn = (c: ParentNode): HTMLButtonElement | null => c.querySelector<HTMLButtonElement>('[data-float="claim"]');
const sheet = (c: ParentNode): HTMLElement | null => c.querySelector<HTMLElement>(".mv-claim-sheet");
const chips = (c: ParentNode): HTMLButtonElement[] => [...c.querySelectorAll<HTMLButtonElement>(".mv-claim-sheet .mv-claim-chip")];
const chip = (c: ParentNode, label: string): HTMLButtonElement => chips(c).find((b) => b.textContent === label)!;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  stage.props = null;
});

describe("떠 있는 버튼 → 칩 시트 → badge 전송 (UI-SPEC A-2, 트레이서)", () => {
  it("토론에서 산 사람 화면에 [data-float=claim] 이 하나이고 이름은 '직업 배지 고르기, 지금 말 안 함'", () => {
    const { container } = mount(makeView());
    expect(container.querySelectorAll('[data-float="claim"]')).toHaveLength(1);
    expect(floatBtn(container)?.getAttribute("aria-label")).toBe("직업 배지 고르기, 지금 말 안 함");
    expect(floatBtn(container)?.getAttribute("aria-pressed")).toBe("false");
    expect(sheet(container)).toBeNull();
  });

  it("버튼을 누르면 칩 시트가 열리고(dialog 아님) 칩이 6명판 5개 — 시민·경찰·의사·마피아·말 안 함", () => {
    const { container } = mount(makeView({ count: 6 }));
    fireEvent.click(floatBtn(container)!);
    expect(sheet(container)).not.toBeNull();
    expect(sheet(container)?.getAttribute("role")).not.toBe("dialog");
    expect(chips(container).map((b) => b.textContent)).toEqual(["시민", "경찰", "의사", "마피아", "말 안 함"]);
    expect(floatBtn(container)?.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(chips(container)[0]);
  });

  it("4명판은 의사 칩이 없다(4개)", () => {
    const { container } = mount(makeView({ count: 4 }));
    fireEvent.click(floatBtn(container)!);
    expect(chips(container).map((b) => b.textContent)).toEqual(["시민", "경찰", "마피아", "말 안 함"]);
  });

  it("칩 '의사' 를 누르면 send 가 정확히 {t:'badge', role:'doctor'} 한 번이고 dur-fast 뒤 시트가 닫힌다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container } = mount(makeView(), { send });
    fireEvent.click(floatBtn(container)!);
    fireEvent.click(chip(container, "의사"));
    expect(sent(send).filter((x) => x.t === "badge")).toEqual([{ t: "badge", role: "doctor" }]);
    expect(sheet(container)).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(sheet(container)).toBeNull();
  });

  it("같은 칩을 다시 누르면 send 없이 닫힌다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container } = mount(makeView({ badges: { 0: "doctor" } }), { send });
    fireEvent.click(floatBtn(container)!);
    expect(chip(container, "의사").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(chip(container, "의사"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(sent(send).filter((x) => x.t === "badge")).toEqual([]);
    expect(sheet(container)).toBeNull();
  });

  it("닫기 버튼과 Esc 로 닫힌다", () => {
    const { container } = mount(makeView());
    fireEvent.click(floatBtn(container)!);
    fireEvent.click(container.querySelector('.mv-claim-sheet [aria-label="닫기"]')!);
    expect(sheet(container)).toBeNull();
    fireEvent.click(floatBtn(container)!);
    fireEvent.keyDown(sheet(container)!, { key: "Escape" });
    expect(sheet(container)).toBeNull();
  });
});

describe("view 의 주장 → 이름표 모서리 배지 (UI-SPEC A-1)", () => {
  it("badge 가 실린 좌석은 tagProps 가 claim 을 돌려주고, HeadStack 에 [data-claim] 배지가 있으며 [data-role-chip] 은 0개", () => {
    mount(makeView({ badges: { 1: "police" } }));
    const props = stage.props!.tagProps!(1);
    expect(props).toMatchObject({ claim: "police" });
    const { container } = render(<HeadStack name="영희" color="red" {...props} />);
    const badge = container.querySelector('[data-claim="police"]');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute("role")).toBe("img");
    expect(badge?.getAttribute("aria-label")).toBe("경찰 주장");
    expect(container.querySelectorAll("[data-role-chip]")).toHaveLength(0);
  });

  it("badge 가 없으면 claim 이 없고 배지 요소 자체가 없다", () => {
    mount(makeView({ badges: { 1: "police" } }));
    const props = stage.props!.tagProps!(2);
    expect(props.claim).toBeUndefined();
    const { container } = render(<HeadStack name="서준" color="red" {...props} />);
    expect(container.querySelector("[data-claim]")).toBeNull();
  });

  it("기존 tagProps 키는 덮어쓰지 않는다 — 지목 단계의 득표 배지(count)와 같이 온다", () => {
    const base = makeView({ phase: "nomination", badges: { 1: "citizen" } });
    base.day = { ...base.day!, points: [{ seat: 0, target: 1 }] } as RoomView["day"];
    mount(base);
    const props = stage.props!.tagProps!(1);
    expect(props).toMatchObject({ claim: "citizen", count: 1 });
  });
});
