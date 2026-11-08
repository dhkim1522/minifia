import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useMapInsets } from "../../src/net/useMapInsets";

// 16-08: 심부름 단계에는 아래 패널이 없다(panelless). 패널 없이도 위 끝은 헤더 아랫변이고 아래 끝은 0 이다.
// 단계가 바뀌어 패널 요소가 생기거나 사라지면 다시 잰다(16-07 의 옛 패널을 쥐고 멈추던 문제도 이 인자가 단계마다 바뀌어 막는다).
const realHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");

beforeEach(() => {
  // jsdom 에는 레이아웃이 없다: data-h 가 곧 높이. 떼어진 요소는 0
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.isConnected ? Number(this.dataset.h ?? 0) : 0;
    },
  });
});

afterEach(() => {
  cleanup();
  if (realHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", realHeight);
});

function Probe({ kind }: { kind: "chat" | "errand" }) {
  const { rootRef, headerRef, panelRef, stageInsets } = useMapInsets(false, kind === "errand");
  return (
    <main ref={rootRef} data-top={stageInsets?.top ?? "none"} data-bottom={stageInsets?.bottom ?? "none"}>
      <header ref={headerRef} data-h="62" />
      {kind === "errand" ? null : <section ref={panelRef} data-h="244" />}
    </main>
  );
}

describe("useMapInsets: 패널 없는 단계 (16-08)", () => {
  it("panelless 면 패널 요소가 없어도 위 끝은 헤더 아랫변(62), 아래 끝은 0 으로 정해진다", () => {
    const { container } = render(<Probe kind="errand" />);
    const main = container.querySelector("main")!;
    expect(main.getAttribute("data-top")).toBe("62");
    expect(main.getAttribute("data-bottom")).toBe("0");
  });

  it("채팅(244) → 심부름(패널 없음 0) → 채팅(244) 으로 단계가 바뀌면 다시 잰다", () => {
    const { container, rerender } = render(<Probe kind="chat" />);
    const main = container.querySelector("main")!;
    expect(main.getAttribute("data-bottom")).toBe("244");
    rerender(<Probe kind="errand" />);
    expect(main.getAttribute("data-bottom")).toBe("0");
    rerender(<Probe kind="chat" />);
    expect(main.getAttribute("data-bottom")).toBe("244");
  });

  it("panelless 가 아니고 패널도 없으면 재지 않는다(기존 동작 — 대기실·결과 화면은 늘 패널이 있다)", () => {
    function NoPanel() {
      const { rootRef, headerRef, stageInsets } = useMapInsets();
      return (
        <main ref={rootRef} data-bottom={stageInsets?.bottom ?? "none"}>
          <header ref={headerRef} data-h="62" />
        </main>
      );
    }
    const { container } = render(<NoPanel />);
    expect(container.querySelector("main")!.getAttribute("data-bottom")).toBe("none");
  });
});
