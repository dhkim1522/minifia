import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { PhaseId, RoomView } from "../../shared/protocol";
import { SceneCurtain } from "../../src/components/SceneCurtain";

// NIGHT-11·E8, UI-SPEC 143·214~261행. 장면 전환 막(SceneCurtain)은 공개 마감만의 함수다 — 덮기 시작은 phaseEndsAt − offset − 420ms,
// 모든 역할(시민·마피아·유령)이 같은 시각이다(결정 0061-4, 연구 Pitfall 8). 걷히는 때는 다음 단계(밤·아침) view 가 온 뒤다.
const NOW = 1_700_000_000_000;

interface CurtainViewOpts {
  phase: PhaseId;
  /** 지금부터 마감까지 ms */
  endsIn?: number;
  role?: "citizen" | "mafia" | "police" | "doctor";
  /** 내가 탈락(유령 화면) */
  dead?: boolean;
  /** 지목 단계의 지목 줄(seat → target) */
  points?: Array<{ seat: number; target: number }>;
}

function curtainView(o: CurtainViewOpts): RoomView {
  const players = Array.from({ length: 6 }, (_, seat) => ({
    seat,
    nickname: `p${seat}`,
    connected: true,
    isHost: seat === 0,
    ...(o.dead && seat === 0 ? { alive: false } : {}),
  }));
  return {
    code: "0042",
    phase: o.phase,
    phaseEndsAt: NOW + (o.endsIn ?? 30_000),
    phaseDurationMs: 30_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: 0, isHost: true, role: o.role ?? "citizen" },
    day: { n: 1, roles: [], ...(o.points ? { points: o.points } : {}) },
  } as unknown as RoomView;
}

