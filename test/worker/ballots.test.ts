// 찬반 기록 공개의 서버 층 DO 시험(09.1.1-03, POL-03, 결정 0066-3·0066-7, L19).
// 찬반 마감 훅이 편든 좌석 목록을 남기고, 처형 단계 view 가 모든 소켓에 같은 목록을 싣는다. 찬반 진행 중에는 던진 좌석(voted)뿐이다.
import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { EXECUTION_MS, VERDICT_LEAD_MS } from "../../shared/game/phases";
import { advanceTo, chatRecordsOf, chatsOf, closePhase, connect, framesOf, helloForLog, lastViewOf, mark, nextFrame, pointAll, settle, startedGame, storedRoom, verdictAll } from "./helpers";
import type { Game } from "./helpers";

const viewsOf = (msgs: ServerMessage[]): RoomView[] =>
  msgs.filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state").map((m) => m.view);

/** 지금 nomination 인 판에서 산 사람 모두가 defender 를 지목해 변론 -> 찬반까지 끌고 간다. 유권자 = 산 사람 중 변론자를 뺀 사람(좌석 오름차순). */
async function toVerdictFor(g: Game, defender: Game["actors"][number]): Promise<Game["actors"]> {
  const alive = new Set(((await storedRoom(g.code)).players as unknown as Array<{ seat: number; alive?: boolean }>).filter((p) => p.alive !== false).map((p) => p.seat));
  const voters = g.actors.filter((a) => alive.has(a.seat) && a.seat !== defender.seat).sort((a, b) => a.seat - b.seat);
  const bySeat: Record<number, number> = { [defender.seat]: voters[0]!.seat };
  for (const o of voters) bySeat[o.seat] = defender.seat;
  await pointAll(g.code, g.actors, bySeat);
  await closePhase(g.code); // 변론 -> 찬반
  for (const sock of g.socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "verdict");
  return voters;
}

/** 지목 -> 변론 -> 찬반까지 끌고 간 판: 시민 한 명이 변론자, 나머지(5명)는 좌석 오름차순 유권자다. */
async function toVerdict(): Promise<{ g: Game; defender: Game["actors"][number]; voters: Game["actors"] }> {
  const g = await startedGame("nomination");
  const defender = g.actors.find((a) => a.role === "citizen")!;
  const voters = await toVerdictFor(g, defender);
  return { g, defender, voters };
}

describe("찬반 기록 공개 (결정 0066-3, L19)", () => {
  it("3:1:미투표 로 마감하면 처형 단계의 모든 소켓이 같은 day.ballots 를 받고 변론자·미투표 좌석은 어느 목록에도 없다; 단계는 5600ms", async () => {
    const { g, defender, voters } = await toVerdict();
    const deadline = await verdictAll(g.code, g.actors, {
      [voters[0]!.seat]: true,
      [voters[1]!.seat]: true,
      [voters[2]!.seat]: true,
      [voters[3]!.seat]: false,
    });
    const want = JSON.stringify({ yes: [voters[0]!.seat, voters[1]!.seat, voters[2]!.seat], no: [voters[3]!.seat] });
    const views = g.socks.map(lastViewOf);
    expect(views.map((v) => v.phase).join(",")).toBe(g.socks.map(() => "execution").join(","));
    expect(views.map((v) => JSON.stringify(v.day?.ballots)).join("|")).toBe(g.socks.map(() => want).join("|"));
    const listed = views.flatMap((v) => [...(v.day?.ballots?.yes ?? []), ...(v.day?.ballots?.no ?? [])]);
    expect(listed.includes(defender.seat)).toBe(false);
    expect(listed.includes(voters[4]!.seat)).toBe(false);
    // 유령이 된 변론자 소켓도 같은 목록을 받는다
    const defIdx = g.actors.findIndex((a) => a.seat === defender.seat);
    expect(JSON.stringify(views[defIdx]!.day?.ballots)).toBe(want);
    // 처형 단계 길이: 공개 값만의 함수(5000 + 판결 앞머리 600)
    expect(EXECUTION_MS).toBe(5000 + VERDICT_LEAD_MS);
    expect(views.map((v) => v.phaseDurationMs).join(",")).toBe(g.socks.map(() => "5600").join(","));
    expect((await storedRoom(g.code)).phaseEndsAt).toBe(deadline + 5600);
  }, 60_000);

  it("찬반(verdict) 진행 중의 모든 프레임에는 어떤 소켓도 day.ballots 키를 받지 않고, 처형이 끝나 밤으로 가면 다시 없다", async () => {
    const { g, voters } = await toVerdict();
    await verdictAll(g.code, g.actors, { [voters[0]!.seat]: true, [voters[1]!.seat]: false, [voters[2]!.seat]: true });
    await closePhase(g.code); // 처형 -> 밤
    for (const sock of g.socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "night");
    for (const [i, sock] of g.socks.entries()) {
      const phases = viewsOf(framesOf(sock)).map((v) => `${v.phase}:${Object.hasOwn(v.day ?? {}, "ballots")}`);
      expect(`${i}/${phases.filter((p) => p.startsWith("verdict:")).join(",")}`).toBe(
        `${i}/${phases.filter((p) => p.startsWith("verdict:")).map(() => "verdict:false").join(",")}`,
      );
      expect(phases.filter((p) => p.startsWith("verdict:")).length > 0).toBe(true);
      expect(phases.filter((p) => p.startsWith("execution:")).every((p) => p === "execution:true")).toBe(true);
      expect(phases.filter((p) => p.startsWith("night:")).every((p) => p === "night:false")).toBe(true);
    }
  }, 60_000);

  it("부결(찬성 2 / 반대 2)이어도 day.ballots 가 실린다", async () => {
    const { g, voters } = await toVerdict();
    await verdictAll(g.code, g.actors, {
      [voters[0]!.seat]: true,
      [voters[1]!.seat]: true,
      [voters[2]!.seat]: false,
      [voters[3]!.seat]: false,
    });
    const want = JSON.stringify({ yes: [voters[0]!.seat, voters[1]!.seat], no: [voters[2]!.seat, voters[3]!.seat] });
    expect(g.socks.map((s) => JSON.stringify(lastViewOf(s).day?.ballots)).join("|")).toBe(g.socks.map(() => want).join("|"));
    expect(g.socks.map((s) => String(lastViewOf(s).day?.verdict?.passed)).join(",")).toBe(g.socks.map(() => "false").join(","));
  }, 60_000);
});

