// 21-03 심지 자르기 누설 시험(D-06·D-08·D-21, 위협 T-21-07·T-21-08·T-21-09): 마을 확장판 원인 흐름의 저녁에 마피아가 같은 단추를 길게 눌러 등불을 자르고(서버 전용 errandCut),
// 밤이 시작되면 모든 소켓이 같은 boolean 여덟(day.lamps)을 받는다. 마피아·시민의 응답 모양은 같고 자른 사실은 어떤 프레임에도 나가지 않는다.
// "오지 않았음" 은 settle(ping/pong)로 증명한다. 위치는 메모리 world 에 직접 놓는다(placeSeats — lampErrand.test.ts 의 선례). 다른 시험 파일을 import 하지 않는다 — keyPaths 는 이 파일의 것이다.
// 실패 출력은 한 줄이어야 해서(TAP) 프레임은 문자열로 비교한다.
import { env } from "cloudflare:workers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TOWN_LAMPS } from "../../shared/game/mapTown";
import { ERRAND_MIN_GAP_MS } from "../../shared/game/phases";
import type { ServerMessage } from "../../shared/protocol";
import { openCause, openTown } from "../helpers/playable";
import { actorsOf, advanceTo, ghostsOf, lastViewOf, mark, nextFrame, pause, placeSeats, seat, send, settle, storedRoom, withRole, writeRoomEdit } from "./helpers";
import type { Actor, Game, TestSocket } from "./helpers";

const LAMP_IDS: readonly string[] = ["lamp0", "lamp1", "lamp2", "lamp3", "lamp4", "lamp5", "lamp6", "lamp7"];

