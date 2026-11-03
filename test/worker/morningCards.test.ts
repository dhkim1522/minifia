// 아침 공개의 서버 층 DO 시험(09-14, MORN-01·MORN-02, WILL-01, NIGHT-12, 결정 0061-11·14).
// 사망 전환(처형·암살)에서 서버가 유언·쪽지 카드를 한 번만 만든다. 카드는 all 채널 줄이고 k 가 will/note 다.
import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { advanceTo, chatRecordsOf, chatsOf, closePhase, connect, editRoom, homeBySeat, lastViewOf, mapPlayers, mark, nextFrame, pickAs, pointAll, send, settle, startedGame, storedRoom, verdictAll, withRole } from "./helpers";
import type { Game } from "./helpers";

type Card = Extract<ServerMessage, { t: "chat" }>;

/** 소켓마다 mark 이후의 chat 프레임을 모은다. */
async function chatsSince(g: Game, marks: number[]): Promise<Card[][]> {
  const out: Card[][] = [];
  for (let i = 0; i < g.socks.length; i += 1) out.push(chatsOf(await settle(g.socks[i]!, marks[i]!)));
  return out;
}

const cardText = (c: Card): string => `${c.ch}/${c.k ?? "-"}/${c.seat}/${c.text}`;

/** 처형으로 끝나는 낮: defender 에게 will(있으면)을 저장해 두고 지목 → 변론 → 찬반 통과 → 처형 진입까지 끌고 간다. 처형 진입 전 mark 를 돌려준다. */
async function execute(will: string | undefined): Promise<{ g: Game; defender: Game["actors"][number]; marks: number[] }> {
  const g = await startedGame("nomination");
  const defender = withRole(g, "citizen")[0]!;
  if (will !== undefined) {
    await editRoom(g.code, (room) => mapPlayers(room, (p) => (p.seat === defender.seat ? { ...p, will } : p)));
  }
  const others = g.actors.filter((a) => a.seat !== defender.seat);
  const bySeat: Record<number, number> = { [defender.seat]: others[0]!.seat };
  for (const o of others) bySeat[o.seat] = defender.seat;
  await pointAll(g.code, g.actors, bySeat);
  await closePhase(g.code);
  for (const sock of g.socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "verdict");
  const marks = g.socks.map((s) => mark(s));
  await verdictAll(g.code, g.actors, Object.fromEntries(others.map((o) => [o.seat, true])));
  return { g, defender, marks };
}

describe("처형된 사람의 유언 카드 (WILL-01, MORN-02)", () => {
  it("유언 '억울해요' 를 남긴 사람이 처형되면 여섯 소켓 모두 all 채널 will 카드 한 장을 받고 저장소에도 k will 줄이 있다", async () => {
    const { g, defender, marks } = await execute("억울해요");
    const got = await chatsSince(g, marks);
    expect(got.map((c) => c.map(cardText).join("|")).join(" ; ")).toBe(g.socks.map(() => `all/will/${defender.seat}/억울해요`).join(" ; "));
    const stored = Object.values(await chatRecordsOf(g.code)).filter((r) => r.k === "will");
    expect(stored.map((r) => `${r.ch}/${r.seat}/${r.text}`).join("|")).toBe(`all/${defender.seat}/억울해요`);
  }, 40_000);

  it("유언이 없는 사람이 처형되면 chat 프레임이 0개다", async () => {
    const { g, marks } = await execute(undefined);
    const got = await chatsSince(g, marks);
    expect(got.map((c) => c.length).join(",")).toBe(g.socks.map(() => 0).join(","));
    expect(Object.values(await chatRecordsOf(g.code)).filter((r) => r.k !== undefined).length).toBe(0);
  }, 40_000);

  it("처형에는 분필이 없다: 처형 직후 모든 소켓의 day.chalk 가 없다", async () => {
    const { g } = await execute("억울해요");
    for (const sock of g.socks) {
      const last = sock.frames.map((f) => JSON.parse(f) as ServerMessage).filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state").at(-1)!;
      expect(last.view.day?.chalk === undefined).toBe(true);
    }
  }, 40_000);
});

// ---- 아침: 암살 피해자의 유언·쪽지 카드와 분필 (MORN-01·02, NIGHT-12) ----

type Actor = Game["actors"][number];

