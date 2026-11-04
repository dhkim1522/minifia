// 워커 통합 테스트 도우미. 테스트마다 만들기 응답의 새 코드를 쓴다(고정 코드 재사용 금지).
import { env, exports } from "cloudflare:workers";
import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { expect } from "vitest";
import type { ChatLineWire, CreateRoomResponse, PhaseId, RoleId, RoomView, ServerMessage } from "../../shared/protocol";

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
  /** 09.1 순차 지목 서버 전용 차례 상태(결정 0063-1): 있으면 지목이 차례 방식이다. */
  pickTurn?: { order: number[]; i: number; endsAt?: number; doneAt?: number; skip?: boolean };
  /** 09.1.1-04 서버 전용 동점 결선 상태(결정 0066-4): cand 는 후보 좌석 둘, step 0 앞머리 · 1 투표 · 2 결과. */
  runoff?: { cand: [number, number]; step: 0 | 1 | 2; tally?: [number, number] };
  /** 8페이즈 서버 전용 개인 값: 지목·찬반·토론 끝내기. 마감 훅이 키째 지우고 토론 진입 훅이 끝내기를 지운다(결정 0060). */
  players: Array<{ role?: string; runoffVote?: number; execVote?: boolean; candidateVote?: number; nominate?: number; verdictVote?: boolean; endVote?: boolean; alive?: boolean }>;
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
 * 채팅 전송 기록(chatRates)은 DO 메모리에만 있어 evict 하면 비고, 줄(chatLog)은 07-14 부터 저장소에서 복원되지만 evict 없이 넘기는 쪽이 단계 넘김 시험을 단순하게 둔다.
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
 * 지목으로 단계를 넘긴다(08-11): targetBySeat[행위자 seat] = 대상 seat 에 든 사람이 point 를 보내고(없는 사람은 안 던진다),
 * 모든 actor 가 자기 소켓을 flush 한 뒤 마감을 당겨 지목을 벗어난 단계 state 를 모두 받을 때까지 기다린다. 마감 시각을 돌려준다.
 * 최다 한 명이면 변론, 동률·0표면 밤으로 간다(마감 훅).
 */
export async function pointAll(code: string, actors: Actor[], targetBySeat: Readonly<Record<number, number>>): Promise<number> {
  // 09.1-03: 지목 방식과 무관 — 저장된 방에 pickTurn 이 있으면 차례를 좌석 순으로 걷는다(결정 0063-1).
  if ((await storedRoom(code)).pickTurn !== undefined) return walkPickTurns(code, actors, targetBySeat);
  const marks = actors.map((a) => mark(a.sock));
  for (const a of actors) {
    if (Object.hasOwn(targetBySeat, a.seat)) send(a.sock, { t: "point", target: targetBySeat[a.seat] });
  }
  for (let i = 0; i < actors.length; i += 1) await settle(actors[i]!.sock, marks[i]!);
  const deadline = await closePhase(code);
  await untilLeft(actors, "nomination");
  return deadline;
}

/**
 * 순차 지목을 끝까지 걷는다: 저장된 방을 읽어 차례 주인(미확정)이 targetBySeat 에 있으면 그 소켓에서 point 를 보내고 모든 소켓을 flush,
 * 아니면 마감을 당겨 한 걸음 넘긴다(기권·사이·모이기·끝 알림). 지목을 벗어난 단계 state 를 모두 받으면 마지막 closePhase 의 마감을 돌려준다.
 */
async function walkPickTurns(code: string, actors: Actor[], targetBySeat: Readonly<Record<number, number>>): Promise<number> {
  let deadline = 0;
  for (let guard = 0; guard < 40; guard += 1) {
    const room = await storedRoom(code);
    const turn = room.pickTurn;
    if (room.phase !== "nomination" || turn === undefined) break;
    const seat = turn.i >= 0 && turn.i < turn.order.length && turn.doneAt === undefined ? turn.order[turn.i] : undefined;
    const actor = seat === undefined ? undefined : actors.find((a) => a.seat === seat);
    if (actor !== undefined && Object.hasOwn(targetBySeat, actor.seat)) {
      const marks = actors.map((a) => mark(a.sock));
      send(actor.sock, { t: "point", target: targetBySeat[actor.seat] });
      for (let i = 0; i < actors.length; i += 1) await settle(actors[i]!.sock, marks[i]!);
      continue;
    }
    deadline = await closePhase(code);
  }
  await untilLeft(actors, "nomination");
  return deadline;
}

