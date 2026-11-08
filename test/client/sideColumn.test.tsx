// 16-06: 오른쪽 세로 한 줄 열(D-05, V-2~V-5) — 칸 나누기 순수 함수, 열 부품, 52 원 단추 CSS 규칙.
import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "../helpers/singleLineErrors";
import { FloatAction } from "../../src/components/v2/FloatAction";
import { MapChip } from "../../src/components/v2/MapChip";
import { SideColumn, splitSideColumn } from "../../src/components/v2/SideColumn";

afterEach(cleanup);

const V2 = readFileSync(new URL("../../src/styles/v2.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [...V2.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: (m[1] ?? "").trim(), body: m[2] ?? "" }));
const body = (sel: string): string => rules.find((r) => r.selector === sel)?.body ?? "";

describe("splitSideColumn — 칸 나누기 (V-3)", () => {
  it("한 열에 들어가는 수 k = max(2, floor((maxH + 12) / 64)), 오른쪽 열부터 채운다", () => {
    expect(splitSideColumn(4, 244)).toEqual([4]);
    expect(splitSideColumn(4, 180)).toEqual([3, 1]); // 52·3 + 12·2 = 180 이라 세 칸이 딱 들어간다
    expect(splitSideColumn(4, 179)).toEqual([2, 2]);
    expect(splitSideColumn(3, 300)).toEqual([3]);
    expect(splitSideColumn(1, 0)).toEqual([1]);
  });

  it("한 열 최소 2개: 아주 낮아도 열은 두 칸씩 채운다", () => {
    expect(splitSideColumn(4, 116)).toEqual([2, 2]);
    expect(splitSideColumn(4, 0)).toEqual([2, 2]);
    expect(splitSideColumn(5, 116)).toEqual([2, 2, 1]);
  });

  it("칸이 없으면 열도 없다, 한 칸이면 [1]", () => {
    expect(splitSideColumn(0, 300)).toEqual([]);
    expect(splitSideColumn(1, 300)).toEqual([1]);
    expect(splitSideColumn(2, 10)).toEqual([2]);
  });

  it("칸 크기·간격·최소 값을 바꿔 부를 수 있다", () => {
    expect(splitSideColumn(6, 100, 40, 10, 1)).toEqual([2, 2, 2]);
    expect(splitSideColumn(3, 100, 40, 10, 3)).toEqual([3]);
  });
});

describe("SideColumn — 부품", () => {
  it("루트는 data-side-column 하나이고 열 div 가 오른쪽부터 놓인다 (soundSlot 이면 첫 칸은 aria-hidden 빈칸)", () => {
    const { container } = render(
      <SideColumn soundSlot maxHeight={300}>
        <button key="a" data-side-button="map" aria-label="맵" />
        <button key="b" data-side-button="bots" aria-label="봇" />
        <button key="c" data-side-button="dress" aria-label="옷장" />
      </SideColumn>,
    );
    expect(container.querySelectorAll("[data-side-column]")).toHaveLength(1);
    const cols = container.querySelectorAll(".mv-side__col");
    expect(cols).toHaveLength(1);
    const first = cols[0]!.firstElementChild!;
    expect(first.classList.contains("mv-side__slot")).toBe(true);
    expect(first.getAttribute("aria-hidden")).toBe("true");
    expect([...container.querySelectorAll("[data-side-button]")].map((e) => e.getAttribute("data-side-button"))).toEqual(["map", "bots", "dress"]);
  });

  it("soundSlot 이 아니면 빈칸이 없다", () => {
    const { container } = render(
      <SideColumn soundSlot={false} maxHeight={300}>
        <button key="a" data-side-button="dress" aria-label="옷장" />
      </SideColumn>,
    );
    expect(container.querySelector(".mv-side__slot")).toBeNull();
    expect(container.querySelectorAll(".mv-side__col")).toHaveLength(1);
  });

  it("넘치면 두 번째 열이 생기고 위부터 채워진다: 소리 · 맵 | 봇 · 옷장 (순서는 오른쪽 열 → 왼쪽 열)", () => {
    const { container } = render(
      <SideColumn soundSlot maxHeight={116}>
        <button key="a" data-side-button="map" aria-label="맵" />
        <button key="b" data-side-button="bots" aria-label="봇" />
        <button key="c" data-side-button="dress" aria-label="옷장" />
      </SideColumn>,
    );
    const cols = [...container.querySelectorAll(".mv-side__col")];
    expect(cols).toHaveLength(2);
    expect([...cols[0]!.children].map((e) => e.getAttribute("data-side-button") ?? "slot")).toEqual(["slot", "map"]);
    expect([...cols[1]!.children].map((e) => e.getAttribute("data-side-button"))).toEqual(["bots", "dress"]);
  });

  it("null 자식은 칸이 아니다 (꺼진 맵·봇)", () => {
    const { container } = render(
      <SideColumn soundSlot maxHeight={300}>
        {[null, null, <button key="c" data-side-button="dress" aria-label="옷장" />]}
      </SideColumn>,
    );
    expect(container.querySelectorAll("[data-side-button]")).toHaveLength(1);
    expect(container.querySelector(".mv-side__col")!.children).toHaveLength(2);
  });

  it("표식 값에 역할·좌석이 없다 (T-16-14)", () => {
    const { container } = render(
      <SideColumn soundSlot maxHeight={300}>
        <button key="a" data-side-button="dress" aria-label="옷장" />
      </SideColumn>,
    );
    expect(container.innerHTML).not.toMatch(/role|seat|mafia|nonce/i);
  });
});

describe("열 단추 표식·모양 (V-2)", () => {
  it("MapChip 은 data-side-button=map, 글·안쪽 원 요소가 없다", () => {
    const { container } = render(<MapChip choice="bar" host onPress={() => {}} />);
    const chip = container.querySelector("[data-map-chip]")!;
    expect(chip.getAttribute("data-side-button")).toBe("map");
    expect(chip.querySelector(".mf-mapchip__disc")).toBeNull();
    expect(chip.textContent).toBe("");
  });

  it("FloatAction 은 side 를 줄 때만 data-side-button 을 단다 (bots·dress), 글이 없다", () => {
    const { container } = render(
      <>
        <FloatAction kind="bots" side="bots" icon="bot" label="봇" onPress={() => {}} />
        <FloatAction kind="dress" side="dress" icon="hanger" label="옷장" onPress={() => {}} />
        <FloatAction kind="skip" icon="skip" label="넘기기" onPress={() => {}} />
      </>,
    );
    expect([...container.querySelectorAll("[data-float]")].map((e) => e.getAttribute("data-side-button"))).toEqual(["bots", "dress", null]);
    for (const e of container.querySelectorAll("[data-float]")) {
      expect(e.textContent).toBe("");
      expect(e.querySelector(".mv-float__face")).toBeNull();
    }
  });

  it("CSS: 열 단추(소리·맵·옆 단추)는 --control-button 52 원이고 면 night-700·테두리 night-600 이다", () => {
    for (const sel of [".mv-sound", ".mf-mapchip", '.mv-float[data-side-button]']) {
      const b = body(sel);
      expect(b, sel).toMatch(/width:\s*var\(--control-button\)/);
      expect(b, sel).toMatch(/height:\s*var\(--control-button\)/);
      expect(b, sel).toMatch(/border-radius:\s*var\(--radius-pill\)/);
    }
    for (const sel of [".mv-sound", ".mf-mapchip", ".mv-float"]) {
      expect(body(sel), sel).toMatch(/background:\s*var\(--night-700\)/);
      expect(body(sel), sel).toMatch(/border:\s*1px solid var\(--night-600\)/);
    }
  });

  it("CSS: 소리 잠김 알약은 단추 상자 자신이 늘어나고 독이 오른쪽 정렬이라 오른쪽 변이 움직이지 않는다", () => {
    expect(body(".mv-host__dock")).toMatch(/justify-content:\s*flex-end/);
    expect(body(".mv-sound--pill")).toMatch(/width:\s*auto/);
    expect(body(".mv-sound--pill")).toMatch(/min-width:\s*112px/);
  });

  it("CSS: 독 위 간격 12 = 띠 아래 간격 8 + 안쪽 위 여백 4 (독 아랫변 = 띠 아랫변 + 64)", () => {
    expect(body(".mv-host__dock")).toMatch(/padding-top:\s*var\(--space-xs\)/);
  });

  it("CSS: .mv-side 는 오른쪽 16, 위 = --mf-host-bottom + 12, 열은 row-reverse, 열 안 간격 12, 눌림 통과는 단추만 막는다", () => {
    const side = body(".mv-side");
    expect(side).toMatch(/position:\s*absolute/);
    expect(side).toMatch(/right:\s*var\(--space-md\)/);
    expect(side).toMatch(/top:\s*calc\(var\(--mf-host-bottom,\s*62px\)\s*\+\s*12px\)/);
    expect(side).toMatch(/flex-direction:\s*row-reverse/);
    expect(side).toMatch(/gap:\s*12px/);
    expect(side).toMatch(/z-index:\s*var\(--z-overlay\)/);
    expect(body(".mv-side__col")).toMatch(/flex-direction:\s*column/);
    expect(body(".mv-side__col")).toMatch(/gap:\s*12px/);
    expect(body(".mv-side__slot")).toMatch(/width:\s*var\(--control-button\)/);
  });

  it("CSS: 시트가 열려 있는 동안 열이 숨는다 (소리 단추와 같은 :has 규칙)", () => {
    expect(V2).toMatch(/\.mf-room:has\(\[data-sheet-layer\]\)\s+\.mv-side\s*\{[^}]*visibility:\s*hidden[^}]*pointer-events:\s*none/);
  });

  it("CSS: hex 색이 없다 (토큰만)", () => {
    for (const sel of [".mv-side", ".mv-side__col", ".mv-side__slot"]) expect(body(sel), sel).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
