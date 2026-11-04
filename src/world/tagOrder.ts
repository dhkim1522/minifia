// 이름표 순위와 맨 앞 겹침 판정(06-22, G-06-4). 순수 함수 — three 도 DOM 도 가져오지 않는다.
import { NAMETAG_H } from "./camera";

/** 이름표 하나의 판정 입력. x 는 가운데, bottom 은 아래 끝(화면 px), foot 은 발끝 화면 y */
export interface TagBox {
  seat: number;
  me: boolean;
  foot: number;
  x: number;
  bottom: number;
  w: number;
  /** 최다 득표 선두의 이름표(08-12): 순위에 LEAD_Z_BOOST 를 더해 내 이름표보다도 위에 둔다 */
  lead?: boolean;
  /** 지목에서 지금 차례인 사람의 이름표(09.1-07, UI-SPEC A-1): lead 와 같은 가산을 받는다(둘 다여도 한 번만) */
  turn?: boolean;
}

/** 선두·차례 이름표가 다른 이름표(0~7)보다 높게 놓이도록 순위에 더하는 값 */
export const LEAD_Z_BOOST = 10;

export interface TagRank {
  seat: number;
  /** 0 = 맨 뒤 */
  z: number;
  /** 다른 이름표와 겹치고, 겹친 모든 이름표보다 위에 있다 */
  front: boolean;
}

/**
 * z 순위: 내 이름표가 맨 위, 나머지는 발끝 화면 y 가 큰 쪽이 위(동점이면 seat 이 큰 쪽). lead·turn 은 순위에 10 을 더한다(선두·차례 이름표가 겹쳐도 가려지지 않게).
 * front: 이름표 사각형 [x − w/2, x + w/2] × [bottom − h, bottom] 이 면적을 가지고 겹치는(변만 맞닿으면 아님)
 * 이름표 가운데, 겹친 모두보다 z 가 높은 것만 true. 이름표를 밀지 않는다.
 */
export function rankTags(boxes: readonly TagBox[], h: number = NAMETAG_H): TagRank[] {
  const order = [...boxes].sort((p, q) => Number(p.me) - Number(q.me) || p.foot - q.foot || p.seat - q.seat);
  const z = new Map<TagBox, number>();
  order.forEach((b, rank) => z.set(b, rank + (b.lead === true || b.turn === true ? LEAD_Z_BOOST : 0)));
  const overlap = (p: TagBox, q: TagBox): boolean =>
    Math.abs(p.x - q.x) < (p.w + q.w) / 2 && Math.abs(p.bottom - q.bottom) < h;
  return boxes.map((b) => {
    const mine = z.get(b) ?? 0;
    let touching = false;
    let above = true;
    for (const o of boxes) {
      if (o === b || !overlap(b, o)) continue;
      touching = true;
      if ((z.get(o) ?? 0) > mine) above = false;
    }
    return { seat: b.seat, z: mine, front: touching && above };
  });
}
