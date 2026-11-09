// 17-05: 첫 사건 장면 4·5·6 연출 — 장면 6 투표(도장·위 알림·득표 배지 → 정체 공개, 오답 도움), (Task 2) 장면 4 목격·장면 5 증거 (TUT-03, TUT-04, 결정 0078-1, T-8·T-11·T-18).
// WorldStage 는 props 를 쥐는 가짜(test/helpers/fakeTutorialStage), GameMap·RecordCard·EvidenceCard·TopToast 는 진짜다.
// 이름표 사각형은 getBoundingClientRect 를 모킹해 FocusRing 이 상자를 그리게 한다(jsdom 은 늘 0×0).
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { setEngineForTest } from "../../src/audio/unlock";
import { TUTORIAL_LINES, TUTORIAL_PICK, WRONG_HINT_AFTER } from "../../src/game/tutorialScript";
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

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  connection.calls = 0;
  rig = makeRig();
  vi.spyOn(rig.engine, "play").mockImplementation(() => {});
  vi.spyOn(rig.engine, "runScript").mockImplementation(() => {});
  setEngineForTest(rig.engine);
  // 이름표 사각형: 좌석마다 다른 자리의 96×40. 그 밖의 요소는 0×0
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const isTag = this.classList.contains("mf-world__tag");
    const seat = isTag ? Number(this.getAttribute("data-seat")) : 0;
    const r = isTag ? { left: 40 + seat * 100, top: 200, width: 96, height: 40 } : { left: 0, top: 0, width: 0, height: 0 };
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
