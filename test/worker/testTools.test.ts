// 테스트 방 방장 도구 워커 통합 테스트(quick 261025-f09, 결정 0022): 실제 HTTP·소켓으로 testSkip·testReset·testRole 을 workerd 에서 확인한다.
// 실패 출력은 한 줄이어야 해서(TAP) 프레임 목록은 summary() 한 줄 문자열로 비교한다.
import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { NOMINATION_GATHER_MS } from "../../shared/game/phases";
import type { PhaseId, RoomView, ServerMessage } from "../../shared/protocol";
import { alarmOf, advanceTo, closePhase, collect, createRoom, driveToEnded, editRoom, nextFrame, seat, send, skipOnce, skipThrough, storedRoom, wanderTimes } from "./helpers";
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

/** 방장이 시작하고 assigning 을 모든 소켓이 받을 때까지. */
async function start(r: Seated): Promise<void> {
  send(r.host, { t: "start" });
  for (const s of allSockets(r)) await nextFrame(s, isPhase("assigning"));
}

/**
 * 방장이 testSkip 을 거듭해 phase 에 닿고 모든 소켓이 그 단계 state 를 받을 때까지. assigning 이어야 한다.
 * 저장된 단계를 보고 반복하고, 매번 소켓마다 "다음 state 프레임 하나" 를 기다린다(보내기 전에 읽을 위치를 맨 끝으로 옮겨 낡은 프레임을 건너뛴다).
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

describe("testBotVote", () => {
  const msg = (exec: string, pick: string): { t: string; exec: string; pick: string } => ({ t: "testBotVote", exec, pick });

  it("일반 방은 BAD_MESSAGE 오류 프레임 하나뿐이고 방 상태가 그대로다", async () => {
    const r = await seatQuiet(3);
    const before = JSON.stringify(await stored(r.code));
    for (const sock of allSockets(r)) {
      expect(summary(await sendAndSettle(sock, msg("no", "host")))).toBe("[error:BAD_MESSAGE]");
    }
    expect(JSON.stringify(await stored(r.code))).toBe(before);
    expect(Object.hasOwn(await stored(r.code), "testBotVote")).toBe(false);
  });

  it("손님은 NOT_HOST 와 그 소켓에만 state 가 가고 방장 소켓에는 프레임이 없다", async () => {
    const r = await seatQuiet(3, { testMode: true });
    const guest = r.guests[0]!;
    const hostMark = mark(r.host);
    expect(summary(await sendAndSettle(guest.sock, msg("no", "host")))).toBe("[error:NOT_HOST,state:lobby]");
    expect(summary(await settle(r.host, hostMark))).toBe("[]");
    expect(Object.hasOwn(await stored(r.code), "testBotVote")).toBe(false);
  });

  it("게임 중에는 WRONG_PHASE 와 방장 state 이고 저장된 방에 설정이 없다", async () => {
    const r = await seatQuiet(3, { testMode: true });
    await start(r);
    expect(summary(await sendAndSettle(r.host, msg("no", "host")))).toBe("[error:WRONG_PHASE,state:assigning]");
    expect(Object.hasOwn(await stored(r.code), "testBotVote")).toBe(false);
  });

  it("알 수 없는 값·빠진 키·추가 키는 BAD_MESSAGE 오류 프레임 하나뿐이다", async () => {
    const r = await seatQuiet(3, { testMode: true });
    expect(summary(await sendAndSettle(r.host, msg("maybe", "host")))).toBe("[error:BAD_MESSAGE]");
    expect(summary(await sendAndSettle(r.host, msg("yes", "everyone")))).toBe("[error:BAD_MESSAGE]");
    expect(summary(await sendAndSettle(r.host, { t: "testBotVote", exec: "yes" }))).toBe("[error:BAD_MESSAGE]");
    expect(summary(await sendAndSettle(r.host, { t: "testBotVote", exec: "yes", pick: "host", extra: 1 }))).toBe("[error:BAD_MESSAGE]");
    expect(Object.hasOwn(await stored(r.code), "testBotVote")).toBe(false);
  });

  it("방장이 보내면 방장 소켓만 state:lobby 를 받고(me.testBotVote 포함) 손님은 프레임이 없으며 저장된다", async () => {
    const r = await seatQuiet(3, { testMode: true });
    const marks = r.guests.map((g) => mark(g.sock));
    const own = await sendAndSettle(r.host, msg("no", "host"));
    expect(summary(own)).toBe("[state:lobby]");
    expect(JSON.stringify((own[0] as Extract<ServerMessage, { t: "state" }>).view.me.testBotVote)).toBe('{"exec":"no","pick":"host"}');
    for (const [i, g] of r.guests.entries()) expect(summary(await settle(g.sock, marks[i]!))).toBe("[]");
    expect(JSON.stringify((await stored(r.code)).testBotVote)).toBe('{"exec":"no","pick":"host"}');
  });

  it("같은 값을 다시 보내면 프레임이 없고, random 두 개는 설정을 지운다", async () => {
    const r = await seatQuiet(3, { testMode: true });
    await sendAndSettle(r.host, msg("yes", "other"));
    expect(summary(await sendAndSettle(r.host, msg("yes", "other")))).toBe("[]");
    const cleared = await sendAndSettle(r.host, msg("random", "random"));
    expect(summary(cleared)).toBe("[state:lobby]");
    expect(Object.hasOwn((cleared[0] as Extract<ServerMessage, { t: "state" }>).view.me, "testBotVote")).toBe(false);
    expect(Object.hasOwn(await stored(r.code), "testBotVote")).toBe(false);
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

  it("discussion 에서 넘기면 모든 소켓이 지목(모이기 phaseDurationMs 3000)을 받고, 표가 없이 다시 넘기면 밤이다 (DAY-07)", async () => {
    const r = await seatQuiet(3, { testMode: true });
    await start(r);
    await skipUntil(r, "discussion");
    for (const s of allSockets(r)) s.cursor = s.frames.length;
    send(r.host, { t: "testSkip" });
    for (const sock of allSockets(r)) {
      const msg = (await nextFrame(sock, isPhase("nomination"))) as Extract<ServerMessage, { t: "state" }>;
      expect(`${msg.view.phase}/${msg.view.phaseDurationMs}`).toBe(`nomination/${NOMINATION_GATHER_MS}`);
    }
    expect(String(await alarmOf(r.code))).toBe(String((await stored(r.code)).phaseEndsAt));
    for (const s of allSockets(r)) s.cursor = s.frames.length;
    send(r.host, { t: "testSkip" });
    for (const sock of allSockets(r)) {
      const msg = (await nextFrame(sock, isPhase("night"))) as Extract<ServerMessage, { t: "state" }>;
      expect(`${msg.view.phase}/${msg.view.phaseDurationMs}`).toBe("night/30000");
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
  const FORBIDDEN_ROOM = ["day", "morning", "lastPhrase", "nextNightSeq", "claimOrder", "claimIdx", "claimStart", "claimPick", "claimLog", "voteLog", "verdict"];
  const FORBIDDEN_PLAYER = ["role", "alive", "nightPick", "investigations", "lastSendAt", "execVote", "nominate", "verdictVote", "endVote"];

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

  it("discussion 도중에 되돌려도 차례 상태(claimOrder·claimIdx·claimStart·claimLog)가 하나도 없다", async () => {
    await resetFrom("discussion");
  }, 30_000);

  it("nomination 에서 되돌려도 같다", async () => {
    await resetFrom("nomination");
  }, 30_000);

  it("night 에서 되돌리면 같은 방이 대기실이 되고 다음 판에 같은 직업 지정이 다시 쓰인다", async () => {
    await resetFrom("night");
  }, 30_000);

  it("morning 에서 되돌려도 같다", async () => {
    await resetFrom("morning");
  }, 30_000);
});

// ---- 4페이즈: 투표 단계 넘기기·종료 중 도구 (VOTE-01, END-02, 결정 0022) ----
const lobbyOf = (n: number) => (m: ServerMessage): boolean => m.t === "state" && m.view.phase === "lobby" && m.view.players.length === n;

/** 방장 + 연결 손님 1 + 봇 3 테스트 방(방장 직업 마피아)을 시작해 종료까지 끌고 간다. */
async function endedRoom(): Promise<Seated> {
  const r = await seatQuiet(1, { testMode: true });
  send(r.host, { t: "testBots", count: 3 });
  await nextFrame(r.host, lobbyOf(5));
  await sendAndSettle(r.host, { t: "testRole", role: "mafia" });
  await start(r);
  await driveToEnded(r);
  for (const sock of allSockets(r)) await settle(sock, mark(sock));
  return r;
}

