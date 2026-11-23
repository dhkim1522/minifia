// 유언 편지 화면 시험 (09.1-11, 결정 0063-3·0063-4, UI-SPEC C-1·C-2·C-5, L16). RoomScreen 을 거쳐 밤 → 아침 view 와 라이브 유언 카드를 실제 ChatStore 로 먹인다.
// WorldStage 는 받은 props 만 쥐는 가짜(캔버스는 worldStage 시험 몫). 가짜 타이머로 시간표를 읽는다.
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { PhaseId, PublicPlayer, RoomView } from "../../shared/protocol";
import { WillLetter } from "../../src/components/v2/WillLetter";
import { ResultAnnounce } from "../../src/components/ResultAnnounce";
import { LETTER_END_AT_MS, LETTER_FOLD_AT_MS, LETTER_RISE_MS, LETTER_SEAL_AT_MS, SEAL_GLYPH } from "../../src/game/willLetter";
import { stationeryArt } from "../../src/net/assets";
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
    expect(seal.getAttribute("aria-hidden")).toBe("true");
    const sealImage = seal.querySelector("img")!;
    expect(sealImage.getAttribute("src")).toBe(stationeryArt("seal"));
    expect(sealImage.alt).toBe("");
    fireEvent.error(sealImage);
    expect(seal.querySelector("img")).toBeNull();
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

  it("편지 등장과 인장은 같은 시작 시각을 따르고 본문은 처음부터 한 문단에 있다", () => {
    const s = setup();
    s.show(killed());
    s.card("will", 3, 1, WILL);
    s.advance(400);
    const letter = letterOf(s.container)!;
    expect(letter.style.getPropertyValue("--lw-rise-duration")).toBe(String(LETTER_RISE_MS) + "ms");
    expect(letter.querySelector("[data-will-line]")!.textContent).toBe(WILL);
    const seal = letter.querySelector<HTMLElement>("[data-will-seal]")!;
    expect(seal.getAttribute("data-seal-at")).toBe(String(LETTER_SEAL_AT_MS));
    expect(seal.style.getPropertyValue("--lw-delay")).toBe(String(LETTER_SEAL_AT_MS) + "ms");
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
    expect(letter.querySelector(".mf-letter__text :is(img, b, script), [data-will-read] :is(img, b, script)")).toBeNull();
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
    expect(css).toMatch(/--letter-wax-hi/);
    // :root 나 전역 선택자에 편지 변수를 선언하지 않는다
    expect(/:root\s*\{[^}]*--letter-/.test(css)).toBe(false);
    expect(css).toContain("text-align: start");
  });
});

const T = 1_000_000;
const letterOf2 = (over: Partial<WillLetterState> = {}): WillLetterState => ({
  seat: 3,
  name: "지아",
  text: WILL,
  t0: T + 400,
  announce: { text: "지아 님이 암살당했습니다", icon: "target" },
  ...over,
});
const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
function visibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  act(() => void document.dispatchEvent(new Event("visibilitychange")));
}

