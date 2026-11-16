import { act, cleanup, fireEvent, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ClientMessage, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { restSegment } from "../../shared/game/world";
import type { Segment } from "../../shared/game/world";
import { bindSignals } from "../../src/audio/signals";
import type { LocalSignal } from "../../src/audio/signals";
import { useSendGuard } from "../../src/net/useSendGuard";
import { useSuspect } from "../../src/net/useSuspect";
import { HeadStack } from "../../src/components/v2/HeadStack";
import { SuspectButton } from "../../src/components/v2/SuspectButton";
import { GamePanel } from "../../src/screens/GamePanel";

// 24-03: [의심] 모드 훅(useSuspect) → 단추·칩 부품 → GameMap 배선. 근처 판정은 서버 구간(store.segOf)이고 화면은 켜 주기만 한다(결정 0002).
const NOW = 1_700_000_000_000;
const NAMES = ["민수", "영희", "서준", "지아", "도윤", "하은", "유진", "태오"];

interface Opt {
  phase?: PhaseId;
  day?: number;
  count?: number;
  mySeat?: number;
  dead?: number[];
  suspectTo?: number;
  suspects?: { to: number; from: number }[];
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
    me: { seat: mySeat, isHost: mySeat === 0, chat: meDead ? "ghost" : "all", ...(o.suspectTo !== undefined ? { suspectTo: o.suspectTo } : {}) },
    day: { n: o.day ?? 2, roles: [], ...(o.suspects !== undefined ? { suspects: o.suspects } : {}) },
  } as RoomView;
  if (meDead) view.spectate = { seats: players.map((p) => ({ seat: p.seat, job: "citizen" as const })) };
  return view;
}

/** 서버 구간 저장소 모양(segOf 만 쓴다). x 는 고정소수점 100 = 1 단위 */
const makeStore = (segs: Record<number, Segment>) => ({ segOf: (seat: number): Segment | undefined => segs[seat] });
const at = (x: number, z = 0): Segment => restSegment(x, z, NOW);
const sorted = (s: ReadonlySet<number>): string => [...s].sort((a, b) => a - b).join(",");

let unbindSignals: (() => void) | null = null;
beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});
afterEach(() => {
  cleanup();
  unbindSignals?.();
  unbindSignals = null;
  vi.useRealTimers();
});

interface HookProps {
  view: RoomView;
  canSend?: boolean;
  send?: (m: ClientMessage) => boolean | void;
  segs: Record<number, Segment>;
}

function mountHook(first: HookProps) {
  const sends: ClientMessage[] = [];
  const defaultSend = (m: ClientMessage): boolean => {
    sends.push(m);
    return true;
  };
  const r = renderHook(
    (p: HookProps) => {
      const guard = useSendGuard();
      const api = useSuspect({ view: p.view, store: makeStore(p.segs), offset: 0, send: p.send ?? defaultSend, canSend: p.canSend ?? true, guard });
      return { api, guard };
    },
    { initialProps: first },
  );
  return { ...r, sends };
}

describe("useSuspect — 보임·옮기기", () => {
  it("둘째 날 토론에 산 사람이면 visible, 첫날·다른 단계·유령은 아니다", () => {
    const segs = { 0: at(0), 1: at(50) };
    expect(mountHook({ view: makeView(), segs }).result.current.api.visible).toBe(true);
    expect(mountHook({ view: makeView({ day: 1 }), segs }).result.current.api.visible).toBe(false);
    expect(mountHook({ view: makeView({ phase: "verdict" }), segs }).result.current.api.visible).toBe(false);
    expect(mountHook({ view: makeView({ dead: [0] }), segs }).result.current.api.visible).toBe(false);
  });
  it("used 는 me.suspectTo 유무(0 도 사용함)", () => {
    const segs = { 0: at(0), 1: at(50) };
    expect(mountHook({ view: makeView(), segs }).result.current.api.used).toBe(false);
    expect(mountHook({ view: makeView({ suspectTo: 0 }), segs }).result.current.api.used).toBe(true);
  });
});

