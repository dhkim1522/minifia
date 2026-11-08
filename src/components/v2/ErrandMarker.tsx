import type { CSSProperties } from "react";
import "../../styles/v2.css";
import type { PlaceId } from "../../../shared/protocol";
import { placeLabel } from "../../game/placeText";
import { PlaceArt } from "./placeArt";
import { V2Icon } from "./V2Icon";

// 심부름 장소 타일(64)과 발밑 방향 화살표(40 글리프) — 16페이즈 D-06·D-07, UI-SPEC V-20·V-21.
// 마피아도 시민과 같은 마크업을 받는다(D-03, V-25): 이 부품은 역할·좌석·가짜 표식 prop 이 없고 같은 입력에 같은 DOM 을 낸다.
// 속성 값은 장소 id 뿐이다(D-08). 장소 이름은 aria-label 에만 있고 화면에 글자로는 없다(React 속성 문자열, 텍스트 노드 아님).
// 위치(style·transform)는 맵 투영을 아는 층(WorldStage)이 프레임마다 쓴다 — 이 부품은 그리기만 한다.

export interface ErrandMarkerProps {
  id: PlaceId;
  /** 처리한 곳: 불투명도 .55 + 오른쪽 아래 체크 배지 + 놋쇠 테두리 */
  done: boolean;
  /** 빛남(14 의 is-call): 가장 가까운 미처리 타일 하나만 */
  call: boolean;
  /** 정지 후광(미처리·빛나지 않음). 층이 프레임마다 call 과 맞춰 쓴다 */
  rest?: boolean;
  /** 눌러 그 장소로 걷는다(바닥 탭과 같은 동작). 처리는 장소 위 [처리] 알약으로만 한다 */
  onWalk: () => void;
  style?: CSSProperties;
  /** 처음 마운트 때 숨김(투영 전). 이후 hidden 은 맵 층이 프레임마다 DOM 에 직접 쓴다 — 값이 늘 같아 React 가 다시 쓰지 않는다 */
  hidden?: boolean;
}

/** 맵 위 장소 타일: 64×64(누르기 64) + 컬러 에셋 44(장식) */
export function ErrandMarker({ id, done, call, rest, onWalk, style, hidden }: ErrandMarkerProps) {
  return (
    <button
      type="button"
      className={call ? "mv-errand-pin is-call" : "mv-errand-pin"}
      data-errand-place={id}
      data-done={done ? "" : undefined}
      data-call={call ? "" : undefined}
      data-rest={rest ? "" : undefined}
      aria-label={placeLabel(id, done)}
      style={style}
      hidden={hidden}
      onClick={onWalk}
    >
      <PlaceArt id={id} size={44} />
      {done ? (
        <span className="mv-errand-pin__badge" aria-hidden="true">
          <V2Icon name="check" size={16} />
        </span>
      ) : null}
    </button>
  );
}

export interface ErrandArrowProps {
  /** 도(위쪽 0°, 시계 방향) — 내 발밑에서 가장 가까운 미처리 장소로 향하는 방향 */
  angle: number;
  call: boolean;
  style?: CSSProperties;
  /** ErrandMarker 의 hidden 과 같다 */
  hidden?: boolean;
}

/** Errand-Map 시안의 화살표 글리프(24 격자, 위쪽을 가리킴). 면·윤곽은 CSS 토큰이 칠한다 */
const ARROW_GLYPH = "M12 2l7 10h-4v10H9V12H5z";

/** 내 발밑에서 가장 가까운 미처리 장소를 가리키는 40 글리프(눌림 통과, 포커스 없음). 한 개만 그린다 */
export function ErrandArrow({ angle, call, style, hidden }: ErrandArrowProps) {
  return (
    <span className={call ? "mv-errand-arrow is-call" : "mv-errand-arrow"} data-errand-arrow="" data-call={call ? "" : undefined} aria-hidden="true" style={style} hidden={hidden}>
      <span className="mv-errand-arrow__turn" style={{ transform: `rotate(${angle}deg)` }}>
        <svg width="40" height="40" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d={ARROW_GLYPH} />
        </svg>
      </span>
    </span>
  );
}
