// RED 단계의 자리표시 구현: 구성표 데이터만 있고 배정은 아직 없다. 다음 커밋(feat)에서 채운다.
export type RoleId = "mafia" | "police" | "doctor" | "citizen";
export const ROLE_IDS: readonly RoleId[] = ["mafia", "police", "doctor", "citizen"];

export const ROLE_TABLE: Readonly<Record<4 | 5 | 6 | 7 | 8, Readonly<Record<RoleId, number>>>> = Object.freeze({
  4: Object.freeze({ mafia: 1, police: 1, doctor: 0, citizen: 2 }),
  5: Object.freeze({ mafia: 1, police: 1, doctor: 1, citizen: 2 }),
  6: Object.freeze({ mafia: 2, police: 1, doctor: 1, citizen: 2 }),
  7: Object.freeze({ mafia: 2, police: 1, doctor: 1, citizen: 3 }),
  8: Object.freeze({ mafia: 2, police: 1, doctor: 1, citizen: 4 }),
});

export function assignRoles(_playerIds: readonly string[], _randInt: (n: number) => number): Map<string, RoleId> {
  return new Map();
}
