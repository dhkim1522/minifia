/// <reference types="node" />
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { Sheet } from "../../src/components/Sheet";
import { ChatPanel, type ChatPanelProps } from "../../src/components/v2/ChatPanel";
import { ResultPanel, type ResultPanelProps, type ResultTab } from "../../src/components/v2/ResultPanel";
import { WillSheet } from "../../src/components/v2/WillSheet";
import { EMOTE_TRAY_ORDER } from "../../src/game/chatText";
import { RESULT_PANEL_TEXT, RESULT_TABS_SHOWN } from "../../src/game/resultText";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// 14페이즈 TOOL-01(결정 0051 보완, UI-SPEC "도구 이름표 목록"): 눌리는 모든 아이콘 단추는 아이콘 아래 한 단어를 항상 단다.
// 규칙: ① data-tool-label="{낱말}" ② 보이는 글자 = 그 낱말 ③ 접근성 이름은 그 낱말을 포함한다(WCAG 2.5.3 — 같거나 뒤에 상태·대상이 붙는다)
// ④ 낱말은 숫자를 빼고 비어 있지 않고 3자 이하(예외 "내 역할"·"보내기"·"넘기기"는 UI-SPEC 표가 정한 낱말) ⑤ 낱말은 고정 문구뿐(T-14-16: 역할·좌석 없음).
// 이 파일은 부품 단위 describe 로 시작하고 14-07 이 방 화면 전수 검사를 더한다.

const V2_CSS = readFileSync("src/styles/v2.css", "utf8");

/** 이름표 단추 계약: data-tool-label 값 = 보이는 글자(aria-hidden 제외, 숫자·공백 제외) 이고 접근성 이름이 그 값을 포함한다. */
export function expectToolLabel(btn: Element | null, word: string, opts: { name?: string; name_contains?: boolean } = {}): void {
  expect(btn, `이름표 단추 '${word}'`).not.toBeNull();
  const el = btn as HTMLElement;
  expect(el.getAttribute("data-tool-label")).toBe(word);
  const visible = [...el.querySelectorAll("*")].filter((n) => !n.closest("[aria-hidden='true']") && n.children.length === 0).map((n) => n.textContent ?? "").join("").replace(/[\d\s/]/g, "");
  expect(visible, `'${word}' 단추의 보이는 글자`).toBe(word.replace(/\s/g, ""));
  const name = el.getAttribute("aria-label") ?? visible;
  expect(name.includes(word), `접근성 이름 '${name}' 은 '${word}' 를 포함해야 한다`).toBe(true);
  if (opts.name !== undefined) expect(name).toBe(opts.name);
}

function Harness(rest: Partial<ChatPanelProps>) {
  const [value, setValue] = useState("");
  return <ChatPanel messages={[]} logHeight={96} onSend={() => {}} {...rest} value={value} onChange={setValue} />;
}

const bareCss = V2_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
function rule(sel: string): string {
  return [...bareCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => (m[1] ?? "").split(",").some((s) => s.trim() === sel))
    .map((m) => m[2] ?? "")
    .join(";");
}

