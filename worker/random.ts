// 암호학적 난수만 쓴다. Math.random 이나 시각 시드는 쓰지 않는다.

/** 균등한 정수 [0, n). 거부 샘플링으로 모듈로 편향을 없앤다. */
export function cryptoRandInt(n: number): number {
  if (!Number.isInteger(n) || n <= 0 || n > 0x1_0000_0000) {
    throw new RangeError("cryptoRandInt: n must be an integer in 1..2^32");
  }
  const range = 0x1_0000_0000; // Uint32 가 가질 수 있는 값의 개수
  const limit = range - (range % n); // 이 값 이상은 버리고 다시 뽑는다
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    const v = buf[0]!;
    if (v < limit) return v % n;
  }
}

/** 32바이트 난수를 base64url(패딩 없음, 43자)로. 플레이어 토큰으로 쓴다. */
export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