interface Night {
  g: Game;
  v: Actor;
  mafias: Actor[];
}

/** 밤 6명 판: 시민 V 에게 will(있으면)을 저장하고 마피아 전원이 V 를 골라 확정시킨 뒤, 쪽지(있으면)를 마피아 A 가 남긴다. */
async function nightOf(will: string | undefined, note: string | undefined): Promise<Night> {
  const g = await startedGame("night");
  const v = withRole(g, "citizen")[0]!;
  if (will !== undefined) await editRoom(g.code, (room) => mapPlayers(room, (p) => (p.seat === v.seat ? { ...p, will } : p)));
  const mafias = withRole(g, "mafia");
  for (const m of mafias) pickAs(m, v.seat);
  for (const a of g.actors) await settle(a.sock, mark(a.sock));
  if (note !== undefined) send(mafias[0]!.sock, { t: "note", text: note });
  for (const a of g.actors) await settle(a.sock, mark(a.sock));
  return { g, v, mafias };
}

/** 아침으로 넘기고 소켓마다 아침 진입 뒤의 chat 프레임을 모은다. */
async function intoMorning(g: Game): Promise<Card[][]> {
  const marks = g.socks.map((s) => mark(s));
  await advanceTo(g.code, g.socks, "morning");
  return chatsSince(g, marks);
}

const chalkOf = (sock: Game["socks"][number]): string => JSON.stringify(lastViewOf(sock).day?.chalk);

describe("아침 카드: 피해자 유언 + 마피아 쪽지 (WILL-01, NIGHT-12, MORN-02)", () => {
  it("유언과 쪽지가 모두 있으면 모든 소켓이 [will, note] 순서로 같은 두 장을 받고 어느 프레임에도 쪽지 작성자 좌석이 없다", async () => {
    const { g, v, mafias } = await nightOf("2번을 봐요", "다음은 너");
    const got = await intoMorning(g);
    const want = `all/will/${v.seat}/2번을 봐요|all/note/${v.seat}/다음은 너`;
    expect(got.map((c) => c.map(cardText).join("|")).join(" ; ")).toBe(g.socks.map(() => want).join(" ; "));
    for (const c of got.flat()) {
      expect(Object.keys(c).sort().join(",")).toBe("at,ch,k,seat,seq,t,text");
      expect(mafias.map((m) => m.seat).includes(c.seat)).toBe(false);
    }
  }, 40_000);

  it("유언이 없으면 note 카드 하나, 쪽지가 없으면 will 카드 하나다", async () => {
    const onlyNote = await nightOf(undefined, "쪽지만");
    const a = await intoMorning(onlyNote.g);
    expect(a.map((c) => c.map(cardText).join("|")).join(" ; ")).toBe(onlyNote.g.socks.map(() => `all/note/${onlyNote.v.seat}/쪽지만`).join(" ; "));
    const onlyWill = await nightOf("유언만", undefined);
    const b = await intoMorning(onlyWill.g);
    expect(b.map((c) => c.map(cardText).join("|")).join(" ; ")).toBe(onlyWill.g.socks.map(() => `all/will/${onlyWill.v.seat}/유언만`).join(" ; "));
  }, 60_000);

  it("의사가 지키면 카드 0장, 분필 없음, day.morning 은 { saved: true } 다 (결정 0044-22)", async () => {
    const { g, v } = await nightOf("유언", "쪽지");
    const doctor = withRole(g, "doctor")[0]!;
    pickAs(doctor, v.seat);
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    const got = await intoMorning(g);
    expect(got.map((c) => c.length).join(",")).toBe(g.socks.map(() => 0).join(","));
    for (const sock of g.socks) {
      expect(chalkOf(sock)).toBe(undefined);
      expect(JSON.stringify(lastViewOf(sock).day?.morning)).toBe(JSON.stringify({ saved: true }));
    }
    expect(Object.values(await chatRecordsOf(g.code)).filter((r) => r.k !== undefined).length).toBe(0);
  }, 40_000);

  it("마피아 선택이 갈려 아침이 무효이면 카드 0장, 분필 없음이다", async () => {
    const g = await startedGame("night");
    const [a, b] = withRole(g, "mafia") as [Actor, Actor];
    const [c1, c2] = withRole(g, "citizen") as [Actor, Actor];
    await editRoom(g.code, (room) => mapPlayers(room, (p) => (p.seat === c1.seat ? { ...p, will: "유언" } : p)));
    pickAs(a, c1.seat);
    pickAs(b, c2.seat);
    for (const x of g.actors) await settle(x.sock, mark(x.sock));
    const got = await intoMorning(g);
    expect(got.map((c) => c.length).join(",")).toBe(g.socks.map(() => 0).join(","));
    for (const sock of g.socks) expect(chalkOf(sock)).toBe(undefined);
  }, 40_000);
});

