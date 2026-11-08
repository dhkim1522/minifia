// 15페이즈 D-05·D-06 워커 통합(결정 0074): 밤 고르기는 모든 역할이 같은 입력에 같은 응답을 받고, 밤에는 아무도 걷지 않으며,
// 피해자가 나온 아침에만 모든 소켓에 같은 흔적 조각 id 가 실린다(T-15-10·11·12).
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { MORNING_MS, MORNING_TRACE_MS, MORNING_VICTIM_MS } from "../../shared/game/phases";
import { restSegment } from "../../shared/game/world";
import type { Segment, WorldState } from "../../shared/game/world";
import { PLACE_IDS, TRACE_PIECE_IDS } from "../../shared/protocol";
import type { RoleId } from "../../shared/protocol";
import { advanceTo, editRoom, writeRoomEdit, flushWorld, killSeats, lastViewOf, mapPlayers, mark, moveAs, pickAs, settle, storedRoom, summary, startedGame, withRole, worldFramesOf, worldOf } from "./helpers";
import type { Game } from "./helpers";

type Actor = Game["actors"][number];

const ROLES: readonly RoleId[] = ["mafia", "police", "doctor", "citizen"];

/** 역할마다 한 사람씩(시민은 둘째 시민을 쓰지 않는다 — 대상으로 첫 시민을 따로 쓰므로 모두 서로 다른 사람). */
function onePerRole(g: Game): Record<string, Actor> {
  return {
    mafia: withRole(g, "mafia")[0]!,
    police: withRole(g, "police")[0]!,
    doctor: withRole(g, "doctor")[0]!,
    citizen: withRole(g, "citizen")[1]!,
  };
}

/** 보낸 소켓이 받은 프레임을 한 줄로. */
async function send1(g: Game, a: Actor, target: unknown): Promise<string> {
  const from = mark(a.sock);
  a.sock.ws.send(JSON.stringify({ t: "pick", target }));
  return summary(await settle(a.sock, from));
}

/** 저장된 방에서 좌석별 nightPick. */
async function storedPicks(code: string): Promise<Record<number, number | undefined>> {
  const players = (await storedRoom(code)).players as Array<{ seat: number; nightPick?: number }>;
  return Object.fromEntries(players.map((p) => [p.seat, p.nightPick]));
}

describe("밤 고르기 — 모든 역할이 같은 입력에 같은 응답 (D-05, T-15-10)", () => {
  it("마피아·경찰·의사·시민이 같은 산 대상과 자기 자신을 고르면 보낸 소켓이 받는 프레임이 역할과 무관하게 같고 저장된다", async () => {
    const g = await startedGame("night");
    const target = withRole(g, "citizen")[0]!;
    const who = onePerRole(g);
    const toTarget: string[] = [];
    for (const role of ROLES) toTarget.push(await send1(g, who[role]!, target.seat));
    expect(toTarget.join("|")).toBe(Array(4).fill("[state:night]").join("|"));
    const toSelf: string[] = [];
    for (const role of ROLES) toSelf.push(await send1(g, who[role]!, who[role]!.seat));
    expect(toSelf.join("|")).toBe(Array(4).fill("[state:night]").join("|"));
    // 마지막 선택(자기 자신)이 모두 저장돼 있다 — 시민도 같다.
    const stored = await storedPicks(g.code);
    for (const role of ROLES) expect(`${role}:${stored[who[role]!.seat]}`).toBe(`${role}:${who[role]!.seat}`);
  }, 40_000);

  it("마피아가 동료를 골라도 같은 응답으로 저장된다(효과는 판정이 거른다)", async () => {
    const g = await startedGame("night");
    const [m1, m2] = withRole(g, "mafia") as [Actor, Actor];
    expect(await send1(g, m1, m2.seat)).toBe("[state:night]");
    expect((await storedPicks(g.code))[m1.seat]).toBe(m2.seat);
  }, 40_000);

  it("죽은 대상·앉지 않은 seat·정수 아닌 값은 모든 역할이 같은 BAD_MESSAGE 열을 받는다", async () => {
    const g = await startedGame("night");
    const dead = withRole(g, "citizen")[0]!;
    await killSeats(g, [dead.seat]);
    const who = onePerRole(g);
    for (const bad of [dead.seat, 9, 1.5, "1"]) {
      const rows = new Set<string>();
      for (const role of ROLES) rows.add(await send1(g, who[role]!, bad));
      expect(`${String(bad)}:${[...rows].join("/")}`).toBe(`${String(bad)}:${[...rows][0]}`);
      expect([...rows][0]!.includes("error:BAD_MESSAGE")).toBe(true);
    }
  }, 40_000);

  it("시민의 선택은 저장되지만 판정을 바꾸지 않는다: 마피아 전원이 고른 대상이 탈락하고 시민이 마피아를 골라도 아무 일 없다", async () => {
    const g = await startedGame("night");
    const mafias = withRole(g, "mafia");
    const [c1, c2] = withRole(g, "citizen") as [Actor, Actor];
    for (const m of mafias) pickAs(m, c1.seat);
    pickAs(c2, mafias[0]!.seat); // 시민이 마피아를 고른다 — 효과 없음
    pickAs(c1, c1.seat);
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    await advanceTo(g.code, g.socks, "morning");
    const stored = await storedRoom(g.code);
    const dead = (stored.players as Array<{ seat: number; alive?: boolean }>).filter((p) => p.alive === false).map((p) => p.seat);
    expect(dead.join(",")).toBe(String(c1.seat));
    expect(lastViewOf(c2.sock).day?.morning?.eliminated).toBe(c1.seat);
  }, 40_000);

  it("시민만 마피아를 고르고 마피아가 아무도 안 고르면 아무도 탈락하지 않는다", async () => {
    const g = await startedGame("night");
    const mafia = withRole(g, "mafia")[0]!;
    for (const c of withRole(g, "citizen")) pickAs(c, mafia.seat);
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    await advanceTo(g.code, g.socks, "morning");
    const stored = await storedRoom(g.code);
    expect((stored.players as Array<{ alive?: boolean }>).every((p) => p.alive !== false)).toBe(true);
    expect(JSON.stringify(lastViewOf(g.socks[0]!).day?.morning)).toBe("{}");
  }, 40_000);
});

