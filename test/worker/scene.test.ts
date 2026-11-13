// 아침 현장 조사 워커 통합 시험 (21-06 Task 2, D-13·D-16·D-17·D-21, 위협 T-21-14·T-21-15·T-21-16).
// 마을 판 밤: 마피아 둘이 시민 한 명의 집을 고르면 아침에 그 집 앞에 현장이 서고(day.scene.house, 모두에게 같은 값), 산 사람이 지점 앞에서 inspect 하면 본인만 단서(me.clues)를 받는다.
// 의사가 지킨 밤은 미수 현장이고, 마피아가 갈린 밤은 아침 없이 토론이다. 마피아가 먼저 살핀 지점은 뒤 사람에게 touched 다. 실제 시간에 기대지 않는다: 단계는 마감을 당겨 걷고, 위치는 놓는다.
// 실패 출력은 한 줄이어야 해서(TAP) 값은 문자열로 견준다.
import { describe, expect, it } from "vitest";
import { TOWN_CLUE_SPOTS } from "../../shared/game/mapTown";
import type { ServerMessage } from "../../shared/protocol";
import { advanceTo, editRoom, flushWorld, lastViewOf, mapPlayers, mark, observe, placeSeats, send, settle, storedRoom, townGame, withRole } from "./helpers";
import type { Actor, Game } from "./helpers";

const json = (v: unknown): string => JSON.stringify(v);
const quiet = async (g: Game): Promise<void> => {
  for (const s of g.socks) await settle(s, mark(s));
};

interface Scene { g: Game; victim: Actor; houseSeat: number; mafias: Actor[]; others: Actor[] }
/**
 * 마을 판 밤에서 마피아 둘이 시민 한 명(victim)의 집을 고르게 하고 morning 까지 걷는다. lit(피해자 좌석 → 번호들)의 가로등은 밤 전에 처리된 것으로 둔다(창문 단서의 재료).
 * doctor 가 true 면 의사도 그 사람을 지킨다(미수 현장).
 */
async function sceneGame(opts: { lit?: (victimSeat: number) => number[]; doctor?: boolean } = {}): Promise<Scene> {
  const g = await townGame("night");
  const victim = withRole(g, "citizen")[0]!;
  const mafias = withRole(g, "mafia");
  const lit = (opts.lit?.(victim.seat) ?? []).map((n) => `lamp${n}`);
  await editRoom(g.code, (room) => mapPlayers(room, (p) => (p.seat === 0 ? { ...p, errandDone: lit } : p)));
  for (const m of mafias) send(m.sock, { t: "pick", target: victim.seat });
  if (opts.doctor === true) send(withRole(g, "doctor")[0]!.sock, { t: "pick", target: victim.seat });
  await quiet(g);
  await advanceTo(g.code, g.socks, "morning");
  await quiet(g);
  return { g, victim, houseSeat: victim.seat, mafias, others: g.actors.filter((a) => a !== victim && !mafias.includes(a)) };
}
const spot = (house: number, n: 1 | 2 | 3): { x: number; z: number } => TOWN_CLUE_SPOTS[house]![n - 1]!;
const inspectAt = async (s: Scene, a: Actor, n: 1 | 2 | 3): Promise<ServerMessage[][]> => {
  await placeSeats(s.g.code, { [a.seat]: spot(s.houseSeat, n) });
  return observe(s.g, a, () => send(a.sock, { t: "inspect" }));
};
const cluesOf = (a: Actor): string => json(lastViewOf(a.sock).me.clues ?? null);
const counts = (frames: ServerMessage[][]): string => frames.map((f) => f.length).join(",");

/** 키 경로 모음 — 두 프레임의 키 구조 비교용(단서 줄 안쪽 키는 종류마다 달라 뺀다: 비교 대상은 프레임 수와 view 의 바깥 구조). */
function keyPaths(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => keyPaths(v, `${path}[]`));
  if (value !== null && typeof value === "object") return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [`${path}.${k}`, ...keyPaths(v, `${path}.${k}`)]);
  return [];
}
const shapeOf = (m: ServerMessage | undefined): string => keyPaths(m === undefined || m.t !== "state" ? m : m.view).filter((k) => !k.includes(".clues[]")).sort().join(",");

