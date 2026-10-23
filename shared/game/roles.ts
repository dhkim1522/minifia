// 역할 구성표와 무작위 배정(ROLE-01). 구성표는 이 파일 한 곳에만 둔다(v2 ROLEX-01 방장 조정 대비).
// 이 모듈은 난수를 스스로 만들지 않는다 — 서버는 worker/random.ts 의 cryptoRandInt 를,
// 테스트는 test/helpers/seededRandom.ts 의 seededRandInt 를 randInt 로 넘긴다.
// 화면용 역할 이름·설명 문구는 여기에 두지 않는다(src/game/roleText.ts).

export type RoleId = "mafia" | "police" | "doctor" | "citizen";
export const ROLE_IDS: readonly RoleId[] = ["mafia", "police", "doctor", "citizen"];

type PlayerCount = 4 | 5 | 6 | 7 | 8;

export const ROLE_TABLE: Readonly<Record<PlayerCount, Readonly<Record<RoleId, number>>>> = Object.freeze({
  4: Object.freeze({ mafia: 1, police: 1, doctor: 0, citizen: 2 }),
  5: Object.freeze({ mafia: 1, police: 1, doctor: 1, citizen: 2 }),
  6: Object.freeze({ mafia: 2, police: 1, doctor: 1, citizen: 2 }),
  7: Object.freeze({ mafia: 2, police: 1, doctor: 1, citizen: 3 }),
  8: Object.freeze({ mafia: 2, police: 1, doctor: 1, citizen: 4 }),
});

function isSupportedCount(n: number): n is PlayerCount {
  return Number.isInteger(n) && n >= 4 && n <= 8;
}

/**
 * 이번 판에 나오는 직업 목록(공개 정보, D-07). ROLE_TABLE 에서만 파생해 개수가 0 보다 큰 직업을
 * ROLE_IDS 순서(mafia·police·doctor·citizen)로 돌려준다. 지원하지 않는 인원은 예외 대신 빈 배열이다.
 * 직업 칩·"[○○]는 [직업]이었어요"·서버 검증이 모두 이 목록을 쓴다 — 구성표 밖에 두 번째 목록을 만들지 않는다.
 */
export function rolesInPlay(playerCount: number): RoleId[] {
  if (!isSupportedCount(playerCount)) return [];
  const composition = ROLE_TABLE[playerCount];
  return ROLE_IDS.filter((role) => composition[role] > 0);
}

/**
 * 인원에 맞는 역할 풀을 Fisher–Yates 로 섞어 입력 순서대로 나눠 준다.
 * randInt(k) 는 [0,k) 정수를 돌려줘야 하며, 그 밖의 값이 오면 RangeError 로 잘못된 난수원을 거부한다.
 */
export function assignRoles(playerIds: readonly string[], randInt: (n: number) => number): Map<string, RoleId> {
  const count = playerIds.length;
  if (!isSupportedCount(count)) {
    throw new RangeError(`assignRoles: ${count}명은 지원하지 않는 인원이다 (4~8명)`);
  }
  if (new Set(playerIds).size !== count) {
    throw new RangeError("assignRoles: 플레이어 ID 가 중복되었다");
  }
  const composition = ROLE_TABLE[count];
  const pool: RoleId[] = [];
  for (const role of ROLE_IDS) {
    for (let i = 0; i < composition[role]; i += 1) pool.push(role);
  }
  for (let i = pool.length - 1; i >= 1; i -= 1) {
    const k = i + 1;
    const j = randInt(k);
    if (!Number.isInteger(j) || j < 0 || j >= k) {
      throw new RangeError(`assignRoles: randInt(${k}) 가 [0,${k}) 밖의 값 ${j} 을 돌려줬다`);
    }
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const assigned = new Map<string, RoleId>();
  playerIds.forEach((id, index) => assigned.set(id, pool[index]!));
  return assigned;
}