// ---- ballots 카드 (결정 0066-3, O-8) ----

type Card = Extract<ServerMessage, { t: "chat" }>;
const cardsSince = async (g: Game, marks: number[]): Promise<Card[][]> => {
  const out: Card[][] = [];
  for (let i = 0; i < g.socks.length; i += 1) out.push(chatsOf(await settle(g.socks[i]!, marks[i]!)));
  return out;
};
const cardKey = (c: Card): string => `${c.ch}/${c.k ?? "-"}/${c.seat}/${c.text}`;

/** 산 사람 모두를 한 번에 마감하는 찬반: 앞 yesN 명 찬성, 그다음 noN 명 반대, 나머지는 미투표. 처형 진입 전 mark 를 돌려준다. */
async function decide(g: Game, voters: Game["actors"], yesN: number, noN: number): Promise<{ marks: number[]; yes: number[]; no: number[] }> {
  const marks = g.socks.map((s) => mark(s));
  const agree: Record<number, boolean> = {};
  voters.slice(0, yesN).forEach((v) => (agree[v.seat] = true));
  voters.slice(yesN, yesN + noN).forEach((v) => (agree[v.seat] = false));
  await verdictAll(g.code, g.actors, agree);
  return { marks, yes: voters.slice(0, yesN).map((v) => v.seat), no: voters.slice(yesN, yesN + noN).map((v) => v.seat) };
}

/** 소켓으로 보내면 연결당 초당 20개 한도에 걸리므로 서버 본체(applyChat)에 직접 넣는다(chatReplay.test 방식). */
async function bulkChat(code: string, seatNo: number, texts: string[]): Promise<void> {
  await runInDurableObject(env.ROOM.getByName(code), async (instance) => {
    const room = instance["room"]!;
    const me = room.players.find((p) => p.seat === seatNo)!;
    for (const text of texts) {
      instance["chatRates"].clear();
      const why = await instance["applyChat"](me.id, text, `1:${room.day ?? 0}:${room.phase}`, Date.now());
      if (why !== null) throw new Error(`bulkChat: 막힘 ${why} (${text})`);
    }
  });
}

