// 17-05·21-12: 첫 사건 장면 3~6 연출 — 3 등불 켜기(가로등 표지·진행 점·[켜기]) · 4 현장 조사(서연 집 앞 지점·[살펴보기]·단서 카드) · 5 의심 보드(실제 보드 + 선 하나) ·
// 6 투표(도장·위 알림·득표 배지 → 뒤집히지 않는 정체 카드, 오답 도움) (TUT-03, TUT-04, TUT-06, 결정 0078-1, 21페이즈 D-20·D-28, T-8·T-11·T-18).
// WorldStage 는 props 를 쥐는 가짜(test/helpers/fakeTutorialStage — 타일·[켜기]·지점 표지는 실제 부품)이고 GameMap·SuspectBoard·ClueCard·TopToast 는 진짜다.
// 가짜 view 는 원인 흐름 판이라 이 파일은 openCause() 아래에서 돈다(클라이언트 시험 setup 이 잠가 둔다).
// 이름표·칩·얼굴 사각형은 getBoundingClientRect 를 모킹해 FocusRing·선이 상자를 그리게 한다(jsdom 은 늘 0×0).
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { setEngineForTest } from "../../src/audio/unlock";
import { TUTORIAL_LINES, TUTORIAL_PICK, WRONG_HINT_AFTER } from "../../src/game/tutorialScript";
import { TRACE_MARK } from "../../src/game/traceMark";
import { TRACE_TEXT } from "../../src/game/traceText";
import { tutorialStage as stage } from "../helpers/fakeTutorialStage";
import { openCause } from "../helpers/playable";
import { makeRig } from "../helpers/soundRig";

const connection = vi.hoisted(() => ({ calls: 0 }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => {
    connection.calls += 1;
    return null;
  },
}));
vi.mock("../../src/components/WorldStage", async () => ({ WorldStage: (await import("../helpers/fakeTutorialStage")).FakeTutorialStage }));

const ROOT = `${process.cwd()}/`;
const NOW = 1_700_000_000_000;

let restoreCause: () => void = () => {};
beforeAll(() => {
  restoreCause = openCause();
});
afterAll(() => restoreCause());

let rig: ReturnType<typeof makeRig>;
let zeroRects = false;
let farFace = false;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  connection.calls = 0;
  rig = makeRig();
  vi.spyOn(rig.engine, "play").mockImplementation(() => {});
  vi.spyOn(rig.engine, "runScript").mockImplementation(() => {});
  setEngineForTest(rig.engine);
  // 사각형: 이름표는 좌석마다 다른 자리의 96×40, 보드의 칩·얼굴은 고정 사각형. 그 밖의 요소는 0×0 (zeroRects 면 전부 0×0)
  zeroRects = false;
  farFace = false;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const zero = { left: 0, top: 0, width: 0, height: 0 };
    let r = zero;
    if (!zeroRects) {
      if (this.classList.contains("mf-world__tag")) r = { left: 40 + Number(this.getAttribute("data-seat")) * 100, top: 200, width: 96, height: 40 };
      else if (this.hasAttribute("data-board-chip")) r = { left: 30, top: 100, width: 120, height: 32 };
      else if (this.getAttribute("data-board-face") === "1") r = farFace ? { left: 380, top: -30, width: 68, height: 56 } : { left: 200, top: 220, width: 68, height: 56 };
      // 스포트라이트(18-06): 사회자 띠·[켜기]·[살펴보기]·표지도 잰다
      else if (this.classList.contains("mv-host__band")) r = { left: 16, top: 60, width: 358, height: 64 };
      else if (this.hasAttribute("data-errand-act")) r = { left: 150, top: 500, width: 90, height: 44 };
      else if (this.hasAttribute("data-errand-place") || this.hasAttribute("data-clue-spot")) r = { left: 100, top: 400, width: 64, height: 64 };
    }
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

