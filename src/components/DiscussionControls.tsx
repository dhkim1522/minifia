import { useState } from "react";
import type { ReactElement } from "react";
import type { EmojiId, RoomView, TemplateId } from "../../shared/protocol";
import { useSendLock } from "../net/useSendLock";
import type { RoomConnection } from "../net/useRoomConnection";
import { Button } from "./Button";
import { EmojiTraySheet } from "./EmojiTraySheet";
import { Icon } from "./Icon";
import { QuickMessageSheet } from "./QuickMessageSheet";
import type { SayPayload } from "./QuickMessageSheet";
import "../styles/day.css";

export interface DiscussionControlsProps {
  view: RoomView; // discussion 단계
  connection: RoomConnection;
  /** 낮 화면 토스트(DayScene 이 쥔다) */
  showToast: (text: string) => void;
  /** 빠른 메시지 시트의 문구 모음. 밤에는 NIGHT_TEMPLATE_ORDER(D-17), 없으면 낮 문구 */
  templates?: readonly TemplateId[];
}

// 낮 토론 하단 패널의 조작 줄(S-07, 시안 R9-5): [빠른 메시지](주 버튼, 남은 폭) [이모티콘](44×44 아이콘만) 한 줄뿐이다(결정 0017-6).
// 시트 열림 상태는 이 부품이 쥔다 — 단계가 바뀌어 패널이 언마운트되면
// 열려 있던 시트도 같이 닫히고 고른 내용은 버려진다(D-19, 1페이즈 [내 역할] 시트와 반대 규칙, Pitfall 11).
// 보내는 것은 템플릿 ID·seat·직업뿐이다. 판정(쿨다운·방장·단계)은 서버가 하고 여기는 편의일 뿐이다.
//
// 쿨다운(D-14): 메시지·이모티콘 합산. 잠금·RATE_LIMITED 재잠금·BAD_MESSAGE 토스트는 useSendLock 이 쥔다(TurnPanel 과 같은 규칙).
// 방장 전용 조작(연장·넘기기)은 결정 0017-5 로 없앴다.

export function DiscussionControls({ view, connection, showToast, templates }: DiscussionControlsProps): ReactElement {
  const [sheet, setSheet] = useState<"quick" | "emoji" | null>(null);
  const { coolingDown, blocked, sendAndLock } = useSendLock(connection, showToast);
  const sendSay = (payload: SayPayload): void => {
    sendAndLock({ t: "say", ...payload });
  };
  const sendEmoji = (icon: EmojiId): void => {
    sendAndLock({ t: "emoji", icon });
  };

  return (
    <div className="mf-discuss">
      <div className="mf-discuss__talk">
        <Button variant="primary" compact className="mf-discuss__quick" disabled={blocked} onClick={() => setSheet("quick")}>
          빠른 메시지
        </Button>
        <Button
          variant="secondary"
          compact
          className="mf-discuss__emoji"
          aria-label="이모티콘"
          icon={<Icon name="smile" size={22} />}
          disabled={blocked}
          onClick={() => setSheet("emoji")}
        />
      </div>
      {sheet === "quick" ? (
        <QuickMessageSheet
          players={view.players}
          mySeat={view.me.seat}
          roles={view.day?.roles ?? []}
          canSend={connection.canSend}
          templates={templates}
          onSend={sendSay}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "emoji" ? (
        <EmojiTraySheet canSend={connection.canSend} coolingDown={coolingDown} onSend={sendEmoji} onClose={() => setSheet(null)} />
      ) : null}
    </div>
  );
}
