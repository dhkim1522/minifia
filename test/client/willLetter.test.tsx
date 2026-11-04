// 유언 편지 화면 시험 (09.1-11, 결정 0063-3·0063-4, UI-SPEC C-1·C-2·C-5, L16). RoomScreen 을 거쳐 밤 → 아침 view 와 라이브 유언 카드를 실제 ChatStore 로 먹인다.
// WorldStage 는 받은 props 만 쥐는 가짜(캔버스는 worldStage 시험 몫). 가짜 타이머로 시간표를 읽는다.
import { act, cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { WillLetter, blockTop } from "../../src/components/v2/WillLetter";
import { ResultAnnounce } from "../../src/components/ResultAnnounce";
import { LETTER_END_AT_MS, LETTER_FOLD_AT_MS, SEAL_GLYPH, writeSchedule } from "../../src/game/willLetter";
import type { WillLetter as WillLetterState } from "../../src/net/useWillLetter";
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
      ["--letter-label", "#5f687b"],
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

// ---- Task 2: 줄 나누기 측정·글 3단·글꼴 1초 대기·모션 줄이기·시계 기준 수명·알림 위로 (C-2·C-3·C-5) ----
const T = 1_000_000;
const letterOf2 = (over: Partial<WillLetterState> = {}): WillLetterState => ({
  seat: 3,
  name: "지아",
  text: WILL,
  t0: T + 400,
  announce: { text: "지아 님이 암살당했습니다", icon: "target" },
  ...over,
});
/** 단계별 줄 수를 정해 주는 가짜 측정: 글자를 그 수만큼의 줄로 나눈다 */
const linesBy = (counts: { 46: number; 36: number; 28: number }) => (text: string, tier: { font: number; line: number }): string[] => {
  const n = counts[tier.font as 46 | 36 | 28];
  return Array.from({ length: n }, (_, i) => `${text}-${i + 1}`);
};
const pv = (el: Element | null, name: string): string => (el as HTMLElement).style.getPropertyValue(name);
const paperOf = (c: ParentNode) => c.querySelector<HTMLElement>(".mf-letter__paper")!;
const lineEls = (c: ParentNode) => [...c.querySelectorAll<HTMLElement>("[data-will-line]")];

function fontsFake(load: (font: string, text: string) => Promise<unknown[]>) {
  Object.defineProperty(document, "fonts", { value: { load: vi.fn(load) }, configurable: true });
}
function visibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  act(() => void document.dispatchEvent(new Event("visibilitychange")));
}
const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const flush = () => act(async () => void (await Promise.resolve()));