function keyPaths(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => keyPaths(v, `${path}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [`${path}.${k}`, ...keyPaths(v, `${path}.${k}`)]);
  }
  return [];
}

/** 응답 모양(프레임 종류 + 이 시험이 보는 경로의 키 집합). 값(어느 등불인지)은 빼고 구조만 비교한다. */
function shapeOf(msgs: ServerMessage[]): string {
  return msgs
    .map((m) => {
      const paths = keyPaths(m).filter((p) => p.startsWith(".view.me.errand") || p.startsWith(".view.day"));
      return `${m.t}:${[...new Set(paths)].sort().join(",")}`;
    })
    .join("|");
}

const lampCenterFx = (id: string): { x: number; z: number } => {
  const lamp = TOWN_LAMPS.find((l) => l.id === id)!;
  return { x: Math.round(lamp.x * 100), z: Math.round(lamp.z * 100) };
};

interface StoredPlayerRow {
  id: string;
  seat: number;
  errandPlaces?: string[];
  errandDone?: string[];
  errandCut?: string[];
}
const rowsOf = async (code: string): Promise<StoredPlayerRow[]> => ((await storedRoom(code)) as unknown as { players: StoredPlayerRow[] }).players;

/** 6명(방장 + 손님 5)이 시작해 저녁(errand)까지 넘긴 판. 역할은 저녁 view 에서 읽는다. 표본 알람은 멀리 미룬다. */
async function eveningGame(): Promise<Game> {
  const room = await seat(5, 0);
  const socks = [room.host, ...room.guests.map((g) => g.sock)];
  send(room.host, { t: "start" });
  for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
  await advanceTo(room.code, socks, "errand");
  for (const sock of socks) await settle(sock, mark(sock));
  await writeRoomEdit(env.ROOM.getByName(room.code), (r) => ({ ...r, errandTickAt: Date.now() + 3_600_000 }));
  return { code: room.code, socks, actors: actorsOf(room) };
}

/** 가로등 중심에 세우고 type=errand 를 보낸다. 보낸 소켓이 받은 프레임과 다른 모든 소켓의 프레임을 돌려준다. */
async function press(g: Game, who: Actor, lampId: string, hold: boolean | undefined): Promise<{ mine: ServerMessage[]; others: ServerMessage[][] }> {
  await placeSeats(g.code, { [who.seat]: lampCenterFx(lampId) });
  await pause(ERRAND_MIN_GAP_MS + 50);
  const marks = g.actors.map((a) => mark(a.sock));
  send(who.sock, hold === undefined ? { t: "errand" } : { t: "errand", hold });
  const self = g.actors.indexOf(who);
  const mine = await settle(who.sock, marks[self]!);
  const others: ServerMessage[][] = [];
  for (const [i, a] of g.actors.entries()) if (i !== self) others.push(await settle(a.sock, marks[i]!));
  return { mine, others };
}

const doneCountOf = (sock: TestSocket): number => lastViewOf(sock).me.errand?.done.length ?? -1;

describe("마을 확장판 심부름 — 마피아의 길게 누르기는 응답이 시민과 같고 자른 사실은 어디에도 없다 (openCause + openTown)", () => {
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

  it("마피아·시민의 hold 응답(종류·구조)이 같고 hold 가 있든 없든 같다, 거절도 같은 모양이며 다른 소켓에는 프레임이 없다(저녁 중 남의 처리는 방송하지 않는다)", { timeout: 120_000 }, async () => {
    const g = await eveningGame();
    const m = withRole(g, "mafia")[0]!;
    const c = withRole(g, "citizen")[0]!;
    const mPlaces: readonly string[] = lastViewOf(m.sock).me.errand!.places;
    const cPlaces: readonly string[] = lastViewOf(c.sock).me.errand!.places;
    expect(LAMP_IDS.includes(mPlaces[0]!) && LAMP_IDS.includes(cPlaces[0]!)).toBe(true);
    // 시민의 hold 로 켜는 등불은 마피아가 자를 등불과 다른 곳을 고른다.
    const cHold = cPlaces.find((id) => id !== mPlaces[0])!;
    const cPlain = cPlaces.find((id) => id !== cHold && id !== mPlaces[0])!;

    const mHold = await press(g, m, mPlaces[0]!, true);
    const cHeld = await press(g, c, cHold, true);
    const mPlain = await press(g, m, mPlaces[1]!, undefined);
    const cPlainFrames = await press(g, c, cPlain, false);
    // 마피아·시민·hold 유무에 관계없이 받아들임 응답은 state 한 프레임이고 구조가 같다.
    const accepted = [mHold, cHeld, mPlain, cPlainFrames];
    expect(accepted.map((r) => r.mine.map((f) => f.t).join(",")).join(" ")).toBe("state state state state");
    expect(new Set(accepted.map((r) => shapeOf(r.mine))).size).toBe(1);
    // 다른 소켓(경찰·의사·유령 자리 포함)은 프레임을 받지 않는다.
    expect(accepted.map((r) => r.others.map((f) => f.length).join(",")).join(" ")).toBe(Array.from({ length: 4 }, () => "0,0,0,0,0").join(" "));
    // 두 사람의 done 은 각자 2개(hold 한 번 + 그냥 한 번).
    expect(`${doneCountOf(m.sock)}/${doneCountOf(c.sock)}`).toBe("2/2");

    // 같은 등불을 다시 hold: 마피아·시민 모두 같은 거절 모양(본인 state 한 프레임), 처리 개수는 그대로.
    const mAgain = await press(g, m, mPlaces[0]!, true);
    const cAgain = await press(g, c, cHold, true);
    expect([mAgain, cAgain].map((r) => r.mine.map((f) => f.t).join(",")).join(" ")).toBe("state state");
    expect(shapeOf(mAgain.mine)).toBe(shapeOf(cAgain.mine));
    expect(shapeOf(mAgain.mine)).toBe(shapeOf(mHold.mine));
    expect([mAgain, cAgain].map((r) => r.others.map((f) => f.length).join(",")).join(" ")).toBe("0,0,0,0,0 0,0,0,0,0");
    expect(`${doneCountOf(m.sock)}/${doneCountOf(c.sock)}`).toBe("2/2");

    // 서버 저장: 마피아 행에만 errandCut(자른 등불 하나), 시민 행에는 키가 없다.
    const rows = await rowsOf(g.code);
    const mRow = rows.find((p) => p.seat === m.seat)!;
    const cRow = rows.find((p) => p.seat === c.seat)!;
    expect(`${(mRow.errandCut ?? []).join("+")}/${Object.hasOwn(cRow, "errandCut")}`).toBe(`${mPlaces[0]}/false`);
  });

  it("밤 진입: 모든 소켓(유령 포함)의 day.lamps 가 같은 boolean 여덟 개이고 자른 등불은 꺼짐·시민이 켠 등불은 켜짐·안 켠 등불은 꺼짐이다. 저녁 view 에는 lamps 키가 없다", { timeout: 120_000 }, async () => {
    const g = await eveningGame();
    const m = withRole(g, "mafia")[0]!;
    const c = withRole(g, "citizen")[0]!;
    const ghost = withRole(g, "citizen")[1]!;
    const mPlaces: readonly string[] = lastViewOf(m.sock).me.errand!.places;
    const cPlaces: readonly string[] = lastViewOf(c.sock).me.errand!.places;
    const cLit = cPlaces.find((id) => id !== mPlaces[0])!;
    await press(g, m, mPlaces[0]!, true); // 자른다
    await press(g, m, mPlaces[1]!, true); // 이 등불도 자르면서 켠다
    await press(g, c, cLit, true); // 시민의 hold 는 그냥 켜기
    // 저녁 동안 어떤 소켓의 마지막 state 에도 lamps 가 없다.
    expect(g.socks.map((s) => keyPaths(lastViewOf(s)).includes(".day.lamps")).join(",")).toBe("false,false,false,false,false,false");

    // 저녁 시민 한 명을 유령으로 만든다 — 밤 진입 프레임은 유령에게도 같은 값으로 간다.
    await ghostsOf(g, [ghost.seat]);
    const marks = g.actors.map((a) => mark(a.sock));
    await advanceTo(g.code, g.socks, "night");
    for (const [i, a] of g.actors.entries()) await settle(a.sock, marks[i]!);

    const lampsOf = (s: TestSocket): string => ((lastViewOf(s).day as { lamps?: boolean[] } | undefined)?.lamps ?? []).join(",");
    const seen = new Set(g.actors.map((a) => lampsOf(a.sock)));
    expect(seen.size).toBe(1);
    const lamps = ((lastViewOf(m.sock).day as { lamps?: boolean[] }).lamps ?? []) as boolean[];
    expect(`${lamps.length}/${lamps.every((v) => typeof v === "boolean")}`).toBe("8/true");
    // 기대값은 저장된 처리·자르기에서 시험이 독립 계산한다: 켠 사람이 있고 마피아가 자르지 않은 등불만 켜짐.
    const rows = await rowsOf(g.code);
    const done = new Set(rows.flatMap((p) => p.errandDone ?? []));
    const cut = new Set(rows.flatMap((p) => p.errandCut ?? []));
    const expected = LAMP_IDS.map((id) => done.has(id) && !cut.has(id));
    expect(lamps.join(",")).toBe(expected.join(","));
    expect(`${lamps[LAMP_IDS.indexOf(mPlaces[0]!)]}/${lamps[LAMP_IDS.indexOf(mPlaces[1]!)]}/${lamps[LAMP_IDS.indexOf(cLit)]}`).toBe("false/false/true");
    expect(lamps.some((v, i) => !v && !done.has(LAMP_IDS[i]!))).toBe(true); // 아무도 안 켠 등불이 있고 꺼져 있다
  });

  it("처음부터 토론까지 어떤 소켓의 어떤 프레임에도 errandCut·cut 키가 없고, 저녁 단계 프레임에는 lamps 키가 없다", { timeout: 120_000 }, async () => {
    const g = await eveningGame();
    const m = withRole(g, "mafia")[0]!;
    const mPlaces: readonly string[] = lastViewOf(m.sock).me.errand!.places;
    await press(g, m, mPlaces[0]!, true);
    await advanceTo(g.code, g.socks, "discussion");
    for (const s of g.socks) await settle(s, mark(s));
    const violations: string[] = [];
    let lampFrames = 0;
    for (const s of g.socks) {
      for (const raw of s.frames) {
        const msg = JSON.parse(raw) as ServerMessage;
        const paths = keyPaths(msg);
        if (raw.includes("errandCut")) violations.push("raw errandCut");
        if (paths.some((p) => p.endsWith(".errandCut") || p.endsWith(".cut"))) violations.push("key cut");
        if (msg.t === "state" && paths.includes(".view.day.lamps")) {
          lampFrames += 1;
          if (msg.view.phase === "errand") violations.push("lamps in errand");
        }
      }
    }
    expect(violations.join(" | ")).toBe("");
    expect(lampFrames).toBeGreaterThan(0); // 밤·아침·토론 view 에는 있다
  });
});
