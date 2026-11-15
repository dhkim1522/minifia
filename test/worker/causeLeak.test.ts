// 21-06 원인 흐름 한 판 누설 전수(D-21·D-29, 위협 T-21-22): 마을 확장판 원인 흐름 한 판 — 저녁(등불 켜기·길게 누르기) → 밤(집 고르기) → 아침(현장 살피기·건너뛰기) → 토론 → 투표 → 처형 → 다음 저녁 —
// 을 역할 다섯 시점(마피아·경찰·의사·시민·유령)의 실제 소켓으로 끝까지 지나며, 받은 모든 프레임을 판정 한 곳(judge)에서 다섯 가지로 가른다.
//  (1) keys: 같은 단계에서 같은 행동을 한 마피아와 시민의 새 view 키 집합이 같다(me.errand·me.record·me.scene·me.skip·day.lamps·day.scene·day.skipCount). 공개 day 값은 모든 소켓(유령 포함)이 같다.
//  (2) names: 서버 전용 이름(errandCut·skipVote·sceneSeen·touched·footprints·windowLit·scene 원본 조각 cloth·window)은 어떤 소켓의 어떤 프레임에도 키로 없고, 새 view 경로는 허용 목록 안이다.
//  (3) world: 산 사람이 아침·밤에 받은 world 프레임의 남의 좌표는 근처 반경 안이면서 같은 구역이고, 밤에는 남의 좌표가 없으며 남의 걸음(move)은 오지 않는다(A5).
//  (4) responses: 길게 누르기(마피아·시민)·살피기(마피아가 먼저·시민이 뒤)·밤 집 고르기(동료 집·자기 집)·거절·건너뛰기의 응답은 역할과 무관하게 같은 종류·같은 프레임 수·같은 새 키 구조다(D-06·D-10·D-15·D-23).
//  (5) roles: 산 사람 프레임에 남의 role·job 값이 없다(본인 me.role·마피아 본인 me.allies 만). 유령의 spectate 만 예외다(결정 0021). 처형된 사람의 정체는 판이 끝날 때까지 비공개다(D-20).
// 비교에서 뺀 것: 마피아 전용 기존 키(allies·allyPicks·nightTally·nightSure·note·records — 본인 역할 일지, 결정 0003·0021)는 이 시험의 비교 대상이 아니다. 비교는 이 페이즈의 새 키 집합과 응답 프레임 수열이다.
//   마피아의 밤 pick 은 같은 편에게 allyPicks 로 한 프레임이 더 가므로(기존 규칙) 밤 집 고르기의 "남에게 가는 프레임" 은 마피아가 아닌 소켓만 센다.
// 시험 편의: 아침 현장의 창문 지점이 읽히려면 짝집 창 불이 켜져 있어야 해서(windowLit) 밤 진입 직후 lamps 를 모두 켠 값으로 고친다(21-04·21-05 시험과 같은 선례). 그래서 밤 단계의 공개 값 비교는 고치기 전의 진입 프레임으로 한다.
// 위치는 메모리 world 에 직접 놓는다(placeSeats). "오지 않았음" 은 settle(ping/pong)로 증명한다. 다른 시험 파일을 import 하지 않는다 — keyPaths 는 이 파일의 것이다. 실패 출력은 한 줄이어야 해서(TAP) 판정은 첫 위반 한 줄 문자열로 한다.
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UNIT } from "../../shared/game/map";
import { TOWN_CLUE_SPOTS, TOWN_LAMPS, TOWN_MAP } from "../../shared/game/mapTown";
import { ERRAND_MIN_GAP_MS, ERRAND_NEAR_R } from "../../shared/game/phases";
import { positionAtFx } from "../../shared/game/world";
import type { Segment } from "../../shared/game/world";
import { zoneOf } from "../../shared/game/zones";
import { OUTFIT_IDS } from "../../shared/protocol";
import type { PhaseId, RoomView, ServerMessage } from "../../shared/protocol";
import { openCause, openTown } from "../helpers/playable";
import { actorsOf, advanceTo, flushWorld, framesOf, lastViewOf, mark, moveAs, nextFrame, pause, placeSeats, pointAll, seat, send, settle, verdictAll, withRole, writeRoomEdit } from "./helpers";
import type { Actor, Game } from "./helpers";

