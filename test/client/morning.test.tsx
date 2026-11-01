/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { RoleId } from "../../shared/game/roles";
import type { MorningView, PhaseId, RoomView, SpectateView } from "../../shared/protocol";
import type { RoomConnection } from "../../src/net/useRoomConnection";
import { MorningCard, exitDelayOf } from "../../src/components/MorningCard";
import { DayScene } from "../../src/screens/DayScene";
import { ChatStore } from "../../src/net/chatStore";

// 아침 발표 통합 테스트(03-10): DayScene 의 morning 분기를 view 픽스처로 만난다.
// 실패 보고서가 한 줄이 되도록 단언은 문자열·불리언으로 둔다.

const NOW = 10_000;
const NAMES = ["지우", "하윤", "민지", "도현", "서연"];

interface ViewOpts {
  phase?: PhaseId;
  n?: number;
  role?: RoleId;
  allies?: number[];
  pick?: number;
  allyPicks?: number[];
  dead?: number[];
  morning?: MorningView;
  spectate?: SpectateView;
  endsIn?: number;
}

function makeView(o: ViewOpts = {}): RoomView {
  const me: RoomView["me"] = { seat: 0, isHost: false };
  if (o.role !== undefined) me.role = o.role;
  if (o.allies !== undefined) me.allies = o.allies;
  if (o.pick !== undefined) me.pick = o.pick;
  if (o.allyPicks !== undefined) me.allyPicks = o.allyPicks;
  const dead = o.dead ?? [];
  const phase = o.phase ?? "morning";
  const view: RoomView = {
    code: "0042",
    phase,
    phaseEndsAt: NOW + (o.endsIn ?? 5_000),
    phaseDurationMs: phase === "morning" ? 5_000 : 30_000,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: NAMES.map((nickname, seat) => ({ seat, nickname, connected: true, isHost: seat === 0, alive: !dead.includes(seat) })),
    me,
    day: {
      n: o.n ?? 1,
      roles: ["mafia", "police", "doctor", "citizen"],
    },
  };
  if (o.morning !== undefined && view.day) view.day.morning = o.morning;
  if (o.spectate) view.spectate = o.spectate;
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

function scene(view: RoomView) {
  const c = conn(view);
  const chat = new ChatStore();
  const role = <button type="button">내 역할</button>;
  const utils = render(<DayScene view={view} connection={c} chat={chat} myRoleButton={role} />);
  const rerender = (v: RoomView) => utils.rerender(<DayScene view={v} connection={{ ...c, view: v }} chat={chat} myRoleButton={role} />);
  return { ...utils, rerender, conn: c };
}

const panel = (container: HTMLElement) => container.querySelector<HTMLElement>(".mf-dayscene__panel");
const readCss = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : "");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("아침 발표 (M1)", () => {
  it("morning view(day.n 1, morning {eliminated: 2, phrase: 1}): 카드 제목이 '민지님이 조용히 눈을 감았습니다' 이고 보조 문단이 없다", () => {
    const { container } = scene(makeView({ morning: { eliminated: 2, phrase: 1 } }));
    expect(container.querySelectorAll(".mf-morningcard").length).toBe(1);
    expect(container.querySelector(".mf-morningcard__t")?.textContent).toBe("민지님이 조용히 눈을 감았습니다");
    expect(container.querySelector(".mf-morningcard__s") === null).toBe(true);
  });

  it("카드는 .mf-dayscene 직계이고 테이블 장면 상자 밖이다", () => {
    const { container } = scene(makeView({ morning: { eliminated: 2, phrase: 1 } }));
    const card = container.querySelector(".mf-morningcard")!;
    expect(card.parentElement?.classList.contains("mf-dayscene")).toBe(true);
    expect(card.closest(".mf-dayscene__scene") === null).toBe(true);
  });

  it("위쪽 바 제목 '아침', 안내 '2일차', 배경 아침(실내, 막 없음), 하단 제목 '아침이 밝았습니다'·안내 '곧 낮 토론이 시작돼요'(알약·채팅·버튼 없음)", () => {
    const { container } = scene(makeView({ morning: { eliminated: 2, phrase: 1 } }));
    expect(container.querySelector("h1")?.textContent).toBe("아침");
    expect(container.querySelector(".mf-phasebar__do")?.textContent).toBe("2일차");
    expect(container.querySelector(".mf-backdrop--morning") !== null).toBe(true);
    expect(container.querySelector(".mf-backdrop--day") === null).toBe(true);
    expect(container.querySelector(".mf-backdrop--night") === null).toBe(true);
    const art = container.querySelector<HTMLElement>(".mf-backdrop__art")!;
    expect(art.dataset.scene).toBe("morning");
    expect(art.style.backgroundImage).toContain("/backgrounds/bg_game_morning.webp");
    expect(art.style.getPropertyValue("--mf-scrim")).toBe("");
    const p = panel(container)!;
    expect(p.querySelector("h2")?.textContent).toBe("아침이 밝았습니다");
    expect(p.querySelector(".mf-claimpanel__guide")?.textContent).toBe("곧 낮 토론이 시작돼요");
    expect(p.querySelectorAll(".mf-pk, .mf-ro, button, textarea, input").length).toBe(0);
  });

  it("phase 3 → '민지님이 차갑게 식은 채 발견되었습니다'", () => {
    const { container } = scene(makeView({ morning: { eliminated: 2, phrase: 3 } }));
    expect(container.querySelector(".mf-morningcard__t")?.textContent).toBe("민지님이 차갑게 식은 채 발견되었습니다");
  });

  it("night → morning 으로 바뀌어도 .mf-dt 루트가 같은 DOM 노드다", () => {
    const r = scene(makeView({ phase: "night", role: "citizen" }));
    const table = r.container.querySelector(".mf-dt");
    expect(table !== null).toBe(true);
    r.rerender(makeView({ phase: "morning", role: "citizen", morning: { eliminated: 2, phrase: 1 } }));
    expect(r.container.querySelector(".mf-dt") === table).toBe(true);
  });
});

