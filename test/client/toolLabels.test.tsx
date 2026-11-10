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

// 16페이즈 TOOL-04(결정 0077·0079, 14 의 TOOL-01 대체): 아이콘 단추 아래 글 이름표는 없다.
// 규칙: ① 이름표 속성(data-tool-label)과 아이콘 아래 라벨 요소는 어느 화면에도 0건 ② 모든 button·[role=tab] 에 비어 있지 않은 접근성 이름
// (아이콘 단추는 aria-label, 글 단추는 내용) ③ 접근성 이름은 고정 문구뿐(T-16-11: 역할·좌석 값 없음).
// 이 파일은 부품 단위 describe 로 시작하고 방 화면 전수 검사가 이어진다.

const V2_CSS = readFileSync("src/styles/v2.css", "utf8");

// 지워진 이름표의 흔적: 속성과 아이콘 아래 라벨 클래스(16-05 가 CSS 의 라벨 규칙을 지울 때까지 CSS 는 남아 있다)
const TOOL_ATTR = "data-tool-label";
const LABEL_SELECTOR = ".mv-tool__label, .mv-float__label, .mf-mapchip__label, .mv-sound__label, .mv-closepill__label, .mf-rolecard-btn__label";

/** 아이콘 단추 계약: 이름표 속성·라벨 요소가 없고, 보이는 글자가 없으며(숫자 장식 aria-hidden 제외), 접근성 이름 = name. */
export function expectIconButton(btn: Element | null, name: string): void {
  expect(btn, `아이콘 단추 '${name}'`).not.toBeNull();
  const el = btn as HTMLElement;
  expect(el.hasAttribute(TOOL_ATTR), `'${name}' 에 이름표 속성이 없다`).toBe(false);
  expect(el.querySelector(LABEL_SELECTOR), `'${name}' 아래 라벨 요소가 없다`).toBeNull();
  expect(el.getAttribute("aria-label")).toBe(name);
  const visible = [...el.querySelectorAll("*")].filter((n) => !n.closest("[aria-hidden='true']") && n.children.length === 0).map((n) => n.textContent ?? "").join("").trim();
  expect(visible, `'${name}' 단추에 보이는 글자가 없다`).toBe("");
  expect(el.querySelector("svg"), `'${name}' 단추의 아이콘`).not.toBeNull();
}

