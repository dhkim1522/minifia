// 찬반 기록 카드(k "ballots") 본문 형식(결정 0066-3). 서버가 처형 진입 때 all 채널에 한 번 내고, 화면이 같은 파일로 읽는다.
// 본문은 좌석 번호뿐이다 — 역할·이름·시각을 싣지 않는다(공개 정보). 형식: `찬성좌석들|반대좌석들`, 쉼표 구분, 한쪽이 비면 빈 문자열.
// 순수 모듈이다: 시각·난수를 읽지 않고 DOM·workerd API 가 없다(앱·워커 두 tsconfig 에 모두 들어간다).
import { MAX_PLAYERS } from "../protocol";

export interface BallotsLists {
  yes: number[];
  no: number[];
}

/** 카드 본문 한 줄. */
export function ballotsCardText(ballots: BallotsLists): string {
  return `${ballots.yes.join(",")}|${ballots.no.join(",")}`;
}

/** 쉼표로 나눈 좌석 목록. 빈 문자열은 빈 목록, 정수 0..MAX_PLAYERS-1 이 아니거나 중복이 있으면 null. */
function seatsOf(part: string): number[] | null {
  if (part === "") return [];
  const out: number[] = [];
  for (const piece of part.split(",")) {
    if (!/^[0-7]$/.test(piece)) return null;
    const seat = Number(piece);
    if (seat >= MAX_PLAYERS || out.includes(seat)) return null;
    out.push(seat);
  }
  return out;
}

/** 본문을 목록으로. 모양이 틀리면 null(구분자는 정확히 하나). */
export function parseBallotsCardText(text: string): BallotsLists | null {
  const parts = text.split("|");
  if (parts.length !== 2) return null;
  const yes = seatsOf(parts[0]!);
  const no = seatsOf(parts[1]!);
  if (yes === null || no === null) return null;
  return { yes, no };
}
