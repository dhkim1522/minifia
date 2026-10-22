// RED 단계의 자리표시 구현. 다음 커밋(feat)에서 채운다.
export const SEAT_COUNT = 8;
export interface SeatPosition {
  slot: number;
  x: number;
  y: number;
  scale: number;
  z: number;
  depth: number;
}

export function seatLayout(_seat: number, _mySeat: number, _total = SEAT_COUNT, _rx = 40, _ry = 22): SeatPosition {
  return { slot: 0, x: 0, y: 0, scale: 0, z: 0, depth: 0 };
}