describe("밤 위치 — 아무도 걷지 않는다 (D-05, T-15-11)", () => {
  it("산 마피아가 move 를 보내도 어떤 소켓도 world 프레임을 받지 않고 저장 위치가 안 바뀐다", async () => {
    const g = await startedGame("night");
    await flushWorld(g.code);
    const before = JSON.stringify((await worldOf(g.code))?.segs);
    const marks = g.socks.map((s) => mark(s));
    for (const m of withRole(g, "mafia")) moveAs(m, 300, 100);
    for (const c of withRole(g, "citizen")) moveAs(c, -300, 100);
    const got = await Promise.all(g.actors.map((a, i) => settle(a.sock, marks[i]!)));
    expect(got.map((frames, i) => `${i}:${worldFramesOf(g.socks[i]!, marks[i]!).length}:${frames.some((f) => f.t === "world")}`).join(",")).toBe(
      g.socks.map((_, i) => `${i}:0:false`).join(","),
    );
    await flushWorld(g.code);
    expect(JSON.stringify((await worldOf(g.code))?.segs)).toBe(before);
  }, 40_000);

  it("탈락자(유령)의 걸음은 기존대로 유령에게만 간다", async () => {
    const g = await startedGame("night");
    const ghost = withRole(g, "citizen")[0]!;
    await killSeats(g, [ghost.seat]);
    const marks = g.socks.map((s) => mark(s));
    moveAs(ghost, 200, 200);
    await Promise.all(g.actors.map((a, i) => settle(a.sock, marks[i]!)));
    for (let i = 0; i < g.socks.length; i += 1) {
      if (g.actors[i]!.seat === ghost.seat) continue;
      expect(`${i}:${worldFramesOf(g.socks[i]!, marks[i]!).length}`).toBe(`${i}:0`);
    }
  }, 40_000);
});

