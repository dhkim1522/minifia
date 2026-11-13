// 21-07: 확장판 마을 한 판의 누설 전수(D-06·D-15·D-21, 성공 기준 6, 위협 T-21-19).
// 저녁(시민 hold 켜기·마피아 hold 자르기·마피아 hold 없이 켜기·건너뛰기) → 밤(모두 집 고르기) → 아침(마피아 ② 먼저·시민 ② 뒤에·① ·이웃 ③·비이웃 ③)
// → 토론 → 지목(모이기) → 변론 → 찬반 → 처형 → 다음 저녁을 한 번 걷고(20-03 townLeak 의 play() 모양), 산 사람 소켓이 받은 모든 프레임을 한 곳에서 판정한다.
//  (1) state 프레임에 남의 역할 값이 없다 — 역할 키는 view.me 에만, players[] 행에 역할 키 없음, 관전 view 는 죽은 사람만 받는다.
//  (2) 서버 전용 키(lampCut·skipVote·smudged·steps·eyes·cloth·window·errandLast…)가 어떤 프레임 키로도 없고, clues 는 view.me.clues 에만 있다.
//  (3) day.scene 의 키는 house 하나다.
//  (4) 단계마다 마피아 소켓과 시민 소켓의 view 키 구조(값을 지운 경로 집합)가 허용 목록 밖에서 같다.
//  (5) 같은 행동(켜기 vs 자르기, 건너뛰기, 살피기)의 응답 프레임 수가 소켓마다 같다.
//  (6) world 프레임의 남의 좌표는 받는 사람 구역 안이다(20-03 의 구역 판정 — 이 판은 모두 광장이라 광장 밖 좌표가 없어야 한다).
// 실제 시간에 깨는 알람(문 통과·표본)이 끼므로 프레임 수는 "있다"와 위반 0, 그리고 같은 행동끼리의 비교로만 단언한다. 단계는 closePhase·advanceTo 로 마감을 당겨 걷는다(testSkip 을 쓰면 연결당 1초 20개 한도에 걸린다).
// 실패 출력은 한 줄이어야 해서(TAP) 첫 위반 하나만 문자열로 견준다.
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { placeCenterFx } from "../../shared/game/errand";
import { TOWN_CLUE_SPOTS, TOWN_MAP } from "../../shared/game/mapTown";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import {
  advanceTo,
  closePhase,
  flushWorld,
  lastViewOf,
  mark,
  observe,
  placeSeats,
  pointAll,
  send,
  settle,
  storedRoom,
  townGame,
  verdictAll,
  withRole,
  worldsIn,
  writeRoomEdit,
  zonesOfPts,
} from "./helpers";
import type { Actor, Game } from "./helpers";

const json = (v: unknown): string => JSON.stringify(v);
const counts = (frames: ServerMessage[][]): string => frames.map((f) => f.length).join(",");

/** 서버 전용 이름(21페이즈 + 지금 있는 심부름·밤 이름): 어떤 프레임의 어떤 키로도 없다. */
const SERVER_ONLY: readonly string[] = ["lampCut", "skipVote", "smudged", "steps", "eyes", "cloth", "window", "errandLast", "errandFake", "nightPick", "nightLog"];
/** 마피아와 시민의 view 키 구조가 달라도 되는 경로(지금도 있는 역할 키 — 결정 0021·0061). */
const ROLE_PATHS: readonly string[] = ["me.role", "me.allies", "me.allyPicks", "me.nightTally", "me.nightSure", "me.records", "me.note", "me.chat"]; // me.chat: 마피아의 밤 대화 채널(결정 0066, 지금도 있다)
/** 역할 낱말과 같은 값이 와도 되는 공개 경로: 옷 id(look) 는 꾸미기 값이다(직업 이름과 같은 단어가 옷에 있다 — 서버는 look 을 역할의 함수로 만들지 않는다, dress.test.ts). */
const LOOK_PATH = ".view.players[].look";
const ROLE_IDS: ReadonlySet<string> = new Set(["mafia", "police", "doctor", "citizen"]);

