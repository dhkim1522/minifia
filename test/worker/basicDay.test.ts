// 낮 흐름 DO 시험(결정 0089-18, D-10~D-13·D-26).
// 설정은 shared/game/ruleset.ts 의 판 규칙 한 곳이다(순차 지목만 켜짐).
// 토론 끝내기 → 찬반(후보 없음, 집계만 실시간 공개) → 순차 지목 → 변론(유언 자리) → 처형 → 밤을 실제 방 DO 와 소켓 프레임으로 돈다.
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { closePhase, endAs, framesOf, lastViewOf, mark, pointAll, settle, startedGame, storedRoom, threeAliveGame, verdictAll } from "./helpers";
import type { Game } from "./helpers";
import { send } from "./helpers";

const viewsOf = (msgs: ServerMessage[]): RoomView[] =>
  msgs.filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state").map((m) => m.view);

/** 모든 소켓의 프레임을 비운다(서버가 단계 진입으로 보낸 프레임이 관찰 구간 앞에 놓이게). */
async function settleAll(g: Game): Promise<void> {
  for (const sock of g.socks) await settle(sock, mark(sock));
}

/** 모든 소켓의 마지막 view 의 day.verdictCount 를 한 줄 문자열로. */
const countLines = (g: Game): string[] => g.socks.map((s) => JSON.stringify(lastViewOf(s).day?.verdictCount));

/** 토론 끝내기 과반(4명 판은 3명)으로 찬반에 들어선다. */
async function intoVerdict(g: Game): Promise<void> {
  for (const a of g.actors.slice(0, 3)) {
    endAs(a.sock, true);
    await settle(a.sock, mark(a.sock));
  }
  await settleAll(g);
  expect((await storedRoom(g.code)).phase).toBe("verdict");
}

describe("낮 흐름 (D-10~D-13)", () => {
  it("토론 끝내기 과반 → 찬반(집계 방송·번복) → 순차 지목 → 변론 → 처형 → 밤, 단계 수열에 지목이 찬반보다 먼저 오지 않는다", async () => {
    const g = await startedGame("discussion", 3); // 4명 판: 과반 3
    const start = g.socks.map(mark);
    await intoVerdict(g);

    // 찬반 진입: 10초, 집계는 {0,0}, day.voted·day.candidate 는 어느 소켓에도 없다
    expect(g.socks.map((s) => lastViewOf(s).phaseDurationMs).join(",")).toBe("10000,10000,10000,10000");
    expect(countLines(g).join("|")).toBe(Array(4).fill('{"yes":0,"no":0}').join("|"));

    // 한 사람이 찬성 → 모든 소켓이 같은 집계, 번복하면 모든 소켓이 다시 같은 집계(번복도 방송)
    const [a0, a1, a2, a3] = g.actors;
    send(a0!.sock, { t: "verdict", agree: true });
    await settleAll(g);
    expect(new Set(countLines(g)).size).toBe(1);
    expect(countLines(g)[0]).toBe('{"yes":1,"no":0}');
    send(a0!.sock, { t: "verdict", agree: false });
    await settleAll(g);
    expect(new Set(countLines(g)).size).toBe(1);
    expect(countLines(g)[0]).toBe('{"yes":0,"no":1}');
    for (const sock of g.socks) {
      const day = lastViewOf(sock).day ?? {};
      expect(`${Object.hasOwn(day, "voted")}/${Object.hasOwn(day, "candidate")}`).toBe("false/false");
    }
    // 내 표는 본인만
    expect(lastViewOf(a0!.sock).me.verdictVote).toBe(false);
    expect(Object.hasOwn(lastViewOf(a1!.sock).me, "verdictVote")).toBe(false);

    // 나머지 셋이 찬성(3:1) → 마감 → 지목
    await verdictAll(g.code, g.actors, { [a1!.seat]: true, [a2!.seat]: true, [a3!.seat]: true });
    await settleAll(g);
    const entered = await storedRoom(g.code);
    expect(entered.phase).toBe("nomination");
    expect(entered.pickTurn !== undefined).toBe(true);
    expect(g.socks.map((s) => Object.hasOwn(lastViewOf(s).day ?? {}, "turn")).join(",")).toBe("true,true,true,true");

    // 순차 지목: 모두가 a3 를 가리키고 a3 는 a0 를 가리킨다 → 변론(변론자 = a3)
    await pointAll(g.code, g.actors, { [a0!.seat]: a3!.seat, [a1!.seat]: a3!.seat, [a2!.seat]: a3!.seat, [a3!.seat]: a0!.seat });
    await settleAll(g);
    expect((await storedRoom(g.code)).phase).toBe("defense");
    expect(g.socks.map((s) => lastViewOf(s).day?.candidate).join(",")).toBe(g.socks.map(() => a3!.seat).join(","));

    // 변론 마감 → 처형(통과한 찬반이 보존돼 변론자가 탈락한다) → 밤
    await closePhase(g.code);
    await settleAll(g);
    const exec = await storedRoom(g.code);
    expect(exec.phase).toBe("execution");
    expect(exec.players.find((p) => p.seat === a3!.seat)!.alive).toBe(false);
    await closePhase(g.code);
    await settleAll(g);
    expect((await storedRoom(g.code)).phase).toBe("night");

    // 관찰한 모든 state 프레임의 단계 수열: 같은 소켓에서 verdict 가 nomination 보다 먼저다. runoff·showdown 은 한 번도 없다
    const seen = viewsOf(framesOf(g.socks[0]!).slice(start[0]!)).map((v) => v.phase);
    expect(seen.indexOf("verdict") >= 0 && seen.indexOf("verdict") < seen.indexOf("nomination")).toBe(true);
    const all = g.socks.flatMap((s, i) => viewsOf(framesOf(s).slice(start[i]!)));
    expect(all.filter((v) => v.phase === "runoff" || v.phase === "showdown").length).toBe(0);
  }, 90_000);
});

