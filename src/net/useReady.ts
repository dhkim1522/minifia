// 결과 화면 다시 하기 알약의 상태 (11-12, 결정 D-11·D-12, UI-SPEC D-1): 손님 [준비] 토글과 방장 [시작]을 한 훅이 쥐고 화면은 그린다.
//
// - 손님: press = { t:"ready", on: !mine, round }. 서버 state 가 오기 전에 낙관적으로 바꾸지 않는다. 250ms 안의 다시 누르기는 무시(잠금은 클라이언트만, 서버는 별도 제한이 없다).
// - 방장: press 는 세 갈래다. 준비한 연결된 사람 n 이 최소 인원 미만이면 토스트 '{최소}명부터 시작해요' 만(보내지 않는다),
//   n 이 충분하고 연결된 미준비자(쉬게 될 사람)가 있으면 확인(confirm)을 열고 confirmStart 에서 보낸다, 모두 준비했으면 확인 없이 보낸다.
//   { t:"rematch", round } 를 보냈으면 REMATCH_LOCK_MS(2초) 잠근다(pending). 거절은 알리지 않는다 — 서버가 다시 보낸 state 대로 그린다(L40).
// - stageActive 가 거짓(승리 조명 전)이거나 canSend 가 거짓이면 어느 쪽도 아무 일 없다.
// - n·m 은 서버가 실은 공개 값(players[].ready·connected)으로 센다. 서버가 방장·봇을 늘 ready 로 싣는다(11-08). 판정은 서버 몫이고 이 숫자는 표시용이다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientMessage, PublicPlayer, RoomView } from "../../shared/protocol";
import { READY_TEXT } from "../game/resultText";

/** 손님 토글 간격(ms) */
export const READY_TOGGLE_GAP_MS = 250;
/** 시작을 보낸 뒤 잠금(ms, 로비 [시작] 잠금과 같다) */
export const REMATCH_LOCK_MS = 2000;

export interface UseReadyOptions {
  view: RoomView;
  /** 보냈으면 true, 소켓이 닫혀 못 보냈으면 false. 반환값이 없는 함수(void)는 보낸 것으로 본다 */
  send: (msg: ClientMessage) => boolean | void;
  canSend: boolean;
  /** 승리 조명(4600) 이후라 알약이 활성인가 */
  stageActive: boolean;
}

export interface RestingFace {
  seat: number;
  nickname: string;
}

export interface ReadyApi {
  /** 방장인가(view.me.isHost) */
  isHost: boolean;
  /** 내가 준비했나(서버가 실은 내 줄의 ready) */
  mine: boolean;
  /** n: 준비한 연결된 사람 수(방장·봇 포함) */
  ready: number;
  /** m: 연결된 사람 수 */
  total: number;
  /** n 이 최소 인원 이상인가(표시용 — 판정은 서버) */
  canStart: boolean;
  /** 시작을 보낸 직후 2초 */
  pending: boolean;
  press(): void;
  /** 방장 토스트. n 은 누를 때마다 늘어 같은 문구도 다시 띄울 수 있다 */
  toast: { text: string; n: number } | null;
  /** 방장 확인(쉬게 될 사람). 열려 있지 않으면 null */
  confirm: { resting: RestingFace[] } | null;
  confirmStart(): void;
  cancelConfirm(): void;
}

const isReady = (p: PublicPlayer): boolean => p.connected && p.ready === true;

export function useReady({ view, send, canSend, stageActive }: UseReadyOptions): ReadyApi {
  const round = view.round ?? 1;
  const isHost = view.me.isHost;
  const mine = view.players.find((p) => p.seat === view.me.seat)?.ready === true;
  const total = useMemo(() => view.players.filter((p) => p.connected).length, [view.players]);
  const ready = useMemo(() => view.players.filter(isReady).length, [view.players]);
  const resting = useMemo<RestingFace[]>(
    () => view.players.filter((p) => p.connected && p.ready !== true).map((p) => ({ seat: p.seat, nickname: p.nickname })),
    [view.players],
  );
  const canStart = ready >= view.minPlayers;

  const sendRef = useRef(send);
  sendRef.current = send;
  const lastToggleAt = useRef(Number.NEGATIVE_INFINITY);
  const [pending, setPending] = useState(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
  const toastN = useRef(0);

  useEffect(
    () => () => {
      if (lockTimer.current !== undefined) clearTimeout(lockTimer.current);
    },
    [],
  );

  // 확인이 열려 있는 동안 조건이 사라지면(누가 준비를 풀어 n 이 모자라거나 쉬게 될 사람이 없어짐) 닫는다. 판이 바뀌어도 닫는다
  const confirmValid = confirmOpen && isHost && canStart && resting.length > 0;
  useEffect(() => {
    if (confirmOpen && !confirmValid) setConfirmOpen(false);
  }, [confirmOpen, confirmValid]);
  useEffect(() => {
    setConfirmOpen(false);
  }, [round]);

  const startNow = useCallback(() => {
    if (sendRef.current({ t: "rematch", round }) === false) return;
    setPending(true);
    if (lockTimer.current !== undefined) clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => {
      lockTimer.current = undefined;
      setPending(false);
    }, REMATCH_LOCK_MS);
  }, [round]);

  const press = useCallback(() => {
    if (!canSend || !stageActive) return;
    if (!isHost) {
      const now = Date.now();
      if (now - lastToggleAt.current < READY_TOGGLE_GAP_MS) return;
      lastToggleAt.current = now;
      sendRef.current({ t: "ready", on: !mine, round });
      return;
    }
    if (pending) return;
    if (!canStart) {
      setToast({ text: READY_TEXT.needPlayers(view.minPlayers), n: ++toastN.current });
      return;
    }
    if (resting.length > 0) {
      setConfirmOpen(true);
      return;
    }
    startNow();
  }, [canSend, stageActive, isHost, mine, round, pending, canStart, resting.length, view.minPlayers, startNow]);

  const confirmStart = useCallback(() => {
    if (!canSend || pending) return;
    setConfirmOpen(false);
    startNow();
  }, [canSend, pending, startNow]);
  const cancelConfirm = useCallback(() => setConfirmOpen(false), []);

  return { isHost, mine, ready, total, canStart, pending, press, toast, confirm: confirmValid ? { resting } : null, confirmStart, cancelConfirm };
}
