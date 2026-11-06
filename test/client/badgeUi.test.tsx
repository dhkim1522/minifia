import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { RULESET } from "../../shared/game/ruleset";
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
const { GameMap } = await import("../../src/screens/GameMap");
const { WorldStore } = await import("../../src/world/store");
const { ChatStore } = await import("../../src/net/chatStore");

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

/** 연결 mock 의 onEvent 가 받은 구독자들 — 오류 프레임을 흉내 낸다 */
const emitError = (c: ParentNode, code: "WRONG_PHASE" | "BAD_MESSAGE" | "RATE_LIMITED"): void => {
  void c;
  const onEvent = (connectionMock.current as RoomConnection).onEvent as unknown as ReturnType<typeof vi.fn>;
  act(() => {
    for (const [fn] of onEvent.mock.calls) (fn as (e: unknown, m: unknown) => void)({ t: "error", code }, { epoch: 1 });
  });
};

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
  vi.unstubAllGlobals();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  stage.props = null;
});

describe("기본판: 낮 토론에 떠 있는 버튼·시트가 없다 (U-8, UI#12·#13, 결정 0072)", () => {
  // 켜진 판(RULESET.badge·whisper)에서는 아래 '떠 있는 버튼' describe 들이 본다 — 이 describe 는 기본판에서만 뜻이 있다.
  const run = RULESET.badge || RULESET.whisper ? describe.skip : describe;
  run("꺼진 장치의 진입점", () => {
    const PHASES_SHOWN = ["dayAnnounce", "discussion", "nomination"] as PhaseId[];
    it.each(PHASES_SHOWN)("%s: [data-float] 0개, 묶음 컨테이너 0개(빈 띠 없음), 주장·한 줄·한마디 시트 0개", (phase) => {
      const { container } = mount(makeView({ phase }));
      expect(container.querySelectorAll("[data-float]")).toHaveLength(0);
      expect(container.querySelectorAll("[data-float-stack], .mf-float")).toHaveLength(0);
      expect(container.querySelectorAll("[data-claim-sheet], .mv-claim-sheet, [data-line-sheet], [data-speak-sheet]")).toHaveLength(0);
      // 비활성 버튼·회색 칸·준비 중 글도 없다(채팅 보내기 같은 다른 화면 부품의 aria-disabled 는 이 검사와 무관하다)
      expect(container.querySelectorAll("[data-float-count], [data-float-left], .mv-float__dot, .mv-float__count")).toHaveLength(0);
      expect(container.textContent).not.toContain("준비 중");
    });

    it("discussion: [토론 끝내기] 하나는 있다(UI#13 populated) — 떠 있는 줄 없이", () => {
      const { container } = mount(makeView({ phase: "discussion" }));
      expect(container.querySelectorAll("[data-end-discussion]")).toHaveLength(1);
      expect(container.querySelectorAll("[data-float]")).toHaveLength(0);
    });

    it("유령(탈락한 나)에게도 떠 있는 버튼과 묶음이 없다", () => {
      const { container } = mount(makeView({ phase: "discussion", dead: [0] }));
      expect(container.querySelectorAll("[data-float], [data-float-stack]")).toHaveLength(0);
    });

    it.each(["dayAnnounce", "discussion", "nomination", "verdict"] as PhaseId[])("%s: 스크린리더 배지 알림 줄([data-badge-live])도 없다 (E2E basic-off 가 잡은 흔적)", (phase) => {
      const { container } = mount(makeView({ phase }));
      expect(container.querySelectorAll("[data-badge-live]")).toHaveLength(0);
    });

    it("서버 view 에 주장이 실려 와도(옛 번들 호환) 떠 있는 버튼은 없다", () => {
      const { container } = mount(makeView({ phase: "discussion", badges: { 0: "police" } }));
      expect(container.querySelectorAll("[data-float]")).toHaveLength(0);
    });
  });
});

