// 17-08: 첫 사건 장면 1 오프닝(램프 번짐·어둠·진홍 번쩍임·소리 링·제목, 서연이 사라지고 밤이 켜짐)과 (Task 2) 장면 7 직업 카드 (TUT-03, TUT-04, 결정 0078-1, 0080-9·13, T-17-18·19).
// WorldStage 는 props 를 쥐는 가짜(test/helpers/fakeTutorialStage)다. onReady 를 늦게 부르는 시험은 가짜를 감싸 부르는 때를 시험이 쥔다.
// 이름표 사각형은 getBoundingClientRect 를 모킹해 서연 자리 측정을 시험한다(jsdom 은 늘 0×0).
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { setEngineForTest } from "../../src/audio/unlock";
import { OPENING_LAMPS, TUTORIAL_CAST } from "../../src/game/tutorialScript";
import type { WorldStageProps } from "../../src/components/WorldStage";
import { tutorialStage as stage } from "../helpers/fakeTutorialStage";
import { makeRig } from "../helpers/soundRig";

const connection = vi.hoisted(() => ({ calls: 0 }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => {
    connection.calls += 1;
    return null;
  },
}));
const preload = vi.hoisted(() => ({ calls: 0 }));
vi.mock("../../src/net/assets", async (orig) => ({
  ...(await orig<typeof import("../../src/net/assets")>()),
  preloadRoleAssets: () => {
    preload.calls += 1;
  },
}));
/** manual 이면 가짜 무대가 준비됐다는 알림(onReady)을 바로 부르지 않고 release 로 시험이 부른다 */
const ctl = vi.hoisted(() => ({ manual: false, release: null as null | (() => void) }));
vi.mock("../../src/components/WorldStage", async () => {
  const { FakeTutorialStage } = await import("../helpers/fakeTutorialStage");
  return {
    WorldStage: (props: WorldStageProps) => FakeTutorialStage(ctl.manual ? { ...props, onReady: () => (ctl.release = props.onReady ?? null) } : props),
  };
});

const ROOT = `${process.cwd()}/`;
const NOW = 1_700_000_000_000;
const REDUCED = (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });

let rig: ReturnType<typeof makeRig>;
let zeroRects = true;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  connection.calls = 0;
  ctl.manual = false;
  ctl.release = null;
  preload.calls = 0;
  rig = makeRig();
  vi.spyOn(rig.engine, "play").mockImplementation(() => {});
  vi.spyOn(rig.engine, "runScript").mockImplementation(() => {});
  setEngineForTest(rig.engine);
  // 기본은 전부 0×0. zeroRects 가 false 면 이름표만 좌석마다 다른 자리의 96×40 사각형이다
  zeroRects = true;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const zero = { left: 0, top: 0, width: 0, height: 0 };
    const r = !zeroRects && this.classList.contains("mf-world__tag") ? { left: 40 + Number(this.getAttribute("data-seat")) * 100, top: 200, width: 96, height: 40 } : zero;
    return { ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON: () => ({}) } as DOMRect;
  });
});

