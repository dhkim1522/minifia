// DAY-03~06 DO 시험, 결정 0060. 08-11 이 실제 흐름으로 넓힌다.
// 아직 흐름은 v1.0 그대로라 시험은 저장 상태를 지목·찬반 단계로 옮겨(toPhase) 들어간다.
// 실패 출력은 한 줄이어야 해서(TAP) 프레임 목록은 summary() 한 줄 문자열로 비교한다.
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { PHASE_DEFS } from "../../shared/game/phases";
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm } from "cloudflare:test";
import { ringSlots } from "../../shared/game/gather";
import { alarmOf, editRoom, endAs, flushWorld, ghostsOf, killSeats, layOf, mark, mapPlayers, pause, pointAs, send, settle, startedGame, storedRoom, summary, toPhase, verdictAs, worldFramesOf, worldOf } from "./helpers";
import type { Game } from "./helpers";

const viewsOf = (msgs: ServerMessage[]): RoomView[] =>
  msgs.filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state").map((m) => m.view);

/** act 가 메시지를 보내면 모든 소켓이 받은 프레임을 소켓 순서대로 돌려준다(보내기 전 mark → ping/pong 사이에 낀 프레임). */
async function castAll(g: Game, act: () => void): Promise<ServerMessage[][]> {
  const marks = g.socks.map(mark);
  act();
  const out: ServerMessage[][] = [];
  for (let i = 0; i < g.socks.length; i += 1) out.push(await settle(g.socks[i]!, marks[i]!));
  return out;
}

/** 소켓 순서대로 프레임 요약을 공백으로 이은 한 줄. */
const lines = (frames: ServerMessage[][]): string => frames.map(summary).join(" ");

/** 저장된 방에서 좌석별 지목 값(서버 전용 nominate). */
async function storedNominates(code: string): Promise<string> {
  const room = (await storedRoom(code)) as unknown as { players: Array<{ seat: number; nominate?: number }> };
  return [...room.players]
    .sort((a, b) => a.seat - b.seat)
    .map((p) => `${p.seat}:${p.nominate ?? "-"}`)
    .join(" ");
}

const pointsOf = (v: RoomView | undefined): string => JSON.stringify(v?.day?.points);

/** 방장 + 손님 3 = 4명 판을 시작해 지목 단계로 옮긴다. actors[0] 은 방장이다. */
async function nominationRoom(): Promise<Game> {
  const g = await startedGame("discussion", 3);
  await toPhase(g.code, "nomination");
  return g;
}

