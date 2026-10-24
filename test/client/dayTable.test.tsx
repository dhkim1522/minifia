import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

// ---- 02-14 Task 2: 이름표 아랫줄 ----
const claimEl = (c: HTMLElement, n: number) => tagEl(c, n).querySelector<HTMLElement>(".mf-dt__claim");

describe("DayTable: 이름표 아랫줄 (결정 0017-3·0017-6)", () => {
  it("row wait 은 아랫줄 '…' (클래스 --wait)", () => {
    const { container } = render(<DayTable seats={five({ 1: { row: { kind: "wait" } } })} mySeat={0} width={366} />);
    expect(claimEl(container, 1)?.textContent).toBe("…");
    expect(claimEl(container, 1)?.classList.contains("mf-dt__claim--wait")).toBe(true);
  });

  it("row done 은 '완료' 와 체크 svg 하나 (클래스 --done)", () => {
    const { container } = render(<DayTable seats={five({ 1: { row: { kind: "done" } } })} mySeat={0} width={366} />);
    const el = claimEl(container, 1);
    expect(el?.textContent).toBe("완료");
    expect(el?.querySelectorAll("svg").length).toBe(1);
    expect(el?.classList.contains("mf-dt__claim--done")).toBe(true);
  });

  it("row claim police 는 '경찰', none 은 '-' (클래스 --none)", () => {
    const rows = {
      1: { row: { kind: "claim", job: "police", changed: false, pop: false } },
      2: { row: { kind: "claim", job: "none", changed: false, pop: false } },
    } as const;
    const { container } = render(<DayTable seats={five({ 1: rows[1], 2: rows[2] })} mySeat={0} width={366} />);
    expect(claimEl(container, 1)?.textContent).toBe("경찰");
    expect(claimEl(container, 2)?.textContent).toBe("-");
    expect(claimEl(container, 2)?.classList.contains("mf-dt__claim--none")).toBe(true);
    expect(claimEl(container, 1)?.classList.contains("mf-dt__claim--none")).toBe(false);
  });

  it.each([
    ["mafia", "마피아"],
    ["police", "경찰"],
    ["doctor", "의사"],
    ["citizen", "시민"],
  ] as const)("직업 이름은 잘리지 않는다: %s → %s", (job, text) => {
    const { container } = render(
      <DayTable seats={five({ 1: { row: { kind: "claim", job, changed: false, pop: false } } })} mySeat={0} width={366} />,
    );
    expect(claimEl(container, 1)?.textContent).toBe(text);
  });

  it("pop true 인 자리에만 클래스 --pop 이 있다", () => {
    const seats = five({
      1: { row: { kind: "claim", job: "mafia", changed: false, pop: true } },
      2: { row: { kind: "claim", job: "citizen", changed: false, pop: false } },
    });
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} />);
    expect(claimEl(container, 1)?.classList.contains("mf-dt__claim--pop")).toBe(true);
    expect(claimEl(container, 2)?.classList.contains("mf-dt__claim--pop")).toBe(false);
  });

  it("row null 이면 아랫줄 요소가 없다", () => {
    const { container } = render(<DayTable seats={five()} mySeat={0} width={366} />);
    expect(container.querySelectorAll(".mf-dt__claim").length).toBe(0);
  });

  it("자리 접근성 이름: done 이면 ', 선택 완료', claim 이면 ', 직업 주장 경찰' / ', 직업 주장 말 안 함'", () => {
    const seats = five({
      1: { row: { kind: "done" } },
      2: { row: { kind: "claim", job: "police", changed: false, pop: false } },
      3: { row: { kind: "claim", job: "none", changed: false, pop: false } },
    });
    render(<DayTable seats={seats} mySeat={0} width={366} />);
    expect(screen.getByRole("group", { name: "가나다라마, 선택 완료" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "지호, 직업 주장 경찰" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "하늘, 직업 주장 말 안 함" })).toBeTruthy();
  });

  it("동료가 아닌 자리에는 진홍(crimson)이 렌더 HTML 에 없다", () => {
    const seats = five({ 1: { row: { kind: "claim", job: "mafia", changed: true, pop: true } } });
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} />);
    expect(container.innerHTML.includes("crimson")).toBe(false);
  });
});

// CSS 는 정규식으로 한 줄 결과(true/false)만 단언한다 — toMatch 는 실패 때 CSS 전체를 보고서에 쏟아 TAP 을 깨뜨린다.
const cssHas = (css: string, re: RegExp): boolean => re.test(css);

