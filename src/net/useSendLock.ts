import { useCallback, useEffect, useRef, useState } from "react";
import { SEND_COOLDOWN_MS } from "../../shared/game/chat";
import type { ClientMessage } from "../../shared/protocol";
import type { RoomConnection } from "./useRoomConnection";

// 메시지·이모티콘 합산 쿨다운 잠금(D-14). DiscussionControls 와 TurnPanel 이 같은 규칙을 쓴다 —
// 합산 쿨다운은 서버 규칙이라 두 곳의 동작이 같아야 한다.
// 클라이언트 잠금은 보낸 순간 + SEND_COOLDOWN_MS(2초). 서버 한도는 1.8초라 정상 간격에서 RATE_LIMITED 가 오지 않는다(G-02-2).
// 그래도 오면 표시 없이 지금부터 다시 잠근다. 해제는 setTimeout 하나이고 언마운트 때 정리한다.
const ERROR_TOAST = "보내지 못했어요. 다시 시도해 주세요";

export interface SendLock {
  /** 보낸 뒤 쿨다운 중 */
  coolingDown: boolean;
  /** 지금 보낼 수 없음: 연결이 못 보내거나 쿨다운 중 */
  blocked: boolean;
  /** 보낸다. 보냈으면(연결이 끊겨 버려지지 않았으면) 잠그고 true, 버려졌으면 false */
  sendAndLock: (msg: ClientMessage) => boolean;
}

export function useSendLock(connection: RoomConnection, showToast: (text: string) => void): SendLock {
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

  const sendAndLock = (msg: ClientMessage): boolean => {
    const sent = connection.send(msg) !== false;
    if (sent) lock();
    return sent;
  };
  return { coolingDown, blocked: !connection.canSend || coolingDown, sendAndLock };
}
