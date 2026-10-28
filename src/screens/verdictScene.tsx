import type { ReactNode } from "react";
import type { RoomView } from "../../shared/protocol";
import { ExecVotePanel } from "../components/ExecVotePanel";
import type { RoomConnection } from "../net/useRoomConnection";

// 투표 구간(execVote → execution) 전용 장면 조립 훅(04-16). DayScene 은 이 훅이 null 이 아닐 때만 제목·안내·타이머 톤·하단을 이 값으로 덮는다 —
// 낮·밤·아침 경로는 한 줄도 바뀌지 않는다. 이후 계획이 후보 선택·공개·변론·처형 단계를 이 파일에 더한다(DayScene 줄 수를 늘리지 않는다).
// 이 훅은 서버 view 만 따른다. 단계나 승패를 화면이 스스로 정하지 않고, 역할 문자열을 만들지 않는다.

export interface VerdictSceneCtx {
  view: RoomView;
  connection: RoomConnection;
}

/** 투표 구간 장면이 DayScene 에 넘기는 값. 단계가 늘면 필드가 늘어난다. */
export interface VerdictScene {
  /** 위쪽 바 제목 */
  title: string;
  /** 위쪽 바 안내(제목 아래 줄) */
  instruction: string;
  /** true 면 마지막 5초에도 타이머가 진홍이 되지 않는다(UI-SPEC 6.1 P-9) */
  calm: boolean;
  /** 하단 패널 안쪽 */
  bottom: ReactNode;
}

export function useVerdictScene({ view, connection }: VerdictSceneCtx): VerdictScene | null {
  const n = view.day?.n ?? 1;
  if (view.phase === "execVote") {
    return {
      title: "낮 · 처형 여부",
      instruction: `${n}일차`,
      calm: true,
      bottom: <ExecVotePanel view={view} canSend={connection.canSend} send={connection.send} />,
    };
  }
  return null;
}
