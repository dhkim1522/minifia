// 마지막 3인 결전의 서버 층 DO 시험(09.1.1-06, POL-05, 결정 0066-5, L21).
// 낮 시작 발표 마감에 산 사람이 정확히 셋이면 showdown(모이기 2초 → 한마디 8초×3 → 동시 지목 8초 → 공개 1.5초)으로 가고,
// 2표 이상 받은 사람이 있으면 최후 변론·찬반 없이 처형 단계로, 아니면 처형 없는 밤으로 간다. 한마디는 기존 chat, 지목은 기존 point 다.
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { SHOWDOWN_GATHER_MS, SHOWDOWN_POINT_MS, SHOWDOWN_REVEAL_MS, SHOWDOWN_TURN_MS, PICK_GAP_MS } from "../../shared/game/phases";
import {
  chatSend, chatsOf, closePhase, editRoom, framesOf, lastViewOf, mapPlayers, mark, pointAs, settle, showdownAll, startedGame, storedRoom,
} from "./helpers";
import type { Game } from "./helpers";

/** 4명 판에서 좌석 3 을 죽인 낮 시작 발표 — 산 사람 정확히 셋(좌석 0·1·2). 지난 낮의 개인 키를 일부러 남겨 청소를 확인한다. */
async function threeGame(): Promise<Game> {
  const g = await startedGame("dayAnnounce", 3);
  await editRoom(g.code, (room) =>
    mapPlayers(room, (p) => ({ ...p, ...(p.seat === 3 ? { alive: false } : {}), nominate: 1, verdictVote: true, endVote: true })),
  );
  return g;
}

/** 마감을 한 번 넘기고 모든 소켓이 그 state 를 받은 뒤의 마지막 view 들. */
async function stepViews(g: Game): Promise<RoomView[]> {
  await closePhase(g.code);
  for (const sock of g.socks) await settle(sock, mark(sock));
  return g.socks.map(lastViewOf);
}

const actorAt = (g: Game, seat: number): Game["actors"][number] => g.actors.find((a) => a.seat === seat)!;
const same = (views: RoomView[], pick: (v: RoomView) => unknown): string => {
  const first = JSON.stringify(pick(views[0]!));
  for (const v of views) expect(JSON.stringify(pick(v))).toBe(first);
  return first;
};

