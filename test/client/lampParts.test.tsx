import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { RoleCard } from "../../src/components/RoleCard";
import { ErrandAct } from "../../src/components/v2/ErrandAct";
import { ErrandStartCard } from "../../src/components/v2/ErrandStartCard";
import { V2Icon } from "../../src/components/v2/V2Icon";
import type { V2IconName } from "../../src/components/v2/V2Icon";
import { ROLE_IDS } from "../../shared/game/roles";
import type { PlaceId, RoomView } from "../../shared/protocol";
import { roleHintOf } from "../../src/game/roleText";
import { openCause } from "../helpers/playable";

// 21-08 Task 1: 저녁 부품(D-06·D-24, P21-7·P21-17) — 새 아이콘 넷, [켜기](라벨·아이콘 prop + 0.6초 길게 누르기), 시작 카드 "오늘 켤 등불", 마피아 역할 카드 한 줄.
// 길게 누르기는 모든 역할이 같은 제스처·같은 DOM 이다(T-21-28). 마피아 줄은 본인 카드에만 있다(T-21-29).

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

let restore: () => void = () => {};
beforeAll(() => {
  restore = openCause();
});
afterAll(() => restore());

const LAMPS: PlaceId[] = ["lamp0", "lamp3", "lamp6"];
const HOLD_LINE = "길게 누르면 심지를 잘라요";

describe("V2Icon 새 아이콘 넷 (UI-SPEC 새 아이콘 규격)", () => {
  it("flame·flameOff·footprint·window 가 경로를 그린다(빈 svg 가 아니다)", () => {
    for (const name of ["flame", "flameOff", "footprint", "window"] as const) {
      const { container, unmount } = render(<V2Icon name={name as V2IconName} />);
      const svg = container.querySelector("svg")!;
      expect(svg.querySelectorAll("path, rect, circle").length, name).toBeGreaterThan(0);
      unmount();
    }
  });
});

describe("ErrandAct [켜기] (P21-7 길게 누르기)", () => {
  const lamp = (onPress: (hold: boolean) => void) => <ErrandAct id="lamp0" call label="켜기" icon="flame" aria="가로등에서 켜기" onPress={onPress} />;

  it("라벨·아이콘·접근성 이름 prop: 글 '켜기', 불꽃 아이콘, aria-label '가로등에서 켜기'", () => {
    const { container } = render(lamp(() => {}));
    const b = container.querySelector("button")!;
    expect(b.textContent).toBe("켜기");
    expect(b.getAttribute("aria-label")).toBe("가로등에서 켜기");
    expect(b.querySelector("svg")!.innerHTML).toContain("M12 3c3 4 5 6 5 10a5 5 0 0 1-10 0c0-4 2-6 5-10z");
  });

  it("prop 이 없으면 지금 '처리' 마크업 그대로(손 아이콘·'{장소}에서 처리')", () => {
    const { container } = render(<ErrandAct id="glass" call={false} onPress={() => {}} />);
    const b = container.querySelector("button")!;
    expect(b.textContent).toBe("처리");
    expect(b.getAttribute("aria-label")).toBe("술잔에서 처리");
    expect(b.querySelector("svg")!.innerHTML).toContain("M9 11V5a1.5 1.5 0 0 1 3 0v5V4");
  });

  it("그냥 클릭(키보드 Enter·Space 포함)이면 onPress(false) 한 번", () => {
    const onPress = vi.fn();
    const { container } = render(lamp(onPress));
    fireEvent.click(container.querySelector("button")!);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenLastCalledWith(false);
  });

  it("pointerdown 뒤 600ms 전에 떼면 onPress(false) 한 번(떼는 순간)", () => {
    vi.useFakeTimers();
    const onPress = vi.fn();
    const { container } = render(lamp(onPress));
    const b = container.querySelector("button")!;
    fireEvent.pointerDown(b);
    vi.advanceTimersByTime(599);
    expect(onPress).not.toHaveBeenCalled();
    fireEvent.pointerUp(b);
    fireEvent.click(b, { detail: 1 }); // 실제 브라우저는 pointerup 뒤 click 을 하나 더 낸다 — 두 번 보내지 않는다
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenLastCalledWith(false);
  });

  it("pointerdown 뒤 600ms 를 넘겨 떼면 onPress(true) 한 번(떼는 순간) — 누르고 있는 동안은 아무것도 보내지 않는다", () => {
    vi.useFakeTimers();
    const onPress = vi.fn();
    const { container } = render(lamp(onPress));
    const b = container.querySelector("button")!;
    fireEvent.pointerDown(b);
    vi.advanceTimersByTime(700);
    expect(onPress).not.toHaveBeenCalled();
    fireEvent.pointerUp(b);
    fireEvent.click(b, { detail: 1 });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenLastCalledWith(true);
  });

  it("pointercancel 이면 아무것도 보내지 않고, 다음 짧은 누름은 다시 false 다", () => {
    vi.useFakeTimers();
    const onPress = vi.fn();
    const { container } = render(lamp(onPress));
    const b = container.querySelector("button")!;
    fireEvent.pointerDown(b);
    vi.advanceTimersByTime(900);
    fireEvent.pointerCancel(b);
    expect(onPress).not.toHaveBeenCalled();
    fireEvent.pointerDown(b);
    fireEvent.pointerUp(b);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenLastCalledWith(false);
  });

  it("짧게·길게 누른 뒤 렌더된 마크업(outerHTML)이 같다 — 연출·접근성 이름 차이 없음(T-21-28)", () => {
    vi.useFakeTimers();
    const html = (ms: number): string => {
      const { container, unmount } = render(lamp(() => {}));
      const b = container.querySelector("button")!;
      fireEvent.pointerDown(b);
      vi.advanceTimersByTime(ms);
      const during = b.outerHTML;
      fireEvent.pointerUp(b);
      const out = b.outerHTML + during;
      unmount();
      return out;
    };
    expect(html(700)).toBe(html(100));
  });
});

