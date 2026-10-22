// RED 단계의 임시 골격: 일부러 틀리게 두어 테스트가 단언에서 실패하게 한다. GREEN 에서 채운다.
export const ROOM_CODE_PATTERN = /^\d{4}$/;

export function isRoomCode(_s: string): boolean {
  return false;
}

export function generateRoomCode(_randInt: (n: number) => number): string {
  return "";
}
