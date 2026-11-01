// 07-10: 입력 중(typing)의 서버 길 — 보낸 사람 상태 → 채널 → audience → deliver → 소켓. 07-11·07-14 가 채팅 줄 시험을 이 파일에 더한다.
// 받을 권리가 없는 소켓에는 프레임이 한 건도 가지 않는다는 것을 "오지 않았음"(settle 이 ping/pong 으로 증명)으로 본다.
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { connect, createRoom, hello, joinOk, mark, seat, send, settle, typingSend } from "./helpers";
import type { TestSocket } from "./helpers";

/** settle 이 돌려준 프레임 가운데 typing 만 한 줄 문자열로(실패 보고가 한 줄이어야 한다). */
const typings = (msgs: ServerMessage[]): string => msgs.filter((m) => m.t === "typing").map((m) => JSON.stringify(m)).join("|");
const errors = (msgs: ServerMessage[]): string => msgs.filter((m) => m.t === "error").map((m) => JSON.stringify(m)).join("|");

/** 두 소켓을 차례로 flush 한다: 보낸 쪽을 먼저(서버가 신호를 처리했음을 보인다) 받는 쪽을 뒤에 본다. */
async function flushBoth(sender: TestSocket, fromSender: number, receiver: TestSocket, fromReceiver: number): Promise<{ sent: ServerMessage[]; got: ServerMessage[] }> {
  const sent = await settle(sender, fromSender);
  const got = await settle(receiver, fromReceiver);
  return { sent, got };
}

describe("입력 중 — 트레이서 (CHAT-04)", () => {
  it("입력 중: 로비 손님의 켜짐이 방장 소켓에 {t,seat,on} 으로 가고 손님 자신에게는 되돌아가지 않는다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    const mh = mark(s.host);
    const mg = mark(guest.sock);
    typingSend(guest.sock, true);
    const { sent, got } = await flushBoth(guest.sock, mg, s.host, mh);
    expect(typings(got)).toBe(`{"t":"typing","seat":${guest.seat},"on":true}`);
    expect(typings(sent)).toBe("");
  });

  it("입력 중: 꺼짐도 방장 소켓에 on:false 로 간다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    typingSend(guest.sock, true);
    const mh = mark(s.host);
    const mg = mark(guest.sock);
    typingSend(guest.sock, false);
    const { got } = await flushBoth(guest.sock, mg, s.host, mh);
    expect(typings(got)).toBe(`{"t":"typing","seat":${guest.seat},"on":false}`);
  });

  it("입력 중: 단계 키가 서버와 다르면 아무 소켓에도 가지 않고 오류도 없다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    const mh = mark(s.host);
    const mg = mark(guest.sock);
    send(guest.sock, { t: "typing", on: true, pk: "9:night" });
    const { sent, got } = await flushBoth(guest.sock, mg, s.host, mh);
    expect(`${typings(got)}/${typings(sent)}/${errors(sent)}`).toBe("//");
  });

  it("입력 중: hello 전 소켓의 신호는 버려진다", async () => {
    const { code, token } = await createRoom("방장");
    const host = await connect(code);
    await hello(host, token);
    await joinOk(code, "손님");
    const anon = await connect(code);
    const mh = mark(host);
    const ma = mark(anon);
    send(anon, { t: "typing", on: true, pk: "0:lobby" });
    const { sent, got } = await flushBoth(anon, ma, host, mh);
    expect(`${typings(got)}/${typings(sent)}/${errors(sent)}`).toBe("//");
  });

  it("입력 중: 덧붙은 seat 가 있으면 BAD_MESSAGE 이고 아무에게도 가지 않는다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    const mh = mark(s.host);
    const mg = mark(guest.sock);
    send(guest.sock, { t: "typing", on: true, pk: "0:lobby", seat: 3 });
    const { sent, got } = await flushBoth(guest.sock, mg, s.host, mh);
    expect(`${typings(got)}/${errors(sent)}`).toBe('/{"t":"error","code":"BAD_MESSAGE"}');
  });

  it("입력 중: pk 33자는 BAD_MESSAGE 이다", async () => {
    const s = await seat(1, 0);
    const guest = s.guests[0]!;
    const mg = mark(guest.sock);
    send(guest.sock, { t: "typing", on: true, pk: "a".repeat(33) });
    expect(errors(await settle(guest.sock, mg))).toBe('{"t":"error","code":"BAD_MESSAGE"}');
  });
});
