// 동점 결선의 서버 층 DO 시험(09.1.1-04, POL-04, 결정 0066-4, L20).
// 지목 집계에서 최다 득표가 정확히 둘이면 runoff(앞머리 1초 → 투표 5초 → 결과 1.5초) 로 가고, 후보가 아닌 산 사람이 point 로 둘 중 하나를 고른다.
import { describe, expect, it } from "vitest";
import type { RoomView } from "../../shared/protocol";
import { RUNOFF_END_MS, RUNOFF_INTRO_MS, RUNOFF_VOTE_MS } from "../../shared/game/phases";
import { closePhase, lastViewOf, mark, nextFrame, pointAll, runoffAll, send, settle, startedGame, storedRoom } from "./helpers";
import type { Game } from "./helpers";

const bySeat = (g: Game): Game["actors"] => [...g.actors].sort((a, b) => a.seat - b.seat);

/** 새 단계 state 를 모든 소켓이 받을 때까지 기다린다. */
async function untilRunoffStep(g: Game, step: 0 | 1 | 2): Promise<RoomView[]> {
  const views: RoomView[] = [];
  for (const sock of g.socks) {
    const msg = await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "runoff" && m.view.day?.runoff?.step === step);
    if (msg.t === "state") views.push(msg.view);
  }
  return views;
}

/** 좌석 0·1·2 가 A·B·C 인 지목: A=0 이 2표, B=1 이 2표, C=2 가 1표, 좌석 5 는 기권(최다 정확히 둘 동점). */
const TIE_POINTS: Record<number, number> = { 0: 1, 1: 0, 2: 0, 3: 1, 4: 2 };

describe("동점 결선 — 트레이서 (결정 0066-4)", () => {
  it("2자 동점 지목 → runoff 앞머리(1000ms) → 투표(5000ms) → 결과 → 승자의 최후 변론으로, 모든 소켓이 같은 값을 받는다", async () => {
    const g = await startedGame("nomination");
    const seated = bySeat(g);
    await pointAll(g.code, g.actors, TIE_POINTS);
    // 앞머리
    const lead = g.socks.map(lastViewOf);
    expect(lead.map((v) => v.phase).join(",")).toBe(g.socks.map(() => "runoff").join(","));
    expect(lead.map((v) => JSON.stringify(v.day?.runoff)).join("|")).toBe(g.socks.map(() => JSON.stringify({ cand: [0, 1], step: 0 })).join("|"));
    expect(lead.map((v) => v.phaseDurationMs).join(",")).toBe(g.socks.map(() => String(RUNOFF_INTRO_MS)).join(","));
    expect(RUNOFF_INTRO_MS).toBe(1000);
    const stored = await storedRoom(g.code);
    const today = stored.voteLog!.at(-1)!;
    expect(today.cand?.candidate).toBeUndefined();
    expect(today.cand?.votes.length).toBe(5);

    // 투표 창
    await closePhase(g.code);
    const open = await untilRunoffStep(g, 1);
    expect(open.map((v) => v.phaseDurationMs).join(",")).toBe(g.socks.map(() => String(RUNOFF_VOTE_MS)).join(","));
    expect(RUNOFF_VOTE_MS).toBe(5000);
    expect((await storedRoom(g.code)).runoff?.step).toBe(1);
    // 후보가 아닌 산 사람 4명(좌석 2~5): A 3표 · B 1표
    const voters = seated.filter((a) => a.seat >= 2);
    const votes: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 1 };
    const marks = g.socks.map((sock) => mark(sock));
    for (const a of voters) send(a.sock, { t: "point", target: votes[a.seat] });
    for (let i = 0; i < g.socks.length; i += 1) await settle(g.socks[i]!, marks[i]!);

    // 결과
    await closePhase(g.code);
    const result = await untilRunoffStep(g, 2);
    expect(result.map((v) => JSON.stringify(v.day?.runoff?.tally)).join("|")).toBe(g.socks.map(() => "[3,1]").join("|"));
    expect(result.map((v) => v.phaseDurationMs).join(",")).toBe(g.socks.map(() => String(RUNOFF_END_MS)).join(","));

    // 최후 변론
    await closePhase(g.code);
    for (const sock of g.socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "defense");
    const defense = g.socks.map(lastViewOf);
    expect(defense.map((v) => v.day?.candidate).join(",")).toBe(g.socks.map(() => "0").join(","));
    const after = await storedRoom(g.code);
    expect(after.voteLog!.at(-1)!.cand?.candidate).toBe(0);
    expect(after.verdict?.candidate).toBe(0);
    expect(after.runoff).toBeUndefined();
    expect(after.players.some((p) => p.runoffVote !== undefined)).toBe(false);
  }, 60_000);

  it("runoffAll 도우미로 같은 경로를 걷는다 (결선도 B 승 → 후보 B)", async () => {
    const g = await startedGame("nomination");
    await pointAll(g.code, g.actors, TIE_POINTS);
    await runoffAll(g.code, g.actors, { 2: 1, 3: 1, 4: 1, 5: 0 });
    expect((await storedRoom(g.code)).phase).toBe("defense");
    expect((await storedRoom(g.code)).verdict?.candidate).toBe(1);
  }, 60_000);

  it("결선도 동점이면 처형 없음 경로(밤)다 — 그날 줄에 candidate 가 없다", async () => {
    const g = await startedGame("nomination");
    await pointAll(g.code, g.actors, TIE_POINTS);
    await runoffAll(g.code, g.actors, { 2: 0, 3: 1 });
    const room = await storedRoom(g.code);
    expect(room.phase).toBe("night");
    expect(room.voteLog!.at(-1)!.cand?.candidate).toBeUndefined();
    expect(room.runoff).toBeUndefined();
  }, 60_000);

  it("최다가 셋 이상 동점(2-2-2)이거나 0표면 runoff 를 거치지 않고 밤으로 간다", async () => {
    const three = await startedGame("nomination");
    // 0→1, 1→0, 2→3, 3→2, 4→5, 5→4 : 모두 1표씩, 최다 여섯 동점
    await pointAll(three.code, three.actors, { 0: 1, 1: 0, 2: 3, 3: 2, 4: 5, 5: 4 });
    expect((await storedRoom(three.code)).phase).toBe("night");
    const none = await startedGame("nomination");
    await pointAll(none.code, none.actors, {});
    expect((await storedRoom(none.code)).phase).toBe("night");
  }, 120_000);
});
