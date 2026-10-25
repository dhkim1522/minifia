import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { EmojiId, RoomView } from "../../shared/protocol";
import { isAlive } from "../../shared/game/alive";
import type { RoleId } from "../../shared/game/roles";
import { Backdrop } from "../components/Backdrop";
import { ClaimPanel } from "../components/ClaimPanel";
import { DayTable } from "../components/DayTable";
import type { DayTableSeat, SpectatorPick } from "../components/DayTable";
import { DiscussionControls } from "../components/DiscussionControls";
import { MessageLog } from "../components/MessageLog";
import { MorningCard, exitDelayOf } from "../components/MorningCard";
import { NIGHT_PANEL_TEXT, NightPanel, NoticePill, PickPill } from "../components/NightPanel";
import { PhaseBar } from "../components/PhaseBar";
import { RecordsToast } from "../components/RecordsToast";
import { ReadOnlyRow } from "../components/ReadOnlyRow";
import { Timer } from "../components/Timer";
import { TurnPanel } from "../components/TurnPanel";
import { UserRecordSheet } from "../components/UserRecordSheet";
import { Toast, useToast } from "../components/Toast";
import { morningCardText } from "../game/eliminationText";
import { EMOJI_TEXT, NIGHT_TEMPLATE_ORDER } from "../game/messageText";
import { claimLinesOf } from "../net/claimLines";
import { FLOAT_PHASES, useDayChat, useSeatFloats } from "../net/seatFloats";
import type { RoomConnection } from "../net/useRoomConnection";
import "../styles/day.css";
import "../styles/night.css";
import "../styles/phase.css";
import "../styles/testtools.css";
import "../styles/urecord.css";

// 밤 대상 버튼의 동사(접근성 이름 "{닉네임}, {동사} 대상"). 부품은 역할을 모르므로 장면이 값으로 넘긴다.
const PICK_VERB: Readonly<Partial<Record<RoleId, string>>> = { police: "조사", doctor: "보호", mafia: "지목" };

export interface DaySceneProps {
  view: RoomView;
  connection: RoomConnection;
  /** [내 역할] 버튼. 모양은 RoomScreen 이 한 가지로 만들어 넘긴다 */
  myRoleButton: ReactNode;
  /** 테스트 방 방장의 [테스트] 버튼(결정 0022). 있으면 장면 상자 왼쪽 위에 놓는다 */
  testButton?: ReactNode;
}

