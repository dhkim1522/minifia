import { readFileSync } from "node:fs";
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

// 09.1.1-12 Task 3 (UI-SPEC C-2 2단계): 자기 영역에 내용이 넘치면 얼굴만. happy-dom 은 레이아웃을 재지 못해 높이를 정의해 준다.
function measure(clientHeight: number, full: number, compactH: number) {
  const proto = HTMLElement.prototype;
  Object.defineProperty(proto, "clientHeight", { configurable: true, get: () => clientHeight });
  Object.defineProperty(proto, "scrollHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.querySelector(".mv-ballots__name") ? full : compactH;
    },
  });
}
const unmeasure = () => {
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollHeight;
};

describe("BallotReveal — 측정해서 2단계로 (360×560 여유 1)", () => {
  afterEach(unmeasure);
  const SEVEN_Y = [0, 1, 2, 3].map((s) => voter(s));
  const SEVEN_N = [4, 5, 6].map((s) => voter(s));

  it("R=4 필요 232 가 가용 233 에 들어가면 이름 있는 알약을 유지한다", () => {
    measure(233, 232, 152);
    const { container } = render(<BallotReveal yes={SEVEN_Y} no={SEVEN_N} stage="both" />);
    expect(container.querySelector("[data-ballots]")?.getAttribute("data-compact")).toBe("false");
    expect(container.querySelectorAll(".mv-ballots__name").length).toBe(7);
  });

  it("232 필요가 가용 200 을 넘으면 얼굴만 그린다 — 요약 한 줄(이름 포함)은 그대로", () => {
    measure(200, 232, 152);
    const { container } = render(<BallotReveal yes={SEVEN_Y} no={SEVEN_N} stage="both" />);
    const root = container.querySelector("[data-ballots]")!;
    expect(root.getAttribute("data-compact")).toBe("true");
    expect(container.querySelectorAll(".mv-ballots__name").length).toBe(0);
    expect(container.querySelectorAll("[data-ballot-seat]").length).toBe(7);
    expect(root.querySelector(".mv-sr")?.textContent).toContain("서연");
  });

  it("얼굴만으로도 넘치면 더 줄이지 않는다(되돌아가 깜빡이지 않는다)", () => {
    measure(100, 232, 152);
    const { container } = render(<BallotReveal yes={SEVEN_Y} no={SEVEN_N} stage="both" />);
    expect(container.querySelector("[data-ballots]")?.getAttribute("data-compact")).toBe("true");
  });

  it("얼굴 원은 compact 에서 32px, 평소 24px", () => {
    const { container, rerender } = render(<BallotReveal yes={[voter(0)]} no={[]} stage="both" />);
    expect(container.querySelector<HTMLElement>(".mv-ballots__face")?.style.width).toBe("24px");
    rerender(<BallotReveal yes={[voter(0)]} no={[]} stage="both" compact />);
    expect(container.querySelector<HTMLElement>(".mv-ballots__face")?.style.width).toBe("32px");
  });
});

describe("BallotReveal — 이름 8자 전각 7명", () => {
  it("이름이 말줄임 없이 그려지고(keep-all 클래스 규칙) 알약이 줄 바꿈 가능한 flex-wrap 묶음 안에 있다", () => {
    const long = "가나다라마바사아";
    const yes = [0, 1, 2, 3].map((s): Voter => ({ ...voter(s), name: long }));
    const no = [4, 5, 6].map((s): Voter => ({ ...voter(s), name: long }));
    const { container } = render(<BallotReveal yes={yes} no={no} stage="both" />);
    const names = [...container.querySelectorAll(".mv-ballots__name")].map((n) => n.textContent);
    expect(names).toEqual(Array(7).fill(long));
    const css = readFileSync("src/styles/v2.css", "utf8");
    expect(css).toMatch(/\.mv-ballots__row\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(css).toMatch(/\.mv-ballots__name\s*\{[^}]*word-break:\s*keep-all/);
    expect(css).not.toMatch(/\.mv-ballots[^{]*\{[^}]*text-overflow/);
  });
});

describe("BallotReveal — 재접속·모션 줄이기 CSS", () => {
  it("instant 는 등장 클래스도 숨김 클래스도 없다(재접속 0.6~4.6초 사이)", () => {
    const { container } = render(<BallotReveal yes={YES} no={NO} stage="none" instant />);
    expect(container.querySelector(".is-enter, .is-pending")).toBeNull();
    expect(container.querySelectorAll("[data-ballot-seat]").length).toBe(5);
  });

  it("prefers-reduced-motion 에서 mv-ballots 애니메이션·전환이 none", () => {
    const css = readFileSync("src/styles/v2.css", "utf8");
    const reduce = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/g)?.join("\n") ?? "";
    expect(reduce).toMatch(/\.mv-ballots[^{]*\{[^}]*animation:\s*none/);
  });
});
