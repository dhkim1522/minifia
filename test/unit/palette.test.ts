// 3D 색 중 토큰과 같은 값을 쓰는 곳은 design/tokens.json 값과 같다는 것을 고정한다 (UI-SPEC Color: 3D 장면 전용 상수는 화면 CSS 에 쓰지 않는다).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PALETTE, PLAZA_PALETTE, SEAT_COLORS, TOKEN_COLORS, TOWN_LIT, TOWN_PALETTE } from "../../src/world/palette";

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

// ---------- 마을(20페이즈, P20-2·P20-3·P20-13·P20-20) ----------
describe("마을 3D 팔레트 SEAT_COLORS · TOWN_PALETTE · TOWN_LIT", () => {
  const css = readFileSync(resolve(process.cwd(), "src/styles/tokens.css"), "utf8");
  const seatVar = (n: number): string => {
    const m = new RegExp(`--seat-${n}:\\s*(#[0-9a-fA-F]{6});`).exec(css);
    if (!m) throw new Error(`토큰 없음: --seat-${n}`);
    return m[1]!.toLowerCase();
  };

  it("SEAT_COLORS 8개가 tokens.css 의 --seat-1~8 과 같은 값·같은 순서다 (P20-20)", () => {
    expect(SEAT_COLORS).toHaveLength(8);
    for (let i = 0; i < 8; i++) expect(SEAT_COLORS[i]?.toLowerCase(), `seat ${i}`).toBe(seatVar(i + 1));
  });

  it("TOWN_PALETTE 는 UI-SPEC 표의 값이고 모두 #rrggbb 다 — 이미 있는 색은 그 상수를 가리킨다 (P20-2·P20-3)", () => {
    expect(TOWN_PALETTE).toMatchObject({
      roomWall: "#3a3f4b",
      roomRoof: "#2a2f45",
      roomEdge: "#6b7180",
      floorA: "#4a3f36",
      floorB: "#42382f",
      prop: "#6b5a48",
      houseWall: "#2b2f38",
      houseRoof: "#1b2442",
      paneLit: "#ffd59a",
      paneDark: "#0e1326",
      plate: "#0e1326",
      sign: "#ffcf8a",
      ground: "#121a30",
    });
    for (const c of Object.values(TOWN_PALETTE)) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    expect(TOWN_PALETTE.roomWall).toBe(PLAZA_PALETTE.planter);
    expect(TOWN_PALETTE.roomRoof).toBe(PLAZA_PALETTE.stoneD);
    expect(TOWN_PALETTE.houseRoof).toBe(PLAZA_PALETTE.facades[3]);
    expect(TOWN_PALETTE.paneLit).toBe(PLAZA_PALETTE.lampBulb);
    expect(TOWN_PALETTE.paneDark).toBe(PLAZA_PALETTE.paneDark);
    expect(TOWN_PALETTE.sign).toBe(TOKEN_COLORS.lamp);
    expect(TOWN_PALETTE.ground).toBe(PLAZA_PALETTE.floor);
  });

  it("TOWN_LIT 은 일곱 단계 행(indoor·houseOwned 두 열뿐)이고 UI-SPEC 조명 표 값이다. 시민 편 밤은 둘 다 0 (P20-13)", () => {
    expect(TOWN_LIT).toEqual({
      talk: { indoor: 0.5, houseOwned: 0.3 },
      vote: { indoor: 0.8, houseOwned: 1 },
      trial: { indoor: 0.35, houseOwned: 0.06 },
      night: { indoor: 0.7, houseOwned: 0.7 },
      nightCitizen: { indoor: 0, houseOwned: 0 },
      nightGhost: { indoor: 0.7, houseOwned: 0.7 },
      morning: { indoor: 0.5, houseOwned: 0.3 },
    });
    // 주인 없는 집 창의 배율 열은 없다(늘 0 — 어두운 칸)
    for (const row of Object.values(TOWN_LIT)) expect(Object.keys(row).sort()).toEqual(["houseOwned", "indoor"]);
  });
});
