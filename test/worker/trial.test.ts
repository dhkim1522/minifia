// DAY-03~06 DO 시험, 결정 0060, 0089-18(22-09: 낮 순서 토론 → 찬반 → 순차 지목 → 변론 → 처형). 위쪽 describe 는 저장 상태를 지목·찬반 단계로 옮겨(toPhase) 들어가고,
// 맨 아래 "실제 흐름" describe(08-11)가 토론 끝내기부터 마감 훅으로 한 판을 끝까지 돈다.
// 실패 출력은 한 줄이어야 해서(TAP) 프레임 목록은 summary() 한 줄 문자열로 비교한다.
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { DEFENSE_MS, DISCUSSION_MS, NOMINATION_GATHER_MS, PHASE_DEFS, PICK_GAP_MS, PICK_TURN_MS, VERDICT_MS } from "../../shared/game/phases";
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm } from "cloudflare:test";
import { advanceTo, alarmOf, chatMsg, closePhase, connect, editRoom, endAs, openDiscussionSkip, flushWorld, hello, killSeats, lastViewOf, layOf, mark, mapPlayers, pause, pointAs, segEndsBySeat, send, settle, startedGame, storedRoom, summary, toPhase, verdictAs, worldFramesOf } from "./helpers";
import type { Actor, Game } from "./helpers";
import { RULES } from "../../shared/game/ruleset";

const GAME_RULES = RULES; // runoff 시험의 skipIf 에만 쓴다

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

/** 모든 소켓을 flush 한다(서버가 단계 진입으로 보낸 프레임이 모두 도착해 관찰 구간 앞에 놓이게). */
async function settleAllSocks(g: Game): Promise<void> {
  for (const sock of g.socks) await settle(sock, mark(sock));
}

/** 방장 + 손님 3 = 4명 판을 시작해 진입 훅을 지나 지목(모이는 중)에 넣는다. actors[0] 은 방장이다. */
async function nominationRoom(): Promise<Game> {
  const g = await startedGame("discussion", 3);
  await advanceTo(g.code, g.socks, "nomination");
  await settleAllSocks(g); // 지목에 들어가면 서버가 산 사람을 둘레 자리로 걷게 한다 — 그 world 프레임을 관찰 구간 밖으로 비운다(08-09)
  return g;
}

/** 지목을 모이기에서 첫 차례(i 0)로 넘긴 방과 그 마감(= 모이기 마감). */
async function firstTurnRoom(): Promise<{ g: Game; deadline: number }> {
  const g = await nominationRoom();
  const deadline = await closePhase(g.code);
  await settleAllSocks(g);
  return { g, deadline };
}

/** 차례 순서(좌석 오름차순)의 i 번째 사람. */
const ownerAt = (g: Game, i: number): Actor => {
  const order = g.actors.map((a) => a.seat).sort((x, y) => x - y);
  return g.actors.find((a) => a.seat === order[i])!;
};

/** 저장된 방에서 players·pickTurn 만 한 줄로(거절이 저장 상태를 바꾸지 않았는지 비교). */
async function storedTurnState(code: string): Promise<string> {
  const room = await storedRoom(code);
  return JSON.stringify({ players: room.players, pickTurn: room.pickTurn });
}

