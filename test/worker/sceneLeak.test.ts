// 21-04 아침 현장 누설 시험(D-13·D-15·D-16·D-21, 위협 T-21-12·T-21-13·T-21-14·T-21-16): 마을 확장판 원인 흐름의 아침에 피해자 집 좌석만 모두에게 공개되고(day.scene = { house }),
// 산 사람이 지점을 살피면 본인만 단서(me.scene)를 받는다. 마피아·시민의 inspect 응답은 같은 모양이고 먼저 손댄 표시·발자국 전체 수·조각 원본은 어떤 프레임에도 키로 나가지 않는다.
// "오지 않았음" 은 settle(ping/pong)로 증명한다. 위치는 메모리 world 에 직접 놓는다(placeSeats — lampLeak.test.ts 의 선례). 다른 시험 파일을 import 하지 않는다 — keyPaths 는 이 파일의 것이다.
// 실패 출력은 한 줄이어야 해서(TAP) 프레임은 문자열로 비교한다.
import { env } from "cloudflare:workers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TOWN_CLUE_SPOTS } from "../../shared/game/mapTown";
import { ERRAND_MIN_GAP_MS } from "../../shared/game/phases";
import type { ClueLine, ServerMessage } from "../../shared/protocol";
import { openCause, openTown } from "../helpers/playable";
import { actorsOf, advanceTo, lastViewOf, mark, nextFrame, pause, pickAs, placeSeats, seat, send, settle, storedRoom, withRole, writeRoomEdit } from "./helpers";
import type { Actor, Game } from "./helpers";

