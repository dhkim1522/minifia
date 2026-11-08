import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import "../../styles/v2.css";
import type { MapChoice, OutfitId } from "../../../shared/protocol";
import { DRESS_ORDER, DRESS_TAB_NAME, DRESS_TEXT, MAP_CARD_ORDER, MAP_LABEL, OUTFIT_LABEL, mapCardName, outfitCardName } from "../../game/dressText";
import { mapCardSrc, outfitCardSrc } from "../../net/assets";
import { V2Icon } from "./V2Icon";

// 로비 꾸미기 시트 (10-07, UI-SPEC B-2·D-5): 로비 아래 패널을 정확히 덮는다(높이 = --mf-panel-h 250 · 306, 아랫변 = 키보드 올림).
// 스테이지 사각형이 변하지 않아 카메라가 움직이지 않고 내 캐릭터가 계속 보인다. 위 줄은 hanger 장식 24 와 닫기 44×44 뿐, 제목 글자는 없다.
// 카드 띠는 한 줄 가로 스크롤 스냅이다. 카드를 누르면 onPick(id) — 미리 보기·전송은 부르는 쪽(useDress)이 한다.
// 11-13(맵 선택): 방장에게만 [맵][의상] 탭(아이콘 44×44, 선택 탭은 아래 2px 줄)이 생긴다. 맵 탭은 카드 3장(재즈 바·광장·랜덤, 96×112 간격 8)이고
// 누르면 onPickMap(id) 만 부른다 — 미리 보기·낙관 갱신 없이 서버가 mapChoice 를 방송하면 카드가 바뀐다. 손님에게는 탭이 없고 의상 카드만 보인다.
// 읽을 글은 카드 이름(14px 700 한 줄)뿐이고 사용자 문자열은 받지 않는다. 색은 gray-100 만 쓴다(의상은 역할이 아니다).

export interface DressSheetProps {
  /** 지금 입고 있는 의상(선택 카드) */
  value: OutfitId;
  onPick(id: OutfitId): void;
  onClose(): void;
  /** 연결이 끊겼다: 카드가 aria-disabled 가 되고 눌러도 onPick 이 불리지 않는다. 닫기는 그대로 동작한다 */
  disabled?: boolean;
  /** 방장이면 [맵][의상] 탭이 생긴다(11-13). 아니면 탭 행이 없고 의상 카드만 */
  host?: boolean;
  /** 처음 열리는 탭. 지도 칩은 "map", 꾸미기 버튼은 "dress"(기본). 방장이 아니면 무시한다 */
  tab?: "map" | "dress";
  /** 서버가 정한 맵 선택(기본 random) */
  mapChoice?: MapChoice;
  /** 방장이 맵 카드를 눌렀다. 보내기는 부르는 쪽이 한다 */
  onPickMap?(id: MapChoice): void;
}

export function DressSheet({ value, onPick, onClose, disabled = false, host = false, tab: openTab = "dress", mapChoice = "random", onPickMap }: DressSheetProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const mapsRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"map" | "dress">(host ? openTab : "dress");
  // 열릴 때 한 번(탭을 바꿀 때 초점은 탭 버튼에 둔다): 지금 의상(맵 탭이면 지금 맵) 카드가 띠 가운데로 오도록 맞추고(즉시, 모션 줄이기와 같다) 그 카드로 초점을 준다(스크롤은 위에서 이미 했다)
  useEffect(() => {
    const card = (tab === "map" ? mapsRef.current : stripRef.current)?.querySelector<HTMLElement>("button[aria-pressed='true']");
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
    const cards = [...((tab === "map" ? mapsRef.current : stripRef.current)?.querySelectorAll<HTMLElement>("button[data-outfit],button[data-map-card]") ?? [])];
    const at = cards.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    e.preventDefault();
    const next = cards[Math.max(0, Math.min(cards.length - 1, at + (e.key === "ArrowRight" ? 1 : -1)))];
    next?.focus();
  };

  return (
    <div className="mv-dress-sheet" data-dress-sheet="" role="group" aria-label={DRESS_TEXT.open} onKeyDown={onKeyDown}>
      <div className="mv-dress-sheet__top">
        {host ? (
          <div className="mv-dress-sheet__tabs" role="tablist">
            {(["map", "dress"] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                className={tab === id ? "mv-dress-sheet__tab is-selected" : "mv-dress-sheet__tab"}
                data-map-tab={id}
                aria-selected={tab === id}
                aria-label={DRESS_TAB_NAME[id]}
                onClick={() => setTab(id)}
              >
                <V2Icon name={id === "map" ? "mapBar" : "hanger"} size={20} />
                <span className="mv-dress-sheet__tab-label">{DRESS_TAB_NAME[id]}</span>
              </button>
            ))}
          </div>
        ) : (
          <V2Icon name="hanger" size={24} />
        )}
        <button type="button" className="mv-dress-sheet__close mv-closepill" aria-label={DRESS_TEXT.close} onClick={onClose}>
          <V2Icon name="close" size={20} />
        </button>
      </div>
      {tab === "map" ? (
        <div ref={mapsRef} className="mv-dress-sheet__maps">
          {MAP_CARD_ORDER.map((id) => {
            const selected = id === mapChoice;
            return (
              <button
                key={id}
                type="button"
                className={selected ? "mv-map-card is-selected" : "mv-map-card"}
                data-map-card={id}
                aria-pressed={selected}
                aria-label={mapCardName(id, selected)}
                aria-disabled={disabled ? "true" : undefined}
                onClick={() => {
                  if (!disabled) onPickMap?.(id);
                }}
              >
                {id === "random" ? (
                  <span className="mv-map-card__img mv-map-card__shuffle">
                    <V2Icon name="shuffle" size={48} />
                  </span>
                ) : (
                  <img className="mv-map-card__img" src={mapCardSrc(id)} alt="" width={80} height={80} draggable={false} />
                )}
                <span className="mv-map-card__name">{MAP_LABEL[id]}</span>
                {selected ? (
                  <span className="mv-map-card__check">
                    <V2Icon name="check" size={12} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
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
      )}
    </div>
  );
}
