import type { PhaseId } from "../../../shared/protocol";
import { TOD_LABEL, TOD_ORDER, todOf, todSrc } from "../../game/timeOfDay";
import "../../styles/timeOfDay.css";

// 시간대 배지(18.1 P181-5, UI-SPEC D 계약 4·5): 게임 맵 헤더의 [역할 카드] 왼쪽 원형 44×44 날씨 그림 하나.
// 컬러 날씨 SVG 네 장(사용자가 준 원본 그대로, 다시 그리지 않는다)을 겹쳐 두고 지금 시간대만 불투명도 1 이다 —
// 단계가 바뀌어도 img 를 새로 만들지 않아 로딩 깜빡임이 없고 크로스페이드 하나(반복 애니메이션 없음)만 돈다.
// 글자·누르기·포커스가 없다. 입력은 공개 단계 하나뿐이고 역할은 읽지 않는다.
export function TimeOfDayBadge({ phase }: { phase: PhaseId }) {
  const tod = todOf(phase);
  return (
    <span className="mv-tod" role="img" aria-label={TOD_LABEL[tod]} data-tod={tod}>
      {TOD_ORDER.map((x) => (
        <img key={x} className={x === tod ? "mv-tod__img is-on" : "mv-tod__img"} src={todSrc(x)} width={44} height={44} alt="" aria-hidden="true" draggable={false} />
      ))}
    </span>
  );
}
