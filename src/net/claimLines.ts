import type { ChatLine, RoomView } from "../../shared/protocol";

// 오늘 공개된 주장(claimLog) → 합성 채팅 줄(D-04, D-05). 서버는 주장 문장을 chat 프레임으로 보내지 않는다 —
// 서버가 보낸 직업 키에서 화면이 만든다. 그래서 재접속해도 그날 줄이 복원되고 일차가 바뀌면 사라진다.
// 문장은 만들지 않는다(messageText 가 template 으로 만든다). seq 는 음수 — 실제 채팅 번호(≥ 1)와 겹치지 않아
// MessageLog 의 React key 가 안전하고, 오름차순이라 주장 줄은 항상 받은 채팅 줄 앞에 놓인다.
export function claimLinesOf(view: RoomView | null): ChatLine[] {
  const day = view?.day;
  if (!day) return [];
  const today = day.claimLog.filter((entry) => entry.n === day.n);
  return today.map((entry, i): ChatLine => {
    const seq = i - today.length; // -today.length .. -1
    return entry.claim === "none"
      ? { seq, seat: entry.seat, template: "claimNone", at: 0 }
      : { seq, seat: entry.seat, template: "claimRole", claimedRole: entry.claim, at: 0 };
  });
}
