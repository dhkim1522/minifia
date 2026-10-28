import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { DayTable } from "../../src/components/DayTable";
import { Icon } from "../../src/components/Icon";
import { ASSET_VERSION, ghostSrc } from "../../src/net/assets";
import type { IconName } from "../../src/components/Icon";
import type { DayTableSeat } from "../../src/components/DayTable";
import { HALO_MAX_SIMULTANEOUS, daySeatLayout, px } from "../../src/game/dayTable";
import { claimName } from "../../src/game/roleText";
import { CONE_H, CONE_W, GHOST_FADE_MS, VERDICT_BLUR_PX, VERDICT_CANDIDATE_SCALE, VERDICT_DIM_PERCENT, VERDICT_MOVE_MS, candidateCenter, chipPlacement, tagBoxesOf } from "../../src/game/verdict";

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

describe("DayTable: 왕관·후광·동료·끊김·보낸 사람", () => {
  it("hostCrown 이 있을 때만 방장 자리의 캐릭터 상자 안에 .mf-dt__crown[role=img][aria-label=방장] 이 하나 있다, 방장이 없으면 없다", () => {
    const { container } = render(<DayTable seats={five({ 2: { isHost: true } })} mySeat={0} width={366} hostCrown />);
    const crowns = container.querySelectorAll<HTMLElement>(".mf-dt__crown");
    expect(crowns.length).toBe(1);
    expect(crowns[0]?.getAttribute("role")).toBe("img");
    expect(crowns[0]?.getAttribute("aria-label")).toBe("방장");
    expect(seatEl(container, 2).contains(crowns[0] ?? null)).toBe(true);
    cleanup();
    const none = render(<DayTable seats={five()} mySeat={0} width={366} hostCrown />);
    expect(none.container.querySelectorAll(".mf-dt__crown").length).toBe(0);
  });

  it("hostCrown 이 없으면(기본: 역할 배정·낮·밤·아침) isHost 자리가 있어도 왕관이 0개다", () => {
    const { container } = render(<DayTable seats={five({ 2: { isHost: true } })} mySeat={0} width={366} />);
    expect(container.querySelectorAll(".mf-dt__crown").length).toBe(0);
    expect(container.querySelectorAll('[aria-label="방장"]').length).toBe(0);
  });

  it("내 자리는 후광도 발밑 원도 없고(내 표시는 이름표 테두리 .mf-dt__tag--me 뿐), 내 이름표에만 --me", () => {
    const { container } = render(<DayTable seats={five()} mySeat={0} width={366} />);
    expect(container.querySelectorAll(".mf-dt__ring").length).toBe(0);
    expect(container.querySelectorAll(".mf-figure--halo-white, .mf-figure--halo-crimson").length).toBe(0);
    expect(container.querySelectorAll(".mf-dt__tag--me").length).toBe(1);
    expect(tagEl(container, 0).classList.contains("mf-dt__tag--me")).toBe(true);
  });

  it("isAlly 자리의 그림 img 에만 진홍 후광과 aria-label 동료 마름모, 아무도 동료가 아니면 없다", () => {
    const { container } = render(<DayTable seats={five({ 3: { isAlly: true } })} mySeat={0} width={366} />);
    expect(container.querySelectorAll(".mf-figure--halo-crimson").length).toBe(1);
    const halo = seatEl(container, 3).querySelector("img.mf-figure--halo-crimson");
    expect(halo).not.toBeNull();
    expect(container.querySelectorAll("img.mf-figure--halo-crimson").length).toBe(1);
    const mark = container.querySelectorAll(".mf-dt__mark");
    expect(mark.length).toBe(1);
    expect(mark[0]?.getAttribute("aria-label")).toBe("동료");
    // 후광 클래스는 그림 img 에만 붙는다(자리·이름표·마름모에는 안 붙는다)
    expect(seatEl(container, 3).className).not.toMatch(/halo/);
    expect(tagEl(container, 3).className).not.toMatch(/halo/);
    expect(mark[0]?.getAttribute("class") ?? "").not.toMatch(/halo/);
    cleanup();
    const none = render(<DayTable seats={five()} mySeat={0} width={366} />);
    expect(none.container.querySelectorAll(".mf-figure--halo-crimson").length).toBe(0);
    expect(none.container.querySelectorAll(".mf-dt__mark").length).toBe(0);
  });

  it("동료이면서 나인 자리는 진홍 후광이다(내 표시는 이름표 --me 뿐)", () => {
    const { container } = render(<DayTable seats={five({ 0: { isAlly: true } })} mySeat={0} width={366} />);
    expect(seatEl(container, 0).querySelectorAll("img.mf-figure--halo-crimson").length).toBe(1);
    expect(tagEl(container, 0).classList.contains("mf-dt__tag--me")).toBe(true);
  });

  it("끊긴 자리의 그림은 mf-figure--disconnected 이고, 후광이 함께 있어도 둘 다 남는다", () => {
    const seats = five({ 2: { connected: false }, 3: { connected: false, isAlly: true } });
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} />);
    expect(seatEl(container, 2).querySelector("img")?.classList.contains("mf-figure--disconnected")).toBe(true);
    expect(seatEl(container, 1).querySelector("img")?.classList.contains("mf-figure--disconnected")).toBe(false);
    const both = seatEl(container, 3).querySelector("img")!;
    expect(both.classList.contains("mf-figure--disconnected")).toBe(true);
    expect(both.classList.contains("mf-figure--halo-crimson")).toBe(true);
  });

  it("spoke true 인 자리에는 .mf-dt__bubble--spoke 하나(aria-hidden, 점 셋)뿐이고 이름표 반전도 후광도 없다", () => {
    const { container } = render(<DayTable seats={five({ 4: { spoke: true } })} mySeat={0} width={366} />);
    const bubbles = container.querySelectorAll<HTMLElement>(".mf-dt__bubble");
    expect(bubbles.length).toBe(1);
    expect(bubbles[0]?.classList.contains("mf-dt__bubble--spoke")).toBe(true);
    expect(bubbles[0]?.getAttribute("aria-hidden")).toBe("true");
    expect(bubbles[0]?.querySelectorAll("i").length).toBe(3);
    expect(seatEl(container, 4).contains(bubbles[0] ?? null)).toBe(true);
    expect(tagEl(container, 4).className).toBe("mf-dt__tag");
    expect(container.querySelectorAll(".mf-figure--halo-white").length).toBe(0);
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

  it("pick.mine 인 자리: aria-pressed='true', 그림 img 에 흰 후광 하나와 .mf-dt__pick--me 하나(svg 하나, aria-hidden). 다른 자리에는 없다", () => {
    const seats = pickSeats({ 1: vi.fn(), 2: vi.fn() }, { 2: { pick: { mine: true } } });
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} />);
    const el = seatEl(container, 2);
    expect(el.getAttribute("aria-pressed")).toBe("true");
    expect(el.querySelectorAll("img.mf-figure--halo-white").length).toBe(1);
    expect(el.querySelectorAll(".mf-dt__sel").length).toBe(0);
    const badge = el.querySelectorAll<HTMLElement>(".mf-dt__pick.mf-dt__pick--me");
    expect(badge.length).toBe(1);
    expect(badge[0]?.getAttribute("aria-hidden")).toBe("true");
    expect(badge[0]?.querySelectorAll("svg").length).toBe(1);
    expect(container.querySelectorAll(".mf-figure--halo-white").length).toBe(1);
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

  it("새 필드를 하나도 주지 않은 다섯 자리 테이블의 innerHTML 에 button·후광·mf-dt__pick 이 없다", () => {
    const { container } = render(<DayTable seats={five()} mySeat={0} width={366} />);
    const html = container.innerHTML;
    expect(html.includes("<button")).toBe(false);
    expect(html.includes("halo")).toBe(false);
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

describe("daytable.css: 밤 선택 표시 (03-02, 결정 0030: 발밑 원 없음)", () => {
  const css = readFileSync("src/styles/daytable.css", "utf8");
  it("발밑 원 규칙(.mf-dt__sel)이 CSS 에 없다", () => {
    expect(cssHas(css, /\.mf-dt__sel\b/)).toBe(false);
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
    expect(img.getAttribute("src")).toBe(ghostSrc().src);
    expect(img.getAttribute("srcset")?.includes("ghost_default%404x.png?v=" + ASSET_VERSION + " 4x")).toBe(true);
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

  it("isAlly 이면서 dead 인 자리는 진홍 후광·마름모가 그대로 있다", () => {
    const { container } = render(<DayTable seats={five({ 3: { isAlly: true, dead: true } })} mySeat={0} width={366} />);
    expect(seatEl(container, 3).querySelectorAll("img.mf-figure--halo-crimson").length).toBe(1);
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
const haloWhite = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>("img.mf-figure--halo-white"));
const bubbleEls = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>(".mf-dt__bubble"));
const OLD_SELECTORS = ".mf-dt__spot, .mf-dt__spot-arc, .mf-dt__ring, .mf-dt__sel, .mf-dt__turn, .mf-dt__tag--turn, .mf-dt__tag--spoke";

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

describe("DayTable: 지금 주장하는 차례 (D-03, 결정 0030: 후광 + '…' 말풍선)", () => {
  it("turn 인 자리 그림에 흰 후광 하나와 그 자리 안에 .mf-dt__bubble--turn 하나(aria-hidden, 점 셋), 이름표 반전은 없다", () => {
    const { container } = render(<DayTable seats={five({ 2: { turn: true } })} mySeat={0} width={366} />);
    expect(haloWhite(container).length).toBe(1);
    expect(seatEl(container, 2).contains(haloWhite(container)[0] ?? null)).toBe(true);
    expect(bubbleEls(container).length).toBe(1);
    const bubble = bubbleEls(container)[0]!;
    expect(bubble.className).toBe("mf-dt__bubble mf-dt__bubble--turn");
    expect(bubble.getAttribute("aria-hidden")).toBe("true");
    expect(bubble.querySelectorAll("i").length).toBe(3);
    expect(seatEl(container, 2).contains(bubble)).toBe(true);
    expect(tagEl(container, 2).className).toBe("mf-dt__tag");
  });

  it("후광 클래스는 그림 img 에만 붙는다(자리·이름표·말풍선·마름모에는 없다)", () => {
    const { container } = render(<DayTable seats={five({ 2: { turn: true }, 3: { isAlly: true }, 4: { pick: { mine: true } } })} mySeat={0} width={366} />);
    const withHalo = Array.from(container.querySelectorAll<HTMLElement>('[class*="halo"]'));
    expect(withHalo.length).toBe(3);
    for (const el of withHalo) expect(el.tagName).toBe("IMG");
  });

  it("옛 발밑 원·내 링·동료 링·선택 링·머리 위 배지·이름표 반전 요소가 어디에도 없다", () => {
    const { container } = render(
      <DayTable seats={five({ 0: { turn: true }, 2: { turn: true, spoke: true }, 3: { isAlly: true }, 4: { pick: { mine: true } } })} mySeat={0} width={366} />,
    );
    expect(container.querySelectorAll(OLD_SELECTORS).length).toBe(0);
  });

  it("후광 우선순위: 차례이면서 동료이면 흰 후광(진홍은 없다), 마름모는 그대로", () => {
    const { container } = render(<DayTable seats={five({ 3: { turn: true, isAlly: true } })} mySeat={0} width={366} />);
    const img = seatEl(container, 3).querySelector("img")!;
    expect(img.classList.contains("mf-figure--halo-white")).toBe(true);
    expect(img.classList.contains("mf-figure--halo-crimson")).toBe(false);
    expect(seatEl(container, 3).querySelectorAll(".mf-dt__mark").length).toBe(1);
  });

  it("내 자리가 차례면 흰 후광이 붙는다(내 자리라는 이유만으로는 붙지 않는다)", () => {
    const { container } = render(<DayTable seats={five({ 0: { turn: true } })} mySeat={0} width={366} />);
    expect(seatEl(container, 0).querySelectorAll("img.mf-figure--halo-white").length).toBe(1);
    expect(bubbleEls(container).length).toBe(1);
    expect(tagEl(container, 0).className).toBe("mf-dt__tag mf-dt__tag--me");
  });

  it("같은 자리에 emoji 가 있으면 말풍선이 없고(이모티콘이 대신), emoji 가 없어지면 다시 나온다. 후광은 그대로", () => {
    const emoji = { key: "k1", icon: "smile", z: 0 } as const;
    const withEmoji = render(<DayTable seats={five({ 2: { turn: true, emoji } })} mySeat={0} width={366} />);
    expect(bubbleEls(withEmoji.container).length).toBe(0);
    expect(withEmoji.container.querySelectorAll(".mf-dt__emoji").length).toBe(1);
    expect(haloWhite(withEmoji.container).length).toBe(1);
    withEmoji.rerender(<DayTable seats={five({ 2: { turn: true, emoji: null } })} mySeat={0} width={366} />);
    expect(bubbleEls(withEmoji.container).length).toBe(1);
    cleanup();
    const spoke = render(<DayTable seats={five({ 4: { spoke: true, emoji } })} mySeat={0} width={366} />);
    expect(bubbleEls(spoke.container).length).toBe(0);
  });

  it("차례 자리의 인라인 z-index 는 배치 결과(12~22) 그대로, 탈락 강조는 31 — 후광·말풍선이 있어도 같다", () => {
    const { container } = render(<DayTable seats={five({ 2: { turn: true }, 3: { spotlit: true, dead: true } })} mySeat={0} width={366} />);
    const z2 = Number(seatEl(container, 2).style.zIndex);
    expect(z2 >= 12 && z2 <= 22).toBe(true);
    expect(seatEl(container, 3).style.zIndex).toBe("31");
    for (const el of Array.from(container.querySelectorAll<HTMLElement>(".mf-dt__bubble, img.mf-figure--halo-white"))) expect(el.style.zIndex).toBe("");
  });

  it.each([4, 5, 6, 7, 8])("%i명 차례 자리가 있어도 이름표 z 최댓값 < 자리 z 최솟값 (D3a 단위 버전)", (n) => {
    const seats = Array.from({ length: n }, (_, i) => seat(i, `이${i}`, { isMe: i === 0, turn: i === 1 }));
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} />);
    const tagZ = Array.from(container.querySelectorAll<HTMLElement>(".mf-dt__tag")).map((e) => Number(e.style.zIndex));
    const seatZ = seatEls(container).map((e) => Number(e.style.zIndex));
    expect(haloWhite(container).length).toBe(1);
    expect(Math.max(...tagZ) < Math.min(...seatZ)).toBe(true);
  });

  it("차례 자리가 없으면 후광·말풍선이 0개", () => {
    const { container } = render(<DayTable seats={five()} mySeat={0} width={366} />);
    expect(haloWhite(container).length).toBe(0);
    expect(bubbleEls(container).length).toBe(0);
    expect(container.querySelectorAll(OLD_SELECTORS).length).toBe(0);
  });

  it("두 자리에 turn 을 주어도 입력 그대로 둘 다 그린다 (한 번에 한 자리는 장면이 보장한다)", () => {
    const { container } = render(<DayTable seats={five({ 1: { turn: true }, 3: { turn: true } })} mySeat={0} width={366} />);
    expect(haloWhite(container).length).toBe(2);
    expect(bubbleEls(container).length).toBe(2);
  });

  it("차례 자리 aria-label 에 '지금 주장하는 차례'가 든다 (내 자리는 '(나)' 뒤)", () => {
    render(<DayTable seats={five({ 2: { turn: true }, 0: {} })} mySeat={0} width={366} />);
    expect(screen.getByRole("group", { name: "지호, 지금 주장하는 차례" })).toBeTruthy();
    cleanup();
    render(<DayTable seats={five({ 0: { turn: true } })} mySeat={0} width={366} />);
    expect(screen.getByRole("group", { name: "동현 (나), 지금 주장하는 차례" })).toBeTruthy();
  });
});

describe("DayTable: 한 화면의 후광은 최대 3개 (HALO_MAX_SIMULTANEOUS)", () => {
  it("마피아 보는 밤: 동료 1 + 내 선택 1 = 2개", () => {
    const seats = eight({ 3: { isAlly: true }, 5: { pick: { mine: true }, onPick: vi.fn() } });
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} />);
    expect(container.querySelectorAll('img[class*="halo"]').length).toBe(2);
    expect(container.querySelectorAll("img.mf-figure--halo-crimson").length).toBe(1);
    expect(container.querySelectorAll("img.mf-figure--halo-white").length).toBe(1);
  });

  it("관전자 낮: 마피아 둘 + 차례 1 = 3개 이하", () => {
    const seats = eight({ 2: { isAlly: true }, 6: { isAlly: true }, 4: { turn: true } });
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} allyMarkLabel="마피아" />);
    expect(container.querySelectorAll('img[class*="halo"]').length).toBe(HALO_MAX_SIMULTANEOUS);
    expect(container.querySelectorAll("img.mf-figure--halo-crimson").length).toBe(2);
  });

  it("한 자리가 차례이면서 마피아면 후광은 그 자리 하나뿐이다", () => {
    const seats = eight({ 2: { isAlly: true, turn: true }, 6: { isAlly: true } });
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} />);
    expect(container.querySelectorAll('img[class*="halo"]').length).toBe(2);
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
    expect(imgEl(container, 2).getAttribute("src")).toBe(ghostSrc().src);
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

describe("daytable.css: 03.1-05 (이름표 한 줄·층) + 결정 0030 (후광·말풍선)", () => {
  const css = readFileSync("src/styles/daytable.css", "utf8");
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
  it("옛 아랫줄 규칙(.mf-dt__claim·.mf-dt__chg·mf-dt-pop·mf-dt-shake)이 CSS 에 없다", () => {
    expect(cssHas(css, /mf-dt__claim|mf-dt__chg|mf-dt-pop|mf-dt-shake/)).toBe(false);
  });
  it(".mf-dt__tag 는 absolute·translateX(-50%)·pointer-events none, 세로 배치 없음", () => {
    expect(cssHas(css, /\.mf-dt__tag\s*\{[^}]*position:\s*absolute/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__tag\s*\{[^}]*pointer-events:\s*none/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__tag\s*\{[^}]*flex-direction/)).toBe(false);
  });
  it("이름표 반전·발밑 원(링 묶음·호·내 링·동료 링·선택 링)·머리 위 배지 규칙이 CSS 에 없다", () => {
    expect(cssHas(code, /\.mf-dt__tag--(turn|spoke)\b/)).toBe(false);
    expect(cssHas(code, /\.mf-dt__(spot|ring|sel|turn)\b/)).toBe(false);
    expect(cssHas(code, /mf-dt__spot-arc/)).toBe(false);
  });
  it("후광 값은 .mf-dt 의 사용자 지정 속성 두 개에 한 번만 적는다: 안쪽 2px 95% + 바깥 9px 75%(흰 = gray-50), 진홍 = crimson-400 95%·70%", () => {
    expect(cssHas(code, /\.mf-dt\s*\{[^}]*--mf-halo-white:\s*drop-shadow\(0 0 2px color-mix\(in srgb, var\(--gray-50\) 95%, transparent\)\) drop-shadow\(0 0 9px color-mix\(in srgb, var\(--gray-50\) 75%, transparent\)\)/)).toBe(true);
    expect(cssHas(code, /\.mf-dt\s*\{[^}]*--mf-halo-crimson:\s*drop-shadow\(0 0 2px color-mix\(in srgb, var\(--crimson-400\) 95%, transparent\)\) drop-shadow\(0 0 9px color-mix\(in srgb, var\(--crimson-400\) 70%, transparent\)\)/)).toBe(true);
    expect((code.match(/--mf-halo-white:/g) ?? []).length).toBe(1);
    expect((code.match(/--mf-halo-crimson:/g) ?? []).length).toBe(1);
  });
  it("후광 클래스는 filter: var(--mf-halo-…) 이고, 끊김과 함께면 grayscale(1) 다음에 후광이 온다", () => {
    expect(cssHas(code, /\.mf-dt__seat \.mf-figure--halo-white\s*\{[^}]*filter:\s*var\(--mf-halo-white\)/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__seat \.mf-figure--halo-crimson\s*\{[^}]*filter:\s*var\(--mf-halo-crimson\)/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__seat \.mf-figure--disconnected\.mf-figure--halo-white\s*\{[^}]*filter:\s*grayscale\(1\) var\(--mf-halo-white\)/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__seat \.mf-figure--disconnected\.mf-figure--halo-crimson\s*\{[^}]*filter:\s*grayscale\(1\) var\(--mf-halo-crimson\)/)).toBe(true);
  });
  it("후광은 애니메이션하지 않고 그림에 filter 전이만 둔다(--dur-fast)", () => {
    expect(cssHas(code, /\.mf-dt__seat \.mf-figure\s*\{[^}]*transition:\s*filter var\(--dur-fast\) var\(--ease-out\)/)).toBe(true);
    expect(cssHas(code, /halo[^{]*\{[^}]*animation/)).toBe(false);
  });
  it(".mf-dt__bubble: 높이 26·좌우 11·모서리 13·gray-50 면·위 -26px·가운데·pointer-events none, 꼬리 5px(::after), 점 6px night-900", () => {
    expect(cssHas(code, /\.mf-dt__bubble\s*\{[^}]*position:\s*absolute/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__bubble\s*\{[^}]*top:\s*-26px/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__bubble\s*\{[^}]*left:\s*50%/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__bubble\s*\{[^}]*translateX\(-50%\)/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__bubble\s*\{[^}]*height:\s*26px/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__bubble\s*\{[^}]*padding:\s*0 11px/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__bubble\s*\{[^}]*border-radius:\s*13px/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__bubble\s*\{[^}]*background:\s*var\(--gray-50\)/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__bubble\s*\{[^}]*gap:\s*4px/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__bubble\s*\{[^}]*pointer-events:\s*none/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__bubble::after\s*\{[^}]*border:\s*5px solid transparent/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__bubble::after\s*\{[^}]*border-top-color:\s*var\(--gray-50\)/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__bubble i\s*\{[^}]*width:\s*6px/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__bubble i\s*\{[^}]*height:\s*6px/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__bubble i\s*\{[^}]*background:\s*var\(--night-900\)/)).toBe(true);
  });
  it("말풍선 점: 1200ms 순환 mf-dt-dot 키프레임이 0/200/400ms 지연으로 차례대로 깜박이고, 정지 불투명도는 1/.6/.3", () => {
    expect(cssHas(code, /@keyframes mf-dt-dot\b/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__bubble i\s*\{[^}]*animation:\s*mf-dt-dot 1200ms/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__bubble i:nth-child\(1\)\s*\{[^}]*animation-delay:\s*0ms/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__bubble i:nth-child\(2\)\s*\{[^}]*animation-delay:\s*200ms/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__bubble i:nth-child\(3\)\s*\{[^}]*animation-delay:\s*400ms/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__bubble i:nth-child\(1\)\s*\{[^}]*opacity:\s*1\b/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__bubble i:nth-child\(2\)\s*\{[^}]*opacity:\s*0?\.6\b/)).toBe(true);
    expect(cssHas(code, /\.mf-dt__bubble i:nth-child\(3\)\s*\{[^}]*opacity:\s*0?\.3\b/)).toBe(true);
  });
  it("축소 모션에서는 말풍선과 점의 animation 이 none 이라 점이 정지 불투명도로 남는다", () => {
    expect(cssHas(code, /prefers-reduced-motion: reduce\)\s*\{[^@]*?\.mf-dt__bubble[^{]*\{[^}]*animation:\s*none/)).toBe(true);
    expect(cssHas(code, /prefers-reduced-motion: reduce\)\s*\{[^@]*?\.mf-dt__bubble i[^{]*\{[^}]*animation:\s*none/)).toBe(true);
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

describe("DayTable: 좌석이 후광 종류(halo)를 명시한다 (04-18, 결정 0030, D-33)", () => {
  const haloImgs = (c: HTMLElement, n: number) => Array.from(seatEl(c, n).querySelectorAll<HTMLElement>("img[class*='mf-figure--halo']"));

  it("halo 네 값: amber·white·crimson 은 그 자리 그림에만 해당 클래스, none 은 후광 클래스가 없다", () => {
    const { container } = render(
      <DayTable
        seats={five({ 1: { halo: "amber" }, 2: { halo: "white" }, 3: { halo: "crimson" }, 4: { halo: "none" } })}
        mySeat={0}
        width={366}
      />,
    );
    expect(container.querySelectorAll("img.mf-figure--halo-amber").length).toBe(1);
    expect(haloImgs(container, 1)[0]?.classList.contains("mf-figure--halo-amber")).toBe(true);
    expect(haloImgs(container, 2)[0]?.classList.contains("mf-figure--halo-white")).toBe(true);
    expect(haloImgs(container, 3)[0]?.classList.contains("mf-figure--halo-crimson")).toBe(true);
    expect(haloImgs(container, 4).length).toBe(0);
    expect(container.querySelectorAll('img[class*="halo"]').length).toBe(3);
  });

  it("halo none 이어도 동료 마름모는 isAlly 로 그대로 남는다. halo 가 기본 파생(동료 진홍·차례 흰)보다 우선한다", () => {
    const { container } = render(
      <DayTable seats={five({ 3: { isAlly: true, halo: "none" }, 2: { turn: true, halo: "amber" } })} mySeat={0} width={366} />,
    );
    expect(haloImgs(container, 3).length).toBe(0);
    expect(seatEl(container, 3).querySelectorAll(".mf-dt__mark").length).toBe(1);
    expect(haloImgs(container, 2).length).toBe(1);
    expect(haloImgs(container, 2)[0]?.classList.contains("mf-figure--halo-amber")).toBe(true);
  });

  it("halo 가 없으면 기존 파생: 동료 = 진홍, 차례 = 흰, 둘이면 흰", () => {
    const { container } = render(
      <DayTable seats={five({ 1: { isAlly: true }, 2: { turn: true }, 3: { isAlly: true, turn: true } })} mySeat={0} width={366} />,
    );
    expect(haloImgs(container, 1)[0]?.classList.contains("mf-figure--halo-crimson")).toBe(true);
    expect(haloImgs(container, 2)[0]?.classList.contains("mf-figure--halo-white")).toBe(true);
    expect(haloImgs(container, 3)[0]?.classList.contains("mf-figure--halo-white")).toBe(true);
    expect(container.querySelectorAll("img.mf-figure--halo-amber").length).toBe(0);
  });

  it("끊긴 자리에 halo 가 있어도 그림은 끊김 클래스를 함께 가진다", () => {
    const { container } = render(<DayTable seats={five({ 1: { connected: false, halo: "amber" } })} mySeat={0} width={366} />);
    const img = haloImgs(container, 1)[0]!;
    expect(img.classList.contains("mf-figure--disconnected")).toBe(true);
    expect(img.classList.contains("mf-figure--halo-amber")).toBe(true);
  });

  it("pressed 는 배지 없이 onPick 버튼의 aria-pressed 만 켠다. 안 주면 pick.mine 을 따른다", () => {
    const { container } = render(
      <DayTable seats={five({ 1: { onPick: () => {}, pressed: true }, 2: { onPick: () => {}, pick: { mine: true } }, 3: { onPick: () => {} } })} mySeat={0} width={366} />,
    );
    expect(seatEl(container, 1).getAttribute("aria-pressed")).toBe("true");
    expect(seatEl(container, 1).querySelector(".mf-dt__pick")).toBeNull();
    expect(seatEl(container, 2).getAttribute("aria-pressed")).toBe("true");
    expect(seatEl(container, 3).getAttribute("aria-pressed")).toBe("false");
  });

  it("CSS: 앰버 후광은 --amber-400 변수로 만든 --mf-halo-amber 이고, 끊김 조합은 흑백을 먼저 적용한다(색 값 직접 없음)", () => {
    const code = readFileSync("src/styles/daytable.css", "utf8");
    expect(/--mf-halo-amber:\s*drop-shadow\(0 0 2px color-mix\(in srgb, var\(--amber-400\) 95%, transparent\)\)\s*drop-shadow\(0 0 9px color-mix\(in srgb, var\(--amber-400\) 75%, transparent\)\)/.test(code)).toBe(true);
    expect(/\.mf-dt__seat \.mf-figure--halo-amber\s*\{[^}]*filter:\s*var\(--mf-halo-amber\)/.test(code)).toBe(true);
    expect(/\.mf-figure--disconnected\.mf-figure--halo-amber\s*\{[^}]*filter:\s*grayscale\(1\) var\(--mf-halo-amber\)/.test(code)).toBe(true);
  });
});

describe("DayTable: 표수 칩 chip (04-19, UI-SPEC 8.3, D-31)", () => {
  const chipEl = (c: HTMLElement, n: number) => c.querySelector<HTMLElement>(`.mf-vchip[data-seat="${n}"]`);

  it("chip 이 있는 자리만 머리 위에 .mf-vchip.mf-vchip--{tone} 가 그려지고 숫자가 n 이다. 없으면 칩이 없다", () => {
    const { container } = render(
      <DayTable seats={five({ 1: { chip: { n: 3, tone: "pop" } }, 2: { chip: { n: 1, tone: "plain" } }, 3: { chip: { n: 4, tone: "lead" } }, 4: { chip: { n: 2, tone: "beat" } } })} mySeat={0} width={366} height={407} />,
    );
    expect(container.querySelectorAll(".mf-vchip").length).toBe(4);
    expect(chipEl(container, 0)).toBeNull();
    expect(chipEl(container, 1)?.className).toContain("mf-vchip--pop");
    expect(chipEl(container, 1)?.textContent).toBe("3");
    expect(chipEl(container, 2)?.className).toContain("mf-vchip--plain");
    expect(chipEl(container, 3)?.className).toContain("mf-vchip--lead");
    expect(chipEl(container, 4)?.className).toContain("mf-vchip--beat");
    expect(chipEl(container, 4)?.textContent).toBe("2");
  });

  it("칩은 aria-hidden 장식이고 z-index 46(캐릭터 22·어둡게 30 위, 이모티콘 60 아래)이다", () => {
    const { container } = render(<DayTable seats={five({ 1: { chip: { n: 2, tone: "plain" } } })} mySeat={0} width={366} height={407} />);
    const el = chipEl(container, 1)!;
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.style.zIndex).toBe("46");
    expect(el.closest("button")).toBeNull();
  });

  it("폰 폭 4종 × 4~8명: 칩 사각형이 장면 폭 안이고 위는 4 이상이며 chipPlacement 와 같은 위치다", () => {
    for (const w of [320, 360, 390, 430]) {
      for (let count = 4; count <= 8; count++) {
        const seats = Array.from({ length: count }, (_, i) =>
          seat(i, `사람${i}`, { isMe: i === 0, chip: { n: 1 + (i % 3), tone: i % 2 ? "lead" : "plain" } }),
        );
        const { container, unmount } = render(<DayTable seats={seats} mySeat={0} width={w} height={640} />);
        const layout = daySeatLayout(seats, 0, w, 640);
        for (const L of layout) {
          const el = chipEl(container, L.seat)!;
          const tone = seats[L.seat].chip!.tone === "lead" ? "lead" : "normal";
          const rect = chipPlacement({ x: L.x, y: L.y, scale: L.scale }, tone, w, tagBoxesOf(layout));
          expect(el.style.left).toBe(px(rect.left));
          expect(el.style.top).toBe(px(rect.top));
          expect(rect.left).toBeGreaterThanOrEqual(0);
          expect(rect.left + rect.width).toBeLessThanOrEqual(w);
          expect(rect.top).toBeGreaterThanOrEqual(4);
        }
        unmount();
      }
    }
  });

  it("숫자가 오르면 key 가 달라져 새 노드가 된다(팝이 다시 돈다). 같은 숫자면 같은 노드다", () => {
    const view = (n: number) => <DayTable seats={five({ 1: { chip: { n, tone: "pop" } } })} mySeat={0} width={366} height={407} />;
    const { container, rerender } = render(view(1));
    const first = chipEl(container, 1)!;
    rerender(view(1));
    expect(chipEl(container, 1)).toBe(first);
    rerender(view(2));
    const second = chipEl(container, 1)!;
    expect(second).not.toBe(first);
    expect(second.textContent).toBe("2");
  });

  it("CSS: .mf-vchip 기본 + pop·lead·beat, 색은 토큰 변수만, 클릭을 가로채지 않고 모션 줄이기에서 팝이 없다", () => {
    const css = readFileSync("src/styles/verdict.css", "utf8");
    const rule = (sel: string): string => new RegExp(`${sel.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";
    const base = rule(".mf-vchip");
    expect(base).toContain("position: absolute");
    expect(base).toContain("pointer-events: none");
    expect(base).toContain("min-width: 28px");
    expect(base).toContain("border-radius: 7px");
    expect(base).toContain("font-size: 16px");
    expect(base).toContain("var(--gray-100)");
    expect(base).toContain("var(--night-900)");
    expect(rule(".mf-vchip--pop")).toContain("var(--amber-400)");
    expect(rule(".mf-vchip--pop")).toContain("animation");
    const lead = rule(".mf-vchip--lead, .mf-vchip--beat");
    expect(lead).toContain("var(--amber-400)");
    expect(lead).toContain("font-size: 24px");
    expect(lead).toContain("-webkit-text-stroke: 1.4px currentColor");
    expect(lead).toContain("paint-order: stroke fill");
    expect(/@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*\.mf-vchip--pop\s*\{[^}]*animation:\s*none/.test(css)).toBe(true);
    const chipCss = css.slice(css.indexOf(".mf-vchip"));
    expect(/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(chipCss.replace(/box-shadow:[^;]*;/g, ""))).toBe(false);
  });
});

describe("DayTable: 최후 변론 무대 verdict·center (04-21, VOTE-03, D-15·D-29·D-38)", () => {
  const VERDICT = { dimPercent: VERDICT_DIM_PERCENT, blurPx: VERDICT_BLUR_PX };
  const dimEls = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>(".mf-dt__dim"));
  const coneEls = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>(".mf-dt__cone"));
  const withCenter = (n: number, over: Partial<Record<number, Partial<DayTableSeat>>> = {}) => five({ [n]: { center: true, ...over[n] }, ...over });

  it("verdict 가 있으면 .mf-dt__dim--verdict 하나가 그려지고 수치는 CSS 변수(prop 값)로만 내려간다. 루트에 mf-dt--verdict", () => {
    const { container } = render(<DayTable seats={withCenter(2)} mySeat={0} width={366} height={407} verdict={VERDICT} />);
    const dims = dimEls(container);
    expect(dims.length).toBe(1);
    expect(dims[0].classList.contains("mf-dt__dim--verdict")).toBe(true);
    expect(dims[0].getAttribute("aria-hidden")).toBe("true");
    expect(dims[0].style.getPropertyValue("--mf-verdict-dim")).toBe(`${VERDICT_DIM_PERCENT}%`);
    expect(dims[0].style.getPropertyValue("--mf-verdict-blur")).toBe(`${VERDICT_BLUR_PX}px`);
    expect(root(container).classList.contains("mf-dt--verdict")).toBe(true);
  });

  it("값을 바꿔 주면 변수만 바뀐다(숫자는 prop 에서만 온다)", () => {
    const { container } = render(<DayTable seats={withCenter(2)} mySeat={0} width={366} height={407} verdict={{ dimPercent: 30, blurPx: 0 }} />);
    const d = dimEls(container)[0];
    expect(d.style.getPropertyValue("--mf-verdict-dim")).toBe("30%");
    expect(d.style.getPropertyValue("--mf-verdict-blur")).toBe("0px");
  });

  it("verdict 가 없으면 verdict 층도 클래스도 없고, 아침 dim 과 verdict 를 함께 주어도 어둡게 층은 하나(verdict)다", () => {
    const a = render(<DayTable seats={five()} mySeat={0} width={366} height={407} />);
    expect(dimEls(a.container).length).toBe(0);
    expect(root(a.container).classList.contains("mf-dt--verdict")).toBe(false);
    cleanup();
    const b = render(<DayTable seats={five()} mySeat={0} width={366} height={407} dim={{ exitDelayMs: 100 }} />);
    expect(dimEls(b.container).length).toBe(1);
    expect(dimEls(b.container)[0].classList.contains("mf-dt__dim--verdict")).toBe(false);
    cleanup();
    const c = render(<DayTable seats={five()} mySeat={0} width={366} height={407} dim={{ exitDelayMs: 100 }} verdict={VERDICT} />);
    expect(dimEls(c.container).length).toBe(1);
    expect(dimEls(c.container)[0].classList.contains("mf-dt__dim--verdict")).toBe(true);
  });

  it("center 좌석이 있으면 원뿔이 정확히 하나: 폭 300·높이 340, 가로 가운데, 아래끝 = 후보 발 y + 8. DOM 순서로 어둡게 층 뒤", () => {
    const { container } = render(<DayTable seats={withCenter(2)} mySeat={0} width={366} height={407} verdict={VERDICT} />);
    const cones = coneEls(container);
    expect(cones.length).toBe(1);
    const cc = candidateCenter(366, 407, 12);
    expect(cones[0].style.width).toBe(`${CONE_W}px`);
    expect(cones[0].style.height).toBe(`${CONE_H}px`);
    expect(cones[0].style.left).toBe(px(cc.x - CONE_W / 2));
    expect(cones[0].style.top).toBe(px(cc.footY + 8 - CONE_H));
    expect(cones[0].getAttribute("aria-hidden")).toBe("true");
    const kids = Array.from(root(container).children);
    expect(kids.indexOf(cones[0])).toBeGreaterThan(kids.indexOf(dimEls(container)[0]));
  });

  it("center 가 없으면 원뿔이 없다(verdict 만 있어도)", () => {
    const { container } = render(<DayTable seats={five()} mySeat={0} width={366} height={407} verdict={VERDICT} />);
    expect(coneEls(container).length).toBe(0);
    expect(dimEls(container).length).toBe(1);
  });

  it("center 좌석: 그림 상자는 candidateCenter(x = 장면 폭/2, 발 y), 배율 1.7, 이름표는 발 y + 8, z 그림 31·이름표 32", () => {
    const { container } = render(<DayTable seats={withCenter(2)} mySeat={0} width={366} height={407} verdict={VERDICT} />);
    const cc = candidateCenter(366, 407, 12);
    expect(cc.x).toBe(183);
    const el = seatEls(container).find((e) => e.dataset.seat === "2")!;
    expect(el.style.left).toBe(px(cc.x - 36));
    expect(el.style.top).toBe(px(cc.footY - 96));
    expect(el.style.width).toBe("72px");
    expect(el.style.height).toBe("96px");
    expect(el.style.transform).toBe(`scale(${VERDICT_CANDIDATE_SCALE})`);
    expect(el.style.zIndex).toBe("31");
    const tag = tagEl(container, 2);
    expect(tag.style.left).toBe(px(cc.x));
    expect(tag.style.top).toBe(px(cc.tagTop));
    expect(cc.tagTop).toBe(cc.footY + 8);
    expect(tag.style.zIndex).toBe("32");
  });

  it("center 가 없는 좌석은 center 가 없을 때의 좌표와 정확히 같다(이동·확대 없음)", () => {
    const base = render(<DayTable seats={five()} mySeat={0} width={366} height={407} />);
    const baseStyle = new Map(seatEls(base.container).map((e) => [e.dataset.seat, e.getAttribute("style")]));
    const baseTag = new Map([0, 1, 2, 3, 4].map((n) => [n, tagEl(base.container, n).getAttribute("style")]));
    cleanup();
    const { container } = render(<DayTable seats={withCenter(2)} mySeat={0} width={366} height={407} verdict={VERDICT} />);
    for (const e of seatEls(container)) {
      if (e.dataset.seat === "2") continue;
      expect(e.getAttribute("style")).toBe(baseStyle.get(e.dataset.seat));
    }
    for (const n of [0, 1, 3, 4]) expect(tagEl(container, n).getAttribute("style")).toBe(baseTag.get(n));
  });

  it("z 순서: 후보 그림 31 > 어둡게 층 30 > 다른 좌석 최대 22 > 이름표 최대 11, 후보 이름표 32, 이모티콘 60+ (UI-SPEC 12)", () => {
    const seats = withCenter(2, { 3: { emoji: { key: "e1", icon: "heart", z: 1 } }, 2: { center: true, emoji: { key: "e2", icon: "heart", z: 2 } } });
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} height={407} verdict={VERDICT} />);
    const z = (el: HTMLElement) => Number(el.style.zIndex);
    const figs = seatEls(container);
    const others = figs.filter((e) => e.dataset.seat !== "2").map(z);
    expect(Math.max(...others)).toBeLessThanOrEqual(22);
    expect(z(figs.find((e) => e.dataset.seat === "2")!)).toBe(31);
    expect(30).toBeGreaterThan(Math.max(...others));
    expect(z(dimEls(container)[0]) || 30).toBe(30);
    const emojis = Array.from(container.querySelectorAll<HTMLElement>(".mf-dt__emoji"));
    expect(emojis.length).toBe(2);
    for (const e of emojis) expect(z(e)).toBeGreaterThanOrEqual(60);
  });

  it("후보 이모티콘은 후보 머리 위로 따라간다(발 y − 163.2 − 36)", () => {
    const seats = withCenter(2, { 2: { center: true, emoji: { key: "e2", icon: "heart", z: 2 } } });
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} height={407} verdict={VERDICT} />);
    const cc = candidateCenter(366, 407, 12);
    const em = container.querySelector<HTMLElement>('.mf-dt__emoji[data-seat="2"]')!;
    expect(em.style.left).toBe(px(cc.x - 16));
    expect(em.style.top).toBe(px(Math.max(0, cc.footY - 96 * VERDICT_CANDIDATE_SCALE - 36)));
  });

  it("폰 폭 4종 × 장면 높이 2종: 후보 이름표 아래끝 ≤ 장면 아래 − 4, 그림 상자는 장면 폭 안, z 순서 유지", () => {
    for (const [w, pad] of [[320, 4], [352, 4], [366, 12], [406, 12]] as const) {
      for (const h of [300, 640]) {
        const { container, unmount } = render(<DayTable seats={withCenter(2)} mySeat={0} width={w} height={h} scenePad={pad} verdict={VERDICT} />);
        const tag = tagEl(container, 2);
        const bottom = Number.parseFloat(tag.style.top) + 22;
        expect(bottom).toBeLessThanOrEqual(h - 4);
        const fig = seatEls(container).find((e) => e.dataset.seat === "2")!;
        const left = Number.parseFloat(fig.style.left);
        const half = (72 * VERDICT_CANDIDATE_SCALE) / 2;
        expect(left + 36 - half).toBeGreaterThanOrEqual(0);
        expect(left + 36 + half).toBeLessThanOrEqual(w);
        expect(Number(fig.style.zIndex)).toBe(31);
        expect(Number(tag.style.zIndex)).toBe(32);
        unmount();
      }
    }
  });

  it("후보 연결 끊김: 그림에 끊김 클래스 + 흰 후광이 함께 붙는다(흑백 먼저, 후광은 그 뒤)", () => {
    const seats = withCenter(2, { 2: { center: true, connected: false, halo: "white" } });
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} height={407} verdict={VERDICT} />);
    const img = container.querySelector<HTMLElement>('.mf-dt__seat[data-seat="2"] img')!;
    expect(img.classList.contains("mf-figure--disconnected")).toBe(true);
    expect(img.classList.contains("mf-figure--halo-white")).toBe(true);
  });

  it("verdict.css: 어둡게 층(색 45% 변수 혼합·backdrop-filter 비접두 한 번, 접두는 빌드가)·원뿔(clip-path·그라데이션)·이동 전이 600ms ease-in-out·헤더/패널 z 3·축소 모션", () => {
    const css = readFileSync("src/styles/verdict.css", "utf8");
    const rule = (sel: string): string => new RegExp(`${sel.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";
    const dim = rule(".mf-dt__dim--verdict");
    expect(dim).toContain("color-mix(in srgb, var(--night-900) var(--mf-verdict-dim), transparent)");
    expect(dim).toContain("backdrop-filter: blur(var(--mf-verdict-blur))");
    // 접두 선언은 소스에 쓰지 않는다 — 손으로 짝지으면 빌드(lightningcss)가 접두만 남긴다(04-35). 접두는 빌드가 붙인다
    expect(dim).not.toMatch(/^\s*-webkit-backdrop-filter:/m);
    // z 30·클릭 통과는 아침 층과 공유하는 기본 규칙(.mf-dt__dim)에서 온다. 등장은 opacity 만 쓰는 400ms 페이드
    const base = /\.mf-dt__dim\s*\{([^}]*)\}/.exec(readFileSync("src/styles/daytable.css", "utf8"))?.[1] ?? "";
    expect(base).toContain("z-index: 30");
    expect(base).toContain("pointer-events: none");
    expect(dim).toContain("mf-vd-in 400ms");
    expect(css).toMatch(/@keyframes mf-vd-in\s*\{\s*from\s*\{\s*opacity:\s*0;\s*\}\s*to\s*\{\s*opacity:\s*1;\s*\}\s*\}/);
    const cone = rule(".mf-dt__cone");
    expect(cone).toContain("clip-path: polygon(41% 0, 59% 0, 100% 100%, 0 100%)");
    expect(cone).toContain("var(--cone-light)");
    expect(cone).toContain("55%");
    expect(cone).toContain("20%");
    expect(cone).toContain("z-index: 30");
    expect(cone).toContain("pointer-events: none");
    const move = `${VERDICT_MOVE_MS}ms ease-in-out`;
    const seatMove = rule(".mf-dt--verdict .mf-dt__seat");
    expect(seatMove).toContain(`left ${move}`);
    expect(seatMove).toContain(`top ${move}`);
    expect(seatMove).toContain(`transform ${move}`);
    expect(rule(".mf-dt--verdict .mf-dt__tag")).toContain(`left ${move}`);
    expect(css).toMatch(/\.mf-dayscene--verdict[^{]*\{[^}]*position: relative;[^}]*z-index: 3/);
    expect(/@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*\.mf-dt--verdict \.mf-dt__seat[^{]*\{[^}]*transition:\s*none/.test(css)).toBe(true);
    const verdictCss = css.slice(css.indexOf(".mf-dt__dim--verdict"));
    expect(/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(verdictCss)).toBe(false);
  });
});

// ---- 04-23: 처형 — 사람 → 유령 400ms 전환 (VOTE-04, D-06, D-16, UI-SPEC 8.5) ----
describe("DayTable: executed 좌석의 사람 → 유령 전환", () => {
  const imgsOf = (c: HTMLElement, n: number) => Array.from(seatEl(c, n).querySelectorAll<HTMLImageElement>("img.mf-figure"));
  const advanceBy = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  it("dead + executed: 사람 층과 유령 층 이미지가 둘 다 있고 유령 층 src 가 /characters/ghost/ 를 가리킨다", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<DayTable seats={five({ 2: { dead: true, executed: true } })} mySeat={0} width={366} />);
      const imgs = imgsOf(container, 2);
      expect(imgs.length).toBe(2);
      const ghost = imgs.find((i) => i.classList.contains("mf-figure--exec-in"))!;
      const human = imgs.find((i) => i.classList.contains("mf-figure--exec-out"))!;
      expect(ghost.getAttribute("src")).toContain("/characters/ghost/");
      expect(ghost.classList.contains("mf-figure--ghost")).toBe(true);
      expect(human.getAttribute("src")).not.toContain("/characters/ghost/");
      expect(human.classList.contains("mf-figure--ghost")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("후광 클래스는 유령 층에만 정확히 하나다(사람 층에는 없다)", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<DayTable seats={five({ 2: { dead: true, executed: true, halo: "white" } })} mySeat={0} width={366} />);
      const imgs = imgsOf(container, 2);
      const haloed = imgs.filter((i) => /mf-figure--halo-/.test(i.className));
      expect(haloed.length).toBe(1);
      expect(haloed[0]!.classList.contains("mf-figure--exec-in")).toBe(true);
      expect(container.querySelectorAll('img[class*="mf-figure--halo"]').length).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("GHOST_FADE_MS(400) 뒤 사람 층이 사라지고 유령 한 장만 남는다 (399ms 에는 아직 둘)", () => {
    vi.useFakeTimers();
    try {
      expect(GHOST_FADE_MS).toBe(400);
      const { container } = render(<DayTable seats={five({ 2: { dead: true, executed: true, halo: "white" } })} mySeat={0} width={366} />);
      advanceBy(GHOST_FADE_MS - 1);
      expect(imgsOf(container, 2).length).toBe(2);
      advanceBy(1);
      const left = imgsOf(container, 2);
      expect(left.length).toBe(1);
      expect(left[0]!.classList.contains("mf-figure--ghost")).toBe(true);
      expect(left[0]!.classList.contains("mf-figure--halo-white")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("executed 가 없으면 유령 한 장(기존)이고, dead 가 아니면 executed 만으로 두 층이 되지 않는다", () => {
    const a = render(<DayTable seats={five({ 2: { dead: true } })} mySeat={0} width={366} />);
    expect(imgsOf(a.container, 2).length).toBe(1);
    expect(imgsOf(a.container, 2)[0]!.classList.contains("mf-figure--exec-in")).toBe(false);
    cleanup();
    const b = render(<DayTable seats={five({ 2: { executed: true } })} mySeat={0} width={366} />);
    expect(imgsOf(b.container, 2).length).toBe(1);
    expect(imgsOf(b.container, 2)[0]!.classList.contains("mf-figure--ghost")).toBe(false);
  });

  it("이름표는 dead 면 탈락 표시(mf-dt__tag--dead)이고, 언마운트 때 타이머가 정리된다", () => {
    vi.useFakeTimers();
    try {
      const { container, unmount } = render(<DayTable seats={five({ 2: { dead: true, executed: true } })} mySeat={0} width={366} />);
      expect(tagEl(container, 2).classList.contains("mf-dt__tag--dead")).toBe(true);
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("verdict.css: mf-exec-out(투명 1 → .35)·mf-exec-in(투명 0 → .9, 개별 속성 translate 아래 18px → 0)·축소 모션은 떠오름 없음", () => {
    const css = readFileSync("src/styles/verdict.css", "utf8");
    const kf = (name: string): string => {
      const at = css.indexOf(`@keyframes ${name} {`);
      if (at < 0) return "";
      let depth = 0;
      for (let k = css.indexOf("{", at); k < css.length; k++) {
        if (css[k] === "{") depth++;
        else if (css[k] === "}" && --depth === 0) return css.slice(at, k + 1);
      }
      return "";
    };
    const out = kf("mf-exec-out");
    expect(out).toMatch(/opacity:\s*1/);
    expect(out).toMatch(/opacity:\s*0?\.35/);
    const inn = kf("mf-exec-in");
    expect(inn).toMatch(/opacity:\s*0\b/);
    expect(inn).toMatch(/opacity:\s*0?\.9\b/);
    expect(inn).toMatch(/translate:\s*0 18px/);
    expect(inn).toMatch(/translate:\s*0 0|translate:\s*0\b/);
    expect(inn).not.toMatch(/transform/);
    expect(css).toMatch(/\.mf-figure--exec-out[^{]*\{[^}]*animation:\s*mf-exec-out 400ms/);
    expect(css).toMatch(/\.mf-figure--exec-in[^{]*\{[^}]*animation:\s*mf-exec-in 400ms/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*mf-exec-in-fade/);
  });
});
