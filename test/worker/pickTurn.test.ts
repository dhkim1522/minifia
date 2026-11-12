// 순차 지목 DO 통합 — 결정 0063-1, M-3(끊긴 차례), UI-SPEC A-6(재접속 스냅샷). 실제 방 DO·소켓으로 확인한다.
// 규칙(09.1-01~04): 차례는 서버 시각대로 8초를 채운다(tick 은 연결을 읽지 않는다). 다시 붙으면 같은 마감을 보고, 지나면 기권이며 차례는 다시 오지 않는다.
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import type { Actor } from "./helpers";
import { alarmOf, closePhase, connect, editRoom, hello, lastViewOf, mark, nextFrame, send, settle, startedGame, storedRoom, summary, until } from "./helpers";
import { rulesetOf } from "../../shared/game/ruleset";
const GAME_RULES = rulesetOf("extended");

const GAP_MS = 900;
const TURN_MS = 8000;

interface StoredPlayer {
  seat: number;
  connected?: boolean;
}

/** 4명 판을 지목 모이기에서 시작해 모이기를 닫고 첫 차례 주인이 지목하고 사이를 닫아 둘째 차례(B)까지 간다. */
async function atSecondTurn(): Promise<{ code: string; actors: Actor[]; a: Actor; b: Actor; others: Actor[] }> {
  const g = await startedGame("nomination", 3);
  await closePhase(g.code); // 모이기 끝 → 첫 차례
  const order = (await storedRoom(g.code)).pickTurn!.order;
  const a = g.actors.find((x) => x.seat === order[0])!;
  const b = g.actors.find((x) => x.seat === order[1])!;
  const marks = g.actors.map((x) => mark(x.sock));
  send(a.sock, { t: "point", target: b.seat });
  for (const [i, x] of g.actors.entries()) await settle(x.sock, marks[i]!);
  await closePhase(g.code); // 사이 끝 → 둘째 차례
  for (const x of g.actors) await settle(x.sock, mark(x.sock));
  return { code: g.code, actors: g.actors, a, b, others: g.actors.filter((x) => x !== b) };
}

/** 소켓을 닫고 서버가 끊김을 저장할 때까지 기다린다. */
async function dropSocket(code: string, who: Actor): Promise<void> {
  who.sock.ws.close(1000, "drop");
  await who.sock.closedPromise;
  await until("끊김 저장", async () => {
    const players = (await storedRoom(code)).players as unknown as StoredPlayer[];
    return players.find((p) => p.seat === who.seat)?.connected === false;
  });
}