describe("지목 (DAY-04, 결정 0060-3)", () => {
  it("손님 A 의 지목은 네 소켓 모두에게 정확히 한 프레임으로 가고 모든 view 의 day.points 가 같은 공개 목록이다", async () => {
    const g = await nominationRoom();
    const [a, b] = [g.actors[1]!, g.actors[2]!];
    const frames = await castAll(g, () => pointAs(a.sock, b.seat));
    expect(lines(frames)).toBe("[state:nomination] [state:nomination] [state:nomination] [state:nomination]");
    const want = JSON.stringify([{ seat: a.seat, target: b.seat }]);
    expect(frames.map((f) => pointsOf(viewsOf(f)[0])).join("|")).toBe([want, want, want, want].join("|"));
  });

  it("같은 사람의 250ms 안 두 번째 지목은 상태를 바꾸지 않고 그 사람 소켓에만 서버 값 view 를 보낸다(오류 프레임 없음)", async () => {
    const g = await nominationRoom();
    const [a, b, c] = [g.actors[1]!, g.actors[2]!, g.actors[3]!];
    await castAll(g, () => pointAs(a.sock, b.seat));
    const before = await storedNominates(g.code);
    const second = await castAll(g, () => pointAs(a.sock, c.seat));
    // a 는 actors[1] 이라 소켓 순서 두 번째다. 다른 소켓은 500ms 급 관찰(ping/pong 사이)에서 프레임이 없다.
    expect(lines(second)).toBe("[] [state:nomination] [] []");
    expect(pointsOf(viewsOf(second[1]!)[0])).toBe(JSON.stringify([{ seat: a.seat, target: b.seat }]));
    expect(await storedNominates(g.code)).toBe(before);
  });

  it("250ms 가 지난 뒤의 다른 대상은 받아들여져 모두 새 목록을 받는다", async () => {
    const g = await nominationRoom();
    const [a, b, c] = [g.actors[1]!, g.actors[2]!, g.actors[3]!];
    await castAll(g, () => pointAs(a.sock, b.seat));
    await pause(300);
    const frames = await castAll(g, () => pointAs(a.sock, c.seat));
    expect(lines(frames)).toBe("[state:nomination] [state:nomination] [state:nomination] [state:nomination]");
    const want = JSON.stringify([{ seat: a.seat, target: c.seat }]);
    expect(frames.map((f) => pointsOf(viewsOf(f)[0])).join("|")).toBe([want, want, want, want].join("|"));
  });

  it("같은 값을 다시 보내면 모든 소켓이 프레임을 받지 않는다", async () => {
    const g = await nominationRoom();
    const [a, b] = [g.actors[1]!, g.actors[2]!];
    await castAll(g, () => pointAs(a.sock, b.seat));
    await pause(300);
    expect(lines(await castAll(g, () => pointAs(a.sock, b.seat)))).toBe("[] [] [] []");
  });

  it("자기 자신을 가리키면 보낸 소켓만 BAD_MESSAGE 와 최신 state 를 받는다", async () => {
    const g = await nominationRoom();
    const a = g.actors[1]!;
    expect(lines(await castAll(g, () => pointAs(a.sock, a.seat)))).toBe("[] [error:BAD_MESSAGE,state:nomination] [] []");
  });

  it("지목 단계가 아니면(discussion) 보낸 소켓만 WRONG_PHASE 와 최신 state 를 받는다", async () => {
    const g = await startedGame("discussion", 3);
    const [a, b] = [g.actors[1]!, g.actors[2]!];
    expect(lines(await castAll(g, () => pointAs(a.sock, b.seat)))).toBe("[] [error:WRONG_PHASE,state:discussion] [] []");
  });

  it("스키마: 덧붙은 키(seat)와 범위 밖 target(8)은 보낸 소켓만 BAD_MESSAGE 를 받고 저장은 그대로다", async () => {
    const g = await nominationRoom();
    const [a, b] = [g.actors[1]!, g.actors[2]!];
    const extra = await castAll(g, () => send(a.sock, { t: "point", target: b.seat, seat: 1 }));
    const range = await castAll(g, () => send(a.sock, { t: "point", target: 8 }));
    expect(`${lines(extra)} ${lines(range)}`).toBe("[] [error:BAD_MESSAGE] [] [] [] [error:BAD_MESSAGE] [] []");
    expect(await storedNominates(g.code)).toBe(
      [...(await storedRoomSeats(g.code))].map((s) => `${s}:-`).join(" "),
    );
  });
});

/** 저장된 방의 좌석(오름차순). */
async function storedRoomSeats(code: string): Promise<number[]> {
  const room = (await storedRoom(code)) as unknown as { players: Array<{ seat: number }> };
  return room.players.map((p) => p.seat).sort((x, y) => x - y);
}

// ---- 찬반 (DAY-06, 결정 0053·0060-4, T-08-02) ----

/** 방장 + 손님 4 = 5명 판을 시작해 찬반 단계로 옮긴다. 변론자는 마지막 좌석 사람(actors[4])이다. */
async function verdictRoom(): Promise<Game> {
  const g = await startedGame("discussion", 4);
  const defender = g.actors[4]!;
  await toPhase(g.code, "verdict", (room) => ({ ...room, verdict: { passed: false, candidate: defender.seat } }));
  return g;
}

const votedOf = (v: RoomView | undefined): string => JSON.stringify(v?.day?.voted);