/**
 * 동점 결선을 끝까지 걷는다(09.1.1-04, 결정 0066-4): 저장된 방을 읽어 runoff 인 동안 한 걸음씩 마감을 당긴다. 투표 창(step 1)에 들어서면 한 번만
 * voteBySeat[행위자 seat] = 후보 좌석 에 든 사람이 `point` 를 보내고 모든 소켓을 flush 한 뒤 넘긴다. runoff 를 벗어난 단계 state 를 모두 받으면 마지막 마감 시각을 돌려준다.
 */
export async function runoffAll(code: string, actors: Actor[], voteBySeat: Readonly<Record<number, number>>): Promise<number> {
  let deadline = 0;
  let voted = false;
  for (let guard = 0; guard < 10; guard += 1) {
    const room = await storedRoom(code);
    if (room.phase !== "runoff" || room.runoff === undefined) break;
    if (room.runoff.step === 1 && !voted) {
      voted = true;
      const marks = actors.map((a) => mark(a.sock));
      for (const a of actors) {
        if (Object.hasOwn(voteBySeat, a.seat)) send(a.sock, { t: "point", target: voteBySeat[a.seat] });
      }
      for (let i = 0; i < actors.length; i += 1) await settle(actors[i]!.sock, marks[i]!);
    }
    deadline = await closePhase(code);
  }
  await untilLeft(actors, "runoff");
  return deadline;
}

/**
 * 찬반으로 단계를 넘긴다(pointAll 과 같은 모양): agreeBySeat[유권자 seat] = 찬성 여부. 마감을 당겨 찬반을 벗어난 단계(처형)를 모두 받을 때까지 기다린다.
 * 마감 시각을 돌려준다. 변론자는 던질 수 없으니 agreeBySeat 에 넣지 않는다.
 */
