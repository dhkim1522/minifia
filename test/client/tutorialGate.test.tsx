// 17-04: 허용 목록 밖 차단(inert)·장면별 포커스 이동 (T-10, 결정 0080-6, TUT-03, Pitfall 7).
// 튜토리얼은 정해진 한 길로만 눌린다: 장면마다 머리·맵 입력면·심부름 타일 층·아래 패널·(장면 6 밖) 이름표 층이 inert 이고,
// [처리](장면 3)·이름표(장면 6)·[다음]·[건너뛰기]·소리 단추만 눌린다. inert 는 자손이 풀 수 없으므로 허용 대상은 차단 컨테이너 밖에 있어야 한다.
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { setEngineForTest } from "../../src/audio/unlock";
import { makeRig } from "../helpers/soundRig";
import { tutorialStage } from "../helpers/fakeTutorialStage";

vi.mock("../../src/components/WorldStage", async () => ({ WorldStage: (await import("../helpers/fakeTutorialStage")).FakeTutorialStage }));

type ScreenModule = typeof import("../../src/screens/TutorialScreen");
/** 정적 분석이 모듈 없음으로 파일 전체를 죽이지 않도록 경로를 변수로 둔다 */
const SCREEN_PATH = "../../src/screens/TutorialScreen";
async function loadScreen(): Promise<ScreenModule> {
  const mod = (await import(/* @vite-ignore */ SCREEN_PATH).catch(() => null)) as ScreenModule | null;
  expect(mod, "src/screens/TutorialScreen.tsx 모듈이 있어야 한다").not.toBeNull();
  return mod!;
}

const NOW = 1_700_000_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const rig = makeRig();
  rig.engine.unlock();
  vi.spyOn(rig.engine, "play").mockImplementation(() => {});
  vi.spyOn(rig.engine, "runScript").mockImplementation(() => {});
  setEngineForTest(rig.engine);
});
afterEach(() => {
  cleanup();
  tutorialStage.props = null;
  setEngineForTest(null);
  vi.useRealTimers();
});

async function mount(n: 1 | 2 | 3 | 4 | 5 | 6 | 7) {
  const { TutorialScreen } = await loadScreen();
  return render(<TutorialScreen mode="solo" onEnd={vi.fn()} initialScene={n} />);
}
const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};
const inertAbove = (el: Element | null): boolean => el !== null && el.closest("[inert]") !== null;
const q = (c: ParentNode, sel: string): HTMLElement | null => c.querySelector<HTMLElement>(sel);

