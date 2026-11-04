// 유언 편지 화면 시험 (09.1-11, 결정 0063-3·0063-4, UI-SPEC C-1·C-2·C-5, L16). RoomScreen 을 거쳐 밤 → 아침 view 와 라이브 유언 카드를 실제 ChatStore 로 먹인다.
// WorldStage 는 받은 props 만 쥐는 가짜(캔버스는 worldStage 시험 몫). 가짜 타이머로 시간표를 읽는다.
import { act, cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { LETTER_END_AT_MS, LETTER_FOLD_AT_MS, SEAL_GLYPH, writeSchedule } from "../../src/game/willLetter";
import type { RoomConnection } from "../../src/net/useRoomConnection";

const connectionMock = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../../src/net/useRoomConnection", () => ({ useRoomConnection: () => connectionMock.current }));

vi.mock("../../src/components/WorldStage", async () => {
  const { createElement } = await import("react");
  return { WorldStage: () => createElement("div", { "data-world-stage-fake": "" }) };
});

const { RoomScreen } = await import("../../src/screens/RoomScreen");

const NOW = 1_700_000_000_000;
const NAMES = ["민수", "영희", "서준", "지아", "도윤", "하은"];
const WILL = "현우 님 말투가 이상해요";

function viewOf(phase: PhaseId, o: { dead?: number[]; eliminated?: number; saved?: boolean } = {}): RoomView {
  const players: PublicPlayer[] = NAMES.map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0, ...(o.dead?.includes(seat) ? { alive: false } : {}) }));
  return {
    code: "0042",
    phase,
    phaseEndsAt: NOW + 30_000,
    phaseDurationMs: 30_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players,
    me: { seat: 0, isHost: true, role: "citizen", chat: "all" },
    day: { n: 1, roles: [], ...(phase === "morning" ? { morning: o.saved ? { saved: true } : o.eliminated !== undefined ? { eliminated: o.eliminated } : {} } : {}) },
  } as unknown as RoomView;
}
const night = () => viewOf("night");
const killed = () => viewOf("morning", { dead: [3], eliminated: 3 });

function setup(opts: { reduce?: boolean } = {}) {
  if (opts.reduce) {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  }
  const listeners: Array<(e: never, meta: { epoch: number }) => void> = [];
  const onEvent = vi.fn((l: (typeof listeners)[number]) => {
    listeners.push(l);
    return () => {};
  });
  const conn = (view: RoomView): RoomConnection => ({
    status: "open",
    banner: "hidden",
    view,
    offset: 0,
    epoch: 1,
    removedReason: null,
    canSend: true,
    send: vi.fn(),
    onEvent: onEvent as unknown as RoomConnection["onEvent"],
    reconnect: vi.fn(),
    retry: vi.fn(),
  });
  connectionMock.current = conn(night());
  const ui = () => <RoomScreen code="0042" token={"t".repeat(43)} onExit={() => {}} />;
  const r = render(ui());
  const show = (v: RoomView) => {
    connectionMock.current = conn(v);
    act(() => r.rerender(ui()));
  };
  const emit = (e: unknown) => act(() => listeners.forEach((l) => l(e as never, { epoch: 1 })));
  const card = (k: "will" | "note", seat: number, seq: number, text: string) => emit({ t: "chat", ch: "all", seat, seq, text, at: NOW + seq, k });
  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
  return { ...r, show, emit, card, advance };
}

