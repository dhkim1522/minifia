// GHOST-01 누설 증명, 결정 0060-8, RESEARCH 메타모픽 설계 (08-09).
// 유령의 위치·움직임은 유령의 폰으로만 간다 — 산 사람 폰에는 네트워크로도 가지 않는다(화면에서 숨기는 방식이 아니다, 결정 0002·0021).
// "오지 않았음" 은 settle(ping/pong)로 증명한다. 실패 출력은 한 줄이어야 해서(TAP) 프레임은 요약 문자열로 비교한다.
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { ghostsOf, mark, send, settle, startedGame, summary, worldFramesOf } from "./helpers";
import type { Actor, Game } from "./helpers";

/** 행동 직전 모든 소켓의 위치를 적고, 행동하고, 모든 소켓을 flush 해 소켓별 프레임을 돌려준다. 보낸 쪽 flush 가 먼저다(처리를 마쳤다는 증거). */
async function observe(g: Game, first: Actor, act: () => void | Promise<void>): Promise<ServerMessage[][]> {
  const marks = g.socks.map((s) => mark(s));
  await act();
  const order = [first, ...g.actors.filter((a) => a !== first)];
  const out: ServerMessage[][] = g.actors.map(() => []);
  for (const a of order) out[g.actors.indexOf(a)] = await settle(a.sock, marks[g.actors.indexOf(a)]!);
  return out;
}

/** world move 프레임만 'seat' 모양으로. */
const moveSeats = (msgs: ServerMessage[]): string =>
  msgs
    .filter((m): m is Extract<ServerMessage, { t: "world"; k: "move" }> => m.t === "world" && m.k === "move")
    .map((m) => `move:${m.s}`)
    .join(",");

/** 5명 판(방장 + 손님 4)을 토론 단계까지 시작해 마피아가 아닌 두 명을 유령으로 만든다. */
async function fiveWithTwoGhosts(): Promise<{ g: Game; ghosts: Actor[]; living: Actor[] }> {
  const g = await startedGame("discussion", 4);
  const doomed = g.actors.filter((a) => a.role !== "mafia").slice(0, 2);
  expect(doomed.length).toBe(2);
  const { ghosts, living } = await ghostsOf(
    g,
    doomed.map((a) => a.seat),
  );
  return { g, ghosts, living };
}

describe("유령 한 걸음 — 트레이서 (GHOST-01, MAP-04)", () => {
  it("유령 X 의 move 는 다른 유령 Y 소켓에 world.move(s = X)로 가고 산 사람 세 소켓은 한 프레임도 받지 않는다", async () => {
    const { g, ghosts, living } = await fiveWithTwoGhosts();
    const [x, y] = ghosts as [Actor, Actor];
    expect(living.length).toBe(3);

    const marks = new Map(g.socks.map((sock) => [sock, mark(sock)] as const));
    const got = await observe(g, x, () => send(x.sock, { t: "move", x: 200, z: 200 }));

    expect(moveSeats(got[g.actors.indexOf(y)]!)).toBe(`move:${x.seat}`);
    expect(moveSeats(got[g.actors.indexOf(x)]!)).toBe(`move:${x.seat}`); // 자기 걸음도 돌려받는다(예측 보정과 같은 길)
    for (const a of living) expect(summary(got[g.actors.indexOf(a)]!)).toBe("[]");
    // 직접 불변식: 산 사람 소켓이 이 걸음 뒤에 받은 world 프레임은 0개다(로비에서 입장 때 받은 프레임은 걸음 전 위치).
    expect(living.map((a) => worldFramesOf(a.sock, marks.get(a.sock)!).length).join(",")).toBe("0,0,0");
  }, 30_000);

  it("산 사람 A 가 토론에서 move 하면 유령을 포함한 모든 소켓이 world.move(s = A)를 받는다", async () => {
    const { g, living } = await fiveWithTwoGhosts();
    const a = living[0]!;

    const got = await observe(g, a, () => send(a.sock, { t: "move", x: -200, z: 100 }));

    for (const actor of g.actors) expect(moveSeats(got[g.actors.indexOf(actor)]!)).toBe(`move:${a.seat}`);
  }, 30_000);
});