function keyPaths(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => keyPaths(v, `${path}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [`${path}.${k}`, ...keyPaths(v, `${path}.${k}`)]);
  }
  return [];
}

/**
 * 응답 모양: 프레임 종류 + view.day 아래 키 경로 집합. view.me 는 역할·유령 여부로 원래 키가 다르므로(me.role·me.allies 등) 모양 비교에서 뺀다 —
 * 단서 줄(me.scene)은 본인이 받는 값이라 길이·내용을 시험이 따로 본다. 응답 횟수·종류와 공개 day 모양이 마피아·시민·거절에서 같음을 증명한다.
 */
function shapeOf(msgs: ServerMessage[]): string {
  return msgs
    .map((m) => {
      const paths = keyPaths(m).filter((p) => p.startsWith(".view.day"));
      return `${m.t}:${[...new Set(paths)].sort().join(",")}`;
    })
    .join("|");
}

/** 서버 전용 현장 값이 키로 나가는지 보는 이름들(ClueLine.spot 의 값 "cloth"·"window" 는 값이라 키 이름과 겹치지 않는다). */
const SERVER_ONLY_KEYS = new Set(["footprints", "touched", "sceneSeen", "cloth", "window", "windowLit", "errandCut"]);

interface StoredScene {
  scene?: { house: number; footprints: number; cloth?: string; window?: string; windowLit: boolean; touched: Record<string, true> };
  players: Array<{ seat: number; sceneSeen?: ClueLine[] }>;
}
const storedOf = async (code: string): Promise<StoredScene> => (await storedRoom(code)) as unknown as StoredScene;

interface Morning {
  g: Game;
  house: number;
  m1: Actor;
  m2: Actor;
  victim: Actor;
  c2: Actor;
  police: Actor;
  doctor: Actor;
}

/** 6명이 시작해 저녁 → 밤으로 넘기고 마피아 둘과 시민 c2 가 시민 victim 을 골라 아침(morning, 현장 있음)까지 넘긴 판. 모든 집 창을 켜 둔다(창문 지점이 조각을 내게). */
async function morningGame(): Promise<Morning> {
  const room = await seat(5, 0);
  const socks = [room.host, ...room.guests.map((g) => g.sock)];
  send(room.host, { t: "start" });
  for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
  await advanceTo(room.code, socks, "errand");
  for (const sock of socks) await settle(sock, mark(sock));
  const g: Game = { code: room.code, socks, actors: actorsOf(room) };
  await advanceTo(g.code, g.socks, "night");
  for (const sock of g.socks) await settle(sock, mark(sock));
  await writeRoomEdit(env.ROOM.getByName(g.code), (r) => ({ ...r, lamps: Array.from({ length: 8 }, () => true) }));
  const [m1, m2] = withRole(g, "mafia") as [Actor, Actor];
  const [victim, c2] = withRole(g, "citizen") as [Actor, Actor];
  const police = withRole(g, "police")[0]!;
  const doctor = withRole(g, "doctor")[0]!;
  for (const [who, target] of [[m1, victim], [m2, victim], [c2, victim], [police, doctor], [doctor, police]] as Array<[Actor, Actor]>) pickAs(who, target.seat);
  for (const sock of g.socks) await settle(sock, mark(sock));
  await advanceTo(g.code, g.socks, "morning");
  for (const sock of g.socks) await settle(sock, mark(sock));
  return { g, house: victim.seat, m1, m2, victim, c2, police, doctor };
}

/** 지점 k 의 중심에 세우고 inspect 를 보낸다. 보낸 소켓이 받은 프레임과 다른 모든 소켓의 프레임을 돌려준다. */
async function inspect(g: Game, house: number, who: Actor, k: number, at?: { x: number; z: number }): Promise<{ mine: ServerMessage[]; others: ServerMessage[][] }> {
  await placeSeats(g.code, { [who.seat]: at ?? TOWN_CLUE_SPOTS[house]![k]! });
  await pause(ERRAND_MIN_GAP_MS + 50);
  const marks = g.actors.map((a) => mark(a.sock));
  send(who.sock, { t: "inspect" });
  const self = g.actors.indexOf(who);
  const mine = await settle(who.sock, marks[self]!);
  const others: ServerMessage[][] = [];
  for (const [i, a] of g.actors.entries()) if (i !== self) others.push(await settle(a.sock, marks[i]!));
  return { mine, others };
}

const sceneOf = (sock: Actor["sock"]): ClueLine[] => (lastViewOf(sock).me as { scene?: ClueLine[] }).scene ?? [];
const dayOf = (sock: Actor["sock"]): { scene?: { house: number } } | undefined => lastViewOf(sock).day as { scene?: { house: number } } | undefined;
const noOthers = (r: { others: ServerMessage[][] }): string => r.others.map((f) => f.length).join(",");

describe("마을 확장판 아침 현장 — 집 좌석만 공개되고 단서는 본인만 받는다 (openCause + openTown)", () => {
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

  it("피해자가 나온 아침: 모든 소켓(유령 포함)의 day.scene 이 { house: 피해자 좌석 } 로 같고 직업·수·조각 키가 어디에도 없다. 아직 아무도 살피지 않아 me.scene 도 없다", { timeout: 120_000 }, async () => {
    const mg = await morningGame();
    const houses = new Set(mg.g.actors.map((a) => JSON.stringify(dayOf(a.sock)?.scene)));
    expect([...houses].join("|")).toBe(JSON.stringify({ house: mg.house }));
    expect(mg.g.actors.map((a) => Object.keys(dayOf(a.sock)?.scene ?? {}).join(",")).join(" ")).toBe(Array.from({ length: 6 }, () => "house").join(" "));
    const bad: string[] = [];
    for (const a of mg.g.actors) {
      for (const raw of a.sock.frames) {
        const msg = JSON.parse(raw) as ServerMessage;
        for (const p of keyPaths(msg)) if (SERVER_ONLY_KEYS.has(p.split(".").at(-1) ?? "")) bad.push(p);
      }
    }
    expect([...new Set(bad)].join(",")).toBe("");
    expect(mg.g.actors.map((a) => sceneOf(a.sock).length).join(",")).toBe("0,0,0,0,0,0");
    const stored = await storedOf(mg.g.code);
    expect(`${stored.scene?.house === mg.house}/${stored.scene?.footprints}`).toBe("true/3"); // 마피아 둘 + 시민 c2
  });

  it("마피아와 시민의 inspect 응답은 같은 모양(저장 한 번 + 본인 state 한 프레임)이고 다른 소켓에는 프레임이 가지 않는다. 각자 me.scene 길이 1", { timeout: 120_000 }, async () => {
    const mg = await morningGame();
    const m = await inspect(mg.g, mg.house, mg.m1, 1); // 옷 조각 지점(마피아)
    const c = await inspect(mg.g, mg.house, mg.c2, 2); // 창문 지점(시민, 창이 켜져 조각이 나온다)
    expect([m.mine, c.mine].map((f) => f.map((x) => x.t).join(",")).join(" ")).toBe("state state");
    expect(shapeOf(m.mine)).toBe(shapeOf(c.mine));
    expect([noOthers(m), noOthers(c)].join(" ")).toBe("0,0,0,0,0 0,0,0,0,0");
    expect(`${sceneOf(mg.m1.sock).length}/${sceneOf(mg.c2.sock).length}`).toBe("1/1");
    const stored = await storedOf(mg.g.code);
    const mLine = sceneOf(mg.m1.sock)[0]!;
    const cLine = sceneOf(mg.c2.sock)[0]!;
    expect(`${mLine.spot}/${mLine.r}/${mLine.piece === stored.scene?.cloth}|${cLine.spot}/${cLine.r}/${cLine.piece === stored.scene?.window}`).toBe("cloth/clue/true|window/clue/true");
    // 저장 행은 본인에게만: 마피아 행에만 touched 가 켜지고(서버 전용) 다른 사람의 줄은 없다.
    expect(`${Object.keys(stored.scene?.touched ?? {}).join(",")}/${stored.players.filter((p) => p.sceneSeen !== undefined).length}`).toBe("cloth/2");
  });

  it("먼저 손댄 흔적: 마피아가 살핀 지점을 뒤에 살핀 시민은 touched 줄을 받고 응답 모양은 평소 단서 응답과 같다. 시민이 먼저 살핀 지점은 흐려지지 않는다", { timeout: 120_000 }, async () => {
    const mg = await morningGame();
    const first = await inspect(mg.g, mg.house, mg.c2, 0); // 발자국, 시민이 먼저 → 평소 단서
    await inspect(mg.g, mg.house, mg.m1, 1); // 옷 조각, 마피아가 먼저
    const blurred = await inspect(mg.g, mg.house, mg.police, 1); // 같은 지점, 마피아 뒤 → 흔적
    const plain = await inspect(mg.g, mg.house, mg.m2, 0); // 시민이 먼저 살핀 발자국 → 마피아도 평소 단서
    const after = await inspect(mg.g, mg.house, mg.doctor, 0); // 마피아 m2 가 살핀 뒤 → 흔적
    expect(sceneOf(mg.c2.sock)[0]?.r).toBe("clue");
    expect(sceneOf(mg.m1.sock)[0]?.r).toBe("clue");
    expect(sceneOf(mg.police.sock)[0]?.r).toBe("touched");
    expect(sceneOf(mg.m2.sock)[0]?.r).toBe("clue");
    expect(sceneOf(mg.doctor.sock)[0]?.r).toBe("touched");
    // 흔적 줄에는 수·조각이 없다.
    expect(JSON.stringify(sceneOf(mg.police.sock)[0])).toBe(JSON.stringify({ spot: "cloth", r: "touched" }));
    // 응답 모양: 평소 단서·흔적 모두 state 한 프레임이고 같은 구조다. 다른 소켓에는 프레임이 없다.
    const all = [first, blurred, plain, after];
    expect(all.map((r) => r.mine.map((f) => f.t).join(",")).join(" ")).toBe("state state state state");
    expect(new Set(all.map((r) => shapeOf(r.mine))).size).toBe(1);
    expect(all.map(noOthers).join(" ")).toBe(Array.from({ length: 4 }, () => "0,0,0,0,0").join(" "));
    // 발자국 수는 지점 ① 을 살핀 사람의 me.scene 에만 있다 — 저장된 수와 같고 공개 day.scene 에는 없다.
    const stored = await storedOf(mg.g.code);
    expect(`${sceneOf(mg.c2.sock)[0]?.n === stored.scene?.footprints}/${Object.keys(dayOf(mg.m1.sock)?.scene ?? {}).join(",")}`).toBe("true/house");
  });

  it("같은 지점 다시·반경 밖·유령의 inspect 는 모두 상태 변화 없이 본인 state 한 프레임(같은 모양)이다", { timeout: 120_000 }, async () => {
    const mg = await morningGame();
    const ok = await inspect(mg.g, mg.house, mg.c2, 0);
    const before = JSON.stringify((await storedOf(mg.g.code)).players.map((p) => p.sceneSeen ?? null));
    const far = await inspect(mg.g, mg.house, mg.c2, 0, { x: 0, z: 0 }); // 광장 가운데 — 반경 밖
    const ghost = await inspect(mg.g, mg.house, mg.victim, 0); // 피해자 유령
    const mafiaFar = await inspect(mg.g, mg.house, mg.m1, 0, { x: 0, z: 0 });
    const rejects = [far, ghost, mafiaFar];
    expect(rejects.map((r) => r.mine.map((f) => f.t).join(",")).join(" ")).toBe("state state state");
    expect(new Set([ok, ...rejects].map((r) => shapeOf(r.mine))).size).toBe(1);
    expect(rejects.map(noOthers).join(" ")).toBe("0,0,0,0,0 0,0,0,0,0 0,0,0,0,0");
    expect(JSON.stringify((await storedOf(mg.g.code)).players.map((p) => p.sceneSeen ?? null))).toBe(before);
    expect(`${sceneOf(mg.victim.sock).length}/${sceneOf(mg.m1.sock).length}`).toBe("0/0");
  });

  it("토론 단계 view 에는 day.scene 이 없고 살핀 사람의 me.scene 은 남는다. 다음 저녁에는 me.scene·저장된 scene·sceneSeen 이 없다", { timeout: 180_000 }, async () => {
    const mg = await morningGame();
    await inspect(mg.g, mg.house, mg.c2, 0);
    await advanceTo(mg.g.code, mg.g.socks, "discussion");
    for (const sock of mg.g.socks) await settle(sock, mark(sock));
    expect(mg.g.actors.map((a) => dayOf(a.sock)?.scene === undefined).join(",")).toBe("true,true,true,true,true,true");
    expect(mg.g.actors.map((a) => sceneOf(a.sock).length).join(",")).toBe(mg.g.actors.map((a) => (a === mg.c2 ? 1 : 0)).join(","));
    await advanceTo(mg.g.code, mg.g.socks, "errand");
    for (const sock of mg.g.socks) await settle(sock, mark(sock));
    expect(mg.g.actors.map((a) => sceneOf(a.sock).length).join(",")).toBe("0,0,0,0,0,0");
    const stored = await storedOf(mg.g.code);
    expect(`${"scene" in stored}/${stored.players.filter((p) => "sceneSeen" in p).length}`).toBe("false/0");
  });
});
