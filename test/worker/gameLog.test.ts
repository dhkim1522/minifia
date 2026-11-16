// 판 기록 D1 (23-10 Task 2) — 방 DO 가 ended 전환에서 한 번 games 에 한 줄을 남기고, 저장이 실패해도 게임은 멈추지 않는다(D-16, T-23-38).
// setup 이 실제 마이그레이션을 메모리 D1 에 적용해 두므로 env.DB 로 바로 읽는다. 삽입은 waitUntil 이라 until 로 폴링한다.
import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildGameRow } from "../../shared/game/gameLog";
import type { RoomState } from "../../shared/game/room";
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
  until,
} from "./helpers";
import type { Seated, TestSocket } from "./helpers";

let restore: () => void = () => {};
beforeEach(() => {
  restore = openKeyword();
});
afterEach(() => restore());

type Row = Record<string, string | number | null>;
type KeywordRoom = { keyword?: { genre: string; word: string }; gameId?: string; startedAt?: number; winner?: string; keywordProbed?: true };

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

  it("키워드 단계에서 마피아가 금지어 확정으로 한 번 거절된 판은 probe_success 1", { timeout: 90_000 }, async () => {
    const room = await inKeyword();
    const word = ((await storedRoom(room.code)) as unknown as KeywordRoom).keyword!.word;
    send(room.host, { t: "answer", text: word, final: true }); // 방장이 마피아다
    await until("떠보기 기록", async () => ((await storedRoom(room.code)) as unknown as KeywordRoom).keywordProbed === true);
    await driveHumansToEnded(room);
    const id = ((await storedRoom(room.code)) as unknown as KeywordRoom).gameId!;
    await until("D1 한 줄", async () => (await rowOf(id)) !== null);
    expect((await rowOf(id))!.probe_success).toBe(1);
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
