import { act, cleanup, render, renderHook } from "@testing-library/react";
import type { RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useKeyboardLift } from "../../src/net/useKeyboardLift";
import { useMapInsets } from "../../src/net/useMapInsets";

const INNER_H = 844;

interface FakeVV extends EventTarget {
  height: number;
  offsetTop: number;
}

function installVV(height: number, offsetTop = 0): FakeVV {
  const vv = Object.assign(new EventTarget(), { height, offsetTop }) as FakeVV;
  Object.defineProperty(window, "visualViewport", { value: vv, configurable: true, writable: true });
  return vv;
}

let input: HTMLInputElement;
let target: HTMLDivElement;
let inputRef: RefObject<HTMLInputElement | null>;
let targetRef: RefObject<HTMLElement | null>;
let scrollSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout"] });
  Object.defineProperty(window, "innerHeight", { value: INNER_H, configurable: true, writable: true });
  input = document.createElement("input");
  target = document.createElement("div");
  document.body.append(target, input);
  inputRef = { current: input };
  targetRef = { current: target };
  scrollSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  Reflect.deleteProperty(window, "visualViewport");
});

const css = (name: string) => target.style.getPropertyValue(name);
const frame = () => act(() => void vi.advanceTimersByTime(20));
const mount = (enabled = true) => renderHook(() => useKeyboardLift({ inputRef, target: targetRef, enabled }));

describe("useKeyboardLift: 포커스 게이트 lift (CHAT-05)", () => {
  it("입력칸 포커스 + vv.height 508 이면 resize 뒤 다음 프레임에 --mf-kb-lift 336px, open true", () => {
    const vv = installVV(508);
    const { result } = mount();
    act(() => input.focus());
    act(() => void vv.dispatchEvent(new Event("resize")));
    frame();
    expect(css("--mf-kb-lift")).toBe("336px");
    expect(result.current.open).toBe(true);
    expect(result.current.lift()).toBe(336);
  });

  it("포커스가 없으면 같은 vv 값이어도 0px, open false (주소창 접힘으로 떠오르지 않음)", () => {
    const vv = installVV(508);
    const { result } = mount();
    act(() => void vv.dispatchEvent(new Event("resize")));
    frame();
    expect(css("--mf-kb-lift")).toBe("0px");
    expect(result.current.open).toBe(false);
    expect(result.current.lift()).toBe(0);
  });

  it("포커스 중 lift 60 이면 60px 이고 열림은 아니다", () => {
    const vv = installVV(INNER_H - 60);
    const { result } = mount();
    act(() => input.focus());
    act(() => void vv.dispatchEvent(new Event("resize")));
    frame();
    expect(css("--mf-kb-lift")).toBe("60px");
    expect(result.current.open).toBe(false);
  });

  it("열림 경계: lift 80 은 닫힘, 81 은 열림", () => {
    const vv = installVV(INNER_H - 80);
    const { result } = mount();
    act(() => input.focus());
    frame();
    expect(result.current.open).toBe(false);
    vv.height = INNER_H - 81;
    act(() => void vv.dispatchEvent(new Event("resize")));
    frame();
    expect(result.current.open).toBe(true);
  });

  it("vv.offsetTop 120 이면 --mf-vv-top 120px 이고 lift 는 offsetTop 만큼 줄어든다", () => {
    const vv = installVV(508, 120);
    mount();
    act(() => input.focus());
    act(() => void vv.dispatchEvent(new Event("scroll")));
    frame();
    expect(css("--mf-vv-top")).toBe("120px");
    expect(css("--mf-kb-lift")).toBe("216px");
  });

  it("블러하면 타이머를 기다리지 않고 즉시 0px, open false", () => {
    const vv = installVV(508, 120);
    const { result } = mount();
    act(() => input.focus());
    frame();
    expect(result.current.open).toBe(true);
    act(() => input.blur());
    expect(css("--mf-kb-lift")).toBe("0px");
    expect(css("--mf-vv-top")).toBe("0px");
    expect(result.current.open).toBe(false);
    expect(result.current.lift()).toBe(0);
    expect(vv).toBeDefined();
  });

  it("포커스 뒤 100·300·1000ms 에 한 번씩 다시 읽는다", () => {
    const vv = installVV(508);
    mount();
    act(() => input.focus());
    frame();
    expect(css("--mf-kb-lift")).toBe("336px");
    vv.height = 600;
    act(() => void vi.advanceTimersByTime(80));
    expect(css("--mf-kb-lift")).toBe("244px");
    vv.height = 700;
    act(() => void vi.advanceTimersByTime(200));
    expect(css("--mf-kb-lift")).toBe("144px");
    vv.height = 800;
    act(() => void vi.advanceTimersByTime(700));
    expect(css("--mf-kb-lift")).toBe("44px");
  });

  it("resize 를 한 프레임에 여러 번 보내도 계산은 한 번이다", () => {
    const vv = installVV(508);
    mount();
    act(() => input.focus());
    frame();
    const setProperty = vi.spyOn(target.style, "setProperty");
    act(() => {
      for (let i = 0; i < 5; i++) vv.dispatchEvent(new Event("resize"));
    });
    frame();
    expect(setProperty.mock.calls.filter(([name]) => name === "--mf-kb-lift")).toHaveLength(1);
  });

  it("visualViewport 가 없으면 lift 0, open false, 오류 없음", () => {
    Object.defineProperty(window, "visualViewport", { value: undefined, configurable: true, writable: true });
    const { result } = mount();
    expect(() => {
      act(() => input.focus());
      frame();
    }).not.toThrow();
    expect(result.current.open).toBe(false);
    expect(result.current.lift()).toBe(0);
  });

  it("enabled 가 거짓이면 아무것도 쓰지 않는다", () => {
    const vv = installVV(508);
    const { result } = mount(false);
    act(() => input.focus());
    act(() => void vv.dispatchEvent(new Event("resize")));
    frame();
    expect(css("--mf-kb-lift")).toBe("");
    expect(result.current.open).toBe(false);
  });

  it("window.scrollTo 로 억지 복구하지 않는다", () => {
    const vv = installVV(508);
    mount();
    act(() => input.focus());
    act(() => void vv.dispatchEvent(new Event("resize")));
    frame();
    act(() => input.blur());
    act(() => void vi.advanceTimersByTime(1100));
    expect(scrollSpy).not.toHaveBeenCalled();
  });
});