afterEach(() => {
  cleanup();
  stage.props = null;
  setEngineForTest(null);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

type ScreenModule = typeof import("../../src/screens/TutorialScreen");
const SCREEN_PATH = "../../src/screens/TutorialScreen";

async function mount(opts: { initialScene: 1 | 7; mode?: "solo" | "together" }) {
  const mod = (await import(/* @vite-ignore */ SCREEN_PATH).catch(() => null)) as ScreenModule | null;
  expect(mod, "src/screens/TutorialScreen.tsx 모듈이 있어야 한다").not.toBeNull();
  const onEnd = vi.fn();
  const { TutorialScreen } = mod!;
  const r = render(<TutorialScreen mode={opts.mode ?? "solo"} onEnd={onEnd} initialScene={opts.initialScene} />);
  return { ...r, onEnd };
}

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};
const sceneOf = (c: ParentNode): string | null => c.querySelector("[data-tutorial-screen]")?.getAttribute("data-tutorial-scene") ?? null;
const next$ = (c: ParentNode) => c.querySelector<HTMLElement>("[data-tutorial-next]");
const opening$ = (c: ParentNode) => c.querySelectorAll<HTMLElement>("[data-tutorial-opening]");
const lamps$ = (c: ParentNode) => c.querySelectorAll<HTMLElement>("[data-opening-lamp]");
const flash$ = (c: ParentNode) => c.querySelectorAll<HTMLElement>("[data-opening-flash]");
const rings$ = (c: ParentNode) => c.querySelectorAll<HTMLElement>("[data-opening-ring]");
const dark$ = (c: ParentNode) => c.querySelectorAll<HTMLElement>("[data-opening-dark]");
const title$ = (c: ParentNode) => c.querySelector<HTMLElement>("[data-opening-title]");
const plays = (id: string): number => (rig.engine.play as unknown as { mock: { calls: [string][] } }).mock.calls.filter((c) => c[0] === id).length;
/** 음절이 있는 사회자 목소리 예약 호출 수 */
const hostSays = (): number => (rig.engine.runScript as unknown as { mock: { calls: [string, unknown[]][] } }).mock.calls.filter((c) => c[0] === "voice.host" && c[1].length > 0).length;
const victimLook = () => stage.props!.scene!.seats[TUTORIAL_CAST.victim];
const css = (): string => readFileSync(`${ROOT}src/styles/tutorial.css`, "utf8");

describe("장면 1 오프닝: 연출 층", () => {
  it("[data-tutorial-opening] 하나, 램프 번짐 OPENING_LAMPS(2)개가 0.8·1.3초에 켜지고, 제목 '밤이 되었습니다'", async () => {
    const { container } = await mount({ initialScene: 1 });
    expect(opening$(container)).toHaveLength(1);
    expect(lamps$(container)).toHaveLength(OPENING_LAMPS);
    expect([...lamps$(container)].map((l) => l.style.animationDelay)).toEqual(["800ms", "1300ms"]);
    expect(title$(container)?.textContent).toBe("밤이 되었습니다");
    expect(dark$(container)).toHaveLength(1);
    // 연출은 장식이다: 읽히지 않고 눌림을 가로채지 않는다
    expect(opening$(container)[0]!.getAttribute("aria-hidden")).toBe("true");
    expect(css()).toMatch(/\.tut-opening\s*\{[^}]*pointer-events:\s*none/);
  });

  it("진홍 번쩍임 1개·소리 링 3개(0.25초 간격, 2.6초부터)가 있고 램프가 다른 장면에는 없다", async () => {
    const { container } = await mount({ initialScene: 1 });
    expect(flash$(container)).toHaveLength(1);
    expect(rings$(container)).toHaveLength(3);
    expect([...rings$(container)].map((r) => r.style.animationDelay)).toEqual(["2600ms", "2850ms", "3100ms"]);
    expect(flash$(container)[0]!.style.animationDelay).toBe("2600ms");
  });

  it("번쩍임·링은 1회뿐(infinite 없음)이고 번쩍임 정점 불투명도는 .6 이하, 1.4초 1회(T-17-19)", () => {
    const text = css();
    const rule = (sel: string): string => new RegExp(`${sel.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`).exec(text)?.[1] ?? "";
    for (const sel of [".tut-opening__flash", ".tut-opening__ring"]) {
      const body = rule(sel);
      expect(body, `${sel} 규칙이 있어야 한다`).toMatch(/animation:/);
      expect(body).not.toMatch(/infinite/);
    }
    expect(rule(".tut-opening__flash")).toMatch(/1\.4s/);
    const frames = /@keyframes tut-opening-flash\s*\{([\s\S]*?)\n\}/.exec(text)?.[1] ?? "";
    expect(frames, "tut-opening-flash 키프레임").not.toBe("");
    const peaks = [...frames.matchAll(/opacity:\s*([\d.]+)/g)].map((m) => Number(m[1]));
    expect(peaks.length).toBeGreaterThan(0);
    expect(Math.max(...peaks)).toBeLessThanOrEqual(0.6);
  });

  it("오프닝 키프레임은 transform·opacity·filter·box-shadow 만 쓴다", () => {
    const text = css();
    const blocks = [...text.matchAll(/@keyframes (tut-opening-[\w-]+)\s*\{([\s\S]*?)\n\}/g)];
    expect(blocks.length).toBeGreaterThanOrEqual(5);
    for (const [, name, body] of blocks) {
      const props = [...body!.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      for (const p of props) expect(["opacity", "transform", "filter", "box-shadow"], `${name} 의 ${p}`).toContain(p);
    }
  });

  it("번쩍임 중심은 서연 이름표 중심이고 못 쟀으면 시안 비율(15%·70%)이다", async () => {
    const none = await mount({ initialScene: 1 });
    advance(50);
    expect(flash$(none.container)[0]!.style.getPropertyValue("--tut-victim-x")).toBe("15%");
    expect(flash$(none.container)[0]!.style.getPropertyValue("--tut-victim-y")).toBe("70%");
    none.unmount();
    cleanup();

    zeroRects = false;
    const { container } = await mount({ initialScene: 1 });
    advance(50);
    const seat = TUTORIAL_CAST.victim;
    const f = flash$(container)[0]!;
    expect(f.style.getPropertyValue("--tut-victim-x")).toBe(`${40 + seat * 100 + 48}px`);
    expect(f.style.getPropertyValue("--tut-victim-y")).toBe("220px");
    // 소리 링도 같은 자리에서 퍼진다
    expect(rings$(container)[0]!.parentElement!.style.getPropertyValue("--tut-victim-x")).toBe(`${40 + seat * 100 + 48}px`);
  });
});

describe("장면 1 오프닝: 실제 무대의 모양 시각", () => {
  it("시작은 서연 좌석 보임·조명 night 아님 → 2600ms 서연 불투명도 0 → 3300ms 조명 night", async () => {
    await mount({ initialScene: 1 });
    expect(victimLook()).toBeDefined();
    expect(victimLook()!.opacity).toBeUndefined();
    expect(stage.props!.scene!.lighting).not.toBe("night");
    advance(2599);
    expect(victimLook()!.opacity).toBeUndefined();
    advance(1);
    expect(victimLook()!.opacity).toBe(0);
    expect(stage.props!.scene!.lighting).not.toBe("night");
    advance(699);
    expect(stage.props!.scene!.lighting).not.toBe("night");
    advance(1);
    expect(stage.props!.scene!.lighting).toBe("night");
    expect(victimLook()!.opacity).toBe(0);
  });

  it("소리: lampOff 두 번·scream 한 번, 사회자 문장은 재생 내내 0", async () => {
    const { container } = await mount({ initialScene: 1 });
    advance(4599);
    expect(plays("tut.lampOff")).toBe(OPENING_LAMPS);
    expect(plays("tut.scream")).toBe(1);
    expect(hostSays()).toBe(0);
    expect(sceneOf(container)).toBe("1");
  });

  it("4600ms 뒤 장면 2 로 자동, 그때 오프닝 층은 사라진다", async () => {
    const { container } = await mount({ initialScene: 1 });
    advance(4599);
    expect(sceneOf(container)).toBe("1");
    expect(opening$(container)).toHaveLength(1);
    advance(1);
    expect(sceneOf(container)).toBe("2");
    expect(opening$(container)).toHaveLength(0);
    expect(connection.calls).toBe(0);
  });

  it("무대가 준비되기 전에는 층도 시계도 돌지 않는다 — 준비된 때부터 4600ms", async () => {
    ctl.manual = true;
    const { container } = await mount({ initialScene: 1 });
    advance(10_000);
    expect(sceneOf(container)).toBe("1");
    expect(opening$(container)).toHaveLength(0);
    expect(plays("tut.lampOff")).toBe(0);
    act(() => ctl.release!());
    expect(opening$(container)).toHaveLength(1);
    advance(4599);
    expect(sceneOf(container)).toBe("1");
    advance(1);
    expect(sceneOf(container)).toBe("2");
  });
});

describe("장면 1 오프닝: 모션 줄이기", () => {
  it("번쩍임·소리 링·램프 번짐은 없고 제목·어둠은 있으며 4600ms 자동 넘김은 그대로", async () => {
    vi.stubGlobal("matchMedia", REDUCED);
    const { container } = await mount({ initialScene: 1 });
    expect(opening$(container)).toHaveLength(1);
    expect(flash$(container)).toHaveLength(0);
    expect(rings$(container)).toHaveLength(0);
    expect(lamps$(container)).toHaveLength(0);
    expect(title$(container)?.textContent).toBe("밤이 되었습니다");
    expect(dark$(container)).toHaveLength(1);
    advance(4599);
    expect(sceneOf(container)).toBe("1");
    advance(1);
    expect(sceneOf(container)).toBe("2");
  });

  it("CSS 모션 줄이기 블록이 오프닝 애니메이션을 끈다", () => {
    const block = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*)\n\}/.exec(css())?.[1] ?? "";
    expect(block).toMatch(/\.tut-opening/);
  });
});

