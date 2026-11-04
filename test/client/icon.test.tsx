import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "../helpers/singleLineErrors";
import { Icon } from "../../src/components/Icon";
import type { IconName } from "../../src/components/Icon";
import { V2Icon } from "../../src/components/v2/V2Icon";
import type { V2IconName } from "../../src/components/v2/V2Icon";

afterEach(cleanup);

// 08-20: 남은 이름 전부가 24×24 svg 로 그려지는지 본다(v1.0 낮·밤 화면 전용 아이콘은 지웠다).
const ICON_NAMES: IconName[] = ["back", "share", "close", "copy", "check", "card", "disconnected", "plus", "minus", "wrench"];

describe("Icon 남은 이름 (08-20)", () => {
  it.each(ICON_NAMES)("%s 는 24×24 svg 로 그려진다", (name) => {
    const { container } = render(<Icon name={name} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.querySelectorAll("path,circle,rect").length).toBeGreaterThan(0);
  });
});

// 09.1.1-08: v2 아이콘 새 셋(whisper·swap·quiet) — 24 격자, 선 2px, 둥근 끝(외부 라이브러리 없음). 장식이라 label 이 없으면 aria-hidden
const V2_NEW: V2IconName[] = ["whisper", "swap", "quiet"];

describe("V2Icon 새 아이콘 (09.1.1-08)", () => {
  it.each(V2_NEW)("%s 는 24 격자 svg, 선 2px·둥근 끝이고 도형이 있다", (name) => {
    const { container } = render(<V2Icon name={name} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.getAttribute("stroke-width")).toBe("2");
    expect(svg?.getAttribute("stroke-linecap")).toBe("round");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.querySelectorAll("path,circle").length).toBeGreaterThan(0);
  });

  it("세 아이콘은 서로 다른 모양이다", () => {
    const shapes = V2_NEW.map((name) => {
      const { container } = render(<V2Icon name={name} />);
      return [...container.querySelectorAll("path,circle")].map((e) => e.outerHTML).join("");
    });
    expect(new Set(shapes).size).toBe(3);
  });
});
