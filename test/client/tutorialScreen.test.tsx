// 17-04: 첫 사건 화면(TutorialScreen) — 장면 1~7 을 끝까지 재생하고, 서버·소켓에는 아무것도 보내지 않는다 (TUT-03, TUT-05, 결정 0080-12).
// WorldStage 는 props 를 쥐는 가짜(test/helpers/fakeTutorialStage): 마운트 때 onReady 를 부르고, 허용 목록 시험이 보는 층(입력면·심부름 층·[처리] 층·이름표 층·현장 지점·집 판)의 DOM 만 그린다.
// GameMap·GamePanel·헤더·진행 점 부품은 진짜다. 실제 연결 훅은 호출 횟수만 센다(0 이어야 한다).
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { bindSignals } from "../../src/audio/signals";
import type { LocalSignal } from "../../src/audio/signals";
import { SFX_IDS } from "../../src/audio/recipes";
import { setEngineForTest } from "../../src/audio/unlock";
import { sayItems } from "../../src/audio/voice";
import { TUTORIAL_LINES, TUTORIAL_PICK, TUTORIAL_SCENES, tutorialView } from "../../src/game/tutorialScript";
import { ChatStore } from "../../src/net/chatStore";
import { WorldStore } from "../../src/world/store";
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

type ScreenModule = typeof import("../../src/screens/TutorialScreen");
/** 정적 분석이 모듈 없음으로 파일 전체를 죽이지 않도록 경로를 변수로 둔다 */
const SCREEN_PATH = "../../src/screens/TutorialScreen";

/** 모듈이 있어야 한다는 단언을 import 오류가 아닌 실패 메시지로 남기려고 동적으로 가져온다 */
async function loadScreen(): Promise<ScreenModule> {
  const mod = (await import(/* @vite-ignore */ SCREEN_PATH).catch(() => null)) as ScreenModule | null;
  expect(mod, "src/screens/TutorialScreen.tsx 모듈이 있어야 한다").not.toBeNull();
  return mod!;
}

const NOW = 1_700_000_000_000;

let rig: ReturnType<typeof makeRig>;
let fetchSpy: ReturnType<typeof vi.fn>;
let socketSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  connection.calls = 0;
  rig = makeRig();
  vi.spyOn(rig.engine, "play").mockImplementation(() => {});
  vi.spyOn(rig.engine, "runScript").mockImplementation(() => {});
  setEngineForTest(rig.engine);
  fetchSpy = vi.fn(() => Promise.reject(new Error("튜토리얼은 fetch 를 부르지 않는다")));
  socketSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  vi.stubGlobal("WebSocket", socketSpy);
});

