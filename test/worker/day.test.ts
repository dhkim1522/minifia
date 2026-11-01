// 낮 토론 워커 통합 테스트(02-05, 03.1-02): 실제 소켓·알람으로 낮 토론(07-08 이후 순차 주장 없음)·빠른 메시지·이모티콘·연장·넘기기를 workerd 에서 확인한다.
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { env } from "cloudflare:workers";
import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { advanceTo, alarmOf, backdateSends, collect, connect, flat, forceDue, hello, nextFrame, nextState, seat, send, storedRoom } from "./helpers";
import type { Seated, TestSocket } from "./helpers";

const allSockets = (r: Seated): TestSocket[] => [r.host, ...r.guests.map((g) => g.sock)];

const viewsIn = (sock: TestSocket, phase: string): RoomView[] =>
  collect(sock)
    .map((raw) => JSON.parse(raw) as ServerMessage)
    .filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state" && m.view.phase === phase)
    .map((m) => m.view);

/** 방장 + 연결 손님 4명(5명 방)을 시작하고 낮 토론까지 알람을 넘긴다(07-08: 낮 시작 발표 다음이 바로 토론). */
async function startedAt(phase: "discussion", guests = 4): Promise<Seated> {
  const r = await seat(guests, 0);
  send(r.host, { t: "start" });
  for (const s of allSockets(r)) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "assigning");
  await advanceTo(r.code, allSockets(r), phase);
  return r;
}

const lastOf = (sock: TestSocket, phase: string): RoomView => viewsIn(sock, phase).at(-1)!;

const errorCode = async (sock: TestSocket): Promise<string> => flat(await nextFrame(sock, (m) => m.t === "error"));
const codeOf = (code: string): string => JSON.stringify({ t: "error", code });

type RawFrame = { t: string } & Record<string, unknown>;

/** 소켓이 지금까지 받은 chat 이벤트 프레임(원문 JSON). 뷰(state)가 아니라 이벤트다(결정 0017-7). */
const chatFrames = (sock: TestSocket): RawFrame[] =>
  collect(sock)
    .map((raw) => JSON.parse(raw) as RawFrame)
    .filter((m) => m.t === "chat");

/** 모든 소켓이 chat 프레임을 n 개 받을 때까지 기다린다(제한 3초). */
async function waitChat(sockets: TestSocket[], n: number): Promise<void> {
  const deadline = Date.now() + 3000;
  for (const s of sockets) {
    while (chatFrames(s).length < n) {
      if (Date.now() > deadline) throw new Error(`waitChat: chat 프레임 ${n}개가 오지 않았다`);
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }
  }
}

/** 저장된 방에 남은 messages 줄 수. 타입 필드로 읽지 않는다 — 키가 없으면 0. */
async function storedMessageCount(code: string): Promise<number> {
  const room = (await storedRoom(code)) as unknown as Record<string, unknown>;
  const kept = room["messages"];
  return Array.isArray(kept) ? kept.length : 0;
}

/** 서버가 앞선 요청을 모두 처리해 다른 소켓에 보낼 것을 보냈다고 볼 수 있을 때까지 보낸 소켓의 ping 왕복과 짧은 대기. */
async function settle(sock: TestSocket): Promise<void> {
  send(sock, { t: "ping", c: 1 });
  await nextFrame(sock, (m) => m.t === "pong");
  await new Promise<void>((resolve) => setTimeout(resolve, 50));
}

const keysOf = (frame: RawFrame): string => Object.keys(frame).sort().join(",");

