import { useRef } from "react";
import type { CSSProperties } from "react";
import "../../styles/v2.css";
import type { PlaceId } from "../../../shared/protocol";
import { ERRAND_TEXT } from "../../game/errandView";
import { PLACE_NAME } from "../../game/placeText";
import { V2Icon } from "./V2Icon";
import type { V2IconName } from "./V2Icon";

// 처리 반경 안 미처리 장소 위에 뜨는 [처리] 알약(16페이즈 D-06, UI-SPEC V-22). 반경 밖에서는 DOM 에 없다(쓰는 쪽이 그리지 않는다).
// 마피아도 시민과 같은 마크업(V-25): 역할·좌석·가짜 prop 이 없고 장소 id 하나만 받는다. 누르면 필드 없는 처리 메시지만 보낸다(T-16-16).
// 위치는 맵 층(WorldStage)이 프레임마다 DOM 에 쓴다.
// 21페이즈(P21-7, D-06): 라벨·아이콘·접근성 이름을 prop 으로 바꿀 수 있다(저녁 "켜기"·불꽃 · 아침 "살펴보기"·돋보기). 길게 누르기(0.6초)는 이 부품 안에서 가르고
// onPress(hold) 로 알린다 — 모든 역할이 같은 제스처·같은 DOM·같은 연출·같은 접근성 이름이고, 길게 누른 뜻(자르기 시도)은 서버만 정한다.
// 누르는 동안·뗀 뒤 어느 쪽도 겉모양이 바뀌지 않는다(상태 없음). 키보드 Enter/Space 는 hold false 다.

/** 길게 누르기로 보는 시간(ms) — 눌러서 뗄 때까지 */
export const ERRAND_HOLD_MS = 600;

/** pointerup 뒤 이어 오는 click 으로 보는 시간(ms) — 브라우저가 click 을 내지 않는 긴 누름 뒤의 키보드 누름을 삼키지 않게 한다 */
const CLICK_FOLLOW_MS = 400;

export interface ErrandActProps {
  /** 처리할 장소(접근성 이름에만 쓴다). 아침 [살펴보기]는 장소가 아니라 지점이라 주지 않고 aria 를 직접 준다 */
  id?: PlaceId;
  /** 빛남(14 의 is-call): 처리 반경 안에 미처리가 있을 때의 그 한 개 */
  call: boolean;
  /** hold: 0.6초 넘게 눌렀다 뗐는가. 뗀 순간 한 번만 불린다 */
  onPress: (hold: boolean) => void;
  /** 글(기본 "처리") */
  label?: string;
  /** 아이콘(기본 hand) */
  icon?: V2IconName;
  /** 접근성 이름 전체(기본 "{장소}에서 처리") */
  aria?: string;
  style?: CSSProperties;
  /** 처음 마운트 때 숨김(위치를 아직 모른다). 이후 hidden 은 맵 층이 DOM 에 직접 쓴다 */
  hidden?: boolean;
}

export function ErrandAct({ id, call, onPress, label = ERRAND_TEXT.act, icon = "hand", aria, style, hidden }: ErrandActProps) {
  // 누른 시각(없으면 포인터로 누르는 중이 아님). pointerup 이 보낸 뒤 곧 이어 오는 click 은 한 번 삼킨다
  const downAt = useRef<number | null>(null);
  const handledAt = useRef<number | null>(null);
  return (
    <button
      type="button"
      className={call ? "mv-errand-act is-call" : "mv-errand-act"}
      data-errand-act=""
      data-call={call ? "" : undefined}
      aria-label={aria ?? (id === undefined ? label : `${PLACE_NAME[id]}에서 처리`)}
      style={style}
      hidden={hidden}
      onMouseDown={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={() => {
        downAt.current = Date.now();
        handledAt.current = null;
      }}
      onPointerUp={() => {
        const at = downAt.current;
        downAt.current = null;
        if (at === null) return;
        handledAt.current = Date.now();
        onPress(Date.now() - at >= ERRAND_HOLD_MS);
      }}
      onPointerCancel={() => {
        downAt.current = null;
        handledAt.current = null;
      }}
      onClick={() => {
        const at = handledAt.current;
        handledAt.current = null;
        if (at !== null && Date.now() - at < CLICK_FOLLOW_MS) return;
        onPress(false);
      }}
    >
      <V2Icon name={icon} size={16} />
      {label}
    </button>
  );
}
