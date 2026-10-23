import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { Chip } from "../../src/components/Chip";

afterEach(cleanup);

describe("Chip (S-06b 칩)", () => {
  it("선택 안 됨: aria-pressed false 이고 체크 svg 가 없다", () => {
    render(<Chip selected={false} onPress={() => {}}>경찰</Chip>);
    const b = screen.getByRole("button", { name: "경찰" });
    expect(b.getAttribute("aria-pressed")).toBe("false");
    expect(b.querySelector("svg") === null).toBe(true);
  });

  it("선택됨: aria-pressed true 이고 글자 앞에 체크 svg 가 있다", () => {
    render(<Chip selected onPress={() => {}}>경찰</Chip>);
    const b = screen.getByRole("button", { name: "경찰" });
    expect(b.getAttribute("aria-pressed")).toBe("true");
    const svg = b.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("18");
    expect(b.firstElementChild).toBe(svg);
  });

  it("누르면 onPress 가 한 번 불린다", () => {
    const onPress = vi.fn();
    render(<Chip selected={false} onPress={onPress}>의사</Chip>);
    fireEvent.click(screen.getByRole("button", { name: "의사" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("disabled 면 disabled 속성이 있고 눌러도 불리지 않는다", () => {
    const onPress = vi.fn();
    render(<Chip selected={false} disabled onPress={onPress}>의사</Chip>);
    const b = screen.getByRole("button", { name: "의사" }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    fireEvent.click(b);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("type 은 button 이고 mf-chip 클래스다", () => {
    render(<Chip selected={false} onPress={() => {}}>시민</Chip>);
    const b = screen.getByRole("button", { name: "시민" });
    expect(b.getAttribute("type")).toBe("button");
    expect(b.classList.contains("mf-chip")).toBe(true);
  });

  it("긴 글자도 한 칩 안에 글자 요소로 담긴다", () => {
    render(<Chip selected={false} onPress={() => {}}>열두글자닉네임이길어요 의심</Chip>);
    expect(screen.getByRole("button").querySelector(".mf-chip__label")?.textContent).toBe("열두글자닉네임이길어요 의심");
  });
});

describe("chip.css (칩 줄)", () => {
  const css = readFileSync("src/styles/chip.css", "utf8");
  it(".mf-chips 줄은 줄바꿈하고 가로 스크롤을 쓰지 않는다", () => {
    expect(css).toMatch(/\.mf-chips\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(css).not.toMatch(/overflow-x/);
  });
  it("진홍 변수와 하드코딩 색을 쓰지 않는다", () => {
    expect(css).not.toMatch(/crimson/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});
