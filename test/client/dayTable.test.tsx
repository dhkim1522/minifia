import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { DayTable } from "../../src/components/DayTable";
import { Icon } from "../../src/components/Icon";
import type { IconName } from "../../src/components/Icon";
import type { DayTableSeat } from "../../src/components/DayTable";
import { daySeatLayout, px } from "../../src/game/dayTable";
import { claimName } from "../../src/game/roleText";

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

  it("이름표 .mf-dt__tag 는 left x·top y(간격 0)·z-index tagZ 이고 title 은 닉네임이다", () => {
    const { container } = render(<DayTable seats={five()} mySeat={0} width={366} />);
    for (const L of daySeatLayout(five(), 0, 366)) {
      const tag = tagEl(container, L.seat);
      expect(tag.style.left).toBe(px(L.x));
      expect(tag.style.top).toBe(px(L.y));
      expect(tag.style.zIndex).toBe(String(L.tagZ));
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

  it("테이블 면은 width 366(390폰)에서 left 75px·width 216px·top 150px·height 108px (height 생략 = 407), width 352 + scenePad 4(360폰)에서 left 83px·width 186px", () => {
    const a = render(<DayTable seats={five()} mySeat={0} width={352} scenePad={4} />);
    expect(felt(a.container).style.left).toBe("83px");
    expect(felt(a.container).style.width).toBe("186px");
    cleanup();
    const b = render(<DayTable seats={five()} mySeat={0} width={366} />);
    expect(felt(b.container).style.left).toBe("75px");
    expect(felt(b.container).style.width).toBe("216px");
    expect(felt(b.container).style.top).toBe("150px");
    expect(felt(b.container).style.height).toBe("108px");
  });

  it("scenePad 가 자리 좌표에도 쓰인다: 폭 352 에서 여백 4 는 rx 131, 여백 12 는 rx 139 (4명판 맨 오른쪽 자리 발 x)", () => {
    const four = [seat(0, "나", { isMe: true }), seat(1, "가"), seat(2, "나나"), seat(3, "다")];
    const a = render(<DayTable seats={four} mySeat={0} width={352} height={364} scenePad={4} />);
    expect(tagEl(a.container, 3).style.left).toBe(px(176 + 131));
    cleanup();
    const b = render(<DayTable seats={four} mySeat={0} width={352} height={364} scenePad={12} />);
    expect(tagEl(b.container, 3).style.left).toBe(px(176 + 139));
  });

  it("scenePad 가 없으면 루트의 CSS 변수 --mf-scene-pad 를 읽고, 비었거나 숫자가 아니면 12", () => {
    const real = window.getComputedStyle.bind(window);
    const spy = vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element, pseudo?: string | null) => {
      const cs = real(el, pseudo);
      if (!(el as HTMLElement).classList?.contains("mf-dt")) return cs;
      return new Proxy(cs, {
        get(target, key) {
          if (key === "getPropertyValue") return (name: string) => (name === "--mf-scene-pad" ? " 4px" : target.getPropertyValue(name));
          const v = Reflect.get(target, key) as unknown;
          return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
        },
      });
    });
    const a = render(<DayTable seats={five()} mySeat={0} width={352} />);
    expect(felt(a.container).style.width).toBe("186px");
    cleanup();
    spy.mockRestore();
    // 테스트 환경은 CSS 를 싣지 않아 변수가 비어 있다 → 기본 12 (352 → rx 139, 면 폭 202)
    const b = render(<DayTable seats={five()} mySeat={0} width={352} />);
    expect(felt(b.container).style.width).toBe("202px");
  });

  it("height 320 을 주면 테이블 면 top 138px 이고 내 자리(맨 아래) 이름표 top 이 px(198 + 100) 이다", () => {
    const { container } = render(<DayTable seats={five()} mySeat={0} width={366} height={320} />);
    expect(felt(container).style.top).toBe("138px");
    expect(tagEl(container, 0).style.top).toBe(px(198 + 100));
  });
});

