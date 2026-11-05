// 로비 꾸미기의 상태 (10-07, UI-SPEC D-5·O-8): 미리 보기(즉시 갈아입음) → {t:"dress", look} 전송 → 서버 state 로 맞춤.
//
// - 미리 보기: pick(id) 를 누르는 즉시 내 캐릭터가 갈아입는다. WorldStage 에는 내 좌석 players[].look 만 바꾼 view 사본(stageView)을 넘긴다 — 런타임·WorldStage 변경 없음.
// - 맞춤: 서버 view 의 내 look 이 미리 보기 값과 같아지면 미리 보기가 끝난다(stageView 는 다시 view 와 같은 참조).
// - 되돌림: DRESS_REVERT_MS 안에 같아지지 않으면(서버 거절·지연) 서버 값으로 조용히 돌아간다. 거절 알림·문구·토스트는 없다(L30: 알림은 거절 이유를 묻는 오라클이 된다).
// - 전송 간격: 마지막 전송 뒤 DRESS_SEND_GAP_MS(서버 250ms 보다 조금 길다) 안의 선택은 마지막 것만 그 시각에 보낸다(중간 선택은 버려진다, T-10-23).
// - 연결이 끊기면(canSend 거짓) pick 은 아무 일 없고 대기 중이던 전송·미리 보기는 접힌다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_LOOK } from "../../shared/game/look";
import type { ClientMessage, OutfitId, RoomView } from "../../shared/protocol";

/** 클라이언트 전송 간격(ms). 서버 LOOK_MIN_GAP_MS(250) 보다 조금 길어 서버에 버려지지 않는다 */
export const DRESS_SEND_GAP_MS = 260;
/** 서버 값이 미리 보기와 같아지지 않을 때 서버 값으로 되돌아가기까지(ms) */
export const DRESS_REVERT_MS = 1200;

export interface UseDressOptions {
  view: RoomView;
  /** 보냈으면 true, 소켓이 닫혀 못 보냈으면 false. 반환값이 없는 함수(void)는 보낸 것으로 본다 */
  send: (msg: ClientMessage) => boolean | void;
  /** 연결이 열려 서버로 보낼 수 있는가 */
  canSend: boolean;
}

export interface DressApi {
  /** 지금 화면에 입고 있는 의상(미리 보기가 있으면 그 값, 없으면 서버 값) */
  look: OutfitId;
  /** WorldStage 에 넘길 view. 미리 보기가 없으면 view 와 같은 참조 */
  stageView: RoomView;
  pick: (id: OutfitId) => void;
}

export function useDress({ view, send, canSend }: UseDressOptions): DressApi {
  const seat = view.me.seat;
  const serverLook = view.players.find((p) => p.seat === seat)?.look ?? DEFAULT_LOOK;
  const [preview, setPreview] = useState<OutfitId | null>(null);

  const sendRef = useRef(send);
  sendRef.current = send;
  /** 이번 미리 보기 동안 마지막으로 보낸 값. 미리 보기가 끝나면 비운다 */
  const sentRef = useRef<OutfitId | null>(null);
  const lastSentAt = useRef(Number.NEGATIVE_INFINITY);
  const pending = useRef<OutfitId | null>(null);
  const sendTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearTimers = useCallback(() => {
    if (sendTimer.current !== undefined) clearTimeout(sendTimer.current);
    if (revertTimer.current !== undefined) clearTimeout(revertTimer.current);
    sendTimer.current = undefined;
    revertTimer.current = undefined;
    pending.current = null;
  }, []);

  const endPreview = useCallback(() => {
    clearTimers();
    sentRef.current = null;
    setPreview(null);
  }, [clearTimers]);

  // 서버 값이 미리 보기와 같아지면 끝
  useEffect(() => {
    if (preview !== null && serverLook === preview) endPreview();
  }, [preview, serverLook, endPreview]);

  // 연결이 끊기면 대기 중인 전송과 미리 보기를 접는다
  useEffect(() => {
    if (!canSend) endPreview();
  }, [canSend, endPreview]);

  useEffect(() => clearTimers, [clearTimers]);

  const transmit = useCallback((id: OutfitId) => {
    pending.current = null;
    sendTimer.current = undefined;
    lastSentAt.current = Date.now();
    sentRef.current = id;
    sendRef.current({ t: "dress", look: id });
  }, []);

  const pick = useCallback(
    (id: OutfitId) => {
      if (!canSend) return;
      setPreview(id);
      if (revertTimer.current !== undefined) clearTimeout(revertTimer.current);
      revertTimer.current = setTimeout(endPreview, DRESS_REVERT_MS);
      // 보낼 필요가 있는가: 이미 서버에 있거나 방금 보낸 값과 같으면 보내지 않는다. 대기 중이던 것은 새 선택으로 갈아 끼운다.
      const settled = sentRef.current ?? serverLook;
      if (sendTimer.current !== undefined) {
        clearTimeout(sendTimer.current);
        sendTimer.current = undefined;
        pending.current = null;
      }
      if (id === settled) return;
      const wait = lastSentAt.current + DRESS_SEND_GAP_MS - Date.now();
      if (wait <= 0) {
        transmit(id);
      } else {
        pending.current = id;
        sendTimer.current = setTimeout(() => transmit(id), wait);
      }
    },
    [canSend, serverLook, endPreview, transmit],
  );

  const stageView = useMemo<RoomView>(() => {
    if (preview === null || preview === serverLook) return view;
    if (!view.players.some((p) => p.seat === seat)) return view;
    return { ...view, players: view.players.map((p) => (p.seat === seat ? { ...p, look: preview } : p)) };
  }, [view, preview, serverLook, seat]);

  return { look: preview ?? serverLook, stageView, pick };
}
