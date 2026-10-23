import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { EmojiId, RoomView } from "../../shared/protocol";
import { CLAIM_REVEAL_MS } from "../../shared/game/phases";
import { SEAT_COUNT } from "../../shared/seatLayout";
import { Backdrop } from "../components/Backdrop";
import { ClaimPanel } from "../components/ClaimPanel";
import { claimName } from "../components/ClaimTag";
import { DiscussionControls } from "../components/DiscussionControls";
import { MessageLog } from "../components/MessageLog";
import { PhaseBar } from "../components/PhaseBar";
import { Table } from "../components/Table";
import type { TableFloat, TableSeat } from "../components/Table";
import { Timer } from "../components/Timer";
import { Toast, useToast } from "../components/Toast";
import { EMOJI_TEXT, messageText } from "../game/messageText";
import { useSeatFloats } from "../net/seatFloats";
import type { SeatFloatState } from "../net/seatFloats";
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
  // 낮 토론의 말풍선·이모티콘(자리별 한 번에 하나). 단계가 discussion 이 아니면 훅이 비운다.
  const floats = useSeatFloats(view, connection.onEvent);
  const { toast, show: showToast } = useToast();
  // 가장 최근 이모티콘 하나를 보이지 않는 live 줄이 읽는다(UI-SPEC 접근성)
  const [lastEmoji, setLastEmoji] = useState<{ seat: number; icon: EmojiId } | null>(null);
  const inDiscussion = view.phase === "discussion";
  useEffect(() => {
    if (!inDiscussion) return;
    return connection.onEvent((e) => {
      if (e.t === "emoji") setLastEmoji({ seat: e.seat, icon: e.icon });
    });
  }, [connection.onEvent, inDiscussion]);

  // 공개 연출(말풍선 팝)은 이 화면이 직전에 claim 을 보고 있다가 claimReveal 을 받았을 때만 켠다.
  // 서버 단계가 분리돼 있어 모든 폰이 같은 순간 시작한다. 재접속으로 claimReveal 에 바로 들어오면 켜지 않는다(알약만).
  // 렌더 중 상태 조정(이전 단계 기억)이라 효과 없이 첫 커밋부터 말풍선이 보인다.
  const [prevPhase, setPrevPhase] = useState(view.phase);
  const [revealing, setRevealing] = useState(false);
  if (prevPhase !== view.phase) {
    setPrevPhase(view.phase);
    setLastEmoji(null); // 이모티콘 live 줄은 토론이 끝나면 비운다(다음 토론에서 지난 것을 읽지 않게)
    setRevealing(prevPhase === "claim" && view.phase === "claimReveal");
  }
  useEffect(() => {
    if (!revealing) return;
    const timer = setTimeout(() => setRevealing(false), CLAIM_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [revealing]);
  const title = view.phase === "discussion" ? "낮 · 토론" : "낮 · 직업 공개";

  const allies = view.me.allies ?? [];
  // 완료 알약은 서버가 보낸 claimDone 에서만 만든다 — 무엇을 골랐는지는 서버가 보내지 않는다(D-01).
  const claimDone = view.phase === "claim" ? (view.day?.claimDone ?? []) : [];
  // 남의 주장은 서버가 공개한 claims 에서만 그린다(claimReveal·discussion).
  const claims = view.phase === "claimReveal" || view.phase === "discussion" ? (view.day?.claims ?? []) : [];
  const nicknameOf = (seat: number): string | undefined => view.players.find((p) => p.seat === seat)?.nickname;
  // 서버가 보낸 문장이 아니라 템플릿 ID·seat 로 화면이 만든 문장만 말풍선에 넣는다(T-02-31).
  const discussionFloat = (f: SeatFloatState | undefined): TableFloat | null => {
    if (view.phase !== "discussion" || f === undefined) return null;
    return f.kind === "bubble"
      ? { kind: "bubble", key: f.key, z: f.z, text: messageText(f.line, nicknameOf), elapsedMs: f.elapsedMs }
      : { kind: "emoji", key: f.key, z: f.z, icon: f.icon, elapsedMs: f.elapsedMs };
  };
  const seats: (TableSeat | null)[] = Array.from({ length: SEAT_COUNT }, () => null);
  for (const p of view.players) {
    const c = claims.find((x) => x.seat === p.seat);
    seats[p.seat] = {
      nickname: p.nickname,
      connected: p.connected,
      isHost: p.isHost,
      isMe: p.seat === view.me.seat,
      isAlly: allies.includes(p.seat),
      done: claimDone.includes(p.seat),
      claim: c ? { job: c.claim, changed: c.changed } : null,
      float:
        c && revealing && view.phase === "claimReveal"
          ? {
              kind: "reveal",
              key: `reveal-${n}-${p.seat}`,
              z: 0,
              text: claimName(c.claim),
              dim: c.claim === "none",
              animate: true,
            }
          : discussionFloat(floats[p.seat]),
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
          {view.phase === "claim" || view.phase === "claimReveal" ? (
            <ClaimPanel view={view} canSend={connection.canSend} send={connection.send} />
          ) : view.phase === "discussion" ? (
            <>
              <MessageLog lines={view.day?.messages ?? []} players={view.players} mySeat={view.me.seat} />
              <DiscussionControls view={view} connection={connection} showToast={showToast} />
            </>
          ) : null}
        </section>
        {inDiscussion ? (
          <p className="mf-sr-only" aria-live="polite">
            {lastEmoji ? `${nicknameOf(lastEmoji.seat) ?? ""}: ${EMOJI_TEXT[lastEmoji.icon].name}` : ""}
          </p>
        ) : null}
        <Toast toast={toast} placement="top" />
      </main>
    </Backdrop>
  );
}
