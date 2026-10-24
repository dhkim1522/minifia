import { useLayoutEffect, useRef } from "react";
import type { ReactElement } from "react";
import type { ChatLine, PublicPlayer } from "../../shared/protocol";
import { ChatLineItem, SystemLineItem } from "./MessageLog";
import { Sheet } from "./Sheet";
import "../styles/day.css";

export interface ChatHistorySheetProps {
  /** 이 폰이 그날 받은 줄 전부. 서버에서 내역을 따로 받아 오지 않는다(결정 0017-7, T-02-46) */
  lines: ChatLine[];
  players: PublicPlayer[];
  mySeat: number;
  /** 목록 맨 위 시스템 안내(UI-SPEC N-2). 있으면 줄이 없어도 빈 상태 문구를 쓰지 않는다 */
  systemLine?: string;
  onClose: () => void;
}

/** 맨 아래에서 이 거리(px) 안이면 "맨 아래에 있다"고 본다 */
const STICK_PX = 24;

// 채팅 내역 모달(시안 6차 U): 앱 Sheet 틀(제목 + 닫기 + 손잡이) 안에 하단 세 줄과 같은 모양의 줄을 전부 보여 준다.
// 열릴 때 맨 아래(최신)로 내리고, 새 줄이 오면 맨 아래 근처에 있을 때만 따라 내린다(위로 밀어 둔 동안은 그대로).
export function ChatHistorySheet({ lines, players, mySeat, systemLine, onClose }: ChatHistorySheetProps): ReactElement {
  const listRef = useRef<HTMLOListElement>(null);
  const stickRef = useRef(true);

  const onScroll = (): void => {
    const el = listRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_PX;
  };

  const lastSeq = lines.length > 0 ? (lines[lines.length - 1]?.seq ?? -1) : -1;
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [lastSeq, lines.length]);

  return (
    <Sheet label="채팅 내역" showClose onClose={onClose} className="mf-sheet--chat">
      <h2 className="mf-t-heading mf-sheet__title">채팅 내역</h2>
      <ol ref={listRef} className="mf-chatlog" role="log" aria-label="채팅 내역" aria-live="polite" aria-relevant="additions" onScroll={onScroll}>
        {systemLine !== undefined ? <SystemLineItem text={systemLine} /> : null}
        {lines.length === 0 && systemLine === undefined ? <li className="mf-msglog__empty">아직 메시지가 없어요</li> : null}
        {lines.map((l, i) => (
          <ChatLineItem key={l.seq} line={l} latest={i === lines.length - 1} players={players} mySeat={mySeat} />
        ))}
      </ol>
    </Sheet>
  );
}
