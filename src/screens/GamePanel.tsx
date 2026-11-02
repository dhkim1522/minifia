import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { isAlive } from "../../shared/game/alive";
import { majorityOf } from "../../shared/game/nomination";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { ActionRow } from "../components/ActionButton";
import { ChatPanel } from "../components/v2/ChatPanel";
import { NIGHT_PANEL_TEXT, NightPanel, NoticePill, PickPill } from "../components/NightPanel";
import { DotProgress } from "../components/v2/DotProgress";
import { V2Icon } from "../components/v2/V2Icon";
import { VerdictPicker } from "../components/v2/VerdictPicker";
import type { Verdict } from "../components/v2/VerdictPicker";
import type { ChatBinding } from "../net/useChat";
import { useViewChoice } from "../net/useViewChoice";

/** 채팅 부품에 그대로 펼치는 속성 묶음 — 머리 위 입력 중 좌석(typingSeats)은 화면 틀이 WorldStage 로 따로 넘긴다 */
export type ChatPanelBinding = Omit<ChatBinding, "typingSeats">;

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
  /** 서버가 행동을 거절한 횟수. 늘어나면 내 낙관적 눌림을 서버 값으로 되돌린다(새 view 가 오지 않아도) */
  rejected?: number;
  /** 밤(임시 틀)에 내가 지금 보는 선택 좌석(서버 view.me.pick, 누른 즉시는 낙관적 값). 경찰·의사의 선택 알약이 그린다 */
  nightPick?: number | undefined;
  inputRef?: RefObject<HTMLInputElement | null>;
  panelRef?: RefObject<HTMLElement | null>;
}

/**
 * 게임 맵 화면의 아래 패널(UI-SPEC "아래 패널 종류와 높이"). 단계마다 행동 줄이 다르다.
 * 낮 토론은 [토론 끝내기], 찬반은 위쪽 찬반 줄(VerdictPicker + DotProgress, 08-16)을 얹는다 — 변론·처형·유령은 채팅만이거나 뒤 계획이 이 틀 위에 얹는다.
 * 눌림은 서버 view(me.endDiscussion·me.verdictVote)가 기준이고, 내가 누른 즉시 바뀌는 것은 내 눌림 표시 하나뿐이다. 점 개수는 서버가 센 값만 그린다(누가 눌렀는지·무엇을 골랐는지는 서버가 보내지 않는다).
 */
