import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { CLOSE_CODES, MAX_BODY_BYTES, MAX_FRAME_BYTES } from "../../shared/protocol";
import type { CreateRoomResponse, ServerMessage } from "../../shared/protocol";

// 테스트마다 서로 다른 방을 쓴다: 코드는 POST /api/rooms 가 무작위로 새로 뽑고,
// 직접 호출 테스트만 고정 코드(9001)를 쓴다.

function postRooms(raw: string): Promise<Response> {
  return exports.default.fetch("http://x/api/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw,
  });
}

async function createRoom(nickname = "민수"): Promise<CreateRoomResponse> {
  const res = await postRooms(JSON.stringify({ nickname }));
  expect(res.status).toBe(201);
  return (await res.json()) as CreateRoomResponse;
}

async function errorOf(res: Response): Promise<string> {
  return ((await res.json()) as { error: string }).error;
}

interface TestSocket {
  ws: WebSocket;
  next(): Promise<string>;
  nextMessage(): Promise<ServerMessage>;
  closed: Promise<{ code: number; reason: string }>;
}

async function openSocket(code: string): Promise<TestSocket> {
  const res = await exports.default.fetch(`http://x/api/rooms/${code}/ws`, {
    headers: { Upgrade: "websocket" },
  });
  expect(res.status).toBe(101);
  const ws = res.webSocket!;
  ws.accept();
  const queue: string[] = [];
  const waiters: Array<(s: string) => void> = [];
  ws.addEventListener("message", (e) => {
    const s = e.data as string;
    const w = waiters.shift();
    if (w) w(s);
    else queue.push(s);
  });
  const closed = new Promise<{ code: number; reason: string }>((resolve) => {
    ws.addEventListener("close", (e) => resolve({ code: e.code, reason: e.reason }));
  });
  const next = () =>
    queue.length > 0 ? Promise.resolve(queue.shift()!) : new Promise<string>((r) => waiters.push(r));
  return { ws, next, nextMessage: async () => JSON.parse(await next()) as ServerMessage, closed };
}

describe("POST /api/rooms", () => {
  it("201 과 {code, token, seat:0} 을 돌려준다 (코드는 앞자리 0 허용 4자리 숫자)", async () => {
    const res = await postRooms(JSON.stringify({ nickname: "민수" }));
    expect(res.status).toBe(201);
    const body = (await res.json()) as CreateRoomResponse;
    expect(body.code).toMatch(/^\d{4}$/);
    expect(body.token.length).toBeGreaterThanOrEqual(43);
    expect(body.seat).toBe(0);
  });

  it("같은 코드의 방이 살아 있으면 createRoom 은 덮어쓰지 않고 CODE_TAKEN 을 돌려준다", async () => {
    const stub = env.ROOM.getByName("9001");
    const first = await stub.createRoom({ code: "9001", nickname: "가", now: Date.now() });
    expect(first.ok).toBe(true);
    const second = await stub.createRoom({ code: "9001", nickname: "나", now: Date.now() });
    expect(second).toEqual({ ok: false, error: "CODE_TAKEN" });
  });

  it("JSON 이 아닌 본문은 400 BAD_REQUEST", async () => {
    const res = await postRooms("이건 JSON 이 아니다");
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe("BAD_REQUEST");
  });

  it("스키마에 맞지 않는 본문은 400 BAD_REQUEST", async () => {
    const res = await postRooms(JSON.stringify({ nickname: 123 }));
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe("BAD_REQUEST");
  });

  it("1024바이트를 넘는 본문은 400 BAD_REQUEST", async () => {
    const res = await postRooms(JSON.stringify({ nickname: "가".repeat(MAX_BODY_BYTES) }));
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toBe("BAD_REQUEST");
  });

  it("빈 닉네임과 공백뿐인 닉네임은 400 NICKNAME_INVALID", async () => {
    for (const nickname of ["", "   "]) {
      const res = await postRooms(JSON.stringify({ nickname }));
      expect(res.status).toBe(400);
      expect(await errorOf(res)).toBe("NICKNAME_INVALID");
    }
  });
});