// 기본판(결정 0072)에서 꺼짐 — RULESET.badge 를 켜면 다시 돈다(떠 있는 버튼이 있어야 성립한다). 꺼진 상태는 위의 기본판 describe 가 본다.
describe.skipIf(!RULESET.badge)("떠 있는 버튼 → 칩 시트 → badge 전송 (UI-SPEC A-2, 트레이서)", () => {
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

// ---- Task 2: 말 바꿈 효과·낙관 표시/거절 되돌림·접근성 한 줄·재접속 첫 화면 ----
const live = (c: ParentNode): string => c.querySelector("[data-badge-live]")?.textContent ?? "";
const stackOf = (seat: number) => render(<HeadStack name={NAMES[seat] ?? ""} color="red" {...stage.props!.tagProps!(seat)} />).container;
const toastText = (c: ParentNode): string => c.querySelector(".mv-toast--top .mv-toast__text")?.textContent ?? "";
const reduceMotion = (): void => {
  vi.stubGlobal(
    "matchMedia",
    (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }),
  );
};

describe("말 바꿈 효과 (UI-SPEC A-1, O-22)", () => {
  it("직업을 바꾼 순간: 팝 + '말 바꿈' 알약 + 점이 이름표에 실린다. 2.4초(+페이드) 뒤 알약만 사라지고 점은 남는다", () => {
    const m = mount(makeView({ badges: { 1: "police" } }));
    expect(stage.props!.tagProps!(1).claimPop).toBeUndefined();
    m.show(makeView({ badges: { 1: "mafia" }, swapped: [1] }));
    const props = stage.props!.tagProps!(1);
    expect(props).toMatchObject({ claim: "mafia", claimSwapped: true, claimNotice: true, claimPop: 1 });
    const c = stackOf(1);
    expect(c.querySelector(".mv-claim__notice")?.textContent).toBe("말 바꿈");
    expect(c.querySelector("[data-claim-changed]")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(2400 + 180 + 20);
    });
    const later = stage.props!.tagProps!(1);
    expect(later.claimNotice).toBeUndefined();
    expect(later).toMatchObject({ claim: "mafia", claimSwapped: true });
  });

  it("처음 거는 순간에는 팝만 있고 알약이 없다", () => {
    const m = mount(makeView());
    m.show(makeView({ badges: { 2: "doctor" } }));
    const props = stage.props!.tagProps!(2);
    expect(props.claimPop).toBe(1);
    expect(props.claimNotice).toBeUndefined();
  });

  it("모션 줄이기: 알약은 2.4초가 되면 곧바로 사라진다(페이드 시간이 없다)", () => {
    reduceMotion();
    const m = mount(makeView({ badges: { 1: "police" } }));
    m.show(makeView({ badges: { 1: "mafia" }, swapped: [1] }));
    expect(stage.props!.tagProps!(1).claimNotice).toBe(true);
    act(() => {
      vi.advanceTimersByTime(2399);
    });
    expect(stage.props!.tagProps!(1).claimNotice).toBe(true);
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(stage.props!.tagProps!(1).claimNotice).toBeUndefined();
  });

  it("재접속 첫 화면: 이미 걸린 배지·말 바꿈 점이 팝·알약 없이 바로 나타난다", () => {
    mount(makeView({ badges: { 1: "mafia", 2: "none" }, swapped: [1, 2] }));
    const p1 = stage.props!.tagProps!(1);
    expect(p1).toMatchObject({ claim: "mafia", claimSwapped: true });
    expect(p1.claimPop).toBeUndefined();
    expect(p1.claimNotice).toBeUndefined();
    expect(stage.props!.tagProps!(2)).toMatchObject({ claim: "none", claimSwapped: true });
    expect(live(document.body)).toBe("");
  });

  it("연결 번호(epoch)가 바뀐 첫 스냅샷도 이펙트 없이 현재 상태로 그린다", () => {
    const m = mount(makeView({ badges: { 1: "police" } }));
    m.show(makeView({ badges: { 1: "mafia" }, swapped: [1] }), { epoch: 2 });
    const p = stage.props!.tagProps!(1);
    expect(p).toMatchObject({ claim: "mafia", claimSwapped: true });
    expect(p.claimPop).toBeUndefined();
    expect(p.claimNotice).toBeUndefined();
  });

  it.skipIf(!RULESET.badge)("화면에 안 보이는 live 한 줄: 바뀐 순간에만 '{이름} 님이 {직업}라고 말했어요'", () => {
    const m = mount(makeView({ badges: { 1: "police" } }));
    expect(live(m.container)).toBe("");
    const line = m.container.querySelector("[data-badge-live]")!;
    expect(line.getAttribute("role")).toBe("status");
    expect(line.classList.contains("mf-sr-only")).toBe(true);
    m.show(makeView({ badges: { 1: "mafia" }, swapped: [1] }));
    expect(live(m.container)).toBe("영희 님이 마피아라고 말했어요");
    m.show(makeView({ badges: { 1: "none" }, swapped: [1] }));
    expect(live(m.container)).toBe("영희 님이 말 안 함이라고 말했어요");
  });
});