function keyPaths(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => keyPaths(v, `${path}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [`${path}.${k}`, ...keyPaths(v, `${path}.${k}`)]);
  }
  return [];
}

/** 문자열 잎(경로, 값) 전부. */
function stringLeaves(value: unknown, path = ""): Array<[string, string]> {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v) => stringLeaves(v, `${path}[]`));
  if (value !== null && typeof value === "object") return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => stringLeaves(v, `${path}.${k}`));
  return [];
}

/** 이 페이즈가 view 에 더한 경로의 뿌리. 이 아래 경로만 새 키로 비교한다. */
const NEW_ROOTS = [".view.me.errand", ".view.me.record", ".view.me.scene", ".view.me.skip", ".view.day.lamps", ".view.day.scene", ".view.day.skipCount"];
const underNew = (p: string): boolean => NEW_ROOTS.some((root) => p === root || p.startsWith(`${root}.`) || p.startsWith(`${root}[`));
/** 허용 목록(이유 한 줄씩): 이 밖의 새 경로가 뿌리 아래에 보이면 실패한다. */
const ALLOWED_NEW: ReadonlySet<string> = new Set([
  ".view.me.errand", ".view.me.errand.places", ".view.me.errand.done", // 저녁의 산 본인에게만: 장소 id 목록과 처리한 순서
  ".view.me.record", ".view.me.record[].seat", ".view.me.record[].place", // 토론의 산 본인에게만: 근처에서 본 좌석·장소 id
  ".view.me.scene", ".view.me.scene[].spot", ".view.me.scene[].r", ".view.me.scene[].n", ".view.me.scene[].piece", // 본인이 살핀 줄만(종류·결과·수·조각)
  ".view.me.skip", ".view.day.skipCount", // 건너뛰기: 본인 값 · 누른 수(모두에게 같다)
  ".view.day.lamps", ".view.day.scene", ".view.day.scene.house", // 등불 켜짐 여덟 · 피해자 집 좌석 하나(모두에게 같다)
]);
/** 어떤 프레임의 어떤 깊이에도 키로 없어야 하는 서버 전용 이름(D-21). cloth·window 는 서버 scene 의 조각 필드 이름이다(ClueLine.spot 의 값 "cloth"·"window" 는 값이라 겹치지 않는다). */
const SERVER_ONLY_NAMES = new Set(["errandCut", "skipVote", "sceneSeen", "touched", "footprints", "windowLit", "cloth", "window", "cut", "errandPlaces", "errandDone", "errandNear", "errandSeen", "errandTickAt", "nightPick", "errandLast", "errandFake"]);
/** 원문에 그대로 들어 있으면 안 되는 이름("touched"·"cloth"·"window" 는 값으로 정당하게 나가므로 뺀다). */
const RAW_NAMES = ["errandCut", "skipVote", "sceneSeen", "windowLit", "footprints", "errandPlaces", "errandNear", "errandSeen", "errandTickAt", "nightPick"];
const ROLE_WORDS: ReadonlySet<string> = new Set(["mafia", "police", "doctor", "citizen"]);
/** .view.day.roles[] 는 이번 판 직업 구성표(공개 정보, 좌석과 이어지지 않는다 — protocol DayView.roles). */
/** .view.me.chat 은 본인 채널 이름이다 — 마피아 본인의 밤 채널 "mafia" 만 마피아 소켓에서 허용한다(결정 0003). */
/** 옷 id 는 역할 낱말(police 등)과 겹치는 값이 있지만 모두에게 같은 공개 꾸밈 값이다(.look). */
const OUTFITS: ReadonlySet<string> = new Set<string>(OUTFIT_IDS);

/** 메시지(또는 {view})에서 새 경로를 모아 `[]` 뒤를 잘라 중복 없이 정렬한다(목록 길이·내용이 아니라 키 구조만 비교). */
const newKeys = (msg: unknown): string[] => [...new Set(keyPaths(msg).filter(underNew).map((p) => p.split("[]")[0]!))].sort();
/** 공개 day 아래 새 키 구조만(남의 소켓 프레임은 받는 사람 본인의 me 값이 사람마다 달라 me 를 빼고 비교한다). */
const dayShapeOf = (msgs: readonly ServerMessage[]): string => msgs.map((m) => `${m.t}:${newKeys(m).filter((p) => p.startsWith(".view.day")).join(",")}`).join("|");
/** 응답 모양: 프레임 종류 + 새 키 구조. */
const shapeOf = (msgs: readonly ServerMessage[]): string => msgs.map((m) => `${m.t}:${newKeys(m).join(",")}`).join("|");
const kindsOf = (msgs: readonly ServerMessage[]): string => msgs.map((m) => m.t).join(",");

/** 연결당 1초 20개 한도의 창을 비운다 — 이 시험은 한 판을 빠르게 지나며 ping 이 한도를 넘을 수 있다(한도는 reconnect.test.ts 가 따로 본다). */
async function clearRates(code: string): Promise<void> {
  await runInDurableObject(env.ROOM.getByName(code), (instance) => {
    (instance as unknown as { rates: WeakMap<object, unknown> }).rates = new WeakMap();
  });
}

interface Resp {
  who: Actor;
  mine: ServerMessage[];
  others: Array<{ who: Actor; frames: ServerMessage[] }>;
}

interface Checkpoint {
  label: string;
  /** 새 me 키 집합을 서로 비교하는 사람들(같은 단계에서 같은 행동을 한 사람) */
  group: Actor[];
  /** g.actors 순서의 마지막 view */
  views: RoomView[];
}

interface Run {
  g: Game;
  names: Map<Actor, string>;
  m1: Actor;
  m2: Actor;
  c1: Actor;
  c2: Actor;
  police: Actor;
  doctor: Actor;
  resp: Record<string, Resp>;
  cps: Checkpoint[];
  /** 단계 경계마다 소켓별 프레임 수(g.actors 순서) */
  stage: Record<"sample" | "night" | "morning" | "preSkip" | "verdict", number[]>;
  /** 피해자 집 좌석(아침 view 의 day.scene.house) */
  house: number | undefined;
}

const lampCenterFx = (id: string): { x: number; z: number } => {
  const lamp = TOWN_LAMPS.find((l) => l.id === id)!;
  return { x: Math.round(lamp.x * 100), z: Math.round(lamp.z * 100) };
};

/** 행동을 보내고 보낸 소켓이 받은 프레임과 다른 모든 소켓이 받은 프레임을 돌려준다("오지 않았음" 은 ping/pong 으로 증명). */
async function respond(g: Game, who: Actor, msg: unknown): Promise<Resp> {
  await clearRates(g.code);
  const marks = g.actors.map((a) => mark(a.sock));
  send(who.sock, msg);
  const self = g.actors.indexOf(who);
  const mine = await settle(who.sock, marks[self]!);
  const others: Resp["others"] = [];
  for (const [i, a] of g.actors.entries()) if (i !== self) others.push({ who: a, frames: await settle(a.sock, marks[i]!) });
  return { who, mine, others };
}

async function sample(g: Game): Promise<void> {
  const stub = env.ROOM.getByName(g.code);
  await writeRoomEdit(stub, (room) => ({ ...room, errandTickAt: Date.now() - 1 }));
  await runDurableObjectAlarm(stub);
  for (const s of g.socks) await settle(s, mark(s));
}

const isPhase = (phase: PhaseId) => (m: ServerMessage): boolean => m.t === "state" && m.view.phase === phase;

/** 마을 확장판 원인 흐름 한 판을 저녁부터 다음 저녁까지 한 번 지난다(방장 + 손님 다섯 = 마피아 둘·경찰·의사·시민 둘). */
async function playOnce(): Promise<Run> {
  const room = await seat(5, 0);
  const socks = [room.host, ...room.guests.map((x) => x.sock)];
  send(room.host, { t: "start" });
  for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
  await advanceTo(room.code, socks, "errand");
  for (const sock of socks) await settle(sock, mark(sock));
  const g: Game = { code: room.code, socks, actors: actorsOf(room) };
  const stub = env.ROOM.getByName(g.code);
  const far = (): Promise<void> => writeRoomEdit(stub, (r) => ({ ...r, errandTickAt: Date.now() + 3_600_000 }));
  await far();

  const [m1, m2] = withRole(g, "mafia") as [Actor, Actor];
  const [c1, c2] = withRole(g, "citizen") as [Actor, Actor];
  const police = withRole(g, "police")[0]!;
  const doctor = withRole(g, "doctor")[0]!;
  const names = new Map<Actor, string>([[m1, "m1"], [m2, "m2"], [c1, "c1"], [c2, "c2"], [police, "police"], [doctor, "doctor"]]);
  const resp: Record<string, Resp> = {};
  const cps: Checkpoint[] = [];
  const stage = {} as Run["stage"];
  const note = (name: keyof Run["stage"]): void => {
    stage[name] = g.socks.map((s) => mark(s));
  };
  const checkpoint = (label: string, group: Actor[]): void => {
    cps.push({ label, group, views: g.actors.map((a) => lastViewOf(a.sock)) });
  };
  const acted = new Map<Actor, number>();
  const gap = async (who: Actor): Promise<void> => {
    const last = acted.get(who);
    const wait = last === undefined ? 0 : ERRAND_MIN_GAP_MS + 50 - (Date.now() - last);
    if (wait > 0) await pause(wait);
  };
  const act = async (who: Actor, msg: unknown): Promise<Resp> => {
    await gap(who);
    const r = await respond(g, who, msg);
    acted.set(who, Date.now());
    return r;
  };
  const placesOf = (who: Actor): readonly string[] => lastViewOf(who.sock).me.errand!.places;

  // ---- 저녁: 전원이 배정된 등불 셋을 켠다. 마피아 m1 과 시민 c2 는 같은 순서로 길게 누르기(켜기 hold·그냥·hold false)를 한다 ----
  const holds: Array<boolean | undefined> = [true, undefined, false];
  for (const k of [0, 1, 2]) {
    for (const who of [m1, c2, m2, police, doctor, c1]) {
      const special = who === m1 || who === c2;
      const hold = special ? holds[k] : undefined;
      await placeSeats(g.code, { [who.seat]: lampCenterFx(placesOf(who)[k]!) });
      const r = await act(who, hold === undefined ? { t: "errand" } : { t: "errand", hold });
      if (special) resp[`${names.get(who)}.hold${k}`] = r;
    }
  }
  // 같은 등불을 다시 길게 누른다(거절) — 마피아·시민 모두 같은 모양이어야 한다.
  for (const who of [m1, c2]) {
    await placeSeats(g.code, { [who.seat]: lampCenterFx(placesOf(who)[0]!) });
    resp[`${names.get(who)}.again`] = await act(who, { t: "errand", hold: true });
  }
  // 표본 한 번(근처·목격): 여섯을 광장 곳곳에 흩어 놓는다.
  await placeSeats(g.code, Object.fromEntries(g.actors.map((a, i) => [a.seat, [{ x: 320, z: 180 }, { x: -420, z: 380 }, { x: 520, z: 520 }, { x: -320, z: -180 }, { x: 420, z: -380 }, { x: 0, z: 320 }][i]!])));
  note("sample");
  await sample(g);
  await far();
  checkpoint("evening", [m1, c2, police, doctor]);

  // ---- 밤: 진입 프레임의 공개 값을 먼저 보고, 창이 읽히게 lamps 를 켠 값으로 고친 뒤 집을 고른다 ----
  await flushWorld(g.code);
  note("night");
  await advanceTo(g.code, g.socks, "night");
  for (const s of g.socks) await settle(s, mark(s));
  checkpoint("night", [m1, c2, police, doctor]);
  await writeRoomEdit(stub, (r) => ({ ...r, lamps: Array.from({ length: 8 }, () => true) }));
  resp.pickAlly = await respond(g, m1, { t: "pick", target: m2.seat }); // 마피아가 동료 집을 먼저 누른다
  resp.pickSelf = await respond(g, c2, { t: "pick", target: c2.seat }); // 시민이 자기 집을 누른다
  resp.m1Final = await respond(g, m1, { t: "pick", target: c1.seat }); // 바꾼다(마지막 선택이 이긴다)
  resp.c2Final = await respond(g, c2, { t: "pick", target: c1.seat });
  await respond(g, m2, { t: "pick", target: c1.seat });
  await respond(g, police, { t: "pick", target: doctor.seat });
  await respond(g, doctor, { t: "pick", target: police.seat });
  await respond(g, c1, { t: "pick", target: m1.seat });

  // ---- 아침: 피해자 c1. 마피아가 옷 조각 지점을 먼저, 의사가 발자국, 시민이 마피아 뒤에 같은 지점, 경찰이 창문 ----
  await flushWorld(g.code);
  note("morning");
  await advanceTo(g.code, g.socks, "morning");
  for (const s of g.socks) await settle(s, mark(s));
  await far();
  const house = (lastViewOf(m1.sock).day as { scene?: { house: number } } | undefined)?.scene?.house;
  const spotOf = (k: number): { x: number; z: number } => TOWN_CLUE_SPOTS[house ?? c1.seat]![k]!;
  const inspect = async (who: Actor, k: number, name: string): Promise<void> => {
    await placeSeats(g.code, { [who.seat]: spotOf(k) });
    resp[name] = await act(who, { t: "inspect" });
  };
  await inspect(m1, 1, "m1.first");
  await inspect(doctor, 0, "doctor.first");
  await inspect(c2, 1, "c2.touched");
  await inspect(police, 2, "police.window");
  await inspect(m1, 0, "m1.second");
  // 아침 근처 표본(A5): A=m1·C=c2 는 서로 근처, 나머지는 멀리(모두 같은 광장 구역). 한 번 걷고 한 번 더 표본한다.
  await placeSeats(g.code, { [m1.seat]: { x: 320, z: 180 }, [c2.seat]: { x: 420, z: 180 }, [police.seat]: { x: -420, z: 380 }, [doctor.seat]: { x: 520, z: 520 }, [m2.seat]: { x: -320, z: -380 }, [c1.seat]: { x: 0, z: 320 } });
  await sample(g);
  await far();
  await clearRates(g.code);
  moveAs(m1, 370, 180);
  for (const s of g.socks) await settle(s, mark(s));
  await sample(g);
  await far();

  // ---- 건너뛰기: 마피아 m1 과 시민 c2 가 누르고(과반 전), 경찰이 눌러 과반이 되면 토론으로 넘어간다 ----
  resp["m1.skip"] = await respond(g, m1, { t: "skip", on: true });
  resp["c2.skip"] = await respond(g, c2, { t: "skip", on: true });
  checkpoint("morning", [m1, c2]);
  note("preSkip");
  send(police.sock, { t: "skip", on: true });
  for (const s of g.socks) await nextFrame(s, isPhase("discussion"));
  for (const s of g.socks) await settle(s, mark(s));
  checkpoint("discussion", [m1, c2, police, doctor]);

  // ---- 토론 → 투표(마피아 m2 지목) → 변론 → 찬반 → 처형 → 다음 저녁 ----
  const living = [m1, m2, police, doctor, c2];
  await flushWorld(g.code);
  await advanceTo(g.code, g.socks, "nomination");
  for (const s of g.socks) await settle(s, mark(s));
  await flushWorld(g.code);
  await pointAll(g.code, living, { [police.seat]: m2.seat, [doctor.seat]: m2.seat, [c2.seat]: m2.seat, [m1.seat]: police.seat, [m2.seat]: police.seat });
  await advanceTo(g.code, g.socks, "verdict");
  for (const s of g.socks) await settle(s, mark(s));
  note("verdict");
  await verdictAll(g.code, [m1, police, doctor, c2], { [m1.seat]: true, [police.seat]: true, [doctor.seat]: true, [c2.seat]: true });
  await advanceTo(g.code, g.socks, "errand");
  for (const s of g.socks) await settle(s, mark(s));
  checkpoint("evening2", [m1, c2, police, doctor]);
  return { g, names, m1, m2, c1, c2, police, doctor, resp, cps, stage, house };
}

/** 어느 사람의 프레임 가운데 "산 사람으로 받은" 구간의 끝(소켓 프레임 수). 처음부터 끝까지 산 사람은 전부다. */
function liveEnd(r: Run, who: Actor): number {
  const total = r.g.socks[r.g.actors.indexOf(who)]!.frames.length;
  if (who === r.c1) return r.stage.morning[r.g.actors.indexOf(who)]!; // 밤 사이에 피해자가 된다
  if (who === r.m2) return r.stage.verdict[r.g.actors.indexOf(who)]!; // 처형 마감 직전까지 산 사람이다
  return total;
}

type Check = "chain" | "keys" | "names" | "world" | "responses" | "roles";

/** 판정 한 곳: 다섯 가지 판정을 이름으로 고른다. 통과하면 "ok", 아니면 첫 위반 한 줄. */
function judge(r: Run, check: Check): string {
  const { g } = r;
  const idx = (a: Actor): number => g.actors.indexOf(a);
  const tag = (a: Actor): string => `${r.names.get(a)}(좌석 ${a.seat} ${a.role})`;
  const framesAt = (a: Actor): ServerMessage[] => framesOf(g.socks[idx(a)]!);

  if (check === "chain") {
    const phases: string[] = [];
    for (const m of framesAt(r.m1)) if (m.t === "state" && m.view.phase !== phases.at(-1)) phases.push(m.view.phase);
    const from = phases.indexOf("errand");
    return from < 0 ? "errand 단계가 없다" : phases.slice(from).join(" → ");
  }

  if (check === "keys") {
    const wants: Record<string, string[]> = {
      evening: [".view.me.errand", ".view.day.skipCount"],
      night: [".view.day.lamps"],
      morning: [".view.day.scene", ".view.day.skipCount", ".view.me.scene", ".view.me.skip"],
      discussion: [".view.me.record", ".view.me.scene"],
      evening2: [".view.me.errand", ".view.day.skipCount"],
    };
    for (const cp of r.cps) {
      const keysOf = (a: Actor): string => newKeys({ view: cp.views[idx(a)]! }).join(",");
      const base = cp.group[0]!;
      for (const a of cp.group) if (keysOf(a) !== keysOf(base)) return `${cp.label} · ${tag(a)} 새 키 [${keysOf(a)}] ≠ ${tag(base)} [${keysOf(base)}]`;
      for (const want of wants[cp.label] ?? []) if (!keysOf(base).split(",").includes(want)) return `${cp.label} · 기대한 새 키 ${want} 가 ${tag(base)} view 에 없다(빈 판정 방지)`;
      const pub = (v: RoomView): string => JSON.stringify({ lamps: v.day?.lamps, scene: v.day?.scene, skipCount: v.day?.skipCount });
      const first = pub(cp.views[0]!);
      for (const [i, v] of cp.views.entries()) if (pub(v) !== first) return `${cp.label} · 좌석 ${g.actors[i]!.seat} 의 공개 day 값 ${pub(v)} ≠ ${first}`;
    }
    const evening2 = r.cps.find((c) => c.label === "evening2")!;
    for (const a of evening2.group) {
      const keys = newKeys({ view: evening2.views[idx(a)]! });
      if (keys.includes(".view.me.scene") || keys.includes(".view.me.skip")) return `evening2 · ${tag(a)} 다음 저녁 view 에 지난 낮의 me.scene·me.skip 이 남았다`;
    }
    return "ok";
  }

  if (check === "names") {
    for (const a of g.actors) {
      for (const raw of g.socks[idx(a)]!.frames) {
        for (const name of RAW_NAMES) if (raw.includes(name)) return `${tag(a)} · 원문에 서버 전용 이름 ${name}`;
        const msg = JSON.parse(raw) as ServerMessage;
        for (const p of keyPaths(msg)) {
          const key = p.slice(p.lastIndexOf(".") + 1);
          if (SERVER_ONLY_NAMES.has(key)) return `${tag(a)} · ${msg.t} 프레임에 서버 전용 이름 키 ${p}`;
          if (underNew(p) && !ALLOWED_NEW.has(p)) return `${tag(a)} · 허용 목록 밖의 새 경로 ${p}`;
        }
      }
    }
    return "ok";
  }

  if (check === "world") {
    const radius = ERRAND_NEAR_R * UNIT;
    let judged = 0;
    for (const a of [r.m1, r.c2, r.police, r.doctor, r.m2]) {
      const frames = framesAt(a);
      const from = r.stage.sample[idx(a)]!;
      const to = r.stage.preSkip[idx(a)]!;
      let phase: PhaseId = "errand";
      let own: Segment | undefined;
      for (const [i, m] of frames.entries()) {
        if (m.t === "state") phase = m.view.phase;
        if (m.t !== "world") continue;
        const inRange = i >= from && i < to;
        if (m.k === "move") {
          if (m.s === a.seat) own = { p: m.p, t0: m.t0, v: m.v };
          else if (inRange && (phase === "night" || phase === "morning")) return `${tag(a)} · ${phase} 에 남(좌석 ${m.s})의 move 프레임이 왔다`;
        } else if (m.k === "snap") {
          const mine = m.ents.find((e) => e.s === a.seat);
          if (mine !== undefined) own = { p: mine.p, t0: mine.t0, v: mine.v };
          const others = m.ents.filter((e) => e.s !== a.seat);
          if (!inRange || others.length === 0) continue;
          if (phase === "night") return `${tag(a)} · 밤 snap 에 남의 좌표가 있다(좌석 ${others.map((e) => e.s).join(",")})`;
          if (own === undefined) return `${tag(a)} · 내 자리를 모르는 채 남의 좌표를 받았다`;
          const here = positionAtFx(own, m.at);
          for (const o of others) {
            const there = positionAtFx({ p: o.p, t0: o.t0, v: o.v }, m.at);
            const dist = Math.hypot(there.x - here.x, there.z - here.z);
            const zoneHere = zoneOf(TOWN_MAP, here.x, here.z);
            const zoneThere = zoneOf(TOWN_MAP, there.x, there.z);
            if (dist > radius || zoneHere !== zoneThere) return `${tag(a)} · ${phase} snap 의 좌석 ${o.s} 거리 ${Math.round(dist)} (한도 ${radius}) 구역 ${zoneThere} / 받는 사람 구역 ${zoneHere}`;
            judged += 1;
          }
        }
      }
    }
    return judged > 0 ? "ok" : "판정한 남의 좌표 프레임이 0개다(근처 표본이 한 번도 남을 싣지 않았다)";
  }

  if (check === "responses") {
    const groups: Array<{ label: string; names: string[]; observers: "all" | "nonMafia" }> = [
      { label: "길게 누르기·거절", names: ["m1.hold0", "c2.hold0", "m1.hold1", "c2.hold1", "m1.hold2", "c2.hold2", "m1.again", "c2.again"], observers: "all" },
      { label: "살피기", names: ["m1.first", "doctor.first", "c2.touched", "police.window", "m1.second"], observers: "all" },
      { label: "밤 집 고르기", names: ["pickAlly", "pickSelf", "m1Final", "c2Final"], observers: "nonMafia" },
    ];
    for (const grp of groups) {
      const list = grp.names.map((n) => ({ n, r: r.resp[n] }));
      for (const { n, r: resp } of list) if (resp === undefined) return `${grp.label} · 응답 ${n} 을 모으지 못했다`;
      const first = list[0]!.r!;
      for (const { n, r: resp } of list) {
        if (kindsOf(resp!.mine) !== "state") return `${grp.label} · ${n} 응답 종류 [${kindsOf(resp!.mine)}] (state 한 프레임이어야 한다)`;
        if (shapeOf(resp!.mine) !== shapeOf(first.mine)) return `${grp.label} · ${n} 응답 모양 ${shapeOf(resp!.mine)} ≠ ${list[0]!.n} ${shapeOf(first.mine)}`;
        const seen = resp!.others.filter((o) => grp.observers === "all" || o.who.role !== "mafia").map((o) => o.frames.length);
        if (seen.some((c) => c !== 0)) return `${grp.label} · ${n} 응답이 남의 소켓에 프레임을 보냈다 [${seen.join(",")}]`;
      }
    }
    const skips = [r.resp["m1.skip"]!, r.resp["c2.skip"]!];
    const profile = (x: Resp): string => x.others.map((o) => `${o.frames.length}:${dayShapeOf(o.frames)}`).sort().join(" / ");
    if (kindsOf(skips[0]!.mine) !== "state" || shapeOf(skips[0]!.mine) !== shapeOf(skips[1]!.mine)) return `건너뛰기 · 내 응답 ${shapeOf(skips[0]!.mine)} ≠ ${shapeOf(skips[1]!.mine)}`;
    if (profile(skips[0]!) !== profile(skips[1]!)) return `건너뛰기 · 남의 소켓 프레임 ${profile(skips[0]!)} ≠ ${profile(skips[1]!)}`;
    if (skips[0]!.others.some((o) => o.frames.length !== 1)) return `건너뛰기 · 누른 수는 모두에게 한 프레임씩 가야 한다 [${skips[0]!.others.map((o) => o.frames.length).join(",")}]`;
    return "ok";
  }

  // roles
  for (const a of [r.m1, r.c2, r.police, r.doctor, r.m2, r.c1]) {
    const frames = framesAt(a).slice(0, liveEnd(r, a));
    for (const m of frames) {
      if (m.t !== "state") continue;
      for (const p of keyPaths(m)) {
        const key = p.slice(p.lastIndexOf(".") + 1);
        if ((key === "role" || key === "allies") && p !== `.view.me.${key}`) return `${tag(a)} · ${m.view.phase} · 남의 ${key} 경로 ${p}`;
        if (p === ".view.spectate" || (p.startsWith(".view.players[].") && (key === "role" || key === "job"))) return `${tag(a)} · ${m.view.phase} · 산 사람 프레임에 ${p}`;
        if (a.role !== "mafia" && (p === ".view.me.allies" || p === ".view.me.allyPicks")) return `${tag(a)} · ${m.view.phase} · 마피아 전용 ${p}`;
      }
      for (const [p, v] of stringLeaves(m)) if (ROLE_WORDS.has(v) && p !== ".view.me.role" && p !== ".view.day.roles[]" && !(p === ".view.me.chat" && a.role === "mafia" && v === "mafia") && !(p.endsWith(".look") && OUTFITS.has(v))) return `${tag(a)} · ${m.view.phase} · 역할 값 ${v} 가 ${p} 에 있다`;
    }
  }
  // 유령은 spectate 를 받는다(결정 0021) — 예외가 실제로 일어났음을 확인한다(빈 판정 방지).
  const spectated = (a: Actor): boolean => framesAt(a).slice(liveEnd(r, a)).some((m) => m.t === "state" && m.view.spectate !== undefined);
  if (!spectated(r.c1) || !spectated(r.m2)) return `유령(c1·m2)이 사망 뒤 spectate 를 받지 못했다 c1=${spectated(r.c1)} m2=${spectated(r.m2)}`;
  return "ok";
}

let played: Promise<Run> | null = null;
/** 한 판은 한 번만 지나고 시험들이 같은 기록을 본다. */
const play = (): Promise<Run> => (played ??= playOnce());
const T = { timeout: 240_000 };

describe("원인 흐름 한 판 누설 전수 — 역할 다섯 × 저녁·밤·아침·토론·처형 (openCause + openTown, D-21·D-29)", () => {
  let restoreCause: () => void = () => {};
  let restoreTown: () => void = () => {};
  beforeAll(() => {
    restoreCause = openCause();
    restoreTown = openTown();
  });
  afterAll(() => {
    restoreTown();
    restoreCause();
  });

  it("판이 새 흐름 전체를 지났다: 저녁 → 밤 → 아침 → 토론 → 지목 → 변론 → 찬반 → 처형 → 다음 저녁", T, async () => {
    const r = await play();
    expect(judge(r, "chain")).toBe("errand → night → morning → discussion → nomination → defense → verdict → execution → errand");
  });

  it("(1) 같은 단계에서 같은 행동을 한 마피아와 시민의 새 view 키 집합이 같고, 공개 day 값(lamps·scene·skipCount)은 모든 소켓이 같다", T, async () => {
    expect(judge(await play(), "keys")).toBe("ok");
  });

  it("(2) 모든 소켓(유령 포함)의 모든 프레임 어디에도 서버 전용 이름이 없고 새 view 경로는 허용 목록 안이다", T, async () => {
    expect(judge(await play(), "names")).toBe("ok");
  });

  it("(3) 산 사람이 밤·아침에 받은 world 프레임의 남의 좌표는 근처 반경 안이면서 같은 구역이고, 밤에는 남의 좌표·걸음이 없다 (A5)", T, async () => {
    expect(judge(await play(), "world")).toBe("ok");
  });

  it("(4) 길게 누르기·살피기·밤 집 고르기·거절·건너뛰기의 응답은 역할과 무관하게 같은 종류·같은 프레임 수·같은 구조다 (D-06·D-10·D-15·D-23)", T, async () => {
    expect(judge(await play(), "responses")).toBe("ok");
  });

  it("(5) 산 사람 프레임에는 남의 role·job 값이 없고 유령의 spectate 만 예외다 — 처형된 사람의 정체도 다음 저녁까지 비공개다 (결정 0021·D-20)", T, async () => {
    expect(judge(await play(), "roles")).toBe("ok");
  });
});
