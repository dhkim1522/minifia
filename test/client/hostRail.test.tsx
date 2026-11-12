/// <reference types="node" />
import { act, cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { ModeSheet } from "../../src/components/ModeSheet";
import { HostRail, hostRailLayout } from "../../src/components/v2/HostRail";
import { HostRailButton } from "../../src/components/v2/HostRailButton";
import { MapChip } from "../../src/components/v2/MapChip";
import { ModeChip } from "../../src/components/v2/ModeChip";
import { splitSideColumn } from "../../src/components/v2/SideColumn";
import { V2Icon } from "../../src/components/v2/V2Icon";
import type { V2IconName } from "../../src/components/v2/V2Icon";
import { MODE_ORDER, MODE_TEXT } from "../../src/game/modeText";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// 주석을 뺀 CSS 에서 선택자 하나의 규칙을 꺼낸다(없으면 빈 문자열).
const strip = (path: string) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const V2 = strip("src/styles/v2.css");
const SHEET = strip("src/styles/sheet.css");
// 선택자는 줄 머리(또는 앞 규칙 바로 뒤)에서 시작하는 것만 본다 — 다른 규칙의 선택자 목록 끝에 붙은 같은 이름과 섞이지 않게.
const ruleOf = (css: string, selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const found = new RegExp(`(?:^|[}\\n])[ \\t]*(${escaped} \\{[^}]*\\})`).exec(css);
  return found?.[1] ?? "";
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

// ── Task 2: 방장 줄 틀 · 맵 단추 줄 변형 · 참가자 칩 ──

const layoutOf = (n: number, maxH: number) => JSON.stringify(hostRailLayout(n, maxH));
const one = (crown: boolean, n: number) => JSON.stringify({ crown, columns: [n] });

describe("hostRailLayout — 왕관 표식과 열 고르기 (19-03, UI-SPEC F-2, P19-2·P19-3)", () => {
  it("표식까지 들어가면 한 열 + 표식이다(경계 포함): n·52 + (n−1)·12 + 32 ≤ 최대 높이", () => {
    expect([layoutOf(4, 276), layoutOf(3, 212), layoutOf(2, 148), layoutOf(1, 84)].join(" ")).toBe([one(true, 4), one(true, 3), one(true, 2), one(true, 1)].join(" "));
  });

  it("표식만 안 들어가면 표식 없는 한 열이다", () => {
    expect([layoutOf(4, 275), layoutOf(4, 244), layoutOf(3, 211)].join(" ")).toBe([one(false, 4), one(false, 4), one(false, 3)].join(" "));
  });

  it("한 열도 안 들어가면 splitSideColumn 의 두 열이고 표식이 없다", () => {
    expect(layoutOf(4, 243)).toBe(JSON.stringify({ crown: false, columns: [3, 1] }));
    // UI-SPEC F-2 표의 360×560: 띠 두 줄 174 → [2,2], 한 줄 195 → [3,1], 기본 마피아(n=3) 174 → [2,1]
    expect([layoutOf(4, 174), layoutOf(4, 195), layoutOf(3, 174)].join(" ")).toBe(
      [
        { crown: false, columns: [2, 2] },
        { crown: false, columns: [3, 1] },
        { crown: false, columns: [2, 1] },
      ]
        .map((x) => JSON.stringify(x))
        .join(" "),
    );
    for (const [n, maxH] of [[4, 243], [4, 174], [5, 116], [3, 100]] as const) {
      expect(JSON.stringify(hostRailLayout(n, maxH).columns)).toBe(JSON.stringify(splitSideColumn(n, maxH)));
    }
  });

  it("단추가 없으면 열이 없고, 높이를 아직 모르면(무한) 표식 한 열이다", () => {
    expect(layoutOf(0, 500)).toBe(JSON.stringify({ crown: false, columns: [] }));
    expect(layoutOf(3, Infinity)).toBe(one(true, 3));
  });
});

const railButtons = (onPress: () => void = () => {}) => [
  <HostRailButton key="mode" id="mode" icon="deck" label="판 종류: 확장판" onPress={onPress} />,
  <MapChip key="map" rail choice="random" host onPress={onPress} />,
  <HostRailButton key="bots" id="bots" icon="bot" label="봇" onPress={onPress} />,
  <HostRailButton key="tutorial" id="tutorial" icon="book" label="튜토리얼 먼저" switchOn onPress={onPress} />,
];
const colsOf = (container: HTMLElement) =>
  [...container.querySelectorAll(".mf-hostrail__col")]
    .map((col) => [...col.querySelectorAll("[data-host-rail-btn]")].map((b) => b.getAttribute("data-host-rail-btn")).join(","))
    .join(" | ");

describe("HostRail — 방장 줄 틀 (19-03, D-13, UI-SPEC A·F-2)", () => {
  it("넉넉하면 role=group '방장 전용' 줄 하나에 왕관 표식 + 한 열, 단추는 준 순서대로다", () => {
    const { container } = render(<HostRail maxHeight={500}>{railButtons()}</HostRail>);
    const rails = [...container.querySelectorAll("[data-host-rail]")];
    expect(rails.length).toBe(1);
    const rail = rails[0]!;
    expect(rail.getAttribute("role")).toBe("group");
    expect(rail.getAttribute("aria-label")).toBe("방장 전용");
    expect(rail.classList.contains("mf-hostrail")).toBe(true);
    expect(rail.hasAttribute("tabindex")).toBe(false);
    expect(rail.hasAttribute("data-test-shift")).toBe(false);
    const crowns = [...rail.querySelectorAll("[data-host-rail-crown]")];
    expect(crowns.length).toBe(1);
    expect(crowns[0]?.getAttribute("role")).toBe("img");
    expect(crowns[0]?.getAttribute("aria-label")).toBe("방장 전용");
    expect(crowns[0]?.querySelector("svg")?.getAttribute("width")).toBe("20");
    expect(crowns[0]?.querySelector("button")).toBeNull();
    expect(colsOf(container)).toBe("mode,map,bots,tutorial");
    // 표식이 열 묶음보다 먼저(위)다
    expect([...rail.children].map((c) => c.className).join(" > ")).toBe("mf-hostrail__crown > mf-hostrail__cols");
    // 표식 값은 고정 낱말뿐이다(T-19-11)
    expect([...rail.querySelectorAll("[data-host-rail-btn]")].every((b) => ["mode", "map", "bots", "tutorial"].includes(b.getAttribute("data-host-rail-btn") ?? ""))).toBe(true);
    // 줄에 보이는 글이 없다(D-15)
    expect((rail.textContent ?? "").trim()).toBe("");
  });

  it("한 열에 안 들어가면 표식 없이 두 열로 나뉘고 줄의 접근성 이름은 남는다", () => {
    const { container } = render(<HostRail maxHeight={180}>{railButtons()}</HostRail>);
    expect(container.querySelectorAll("[data-host-rail-crown]").length).toBe(0);
    expect(colsOf(container)).toBe("mode,map,bots | tutorial");
    expect(container.querySelector("[data-host-rail]")?.getAttribute("aria-label")).toBe("방장 전용");
  });

  it("표식만 안 들어가면 표식 없는 한 열이다", () => {
    const { container } = render(<HostRail maxHeight={250}>{railButtons()}</HostRail>);
    expect(container.querySelectorAll("[data-host-rail-crown]").length).toBe(0);
    expect(colsOf(container)).toBe("mode,map,bots,tutorial");
  });

  it("null 자식은 칸이 아니다 — 기본 마피아 판처럼 토글이 빠지면 셋으로 센다", () => {
    const { container } = render(
      <HostRail maxHeight={212}>
        {railButtons().slice(0, 3)}
        {null}
        {false}
      </HostRail>,
    );
    expect(colsOf(container)).toBe("mode,map,bots");
    expect(container.querySelectorAll("[data-host-rail-crown]").length).toBe(1);
  });

  it("testShift 면 data-test-shift 를 단다(테스트 방 단추 아래로, P19-5)", () => {
    const { container } = render(
      <HostRail maxHeight={500} testShift>
        {railButtons()}
      </HostRail>,
    );
    expect(container.querySelector("[data-host-rail]")?.hasAttribute("data-test-shift")).toBe(true);
  });

  it("단추가 하나도 없으면 줄을 그리지 않는다", () => {
    const { container } = render(<HostRail maxHeight={500}>{null}</HostRail>);
    expect(container.querySelector("[data-host-rail]")).toBeNull();
    expect(container.innerHTML).toBe("");
  });

  it("줄 안의 단추는 그대로 눌린다", () => {
    const onPress = vi.fn();
    const { container } = render(<HostRail maxHeight={500}>{railButtons(onPress)}</HostRail>);
    expect(container.querySelectorAll("[data-host-rail-btn]").length).toBe(4);
    for (const b of container.querySelectorAll("[data-host-rail-btn]")) fireEvent.click(b);
    expect(onPress).toHaveBeenCalledTimes(4);
  });
});

describe("MapChip 줄 변형 (19-03, P19-4)", () => {
  it("rail 이면 방장 단추 모양·표식 map 이고 data-side-button 이 없다. 아이콘·data-map-chip·이름은 그대로다", () => {
    const { container } = render(<MapChip rail choice="plaza" host onPress={() => {}} />);
    const chip = container.querySelector("[data-map-chip]");
    expect(chip?.getAttribute("data-host-rail-btn")).toBe("map");
    expect(chip?.getAttribute("data-map-chip")).toBe("plaza");
    expect(chip?.className).toBe("mf-mapchip mv-hostrail-btn");
    expect(chip?.hasAttribute("data-side-button")).toBe(false);
    expect(chip?.getAttribute("aria-label")).toBe("맵 광장");
    expect(chip?.getAttribute("aria-pressed")).toBe("false");
    expect(chip?.querySelector("svg")).not.toBeNull();
  });

  it("rail + pressed 면 aria-pressed=true 다(꾸미기 시트의 맵 탭이 열려 있음)", () => {
    const { container } = render(<MapChip rail pressed choice="bar" host onPress={() => {}} />);
    expect(container.querySelector("[data-map-chip]")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("rail 이어도 누르면 onPress 한 번, 방장이 아니면 0번이다", () => {
    const onPress = vi.fn();
    const a = render(<MapChip rail choice="random" host onPress={onPress} />);
    expect(a.container.querySelector("[data-host-rail-btn]")).not.toBeNull();
    fireEvent.click(a.container.querySelector("[data-map-chip]")!);
    expect(onPress).toHaveBeenCalledTimes(1);
    a.unmount();
    const b = render(<MapChip rail choice="random" host={false} onPress={onPress} />);
    fireEvent.click(b.container.querySelector("[data-map-chip]")!);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("rail 없이 그리면 지금 마크업 그대로다(기존 화면은 바뀌지 않는다)", () => {
    const { container } = render(<MapChip choice="bar" host onPress={() => {}} />);
    const chip = container.querySelector("[data-map-chip]");
    expect(chip?.getAttribute("data-side-button")).toBe("map");
    expect(chip?.className).toBe("mf-mapchip");
    expect(chip?.hasAttribute("data-host-rail-btn")).toBe(false);
    expect(chip?.hasAttribute("aria-pressed")).toBe(false);
  });
});

describe("ModeChip — 참가자 읽기 전용 칩 (19-03, D-07, UI-SPEC C)", () => {
  it("누를 수 없는 정적 글이다: button 아님·tabindex 없음·aria-label 없음, 글은 '판 종류: {이름}'", () => {
    const { container } = render(<ModeChip mode="basic" />);
    const chips = [...container.querySelectorAll("[data-mode-chip]")];
    expect(chips.length).toBe(1);
    const chip = chips[0]!;
    expect(chip.getAttribute("data-mode-chip")).toBe("basic");
    expect(chip.tagName).not.toBe("BUTTON");
    expect(container.querySelector("button")).toBeNull();
    expect(chip.hasAttribute("tabindex")).toBe(false);
    expect(chip.hasAttribute("aria-label")).toBe(false);
    expect(chip.hasAttribute("role")).toBe(false);
    expect(chip.hasAttribute("aria-live")).toBe(false);
    expect(chip.hasAttribute("data-test-shift")).toBe(false);
    expect(chip.classList.contains("mf-modechip")).toBe(true);
    expect(chip.textContent).toBe("판 종류: 기본 마피아");
    // 보이는 글은 판 이름뿐이고 앞 글은 화면에 안 보이는 접근성 글이다
    expect(chip.querySelector(".mf-sr-only")?.textContent).toBe("판 종류: ");
    expect([...chip.querySelectorAll("span:not(.mf-sr-only)")].map((s) => s.textContent).join("|")).toBe("기본 마피아");
    const svg = chip.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("16");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("확장판은 '판 종류: 확장판', testShift 면 data-test-shift 를 단다", () => {
    const { container } = render(<ModeChip mode="extended" testShift />);
    const chip = container.querySelector("[data-mode-chip]");
    expect(chip?.getAttribute("data-mode-chip")).toBe("extended");
    expect(chip?.textContent).toBe("판 종류: 확장판");
    expect(chip?.hasAttribute("data-test-shift")).toBe(true);
  });
});

describe("방장 줄·칩 CSS (19-03, UI-SPEC A-1·C-1·Color, T-19-12)", () => {
  const TOP = "top: calc(var(--mf-host-bottom, 62px) + 12px)";

  it("줄의 위 시작은 오른쪽 열(.mv-side)과 같은 식이고 왼쪽 16·같은 층·눌림 통과다", () => {
    expect(ruleOf(V2, ".mv-side")).toContain(TOP);
    const rail = ruleOf(V2, ".mf-hostrail");
    expect(rail).toContain(TOP);
    expect(rail).toContain("left: var(--space-md)");
    expect(rail).toContain("z-index: var(--z-overlay)");
    expect(rail).toContain("pointer-events: none");
    expect(rail).toContain("position: absolute");
  });

  it("테스트 방은 줄·칩이 48px 더 내려온다(P19-5)", () => {
    expect(ruleOf(V2, ".mf-hostrail[data-test-shift]")).toContain("top: calc(var(--mf-host-bottom, 62px) + 12px + 48px)");
    expect(ruleOf(V2, ".mf-modechip[data-test-shift]")).toContain("top: calc(var(--mf-host-bottom, 62px) + 20px + 48px)");
  });

  it("왕관 표식은 52×20·아래 12·금빛, 열 묶음은 가로 12, 열은 세로 12 다", () => {
    const crown = ruleOf(V2, ".mf-hostrail__crown");
    expect(crown).toContain("width: var(--control-button)");
    expect(crown).toContain("height: 20px");
    expect(crown).toContain("margin-bottom: 12px");
    expect(crown).toContain("color: var(--light-lamp)");
    const cols = ruleOf(V2, ".mf-hostrail__cols");
    expect(cols).toContain("flex-direction: row");
    expect(cols).toContain("gap: 12px");
    const col = ruleOf(V2, ".mf-hostrail__col");
    expect(col).toContain("flex-direction: column");
    expect(col).toContain("gap: 12px");
  });

  it("칩은 줄 위 시작 + 8(= + 20px)·높이 32 알약·1px night-600·night-900·14px/400 이고 눌림을 통과시킨다", () => {
    const chip = ruleOf(V2, ".mf-modechip");
    expect(chip).toContain("top: calc(var(--mf-host-bottom, 62px) + 20px)");
    expect(chip).toContain("left: var(--space-md)");
    expect(chip).toContain("height: 32px");
    expect(chip).toContain("border-radius: var(--radius-pill)");
    expect(chip).toContain("border: 1px solid var(--night-600)");
    expect(chip).toContain("background: var(--night-900)");
    expect(chip).toContain("color: var(--gray-100)");
    expect(chip).toContain("font-size: 14px");
    expect(chip).toContain("font-weight: 400");
    expect(chip).toContain("padding: 0 12px");
    expect(chip).toContain("gap: var(--space-sm)");
    expect(chip).toContain("pointer-events: none");
    expect(chip).toContain("z-index: var(--z-overlay)");
  });

  it("시트 층이 열려 있는 동안 오른쪽 열과 함께 줄·칩도 숨는다", () => {
    const at = V2.indexOf(".mf-room:has([data-sheet-layer]) .mv-side");
    expect(at).toBeGreaterThan(-1);
    // 그 규칙의 선택자 목록(앞 규칙의 닫는 중괄호 뒤부터 여는 중괄호까지)과 본문
    const start = V2.lastIndexOf("}", at) + 1;
    // 실패 보고가 한 줄이 되도록 줄바꿈을 접는다
    const selectors = V2.slice(start, V2.indexOf("{", at)).replace(/\s+/g, " ").trim();
    expect(selectors).toContain(".mf-room:has([data-sheet-layer]) .mf-hostrail");
    expect(selectors).toContain(".mf-room:has([data-sheet-layer]) .mf-modechip");
    expect(V2.slice(at, V2.indexOf("}", at))).toContain("visibility: hidden");
  });

  it("방장 단추는 깜빡이지 않는다 — 빛남(.is-call) 선택자에 줄 단추가 없다", () => {
    const rules = V2.split("}").filter((r) => r.includes("is-call") && (r.includes("mv-hostrail-btn") || r.includes("mf-hostrail")));
    expect(rules.length).toBe(0);
    // 새 모션이 없다: 줄·칩 규칙에 animation·transition 이 없다
    const mine = V2.split("}").filter((r) => /\.(mf-hostrail|mv-hostrail-btn|mf-modechip)/.test(r.split("{")[0] ?? ""));
    expect(mine.length).toBeGreaterThan(8);
    expect(mine.filter((r) => /animation|transition/.test(r)).length).toBe(0);
  });

  it("모션 줄이기에서는 누름 변형도 끈다", () => {
    expect(/@media \(prefers-reduced-motion: reduce\) \{\s*\.mv-hostrail-btn:active \{ transform: none; \}/.test(V2)).toBe(true);
  });

  it("줄·칩 CSS 에 hex 색이 없다(토큰만)", () => {
    const mine = V2.split("}").filter((r) => /mf-hostrail|mv-hostrail-btn|mf-modechip/.test(r));
    expect(mine.filter((r) => /#[0-9a-fA-F]{3,8}\b/.test(r)).length).toBe(0);
  });
});
