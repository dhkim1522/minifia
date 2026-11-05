// 10-01: 방 DO 의 동작(emote) 처리 — 서버가 채널을 정하고 audience 소켓에만 {t,seat,id,n} 한 프레임을 보낸다 (D-12, L27).
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { env, runInDurableObject } from "cloudflare:test";
import { connect, emoteRateKeys, emoteSend, emotesOf as emotes, hello, mark, nextFrame, observe, pause, resetEmoteRates, seat, send, settle, startedGame, summary, withRole } from "./helpers";
import type { Actor } from "./helpers";

describe("동작 — 트레이서 (D-12, L27)", () => {
  it("로비에서 한 사람이 보내면 세 소켓(보낸 사람 포함) 모두 정확히 한 프레임 {t,seat,id,n} 을 받는다", async () => {
    const s = await seat(2, 0);
    const [g1, g2] = s.guests as [(typeof s.guests)[number], (typeof s.guests)[number]];
    const socks = [s.host, g1.sock, g2.sock];
    for (const k of socks) await settle(k, 0);
    const marks = socks.map((k) => mark(k));
    emoteSend(g1.sock, "clap");
    const got: ServerMessage[][] = [];
    for (let i = 0; i < socks.length; i++) got.push(await settle(socks[i]!, marks[i]!));
    for (const g of got) {
      expect(emotes(g).length).toBe(1);
      const e = emotes(g)[0]!;
      expect(Object.keys(e).sort()).toEqual(["id", "n", "seat", "t"]);
      expect(JSON.stringify(e)).toBe(JSON.stringify({ t: "emote", seat: g1.seat, id: "clap", n: 1 }));
    }
  });

  it("다른 사람이 한 번 더 보내면 n 은 2 다(같은 채널 all 의 카운터)", async () => {
    const s = await seat(2, 0);
    const [g1, g2] = s.guests as [(typeof s.guests)[number], (typeof s.guests)[number]];
    const socks = [s.host, g1.sock, g2.sock];
    for (const k of socks) await settle(k, 0);
    emoteSend(g1.sock, "clap");
    for (const k of socks) await settle(k, 0);
    const m = mark(s.host);
    emoteSend(g2.sock, "dance");
    const got = emotes(await settle(s.host, m));
    expect(got.length).toBe(1);
    expect(JSON.stringify(got[0])).toBe(JSON.stringify({ t: "emote", seat: g2.seat, id: "dance", n: 2 }));
  });
});