describe("분필 좌표 (MORN-01, 결정 0061-14)", () => {
  /** homeBySeat 문자열('일차|0:x,z|…')에서 좌석의 좌표를 { x, z } JSON 으로. */
  const homeOf = (home: string, seatNo: number): string => {
    const row = home.split("|").find((r) => r.startsWith(`${seatNo}:`))!;
    const [x, z] = row.slice(row.indexOf(":") + 1).split(",").map(Number);
    return JSON.stringify({ x, z });
  };

  it("암살 아침의 모든 소켓 day.chalk 는 V 의 home 좌표로 같고, 다음 낮 시작·토론·지목에도 같으며, 다음 밤에는 없다", async () => {
    const { g, v } = await nightOf(undefined, undefined);
    const home = await homeBySeat(g.code);
    await intoMorning(g);
    const want = homeOf(home, v.seat);
    for (const sock of g.socks) expect(chalkOf(sock)).toBe(want);
    for (const phase of ["dayAnnounce", "discussion", "nomination"] as const) {
      await advanceTo(g.code, g.socks, phase);
      for (const sock of g.socks) expect(`${phase}:${chalkOf(sock)}`).toBe(`${phase}:${want}`);
    }
    await advanceTo(g.code, g.socks, "night");
    for (const sock of g.socks) expect(chalkOf(sock)).toBe(undefined);
  }, 60_000);

  it("재접속한 소켓의 첫 state 에도 day.chalk 가 있다", async () => {
    const { g, v } = await nightOf(undefined, undefined);
    const home = await homeBySeat(g.code);
    await intoMorning(g);
    const survivor = g.actors.find((a) => a.seat !== v.seat)!;
    const again = await connect(g.code);
    send(again, { t: "hello", token: survivor.token });
    const state = (await nextFrame(again, (m) => m.t === "state")) as Extract<ServerMessage, { t: "state" }>;
    expect(JSON.stringify(state.view.day?.chalk)).toBe(homeOf(home, v.seat));
  }, 40_000);

  it("알람 따라잡기로 처형과 암살이 한 번에 지나간 전환은 사망마다 카드를 한 번씩, 그 밤 피해자의 분필과 함께 낸다", async () => {
    const g = await startedGame("night");
    const [x, v] = withRole(g, "citizen") as [Actor, Actor];
    const home = await homeBySeat(g.code);
    const marks = g.socks.map((s) => mark(s));
    await runInDurableObject(env.ROOM.getByName(g.code), async (instance) => {
      const room = (instance as unknown as { room: { players: Array<{ seat: number; alive?: boolean; will?: string }>; [k: string]: unknown } }).room;
      const prev = { ...room, players: room.players.map((p) => ({ ...p })) };
      const cur = {
        ...room,
        phase: "morning",
        morning: { eliminated: v.seat },
        nightNote: "다음은 너",
        players: room.players.map((p) =>
          p.seat === x.seat ? { ...p, alive: false, will: "처형 유언" } : p.seat === v.seat ? { ...p, alive: false, will: "암살 유언" } : p,
        ),
      };
      (instance as unknown as { room: unknown }).room = cur;
      await (instance as unknown as { afterTransition: (p: unknown, n: number) => Promise<void> }).afterTransition(prev, Date.now());
    });
    const got = await chatsSince(g, marks);
    const want = [`all/will/${x.seat}/처형 유언`, `all/will/${v.seat}/암살 유언`, `all/note/${v.seat}/다음은 너`].join("|");
    expect(got.map((c) => c.map(cardText).join("|")).join(" ; ")).toBe(g.socks.map(() => want).join(" ; "));
    expect(JSON.stringify(((await storedRoom(g.code)) as unknown as { chalk?: { x: number; z: number } }).chalk)).toBe(homeOf(home, v.seat));
  }, 40_000);
});
