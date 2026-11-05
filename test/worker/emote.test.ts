// 10-01: 방 DO 의 동작(emote) 처리 — 서버가 채널을 정하고 audience 소켓에만 {t,seat,id,n} 한 프레임을 보낸다 (D-12, L27).
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { mark, phaseKeyOf, seat, send, settle } from "./helpers";
import type { TestSocket } from "./helpers";

const emotes = (msgs: ServerMessage[]): Array<Extract<ServerMessage, { t: "emote" }>> => msgs.filter((m): m is Extract<ServerMessage, { t: "emote" }> => m.t === "emote");
const emoteSend = (sock: TestSocket, id: string, pk: string = phaseKeyOf(sock)): void => send(sock, { t: "emote", id, pk });

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
    await settle(g1.sock, 0);
    const m = mark(s.host);
    emoteSend(g2.sock, "dance");
    const got = emotes(await settle(s.host, m));
    expect(got.length).toBe(1);
    expect(JSON.stringify(got[0])).toBe(JSON.stringify({ t: "emote", seat: g2.seat, id: "dance", n: 2 }));
  });
});