async function mount(opts: { initialScene: 1 | 2 | 3 | 4 | 5 | 6 | 7 }) {
  const mod = (await import(/* @vite-ignore */ SCREEN_PATH).catch(() => null)) as ScreenModule | null;
  expect(mod, "src/screens/TutorialScreen.tsx 모듈이 있어야 한다").not.toBeNull();
  const onEnd = vi.fn();
  const { TutorialScreen } = mod!;
  const r = render(<TutorialScreen mode="solo" onEnd={onEnd} initialScene={opts.initialScene} />);
  return { ...r, onEnd };
}

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};
const sceneOf = (c: ParentNode): string | null => c.querySelector("[data-tutorial-screen]")?.getAttribute("data-tutorial-scene") ?? null;
const next$ = (c: ParentNode) => c.querySelector<HTMLElement>("[data-tutorial-next]");
const boxes = (c: ParentNode) => [...c.querySelectorAll<HTMLElement>("[data-tutorial-focus]")];
const reveal$ = (c: ParentNode) => c.querySelectorAll("[data-tutorial-reveal]");
const bandText = (c: ParentNode): string | null | undefined => c.querySelector("[data-host-line]")?.textContent;
const plays = (id: string): number => (rig.engine.play as unknown as { mock: { calls: [string][] } }).mock.calls.filter((c) => c[0] === id).length;
const pick = (seat: number): void => {
  act(() => stage.props!.pick!.onPick(seat));
};
const act$ = (c: ParentNode) => c.querySelector<HTMLElement>("[data-errand-act]");
const REDUCED = (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });

// ---- 장면 3: 등불 켜기 ----

describe("장면 3: 등불 켜기 — 가로등 표지·진행 점 0/3·[켜기]", () => {
  it("실제 가로등 표지가 있고(내 등불 셋) 목표 등불 곁이라 [켜기](flame, 글 '켜기')가 서며 진행 점은 0/3 이다", async () => {
    const { container } = await mount({ initialScene: 3 });
    expect(stage.props!.view.phase).toBe("errand");
    expect(stage.props!.view.map).toBe("town");
    const places = [...container.querySelectorAll("[data-errand-place]")].map((el) => el.getAttribute("data-errand-place"));
    expect(places.sort()).toEqual(["lamp1", "lamp2", "lamp3"]);
    expect(stage.props!.errand!.actId).toBe("lamp2");
    expect(stage.props!.errand!.actLook?.label).toBe("켜기");
    expect(act$(container)?.textContent).toBe("켜기");
    expect(container.querySelector("[data-errand-dots]")?.getAttribute("data-errand-progress")).toBe("0/3");
    expect(connection.calls).toBe(0);
  });

  it("사회자 문구는 500ms 에 '등불을 켜 보세요'이고 포커스 상자는 표지 + [켜기] 한 묶음(1개)이다", async () => {
    const { container } = await mount({ initialScene: 3 });
    advance(100);
    expect(boxes(container)).toHaveLength(1);
    expect(bandText(container) ?? "").not.toBe(TUTORIAL_LINES["tutorial.errand"]);
    advance(400);
    expect(bandText(container)).toBe("등불을 켜 보세요");
  });

  it("[켜기] 를 누르면 진행 1/3 이고 0.7초 전에는 3, 뒤에는 장면 4(현장 조사)", async () => {
    const { container } = await mount({ initialScene: 3 });
    fireEvent.click(act$(container)!);
    expect(container.querySelector("[data-errand-dots]")?.getAttribute("data-errand-progress")).toBe("1/3");
    expect(container.querySelector('[data-errand-place="lamp2"]')?.hasAttribute("data-done")).toBe(true);
    advance(699);
    expect(sceneOf(container)).toBe("3");
    advance(1);
    expect(sceneOf(container)).toBe("4");
  });

  it("두 번 눌러도 장면 4 로 한 번만 넘어간다(한 번 켠 뒤 눌림 무시)", async () => {
    const { container } = await mount({ initialScene: 3 });
    fireEvent.click(act$(container)!);
    advance(300);
    act(() => stage.props!.errand!.onAct?.());
    advance(400);
    expect(sceneOf(container)).toBe("4");
    expect(connection.calls).toBe(0);
  });
});

// ---- 장면 4: 현장 조사 ----