describe("GET /api/rooms/{code}/ws", () => {
  it("hello{token} 에 그 사람의 RoomView 를 보내고, 공개 항목은 허용 목록 네 키뿐이며 토큰이 프레임에 없다", async () => {
    const { code, token } = await createRoom("민수");
    const sock = await openSocket(code);
    sock.ws.send(JSON.stringify({ t: "hello", token }));
    const raw = await sock.next();
    expect(raw).not.toContain(token);
    const msg = JSON.parse(raw) as ServerMessage;
    expect(msg.t).toBe("state");
    if (msg.t !== "state") return;
    expect(msg.view.code).toBe(code);
    expect(msg.view.phase).toBe("lobby");
    expect(msg.view.phaseEndsAt).toBeNull();
    expect(msg.view.players).toEqual([{ seat: 0, nickname: "민수", connected: true, isHost: true, alive: true }]);
    expect(Object.keys(msg.view.players[0]!).sort()).toEqual(["alive", "connected", "isHost", "nickname", "seat"]);
    expect(msg.view.me).toEqual({ seat: 0, isHost: true });
    sock.ws.close();
  });

  it("잘못된 토큰의 hello 는 4003 invalid_token 으로 닫힌다", async () => {
    const { code } = await createRoom();
    const sock = await openSocket(code);
    sock.ws.send(JSON.stringify({ t: "hello", token: "x".repeat(43) }));
    expect(await sock.closed).toEqual({ code: CLOSE_CODES.REMOVED, reason: "invalid_token" });
  });

  it("없는 방의 /ws 요청은 101 이 아니라 404 ROOM_NOT_FOUND", async () => {
    const res = await exports.default.fetch("http://x/api/rooms/0000/ws", {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(404);
    expect(await errorOf(res)).toBe("ROOM_NOT_FOUND");
  });

  it("코드 모양이 아닌 경로의 /ws 요청도 404 ROOM_NOT_FOUND", async () => {
    const res = await exports.default.fetch("http://x/api/rooms/abcd/ws", {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(404);
    expect(await errorOf(res)).toBe("ROOM_NOT_FOUND");
  });

  it("ping{c} 에 pong{c, serverNow} 로 답한다", async () => {
    const { code } = await createRoom();
    const sock = await openSocket(code);
    sock.ws.send(JSON.stringify({ t: "ping", c: 1 }));
    const msg = await sock.nextMessage();
    expect(msg.t).toBe("pong");
    if (msg.t !== "pong") return;
    expect(msg.c).toBe(1);
    expect(typeof msg.serverNow).toBe("number");
    sock.ws.close();
  });

  it("JSON 이 아니거나 스키마에 맞지 않는 프레임은 BAD_MESSAGE 만 돌려주고 방 상태를 바꾸지 않는다", async () => {
    const { code, token } = await createRoom("민수");
    const sock = await openSocket(code);
    sock.ws.send("{깨진 JSON");
    expect(await sock.nextMessage()).toEqual({ t: "error", code: "BAD_MESSAGE" });
    sock.ws.send(JSON.stringify({ t: "kick", seat: "0" }));
    expect(await sock.nextMessage()).toEqual({ t: "error", code: "BAD_MESSAGE" });
    sock.ws.send(JSON.stringify({ t: "unknown" }));
    expect(await sock.nextMessage()).toEqual({ t: "error", code: "BAD_MESSAGE" });
    // 방은 그대로: 아직 hello 를 하지 않았으므로 방장은 연결 안 됨 상태다.
    sock.ws.send(JSON.stringify({ t: "hello", token }));
    const msg = await sock.nextMessage();
    expect(msg.t).toBe("state");
    if (msg.t !== "state") return;
    expect(msg.view.players).toHaveLength(1);
    sock.ws.close();
  });

  it("1024바이트를 넘는 프레임은 1009 로 닫힌다", async () => {
    const { code } = await createRoom();
    const sock = await openSocket(code);
    sock.ws.send("a".repeat(MAX_FRAME_BYTES + 1));
    expect((await sock.closed).code).toBe(1009);
  });
});