const letterOf = (c: ParentNode) => c.querySelector<HTMLElement>("[data-will-letter]");
const cardsOf = (c: ParentNode, kind: "will" | "note") => [...c.querySelectorAll<HTMLElement>(`[data-card="${kind}"]`)];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("유언 편지 — 암살 아침 (0063-3, C-1·C-2)", () => {
  it("아침 진입 + 0.4초에 편지가 하나 뜬다: 루트 role=status, 보이지 않는 한 줄 읽기, 머리글·글·인장·안내는 aria-hidden", () => {
    const s = setup();
    s.show(killed());
    s.card("will", 3, 1, WILL);
    s.advance(399);
    expect(letterOf(s.container)).toBeNull();
    s.advance(1);
    expect(s.container.querySelectorAll("[data-will-letter]").length).toBe(1);
    const letter = letterOf(s.container)!;
    expect(letter.getAttribute("role")).toBe("status");
    const reads = [...letter.querySelectorAll("[data-will-read]")];
    expect(reads.length).toBe(1);
    expect(reads[0]!.textContent).toBe(`지아 님의 유언: ${WILL}`);
    expect(reads[0]!.closest("[aria-hidden='true']")).toBeNull();
    const head = letter.querySelector("[data-will-head]")!;
    expect(head.textContent).toBe("지아 님의 유언");
    expect(head.closest("[aria-hidden='true']")).not.toBeNull();
    const lines = [...letter.querySelectorAll("[data-will-line]")];
    expect(lines.map((l) => l.textContent).join(" ")).toBe(WILL);
    for (const l of lines) expect(l.closest("[aria-hidden='true']")).not.toBeNull();
    expect(letter.querySelector("[data-will-guide]")?.textContent).toBe("채팅에도 남아요");
    expect(letter.querySelector("[data-will-guide]")?.closest("[aria-hidden='true']")).not.toBeNull();
    const seal = letter.querySelector("[data-will-seal]")!;
    expect(seal.tagName.toLowerCase()).toBe("svg");
    expect(seal.getAttribute("aria-hidden")).toBe("true");
    expect([...seal.querySelectorAll("text")].map((t) => t.textContent)).toEqual([SEAL_GLYPH, SEAL_GLYPH]);
  });

  it("편지·인장·막대는 입력을 가로채지 않는다: tabindex 없음·초점 받는 요소 없음, CSS 루트 pointer-events none", () => {
    const s = setup();
    s.show(killed());
    s.card("will", 3, 1, WILL);
    s.advance(400);
    const letter = letterOf(s.container)!;
    expect(letter.querySelectorAll("[tabindex], button, a, input, textarea, select").length).toBe(0);
    expect(letter.hasAttribute("tabindex")).toBe(false);
    const css = readFileSync("src/styles/letter.css", "utf8");
    const root = /\.mf-letter\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(root).toMatch(/pointer-events:\s*none/);
    expect(root).toMatch(/z-index:\s*calc\(var\(--z-overlay\)\s*\+\s*1\)/);
  });

  it("줄 쓰기 지연 = writeSchedule 의 at, steps = 그 줄 글자 수, 인장 지연 = sealAt (모두 T0 기준)", () => {
    const s = setup();
    s.show(killed());
    s.card("will", 3, 1, WILL);
    s.advance(400);
    const sched = writeSchedule([WILL])!;
    const line = letterOf(s.container)!.querySelector<HTMLElement>("[data-will-line]")!;
    expect(line.getAttribute("data-write-at")).toBe(String(sched.lines[0]!.at));
    expect(line.getAttribute("data-write-steps")).toBe(String(sched.lines[0]!.steps));
    expect(line.style.getPropertyValue("--lw-delay")).toBe(`${sched.lines[0]!.at}ms`);
    expect(line.style.getPropertyValue("--lw-steps")).toBe(String(sched.lines[0]!.steps));
    const seal = letterOf(s.container)!.querySelector<SVGElement>("[data-will-seal]")!;
    expect(seal.getAttribute("data-seal-at")).toBe(String(sched.sealAt));
    expect((seal as unknown as HTMLElement).style.getPropertyValue("--lw-delay")).toBe(`${sched.sealAt}ms`);
  });

  it("카드는 편지가 접힐 때(아침 + 0.4 + 5.0초) 유언 → 쪽지 순서로 채팅에 나타나고 5.42초에 편지가 사라진다", () => {
    const s = setup();
    s.show(killed());
    s.card("will", 3, 1, WILL);
    s.card("note", 3, 2, "쪽지 글");
    s.advance(400 + LETTER_FOLD_AT_MS - 1);
    expect(letterOf(s.container)).not.toBeNull();
    expect(cardsOf(s.container, "will").length).toBe(0);
    expect(cardsOf(s.container, "note").length).toBe(0);
    s.advance(1);
    const will = cardsOf(s.container, "will");
    const note = cardsOf(s.container, "note");
    expect(will.length).toBe(1);
    expect(note.length).toBe(1);
    expect(will[0]!.compareDocumentPosition(note[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(will[0]!.textContent).toContain(WILL);
    s.advance(LETTER_END_AT_MS - LETTER_FOLD_AT_MS - 1);
    expect(letterOf(s.container)).not.toBeNull();
    s.advance(1);
    expect(letterOf(s.container)).toBeNull();
  });

  it("유언 카드가 없는 아침·구출 아침·처음 받은 아침 view 에는 편지가 없다", () => {
    const none = setup();
    none.show(killed());
    none.advance(7000);
    expect(letterOf(none.container)).toBeNull();
    none.unmount();

    const saved = setup();
    saved.show(viewOf("morning", { saved: true }));
    saved.advance(7000);
    expect(letterOf(saved.container)).toBeNull();
    saved.unmount();

    // 재접속·새로 고침: 밤 view 를 거치지 않은 첫 view 가 아침이다
    connectionMock.current = {
      status: "open",
      banner: "hidden",
      view: killed(),
      offset: 0,
      epoch: 1,
      removedReason: null,
      canSend: true,
      send: vi.fn(),
      onEvent: vi.fn(() => () => {}),
      reconnect: vi.fn(),
      retry: vi.fn(),
    } satisfies RoomConnection;
    const first = render(<RoomScreen code="0042" token={"t".repeat(43)} onExit={() => {}} />);
    act(() => void vi.advanceTimersByTime(7000));
    expect(letterOf(first.container)).toBeNull();
  });

  it("본문과 이름은 텍스트로만 그려진다: 스크립트·이미지 태그가 든 유언도 글자로 보인다", () => {
    const s = setup();
    s.show(killed());
    const evil = '<img src=x onerror="window.__pwn=1"><b>굵게</b>';
    s.card("will", 3, 1, evil);
    s.advance(400);
    const letter = letterOf(s.container)!;
    expect(letter.querySelector("img, b, script")).toBeNull();
    expect(letter.querySelector("[data-will-read]")!.textContent).toBe(`지아 님의 유언: ${evil}`);
    expect([...letter.querySelectorAll("[data-will-line]")].map((l) => l.textContent).join("")).toContain("<img");
    expect((window as unknown as { __pwn?: number }).__pwn).toBeUndefined();
  });

  it("편지 소스에 innerHTML 이 없고 지역 변수는 .mf-letter 안에서만 선언된다", () => {
    const src = readFileSync("src/components/v2/WillLetter.tsx", "utf8");
    expect(/innerHTML|dangerouslySetInnerHTML/.test(src)).toBe(false);
    const css = readFileSync("src/styles/letter.css", "utf8");
    for (const [name, value] of [
      ["--letter-paper", "#f3efe4"],
      ["--letter-ink", "#1c2a4d"],
      ["--letter-label", "#6a7388"],
      ["--letter-wax-1", "#e0485c"],
      ["--letter-wax-2", "#a3132a"],
      ["--letter-wax-3", "#650a18"],
      ["--letter-wax-edge", "#7a0c1f"],
    ] as const) {
      expect(css, name).toContain(`${name}: ${value}`);
    }
    expect(css).toContain("rgba(70, 90, 130, 0.22)");
    expect(css).toMatch(/--letter-wax-hi/);
    // :root 나 전역 선택자에 편지 변수를 선언하지 않는다
    expect(/:root\s*\{[^}]*--letter-/.test(css)).toBe(false);
    expect(css).toContain("cubic-bezier(0.2, 0.8, 0.2, 1)");
    expect(css).toMatch(/steps\(var\(--lw-steps\)\)/);
  });
});
