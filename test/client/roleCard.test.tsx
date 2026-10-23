import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Icon } from "../../src/components/Icon";
import { RoleCard } from "../../src/components/RoleCard";
import { ROLE_TEXT, alliesText } from "../../src/game/roleText";

afterEach(cleanup);

function cardRoot(container: HTMLElement): HTMLElement {
  return container.firstElementChild as HTMLElement;
}

describe("RoleCard 뒷면 (ROLE-02, Pitfall 20)", () => {
  it("마피아·시민·역할 없음 세 경우의 뒷면 마크업이 서로 같다", () => {
    const mafia = render(<RoleCard role="mafia" face="back" allies={["서준"]} onFlip={vi.fn()} />);
    const citizen = render(<RoleCard role="citizen" face="back" allies={null} onFlip={vi.fn()} />);
    const none = render(<RoleCard role={null} face="back" allies={null} onFlip={vi.fn()} />);
    const html = cardRoot(mafia.container).innerHTML;
    expect(html.length).toBeGreaterThan(0);
    expect(cardRoot(citizen.container).innerHTML).toBe(html);
    expect(cardRoot(none.container).innerHTML).toBe(html);
    // 루트 자체(클래스·속성)도 역할에 따라 달라지지 않는다
    expect(cardRoot(citizen.container).outerHTML).toBe(cardRoot(mafia.container).outerHTML);
    expect(cardRoot(none.container).outerHTML).toBe(cardRoot(mafia.container).outerHTML);
  });

  it.each([
    ["mafia", ["서준"]],
    ["police", null],
    ["doctor", null],
    ["citizen", null],
    [null, null],
  ] as const)("뒷면(role %s)에는 역할 글자·직업 그림·동료 이름이 DOM 에 없다", (role, allies) => {
    const { container } = render(<RoleCard role={role} face="back" allies={allies ? [...allies] : null} onFlip={vi.fn()} />);
    expect(container.querySelector("img")).toBeNull();
    for (const text of ["마피아", "경찰", "의사", "시민", "서준", "동료", "혼자"]) {
      expect(container.textContent).not.toContain(text);
    }
    expect(container.innerHTML).not.toMatch(/mafia|police|doctor|citizen/);
  });

  it("뒷면은 role=button, tabIndex 0, aria-label '역할 카드 뒤집기' 이다", () => {
    const { container } = render(<RoleCard role="police" face="back" allies={null} onFlip={vi.fn()} />);
    const root = cardRoot(container);
    expect(root.getAttribute("role")).toBe("button");
    expect(root.tabIndex).toBe(0);
    expect(root.getAttribute("aria-label")).toBe("역할 카드 뒤집기");
    expect(screen.getByRole("button", { name: "역할 카드 뒤집기" })).toBe(root);
  });

  it("카드 안에 힌트 글자가 없다(안내는 카드 밖)", () => {
    const { container } = render(<RoleCard role="mafia" face="back" allies={[]} onFlip={vi.fn()} />);
    expect(container.textContent).toBe("");
  });

  it("뒷면 마름모는 진홍 면과 남색 안쪽을 가진 장식 SVG 다", () => {
    const { container } = render(<RoleCard role={null} face="back" allies={null} onFlip={vi.fn()} />);
    const svg = container.querySelector("svg.mf-card__diamond");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.innerHTML).toContain("var(--crimson-500)");
  });
});