describe("진홍 (T-18)", () => {
  it("tutorial.css 의 진홍 번쩍임·링은 .tut-opening 규칙 안에 있다", () => {
    const text = css();
    expect(text).toMatch(/\.tut-opening__flash\s*\{[^}]*--crimson-500/);
    expect(text).toMatch(/\.tut-opening__ring\s*\{[^}]*--crimson-300/);
  });
});


// ---- Task 2: 장면 7 직업 카드 ----

const cards$ = (c: ParentNode) => [...c.querySelectorAll<HTMLElement>("[data-tutorial-role-card]")];
const ROLE_KINDS = ["citizen", "mafia", "doctor", "police"] as const;
const NAMES = ["시민", "마피아", "의사", "경찰"] as const;
const LINES = ["흔적과 목격으로 마피아를 찾아요", "밤에 한 명을 고르고 들키지 않아요", "밤에 한 명을 지켜요", "밤에 한 명이 마피아인지 알아봐요"] as const;
const BADGE_ANIM = ["a-eye", "a-mask", "a-shield", "a-lens"] as const;
const setHeight = (h: number): void => {
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: h });
};
const bandLine = (c: ParentNode): string | null | undefined => c.querySelector("[data-host-line]")?.textContent;

describe("장면 7 직업 카드: 네 장 고정 2×2", () => {
  beforeEach(() => setHeight(844));

  it("카드 4개가 citizen·mafia·doctor·police 순서, 접근성 이름·글·그림(alt 빈칸)·배지 svg 하나씩", async () => {
    const { container } = await mount({ initialScene: 7 });
    const cards = cards$(container);
    expect(cards.map((c) => c.getAttribute("data-tutorial-role-card"))).toEqual([...ROLE_KINDS]);
    cards.forEach((card, i) => {
      expect(card.getAttribute("aria-label")).toBe(`${NAMES[i]} 카드`);
      expect(card.textContent).toContain(NAMES[i]);
      expect(card.textContent).toContain(LINES[i]);
      const img = card.querySelector("img");
      expect(img?.getAttribute("alt")).toBe("");
      expect(img?.getAttribute("src") ?? "").toMatch(new RegExp(`${ROLE_KINDS[i]}`));
      expect(card.querySelectorAll("[data-role-badge] svg")).toHaveLength(1);
    });
    expect(container.querySelectorAll("[data-tutorial-roles]")).toHaveLength(1);
  });

  it("뒤집기 지연이 .1/.45/.8/1.15초이고 뒷면은 실제 역할 카드 뒷면 마름모다", async () => {
    const { container } = await mount({ initialScene: 7 });
    expect(cards$(container).map((c) => c.style.getPropertyValue("--tut-flip-delay"))).toEqual(["100ms", "450ms", "800ms", "1150ms"]);
    for (const card of cards$(container)) {
      expect(card.classList.contains("is-flip")).toBe(true);
      expect(card.querySelectorAll(".mf-card__diamond")).toHaveLength(1);
    }
  });

  it("배지의 대표 움직임: 시민 눈·마피아 가면·의사 방패·경찰 돋보기(각각 a-eye·a-mask·a-shield·a-lens)", async () => {
    const { container } = await mount({ initialScene: 7 });
    expect(cards$(container)).toHaveLength(4);
    cards$(container).forEach((card, i) => {
      expect(card.querySelector("[data-role-badge] svg")?.classList.contains(BADGE_ANIM[i]!)).toBe(true);
    });
  });

  it("높이 700 이상에서만 아래 줄 '낮에는 모두 함께 투표해요'", async () => {
    setHeight(700);
    const tall = await mount({ initialScene: 7 });
    expect(tall.container.textContent).toContain("낮에는 모두 함께 투표해요");
    tall.unmount();
    cleanup();
    setHeight(699);
    const short = await mount({ initialScene: 7 });
    expect(short.container.textContent).not.toContain("낮에는 모두 함께 투표해요");
  });

  it("tut.flip 네 번(100·450·800·1150ms), 1500ms 에 사회자 문장", async () => {
    const { container } = await mount({ initialScene: 7 });
    advance(99);
    expect(plays("tut.flip")).toBe(0);
    advance(1);
    expect(plays("tut.flip")).toBe(1);
    advance(350);
    expect(plays("tut.flip")).toBe(2);
    advance(350);
    expect(plays("tut.flip")).toBe(3);
    advance(350);
    expect(plays("tut.flip")).toBe(4);
    expect(hostSays()).toBe(0);
    advance(349);
    expect(hostSays()).toBe(0);
    advance(1);
    expect(hostSays()).toBe(1);
    expect(bandLine(container)).toBe("밤에는 저마다 할 일이 있어요");
  });

  it("[다음] → 혼자는 onEnd('done') 한 번, 함께도 같은 장면이고 끝을 알린다", async () => {
    const solo = await mount({ initialScene: 7 });
    expect(next$(solo.container)).not.toBeNull();
    fireEvent.click(next$(solo.container)!);
    expect(solo.onEnd).toHaveBeenCalledTimes(1);
    expect(solo.onEnd).toHaveBeenCalledWith("done");
    solo.unmount();
    cleanup();
    const together = await mount({ initialScene: 7, mode: "together" });
    expect(cards$(together.container).map((c) => c.getAttribute("data-tutorial-role-card"))).toEqual([...ROLE_KINDS]);
    fireEvent.click(next$(together.container)!);
    expect(together.onEnd).toHaveBeenCalledWith("done");
  });

  it("직업 그림은 마운트 때 미리 부른다(혼자 하기에서도 그림이 미리 온다) — 장면 1 부터 한 번", async () => {
    preload.calls = 0;
    await mount({ initialScene: 1 });
    expect(preload.calls).toBe(1);
  });

  it("카드는 고정 상수다: 실제 연결을 부르지 않고 카드 종류 밖의 값이 DOM 에 없다(T-17-18)", async () => {
    const { container } = await mount({ initialScene: 7 });
    expect(connection.calls).toBe(0);
    expect(cards$(container)).toHaveLength(4);
    const kinds = new Set(cards$(container).map((c) => c.getAttribute("data-tutorial-role-card")));
    expect([...kinds].sort()).toEqual([...ROLE_KINDS].sort());
  });
});

