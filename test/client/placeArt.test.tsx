import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { PLACE_IDS, TRACE_PIECE_IDS } from "../../shared/protocol";
import { PlaceArt, TraceArt } from "../../src/components/v2/placeArt";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// 16-02: 컬러 에셋 25개 렌더 시험. 하이픈 속성이 남으면 React 가 콘솔 경고를 낸다 — 경고 0 을 고정한다(V-26).
// 이름(label)을 주면 이미지로 읽히고 안 주면 장식으로 숨는다.

const CASES: { name: string; draw: (label?: string) => ReturnType<typeof render> }[] = [
  ...PLACE_IDS.map((id) => ({ name: `장소 ${id}`, draw: (label?: string) => render(<PlaceArt id={id} size={44} label={label} />) })),
  ...TRACE_PIECE_IDS.map((piece) => ({ name: `조각 ${piece}`, draw: (label?: string) => render(<TraceArt piece={piece} size={44} label={label} />) })),
];

describe("PlaceArt·TraceArt", () => {
  it.each(CASES)("$name: svg 하나, viewBox 0 0 48 48, width·height 가 size, 도형 1개 이상", ({ draw }) => {
    const { container } = draw();
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(1);
    const svg = svgs[0] as SVGSVGElement;
    expect(svg.getAttribute("viewBox")).toBe("0 0 48 48");
    expect(svg.getAttribute("width")).toBe("44");
    expect(svg.getAttribute("height")).toBe("44");
    expect(svg.querySelectorAll("circle, ellipse, path, rect").length).toBeGreaterThan(0);
  });

  it.each(CASES)("$name: label 을 주면 role=img·aria-label", ({ draw }) => {
    const { container } = draw("이름");
    const svg = container.querySelector("svg") as SVGSVGElement;
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("이름");
    expect(svg.hasAttribute("aria-hidden")).toBe(false);
  });

  it.each(CASES)("$name: label 이 없으면 aria-hidden 장식이고 role 이 없다", ({ draw }) => {
    const { container } = draw();
    const svg = container.querySelector("svg") as SVGSVGElement;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
    expect(svg.hasAttribute("role")).toBe(false);
    expect(svg.hasAttribute("aria-label")).toBe(false);
  });

  it("25개를 그리는 동안 console.error·console.warn 호출이 0 이다", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const c of CASES) {
      c.draw();
      c.draw("이름");
      cleanup();
    }
    expect(err.mock.calls.length).toBe(0);
    expect(warn.mock.calls.length).toBe(0);
    expect(CASES.length).toBe(25);
  });

  it("className 은 svg 루트에 붙는다", () => {
    const { container } = render(<PlaceArt id="glass" size={32} className="x-art" />);
    expect(container.querySelector("svg")?.getAttribute("class")).toBe("x-art");
  });
});
