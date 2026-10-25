// 테스트 방 방장 도구 워커 통합 테스트(quick 261025-f09, 결정 0022): 실제 HTTP·소켓으로 testSkip·testReset·testRole 을 workerd 에서 확인한다.
// 실패 출력은 한 줄이어야 해서(TAP) 프레임 목록은 summary() 한 줄 문자열로 비교한다.
import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { PhaseId, RoomView, ServerMessage } from "../../shared/protocol";
import { alarmOf, advanceTo, collect, createRoom, nextFrame, seat, send, storedRoom } from "./helpers";
import type { Seated, TestSocket } from "./helpers";

const allSockets = (r: Seated): TestSocket[] => [r.host, ...r.guests.map((g) => g.sock)];
const parse = (raw: string): ServerMessage => JSON.parse(raw) as ServerMessage;

/** 프레임 목록을 "[state:night,error:BAD_MESSAGE]" 같은 한 줄로. 빈 목록도 "[]" 라 비어 있지 않다. */
const summary = (msgs: ServerMessage[]): string =>
  `[${msgs
    .map((m) => (m.t === "state" ? `state:${m.view.phase}` : m.t === "error" ? `error:${m.code}` : m.t))
    .join(",")}]`;

let pingCounter = 0;
/** 행동 전에 적어 둔 frames 길이 이후 ~ pong 직전까지 받은 프레임 — "오지 않았음" 의 증명(ping/pong 사이). */
async function settle(sock: TestSocket, from: number): Promise<ServerMessage[]> {
  pingCounter += 1;
  const c = pingCounter;
  send(sock, { t: "ping", c });
  await nextFrame(sock, (m) => m.t === "pong" && m.c === c);
  return sock.frames.slice(from, sock.cursor - 1).map(parse);
}

const mark = (sock: TestSocket): number => sock.frames.length;

/** 방 꾸미기 중 늦게 도착하는 입장 방송을 모든 소켓에서 다 받은 뒤 시작하게 한다(ping/pong 으로 흘려 보낸다). */
async function seatQuiet(guests: number, options?: { testMode?: boolean }): Promise<Seated> {
  const r = await seat(guests, 0, options);
  for (const sock of allSockets(r)) await settle(sock, mark(sock));
  return r;
}
const isPhase = (phase: PhaseId) => (m: ServerMessage): boolean => m.t === "state" && m.view.phase === phase;

/** 보낸 소켓이 받은 프레임을 돌려준다. */
async function sendAndSettle(sock: TestSocket, msg: unknown): Promise<ServerMessage[]> {
  const from = mark(sock);
  send(sock, msg);
  return settle(sock, from);
}

/** 마지막 state view. */
function lastView(sock: TestSocket): RoomView {
  const views = collect(sock)
    .map(parse)
    .filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state")
    .map((m) => m.view);
  return views.at(-1)!;
}

type Raw = Record<string, unknown>;
const stored = async (code: string): Promise<Raw> => (await storedRoom(code)) as unknown as Raw;
const PHASE_ORDER: PhaseId[] = ["roleReveal", "dayAnnounce", "claim", "discussion", "night", "morning"];

/** 방장이 시작하고 assigning 을 모든 소켓이 받을 때까지. */
async function start(r: Seated): Promise<void> {
  send(r.host, { t: "start" });
  for (const s of allSockets(r)) await nextFrame(s, isPhase("assigning"));
}

/**
 * 방장이 testSkip 을 거듭해 phase 에 닿고 모든 소켓이 그 단계 state 를 받을 때까지. assigning 이어야 한다.
 * claim 은 차례 하나가 한 번의 넘기기라 같은 단계 state 가 여러 번 온다 — 그래서 저장된 단계를 보고 반복하고,
 * 매번 소켓마다 "다음 state 프레임 하나" 를 기다린다(보내기 전에 읽을 위치를 맨 끝으로 옮겨 낡은 프레임을 건너뛴다).
 */
async function skipUntil(r: Seated, phase: PhaseId): Promise<void> {
  for (let i = 0; i < 40 && (await stored(r.code)).phase !== phase; i += 1) {
    for (const s of allSockets(r)) s.cursor = s.frames.length;
    send(r.host, { t: "testSkip" });
    for (const s of allSockets(r)) await nextFrame(s, (m) => m.t === "state");
  }
  expect((await stored(r.code)).phase).toBe(phase);
}

