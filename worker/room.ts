import { DurableObject } from "cloudflare:workers";
import { CLOSE_CODES, MAX_FRAME_BYTES } from "../shared/protocol";
import type { ApiErrorCode, BotVoteExec, BotVotePick, ChatRejectWhy, ClientMessage, RemovedReason, RoomPreview, ServerMessage, WorldFrame, WsErrorCode } from "../shared/protocol";
import { botMafiaTarget, botWakeAt, isBot, syncBotPlan, takeDueBotSteps } from "../shared/game/bots";
import type { BotStep } from "../shared/game/bots";
import { isAlive } from "../shared/game/alive";
import { audience, channelOf, phaseKey, worldVisibleTo } from "../shared/game/audience";
import { CHAT_KEY_PREFIX, appendLine, chatKey, emptyChatLog, replayFor, restoreChatLog, seatMask, toWire } from "../shared/game/chatLog";
import type { ChatLog } from "../shared/game/chatLog";
import { checkChatSend, sanitizeChatText, typingRelay } from "../shared/game/chatRules";
import type { ChatSenderRate, TypingRelayState } from "../shared/game/chatRules";
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
import { pickRecipientIds, pickTarget } from "../shared/game/night";
import { WILL_MIN_GAP_MS, noteRecipientIds, saveNote, saveWill } from "../shared/game/will";
import { resetToLobby, setBotCount, setBotVote, setTestRole, skipPhase } from "../shared/game/testTools";
import type { RoleId } from "../shared/game/roles";
import { nextWakeAt, tick } from "../shared/game/tick";
import { castPoint } from "../shared/game/nomination";
import { castVerdict } from "../shared/game/verdict";
import { endReached, toggleEnd } from "../shared/game/discussion";
import { MAP_PHASES, canMove } from "../shared/game/movement";
import { layoutFor, layoutKey } from "../shared/game/gather";
import { BAR_MAP, STAGE_SPOT } from "../shared/game/map";
import { APPROACH_DIST_FX, WORLD_FLUSH_MS, approachPoint, captureHome, compactWorld, despawnPlayer, emptyWorld, forceSegment, moveFrame, nextWanderAt, planMoveSegment, planWander, positionAtFx, requestMove, respawnAll, restoreWorld, snapFrame, spawnPlayer, teleportHome } from "../shared/game/world";
import type { Segment, WorldState } from "../shared/game/world";
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
// 지목 간격(결정 0060-3, DAY-04): 같은 사람의 받아들인 지목 사이 최소 간격.
const POINT_MIN_INTERVAL_MS = 250;
// DO storage.delete(keys[]) 의 한 번 최대 키 수.
const CHAT_DELETE_MAX = 128;

interface RateWindow {
  windowStart: number;
  count: number;
  warned: boolean;
}

// 방 하나 = Durable Object 하나(이름 = 4자리 코드). 상태는 단일 키 "room" 에 영속하고,
// 소켓은 하이버네이션 API(acceptWebSocket)로 받는다.
export class Room extends DurableObject<Env> {
  private room: RoomState | null = null;
  // 로비 이동 상태(06-08). room 키와 분리된 storage "world" 키에 저장한다 — 위치가 room 키를 매번 다시 쓰지 않게(RESEARCH R6).
  private world: WorldState = emptyWorld();
  // 위치 저장 디바운스 타이머(인메모리). 하이버네이션·퇴거로 사라져도 잃는 것은 마지막 2초의 탭뿐이다(RESEARCH A6).
  private worldFlushTimer: ReturnType<typeof setTimeout> | null = null;
  // 인메모리라 하이버네이션으로 비면 새로 센다(수용). 소켓 객체가 키라 hello 전 소켓도 센다.
  private readonly rates = new WeakMap<WebSocket, RateWindow>();
  // 입력 중 중계 기록(사람 id -> 마지막 켜짐 중계). 인메모리라 하이버네이션으로 비면 새로 센다 — 결과는 신호가 한 번 더 중계될 뿐이다(수용, A2).
  // 서버는 입력 중 타이머를 두지 않는다(A1): 만료는 받는 쪽 4.5초와 보내는 쪽 4초 무입력이 맡는다.
  private readonly typingRelays = new Map<string, TypingRelayState>();
  // 채팅 줄 보관(결정 0058): 메모리 사본이다. 채널별 seq·수신자 마스크를 appendLine 이 정하고, 줄 하나가 storage 키 하나(chat:000001…)로 저장된다.
  // room 키와 분리해 둔다(입장·시작마다 room 이 통째로 다시 쓰이기 때문, world 키와 같은 이유). 생성자가 chat: 키를 모두 읽어 같은 줄·같은 다음 seq 로 되살린다.
  private chatLog: ChatLog = emptyChatLog();
  // 사람(봇 포함)별 최근 전송 기록(D5 도배 제한). 인메모리라 하이버네이션으로 비면 새로 센다(수용) — 제한이 한 번 느슨해질 뿐이다.
  private readonly chatRates = new Map<string, ChatSenderRate>();
  // 지목 간격 기록(사람 id -> 마지막으로 받아들인 지목 ms, DAY-04 결정 0060-3, 가정 A1). 인메모리라 하이버네이션으로 비면 새로 센다 —
  // 한 번 더 받아들일 뿐이다(수용, typingRelays 와 같다). 받아들인 지목만 기록하고 거절·같은 값·간격 안 재전송은 기록하지 않는다.
  private readonly pointAt = new Map<string, number>();
  // 유언·쪽지 저장 간격 기록(키 `will:{id}`·`note:{id}` -> 마지막으로 받아들인 저장 ms, 결정 0061-10, 가정 A1, T-09-27). 인메모리라 하이버네이션으로 비면 새로 센다 — 한 번 더 받아들일 뿐이다(수용).
  // 받아들여 상태가 바뀐 저장만 기록하고, 거절·같은 값은 기록하지 않는다. 간격 안의 요청은 오류 프레임 없이 버린다.
  private readonly writeAt = new Map<string, number>();
  // 새 유령 snap 을 이미 보낸 사람 id(08-09, 가정 A1). 인메모리라 하이버네이션·퇴거로 비면 유령에게 snap 이 한 번 더 갈 뿐이다(유령에게만, 무해).
  private readonly ghostSnapped = new Set<string>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // 알람은 평소에 여기서 설정하지 않는다 — 대기 중인 알람을 덮어쓴다. 예외는 옛 저장 방 정규화로 마감이 바뀐 경우뿐이다(아래).
    ctx.blockConcurrencyWhile(async () => {
      // room·world 를 한 번에 읽는다(06-08). 위치는 room 키와 분리된 별도 키다.
      const got = await ctx.storage.get(["room", "world"]);
      const stored = (got.get("room") as RoomState | undefined) ?? null;
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
        // 저장된 위치를 되살린다. world 키가 없거나 손상된 사람은 입장 지점에 선다(MAP-05).
        this.world = restoreWorld(got.get("world"), this.room.players, Date.now(), BAR_MAP);
        if (normalized !== stored) {
          await ctx.storage.put("room", this.room);
          // 정규화로 생긴 이른 마감(now + 2초)이 기존 만료 알람(90초 뒤 등)보다 먼저 깨어나야 하므로 마감이 바뀐 경우에만 여기서 알람을 건다.
          // 옛 messages 키만 지운 경우(결정 0017-7)는 마감이 그대로라 대기 중인 알람을 건드리지 않는다.
          if (normalized.phaseEndsAt !== stored.phaseEndsAt) await ctx.storage.setAlarm(nextWakeAt(this.room));
        }
        // 보관 줄을 되살린다(MAP-05 와 같은 복원 규칙, 결정 0058-1). 손상 레코드는 restoreChatLog 가 버린다. 방이 없으면 줄도 없다.
        const lines = await ctx.storage.list({ prefix: CHAT_KEY_PREFIX });
        this.chatLog = restoreChatLog(lines.values());
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
    // 방장은 seat 0 의 입장 지점에 선다(MAP-01). 연결된 소켓이 아직 없어 보낼 프레임은 없다.
    this.world = spawnPlayer(emptyWorld(), hostId, 0, input.now, BAR_MAP);
    this.markWorldDirty();
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
    // 새 사람은 자기 seat 의 입장 지점에 서고, 이미 연결된 소켓은 state 다음에 그 한 점 구간을 받는다(MAP-01).
    this.world = spawnPlayer(this.world, result.player.id, result.player.seat, Date.now(), BAR_MAP);
    const seg = this.world.segs[result.player.id];
    if (seg) this.emitWorld(moveFrame(result.player.seat, seg));
    this.markWorldDirty();
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
      case "pick":
        await this.handlePick(ws, msg.target);
        return;
      case "endDiscussion":
        await this.handleEndDiscussion(ws, msg.on);
        return;
      case "point":
        await this.handlePoint(ws, msg.target);
        return;
      case "verdict":
        await this.handleVerdict(ws, msg.agree);
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
      case "testBotVote":
        await this.handleTestBotVote(ws, msg.exec, msg.pick);
        return;
      case "move":
        this.handleMove(ws, msg.x, msg.z);
        return;
      case "typing":
        this.handleTyping(ws, msg.on, msg.pk);
        return;
      case "chat":
        await this.handleChat(ws, msg.text, msg.pk);
        return;
      case "will":
        await this.handleWill(ws, msg.text);
        return;
      case "note":
        await this.handleNote(ws, msg.text);
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
      this.dropWorld();
      this.dropChat();
      this.ghostSnapped.clear();
      return;
    }
    this.room = result.state;
    this.world = despawnPlayer(this.world, att.playerId);
    await this.persistAndBroadcast();
    await this.reschedule();
    await this.flushWorld();
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
    this.world = despawnPlayer(this.world, result.removedId);
    await this.persistAndBroadcast();
    await this.flushWorld();
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
    // 로비를 떠나는 시작: 위치를 지금 저장하고 그대로 둔다(가정 A1). 이후 world 프레임은 나가지 않는다.
    // 알람(단계 마감) 재설정이 먼저다 — 저장 쓰기 때문에 마감 알람이 늦어지지 않게.
    await this.flushWorld();
  }

