import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, RemovedReason, RoomView, ServerMessage } from "../../shared/protocol";
import type { BannerMode, LinkEvent, LinkState, LinkStatus } from "./linkReducer";
import { initialLinkState, linkReducer } from "./linkReducer";

export type ConnectionStatus = LinkStatus;

export interface RoomConnection {
  status: ConnectionStatus;
  banner: BannerMode;
  view: RoomView | null;
  /** 서버시각 - 로컬시각(ms) */
  offset: number;
  /** 소켓이 열릴 때마다 1씩 늘어난다 */
  epoch: number;
  removedReason: RemovedReason | null;
  /** 서버로 입력을 보낼 수 있는지(열려 있고 view 가 있음) */
  canSend: boolean;
  send(msg: ClientMessage): void;
  reconnect(): void;
  retry(): void;
}

const RETRY_DELAY_MS = 1000;
// 임시 재시도(1초 고정, 5회 뒤 멈춤). 지수 백오프·화면 복귀 점검은 Task 2 에서 교체한다.
const MAX_CONSECUTIVE_FAILURES = 5;

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
    if (v && (v.t === "state" || v.t === "pong" || v.t === "error")) return v as ServerMessage;
  } catch {
    // 서버가 보낸 것이 아닌 프레임은 무시한다.
  }
  return null;
}

const isVisible = () => typeof document === "undefined" || document.visibilityState !== "hidden";

export function useRoomConnection(
  code: string,
  token: string,
  options?: { createSocket?: (url: string) => WebSocket },
): RoomConnection {
  const [link, setLink] = useState<LinkState>(() => initialLinkState(Date.now(), isVisible()));
  const linkRef = useRef(link);
  const [view, setView] = useState<RoomView | null>(null);
  const [offset, setOffset] = useState(0);
  const [nonce, setNonce] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const createSocketRef = useRef(options?.createSocket);
  createSocketRef.current = options?.createSocket;

  useEffect(() => {
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    // 리듀서는 순수하니 ref 로 최신 상태를 함께 들고, 전이 결과를 바로 읽어 재시도를 정한다.
    const emit = (e: LinkEvent): LinkState => {
      const next = linkReducer(linkRef.current, e);
      if (next !== linkRef.current) {
        linkRef.current = next;
        setLink(next);
      }
      return next;
    };

    const connect = () => {
      const url = roomSocketUrl(window.location, code);
      const ws = createSocketRef.current ? createSocketRef.current(url) : new WebSocket(url);
      socketRef.current = ws;

      ws.addEventListener("open", () => {
        if (disposed) return;
        ws.send(JSON.stringify({ t: "hello", token } satisfies ClientMessage));
        emit({ type: "open", now: Date.now() });
      });
      ws.addEventListener("message", (e: MessageEvent) => {
        if (disposed) return;
        const msg = parseServerMessage(e.data);
        if (msg?.t === "state") {
          failures = 0;
          setView(msg.view);
          setOffset(msg.view.serverNow - Date.now());
          emit({ type: "state", now: Date.now() });
        }
      });
      ws.addEventListener("close", (e: CloseEvent) => {
        if (disposed || socketRef.current !== ws) return;
        const next = emit({ type: "close", code: e.code, reason: e.reason, now: Date.now() });
        if (next.status === "reconnecting") {
          failures += 1;
          if (failures <= MAX_CONSECUTIVE_FAILURES) retryTimer = setTimeout(connect, RETRY_DELAY_MS);
        }
      });
    };

    connect();
    return () => {
      // StrictMode 가 effect 를 두 번 돌려도 소켓이 새지 않게 정리에서 닫는다.
      disposed = true;
      if (retryTimer !== undefined) clearTimeout(retryTimer);
      const ws = socketRef.current;
      socketRef.current = null;
      if (ws) ws.close();
    };
  }, [code, token, nonce]);

  const canSend = link.status === "open" && link.hasView;
  const canSendRef = useRef(canSend);
  canSendRef.current = canSend;

  const send = useCallback((msg: ClientMessage) => {
    const ws = socketRef.current;
    if (canSendRef.current && ws && ws.readyState === OPEN) ws.send(JSON.stringify(msg));
  }, []);
  const reconnect = useCallback(() => {
    linkRef.current = linkReducer(linkRef.current, { type: "retry", now: Date.now() });
    setLink(linkRef.current);
    setNonce((n) => n + 1);
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
    reconnect,
    retry: reconnect,
  };
}