describe("useKeyboardLift: 한 줄 시트(귓속말, 09.1.1-09)의 입력칸도 시트 층 규칙을 받는다", () => {
  it("시트 층(.mf-will-layer) 안 input 에 초점이 가면 키보드 lift 가 켜지고 inSheet 가 참이다", () => {
    const vv = installVV(508);
    const layer = document.createElement("div");
    layer.className = "mf-will-layer";
    const lineInput = document.createElement("input");
    lineInput.setAttribute("data-line-input", "");
    layer.append(lineInput);
    document.body.append(layer);
    const { result } = mount();
    act(() => lineInput.focus());
    act(() => void vv.dispatchEvent(new Event("resize")));
    frame();
    expect(css("--mf-kb-lift")).toBe("336px");
    expect(result.current.open).toBe(true);
    expect(result.current.inSheet).toBe(true);
  });

  it("시트 입력칸을 블러하면 즉시 0px 이고 inSheet 가 거짓이다", () => {
    const vv = installVV(508);
    const layer = document.createElement("div");
    layer.className = "mf-will-layer";
    const lineInput = document.createElement("input");
    layer.append(lineInput);
    document.body.append(layer);
    const { result } = mount();
    act(() => lineInput.focus());
    act(() => void vv.dispatchEvent(new Event("resize")));
    frame();
    act(() => lineInput.blur());
    expect(css("--mf-kb-lift")).toBe("0px");
    expect(result.current.inSheet).toBe(false);
  });
});

// 0083-4: 늘어난 기록 칸의 식 재료. 측정 훅이 화면 루트에 방 높이와 패널의 기록 칸 밖 높이를 쓴다(대기실·게임 맵·결과가 모두 이 훅).
describe("useMapInsets: 늘어난 기록 칸의 식 재료 --mf-room-h·--mf-panel-rest (0083-4)", () => {
  const realOffset = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
  const realClient = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
  beforeEach(() => {
    // 레이아웃이 없다: data-h 가 곧 높이(떼어진 요소는 0), 루트의 clientHeight 는 data-ch
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.isConnected ? Number(this.dataset.h ?? 0) : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.isConnected ? Number(this.dataset.ch ?? 0) : 0;
      },
    });
  });
  afterEach(() => {
    if (realOffset) Object.defineProperty(HTMLElement.prototype, "offsetHeight", realOffset);
    if (realClient) Object.defineProperty(HTMLElement.prototype, "clientHeight", realClient);
    else Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
  });

  function Probe({ panelless = false, logH = 68 }: { panelless?: boolean; logH?: number }) {
    const { rootRef, headerRef, panelRef } = useMapInsets(false, panelless);
    return (
      <main ref={rootRef} data-ch="844">
        <header ref={headerRef} data-h="62" />
        {panelless ? null : (
          <section ref={panelRef} data-h={String(172 + logH)}>
            <div data-chat-log="" data-h={String(logH)} />
          </section>
        )}
      </main>
    );
  }

  it("패널 240·기록 칸 68 이면 루트에 --mf-room-h 844px, --mf-panel-rest 172px 가 쓰인다", () => {
    const { container } = render(<Probe />);
    const main = container.querySelector("main") as HTMLElement;
    expect(main.style.getPropertyValue("--mf-room-h")).toBe("844px");
    expect(main.style.getPropertyValue("--mf-panel-rest")).toBe("172px");
  });

  it("기록 칸이 늘어나(300) 패널이 커져도 --mf-panel-rest 는 그대로 172px 이다(측정이 서로를 다시 바꾸지 않는다)", () => {
    const { container, rerender } = render(<Probe />);
    rerender(<Probe logH={300} />);
    const main = container.querySelector("main") as HTMLElement;
    expect(main.style.getPropertyValue("--mf-panel-rest")).toBe("172px");
  });

  it("패널이 없는 단계(panelless)에서는 --mf-panel-rest 를 쓰지 않는다", () => {
    const { container } = render(<Probe panelless />);
    const main = container.querySelector("main") as HTMLElement;
    expect(main.style.getPropertyValue("--mf-panel-rest")).toBe("");
  });

  it("값이 바뀔 때만 쓴다(같은 값으로 다시 재도 setProperty 를 다시 부르지 않는다)", () => {
    const { container, rerender } = render(<Probe />);
    const main = container.querySelector("main") as HTMLElement;
    const spy = vi.spyOn(main.style, "setProperty");
    rerender(<Probe />);
    window.dispatchEvent(new Event("resize"));
    expect(spy.mock.calls.filter(([n]) => n === "--mf-room-h" || n === "--mf-panel-rest")).toHaveLength(0);
  });
});
