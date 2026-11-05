// 11-01 Task 3: 판 통계 카운터 say·emote 는 서버가 세고 어디에도 싣지 않는다 (결정 D-6, O-16, 누설 L35).
// 저장은 emote 쪽이 기다리지 않는 쓰기라 until 로 저장소가 따라올 때까지 본다.
import { describe, expect, it } from "vitest";
import { chatSend, emoteSend, killSeats, mark, resetChatRates, resetEmoteRates, seat, settle, startedGame, storedRoom, until, withRole, connect, hello, flat } from "./helpers";
import type { Actor } from "./helpers";

type Stats = { say: number; emote: number } | undefined;
/** 저장된 방에서 좌석의 stats. */
async function statsOf(code: string, seatNo: number): Promise<Stats> {
  const room = (await storedRoom(code)) as unknown as { players: Array<{ seat: number; stats?: Stats }> };
  return room.players.find((p) => p.seat === seatNo)?.stats;
}
const shown = (s: Stats): string => (s === undefined ? "none" : `${s.say}/${s.emote}`);
const flushAll = async (socks: Actor["sock"][]): Promise<void> => {
  for (const k of socks) await settle(k, mark(k));
};

describe("판 통계 — say (D-6, O-16)", () => {
  it("낮 토론에서 산 사람이 all 채널로 받아들여진 줄을 두 번 보내면 say 가 2 이고 emote 는 0 이다", async () => {
    const g = await startedGame("discussion");
    const [a] = withRole(g, "citizen") as [Actor];
    chatSend(a.sock, "첫 줄");
    await flushAll(g.socks);
    await resetChatRates(g.code);
    chatSend(a.sock, "둘째 줄");
    await flushAll(g.socks);
    await until("say 2", async () => shown(await statsOf(g.code, a.seat)) === "2/0");
    expect(shown(await statsOf(g.code, a.seat))).toBe("2/0");
  }, 30_000);

  it("도배 제한·길이로 거절된 줄은 세지 않는다", async () => {
    const g = await startedGame("discussion");
    const [a] = withRole(g, "citizen") as [Actor];
    chatSend(a.sock, "첫 줄");
    await flushAll(g.socks);
    chatSend(a.sock, "바로 둘째 줄"); // 600ms 간격 제한에 걸린다
    await flushAll(g.socks);
    await resetChatRates(g.code);
    chatSend(a.sock, "가".repeat(301)); // 길이 초과
    await flushAll(g.socks);
    await until("say 1", async () => shown(await statsOf(g.code, a.seat)) === "1/0");
    await flushAll(g.socks);
    expect(shown(await statsOf(g.code, a.seat))).toBe("1/0");
  }, 30_000);

  it("밤 마피아 채널 줄·유령 채널 줄은 세지 않는다", async () => {
    const g = await startedGame("night");
    const [mafiaA] = withRole(g, "mafia") as [Actor, Actor];
    const [citizenX] = withRole(g, "citizen") as [Actor, Actor];
    await killSeats(g, [citizenX.seat]);
    await flushAll(g.socks);
    chatSend(mafiaA.sock, "마피아 줄");
    chatSend(citizenX.sock, "유령 줄");
    await flushAll(g.socks);
    await flushAll(g.socks);
    expect(`${shown(await statsOf(g.code, mafiaA.seat))}|${shown(await statsOf(g.code, citizenX.seat))}`).toBe("none|none");
  }, 30_000);

  it("로비의 줄은 세지 않는다", async () => {
    const s = await seat(1, 0);
    const g = s.guests[0]!;
    await settle(s.host, 0);
    await settle(g.sock, 0);
    chatSend(g.sock, "로비 줄");
    await settle(g.sock, 0);
    await settle(s.host, 0);
    expect(shown(await statsOf(s.code, g.seat))).toBe("none");
  });
});

describe("판 통계 — emote (D-6, O-16)", () => {
  it("서 있는 산 사람의 동작이 받아들여지면 emote 1, 연타 게이트에 막힌 두 번째는 그대로 1 이다", async () => {
    const g = await startedGame("night");
    const [mafiaA] = withRole(g, "mafia") as [Actor, Actor];
    emoteSend(mafiaA.sock, "throat");
    await flushAll(g.socks);
    await until("emote 1", async () => shown(await statsOf(g.code, mafiaA.seat)) === "0/1");
    emoteSend(mafiaA.sock, "throat"); // 연타 게이트
    await flushAll(g.socks);
    await flushAll(g.socks);
    expect(shown(await statsOf(g.code, mafiaA.seat))).toBe("0/1");
    await resetEmoteRates(g.code);
    emoteSend(mafiaA.sock, "deny");
    await flushAll(g.socks);
    await until("emote 2", async () => shown(await statsOf(g.code, mafiaA.seat)) === "0/2");
  }, 30_000);

  it("로비의 동작은 세지 않는다", async () => {
    const s = await seat(1, 0);
    const g = s.guests[0]!;
    await settle(s.host, 0);
    await settle(g.sock, 0);
    emoteSend(g.sock, "clap");
    await settle(g.sock, 0);
    await settle(s.host, 0);
    expect(shown(await statsOf(s.code, g.seat))).toBe("none");
  });
});

describe("판 통계 — 어디에도 싣지 않는다 (L35)", () => {
  it("저장된 방에는 있고 그 사람이 다시 접속해 받는 state 에도 stats 키가 없다", async () => {
    const g = await startedGame("discussion");
    const [a] = withRole(g, "citizen") as [Actor];
    chatSend(a.sock, "한 줄");
    await flushAll(g.socks);
    await until("say 1", async () => shown(await statsOf(g.code, a.seat)) === "1/0");
    const fresh = await connect(g.code);
    const m = mark(fresh);
    await hello(fresh, a.token);
    const got = await settle(fresh, m);
    expect(got.some((f) => f.t === "state")).toBe(true);
    expect(got.map(flat).join("").includes("stats")).toBe(false);
    // 다시 접속하면 옛 소켓은 닫히므로 나머지 소켓의 프레임만 본다.
    for (const k of g.socks.filter((x) => x !== a.sock)) expect(k.frames.join("").includes("stats")).toBe(false);
  }, 30_000);
});