describe("ErrandStartCard 원인 흐름 (P21-17)", () => {
  it("제목 '오늘 켤 등불', 타일 셋(접근성 '가로등 장소'), 아래 줄 그대로", () => {
    const { container } = render(<ErrandStartCard places={LAMPS} cause />);
    expect(container.querySelector(".mv-errand-start__title")!.textContent).toBe("오늘 켤 등불");
    const tiles = [...container.querySelectorAll("[role='img']")];
    expect(tiles.map((t) => t.getAttribute("aria-label"))).toEqual(["가로등 장소", "가로등 장소", "가로등 장소"]);
    expect(container.textContent).toContain("가는 길에 본 사람이 기록돼요");
    expect(container.textContent).not.toContain("오늘 갈 곳");
  });

  it("cause 가 아니면 지금 '오늘 갈 곳'", () => {
    const { container } = render(<ErrandStartCard places={["glass", "piano", "sax"]} />);
    expect(container.querySelector(".mv-errand-start__title")!.textContent).toBe("오늘 갈 곳");
  });
});

describe("마피아 역할 카드 한 줄 (P21-7, T-21-29)", () => {
  const view = (role: (typeof ROLE_IDS)[number], mode?: "basic" | "extended"): RoomView =>
    ({ code: "0042", phase: "roleReveal", phaseEndsAt: null, phaseDurationMs: null, serverNow: 0, minPlayers: 4, maxPlayers: 8, players: [], me: { seat: 0, isHost: false, role }, ...(mode === undefined ? {} : { mode }) }) as unknown as RoomView;

  it("원인 흐름 마피아만 줄이 있다", () => {
    expect(roleHintOf(view("mafia", "extended"))).toBe(HOLD_LINE);
    for (const role of ROLE_IDS.filter((r) => r !== "mafia")) expect(roleHintOf(view(role, "extended")), role).toBeNull();
  });

  it("기본판 마피아에는 없다", () => {
    expect(roleHintOf(view("mafia", "basic"))).toBeNull();
  });

  it("카드 앞면: 마피아(원인 흐름)에는 줄이 있고 다른 역할 카드의 DOM 에는 그 문자열이 없다", () => {
    const html = (role: (typeof ROLE_IDS)[number], mode: "basic" | "extended"): string => {
      const { container, unmount } = render(<RoleCard role={role} face="front" allies={role === "mafia" ? [] : null} hint={roleHintOf(view(role, mode))} onFlip={() => {}} />);
      const out = container.innerHTML;
      unmount();
      return out;
    };
    expect(html("mafia", "extended")).toContain(HOLD_LINE);
    expect(html("mafia", "basic")).not.toContain(HOLD_LINE);
    for (const role of ROLE_IDS.filter((r) => r !== "mafia")) expect(html(role, "extended"), role).not.toContain(HOLD_LINE);
  });
});
