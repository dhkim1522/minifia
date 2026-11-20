import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import "../../styles/v2.css";
import { ANIMAL_IDS, ANIMALS, type AnimalId } from "../../../shared/game/animals";
import type { OutfitId } from "../../../shared/protocol";
import { DRESS_ORDER, DRESS_TEXT, OUTFIT_LABEL, outfitCardName } from "../../game/dressText";
import { animalFaceSrc, outfitCardSrc } from "../../net/assets";
import { V2Icon, type V2IconName } from "./V2Icon";

// 꾸미기 시트의 아래를 채팅 패널에 맞춘다. 탭 줄과 카드가 잘리지 않도록 시트에 최소 높이를 둔다.
// 스테이지 사각형이 변하지 않아 카메라가 움직이지 않고 내 캐릭터가 계속 보인다.
// 카드 띠는 한 줄 가로 스크롤 스냅이다. 카드를 누르면 onPick(id) — 미리 보기·전송은 부르는 쪽(useDress)이 한다.
// 18-05(D-02): 다른 참가자가 직접 고른 옷은 잠금(자물쇠·누름 무시, 알림 없음).
// 읽을 글은 카드 이름(14px 700 한 줄)뿐이고 사용자 문자열은 받지 않는다. 색은 gray-100 만 쓴다(의상은 역할이 아니다).

export interface DressSheetProps {
  /** 지금 입고 있는 의상(선택 카드) */
  value: OutfitId;
  onPick(id: OutfitId): void;
  onClose(): void;
  /** 연결이 끊겼다: 카드가 aria-disabled 가 되고 눌러도 onPick 이 불리지 않는다. 닫기는 그대로 동작한다 */
  disabled?: boolean;
  /** 다른 사람이 직접 고른 옷. 내 옷(value)은 들어 있어도 잠그지 않는다. 서버 잠금(18-01)과 같은 lockedOutfits 결과 */
  taken?: ReadonlySet<OutfitId>;
  /** 처음 열리는 꾸미기 탭. */
  tab?: DressTab;
  wearer?: AnimalId | undefined;
  animals?: {
    value: AnimalId;
    taken: ReadonlySet<AnimalId>;
    pending: AnimalId | null;
    onPick(id: AnimalId): void;
    only?: boolean;
  };
}

type DressTab = "dress" | "animal";

const TAB_NAME = { dress: "의상", animal: "동물" } as const;
const TAB_ICON: Readonly<Record<DressTab, V2IconName>> = { dress: "hanger", animal: "face" };

export function DressSheet({ value, onPick, onClose, disabled = false, taken, tab: openTab = "dress", animals, wearer = animals?.value }: DressSheetProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const animalsRef = useRef<HTMLDivElement>(null);
  const tabs: DressTab[] = [
    ...(animals ? ["animal" as const] : []),
    ...(animals?.only ? [] : ["dress" as const]),
  ];
  const [chosenTab, setTab] = useState<DressTab>(openTab);
  const tab = tabs.includes(chosenTab) ? chosenTab : (animals ? "animal" : "dress");
  useEffect(() => {
    if (tab !== chosenTab) setTab(tab);
  }, [tab, chosenTab]);
  const cardStrip = tab === "animal" ? animalsRef : stripRef;
  const firstLayout = useRef(true);
  useEffect(() => {
    const card = cardStrip.current?.querySelector<HTMLElement>("button[aria-pressed='true']");
    card?.scrollIntoView?.({ inline: "center", block: "nearest", behavior: "auto" });
    if (firstLayout.current) card?.focus({ preventScroll: true });
    firstLayout.current = false;
  }, [cardStrip]);

  // 카드 띠도 화살표키: 좌우로 이웃 카드에 초점(양 끝에서 멈춘다). Enter·Space 는 버튼의 기본 동작, Esc 는 닫기
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const cards = [...(cardStrip.current?.querySelectorAll<HTMLElement>("button") ?? [])];
    const at = cards.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    e.preventDefault();
    const next = cards[Math.max(0, Math.min(cards.length - 1, at + (e.key === "ArrowRight" ? 1 : -1)))];
    next?.focus();
  };

  return (
    <div className="mv-dress-sheet" data-dress-sheet="" data-dress-view={tab} role="group" aria-label={animals ? "캐릭터 꾸미기" : DRESS_TEXT.open} onKeyDown={onKeyDown}>
      <div className="mv-dress-sheet__top">
        {tabs.length > 1 ? (
          <div className="mv-dress-sheet__tabs" role="tablist">
            {tabs.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                className={tab === id ? "mv-dress-sheet__tab is-selected" : "mv-dress-sheet__tab"}
                data-customize-tab={id}
                aria-selected={tab === id}
                aria-label={TAB_NAME[id]}
                onClick={() => setTab(id)}
              >
                <V2Icon name={TAB_ICON[id]} size={20} />
                <span className="mv-dress-sheet__tab-label">{TAB_NAME[id]}</span>
              </button>
            ))}
          </div>
        ) : (
          <V2Icon name={TAB_ICON[tab]} size={24} />
        )}
        <button type="button" className="mv-dress-sheet__close mv-closepill" aria-label={DRESS_TEXT.close} onClick={onClose}>
          <V2Icon name="close" size={20} />
        </button>
      </div>
      {tab === "animal" && animals ? (
        <div ref={animalsRef} className="mv-dress-sheet__strip" aria-busy={animals.pending !== null}>
          {ANIMAL_IDS.map((id) => {
            const selected = id === animals.value;
            const locked = animals.taken.has(id) && !selected;
            const blocked = disabled || locked || animals.pending !== null;
            return (
              <button
                key={id}
                type="button"
                className={"mv-dress-card mv-animal-card" + (selected ? " is-selected" : "")}
                data-animal={id}
                data-taken={locked ? "" : undefined}
                aria-pressed={selected}
                aria-label={ANIMALS[id].name + (locked ? ", 다른 참가자가 사용 중" : selected ? DRESS_TEXT.selected : "")}
                aria-disabled={blocked || undefined}
                onClick={() => {
                  if (!blocked && !selected) animals.onPick(id);
                }}
              >
                <img className="mv-animal-card__img" src={animalFaceSrc(id)} width={52} height={52} alt="" draggable={false} />
                <span className="mv-dress-card__name">{ANIMALS[id].name}</span>
                {selected ? <V2Icon name="check" size={12} className="mv-dress-card__check" /> : locked ? <V2Icon name="lock" size={16} className="mv-dress-card__lock" /> : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div ref={stripRef} className="mv-dress-sheet__strip">
          {DRESS_ORDER.map((id) => {
            const selected = id === value;
            const locked = taken?.has(id) === true && id !== value;
            return (
              <button
                key={id}
                type="button"
                className={selected ? "mv-dress-card is-selected" : "mv-dress-card"}
                data-outfit={id}
                data-taken={locked ? "" : undefined}
                aria-pressed={selected}
                aria-label={outfitCardName(id, selected, locked)}
                aria-disabled={disabled || locked ? "true" : undefined}
                onClick={() => {
                  if (!disabled && !locked) onPick(id);
                }}
              >
                <img key={wearer} className="mv-dress-card__img" src={outfitCardSrc(id, wearer)} alt={OUTFIT_LABEL[id]} width={64} height={80} draggable={false} />
                <span className="mv-dress-card__name">{OUTFIT_LABEL[id]}</span>
                {selected ? <V2Icon name="check" size={12} className="mv-dress-card__check" /> : locked ? <V2Icon name="lock" size={16} className="mv-dress-card__lock" /> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
