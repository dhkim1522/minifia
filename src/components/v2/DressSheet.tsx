import "../../styles/v2.css";
import type { OutfitId } from "../../../shared/protocol";
import { DRESS_ORDER, DRESS_TEXT, OUTFIT_LABEL, outfitCardName } from "../../game/dressText";
import { outfitCardSrc } from "../../net/assets";
import { V2Icon } from "./V2Icon";

// 로비 꾸미기 시트 (10-07, UI-SPEC B-2·D-5): 로비 아래 패널을 정확히 덮는다(높이 = --mf-panel-h 250 · 306, 아랫변 = 키보드 올림).
// 스테이지 사각형이 변하지 않아 카메라가 움직이지 않고 내 캐릭터가 계속 보인다. 위 줄은 hanger 장식 24 와 닫기 44×44 뿐, 제목 글자는 없다.
// 카드 띠는 한 줄 가로 스크롤 스냅이다. 카드를 누르면 onPick(id) — 미리 보기·전송은 부르는 쪽(useDress)이 한다.
// 읽을 글은 카드 이름(14px 700 한 줄)뿐이고 사용자 문자열은 받지 않는다. 색은 gray-100 만 쓴다(의상은 역할이 아니다).

export interface DressSheetProps {
  /** 지금 입고 있는 의상(선택 카드) */
  value: OutfitId;
  onPick(id: OutfitId): void;
  onClose(): void;
}

export function DressSheet({ value, onPick, onClose }: DressSheetProps) {
  return (
    <div className="mv-dress-sheet" data-dress-sheet="" role="group" aria-label={DRESS_TEXT.open}>
      <div className="mv-dress-sheet__top">
        <V2Icon name="hanger" size={24} />
        <button type="button" className="mv-dress-sheet__close" aria-label={DRESS_TEXT.close} onClick={onClose}>
          <V2Icon name="close" size={24} />
        </button>
      </div>
      <div className="mv-dress-sheet__strip">
        {DRESS_ORDER.map((id) => {
          const selected = id === value;
          return (
            <button
              key={id}
              type="button"
              className={selected ? "mv-dress-card is-selected" : "mv-dress-card"}
              data-outfit={id}
              aria-pressed={selected}
              aria-label={outfitCardName(id, selected)}
              onClick={() => onPick(id)}
            >
              <img className="mv-dress-card__img" src={outfitCardSrc(id)} alt={OUTFIT_LABEL[id]} width={64} height={80} draggable={false} />
              <span className="mv-dress-card__name">{OUTFIT_LABEL[id]}</span>
              {selected ? <V2Icon name="check" size={12} className="mv-dress-card__check" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