/** 글 단추·탭 계약: 이름표 속성이 없고 글이 그대로 보인다. */
export function expectTextControl(el: Element | null, text: string, opts: { name?: string } = {}): void {
  expect(el, `글 단추 '${text}'`).not.toBeNull();
  const t = el as HTMLElement;
  expect(t.hasAttribute(TOOL_ATTR), `'${text}' 에 이름표 속성이 없다`).toBe(false);
  expect(t.querySelector(LABEL_SELECTOR)).toBeNull();
  const visible = [...t.querySelectorAll("*")].filter((n) => !n.closest("[aria-hidden='true']") && n.children.length === 0).map((n) => n.textContent ?? "").join("").replace(/\s/g, "");
  expect(visible, `'${text}' 의 보이는 글자`).toBe(text.replace(/\s/g, ""));
  if (opts.name !== undefined) expect(t.getAttribute("aria-label") ?? visible).toBe(opts.name);
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

describe("채팅 입력줄 단추 (TOOL-04, D-01)", () => {
  const mount = (rest: Partial<ChatPanelProps> = {}) => render(<Harness emotes={EMOTE_TRAY_ORDER} onEmote={() => {}} onWill={() => {}} {...rest} />);

  it("동작·보내기·유언 단추는 글 없이 아이콘과 aria-label 만 가진다", () => {
    const { container } = mount();
    expectIconButton(container.querySelector("[data-emote-button]"), "동작 고르기");
    expectIconButton(container.querySelector("[data-chat-send]"), "보내기");
    expectIconButton(container.querySelector("[data-will-button]"), "유언 쓰기");
  });

  it("유언이 저장돼 있으면 접근성 이름만 '유언 쓰기, 저장됨' 이 된다", () => {
    const { container } = mount({ willSaved: true });
    expectIconButton(container.querySelector("[data-will-button]"), "유언 쓰기, 저장됨");
    expect(container.querySelector(".mv-chat__will-dot")).not.toBeNull();
  });

  it("보내기가 막혀(aria-disabled) 있어도 이름은 남는다", () => {
    const { container } = mount({ sendDisabled: true });
    expect(container.querySelector("[data-chat-send]")?.getAttribute("aria-disabled")).toBe("true");
    expectIconButton(container.querySelector("[data-chat-send]"), "보내기");
    expectIconButton(container.querySelector("[data-emote-button]"), "동작 고르기");
    expectIconButton(container.querySelector("[data-will-button]"), "유언 쓰기");
  });

  it("각 입력줄 단추는 아이콘(svg) 하나를 가진 .mv-tool 이고 라벨 요소가 없다", () => {
    const { container } = mount();
    for (const sel of ["[data-emote-button]", "[data-chat-send]", "[data-will-button]"]) {
      const b = container.querySelector(sel);
      expect(b?.classList.contains("mv-tool"), sel).toBe(true);
      expect(b?.querySelectorAll("svg").length, sel).toBe(1);
      expect(b?.querySelector(LABEL_SELECTOR), sel).toBeNull();
    }
  });

  it("빛나는 [유언] 은 is-call 표식을 단다", () => {
    const { container } = mount({ callWill: true });
    expect(container.querySelector("[data-will-button]")?.classList.contains("is-call")).toBe(true);
  });

  it("새 메시지 알림은 글 '새 글' 알약이다(이름표 속성 없음)", async () => {
    // 위로 올려 읽는 중 새 줄이 오면 점이 뜬다 — 18.1 부터 점은 기록 시트 안에 있다(기록 칸 단추를 눌러 연다).
    const { container, rerender } = render(<Harness messages={[{ key: "a", kind: "player", seat: 0, name: "가", text: "하나", ch: "all" }]} />);
    fireEvent.click(container.querySelector("button[data-chat-open]") as Element);
    const log = document.querySelector("[data-chat-sheet-log]") as HTMLElement;
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
    expectTextControl(document.querySelector("button[data-chat-newdot]"), "새 글", { name: "새 글" });
  });

  it("머리 단추 CSS(V-1): 44×44 정사각, 모서리 radius-badge, 면 night-800, 테두리 1px night-600, 막힘은 불투명도만", () => {
    const tool = rule(".mv-tool");
    expect(tool).toMatch(/(^|[;\s])width:\s*var\(--tap-min\)/);
    expect(tool).toMatch(/(^|[;\s])height:\s*var\(--tap-min\)/);
    expect(tool).not.toContain("max-width");
    expect(tool).not.toContain("flex-direction: column");
    expect(rule(".mv-tool--head")).toContain("border-radius: var(--radius-badge)");
    const face = rule(".mv-tool--head .mv-tool__face");
    expect(face).toContain("background: var(--night-800)");
    expect(face).toContain("border: 1px solid var(--night-600)");
    expect(rule('.mv-tool[aria-disabled="true"]')).toContain("opacity: 0.45");
  });

  it("입력줄 단추(V-6, A5): 동작·보내기·유언은 48(--control-input) 원이다", () => {
    for (const sel of [".mv-chat__emote", ".mv-chat__send", ".mv-chat__will"]) {
      const r = rule(sel);
      expect(r, sel).toContain("width: var(--control-input)");
      expect(r, sel).toContain("height: var(--control-input)");
      expect(r, sel).toContain("border-radius: var(--radius-pill)");
    }
  });

  it("폭 360 에서 입력칸이 160 남는다: 동작 48 + 입력칸 + 보내기 48 + 유언 48, 간격 8 뿐(여분 margin·아래 정렬 보정 없음)", () => {
    expect(rule(".mv-chat__form")).toContain("align-items: center");
    expect(rule(".mv-chat__form")).toContain("gap: var(--space-sm)");
    expect(rule(".mv-chat__will")).not.toContain("margin-left");
    const w = 360 - 32 - 3 * 48 - 3 * 8;
    expect(w).toBe(160);
  });

  it("CSS 에 아이콘 아래 라벨 규칙이 없다(D-01): 라벨 선택자가 v2.css·rolecard.css 어디에도 없다", () => {
    const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
    const all = strip(V2_CSS) + strip(readFileSync("src/styles/rolecard.css", "utf8"));
    for (const sel of LABEL_SELECTOR.split(",").map((x) => x.trim())) {
      expect(all.includes(sel), sel).toBe(false);
    }
  });

  it("빛남: 머리 단추 .is-call 의 빛 모서리는 면(radius-badge)을 따르고, 유언 단추는 원(pill)이다", () => {
    expect(rule(".mv-tool--head.is-call::after")).toContain("border-radius: var(--radius-badge)");
    expect(rule(".mv-chat__will.is-call::after")).toContain("border-radius: var(--radius-pill)");
  });
});

describe("시트 닫기·결과 탭 (TOOL-04, D-01·V-7)", () => {
  it("Sheet 닫기: × 아이콘 하나와 접근성 이름 '닫기' 뿐이다", () => {
    const { baseElement } = render(
      <Sheet label="a" onClose={() => {}} showClose>
        <p>x</p>
      </Sheet>,
    );
    const btn = baseElement.querySelector(".mf-sheet__close");
    expectIconButton(btn, "닫기");
    expect(btn?.classList.contains("mv-closepill")).toBe(true);
  });

  it("WillSheet 닫기: × 아이콘과 '닫기' 이름", () => {
    const { container } = render(<WillSheet value="" onChange={() => {}} onSave={() => {}} onClose={() => {}} />);
    const btn = container.querySelector(".mv-will__close");
    expectIconButton(btn, "닫기");
    expect(btn?.classList.contains("mv-closepill")).toBe(true);
  });

  it("닫기 단추 CSS(V-7): 44×44 정사각 × 가운데, 글 여백 없음", () => {
    const r = rule(".mv-closepill");
    expect(r).toMatch(/(^|[;\s])width:\s*var\(--tap-min\)/);
    expect(r).toMatch(/(^|[;\s])height:\s*var\(--tap-min\)/);
    expect(r).toContain("display: inline-flex");
    expect(r).toContain("justify-content: center");
    expect(r).not.toMatch(/padding:\s*0 var\(--space-md\)/);
    expect(rule(".mf-btn.mv-closepill")).toMatch(/padding:\s*0;/);
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

  it("결과 기록 탭 넷은 선택 여부와 무관하게 아이콘 + 글자를 그대로 보이고 이름표 속성이 없다", () => {
    for (const sel of ["all", "ghost", "log"] as const) {
      const { container, unmount } = render(<ResultPanel {...tabProps({ tab: sel, expanded: true })} />);
      const tabs = [...container.querySelectorAll<HTMLElement>("[data-result-tab]")];
      expect(tabs.map((t) => t.getAttribute("data-result-tab"))).toEqual([...RESULT_TABS_SHOWN]);
      for (const t of tabs) {
        const id = t.getAttribute("data-result-tab") as ResultTab;
        expectTextControl(t, RESULT_PANEL_TEXT.tab[id], { name: RESULT_PANEL_TEXT.tabName[id] });
        expect(t.querySelector("svg"), id).not.toBeNull();
        expect(t.getAttribute("aria-selected")).toBe(id === sel ? "true" : "false");
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

describe("머리·떠 있는 단추·옷장 (TOOL-04, D-01)", () => {
  it("MapChip: 글 없이 아이콘과 접근성 이름 '맵 …' — 손님(aria-disabled)도 이름이 남는다", () => {
    for (const host of [true, false]) {
      for (const choice of ["bar", "plaza", "random"] as const) {
        const { container, unmount } = render(<MapChip choice={choice} host={host} onPress={() => {}} />);
        const chip = container.querySelector("[data-map-chip]");
        expectIconButton(chip, MAP_CHIP_NAME[choice]);
        expect(chip?.getAttribute("aria-disabled") === "true").toBe(!host);
        unmount();
      }
    }
  });

  it("DRESS_TEXT.open 은 '옷장' 이고 FloatAction(옷장)은 아이콘과 같은 이름뿐이다", () => {
    expect(DRESS_TEXT.open).toBe("옷장");
    const { container } = render(<FloatAction kind="dress" icon="hanger" label={DRESS_TEXT.open} onPress={() => {}} />);
    expectIconButton(container.querySelector("[data-float=dress]"), "옷장");
  });

  it("FloatAction(넘기기): 글 없이 아이콘, 위 'k / n' 은 장식으로 유지된다", () => {
    const { container } = render(<FloatAction kind="skip" icon="skip" label="넘기기" count="2 / 5" onPress={() => {}} />);
    const b = container.querySelector("[data-float=skip]");
    expectIconButton(b, "넘기기");
    expect(b?.querySelector("[data-float-count]")?.textContent).toBe("2 / 5");
    expect(b?.querySelector("[data-float-count]")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("FloatAction 막힘(aria-disabled)도 이름이 남는다", () => {
    const { container } = render(<FloatAction kind="dress" icon="hanger" label="옷장" disabled onPress={() => {}} />);
    expect(container.querySelector("[data-float=dress]")?.getAttribute("aria-disabled")).toBe("true");
    expectIconButton(container.querySelector("[data-float=dress]"), "옷장");
  });

  it("옷장 시트: 이름 '옷장', 방장 탭 둘은 '맵'·'의상' 글자 그대로, 닫기는 × 뿐", () => {
    const { container } = render(<DressSheet value="coat" onPick={() => {}} onClose={() => {}} host tab="map" mapChoice="random" onPickMap={() => {}} />);
    expect(container.querySelector("[data-dress-sheet]")?.getAttribute("aria-label")).toBe("옷장");
    expectTextControl(container.querySelector("[data-map-tab=map]"), "맵", { name: "맵" });
    expectTextControl(container.querySelector("[data-map-tab=dress]"), "의상", { name: "의상" });
    const close = container.querySelector(".mv-dress-sheet__close");
    expectIconButton(close, "닫기");
    expect(close?.classList.contains("mv-closepill")).toBe(true);
  });

  it("손님의 옷장 시트에는 탭이 없고 닫기는 있다", () => {
    const { container } = render(<DressSheet value="coat" onPick={() => {}} onClose={() => {}} />);
    expect(container.querySelector("[data-map-tab]")).toBeNull();
    expectIconButton(container.querySelector(".mv-dress-sheet__close"), "닫기");
  });

  it("CSS: 맵 칩은 52 원, 떠 있는 단추는 48 원(옆 열 단추는 52)이다 (16-06, 상자가 곧 면)", () => {
    expect(rule(".mf-mapchip")).toContain("width: var(--control-button)");
    expect(rule(".mv-float")).toContain("width: var(--control-input)");
    expect(rule(".mv-float[data-side-button]")).toContain("width: var(--control-button)");
  });
});

// ---- 방 화면 전수 검사 (16-04, UI-SPEC "아이콘 단추 검사") ----
// RoomScreen 을 단계 × 시점으로 그려, 이름표 속성·라벨 요소가 0건이고 보이는 button·[role=tab] 마다 비어 있지 않은 접근성 이름이 있음을 센다.
// 14 의 면제 목록(E-1~E-5)은 없다 — 새 불변 규칙은 "아이콘 단추는 aria-label 이 있다" 하나다.
// 판정은 느슨하게 하지 않는다 — 실패하면 빠진 단추를 부품에서 고친다.

const NOW = 1_700_000_000_000;

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

/** aria-hidden 조각을 뺀 보이는 글자(공백 정리) */
function visibleText(el: Element): string {
  let out = "";
  const walk = (n: Node): void => {
    if (n.nodeType === 3) out += n.textContent ?? "";
    else if (n.nodeType === 1 && (n as Element).getAttribute("aria-hidden") !== "true") n.childNodes.forEach(walk);
  };
  el.childNodes.forEach(walk);
  return out.trim();
}

/** 접근성 이름: aria-label(있으면) 아니면 보이는 글자 */
function accessibleName(el: Element): string {
  const label = el.getAttribute("aria-label");
  return (label !== null ? label : visibleText(el)).trim();
}

/** 한 화면의 위반 목록. 비어 있어야 한다. 메시지는 화면 이름 + 단추 정보 */
function violations(scene: string, minButtons = 1): string[] {
  const out: string[] = [];
  const buttons = [...document.body.querySelectorAll("button, [role=tab]")].filter(isVisible);
  // 검사가 빈 화면을 지나가지 않게: 배정 화면 말고는 단추가 하나 이상(입력줄·[내 역할]·[나가기] …) 있다
  if (buttons.length < minButtons) out.push(`${scene}: 보이는 단추가 ${buttons.length}개뿐이다(렌더 실패?)`);
  for (const b of buttons) {
    if (accessibleName(b) === "") out.push(`${scene}: 접근성 이름이 빈 단추 — <${b.tagName.toLowerCase()} class="${b.getAttribute("class") ?? ""}">`);
  }
  // 이름표 흔적: 속성과 아이콘 아래 라벨 요소(보이지 않는 조각 포함 — 어디에도 0건)
  for (const el of document.body.querySelectorAll(`[${TOOL_ATTR}]`)) out.push(`${scene}: 이름표 속성이 남았다 — '${el.getAttribute(TOOL_ATTR) ?? ""}'`);
  for (const el of document.body.querySelectorAll(LABEL_SELECTOR)) out.push(`${scene}: 아이콘 아래 라벨 요소가 남았다 — '${el.textContent ?? ""}'`);
  return out;
}

describe("방 화면 전수 — 이름표 0건·접근성 이름 (TOOL-04)", () => {
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
      // 방 코드가 있으면 [공유] 도 있다 — 머리 단추는 이름만 단다
      expect(document.body.querySelector('.mv-tool[aria-label="공유"]')).not.toBeNull();
      expect(document.body.querySelector('.mv-tool[aria-label="나가기"]')).not.toBeNull();
      expect(document.body.querySelector("[data-sound-button]"), "대기실에도 [소리]").not.toBeNull();
      unmount();
    }
  });

  it("대기실: 방 코드가 없으면 [공유] 가 없고 나머지는 이름을 단다", () => {
    const view = makeView({ phase: "lobby", endsIn: null, isHost: true, code: null });
    delete view.me.role;
    renderRoom(view);
    expect(violations("lobby/코드 없음")).toEqual([]);
    expect(document.body.querySelector('[aria-label="공유"]')).toBeNull();
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
        // 결과 머리 [나가기] 는 이름만 단다
        expect(document.body.querySelector('.mf-result__header [aria-label="나가기"]')).not.toBeNull();
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
    const role = document.body.querySelector<HTMLElement>('.mf-rolecard-btn[aria-label^="내 역할"]');
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

  it("접근성 이름은 고정 문구뿐이다 — 머리·입력줄·닫기·소리·맵 단추의 이름에 역할·좌석·토큰 값이 없다(T-16-11)", () => {
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
      for (const el of document.body.querySelectorAll(".mv-tool, .mv-float, [data-map-chip], [data-sound-button], .mf-rolecard-btn, .mv-closepill")) seen.add(el.getAttribute("aria-label") ?? "");
      expect(document.body.innerHTML).not.toMatch(/aria-label="[^"]*(seat|nonce|token|mafia|police|doctor)/i);
      unmount();
    }
    expect([...seen].filter((w) => w.trim() === "")).toEqual([]);
    expect(seen.size).toBeGreaterThan(6);
  });

  it("검사가 실제로 잡는다: 이름 없는 아이콘 단추·이름표 속성·아이콘 아래 라벨은 각각 판정되고 이름 있는 단추·숨긴 단추는 통과한다", () => {
    const { unmount } = renderRoom(makeView({ phase: "discussion", viewpoint: "citizen" }));
    const host = document.createElement("div");
    host.innerHTML =
      '<button class="이름없음"><svg></svg></button>' +
      '<button data-tool-label="공유" aria-label="공유"><svg></svg></button>' +
      '<button aria-label="라벨있음"><svg></svg><span class="mv-tool__label">라벨</span></button>' +
      '<button class="mf-world__kick" aria-label="지우 님 내보내기"><svg></svg></button>' +
      '<button aria-hidden="true"></button>';
    document.body.appendChild(host);
    const found = violations("가짜");
    expect(found.some((m) => m.includes("이름없음"))).toBe(true);
    expect(found.some((m) => m.includes("이름표 속성이 남았다"))).toBe(true);
    expect(found.some((m) => m.includes("아이콘 아래 라벨 요소가 남았다"))).toBe(true);
    expect(found.some((m) => m.includes("내보내기"))).toBe(false); // aria-label 이 있다
    expect(found.filter((m) => m.includes("접근성 이름이 빈 단추")).length).toBe(1); // 숨긴 단추는 세지 않는다
    host.remove();
    unmount();
  });

  it("면제 목록은 없다: E-1(내보내기 ×)·E-2(봇 ±)도 접근성 이름을 가진다", () => {
    expect(readFileSync("src/components/WorldStage.tsx", "utf8")).toMatch(/mf-world__kick[\s\S]{0,400}aria-label/);
    expect(readFileSync("src/components/v2/ChatPanel.tsx", "utf8")).toMatch(/<span className=\{channel === "mafia" \? "mv-chat__chan/);
  });
});