// 낮 두 단계(claim·discussion)와 밤·아침이 공유하는 장면. 순차 주장(결정 0023)·S-07.
// 단계는 DayTable 하나를 공유한다(결정 0017-1). 머리 위는 이모티콘만(0017-2). 이름표 아랫줄(완료·주장·탈락)은 주장 단계에 없다(0023-3).
// 테이블은 키가 없는 장면 상자 안에 있어 단계 사이에 다시 마운트되지 않는다(깜빡임·인물 재등장 없음, Pitfall 7·11).
// 위쪽 바와 하단 패널만 단계가 든 key(bar-·panel- 접두어로 서로 겹치지 않게)라 단계마다 새 요소가 되어 한 번 페이드된다.
// claim 하단: 서버가 정한 지금 차례(view.day.turn.seat)가 나면 직업 칩(ClaimPanel), 남이면 "…님이 주장하는 중 · N초"(TurnPanel).
// 낮 토론은 MessageLog·DiscussionControls. 화면은 스스로 단계나 차례를 넘기지 않는다(서버 view 만 따름). 역할 문자열을 화면에 쓰지 않는다.
export function DayScene({ view, connection, myRoleButton, testButton }: DaySceneProps) {
  const n = view.day?.n ?? 1;
  // 낮 토론의 보낸 사람 반전·이모티콘(자리별 한 번에 하나). 단계가 discussion 이 아니면 훅이 비운다.
  const floats = useSeatFloats(view, connection.onEvent);
  // 채팅 줄은 이 폰이 그날 받은 chat 이벤트에서만 만든다(서버 뷰에 메시지가 없다, 결정 0017-7)
  const chatLines = useDayChat(view, connection.onEvent);
  const { toast, show: showToast } = useToast();
  // 밤이 끝나 새 수사 기록이 생길 때만 2초 알림(경찰 전용, D-10). 처음 마운트·재접속(epoch 가 바뀜)·길이 불변에는 알리지 않는다(UI-SPEC N-5).
  const recordsToast = useToast(2000);
  const showRecordsToast = recordsToast.show;
  const isPolice = view.me.role === "police";
  const recordsLen = view.me.records?.length ?? 0;
  const prevRecords = useRef({ epoch: connection.epoch, len: recordsLen });
  useEffect(() => {
    const prev = prevRecords.current;
    prevRecords.current = { epoch: connection.epoch, len: recordsLen };
    if (isPolice && prev.epoch === connection.epoch && recordsLen > prev.len) showRecordsToast("수사 기록이 추가됐어요");
  }, [connection.epoch, recordsLen, isPolice, showRecordsToast]);
  // 가장 최근 이모티콘 하나를 보이지 않는 live 줄이 읽는다(UI-SPEC 접근성)
  const [lastEmoji, setLastEmoji] = useState<{ seat: number; icon: EmojiId } | null>(null);
  // 이모티콘을 받는 단계(claim·낮 토론·밤). 밤 이벤트는 서버가 살아 있는 마피아에게만 보낸다.
  const inFloatPhase = FLOAT_PHASES.has(view.phase);
  // 주장 줄(claim·discussion)은 서버가 공개한 claimLog 에서 화면이 만든다 — 재접속해도 복원되고 일차가 바뀌면 사라진다(D-05).
  // 주장 단계가 토론보다 먼저라 주장 줄이 받은 채팅 줄 앞이다. 밤에는 마피아 채팅만 있다.
  const dayLines = view.phase === "claim" || view.phase === "discussion" ? [...claimLinesOf(view), ...chatLines] : chatLines;
  useEffect(() => {
    if (!inFloatPhase) return;
    return connection.onEvent((e) => {
      if (e.t === "emoji") setLastEmoji({ seat: e.seat, icon: e.icon });
    });
  }, [connection.onEvent, inFloatPhase]);

  // 이모티콘 live 줄은 단계가 바뀌면 비운다(다음 단계에서 지난 것을 읽지 않게). 렌더 중 상태 조정이라 효과 없이 첫 커밋부터 맞는다.
  // 같은 조정에서 "밤 → 아침 전환을 이 화면이 직접 봤는가"(sawNightToMorning)를 기억한다 — 유령 맥동 조건(D-15). 아침을 벗어나면 초기화한다.
  const [prevPhase, setPrevPhase] = useState(view.phase);
  const [sawNightToMorning, setSawNightToMorning] = useState(false);
  if (prevPhase !== view.phase) {
    setPrevPhase(view.phase);
    setLastEmoji(null);
    setSawNightToMorning(prevPhase === "night" && view.phase === "morning");
  }
  const isNight = view.phase === "night";
  const isMorning = view.phase === "morning";
  // 아침 퇴장 지연: 아침 마감 시각이 바뀔 때(= 아침이 시작될 때) 한 번 정해 카드와 층이 같은 값을 쓴다(렌더마다 다시 계산하면 애니메이션이 흔들린다).
  const [morningExit, setMorningExit] = useState<{ ends: number | null; delay: number }>({ ends: null, delay: 0 });
  if (isMorning && view.phaseEndsAt !== null && morningExit.ends !== view.phaseEndsAt) {
    setMorningExit({ ends: view.phaseEndsAt, delay: exitDelayOf(view.phaseEndsAt - (Date.now() + connection.offset)) });
  }
  // 방금 탈락한 자리(서버 view.day.morning.eliminated, 공개 정보). 아침에만 의미가 있다.
  const eliminatedSeat = isMorning ? view.day?.morning?.eliminated : undefined;
  // 낮 캐릭터 탭 → 유저 기록 카드(D-06). 보고 있는 자리를 쥐고, 밤이 되면 닫는다(렌더 중 상태 조정이라 낮 → 밤 → 낮을 돌아와도 다시 열리지 않는다).
  const [inspectSeat, setInspectSeat] = useState<number | null>(null);
  if (isNight && inspectSeat !== null) setInspectSeat(null);
  const inspectable = view.phase === "claim" || view.phase === "discussion" || isMorning;
  const title = isNight ? "밤" : isMorning ? "아침" : view.phase === "discussion" ? "낮 · 토론" : "낮 · 직업 공개";

  // 밤 대상 선택(D-01·D-06). 행위자 = 살아 있는 마피아·경찰·의사. 누를 수 있는 자리는 살아 있는 사람이다(역할별 제외는 아래).
  // 낙관적 선택: ClaimPanel 과 같이 어느 view 를 보고 있을 때 눌렀는지 함께 기억한다. 새 서버 view(다른 객체)가 오면 버려
  // 서버 값(view.me.pick)을 따른다 — 서버가 거절하면 같은 소켓에 state 를 다시 보낸다(T-03-27).
  const myPlayer = view.players.find((p) => p.seat === view.me.seat);
  const meAlive = myPlayer ? isAlive(myPlayer) : true;
  const pickVerb = view.me.role ? PICK_VERB[view.me.role] : undefined;
  const actor = isNight && meAlive && pickVerb !== undefined;
  const myRole = view.me.role;
  // 관전 표시는 서버가 탈락자에게만 보낸 view.spectate 에서만 만든다(결정 0021) — 살아 있는 사람 화면에는 이 입력이 없다.
  // 내가 탈락했는데 spectate 가 없으면(옛 서버) 테이블은 탈락 표시만, 하단은 관전 하단 그대로 그린다.
  const meDead = !meAlive;
  const spectate = meDead ? view.spectate : undefined;
  const jobOf = (seat: number): RoleId | undefined => spectate?.seats.find((x) => x.seat === seat)?.job;
  const spectatorPicksOf = (seat: number): SpectatorPick[] => {
    const picks = isNight ? spectate?.picks : undefined;
    return picks ? (["mafia", "police", "doctor"] as const).filter((k) => picks[k].includes(seat)) : [];
  };
  const mafiaNight = isNight && meAlive && myRole === "mafia";
  // 경찰·의사의 하단은 NightPanel(눌리지 않는 알약). 선택 거부 토스트는 이 하단일 때만 이 장면이 구독한다 —
  // 마피아 하단은 DiscussionControls 가 같은 토스트를 이미 띄운다(중복 구독 없음).
  const pickPanelRole = isNight && meAlive && (myRole === "police" || myRole === "doctor") ? myRole : null;
  const hasPickPanel = pickPanelRole !== null;
  const { onEvent } = connection;
  useEffect(() => {
    if (!hasPickPanel) return;
    return onEvent((e) => {
      if (e.t === "error" && e.code === "BAD_MESSAGE") showToast(NIGHT_PANEL_TEXT.pickError);
    });
  }, [onEvent, hasPickPanel, showToast]);
  const [pending, setPending] = useState<{ view: RoomView; target: number } | null>(null);
  const shownPick = pending !== null && pending.view === view ? pending.target : view.me.pick;
  const pressPick = (target: number): void => {
    if (target === shownPick) return; // 선택 해제 없음, 같은 대상 재탭은 아무 일도 없다
    setPending({ view, target });
    connection.send({ t: "pick", target });
  };

  const allies = view.me.allies ?? [];
  // 동료가 고른 대상(마피아 화면만, D-07). 서버가 생존 마피아에게만 보낸 값이다.
  const allyPicks = view.me.allyPicks ?? [];
  const nicknameOf = (seat: number): string | undefined => view.players.find((p) => p.seat === seat)?.nickname;
  // 차례 강조(D-03): 서버 view 의 지금 차례 한 자리에만 발밑 링·말풍선 배지·이름표 반전. 차례가 넘어가면 다음 자리로 옮겨 간다.
  const turnSeat = view.phase === "claim" ? view.day?.turn?.seat : undefined;
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
        // 관전 화면은 모든 마피아에 링·마름모를 그린다(job 이 mafia 인 다른 자리)
        isAlly: allies.includes(p.seat) || (spectate !== undefined && p.seat !== view.me.seat && jobOf(p.seat) === "mafia"),
        dead: !isAlive(p),
        ...(spectatorPicksOf(p.seat).length > 0 ? { spectatorPicks: spectatorPicksOf(p.seat) } : {}),
        spoke: floats.spoke[p.seat] !== undefined,
        turn: p.seat === turnSeat,
        // 아침: 방금 탈락한 한 자리는 어둡게 층 위(z 31)에 남고, 밤 → 아침을 직접 본 경우에만 400ms 맥동한다(재접속은 z 만).
        ...(eliminatedSeat !== undefined && p.seat === eliminatedSeat ? { spotlit: true, ...(sawNightToMorning ? { pulse: true } : {}) } : {}),
        emoji: e ? { key: e.key, icon: e.icon, z: e.z } : null,
        // 누를 수 있는 자리: 살아 있는 사람. 마피아 화면은 자신·동료도 눌리지 않는 이전 마크업이다(D-02 개정).
        ...(actor && isAlive(p) && !(myRole === "mafia" && (p.seat === view.me.seat || allies.includes(p.seat)))
          ? { onPick: () => pressPick(p.seat) }
          : {}),
        ...(actor && (shownPick === p.seat || (mafiaNight && allyPicks.includes(p.seat)))
          ? { pick: { ...(shownPick === p.seat ? { mine: true } : {}), ...(mafiaNight && allyPicks.includes(p.seat) ? { ally: true } : {}) } }
          : {}),
        // 낮(claim·discussion·morning): 탈락한 viewer 포함 모든 자리가 읽기 전용 기록 카드 버튼이다. 연결 상태와 무관하고 서버 요청이 없다.
        // 밤에는 주지 않는다 — 밤 onPick 과 한 자리에 함께 켜지지 않는다.
        ...(inspectable ? { onInspect: () => setInspectSeat(p.seat) } : {}),
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
  // claim 의 타이머는 지금 차례의 남은 시간(8초 → 0)이고 calm 이다 — 8초 중 마지막 5초가 늘 진홍이면 경고처럼 보인다.
  // 아침 5초도 전체가 마지막 5초라 진홍을 쓰지 않는다(calm, UI-SPEC 확인 필요 10).
  const timer =
    endsAt !== null && durationMs !== null ? (
      <Timer endsAt={endsAt} durationMs={durationMs} offset={connection.offset} calm={isMorning || view.phase === "claim"} />
    ) : null;

  return (
    <Backdrop layout="game" variant={isNight ? "night" : "day"} className="mf-dayscene__backdrop">
      <main className="mf-root mf-dayscene">
        <div key={`bar-${view.phase}`} className="mf-dayscene__enter">
          <PhaseBar title={title} instruction={mafiaNight ? `${n}일차 · 함께 지목하세요` : isMorning ? `${n + 1}일차` : `${n}일차`} extra={myRoleButton} timer={timer} />
        </div>
        <div className="mf-dayscene__scene">
          {testButton ? <div className="mf-tt-anchor">{testButton}</div> : null}
          <DayTable
            seats={seats}
            mySeat={view.me.seat}
            pickVerb={pickVerb}
            pickDisabled={!connection.canSend}
            {...(spectate !== undefined ? { allyMarkLabel: "마피아" } : {})}
            {...(isMorning ? { dim: { exitDelayMs: morningExit.delay } } : {})}
          />
        </div>
        {isMorning ? <MorningCard {...morningCardText(view.day?.morning, nicknameOf)} exitDelayMs={morningExit.delay} /> : null}
        <section key={`panel-${view.phase}`} className="mf-dayscene__panel mf-dayscene__enter">
          {isMorning ? (
            // 아침 하단(UI-SPEC M): 살아 있는 사람·탈락자·관전자 모두 같은 제목+안내. 알약·채팅·버튼 없음.
            <NightPanel title={NIGHT_PANEL_TEXT.morning.title} guide={NIGHT_PANEL_TEXT.morning.guide} />
          ) : meDead ? (
            // 관전 하단(UI-SPEC N-6): 채팅 읽기 전용 + 읽기 전용 안내 줄. 보내기 줄·직업 공개 칩 줄은 그리지 않는다.
            <>
              {isNight ? (
                <MessageLog
                  lines={chatLines}
                  players={view.players}
                  mySeat={view.me.seat}
                  label="마피아 채팅(관전)"
                  systemLine="관전 중 · 마피아 채팅"
                  more={false}
                />
              ) : (
                <MessageLog lines={dayLines} players={view.players} mySeat={view.me.seat} />
              )}
              <ReadOnlyRow />
            </>
          ) : view.phase === "claim" ? (
            view.day?.turn?.seat === view.me.seat ? (
              <ClaimPanel view={view} canSend={connection.canSend} send={connection.send} />
            ) : (
              <TurnPanel view={view} connection={connection} showToast={showToast} lines={dayLines} />
            )
          ) : view.phase === "discussion" ? (
            <>
              <MessageLog lines={dayLines} players={view.players} mySeat={view.me.seat} />
              <DiscussionControls view={view} connection={connection} showToast={showToast} />
            </>
          ) : mafiaNight ? (
            <>
              <MessageLog
                lines={chatLines}
                players={view.players}
                mySeat={view.me.seat}
                label="마피아 채팅"
                systemLine={NIGHT_PANEL_TEXT.mafiaChatNotice}
              />
              <DiscussionControls view={view} connection={connection} showToast={showToast} templates={NIGHT_TEMPLATE_ORDER} />
            </>
          ) : pickPanelRole ? (
            <NightPanel title={NIGHT_PANEL_TEXT[pickPanelRole].title} guide={NIGHT_PANEL_TEXT[pickPanelRole].guide}>
              <PickPill pick={pickPillOf()} />
            </NightPanel>
          ) : isNight && meAlive ? (
            <NightPanel title={NIGHT_PANEL_TEXT.citizen.title} guide={NIGHT_PANEL_TEXT.citizen.guide}>
              <NoticePill text={NIGHT_PANEL_TEXT.citizen.pill} />
            </NightPanel>
          ) : null}
        </section>
        {inFloatPhase ? (
          <p className="mf-sr-only" aria-live="polite">
            {lastEmoji ? `${nicknameOf(lastEmoji.seat) ?? ""}: ${EMOJI_TEXT[lastEmoji.icon].name}` : ""}
          </p>
        ) : null}
        <Toast toast={toast} placement="top" />
        <RecordsToast toast={recordsToast.toast} />
        {inspectSeat !== null ? (
          <UserRecordSheet
            seat={inspectSeat}
            nickname={nicknameOf(inspectSeat) ?? ""}
            claimLog={view.day?.claimLog ?? []}
            onClose={() => setInspectSeat(null)}
          />
        ) : null}
      </main>
    </Backdrop>
  );
}
