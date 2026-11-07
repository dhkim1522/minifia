import type { CSSProperties } from "react";
import "../../styles/v2.css";
import type { PlaceId } from "../../../shared/protocol";
import { placeIconOf, placeLabel } from "../../game/placeText";
import { V2Icon } from "./V2Icon";

// 심부름 장소 표지와 가장자리 화살표 칩(15페이즈, UI-SPEC "심부름 화면 계약"·"장소 표지").
// 마피아도 시민과 같은 마크업을 받는다(D-03): 이 부품은 역할·좌석·가짜 표식 prop 이 없고 같은 입력에 같은 DOM 을 낸다.
// 속성 값은 장소 id 뿐이다(D-08). 장소 이름은 aria-label 에만 있고 화면에 글자로는 없다(React 속성 문자열, 텍스트 노드 아님).
// 위치(style)는 맵 투영을 아는 쪽(15-05 GameMap)이 정한다 — 이 부품은 그리기만 한다.

export interface ErrandMarkerProps {
  id: PlaceId;
  /** 처리한 곳: 면이 gray-100 으로 채워지고 아이콘이 check 로 바뀐다 */
  done: boolean;
  /** 빛남(14 의 is-call): 다음 장소 하나만 */
  call: boolean;
  /** 눌러 그 장소로 걷는다(바닥 탭과 같은 동작). 처리는 [처리] 단추로만 한다 */
  onWalk: () => void;
  style?: CSSProperties;
  /** 처음 마운트 때 숨김(투영 전). 이후 hidden 은 맵 층이 프레임마다 DOM 에 직접 쓴다(15-05) — 값이 늘 같아 React 가 다시 쓰지 않는다 */
  hidden?: boolean;
}

/** 맵 위 장소 표지: 원 지름 36(누르기 44) + 아이콘 20 */
export function ErrandMarker({ id, done, call, onWalk, style, hidden }: ErrandMarkerProps) {
  return (
    <button
      type="button"
      className={call ? "mv-errand-pin is-call" : "mv-errand-pin"}
      data-errand-place={id}
      data-done={done ? "" : undefined}
      data-call={call ? "" : undefined}
      aria-label={placeLabel(id, done)}
      style={style}
      hidden={hidden}
      onClick={onWalk}
    >
      <span className="mv-errand-pin__disc">
        <V2Icon name={done ? "check" : placeIconOf(id)} size={20} />
      </span>
    </button>
  );
}

export interface ErrandArrowProps {
  /** 도(위쪽 0°, 시계 방향) — 스테이지 중심에서 그 장소로 향하는 방향 */
  angle: number;
  call: boolean;
  style?: CSSProperties;
  /** ErrandMarker 의 hidden 과 같다 */
  hidden?: boolean;
}

/** 화면 밖·독 줄에 가려진 다음 장소를 가리키는 칩(지름 36, 눌림 통과, 포커스 없음). 한 개만 그린다 */
export function ErrandArrow({ angle, call, style, hidden }: ErrandArrowProps) {
  return (
    <span className={call ? "mv-errand-arrow is-call" : "mv-errand-arrow"} data-errand-arrow="" data-call={call ? "" : undefined} aria-hidden="true" style={style} hidden={hidden}>
      <span className="mv-errand-arrow__turn" style={{ transform: `rotate(${angle}deg)` }}>
        <V2Icon name="arrow" size={20} />
      </span>
    </span>
  );
}
