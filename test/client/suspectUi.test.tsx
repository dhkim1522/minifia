import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { ClientMessage, PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { restSegment } from "../../shared/game/world";
import type { Segment } from "../../shared/game/world";
import { bindSignals } from "../../src/audio/signals";
import type { LocalSignal } from "../../src/audio/signals";
import { useSendGuard } from "../../src/net/useSendGuard";
import { useSuspect } from "../../src/net/useSuspect";

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