// 기본판(결정 0072)에서 꺼짐 — 판 규칙의 pickTurn 를 켜면 다시 돈다
describe.skipIf(!GAME_RULES.pickTurn)("순차 지목 — 끊긴 차례 (M-3)", () => {
  it("차례 주인이 끊겨도 차례 상태·마감·알람은 그대로이고, 다시 붙으면 같은 마감과 지금까지의 지목 줄을 받고 지목이 받아들여진다", { timeout: 30_000 }, async () => {
    const { code, actors, a, b, others } = await atSecondTurn();
    const before = await storedRoom(code);
    expect(before.pickTurn!.i).toBe(1);
    const pointsBefore = lastViewOf(a.sock).day!.points;
    expect(pointsBefore!.map((l) => `${l.seat}>${l.target}`)).toEqual([`${a.seat}>${b.seat}`]);

    await dropSocket(code, b);

    // 끊김은 차례를 일찍 끝내지 않는다: 저장된 차례·마감과 알람이 닫기 전과 같고, 알람은 그 차례 마감이다.
    const after = await storedRoom(code);
    expect(after.pickTurn).toEqual(before.pickTurn);
    expect(after.phaseEndsAt).toBe(before.phaseEndsAt);
    expect(await alarmOf(code)).toBe(before.pickTurn!.endsAt);
    for (const o of others) {
      const turn = lastViewOf(o.sock).day!.turn!;
      expect(`${turn.i}/${turn.endsAt}/${turn.doneAt}`).toBe(`1/${before.pickTurn!.endsAt}/undefined`);
    }

    // 다시 붙은 첫 state(UI-SPEC A-6): 지금 차례·같은 마감·지금까지의 줄.
    const again = await connect(code);
    const first = await hello(again, b.token);
    const turn = first.view.day!.turn!;
    expect(turn.i).toBe(1);
    expect(turn.endsAt).toBe(before.pickTurn!.endsAt);
    expect(turn.doneAt).toBeUndefined();
    expect(turn.order).toEqual(before.pickTurn!.order);
    expect(JSON.stringify(first.view.day!.points)).toBe(JSON.stringify(pointsBefore));

    // 그 소켓의 지목이 받아들여지고 모든 소켓에 doneAt 이 생긴다.
    const target = actors.find((x) => x.seat !== b.seat && x.seat !== a.seat)!.seat;
    await settle(again, mark(again)); // hello 뒤따라오는 world·chatLog 를 먼저 비운다
    const marks = others.map((o) => mark(o.sock));
    const mine = mark(again);
    send(again, { t: "point", target });
    expect(summary(await settle(again, mine))).toBe("[state:nomination]");
    for (const [i, o] of others.entries()) {
      expect(summary(await settle(o.sock, marks[i]!))).toBe("[state:nomination]");
      const view = lastViewOf(o.sock);
      expect(view.day!.turn!.doneAt).toBeDefined();
      expect(view.day!.points!.map((l) => `${l.seat}>${l.target}`)).toEqual([`${a.seat}>${b.seat}`, `${b.seat}>${target}`]);
    }
  });

  it("끊긴 채 8초를 넘기면 기권이고, 다시 붙어 지목해도 WRONG_PHASE 이며 차례는 다시 오지 않는다", { timeout: 30_000 }, async () => {
    const { code, actors, b, others } = await atSecondTurn();
    const turnEndsAt = (await storedRoom(code)).pickTurn!.endsAt;
    await dropSocket(code, b);
    const skipDeadline = await closePhase(code);

    const stored = (await storedRoom(code)).pickTurn!;
    expect(stored.i).toBe(1);
    expect(stored.skip).toBe(true);
    expect(stored.doneAt).toBe(skipDeadline);

    const again = await connect(code);
    const first = await hello(again, b.token);
    expect(first.view.day!.turn!.skip).toBe(true);
    expect(first.view.day!.turn!.doneAt).toBe(skipDeadline);
    await settle(again, mark(again));
    const mine = mark(again);
    send(again, { t: "point", target: others[0]!.seat });
    expect(summary(await settle(again, mine))).toBe("[error:WRONG_PHASE,state:nomination]");
    expect((await storedRoom(code)).pickTurn).toEqual(stored);

    // 끝까지 걸어도 B 의 차례(i 1)는 같은 마감으로 한 번뿐이다.
    const watcher = others[0]!;
    for (let guard = 0; guard < 12 && (await storedRoom(code)).phase === "nomination"; guard += 1) await closePhase(code);
    await settle(watcher.sock, mark(watcher.sock));
    const seen = new Set<string>();
    for (const raw of watcher.sock.frames) {
      const msg = JSON.parse(raw) as { t: string; view?: { phase: string; day?: { turn?: { i: number; endsAt?: number } } } };
      const turn = msg.t === "state" && msg.view?.phase === "nomination" ? msg.view.day?.turn : undefined;
      if (turn !== undefined && turn.i === 1 && turn.endsAt !== undefined) seen.add(String(turn.endsAt));
    }
    expect([...seen]).toEqual([String(turnEndsAt)]);
    expect(actors.length).toBe(4);
  });
});

// 기본판(결정 0072)에서 꺼짐 — 판 규칙의 pickTurn 를 켜면 다시 돈다
describe.skipIf(!GAME_RULES.pickTurn)("순차 지목 — 알람 따라잡기", () => {
  it("저장된 마감이 30초 전이면 알람 한 번에 여러 차례가 기권으로 지나가 모든 소켓이 같은 차례·같은 마감을 본다 (새 마감 = 이전 마감 + 단계 길이)", { timeout: 30_000 }, async () => {
    const g = await startedGame("nomination", 3);
    await closePhase(g.code); // 첫 차례 시작
    const t0 = Date.now() - 20_000;
    await editRoom(g.code, (room) => ({ ...room, phaseEndsAt: t0, pickTurn: { ...(room.pickTurn as object), endsAt: t0 } }));
    expect(await runDurableObjectAlarm(env.ROOM.getByName(g.code))).toBe(true);

    const isTurnThree = (m: ServerMessage): boolean => m.t === "state" && m.view.day?.turn?.i === 3;
    for (const s of g.socks) await nextFrame(s, isTurnThree);
    for (const s of g.socks) await settle(s, mark(s));

    // 차례 k 의 마감 = t0 + k × (8초 + 사이 0.9초). 셋을 기권으로 지나 넷째 차례다.
    const expectedEnd = t0 + 3 * (TURN_MS + GAP_MS);
    const stored = await storedRoom(g.code);
    expect(stored.pickTurn!.i).toBe(3);
    expect(stored.pickTurn!.endsAt).toBe(expectedEnd);
    expect(stored.phaseEndsAt).toBe(expectedEnd);
    const columns = g.socks.map((s) => JSON.stringify(lastViewOf(s).day!.turn));
    expect(new Set(columns).size).toBe(1);
    const turn = lastViewOf(g.socks[0]!).day!.turn!;
    expect(turn.i).toBe(3);
    expect(turn.endsAt).toBe(expectedEnd);
    expect(turn.doneAt).toBeUndefined();
    expect(new Set(g.socks.map((s) => lastViewOf(s).phaseEndsAt)).size).toBe(1);
  });
});
