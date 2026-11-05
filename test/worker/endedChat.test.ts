// 11-03 Task 1: 결과 단계(ended)에서 모두가 all 채널 한 줄을 보내고 받는다 (결정 D-11, O-16, 위협 T-11-09).
// 동작·입력 중은 여전히 버려진다 — channelOf 와 CHAT_PHASES 는 그대로이고 채팅 처리와 view 만 ended 를 all 로 본다.
import { describe, expect, it } from "vitest";
import { chatSend, chatsOf, emoteSend, emotesOf, endedGame4, mark, phaseKeyOf, resetChatRates, settle, storedRoom, typingSend } from "./helpers";
import type { Actor } from "./helpers";

const stats = async (code: string, seatNo: number): Promise<unknown> =>
  ((await storedRoom(code)) as unknown as { players: Array<{ seat: number; stats?: unknown }> }).players.find((p) => p.seat === seatNo)?.stats;

describe("결과 단계 채팅 (D-11)", () => {
  it("산 사람과 탈락자가 보낸 한 줄을 네 소켓이 모두 ch all 로 정확히 한 번씩 받고 단계 키는 1:{일차}:ended 이다", { timeout: 40_000 }, async () => {
    const g = await endedGame4();
    const [alive] = g.living as [Actor, ...Actor[]];
    expect(phaseKeyOf(alive.sock)).toMatch(/^1:\d+:ended$/);
    for (const [who, text] of [
      [alive, "산 사람의 한마디"],
      [g.dead, "탈락자의 한마디"],
    ] as const) {
      await resetChatRates(g.code);
      const marks = g.socks.map((s) => mark(s));
      chatSend(who.sock, text);
      for (const [i, s] of g.socks.entries()) {
        const lines = chatsOf(await settle(s, marks[i]!));
        expect(lines.map((l) => `${l.ch}/${l.seat}/${l.text}`)).toEqual([`all/${who.seat}/${text}`]);
      }
    }
  });

  it("같은 소켓의 emote·typing 은 ended 에서 한 프레임도 만들지 않는다", { timeout: 40_000 }, async () => {
    const g = await endedGame4();
    const [alive] = g.living as [Actor, ...Actor[]];
    const marks = g.socks.map((s) => mark(s));
    emoteSend(alive.sock, "clap");
    typingSend(alive.sock, true);
    emoteSend(g.dead.sock, "cry");
    const got = await Promise.all(g.socks.map((s, i) => settle(s, marks[i]!)));
    for (const frames of got) expect(frames.filter((m) => m.t === "emote" || m.t === "typing")).toEqual([]);
    expect(got.flatMap(emotesOf)).toEqual([]);
  });

  it("단계 키가 어긋난 줄은 ended 에서도 폐기된다", { timeout: 40_000 }, async () => {
    const g = await endedGame4();
    const [alive] = g.living as [Actor, ...Actor[]];
    const marks = g.socks.map((s) => mark(s));
    chatSend(alive.sock, "낡은 단계 키", "1:1:execution");
    const got = await Promise.all(g.socks.map((s, i) => settle(s, marks[i]!)));
    expect(got.flatMap(chatsOf)).toEqual([]);
  });

  it("결과 단계 줄은 판 통계 say 를 올리지 않는다", { timeout: 40_000 }, async () => {
    const g = await endedGame4();
    const [alive] = g.living as [Actor, ...Actor[]];
    const before = JSON.stringify(await stats(g.code, alive.seat));
    await resetChatRates(g.code);
    const marks = g.socks.map((s) => mark(s));
    chatSend(alive.sock, "통계에 안 센다");
    for (const [i, s] of g.socks.entries()) await settle(s, marks[i]!);
    expect(JSON.stringify(await stats(g.code, alive.seat))).toBe(before);
  });
});