describe("방 만들기 testMode", () => {
  it("testMode true 면 201 이고 저장된 방에 testMode true 가 있다", async () => {
    const { code } = await createRoom("방장", { testMode: true });
    expect(String((await stored(code)).testMode)).toBe("true");
  });

  it("testMode 가 없거나 false 면 testMode 키가 없다", async () => {
    const plain = await createRoom("방장");
    expect(Object.hasOwn(await stored(plain.code), "testMode")).toBe(false);
    const res = await exports.default.fetch("http://x/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname: "방장", testMode: false }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { code: string };
    expect(Object.hasOwn(await stored(body.code), "testMode")).toBe(false);
  });

  it("testMode 가 불리언이 아니면 400 BAD_REQUEST 다", async () => {
    const res = await exports.default.fetch("http://x/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname: "방장", testMode: "1" }),
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toBe('{"error":"BAD_REQUEST"}');
  });

  it("미리보기 응답에는 testMode·testRole 키가 없다", async () => {
    const { code } = await createRoom("방장", { testMode: true });
    const res = await exports.default.fetch(`http://x/api/rooms/${code}`);
    const text = await res.text();
    expect(text.includes("testMode") || text.includes("testRole")).toBe(false);
  });
});

describe("일반 방은 세 요청을 거부한다", () => {
  const MESSAGES = [{ t: "testSkip" }, { t: "testReset" }, { t: "testRole", role: "mafia" }];

  async function expectRejected(r: Seated, label: string): Promise<void> {
    const before = JSON.stringify((await stored(r.code)).players);
    const phaseBefore = (await stored(r.code)).phase;
    const endsBefore = (await stored(r.code)).phaseEndsAt;
    for (const sock of allSockets(r)) {
      for (const msg of MESSAGES) {
        expect(`${label}:${summary(await sendAndSettle(sock, msg))}`).toBe(`${label}:[error:BAD_MESSAGE]`);
      }
    }
    expect(String((await stored(r.code)).phase)).toBe(String(phaseBefore));
    expect(String((await stored(r.code)).phaseEndsAt)).toBe(String(endsBefore));
    expect(JSON.stringify((await stored(r.code)).players)).toBe(before);
  }

  it("대기실에서 방장·손님 모두 오류 프레임 하나뿐이고 방 상태가 그대로다", async () => {
    await expectRejected(await seatQuiet(3), "lobby");
  });

  it("discussion 에서도 방장·손님 모두 오류 프레임 하나뿐이고 방 상태가 그대로다", async () => {
    const r = await seatQuiet(3);
    await start(r);
    await advanceTo(r.code, allSockets(r), "discussion");
    await expectRejected(r, "discussion");
  });
});

describe("테스트 방 거부", () => {
  it("손님의 세 요청은 NOT_HOST 와 그 소켓에만 state 가 간다", async () => {
    const r = await seatQuiet(3, { testMode: true });
    const guest = r.guests[0]!;
    const hostMark = mark(r.host);
    for (const msg of [{ t: "testSkip" }, { t: "testReset" }, { t: "testRole", role: "mafia" }]) {
      expect(summary(await sendAndSettle(guest.sock, msg))).toBe("[error:NOT_HOST,state:lobby]");
    }
    expect(summary(await settle(r.host, hostMark))).toBe("[]");
    expect(Object.hasOwn(await stored(r.code), "testRole")).toBe(false);
  });

  it("방장의 대기실 testSkip·testReset 은 WRONG_PHASE 다", async () => {
    const r = await seatQuiet(3, { testMode: true });
    expect(summary(await sendAndSettle(r.host, { t: "testSkip" }))).toBe("[error:WRONG_PHASE,state:lobby]");
    expect(summary(await sendAndSettle(r.host, { t: "testReset" }))).toBe("[error:WRONG_PHASE,state:lobby]");
  });

  it("알 수 없는 키가 붙은 요청은 BAD_MESSAGE 오류뿐이다", async () => {
    const r = await seatQuiet(3, { testMode: true });
    expect(summary(await sendAndSettle(r.host, { t: "testSkip", extra: 1 }))).toBe("[error:BAD_MESSAGE]");
    expect(summary(await sendAndSettle(r.host, { t: "testRole", role: "wizard" }))).toBe("[error:BAD_MESSAGE]");
  });
});

describe("testRole", () => {
  it("마피아를 고르면 방장 소켓에만 me.testRole mafia state 가 가고 손님 소켓에는 프레임이 없다", async () => {
    const r = await seatQuiet(3, { testMode: true });
    const marks = r.guests.map((g) => mark(g.sock));
    const own = await sendAndSettle(r.host, { t: "testRole", role: "mafia" });
    expect(summary(own)).toBe("[state:lobby]");
    expect(String((own[0] as Extract<ServerMessage, { t: "state" }>).view.me.testRole)).toBe("mafia");
    for (const [i, g] of r.guests.entries()) expect(summary(await settle(g.sock, marks[i]!))).toBe("[]");
    expect(String((await stored(r.code)).testRole)).toBe("mafia");
  });

  it("같은 값을 다시 고르면 프레임이 없고, null 은 testRole 을 지운다", async () => {
    const r = await seatQuiet(3, { testMode: true });
    await sendAndSettle(r.host, { t: "testRole", role: "police" });
    expect(summary(await sendAndSettle(r.host, { t: "testRole", role: "police" }))).toBe("[]");
    const cleared = await sendAndSettle(r.host, { t: "testRole", role: null });
    expect(summary(cleared)).toBe("[state:lobby]");
    expect(Object.hasOwn((cleared[0] as Extract<ServerMessage, { t: "state" }>).view.me, "testRole")).toBe(false);
    expect(Object.hasOwn(await stored(r.code), "testRole")).toBe(false);
  });

  it("4명 대기실에서 doctor 는 BAD_MESSAGE 와 방장 state 뿐이다", async () => {
    const r = await seatQuiet(3, { testMode: true });
    expect(summary(await sendAndSettle(r.host, { t: "testRole", role: "doctor" }))).toBe("[error:BAD_MESSAGE,state:lobby]");
    expect(Object.hasOwn(await stored(r.code), "testRole")).toBe(false);
  });
});

describe("testSkip", () => {
  it("assigning 에서 넘기면 모든 소켓이 각자 view 의 roleReveal 을 받고 방장이 마피아다", async () => {
    const r = await seatQuiet(3, { testMode: true });
    await sendAndSettle(r.host, { t: "testRole", role: "mafia" });
    await start(r);
    send(r.host, { t: "testSkip" });
    const seats = [0, ...r.guests.map((g) => g.seat)];
    for (const [i, sock] of allSockets(r).entries()) {
      const msg = (await nextFrame(sock, isPhase("roleReveal"))) as Extract<ServerMessage, { t: "state" }>;
      expect(String(msg.view.me.seat)).toBe(String(seats[i]));
    }
    expect(String(lastView(r.host).me.role)).toBe("mafia");
    for (const g of r.guests) {
      const text = collect(g.sock).join("\n");
      expect(text.includes("testMode") || text.includes("testRole")).toBe(false);
    }
    const room = await stored(r.code);
    expect(String(await alarmOf(r.code))).toBe(String(room.phaseEndsAt));
    expect(summary(await sendAndSettle(r.host, { t: "testRole", role: "police" }))).toBe("[error:WRONG_PHASE,state:roleReveal]");
  }, 30_000);

  it("claim 중에는 한 번에 한 차례만 넘어가고(지금 차례가 none) 마지막 차례에서 낮 토론으로 간다", async () => {
    const r = await seatQuiet(3, { testMode: true });
    await start(r);
    await skipUntil(r, "claim");
    for (const sock of allSockets(r)) expect(String(lastView(sock).day?.turn?.seat)).toBe("0");

    for (let turn = 1; turn <= 3; turn += 1) {
      for (const s of allSockets(r)) s.cursor = s.frames.length;
      send(r.host, { t: "testSkip" });
      for (const sock of allSockets(r)) {
        const msg = (await nextFrame(sock, (m) => m.t === "state")) as Extract<ServerMessage, { t: "state" }>;
        expect(`${msg.view.phase}:${msg.view.day?.turn?.seat}:${msg.view.day?.claimLog?.length}`).toBe(`claim:${turn}:${turn}`);
        expect(msg.view.day?.claimLog?.every((l) => l.claim === "none")).toBe(true);
      }
      expect(String(await alarmOf(r.code))).toBe(String((await stored(r.code)).phaseEndsAt));
    }
    for (const s of allSockets(r)) s.cursor = s.frames.length;
    send(r.host, { t: "testSkip" });
    for (const sock of allSockets(r)) {
      const msg = (await nextFrame(sock, (m) => m.t === "state")) as Extract<ServerMessage, { t: "state" }>;
      expect(`${msg.view.phase}:${msg.view.day?.claimLog?.length}`).toBe("discussion:4");
    }
  }, 30_000);

  it("밤에 마피아가 시민을 고른 뒤 넘기면 모든 소켓이 같은 아침을 받고 다시 넘기면 2일차 낮 시작 발표다", async () => {
    const r = await seatQuiet(3, { testMode: true });
    await sendAndSettle(r.host, { t: "testRole", role: "mafia" });
    await start(r);
    await skipUntil(r, "night");
    const victim = r.guests[0]!;
    await sendAndSettle(r.host, { t: "pick", target: victim.seat });
    send(r.host, { t: "testSkip" });
    const mornings: string[] = [];
    for (const sock of allSockets(r)) {
      const msg = (await nextFrame(sock, isPhase("morning"))) as Extract<ServerMessage, { t: "state" }>;
      mornings.push(JSON.stringify(msg.view.day?.morning));
    }
    expect(mornings[0]!.includes(`"eliminated":${victim.seat}`)).toBe(true);
    expect(new Set(mornings).size).toBe(1);

    send(r.host, { t: "testSkip" });
    for (const sock of allSockets(r)) {
      const msg = (await nextFrame(sock, isPhase("dayAnnounce"))) as Extract<ServerMessage, { t: "state" }>;
      expect(String(msg.view.day?.n)).toBe("2");
    }
    expect((await stored(r.code)).phase).toBe("dayAnnounce");
    expect(String((await stored(r.code)).day)).toBe("2");
  }, 30_000);
});

describe("testReset", () => {
  const FORBIDDEN_ROOM = ["day", "morning", "lastPhrase", "nextNightSeq", "claimOrder", "claimIdx", "claimStart", "claimPick", "claimLog"];
  const FORBIDDEN_PLAYER = ["role", "alive", "nightPick", "investigations", "lastSendAt"];

  async function resetFrom(phase: PhaseId): Promise<void> {
    const r = await seatQuiet(3, { testMode: true });
    await sendAndSettle(r.host, { t: "testRole", role: "mafia" });
    await start(r);
    await skipUntil(r, phase);
    const before = JSON.stringify(((await stored(r.code)).players as Array<Raw>).map((p) => p.connected));
    const marks = allSockets(r).map(mark);
    send(r.host, { t: "testReset" });
    for (const sock of allSockets(r)) await nextFrame(sock, isPhase("lobby"));

    const room = await stored(r.code);
    expect(room.phase).toBe("lobby");
    expect(String(room.phaseEndsAt)).toBe("null");
    for (const key of FORBIDDEN_ROOM) expect(`${key}:${Object.hasOwn(room, key)}`).toBe(`${key}:false`);
    for (const p of room.players as Array<Raw>) {
      for (const key of FORBIDDEN_PLAYER) expect(`${key}:${Object.hasOwn(p, key)}`).toBe(`${key}:false`);
    }
    expect(JSON.stringify((room.players as Array<Raw>).map((p) => p.connected))).toBe(before);
    expect(String(room.testMode)).toBe("true");
    expect(String(room.testRole)).toBe("mafia");
    expect(String(await alarmOf(r.code))).toBe(String(room.expiresAt));

    for (const g of r.guests) {
      const frames = g.sock.frames.slice(marks[allSockets(r).indexOf(g.sock)]!).join("\n");
      expect(/mafia|police|doctor|citizen/.test(frames)).toBe(false);
    }
    expect(Object.hasOwn(lastView(r.guests[0]!.sock), "day")).toBe(false);

    send(r.host, { t: "start" });
    for (const sock of allSockets(r)) await nextFrame(sock, isPhase("assigning"));
    send(r.host, { t: "testSkip" });
    for (const sock of allSockets(r)) await nextFrame(sock, isPhase("roleReveal"));
    expect(String(lastView(r.host).me.role)).toBe("mafia");
  }

  it("claim 도중에 되돌려도 차례 상태(claimOrder·claimIdx·claimStart·claimLog)가 모두 지워진다", async () => {
    await resetFrom("claim");
  }, 30_000);

  it("night 에서 되돌리면 같은 방이 대기실이 되고 다음 판에 같은 직업 지정이 다시 쓰인다", async () => {
    await resetFrom("night");
  }, 30_000);

  it("morning 에서 되돌려도 같다", async () => {
    await resetFrom("morning");
  }, 30_000);
});