describe("투표 단계 넘기기와 종료 중 도구", () => {
  it("nomination 중 testSkip: 방장이 자기 차례에 지목한 표와 아직 차례가 안 온 봇의 표가 함께 세어진 뒤 넘어가고 저장된 voteLog 마지막 줄 지목 수는 살아 있는 봇 수 + 방장 표다 (결정 0063-1)", async () => {
    const r = await seatQuiet(0, { testMode: true });
    send(r.host, { t: "testBots", count: 3 });
    await nextFrame(r.host, lobbyOf(4));
    await start(r);
    await skipThrough(r, "nomination"); // 모이는 중
    await closePhase(r.code); // 방장(좌석 0)이 차례 순서 첫째
    await sendAndSettle(r.host, { t: "point", target: 1 });
    send(r.host, { t: "testSkip" });
    await nextFrame(r.host, (m) => m.t === "state" && m.view.phase !== "nomination");
    const cand = (await storedRoom(r.code)).voteLog!.at(-1)!.cand!;
    expect(String(cand.votes.length)).toBe("4");
    expect(String(cand.votes.some((v) => v.seat === 0 && v.target === 1))).toBe("true"); // 방장 지목은 그대로 세어졌다
  }, 30_000);

  it("ended 에서 testReset: 대기실이 되고 저장된 방·플레이어에 투표·종료 필드가 없으며 다시 시작하면 만료가 시작 + 3시간이다", async () => {
    const r = await endedRoom();
    expect((await storedRoom(r.code)).winner).toBe("citizenWin");
    send(r.host, { t: "testReset" });
    for (const sock of allSockets(r)) await nextFrame(sock, isPhase("lobby"));
    const room = await stored(r.code);
    for (const key of ["voteLog", "verdict", "execution", "lastExecPhrase", "nightLog", "winner"]) {
      expect(`${key}:${Object.hasOwn(room, key)}`).toBe(`${key}:false`);
    }
    for (const p of room.players as Array<Raw>) {
      for (const key of ["execVote", "candidateVote", "nominate", "verdictVote", "endVote", "role", "alive"]) expect(`${p.seat}:${key}:${Object.hasOwn(p, key)}`).toBe(`${p.seat}:${key}:false`);
    }
    // 대기실로 돌아온 테스트 방에 봇이 남아 방장이 연결되어 있으면 알람에 봇 배회 시각이 합쳐진다(06-08): 알람 = min(방 만료, 배회 시각).
    expect(String(await alarmOf(r.code))).toBe(String(Math.min(room.expiresAt as number, ...(await wanderTimes(r.code)))));
    const before = Date.now();
    send(r.host, { t: "start" });
    for (const sock of allSockets(r)) await nextFrame(sock, isPhase("assigning"));
    const after = Date.now();
    const expiresAt = (await storedRoom(r.code)).expiresAt;
    const THREE_HOURS = 10_800_000;
    expect(String(expiresAt >= before + THREE_HOURS && expiresAt <= after + THREE_HOURS)).toBe("true");
  }, 60_000);

  it("ended 에서 testSkip 은 보낸 소켓에만 WRONG_PHASE 와 state 이고 방은 그대로다", async () => {
    const r = await endedRoom();
    const guest = r.guests[0]!.sock;
    const guestMark = mark(guest);
    const before = JSON.stringify(await stored(r.code));
    expect(summary(await sendAndSettle(r.host, { t: "testSkip" }))).toBe("[error:WRONG_PHASE,state:ended]");
    expect(summary(await settle(guest, guestMark))).toBe("[]");
    expect(JSON.stringify(await stored(r.code))).toBe(before);
  }, 60_000);
});