describe("편지 글 크기 3단·편지지 높이 (C-3)", () => {
  beforeEach(() => {
    Object.defineProperty(document, "fonts", { value: undefined, configurable: true });
    vi.setSystemTime(T);
  });
  afterEach(() => {
    Object.defineProperty(document, "fonts", { value: undefined, configurable: true });
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  it("1단계 7줄·2단계 6줄·3단계 5줄, 안쪽 높이 284: 7×56=392 > 284, 6×44=264 ≤ 284 이므로 2단계(36/44)가 그대로 화면 글 크기가 된다", () => {
    const r = render(<WillLetter letter={letterOf2()} reducedMotion={false} splitLines={linesBy({ 46: 7, 36: 6, 28: 5 })} />);
    tick(400);
    const paper = paperOf(r.container);
    expect(pv(paper, "--lw-font")).toBe("36px");
    expect(pv(paper, "--lw-line")).toBe("44px");
    expect(pv(paper, "--lw-paper-h")).toBe("340px");
    expect(lineEls(r.container).length).toBe(6);
  });

  it("1단계로 들어가면 46/56 을 쓴다", () => {
    const r = render(<WillLetter letter={letterOf2()} reducedMotion={false} splitLines={linesBy({ 46: 2, 36: 2, 28: 2 })} />);
    tick(400);
    expect(pv(paperOf(r.container), "--lw-font")).toBe("46px");
    expect(lineEls(r.container).length).toBe(2);
  });

  it("3단계로도 넘으면 3단계(28/32)로 두고 편지지를 가용 높이까지 키운다(하한 220)", () => {
    const grow = render(<WillLetter letter={letterOf2()} reducedMotion={false} splitLines={linesBy({ 46: 12, 36: 10, 28: 9 })} getInputTop={() => 640} />);
    tick(400);
    // 가용 = 640 − 72 − 43(1줄 추정) − 40 − 30 = 455 → 340 을 넘어 가용까지
    expect(pv(paperOf(grow.container), "--lw-font")).toBe("28px");
    expect(pv(paperOf(grow.container), "--lw-paper-h")).toBe("455px");
    grow.unmount();
    const floor = render(<WillLetter letter={letterOf2()} reducedMotion={false} splitLines={linesBy({ 46: 12, 36: 10, 28: 9 })} getInputTop={() => 300} />);
    tick(400);
    expect(pv(paperOf(floor.container), "--lw-paper-h")).toBe("220px");
  });

  it("입력줄 윗변이 알려지면 편지지 높이는 min(340, 가용) 하한 220, 묶음은 알림 아래에서 입력줄 윗변 사이에 놓인다", () => {
    const r = render(<WillLetter letter={letterOf2()} reducedMotion={false} splitLines={linesBy({ 46: 2, 36: 2, 28: 2 })} getInputTop={() => 450} />);
    tick(400);
    // 가용 = 450 − 72 − 43 − 40 − 30 = 265
    expect(pv(paperOf(r.container), "--lw-paper-h")).toBe("265px");
    const root = letterOf(r.container)!;
    expect(pv(root, "--lw-top")).toBe("135px");
    expect(pv(root, "--lw-h")).toBe("311px");
  });

  it("긴 글이 인장 자리에 닿으면 머리글 아래에 붙이고 인장 옆 줄(윗변에서 192 아래)의 오른쪽을 88 비운다", () => {
    const bands: Array<unknown> = [];
    const split = (text: string, tier: { font: number; line: number }, band: { from: number; side: number } | null): string[] => {
      bands.push(band);
      const n = tier.font === 28 ? (band === null ? 7 : 8) : 20;
      return Array.from({ length: n }, (_, i) => `${i + 1}줄`);
    };
    const r = render(<WillLetter letter={letterOf2()} reducedMotion={false} splitLines={split} />);
    tick(400);
    expect(bands).toContainEqual({ from: 192, side: 88 });
    const block = r.container.querySelector<HTMLElement>(".mf-letter__text")!;
    expect(block.style.top).toBe("52px");
    const lines = lineEls(r.container);
    expect(lines.length).toBe(8);
    expect(lines.map((l) => l.style.marginRight)).toEqual(["", "", "", "", "", "", "88px", "88px"]);
    expect(pv(paperOf(r.container), "--lw-pos")).toBe("52px");
  });

  it("글 덩어리는 가운데에 놓이되 인장 윗변 위로 올린다: blockTop", () => {
    // 2줄 46/56 = 112: 340 에서 가운데(114), 아래끝 226 은 인장 윗변(248) − 4 안
    expect(blockTop(340, 2, 56)).toBe(114);
    // 6줄 28/32 = 192: 가운데면 아래끝 266 이 인장을 침범 → 머리글 아래 52 까지 올려 아래끝을 244 에 맞춘다
    expect(blockTop(340, 6, 32)).toBe(52);
    // 7줄 28/32 = 224: 인장 위에 못 들어가면 가운데
    expect(blockTop(340, 7, 32)).toBe(58);
  });
});

describe("편지 글꼴 대기·시계 기준 수명·모션 줄이기 (C-3·C-5)", () => {
  beforeEach(() => {
    Object.defineProperty(document, "fonts", { value: undefined, configurable: true });
    vi.setSystemTime(T);
  });
  afterEach(() => {
    Object.defineProperty(document, "fonts", { value: undefined, configurable: true });
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });
  const mountLetter = (over: Partial<WillLetterState> = {}, reduced = false) =>
    render(<WillLetter letter={letterOf2(over)} reducedMotion={reduced} splitLines={linesBy({ 46: 1, 36: 1, 28: 1 })} />);

  it("글꼴이 준비되면 T0 에 그대로 시작한다: load 는 46px 글꼴과 본문으로 불린다", async () => {
    fontsFake(() => new Promise((res) => setTimeout(() => res([{}]), 100)));
    const r = mountLetter();
    expect(document.fonts.load).toHaveBeenCalledWith('46px "Nanum Pen Script"', WILL);
    tick(400);
    await flush();
    const letter = letterOf(r.container)!;
    expect(letter).not.toBeNull();
    expect(letter.classList.contains("is-fallback")).toBe(false);
    expect(pv(lineEls(r.container)[0]!, "--lw-delay")).toBe("800ms");
  });

  it("글꼴이 1초 안에 준비되지 않으면 대체 글꼴로 진행한다: 늦은 만큼 이미 쓰인 상태로 시작(지연 = at − 지난 시간)", async () => {
    fontsFake(() => new Promise(() => {}));
    const r = mountLetter();
    tick(999);
    await flush();
    expect(letterOf(r.container)).toBeNull();
    tick(1);
    await flush();
    const letter = letterOf(r.container)!;
    expect(letter.classList.contains("is-fallback")).toBe(true);
    // 지난 시간 e = 1000 − 400 = 600
    expect(pv(lineEls(r.container)[0]!, "--lw-delay")).toBe("200ms");
    expect(pv(r.container.querySelector(".mf-letter__rise"), "--lw-rise-delay")).toBe("-600ms");
    expect(pv(r.container.querySelector(".mf-letter__fold"), "--lw-fold-delay")).toBe("4400ms");
  });

  it("글꼴 로드가 실패하거나 document.fonts 가 없으면 대체 글꼴로 T0 에 진행한다", async () => {
    fontsFake(() => Promise.reject(new Error("net")));
    const a = mountLetter();
    await flush();
    tick(400);
    expect(letterOf(a.container)!.classList.contains("is-fallback")).toBe(true);
    a.unmount();
    Object.defineProperty(document, "fonts", { value: undefined, configurable: true });
    const b = mountLetter();
    tick(400);
    expect(letterOf(b.container)!.classList.contains("is-fallback")).toBe(true);
  });

  it("탭을 가렸다 돌아오면 지난 구간을 건너뛴다: 지연이 시계 기준으로 다시 계산되고, 5.42초 뒤에는 걷힌다", () => {
    const r = mountLetter();
    tick(400);
    tick(2000); // e = 2000
    visibility("hidden");
    tick(1500);
    visibility("visible"); // e = 3500
    expect(pv(lineEls(r.container)[0]!, "--lw-delay")).toBe("-2700ms");
    expect(pv(r.container.querySelector(".mf-letter__rise"), "--lw-rise-delay")).toBe("-3500ms");
    expect(pv(r.container.querySelector(".mf-letter__fold"), "--lw-fold-delay")).toBe("1500ms");
    tick(1700);
    visibility("visible"); // e = 5200 — 접힘이 이미 시작됨
    expect(pv(r.container.querySelector(".mf-letter__fold"), "--lw-fold-delay")).toBe("-200ms");
    tick(LETTER_END_AT_MS - 5200 - 1);
    expect(letterOf(r.container)).not.toBeNull();
    tick(1);
    expect(letterOf(r.container)).toBeNull();
  });

  it("탭을 5.42초 넘게 가렸다 돌아오면 바로 사라진다", () => {
    const r = mountLetter();
    tick(400);
    visibility("hidden");
    // 가려진 동안 타이머가 멈춘 것처럼 시계만 앞으로 간다
    vi.setSystemTime(T + 400 + 6000);
    visibility("visible");
    expect(letterOf(r.container)).toBeNull();
  });

  it("모션 줄이기: 처음부터 완성된 모양(모든 줄·인장), 막대 정지, T0 + 5.42초에 제거 — 애니메이션 클래스 is-still", () => {
    const live = vi.fn();
    const r = render(<WillLetter letter={letterOf2()} reducedMotion splitLines={linesBy({ 46: 2, 36: 2, 28: 2 })} onLive={live} />);
    tick(400);
    const letter = letterOf(r.container)!;
    expect(letter.classList.contains("is-still")).toBe(true);
    expect(lineEls(r.container).length).toBe(2);
    expect(letter.querySelector("[data-will-seal]")).not.toBeNull();
    expect(live).toHaveBeenLastCalledWith(true);
    const css = readFileSync("src/styles/letter.css", "utf8");
    expect(css).toMatch(/\.mf-letter\.is-still[^{]*\{[^}]*animation:\s*none/);
    tick(LETTER_END_AT_MS - 1);
    expect(letterOf(r.container)).not.toBeNull();
    tick(1);
    expect(letterOf(r.container)).toBeNull();
    expect(live).toHaveBeenLastCalledWith(false);
  });

  it("T0 전에는 편지가 없고(onLive false), T0 에 켜진다", () => {
    const live = vi.fn();
    const r = render(<WillLetter letter={letterOf2({ t0: T + 2600 })} reducedMotion={false} splitLines={linesBy({ 46: 1, 36: 1, 28: 1 })} onLive={live} />);
    tick(2599);
    expect(letterOf(r.container)).toBeNull();
    expect(live).not.toHaveBeenCalledWith(true);
    tick(1);
    expect(letterOf(r.container)).not.toBeNull();
    expect(live).toHaveBeenLastCalledWith(true);
  });
});

describe("아침 알림 위치: 편지가 있으면 위 72 (C-2)", () => {
  it("ResultAnnounce placement=top 은 .is-top, 기본은 아니다. game.css 의 is-top 은 위 패딩 72 만 바꾼다", () => {
    const a = render(<ResultAnnounce text="알림" />);
    expect(a.container.querySelector(".mf-announce")!.classList.contains("is-top")).toBe(false);
    a.unmount();
    const b = render(<ResultAnnounce text="알림" placement="top" />);
    expect(b.container.querySelector(".mf-announce")!.classList.contains("is-top")).toBe(true);
    const css = readFileSync("src/styles/game.css", "utf8");
    expect(css).toMatch(/\.mf-announce\.is-top\s*\{[^}]*padding-top:\s*72px/);
  });

  it("방 화면: 편지가 있는 아침의 알림은 is-top 으로 올라가 편지와 함께 걷히고, 편지가 없는 아침은 위 240 그대로", () => {
    const s = setup();
    s.show(killed());
    s.card("will", 3, 1, WILL);
    s.advance(399);
    expect(s.container.querySelector(".mf-announce")).toBeNull();
    s.advance(1);
    const announce = s.container.querySelector(".mf-announce")!;
    expect(announce.classList.contains("is-top")).toBe(true);
    expect(announce.textContent).toContain("지아");
    s.advance(LETTER_END_AT_MS - 1);
    expect(s.container.querySelector(".mf-announce")).not.toBeNull();
    s.advance(1);
    expect(letterOf(s.container)).toBeNull();
    expect(s.container.querySelector(".mf-announce")).toBeNull();
    s.unmount();

    const plain = setup();
    plain.show(killed());
    plain.advance(400);
    expect(plain.container.querySelector(".mf-announce")).not.toBeNull();
    expect(plain.container.querySelector(".mf-announce")!.classList.contains("is-top")).toBe(false);
  });
});