describe("DayTable: 장면 크기 재기", () => {
  it("ResizeObserver 가 있으면 루트를 재서 쓴다 (폭 352·높이 300, 여백 기본 12 → 면 left 75px·top 118px), 언마운트하면 disconnect", () => {
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
    expect(felt(container).style.left).toBe("75px");
    expect(felt(container).style.top).toBe("118px");
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it("마운트 직후 한 번 동기로 재서 첫 페인트부터 실제 크기로 그린다 (관측 콜백이 오기 전에도 같은 렌더 묶음 안에서 반영)", () => {
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const r = this.classList.contains("mf-dt") ? { width: 352, height: 300 } : { width: 0, height: 0 };
      return { ...r, left: 0, top: 0, right: r.width, bottom: r.height, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });
    const { container } = render(<DayTable seats={five()} mySeat={0} scenePad={4} />);
    rect.mockRestore();
    expect(felt(container).style.left).toBe("83px");
    expect(felt(container).style.top).toBe("118px");
  });

  it("재지 못하면 시안 기준 366×407 을 쓴다", () => {
    const { container } = render(<DayTable seats={five()} mySeat={0} />);
    expect(felt(container).style.left).toBe("75px");
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

// CSS 는 정규식으로 한 줄 결과(true/false)만 단언한다 — toMatch 는 실패 때 CSS 전체를 보고서에 쏟아 TAP 을 깨뜨린다.
const cssHas = (css: string, re: RegExp): boolean => re.test(css);

describe("claimName (src/game/roleText.ts 가 단일 출처)", () => {
  it("none 은 '말 안 함', police 는 '경찰'", () => {
    expect(claimName("none")).toBe("말 안 함");
    expect(claimName("police")).toBe("경찰");
  });
});

// ---- 02-14 Task 3: 배지·링·동료·보낸 사람 반전·머리 위 이모티콘 ----
const seatEl = (c: HTMLElement, n: number) => c.querySelector<HTMLElement>(`.mf-dt__seat[data-seat="${n}"]`)!;
const changedClaim = { kind: "claim", job: "mafia", changed: true, pop: false } as const;

describe("DayTable: 왕관·링·동료·끊김·보낸 사람", () => {
  it("방장 자리의 캐릭터 상자 안에만 .mf-dt__crown[role=img][aria-label=방장] 이 하나 있다, 방장이 없으면 없다", () => {
    const { container } = render(<DayTable seats={five({ 2: { isHost: true } })} mySeat={0} width={366} />);
    const crowns = container.querySelectorAll<HTMLElement>(".mf-dt__crown");
    expect(crowns.length).toBe(1);
    expect(crowns[0]?.getAttribute("role")).toBe("img");
    expect(crowns[0]?.getAttribute("aria-label")).toBe("방장");
    expect(seatEl(container, 2).contains(crowns[0] ?? null)).toBe(true);
    cleanup();
    const none = render(<DayTable seats={five()} mySeat={0} width={366} />);
    expect(none.container.querySelectorAll(".mf-dt__crown").length).toBe(0);
  });

  it("내 자리 상자에만 .mf-dt__ring--me, 내 이름표에만 .mf-dt__tag--me", () => {
    const { container } = render(<DayTable seats={five()} mySeat={0} width={366} />);
    expect(container.querySelectorAll(".mf-dt__ring--me").length).toBe(1);
    expect(seatEl(container, 0).querySelectorAll(".mf-dt__ring--me").length).toBe(1);
    expect(container.querySelectorAll(".mf-dt__tag--me").length).toBe(1);
    expect(tagEl(container, 0).classList.contains("mf-dt__tag--me")).toBe(true);
  });

  it("isAlly 자리에만 .mf-dt__ring--mate 와 aria-label 동료 표시, 아무도 동료가 아니면 없다", () => {
    const { container } = render(<DayTable seats={five({ 3: { isAlly: true } })} mySeat={0} width={366} />);
    expect(container.querySelectorAll(".mf-dt__ring--mate").length).toBe(1);
    expect(seatEl(container, 3).querySelectorAll(".mf-dt__ring--mate").length).toBe(1);
    const mark = container.querySelectorAll(".mf-dt__mark");
    expect(mark.length).toBe(1);
    expect(mark[0]?.getAttribute("aria-label")).toBe("동료");
    cleanup();
    const none = render(<DayTable seats={five()} mySeat={0} width={366} />);
    expect(none.container.querySelectorAll(".mf-dt__ring--mate").length).toBe(0);
    expect(none.container.querySelectorAll(".mf-dt__mark").length).toBe(0);
  });

  it("동료이면서 나인 자리는 동료 링이 우선이다 (나 링 없음)", () => {
    const { container } = render(<DayTable seats={five({ 0: { isAlly: true } })} mySeat={0} width={366} />);
    expect(seatEl(container, 0).querySelectorAll(".mf-dt__ring--mate").length).toBe(1);
    expect(seatEl(container, 0).querySelectorAll(".mf-dt__ring--me").length).toBe(0);
  });

  it("끊긴 자리의 그림은 mf-figure--disconnected 이다", () => {
    const seats = five({ 2: { connected: false } });
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} />);
    expect(seatEl(container, 2).querySelector("img")?.classList.contains("mf-figure--disconnected")).toBe(true);
    expect(seatEl(container, 1).querySelector("img")?.classList.contains("mf-figure--disconnected")).toBe(false);
  });

  it("spoke true 인 자리의 이름표에만 .mf-dt__tag--spoke", () => {
    const { container } = render(<DayTable seats={five({ 4: { spoke: true } })} mySeat={0} width={366} />);
    expect(container.querySelectorAll(".mf-dt__tag--spoke").length).toBe(1);
    expect(tagEl(container, 4).classList.contains("mf-dt__tag--spoke")).toBe(true);
  });
});

describe("DayTable: 머리 위 이모티콘 (결정 0017-2)", () => {
  it("emoji 가 있는 자리에 .mf-dt__emoji[data-seat] 하나(aria-hidden, svg 하나), 좌표는 배치 결과의 emojiLeft·emojiTop, z-index 60 + z", () => {
    const seats = five({ 1: { emoji: { key: "a", icon: "smile", z: 3 } } });
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} />);
    const list = container.querySelectorAll<HTMLElement>(".mf-dt__emoji");
    expect(list.length).toBe(1);
    const el = list[0]!;
    const L = daySeatLayout(seats, 0, 366).find((p) => p.seat === 1)!;
    expect(el.dataset.seat).toBe("1");
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.querySelectorAll("svg").length).toBe(1);
    expect(el.style.left).toBe(px(L.x - 16));
    expect(el.style.top).toBe(px(Math.max(0, L.y - 96 * L.scale - 36)));
    expect(el.style.zIndex).toBe("63");
  });

  it("key 가 바뀌면 다른 DOM 노드다, emoji 없는 자리에는 없다", () => {
    const first = five({ 1: { emoji: { key: "a", icon: "smile", z: 1 } } });
    const { container, rerender } = render(<DayTable seats={first} mySeat={0} width={366} />);
    const before = container.querySelector(".mf-dt__emoji");
    rerender(<DayTable seats={five({ 1: { emoji: { key: "b", icon: "smile", z: 1 } } })} mySeat={0} width={366} />);
    const after = container.querySelector(".mf-dt__emoji");
    expect(after === before).toBe(false);
    rerender(<DayTable seats={five()} mySeat={0} width={366} />);
    expect(container.querySelectorAll(".mf-dt__emoji").length).toBe(0);
  });
});

describe("Icon 3개 추가", () => {
  it.each(["changed", "crown", "chevronUp", "speech"])("%s 는 24×24 viewBox svg 로 그려진다", (name) => {
    const { container } = render(<Icon name={name as IconName} />);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 24 24");
  });
});

describe("daytable.css: 배지·이모티콘 크기", () => {
  const css = readFileSync("src/styles/daytable.css", "utf8");
  it(".mf-dt__emoji 는 32px 원·z-index 60·::after 꼬리 5px", () => {
    expect(cssHas(css, /\.mf-dt__emoji\s*\{[^}]*width:\s*32px/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__emoji\s*\{[^}]*height:\s*32px/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__emoji\s*\{[^}]*z-index:\s*60/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__emoji::after\s*\{[^}]*border:\s*5px solid transparent/)).toBe(true);
  });
  it(".mf-dt__crown 은 22px", () => {
    expect(cssHas(css, /\.mf-dt__crown\s*\{[^}]*width:\s*22px/)).toBe(true);
  });
});

// ---- 03-02 Task 1: 밤 대상 선택 (D-01·D-02, UI-SPEC N-1) ----
describe("DayTable: 밤 대상 선택 (D-01·D-02, UI-SPEC N-1)", () => {
  const pickSeats = (onPicks: Record<number, () => void>, over: Partial<Record<number, Partial<DayTableSeat>>> = {}) =>
    five({
      1: { onPick: onPicks[1], ...over[1] },
      2: { onPick: onPicks[2], ...over[2] },
      3: { onPick: onPicks[3], ...over[3] },
      4: { ...over[4] },
      0: { ...over[0] },
    });

  it("onPick 을 준 자리만 .mf-dt__seat 가 button[type=button] 이고 aria-pressed='false'. 나머지 자리는 role=group div 다", () => {
    const seats = pickSeats({ 1: vi.fn(), 2: vi.fn(), 3: vi.fn() });
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} />);
    const buttons = container.querySelectorAll<HTMLElement>("button.mf-dt__seat");
    expect(buttons.length).toBe(3);
    for (const b of Array.from(buttons)) {
      expect(b.getAttribute("type")).toBe("button");
      expect(b.getAttribute("aria-pressed")).toBe("false");
    }
    expect(seatEl(container, 0).tagName).toBe("DIV");
    expect(seatEl(container, 0).getAttribute("role")).toBe("group");
    expect(seatEl(container, 4).tagName).toBe("DIV");
  });

  it("pickVerb '조사' 이면 접근성 이름이 '지호, 조사 대상', 내 자리는 '동현 (나), 조사 대상'. pickVerb 가 없으면 '지호, 선택 대상'", () => {
    const seats = pickSeats({ 2: vi.fn() }, { 0: { onPick: vi.fn() } });
    render(<DayTable seats={seats} mySeat={0} width={366} pickVerb="조사" />);
    expect(screen.getByRole("button", { name: "지호, 조사 대상" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "동현 (나), 조사 대상" })).toBeTruthy();
    cleanup();
    render(<DayTable seats={pickSeats({ 2: vi.fn() })} mySeat={0} width={366} />);
    expect(screen.getByRole("button", { name: "지호, 선택 대상" })).toBeTruthy();
  });

  it("버튼을 누르면 그 자리의 onPick 이 한 번 불린다", () => {
    const a = vi.fn();
    const b = vi.fn();
    render(<DayTable seats={pickSeats({ 1: a, 2: b })} mySeat={0} width={366} />);
    fireEvent.click(screen.getByRole("button", { name: "지호, 선택 대상" }));
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
  });

  it("pick.mine 인 자리: aria-pressed='true', 상자 안에 .mf-dt__sel 하나와 .mf-dt__pick--me 하나(svg 하나, aria-hidden). 다른 자리에는 없다", () => {
    const seats = pickSeats({ 1: vi.fn(), 2: vi.fn() }, { 2: { pick: { mine: true } } });
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} />);
    const el = seatEl(container, 2);
    expect(el.getAttribute("aria-pressed")).toBe("true");
    expect(el.querySelectorAll(".mf-dt__sel").length).toBe(1);
    const badge = el.querySelectorAll<HTMLElement>(".mf-dt__pick.mf-dt__pick--me");
    expect(badge.length).toBe(1);
    expect(badge[0]?.getAttribute("aria-hidden")).toBe("true");
    expect(badge[0]?.querySelectorAll("svg").length).toBe(1);
    expect(container.querySelectorAll(".mf-dt__sel").length).toBe(1);
    expect(container.querySelectorAll(".mf-dt__pick").length).toBe(1);
    expect(seatEl(container, 1).getAttribute("aria-pressed")).toBe("false");
  });

  it("pickDisabled 면 모든 대상 버튼에 disabled 가 있고 눌러도 onPick 이 불리지 않는다", () => {
    const a = vi.fn();
    const { container } = render(<DayTable seats={pickSeats({ 1: a, 2: vi.fn() })} mySeat={0} width={366} pickDisabled />);
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("button.mf-dt__seat"));
    expect(buttons.length).toBe(2);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    fireEvent.click(buttons[0]!);
    expect(a).not.toHaveBeenCalled();
  });

  it("새 필드를 하나도 주지 않은 다섯 자리 테이블의 innerHTML 에 button·mf-dt__sel·mf-dt__pick 이 없다", () => {
    const { container } = render(<DayTable seats={five()} mySeat={0} width={366} />);
    const html = container.innerHTML;
    expect(html.includes("<button")).toBe(false);
    expect(html.includes("mf-dt__sel")).toBe(false);
    expect(html.includes("mf-dt__pick")).toBe(false);
    expect(html.includes("aria-pressed")).toBe(false);
  });
});

