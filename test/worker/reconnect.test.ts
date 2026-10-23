import { env } from "cloudflare:workers";
import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { closed, connect, flat, createRoom, hello, joinOk, nextFrame, send } from "./helpers";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function seatConnected(msg: ServerMessage, seat: number): boolean | undefined {
  return msg.t === "state" ? msg.view.players.find((p) => p.seat === seat)?.connected : undefined;
}

describe("재접속", () => {
  it("참가자 소켓이 닫히면 다른 사람 state 에서 그 자리가 connected false 가 되고, 같은 토큰으로 다시 hello 하면 같은 자리로 돌아온다", async () => {
    const { code, token } = await createRoom("방장");
    const guest = await joinOk(code, "철수");
    const host = await connect(code);
    await hello(host, token);
    const g = await connect(code);
    await hello(g, guest.token);
    await nextFrame(host, (m) => seatConnected(m, guest.seat) === true);

    g.ws.close();
    await nextFrame(host, (m) => seatConnected(m, guest.seat) === false);

    const g2 = await connect(code);
    const back = await hello(g2, guest.token);
    expect(back.view.me.seat).toBe(guest.seat);
    expect(seatConnected(back, guest.seat)).toBe(true);
  });

  it("같은 토큰의 두 번째 소켓 hello 는 첫 소켓을 4001 'replaced' 로 닫고, 낡은 소켓의 닫힘은 connected 를 false 로 만들지 않는다", async () => {
    const { code, token } = await createRoom("방장");
    const guest = await joinOk(code, "철수");
    const host = await connect(code);
    await hello(host, token);
    const first = await connect(code);
    await hello(first, guest.token);
    const second = await connect(code);
    await hello(second, guest.token);

    expect(await closed(first)).toBe("4001 replaced");
    // 낡은 소켓의 닫힘 처리가 끝난 뒤의 방송을 보기 위해 새 참가로 한 번 더 방송을 일으킨다.
    await sleep(50);
    await joinOk(code, "영희");
    const state = await nextFrame(host, (m) => m.t === "state" && m.view.players.length === 3);
    expect(seatConnected(state, guest.seat)).toBe(true);
    // 방장이 받은 어떤 프레임에서도 교체 뒤에 철수가 끊긴 것으로 보이지 않는다.
    const lastTwo = host.frames.slice(-2).map((f) => JSON.parse(f) as ServerMessage);
    for (const m of lastTwo) expect(seatConnected(m, guest.seat)).not.toBe(false);
  });

  it("하이버네이션(evict) 뒤에도 기존 소켓 ping 에 pong, 같은 토큰 hello 는 같은 자리", async () => {
    const { code, token } = await createRoom("방장");
    const guest = await joinOk(code, "철수");
    const host = await connect(code);
    await hello(host, token);
    const g = await connect(code);
    await hello(g, guest.token);

    await evictDurableObject(env.ROOM.getByName(code));
    send(g, { t: "ping", c: 7 });
    const pong = await nextFrame(g, (m) => m.t === "pong");
    expect(pong.t === "pong" && pong.c).toBe(7);

    const g2 = await connect(code);
    const back = await hello(g2, guest.token);
    expect(back.view.me.seat).toBe(guest.seat);
  });

  it("저장된 connected true·connId 'ghost' 는 깨어난 뒤 다음 방송에서 connected false 다", async () => {
    const { code, token } = await createRoom("방장");
    const guest = await joinOk(code, "철수");
    const host = await connect(code);
    await hello(host, token);

    const stub = env.ROOM.getByName(code);
    await runInDurableObject(stub, async (_i, state) => {
      const room = await state.storage.get<{ players: Array<Record<string, unknown>> }>("room");
      const players = room!.players.map((p) =>
        p.seat === guest.seat ? { ...p, connected: true, connId: "ghost" } : p,
      );
      await state.storage.put("room", { ...room, players });
    });
    await evictDurableObject(stub);

    await joinOk(code, "영희");
    const state = await nextFrame(host, (m) => m.t === "state" && m.view.players.length === 3);
    expect(seatConnected(state, guest.seat)).toBe(false);
  });

  it("없는 토큰의 hello 는 4003 'invalid_token'", async () => {
    const { code } = await createRoom("방장");
    const sock = await connect(code);
    send(sock, { t: "hello", token: "z".repeat(43) });
    expect(await closed(sock)).toBe("4003 invalid_token");
  });
});

describe("속도 제한", () => {
  it("한 연결이 1초에 20개를 넘게 보내면 넘친 메시지는 처리하지 않고 RATE_LIMITED 를 알리고, 창이 지나면 다시 pong", async () => {
    const { code } = await createRoom("방장");
    const sock = await connect(code);
    for (let c = 0; c < 30; c += 1) send(sock, { t: "ping", c });
    const limited = await nextFrame(sock, (m) => m.t === "error");
    expect(flat(limited)).toBe(JSON.stringify({ t: "error", code: "RATE_LIMITED" }));
    await sleep(100);
    const pongs = sock.frames.map((f) => JSON.parse(f) as ServerMessage).filter((m) => m.t === "pong");
    expect(pongs.length).toBeLessThanOrEqual(20);

    await sleep(1100);
    send(sock, { t: "ping", c: 999 });
    const pong = await nextFrame(sock, (m) => m.t === "pong" && m.c === 999);
    expect(pong.t).toBe("pong");
  });
});
