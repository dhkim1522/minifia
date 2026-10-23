// 생존 판정 한 곳. 서버 규칙(chat.ts 등)과 화면이 같은 함수를 쓴다 — 3페이즈가 탈락을 더할 때 여기만 보면 된다.
// 입력은 seat 를 가진 구조적 최소 타입이라 서버의 Player 와 뷰의 PublicPlayer 를 모두 넘길 수 있다.
// alive 가 없으면 생존으로 본다(옛 저장 상태·탈락이 없는 이 페이즈 전원).
export function isAlive(p: { seat: number; alive?: boolean }): boolean {
  return p.alive !== false;
}
