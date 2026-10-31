// 3D 색 중 토큰과 같은 값을 쓰는 곳은 design/tokens.json 값과 같다는 것을 고정한다 (UI-SPEC Color: 3D 장면 전용 상수는 화면 CSS 에 쓰지 않는다).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PALETTE, TOKEN_COLORS } from "../../src/world/palette";

type Token = { name: string; value: string };
const doc = JSON.parse(readFileSync(resolve(process.cwd(), "design/tokens.json"), "utf8")) as { color: { tokens: Token[] } };
const token = (name: string): string => {
  const t = doc.color.tokens.find((x) => x.name === name);
  if (!t) throw new Error(`토큰 없음: ${name}`);
  return t.value.toLowerCase();
};

describe("3D 팔레트 ↔ 토큰", () => {
  it("링 gray-50 · 윤곽 night-950 · 따뜻한 빛 light-lamp · 달빛 light-moon 이 design/tokens.json 값과 같다", () => {
    expect(TOKEN_COLORS.ring.toLowerCase()).toBe(token("gray-50"));
    expect(TOKEN_COLORS.ringOutline.toLowerCase()).toBe(token("night-950"));
    expect(TOKEN_COLORS.lamp.toLowerCase()).toBe(token("light-lamp"));
    expect(TOKEN_COLORS.moon.toLowerCase()).toBe(token("light-moon"));
  });

  it("PALETTE 의 같은 이름 색은 TOKEN_COLORS 를 그대로 가리킨다(값이 갈라지지 않는다)", () => {
    expect(PALETTE.ring).toBe(TOKEN_COLORS.ring);
    expect(PALETTE.ringOutline).toBe(TOKEN_COLORS.ringOutline);
    expect(PALETTE.lamp).toBe(TOKEN_COLORS.lamp);
    expect(PALETTE.moon).toBe(TOKEN_COLORS.moon);
  });

  it("PALETTE 의 모든 색은 #rrggbb 이다(배열 포함)", () => {
    const all: string[] = [];
    for (const v of Object.values(PALETTE)) Array.isArray(v) ? all.push(...v) : all.push(v as string);
    expect(all.length).toBeGreaterThan(25);
    for (const c of all) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("bar.js 원문 색을 그대로 쓴다: 바닥 #3a2a22·#33241d, 벽 #211a26, 카운터 #2e2018, 피아노 #14161c, 무대 #2c2234, 놋쇠 #a98559", () => {
    expect(PALETTE.floorA).toBe("#3a2a22");
    expect(PALETTE.floorB).toBe("#33241d");
    expect(PALETTE.wall).toBe("#211a26");
    expect(PALETTE.counter).toBe("#2e2018");
    expect(PALETTE.darkMetal).toBe("#14161c");
    expect(PALETTE.stageBody).toBe("#2c2234");
    expect(PALETTE.brass).toBe("#a98559");
  });
});
