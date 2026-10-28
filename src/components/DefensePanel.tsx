import { useState } from "react";
import type { ReactElement } from "react";
import type { ChatLine, EmojiId, RoomView } from "../../shared/protocol";
import { VERDICT_TEXT, defenseDisconnected, defenseStatus } from "../game/verdict";
import { useCountdown } from "../net/countdown";
import { useSendLock } from "../net/useSendLock";
import type { RoomConnection } from "../net/useRoomConnection";
import { Button } from "./Button";
import { EmojiTraySheet } from "./EmojiTraySheet";
import { Icon } from "./Icon";
import { MessageLog } from "./MessageLog";
import { ReadOnlyRow } from "./ReadOnlyRow";
import "../styles/day.css";

// 최후 변론 중 후보가 아닌 사람의 하단(UI-SPEC 8.4·7.2, 시안 DB): 채팅 세 줄(후보의 변론만, ^ 버튼 포함) + 한 줄 `{이름}님이 변론하는 중 · N초` + 44×44 이모티콘 버튼.
// TurnPanel 과 같은 모양이라 그 클래스(.mf-turnpanel·.st-row)를 그대로 쓴다(새 스타일 없음). 말하는 버튼은 없다 — 변론은 후보뿐이고 나머지는 이모티콘만 보낸다(D-13).
// 후보가 연결이 끊겨 있으면 상태 줄이 끊김 문구(D-05)이고 이모티콘은 그대로 쓸 수 있다. 탈락 viewer(readOnly)는 채팅(읽기) + 관전 알약뿐이다(D-35).
// 입력에 역할이 없다 — 후보의 직업은 변론 문장(후보가 스스로 고른 주장)으로만 나타난다(D-09, T-04-57). 닉네임·숫자는 React 텍스트로만 그린다(T-04-40).
// N초는 헤더 타이머와 같은 useCountdown 값이다. 이모티콘 트레이 열림 상태는 이 부품이 쥔다 — 단계가 바뀌어 언마운트되면 닫힌다. 합산 쿨다운은 useSendLock 이 쥔다.
export interface DefensePanelProps {
  view: RoomView; // defense 단계
  connection: RoomConnection;
  /** 낮 화면 토스트(DayScene 이 쥔다) */
  showToast: (text: string) => void;
  /** 채팅 목록: 오늘 변론 단계에서 받은 줄(서버가 후보의 say 만 받으므로 후보의 변론뿐이다) */
  lines: ChatLine[];
  /** 후보 닉네임 */
  candidateNickname: string;
  /** 후보가 지금 연결돼 있는가 */
  candidateConnected: boolean;
  /** 탈락한 viewer: 상태 줄·이모티콘 대신 관전 알약 */
  readOnly: boolean;
}

export function DefensePanel({ view, connection, showToast, lines, candidateNickname, candidateConnected, readOnly }: DefensePanelProps): ReactElement {
  const [trayOpen, setTrayOpen] = useState(false);
  const { coolingDown, blocked, sendAndLock } = useSendLock(connection, showToast);
  const { phaseEndsAt, phaseDurationMs } = view;
  const hasDeadline = phaseEndsAt !== null && phaseDurationMs !== null;
  // 훅은 조건부로 부를 수 없다 — 마감이 없으면 이미 지난 마감으로 불러 두고 초는 그리지 않는다
  const { seconds } = useCountdown(hasDeadline ? phaseEndsAt : 0, hasDeadline ? phaseDurationMs : 1, connection.offset);
  const sendEmoji = (icon: EmojiId): void => sendAndLock({ t: "emoji", icon });

  if (readOnly) {
    return (
      <div className="mf-turnpanel">
        <MessageLog lines={lines} players={view.players} mySeat={view.me.seat} />
        <ReadOnlyRow text={VERDICT_TEXT.spectatorPill} />
      </div>
    );
  }
  return (
    <div className="mf-turnpanel">
      <MessageLog lines={lines} players={view.players} mySeat={view.me.seat} />
      <div className="st-row">
        <p className="stat">
          <b>{candidateConnected ? defenseStatus(candidateNickname) : defenseDisconnected(candidateNickname)}</b>
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