describe("Icon target·notebook (03-02)", () => {
  it.each(["target", "notebook"])("%s 는 24×24 viewBox svg 로 그려진다", (name) => {
    const { container } = render(<Icon name={name as IconName} />);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 24 24");
  });
  it("target 의 첫 요소는 circle(r 7), notebook 은 path 두 개다", () => {
    const t = render(<Icon name={"target" as IconName} />).container.querySelector("svg")!;
    expect(t.firstElementChild?.tagName.toLowerCase()).toBe("circle");
    expect(t.firstElementChild?.getAttribute("r")).toBe("7");
    cleanup();
    const n = render(<Icon name={"notebook" as IconName} />).container.querySelector("svg")!;
    expect(n.querySelectorAll("path").length).toBe(2);
  });
});

describe("daytable.css: 밤 선택 표시 (03-02)", () => {
  const css = readFileSync("src/styles/daytable.css", "utf8");
  it(".mf-dt__sel 은 124%×20%·3px gray-50 링·빛·pointer-events none", () => {
    expect(cssHas(css, /\.mf-dt__sel\s*\{[^}]*width:\s*124%/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__sel\s*\{[^}]*height:\s*20%/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__sel\s*\{[^}]*border:\s*3px solid var\(--gray-50\)/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__sel\s*\{[^}]*pointer-events:\s*none/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__sel\s*\{[^}]*box-shadow:[^;]*color-mix\(in srgb, var\(--gray-50\) 55%, transparent\)/)).toBe(true);
  });
  it(".mf-dt__pick 은 26px·top -26px·margin-left -13px, --me 는 gray-50 면·night-900 글자", () => {
    expect(cssHas(css, /\.mf-dt__pick\s*\{[^}]*width:\s*26px/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__pick\s*\{[^}]*top:\s*-26px/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__pick\s*\{[^}]*margin-left:\s*-13px/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__pick--me\s*\{[^}]*background:\s*var\(--gray-50\)/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__pick--me\s*\{[^}]*color:\s*var\(--night-900\)/)).toBe(true);
  });
  it(".mf-dt__seat--pick:focus-visible 에 outline 2px solid var(--gray-100)", () => {
    expect(cssHas(css, /\.mf-dt__seat--pick:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--gray-100\)/)).toBe(true);
  });
  it("daytable.css 의 코드 줄에는 # 으로 시작하는 색 값이 없다", () => {
    const code = css
      .split("\n")
      .filter((l) => !/^\s*\/?\*/.test(l))
      .join("\n");
    expect(/#[0-9a-fA-F]{3,6}\b/.test(code)).toBe(false);
  });
});

// ---- 03-02 Task 2: 탈락(유령 그림)과 관전 아랫줄 (D-15·결정 0021) ----
const imgEl = (c: HTMLElement, n: number) => seatEl(c, n).querySelector<HTMLImageElement>("img")!;

describe("DayTable: 탈락과 관전 아랫줄 (D-15·결정 0021)", () => {
  it("dead 자리: 그림은 유령(@2x src, srcset 4x), mf-figure--ghost, 연결돼 있으면 mf-figure--disconnected 없음. 이름표에 .mf-dt__tag--dead", () => {
    const { container } = render(<DayTable seats={five({ 4: { dead: true } })} mySeat={0} width={366} />);
    const img = imgEl(container, 4);
    expect(img.getAttribute("src")).toBe("/characters/ghost/ghost_default%402x.png");
    expect(img.getAttribute("srcset")?.includes("ghost_default%404x.png 4x")).toBe(true);
    expect(img.classList.contains("mf-figure--ghost")).toBe(true);
    expect(img.classList.contains("mf-figure--disconnected")).toBe(false);
    expect(tagEl(container, 4).classList.contains("mf-dt__tag--dead")).toBe(true);
    expect(container.querySelectorAll(".mf-figure--ghost").length).toBe(1);
    expect(container.querySelectorAll(".mf-dt__tag--dead").length).toBe(1);
  });

  it("끊긴 dead 자리는 유령 그림 + mf-figure--disconnected 가 함께 있다", () => {
    const { container } = render(<DayTable seats={five({ 4: { dead: true, connected: false } })} mySeat={0} width={366} />);
    const img = imgEl(container, 4);
    expect(img.classList.contains("mf-figure--ghost")).toBe(true);
    expect(img.classList.contains("mf-figure--disconnected")).toBe(true);
  });

  it("dead 가 아닌 끊긴 자리는 지금처럼 인물 그림 + mf-figure--disconnected 다", () => {
    const { container } = render(<DayTable seats={five({ 2: { connected: false } })} mySeat={0} width={366} />);
    const img = imgEl(container, 2);
    expect(img.classList.contains("mf-figure--ghost")).toBe(false);
    expect(img.classList.contains("mf-figure--disconnected")).toBe(true);
    expect((img.getAttribute("src") ?? "").includes("/characters/table/")).toBe(true);
  });

  it("탈락 이름표는 한 줄(.mf-dt__name 하나)이고 '탈락' 글자·.mf-dt__claim 이 없다", () => {
    const { container } = render(<DayTable seats={five({ 4: { dead: true } })} mySeat={0} width={366} />);
    const tag = tagEl(container, 4);
    expect(tag.children.length).toBe(1);
    expect(tag.textContent).toBe("서연");
    expect(tag.textContent?.includes("탈락")).toBe(false);
  });

  it("dead 자리 접근성 이름: '서연, 탈락', 내 자리는 '동현 (나), 탈락', 끊긴 dead 는 '서연, 탈락, 연결 끊김'", () => {
    render(<DayTable seats={five({ 0: { dead: true }, 4: { dead: true } })} mySeat={0} width={366} />);
    expect(screen.getByRole("group", { name: "서연, 탈락" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "동현 (나), 탈락" })).toBeTruthy();
    cleanup();
    render(<DayTable seats={five({ 4: { dead: true, connected: false } })} mySeat={0} width={366} />);
    expect(screen.getByRole("group", { name: "서연, 탈락, 연결 끊김" })).toBeTruthy();
  });

  it("allyMarkLabel '마피아' 를 넘기면 isAlly 자리의 마름모 aria-label 이 '마피아', 넘기지 않으면 '동료'", () => {
    const { container } = render(<DayTable seats={five({ 3: { isAlly: true } })} mySeat={0} width={366} allyMarkLabel="마피아" />);
    expect(container.querySelector(".mf-dt__mark")?.getAttribute("aria-label")).toBe("마피아");
    cleanup();
    const d = render(<DayTable seats={five({ 3: { isAlly: true } })} mySeat={0} width={366} />);
    expect(d.container.querySelector(".mf-dt__mark")?.getAttribute("aria-label")).toBe("동료");
  });

  it("isAlly 이면서 dead 인 자리는 동료 링·마름모가 그대로 있다", () => {
    const { container } = render(<DayTable seats={five({ 3: { isAlly: true, dead: true } })} mySeat={0} width={366} />);
    expect(seatEl(container, 3).querySelectorAll(".mf-dt__ring--mate").length).toBe(1);
    expect(seatEl(container, 3).querySelectorAll(".mf-dt__mark").length).toBe(1);
  });
});

