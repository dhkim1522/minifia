import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { FaceList } from "../../src/components/v2/FaceList";
import { V2Icon, type V2IconName } from "../../src/components/v2/V2Icon";

afterEach(cleanup);

// 09-05: 경찰·의사 얼굴 목록(NIGHT-09). 승인 v2.0 FaceList 를 옮긴 부품 — props 의 id 대신 seat.
const face = (seat: number, name = `이름${seat}`) => ({ seat, name, img: `/characters/faces/face-${seat % 8}.png`, color: `var(--seat-${(seat % 8) + 1})` });

describe("FaceList — 칸 하나 누르기 (E1 #3)", () => {
  it("3칸: button 3개, data-face 는 seat, 모두 aria-pressed=false", () => {
    const { container } = render(<FaceList faces={[face(0), face(2), face(5)]} label="조사할 사람" />);
    const root = container.querySelector("[data-face-list]");
    expect(root?.getAttribute("role")).toBe("group");
    expect(root?.getAttribute("aria-label")).toBe("조사할 사람");
    const btns = [...container.querySelectorAll("button[data-face]")];
    expect(btns.map((b) => b.getAttribute("data-face"))).toEqual(["0", "2", "5"]);
    expect(btns.every((b) => b.getAttribute("type") === "button" && b.getAttribute("aria-pressed") === "false")).toBe(true);
  });

  it("둘째 칸 클릭 → onPick(그 seat) 한 번", () => {
    const onPick = vi.fn();
    const { container } = render(<FaceList faces={[face(0), face(2), face(5)]} onPick={onPick} />);
    fireEvent.click(container.querySelector('button[data-face="2"]')!);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(2);
  });

  it("value 칸은 aria-pressed=true 이고 다시 눌러도 onPick 을 부르지 않는다(취소 없음)", () => {
    const onPick = vi.fn();
    const { container } = render(<FaceList faces={[face(0), face(2), face(5)]} value={2} onPick={onPick} />);
    const on = container.querySelector('button[data-face="2"]')!;
    expect(on.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(on);
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(container.querySelector('button[data-face="5"]')!);
    expect(onPick).toHaveBeenCalledWith(5);
  });

  it("기본 접근성 이름은 닉네임, ariaLabel 로 바꿀 수 있다", () => {
    render(<FaceList faces={[face(1, "민지")]} ariaLabel={(n) => `${n} 조사`} />);
    expect(screen.getByRole("button", { name: "민지 조사" })).toBeTruthy();
  });
});

// bundle.js ICONS 의 정의(design/v2.0/design-system/components/bundle.js 33~38행)에서 옮긴 기대 경로. 원 요소는 ["c", cx, cy, r].
const NIGHT_ICONS: Readonly<Record<"quill" | "note" | "target" | "eye" | "heal", { paths: readonly string[]; circles: readonly (readonly number[])[] }>> = {
  quill: { paths: ["M20 4c-6.5 1-11 5.5-13 11.5L5.5 20", "M20 4c.6 5.5-3.5 10-9.5 11.5", "M9.5 15L6.8 12.3"], circles: [] },
  note: { paths: ["M6 3h9l4 4v14H6z", "M15 3v4h4", "M9 12h7", "M9 16h5"], circles: [] },
  target: { paths: ["M12 1.5v3.5", "M12 19v3.5", "M1.5 12H5", "M19 12h3.5"], circles: [[12, 12, 8], [12, 12, 3]] },
  eye: { paths: ["M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"], circles: [[12, 12, 3]] },
  heal: { paths: ["M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z"], circles: [] },
};

describe("V2Icon 9페이즈 아이콘 (quill·note·target·eye·heal)", () => {
  it.each(Object.keys(NIGHT_ICONS) as (keyof typeof NIGHT_ICONS)[])("%s 는 24 격자 선 2 currentColor 이고 경로가 bundle.js 와 같다", (name) => {
    const iconName: V2IconName = name;
    const { container } = render(<V2Icon name={iconName} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("stroke-width")).toBe("2");
    const want = NIGHT_ICONS[name];
    expect([...container.querySelectorAll("svg path")].map((p) => p.getAttribute("d"))).toEqual(want.paths);
    expect([...container.querySelectorAll("svg circle")].map((c) => [Number(c.getAttribute("cx")), Number(c.getAttribute("cy")), Number(c.getAttribute("r"))])).toEqual(want.circles);
  });
});

const V2_CSS = readFileSync("src/styles/v2.css", "utf8");
const rulesStarting = (selector: string): string[] => {
  const bare = V2_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => (m[1] ?? "").split(",").some((s) => s.trim().startsWith(selector)))
    .map((m) => `${m[1]}{${m[2]}}`);
};

