import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useMapInsets } from "../../src/net/useMapInsets";

// 16-07: 아래 패널 요소가 채팅 패널에서 심부름 독 패널로 바뀌면(요소 종류가 달라 다시 만들어진다) 위·아래 안전선을 다시 재야 한다.
// 재는 효과가 시작 때 패널 요소를 한 번 쥐므로 panelKey 가 없으면 떼어진 옛 패널(높이 0)을 재다가 옛 값에 멈춘다 — 심부름 타일이 엉뚱한 영역 안에서만 그려졌다.
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

function Probe({ kind, keyed }: { kind: "chat" | "errand"; keyed: boolean }) {
  const { rootRef, headerRef, panelRef, stageInsets } = useMapInsets(false, keyed ? kind : "");
  return (
    <main ref={rootRef} data-bottom={stageInsets?.bottom ?? "none"}>
      <header ref={headerRef} data-h="62" />
      {kind === "errand" ? <aside ref={panelRef} data-h="84" /> : <section ref={panelRef} data-h="244" />}
    </main>
  );
}

describe("useMapInsets: 아래 패널 요소가 바뀔 때 (16-07)", () => {
  it("panelKey 가 바뀌면 새 패널 높이로 다시 잰다(채팅 244 → 심부름 독 84)", () => {
    const { container, rerender } = render(<Probe kind="chat" keyed />);
    expect(container.querySelector("main")!.getAttribute("data-bottom")).toBe("244");
    rerender(<Probe kind="errand" keyed />);
    expect(container.querySelector("main")!.getAttribute("data-bottom")).toBe("84");
  });

  it("panelKey 를 주지 않으면 옛 값에 멈춘다(그래서 GameMap 이 단계별 키를 넘긴다)", () => {
    const { container, rerender } = render(<Probe kind="chat" keyed={false} />);
    expect(container.querySelector("main")!.getAttribute("data-bottom")).toBe("244");
    rerender(<Probe kind="errand" keyed={false} />);
    expect(container.querySelector("main")!.getAttribute("data-bottom")).toBe("244");
  });
});
