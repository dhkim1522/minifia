import type { CSSProperties } from "react";
import "../../styles/v2.css";
import type { SpotId } from "../../../shared/protocol";
import { spotLabel } from "../../game/sceneText";
import type { DimWhy, SpotState } from "../../game/sceneView";
import { V2Icon } from "./V2Icon";
import type { V2IconName } from "./V2Icon";

// 아침 현장의 단서 지점 표지(21페이즈 D-13·D-26, UI-SPEC P21-10): 지름 52(누르기 52 ≥ 44) 원 + 안 아이콘 28(발자국 footprint · 옷 조각 thread · 창문 window).
// 상태 넷: 새(금빛 2px 테두리·번짐, 빛남이면 is-call 깜빡임) · 내가 살핌(어두운 면 + 테두리 gray-500 + check 배지) · 어두워서 못 봄·먼저 손댄 흔적(점선 gray-500·불투명도 .6, 둘은 **같은 모양** — 이유를 모양으로 가르지 않는다).
// 화면에는 장소 이름·설명 글자가 없다(접근성 이름에만 "{지점} 지점, {상태}"). 누르면 그 지점으로 걷는다(ErrandMarker 의 onWalk 와 같은 E-4 면제 — 살피기는 [살펴보기] 알약으로만 한다).
// 마피아도 시민과 같은 마크업을 받는다(D-15·D-21): 이 부품은 역할·좌석 prop 이 없고 같은 입력에 같은 DOM 을 낸다. 속성 값은 지점 id·상태뿐이다.
// 위치(style·transform)는 맵 투영을 아는 층(WorldStage)이 프레임마다 쓴다 — 이 부품은 그리기만 한다.

/** 지점 id → 안 아이콘. 옷 조각은 16 튜토리얼·증거 카드와 같은 thread 기호를 쓴다 */
export const SPOT_ICON: Readonly<Record<SpotId, V2IconName>> = {
  footprint: "footprint",
  cloth: "thread",
  window: "window",
};

export interface ClueSpotProps {
  id: SpotId;
  state: SpotState;
  /** 점선(dim) 상태의 사유 — 접근성 이름에만 쓴다(모양은 같다) */
  why?: DimWhy;
  /** 빛남(is-call): 아직 안 살핀(new) 지점이 [살펴보기] 대신 할 일일 때 */
  call: boolean;
  /** 눌러 그 지점으로 걷는다 */
  onWalk: () => void;
  style?: CSSProperties;
  /** 처음 마운트 때 숨김(투영 전). 이후 hidden 은 맵 층이 프레임마다 DOM 에 직접 쓴다 — 값이 늘 같아 React 가 다시 쓰지 않는다 */
  hidden?: boolean;
}

export function ClueSpot({ id, state, why, call, onWalk, style, hidden }: ClueSpotProps) {
  return (
    <button
      type="button"
      className={call ? "mv-clue-spot is-call" : "mv-clue-spot"}
      data-clue-spot={id}
      data-state={state}
      data-call={call ? "" : undefined}
      aria-label={spotLabel(id, state, why)}
      style={style}
      hidden={hidden}
      onClick={onWalk}
    >
      <V2Icon name={SPOT_ICON[id]} size={28} />
      {state === "done" ? (
        <span className="mv-clue-spot__badge" aria-hidden="true">
          <V2Icon name="check" size={14} />
        </span>
      ) : null}
    </button>
  );
}
