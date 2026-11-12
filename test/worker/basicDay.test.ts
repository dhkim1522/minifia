// 기본판 낮 흐름 DO 시험(13-01, FLOW-01·02·03·04, 결정 0072).
// 설정은 shared/game/ruleset.ts 의 판 규칙 한 곳이다(모두 꺼짐).
// 토론 끝내기 → 투표(동시, 15초, 마감까지 바꾸기) → 최후 변론 → 찬반 → 처형(찬반 기록 카드) → 밤을 실제 방 DO 와 소켓 프레임으로 끝까지 돈다.
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { closePhase, endAs, framesOf, lastViewOf, mark, pause, pointAll, pointAs, settle, startedGame, storedRoom, threeAliveGame, verdictAll, chatsOf } from "./helpers";
import type { Game } from "./helpers";

const viewsOf = (msgs: ServerMessage[]): RoomView[] =>
  msgs.filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state").map((m) => m.view);

/** 모든 소켓의 프레임을 비운다(서버가 단계 진입으로 보낸 프레임이 관찰 구간 앞에 놓이게). */
async function settleAll(g: Game): Promise<void> {
  for (const sock of g.socks) await settle(sock, mark(sock));
}

/** 모든 소켓의 마지막 view 의 day.points 를 한 줄 문자열로. */
const pointsLines = (g: Game): string[] => g.socks.map((s) => JSON.stringify(lastViewOf(s).day?.points));

describe("기본판 낮 흐름 (FLOW-01·04, 결정 0072)", () => {
  it("토론 끝내기 과반 → 15초 동시 투표(바꾸기 포함) → 변론 → 찬반 → 처형(찬반 기록 카드 한 장) → 밤, day.turn·runoff·showdown 은 한 번도 없다", async () => {
    const g = await startedGame("discussion", 3); // 4명 판: 과반 3
    const start = g.socks.map(mark);
    const before = Date.now();
    for (const a of g.actors.slice(0, 3)) {
      endAs(a.sock, true);
      await settle(a.sock, mark(a.sock));
    }
    await settleAll(g);
    const after = Date.now();

    // 투표(nomination) 진입: 15초, 차례 정보 없음
    const entered = await storedRoom(g.code);
    expect(entered.phase).toBe("nomination");
    expect(entered.phaseEndsAt! >= before + 15_000 - 50).toBe(true);
    expect(entered.phaseEndsAt! <= after + 15_000 + 50).toBe(true);
    expect(g.socks.map((s) => lastViewOf(s).phaseDurationMs).join(",")).toBe("15000,15000,15000,15000");
    expect(g.socks.map((s) => Object.hasOwn(lastViewOf(s).day ?? {}, "turn")).join(",")).toBe("false,false,false,false");

    // 세 사람이 같은 한 명(A)을, A 는 다른 사람을 고른다 — 모두에게 같은 공개 값
    const target = g.actors.find((a) => a.role !== "mafia")!;
    const others = g.actors.filter((a) => a.seat !== target.seat).sort((a, b) => a.seat - b.seat);
    for (const o of others) {
      pointAs(o.sock, target.seat);
      await settleAll(g);
    }
    pointAs(target.sock, others[0]!.seat);
    await settleAll(g);
    const lines = pointsLines(g);
    expect(new Set(lines).size).toBe(1);
    expect(lastViewOf(g.socks[0]!).day?.points?.length).toBe(4);

    // 마감까지 바꾸기(U-3): others[0] 이 쉬었다가 다른 대상으로 바꿨다가 다시 A 로 돌아온다
    await pause(300);
    pointAs(others[0]!.sock, others[1]!.seat);
    await settleAll(g);
    const changed = pointsLines(g);
    expect(new Set(changed).size).toBe(1);
    expect(changed[0]).toContain(`"seat":${others[0]!.seat},"target":${others[1]!.seat}`);
    await pause(300);
    pointAs(others[0]!.sock, target.seat);
    await settleAll(g);
    expect(new Set(pointsLines(g)).size).toBe(1);
    expect(pointsLines(g)[0]).toContain(`"seat":${others[0]!.seat},"target":${target.seat}`);

    // 마감 → 최후 변론(변론자 = A)
    await closePhase(g.code);
    await settleAll(g);
    expect((await storedRoom(g.code)).phase).toBe("defense");
    expect(g.socks.map((s) => lastViewOf(s).day?.candidate).join(",")).toBe(g.socks.map(() => target.seat).join(","));

    // 변론 마감 → 찬반 → 찬성 → 처형: 찬반 기록 카드가 모든 소켓에 한 장
    await closePhase(g.code);
    await settleAll(g);
    expect((await storedRoom(g.code)).phase).toBe("verdict");
    const marks = g.socks.map(mark);
    await verdictAll(g.code, g.actors, Object.fromEntries(others.map((o) => [o.seat, true])));
    const cards: string[] = [];
    for (let i = 0; i < g.socks.length; i += 1) {
      const got = chatsOf(await settle(g.socks[i]!, marks[i]!)).filter((c) => c.k === "ballots");
      cards.push(String(got.length));
    }
    expect(cards.join(",")).toBe("1,1,1,1");
    expect((await storedRoom(g.code)).phase).toBe("execution");

    // 처형 마감 → 밤
    await closePhase(g.code);
    await settleAll(g);
    expect((await storedRoom(g.code)).phase).toBe("night");

    // 관찰한 모든 state 프레임에서 runoff·showdown 단계와 day.turn 이 0개
    const seen = g.socks.flatMap((s, i) => viewsOf(framesOf(s).slice(start[i]!)));
    expect(seen.length > 0).toBe(true);
    expect(seen.filter((v) => v.phase === "runoff" || v.phase === "showdown").length).toBe(0);
    expect(seen.filter((v) => Object.hasOwn(v.day ?? {}, "turn")).length).toBe(0);
  }, 60_000);
});

