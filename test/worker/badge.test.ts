// 직업 주장 배지 워커 통합 테스트(09.1.1-01, 결정 0066-1): 주장은 공개 값이라 바뀌면 모든 소켓이 각자 view 를 받는다.
import { describe, expect, it } from "vitest";
import { RULESET } from "../../shared/game/ruleset";
import type { RoleId, ServerMessage } from "../../shared/protocol";
import { connect, editRoom, hello, lastViewOf, mapPlayers, mark, pause, send, settle, startedGame, stable, storedRoom, summary, toPhase } from "./helpers";
import type { Game } from "./helpers";

type State = Extract<ServerMessage, { t: "state" }>;

/** 한 사람이 badge 를 보내고 모든 소켓의 프레임을 소켓 순서대로 돌려준다(보낸 쪽 flush 가 먼저다). */
async function sendBadge(g: Game, from: Game["actors"][number], role: string): Promise<ServerMessage[][]> {
  const marks = g.actors.map((a) => mark(a.sock));
  send(from.sock, { t: "badge", role });
  const out: ServerMessage[][] = g.actors.map(() => []);
  const order = [from, ...g.actors.filter((a) => a !== from)];
  for (const a of order) out[g.actors.indexOf(a)] = await settle(a.sock, marks[g.actors.indexOf(a)]!);
  return out;
}

// 기본판(결정 0072)에서 꺼짐 — RULESET.badge 를 켜면 다시 돈다. 꺼진 상태의 거절은 basicOff.test.ts 가 본다.
describe.skipIf(!RULESET.badge)("직업 주장 — 트레이서 (결정 0066-1)", () => {
  it("토론에서 손님이 citizen 을 걸면 네 소켓이 정확히 한 프레임씩 받고 그 좌석의 players[].badge 가 citizen 이며 badgeSwapped 키는 없다", async () => {
    const g = await startedGame("discussion", 3);
    const claimer = g.actors[1]!;
    const frames = await sendBadge(g, claimer, "citizen");
    for (const f of frames) expect(summary(f)).toBe("[state:discussion]");
    for (const f of frames) {
      const row = (f[0] as State).view.players.find((p) => p.seat === claimer.seat)!;
      expect(row.badge).toBe("citizen");
      expect("badgeSwapped" in row).toBe(false);
    }
  });

  it("아무도 안 건 좌석의 players[] 에는 badge 키가 없다(undefined 로도 남기지 않는다)", async () => {
    const g = await startedGame("discussion", 3);
    const claimer = g.actors[1]!;
    await sendBadge(g, claimer, "citizen");
    const view = lastViewOf(g.actors[0]!.sock);
    for (const row of view.players) {
      if (row.seat === claimer.seat) continue;
      expect("badge" in row).toBe(false);
    }
  });

  it("같은 값을 다시 보내면 저장·전송이 없다(프레임 0)", async () => {
    const g = await startedGame("discussion", 3);
    const claimer = g.actors[1]!;
    await sendBadge(g, claimer, "citizen");
    await pause(300);
    const frames = await sendBadge(g, claimer, "citizen");
    for (const f of frames) expect(summary(f)).toBe("[]");
  });
});

