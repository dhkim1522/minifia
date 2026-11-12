/// <reference types="node" />
import { act, cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { ModeSheet } from "../../src/components/ModeSheet";
import { HostRailButton } from "../../src/components/v2/HostRailButton";
import { V2Icon } from "../../src/components/v2/V2Icon";
import type { V2IconName } from "../../src/components/v2/V2Icon";
import { MODE_ORDER, MODE_TEXT } from "../../src/game/modeText";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// 주석을 뺀 CSS 에서 선택자 하나의 규칙 본문을 꺼낸다(없으면 빈 문자열).
const strip = (path: string) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const V2 = strip("src/styles/v2.css");
const SHEET = strip("src/styles/sheet.css");
const ruleOf = (css: string, selector: string): string => {
  const at = css.indexOf(`${selector} {`);
  return at < 0 ? "" : css.slice(at, css.indexOf("}", at) + 1);
};

// 그려진 도형을 한 줄로: 경로는 "p d", 원은 "c cx cy r".
const shapesOf = (container: HTMLElement): string =>
  [...container.querySelectorAll("svg > *")]
    .map((e) => (e.tagName.toLowerCase() === "circle" ? `c ${e.getAttribute("cx")} ${e.getAttribute("cy")} ${e.getAttribute("r")}` : `p ${e.getAttribute("d")}`))
    .join(" | ");

const cardsOf = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>("[data-mode-card]")];
const pressedOf = (container: HTMLElement) =>
  cardsOf(container)
    .map((c) => `${c.getAttribute("data-mode-card")}=${c.getAttribute("aria-pressed")}`)
    .join(",");

describe("판 종류 문구 한 곳 (19-03, UI-SPEC Copywriting)", () => {
  it("칸 순서는 기본 마피아 · 확장판이고 이름·설명·접근성 글·알림 글이 계약대로다", () => {
    expect(MODE_ORDER.join(",")).toBe("basic,extended");
    expect(MODE_TEXT.title).toBe("판 종류");
    expect(JSON.stringify(MODE_TEXT.name)).toBe(JSON.stringify({ basic: "기본 마피아", extended: "확장판" }));
    expect(JSON.stringify(MODE_TEXT.desc)).toBe(JSON.stringify({ basic: "토론하고 투표해요", extended: "증거를 찾아 추리해요" }));
    expect([MODE_TEXT.aria("basic"), MODE_TEXT.aria("extended")].join(" | ")).toBe("판 종류: 기본 마피아 | 판 종류: 확장판");
    expect([MODE_TEXT.changed("basic"), MODE_TEXT.changed("extended")].join(" | ")).toBe("판 종류: 기본 마피아 | 판 종류: 확장판");
    expect([MODE_TEXT.tutorialOn, MODE_TEXT.tutorialOff, MODE_TEXT.rail].join(" | ")).toBe("튜토리얼 먼저 켰어요 | 튜토리얼 껐어요 | 방장 전용");
  });
});

// P19-14: 시안 A 의 SVG 경로 그대로(24 격자·선 2·currentColor).
const NEW_ICONS: readonly (readonly [V2IconName, string])[] = [
  ["deck", "p M6 7h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z | p M8 3h10a2 2 0 0 1 2 2v12"],
  ["book", "p M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4z | p M20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z"],
  ["modeBasic", "p M4 12a8 8 0 0 1 16 0v3H4z | p M2 15h20 | p M8 19h8"],
  ["modeExtended", "c 10 10 6 | p M14.5 14.5L21 21 | p M8 10h4"],
];