// ---- P-13: 봇 투표 설정을 따라 한 판의 투표 분기가 결정적으로 정해진다 (E2E 결정성) ----
/** 소켓당 메시지 창(처리 한도)을 비운다: 방 DO 를 내려 메모리 창을 없앤다. 저장된 방은 그대로다. */
const resetRateWindow = (code: string): Promise<void> => editRoom(code, (room) => room);

/** 방장(마피아) + 연결 손님 1 + 봇 3 테스트 방에서 봇 투표 설정을 정하고 시작해 nomination 에 닿는다. 설정은 대기실에서만 바뀐다. */
async function votingRoom(exec: string, pick: string): Promise<Seated> {
  const r = await seatQuiet(1, { testMode: true });
  send(r.host, { t: "testBots", count: 3 });
  await nextFrame(r.host, lobbyOf(5));
  await sendAndSettle(r.host, { t: "testRole", role: "mafia" });
  expect(summary(await sendAndSettle(r.host, { t: "testBotVote", exec, pick }))).toBe("[state:lobby]");
  await start(r);
  await skipThrough(r, "nomination");
  for (const sock of allSockets(r)) await settle(sock, mark(sock));
  await resetRateWindow(r.code);
  return r;
}

describe("testSkip: 동점 결선을 한 번에 끝낸다 (09.1.1-05, 결정 0066-4)", () => {
  for (const step of [0, 1] as const) {
    it(`결선 step ${step} 에서 testSkip 한 번: 남은 산 봇이 던진 표가 집계되어 변론으로 가고 결선 상태·개인 표가 남지 않는다`, async () => {
      const r = await seatQuiet(0, { testMode: true });
      send(r.host, { t: "testBots", count: 3 });
      await nextFrame(r.host, lobbyOf(4));
      await sendAndSettle(r.host, { t: "testBotVote", exec: "random", pick: "host" }); // 봇 표는 방장 후보에게 — 결과를 고정한다
      await start(r);
      await skipThrough(r, "nomination");
      // 방장(0)과 봇 1 이 후보인 결선 상태를 세운다(지목 집계가 만드는 모양 그대로, 방장이 후보여도 도구는 막히지 않는다).
      await editRoom(r.code, (room) => {
        const { pickTurn: _pickTurn, botPlan: _botPlan, ...rest } = room as Record<string, unknown>;
        return { ...rest, phase: "runoff", runoff: { cand: [0, 1], step }, phaseEndsAt: Date.now() + 600_000 };
      });
      const from = mark(r.host);
      send(r.host, { t: "testSkip" });
      await nextFrame(r.host, (m) => m.t === "state" && m.view.phase !== "runoff");
      const frames = await settle(r.host, from);
      const room = await stored(r.code);
      expect(String(room.phase)).toBe("defense"); // 봇 둘(2·3)의 표가 모두 방장(0)에게 — 3초 안에 자연 마감으로 밤이 된 것이 아니다
      expect(Object.hasOwn(room, "runoff")).toBe(false);
      for (const p of room.players as Array<Raw>) expect(`${p.seat}:${Object.hasOwn(p, "runoffVote")}`).toBe(`${p.seat}:false`);
      expect(String((room.verdict as { candidate: number }).candidate)).toBe("0");
      expect(JSON.stringify(frames).includes("runoffVote")).toBe(false);
    }, 60_000);
  }
});

