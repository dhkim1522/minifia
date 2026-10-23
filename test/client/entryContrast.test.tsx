/// <reference types="node" />
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { installMemoryStorage } from "../helpers/memoryStorage";
import { Home } from "../../src/screens/Home";

// G-01-1b: 첫 화면 입력 카드의 글자 대비.
// 화면 클래스(DOM) → ds.css 규칙 → 토큰 hex → WCAG 대비 순서로 이어서 잰다.
// 면은 입력칸·카드·시트와 같은 --night-800 으로 고정한다(카드는 85% 불투명이라 실제 면은 더 어두워 밝은 글자에 유리하다).

type Rgb = [number, number, number];

// `?raw` 로 읽은 CSS 는 vitest 가 CSS 를 처리해 빈 문자열이 된다(sheet.test.tsx 와 같은 사정). 파일을 직접 읽는다.
const dsCss = readFileSync("src/styles/ds.css", "utf8");
const tokensCss = readFileSync("src/styles/tokens.css", "utf8");

beforeEach(() => {
  installMemoryStorage();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// tokens.css 원문에서 `--name: #rrggbb;` 의 색을 RGB 세 수로 돌려준다.
function tokenHex(name: string): Rgb {
  const m = new RegExp(`--${name}:\\s*#([0-9a-fA-F]{6})\\s*;`).exec(tokensCss);
  if (!m) throw new Error(`tokens.css 에 --${name} 색 토큰이 없다`);
  const hex = m[1] as string;
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const normalizeSelectors = (list: string) =>
  list
    .split(",")
    .map((s) => s.trim().replace(/\s+/g, " "))
    .join(", ");

// 선택자 목록 전체가 규칙 시작부터 정확히 일치하는 블록들을 모아 `속성 → 값` 맵으로 합친다(뒤 규칙이 이긴다).
// `.mf-field__label` 이 `.mf-field__label--x` 나 후손 선택자 규칙에 걸리지 않는다.
function declsOf(css: string, selector: string): Record<string, string> {
  const want = normalizeSelectors(selector);
  const out: Record<string, string> = {};
  let found = false;
  for (const m of stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (normalizeSelectors(m[1] as string) !== want) continue;
    found = true;
    for (const decl of (m[2] as string).split(";")) {
      const i = decl.indexOf(":");
      if (i < 0) continue;
      out[decl.slice(0, i).trim()] = decl.slice(i + 1).trim();
    }
  }
  if (!found) throw new Error(`ds.css 에 ${selector} 규칙이 없다`);
  return out;
}

// `var(--gray-100)` 에서 토큰 이름 `gray-100` 을 돌려준다. 그 모양이 아니면 null.
function tokenOf(value: string | undefined): string | null {
  const m = /^var\(--([a-z0-9-]+)\)$/.exec((value ?? "").trim());
  return m ? (m[1] as string) : null;
}

const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

// WCAG 2 상대 휘도 비.
function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// 불투명도 alpha 의 전경색을 면 위에 합성한 색.
function composite(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return [0, 1, 2].map((i) => Math.round(fg[i]! * alpha + bg[i]! * (1 - alpha))) as Rgb;
}

const SURFACE = tokenHex("night-800");

// 규칙의 속성이 var(--토큰) 이어야 하고 그 토큰의 RGB 를 돌려준다.
function tokenColor(selector: string, prop: string): { name: string | null; rgb: Rgb | null } {
  const name = tokenOf(declsOf(dsCss, selector)[prop]);
  return { name, rgb: name ? tokenHex(name) : null };
}

describe("G-01-1b 첫 화면 입력 글자 대비", () => {
  it("G-01-1b: 입력 라벨은 본문 글자 단계(gray-100)이고 night-800 면 위에서 12:1 이상이다", () => {
    render(<Home onEnterRoom={vi.fn()} />);
    expect(screen.getByText("닉네임").classList.contains("mf-field__label")).toBe(true);
    const { name, rgb } = tokenColor(".mf-field__label", "color");
    expect(name).toBe("gray-100");
    expect(contrast(rgb as Rgb, SURFACE)).toBeGreaterThanOrEqual(12);
  });
});
