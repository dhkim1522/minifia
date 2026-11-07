import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { RecordCard } from "../../src/components/v2/RecordCard";
import { TraceCard } from "../../src/components/v2/TraceCard";
import { ToolButton } from "../../src/components/ToolButton";
import { V2Icon } from "../../src/components/v2/V2Icon";
import { TRACE_NOTE, TRACE_TEXT } from "../../src/game/traceText";
import { faceSrc, seatColorVar } from "../../src/net/assets";
import { TRACE_PIECE_IDS, type PlaceId } from "../../shared/protocol";
import type { RecordRow } from "../../src/game/recordView";

afterEach(cleanup);

// 15-07 Task 2: 목격 기록 카드·아침 흔적 카드·빛나는 머리 단추. 부품은 위치를 모르고 역할 prop 이 없다(D-04·D-06·D-09).
// 사용자 문자열(닉네임)은 React 텍스트 노드로만 나온다(T-15-29).

const V2_CSS = readFileSync("src/styles/v2.css", "utf8");
const GAME_CSS = readFileSync("src/styles/game.css", "utf8");

const ROWS: RecordRow[] = [
  { n: 1, seat: 1, place: "glass", name: "하윤" },
  { n: 2, seat: 2, place: "piano", name: "민지" },
  { n: 3, seat: 3, place: "sax", name: "도현" },
];

function card(rows: RecordRow[], onClose = () => {}) {
  return render(<RecordCard rows={rows} faceOf={faceSrc} colorOf={seatColorVar} onClose={onClose} />);
}

describe("RecordCard", () => {
  it("줄 3개: data-record-rows=3, li[data-record-row] 3개가 번호 1·2·3 순서, 줄마다 장소 아이콘 한 개·img 한 개·닉네임", () => {
    const { container } = card(ROWS);
    const root = container.querySelector("section[data-record-card]") as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.getAttribute("data-record-rows")).toBe("3");
    const lis = [...container.querySelectorAll("li[data-record-row]")];
    expect(lis).toHaveLength(3);
    lis.forEach((li, i) => {
      expect(li.querySelector(".mv-record__n")?.textContent).toBe(String(i + 1));
      expect(li.querySelectorAll("img")).toHaveLength(1);
      expect(li.querySelectorAll("svg")).toHaveLength(1);
      expect(li.querySelector(".mv-record__name")?.textContent).toBe(ROWS[i].name);
    });
    const img = lis[0].querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(faceSrc(1));
    expect(img.getAttribute("alt")).toBe("");
    expect((img.style as CSSStyleDeclaration).borderColor || img.getAttribute("style")).toContain(seatColorVar(1));
  });

  it("머리줄: 눈 아이콘 + 줄 수 + [닫기](data-tool-label=닫기) — 누르면 onClose 한 번", () => {
    const onClose = vi.fn();
    const { container } = card(ROWS, onClose);
    const head = container.querySelector(".mv-record__head") as HTMLElement;
    expect(head.querySelector(".mv-record__count")?.textContent).toBe("3");
    const close = container.querySelector("button[data-tool-label='닫기']") as HTMLButtonElement;
    expect(close).not.toBeNull();
    expect(close.getAttribute("aria-label")).toBe("닫기");
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("줄 0개: data-record-rows=0, li 0개, 머리줄에 '0', 줄 영역 없음", () => {
    const { container } = card([]);
    expect(container.querySelector("[data-record-card]")?.getAttribute("data-record-rows")).toBe("0");
    expect(container.querySelectorAll("li[data-record-row]")).toHaveLength(0);
    expect(container.querySelector(".mv-record__count")?.textContent).toBe("0");
    expect(container.querySelector(".mv-record__rows")).toBeNull();
  });

  it("닉네임이 마크업 문자열이어도 텍스트로만 나온다(요소 안 생김)", () => {
    const { container } = card([{ n: 1, seat: 1, place: "glass", name: "<b>x</b><img src=x onerror=alert(1)>" }]);
    const li = container.querySelector("li[data-record-row]") as HTMLElement;
    expect(li.querySelector("b")).toBeNull();
    expect(li.querySelectorAll("img")).toHaveLength(1);
    expect(li.querySelector(".mv-record__name")?.textContent).toBe("<b>x</b><img src=x onerror=alert(1)>");
  });

  it("역할·확신·수상함 글자가 없고 속성 값에 역할·좌석이 없다", () => {
    const { container } = card(ROWS);
    for (const w of ["마피아", "경찰", "의사", "시민", "확신", "수상", "의심"]) expect(container.textContent).not.toContain(w);
    const root = container.querySelector("[data-record-card]") as HTMLElement;
    expect([...root.querySelectorAll("*"), root].flatMap((e) => [...e.getAttributeNames()].filter((n) => n.startsWith("data-")))).toEqual(
      expect.not.arrayContaining(["data-role", "data-seat"]),
    );
  });

  it("스타일: 줄 높이 44·keep-all·줄바꿈 없음·카드 안 세로 스크롤·구분선 night-600", () => {
    const css = V2_CSS.slice(V2_CSS.indexOf(".mv-record"));
    expect(css).toMatch(/\.mv-record__row\s*\{[^}]*height: 44px/);
    expect(css).toMatch(/\.mv-record__name\s*\{[^}]*word-break: keep-all[^}]*white-space: nowrap|\.mv-record__name\s*\{[^}]*white-space: nowrap[^}]*word-break: keep-all/);
    expect(css).toMatch(/\.mv-record__rows\s*\{[^}]*overflow-y: auto/);
    expect(css).toMatch(/\.mv-record__row\s*\{[^}]*night-600/);
    const rule = /\.mv-record\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    for (const token of ["overlay-ink-strong", "radius-badge", "1px solid var(--night-600)"]) expect(rule).toContain(token);
  });
});