export function GamePanel({ view, send, canSend, binding, logHeight, kbOpen = false, rejected = 0, nightPick, inputRef, panelRef }: GamePanelProps) {
  const serverPressed = view.me.endDiscussion === true;
  const [pressed, choose] = useViewChoice<boolean>(view, serverPressed);
  // 거절이 오면 서버 값으로 되돌린다. 처음 그릴 때(거절 0)는 아무것도 하지 않는다.
  // 찬반도 같다: 내 선택은 누른 즉시 보이되 서버 view(me.verdictVote)가 오면 서버 값이 이긴다(DAY-06).
  const serverVerdict: Verdict | null = view.me.verdictVote === undefined ? null : view.me.verdictVote ? "yes" : "no";
  const [verdict, chooseVerdict] = useViewChoice<Verdict | null>(view, serverVerdict);
  // 서버는 처형 단계에 내 찬반 값을 보내지 않는다 — 처형 단계의 비활성 찬반 줄은 찬반 때 마지막으로 보인 내 선택을 그대로 보여 준다
  const lastVerdict = useRef<Verdict | null>(null);
  useEffect(() => {
    if (view.phase === "verdict") lastVerdict.current = verdict ?? null;
  }, [view.phase, verdict]);
  const seenRejects = useRef(rejected);
  useEffect(() => {
    if (seenRejects.current === rejected) return;
    seenRejects.current = rejected;
    choose(serverPressed);
    chooseVerdict(serverVerdict);
    // choose 는 렌더마다 새 함수지만 setState 만 부른다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejected]);

  const me = view.players.find((p) => p.seat === view.me.seat);
  const meAlive = me === undefined || isAlive(me);
  const showEnd = view.phase === "discussion" && meAlive && !kbOpen;
  const total = majorityOf(view.players.filter(isAlive).length);
  const count = view.day?.endCount ?? 0;

  // 찬반 줄: 변론자가 아닌 산 사람만 던진다(변론자 본인·유령은 8페이즈 결정 0053 대로 줄 없음)
  const aliveCount = view.players.filter(isAlive).length;
  const isDefender = view.day?.candidate !== undefined && view.day.candidate === view.me.seat;
  const inVerdict = view.phase === "verdict" && !kbOpen;
  const showVerdict = inVerdict && meAlive && !isDefender; // 찬반 버튼 + 점
  const showVerdictDots = inVerdict && !showVerdict; // 변론자 본인·유령: 점만(보기 패널)
  const showExecPicker = view.phase === "execution" && meAlive && !isDefender && !kbOpen; // 처형 단계: 결과가 나와 비활성(불투명도 0.45)
  const voted = view.day?.voted?.length ?? 0;
  const pressVerdict = (v: Verdict): void => {
    if (!canSend) return;
    if (send({ t: "verdict", agree: v === "yes" }) === false) return;
    chooseVerdict(v);
  };

  // 밤(임시 틀, A1·UI-SPEC 아래 패널 종류): 산 마피아 = 마피아 채널 채팅, 산 경찰·의사·시민 = v1.0 NightPanel 알약(채팅 없음), 유령 = 유령 채널 채팅.
  // 채팅 패널은 서버가 보낸 view.me.chat 이 그 채널일 때만 그린다(서버 값이 기준, T-08-47). 알약 문구는 NIGHT_PANEL_TEXT 한 곳에서만 가져온다.
  const night = view.phase === "night";
  const myRole = view.me.role;
  const nightPill = night && meAlive && myRole !== "mafia" ? (myRole === "police" || myRole === "doctor" ? myRole : "citizen") : null;
  const chatChannelOk = !night || view.me.chat === (meAlive ? "mafia" : "ghost");
  const nicknameOf = (seat: number): string | undefined => view.players.find((p) => p.seat === seat)?.nickname;
  const pickLabel = nightPick === undefined ? undefined : nightPick === view.me.seat ? "나" : nicknameOf(nightPick);
  const pillPick = nightPick !== undefined && pickLabel !== undefined ? { seat: nightPick, label: pickLabel } : null;

  const pressEnd = (): void => {
    if (!canSend) return;
    const on = pressed !== true;
    if (send({ t: "endDiscussion", on }) === false) return;
    choose(on);
  };

  return (
    <section ref={panelRef} className={kbOpen ? "mf-game__panel mf-game__panel--kb" : "mf-game__panel"} data-world-panel="">
      {showExecPicker ? (
        <div className="mf-game__verdict" data-verdict-row="">
          <VerdictPicker {...(lastVerdict.current ? { value: lastVerdict.current } : {})} onChange={() => {}} disabled />
        </div>
      ) : null}
      {showVerdict || showVerdictDots ? (
        <div className="mf-game__verdict" data-verdict-row="">
          {showVerdict ? (
            <VerdictPicker {...(verdict ? { value: verdict } : {})} onChange={pressVerdict} {...(canSend ? {} : { disabled: true })} />
          ) : null}
          <DotProgress count={voted} total={Math.max(0, aliveCount - 1)} label="투표한 사람" />
        </div>
      ) : null}
      {nightPill !== null ? (
        <NightPanel title={NIGHT_PANEL_TEXT[nightPill].title} guide={NIGHT_PANEL_TEXT[nightPill].guide}>
          {nightPill === "citizen" ? <NoticePill text={NIGHT_PANEL_TEXT.citizen.pill} /> : <PickPill pick={pillPick} />}
        </NightPanel>
      ) : chatChannelOk ? (
        <ChatPanel {...binding} logHeight={logHeight} compact={kbOpen} {...(inputRef ? { inputRef } : {})} />
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
            <DotProgress count={count} total={total} label={`${count}/${total}`} />
          </button>
        </ActionRow>
      ) : null}
    </section>
  );
}
