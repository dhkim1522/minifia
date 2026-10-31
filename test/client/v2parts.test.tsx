import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { ActionButton, ActionRow } from "../../src/components/ActionButton";
import { DotProgress } from "../../src/components/v2/DotProgress";
import { HeadStack, NameTag } from "../../src/components/v2/HeadStack";
import { PhaseHeader } from "../../src/components/v2/PhaseHeader";
import { TopToast, useTopToast } from "../../src/components/v2/TopToast";
import { V2Icon } from "../../src/components/v2/V2Icon";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// 06-12: 승인 v2.0 부품(design/v2.0/design-system/components/bundle.js)을 React 19 로 옮긴 DOM 부품.
// happy-dom 은 글자 폭을 재지 못한다(가정 A1). 실제 폭·잘림은 06-17 E2E 가 폰 6종에서 잰다.
// 여기서는 말줄임이 없다는 스타일 계약(nowrap·max-width 없음·ellipsis 없음)과 마크업을 고정한다.

const V2_CSS = readFileSync("src/styles/v2.css", "utf8");

// 주석을 지운 규칙 본문 중 선택자에 `selector` 가 들어 있는 것만 모은다.
function rulesFor(css: string, selector: string): string[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => (m[1] ?? "").split(",").some((s) => s.trim().startsWith(selector)))
    .map((m) => m[2] ?? "");
}

describe("NameTag (MAP-07, MAP-01)", () => {
  it("전각 8자 + (나) 를 .mv-tag.is-me 로 한 글자도 줄이지 않고 그린다", () => {
    const { container } = render(<NameTag name="가나다라마바사아" color="var(--seat-3)" me />);
    const tag = container.querySelector("span.mv-tag");
    expect(tag?.classList.contains("is-me")).toBe(true);
    expect(tag?.querySelector(".mv-tag__name")?.textContent).toBe("가나다라마바사아 (나)");
  });

  it("점은 자리 구분색을 background 로 가진다", () => {
    const { container } = render(<NameTag name="철수" color="var(--seat-3)" />);
    const dot = container.querySelector(".mv-tag__dot") as HTMLElement | null;
    expect(dot?.getAttribute("style")).toContain("var(--seat-3)");
  });

  it("away 는 .is-away, me 가 아니면 (나) 가 없다", () => {
    const { container } = render(<NameTag name="철수" color="var(--seat-1)" away />);
    const tag = container.querySelector("span.mv-tag");
    expect(tag?.classList.contains("is-away")).toBe(true);
    expect(tag?.classList.contains("is-me")).toBe(false);
    expect(tag?.textContent).not.toContain("(나)");
  });

  it("끊긴 나도 그려진다: is-me 와 is-away 가 함께 붙는다", () => {
    const { container } = render(<NameTag name="가나다라마바사아" color="var(--seat-8)" me away />);
    const tag = container.querySelector("span.mv-tag");
    expect(tag?.classList.contains("is-me") && tag.classList.contains("is-away")).toBe(true);
    expect(tag?.textContent).toBe("가나다라마바사아 (나)");
  });

  it("닉네임에 HTML 이 들어 있어도 글자 그대로이고 요소가 생기지 않는다 (T-06-26)", () => {
    const { container } = render(<NameTag name="<b>x</b>" color="var(--seat-1)" />);
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector(".mv-tag__name")?.textContent).toBe("<b>x</b>");
  });
});

describe("HeadStack", () => {
  it("div.mv-head 안에 span.mv-tag 하나", () => {
    const { container } = render(<HeadStack name="철수" color="var(--seat-1)" />);
    const head = container.querySelector("div.mv-head");
    expect(head).not.toBeNull();
    expect(head?.children.length).toBe(1);
    expect(head?.firstElementChild?.matches("span.mv-tag")).toBe(true);
  });
});

