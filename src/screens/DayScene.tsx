import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { EmojiId, PhaseId, RoomView } from "../../shared/protocol";
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
import { ReadOnlyRow } from "../components/ReadOnlyRow";
import { SceneIntro } from "../components/SceneIntro";
import { Timer } from "../components/Timer";
import { TurnPanel } from "../components/TurnPanel";
import { UserRecordSheet } from "../components/UserRecordSheet";
import { Toast, useToast } from "../components/Toast";
import { morningCardText } from "../game/eliminationText";
import { PHASE_INTRO, sceneOfPhase } from "../game/scenes";
import type { SceneId } from "../game/scenes";
import { EMOJI_TEXT, NIGHT_TEMPLATE_ORDER } from "../game/messageText";
import { claimLinesOf } from "../net/claimLines";
import { FLOAT_PHASES, useDayChat, useSeatFloats } from "../net/seatFloats";
import type { RoomConnection } from "../net/useRoomConnection";
import { useVerdictScene } from "./verdictScene";
import "../styles/day.css";
import "../styles/night.css";
import "../styles/phase.css";
import "../styles/testtools.css";
import "../styles/urecord.css";
import "../styles/verdict.css";

// 밤 대상 버튼의 동사(접근성 이름 "{닉네임}, {동사} 대상"). 부품은 역할을 모르므로 장면이 값으로 넘긴다.
const PICK_VERB: Readonly<Partial<Record<RoleId, string>>> = { police: "조사", doctor: "보호", mafia: "지목" };

export interface DaySceneProps {
  view: RoomView;
  connection: RoomConnection;
  /** [역할 카드] 버튼. 모양은 RoomScreen 이 한 가지로 만들어 넘긴다 */
  myRoleButton: ReactNode;
  /** 테스트 방 방장의 [테스트] 버튼(결정 0022). 있으면 장면 상자 왼쪽 위에 놓는다 */
  testButton?: ReactNode;
  /**
   * 같은 접속에서 이 화면으로 오기 직전 단계(RoomScreen 의 usePhaseArrival). 역할 확인 → 낮 시작처럼 이 화면이 새로 마운트될 때
   * 첫 렌더를 '단계가 바뀐 렌더' 로 처리하게 한다 — 낮 시작 문구가 뜨고 배경이 직전 장면에서 크로스페이드한다. 재접속·처음 마운트는 null/없음.
   */
  arrivedFrom?: PhaseId | null | undefined;
}