describe("useSuspect — toggleMode", () => {
  it("근처 대상이 있으면 모드가 켜지고 다시 누르면 꺼진다", () => {
    const { result } = mountHook({ view: makeView(), segs: { 0: at(0), 1: at(50) } });
    expect(result.current.api.mode).toBe(false);
    expect(result.current.api.disabled).toBe(false);
    act(() => {
      expect(result.current.api.toggleMode()).toBe("on");
    });
    expect(result.current.api.mode).toBe(true);
    expect(sorted(result.current.api.targets)).toBe("1");
    act(() => {
      expect(result.current.api.toggleMode()).toBe("off");
    });
    expect(result.current.api.mode).toBe(false);
  });
  it("근처 0명이면 모드를 켜지 않고 deny 를 돌려준다(disabled)", () => {
    const { result } = mountHook({ view: makeView(), segs: { 0: at(0), 1: at(500) } });
    expect(result.current.api.disabled).toBe(true);
    act(() => {
      expect(result.current.api.toggleMode()).toBe("deny");
    });
    expect(result.current.api.mode).toBe(false);
  });
  it("canSend 거짓이면 아무 일도 없다(disabled, 모드 안 켜짐)", () => {
    const { result } = mountHook({ view: makeView(), canSend: false, segs: { 0: at(0), 1: at(50) } });
    expect(result.current.api.disabled).toBe(true);
    act(() => {
      expect(result.current.api.toggleMode()).toBeNull();
    });
    expect(result.current.api.mode).toBe(false);
  });
});

describe("useSuspect — 250ms 갱신과 히스테리시스(서버 구간 기준)", () => {
  it("켠 대상은 230 에서도 유지되고 새로 오는 230 은 들지 못하며 241 은 빠진다", () => {
    const segs: Record<number, Segment> = { 0: at(0), 1: at(200), 2: at(300) };
    const { result } = mountHook({ view: makeView(), segs });
    act(() => {
      result.current.api.toggleMode();
    });
    expect(sorted(result.current.api.targets)).toBe("1");
    // 1 은 230(끄는 문턱 100% 안이라 유지), 2 는 230 으로 다가와도 켜는 문턱(92% = 220.8) 밖이라 안 든다
    segs[1] = at(230);
    segs[2] = at(230);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(sorted(result.current.api.targets)).toBe("1");
    segs[1] = at(241);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(sorted(result.current.api.targets)).toBe("");
    expect(result.current.api.mode).toBe(true); // 대상이 없어져도 걷는 동안 모드는 유지된다(P24-5)
    segs[2] = at(220);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(sorted(result.current.api.targets)).toBe("2");
  });
  it("모드가 아닐 때도 같은 간격으로 근처 유무를 다시 재서 disabled 를 정한다", () => {
    const segs: Record<number, Segment> = { 0: at(0), 1: at(500) };
    const { result } = mountHook({ view: makeView(), segs });
    expect(result.current.api.disabled).toBe(true);
    segs[1] = at(100);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current.api.disabled).toBe(false);
  });
});

describe("useSuspect — pick", () => {
  it("대상 좌석을 고르면 suspect 가 한 번 나가고 모드가 같은 렌더에서 끝나며 보내기 기억과 tap 신호가 남는다", () => {
    const signals: LocalSignal[] = [];
    unbindSignals = bindSignals((s) => signals.push(s));
    const { result, sends } = mountHook({ view: makeView(), segs: { 0: at(0), 1: at(50), 2: at(60) } });
    act(() => {
      result.current.api.toggleMode();
    });
    act(() => {
      result.current.api.pick(1);
    });
    expect(sends).toEqual([{ t: "suspect", target: 1 }]);
    expect(result.current.api.mode).toBe(false);
    expect(result.current.guard.peek()).toBe("suspect");
    expect(signals).toEqual([{ kind: "tap" }]);
  });
  it("근처가 아닌 좌석은 무시한다(보내지 않고 모드도 그대로)", () => {
    const { result, sends } = mountHook({ view: makeView(), segs: { 0: at(0), 1: at(50), 2: at(900) } });
    act(() => {
      result.current.api.toggleMode();
    });
    act(() => {
      result.current.api.pick(2);
    });
    expect(sends).toEqual([]);
    expect(result.current.api.mode).toBe(true);
  });
  it("소켓이 닫혀 못 보냈으면(false) 기억도 모드 끝도 없다", () => {
    const { result } = mountHook({ view: makeView(), send: () => false, segs: { 0: at(0), 1: at(50) } });
    act(() => {
      result.current.api.toggleMode();
    });
    act(() => {
      result.current.api.pick(1);
    });
    expect(result.current.guard.peek()).toBeNull();
    expect(result.current.api.mode).toBe(true);
  });
});

