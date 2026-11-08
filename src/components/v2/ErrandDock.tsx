import "../../styles/v2.css";
import type { PlaceId } from "../../../shared/protocol";
import { progressLabel } from "../../game/errandView";
import { V2Icon } from "./V2Icon";

// 심부름 전용 아래 패널(15페이즈 U-1·U-2): 진행 칩 N + "n/N". 16-07 에서 [처리] 단추를 지웠다 — 처리 입구는 장소 위 알약(ErrandAct) 하나다.
// 독 자체는 16-08 이 진행 점으로 바꾸며 지운다. 채팅 입력·동작은 없다.
// 마피아도 시민과 같은 마크업이다(D-03) — 역할·좌석 prop 이 없고 같은 입력에 같은 DOM 을 낸다. 속성 값은 진행 수뿐이다(D-08).

export interface ErrandDockProps {
  /** 내 목록 장소(순서에 뜻 없음). 비면 아무것도 그리지 않는다 */
  places: readonly PlaceId[];
  /** 처리한 장소 */
  done: readonly PlaceId[];
}

export function ErrandDock({ places, done }: ErrandDockProps) {
  const total = places.length;
  if (total === 0) return null;
  const n = Math.min(done.length, total);
  const label = progressLabel(n, total);
  return (
    <section className="mv-errand-dock" data-errand-dock="">
      <div className="mv-errand-dock__chips" role="group" aria-label={label}>
        {places.map((_, i) => {
          const filled = i < n;
          return (
            <span key={i} className="mv-errand-chip" data-errand-chip={String(i + 1)} data-done={filled ? "" : undefined}>
              {filled ? <V2Icon name="check" size={20} /> : null}
            </span>
          );
        })}
      </div>
      <span className="mv-errand-dock__count" data-errand-progress={`${n}/${total}`} aria-hidden="true">
        {n}/{total}
      </span>
      <span className="mv-errand-dock__sr" aria-live="polite">
        {label}
      </span>
    </section>
  );
}
