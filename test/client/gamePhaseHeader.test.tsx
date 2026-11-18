import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { RoomView } from "../../shared/protocol";
import { GamePhaseHeader } from "../../src/components/v2/GamePhaseHeader";

const NOW = 1_700_000_000_000;

function fixture(overrides: Partial<RoomView> = {}): RoomView {
  return {
    code: "0042",
    phase: "discussion",
    phaseEndsAt: NOW + 20_000,
    phaseDurationMs: 20_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: [],
    me: { seat: 0, role: "citizen", isHost: true },
    ...overrides,
  };
}

beforeEach(() => vi.useFakeTimers({ now: NOW }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("서버 시계에 맞춰 숫자 없이 줄어들고 10초·5초에 색을 바꾼다", () => {
  render(<GamePhaseHeader title="토론" view={fixture()} offset={1_000} extra={null} />);
  const timer = screen.getByRole("timer");
  const fill = timer.querySelector<HTMLElement>(".mf-phase-gauge__fill");
  expect(timer.textContent).toBe("");
  expect(timer.getAttribute("aria-label")).toBe("남은 시간 19초");
  expect(timer.getAttribute("data-tone")).toBe("calm");
  expect(fill?.style.transform).toBe("scaleX(0.95)");

  act(() => { vi.advanceTimersByTime(9_000); });
  expect(timer.getAttribute("data-tone")).toBe("warn");
  expect(fill?.style.transform).toBe("scaleX(0.5)");
  act(() => { vi.advanceTimersByTime(5_000); });
  expect(timer.getAttribute("data-tone")).toBe("urgent");
  expect(fill?.style.transform).toBe("scaleX(0.25)");
  act(() => { vi.advanceTimersByTime(6_000); });
  expect(timer.getAttribute("aria-label")).toBe("남은 시간 0초");
  expect(fill?.style.transform).toBe("scaleX(0)");
});

it("조기 진행에는 경고하지 않고 다음 단계에서 새 막대를 그린다", () => {
  const normal = fixture();
  const header = (view: RoomView, epoch = 0) => <GamePhaseHeader title="토론" view={view} offset={0} epoch={epoch} extra={null} />;
  const { rerender } = render(header(normal));
  const timer = screen.getByRole("timer");
  const shortened = { ...normal, phaseEndsAt: NOW + 1_500 };
  rerender(header(shortened));
  expect(timer.getAttribute("data-tone")).toBe("calm");
  expect(timer.getAttribute("aria-label")).toBe("남은 시간 2초");

  rerender(header(shortened, 1));
  expect(timer.getAttribute("data-tone")).toBe("urgent");

  rerender(header(fixture({ phase: "verdict", phaseEndsAt: NOW + 5_000 }), 1));
  const next = screen.getByRole("timer");
  expect(next).not.toBe(timer);
  expect(next.getAttribute("data-tone")).toBe("urgent");
});

it("마감이 없는 장면·짧은 막간·연습에서는 시간을 숨긴다", () => {
  const header = (view: RoomView, timeless = false) => <GamePhaseHeader title="토론" view={view} offset={0} extra={null} timeless={timeless} />;
  const { rerender } = render(header(fixture({ phaseEndsAt: null })));
  expect(screen.queryByRole("timer")).toBeNull();
  rerender(header(fixture({ phase: "dayAnnounce", phaseDurationMs: 2_000, phaseEndsAt: NOW + 2_000 })));
  expect(screen.queryByRole("timer")).toBeNull();
  rerender(header(fixture({ phase: "dayAnnounce" })));
  expect(screen.queryByRole("timer")).toBeNull();
  rerender(header(fixture(), true));
  expect(screen.queryByRole("timer")).toBeNull();
});