// 기본판(결정 0072)에서 꺼짐 — RULESET.badge 를 켜면 다시 돈다. 꺼진 상태의 거절은 basicOff.test.ts 가 본다.
describe.skipIf(!RULESET.badge)("직업 주장 — 규칙 완성 (결정 0066-1)", () => {
  it("말 바꿈: police 를 걸었다가 mafia 로 바꾸면 모든 소켓이 mafia + badgeSwapped 를 받고 이전 값(police)은 프레임 어디에도 없다", async () => {
    const g = await startedGame("discussion", 3);
    const claimer = g.actors[1]!;
    await sendBadge(g, claimer, "police");
    await pause(300);
    const frames = await sendBadge(g, claimer, "mafia");
    for (const f of frames) {
      expect(summary(f)).toBe("[state:discussion]");
      const row = (f[0] as State).view.players.find((p) => p.seat === claimer.seat)!;
      expect(row.badge).toBe("mafia");
      expect(row.badgeSwapped).toBe(true);
      expect(JSON.stringify((f[0] as State).view.players)).not.toContain("police"); // 이전 값 — day.roles(구성표)에는 직업 이름이 원래 있다
      expect(JSON.stringify(f)).not.toContain("badgeLog");
    }
  });

  it("값을 none 으로 되돌려도 badgeSwapped 는 남고 badge 는 none 이다", async () => {
    const g = await startedGame("discussion", 3);
    const claimer = g.actors[2]!;
    await sendBadge(g, claimer, "citizen");
    await pause(300);
    const frames = await sendBadge(g, claimer, "none");
    const row = (frames[0]![0] as State).view.players.find((p) => p.seat === claimer.seat)!;
    expect(`${row.badge}|${row.badgeSwapped}`).toBe("none|true");
  });

  it("마감 뒤(defense·night·lobby)의 badge 는 보낸 소켓에만 [error:WRONG_PHASE,state] 가 가고 다른 소켓은 0프레임이며 저장은 그대로다", async () => {
    for (const phase of ["defense", "night", "lobby"] as const) {
      const g = await startedGame("discussion", 3);
      const claimer = g.actors[1]!;
      await toPhase(g.code, phase);
      for (const a of g.actors) await settle(a.sock, mark(a.sock));
      const before = JSON.stringify((await storedRoom(g.code)).players);
      const frames = await sendBadge(g, claimer, "police");
      const mine = frames[g.actors.indexOf(claimer)]!;
      expect(`${phase} ${summary(mine)}`).toBe(`${phase} [error:WRONG_PHASE,state:${phase}]`);
      const others = g.actors.filter((a) => a !== claimer).map((a) => summary(frames[g.actors.indexOf(a)]!));
      expect(`${phase} ${others.join("")}`).toBe(`${phase} ${"[]".repeat(others.length)}`);
      expect(JSON.stringify((await storedRoom(g.code)).players)).toBe(before);
    }
  });

  it("4명판에서 doctor 주장은 보낸 소켓에만 BAD_MESSAGE 이고 저장되지 않는다", async () => {
    const g = await startedGame("discussion", 3);
    const claimer = g.actors[1]!;
    const frames = await sendBadge(g, claimer, "doctor");
    expect(summary(frames[g.actors.indexOf(claimer)]!)).toBe("[error:BAD_MESSAGE,state:discussion]");
    const others = g.actors.filter((a) => a !== claimer).map((a) => summary(frames[g.actors.indexOf(a)]!));
    expect(others.join("")).toBe("[][][]");
    expect(lastViewOf(claimer.sock).players.find((p) => p.seat === claimer.seat)).not.toHaveProperty("badge");
  });

  it("유령의 badge 는 보낸 소켓에만 BAD_MESSAGE 가 가고 다른 소켓은 0프레임이다", async () => {
    const g = await startedGame("discussion", 5);
    const ghost = g.actors[1]!;
    await editRoom(g.code, (room) => mapPlayers(room, (p) => (p.seat === ghost.seat ? { ...p, alive: false } : p)));
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    const frames = await sendBadge(g, ghost, "citizen");
    expect(summary(frames[g.actors.indexOf(ghost)]!)).toBe("[error:BAD_MESSAGE,state:discussion]");
    expect(frames.filter((_, i) => g.actors[i] !== ghost).map(summary).join("")).toBe("[][][][][]");
  });

  it("재접속(hello)한 소켓의 첫 state 에 현재 모든 산 사람의 badge·badgeSwapped 가 실린다", async () => {
    const g = await startedGame("discussion", 3);
    const [, a, b] = g.actors as [Game["actors"][number], Game["actors"][number], Game["actors"][number]];
    await sendBadge(g, a, "police");
    await pause(300);
    await sendBadge(g, a, "citizen");
    await sendBadge(g, b, "mafia");
    const fresh = await connect(g.code);
    const first = await hello(fresh, g.actors[3]!.token);
    const rows = first.view.players.map((p) => `${p.seat}:${p.badge ?? "-"}:${p.badgeSwapped === true ? "swap" : "-"}`).join(",");
    const want = g.actors
      .map((x) => x.seat)
      .sort((x, y) => x - y)
      .map((seat) => (seat === a.seat ? `${seat}:citizen:swap` : seat === b.seat ? `${seat}:mafia:-` : `${seat}:-:-`))
      .join(",");
    expect(rows).toBe(want);
  });

  it("250ms 안의 두 번째 다른 값은 오류 없이 버려지고 300ms 뒤에는 받아들여진다", async () => {
    const g = await startedGame("discussion", 3);
    const claimer = g.actors[1]!;
    await sendBadge(g, claimer, "citizen");
    const fast = await sendBadge(g, claimer, "police");
    for (const f of fast) expect(summary(f)).toBe("[]");
    await pause(300);
    const slow = await sendBadge(g, claimer, "police");
    for (const f of slow) expect(summary(f)).toBe("[state:discussion]");
  });
});

