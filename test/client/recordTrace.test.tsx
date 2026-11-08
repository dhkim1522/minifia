import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { RecordCard } from "../../src/components/v2/RecordCard";
import { TraceCard } from "../../src/components/v2/TraceCard";
import { ToolButton } from "../../src/components/ToolButton";
import { V2Icon } from "../../src/components/v2/V2Icon";
import { TRACE_NOTE, TRACE_TEXT } from "../../src/game/traceText";
import { faceSrc, seatColorVar } from "../../src/net/assets";
import { TRACE_PIECE_IDS, type MorningView, type PhaseId, type PlaceId, type PublicPlayer, type RecordLine, type RoomView } from "../../shared/protocol";
import type { RoleId } from "../../shared/game/roles";
import { MORNING_TRACE_MS } from "../../shared/game/phases";
import type { RecordRow } from "../../src/game/recordView";
import type { RoomConnection } from "../../src/net/useRoomConnection";

// 방 화면(RoomScreen) 통합용 가짜: 연결 훅·3D 무대·소리 신호(callGlow.test 와 같은 틀).
const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => connectionMock.current,
}));
vi.mock("../../src/components/WorldStage", async () => {
  const { createElement } = await import("react");
  return { WorldStage: () => createElement("div", { "data-world-stage-fake": "" }) };
});
const signals = vi.hoisted(() => ({ emit: vi.fn() }));
vi.mock("../../src/audio/signals", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../../src/audio/signals")>();
  return {
    ...orig,
    emitSignal: (s: unknown) => {
      signals.emit(s);
      (orig.emitSignal as (x: unknown) => void)(s);
    },
  };
});
const { RoomScreen } = await import("../../src/screens/RoomScreen");

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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


// ── 방 화면 통합 (Task 3) ─────────────────────────────────────────────

const NOW = 1_700_000_000_000;
const NAMES = ["민수", "영희", "서준", "지아"];
const REC: RecordLine[] = [
  { seat: 1, place: "glass" },
  { seat: 2, place: "piano" },
];

interface MapOpts {
  phase: PhaseId;
  role?: RoleId;
  record?: RecordLine[];
  dead?: number[];
  morning?: MorningView;
  endsInMs?: number;
}

function mapView(o: MapOpts): RoomView {
  const players: PublicPlayer[] = NAMES.map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0, ...(o.dead?.includes(seat) ? { alive: false } : {}) }));
  return {
    code: "0042",
    phase: o.phase,
    phaseEndsAt: NOW + (o.endsInMs ?? 60_000),
    phaseDurationMs: 90_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: {
      seat: 0,
      isHost: true,
      chat: o.dead?.includes(0) ? "ghost" : "all",
      role: o.role ?? "citizen",
      ...(o.record !== undefined ? { record: o.record } : {}),
    },
    // 서버는 아침~처형에 같은 값을 day.evidence 로도 싣는다(16-01 P-1) — 시험 뷰도 morning 에서 파생한다.
    day: {
      n: 1,
      roles: [],
      ...(o.morning !== undefined ? { morning: o.morning } : {}),
      ...(o.morning?.trace !== undefined || o.morning?.seen !== undefined
        ? { evidence: { ...(o.morning.trace !== undefined ? { trace: o.morning.trace } : {}), ...(o.morning.seen !== undefined ? { seen: o.morning.seen } : {}) } }
        : {}),
    },
  } as RoomView;
}

function conn(view: RoomView, over: Partial<RoomConnection> = {}): RoomConnection {
  return { status: "open", banner: "hidden", view, offset: 0, epoch: 1, removedReason: null, canSend: true, send: vi.fn(), onEvent: vi.fn(() => () => {}), reconnect: vi.fn(), retry: vi.fn(), ...over };
}

const mount = (view: RoomView) => {
  connectionMock.current = conn(view);
  const ui = () => <RoomScreen code="0042" token={"t".repeat(43)} onExit={() => {}} />;
  const r = render(ui());
  return {
    ...r,
    show: (v: RoomView) => {
      const prev = connectionMock.current as RoomConnection;
      connectionMock.current = conn(v, { send: prev.send, onEvent: prev.onEvent, epoch: prev.epoch });
      r.rerender(ui());
    },
  };
};

