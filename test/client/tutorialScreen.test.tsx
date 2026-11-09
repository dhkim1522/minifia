// 17-04: 첫 사건 화면(TutorialScreen) — 장면 1~7 을 끝까지 재생하고, 서버·소켓에는 아무것도 보내지 않는다 (TUT-03, TUT-05, 결정 0080-12).
// WorldStage 는 props 를 쥐는 가짜(errandScreen 시험과 같은 틀): 마운트 때 onReady 를 부르고, 허용 목록 시험이 보는 층(입력면·심부름 층·[처리] 층·이름표 층)의 DOM 만 그린다.
// GameMap·GamePanel·헤더·진행 점 부품은 진짜다. 실제 연결 훅은 호출 횟수만 센다(0 이어야 한다).
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { bindSignals } from "../../src/audio/signals";
import type { LocalSignal } from "../../src/audio/signals";
import { SFX_IDS } from "../../src/audio/recipes";
import { setEngineForTest } from "../../src/audio/unlock";
import type { WorldStageProps } from "../../src/components/WorldStage";
import { TUTORIAL_PICK, TUTORIAL_SCENES } from "../../src/game/tutorialScript";
import { makeRig } from "../helpers/soundRig";

const connection = vi.hoisted(() => ({ calls: 0 }));
vi.mock("../../src/net/useRoomConnection", () => ({
  useRoomConnection: () => {
    connection.calls += 1;
    return null;
  },
}));
const stage = vi.hoisted(() => ({ props: null as null | WorldStageProps }));
vi.mock("../../src/components/WorldStage", async () => {
  const { createElement, useEffect } = await import("react");
  return {
    WorldStage: (props: WorldStageProps) => {
      stage.props = props;
      useEffect(() => {
        props.onReady?.();
        // 마운트 때 한 번만 알린다(실제 WorldStage 도 런타임이 준비된 한 번)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      const act$ = props.errand?.actId ?? null;
      return createElement(
        "div",
        { "data-world-stage-fake": "" },
        createElement("div", { className: "mf-world__input" }),
        props.errand ? createElement("div", { "data-errand-layer": "" }, createElement("button", { "data-errand-place": "mail", type: "button" }, "mail")) : null,
        props.errand
          ? createElement(
              "div",
              { "data-errand-act-layer": "" },
              act$ !== null ? createElement("button", { "data-errand-act": "", type: "button", onClick: () => props.errand?.onAct?.() }, "처리") : null,
            )
          : null,
        createElement(
          "div",
          { className: "mf-world__tags" },
          ...props.view.players.map((p) =>
            createElement(
              "div",
              { key: p.seat, className: "mf-world__tag", "data-seat": p.seat },
              props.pick?.seats.has(p.seat) ? createElement("button", { type: "button", "data-pick": p.seat, onClick: () => props.pick?.onPick(p.seat) }, p.nickname) : null,
            ),
          ),
        ),
      );
    },
  };
});

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

describe("장면 3: [처리] 가 로컬 어댑터를 거쳐 장면 4 로 (트레이서)", () => {
  it("루트 표식, 시작 위치가 반경 안이라 [처리] 가 우체통에 서고, send 는 실제 연결이 아니다", async () => {
    const { container } = await mount({ initialScene: 3 });
    const root = container.querySelector("[data-tutorial-screen]");
    expect(root).not.toBeNull();
    expect(root?.getAttribute("data-tutorial-scene")).toBe("3");
    expect(root?.classList.contains("mf-root") && root.classList.contains("mf-room") && root.classList.contains("mf-tut")).toBe(true);
    expect(stage.props!.errand!.actId).toBe("mail");
    expect(connection.calls).toBe(0);
    // 로컬 어댑터: 이동 메시지를 보내도 아무 일 없이 true, 연결로는 나가지 않는다
    expect(stage.props!.send({ t: "move", x: 1, z: 1, seq: 1 } as never)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(socketSpy).not.toHaveBeenCalled();
  });

  it("[처리] 를 누르면 0.7초 전에는 3, 뒤에는 4", async () => {
    const { container } = await mount({ initialScene: 3 });
    act(() => stage.props!.errand!.onAct?.());
    advance(699);
    expect(sceneOf(container)).toBe("3");
    advance(1);
    expect(sceneOf(container)).toBe("4");
  });
});

describe("장면 1~7 끝까지 (가짜 타이머)", () => {
  it("1 은 4600ms 뒤 2 · 2 는 2600ms 뒤 [다음] · 3 [처리] · 4 는 3400ms 뒤 [다음] · 5 [다음] · 6 은 도윤 이름표 · 7 [다음] → onEnd(done) 한 번", async () => {
    const { container, onEnd } = await mount();
    expect(sceneOf(container)).toBe("1");
    advance(4599);
    expect(sceneOf(container)).toBe("1");
    advance(1);
    expect(sceneOf(container)).toBe("2");

    expect(next$(container)).toBeNull();
    advance(2599);
    expect(next$(container)).toBeNull();
    advance(1);
    expect(next$(container)).not.toBeNull();
    fireEvent.click(next$(container)!);
    expect(sceneOf(container)).toBe("3");

    act(() => stage.props!.errand!.onAct?.());
    advance(700);
    expect(sceneOf(container)).toBe("4");
    advance(3399);
    expect(next$(container)).toBeNull();
    advance(1);
    fireEvent.click(next$(container)!);
    expect(sceneOf(container)).toBe("5");

    advance(0);
    expect(next$(container)).not.toBeNull();
    fireEvent.click(next$(container)!);
    expect(sceneOf(container)).toBe("6");

    expect(stage.props!.pick).toBeDefined();
    act(() => stage.props!.pick!.onPick(1));
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

  it("함께 하기 모드도 같은 장면 재생이다", async () => {
    const { container } = await mount({ initialScene: 3, mode: "together" });
    expect(sceneOf(container)).toBe("3");
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
    const off = bindSignals((s) => got.push(s));
    try {
      const { container } = await mount({ initialScene: 5 });
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
