import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { HousePick } from "../../src/components/v2/HousePick";
import type { HousePickProps, HousePlateView } from "../../src/components/v2/HousePick";

// 21-12 Task 1 (D-10·D-25, P21-9): 밤 집 판. 네 역할이 같은 판이다 — 부품에는 역할 prop 이 없고 마피아 합의 배지는 쓰는 쪽이 줄 때만 DOM 에 있다(0074).
afterEach(cleanup);

const V2_CSS = readFileSync("src/styles/v2.css", "utf8");
const SRC = readFileSync("src/components/v2/HousePick.tsx", "utf8");

const NAMES = ["민수", "영희", "서준", "지아", "도윤", "하은", "유진", "태오"];
const plate = (seat: number, me = false, x = 60 + seat * 40, y = 100 + seat * 10): HousePlateView => ({
  seat,
  name: NAMES[seat] ?? `p${seat}`,
  img: `/characters/face-${seat}.png`,
  color: `var(--seat-${seat + 1})`,
  me,
  x,
  y,
});
const four = (): HousePlateView[] => [plate(0), plate(1), plate(3, true), plate(5)];
const props = (over: Partial<HousePickProps> = {}): HousePickProps => ({ plates: four(), ...over });
const all = (c: ParentNode): HTMLElement[] => Array.from(c.querySelectorAll<HTMLElement>("[data-house-pick]"));
const of = (c: ParentNode, seat: number): HTMLElement => c.querySelector<HTMLElement>(`[data-house-pick="${seat}"]`)!;

describe("HousePick: 판 구성 (P21-9)", () => {
  it("판 넷이면 button 넷, data-house-pick 값이 좌석이다", () => {
    const { container } = render(<HousePick {...props()} />);
    const list = all(container);
    expect(list.map((b) => b.tagName).join(",")).toBe("BUTTON,BUTTON,BUTTON,BUTTON");
    expect(list.map((b) => b.getAttribute("data-house-pick")).join(",")).toBe("0,1,3,5");
  });

  it("내 판만 data-me 와 접근성 이름 '나의 집 고르기', 남의 판은 '{닉네임} 님의 집 고르기'", () => {
    const { container } = render(<HousePick {...props()} />);
    expect(all(container).filter((b) => b.hasAttribute("data-me")).map((b) => b.getAttribute("data-house-pick")).join(",")).toBe("3");
    expect(of(container, 3).getAttribute("aria-label")).toBe("나의 집 고르기");
    expect(of(container, 0).getAttribute("aria-label")).toBe("민수 님의 집 고르기");
    expect(of(container, 5).getAttribute("aria-label")).toBe("하은 님의 집 고르기");
  });

  it("내 판은 같은 크기·같은 모양에 8px 점 하나만 더 있다(다른 판에는 점 0)", () => {
    const { container } = render(<HousePick {...props()} />);
    expect(container.querySelectorAll("[data-house-me-dot]").length).toBe(1);
    expect(of(container, 3).querySelector("[data-house-me-dot]")).not.toBeNull();
    expect(of(container, 3).className).toBe(of(container, 0).className);
  });

  it("판 위치는 화면 좌표(left·top)로 받는다", () => {
    const { container } = render(<HousePick {...props()} />);
    expect(of(container, 1).style.left).toBe("100px");
    expect(of(container, 1).style.top).toBe("110px");
  });

  it("좌표가 아직 없는 판은 DOM 에는 있으나 보이지 않고 눌리지 않는다", () => {
    const p: HousePlateView = { seat: 2, name: "서준", img: "/x.png", color: "var(--seat-3)", me: false };
    const { container } = render(<HousePick plates={[p]} />);
    expect(of(container, 2).getAttribute("data-house-off")).toBe("");
  });

  it("판 층은 role=group 이고 닉네임은 텍스트 노드·aria-label 로만 그린다(innerHTML 없음)", () => {
    const { container } = render(<HousePick {...props()} />);
    expect(container.querySelector("[data-house-layer]")!.getAttribute("role")).toBe("group");
    expect(SRC).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
  });
});