describe("장면 4: 현장 조사 — 서연 집 앞 지점 셋·[살펴보기]·단서 카드 '붉은 천 조각'", () => {
  it("아침 단계·현장 집 = 서연(2), 지점 표지 셋(발자국·옷 조각·창문)이 모두 새 지점이고 단서 카드는 아직 없다", async () => {
    const { container } = await mount({ initialScene: 4 });
    expect(stage.props!.view.phase).toBe("morning");
    expect(stage.props!.view.day?.scene).toEqual({ house: 2 });
    const spots = [...container.querySelectorAll("[data-clue-spot]")];
    expect(spots.map((s) => s.getAttribute("data-clue-spot"))).toEqual(["footprint", "cloth", "window"]);
    expect(spots.every((s) => s.getAttribute("data-state") === "new")).toBe(true);
    expect(container.querySelectorAll("[data-clue-card]")).toHaveLength(0);
    expect(next$(container)).toBeNull();
  });

  it("[살펴보기](글) 가 옷 조각 지점에 서고, 포커스 상자는 지점 + 알약 한 묶음, 문구는 500ms 에 '빛나는 곳을 살펴보세요'", async () => {
    const { container } = await mount({ initialScene: 4 });
    expect(stage.props!.clues!.actId).toBe("cloth");
    expect(act$(container)?.textContent).toBe("살펴보기");
    advance(100);
    expect(boxes(container)).toHaveLength(1);
    advance(400);
    expect(bandText(container)).toBe("빛나는 곳을 살펴보세요");
  });

  it("[살펴보기] 를 누르면 단서 카드 한 장('붉은 천 조각')이 뜨고 옷 조각 지점이 done, 그때 [다음] 이 나온다", async () => {
    const { container } = await mount({ initialScene: 4 });
    advance(5000);
    expect(next$(container)).toBeNull();
    fireEvent.click(act$(container)!);
    const cards = container.querySelectorAll("[data-clue-card]");
    expect(cards).toHaveLength(1);
    expect(cards[0]!.getAttribute("data-clue-card")).toBe("cloth");
    expect(cards[0]!.textContent).toBe(TRACE_TEXT.redCloth);
    expect(TRACE_TEXT.redCloth).toBe("붉은 천 조각");
    expect(container.querySelector('[data-clue-spot="cloth"]')?.getAttribute("data-state")).toBe("done");
    expect(plays("tut.eye")).toBe(1);
    expect(next$(container)).not.toBeNull();
    expect(connection.calls).toBe(0);
  });

  it("두 번 눌러도 카드는 한 장이고, [다음] → 장면 5", async () => {
    const { container } = await mount({ initialScene: 4 });
    fireEvent.click(act$(container)!);
    act(() => stage.props!.clues!.onAct?.());
    expect(container.querySelectorAll("[data-clue-card]")).toHaveLength(1);
    expect(plays("tut.eye")).toBe(1);
    fireEvent.click(next$(container)!);
    expect(sceneOf(container)).toBe("5");
  });

  it("도윤이 걸어 들어오는 목격 연출이 없다: 눈 표시·목격 기록 카드·걷기 소리 0", async () => {
    const { container } = await mount({ initialScene: 4 });
    advance(4000);
    expect(container.querySelector("[data-tutorial-eye]")).toBeNull();
    expect(container.querySelector("[data-record-card]")).toBeNull();
    expect(plays("tut.step")).toBe(0);
    expect(stage.props!.store.positionOf(1, NOW + 2000)).toBeNull();
  });
});

// ---- 장면 5: 의심 보드 ----

const links$ = (c: ParentNode) => c.querySelector<SVGElement>("[data-tutorial-links]");

