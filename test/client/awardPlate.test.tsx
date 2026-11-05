/// <reference types="node" />
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "../helpers/singleLineErrors";
import { AwardPlate } from "../../src/components/v2/AwardPlate";

afterEach(cleanup);

// 칭호 패 부품 (11-09, D-7·D-24, UI-SPEC B-3·G): 놋쇠 테두리 + 아이콘 + 칭호 + 이유 한 줄 + 이름 점·닉네임
describe("AwardPlate", () => {
  it("표식과 읽기 이름: data-award-plate·data-award-id, role=status aria-live=polite, 내용 '{닉네임}, {칭호}, {이유}'", () => {
    const { container } = render(<AwardPlate name="지우" color="var(--seat-1)" award="talker" k={42} />);
    const plate = container.querySelector("[data-award-plate]")!;
    expect(plate).not.toBeNull();
    expect(plate.getAttribute("data-award-id")).toBe("talker");
    expect(plate.getAttribute("role")).toBe("status");
    expect(plate.getAttribute("aria-live")).toBe("polite");
    expect(screen.getByRole("status").textContent).toContain("지우, 수다왕, 채팅 42번");
  });

  it("눈에 보이는 칸: 칭호·이유·이름 점(자리 색)·닉네임·아이콘", () => {
    const { container } = render(<AwardPlate name="하윤" color="var(--seat-2)" award="detective" k={2} />);
    expect(container.querySelector(".mv-award__title")?.textContent).toBe("명탐정");
    expect(container.querySelector(".mv-award__reason")?.textContent).toBe("마피아를 2번 가리킴");
    expect(container.querySelector(".mv-award__name")?.textContent).toBe("하윤");
    expect(container.querySelector<HTMLElement>(".mv-award__name i")?.style.background).toContain("--seat-2");
    expect(container.querySelector(".mv-award__icon svg")).not.toBeNull();
  });

  it("마피아 칭호(연기대상)도 테두리는 놋쇠: 진홍 클래스가 없다", () => {
    const { container } = render(<AwardPlate name="도현" color="var(--seat-4)" award="actor" k={3} />);
    const plate = container.querySelector("[data-award-plate]")!;
    expect(plate.className).not.toMatch(/crimson|mafia/);
    expect(container.querySelector(".mv-award__icon")?.className ?? "").not.toMatch(/crimson|mafia/);
  });

  it("닉네임은 평문이다: 마크업 삽입 없음 (T-11-31)", () => {
    const { container } = render(<AwardPlate name="<b>x</b>" color="var(--seat-1)" award="mood" k={1} />);
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector(".mv-award__name")?.textContent).toBe("<b>x</b>");
  });

  it("탭하면 onTap 을 부른다", () => {
    let n = 0;
    const { container } = render(<AwardPlate name="지우" color="var(--seat-1)" award="survivor" onTap={() => (n += 1)} />);
    (container.querySelector("[data-award-plate]") as HTMLElement).click();
    expect(n).toBe(1);
  });

  it("폭을 주면 인라인 폭, 안 주면 CSS 의 min(328, 폭 − 32)", () => {
    const { container } = render(<AwardPlate name="지우" color="var(--seat-1)" award="survivor" width={300} />);
    expect((container.querySelector("[data-award-plate]") as HTMLElement).style.width).toBe("300px");
  });
});

describe("AwardPlate CSS 정적 단언 (v2.css)", () => {
  const css = readFileSync("src/styles/v2.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = (selector: string): string => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => (m[1] ?? "").trim() === selector)?.[2] ?? "";

  it("틀: 높이 96·폭 min(328px, 100% − 32px)·놋쇠 2px 테두리·안쪽 12", () => {
    const body = rule(".mv-award");
    expect(body).toMatch(/height:\s*96px/);
    expect(body).toMatch(/min\(328px,\s*calc\(100% - 32px\)\)/);
    expect(body).toMatch(/border:\s*2px solid var\(--brass-400\)/);
    expect(body).toMatch(/padding:\s*12px/);
    expect(body).not.toMatch(/crimson|#[0-9a-f]{3,8}\b/i);
  });

  it("칭호 24px 700 (글꼴 --font-ui, serif 아님), 이유 14px", () => {
    const title = rule(".mv-award__title");
    expect(title).toMatch(/font-size:\s*24px/);
    expect(title).toMatch(/font-weight:\s*700/);
    expect(title).toMatch(/font-family:\s*var\(--font-ui\)|font-family:\s*inherit/);
    expect(title).not.toMatch(/--font-serif/);
    expect(rule(".mv-award__reason")).toMatch(/font-size:\s*14px/);
  });

  it("등장은 opacity 만(transform 없음) 180ms", () => {
    expect(css).toMatch(/@keyframes mv-award-in\s*\{\s*from\s*\{\s*opacity:\s*0;\s*\}\s*to\s*\{\s*opacity:\s*1;\s*\}\s*\}/);
    expect(rule(".mv-award")).toMatch(/animation:\s*mv-award-in 180ms/);
  });
});