// 기본판(결정 0072)에서 꺼짐 — RULESET.badge 를 켜면 다시 돈다(떠 있는 버튼이 있어야 성립한다). 꺼진 상태는 위의 기본판 describe 가 본다.
describe.skipIf(!RULESET.badge)("낙관 표시와 거절 되돌림 (UI-SPEC A-2)", () => {
  it("칩을 누르는 즉시 내 이름표 배지와 버튼 아이콘·이름이 새 값이 된다", () => {
    const { container } = mount(makeView());
    expect(stage.props!.tagProps).toBeUndefined();
    fireEvent.click(floatBtn(container)!);
    fireEvent.click(chip(container, "경찰"));
    expect(floatBtn(container)?.getAttribute("aria-label")).toBe("직업 배지 고르기, 지금 경찰");
    expect(stage.props!.tagProps!(0)).toMatchObject({ claim: "police", claimSwapped: false });
    expect(stage.props!.tagProps!(1).claim).toBeUndefined();
  });

  it("직업을 건 상태에서 다른 값을 고르면 내 낙관 표시에 말 바꿈 점이 바로 붙는다", () => {
    const { container } = mount(makeView({ badges: { 0: "citizen" } }));
    fireEvent.click(floatBtn(container)!);
    fireEvent.click(chip(container, "마피아"));
    expect(stage.props!.tagProps!(0)).toMatchObject({ claim: "mafia", claimSwapped: true });
  });

  it("마감 직후 거절(오류 프레임)이 3초 안에 오면 토스트 '지금은 바꿀 수 없어요' + 서버 값으로 되돌아간다", () => {
    const { container } = mount(makeView());
    fireEvent.click(floatBtn(container)!);
    fireEvent.click(chip(container, "의사"));
    expect(floatBtn(container)?.getAttribute("aria-label")).toBe("직업 배지 고르기, 지금 의사");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    emitError(container, "WRONG_PHASE");
    expect(toastText(container)).toBe("지금은 바꿀 수 없어요");
    expect(floatBtn(container)?.getAttribute("aria-label")).toBe("직업 배지 고르기, 지금 말 안 함");
    expect(stage.props!.tagProps).toBeUndefined();
  });

  it("거절이 아닌 오류 코드(속도 제한)는 배지 알림도 되돌림도 만들지 않는다", () => {
    const { container } = mount(makeView());
    fireEvent.click(floatBtn(container)!);
    fireEvent.click(chip(container, "의사"));
    emitError(container, "RATE_LIMITED");
    expect(toastText(container)).toBe("");
    expect(floatBtn(container)?.getAttribute("aria-label")).toBe("직업 배지 고르기, 지금 의사");
  });

  it("3초가 지난 뒤의 오류는 배지의 거절로 보지 않는다", () => {
    const { container } = mount(makeView());
    fireEvent.click(floatBtn(container)!);
    fireEvent.click(chip(container, "의사"));
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    emitError(container, "WRONG_PHASE");
    expect(toastText(container)).not.toBe("지금은 바꿀 수 없어요");
  });

  it("서버 view 가 같은 값을 확인하면 거절 대기를 푼다 — 뒤의 오류는 배지 알림이 아니다", () => {
    const m = mount(makeView());
    fireEvent.click(floatBtn(m.container)!);
    fireEvent.click(chip(m.container, "의사"));
    m.show(makeView({ badges: { 0: "doctor" } }));
    emitError(m.container, "WRONG_PHASE");
    expect(toastText(m.container)).not.toBe("지금은 바꿀 수 없어요");
    expect(floatBtn(m.container)?.getAttribute("aria-label")).toBe("직업 배지 고르기, 지금 의사");
  });

  it("소켓이 닫혀 못 보냈으면(send false) 표시도 시트도 그대로다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => false);
    const { container } = mount(makeView(), { send });
    fireEvent.click(floatBtn(container)!);
    fireEvent.click(chip(container, "경찰"));
    expect(floatBtn(container)?.getAttribute("aria-label")).toBe("직업 배지 고르기, 지금 말 안 함");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(sheet(container)).not.toBeNull();
  });

  it("연결이 끊긴 동안(canSend false) 버튼은 aria-disabled 이고 눌러도 시트가 열리지 않는다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container } = mount(makeView(), { canSend: false, send });
    expect(floatBtn(container)?.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(floatBtn(container)!);
    expect(sheet(container)).toBeNull();
    expect(sent(send).filter((x) => x.t === "badge")).toEqual([]);
  });

  it("칩 연타: 같은 값은 한 번만 보낸다", () => {
    const send = vi.fn<(m: ClientMessage) => boolean>(() => true);
    const { container } = mount(makeView(), { send });
    fireEvent.click(floatBtn(container)!);
    fireEvent.click(chip(container, "경찰"));
    fireEvent.click(chip(container, "경찰"));
    expect(sent(send).filter((x) => x.t === "badge")).toHaveLength(1);
  });
});