describe("night.css: 아침 카드 (03-10)", () => {
  const css = readCss("src/styles/night.css");
  const rule = (sel: string) => css.match(new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[2] ?? "";

  it(".mf-morningcard 값이 시안 .bn 을 토큰으로 옮긴 것이다", () => {
    const r = rule(".mf-morningcard");
    expect(/position:\s*absolute/.test(r)).toBe(true);
    expect(/z-index:\s*70/.test(r)).toBe(true);
    expect(/top:\s*168px/.test(r)).toBe(true);
    expect(/width:\s*252px/.test(r)).toBe(true);
    expect(/left:\s*50%/.test(r)).toBe(true);
    expect(/background:\s*color-mix\(in srgb, var\(--night-900\) 92%, transparent\)/.test(r)).toBe(true);
    expect(/box-shadow:\s*0 10px 28px var\(--shadow\)/.test(r)).toBe(true);
    expect(/border:\s*1px solid var\(--night-600\)/.test(r)).toBe(true);
    expect(/word-break:\s*keep-all/.test(r)).toBe(true);
  });

  it("제목은 24px 700 gray-50, 보조는 14px gray-300", () => {
    const t = rule(".mf-morningcard__t");
    expect(/font-size:\s*24px/.test(t)).toBe(true);
    expect(/font-weight:\s*700/.test(t)).toBe(true);
    expect(/color:\s*var\(--gray-50\)/.test(t)).toBe(true);
    const s = rule(".mf-morningcard__s");
    expect(/font-size:\s*14px/.test(s)).toBe(true);
    expect(/color:\s*var\(--gray-300\)/.test(s)).toBe(true);
  });
});

describe("무사·타이머·표시 소멸·탈락 순간 (03-10)", () => {
  const spectate: SpectateView = {
    seats: [
      { seat: 0, job: "citizen" },
      { seat: 1, job: "mafia" },
      { seat: 2, job: "citizen" },
      { seat: 3, job: "police" },
      { seat: 4, job: "doctor" },
    ],
    picks: { mafia: [], police: [], doctor: [] },
  };
  const seatEl = (c: HTMLElement, seat: number) => c.querySelector<HTMLElement>(`.mf-dt__seat[data-seat="${seat}"]`);
  // 이름표는 이름 한 줄(아랫줄 없음). 관전자의 실제 직업 그림(roleArt)은 03.1-10 이 연결하고 그 단언도 거기서 더한다.
  const claimRowCount = (c: HTMLElement) => c.querySelectorAll(".mf-dt__claim").length;
  const urgent = (c: HTMLElement) => c.querySelector(".mf-timer")?.classList.contains("mf-timer--urgent") ?? false;

  it("morning {} → 카드 제목 '아무 일도 없었습니다', 보조 '모두 무사해요'", () => {
    const { container } = scene(makeView({ morning: {} }));
    expect(container.querySelector(".mf-morningcard__t")?.textContent).toBe("아무 일도 없었습니다");
    expect(container.querySelector(".mf-morningcard__s")?.textContent).toBe("모두 무사해요");
  });

  it("아침 Timer(남은 4초)에 mf-timer--urgent 가 없다. 같은 남은 4초의 night Timer 에는 있다", () => {
    const morning = scene(makeView({ morning: {}, endsIn: 4_000 }));
    expect(urgent(morning.container)).toBe(false);
    cleanup();
    const night = scene(makeView({ phase: "night", role: "citizen", endsIn: 4_000 }));
    expect(urgent(night.container)).toBe(true);
  });

  it("night 의 선택 후광·표적·동료 배지가 morning 에서 사라지고 대상 button 은 0 개다 (경찰)", () => {
    const r = scene(makeView({ phase: "night", role: "police", pick: 2 }));
    expect(r.container.querySelectorAll(".mf-figure--halo-white, .mf-dt__pick").length > 0).toBe(true);
    expect(r.container.querySelectorAll(".mf-dt button").length).toBe(5);
    r.rerender(makeView({ phase: "morning", role: "police", pick: 2, morning: {} }));
    expect(r.container.querySelectorAll(".mf-figure--halo-white, .mf-dt__pick").length).toBe(0);
    // 아침의 자리 버튼은 읽기 전용 기록 카드 버튼(03.1-08)뿐이다 — 밤의 대상 버튼(`… 대상`)은 없다
    expect(r.container.querySelectorAll('.mf-dt button[aria-label$="대상"]').length).toBe(0);
    expect(r.container.querySelectorAll(".mf-dt button:not(.mf-dt__seat--inspect)").length).toBe(0);
  });

  it("마피아 화면: 선택·동료 배지는 사라지고 동료 진홍 후광·마름모는 남는다", () => {
    const night = makeView({ phase: "night", role: "mafia", allies: [1], pick: 2, allyPicks: [3] });
    const r = scene(night);
    expect(r.container.querySelectorAll(".mf-dt__pick--ally, .mf-dt__pick--me").length > 0).toBe(true);
    r.rerender(makeView({ phase: "morning", role: "mafia", allies: [1], pick: 2, allyPicks: [3], morning: {} }));
    expect(r.container.querySelectorAll(".mf-figure--halo-white, .mf-dt__pick").length).toBe(0);
    expect(r.container.querySelectorAll('.mf-dt button[aria-label$="대상"]').length).toBe(0);
    expect(r.container.querySelectorAll(".mf-dt button:not(.mf-dt__seat--inspect)").length).toBe(0);
    expect(seatEl(r.container, 1)!.querySelector("img.mf-figure--halo-crimson") !== null).toBe(true);
    expect(seatEl(r.container, 1)!.querySelector('[aria-label="동료"]') !== null).toBe(true);
  });

  it("살아 있는 사람의 morning(eliminated 2, players[2].alive false): 자리 2 는 유령 그림 + 한 줄 탈락 이름표, 직업 그림 없음", () => {
    const { container } = scene(makeView({ role: "citizen", dead: [2], morning: { eliminated: 2, phrase: 1 } }));
    expect(seatEl(container, 2)!.querySelector("img")?.getAttribute("src")).toContain("/characters/ghost/");
    expect(container.querySelector('.mf-dt__tag[data-seat="2"]')?.classList.contains("mf-dt__tag--dead")).toBe(true);
    expect(claimRowCount(container)).toBe(0);
    expect(container.querySelectorAll('.mf-dt img[src*="/characters/roles/"]').length).toBe(0);
    expect(container.querySelector(".mf-ro") === null).toBe(true);
  });

  it("방금 탈락한 나(seat 0)의 morning: 내 이름표는 탈락, 이름표 아랫줄 없음, 하단은 '아침이 밝았습니다'(관전 .mf-ro 없음), 카드는 같은 문구", () => {
    const { container } = scene(makeView({ role: "citizen", dead: [0], spectate, morning: { eliminated: 0, phrase: 1 } }));
    expect(container.querySelector('.mf-dt__tag[data-seat="0"]')?.classList.contains("mf-dt__tag--dead")).toBe(true);
    expect(claimRowCount(container)).toBe(0);
    expect(panel(container)!.querySelector("h2")?.textContent).toBe("아침이 밝았습니다");
    expect(container.querySelector(".mf-ro") === null).toBe(true);
    expect(container.querySelector(".mf-morningcard__t")?.textContent).toBe("지우님이 조용히 눈을 감았습니다");
  });
});

describe("아침 카드 팝·퇴장 (03.1-10, D-15, UI-SPEC F)", () => {
  const css = readCss("src/styles/night.css");
  const rule = (sel: string) => css.match(new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[2] ?? "";
  const keyframes = (name: string) => css.match(new RegExp(`@keyframes ${name}\\s*\\{([\\s\\S]*?\\})\\s*\\}`))?.[0] ?? "";

  it("카드: 제목·보조 문구는 예전과 같다(탈락 문구 `님이`, 무사 `아무 일도 없었습니다` + `모두 무사해요`)", () => {
    const a = scene(makeView({ morning: { eliminated: 1, phrase: 1 } }));
    expect(a.container.querySelector(".mf-morningcard__t")?.textContent).toBe("하윤님이 조용히 눈을 감았습니다");
    cleanup();
    const b = scene(makeView({ morning: {} }));
    expect(b.container.querySelector(".mf-morningcard__t")?.textContent).toBe("아무 일도 없었습니다");
    expect(b.container.querySelector(".mf-morningcard__s")?.textContent).toBe("모두 무사해요");
  });

  it("퇴장 지연 변수: 카드 --mf-morning-exit-delay 와 층 --mf-dim-exit-delay 가 같은 값(남은 5000ms → 4700ms)이다", () => {
    const { container } = scene(makeView({ morning: { eliminated: 1, phrase: 1 }, endsIn: 5_000 }));
    const card = container.querySelector<HTMLElement>(".mf-morningcard")!;
    const dim = container.querySelector<HTMLElement>(".mf-dt__dim")!;
    expect(card.style.getPropertyValue("--mf-morning-exit-delay")).toBe("4700ms");
    expect(dim.style.getPropertyValue("--mf-dim-exit-delay")).toBe("4700ms");
    expect(card.classList.contains("mf-dayscene__enter")).toBe(false);
  });

  it("재접속으로 남은 2000ms 에 들어오면 지연 1700ms", () => {
    const { container } = scene(makeView({ morning: {}, endsIn: 2_000 }));
    expect(container.querySelector<HTMLElement>(".mf-morningcard")!.style.getPropertyValue("--mf-morning-exit-delay")).toBe("1700ms");
  });

  it("지연은 아침이 시작될 때 한 번 정해 같은 마감 안의 다시 그리기에서는 바뀌지 않는다", () => {
    const r = scene(makeView({ morning: {}, endsIn: 5_000 }));
    vi.setSystemTime(NOW + 3_000);
    r.rerender(makeView({ morning: {}, endsIn: 5_000 }));
    expect(r.container.querySelector<HTMLElement>(".mf-morningcard")!.style.getPropertyValue("--mf-morning-exit-delay")).toBe("4700ms");
  });

  it("exitDelayOf: 5000 → 4700, 2000 → 1700, 200 → 0, 음수 → 0", () => {
    expect([exitDelayOf(5_000), exitDelayOf(2_000), exitDelayOf(200), exitDelayOf(-50)].join(",")).toBe("4700,1700,0,0");
  });

  it("night.css: 위치·크기 불변, pointer-events none, 팝 등장·퇴장 규칙", () => {
    const r = rule(".mf-morningcard");
    expect(/pointer-events:\s*none/.test(r)).toBe(true);
    expect(/top:\s*168px/.test(r) && /left:\s*50%/.test(r) && /width:\s*252px/.test(r)).toBe(true);
    expect(/transform:\s*translateX\(-50%\)/.test(r)).toBe(true);
    expect(/mf-morning-pop\s+300ms/.test(r)).toBe(true);
    expect(/mf-morning-out\s+300ms\s+linear\s+var\(--mf-morning-exit-delay/.test(r)).toBe(true);
    const pop = keyframes("mf-morning-pop");
    expect(/scale:\s*0\.92/.test(pop) && /scale:\s*1/.test(pop) && /opacity:\s*0/.test(pop) && /opacity:\s*1/.test(pop)).toBe(true);
    expect(/transform/.test(pop)).toBe(false);
    expect(/opacity:\s*0/.test(keyframes("mf-morning-out"))).toBe(true);
  });

  it("night.css: 축소 모션 블록은 .mf-morningcard 를 scale 없이 opacity 만으로 다루고 hex 색이 없다", () => {
    const block = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/g)?.find((b) => b.includes(".mf-morningcard")) ?? "";
    expect(block !== "").toBe(true);
    expect(/mf-morning-fade/.test(block)).toBe(true);
    expect(/mf-morning-pop/.test(block)).toBe(false);
    expect(/scale:\s*0\.92/.test(keyframes("mf-morning-fade"))).toBe(false);
    expect(/opacity:\s*1/.test(keyframes("mf-morning-fade"))).toBe(true);
    const code = css.split("\n").filter((l) => !/^\s*(\/\*|\*|\/\/)/.test(l)).join("\n");
    expect(/#[0-9a-fA-F]{3,8}\b/.test(code)).toBe(false);
  });
});

// ---- 04-23: 앰버 처형 카드 변형 (VOTE-04, D-33, UI-SPEC 8.5) ----
describe("MorningCard 앰버 처형 변형 (tone=amber · anchor=scene)", () => {
  const verdictCss = readCss("src/styles/verdict.css");
  const rule = (sel: string): string =>
    new RegExp(`${sel.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`).exec(verdictCss)?.[1] ?? "";

  it("기본 호출(아침)의 마크업은 이전과 같다: 클래스 mf-morningcard 하나, 변형 클래스 없음", () => {
    const { container } = render(<MorningCard title="제목" sub="부제" exitDelayMs={1700} />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toBe("mf-morningcard");
    expect(card.style.getPropertyValue("--mf-morning-exit-delay")).toBe("1700ms");
    expect(card.querySelector(".mf-morningcard__t")?.textContent).toBe("제목");
    expect(card.querySelector(".mf-morningcard__s")?.textContent).toBe("부제");
  });

  it("tone=amber + anchor=scene: 클래스 mf-morningcard--amber·mf-morningcard--scene 이 붙는다", () => {
    const { container } = render(<MorningCard title="제목" sub="부제" exitDelayMs={0} tone="amber" anchor="scene" />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.classList.contains("mf-morningcard")).toBe(true);
    expect(card.classList.contains("mf-morningcard--amber")).toBe(true);
    expect(card.classList.contains("mf-morningcard--scene")).toBe(true);
  });

  it("tone 만 주면 위치 변형은 없고, anchor 만 주면 톤 변형은 없다", () => {
    const a = render(<MorningCard title="제목" exitDelayMs={0} tone="amber" />);
    expect((a.container.firstElementChild as HTMLElement).className).toBe("mf-morningcard mf-morningcard--amber");
    cleanup();
    const b = render(<MorningCard title="제목" exitDelayMs={0} anchor="scene" />);
    expect((b.container.firstElementChild as HTMLElement).className).toBe("mf-morningcard mf-morningcard--scene");
  });

  it("verdict.css: 앰버 카드 테두리는 앰버 토큰이고 진홍이 아니다, 위 띠 8px 앰버, 그림자에 앰버 바깥 번짐", () => {
    const amber = rule(".mf-morningcard.mf-morningcard--amber");
    expect(amber).toMatch(/border:\s*1px solid var\(--amber-400\)/);
    expect(amber).toMatch(/box-shadow:[^;]*0 10px 28px var\(--shadow\)[^;]*24px[^;]*var\(--amber-400\)[^;]*30%/);
    expect(amber).toMatch(/background:[^;]*var\(--night-900\) 94%/);
    const band = rule(".mf-morningcard--amber::before");
    expect(band).toMatch(/height:\s*8px/);
    expect(band).toMatch(/background:\s*var\(--amber-400\)/);
    const block = verdictCss.slice(verdictCss.indexOf(".mf-morningcard.mf-morningcard--amber"), verdictCss.indexOf(".mf-morningcard.mf-morningcard--scene") + 200);
    expect(/crimson|#[0-9a-fA-F]{3,8}\b/.test(block.replace(/\/\*[\s\S]*?\*\//g, ""))).toBe(false);
    // 앰버는 선·면·그림자에만 — 글자색으로 쓰지 않는다
    expect(/(^|[;{\s])color:\s*var\(--amber/.test(amber)).toBe(false);
  });

  it("verdict.css: scene 변형은 장면 상자 안 위 8px, 폭·가운데·터치 통과는 아침 카드 규칙을 상속한다", () => {
    const scene = rule(".mf-morningcard.mf-morningcard--scene");
    expect(scene).toMatch(/top:\s*8px/);
    const base = rule(".mf-morningcard");
    expect(base === "" || /pointer-events:\s*none/.test(base)).toBe(true);
    const nightBase = readCss("src/styles/night.css");
    expect(/\.mf-morningcard\s*\{[^}]*pointer-events:\s*none[^}]*width:\s*252px|\.mf-morningcard\s*\{[^}]*width:\s*252px[^}]*pointer-events:\s*none/.test(nightBase)).toBe(true);
  });
});