describe("HousePick: 고른 표시·빛남 (D-10)", () => {
  it("value 가 없으면 모든 판이 data-call·is-call, 눌린 판은 없다", () => {
    const { container } = render(<HousePick {...props({ call: true })} />);
    for (const b of all(container)) {
      expect(b.hasAttribute("data-call")).toBe(true);
      expect(b.classList.contains("is-call")).toBe(true);
      expect(b.getAttribute("aria-pressed")).toBe("false");
    }
  });

  it("call 이 없으면(고르는 때가 아님) 빛도 없다", () => {
    const { container } = render(<HousePick {...props()} />);
    expect(all(container).some((b) => b.hasAttribute("data-call"))).toBe(false);
  });

  it("value 1 이면 판 1 만 aria-pressed true 이고 is-on, 빛은 모두 꺼진다(call 이 있어도 고른 뒤에는 멎는다)", () => {
    const { container } = render(<HousePick {...props({ value: 1, call: true })} />);
    expect(all(container).filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.getAttribute("data-house-pick")).join(",")).toBe("1");
    expect(of(container, 1).classList.contains("is-on")).toBe(true);
    expect(all(container).some((b) => b.hasAttribute("data-call"))).toBe(false);
  });
});

describe("HousePick: 최근접 누르기 (P21-9)", () => {
  const layer = (c: ParentNode): HTMLElement => c.querySelector<HTMLElement>("[data-house-layer]")!;

  it("판 1 중심 + (10, 10) 을 누르면 onPick(1)", () => {
    const onPick = vi.fn();
    const { container } = render(<HousePick {...props({ onPick })} />);
    fireEvent.pointerUp(layer(container), { clientX: 100 + 10, clientY: 110 + 10 });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(1);
  });

  it("모든 판에서 28 밖이면 부르지 않는다", () => {
    const onPick = vi.fn();
    const { container } = render(<HousePick {...props({ onPick })} />);
    fireEvent.pointerUp(layer(container), { clientX: 100, clientY: 110 + 29 });
    fireEvent.pointerUp(layer(container), { clientX: 5, clientY: 5 });
    expect(onPick).not.toHaveBeenCalled();
  });

  it("두 판 사이를 누르면 가까운 쪽 하나만 고른다", () => {
    const onPick = vi.fn();
    const { container } = render(<HousePick plates={[plate(0, false, 100, 100), plate(1, false, 140, 100)]} onPick={onPick} />);
    fireEvent.pointerUp(layer(container), { clientX: 125, clientY: 100 });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(1);
  });

  it("이미 고른 판을 다시 누르면 부르지 않는다(취소·변화 없음)", () => {
    const onPick = vi.fn();
    const { container } = render(<HousePick {...props({ onPick, value: 1 })} />);
    fireEvent.pointerUp(layer(container), { clientX: 100, clientY: 110 });
    expect(onPick).not.toHaveBeenCalled();
    // 다른 집으로는 옮겨 간다
    fireEvent.pointerUp(layer(container), { clientX: 60, clientY: 100 });
    expect(onPick).toHaveBeenCalledWith(0);
  });

  it("누른 자리는 층 안쪽 좌표로 바꿔 계산한다(층이 화면 왼쪽 위에서 떨어져 있어도)", () => {
    const onPick = vi.fn();
    const { container } = render(<HousePick {...props({ onPick })} />);
    const el = layer(container);
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({ left: 30, top: 50, right: 390, bottom: 800, width: 360, height: 750, x: 30, y: 50, toJSON: () => ({}) });
    fireEvent.pointerUp(el, { clientX: 30 + 100, clientY: 50 + 110 });
    expect(onPick).toHaveBeenCalledWith(1);
  });

  it("손가락 눌림 뒤 따라오는 click 은 한 번 더 보내지 않는다, 보조 기술의 click 은 그 판을 고른다", () => {
    const onPick = vi.fn();
    const { container } = render(<HousePick {...props({ onPick })} />);
    fireEvent.pointerUp(of(container, 1), { clientX: 100, clientY: 110 });
    fireEvent.click(of(container, 1));
    expect(onPick).toHaveBeenCalledTimes(1);
    vi.useFakeTimers({ now: Date.now() + 5_000 });
    try {
      act(() => {
        vi.advanceTimersByTime(5_000);
      });
      fireEvent.click(of(container, 5));
      expect(onPick).toHaveBeenCalledTimes(2);
      expect(onPick).toHaveBeenLastCalledWith(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it("disabled 이면 모든 판이 aria-disabled 이고 눌러도 보내지 않는다", () => {
    const onPick = vi.fn();
    const { container } = render(<HousePick {...props({ onPick, disabled: true })} />);
    for (const b of all(container)) expect(b.getAttribute("aria-disabled")).toBe("true");
    fireEvent.pointerUp(layer(container), { clientX: 100, clientY: 110 });
    fireEvent.click(of(container, 1));
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe("HousePick: 마피아 합의 배지·얼굴 그림 (0074)", () => {
  it("tally·sure 를 주면 배지(mv-face__count)가 있고, 안 주면 그 칸이 DOM 에 없다", () => {
    const withTally = render(<HousePick {...props({ tally: new Map([[1, 2]]), sure: 3 })} />);
    const counts = Array.from(withTally.container.querySelectorAll(".mv-face__count"));
    expect(counts.length).toBe(2);
    expect(of(withTally.container, 1).querySelector(".mv-face__count")!.textContent).toBe("2");
    expect(of(withTally.container, 3).querySelector(".mv-face__count")!.getAttribute("aria-label")).toBe("확정");
    cleanup();
    const without = render(<HousePick {...props()} />);
    expect(without.container.querySelectorAll(".mv-face__count").length).toBe(0);
  });

  it("같은 입력이면 같은 DOM 이다(역할 prop 이 없다) — 배지 칸을 빼면 배지 없는 화면과 같다", () => {
    const a = render(<HousePick {...props()} />).container.innerHTML;
    cleanup();
    const b = render(<HousePick {...props()} />).container.innerHTML;
    expect(a).toBe(b);
    cleanup();
    const badged = render(<HousePick {...props({ tally: new Map([[1, 1]]) })} />).container.innerHTML;
    expect(badged.replace(/<span class="mv-face__count">[^<]*<\/span>/g, "")).toBe(a);
  });

  it("얼굴 그림이 안 뜨면(onError) 그 판만 좌석색 원으로 바뀐다", () => {
    const { container } = render(<HousePick {...props()} />);
    const img = of(container, 0).querySelector("img")!;
    expect(of(container, 1).querySelector("img")).not.toBeNull();
    fireEvent.error(img);
    expect(of(container, 0).querySelector("img")).toBeNull();
    const dot = of(container, 0).querySelector<HTMLElement>(".mv-house-pick__fallback i")!;
    expect(dot.style.background).toBe("var(--seat-1)");
    expect(of(container, 1).querySelector("img")).not.toBeNull();
  });

  it("부품 소스는 역할·서버 전용 낱말을 읽지 않고 hex 색도 쓰지 않는다", () => {
    expect(SRC).not.toMatch(/\.role\b|\brole\??:|allies|nightTally|nightSure|\bmafia\b|\bpolice\b|\bdoctor\b|#[0-9a-fA-F]{3,6}\b/);
  });
});

describe("HousePick: 스타일 계약 (P21-9, 토큰만)", () => {
  const rule = (sel: string): string => V2_CSS.match(new RegExp(`${sel.replace(/[.[\]"=-]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

  it("판은 40×40·--gray-800 면·2px --gray-500 윤곽·모서리 8", () => {
    const r = rule(".mv-house-pick__plate");
    expect(r).toMatch(/width: 40px/);
    expect(r).toMatch(/height: 40px/);
    expect(r).toMatch(/background: var\(--gray-800\)/);
    expect(r).toMatch(/border: 2px solid var\(--gray-500\)/);
    expect(r).toMatch(/border-radius: var\(--radius-sm\)/);
  });

  it("고른 판은 3px --light-lamp 테두리와 0 0 14px 2px 빛", () => {
    const r = rule(".mv-house-pick__plate.is-on");
    expect(r).toMatch(/border: 3px solid var\(--light-lamp\)/);
    expect(r).toMatch(/0 0 14px 2px/);
  });

  it("내 집 점은 8px --gray-100, 얼굴은 26", () => {
    expect(rule(".mv-house-pick__me")).toMatch(/width: 8px[^}]*height: 8px[^}]*background: var\(--gray-100\)/);
    expect(rule(".mv-house-pick__img")).toMatch(/width: 26px/);
  });

  it("판 규칙에는 hex 가 없다", () => {
    const block = V2_CSS.slice(V2_CSS.indexOf(".mv-house-pick"), V2_CSS.indexOf(".mv-errand-pin {"));
    expect(block.length).toBeGreaterThan(0);
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});
