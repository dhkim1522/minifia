import { DurableObject } from "cloudflare:workers";
import { CLOSE_CODES, MAX_FRAME_BYTES } from "../shared/protocol";
import type { ApiErrorCode, ClientMessage, ServerMessage } from "../shared/protocol";
import {
  attachConnection,
  createRoomState,
  detachConnection,
  findPlayerByToken,
} from "../shared/game/room";
import type { RoomState } from "../shared/game/room";
import { buildView } from "../shared/game/view";
import { ClientMessageSchema } from "../shared/schemas";
import { randomToken } from "./random";

export type CreateRoomRpcResult =
  | { ok: true; token: string; seat: number }
  | { ok: false; error: "CODE_TAKEN" | "NICKNAME_INVALID" };

/** 소켓에 붙는 첨부. hello 전 소켓은 첨부가 없다. */
interface SocketAttachment {
  playerId: string;
  connId: string;
}

function jsonError(error: ApiErrorCode, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

// 방 하나 = Durable Object 하나(이름 = 4자리 코드). 상태는 단일 키 "room" 에 영속하고,
// 소켓은 하이버네이션 API(acceptWebSocket)로 받는다.
export class Room extends DurableObject<Env> {
  private room: RoomState | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // 알람은 여기서 설정하지 않는다 — 대기 중인 알람을 덮어쓴다.
    ctx.blockConcurrencyWhile(async () => {
      const stored = (await ctx.storage.get<RoomState>("room")) ?? null;
      if (stored) {
        // 깨어날 때마다 살아 있는 소켓 기준으로 connected 를 다시 계산한다(배포·크래시로 소켓이 사라진 경우 보정).
        const live = new Set<string>();
        for (const ws of ctx.getWebSockets()) {
          const att = ws.deserializeAttachment() as SocketAttachment | null;
          if (att) live.add(att.connId);
        }
        this.room = {
          ...stored,
          players: stored.players.map((p) => (p.connId !== null && live.has(p.connId) ? p : { ...p, connected: false, connId: null })),
        };
      }
    });
  }

  /** Worker 가 부르는 RPC. 살아 있는 방이 있으면 덮어쓰지 않고 CODE_TAKEN 을 돌려준다. */
  async createRoom(input: { code: string; nickname: string; now: number }): Promise<CreateRoomRpcResult> {
    if (this.room && input.now < this.room.expiresAt) return { ok: false, error: "CODE_TAKEN" };

    const hostId = crypto.randomUUID();
    const token = randomToken();
    const created = createRoomState({
      code: input.code,
      hostId,
      hostToken: token,
      hostNickname: input.nickname,
      now: input.now,
    });
    if (!created.ok) return { ok: false, error: created.error };

    this.room = created.state;
    await this.ctx.storage.put("room", this.room);
    await this.ctx.storage.setAlarm(this.room.expiresAt);
    return { ok: true, token, seat: 0 };
  }

  async fetch(request: Request): Promise<Response> {
    if (!this.room || Date.now() >= this.room.expiresAt) return jsonError("ROOM_NOT_FOUND", 404);
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    // 하이버네이션 API: ws.accept() 를 직접 쓰지 않는다.
    this.ctx.acceptWebSocket(server!);
    return new Response(null, { status: 101, webSocket: client! });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string" || new TextEncoder().encode(message).byteLength > MAX_FRAME_BYTES) {
      ws.close(1009, "too_large");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const result = ClientMessageSchema.safeParse(parsed);
    if (!result.success) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const msg: ClientMessage = result.data;

    switch (msg.t) {
      case "hello":
        await this.handleHello(ws, msg.token);
        return;
      case "ping":
        this.sendTo(ws, { t: "pong", c: msg.c, serverNow: Date.now() });
        return;
      default:
        // start·leave·kick 처리기는 01-08 이 붙인다.
        this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    if (!this.room) return;
    if (now < this.room.expiresAt) {
      await this.ctx.storage.setAlarm(this.room.expiresAt);
      return;
    }
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(CLOSE_CODES.REMOVED, "room_closed");
      } catch {
        // 이미 닫힌 소켓은 무시한다.
      }
    }
    await this.ctx.storage.deleteAll();
    this.room = null;
  }

  private async handleHello(ws: WebSocket, token: string): Promise<void> {
    const room = this.room;
    if (!room) {
      ws.close(CLOSE_CODES.REMOVED, "room_closed");
      return;
    }
    if (ws.deserializeAttachment()) {
      // 이미 hello 를 마친 소켓의 두 번째 hello 는 받지 않는다.
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const player = findPlayerByToken(room, token);
    if (!player) {
      ws.close(CLOSE_CODES.REMOVED, "invalid_token");
      return;
    }

    const connId = crypto.randomUUID();
    // 같은 사람의 이전 소켓은 새 연결이 대체한다. 낡은 소켓의 닫힘은 connId 가 달라 새 연결을 덮지 않는다.
    for (const other of this.ctx.getWebSockets()) {
      const att = other.deserializeAttachment() as SocketAttachment | null;
      if (att && att.playerId === player.id) {
        try {
          other.close(CLOSE_CODES.REPLACED, "replaced");
        } catch {
          // 이미 닫힌 소켓은 무시한다.
        }
      }
    }
    const attachment: SocketAttachment = { playerId: player.id, connId };
    ws.serializeAttachment(attachment);
    this.room = attachConnection(room, player.id, connId);
    await this.persistAndBroadcast();
  }

  private async handleDisconnect(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as SocketAttachment | null;
    if (!att || !this.room) return;
    const next = detachConnection(this.room, att.playerId, att.connId);
    if (next === this.room) return;
    this.room = next;
    await this.persistAndBroadcast();
  }

  // 변경은 항상 저장이 끝난 뒤에 방송한다.
  private async persistAndBroadcast(): Promise<void> {
    if (!this.room) return;
    await this.ctx.storage.put("room", this.room);
    this.broadcast();
  }

  // 연결마다 그 사람의 뷰를 따로 만든다. 첨부가 없거나 방에 없는 playerId 는 건너뛴다.
  private broadcast(): void {
    const room = this.room;
    if (!room) return;
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as SocketAttachment | null;
      if (!att || !room.players.some((p) => p.id === att.playerId)) continue;
      this.sendTo(ws, { t: "state", view: buildView(room, att.playerId, now) });
    }
  }

  private sendTo(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // 닫히는 중인 소켓에는 보낼 수 없다.
    }
  }
}