describe("V2Icon", () => {
  it("label 이 없으면 aria-hidden svg", () => {
    const { container } = render(<V2Icon name="crown" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("role")).toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
  });

  it("label 을 주면 role img 와 aria-label", () => {
    const { container } = render(<V2Icon name="crown" label="방장" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe("방장");
    expect(svg?.getAttribute("aria-hidden")).toBeNull();
  });

  it.each(["point", "crown", "play", "check", "roleCitizen"] as const)("%s 는 그림 요소를 가진다", (name) => {
    const { container } = render(<V2Icon name={name} />);
    expect(container.querySelectorAll("svg path, svg circle").length).toBeGreaterThan(0);
  });
});

describe("v2.css 이름표 스타일 계약 (MAP-07, 결정 0052-2)", () => {
  it(".mv-tag 규칙은 nowrap 이고 max-width·overflow hidden·ellipsis 가 없다", () => {
    const bodies = rulesFor(V2_CSS, ".mv-tag").join(";");
    expect(bodies).toContain("white-space: nowrap");
    expect(bodies).not.toMatch(/max-width/);
    expect(bodies).not.toMatch(/overflow\s*:\s*hidden/);
    expect(bodies).not.toMatch(/text-overflow/);
  });

  it("파일 어디에도 ellipsis 가 없다", () => {
    expect(V2_CSS).not.toContain("ellipsis");
  });

  it("승인 치수: 안쪽 2px 8px, 점 8×8, 점과 이름 6px, 면 overlay-ink, 글자 gray-50 14px 700", () => {
    const tag = rulesFor(V2_CSS, ".mv-tag")[0] ?? "";
    expect(tag).toContain("gap: 6px");
    expect(tag).toContain("padding: 2px var(--space-sm)");
    expect(tag).toContain("background: var(--overlay-ink)");
    expect(tag).toContain("color: var(--gray-50)");
    expect(tag).toContain("font-size: 14px");
    expect(tag).toContain("font-weight: 700");
    expect(tag).toContain("text-shadow: var(--shadow-text)");
    const dot = rulesFor(V2_CSS, ".mv-tag__dot").join(";");
    expect(dot).toContain("width: 8px");
    expect(dot).toContain("height: 8px");
  });

  it("내 이름표는 안쪽 테두리 1.5px gray-100, 끊긴 이름표는 불투명도 0.55 와 점 gray-700", () => {
    expect(V2_CSS).toMatch(/\.mv-tag\.is-me\s*\{[^}]*inset 0 0 0 1\.5px var\(--gray-100\)/);
    expect(V2_CSS).toMatch(/\.mv-tag\.is-away\s*\{[^}]*opacity: 0\.55/);
    expect(V2_CSS).toMatch(/\.mv-tag\.is-away \.mv-tag__dot\s*\{[^}]*var\(--gray-700\)/);
  });

  it("hex 색이 없고 진홍·놋쇠 토큰을 쓰지 않는다", () => {
    expect(V2_CSS).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    expect(V2_CSS).not.toMatch(/--(crimson|brass)-/);
  });
});

describe("PhaseHeader (결정 0051-5)", () => {
  it("showHint false 면 안내가 접히고, time·total 이 없으면 시간 링이 없다", () => {
    const { container } = render(<PhaseHeader title="대기실" hint="바닥을 눌러 걸어요" showHint={false} />);
    expect(container.querySelector(".mv-phase__title")?.textContent).toBe("대기실");
    expect(container.querySelector(".mv-phase__hint.is-folded")?.textContent).toBe("바닥을 눌러 걸어요");
    expect(container.querySelector(".mv-ring")).toBeNull();
  });

  it("showHint 가 true 이면 접힘 클래스가 없다", () => {
    const { container } = render(<PhaseHeader title="대기실" hint="바닥을 눌러 걸어요" showHint />);
    const hint = container.querySelector(".mv-phase__hint");
    expect(hint).not.toBeNull();
    expect(hint?.classList.contains("is-folded")).toBe(false);
  });

  it("hint 가 없으면 안내 칸을 만들지 않는다", () => {
    const { container } = render(<PhaseHeader title="대기실" />);
    expect(container.querySelector(".mv-phase__hint")).toBeNull();
  });

  it("time 만 있고 total 이 없으면 링을 그리지 않고, 둘 다 있으면 role timer 링을 그린다", () => {
    const a = render(<PhaseHeader title="토론" time={20} />);
    expect(a.container.querySelector(".mv-ring")).toBeNull();
    cleanup();
    const b = render(<PhaseHeader title="토론" time={20} total={60} />);
    const ring = b.container.querySelector(".mv-ring");
    expect(ring?.getAttribute("role")).toBe("timer");
    expect(ring?.getAttribute("aria-label")).toBe("남은 시간 20초");
  });
});

describe("DotProgress (결정 0051-4)", () => {
  it("count 개가 켜지고 나머지는 꺼진 점이며 읽어 주는 이름을 붙일 수 있다", () => {
    const { container } = render(<DotProgress count={3} total={8} label="3명 모임" />);
    expect(container.querySelectorAll(".mv-dots__dot").length).toBe(8);
    expect(container.querySelectorAll(".mv-dots__dot.is-on").length).toBe(3);
    expect(container.querySelector(".mv-dots")?.getAttribute("aria-label")).toBe("3명 모임");
  });

  it("점 0개·8개 경계", () => {
    const none = render(<DotProgress count={0} total={8} />);
    expect(none.container.querySelectorAll(".mv-dots__dot.is-on").length).toBe(0);
    cleanup();
    const all = render(<DotProgress count={8} total={8} />);
    expect(all.container.querySelectorAll(".mv-dots__dot.is-on").length).toBe(8);
  });

  it("label 이 없으면 count/total 을 읽어 준다", () => {
    const { container } = render(<DotProgress count={5} total={8} />);
    expect(container.querySelector(".mv-dots")?.getAttribute("aria-label")).toBe("5/8");
  });
});

describe("TopToast (UI-SPEC E7)", () => {
  function Harness({ api }: { api: { current: ReturnType<typeof useTopToast> | null } }) {
    const toast = useTopToast();
    api.current = toast;
    return <TopToast {...toast.props} />;
  }

  it("알림이 없으면 is-on 이 아니고 글자 칸이 비어 있으며 role status·aria-live polite", () => {
    const api = { current: null as ReturnType<typeof useTopToast> | null };
    const { container } = render(<Harness api={api} />);
    const el = container.querySelector(".mv-toast");
    expect(el?.getAttribute("role")).toBe("status");
    expect(el?.getAttribute("aria-live")).toBe("polite");
    expect(el?.classList.contains("is-on")).toBe(false);
    expect(container.querySelector(".mv-toast__text")?.textContent).toBe("");
  });

  it("show 하면 켜지고, 새 알림이 이전 알림을 바꾸며 아이콘이 따라온다", () => {
    vi.useFakeTimers();
    const api = { current: null as ReturnType<typeof useTopToast> | null };
    const { container } = render(<Harness api={api} />);
    act(() => api.current?.show("철수 님 입장"));
    expect(container.querySelector(".mv-toast")?.classList.contains("is-on")).toBe(true);
    expect(container.querySelector(".mv-toast__text")?.textContent).toBe("철수 님 입장");
    expect(container.querySelector(".mv-toast__text svg")).toBeNull();
    act(() => api.current?.show("방장 · 영희", "crown"));
    expect(container.querySelectorAll(".mv-toast__text").length).toBe(1);
    expect(container.querySelector(".mv-toast__text")?.textContent).toBe("방장 · 영희");
    expect(container.querySelector(".mv-toast__text svg")).not.toBeNull();
  });

  it("dur-toast(1500ms) 뒤 꺼지고, 새 알림은 타이머를 다시 시작한다", () => {
    vi.useFakeTimers();
    const api = { current: null as ReturnType<typeof useTopToast> | null };
    const { container } = render(<Harness api={api} />);
    const on = () => container.querySelector(".mv-toast")?.classList.contains("is-on");
    act(() => api.current?.show("하나"));
    act(() => vi.advanceTimersByTime(1000));
    act(() => api.current?.show("둘"));
    act(() => vi.advanceTimersByTime(1000));
    expect(on()).toBe(true);
    act(() => vi.advanceTimersByTime(500));
    expect(on()).toBe(false);
  });

  it("전각 8자 닉네임의 입장 알림이 글자 그대로 한 줄(nowrap)이다", () => {
    const { container } = render(<TopToast visible text="가나다라마바사아 님 입장" />);
    expect(container.querySelector(".mv-toast__text")?.textContent).toBe("가나다라마바사아 님 입장");
    expect(rulesFor(V2_CSS, ".mv-toast__text").join(";")).toContain("white-space: nowrap");
  });

  it("닉네임에 HTML 이 들어 있어도 요소가 생기지 않는다 (T-06-26)", () => {
    const { container } = render(<TopToast visible text="<i>x</i> 님 입장" />);
    expect(container.querySelector("i")).toBeNull();
    expect(container.querySelector(".mv-toast__text")?.textContent).toBe("<i>x</i> 님 입장");
  });
});

describe("ActionButton·ActionRow (UI-SPEC 행동 줄, E6)", () => {
  it("primary: 아이콘 + 라벨 + 점이 한 버튼 안에 있다", () => {
    const { container } = render(
      <ActionButton variant="primary" icon="play" label="시작" dots={{ count: 5, total: 8 }} aria-label="게임 시작, 5명 모임" />,
    );
    const btn = screen.getByRole("button", { name: "게임 시작, 5명 모임" });
    expect(btn.classList.contains("mf-act--primary")).toBe(true);
    expect(btn.querySelector("svg")).not.toBeNull();
    expect(btn.textContent).toContain("시작");
    expect(container.querySelectorAll(".mv-dots__dot").length).toBe(8);
    expect(container.querySelectorAll(".mv-dots__dot.is-on").length).toBe(5);
    expect(btn.getAttribute("aria-disabled")).toBeNull();
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("inactive: aria-disabled 이고 누름 콜백은 불리되 판단은 부르는 쪽이 한다", () => {
    const onClick = vi.fn();
    render(<ActionButton variant="inactive" icon="play" label="시작" onClick={onClick} />);
    const btn = screen.getByRole("button", { name: "시작" });
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    expect(btn.classList.contains("mf-act--inactive")).toBe(true);
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("flat: disabled 이고 평평한 비활성 라벨 그대로", () => {
    const onClick = vi.fn();
    render(<ActionButton variant="flat" label="방장을 기다리는 중…" onClick={onClick} />);
    const btn = screen.getByRole("button", { name: "방장을 기다리는 중…" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.classList.contains("mf-act--flat")).toBe(true);
    expect(btn.querySelector("svg")).toBeNull();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("ActionRow: 자식 수 n 으로 repeat(n, minmax(0, 1fr))", () => {
    const one = render(
      <ActionRow>
        <ActionButton variant="flat" label="방장을 기다리는 중…" />
      </ActionRow>,
    );
    const row1 = one.container.querySelector(".mf-act-row") as HTMLElement;
    expect(row1.getAttribute("role")).toBe("group");
    expect(row1.style.gridTemplateColumns).toBe("repeat(1, minmax(0, 1fr))");
    cleanup();
    const two = render(
      <ActionRow>
        <ActionButton variant="inactive" label="꾸미기" />
        <ActionButton variant="primary" label="시작" />
      </ActionRow>,
    );
    expect((two.container.querySelector(".mf-act-row") as HTMLElement).style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
  });

  it("승인 보드 act() 치수: 높이 52·반경 14·테두리 1px·16px 700·안쪽 0 12px·아이콘 22 + 라벨 + 점 간격 8, 한 줄", () => {
    const act = rulesFor(V2_CSS, ".mf-act")[0] ?? "";
    expect(act).toContain("min-height: var(--control-button)");
    expect(act).toContain("border-radius: var(--radius-md)");
    expect(act).toMatch(/border: 1px solid/);
    expect(act).toContain("font-size: 16px");
    expect(act).toContain("font-weight: 700");
    expect(act).toContain("padding: 0 12px");
    expect(act).toContain("gap: 8px");
    expect(act).toContain("white-space: nowrap");
    const row = rulesFor(V2_CSS, ".mf-act-row").join(";");
    expect(row).toContain("display: grid");
    expect(row).toContain("gap: 8px");
  });

  it("아이콘은 22px 로 그려진다", () => {
    render(<ActionButton variant="primary" icon="play" label="시작" />);
    const svg = screen.getByRole("button", { name: "시작" }).querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("22");
  });

  it("세 모양의 색: primary gray-100 면·night-900 글자, inactive night-700 면·night-600 테두리·0.45, flat 투명·gray-300", () => {
    expect(V2_CSS).toMatch(/\.mf-act--primary\s*\{[^}]*background: var\(--gray-100\)[^}]*color: var\(--night-900\)/);
    expect(V2_CSS).toMatch(/\.mf-act--inactive\s*\{[^}]*background: var\(--night-700\)[^}]*border-color: var\(--night-600\)[^}]*opacity: 0\.45/);
    expect(V2_CSS).toMatch(/\.mf-act--flat\s*\{[^}]*background: transparent[^}]*color: var\(--gray-300\)/);
  });

  it("포커스 링은 gray-100 2px, 오프셋 2px", () => {
    expect(V2_CSS).toMatch(/\.mf-act:focus-visible\s*\{[^}]*outline: 2px solid var\(--gray-100\)[^}]*outline-offset: 2px/);
  });
});