describe("장면 5: 의심 보드 — 실제 보드(칩 하나 + 도윤 얼굴 같은 옷 표시) + 선 하나", () => {
  it("보드 하나: 칩 하나('붉은 천 조각'), 도윤(1) 얼굴만 같은 옷 표시(cloth), 증거 카드·수식 줄·눈 표시는 없다", async () => {
    const { container } = await mount({ initialScene: 5 });
    advance(100);
    expect(stage.props!.view.phase).toBe("discussion");
    expect(container.querySelectorAll("[data-board]")).toHaveLength(1);
    const chips = container.querySelectorAll("[data-board-chip]");
    expect(chips).toHaveLength(1);
    expect(chips[0]!.getAttribute("data-board-chip")).toBe("cloth");
    expect(chips[0]!.textContent).toBe(TRACE_TEXT.redCloth);
    const marked = [...container.querySelectorAll("[data-board-face][data-mark]")];
    expect(marked.map((f) => f.getAttribute("data-board-face"))).toEqual(["1"]);
    expect(marked[0]!.getAttribute("data-mark")).toBe("cloth");
    expect(container.querySelector("[data-trace-card]")).toBeNull();
    expect(container.querySelector("[data-tutorial-formula]")).toBeNull();
    expect(container.querySelector("[data-tutorial-eye]")).toBeNull();
    expect(container.querySelector("[data-board-witness]")).toBeNull();
  });

  it("선은 하나: 칩 아래 가운데 → 도윤 얼굴 위 가운데(redCloth 2.5, 0.4초), aria-hidden", async () => {
    const { container } = await mount({ initialScene: 5 });
    advance(100);
    const svg = links$(container)!;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.style.getPropertyValue("--trace-mark")).toBe(TRACE_MARK.redCloth);
    const paths = svg.querySelectorAll("path");
    expect(paths).toHaveLength(1);
    // 칩 {30,100,120,32} 아래 가운데 (90,132) → 도윤 얼굴 {200,220,68,56} 위 가운데에서 2 위 (234,218)
    expect(paths[0]!.getAttribute("data-from")).toBe("90,132");
    expect(paths[0]!.getAttribute("data-to")).toBe("234,218");
    expect(paths[0]!.classList.contains("is-trace")).toBe(true);
    expect(paths[0]!.getAttribute("stroke-width")).toBe("2.5");
    expect(paths[0]!.getAttribute("pathLength")).toBe("1");
    expect(paths[0]!.style.getPropertyValue("--tut-delay")).toBe("400ms");
  });

  it("끝점을 못 쟀으면(0×0) 선을 그리지 않는다", async () => {
    zeroRects = true;
    const { container } = await mount({ initialScene: 5 });
    advance(100);
    expect(links$(container)).not.toBeNull();
    expect(links$(container)!.querySelectorAll("path")).toHaveLength(0);
  });

  it("tut.link 는 400ms 에 한 번, 문구 '단서와 같은 옷을 이어 보세요'는 900ms 에 나온다, [다음] 은 바로", async () => {
    const { container } = await mount({ initialScene: 5 });
    advance(399);
    expect(plays("tut.link")).toBe(0);
    advance(1);
    expect(plays("tut.link")).toBe(1);
    advance(2000);
    expect(plays("tut.link")).toBe(1);
    expect(bandText(container)).toBe("단서와 같은 옷을 이어 보세요");
    expect(next$(container)).not.toBeNull();
  });

  it("장면 5 밖에는 선이 없다", async () => {
    const { container } = await mount({ initialScene: 6 });
    expect(links$(container)).toBeNull();
  });

  it("모션 줄이기면 선이 완성된 모습이다(CSS)", () => {
    const css = readFileSync(`${ROOT}src/styles/tutorial.css`, "utf8");
    const reduce = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduce).toMatch(/\.tut-links__path\s*\{\s*animation:\s*none;\s*stroke-dashoffset:\s*0/);
  });
});

// ---- 장면 6: 투표 ----

describe("장면 6: 오답(민준·지호·하린)", () => {
  it("처음엔 포커스 상자 4개. 오답이면 buzz 한 번·띠 글이 '단서를 떠올려 보세요'로 바뀌고 띠가 흔들리며 상자 4개 그대로, 공개·[다음] 없음", async () => {
    const { container } = await mount({ initialScene: 6 });
    advance(50);
    expect(boxes(container)).toHaveLength(4);
    pick(0);
    advance(50);
    expect(plays(TUTORIAL_PICK.wrong.sfx)).toBe(1);
    expect(bandText(container)).toBe("단서를 떠올려 보세요");
    expect(container.querySelector(".tut-band")?.classList.contains("is-shake")).toBe(true);
    expect(boxes(container)).toHaveLength(4);
    expect(reveal$(container)).toHaveLength(0);
    expect(next$(container)).toBeNull();
    expect(plays(TUTORIAL_PICK.right.sfx)).toBe(0);
  });

  it(`오답이 ${WRONG_HINT_AFTER}번이 되면 포커스 상자는 도윤 이름표 하나만 남는다`, async () => {
    const { container } = await mount({ initialScene: 6 });
    advance(50);
    pick(0);
    advance(50);
    expect(boxes(container)).toHaveLength(4);
    pick(3);
    advance(50);
    expect(plays(TUTORIAL_PICK.wrong.sfx)).toBe(2);
    const left = boxes(container);
    expect(left).toHaveLength(1);
    // 도윤(seat 1) 이름표 사각형 {140,200,96,40} 둘레 8
    expect(left[0]!.style.left).toBe("132px");
    pick(4);
    advance(50);
    expect(boxes(container)).toHaveLength(1);
    expect(reveal$(container)).toHaveLength(0);
    expect(sceneOf(container)).toBe("6");
  });
});