describe("기본판 낮 분기 (FLOW-02·03, 결정 0072)", () => {
  const seenPhases = (g: Game, from: number[]): string[] => g.socks.flatMap((s, i) => viewsOf(framesOf(s).slice(from[i]!)).map((v) => v.phase));

  it("2:2 동점으로 투표가 마감되면 결선 없이 모든 소켓이 night 와 day.noExecution.reason tie 를 받고 runoff 프레임이 0이다", async () => {
    const g = await startedGame("nomination", 3);
    const from = g.socks.map(mark);
    const [s0, s1, s2, s3] = g.actors.map((a) => a.seat);
    await pointAll(g.code, g.actors, { [s0!]: s2!, [s1!]: s2!, [s2!]: s0!, [s3!]: s0! });
    await settleAll(g);
    expect((await storedRoom(g.code)).phase).toBe("night");
    expect(g.socks.map((s) => lastViewOf(s).day?.noExecution?.reason).join(",")).toBe("tie,tie,tie,tie");
    expect(seenPhases(g, from).filter((p) => p === "runoff").length).toBe(0);
  }, 60_000);

  it("0표로 투표가 마감되면 night 이고 reason 은 noVotes 다", async () => {
    const g = await startedGame("nomination", 3);
    await pointAll(g.code, g.actors, {});
    await settleAll(g);
    expect((await storedRoom(g.code)).phase).toBe("night");
    expect(g.socks.map((s) => lastViewOf(s).day?.noExecution?.reason).join(",")).toBe("noVotes,noVotes,noVotes,noVotes");
  }, 60_000);

  it("산 사람이 정확히 셋인 낮 시작 발표 마감 뒤에는 심부름을 지나 토론으로 가고 showdown 프레임이 0이다", async () => {
    const g = await threeAliveGame();
    const from = g.socks.map(mark);
    await closePhase(g.code); // 낮 시작 → 심부름(15페이즈)
    await settleAll(g);
    expect((await storedRoom(g.code)).phase).toBe("errand");
    await closePhase(g.code); // 심부름 → 토론
    await settleAll(g);
    expect((await storedRoom(g.code)).phase).toBe("discussion");
    expect(g.socks.map((s) => lastViewOf(s).phase).join(",")).toBe("discussion,discussion,discussion,discussion");
    expect(seenPhases(g, from).filter((p) => p === "showdown").length).toBe(0);
  }, 60_000);
});
