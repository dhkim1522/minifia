import type { CSSProperties } from "react";
import "../../styles/v2.css";
import type { ClueSpotId } from "../../../shared/protocol";
import type { SpotState } from "../../game/causalView";
import { V2Icon } from "./V2Icon";
import type { V2IconName } from "./V2Icon";

// 21페이즈 아침 현장의 단서 지점 표식(P21-13, D-13·D-15·D-26, 승인 시안 design/v3.0/lamp-house/Scene.dc.html): 지름 52 원 + 가운데 26 선 아이콘.
// 이 부품에는 역할·좌석 prop 이 없다. 상태(fresh·done·blurred)는 "내가 살핀 결과"(me.clues)이고 살피기 전에는 모든 지점이 같은 fresh 모양이다 — 같은 입력이면 같은 DOM.
// 위치(style·transform)는 맵 투영을 아는 층(WorldStage)이 프레임마다 쓴다 — 이 부품은 그리기만 한다(ErrandMarker 와 같은 방식).

export interface ClueSpotProps {
  /** 지점 번호: ① 발자국 ② 옷 조각 ③ 창문 */
  spot: ClueSpotId;
  /** fresh 안 살핌 · done 살핌 · blurred 먼저 손댄 흔적을 받음 */
  state: SpotState;
  /** 가장 가까운 안 살핀 한 곳의 빛남(is-call) */
  call?: boolean;
  /** 눌러 그 지점으로 걷는다(살피기는 독의 [살펴보기] 로만 한다) */
  onWalk: () => void;
  style?: CSSProperties;
  /** 처음 마운트 때 숨김(투영 전). 이후 hidden 은 맵 층이 프레임마다 DOM 에 직접 쓴다 */
  hidden?: boolean;
}

const ICON: Readonly<Record<ClueSpotId, V2IconName>> = { 1: "footprint", 2: "cloth", 3: "window" };
const NAME: Readonly<Record<ClueSpotId, string>> = { 1: "발자국", 2: "옷 조각", 3: "창문" };

/** 접근성 이름: fresh '발자국 살펴보기' · done '발자국 살핌' · blurred '먼저 손댄 흔적' */
function labelOf(spot: ClueSpotId, state: SpotState): string {
  if (state === "blurred") return "먼저 손댄 흔적";
  return state === "done" ? `${NAME[spot]} 살핌` : `${NAME[spot]} 살펴보기`;
}

export function ClueSpot({ spot, state, call = false, onWalk, style, hidden }: ClueSpotProps) {
  return (
    <button
      type="button"
      className={call ? "mv-clue-spot is-call" : "mv-clue-spot"}
      data-clue-spot={spot}
      data-state={state}
      data-call={call ? "" : undefined}
      aria-label={labelOf(spot, state)}
      style={style}
      hidden={hidden}
      onClick={onWalk}
    >
      <V2Icon name={ICON[spot]} size={26} />
      {state === "done" ? (
        <span className="mv-clue-spot__badge" aria-hidden="true">
          <V2Icon name="check" size={12} />
        </span>
      ) : null}
    </button>
  );
}