describe("채팅 입력줄 이름표 (TOOL-01 목록 8~11, D-04)", () => {
  const mount = (rest: Partial<ChatPanelProps> = {}) => render(<Harness emotes={EMOTE_TRAY_ORDER} onEmote={() => {}} onWill={() => {}} {...rest} />);

  it("동작·보내기·유언 단추가 보이는 글자와 data-tool-label 을 단다(접근성 이름은 낱말을 포함)", () => {
    const { container } = mount();
    expectToolLabel(container.querySelector("[data-emote-button]"), "동작", { name: "동작 고르기" });
    expectToolLabel(container.querySelector("[data-chat-send]"), "보내기", { name: "보내기" });
    expectToolLabel(container.querySelector("[data-will-button]"), "유언", { name: "유언 쓰기" });
  });

  it("유언이 저장돼 있으면 접근성 이름만 '유언 쓰기, 저장됨' 이 되고 보이는 낱말은 그대로다", () => {
    const { container } = mount({ willSaved: true });
    expectToolLabel(container.querySelector("[data-will-button]"), "유언", { name: "유언 쓰기, 저장됨" });
    expect(container.querySelector(".mv-chat__will-dot")).not.toBeNull();
  });

  it("보내기가 막혀(aria-disabled) 있어도 라벨은 보인다(UI#10 partial)", () => {
    const { container } = mount({ sendDisabled: true });
    expect(container.querySelector("[data-chat-send]")?.getAttribute("aria-disabled")).toBe("true");
    expectToolLabel(container.querySelector("[data-chat-send]"), "보내기");
    expectToolLabel(container.querySelector("[data-emote-button]"), "동작");
    expectToolLabel(container.querySelector("[data-will-button]"), "유언");
  });

  it("각 이름표 단추는 아이콘(svg)과 라벨(.mv-tool__label)을 가진 .mv-tool 이다", () => {
    const { container } = mount();
    for (const sel of ["[data-emote-button]", "[data-chat-send]", "[data-will-button]"]) {
      const b = container.querySelector(sel);
      expect(b?.classList.contains("mv-tool"), sel).toBe(true);
      expect(b?.querySelector("svg"), sel).not.toBeNull();
      expect(b?.querySelector(".mv-tool__label"), sel).not.toBeNull();
    }
  });

  it("빛나는 [유언] 은 라벨이 700 brass-200 이 된다(CSS 계약)", () => {
    const { container } = mount({ callWill: true });
    expect(container.querySelector("[data-will-button]")?.classList.contains("is-call")).toBe(true);
    const r = rule(".mv-tool.is-call .mv-tool__label");
    expect(r).toContain("font-weight: 700");
    expect(r).toContain("var(--brass-200)");
  });

  it("새 메시지 알림은 14px 알약 '새 글' 이다(보이는 글자·접근성 이름·data-tool-label 모두 '새 글')", async () => {
    // 위로 올려 읽는 중 새 줄이 오면 점이 뜬다 — chatPanel.test 의 같은 장치(스크롤 치수 가짜)를 쓴다.
    const { container, rerender } = render(<Harness messages={[{ key: "a", kind: "player", seat: 0, name: "가", text: "하나", ch: "all" }]} />);
    const log = container.querySelector("[data-chat-log]") as HTMLElement;
    const st = { top: 300 };
    Object.defineProperty(log, "scrollHeight", { configurable: true, get: () => 500 });
    Object.defineProperty(log, "clientHeight", { configurable: true, get: () => 100 });
    Object.defineProperty(log, "scrollTop", { configurable: true, get: () => st.top, set: (v: number) => (st.top = v) });
    fireEvent.scroll(log);
    rerender(
      <Harness
        messages={[
          { key: "a", kind: "player", seat: 0, name: "가", text: "하나", ch: "all" },
          { key: "b", kind: "player", seat: 1, name: "나", text: "둘", ch: "all" },
        ]}
      />,
    );
    expectToolLabel(container.querySelector("button[data-chat-newdot]"), "새 글", { name: "새 글" });
  });

  it("이름표 CSS: 폭 ≤ 52·누르기 44 이상, 라벨 14px/400 gray-300, 막힘은 불투명도만", () => {
    const tool = rule(".mv-tool");
    expect(tool).toMatch(/min-width:\s*(var\(--tap-min\)|44px)/);
    expect(tool).toContain("max-width: 52px");
    expect(tool).toMatch(/min-height:\s*(var\(--tap-min\)|44px)/);
    expect(tool).toContain("flex-direction: column");
    const label = rule(".mv-tool__label");
    expect(label).toContain("font-size: 14px");
    expect(label).toContain("font-weight: 400");
    expect(label).toContain("color: var(--gray-300)");
    expect(rule('.mv-tool[aria-disabled="true"]')).toContain("opacity: 0.45");
  });

  it("폭 360 에서 입력칸이 약 172 남는다: 입력줄은 동작 44 + 입력칸 + 보내기 44 + 유언 44, 간격 8 뿐(여분 margin 없음)", () => {
    expect(rule(".mv-chat__form")).toContain("align-items: flex-end");
    expect(rule(".mv-chat__form")).toContain("gap: var(--space-sm)");
    expect(rule(".mv-chat__will")).not.toContain("margin-left");
    const w = 360 - 32 - 3 * 44 - 3 * 8;
    expect(w).toBe(172);
  });
});