describe("빠른 메시지 (COMM-01, COMM-04, D-13)", () => {
  it("discussion 에서 보낸 suspect 는 모든 소켓(보낸 소켓 포함)에 chat 프레임 하나로 가고(seat = 보낸 소켓의 자리), 즉시 두 번째는 RATE_LIMITED 이며 chat 프레임이 더 오지 않는다", async () => {
    const r = await startedAt("discussion");
    const [g0, g1] = r.guests as [Seated["guests"][number], Seated["guests"][number], ...Seated["guests"]];
    const sockets = allSockets(r);

    send(g0.sock, { t: "say", template: "suspect", target: g1.seat });
    await waitChat(sockets, 1);
    for (const s of sockets) {
      const frame = chatFrames(s)[0]!;
      expect(`${frame.seat}:${frame.template}:${frame.target}`).toBe(`${g0.seat}:suspect:${g1.seat}`);
      expect(keysOf(frame)).toBe("at,seat,seq,t,target,template");
    }

    send(g0.sock, { t: "say", template: "trust", target: g1.seat });
    expect(await errorCode(g0.sock)).toBe(codeOf("RATE_LIMITED"));
    await settle(g0.sock);
    for (const s of sockets) expect(chatFrames(s).length).toBe(1);
  });

  it("say 가 통과해도 state 프레임은 방송되지 않는다 — say 직전 이후 프레임이 chat, emoji 순서뿐이다 (결정 0017-7)", async () => {
    const r = await startedAt("discussion");
    const g0 = r.guests[0]!;
    const sockets = allSockets(r);
    for (const s of sockets) await settle(s); // 앞선 state 프레임이 모두 도착한 뒤에 경계를 잡는다
    const marks = sockets.map((s) => s.frames.length);

    send(g0.sock, { t: "say", template: "innocent" });
    await waitChat(sockets, 1);
    await backdateSends(r.code);
    send(g0.sock, { t: "emoji", icon: "smile" });
    for (const s of sockets) await nextFrame(s, (m) => m.t === "emoji");

    sockets.forEach((s, i) => {
      const kinds = s.frames.slice(marks[i]!).map((raw) => (JSON.parse(raw) as RawFrame).t);
      expect(kinds.join(",")).toBe("chat,emoji");
    });
  });

  it("text 키가 붙은 say·seat 키로 방장 자리를 넣은 say 는 BAD_MESSAGE 이고 다른 소켓에 나타나지 않는다", async () => {
    const r = await startedAt("discussion");
    const [g0, g1] = r.guests as [Seated["guests"][number], Seated["guests"][number], ...Seated["guests"]];
    const sockets = allSockets(r);
    const marker = "UNIQUE-TEXT-9f3a";

    send(g0.sock, { t: "say", template: "suspect", target: g1.seat, text: marker });
    expect(await errorCode(g0.sock)).toBe(codeOf("BAD_MESSAGE"));
    send(g1.sock, { t: "say", template: "suspect", target: g0.seat, seat: 0 });
    expect(await errorCode(g1.sock)).toBe(codeOf("BAD_MESSAGE"));
    await settle(g0.sock);
    await settle(g1.sock);
    for (const s of sockets) {
      expect(collect(s).some((raw) => raw.includes(marker))).toBe(false);
      expect(chatFrames(s).length).toBe(0);
    }
    expect(await storedMessageCount(r.code)).toBe(0);
  });

  it("표시 전용 템플릿(claimNone·claimRole)을 토론 중 소켓으로 보내면 보낸 소켓만 error BAD_MESSAGE 를 받고 다른 소켓에는 chat 프레임이 가지 않는다 (결정 0027-7)", async () => {
    const r = await startedAt("discussion");
    const [g0] = r.guests as [Seated["guests"][number], ...Seated["guests"]];
    const sockets = allSockets(r);

    send(g0.sock, { t: "say", template: "claimNone" });
    expect(await errorCode(g0.sock)).toBe(codeOf("BAD_MESSAGE"));
    await backdateSends(r.code);
    send(g0.sock, { t: "say", template: "claimRole", claimedRole: "police" });
    expect(await errorCode(g0.sock)).toBe(codeOf("BAD_MESSAGE"));
    await settle(g0.sock);
    for (const s of sockets) expect(chatFrames(s).length).toBe(0);
    expect(await storedMessageCount(r.code)).toBe(0);
  });

  it("쿨다운이 지난 뒤 거짓 주장(claimed, 아무 직업)도 그대로 모든 소켓의 chat 프레임이 되고 키는 id·role 이 아니다", async () => {
    const r = await startedAt("discussion");
    const [g0, g1, g2] = r.guests as [Seated["guests"][number], Seated["guests"][number], Seated["guests"][number], ...Seated["guests"]];
    const sockets = allSockets(r);

    send(g0.sock, { t: "say", template: "innocent" });
    await waitChat(sockets, 1);
    await backdateSends(r.code);
    send(g0.sock, { t: "say", template: "claimed", target: g2.seat, claimedRole: "police" });
    await waitChat(sockets, 2);
    for (const s of sockets) {
      const frame = chatFrames(s)[1]!;
      expect(`${frame.seat}:${frame.template}:${frame.target}:${frame.claimedRole}`).toBe(`${g0.seat}:claimed:${g2.seat}:police`);
      expect(keysOf(frame)).toBe("at,claimedRole,seat,seq,t,target,template");
      expect(Object.keys(frame).some((k) => k === "id" || k === "role")).toBe(false);
    }
    expect(g1.seat).not.toBe(g2.seat);
  });
});

