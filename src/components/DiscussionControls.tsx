import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { SEND_COOLDOWN_MS } from "../../shared/game/chat";
import type { ClientMessage, EmojiId, RoomView } from "../../shared/protocol";
import type { RoomConnection } from "../net/useRoomConnection";
import { Button } from "./Button";
import { EmojiTraySheet } from "./EmojiTraySheet";
import { Icon } from "./Icon";
import { QuickMessageSheet } from "./QuickMessageSheet";
import type { SayPayload } from "./QuickMessageSheet";
import "../styles/day.css";

export interface DiscussionControlsProps {
  view: RoomView; // discussion 단계
  connection: RoomConnection;
  /** 낮 화면 토스트(DayScene 이 쥔다) */
  showToast: (text: string) => void;
}

// 낮 토론 하단 패널의 조작 줄(S-07). 시트 열림 상태는 이 부품이 쥔다 — 단계가 바뀌어 패널이 언마운트되면
// 열려 있던 시트도 같이 닫히고 고른 내용은 버려진다(D-19, 1페이즈 [내 역할] 시트와 반대 규칙, Pitfall 11).
// 보내는 것은 템플릿 ID·seat·직업뿐이다. 판정(쿨다운·방장·단계)은 서버가 하고 여기는 편의일 뿐이다.
//
// 쿨다운(D-14): 메시지·이모티콘 합산 2초. 기준은 보낸 순간의 로컬 시각 + SEND_COOLDOWN_MS 의 단순안이다.
// 서버도 2초라 네트워크 지터로 드물게 RATE_LIMITED 가 올 수 있고, 그때는 표시 없이 지금부터 2초 다시 잠근다.
// 해제는 setTimeout 하나이고 언마운트 때 정리한다.
const ERROR_TOAST = "보내지 못했어요. 다시 시도해 주세요";

export function DiscussionControls({ view, connection, showToast }: DiscussionControlsProps): ReactElement {
  const [sheet, setSheet] = useState<"quick" | "emoji" | null>(null);
  const [coolingDown, setCoolingDown] = useState(false);
  const coolTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 지금부터 SEND_COOLDOWN_MS 동안 잠근다. 이미 잠겨 있으면 해제 시각을 지금 기준으로 다시 잡는다.
  const lock = useCallback(() => {
    if (coolTimer.current !== undefined) clearTimeout(coolTimer.current);
    setCoolingDown(true);
    coolTimer.current = setTimeout(() => {
      coolTimer.current = undefined;
      setCoolingDown(false);
    }, SEND_COOLDOWN_MS);
  }, []);
  useEffect(
    () => () => {
      if (coolTimer.current !== undefined) clearTimeout(coolTimer.current);
    },
    [],
  );

  // 서버 오류 프레임: RATE_LIMITED 는 다시 잠그고, BAD_MESSAGE 만 토스트로 알린다.
  // WRONG_PHASE·NOT_HOST 등은 표시 없이 서버가 곧 보내는 state 를 따른다.
  const { onEvent } = connection;
  useEffect(
    () =>
      onEvent((e) => {
        if (e.t !== "error") return;
        if (e.code === "RATE_LIMITED") lock();
        else if (e.code === "BAD_MESSAGE") showToast(ERROR_TOAST);
      }),
    [onEvent, lock, showToast],
  );

  // 보냈으면(연결이 끊겨 버려지지 않았으면) 잠근다
  const sendAndLock = (msg: ClientMessage): void => {
    if (connection.send(msg) !== false) lock();
  };
  const sendSay = (payload: SayPayload): void => sendAndLock({ t: "say", ...payload });
  const sendEmoji = (icon: EmojiId): void => sendAndLock({ t: "emoji", icon });
  const blocked = !connection.canSend || coolingDown;

  return (
    <div className="mf-discuss">
      <div className="mf-discuss__talk">
        <Button
          variant="primary"
          className="mf-discuss__quick"
          icon={<Icon name="chat" />}
          disabled={blocked}
          onClick={() => setSheet("quick")}
        >
          빠른 메시지
        </Button>
        <Button
          variant="secondary"
          className="mf-discuss__emoji"
          aria-label="이모티콘"
          icon={<Icon name="smile" />}
          disabled={blocked}
          onClick={() => setSheet("emoji")}
        />
      </div>
      {sheet === "quick" ? (
        <QuickMessageSheet
          players={view.players}
          mySeat={view.me.seat}
          roles={view.day?.roles ?? []}
          canSend={connection.canSend}
          onSend={sendSay}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "emoji" ? (
        <EmojiTraySheet canSend={connection.canSend} coolingDown={coolingDown} onSend={sendEmoji} onClose={() => setSheet(null)} />
      ) : null}
    </div>
  );
}
