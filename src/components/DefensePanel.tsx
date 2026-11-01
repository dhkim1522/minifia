import type { ReactElement } from "react";
import type { RoomView } from "../../shared/protocol";
import { VERDICT_TEXT, defenseDisconnected, defenseStatus } from "../game/verdict";
import { useCountdown } from "../net/countdown";
import type { RoomConnection } from "../net/useRoomConnection";
import { ReadOnlyRow } from "./ReadOnlyRow";
import "../styles/day.css";

// 최후 변론의 하단(UI-SPEC 8.4·7.2): 후보 본인을 포함한 모두에게 같은 한 줄 `{이름}님이 변론하는 중 · N초`. 빠른 메시지·이모티콘·채팅 줄 입구가 없다(CHAT-06).
// TurnPanel 과 같은 모양이라 그 클래스(.mf-turnpanel·.st-row)를 그대로 쓴다(새 스타일 없음).
// 후보가 연결이 끊겨 있으면 상태 줄이 끊김 문구(D-05)다. 탈락 viewer(readOnly)는 상태 줄 대신 관전 알약뿐이다(D-35).
// 입력에 역할이 없다 — 닉네임·숫자는 React 텍스트로만 그린다(T-04-40). N초는 헤더 타이머와 같은 useCountdown 값이다.
export interface DefensePanelProps {
  view: RoomView; // defense 단계
  connection: RoomConnection;
  /** 후보 닉네임 */
  candidateNickname: string;
  /** 후보가 지금 연결돼 있는가 */
  candidateConnected: boolean;
  /** 탈락한 viewer: 상태 줄 대신 관전 알약 */
  readOnly: boolean;
}

export function DefensePanel({ view, connection, candidateNickname, candidateConnected, readOnly }: DefensePanelProps): ReactElement {
  const { phaseEndsAt, phaseDurationMs } = view;
  const hasDeadline = phaseEndsAt !== null && phaseDurationMs !== null;
  // 훅은 조건부로 부를 수 없다 — 마감이 없으면 이미 지난 마감으로 불러 두고 초는 그리지 않는다
  const { seconds } = useCountdown(hasDeadline ? phaseEndsAt : 0, hasDeadline ? phaseDurationMs : 1, connection.offset);

  if (readOnly) {
    return (
      <div className="mf-turnpanel">
        <ReadOnlyRow text={VERDICT_TEXT.spectatorPill} guide />
      </div>
    );
  }
  return (
    <div className="mf-turnpanel">
      <div className="st-row">
        <p className="stat">
          <b data-guide="">{candidateConnected ? defenseStatus(candidateNickname) : defenseDisconnected(candidateNickname)}</b>
          {hasDeadline ? <span>{seconds}초</span> : null}
        </p>
      </div>
    </div>
  );
}
