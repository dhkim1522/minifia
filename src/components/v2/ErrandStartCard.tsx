import "../../styles/v2.css";
import type { PlaceId } from "../../../shared/protocol";
import { PLACE_NAME } from "../../game/placeText";
import { PlaceArt } from "./placeArt";

// 심부름 시작 2초 카드 "오늘 갈 곳"(16페이즈 D-06, UI-SPEC V-19): 내 장소 3곳을 84 타일·컬러 아트 60 으로 보인다. 장소 이름은 글자로 없고 접근성 이름에만 있다.
// 카드·막은 눌림을 통과한다(누르면 닫히는 일은 쓰는 쪽이 방 루트의 첫 누름으로 한다 — 이 부품에 단추는 없다).
// 마피아도 시민과 같은 마크업이다(V-25): 역할·좌석 prop 이 없고 같은 입력에 같은 DOM 을 낸다. 표식은 data-errand-start-card 하나뿐이다.

export interface ErrandStartCardProps {
  /** 내 목록 장소(순서에 뜻 없음). 비면 아무것도 그리지 않는다 */
  places: readonly PlaceId[];
}

export function ErrandStartCard({ places }: ErrandStartCardProps) {
  if (places.length === 0) return null;
  return (
    <div className="mv-errand-start" data-errand-start-card="">
      <div className="mv-errand-start__scrim" aria-hidden="true" />
      <div className="mv-errand-start__card">
        <h2 className="mv-errand-start__title">오늘 갈 곳</h2>
        <div className="mv-errand-start__tiles">
          {places.map((id) => (
            <span key={id} className="mv-errand-start__tile" role="img" aria-label={`${PLACE_NAME[id]} 장소`}>
              <PlaceArt id={id} size={60} />
            </span>
          ))}
        </div>
        <p className="mv-errand-start__line">가는 길에 본 사람이 기록돼요</p>
      </div>
    </div>
  );
}
