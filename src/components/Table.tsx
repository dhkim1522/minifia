// RED 단계 자리표시자: 테스트가 불러올 수 있게 모양만 둔다. 그리기는 GREEN 에서 채운다.
export interface TableSeat {
  nickname: string;
  connected: boolean;
  isHost: boolean;
  isMe: boolean;
  isAlly: boolean;
  transition?: "entering" | "leaving" | null;
  pressable?: boolean;
}

export function Table(_p: {
  seats: (TableSeat | null)[];
  mySeat: number;
  dimmed?: boolean;
  onSeatPress?: (seat: number) => void;
  label?: string;
}) {
  return <div role="group" aria-label="테이블" />;
}
