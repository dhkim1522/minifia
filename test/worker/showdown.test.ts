// 마지막 3인 결전의 서버 층 DO 시험(09.1.1-06, POL-05, 결정 0066-5, L21).
// 낮 시작 발표 마감에 산 사람이 정확히 셋이면 showdown(모이기 2초 → 한마디 8초×3 → 동시 지목 8초 → 공개 1.5초)으로 가고,
// 2표 이상 받은 사람이 있으면 최후 변론·찬반 없이 처형 단계로, 아니면 처형 없는 밤으로 간다. 한마디는 기존 chat, 지목은 기존 point 다.
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { SHOWDOWN_GATHER_MS, SHOWDOWN_POINT_MS, SHOWDOWN_REVEAL_MS, SHOWDOWN_TURN_MS, PICK_GAP_MS } from "../../shared/game/phases";
import {
  chatSend, chatsOf, closePhase, connect, editRoom, framesOf, hello, lastViewOf, layOf, mapPlayers, mark, pointAs, settle, showdownAll, storedRoom, summary, threeAliveGame,
  worldFramesOf,
} from "./helpers";
import type { Game } from "./helpers";
import { ringSlots } from "../../shared/game/gather";

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
    const g = await threeAliveGame();
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
    const g = await threeAliveGame();
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
    const g = await threeAliveGame();
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
    const g = await threeAliveGame();
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

/** 지목 창(i 3)까지 마감을 넘긴다. */
async function toPointWindow(g: Game): Promise<void> {
  for (let guard = 0; guard < 14 && (await storedRoom(g.code)).showdown?.i !== 3; guard += 1) await stepViews(g);
  expect((await storedRoom(g.code)).showdown?.i).toBe(3);
  for (const sock of g.socks) await settle(sock, mark(sock));
}

/** 모든 소켓이 한 걸음 동안 받은 프레임. */
async function framesDuring(g: Game, act: () => void | Promise<void>): Promise<ServerMessage[][]> {
  const marks = g.socks.map((s) => mark(s));
  await act();
  return Promise.all(g.socks.map((s, i) => settle(s, marks[i]!)));
}

describe("마지막 3인 — 진입·시각은 역할의 함수가 아니다 (L21, T-09.1.1-16)", () => {
  /** 같은 대본(한마디·지목)을 돌리며 모든 소켓의 단계·길이·day.showdown(시각 값 제외, me 제외)을 한 줄씩 모은다. 공개 단계(i 4)에서 멈춘다. */
  async function column(roles: [string, string, string]): Promise<string[]> {
    const g = await threeAliveGame();
    await editRoom(g.code, (stored) => mapPlayers(stored, (p) => {
        const at = p.seat as number;
        return at === 3 ? { ...p, role: "mafia" } : { ...p, role: roles[at] };
      }));
    const rows: string[] = [];
    const snap = async (): Promise<void> => {
      for (const sock of g.socks) await settle(sock, mark(sock));
      rows.push(
        JSON.stringify(
          g.socks.map(lastViewOf).map((v) => {
            const { endsAt, doneAt, ...rest } = v.day?.showdown ?? { order: [], i: -9 };
            return { phase: v.phase, dur: v.phaseDurationMs, sd: rest, hasEnds: endsAt !== undefined, hasDone: doneAt !== undefined };
          }),
        ),
      );
    };
    await snap();
    await closePhase(g.code); // 낮 시작 발표 마감 → showdown 모이기
    await snap();
    const said = new Set<number>();
    let pointed = false;
    for (let guard = 0; guard < 20; guard += 1) {
      const sd = (await storedRoom(g.code)).showdown;
      if (sd === undefined) break;
      if (sd.i === 4) break;
      if (sd.i >= 0 && sd.i <= 2 && sd.doneAt === undefined && !said.has(sd.i)) {
        said.add(sd.i);
        await framesDuring(g, () => chatSend(g.socks[sd.order[sd.i]!]!, "저는 아니에요"));
        await snap();
      } else if (sd.i === 3 && !pointed) {
        pointed = true;
        await framesDuring(g, () => {
          pointAs(g.socks[0]!, 1);
          pointAs(g.socks[1]!, 2);
          pointAs(g.socks[2]!, 0);
        });
        await snap();
      } else {
        await closePhase(g.code);
        await snap();
      }
    }
    return rows;
  }

  it("L21: 마피아가 세 명 중 한 명인 판·아무도 아닌 판·둘인 판이 같은 단계·길이·day.showdown 열을 받는다", async () => {
    const one = await column(["mafia", "citizen", "citizen"]);
    const none = await column(["citizen", "citizen", "citizen"]);
    const two = await column(["citizen", "mafia", "mafia"]);
    expect(one.length).toBeGreaterThan(10);
    expect(JSON.stringify(none)).toBe(JSON.stringify(one));
    expect(JSON.stringify(two)).toBe(JSON.stringify(one));
    expect(one.some((row) => row.includes('"phase":"showdown"'))).toBe(true);
    expect(one.some((row) => row.includes("discussion"))).toBe(false);
  }, 120_000);
});

