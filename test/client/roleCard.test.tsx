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
    expect(container.querySelector(".mf-card__desc")?.textContent).toBe(ROLE_TEXT.mafia.desc);
    expect(screen.getByText("동료 · 서준, 민지")).toBeTruthy();
    expect(container.querySelector(".mf-card__divider")).not.toBeNull();
  });

  it("앞면 마크업 순서: 그림 → 이름 → 문구 한 덩어리 → (마피아만) 구분선 → 동료 줄, 목표 칩은 없다 (A1a)", () => {
    const { container } = render(<RoleCard role="mafia" face="front" allies={["서준"]} onFlip={vi.fn()} />);
    const front = container.querySelector(".mf-card__front") as HTMLElement;
    const order = Array.from(front.children).map((el) => el.tagName.toLowerCase() + "." + el.className.split(" ")[0]);
    expect(order).toEqual(["img.mf-card__art", "p.mf-t-display", "p.mf-card__desc", "div.mf-card__divider", "p.mf-card__mates"]);
    expect(container.querySelectorAll("[data-role-goal], .mf-goal").length).toBe(0);
    expect(container.textContent).not.toContain("목표");
    for (const role of ["police", "doctor", "citizen"] as const) {
      const c = render(<RoleCard role={role} face="front" allies={null} onFlip={vi.fn()} />);
      const f = c.container.querySelector(".mf-card__front") as HTMLElement;
      expect(Array.from(f.children).map((el) => el.tagName.toLowerCase() + "." + el.className.split(" ")[0])).toEqual(["img.mf-card__art", "p.mf-t-display", "p.mf-card__desc"]);
    }
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
    expect(container.querySelector(".mf-card__desc")?.textContent).toBe(ROLE_TEXT.police.desc);
    expect(container.querySelector(".mf-card__mates")).toBeNull();
    expect(container.querySelector(".mf-card__divider")).toBeNull();
    expect((container.querySelector("img") as HTMLImageElement).getAttribute("src")).toContain("police_default%402x.png");
  });

  it("처음부터 앞면(5초 뒤 입장)으로 그려도 앞면이 바로 있고, 앞면이 있는 동안은 카드 이름이 앞면 글자다", () => {
    const { container } = render(<RoleCard role="citizen" face="front" allies={null} onFlip={vi.fn()} />);
    expect(container.querySelector("img")).not.toBeNull();
    expect(container.querySelector(".mf-card__desc")?.textContent).toBe(ROLE_TEXT.citizen.desc);
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
  const CONFIRMED = {
    citizen: "당신은 시민입니다.\n추리로 마피아를 찾아내세요.",
    mafia: "당신은 마피아입니다.\n몰래 암살하여 승리하세요.",
    police: "당신은 경찰입니다.\n의심되는 사람을 조사하세요.",
    doctor: "당신은 의사입니다.\n시민 팀을 마피아에게서 지키세요.",
  } as const;
  const ROLES = ["mafia", "police", "doctor", "citizen"] as const;

  it.each(ROLES)("ROLE_TEXT[%s].desc 가 사용자 확정 문구와 글자 그대로 같다 (P181-0)", (role) => {
    expect(ROLE_TEXT[role].desc).toBe(CONFIRMED[role]);
  });

  it.each(ROLES)("%s desc: `당신은 {name}입니다.\\n` 으로 시작하고 줄바꿈이 하나, 둘째 문장이 비어 있지 않다 (A1c)", (role) => {
    const desc = ROLE_TEXT[role].desc;
    expect(desc.startsWith(`당신은 ${ROLE_TEXT[role].name}입니다.\n`)).toBe(true);
    const parts = desc.split("\n");
    expect(parts.length).toBe(2);
    expect(parts[1]!.trim().length).toBeGreaterThan(0);
  });

  it("네 desc 가 서로 다르다", () => {
    expect(new Set(ROLES.map((r) => ROLE_TEXT[r].desc)).size).toBe(4);
  });

  it("alliesText: 0명 '혼자예요', 1명, 2명", () => {
    expect(alliesText([])).toBe("혼자예요");
    expect(alliesText(["서준"])).toBe("동료 · 서준");
    expect(alliesText(["서준", "민지"])).toBe("동료 · 서준, 민지");
  });
});

describe("RoleCard 빛남 call (HOST-03)", () => {
  it("call 이면 루트에 is-call 과 값 없는 data-call, 아니면 둘 다 없다", () => {
    const on = render(<RoleCard role="mafia" face="back" allies={null} onFlip={vi.fn()} call />);
    expect(cardRoot(on.container).classList.contains("is-call")).toBe(true);
    expect(cardRoot(on.container).getAttribute("data-call")).toBe("");
    const off = render(<RoleCard role="mafia" face="back" allies={null} onFlip={vi.fn()} />);
    expect(cardRoot(off.container).classList.contains("is-call")).toBe(false);
    expect(cardRoot(off.container).hasAttribute("data-call")).toBe(false);
  });
});

describe("역할 문구 한 덩어리 (P181-0, A1a·A1d)", () => {
  const ROLES = ["mafia", "police", "doctor", "citizen"] as const;
  const second = (r: (typeof ROLES)[number]) => ROLE_TEXT[r].desc.split("\n")[1] ?? "";

  it.each(ROLES)("%s 앞면: .mf-card__desc[data-role-line] 하나, 글이 ROLE_TEXT desc(줄바꿈 포함)와 같고 목표 표식은 없다", (role) => {
    const { container } = render(<RoleCard role={role} face="front" allies={role === "mafia" ? [] : null} onFlip={vi.fn()} />);
    const lines = container.querySelectorAll("[data-role-line]");
    expect(lines.length).toBe(1);
    expect(lines[0]!.className).toBe("mf-card__desc");
    expect(lines[0]!.getAttribute("data-role-line")).toBe("");
    expect(lines[0]!.textContent).toBe(ROLE_TEXT[role].desc);
    expect(lines[0]!.childNodes.length).toBe(1);
    expect(container.querySelectorAll("[data-role-goal], .mf-goal").length).toBe(0);
  });

  it.each(ROLES)("%s 앞면: 다른 직업 문구의 둘째 문장은 DOM 에 없다 (결정 0021)", (role) => {
    const { container } = render(<RoleCard role={role} face="front" allies={role === "mafia" ? [] : null} onFlip={vi.fn()} />);
    for (const other of ROLES) {
      if (other === role) continue;
      expect(container.textContent).not.toContain(second(other));
    }
  });

  it.each(ROLES)("%s 뒷면 상태(앞면이 마운트되기 전)에는 문구도 '당신은' 도 없다", (role) => {
    const { container } = render(<RoleCard role={role} face="back" allies={null} onFlip={vi.fn()} />);
    expect(container.querySelector("[data-role-line]")).toBeNull();
    expect(container.textContent).not.toContain("당신은");
    expect(container.textContent).not.toContain(second(role));
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

  it.each(["back", "share", "close", "copy", "check", "card", "disconnected"] as const)(
    "1페이즈 아이콘 %s 는 그릴 도형이 있다",
    (name) => {
      const { container } = render(<Icon name={name} />);
      expect(container.querySelectorAll("path, rect, circle").length).toBeGreaterThan(0);
    },
  );
});