const curtain = (c: ParentNode): HTMLElement | null => c.querySelector<HTMLElement>("[data-curtain]");
const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("장면 전환 막 — 공개 마감 420ms 전 덮기 → 다음 단계 view 에서 800ms 걷기 (E8 #41)", () => {
  it("밤 view(마감 1000ms 뒤): 579ms 까지 막이 없고, 580ms 에 덮는 중(data-curtain), 1000ms 에 완전히 덮인다", () => {
    const { container } = render(<SceneCurtain view={curtainView({ phase: "night", endsIn: 1000 })} offset={0} reducedMotion={false} />);
    expect(curtain(container)).toBeNull();
    advance(579);
    expect(curtain(container)).toBeNull();
    advance(1);
    const el = curtain(container)!;
    expect(el.getAttribute("data-curtain")).toBe("true");
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.className).toContain("mf-curtain");
    expect(el.classList.contains("is-covering")).toBe(true);
    advance(420);
    expect(curtain(container)!.classList.contains("is-covered")).toBe(true);
    expect(curtain(container)!.classList.contains("is-covering")).toBe(false);
  });

  it("아침 view 가 오면 800ms 동안 걷히는 클래스(is-lifting), 그 뒤 막이 사라진다", () => {
    const night = curtainView({ phase: "night", endsIn: 1000 });
    const { container, rerender } = render(<SceneCurtain view={night} offset={0} reducedMotion={false} />);
    advance(1000);
    expect(curtain(container)!.classList.contains("is-covered")).toBe(true);
    rerender(<SceneCurtain view={curtainView({ phase: "morning", endsIn: 9000 })} offset={0} reducedMotion={false} />);
    expect(curtain(container)!.classList.contains("is-lifting")).toBe(true);
    advance(799);
    expect(curtain(container)).not.toBeNull();
    advance(1);
    expect(curtain(container)).toBeNull();
  });

  it("서버 시계 보정(offset): 서버가 로컬보다 500ms 앞서면 로컬 마감이 500ms 빨라져 덮기도 500ms 빨리 시작한다", () => {
    const { container } = render(<SceneCurtain view={curtainView({ phase: "night", endsIn: 1000 })} offset={500} reducedMotion={false} />);
    advance(79);
    expect(curtain(container)).toBeNull();
    advance(1);
    expect(curtain(container)).not.toBeNull();
  });

  it.each([
    ["처형", { phase: "execution" as const }],
    ["단독 선두 없는 지목(동률)", { phase: "nomination" as const, points: [{ seat: 1, target: 2 }, { seat: 2, target: 3 }] }],
    ["지목 0표", { phase: "nomination" as const, points: [] }],
  ])("%s view 도 같은 시각(마감 − 420ms)에 덮는다", (_name, opts) => {
    const { container } = render(<SceneCurtain view={curtainView({ ...opts, endsIn: 1000 })} offset={0} reducedMotion={false} />);
    advance(579);
    expect(curtain(container)).toBeNull();
    advance(1);
    expect(curtain(container)?.getAttribute("data-curtain")).toBe("true");
  });

  it("단독 선두가 있는 지목, 토론, 변론, 아침 view 는 마감이 와도 덮지 않는다", () => {
    for (const opts of [
      { phase: "nomination" as const, points: [{ seat: 1, target: 2 }] },
      { phase: "discussion" as const },
      { phase: "defense" as const },
      { phase: "morning" as const },
    ]) {
      const { container, unmount } = render(<SceneCurtain view={curtainView({ ...opts, endsIn: 1000 })} offset={0} reducedMotion={false} />);
      advance(2000);
      expect(curtain(container), opts.phase).toBeNull();
      unmount();
    }
  });

  it("지목 단계에서 덮기 전에 단독 선두가 생기면(다음이 변론) 덮지 않는다", () => {
    const tie = curtainView({ phase: "nomination", endsIn: 1000, points: [] });
    const { container, rerender } = render(<SceneCurtain view={tie} offset={0} reducedMotion={false} />);
    advance(300);
    rerender(<SceneCurtain view={curtainView({ phase: "nomination", endsIn: 700, points: [{ seat: 1, target: 2 }] })} offset={0} reducedMotion={false} />);
    advance(2000);
    expect(curtain(container)).toBeNull();
  });

  it("첫 렌더가 아침 view(재접속)이면 막이 없다", () => {
    const { container } = render(<SceneCurtain view={curtainView({ phase: "morning", endsIn: 9000 })} offset={0} reducedMotion={false} />);
    expect(curtain(container)).toBeNull();
    advance(10_000);
    expect(curtain(container)).toBeNull();
  });

  it("모션 줄이기: 마감 시각에 즉시 덮고(미리 덮지 않는다), 아침 view 에서 즉시 사라진다", () => {
    const { container, rerender } = render(<SceneCurtain view={curtainView({ phase: "night", endsIn: 1000 })} offset={0} reducedMotion />);
    advance(999);
    expect(curtain(container)).toBeNull();
    advance(1);
    expect(curtain(container)!.classList.contains("is-covered")).toBe(true);
    rerender(<SceneCurtain view={curtainView({ phase: "morning", endsIn: 9000 })} offset={0} reducedMotion />);
    expect(curtain(container)).toBeNull();
  });

  it("시민·마피아·유령 view 에서 막이 덮기 시작하는 시각이 같다(T-09-43)", () => {
    const starts: number[] = [];
    for (const opts of [{ role: "citizen" as const }, { role: "mafia" as const }, { role: "police" as const }, { role: "citizen" as const, dead: true }]) {
      const { container, unmount } = render(<SceneCurtain view={curtainView({ phase: "night", endsIn: 1000, ...opts })} offset={0} reducedMotion={false} />);
      let t = 0;
      while (curtain(container) === null && t < 2000) {
        advance(1);
        t += 1;
      }
      starts.push(t);
      unmount();
      vi.setSystemTime(NOW); // 다음 view 의 마감을 같은 기준에서 다시 잰다
    }
    expect(starts.join(",")).toBe("580,580,580,580");
  });

  it("holdUntil 이 있으면(피해자) 아침 view 가 와도 그 시각까지 걷히지 않고 이후 800ms 에 걷는다", () => {
    const { container, rerender } = render(<SceneCurtain view={curtainView({ phase: "night", endsIn: 1000 })} offset={0} reducedMotion={false} />);
    advance(1000);
    const hold = Date.now() + 2800;
    rerender(<SceneCurtain view={curtainView({ phase: "morning", endsIn: 9000 })} offset={0} reducedMotion={false} holdUntil={hold} />);
    advance(2799);
    expect(curtain(container)!.classList.contains("is-covered")).toBe(true);
    expect(curtain(container)!.classList.contains("is-lifting")).toBe(false);
    advance(1);
    expect(curtain(container)!.classList.contains("is-lifting")).toBe(true);
    advance(800);
    expect(curtain(container)).toBeNull();
  });
});
