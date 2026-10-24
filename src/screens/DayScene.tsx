import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { EmojiId, RoomView } from "../../shared/protocol";
import { isAlive } from "../../shared/game/alive";
import { CLAIM_REVEAL_MS } from "../../shared/game/phases";
import type { RoleId } from "../../shared/game/roles";
import { Backdrop } from "../components/Backdrop";
import { ClaimPanel } from "../components/ClaimPanel";
import { DayTable } from "../components/DayTable";
import type { DayTableSeat, DayTagRow } from "../components/DayTable";
import { DiscussionControls } from "../components/DiscussionControls";
import { MessageLog } from "../components/MessageLog";
import { NIGHT_PANEL_TEXT, NightPanel, PickPill } from "../components/NightPanel";
import { PhaseBar } from "../components/PhaseBar";
import { Timer } from "../components/Timer";
import { Toast, useToast } from "../components/Toast";
import { EMOJI_TEXT } from "../game/messageText";
import { useDayChat, useSeatFloats } from "../net/seatFloats";
import type { RoomConnection } from "../net/useRoomConnection";
import "../styles/day.css";
import "../styles/night.css";
import "../styles/phase.css";

// 밤 대상 버튼의 동사(접근성 이름 "{닉네임}, {동사} 대상"). 부품은 역할을 모르므로 장면이 값으로 넘긴다.
const PICK_VERB: Readonly<Partial<Record<RoleId, string>>> = { police: "조사", doctor: "보호", mafia: "지목" };

export interface DaySceneProps {
  view: RoomView;
  connection: RoomConnection;
  /** [내 역할] 버튼. 모양은 RoomScreen 이 한 가지로 만들어 넘긴다 */
  myRoleButton: ReactNode;
}

