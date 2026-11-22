// 판 기록 D1 (23-10 Task 2) — 방 DO 가 ended 전환에서 한 번 games 에 한 줄을 남기고, 저장이 실패해도 게임은 멈추지 않는다(D-16, T-23-38).
// setup 이 실제 마이그레이션을 메모리 D1 에 적용해 두므로 env.DB 로 바로 읽는다. 삽입은 전환 끝(afterTransition)에서 기다리지만 시험은 소켓 쪽에서 보므로 until 로 폴링한다.
import { env, runInDurableObject } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildGameRow } from "../../shared/game/gameLog";
import type { RoomState } from "../../shared/game/room";
import { restSegment } from "../../shared/game/world";
import { insertGame } from "../../worker/gameLog";
import { openKeyword } from "../helpers/keyword";
import {
  advanceTo,
  driveToEnded,
  editRoom,
  lastViewOf,
  mapPlayers,
  mark,
  nextFrame,
  pause,
  seat,
  send,
  settle,
  storedRoom,
  toPhase,
  until,
} from "./helpers";
import type { Seated, TestSocket } from "./helpers";

let restore: () => void = () => {};
beforeEach(() => {
  restore = openKeyword();
});
afterEach(() => restore());

type Row = Record<string, string | number | null>;
type KeywordRoom = { keyword?: { genre: string; word: string }; gameId?: string; startedAt?: number; winner?: string };

const socksOf = (room: Seated): TestSocket[] => [room.host, ...room.guests.map((g) => g.sock)];
const rowOf = (id: string): Promise<Row | null> => env.DB.prepare("SELECT * FROM games WHERE id = ?").bind(id).first<Row>();
const countAll = async (): Promise<number> => (await env.DB.prepare("SELECT COUNT(*) AS c FROM games").first<{ c: number }>())!.c;

/** 사람 4(방장 마피아 지정) + 봇 1 테스트 방을 시작해 keyword 단계 첫 순간까지 돌린다. */
async function inKeyword(): Promise<Seated> {
  const room = await seat(3, 0, { testMode: true });
  const socks = socksOf(room);
  for (const s of socks) await settle(s, mark(s));
  send(room.host, { t: "testBots", count: 1 });
  await settle(room.host, mark(room.host));
  send(room.host, { t: "testRole", role: "mafia" });
  await settle(room.host, mark(room.host));
  send(room.host, { t: "start" });
  for (const s of socks) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "assigning");
  await advanceTo(room.code, socks, "keyword");
  for (const s of socks) await settle(s, mark(s));
  return room;
}

/** 방장(마피아)이 처형자가 되도록 사람 손님도 같은 표를 던지게 하고 ended 까지 끌고 간다. */
async function driveHumansToEnded(room: Seated): Promise<void> {
  const humanGuests = new Set(room.guests.map((g) => g.seat));
  await driveToEnded(room, async (stage) => {
    await editRoom(room.code, (r) =>
      mapPlayers(r, (p) => {
        if (!humanGuests.has(p.seat as number)) return p;
        return stage === "verdict" ? { ...p, verdictVote: true } : { ...p, nominate: 0 };
      }),
    );
  });
  for (const s of socksOf(room)) await settle(s, mark(s));
}

