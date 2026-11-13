// 심지 자르기·가로등 공개 값 워커 통합 시험 (21-05 Task 1, D-06·D-07·D-08·D-21, 위협 T-21-10·T-21-11).
// 마을 판 저녁: 시민 C 와 마피아 M 을 각자 목록의 가로등 앞에 두고 둘 다 hold 로 처리한다. 켜기와 자르기는 받는 소켓·프레임 수·view 키 구조가 같아야 하고,
// 자른 번호는 밤의 모든 view 에서 빠지고 lampCut 은 어떤 프레임에도 없다. 실제 시간에 기대지 않는다: 표본 알람은 미루고 서로 다른 사람이 누른다.
// 실패 출력은 한 줄이어야 해서(TAP) 값은 문자열로 견준다.
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { placeCenterFx } from "../../shared/game/errand";
import { TOWN_MAP } from "../../shared/game/mapTown";
import type { ServerMessage } from "../../shared/protocol";
import { advanceTo, lastViewOf, observe, placeSeats, send, storedRoom, townGame, withRole, writeRoomEdit } from "./helpers";
import type { Actor, Game } from "./helpers";

interface StoredPlayer { id: string; seat: number; errandPlaces?: string[]; errandDone?: string[] }
const json = (v: unknown): string => JSON.stringify(v);
const roomOf = async (code: string): Promise<{ players: StoredPlayer[]; lampCut?: string[] }> =>
  (await storedRoom(code)) as unknown as { players: StoredPlayer[]; lampCut?: string[] };
const placesOf = async (g: Game, a: Actor): Promise<string[]> => (await roomOf(g.code)).players.find((p) => p.seat === a.seat)!.errandPlaces!;
const numOf = (place: string): number => Number(place.slice(4));