describe("이모티콘 (COMM-02, D-14)", () => {
  it("저장 없이 연결된 모든 소켓에 emoji 프레임이 가고, 직후 say 는 RATE_LIMITED 다", async () => {
    const r = await startedAt("discussion");
    const [g0, g1] = r.guests as [Seated["guests"][number], Seated["guests"][number], ...Seated["guests"]];
    const sockets = allSockets(r);

    send(g0.sock, { t: "say", template: "innocent" });
    await waitChat(sockets, 1);
    await backdateSends(r.code);

    send(g0.sock, { t: "emoji", icon: "smile" });
    for (const s of sockets) {
      const m = await nextFrame(s, (f) => f.t === "emoji");
      expect(m.t === "emoji" && `${m.seat}:${m.icon}:${typeof m.at}`).toBe(`${g0.seat}:smile:number`);
    }
    for (const s of sockets) expect(chatFrames(s).length).toBe(1);

    send(g0.sock, { t: "say", template: "suspect", target: g1.seat });
    expect(await errorCode(g0.sock)).toBe(codeOf("RATE_LIMITED"));
    send(g0.sock, { t: "emoji", icon: "heart" });
    expect(await errorCode(g0.sock)).toBe(codeOf("RATE_LIMITED"));
    await settle(g0.sock);
    for (const s of sockets) expect(chatFrames(s).length).toBe(1);
  });

  it("단계 밖(assigning) emoji 는 WRONG_PHASE, 모르는 아이콘이나 덧붙은 키는 BAD_MESSAGE 이고 아무에게도 가지 않는다", async () => {
    const r = await seat(4, 0);
    send(r.host, { t: "start" });
    for (const s of allSockets(r)) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "assigning");
    const g0 = r.guests[0]!;
    const others = [r.host, ...r.guests.slice(1).map((g) => g.sock)];

    send(g0.sock, { t: "emoji", icon: "smile" });
    expect(await errorCode(g0.sock)).toBe(codeOf("WRONG_PHASE"));
    send(g0.sock, { t: "emoji", icon: "skull" });
    expect(await errorCode(g0.sock)).toBe(codeOf("BAD_MESSAGE"));
    send(g0.sock, { t: "emoji", icon: "smile", seat: 0 });
    expect(await errorCode(g0.sock)).toBe(codeOf("BAD_MESSAGE"));
    await settle(g0.sock);
    for (const s of others) expect(collect(s).some((raw) => raw.includes('"t":"emoji"'))).toBe(false);
  });
});

describe("방장 연장·넘기기는 없다 (결정 0017-5, DAY-01)", () => {
  /** 단계·마감·일차를 한 줄로 */
  const stamp = async (code: string): Promise<string> => {
    const room = await storedRoom(code);
    return `${room.phase}:${room.phaseEndsAt}:${room.day}`;
  };

  it("discussion 에서 방장·손님이 extend 나 skip 을 보내면 보낸 소켓만 error BAD_MESSAGE 를 받고(state 없음), 저장된 phase·phaseEndsAt·day 가 그대로다 (결정 0017-5)", async () => {
    const r = await startedAt("discussion");
    const sockets = allSockets(r);
    const before = await stamp(r.code);
    const sent: Array<[TestSocket, string]> = [
      [r.host, "extend"],
      [r.host, "skip"],
      [r.guests[0]!.sock, "extend"],
      [r.guests[0]!.sock, "skip"],
    ];
    const countsBefore = sockets.map((s) => collect(s).length);

    for (const [sock, t] of sent) {
      send(sock, { t });
      expect(await errorCode(sock)).toBe(codeOf("BAD_MESSAGE"));
    }
    for (const s of sockets) await settle(s);

    expect(await stamp(r.code)).toBe(before);
    // 보낸 소켓(방장·첫 손님)은 error 두 개만 받고(settle 의 pong 은 뺀다), 나머지 소켓은 아무 프레임도 받지 않았다
    const typesAfter = (s: TestSocket, i: number): string =>
      collect(s)
        .slice(countsBefore[i]!)
        .map((raw) => (JSON.parse(raw) as { t: string }).t)
        .filter((t) => t !== "pong")
        .join(",");
    const seen = sockets.map((s, i) => typesAfter(s, i));
    const want = sockets.map((s) => (s === r.host || s === r.guests[0]!.sock ? "error,error" : ""));
    expect(seen.join("|")).toBe(want.join("|"));
  });

  it("extend·skip 뒤에도 알람은 원래 마감 그대로다", async () => {
    const r = await startedAt("discussion");
    const before = (await storedRoom(r.code)).phaseEndsAt;

    send(r.host, { t: "extend" });
    expect(await errorCode(r.host)).toBe(codeOf("BAD_MESSAGE"));
    send(r.host, { t: "skip" });
    expect(await errorCode(r.host)).toBe(codeOf("BAD_MESSAGE"));
    await settle(r.host);
    expect((await storedRoom(r.code)).phaseEndsAt).toBe(before);
    expect(await alarmOf(r.code)).toBe(before);
  });

  it("방장이 끊겨 있어도 낮 토론·밤·아침은 서버 타이머대로 다음 낮(dayAnnounce)으로 넘어간다", async () => {
    const r = await startedAt("discussion");
    const guestSockets = r.guests.map((g) => g.sock);
    r.host.ws.close(1000, "bye");
    await nextFrame(guestSockets[0]!, (m) => m.t === "state" && m.view.players.find((p) => p.isHost)?.connected === false);

    await advanceTo(r.code, guestSockets, "night");
    await advanceTo(r.code, guestSockets, "morning");
    await advanceTo(r.code, guestSockets, "dayAnnounce");
    expect((await storedRoom(r.code)).day).toBe(2);
  });
});

