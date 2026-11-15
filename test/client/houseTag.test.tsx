import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HouseTag } from "../../src/components/v2/HouseTag";
import type { HouseTagProps } from "../../src/components/v2/HouseTag";

// 21-09 밤 집 문패 단추(D-10·D-25, UI-SPEC P21-3~P21-5): 얼굴 32 + 자리색 테두리, 창 점, 고름 표시. 역할을 읽지 않고 모든 역할이 같은 마크업이다.

afterEach(cleanup);

const BASE: HouseTagProps = { seat: 2, nickname: "민수", owner: true, button: true, lit: true, picked: false, call: false };
const V2_CSS = readFileSync("src/styles/v2.css", "utf8");

describe("HouseTag — 단추인 문패", () => {
  it("button 하나, data-house-tag=좌석, 접근성 이름 '{닉네임}의 집, 불 켜짐'(꺼짐이면 '불 꺼짐'), 창 점은 켜짐이면 data-lit=true", () => {
    const { container, rerender } = render(<HouseTag {...BASE} />);
    const btns = container.querySelectorAll("button");
    expect(btns).toHaveLength(1);
    const b = btns[0] as HTMLButtonElement;
    expect(b.getAttribute("type")).toBe("button");
    expect(b.getAttribute("data-house-tag")).toBe("2");
    expect(b.getAttribute("aria-label")).toBe("민수의 집, 불 켜짐");
    expect(b.getAttribute("data-lit")).toBe("true");
    expect(b.getAttribute("aria-pressed")).toBe("false");
    expect(b.hasAttribute("data-picked")).toBe(false);
    expect(b.hasAttribute("data-call")).toBe(false);
    expect(b.querySelector("[data-window-dot]")).not.toBeNull();
    rerender(<HouseTag {...BASE} lit={false} />);
    const off = container.querySelector("button")!;
    expect(off.getAttribute("aria-label")).toBe("민수의 집, 불 꺼짐");
    expect(off.getAttribute("data-lit")).toBe("false");
  });

  it("얼굴 그림은 좌석의 face 이고(장식, alt 비어 있음) 자리색 테두리는 토큰 변수다", () => {
    const { container } = render(<HouseTag {...BASE} seat={10} />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("/characters/faces/face-2.png");
    expect(img.getAttribute("alt")).toBe("");
    const ring = container.querySelector<HTMLElement>("[data-house-face]")!;
    expect(ring.style.borderColor || ring.getAttribute("style") || "").toContain("var(--seat-3)");
  });

  it("고른 집: aria-pressed true · 접근성 이름에 ', 고름' · check 배지 · data-picked", () => {
    const { container } = render(<HouseTag {...BASE} picked />);
    const b = container.querySelector("button")!;
    expect(b.getAttribute("aria-pressed")).toBe("true");
    expect(b.getAttribute("aria-label")).toBe("민수의 집, 불 켜짐, 고름");
    expect(b.hasAttribute("data-picked")).toBe(true);
    expect(b.querySelector("[data-house-check]")).not.toBeNull();
    expect(b.classList.contains("is-picked")).toBe(true);
    // 고르지 않은 집에는 배지가 없다
    const other = render(<HouseTag {...BASE} />).container.querySelector("button")!;
    expect(other.querySelector("[data-house-check]")).toBeNull();
  });

  it("빛남(call): is-call 과 data-call, 고른 집은 is-call 이 아니다(깜빡임 ↔ 정지 테두리가 다르다)", () => {
    const { container, rerender } = render(<HouseTag {...BASE} call />);
    const b = container.querySelector("button")!;
    expect(b.classList.contains("is-call")).toBe(true);
    expect(b.hasAttribute("data-call")).toBe(true);
    rerender(<HouseTag {...BASE} call={false} picked />);
    const picked = container.querySelector("button")!;
    expect(picked.classList.contains("is-call")).toBe(false);
    expect(picked.hasAttribute("data-call")).toBe(false);
  });

  it("누르면 onPick(좌석)을 한 번 부른다, 연결이 끊겨 disabled 면 부르지 않고 aria-disabled", () => {
    const onPick = vi.fn();
    const { container, rerender } = render(<HouseTag {...BASE} onPick={onPick} />);
    fireEvent.click(container.querySelector("button")!);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(2);
    rerender(<HouseTag {...BASE} onPick={onPick} disabled />);
    const b = container.querySelector("button")!;
    expect(b.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(b);
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});

describe("HouseTag — 단추가 아닌 문패(탈락자·주인 없음·유령 화면)", () => {
  it("button 요소가 아니고 is-static(pointer-events: none)·data-house-tag 를 가진다", () => {
    const { container } = render(<HouseTag {...BASE} button={false} />);
    expect(container.querySelectorAll("button")).toHaveLength(0);
    const el = container.querySelector<HTMLElement>("[data-house-tag]")!;
    expect(el.getAttribute("data-house-tag")).toBe("2");
    expect(el.classList.contains("is-static")).toBe(true);
    expect(el.hasAttribute("aria-pressed")).toBe(false);
    expect(el.hasAttribute("tabindex")).toBe(false);
    expect(V2_CSS).toMatch(/\.mv-housetag\.is-static\s*\{[^}]*pointer-events:\s*none/);
  });

  it("주인 없는 집은 얼굴 그림이 없고 접근성 트리에서 빠진다", () => {
    const { container } = render(<HouseTag {...BASE} seat={6} owner={false} nickname={null} button={false} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-house-tag]")!.getAttribute("aria-hidden")).toBe("true");
  });

  it("주인 있는 단추 아닌 문패(탈락자)는 이름을 읽는다 — 이름표 흐림은 CSS", () => {
    const { container } = render(<HouseTag {...BASE} button={false} lit={false} />);
    expect(container.querySelector("[data-house-tag]")!.getAttribute("aria-label")).toBe("민수의 집, 불 꺼짐");
  });
});

describe("HouseTag — 역할 비노출·안전", () => {
  it("렌더 결과에 역할 관련 속성·문자열이 없다(data-ring-kind·조준·눈/치료 아이콘 없음)", () => {
    for (const props of [BASE, { ...BASE, picked: true }, { ...BASE, call: true }, { ...BASE, button: false }]) {
      const html = render(<HouseTag {...props} />).container.innerHTML;
      expect(html).not.toMatch(/data-ring-kind|mafia|police|doctor|citizen|data-role|crosshair|aim/i);
      expect(html).not.toMatch(/data-mark-icon="(eye|heal)"/);
      cleanup();
    }
  });

  it("마크업은 마피아·시민이 같다: 같은 입력에 같은 DOM(prop 에 역할이 없다)", () => {
    const a = render(<HouseTag {...BASE} />).container.innerHTML;
    cleanup();
    const b = render(<HouseTag {...BASE} />).container.innerHTML;
    expect(b).toBe(a);
  });

  it("닉네임은 속성 값으로만 들어가고 마크업이 되지 않는다(innerHTML 없음)", () => {
    const { container } = render(<HouseTag {...BASE} nickname={'<img src=x onerror="alert(1)">'} />);
    expect(container.querySelectorAll("img")).toHaveLength(1); // 얼굴 그림 하나뿐
    expect(container.querySelector("img[onerror]")).toBeNull();
    expect(container.querySelector("button")!.getAttribute("aria-label")).toContain("<img");
  });

  it("v2.css 의 문패 규칙은 hex·rgb 리터럴 없이 토큰 변수만 쓴다", () => {
    const at = V2_CSS.indexOf(".mv-housetag");
    expect(at).toBeGreaterThan(0);
    const block = V2_CSS.slice(at);
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(block).not.toMatch(/\brgba?\(/);
    expect(block).toMatch(/var\(--light-lamp\)/);
    expect(block).toMatch(/var\(--glow-ring\)/);
  });
});
