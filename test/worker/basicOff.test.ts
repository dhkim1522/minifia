// 기본판 꺼진 메시지 조용한 거절 DO 시험(13-04, FLOW-03, D-05, T-13-12·T-13-13): 직업 주장(badge)·귓속말(whisper)은 기본판에서 지원하지 않는 기능과 같게 보인다.
// 보낸 소켓만 오류 한 프레임(BAD_MESSAGE)을 받고, 다른 소켓은 프레임이 없으며, 저장된 방·채팅 기록은 그대로다.
import { describe, expect, it } from "vitest";
import { RULESET } from "../../shared/game/ruleset";
import type { ServerMessage } from "../../shared/protocol";
import { chatKeysOf, chatSend, chatsOf, mark, pause, resetChatRates, send, settle, startedGame, storedRoom, summary } from "./helpers";
import type { Game } from "./helpers";

const CANARY = "비밀이에요-OFF";

/** 한 사람이 메시지를 보내고 모든 소켓의 프레임을 g.actors 순서대로 돌려준다(보낸 쪽 flush 가 먼저다). */
async function sendAndObserve(g: Game, from: Game["actors"][number], msg: unknown): Promise<ServerMessage[][]> {
  const marks = g.actors.map((a) => mark(a.sock));
  send(from.sock, msg);
  const out: ServerMessage[][] = g.actors.map(() => []);
  const order = [from, ...g.actors.filter((a) => a !== from)];
  for (const a of order) out[g.actors.indexOf(a)] = await settle(a.sock, marks[g.actors.indexOf(a)]!);
  return out;
}

const raw = async (code: string): Promise<Record<string, unknown>> => (await storedRoom(code)) as unknown as Record<string, unknown>;

describe("기본판 꺼진 메시지는 조용히 거절된다 (D-05, 결정 0072)", () => {
  it("기본판은 주장·귓속말이 모두 꺼져 있다", () => {
    expect(`${RULESET.badge}/${RULESET.whisper}`).toBe("false/false");
  });

  it("badge 를 보내면 보낸 소켓만 오류 한 프레임을 받고 다른 소켓은 프레임이 없으며 저장된 방에 주장 값이 없다", async () => {
    const g = await startedGame("discussion", 3);
    const from = g.actors[1]!;
    const before = JSON.stringify((await raw(g.code)).players);
    const frames = await sendAndObserve(g, from, { t: "badge", role: "police" });
    g.actors.forEach((a, i) => {
      expect(`${a.seat}:${summary(frames[i]!)}`).toBe(a === from ? `${a.seat}:[error:BAD_MESSAGE]` : `${a.seat}:[]`);
    });
    const room = await raw(g.code);
    expect(JSON.stringify(room.players)).toBe(before);
    expect(JSON.stringify(room).includes("badge")).toBe(false);
  });

  it("whisper 를 보내면 보낸 소켓만 오류 한 프레임을 받고 받는 사람 포함 다른 소켓은 프레임이 없으며 저장·채팅 기록이 그대로다", async () => {
    const g = await startedGame("discussion", 3);
    const from = g.actors[1]!;
    const to = g.actors[2]!;
    const keysBefore = (await chatKeysOf(g.code)).length;
    const frames = await sendAndObserve(g, from, { t: "whisper", to: to.seat, text: CANARY });
    g.actors.forEach((a, i) => {
      expect(`${a.seat}:${summary(frames[i]!)}`).toBe(a === from ? `${a.seat}:[error:BAD_MESSAGE]` : `${a.seat}:[]`);
    });
    const room = await raw(g.code);
    expect("whispers" in room).toBe(false);
    expect(JSON.stringify(room).includes(CANARY)).toBe(false);
    expect((await chatKeysOf(g.code)).length).toBe(keysBefore);
  });

  it("거절된 뒤에도 같은 소켓의 정상 채팅은 평소처럼 모두에게 간다", async () => {
    const g = await startedGame("discussion", 3);
    const from = g.actors[1]!;
    await sendAndObserve(g, from, { t: "badge", role: "police" });
    await sendAndObserve(g, from, { t: "whisper", to: g.actors[2]!.seat, text: CANARY });
    await resetChatRates(g.code);
    await pause(50);
    const marks = g.actors.map((a) => mark(a.sock));
    chatSend(from.sock, "안녕하세요");
    const seen: string[] = [];
    for (const a of g.actors) {
      const chats = chatsOf(await settle(a.sock, marks[g.actors.indexOf(a)]!));
      seen.push(`${a.seat}:${chats.map((c) => `${c.k ?? "say"}/${c.text}`).join(",")}`);
    }
    expect(seen.join(" ")).toBe(g.actors.map((a) => `${a.seat}:say/안녕하세요`).join(" "));
  });
});
