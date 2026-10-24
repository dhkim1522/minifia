import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, RemovedReason, RoomView, ServerMessage } from "../../shared/protocol";
import { getPreview } from "./api";
import type { ClockSample } from "./clock";
import { estimateOffset } from "./clock";
import type { BannerMode, LinkEvent, LinkState, LinkStatus } from "./linkReducer";
import { initialLinkState, linkReducer, RESTORED_MS, retryDelayMs, STALE_CHECK_AFTER } from "./linkReducer";

export type ConnectionStatus = LinkStatus;

/** 상태로 쌓지 않고 구독자에게만 흘리는 서버 프레임. 이모티콘 폭주가 전체 화면 렌더로 번지지 않게 한다(T-02-22). */
export type RoomEvent = Extract<ServerMessage, { t: "emoji" | "error" | "chat" }>;

export interface RoomConnection {
  status: ConnectionStatus;
  banner: BannerMode;
  view: RoomView | null;
  /** 서버시각 - 로컬시각(ms). 첫 pong 전에는 첫 state 의 serverNow 로 잡은 거친 값(state 전에는 0) */
  offset: number;
  /** 새 연결의 첫 state 마다 1씩 늘어난다(대기실 토스트가 재접속 직후 지난 변화를 알리지 않게 쓰는 값. view 와 함께 바뀐다) */
  epoch: number;
  removedReason: RemovedReason | null;
  /** emoji·chat·error 서버 프레임 구독. 돌려준 함수로 해제한다. 참조는 렌더 사이에 안정적이다 */
  onEvent(listener: (e: RoomEvent) => void): () => void;
  /** 서버로 입력을 보낼 수 있는지(열려 있고 view 가 있음). 끊긴 동안은 거짓 */
  canSend: boolean;
  /** 보냈으면 true. 끊겨 있어 버려졌으면 false */
  send(msg: ClientMessage): boolean;
  /** replaced 화면의 [다시 연결] */
  reconnect(): void;
  /** failed 화면의 [다시 시도] */
  retry(): void;
}

export interface RoomConnectionOptions {
  createSocket?: (url: string) => WebSocket;
  /** 재시도 지터용 난수 [0,1) */
  random?: () => number;
  checkRoom?: (code: string) => Promise<"alive" | "gone" | "unknown">;
}

// 열린 척하는 소켓 대비(리서치 가정 A3): 화면 복귀 때 ping 을 보내고 이 안에 pong 이 없으면 닫는다.
const PONG_WAIT_MS = 2_500;
const INITIAL_PINGS = 3;
const MAX_SAMPLES = 5;
const TICK_MS = 1_000;

// WebSocket.OPEN / CONNECTING 값. 가짜 소켓과 전역 WebSocket 이 없는 환경에서도 같은 값으로 비교한다.
const CONNECTING = 0;
const OPEN = 1;

