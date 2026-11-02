import { describe, expect, it } from "vitest";
import { NAMETAG_H } from "../../src/world/camera";
import { rankTags } from "../../src/world/tagOrder";
import type { TagBox } from "../../src/world/tagOrder";

// 06-22 (G-06-4): 이름표 순위·맨 앞 겹침 판정. 순수 함수 — 내 이름표 맨 위, 나머지는 발 y(큰 쪽이 위)·seat(큰 쪽이 위).

const box = (seat: number, over: Partial<TagBox> = {}): TagBox => ({ seat, me: false, foot: 300, x: 100, bottom: 200, w: 100, ...over });
const zOf = (r: ReturnType<typeof rankTags>, seat: number): number => r.find((t) => t.seat === seat)!.z;
const frontOf = (r: ReturnType<typeof rankTags>, seat: number): boolean => r.find((t) => t.seat === seat)!.front;

describe("rankTags 순위 (G-06-4)", () => {
  it("빈 목록은 빈 결과다", () => {
    expect(rankTags([])).toEqual([]);
  });

  it("발끝 y 가 큰 쪽이 위, 동점이면 seat 이 큰 쪽이 위다", () => {
    const r = rankTags([box(0, { foot: 310 }), box(1, { foot: 305 }), box(2, { foot: 305 })]);
    expect(zOf(r, 0)).toBeGreaterThan(zOf(r, 2));
    expect(zOf(r, 2)).toBeGreaterThan(zOf(r, 1));
  });

  it("내 이름표는 발이 뒤여도, seat 번호가 작아도 나머지 모두보다 위다", () => {
    const r = rankTags([box(0, { me: true, foot: 100 }), box(1, { foot: 500 }), box(2, { foot: 400 })]);
    expect(zOf(r, 0)).toBeGreaterThan(zOf(r, 1));
    expect(zOf(r, 0)).toBeGreaterThan(zOf(r, 2));
    expect(zOf(r, 1)).toBeGreaterThan(zOf(r, 2));
  });

  it("z 는 0 부터 n−1 까지 서로 다른 순위다", () => {
    const r = rankTags(Array.from({ length: 8 }, (_, i) => box(i, { me: i === 3 })));
    expect(r.map((t) => t.z).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("입력 순서를 바꾸지 않고 같은 seat 의 결과를 돌려준다", () => {
    const input = [box(2), box(0), box(1)];
    const r = rankTags(input);
    expect(input.map((b) => b.seat)).toEqual([2, 0, 1]);
    expect(r.map((t) => t.seat).sort()).toEqual([0, 1, 2]);
  });
});

describe("rankTags 맨 앞 겹침 (G-06-4)", () => {
  it("8명이 한 점에 모이면 front 는 정확히 하나, 내 이름표다", () => {
    const r = rankTags(Array.from({ length: 8 }, (_, i) => box(i, { me: i === 2 })));
    expect(r.filter((t) => t.front)).toHaveLength(1);
    expect(frontOf(r, 2)).toBe(true);
  });

  it("내가 없으면 가장 높은 순위(seat 이 가장 큰 동점)가 front 다", () => {
    const r = rankTags(Array.from({ length: 8 }, (_, i) => box(i)));
    expect(r.filter((t) => t.front).map((t) => t.seat)).toEqual([7]);
  });

  it("멀리 떨어져 겹치지 않으면 아무도 front 가 아니다", () => {
    const r = rankTags([box(0, { x: 50 }), box(1, { x: 400 }), box(2, { x: 50, bottom: 400 })]);
    expect(r.every((t) => !t.front)).toBe(true);
  });

  it("한 명뿐이면 front 가 아니다", () => {
    expect(rankTags([box(0, { me: true })])).toEqual([{ seat: 0, z: 0, front: false }]);
  });

  it("변만 맞닿으면 겹침이 아니다(가로·세로)", () => {
    const side = rankTags([box(0, { x: 100, w: 100 }), box(1, { x: 200, w: 100 })]); // [50,150] 과 [150,250]
    expect(side.every((t) => !t.front)).toBe(true);
    const up = rankTags([box(0, { bottom: 200 }), box(1, { bottom: 200 + NAMETAG_H })]); // [176,200] 과 [200,224]
    expect(up.every((t) => !t.front)).toBe(true);
  });

  it("면적을 가지고 겹치면 겹침이다", () => {
    const r = rankTags([box(0, { x: 100 }), box(1, { x: 199 })]);
    expect(r.filter((t) => t.front).map((t) => t.seat)).toEqual([1]);
  });

  it("높이 h 인자를 따른다", () => {
    const r = rankTags([box(0, { bottom: 200 }), box(1, { bottom: 210 })], 5);
    expect(r.every((t) => !t.front)).toBe(true);
  });

  it("사슬 A–B 겹침, B–C 겹침, A–C 안 겹침: 자기가 겹친 모두의 위에 있는 것만 front 다", () => {
    // A [0,100] B [60,160] C [120,220] — A–B, B–C 겹침, A–C 안 겹침.
    // 순위: C(위) > B > A  → C 는 B 의 위(겹친 모두의 위)라 front, B 는 C 아래라 아니다, A 는 B 아래라 아니다
    const r = rankTags([box(0, { x: 50, foot: 100 }), box(1, { x: 110, foot: 200 }), box(2, { x: 170, foot: 300 })]);
    expect(frontOf(r, 2)).toBe(true);
    expect(frontOf(r, 1)).toBe(false);
    expect(frontOf(r, 0)).toBe(false);
  });

  it("사슬에서 가운데가 가장 위면 가운데만 front 다", () => {
    const r = rankTags([box(0, { x: 50, foot: 100 }), box(1, { x: 110, foot: 300 }), box(2, { x: 170, foot: 200 })]);
    expect(r.filter((t) => t.front).map((t) => t.seat)).toEqual([1]);
  });

  it("서로 떨어진 두 무리는 무리마다 맨 앞이 하나씩 있다", () => {
    const r = rankTags([box(0, { x: 50 }), box(1, { x: 50 }), box(2, { x: 600 }), box(3, { x: 600 })]);
    expect(r.filter((t) => t.front).map((t) => t.seat).sort()).toEqual([1, 3]);
  });
});

describe("rankTags 선두 가산 (08-12)", () => {
  it("lead 이름표는 순위에 10 이 더해져 내 이름표보다도 위다", () => {
    const r = rankTags([box(0, { me: true, foot: 400 }), box(1, { foot: 100, lead: true }), box(2, { foot: 200 })]);
    expect(zOf(r, 1)).toBe(0 + 10);
    expect(zOf(r, 0)).toBe(2);
    expect(zOf(r, 1)).toBeGreaterThan(zOf(r, 0));
  });

  it("겹친 이름표 가운데 lead 가 맨 앞이다", () => {
    const r = rankTags([box(0, { me: true }), box(1, { lead: true })]);
    expect(frontOf(r, 1)).toBe(true);
    expect(frontOf(r, 0)).toBe(false);
  });

  it("lead 가 없으면 지금 순위 그대로다(0 부터 n−1)", () => {
    const r = rankTags([box(0, { foot: 100 }), box(1, { foot: 200 }), box(2, { foot: 300 })]);
    expect(r.map((t) => t.z)).toEqual([0, 1, 2]);
  });
});