// ---- L18: 직업 주장은 공개 값이고 역할의 함수가 아니다 (결정 0066-1, 0015) ----

/** 6명 판의 좌석별 역할 배정. B 는 A 에서 마피아와 시민을 맞바꾼 배정이다(경찰·의사 자리는 그대로). */
const ROLES_A: readonly RoleId[] = ["mafia", "citizen", "police", "doctor", "mafia", "citizen"];
const ROLES_B: readonly RoleId[] = ["citizen", "mafia", "police", "doctor", "citizen", "mafia"];

/** 주장 대본(좌석 → 보낼 값 순서). 좌석 2 는 doctor 를 건 뒤 police 로 바꾼다. 서버가 역할과 비교한다면 A·B 에서 결과가 갈린다. */
const SCRIPT: ReadonlyArray<{ seat: number; role: string; gapBefore?: number }> = [
  { seat: 0, role: "citizen" },
  { seat: 1, role: "mafia" },
  { seat: 2, role: "doctor" },
  { seat: 3, role: "none" },
  { seat: 2, role: "police", gapBefore: 300 },
];

/** 좌석 오름차순 소켓·역할 배정으로 방을 만들고(editRoom 으로 역할만 바꾼다) 대본을 보낸 뒤 좌석별 프레임 열(대본 시작 이후)을 돌려준다. */
async function playScript(assign: readonly RoleId[]): Promise<{ code: string; bySeat: ServerMessage[][]; g: Game }> {
  const g = await startedGame("discussion", 5);
  const seats = [...g.actors].sort((a, b) => a.seat - b.seat);
  await editRoom(g.code, (room) =>
    mapPlayers(room, (p) => ({ ...p, role: assign[p.seat as number] })),
  );
  const marks = seats.map((a) => mark(a.sock));
  for (const step of SCRIPT) {
    if (step.gapBefore !== undefined) await pause(step.gapBefore);
    const from = seats[step.seat]!;
    send(from.sock, { t: "badge", role: step.role });
    for (const a of seats) await settle(a.sock, mark(a.sock)); // 모두 이 한 걸음의 프레임을 받은 뒤 다음 걸음(보낸 쪽 처리 증거)
  }
  const bySeat: ServerMessage[][] = [];
  for (const [i, a] of seats.entries()) bySeat.push(await settle(a.sock, marks[i]!));
  return { code: g.code, bySeat, g };
}

/** 프레임에서 공개 주장 열만 남긴다(좌표·me·단계 길이 제외): players[] 의 좌석·badge·badgeSwapped. */
const claimColumn = (msgs: ServerMessage[]): string =>
  stable(
    msgs.map((m) =>
      m.t === "state"
        ? ({ t: "state", players: m.view.players.map((p) => ({ seat: p.seat, alive: p.alive, badge: p.badge, badgeSwapped: p.badgeSwapped })) } as unknown as ServerMessage)
        : m,
    ),
  );