describe("장면 6: 정답(도윤) — 정체는 뒤집히지 않는다 (D-20)", () => {
  it("stamp 한 번, 위 알림 '나 → 도윤', 실제 득표 경로(day.points)에 한 줄, 포커스 상자 0개", async () => {
    const { container } = await mount({ initialScene: 6 });
    advance(50);
    pick(1);
    advance(50);
    expect(plays(TUTORIAL_PICK.right.sfx)).toBe(1);
    expect(container.querySelector(".mv-toast__text")?.textContent).toBe("나 → 도윤");
    expect(stage.props!.view.day?.points).toEqual([{ seat: 5, target: 1 }]);
    expect(boxes(container)).toHaveLength(0);
    expect(plays(TUTORIAL_PICK.wrong.sfx)).toBe(0);
    expect(connection.calls).toBe(0);
  });

  it("1100ms 전에는 공개 없음, 뒤에는 하나 + [다음] + 소리는 stamp 한 번뿐(fanfare 없음), [다음] → 장면 7", async () => {
    const { container } = await mount({ initialScene: 6 });
    pick(1);
    advance(1099);
    expect(reveal$(container)).toHaveLength(0);
    expect(next$(container)).toBeNull();
    advance(1);
    expect(reveal$(container)).toHaveLength(1);
    expect(next$(container)).not.toBeNull();
    expect(plays("tut.stamp")).toBe(1);
    expect(plays("tut.fanfare")).toBe(0);
    fireEvent.click(next$(container)!);
    expect(sceneOf(container)).toBe("7");
    expect(reveal$(container)).toHaveLength(0);
  });

  it("정체 카드: 뒷면 마름모 + 자물쇠 + '정체는 판이 끝나야 알아요' + 도장 '처형', 직업 이름·직업 그림·'정답'·불꽃이 없다", async () => {
    const { container } = await mount({ initialScene: 6 });
    pick(1);
    advance(1100);
    const root = reveal$(container)[0]!;
    expect(root.querySelector(".tut-reveal__back .mf-card__diamond")).not.toBeNull();
    expect(root.querySelector("[data-reveal-lock] svg")).not.toBeNull();
    expect(root.querySelector("[data-reveal-hidden]")?.textContent).toBe(TUTORIAL_LINES["tutorial.hidden"]);
    expect(root.querySelector("[data-reveal-hidden]")?.textContent).toBe("정체는 판이 끝나야 알아요");
    expect(root.querySelector(".tut-reveal__stamp")?.textContent).toBe("처형");
    expect(root.querySelector(".tut-reveal__stamp")?.getAttribute("aria-hidden")).toBe("true");
    const text = root.textContent ?? "";
    for (const bad of ["마피아", "시민", "의사", "경찰", "정답", "찾아냈어요"]) expect(text, bad).not.toContain(bad);
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelectorAll(".tut-reveal__spark")).toHaveLength(0);
    expect(root.querySelector(".is-flip")).toBeNull();
  });

  it("정답 뒤 다시 이름표를 눌러도 아무 일 없다(stamp·buzz 추가 0)", async () => {
    const { container } = await mount({ initialScene: 6 });
    pick(1);
    advance(300);
    pick(0);
    pick(3);
    advance(2000);
    expect(plays(TUTORIAL_PICK.right.sfx)).toBe(1);
    expect(plays(TUTORIAL_PICK.wrong.sfx)).toBe(0);
    expect(sceneOf(container)).toBe("6");
    expect(reveal$(container)).toHaveLength(1);
  });

  it("장면 6 에 다시 들어오면 공개·정답 상태가 깨끗하다(장면 번호에 묶인 상태)", async () => {
    const { container } = await mount({ initialScene: 6 });
    pick(1);
    advance(1100);
    fireEvent.click(next$(container)!);
    expect(sceneOf(container)).toBe("7");
    expect(reveal$(container)).toHaveLength(0);
    expect(container.querySelector(".mv-toast--top.is-on")).toBeNull();
  });
});

