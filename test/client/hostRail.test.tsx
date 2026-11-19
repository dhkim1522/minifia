/// <reference types="node" />
import { act, cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { HOST_RAIL_LABEL, HostRail } from "../../src/components/v2/HostRail";
import { HostRailButton } from "../../src/components/v2/HostRailButton";
import { MapChip } from "../../src/components/v2/MapChip";

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

describe("방장 줄 문구 (19-03, 22-07)", () => {
  it("방장 줄·왕관 표식의 접근성 이름은 '방장 전용' 이다", () => {
    expect(HOST_RAIL_LABEL).toBe("방장 전용");
  });
});

describe("판 종류 화면이 DOM·CSS 에 없다 (22-07, D-01, P22-15)", () => {
  it("[data-host-rail-btn=\"mode\"]·[data-mode-sheet]·[data-mode-card]·[data-mode-chip] 는 방장 줄에 0건이다", () => {
    const { container } = render(<HostRail maxHeight={500}>{railButtons()}</HostRail>);
    for (const sel of ['[data-host-rail-btn="mode"]', "[data-mode-sheet]", "[data-mode-card]", "[data-mode-chip]"]) {
      expect(`${sel}:${container.querySelectorAll(sel).length}`).toBe(`${sel}:0`);
    }
  });

  it("판 종류 시트·칩의 CSS 규칙이 없다", () => {
    expect(SHEET).not.toContain("mf-mode-sheet");
    expect(SHEET).not.toContain("mf-mode-card");
    expect(V2).not.toContain("mf-modechip");
  });
});

describe("HostRailButton — 방장 도구 타일 (19-03, D-13·D-14, UI-SPEC A-3·A-4)", () => {
  it("id=bots: 단추 하나, 표식 bots, 접근성 이름은 받은 글, 보이는 글이 없고 눌림은 기본 false 다", () => {
    const { container } = render(<HostRailButton id="bots" icon="bot" label="봇" onPress={() => {}} />);
    const buttons = [...container.querySelectorAll("button")];
    expect(buttons.length).toBe(1);
    const btn = buttons[0]!;
    expect(btn.getAttribute("data-host-rail-btn")).toBe("bots");
    expect(btn.getAttribute("aria-label")).toBe("봇");
    expect((container.textContent ?? "").trim()).toBe("");
    expect(btn.classList.contains("mv-hostrail-btn")).toBe(true);
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(btn.getAttribute("type")).toBe("button");
    expect(btn.getAttribute("data-float")).toBe("bots");
    expect(btn.querySelector("svg")?.getAttribute("width")).toBe("24");
    // 깜빡임 클래스를 스스로 달지 않는다(정지한 금빛 = 방장 전용)
    expect(btn.classList.contains("is-call")).toBe(false);
  });

  it("pressed 면 aria-pressed=true 다(시트가 열려 있음)", () => {
    const { container } = render(<HostRailButton id="bots" icon="bot" label="봇" pressed onPress={() => {}} />);
    expect(container.querySelector("[data-host-rail-btn]")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("누르면 onPress 가 단추 요소와 함께 한 번, disabled 면 aria-disabled 이고 0번이다", () => {
    const onPress = vi.fn();
    const first = render(<HostRailButton id="bots" icon="bot" label="봇" onPress={onPress} />);
    const btn = first.container.querySelector<HTMLElement>("[data-host-rail-btn]");
    expect(btn?.hasAttribute("aria-disabled")).toBe(false);
    fireEvent.click(btn!);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress.mock.calls[0]?.[0]).toBe(btn);
    first.unmount();

    const off = vi.fn();
    const second = render(<HostRailButton id="bots" icon="bot" label="봇" disabled onPress={off} />);
    const dead = second.container.querySelector<HTMLElement>("[data-host-rail-btn]");
    expect(dead?.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(dead!);
    expect(off).not.toHaveBeenCalled();
  });

  it("switchOn 을 주면 role=switch·aria-checked 이고 aria-pressed 는 없다", () => {
    const on = render(<HostRailButton id="bots" icon="bot" label="봇" switchOn onPress={() => {}} />);
    const a = on.container.querySelector("[data-host-rail-btn]");
    expect(a?.getAttribute("role")).toBe("switch");
    expect(a?.getAttribute("aria-checked")).toBe("true");
    expect(a?.hasAttribute("aria-pressed")).toBe(false);
    on.unmount();
    const off = render(<HostRailButton id="bots" icon="bot" label="봇" switchOn={false} onPress={() => {}} />);
    const b = off.container.querySelector("[data-host-rail-btn]");
    expect(b?.getAttribute("role")).toBe("switch");
    expect(b?.getAttribute("aria-checked")).toBe("false");
    expect(b?.hasAttribute("aria-pressed")).toBe(false);
  });

  it("기존 선택자를 잇는다: bots 는 data-float=bots 도 단다. 표식 값은 고정 낱말뿐이다", () => {
    const seen: string[] = [];
    for (const [id, icon] of [["bots", "bot"]] as const) {
      const { container, unmount } = render(<HostRailButton id={id} icon={icon} label="이름" onPress={() => {}} />);
      const btn = container.querySelector("[data-host-rail-btn]");
      seen.push(`${btn?.getAttribute("data-host-rail-btn")}:${btn?.getAttribute("data-float") ?? "-"}:${btn?.hasAttribute("data-tutorial-toggle") ? "t" : "-"}`);
      unmount();
    }
    expect(seen.join(" ")).toBe("bots:bots:-");
  });

  it("mousedown 의 기본 동작을 막아 입력칸 포커스를 뺏지 않는다", () => {
    const { container } = render(<HostRailButton id="bots" icon="bot" label="봇" onPress={() => {}} />);
    const btn = container.querySelector<HTMLElement>("[data-host-rail-btn]");
    expect(btn).not.toBeNull();
    const ev = createEvent.mouseDown(btn!);
    fireEvent(btn!, ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("CSS: 52px 도구 타일, 선택 상태에 밝은 윤곽 표시", () => {
    const base = ruleOf(V2, ".mv-hostrail-btn");
    expect(base).toContain("border: 1px solid var(--noir-control-line)");
    expect(base).toContain("background: var(--noir-control)");
    expect(base).toContain("color: var(--noir-paper)");
    expect(base).toContain("width: var(--control-button)");
    expect(base).toContain("height: var(--control-button)");
    expect(base).toContain("border-radius: var(--noir-control-radius)");
    expect(ruleOf(V2, '.mv-hostrail-btn[aria-pressed="true"]')).toContain("box-shadow: inset 0 0 0 1px var(--noir-paper)");
    const on = ruleOf(V2, '.mv-hostrail-btn[role="switch"][aria-checked="true"]');
    expect(on).toContain("background: var(--noir-control-on)");
    expect(on).toContain("color: var(--noir-paper)");
    expect(ruleOf(V2, '.mv-hostrail-btn[aria-disabled="true"]')).toContain("opacity: 0.45");
    expect(ruleOf(V2, ".mv-hostrail-btn:focus-visible")).toContain("outline: 2px solid var(--noir-paper)");
    expect(ruleOf(V2, ".mv-hostrail-btn:active")).toContain("transform: scale(0.94)");
  });
});

const railButtons = (onPress: () => void = () => {}) => [
  <HostRailButton key="bots-a" id="bots" icon="bot" label="봇" onPress={onPress} />,
  <MapChip key="map" rail choice="random" host onPress={onPress} />,
  <HostRailButton key="bots" id="bots" icon="bot" label="봇" onPress={onPress} />,
  // 줄 틀 시험의 단추 고정물(칸 수 4). 4번째 칸: 줄 틀 시험은 칸 수 4 에 맞춘 높이를 쓴다(토글 칸 자리의 일반 토글 단추 — 22-03 에서 [튜토리얼 먼저]가 없어졌다)
  <HostRailButton key="bots-b" id="bots" icon="bot" label="봇" switchOn onPress={onPress} />,
];
const colsOf = (container: HTMLElement) =>
  [...container.querySelectorAll(".mf-hostrail__col")]
    .map((col) => [...col.querySelectorAll("[data-host-rail-btn]")].map((b) => b.getAttribute("data-host-rail-btn")).join(","))
    .join(" | ");

describe("HostRail — 방장 줄 틀 (19-03, D-13, UI-SPEC A·F-2)", () => {
  it("넉넉하면 role=group '방장 전용' 줄에 단추만 한 열로 배치한다", () => {
    const { container } = render(<HostRail maxHeight={500}>{railButtons()}</HostRail>);
    const rails = [...container.querySelectorAll("[data-host-rail]")];
    expect(rails.length).toBe(1);
    const rail = rails[0]!;
    expect(rail.getAttribute("role")).toBe("group");
    expect(rail.getAttribute("aria-label")).toBe("방장 전용");
    expect(rail.classList.contains("mf-hostrail")).toBe(true);
    expect(rail.hasAttribute("tabindex")).toBe(false);
    expect(rail.hasAttribute("data-test-shift")).toBe(false);
    expect(colsOf(container)).toBe("bots,map,bots,bots");
    expect([...rail.children].map((c) => c.className)).toEqual(["mf-hostrail__cols"]);
    // 표식 값은 고정 낱말뿐이다(T-19-11)
    expect([...rail.querySelectorAll("[data-host-rail-btn]")].every((b) => ["map", "bots"].includes(b.getAttribute("data-host-rail-btn") ?? ""))).toBe(true);
    // 줄에 보이는 글이 없다(D-15)
    expect((rail.textContent ?? "").trim()).toBe("");
  });

  it("한 열에 안 들어가면 표식 없이 두 열로 나뉘고 줄의 접근성 이름은 남는다", () => {
    const { container } = render(<HostRail maxHeight={180}>{railButtons()}</HostRail>);
    expect(container.querySelectorAll("[data-host-rail-crown]").length).toBe(0);
    expect(colsOf(container)).toBe("bots,map,bots | bots");
    expect(container.querySelector("[data-host-rail]")?.getAttribute("aria-label")).toBe("방장 전용");
  });

  it("null 자식은 칸이 아니다 — 빠진 칸은 세지 않는다", () => {
    const { container } = render(
      <HostRail maxHeight={212}>
        {railButtons().slice(0, 3)}
        {null}
        {false}
      </HostRail>,
    );
    expect(colsOf(container)).toBe("bots,map,bots");
    expect(container.querySelectorAll("[data-host-rail-crown]").length).toBe(0);
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

describe("방장 줄 CSS (19-03, UI-SPEC A-1·Color, T-19-12; 22-07 칩 규칙 삭제)", () => {
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

  it("테스트 방은 줄이 48px 더 내려온다(P19-5)", () => {
    expect(ruleOf(V2, ".mf-hostrail[data-test-shift]")).toContain("top: calc(var(--mf-host-bottom, 62px) + 12px + 48px)");
  });

  it("열 사이와 열 안 간격은 12px이다", () => {
    const cols = ruleOf(V2, ".mf-hostrail__cols");
    expect(cols).toContain("flex-direction: row");
    expect(cols).toContain("gap: 12px");
    const col = ruleOf(V2, ".mf-hostrail__col");
    expect(col).toContain("flex-direction: column");
    expect(col).toContain("gap: 12px");
  });

  it("시트 층이 열려 있는 동안 오른쪽 열과 함께 줄도 숨는다", () => {
    const at = V2.indexOf(".mf-room:has([data-sheet-layer]) .mv-side");
    expect(at).toBeGreaterThan(-1);
    // 그 규칙의 선택자 목록(앞 규칙의 닫는 중괄호 뒤부터 여는 중괄호까지)과 본문
    const start = V2.lastIndexOf("}", at) + 1;
    // 실패 보고가 한 줄이 되도록 줄바꿈을 접는다
    const selectors = V2.slice(start, V2.indexOf("{", at)).replace(/\s+/g, " ").trim();
    expect(selectors).toContain(".mf-room:has([data-sheet-layer]) .mf-hostrail");
    expect(V2.slice(at, V2.indexOf("}", at))).toContain("visibility: hidden");
  });

  it("방장 단추는 깜빡이지 않는다 — 빛남(.is-call) 선택자에 줄 단추가 없다", () => {
    const rules = V2.split("}").filter((r) => r.includes("is-call") && (r.includes("mv-hostrail-btn") || r.includes("mf-hostrail")));
    expect(rules.length).toBe(0);
    // 새 모션이 없다: 줄 규칙에 animation·transition 이 없다
    const mine = V2.split("}").filter((r) => /\.(mf-hostrail|mv-hostrail-btn)/.test(r.split("{")[0] ?? ""));
    expect(mine.length).toBeGreaterThan(8);
    expect(mine.filter((r) => /animation|transition/.test(r)).length).toBe(0);
  });

  it("모션 줄이기에서는 누름 변형도 끈다", () => {
    expect(/@media \(prefers-reduced-motion: reduce\) \{\s*\.mv-hostrail-btn:active \{ transform: none; \}/.test(V2)).toBe(true);
  });

  it("줄 CSS 에 hex 색이 없다(토큰만)", () => {
    const mine = V2.split("}").filter((r) => /mf-hostrail|mv-hostrail-btn/.test(r));
    expect(mine.filter((r) => /#[0-9a-fA-F]{3,8}\b/.test(r)).length).toBe(0);
  });
});