describe("공개 유언 본문과 시간표", () => {
  beforeEach(() => vi.setSystemTime(T));
  afterEach(() => Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }));

  it("긴 이름과 50글자 전체를 묶어 표시하고 인장은 제목 옆 칸에 둔다", () => {
    const name = "아주긴이름가나다";
    const text = "남은 사람들을 믿어요".repeat(5).slice(0, 50);
    const r = render(<WillLetter letter={letterOf2({ name, text })} reducedMotion={false} />);
    tick(399);
    expect(letterOf(r.container)).toBeNull();
    tick(1);
    const letter = letterOf(r.container)!;
    const body = letter.querySelector("[data-will-line]")!;
    expect(body.textContent).toBe(text);
    expect(letter.querySelectorAll("[data-will-line]")).toHaveLength(1);
    expect(letter.querySelector("[data-will-head]")!.textContent).toBe(name + " 님의 유언");
    expect(letter.querySelector("[data-will-seal]")!.parentElement).toBe(letter.querySelector("[data-will-head]")!.parentElement);
    expect(body.closest(".mf-letter__heading")).toBeNull();
    expect(body.hasAttribute("data-write-at")).toBe(false);
  });

  it("탭을 가렸다 돌아오면 애니메이션은 실제 경과 시각부터 이어진다", () => {
    const r = render(<WillLetter letter={letterOf2()} reducedMotion={false} />);
    tick(400);
    tick(2000);
    visibility("hidden");
    tick(1500);
    visibility("visible");
    const letter = letterOf(r.container)!;
    expect(letter.style.getPropertyValue("--lw-rise-delay")).toBe("-3500ms");
    expect(letter.style.getPropertyValue("--lw-fold-delay")).toBe("1500ms");
    tick(1700);
    visibility("visible");
    expect(letter.style.getPropertyValue("--lw-fold-delay")).toBe("-200ms");
    tick(LETTER_END_AT_MS - 5200);
    expect(letterOf(r.container)).toBeNull();
  });

  it("탭을 5.42초 넘게 가렸다 돌아오면 바로 사라진다", () => {
    const r = render(<WillLetter letter={letterOf2()} reducedMotion={false} />);
    tick(400);
    visibility("hidden");
    vi.setSystemTime(T + 400 + 6000);
    visibility("visible");
    expect(letterOf(r.container)).toBeNull();
  });

  it("모션 줄이기는 시작부터 본문과 인장을 보이고 같은 시각에 닫힌다", () => {
    const live = vi.fn();
    const r = render(<WillLetter letter={letterOf2()} reducedMotion onLive={live} />);
    tick(399);
    expect(live).not.toHaveBeenCalledWith(true);
    tick(1);
    const letter = letterOf(r.container)!;
    expect(letter.classList.contains("is-still")).toBe(true);
    expect(letter.querySelector("[data-will-line]")!.textContent).toBe(WILL);
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
});

describe("아침 알림 위치: 큰 글은 띠 아래에서 시작한다 (C-2, 0083-10)", () => {
  const rule = (css: string, sel: string): string => css.split("\n").find((l) => l.startsWith(sel)) ?? "";
  it("편지를 표시할 때만 알림을 위로 보내고 아이콘을 18px로 작게 한다", () => {
    const a = render(<ResultAnnounce text="알림" icon="ghost" />);
    expect(a.container.querySelector(".mf-announce")!.classList.contains("is-top")).toBe(false);
    expect(a.container.querySelector(".mf-announce__icon")!.getAttribute("width")).toBe("56");
    a.unmount();
    const b = render(<ResultAnnounce text="알림" icon="ghost" withLetter />);
    expect(b.container.querySelector(".mf-announce")!.classList.contains("is-top")).toBe(true);
    expect(b.container.querySelector(".mf-announce__icon")!.getAttribute("width")).toBe("18");
  });

  it("game.css: .mf-announce.is-top 의 위 여백은 헤더 아랫변(--mf-host-bottom, 기본 62) + space-md 이고 고정 72 가 아니다", () => {
    const css = readFileSync("src/styles/game.css", "utf8");
    const top = rule(css, ".mf-announce.is-top");
    expect(top).toMatch(/--mf-host-bottom,\s*62px/);
    expect(top).toMatch(/var\(--space-md\)/);
    expect(top).not.toMatch(/padding-top:\s*72px/);
  });

  it("game.css: 결과 알림은 헤더와 채팅 사이의 영역에 자리한다", () => {
    const css = readFileSync("src/styles/game.css", "utf8");
    const announce = rule(css, ".mf-announce {");
    expect(announce).toMatch(/padding:\s*62px var\(--space-md\) var\(--mf-panel-h,\s*0px\)/);
    expect(announce).toMatch(/align-items:\s*center/);
  });

  it("편지는 헤더와 모달을 제외한 하단 조작부 높이를 상속한다", () => {
    const css = readFileSync("src/styles/letter.css", "utf8");
    expect(css).toContain("inset-block-start: calc(var(--mf-host-bottom, 62px) + 56px)");
    expect(css).toContain("inset-block-end: calc(var(--mf-panel-h, 0px) + 8px)");
  });

  it("방 화면: 편지가 있는 아침의 알림은 is-top 으로 올라가 편지와 함께 걷히고, 편지가 없는 아침은 무대 가운데에 있다", () => {
    const s = setup();
    s.show(killed());
    s.card("will", 3, 1, WILL);
    s.advance(399);
    expect(s.container.querySelector(".mf-announce")).toBeNull();
    s.advance(1);
    const announce = s.container.querySelector(".mf-announce")!;
    expect(announce.classList.contains("is-top")).toBe(true);
    expect(announce.classList.contains("is-with-letter")).toBe(true);
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
