import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "../helpers/singleLineErrors";
import { EvidenceCard } from "../../src/components/v2/EvidenceCard";
import { TRACE_NOTE, TRACE_TEXT } from "../../src/game/traceText";
import { TRACE_PIECE_IDS } from "../../shared/protocol";

afterEach(cleanup);

// 16-01 증거 카드(V-28·V-30, D-10): 1행 흔적(15 흔적 카드 그대로) + 2행 마지막 목격. 부품은 역할 prop 이 없고 누르는 것이 아니다.
// 사용자 문자열(닉네임)은 텍스트 노드로만 나온다.

const V2_CSS = readFileSync("src/styles/v2.css", "utf8");
const EVIDENCE_CSS = readFileSync("src/styles/evidence.css", "utf8");
const VICTIM = { name: "서준", color: "var(--seat-2)" };
const WITNESS = { name: "하윤", color: "var(--seat-4)", place: "glass" as const };

describe("EvidenceCard", () => {
  it("루트는 data-trace-card·role=status 한 개이고 1행에 조각 이름과 보조 줄이 있다", () => {
    const { container } = render(<EvidenceCard piece="pencil" victim={VICTIM} witness={WITNESS} />);
    const roots = container.querySelectorAll("div[data-trace-card]");
    expect(roots).toHaveLength(1);
    const root = roots[0] as HTMLElement;
    expect(root.getAttribute("role")).toBe("status");
    expect(root.querySelector(".mv-trace__name")?.textContent).toBe(TRACE_TEXT.pencil);
    expect(root.querySelector(".mv-trace__note")?.textContent).toBe(TRACE_NOTE);
  });

  it("목격자가 있으면 2행 count=1, 피해자 이름(취소선 클래스)·목격자 이름·장소 아이콘 svg 하나", () => {
    const { container } = render(<EvidenceCard piece="pin" victim={VICTIM} witness={WITNESS} />);
    const row = container.querySelector("[data-lastseen-row]") as HTMLElement;
    expect(row.getAttribute("data-lastseen-count")).toBe("1");
    expect(row.querySelector(".mv-evidence__victim")?.textContent).toBe("서준");
    expect(row.querySelector(".mv-evidence__witness")?.textContent).toBe("하윤");
    expect(row.querySelectorAll(".mv-evidence__place svg")).toHaveLength(1);
    expect(row.querySelectorAll(".mv-evidence__place")).toHaveLength(1);
  });

  it("목격자가 없으면 count=0, 눈 + '0' 글자만 있고 장소 svg 가 없다", () => {
    const { container } = render(<EvidenceCard piece="pin" victim={VICTIM} witness={null} />);
    const row = container.querySelector("[data-lastseen-row]") as HTMLElement;
    expect(row.getAttribute("data-lastseen-count")).toBe("0");
    expect(row.querySelector(".mv-evidence__zero")?.textContent).toBe("0");
    expect(row.querySelector(".mv-evidence__place")).toBeNull();
    expect(row.querySelector(".mv-evidence__witness")).toBeNull();
    // 눈 아이콘 하나만 있다
    expect(row.querySelectorAll("svg")).toHaveLength(1);
  });

  it("카드 안에 button·[data-call] 이 없다", () => {
    for (const witness of [WITNESS, null]) {
      const { container } = render(<EvidenceCard piece="pencil" victim={VICTIM} witness={witness} />);
      expect(container.querySelectorAll("button, [data-call]")).toHaveLength(0);
      cleanup();
    }
  });

  it("같은 props 면 HTML 이 같다(역할 prop 이 없다) · 금지 낱말과 id 속성이 없다", () => {
    const html = (): string => {
      const { container } = render(<EvidenceCard piece="redCloth" victim={VICTIM} witness={WITNESS} />);
      const out = container.innerHTML;
      cleanup();
      return out;
    };
    expect(html()).toBe(html());
    const { container } = render(<EvidenceCard piece="redCloth" victim={VICTIM} witness={WITNESS} />);
    for (const w of ["마피아", "경찰", "의사", "시민", "범인", "증거", "확정"]) expect(container.textContent).not.toContain(w);
    const values = [...container.querySelectorAll("*")].flatMap((e) => e.getAttributeNames().filter((n) => n !== "style").map((n) => `${n}=${e.getAttribute(n)}`));
    for (const id of TRACE_PIECE_IDS) expect(values.join(" ")).not.toContain(id);
    expect(container.innerHTML).not.toMatch(/data-seat|data-role|data-piece/);
  });

  it("닉네임은 텍스트 노드로만 나온다(태그 문자 그대로)", () => {
    const { container } = render(<EvidenceCard piece="pencil" victim={{ name: "<b>가</b>", color: "red" }} witness={{ name: "<i>나</i>", color: "blue", place: "piano" }} />);
    expect(container.querySelector("b, i")).toBeNull();
    expect(container.querySelector(".mv-evidence__victim")?.textContent).toBe("<b>가</b>");
  });

  it("스타일: 면·테두리·폭은 .mv-trace 에서 받고(328·overlay-ink-strong·1px night-600) .mv-evidence 가 높이 128·세로 쌓기, 피해자 이름은 취소선·4em 말줄임", () => {
    const base = /\.mv-trace\s*\{([^}]*)\}/.exec(V2_CSS)?.[1] ?? "";
    for (const token of ["328px", "overlay-ink-strong", "radius-badge", "1px solid var(--night-600)"]) expect(base).toContain(token);
    const rule = /\.mv-evidence\s*\{([^}]*)\}/.exec(EVIDENCE_CSS)?.[1] ?? "";
    expect(rule).toContain("min-height: 128px");
    expect(rule).toContain("flex-direction: column");
    const victim = /\.mv-evidence__victim\s*\{([^}]*)\}/.exec(EVIDENCE_CSS)?.[1] ?? "";
    for (const token of ["line-through", "max-width: 4em", "text-overflow: ellipsis", "opacity: 0.5"]) expect(victim).toContain(token);
    expect(EVIDENCE_CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
