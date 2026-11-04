// 동점 결선의 서버 층 DO 시험(09.1.1-04, POL-04, 결정 0066-4, L20).
// 지목 집계에서 최다 득표가 정확히 둘이면 runoff(앞머리 1초 → 투표 5초 → 결과 1.5초) 로 가고, 후보가 아닌 산 사람이 point 로 둘 중 하나를 고른다.
import { describe, expect, it } from "vitest";
import type { RoleId, RoomView, ServerMessage } from "../../shared/protocol";
import { RUNOFF_END_MS, RUNOFF_INTRO_MS, RUNOFF_VOTE_MS } from "../../shared/game/phases";
import {
  closePhase, connect, editRoom, forceDue, framesOf, hello, killSeats, lastViewOf, mapPlayers, mark, nextFrame, pointAll, runoffAll, send, settle, startedGame, storedRoom,
} from "./helpers";
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

const CAND_A = 0;
const CAND_B = 1;

/** 동점 지목을 걸어 runoff 앞머리까지, closePhase 한 번 더 해 투표 창(step 1)까지 끌고 간 판. stopAt 0 이면 앞머리에서 멈춘다. */
async function toRunoff(stopAt: 0 | 1 | 2, assign?: readonly RoleId[]): Promise<Game> {
  const g = await startedGame("nomination");
  if (assign !== undefined) {
    await editRoom(g.code, (room) => mapPlayers(room, (p) => ({ ...p, role: assign[p.seat as number] })));
    for (const sock of g.socks) await settle(sock, mark(sock));
  }
  await pointAll(g.code, g.actors, TIE_POINTS);
  for (const sock of g.socks) await settle(sock, mark(sock));
  if (stopAt >= 1) {
    await closePhase(g.code);
    await untilRunoffStep(g, 1);
  }
  if (stopAt >= 2) {
    await closePhase(g.code);
    await untilRunoffStep(g, 2);
  }
  return g;
}

const stateViews = (msgs: ServerMessage[]): RoomView[] =>
  msgs.filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state").map((m) => m.view);
const seatOf = (g: Game, seat: number): Game["actors"][number] => g.actors.find((a) => a.seat === seat)!;
const idxOf = (g: Game, seat: number): number => g.actors.findIndex((a) => a.seat === seat);

describe("거절 표 — 보낸 소켓에만 [error, state] (결정 0066-4, T-09.1.1-11)", () => {
  /** sender 가 point 를 보내면 sender 는 [error:code, state:runoff] 만, 나머지는 0프레임이고 저장된 runoffVote 는 그대로다. */
  async function expectRejected(g: Game, seat: number, target: number, code: string, label: string): Promise<void> {
    const marks = g.socks.map((sock) => mark(sock));
    send(seatOf(g, seat).sock, { t: "point", target });
    const frames = await Promise.all(g.socks.map((sock, i) => settle(sock, marks[i]!)));
    const mine = frames[idxOf(g, seat)]!;
    expect(`${label}/${mine.map((m) => (m.t === "error" ? `error:${m.code}` : m.t)).join(",")}`).toBe(`${label}/error:${code},state`);
    frames.forEach((f, i) => {
      if (i !== idxOf(g, seat)) expect(`${label}/${f.length}`).toBe(`${label}/0`);
    });
    expect((await storedRoom(g.code)).players.filter((p) => p.runoffVote !== undefined).length).toBe(0);
  }

  it("앞머리(step 0)·결과(step 2)·마감 뒤는 WRONG_PHASE, 후보 본인·후보 아닌 대상·유령은 BAD_MESSAGE", async () => {
    const g = await toRunoff(0);
    await expectRejected(g, 2, CAND_A, "WRONG_PHASE", "step0");
    await closePhase(g.code);
    await untilRunoffStep(g, 1);
    await expectRejected(g, CAND_A, CAND_B, "BAD_MESSAGE", "후보 본인(A)");
    await expectRejected(g, CAND_B, CAND_A, "BAD_MESSAGE", "후보 본인(B)");
    await expectRejected(g, 2, 2, "BAD_MESSAGE", "후보 아닌 대상(자기)");
    await expectRejected(g, 2, 4, "BAD_MESSAGE", "후보 아닌 대상(남)");
    await killSeats(g, [5]);
    for (const sock of g.socks) await settle(sock, mark(sock));
    await expectRejected(g, 5, CAND_A, "BAD_MESSAGE", "유령");
    // 투표 창 마감 직후(알람이 돌기 전) — 서버 시각 기준이라 늦은 표는 거절
    // (깨어나는 순간 서버가 마감을 먼저 따라잡을 수 있어 프레임 수는 단언하지 않는다 — 표가 거절되고 저장되지 않는 것만 본다. 창 경계 now < phaseEndsAt 은 단위 시험이 고정한다.)
    await forceDue(g.code, "phaseEndsAt");
    const lateMarks = g.socks.map((sock) => mark(sock));
    send(seatOf(g, 3).sock, { t: "point", target: CAND_A });
    const late = await settle(seatOf(g, 3).sock, lateMarks[idxOf(g, 3)]!);
    expect(late.some((m) => m.t === "error" && m.code === "WRONG_PHASE")).toBe(true);
    expect((await storedRoom(g.code)).players.filter((p) => p.runoffVote !== undefined).length).toBe(0);
    if ((await storedRoom(g.code)).runoff?.step === 1) await closePhase(g.code);
    expect((await storedRoom(g.code)).runoff?.step).toBe(2);
    for (const sock of g.socks) await settle(sock, mark(sock));
    await expectRejected(g, 3, CAND_A, "WRONG_PHASE", "step2");
  }, 90_000);
});

