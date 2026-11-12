import { Children } from "react";
import type { ReactNode } from "react";
import "../../styles/v2.css";
import { MODE_TEXT } from "../../game/modeText";
import { SIDE_CELL, SIDE_GAP, splitSideColumn } from "./SideColumn";
import { V2Icon } from "./V2Icon";

// 방장 전용 왼쪽 세로 줄 (19-03, D-13·D-14, UI-SPEC A·F-2, 시안 A design/v3.0/host-rail/Main.dc.html).
// 방장에게만 그린다(참가자 화면에는 마크업이 없다 — 부르는 쪽이 서버 view 의 isHost 로만 판정한다). 왼쪽 16, 위는 오른쪽 열(SideColumn)과 같은 높이, 칸 지름 52·간격 12.
// 줄 높이에 따른 세 갈래(F-2) — 줄 최대 높이는 부르는 쪽이 오른쪽 열과 같은 값(sideMaxH)을 준다. 새 측정을 만들지 않는다:
//   ① 표식까지 들어가면(n·52 + (n−1)·12 + 32 ≤ 최대 높이) 한 열 + 왕관 표식
//   ② 표식만 안 들어가면 표식 없는 한 열 — 표식은 장식이라 짧은 폰에서 단추 한 칸을 밀어내지 않는다(P19-2)
//   ③ 그것도 넘으면 오른쪽 열과 같은 접기 규칙(splitSideColumn, 한 열 최소 2칸)의 두 열. 두 번째 열은 첫 열 오른쪽 12 옆이다(P19-3)
// 색만으로 방장 전용을 알리지 않는다 — 왼쪽 자리·왕관 표식·접근성 이름 "방장 전용" 이 함께 말한다. 표식이 빠져도 줄의 이름은 남는다.
// 테스트 방은 같은 왼쪽 위 자리의 [테스트] 단추 아래로 내려온다(testShift → data-test-shift, P19-5).
// 표식 값은 고정 낱말뿐이다(역할·좌석 없음).

/** 왕관 표식 칸 높이 */
const CROWN_H = 20;

export interface HostRailLayout {
  /** 왕관 표식을 그리는가 */
  crown: boolean;
  /** 열마다 칸 수, 왼쪽 열부터 */
  columns: number[];
}

/**
 * 줄 안 단추 수 n 과 줄 최대 높이로 표식 여부와 열을 고른다(UI-SPEC F-2).
 * 예: (4, 276) → 표식 + [4] · (4, 275) → [4] · (4, 243) → [3, 1] · (0, …) → 열 없음. 높이를 아직 모르면(유한하지 않음) 표식 한 열.
 */
export function hostRailLayout(n: number, maxH: number, cell = SIDE_CELL, gap = SIDE_GAP, crown = CROWN_H): HostRailLayout {
  if (!(n > 0)) return { crown: false, columns: [] };
  if (!Number.isFinite(maxH)) return { crown: true, columns: [n] };
  const height = n * cell + (n - 1) * gap;
  if (height + crown + gap <= maxH) return { crown: true, columns: [n] };
  if (height <= maxH) return { crown: false, columns: [n] };
  return { crown: false, columns: splitSideColumn(n, maxH, cell, gap) };
}

export interface HostRailProps {
  /** 줄의 최대 높이(오른쪽 열과 같은 값: 아래 패널 윗변 − 8 − 줄 윗변) */
  maxHeight: number;
  /** 테스트 방: [테스트] 단추 아래로 48 내려온다 */
  testShift?: boolean;
  /** 위 → 아래 순서의 단추들(null 은 칸이 아니다) */
  children: ReactNode;
}

export function HostRail({ maxHeight, testShift, children }: HostRailProps) {
  const items: ReactNode[] = Children.toArray(children);
  // 단추가 하나도 없으면 이름만 있는 빈 줄을 남기지 않는다
  if (items.length === 0) return null;
  const layout = hostRailLayout(items.length, maxHeight);
  let at = 0;
  return (
    <div className="mf-hostrail" data-host-rail="" role="group" aria-label={MODE_TEXT.rail} {...(testShift ? { "data-test-shift": "" } : {})}>
      {layout.crown ? (
        <span className="mf-hostrail__crown" data-host-rail-crown="" role="img" aria-label={MODE_TEXT.rail}>
          <V2Icon name="crown" size={20} />
        </span>
      ) : null}
      <div className="mf-hostrail__cols">
        {layout.columns.map((count, i) => {
          const col = items.slice(at, at + count);
          at += count;
          return (
            <div key={i} className="mf-hostrail__col">
              {col}
            </div>
          );
        })}
      </div>
    </div>
  );
}
