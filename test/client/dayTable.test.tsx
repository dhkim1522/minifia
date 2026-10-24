import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { DayTable } from "../../src/components/DayTable";
import type { DayTableSeat } from "../../src/components/DayTable";
import { daySeatLayout, px } from "../../src/game/dayTable";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const seat = (n: number, nickname: string, extra: Partial<DayTableSeat> = {}): DayTableSeat => ({
  seat: n,
  nickname,
  connected: true,
  isHost: false,
  isMe: false,
  isAlly: false,
  row: null,
  ...extra,
});

const five = (over: Partial<Record<number, Partial<DayTableSeat>>> = {}): DayTableSeat[] => [
  seat(0, "동현", { isMe: true, ...over[0] }),
  seat(1, "가나다라마", over[1]),
  seat(2, "지호", over[2]),
  seat(3, "하늘", over[3]),
  seat(4, "서연", over[4]),
];

const root = (c: HTMLElement): HTMLElement => c.querySelector<HTMLElement>(".mf-dt")!;
const seatEls = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>(".mf-dt__seat[data-seat]"));
const tagEl = (c: HTMLElement, n: number) => c.querySelector<HTMLElement>(`.mf-dt__tag[data-seat="${n}"]`)!;
const felt = (c: HTMLElement) => c.querySelector<HTMLElement>(".mf-dt__felt")!;

describe("DayTable: 좌표는 daySeatLayout 하나에서 나온다", () => {
  it("width 366 으로 5명을 그리면 자리마다 .mf-dt__seat 하나, 인라인 좌표·크기·scale·z-index 가 배치 결과와 같다", () => {
    const { container } = render(<DayTable seats={five()} mySeat={0} width={366} />);
    const els = seatEls(container);
    expect(els.length).toBe(5);
    const layout = daySeatLayout(five(), 0, 366);
    for (const L of layout) {
      const el = els.find((e) => e.dataset.seat === String(L.seat))!;
      expect(el.style.left).toBe(px(L.figLeft));
      expect(el.style.top).toBe(px(L.figTop));
      expect(el.style.width).toBe("72px");
      expect(el.style.height).toBe("96px");
      expect(el.style.transform).toBe(`scale(${Math.round(L.scale * 1000) / 1000})`);
      expect(el.style.zIndex).toBe(String(L.z));
    }
  });

  it("이름표 .mf-dt__tag 는 left x·top y+3·z-index z+20 이고 title 은 닉네임이다", () => {
    const { container } = render(<DayTable seats={five()} mySeat={0} width={366} />);
    for (const L of daySeatLayout(five(), 0, 366)) {
      const tag = tagEl(container, L.seat);
      expect(tag.style.left).toBe(px(L.x));
      expect(tag.style.top).toBe(px(L.y + 3));
      expect(tag.style.zIndex).toBe(String(L.z + 20));
    }
    expect(tagEl(container, 1).getAttribute("title")).toBe("가나다라마");
  });

  it("윗줄 .mf-dt__name 에는 자리 색깔점과 닉네임 글자만 있다 — 내 이름표에도 '(나)' 가 없다", () => {
    const { container } = render(<DayTable seats={five()} mySeat={0} width={366} />);
    const name = tagEl(container, 0).querySelector<HTMLElement>(".mf-dt__name")!;
    expect(name.textContent).toBe("동현");
    const dot = name.querySelector<HTMLElement>("i.mf-dt__dot")!;
    expect(dot.getAttribute("style") ?? "").toContain("var(--seat-1)");
    const dot3 = tagEl(container, 2).querySelector<HTMLElement>("i.mf-dt__dot")!;
    expect(dot3.getAttribute("style") ?? "").toContain("var(--seat-3)");
  });

  it("테이블 면은 width 352 에서 left 44px·width 264px, 366 에서 left 43px·width 280px, top 150px·height 108px (height 생략 = 407)", () => {
    const a = render(<DayTable seats={five()} mySeat={0} width={352} />);
    expect(felt(a.container).style.left).toBe("44px");
    expect(felt(a.container).style.width).toBe("264px");
    cleanup();
    const b = render(<DayTable seats={five()} mySeat={0} width={366} />);
    expect(felt(b.container).style.left).toBe("43px");
    expect(felt(b.container).style.width).toBe("280px");
    expect(felt(b.container).style.top).toBe("150px");
    expect(felt(b.container).style.height).toBe("108px");
  });

  it("height 340 을 주면 테이블 면 top 131px 이고 내 자리(맨 아래) 이름표 top 이 px(191 + 100 + 3) 이다", () => {
    const { container } = render(<DayTable seats={five()} mySeat={0} width={366} height={340} />);
    expect(felt(container).style.top).toBe("131px");
    expect(tagEl(container, 0).style.top).toBe(px(191 + 100 + 3));
  });
});

describe("DayTable: 장면 크기 재기", () => {
  it("ResizeObserver 가 있으면 루트를 재서 쓴다 (폭 352·높이 300 → 면 left 44px·top 117px), 언마운트하면 disconnect", () => {
    const disconnect = vi.fn();
    class FakeRO {
      constructor(private cb: (entries: { contentRect: { width: number; height: number } }[]) => void) {}
      observe(): void {
        this.cb([{ contentRect: { width: 352, height: 300 } }]);
      }
      unobserve(): void {}
      disconnect(): void {
        disconnect();
      }
    }
    vi.stubGlobal("ResizeObserver", FakeRO);
    const { container, unmount } = render(<DayTable seats={five()} mySeat={0} />);
    expect(felt(container).style.left).toBe("44px");
    expect(felt(container).style.top).toBe("117px");
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it("재지 못하면 시안 기준 366×407 을 쓴다", () => {
    const { container } = render(<DayTable seats={five()} mySeat={0} />);
    expect(felt(container).style.left).toBe("43px");
    expect(felt(container).style.top).toBe("150px");
  });
});

describe("DayTable: 안전", () => {
  it("닉네임 '<img src=x>' 는 글자로만 그려진다 (이름표 안에 img 요소 없음)", () => {
    const seats = five({ 1: { nickname: "<img src=x>" } });
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} />);
    expect(tagEl(container, 1).querySelector("img") === null).toBe(true);
    expect(tagEl(container, 1).textContent).toBe("<img src=x>");
  });

  it("DayTableSeat 에 역할 키를 넣을 수 없다", () => {
    // @ts-expect-error DayTableSeat 에는 role 이 없다 — 역할은 이 부품의 입력이 될 수 없다
    const withRole: DayTableSeat = { ...seat(1, "민수"), role: "mafia" };
    expect("role" in seat(1, "민수")).toBe(false);
    expect(withRole.nickname).toBe("민수");
  });

  it("자리 접근성 이름은 '{닉네임} (나)'·'{닉네임}, 연결 끊김' 형식이다", () => {
    render(<DayTable seats={five({ 2: { connected: false } })} mySeat={0} width={366} />);
    expect(screen.getByRole("group", { name: "동현 (나)" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "지호, 연결 끊김" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "하늘" })).toBeTruthy();
  });

  it("루트는 기본 이름 '테이블' 의 group 이다", () => {
    const { container } = render(<DayTable seats={five()} mySeat={0} width={366} />);
    expect(root(container).getAttribute("aria-label")).toBe("테이블");
    expect(root(container).getAttribute("role")).toBe("group");
  });
});
