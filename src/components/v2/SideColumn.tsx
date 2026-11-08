import { Children } from "react";
import type { ReactNode } from "react";
import "../../styles/v2.css";

// 오른쪽 세로 한 줄 열 (16-06, D-05·V-2~V-5): 소리·맵·봇·옷장이 같은 52 원으로 모인다. 오른쪽 16, 위 = 자막 띠 아랫변 + 12, 칸 사이 12.
// 소리 단추는 자막 띠 독(HostBand)에 남아 있고 그 독이 열의 첫 칸이다 — soundSlot 이면 첫 칸에 52 빈칸을 두어 두 열로 접어도 위부터 채워진다.
// 열의 최대 높이를 넘으면 두 번째 열이 왼쪽 12 옆에 생긴다(한 열 최소 2개). CSS 열 줄바꿈 대신 칸 수를 직접 나눈다(브라우저마다 폭 계산이 달라서).
// 표식 값은 sound·map·bots·dress 고정 낱말뿐이다(역할·좌석 없음).

/** 열 단추 지름(--control-button) */
export const SIDE_CELL = 52;
/** 열 안 칸 사이 간격 */
export const SIDE_GAP = 12;

/**
 * 한 열에 들어가는 칸 수 k = max(min, floor((maxH + gap) / (cell + gap))). 결과는 열마다 칸 수, 오른쪽 열부터.
 * 예: (4, 244) → [4] · (4, 116) → [2, 2] · (5, 116) → [2, 2, 1]. n ≤ k 면 [n], n = 0 이면 [].
 */
export function splitSideColumn(n: number, maxH: number, cell = SIDE_CELL, gap = SIDE_GAP, min = 2): number[] {
  if (!(n > 0)) return [];
  const fit = Number.isFinite(maxH) ? Math.floor((maxH + gap) / (cell + gap)) : n;
  const k = Math.max(min, fit);
  const out: number[] = [];
  for (let left = n; left > 0; left -= k) out.push(Math.min(k, left));
  return out;
}

export interface SideColumnProps {
  /** 첫 칸이 소리 자리(독의 소리 단추 아래)를 비워 두는가 */
  soundSlot: boolean;
  /** 열의 최대 높이(아래 패널 윗변 − 8 − 열 윗변) */
  maxHeight: number;
  /** 위 → 아래 순서의 단추들(null 은 칸이 아니다) */
  children: ReactNode;
}

export function SideColumn({ soundSlot, maxHeight, children }: SideColumnProps) {
  const items: ReactNode[] = Children.toArray(children);
  if (soundSlot) items.unshift(<span key="side-slot" className="mv-side__slot" aria-hidden="true" />);
  let at = 0;
  return (
    <div className="mv-side" data-side-column="">
      {splitSideColumn(items.length, maxHeight).map((count, i) => {
        const col = items.slice(at, at + count);
        at += count;
        return (
          <div key={i} className="mv-side__col">
            {col}
          </div>
        );
      })}
    </div>
  );
}