describe("장면 3: 허용 목록 밖은 inert", () => {
  it("머리·맵 입력면·심부름 타일 층·이름표 층이 inert 이고, 오른쪽 단추 열이 있으면 그것도 inert", async () => {
    const { container } = await mount(3);
    for (const sel of [".mf-game__header", ".mf-world__input", "[data-errand-layer]", ".mf-world__tags"]) {
      const el = q(container, sel);
      expect(el, `${sel} 가 있어야 한다`).not.toBeNull();
      expect(el!.hasAttribute("inert"), `${sel} 는 inert`).toBe(true);
    }
    for (const el of container.querySelectorAll("[data-side-column], .mv-float, [data-world-panel]")) expect(el.hasAttribute("inert")).toBe(true);
  });

  it("[처리] 층과 그 단추에는 inert 조상이 없다", async () => {
    const { container } = await mount(3);
    expect(q(container, "[data-errand-act-layer]")).not.toBeNull();
    expect(q(container, "[data-errand-act]")).not.toBeNull();
    expect(inertAbove(q(container, "[data-errand-act-layer]"))).toBe(false);
    expect(inertAbove(q(container, "[data-errand-act]"))).toBe(false);
  });

  it("차단은 CSS 로도 한 겹 더 있다: [inert] 는 pointer-events none", () => {
    const css = readFileSync("src/styles/tutorial.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css).toMatch(/\[data-tutorial-screen\] \[inert\][^{]*\{[^}]*pointer-events:\s*none/);
  });

  it("[처리] 뒤 장면 4 에서도 같은 층이 차단돼 있다(장면이 바뀌어도 다시 건다)", async () => {
    const { container } = await mount(3);
    act(() => tutorialStage.props!.errand!.onAct?.());
    advance(700);
    expect(container.querySelector("[data-tutorial-screen]")?.getAttribute("data-tutorial-scene")).toBe("4");
    for (const sel of [".mf-game__header", ".mf-world__input", "[data-errand-layer]", ".mf-world__tags"]) expect(q(container, sel)?.hasAttribute("inert"), sel).toBe(true);
  });
});

describe("장면 6: 이름표만 열린다", () => {
  it(".mf-world__tags 는 inert 가 없고 머리·입력면은 inert, 아래 패널은 없다", async () => {
    const { container } = await mount(6);
    expect(q(container, ".mf-world__tags")!.hasAttribute("inert")).toBe(false);
    expect(inertAbove(q(container, "[data-pick]"))).toBe(false);
    for (const sel of [".mf-game__header", ".mf-world__input"]) {
      const el = q(container, sel);
      expect(el, `${sel} 가 있어야 한다`).not.toBeNull();
      expect(el!.hasAttribute("inert"), `${sel} 는 inert`).toBe(true);
    }
    // 18-03: 아래 패널은 막아 두는 것이 아니라 DOM 에 없다
    expect(q(container, "[data-world-panel]") === null, "[data-world-panel] 이 DOM 에 없다").toBe(true);
  });

  it("장면 5 에서 6 으로 갈 때 이름표 층의 inert 가 풀린다", async () => {
    const { container } = await mount(5);
    advance(0);
    expect(q(container, ".mf-world__tags")!.hasAttribute("inert")).toBe(true);
    fireEvent.click(q(container, "[data-tutorial-next]")!);
    expect(q(container, ".mf-world__tags")!.hasAttribute("inert")).toBe(false);
  });
});

describe("항상 열린 것: [건너뛰기]·[다음]·소리 단추", () => {
  it.each([1, 2, 3, 4, 5, 6, 7] as const)("장면 %i: [건너뛰기] 와 소리 단추에 inert 조상이 없다", async (n) => {
    const { container } = await mount(n);
    advance(5000);
    expect(q(container, "[data-tutorial-skip]")).not.toBeNull();
    expect(inertAbove(q(container, "[data-tutorial-skip]"))).toBe(false);
    for (const el of container.querySelectorAll("[data-sound-button]")) expect(inertAbove(el)).toBe(false);
    const next = q(container, "[data-tutorial-next]");
    if (next !== null) expect(inertAbove(next)).toBe(false);
  });
});

describe("포커스 이동", () => {
  it("장면 3: 포커스가 [처리] 로 간다", async () => {
    const { container } = await mount(3);
    expect(document.activeElement).toBe(q(container, "[data-errand-act]"));
  });

  it("[다음] 이 나타나는 장면에서는 [다음] 으로 간다", async () => {
    const { container } = await mount(2);
    advance(2600);
    expect(document.activeElement).toBe(q(container, "[data-tutorial-next]"));
  });

  it("장면 5(처음부터 [다음])는 [다음] 으로", async () => {
    const { container } = await mount(5);
    advance(0);
    expect(document.activeElement).toBe(q(container, "[data-tutorial-next]"));
  });

  it("장면 6: 포커스가 첫 이름표 단추로 간다", async () => {
    const { container } = await mount(6);
    const first = container.querySelector("[data-pick]");
    expect(first).not.toBeNull();
    expect(document.activeElement).toBe(first);
  });

  it("[다음] 을 눌러 장면이 바뀌면 포커스가 새 장면의 허용된 첫 단추로 간다", async () => {
    const { container } = await mount(2);
    advance(2600);
    fireEvent.click(q(container, "[data-tutorial-next]")!);
    expect(container.querySelector("[data-tutorial-screen]")?.getAttribute("data-tutorial-scene")).toBe("3");
    expect(document.activeElement).toBe(q(container, "[data-errand-act]"));
  });
});

describe("tutorial.css: 기존 호출 빛남 맥박 끔 (0080-6)", () => {
  it("[data-tutorial-screen] 아래 .is-call::before 의 animation 이 none 이다", () => {
    const css = readFileSync("src/styles/tutorial.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css).toMatch(/\[data-tutorial-screen\] \.is-call::before\s*\{[^}]*animation:\s*none/);
  });
});