export async function verdictAll(code: string, actors: Actor[], agreeBySeat: Readonly<Record<number, boolean>>): Promise<number> {
  const marks = actors.map((a) => mark(a.sock));
  for (const a of actors) {
    if (Object.hasOwn(agreeBySeat, a.seat)) send(a.sock, { t: "verdict", agree: agreeBySeat[a.seat] });
  }
  for (let i = 0; i < actors.length; i += 1) await settle(actors[i]!.sock, marks[i]!);
  const deadline = await closePhase(code);
  await untilLeft(actors, "verdict");
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

/** 저장된 플레이어 가운데 key 가 정해진 사람 수(서버 전용 개인 표: 지목 nominate·찬반 verdictVote). */
export async function votesIn(code: string, key: "nominate" | "verdictVote"): Promise<number> {
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
  // 08-11: 낮 단계가 늘어(지목·찬반 + 변론자 걷기) 전체 시험이 동시에 돌 때 DO 재기동 뒤 첫 전이가 기본 3초를 넘기는 일이 있어 한도를 넓힌다.
  for (const s of socks) await nextFrame(s, (m) => m.t === "state", 10_000);
}

/** 저장된 단계가 phase 가 될 때까지 skipOnce 를 거듭한다. */
export async function skipThrough(seated: Seated, phase: PhaseId): Promise<void> {
  for (let i = 0; i < 40 && (await storedRoom(seated.code)).phase !== phase; i += 1) await skipOnce(seated);
  expect((await storedRoom(seated.code)).phase).toBe(phase);
}

/**
 * 시작된 테스트 방(방장 + 봇, 방장 직업은 마피아로 지정해 두어야 한다)을 지목부터 종료까지 끌고 간다(08-11).
 * 지목은 봇 전원이 방장(seat 0)을, 방장이 seat 1 을 골라 방장이 변론자가 된다. 찬반은 봇 전원 찬성(방장은 변론자라 던지지 않는다) → 통과 → 마피아 처형 → 시민 승리.
 * hook 은 두 단계에서 표를 손으로 정하기 전에 불린다(봇이 실제로 던지게 하는 데 쓴다).
 */
export async function driveToEnded(seated: Seated, hook?: (stage: "nomination" | "verdict") => Promise<void>): Promise<void> {
  await skipThrough(seated, "nomination");
  await hook?.("nomination");
  await editRoom(seated.code, (room) =>
    mapPlayers(room, (p) => (p.isBot === true ? { ...p, nominate: 0 } : p.seat === 0 ? { ...p, nominate: 1 } : p)),
  );
  await skipOnce(seated);
  expect((await storedRoom(seated.code)).phase).toBe("defense");
  await skipThrough(seated, "verdict");
  await hook?.("verdict");
  await editRoom(seated.code, (room) => mapPlayers(room, (p) => (p.isBot === true ? { ...p, verdictVote: true } : p)));
  await skipThrough(seated, "ended");
}

// ---- 6페이즈 로비 이동 저장소 도우미(06-08) ----

/** storage "world" 키의 저장 모양(StoredWorld). 키가 없으면 undefined. */
export interface StoredWorldRecord {
  v: number;
  segs: Record<string, { p: number[]; t0: number; v: number }>;
  /** 토론이 끝난 자리 기억(결정 0061-5, 09-04). 지도 단계의 낮 지목부터 있다. */
  home?: { day: number; pos: Record<string, [number, number]> };
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

// ---- 7페이즈 채팅 보관·복원 도우미(07-14) ----

/** storage 의 chat: 키 전부(키 오름차순). 줄 하나가 키 하나(결정 0058-1). */
export async function chatKeysOf(code: string): Promise<string[]> {
  return Object.keys(await chatRecordsOf(code));
}

/** storage 의 chat: 레코드(키 -> 값). 값은 ChatRecord 모양(g·ch·seq·seat·text·at·n·r). */
export async function chatRecordsOf(code: string): Promise<Record<string, Record<string, unknown>>> {
  const out: Record<string, Record<string, unknown>> = {};
  await runInDurableObject(env.ROOM.getByName(code), async (_i, state) => {
    const listed = await state.storage.list<Record<string, unknown>>({ prefix: "chat:" });
    for (const [key, value] of listed) out[key] = value;
  });
  return out;
}

/** 소켓이 받은 모든 프레임을 읽은 위치와 상관없이 해석한 것. */
export function framesOf(sock: TestSocket): ServerMessage[] {
  return sock.frames.map(parseFrame);
}

/** 프레임 목록에서 마지막 chatLog 프레임의 줄. chatLog 가 없으면 null(빈 배열과 구별한다). */
export function chatLogOf(msgs: ServerMessage[]): ChatLineWire[] | null {
  const frames = msgs.filter((m): m is Extract<ServerMessage, { t: "chatLog" }> => m.t === "chatLog");
  return frames.length === 0 ? null : frames[frames.length - 1]!.lines;
}

/** hello 를 보내고 chatLog 프레임이 올 때까지 기다려 그 줄을 돌려준다(state·snap 은 소켓의 frames 에 남는다). */
export async function helloForLog(sock: TestSocket, token: string): Promise<ChatLineWire[]> {
  send(sock, { t: "hello", token });
  const frame = (await nextFrame(sock, (m) => m.t === "chatLog")) as Extract<ServerMessage, { t: "chatLog" }>;
  return frame.lines;
}

/** 줄을 'ch/seat/seq/text' 한 줄 문자열로(실패 보고가 한 줄이어야 한다). */
export const lineText = (l: ChatLineWire): string => `${l.ch}/${l.seat}/${l.seq}/${l.text}`;

// ---- 7페이즈 누설 검사 시나리오 도우미(07-14) ----

/** 실제로 시작한 6명 판: 방 코드, 소켓(방장 먼저), 역할을 읽은 사람들. */
export interface Game {
  code: string;
  socks: TestSocket[];
  actors: Actor[];
}

/**
 * 6명 판(방장 + 손님 5, guests 로 바꿀 수 있다)을 시작해 원하는 단계까지 마감을 당기고, 모든 소켓의 프레임을 ping/pong 으로 flush 해 둔 채 돌려준다.
 * 역할은 무작위라 dayAnnounce 에서 읽는다. 마피아 둘·경찰·의사·시민 둘이다.
 */
export async function startedGame(phase: PhaseId, guests = 5): Promise<Game> {
  const room = await seat(guests, 0);
  const socks = [room.host, ...room.guests.map((g) => g.sock)];
  send(room.host, { t: "start" });
  for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
  await advanceTo(room.code, socks, "dayAnnounce");
  for (const sock of socks) await settle(sock, mark(sock));
  const actors = actorsOf(room);
  await advanceTo(room.code, socks, phase);
  for (const sock of socks) await settle(sock, mark(sock));
  return { code: room.code, socks, actors };
}

/** 역할이 role 인 사람들(seat 오름차순). */
export const withRole = (g: Game, role: RoleId): Actor[] => g.actors.filter((a) => a.role === role).sort((a, b) => a.seat - b.seat);

/** 저장된 방에서 이 좌석들을 탈락시킨다(DO 가 evict 되어 저장소에서 다시 읽는다 — 소켓은 하이버네이션으로 남는다). */
export async function killSeats(g: Game, seats: number[]): Promise<void> {
  await editRoom(g.code, (room) => mapPlayers(room, (p) => (seats.includes(p.seat as number) ? { ...p, alive: false } : p)));
}

/** 잠깐 기다린다(관찰 구간의 길이를 맞출 때). */
export const pause = (ms: number): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ---- 8페이즈 낮 처형 도우미(08-07) ----

/**
 * 저장된 방을 phase 로 옮긴다(editRoom 래퍼 — DO 가 evict 되어 저장소에서 다시 읽고 소켓은 하이버네이션으로 남는다). 흐름 전환 전(08-11)이라
 * 시험은 이렇게 지목·찬반 단계로 들어간다. 마감은 60초 뒤, 일차는 그대로(없으면 1)다. patch 로 후보(verdict)·표 같은 저장 상태를 더 고친다.
 */
export async function toPhase(
  code: string,
  phase: PhaseId,
  patch?: (room: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  await editRoom(code, (room) => {
    const next = { ...room, phase, phaseEndsAt: Date.now() + 60_000, day: (room.day as number | undefined) ?? 1 };
    return patch ? patch(next) : next;
  });
}

/** 지목 한 번을 보낸다(대상 좌석). 행위자는 소켓 첨부 playerId 로만 정해진다. */
export function pointAs(sock: TestSocket, target: number): void {
  send(sock, { t: "point", target });
}

/** 찬반 한 표를 보낸다(찬성 true / 반대 false). 행위자는 소켓 첨부 playerId 로만 정해진다. */
export function verdictAs(sock: TestSocket, agree: boolean): void {
  send(sock, { t: "verdict", agree });
}

/** 토론 끝내기를 누르거나(on true) 취소한다(on false). */
export function endAs(sock: TestSocket, on: boolean): void {
  send(sock, { t: "endDiscussion", on });
}

// ---- 8페이즈 유령 위치 누설 도우미(08-09) ----

/**
 * 좌석들을 탈락시키고(killSeats) 모든 소켓을 flush 해 DO 가 저장소의 새 상태로 다시 깬 뒤의 모습을 돌려준다 —
 * 유령이 된 사람들(ghosts)과 산 사람들(living). 소켓의 마지막 view 는 그대로이므로(탈락은 저장 편집이라 방송이 없다) 좌석으로만 구분한다.
 */
export async function ghostsOf(g: Game, seats: number[]): Promise<{ ghosts: Actor[]; living: Actor[] }> {
  await killSeats(g, seats);
  for (const sock of g.socks) await settle(sock, mark(sock));
  return { ghosts: g.actors.filter((a) => seats.includes(a.seat)), living: g.actors.filter((a) => !seats.includes(a.seat)) };
}

/** 소켓이 받은 world 프레임(move·snap)을 순서대로. from 은 mark 이후만 볼 때의 시작 위치다. */
export function worldFramesOf(sock: TestSocket, from = 0): Array<Extract<ServerMessage, { t: "world" }>> {
  return sock.frames
    .slice(from)
    .map(parseFrame)
    .filter((m): m is Extract<ServerMessage, { t: "world" }> => m.t === "world");
}

/** 모이는 자리 기억(인메모리 world.lay, 08-09)과 서버 주도 이동이 건드리면 안 되는 lastMoveAt 의 사람 수. */
export async function layOf(code: string): Promise<{ key: string | null; slots: Record<string, [number, number]>; lastMoveAtCount: number }> {
  let out: { key: string | null; slots: Record<string, [number, number]>; lastMoveAtCount: number } = { key: null, slots: {}, lastMoveAtCount: -1 };
  await runInDurableObject(env.ROOM.getByName(code), async (instance) => {
    const world = instance["world"] as { lay?: { key: string; slots: Record<string, [number, number]> }; lastMoveAt: Record<string, number> };
    out = { key: world.lay?.key ?? null, slots: world.lay?.slots ?? {}, lastMoveAtCount: Object.keys(world.lastMoveAt).length };
  });
  return out;
}

// ---- 9페이즈 밤·아침 누설 도우미(09-09): ghostLeak.test.ts 의 지역 도우미를 옮겨 nightLeak.test.ts 와 함께 쓴다 ----

/** 행동 직전 모든 소켓의 위치를 적고, 행동하고, 모든 소켓을 flush 해 소켓별 프레임을 돌려준다. 보낸 쪽 flush 가 먼저다(처리를 마쳤다는 증거). */
export async function observe(g: Game, first: Actor, act: () => void | Promise<void>): Promise<ServerMessage[][]> {
  const marks = g.socks.map((s) => mark(s));
  await act();
  const order = [first, ...g.actors.filter((a) => a !== first)];
  const out: ServerMessage[][] = g.actors.map(() => []);
  for (const a of order) out[g.actors.indexOf(a)] = await settle(a.sock, marks[g.actors.indexOf(a)]!);
  return out;
}

/** 두 구간을 비교할 때 달라도 되는 휘발 필드. */
export const VOLATILE = new Set(["serverNow", "phaseEndsAt", "t0", "at", "c", "seq"]);

/** 휘발 필드(서버 시각·마감·구간 시작·줄 시각·핑 번호·채널별 줄 번호)를 지운 프레임 열 한 줄. 두 구간은 같은 방의 앞뒤라 줄 번호만 다르다. */
export function stable(msgs: ServerMessage[]): string {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v !== null && typeof v === "object") {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => !VOLATILE.has(k)).map(([k, x]) => [k, strip(x)]));
    }
    return v;
  };
  return msgs.map((m) => JSON.stringify(strip(m))).join("|");
}

