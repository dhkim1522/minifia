// 11-02 Task 1: ended 의 result.awards 는 서버가 정한 같은 목록이다(END-04, D-4, L36). 처형으로 끝나는 4명 판을 실제 방에서 돌린다.
import { describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { actorsOf, advanceTo, closePhase, lastViewOf, nextFrame, pointAll, seat, send, verdictAll } from "./helpers";
import type { Actor, Seated, TestSocket } from "./helpers";

vi.setConfig({ testTimeout: 20_000 });

const allSockets = (r: Seated): TestSocket[] => [r.host, ...r.guests.map((g) => g.sock)];
const isPhase = (phase: string) => (m: ServerMessage): boolean => m.t === "state" && m.view.phase === phase;

/** 4명 방을 시작해 마피아가 1일차에 처형되도록 몰아 ended 까지. */
async function endedGame(): Promise<{ r: Seated; actors: Actor[] }> {
  const r = await seat(3, 0);
  send(r.host, { t: "start" });
  for (const s of allSockets(r)) await nextFrame(s, isPhase("assigning"));
  await advanceTo(r.code, allSockets(r), "nomination");
  const actors = actorsOf(r);
  const mafia = actors.find((a) => a.role === "mafia")!;
  const police = actors.find((a) => a.role === "police")!;
  const cast: Record<number, number> = Object.fromEntries(actors.map((a) => [a.seat, a === mafia ? police.seat : mafia.seat]));
  await pointAll(r.code, actors, cast);
  await advanceTo(r.code, allSockets(r), "verdict");
  await verdictAll(r.code, actors, Object.fromEntries(actors.filter((a) => a !== mafia).map((a) => [a.seat, true])));
  await closePhase(r.code);
  for (const s of allSockets(r)) await nextFrame(s, isPhase("ended"));
  return { r, actors };
}

describe("ended 의 result.awards (END-04, L36)", () => {
  it("모든 소켓의 마지막 state 가 같은 result.awards 를 받고 길이가 참가자 수다", async () => {
    const { actors } = await endedGame();
    const lists = actors.map((a) => lastViewOf(a.sock).result?.awards);
    for (const list of lists) expect(list?.length).toBe(4);
    expect(new Set(lists.map((l) => JSON.stringify(l))).size).toBe(1);
    // 시민 승리 → 대체 칭호뿐인 이 판에서 마피아(진 팀)가 맨 앞
    const mafia = actors.find((a) => a.role === "mafia")!;
    expect(lists[0]![0]!.seat).toBe(mafia.seat);
    expect(lists[0]!.map((l) => l.award).sort()).toEqual(["spectator", "survivor", "survivor", "survivor"]);
  });
});