// 낮 시작(dayAnnounce)·낮 두 단계(claim·discussion)와 밤·아침이 공유하는 장면. 순차 주장(결정 0023)·S-07.
// 낮 시작 전용 화면은 없다(결정 0030): 서버 단계 dayAnnounce 도 이 장면(테이블·헤더·패널 위치가 claim 과 같다)이고, 'N일차 / 낮이 되었습니다' 는 SceneIntro 가 그 위에 얹힌다.
// 해·달은 배경 이미지에 그려져 있어 따로 그리거나 움직이지 않는다 — 장면이 바뀌면 Backdrop 이 0.8초 크로스페이드할 뿐이라 이중 표시가 없다.
// 단계는 DayTable 하나를 공유한다(결정 0017-1). 머리 위는 이모티콘만(0017-2). 이름표 아랫줄(완료·주장·탈락)은 주장 단계에 없다(0023-3).
// 테이블은 키가 없는 장면 상자 안에 있어 단계 사이에 다시 마운트되지 않는다(깜빡임·인물 재등장 없음, Pitfall 7·11).
// 위쪽 바와 하단 패널만 단계가 든 key(bar-·panel- 접두어로 서로 겹치지 않게)라 단계마다 새 요소가 되어 한 번 페이드된다.
// claim 하단: 서버가 정한 지금 차례(view.day.turn.seat)가 나면 직업 칩(ClaimPanel), 남이면 "…님이 주장하는 중 · N초"(TurnPanel).
// 낮 토론은 MessageLog·DiscussionControls. 화면은 스스로 단계나 차례를 넘기지 않는다(서버 view 만 따름). 역할 문자열을 화면에 쓰지 않는다.
export function DayScene({ view, connection, myRoleButton, testButton, arrivedFrom }: DaySceneProps) {
  const n = view.day?.n ?? 1;
  // 낮 토론의 보낸 사람 말풍선·이모티콘(자리별 한 번에 하나). 단계가 discussion 이 아니면 훅이 비운다.
  const floats = useSeatFloats(view, connection.onEvent);
  // 채팅 줄은 이 폰이 그날 받은 chat 이벤트에서만 만든다(서버 뷰에 메시지가 없다, 결정 0017-7)
  const chatLines = useDayChat(view, connection.onEvent);
  const { toast, show: showToast } = useToast();
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
  // 단계 시작 문구(결정 0028 → 0030): 같은 접속(epoch 불변)에서 문구가 있는 단계(PHASE_INTRO: 밤·낮 시작)로 넘어가는 렌더에서만 켠다.
  // 처음 마운트(prevPhase 초기값이 현재 단계)·재접속(epoch 변화)·같은 단계 안의 다시 그리기·그 단계를 벗어난 뒤에는 켜지 않고, 단계나 epoch 가 바뀌면 끈다.
  // 역할 확인 → 낮 시작처럼 이 화면이 새로 마운트되는 경우는 arrivedFrom 이 prevPhase 의 초기값이라 첫 렌더가 단계 변화로 처리된다.
  const [prevPhase, setPrevPhase] = useState<PhaseId>(arrivedFrom ?? view.phase);
  const [prevEpoch, setPrevEpoch] = useState(connection.epoch);
  const [introN, setIntroN] = useState<number | null>(null);
  // 배경: 마운트 때 한 번 정한 '처음에 보이던 장면'(직전 단계의 장면)과, 재접속으로 단계가 건너뛴 렌더의 전환 없음(instant).
  // instant 는 Backdrop 이 렌더 중 한 번만 읽으므로 상태에 둔다(epoch 조정 렌더가 지나가면 epochChanged 는 곧 거짓이 된다).
  const [fromScene] = useState<SceneId | undefined>(() => (arrivedFrom ? sceneOfPhase(arrivedFrom) : undefined));
  const [instant, setInstant] = useState(false);
  const [sawNightToMorning, setSawNightToMorning] = useState(false);
  const epochChanged = prevEpoch !== connection.epoch;
  if (epochChanged) {
    setPrevEpoch(connection.epoch);
    setIntroN(null);
  }
  if (prevPhase !== view.phase) {
    setPrevPhase(view.phase);
    setLastEmoji(null);
    setSawNightToMorning(prevPhase === "night" && view.phase === "morning");
    setIntroN(PHASE_INTRO[view.phase] !== undefined && !epochChanged ? n : null);
    setInstant(epochChanged);
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
  // 동료 표시 규칙 한 곳: 살아 있는 마피아의 me.allies, 관전 화면은 모든 마피아(job 이 mafia 인 다른 자리). 마름모는 이 값으로 그린다.
  const isAllySeat = (seat: number): boolean => allies.includes(seat) || (spectate !== undefined && seat !== view.me.seat && jobOf(seat) === "mafia");
  // 투표 구간(execVote~)이면 제목·안내·타이머 톤·하단·좌석 덧입힘을 이 값이 정한다. 아니면 null 이라 낮·밤·아침 경로는 그대로다(verdictScene.tsx).
  const verdict = useVerdictScene({ view, connection, meAlive, showToast, onInspect: setInspectSeat, isAllySeat });
  const title = verdict ? verdict.title : isNight ? "밤" : isMorning ? "아침" : view.phase === "discussion" ? "낮 · 토론" : view.phase === "claim" ? "낮 · 직업 공개" : "낮";
  // 동료가 고른 대상(마피아 화면만, D-07). 서버가 생존 마피아에게만 보낸 값이다.
  const allyPicks = view.me.allyPicks ?? [];
  const nicknameOf = (seat: number): string | undefined => view.players.find((p) => p.seat === seat)?.nickname;
  // 차례 강조(D-03): 서버 view 의 지금 차례 한 자리에만 흰 후광·머리 위 말풍선. 차례가 넘어가면 다음 자리로 옮겨 간다.
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
        // 관전 화면은 모든 마피아에 진홍 후광·마름모를 그린다(job 이 mafia 인 다른 자리)
        isAlly: isAllySeat(p.seat),
        dead: !isAlive(p),
        ...(spectatorPicksOf(p.seat).length > 0 ? { spectatorPicks: spectatorPicksOf(p.seat) } : {}),
        spoke: floats.spoke[p.seat] !== undefined,
        // roleArt 는 meDead && spectate 한 곳(spectate 상수)에서만 만든다 — 살아 있는 사람 화면에는 이 입력과 코드 경로가 없다(결정 0021·0002).
        // 살아 있는 다른 자리만 직업 캐릭터로 그리고, 탈락한 자리와 내 자리는 DayTable 이 유령으로 그린다.
        ...(spectate !== undefined && p.seat !== view.me.seat && isAlive(p) && jobOf(p.seat) !== undefined ? { roleArt: jobOf(p.seat)! } : {}),
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
        // 투표 구간은 verdict 의 덧입힘이 정한다(모든 자리 기록 카드 버튼, 투표는 영향받지 않는다).
        ...(verdict ? verdict.seatPatch(p.seat) : inspectable ? { onInspect: () => setInspectSeat(p.seat) } : {}),
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
  // 아침 5초·낮 시작 2초도 전체가 마지막 5초라 진홍을 쓰지 않는다(calm, UI-SPEC 확인 필요 10).
  const timer =
    endsAt !== null && durationMs !== null ? (
      <Timer endsAt={endsAt} durationMs={durationMs} offset={connection.offset} calm={verdict !== null ? verdict.calm : isMorning || view.phase === "claim" || view.phase === "dayAnnounce"} />
    ) : null;

  return (
    <Backdrop
      layout="game"
      scene={sceneOfPhase(view.phase)}
      instant={instant}
      {...(fromScene !== undefined ? { fromScene } : {})}
      className="mf-dayscene__backdrop"
    >
      <main className="mf-root mf-dayscene">
        <div key={`bar-${view.phase}`} className="mf-dayscene__enter">
          <PhaseBar title={title} instruction={verdict ? verdict.instruction : mafiaNight ? `${n}일차 · 함께 지목하세요` : isMorning ? `${n + 1}일차` : `${n}일차`} extra={myRoleButton} timer={timer} />
        </div>
        <div className="mf-dayscene__scene">
          {testButton ? <div className="mf-tt-anchor">{testButton}</div> : null}
          <DayTable
            seats={seats}
            mySeat={view.me.seat}
            pickVerb={verdict?.pickVerb ?? pickVerb}
            pickDisabled={!connection.canSend}
            {...(spectate !== undefined ? { allyMarkLabel: "마피아" } : {})}
            {...(isMorning ? { dim: { exitDelayMs: morningExit.delay } } : {})}
          />
        </div>
        {isMorning ? <MorningCard {...morningCardText(view.day?.morning, nicknameOf)} exitDelayMs={morningExit.delay} /> : null}
        <section key={`panel-${view.phase}`} className="mf-dayscene__panel mf-dayscene__enter">
          {verdict ? (
            verdict.bottom
          ) : isMorning ? (
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
        {verdict?.liveLine !== undefined ? (
          <p className="mf-sr-only mf-dayscene__verdict-live" aria-live="polite">
            {verdict.liveLine}
          </p>
        ) : null}
        <Toast toast={toast} placement="top" />
        {introN !== null && PHASE_INTRO[view.phase] ? <SceneIntro n={introN} intro={PHASE_INTRO[view.phase]!} onDone={() => setIntroN(null)} /> : null}
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
