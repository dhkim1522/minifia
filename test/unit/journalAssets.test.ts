import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { journalArt } from "../../src/net/assets";
import type { JournalRole, JournalSlot } from "../../src/net/assets";

// 일지 SVG 슬롯 규격(UI-SPEC G)을 고정한다. 그림이 데스크톱 일러스트로 바뀌면 같은 이름으로 교체하되
// 래스터로 가면 이 파일은 래스터 규격으로 바뀐다.
const ROLES: readonly JournalRole[] = ["police", "mafia", "doctor"];
const SLOTS: readonly JournalSlot[] = ["cover", "page", "icon"];
const INK: Record<JournalRole, string> = { police: "#9ec2ff", mafia: "#f2556a", doctor: "#8fd0bf" };

function fileOf(role: JournalRole, slot: JournalSlot): string {
  // journalArt 가 돌려주는 URL 은 public/ 아래 같은 경로다.
  return `public${journalArt(role, slot).src}`;
}

function read(role: JournalRole, slot: JournalSlot): string {
  return readFileSync(fileOf(role, slot), "utf8");
}

/** 불투명도 계열 속성 값을 모두 모은다(없으면 빈 배열). */
function opacities(svg: string): number[] {
  return [...svg.matchAll(/(?:^|[\s"'])(?:fill-|stroke-)?opacity\s*=\s*"([^"]+)"/g)].map((m) => Number(m[1]));
}

describe("일지 SVG 파일", () => {
  it("아홉 파일이 모두 있다(역할 3 × cover·page·icon) — journalArt 경로와 같은 이름", () => {
    for (const role of ROLES) for (const slot of SLOTS) expect(existsSync(fileOf(role, slot)), fileOf(role, slot)).toBe(true);
    expect(ROLES.length * SLOTS.length).toBe(9);
  });

  it("icon: 24×24, 선 2, 해당 역할 고정 색, currentColor 없음, 의사 아이콘에 진홍이 없다", () => {
    for (const role of ROLES) {
      const svg = read(role, "icon");
      expect(svg, role).toContain('viewBox="0 0 24 24"');
      expect(svg, role).toContain('stroke-width="2"');
      expect(svg.toLowerCase(), role).toContain(`stroke="${INK[role]}"`);
      expect(svg, role).not.toContain("currentColor");
    }
    expect(read("doctor", "icon").toLowerCase()).not.toContain("#f2556a");
  });

  it("cover: 358×44, currentColor 없음, 불투명도 ≤ 0.5, 왼쪽 60%(x < 214) 에는 아무것도 그리지 않는다", () => {
    for (const role of ROLES) {
      const svg = read(role, "cover");
      expect(svg, role).toContain('viewBox="0 0 358 44"');
      expect(svg, role).not.toContain("currentColor");
      for (const value of opacities(svg)) expect(value, `${role} opacity`).toBeLessThanOrEqual(0.5);
      // 면색 rect 가 358 폭 전체를 덮으면 글자 대비가 흔들린다.
      expect(svg, role).not.toMatch(/<rect[^>]*width="358"/);
      for (const x of leftEdges(svg)) expect(x, `${role} x`).toBeGreaterThanOrEqual(214);
    }
  });

  it("page: 8×52, 불투명도 ≤ 0.12, 면을 덮는 rect 가 없다", () => {
    for (const role of ROLES) {
      const svg = read(role, "page");
      expect(svg, role).toContain('viewBox="0 0 8 52"');
      expect(svg, role).not.toContain("currentColor");
      const values = opacities(svg);
      for (const value of values) expect(value, `${role} opacity`).toBeLessThanOrEqual(0.12);
      // 선이 하나도 보이지 않게 되면 무의미한 파일이다 — 불투명도를 쓴 선이 최소 하나 있다.
      expect(values.length, role).toBeGreaterThan(0);
      for (const rect of svg.match(/<rect\b[^>]*>/g) ?? []) {
        expect(rect, `${role} rect`).toMatch(/fill\s*=\s*"none"/);
      }
    }
  });

  it("page: 선 색은 해당 역할의 ink 색이다", () => {
    for (const role of ROLES) expect(read(role, "page").toLowerCase(), role).toContain(INK[role]);
  });

  it("모든 파일: 스크립트·이미지·텍스트·이벤트 속성·외부 참조가 없고 4096 바이트 이하 (T-03.1-19)", () => {
    for (const role of ROLES) {
      for (const slot of SLOTS) {
        const file = fileOf(role, slot);
        const svg = readFileSync(file, "utf8");
        expect(svg, file).not.toContain("<script");
        expect(svg, file).not.toContain("<image");
        expect(svg, file).not.toContain("<text");
        expect(svg, file).not.toMatch(/\son\w+\s*=/);
        expect(svg, file).not.toContain("href=");
        expect(svg, file).not.toContain("currentColor");
        expect(statSync(file).size, file).toBeLessThanOrEqual(4096);
      }
    }
  });
});

/**
 * cover 에 그려진 도형의 가장 왼쪽 x 좌표들. 절대 좌표 명령(M L H V C Z)과 rect·line·circle·ellipse·polyline 만 읽는다.
 * 상대 명령은 좌표를 가늠할 수 없으니 거부해서 그림이 몰래 왼쪽으로 새지 못하게 한다.
 */
function leftEdges(svg: string): number[] {
  const xs: number[] = [];
  for (const tag of svg.match(/<(?:rect|line|circle|ellipse|polyline|polygon|path)\b[^>]*>/g) ?? []) {
    const num = (name: string): number | undefined => {
      const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*"(-?[\\d.]+)"`));
      return m ? Number(m[1]) : undefined;
    };
    const strokeHalf = (Number(tag.match(/stroke-width\s*=\s*"([\d.]+)"/)?.[1]) || 0) / 2;
    const x = num("x");
    if (x !== undefined) xs.push(x - strokeHalf);
    for (const name of ["x1", "x2"]) {
      const v = num(name);
      if (v !== undefined) xs.push(v - strokeHalf);
    }
    const cx = num("cx");
    if (cx !== undefined) xs.push(cx - (num("r") ?? num("rx") ?? 0) - strokeHalf);
    const points = tag.match(/\spoints\s*=\s*"([^"]+)"/)?.[1];
    if (points) for (const pair of points.trim().split(/\s+/)) xs.push(Number(pair.split(",")[0]) - strokeHalf);
    const d = tag.match(/\sd\s*=\s*"([^"]+)"/)?.[1];
    if (d) {
      expect(d, "상대 경로 명령과 호(A)·S·Q·T 는 쓰지 않는다").not.toMatch(/[a-z]|[ASQT]/);
      for (const seg of d.match(/[MLHVCZ][^MLHVCZ]*/g) ?? []) {
        const nums = (seg.slice(1).match(/-?[\d.]+/g) ?? []).map(Number);
        if (seg[0] === "H") nums.forEach((n) => xs.push(n - strokeHalf));
        else if (seg[0] !== "V") for (let i = 0; i < nums.length; i += 2) xs.push(nums[i]! - strokeHalf);
      }
    }
  }
  return xs;
}