/** 키 경로 모음(값 없음, 배열은 [] 로 합친다). */
function keyPaths(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => keyPaths(v, `${path}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [`${path}.${k}`, ...keyPaths(v, `${path}.${k}`)]);
  }
  return [];
}
/** 문자열 잎(경로, 값). */
function leaves(value: unknown, path = ""): Array<{ path: string; value: string }> {
  if (Array.isArray(value)) return value.flatMap((v) => leaves(v, `${path}[]`));
  if (value !== null && typeof value === "object") return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => leaves(v, `${path}.${k}`));
  return typeof value === "string" ? [{ path, value }] : [];
}
const lastKey = (path: string): string => path.slice(path.lastIndexOf(".") + 1).replace(/\[\]$/, "");
const roleAllowed = (path: string): boolean => ROLE_PATHS.some((p) => path === `.view.${p}` || path.startsWith(`.view.${p}.`) || path.startsWith(`.view.${p}[]`));

interface StoredPlayer { id: string; seat: number; errandPlaces?: string[] }
const placesOf = async (g: Game, a: Actor): Promise<string[]> => ((await storedRoom(g.code)) as unknown as { players: StoredPlayer[] }).players.find((p) => p.seat === a.seat)!.errandPlaces!;

/** actor 를 place 의 가로등 앞에 세우고 처리 메시지를 보낸다 — 모든 소켓이 받은 프레임을 돌려준다(g.actors 순서). */
async function press(g: Game, actor: Actor, place: string, hold: boolean): Promise<ServerMessage[][]> {
  await placeSeats(g.code, { [actor.seat]: placeCenterFx(TOWN_MAP, place)! });
  return observe(g, actor, () => send(actor.sock, hold ? { t: "errand", hold: true } : { t: "errand" }));
}
const spot = (house: number, n: 1 | 2 | 3): { x: number; z: number } => TOWN_CLUE_SPOTS[house]![n - 1]!;
const inspectAt = async (g: Game, house: number, a: Actor, n: 1 | 2 | 3): Promise<ServerMessage[][]> => {
  await placeSeats(g.code, { [a.seat]: spot(house, n) });
  return observe(g, a, () => send(a.sock, { t: "inspect" }));
};
const quiet = async (g: Game): Promise<void> => {
  for (const s of g.socks) await settle(s, mark(s));
};

interface Checkpoint { phase: string; mafia: Set<string>; citizen: Set<string> }
interface Run {
  g: Game;
  /** 소켓마다 받은 모든 프레임(g.actors 순서) */
  tapes: Map<Actor, ServerMessage[]>;
  victim: Actor;
  executed: Actor;
  /** 같은 행동에 대한 응답 프레임 수 한 줄: "켜기=… 자르기=…" */
  evening: { hold: string; cut: string; plain: string; skipC: string; skipM: string };
  morning: { mafiaSecond: string; citizenSecond: string; first: string; neighbor: string; farther: string };
  checkpoints: Checkpoint[];
  phases: string[];
}

async function playOnce(): Promise<Run> {
  const g = await townGame("errand");
  const code = g.code;
  await writeRoomEdit(env.ROOM.getByName(code), (room) => ({ ...room, errandTickAt: Date.now() + 3_600_000 })); // 표본 알람이 누름과 겹쳐 프레임 수가 달라지지 않게 미룬다
  const [m1, m2] = withRole(g, "mafia") as [Actor, Actor];
  const [c1, c2] = withRole(g, "citizen") as [Actor, Actor];
  const police = withRole(g, "police")[0]!;
  const doctor = withRole(g, "doctor")[0]!;
  const victim = c2;
  const executed = m2;
  const phases: string[] = [];
  const checkpoints: Checkpoint[] = [];
  const checkpoint = async (phase: string): Promise<void> => {
    await quiet(g);
    phases.push(phase);
    checkpoints.push({ phase, mafia: new Set(keyPaths({ view: lastViewOf(m1.sock) })), citizen: new Set(keyPaths({ view: lastViewOf(c1.sock) })) });
  };

  // ---- 저녁: c1 hold 켜기 · m1 hold 자르기 · m2 hold 없이 켜기 · 건너뛰기(c1 한 번, m1 한 번) ----
  const x = (await placesOf(g, c1))[0]!;
  const y = (await placesOf(g, m1)).find((p) => p !== x)!;
  const z = (await placesOf(g, m2)).find((p) => p !== x && p !== y)!;
  const hold = counts(await press(g, c1, x, true));
  const cut = counts(await press(g, m1, y, true));
  const plain = counts(await press(g, m2, z, false));
  const skipC = counts(await observe(g, c1, () => send(c1.sock, { t: "skipPhase", on: true })));
  const skipM = counts(await observe(g, m1, () => send(m1.sock, { t: "skipPhase", on: true })));
  await checkpoint("errand");

  // ---- 밤: 모두 집 고르기 — 마피아 둘 같은 집(victim), 의사 다른 집, 경찰 조사, 시민도 고른다 ----
  await flushWorld(code);
  await advanceTo(code, g.socks, "night");
  for (const m of [m1, m2]) send(m.sock, { t: "pick", target: victim.seat });
  send(doctor.sock, { t: "pick", target: c1.seat });
  send(police.sock, { t: "pick", target: m2.seat });
  send(c1.sock, { t: "pick", target: police.seat });
  await checkpoint("night");

  // ---- 아침: 마피아가 ② 먼저, 시민이 ② 뒤에, 시민 ①, 이웃 ③, 비이웃 ③ ----
  await flushWorld(code);
  await advanceTo(code, g.socks, "morning");
  await quiet(g);
  const house = victim.seat;
  const others = g.actors.filter((a) => a !== victim);
  const neighborSeats = [(house + 7) % 8, (house + 1) % 8];
  const neighbor = others.find((a) => neighborSeats.includes(a.seat))!; // 6명 좌석 0~5: 피해자 옆 좌석에는 늘 한 명 이상 앉아 있다(m1·c1 일 수도 있다 — ③ 은 아직 아무도 안 살폈다)
  const farther = others.find((a) => !neighborSeats.includes(a.seat))!;
  const mafiaSecond = counts(await inspectAt(g, house, m1, 2));
  const citizenSecond = counts(await inspectAt(g, house, c1, 2));
  const first = counts(await inspectAt(g, house, c1, 1));
  const neighborThird = counts(await inspectAt(g, house, neighbor, 3));
  const fartherThird = counts(await inspectAt(g, house, farther, 3));
  await checkpoint("morning");

  // ---- 토론 → 지목(모이기) → 변론 → 찬반 → 처형 → 다음 저녁 ----
  await flushWorld(code);
  await advanceTo(code, g.socks, "discussion");
  await checkpoint("discussion");
  await flushWorld(code);
  await advanceTo(code, g.socks, "nomination");
  await checkpoint("nomination");
  const alive = g.actors.filter((a) => a !== victim);
  await flushWorld(code);
  await pointAll(code, g.actors, Object.fromEntries(alive.map((a) => [a.seat, a === executed ? c1.seat : executed.seat])));
  await checkpoint("defense");
  await closePhase(code);
  await checkpoint("verdict");
  await verdictAll(code, g.actors, Object.fromEntries(alive.filter((a) => a !== executed).map((a) => [a.seat, true])));
  await checkpoint("execution");
  await flushWorld(code);
  await advanceTo(code, g.socks, "errand");
  await checkpoint("errand2");

  const tapes = new Map(g.actors.map((a) => [a, a.sock.frames.map((raw) => JSON.parse(raw) as ServerMessage)] as const));
  return {
    g,
    tapes,
    victim,
    executed,
    evening: { hold, cut, plain, skipC, skipM },
    morning: { mafiaSecond, citizenSecond, first, neighbor: neighborThird, farther: fartherThird },
    checkpoints,
    phases,
  };
}

let played: Promise<Run> | null = null;
/** 한 판은 한 번만 걷고 시험들이 같은 기록을 본다. */
const play = (): Promise<Run> => (played ??= playOnce());
const T = { timeout: 240_000 };

/** state 프레임 가운데 관전(spectate)이 아닌 것 — 산 사람이 받은 것. 관전 view 는 죽은 사람이 받는다. */
const livingStates = (msgs: readonly ServerMessage[]): Array<Extract<ServerMessage, { t: "state" }>> =>
  msgs.filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state" && m.view.spectate === undefined);

describe("확장판 마을 한 판 누설 전수 (D-21, 성공 기준 6)", () => {
  it("지난 단계: 저녁 → 밤 → 아침 → 토론 → 지목 → 변론 → 찬반 → 처형 → 다음 저녁", T, async () => {
    const r = await play();
    expect(r.phases.join(">")).toBe("errand>night>morning>discussion>nomination>defense>verdict>execution>errand2");
    const seen = new Set(r.g.actors.flatMap((a) => (r.tapes.get(a) ?? []).filter((m) => m.t === "state").map((m) => (m as { view: RoomView }).view.phase)));
    expect([...seen].filter((p) => ["errand", "night", "morning", "discussion", "nomination", "defense", "verdict", "execution"].includes(p)).length).toBe(8);
  });

  it("(1) 산 사람 소켓의 state 프레임에 남의 역할이 없다: 역할 키는 view.me 에만, players[] 행에 역할 키 없음, 역할 낱말 값은 허용 경로 밖에 없다", T, async () => {
    const r = await play();
    const bad: string[] = [];
    let states = 0;
    for (const a of r.g.actors) {
      for (const m of livingStates(r.tapes.get(a)!)) {
        states += 1;
        for (const path of keyPaths(m)) {
          const key = lastKey(path);
          if ((key === "role" || key === "allies" || key === "job") && !roleAllowed(path)) bad.push(`좌석 ${a.seat} ${m.view.phase} 키 ${path}`);
        }
        for (const leaf of leaves(m)) {
          if (ROLE_IDS.has(leaf.value) && !roleAllowed(leaf.path) && leaf.path !== LOOK_PATH && !leaf.path.startsWith(".view.day.roles[]")) bad.push(`좌석 ${a.seat} ${m.view.phase} 값 ${leaf.path}=${leaf.value}`);
        }
      }
    }
    expect(`states>0=${states > 0} bad=${bad.length} ${bad[0] ?? "none"}`).toBe("states>0=true bad=0 none");
  });

  it("(1) 관전 view 는 죽은 사람(피해자·처형된 사람)만 받는다", T, async () => {
    const r = await play();
    const spectators = r.g.actors.filter((a) => r.tapes.get(a)!.some((m) => m.t === "state" && m.view.spectate !== undefined)).map((a) => a.seat).sort((a, b) => a - b);
    expect(json(spectators)).toBe(json([r.victim.seat, r.executed.seat].sort((a, b) => a - b)));
  });

  it("(2) 서버 전용 키가 어떤 프레임의 키로도 없고, clues 는 view.me.clues 에만, scene 은 view.day.scene 에만 있다", T, async () => {
    const r = await play();
    const bad: string[] = [];
    for (const a of r.g.actors) {
      for (const m of r.tapes.get(a)!) {
        for (const path of keyPaths(m)) {
          const key = lastKey(path);
          if (SERVER_ONLY.includes(key)) bad.push(`좌석 ${a.seat} ${path}`);
          if (key === "clues" && path !== ".view.me.clues") bad.push(`좌석 ${a.seat} ${path}`);
          if (key === "scene" && path !== ".view.day.scene") bad.push(`좌석 ${a.seat} ${path}`);
        }
      }
    }
    expect(`${bad.length} ${bad[0] ?? "none"}`).toBe("0 none");
  });

  it("(2) 원문에도 서버 전용 이름이 없다(키가 아닌 자리에서도 새지 않는다): lampCut·smudged·skipVote·errandLast", T, async () => {
    const r = await play();
    const hit = r.g.actors.flatMap((a) => a.sock.frames.filter((raw) => /lampCut|smudged|skipVote|errandLast/.test(raw)).map(() => a.seat));
    expect(`${hit.length} ${hit[0] ?? "none"}`).toBe("0 none");
  });

  it("(3) day.scene 의 키는 house 하나다(현장이 선 모든 state 프레임)", T, async () => {
    const r = await play();
    const shapes = new Set<string>();
    let withScene = 0;
    for (const a of r.g.actors) {
      for (const m of r.tapes.get(a)!) {
        if (m.t !== "state" || m.view.day?.scene === undefined) continue;
        withScene += 1;
        shapes.add(Object.keys(m.view.day.scene).sort().join(","));
      }
    }
    expect(`${withScene > 0} ${[...shapes].join("|")}`).toBe("true house");
  });

  it("(4) 단계마다 마피아 소켓과 시민 소켓의 view 키 구조(값 제외)가 허용 목록 밖에서 같다", T, async () => {
    const r = await play();
    const bad: string[] = [];
    for (const cp of r.checkpoints) {
      const inner = (p: string): boolean => p.includes(".clues[]"); // 단서 줄 안쪽 키는 종류마다 달라 뺀다(비교 대상은 바깥 구조)
      const onlyM = [...cp.mafia].filter((p) => !cp.citizen.has(p) && !roleAllowed(p) && !inner(p));
      const onlyC = [...cp.citizen].filter((p) => !cp.mafia.has(p) && !roleAllowed(p) && !inner(p));
      for (const p of onlyM) bad.push(`${cp.phase} 마피아에만 ${p}`);
      for (const p of onlyC) bad.push(`${cp.phase} 시민에만 ${p}`);
    }
    expect(`${r.checkpoints.length} ${bad.length} ${bad[0] ?? "none"}`).toBe(`${r.checkpoints.length} 0 none`);
  });

  it("(5) 같은 행동의 응답 프레임 수가 같다: 켜기(시민 hold)·자르기(마피아 hold)·마피아 hold 없이 켜기·건너뛰기가 모든 소켓에 한 프레임씩, 시민과 마피아가 같다", T, async () => {
    const r = await play();
    const all = (n: number): string => r.g.actors.map(() => n).join(",");
    expect(json(r.evening)).toBe(json({ hold: all(1), cut: all(1), plain: all(1), skipC: all(1), skipM: all(1) }));
  });

  it("(5) 살피기는 본인 한 프레임씩이고 마피아가 먼저든 시민이 뒤든 같다", T, async () => {
    const r = await play();
    const own = (a: Actor): string => r.g.actors.map((x) => (x === a ? 1 : 0)).join(",");
    const [m1, c1] = [withRole(r.g, "mafia")[0]!, withRole(r.g, "citizen")[0]!];
    const neighborCount = r.morning.neighbor;
    const farCount = r.morning.farther;
    expect(`${r.morning.mafiaSecond === own(m1)} ${r.morning.citizenSecond === own(c1)} ${r.morning.first === own(c1)} ${neighborCount.split(",").reduce((s, n) => s + Number(n), 0)} ${farCount.split(",").reduce((s, n) => s + Number(n), 0)}`).toBe("true true true 1 1");
  });

  it("(6) world 프레임: 산 사람이 받은 남의 좌표가 모두 받는 사람 구역(광장) 안이다 — 문 프레임·구역 snap 도 없다", T, async () => {
    const r = await play();
    const violations: string[] = [];
    let frames = 0;
    for (const a of r.g.actors) {
      const upTo = (r.tapes.get(a)!.findIndex((m) => m.t === "state" && m.view.spectate !== undefined) + 1 || r.tapes.get(a)!.length + 1) - 1;
      for (const f of worldsIn(r.tapes.get(a)!.slice(0, upTo))) {
        frames += 1;
        const pts: number[] = f.k === "move" ? (f.s === a.seat ? [] : [...f.p]) : f.k === "door" ? (f.e === "vanish" ? [] : [...f.p]) : f.ents.filter((e) => e.s !== a.seat).flatMap((e) => [...e.p]);
        const zones = zonesOfPts(pts);
        if (zones !== "" && zones !== "plaza") violations.push(`좌석 ${a.seat} · ${f.k} · ${zones}`);
        if (f.k === "door" || (f.k === "snap" && (f as { zone?: unknown }).zone === true)) violations.push(`좌석 ${a.seat} · ${f.k} 가 광장 판에 왔다`);
      }
    }
    expect(`${violations.length} ${violations[0] ?? "none"} frames>0=${frames > 0}`).toBe("0 none frames>0=true");
  });

  it("다음 저녁에는 이전 현장·단서가 없다: day.scene·me.clues 키가 모든 소켓에 없다(D-18 수명)", T, async () => {
    const r = await play();
    const seen = r.g.actors.map((a) => `${"scene" in (lastViewOf(a.sock).day ?? {})}/${"clues" in lastViewOf(a.sock).me}`);
    expect(json(seen)).toBe(json(r.g.actors.map(() => "false/false")));
  });
});
