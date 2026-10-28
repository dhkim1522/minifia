import { DurableObject } from "cloudflare:workers";
import { CLOSE_CODES, MAX_FRAME_BYTES } from "../shared/protocol";
import type { ApiErrorCode, ClientMessage, Claim, EmojiId, RemovedReason, RoomPreview, ServerMessage, WsErrorCode } from "../shared/protocol";
import { botWakeAt, isBot, syncBotPlan, takeDueBotSteps } from "../shared/game/bots";
import type { BotStep } from "../shared/game/bots";
import { selectClaim } from "../shared/game/claim";
import { emote, say } from "../shared/game/chat";
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
import { nightChatRecipientIds, pickRecipientIds, pickTarget } from "../shared/game/night";
import { resetToLobby, setBotCount, setTestRole, skipPhase } from "../shared/game/testTools";
import type { RoleId } from "../shared/game/roles";
import { nextWakeAt, tick } from "../shared/game/tick";
import { castCandidateVote, castExecVote } from "../shared/game/vote";
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
          // 서버 봇은 소켓이 없는 채로 항상 연결된 상태다(결정 0024) — 안 그러면 깨어날 때마다 끊김이 되어 시작 규칙이 깨진다.
          players: normalized.players.map((p) =>
            isBot(p) || (p.connId !== null && live.has(p.connId)) ? p : { ...p, connected: false, connId: null },
          ),
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
  async createRoom(input: { code: string; nickname: string; now: number; testMode?: boolean }): Promise<CreateRoomRpcResult> {
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
      testMode: input.testMode === true,
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
      case "pick":
        await this.handlePick(ws, msg.target);
        return;
      case "execVote":
        await this.handleExecVote(ws, msg.agree);
        return;
      case "candidateVote":
        await this.handleCandidateVote(ws, msg.target);
        return;
      case "testSkip":
        await this.handleTestSkip(ws);
        return;
      case "testReset":
        await this.handleTestReset(ws);
        return;
      case "testRole":
        await this.handleTestRole(ws, msg.role);
        return;
      case "testBots":
        await this.handleTestBots(ws, msg.count);
        return;
      default: {
        // 새 메시지를 ClientMessage 에 더하고 여기를 빠뜨리면 컴파일이 실패한다 — 조용히 무시되지 않게(Pitfall 15).
        const unhandled: never = msg;
        void unhandled;
        return;
      }
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

  // 빠른 메시지·이모티콘·직업 선택·밤 행동은 "소켓 껍데기(handleX)" 와 "본체(applyX)" 로 나뉜다(결정 0024).
  // 껍데기는 소켓 첨부에서 playerId 를 얻고 거부를 그 소켓에 알린다. 본체는 같은 규칙 함수·같은 저장·방송을 하고 실패 코드를 돌려준다.
  // 서버 봇은 본체만 부른다 — 사람과 같은 검증을 거치고(특권 없음), 거부는 알릴 소켓이 없어 버린다.

  // 빠른 메시지: 신원은 소켓 첨부의 playerId 뿐이고, 시각은 서버 Date.now() 다(T-02-16, D-13).
  // WRONG_PHASE 만 최신 state 를 다시 보낸다 — 단계가 넘어간 화면이 서버 값으로 돌아가게. RATE_LIMITED·BAD_MESSAGE 는 error 뿐이다(UI-SPEC 오류표).
  private async handleSay(ws: WebSocket, input: SayInput): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const error = await this.applySay(att.playerId, input);
    if (error === null) return;
    if (error === "WRONG_PHASE") this.sendRejection(ws, att.playerId, error);
    else this.sendTo(ws, { t: "error", code: error });
  }

  // 통과한 한 줄은 저장하지 않고 chat 이벤트로 방송만 한다(결정 0017-7). 저장은 쿨다운용 lastSendAt·nextMessageSeq 뿐이고 state 는 방송하지 않는다.
  private async applySay(playerId: string, input: SayInput): Promise<WsErrorCode | null> {
    if (!this.room) return "BAD_MESSAGE";
    const result = say(this.room, playerId, input, Date.now());
    if (!result.ok) return result.error;
    this.room = result.state;
    await this.ctx.storage.put("room", this.room);
    // 밤 채팅은 살아 있는 마피아와 관전자 소켓에만 — 다른 소켓에 보내고 화면이 거르는 방식은 쓰지 않는다(결정 0002·0019·0021).
    const chat: ServerMessage = { t: "chat", ...result.line };
    if (this.room.phase === "night") this.broadcastEventTo(chat, nightChatRecipientIds(this.room));
    else this.broadcastEvent(chat);
    return null;
  }

  private async handleEmoji(ws: WebSocket, icon: EmojiId): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const error = await this.applyEmoji(att.playerId, icon);
    if (error !== null) this.sendTo(ws, { t: "error", code: error });
  }

  // 이모티콘: 저장은 lastSendAt(쿨다운)뿐이고 state 는 방송하지 않는다 — 화면에 보이는 값이 바뀌지 않았다. 이벤트만 앉은 모든 소켓에 보낸다(D-14).
  private async applyEmoji(playerId: string, icon: EmojiId): Promise<WsErrorCode | null> {
    if (!this.room) return "BAD_MESSAGE";
    const result = emote(this.room, playerId, icon, Date.now());
    if (!result.ok) return result.error;
    this.room = result.state;
    await this.ctx.storage.put("room", this.room);
    // 밤 이모티콘도 같은 범위다(밤 채팅과 한 규칙).
    const emoji: ServerMessage = { t: "emoji", ...result.event };
    if (this.room.phase === "night") this.broadcastEventTo(emoji, nightChatRecipientIds(this.room));
    else this.broadcastEvent(emoji);
    return null;
  }

  // 직업 선택: 신원은 소켓 첨부의 playerId 뿐이다 — 메시지에서 seat 를 읽지 않는다(T-02-16).
  private async handleClaim(ws: WebSocket, claim: Claim): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const error = await this.applyClaim(att.playerId, claim);
    if (error !== null) this.sendRejection(ws, att.playerId, error);
  }

  // 직업 주장 본체(결정 0023, 0027): selectClaim 이 차례·값을 검사하고 마감을 now 로 당기면, 그 위에서 tick 을 한 번 더 불러
  // 정상 마감과 같은 경로(ON_DEADLINE → 다음 차례, 마지막이면 낮 토론)로 넘긴다. 공개 주장은 모두에게 같은 정보라 전원에게 방송한다.
  // claim 은 마감을 바꾼다(차례가 끝나므로): 결정 0020 의 pick(마감 불변)과 다르다. 그래서 reschedule 로 알람을 새 마감으로 옮기고,
  // 다음 차례가 봇이면 봇 계획도 그 차례 키로 새로 선다. 사람과 봇이 같은 본체를 쓴다(결정 0024-6).
  private async applyClaim(playerId: string, claim: Claim): Promise<WsErrorCode | null> {
    if (!this.room) return "BAD_MESSAGE";
    const now = Date.now();
    const result = selectClaim(this.room, playerId, claim, now);
    if (!result.ok) return result.error;
    this.room = tick(result.state, now, cryptoRandInt);
    await this.persistAndBroadcast();
    await this.reschedule();
    return null;
  }

  // 밤 행동: 신원은 소켓 첨부의 playerId 뿐이고 행동 종류는 서버 저장 역할이 정한다(T-03-22).
  private async handlePick(ws: WebSocket, target: number): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const error = await this.applyPick(att.playerId, target);
    if (error !== null) this.sendRejection(ws, att.playerId, error);
  }

  // 마감이 바뀌지 않으니 reschedule 은 필요 없다(NIGHT-05). 같은 값을 다시 고르면 같은 객체라 저장·전송도 하지 않는다.
  // 받아들여지면 전원 방송 대신 받는 사람에게만 state 를 보낸다 — 전원 방송은 행동 타이밍을 흘린다(RESEARCH Pitfall 1).
  private async applyPick(playerId: string, target: number): Promise<WsErrorCode | null> {
    if (!this.room) return "BAD_MESSAGE";
    const result = pickTarget(this.room, playerId, target);
    if (!result.ok) return result.error;
    if (result.state === this.room) return null;
    this.room = result.state;
    await this.ctx.storage.put("room", this.room);
    this.sendViewTo(pickRecipientIds(this.room, playerId));
    return null;
  }

  // 처형 여부 투표: 신원은 소켓 첨부의 playerId 뿐이다 — 메시지에 seat·id 가 없다(T-04-03).
  private async handleExecVote(ws: WebSocket, agree: boolean): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const error = await this.applyExecVote(att.playerId, agree);
    if (error !== null) this.sendRejection(ws, att.playerId, error);
  }

  // 마감이 바뀌지 않으니 reschedule 은 필요 없다(D-28). 같은 값을 다시 보내면 같은 객체라 저장·전송도 하지 않는다.
  // 받아들여지면 pick 과 달리 모든 소켓이 각자 view 를 받는다: 집계 수(day.execTally)는 모두에게 공개되는 실시간 정보이고(D-02),
  // 개인 표는 view 허용 목록이 본인 프레임(me.voteAgree)으로만 제한한다. 받는 사람을 줄이면 오히려 집계가 모두에게 같지 않게 된다.
  private async applyExecVote(playerId: string, agree: boolean): Promise<WsErrorCode | null> {
    if (!this.room) return "BAD_MESSAGE";
    const result = castExecVote(this.room, playerId, agree);
    if (!result.ok) return result.error;
    if (result.state === this.room) return null;
    this.room = result.state;
    await this.persistAndBroadcast();
    return null;
  }

  // 후보 선택 투표: 신원은 소켓 첨부의 playerId 뿐이다 — 메시지에 seat·id 가 없다(T-04-23).
  private async handleCandidateVote(ws: WebSocket, target: number): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const error = await this.applyCandidateVote(att.playerId, target);
    if (error !== null) this.sendRejection(ws, att.playerId, error);
  }

  // 마감이 바뀌지 않으니 reschedule 은 필요 없다(D-28). 같은 값을 다시 보내면 같은 객체라 저장·전송도 하지 않는다.
  // 받아들여지면 투표자 본인 한 명에게만 state 를 보낸다: 여부 투표(전원 방송, 집계가 모두에게 공개)와 달리 후보 선택은 진행 중에 공개 집계가 없고
  // (공개는 공개 구간에서 서버가 정한 순서로 한 번에), 전원 방송은 "누가 언제 골랐는지" 타이밍을 흘린다(Pitfall 7).
  // 관전자(탈락자)에게도 보내지 않는다 — 탈락자는 투표 자격이 없고 남의 진행을 알 이유가 없다(A7, 결정 0036 기본값. 바꾸려면 이 한 곳).
  private async applyCandidateVote(playerId: string, target: number): Promise<WsErrorCode | null> {
    if (!this.room) return "BAD_MESSAGE";
    const result = castCandidateVote(this.room, playerId, target);
    if (!result.ok) return result.error;
    if (result.state === this.room) return null;
    this.room = result.state;
    await this.ctx.storage.put("room", this.room);
    this.sendViewTo([playerId]);
    return null;
  }

  // 서버 봇 행동 실행(결정 0024): 때가 된 행동을 꺼내 남은 계획을 먼저 저장하고, 봇 id 로 같은 apply* 를 부른다.
  // 거부(RATE_LIMITED 포함)는 버린다 — 알릴 소켓이 없을 뿐 사람 메시지가 거부된 것과 같다.
  private async runDueBots(now: number): Promise<void> {
    if (!this.room) return;
    const { state, due } = takeDueBotSteps(this.room, now);
    if (due.length === 0) return;
    this.room = state;
    await this.ctx.storage.put("room", this.room);
    for (const step of due) await this.actAsBot(step);
  }

  private async actAsBot(step: BotStep): Promise<void> {
    const act = step.act;
    switch (act.t) {
      case "claim":
        await this.applyClaim(step.botId, act.claim);
        return;
      case "say":
        await this.applySay(step.botId, { template: act.template, target: act.target, claimedRole: act.claimedRole });
        return;
      case "emoji":
        await this.applyEmoji(step.botId, act.icon);
        return;
      case "pick":
        await this.applyPick(step.botId, act.target);
        return;
      default: {
        // 새 봇 행동을 BotAct 에 더하고 여기를 빠뜨리면 컴파일이 실패한다(Pitfall 15).
        const unhandled: never = act;
        void unhandled;
        return;
      }
    }
  }

  // 테스트 방 방장 도구(결정 0022). 신원은 소켓 첨부의 playerId 뿐이다 — 메시지에서 seat·방장 여부를 읽지 않는다.
  // 일반 방은 error 프레임만(state·저장·방송 없음): 이 기능이 없는 방에서는 알 수 없는 메시지와 같게 보인다.
  // 그 밖의 거부는 sendRejection(오류 + 그 소켓에만 최신 state).
  private rejectTestTool(ws: WebSocket, playerId: string, code: WsErrorCode): void {
    if (code === "BAD_MESSAGE" && this.room?.testMode !== true) this.sendTo(ws, { t: "error", code });
    else this.sendRejection(ws, playerId, code);
  }

  // 다음 단계로 넘기기: 마감을 지금으로 당겨 tick 으로 정상 마감과 같은 경로를 탄다. 모든 소켓이 각자 view 를 받고 알람이 새 마감으로 옮겨진다.
  private async handleTestSkip(ws: WebSocket): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const result = skipPhase(this.room, att.playerId, Date.now(), cryptoRandInt);
    if (!result.ok) {
      this.rejectTestTool(ws, att.playerId, result.error);
      return;
    }
    this.room = result.state;
    await this.persistAndBroadcast();
    await this.reschedule();
  }

  // 대기실로 되돌리기: 같은 방·같은 사람(소켓은 닫지 않는다). 알람은 방 만료로 옮겨진다.
  private async handleTestReset(ws: WebSocket): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const result = resetToLobby(this.room, att.playerId);
    if (!result.ok) {
      this.rejectTestTool(ws, att.playerId, result.error);
      return;
    }
    this.room = result.state;
    await this.persistAndBroadcast();
    await this.reschedule();
  }

  // 내 직업 고르기: 성공하면 방장 소켓에만 state 를 보낸다(대기실의 다른 사람 view 는 바뀌지 않는다). 같은 값이면 저장·전송하지 않는다.
  private async handleTestRole(ws: WebSocket, role: RoleId | null): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const result = setTestRole(this.room, att.playerId, role);
    if (!result.ok) {
      this.rejectTestTool(ws, att.playerId, result.error);
      return;
    }
    if (result.state === this.room) return;
    this.room = result.state;
    await this.ctx.storage.put("room", this.room);
    this.sendViewTo([att.playerId]);
  }

  // 서버 봇 수 맞추기(결정 0024): 대기실 인원이 바뀌므로 모든 소켓이 각자 view 를 받는다. 같은 수(잘린 결과가 지금과 같음)면 저장·전송하지 않는다.
  private async handleTestBots(ws: WebSocket, count: number): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const result = setBotCount(this.room, att.playerId, count, () => crypto.randomUUID());
    if (!result.ok) {
      this.rejectTestTool(ws, att.playerId, result.error);
      return;
    }
    if (result.state === this.room) return;
    this.room = result.state;
    await this.persistAndBroadcast();
    await this.reschedule();
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
    // 난수는 여기서만 넣는다 — 아침 판정(03-03)의 동률·문구 추첨
    const next = tick(room, now, cryptoRandInt);
    if (next === room) return;
    this.room = next;
    await this.persistAndBroadcast();
    await this.reschedule();
  }

  // 알람은 DO 당 하나라 단계 마감·방 만료·다음 봇 행동 중 가장 이른 시각을 여기서만 설정한다.
  // 단계가 바뀌는 모든 경로(advance·start·testSkip·testReset·leave)가 이 함수를 지나므로 봇 계획도 여기서 지금 단계에 맞춘다(결정 0024).
  // 봇이 없는 방은 syncBotPlan 이 같은 객체를 돌려주고 botWakeAt 이 null 이라 알람이 예전과 같다.
  private async reschedule(): Promise<void> {
    if (!this.room) return;
    const synced = syncBotPlan(this.room, Date.now(), cryptoRandInt);
    if (synced !== this.room) {
      this.room = synced;
      await this.ctx.storage.put("room", this.room);
    }
    const botAt = botWakeAt(this.room);
    const wake = nextWakeAt(this.room);
    await this.ctx.storage.setAlarm(botAt === null ? wake : Math.min(wake, botAt));
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
      await this.runDueBots(Date.now());
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

  // 밤 행동 뒤 state 는 행위자 쪽과 관전자에게만 — 전원 방송은 행동 타이밍을 흘린다(RESEARCH Pitfall 1).
  // broadcast 와 같은 소켓 순회에서 첨부 playerId 가 ids 에 있는 소켓에만 그 사람의 뷰를 보낸다.
  private sendViewTo(ids: Iterable<string>): void {
    const room = this.room;
    if (!room) return;
    const allowed = new Set(ids);
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as SocketAttachment | null;
      if (!att || !allowed.has(att.playerId) || !room.players.some((p) => p.id === att.playerId)) continue;
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

  // broadcastEvent 와 같은 소켓 순회에서 첨부 playerId 가 ids 에 있는 소켓에만 보낸다(밤 채팅·이모티콘).
  private broadcastEventTo(msg: ServerMessage, ids: ReadonlySet<string>): void {
    const room = this.room;
    if (!room) return;
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as SocketAttachment | null;
      if (!att || !ids.has(att.playerId) || !room.players.some((p) => p.id === att.playerId)) continue;
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
