// 귓속말 워커 통합 테스트(09.1.1-02, 결정 0066-2, L17): 본문 줄은 당사자 두 소켓에만, 나머지에는 같은 seq 의 사실 줄만 간다.
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { chatsOf, framesOf, mark, send, settle, startedGame } from "./helpers";
import type { Actor, Game } from "./helpers";

type Chat = Extract<ServerMessage, { t: "chat" }>;

const CANARY = "비밀이에요-CANARY";

/** 한 사람이 귓속말을 보내고 모든 소켓의 프레임을 g.actors 순서대로 돌려준다(보낸 쪽 flush 가 먼저다). */
async function sendWhisper(g: Game, from: Actor, to: number, text: string): Promise<ServerMessage[][]> {
  const marks = g.actors.map((a) => mark(a.sock));
  send(from.sock, { t: "whisper", to, text });
  const out: ServerMessage[][] = g.actors.map(() => []);
  const order = [from, ...g.actors.filter((a) => a !== from)];
  for (const a of order) out[g.actors.indexOf(a)] = await settle(a.sock, marks[g.actors.indexOf(a)]!);
  return out;
}

describe("귓속말 — 트레이서 (결정 0066-2, L17)", () => {
  it("좌석 a 가 좌석 b 에게 보내면 당사자 둘은 본문 줄 한 번, 나머지는 같은 seq 의 사실 줄 한 번만 받는다", async () => {
    const g = await startedGame("discussion", 5);
    const from = g.actors[1]!;
    const to = g.actors[2]!;
    const frames = await sendWhisper(g, from, to.seat, CANARY);
    const seqs = new Set<number>();
    g.actors.forEach((a, i) => {
      const chats = chatsOf(frames[i]!);
      expect(chats.length).toBe(1);
      const c = chats[0] as Chat;
      seqs.add(c.seq);
      expect(c.ch).toBe("all");
      expect(c.seat).toBe(from.seat);
      expect(c.to).toBe(to.seat);
      if (a === from || a === to) {
        expect(c.k).toBe("whisper");
        expect(c.text).toBe(CANARY);
      } else {
        expect(c.k).toBe("whispered");
        expect(c.text).toBe("");
      }
    });
    expect(seqs.size).toBe(1);
  });

  it("당사자 소켓의 어떤 프레임에도 whispered 줄이 없고 나머지 소켓의 어떤 프레임에도 본문이 없다", async () => {
    const g = await startedGame("discussion", 5);
    const from = g.actors[1]!;
    const to = g.actors[2]!;
    await sendWhisper(g, from, to.seat, CANARY);
    for (const a of g.actors) {
      const all = framesOf(a.sock);
      const raw = JSON.stringify(all);
      if (a === from || a === to) expect(chatsOf(all).some((c) => c.k === "whispered")).toBe(false);
      else expect(raw.includes(CANARY)).toBe(false);
    }
  });

  it("보낸 사람 소켓에는 state 프레임이 가지 않는다(me.whisperUsed 는 Task 2)", async () => {
    const g = await startedGame("discussion", 5);
    const from = g.actors[1]!;
    const to = g.actors[2]!;
    const frames = await sendWhisper(g, from, to.seat, CANARY);
    for (const f of frames) expect(f.some((m) => m.t === "state")).toBe(false);
  });
});