/** 이동 한 번을 보낸다. 행위자는 소켓 첨부 playerId 로만 정해진다. */
export function moveAs(actor: Actor, x: number, z: number): void {
  send(actor.sock, { t: "move", x, z });
}

/** 밤 지목 한 번을 보낸다(대상 좌석). */
export function pickAs(actor: Actor, seatNo: number): void {
  send(actor.sock, { t: "pick", target: seatNo });
}

/** 프레임 열 중 마지막 world snap 의 좌석 오름차순 문자열('0,2,3'). snap 이 없으면 'none'. */
export function snapSeatsOf(msgs: ServerMessage[]): string {
  const snaps = msgs.filter((m): m is Extract<ServerMessage, { t: "world"; k: "snap" }> => m.t === "world" && m.k === "snap");
  const last = snaps.at(-1);
  return last === undefined ? "none" : last.ents.map((e) => e.s).sort((a, b) => a - b).join(",");
}

/** 저장된 방의 id → 좌석. */
async function seatOfId(code: string): Promise<Record<string, number>> {
  const room = (await storedRoom(code)) as unknown as { players: Array<{ id: string; seat: number }> };
  return Object.fromEntries(room.players.map((p) => [p.id, p.seat]));
}

/** 저장된 home 기억을 '좌석:x,z' 오름차순 문자열로('일차|0:100,200|1:...'). 기억이 없으면 'none'. */
export async function homeBySeat(code: string): Promise<string> {
  const world = await worldOf(code);
  if (world?.home === undefined) return "none";
  const seats = await seatOfId(code);
  const rows = Object.entries(world.home.pos).map(([id, pt]) => [seats[id]!, pt] as const).sort((a, b) => a[0] - b[0]);
  return `${world.home.day}|${rows.map(([s, pt]) => `${s}:${pt[0]},${pt[1]}`).join("|")}`;
}

