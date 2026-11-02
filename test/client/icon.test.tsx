import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "../helpers/singleLineErrors";
import { Icon } from "../../src/components/Icon";
import type { IconName } from "../../src/components/Icon";

afterEach(cleanup);

// 옛 table.test.tsx 에서 옮겼다(결정 0028: 대기실·배정이 고정 테이블로 통일되며 옛 Table 과 그 테스트가 없어졌다).
const NEW_ICONS: IconName[] = ["plus", "skip", "chat"];

describe("Icon 3개 추가 (D-16, 이모티콘 전용 8종은 07-07 에서 삭제)", () => {
  it.each(NEW_ICONS)("%s 는 24×24 svg 로 그려진다", (name) => {
    const { container } = render(<Icon name={name} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.querySelectorAll("path,circle,rect").length).toBeGreaterThan(0);
  });
});
