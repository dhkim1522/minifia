// 귓속말 워커 통합 테스트(09.1.1-02, 결정 0066-2, L17): 본문 줄은 당사자 두 소켓에만, 나머지에는 같은 seq 의 사실 줄만 간다.
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { chatKeysOf, chatLogOf, chatRecordsOf, chatSend, chatsOf, connect, editRoom, framesOf, helloForLog, mapPlayers, mark, pause, resetChatRates, send, settle, startedGame, storedRoom, summary } from "./helpers";
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

  it("타인에게는 state 프레임이 가지 않는다(보낸 사람 본인의 사용함 표시만 Task 2)", async () => {
    const g = await startedGame("discussion", 5);
    const from = g.actors[1]!;
    const to = g.actors[2]!;
    const frames = await sendWhisper(g, from, to.seat, CANARY);
    g.actors.forEach((a, i) => {
      if (a !== from) expect(frames[i]!.some((m) => m.t === "state")).toBe(false);
    });
  });
});

/** 저장된 방의 whispers(서버 전용 보관). */
async function whispersOf(code: string): Promise<Array<{ n: number; from: number; to: number; text: string; at: number }>> {
  return ((await storedRoom(code)) as unknown as { whispers?: Array<{ n: number; from: number; to: number; text: string; at: number }> }).whispers ?? [];
}

