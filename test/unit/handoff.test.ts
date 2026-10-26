// HANDOFF.md 는 새 세션이 매번 읽는다. 해결된 항목을 지우지 않고 쌓으면 컨텍스트가 늘어나므로 크기를 지킨다(결정: 최소 정보만 유지).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("HANDOFF.md", () => {
  const text = readFileSync(new URL("../../HANDOFF.md", import.meta.url), "utf8");

  it("6KB 이하다 (해결된 항목은 지운다)", () => {
    expect(Buffer.byteLength(text), "HANDOFF.md 가 커졌다. 해결된 항목을 지운다").toBeLessThanOrEqual(6 * 1024);
  });

  it("지금 상태·확인 대기·다음 할 일 세 구역만 둔다", () => {
    const heads = text.split("\n").filter((l) => l.startsWith("## "));
    expect(heads).toEqual(["## 지금 상태", "## 확인 대기 (사용자 답·확인이 필요한 것)", "## 다음 할 일"]);
  });
});
