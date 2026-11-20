import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { isAlive } from "../../shared/game/alive";
import { MAP_PHASES } from "../../shared/game/movement";
import { majorityOf } from "../../shared/game/nomination";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { Button } from "../components/Button";
import { PhaseEvent } from "../components/PhaseEvent";
import { RoomChatDock } from "../components/v2/RoomChatDock";
import type { RoomChatBinding, RoomChatDockProps } from "../components/v2/RoomChatDock";
import { FaceList } from "../components/v2/FaceList";
import { V2Icon } from "../components/v2/V2Icon";
import { VerdictPicker } from "../components/v2/VerdictPicker";
import type { Verdict } from "../components/v2/VerdictPicker";
import { hostLineOf } from "../game/hostLine";
import { faceSrc } from "../net/assets";
import { playerColor } from "../game/playerIdentity";
import { useViewChoice } from "../net/useViewChoice";
import "../styles/event-choices.css";

export interface GamePanelProps {
  view: RoomView;
  introActive?: boolean;
  offset?: number;
  /** 보냈으면 true, 소켓이 닫혀 못 보냈으면 false. 반환값이 없는 함수(void)는 보낸 것으로 본다 */
  send: (msg: ClientMessage) => boolean | void;
  /** 연결이 열려 있어 서버로 보낼 수 있는가 */
  canSend: boolean;
  binding: RoomChatBinding;
  /** 키보드가 열려 있는가 — 열려 있으면 행동 줄을 그리지 않고 패널이 키보드 위로 올라간다(7페이즈 규칙) */
  kbOpen?: boolean;
  /** 키보드가 열려 있으면(시트 textarea 초점 포함) 패널이 키보드 위로 올라간다. 주지 않으면 kbOpen 을 따른다 */
  lifted?: boolean;
  /** 유언·쪽지 시트가 키보드 위 자리를 차지해 패널을 가린다(패널 + 시트가 보이는 높이를 넘을 때, UI-SPEC 282행) */
  veiled?: boolean;
  /** 서버가 행동을 거절한 횟수. 늘어나면 내 낙관적 눌림을 서버 값으로 되돌린다(새 view 가 오지 않아도) */
  rejected?: number;
  /** 경찰·의사가 얼굴을 눌러 pick 을 보낸 직후에 부른다. 화면 틀이 "보낸 선택" 을 기억해 거절 응답을 그 선택의 거절로 읽는다 */
  onNightPickSent?: (target: number) => void;
  /** [유언] 버튼(밤 시민·경찰·의사의 행동 줄)이 시트를 연다. opener 는 닫을 때 초점이 돌아갈 버튼 */
  onOpenWill?: (opener: HTMLElement | null) => void;
  /** 유언 시트가 열려 있는가 — [유언] 버튼의 눌림 */
  willOpen?: boolean;
  /** 밤 마피아의 [쪽지] 버튼이 쪽지 시트를 연다 */
  onOpenNote?: (opener: HTMLElement | null) => void;
  /** 쪽지 시트가 열려 있는가 */
  noteOpen?: boolean;
  /** 쪽지를 쓸 수 있는가(서버가 확정을 알렸다, me.nightSure) */
  noteReady?: boolean;
  /** 저장된 유언이 있는가 — 깃펜 점(본인에게만) */
  willSaved?: boolean;
  /** 빛남(14-04): 지금 빛나야 할 도구. 부르는 쪽(GameMap)이 callTargetsOf 로 정하고 시트·키보드·이미 씀을 거른 결과만 준다. 없으면 빛 없음 */
  call?: { chat?: boolean; will?: boolean; verdict?: boolean; faces?: ReadonlySet<number> };
  /** 빛나는 도구를 썼다(입력칸 포커스·첫 글·[유언] 엶·찬반 고름·얼굴 고름). 기존 동작 뒤에 부르고 동작을 막지 않는다 */
  onCallUsed?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  panelRef?: RefObject<HTMLElement | null>;
  suspect?: RoomChatDockProps["suspect"];
  notice?: ReactNode;
  tableControls?: ReactNode;
  answerPresentation?: ReactNode;
  /** 전날 결과가 잠깐 보이는 동안에는 밤 선택을 같은 자리에 겹쳐 놓지 않는다. */
  pauseNightEvent?: boolean;
}