describe("daytable.css: 탈락과 관전 아랫줄 (03-02)", () => {
  const css = readFileSync("src/styles/daytable.css", "utf8");
  it(".mf-figure--ghost 는 object-fit contain, filter·opacity 지정 없음", () => {
    expect(cssHas(css, /\.mf-figure--ghost\s*\{[^}]*object-fit:\s*contain/)).toBe(true);
    expect(cssHas(css, /\.mf-figure--ghost\s*\{[^}]*(filter|opacity)\s*:/)).toBe(false);
  });
  it(".mf-dt__tag--dead .mf-dt__name 의 color var(--gray-500)", () => {
    expect(cssHas(css, /\.mf-dt__tag--dead \.mf-dt__name\s*\{[^}]*color:\s*var\(--gray-500\)/)).toBe(true);
  });
});

// ---- 03-02 Task 3: 종류별 표적 배지 (D-07, 결정 0021, UI-SPEC C4·N-6) ----
describe("DayTable: 종류별 표적 배지", () => {
  it("pick.ally 자리에만 .mf-dt__pick--ally 하나(aria-hidden, 장식 — 마피아 화면)", () => {
    const { container } = render(<DayTable seats={five({ 2: { pick: { ally: true } } })} mySeat={0} width={366} />);
    const list = container.querySelectorAll<HTMLElement>(".mf-dt__pick");
    expect(list.length).toBe(1);
    expect(list[0]?.classList.contains("mf-dt__pick--ally")).toBe(true);
    expect(list[0]?.getAttribute("aria-hidden")).toBe("true");
    expect(seatEl(container, 2).contains(list[0] ?? null)).toBe(true);
  });

  it("spectatorPicks 경찰·의사·마피아는 각각 --police('경찰 조사 대상')·--doctor('의사 보호 대상')·--ally('마피아 지목 대상') role=img 배지, svg 하나", () => {
    const seats = five({
      1: { spectatorPicks: ["police"] },
      2: { spectatorPicks: ["doctor"] },
      3: { spectatorPicks: ["mafia"] },
    });
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} />);
    const cases: [number, string, string][] = [
      [1, "mf-dt__pick--police", "경찰 조사 대상"],
      [2, "mf-dt__pick--doctor", "의사 보호 대상"],
      [3, "mf-dt__pick--ally", "마피아 지목 대상"],
    ];
    for (const [n, cls, name] of cases) {
      const b = seatEl(container, n).querySelectorAll<HTMLElement>(".mf-dt__pick");
      expect(b.length).toBe(1);
      expect(b[0]?.classList.contains(cls)).toBe(true);
      expect(b[0]?.getAttribute("role")).toBe("img");
      expect(b[0]?.getAttribute("aria-label")).toBe(name);
      expect(b[0]?.querySelectorAll("svg").length).toBe(1);
    }
  });

  it("ally·spectatorPicks 가 하나도 없으면 렌더 HTML 에 crimson 이 없다", () => {
    const { container } = render(
      <DayTable seats={five({ 1: { pick: { mine: true } }, 2: { spectatorPicks: ["police", "doctor"] } })} mySeat={0} width={366} />,
    );
    expect(container.innerHTML.includes("crimson")).toBe(false);
  });

  it("관전 마피아와 pick.ally 가 함께 오면 --ally 배지는 하나만 그린다", () => {
    const { container } = render(<DayTable seats={five({ 2: { pick: { ally: true }, spectatorPicks: ["mafia"] } })} mySeat={0} width={366} />);
    expect(container.querySelectorAll(".mf-dt__pick--ally").length).toBe(1);
  });

  it("한 자리에 pick.mine·spectatorPicks 셋이 모두 있으면 배지 넷이 DOM 순서 --police, --doctor, --ally, --me 다", () => {
    const seats = five({ 2: { pick: { mine: true }, spectatorPicks: ["mafia", "doctor", "police"] } });
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} />);
    const order = Array.from(seatEl(container, 2).querySelectorAll<HTMLElement>(".mf-dt__pick")).map((e) =>
      ["police", "doctor", "ally", "me"].find((k) => e.classList.contains(`mf-dt__pick--${k}`)),
    );
    // 배열 비교의 여러 줄 diff 는 TAP 보고서를 깨뜨리므로 한 줄 문자열로 비교한다.
    expect(order.join(">")).toBe("police>doctor>ally>me");
  });
});

describe("daytable.css: 종류별 배지 (03-02)", () => {
  const css = readFileSync("src/styles/daytable.css", "utf8");
  it("--ally: night-900 면·crimson-400 글자·2px 윤곽·margin-left 4px", () => {
    expect(cssHas(css, /\.mf-dt__pick--ally\s*\{[^}]*background:\s*var\(--night-900\)/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__pick--ally\s*\{[^}]*color:\s*var\(--crimson-400\)/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__pick--ally\s*\{[^}]*border:\s*2px solid var\(--crimson-400\)/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__pick--ally\s*\{[^}]*margin-left:\s*4px/)).toBe(true);
  });
  it("--police: night-900 면·gray-50 글자·2px gray-50 윤곽", () => {
    expect(cssHas(css, /\.mf-dt__pick--police\s*\{[^}]*background:\s*var\(--night-900\)/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__pick--police\s*\{[^}]*color:\s*var\(--gray-50\)/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__pick--police\s*\{[^}]*border:\s*2px solid var\(--gray-50\)/)).toBe(true);
  });
  it("--doctor: seat-3 글자·2px seat-3 윤곽·margin-left -4px", () => {
    expect(cssHas(css, /\.mf-dt__pick--doctor\s*\{[^}]*background:\s*var\(--night-900\)/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__pick--doctor\s*\{[^}]*color:\s*var\(--seat-3\)/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__pick--doctor\s*\{[^}]*border:\s*2px solid var\(--seat-3\)/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__pick--doctor\s*\{[^}]*margin-left:\s*-4px/)).toBe(true);
  });
  it("--me 의 z-index 가 다른 세 배지보다 크다", () => {
    const z = (k: string): number => Number(new RegExp(`\\.mf-dt__pick--${k}\\s*\\{[^}]*z-index:\\s*(\\d+)`).exec(css)?.[1] ?? "-1");
    expect(z("me")).toBeGreaterThan(Math.max(z("ally"), z("police"), z("doctor")));
    expect(Math.min(z("ally"), z("police"), z("doctor"))).toBeGreaterThan(0);
  });
});