describe("FaceList — 고른 칸·줄바꿈·그림 실패·칸 수 (E1 #2~#5)", () => {
  it("value 칸만 is-on 이고 오른쪽 위 원(.mv-face__mark) 안에 icon 아이콘이 있다", () => {
    const { container } = render(<FaceList faces={[face(0), face(1)]} value={1} icon="eye" />);
    const on = container.querySelector('button[data-face="1"]')!;
    expect(on.classList.contains("is-on")).toBe(true);
    expect(on.querySelector(".mv-face__mark svg")).toBeTruthy();
    const off = container.querySelector('button[data-face="0"]')!;
    expect(off.classList.contains("is-on")).toBe(false);
    expect(off.querySelector(".mv-face__mark")).toBeNull();
  });

  it("icon 이 없으면 고른 칸 원 안에 V 체크가 그려진다(빈 원 금지)", () => {
    const { container } = render(<FaceList faces={[face(0)]} value={0} />);
    expect(container.querySelector(".mv-face__mark")).toBeTruthy();
    expect(container.querySelector(".mv-face__mark svg")).toBeTruthy();
  });

  it("img error → data-face-fallback=true, 자리 구분색 원으로 대신하고 이름·선택은 그대로", () => {
    const onPick = vi.fn();
    const { container } = render(<FaceList faces={[face(3, "가나다라마바사아")]} onPick={onPick} />);
    const btn = container.querySelector('button[data-face="3"]')!;
    expect(btn.getAttribute("data-face-fallback")).toBeNull();
    fireEvent.error(btn.querySelector("img")!);
    expect(btn.getAttribute("data-face-fallback")).toBe("true");
    expect(btn.querySelector("img")).toBeNull();
    expect(btn.querySelector(".mv-face--fallback") ?? btn.querySelector(".mv-face__fallback")).toBeTruthy();
    expect(btn.querySelector(".mv-face__name")?.textContent).toBe("가나다라마바사아");
    fireEvent.click(btn);
    expect(onPick).toHaveBeenCalledWith(3);
  });

  it("disabled 칸은 aria-disabled=true 이고 눌러도 onPick 을 부르지 않는다", () => {
    const onPick = vi.fn();
    const { container } = render(<FaceList faces={[face(0), { ...face(1), disabled: true }]} onPick={onPick} />);
    const blocked = container.querySelector('button[data-face="1"]')!;
    expect(blocked.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(blocked);
    expect(onPick).not.toHaveBeenCalled();
    expect(container.querySelector('button[data-face="0"]')!.getAttribute("aria-disabled")).toBeNull();
  });

  it("목록 disabled 이면 모든 칸이 aria-disabled", () => {
    const { container } = render(<FaceList faces={[face(0), face(1)]} disabled />);
    expect([...container.querySelectorAll("button")].every((b) => b.getAttribute("aria-disabled") === "true")).toBe(true);
  });

  it.each([1, 4, 5, 8])("%i칸이어도 칸 수가 그대로이고 .mv-faces 하나가 4열이다", (n) => {
    const { container } = render(<FaceList faces={Array.from({ length: n }, (_, i) => face(i))} />);
    expect(container.querySelectorAll("button[data-face]").length).toBe(n);
    expect(container.querySelectorAll(".mv-faces").length).toBe(1);
    const grid = rulesStarting(".mv-faces").filter((r) => /^\s*\.mv-faces\s*\{/.test(r)).join("");
    expect(grid).toMatch(/display:\s*grid/);
    expect(grid).toMatch(/grid-template-columns:\s*repeat\(4,/);
  });

  it("8자 닉네임: 이름은 줄바꿈 가능(keep-all·anywhere)이고 말줄임·nowrap·line-clamp 가 없다", () => {
    const name = rulesStarting(".mv-face__name").join("");
    expect(name).toMatch(/word-break:\s*keep-all/);
    expect(name).toMatch(/overflow-wrap:\s*anywhere/);
    expect(name).not.toMatch(/nowrap|ellipsis|line-clamp/);
    expect(name).toMatch(/font-size:\s*14px/);
    expect(name).toMatch(/font-weight:\s*700/);
  });

  it("닉네임은 글자로만 그린다(T-09-08): <b> 문자열이 요소가 되지 않는다", () => {
    const { container } = render(<FaceList faces={[face(0, "<b>해킹</b>")]} />);
    expect(container.querySelector(".mv-face__name b")).toBeNull();
    expect(container.querySelector(".mv-face__name")?.textContent).toBe("<b>해킹</b>");
    expect(container.querySelector("button")!.getAttribute("aria-label")).toBe("<b>해킹</b>");
  });

  it("고른 칸 테두리 2px gray-100, 안 고른 칸은 brightness .85 saturate .85 (E1 #3)", () => {
    const face_ = rulesStarting(".mv-face").filter((r) => /^\s*\.mv-face\s*\{/.test(r)).join("");
    expect(face_).toMatch(/border:\s*2px solid transparent/);
    // 승인 bundle.css 처럼 얼굴 그림에만 건다(이름·점은 어둡게 하지 않는다)
    expect(rulesStarting(".mv-face__img").join("")).toMatch(/brightness\(0?\.85\)\s*saturate\(0?\.85\)/);
    expect(rulesStarting(".mv-face.is-on .mv-face__img").join("")).toMatch(/filter:\s*none/);
    expect(rulesStarting(".mv-face.is-on").join("")).toMatch(/border-color:\s*var\(--gray-100\)/);
    expect(rulesStarting(".mv-face__mark").join("")).toMatch(/width:\s*26px/);
  });

  it("얼굴 목록 CSS 에 진홍·놋쇠가 없고 hex 색도 없다(경찰·의사 같은 생김새, T-09-09)", () => {
    const css = rulesStarting(".mv-face").join("\n");
    expect(css.length).toBeGreaterThan(0);
    expect(css).not.toMatch(/crimson|brass|#[0-9a-fA-F]{3,8}\b/);
    const tsx = readFileSync("src/components/v2/FaceList.tsx", "utf8").replace(/^\s*\/\/.*$/gm, "");
    expect(tsx).not.toMatch(/crimson|brass|dangerouslySetInnerHTML|innerHTML/);
  });
});

describe("FaceList — 마피아 합의 배지 tally·sure (15페이즈 D-05, 결정 0074)", () => {
  const faces = [face(0), face(2), face(5)];

  it("tally·sure 가 없으면 배지 요소가 없고 고른 칸의 svg 는 원 안 V 체크 하나뿐이다", () => {
    const { container } = render(<FaceList faces={faces} value={2} />);
    expect(container.querySelector(".mv-face__count")).toBeNull();
    expect(container.querySelectorAll("[data-face] svg")).toHaveLength(1);
    expect(container.querySelector(".mv-face__mark svg")).not.toBeNull();
  });

  it("tally 는 1 이상인 칸에 숫자 배지, sure 칸은 숫자 대신 check(접근성 이름 '확정')", () => {
    const { container } = render(<FaceList faces={faces} tally={new Map([[0, 1], [2, 2], [5, 0]])} sure={2} />);
    expect(container.querySelector('[data-face="0"] .mv-face__count')?.textContent).toBe("1");
    const sure = container.querySelector('[data-face="2"] .mv-face__count');
    expect(sure?.getAttribute("aria-label")).toBe("확정");
    expect(sure?.querySelector("svg")).not.toBeNull();
    expect(sure?.textContent).toBe("");
    expect(container.querySelector('[data-face="5"] .mv-face__count')).toBeNull();
  });

  it("배지가 있어도 칸 수·순서·클래스·aria-disabled 는 같고 배지는 절대 위치 css 다(칸 크기를 바꾸지 않는다)", () => {
    const plain = render(<FaceList faces={faces} value={0} />);
    const sig = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>("[data-face]")].map((b) => [b.dataset.face, b.className, b.getAttribute("aria-disabled")]);
    const base = sig(plain.container);
    cleanup();
    const badged = render(<FaceList faces={faces} value={0} tally={new Map([[2, 3]])} />);
    expect(sig(badged.container)).toEqual(base);
    expect(rulesStarting(".mv-face__count").join("")).toMatch(/position:\s*absolute/);
  });
});
