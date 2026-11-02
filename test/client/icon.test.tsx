import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "../helpers/singleLineErrors";
import { Icon } from "../../src/components/Icon";
import type { IconName } from "../../src/components/Icon";

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