describe("L20 — 결선 마감 전 비공개 (결정 0066-4, T-09.1.1-10)", () => {
  it("첫 표는 모두에게 voted 만 바꾸고, 바꾸기는 본인 소켓에만 가며, 마감 전 어느 소켓도 득표 수·남의 선택을 받지 않는다; 마감 뒤 tally 는 모두 같다", async () => {
    const g = await toRunoff(1);
    const watchers = [4, 5].map((seat) => seatOf(g, seat));
    const start = g.socks.map((sock) => mark(sock));
    // 좌석 2: A, 좌석 3: B
    const m1 = g.socks.map((sock) => mark(sock));
    send(seatOf(g, 2).sock, { t: "point", target: CAND_A });
    const f1 = await Promise.all(g.socks.map((sock, i) => settle(sock, m1[i]!)));
    f1.forEach((f) => expect(f.filter((m) => m.t === "state").length).toBe(1));
    expect(stateViews(f1[idxOf(g, 4)]!)[0]!.day!.runoff!.voted).toEqual([2]);
    send(seatOf(g, 3).sock, { t: "point", target: CAND_B });
    await Promise.all(g.socks.map((sock, i) => settle(sock, m1[i]!)));
    // 좌석 2 가 마음을 바꾼다 — 본인에게만 state 한 번, 나머지는 0프레임
    const m2 = g.socks.map((sock) => mark(sock));
    send(seatOf(g, 2).sock, { t: "point", target: CAND_B });
    const f2 = await Promise.all(g.socks.map((sock, i) => settle(sock, m2[i]!)));
    f2.forEach((f, i) => {
      if (i === idxOf(g, 2)) {
        expect(f.map((m) => m.t).join(",")).toBe("state");
        expect(stateViews(f)[0]!.me.ballot).toBe(CAND_B);
      } else {
        expect(f.length).toBe(0);
      }
    });
    // 같은 값을 다시 보내면 프레임 0
    const m3 = g.socks.map((sock) => mark(sock));
    send(seatOf(g, 2).sock, { t: "point", target: CAND_B });
    const f3 = await Promise.all(g.socks.map((sock, i) => settle(sock, m3[i]!)));
    f3.forEach((f) => expect(f.length).toBe(0));

    // 구경하는 소켓(4·5, 던지지 않음)이 투표 창 동안 받은 모든 프레임
    for (const w of watchers) {
      const frames = framesOf(w.sock).slice(start[idxOf(g, w.seat)]!);
      const raw = JSON.stringify(frames);
      expect(raw.includes("tally")).toBe(false);
      expect(raw.includes("runoffVote")).toBe(false);
      expect(raw.includes("ballot")).toBe(false);
      for (const v of stateViews(frames)) {
        expect(v.phase).toBe("runoff");
        expect(Object.keys(v.day!.runoff!).sort().join(",")).toBe("cand,step,voted");
        expect(Object.hasOwn(v.me, "ballot")).toBe(false);
      }
    }

    // 마감: 모든 소켓이 같은 tally 를 받는다 (B 2표 / A 0표 → [0,2])
    await closePhase(g.code);
    const result = await untilRunoffStep(g, 2);
    expect(new Set(result.map((v) => JSON.stringify(v.day!.runoff))).size).toBe(1);
    expect(JSON.stringify(result[0]!.day!.runoff)).toBe(JSON.stringify({ cand: [CAND_A, CAND_B], step: 2, tally: [0, 2] }));
    // 후보·미투표자는 여전히 me.ballot 이 없고, 던진 사람만 자기 값을 본다
    expect(result[idxOf(g, 2)]!.me.ballot).toBe(CAND_B);
    expect(result[idxOf(g, 3)]!.me.ballot).toBe(CAND_B);
    for (const seat of [CAND_A, CAND_B, 4, 5]) expect(Object.hasOwn(result[idxOf(g, seat)]!.me, "ballot")).toBe(false);
  }, 90_000);

  it("재접속(hello): 투표 창 중에 다시 붙은 유권자는 자기 me.ballot 과 공개 voted 를 첫 state 에서 받는다", async () => {
    const g = await toRunoff(1);
    const voter = seatOf(g, 2);
    const marks = g.socks.map((sock) => mark(sock));
    send(voter.sock, { t: "point", target: CAND_A });
    await Promise.all(g.socks.map((sock, i) => settle(sock, marks[i]!)));
    const fresh = await connect(g.code);
    const first = await hello(fresh, voter.token);
    expect(first.view.phase).toBe("runoff");
    expect(first.view.me.ballot).toBe(CAND_A);
    expect(first.view.day!.runoff!.voted).toEqual([2]);
    // 던지지 않은 사람이 다시 붙으면 키가 없다
    const other = await connect(g.code);
    const otherFirst = await hello(other, seatOf(g, 4).token);
    expect(Object.hasOwn(otherFirst.view.me, "ballot")).toBe(false);
    expect(otherFirst.view.day!.runoff!.voted).toEqual([2]);
  }, 90_000);

  it("메타모픽: 같은 대본·다른 역할 배정 두 판의 결선 프레임 열(me 제외)이 같다 — 후보·단계는 공개 득표에서만 정해진다", async () => {
    const rolesA: RoleId[] = ["mafia", "mafia", "police", "doctor", "citizen", "citizen"];
    const rolesB: RoleId[] = ["citizen", "police", "mafia", "citizen", "mafia", "doctor"];
    const columns: string[][] = [];
    for (const assign of [rolesA, rolesB]) {
      const g = await toRunoff(0, assign);
      const start = g.socks.map((sock) => mark(sock));
      await runoffAll(g.code, g.actors, { 2: CAND_A, 3: CAND_B, 4: CAND_A });
      columns.push(
        [4, 5].map((seat) => {
          const frames = framesOf(seatOf(g, seat).sock).slice(start[idxOf(g, seat)]!);
          return stateViews(frames)
            .map((v) => {
              const { me: _me, code: _code, serverNow: _now, phaseEndsAt: _ends, ...rest } = v;
              return JSON.stringify(rest);
            })
            .join("|");
        }),
      );
    }
    expect(columns[0]!.join("#")).toBe(columns[1]!.join("#"));
    expect(columns[0]![0]!.includes("defense")).toBe(true);
  }, 120_000);
});
