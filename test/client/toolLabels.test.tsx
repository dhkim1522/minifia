/// <reference types="node" />
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { Sheet } from "../../src/components/Sheet";
import { ChatPanel, type ChatPanelProps } from "../../src/components/v2/ChatPanel";
import { DressSheet } from "../../src/components/v2/DressSheet";
import { FloatAction } from "../../src/components/v2/FloatAction";
import { MapChip } from "../../src/components/v2/MapChip";
import { ResultPanel, type ResultPanelProps, type ResultTab } from "../../src/components/v2/ResultPanel";
import { WillSheet } from "../../src/components/v2/WillSheet";
import { EMOTE_TRAY_ORDER } from "../../src/game/chatText";
import { DRESS_TEXT, MAP_CHIP_NAME } from "../../src/game/dressText";
import { setEngineForTest } from "../../src/audio/unlock";
import { makeRig } from "../helpers/soundRig";
import type { RoleId } from "../../shared/game/roles";
import type { GameWinner, MorningView, PhaseId, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { RESULT_PANEL_TEXT, RESULT_TABS_SHOWN } from "../../src/game/resultText";

// 방 화면 전수 검사(14-07 Task 2)용 가짜: 연결 훅·에셋 미리 읽기·3D 무대(guide.test.tsx 와 같은 모양).
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
vi.mock("../../src/net/assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/net/assets")>()),
  preloadRoleAssets: vi.fn(),
  preloadDuskAssets: vi.fn(),
}));
vi.mock("../../src/components/WorldStage", async () => ({ WorldStage: (await import("../helpers/fakeWorldStage")).FakeWorldStage }));
const { RoomScreen } = await import("../../src/screens/RoomScreen");

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

