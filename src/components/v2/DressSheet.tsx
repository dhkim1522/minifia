import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
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
  /** 연결이 끊겼다: 카드가 aria-disabled 가 되고 눌러도 onPick 이 불리지 않는다. 닫기는 그대로 동작한다 */
  disabled?: boolean;
}

export function DressSheet({ value, onPick, onClose, disabled = false }: DressSheetProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  // 열릴 때 한 번: 지금 의상 카드가 띠 가운데로 오도록 맞추고(즉시, 모션 줄이기와 같다) 그 카드로 초점을 준다(스크롤은 위에서 이미 했다)
  useEffect(() => {
    const card = stripRef.current?.querySelector<HTMLElement>("button[data-outfit][aria-pressed='true']");
    if (!card) return;
    card.scrollIntoView?.({ inline: "center", block: "nearest", behavior: "auto" });
    card.focus({ preventScroll: true });
  }, []);

  // 카드 띠도 화살표키: 좌우로 이웃 카드에 초점(양 끝에서 멈춘다). Enter·Space 는 버튼의 기본 동작, Esc 는 닫기
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const cards = [...(stripRef.current?.querySelectorAll<HTMLElement>("button[data-outfit]") ?? [])];
    const at = cards.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    e.preventDefault();
    const next = cards[Math.max(0, Math.min(cards.length - 1, at + (e.key === "ArrowRight" ? 1 : -1)))];
    next?.focus();
  };

  return (
    <div className="mv-dress-sheet" data-dress-sheet="" role="group" aria-label={DRESS_TEXT.open} onKeyDown={onKeyDown}>
      <div className="mv-dress-sheet__top">
        <V2Icon name="hanger" size={24} />
        <button type="button" className="mv-dress-sheet__close" aria-label={DRESS_TEXT.close} onClick={onClose}>
          <V2Icon name="close" size={24} />
        </button>
      </div>
      <div ref={stripRef} className="mv-dress-sheet__strip">
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
              aria-disabled={disabled ? "true" : undefined}
              onClick={() => {
                if (!disabled) onPick(id);
              }}
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
