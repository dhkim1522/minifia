// 07-14: 채팅 줄 보관(DO storage 의 chat: 키)과 재접속 복원(hello 직후 chatLog) 시험. 결정 0058.
// 트레이서(Task 1)는 로비 한 줄이 저장되고 새로 hello 한 소켓이 그 줄을 chatLog 로 받는 것까지를 증명한다.
// 복원 규칙 전수(채널별 30줄·마스크·상한·리셋)는 같은 파일 아래쪽이 맡는다.
import { env } from "cloudflare:workers";
import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { actorsOf, chatKeysOf, chatLogOf, chatRecordsOf, chatSend, chatsOf, connect, createRoom, editRoom, framesOf, hello, helloForLog, joinOk, lineText, mapPlayers, mark, nextFrame, seat, send, settle, skipThrough, storedRoom } from "./helpers";
import type { Actor, Seated } from "./helpers";

/** 프레임 목록을 'state,world.snap,chatLog' 같은 한 줄 종류 열로(실패 보고가 한 줄이어야 한다). */
const kindsOf = (msgs: ServerMessage[]): string => msgs.map((m) => (m.t === "world" ? `world.${m.k}` : m.t)).join(",");

describe("채팅 보관 — 트레이서 (D2, CHAT-01)", () => {
  it("hello 의 프레임 순서는 [state, world.snap, chatLog] 이고 줄이 없어도 빈 chatLog 가 온다", async () => {
    const { code, token } = await createRoom("방장");
    const host = await connect(code);
    await hello(host, token);
    await nextFrame(host, (m) => m.t === "chatLog");
    expect(kindsOf(framesOf(host).slice(0, 3))).toBe("state,world.snap,chatLog");
    expect(JSON.stringify(chatLogOf(framesOf(host)))).toBe("[]");
  });

  it("손님의 줄은 보내기 전에 chat:000001 에 저장되고 받는 사람 마스크에 방장·손님 좌석이 켜진다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    const mg = mark(guest.sock);
    chatSend(guest.sock, "안녕");
    await settle(guest.sock, mg);
    expect((await chatKeysOf(s.code)).join(",")).toBe("chat:000001");
    const rec = (await chatRecordsOf(s.code))["chat:000001"]!;
    expect(`${rec.ch}/${rec.seq}/${rec.seat}/${rec.text}`).toBe(`all/1/${guest.seat}/안녕`);
    const mask = rec.r as number;
    expect(`${mask & 1}${(mask >> guest.seat) & 1}`).toBe("11");
  });

  it("새 소켓으로 다시 hello 하면 [state, snap, chatLog] 로 그 줄을 받고 줄의 키는 at·ch·seat·seq·text 뿐이다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    const mg = mark(guest.sock);
    chatSend(guest.sock, "안녕");
    await settle(guest.sock, mg);

    const again = await connect(s.code);
    const lines = await helloForLog(again, guest.token);
    expect(kindsOf(framesOf(again).slice(0, 3))).toBe("state,world.snap,chatLog");
    expect(lines.map(lineText).join("|")).toBe(`all/${guest.seat}/1/안녕`);
    expect(Object.keys(lines[0]!).sort().join(",")).toBe("at,ch,seat,seq,text");
  });

  it("게임이 시작된 뒤(역할 배정 중) 다시 hello 하면 [state, world.snap, chatLog] 이다 — 접속 snap 은 보는 사람별로 지도 단계 전에도 간다(08-09)", async () => {
    const s = await seat(3, 0, { testMode: true });
    const guest = s.guests[0]!;
    const mg = mark(guest.sock);
    chatSend(guest.sock, "시작 전에");
    await settle(guest.sock, mg);
    const socks = [s.host, ...s.guests.map((x) => x.sock)];
    s.host.ws.send(JSON.stringify({ t: "start" }));
    for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase !== "lobby");

    const again = await connect(s.code);
    const lines = await helloForLog(again, guest.token);
    expect(kindsOf(framesOf(again))).toBe("state,world.snap,chatLog");
    expect(lines.map(lineText).join("|")).toBe(`all/${guest.seat}/1/시작 전에`);
  });

  it("DO 가 퇴거돼도 같은 chatLog 를 받고 이어서 보낸 줄의 seq 는 2 이다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    const mg = mark(guest.sock);
    chatSend(guest.sock, "안녕");
    await settle(guest.sock, mg);

    await evictDurableObject(env.ROOM.getByName(s.code));
    const again = await connect(s.code);
    const lines = await helloForLog(again, guest.token);
    expect(lines.map(lineText).join("|")).toBe(`all/${guest.seat}/1/안녕`);

    const ma = mark(again);
    chatSend(again, "또 안녕");
    const got = chatsOf(await settle(again, ma));
    expect(got.map(lineText).join("|")).toBe(`all/${guest.seat}/2/또 안녕`);
    expect((await chatKeysOf(s.code)).join(",")).toBe("chat:000001,chat:000002");
  });

  it("보관된 줄이 없는 방에서 joinOk 만 한 사람도 빈 chatLog 를 받는다", async () => {
    const { code, token } = await createRoom("방장");
    const joined = await joinOk(code, "손님");
    const host = await connect(code);
    await hello(host, token);
    const other = await connect(code);
    const lines = await helloForLog(other, joined.token);
    expect(lines.length).toBe(0);
  });
});

