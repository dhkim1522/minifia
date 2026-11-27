import { expect, it } from "vitest";
import { ANIMAL_IDS } from "../../shared/game/animals";
import { closePhase, connect, endedGame4, hello, lastViewOf, mark, nextFrame, seat, send, settle, until } from "./helpers";

it("두 참가자가 같은 동물을 동시에 고를 때 한 명만 받고 재접속에도 유지한다", async () => {
  const { code, host, guests } = await seat(2, 0);
  const [a, b] = guests as [typeof guests[number], typeof guests[number]];
  await settle(host, mark(host));
  const roster = lastViewOf(host).players;
  const unused = ANIMAL_IDS.find((animal) => roster.every((p) => p.animal !== animal))!;
  send(a.sock, { t: "animalPick", animal: unused });
  send(b.sock, { t: "animalPick", animal: unused });
  await Promise.all([host, a.sock, b.sock].map((sock) => settle(sock, mark(sock))));
  await until("경합 결과 방송", async () => [host, a.sock, b.sock].every((sock) =>
    lastViewOf(sock).players.some((p) => p.animal === unused),
  ));
  const visible = lastViewOf(host).players;
  const assigned = visible.filter((p) => p.animal === unused);
  expect(assigned).toHaveLength(1);
  expect(new Set(visible.map((p) => p.animal)).size).toBe(3);
  const winner = assigned[0]!.seat === a.seat ? a : b;
  const loser = winner === a ? b : a;
  expect(visible.find((p) => p.seat === loser.seat)?.animal).toBe(roster.find((p) => p.seat === loser.seat)?.animal);
  for (const sock of [a.sock, b.sock]) expect(lastViewOf(sock).players.map((p) => p.animal)).toEqual(visible.map((p) => p.animal));

  const reconnected = await connect(code);
  await hello(reconnected, winner.token);
  expect(lastViewOf(reconnected).players.find((p) => p.seat === winner.seat)?.animal).toBe(unused);
  send(reconnected, { t: "leave" });
  await until("선택한 참가자 나가기", async () => lastViewOf(host).players.every((p) => p.seat !== winner.seat));
  send(loser.sock, { t: "animalPick", animal: unused });
  await until("빈 동물 선택", async () => lastViewOf(host).players.find((p) => p.seat === loser.seat)?.animal === unused);
});

it("결과와 다시 하기에서 같은 동물을 보존하고 경기 중 동물 변경을 거절한다", { timeout: 30_000 }, async () => {
  const game = await endedGame4();
  const roster = lastViewOf(game.socks[0]!).players.map((p) => ({ seat: p.seat, animal: p.animal }));
  await closePhase(game.code);
  await until("같은 방 대기실", async () => lastViewOf(game.socks[0]!).phase === "lobby");
  send(game.socks[0]!, { t: "start" });
  for (const sock of game.socks) {
    const frame = await nextFrame(sock, (msg) => msg.t === "state" && msg.view.round === 2 && msg.view.phase === "assigning");
    if (frame.t !== "state") throw new Error("다시 하기 state 가 없다");
    expect(frame.view.players.map((p) => ({ seat: p.seat, animal: p.animal }))).toEqual(roster);
  }
  const host = game.socks[0]!;
  const unused = ANIMAL_IDS.find((animal) => roster.every((p) => p.animal !== animal))!;
  send(host, { t: "animalPick", animal: unused });
  await settle(host, mark(host));
  expect(lastViewOf(host).players.map((p) => ({ seat: p.seat, animal: p.animal }))).toEqual(roster);
});