/** 저장된 위치의 구간 끝점(걷던 사람은 가던 곳)을 homeBySeat 와 같은 모양으로('일차' 자리는 day). */
export async function segEndsBySeat(code: string, day: number): Promise<string> {
  const world = await worldOf(code);
  const seats = await seatOfId(code);
  const rows = Object.entries(world?.segs ?? {}).map(([id, seg]) => [seats[id]!, seg.p.slice(-2)] as const).sort((a, b) => a[0] - b[0]);
  return `${day}|${rows.map(([s, pt]) => `${s}:${pt[0]},${pt[1]}`).join("|")}`;
}

// ---- 9페이즈 메타모픽 비교 도우미(09-16) ----

/** snapshotStorage 가 알람 시각을 담아 두는 맵 키(저장소 키와 겹치지 않는다). */
const ALARM_KEY = "\u0000alarm";

/**
 * 방 DO 저장소 전체(room·world·chat:* …)와 알람 시각을 떠 둔다. 같은 방·같은 밤 시작 상태에서 두 구간을 돌려 프레임 열을 비교하는 데 쓴다
 * (메타모픽, UI-SPEC L2). 디바운스 대기 중인 위치 저장은 먼저 비운다 — 그렇지 않으면 스냅샷 뒤에 옛 위치가 덮어쓴다.
 */
