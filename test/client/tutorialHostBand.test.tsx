// 17-04: 사회자 파형 + 자막 띠(TutorialHostBand) — 막대 5개·글·말하는 시간(data-speaking)·소리 단추·띠 측정 변수 (TUT-03, TUT-04, T-13, UI-SPEC "사회자 띠 · 목소리 계약").
import { act, cleanup, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import type { SoundView } from "../../src/audio/useSound";
import { makeRig } from "../helpers/soundRig";

type BandModule = typeof import("../../src/components/v2/TutorialHostBand");
/** 정적 분석이 모듈 없음으로 파일 전체를 죽이지 않도록 경로를 변수로 둔다 */
const BAND_PATH = "../../src/components/v2/TutorialHostBand";

async function loadBand(): Promise<BandModule> {
  const mod = (await import(/* @vite-ignore */ BAND_PATH).catch(() => null)) as BandModule | null;
  expect(mod, "src/components/v2/TutorialHostBand.tsx 모듈이 있어야 한다").not.toBeNull();
  return mod!;
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const rect = (top: number, bottom: number): DOMRect => ({ top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
const host = (c: ParentNode) => c.querySelector<HTMLElement>("[data-tutorial-host]");

async function mountBand(props: Partial<ComponentProps<BandModule["TutorialHostBand"]>> = {}) {
  const { TutorialHostBand } = await loadBand();
  const all = { line: "서연 님이 당했습니다", speakMs: 0, nonce: 0, ...props };
  const ui = (p: typeof all) => (
    <div className="mf-room">
      <TutorialHostBand {...p} />
    </div>
  );
  const r = render(ui(all));
  return { ...r, again: (next: Partial<typeof all>) => r.rerender(ui({ ...all, ...next })) };
}

describe("마크업", () => {
  it("루트는 [data-host-band][data-tutorial-host], 띠 면은 .mv-host__band, 막대 5개는 aria-hidden", async () => {
    const { container } = await mountBand();
    const root = host(container)!;
    expect(root.hasAttribute("data-host-band")).toBe(true);
    expect(root.classList.contains("mv-host")).toBe(true);
    expect(root.querySelector(".mv-host__band")).not.toBeNull();
    const bars = root.querySelectorAll(".tut-wave__bar");
    expect(bars).toHaveLength(5);
    expect(root.querySelector(".tut-wave")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("글은 role=status·aria-live polite·aria-atomic false 안 텍스트 노드이고, 시간 행 표식이 없다", async () => {
    const { container } = await mountBand({ line: "<b>x</b> 의심되는 사람을 누르세요" });
    const line = container.querySelector("[role='status']")!;
    expect(line.getAttribute("aria-live")).toBe("polite");
    expect(line.getAttribute("aria-atomic")).toBe("false");
    expect(line.textContent).toBe("<b>x</b> 의심되는 사람을 누르세요");
    expect(line.querySelector("b")).toBeNull();
    expect(container.querySelector("[data-host-time]")).toBeNull();
    expect(container.querySelector(".mv-host__bar")).toBeNull();
  });

  it("line 이 null 이면 띠 면 없이 독만 있다(말 없는 장면)", async () => {
    const { container } = await mountBand({ line: null });
    expect(host(container)).not.toBeNull();
    expect(container.querySelector(".mv-host__band")).toBeNull();
  });
});

describe("말하는 시간 (T-13)", () => {
  it("speakMs 1200·nonce 1 이면 data-speaking 이 켜지고 1200ms 뒤 꺼진다", async () => {
    const { container } = await mountBand({ speakMs: 1200, nonce: 1 });
    expect(host(container)!.hasAttribute("data-speaking")).toBe(true);
    act(() => void vi.advanceTimersByTime(1199));
    expect(host(container)!.hasAttribute("data-speaking")).toBe(true);
    act(() => void vi.advanceTimersByTime(1));
    expect(host(container)!.hasAttribute("data-speaking")).toBe(false);
  });

  it("새 nonce 가 오면 다시 1200ms", async () => {
    const { container, again } = await mountBand({ speakMs: 1200, nonce: 1 });
    act(() => void vi.advanceTimersByTime(1200));
    expect(host(container)!.hasAttribute("data-speaking")).toBe(false);
    again({ speakMs: 1200, nonce: 2 });
    expect(host(container)!.hasAttribute("data-speaking")).toBe(true);
    act(() => void vi.advanceTimersByTime(1200));
    expect(host(container)!.hasAttribute("data-speaking")).toBe(false);
  });

  it("speakMs 0 이면 말하지 않는다", async () => {
    const { container } = await mountBand({ speakMs: 0, nonce: 3 });
    expect(host(container)!.hasAttribute("data-speaking")).toBe(false);
  });

  it("글자 드러남은 새 문장마다 다시 시작한다(nonce 가 키)", async () => {
    const { container, again } = await mountBand({ speakMs: 1000, nonce: 1 });
    const first = container.querySelector("[role='status']");
    again({ speakMs: 1000, nonce: 2 });
    expect(container.querySelector("[role='status']")).not.toBe(first);
  });

  it("모션 줄이기면 막대 영역이 정지 높이(12) 클래스를 단다", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
    const { container } = await mountBand({ speakMs: 1000, nonce: 1 });
    expect(container.querySelector(".tut-wave")?.classList.contains("is-reduced")).toBe(true);
  });
});

describe("소리 단추·띠 측정", () => {
  it("sound 가 있으면 소리 단추가 띠 독(.mv-host__dock)에 하나 있다", async () => {
    const rig = makeRig();
    rig.engine.unlock();
    const sound: SoundView = { supported: true, state: "on", engine: rig.engine };
    const { container } = await mountBand({ sound });
    const button = container.querySelectorAll("[data-sound-button]");
    expect(button).toHaveLength(1);
    expect(button[0]!.parentElement?.classList.contains("mv-host__dock")).toBe(true);
    expect(button[0]!.closest("[data-tutorial-host]")).not.toBeNull();
  });

  it("띠 면 아랫변을 방 틀의 --mf-host-bottom 에 쓴다(실제 띠와 같은 변수)", async () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      if (this.classList.contains("mv-host__band")) return rect(70, 118);
      return rect(0, 0);
    });
    const { container } = await mountBand();
    const room = container.querySelector<HTMLElement>(".mf-room")!;
    expect(room.style.getPropertyValue("--mf-host-bottom")).toBe("118px");
  });

  it("shake 가 바뀌면 띠가 흔들리는 클래스를 잠깐 단다", async () => {
    const { container, again } = await mountBand({ shake: 0 });
    const band = () => container.querySelector(".mv-host__band")!;
    expect(band().classList.contains("is-shake")).toBe(false);
    again({ shake: 1 });
    expect(band().classList.contains("is-shake")).toBe(true);
    act(() => void vi.advanceTimersByTime(400));
    expect(band().classList.contains("is-shake")).toBe(false);
  });
});
