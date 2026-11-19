import { Children } from "react";
import type { ReactNode } from "react";
import "../../styles/v2.css";
import { splitSideColumn } from "./SideColumn";

// 방장 전용 왼쪽 세로 줄 (19-03, D-13·D-14, UI-SPEC A·F-2, 시안 A design/v3.0/host-rail/Main.dc.html).
// 방장에게만 그린다(참가자 화면에는 마크업이 없다 — 부르는 쪽이 서버 view 의 isHost 로만 판정한다). 왼쪽 16, 위는 오른쪽 열(SideColumn)과 같은 높이, 칸 지름 52·간격 12.
// 왼쪽 조작에 별도 장식을 두지 않는다. 열 높이를 넘으면 오른쪽과 같은 접기 규칙을 쓰고 접근성 이름은 유지한다.
// 테스트 방은 같은 왼쪽 위 자리의 [테스트] 단추 아래로 내려온다(testShift → data-test-shift, P19-5).
// 표식 값은 고정 낱말뿐이다(역할·좌석 없음).

/** 방장 줄의 접근성 이름 */
export const HOST_RAIL_LABEL = "방장 전용";

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
  const columns = splitSideColumn(items.length, maxHeight);
  let at = 0;
  return (
    <div className="mf-hostrail" data-host-rail="" role="group" aria-label={HOST_RAIL_LABEL} {...(testShift ? { "data-test-shift": "" } : {})}>
      <div className="mf-hostrail__cols">
        {columns.map((count, i) => {
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