describe("daytable.css: 아랫줄 상태", () => {
  const css = readFileSync("src/styles/daytable.css", "utf8");
  it(".mf-dt__claim--done 은 바탕 var(--gray-100)·글자 var(--night-900) (반전)", () => {
    expect(cssHas(css, /\.mf-dt__claim--done\s*\{[^}]*background:\s*var\(--gray-100\)/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__claim--done\s*\{[^}]*color:\s*var\(--night-900\)/)).toBe(true);
  });
  it(".mf-dt__claim--pop 의 animation 에 팝·흔들림 두 키프레임 이름이 있다", () => {
    expect(cssHas(css, /\.mf-dt__claim--pop\s*\{[^}]*animation:[^;]*mf-dt-pop/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__claim--pop\s*\{[^}]*animation:[^;]*mf-dt-shake/)).toBe(true);
    expect(cssHas(css, /@keyframes mf-dt-pop/)).toBe(true);
    expect(cssHas(css, /@keyframes mf-dt-shake/)).toBe(true);
  });
  it("축소 모션 미디어 규칙이 --pop 애니메이션을 끈다", () => {
    expect(cssHas(css, /prefers-reduced-motion: reduce\)\s*\{[^@]*?\.mf-dt__claim--pop\s*\{[^}]*animation:\s*none/)).toBe(true);
  });
});

describe("claimName (src/game/roleText.ts 가 단일 출처)", () => {
  it("none 은 '말 안 함', police 는 '경찰'", () => {
    expect(claimName("none")).toBe("말 안 함");
    expect(claimName("police")).toBe("경찰");
  });
});

// ---- 02-14 Task 3: 배지·링·동료·보낸 사람 반전·머리 위 이모티콘 ----
const seatEl = (c: HTMLElement, n: number) => c.querySelector<HTMLElement>(`.mf-dt__seat[data-seat="${n}"]`)!;
const changedClaim = { kind: "claim", job: "mafia", changed: true, pop: false } as const;

describe("DayTable: 말 바꿈 ↺ 배지 (결정 0017-3)", () => {
  it("changed true 인 자리의 아랫줄 안에만 .mf-dt__chg[role=img][aria-label=말 바꿈] 이 있고 svg 를 담는다", () => {
    const seats = five({ 1: { row: changedClaim }, 2: { row: { kind: "claim", job: "police", changed: false, pop: false } } });
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} />);
    const chg = container.querySelectorAll<HTMLElement>(".mf-dt__chg");
    expect(chg.length).toBe(1);
    expect(chg[0]?.getAttribute("role")).toBe("img");
    expect(chg[0]?.getAttribute("aria-label")).toBe("말 바꿈");
    expect(chg[0]?.querySelectorAll("svg").length).toBe(1);
    expect(chg[0]?.closest(".mf-dt__claim")?.parentElement?.getAttribute("data-seat")).toBe("1");
  });

  it("자리 접근성 이름 끝에 ', 말 바꿈'", () => {
    render(<DayTable seats={five({ 1: { row: changedClaim } })} mySeat={0} width={366} />);
    expect(screen.getByRole("group", { name: "가나다라마, 직업 주장 마피아, 말 바꿈" })).toBeTruthy();
  });
});

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

  it("끊긴 자리의 그림은 mf-figure--disconnected 이고 아랫줄(주장)은 그대로 있다", () => {
    const seats = five({ 2: { connected: false, row: { kind: "claim", job: "citizen", changed: false, pop: false } } });
    const { container } = render(<DayTable seats={seats} mySeat={0} width={366} />);
    expect(seatEl(container, 2).querySelector("img")?.classList.contains("mf-figure--disconnected")).toBe(true);
    expect(seatEl(container, 1).querySelector("img")?.classList.contains("mf-figure--disconnected")).toBe(false);
    expect(claimEl(container, 2)?.textContent).toBe("시민");
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
  it.each(["changed", "crown", "chevronUp"])("%s 는 24×24 viewBox svg 로 그려진다", (name) => {
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
  it(".mf-dt__crown 은 22px, .mf-dt__chg 는 18px", () => {
    expect(cssHas(css, /\.mf-dt__crown\s*\{[^}]*width:\s*22px/)).toBe(true);
    expect(cssHas(css, /\.mf-dt__chg\s*\{[^}]*width:\s*18px/)).toBe(true);
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