  // 밤 행동·투표는 "소켓 껍데기(handleX)" 와 "본체(applyX)" 로 나뉜다(결정 0024). 자유 채팅(handleChat·applyChat)도 같은 모양이다.
  // 껍데기는 소켓 첨부에서 playerId 를 얻고 거부를 그 소켓에 알린다. 본체는 같은 규칙 함수·같은 저장·방송을 하고 실패 코드를 돌려준다.
  // 서버 봇은 본체만 부른다 — 사람과 같은 검증을 거치고(특권 없음), 거부는 알릴 소켓이 없어 버린다.

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

  // 유언(9페이즈, WILL-01, 결정 0061-10): 신원은 소켓 첨부의 playerId 뿐이다 — 메시지에 seat·id 가 없다(T-09-28).
  private async handleWill(ws: WebSocket, text: string): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const error = await this.applyWill(att.playerId, text, Date.now());
    if (error !== null) this.sendRejection(ws, att.playerId, error);
  }

  // 마감이 바뀌지 않으니 reschedule 은 필요 없다. 검사는 규칙 함수(saveWill)가 하고, 받아들이면 저장한 본인 소켓에만 state 를 보낸다 —
  // persistAndBroadcast 를 부르지 않는다(L7): 전원 방송이나 '누군가 썼다' 는 타이밍이 다른 폰에 새면 안 된다. 같은 값은 같은 객체라 저장·전송이 없다.
  // 간격(WILL_MIN_GAP_MS) 안의 요청은 상태를 바꾸지 않고 오류 없이 버린다(T-09-27). 봇도 같은 본체를 지난다(특권 없음).
  private async applyWill(playerId: string, text: string, now: number): Promise<WsErrorCode | null> {
    if (!this.room) return "BAD_MESSAGE";
    const key = `will:${playerId}`;
    const last = this.writeAt.get(key);
    if (last !== undefined && now - last < WILL_MIN_GAP_MS) return null;
    const result = saveWill(this.room, playerId, text);
    if (!result.ok) return result.error;
    if (result.state === this.room) return null;
    this.writeAt.set(key, now);
    this.room = result.state;
    await this.ctx.storage.put("room", this.room);
    this.sendViewTo([playerId]);
    return null;
  }

  // 쪽지(9페이즈, NIGHT-12, 결정 0061-9): 신원은 소켓 첨부의 playerId 뿐이고 쪽지에 작성자는 저장하지 않는다(익명).
  private async handleNote(ws: WebSocket, text: string): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const error = await this.applyNote(att.playerId, text, Date.now());
    if (error !== null) this.sendRejection(ws, att.playerId, error);
  }

  // applyWill 과 같은 모양이다. 받아들이면 산 마피아 소켓에만 state 를 보낸다 — 유령에게도 보내지 않는다(쪽지는 아침 카드가 공개 시점, L7).
  // persistAndBroadcast 를 부르지 않는다. 간격 키는 `note:{id}` — 마피아마다 따로라 B 가 A 직후에 덮어쓸 수 있다(마지막 저장이 이김).
  private async applyNote(playerId: string, text: string, now: number): Promise<WsErrorCode | null> {
    if (!this.room) return "BAD_MESSAGE";
    const key = `note:${playerId}`;
    const last = this.writeAt.get(key);
    if (last !== undefined && now - last < WILL_MIN_GAP_MS) return null;
    const result = saveNote(this.room, playerId, text);
    if (!result.ok) return result.error;
    if (result.state === this.room) return null;
    this.writeAt.set(key, now);
    this.room = result.state;
    await this.ctx.storage.put("room", this.room);
    this.sendViewTo(noteRecipientIds(this.room));
    return null;
  }

  // 지목(8페이즈, DAY-04): 신원은 소켓 첨부의 playerId 뿐이다 — 메시지에 seat·id 가 없다(T-08-04).
  private async handlePoint(ws: WebSocket, target: number): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const error = await this.applyPoint(att.playerId, target, Date.now());
    if (error !== null) this.sendRejection(ws, att.playerId, error);
  }

  // 마감이 바뀌지 않으니 reschedule 은 필요 없다(과반이어도 15초를 다 채운다, 결정 0060-3). 검사는 규칙 함수(castPoint)가 먼저다 —
  // 같은 값은 같은 객체라 저장·전송이 없고, 거절은 간격 기록에 닿지 않는다. 받아들일 값이 같은 사람의 마지막 수락 250ms 안이면 상태를 바꾸지 않고
  // 그 사람 소켓에만 서버 값 view 를 돌려준다(오류 프레임 없음, T-08-08 연타 방어). 받아들이면 지목 줄은 모두에게 공개라 모든 소켓이 각자 view 를 받는다.
  private async applyPoint(playerId: string, target: number, now: number): Promise<WsErrorCode | null> {
    if (!this.room) return "BAD_MESSAGE";
    const result = castPoint(this.room, playerId, target);
    if (!result.ok) return result.error;
    if (result.state === this.room) return null;
    const last = this.pointAt.get(playerId);
    if (last !== undefined && now - last < POINT_MIN_INTERVAL_MS) {
      this.sendViewTo([playerId]);
      return null;
    }
    this.pointAt.set(playerId, now);
    this.room = result.state;
    await this.persistAndBroadcast();
    return null;
  }

  // 찬반(8페이즈, DAY-06): 신원은 소켓 첨부의 playerId 뿐이다(T-08-04).
  private async handleVerdict(ws: WebSocket, agree: boolean): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const error = await this.applyVerdict(att.playerId, agree);
    if (error !== null) this.sendRejection(ws, att.playerId, error);
  }

  // 마감을 건드리지 않는다(조기 종료 없음 — 모두가 일찍 던져도 10초를 다 채운다, 결정 0060-4). 같은 값을 다시 보내면 같은 객체라 저장·전송이 없다.
  // 방송 규율(결정 0053·0060-4, T-08-02): 그 사람의 첫 투표는 day.voted(던진 사람 목록)가 모두에게 바뀌므로 모든 소켓이 각자 view 를 받는다.
  // 이미 던진 사람이 값을 바꾸면 공개 값(day.voted)은 그대로이고 바뀌는 것은 본인 값(me.verdictVote)뿐이다 — 전원에게 보내면 '누군가 마음을 바꿨다' 는 타이밍이 샌다.
  // 그래서 저장하고 본인 소켓에만 view 를 보낸다(applyCandidateVote 와 같은 모양).
  private async applyVerdict(playerId: string, agree: boolean): Promise<WsErrorCode | null> {
    if (!this.room) return "BAD_MESSAGE";
    const castBefore = this.room.players.find((p) => p.id === playerId)?.verdictVote !== undefined;
    const result = castVerdict(this.room, playerId, agree);
    if (!result.ok) return result.error;
    if (result.state === this.room) return null;
    this.room = result.state;
    if (!castBefore) {
      await this.persistAndBroadcast();
      return null;
    }
    await this.ctx.storage.put("room", this.room);
    this.sendViewTo([playerId]);
    return null;
  }

  // 토론 끝내기(8페이즈, DAY-03): 신원은 소켓 첨부의 playerId 뿐이다(T-08-04).
  private async handleEndDiscussion(ws: WebSocket, on: boolean): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const error = await this.applyEndDiscussion(att.playerId, on, Date.now());
    if (error !== null) this.sendRejection(ws, att.playerId, error);
  }

  // 개수(day.endCount)는 모두에게 공개되는 실시간 정보라 바뀔 때마다 모든 소켓이 각자 view 를 받는다(누른 본인 값은 view 허용 목록이 me.endDiscussion 으로만 싣는다). 같은 값이면 같은 객체라 저장·전송이 없다.
  // 과반(endReached)에 닿는 순간 서버가 마감을 지금으로 당겨 tick 으로 정상 마감과 같은 경로를 탄다(handleTestSkip 과 같다) — 새 마감은 now + 다음 단계 길이이고 알람이 따라 옮겨진다.
  // 유령·단계 틀림은 규칙 함수가 BAD_MESSAGE·WRONG_PHASE 로 거절한다.
  private async applyEndDiscussion(playerId: string, on: boolean, now: number): Promise<WsErrorCode | null> {
    if (!this.room) return "BAD_MESSAGE";
    const result = toggleEnd(this.room, playerId, on);
    if (!result.ok) return result.error;
    if (result.state === this.room) return null;
    if (endReached(result.state)) {
      const prev = this.room;
      this.room = tick({ ...result.state, phaseEndsAt: now }, now, cryptoRandInt);
      await this.afterTransition(prev, now);
      return null;
    }
    this.room = result.state;
    await this.persistAndBroadcast();
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
    const room = this.room;
    if (!room) return;
    switch (act.t) {
      // 자유 채팅도 사람과 같은 본체를 지난다(특권 없음, 결정 0024): 단계 키는 지금 서버 단계에서 만들고, 거절(phase·D5)은 알릴 소켓이 없어 버린다.
      case "chat":
        await this.applyChat(step.botId, act.text, phaseKey({ phase: room.phase, day: room.day }), Date.now());
        return;
      // 마피아 봇은 실행 시점 상태로 대상을 다시 구한다(결정 0061-18): 동료(사람 포함)가 먼저 고른 대상을 따라간다. 값이 없으면 계획의 대상.
      // 같은 applyPick 본체를 지나므로 특권이 없다(결정 0024-6).
      case "pick": {
        const bot = room.players.find((p) => p.id === step.botId);
        const target = bot?.role === "mafia" ? (botMafiaTarget(room, bot) ?? act.target) : act.target;
        await this.applyPick(step.botId, target);
        return;
      }
      // 8페이즈(결정 0060-13): 토론 끝내기·지목·찬반도 사람과 같은 본체를 지난다(특권 없음, 결정 0024-6). 거부는 알릴 소켓이 없어 버린다.
      case "endDiscussion":
        await this.applyEndDiscussion(step.botId, true, Date.now());
        return;
      // 9페이즈(결정 0061-18): 유언 한 줄은 사람과 같은 applyWill 본체를 지난다(500ms 간격·단계·생존 검사, 특권 없음). 거부는 버린다.
      case "will":
        await this.applyWill(step.botId, act.text, Date.now());
        return;
      // 마피아 봇 다가가기: 실행 시점 대상(botMafiaTarget, 없으면 계획의 대상) 곁 APPROACH_DIST_FX 점으로 사람과 같은 applyMove(단계·150ms·걷기 가능 칸 보정)를 지난다.
      // 대상·봇의 위치는 서버 world 구간에서 읽는다(시각 기준 위치). 어느 쪽이든 구간이 없으면 조용히 버린다.
      case "approach": {
        const bot = room.players.find((p) => p.id === step.botId);
        if (!bot) return;
        const targetSeat = botMafiaTarget(room, bot) ?? act.target;
        const target = room.players.find((p) => p.seat === targetSeat);
        const botSeg = Object.prototype.hasOwnProperty.call(this.world.segs, bot.id) ? this.world.segs[bot.id] : undefined;
        const targetSeg = target && Object.prototype.hasOwnProperty.call(this.world.segs, target.id) ? this.world.segs[target.id] : undefined;
        if (!botSeg || !targetSeg) return;
        const now = Date.now();
        this.applyMove(bot.id, approachPoint(positionAtFx(targetSeg, now), positionAtFx(botSeg, now), APPROACH_DIST_FX), now);
        return;
      }
      case "point":
        await this.applyPoint(step.botId, act.target, Date.now());
        return;
      case "verdict":
        await this.applyVerdict(step.botId, act.agree);
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
    const prev = this.room;
    this.room = result.state;
    await this.afterTransition(prev, Date.now());
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
    // 보관 줄도 모두 지운다(결정 0058-7): 저장소 키 → 메모리 사본·도배 기록·입력 중 기록. 다음 hello 의 chatLog 는 비고 첫 줄은 seq 1 이다.
    await this.deleteChatKeys([...(await this.ctx.storage.list({ prefix: CHAT_KEY_PREFIX })).keys()]);
    this.dropChat();
    this.ghostSnapped.clear();
    // 대기실로 돌아오면 모두 자기 입장 지점으로 되돌린다(가정 A1, 11페이즈 다시 하기가 같은 길). state 다음에 모든 소켓이 snap 을 받는다.
    const now = Date.now();
    this.world = respawnAll(this.world, this.room.players, now, BAR_MAP);
    await this.persistAndBroadcast();
    this.emitWorld(snapFrame(this.world, this.room.players, now));
    await this.reschedule();
    await this.flushWorld();
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

  // 봇 투표 규칙 고르기(P-13): handleTestRole 과 같다 — 성공하면 방장 소켓에만 state 를 보내고, 같은 값이면 저장·전송하지 않는다. 마감이 안 바뀌어 알람은 그대로다.
  private async handleTestBotVote(ws: WebSocket, exec: BotVoteExec, pick: BotVotePick): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const result = setBotVote(this.room, att.playerId, exec, pick);
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
    const spawned = this.syncWorldPlayers(Date.now());
    await this.persistAndBroadcast();
    // 새 봇은 자기 seat 의 입장 지점에 서고, 방장 소켓은 state 다음에 그 한 점 구간을 받는다. 뺀 봇은 world 에서 지워졌다.
    for (const { seat, seg } of spawned) this.emitWorld(moveFrame(seat, seg));
    this.markWorldDirty();
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
      this.dropWorld();
      this.dropChat();
      this.ghostSnapped.clear();
      return;
    }
    // 난수는 여기서만 넣는다 — 아침 판정(03-03)의 동률·문구 추첨
    const next = tick(room, now, cryptoRandInt);
    if (next !== room) {
      this.room = next;
      await this.afterTransition(room, now);
      return;
    }
    // 위치는 단계가 바뀌었는지와 무관하게 '지금 단계가 요구하는 모습'으로 맞춘다(멱등, 알람 따라잡기·퇴거에도 안전).
    // 새 유령 snap 은 전환 때만 보낸다: 퇴거로 비워진 ghostSnapped 때문에 깨어날 때마다 같은 snap 을 다시 보내지 않는다(08 동작 유지).
    await this.syncHome(now);
    this.syncLayout(now);
  }

  // 단계 전환 뒤처리 한 곳(결정 0061-19): 단계 마감(advance)·토론 끝내기(applyEndDiscussion)·테스트 넘기기(handleTestSkip)가 모두 여기를 지난다.
  // 순서가 계약이다: home 기억(지목 배치보다 먼저, 즉시 저장) → 분필 좌표(저장·방송 전에 채워 모든 view 가 같은 값을 싣는다) → 저장·방송
  // → 위치 동기화(밤·아침 home → 새 유령 snap → 지목 배치) → 사망 카드(유언·쪽지, 결정 0061-11) → 알람.
  // prev 는 전환 전 상태다 — 사망은 전후 alive 비교로 찾는다(처형·암살 한 길, 알람 따라잡기로 여러 단계를 지나도 사망마다 한 번).
  private async afterTransition(prev: RoomState, now: number): Promise<void> {
    if (this.captureHomeNow()) await this.flushWorld();
    await this.persistAndBroadcast();
    await this.syncPositions(now);
    await this.emitDeathCards(prev, now);
    await this.reschedule();
  }

  // 이번 전환에서 산 사람 → 탈락이 된 사람의 seat 들(seat 오름차순).
  private diedSeats(prev: RoomState): number[] {
    const room = this.room;
    if (!room) return [];
    return room.players
      .filter((p) => !isAlive(p) && prev.players.some((q) => q.id === p.id && isAlive(q)))
      .map((p) => p.seat)
      .sort((a, b) => a - b);
  }

  // 사망 카드(WILL-01·NIGHT-12·MORN-02, 결정 0061-11): 이번 전환에서 탈락한 사람마다 유언이 있으면 will 카드, 그 밤 피해자의 쪽지가 있으면 맨 끝에 note 카드.
  // 그 밤 피해자의 유언은 다른 사망(앞선 처형)보다 뒤에 둔다. 카드는 서버가 한 번만 만들고 작성자 정보는 없다(seat = 피해자).
  private async emitDeathCards(prev: RoomState, now: number): Promise<void> {
    const room = this.room;
    if (!room) return;
    for (const seat of this.diedSeats(prev)) {
      const will = room.players.find((p) => p.seat === seat)?.will;
      if (will !== undefined && will !== "") await this.appendCard(seat, will, "will", now);
    }
  }

  // 카드 한 줄: applyChat 본체와 같은 모양(받는 사람·마스크 한 번 → 보관 → 저장 → 전송)이되 도배·문장 검사는 부르지 않는다(사람이 보낸 줄이 아니다).
  private async appendCard(seat: number, text: string, k: "will" | "note", now: number): Promise<void> {
    const room = this.room;
    if (!room) return;
    const ids = audience(room, { k: "chat", ch: "all" });
    if (ids.size === 0) return;
    const r = seatMask(room.players, ids);
    const appended = appendLine(this.chatLog, { ch: "all", seat, text, at: now, n: room.day ?? 0, r, k });
    this.chatLog = appended.log;
    await this.ctx.storage.put(chatKey(appended.record.g), appended.record);
    if (appended.evicted.length > 0) await this.deleteChatKeys(appended.evicted.map(chatKey));
    this.deliver(ids, { t: "chat", ...toWire(appended.record) });
  }

  // 그날 처음으로 걷기 단계(dayAnnounce·discussion)를 벗어난 지도 단계에 들어오면 각자 토론이 끝난 자리를 기억한다(결정 0061-5).
  // captureHome 이 같은 일차면 입력을 그대로 돌려주므로(멱등) 지목 → 변론 → 밤처럼 이어지는 단계에서 자리를 덮지 않는다. 바뀌었으면 true.
  private captureHomeNow(): boolean {
    const room = this.room;
    if (!room || room.day === undefined) return false;
    if (!MAP_PHASES.has(room.phase) || room.phase === "dayAnnounce" || room.phase === "discussion") return false;
    const next = captureHome(
      this.world,
      room.players.map((p) => p.id),
      room.day,
    );
    if (next === this.world) return false;
    this.world = next;
    return true;
  }

  // 위치 동기화 한 번: 밤·아침 home → 방금 탈락한 사람 snap → 지목 배치. 모두 지금 단계 키와 world.lay.key 비교로 멱등이다.
  private async syncPositions(now: number): Promise<void> {
    await this.syncHome(now);
    this.snapNewGhosts(now);
    this.syncLayout(now);
  }

  // 밤·아침 위치(결정 0061-3·4): 키 '{일차}:night'·'{일차}:morning' 이 world.lay.key 와 다르면 home 으로 순간이동하고 보는 사람 한 명씩 snap 을 보낸다.
  // 밤은 산 사람 전원, 아침은 산 사람 + 그 밤의 피해자(마피아가 걸은 구간을 버린다, UI-SPEC A1). home 이 없는 사람은 teleportHome 이 건드리지 않는다(fail-safe).
  // 전송은 새 길을 만들지 않는다: 소켓마다 worldVisibleTo 로 거른 snapFrame 을 deliver 한 명씩(연구 Don't Hand-Roll).
  // 밤의 시민 편은 본인 한 칸, 아침은 산 사람 소켓 모두가 같은 좌석·같은 좌표다. 방금 탈락한 피해자는 이 snap 으로 ghostSnapped 에 올라 같은 snap 을 두 번 받지 않는다(A3).
  private async syncHome(now: number): Promise<void> {
    const room = this.room;
    if (!room || room.day === undefined) return;
    if (room.phase !== "night" && room.phase !== "morning") return;
    const key = `${room.day}:${room.phase}`;
    if (key === this.world.lay?.key) return;
    const victimSeat = room.phase === "morning" ? room.morning?.eliminated : undefined;
    const moved = room.players.filter((p) => isAlive(p) || (victimSeat !== undefined && p.seat === victimSeat)).map((p) => p.id);
    this.world = { ...teleportHome(this.world, moved, now), lay: { key, slots: this.world.lay?.slots ?? {} } };
    await this.flushWorld();
    for (const viewer of room.players) {
      const visible = worldVisibleTo(room, viewer.id);
      if (visible.size === 0) continue;
      if (!isAlive(viewer)) this.ghostSnapped.add(viewer.id);
      this.deliver(new Set([viewer.id]), snapFrame(this.world, room.players.filter((q) => visible.has(q.id)), now));
    }
  }

  // 지금 단계의 배치(지목 둘레 자리·변론 무대·부결 복귀)를 서버가 걷게 한다(DAY-04·05, 결정 0060-7).
  // 단계 전환 이벤트가 아니라 지금 단계의 배치를 맞춘다 — 알람 따라잡기·퇴거에도 안전(RESEARCH 패턴 4). 키가 world.lay.key 와 같으면 아무것도 하지 않는다(멱등).
  // 이동마다 지금 위치에서 경로를 만들고(planMoveSegment) 150ms 간격·lastMoveAt 을 건드리지 않는 forceSegment 로 적용한 뒤(Pitfall 5)
  // 그 사람이 움직인 것으로 emitWorld 한다(산 사람의 이동은 방 전원에게, A2). 배치 기억 lay 는 world 저장에 실려 퇴거 뒤에도 자리가 뒤섞이지 않는다.
  // 밤·아침은 layoutKey 가 null 이고 syncHome 이 맞춘다(결정 0061-3·4).
  private syncLayout(now: number): void {
    const room = this.room;
    if (!room) return;
    const key = layoutKey(room);
    if (key === null || key === this.world.lay?.key) return;
    const layout = layoutFor(room, this.world, now);
    if (layout === null) return;
    for (const m of layout.moves) {
      const me = room.players.find((p) => p.id === m.playerId);
      const cur = Object.prototype.hasOwnProperty.call(this.world.segs, m.playerId) ? this.world.segs[m.playerId] : undefined;
      if (!me || !cur) continue;
      const seg = planMoveSegment(cur, m.dest, now, BAR_MAP);
      this.world = forceSegment(this.world, m.playerId, seg);
      this.emitWorld(moveFrame(me.seat, seg), m.playerId);
    }
    this.world = { ...this.world, lay: { key: layout.key, slots: layout.slots } };
    this.markWorldDirty();
  }

  // 방금 탈락한 사람(처형·아침)에게만 모두의 위치 snap 을 보낸다 — 그 전까지 받지 못한 다른 유령의 위치를 맞춘다(GHOST-01).
  // 산 사람의 폰에는 가지 않는다: deliver 는 그 사람 한 명의 소켓에만 보내고, 보낼 좌석은 worldVisibleTo(= 유령에게는 전원)로 정한다.
  // 이미 보낸 사람은 건너뛴다(ghostSnapped). 지도 단계 밖(ended 등)은 보낼 좌석이 없어 아무것도 보내지 않고 기록도 하지 않는다.
  private snapNewGhosts(now: number): void {
    const room = this.room;
    if (!room) return;
    for (const p of room.players) {
      if (isAlive(p) || this.ghostSnapped.has(p.id)) continue;
      const visible = worldVisibleTo(room, p.id);
      if (visible.size === 0) continue;
      this.ghostSnapped.add(p.id);
      this.deliver(new Set([p.id]), snapFrame(this.world, room.players.filter((q) => visible.has(q.id)), now));
    }
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
    // 봇 배회(로비·사람 연결·봇 있음일 때만)도 같은 알람 하나에 합친다 — 사람이 없으면 걸지 않아 버려진 테스트 방이 깨어나지 않는다(가정 A2).
    this.syncWanderPlan(Date.now());
    const wanderAt = this.wanderActive() ? nextWanderAt(this.world, this.wanderBots().map((b) => b.id)) : null;
    const wake = nextWakeAt(this.room);
    await this.ctx.storage.setAlarm(Math.min(wake, botAt ?? Number.POSITIVE_INFINITY, wanderAt ?? Number.POSITIVE_INFINITY));
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, _wasClean: boolean): Promise<void> {
    try {
      await this.handleDisconnect(ws);
    } finally {
      // 위생 수정(06-23): 받은 close 를 맞받아 쳐 소켓을 정리한다. 배포에서의 효과는 배포 없이 검증할 수 없다(진단: reconnect-banner-deployed).
      // 예약 코드 1005·1006 은 보낼 수 없다. 이미 닫힌 소켓·보낼 수 없는 코드는 던지므로 무시한다(알람·연결 끊김 처리를 막지 않는다).
      if (code !== 1005 && code !== 1006) {
        try {
          ws.close(code, reason);
        } catch {
          /* 이미 닫힌 소켓 또는 보낼 수 없는 코드 — 무시 */
        }
      }
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  async alarm(): Promise<void> {
    try {
      // 디바운스 중이던 위치는 알람이 깨어나는 즉시 저장한다(배포·퇴거 직전의 마지막 탭을 지킨다).
      if (this.worldFlushTimer !== null) await this.flushWorld();
      await this.advance(Date.now());
      await this.runDueBots(Date.now());
      this.runBotWander(Date.now());
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

    // 연결된 사람이 아무도 없던 방에 처음 사람이 들어오면 봇 배회 알람이 이제 필요하다(아래).
    const wasIdle = !room.players.some((p) => !isBot(p) && p.connected);
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
    // state 다음에 이 소켓에만 지금 위치를 보낸다 — 보는 사람별로 거른다(결정 0060-8, T-08-11): 로비·assigning·roleReveal 은 모두,
    // 지도 단계는 산 사람이면 산 사람만·유령이면 모두(worldVisibleTo). 보낼 좌석이 없는 단계(ended 등)는 snap 을 보내지 않는다.
    // 클라이언트 epoch 가 첫 state 에서 오르는 규약(WR-03)과 맞는 순서다.
    const visible = worldVisibleTo(this.room, player.id);
    if (visible.size > 0) this.sendTo(ws, snapFrame(this.world, this.room.players.filter((p) => visible.has(p.id)), Date.now()));
    // 그다음 이 소켓에만 보관 줄을 한 프레임으로 돌려준다 — 줄이 없어도 빈 배열로 보낸다(D2, 결정 0058-3).
    // 복원도 보낼 때의 마스크로만 거른다(결정 0058-2): 지금의 역할·생존으로 다시 계산하지 않아 라이브보다 넓어지지 않는다.
    this.sendTo(ws, { t: "chatLog", lines: replayFor(this.chatLog, player.seat) });
    // 첫 접속이면 만료가 늘었으니 알람도 따라 옮긴다.
    if (this.room.expiresAt !== room.expiresAt || (wasIdle && this.wanderBots().length > 0)) await this.reschedule();
  }

  private async handleDisconnect(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as SocketAttachment | null;
    if (!att || !this.room) return;
    // 방에 없거나 최신 연결이 아닌(교체된 낡은) 소켓의 닫힘은 아무것도 바꾸지 않는다.
    const current = this.room.players.find((p) => p.id === att.playerId);
    if (!current || current.connId !== att.connId) return;
    this.room = detachConnection(this.room, att.playerId, att.connId);
    await this.persistAndBroadcast();
    // 연결된 사람이 한 명도 남지 않으면 DO 가 곧 내려갈 수 있으니 대기 중이던 위치를 지금 저장한다(봇은 사람이 아니다).
    if (this.room.players.every((p) => isBot(p) || !p.connected)) {
      await this.flushWorld();
      // 배회 알람은 사람이 없으면 걸지 않는다 — 남은 알람을 방 만료 쪽으로 돌려놓는다.
      if (this.wanderBots().length > 0) await this.reschedule();
    }
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

  /**
   * 이벤트 프레임의 유일한 전송 길. 받는 사람은 audience 가 정한다. 화면에서 거르는 방식으로 대신하지 않는다(결정 0002·0021).
   * 첨부 playerId 가 ids 에 든 소켓에만 보낸다 — hello 전 소켓(첨부 없음)과 방에 없는 사람의 소켓은 받지 않는다.
   */
  private deliver(ids: ReadonlySet<string>, msg: ServerMessage): void {
    const room = this.room;
    if (!room) return;
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as SocketAttachment | null;
      if (!att || !ids.has(att.playerId) || !room.players.some((p) => p.id === att.playerId)) continue;
      this.sendTo(ws, msg);
    }
  }

  // 입력 중(07-10, CHAT-04): 신원은 소켓 첨부 playerId 뿐이고 채널은 서버가 보낸 사람의 상태로 정한다(결정 0002). 거절은 오류 프레임 없이 조용히 버린다.
  //  - 단계 키(pk)가 서버 단계 키와 다르면 버린다 — 지금 단계의 채널로 다시 분류하지 않는다(밤의 마피아 신호가 아침 직전 넓은 채널로 새는 길을 닫는다, T-07-20).
  //  - 채널이 없으면(밤의 산 비마피아·CHAT_PHASES 밖) 버린다. 켜짐은 사람당 1.5초에 한 번, 꺼짐은 켜져 있을 때만 중계한다(typingRelay).
  //  - 받는 사람은 audience 가 정한 같은 채널에서 보낸 사람을 뺀 집합이다(내 화면은 즉시 켠다, A3). 계산한 그 자리에서 바로 보낸다(await 없음).
  private handleTyping(ws: WebSocket, on: boolean, pk: string): void {
    const att = this.attachmentOf(ws);
    const room = this.room;
    if (!att || !room) return;
    if (pk !== phaseKey({ phase: room.phase, day: room.day })) return;
    const ch = channelOf(room, att.playerId);
    if (ch === null) return;
    const me = room.players.find((p) => p.id === att.playerId);
    if (!me) return;
    const decided = typingRelay(this.typingRelays.get(att.playerId), on, Date.now());
    this.typingRelays.set(att.playerId, decided.next);
    if (!decided.relay) return;
    const others = new Set(audience(room, { k: "typing", ch }));
    others.delete(att.playerId);
    this.deliver(others, { t: "typing", seat: me.seat, on });
  }

  // 자유 채팅(07-11, CHAT-01·02·03·05): 신원은 소켓 첨부 playerId 뿐이고 채널은 서버가 보낸 사람 상태로 정한다(결정 0002).
  // 거절은 보낸 소켓에만 chatReject 로 알리고, phase 거절은 이어서 최신 state 를 한 번 더 보낸다(클라이언트가 서버 단계로 돌아오게, ROADMAP 계획 메모).
  private async handleChat(ws: WebSocket, text: string, pk: string): Promise<void> {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) {
      this.sendTo(ws, { t: "error", code: "BAD_MESSAGE" });
      return;
    }
    const why = await this.applyChat(att.playerId, text, pk, Date.now());
    if (why === null) return;
    this.sendTo(ws, { t: "chatReject", why });
    if (why === "phase" && this.room) this.sendTo(ws, { t: "state", view: buildView(this.room, att.playerId, Date.now()) });
  }

  // 사람과 봇이 같은 본체를 쓴다(특권 없음, 결정 0024). 판정 순서: 단계 키 → 채널 → 정리 → D5 제한 → (받는 사람·마스크 한 번) → 보관 → 저장 → 전송.
  // 받는 사람·마스크는 이 지역 변수로만 쓴다 — 한 번 계산하고, 저장하고, 보낸다. 다시 audience 를 부르지 않는다.
  // 쓰기 뒤 전송 — output gate 가 쓰기 완료까지 전송을 붙잡는다. 받는 사람은 await 앞에서 계산한 집합 그대로다(알람이 끼어들어도 같은 집합).
  // 단계 키가 어긋나거나 채널이 없으면 더 넓은 채널로 돌리지 않고 폐기한다 — 거절 이유는 모두 phase 하나라 보낸 사람의 역할이 드러나지 않는다(T-07-24·26).
  // 본문·닉네임을 로그에 남기지 않는다(결정 0058-8).
  private async applyChat(playerId: string, text: string, pk: string, now: number): Promise<ChatRejectWhy | null> {
    const room = this.room;
    if (!room) return "phase";
    if (pk !== phaseKey({ phase: room.phase, day: room.day })) return "phase";
    const ch = channelOf(room, playerId);
    if (ch === null) return "phase";
    const me = room.players.find((p) => p.id === playerId);
    if (!me) return "phase";
    const clean = sanitizeChatText(text);
    if (!clean.ok) return clean.why;
    const sent = checkChatSend(this.chatRates.get(playerId), clean.text, now);
    if (!sent.ok) return sent.why;
    this.chatRates.set(playerId, sent.next);
    const ids = audience(room, { k: "chat", ch });
    const r = seatMask(room.players, ids);
    const appended = appendLine(this.chatLog, { ch, seat: me.seat, text: clean.text, at: now, n: room.day ?? 0, r });
    this.chatLog = appended.log;
    // 줄 하나 = 키 하나. 보관 상한을 넘으면 그 채널의 가장 오래된 줄들(appendLine 이 정한 g)의 키를 묶어 지운다.
    await this.ctx.storage.put(chatKey(appended.record.g), appended.record);
    if (appended.evicted.length > 0) await this.deleteChatKeys(appended.evicted.map(chatKey));
    this.deliver(ids, { t: "chat", ...toWire(appended.record) });
    return null;
  }

  // storage.delete(keys[]) 는 한 번에 128개까지다 — 나눠서 지운다(가정 A1).
  private async deleteChatKeys(keys: readonly string[]): Promise<void> {
    for (let i = 0; i < keys.length; i += CHAT_DELETE_MAX) await this.ctx.storage.delete(keys.slice(i, i + CHAT_DELETE_MAX));
  }

  /** 보관 줄의 메모리 사본·도배 기록·입력 중 기록을 비운다(저장소 키는 deleteAll 이나 deleteChatKeys 가 이미 비웠다). */
  private dropChat(): void {
    this.chatLog = emptyChatLog();
    this.chatRates.clear();
    this.typingRelays.clear();
  }

  // ======== 로비 이동 구역(06-08): move 처리 · 전송 · 저장/복원 · 봇 배회 ========
  // 규칙 한눈에:
  //  - 전송: world 프레임은 emitWorld 한 곳으로만 나간다. 로비는 방 전원, 지도 단계는 움직인 사람 기준(산 사람 → 전원, 유령 → 유령만, 결정 0060-8).
  //  - 순서: 프레임을 먼저 보내고 저장은 뒤에 한다 — output gate 가 쓰기 뒤의 전송을 붙잡기 때문이다(RESEARCH R6).
  //  - 저장: 이동 뒤 2000ms 디바운스 한 번(markWorldDirty). 나가기·내보내기·로비를 떠나는 시작·마지막 사람 연결 끊김·알람에서는 즉시(flushWorld).
  //  - 키: room 키와 분리된 "world" 키. 생성자가 두 키를 한 번에 읽어 restoreWorld 로 되살린다.
  //  - 봇: 배회도 applyMove 본체를 지난다(단계·150ms 간격·경로, 특권 없음). 알람 하나에 단계 마감·만료·봇 행동과 함께 합쳐진다.
  // 신원은 소켓 첨부 playerId 뿐이고 단계·간격·경로는 서버가 정한다. 거절은 오류 프레임 없이 조용히 버린다(UI-SPEC "서버가 막은 탭에 문구 없음").
  // 형식이 틀린 move 는 스키마에서 이미 BAD_MESSAGE 로 걸러진다.
  private handleMove(ws: WebSocket, x: number, z: number): void {
    const att = this.attachmentOf(ws);
    if (!att || !this.room) return;
    this.applyMove(att.playerId, { x, z }, Date.now());
  }

  // 사람과 봇 배회가 같은 본체를 쓴다(특권 없음, 결정 0024). 방에 없는 사람·이 단계에서 못 움직이는 신분(canMove, MAP-04)·150ms 안·경로 실패는 모두 조용히 버린다.
  // 단계 × 신분 표는 shared/game/movement.ts 한 곳이다: 산 사람은 낮 시작·토론에서만, 유령은 모든 지도 단계에서 걷는다.
  private applyMove(playerId: string, dest: { x: number; z: number }, now: number): void {
    const room = this.room;
    if (!room) return;
    const me = room.players.find((p) => p.id === playerId);
    if (!me || !canMove(room, me)) return;
    // 무대 자리(0,0)는 변론자를 서버가 세우는 한 점이다. 공용 걷기 판정이 그 점만 예외로 받으므로(08-04) 클라이언트 입력으로는 정확히 그 목적지를 버린다 —
    // 옆 점은 막힌 칸이라 걸을 수 있는 칸 중심으로 보정되어 무대 자리가 되지 않는다.
    if (dest.x === STAGE_SPOT.x && dest.z === STAGE_SPOT.z) return;
    const result = requestMove(this.world, playerId, dest, now, BAR_MAP);
    if (!result.ok) return;
    this.world = result.world;
    // 전송이 먼저, 저장은 뒤(디바운스) — output gate 가 쓰기 뒤의 전송을 붙잡으므로(RESEARCH R6). 받는 사람은 움직인 사람 기준이다(emitWorld).
    this.emitWorld(moveFrame(me.seat, result.seg), playerId);
    this.markWorldDirty();
  }

  // 위치 저장: 2초 디바운스 한 번(T-06-19). 이미 타이머가 있으면 새로 걸지 않는다 — 연속 이동에도 쓰기는 2초에 한 번이다.
  private markWorldDirty(): void {
    if (this.worldFlushTimer !== null) return;
    this.worldFlushTimer = setTimeout(() => {
      void this.flushWorld().catch((err: unknown) => console.error("world flush failed", err instanceof Error ? err.name : "unknown"));
    }, WORLD_FLUSH_MS);
  }

  /** 타이머를 풀고 지금 저장한다. 방이 없으면(삭제됨) 아무것도 쓰지 않는다 — 지워진 저장소에 world 키가 되살아나지 않게. */
  private async flushWorld(): Promise<void> {
    if (this.worldFlushTimer !== null) {
      clearTimeout(this.worldFlushTimer);
      this.worldFlushTimer = null;
    }
    if (!this.room) return;
    await this.ctx.storage.put("world", compactWorld(this.world, Date.now()));
  }

  /** 방이 지워질 때: 메모리 위치를 비우고 대기 중인 저장 타이머를 푼다(저장소는 deleteAll 이 이미 비웠다). */
  private dropWorld(): void {
    if (this.worldFlushTimer !== null) {
      clearTimeout(this.worldFlushTimer);
      this.worldFlushTimer = null;
    }
    this.world = emptyWorld();
  }

  // ---- 테스트 방 봇 로비 배회(결정 0024, 가정 A2) ----
  // 조건: 로비 · 봇이 있음 · 연결된 사람이 한 명 이상(planBotSteps 선례). 일반 방에는 봇이 없어 해당 없다.
  private wanderActive(): boolean {
    const room = this.room;
    if (!room || room.phase !== "lobby") return false;
    return room.players.some(isBot) && room.players.some((p) => !isBot(p) && p.connected);
  }

  private wanderBots(): { id: string; seat: number }[] {
    return (this.room?.players ?? []).filter(isBot).map((p) => ({ id: p.id, seat: p.seat }));
  }

  // 아직 계획이 없는 봇에게만 첫 배회 시각을 정한다(planWander 가 처음 보는 봇은 이동 없이 계획만 세운다). 이미 계획이 있는 봇은 건드리지 않는다.
  private syncWanderPlan(now: number): void {
    if (!this.wanderActive()) return;
    const unplanned = this.wanderBots().filter((b) => !Object.prototype.hasOwnProperty.call(this.world.wanderAt, b.id));
    if (unplanned.length === 0) return;
    const planned = planWander(this.world, unplanned, now, cryptoRandInt, BAR_MAP);
    this.world = { ...this.world, wanderAt: { ...this.world.wanderAt, ...planned.world.wanderAt } };
  }

  // 때가 된 봇의 목적지를 정하고 사람과 같은 applyMove(단계·150ms 간격·경로 검사)로 적용한다. 거절은 버린다(특권 없음, T-06-20).
  private runBotWander(now: number): void {
    if (!this.wanderActive()) return;
    const planned = planWander(this.world, this.wanderBots(), now, cryptoRandInt, BAR_MAP);
    this.world = planned.world;
    for (const m of planned.moves) this.applyMove(m.playerId, m.dest, now);
  }

  // 방의 사람과 world 를 맞춘다: 방에 있는데 world 에 없으면 입장 지점에 세우고, world 에 있는데 방에 없으면 지운다. 새로 선 사람의 구간을 seat 오름차순으로 돌려준다.
  private syncWorldPlayers(now: number): { seat: number; seg: Segment }[] {
    const room = this.room;
    if (!room) return [];
    const present = new Set(room.players.map((p) => p.id));
    for (const id of Object.keys(this.world.segs)) if (!present.has(id)) this.world = despawnPlayer(this.world, id);
    const spawned: { seat: number; seg: Segment }[] = [];
    for (const pl of [...room.players].sort((a, b) => a.seat - b.seat)) {
      if (Object.prototype.hasOwnProperty.call(this.world.segs, pl.id)) continue;
      this.world = spawnPlayer(this.world, pl.id, pl.seat, now, BAR_MAP);
      const seg = this.world.segs[pl.id];
      if (seg) spawned.push({ seat: pl.seat, seg });
    }
    return spawned;
  }

  // world 프레임도 audience 한 길을 지난다. 로비는 방 전원, 지도 단계는 움직인 사람 기준 — 산 사람은 전원, 유령은 유령만(결정 0060-8, GHOST-01).
  // mover 가 없는 호출(로비의 입장·재시작 snap)은 지도 단계에서 빈 집합이라 fail-closed 다. mover 는 서버가 소켓 첨부의 playerId 로 넣는다(클라이언트 입력이 아니다).
  // 이벤트 프레임(world·typing·chat)은 deliver 한 길이다 — 단계를 가리지 않는 무차별 방송 길이 없어 유령 위치가 산 사람 폰으로 새지 않는다(T-06-16, T-08-01).
  private emitWorld(frame: WorldFrame, moverId?: string): void {
    const room = this.room;
    if (!room) return;
    this.deliver(audience(room, { k: "world", mover: moverId }), frame);
  }

  private sendTo(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // 닫히는 중인 소켓에는 보낼 수 없다.
    }
  }
}