// 낮 세 단계(claim·claimReveal·discussion)가 공유하는 장면. S-06b·S-06c·S-07.
// 세 단계는 DayTable 하나를 공유한다(결정 0017-1). 머리 위는 이모티콘만(0017-2), 완료·공개는 이름표 아랫줄(0017-6).
// 테이블은 키가 없는 장면 상자 안에 있어 세 단계 사이에 다시 마운트되지 않는다(깜빡임·인물 재등장 없음, Pitfall 7·11).
// 위쪽 바와 하단 패널만 단계가 든 key(bar-·panel- 접두어로 서로 겹치지 않게)라 단계마다 새 요소가 되어 한 번 페이드된다.
// 패널 내용은 02-08(직업 공개 ClaimPanel, 아래)·02-09(낮 토론 MessageLog·DiscussionControls)가 이 section 에 넣는다.
// 화면은 스스로 단계를 넘기지 않는다(서버 view 만 따름). 역할 문자열을 화면에 쓰지 않는다.
export function DayScene({ view, connection, myRoleButton }: DaySceneProps) {
  const n = view.day?.n ?? 1;
  // 낮 토론의 보낸 사람 반전·이모티콘(자리별 한 번에 하나). 단계가 discussion 이 아니면 훅이 비운다.
  const floats = useSeatFloats(view, connection.onEvent);
  // 채팅 줄은 이 폰이 그날 받은 chat 이벤트에서만 만든다(서버 뷰에 메시지가 없다, 결정 0017-7)
  const chatLines = useDayChat(view, connection.onEvent);
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

  // 공개 연출(아랫줄 팝+흔들림)은 이 화면이 직전에 claim 을 보고 있다가 claimReveal 을 받았을 때만 켠다.
  // 서버 단계가 분리돼 있어 모든 폰이 같은 순간 시작한다. 재접속으로 claimReveal 에 바로 들어오면 켜지 않는다(주장만 보인다).
  // 렌더 중 상태 조정(이전 단계 기억)이라 효과 없이 첫 커밋부터 팝이 보인다.
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
  const isNight = view.phase === "night";
  const title = isNight ? "밤" : view.phase === "discussion" ? "낮 · 토론" : "낮 · 직업 공개";

  // 밤 대상 선택(D-01·D-06). 행위자 = 살아 있는 마피아·경찰·의사. 누를 수 있는 자리는 살아 있는 사람이다(역할별 제외는 아래).
  // 낙관적 선택: ClaimPanel 과 같이 어느 view 를 보고 있을 때 눌렀는지 함께 기억한다. 새 서버 view(다른 객체)가 오면 버려
  // 서버 값(view.me.pick)을 따른다 — 서버가 거절하면 같은 소켓에 state 를 다시 보낸다(T-03-27).
  const myPlayer = view.players.find((p) => p.seat === view.me.seat);
  const meAlive = myPlayer ? isAlive(myPlayer) : true;
  const pickVerb = view.me.role ? PICK_VERB[view.me.role] : undefined;
  const actor = isNight && meAlive && pickVerb !== undefined;
  const [pending, setPending] = useState<{ view: RoomView; target: number } | null>(null);
  const shownPick = pending !== null && pending.view === view ? pending.target : view.me.pick;
  const pressPick = (target: number): void => {
    if (target === shownPick) return; // 선택 해제 없음, 같은 대상 재탭은 아무 일도 없다
    setPending({ view, target });
    connection.send({ t: "pick", target });
  };

  const allies = view.me.allies ?? [];
  // 아랫줄 완료는 서버가 보낸 claimDone 에서만 만든다 — 무엇을 골랐는지는 서버가 보내지 않는다(D-01).
  const claimDone = view.phase === "claim" ? (view.day?.claimDone ?? []) : [];
  // 남의 주장은 서버가 공개한 claims 에서만 그린다(claimReveal·discussion, 밤·아침에는 그날 낮의 주장을 유지 — UI-SPEC C6).
  const claims =
    view.phase === "claimReveal" || view.phase === "discussion" || view.phase === "night" || view.phase === "morning"
      ? (view.day?.claims ?? [])
      : [];
  const nicknameOf = (seat: number): string | undefined => view.players.find((p) => p.seat === seat)?.nickname;
  const rowOf = (seat: number): DayTagRow | null => {
    if (view.phase === "claim") return claimDone.includes(seat) ? { kind: "done" } : { kind: "wait" };
    const c = claims.find((x) => x.seat === seat);
    return c ? { kind: "claim", job: c.claim, changed: c.changed, pop: revealing && view.phase === "claimReveal" } : null;
  };
  const seats: DayTableSeat[] = [...view.players]
    .sort((x, y) => x.seat - y.seat)
    .map((p) => {
      const e = floats.emoji[p.seat];
      return {
        seat: p.seat,
        nickname: p.nickname,
        connected: p.connected,
        isHost: p.isHost,
        isMe: p.seat === view.me.seat,
        isAlly: allies.includes(p.seat),
        row: rowOf(p.seat),
        spoke: floats.spoke[p.seat] !== undefined,
        emoji: e ? { key: e.key, icon: e.icon, z: e.z } : null,
        ...(actor && isAlive(p) ? { onPick: () => pressPick(p.seat) } : {}),
        ...(actor && shownPick === p.seat ? { pick: { mine: true } } : {}),
      };
    });

  // 하단 알약: 지금 보이는 선택. 자신이면 "나"
  const pickPillOf = (): { seat: number; label: string } | null => {
    if (shownPick === undefined) return null;
    const label = shownPick === view.me.seat ? "나" : nicknameOf(shownPick);
    return label === undefined ? null : { seat: shownPick, label };
  };

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
    <Backdrop layout="game" variant={isNight ? "night" : "day"} className="mf-dayscene__backdrop">
      <main className="mf-root mf-dayscene">
        <div key={`bar-${view.phase}`} className="mf-dayscene__enter">
          <PhaseBar title={title} instruction={`${n}일차`} extra={myRoleButton} timer={timer} />
        </div>
        <div className="mf-dayscene__scene">
          <DayTable seats={seats} mySeat={view.me.seat} pickVerb={pickVerb} pickDisabled={!connection.canSend} />
        </div>
        <section key={`panel-${view.phase}`} className="mf-dayscene__panel mf-dayscene__enter">
          {view.phase === "claim" || view.phase === "claimReveal" ? (
            <ClaimPanel view={view} canSend={connection.canSend} send={connection.send} />
          ) : view.phase === "discussion" ? (
            <>
              <MessageLog lines={chatLines} players={view.players} mySeat={view.me.seat} />
              <DiscussionControls view={view} connection={connection} showToast={showToast} />
            </>
          ) : isNight && (view.me.role === "police" || view.me.role === "doctor") ? (
            <NightPanel title={NIGHT_PANEL_TEXT[view.me.role].title} guide={NIGHT_PANEL_TEXT[view.me.role].guide}>
              <PickPill pick={pickPillOf()} />
            </NightPanel>
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