export async function snapshotStorage(code: string): Promise<Map<string, unknown>> {
  await flushWorld(code);
  const snap = new Map<string, unknown>();
  await runInDurableObject(env.ROOM.getByName(code), async (_i, state) => {
    for (const [key, value] of await state.storage.list()) snap.set(key, structuredClone(value));
    snap.set(ALARM_KEY, await state.storage.getAlarm());
  });
  return snap;
}

/**
 * 저장소를 모두 지우고 스냅샷대로 되돌린 뒤 DO 를 evict 한다(생성자가 저장소에서 다시 읽고 소켓은 하이버네이션으로 남는다). 알람도 스냅샷 때 값으로 되돌린다.
 * 대기 중인 위치 저장 타이머는 먼저 비워 복원 뒤에 옛 위치가 덮어쓰지 못하게 한다.
 */
export async function restoreStorage(code: string, snap: Map<string, unknown>): Promise<void> {
  await flushWorld(code);
  const stub = env.ROOM.getByName(code);
  await runInDurableObject(stub, async (_i, state) => {
    await state.storage.deleteAll();
    // put 은 한 번에 키 128개까지라 나눠서 넣는다.
    const pairs = [...snap].filter(([key]) => key !== ALARM_KEY);
    for (let i = 0; i < pairs.length; i += 100) {
      await state.storage.put(Object.fromEntries(pairs.slice(i, i + 100).map(([key, value]) => [key, structuredClone(value)])));
    }
    const alarm = snap.get(ALARM_KEY) as number | null | undefined;
    if (typeof alarm === "number") await state.storage.setAlarm(alarm);
    else await state.storage.deleteAlarm();
  });
  await evictDurableObject(stub);
}