describe("찬반 방송 규율 (DAY-06, 결정 0053, T-08-02)", () => {
  it("처음 던지면 다섯 소켓 모두에게 한 프레임이고 모두의 day.voted 에 그 좌석이 들어가며 me.verdictVote 는 본인만이다", async () => {
    const g = await verdictRoom();
    const a = g.actors[1]!;
    const frames = await castAll(g, () => verdictAs(a.sock, true));
    expect(lines(frames)).toBe("[state:verdict] [state:verdict] [state:verdict] [state:verdict] [state:verdict]");
    expect(frames.map((f) => votedOf(viewsOf(f)[0])).join("|")).toBe(Array(5).fill(JSON.stringify([a.seat])).join("|"));
    expect(frames.map((f) => String(viewsOf(f)[0]?.me.verdictVote)).join(" ")).toBe("undefined true undefined undefined undefined");
  });

  it("이미 던진 사람이 값을 바꾸면 본인 소켓만 state(me.verdictVote false)를 받고 나머지 네 소켓은 프레임이 없다", async () => {
    const g = await verdictRoom();
    const a = g.actors[1]!;
    await castAll(g, () => verdictAs(a.sock, true));
    const flip = await castAll(g, () => verdictAs(a.sock, false));
    expect(lines(flip)).toBe("[] [state:verdict] [] [] []");
    expect(String(viewsOf(flip[1]!)[0]?.me.verdictVote)).toBe("false");
    expect(votedOf(viewsOf(flip[1]!)[0])).toBe(JSON.stringify([a.seat]));
  });

  it("같은 값을 다시 보내면 프레임이 없고, 다른 사람이 처음 던지면 모두의 day.voted 가 좌석 오름차순으로 늘어난다", async () => {
    const g = await verdictRoom();
    const [a, b] = [g.actors[1]!, g.actors[2]!];
    await castAll(g, () => verdictAs(a.sock, true));
    expect(lines(await castAll(g, () => verdictAs(a.sock, true)))).toBe("[] [] [] [] []");
    const frames = await castAll(g, () => verdictAs(b.sock, false));
    expect(lines(frames)).toBe("[state:verdict] [state:verdict] [state:verdict] [state:verdict] [state:verdict]");
    const want = JSON.stringify([a.seat, b.seat].sort((x, y) => x - y));
    expect(frames.map((f) => votedOf(viewsOf(f)[0])).join("|")).toBe(Array(5).fill(want).join("|"));
  });

  it("어떤 소켓 프레임에도 남의 찬반 값이 없다 — 던지지 않은 소켓에는 verdictVote 키가 없고 모든 프레임에 agree 키가 없다", async () => {
    const g = await verdictRoom();
    const [a, b] = [g.actors[1]!, g.actors[2]!];
    await castAll(g, () => verdictAs(a.sock, true));
    await castAll(g, () => verdictAs(b.sock, false));
    await castAll(g, () => verdictAs(a.sock, false));
    const mentions = g.socks.map((s) => s.frames.filter((f) => f.includes('"verdictVote"')).length > 0);
    expect(mentions.join(" ")).toBe("false true true false false");
    expect(g.socks.some((s) => s.frames.some((f) => f.includes('"agree"')))).toBe(false);
    // 본인 소켓의 마지막 값은 본인 값뿐이다.
    const own = g.socks.map((s) => {
      const views = s.frames.map((f) => JSON.parse(f) as ServerMessage).filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state");
      return String(views.at(-1)!.view.me.verdictVote);
    });
    expect(own.join(" ")).toBe("undefined false false undefined undefined");
  });

  it("변론자 본인의 찬반은 BAD_MESSAGE 이고 저장은 그대로다", async () => {
    const g = await verdictRoom();
    const c = g.actors[4]!;
    expect(lines(await castAll(g, () => verdictAs(c.sock, true)))).toBe("[] [] [] [] [error:BAD_MESSAGE,state:verdict]");
    const room = (await storedRoom(g.code)) as unknown as { players: Array<{ verdictVote?: boolean }> };
    expect(room.players.filter((p) => p.verdictVote !== undefined).length).toBe(0);
  });

  it("죽은 사람의 찬반은 BAD_MESSAGE 이다", async () => {
    const g = await verdictRoom();
    const d = g.actors[3]!;
    await toPhase(g.code, "verdict", (room) =>
      mapPlayers({ ...room, verdict: { passed: false, candidate: g.actors[4]!.seat } }, (p) => (p.seat === d.seat ? { ...p, alive: false } : p)),
    );
    expect(lines(await castAll(g, () => verdictAs(d.sock, true)))).toBe("[] [] [] [error:BAD_MESSAGE,state:verdict] []");
  });
});

