import { existsSync, readFileSync, statSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { journalArt } from "../../src/net/assets";
import type { JournalRole, JournalSlot } from "../../src/net/assets";

// 일지 표지·속지 WebP와 역할별 SVG 아이콘의 형식과 크기를 확인한다.
const ROLES: readonly JournalRole[] = ["police", "mafia", "doctor"];
const SLOTS: readonly JournalSlot[] = ["cover", "page", "icon"];
const INK: Record<JournalRole, string> = { police: "#9ec2ff", mafia: "#f2556a", doctor: "#8fd0bf" };

function fileOf(role: JournalRole, slot: JournalSlot): string {
  // journalArt 가 돌려주는 URL 은 public/ 아래 같은 경로다.
  return `public${journalArt(role, slot).src.split("?")[0]}`;
}

function readIcon(role: JournalRole): string {
  return readFileSync(fileOf(role, "icon"), "utf8");
}

describe("일지 그림", () => {
  it("역할별 표지와 아이콘, 공용 속지가 journalArt 경로에 있다", () => {
    const files = new Set(ROLES.flatMap((role) => SLOTS.map((slot) => fileOf(role, slot))));
    expect(files.size).toBe(7);
    for (const file of files) expect(existsSync(file), file).toBe(true);
  });

  it("icon: 24×24, 선 2, 해당 역할 고정 색, currentColor 없음, 의사 아이콘에 진홍이 없다", () => {
    for (const role of ROLES) {
      const svg = readIcon(role);
      expect(svg, role).toContain('viewBox="0 0 24 24"');
      expect(svg, role).toContain('stroke-width="2"');
      expect(svg.toLowerCase(), role).toContain(`stroke="${INK[role]}"`);
      expect(svg, role).not.toContain("currentColor");
    }
    expect(readIcon("doctor").toLowerCase()).not.toContain("#f2556a");
  });

  it("표지는 역할마다 별도 WebP이고 머리 띠를 가로로 채운다", async () => {
    for (const role of ROLES) {
      const file = fileOf(role, "cover");
      const meta = await sharp(file).metadata();
      expect(meta.format, file).toBe("webp");
      expect(meta.width / meta.height, file).toBeGreaterThan(4);
      expect(statSync(file).size, file).toBeLessThanOrEqual(8 * 1024);
    }
  });

  it("공용 속지는 가벼운 정사각형 WebP다", async () => {
    const file = fileOf("police", "page");
    const meta = await sharp(file).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(meta.height);
    expect(statSync(file).size).toBeLessThanOrEqual(4 * 1024);
  });

  it("SVG 아이콘에는 코드·글자·외부 참조가 없고 4096 바이트 이하다 (T-03.1-19)", () => {
    for (const role of ROLES) {
      const svg = readIcon(role);
      expect(svg, role).not.toMatch(/<(script|image|text)\b|\son\w+\s*=|href=|currentColor/);
      expect(statSync(fileOf(role, "icon")).size, role).toBeLessThanOrEqual(4096);
    }
  });
});
