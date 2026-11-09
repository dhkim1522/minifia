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

// 같은 파일의 Task 2 시험(장면 7)은 아래에 이어진다. fireEvent·next$ 는 거기서 쓴다.
void fireEvent;
void next$;