const WITNESS = "토론 시간입니다. 기록 단추로 본 것을 확인해 주세요.";
const DISCUSS = "토론 시간입니다. 의심 가는 사람을 이야기해 주세요.";
const band = (c: ParentNode): string => c.querySelector("[data-host-line]")?.textContent ?? "";
const recordButton = (c: ParentNode): HTMLButtonElement | null => c.querySelector("button[data-tool-label='기록']");
const calls = (c: ParentNode): HTMLElement[] => [...c.querySelectorAll<HTMLElement>("[data-call]")];

describe("토론 — [기록] 단추와 카드 (ERRAND-05, D-04)", () => {
  it.each(["citizen", "mafia"] as RoleId[])("%s: 기록이 있으면 [기록] 하나(접근성 이름 '기록'), 카드는 접힘, 띠 witness, [data-call] 은 [기록] 하나", (role) => {
    const { container } = mount(mapView({ phase: "discussion", role, record: REC }));
    const btn = recordButton(container);
    expect(btn).not.toBeNull();
    expect(container.querySelectorAll("button[data-tool-label='기록']")).toHaveLength(1);
    expect(btn?.getAttribute("aria-label")).toBe("기록");
    expect(btn?.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("[data-record-card]")).toBeNull();
    expect(band(container)).toBe(WITNESS);
    expect(calls(container)).toEqual([btn]);
  });

  it("[기록] 은 [내 역할] 왼쪽(DOM 에서 앞)에 있다", () => {
    const { container } = mount(mapView({ phase: "discussion", record: REC }));
    const header = container.querySelector(".mf-game__header") as HTMLElement;
    const order = [...header.querySelectorAll("button")].map((b) => b.getAttribute("data-tool-label"));
    expect(order.indexOf("기록")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("기록")).toBeLessThan(order.indexOf("내 역할"));
  });

  it("누르면 카드가 열리고(줄 수 표식) aria-expanded=true·빛 꺼짐·띠 discussion.act·입력칸이 빛난다", () => {
    const { container } = mount(mapView({ phase: "discussion", record: REC }));
    fireEvent.click(recordButton(container)!);
    const card = container.querySelector("[data-record-card]");
    expect(card?.getAttribute("data-record-rows")).toBe("2");
    expect(container.querySelectorAll("li[data-record-row]")).toHaveLength(2);
    expect(container.querySelector(".mv-record__name")?.textContent).toBe("영희");
    expect(recordButton(container)?.getAttribute("aria-expanded")).toBe("true");
    expect(band(container)).toBe(DISCUSS);
    const lit = calls(container);
    expect(lit).toHaveLength(1);
    expect(lit[0]?.matches("input[data-chat-input]")).toBe(true);
  });

  it("[닫기] 로 닫히고 다시 열어도 [기록] 빛은 되살아나지 않는다", () => {
    const { container } = mount(mapView({ phase: "discussion", record: REC }));
    fireEvent.click(recordButton(container)!);
    fireEvent.click(container.querySelector("[data-record-card] button[data-tool-label='닫기']")!);
    expect(container.querySelector("[data-record-card]")).toBeNull();
    expect(recordButton(container)?.hasAttribute("data-call")).toBe(false);
    fireEvent.click(recordButton(container)!);
    expect(container.querySelector("[data-record-card]")).not.toBeNull();
    fireEvent.click(recordButton(container)!);
    expect(container.querySelector("[data-record-card]")).toBeNull();
    expect(recordButton(container)?.hasAttribute("data-call")).toBe(false);
    expect(band(container)).toBe(DISCUSS);
  });

  it("카드가 열린 채 채팅 입력칸에 포커스가 가면 접힌다", () => {
    const { container } = mount(mapView({ phase: "discussion", record: REC }));
    fireEvent.click(recordButton(container)!);
    const input = container.querySelector("input[data-chat-input]") as HTMLInputElement;
    act(() => input.focus());
    expect(container.querySelector("[data-record-card]")).toBeNull();
  });

  it("토론을 벗어나면(투표) 카드·[기록] 이 DOM 에 없다. 다음 날 토론에서는 다시 처음(접힘·빛)이다", () => {
    const { container, show } = mount(mapView({ phase: "discussion", record: REC }));
    fireEvent.click(recordButton(container)!);
    show(mapView({ phase: "nomination", record: REC }));
    expect(recordButton(container)).toBeNull();
    expect(container.querySelector("[data-record-card]")).toBeNull();
  });

  it("기록 없는 사람(못 마침)·유령·errand: [기록]·카드 0개", () => {
    const a = mount(mapView({ phase: "discussion" }));
    expect(recordButton(a.container)).toBeNull();
    expect(a.container.querySelector("[data-record-card]")).toBeNull();
    expect(band(a.container)).toBe(DISCUSS);
    cleanup();
    const b = mount(mapView({ phase: "discussion", dead: [0], record: REC }));
    expect(recordButton(b.container)).toBeNull();
    expect(b.container.querySelector("[data-record-card]")).toBeNull();
    cleanup();
    const c = mount(mapView({ phase: "errand", record: REC }));
    expect(recordButton(c.container)).toBeNull();
  });

  it("기록 줄이 0개여도 단추·카드가 있고 카드에 '0'", () => {
    const { container } = mount(mapView({ phase: "discussion", record: [] }));
    expect(recordButton(container)).not.toBeNull();
    fireEvent.click(recordButton(container)!);
    expect(container.querySelector("[data-record-card]")?.getAttribute("data-record-rows")).toBe("0");
    expect(container.querySelector(".mv-record__count")?.textContent).toBe("0");
    expect(container.querySelectorAll("li[data-record-row]")).toHaveLength(0);
  });

  it("카드 영역: 아래 = 입력줄 윗변 − 8 (--mf-record-bottom = 루트 높이 − 입력줄 윗변 + 8), 카드는 입력줄을 가리지 않는다", () => {
    const spy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const rect = (top: number, h: number): DOMRect => ({ x: 0, y: top, top, bottom: top + h, left: 0, right: 360, width: 360, height: h, toJSON: () => ({}) }) as DOMRect;
      if (this.classList.contains("mv-chat__form")) return rect(416, 44);
      if (this.classList.contains("mf-game")) return rect(0, 560);
      return rect(0, 0);
    });
    try {
      const { container } = mount(mapView({ phase: "discussion", record: REC }));
      fireEvent.click(recordButton(container)!);
      const root = container.querySelector("main.mf-game") as HTMLElement;
      const bottom = parseFloat(root.style.getPropertyValue("--mf-record-bottom"));
      expect(bottom).toBe(560 - 416 + 8);
      // 카드 아랫변 = 루트 높이 − bottom = 408 = 입력줄 윗변(416) − 8 → 교차 0
      expect(560 - bottom).toBeLessThanOrEqual(416 - 8);
    } finally {
      spy.mockRestore();
    }
  });

  it("역할만 바꾼 토론 DOM 의 data-* 이름 집합이 같다", () => {
    const names = (role: RoleId): string[] => {
      const { container } = mount(mapView({ phase: "discussion", role, record: REC }));
      fireEvent.click(recordButton(container)!);
      const set = new Set<string>();
      for (const el of container.querySelectorAll("*")) for (const n of el.getAttributeNames()) if (n.startsWith("data-")) set.add(n);
      cleanup();
      return [...set].sort();
    };
    const base = names("citizen");
    for (const role of ["mafia", "police", "doctor"] as RoleId[]) expect(names(role)).toEqual(base);
  });
});

