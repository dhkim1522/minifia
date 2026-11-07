import "../../styles/v2.css";
import type { PlaceId } from "../../../shared/protocol";
import { ERRAND_TEXT, progressLabel } from "../../game/errandView";
import { V2Icon } from "./V2Icon";

// 심부름 전용 아래 패널(15페이즈, UI-SPEC U-1·U-2·U-4·U-6): 진행 칩 N + "n/N" + [처리]. 채팅 입력·동작은 없다.
// 마피아도 시민과 같은 마크업이다(D-03) — 역할·좌석 prop 이 없고 같은 입력에 같은 DOM 을 낸다. 속성 값은 진행 수뿐이다(D-08).
// [처리]를 켤지(canAct)는 쓰는 쪽이 정한다(actablePlaceOf 의 화면 거울 판정). 켜지지 않았을 때는 눌러도 onAct 를 부르지 않고 알림도 없다(U-4).
// 3곳을 마치면 같은 단추 요소가 check + "완료" 로 남는다(눌리지 않음, U-6).

export interface ErrandDockProps {
  /** 내 목록 장소(순서에 뜻 없음). 비면 아무것도 그리지 않는다 */
  places: readonly PlaceId[];
  /** 처리한 장소 */
  done: readonly PlaceId[];
  /** 처리 반경 안에 미완료 장소가 있어 [처리] 가 켜지는가 */
  canAct: boolean;
  /** [처리] 빛남(14 의 is-call). 3곳 완료면 무시한다 */
  call: boolean;
  onAct: () => void;
}

export function ErrandDock({ places, done, canAct, call, onAct }: ErrandDockProps) {
  const total = places.length;
  if (total === 0) return null;
  const n = Math.min(done.length, total);
  const complete = done.length >= total;
  const enabled = canAct && !complete;
  const lit = call && !complete;
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
      <button
        type="button"
        className={lit ? "mv-errand-dock__act is-call" : "mv-errand-dock__act"}
        data-errand-act=""
        data-done={complete ? "" : undefined}
        data-call={lit ? "" : undefined}
        aria-disabled={enabled ? undefined : "true"}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (!enabled) return;
          onAct();
        }}
      >
        {complete ? <V2Icon name="check" size={20} /> : null}
        {complete ? ERRAND_TEXT.done : ERRAND_TEXT.act}
      </button>
    </section>
  );
}
