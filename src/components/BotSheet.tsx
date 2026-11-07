import type { ReactElement } from "react";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { BotStepper } from "./BotStepper";
import { Sheet } from "./Sheet";

// 일반 방 방장의 [봇] 시트(결정 0075): 사람이 모자란 판을 서버 봇으로 채운다. 대기실에서만 열린다.
export function BotSheet({ view, canSend, send, onClose }: { view: RoomView; canSend: boolean; send: (msg: ClientMessage) => boolean | void; onClose: () => void }): ReactElement {
  return (
    <Sheet label="봇" showClose onClose={onClose} className="mf-tt-sheet">
      {() => (
        <>
          <h2 className="mf-t-heading mf-sheet__title">봇</h2>
          <BotStepper view={view} canSend={canSend} send={send} />
        </>
      )}
    </Sheet>
  );
}