describe("낮 분기 (D-11·D-13)", () => {
  const seenPhases = (g: Game, from: number[]): string[] => g.socks.flatMap((s, i) => viewsOf(framesOf(s).slice(from[i]!)).map((v) => v.phase));

  it("찬반이 부결(찬성 < 반대)이면 지목 없이 모든 소켓이 night 와 day.noExecution.reason rejected 를 받는다", async () => {
    const g = await startedGame("verdict", 3);
    const from = g.socks.map(mark);
    const [a0, a1, a2, a3] = g.actors;
    await verdictAll(g.code, g.actors, { [a0!.seat]: true, [a1!.seat]: false, [a2!.seat]: false, [a3!.seat]: false });
    await settleAll(g);
    expect((await storedRoom(g.code)).phase).toBe("night");
    expect(g.socks.map((s) => lastViewOf(s).day?.noExecution?.reason).join(",")).toBe("rejected,rejected,rejected,rejected");
    expect(seenPhases(g, from).filter((p) => p === "nomination").length).toBe(0);
  }, 60_000);

  it("0표로 찬반이 마감돼도 부결이다(던진 표 0)", async () => {
    const g = await startedGame("verdict", 3);
    await verdictAll(g.code, g.actors, {});
    await settleAll(g);
    expect((await storedRoom(g.code)).phase).toBe("night");
    expect(g.socks.map((s) => lastViewOf(s).day?.noExecution?.reason).join(",")).toBe("rejected,rejected,rejected,rejected");
  }, 60_000);

  it("못 던진 사람은 분모에 없다: 4명 중 한 명만 찬성해도 통과해 지목으로 간다", async () => {
    const g = await startedGame("verdict", 3);
    await verdictAll(g.code, g.actors, { [g.actors[0]!.seat]: true });
    await settleAll(g);
    expect((await storedRoom(g.code)).phase).toBe("nomination");
  }, 60_000);

  it("지목이 2:2 동점이면 처형 없이 night 와 reason tie, 지목이 전원 기권이면 noVotes", async () => {
    for (const [label, script, expected] of [
      ["tie", "tie", "tie"],
      ["none", "none", "noVotes"],
    ] as const) {
      const g = await startedGame("verdict", 3);
      await verdictAll(g.code, g.actors, { [g.actors[0]!.seat]: true });
      await settleAll(g);
      expect((await storedRoom(g.code)).phase, label).toBe("nomination");
      const [s0, s1, s2, s3] = g.actors.map((a) => a.seat);
      await pointAll(g.code, g.actors, script === "tie" ? { [s0!]: s2!, [s1!]: s2!, [s2!]: s0!, [s3!]: s0! } : {});
      await settleAll(g);
      expect((await storedRoom(g.code)).phase, label).toBe("night");
      expect(g.socks.map((s) => lastViewOf(s).day?.noExecution?.reason).join(","), label).toBe(Array(4).fill(expected).join(","));
    }
  }, 90_000);

  it("산 사람이 정확히 셋인 낮 시작 발표 마감 뒤에는 곧바로 토론으로 가고 showdown 프레임이 0이다", async () => {
    const g = await threeAliveGame();
    const from = g.socks.map(mark);
    await closePhase(g.code); // 낮 시작 → 토론
    await settleAll(g);
    expect((await storedRoom(g.code)).phase).toBe("discussion");
    expect(g.socks.map((s) => lastViewOf(s).phase).join(",")).toBe("discussion,discussion,discussion,discussion");
    expect(seenPhases(g, from).filter((p) => p === "showdown").length).toBe(0);
  }, 60_000);
});
