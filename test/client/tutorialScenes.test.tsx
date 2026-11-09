// 17-05: 첫 사건 장면 4·5·6 연출 — 장면 6 투표(도장·위 알림·득표 배지 → 정체 공개, 오답 도움), (Task 2) 장면 4 목격·장면 5 증거 (TUT-03, TUT-04, 결정 0078-1, T-8·T-11·T-18).
// WorldStage 는 props 를 쥐는 가짜(test/helpers/fakeTutorialStage), GameMap·RecordCard·EvidenceCard·TopToast 는 진짜다.
// 이름표 사각형은 getBoundingClientRect 를 모킹해 FocusRing 이 상자를 그리게 한다(jsdom 은 늘 0×0).
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { setEngineForTest } from "../../src/audio/unlock";
import { SUSPECT_WALK, TUTORIAL_LINES, TUTORIAL_PICK, WRONG_HINT_AFTER } from "../../src/game/tutorialScript";
import { TRACE_MARK } from "../../src/game/traceMark";
import { tutorialStage as stage } from "../helpers/fakeTutorialStage";
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

let rig: ReturnType<typeof makeRig>;
let zeroRects = false;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  connection.calls = 0;
  rig = makeRig();
  vi.spyOn(rig.engine, "play").mockImplementation(() => {});
  vi.spyOn(rig.engine, "runScript").mockImplementation(() => {});
  setEngineForTest(rig.engine);
  // 사각형: 이름표는 좌석마다 다른 자리의 96×40, 증거 카드의 조각 타일·목격 행 도윤 이름은 고정 사각형. 그 밖의 요소는 0×0 (zeroRects 면 전부 0×0)
  zeroRects = false;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const zero = { left: 0, top: 0, width: 0, height: 0 };
    let r = zero;
    if (!zeroRects) {
      if (this.classList.contains("mf-world__tag")) r = { left: 40 + Number(this.getAttribute("data-seat")) * 100, top: 200, width: 96, height: 40 };
      else if (this.classList.contains("mv-trace__disc")) r = { left: 30, top: 100, width: 44, height: 44 };
      else if (this.classList.contains("mv-evidence__witness")) r = { left: 150, top: 170, width: 40, height: 24 };
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

describe("장면 6: 오답(민준·지호·하린)", () => {
  it("처음엔 포커스 상자 4개. 오답이면 buzz 한 번·띠 글이 바뀌고 띠가 흔들리며 상자 4개 그대로, 공개·[다음] 없음", async () => {
    const { container } = await mount({ initialScene: 6 });
    advance(50);
    expect(boxes(container)).toHaveLength(4);
    pick(0);
    advance(50);
    expect(plays(TUTORIAL_PICK.wrong.sfx)).toBe(1);
    expect(bandText(container)).toBe(TUTORIAL_LINES["tutorial.vote.wrong"]);
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

describe("장면 6: 정답(도윤)", () => {
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

  it("1100ms 전에는 공개 없음, 뒤에는 하나 + fanfare 한 번 + [다음], [다음] → 장면 7", async () => {
    const { container } = await mount({ initialScene: 6 });
    pick(1);
    advance(1099);
    expect(reveal$(container)).toHaveLength(0);
    expect(plays(TUTORIAL_PICK.reveal.sfx)).toBe(0);
    expect(next$(container)).toBeNull();
    advance(1);
    expect(reveal$(container)).toHaveLength(1);
    expect(plays(TUTORIAL_PICK.reveal.sfx)).toBe(1);
    expect(next$(container)).not.toBeNull();
    const text = reveal$(container)[0]!.textContent ?? "";
    for (const part of ["도윤 님은", "마피아", "정답", "로 찾아냈어요"]) expect(text, part).toContain(part);
    // 다음은 막 바깥(눌림이 막에 막히지 않게)에서 눌린다
    fireEvent.click(next$(container)!);
    expect(sceneOf(container)).toBe("7");
    expect(reveal$(container)).toHaveLength(0);
  });

  it("공개 카드: 마피아 그림은 장식(alt 빈 값), 불꽃 점 14개·도장·선 아이콘 줄은 aria-hidden", async () => {
    const { container } = await mount({ initialScene: 6 });
    pick(1);
    advance(1100);
    const root = reveal$(container)[0]!;
    const img = root.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("");
    expect(img?.getAttribute("src") ?? "").toContain("mafia");
    expect(root.querySelectorAll(".tut-reveal__spark")).toHaveLength(14);
    expect(root.querySelector(".tut-reveal__sparks")?.getAttribute("aria-hidden")).toBe("true");
    expect(root.querySelector(".tut-reveal__stamp")?.getAttribute("aria-hidden")).toBe("true");
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
  it("공개 카드에 뒤집기·불꽃·도장 애니메이션이 없고 도장은 제자리", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
    const { container } = await mount({ initialScene: 6 });
    pick(1);
    advance(1100);
    const root = reveal$(container)[0]!;
    expect(root.querySelector(".is-flip")).toBeNull();
    expect(root.querySelector(".is-pop")).toBeNull();
    expect(root.querySelectorAll(".tut-reveal__spark")).toHaveLength(0);
    expect(root.querySelector(".tut-reveal__stamp")).not.toBeNull();
  });
});

describe("진홍 예약 (T-18)", () => {
  it("tutorial.css 에 .tut-reveal 규칙이 있고, phase.css 머리 주석에 튜토리얼 진홍 예약 두 항목이 있다", () => {
    const css = readFileSync(`${ROOT}src/styles/tutorial.css`, "utf8");
    expect(css).toMatch(/\.tut-reveal__card\s*\{/);
    expect(css).toMatch(/\.tut-reveal__title\s*\{[^}]*--crimson-300/);
    const head = readFileSync(`${ROOT}src/styles/phase.css`, "utf8").split("\n").slice(0, 12).join("\n");
    const lines = head.split("\n").filter((l) => l.includes("튜토리얼"));
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(head).toMatch(/오프닝 비명/);
    expect(head).toMatch(/정체 공개/);
  });
});

// ---- Task 2: 장면 4 목격 · 장면 5 증거 ----

const eye$ = (c: ParentNode) => c.querySelectorAll<HTMLElement>("[data-tutorial-eye]");
const links$ = (c: ParentNode) => c.querySelector<SVGElement>("[data-tutorial-links]");
const formula$ = (c: ParentNode) => c.querySelector<HTMLElement>("[data-tutorial-formula]");
const REDUCED = (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });

describe("장면 4: 목격 — 도윤이 걸어 들어오고 1.9초에 눈 표시와 실제 기록 카드", () => {
  it("시작 때 도윤(1)의 걷기 구간이 로컬 store 에 든다: 처음은 오른쪽 밖 시작점, 2초 뒤는 끝점 근처", async () => {
    await mount({ initialScene: 4 });
    const store = stage.props!.store;
    const t0 = store.positionOf(1, NOW)!;
    const t1 = store.positionOf(1, NOW + 2000)!;
    expect(Math.hypot(t0.x - SUSPECT_WALK.from.x, t0.z - SUSPECT_WALK.from.z)).toBeLessThan(0.3);
    expect(Math.hypot(t1.x - SUSPECT_WALK.to.x, t1.z - SUSPECT_WALK.to.z)).toBeLessThan(0.3);
  });

  it("1900ms 전 눈 표시·기록 카드 없음, 뒤에 눈 하나 + tut.eye 한 번 + 도윤·가로등 한 줄(실제 RecordCard)", async () => {
    const { container } = await mount({ initialScene: 4 });
    advance(1899);
    expect(eye$(container)).toHaveLength(0);
    expect(container.querySelector("[data-record-card]")).toBeNull();
    expect(plays("tut.eye")).toBe(0);
    advance(1);
    expect(eye$(container)).toHaveLength(1);
    expect(plays("tut.eye")).toBe(1);
    const card = container.querySelector("[data-record-card]");
    expect(card).not.toBeNull();
    expect(card!.getAttribute("data-record-rows")).toBe("1");
    const row = card!.querySelector("[data-record-row]")!;
    expect(row.querySelector(".mv-record__name")?.textContent).toBe("도윤");
    expect(row.querySelector(".mv-record__face")).not.toBeNull();
    expect(row.querySelector("svg[aria-label], svg")).not.toBeNull();
  });

  it("눈 표시는 도윤 이름표 위 36 원(중심 정렬)이고 읽히지 않는다", async () => {
    const { container } = await mount({ initialScene: 4 });
    advance(1900);
    advance(50);
    const eye = eye$(container)[0]!;
    // 도윤 이름표 {140,200,96,40}: 가운데 188 → left 188 - 18 = 170, 이름표 위 4 띄워 top 200 - 36 - 4 = 160
    expect(eye.style.left).toBe("170px");
    expect(eye.style.top).toBe("160px");
    expect(eye.getAttribute("aria-hidden")).toBe("true");
    expect(eye.querySelector("svg")).not.toBeNull();
  });

  it("기록 카드의 닫기 단추는 inert 아래라 눌리지 않는다", async () => {
    const { container } = await mount({ initialScene: 4 });
    advance(1900);
    const close = container.querySelector<HTMLElement>("[data-record-card] button[aria-label='닫기']")!;
    expect(close.closest("[inert]")).not.toBeNull();
  });

  it("[다음] 은 3400ms 에 그대로 나온다", async () => {
    const { container } = await mount({ initialScene: 4 });
    advance(3399);
    expect(next$(container)).toBeNull();
    advance(1);
    expect(next$(container)).not.toBeNull();
  });

  it("모션 줄이기면 도윤이 처음부터 끝점에 서 있다(걷기 구간 없음)", async () => {
    vi.stubGlobal("matchMedia", REDUCED);
    await mount({ initialScene: 4 });
    const store = stage.props!.store;
    const t0 = store.positionOf(1, NOW)!;
    expect(Math.hypot(t0.x - SUSPECT_WALK.to.x, t0.z - SUSPECT_WALK.to.z)).toBeLessThan(0.1);
  });
});

describe("장면 5: 증거 — 실제 증거 카드 + 선 두 개 + 수식 줄", () => {
  it("GameMap 이 받은 view 로 실제 증거 카드가 보인다", async () => {
    const { container } = await mount({ initialScene: 5 });
    advance(100);
    expect(container.querySelector("[data-trace-card]")).not.toBeNull();
    expect(container.querySelector("[data-lastseen-row] .mv-evidence__witness")?.textContent).toBe("도윤");
  });

  it("선 두 개: 조각 타일 중심 → 도윤 이름표(redCloth 2.5, 0.4초), 목격 행 도윤 → 도윤 이름표(brass-200 2, 0.9초), aria-hidden", async () => {
    const { container } = await mount({ initialScene: 5 });
    advance(100);
    const svg = links$(container)!;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.style.getPropertyValue("--trace-mark")).toBe(TRACE_MARK.redCloth);
    const paths = svg.querySelectorAll("path");
    expect(paths).toHaveLength(2);
    // 조각 타일 {30,100,44,44} 중심 (52,122) → 도윤 이름표 {140,200,96,40} 위 가장자리 30% 지점
    expect(paths[0]!.getAttribute("data-from")).toBe("52,122");
    expect(paths[0]!.getAttribute("data-to")).toBe("168.8,198");
    expect(paths[0]!.classList.contains("is-trace")).toBe(true);
    expect(paths[0]!.getAttribute("stroke-width")).toBe("2.5");
    expect(paths[0]!.style.getPropertyValue("--tut-delay")).toBe("400ms");
    // 목격 행 도윤 이름 {150,170,40,24} 중심 (170,182) → 같은 이름표 70% 지점
    expect(paths[1]!.getAttribute("data-from")).toBe("170,182");
    expect(paths[1]!.getAttribute("data-to")).toBe("207.2,198");
    expect(paths[1]!.classList.contains("is-seen")).toBe(true);
    expect(paths[1]!.getAttribute("stroke-width")).toBe("2");
    expect(paths[1]!.style.getPropertyValue("--tut-delay")).toBe("900ms");
    for (const path of paths) expect(path.getAttribute("pathLength")).toBe("1");
  });

  it("끝점을 못 쟀으면(0×0) 선을 그리지 않는다", async () => {
    zeroRects = true;
    const { container } = await mount({ initialScene: 5 });
    advance(100);
    expect(links$(container)).not.toBeNull();
    expect(links$(container)!.querySelectorAll("path")).toHaveLength(0);
  });

  it("tut.link 가 400·900ms 에 한 번씩", async () => {
    await mount({ initialScene: 5 });
    advance(399);
    expect(plays("tut.link")).toBe(0);
    advance(1);
    expect(plays("tut.link")).toBe(1);
    advance(499);
    expect(plays("tut.link")).toBe(1);
    advance(1);
    expect(plays("tut.link")).toBe(2);
  });

  it("수식 줄: 눈·흔적 원 둘 + '+' + '=' + 손 아이콘의 '의심' 알약, 1.6초 지연", async () => {
    const { container } = await mount({ initialScene: 5 });
    const f = formula$(container)!;
    expect(f).not.toBeNull();
    expect(f.querySelectorAll(".tut-formula__disc")).toHaveLength(2);
    expect(f.querySelector(".tut-formula__disc svg")).not.toBeNull();
    expect(f.textContent).toContain("+");
    expect(f.textContent).toContain("=");
    const pill = f.querySelector(".tut-formula__pill")!;
    expect(pill.textContent).toBe("의심");
    expect(pill.querySelector("svg")).not.toBeNull();
    expect(f.style.getPropertyValue("--tut-delay")).toBe("1600ms");
  });

  it("수식 줄 아랫변이 [다음] 윗변 - 12 위에 있다(tutorial.css 값으로 계산)", () => {
    const css = readFileSync(`${ROOT}src/styles/tutorial.css`, "utf8");
    const rule = (sel: string): string => css.match(new RegExp(`${sel.replace(".", "\\.")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
    const px = (body: string, prop: string): number => Number(body.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*(\\d+)px`))?.[1]);
    const next = rule(".tut-next");
    const formula = rule(".tut-formula");
    const nextTop = px(next, "bottom") + px(next, "height");
    expect(px(formula, "bottom")).toBeGreaterThanOrEqual(nextTop + 12);
  });

  it("장면 5 밖에는 선·수식이 없다", async () => {
    const { container } = await mount({ initialScene: 6 });
    expect(links$(container)).toBeNull();
    expect(formula$(container)).toBeNull();
  });
});