// ---- Task 3: 표식·단계 표·접근성·L23 DOM 분리 ----
// 기본판(결정 0072)에서 꺼짐 — RULESET.badge 를 켜면 다시 돈다(떠 있는 버튼이 있어야 성립한다). 꺼진 상태는 위의 기본판 describe 가 본다.
describe.skipIf(!RULESET.badge)("단계 표: 떠 있는 버튼은 주장 창에서만 DOM 에 있다 (UI-SPEC A-2)", () => {
  it.each(["dayAnnounce", "discussion", "nomination"] as PhaseId[])("%s 에서 산 사람에게는 하나", (phase) => {
    const { container } = mount(makeView({ phase }));
    // 낮 토론에는 귓속말 버튼(09.1.1-09)이 배지 버튼 아래에 하나 더 있다
    expect(container.querySelectorAll("[data-float]")).toHaveLength(phase === "discussion" ? 2 : 1);
    expect(container.querySelectorAll('[data-float="claim"]')).toHaveLength(1);
    expect(floatBtn(container)).not.toBeNull();
  });

  it.each(["defense", "verdict", "execution", "night", "morning"] as PhaseId[])("%s 에서는 버튼도 시트도 DOM 에 없다", (phase) => {
    const { container } = mount(makeView({ phase }));
    expect(container.querySelector("[data-float]")).toBeNull();
    expect(container.querySelector("[data-float-stack]")).toBeNull();
    expect(sheet(container)).toBeNull();
  });

  it.each(["showdown", "runoff"] as PhaseId[])("GameMap 을 직접 그리면 %s: showdown 만 있다(마지막 3인 결전은 주장 창, 결선은 아니다)", (phase) => {
    const { container } = render(<GameMap view={makeView({ phase, count: 3 })} store={new WorldStore()} chat={new ChatStore()} send={() => true} />);
    expect(container.querySelectorAll('[data-float="claim"]')).toHaveLength(phase === "showdown" ? 1 : 0);
  });

  it("유령(탈락한 나)에게는 버튼을 만들지 않는다", () => {
    const { container } = mount(makeView({ dead: [0] }));
    expect(container.querySelector("[data-float]")).toBeNull();
  });

  it("주장 창이 끝나면(토론 → 변론) 열려 있던 시트가 닫힌다", () => {
    const m = mount(makeView({ phase: "nomination" }));
    fireEvent.click(floatBtn(m.container)!);
    expect(sheet(m.container)).not.toBeNull();
    m.show(makeView({ phase: "defense" }));
    expect(sheet(m.container)).toBeNull();
    expect(m.container.querySelector("[data-float]")).toBeNull();
  });
});