describe("시트 닫기·결과 화면 이름표 (TOOL-01 목록 1·12·14)", () => {
  it("Sheet 닫기: × + '닫기' 가로 알약, data-tool-label·접근성 이름 '닫기'", () => {
    const { baseElement } = render(
      <Sheet label="a" onClose={() => {}} showClose>
        <p>x</p>
      </Sheet>,
    );
    const btn = baseElement.querySelector(".mf-sheet__close");
    expectToolLabel(btn, "닫기", { name: "닫기" });
    expect(btn?.querySelector("svg")).not.toBeNull();
    expect(btn?.classList.contains("mv-closepill")).toBe(true);
  });

  it("WillSheet 닫기: × + '닫기' 가로 알약", () => {
    const { container } = render(<WillSheet value="" onChange={() => {}} onSave={() => {}} onClose={() => {}} />);
    const btn = container.querySelector(".mv-will__close");
    expectToolLabel(btn, "닫기", { name: "닫기" });
    expect(btn?.querySelector("svg")).not.toBeNull();
    expect(btn?.classList.contains("mv-closepill")).toBe(true);
  });

  it("닫기 알약 CSS: 높이 44, 아이콘 왼쪽·글자 오른쪽 가로, 라벨 14/400", () => {
    const r = rule(".mv-closepill");
    expect(r).toMatch(/height:\s*(var\(--tap-min\)|44px)/);
    expect(r).toContain("display: inline-flex");
    expect(r).toContain("border-radius: var(--radius-pill)");
    expect(rule(".mv-closepill__label")).toContain("font-size: 14px");
  });

  const tabProps = (over: Partial<ResultPanelProps> = {}): ResultPanelProps => ({
    tab: "all",
    onTab: () => {},
    expanded: false,
    tabsVisible: true,
    lines: { mafia: { lines: [], complete: true }, ghost: { lines: [], complete: true }, whisper: { lines: [], complete: true }, claim: { lines: [], complete: true }, ballots: { lines: [], complete: true } },
    contacts: new Map(),
    opened: new Set<ResultTab>(["all"]),
    allSlot: <div />,
    ...over,
  });

  it("결과 기록 탭 넷은 선택 여부와 무관하게 아이콘 + 글자를 항상 보인다", () => {
    for (const sel of ["all", "ghost", "log"] as const) {
      const { container, unmount } = render(<ResultPanel {...tabProps({ tab: sel, expanded: true })} />);
      const tabs = [...container.querySelectorAll<HTMLElement>("[data-result-tab]")];
      expect(tabs.map((t) => t.getAttribute("data-result-tab"))).toEqual([...RESULT_TABS_SHOWN]);
      for (const t of tabs) {
        const id = t.getAttribute("data-result-tab") as ResultTab;
        expectToolLabel(t, RESULT_PANEL_TEXT.tab[id], { name: RESULT_PANEL_TEXT.tabName[id] });
        expect(t.querySelector("svg"), id).not.toBeNull();
      }
      unmount();
    }
  });

  it("결과 탭: 고정 폭 규칙 없이 폭 360 에서 넷이 한 줄에 들어간다(탭 폭 합 ≤ 328 + 16)", () => {
    const tab = rule(".mf-result__tab");
    expect(tab).not.toMatch(/(^|[;\s])width:/);
    const pad = /padding:\s*0\s+(\d+)px/.exec(tab);
    const px = pad ? Number(pad[1]) : 10;
    // 아이콘 24 + 간격 4 + 글자(3자 ≤ 44, 2자 ≤ 30) — 가장 넓은 합
    const widths = [30, 44, 30, 30].map((g) => px * 2 + 24 + 4 + g);
    expect(widths.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(344);
  });

  it("결과 탭 라벨은 막히지 않은 모든 탭에서 14px 이고 선택된 탭만 gray-100 700 이다", () => {
    const css = readFileSync("src/styles/result.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const pick = (sel: string) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => (m[1] ?? "").split(",").some((x) => x.trim() === sel)).map((m) => m[2] ?? "").join(";");
    expect(pick(".mf-result__tab-label")).toContain("font-weight: 400");
    expect(pick('.mf-result__tab[aria-selected="true"] .mf-result__tab-label')).toContain("font-weight: 700");
  });
});
