import type { ReactNode } from "react";
import type { RoomView } from "../../shared/protocol";
import { SEAT_COUNT } from "../../shared/seatLayout";
import { Backdrop } from "../components/Backdrop";
import { ClaimPanel } from "../components/ClaimPanel";
import { PhaseBar } from "../components/PhaseBar";
import { Table } from "../components/Table";
import type { TableSeat } from "../components/Table";
import { Timer } from "../components/Timer";
import type { RoomConnection } from "../net/useRoomConnection";
import "../styles/day.css";
import "../styles/phase.css";

export interface DaySceneProps {
  view: RoomView;
  connection: RoomConnection;
  /** [내 역할] 버튼. 모양은 RoomScreen 이 한 가지로 만들어 넘긴다 */
  myRoleButton: ReactNode;
}

// 낮 세 단계(claim·claimReveal·discussion)가 공유하는 장면. S-06b·S-06c·S-07.
// 테이블은 키가 없는 장면 상자 안에 있어 세 단계 사이에 다시 마운트되지 않는다(깜빡임·인물 재등장 없음, Pitfall 7·11).
// 위쪽 바와 하단 패널만 단계가 든 key(bar-·panel- 접두어로 서로 겹치지 않게)라 단계마다 새 요소가 되어 한 번 페이드된다.
// 패널 내용은 02-08(직업 공개 ClaimPanel, 아래)·02-09(낮 토론 MessageLog·DiscussionControls)가 이 section 에 넣는다.
// 화면은 스스로 단계를 넘기지 않는다(서버 view 만 따름). 역할 문자열을 화면에 쓰지 않는다.
export function DayScene({ view, connection, myRoleButton }: DaySceneProps) {
  const n = view.day?.n ?? 1;
  const title = view.phase === "discussion" ? "낮 · 토론" : "낮 · 직업 공개";

  const allies = view.me.allies ?? [];
  // 완료 알약은 서버가 보낸 claimDone 에서만 만든다 — 무엇을 골랐는지는 서버가 보내지 않는다(D-01).
  const claimDone = view.phase === "claim" ? (view.day?.claimDone ?? []) : [];
  const seats: (TableSeat | null)[] = Array.from({ length: SEAT_COUNT }, () => null);
  for (const p of view.players) {
    seats[p.seat] = {
      nickname: p.nickname,
      connected: p.connected,
      isHost: p.isHost,
      isMe: p.seat === view.me.seat,
      isAlly: allies.includes(p.seat),
      done: claimDone.includes(p.seat),
    };
  }

  const endsAt = view.phaseEndsAt;
  const durationMs = view.phaseDurationMs;
  // claimReveal 의 타이머는 0:00 과 빈 막대로 머문다 — 남은 시간 0 고정(endsAt 0, offset 0, RESEARCH Pattern 7).
  const timer =
    view.phase === "claimReveal" ? (
      <Timer endsAt={0} durationMs={durationMs ?? 1} offset={0} />
    ) : endsAt !== null && durationMs !== null ? (
      <Timer endsAt={endsAt} durationMs={durationMs} offset={connection.offset} />
    ) : null;

  return (
    <Backdrop layout="game" variant="day" className="mf-dayscene__backdrop">
      <main className="mf-root mf-dayscene">
        <div key={`bar-${view.phase}`} className="mf-dayscene__enter">
          <PhaseBar title={title} instruction={`${n}일차`} extra={myRoleButton} timer={timer} />
        </div>
        <div className="mf-dayscene__scene">
          <Table seats={seats} mySeat={view.me.seat} />
        </div>
        <section key={`panel-${view.phase}`} className="mf-dayscene__panel mf-dayscene__enter">
          {view.phase === "claim" ? (
            <ClaimPanel view={view} canSend={connection.canSend} send={connection.send} />
          ) : null}
        </section>
      </main>
    </Backdrop>
  );
}
