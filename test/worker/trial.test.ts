// DAY-03~06 DO 시험, 결정 0060. 위쪽 describe 는 저장 상태를 지목·찬반 단계로 옮겨(toPhase) 들어가고,
// 맨 아래 "실제 흐름" describe(08-11)가 토론 끝내기부터 마감 훅으로 한 판을 끝까지 돈다.
// 실패 출력은 한 줄이어야 해서(TAP) 프레임 목록은 summary() 한 줄 문자열로 비교한다.
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { DISCUSSION_MS, NOMINATION_GATHER_MS, NOMINATION_MS, PHASE_DEFS, PICK_GAP_MS, PICK_TURN_MS } from "../../shared/game/phases";
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm } from "cloudflare:test";
import { ringSlots } from "../../shared/game/gather";
import { advanceTo, alarmOf, chatMsg, closePhase, connect, editRoom, endAs, flushWorld, ghostsOf, hello, killSeats, lastViewOf, layOf, mark, mapPlayers, pause, pointAs, send, settle, startedGame, storedRoom, summary, toPhase, verdictAs, worldFramesOf, worldOf } from "./helpers";
import type { Actor, Game } from "./helpers";
import { rulesetOf } from "../../shared/game/ruleset";
const GAME_RULES = rulesetOf("extended");

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

