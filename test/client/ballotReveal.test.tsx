import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "../helpers/singleLineErrors";
import { BallotReveal } from "../../src/components/v2/BallotReveal";
import type { Voter } from "../../src/game/ballotsView";

afterEach(cleanup);

const NAMES = ["서연", "민준", "도윤", "지호", "하윤", "태오", "하은", "지우"];
const voter = (seat: number, me = false): Voter => ({ seat, name: NAMES[seat]!, color: `var(--seat-${seat + 1})`, me });

const YES = [voter(0), voter(2), voter(4)];
const NO = [voter(1, true), voter(3)];

const side = (c: HTMLElement, s: "yes" | "no") => c.querySelector<HTMLElement>(`[data-ballot-side="${s}"]`)!;
const seats = (el: HTMLElement) => [...el.querySelectorAll("[data-ballot-seat]")].map((n) => n.getAttribute("data-ballot-seat"));

describe("BallotReveal — 두 묶음 (UI-SPEC C-2)", () => {
  it("루트는 role=status + data-ballots, 눈에 보이는 묶음은 aria-hidden 이고 요약 한 줄이 있다", () => {
    const { container } = render(<BallotReveal yes={YES} no={NO} stage="both" />);
    const root = container.querySelector("[data-ballots]")!;
    expect(root.getAttribute("role")).toBe("status");
    expect(root.querySelector(".mv-sr")?.textContent).toBe("찬성 3명: 서연, 도윤, 하윤. 반대 2명: 민준, 지호.");
    expect(root.querySelector(".mv-ballots__body")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("찬성 묶음이 DOM 에서 반대 묶음보다 앞(위)이고 머리에 수가 있다", () => {
    const { container } = render(<BallotReveal yes={YES} no={NO} stage="both" />);
    const groups = [...container.querySelectorAll("[data-ballot-side]")].map((n) => n.getAttribute("data-ballot-side"));
    expect(groups).toEqual(["yes", "no"]);
    expect(side(container, "yes").querySelector(".mv-ballots__head")?.textContent).toBe("찬성 3");
    expect(side(container, "no").querySelector(".mv-ballots__head")?.textContent).toBe("반대 2");
  });

  it("알약은 자리 번호 오름차순(받은 순서 그대로)이고 변론자·미투표자는 어느 묶음에도 없다", () => {
    const { container } = render(<BallotReveal yes={YES} no={NO} stage="both" />);
    expect(seats(side(container, "yes"))).toEqual(["0", "2", "4"]);
    expect(seats(side(container, "no"))).toEqual(["1", "3"]);
    // 5·6·7 은 투표하지 않았다
    expect(container.querySelector('[data-ballot-seat="5"]')).toBeNull();
  });

  it("0명 묶음도 머리를 그린다", () => {
    const { container } = render(<BallotReveal yes={[]} no={[voter(1)]} stage="both" />);
    expect(side(container, "yes").querySelector(".mv-ballots__head")?.textContent).toBe("찬성 0");
    expect(side(container, "yes").querySelectorAll("[data-ballot-seat]").length).toBe(0);
  });

  it("알약: 얼굴 24px 이미지(자리 구분색 테두리) + 이름, 내 알약만 is-me 이고 '(나)' 글자는 없다", () => {
    const { container } = render(<BallotReveal yes={YES} no={NO} stage="both" />);
    const pill = container.querySelector<HTMLElement>('[data-ballot-seat="0"]')!;
    expect(pill.querySelector("img")?.getAttribute("src")).toBe("/characters/faces/face-0.png");
    expect(pill.querySelector(".mv-ballots__name")?.textContent).toBe("서연");
    expect(pill.style.getPropertyValue("--ballot-seat")).toBe("var(--seat-1)");
    expect(container.querySelector('[data-ballot-seat="1"]')?.classList.contains("is-me")).toBe(true);
    expect(container.querySelectorAll(".is-me").length).toBe(1);
    expect(container.textContent).not.toContain("(나)");
  });

  it("얼굴 그림이 실패하면 자리 구분색 원으로 바뀐다", () => {
    const { container } = render(<BallotReveal yes={[voter(0)]} no={[]} stage="both" />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".mv-ballots__face.is-fallback")).not.toBeNull();
  });

  it("역할 칩·역할 단어가 DOM 에 없다 (T-09.1.1-33)", () => {
    const { container } = render(<BallotReveal yes={YES} no={NO} stage="both" />);
    expect(container.querySelector("[data-role-chip]")).toBeNull();
    expect(container.textContent).not.toMatch(/마피아|경찰|의사|시민/);
  });

  it("이름은 텍스트 노드다 — 마크업이 들어간 닉네임도 요소를 만들지 않는다 (T-09.1.1-34)", () => {
    const evil: Voter = { seat: 0, name: "<img src=x onerror=alert(1)>", color: "var(--seat-1)", me: false };
    const { container } = render(<BallotReveal yes={[evil]} no={[]} stage="both" />);
    expect(container.querySelectorAll("img").length).toBe(1); // 얼굴 하나뿐
    expect(container.querySelector(".mv-ballots__name")?.textContent).toBe("<img src=x onerror=alert(1)>");
  });
});

describe("BallotReveal — 단계와 등장", () => {
  it("stage yes: 반대 묶음은 아직 보이지 않는다(자리는 잡혀 있다)", () => {
    const { container } = render(<BallotReveal yes={YES} no={NO} stage="yes" />);
    expect(side(container, "yes").classList.contains("is-pending")).toBe(false);
    expect(side(container, "no").classList.contains("is-pending")).toBe(true);
  });

  it("stage none: 두 묶음 모두 보이지 않고 요약도 읽히지 않는다", () => {
    const { container } = render(<BallotReveal yes={YES} no={NO} stage="none" />);
    expect(side(container, "yes").classList.contains("is-pending")).toBe(true);
    expect(side(container, "no").classList.contains("is-pending")).toBe(true);
    expect(container.querySelector(".mv-sr")).toBeNull();
  });

  it("yes → both 로 가면 반대 묶음이 올라오며 나타난다(is-enter)", () => {
    const { container, rerender } = render(<BallotReveal yes={YES} no={NO} stage="yes" />);
    expect(side(container, "yes").classList.contains("is-enter")).toBe(true);
    expect(side(container, "no").classList.contains("is-enter")).toBe(false);
    rerender(<BallotReveal yes={YES} no={NO} stage="both" />);
    expect(side(container, "no").classList.contains("is-pending")).toBe(false);
    expect(side(container, "no").classList.contains("is-enter")).toBe(true);
  });

  it("instant 면 애니메이션 없이 바로 보인다", () => {
    const { container } = render(<BallotReveal yes={YES} no={NO} stage="both" instant />);
    expect(container.querySelector(".is-enter")).toBeNull();
    expect(container.querySelector(".is-pending")).toBeNull();
  });

  it("reducedMotion 이면 처음부터 보이고 애니메이션 클래스가 없다", () => {
    const { container } = render(<BallotReveal yes={YES} no={NO} stage="none" reducedMotion />);
    expect(container.querySelector(".is-enter")).toBeNull();
    expect(container.querySelector(".is-pending")).toBeNull();
  });

  it("포인터 이벤트·포커스를 받지 않는다", () => {
    const { container } = render(<BallotReveal yes={YES} no={NO} stage="both" />);
    expect(container.querySelectorAll("button, a, input, [tabindex]").length).toBe(0);
  });
});

describe("BallotReveal — compact (2단계)", () => {
  it("compact 면 이름 없이 얼굴 원만 그리고 요약은 그대로(이름 포함)", () => {
    const { container } = render(<BallotReveal yes={YES} no={NO} stage="both" compact />);
    const root = container.querySelector("[data-ballots]")!;
    expect(root.getAttribute("data-compact")).toBe("true");
    expect(container.querySelectorAll(".mv-ballots__name").length).toBe(0);
    expect(container.querySelectorAll("[data-ballot-seat]").length).toBe(5);
    expect(root.querySelector(".mv-sr")?.textContent).toContain("서연");
  });
});
