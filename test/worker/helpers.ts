// 워커 통합 테스트 도우미. 테스트마다 만들기 응답의 새 코드를 쓴다(고정 코드 재사용 금지).
import { env, exports } from "cloudflare:workers";
import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { expect } from "vitest";
import type { CreateRoomResponse, ServerMessage } from "../../shared/protocol";

export interface TestSocket {
  ws: WebSocket;
  /** 받은 모든 원문 프레임(읽었는지와 상관없이 쌓인다). */
  frames: string[];
  /** nextFrame 이 다음에 읽을 위치. */
  cursor: number;
  waiters: Array<() => void>;
  closedPromise: Promise<{ code: number; reason: string }>;
}

export async function createRoom(nickname = "방장"): Promise<{ code: string; token: string }> {
  const res = await exports.default.fetch("http://x/api/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nickname }),
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as CreateRoomResponse;
  return { code: body.code, token: body.token };
}

/** POST /api/rooms/{code}/join 원문 본문 버전. */
export function postJoinRaw(code: string, raw: string): Promise<Response> {
  return exports.default.fetch(`http://x/api/rooms/${code}/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw,
  });
}

export function joinRoom(code: string, nickname: string): Promise<Response> {
  return postJoinRaw(code, JSON.stringify({ nickname }));
}

/** 참가에 성공해 토큰을 받는다. */
export async function joinOk(code: string, nickname: string): Promise<{ token: string; seat: number }> {
  const res = await joinRoom(code, nickname);
  expect(res.status).toBe(200);
  return (await res.json()) as { token: string; seat: number };
}

export async function connect(code: string): Promise<TestSocket> {
  const res = await exports.default.fetch(`http://x/api/rooms/${code}/ws`, {
    headers: { Upgrade: "websocket" },
  });
  expect(res.status).toBe(101);
  const ws = res.webSocket!;
  ws.accept();
  const sock: TestSocket = {
    ws,
    frames: [],
    cursor: 0,
    waiters: [],
    closedPromise: new Promise((resolve) => {
      ws.addEventListener("close", (e) => resolve({ code: e.code, reason: e.reason }));
    }),
  };
  ws.addEventListener("message", (e) => {
    sock.frames.push(e.data as string);
    for (const w of sock.waiters.splice(0)) w();
  });
  return sock;
}

export function send(sock: TestSocket, msg: unknown): void {
  sock.ws.send(typeof msg === "string" ? msg : JSON.stringify(msg));
}

/** 술어에 맞는 다음 프레임을 읽는다(맞지 않는 프레임은 건너뛴다 — frames 에는 남는다). 기본 제한 3초. */
export async function nextFrame(
  sock: TestSocket,
  predicate: (msg: ServerMessage) => boolean = () => true,
  limitMs = 3000,
): Promise<ServerMessage> {
  const deadline = Date.now() + limitMs;
  for (;;) {
    while (sock.cursor < sock.frames.length) {
      const msg = JSON.parse(sock.frames[sock.cursor++]!) as ServerMessage;
      if (predicate(msg)) return msg;
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("nextFrame: 제한 시간 안에 맞는 프레임이 오지 않았다");
    await new Promise<void>((resolve) => {
      sock.waiters.push(resolve);
      setTimeout(resolve, remaining);
    });
  }
}

export const isState = (m: ServerMessage): boolean => m.t === "state";

/** hello 를 보내고 첫 state 를 돌려준다. */
export async function hello(
  sock: TestSocket,
  token: string,
): Promise<Extract<ServerMessage, { t: "state" }>> {
  send(sock, { t: "hello", token });
  return (await nextFrame(sock, isState)) as Extract<ServerMessage, { t: "state" }>;
}

/** 지금까지 받은 모든 원문 프레임. */
export function collect(sock: TestSocket): string[] {
  return [...sock.frames];
}

export function closed(sock: TestSocket): Promise<{ code: number; reason: string }> {
  return sock.closedPromise;
}

/** 방 코드의 마지막 state 를 이어서 기다린다(이미 읽은 것 이후). */
export function nextState(sock: TestSocket, limitMs = 3000): Promise<Extract<ServerMessage, { t: "state" }>> {
  return nextFrame(sock, isState, limitMs) as Promise<Extract<ServerMessage, { t: "state" }>>;
}

/**
 * 시간 의존 전이를 위해 storage "room" 의 마감 필드를 과거로 바꾸고 DO 를 evict 한다
 * (생성자가 storage 에서 복구하고 소켓은 하이버네이션으로 남는다). 이어서 runDurableObjectAlarm 을 부른다.
 * 전이 한 번마다 다시 불러야 한다 — 알람이 새 마감을 미래로 정한다.
 */
export async function forceDue(code: string, field: "phaseEndsAt" | "expiresAt"): Promise<void> {
  const stub = env.ROOM.getByName(code);
  await runInDurableObject(stub, async (_instance, state) => {
    const room = await state.storage.get<Record<string, unknown>>("room");
    if (!room) throw new Error("forceDue: 방이 없다");
    await state.storage.put("room", { ...room, [field]: Date.now() - 1 });
  });
  await evictDurableObject(stub);
}