describe("현장이 선다 (D-13·D-16)", () => {
  it("마피아 둘이 좌석 v 의 집을 고른 아침: 모든 산 사람 소켓의 day.scene 이 {house: v}, morning.eliminated v", async () => {
    const s = await sceneGame();
    const alive = s.g.actors.filter((a) => a !== s.victim);
    const got = alive.map((a) => `${json(lastViewOf(a.sock).day?.scene)}/${lastViewOf(a.sock).day?.morning?.eliminated}`);
    expect(json(got)).toBe(json(alive.map(() => `${json({ house: s.houseSeat })}/${s.houseSeat}`)));
  }, 60_000);

  it("의사가 같은 좌석을 지킨 밤: morning.saved 이고 day.scene.house 가 그 좌석(미수 현장)", async () => {
    const s = await sceneGame({ doctor: true });
    const v = lastViewOf(s.g.actors.find((a) => a !== s.victim)!.sock);
    expect(`${json(v.day?.morning)} ${json(v.day?.scene)}`).toBe(`${json({ saved: true })} ${json({ house: s.houseSeat })}`);
  }, 60_000);

  it("마피아가 갈린 밤은 morning 없이 discussion 이고 day.scene·me.clues 키가 없다", async () => {
    const g = await townGame("night");
    const victim = withRole(g, "citizen")[0]!;
    const other = withRole(g, "citizen")[1]!;
    const [m1, m2] = withRole(g, "mafia");
    send(m1!.sock, { t: "pick", target: victim.seat });
    send(m2!.sock, { t: "pick", target: other.seat });
    await quiet(g);
    await advanceTo(g.code, g.socks, "discussion");
    expect(json(g.actors.map((a) => `${"scene" in (lastViewOf(a.sock).day ?? {})}/${"clues" in lastViewOf(a.sock).me}`))).toBe(json(g.actors.map(() => "false/false")));
  }, 60_000);
});

describe("살피기 (D-13·D-14·D-21)", () => {
  it("시민이 지점 ① 에서 inspect: 그 소켓만 state 한 프레임, me.clues 는 발자국 수 2(마피아 둘), 다른 소켓은 프레임 0", async () => {
    const s = await sceneGame();
    const c = s.others[0]!;
    const frames = await inspectAt(s, c, 1);
    expect(`${counts(frames)} ${cluesOf(c)}`).toBe(`${s.g.actors.map((a) => (a === c ? 1 : 0)).join(",")} ${json([{ spot: 1, kind: "footprint", n: 2 }])}`);
    expect(json(s.g.actors.filter((a) => a !== c).map((a) => cluesOf(a)))).toBe(json(s.g.actors.filter((a) => a !== c).map(() => "null")));
  }, 60_000);

  it("마피아가 ② 를 먼저 살피면(본인은 cloth) 시민은 touched — 마피아와 시민의 응답은 프레임 수·view 키 구조가 같다", async () => {
    const s = await sceneGame();
    const m = s.mafias[0]!;
    const c = s.others[0]!;
    const before = (a: Actor): ServerMessage | undefined => ({ t: "state", view: lastViewOf(a.sock) }) as ServerMessage;
    const mBefore = before(m);
    const byM = await inspectAt(s, m, 2);
    const mShape = `${counts(byM) === s.g.actors.map((a) => (a === m ? 1 : 0)).join(",")} ${shapeOf(byM[s.g.actors.indexOf(m)]!.at(-1)) !== shapeOf(mBefore)}`;
    const mClues = cluesOf(m);
    const cBefore = before(c);
    const byC = await inspectAt(s, c, 2);
    const cShape = `${counts(byC) === s.g.actors.map((a) => (a === c ? 1 : 0)).join(",")} ${shapeOf(byC[s.g.actors.indexOf(c)]!.at(-1)) !== shapeOf(cBefore)}`;
    expect(`${mShape} ${cShape}`).toBe("true true true true");
    expect(`${JSON.parse(mClues)[0].kind} ${json(JSON.parse(cluesOf(c)))}`).toBe(`cloth ${json([{ spot: 2, kind: "touched" }])}`);
    // 마피아가 흐린 것은 서버 전용 — 어떤 소켓의 어떤 프레임에도 smudged·touched 키 이름이 새지 않는다(touched 는 본인이 받은 줄의 값일 뿐이다).
    const leaks = s.g.socks.flatMap((sock) => sock.frames).filter((raw) => raw.includes("smudged") || raw.includes("lampCut") || raw.includes("steps"));
    expect(leaks.length).toBe(0);
  }, 60_000);

  it("시민이 먼저 살피고 마피아가 뒤에 살피면 시민은 cloth 그대로이고 마피아도 cloth, 그 뒤 사람이 touched", async () => {
    const s = await sceneGame();
    const c = s.others[0]!;
    const m = s.mafias[0]!;
    const d = s.others[1]!;
    await inspectAt(s, c, 2);
    await inspectAt(s, m, 2);
    await inspectAt(s, d, 2);
    const kinds = [c, m, d].map((a) => JSON.parse(cluesOf(a))[0].kind).join(",");
    expect(`${kinds} ${JSON.parse(cluesOf(c))[0].piece === JSON.parse(cluesOf(m))[0].piece}`).toBe("cloth,cloth,touched true");
  }, 60_000);

  it("창문: 이웃 집 사람이고 그 집 가로등이 켜졌으면 window(옷 조각이 ② 와 다른 사람의 것), 켜지지 않은 이웃은 dark", async () => {
    const s = await sceneGame({ lit: (v) => [(v + 1) % 8] });
    const lit = s.g.actors.find((a) => a.seat === (s.houseSeat + 1) % 8);
    const unlit = s.g.actors.find((a) => a.seat === (s.houseSeat + 7) % 8);
    const other = s.g.actors.find((a) => a !== s.victim && a !== lit && a !== unlit)!;
    await inspectAt(s, other, 2);
    const cloth = JSON.parse(cluesOf(other))[0].piece as string;
    const got: string[] = [];
    if (lit !== undefined) {
      await inspectAt(s, lit, 3);
      const line = JSON.parse(cluesOf(lit))[0] as { kind: string; piece?: string };
      got.push(`${line.kind}:${line.piece !== undefined && line.piece !== cloth}`);
    }
    if (unlit !== undefined) {
      await inspectAt(s, unlit, 3);
      got.push(JSON.parse(cluesOf(unlit))[0].kind as string);
    }
    expect(json(got)).toBe(json([...(lit === undefined ? [] : ["window:true"]), ...(unlit === undefined ? [] : ["dark"])]));
  }, 60_000);

  it("유령(피해자)의 inspect 는 본인 state 한 프레임(거절)이고 저장된 상태에 단서가 생기지 않는다", async () => {
    const s = await sceneGame();
    const frames = await inspectAt(s, s.victim, 1);
    const stored = (await storedRoom(s.g.code)) as unknown as { players: Array<{ clues?: unknown }> };
    expect(`${counts(frames)} ${stored.players.some((p) => p.clues !== undefined)}`).toBe(`${s.g.actors.map((a) => (a === s.victim ? 1 : 0)).join(",")} false`);
  }, 60_000);
});