describe("useSuspect — 모드가 꺼지는 때", () => {
  const segs = { 0: at(0), 1: at(50), 2: at(60) };
  const turnOn = (r: ReturnType<typeof mountHook>): void => {
    act(() => {
      r.result.current.api.toggleMode();
    });
    expect(r.result.current.api.mode).toBe(true);
  };
  it("단계가 토론을 벗어나면", () => {
    const r = mountHook({ view: makeView(), segs });
    turnOn(r);
    r.rerender({ view: makeView({ phase: "verdict" }), segs });
    expect(r.result.current.api.mode).toBe(false);
  });
  it("일차가 바뀌면", () => {
    const r = mountHook({ view: makeView(), segs });
    turnOn(r);
    r.rerender({ view: makeView({ day: 3 }), segs });
    expect(r.result.current.api.mode).toBe(false);
  });
  it("내가 죽으면", () => {
    const r = mountHook({ view: makeView(), segs });
    turnOn(r);
    r.rerender({ view: makeView({ dead: [0] }), segs });
    expect(r.result.current.api.mode).toBe(false);
  });
  it("Esc 로", () => {
    const r = mountHook({ view: makeView(), segs });
    turnOn(r);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(r.result.current.api.mode).toBe(false);
  });
  it("대상이 죽으면 그 좌석이 targets 에서 바로 빠지고 모드는 남는다", () => {
    const r = mountHook({ view: makeView(), segs });
    turnOn(r);
    expect(sorted(r.result.current.api.targets)).toBe("1,2");
    r.rerender({ view: makeView({ dead: [1] }), segs });
    expect(sorted(r.result.current.api.targets)).toBe("2");
    expect(r.result.current.api.mode).toBe(true);
  });
  it("off() 가 모드를 끈다", () => {
    const r = mountHook({ view: makeView(), segs });
    turnOn(r);
    act(() => r.result.current.api.off());
    expect(r.result.current.api.mode).toBe(false);
  });
});

describe("useSuspect — 서버 확인", () => {
  it("me.suspectTo 가 새로 생기면 보내기 기억을 지우고 붙인 사람에게만 읽을 안내가 생긴다", () => {
    const segs = { 0: at(0), 1: at(50) };
    const r = mountHook({ view: makeView(), segs });
    act(() => {
      r.result.current.api.toggleMode();
    });
    act(() => {
      r.result.current.api.pick(1);
    });
    expect(r.result.current.guard.peek()).toBe("suspect");
    expect(r.result.current.api.said).toBe("");
    r.rerender({ view: makeView({ suspectTo: 1 }), segs });
    expect(r.result.current.guard.peek()).toBeNull();
    expect(r.result.current.api.said).toBe("영희 님에게 의심을 붙였어요");
  });
  it("처음 마운트 때 이미 붙어 있던 것은 안내하지 않는다", () => {
    const r = mountHook({ view: makeView({ suspectTo: 1 }), segs: { 0: at(0), 1: at(50) } });
    expect(r.result.current.api.said).toBe("");
  });
});