describe("장면 6: 모션 줄이기", () => {
  it("정체 카드의 도장 애니메이션이 없고 도장은 제자리", async () => {
    vi.stubGlobal("matchMedia", REDUCED);
    const { container } = await mount({ initialScene: 6 });
    pick(1);
    advance(1100);
    const root = reveal$(container)[0]!;
    expect(root.querySelector(".is-pop")).toBeNull();
    expect(root.querySelector(".tut-reveal__stamp")).not.toBeNull();
  });
});

describe("진홍 예약 (T-18)", () => {
  it("정체 카드에는 진홍이 없다(마피아 이름·그림을 보이지 않는다) — 진홍은 오프닝·직업 카드 연출에만 남는다", () => {
    const css = readFileSync(`${ROOT}src/styles/tutorial.css`, "utf8");
    expect(css).toMatch(/\.tut-reveal__card\s*\{/);
    const reveal = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/\.tut-reveal[\w-]*[^{]*\{[^}]*\}/g) ?? [];
    expect(reveal.length).toBeGreaterThan(0);
    for (const rule of reveal) expect(rule, rule).not.toContain("--crimson-");
    const head = readFileSync(`${ROOT}src/styles/phase.css`, "utf8").split("\n").slice(0, 12).join("\n");
    expect(head).toMatch(/오프닝 비명/);
    expect(head).not.toMatch(/정체 공개/);
  });
});

// ---- 스포트라이트·[다음] ----

describe("스포트라이트 구간 (P18-5, D-04)", () => {
  const dim$ = (c: ParentNode) => c.querySelectorAll("[data-tutorial-dim]").length;
  const hole$ = (c: ParentNode) => c.querySelectorAll("[data-tutorial-hole]").length;

  it("장면 2: 띠 창(0~2.6초)에만 1개, [다음] 뒤 0개", async () => {
    const { container } = await mount({ initialScene: 2 });
    advance(100);
    expect(dim$(container)).toBe(1);
    advance(2500);
    advance(50);
    expect(next$(container)).not.toBeNull();
    expect(dim$(container)).toBe(0);
  });

  it("장면 3: 가로등 표지 + [켜기] 구간에 1개", async () => {
    const { container } = await mount({ initialScene: 3 });
    advance(100);
    expect(dim$(container)).toBe(1);
  });

  it("장면 4: 옷 조각 지점 + [살펴보기] 구간에 1개, 살핀 뒤([다음] 이 나온 뒤)에는 0개", async () => {
    const { container } = await mount({ initialScene: 4 });
    advance(100);
    expect(dim$(container)).toBe(1);
    expect(hole$(container)).toBe(1);
    fireEvent.click(act$(container)!);
    advance(50);
    expect(next$(container)).not.toBeNull();
    expect(dim$(container)).toBe(0);
  });

  it("장면 5·7 은 시종 0개", async () => {
    for (const n of [5, 7] as const) {
      const { container, unmount } = await mount({ initialScene: n });
      advance(100);
      expect(dim$(container)).toBe(0);
      advance(5000);
      expect(dim$(container)).toBe(0);
      unmount();
    }
  });

  it("장면 6: 처음 구멍 4개(막 1개), 정답을 누른 뒤 0개", async () => {
    const { container } = await mount({ initialScene: 6 });
    advance(50);
    expect(dim$(container)).toBe(1);
    expect(hole$(container)).toBe(4);
    pick(1);
    advance(50);
    expect(dim$(container)).toBe(0);
  });
});

