import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { Table } from "../../src/components/Table";
import type { TableSeat } from "../../src/components/Table";

afterEach(cleanup);

const seat = (nickname: string, extra: Partial<TableSeat> = {}): TableSeat => ({
  nickname,
  connected: true,
  isHost: false,
  isMe: false,
  isAlly: false,
  ...extra,
});

// 8칸 가운데 0·1·3 에만 사람이 앉아 있다. 내 자리는 1.
const seats = (over: Partial<Record<number, Partial<TableSeat>>> = {}): (TableSeat | null)[] => [
  seat("민수", over[0]),
  seat("서준", { isMe: true, ...over[1] }),
  null,
  seat("하윤", over[3]),
  null,
  null,
  null,
  null,
];

const group = () => screen.getByRole("group", { name: "테이블" });

describe("Table (S-03 원근 테이블)", () => {
  it("앉은 사람마다 인물 그림이 하나씩 있고 빈 자리에는 아무것도 그리지 않는다", () => {
    render(<Table seats={seats()} mySeat={1} />);
    expect(group().querySelectorAll("img").length).toBe(3);
    expect(group().querySelector("svg") === null).toBe(true);
    expect(group().querySelector(".mf-chair") === null).toBe(true);
  });

  it("이름표는 닉네임, 내 자리는 '{닉네임} (나)' 이고 title 에 전체 닉네임이 있다", () => {
    render(<Table seats={seats()} mySeat={1} />);
    expect(within(group()).getByText("민수")).toBeTruthy();
    expect(within(group()).getByText("서준 (나)")).toBeTruthy();
    expect(within(group()).getByText("하윤")).toBeTruthy();
    expect(within(group()).getByTitle("민수")).toBeTruthy();
    expect(within(group()).getByTitle("서준")).toBeTruthy();
    expect(within(group()).getByTitle("하윤")).toBeTruthy();
  });

  it("방장 자리에만 '방장' 글자가 정확히 하나 있다", () => {
    render(<Table seats={seats({ 0: { isHost: true } })} mySeat={1} />);
    expect(within(group()).getAllByText("방장").length).toBe(1);
  });

  it("방장이 없으면 '방장' 글자가 없다", () => {
    render(<Table seats={seats()} mySeat={1} />);
    expect(within(group()).queryByText("방장") === null).toBe(true);
  });

  it("끊긴 사람은 인물이 흑백(mf-figure--disconnected) 이고 자리 접근성 이름이 '{닉네임}, 연결 끊김' 이다", () => {
    render(<Table seats={seats({ 3: { connected: false } })} mySeat={1} />);
    const seatEl = screen.getByRole("group", { name: "하윤, 연결 끊김" });
    expect(seatEl.querySelector("img")?.classList.contains("mf-figure--disconnected")).toBe(true);
    // 연결된 사람 인물은 흑백이 아니다
    const gray = group().querySelectorAll("img.mf-figure--disconnected");
    expect(gray.length).toBe(1);
  });

  it("연결된 사람의 접근성 이름은 닉네임뿐이다", () => {
    render(<Table seats={seats()} mySeat={1} />);
    expect(screen.getByRole("group", { name: "민수" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "서준 (나)" })).toBeTruthy();
  });

  it("isAlly 자리에만 aria-label '동료' 표시가 있다", () => {
    render(<Table seats={seats({ 3: { isAlly: true } })} mySeat={1} />);
    const marks = group().querySelectorAll('[aria-label="동료"]');
    expect(marks.length).toBe(1);
    expect(screen.getByRole("group", { name: "하윤" }).querySelector('[aria-label="동료"]')).not.toBeNull();
  });

  it("아무도 isAlly 가 아니면 동료 표시가 없다", () => {
    render(<Table seats={seats()} mySeat={1} />);
    expect(group().querySelector('[aria-label="동료"]') === null).toBe(true);
  });

  it("동료가 둘이면 그 두 자리마다 하나씩 있다", () => {
    render(<Table seats={seats({ 0: { isAlly: true }, 3: { isAlly: true } })} mySeat={1} />);
    expect(group().querySelectorAll('[aria-label="동료"]').length).toBe(2);
  });

  it("방장 배지와 동료 표시는 서로 다른 자리 요소에 있어 겹치지 않는다(방장 = 동료 아닌 자리)", () => {
    render(<Table seats={seats({ 0: { isHost: true }, 3: { isAlly: true } })} mySeat={1} />);
    expect(group().querySelectorAll(".mf-badge").length).toBe(1);
    expect(group().querySelectorAll('[aria-label="동료"]').length).toBe(1);
  });

  it("내 자리(mySeat)의 인물은 가운데(left 50%) 맨 아래에 놓인다", () => {
    render(<Table seats={seats()} mySeat={1} />);
    const mine = screen.getByRole("group", { name: "서준 (나)" });
    expect(parseFloat(mine.style.left)).toBeCloseTo(50, 5);
    const other = screen.getByRole("group", { name: "민수" });
    expect(parseFloat(other.style.top)).toBeLessThan(parseFloat(mine.style.top));
  });

  it("내 자리 발밑에 링이 있고 다른 사람에게는 없다", () => {
    render(<Table seats={seats()} mySeat={1} />);
    const mine = screen.getByRole("group", { name: "서준 (나)" });
    expect(mine.querySelector(".mf-seat__ring--me")).not.toBeNull();
    expect(screen.getByRole("group", { name: "민수" }).querySelector(".mf-seat__ring--me") === null).toBe(true);
  });

  it("이름표는 크기 변환(scale) 바깥의 따로 층에 있다", () => {
    render(<Table seats={seats()} mySeat={1} />);
    const tag = within(group()).getByTitle("민수");
    expect(tag.closest(".mf-seat") === null).toBe(true);
    expect(tag.style.transform).not.toContain("scale");
  });

  it("pressable 자리를 누르면 onSeatPress(seat 번호)가 불리고 아닌 자리에는 버튼이 없다", () => {
    const onPress = vi.fn();
    render(<Table seats={seats({ 3: { pressable: true, connected: false } })} mySeat={1} onSeatPress={onPress} />);
    expect(group().querySelectorAll("button").length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "하윤, 연결 끊김" }));
    expect(onPress).toHaveBeenCalledWith(3);
  });

  it("dimmed 이면 막(.mf-table__scrim)이 있고 아니면 없다", () => {
    const { container, rerender } = render(<Table seats={seats()} mySeat={1} />);
    expect(container.querySelector(".mf-table__scrim") === null).toBe(true);
    rerender(<Table seats={seats()} mySeat={1} dimmed />);
    expect(container.querySelector(".mf-table__scrim")).not.toBeNull();
  });

  it("dimmed 에서도 동료 표시는 하나씩만 있다(막 위층)", () => {
    render(<Table seats={seats({ 3: { isAlly: true } })} mySeat={1} dimmed />);
    expect(group().querySelectorAll('[aria-label="동료"]').length).toBe(1);
  });

  it("기본 접근성 이름은 '테이블' 이고 label 로 바꿀 수 있다", () => {
    render(<Table seats={seats()} mySeat={1} label="대기실 테이블" />);
    expect(screen.getByRole("group", { name: "대기실 테이블" })).toBeTruthy();
  });

  it("닉네임은 텍스트로만 그려진다(HTML 로 해석되지 않는다)", () => {
    const { container } = render(<Table seats={[seat("<b>영희</b>", { isMe: true })]} mySeat={0} />);
    expect(screen.getByText("<b>영희</b> (나)")).toBeTruthy();
    expect(container.querySelector("b") === null).toBe(true);
  });
});

describe("TableSeat 타입 (D-22, T-01-38)", () => {
  it("역할 키를 넣을 수 없다", () => {
    // @ts-expect-error TableSeat 에는 role 이 없다 — 역할은 이 부품의 입력이 될 수 없다
    const withRole: TableSeat = { ...seat("민수"), role: "mafia" };
    expect("role" in seat("민수")).toBe(false);
    expect(withRole.nickname).toBe("민수");
  });
});
