import { DurableObject } from "cloudflare:workers";
import { CLOSE_CODES, MAX_FRAME_BYTES } from "../shared/protocol";
import type { ApiErrorCode, ClientMessage, Claim, EmojiId, RemovedReason, RoomPreview, ServerMessage, WsErrorCode } from "../shared/protocol";
import { selectClaim } from "../shared/game/claim";
import { emote, say } from "../shared/game/chat";
import { extendDiscussion, skipDiscussion } from "../shared/game/discussion";
import type { SayInput } from "../shared/game/chat";
import {
  attachConnection,
  createRoomState,
  detachConnection,
  findPlayerByToken,
  joinRoom,
  kickPlayer,
  leaveRoom,
  normalizeStoredRoom,
  startGame,
} from "../shared/game/room";
import type { JoinError } from "../shared/game/room";
import type { RoomState } from "../shared/game/room";
import { nextWakeAt, tick } from "../shared/game/tick";
import { buildPreview, buildView } from "../shared/game/view";
import { ClientMessageSchema } from "../shared/schemas";
import { cryptoRandInt, randomToken } from "./random";

export type CreateRoomRpcResult =
  | { ok: true; token: string; seat: number }
  | { ok: false; error: "CODE_TAKEN" | "NICKNAME_INVALID" };

export type JoinRpcResult =
  | { ok: true; token: string; seat: number }
  | { ok: false; error: "ROOM_NOT_FOUND" | JoinError };

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

// 연결당 속도 제한: 1000ms 창에 20개를 넘으면 처리하지 않고 창마다 한 번만 알린다.
const RATE_WINDOW_MS = 1000;
const RATE_MAX_MESSAGES = 20;

interface RateWindow {
  windowStart: number;
  count: number;
  warned: boolean;
}

