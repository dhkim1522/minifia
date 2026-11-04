// 찬반 기록 공개의 목록 모델(UI-SPEC C-2, 결정 0066-3). 입력은 서버가 처형 단계에 모두에게 보낸 day.ballots 와
// 공개 players(좌석·닉네임)뿐이다 — 역할·관전 정보를 읽지 않는다(T-09.1.1-33). 순수: 시각·난수·DOM 을 읽지 않는다.
import type { RoomView } from "../../shared/protocol";
import { seatColorVar } from "../net/assets";

/** 알약 한 개의 근거 */
export interface Voter {
  seat: number;
  name: string;
  /** 자리 구분색 CSS 값 var(--seat-N) */
  color: string;
  /** 보는 사람 자신 */
  me: boolean;
}

export interface BallotLists {
  yes: Voter[];
  no: Voter[];
}

function votersOf(view: Pick<RoomView, "players" | "me">, seats: readonly number[]): Voter[] {
  const out: Voter[] = [];
  for (const seat of [...seats].sort((a, b) => a - b)) {
    const p = view.players.find((x) => x.seat === seat);
    if (!p) continue; // 방에 없는 번호는 건너뛴다
    out.push({ seat, name: p.nickname, color: seatColorVar(seat), me: seat === view.me.seat });
  }
  return out;
}

/** 두 묶음(자리 번호 오름차순 — 투표 순서가 아니다). day.ballots 가 없으면 null */
export function ballotsOf(view: Pick<RoomView, "players" | "me" | "day">): BallotLists | null {
  const b = view.day?.ballots;
  if (!b) return null;
  return { yes: votersOf(view, b.yes), no: votersOf(view, b.no) };
}

const sideText = (label: string, voters: readonly Voter[]): string =>
  voters.length === 0 ? `${label} 0명.` : `${label} ${voters.length}명: ${voters.map((v) => v.name).join(", ")}.`;

/** 스크린리더용 한 줄 "찬성 3명: 지호, 민준, 서연. 반대 2명: 하은, 태오." */
export function ballotsSummary(b: BallotLists): string {
  return `${sideText("찬성", b.yes)} ${sideText("반대", b.no)}`;
}

/** 알약 줄 수 R(두 묶음 합)에 필요한 높이(UI-SPEC C-2: 72 + 40R) */
export function ballotRowsNeed(rows: number): number {
  return 72 + 40 * rows;
}