describe("아침 흔적 (D-06, T-15-12)", () => {
  /** 마피아 둘이 시민 X 를 고르고(필요하면 시민 Y 도 X 를 고르고) 아침으로 넘긴다. */
  async function assassinate(g: Game, extra: Actor[] = []): Promise<Actor> {
    const mafias = withRole(g, "mafia");
    const x = withRole(g, "citizen")[0]!;
    for (const m of mafias) pickAs(m, x.seat);
    for (const e of extra) pickAs(e, x.seat);
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    await advanceTo(g.code, g.socks, "morning");
    return x;
  }

  it("암살 성공: 모든 소켓(마피아·시민·유령)의 day.morning 이 같은 {eliminated, trace} 이고 trace 는 닫힌 집합 안의 조각 id 하나다", async () => {
    const g = await startedGame("night");
    const x = await assassinate(g, [withRole(g, "citizen")[1]!]);
    const mornings = g.socks.map((s) => lastViewOf(s).day?.morning);
    expect(new Set(mornings.map((m) => JSON.stringify(m))).size).toBe(1);
    const m = mornings[0]!;
    expect(Object.keys(m).sort().join(",")).toBe("eliminated,trace");
    expect(m.eliminated).toBe(x.seat);
    expect((TRACE_PIECE_IDS as readonly string[]).includes(String(m.trace))).toBe(true);
    // 아무 프레임에도 풀(누가 골랐는지)·look 이 없다
    for (const s of g.socks) {
      const text = s.frames.slice(-3).join("");
      expect(/"pool"|"traceBy"/.test(text)).toBe(false);
    }
  }, 40_000);

  it("풀이 마피아뿐이면 그 마피아 의상의 조각이다 — 의상은 꾸미기 값이고 조각은 의상의 함수다", async () => {
    const g = await startedGame("night");
    await editRoom(g.code, (room) => mapPlayers(room, (p) => ((g.actors.find((a) => a.seat === p.seat)?.role === "mafia") ? { ...p, look: "noir" } : p)));
    for (const sock of g.socks) await settle(sock, mark(sock));
    await assassinate(g);
    expect(lastViewOf(g.socks[0]!).day?.morning?.trace).toBe("redCloth");
  }, 40_000);

  it("아침 길이는 흔적이 있으면 기본 + 탈락 + 3초다(phaseDurationMs)", async () => {
    const g = await startedGame("night");
    await assassinate(g);
    expect(lastViewOf(g.socks[0]!).phaseDurationMs).toBe(MORNING_MS + MORNING_VICTIM_MS + MORNING_TRACE_MS);
  }, 40_000);

  it("구출: 의사가 확정 대상을 지키면 morning 에 saved 만 있고 trace 키가 없으며 아침은 기본 길이다", async () => {
    const g = await startedGame("night");
    const x = withRole(g, "citizen")[0]!;
    for (const m of withRole(g, "mafia")) pickAs(m, x.seat);
    pickAs(withRole(g, "doctor")[0]!, x.seat);
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    await advanceTo(g.code, g.socks, "morning");
    for (const s of g.socks) expect(JSON.stringify(lastViewOf(s).day?.morning)).toBe('{"saved":true}');
    expect(lastViewOf(g.socks[0]!).phaseDurationMs).toBe(MORNING_MS);
  }, 40_000);

  it("무효 밤: 마피아가 갈려 아무도 안 죽으면 morning 이 {} 이고 trace 가 없다", async () => {
    const g = await startedGame("night");
    const [m1, m2] = withRole(g, "mafia") as [Actor, Actor];
    const [c1, c2] = withRole(g, "citizen") as [Actor, Actor];
    pickAs(m1, c1.seat);
    pickAs(m2, c2.seat);
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    await advanceTo(g.code, g.socks, "morning");
    for (const s of g.socks) expect(JSON.stringify(lastViewOf(s).day?.morning)).toBe("{}");
  }, 40_000);

  it("아침 전환 뒤 서버 상태에 nightPick 이 남지 않는다", async () => {
    const g = await startedGame("night");
    await assassinate(g, [withRole(g, "citizen")[1]!]);
    const players = (await storedRoom(g.code)).players as Array<Record<string, unknown>>;
    expect(players.some((p) => "nightPick" in p)).toBe(false);
  }, 40_000);
});

// ---- 16페이즈 D-10·A2: 심부름 중 피해자 곁에 있던 마지막 사람이 아침 증거로 공개된다 ----
const GLASS = { x: -390, z: -220 }; // 재즈 바 glass 장소 중앙(errandNear.test 와 같은 값)
const SPOTS = { near: { x: -370, z: -220 }, far: { x: 520, z: 500 }, far2: { x: 520, z: -60 }, far3: { x: -40, z: 260 }, far4: { x: -60, z: -560 } };

/** 메모리의 world 에 좌석별 위치(서 있는 한 점)를 쓴다(evict 없이). */
async function placeSeats(code: string, bySeat: Record<number, { x: number; z: number }>): Promise<void> {
  const players = (await storedRoom(code)).players as Array<{ id: string; seat: number }>;
  const segs: Record<string, Segment> = {};
  for (const [seatNo, pos] of Object.entries(bySeat)) segs[players.find((p) => p.seat === Number(seatNo))!.id] = restSegment(pos.x, pos.z, Date.now());
  await runInDurableObject(env.ROOM.getByName(code), (instance) => {
    const holder = instance as unknown as { world: WorldState };
    holder.world = { ...holder.world, segs: { ...holder.world.segs, ...segs } };
  });
}