// ---- 03.1-05 Task 2: 한 줄 이름표·차례·낮 탭·관전 그림·아침 층 (D-03·D-06·D-14·D-15·D-17) ----
const eight = (over: Partial<Record<number, Partial<DayTableSeat>>> = {}): DayTableSeat[] =>
  Array.from({ length: 8 }, (_, i) => seat(i, `이름${i}`, { isMe: i === 0, ...over[i] }));
const spotEls = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>(".mf-dt__spot"));
const turnEls = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>(".mf-dt__turn"));

describe("DayTable: 한 줄 이름표와 층 (D-04·D-14)", () => {
  it("모든 이름표는 자식으로 .mf-dt__name 하나만 갖고(점 + 닉네임), .mf-dt__claim·.mf-dt__chg 가 어디에도 없다", () => {
    const { container } = render(<DayTable seats={five({ 4: { dead: true } })} mySeat={0} width={366} />);
    const tags = Array.from(container.querySelectorAll<HTMLElement>(".mf-dt__tag"));
    expect(tags.length).toBe(5);
    for (const t of tags) {
      expect(t.children.length).toBe(1);
      expect(t.children[0]?.classList.contains("mf-dt__name")).toBe(true);
      expect(t.querySelectorAll("i.mf-dt__dot").length).toBe(1);
    }
    expect(container.querySelectorAll(".mf-dt__claim, .mf-dt__chg").length).toBe(0);
    expect(tagEl(container, 4).classList.contains("mf-dt__tag--dead")).toBe(true);
    expect(tagEl(container, 4).textContent?.includes("탈락")).toBe(false);
  });

  it.each([4, 5, 6, 7, 8])("%i명: 모든 이름표의 인라인 z-index 최댓값 < 모든 자리의 인라인 z-index 최솟값", (n) => {
    const seats = Array.from({ length: n }, (_, i) => seat(i, `이${i}`, { isMe: i === 0 }));
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} />);
    const tagZ = Array.from(container.querySelectorAll<HTMLElement>(".mf-dt__tag")).map((e) => Number(e.style.zIndex));
    const seatZ = seatEls(container).map((e) => Number(e.style.zIndex));
    expect(tagZ.length).toBe(n);
    expect(seatZ.length).toBe(n);
    expect(Math.max(...tagZ) < Math.min(...seatZ)).toBe(true);
  });
});

describe("DayTable: 지금 주장하는 차례 (D-03)", () => {
  it("turn 인 자리에 .mf-dt__spot 하나와 .mf-dt__turn(svg 아이콘) 하나, 그 이름표에 --turn", () => {
    const { container } = render(<DayTable seats={five({ 2: { turn: true } })} mySeat={0} width={366} />);
    expect(spotEls(container).length).toBe(1);
    expect(turnEls(container).length).toBe(1);
    expect(seatEl(container, 2).contains(spotEls(container)[0] ?? null)).toBe(true);
    expect(seatEl(container, 2).contains(turnEls(container)[0] ?? null)).toBe(true);
    expect(turnEls(container)[0]?.querySelectorAll("svg").length).toBe(1);
    expect(container.querySelectorAll(".mf-dt__tag--turn").length).toBe(1);
    expect(tagEl(container, 2).classList.contains("mf-dt__tag--turn")).toBe(true);
  });

  it("링 묶음 .mf-dt__spot 한 개 안에 뒤쪽 호(--back)·앞쪽 호(--front)가 이 순서로 있고, 캐릭터 그림이 묶음보다 앞 순서다 (결정 0028)", () => {
    const { container } = render(<DayTable seats={five({ 2: { turn: true } })} mySeat={0} width={366} />);
    const spot = spotEls(container)[0]!;
    expect(spot.className).toBe("mf-dt__spot");
    expect(Array.from(spot.children).map((c) => c.className)).toEqual([
      "mf-dt__spot-arc mf-dt__spot-arc--back",
      "mf-dt__spot-arc mf-dt__spot-arc--front",
    ]);
    const fig = seatEl(container, 2).querySelector<HTMLElement>("img.mf-figure")!;
    expect(fig).toBeTruthy();
    expect(fig.compareDocumentPosition(spot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 묶음에 aria-hidden 을 새로 달지 않는다(E2E G2 가 보는 요소 집합을 줄이지 않는다)
    expect(spot.getAttribute("aria-hidden")).toBeNull();
  });

  it("차례 자리의 인라인 z-index 는 배치 결과(12~22) 그대로, 탈락 강조는 31", () => {
    const { container } = render(<DayTable seats={five({ 2: { turn: true }, 3: { spotlit: true, dead: true } })} mySeat={0} width={366} />);
    const z2 = Number(seatEl(container, 2).style.zIndex);
    expect(z2 >= 12 && z2 <= 22).toBe(true);
    expect(seatEl(container, 3).style.zIndex).toBe("31");
    // 호는 인라인 z-index 를 갖지 않는다(층은 CSS 의 -1 과 마크업 순서가 정한다)
    for (const a of Array.from(container.querySelectorAll<HTMLElement>(".mf-dt__spot, .mf-dt__spot-arc"))) expect(a.style.zIndex).toBe("");
  });

  it.each([4, 5, 6, 7, 8])("%i명 차례 자리가 있어도 이름표 z 최댓값 < 자리 z 최솟값 (D3a 단위 버전)", (n) => {
    const seats = Array.from({ length: n }, (_, i) => seat(i, `이${i}`, { isMe: i === 0, turn: i === 1 }));
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} />);
    const tagZ = Array.from(container.querySelectorAll<HTMLElement>(".mf-dt__tag")).map((e) => Number(e.style.zIndex));
    const seatZ = seatEls(container).map((e) => Number(e.style.zIndex));
    expect(spotEls(container).length).toBe(1);
    expect(Math.max(...tagZ) < Math.min(...seatZ)).toBe(true);
  });

  it("차례 자리가 없으면 링·배지·반전이 0개", () => {
    const { container } = render(<DayTable seats={five()} mySeat={0} width={366} />);
    expect(spotEls(container).length).toBe(0);
    expect(turnEls(container).length).toBe(0);
    expect(container.querySelectorAll(".mf-dt__tag--turn").length).toBe(0);
  });

  it("두 자리에 turn 을 주어도 입력 그대로 둘 다 그린다 (한 번에 한 자리는 장면이 보장한다)", () => {
    const { container } = render(<DayTable seats={five({ 1: { turn: true }, 3: { turn: true } })} mySeat={0} width={366} />);
    expect(spotEls(container).length).toBe(2);
    expect(turnEls(container).length).toBe(2);
  });

  it("내 자리가 차례면 .mf-dt__ring--me 와 .mf-dt__spot 이 둘 다 있다", () => {
    const { container } = render(<DayTable seats={five({ 0: { turn: true } })} mySeat={0} width={366} />);
    expect(seatEl(container, 0).querySelectorAll(".mf-dt__ring--me").length).toBe(1);
    expect(seatEl(container, 0).querySelectorAll(".mf-dt__spot").length).toBe(1);
  });

  it("차례 자리 aria-label 에 '지금 주장하는 차례'가 든다 (내 자리는 '(나)' 뒤)", () => {
    render(<DayTable seats={five({ 2: { turn: true }, 0: {} })} mySeat={0} width={366} />);
    expect(screen.getByRole("group", { name: "지호, 지금 주장하는 차례" })).toBeTruthy();
    cleanup();
    render(<DayTable seats={five({ 0: { turn: true } })} mySeat={0} width={366} />);
    expect(screen.getByRole("group", { name: "동현 (나), 지금 주장하는 차례" })).toBeTruthy();
  });
});

