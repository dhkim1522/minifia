import type { ReactElement } from "react";
import { EMOJI_IDS } from "../../shared/protocol";
import type { EmojiId } from "../../shared/protocol";
import { EMOJI_TEXT } from "../game/messageText";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import "../styles/talk.css";

export interface EmojiTraySheetProps {
  canSend: boolean;
  /** 메시지·이모티콘 합산 2초 쿨다운 중(D-14). 시계는 부모가 쥔다 — 이 부품에는 타이머가 없다 */
  coolingDown: boolean;
  onSend: (icon: EmojiId) => void;
  onClose: () => void;
}

// 이모티콘 트레이(S-08b): 4열 × 2행. 칸을 누르면 확인 없이 아이콘 ID 를 바로 보내고 트레이는 닫지 않는다(연달아 보내기).
// 쿨다운 중·끊김 동안은 여덟 칸이 모두 꺼진다.
export function EmojiTraySheet({ canSend, coolingDown, onSend, onClose }: EmojiTraySheetProps): ReactElement {
  const disabled = !canSend || coolingDown;
  return (
    <Sheet label="이모티콘" onClose={onClose} showClose>
      <div className="mf-emojitray">
        <h2 className="mf-t-heading mf-sheet__title">이모티콘</h2>
        <div className="mf-emojitray__grid" role="group" aria-label="이모티콘">
          {EMOJI_IDS.map((icon) => (
            <button
              key={icon}
              type="button"
              className="mf-emojitray__cell"
              aria-label={EMOJI_TEXT[icon].name}
              disabled={disabled}
              onClick={() => onSend(icon)}
            >
              <Icon name={icon} size={22} />
              <span aria-hidden="true">{EMOJI_TEXT[icon].cell}</span>
            </button>
          ))}
        </div>
        <p className="mf-emojitray__hint">2초에 한 번 보낼 수 있어요</p>
      </div>
    </Sheet>
  );
}