describe("[다음] 알약 (P18-6, D-05)", () => {
  const css = readFileSync(`${ROOT}src/styles/tutorial.css`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = (head: string): string => {
    const start = css.indexOf(head);
    return start < 0 ? "" : css.slice(start, css.indexOf("}", start) + 1);
  };
  const has = (body: string, re: RegExp): boolean => re.test(body);

  it("버튼: data-tutorial-next·aria-label 다음·라벨 글 다음·chevronRight svg 하나(20)", async () => {
    const { container } = await mount({ initialScene: 2 });
    advance(2600);
    advance(50);
    const btn = next$(container)!;
    expect(btn === null).toBe(false);
    expect(btn.getAttribute("aria-label")).toBe("다음");
    expect(btn.querySelector(".tut-next__label")?.textContent === "다음").toBe(true);
    expect(btn.querySelectorAll("svg").length).toBe(1);
    expect(btn.querySelector("svg")?.getAttribute("width") === "20").toBe(true);
  });

  it(".tut-next 규칙: 아래 가운데 알약 240×56, transform 없음", () => {
    const body = rule(".tut-next {");
    expect(has(body, /bottom:\s*28px/)).toBe(true);
    expect(has(body, /height:\s*56px/)).toBe(true);
    expect(has(body, /width:\s*min\(240px,\s*calc\(100% - 48px\)\)/)).toBe(true);
    expect(has(body, /margin-inline:\s*auto/)).toBe(true);
    expect(has(body, /left:\s*0/)).toBe(true);
    expect(has(body, /right:\s*0/)).toBe(true);
    expect(has(body, /border-radius:\s*var\(--radius-pill\)/)).toBe(true);
    expect(has(body, /transform/)).toBe(false);
  });

  it("테두리는 알약을 따라가고, 모션 줄이기에서 애니메이션 없음, 장면 4 진행 점 숨김 규칙", () => {
    expect(has(rule(".tut-next::before {"), /border-radius:\s*inherit/)).toBe(true);
    const reduce = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(has(reduce, /\.tut-next\s*\{\s*animation:\s*none/)).toBe(true);
    expect(css.includes("[data-tutorial-screen]:has([data-tutorial-next]) .mv-errand-dots { display: none; }")).toBe(true);
  });
});

describe("장면 5 선이 화면 안에서 끝난다 (D-07)", () => {
  const link = async (): Promise<{ clampPoint: (p: readonly [number, number], w: number, h: number, inset?: number) => [number, number] }> =>
    (await import("../../src/components/v2/TutorialEvidence")) as never;

  it("clampPoint: 안쪽 8 로 고정, 안이면 그대로", async () => {
    const { clampPoint } = await link();
    expect(clampPoint([-20, 5], 390, 844).join(",") === "8,8").toBe(true);
    expect(clampPoint([400, 900], 390, 844).join(",") === "382,836").toBe(true);
    expect(clampPoint([100, 200], 390, 844).join(",") === "100,200").toBe(true);
  });

  it("도윤 얼굴이 화면 오른쪽 위 밖이어도 선의 좌표가 [8, 폭-8]×[8, 높이-8] 안이다", async () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 844 });
    try {
      farFace = true;
      const { container } = await mount({ initialScene: 5 });
      advance(100);
      const paths = [...links$(container)!.querySelectorAll("path")];
      expect(paths.length).toBe(1);
      for (const path of paths) {
        for (const attr of ["data-from", "data-to"]) {
          const [x, y] = path.getAttribute(attr)!.split(",").map(Number) as [number, number];
          expect(x >= 8 && x <= 382 && y >= 8 && y <= 836).toBe(true);
        }
      }
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: w });
      Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: h });
    }
  });

  it(".tut-links 규칙에 overflow hidden", () => {
    const css = readFileSync(`${ROOT}src/styles/tutorial.css`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const start = css.indexOf(".tut-links {");
    expect(/overflow:\s*hidden/.test(css.slice(start, css.indexOf("}", start)))).toBe(true);
  });
});

// ---- 장면 7 직업 카드 줄·장면 8 마무리·기다림 글 ----

describe("장면 7 직업 카드 줄 (D-28): 고정 상수, 길게 누르기 줄 없음", () => {
  it("시민 '단서로 마피아를 찾아요' · 마피아 '밤에 집 하나를 골라요' · 의사 '밤에 한 집을 지켜요' · 경찰 그대로, 아래 줄 그대로", async () => {
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 844 });
    const { container } = await mount({ initialScene: 7 });
    const line = (kind: string): string => container.querySelector(`[data-tutorial-role-card="${kind}"] .tut-role__line`)?.textContent ?? "";
    expect(line("citizen")).toBe("단서로 마피아를 찾아요");
    expect(line("mafia")).toBe("밤에 집 하나를 골라요");
    expect(line("doctor")).toBe("밤에 한 집을 지켜요");
    expect(line("police")).toBe("의심되는 사람을 조사하세요.");
    expect(container.textContent).not.toContain("길게 누르면");
    expect(container.querySelector(".tut-roles__foot")?.textContent).toBe("낮에는 모두 함께 투표해요");
  });
});
