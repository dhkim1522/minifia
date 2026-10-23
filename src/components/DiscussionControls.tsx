import { useState } from "react";
import type { ReactElement } from "react";
import type { RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../net/useRoomConnection";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { QuickMessageSheet } from "./QuickMessageSheet";
import type { SayPayload } from "./QuickMessageSheet";
import "../styles/day.css";

export interface DiscussionControlsProps {
  view: RoomView; // discussion 단계
  connection: RoomConnection;
  /** 낮 화면 토스트(DayScene 이 쥔다) */
  showToast: (text: string) => void;
}

// 낮 토론 하단 패널의 조작 줄(S-07). 시트 열림 상태는 이 부품이 쥔다 — 단계가 바뀌어 패널이 언마운트되면
// 열려 있던 시트도 같이 닫히고 고른 내용은 버려진다(D-19, 1페이즈 [내 역할] 시트와 반대 규칙, Pitfall 11).
// 보내는 것은 템플릿 ID·seat·직업뿐이다. 판정(쿨다운·방장·단계)은 서버가 하고 여기는 편의일 뿐이다.
export function DiscussionControls({ view, connection }: DiscussionControlsProps): ReactElement {
  const [sheet, setSheet] = useState<"quick" | null>(null);

  const sendSay = (payload: SayPayload): void => {
    connection.send({ t: "say", ...payload });
  };

  return (
    <div className="mf-discuss">
      <div className="mf-discuss__talk">
        <Button
          variant="primary"
          className="mf-discuss__quick"
          icon={<Icon name="chat" />}
          disabled={!connection.canSend}
          onClick={() => setSheet("quick")}
        >
          빠른 메시지
        </Button>
        <Button
          variant="secondary"
          className="mf-discuss__emoji"
          aria-label="이모티콘"
          icon={<Icon name="smile" />}
          disabled={!connection.canSend}
        />
      </div>
      {sheet === "quick" ? (
        <QuickMessageSheet
          players={view.players}
          mySeat={view.me.seat}
          roles={view.day?.roles ?? []}
          canSend={connection.canSend}
          onSend={sendSay}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </div>
  );
}
