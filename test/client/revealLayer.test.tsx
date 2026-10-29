import { act, cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidateVoteLine } from "../../shared/protocol";
import { RevealLayer } from "../../src/components/RevealLayer";
import { DayTable } from "../../src/components/DayTable";
import type { DayTableSeat } from "../../src/components/DayTable";
import { daySeatLayout } from "../../src/game/dayTable";
import { candidateRevealMs } from "../../shared/game/phases";
import { REVEAL_DRAW_MS, REVEAL_FADE_MS, REVEAL_LEAD_MS, REVEAL_REDUCED_HOLD_MS, REVEAL_SLOT_MS, arrowEndpoints, revealPlan } from "../../src/game/verdict";
import { useReducedMotion } from "../../src/net/useReducedMotion";
import { renderHook } from "@testing-library/react";

// 후보 선택 공개 화살표 층 (04-20 Task 1, D-20·D-32, UI-SPEC 8.3·13.4). rAF 는 가짜 타이머가 16ms 간격으로 흉내 낸다.
const START = 1_700_000_000_000;
const W = 390;
const H = 600;
const SEATS = [0, 1, 2, 3, 4];
const PLACES = daySeatLayout(
  SEATS.map((seat) => ({ seat })),
  0,
  W,
  H,
);
const LAYOUT = { places: PLACES, sceneW: W, sceneH: H };

/** 서버가 정한 순서: 하윤(1)·민지(2)가 도현(3)에게, 지우(0)는 하윤(1)에게 ... */
const VOTES: CandidateVoteLine[] = [
  { seat: 1, target: 3 },
  { seat: 2, target: 3 },
  { seat: 0, target: 1 },
  { seat: 4, target: 3 },
  { seat: 3, target: 2 },
];
const PLAN = revealPlan(VOTES, START);
const serverNow = (): number => Date.now();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout", "Date"] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const placeOf = (seat: number) => {
  const p = PLACES.find((x) => x.seat === seat)!;
  return { x: p.x, y: p.y, scale: p.scale };
};
const endpointsOf = (voter: number, target: number) => arrowEndpoints(placeOf(voter), placeOf(target));

/** START + t 의 서버 시각에서 층을 그린다 */
function mountAt(t: number, reduced = false, plan = PLAN) {
  vi.setSystemTime(START + t);
  const utils = render(<RevealLayer layout={LAYOUT} plan={plan} serverNow={serverNow} reduced={reduced} />);
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  return { ...utils, advance };
}
const arrows = (c: HTMLElement) => c.querySelectorAll<SVGSVGElement>(".mf-varrow");
const linesOf = (c: HTMLElement) => Array.from(c.querySelectorAll<SVGLineElement>(".mf-varrow line"));
const num = (el: Element, name: string) => Number(el.getAttribute(name));
const easeOut = (p: number) => 1 - (1 - p) ** 3;

