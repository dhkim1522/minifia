export const TABLE_COUNTS = [4, 5, 6, 7, 8] as const;
export type TableCount = typeof TABLE_COUNTS[number];

// 내 자리부터 시계 방향으로 배치한 실제 의자 인덱스.
const clockwiseSeats = [0, 3, 5, 7, 2, 6, 4, 1] as const;

// 정면 자리를 유지하고 빈자리가 연달아 생기지 않게 한다.
const occupiedByCount: Readonly<Record<TableCount, readonly number[]>> = {
  4: [0, 2, 4, 6],
  5: [0, 2, 4, 6, 7],
  6: [0, 1, 3, 4, 5, 7],
  7: [0, 1, 2, 3, 4, 5, 7],
  8: [0, 1, 2, 3, 4, 5, 6, 7],
};

export function isTableCount(value: number): value is TableCount {
  return TABLE_COUNTS.some(count => count === value);
}

export function occupiedSlots(count: TableCount): readonly number[] {
  return occupiedByCount[count].map(index => clockwiseSeats[index]!).sort((a, b) => a - b);
}
