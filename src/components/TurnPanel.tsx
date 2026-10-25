import type { ReactElement } from "react";
import type { RoomView } from "../../shared/protocol";
import { useCountdown } from "../net/countdown";
import "../styles/day.css";

// 남의 차례 하단 최소형(03.1 UI-SPEC B, 시안 K2): `{닉네임}님이 주장하는 중` + 남은 `N초`.
// 03.1-07 이 같은 마크업(.st-row·.stat) 위에 채팅 세 줄과 이모티콘 버튼을 더한다.
// 닉네임·숫자는 React 텍스트로만 그린다(T-03.1-10). N초는 헤더 타이머와 같은 useCountdown 값이다.
export interface TurnPanelProps {
  view: RoomView; // claim 단계, 지금 차례가 남
  /** 서버 시각 − 로컬 시각 (connection.offset) */
  offset: number;
}

export function TurnPanel({ view, offset }: TurnPanelProps): ReactElement {
  const turnSeat = view.day?.turn?.seat;
  const nickname = view.players.find((p) => p.seat === turnSeat)?.nickname;
  const { phaseEndsAt, phaseDurationMs } = view;
  const hasDeadline = phaseEndsAt !== null && phaseDurationMs !== null;
  // 훅은 조건부로 부를 수 없다 — 마감이 없으면 이미 지난 마감으로 불러 두고 초는 그리지 않는다
  const { seconds } = useCountdown(hasDeadline ? phaseEndsAt : 0, hasDeadline ? phaseDurationMs : 1, offset);
  return (
    <div className="st-row">
      <p className="stat">
        <b>{nickname !== undefined ? `${nickname}님이 주장하는 중` : ""}</b>
        {hasDeadline ? <span>{seconds}초</span> : null}
      </p>
    </div>
  );
}