describe("채팅은 서버에 저장하지 않는다 (결정 0017-7)", () => {
  it("통과한 say 뒤 저장된 방의 messages 는 비어 있다(줄을 저장하지 않는다)", async () => {
    const r = await startedAt("discussion");
    const sockets = allSockets(r);
    send(r.guests[0]!.sock, { t: "say", template: "innocent" });
    await waitChat(sockets, 1);
    expect(await storedMessageCount(r.code)).toBe(0);
  });

  it("옛 방 저장소에 messages 줄이 남아 있으면 깨어날 때 지워진다", async () => {
    const r = await startedAt("discussion");
    const stub = env.ROOM.getByName(r.code);
    await runInDurableObject(stub, async (_instance, state) => {
      const room = await state.storage.get<Record<string, unknown>>("room");
      if (!room) throw new Error("방이 없다");
      await state.storage.put("room", { ...room, messages: [{ seq: 1, seat: 1, template: "innocent", at: 1 }] });
    });
    expect(await storedMessageCount(r.code)).toBe(1);
    await evictDurableObject(stub);

    const sock = await connect(r.code);
    await hello(sock, r.hostToken);
    const stored = (await storedRoom(r.code)) as unknown as Record<string, unknown>;
    expect(Object.keys(stored).includes("messages")).toBe(false);
    expect(await alarmOf(r.code)).toBe((await storedRoom(r.code)).phaseEndsAt);
  });
});

describe("옛 저장 방 정규화 (RESEARCH Pattern 6)", () => {
  it("1페이즈 종착 단계로 저장된 방은 깨어날 때 dayAnnounce·day 1 로 바뀌고 알람이 새 마감으로 걸린다", async () => {
    const r = await startedAt("discussion");
    const stub = env.ROOM.getByName(r.code);
    await runInDurableObject(stub, async (_instance, state) => {
      const room = await state.storage.get<Record<string, unknown>>("room");
      if (!room) throw new Error("방이 없다");
      await state.storage.put("room", { ...room, phase: "day", phaseEndsAt: null, day: undefined, messages: undefined, extendUsed: undefined });
    });
    await evictDurableObject(stub);

    const sock = await connect(r.code);
    const first = await hello(sock, r.hostToken);
    expect(`${first.view.phase}:${first.view.day?.n}`).toBe("dayAnnounce:1");
    const room = await storedRoom(r.code);
    expect(room.phase).toBe("dayAnnounce");
    expect(await alarmOf(r.code)).toBe(room.phaseEndsAt);
  });
});

// 07-08: 순차 주장 단계 제거(CHAT-06) — 역할 확인 → 낮 시작 발표 → 바로 낮 토론이고, claim 메시지는 거부된다.
describe("순차 주장 단계 제거 (07-08, CHAT-06)", () => {
  it("07-08 시작한 방은 dayAnnounce 다음 바로 discussion 이고 어느 소켓도 claim 단계 state 를 받지 않으며 day 에 turn 이 없고 claimLog 는 빈 배열이다", async () => {
    const r = await seat(3, 0);
    const sockets = allSockets(r);
    send(r.host, { t: "start" });
    for (const s of sockets) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "assigning");
    await advanceTo(r.code, sockets, "discussion");
    for (const s of sockets) {
      const phases = collect(s)
        .map((raw) => JSON.parse(raw) as ServerMessage)
        .flatMap((m) => (m.t === "state" ? [m.view.phase as string] : []));
      expect(phases.includes("claim")).toBe(false);
      expect(phases.includes("dayAnnounce")).toBe(true);
      const view = lastOf(s, "discussion");
      expect(`${Object.keys(view.day ?? {}).includes("turn")}:${JSON.stringify(view.day?.claimLog)}`).toBe("false:[]");
    }
  });

  it("07-08 소켓이 claim 메시지를 보내면 error BAD_MESSAGE 가 온다", async () => {
    const r = await seat(3, 0);
    const sockets = allSockets(r);
    send(r.host, { t: "start" });
    for (const s of sockets) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "assigning");
    await advanceTo(r.code, sockets, "discussion");
    const g = r.guests[0]!;
    send(g.sock, { t: "claim", claim: "police" } as never);
    expect(await errorCode(g.sock)).toBe(codeOf("BAD_MESSAGE"));
  });
});
