import { describe, expect, it } from "vitest";
import { assignRoles, ROLE_IDS, ROLE_TABLE, rolesInPlay, type RoleId } from "../../shared/game/roles";
import { seededRandInt } from "../helpers/seededRandom";

const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `p${i}`);

function countRoles(assigned: Map<string, RoleId>): Record<RoleId, number> {
  const c: Record<RoleId, number> = { mafia: 0, police: 0, doctor: 0, citizen: 0 };
  for (const role of assigned.values()) c[role] += 1;
  return c;
}

describe("assignRoles - 구성표", () => {
  it.each([4, 5, 6, 7, 8] as const)("%i명의 역할 수가 구성표와 정확히 같다", (n) => {
    const assigned = assignRoles(ids(n), seededRandInt(42));
    expect(countRoles(assigned)).toEqual(ROLE_TABLE[n]);
  });

  it.each([4, 5, 6, 7, 8])("%i명 모두가 역할을 하나씩 받는다", (n) => {
    const input = ids(n);
    const assigned = assignRoles(input, seededRandInt(42));
    expect([...assigned.keys()].sort()).toEqual([...input].sort());
    for (const role of assigned.values()) expect(ROLE_IDS).toContain(role);
  });

  it("구성표 값이 요구사항(ROLE-01)과 같다", () => {
    expect(ROLE_TABLE[4]).toEqual({ mafia: 1, police: 1, doctor: 0, citizen: 2 });
    expect(ROLE_TABLE[5]).toEqual({ mafia: 1, police: 1, doctor: 1, citizen: 2 });
    expect(ROLE_TABLE[6]).toEqual({ mafia: 2, police: 1, doctor: 1, citizen: 2 });
    expect(ROLE_TABLE[7]).toEqual({ mafia: 2, police: 1, doctor: 1, citizen: 3 });
    expect(ROLE_TABLE[8]).toEqual({ mafia: 2, police: 1, doctor: 1, citizen: 4 });
  });
});

describe("assignRoles - 난수", () => {
  it("같은 시드는 같은 결과를 낸다", () => {
    const a = assignRoles(ids(6), seededRandInt(7));
    const b = assignRoles(ids(6), seededRandInt(7));
    expect([...a]).toEqual([...b]);
  });

  it("시드가 다르면 결과가 달라질 수 있다", () => {
    const results = new Set<string>();
    for (let seed = 1; seed <= 20; seed += 1) {
      results.add(JSON.stringify([...assignRoles(ids(6), seededRandInt(seed))]));
    }
    expect(results.size).toBeGreaterThan(1);
  });

  it("5명이 2000번 배정되면 각자 마피아가 될 비율이 0.15~0.25 다", () => {
    const input = ids(5);
    const mafiaCount = new Map(input.map((id) => [id, 0]));
    for (let seed = 1; seed <= 2000; seed += 1) {
      for (const [id, role] of assignRoles(input, seededRandInt(seed))) {
        if (role === "mafia") mafiaCount.set(id, (mafiaCount.get(id) ?? 0) + 1);
      }
    }
    for (const count of mafiaCount.values()) {
      const rate = count / 2000;
      expect(rate).toBeGreaterThanOrEqual(0.15);
      expect(rate).toBeLessThanOrEqual(0.25);
    }
  });

  it("randInt 에는 항상 2 이상 n 이하의 인자만 넘긴다", () => {
    const seen: number[] = [];
    const inner = seededRandInt(3);
    assignRoles(ids(6), (k) => {
      seen.push(k);
      return inner(k);
    });
    expect(seen.length).toBeGreaterThan(0);
    for (const k of seen) {
      expect(k).toBeGreaterThanOrEqual(2);
      expect(k).toBeLessThanOrEqual(6);
    }
  });

  it("randInt 가 [0,k) 밖의 값을 돌려주면 RangeError", () => {
    expect(() => assignRoles(ids(5), (k) => k)).toThrow(RangeError);
    expect(() => assignRoles(ids(5), () => -1)).toThrow(RangeError);
    expect(() => assignRoles(ids(5), () => 0.5)).toThrow(RangeError);
  });
});

describe("assignRoles - 범위 밖 인원", () => {
  it.each([0, 3, 9])("%i명은 RangeError", (n) => {
    expect(() => assignRoles(ids(n), seededRandInt(1))).toThrow(RangeError);
  });
});

describe("assignRoles - 입력 검증", () => {
  it("플레이어 ID 가 중복되면 RangeError", () => {
    expect(() => assignRoles(["a", "b", "c", "a"], seededRandInt(1))).toThrow(RangeError);
  });
});

describe("seededRandInt", () => {
  it("같은 시드는 같은 수열을 낸다", () => {
    const a = seededRandInt(99);
    const b = seededRandInt(99);
    expect(Array.from({ length: 10 }, () => a(100))).toEqual(Array.from({ length: 10 }, () => b(100)));
  });

  it("결과는 항상 [0,n) 정수다", () => {
    const r = seededRandInt(5);
    for (let i = 0; i < 500; i += 1) {
      const v = r(7);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
  });
});

describe("rolesInPlay - 이번 판 직업 목록 (D-07)", () => {
  it("4명은 의사 없이 마피아·경찰·시민이다", () => {
    expect(rolesInPlay(4)).toEqual(["mafia", "police", "citizen"]);
  });

  it.each([5, 6, 7, 8])("%i명은 마피아·경찰·의사·시민 넷 모두다", (n) => {
    expect(rolesInPlay(n)).toEqual(["mafia", "police", "doctor", "citizen"]);
  });

  it.each([0, 3, 9, 4.5, -1, Number.NaN])("지원하지 않는 인원 %s 은 빈 배열이다", (n) => {
    expect(rolesInPlay(n)).toEqual([]);
  });

  it("구성표에서만 파생한다 — 모든 지원 인원에서 개수가 0 보다 큰 직업과 정확히 같다", () => {
    for (const n of [4, 5, 6, 7, 8] as const) {
      const want = ROLE_IDS.filter((r) => ROLE_TABLE[n][r] > 0);
      expect(rolesInPlay(n)).toEqual(want);
    }
  });
});