describe("아침 — 흔적 카드 (TRACE-02·03, D-06)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    signals.emit.mockClear();
  });

  const MORNING: MorningView = { eliminated: 2, trace: "pencil" };
  const card = (c: ParentNode): HTMLElement | null => c.querySelector("[data-trace-card]");
  const MORNING_LINE = "아침이 밝았습니다. 서준 님이 당했습니다.";
  const TRACE_LINE = "현장에 흔적이 남았습니다.";

  it("구간 전(마감 5초 전): 카드 0개·띠 morning, 2초 뒤 카드 1개·띠 trace, 소리 신호는 구간 전에 한 번(delayMs 2000)뿐", () => {
    const { container } = mount(mapView({ phase: "morning", morning: MORNING, endsInMs: 5000 }));
    expect(card(container)).toBeNull();
    expect(band(container)).toBe(MORNING_LINE);
    const cards = signals.emit.mock.calls.map((c) => c[0] as { kind: string; delayMs?: number }).filter((s) => s.kind === "card");
    expect(cards).toEqual([{ kind: "card", delayMs: 5000 - MORNING_TRACE_MS }]);
    act(() => void vi.advanceTimersByTime(2000));
    expect(card(container)).not.toBeNull();
    expect(card(container)?.querySelector(".mv-trace__name")?.textContent).toBe("노란 연필 조각");
    expect(card(container)?.querySelector(".mv-trace__note")?.textContent).toBe("누구의 것인지는 모릅니다");
    expect(band(container)).toBe(TRACE_LINE);
    act(() => void vi.advanceTimersByTime(2500));
    expect(signals.emit.mock.calls.map((c) => (c[0] as { kind: string }).kind).filter((k) => k === "card")).toHaveLength(1);
    expect(card(container)).not.toBeNull();
    expect(band(container)).toBe(TRACE_LINE);
  });

  it("증거 카드 2행(마지막 목격): 목격자가 있으면 count 1·이름·장소 그림, 없으면 count 0 과 '0'", () => {
    const seen = mount(mapView({ phase: "morning", morning: { ...MORNING, seen: { seat: 3, place: "glass" } }, endsInMs: 1500 }));
    const row = card(seen.container)?.querySelector("[data-lastseen-row]");
    expect(row?.getAttribute("data-lastseen-count")).toBe("1");
    expect(row?.querySelector(".mv-evidence__victim")?.textContent).toBe(NAMES[2]);
    expect(row?.querySelector(".mv-evidence__witness")?.textContent).toBe(NAMES[3]);
    cleanup();
    const none = mount(mapView({ phase: "morning", morning: MORNING, endsInMs: 1500 }));
    const zero = card(none.container)?.querySelector("[data-lastseen-row]");
    expect(zero?.getAttribute("data-lastseen-count")).toBe("0");
    expect(zero?.querySelector(".mv-evidence__zero")?.textContent).toBe("0");
  });

  it("이미 구간 안에서 마운트(재접속·새로 고침)하면 카드는 바로 있고 신호는 0", () => {
    const { container } = mount(mapView({ phase: "morning", morning: MORNING, endsInMs: 2000 }));
    expect(card(container)).not.toBeNull();
    expect(band(container)).toBe(TRACE_LINE);
    expect(signals.emit.mock.calls.filter((c) => (c[0] as { kind: string }).kind === "card")).toHaveLength(0);
    expect(container.querySelector("[data-announce]")).toBeNull();
  });

  it("흔적 없는 아침(피해자 없음·구출)은 시계가 어디든 카드 0개·띠 morning", () => {
    for (const morning of [{} as MorningView, { saved: true } as MorningView, { eliminated: 2 } as MorningView]) {
      const { container } = mount(mapView({ phase: "morning", morning, endsInMs: 1500 }));
      expect(card(container)).toBeNull();
      expect(band(container).startsWith("아침이 밝았습니다.")).toBe(true);
      cleanup();
    }
    expect(signals.emit.mock.calls.filter((c) => (c[0] as { kind: string }).kind === "card")).toHaveLength(0);
  });

  it("마피아·시민·유령이 같은 카드(같은 HTML)를 받는다", () => {
    const html = (o: Partial<MapOpts>): string => {
      const { container } = mount(mapView({ phase: "morning", morning: MORNING, endsInMs: 1500, ...o }));
      const out = card(container)?.outerHTML ?? "";
      cleanup();
      return out;
    };
    const base = html({ role: "citizen" });
    expect(base).not.toBe("");
    expect(html({ role: "mafia" })).toBe(base);
    expect(html({ role: "police" })).toBe(base);
    expect(html({ role: "citizen", dead: [0] })).toBe(base);
  });

  it("카드는 누를 것이 아니다: 빛·단추 없음(흔적 카드 안 [data-call]·button 0)", () => {
    const { container } = mount(mapView({ phase: "morning", morning: MORNING, endsInMs: 1500 }));
    expect(card(container)?.querySelectorAll("button, [data-call]")).toHaveLength(0);
    expect(calls(container).filter((e) => e.closest("[data-trace-card]"))).toHaveLength(0);
  });

  it("아침이 끝나 단계가 바뀌면 카드가 없다", () => {
    const { container, show } = mount(mapView({ phase: "morning", morning: MORNING, endsInMs: 1500 }));
    show(mapView({ phase: "dayAnnounce" }));
    expect(card(container)).toBeNull();
  });
});
