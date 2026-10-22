// 방 코드: 앞자리 0 을 허용하는 4자리 숫자. 난수는 호출하는 쪽이 넣는다(서버는 암호학적 난수).
export const ROOM_CODE_PATTERN = /^\d{4}$/;

export function isRoomCode(s: string): boolean {
  return ROOM_CODE_PATTERN.test(s);
}

/** randInt(n) 은 [0, n) 의 정수를 돌려주는 함수. 항상 인자 10 으로 네 번 부른다. */
export function generateRoomCode(randInt: (n: number) => number): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += String(randInt(10));
  }
  return code;
}
