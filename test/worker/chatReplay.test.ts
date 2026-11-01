// 07-14: 채팅 줄 보관(DO storage 의 chat: 키)과 재접속 복원(hello 직후 chatLog) 시험. 결정 0058.
// 트레이서(Task 1)는 로비 한 줄이 저장되고 새로 hello 한 소켓이 그 줄을 chatLog 로 받는 것까지를 증명한다.
// 복원 규칙 전수(채널별 30줄·마스크·상한·리셋)는 같은 파일 아래쪽이 맡는다.
import { env } from "cloudflare:workers";
import { evictDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { chatKeysOf, chatLogOf, chatRecordsOf, chatSend, chatsOf, connect, createRoom, framesOf, hello, helloForLog, joinOk, lineText, mark, nextFrame, seat, settle } from "./helpers";

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

  it("게임 중에 다시 hello 하면 [state, chatLog] 이고 world snap 은 없다", async () => {
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
    expect(kindsOf(framesOf(again))).toBe("state,chatLog");
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