describe("RoleCard 앞면 (D-14, E8)", () => {
  it("뒷면에서 앞면으로 바뀌면 직업 그림·이름·설명·동료 줄이 나타난다(마피아, 동료 2명)", () => {
    const { container, rerender } = render(<RoleCard role="mafia" face="back" allies={["서준", "민지"]} onFlip={vi.fn()} />);
    expect(container.querySelector("img")).toBeNull();
    rerender(<RoleCard role="mafia" face="front" allies={["서준", "민지"]} onFlip={vi.fn()} />);
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toContain("mafia_default%402x.png");
    expect(img.getAttribute("srcset")).toContain("mafia_default%404x.png 2x");
    expect(img.getAttribute("width")).toBe("150");
    expect(img.getAttribute("alt")).toBe("");
    expect(screen.getByText("마피아").className).toContain("mf-t-display");
    expect(screen.getByText("밤에 함께 한 명을 지목해요")).toBeTruthy();
    expect(screen.getByText("동료 · 서준, 민지")).toBeTruthy();
    expect(container.querySelector(".mf-card__divider")).not.toBeNull();
  });

  it("앞면 마크업 순서: 그림 → 이름 → 설명 → 구분선 → 동료 줄", () => {
    const { container } = render(<RoleCard role="mafia" face="front" allies={["서준"]} onFlip={vi.fn()} />);
    const front = container.querySelector(".mf-card__front") as HTMLElement;
    const order = Array.from(front.children).map((el) => el.tagName.toLowerCase() + "." + el.className.split(" ")[0]);
    expect(order).toEqual(["img.mf-card__art", "p.mf-t-display", "p.mf-card__desc", "div.mf-card__divider", "p.mf-card__mates"]);
  });

  it("동료 한 명이면 '동료 · 서준'", () => {
    render(<RoleCard role="mafia" face="front" allies={["서준"]} onFlip={vi.fn()} />);
    expect(screen.getByText("동료 · 서준")).toBeTruthy();
  });

  it("마피아 혼자면 '혼자예요'(allies 빈 배열)", () => {
    render(<RoleCard role="mafia" face="front" allies={[]} onFlip={vi.fn()} />);
    expect(screen.getByText("혼자예요")).toBeTruthy();
  });

  it("경찰(allies null)은 동료 줄도 구분선도 없다", () => {
    const { container } = render(<RoleCard role="police" face="front" allies={null} onFlip={vi.fn()} />);
    expect(screen.getByText("경찰")).toBeTruthy();
    expect(screen.getByText("밤마다 한 명을 조사해요")).toBeTruthy();
    expect(container.querySelector(".mf-card__mates")).toBeNull();
    expect(container.querySelector(".mf-card__divider")).toBeNull();
    expect((container.querySelector("img") as HTMLImageElement).getAttribute("src")).toContain("police_default%402x.png");
  });

  it("처음부터 앞면(5초 뒤 입장)으로 그려도 앞면이 바로 있고, 앞면이 있는 동안은 카드 이름이 앞면 글자다", () => {
    const { container } = render(<RoleCard role="citizen" face="front" allies={null} onFlip={vi.fn()} />);
    expect(container.querySelector("img")).not.toBeNull();
    expect(screen.getByText("대화와 투표로 마피아를 찾아요")).toBeTruthy();
    const root = cardRoot(container);
    expect(root.className).toContain("mf-card--front");
    expect(root.hasAttribute("aria-label")).toBe(false);
    expect(screen.getByRole("button", { name: /시민/ })).toBe(root);
  });

  it("앞면이 된 뒤 다시 뒷면이 되면 앞면은 남되 접근성 트리에서 숨는다", () => {
    const { container, rerender } = render(<RoleCard role="doctor" face="front" allies={null} onFlip={vi.fn()} />);
    rerender(<RoleCard role="doctor" face="back" allies={null} onFlip={vi.fn()} />);
    const root = cardRoot(container);
    expect(root.className).not.toContain("mf-card--front");
    expect(root.getAttribute("aria-label")).toBe("역할 카드 뒤집기");
    expect(container.querySelector(".mf-card__front")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("역할이 없으면 face 가 front 여도 앞면을 만들지 않는다", () => {
    const { container } = render(<RoleCard role={null} face="front" allies={null} onFlip={vi.fn()} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".mf-card__front")).toBeNull();
    expect(cardRoot(container).className).not.toContain("mf-card--front");
  });
});

describe("RoleCard 입력", () => {
  it("클릭하면 onFlip 이 한 번 불린다", () => {
    const onFlip = vi.fn();
    const { container } = render(<RoleCard role="mafia" face="back" allies={[]} onFlip={onFlip} />);
    fireEvent.click(cardRoot(container));
    expect(onFlip).toHaveBeenCalledTimes(1);
  });

  it("앞면 상태에서 눌러도 onFlip 이 불린다(다시 가림)", () => {
    const onFlip = vi.fn();
    const { container } = render(<RoleCard role="mafia" face="front" allies={[]} onFlip={onFlip} />);
    fireEvent.click(cardRoot(container));
    expect(onFlip).toHaveBeenCalledTimes(1);
  });

  it("앞면 안쪽(그림·글자)을 눌러도 한 번만 불린다", () => {
    const onFlip = vi.fn();
    render(<RoleCard role="police" face="front" allies={null} onFlip={onFlip} />);
    fireEvent.click(screen.getByText("경찰"));
    expect(onFlip).toHaveBeenCalledTimes(1);
  });

  it("포커스를 두고 Space·Enter 를 누르면 onFlip 이 불린다", () => {
    const onFlip = vi.fn();
    const { container } = render(<RoleCard role="doctor" face="back" allies={null} onFlip={onFlip} />);
    const root = cardRoot(container);
    root.focus();
    expect(document.activeElement).toBe(root);
    fireEvent.keyDown(root, { key: " " });
    expect(onFlip).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(root, { key: "Enter" });
    expect(onFlip).toHaveBeenCalledTimes(2);
  });

  it("Space 는 기본 동작(스크롤)을 막고, 다른 키는 무시한다", () => {
    const onFlip = vi.fn();
    const { container } = render(<RoleCard role="doctor" face="back" allies={null} onFlip={onFlip} />);
    const root = cardRoot(container);
    const notPrevented = fireEvent.keyDown(root, { key: " " });
    expect(notPrevented).toBe(false);
    onFlip.mockClear();
    fireEvent.keyDown(root, { key: "a" });
    fireEvent.keyDown(root, { key: "Tab" });
    expect(onFlip).not.toHaveBeenCalled();
  });

  it("역할이 없는 뷰도 같은 입력 처리(onFlip)를 부른다 — 뒤집을지는 cardFace 가 정한다", () => {
    const onFlip = vi.fn();
    const { container } = render(<RoleCard role={null} face="back" allies={null} onFlip={onFlip} />);
    fireEvent.click(cardRoot(container));
    expect(onFlip).toHaveBeenCalledTimes(1);
  });
});

describe("roleText (역할 문구 한 곳)", () => {
  it("네 역할의 이름과 한 줄 설명이 UI-SPEC 문구와 같다", () => {
    expect(ROLE_TEXT.mafia).toEqual({ name: "마피아", desc: "밤에 함께 한 명을 지목해요" });
    expect(ROLE_TEXT.police).toEqual({ name: "경찰", desc: "밤마다 한 명을 조사해요" });
    expect(ROLE_TEXT.doctor).toEqual({ name: "의사", desc: "밤에 한 명을 살려요" });
    expect(ROLE_TEXT.citizen).toEqual({ name: "시민", desc: "대화와 투표로 마피아를 찾아요" });
  });

  it("alliesText: 0명 '혼자예요', 1명, 2명", () => {
    expect(alliesText([])).toBe("혼자예요");
    expect(alliesText(["서준"])).toBe("동료 · 서준");
    expect(alliesText(["서준", "민지"])).toBe("동료 · 서준, 민지");
  });
});

describe("Icon", () => {
  it("label 이 없으면 aria-hidden 인 24x24 viewBox SVG 다", () => {
    const { container } = render(<Icon name="card" />);
    const svg = container.querySelector("svg") as SVGElement;
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.hasAttribute("role")).toBe(false);
    expect(svg.getAttribute("stroke-width")).toBe("2");
    expect(svg.getAttribute("stroke-linecap")).toBe("round");
    expect(svg.getAttribute("stroke-linejoin")).toBe("round");
    expect(svg.querySelectorAll("path, rect, circle").length).toBeGreaterThan(0);
  });

  it("label 이 있으면 role=img 와 aria-label 을 갖는다", () => {
    render(<Icon name="share" label="공유" />);
    const svg = screen.getByRole("img", { name: "공유" });
    expect(svg.getAttribute("aria-label")).toBe("공유");
    expect(svg.hasAttribute("aria-hidden")).toBe(false);
  });

  it("size 로 가로·세로를 바꾼다", () => {
    const { container } = render(<Icon name="close" size={44} className="x" />);
    const svg = container.querySelector("svg") as SVGElement;
    expect(svg.getAttribute("width")).toBe("44");
    expect(svg.getAttribute("height")).toBe("44");
    expect(svg.getAttribute("class")).toContain("mf-icon");
    expect(svg.getAttribute("class")).toContain("x");
  });

  it.each(["back", "share", "close", "copy", "check", "card", "diamond", "disconnected"] as const)(
    "1페이즈 아이콘 %s 는 그릴 도형이 있다",
    (name) => {
      const { container } = render(<Icon name={name} />);
      expect(container.querySelectorAll("path, rect, circle").length).toBeGreaterThan(0);
    },
  );
});