// ---- 토론 끝내기 (DAY-03) ----

describe("토론 끝내기 (DAY-03, 결정 0060-2)", () => {
  it("누르면 네 소켓 모두의 day.endCount 가 1 이고 me.endDiscussion 은 누른 사람에게만 있다; 취소하면 0 이고 키가 사라진다", async () => {
    const g = await startedGame("discussion", 3);
    const a = g.actors[1]!;
    const on = await castAll(g, () => endAs(a.sock, true));
    expect(lines(on)).toBe("[state:discussion] [state:discussion] [state:discussion] [state:discussion]");
    expect(on.map((f) => String(viewsOf(f)[0]?.day?.endCount)).join(" ")).toBe("1 1 1 1");
    expect(on.map((f) => String(viewsOf(f)[0]?.me.endDiscussion)).join(" ")).toBe("undefined true undefined undefined");
    expect(on.map((f) => Object.hasOwn(viewsOf(f)[0]?.me ?? {}, "endDiscussion")).join(" ")).toBe("false true false false");
    const off = await castAll(g, () => endAs(a.sock, false));
    expect(off.map((f) => String(viewsOf(f)[0]?.day?.endCount)).join(" ")).toBe("0 0 0 0");
    expect(off.map((f) => Object.hasOwn(viewsOf(f)[0]?.me ?? {}, "endDiscussion")).join(" ")).toBe("false false false false");
  });

  it("같은 값을 다시 누르면 프레임이 없다", async () => {
    const g = await startedGame("discussion", 3);
    const a = g.actors[1]!;
    await castAll(g, () => endAs(a.sock, true));
    expect(lines(await castAll(g, () => endAs(a.sock, true)))).toBe("[] [] [] []");
  });

  it("과반(산 4 중 3)에 닿는 순간 마감을 지금으로 당겨 다음 단계로 넘기고 새 마감은 now + 다음 단계 길이이며 알람이 따라 옮겨진다", async () => {
    const g = await startedGame("discussion", 3);
    const [a, b, c] = [g.actors[1]!, g.actors[2]!, g.actors[3]!];
    await castAll(g, () => endAs(a.sock, true));
    const two = await castAll(g, () => endAs(b.sock, true));
    expect(two.map((f) => String(viewsOf(f)[0]?.day?.endCount)).join(" ")).toBe("2 2 2 2");
    const nextId = PHASE_DEFS.discussion.next!;
    const next = PHASE_DEFS[nextId];
    const before = Date.now();
    const third = await castAll(g, () => endAs(c.sock, true));
    const after = Date.now();
    expect(third.map((f) => viewsOf(f).at(-1)?.phase).join(" ")).toBe(Array(4).fill(nextId).join(" "));
    const stored = await storedRoom(g.code);
    expect(stored.phase).toBe(nextId);
    const dur = next.durationMs!;
    expect(stored.phaseEndsAt! >= before + dur - 50 && stored.phaseEndsAt! <= after + dur + 50).toBe(true);
    expect(await alarmOf(g.code)).toBe(stored.phaseEndsAt);
  });

  it("유령의 토론 끝내기는 BAD_MESSAGE 이다", async () => {
    const g = await startedGame("discussion", 3);
    const ghost = g.actors[3]!;
    await killSeats(g, [ghost.seat]);
    expect(lines(await castAll(g, () => endAs(ghost.sock, true)))).toBe("[] [] [] [error:BAD_MESSAGE,state:discussion]");
  });
});


// ---- 모이기·무대 배치 (DAY-04·05, 결정 0060-7, Pitfall 4·5) ----
// 흐름 전환(08-11) 전이라 지목·변론 단계는 저장 상태 편집(toPhase)과 마감 당기기로 들어간다(가정 A3).