/** 키 경로 모음(값 없음, 배열은 [] 로 합친다) — 두 프레임의 키 구조 비교용. */
function keyPaths(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => keyPaths(v, `${path}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [`${path}.${k}`, ...keyPaths(v, `${path}.${k}`)]);
  }
  return [];
}
const pathSet = (m: unknown): Set<string> => new Set(keyPaths(m));
/** 누르기 전 마지막 view 와 누른 뒤 받은 마지막 프레임의 키 구조 차이(+더해진 경로, -사라진 경로) — 역할마다 view 의 기본 키가 달라도 누름이 바꾼 구조는 같아야 한다. */
function shapeChange(before: unknown, after: ServerMessage | undefined): string {
  const a = pathSet(before);
  const b = pathSet(after === undefined || after.t !== "state" ? after : after.view);
  return [...[...b].filter((k) => !a.has(k)).map((k) => `+${k}`), ...[...a].filter((k) => !b.has(k)).map((k) => `-${k}`)].sort().join(",");
}

/** 저녁 판에서 actor 를 place 의 가로등 앞에 세우고 errand(hold 선택)를 보낸다 — 응답을 소켓마다 모아 돌려준다(g.actors 순서). */
async function press(g: Game, actor: Actor, place: string, hold: boolean): Promise<ServerMessage[][]> {
  await placeSeats(g.code, { [actor.seat]: placeCenterFx(TOWN_MAP, place)! });
  return observe(g, actor, () => send(actor.sock, hold ? { t: "errand", hold: true } : { t: "errand" }));
}
const counts = (frames: ServerMessage[][]): string => frames.map((f) => f.length).join(",");

async function lampGame(): Promise<{ g: Game; c: Actor; m: Actor; x: string; y: string }> {
  const g = await townGame("errand");
  await writeRoomEdit(env.ROOM.getByName(g.code), (room) => ({ ...room, errandTickAt: Date.now() + 3_600_000 })); // 표본 알람이 누름과 겹쳐 프레임 수가 달라지지 않게 미룬다
  const c = withRole(g, "citizen")[0]!;
  const m = withRole(g, "mafia")[0]!;
  const x = (await placesOf(g, c))[0]!;
  const y = (await placesOf(g, m)).find((p) => p !== x)!;
  return { g, c, m, x, y };
}

describe("켜기와 자르기는 같은 응답이다 (D-21, T-21-10)", () => {
  it("시민 C 와 마피아 M 이 hold 로 처리하면 모든 소켓이 view 한 프레임씩 받고, 본인 view 의 키 구조·me.errand.done 길이가 같다", async () => {
    const { g, c, m, x, y } = await lampGame();
    const cBefore = lastViewOf(c.sock);
    const byC = await press(g, c, x, true);
    const cOwn = g.actors.indexOf(c);
    const cShape = shapeChange(cBefore, byC[cOwn]!.at(-1));
    const cDone = lastViewOf(c.sock).me.errand?.done.length;
    const mBefore = lastViewOf(m.sock);
    const byM = await press(g, m, y, true);
    const mOwn = g.actors.indexOf(m);
    expect(`${counts(byC)} ${counts(byM)}`).toBe(`${g.actors.map(() => 1).join(",")} ${g.actors.map(() => 1).join(",")}`);
    expect(`${shapeChange(mBefore, byM[mOwn]!.at(-1)) === cShape} ${cDone}:${lastViewOf(m.sock).me.errand?.done.length} ${Array.isArray(lastViewOf(c.sock).day?.lamps)}:${Array.isArray(lastViewOf(m.sock).day?.lamps)}`).toBe("true 1:1 true:true");
    expect(json(lastViewOf(g.actors.find((a) => a !== c && a !== m)!.sock).day?.lamps)).toBe(json([numOf(x), numOf(y)].sort((a, b) => a - b)));
  }, 60_000);

  it("이미 켜진 가로등을 다른 사람이 다시 처리하면 보낸 사람만 프레임을 받는다(공개 값이 바뀌지 않는다)", async () => {
    const { g, c, x } = await lampGame();
    await press(g, c, x, false);
    const d = withRole(g, "citizen").find((a) => a !== c)!;
    await writeRoomEdit(env.ROOM.getByName(g.code), (room) => ({
      ...room,
      players: (room.players as StoredPlayer[]).map((p) => (p.seat === d.seat ? { ...p, errandPlaces: [x, ...p.errandPlaces!.filter((q) => q !== x)].slice(0, 3), errandDone: [] } : p)),
    }));
    const again = await press(g, d, x, true);
    const dOwn = g.actors.indexOf(d);
    expect(g.actors.map((_, i) => (i === dOwn ? again[i]!.length > 0 : again[i]!.length === 0)).join(",")).toBe(g.actors.map(() => "true").join(","));
  }, 60_000);

  it("서버에는 자른 장소만 lampCut 에 남고 켠 장소는 없다 — 어떤 소켓의 어떤 프레임에도 lampCut·cut 키가 없다", async () => {
    const { g, c, m, x, y } = await lampGame();
    await press(g, c, x, true);
    await press(g, m, y, true);
    expect(json((await roomOf(g.code)).lampCut)).toBe(json([y]));
    expect(json(g.socks.map((s) => s.frames.some((raw) => raw.includes("lampCut") || raw.includes('"cut"'))))).toBe(json(g.socks.map(() => false)));
  }, 60_000);
});

describe("밤의 가로등 값 (D-06·D-08)", () => {
  it("저녁 마감 → night: 모든 소켓 view 의 day.lamps 에 M 이 자른 번호는 없고 C 가 켠 번호는 있다", async () => {
    const { g, c, m, x, y } = await lampGame();
    await press(g, c, x, true);
    await press(g, m, y, true);
    expect(json(g.actors.map((a) => lastViewOf(a.sock).day?.lamps))).toBe(json(g.actors.map(() => [numOf(x), numOf(y)].sort((a, b) => a - b)))); // 저녁에는 자른 것도 켜진 것처럼 보인다
    await advanceTo(g.code, g.socks, "night");
    const lit = g.actors.map((a) => lastViewOf(a.sock).day?.lamps);
    expect(json(lit)).toBe(json(g.actors.map(() => [numOf(x)])));
  }, 60_000);
});