describe("동작 — 규칙 (10-01 Task 2, D-10·D-11·D-19)", () => {
  it("같은 사람이 연달아 두 번 보내면 두 번째는 모든 소켓에서 0프레임이고, 기록을 비우면 다시 받아들여져 n 이 이어진다", async () => {
    const s = await seat(1, 0);
    const g = s.guests[0]!;
    const socks = [s.host, g.sock];
    for (const k of socks) await settle(k, 0);
    emoteSend(g.sock, "clap");
    for (const k of socks) await settle(k, 0);
    const marks = socks.map((k) => mark(k));
    emoteSend(g.sock, "deny");
    for (let i = 0; i < socks.length; i++) expect(emotes(await settle(socks[i]!, marks[i]!)).length).toBe(0);

    await resetEmoteRates(s.code);
    const m2 = socks.map((k) => mark(k));
    emoteSend(g.sock, "deny");
    for (let i = 0; i < socks.length; i++) {
      const got = emotes(await settle(socks[i]!, m2[i]!));
      expect(got.length).toBe(1);
      expect(got[0]!.n).toBe(2);
    }
  });

  it("멀리 가는 move 를 막 보낸 사람의 emote 는 모든 소켓에서 0프레임이다(보낸 소켓 포함, 오류·state 도 없다)", async () => {
    const s = await seat(1, 0);
    const g = s.guests[0]!;
    const socks = [s.host, g.sock];
    for (const k of socks) await settle(k, 0);
    send(g.sock, { t: "move", x: 300, z: 100 });
    for (const k of socks) await nextFrame(k, (m) => m.t === "world" && m.k === "move" && m.s === g.seat && m.p.length > 2);
    for (const k of socks) await settle(k, 0);
    const marks = socks.map((k) => mark(k));
    emoteSend(g.sock, "clap");
    for (let i = 0; i < socks.length; i++) expect(summary(await settle(socks[i]!, marks[i]!))).toBe("[]");
  });

  it("받아들여진 move 는 그 사람의 동작 기록을 지운다", async () => {
    const s = await seat(1, 0);
    const g = s.guests[0]!;
    for (const k of [s.host, g.sock]) await settle(k, 0);
    emoteSend(g.sock, "clap");
    for (const k of [s.host, g.sock]) await settle(k, 0);
    expect((await emoteRateKeys(s.code)).length).toBe(1);
    await pause(200);
    send(g.sock, { t: "move", x: 300, z: 100 });
    for (const k of [s.host, g.sock]) await settle(k, 0);
    expect(await emoteRateKeys(s.code)).toEqual([]);
  });

  it("단계 키가 다르면 모든 소켓 0프레임이고 보낸 소켓에도 오류·chatReject·state 가 없다", async () => {
    const s = await seat(1, 0);
    const g = s.guests[0]!;
    const socks = [s.host, g.sock];
    for (const k of socks) await settle(k, 0);
    const marks = socks.map((k) => mark(k));
    emoteSend(g.sock, "clap", "1:7:night");
    for (let i = 0; i < socks.length; i++) expect(summary(await settle(socks[i]!, marks[i]!))).toBe("[]");
  });

  it("밤에 산 시민·경찰·의사가 보내면 보낸 소켓 포함 0프레임이다", async () => {
    const g = await startedGame("night");
    const town = g.actors.filter((a) => a.role !== "mafia") as Actor[];
    expect(town.length).toBe(4);
    const got = await observe(g, town[0]!, () => {
      for (const a of town) emoteSend(a.sock, "clap");
    });
    for (const frames of got) expect(emotes(frames).length).toBe(0);
    expect(summary(got[g.actors.indexOf(town[0]!)]!)).toBe("[]");
    expect(withRole(g, "mafia").length).toBe(2);
  }, 30_000);

  it("역할 배정·역할 확인 단계의 동작은 0프레임이다", async () => {
    const s = await seat(5, 0);
    const socks = [s.host, ...s.guests.map((x) => x.sock)];
    for (const k of socks) await settle(k, 0);
    send(s.host, { t: "start" });
    for (const k of socks) await nextFrame(k, (m) => m.t === "state" && m.view.phase === "assigning");
    for (const k of socks) await settle(k, 0);
    const marks = socks.map((k) => mark(k));
    for (const k of socks) emoteSend(k, "clap");
    for (let i = 0; i < socks.length; i++) expect(emotes(await settle(socks[i]!, marks[i]!)).length).toBe(0);
  }, 30_000);

  it("재접속한 소켓은 동작을 다시 받지 않고 저장소에 동작 키가 없다(L28)", async () => {
    const s = await seat(1, 0);
    const g = s.guests[0]!;
    for (const k of [s.host, g.sock]) await settle(k, 0);
    emoteSend(g.sock, "clap");
    for (const k of [s.host, g.sock]) await settle(k, 0);
    const fresh = await connect(s.code);
    await hello(fresh, g.token);
    const frames = await settle(fresh, 0);
    expect(emotes(frames).length).toBe(0);
    const keys = await runInDurableObject(env.ROOM.getByName(s.code), async (_i, state) => [...(await state.storage.list()).keys()]);
    expect(keys.filter((k) => /emote/i.test(k))).toEqual([]);
    const room = JSON.stringify(await runInDurableObject(env.ROOM.getByName(s.code), async (_i, state) => state.storage.get("room")));
    expect(room).not.toMatch(/emote/i);
  });
});