/** 한 소켓이 mark 이후 받은 world.move 의 (seat -> 끝점 'x,z'). 같은 좌석이 여러 번이면 마지막 것. */
function movesSince(sock: Game["socks"][number], from: number): Map<number, string> {
  const out = new Map<number, string>();
  for (const m of worldFramesOf(sock, from)) if (m.k === "move") out.set(m.s, `${m.p[m.p.length - 2]},${m.p[m.p.length - 1]}`);
  return out;
}

const slotKeys = (n: number): Set<string> => new Set(ringSlots(n).map(([x, z]) => `${x},${z}`));

/** 모든 소켓을 flush 한다(처음 소켓부터). 서버가 한 일이 끝난 뒤의 프레임 위치를 돌려준다. */
async function flushAll(g: Game, marks: number[]): Promise<void> {
  for (let i = 0; i < g.socks.length; i += 1) await settle(g.socks[i]!, marks[i]!);
}

/** 마감을 ago ms 전으로 당기고 알람을 한 번 돌린다(단계 하나 이상이 넘어간다). */
async function dueAgo(code: string, ago: number): Promise<void> {
  await editRoom(code, (room) => ({ ...room, phaseEndsAt: Date.now() - ago }));
  expect(await runDurableObjectAlarm(env.ROOM.getByName(code))).toBe(true);
}