describe("판이 끝나면 D1 에 한 줄 (SC6)", () => {
  it("ended 뒤 games 에 한 줄이 남고 값이 저장된 판과 맞는다", { timeout: 90_000 }, async () => {
    const room = await inKeyword();
    await driveHumansToEnded(room);
    const stored = (await storedRoom(room.code)) as unknown as KeywordRoom;
    expect(stored.gameId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    await until("D1 한 줄", async () => (await rowOf(stored.gameId!)) !== null);
    const row = (await rowOf(stored.gameId!))!;
    expect(row.genre).toBe(stored.keyword!.genre);
    expect(row.word).toBe(stored.keyword!.word);
    expect(row.winner).toBe(stored.winner === "mafiaWin" ? "mafia" : "citizen");
    expect(row.has_bots).toBe(1);
    expect(row.bots).toBe(1);
    expect(row.players).toBe(5);
    expect(row.probe_success).toBe(0);
    expect(row.note_count).toBe(0);
    expect(row.tutorial).toBe(0);
    expect(typeof row.duration_s).toBe("number");
    expect(JSON.stringify(row)).not.toContain("방장");
    expect(JSON.stringify(row)).not.toContain("손님");
  });

  it("둘째 날 토론에서 한 사람이 붙이고 옮긴 판은 note_count 1(옮긴 것은 한 장), tutorial 0 (24-02, D-09·D-18)", { timeout: 90_000 }, async () => {
    const room = await inKeyword();
    const socks = socksOf(room);
    await advanceTo(room.code, socks, "discussion");
    await toPhase(room.code, "discussion", (r) => ({ ...r, day: 2 }));
    // 서버 전용 월드 구간: 모두를 한 자리에 세운다(거리 판정 통과).
    await runInDurableObject(env.ROOM.getByName(room.code), async (instance) => {
      const inst = instance as unknown as { room: { players: Array<{ id: string }> }; world: { segs: Record<string, unknown> } };
      const now = Date.now();
      const segs: Record<string, unknown> = {};
      for (const p of inst.room.players) segs[p.id] = restSegment(0, 0, now);
      inst.world = { ...inst.world, segs } as typeof inst.world;
    });
    for (const s of socks) await settle(s, mark(s));
    const stuckBy = room.guests[0]!;
    send(stuckBy.sock, { t: "suspect", target: room.guests[1]!.seat });
    await until("첫 붙이기 저장", async () => ((await storedRoom(room.code)) as unknown as { notes?: unknown[] }).notes?.length === 1);
    await pause(700); // 연타 간격(600ms)을 넘긴다
    send(stuckBy.sock, { t: "suspect", target: 0 });
    await until("옮기기 저장", async () => {
      const notes = ((await storedRoom(room.code)) as unknown as { notes?: Array<{ to: number }> }).notes ?? [];
      return notes.length === 1 && notes[0]!.to === 0;
    });
    await driveHumansToEnded(room);
    const id = ((await storedRoom(room.code)) as unknown as KeywordRoom).gameId!;
    await until("D1 한 줄", async () => (await rowOf(id)) !== null);
    const row = (await rowOf(id))!;
    expect(row.note_count).toBe(1);
    expect(row.tutorial).toBe(0);
  });

  it("마피아가 제시어를 포함한 단서를 확정해도 떠보기 성공으로 기록하지 않는다", { timeout: 90_000 }, async () => {
    const room = await inKeyword();
    const word = ((await storedRoom(room.code)) as unknown as KeywordRoom).keyword!.word;
    send(room.host, { t: "answer", text: word, final: true }); // 방장이 마피아다
    await nextFrame(room.host, (m) => m.t === "state" && m.view.me.answer?.final === true);
    await driveHumansToEnded(room);
    const id = ((await storedRoom(room.code)) as unknown as KeywordRoom).gameId!;
    await until("D1 한 줄", async () => (await rowOf(id)) !== null);
    expect((await rowOf(id))!.probe_success).toBe(0);
  });

  it("같은 행을 insertGame 으로 두 번 넣으면 한 줄", async () => {
    const row = buildGameRow(
      {
        gameId: crypto.randomUUID(),
        startedAt: 1000,
        winner: "mafiaWin",
        keyword: { genre: "food", word: "김밥" },
        players: [],
      } as unknown as RoomState,
      5000,
    )!;
    await insertGame(env.DB, row);
    await insertGame(env.DB, row);
    const { results } = await env.DB.prepare("SELECT id FROM games WHERE id = ?").bind(row.id).all();
    expect(results.length).toBe(1);
  });

  it("저장이 실패하는 판도 결과 화면을 모두 받고 다시 하기가 성공한다", { timeout: 90_000 }, async () => {
    const room = await inKeyword();
    const socks = socksOf(room);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await env.DB.prepare("ALTER TABLE games RENAME TO games_bak").run();
    try {
      await driveHumansToEnded(room);
      for (const s of socks) expect(lastViewOf(s).phase).toBe("ended");
      // 삽입 실패(WR-04)는 기다린 뒤 삼킨다 — 결과는 이미 저장·방송됐고 방 DO 는 던지지 않는다(저장된 방이 ended 다).
      expect((await storedRoom(room.code)).phase).toBe("ended");
      await until("실패 로그", async () => logged.mock.calls.some((c) => c[0] === "game log failed"));
      // 로그는 고정 문구 한 줄뿐이다 — 행·오류 내용을 싣지 않는다(T-23-39).
      expect(logged.mock.calls.filter((c) => c[0] === "game log failed").every((c) => c.length === 1)).toBe(true);
      const round = (lastViewOf(room.host) as { round?: number }).round ?? 1;
      for (const g of room.guests) send(g.sock, { t: "ready", on: true, round });
      for (const s of socks) await settle(s, mark(s));
      send(room.host, { t: "rematch", round });
      for (const s of socks) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "assigning");
      expect((await storedRoom(room.code)).phase).toBe("assigning");
    } finally {
      logged.mockRestore();
      await env.DB.prepare("ALTER TABLE games_bak RENAME TO games").run();
    }
  });

  it("키워드 스위치를 끈 옛 판 모양은 ended 뒤에도 행이 없다", { timeout: 90_000 }, async () => {
    restore(); // 스위치를 끈다 — 이 판은 keyword 가 없다
    const room = await seat(3, 0, { testMode: true });
    const socks = socksOf(room);
    for (const s of socks) await settle(s, mark(s));
    send(room.host, { t: "testBots", count: 1 });
    await settle(room.host, mark(room.host));
    send(room.host, { t: "testRole", role: "mafia" });
    await settle(room.host, mark(room.host));
    send(room.host, { t: "start" });
    for (const s of socks) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "assigning");
    const before = await countAll();
    await driveHumansToEnded(room);
    expect((await storedRoom(room.code)).phase).toBe("ended");
    await pause(300);
    expect(await countAll()).toBe(before);
  });

  it("다시 하기한 새 판의 gameId 는 이전 판과 다르다", { timeout: 90_000 }, async () => {
    const room = await inKeyword();
    const socks = socksOf(room);
    await driveHumansToEnded(room);
    const first = ((await storedRoom(room.code)) as unknown as KeywordRoom).gameId!;
    await until("첫 판 행", async () => (await rowOf(first)) !== null);
    for (const g of room.guests) send(g.sock, { t: "ready", on: true, round: 1 });
    for (const s of socks) await settle(s, mark(s));
    send(room.host, { t: "rematch", round: 1 });
    for (const s of socks) await nextFrame(s, (m) => m.t === "state" && m.view.phase === "assigning");
    const next = (await storedRoom(room.code)) as unknown as KeywordRoom;
    expect(next.gameId).toBeDefined();
    expect(next.gameId).not.toBe(first);
    expect(next.startedAt).toBeDefined();
  });
});