describe("마지막 3인 — 동시 지목의 비공개 (T-09.1.1-17)", () => {
  it("마감 전에는 던진 좌석(voted)만 모두에게 가고 개인 선택은 본인 me.ballot 에만 — 바꾸면 본인 소켓만 받고, 마감 뒤 points 는 모두에게 같다", async () => {
    const g = await threeAliveGame();
    await toPointWindow(g);
    const start = g.socks.map((s) => mark(s));

    const first = await framesDuring(g, () => {
      pointAs(g.socks[0]!, 2);
      pointAs(g.socks[1]!, 2);
    });
    // 좌석 2(던지지 않음)·좌석 3(유령)의 프레임: voted 만 있고 대상이 없다
    for (const idx of [2, 3]) {
      const text = JSON.stringify(first[idx]);
      expect(text).toContain('"voted":[0,1]');
      expect(text).not.toContain('"target"');
      expect(text).not.toContain("showdownPick");
      expect(text).not.toContain('"ballot"');
    }
    expect(JSON.stringify(first[0])).toContain('"ballot":2');
    expect(JSON.stringify(first[1])).toContain('"ballot":2');
    expect(lastViewOf(g.socks[2]!).me.ballot).toBeUndefined();

    // 같은 값을 다시 보내면 프레임이 없고, 바꾸면 본인 소켓만 새 state 를 받는다(타이밍으로 샌다는 일이 없다)
    const repeat = await framesDuring(g, () => pointAs(g.socks[0]!, 2));
    expect(repeat.map((f) => f.length)).toEqual([0, 0, 0, 0]);
    const change = await framesDuring(g, () => pointAs(g.socks[0]!, 1));
    expect(change.map((f) => f.filter((m) => m.t === "state").length)).toEqual([1, 0, 0, 0]);
    expect(lastViewOf(g.socks[0]!).me.ballot).toBe(1);
    expect((await storedRoom(g.code)).players.find((p) => (p as unknown as { seat: number }).seat === 0)!.showdownPick).toBe(1);

    // 마지막 한 표 → 공개: 모두에게 같은 points
    pointAs(g.socks[2]!, 0);
    await settle(g.socks[2]!, mark(g.socks[2]!));
    const reveal = await stepViews(g);
    const points = JSON.stringify([{ seat: 0, target: 1 }, { seat: 1, target: 2 }, { seat: 2, target: 0 }]);
    expect(same(reveal, (v) => v.day?.showdown?.points)).toBe(points);
    // 지목 창이 열린 뒤 받은 프레임 어디에도 서버 전용 이름이 없다
    for (const [i, sock] of g.socks.entries()) {
      const text = framesOf(sock).slice(start[i]!).map((m) => JSON.stringify(m)).join("");
      expect(text).not.toContain("showdownPick");
    }
  }, 60_000);
});

describe("마지막 3인 — 거절 표 (결정 0066-5)", () => {
  it("지목 단계가 아닐 때 point → WRONG_PHASE, 자기 자신·죽은 대상·없는 좌석·유령 → BAD_MESSAGE — 보낸 소켓에만 [error, state]이고 저장된 선택은 불변", async () => {
    const g = await threeAliveGame();
    await stepViews(g); // 모이기 → 차례 0
    const early = await framesDuring(g, () => pointAs(g.socks[0]!, 1));
    expect(summary(early[0]!)).toBe("[error:WRONG_PHASE,state:showdown]");
    expect(early.slice(1).map((f) => f.length)).toEqual([0, 0, 0]);

    await toPointWindow(g);
    const rejects: Array<[string, () => void, number, string]> = [
      ["자기 자신", () => pointAs(g.socks[0]!, 0), 0, "BAD_MESSAGE"],
      ["죽은 대상", () => pointAs(g.socks[0]!, 3), 0, "BAD_MESSAGE"],
      ["없는 좌석", () => pointAs(g.socks[0]!, 5), 0, "BAD_MESSAGE"],
      ["유령", () => pointAs(g.socks[3]!, 1), 3, "BAD_MESSAGE"],
    ];
    for (const [label, act, who, code] of rejects) {
      const frames = await framesDuring(g, act);
      expect(`${label}:${summary(frames[who]!)}`).toBe(`${label}:[error:${code},state:showdown]`);
      expect(`${label}:${frames.filter((_, i) => i !== who).map((f) => f.length).join(",")}`).toBe(`${label}:0,0,0`);
    }
    expect((await storedRoom(g.code)).players.some((p) => p.showdownPick !== undefined)).toBe(false);

    // 지목 창이 닫힌 뒤(공개)도 WRONG_PHASE
    await stepViews(g);
    const late = await framesDuring(g, () => pointAs(g.socks[0]!, 1));
    expect(summary(late[0]!)).toBe("[error:WRONG_PHASE,state:showdown]");
    expect((await storedRoom(g.code)).players.some((p) => p.showdownPick !== undefined)).toBe(false);
  }, 60_000);
});

