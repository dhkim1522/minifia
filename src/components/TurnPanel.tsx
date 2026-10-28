import { useState } from "react";
import type { ReactElement } from "react";
import type { ChatLine, EmojiId, RoomView } from "../../shared/protocol";
import { useCountdown } from "../net/countdown";
import { useSendLock } from "../net/useSendLock";
import type { RoomConnection } from "../net/useRoomConnection";
import { Button } from "./Button";
import { EmojiTraySheet } from "./EmojiTraySheet";
import { Icon } from "./Icon";
import { MessageLog } from "./MessageLog";
import "../styles/day.css";

// 남의 차례 하단 완성형(03.1 UI-SPEC B, 시안 K2): 채팅 세 줄(^ 버튼 포함) + 한 줄 `{닉네임}님이 주장하는 중 · N초` + 44×44 이모티콘 버튼.
// 말하는 버튼은 없다 — 주장 단계의 말은 차례인 사람의 직업 칩뿐이고 나머지는 이모티콘만 보낼 수 있다(결정 0023-2).
// 채팅 줄(주장 줄 포함)은 DayScene 이 만들어 넘긴다. 이 부품은 서버가 이미 공개한 값만 그린다.
// 닉네임·숫자는 React 텍스트로만 그린다(T-03.1-10·47). N초는 헤더 타이머와 같은 useCountdown 값이다.
// 이모티콘 트레이 열림 상태는 이 부품이 쥔다 — 단계가 바뀌어 언마운트되면 닫힌다(DiscussionControls 와 같은 규칙).
// 합산 쿨다운은 useSendLock 이 쥔다(DiscussionControls 와 같은 훅).
export interface TurnPanelProps {
  view: RoomView; // claim 단계, 지금 차례가 남
  connection: RoomConnection;
  /** 낮 화면 토스트(DayScene 이 쥔다) */
  showToast: (text: string) => void;
  /** 채팅 목록: 오늘 주장 줄 + 받은 채팅 줄 */
  lines: ChatLine[];
}

export function TurnPanel({ view, connection, showToast, lines }: TurnPanelProps): ReactElement {
  const [trayOpen, setTrayOpen] = useState(false);
  const { coolingDown, blocked, sendAndLock } = useSendLock(connection, showToast);
  const turnSeat = view.day?.turn?.seat;
  const nickname = view.players.find((p) => p.seat === turnSeat)?.nickname;
  const { phaseEndsAt, phaseDurationMs } = view;
  const hasDeadline = phaseEndsAt !== null && phaseDurationMs !== null;
  // 훅은 조건부로 부를 수 없다 — 마감이 없으면 이미 지난 마감으로 불러 두고 초는 그리지 않는다
  const { seconds } = useCountdown(hasDeadline ? phaseEndsAt : 0, hasDeadline ? phaseDurationMs : 1, connection.offset);
  const sendEmoji = (icon: EmojiId): void => {
    sendAndLock({ t: "emoji", icon });
  };
  return (
    <div className="mf-turnpanel">
      <MessageLog lines={lines} players={view.players} mySeat={view.me.seat} />
      <div className="st-row">
        <p className="stat">
          <b>{nickname !== undefined ? `${nickname}님이 주장하는 중` : ""}</b>
          {hasDeadline ? <span>{seconds}초</span> : null}
        </p>
        <Button
          variant="secondary"
          compact
          aria-label="이모티콘"
          icon={<Icon name="smile" size={22} />}
          disabled={blocked}
          onClick={() => setTrayOpen(true)}
        />
      </div>
      {trayOpen ? (
        <EmojiTraySheet canSend={connection.canSend} coolingDown={coolingDown} onSend={sendEmoji} onClose={() => setTrayOpen(false)} />
      ) : null}
    </div>
  );
}