describe("L23: 배지는 직업 칩(data-role-chip)과 섞이지 않는다", () => {
  it("산 사람 viewer 의 어느 이름표에도 [data-role-chip] 이 없고 배지가 있는 이름표에만 [data-claim] 이 있다", () => {
    for (const phase of ["dayAnnounce", "discussion", "nomination"] as PhaseId[]) {
      const { unmount } = mount(makeView({ phase, badges: { 1: "police", 2: "mafia", 4: "none" }, swapped: [4] }));
      let claims = 0;
      for (let seat = 0; seat < 6; seat += 1) {
        const c = stackOf(seat);
        expect(c.querySelectorAll("[data-role-chip]"), `${phase} seat ${seat}`).toHaveLength(0);
        claims += c.querySelectorAll("[data-claim]").length;
      }
      expect(claims).toBe(3);
      unmount();
    }
  });

  it("배지 요소의 속성에 data-role-chip 이 없고 .mv-head 에도 data-claim 이 없다", () => {
    const { container } = render(<HeadStack name="영희" color="red" claim="mafia" claimSwapped />);
    expect(container.querySelector("[data-role-chip]")).toBeNull();
    expect(container.querySelector(".mv-head")?.hasAttribute("data-claim")).toBe(false);
    expect(container.querySelectorAll("[data-claim]")).toHaveLength(1);
    expect(container.querySelector("[data-claim]")?.hasAttribute("data-claim-changed")).toBe(true);
  });

  it("유령 viewer: 탈락자 이름표에는 배지가 없고 산 사람 이름표에는 배지 + 직업 칩이 서로 다른 요소로 있다", () => {
    // 서버는 탈락자 줄에 badge 를 싣지 않지만, 실려 와도 화면이 그리지 않는다
    mount(makeView({ dead: [0, 1], mySeat: 0, badges: { 1: "police", 2: "mafia" } }));
    const dead = stackOf(1);
    expect(dead.querySelector("[data-claim]")).toBeNull();
    const alive = stackOf(2);
    expect(alive.querySelectorAll("[data-claim]")).toHaveLength(1);
    expect(alive.querySelectorAll("[data-role-chip]")).toHaveLength(1);
    const chip = alive.querySelector("[data-role-chip]")!;
    const badge = alive.querySelector("[data-claim]")!;
    expect(chip).not.toBe(badge);
    expect(chip.classList.contains("mv-rolechip")).toBe(true);
    expect(badge.classList.contains("mv-claim")).toBe(true);
    expect(badge.hasAttribute("data-role-chip")).toBe(false);
  });
});

// 기본판(결정 0072)에서 꺼짐 — RULESET.badge 를 켜면 다시 돈다(떠 있는 버튼이 있어야 성립한다). 꺼진 상태는 위의 기본판 describe 가 본다.
describe.skipIf(!RULESET.badge)("접근성·초점·Tab 순서 (UI-SPEC 접근성)", () => {
  it.each([
    ["none", "말 안 함"],
    ["citizen", "시민"],
    ["police", "경찰"],
    ["doctor", "의사"],
    ["mafia", "마피아"],
  ] as const)("내 주장 %s → 버튼 이름 '직업 배지 고르기, 지금 %s'", (claim, label) => {
    const { container } = mount(makeView(claim === "none" ? {} : { badges: { 0: claim } }));
    expect(floatBtn(container)?.getAttribute("aria-label")).toBe(`직업 배지 고르기, 지금 ${label}`);
  });

  it("시트가 열리면 aria-pressed true, 칩을 눌러 닫히면 초점이 떠 있는 버튼으로 돌아온다", () => {
    const { container } = mount(makeView());
    fireEvent.click(floatBtn(container)!);
    expect(floatBtn(container)?.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(chip(container, "시민"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(sheet(container)).toBeNull();
    expect(floatBtn(container)?.getAttribute("aria-pressed")).toBe("false");
    expect(document.activeElement).toBe(floatBtn(container));
  });

  it("버튼 mousedown 의 기본 동작을 막는다(채팅 입력칸의 포커스를 뺏지 않는다)", () => {
    const { container } = mount(makeView());
    const notPrevented = fireEvent.mouseDown(floatBtn(container)!);
    expect(notPrevented).toBe(false);
  });

  it("Tab 순서(DOM 순서): 채팅 입력 → 보내기 → 깃펜 → 떠 있는 버튼", () => {
    const { container } = mount(makeView());
    const order = (a: Element, b: Element): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    const input = container.querySelector(".mv-chat__input")!;
    const send = container.querySelector(".mv-chat__send")!;
    const quill = container.querySelector("[data-will-button]")!;
    expect(input && send && quill).toBeTruthy();
    expect(order(input, send)).toBe(true);
    expect(order(send, quill)).toBe(true);
    expect(order(quill, floatBtn(container)!)).toBe(true);
  });

  it("유언 시트를 열면 배지 시트가 닫히고, 두 시트가 한 시트 층을 번갈아 쓴다", () => {
    const { container } = mount(makeView());
    fireEvent.click(floatBtn(container)!);
    expect(container.querySelectorAll(".mf-will-layer")).toHaveLength(1);
    fireEvent.click(container.querySelector("[data-will-button]")!);
    expect(sheet(container)).toBeNull();
    expect(container.querySelector('[data-will-sheet="will"]')).not.toBeNull();
    expect(container.querySelectorAll(".mf-will-layer")).toHaveLength(1);
  });
});
