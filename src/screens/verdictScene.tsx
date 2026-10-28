import { useEffect } from "react";
import type { ReactNode } from "react";
import type { RoomView } from "../../shared/protocol";
import type { DayTableSeat } from "../components/DayTable";
import { ExecVotePanel } from "../components/ExecVotePanel";
import { NIGHT_PANEL_TEXT } from "../components/NightPanel";
import type { RoomConnection } from "../net/useRoomConnection";

// 투표 구간(execVote → execution) 전용 장면 조립 훅(04-16). DayScene 은 이 훅이 null 이 아닐 때만 제목·안내·타이머 톤·하단·좌석 덧입힘을 이 값으로 덮는다 —
// 낮·밤·아침 경로는 한 줄도 바뀌지 않는다. 이후 계획이 후보 선택·공개·변론·처형 단계를 이 파일에 더한다(DayScene 줄 수를 늘리지 않는다).
// 이 훅은 서버 view 만 따른다. 단계나 승패를 화면이 스스로 정하지 않고, 역할 문자열을 만들지 않는다.
// 투표 단계에는 말하기·이모티콘 입구가 없다(D-12 개정, P-7): FLOAT_PHASES·CHAT_PHASES 에 이 단계들이 없어 말풍선·이모티콘·채팅 줄도 뜨지 않는다.

export interface VerdictSceneCtx {
  view: RoomView;
  connection: RoomConnection;
  /** 내 자리가 살아 있는가(탈락 viewer 는 관전 하단) */
  meAlive: boolean;
  /** 위쪽 토스트 */
  showToast: (text: string) => void;
  /** 좌석을 눌렀을 때 열 기록 카드(DayScene 이 쥔 상태) */
  onInspect: (seat: number) => void;
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
  /** 자리별 덧입힘: 투표 단계에서는 모든 자리(살아 있든 탈락했든)가 읽기 전용 기록 카드 버튼이다 */
  seatPatch: (seat: number) => Partial<DayTableSeat>;
}

// 서버가 보낸 행동을 거절하는 단계: 여부 투표와 후보 선택(04-18 이 같은 효과를 쓴다). 밤 대상 선택의 토스트는 DayScene 이 밤에만 구독하므로 겹치지 않는다.
const REJECTING_PHASES: ReadonlySet<RoomView["phase"]> = new Set<RoomView["phase"]>(["execVote", "candidateVote"]);

export function useVerdictScene({ view, connection, meAlive, showToast, onInspect }: VerdictSceneCtx): VerdictScene | null {
  const rejecting = REJECTING_PHASES.has(view.phase);
  const { onEvent } = connection;
  useEffect(() => {
    if (!rejecting) return;
    return onEvent((e) => {
      if (e.t === "error" && e.code === "BAD_MESSAGE") showToast(NIGHT_PANEL_TEXT.pickError);
    });
  }, [onEvent, rejecting, showToast]);

  const n = view.day?.n ?? 1;
  if (view.phase === "execVote") {
    return {
      title: "낮 · 처형 여부",
      instruction: `${n}일차`,
      calm: true,
      bottom: <ExecVotePanel view={view} canSend={connection.canSend} send={connection.send} readOnly={!meAlive} />,
      seatPatch: (seat) => ({ onInspect: () => onInspect(seat) }),
    };
  }
  return null;
}
