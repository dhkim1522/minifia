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