describe("ballots 카드 (결정 0066-3, O-8)", () => {
  it("처형 진입 때 모든 소켓이 all 채널 ballots 카드 정확히 한 장 {seat=변론자, text='찬성|반대'} 을 받고 저장소에도 한 줄이다", async () => {
    const { g, defender, voters } = await toVerdict();
    const { marks, yes, no } = await decide(g, voters, 3, 1);
    const got = await cardsSince(g, marks);
    expect(got.map((c) => c.map(cardKey).join("|")).join(" ; ")).toBe(g.socks.map(() => `all/ballots/${defender.seat}/${yes.join(",")}|${no.join(",")}`).join(" ; "));
    const stored = Object.values(await chatRecordsOf(g.code)).filter((r) => r.k === "ballots");
    expect(stored.map((r) => `${r.ch}/${r.seat}/${r.text}`).join("#")).toBe(`all/${defender.seat}/${yes.join(",")}|${no.join(",")}`);
    // 카드 프레임은 허용 키뿐이다 — 역할·마스크·일차가 없다
    expect(Object.keys(got[0]![0]!).sort().join(",")).toBe("at,ch,k,seat,seq,t,text");
  }, 60_000);

  it("부결이어도 한 장 내고, 한쪽이 비면 빈 문자열이다(찬성 0 / 반대 2)", async () => {
    const { g, defender, voters } = await toVerdict();
    const { marks, no } = await decide(g, voters, 0, 2);
    const got = await cardsSince(g, marks);
    expect(got.map((c) => c.map(cardKey).join("|")).join(" ; ")).toBe(g.socks.map(() => `all/ballots/${defender.seat}/|${no.join(",")}`).join(" ; "));
  }, 60_000);

  it("지목 0표(처형 단계 없음)로 밤에 가면 ballots 카드가 없다", async () => {
    const g = await startedGame("nomination");
    await pointAll(g.code, g.actors, {});
    expect((await storedRoom(g.code)).phase).toBe("night");
    expect(Object.values(await chatRecordsOf(g.code)).filter((r) => r.k === "ballots").length).toBe(0);
  }, 60_000);

  it("같은 날 일반 채팅을 40줄 보낸 뒤 hello 한 소켓의 chatLog 에 카드가 있고, 다음 낮에 hello 해도 있다; 두 번째 처형 뒤에는 두 장이 모두 온다", async () => {
    const { g, defender, voters } = await toVerdict();
    const first = await decide(g, voters, 3, 1);
    await cardsSince(g, first.marks);
    // hello 는 같은 사람의 옛 소켓을 대체하므로(옛 소켓은 닫힌다) 보는 사람 하나를 판 진행에서 빼 둔다 — 마피아가 아닌 유권자.
    const viewer = voters.find((v) => v.role !== "mafia")!;
    const talker = voters.find((v) => v.seat !== viewer.seat)!;
    const rest: Game = { code: g.code, socks: g.socks.filter((_, i) => g.actors[i] !== viewer), actors: g.actors.filter((a) => a !== viewer) };
    await bulkChat(g.code, talker.seat, Array.from({ length: 40 }, (_, i) => `대화${i}`));
    const cardsOf = (lines: Awaited<ReturnType<typeof helloForLog>>): string => lines.filter((l) => l.k === "ballots").map((l) => `${l.seat}/${l.text}`).join(",");
    const firstCard = `${defender.seat}/${first.yes.join(",")}|${first.no.join(",")}`;
    expect(cardsOf(await helloForLog(await connect(g.code), viewer.token))).toBe(firstCard);
    // 복원 줄의 키도 허용 목록 안이다(T-09.1.1-08: 카드 본문은 좌석 번호뿐, 역할·마스크·일차 없음)
    const replayed = (await helloForLog(await connect(g.code), viewer.token)).filter((l) => l.k === "ballots");
    expect(replayed.map((l) => Object.keys(l).sort().join(",")).join("|")).toBe("at,ch,k,seat,seq,text");
    expect(/^[0-7,|]*$/.test(replayed[0]!.text)).toBe(true);
    // 카드 뒤에 일반 줄이 40줄 쌓여 카드는 채널 30줄 밖이다 — 그래도 따로 더해져 온다
    // 다음 낮(discussion, 2일차)
    await advanceTo(g.code, rest.socks, "discussion");
    expect((await storedRoom(g.code)).day).toBe(2);
    expect(cardsOf(await helloForLog(await connect(g.code), viewer.token))).toBe(firstCard);
    // 2일차 처형(마피아 한 명이 변론자 — 승패가 나지 않는 판이다)
    await advanceTo(g.code, rest.socks, "nomination");
    const mafia = rest.actors.find((a) => a.role === "mafia")!;
    const voters2 = await toVerdictFor(rest, mafia);
    const second = await decide(rest, voters2, 2, 1);
    await cardsSince(rest, second.marks);
    const secondCard = `${mafia.seat}/${second.yes.join(",")}|${second.no.join(",")}`;
    expect(cardsOf(await helloForLog(await connect(g.code), viewer.token))).toBe(`${firstCard},${secondCard}`);
  }, 120_000);
});
