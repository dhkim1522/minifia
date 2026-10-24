import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { DayTable } from "../../src/components/DayTable";
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