describe("마지막 3인 — 재접속 (결정 0066-5)", () => {
  it("한마디가 확정된 뒤 다시 들어온 소켓의 첫 state 가 현재 day.showdown(한마디 포함)을 싣는다", async () => {
    const g = await threeAliveGame();
    await stepViews(g);
    await stepViews(g); // 차례 0
    await framesDuring(g, () => chatSend(g.socks[0]!, "저는 아니에요"));
    const back = await hello(await connect(g.code), g.actors.find((a) => a.seat === 1)!.token);
    expect(back.view.phase).toBe("showdown");
    expect(back.view.day?.showdown).toMatchObject({ i: 0, word: "저는 아니에요" });
  }, 60_000);

  it("지목 창에서 다시 들어온 소켓의 첫 state 가 voted 와 본인 me.ballot 을 싣는다 — 던지지 않은 사람은 키가 없다", async () => {
    const g = await threeAliveGame();
    await toPointWindow(g);
    pointAs(g.socks[0]!, 2);
    await settle(g.socks[0]!, mark(g.socks[0]!));
    const voter = await hello(await connect(g.code), g.actors.find((a) => a.seat === 0)!.token);
    expect(voter.view.me.ballot).toBe(2);
    expect(voter.view.day?.showdown?.voted).toEqual([0]);
    const other = await hello(await connect(g.code), g.actors.find((a) => a.seat === 2)!.token);
    expect(Object.hasOwn(other.view.me, "ballot")).toBe(false);
    expect(other.view.day?.showdown?.voted).toEqual([0]);
  }, 60_000);
});

/** 한 소켓이 from 이후 받은 world.move 의 (좌석 -> 마지막 끝점 'x,z'). */
function movesSince(sock: Game["socks"][number], from: number): Map<number, string> {
  const out = new Map<number, string>();
  for (const m of worldFramesOf(sock, from)) if (m.k === "move") out.set(m.s, `${m.p[m.p.length - 2]},${m.p[m.p.length - 1]}`);
  return out;
}

describe("마지막 3인 — 모이기 배치 (결정 0066-5, 09.1.1-07)", () => {
  it("3명 낮 진입 직후 산 세 사람의 world move 가 방 전원에게 가고 끝점이 ringSlots(3) 다; 키는 '{일차}:showdown'", async () => {
    const g = await threeAliveGame();
    const marks = g.socks.map((sock) => mark(sock));
    await closePhase(g.code); // 낮 시작 발표 → 모이기
    for (const sock of g.socks) await settle(sock, mark(sock));
    expect((await storedRoom(g.code)).phase).toBe("showdown");
    const triangle = ringSlots(3).map(([x, z]) => `${x},${z}`).sort().join("|");
    for (const [i, sock] of g.socks.entries()) {
      const moves = movesSince(sock, marks[i]!);
      expect(`${i}/${[...moves.keys()].sort().join(",")}`).toBe(`${i}/0,1,2`);
      expect(`${i}/${[...moves.values()].sort().join("|")}`).toBe(`${i}/${triangle}`);
    }
    expect((await layOf(g.code)).key).toMatch(/^\d+:showdown$/);
  }, 60_000);

  it("처형으로 이어져도 같은 자리를 쓴다: 처형 단계 전환에 새 move 프레임이 없다 (키 '{일차}:exec')", async () => {
    const g = await threeAliveGame();
    await stepViews(g);
    const marks = g.socks.map((sock) => mark(sock));
    await showdownAll(g.code, g.actors, { points: { 0: 1, 2: 1 } });
    for (const sock of g.socks) await settle(sock, mark(sock));
    expect((await storedRoom(g.code)).phase).toBe("execution");
    expect(g.socks.map((s, i) => movesSince(s, marks[i]!).size).join(",")).toBe(g.socks.map(() => "0").join(","));
    expect((await layOf(g.code)).key).toMatch(/^\d+:exec$/);
  }, 90_000);
});
