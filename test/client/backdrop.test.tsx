// Backdrop: 장면이 바뀌면 층을 쌓아 0.8초 크로스페이드한다 (결정 0030, 사용자 지시 V-04).
import { readFileSync } from "node:fs";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Backdrop } from "../../src/components/Backdrop";
import { SCENE_FADE_MS, SCENE_IMAGE_WAIT_MS, headerScrimGradient } from "../../src/game/scenes";

type Mode = "immediate" | "manual";

/** Image 스텁: immediate 는 decode 가 바로 끝나고, manual 은 resolveAll() 을 부를 때 끝난다. */
function stubImages(mode: Mode) {
  const pending: Array<() => void> = [];
  const loaded: string[] = [];
  class FakeImage {
    src = "";
    decode(): Promise<void> {
      loaded.push(this.src);
      if (mode === "immediate") return Promise.resolve();
      return new Promise<void>((resolve) => pending.push(resolve));
    }
  }
  vi.stubGlobal("Image", FakeImage);
  return { loaded, resolveAll: () => pending.splice(0).forEach((r) => r()) };
}

const layersOf = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>(".mf-backdrop__art")].map((el) => `${el.dataset.scene}:${el.dataset.state}`);
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};
const advance = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Backdrop 층 규칙", () => {
  it("첫 마운트는 층 하나가 바로 current 이다 (진입 연출 없음). 루트 클래스는 mf-backdrop--{장면}", () => {
    stubImages("immediate");
    const { container } = render(<Backdrop layout="game" scene="night" className="x" />);
    expect(layersOf(container)).toEqual(["night:current"]);
    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains("mf-backdrop")).toBe(true);
    expect(root.classList.contains("mf-backdrop--night")).toBe(true);
    expect(root.classList.contains("x")).toBe(true);
  });

  it("층은 aria-hidden 이고 그림은 장면의 WebP 하나뿐이다 (막은 그림에 합치지 않는다)", () => {
    stubImages("immediate");
    const { container } = render(<Backdrop layout="game" scene="morning" />);
    const art = container.querySelector<HTMLElement>(".mf-backdrop__art")!;
    expect(art.getAttribute("aria-hidden")).toBe("true");
    expect(art.style.backgroundImage).toMatch(/^url\(["']?\/backgrounds\/bg_game_morning\.webp["']?\)$/);
    expect(art.style.backgroundPosition).toContain("top");
  });

  it("entry 구도는 입구 lobby WebP 를 쓴다", () => {
    stubImages("immediate");
    const { container } = render(<Backdrop layout="entry" scene="lobby" />);
    expect(container.querySelector<HTMLElement>(".mf-backdrop__art")!.style.backgroundImage).toContain("/backgrounds/bg_entry_lobby.webp");
  });

  it("scene 이 바뀌면 새 층이 entering 으로 쌓이고, 그림이 준비되면 이전 층은 leaving·새 층은 current, 전환이 끝나면 한 층이 남는다", async () => {
    stubImages("immediate");
    const { container, rerender } = render(<Backdrop layout="game" scene="lobby" />);
    rerender(<Backdrop layout="game" scene="night" />);
    expect(layersOf(container)).toEqual(["lobby:current", "night:entering"]);
    expect(container.firstElementChild!.classList.contains("mf-backdrop--night")).toBe(true);
    await flush();
    expect(layersOf(container)).toEqual(["lobby:leaving", "night:current"]);
    await advance(SCENE_FADE_MS - 1);
    expect(layersOf(container)).toHaveLength(2);
    await advance(200);
    expect(layersOf(container)).toEqual(["night:current"]);
  });

  it("새 그림이 늦게 준비되면 entering 에 머물고, 준비되는 순간 시작한다 (이전 그림은 그동안 그대로 보인다)", async () => {
    const img = stubImages("manual");
    const { container, rerender } = render(<Backdrop layout="game" scene="day" />);
    rerender(<Backdrop layout="game" scene="dusk" />);
    await advance(500);
    expect(layersOf(container)).toEqual(["day:current", "dusk:entering"]);
    expect(img.loaded).toEqual(["/backgrounds/bg_game_dusk.webp"]);
    img.resolveAll();
    await flush();
    expect(layersOf(container)).toEqual(["day:leaving", "dusk:current"]);
  });

  it("그림이 끝내 준비되지 않아도 상한 SCENE_IMAGE_WAIT_MS(1200ms)에 시작한다", async () => {
    stubImages("manual");
    const { container, rerender } = render(<Backdrop layout="game" scene="day" />);
    rerender(<Backdrop layout="game" scene="night" />);
    await advance(SCENE_IMAGE_WAIT_MS - 1);
    expect(layersOf(container)).toEqual(["day:current", "night:entering"]);
    await advance(1);
    expect(layersOf(container)).toEqual(["day:leaving", "night:current"]);
  });

  it("Image.decode 가 없으면 기다리지 않고 바로 시작한다", async () => {
    vi.stubGlobal(
      "Image",
      class {
        src = "";
      },
    );
    const { container, rerender } = render(<Backdrop layout="game" scene="night" />);
    rerender(<Backdrop layout="game" scene="morning" />);
    await flush();
    expect(layersOf(container)).toEqual(["night:leaving", "morning:current"]);
  });

  it("instant 이면 크로스페이드 없이 층 하나로 즉시 바뀐다", async () => {
    stubImages("immediate");
    const { container, rerender } = render(<Backdrop layout="game" scene="day" />);
    rerender(<Backdrop layout="game" scene="night" instant />);
    expect(layersOf(container)).toEqual(["night:current"]);
    await advance(2000);
    expect(layersOf(container)).toEqual(["night:current"]);
  });

  it("fromScene 이 있으면 처음에는 그 장면이 current 였다가 곧 scene 으로 크로스페이드한다", async () => {
    stubImages("immediate");
    const { container } = render(<Backdrop layout="game" scene="day" fromScene="lobby" />);
    expect(layersOf(container)).toEqual(["lobby:current", "day:entering"]);
    await flush();
    expect(layersOf(container)).toEqual(["lobby:leaving", "day:current"]);
    await advance(SCENE_FADE_MS + 100);
    expect(layersOf(container)).toEqual(["day:current"]);
  });

  it("fromScene 과 instant 가 함께면 즉시 scene 하나만 보인다", () => {
    stubImages("immediate");
    const { container } = render(<Backdrop layout="game" scene="day" fromScene="lobby" instant />);
    expect(layersOf(container)).toEqual(["day:current"]);
  });

  it("같은 scene 을 다시 그려도 층이 늘지 않는다", async () => {
    stubImages("immediate");
    const { container, rerender } = render(<Backdrop layout="game" scene="day" />);
    rerender(<Backdrop layout="game" scene="day" className="y" />);
    await flush();
    expect(layersOf(container)).toEqual(["day:current"]);
  });

  it("전환을 기다리는 동안 원래 장면으로 돌아오면 새 층을 걷어내고 층 하나만 남긴다", async () => {
    stubImages("manual");
    const { container, rerender } = render(<Backdrop layout="game" scene="day" />);
    rerender(<Backdrop layout="game" scene="night" />);
    rerender(<Backdrop layout="game" scene="day" />);
    expect(layersOf(container)).toEqual(["day:current"]);
  });

  it("전환 중 또 바뀌면 기다리던 층을 걷어내고 새 장면으로 간다 (층은 동시에 최대 3개)", async () => {
    stubImages("immediate");
    const { container, rerender } = render(<Backdrop layout="game" scene="lobby" />);
    for (const scene of ["night", "morning", "day", "dusk", "night", "day"] as const) {
      rerender(<Backdrop layout="game" scene={scene} />);
      expect(layersOf(container).length).toBeLessThanOrEqual(3);
      await flush();
      expect(layersOf(container).length).toBeLessThanOrEqual(3);
      expect(layersOf(container).at(-1)).toBe(`${scene}:current`);
    }
    await advance(SCENE_FADE_MS + 200);
    expect(layersOf(container)).toEqual(["day:current"]);
  });

  it("언마운트하면 대기 중인 타이머를 정리한다 (경고·오류 없음)", async () => {
    stubImages("manual");
    const { rerender, unmount } = render(<Backdrop layout="game" scene="day" />);
    rerender(<Backdrop layout="game" scene="night" />);
    unmount();
    await advance(5000);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("헤더 위쪽 어두운 막", () => {
  it("아침·낮·해질녘·처형 층만 인라인 사용자 지정 속성 --mf-scrim 을 싣고, 값은 HEADER_SCRIM_STOPS 의 그라데이션이다", async () => {
    stubImages("immediate");
    const { container, rerender } = render(<Backdrop layout="game" scene="morning" />);
    const scrimOf = () => [...container.querySelectorAll<HTMLElement>(".mf-backdrop__art")].map((el) => el.style.getPropertyValue("--mf-scrim"));
    expect(scrimOf()).toEqual([headerScrimGradient()]);
    rerender(<Backdrop layout="game" scene="day" />);
    await flush();
    expect(scrimOf()).toEqual([headerScrimGradient(), headerScrimGradient()]);
    rerender(<Backdrop layout="game" scene="night" />);
    await flush();
    // 낮 층(leaving)은 막을 가진 채 함께 사라지고, 밤 층에는 막이 없다
    expect(scrimOf().at(-1)).toBe("");
    await advance(SCENE_FADE_MS + 200);
    expect(scrimOf()).toEqual([""]);
  });

  it("해질녘·처형 층도 막을 싣는다 (v3 에서 360폭 타이머 대비가 4.5 미만이라 추가)", () => {
    stubImages("immediate");
    for (const scene of ["dusk", "verdictDusk"] as const) {
      const { container, unmount } = render(<Backdrop layout="game" scene={scene} />);
      expect(container.querySelector<HTMLElement>(".mf-backdrop__art")!.style.getPropertyValue("--mf-scrim"), scene).toBe(headerScrimGradient());
      unmount();
    }
  });

  it("lobby·night 와 entry 층에는 막이 없다", () => {
    stubImages("immediate");
    for (const scene of ["lobby", "night"] as const) {
      const { container, unmount } = render(<Backdrop layout="game" scene={scene} />);
      expect(container.querySelector<HTMLElement>(".mf-backdrop__art")!.style.getPropertyValue("--mf-scrim"), scene).toBe("");
      unmount();
    }
    const { container } = render(<Backdrop layout="entry" scene="lobby" />);
    expect(container.querySelector<HTMLElement>(".mf-backdrop__art")!.style.getPropertyValue("--mf-scrim")).toBe("");
  });
});

describe("자식 내용", () => {
  it("children 은 층 위의 .mf-backdrop__content 에 그려진다", () => {
    stubImages("immediate");
    const { container } = render(
      <Backdrop layout="game" scene="lobby">
        <p>안녕</p>
      </Backdrop>,
    );
    expect(container.querySelector(".mf-backdrop__content p")?.textContent).toBe("안녕");
  });
});

describe("ds.css 배경 층 규약 (vitest 가 CSS import 를 비우므로 파일을 읽는다)", () => {
  const css = readFileSync("src/styles/ds.css", "utf8");
  const backdropLines = css.split("\n").filter((l) => l.includes("mf-backdrop"));

  it(".mf-backdrop__art 는 opacity 전환(--dur-slow, --ease-out)이고 background-image 전환은 없다", () => {
    expect(css).toMatch(/\.mf-backdrop__art\s*\{[^}]*transition:\s*opacity var\(--dur-slow\) var\(--ease-out\)/);
    expect(css).not.toMatch(/transition:\s*background-image/);
  });

  it("상태별 불투명도: entering·leaving 0, current 1", () => {
    expect(css).toMatch(/\.mf-backdrop__art\[data-state="entering"\][^{]*\{[^}]*opacity:\s*0/);
    expect(css).toMatch(/\.mf-backdrop__art\[data-state="leaving"\][^{]*\{[^}]*opacity:\s*0/);
    expect(css).toMatch(/\.mf-backdrop__art\[data-state="current"\]\s*\{[^}]*opacity:\s*1/);
  });

  it("막은 ::after 로 위쪽 150px 에 var(--mf-scrim) 을 깔고 터치를 막지 않는다", () => {
    const rule = /\.mf-backdrop__art\[style\*="--mf-scrim"\]::after\s*\{([^}]*)\}/.exec(css);
    expect(rule, "막 규칙").not.toBeNull();
    expect(rule![1]).toContain("height: 150px");
    expect(rule![1]).toContain("background: var(--mf-scrim)");
    expect(rule![1]).toContain("pointer-events: none");
    expect(rule![1]).toMatch(/inset:\s*0 0 auto 0/);
  });

  it("층은 터치를 막지 않고, 코드 줄에 # 색 값이 없다 (토큰만)", () => {
    expect(css).toMatch(/\.mf-backdrop__art\s*\{[^}]*pointer-events:\s*none/);
    for (const l of backdropLines) expect(l.replace(/\/\*.*?\*\//g, ""), l).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
