import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, RemovedReason, RoomView, ServerMessage } from "../../shared/protocol";
import { CLOSE_CODES } from "../../shared/protocol";

export type ConnectionStatus = "connecting" | "open" | "reconnecting" | "replaced" | "removed";

export interface RoomConnection {
  status: ConnectionStatus;
  view: RoomView | null;
  /** 서버시각 - 로컬시각(ms) */
  offset: number;
  removedReason: RemovedReason | null;
  send(msg: ClientMessage): void;
  reconnect(): void;
}

const RETRY_DELAY_MS = 1000;
// 상태를 한 번도 못 받은 채 이만큼 연달아 끊기면 자동 재시도를 멈춘다(reconnect() 로 다시 시작).
// 지수 백오프·화면 복귀 점검·ping 표본 오프셋은 01-05 가 이 함수 안에서 교체한다.
const MAX_CONSECUTIVE_FAILURES = 5;

const REMOVED_REASONS: readonly string[] = ["left", "kicked", "invalid_token", "room_closed"];

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

export function useRoomConnection(
  code: string,
  token: string,
  options?: { createSocket?: (url: string) => WebSocket },
): RoomConnection {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [view, setView] = useState<RoomView | null>(null);
  const [offset, setOffset] = useState(0);
  const [removedReason, setRemovedReason] = useState<RemovedReason | null>(null);
  const [nonce, setNonce] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const createSocketRef = useRef(options?.createSocket);
  createSocketRef.current = options?.createSocket;

  useEffect(() => {
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    setStatus("connecting");
    setRemovedReason(null);

    const connect = () => {
      const url = roomSocketUrl(window.location, code);
      const ws = createSocketRef.current ? createSocketRef.current(url) : new WebSocket(url);
      socketRef.current = ws;

      ws.addEventListener("open", () => {
        if (disposed) return;
        ws.send(JSON.stringify({ t: "hello", token } satisfies ClientMessage));
        setStatus("open");
      });
      ws.addEventListener("message", (e: MessageEvent) => {
        if (disposed) return;
        const msg = parseServerMessage(e.data);
        if (msg?.t === "state") {
          failures = 0;
          setView(msg.view);
          setOffset(msg.view.serverNow - Date.now());
        }
      });
      ws.addEventListener("close", (e: CloseEvent) => {
        if (disposed || socketRef.current !== ws) return;
        if (e.code === CLOSE_CODES.REPLACED) {
          setStatus("replaced");
        } else if (e.code === CLOSE_CODES.REMOVED) {
          setRemovedReason(REMOVED_REASONS.includes(e.reason) ? (e.reason as RemovedReason) : "room_closed");
          setStatus("removed");
        } else {
          setStatus("reconnecting");
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

  const send = useCallback((msg: ClientMessage) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);
  const reconnect = useCallback(() => setNonce((n) => n + 1), []);

  return { status, view, offset, removedReason, send, reconnect };
}