// ---- 복원 규칙 전수 (Task 2, 사용자 결정 1·2, 결정 0058) ----

/**
 * 좌석 번호 사람의 이름으로 여러 줄을 서버 본체(applyChat)에 직접 넣는다. 단계 키는 지금 서버 단계에서 만들고, 줄마다 도배 기록(D5)을 비운다.
 * 소켓으로 수십 줄을 보내면 연결당 초당 20개 한도(RATE_LIMITED)에 걸리므로 부피가 필요한 시험만 쓴다 — 보관·복원은 같은 본체를 지난다.
 */
async function bulkChat(code: string, seatNo: number, texts: string[]): Promise<void> {
  await runInDurableObject(env.ROOM.getByName(code), async (instance) => {
    const room = instance["room"]!;
    const me = room.players.find((p) => p.seat === seatNo)!;
    for (const text of texts) {
      instance["chatRates"].clear();
      const why = await instance["applyChat"](me.id, text, `${room.day ?? 0}:${room.phase}`, Date.now());
      if (why !== null) throw new Error(`bulkChat: 막힘 ${why} (${text})`);
    }
  });
}

const numbered = (from: number, to: number, prefix = "줄"): string[] => Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`);

/** 새 소켓으로 같은 사람이 hello 해 받은 chatLog 를 'ch/seat/seq/text' 로 이은 한 줄 문자열. */
async function replayOf(code: string, token: string): Promise<string[]> {
  const again = await connect(code);
  return (await helloForLog(again, token)).map(lineText);
}

/** 6명 테스트 방을 시작해 dayAnnounce 에서 역할을 읽고 멈춘다. */
async function startedSix(): Promise<{ room: Seated; actors: Actor[] }> {
  const room = await seat(5, 0, { testMode: true });
  const socks = [room.host, ...room.guests.map((x) => x.sock)];
  send(room.host, { t: "start" });
  for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
  await skipThrough(room, "dayAnnounce");
  return { room, actors: actorsOf(room) };
}

const withRole = (actors: Actor[], role: string): Actor[] => actors.filter((a) => a.role === role).sort((a, b) => a.seat - b.seat);

describe("채팅 복원 — 채널별 30줄 (결정 0058-3)", () => {
  it("로비에서 all 35줄을 보냈으면 재접속 chatLog 의 all 줄은 최근 30개(seq 6~35)이고 보낸 순서다", async () => {
    const s = await seat(1, 0);
    await bulkChat(s.code, 0, numbered(1, 35));
    const got = await replayOf(s.code, s.guests[0]!.token);
    expect(got.length).toBe(30);
    expect(got[0]).toBe("all/0/6/줄6");
    expect(got[29]).toBe("all/0/35/줄35");
    expect(got.join("|")).toBe(numbered(6, 35).map((t, i) => `all/0/${6 + i}/${t}`).join("|"));
    expect((await chatKeysOf(s.code)).length).toBe(35);
  }, 20_000);
});

describe("채팅 복원 — 보낼 때의 마스크로만 (사용자 결정 2, 결정 0021-2, T-07-35)", () => {
  it("밤 1일차 마피아 줄은 시민에게 0건, 그 밤에 막 탈락한 X 에게는 탈락 전 mafia 줄 0건·탈락 뒤 mafia·ghost 줄은 있고, 마피아 B 는 ghost 0건이다", async () => {
    const { room, actors } = await startedSix();
    const [mafiaA, mafiaB] = withRole(actors, "mafia") as [Actor, Actor];
    const citizens = withRole(actors, "citizen");
    const citizenC = citizens[0]!;
    const victimX = citizens[1]!;

    await skipThrough(room, "night");
    await bulkChat(room.code, mafiaA.seat, ["첫 밤 하나", "첫 밤 둘"]);
    // 밤에 X 가 탈락한다(저장 방을 고치고 DO 를 evict — 이후 줄은 저장소에서 되살린 DO 가 받는다).
    await editRoom(room.code, (r) => mapPlayers(r, (p) => (p.seat === victimX.seat ? { ...p, alive: false } : p)));
    await skipThrough(room, "discussion");
    expect((await storedRoom(room.code)).phase).toBe("discussion");
    await bulkChat(room.code, victimX.seat, ["유령 한마디"]);
    await bulkChat(room.code, citizenC.seat, ["낮 공개"]);
    await skipThrough(room, "night");
    await bulkChat(room.code, mafiaA.seat, ["둘째 밤"]);

    const forC = await replayOf(room.code, citizenC.token);
    expect(forC.join("|")).toBe(`all/${citizenC.seat}/1/낮 공개`);

    const forX = await replayOf(room.code, victimX.token);
    expect(forX.join("|")).toBe(
      [`ghost/${victimX.seat}/1/유령 한마디`, `all/${citizenC.seat}/1/낮 공개`, `mafia/${mafiaA.seat}/3/둘째 밤`].join("|"),
    );

    const forB = await replayOf(room.code, mafiaB.token);
    expect(forB.join("|")).toBe(
      [`mafia/${mafiaA.seat}/1/첫 밤 하나`, `mafia/${mafiaA.seat}/2/첫 밤 둘`, `all/${citizenC.seat}/1/낮 공개`, `mafia/${mafiaA.seat}/3/둘째 밤`].join("|"),
    );
  }, 40_000);
});

describe("채팅 보관 — 상한·리셋·방 삭제 (결정 0058-4·7, T-07-38)", () => {
  it("all 101줄이 되면 all 레코드는 81개이고 가장 오래된 20개 키가 없으며 mafia 줄은 지워지지 않는다", async () => {
    const { room, actors } = await startedSix();
    const mafiaA = withRole(actors, "mafia")[0]!;
    const sender = withRole(actors, "citizen")[0]!;
    // 시작 전 로비 줄이 아니라 낮 공개 줄이다: 밤 mafia 한 줄을 사이에 끼워 all 번호와 섞이지 않음을 본다.
    await skipThrough(room, "discussion");
    await bulkChat(room.code, sender.seat, numbered(1, 60));
    await skipThrough(room, "night");
    await bulkChat(room.code, mafiaA.seat, ["밤 한 줄"]);
    await skipThrough(room, "discussion");
    await bulkChat(room.code, sender.seat, numbered(61, 101));

    const records = await chatRecordsOf(room.code);
    const all = Object.values(records).filter((r) => r.ch === "all");
    const mafia = Object.values(records).filter((r) => r.ch === "mafia");
    expect(`${all.length}/${mafia.length}`).toBe("81/1");
    const keys = Object.keys(records);
    expect(keys.includes("chat:000001") || keys.includes("chat:000020")).toBe(false);
    expect(keys.includes("chat:000021")).toBe(true);
    expect(Math.min(...all.map((r) => r.seq as number))).toBe(21);
    expect(Math.max(...all.map((r) => r.seq as number))).toBe(101);
  }, 60_000);

  it("테스트 방 [대기실로 되돌리기] 는 chat: 키를 모두 지우고 다음 hello 의 chatLog 가 비며 그 뒤 첫 줄은 seq 1 이다", async () => {
    const s = await seat(3, 0, { testMode: true });
    const guest = s.guests[0]!;
    await bulkChat(s.code, guest.seat, ["하나", "둘"]);
    send(s.host, { t: "start" });
    await nextFrame(s.host, (m) => m.t === "state" && m.view.phase !== "lobby");
    expect((await chatKeysOf(s.code)).length).toBe(2);

    const mh = mark(s.host);
    send(s.host, { t: "testReset" });
    await nextFrame(s.host, (m) => m.t === "state" && m.view.phase === "lobby");
    await settle(s.host, mh);
    expect((await chatKeysOf(s.code)).length).toBe(0);

    const again = await connect(s.code);
    const lines = await helloForLog(again, guest.token);
    expect(lines.length).toBe(0);
    await bulkChat(s.code, guest.seat, ["다시"]);
    expect((await replayOf(s.code, s.guests[1]!.token)).join("|")).toBe(`all/${guest.seat}/1/다시`);
  }, 20_000);

  it("방장 혼자 나가 방이 지워지면 chat: 키도 없다", async () => {
    const { code, token } = await createRoom("방장");
    const host = await connect(code);
    await hello(host, token);
    await nextFrame(host, (m) => m.t === "chatLog");
    const mh = mark(host);
    chatSend(host, "혼잣말");
    await settle(host, mh);
    expect((await chatKeysOf(code)).length).toBe(1);
    send(host, { t: "leave" });
    await host.closedPromise;
    expect((await chatKeysOf(code)).length).toBe(0);
  });
});