describe("testBotVote: 넘기기가 설정을 따른다", () => {
  it("exec no + pick host: 봇이 모두 방장을 지목해 방장이 변론자가 되고, 찬반에서 봇이 모두 반대라 부결 — 처형에서 탈락 없이 밤이 되고 밤 view 에 noExecution 키가 없다", async () => {
    const r = await votingRoom("no", "host");
    await skipOnce(r); // 지목 마감 → 변론(봇 셋이 방장을 가리켜 최다 한 명)
    expect(lastView(r.host).phase).toBe("defense");
    await resetRateWindow(r.code);
    await skipOnce(r); // 변론 → 찬반
    expect(lastView(r.host).phase).toBe("verdict");
    await resetRateWindow(r.code);
    await skipOnce(r); // 안 던진 봇이 설정대로 반대를 던지고 찬반 마감 → 처형
    const execution = lastView(r.host);
    expect(`${execution.phase}/${JSON.stringify(execution.day?.verdict)}`).toBe('execution/{"yes":0,"no":3,"passed":false}');
    expect(JSON.stringify((await storedRoom(r.code)).voteLog!.at(-1)!.exec)).toBe('{"yes":0,"no":3,"passed":false}');
    expect((await storedRoom(r.code)).players.every((p) => p.alive !== false)).toBe(true);
    await resetRateWindow(r.code);
    await skipOnce(r);
    const night = lastView(r.host);
    expect(`${night.phase}/${Object.hasOwn(night.day ?? {}, "noExecution")}`).toBe("night/false");
  }, 30_000);

  it("exec yes + pick host: 봇 표가 모두 방장에게 가서 방장이 변론자가 되고, 찬반이 통과해 방장이 처형된다", async () => {
    const r = await votingRoom("yes", "host");
    await skipOnce(r);
    const defense = lastView(r.host);
    expect(`${defense.phase}/${defense.day?.candidate}`).toBe("defense/0");
    const votes = (await storedRoom(r.code)).voteLog!.at(-1)!.cand!.votes.map((v) => `${v.seat}>${v.target}`).sort();
    expect(votes.join(",")).toBe("2>0,3>0,4>0"); // 손님(seat 1)은 안 던졌고 봇 셋(seat 2~4)이 모두 방장
    await resetRateWindow(r.code);
    await skipOnce(r);
    expect(lastView(r.host).phase).toBe("verdict");
    await resetRateWindow(r.code);
    await skipOnce(r); // 봇 셋 찬성 / 유권자 4(방장은 변론자) → 3 × 2 > 4 통과
    const execution = lastView(r.host);
    expect(`${execution.phase}/${JSON.stringify(execution.day?.verdict)}/${execution.day?.execution?.seat}`).toBe('execution/{"yes":3,"no":0,"passed":true}/0');
  }, 30_000);

  it("대기실로 되돌려도 방장 view 의 me.testBotVote 가 남고 손님 프레임에는 키가 한 번도 없다", async () => {
    const r = await votingRoom("no", "host");
    send(r.host, { t: "testReset" });
    for (const sock of allSockets(r)) await nextFrame(sock, isPhase("lobby"));
    for (const sock of allSockets(r)) await settle(sock, mark(sock));
    expect(JSON.stringify(lastView(r.host).me.testBotVote)).toBe('{"exec":"no","pick":"host"}');
    expect(JSON.stringify((await stored(r.code)).testBotVote)).toBe('{"exec":"no","pick":"host"}');
    const guestText = collect(r.guests[0]!.sock).join("\n");
    expect(guestText.includes("testBotVote")).toBe(false);
    expect(guestText.includes("testMode")).toBe(false);
  }, 30_000);
});
