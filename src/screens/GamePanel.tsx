import { useEffect, useId, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { isAlive } from "../../shared/game/alive";
import { MAP_PHASES } from "../../shared/game/movement";
import { majorityOf } from "../../shared/game/nomination";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { ActionRow } from "../components/ActionButton";
import { ChatPanel } from "../components/v2/ChatPanel";
import { HeadCount } from "../components/v2/HeadCount";
import { FaceList } from "../components/v2/FaceList";
import { V2Icon } from "../components/v2/V2Icon";
import { VerdictPicker } from "../components/v2/VerdictPicker";
import type { Verdict } from "../components/v2/VerdictPicker";
import { faceSrc, seatColorVar } from "../net/assets";
import type { ChatBinding } from "../net/useChat";
import { useViewChoice } from "../net/useViewChoice";

/** 채팅 부품에 그대로 펼치는 속성 묶음 — 머리 위 입력 중 좌석(typingSeats)은 화면 틀이 WorldStage 로 따로 넘긴다 */
export type ChatPanelBinding = Omit<ChatBinding, "typingSeats" | "liveWhisperIn">;

export interface GamePanelProps {
  view: RoomView;
  /** 보냈으면 true, 소켓이 닫혀 못 보냈으면 false. 반환값이 없는 함수(void)는 보낸 것으로 본다 */
  send: (msg: ClientMessage) => boolean | void;
  /** 연결이 열려 있어 서버로 보낼 수 있는가 */
  canSend: boolean;
  binding: ChatPanelBinding;
  /** 기록 칸 높이(키보드가 열려 있으면 부르는 쪽이 72 를 준다) */
  logHeight: number;
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
  /** 입력줄 맨 오른쪽 끝 슬롯(ChatPanel trailing)에 놓을 요소 — 낮 토론의 [의심] 단추(24-03). 없으면 슬롯도 없다 */
  chatTrailing?: ReactNode;
}

/**
 * 게임 맵 화면의 아래 패널(UI-SPEC "아래 패널 종류와 높이"). 단계마다 행동 줄이 다르다.
 * 낮 토론은 [토론 끝내기], 찬반은 위쪽 찬반 줄(VerdictPicker + 찬성·반대 숫자 줄, 22-10)을 얹는다 — 변론·처형·유령은 채팅만이다(처형은 찬반 줄을 접는다, 18.1-13 결정 0083-9).
 * 눌림은 서버 view(me.endDiscussion·me.verdictVote)가 기준이고, 내가 누른 즉시 바뀌는 것은 내 눌림 표시 하나뿐이다. 숫자는 서버가 센 값만 그린다(누가 눌렀는지·무엇을 골랐는지는 서버가 보내지 않는다).
 */
export function GamePanel({ view, send, canSend, binding, logHeight, kbOpen = false, lifted, veiled = false, rejected = 0, onNightPickSent, onOpenWill, willOpen = false, onOpenNote, noteOpen = false, noteReady = false, willSaved = false, call, onCallUsed, inputRef, panelRef, chatTrailing }: GamePanelProps) {
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
  const showEnd = view.phase === "discussion" && meAlive && !kbOpen;
  const total = majorityOf(view.players.filter(isAlive).length);
  const count = view.day?.endCount ?? 0;

  // 찬반 줄(22-10, D-11·D-26): 처형 후보가 없어 산 사람 전원이 던진다. 유령은 같은 숫자 줄만 본다(보기 패널).
  // 숫자는 서버가 모두에게 같게 보낸 집계(day.verdictCount)뿐이다 — 누가 던졌는지는 어디에도 없다.
  const inVerdict = view.phase === "verdict" && !kbOpen;
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
  const nightFaces = night && meAlive;
  const chatChannelOk = !night || view.me.chat === "ghost";
  // 후보: 산 사람 전원(나 포함). 좌석 오름차순. 후보가 없으면 목록을 그리지 않는다(E1 #1).
  const faces = !nightFaces ? [] : view.players
    .filter((p) => isAlive(p))
    .sort((a, b) => a.seat - b.seat)
    .map((p) => ({ seat: p.seat, name: p.nickname, img: faceSrc(p.seat), color: seatColorVar(p.seat) }));
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
  // 유언 단계(defense, 22-11 D-16·P22-9): 산 사람·유령 모두 입력줄이 잠기고, 깃펜은 처형자에게만 있다(접은 시트를 다시 여는 [유언] 단추, P22-17). 처형자는 공개 값 day.candidate 로 안다.
  // 정답 공개(answerReveal, 23-07 P23-21): 3초 동안 큰 글을 보는 단계라 유언 단계와 같은 잠긴 입력줄을 쓴다(패널 높이 그대로) — 서버도 채팅을 받지 않는다(CHAT_PHASES 미가입).
  // 깃펜은 그리지 않는다: 서버 MAP_PHASES 에는 answerReveal 이 있어 유언 저장을 받지만 화면은 이 3초에 쓰는 길을 열지 않는다(처형자 조건은 유언 단계에만).
  const defense = view.phase === "defense";
  const answerReveal = view.phase === "answerReveal";
  const chatLocked = defense || answerReveal;
  const condemned = defense && meAlive && view.day?.candidate === view.me.seat;
  const penOn = meAlive && MAP_PHASES.has(view.phase) && onOpenWill !== undefined && !answerReveal && (!defense || condemned);
  const showNoteRow = nightFaces && myRole === "mafia" && onOpenNote !== undefined;
  const noteHintId = useId();
  const showWillRow = nightFaces && myRole !== "mafia" && onOpenWill !== undefined;

  const pressEnd = (): void => {
    if (!canSend) return;
    const on = pressed !== true;
    if (send({ t: "endDiscussion", on }) === false) return;
    choose(on);
  };

  return (
    <section
      ref={panelRef}
      className={lifted ?? kbOpen ? "mf-game__panel mf-game__panel--kb" : "mf-game__panel"}
      data-world-panel=""
      {...(veiled ? { "data-will-hide-panel": "true" } : {})}
    >
      {showVerdictCount ? (
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
      ) : null}
      {nightFaces ? (
        faces.length > 0 ? (
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
        ) : null
      ) : chatChannelOk ? (
        <ChatPanel
          {...binding}
          logHeight={logHeight}
          compact={kbOpen}
          {...(chatLocked ? { locked: true } : {})}
          {...(inputRef ? { inputRef } : {})}
          onInputFocus={() => onCallUsed?.()}
          {...(binding.onSend && !chatLocked
            ? {
                onSend: (text: string) => {
                  binding.onSend?.(text);
                  onCallUsed?.();
                },
              }
            : {})}
          {...(call?.chat ? { callInput: true } : {})}
          {...(chatTrailing ? { trailing: chatTrailing } : {})}
          {...(penOn
            ? {
                onWill: () => {
                  if (canSend) onOpenWill?.(panelRef?.current?.querySelector<HTMLElement>("[data-will-button]") ?? null);
                  onCallUsed?.();
                },
                willOpen,
                willSaved,
                ...(call?.will ? { callWill: true } : {}),
              }
            : {})}
        />
      ) : null}
      {showNoteRow ? (
        <ActionRow>
          <button
            type="button"
            className="mf-act mf-game__note"
            aria-pressed={noteOpen}
            aria-disabled={noteReady && canSend ? undefined : "true"}
            {...(noteReady ? {} : { "aria-describedby": noteHintId })}
            data-note-button=""
            onClick={(e) => {
              if (!noteReady || !canSend) return;
              onOpenNote?.(e.currentTarget);
            }}
          >
            <span className="mf-game__note-icon" aria-hidden="true">
              <V2Icon name="note" size={22} />
            </span>
            <span className="mf-act__label">쪽지</span>
          </button>
        </ActionRow>
      ) : null}
      {showNoteRow && !noteReady ? (
        <span id={noteHintId} className="mf-sr-only">
          암살 대상을 모두 같게 고르면 쓸 수 있어요
        </span>
      ) : null}
      {showWillRow ? (
        <ActionRow>
          <button
            type="button"
            className="mf-act mf-game__will"
            aria-pressed={willOpen}
            aria-disabled={canSend ? undefined : "true"}
            // 저장 표시(0083-6): 유언은 저장하면 창이 닫히니 저장됨은 단추가 말한다 — 값은 서버가 본인에게만 보낸 me.will
            {...(willSaved ? { "data-will-saved": "", "aria-label": "유언, 저장됨" } : {})}
            data-will-button=""
            onClick={(e) => {
              if (!canSend) return;
              onOpenWill?.(e.currentTarget);
            }}
          >
            <span className="mf-game__will-icon">
              <V2Icon name="quill" size={22} />
              {willSaved ? <i className="mf-game__will-dot" aria-hidden="true" /> : null}
            </span>
            <span className="mf-act__label">유언</span>
          </button>
        </ActionRow>
      ) : null}
      {showEnd ? (
        <ActionRow>
          <button
            type="button"
            className="mf-act mf-game__end"
            aria-label="토론 끝내기"
            aria-pressed={pressed === true}
            aria-disabled={canSend ? undefined : "true"}
            data-end-discussion=""
            onClick={pressEnd}
          >
            <V2Icon name="skip" size={22} />
            <span className="mf-act__label">토론 끝내기</span>
            <HeadCount count={count} total={total} label={`${count}/${total}`} />
          </button>
        </ActionRow>
      ) : null}
    </section>
  );
}
