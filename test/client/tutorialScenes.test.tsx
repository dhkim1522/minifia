// 17-05 → 21-15: 첫 사건 장면 4·5·6 연출 — 장면 6 투표(도장·위 알림·득표 배지 → 처형 결과, 오답 도움), 장면 4 집 찾기·장면 5 현장 + 의심 보드 (TUT-03, TUT-04, 결정 0078-1, D-20·D-28, T-8·T-21-35).
// WorldStage 는 props 를 쥐는 가짜(test/helpers/fakeTutorialStage), GameMap·SceneDock·HousePick·ClueSpot·SuspectBoard·TopToast 는 진짜다.
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
let fetchCalls = vi.fn();
const fetchSpy$ = (): number => fetchCalls.mock.calls.length;
let zeroRects = false;
let farTag = false;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  connection.calls = 0;
  fetchCalls = vi.fn(() => Promise.reject(new Error("튜토리얼은 fetch 를 부르지 않는다")));
  vi.stubGlobal("fetch", fetchCalls);
  rig = makeRig();
  vi.spyOn(rig.engine, "play").mockImplementation(() => {});
  vi.spyOn(rig.engine, "runScript").mockImplementation(() => {});
  setEngineForTest(rig.engine);
  // 사각형: 이름표는 좌석마다 다른 자리의 96×40, 그 밖에 아래 줄에 적은 요소만 고정 사각형이고 나머지는 0×0 (zeroRects 면 전부 0×0)
  zeroRects = false;
  farTag = false;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const zero = { left: 0, top: 0, width: 0, height: 0 };
    let r = zero;
    if (!zeroRects) {
      if (farTag && this.classList.contains("mf-world__tag") && this.getAttribute("data-seat") === "1") r = { left: 380, top: -30, width: 80, height: 40 };
      else if (this.classList.contains("mf-world__tag")) r = { left: 40 + Number(this.getAttribute("data-seat")) * 100, top: 200, width: 96, height: 40 };
      // 스포트라이트(18-06): 사회자 띠·[켜기]·집 판·[살펴보기]·보드 얼굴도 잰다
      else if (this.classList.contains("mv-host__band")) r = { left: 16, top: 60, width: 358, height: 64 };
      else if (this.hasAttribute("data-errand-act") || this.hasAttribute("data-scene-act")) r = { left: 150, top: 500, width: 90, height: 44 };
      else if (this.hasAttribute("data-errand-place")) r = { left: 60, top: 300, width: 64, height: 64 };
      else if (this.hasAttribute("data-house-pick")) r = { left: 20 + Number(this.getAttribute("data-house-pick")) * 60, top: 320, width: 52, height: 52 };
      else if (this.hasAttribute("data-clue-spot")) r = { left: 200, top: 340, width: 52, height: 52 };
      else if (this.hasAttribute("data-board-face")) r = { left: 16 + Number(this.getAttribute("data-board-face")) * 80, top: 200, width: 77, height: 64 };
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
    // 처형 결과: 도윤의 이름과 '처형' 뿐 — 정체(마피아)·정답 도장·찾아냈다는 글은 없다(D-20)
    const text = reveal$(container)[0]!.textContent ?? "";
    for (const part of ["도윤", "처형"]) expect(text, part).toContain(part);
    for (const part of ["마피아", "정답", "찾아냈어요"]) expect(text, part).not.toContain(part);
    // 다음은 막 바깥(눌림이 막에 막히지 않게)에서 눌린다
    fireEvent.click(next$(container)!);
    expect(sceneOf(container)).toBe("7");
    expect(reveal$(container)).toHaveLength(0);
  });

  it("처형 결과 카드: 도윤 얼굴은 장식(alt 빈 값), 잠금 아이콘은 aria-hidden, 직업 그림·불꽃·도장은 없다", async () => {
    const { container } = await mount({ initialScene: 6 });
    pick(1);
    advance(1100);
    const root = reveal$(container)[0]!;
    const img = root.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("");
    expect(img?.getAttribute("src") ?? "").toContain("faces");
    expect(img?.getAttribute("src") ?? "").not.toContain("roles");
    expect(root.querySelector(".tut-reveal__lock")?.getAttribute("aria-hidden")).toBe("true");
    expect(root.querySelectorAll(".tut-reveal__spark")).toHaveLength(0);
    expect(root.querySelector(".tut-reveal__stamp")).toBeNull();
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
  it("처형 결과 카드에 애니메이션 클래스(뒤집기·도장)가 없다", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
    const { container } = await mount({ initialScene: 6 });
    pick(1);
    advance(1100);
    const root = reveal$(container)[0]!;
    expect(root.querySelector(".is-flip")).toBeNull();
    expect(root.querySelector(".is-pop")).toBeNull();
    expect(root.querySelector(".tut-reveal__card")).not.toBeNull();
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

// ---- 21-15: 장면 4 집 찾기 · 장면 5 현장 + 의심 보드 ----

const REDUCED = (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
const dockLamp$ = (c: ParentNode) => c.querySelector<HTMLElement>("[data-scene-dock] [data-errand-act]");
const houses$ = (c: ParentNode) => [...c.querySelectorAll<HTMLElement>("button[data-house-pick]")];
const house$ = (c: ParentNode, seat: number) => c.querySelector<HTMLElement>(`button[data-house-pick="${seat}"]`);
const inspect$ = (c: ParentNode) => c.querySelector<HTMLElement>("[data-scene-dock] [data-scene-act]");
const spot$ = (c: ParentNode, spot: number) => c.querySelector<HTMLElement>(`[data-clue-spot="${spot}"]`);
const board$ = (c: ParentNode) => c.querySelector<HTMLElement>("[data-suspect-board]");
const faces$ = (c: ParentNode) => [...c.querySelectorAll<HTMLElement>("[data-board-face]")];

describe("장면 3: 저녁 등불 — 실제 독과 가로등", () => {
  it("가로등 셋(lamp5·lamp6·lamp4) 타일과 독 [켜기](불꽃 아이콘·'켜기')가 있고 서연 집 가로등은 없다", async () => {
    const { container } = await mount({ initialScene: 3 });
    const ids = [...container.querySelectorAll("button[data-errand-place]")].map((b) => b.getAttribute("data-errand-place")).sort();
    expect(ids).toEqual(["lamp4", "lamp5", "lamp6"]);
    expect(dockLamp$(container)!.textContent).toContain("켜기");
    expect(dockLamp$(container)!.closest("[inert]")).toBeNull();
  });

  it("[켜기] 를 누르면 lamp5 타일에 불꽃 배지(data-done)가 서고 서버 연결·fetch 는 0번", async () => {
    const { container } = await mount({ initialScene: 3 });
    expect(container.querySelector('button[data-errand-place="lamp5"]')?.hasAttribute("data-done")).toBe(false);
    fireEvent.click(dockLamp$(container)!);
    expect(container.querySelector('button[data-errand-place="lamp5"]')?.hasAttribute("data-done")).toBe(true);
    expect(container.querySelector('button[data-errand-place="lamp5"] .mv-errand-pin__badge')).not.toBeNull();
    expect(connection.calls).toBe(0);
  });

  it("독의 [건너뛰기](단계 건너뛰기)는 inert 이고 눌러도 아무 일 없다", async () => {
    const { container } = await mount({ initialScene: 3 });
    const skipPhase = container.querySelector<HTMLElement>("[data-skip-phase]")!;
    expect(skipPhase.closest("[inert]")).not.toBeNull();
    fireEvent.click(skipPhase);
    advance(3000);
    expect(sceneOf(container)).toBe("3");
  });
});

describe("장면 4: 밤 집 찾기 — 집 판 6 에서 아무 집이나", () => {
  it("집 판 여섯, 아무것도 안 눌린 상태, 안내 줄은 범례('불 켜진 창'·'꺼진 창'), inert 아래가 아니다", async () => {
    const { container } = await mount({ initialScene: 4 });
    const plates = houses$(container);
    expect(plates).toHaveLength(6);
    for (const p of plates) {
      expect(p.getAttribute("aria-pressed")).toBe("false");
      expect(p.closest("[inert]")).toBeNull();
    }
    expect(plates.map((p) => p.getAttribute("data-house-pick"))).toEqual(["0", "1", "2", "3", "4", "5"]);
    expect(container.querySelector('[data-house-pick="5"]')?.getAttribute("data-me")).toBe("true");
    expect(container.querySelector("[data-dock-guide]")?.textContent).toContain("불 켜진 창");
    expect(container.textContent).not.toContain("고른 집은 바꿀 수 있어요");
    expect(next$(container)).toBeNull();
  });

  it("집 하나를 누르면 그 집만 눌림(aria-pressed)이고 '고른 집은 바꿀 수 있어요' 한 줄이 나오며 서버로는 아무것도 안 나간다", async () => {
    const { container } = await mount({ initialScene: 4 });
    fireEvent.click(house$(container, 3)!);
    expect(house$(container, 3)!.getAttribute("aria-pressed")).toBe("true");
    expect(houses$(container).filter((p) => p.getAttribute("aria-pressed") === "true")).toHaveLength(1);
    expect(container.querySelector("[data-dock-guide]")?.textContent).toBe("고른 집은 바꿀 수 있어요");
    expect(stage.props!.view.me.pick).toBe(3);
    expect(connection.calls).toBe(0);
    expect(fetchSpy$()).toBe(0);
  });

  it("다른 집을 누르면 바뀐다(바꿀 수 있어요)", async () => {
    const { container } = await mount({ initialScene: 4 });
    fireEvent.click(house$(container, 3)!);
    fireEvent.click(house$(container, 1)!);
    expect(house$(container, 1)!.getAttribute("aria-pressed")).toBe("true");
    expect(house$(container, 3)!.getAttribute("aria-pressed")).toBe("false");
    expect(stage.props!.view.me.pick).toBe(1);
  });

  it("포커스 상자는 집 판 여섯 곳에 서고 하나 누르면 꺼진다, [다음] 은 누른 뒤 0.7초에", async () => {
    const { container } = await mount({ initialScene: 4 });
    advance(100);
    expect(boxes(container)).toHaveLength(6);
    fireEvent.click(house$(container, 2)!);
    advance(50);
    expect(boxes(container)).toHaveLength(0);
    advance(649);
    expect(next$(container)).toBeNull();
    advance(1);
    expect(next$(container)).not.toBeNull();
  });

  it("[다음] 을 누르면 장면 5", async () => {
    const { container } = await mount({ initialScene: 4 });
    fireEvent.click(house$(container, 0)!);
    advance(700);
    fireEvent.click(next$(container)!);
    expect(sceneOf(container)).toBe("5");
  });

  it("밤 독의 [쪽지]/[유언] 줄은 inert 라 눌리지 않는다", async () => {
    const { container } = await mount({ initialScene: 4 });
    const actions = container.querySelector("[data-dock-actions]")!;
    expect(actions.closest("[inert]")).not.toBeNull();
  });
});

describe("장면 5: 현장 + 의심 보드 — 지점 ② 에서 붉은 천 조각 → 도윤 칸 같은 옷 표시", () => {
  it("현장 지점 셋, 지점 ② 만 눌러 볼 수 있는 처음 모양, [살펴보기] 활성, 카드·보드 없음", async () => {
    const { container } = await mount({ initialScene: 5 });
    expect(spot$(container, 1)).not.toBeNull();
    expect(spot$(container, 2)!.getAttribute("data-state")).toBe("fresh");
    expect(spot$(container, 2)!.getAttribute("aria-label")).toBe("옷 조각 살펴보기");
    expect(inspect$(container)!.getAttribute("aria-disabled")).toBeNull();
    expect(container.querySelector("[data-clue-row]")).toBeNull();
    expect(board$(container)).toBeNull();
    expect(next$(container)).toBeNull();
    expect(stage.props!.clues?.house).toBe(2);
  });

  it("[살펴보기] → 지점 ② done, 카드 '붉은 천 조각'(옷 조각 칩), 서버로는 아무것도 안 나간다", async () => {
    const { container } = await mount({ initialScene: 5 });
    fireEvent.click(inspect$(container)!);
    expect(spot$(container, 2)!.getAttribute("data-state")).toBe("done");
    const card = container.querySelector('[data-clue-row] [data-clue-chip="cloth"]');
    expect(card).not.toBeNull();
    expect(card!.textContent).toContain("붉은 천 조각");
    expect(stage.props!.view.me.clues).toEqual([{ spot: 2, kind: "cloth", piece: "redCloth" }]);
    expect(connection.calls).toBe(0);
    expect(fetchSpy$()).toBe(0);
  });

  it("살핀 0.9초 뒤 의심 보드가 열리고 도윤(1) 칸에만 같은 옷 표시(cloth)가 있다", async () => {
    const { container } = await mount({ initialScene: 5 });
    fireEvent.click(inspect$(container)!);
    advance(900);
    // MutationObserver(허용 목록 갱신)는 마이크로태스크라 한 번 비워 준다
    await act(async () => {});
    const board = board$(container)!;
    expect(board).not.toBeNull();
    expect(faces$(container).map((f) => f.getAttribute("data-board-face"))).toEqual(["0", "1", "3", "4", "5"]);
    expect(faces$(container).filter((f) => f.hasAttribute("data-board-mark")).map((f) => [f.getAttribute("data-board-face"), f.getAttribute("data-board-mark")])).toEqual([["1", "cloth"]]);
    expect(board.querySelector('[data-clue-chip="cloth"]')?.textContent).toContain("붉은 천 조각");
    expect(stage.props!.view.phase).toBe("discussion");
    // 보드의 닫기는 inert 라 눌리지 않는다
    expect(board.querySelector<HTMLElement>("button[aria-label='닫기']")?.closest("[inert]")).not.toBeNull();
  });

  it("[다음] 은 보드가 열린 1.2초 뒤", async () => {
    const { container } = await mount({ initialScene: 5 });
    fireEvent.click(inspect$(container)!);
    advance(900 + 1199);
    expect(next$(container)).toBeNull();
    advance(1);
    expect(next$(container)).not.toBeNull();
    fireEvent.click(next$(container)!);
    expect(sceneOf(container)).toBe("6");
  });

  it("두 번 살펴봐도 카드·보드는 한 번이다", async () => {
    const { container } = await mount({ initialScene: 5 });
    const btn = inspect$(container)!;
    fireEvent.click(btn);
    fireEvent.click(btn);
    advance(900);
    expect(stage.props!.view.me.clues).toHaveLength(1);
    expect(container.querySelectorAll("[data-suspect-board]")).toHaveLength(1);
  });

  it("포커스 상자: 처음엔 [살펴보기] 와 지점 ②, 보드가 열리면 도윤 칸 하나", async () => {
    const { container } = await mount({ initialScene: 5 });
    advance(100);
    // 지점 ② 와 독 [살펴보기] 두 곳
    expect(boxes(container)).toHaveLength(2);
    fireEvent.click(inspect$(container)!);
    advance(100);
    expect(boxes(container)).toHaveLength(0);
    advance(800);
    advance(100);
    expect(boxes(container)).toHaveLength(1);
    // 도윤 칸 {96,200,77,64} 둘레 8
    expect(boxes(container)[0]!.style.left).toBe("88px");
  });

  it("장면 6 으로 넘어가면 보드·카드는 없고, 이름표 표시용 옷 조각(me.clues)은 이어진다", async () => {
    const { container } = await mount({ initialScene: 5 });
    fireEvent.click(inspect$(container)!);
    advance(900 + 1200);
    fireEvent.click(next$(container)!);
    expect(board$(container)).toBeNull();
    expect(stage.props!.view.me.clues).toEqual([{ spot: 2, kind: "cloth", piece: "redCloth" }]);
  });

  it("모션 줄이기도 같은 순서다(살핌 → 보드 → [다음])", async () => {
    vi.stubGlobal("matchMedia", REDUCED);
    const { container } = await mount({ initialScene: 5 });
    fireEvent.click(inspect$(container)!);
    advance(900);
    expect(board$(container)).not.toBeNull();
  });
});

describe("스포트라이트 구간 (P18-5, D-04)", () => {
  const dim$ = (c: ParentNode) => c.querySelectorAll("[data-tutorial-dim]").length;
  const hole$ = (c: ParentNode) => c.querySelectorAll("[data-tutorial-hole]").length;

  it("장면 2: 띠 창(0~2.6초)에만 1개, 그 뒤 0개, [다음] 은 4초에", async () => {
    const { container } = await mount({ initialScene: 2 });
    advance(100);
    expect(dim$(container)).toBe(1);
    advance(2500);
    advance(50);
    expect(dim$(container)).toBe(0);
    expect(next$(container)).toBeNull();
    advance(1400);
    expect(next$(container)).not.toBeNull();
    expect(dim$(container)).toBe(0);
  });

  it("장면 3: 가로등 5 타일 + [켜기] 구간에 1개(구멍 2개)", async () => {
    const { container } = await mount({ initialScene: 3 });
    advance(100);
    expect(dim$(container)).toBe(1);
    expect(hole$(container)).toBe(2);
  });

  it("장면 4: 집 판 여섯 구멍에 1개, 집을 고르면 0개", async () => {
    const { container } = await mount({ initialScene: 4 });
    advance(100);
    expect(dim$(container)).toBe(1);
    expect(hole$(container)).toBe(6);
    fireEvent.click(house$(container, 4)!);
    advance(50);
    expect(dim$(container)).toBe(0);
  });

  it("장면 5: [살펴보기] 구간 1개 → 살피면 0개 → 보드가 열리면 도윤 칸 구멍 1개, 장면 7 은 시종 0개", async () => {
    const { container } = await mount({ initialScene: 5 });
    advance(100);
    expect(dim$(container)).toBe(1);
    fireEvent.click(inspect$(container)!);
    advance(50);
    expect(dim$(container)).toBe(0);
    advance(900);
    advance(100);
    expect(dim$(container)).toBe(1);
    expect(hole$(container)).toBe(1);
    const seven = await mount({ initialScene: 7 });
    advance(100);
    expect(dim$(seven.container)).toBe(0);
    advance(5000);
    expect(dim$(seven.container)).toBe(0);
    seven.unmount();
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
    advance(4000);
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