describe("DayTable: 낮 기록 카드 버튼 (D-06)", () => {
  it("onInspect 가 있는 자리는 button.mf-dt__seat(aria-pressed 없음), 라벨 '{닉네임}, 주장 기록 보기', 내 자리는 '(나)'", () => {
    const f = vi.fn();
    const { container } = render(<DayTable seats={five({ 1: { onInspect: f }, 0: { onInspect: vi.fn() } })} mySeat={0} width={366} />);
    const buttons = container.querySelectorAll<HTMLElement>("button.mf-dt__seat");
    expect(buttons.length).toBe(2);
    for (const b of Array.from(buttons)) {
      expect(b.getAttribute("type")).toBe("button");
      expect(b.hasAttribute("aria-pressed")).toBe(false);
    }
    expect(screen.getByRole("button", { name: "가나다라마, 주장 기록 보기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "동현 (나), 주장 기록 보기" })).toBeTruthy();
  });

  it("클릭하면 그 자리의 onInspect 가 한 번 불린다", () => {
    const a = vi.fn();
    const b = vi.fn();
    render(<DayTable seats={five({ 1: { onInspect: a }, 2: { onInspect: b } })} mySeat={0} width={366} />);
    fireEvent.click(screen.getByRole("button", { name: "지호, 주장 기록 보기" }));
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
  });

  it("onPick 이 onInspect 를 이긴다: 밤 버튼(aria-pressed 있음), 눌러도 onInspect 는 불리지 않는다", () => {
    const pick = vi.fn();
    const inspect = vi.fn();
    render(<DayTable seats={five({ 2: { onPick: pick, onInspect: inspect } })} mySeat={0} width={366} />);
    const btn = screen.getByRole("button", { name: "지호, 선택 대상" });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(btn);
    expect(pick).toHaveBeenCalledTimes(1);
    expect(inspect).not.toHaveBeenCalled();
  });

  it("onPick·onInspect 둘 다 없으면 div[role=group]", () => {
    const { container } = render(<DayTable seats={five()} mySeat={0} width={366} />);
    expect(container.querySelectorAll("button").length).toBe(0);
    expect(seatEl(container, 1).tagName).toBe("DIV");
    expect(seatEl(container, 1).getAttribute("role")).toBe("group");
  });

  it("차례이면서 onInspect 면 '{닉네임}, 지금 주장하는 차례, 주장 기록 보기'", () => {
    render(<DayTable seats={five({ 2: { turn: true, onInspect: vi.fn() } })} mySeat={0} width={366} />);
    expect(screen.getByRole("button", { name: "지호, 지금 주장하는 차례, 주장 기록 보기" })).toBeTruthy();
  });
});

describe("DayTable: 관전자 직업 그림 (D-17, T-03.1-15)", () => {
  it("roleArt 가 있는 살아 있는 자리: src @2x, srcSet 에 @4x 2x, alt 빈 문자열, mf-figure--role", () => {
    const { container } = render(<DayTable seats={five({ 2: { roleArt: "mafia" } })} mySeat={0} width={366} />);
    const img = imgEl(container, 2);
    expect(img.getAttribute("src")).toBe("/characters/roles/mafia_default%402x.png");
    expect(img.getAttribute("srcset")?.includes("mafia_default%404x.png 2x")).toBe(true);
    expect(img.getAttribute("alt")).toBe("");
    expect(img.classList.contains("mf-figure--role")).toBe(true);
    expect(container.querySelectorAll('img[src*="/characters/roles/"]').length).toBe(1);
  });

  it("같은 입력의 dead 자리는 유령 그림이다 (roleArt 무시)", () => {
    const { container } = render(<DayTable seats={five({ 2: { roleArt: "police", dead: true } })} mySeat={0} width={366} />);
    expect(imgEl(container, 2).getAttribute("src")).toBe("/characters/ghost/ghost_default%402x.png");
    expect(container.querySelectorAll('img[src*="/characters/roles/"]').length).toBe(0);
  });

  it("roleArt 가 하나도 없는 렌더(4~8명)에서는 /characters/roles/ 를 가리키는 img 가 0개", () => {
    for (const seats of [five(), five({ 3: { dead: true }, 1: { turn: true } }), eight()]) {
      const { container } = render(<DayTable seats={seats} mySeat={0} width={366} />);
      expect(container.querySelectorAll('img[src*="/characters/roles/"]').length).toBe(0);
      expect(container.innerHTML.includes("/characters/roles/")).toBe(false);
      expect(container.innerHTML.includes("srcset=\"/characters/roles/")).toBe(false);
      cleanup();
    }
  });

  it("roleArt 자리의 aria-label 은 '{닉네임}, {직업 이름}'", () => {
    render(<DayTable seats={five({ 1: { roleArt: "doctor" }, 3: { roleArt: "citizen" } })} mySeat={0} width={366} />);
    expect(screen.getByRole("group", { name: "가나다라마, 의사" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "하늘, 시민" })).toBeTruthy();
  });

  it("roleArt 가 바뀌면 그림 노드가 교체된다 (key 가 달라 페이드가 한 번 돈다)", () => {
    const { container, rerender } = render(<DayTable seats={five()} mySeat={0} width={366} />);
    const before = imgEl(container, 2);
    rerender(<DayTable seats={five({ 2: { roleArt: "mafia" } })} mySeat={0} width={366} />);
    expect(imgEl(container, 2) === before).toBe(false);
  });
});

describe("DayTable: 아침 어둡게 층과 강조 (D-15)", () => {
  it("dim 이 있으면 .mf-dt__dim 이 정확히 하나(aria-hidden, 변수 --mf-dim-exit-delay: 4700ms), 없으면 0개", () => {
    const { container } = render(<DayTable seats={five()} mySeat={0} width={366} dim={{ exitDelayMs: 4700 }} />);
    const dims = container.querySelectorAll<HTMLElement>(".mf-dt__dim");
    expect(dims.length).toBe(1);
    expect(dims[0]?.getAttribute("aria-hidden")).toBe("true");
    expect(dims[0]?.style.getPropertyValue("--mf-dim-exit-delay")).toBe("4700ms");
    cleanup();
    const none = render(<DayTable seats={five()} mySeat={0} width={366} />);
    expect(none.container.querySelectorAll(".mf-dt__dim").length).toBe(0);
  });

  it("spotlit 자리는 클래스 --spotlit 와 인라인 z-index 31, 다른 자리는 22 이하, --pulse 는 pulse 일 때만", () => {
    const { container } = render(<DayTable seats={five({ 3: { spotlit: true, dead: true } })} mySeat={0} width={366} />);
    expect(seatEl(container, 3).classList.contains("mf-dt__seat--spotlit")).toBe(true);
    expect(seatEl(container, 3).style.zIndex).toBe("31");
    expect(seatEl(container, 3).classList.contains("mf-dt__seat--pulse")).toBe(false);
    for (const e of seatEls(container).filter((x) => x.dataset.seat !== "3")) {
      expect(Number(e.style.zIndex)).toBeLessThanOrEqual(22);
      expect(e.classList.contains("mf-dt__seat--spotlit")).toBe(false);
    }
    cleanup();
    const pulsed = render(<DayTable seats={five({ 3: { spotlit: true, pulse: true, dead: true } })} mySeat={0} width={366} />);
    expect(seatEl(pulsed.container, 3).classList.contains("mf-dt__seat--pulse")).toBe(true);
    cleanup();
    const onlyPulse = render(<DayTable seats={five({ 3: { pulse: true } })} mySeat={0} width={366} />);
    expect(seatEl(onlyPulse.container, 3).classList.contains("mf-dt__seat--pulse")).toBe(false);
  });
});

describe("daytable.css: 03.1-05 (이름표 한 줄·차례·층)", () => {
  const css = readFileSync("src/styles/daytable.css", "utf8");
  const code = css
    .split("\n")
    .filter((l) => !/^\s*(\/\*|\*|\/\/)/.test(l))
    .join("\n");
  it("옛 아랫줄 규칙(.mf-dt__claim·.mf-dt__chg·mf-dt-pop·mf-dt-shake)이 CSS 에 없다", () => {
    expect(cssHas(css, /mf-dt__claim|mf-dt__chg|mf-dt-pop|mf-dt-shake/)).toBe(false);
  });
  it(".mf-dt__tag 는 absolute·translateX(-50%)·pointer-events none, 세로 배치 없음", () => {
    expect(cssHas(css, /\.mf-dt__tag\s*\{[^}]*position:\s*absolute/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__tag\s*\{[^}]*pointer-events:\s*none/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__tag\s*\{[^}]*flex-direction/)).toBe(false);
  });
  it(".mf-dt__tag--turn .mf-dt__name 은 반전(gray-100 면·night-900 글자)", () => {
    expect(cssHas(css, /\.mf-dt__tag--turn \.mf-dt__name\s*\{[^}]*background:\s*var\(--gray-100\)/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__tag--turn \.mf-dt__name\s*\{[^}]*color:\s*var\(--night-900\)/)).toBe(true);
  });
  it(".mf-dt__spot 묶음: 폭 140%·높이 24%·left -20%·bottom calc(-4px - 12%)·pointer-events none, 쌓임 맥락을 만들지 않는다", () => {
    expect(cssHas(css, /\.mf-dt__spot\s*\{[^}]*width:\s*140%/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__spot\s*\{[^}]*height:\s*24%/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__spot\s*\{[^}]*left:\s*-20%/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__spot\s*\{[^}]*bottom:\s*calc\(-4px - 12%\)/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__spot\s*\{[^}]*pointer-events:\s*none/)).toBe(true);
    const m = /\.mf-dt__spot\s*\{([^}]*)\}/.exec(code);
    expect(m).toBeTruthy();
    expect(/(^|[;\s])(transform|z-index|opacity|filter|isolation|animation|will-change|clip-path)\s*:/.test(m![1]!)).toBe(false);
  });
  // clip-path 바깥 방향 여백 24px 는 빛(18px)이 잘리지 않게 하려는 값이다(반원 경계선 쪽만 50% 로 자른다)
  it("두 호: 3px gray-50 링·빛 18px·원형·페이드·pointer-events none", () => {
    expect(cssHas(css, /\.mf-dt__spot-arc\s*\{[^}]*border:\s*3px solid var\(--gray-50\)/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__spot-arc\s*\{[^}]*box-shadow:\s*0 0 18px color-mix\(in srgb, var\(--gray-50\) 75%, transparent\)/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__spot-arc\s*\{[^}]*border-radius:\s*50%/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__spot-arc\s*\{[^}]*position:\s*absolute/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__spot-arc\s*\{[^}]*inset:\s*0/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__spot-arc\s*\{[^}]*pointer-events:\s*none/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__spot-arc\s*\{[^}]*animation:\s*mf-dt-fade var\(--dur-fast\) var\(--ease-out\) both/)).toBe(true);
  });
  it("뒤쪽 호는 z-index -1 + 위쪽 반만, 앞쪽 호는 음수 z-index 없이 아래쪽 반만 보인다", () => {
    expect(cssHas(css, /\.mf-dt__spot-arc--back\s*\{[^}]*z-index:\s*-1/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__spot-arc--back\s*\{[^}]*clip-path:\s*inset\(-24px -24px 50% -24px\)/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__spot-arc--front\s*\{[^}]*clip-path:\s*inset\(50% -24px -24px -24px\)/)).toBe(true);
    const m = /\.mf-dt__spot-arc--front\s*\{([^}]*)\}/.exec(code);
    expect(m).toBeTruthy();
    expect(/z-index\s*:/.test(m![1]!)).toBe(false);
  });
  it("축소 모션 규칙이 호의 animation 을 끈다", () => {
    expect(cssHas(css, /prefers-reduced-motion: reduce\)\s*\{[^@]*?\.mf-dt__spot-arc[^{]*\{[^}]*animation:\s*none/)).toBe(true);
  });
  it(".mf-dt__turn: 28px 원·top -24px·gray-50 면·night-900 글자·pointer-events none, 아이콘 선 2.4", () => {
    expect(cssHas(css, /\.mf-dt__turn\s*\{[^}]*width:\s*28px/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__turn\s*\{[^}]*height:\s*28px/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__turn\s*\{[^}]*top:\s*-24px/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__turn\s*\{[^}]*background:\s*var\(--gray-50\)/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__turn\s*\{[^}]*color:\s*var\(--night-900\)/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__turn\s*\{[^}]*pointer-events:\s*none/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__turn \.mf-icon\s*\{[^}]*stroke-width:\s*2\.4/)).toBe(true);
  });
  it(".mf-dt__dim: z-index 30·pointer-events none(탭 통과)·좌우 여백까지 연장·night-900 45%", () => {
    expect(cssHas(css, /\.mf-dt__dim\s*\{[^}]*z-index:\s*30/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__dim\s*\{[^}]*pointer-events:\s*none/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__dim\s*\{[^}]*left:\s*calc\(-1 \* var\(--mf-scene-pad\)\)/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__dim\s*\{[^}]*right:\s*calc\(-1 \* var\(--mf-scene-pad\)\)/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__dim\s*\{[^}]*color-mix\(in srgb, var\(--night-900\) 45%, transparent\)/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__dim\s*\{[^}]*mf-dim-exit-delay/)).toBe(true);
  });
  it("--mf-scene-pad: 기본 12px, 폭 389px 이하 4px", () => {
    expect(cssHas(css, /\.mf-dt\s*\{[^}]*--mf-scene-pad:\s*12px/)).toBe(true);
    expect(cssHas(css, /@media \(max-width: 389px\)\s*\{\s*\.mf-dt\s*\{\s*--mf-scene-pad:\s*4px/)).toBe(true);
  });
  it("맥동·밝기·페이드 키프레임이 있고 축소 모션에서 pulse 가 꺼진다", () => {
    for (const k of ["mf-dt-fade", "mf-dt-dim-in", "mf-dt-dim-out", "mf-dt-pulse", "mf-dt-bright"]) {
      expect(cssHas(css, new RegExp(`@keyframes ${k}\\b`))).toBe(true);
    }
    expect(cssHas(css, /prefers-reduced-motion: reduce\)\s*\{[^@]*?\.mf-dt__seat--pulse\s*\{[^}]*animation:\s*none/)).toBe(true);
  });
  it("코드 줄에 # 색 값이 없다 (토큰 변수만)", () => {
    expect(/#[0-9a-fA-F]{3,8}\b/.test(code)).toBe(false);
  });
});

// ---- 결정 0028: 대기실·역할 배정이 같은 부품을 쓴다 (입장/퇴장 전이 · 누르기 · 미끄러짐) ----
describe("DayTable 대기실 확장", () => {
  const css = readFileSync("src/styles/daytable.css", "utf8");
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const seatBy = (c: HTMLElement, n: number) => c.querySelector<HTMLElement>(`.mf-dt__seat[data-seat="${n}"]`)!;

  it("transition 이 entering/leaving 이면 자리에 .mf-dt__seat--enter/--leave, 이름표에 .mf-dt__tag--enter/--leave 가 붙고 없으면 안 붙는다", () => {
    const seats = [
      seat(0, "동현", { isMe: true }),
      seat(1, "지호", { transition: "entering" }),
      seat(2, "하늘", { transition: "leaving" }),
      seat(3, "서연", { transition: null }),
    ];
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} />);
    expect(seatBy(container, 1).classList.contains("mf-dt__seat--enter")).toBe(true);
    expect(tagEl(container, 1).classList.contains("mf-dt__tag--enter")).toBe(true);
    expect(seatBy(container, 2).classList.contains("mf-dt__seat--leave")).toBe(true);
    expect(tagEl(container, 2).classList.contains("mf-dt__tag--leave")).toBe(true);
    for (const n of [0, 3]) {
      expect(seatBy(container, n).className).not.toMatch(/--(enter|leave)/);
      expect(tagEl(container, n).className).not.toMatch(/--(enter|leave)/);
    }
  });

  it("onPress 가 있는 자리는 button.mf-dt__seat 이고 이름은 자리 읽기 이름(연결 끊김 포함)·aria-pressed 없음·누르면 호출된다", () => {
    const onPress = vi.fn();
    const seats = [seat(0, "동현", { isMe: true }), seat(1, "지호", { connected: false, onPress }), seat(2, "하늘")];
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} />);
    const btn = screen.getByRole("button", { name: "지호, 연결 끊김" });
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.classList.contains("mf-dt__seat")).toBe(true);
    expect(btn.hasAttribute("aria-pressed")).toBe(false);
    expect(btn.getAttribute("aria-label")).not.toMatch(/대상|주장 기록 보기/);
    expect(container.querySelectorAll("button").length).toBe(1);
    fireEvent.click(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("핸들러 우선순위는 onPick > onInspect > onPress 이다", () => {
    const onPick = vi.fn();
    const onInspect = vi.fn();
    const onPress = vi.fn();
    const mk = (extra: Partial<DayTableSeat>) => [seat(0, "동현", { isMe: true }), seat(1, "지호", extra)];
    const a = render(<DayTable seats={mk({ onPick, onInspect, onPress })} mySeat={0} width={366} />);
    expect(seatBy(a.container, 1).getAttribute("aria-label")).toContain("대상");
    fireEvent.click(seatBy(a.container, 1));
    expect([onPick.mock.calls.length, onInspect.mock.calls.length, onPress.mock.calls.length]).toEqual([1, 0, 0]);
    cleanup();
    const b = render(<DayTable seats={mk({ onInspect, onPress })} mySeat={0} width={366} />);
    expect(seatBy(b.container, 1).getAttribute("aria-label")).toContain("주장 기록 보기");
    fireEvent.click(seatBy(b.container, 1));
    expect([onPick.mock.calls.length, onInspect.mock.calls.length, onPress.mock.calls.length]).toEqual([1, 1, 0]);
    cleanup();
    const c = render(<DayTable seats={mk({ onPress })} mySeat={0} width={366} />);
    fireEvent.click(seatBy(c.container, 1));
    expect([onPick.mock.calls.length, onInspect.mock.calls.length, onPress.mock.calls.length]).toEqual([1, 1, 1]);
  });

  it("slide 가 켜진 루트의 .mf-dt--slide 는 마운트 직후에는 없고 한 프레임 뒤(rAF)에 생긴다, slide 가 없으면 끝까지 없다", () => {
    const queue: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => queue.push(cb));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const { container } = render(<DayTable seats={five()} mySeat={0} width={366} slide />);
    expect(root(container).classList.contains("mf-dt--slide")).toBe(false);
    act(() => {
      for (const cb of queue.splice(0)) cb(0);
    });
    expect(root(container).classList.contains("mf-dt--slide")).toBe(true);
    cleanup();
    const plain = render(<DayTable seats={five()} mySeat={0} width={366} />);
    act(() => {
      for (const cb of queue.splice(0)) cb(0);
    });
    expect(root(plain.container).classList.contains("mf-dt--slide")).toBe(false);
  });

  it("slide: 언마운트하면 대기 중인 프레임을 취소한다", () => {
    const cancel = vi.fn();
    vi.stubGlobal("requestAnimationFrame", () => 7);
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const { unmount } = render(<DayTable seats={five()} mySeat={0} width={366} slide />);
    unmount();
    expect(cancel).toHaveBeenCalledWith(7);
  });

  it("CSS: 미끄러짐은 자리 left·top·transform 과 이름표 left·top 전이(--dur-med·--ease-out)이고 축소 모션에서는 전이가 없다", () => {
    expect(cssHas(code, /\.mf-dt--slide \.mf-dt__seat\s*\{[^}]*transition:[^;}]*left var\(--dur-med\) var\(--ease-out\)/)).toBe(true);
    expect(cssHas(code, /\.mf-dt--slide \.mf-dt__seat\s*\{[^}]*transition:[^;}]*top var\(--dur-med\) var\(--ease-out\)/)).toBe(true);
    expect(cssHas(code, /\.mf-dt--slide \.mf-dt__seat\s*\{[^}]*transition:[^;}]*transform var\(--dur-med\) var\(--ease-out\)/)).toBe(true);
    expect(cssHas(code, /\.mf-dt--slide \.mf-dt__tag\s*\{[^}]*transition:[^;}]*left var\(--dur-med\) var\(--ease-out\)/)).toBe(true);
    expect(cssHas(code, /\.mf-dt--slide \.mf-dt__tag\s*\{[^}]*transition:[^;}]*top var\(--dur-med\) var\(--ease-out\)/)).toBe(true);
    expect(cssHas(code, /prefers-reduced-motion: reduce\)\s*\{[^@]*?\.mf-dt--slide[^{]*\{[^}]*transition:\s*none/)).toBe(true);
  });

  it("CSS: 입장·퇴장 키프레임은 그림만 움직이고(자리 scale 과 곱해지지 않게) 입장은 --dur-med, 퇴장은 지역 상수 320ms, 이름표는 페이드, 축소 모션에서 꺼진다", () => {
    expect(cssHas(code, /\.mf-dt\s*\{[^}]*--mf-seat-leave-ms:\s*320ms/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__seat--enter \.mf-figure\s*\{[^}]*animation:\s*mf-dt-seat-enter var\(--dur-med\) var\(--ease-out\)/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__seat--leave \.mf-figure\s*\{[^}]*animation:\s*mf-dt-seat-leave var\(--mf-seat-leave-ms\) var\(--ease-out\)/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__tag--enter\s*\{[^}]*animation:\s*mf-dt-fade var\(--dur-med\)/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__tag--leave\s*\{[^}]*animation:\s*mf-dt-fade-out var\(--mf-seat-leave-ms\)/)).toBe(true);
    for (const k of ["mf-dt-seat-enter", "mf-dt-seat-leave", "mf-dt-fade-out"]) expect(cssHas(code, new RegExp(`@keyframes ${k}\\b`))).toBe(true);
    expect(cssHas(code, /prefers-reduced-motion: reduce\)\s*\{[^@]*?\.mf-dt__seat--enter \.mf-figure[^{]*\{[^}]*animation:\s*none/)).toBe(true);
  });

  it("CSS: 코드 줄에 # 색 값이 없다", () => {
    expect(/#[0-9a-fA-F]{3,8}\b/.test(code)).toBe(false);
  });
});
