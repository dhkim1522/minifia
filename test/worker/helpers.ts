// 워커 통합 테스트 도우미. 테스트마다 만들기 응답의 새 코드를 쓴다(고정 코드 재사용 금지).
import { env, exports } from "cloudflare:workers";
import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { expect } from "vitest";
import type { CreateRoomResponse, PhaseId, RoleId, RoomView, ServerMessage } from "../../shared/protocol";

export interface TestSocket {
  ws: WebSocket;
  /** 받은 모든 원문 프레임(읽었는지와 상관없이 쌓인다). */
  frames: string[];
  /** nextFrame 이 다음에 읽을 위치. */
  cursor: number;
  waiters: Array<() => void>;
  closedPromise: Promise<{ code: number; reason: string }>;
}

export interface RoomOptions {
  /** true 일 때만 본문에 testMode: true 를 싣는다(테스트 방, 결정 0022). 기본 본문은 nickname 하나뿐이다. */
  testMode?: boolean;
}

export async function createRoom(nickname = "방장", options: RoomOptions = {}): Promise<{ code: string; token: string }> {
  const res = await exports.default.fetch("http://x/api/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(options.testMode === true ? { nickname, testMode: true } : { nickname }),
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
export async function seat(connectedGuests: number, offlineGuests: number, options: RoomOptions = {}): Promise<Seated> {
  const { code, token } = await createRoom("방장", options);
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
  /** 4페이즈 서버 전용 투표 상태: 개인 표는 마감·공개 구간 진입 훅이 키째 지운다(결정 0034). */
  voteLog?: Array<{ n: number; exec: { yes: number; no: number; passed: boolean }; cand?: { votes: Array<{ seat: number; target: number }>; candidate?: number } }>;
  winner?: string;
  verdict?: { passed: boolean; candidate?: number };
  players: Array<{ role?: string; execVote?: boolean; candidateVote?: number; alive?: boolean }>;
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
  for (let i = 0; i < 40 && (await storedRoom(code)).phase !== phase; i += 1) {
    await forceDue(code, "phaseEndsAt");
    expect(await runDurableObjectAlarm(stub)).toBe(true);
  }
  expect((await storedRoom(code)).phase).toBe(phase);
  for (const s of sockets) await nextFrame(s, isPhase(phase));
}

/**
 * advanceTo 와 같지만 DO 를 evict 하지 않는다 — 마감만 과거로 옮기고(저장소와 메모리 둘 다) 알람을 돌린다(07-11).
 * 채팅 줄 번호(chatLog)와 전송 기록(chatRates)은 DO 메모리에만 있어(저장·복원은 07-14) evict 하면 1 로 돌아간다.
 * 줄 번호가 단계를 넘어 이어지는 시험이 이 함수를 쓴다.
 */
export async function advanceToKeep(code: string, sockets: TestSocket[], phase: PhaseId): Promise<void> {
  const stub = env.ROOM.getByName(code);
  for (let i = 0; i < 40 && (await storedRoom(code)).phase !== phase; i += 1) {
    await runInDurableObject(stub, async (instance, state) => {
      const room = await state.storage.get<Record<string, unknown>>("room");
      if (!room) throw new Error("advanceToKeep: 방이 없다");
      const due = { ...room, phaseEndsAt: Date.now() - 1 };
      await state.storage.put("room", due);
      (instance as unknown as { room: unknown }).room = due;
    });
    expect(await runDurableObjectAlarm(stub)).toBe(true);
  }
  expect((await storedRoom(code)).phase).toBe(phase);
  for (const s of sockets) await nextFrame(s, isPhase(phase));
}

// ---- 4페이즈 소켓 도우미(04-07): night.test.ts 의 지역 도우미와 같은 모양을 내보낸다 ----

/** 실패 출력은 한 줄이어야 해서(TAP) 프레임 목록은 summary() 한 줄 문자열로 비교한다: "[state:night,error:BAD_MESSAGE]". 빈 목록도 "[]" 라 비어 있지 않다. */
export const summary = (msgs: ServerMessage[]): string =>
  `[${msgs
    .map((m) => (m.t === "state" ? `state:${m.view.phase}` : m.t === "error" ? `error:${m.code}` : m.t))
    .join(",")}]`;

const parseFrame = (raw: string): ServerMessage => JSON.parse(raw) as ServerMessage;

/** 행동 전에 그 소켓의 frames 길이를 적어 둔다. settle 의 from 으로 쓴다. */
export const mark = (sock: TestSocket): number => sock.frames.length;

let pingCounter = 0;
/**
 * `from`(행동 전 mark) 이후 ~ pong 직전까지 받은 프레임. 소켓마다 보낸 순서대로 전달되므로 ping 을 보내 pong 이 올 때까지 사이에 낀 프레임이
 * 곧 그 행동이 만든 프레임 전부다("오지 않았음" 의 증명).
 */
export async function settle(sock: TestSocket, from: number): Promise<ServerMessage[]> {
  pingCounter += 1;
  const c = pingCounter;
  send(sock, { t: "ping", c });
  await nextFrame(sock, (m) => m.t === "pong" && m.c === c);
  return sock.frames.slice(from, sock.cursor - 1).map(parseFrame);
}

/** 소켓이 받은 마지막 state view. */
export function lastViewOf(sock: TestSocket): RoomView {
  const views = sock.frames
    .map(parseFrame)
    .filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state")
    .map((m) => m.view);
  return views.at(-1)!;
}

export interface Actor {
  sock: TestSocket;
  token: string;
  seat: number;
  role: RoleId;
}

/** 모든 소켓의 마지막 view 로 사람마다 seat·역할을 읽는다(역할은 무작위라 테스트가 이렇게 고른다). 역할 확인 단계 뒤에 불러야 한다. */
export function actorsOf(seated: Seated): Actor[] {
  const tokens = [seated.hostToken, ...seated.guests.map((g) => g.token)];
  return [seated.host, ...seated.guests.map((g) => g.sock)].map((sock, i) => {
    const view = lastViewOf(sock);
    return { sock, token: tokens[i]!, seat: view.me.seat, role: view.me.role! };
  });
}

/** 저장된 마감을 과거로 당기고 알람을 한 번 돌린다(단계 하나가 넘어간다). 당긴 마감 시각을 돌려준다 — 종료 알람 시각(= 이 값 + 30분) 단언에 쓴다. */
export async function closePhase(code: string): Promise<number> {
  await forceDue(code, "phaseEndsAt");
  const deadline = (await storedRoom(code)).phaseEndsAt!;
  expect(await runDurableObjectAlarm(env.ROOM.getByName(code))).toBe(true);
  return deadline;
}

/** `from` 이 아닌 단계의 state 를 모든 actor 가 받을 때까지 기다린다. */
async function untilLeft(actors: Actor[], from: PhaseId): Promise<void> {
  for (const a of actors) await nextFrame(a.sock, (m) => m.t === "state" && m.view.phase !== from);
}

/**
 * 처형 여부 투표로 단계를 넘긴다: agreeBySeat 에 든 사람이 execVote 를 보내고(없는 사람은 안 던진다), 모든 actor 가 자기 소켓을 flush 한 뒤
 * 마감을 당겨 execVote 를 벗어난 단계 state 를 모두 받을 때까지 기다린다. 마감 시각을 돌려준다.
 */
export async function voteExec(code: string, actors: Actor[], agreeBySeat: Readonly<Record<number, boolean>>): Promise<number> {
  const marks = actors.map((a) => mark(a.sock));
  for (const a of actors) {
    if (Object.hasOwn(agreeBySeat, a.seat)) send(a.sock, { t: "execVote", agree: agreeBySeat[a.seat] });
  }
  for (let i = 0; i < actors.length; i += 1) await settle(actors[i]!.sock, marks[i]!);
  const deadline = await closePhase(code);
  await untilLeft(actors, "execVote");
  return deadline;
}

/** 후보 선택 투표로 단계를 넘긴다(voteExec 와 같은 모양): targetBySeat[투표자 seat] = 고른 seat. 마감 시각을 돌려준다. */
export async function voteCandidate(code: string, actors: Actor[], targetBySeat: Readonly<Record<number, number>>): Promise<number> {
  const marks = actors.map((a) => mark(a.sock));
  for (const a of actors) {
    if (Object.hasOwn(targetBySeat, a.seat)) send(a.sock, { t: "candidateVote", target: targetBySeat[a.seat] });
  }
  for (let i = 0; i < actors.length; i += 1) await settle(actors[i]!.sock, marks[i]!);
  const deadline = await closePhase(code);
  await untilLeft(actors, "candidateVote");
  return deadline;
}

// ---- 봇 투표·테스트 방 도구 소켓 도우미(04-08) ----

/**
 * 저장된 방을 고쳐 쓰고 DO 를 evict 한다(생성자가 저장소에서 다시 읽고 소켓은 하이버네이션으로 남는다). 표를 손으로 넣어 분기를 정하는 데 쓴다 —
 * 봇 표는 무작위라 "여부 투표 통과" "이 사람이 후보" 같은 경로를 고정하려면 저장된 표를 직접 정해야 한다.
 */
export async function editRoom(code: string, edit: (room: Record<string, unknown>) => Record<string, unknown>): Promise<void> {
  const stub = env.ROOM.getByName(code);
  await runInDurableObject(stub, async (_instance, state) => {
    const room = await state.storage.get<Record<string, unknown>>("room");
    if (!room) throw new Error("editRoom: 방이 없다");
    await state.storage.put("room", edit(room));
  });
  await evictDurableObject(stub);
}

/** 저장된 모든 플레이어에 fn 을 적용한다. */
export const mapPlayers = (
  room: Record<string, unknown>,
  fn: (p: Record<string, unknown>) => Record<string, unknown>,
): Record<string, unknown> => ({ ...room, players: (room.players as Array<Record<string, unknown>>).map(fn) });

/** 저장된 플레이어 가운데 key 가 정해진 사람 수. */
export async function votesIn(code: string, key: "execVote" | "candidateVote"): Promise<number> {
  return (await storedRoom(code)).players.filter((p) => p[key] !== undefined).length;
}

/** 조건이 참이 될 때까지 25ms 간격으로 기다린다(최대 3초). */
export async function until(label: string, ready: () => Promise<boolean>): Promise<void> {
  for (let i = 0; i < 120; i += 1) {
    if (await ready()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`until: ${label} 이(가) 이뤄지지 않았다`);
}

/** 방장이 testSkip 을 한 번 보내고 모든 소켓이 다음 state 하나를 받을 때까지. */
export async function skipOnce(seated: Seated): Promise<void> {
  const socks = [seated.host, ...seated.guests.map((g) => g.sock)];
  for (const s of socks) s.cursor = s.frames.length;
  send(seated.host, { t: "testSkip" });
  for (const s of socks) await nextFrame(s, (m) => m.t === "state");
}

/** 저장된 단계가 phase 가 될 때까지 skipOnce 를 거듭한다. */
export async function skipThrough(seated: Seated, phase: PhaseId): Promise<void> {
  for (let i = 0; i < 40 && (await storedRoom(seated.code)).phase !== phase; i += 1) await skipOnce(seated);
  expect((await storedRoom(seated.code)).phase).toBe(phase);
}

/**
 * 시작된 테스트 방(방장 + 봇, 방장 직업은 마피아로 지정해 두어야 한다)을 처형 여부 투표부터 종료까지 끌고 간다.
 * 여부 투표는 봇 전원 찬성(통과), 후보 선택은 봇 전원이 방장(seat 0)을, 방장이 seat 1 을 골라 방장이 후보가 된다 → 마피아 처형 → 시민 승리.
 * hook 은 두 투표 단계에서 표를 손으로 정하기 전에 불린다(봇이 실제로 던지게 하는 데 쓴다).
 */
export async function driveToEnded(seated: Seated, hook?: (stage: "execVote" | "candidateVote") => Promise<void>): Promise<void> {
  await skipThrough(seated, "execVote");
  await hook?.("execVote");
  await editRoom(seated.code, (room) => mapPlayers(room, (p) => (p.isBot === true ? { ...p, execVote: true } : p)));
  await skipOnce(seated);
  expect((await storedRoom(seated.code)).phase).toBe("candidateVote");
  await hook?.("candidateVote");
  await editRoom(seated.code, (room) =>
    mapPlayers(room, (p) => (p.isBot === true ? { ...p, candidateVote: 0 } : p.seat === 0 ? { ...p, candidateVote: 1 } : p)),
  );
  await skipThrough(seated, "ended");
}

// ---- 6페이즈 로비 이동 저장소 도우미(06-08) ----

/** storage "world" 키의 저장 모양(StoredWorld). 키가 없으면 undefined. */
export interface StoredWorldRecord {
  v: number;
  segs: Record<string, { p: number[]; t0: number; v: number }>;
}

export async function worldOf(code: string): Promise<StoredWorldRecord | undefined> {
  let world: unknown;
  await runInDurableObject(env.ROOM.getByName(code), async (_i, state) => {
    world = await state.storage.get("world");
  });
  return world as StoredWorldRecord | undefined;
}

/** 디바운스 대기 중인 저장을 지금 한다(private flushWorld). 타이머도 함께 풀린다. */
export async function flushWorld(code: string): Promise<void> {
  await runInDurableObject(env.ROOM.getByName(code), async (instance) => {
    await instance["flushWorld"]();
  });
}

/** 위치 저장 디바운스 타이머가 잡혀 있는지(private worldFlushTimer). */
export async function worldDirty(code: string): Promise<boolean> {
  let dirty = false;
  await runInDurableObject(env.ROOM.getByName(code), async (instance) => {
    dirty = instance["worldFlushTimer"] !== null;
  });
  return dirty;
}

/** 봇 배회 예정 시각들(인메모리 world.wanderAt, 06-08). 테스트 방의 로비에서는 알람 = min(방 만료, 이 값들)이다. */
export async function wanderTimes(code: string): Promise<number[]> {
  let times: number[] = [];
  await runInDurableObject(env.ROOM.getByName(code), async (instance) => {
    times = Object.values(instance["world"].wanderAt);
  });
  return times;
}

// ---- 7페이즈 입력 중 도우미(07-10) ----

/** 소켓이 마지막으로 본 view 의 단계 키 '일차:단계'(phaseKey 와 같은 모양, 일차가 없으면 0). */
export function phaseKeyOf(sock: TestSocket): string {
  const view = lastViewOf(sock);
  return `${view.day?.n ?? 0}:${view.phase}`;
}

/** 채팅 한 줄을 보내는 원문 메시지 모양(sendAndSettle 류가 메시지 객체를 받는 시험용). 단계 키는 그 소켓의 마지막 view 에서 만든다. */
export function chatMsg(sock: TestSocket, text: string): { t: "chat"; text: string; pk: string } {
  return { t: "chat", text, pk: phaseKeyOf(sock) };
}

/** 입력 중 신호를 보낸다. 단계 키는 그 소켓이 마지막으로 받은 view 에서 만든다(클라이언트가 하는 대로). */
export function typingSend(sock: TestSocket, on: boolean): void {
  send(sock, { t: "typing", on, pk: phaseKeyOf(sock) });
}

// ---- 7페이즈 자유 채팅 도우미(07-11) ----

/** 채팅 한 줄을 보낸다. 단계 키는 그 소켓이 마지막으로 받은 view 에서 만든다(클라이언트가 하는 대로). pk 를 주면 그 값을 쓴다(단계 어긋남 시험). */
export function chatSend(sock: TestSocket, text: string, pk: string = phaseKeyOf(sock)): void {
  send(sock, { t: "chat", text, pk });
}

/** settle 이 돌려준 프레임 가운데 chat 프레임만 고른다. */
export function chatsOf(msgs: ServerMessage[]): Array<Extract<ServerMessage, { t: "chat" }>> {
  return msgs.filter((m): m is Extract<ServerMessage, { t: "chat" }> => m.t === "chat");
}

/** 모든 사람의 채팅 전송 기록(인메모리 chatRates)을 비운다 — 600ms 간격·5초 창을 실제로 기다리지 않게 한다. */
export async function resetChatRates(code: string): Promise<void> {
  await runInDurableObject(env.ROOM.getByName(code), async (instance) => {
    (instance["chatRates"] as Map<string, unknown>).clear();
  });
}