describe("장면 7 직업 카드: 모션 줄이기", () => {
  it("카드는 즉시 앞면(뒤집기 클래스 없음)이고 배지 움직임 클래스가 없다", async () => {
    setHeight(844);
    vi.stubGlobal("matchMedia", REDUCED);
    const { container } = await mount({ initialScene: 7 });
    expect(cards$(container)).toHaveLength(4);
    expect(container.querySelectorAll("[data-tutorial-roles] .is-flip")).toHaveLength(0);
    for (const card of cards$(container)) {
      const svg = card.querySelector("[data-role-badge] svg")!;
      expect([...svg.classList].filter((c) => c.startsWith("a-"))).toEqual([]);
    }
  });

  it("직업 카드 키프레임은 transform·opacity·filter 만 쓰고 진홍은 .tut-role 선택자에만 있다", () => {
    const text = css();
    const blocks = [...text.matchAll(/@keyframes (tut-role-[\w-]+)\s*\{([\s\S]*?)\n\}/g)];
    expect(blocks.length).toBeGreaterThanOrEqual(5);
    for (const [, name, body] of blocks) {
      const props = [...body!.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      for (const p of props) expect(["opacity", "transform", "filter"], `${name} 의 ${p}`).toContain(p);
    }
    expect(text).toMatch(/\.tut-role--mafia\s+\.tut-role__face\s*\{[^}]*--crimson-700/);
    expect(text).toMatch(/\.tut-role--mafia\s+\.tut-role__name\s*\{[^}]*--crimson-300/);
  });
});