describe("머리·떠 있는 단추·옷장 이름표 (TOOL-01 목록 1~5·7·12·13)", () => {
  it("MapChip: 라벨 '맵', data-tool-label '맵', 접근성 이름 '맵 …' — 손님(aria-disabled)도 라벨이 보인다", () => {
    for (const host of [true, false]) {
      for (const choice of ["bar", "plaza", "random"] as const) {
        const { container, unmount } = render(<MapChip choice={choice} host={host} onPress={() => {}} />);
        const chip = container.querySelector("[data-map-chip]");
        expectToolLabel(chip, "맵", { name: MAP_CHIP_NAME[choice] });
        expect(chip?.getAttribute("aria-disabled") === "true").toBe(!host);
        expect(chip?.querySelector(".mf-mapchip__label")?.textContent).toBe("맵");
        unmount();
      }
    }
  });

  it("DRESS_TEXT.open 은 '옷장' 이고 FloatAction(옷장)은 라벨·접근성 이름이 같은 낱말이다", () => {
    expect(DRESS_TEXT.open).toBe("옷장");
    const { container } = render(<FloatAction kind="dress" icon="hanger" label={DRESS_TEXT.open} onPress={() => {}} />);
    expectToolLabel(container.querySelector("[data-float=dress]"), "옷장", { name: "옷장" });
    expect(container.querySelector("[data-float=dress] svg")).not.toBeNull();
  });

  it("FloatAction(넘기기): 라벨 '넘기기' 아래, 위 'k / n' 은 장식으로 유지된다(보이는 글자 비교는 숫자·'/' 를 뺀다)", () => {
    const { container } = render(<FloatAction kind="skip" icon="skip" label="넘기기" count="2 / 5" onPress={() => {}} />);
    const b = container.querySelector("[data-float=skip]");
    expectToolLabel(b, "넘기기", { name: "넘기기" });
    expect(b?.querySelector("[data-float-count]")?.textContent).toBe("2 / 5");
    expect(b?.querySelector("[data-float-count]")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("FloatAction 막힘(aria-disabled)도 라벨이 보인다(UI#10 partial)", () => {
    const { container } = render(<FloatAction kind="dress" icon="hanger" label="옷장" disabled onPress={() => {}} />);
    expect(container.querySelector("[data-float=dress]")?.getAttribute("aria-disabled")).toBe("true");
    expectToolLabel(container.querySelector("[data-float=dress]"), "옷장");
  });

  it("옷장 시트: 이름 '옷장', 방장 탭 둘은 '맵'·'의상' 글자, 닫기는 × + '닫기' 알약", () => {
    const { container } = render(<DressSheet value="coat" onPick={() => {}} onClose={() => {}} host tab="map" mapChoice="random" onPickMap={() => {}} />);
    expect(container.querySelector("[data-dress-sheet]")?.getAttribute("aria-label")).toBe("옷장");
    expectToolLabel(container.querySelector("[data-map-tab=map]"), "맵", { name: "맵" });
    expectToolLabel(container.querySelector("[data-map-tab=dress]"), "의상", { name: "의상" });
    const close = container.querySelector(".mv-dress-sheet__close");
    expectToolLabel(close, "닫기", { name: "닫기" });
    expect(close?.classList.contains("mv-closepill")).toBe(true);
    expect(close?.querySelector("svg")).not.toBeNull();
  });

  it("손님의 옷장 시트에는 탭이 없고 닫기 알약은 있다", () => {
    const { container } = render(<DressSheet value="coat" onPick={() => {}} onClose={() => {}} />);
    expect(container.querySelector("[data-map-tab]")).toBeNull();
    expectToolLabel(container.querySelector(".mv-dress-sheet__close"), "닫기");
  });

  it("CSS: 맵 칩·떠 있는 단추·소리 단추의 라벨은 14/400 gray-300 이고 단추 폭 ≤ 52 이다", () => {
    expect(rule(".mf-mapchip__label")).toContain("font-size: 14px");
    expect(rule(".mf-mapchip__label")).toContain("color: var(--gray-300)");
    expect(rule(".mv-float__label")).toContain("font-size: 14px");
    expect(rule(".mv-float__label")).toContain("color: var(--gray-300)");
    expect(rule(".mv-sound__label")).toContain("font-size: 14px");
    expect(rule(".mv-sound__label")).toContain("font-weight: 400");
    expect(rule(".mf-mapchip")).toContain("width: var(--tap-min)");
    expect(rule(".mv-float")).toContain("width: var(--control-input)");
  });
});

// ---- 방 화면 전수 이름표 검사 (14-07 Task 2, UI-SPEC "도구 이름표 검사") ----
// RoomScreen 을 단계 × 시점으로 그려, 보이는 button·[role=tab] 가운데 보이는 글자(숫자·공백·'/' 제외)가 비어 있는 것이 면제 밖에 0건임을 센다.
// 판정은 느슨하게 하지 않는다 — 실패하면 빠진 단추를 부품에서 고친다. 이 시험은 14-07 이 소리 단추까지 포함해 방 화면 전체를 본다.

const NOW = 1_700_000_000_000;

/**
 * 면제(이름표를 붙이지 않음, UI-SPEC "도구 이름표 목록" 면제 문단). 이 셋 밖의 아이콘 단추는 결함이다.
 * E-1: 방장의 내보내기 ×(WorldStage 이름표에 붙는 방장 전용 보조 단추 — 누르면 확인 시트가 "내보내기"로 이름을 말한다)
 * E-2: 테스트 방 시트 안의 봇 ±(개발 도구, 방장 테스트 모드뿐)
 * E-3: 입력칸 앞 채널 아이콘 — 누르는 것이 아니라 단추가 아니므로 이 검사 대상이 아니다(`.mv-chat__chan` 은 span)
 */
const EXEMPT: ReadonlyArray<{ id: "E-1" | "E-2"; selector: string }> = [
  { id: "E-1", selector: ".mf-world__kick" },
  { id: "E-2", selector: ".mf-tt-sheet__step" },
];

type Viewpoint = "mafia" | "police" | "doctor" | "citizen" | "spectator";
const ROLE_OF: Readonly<Record<Exclude<Viewpoint, "spectator">, RoleId>> = { mafia: "mafia", police: "police", doctor: "doctor", citizen: "citizen" };

interface ViewOpts {
  phase: PhaseId;
  viewpoint?: Viewpoint;
  endsIn?: number | null;
  isHost?: boolean;
  candidate?: number;
  morning?: MorningView;
  code?: string | null;
}

function makeView(o: ViewOpts): RoomView {
  const vp = o.viewpoint ?? "citizen";
  const me: RoomView["me"] = { seat: 0, isHost: o.isHost ?? false };
  me.role = vp === "spectator" ? "citizen" : ROLE_OF[vp];
  if (vp === "mafia") me.allies = [2];
  const endsIn = o.endsIn === undefined ? 15_000 : o.endsIn;
  return {
    code: o.code === null ? undefined : (o.code ?? "0042"),
    phase: o.phase,
    phaseEndsAt: endsIn === null ? null : NOW + endsIn,
    phaseDurationMs: endsIn === null ? null : 15_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: [
      { seat: 0, nickname: "지우", connected: true, isHost: true },
      { seat: 1, nickname: "하윤", connected: true, isHost: false },
      { seat: 2, nickname: "민지", connected: true, isHost: false },
      { seat: 3, nickname: "도현", connected: true, isHost: false },
    ].map((p) => (p.seat === 0 && vp === "spectator" ? { ...p, alive: false } : p)),
    me,
    day: {
      n: 1,
      roles: ["mafia", "police", "citizen"],
      ...(o.morning !== undefined ? { morning: o.morning } : {}),
      ...(o.candidate !== undefined ? { candidate: o.candidate } : {}),
    },
  } as RoomView;
}

function endedView(vp: Viewpoint, winner: GameWinner = "citizenWin"): RoomView {
  const view = makeView({ phase: "ended", viewpoint: vp, endsIn: null });
  view.result = {
    winner,
    seats: view.players.map((p) => ({ seat: p.seat, job: p.seat === 2 ? ("mafia" as const) : ("citizen" as const) })),
    summary: [],
  };
  return view;
}

function conn(view: RoomView): RoomConnection {
  return {
    status: "open",
    banner: "hidden",
    view,
    offset: 0,
    epoch: 1,
    removedReason: null,
    canSend: true,
    send: vi.fn(() => true),
    onEvent: vi.fn(() => () => {}),
    reconnect: vi.fn(),
    retry: vi.fn(),
  };
}

function renderRoom(view: RoomView) {
  connectionMock.current = conn(view);
  return render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={vi.fn()} />);
}

/** aria-hidden·hidden 조상이 없고 닫힌 dialog 안이 아닌 요소 */
function isVisible(el: Element): boolean {
  return el.closest("[aria-hidden='true'], [hidden], [inert], dialog:not([open])") === null;
}

/** aria-hidden 조각을 뺀 보이는 글자에서 숫자·공백·'/' 를 지운 값 */
function visibleWord(el: Element): string {
  let out = "";
  const walk = (n: Node): void => {
    if (n.nodeType === 3) out += n.textContent ?? "";
    else if (n.nodeType === 1 && (n as Element).getAttribute("aria-hidden") !== "true") n.childNodes.forEach(walk);
  };
  el.childNodes.forEach(walk);
  return out.replace(/[\d\s/]/g, "");
}

function nameOf(el: Element): string {
  return el.getAttribute("aria-label") ?? visibleWord(el);
}

/** 한 화면의 위반 목록. 비어 있어야 한다. 메시지는 화면 이름 + 단추 접근성 이름 */
function violations(scene: string, minButtons = 1): string[] {
  const out: string[] = [];
  const buttons = [...document.body.querySelectorAll("button, [role=tab]")].filter(isVisible);
  // 검사가 빈 화면을 지나가지 않게: 배정 화면 말고는 단추가 하나 이상(입력줄·[내 역할]·[나가기] …) 있다
  if (buttons.length < minButtons) out.push(`${scene}: 보이는 단추가 ${buttons.length}개뿐이다(렌더 실패?)`);
  for (const b of buttons) {
    const exempt = EXEMPT.find((e) => b.matches(e.selector));
    if (exempt) continue;
    const word = visibleWord(b);
    if (word === "") out.push(`${scene}: 보이는 글자가 없는 단추 — '${nameOf(b)}'`);
    const tool = b.getAttribute("data-tool-label");
    if (tool !== null) {
      const want = tool.replace(/\s/g, "");
      // 소리 단추의 잠김 알약은 글자가 '소리 켜기' 라 낱말 '소리' 로 시작한다(8초 뒤 접히면 '소리' 와 같다)
      if (word !== want && !word.startsWith(want)) out.push(`${scene}: data-tool-label '${tool}' ≠ 보이는 글자 '${word}'`);
      if (!nameOf(b).includes(tool)) out.push(`${scene}: 접근성 이름 '${nameOf(b)}' 이 낱말 '${tool}' 을 포함하지 않는다`);
      if (!/^[가-힣]+$/.test(want) || [...want].length > 4) out.push(`${scene}: 낱말 '${tool}' 이 고정 한글 낱말(4자 이하)이 아니다`);
    }
  }
  return out;
}

describe("방 화면 전수 이름표 (TOOL-01, UI-SPEC 검사)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    // 소리 단추도 전수에 넣는다(소리 엔진이 있는 환경 = 방 화면마다 독 안에 [소리])
    setEngineForTest(makeRig().engine);
  });
  afterEach(() => setEngineForTest(null));

  const VIEWPOINTS: readonly Viewpoint[] = ["mafia", "police", "doctor", "citizen", "spectator"];

  it("대기실 방장·손님(방 코드 있음)", () => {
    for (const isHost of [true, false]) {
      const view = makeView({ phase: "lobby", endsIn: null, isHost });
      delete view.me.role;
      const { unmount } = renderRoom(view);
      expect(violations(`lobby/${isHost ? "방장" : "손님"}`)).toEqual([]);
      // 방 코드가 있으면 [공유] 도 이름표를 단다
      expect(document.body.querySelector('[data-tool-label="공유"]')).not.toBeNull();
      expect(document.body.querySelector('[data-tool-label="나가기"]')).not.toBeNull();
      expect(document.body.querySelector("[data-sound-button]"), "대기실에도 [소리]").not.toBeNull();
      unmount();
    }
  });

  it("대기실: 방 코드가 없으면 [공유] 가 없고 나머지는 이름표를 단다", () => {
    const view = makeView({ phase: "lobby", endsIn: null, isHost: true, code: null });
    delete view.me.role;
    renderRoom(view);
    expect(violations("lobby/코드 없음")).toEqual([]);
  });

  it("배정·역할 확인(카드 앞면 전·후)", () => {
    const a = renderRoom(makeView({ phase: "assigning", endsIn: 3_000 }));
    expect(violations("assigning", 0)).toEqual([]); // 배정 화면은 글자뿐이라 단추가 없을 수 있다
    a.unmount();
    const { container } = renderRoom(makeView({ phase: "roleReveal", viewpoint: "police", endsIn: 15_000 }));
    expect(violations("roleReveal/앞면 전")).toEqual([]);
    const card = container.querySelector<HTMLElement>(".mf-card");
    if (card) {
      act(() => void fireEvent.click(card));
      expect(violations("roleReveal/앞면 후")).toEqual([]);
    }
  });

  it("낮 시작·토론·지목·변론(본인·남)·찬반·처형 — 역할 넷 + 유령", () => {
    const phases: readonly PhaseId[] = ["dayAnnounce", "discussion", "nomination", "defense", "verdict", "execution"];
    for (const phase of phases) {
      for (const vp of VIEWPOINTS) {
        for (const candidate of phase === "defense" || phase === "verdict" || phase === "execution" ? [0, 2] : [undefined]) {
          const endsIn = phase === "dayAnnounce" ? null : 15_000;
          const view = makeView({ phase, viewpoint: vp, endsIn, ...(candidate !== undefined ? { candidate } : {}) });
          if (phase === "nomination") view.day!.turn = { order: [0, 1, 2, 3], i: -1 };
          const { unmount } = renderRoom(view);
          expect(violations(`${phase}/${vp}${candidate === undefined ? "" : `/변론자 ${candidate === 0 ? "본인" : "남"}`}`)).toEqual([]);
          unmount();
        }
      }
    }
  });

  it("밤(역할별)·아침·유령", () => {
    for (const vp of VIEWPOINTS) {
      const night = renderRoom(makeView({ phase: "night", viewpoint: vp, endsIn: 30_000 }));
      expect(violations(`night/${vp}`)).toEqual([]);
      expect(document.body.querySelector("[data-sound-button]"), `night/${vp}: [소리]`).not.toBeNull();
      night.unmount();
      const morning = renderRoom(makeView({ phase: "morning", viewpoint: vp, endsIn: 5_000, morning: {} }));
      expect(violations(`morning/${vp}`)).toEqual([]);
      morning.unmount();
    }
  });

  it("결과(승리 팀 둘 × 산 사람·유령)", () => {
    for (const winner of ["citizenWin", "mafiaWin"] as const) {
      for (const vp of ["citizen", "spectator"] as const) {
        const { unmount } = renderRoom(endedView(vp, winner));
        expect(violations(`ended/${winner}/${vp}`)).toEqual([]);
        // 결과 머리 [나가기] 와 기록 탭은 이름표를 단다
        expect(document.body.querySelector('.mf-result__header [data-tool-label="나가기"]')).not.toBeNull();
        expect(document.body.querySelector("[data-sound-button]"), `ended/${winner}/${vp}: [소리]`).not.toBeNull();
        unmount();
      }
    }
  });

  it("옷장 시트·[내 역할] 시트·유언 시트를 하나씩 연 상태", () => {
    // 옷장(대기실, 방장 = 탭 둘)
    const lobby = makeView({ phase: "lobby", endsIn: null, isHost: true });
    delete lobby.me.role;
    const l = renderRoom(lobby);
    const dress = document.body.querySelector<HTMLElement>("[data-float=dress]");
    expect(dress, "옷장 단추").not.toBeNull();
    act(() => void fireEvent.click(dress!));
    expect(document.body.querySelector("[data-dress-sheet]"), "옷장 시트").not.toBeNull();
    expect(violations("옷장 시트")).toEqual([]);
    l.unmount();
    // [내 역할] 시트(낮 토론)
    const day = renderRoom(makeView({ phase: "discussion", viewpoint: "police" }));
    const role = document.body.querySelector<HTMLElement>('[data-tool-label="내 역할"]');
    expect(role, "내 역할 단추").not.toBeNull();
    act(() => void fireEvent.click(role!));
    expect(document.body.querySelector("dialog"), "내 역할 시트").not.toBeNull();
    expect(violations("내 역할 시트")).toEqual([]);
    day.unmount();
    // 유언 시트(낮 토론 — [유언] 단추)
    const will = renderRoom(makeView({ phase: "discussion", viewpoint: "citizen" }));
    const pen = document.body.querySelector<HTMLElement>("[data-will-button]");
    expect(pen, "유언 단추").not.toBeNull();
    act(() => void fireEvent.click(pen!));
    expect(document.body.querySelector("[data-will-sheet]"), "유언 시트").not.toBeNull();
    expect(violations("유언 시트")).toEqual([]);
    will.unmount();
  });

  it("이름표 낱말은 고정 문구뿐이다 — 모든 화면의 data-tool-label 값 집합이 허용 목록 안이다(T-14-16: 역할·좌석 없음)", () => {
    const ALLOWED = new Set(["동작", "보내기", "유언", "새 글", "닫기", "전체", "마피아", "유령", "기록", "나가기", "공유", "맵", "옷장", "의상", "넘기기", "소리", "내 역할"]);
    const seen = new Set<string>();
    const views: RoomView[] = [
      (() => {
        const v = makeView({ phase: "lobby", endsIn: null, isHost: true });
        delete v.me.role;
        return v;
      })(),
      makeView({ phase: "discussion", viewpoint: "mafia" }),
      makeView({ phase: "night", viewpoint: "police", endsIn: 30_000 }),
      endedView("citizen"),
      endedView("spectator", "mafiaWin"),
    ];
    for (const view of views) {
      const { unmount } = renderRoom(view);
      for (const el of document.body.querySelectorAll("[data-tool-label]")) seen.add(el.getAttribute("data-tool-label") ?? "");
      expect(document.body.innerHTML).not.toMatch(/data-tool-label="[^"]*(seat|nonce|token)/i);
      unmount();
    }
    expect([...seen].filter((w) => !ALLOWED.has(w))).toEqual([]);
    expect(seen.size).toBeGreaterThan(6);
  });

  it("검사가 실제로 잡는다: 글자 없는 아이콘 단추·낱말을 포함하지 않는 접근성 이름·E-1 면제는 각각 판정된다", () => {
    const { unmount } = renderRoom(makeView({ phase: "discussion", viewpoint: "citizen" }));
    const host = document.createElement("div");
    host.innerHTML =
      '<button aria-label="아이콘만"><svg></svg></button>' +
      '<button data-tool-label="공유" aria-label="전달"><svg></svg><span>공유</span></button>' +
      '<button class="mf-world__kick" aria-label="지우 님 내보내기"><svg></svg></button>' +
      '<button aria-hidden="true" aria-label="숨김"></button>';
    document.body.appendChild(host);
    const found = violations("가짜");
    expect(found.some((m) => m.includes("아이콘만"))).toBe(true);
    expect(found.some((m) => m.includes("전달"))).toBe(true);
    expect(found.some((m) => m.includes("내보내기"))).toBe(false); // E-1 면제
    expect(found.some((m) => m.includes("숨김"))).toBe(false); // 보이지 않는 단추
    host.remove();
    unmount();
  });

  it("면제 목록 상수는 E-1·E-2 둘이고(E-3 은 단추가 아니라 대상 밖), 각각 실제 클래스를 가리킨다", () => {
    expect(EXEMPT.map((e) => e.id)).toEqual(["E-1", "E-2"]);
    expect(readFileSync("src/components/WorldStage.tsx", "utf8")).toContain("mf-world__kick");
    expect(readFileSync("src/styles/testtools.css", "utf8")).toContain("mf-tt-sheet__step");
    expect(readFileSync("src/components/v2/ChatPanel.tsx", "utf8")).toMatch(/<span className=\{channel === "mafia" \? "mv-chat__chan/);
  });
});
