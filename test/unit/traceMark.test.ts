import { describe, expect, it } from "vitest";
import { OUTFIT_IDS, TRACE_PIECE_IDS } from "../../shared/protocol";
import { TRACE_OF_OUTFIT } from "../../shared/game/trace";
import { TRACE_MARK, sameOutfitSeats } from "../../src/game/traceMark";
import { V2Icon } from "../../src/components/v2/V2Icon";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";

// 16-09 Task 1: 조각 표시 색 9종(UI-SPEC 흔적 표시 색)과 같은 옷 판정. 서버 새 값 없음 — 공개 look 과 조각의 함수다(R-3).

const NIGHT_900 = "#0e1326";

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("TRACE_MARK", () => {
  it("TRACE_PIECE_IDS 9개 모두가 키이고 UI-SPEC 표의 값이다", () => {
    expect(Object.keys(TRACE_MARK).sort()).toEqual([...TRACE_PIECE_IDS].sort());
    expect(TRACE_MARK).toEqual({
      button: "#b9864f",
      pin: "#d9dde6",
      whiteCloth: "#f4f1ea",
      blackCloth: "#6b7180",
      brownCloth: "#9a6238",
      pencil: "#ffc83d",
      grayThread: "#a9aebb",
      navyThread: "#5b7fd1",
      redCloth: "#d23c4e",
    });
  });

  it("모든 색이 night-900 위에서 3:1 이상이다", () => {
    for (const piece of TRACE_PIECE_IDS) expect(contrast(TRACE_MARK[piece], NIGHT_900)).toBeGreaterThanOrEqual(3);
  });

  it("색 9개는 서로 다르다", () => {
    expect(new Set(Object.values(TRACE_MARK)).size).toBe(9);
  });
});

describe("sameOutfitSeats", () => {
  const players = [
    { seat: 0, look: "police" as const },
    { seat: 1 },
    { seat: 2, look: "coat" as const },
    { seat: 3, look: "police" as const, alive: false },
    { seat: 4, look: "police" as const, alive: true },
    { seat: 5, look: "noir" as const },
  ];

  it("look 이 없으면 기본 의상(coat)으로 본다", () => {
    expect(sameOutfitSeats(players, "button")).toEqual([1, 2]);
  });

  it("죽은 사람은 빠지고 같은 의상 둘이면 둘 다 오름차순", () => {
    expect(sameOutfitSeats(players, "pin")).toEqual([0, 4]);
  });

  it("일치가 없으면 빈 배열", () => {
    expect(sameOutfitSeats(players, "pencil")).toEqual([]);
  });

  it("조각 → 의상 역표가 TRACE_OF_OUTFIT 과 어긋나지 않는다(모든 의상 하나씩)", () => {
    const all = OUTFIT_IDS.map((look, seat) => ({ seat, look }));
    for (const [seat, look] of OUTFIT_IDS.entries()) expect(sameOutfitSeats(all, TRACE_OF_OUTFIT[look])).toEqual([seat]);
  });

  it("입력을 바꾸지 않는다", () => {
    const copy = JSON.stringify(players);
    sameOutfitSeats(players, "pin");
    expect(JSON.stringify(players)).toBe(copy);
  });
});

describe("옛 장소 선 그림 삭제 (D-07, ASSET-01)", () => {
  it("V2Icon 소스에 place 로 시작하는 이름이 없고 thread·eye 는 그려진다", () => {
    const src = readFileSync("src/components/v2/V2Icon.tsx", "utf8");
    expect(src).not.toMatch(/\bplace[A-Z][a-z]+\b/);
    for (const name of ["thread", "eye"] as const) expect(renderToStaticMarkup(createElement(V2Icon, { name, size: 16 }))).toContain("<svg");
  });

  it("장소 → 아이콘 이름 함수와 15 흔적 카드 부품이 없다", () => {
    expect(readFileSync("src/game/placeText.ts", "utf8")).not.toContain(["place", "IconOf"].join(""));
    expect(() => readFileSync("src/components/v2/TraceCard.tsx", "utf8")).toThrow();
  });
});