afterEach(() => {
  cleanup();
  stage.props = null;
  setEngineForTest(null);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function mount(opts: { initialScene?: 1 | 2 | 3 | 4 | 5 | 6 | 7; mode?: "solo" | "together"; onEnd?: (reason: "done" | "skipped") => void } = {}) {
  const { TutorialScreen } = await loadScreen();
  const onEnd = opts.onEnd ?? vi.fn();
  const r = render(<TutorialScreen mode={opts.mode ?? "solo"} onEnd={onEnd} {...(opts.initialScene !== undefined ? { initialScene: opts.initialScene } : {})} />);
  return { ...r, onEnd: onEnd as ReturnType<typeof vi.fn> };
}

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};
const sceneOf = (c: ParentNode): string | null => c.querySelector("[data-tutorial-screen]")?.getAttribute("data-tutorial-scene") ?? null;
const next$ = (c: ParentNode) => c.querySelector<HTMLElement>("[data-tutorial-next]");
const skip$ = (c: ParentNode) => c.querySelector<HTMLElement>("[data-tutorial-skip]");

const dockLamp$ = (c: ParentNode) => c.querySelector<HTMLElement>("[data-scene-dock] [data-errand-act]");
const house$ = (c: ParentNode, seat: number) => c.querySelector<HTMLElement>(`button[data-house-pick="${seat}"]`);
const inspect$ = (c: ParentNode) => c.querySelector<HTMLElement>("[data-scene-dock] [data-scene-act]");

describe("장면 3: 독의 [켜기] 가 로컬 어댑터를 거쳐 가로등을 켜고 장면 4 로 (트레이서)", () => {
  it("루트 표식, 시작 위치가 반경 안이라 독 [켜기] 가 서고(처리 가능 장소 lamp5), send 는 실제 연결이 아니다", async () => {
    const { container } = await mount({ initialScene: 3 });
    const root = container.querySelector("[data-tutorial-screen]");
    expect(root).not.toBeNull();
    expect(root?.getAttribute("data-tutorial-scene")).toBe("3");
    expect(root?.classList.contains("mf-root") && root.classList.contains("mf-room") && root.classList.contains("mf-tut")).toBe(true);
    expect(stage.props!.errand!.actId).toBe("lamp5");
    expect(stage.props!.errand!.dock).toBe(true);
    expect(dockLamp$(container)).not.toBeNull();
    expect(dockLamp$(container)!.getAttribute("aria-disabled")).toBeNull();
    expect(connection.calls).toBe(0);
    // 로컬 어댑터: 이동 메시지를 보내도 아무 일 없이 true, 연결로는 나가지 않는다
    expect(stage.props!.send({ t: "move", x: 1, z: 1, seq: 1 } as never)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(socketSpy).not.toHaveBeenCalled();
  });

  it("[켜기] 를 누르면 곧바로 가로등 5 가 켜진 view(done·day.lamps)가 되고, 1.6초 전에는 3, 뒤에는 4", async () => {
    const { container } = await mount({ initialScene: 3 });
    expect(stage.props!.view.day?.lamps).toEqual([]);
    fireEvent.click(dockLamp$(container)!);
    expect(stage.props!.view.day?.lamps).toEqual([5]);
    expect(stage.props!.view.me.errand?.done).toEqual(["lamp5"]);
    expect(stage.props!.errand!.places.find((p) => p.id === "lamp5")?.done).toBe(true);
    advance(1599);
    expect(sceneOf(container)).toBe("3");
    advance(1);
    expect(sceneOf(container)).toBe("4");
    expect(connection.calls).toBe(0);
  });

  it("두 번 눌러도 한 번만 켜고 장면 4 도 한 번만 간다", async () => {
    const { container } = await mount({ initialScene: 3 });
    fireEvent.click(dockLamp$(container)!);
    fireEvent.click(dockLamp$(container)!);
    advance(3000);
    expect(sceneOf(container)).toBe("4");
  });
});

describe("장면 1~7 끝까지 (가짜 타이머)", () => {
  it("1 은 4600ms 뒤 2 · 2 는 4000ms 뒤 [다음] · 3 [켜기] · 4 집 누르기 뒤 [다음] · 5 살펴보기 뒤 [다음] · 6 은 도윤 이름표 · 7 [다음] → onEnd(done) 한 번", async () => {
    const { container, onEnd } = await mount();
    expect(sceneOf(container)).toBe("1");
    advance(4599);
    expect(sceneOf(container)).toBe("1");
    advance(1);
    expect(sceneOf(container)).toBe("2");

    expect(next$(container)).toBeNull();
    advance(3999);
    expect(next$(container)).toBeNull();
    advance(1);
    expect(next$(container)).not.toBeNull();
    fireEvent.click(next$(container)!);
    expect(sceneOf(container)).toBe("3");

    fireEvent.click(dockLamp$(container)!);
    advance(1600);
    expect(sceneOf(container)).toBe("4");
    // 집을 누르기 전에는 [다음] 이 없다
    advance(5000);
    expect(next$(container)).toBeNull();
    fireEvent.click(house$(container, 3)!);
    advance(699);
    expect(next$(container)).toBeNull();
    advance(1);
    fireEvent.click(next$(container)!);
    expect(sceneOf(container)).toBe("5");

    // 현장: 살피기 전에는 [다음] 이 없고, 살핀 뒤 0.9초에 보드가 열리고 1.2초 뒤 [다음]
    advance(5000);
    expect(next$(container)).toBeNull();
    fireEvent.click(inspect$(container)!);
    advance(900 + 1200);
    expect(next$(container)).not.toBeNull();
    fireEvent.click(next$(container)!);
    expect(sceneOf(container)).toBe("6");

    expect(stage.props!.pick).toBeDefined();
    act(() => stage.props!.pick!.onPick(1));
    // 17-05: 정답은 도장·정체 공개(1100ms 뒤)를 거쳐 [다음] 으로 장면 7 이 된다
    expect(sceneOf(container)).toBe("6");
    advance(1100);
    fireEvent.click(next$(container)!);
    expect(sceneOf(container)).toBe("7");

    advance(0);
    expect(onEnd).not.toHaveBeenCalled();
    fireEvent.click(next$(container)!);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith("done");
    expect(connection.calls).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(socketSpy).not.toHaveBeenCalled();
  });

  it("장면 6 에서 오답(도윤이 아닌 이름표)은 아무것도 하지 않는다", async () => {
    const { container } = await mount({ initialScene: 6 });
    act(() => stage.props!.pick!.onPick(0));
    advance(3000);
    expect(sceneOf(container)).toBe("6");
  });

  it("장면 6: 정답 뒤 처형 결과에서 사회자가 '정체는 판이 끝나야 알아요' 를 말한다(정체 카드는 뒤집지 않는다)", async () => {
    const { container } = await mount({ initialScene: 6 });
    act(() => stage.props!.pick!.onPick(1));
    advance(1100);
    expect(container.querySelector("[data-host-line]")?.textContent).toBe(TUTORIAL_LINES["tutorial.secret"]);
    expect(container.querySelector("[data-tutorial-reveal]")).not.toBeNull();
    expect(container.querySelector("[data-tutorial-reveal]")?.textContent ?? "").not.toContain("마피아");
    expect(container.querySelector(".is-flip")).toBeNull();
  });

  it("함께 하기 모드도 같은 장면 재생이다", async () => {
    const { container } = await mount({ initialScene: 3, mode: "together" });
    expect(sceneOf(container)).toBe("3");
  });
});

describe("시간대 글자는 튜토리얼에 없다 (0083-1)", () => {
  it.each([1, 2, 3, 4, 5, 6, 7] as const)("장면 %i: [data-tod] 가 0개", async (n) => {
    const { container } = await mount({ initialScene: n });
    expect(container.querySelectorAll("[data-tod]").length).toBe(0);
    expect(container.querySelector(".mv-phase__tod")).toBeNull();
    expect(container.querySelector(".mv-phase__sep")).toBeNull();
  });
});

describe("[건너뛰기] 는 어느 장면에서나 onEnd(skipped) 한 번", () => {
  it.each([1, 2, 3, 4, 5, 6, 7] as const)("장면 %i", async (n) => {
    const { container, onEnd } = await mount({ initialScene: n });
    expect(skip$(container)).not.toBeNull();
    fireEvent.click(skip$(container)!);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith("skipped");
  });
});

describe("진행 점 (T-23)", () => {
  it.each([1, 2, 3, 4, 5, 6, 7] as const)("장면 %i 에서 role=img aria-label '7단계 중 n단계', 점 7개", async (n) => {
    const { container } = await mount({ initialScene: n });
    const dots = container.querySelector("[role='img'][aria-label$='단계']");
    expect(dots?.getAttribute("aria-label")).toBe(`7단계 중 ${n}단계`);
    expect(dots?.children).toHaveLength(7);
  });
});

describe("소리 큐", () => {
  it("대본의 모든 sfx(TUTORIAL_SCENES·TUTORIAL_PICK)가 SFX_IDS 안이다", () => {
    const ids = new Set<string>(SFX_IDS);
    const cues = [
      ...TUTORIAL_SCENES.flatMap((s) => s.beats.flatMap((b) => (b.sfx === undefined ? [] : [b.sfx]))),
      TUTORIAL_PICK.right.sfx,
      TUTORIAL_PICK.wrong.sfx,
      TUTORIAL_PICK.reveal.sfx,
    ];
    for (const cue of cues) expect(ids.has(cue), `${cue} 가 SFX_IDS 에 있어야 한다`).toBe(true);
  });
});

describe("ui.tap 신호", () => {
  it("[다음]·[건너뛰기] 누름마다 tap 신호가 한 번", async () => {
    const got: LocalSignal[] = [];
    // 화면이 소리 훅(useSound)으로 신호 처리기를 거므로, 마운트 뒤에 시험 처리기로 바꿔 건다
    const { container } = await mount({ initialScene: 7 });
    const off = bindSignals((s) => got.push(s));
    try {
      advance(0);
      fireEvent.click(next$(container)!);
      expect(got.filter((g) => g.kind === "tap")).toHaveLength(1);
      fireEvent.click(skip$(container)!);
      expect(got.filter((g) => g.kind === "tap")).toHaveLength(2);
    } finally {
      off();
    }
  });
});

// ---- Task 2: 장면 시각표(소리·문구)·사회자 띠 ----

/** 엔진 spy(beforeEach 에서 막아 둔 play·runScript)의 호출을 읽는다 */
const plays = (id?: string): string[] => (rig.engine.play as unknown as { mock: { calls: [string][] } }).mock.calls.map((c) => c[0]).filter((x) => id === undefined || x === id);
/** 음절이 있는 목소리 예약(문장 하나) 목록 — 항목 개수 */
const says = (): number[] =>
  (rig.engine.runScript as unknown as { mock: { calls: [string, unknown[]][] } }).mock.calls.filter((c) => c[0] === "voice.host" && c[1].length > 0).map((c) => c[1].length);
/** 목소리를 끊는 호출(빈 대본) 횟수 */
const hushes = (): number => (rig.engine.runScript as unknown as { mock: { calls: [string, unknown[]][] } }).mock.calls.filter((c) => c[0] === "voice.host" && c[1].length === 0).length;
const speaking = (c: ParentNode): boolean => c.querySelector("[data-tutorial-host]")?.hasAttribute("data-speaking") === true;

describe("장면 시각표: 소리·문구", () => {
  it("장면 2: 0ms 에 whoosh 한 번·문장(9글자) 한 번, 2600ms 에 sting·두 번째 문장(11글자), 4000ms 에 secret(11음절)", async () => {
    const { container } = await mount({ initialScene: 2 });
    expect(plays("tut.whoosh")).toHaveLength(1);
    expect(says()).toEqual([9]);
    expect(container.querySelector("[data-host-line]")?.textContent).toBe(TUTORIAL_LINES["tutorial.morning.victim"]);
    advance(2599);
    expect(plays("tut.sting")).toHaveLength(0);
    advance(1);
    expect(plays("tut.sting")).toHaveLength(1);
    expect(says()).toEqual([9, 11]);
    expect(container.querySelector("[data-host-line]")?.textContent).toBe(TUTORIAL_LINES["tutorial.morning.mafia"]);
    advance(1399);
    expect(says()).toEqual([9, 11]);
    advance(1);
    expect(says()).toEqual([9, 11, 11]);
    expect(container.querySelector("[data-host-line]")?.textContent).toBe(TUTORIAL_LINES["tutorial.secret"]);
  });

  it("장면 3: 0ms 에 whoosh, 500ms 에 문장", async () => {
    await mount({ initialScene: 3 });
    expect(plays("tut.whoosh")).toHaveLength(1);
    expect(says()).toEqual([]);
    advance(499);
    expect(says()).toEqual([]);
    advance(1);
    expect(says()).toHaveLength(1);
  });

  it("장면 4: whoosh 0, 문장(집 문구) 500, eye 900", async () => {
    await mount({ initialScene: 4 });
    expect(plays("tut.whoosh")).toHaveLength(1);
    expect(says()).toEqual([]);
    advance(499);
    expect(says()).toEqual([]);
    advance(1);
    expect(says()).toHaveLength(1);
    advance(399);
    expect(plays("tut.eye")).toHaveLength(0);
    advance(1);
    expect(plays("tut.eye")).toHaveLength(1);
    expect(plays("tut.step")).toHaveLength(0);
  });

  it("장면 5: 살피면 link 한 번, 0.9초 뒤 보드가 열리며 link 한 번과 '단서와 같은 옷을 찾아 보세요'", async () => {
    const { container } = await mount({ initialScene: 5 });
    expect(plays("tut.whoosh")).toHaveLength(1);
    expect(plays("tut.link")).toHaveLength(0);
    fireEvent.click(inspect$(container)!);
    expect(plays("tut.link")).toHaveLength(1);
    expect(container.querySelector("[data-suspect-board]")).toBeNull();
    advance(899);
    expect(container.querySelector("[data-suspect-board]")).toBeNull();
    advance(1);
    expect(container.querySelector("[data-suspect-board]")).not.toBeNull();
    expect(plays("tut.link")).toHaveLength(2);
    expect(container.querySelector("[data-host-line]")?.textContent).toBe(TUTORIAL_LINES["tutorial.link"]);
  });

  it("장면 1: lampOff 두 번(800·1300)·scream 2600, 문장 없음(막대 정지)", async () => {
    const { container } = await mount({ initialScene: 1 });
    advance(799);
    expect(plays("tut.lampOff")).toHaveLength(0);
    advance(1);
    expect(plays("tut.lampOff")).toHaveLength(1);
    advance(500);
    expect(plays("tut.lampOff")).toHaveLength(2);
    advance(1299);
    expect(plays("tut.scream")).toHaveLength(0);
    advance(1);
    expect(plays("tut.scream")).toHaveLength(1);
    expect(says()).toEqual([]);
    expect(speaking(container)).toBe(false);
  });

  it("장면이 바뀌면 hush 가 정확히 한 번, 문장·소리 예약은 새 장면 것만 불린다", async () => {
    const { container } = await mount({ initialScene: 2 });
    advance(4000);
    const before = hushes();
    fireEvent.click(next$(container)!);
    expect(sceneOf(container)).toBe("3");
    expect(hushes()).toBe(before + 1);
    // 장면 3 의 문장은 500ms 에만 한 번(장면 2 의 예약이 되살아나지 않는다)
    const sayCount = says().length;
    advance(500);
    expect(says()).toHaveLength(sayCount + 1);
    advance(5000);
    expect(says()).toHaveLength(sayCount + 1);
  });

  it("[다음] 은 장면 2 의 4000ms 에 secret 과 같이 나타난다 — 장면 표의 시각 그대로", async () => {
    const { container } = await mount({ initialScene: 2 });
    advance(2600);
    expect(next$(container)).toBeNull();
    advance(1400);
    expect(next$(container)).not.toBeNull();
  });
});

describe("사회자 띠: 말하는 시간·소리 꺼짐", () => {
  it("말하는 동안 data-speaking 이 켜지고 sayItems 의 totalMs 뒤 꺼진다", async () => {
    const { container } = await mount({ initialScene: 2 });
    const total = sayItems(TUTORIAL_LINES["tutorial.morning.victim"]).totalMs;
    expect(speaking(container)).toBe(true);
    advance(total - 1);
    expect(speaking(container)).toBe(true);
    advance(1);
    expect(speaking(container)).toBe(false);
  });

  it("엔진의 소리가 꺼져 있어도 말하는 시간은 같다", async () => {
    rig.engine.setOn(false);
    expect(rig.engine.isOn()).toBe(false);
    const { container } = await mount({ initialScene: 2 });
    const total = sayItems(TUTORIAL_LINES["tutorial.morning.victim"]).totalMs;
    expect(speaking(container)).toBe(true);
    advance(total - 1);
    expect(speaking(container)).toBe(true);
    advance(1);
    expect(speaking(container)).toBe(false);
  });

  it("소리 단추가 띠 독에 하나 있고, 장면 어디서나 inert 아래가 아니다", async () => {
    rig.engine.unlock();
    const { container } = await mount({ initialScene: 3 });
    const button = container.querySelectorAll("[data-sound-button]");
    expect(button).toHaveLength(1);
    expect(button[0]!.closest("[data-tutorial-host]")).not.toBeNull();
  });
});

describe("지도 장면의 아래 패널·[내 역할] (D-06, 21-15)", () => {
  it.each([2, 6] as const)("장면 %i: 패널·[내 역할]·입력칸이 DOM 에 없고 머리·[건너뛰기]·사회자 띠는 있다", async (n) => {
    const { container } = await mount({ initialScene: n });
    advance(0);
    expect(container.querySelectorAll("[data-world-panel]").length).toBe(0);
    expect(container.querySelectorAll(".mf-game__panel").length).toBe(0);
    expect(container.querySelectorAll(".mf-rolecard-btn").length).toBe(0);
    expect(container.querySelectorAll("textarea, input[type=\"text\"]").length).toBe(0);
    expect(container.querySelector(".mf-game__header")).not.toBeNull();
    expect(skip$(container)).not.toBeNull();
    expect(container.querySelector("[data-tutorial-host]")).not.toBeNull();
  });

  it.each([3, 4, 5] as const)("장면 %i: 실제 독(SceneDock) 하나만 있고 [내 역할]·입력칸은 없다, 머리·[건너뛰기]·사회자 띠는 그대로", async (n) => {
    const { container } = await mount({ initialScene: n });
    advance(0);
    expect(container.querySelectorAll("[data-scene-dock]").length).toBe(1);
    expect(container.querySelectorAll(".mf-rolecard-btn").length).toBe(0);
    expect(container.querySelectorAll("textarea, input[type=\"text\"]").length).toBe(0);
    expect(container.querySelector(".mf-game__header")).not.toBeNull();
    expect(skip$(container)).not.toBeNull();
    expect(container.querySelector("[data-tutorial-host]")).not.toBeNull();
  });

  it("튜토리얼 밖 실제 판처럼 panelless 없이 그리면 아래 패널이 1개다(실제 판 불변)", async () => {
    const { GameMap } = await import("../../src/screens/GameMap");
    const view = tutorialView(2, { now: NOW });
    const { container } = render(<GameMap view={view} store={new WorldStore()} chat={new ChatStore()} send={() => true} canSend offset={0} />);
    expect(container.querySelectorAll("[data-world-panel]").length).toBe(1);
  });
});

describe("튜토리얼 지도 장면의 카메라 (P18-8, D-07)", () => {
  it.each([2, 6] as const)("장면 %i: WorldStage 가 받은 카메라가 광장 가운데 고정·줌 1", async (n) => {
    await mount({ initialScene: n });
    advance(0);
    const cam = stage.props!.scene?.camera;
    expect(cam?.mode === "fixed" && cam.zoom === 1 && cam.target.x === 0 && cam.target.z === 0, "광장 가운데 고정·줌 1").toBe(true);
  });

  it.each([3, 5] as const)("장면 %i: 나를 따라간다", async (n) => {
    await mount({ initialScene: n });
    advance(0);
    expect(stage.props!.scene?.camera.mode).toBe("follow");
  });

  it("장면 4: 실제 판의 마을 밤 시점(집 판) 카메라 그대로 — 덮어쓰지 않는다", async () => {
    await mount({ initialScene: 4 });
    advance(0);
    expect(stage.props!.scene?.camera.mode).not.toBe("follow");
  });
});