// 기본판(결정 0072)의 투표는 동시다 — v2.0 08페이즈 동시 지목 시험(51688d65)을 되살렸다.
describe("투표 — 동시 (결정 0072, DAY-04)", () => {
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

// 기본판(결정 0072)에서 꺼짐 — 판 규칙의 pickTurn 을 켜면 다시 돈다
describe.skipIf(!GAME_RULES.pickTurn)("지목 — 순차 (결정 0063-1, L15)", () => {
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

/** 방장 + 손님 4 = 5명 판을 시작해 찬반 단계로 옮긴다. 변론자는 마지막 좌석 사람(actors[4])이다. */
async function verdictRoom(): Promise<Game> {
  const g = await startedGame("discussion", 4);
  const defender = g.actors[4]!;
  await toPhase(g.code, "verdict", (room) => ({ ...room, verdict: { passed: false, candidate: defender.seat } }));
  await settleAllSocks(g); // 찬반에 들어가면 변론자가 무대로 걷는다(08-09) — 그 world 프레임을 관찰 구간 밖으로 비운다
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
    await settleAllSocks(g);
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
// 지목 단계는 저장 상태 편집(toPhase)으로 들어가되, 변론은 지목 표를 저장해 두고 실제 마감 훅(resolveNomination)으로 들어간다(08-11).

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
    await toPhase(g.code, "nomination", pointedAt(defender.seat));
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
    await toPhase(g.code, "nomination", pointedAt(defender.seat));
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
      await toPhase(g.code, "nomination", pointedAt(defender.seat));
      await flushAll(g, g.socks.map(mark));
      const ringSlotOfDefender = (await layOf(g.code)).slots[(await storedRoomIdOf(g.code, defender.seat))]!;
      await dueAgo(g.code, 1); // -> defense (변론자 무대)
      await flushAll(g, g.socks.map(mark));
      await flushWorld(g.code); // toPhase 는 DO 를 퇴거시킨다 — 디바운스 중인 위치·배치 기억을 먼저 저장한다
      // 실제 마감 훅은 그날 voteLog 줄(exec.passed)과 verdict 를 함께 채운다 — 배치는 줄을 먼저 보므로 둘을 같이 맞춘다.
      await toPhase(g.code, "execution", (room) => ({
        ...room,
        verdict: { passed, candidate: defender.seat },
        voteLog: ((room.voteLog as Array<{ exec: object }> | undefined) ?? []).map((line) => ({ ...line, exec: { yes: passed ? 3 : 1, no: passed ? 1 : 3, passed } })),
      }));
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

/** 방장 포함 5명 판을 토론에서 시작해, 과반(3명)이 토론 끝내기를 눌러 지목으로 넘긴다. */
async function toNominationByEnd(): Promise<{ g: Game; before: number; after: number }> {
  const g = await startedGame("discussion", 4);
  const before = Date.now();
  for (const a of g.actors.slice(0, 3)) {
    endAs(a.sock, true);
    await settle(a.sock, mark(a.sock));
  }
  await settleAllSocks(g);
  return { g, before, after: Date.now() };
}

/**
 * 순차 지목을 끝 알림 자리까지 걷는다(결정 0063-1): 저장된 방을 읽어 지금 차례 주인(미확정)이 bySeat 에 있으면 그 사람이 지목하고(bySeat[행위자 좌석] = 대상 좌석),
 * 아니면 마감을 당겨 한 걸음 넘긴다(기권·사이·모이기). 끝 알림에 닿으면 멈춘다 — 이어지는 dueAgo 한 번이 지목 집계를 일으킨다.
 */
async function pointAll(g: Game, bySeat: Record<number, number>): Promise<void> {
  // 기본판(결정 0072): 차례 정보가 없으면 동시 투표 — 정해진 사람이 한꺼번에 던지고 마감은 이어지는 dueAgo 한 번이 집계한다.
  if ((await storedRoom(g.code)).pickTurn === undefined) {
    for (const a of g.actors) {
      if (Object.hasOwn(bySeat, a.seat)) pointAs(a.sock, bySeat[a.seat]!);
    }
    await settleAllSocks(g);
    return;
  }
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

/** 투표 진입 길이: 기본판(결정 0072)은 동시 투표 15초, 순차 지목이 켜지면 모이기 3초. */
const NOM_ENTER_MS = GAME_RULES.pickTurn ? NOMINATION_GATHER_MS : NOMINATION_MS;

describe("실제 흐름 (결정 0060-1)", () => {
  it("토론 끝내기 과반 → 지목(마감 = 그 시각 + 3000, 모이기) → 4:1 지목 → 변론(변론자 무대) → 찬반 3:1 → 처형(변론자 탈락·유령) → 밤", async () => {
    const { g, before, after } = await toNominationByEnd();
    const stored = await storedFlow(g.code);
    expect(stored.phase).toBe("nomination");
    expect(stored.phaseEndsAt! >= before + NOM_ENTER_MS - 50).toBe(true);
    expect(stored.phaseEndsAt! <= after + NOM_ENTER_MS + 50).toBe(true);

    const defender = g.actors.find((a) => a.role !== "mafia")!;
    const others = g.actors.filter((a) => a.seat !== defender.seat);
    const bySeat: Record<number, number> = { [defender.seat]: others[0]!.seat };
    for (const o of others) bySeat[o.seat] = defender.seat;
    await pointAll(g, bySeat);

    await dueAgo(g.code, 1);
    await settleAllSocks(g);
    const inDefense = await storedFlow(g.code);
    expect(inDefense.phase).toBe("defense");
    expect(inDefense.phaseEndsAt! > Date.now() + 15_000).toBe(true);
    expect(lastViews(g).map((v) => v.day?.candidate).join(",")).toBe(g.socks.map(() => defender.seat).join(","));
    expect((await layOf(g.code)).key).toBe("1:stage");

    await dueAgo(g.code, 1);
    await settleAllSocks(g);
    expect((await storedFlow(g.code)).phase).toBe("verdict");

    const voters = others;
    await verdictAll(g, { [voters[0]!.seat]: true, [voters[1]!.seat]: true, [voters[2]!.seat]: true, [voters[3]!.seat]: false });
    const marks = g.socks.map(mark);
    await dueAgo(g.code, 1);
    for (let i = 0; i < g.socks.length; i += 1) await settle(g.socks[i]!, marks[i]!);
    const inExecution = await storedFlow(g.code);
    expect(inExecution.phase).toBe("execution");
    expect(inExecution.players.find((p) => p.seat === defender.seat)!.alive).toBe(false);
    expect(lastViews(g).map((v) => JSON.stringify(v.day?.verdict)).join("|")).toBe(
      g.socks.map(() => JSON.stringify({ yes: 3, no: 1, passed: true })).join("|"),
    );
    const defSock = g.socks[g.actors.indexOf(defender)]!;
    expect(worldFramesOf(defSock, marks[g.actors.indexOf(defender)]!).filter((m) => m.k === "snap").length).toBe(1);
    // 처형 발표(vote.test 의 "처형 발표" 이전): 모든 소켓이 day.execution {seat}(문구 번호 없음, 결정 0060-5)를 받고, 관전은 처형된 소켓만 받는다
    for (const [i, v] of lastViews(g).entries()) {
      expect(Object.keys(v.day?.execution ?? {}).sort().join(",")).toBe("seat");
      expect(v.day?.execution?.seat).toBe(defender.seat);
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
  }, 60_000);

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

  it("찬반이 부결(찬성 2 / 반대 2)이면 처형에서 아무도 탈락하지 않고 변론자는 자기 자리로 돌아오며 밤 view 에 noExecution 키가 없다", async () => {
    const { g } = await toNominationByEnd();
    const defender = g.actors.find((a) => a.role !== "mafia")!;
    const others = g.actors.filter((a) => a.seat !== defender.seat);
    const bySeat: Record<number, number> = { [defender.seat]: others[0]!.seat };
    for (const o of others) bySeat[o.seat] = defender.seat;
    await pointAll(g, bySeat);
    await dueAgo(g.code, 1);
    await dueAgo(g.code, 1);
    await settleAllSocks(g);
    expect((await storedFlow(g.code)).phase).toBe("verdict");
    await verdictAll(g, { [others[0]!.seat]: true, [others[1]!.seat]: true, [others[2]!.seat]: false, [others[3]!.seat]: false });
    const marks = g.socks.map(mark);
    await dueAgo(g.code, 1);
    for (let i = 0; i < g.socks.length; i += 1) await settle(g.socks[i]!, marks[i]!);
    const inExecution = await storedFlow(g.code);
    expect(inExecution.phase).toBe("execution");
    expect(inExecution.players.every((p) => p.alive !== false)).toBe(true);
    expect(lastViews(g).map((v) => JSON.stringify(v.day?.verdict)).join("|")).toBe(
      g.socks.map(() => JSON.stringify({ yes: 2, no: 2, passed: false })).join("|"),
    );
    const back = movesSince(g.socks[0]!, marks[0]!);
    expect([...back.keys()].join(",")).toBe(String(defender.seat));
    expect(slotKeys(5).has(back.get(defender.seat)!)).toBe(true);
    await dueAgo(g.code, 1);
    await settleAllSocks(g);
    expect((await storedFlow(g.code)).phase).toBe("night");
    expect(lastViews(g).map((v) => Object.hasOwn(v.day ?? {}, "noExecution")).join(",")).toBe("false,false,false,false,false");
  }, 60_000);

  it("둘째 날 토론이 시작되면 전날의 endVote·nominate·verdictVote·verdict·execution 이 없고 토론이 바로 끝나지 않는다", async () => {
    const { g } = await toNominationByEnd();
    expect((await storedFlow(g.code)).players.filter((p) => p.endVote !== undefined).length).toBe(3);
    const defender = g.actors.find((a) => a.role !== "mafia")!;
    const others = g.actors.filter((a) => a.seat !== defender.seat);
    const bySeat: Record<number, number> = { [defender.seat]: others[0]!.seat };
    for (const o of others) bySeat[o.seat] = defender.seat;
    await pointAll(g, bySeat);
    await dueAgo(g.code, 1);
    await dueAgo(g.code, 1);
    await verdictAll(g, Object.fromEntries(others.map((o) => [o.seat, true])));
    await dueAgo(g.code, 1);
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
    const line = ((await storedRoom(g.code)) as unknown as { voteLog?: Array<{ cand?: { votes: Array<{ seat: number; target: number }> } }> }).voteLog?.at(-1)?.cand;
    expect(JSON.stringify(line?.votes)).toBe(JSON.stringify([a, b].sort((x, y) => x.seat - y.seat).map((x) => ({ seat: x.seat, target: defender.seat }))));
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

  it("변론 중 변론자의 chat 은 모두에게 ch all 로 가고 빠른 메시지(say)는 변론자 소켓만 BAD_MESSAGE 이며, 변론자가 아닌 산 사람의 chat 도 모두에게 간다", async () => {
    const { g } = await toNominationByEnd();
    const defender = g.actors.find((a) => a.role !== "mafia")!;
    const others = g.actors.filter((a) => a.seat !== defender.seat);
    await pointAll(g, Object.fromEntries(others.map((o) => [o.seat, defender.seat])));
    await dueAgo(g.code, 1);
    await settleAllSocks(g);
    expect((await storedFlow(g.code)).phase).toBe("defense");
    const said = await castAll(g, () => send(defender.sock, chatMsg(defender.sock, "저 아니에요")));
    expect(said.map(summary).join(" ")).toBe(g.actors.map(() => "[chat]").join(" "));
    for (const f of said) {
      const chat = f[0] as Extract<ServerMessage, { t: "chat" }>;
      expect(`${chat.ch} ${chat.seat} ${chat.text}`).toBe(`all ${defender.seat} 저 아니에요`);
    }
    const quick = await castAll(g, () => send(defender.sock, { t: "say", template: "defNotMe" }));
    expect(quick.map(summary).join(" ")).toBe(g.actors.map((a) => (a === defender ? "[error:BAD_MESSAGE]" : "[]")).join(" "));
    const by = await castAll(g, () => send(others[0]!.sock, chatMsg(others[0]!.sock, "믿어 주세요")));
    expect(by.map(summary).join(" ")).toBe(g.actors.map(() => "[chat]").join(" "));
  }, 60_000);

  it("처형으로 승패가 나면(마피아 한 명이 변론자로 통과) 처형 마감에서 ended 가 된다", async () => {
    const { g } = await toNominationByEnd();
    const defender = g.actors.find((a) => a.role === "mafia")!;
    const others = g.actors.filter((a) => a.seat !== defender.seat);
    const bySeat: Record<number, number> = { [defender.seat]: others[0]!.seat };
    for (const o of others) bySeat[o.seat] = defender.seat;
    await pointAll(g, bySeat);
    await dueAgo(g.code, 1);
    await dueAgo(g.code, 1);
    await verdictAll(g, Object.fromEntries(others.map((o) => [o.seat, true])));
    await dueAgo(g.code, 1);
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
