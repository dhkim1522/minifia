import { act, cleanup, renderHook } from "@testing-library/react";
import type { RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useKeyboardLift } from "../../src/net/useKeyboardLift";

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
