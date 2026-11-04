// 귓속말 워커 통합 테스트(09.1.1-02, 결정 0066-2, L17): 본문 줄은 당사자 두 소켓에만, 나머지에는 같은 seq 의 사실 줄만 간다.
import { describe, expect, it } from "vitest";
import type { RoleId } from "../../shared/game/roles";
import type { ServerMessage } from "../../shared/protocol";
import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { advanceTo, chatKeysOf, chatLogOf, chatRecordsOf, chatSend, chatsOf, connect, editRoom, framesOf, helloForLog, killSeats, mapPlayers, mark, pause, resetChatRates, send, settle, startedGame, storedRoom, summary } from "./helpers";
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

// ---- L17: 귓속말 본문은 당사자 두 소켓에만 (결정 0066-2, 0002, 0021) ----

/** 좌석 오름차순 소켓·역할 배정. 방장(좌석 0)부터 마피아·마피아·경찰·의사·시민·시민. */
const ROLES_M: readonly RoleId[] = ["mafia", "mafia", "police", "doctor", "citizen", "citizen"];
/** 같은 대본을 역할만 바꿔 보내는 메타모픽용 배정(마피아와 시민을 맞바꾼다). */
const ROLES_N: readonly RoleId[] = ["citizen", "citizen", "police", "doctor", "mafia", "mafia"];
const GHOST_SEAT = 5;

/** chat 프레임 키 허용 목록: 결정 0061-11 의 .k 에 더해 귓속말 상대 좌석 .to(결정 0066-2, 공개 사실) 하나뿐이다. leak.test.ts 의 CHAT_KEY_PATHS 와 같다. */
const WHISPER_CHAT_KEY_PATHS = new Set([".t", ".ch", ".seat", ".seq", ".text", ".at", ".k", ".to"]);
const WHISPER_CHATLOG_KEY_PATHS = new Set([".t", ".lines", ".lines[].ch", ".lines[].seat", ".lines[].seq", ".lines[].text", ".lines[].at", ".lines[].k", ".lines[].to"]);
const CHAT_KIND_VALUES: ReadonlySet<string> = new Set(["will", "note", "whisper", "whispered", "ballots"]);

