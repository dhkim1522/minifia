// 자리 배치(D-09, D-24): 각자 폰에서 내 자리를 맨 아래 가운데로 돌린 원근 타원 좌표.
// 반환값은 퍼센트 좌표라 화면 부품이 그대로 left/top 에 쓴다. 앱·워커 공용이라 DOM 을 쓰지 않는다.

export const SEAT_COUNT = 8;

export interface SeatPosition {
  /** 0 = 나, 이후 둘러앉은 순서대로 */
  slot: number;
  x: number;
  y: number;
  scale: number;
  z: number;
  /** 0(맨 뒤) ~ 1(맨 앞) */
  depth: number;
}

export function seatLayout(
  seat: number,
  mySeat: number,
  total: number = SEAT_COUNT,
  rx: number = 40,
  ry: number = 22,
): SeatPosition {
  const slot = (((seat - mySeat) % total) + total) % total;
  // 화면 좌표는 아래가 +y 라 90° 가 맨 아래다.
  const theta = Math.PI / 2 + (slot / total) * Math.PI * 2;
  const depth = (Math.sin(theta) + 1) / 2;
  return {
    slot,
    x: 50 + rx * Math.cos(theta),
    y: 50 + ry * Math.sin(theta),
    scale: 0.62 + 0.38 * depth,
    z: Math.round(depth * 10),
    depth,
  };
}
