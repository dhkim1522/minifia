// 21-02 마을 확장판 저녁의 가로등 배정·처리 워커 시험(D-05·D-07, 결정 0088, 위협 T-21-04·T-21-05).
// 방 DO 가 저녁(errand)에 들어가면 산 사람마다 가로등 3곳이 서버 전용 키로 서고 본인 view(me.errand)로만 간다. 가로등 중심에 선 사람이 { t: "errand" } 를 보내면 그 소켓만 새 state 를 받는다.
// 원인 흐름은 openCause(), 마을 판은 openTown() 으로 이 시험 동안만 켠다(test/worker/setup.ts 가 잠그고 시작한다). 표본 알람은 이 시험이 보는 것이 아니라 멀리 미룬다.
// 실패 출력은 한 줄이어야 해서(TAP) 목록은 쉼표로 이은 문자열로 비교한다.
import { env } from "cloudflare:workers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TOWN_LAMPS } from "../../shared/game/mapTown";
import { openCause, openTown } from "../helpers/playable";
import { advanceTo, lastViewOf, mark, nextFrame, placeSeats, seat, send, settle, writeRoomEdit } from "./helpers";
import type { Seated } from "./helpers";

type Sock = Seated["host"];
interface Table {
  code: string;
  people: Array<{ sock: Sock; seat: number }>;
}

const LAMP_IDS = ["lamp0", "lamp1", "lamp2", "lamp3", "lamp4", "lamp5", "lamp6", "lamp7"];

/** 방장 + 연결 참가자 셋(넷)으로 시작해 저녁(errand)까지 넘긴 판. 표본 알람은 멀리 미룬다. */
async function errandTable(): Promise<Table> {
  const room = await seat(3, 0);
  const socks = [room.host, ...room.guests.map((g) => g.sock)];
  send(room.host, { t: "start" });
  for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
  await advanceTo(room.code, socks, "errand");
  for (const sock of socks) await settle(sock, mark(sock));
  await writeRoomEdit(env.ROOM.getByName(room.code), (r) => ({ ...r, errandTickAt: Date.now() + 3_600_000 }));
  return { code: room.code, people: [{ sock: room.host, seat: 0 }, ...room.guests.map((g) => ({ sock: g.sock, seat: g.seat }))] };
}

const lampCenterFx = (id: string): { x: number; z: number } => {
  const lamp = TOWN_LAMPS.find((l) => l.id === id)!;
  return { x: Math.round(lamp.x * 100), z: Math.round(lamp.z * 100) };
};

describe("마을 확장판 저녁 — 가로등 배정·처리 (openCause + openTown)", () => {
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

  it("저녁의 errand 프레임: 소켓 넷 모두 me.errand.places 가 가로등 id 서로 다른 3곳이고 done 은 비어 있다", { timeout: 60_000 }, async () => {
    const { people } = await errandTable();
    const rows = people.map(({ sock }) => {
      const view = lastViewOf(sock);
      const places = view.me.errand?.places ?? [];
      return `${view.phase}/${view.map}/${places.length}/${new Set(places).size}/${places.every((id) => LAMP_IDS.includes(id))}/${(view.me.errand?.done ?? ["x"]).length}`;
    });
    expect(rows.join(" ")).toBe(Array.from({ length: 4 }, () => "errand/town/3/3/true/0").join(" "));
  });

  it("배정 등불 중심에 선 사람이 errand 를 보내면 그 소켓 me.errand.done 이 1개가 되고 다른 소켓에는 프레임이 가지 않는다", { timeout: 60_000 }, async () => {
    const { code, people } = await errandTable();
    const who = people[1]!;
    const first = lastViewOf(who.sock).me.errand!.places[0]!;
    await placeSeats(code, { [who.seat]: lampCenterFx(first) });
    const marks = people.map(({ sock }) => mark(sock));
    send(who.sock, { t: "errand" });
    const got = await Promise.all(people.map(({ sock }, i) => settle(sock, marks[i]!)));
    const mine = lastViewOf(who.sock).me.errand;
    const others = people.map((p, i) => (p === who ? "" : `${got[i]!.length}`)).filter((x) => x !== "").join(",");
    expect(`${mine?.done.join("+")}/${mine?.done.length}/${others}`).toBe(`${first}/1/0,0,0`);
  });

  it("반경 밖(가로등에서 1.3)·배정 안 된 가로등 위의 errand 는 처리되지 않는다 — done 은 비어 있다", { timeout: 60_000 }, async () => {
    const { code, people } = await errandTable();
    const who = people[2]!;
    const mine: readonly string[] = lastViewOf(who.sock).me.errand!.places;
    const first = mine[0]!;
    const unassigned = LAMP_IDS.find((id) => !mine.includes(id))!;
    const near = lampCenterFx(first);
    await placeSeats(code, { [who.seat]: { x: near.x + 130, z: near.z } });
    send(who.sock, { t: "errand" });
    await settle(who.sock, mark(who.sock));
    const afterFar = lastViewOf(who.sock).me.errand?.done.length;
    await new Promise((resolve) => setTimeout(resolve, 300));
    await placeSeats(code, { [who.seat]: lampCenterFx(unassigned) });
    send(who.sock, { t: "errand" });
    await settle(who.sock, mark(who.sock));
    expect(`${afterFar}/${lastViewOf(who.sock).me.errand?.done.length}`).toBe("0/0");
  });
});