describe("TraceCard", () => {
  it("data-trace-card·role=status, 이름은 TRACE_TEXT[piece], 보조 줄은 TRACE_NOTE, 아이콘 한 개", () => {
    const { container } = render(<TraceCard piece="pencil" />);
    const root = container.querySelector("div[data-trace-card]") as HTMLElement;
    expect(root.getAttribute("role")).toBe("status");
    expect(root.querySelector(".mv-trace__name")?.textContent).toBe(TRACE_TEXT.pencil);
    expect(root.querySelector(".mv-trace__note")?.textContent).toBe(TRACE_NOTE);
    expect(root.querySelectorAll("svg")).toHaveLength(1);
  });

  it.each(TRACE_PIECE_IDS)("%s: 역할·'범인'·'증거' 낱말이 없고 속성 값에 조각 id·좌석이 없다", (piece) => {
    const { container } = render(<TraceCard piece={piece} />);
    for (const w of ["마피아", "경찰", "의사", "시민", "범인", "증거", "확정"]) expect(container.textContent).not.toContain(w);
    const values = [...container.querySelectorAll("*")].flatMap((e) => e.getAttributeNames().map((n) => `${n}=${e.getAttribute(n)}`));
    expect(values.join(" ")).not.toContain(piece);
    expect(container.innerHTML).not.toMatch(/data-seat|data-role|data-piece/);
  });

  it("스타일: 폭 328·한 줄 이름(nowrap)·thread 원 44", () => {
    const css = V2_CSS.slice(V2_CSS.indexOf(".mv-record"));
    expect(css).toMatch(/\.mv-trace\s*\{[^}]*width: 328px/);
    expect(css).toMatch(/\.mv-trace__name\s*\{[^}]*white-space: nowrap/);
    expect(css).toMatch(/\.mv-trace__disc\s*\{[^}]*width: 44px[^}]*height: 44px/);
  });
});

describe("ToolButton call·expanded", () => {
  const icon = <V2Icon name="timeline" size={22} />;

  it("call 이면 is-call 과 data-call, 아니면 둘 다 없다", () => {
    const { container, rerender } = render(<ToolButton word="기록" icon={icon} call />);
    const b = () => container.querySelector("button") as HTMLButtonElement;
    expect(b().classList.contains("is-call")).toBe(true);
    expect(b().hasAttribute("data-call")).toBe(true);
    rerender(<ToolButton word="기록" icon={icon} />);
    expect(b().classList.contains("is-call")).toBe(false);
    expect(b().hasAttribute("data-call")).toBe(false);
    expect(b().hasAttribute("aria-expanded")).toBe(false);
  });

  it("expanded 가 주어지면 aria-expanded 가 그 값", () => {
    const { container, rerender } = render(<ToolButton word="기록" icon={icon} expanded />);
    const b = () => container.querySelector("button") as HTMLButtonElement;
    expect(b().getAttribute("aria-expanded")).toBe("true");
    rerender(<ToolButton word="기록" icon={icon} expanded={false} />);
    expect(b().getAttribute("aria-expanded")).toBe("false");
  });

  it("기존 사용처의 마크업은 그대로(call·expanded 없이 같은 속성)", () => {
    const { container } = render(<ToolButton word="맵" icon={icon} />);
    const b = container.querySelector("button") as HTMLButtonElement;
    expect(b.className).toBe("mv-tool mv-tool--head");
    expect([...b.getAttributeNames()].sort()).toEqual(["aria-label", "class", "data-tool-label", "type"]);
    expect(b.getAttribute("aria-label")).toBe("맵");
  });
});

describe("스타일 정적 (.mv-record·.mv-trace 블록)", () => {
  const css = (): string => V2_CSS.slice(V2_CSS.indexOf(".mv-record"));

  it("블록이 파일 끝에 있고 hex·진홍이 없다", () => {
    expect(css().length).toBeGreaterThan(200);
    expect(css()).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(css()).not.toMatch(/crimson/);
  });

  it("등장 애니메이션은 opacity(+흔적은 translateY)뿐이고 모션 줄이기에서 즉시", () => {
    const c = css();
    const frames = [...c.matchAll(/@keyframes\s+(mv-record-in|mv-trace-in)\s*\{([\s\S]*?\})\s*\}/g)].map((m) => m[0]);
    expect(frames.length).toBe(2);
    for (const f of frames) expect(f).not.toMatch(/scale|rotate|width|height|top|left/);
    expect(c).toMatch(/prefers-reduced-motion: reduce[\s\S]*mv-record[\s\S]*animation: none/);
    expect(c).toMatch(/prefers-reduced-motion: reduce[\s\S]*mv-trace[\s\S]*animation: none/);
  });

  it("game.css 에는 위치용 클래스 .mf-game__record·.mf-game__trace 가 있다", () => {
    expect(GAME_CSS).toMatch(/\.mf-game__record\s*\{/);
    expect(GAME_CSS).toMatch(/\.mf-game__trace\s*\{/);
  });
});

describe("PlaceId 닫힌 집합(참고)", () => {
  it("행의 장소는 PlaceId 한 값이다", () => {
    const p: PlaceId = ROWS[0].place;
    expect(p).toBe("glass");
  });
});