/** https -> wss, http -> ws. 토큰은 주소에 넣지 않는다 — hello 메시지 본문으로만 보낸다. */
export function roomSocketUrl(loc: { protocol: string; host: string }, code: string): string {
  const scheme = loc.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${loc.host}/api/rooms/${code}/ws`;
}

function parseServerMessage(data: unknown): ServerMessage | null {
  if (typeof data !== "string") return null;
  try {
    const v = JSON.parse(data) as { t?: unknown };
    if (v && (v.t === "state" || v.t === "pong" || v.t === "error" || v.t === "emoji" || v.t === "chat")) return v as ServerMessage;
  } catch {
    // 서버가 보낸 것이 아닌 프레임은 무시한다.
  }
  return null;
}

// 브라우저 WebSocket 은 업그레이드 실패(404)를 구분할 수 없어, 방이 사라졌는지는 미리보기 라우트로 확인한다.
async function defaultCheckRoom(code: string): Promise<"alive" | "gone" | "unknown"> {
  const result = await getPreview(code);
  if (result.ok) return "alive";
  return result.error === "ROOM_NOT_FOUND" ? "gone" : "unknown";
}

const isVisible = () => typeof document === "undefined" || document.visibilityState !== "hidden";
const isTerminal = (s: LinkStatus) => s === "failed" || s === "replaced" || s === "removed";

export function useRoomConnection(code: string, token: string, options?: RoomConnectionOptions): RoomConnection {
  const [link, setLink] = useState<LinkState>(() => initialLinkState(Date.now(), isVisible()));
  const linkRef = useRef(link);
  const [view, setView] = useState<RoomView | null>(null);
  const [offset, setOffset] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const restartRef = useRef<(() => void) | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const listenersRef = useRef(new Set<(e: RoomEvent) => void>());

  useEffect(() => {
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pongTimer: ReturnType<typeof setTimeout> | undefined;
    let restoredTimer: ReturnType<typeof setTimeout> | undefined;
    let pingCounter = 0;
    let checkC = -1;
    const pending = new Map<number, number>();
    const samples: ClockSample[] = [];

    // 리듀서는 순수하니 ref 로 최신 상태를 함께 들고, 전이 결과를 바로 읽어 다음 동작을 정한다.
    const emit = (e: LinkEvent): LinkState => {
      const next = linkReducer(linkRef.current, e);
      if (next !== linkRef.current) {
        linkRef.current = next;
        setLink(next);
      }
      return next;
    };

    const clearRetry = () => {
      if (retryTimer !== undefined) clearTimeout(retryTimer);
      retryTimer = undefined;
    };
    const clearPongWait = () => {
      if (pongTimer !== undefined) clearTimeout(pongTimer);
      pongTimer = undefined;
      checkC = -1;
    };

    const sendPing = (ws: WebSocket): number => {
      pingCounter += 1;
      pending.set(pingCounter, Date.now());
      ws.send(JSON.stringify({ t: "ping", c: pingCounter } satisfies ClientMessage));
      return pingCounter;
    };

    const onPong = (c: number, serverNow: number) => {
      const t0 = pending.get(c);
      if (t0 === undefined) return;
      pending.delete(c);
      samples.push({ t0, t1: Date.now(), serverNow });
      if (samples.length > MAX_SAMPLES) samples.shift();
      setOffset(estimateOffset(samples));
      if (c === checkC) clearPongWait();
    };

    // 포기(failed)·방 소멸(removed) 로 넘어가면 더 시도하지 않고, 매달려 있던 소켓과 예약을 정리한다.
    const settle = (state: LinkState) => {
      if (state.status !== "failed" && state.status !== "removed") return;
      clearRetry();
      clearPongWait();
      const ws = socketRef.current;
      socketRef.current = null; // 그 소켓의 close 는 무시된다
      if (ws) ws.close();
    };

    // 연속 실패 한 묶음에 한 번(attempts 가 처음 STALE_CHECK_AFTER 에 닿을 때): 방이 아직 있는지 묻는다(Pitfall 22).
    const checkRoomOnce = (state: LinkState) => {
      if (state.status !== "reconnecting" || state.attempts !== STALE_CHECK_AFTER) return;
      const check = optionsRef.current?.checkRoom ?? defaultCheckRoom;
      void check(code)
        .then((result) => {
          if (!disposed && result === "gone") settle(emit({ type: "roomGone", now: Date.now() }));
        })
        .catch(() => {
          // 확인이 실패하면 알 수 없는 것으로 보고 계속 재시도한다.
        });
    };

    const scheduleRetry = (state: LinkState) => {
      // 숨겨진 동안에는 예약하지 않는다. 다시 보이면 visibilitychange 가 바로 연결한다.
      if (state.status !== "reconnecting" || !state.visible) return;
      const random = optionsRef.current?.random ?? Math.random;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        if (!disposed && linkRef.current.status === "reconnecting") connect();
      }, retryDelayMs(state.attempts, random()));
    };

    function connect(): void {
      clearRetry();
      clearPongWait();
      const url = roomSocketUrl(window.location, code);
      const create = optionsRef.current?.createSocket;
      const ws = create ? create(url) : new WebSocket(url);
      const prev = socketRef.current;
      socketRef.current = ws; // 먼저 바꿔 두어 이전 소켓의 close 가 무시되게 한다
      if (prev) prev.close();

      ws.addEventListener("open", () => {
        if (disposed || socketRef.current !== ws) return;
        ws.send(JSON.stringify({ t: "hello", token } satisfies ClientMessage));
        emit({ type: "open", now: Date.now() });
        // 접속 직후 시계 표본 3개: 왕복이 가장 짧은 값으로 오프셋을 정한다.
        for (let i = 0; i < INITIAL_PINGS; i += 1) sendPing(ws);
      });
      ws.addEventListener("message", (e: MessageEvent) => {
        if (disposed || socketRef.current !== ws) return;
        const msg = parseServerMessage(e.data);
        if (msg?.t === "state") {
          // 첫 pong 은 첫 state 보다 늦다. 표본이 없는 동안은 view.serverNow 로 거친 오프셋을 먼저 정해 둔다
          // (한쪽 방향 지연만큼만 틀린다). 안 그러면 시계가 빠른 폰에서 역할 카드가 눌리기도 전에 앞면으로 열린다.
          if (samples.length === 0) setOffset(msg.view.serverNow - Date.now());
          setView(msg.view);
          const next = emit({ type: "state", now: Date.now() });
          if (next.banner === "restored") {
            if (restoredTimer !== undefined) clearTimeout(restoredTimer);
            restoredTimer = setTimeout(() => emit({ type: "tick", now: Date.now() }), RESTORED_MS);
          }
        } else if (msg?.t === "pong") {
          onPong(msg.c, msg.serverNow);
        } else if (msg?.t === "emoji" || msg?.t === "chat" || msg?.t === "error") {
          for (const listener of [...listenersRef.current]) listener(msg);
        }
      });
      ws.addEventListener("close", (e: CloseEvent) => {
        if (disposed || socketRef.current !== ws) return;
        const next = emit({ type: "close", code: e.code, reason: e.reason, now: Date.now() });
        // replaced·removed 로 끝났으면 pong 대기가 새 연결을 열지 못하게 푼다.
        if (isTerminal(next.status)) clearPongWait();
        checkRoomOnce(next);
        scheduleRetry(next);
      });
    }

    // 열린 소켓이 정말 살아 있는지 ping 으로 확인한다. 2.5초 안에 pong 이 없으면 그 소켓을 버린다.
    const checkAlive = (ws: WebSocket) => {
      clearPongWait();
      checkC = sendPing(ws);
      pongTimer = setTimeout(() => {
        pongTimer = undefined;
        checkC = -1;
        if (disposed || socketRef.current !== ws || isTerminal(linkRef.current.status)) return;
        checkRoomOnce(emit({ type: "close", code: 1006, reason: "stale", now: Date.now() }));
        ws.close();
        if (linkRef.current.visible) connect();
      }, PONG_WAIT_MS);
    };

    // 화면이 보이게 되거나 네트워크가 돌아왔다: 기다리지 않고 바로 확인·재시도한다.
    const wake = () => {
      const st = linkRef.current.status;
      if (isTerminal(st)) return;
      const ws = socketRef.current;
      if (ws && ws.readyState === OPEN) {
        checkAlive(ws);
        return;
      }
      if (ws && ws.readyState === CONNECTING && st === "connecting") return; // 첫 연결 중
      connect();
    };

    const onVisibility = () => {
      const visible = isVisible();
      emit({ type: "visibility", visible, now: Date.now() });
      if (!visible) {
        clearRetry();
        return;
      }
      wake();
    };
    const onOnline = () => wake();

    const tick = setInterval(() => {
      const s = linkRef.current;
      const trying = s.status === "reconnecting" || (s.status === "connecting" && s.failingSince !== null);
      if (trying || s.banner === "restored") settle(emit({ type: "tick", now: Date.now() }));
    }, TICK_MS);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onVisibility);
    window.addEventListener("online", onOnline);

    restartRef.current = () => {
      const st = linkRef.current.status;
      if (st !== "failed" && st !== "replaced") return;
      emit({ type: "retry", now: Date.now() });
      connect();
    };

    connect();
    return () => {
      // StrictMode 가 effect 를 두 번 돌려도 소켓이 새지 않게 정리에서 닫는다.
      disposed = true;
      restartRef.current = null;
      clearRetry();
      clearPongWait();
      if (restoredTimer !== undefined) clearTimeout(restoredTimer);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onVisibility);
      window.removeEventListener("online", onOnline);
      const ws = socketRef.current;
      socketRef.current = null;
      if (ws) ws.close();
    };
  }, [code, token]);

  const canSend = link.status === "open" && link.hasView;
  const canSendRef = useRef(canSend);
  canSendRef.current = canSend;

  const send = useCallback((msg: ClientMessage): boolean => {
    const ws = socketRef.current;
    if (!canSendRef.current || !ws || ws.readyState !== OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  }, []);
  const retry = useCallback(() => restartRef.current?.(), []);
  const onEvent = useCallback((listener: (e: RoomEvent) => void): (() => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  return {
    status: link.status,
    banner: link.banner,
    view,
    offset,
    epoch: link.epoch,
    removedReason: link.removedReason,
    canSend,
    send,
    onEvent,
    reconnect: retry,
    retry,
  };
}
