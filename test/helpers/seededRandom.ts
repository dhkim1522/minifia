// 테스트 전용 시드 난수(mulberry32). 같은 시드는 항상 같은 수열을 낸다.
// 서버는 이걸 쓰지 않는다 — 실제 배정은 worker/random.ts 의 cryptoRandInt 를 주입한다.
export function seededRandInt(seed: number): (n: number) => number {
  let a = seed >>> 0;
  return (n: number): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const unit = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(unit * n);
  };
}