// 방 하나 = Durable Object 하나(이름 = 4자리 코드). 상태는 단일 키 "room" 에 영속하고,
// 소켓은 하이버네이션 API(acceptWebSocket)로 받는다.
export class Room extends DurableObject<Env> {
  private room: RoomState | null = null;
  // 인메모리라 하이버네이션으로 비면 새로 센다(수용). 소켓 객체가 키라 hello 전 소켓도 센다.
  private readonly rates = new WeakMap<WebSocket, RateWindow>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // 알람은 평소에 여기서 설정하지 않는다 — 대기 중인 알람을 덮어쓴다. 예외는 옛 저장 방 정규화로 마감이 바뀐 경우뿐이다(아래).
    ctx.blockConcurrencyWhile(async () => {
      const stored = (await ctx.storage.get<RoomState>("room")) ?? null;
      if (stored) {
        // 1페이즈 종착 단계로 저장된 방은 낮 시작 발표로 옮긴다(RESEARCH Pattern 6). 바뀌지 않으면 같은 객체다.
        const normalized = normalizeStoredRoom(stored, Date.now());
        // 깨어날 때마다 살아 있는 소켓 기준으로 connected 를 다시 계산한다(배포·크래시로 소켓이 사라진 경우 보정).
        const live = new Set<string>();
        for (const ws of ctx.getWebSockets()) {
          const att = ws.deserializeAttachment() as SocketAttachment | null;
          if (att) live.add(att.connId);
        }
        this.room = {
          ...normalized,
          players: normalized.players.map((p) => (p.connId !== null && live.has(p.connId) ? p : { ...p, connected: false, connId: null })),
        };
        if (normalized !== stored) {
          await ctx.storage.put("room", this.room);
          // 정규화로 생긴 이른 마감(now + 2초)이 기존 만료 알람(90초 뒤 등)보다 먼저 깨어나야 하므로 마감이 바뀐 경우에만 여기서 알람을 건다.
          // 옛 messages 키만 지운 경우(결정 0017-7)는 마감이 그대로라 대기 중인 알람을 건드리지 않는다.
          if (normalized.phaseEndsAt !== stored.phaseEndsAt) await ctx.storage.setAlarm(nextWakeAt(this.room));
        }
      }
    });
  }

  /** Worker 가 부르는 RPC. 살아 있는 방이 있으면 덮어쓰지 않고 CODE_TAKEN 을 돌려준다. 만료된 방은 정리하고 새로 만든다. */
  async createRoom(input: { code: string; nickname: string; now: number }): Promise<CreateRoomRpcResult> {
    // 만료됐지만 알람이 아직 못 지운 방이면 먼저 정리한다(옛 소켓을 닫고 저장소를 비운다). 안 그러면 옛 소켓이 새 방에서 죽은 연결로 남는다.
    await this.advance(input.now);
    if (this.room) return { ok: false, error: "CODE_TAKEN" };

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
    await this.reschedule();
    return { ok: true, token, seat: 0 };
  }

  /** 비인증 미리보기. 없는·만료된 방은 null. */
  async preview(now: number): Promise<RoomPreview | null> {
    await this.advance(now);
    if (!this.room) return null;
    return buildPreview(this.room);
  }

  /** 링크·코드 참가. 성공하면 이미 연결된 소켓들이 새 자리를 곧바로 본다. 토큰은 응답으로만 나간다. */
  async join(input: { nickname: string; now: number }): Promise<JoinRpcResult> {
    await this.advance(input.now);
    if (!this.room) return { ok: false, error: "ROOM_NOT_FOUND" };
    const result = joinRoom(this.room, {
      playerId: crypto.randomUUID(),
      token: randomToken(),
      nickname: input.nickname,
    });
    if (!result.ok) return { ok: false, error: result.error };
    this.room = result.state;
    await this.persistAndBroadcast();
    return { ok: true, token: result.player.token, seat: result.player.seat };
  }

  async fetch(request: Request): Promise<Response> {
    await this.advance(Date.now());
    if (!this.room) return jsonError("ROOM_NOT_FOUND", 404);
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
    if (this.overRateLimit(ws)) return;
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

    // 모든 진입점은 먼저 만료 확인과 tick 을 거친다(늦은 알람·재시도에도 멱등).
    await this.advance(Date.now());

    switch (msg.t) {
      case "hello":
        await this.handleHello(ws, msg.token);
        return;
      case "ping":
        this.sendTo(ws, { t: "pong", c: msg.c, serverNow: Date.now() });
        return;
      case "leave":
        await this.handleLeave(ws);
        return;
      case "kick":
        await this.handleKick(ws, msg.seat);
        return;
      case "start":
        await this.handleStart(ws);
        return;
      case "claim":
        await this.handleClaim(ws, msg.claim);
        return;
      case "say":
        await this.handleSay(ws, { template: msg.template, target: msg.target, claimedRole: msg.claimedRole });
        return;
      case "emoji":
        await this.handleEmoji(ws, msg.icon);
        return;
      case "extend":
        await this.handleExtend(ws);
        return;
      case "skip":
        await this.handleSkip(ws);
        return;
    }
  }

  /** 창 안의 처리 한도를 넘었으면 true. 넘친 메시지는 처리하지 않고, 그 창에서 처음 한 번만 알린다. */
  private overRateLimit(ws: WebSocket): boolean {
    const now = Date.now();
    let w = this.rates.get(ws);
    if (!w || now - w.windowStart >= RATE_WINDOW_MS) {
      w = { windowStart: now, count: 0, warned: false };
      this.rates.set(ws, w);
    }
    w.count += 1;
    if (w.count <= RATE_MAX_MESSAGES) return false;
    if (!w.warned) {
      w.warned = true;
      this.sendTo(ws, { t: "error", code: "RATE_LIMITED" });
    }
    return true;
  }

  private attachmentOf(ws: WebSocket): SocketAttachment | null {
    return this.room ? (ws.deserializeAttachment() as SocketAttachment | null) : null;
  }

  private closePlayerSockets(playerId: string, reason: RemovedReason): void {
    for (const other of this.ctx.getWebSockets()) {
      const att = other.deserializeAttachment() as SocketAttachment | null;
      if (!att || att.playerId !== playerId) continue;
      try {
        other.close(CLOSE_CODES.REMOVED, reason);
      } catch {
        // 이미 닫힌 소켓은 무시한다.
      }
    }
  }

  // 대기실 나가기: 신원은 hello 때 서버가 붙인 소켓 첨부뿐이다.
  private async handleLeave(ws: WebSocket): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const result = leaveRoom(this.room, att.playerId);
    if (!result.ok) {
      this.sendTo(ws, { t: "error", code: result.error === "WRONG_PHASE" ? "WRONG_PHASE" : "BAD_MESSAGE" });
      return;
    }
    this.closePlayerSockets(att.playerId, "left");
    if (result.state === null) {
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
      this.room = null;
      return;
    }
    this.room = result.state;
    await this.persistAndBroadcast();
    await this.reschedule();
  }

  private async handleKick(ws: WebSocket, seat: number): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const result = kickPlayer(this.room, att.playerId, seat);
    if (!result.ok) {
      this.sendTo(ws, { t: "error", code: result.error });
      return;
    }
    this.closePlayerSockets(result.removedId, "kicked");
    this.room = result.state;
    await this.persistAndBroadcast();
  }

  // 시작: 판정은 서버 상태와 소켓 첨부의 playerId 로만 한다(연결자 4명 이상, 방장만).
  private async handleStart(ws: WebSocket): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const now = Date.now();
    const result = startGame(this.room, att.playerId, now, cryptoRandInt);
    if (!result.ok) {
      // 거절되면 클라이언트가 서버 view 대로 다시 그리도록 최신 state 를 함께 보낸다.
      this.sendTo(ws, { t: "error", code: result.error });
      this.sendTo(ws, { t: "state", view: buildView(this.room, att.playerId, now) });
      return;
    }
    this.room = result.state;
    await this.persistAndBroadcast();
    await this.reschedule();
  }

  // 빠른 메시지: 신원은 소켓 첨부의 playerId 뿐이고, 시각은 서버 Date.now() 다(T-02-16, D-13).
  // 통과한 한 줄은 저장하지 않고 chat 이벤트로 방송만 한다(결정 0017-7). 저장은 쿨다운용 lastSendAt·nextMessageSeq 뿐이고 state 는 방송하지 않는다.
  // WRONG_PHASE 만 최신 state 를 다시 보낸다 — 단계가 넘어간 화면이 서버 값으로 돌아가게. RATE_LIMITED·BAD_MESSAGE 는 error 뿐이다(UI-SPEC 오류표).
  private async handleSay(ws: WebSocket, input: SayInput): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const result = say(this.room, att.playerId, input, Date.now());
    if (!result.ok) {
      if (result.error === "WRONG_PHASE") this.sendRejection(ws, att.playerId, result.error);
      else this.sendTo(ws, { t: "error", code: result.error });
      return;
    }
    this.room = result.state;
    await this.ctx.storage.put("room", this.room);
    this.broadcastEvent({ t: "chat", ...result.line });
  }

  // 이모티콘: 저장은 lastSendAt(쿨다운)뿐이고 state 는 방송하지 않는다 — 화면에 보이는 값이 바뀌지 않았다. 이벤트만 앉은 모든 소켓에 보낸다(D-14).
  private async handleEmoji(ws: WebSocket, icon: EmojiId): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const result = emote(this.room, att.playerId, icon, Date.now());
    if (!result.ok) {
      this.sendTo(ws, { t: "error", code: result.error });
      return;
    }
    this.room = result.state;
    await this.ctx.storage.put("room", this.room);
    this.broadcastEvent({ t: "emoji", ...result.event });
  }

  // 방장 연장: 판정은 규칙 함수의 hostId 비교가 한다(T-02-20). 마감이 바뀌므로 성공 뒤 반드시 알람을 다시 건다(Pitfall 4).
  private async handleExtend(ws: WebSocket): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const result = extendDiscussion(this.room, att.playerId);
    if (!result.ok) {
      this.sendRejection(ws, att.playerId, result.error);
      return;
    }
    this.room = result.state;
    await this.persistAndBroadcast();
    await this.reschedule();
  }

  // 방장 넘기기: 마감이 바로 다음 단계로 옮겨지므로 성공 뒤 반드시 알람을 다시 건다(Pitfall 4).
  private async handleSkip(ws: WebSocket): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const result = skipDiscussion(this.room, att.playerId, Date.now());
    if (!result.ok) {
      this.sendRejection(ws, att.playerId, result.error);
      return;
    }
    this.room = result.state;
    await this.persistAndBroadcast();
    await this.reschedule();
  }

  // 직업 선택: 신원은 소켓 첨부의 playerId 뿐이다 — 메시지에서 seat 를 읽지 않는다(T-02-16).
  // 마감이 바뀌지 않으니 reschedule 은 필요 없다. 같은 값을 다시 고르면 같은 객체라 저장·방송도 하지 않는다.
  private async handleClaim(ws: WebSocket, claim: Claim): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const result = selectClaim(this.room, att.playerId, claim);
    if (!result.ok) {
      this.sendRejection(ws, att.playerId, result.error);
      return;
    }
    if (result.state === this.room) return;
    this.room = result.state;
    await this.persistAndBroadcast();
  }

  // 거절되면 클라이언트가 서버 view 대로 다시 그리도록 error 뒤에 최신 state 를 보낸다(handleStart 선례).
  private sendRejection(ws: WebSocket, playerId: string, code: WsErrorCode): void {
    if (!this.room) return;
    this.sendTo(ws, { t: "error", code });
    this.sendTo(ws, { t: "state", view: buildView(this.room, playerId, Date.now()) });
  }

  /** 만료면 소켓을 닫고 지운다. 아니면 tick 으로 단계를 따라잡고, 바뀌면 저장 → 방송 → 알람 재설정. */
  private async advance(now: number): Promise<void> {
    const room = this.room;
    if (!room) return;
    if (now >= room.expiresAt) {
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.close(CLOSE_CODES.REMOVED, "room_closed");
        } catch {
          // 이미 닫힌 소켓은 무시한다.
        }
      }
      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();
      this.room = null;
      return;
    }
    const next = tick(room, now);
    if (next === room) return;
    this.room = next;
    await this.persistAndBroadcast();
    await this.reschedule();
  }

  // 알람은 DO 당 하나라 단계 마감과 방 만료를 여기서만 설정한다.
  private async reschedule(): Promise<void> {
    if (!this.room) return;
    await this.ctx.storage.setAlarm(nextWakeAt(this.room));
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  async alarm(): Promise<void> {
    try {
      await this.advance(Date.now());
      await this.reschedule();
    } catch (err) {
      // 토큰 없는 짧은 로그만 남기고, 예외로 재시도 한도가 소진되어 알람이 멈추지 않게 1초 뒤 다시 건다.
      console.error("room alarm failed", err instanceof Error ? err.name : "unknown");
      await this.ctx.storage.setAlarm(Date.now() + 1000);
    }
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
    // 첫 접속이면 만료가 늘었으니 알람도 따라 옮긴다.
    if (this.room.expiresAt !== room.expiresAt) await this.reschedule();
  }

  private async handleDisconnect(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as SocketAttachment | null;
    if (!att || !this.room) return;
    // 방에 없거나 최신 연결이 아닌(교체된 낡은) 소켓의 닫힘은 아무것도 바꾸지 않는다.
    const current = this.room.players.find((p) => p.id === att.playerId);
    if (!current || current.connId !== att.connId) return;
    this.room = detachConnection(this.room, att.playerId, att.connId);
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

  // 플레이어별 뷰가 아닌 공개 이벤트를 방에 앉은 모든 소켓에 그대로 보낸다(broadcast 와 같은 소켓 순회).
  private broadcastEvent(msg: ServerMessage): void {
    const room = this.room;
    if (!room) return;
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as SocketAttachment | null;
      if (!att || !room.players.some((p) => p.id === att.playerId)) continue;
      this.sendTo(ws, msg);
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