describe("모이기·무대 배치(결정 0060-7)", () => {
  it("지목에 들어간 뒤 아무 메시지나 오면 산 사람 5명이 둘레 자리 5곳으로 걷고 모든 소켓이 다섯 걸음을 받으며 배치 키는 '일차:ring' 이다", async () => {
    const g = await startedGame("discussion", 4);
    await toPhase(g.code, "nomination");
    const marks = g.socks.map(mark);
    await flushAll(g, marks);

    for (const sock of g.socks) {
      const moves = movesSince(sock, marks[g.socks.indexOf(sock)]!);
      expect([...moves.keys()].sort().join(",")).toBe(g.actors.map((a) => a.seat).sort().join(","));
      const ends = [...moves.values()];
      expect(new Set(ends).size).toBe(5);
      expect(ends.every((e) => slotKeys(5).has(e))).toBe(true);
    }
    expect((await layOf(g.code)).key).toBe("1:ring");
  }, 40_000);

  it("같은 상태에서 메시지가 한 번 더 와도 새 world 프레임이 없다(멱등)", async () => {
    const g = await startedGame("discussion", 4);
    await toPhase(g.code, "nomination");
    await flushAll(g, g.socks.map(mark));
    const marks = g.socks.map(mark);
    await flushAll(g, marks);
    expect(g.socks.map((s, i) => worldFramesOf(s, marks[i]!).length).join(",")).toBe("0,0,0,0,0");
  }, 40_000);

  it("서버 주도 이동은 lastMoveAt 을 건드리지 않고, world 저장값에 lay 가 있다", async () => {
    const g = await startedGame("discussion", 4);
    await toPhase(g.code, "nomination");
    await flushAll(g, g.socks.map(mark));
    expect((await layOf(g.code)).lastMoveAtCount).toBe(0);
    await flushWorld(g.code);
    const stored = (await worldOf(g.code)) as unknown as { lay?: { key: string; slots: Record<string, unknown> } };
    expect(stored.lay?.key).toBe("1:ring");
    expect(Object.keys(stored.lay?.slots ?? {}).length).toBe(5);
  }, 40_000);

  it("유령은 줄을 서지 않는다 — 산 사람 3명만 걷고 유령 소켓도 그 걸음을 본다", async () => {
    const g = await startedGame("discussion", 4);
    const doomed = g.actors.filter((a) => a.role !== "mafia").slice(0, 2);
    const { ghosts, living } = await ghostsOf(g, doomed.map((a) => a.seat));
    await toPhase(g.code, "nomination");
    const marks = g.socks.map(mark);
    await flushAll(g, marks);
    for (const a of g.actors) {
      const moves = movesSince(a.sock, marks[g.actors.indexOf(a)]!);
      expect([...moves.keys()].sort().join(",")).toBe(living.map((l) => l.seat).sort().join(","));
      expect([...moves.values()].every((e) => slotKeys(3).has(e))).toBe(true);
    }
    expect(ghosts.length).toBe(2);
  }, 40_000);

  it("지목이 끝나 변론이 되면 변론자만 무대 [0,0] 으로 걷고 나머지는 새 프레임이 없다", async () => {
    const g = await startedGame("discussion", 4);
    const defender = g.actors[3]!;
    await toPhase(g.code, "nomination", (room) => ({ ...room, verdict: { passed: false, candidate: defender.seat } }));
    await flushAll(g, g.socks.map(mark));
    const marks = g.socks.map(mark);
    await dueAgo(g.code, 1);
    await flushAll(g, marks);

    expect((await storedRoom(g.code)).phase).toBe("defense");
    for (const sock of g.socks) {
      const moves = movesSince(sock, marks[g.socks.indexOf(sock)]!);
      expect([...moves.entries()].map(([s, e]) => `${s}:${e}`).join("|")).toBe(`${defender.seat}:0,0`);
    }
    expect((await layOf(g.code)).key).toBe("1:stage");
  }, 40_000);

  it("알람이 늦어 지목 배치 없이 변론에 닿아도 변론자는 무대로, 나머지 넷은 둘레 자리로 선다", async () => {
    const g = await startedGame("discussion", 4);
    const defender = g.actors[3]!;
    await toPhase(g.code, "nomination", (room) => ({ ...room, verdict: { passed: false, candidate: defender.seat } }));
    const marks = g.socks.map(mark);
    await dueAgo(g.code, 5_000); // 지목 마감을 5초 지나 처음 깨어난다 — 지목 배치는 한 번도 돌지 않았다
    await flushAll(g, marks);

    expect((await storedRoom(g.code)).phase).toBe("defense");
    const moves = movesSince(g.socks[0]!, marks[0]!);
    expect(moves.get(defender.seat)).toBe("0,0");
    const others = [...moves.entries()].filter(([s]) => s !== defender.seat).map(([, e]) => e);
    expect(others.length).toBe(4);
    expect(new Set(others).size).toBe(4);
    expect(others.every((e) => slotKeys(5).has(e))).toBe(true);
  }, 40_000);

  it("처형이 부결이면 변론자가 자기 둘레 자리로 돌아오고, 통과면 변론자는 움직이지 않는다", async () => {
    for (const passed of [false, true]) {
      const g = await startedGame("discussion", 4);
      const defender = g.actors[3]!;
      await toPhase(g.code, "nomination", (room) => ({ ...room, verdict: { passed, candidate: defender.seat } }));
      await flushAll(g, g.socks.map(mark));
      const ringSlotOfDefender = (await layOf(g.code)).slots[(await storedRoomIdOf(g.code, defender.seat))]!;
      await dueAgo(g.code, 1); // -> defense (변론자 무대)
      await flushAll(g, g.socks.map(mark));
      await flushWorld(g.code); // toPhase 는 DO 를 퇴거시킨다 — 디바운스 중인 위치·배치 기억을 먼저 저장한다
      await toPhase(g.code, "execution", (room) => ({ ...room, verdict: { passed, candidate: defender.seat } }));
      const marks = g.socks.map(mark);
      await flushAll(g, marks);
      const moves = movesSince(g.socks[0]!, marks[0]!);
      if (passed) {
        expect([...moves.keys()].join(",")).toBe("");
      } else {
        expect([...moves.entries()].map(([s, e]) => `${s}:${e}`).join("|")).toBe(`${defender.seat}:${ringSlotOfDefender[0]},${ringSlotOfDefender[1]}`);
      }
    }
  }, 60_000);
});

/** 저장된 방에서 좌석의 player id(서버 전용 값 — 시험이 world.lay 를 읽는 데만 쓴다). */
async function storedRoomIdOf(code: string, seatNo: number): Promise<string> {
  const room = (await storedRoom(code)) as unknown as { players: Array<{ seat: number; id: string }> };
  return room.players.find((p) => p.seat === seatNo)!.id;
}
