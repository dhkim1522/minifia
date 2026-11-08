import type { CSSProperties } from "react";
import "../../styles/v2.css";
import type { PlaceId } from "../../../shared/protocol";
import { ERRAND_TEXT } from "../../game/errandView";
import { PLACE_NAME } from "../../game/placeText";
import { V2Icon } from "./V2Icon";

// 처리 반경 안 미처리 장소 위에 뜨는 [처리] 알약(16페이즈 D-06, UI-SPEC V-22). 반경 밖에서는 DOM 에 없다(쓰는 쪽이 그리지 않는다).
// 마피아도 시민과 같은 마크업(V-25): 역할·좌석·가짜 prop 이 없고 장소 id 하나만 받는다. 누르면 필드 없는 처리 메시지만 보낸다(T-16-16).
// 위치는 맵 층(WorldStage)이 프레임마다 DOM 에 쓴다.

export interface ErrandActProps {
  /** 처리할 장소(접근성 이름에만 쓴다) */
  id: PlaceId;
  /** 빛남(14 의 is-call): 처리 반경 안에 미처리가 있을 때의 그 한 개 */
  call: boolean;
  onPress: () => void;
  style?: CSSProperties;
  /** 처음 마운트 때 숨김(위치를 아직 모른다). 이후 hidden 은 맵 층이 DOM 에 직접 쓴다 */
  hidden?: boolean;
}

export function ErrandAct({ id, call, onPress, style, hidden }: ErrandActProps) {
  return (
    <button
      type="button"
      className={call ? "mv-errand-act is-call" : "mv-errand-act"}
      data-errand-act=""
      data-call={call ? "" : undefined}
      aria-label={`${PLACE_NAME[id]}에서 처리`}
      style={style}
      hidden={hidden}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
    >
      <V2Icon name="hand" size={16} />
      {ERRAND_TEXT.act}
    </button>
  );
}