/** 표본 알람 한 번(errandTickAt 을 과거로 당기고 evict 없이 돌린다). */
async function tickNow(code: string): Promise<void> {
  const stub = env.ROOM.getByName(code);
  await writeRoomEdit(stub, (room) => ({ ...room, errandTickAt: Date.now() - 1 }));
  await runDurableObjectAlarm(stub);
}

describe("마지막 목격 (D-10, A2)", () => {
  /** errand 에서 위치를 정하고 표본 한 번 → 밤으로 넘겨 마피아 전원이 V 를 고르고 → 아침. 위치는 좌석 번호로 준다. */
  async function lastSeenMorning(g: Game, v: Actor, spots: Record<number, { x: number; z: number }>): Promise<void> {
    await placeSeats(g.code, spots);
    await tickNow(g.code);
    for (const s of g.socks) await settle(s, mark(s));
    await advanceTo(g.code, g.socks, "night");
    for (const m of withRole(g, "mafia")) pickAs(m, v.seat);
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    await advanceTo(g.code, g.socks, "morning");
  }
  /** 위치 배정: V 는 glass 곁, 관찰자 O 는 반경 안, 나머지는 서로 멀리. */
  function spreadWith(g: Game, v: Actor, o: Actor | null): Record<number, { x: number; z: number }> {
    const rest = g.actors.filter((a) => a.seat !== v.seat && a.seat !== o?.seat);
    const far = [SPOTS.far, SPOTS.far2, SPOTS.far3, SPOTS.far4, { x: 300, z: 560 }];
    const out: Record<number, { x: number; z: number }> = { [v.seat]: GLASS };
    if (o !== null) out[o.seat] = SPOTS.near;
    rest.forEach((a, i) => (out[a.seat] = far[i]!));
    return out;
  }

  it("표본이 V 줄 {seat, by, place} 를 errandLast 에 저장하고, 아침에 모든 소켓의 day.evidence 가 같은 {trace, seen} 이며 errandLast 는 지워진다", async () => {
    const g = await startedGame("errand");
    const v = withRole(g, "citizen")[0]!;
    const o = withRole(g, "citizen")[1]!;
    await placeSeats(g.code, spreadWith(g, v, o));
    await tickNow(g.code);
    const rows = ((await storedRoom(g.code)) as unknown as { errandLast?: Array<{ seat: number; by: number; place: string }> }).errandLast ?? [];
    const row = rows.find((r) => r.seat === v.seat);
    expect(`${row?.seat}:${row?.by}`).toBe(`${v.seat}:${o.seat}`);
    expect((PLACE_IDS as readonly string[]).includes(String(row?.place))).toBe(true);
    // 반경 밖 사람의 줄은 없다
    expect(rows.map((r) => r.seat).sort().join(",")).toBe([v.seat, o.seat].sort().join(","));

    for (const s of g.socks) await settle(s, mark(s));
    await advanceTo(g.code, g.socks, "night");
    // 밤에도 서버에는 남아 있다
    expect(((await storedRoom(g.code)) as unknown as { errandLast?: unknown }).errandLast).toBeDefined();
    for (const m of withRole(g, "mafia")) pickAs(m, v.seat);
    for (const a of g.actors) await settle(a.sock, mark(a.sock));
    await advanceTo(g.code, g.socks, "morning");

    const evidences = g.socks.map((s) => JSON.stringify(lastViewOf(s).day?.evidence));
    expect(new Set(evidences).size).toBe(1);
    const ev = lastViewOf(g.socks[0]!).day?.evidence;
    expect(ev?.seen).toEqual({ seat: o.seat, place: row!.place });
    expect(TRACE_PIECE_IDS.includes(ev!.trace!)).toBe(true);
    for (const s of g.socks) expect(JSON.stringify(lastViewOf(s).day?.morning?.seen)).toBe(JSON.stringify(ev?.seen));
    expect("errandLast" in ((await storedRoom(g.code)) as unknown as Record<string, unknown>)).toBe(false);
    for (const s of g.socks) expect(s.frames.slice(-3).join("")).not.toContain("errandLast");
  }, 60_000);

  it("목격자 없는 아침: V 곁에 아무도 없었으면 day.evidence 에 seen 키가 없고 trace 는 있다", async () => {
    const g = await startedGame("errand");
    const v = withRole(g, "citizen")[0]!;
    await lastSeenMorning(g, v, spreadWith(g, v, null));
    for (const s of g.socks) {
      const ev = lastViewOf(s).day?.evidence;
      expect(`${ev !== undefined && "seen" in ev}:${ev?.trace !== undefined}`).toBe("false:true");
      expect("seen" in (lastViewOf(s).day?.morning ?? {})).toBe(false);
    }
  }, 60_000);
});