// 22-09: 동시 투표(결정 0072 의 15초 동시 지목) 시험은 지웠다 — 지목은 순차 지목뿐이다. 아래 "지목 — 순차" 가 같은 규칙(차례 주인만, 한 프레임 방송, 거절은 보낸 소켓에만)을 본다.
describe("지목 — 순차 (결정 0063-1, L15)", () => {
  it("지목에 들어가면 모든 소켓의 첫 view 가 day.turn = { order: 좌석 오름차순, i: -1 } 이고 마감은 진입 + 3000, 길이 3000 이다", async () => {
    const g = await nominationRoom();
    const order = g.actors.map((a) => a.seat).sort((x, y) => x - y);
    const stored = await storedRoom(g.code);
    for (const sock of g.socks) {
      const v = lastViewOf(sock);
      expect(JSON.stringify(v.day?.turn)).toBe(JSON.stringify({ order, i: -1 }));
      expect(`${v.phase}/${v.phaseDurationMs}/${v.phaseEndsAt === stored.phaseEndsAt}`).toBe(`nomination/${NOMINATION_GATHER_MS}/true`);
    }
    expect(stored.phaseEndsAt! <= Date.now() + NOMINATION_GATHER_MS).toBe(true);
  }, 40_000);

  it("모이기가 끝나면(closePhase) 모든 소켓의 day.turn.i 가 0 이고 endsAt = 그 마감 + 8000, 값이 같다", async () => {
    const { g, deadline } = await firstTurnRoom();
    const turns = g.socks.map((s) => JSON.stringify(lastViewOf(s).day?.turn));
    expect(new Set(turns).size).toBe(1);
    const turn = lastViewOf(g.socks[0]!).day!.turn!;
    expect(`${turn.i}/${turn.endsAt}`).toBe(`0/${deadline + PICK_TURN_MS}`);
    expect(lastViewOf(g.socks[0]!).phaseEndsAt).toBe(deadline + PICK_TURN_MS);
  }, 40_000);

  it("차례 주인의 point 는 네 소켓 모두에게 정확히 한 프레임이고, 모든 view 의 day.points 가 같으며, 마감은 확정 + 900 으로 당겨지고 알람도 같은 시각이다", async () => {
    const { g } = await firstTurnRoom();
    const owner = ownerAt(g, 0);
    const target = ownerAt(g, 1);
    const frames = await castAll(g, () => pointAs(owner.sock, target.seat));
    expect(lines(frames)).toBe("[state:nomination] [state:nomination] [state:nomination] [state:nomination]");
    const want = JSON.stringify([{ seat: owner.seat, target: target.seat }]);
    expect(frames.map((f) => pointsOf(viewsOf(f)[0])).join("|")).toBe([want, want, want, want].join("|"));
    expect(frames.every((f) => viewsOf(f)[0]!.day?.turn?.doneAt !== undefined)).toBe(true);
    const stored = await storedRoom(g.code);
    expect(stored.phaseEndsAt).toBe(stored.pickTurn!.doneAt! + PICK_GAP_MS);
    expect(await alarmOf(g.code)).toBe(stored.phaseEndsAt);
  }, 40_000);

  it("차례가 아닌 산 사람의 point 는 보낸 소켓만 WRONG_PHASE 와 최신 state 를 받고 다른 소켓은 프레임이 없으며 저장은 그대로다(L15)", async () => {
    const { g } = await firstTurnRoom();
    const intruder = ownerAt(g, 2);
    const before = await storedTurnState(g.code);
    const frames = await castAll(g, () => pointAs(intruder.sock, ownerAt(g, 0).seat));
    expect(lines(frames)).toBe(g.actors.map((a) => (a === intruder ? "[error:WRONG_PHASE,state:nomination]" : "[]")).join(" "));
    expect(await storedTurnState(g.code)).toBe(before);
  }, 40_000);

  it("확정한 차례 주인의 두 번째 point 는 그 소켓만 WRONG_PHASE 와 state 를 받는다", async () => {
    const { g } = await firstTurnRoom();
    const owner = ownerAt(g, 0);
    await castAll(g, () => pointAs(owner.sock, ownerAt(g, 1).seat));
    const again = await castAll(g, () => pointAs(owner.sock, ownerAt(g, 2).seat));
    expect(lines(again)).toBe(g.actors.map((a) => (a === owner ? "[error:WRONG_PHASE,state:nomination]" : "[]")).join(" "));
  }, 40_000);

  it("자기 차례에 자기 자신을 가리키면 그 소켓만 BAD_MESSAGE 와 최신 state 를 받는다", async () => {
    const { g } = await firstTurnRoom();
    const owner = ownerAt(g, 0);
    const frames = await castAll(g, () => pointAs(owner.sock, owner.seat));
    expect(lines(frames)).toBe(g.actors.map((a) => (a === owner ? "[error:BAD_MESSAGE,state:nomination]" : "[]")).join(" "));
  }, 40_000);

  it("확정 뒤 사이가 끝나면 다음 좌석 차례가 되고, 그 차례를 8초 마감으로 넘기면 skip 으로 확정된다", async () => {
    const { g } = await firstTurnRoom();
    await castAll(g, () => pointAs(ownerAt(g, 0).sock, ownerAt(g, 1).seat));
    const gapEnd = await closePhase(g.code);
    await settleAllSocks(g);
    const second = lastViewOf(g.socks[0]!).day!.turn!;
    expect(`${second.i}/${second.endsAt}/${second.doneAt}`).toBe(`1/${gapEnd + PICK_TURN_MS}/undefined`);
    const turnEnd = await closePhase(g.code);
    await settleAllSocks(g);
    const skipped = lastViewOf(g.socks[0]!).day!.turn!;
    expect(`${lastViewOf(g.socks[0]!).phase}/${skipped.i}/${skipped.skip}/${skipped.doneAt}`).toBe(`nomination/1/true/${turnEnd}`);
  }, 40_000);

  it("지목 단계가 아니면(discussion) 보낸 소켓만 WRONG_PHASE 와 최신 state 를 받는다", async () => {
    const g = await startedGame("discussion", 3);
    const [a, b] = [g.actors[1]!, g.actors[2]!];
    expect(lines(await castAll(g, () => pointAs(a.sock, b.seat)))).toBe("[] [error:WRONG_PHASE,state:discussion] [] []");
  });

  it("옛 번들의 처형 여부·후보 선택 메시지는 보낸 소켓만 BAD_MESSAGE 를 받는다(08-21, T-08-10)", async () => {
    const g = await startedGame("discussion", 3);
    const a = g.actors[1]!;
    const old1 = await castAll(g, () => send(a.sock, { t: "execVote", agree: true }));
    const old2 = await castAll(g, () => send(a.sock, { t: "candidateVote", target: 0 }));
    expect(`${lines(old1)} ${lines(old2)}`).toBe("[] [error:BAD_MESSAGE] [] [] [] [error:BAD_MESSAGE] [] []");
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

/** 방장 + 손님 4 = 5명 판을 시작해 찬반 단계로 옮긴다. 찬반에는 후보가 없다(22-09 D-11). */
async function verdictRoom(): Promise<Game> {
  const g = await startedGame("verdict", 4);
  await settleAllSocks(g);
  return g;
}

const countOf = (v: RoomView | undefined): string => JSON.stringify(v?.day?.verdictCount);

describe("찬반 방송 규율 (DAY-06, 결정 0053, 22-09 D-11·D-26, T-22-15·16)", () => {
  it("처음 던지면 다섯 소켓 모두에게 한 프레임이고 모두의 day.verdictCount 가 같으며 day.voted 는 없고 me.verdictVote 는 본인만이다", async () => {
    const g = await verdictRoom();
    const a = g.actors[1]!;
    const frames = await castAll(g, () => verdictAs(a.sock, true));
    expect(lines(frames)).toBe("[state:verdict] [state:verdict] [state:verdict] [state:verdict] [state:verdict]");
    expect(frames.map((f) => countOf(viewsOf(f)[0])).join("|")).toBe(Array(5).fill('{"yes":1,"no":0}').join("|"));
    expect(frames.map((f) => String(Object.hasOwn(viewsOf(f)[0]?.day ?? {}, "voted"))).join(" ")).toBe("false false false false false");
    expect(frames.map((f) => String(viewsOf(f)[0]?.me.verdictVote)).join(" ")).toBe("undefined true undefined undefined undefined");
  });

  it("이미 던진 사람이 값을 바꾸면(번복) 집계 수가 바뀌므로 다섯 소켓 모두가 state 를 받고 집계가 같다; 본인만 me.verdictVote false 를 받는다", async () => {
    const g = await verdictRoom();
    const a = g.actors[1]!;
    await castAll(g, () => verdictAs(a.sock, true));
    const flip = await castAll(g, () => verdictAs(a.sock, false));
    expect(lines(flip)).toBe("[state:verdict] [state:verdict] [state:verdict] [state:verdict] [state:verdict]");
    expect(flip.map((f) => countOf(viewsOf(f)[0])).join("|")).toBe(Array(5).fill('{"yes":0,"no":1}').join("|"));
    expect(flip.map((f) => String(viewsOf(f)[0]?.me.verdictVote)).join(" ")).toBe("undefined false undefined undefined undefined");
  });

  it("같은 값을 다시 보내면 프레임이 없고, 다른 사람이 처음 던지면 모두의 집계가 늘어난다", async () => {
    const g = await verdictRoom();
    const [a, b] = [g.actors[1]!, g.actors[2]!];
    await castAll(g, () => verdictAs(a.sock, true));
    expect(lines(await castAll(g, () => verdictAs(a.sock, true)))).toBe("[] [] [] [] []");
    const frames = await castAll(g, () => verdictAs(b.sock, false));
    expect(lines(frames)).toBe("[state:verdict] [state:verdict] [state:verdict] [state:verdict] [state:verdict]");
    expect(frames.map((f) => countOf(viewsOf(f)[0])).join("|")).toBe(Array(5).fill('{"yes":1,"no":1}').join("|"));
  });

  it("어떤 소켓 프레임에도 남의 찬반 값이 없다 — 던지지 않은 소켓에는 verdictVote 키가 없고 모든 프레임에 agree·voted 키가 없다", async () => {
    const g = await verdictRoom();
    const [a, b] = [g.actors[1]!, g.actors[2]!];
    await castAll(g, () => verdictAs(a.sock, true));
    await castAll(g, () => verdictAs(b.sock, false));
    await castAll(g, () => verdictAs(a.sock, false));
    const mentions = g.socks.map((s) => s.frames.filter((f) => f.includes('"verdictVote"')).length > 0);
    expect(mentions.join(" ")).toBe("false true true false false");
    expect(g.socks.some((s) => s.frames.some((f) => f.includes('"agree"') || f.includes('"voted"')))).toBe(false);
    // 본인 소켓의 마지막 값은 본인 값뿐이다.
    const own = g.socks.map((s) => {
      const views = s.frames.map((f) => JSON.parse(f) as ServerMessage).filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state");
      return String(views.at(-1)!.view.me.verdictVote);
    });
    expect(own.join(" ")).toBe("undefined false false undefined undefined");
  });

  it("후보가 없어 산 사람 누구나 던진다(마지막 좌석 사람 포함) — 단계 어디에도 day.candidate 가 없다", async () => {
    const g = await verdictRoom();
    const c = g.actors[4]!;
    const frames = await castAll(g, () => verdictAs(c.sock, true));
    expect(lines(frames)).toBe("[state:verdict] [state:verdict] [state:verdict] [state:verdict] [state:verdict]");
    expect(frames.map((f) => String(Object.hasOwn(viewsOf(f)[0]?.day ?? {}, "candidate"))).join(" ")).toBe("false false false false false");
    const room = (await storedRoom(g.code)) as unknown as { players: Array<{ verdictVote?: boolean }> };
    expect(room.players.filter((p) => p.verdictVote !== undefined).length).toBe(1);
  });

  it("죽은 사람의 찬반은 BAD_MESSAGE 이다", async () => {
    const g = await verdictRoom();
    const d = g.actors[3]!;
    await toPhase(g.code, "verdict", (room) => mapPlayers(room, (p) => (p.seat === d.seat ? { ...p, alive: false } : p)));
    await settleAllSocks(g);
    expect(lines(await castAll(g, () => verdictAs(d.sock, true)))).toBe("[] [] [] [error:BAD_MESSAGE,state:verdict] []");
  });
});

// ---- 토론 끝내기 (DAY-03) ----

describe("토론 끝내기 (DAY-03, 결정 0060-2)", () => {
  it("누르면 네 소켓 모두의 day.endCount 가 1 이고 me.endDiscussion 은 누른 사람에게만 있다; 취소하면 0 이고 키가 사라진다", async () => {
    const g = await startedGame("discussion", 3);
    await openDiscussionSkip(g.code);
    const a = g.actors[1]!;
    const on = await castAll(g, () => endAs(a!.sock, true));
    expect(lines(on)).toBe("[state:discussion] [state:discussion] [state:discussion] [state:discussion]");
    expect(on.map((f) => String(viewsOf(f)[0]?.day?.endCount)).join(" ")).toBe("1 1 1 1");
    expect(on.map((f) => String(viewsOf(f)[0]?.me.endDiscussion)).join(" ")).toBe("undefined true undefined undefined");
    expect(on.map((f) => Object.hasOwn(viewsOf(f)[0]?.me ?? {}, "endDiscussion")).join(" ")).toBe("false true false false");
    const off = await castAll(g, () => endAs(a!.sock, false));
    expect(off.map((f) => String(viewsOf(f)[0]?.day?.endCount)).join(" ")).toBe("0 0 0 0");
    expect(off.map((f) => Object.hasOwn(viewsOf(f)[0]?.me ?? {}, "endDiscussion")).join(" ")).toBe("false false false false");
  });

  it("같은 값을 다시 누르면 프레임이 없다", async () => {
    const g = await startedGame("discussion", 3);
    await openDiscussionSkip(g.code);
    const a = g.actors[1]!;
    await castAll(g, () => endAs(a!.sock, true));
    expect(lines(await castAll(g, () => endAs(a!.sock, true)))).toBe("[] [] [] []");
  });

  it("전원(산 4 중 4)에 닿는 순간 마감을 지금으로 당겨 다음 단계로 넘기고 새 마감은 now + 다음 단계 길이이며 알람이 따라 옮겨진다", async () => {
    const g = await startedGame("discussion", 3);
    await openDiscussionSkip(g.code);
    const [a, b, c, d] = g.actors;
    await castAll(g, () => endAs(a!.sock, true));
    const two = await castAll(g, () => endAs(b!.sock, true));
    expect(two.map((f) => String(viewsOf(f)[0]?.day?.endCount)).join(" ")).toBe("2 2 2 2");
    const three = await castAll(g, () => endAs(c!.sock, true));
    expect(three.map((f) => viewsOf(f)[0]?.phaseSkip?.count)).toEqual([3, 3, 3, 3]);
    expect((await storedRoom(g.code)).phase).toBe("discussion");
    const nextId = PHASE_DEFS.discussion.next!;
    const next = PHASE_DEFS[nextId];
    const before = Date.now();
    const fourth = await castAll(g, () => endAs(d!.sock, true));
    const after = Date.now();
    expect(fourth.map((f) => viewsOf(f).at(-1)?.phase).join(" ")).toBe(Array(4).fill(nextId).join(" "));
    const stored = await storedRoom(g.code);
    expect(stored.phase).toBe(nextId);
    const dur = next.durationMs!;
    expect(stored.phaseEndsAt! >= before + dur - 50 && stored.phaseEndsAt! <= after + dur + 50).toBe(true);
    expect(await alarmOf(g.code)).toBe(stored.phaseEndsAt);
  });

  it("유령의 토론 끝내기는 BAD_MESSAGE 이다", async () => {
    const g = await startedGame("discussion", 3);
    await openDiscussionSkip(g.code);
    const ghost = g.actors[3]!;
    await killSeats(g, [ghost.seat]);
    expect(lines(await castAll(g, () => endAs(ghost.sock, true)))).toBe("[] [] [] [error:BAD_MESSAGE,state:discussion]");
  });
});


/** 마감을 ago ms 전으로 당기고 알람을 한 번 돌린다(단계 하나 이상이 넘어간다). */
async function dueAgo(code: string, ago: number): Promise<void> {
  await editRoom(code, (room) => ({ ...room, phaseEndsAt: Date.now() - ago }));
  expect(await runDurableObjectAlarm(env.ROOM.getByName(code))).toBe(true);
}

/**
 * 저장 상태 patch: 산 사람 모두가 target 좌석을 지목해 두고 차례 상태를 끝 알림 자리로 세운다(pickTurn.i = 산 사람 수) —
 * 깨어날 때 정규화가 차례 없는 지목을 다시 시작해 표를 지우지 않고, 지목 마감 한 번에 집계(resolveNomination)가 target 을 변론자로 정한다(08-11, 09.1-04).
 */
function pointedAt(target: number): (room: Record<string, unknown>) => Record<string, unknown> {
  return (room) => {
    const marked = mapPlayers(room, (p) => ({ ...p, nominate: p.seat === target ? ((target + 1) % 5) : target }));
    const order = (marked.players as Array<{ seat: number; alive?: boolean }>)
      .filter((p) => p.alive !== false)
      .map((p) => p.seat)
      .sort((a, b) => a - b);
    return { ...marked, pickTurn: { order, i: order.length } };
  };
}

describe("재즈 바 지목과 유언의 고정 좌석", () => {
  it("지목을 시작해도 착석 구간과 저장 좌석이 그대로다", async () => {
    const g = await startedGame("discussion", 4);
    await flushWorld(g.code);
    const before = await segEndsBySeat(g.code, 1);
    const marks = g.socks.map(mark);
    await advanceTo(g.code, g.socks, "nomination");
    await settleAllSocks(g);
    expect(g.socks.every((sock, i) => worldFramesOf(sock, marks[i]!).length === 0)).toBe(true);
    const layout = await layOf(g.code);
    expect(layout.key).toBe("1:bar-table");
    expect(layout.lastMoveAtCount).toBe(0);
    expect(await segEndsBySeat(g.code, 1)).toBe(before);
  }, 40_000);

  it.each([1, 5_000])("지목 마감 %i ms 뒤 유언·처형에서도 변론자가 자기 의자에 남는다", async (delay) => {
    const g = await startedGame("discussion", 4);
    const defender = g.actors[3]!;
    await flushWorld(g.code);
    const before = await segEndsBySeat(g.code, 1);
    await toPhase(g.code, "nomination", pointedAt(defender.seat));
    const marks = g.socks.map(mark);
    await dueAgo(g.code, delay);
    await settleAllSocks(g);
    expect((await storedRoom(g.code)).phase).toBe("defense");
    expect(g.socks.every((sock, i) => worldFramesOf(sock, marks[i]!).length === 0)).toBe(true);
    expect(await segEndsBySeat(g.code, 1)).toBe(before);
    expect((await layOf(g.code)).key).toBe("1:bar-table");
    await dueAgo(g.code, 1);
    await settleAllSocks(g);
    expect((await storedRoom(g.code)).phase).toBe("execution");
    expect(await segEndsBySeat(g.code, 1)).toBe(before);
  }, 60_000);
});

// ---- 실제 흐름 한 판 (DAY-03·05·06·07, 결정 0060-1, 08-11 트레이서) ----
// toPhase 없이 소켓 메시지와 마감 당기기만으로 토론 → 지목 → 변론 → 찬반 → 처형 → 밤을 돈다.

/** 저장된 방의 단계·마감·일차·플레이어 서버 전용 키. */
async function storedFlow(code: string): Promise<{ phase: string; phaseEndsAt: number | null; day?: number; winner?: string; players: Array<Record<string, unknown>>; verdict?: unknown; execution?: unknown }> {
  return (await storedRoom(code)) as unknown as Awaited<ReturnType<typeof storedFlow>>;
}

/** view 안에서 값이 역할 단어인 문자열의 경로(배열 칸은 [] 로 접는다). */
function roleValuePaths(value: unknown, path = ""): string[] {
  if (typeof value === "string") return ["mafia", "police", "doctor", "citizen", "none"].includes(value) ? [path] : [];
  if (Array.isArray(value)) return value.flatMap((item) => roleValuePaths(item, `${path}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => roleValuePaths(v, `${path}.${k}`));
  }
  return [];
}

/** 모든 소켓의 마지막 view. */
const lastViews = (g: Game): RoomView[] => g.socks.map((s) => lastViewOf(s));

/** 5명 판을 토론에서 시작해, 전원 동의로 찬반으로 넘긴다. */
async function toVerdictByEnd(): Promise<{ g: Game; before: number; after: number }> {
  const g = await startedGame("discussion", 4);
  await openDiscussionSkip(g.code);
  const before = Date.now();
  for (const a of g.actors) {
    endAs(a.sock, true);
    await settle(a.sock, mark(a.sock));
  }
  await settleAllSocks(g);
  return { g, before, after: Date.now() };
}

/** toVerdictByEnd 뒤 산 사람 전원이 찬성을 던지고 마감해 순차 지목(모이는 중)으로 넘긴다(22-09 새 낮 순서: 찬반이 먼저). */
async function toNominationByEnd(): Promise<{ g: Game; before: number; after: number }> {
  const r = await toVerdictByEnd();
  await verdictAll(r.g, Object.fromEntries(r.g.actors.map((a) => [a.seat, true])));
  await dueAgo(r.g.code, 1);
  await settleAllSocks(r.g);
  return r;
}

/**
 * 순차 지목을 끝 알림 자리까지 걷는다(결정 0063-1): 저장된 방을 읽어 지금 차례 주인(미확정)이 bySeat 에 있으면 그 사람이 지목하고(bySeat[행위자 좌석] = 대상 좌석),
 * 아니면 마감을 당겨 한 걸음 넘긴다(기권·사이·모이기). 끝 알림에 닿으면 멈춘다 — 이어지는 dueAgo 한 번이 지목 집계를 일으킨다.
 */
async function pointAll(g: Game, bySeat: Record<number, number>): Promise<void> {
  for (let guard = 0; guard < 40; guard += 1) {
    const room = await storedRoom(g.code);
    const turn = room.pickTurn;
    if (room.phase !== "nomination" || turn === undefined || turn.i >= turn.order.length) break;
    const seat = turn.i >= 0 && turn.doneAt === undefined ? turn.order[turn.i] : undefined;
    const actor = seat === undefined ? undefined : g.actors.find((a) => a.seat === seat);
    if (actor !== undefined && Object.hasOwn(bySeat, actor.seat)) {
      pointAs(actor.sock, bySeat[actor.seat]!);
      await settleAllSocks(g);
      continue;
    }
    await closePhase(g.code);
  }
  await settleAllSocks(g);
}

/** 변론자를 뺀 유권자가 agreeBySeat 대로 찬반을 던진다. */
async function verdictAll(g: Game, agreeBySeat: Record<number, boolean>): Promise<void> {
  for (const a of g.actors) {
    if (Object.hasOwn(agreeBySeat, a.seat)) verdictAs(a.sock, agreeBySeat[a.seat]!);
  }
  await settleAllSocks(g);
}

describe("실제 흐름 (결정 0060-1)", () => {
  it("토론 끝내기 과반 → 찬반(마감 = 그 시각 + 10000) 4:1 통과 → 지목(모이기 3000) → 4:1 지목 → 변론(처형자 무대) → 처형(처형자 탈락·유령) → 밤", async () => {
    const { g, before, after } = await toVerdictByEnd();
    const inVerdict = await storedFlow(g.code);
    expect(inVerdict.phase).toBe("verdict");
    expect(inVerdict.phaseEndsAt! >= before + VERDICT_MS - 50).toBe(true);
    expect(inVerdict.phaseEndsAt! <= after + VERDICT_MS + 50).toBe(true);
    expect(lastViews(g).map((v) => String(Object.hasOwn(v.day ?? {}, "candidate"))).join(",")).toBe("false,false,false,false,false");

    const defender = g.actors.find((a) => a.role !== "mafia")!;
    const others = g.actors.filter((a) => a.seat !== defender.seat);
    // 찬반: 4 찬성 · 1 반대 → 던진 표의 과반 찬성이라 통과 → 지목
    await verdictAll(g, Object.fromEntries(g.actors.map((a, i) => [a.seat, i !== 4])));
    await dueAgo(g.code, 1);
    await settleAllSocks(g);
    const inNomination = await storedFlow(g.code);
    expect(inNomination.phase).toBe("nomination");
    expect(inNomination.phaseEndsAt! <= Date.now() + NOMINATION_GATHER_MS + 50).toBe(true);
    expect(lastViews(g).map((v) => JSON.stringify(v.day?.turn?.i)).join(",")).toBe("-1,-1,-1,-1,-1");

    const bySeat: Record<number, number> = { [defender.seat]: others[0]!.seat };
    for (const o of others) bySeat[o.seat] = defender.seat;
    await pointAll(g, bySeat);

    await dueAgo(g.code, 1);
    await settleAllSocks(g);
    const inDefense = await storedFlow(g.code);
    expect(inDefense.phase).toBe("defense");
    expect(inDefense.phaseEndsAt! > Date.now() + DEFENSE_MS - 5_000).toBe(true);
    expect(lastViews(g).map((v) => v.day?.candidate).join(",")).toBe(g.socks.map(() => defender.seat).join(","));
    expect((await layOf(g.code)).key).toBe("1:bar-table");

    // 처형자가 유언을 남긴다(22-12): 처형 단계 view 의 day.execution.will 로 모두에게 같은 값이 간다
    await castAll(g, () => send(defender.sock, { t: "will", text: "잘 있어" }));

    const marks = g.socks.map(mark);
    await dueAgo(g.code, 1); // 변론 → 처형(찬반이 먼저 통과했으므로 처형자가 탈락한다)
    for (let i = 0; i < g.socks.length; i += 1) await settle(g.socks[i]!, marks[i]!);
    const inExecution = await storedFlow(g.code);
    expect(inExecution.phase).toBe("execution");
    expect(inExecution.players.find((p) => p.seat === defender.seat)!.alive).toBe(false);
    // 처형 발표: 모든 소켓이 같은 day.execution {seat, will}(문구 번호 없음, 결정 0060-5)를 받고, 관전은 처형된 소켓만 받는다
    for (const [i, v] of lastViews(g).entries()) {
      expect(Object.keys(v.day?.execution ?? {}).sort().join(",")).toBe("seat,will");
      expect(v.day?.execution).toEqual({ seat: defender.seat, will: "잘 있어" });
      expect(Object.hasOwn(v, "spectate")).toBe(g.actors[i] === defender);
      expect(v.players.find((p) => p.seat === defender.seat)?.alive).toBe(false);
      // 살아 있는 소켓에는 역할 단어 값이 본인 역할·구성표 경로 밖에 없다(처형 발표에 직업이 실리지 않는다, D-09)
      if (g.actors[i] !== defender) {
        const stray = roleValuePaths(v).filter((path) => ![".me.role", ".day.roles[]", ".me.chat", ".players[].look"].includes(path));
        expect(`${i}:${stray.join(",")}`).toBe(`${i}:`);
      }
    }

    await dueAgo(g.code, 1);
    await settleAllSocks(g);
    const night = await storedFlow(g.code);
    expect(night.phase).toBe("night");
    expect(lastViews(g).map((v) => Object.hasOwn(v.day ?? {}, "noExecution")).join(",")).toBe("false,false,false,false,false");
  }, 90_000);

  it("처형자의 유언이 비어 있으면 day.execution 에 will 키가 없다(빈 글은 화면이 '말없이 떠났어요')", async () => {
    const { g } = await toNominationByEnd();
    const [defender, ...rest] = g.actors;
    const bySeat: Record<number, number> = {};
    for (const o of rest) bySeat[o.seat] = defender!.seat;
    bySeat[defender!.seat] = rest[0]!.seat;
    await pointAll(g, bySeat);
    await dueAgo(g.code, 1);
    await settleAllSocks(g);
    expect((await storedFlow(g.code)).phase).toBe("defense");
    const marks = g.socks.map(mark);
    await dueAgo(g.code, 1);
    for (let i = 0; i < g.socks.length; i += 1) await settle(g.socks[i]!, marks[i]!);
    expect((await storedFlow(g.code)).phase).toBe("execution");
    for (const v of lastViews(g)) expect(v.day?.execution).toEqual({ seat: defender!.seat });
  }, 90_000);

  it("지목 0표면 지목 마감 뒤 곧장 밤이고 night view 의 day.noExecution.reason 은 noVotes", async () => {
    const { g } = await toNominationByEnd();
    await pointAll(g, {}); // 모두 기권으로 차례를 끝까지 넘긴다
    await dueAgo(g.code, 1);
    await settleAllSocks(g);
    expect((await storedFlow(g.code)).phase).toBe("night");
    expect(lastViews(g).map((v) => v.day?.noExecution?.reason).join(",")).toBe("noVotes,noVotes,noVotes,noVotes,noVotes");
  }, 60_000);

  // 기본판(결정 0072)에서 꺼짐 — 판 규칙의 runoff 를 켜면 다시 돈다
  it.skipIf(!GAME_RULES.runoff)("지목이 2:2 로 갈려 결선도 동점(아무도 안 던짐)이면 결선 세 걸음 뒤 밤이고 reason 은 tie 이며 아무도 탈락하지 않는다 (결정 0066-4)", async () => {
    const { g } = await toNominationByEnd();
    const [s0, s1, s2, s3] = g.actors.map((a) => a.seat);
    await pointAll(g, { [s0!]: s2!, [s1!]: s2!, [s2!]: s0!, [s3!]: s0! });
    await dueAgo(g.code, 1); // 지목 집계 → 결선 앞머리
    await settleAllSocks(g);
    expect((await storedFlow(g.code)).phase).toBe("runoff");
    await dueAgo(g.code, 1); // 앞머리 → 투표
    await dueAgo(g.code, 1); // 투표 → 결과
    await settleAllSocks(g);
    expect((await storedFlow(g.code)).phase).toBe("runoff");
    await dueAgo(g.code, 1); // 결과 → 집계(0:0 동점) → 밤
    await settleAllSocks(g);
    const night = await storedFlow(g.code);
    expect(night.phase).toBe("night");
    expect(night.players.every((p) => p.alive !== false)).toBe(true);
    expect(lastViews(g).map((v) => v.day?.noExecution?.reason).join(",")).toBe("tie,tie,tie,tie,tie");
  }, 60_000);

  it("지목이 세 명 이상 동점이면 결선 없이 곧장 밤이고 reason 은 tie 이며 아무도 탈락하지 않는다", async () => {
    const { g } = await toNominationByEnd();
    const [s0, s1, s2] = g.actors.map((a) => a.seat);
    await pointAll(g, { [s0!]: s1!, [s1!]: s2!, [s2!]: s0! });
    await dueAgo(g.code, 1);
    await settleAllSocks(g);
    const night = await storedFlow(g.code);
    expect(night.phase).toBe("night");
    expect(night.players.every((p) => p.alive !== false)).toBe(true);
    expect(lastViews(g).map((v) => v.day?.noExecution?.reason).join(",")).toBe("tie,tie,tie,tie,tie");
    await dueAgo(g.code, 1); // 밤 → 아침: 이유 키는 아침으로 넘어가면 저절로 사라진다
    await settleAllSocks(g);
    expect((await storedFlow(g.code)).phase).toBe("morning");
    expect(lastViews(g).map((v) => Object.hasOwn(v.day ?? {}, "noExecution")).join(",")).toBe("false,false,false,false,false");
  }, 60_000);

  it("찬반이 부결(찬성 2 / 반대 2)이면 지목 없이 곧장 밤이고 아무도 탈락하지 않으며 night view 의 day.noExecution.reason 은 rejected 다", async () => {
    const { g } = await toVerdictByEnd();
    await verdictAll(g, { [g.actors[0]!.seat]: true, [g.actors[1]!.seat]: true, [g.actors[2]!.seat]: false, [g.actors[3]!.seat]: false });
    await dueAgo(g.code, 1);
    await settleAllSocks(g);
    const night = await storedFlow(g.code);
    expect(night.phase).toBe("night");
    expect(night.players.every((p) => p.alive !== false)).toBe(true);
    expect(lastViews(g).map((v) => v.day?.noExecution?.reason).join(",")).toBe("rejected,rejected,rejected,rejected,rejected");
    await dueAgo(g.code, 1); // 밤 → 아침: 이유 키는 아침으로 넘어가면 저절로 사라진다
    await settleAllSocks(g);
    expect((await storedFlow(g.code)).phase).toBe("morning");
    expect(lastViews(g).map((v) => Object.hasOwn(v.day ?? {}, "noExecution")).join(",")).toBe("false,false,false,false,false");
  }, 60_000);

  it("찬반 0표(아무도 안 던짐)도 부결이라 곧장 밤이다(던진 표 0, D-11)", async () => {
    const { g } = await toVerdictByEnd();
    await dueAgo(g.code, 1);
    await settleAllSocks(g);
    expect((await storedFlow(g.code)).phase).toBe("night");
    expect(lastViews(g).map((v) => v.day?.noExecution?.reason).join(",")).toBe("rejected,rejected,rejected,rejected,rejected");
  }, 60_000);

  it("둘째 날 토론이 시작되면 전날의 건너뛰기 동의·지목·찬반·처형 기록이 남지 않는다", async () => {
    const { g } = await toNominationByEnd();
    expect((await storedRoom(g.code)).phaseSkipVotes).toBeUndefined();
    const defender = g.actors.find((a) => a.role !== "mafia")!;
    const others = g.actors.filter((a) => a.seat !== defender.seat);
    const bySeat: Record<number, number> = { [defender.seat]: others[0]!.seat };
    for (const o of others) bySeat[o.seat] = defender.seat;
    await pointAll(g, bySeat);
    await dueAgo(g.code, 1); // 지목 → 변론
    await dueAgo(g.code, 1); // 변론 → 처형
    await settleAllSocks(g);
    expect((await storedFlow(g.code)).execution).not.toBeUndefined();
    // 밤 → 아침 → 낮 시작 발표 → 둘째 날 토론
    for (let i = 0; i < 6 && (await storedFlow(g.code)).phase !== "discussion"; i += 1) {
      await dueAgo(g.code, 1);
      await settleAllSocks(g);
    }
    const day2 = await storedFlow(g.code);
    expect(day2.phase).toBe("discussion");
    expect(day2.day).toBe(2);
    expect(day2.verdict).toBeUndefined();
    expect(day2.execution).toBeUndefined();
    expect((await storedRoom(g.code)).phaseSkipVotes).toBeUndefined();
    for (const key of ["endVote", "nominate", "verdictVote"]) {
      expect(day2.players.filter((p) => p[key] !== undefined).length).toBe(0);
    }
    expect(lastViews(g).map((v) => String(v.day?.endCount)).join(",")).toBe("0,0,0,0,0");
  }, 90_000);

  it("마감 뒤 도착한 지목은 그 소켓에만 WRONG_PHASE 와 넘어간 단계의 state 가 가고 저장된 지목 기록은 직전 값 그대로다", async () => {
    const { g } = await toNominationByEnd();
    const defender = g.actors.find((a) => a.role !== "mafia")!;
    const [a, b] = g.actors.filter((x) => x.seat !== defender.seat) as [Actor, Actor];
    await pointAll(g, { [a.seat]: defender.seat, [b.seat]: defender.seat });
    await editRoom(g.code, (room) => ({ ...room, phaseEndsAt: Date.now() - 1 })); // 알람은 아직 안 돌렸다 — 도착한 메시지가 먼저 tick 을 일으킨다
    const late = g.actors.find((x) => x !== a && x !== b && x.seat !== defender.seat)!;
    const marks = g.socks.map(mark);
    pointAs(late.sock, a.seat);
    const all: ServerMessage[][] = [];
    for (let i = 0; i < g.socks.length; i += 1) all.push(await settle(g.socks[i]!, marks[i]!));
    // 도착한 메시지가 먼저 tick 을 일으켜 모두가 변론 state 를 받고, 늦은 지목은 보낸 소켓만 WRONG_PHASE + 최신 state 를 받는다.
    const errors = all.map((frames) => frames.filter((m) => m.t === "error").map((m) => (m.t === "error" ? m.code : "")).join(","));
    expect(errors.join("|")).toBe(g.actors.map((x) => (x === late ? "WRONG_PHASE" : "")).join("|"));
    expect(all.map((frames) => viewsOf(frames).at(-1)?.phase).join(",")).toBe(g.actors.map(() => "defense").join(","));
    const line = ((await storedRoom(g.code)) as unknown as { voteLog?: Array<{ cand?: { candidate?: number } }> }).voteLog?.at(-1)?.cand;
    expect(JSON.stringify(line)).toBe(JSON.stringify({ candidate: defender.seat })); // 누가 누구를 골랐는지(votes)는 저장하지 않는다(22-12 D-25)
  }, 60_000);

  it("죽은 사람의 지목은 BAD_MESSAGE 이고 저장은 그대로다", async () => {
    const g = await startedGame("discussion", 3);
    const ghost = g.actors[3]!;
    await killSeats(g, [ghost.seat]);
    await toPhase(g.code, "nomination");
    await settleAllSocks(g);
    expect(lines(await castAll(g, () => pointAs(ghost.sock, g.actors[1]!.seat)))).toBe("[] [] [] [error:BAD_MESSAGE,state:nomination]");
    expect(await storedNominates(g.code)).toBe(g.actors.map((a) => a.seat).sort((x, y) => x - y).map((s) => `${s}:-`).join(" "));
  }, 40_000);

  it("유언 단계(defense, 22-11 D-16): 처형자의 chat 도 다른 산 사람의 chat 도 보낸 소켓만 chatReject 를 받고 다른 소켓은 0프레임이며, 빠른 메시지(say)는 BAD_MESSAGE 다", async () => {
    const { g } = await toNominationByEnd();
    const defender = g.actors.find((a) => a.role !== "mafia")!;
    const others = g.actors.filter((a) => a.seat !== defender.seat);
    await pointAll(g, Object.fromEntries(others.map((o) => [o.seat, defender.seat])));
    await dueAgo(g.code, 1);
    await settleAllSocks(g);
    expect((await storedFlow(g.code)).phase).toBe("defense");
    const said = await castAll(g, () => send(defender.sock, chatMsg(defender.sock, "저 아니에요")));
    expect(said.map(summary).join(" ")).toBe(g.actors.map((a) => (a === defender ? "[chatReject,state:defense]" : "[]")).join(" "));
    const quick = await castAll(g, () => send(defender.sock, { t: "say", template: "defNotMe" }));
    expect(quick.map(summary).join(" ")).toBe(g.actors.map((a) => (a === defender ? "[error:BAD_MESSAGE]" : "[]")).join(" "));
    const by = await castAll(g, () => send(others[0]!.sock, chatMsg(others[0]!.sock, "믿어 주세요")));
    expect(by.map(summary).join(" ")).toBe(g.actors.map((a) => (a === others[0] ? "[chatReject,state:defense]" : "[]")).join(" "));
  }, 60_000);

  it("처형으로 승패가 나면(마피아 한 명이 변론자로 통과) 처형 마감에서 ended 가 된다", async () => {
    const { g } = await toNominationByEnd();
    const defender = g.actors.find((a) => a.role === "mafia")!;
    const others = g.actors.filter((a) => a.seat !== defender.seat);
    const bySeat: Record<number, number> = { [defender.seat]: others[0]!.seat };
    for (const o of others) bySeat[o.seat] = defender.seat;
    await pointAll(g, bySeat);
    await dueAgo(g.code, 1); // 지목 → 변론
    await dueAgo(g.code, 1); // 변론 → 처형
    await settleAllSocks(g);
    expect((await storedFlow(g.code)).phase).toBe("execution");
    await dueAgo(g.code, 1);
    await settleAllSocks(g);
    const ended = await storedFlow(g.code);
    expect(ended.phase).toBe("ended");
    expect(ended.winner).toBe("citizenWin");
  }, 60_000);
});

// 08-22: 배포 순간 옛 처형 여부 투표·후보 선택·후보 공개 단계에 있던 방(결정 0060-12, T-08-52). 깨어날 때 정규화가 토론으로 옮기고 알람을 새 마감으로 건다.
describe("옛 투표 단계로 저장된 방 (08-22, DAY-07)", () => {
  it.each(["execVote", "candidateVote", "candidateVoteReveal"])("%s 로 저장된 방에 다시 접속하면 view 단계는 discussion 이고 알람은 새 마감으로 걸린다", async (oldPhase) => {
    const g = await startedGame("discussion", 3);
    const host = g.actors[0]!;
    await editRoom(g.code, (room) =>
      mapPlayers(
        {
          ...room,
          phase: oldPhase,
          phaseEndsAt: Date.now() + 5_000,
          day: 2,
          verdict: { passed: true, candidate: 1 },
          execution: { seat: 1, phrase: 2 },
          lastExecPhrase: 2,
        },
        (p) => ({ ...p, execVote: true, candidateVote: 1, nominate: 1, verdictVote: true, endVote: true }),
      ),
    );
    const before = Date.now();
    const sock = await connect(g.code);
    const view = (await hello(sock, host.token)).view;
    const after = Date.now();
    expect(`${view.phase}:${view.day?.n}`).toBe("discussion:2");
    expect(view.phaseEndsAt! >= before + DISCUSSION_MS - 50 && view.phaseEndsAt! <= after + DISCUSSION_MS + 50).toBe(true);
    const alarm = await alarmOf(g.code);
    expect(alarm !== null && Math.abs(alarm - view.phaseEndsAt!) < 2_000).toBe(true);
    const stored = (await storedRoom(g.code)) as unknown as Record<string, unknown> & { players: Array<Record<string, unknown>> };
    expect(stored.phase).toBe("discussion");
    for (const key of ["verdict", "execution", "lastExecPhrase"]) expect(Object.hasOwn(stored, key)).toBe(false);
    for (const p of stored.players) for (const key of ["execVote", "candidateVote", "nominate", "verdictVote", "endVote"]) expect(Object.hasOwn(p, key)).toBe(false);
  });
});