describe("마지막 3인 — 트레이서 (결정 0066-5)", () => {
  it("산 사람 셋의 낮 시작 발표가 끝나면 모든 소켓이 showdown 모이기(2초)를 받고, 낮 시작 청소는 빠지지 않는다", async () => {
    const g = await threeGame();
    const views = await stepViews(g);
    expect(views.map((v) => v.phase).join(",")).toBe(g.socks.map(() => "showdown").join(","));
    expect(same(views, (v) => v.day?.showdown)).toBe(JSON.stringify({ order: [0, 1, 2], i: -1 }));
    expect(views.map((v) => v.phaseDurationMs).join(",")).toBe(g.socks.map(() => String(SHOWDOWN_GATHER_MS)).join(","));
    expect(SHOWDOWN_GATHER_MS).toBe(2000);
    const stored = await storedRoom(g.code);
    expect(stored.phase).toBe("showdown");
    expect(stored.players.some((p) => (p as Record<string, unknown>).nominate !== undefined || p.verdictVote !== undefined || p.endVote !== undefined)).toBe(false);
  }, 60_000);

  it("한마디: 차례 주인의 채팅이 그 차례의 한마디가 되고, 차례 아닌 사람의 글은 단순 채팅, 31자소는 거절, 시간 초과는 말없이 넘어간다", async () => {
    const g = await threeGame();
    await stepViews(g); // 모이기
    const turn0 = await stepViews(g); // 차례 0
    const stored0 = await storedRoom(g.code);
    expect(stored0.showdown).toMatchObject({ i: 0 });
    expect(same(turn0, (v) => v.day?.showdown?.endsAt)).toBe(String(stored0.showdown!.endsAt));
    expect(stored0.phaseEndsAt).toBe(stored0.showdown!.endsAt);
    expect(turn0.map((v) => v.phaseDurationMs).join(",")).toBe(g.socks.map(() => String(SHOWDOWN_TURN_MS)).join(","));

    const owner = actorAt(g, 0);
    const other = actorAt(g, 1);
    const marks = g.socks.map((s) => mark(s));
    // 차례 아닌 사람의 글: 단순 채팅
    chatSend(other.sock, "끼어들어요");
    const otherSeen = await Promise.all(g.socks.map((s, i) => settle(s, marks[i]!)));
    expect(otherSeen.every((m) => chatsOf(m).length === 1)).toBe(true);
    expect((await storedRoom(g.code)).showdown?.word).toBeUndefined();
    // 31자소: 보낸 소켓에만 length 거절, 차례 유지
    const marks2 = g.socks.map((s) => mark(s));
    chatSend(owner.sock, "가".repeat(31));
    const long = await Promise.all(g.socks.map((s, i) => settle(s, marks2[i]!)));
    const rejects = long.map((m) => m.filter((x) => x.t === "chatReject"));
    expect(rejects.map((r) => r.length)).toEqual(g.socks.map((s) => (s === owner.sock ? 1 : 0)));
    expect(JSON.stringify(rejects[g.socks.indexOf(owner.sock)])).toContain("length");
    expect((await storedRoom(g.code)).showdown?.doneAt).toBeUndefined();
    // 정상 한마디
    const marks3 = g.socks.map((s) => mark(s));
    chatSend(owner.sock, "저는 아니에요");
    const ok = await Promise.all(g.socks.map((s, i) => settle(s, marks3[i]!)));
    expect(ok.every((m) => chatsOf(m).length === 1)).toBe(true);
    const views = g.socks.map(lastViewOf);
    expect(same(views, (v) => v.day?.showdown?.word)).toBe(JSON.stringify("저는 아니에요"));
    const stored = await storedRoom(g.code);
    expect(stored.showdown?.doneAt).toBeDefined();
    expect(stored.phaseEndsAt).toBe(stored.showdown!.doneAt! + PICK_GAP_MS);
    // 같은 차례의 두 번째 줄은 단순 채팅 — word 는 그대로
    const marks4 = g.socks.map((s) => mark(s));
    chatSend(owner.sock, "한 번 더");
    await Promise.all(g.socks.map((s, i) => settle(s, marks4[i]!)));
    expect((await storedRoom(g.code)).showdown?.word).toBe("저는 아니에요");

    // 사이를 지나 차례 1 은 시간 초과 — 말 없이 skip
    await stepViews(g);
    expect((await storedRoom(g.code)).showdown).toMatchObject({ i: 1 });
    await stepViews(g);
    const skipped = (await storedRoom(g.code)).showdown!;
    expect(skipped).toMatchObject({ i: 1, skip: true });
    expect(skipped.word).toBeUndefined();
  }, 60_000);

  it("동시 지목: 2표를 받은 사람이 있으면 변론·찬반 없이 처형 단계로 — verdict.last, ballots 없음", async () => {
    const g = await threeGame();
    await stepViews(g); // 모이기 → 차례 0
    for (let guard = 0; guard < 12 && (await storedRoom(g.code)).showdown?.i !== 3; guard += 1) await stepViews(g);
    const point = (await storedRoom(g.code)).showdown!;
    expect(point.i).toBe(3);
    expect(g.socks.map(lastViewOf).map((v) => v.phaseDurationMs).join(",")).toBe(g.socks.map(() => String(SHOWDOWN_POINT_MS)).join(","));

    const marks = g.socks.map((s) => mark(s));
    pointAs(actorAt(g, 0).sock, 2);
    pointAs(actorAt(g, 1).sock, 2);
    pointAs(actorAt(g, 2).sock, 0);
    await Promise.all(g.socks.map((s, i) => settle(s, marks[i]!)));

    const reveal = await stepViews(g);
    expect(same(reveal, (v) => v.day?.showdown?.points)).toBe(
      JSON.stringify([{ seat: 0, target: 2 }, { seat: 1, target: 2 }, { seat: 2, target: 0 }]),
    );
    expect(reveal.map((v) => v.phaseDurationMs).join(",")).toBe(g.socks.map(() => String(SHOWDOWN_REVEAL_MS)).join(","));

    const exec = await stepViews(g);
    expect(exec.map((v) => v.phase).join(",")).toBe(g.socks.map(() => "execution").join(","));
    expect(same(exec, (v) => v.day?.candidate)).toBe("2");
    expect(same(exec, (v) => v.day?.verdict)).toBe(JSON.stringify({ yes: 0, no: 0, passed: true, last: true }));
    expect(exec.every((v) => v.day?.ballots === undefined)).toBe(true);
    const stored = await storedRoom(g.code);
    expect(stored.voteLog!.at(-1)).toMatchObject({ last: true, exec: { passed: true }, cand: { candidate: 2 } });
    expect(stored.showdown).toBeUndefined();
    expect(stored.players.some((p) => p.showdownPick !== undefined)).toBe(false);
  }, 60_000);

  it("showdownAll 도우미: 1-1-1(서로 한 명씩 돌려 지목)이면 처형 없는 밤이고 이유는 tie", async () => {
    const g = await threeGame();
    await closePhase(g.code); // 모이기 → 소켓이 showdown state 를 받게
    await showdownAll(g.code, g.actors.filter((a) => a.seat !== 3), { words: { 0: "저는 아니에요", 1: "쟤가 수상해요", 2: "끝까지 지켜봐요" }, points: { 0: 1, 1: 2, 2: 0 } });
    const stored = await storedRoom(g.code);
    expect(stored.phase).toBe("night");
    expect(stored.players.filter((p) => p.alive !== false).length).toBe(3);
    expect(stored.voteLog!.at(-1)).toMatchObject({ last: true, exec: { passed: false } });
    for (const sock of g.socks) await settle(sock, mark(sock));
    const nights: ServerMessage[] = framesOf(g.socks[0]!).filter((m) => m.t === "state" && m.view.phase === "night");
    expect(nights.length).toBeGreaterThan(0);
    expect(lastViewOf(g.socks[0]!).day?.noExecution).toEqual({ reason: "tie" });
  }, 60_000);
});
