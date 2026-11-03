import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { FaceList } from "../../src/components/v2/FaceList";

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