function keyPathsOf(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => keyPathsOf(v, `${path}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [`${path}.${k}`, ...keyPathsOf(v, `${path}.${k}`)]);
  }
  return [];
}

/** 역할을 배정해 판을 만들고 좌석 5(시민)를 유령으로 만든 뒤 좌석 오름차순 소켓을 돌려준다. */
async function matrixGame(assign: readonly RoleId[]): Promise<{ g: Game; bySeat: Actor[] }> {
  const g = await startedGame("discussion", 5);
  const bySeat = [...g.actors].sort((a, b) => a.seat - b.seat);
  await editRoom(g.code, (room) => mapPlayers(room, (p) => ({ ...p, role: assign[p.seat as number] })));
  await killSeats(g, [GHOST_SEAT]);
  for (const a of g.actors) await settle(a.sock, mark(a.sock));
  return { g, bySeat };
}

describe("L17 — 귓속말 본문은 당사자 소켓에만", () => {
  // 보낸·받은 사람의 신분 조합 두 가지. 나머지 소켓에는 나머지 신분(와 유령)이 모두 든다.
  it.each([
    ["시민 -> 마피아", 4, 1],
    ["경찰 -> 의사", 2, 3],
  ])("신분 행렬 %s: 본문은 당사자 두 소켓의 chat/chatLog 프레임에만 있고 유령을 포함한 나머지의 어떤 프레임에도 없다", async (_name, fromSeat, toSeat) => {
    const { g, bySeat } = await matrixGame(ROLES_M);
    const from = bySeat[fromSeat]!;
    const to = bySeat[toSeat]!;
    expect(bySeat[GHOST_SEAT]!.seat).toBe(GHOST_SEAT);
    await sendWhisper(g, from, to.seat, CANARY);
    // 판을 계속 진행한 뒤(밤까지) 모두 새로 접속해 복원 프레임도 모은다.
    await advanceTo(g.code, g.socks, "night");
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    const fresh = new Map<Actor, Awaited<ReturnType<typeof connect>>>();
    for (const a of g.actors) {
      const sock = await connect(g.code);
      await helloForLog(sock, a.token);
      fresh.set(a, sock);
    }
    for (const a of g.actors) {
      const party = a === from || a === to;
      for (const frames of [framesOf(a.sock), framesOf(fresh.get(a)!)]) {
        const raw = JSON.stringify(frames);
        const lines = [...chatsOf(frames), ...frames.flatMap((m) => (m.t === "chatLog" ? m.lines : []))];
        const bodies = lines.filter((l) => l.k === "whisper");
        const facts = lines.filter((l) => l.k === "whispered");
        if (party) {
          expect(raw.includes(CANARY)).toBe(true);
          expect(`${bodies.length}/${facts.length}`).toBe("1/0");
        } else {
          expect(raw.includes(CANARY)).toBe(false);
          // 사실 줄은 정확히 한 번(라이브 프레임 또는 복원 줄 중 한 곳) — 유령도 받는다.
          expect(`${bodies.length}/${facts.length}`).toBe("0/1");
          expect(facts[0]!.text).toBe("");
          expect(`${facts[0]!.seat}->${facts[0]!.to}`).toBe(`${from.seat}->${to.seat}`);
        }
      }
    }
  }, 40_000);

  it("사실 줄은 모든 비당사자 소켓(유령 포함)에 정확히 한 번, 당사자에게는 whispered 줄이 없다", async () => {
    const { g, bySeat } = await matrixGame(ROLES_M);
    const from = bySeat[4]!;
    const to = bySeat[0]!;
    const frames = await sendWhisper(g, from, to.seat, CANARY);
    g.actors.forEach((a, i) => {
      const facts = chatsOf(frames[i]!).filter((c) => c.k === "whispered");
      expect(facts.length).toBe(a === from || a === to ? 0 : 1);
    });
    expect(chatsOf(frames[g.actors.indexOf(bySeat[GHOST_SEAT]!)]!).filter((c) => c.k === "whispered").length).toBe(1);
  });

  it("쓰고 보내는 동안 당사자가 아닌 소켓이 받은 typing 프레임은 0이다(귓속말 시트는 입력 중 신호를 보내지 않는다 — 서버로 가는 신호는 whisper 메시지 하나뿐)", async () => {
    const { g, bySeat } = await matrixGame(ROLES_M);
    const from = bySeat[4]!;
    const to = bySeat[1]!;
    const marks = g.actors.map((a) => mark(a.sock));
    // 쓰는 구간: 서버에는 아무 신호도 가지 않는다. 보낸 뒤에야 whisper 한 통이 간다.
    await pause(200);
    send(from.sock, { t: "whisper", to: to.seat, text: CANARY });
    for (const a of g.actors) await settle(a.sock, marks[g.actors.indexOf(a)]!);
    for (const [i, a] of g.actors.entries()) {
      const typings = framesOf(a.sock).slice(marks[i]!).filter((m) => m.t === "typing");
      expect(`${a.seat}:${typings.length}`).toBe(`${a.seat}:0`);
    }
  });

  it("프레임 키: chat 은 CHAT_KEY_PATHS(+.to), chatLog 줄은 CHATLOG_KEY_PATHS(+.lines[].to), k 값은 will·note·whisper·whispered 뿐이고 마스크(r)·쓰기 순번(g)·일차(n)·whispers 키 이름은 어떤 프레임에도 없다", async () => {
    const { g, bySeat } = await matrixGame(ROLES_M);
    const from = bySeat[4]!;
    const to = bySeat[1]!;
    await sendWhisper(g, from, to.seat, CANARY);
    for (const a of g.actors) {
      const sock = await connect(g.code);
      await helloForLog(sock, a.token);
      for (const frames of [framesOf(a.sock), framesOf(sock)]) {
        for (const m of frames) {
          const paths = keyPathsOf(m);
          if (m.t === "chat") {
            for (const pth of paths) expect(`${pth}:${WHISPER_CHAT_KEY_PATHS.has(pth)}`).toBe(`${pth}:true`);
            if (m.k !== undefined) expect(CHAT_KIND_VALUES.has(m.k)).toBe(true);
          }
          if (m.t === "chatLog") {
            for (const pth of paths) expect(`${pth}:${WHISPER_CHATLOG_KEY_PATHS.has(pth)}`).toBe(`${pth}:true`);
            for (const l of m.lines) if (l.k !== undefined) expect(CHAT_KIND_VALUES.has(l.k)).toBe(true);
          }
          // 어떤 종류의 프레임에도 서버 전용 이름은 없다. me.whisperUsed 는 보낸 사람 본인 state 에만 있다.
          expect(paths.some((pth) => pth.endsWith(".whispers") || pth.endsWith(".partyMask") || pth.endsWith(".othersMask"))).toBe(false);
          if (m.t === "chat" || m.t === "chatLog") expect(paths.some((pth) => /\.(r|g|n)$/.test(pth) || /\.lines\[\]\.(r|g|n)$/.test(pth))).toBe(false);
          const used = paths.filter((pth) => pth.endsWith(".whisperUsed"));
          if (used.length > 0) {
            expect(used.join(",")).toBe(".view.me.whisperUsed");
            expect(a === from).toBe(true);
          }
        }
      }
    }
  }, 40_000);

  it("오라클 금지: 둘째 시도·유령 보낸 사람·자기 자신·죽은 대상 거절의 프레임 열이 보낸 소켓에서 서로 구별되지 않고 나머지 소켓은 0프레임이다", async () => {
    const { g, bySeat } = await matrixGame(ROLES_M);
    const a = bySeat[4]!;
    const b = bySeat[1]!;
    const ghost = bySeat[GHOST_SEAT]!;
    await sendWhisper(g, a, b.seat, "첫번째"); // a 는 오늘 이미 보냈다
    const cases: Array<[string, Actor, number]> = [
      ["둘째 시도", a, b.seat],
      ["유령 보낸 사람", ghost, b.seat],
      ["자기 자신", b, b.seat],
      ["죽은 대상", bySeat[2]!, ghost.seat],
    ];
    const seen: string[] = [];
    for (const [, sender, to] of cases) {
      const frames = await sendWhisper(g, sender, to, CANARY);
      g.actors.forEach((x, i) => {
        if (x !== sender) expect(summary(frames[i]!)).toBe("[]");
      });
      const mine = frames[g.actors.indexOf(sender)]!;
      seen.push(`${summary(mine)}/${mine.length}`);
    }
    expect(seen.join("|")).toBe(Array(4).fill("[error:BAD_MESSAGE,state:discussion]/2").join("|"));
  });

  it("메타모픽: 역할 배정만 다른 두 판에서 같은 대본을 보내면 모든 좌석 소켓의 chat 프레임 열(본문 제외 필드)이 같다", async () => {
    const SCRIPT_W: ReadonlyArray<[number, number]> = [[1, 2], [3, 1], [4, 0], [1, 3]]; // 마지막은 둘째 시도(거절)
    const run = async (assign: readonly RoleId[]): Promise<string[]> => {
      const { g, bySeat } = await matrixGame(assign);
      const marks = bySeat.map((a) => mark(a.sock));
      for (const [f, t] of SCRIPT_W) {
        send(bySeat[f]!.sock, { t: "whisper", to: t, text: `${CANARY}-${f}` });
        for (const a of bySeat) await settle(a.sock, mark(a.sock));
      }
      return bySeat.map((a, i) => {
        const frames = framesOf(a.sock).slice(marks[i]!);
        return chatsOf(frames)
          .map((c) => `${c.ch}/${c.seat}/${c.seq}/${c.k}/${c.to}/${c.text === "" ? "-" : "body"}`)
          .join(",");
      });
    };
    const colA = await run(ROLES_M);
    const colB = await run(ROLES_N);
    expect(colA.every((c) => c.length > 0)).toBe(true); // 비어 있는 비교가 아니다
    expect(colA.join("\n")).toBe(colB.join("\n"));
  }, 40_000);
});