/**
 * 단계별 선택은 중앙에 보여 주고 채팅과 상시 도구는 화면 아래에 둔다.
 * 눌림은 서버 view(me.endDiscussion·me.verdictVote)가 기준이고, 내가 누른 즉시 바뀌는 것은 내 눌림 표시 하나뿐이다. 숫자는 서버가 센 값만 그린다(누가 눌렀는지·무엇을 골랐는지는 서버가 보내지 않는다).
 */
export function GamePanel({ view, introActive = false, offset = 0, send, canSend, binding, kbOpen = false, lifted, veiled = false, rejected = 0, onNightPickSent, onOpenWill, willOpen = false, onOpenNote, noteOpen = false, noteReady = false, willSaved = false, call, onCallUsed, inputRef, panelRef, suspect, notice, tableControls, answerPresentation, pauseNightEvent = false }: GamePanelProps) {
  const playtest = view.playtest === true;
  const presenting = answerPresentation !== undefined;
  const voteOpensAt = playtest && view.phase === "discussion" ? view.day?.voteOpensAt : undefined;
  const [openedVoteAt, setOpenedVoteAt] = useState<number>();
  useEffect(() => {
    if (voteOpensAt === undefined) return;
    const delay = voteOpensAt - Date.now() - offset;
    if (delay <= 0) return;
    const id = setTimeout(() => setOpenedVoteAt(voteOpensAt), delay);
    return () => clearTimeout(id);
  }, [voteOpensAt, offset]);
  const serverPressed = view.me.endDiscussion === true;
  const [pressed, choose] = useViewChoice<boolean>(view, serverPressed);
  // 거절이 오면 서버 값으로 되돌린다. 처음 그릴 때(거절 0)는 아무것도 하지 않는다.
  // 찬반도 같다: 내 선택은 누른 즉시 보이되 서버 view(me.verdictVote)가 오면 서버 값이 이긴다(DAY-06).
  const serverVerdict: Verdict | null = view.me.verdictVote === undefined ? null : view.me.verdictVote ? "yes" : "no";
  const [verdict, chooseVerdict] = useViewChoice<Verdict | null>(view, serverVerdict);
  // 밤 경찰·의사의 선택(NIGHT-09): 내가 누른 얼굴은 즉시 눌린 모양이 되고 서버 view(me.pick)가 오면 서버 값이 이긴다.
  const [nightPick, chooseNightPick] = useViewChoice<number | undefined>(view, view.me.pick);
  const seenRejects = useRef(rejected);
  useEffect(() => {
    if (seenRejects.current === rejected) return;
    seenRejects.current = rejected;
    choose(serverPressed);
    chooseVerdict(serverVerdict);
    chooseNightPick(view.me.pick);
    // choose 는 렌더마다 새 함수지만 setState 만 부른다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejected]);

  const me = view.players.find((p) => p.seat === view.me.seat);
  const meAlive = me === undefined || isAlive(me);
  const voteUnlocked = voteOpensAt === undefined || openedVoteAt === voteOpensAt || Date.now() + offset >= voteOpensAt;
  const aliveCount = view.players.filter(isAlive).length;
  const total = voteUnlocked ? view.day?.voteReadyRequired ?? majorityOf(aliveCount) : view.day?.voteReadyTotal ?? aliveCount;
  const count = view.day?.endCount ?? 0;

  // 찬반 줄(22-10, D-11·D-26): 처형 후보가 없어 산 사람 전원이 던진다. 유령은 같은 숫자 줄만 본다(보기 패널).
  // 숫자는 서버가 모두에게 같게 보낸 집계(day.verdictCount)뿐이다 — 누가 던졌는지는 어디에도 없다.
  const firstBallot = playtest && view.phase === "verdict" ? view.day?.firstBallot : undefined;
  const verdictPhase = view.phase === "verdict";
  useLayoutEffect(() => {
    // 토론 중 쓰던 글은 그대로 저장하고, 투표가 열릴 때 키보드만 내려 선택지를 드러낸다.
    const field = inputRef?.current;
    if (verdictPhase && meAlive && field === document.activeElement) field?.blur();
  }, [verdictPhase, meAlive, inputRef]);
  const inVerdict = verdictPhase && firstBallot === undefined && !kbOpen && !introActive;
  const showVerdict = inVerdict && meAlive; // 찬반 버튼 + 숫자
  const showVerdictCount = inVerdict; // 산 사람·유령 모두 같은 숫자 줄
  const verdictYes = view.day?.verdictCount?.yes ?? 0;
  const verdictNo = view.day?.verdictCount?.no ?? 0;
  const pressVerdict = (v: Verdict): void => {
    if (!canSend) return;
    if (send({ t: "verdict", agree: v === "yes" }) === false) return;
    chooseVerdict(v);
    onCallUsed?.();
  };

  // 밤(UI-SPEC "밤 고르기 계약", D-05): 산 사람은 역할과 무관하게 같은 얼굴 목록(나 포함 산 사람 전원)으로 고른다 — 유령은 유령 채널 채팅.
  // 채팅 패널은 서버가 보낸 view.me.chat 이 그 채널일 때만 그린다(서버 값이 기준, T-08-47). 산 마피아의 밤 채팅은 그리지 않는다.
  const night = view.phase === "night";
  const myRole = view.me.role;
  const citizenNight = playtest && night && meAlive && myRole === "citizen";
  const nightDone = view.me.nightDone === true;
  const nightFaces = night && meAlive && (!playtest || myRole === "mafia" || myRole === "police" || myRole === "doctor");
  const chatChannelOk = !night || view.me.chat === "ghost";
  // 후보: 산 사람 전원(나 포함). 좌석 오름차순. 후보가 없으면 목록을 그리지 않는다(E1 #1).
  const faces = !nightFaces ? [] : view.players
    .filter((p) => isAlive(p) && (!playtest || (myRole !== "police" && myRole !== "mafia") || p.seat !== view.me.seat && !view.me.allies?.includes(p.seat)))
    .sort((a, b) => a.seat - b.seat)
    .map((p) => ({ seat: p.seat, name: p.nickname, img: faceSrc(p.seat, p.animal), color: playerColor(p.seat, p.animal) }));
  // 마피아의 합의 수단(결정 0074): 서버가 산 마피아 본인에게만 보낸 집계를 칸 안 작은 배지로 그린다. 다른 역할 view 에는 값이 없고 읽지도 않는다.
  const tally = new Map<number, number>();
  if (nightFaces && myRole === "mafia") for (const t of view.me.nightTally ?? []) if (t.n >= 1) tally.set(t.seat, t.n);
  const pickFace = (seat: number): void => {
    if (!canSend) return;
    if (send({ t: "pick", target: seat }) === false) return; // 소켓이 닫혀 못 보냈으면 눌림도 바꾸지 않는다
    onNightPickSent?.(seat);
    chooseNightPick(seat);
    onCallUsed?.();
  };

  // 밤 산 사람은 입력줄이 없어 아래 행동 줄의 [쪽지]·[유언] 이 대신한다(UI-SPEC 237행). 마피아 [쪽지], 그 밖 [유언] — 역할을 읽는 곳은 이 줄뿐이다.
  // 채팅 입력줄이 있는 화면(낮·아침)은 깃펜, 산 사람 + 지도 단계에만(유령·로비·역할 확인에는 없다, UI-SPEC 281·286행)
  // 유언 단계에는 입력줄이 잠기고 마지막 유언을 중앙에서 쓴다.
  // 정답 공개(answerReveal, 23-07 P23-21): 3초 동안 큰 글을 보는 단계라 유언 단계와 같은 잠긴 입력줄을 쓴다(패널 높이 그대로) — 서버도 채팅을 받지 않는다(CHAT_PHASES 미가입).
  // 깃펜은 그리지 않는다: 서버 MAP_PHASES 에는 answerReveal 이 있어 유언 저장을 받지만 화면은 이 3초에 쓰는 길을 열지 않는다(처형자 조건은 유언 단계에만).
  const defense = view.phase === "defense";
  const answerReveal = view.phase === "answerReveal";
  const chatLocked = defense || answerReveal;
  const discussion = view.phase === "discussion";
  const penOn = !playtest && meAlive && MAP_PHASES.has(view.phase) && onOpenWill !== undefined && !chatLocked;
  const showNoteRow = !playtest && nightFaces && myRole === "mafia" && onOpenNote !== undefined;
  const noteHintId = useId();
  const showWillRow = !playtest && nightFaces && myRole !== "mafia" && onOpenWill !== undefined;
  const playtestChat = discussion || (!chatLocked && view.me.chat === "ghost");
  const showChat = !presenting && chatChannelOk && (!playtest || playtestChat);
  const canReact = !chatLocked && (!playtest || discussion);
  const showRoleTool = !presenting && (showNoteRow || showWillRow || penOn);
  const panelEmpty = !presenting && !showChat && !showRoleTool && !notice && !tableControls;

  const pressEnd = (): void => {
    if (!canSend) return;
    const on = pressed !== true;
    if (send({ t: "endDiscussion", on }) === false) return;
    choose(on);
  };
  const sendChat = (text: string): void => {
    binding.onSend?.(text);
    onCallUsed?.();
  };
  const openWillFrom = (opener: HTMLElement | null): void => {
    if (canSend) onOpenWill?.(opener);
    onCallUsed?.();
  };

  return (
    <>
      {showVerdictCount ? (
        <PhaseEvent kind="verdict" title="오늘 처형할까요?" interactive={showVerdict}>
          <div className="mf-game__verdict" data-verdict-row="">
            {showVerdict ? (
              <VerdictPicker {...(verdict ? { value: verdict } : {})} onChange={pressVerdict} {...(canSend ? {} : { disabled: true })} {...(call?.verdict ? { call: true } : {})} />
            ) : null}
            <div className="mf-game__vcount" role="status" aria-label={`찬성 ${verdictYes}표, 반대 ${verdictNo}표`} data-verdict-count-row="">
              <span className="mf-game__vcount-item" data-verdict-count="yes">
                <V2Icon name="thumbUp" size={20} />
                <span className="mv-count">{verdictYes}</span>
              </span>
              <span className="mf-game__vcount-item" data-verdict-count="no">
                <V2Icon name="thumbDown" size={20} />
                <span className="mv-count">{verdictNo}</span>
              </span>
            </div>
          </div>
        </PhaseEvent>
      ) : null}
      {!introActive && (firstBallot !== undefined ? (
        <PhaseEvent kind="first-ballot" title="첫날 지목" interactive={meAlive && firstBallot.result === undefined} className="mf-event-choice">
          <PlaytestBallot view={view} ballot={firstBallot} canVote={meAlive && canSend} send={send} />
        </PhaseEvent>
      ) : !pauseNightEvent && faces.length > 0 ? (
        <PhaseEvent kind="night-action" title={hostLineOf(view)} className="mf-event-choice">
          <FaceList
            faces={faces}
            {...(nightPick !== undefined ? { value: nightPick } : {})}
            onPick={pickFace}
            label="밤 대상"
            ariaLabel={(name) => `${name} 고르기`}
            {...(canSend ? {} : { disabled: true })}
            {...(call?.faces !== undefined ? { callSeats: call.faces } : {})}
            {...(tally.size > 0 ? { tally } : {})}
            {...(myRole === "mafia" && view.me.nightSure !== undefined ? { sure: view.me.nightSure } : {})}
          />
        </PhaseEvent>
      ) : !pauseNightEvent && citizenNight ? (
        <PhaseEvent kind="night-action" title="아침을 기다려요" interactive={!nightDone}>
          <Button block data-night-done="" disabled={!canSend || nightDone} onClick={() => send({ t: "nightDone" })} icon={<V2Icon name={nightDone ? "check" : "sunrise"} size={22} />}>
            {nightDone ? "준비 완료" : "아침 준비"}
          </Button>
        </PhaseEvent>
      ) : null)}
      <section
        ref={panelRef}
        inert={introActive}
        data-phase-panel-paused={introActive ? "" : undefined}
        className={`mf-game__panel${lifted ?? kbOpen ? " mf-game__panel--kb" : ""}${showChat ? " mf-game__panel--chat" : ""}${panelEmpty ? " mf-game__panel--empty" : ""}`}
        data-world-panel=""
        data-answer-panel={presenting ? "" : undefined}
        {...(veiled ? { "data-will-hide-panel": "true" } : {})}
      >
        {tableControls}
        {notice}
        {answerPresentation}
        {showChat ? (
          <RoomChatDock
            binding={{ ...binding, ...(binding.onSend && !chatLocked ? { onSend: sendChat } : {}), ...(!canReact ? { emotes: [] } : {}) }}
            kbOpen={kbOpen}
            quickReactions={playtest && discussion}
            discussion={discussion}
            locked={chatLocked}
            inputRef={inputRef}
            callInput={call?.chat}
            onInputFocus={onCallUsed}
            suspect={discussion ? suspect : undefined}
            skip={discussion && meAlive ? { enabled: canSend, pressed: pressed === true, count, total, request: pressEnd } : undefined}
            will={penOn ? { open: willOpen, saved: willSaved, call: call?.will === true, request: openWillFrom } : undefined}
          />
        ) : showRoleTool ? (
          <div className="mf-room-toolbar">
            {showNoteRow ? (
              <button
                type="button"
                className="mf-room-tool"
                aria-label="쪽지"
                aria-pressed={noteOpen}
                aria-disabled={noteReady && canSend ? undefined : "true"}
                aria-describedby={noteReady ? undefined : noteHintId}
                data-note-button=""
                onClick={(e) => {
                  if (noteReady && canSend) onOpenNote?.(e.currentTarget);
                }}
              >
                <V2Icon name="note" size={22} />
              </button>
            ) : (
              <button
                type="button"
                className={call?.will ? "mf-room-tool is-call" : "mf-room-tool"}
                aria-label={willSaved ? "유언, 저장됨" : "유언"}
                aria-pressed={willOpen}
                aria-disabled={!canSend || undefined}
                data-will-button=""
                data-call={call?.will ? "" : undefined}
                data-will-saved={willSaved ? "" : undefined}
                onClick={(event) => openWillFrom(event.currentTarget)}
              >
                <V2Icon name="quill" size={22} />
                {willSaved ? <i className="mv-chat__will-dot" aria-hidden="true" /> : null}
              </button>
            )}
          </div>
        ) : null}
        {showNoteRow && !noteReady ? (
          <span id={noteHintId} className="mf-sr-only">암살 대상을 모두 같게 고르면 쓸 수 있어요</span>
        ) : null}
      </section>
    </>
  );
}

function PlaytestBallot({ view, ballot, canVote, send }: {
  view: RoomView;
  ballot: NonNullable<NonNullable<RoomView["day"]>["firstBallot"]>;
  canVote: boolean;
  send: GamePanelProps["send"];
}) {
  const { result } = ballot;
  if (result !== undefined) {
    const name = view.players.find((player) => player.seat === result.target)?.nickname;
    const summary = result.target === null
      ? "오늘은 아무도 지목되지 않았어요"
      : name === undefined ? "한 사람이 지목됐어요" : `${name} 님이 지목됐어요`;
    return (
      <div className="mf-playtest__ballot-result" data-first-ballot-result="" role="status">
        <strong>{summary}</strong>
        {result.votes > 0 || result.holds > 0 ? <span>최다 득표 {result.votes}표 · 안 뽑기 {result.holds}표</span> : null}
      </div>
    );
  }
  const chosen = view.me.firstBallot;
  const alive = [...view.players].filter(isAlive).sort((a, b) => a.seat - b.seat);
  const faces = alive.filter((player) => player.seat !== view.me.seat).map((player) => ({
    seat: player.seat,
    name: player.nickname,
    img: faceSrc(player.seat, player.animal),
    color: playerColor(player.seat, player.animal),
  }));
  return (
    <div className="mf-playtest__ballot" data-first-ballot="">
      {canVote || alive.some((player) => player.seat === view.me.seat) ? (
        <>
          <FaceList faces={faces} label="지목할 사람" disabled={!canVote} {...(typeof chosen === "number" ? { value: chosen } : {})} onPick={(target) => send({ t: "firstBallot", target })} />
          <button type="button" className="mf-btn mf-btn--secondary" data-first-ballot-hold="" disabled={!canVote} aria-pressed={chosen === null} onClick={() => {
            if (chosen !== null) send({ t: "firstBallot", target: null });
          }}>오늘은 안 뽑기</button>
        </>
      ) : null}
      <p className="mf-playtest__ballot-count" role="status">
        {chosen !== undefined ? <><V2Icon name="check" size={18} /><span className="mf-sr-only">선택했어요 · </span></> : null}
        {ballot.count}/{alive.length}명 선택
      </p>
    </div>
  );
}