describe("V2Icon 새 아이콘 넷 (19-03, P19-14)", () => {
  it.each(NEW_ICONS)("%s 는 UI-SPEC 표의 경로 그대로 24 격자·선 2·currentColor 로 그려진다", (name, shapes) => {
    const { container } = render(<V2Icon name={name} />);
    const svg = container.querySelector("svg");
    expect(shapesOf(container)).toBe(shapes);
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.getAttribute("stroke-width")).toBe("2");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("HostRailButton — 방장 원형 단추 (19-03, D-13·D-14, UI-SPEC A-3·A-4)", () => {
  it("id=mode: 단추 하나, 표식 mode, 접근성 이름은 받은 글, 보이는 글이 없고 눌림은 기본 false 다", () => {
    const { container } = render(<HostRailButton id="mode" icon="deck" label={MODE_TEXT.aria("extended")} onPress={() => {}} />);
    const buttons = [...container.querySelectorAll("button")];
    expect(buttons.length).toBe(1);
    const btn = buttons[0]!;
    expect(btn.getAttribute("data-host-rail-btn")).toBe("mode");
    expect(btn.getAttribute("aria-label")).toBe("판 종류: 확장판");
    expect((container.textContent ?? "").trim()).toBe("");
    expect(btn.classList.contains("mv-hostrail-btn")).toBe(true);
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(btn.getAttribute("type")).toBe("button");
    expect(btn.hasAttribute("data-float")).toBe(false);
    expect(btn.hasAttribute("data-tutorial-toggle")).toBe(false);
    expect(btn.querySelector("svg")?.getAttribute("width")).toBe("24");
    // 깜빡임 클래스를 스스로 달지 않는다(정지한 금빛 = 방장 전용)
    expect(btn.classList.contains("is-call")).toBe(false);
  });

  it("pressed 면 aria-pressed=true 다(시트가 열려 있음)", () => {
    const { container } = render(<HostRailButton id="mode" icon="deck" label="판 종류: 확장판" pressed onPress={() => {}} />);
    expect(container.querySelector("[data-host-rail-btn]")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("누르면 onPress 가 단추 요소와 함께 한 번, disabled 면 aria-disabled 이고 0번이다", () => {
    const onPress = vi.fn();
    const first = render(<HostRailButton id="mode" icon="deck" label="판 종류: 확장판" onPress={onPress} />);
    const btn = first.container.querySelector<HTMLElement>("[data-host-rail-btn]");
    expect(btn?.hasAttribute("aria-disabled")).toBe(false);
    fireEvent.click(btn!);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress.mock.calls[0]?.[0]).toBe(btn);
    first.unmount();

    const off = vi.fn();
    const second = render(<HostRailButton id="mode" icon="deck" label="판 종류: 확장판" disabled onPress={off} />);
    const dead = second.container.querySelector<HTMLElement>("[data-host-rail-btn]");
    expect(dead?.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(dead!);
    expect(off).not.toHaveBeenCalled();
  });

  it("switchOn 을 주면 role=switch·aria-checked 이고 aria-pressed 는 없다", () => {
    const on = render(<HostRailButton id="tutorial" icon="book" label="튜토리얼 먼저" switchOn onPress={() => {}} />);
    const a = on.container.querySelector("[data-host-rail-btn]");
    expect(a?.getAttribute("role")).toBe("switch");
    expect(a?.getAttribute("aria-checked")).toBe("true");
    expect(a?.hasAttribute("aria-pressed")).toBe(false);
    on.unmount();
    const off = render(<HostRailButton id="tutorial" icon="book" label="튜토리얼 먼저" switchOn={false} onPress={() => {}} />);
    const b = off.container.querySelector("[data-host-rail-btn]");
    expect(b?.getAttribute("role")).toBe("switch");
    expect(b?.getAttribute("aria-checked")).toBe("false");
    expect(b?.hasAttribute("aria-pressed")).toBe(false);
  });

  it("기존 선택자를 잇는다: bots 는 data-float=bots, tutorial 은 data-tutorial-toggle 도 단다. 표식 값은 고정 낱말뿐이다", () => {
    const seen: string[] = [];
    for (const [id, icon] of [["mode", "deck"], ["bots", "bot"], ["tutorial", "book"]] as const) {
      const { container, unmount } = render(<HostRailButton id={id} icon={icon} label="이름" onPress={() => {}} />);
      const btn = container.querySelector("[data-host-rail-btn]");
      seen.push(`${btn?.getAttribute("data-host-rail-btn")}:${btn?.getAttribute("data-float") ?? "-"}:${btn?.hasAttribute("data-tutorial-toggle") ? "t" : "-"}`);
      unmount();
    }
    expect(seen.join(" ")).toBe("mode:-:- bots:bots:- tutorial:-:t");
  });

  it("mousedown 의 기본 동작을 막아 입력칸 포커스를 뺏지 않는다", () => {
    const { container } = render(<HostRailButton id="bots" icon="bot" label="봇" onPress={() => {}} />);
    const btn = container.querySelector<HTMLElement>("[data-host-rail-btn]");
    expect(btn).not.toBeNull();
    const ev = createEvent.mouseDown(btn!);
    fireEvent(btn!, ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("CSS: 지름 52 원·테두리 1.5px 금빛·바탕 night-700, 눌림은 안쪽 2px 금빛 링, 켜진 토글은 금빛 채움 + night-900, 사용 불가 0.45, 누름은 scale(0.94)", () => {
    const base = ruleOf(V2, ".mv-hostrail-btn");
    expect(base).toContain("border: 1.5px solid var(--light-lamp)");
    expect(base).toContain("background: var(--night-700)");
    expect(base).toContain("color: var(--light-lamp)");
    expect(base).toContain("width: var(--control-button)");
    expect(base).toContain("height: var(--control-button)");
    expect(base).toContain("border-radius: var(--radius-pill)");
    expect(ruleOf(V2, '.mv-hostrail-btn[aria-pressed="true"]')).toContain("box-shadow: inset 0 0 0 2px var(--light-lamp)");
    const on = ruleOf(V2, '.mv-hostrail-btn[role="switch"][aria-checked="true"]');
    expect(on).toContain("background: var(--light-lamp)");
    expect(on).toContain("color: var(--night-900)");
    expect(ruleOf(V2, '.mv-hostrail-btn[aria-disabled="true"]')).toContain("opacity: 0.45");
    expect(ruleOf(V2, ".mv-hostrail-btn:focus-visible")).toContain("outline: 2px solid var(--light-lamp)");
    expect(ruleOf(V2, ".mv-hostrail-btn:active")).toContain("transform: scale(0.94)");
  });
});

describe("ModeSheet — 판 종류 두 칸 시트 (19-03, D-05·D-15, UI-SPEC B, P19-6)", () => {
  it("제목 '판 종류' 와 두 칸(기본 마피아 · 확장판)뿐이고, 서버 값인 칸만 aria-pressed 와 V 배지를 가진다", () => {
    const { container } = render(<ModeSheet mode="extended" canSend onPick={() => {}} onClose={() => {}} />);
    expect(container.querySelector("dialog")?.getAttribute("aria-label")).toBe("판 종류");
    expect(container.querySelector("[data-mode-sheet] h2")?.textContent).toBe("판 종류");
    expect(pressedOf(container)).toBe("basic=false,extended=true");
    const [basic, extended] = cardsOf(container);
    expect(basic?.tagName).toBe("BUTTON");
    expect([...(basic?.querySelectorAll("span:not(.mf-mode-card__badge)") ?? [])].map((s) => s.textContent).join(" | ")).toBe("기본 마피아 | 토론하고 투표해요");
    expect([...(extended?.querySelectorAll("span:not(.mf-mode-card__badge)") ?? [])].map((s) => s.textContent).join(" | ")).toBe("확장판 | 증거를 찾아 추리해요");
    expect(basic?.querySelector(".mf-mode-card__badge")).toBeNull();
    expect(extended?.querySelector(".mf-mode-card__badge")?.getAttribute("aria-hidden")).toBe("true");
    expect(basic?.querySelector("svg.mf-mode-card__icon")?.getAttribute("width")).toBe("40");
    expect(extended?.querySelector("svg.mf-mode-card__icon")?.getAttribute("width")).toBe("40");
    // 표식 값은 enum 뿐이다(T-19-11)
    expect(cardsOf(container).every((c) => ["basic", "extended"].includes(c.getAttribute("data-mode-card") ?? ""))).toBe(true);
  });

  it("다른 칸을 누르면 onPick 이 고른 값으로 정확히 한 번이고, 표시는 서버 값 그대로다(낙관 갱신 없음)", () => {
    const onPick = vi.fn();
    const { container } = render(<ModeSheet mode="extended" canSend onPick={onPick} onClose={() => {}} />);
    expect(pressedOf(container)).toBe("basic=false,extended=true");
    fireEvent.click(cardsOf(container)[0]!);
    expect(onPick.mock.calls.map((c) => String(c[0])).join(",")).toBe("basic");
    expect(pressedOf(container)).toBe("basic=false,extended=true");
  });

  it("이미 고른 칸을 누르면 아무것도 보내지 않는다", () => {
    const onPick = vi.fn();
    const { container } = render(<ModeSheet mode="extended" canSend onPick={onPick} onClose={() => {}} />);
    expect(cardsOf(container).length).toBe(2);
    fireEvent.click(cardsOf(container)[1]!);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("서버 값이 바뀌어 오면 고른 표시가 따라 바뀐다", () => {
    const { container, rerender } = render(<ModeSheet mode="extended" canSend onPick={() => {}} onClose={() => {}} />);
    rerender(<ModeSheet mode="basic" canSend onPick={() => {}} onClose={() => {}} />);
    expect(pressedOf(container)).toBe("basic=true,extended=false");
    expect(cardsOf(container)[0]?.querySelector(".mf-mode-card__badge")).not.toBeNull();
    expect(cardsOf(container)[1]?.querySelector(".mf-mode-card__badge")).toBeNull();
  });

  it("연결이 끊기면 두 칸이 aria-disabled 이고 눌러도 0번, [닫기] 는 onClose 한 번이다", () => {
    vi.useFakeTimers();
    const onPick = vi.fn();
    const onClose = vi.fn();
    const { container } = render(<ModeSheet mode="extended" canSend={false} onPick={onPick} onClose={onClose} />);
    expect(cardsOf(container).map((c) => c.getAttribute("aria-disabled")).join(",")).toBe("true,true");
    for (const card of cardsOf(container)) fireEvent.click(card);
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("연결돼 있으면 칸에 aria-disabled 가 없다", () => {
    const { container } = render(<ModeSheet mode="basic" canSend onPick={() => {}} onClose={() => {}} />);
    expect(cardsOf(container).map((c) => String(c.hasAttribute("aria-disabled"))).join(",")).toBe("false,false");
  });

  it("CSS: 두 칸 격자 간격 12, 고른 칸은 2px gray-100 + night-700(금빛 아님, P19-15), V 배지 24 원, 아이콘 40 은 선 1.6", () => {
    // 시트 면은 시안대로 night-900 — 칸(night-800)·고른 칸(night-700)이 면과 구별된다
    expect(ruleOf(SHEET, ".mf-sheet.mf-mode-sheet")).toContain("background: var(--night-900)");
    const grid = ruleOf(SHEET, ".mf-mode-sheet__grid");
    expect(grid).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(grid).toContain("gap: 12px");
    const card = ruleOf(SHEET, ".mf-mode-card");
    expect(card).toContain("border: 1px solid var(--night-600)");
    expect(card).toContain("background: var(--night-800)");
    expect(card).toContain("border-radius: var(--radius-md)");
    const picked = ruleOf(SHEET, '.mf-mode-card[aria-pressed="true"]');
    expect(picked).toContain("2px");
    expect(picked).toContain("var(--gray-100)");
    expect(picked).toContain("background: var(--night-700)");
    const badge = ruleOf(SHEET, ".mf-mode-card__badge");
    expect(badge).toContain("width: 24px");
    expect(badge).toContain("background: var(--gray-100)");
    expect(badge).toContain("color: var(--night-900)");
    expect(ruleOf(SHEET, ".mf-mode-card__icon")).toContain("stroke-width: 1.6");
    expect(ruleOf(SHEET, '.mf-mode-card[aria-disabled="true"]')).toContain("opacity: 0.45");
    // 금빛은 방장 줄 단추의 색이다 — 시트 CSS 에는 쓰지 않는다
    expect(SHEET.includes("--light-lamp")).toBe(false);
  });
});