describe("RevealLayer: 화살표 하나가 자라며 나가고 닿으면 사라진다 (D-20, D-32)", () => {
  it("첫 화살표 전(단계 시작 + REVEAL_LEAD_MS − 1)에는 .mf-varrow 가 없다", () => {
    const { container } = mountAt(REVEAL_LEAD_MS - 1);
    expect(arrows(container).length).toBe(0);
  });

  it("첫 화살표(시작 + REVEAL_LEAD_MS): 하나, 시작점에서 출발하고 aria-hidden 이며 두 겹 선 + 삼각 머리 marker 가 있다", () => {
    const { container } = mountAt(REVEAL_LEAD_MS);
    expect(arrows(container).length).toBe(1);
    const svg = arrows(container)[0];
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    const lines = linesOf(container);
    expect(lines.length).toBe(2);
    const { start } = endpointsOf(1, 3);
    for (const l of lines) {
      expect(num(l, "x1")).toBeCloseTo(start.x, 3);
      expect(num(l, "y1")).toBeCloseTo(start.y, 3);
      expect(num(l, "x2")).toBeCloseTo(start.x, 3); // 진행도 0: 끝점이 아직 시작점
      expect(num(l, "y2")).toBeCloseTo(start.y, 3);
      expect(l.getAttribute("stroke-linecap")).toBe("round");
    }
    // 아래 겹은 night-950 9px, 위 겹은 앰버 5px + marker-end
    expect(num(lines[0], "stroke-width")).toBe(9);
    expect(num(lines[1], "stroke-width")).toBe(5);
    expect(lines[0].getAttribute("stroke")).toBe("var(--night-950)");
    expect(num(lines[0], "stroke-opacity")).toBeCloseTo(0.55, 2);
    expect(lines[1].getAttribute("stroke")).toBe("var(--amber-400)");
    expect(lines[0].getAttribute("marker-end")).toBeNull();
    const markerRef = /^url\(#(.+)\)$/.exec(lines[1].getAttribute("marker-end") ?? "");
    expect(markerRef).not.toBeNull();
    const marker = container.querySelector(`marker[id="${markerRef![1]}"]`)!;
    expect(marker).not.toBeNull();
    expect(marker.getAttribute("markerWidth")).toBe("5");
    expect(marker.getAttribute("markerHeight")).toBe("5");
    expect(marker.getAttribute("refX")).toBe("7");
    expect(marker.querySelector("path")?.getAttribute("d")).toBe("M0 0L10 5L0 10z");
  });

  it("끝점은 시작점에서 arrowEndpoints 의 끝으로 세제곱 ease-out 으로 자란다(1200ms), 닿으면 끝에 있다", () => {
    const { start, end } = endpointsOf(1, 3);
    for (const dt of [0, 240, 600, 960, REVEAL_DRAW_MS - 1]) {
      cleanup();
      const { container } = mountAt(REVEAL_LEAD_MS + dt);
      const k = easeOut(dt / REVEAL_DRAW_MS);
      const [under, over] = linesOf(container);
      for (const l of [under, over]) {
        expect(num(l, "x2")).toBeCloseTo(start.x + (end.x - start.x) * k, 3);
        expect(num(l, "y2")).toBeCloseTo(start.y + (end.y - start.y) * k, 3);
      }
    }
    cleanup();
    const touched = mountAt(REVEAL_LEAD_MS + REVEAL_DRAW_MS);
    const [, over] = linesOf(touched.container);
    expect(num(over, "x2")).toBeCloseTo(end.x, 3);
    expect(num(over, "y2")).toBeCloseTo(end.y, 3);
  });

  it("닿고 120ms 동안 불투명도가 1 → 0, 그 뒤 DOM 에 없다", () => {
    const touch = REVEAL_LEAD_MS + REVEAL_DRAW_MS;
    const at = (dt: number) => {
      cleanup();
      return mountAt(touch + dt).container;
    };
    expect(arrows(at(0))[0].style.opacity).toBe("1");
    expect(Number(arrows(at(60))[0].style.opacity)).toBeCloseTo(0.5, 2);
    expect(arrows(at(REVEAL_FADE_MS - 1)).length).toBe(1);
    expect(arrows(at(REVEAL_FADE_MS)).length).toBe(0);
    // 다음 화살표(시작 + LEAD + SLOT) 전 틈에는 없다
    expect(arrows(at(REVEAL_FADE_MS + 200)).length).toBe(0);
  });

  it("시간 0~(공개 전체 길이)를 20ms 간격으로 훑어도 .mf-varrow 가 둘 이상인 시점이 없고, 단계마다 한 번씩 나온다", () => {
    const { container, advance } = mountAt(0);
    const seenSteps = new Set<string>();
    let maxCount = 0;
    let withArrow = 0;
    for (let t = 0; t <= candidateRevealMs(VOTES.length); t += 20) {
      const found = arrows(container);
      maxCount = Math.max(maxCount, found.length);
      if (found.length === 1) {
        withArrow += 1;
        seenSteps.add(found[0].getAttribute("data-step") ?? "");
      }
      advance(20);
    }
    expect(maxCount).toBe(1);
    expect(withArrow).toBeGreaterThan(0);
    expect([...seenSteps].sort()).toEqual(["0", "1", "2", "3", "4"]);
  });

  it("각 단계의 화살표는 그 단계의 투표자 → 대상 좌표를 쓴다", () => {
    const [s0, s1, s2] = PLAN.steps;
    cleanup();
    const a = mountAt(s1.startMs - START + REVEAL_DRAW_MS);
    const e1 = endpointsOf(s1.voter, s1.target);
    expect(num(linesOf(a.container)[1], "x1")).toBeCloseTo(e1.start.x, 3);
    expect(num(linesOf(a.container)[1], "x2")).toBeCloseTo(e1.end.x, 3);
    cleanup();
    const b = mountAt(s2.startMs - START + REVEAL_DRAW_MS);
    const e2 = endpointsOf(s2.voter, s2.target);
    expect(num(linesOf(b.container)[1], "y1")).toBeCloseTo(e2.start.y, 3);
    expect(num(linesOf(b.container)[1], "y2")).toBeCloseTo(e2.end.y, 3);
    expect(s0.voter).toBe(1);
  });

  it("중간 합류: 지난 화살표를 재생하지 않고 지금 슬롯의 화살표만 남은 시간으로 이어서 그린다", () => {
    const s = PLAN.steps[3]; // 시작 + LEAD + 3×SLOT
    const { container } = mountAt(s.startMs - START + REVEAL_DRAW_MS / 2);
    expect(arrows(container).length).toBe(1);
    expect(arrows(container)[0].getAttribute("data-step")).toBe("3");
    const { start, end } = endpointsOf(s.voter, s.target);
    const k = easeOut(0.5);
    expect(num(linesOf(container)[1], "x2")).toBeCloseTo(start.x + (end.x - start.x) * k, 3);
  });

  it("좌석을 못 찾는 줄(이상 입력)은 화살표를 그리지 않고 건너뛴다. 예외도 없다 (T-04-56)", () => {
    const bad: CandidateVoteLine[] = [
      { seat: 1, target: 9 }, // 없는 자리
      { seat: 2, target: 3 },
    ];
    const plan = revealPlan(bad, START);
    const first = mountAt(REVEAL_LEAD_MS + 100, false, plan);
    expect(arrows(first.container).length).toBe(0);
    cleanup();
    const second = mountAt(plan.steps[1].startMs - START + 100, false, plan);
    expect(arrows(second.container).length).toBe(1);
  });

  it("투표 줄이 없으면(0표) 아무것도 그리지 않고 프레임 요청도 하지 않는다", () => {
    const plan = revealPlan([], START);
    const raf = vi.spyOn(globalThis, "requestAnimationFrame");
    const { container, advance } = mountAt(100, false, plan);
    advance(1000);
    expect(arrows(container).length).toBe(0);
    expect(raf).not.toHaveBeenCalled();
  });
});

describe("RevealLayer: 축소 모션 (UI-SPEC 13.4)", () => {
  it("자라는 동작 없이 완성된 모습으로 시작해 닿을 때까지(1200ms) 보이고, 120ms 동안 사라진다", () => {
    const { end } = endpointsOf(1, 3);
    expect(REVEAL_REDUCED_HOLD_MS).toBe(REVEAL_DRAW_MS);
    for (const dt of [0, 100, REVEAL_REDUCED_HOLD_MS - 1]) {
      cleanup();
      const { container } = mountAt(REVEAL_LEAD_MS + dt, true);
      expect(arrows(container).length).toBe(1);
      expect(num(linesOf(container)[1], "x2")).toBeCloseTo(end.x, 3);
      expect(num(linesOf(container)[1], "y2")).toBeCloseTo(end.y, 3);
      expect(arrows(container)[0].style.opacity).toBe("1");
    }
    cleanup();
    const fading = mountAt(REVEAL_LEAD_MS + REVEAL_REDUCED_HOLD_MS + REVEAL_FADE_MS / 2, true);
    expect(num(linesOf(fading.container)[1], "x2")).toBeCloseTo(end.x, 3);
    expect(Number(arrows(fading.container)[0].style.opacity)).toBeCloseTo(0.5, 2);
    cleanup();
    expect(arrows(mountAt(REVEAL_LEAD_MS + REVEAL_REDUCED_HOLD_MS + REVEAL_FADE_MS, true).container).length).toBe(0);
    expect(REVEAL_REDUCED_HOLD_MS + REVEAL_FADE_MS).toBeLessThanOrEqual(REVEAL_SLOT_MS);
  });

  it("축소 모션에서도 동시에 하나뿐이다", () => {
    const { container, advance } = mountAt(0, true);
    let max = 0;
    for (let t = 0; t <= candidateRevealMs(VOTES.length); t += 20) {
      max = Math.max(max, arrows(container).length);
      advance(20);
    }
    expect(max).toBe(1);
  });
});

describe("RevealLayer: 정리 (T-04-55)", () => {
  it("언마운트하면 예약된 프레임 요청을 취소하고 이후 새 요청이 없다", () => {
    const raf = vi.spyOn(globalThis, "requestAnimationFrame");
    const caf = vi.spyOn(globalThis, "cancelAnimationFrame");
    const { unmount, advance } = mountAt(0);
    advance(100);
    expect(raf).toHaveBeenCalled();
    const requested = raf.mock.calls.length;
    unmount();
    expect(caf).toHaveBeenCalled();
    advance(5000);
    expect(raf.mock.calls.length).toBe(requested);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("마지막 화살표가 사라진 뒤에는 프레임 요청을 더 하지 않는다", () => {
    const raf = vi.spyOn(globalThis, "requestAnimationFrame");
    const last = PLAN.steps[PLAN.steps.length - 1];
    const { container, advance } = mountAt(0);
    advance(last.fadeEndMs - START + 64);
    expect(arrows(container).length).toBe(0);
    const requested = raf.mock.calls.length;
    advance(3000);
    expect(raf.mock.calls.length).toBe(requested);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("이미 다 끝난 시각(공개 전체 길이 − 100)에 합류하면 프레임 요청 없이 아무것도 그리지 않는다", () => {
    const raf = vi.spyOn(globalThis, "requestAnimationFrame");
    const { container, advance } = mountAt(candidateRevealMs(VOTES.length) - 100);
    advance(1000);
    expect(arrows(container).length).toBe(0);
    expect(raf).not.toHaveBeenCalled();
  });

  it("marker id 는 인스턴스마다 다르다(useId)", () => {
    const a = mountAt(REVEAL_LEAD_MS + 100);
    const b = render(<RevealLayer layout={LAYOUT} plan={PLAN} serverNow={serverNow} reduced={false} />);
    const ids = Array.from(document.querySelectorAll("marker")).map((m) => m.id);
    expect(ids.length).toBe(2);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id) => !id.includes(":"))).toBe(true);
    a.unmount();
    b.unmount();
  });
});

describe("DayTable layer 슬롯", () => {
  const seats: DayTableSeat[] = SEATS.map((seat) => ({
    seat,
    nickname: `사람${seat}`,
    connected: true,
    isHost: seat === 0,
    isMe: seat === 0,
    isAlly: false,
  }));

  it("layer 가 없으면 루트 자식은 이전과 같다(층 없음)", () => {
    const { container } = render(<DayTable seats={seats} mySeat={0} width={W} height={H} />);
    expect(container.querySelector(".mf-varrow")).toBeNull();
    expect(container.querySelector("[data-test-layer]")).toBeNull();
  });

  it("layer 는 {places, sceneW, sceneH} 로 한 번 불리고 루트의 마지막 자식으로 그려진다", () => {
    const layer = vi.fn((l: { places: readonly { seat: number }[]; sceneW: number; sceneH: number }) => (
      <i data-test-layer={`${l.places.length}:${l.sceneW}x${l.sceneH}`} />
    ));
    const { container } = render(<DayTable seats={seats} mySeat={0} width={W} height={H} layer={layer} />);
    const root = container.querySelector(".mf-dt")!;
    expect(root.lastElementChild?.getAttribute("data-test-layer")).toBe(`5:${W}x${H}`);
    expect(layer).toHaveBeenCalledTimes(1);
  });
});

describe("useReducedMotion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("matchMedia 가 없으면 false", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it("현재 값과 변화를 따르고 언마운트 때 구독을 푼다", () => {
    let listener: ((e: { matches: boolean }) => void) | null = null;
    const removed = vi.fn();
    const mql = {
      matches: true,
      addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
        listener = fn;
      },
      removeEventListener: removed,
    };
    const mm = vi.fn(() => mql);
    vi.stubGlobal("matchMedia", mm);
    const { result, unmount } = renderHook(() => useReducedMotion());
    expect(mm).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    expect(result.current).toBe(true);
    act(() => listener?.({ matches: false }));
    expect(result.current).toBe(false);
    unmount();
    expect(removed).toHaveBeenCalled();
  });
});

describe("verdict.css: 화살표 층 규칙", () => {
  const css = readFileSync("src/styles/verdict.css", "utf8");
  const rule = /\.mf-varrow\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";

  it("절대 위치 전체 덮개, z 40, 클릭을 가로채지 않음, 앰버 그림자", () => {
    expect(rule).toContain("position: absolute");
    expect(rule).toContain("inset: 0");
    expect(rule).toContain("overflow: visible");
    expect(rule).toContain("z-index: 40");
    expect(rule).toContain("pointer-events: none");
    expect(css).toContain("drop-shadow(0 0 7px color-mix(in srgb, var(--amber-400) 90%, transparent))");
  });

  it("진홍을 쓰지 않는다 (D-33)", () => {
    expect(rule).not.toContain("crimson");
  });
});
