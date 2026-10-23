// 워커 통합 테스트 도우미. 테스트마다 만들기 응답의 새 코드를 쓴다(고정 코드 재사용 금지).
import { env, exports } from "cloudflare:workers";
import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { expect } from "vitest";
import type { ChatLine, CreateRoomResponse, PhaseId, ServerMessage } from "../../shared/protocol";

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

/**
 * 소켓이 닫힌 코드·사유를 "4003 left" 같은 한 줄 문자열로. 제한 시간(기본 3초) 안에 닫히지 않으면 "0 not_closed" 라
 * 단언이 실패한다. 한 줄이어야 실패 보고(TAP)가 깨지지 않는다.
 */
export function closed(sock: TestSocket, limitMs = 3000): Promise<string> {
  return Promise.race([
    sock.closedPromise.then((c) => `${c.code} ${c.reason}`),
    new Promise<string>((resolve) => setTimeout(() => resolve("0 not_closed"), limitMs)),
  ]);
}

/** 서버 오류 프레임을 한 줄 문자열로 비교하기 위한 변환. */
export const flat = (msg: ServerMessage): string => JSON.stringify(msg);

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

// ---- 방 꾸미기·저장소 읽기 ----

export interface Seated {
  code: string;
  host: TestSocket;
  hostToken: string;
  /** 연결된 참가자(소켓 있음). */
  guests: Array<{ sock: TestSocket; token: string; seat: number }>;
  /** HTTP 로만 참가한 미연결 참가자. */
  offline: Array<{ token: string; seat: number }>;
}

/** 방장 + 연결 참가자 `connectedGuests` 명 + HTTP 로만 참가한 `offlineGuests` 명. */
export async function seat(connectedGuests: number, offlineGuests: number): Promise<Seated> {
  const { code, token } = await createRoom("방장");
  const host = await connect(code);
  await hello(host, token);
  const guests: Seated["guests"] = [];
  for (let i = 0; i < connectedGuests; i += 1) {
    const j = await joinOk(code, `손님${i}`);
    const sock = await connect(code);
    await hello(sock, j.token);
    guests.push({ sock, token: j.token, seat: j.seat });
  }
  const offline: Seated["offline"] = [];
  for (let i = 0; i < offlineGuests; i += 1) offline.push(await joinOk(code, `유령${i}`));
  return { code, host, hostToken: token, guests, offline };
}

export interface StoredRoom {
  createdAt: number;
  expiresAt: number;
  phase: string;
  phaseEndsAt: number | null;
  day?: number;
  messages?: ChatLine[];
  extendUsed?: boolean;
  players: Array<{ role?: string; claimChoice?: string; lastSendAt?: number }>;
}

export async function storedRoom(code: string): Promise<StoredRoom> {
  let room: unknown;
  await runInDurableObject(env.ROOM.getByName(code), async (_i, state) => {
    room = await state.storage.get("room");
  });
  return room as StoredRoom;
}

export async function alarmOf(code: string): Promise<number | null> {
  let alarm: number | null = null;
  await runInDurableObject(env.ROOM.getByName(code), async (_i, state) => {
    alarm = await state.storage.getAlarm();
  });
  return alarm;
}

const isPhase = (phase: PhaseId) => (m: ServerMessage): boolean => m.t === "state" && m.view.phase === phase;

/**
 * 낮 단계로 한 단계씩 넘긴다: 저장된 단계가 목표가 될 때까지 forceDue + runDurableObjectAlarm 을 반복하고(전이 한 번마다
 * 마감이 다시 미래가 되므로 매번 필요하다), 모든 소켓이 그 단계 state 를 받을 때까지 기다린다(지나간 단계의 프레임은 nextFrame 이 건너뛴다).
 * 호출 전에 방이 시작되어(assigning 이상) 있어야 한다.
 */
export async function advanceTo(code: string, sockets: TestSocket[], phase: PhaseId): Promise<void> {
  const stub = env.ROOM.getByName(code);
  for (let i = 0; i < 12 && (await storedRoom(code)).phase !== phase; i += 1) {
    await forceDue(code, "phaseEndsAt");
    expect(await runDurableObjectAlarm(stub)).toBe(true);
  }
  expect((await storedRoom(code)).phase).toBe(phase);
  for (const s of sockets) await nextFrame(s, isPhase(phase));
}

/** 저장된 모든 플레이어의 lastSendAt 을 msAgo 전으로 옮기고 evict 한다 — 테스트가 2초 쿨다운을 실제로 기다리지 않게 한다. */
export async function backdateSends(code: string, msAgo = 5000): Promise<void> {
  const stub = env.ROOM.getByName(code);
  await runInDurableObject(stub, async (_instance, state) => {
    const room = await state.storage.get<{ players: Array<Record<string, unknown>> }>("room");
    if (!room) throw new Error("backdateSends: 방이 없다");
    const players = room.players.map((p) => (p.lastSendAt === undefined ? p : { ...p, lastSendAt: Date.now() - msAgo }));
    await state.storage.put("room", { ...room, players });
  });
  await evictDurableObject(stub);
}