describe("귓속말 — 규칙 완성 (결정 0066-2, O-3~O-5·O-20)", () => {
  it("성공하면 보낸 사람 소켓만 me.whisperUsed 가 켜진 state 를 정확히 한 번 받고 다른 소켓은 state 를 받지 않는다", async () => {
    const g = await startedGame("discussion", 5);
    const from = g.actors[1]!;
    const to = g.actors[2]!;
    const frames = await sendWhisper(g, from, to.seat, CANARY);
    g.actors.forEach((a, i) => {
      const states = frames[i]!.filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state");
      if (a === from) {
        expect(states.length).toBe(1);
        expect(states[0]!.view.me.whisperUsed).toBe(true);
      } else {
        expect(states.length).toBe(0);
      }
    });
    // 받은 사람·다른 소켓의 마지막 view 에는 키가 없다.
    for (const a of g.actors) {
      if (a === from) continue;
      const views = framesOf(a.sock).filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state");
      expect("whisperUsed" in views.at(-1)!.view.me).toBe(false);
    }
  });

  it("같은 낮 두 번째는 보낸 소켓에만 [error BAD_MESSAGE, state] 이고 나머지는 0프레임, 저장된 whispers 는 그대로다", async () => {
    const g = await startedGame("discussion", 5);
    const from = g.actors[1]!;
    await sendWhisper(g, from, g.actors[2]!.seat, CANARY);
    const before = JSON.stringify(await whispersOf(g.code));
    const frames = await sendWhisper(g, from, g.actors[3]!.seat, "두번째");
    g.actors.forEach((a, i) => {
      expect(summary(frames[i]!)).toBe(a === from ? "[error:BAD_MESSAGE,state:discussion]" : "[]");
    });
    expect(JSON.stringify(await whispersOf(g.code))).toBe(before);
  });

  it("단계가 토론이 아니면 WRONG_PHASE, 같은 형태로 보낸 소켓에만 간다", async () => {
    const g = await startedGame("nomination", 5);
    const from = g.actors[1]!;
    const frames = await sendWhisper(g, from, g.actors[2]!.seat, CANARY);
    g.actors.forEach((a, i) => {
      expect(summary(frames[i]!)).toBe(a === from ? "[error:WRONG_PHASE,state:nomination]" : "[]");
    });
    expect((await whispersOf(g.code)).length).toBe(0);
  });

  it("유령 보낸 사람·자기 자신·죽은 대상은 모두 BAD_MESSAGE 이고 저장되지 않는다", async () => {
    const g = await startedGame("discussion", 5);
    const [a, c] = [g.actors[1]!, g.actors[3]!];
    await editRoom(g.code, (room) => mapPlayers(room, (p) => (p.seat === c.seat ? { ...p, alive: false } : p)));
    for (const x of g.actors) await settle(x.sock, mark(x.sock));
    for (const [from, to] of [[c, a], [a, a], [a, c]] as const) {
      const frames = await sendWhisper(g, from, to.seat, CANARY);
      g.actors.forEach((x, i) => {
        expect(summary(frames[i]!)).toBe(x === from ? "[error:BAD_MESSAGE,state:discussion]" : "[]");
      });
    }
    expect((await whispersOf(g.code)).length).toBe(0);
  });

  it("방에 없는 좌석·31자소·공백뿐은 BAD_MESSAGE 이고 스키마 밖(빈 본문·201자)도 보낸 소켓에만 BAD_MESSAGE 다", async () => {
    const g = await startedGame("discussion", 5);
    const from = g.actors[1]!;
    for (const [to, text] of [[7, "x"], [g.actors[2]!.seat, "가".repeat(31)], [g.actors[2]!.seat, "   "]] as const) {
      const frames = await sendWhisper(g, from, to, text);
      g.actors.forEach((x, i) => expect(summary(frames[i]!)).toBe(x === from ? "[error:BAD_MESSAGE,state:discussion]" : "[]"));
    }
    expect((await whispersOf(g.code)).length).toBe(0);
  });

  it("연결이 끊긴 대상에게도 보낼 수 있고 돌아오면 복원으로 본문을 받는다(O-5)", async () => {
    const g = await startedGame("discussion", 5);
    const from = g.actors[1]!;
    const to = g.actors[2]!;
    to.sock.ws.close();
    await pause(100);
    const marks = g.actors.map((a) => mark(a.sock));
    send(from.sock, { t: "whisper", to: to.seat, text: CANARY });
    await settle(from.sock, marks[g.actors.indexOf(from)]!);
    expect((await whispersOf(g.code)).length).toBe(1);
    const again = await connect(g.code);
    const lines = await helloForLog(again, to.token);
    expect(lines.map((l) => `${l.k}:${l.text}`).join("|")).toBe(`whisper:${CANARY}`);
  });

  it("복원: 당사자 둘은 본문 줄을, 나머지는 사실 줄을 받고 서로의 줄은 오지 않는다", async () => {
    const g = await startedGame("discussion", 5);
    const from = g.actors[1]!;
    const to = g.actors[2]!;
    await sendWhisper(g, from, to.seat, CANARY);
    for (const a of g.actors) {
      const lines = await helloForLog(await connect(g.code), a.token);
      const party = a === from || a === to;
      expect(lines.map((l) => `${l.k}|${l.text}|${l.seat}|${l.to}`).join(",")).toBe(party ? `whisper|${CANARY}|${from.seat}|${to.seat}` : `whispered||${from.seat}|${to.seat}`);
    }
  });

  it("모든 소켓이 받은 all 채널 seq 열은 그 사이의 일반 채팅 줄을 포함해 틈 없이 이어진다", async () => {
    const g = await startedGame("discussion", 5);
    const [x, from, to] = [g.actors[0]!, g.actors[1]!, g.actors[2]!];
    const marks = g.actors.map((a) => mark(a.sock));
    chatSend(x.sock, "앞 줄");
    for (const a of g.actors) await settle(a.sock, marks[g.actors.indexOf(a)]!);
    await sendWhisper(g, from, to.seat, CANARY);
    await resetChatRates(g.code);
    chatSend(x.sock, "뒷 줄");
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    for (const a of g.actors) {
      const seqs = chatsOf(framesOf(a.sock)).filter((c) => c.ch === "all").map((c) => c.seq);
      expect(seqs.join(",")).toBe("1,2,3");
    }
  });

  it("보관: 방 저장소 room.whispers 에 {n, from, to, text, at} 가 쌓이고 채팅 all 줄이 상한을 넘어 밀려도 남는다(O-20)", async () => {
    const g = await startedGame("discussion", 5);
    const from = g.actors[1]!;
    const to = g.actors[2]!;
    await sendWhisper(g, from, to.seat, CANARY);
    const kept = await whispersOf(g.code);
    expect(JSON.stringify(kept.map((w) => [w.n, w.from, w.to, w.text, typeof w.at]))).toBe(JSON.stringify([[1, from.seat, to.seat, CANARY, "number"]]));
    // 연결당 초당 20개 한도를 피해 본체(applyChat)를 직접 부른다 — 보관·상한은 같은 본체를 지난다.
    await runInDurableObject(env.ROOM.getByName(g.code), async (instance) => {
      const room = instance["room"]!;
      const me = room.players.find((p) => p.seat === g.actors[0]!.seat)!;
      for (let i = 0; i < 105; i += 1) {
        instance["chatRates"].clear();
        const why = await instance["applyChat"](me.id, `줄${i}`, `${room.day ?? 0}:${room.phase}`, Date.now());
        if (why !== null) throw new Error(`막힘 ${why}`);
      }
    });
    const records = Object.values(await chatRecordsOf(g.code));
    expect(records.filter((r) => r.k === "whisper" || r.k === "whispered").length).toBe(0); // 오래된 두 줄은 밀려 사라졌다
    expect((await chatKeysOf(g.code)).length).toBeLessThanOrEqual(100);
    expect(JSON.stringify(await whispersOf(g.code))).toBe(JSON.stringify(kept)); // 본문 보관은 그대로
  });

  it("chatLog 가 null 이 아닌 hello 에서도 귓속말 본문이 당사자 밖 chatLog 에 없다", async () => {
    const g = await startedGame("discussion", 5);
    await sendWhisper(g, g.actors[1]!, g.actors[2]!.seat, CANARY);
    const outsider = g.actors[3]!;
    const sock = await connect(g.code);
    await helloForLog(sock, outsider.token);
    expect(chatLogOf(framesOf(sock))!.some((l) => l.text.includes(CANARY))).toBe(false);
  });
});