// ── 단추 부품 (P24-2·P24-3·P24-4·P24-9) ──
describe("SuspectButton", () => {
  const base = { mode: false, used: false, disabled: false, noTargets: false, onToggle: () => {}, onDeny: () => {} };

  it("쉼: 이름 '의심 붙이기', aria-pressed false, postit 아이콘, 글자 노드 없음", () => {
    const { container } = render(<SuspectButton {...base} />);
    const btn = container.querySelector("button[data-suspect-btn]");
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute("aria-label")).toBe("의심 붙이기");
    expect(btn?.getAttribute("aria-pressed")).toBe("false");
    expect(btn?.getAttribute("type")).toBe("button");
    expect(btn?.querySelector("svg path")).not.toBeNull();
    expect(btn?.textContent).toBe("");
    expect(btn?.hasAttribute("data-suspect-stuck")).toBe(false);
    expect(btn?.querySelector(".mv-chat__will-dot")).toBeNull();
  });
  it("모드: aria-pressed true", () => {
    const { container } = render(<SuspectButton {...base} mode />);
    expect(container.querySelector("[data-suspect-btn]")?.getAttribute("aria-pressed")).toBe("true");
  });
  it("오늘 붙였음: 이름 '의심 옮기기', data-suspect-stuck, 점", () => {
    const { container } = render(<SuspectButton {...base} used />);
    const btn = container.querySelector("[data-suspect-btn]");
    expect(btn?.getAttribute("aria-label")).toBe("의심 옮기기");
    expect(btn?.hasAttribute("data-suspect-stuck")).toBe(true);
    expect(btn?.querySelector(".mv-chat__will-dot")).not.toBeNull();
  });
  it("누르면 onToggle", () => {
    const onToggle = vi.fn();
    const { container } = render(<SuspectButton {...base} onToggle={onToggle} />);
    fireEvent.click(container.querySelector("[data-suspect-btn]")!);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
  it("근처 0명 비활성: aria-disabled, 눌러도 onToggle 이 아니라 onDeny", () => {
    const onToggle = vi.fn();
    const onDeny = vi.fn();
    const { container } = render(<SuspectButton {...base} disabled noTargets onToggle={onToggle} onDeny={onDeny} />);
    const btn = container.querySelector("[data-suspect-btn]")!;
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(btn);
    expect(onToggle).not.toHaveBeenCalled();
    expect(onDeny).toHaveBeenCalledTimes(1);
  });
  it("연결 끊김 비활성: 둘 다 안 불린다", () => {
    const onToggle = vi.fn();
    const onDeny = vi.fn();
    const { container } = render(<SuspectButton {...base} disabled onToggle={onToggle} onDeny={onDeny} />);
    fireEvent.click(container.querySelector("[data-suspect-btn]")!);
    expect(onToggle).not.toHaveBeenCalled();
    expect(onDeny).not.toHaveBeenCalled();
  });
  it("누르면 포커스된 입력칸을 놓아 키보드를 닫는다(P24-4), mousedown 기본 동작은 막지 않는다", () => {
    const { container } = render(
      <div>
        <input data-chat-input="" />
        <SuspectButton {...base} />
      </div>,
    );
    const input = container.querySelector("input")!;
    input.focus();
    expect(document.activeElement).toBe(input);
    const btn = container.querySelector("[data-suspect-btn]")!;
    // fireEvent 는 기본 동작이 막혔으면 false 를 돌려준다
    expect(fireEvent.mouseDown(btn)).toBe(true);
    fireEvent.click(btn);
    expect(document.activeElement).not.toBe(input);
  });
});

// ── 입력줄 슬롯 ──
describe("GamePanel chatTrailing", () => {
  it("chatTrailing 은 [data-chat-trailing] 안에 그려진다", () => {
    const view = makeView();
    const { container } = render(
      <GamePanel
        view={view}
        send={() => true}
        canSend
        binding={{ messages: [], value: "", onChange: () => {}, onSend: () => {} }}
        logHeight={68}
        chatTrailing={<button data-probe="" type="button" />}
      />,
    );
    expect(container.querySelector("[data-chat-trailing] [data-probe]")).not.toBeNull();
  });
  it("주지 않으면 슬롯 자체가 없다", () => {
    const { container } = render(<GamePanel view={makeView()} send={() => true} canSend binding={{ messages: [], value: "", onChange: () => {}, onSend: () => {} }} logHeight={68} />);
    expect(container.querySelector("[data-chat-trailing]")).toBeNull();
  });
});

// ── 이름표 칩 (P24-16) ──
describe("HeadStack 의심 칩", () => {
  it("남의 이름표는 4장 이상일 때만 칩이 보인다", () => {
    for (const n of [0, 1, 2, 3]) {
      const { container, unmount } = render(<HeadStack name="영희" color="var(--seat-2)" suspect={n} />);
      expect(container.querySelector("[data-suspect-count]")).toBeNull();
      unmount();
    }
    const { container } = render(<HeadStack name="영희" color="var(--seat-2)" suspect={4} />);
    const chip = container.querySelector("[data-suspect-count]");
    expect(chip?.getAttribute("data-suspect-count")).toBe("4");
    expect(chip?.getAttribute("aria-label")).toBe("의심 4장");
    expect(chip?.textContent).toBe("4");
    expect(chip?.querySelector("svg")).not.toBeNull();
    // 이름표 안(득표 배지 자리와 반대인 왼쪽 위)에 있다
    expect(container.querySelector(".mv-tag [data-suspect-count]")).not.toBeNull();
  });
  it("내 이름표는 1장 이상이면 늘 보이고 0장·값 없음은 없다", () => {
    const one = render(<HeadStack name="민수" color="var(--seat-1)" me suspect={1} />);
    expect(one.container.querySelector("[data-suspect-count]")?.getAttribute("aria-label")).toBe("의심 1장");
    one.unmount();
    const zero = render(<HeadStack name="민수" color="var(--seat-1)" me suspect={0} />);
    expect(zero.container.querySelector("[data-suspect-count]")).toBeNull();
    zero.unmount();
    const none = render(<HeadStack name="민수" color="var(--seat-1)" me />);
    expect(none.container.querySelector("[data-suspect-count]")).toBeNull();
  });
});
