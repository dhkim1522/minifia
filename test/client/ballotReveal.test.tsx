import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "../helpers/singleLineErrors";
import { BallotReveal } from "../../src/components/v2/BallotReveal";
import type { Voter } from "../../src/game/ballotsView";

afterEach(cleanup);

const NAMES = ["서연", "민준", "도윤", "지호", "하윤", "태오", "하은", "지우"];
const voter = (seat: number, me = false): Voter => ({ seat, name: NAMES[seat]!, color: `var(--seat-${seat + 1})`, me });

const YES = [voter(0), voter(2), voter(4), voter(6)];
const NO: Voter[] = [];

const side = (c: HTMLElement, s: "yes" | "no") => c.querySelector<HTMLElement>(`[data-ballot-side="${s}"]`)!;

// 18.1-13 (결정 0083-9): 처형 단계의 찬반은 숫자 둘이다. 얼굴 칩·이름 알약은 없고, 누가 던졌는지는 채팅 기록 카드가 남긴다.
describe("BallotReveal — 숫자 둘 (0083-9)", () => {
  it("루트는 role=status + data-ballots, 눈에 보이는 덩이는 aria-hidden 이고 화면 읽기 한 줄(이름 포함)이 있다", () => {
    const { container } = render(<BallotReveal yes={YES} no={NO} stage="both" />);
    const root = container.querySelector("[data-ballots]")!;
    expect(root.getAttribute("role")).toBe("status");
    expect(root.querySelector(".mv-sr")?.textContent).toBe("찬성 4명: 서연, 도윤, 하윤, 하은. 반대 0명.");
    expect(root.querySelector(".mv-ballots__body")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("눈에 보이는 것은 [data-ballot-side] 둘 — 찬성이 먼저, 글자는 '찬성 4'·'반대 0', 엄지 아이콘 svg 가 각각 하나", () => {
    const { container } = render(<BallotReveal yes={YES} no={NO} stage="both" />);
    const sides = [...container.querySelectorAll("[data-ballot-side]")].map((n) => n.getAttribute("data-ballot-side"));
    expect(sides).toEqual(["yes", "no"]);
    expect(side(container, "yes").textContent).toBe("찬성 4");
    expect(side(container, "no").textContent).toBe("반대 0");
    expect(side(container, "yes").querySelectorAll("svg").length).toBe(1);
    expect(side(container, "no").querySelectorAll("svg").length).toBe(1);
  });

  it("알약·얼굴 이미지·이름 요소·좌석 속성이 하나도 없다([data-ballot-seat] 0개)", () => {
    const { container } = render(<BallotReveal yes={YES} no={[voter(1, true), voter(3)]} stage="both" />);
    expect(container.querySelectorAll("[data-ballot-seat]").length).toBe(0);
    expect(container.querySelectorAll("img").length).toBe(0);
    expect(container.querySelectorAll(".mv-ballots__pill, .mv-ballots__face, .mv-ballots__name").length).toBe(0);
    // 이름은 눈에 보이는 영역(aria-hidden 몸통)에 글자로 없다 — 읽기용 한 줄에만 있다
    expect(container.querySelector(".mv-ballots__body")?.textContent).toBe("찬성 4반대 2");
  });

  it("역할 칩·역할 단어가 DOM 에 없다 (T-09.1.1-33)", () => {
    const { container } = render(<BallotReveal yes={YES} no={NO} stage="both" />);
    expect(container.querySelector("[data-role-chip]")).toBeNull();
    expect(container.textContent).not.toMatch(/마피아|경찰|의사|시민/);
  });

  it("이름은 읽기용 한 줄의 텍스트 노드다 — 마크업이 들어간 닉네임도 요소를 만들지 않는다 (T-09.1.1-34)", () => {
    const evil: Voter = { seat: 0, name: "<img src=x onerror=alert(1)>", color: "var(--seat-1)", me: false };
    const { container } = render(<BallotReveal yes={[evil]} no={[]} stage="both" />);
    expect(container.querySelectorAll("img").length).toBe(0);
    expect(container.querySelector(".mv-sr")?.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it("압축 판정(compact·fitKey·data-compact)이 없다", () => {
    const { container } = render(<BallotReveal yes={YES} no={NO} stage="both" />);
    expect(container.querySelector("[data-ballots]")?.hasAttribute("data-compact")).toBe(false);
  });
});

describe("BallotReveal — 단계와 등장", () => {
  it("stage yes: 반대 덩이는 아직 보이지 않는다(자리는 잡혀 있다)", () => {
    const { container } = render(<BallotReveal yes={YES} no={NO} stage="yes" />);
    expect(side(container, "yes").classList.contains("is-pending")).toBe(false);
    expect(side(container, "no").classList.contains("is-pending")).toBe(true);
  });

  it("stage none: 두 덩이 모두 보이지 않고 요약도 읽히지 않는다", () => {
    const { container } = render(<BallotReveal yes={YES} no={NO} stage="none" />);
    expect(side(container, "yes").classList.contains("is-pending")).toBe(true);
    expect(side(container, "no").classList.contains("is-pending")).toBe(true);
    expect(container.querySelector(".mv-sr")).toBeNull();
  });

  it("yes → both 로 가면 반대 덩이가 올라오며 나타난다(is-enter)", () => {
    const { container, rerender } = render(<BallotReveal yes={YES} no={NO} stage="yes" />);
    expect(side(container, "yes").classList.contains("is-enter")).toBe(true);
    expect(side(container, "no").classList.contains("is-enter")).toBe(false);
    rerender(<BallotReveal yes={YES} no={NO} stage="both" />);
    expect(side(container, "no").classList.contains("is-pending")).toBe(false);
    expect(side(container, "no").classList.contains("is-enter")).toBe(true);
  });

  it("instant 면 애니메이션 없이 둘 다 바로 보인다(재접속 0.6~4.6초 사이)", () => {
    const { container } = render(<BallotReveal yes={YES} no={NO} stage="none" instant />);
    expect(container.querySelector(".is-enter")).toBeNull();
    expect(container.querySelector(".is-pending")).toBeNull();
    expect(container.querySelectorAll("[data-ballot-side]").length).toBe(2);
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

  it("prefers-reduced-motion 에서 mv-ballots 애니메이션이 none", () => {
    const css = readFileSync("src/styles/v2.css", "utf8");
    const reduce = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/g)?.join("\n") ?? "";
    expect(reduce).toMatch(/\.mv-ballots[^{]*\{[^}]*animation:\s*none/);
  });
});
