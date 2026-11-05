// 11-01: 판 번호와 세 부분 단계 키 '{판}:{일차}:{단계}' (결정 D-26, 누설 L41).
// 이전 판·옛 두 부분 형식의 키로 온 chat·typing·emote 는 어떤 소켓에도 가지 않고, 더 넓은 채널로 다시 분류되지도 않는다.
import { describe, expect, it } from "vitest";
import { chatSend, chatsOf, emoteSend, emotesOf, lastViewOf, mark, phaseKeyOf, seat, send, settle, summary, typingSend } from "./helpers";
import type { ServerMessage } from "../../shared/protocol";

const typings = (msgs: ServerMessage[]): number => msgs.filter((m) => m.t === "typing").length;

describe("판 번호와 단계 키 (D-26, L41)", () => {
  it("view.round 는 첫 판에서 1 이고 단계 키는 세 부분이다", async () => {
    const s = await seat(2, 0);
    await settle(s.host, 0);
    expect(lastViewOf(s.host).round).toBe(1);
    expect(phaseKeyOf(s.host)).toBe("1:0:lobby");
  });

  it("L41: 세 부분 키로 보낸 chat 은 보낸 소켓 포함 세 소켓이 정확히 한 줄씩 받는다", async () => {
    const s = await seat(2, 0);
    const [g1, g2] = s.guests as [(typeof s.guests)[number], (typeof s.guests)[number]];
    const socks = [s.host, g1.sock, g2.sock];
    for (const k of socks) await settle(k, 0);
    const marks = socks.map((k) => mark(k));
    chatSend(g1.sock, "안녕", "1:0:lobby");
    for (let i = 0; i < socks.length; i++) expect(chatsOf(await settle(socks[i]!, marks[i]!)).length).toBe(1);
  });

  it("L41: 옛 두 부분 키·다른 판 번호 키의 chat 은 다른 소켓에 0줄이고 보낸 소켓은 chatReject phase 와 state 만 받는다", async () => {
    const s = await seat(2, 0);
    const [g1, g2] = s.guests as [(typeof s.guests)[number], (typeof s.guests)[number]];
    const socks = [s.host, g1.sock, g2.sock];
    for (const k of socks) await settle(k, 0);
    for (const pk of ["0:lobby", "2:0:lobby", "0:0:lobby"]) {
      const marks = socks.map((k) => mark(k));
      chatSend(g1.sock, "늦은 말", pk);
      const own = await settle(g1.sock, marks[1]!);
      expect(`${pk}${summary(own)}`).toBe(`${pk}[chatReject,state:lobby]`);
      expect(`${pk}${JSON.stringify(own.find((m) => m.t === "chatReject"))}`).toBe(`${pk}{"t":"chatReject","why":"phase"}`);
      expect(`${pk}${summary(await settle(s.host, marks[0]!))}`).toBe(`${pk}[]`);
      expect(`${pk}${summary(await settle(g2.sock, marks[2]!))}`).toBe(`${pk}[]`);
    }
  });

  it("L41: 같은 키의 typing 은 다른 소켓에 가고, 옛 형식·다른 판 키의 typing 은 모든 소켓에 0프레임이다", async () => {
    const s = await seat(1, 0);
    const g = s.guests[0]!;
    await settle(s.host, 0);
    await settle(g.sock, 0);
    const mh = mark(s.host);
    typingSend(g.sock, true);
    expect(typings(await settle(s.host, mh))).toBe(1);
    typingSend(g.sock, false);
    await settle(s.host, mh);
    for (const pk of ["0:lobby", "2:0:lobby"]) {
      const m1 = mark(s.host);
      const m2 = mark(g.sock);
      send(g.sock, { t: "typing", on: true, pk });
      expect(`${pk}${typings(await settle(s.host, m1))}`).toBe(`${pk}0`);
      expect(`${pk}${typings(await settle(g.sock, m2))}`).toBe(`${pk}0`);
    }
  });

  it("L41: 같은 키의 emote 는 보낸 소켓까지 한 프레임이고, 옛 형식·다른 판 키의 emote 는 보낸 소켓 포함 0프레임이다", async () => {
    const s = await seat(1, 0);
    const g = s.guests[0]!;
    await settle(s.host, 0);
    await settle(g.sock, 0);
    for (const pk of ["0:lobby", "2:0:lobby"]) {
      const m1 = mark(s.host);
      const m2 = mark(g.sock);
      emoteSend(g.sock, "clap", pk);
      expect(`${pk}${emotesOf(await settle(s.host, m1)).length}`).toBe(`${pk}0`);
      expect(`${pk}${emotesOf(await settle(g.sock, m2)).length}`).toBe(`${pk}0`);
    }
    const m3 = mark(g.sock);
    emoteSend(g.sock, "clap", "1:0:lobby");
    expect(emotesOf(await settle(g.sock, m3)).length).toBe(1);
  });
});
