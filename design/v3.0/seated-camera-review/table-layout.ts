import { barChairAssignment } from "../../../shared/game/map";

export const TABLE_COUNTS = [4, 5, 6, 7, 8] as const;
export type TableCount = typeof TABLE_COUNTS[number];

export function isTableCount(value: number): value is TableCount {
  return TABLE_COUNTS.some(count => count === value);
}

export function occupiedSlots(count: TableCount): readonly number[] {
  const seats = Array.from({ length: count }, (_, seat) => seat);
  const chairs = barChairAssignment(seats);
  return seats.map(seat => chairs[seat]!);
}
