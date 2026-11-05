// 10-04: 머리 위 동작 표시가 구조적으로 생길 수 없음을 소스 문자열로 고정한다 (결정 0064-16, L31, T-10-14).
// 동작은 몸동작으로만 보인다. 이름표 층(HeadStack·NameTag·tagOrder)에 동작 표시 슬롯·속성이 생기면 이 시험이 먼저 깨진다.
// 주석도 포함해 본다: 이름표 층 파일에는 동작 이야기 자체가 필요 없다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel: string): string => readFileSync(`${ROOT}${rel}`, "utf8");

describe("L31 — 이름표 층에 동작 표시 없음", () => {
  // WorldStage.tsx 전체는 대상이 아니다(동작 재생 배선이 거기 있다) — 거기서 만드는 이름표 DOM 은 test/client/worldStage.test.tsx 가 본다
  for (const rel of ["src/components/v2/HeadStack.tsx", "src/world/tagOrder.ts"]) {
    it(`${rel} 에는 대소문자 무시 "emote" 가 없다`, () => {
      const src = read(rel);
      expect(src.length).toBeGreaterThan(0);
      expect(src).not.toMatch(/emote/i);
    });
  }

  it("이름표 층 파일은 동작 표시용 data- 속성 이름을 만들지 않는다", () => {
    for (const rel of ["src/components/v2/HeadStack.tsx", "src/world/tagOrder.ts"]) {
      expect(read(rel)).not.toMatch(/data-[a-z-]*(emote|gesture|action)/i);
    }
  });
});
