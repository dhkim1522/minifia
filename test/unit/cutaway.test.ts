// 컷어웨이 판정 순수 모듈 시험(20-05, D-10·D-11, UI-SPEC P20-8): 어느 방을 걷을지는 구역과 roomsOpen 만으로 정해진다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROOM_IDS } from "../../shared/protocol";
import { cutawayOf, sameRooms } from "../../src/world/cutaway";

const sorted = (s: ReadonlySet<string>): string => [...s].sort().join(",");

describe("cutawayOf (D-10·D-11)", () => {
  it("방 안이면 그 방 하나만 열린다", () => {
    for (const id of ROOM_IDS) expect(sorted(cutawayOf(id, false))).toBe(id);
  });

  it("광장·구역을 모르는 상태(내 몸이 아직 없음)는 모두 덮인다(빈 집합)", () => {
    expect(cutawayOf("plaza", false).size).toBe(0);
    expect(cutawayOf(null, false).size).toBe(0);
  });

  it("유령·결과 화면(all)이면 어느 구역이든 네 방 모두 열린다", () => {
    for (const zone of [null, "plaza", "post", "pub", "clinic", "police"] as const) expect(sorted(cutawayOf(zone, true))).toBe(sorted(new Set(ROOM_IDS)));
  });

  it("sameRooms 는 내용으로 같음을 본다", () => {
    expect(sameRooms(cutawayOf("post", false), new Set(["post"] as const))).toBe(true);
    expect(sameRooms(cutawayOf("post", false), cutawayOf("pub", false))).toBe(false);
    expect(sameRooms(new Set(), cutawayOf("plaza", false))).toBe(true);
  });

  it("cutaway.ts 는 three·DOM 을 읽지 않는다(소스 규약)", () => {
    const src = readFileSync(new URL("../../src/world/cutaway.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/from\s+["']three["']/);
    expect(src).not.toMatch(/\b(document|window)\b/);
  });
});
