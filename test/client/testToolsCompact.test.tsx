// [테스트] 버튼 좁힘(05-06, 사용자 결정 2026-10-29 (a)): 장면 높이가 TABLE_FIT_MIN_H(299) 미만일 때만 글자를 시각적으로 숨겨 2번 자리 캐릭터 상자 왼쪽 경계 안쪽에 들게 한다.
// 위치(왼쪽 위)는 그대로이고, 긴 화면(299 이상)과 장면 밖(역할 확인 등)에서는 지금과 완전히 같다.
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../helpers/singleLineErrors";
import { TestToolsButton } from "../../src/components/TestTools";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** 장면 상자(class)의 높이를 h 로 보이게 하고 그 안에 [테스트] 버튼을 그린다. */
function renderIn(sceneClass: string | null, h: number) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const isScene = sceneClass !== null && this.classList.contains(sceneClass);
    const r = isScene ? { width: 352, height: h } : { width: 0, height: 0 };
    return { ...r, left: 0, top: 0, right: r.width, bottom: r.height, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  });
  const ui = <TestToolsButton onOpen={() => {}} />;
  return render(sceneClass === null ? <div className="mf-room">{ui}</div> : <div className={sceneClass}><div className="mf-tt-anchor">{ui}</div></div>);
}
const btn = () => screen.getByRole("button", { name: "테스트" });

describe("[테스트] 버튼: 짧은 장면에서만 좁힌다", () => {
  it.each(["mf-lobby__scene", "mf-dayscene__scene"])("%s 높이 283.8(< 299)이면 data-compact 가 붙는다", (cls) => {
    renderIn(cls, 283.8);
    expect(btn().hasAttribute("data-compact")).toBe(true);
  });

  it.each(["mf-lobby__scene", "mf-dayscene__scene"])("%s 높이 299 이상이면 붙지 않는다 (긴 화면 불변)", (cls) => {
    renderIn(cls, 299);
    expect(btn().hasAttribute("data-compact")).toBe(false);
    cleanup();
    renderIn(cls, 363.8);
    expect(btn().hasAttribute("data-compact")).toBe(false);
  });

  it("장면 밖(역할 확인 위쪽 바 등)에서는 붙지 않는다", () => {
    renderIn(null, 100);
    expect(btn().hasAttribute("data-compact")).toBe(false);
  });

  it("장면을 못 재면(높이 0) 붙지 않는다", () => {
    renderIn("mf-lobby__scene", 0);
    expect(btn().hasAttribute("data-compact")).toBe(false);
  });

  it("글자는 접근 이름으로 남는다: 좁혀도 글자 '테스트' 가 span 에 있다", () => {
    renderIn("mf-lobby__scene", 283.8);
    expect(btn().querySelector(".mf-tt__label")?.textContent).toBe("테스트");
  });

  it("ResizeObserver 로 장면이 짧아지면 따라 붙는다", () => {
    let cb: (() => void) | null = null;
    class FakeRO {
      constructor(f: () => void) {
        cb = f;
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("ResizeObserver", FakeRO);
    let h = 400;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const r = this.classList.contains("mf-lobby__scene") ? { width: 352, height: h } : { width: 0, height: 0 };
      return { ...r, left: 0, top: 0, right: r.width, bottom: r.height, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });
    render(<div className="mf-lobby__scene"><TestToolsButton onOpen={() => {}} /></div>);
    expect(btn().hasAttribute("data-compact")).toBe(false);
    h = 280;
    cb!();
    return Promise.resolve().then(() => expect(btn().hasAttribute("data-compact")).toBe(true));
  });
});

describe("testtools.css: 좁힌 버튼", () => {
  const css = readFileSync("src/styles/testtools.css", "utf8");
  it("[data-compact] 규칙이 있고 글자는 mf-tt__label 만 시각적으로 숨긴다", () => {
    expect(css.includes(".mf-tt[data-compact]")).toBe(true);
    expect(css.includes(".mf-tt[data-compact] .mf-tt__label")).toBe(true);
  });
  it("좁힌 폭은 44(탭 하한)이고 테두리 포함 67 이하다", () => {
    const m = /\.mf-tt\[data-compact\]\s*\{([^}]*)\}/.exec(css);
    expect(m === null).toBe(false);
    const body = m![1];
    expect(/min-width:\s*var\(--tap-min\)/.test(body)).toBe(true);
    expect(/padding:\s*0\b/.test(body)).toBe(true);
    expect(/width:\s*var\(--tap-min\)/.test(body)).toBe(true);
  });
});
