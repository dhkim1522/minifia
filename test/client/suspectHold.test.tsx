import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameDock } from "../../src/components/GameDock";
import { ChatStore } from "../../src/net/chatStore";

type DockProps = ComponentProps<typeof GameDock>;

function setup(count = 5) {
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const people = {
    players: Array.from({ length: count }, (_, index) => ({
      seat: index + 1,
      nickname: `참가자 ${index + 1}`,
      connected: true,
      isHost: false,
    })),
    onChoose: vi.fn(),
    suspectHold: { seats: new Set([1, 2]), onRelease: vi.fn() },
  };
  const props: DockProps = {
    scope: "1:1:discussion",
    initialPane: "people",
    preserveWriting: false,
    keepLooking: false,
    keepToolsOpen: false,
    paused: false,
    chatStore: new ChatStore(),
    channel: null,
    mySeat: 0,
    chat: null,
    people,
    tools: null,
  };
  const { container, rerender } = render(<GameDock {...props} />);
  const card = (seat = 1) => container.querySelector<HTMLButtonElement>(`[data-table-seat="${seat}"]`)!;
  return { container, card, people, update: (next: Partial<DockProps>) => rerender(<GameDock {...props} {...next} />), advance: (ms: number) => { now += ms; } };
}

const point = (clientX = 50, clientY = 50) => ({ pointerId: 1, pointerType: "touch", isPrimary: true, button: 0, clientX, clientY });
const pointerClick = (card: HTMLButtonElement) => fireEvent.click(card, { detail: 1 });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("참가자 카드 의심딱지 홀드", () => {
  it("짧게 누르면 바라보고, 700ms 뒤 손을 뗄 때만 붙인다", () => {
    const { container, card, people, advance } = setup(4);
    fireEvent.pointerDown(card(), point());
    expect(container.querySelector("[data-suspect-hold]")).not.toBeNull();
    advance(699);
    fireEvent.pointerUp(card(), point());
    pointerClick(card());
    expect(people.onChoose).toHaveBeenCalledOnce();
    expect(people.suspectHold.onRelease).not.toHaveBeenCalled();

    fireEvent.pointerDown(card(), point());
    advance(700);
    expect(people.suspectHold.onRelease).not.toHaveBeenCalled();
    fireEvent.pointerUp(card(), point());
    pointerClick(card());
    expect(people.suspectHold.onRelease).toHaveBeenCalledExactlyOnceWith(1);
    expect(people.onChoose).toHaveBeenCalledOnce();
    expect(container.querySelector("[data-suspect-hold]")).toBeNull();
  });

  it("홀드가 끝난 뒤 밀어서 페이지를 넘겨도 딱지와 카드 선택을 보내지 않는다", () => {
    const { container, card, people, advance } = setup();
    fireEvent.pointerDown(card(), point());
    advance(800);
    fireEvent.pointerMove(card(), point(10));
    expect(container.querySelector("[data-suspect-hold]")).toBeNull();
    fireEvent.pointerUp(card(), point(10));
    expect(container.querySelector("[data-people-page]")?.textContent).toBe("2/2");
    pointerClick(card(5));
    expect(people.suspectHold.onRelease).not.toHaveBeenCalled();
    expect(people.onChoose).not.toHaveBeenCalled();
  });

  it("밤 선택 중 홀드나 Shift+Enter는 의심만 보내고, 밤 선택은 짧은 탭으로만 보낸다", () => {
    const { card, people, advance, update } = setup(4);
    const nightPick = vi.fn();
    update({
      peopleAction: {
        kind: "night", title: "밤 대상", roster: {
          ...people, onChoose: nightPick,
          pick: { seats: new Set([1]), group: "밤 대상", label: (name) => name, onPick: nightPick },
        },
      },
    });
    fireEvent.pointerDown(card(1), point());
    advance(700);
    fireEvent.pointerUp(card(1), point());
    pointerClick(card(1));
    expect(people.suspectHold.onRelease).toHaveBeenCalledExactlyOnceWith(1);
    expect(nightPick).not.toHaveBeenCalled();
    expect(card(2).disabled).toBe(false);
    expect(card(2).hasAttribute("data-pick")).toBe(false);
    expect(card(2).getAttribute("aria-keyshortcuts")).toBe("Shift+Enter");
    fireEvent.keyDown(card(2), { key: "Enter", shiftKey: true });
    fireEvent.click(card(2));
    expect(people.suspectHold.onRelease).toHaveBeenLastCalledWith(2);
    expect(nightPick).not.toHaveBeenCalled();
    fireEvent.pointerDown(card(1), point());
    fireEvent.pointerUp(card(1), point());
    pointerClick(card(1));
    expect(nightPick).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("포인터 취소, 움직였다가 원점으로 돌아옴, 단계 변경에서는 딱지가 붙지 않는다", () => {
    const { card, people, advance, update } = setup();
    fireEvent.pointerDown(card(), point());
    advance(800);
    fireEvent.pointerCancel(card(), point());
    fireEvent.pointerUp(card(), point());
    pointerClick(card());

    fireEvent.pointerDown(card(), point());
    fireEvent.pointerMove(card(), point(65));
    fireEvent.pointerMove(card(), point());
    advance(800);
    fireEvent.pointerUp(card(), point());
    pointerClick(card());

    fireEvent.pointerDown(card(), point());
    update({ scope: "1:2:discussion" });
    advance(800);
    fireEvent.pointerUp(card(), point());
    pointerClick(card());
    expect(people.suspectHold.onRelease).not.toHaveBeenCalled();
    expect(people.onChoose).not.toHaveBeenCalled();
  });

  it("누르는 도중 패널을 닫아도 다시 열었을 때 홀드가 남지 않는다", () => {
    const { container, card, people, advance } = setup();
    fireEvent.pointerDown(card(), point());
    fireEvent.keyDown(card(), { key: "Escape" });
    fireEvent.click(container.querySelector('[data-dock-tab="people"]')!);
    expect(container.querySelector("[data-suspect-hold]")).toBeNull();
    advance(800);
    fireEvent.pointerUp(card(), point());
    expect(people.suspectHold.onRelease).not.toHaveBeenCalled();
  });

  it("내가 붙인 배지를 바라보기 선택과 별도로 표시하고 페이지 안내는 추가하지 않는다", () => {
    const { container, card, people, update } = setup();
    update({ people: { ...people, focus: 2, myNoteTarget: 1, notes: new Map([[1, [0]], [2, [3]]]) } });
    expect(card(1).querySelector("[data-suspect-mine] svg path")?.getAttribute("fill")).toBe("currentColor");
    expect(card(1).getAttribute("aria-label")).toContain("내 딱지 있음");
    expect(card(2).getAttribute("aria-pressed")).toBe("true");
    expect(card(2).querySelector("[data-suspect-mine]")).toBeNull();
    fireEvent.click(container.querySelector("[data-people-next]")!);
    expect(container.querySelector("[data-suspect-mine]")).toBeNull();
    expect(container.querySelector("[data-people-page]")?.textContent).toBe("2/2");
  });
});
