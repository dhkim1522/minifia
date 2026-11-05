import type { Ref } from "react";
import type { EmoteId } from "../../../shared/protocol";
import { EMOTE_LABEL, EMOTE_SHORT, EMOTE_TEXT } from "../../game/chatText";
import { V2Icon, type V2IconName } from "./V2Icon";

// 동작 판(UI-SPEC A-1): 아이콘 24 + 3~4글자 이름의 칸 아홉 개를 5열 격자로 그린다(아랫줄 4칸은 가운데, CSS).
// 칸 id 는 고정 enum 이고 이름은 chatText 의 고정 표에서만 읽는다 — 사용자 문자열이 들어갈 자리가 없다(T-10-17).
// 비활성(걷는 중·내 동작 재생 중·끊김)은 눌러도 아무 일이 없고 알림도 없다(D-10, D-11).

export interface EmoteTrayProps {
  ids: readonly EmoteId[];
  onPick(id: EmoteId): void;
  /** 모든 칸을 aria-disabled 로 그린다 */
  disabled?: boolean;
  /** 지금 재생 중인 내 동작: 그 칸에 안쪽 테두리 */
  playing?: EmoteId | null;
  /** 열릴 때 초점을 받을 첫 칸 */
  firstRef?: Ref<HTMLButtonElement>;
  onKeyDown?(e: React.KeyboardEvent<HTMLDivElement>): void;
}

export function EmoteTray({ ids, onPick, disabled, playing, firstRef, onKeyDown }: EmoteTrayProps) {
  return (
    <div className="mv-emote-tray" data-emote-tray="" role="group" aria-label={EMOTE_TEXT.tray} onKeyDown={onKeyDown}>
      {ids.map((id, i) => {
        const cls = ["mv-emote-tray__cell", playing === id && "is-playing"].filter(Boolean).join(" ");
        return (
          <button
            key={id}
            ref={i === 0 ? firstRef : undefined}
            type="button"
            className={cls}
            data-emote={id}
            aria-label={EMOTE_LABEL[id]}
            aria-disabled={disabled ? "true" : undefined}
            // 칸을 눌러도 입력칸의 초점을 뺏지 않는다(보내기 버튼과 같다)
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (!disabled) onPick(id);
            }}
          >
            <V2Icon name={id as V2IconName} size={24} />
            <span className="mv-emote-tray__name">{EMOTE_SHORT[id]}</span>
          </button>
        );
      })}
    </div>
  );
}
