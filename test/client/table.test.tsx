import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { seatLayout } from "../../shared/seatLayout";
import { Icon } from "../../src/components/Icon";
import type { IconName } from "../../src/components/Icon";
import { Table } from "../../src/components/Table";
import type { TableFloat, TableSeat } from "../../src/components/Table";

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

// ---- 02-07 Task 1: 머리 위 말풍선·이모티콘·공개 말풍선 ----
const FIG_H = 21.33;
const NEW_ICONS: IconName[] = ["plus", "skip", "chat", "smile", "grin", "surprised", "suspicious", "angry", "sad", "heart", "exclaim"];
const bubble = (text: string, over: Partial<Extract<TableFloat, { kind: "bubble" }>> = {}): TableFloat => ({
  key: "b1",
  z: 1,
  kind: "bubble",
  text,
  ...over,
});
const floatLayers = () => Array.from(group().querySelectorAll<HTMLElement>(".mf-float"));

describe("Icon 11개 추가 (D-16)", () => {
  it.each(NEW_ICONS)("%s 는 24×24 svg 로 그려진다", (name) => {
    const { container } = render(<Icon name={name} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.querySelectorAll("path,circle,rect").length).toBeGreaterThan(0);
  });
});

describe("SeatFloat 층 (D-04, D-16)", () => {
  it("말풍선은 .mf-bubble 에 글자가 들어가고 층은 aria-hidden 이며 left 가 clamp 로 갇힌다", () => {
    render(<Table seats={seats({ 3: { float: bubble("하윤 의심돼요") } })} mySeat={1} />);
    const el = within(group()).getByText("하윤 의심돼요");
    expect(el.classList.contains("mf-bubble")).toBe(true);
    const layer = el.closest<HTMLElement>(".mf-float");
    expect(layer?.getAttribute("aria-hidden")).toBe("true");
    expect(layer?.style.left).toMatch(/^clamp\(70px, [\d.]+%, calc\(100% - 70px\)\)$/);
  });

  it("이모티콘은 .mf-react 안에 svg 하나다", () => {
    render(<Table seats={seats({ 0: { float: { key: "e1", z: 1, kind: "emoji", icon: "heart" } } })} mySeat={1} />);
    const react = group().querySelector(".mf-react");
    expect(react?.querySelectorAll("svg").length).toBe(1);
  });

  it("공개 말풍선: dim 이면 흐림 클래스, animate 이면 팝·흔들림 클래스, animate false 면 팝 클래스가 없다", () => {
    const reveal = (animate: boolean): TableFloat => ({ key: "r1", z: 1, kind: "reveal", text: "말 안 함", dim: true, animate });
    const { unmount } = render(<Table seats={seats({ 3: { float: reveal(true) } })} mySeat={1} />);
    const on = within(group()).getByText("말 안 함");
    expect(on.classList.contains("mf-bubble--dim")).toBe(true);
    expect(on.classList.contains("mf-bubble--pop")).toBe(true);
    expect(on.classList.contains("mf-bubble--shake")).toBe(true);
    unmount();
    render(<Table seats={seats({ 3: { float: reveal(false) } })} mySeat={1} />);
    const off = within(group()).getByText("말 안 함");
    expect(off.classList.contains("mf-bubble--dim")).toBe(true);
    expect(off.classList.contains("mf-bubble--pop")).toBe(false);
    expect(off.classList.contains("mf-bubble--shake")).toBe(false);
  });

  it("공개 말풍선이 dim 이 아니면 흐림 클래스가 없다", () => {
    const f: TableFloat = { key: "r1", z: 1, kind: "reveal", text: "경찰", dim: false, animate: true };
    render(<Table seats={seats({ 3: { float: f } })} mySeat={1} />);
    expect(within(group()).getByText("경찰").classList.contains("mf-bubble--dim")).toBe(false);
  });

  it("elapsedMs 1000 이면 애니메이션이 그 시점부터 이어진다(음수 animation-delay)", () => {
    render(<Table seats={seats({ 3: { float: bubble("안녕", { elapsedMs: 1000 }) } })} mySeat={1} />);
    expect(within(group()).getByText("안녕").style.animationDelay).toBe("-1000ms");
  });

  it("elapsedMs 가 없으면 animation-delay 를 쓰지 않는다", () => {
    render(<Table seats={seats({ 3: { float: bubble("안녕") } })} mySeat={1} />);
    expect(within(group()).getByText("안녕").style.animationDelay).toBe("");
  });

  it("z 큰 것이 위이고 둘 다 이름표 층(25)보다 위다", () => {
    render(
      <Table seats={seats({ 0: { float: bubble("가", { key: "a", z: 1 }) }, 3: { float: bubble("나", { key: "b", z: 2 }) } })} mySeat={1} />,
    );
    const [a, b] = ["가", "나"].map((t) => within(group()).getByText(t).closest<HTMLElement>(".mf-float")!);
    expect(Number(b.style.zIndex)).toBeGreaterThan(Number(a.style.zIndex));
    expect(Number(a.style.zIndex)).toBeGreaterThan(25);
  });

  it("층 top 은 앞쪽 자리 headTop − 1%, 뒤쪽 자리 headTop − 8%", () => {
    const all = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i === 1 ? seat("앞", { isMe: true, float: bubble("앞", { key: "f" }) }) : i === 5 ? seat("뒤", { float: bubble("뒤말", { key: "g" }) }) : null));
    render(<Table seats={all} mySeat={1} />);
    const top = (t: string) => parseFloat(within(group()).getByText(t).closest<HTMLElement>(".mf-float")!.style.top);
    const front = seatLayout(1, 1);
    const back = seatLayout(5, 1);
    expect(front.depth).toBeGreaterThanOrEqual(0.5);
    expect(back.depth).toBeLessThan(0.5);
    expect(top("앞")).toBeCloseTo(front.y - FIG_H * front.scale - 1, 2);
    expect(top("뒤말")).toBeCloseTo(back.y - FIG_H * back.scale - 8, 2);
  });

  it("float 없는 자리에는 층 요소가 없다", () => {
    render(<Table seats={seats()} mySeat={1} />);
    expect(floatLayers().length).toBe(0);
  });

  it("말풍선 글자는 텍스트로만 그려진다", () => {
    render(<Table seats={seats({ 3: { float: bubble("<i>x</i>") } })} mySeat={1} />);
    expect(group().querySelector("i") === null).toBe(true);
  });
});
