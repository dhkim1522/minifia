import type { RefObject } from "react";
import { isAlive } from "../../shared/game/alive";
import { majorityOf } from "../../shared/game/nomination";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import { ActionRow } from "../components/ActionButton";
import { ChatPanel } from "../components/v2/ChatPanel";
import { DotProgress } from "../components/v2/DotProgress";
import { V2Icon } from "../components/v2/V2Icon";
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
  inputRef?: RefObject<HTMLInputElement | null>;
  panelRef?: RefObject<HTMLElement | null>;
}

/**
 * 게임 맵 화면의 아래 패널(UI-SPEC "아래 패널 종류와 높이"). 단계마다 행동 줄이 다르다.
 * 이 계획(08-13)은 낮 토론의 [토론 끝내기] 한 칸만 정한다 — 지목·변론·찬반·처형·유령은 뒤 계획이 이 틀 위에 얹는다.
 * 눌림은 서버 view(me.endDiscussion)가 기준이고, 내가 누른 즉시 바뀌는 것은 눌림 표시 하나뿐이다. 점 개수는 서버가 센 값만 그린다(누가 눌렀는지는 서버가 보내지 않는다).
 */
export function GamePanel({ view, send, canSend, binding, logHeight, kbOpen = false, inputRef, panelRef }: GamePanelProps) {
  const [pressed, choose] = useViewChoice<boolean>(view, view.me.endDiscussion === true);

  const me = view.players.find((p) => p.seat === view.me.seat);
  const meAlive = me === undefined || isAlive(me);
  const showEnd = view.phase === "discussion" && meAlive && !kbOpen;
  const total = majorityOf(view.players.filter(isAlive).length);
  const count = view.day?.endCount ?? 0;

  const pressEnd = (): void => {
    if (!canSend) return;
    const on = pressed !== true;
    if (send({ t: "endDiscussion", on }) === false) return;
    choose(on);
  };

  return (
    <section ref={panelRef} className={kbOpen ? "mf-game__panel mf-game__panel--kb" : "mf-game__panel"} data-world-panel="">
      <ChatPanel {...binding} logHeight={logHeight} compact={kbOpen} {...(inputRef ? { inputRef } : {})} />
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