// 기본판(결정 0072)에서 꺼짐 — RULESET.badge 를 켜면 다시 돈다. 꺼진 상태의 거절은 basicOff.test.ts 가 본다.
describe.skipIf(!RULESET.badge)("L18 — 직업 주장은 공개 값이고 역할의 함수가 아니다", () => {
  it("역할 배정만 다른 두 판 A·B 에서 같은 대본을 보내면 모든 좌석 소켓의 players[].badge·badgeSwapped 열이 같다", async () => {
    const a = await playScript(ROLES_A);
    const b = await playScript(ROLES_B);
    expect(a.bySeat.length).toBe(6);
    const diffs: string[] = [];
    for (let seatNo = 0; seatNo < 6; seatNo += 1) {
      const colA = claimColumn(a.bySeat[seatNo]!);
      const colB = claimColumn(b.bySeat[seatNo]!);
      if (colA !== colB) diffs.push(`seat${seatNo}`);
      expect(colA.length).toBeGreaterThan(0); // 비어 있는 비교가 아니다
    }
    expect(diffs.join(",")).toBe("");
    // 비교가 실제로 주장을 담고 있다: 마지막 프레임의 열
    const last = a.bySeat[0]!.filter((m): m is State => m.t === "state").at(-1)!;
    expect(last.view.players.map((p) => `${p.seat}:${p.badge ?? "-"}:${p.badgeSwapped === true ? "swap" : "-"}`).join(",")).toBe(
      "0:citizen:-,1:mafia:-,2:police:swap,3:-:-,4:-:-,5:-:-",
    );
  });

  it("실제 시민의 mafia 주장도, 실제 마피아의 citizen·doctor 주장도 모두 수락된다(서버는 역할과 비교하지 않는다)", async () => {
    for (const assign of [ROLES_A, ROLES_B]) {
      const run = await playScript(assign);
      const room = await storedRoom(run.code);
      const stored = room.players as unknown as Array<{ seat: number; role: string; badge?: string }>;
      for (const step of SCRIPT) expect(`${step.seat}:${assign[step.seat]}`).toBe(`${step.seat}:${stored.find((p) => p.seat === step.seat)!.role}`);
      const errors = run.bySeat.flat().filter((m) => m.t === "error");
      expect(errors).toEqual([]);
      const claimed = Object.fromEntries(stored.filter((p) => p.badge !== undefined).map((p) => [p.seat, p.badge]));
      expect(JSON.stringify(claimed)).toBe(JSON.stringify({ 0: "citizen", 1: "mafia", 2: "police" }));
    }
    // 두 배정에서 좌석 0·1 은 서로 진실·거짓이 뒤바뀐다 — 그래도 둘 다 수락됐다
    expect(`${ROLES_A[0]}/${ROLES_A[1]} ${ROLES_B[0]}/${ROLES_B[1]}`).toBe("mafia/citizen citizen/mafia");
  });

  it("전수: 주장·말 바꿈 동안 모든 소켓의 모든 프레임에 badgeLog 키가 없고, 이전 값(doctor)은 말 바꿈 뒤 players[] 어느 경로에도 없다", async () => {
    const run = await playScript(ROLES_A);
    const swapAt = (msgs: ServerMessage[]): number =>
      msgs.findIndex((m) => m.t === "state" && m.view.players.some((p) => p.badgeSwapped === true));
    let checked = 0;
    for (const msgs of run.bySeat) {
      expect(JSON.stringify(msgs)).not.toContain("badgeLog");
      const at = swapAt(msgs);
      expect(at).toBeGreaterThanOrEqual(0);
      for (const m of msgs.slice(at)) {
        if (m.t !== "state") continue;
        expect(JSON.stringify(m.view.players)).not.toContain("doctor"); // 말 바꿈 뒤에는 새 값만, 이전 값 doctor 는 어디에도 없다
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
    // 말 바꿈 전에는 그 값(doctor)이 그 사람 줄에 보였다 — 공개 값이라 숨기지 않는다
    const early = run.bySeat[0]!.filter((m): m is State => m.t === "state").map((m) => m.view.players[2]!.badge);
    expect(early).toContain("doctor");
  });
});