describe("그날 낮 동안 남고 다음 저녁이 지운다 (D-17)", () => {
  it("discussion·nomination view 에도 본인 me.clues 가 남고 남의 clues 는 없다. 다음 저녁 진입 뒤에는 어떤 view 에도 scene·clues 가 없다", async () => {
    const s = await sceneGame();
    const c = s.others[0]!;
    await inspectAt(s, c, 1);
    await flushWorld(s.g.code);
    const mine = json([{ spot: 1, kind: "footprint", n: 2 }]);
    const seen: string[] = [];
    for (const phase of ["discussion", "nomination"] as const) {
      await advanceTo(s.g.code, s.g.socks, phase);
      await quiet(s.g);
      seen.push(`${phase}:${s.g.actors.map((a) => (a === c ? json(lastViewOf(a.sock).me.clues ?? null) : String("clues" in lastViewOf(a.sock).me))).join("|")}`);
    }
    await advanceTo(s.g.code, s.g.socks, "errand");
    await quiet(s.g);
    const after = s.g.actors.map((a) => `${"scene" in (lastViewOf(a.sock).day ?? {})}/${"clues" in lastViewOf(a.sock).me}`);
    const want = (phase: string): string => `${phase}:${s.g.actors.map((a) => (a === c ? mine : "false")).join("|")}`;
    expect(json([...seen, ...after])).toBe(json([want("discussion"), want("nomination"), ...s.g.actors.map(() => "false/false")]));
  }, 120_000);

  it("morning 밖의 inspect 는 본인 state 한 프레임(거절)이고 상태가 바뀌지 않는다", async () => {
    const s = await sceneGame();
    await advanceTo(s.g.code, s.g.socks, "discussion");
    await quiet(s.g);
    const c = s.others[0]!;
    await placeSeats(s.g.code, { [c.seat]: spot(s.houseSeat, 1) });
    const frames = await observe(s.g, c, () => send(c.sock, { t: "inspect" }));
    expect(`${counts(frames)} ${cluesOf(c)}`).toBe(`${s.g.actors.map((a) => (a === c ? 1 : 0)).join(",")} null`);
  }, 60_000);
});
