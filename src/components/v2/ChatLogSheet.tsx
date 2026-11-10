import { CHAT_TEXT } from "../../game/chatText";
import { Sheet } from "../Sheet";
import { ChatLines } from "./ChatLines";
import type { ChatPanelMessage } from "./ChatPanel";
import { V2Icon } from "./V2Icon";

// 채팅 기록 시트(18.1, P181-4, UI-SPEC B 계약 3): 기록 칸(두 줄 창)을 누르면 아래에서 올라와 지난 줄을 보여 준다.
// - 제목 글이 없다. 채널 아이콘 24 하나(전체 send · 마피아 roleMafia · 유령 ghost, aria-hidden)만 둔다.
// - 줄은 패널과 같은 ChatLines 부품·클래스로 그린다. 본문·닉네임은 텍스트 노드로만(T-07-07).
// - 시트는 화면이 이미 받은 messages 만 그리고 채널을 고르는 조작이 없다(결정 0002·0021).
// - 손잡이·끌어 내려 닫기·[닫기]·Esc 는 Sheet 기본이다. 닫은 뒤 포커스 복귀는 부르는 쪽(ChatPanel)이 한다.

export interface ChatLogSheetProps {
  messages: readonly ChatPanelMessage[];
  channel: "all" | "mafia" | "ghost";
  /** 재접속 복원 중: 새 글 알약을 만들지 않는다 */
  quiet: boolean;
  onClose(): void;
}

export function ChatLogSheet({ messages, channel, onClose }: ChatLogSheetProps) {
  // 역할 단어가 든 문구는 없고 아이콘만 채널 분기에서 고른다(T-07-08).
  const icon = channel === "mafia" ? "roleMafia" : channel === "ghost" ? "ghost" : "send";
  return (
    <Sheet label={CHAT_TEXT.logLabel} className="mf-sheet--chatlog" showClose onClose={onClose}>
      <span className="mv-chat__sheet-chan" aria-hidden="true">
        <V2Icon name={icon} size={24} />
      </span>
      <div className="mv-chat__log mv-chat__sheetlog" data-chat-sheet-log="">
        <ChatLines messages={messages} channel={channel} />
      </div>
    </Sheet>
  );
}
