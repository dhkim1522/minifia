import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { ReadyPill } from "../../src/components/v2/ReadyPill";

afterEach(cleanup);

// 11-12 Task 1: 입력줄 오른쪽 끝 알약(96×48). 손님 = 준비 토글, 방장 = 두 줄 [시작] + 'n / m'. 사용자 문자열은 없다(숫자뿐).
const pill = (c: HTMLElement) => c.querySelector<HTMLButtonElement>("button[data-ready-pill]")!;

describe("ReadyPill — 손님", () => {
  it("꺼져 있으면 라벨 '준비', aria-pressed false, data-ready false", () => {
    const { container } = render(<ReadyPill host={false} on={false} onPress={() => {}} />);
    expect(pill(container).textContent).toBe("준비");
    expect(pill(container).getAttribute("aria-pressed")).toBe("false");
    expect(pill(container).getAttribute("data-ready")).toBe("false");
    expect(pill(container).hasAttribute("data-ready-count")).toBe(false);
    expect(pill(container).querySelector("svg")).not.toBeNull(); // check 20
  });

  it("켜지면 '준비됨', aria-pressed true, 접근성 이름 '준비됨, 눌러서 취소'", () => {
    const { container } = render(<ReadyPill host={false} on onPress={() => {}} />);
    expect(pill(container).textContent).toBe("준비됨");
    expect(pill(container).getAttribute("aria-pressed")).toBe("true");
    expect(pill(container).getAttribute("data-ready")).toBe("true");
    expect(pill(container).getAttribute("aria-label")).toBe("준비됨, 눌러서 취소");
  });

  it("누르면 onPress 한 번", () => {
    const onPress = vi.fn();
    const { container } = render(<ReadyPill host={false} on={false} onPress={onPress} />);
    fireEvent.click(pill(container));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("비활성(승리 조명 전)이면 aria-disabled 이고 눌러도 아무 일 없다", () => {
    const onPress = vi.fn();
    const { container } = render(<ReadyPill host={false} on={false} inactive onPress={onPress} />);
    expect(pill(container).getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(pill(container));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("ReadyPill — 방장", () => {
  it("두 줄: '시작' 과 'n / m', data-ready-count 'n/m', 접근성 이름 '다음 판 시작, n명 준비'", () => {
    const { container } = render(<ReadyPill host n={4} m={5} onPress={() => {}} />);
    const lines = Array.from(pill(container).querySelectorAll("span")).map((s) => s.textContent);
    expect(lines).toEqual(["시작", "4 / 5"]);
    expect(pill(container).getAttribute("data-ready-count")).toBe("4/5");
    expect(pill(container).getAttribute("aria-label")).toBe("다음 판 시작, 4명 준비");
    expect(pill(container).hasAttribute("data-ready")).toBe(false);
  });

  it("흐림(dim)은 aria-disabled 와 같이 쓰이지만 탭은 여전히 onPress 를 부른다 (토스트 경로)", () => {
    const onPress = vi.fn();
    const { container } = render(<ReadyPill host n={2} m={5} dim onPress={onPress} />);
    expect(pill(container).getAttribute("aria-disabled")).toBe("true");
    expect(pill(container).getAttribute("data-dim")).toBe("true");
    fireEvent.click(pill(container));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("비활성(승리 조명 전)이면 눌러도 아무 일 없다", () => {
    const onPress = vi.fn();
    const { container } = render(<ReadyPill host n={4} m={4} inactive onPress={onPress} />);
    fireEvent.click(pill(container));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("활성이고 n 이 충분하면 dim 표식이 없다", () => {
    const { container } = render(<ReadyPill host n={4} m={4} onPress={() => {}} />);
    expect(pill(container).hasAttribute("data-dim")).toBe(false);
    expect(pill(container).getAttribute("aria-disabled")).toBeNull();
  });
});

describe("ReadyPill — 비활성 표식", () => {
  it("승리 조명 전(inactive)에만 data-inactive 가 붙는다 — 방장 흐림(dim)과 가른다", () => {
    const a = render(<ReadyPill host n={2} m={5} dim onPress={() => {}} />);
    expect(pill(a.container).hasAttribute("data-inactive")).toBe(false);
    cleanup();
    const b = render(<ReadyPill host n={4} m={5} inactive onPress={() => {}} />);
    expect(pill(b.container).getAttribute("data-inactive")).toBe("true");
    cleanup();
    const c = render(<ReadyPill host={false} on={false} inactive onPress={() => {}} />);
    expect(pill(c.container).getAttribute("data-inactive")).toBe("true");
  });
});

describe("ReadyPill — 계약", () => {
  it("눌러도 입력칸 포커스를 뺏지 않는다 (mousedown 기본 동작 막음)", () => {
    const { container } = render(<ReadyPill host={false} on={false} onPress={() => {}} />);
    expect(fireEvent.mouseDown(pill(container))).toBe(false);
  });

  it("CSS: 96×48, 새 색을 쓰지 않는다 (토큰 변수만)", () => {
    const css = readFileSync("src/styles/v2.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const rule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => (m[1] ?? "").trim() === ".mv-ready")?.[2] ?? "";
    expect(rule).toMatch(/width:\s*96px/);
    expect(rule).toMatch(/height:\s*48px/);
    expect(rule).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|hsl\(/);
  });
});
