// 의심 포스트잇 누설 시험(24-02, 결정 0089-10·0021, D-06·D-07·D-26, T-24-06·T-24-07): 포스트잇은 역할과 무관한 공개 값이지만
// ① 마피아와 시민이 같은 suspect 를 보냈을 때 받는 프레임 종류·순서와 view 키 집합이 같고, ② 거절 응답이 사유와 역할에 따라 달라지지 않으며,
// ③ 서버 전용 이름 notes 는 어떤 프레임의 어떤 키 경로에도 없다. keywordLeak.test.ts 의 마피아·시민 프레임 대조 모양을 따른다.
import { describe, expect, it } from "vitest";
import type { ServerMessage } from "../../shared/protocol";
import { framesOf, killSeats, mark, send, settle, startedGame, summary, toPhase, withRole } from "./helpers";
import type { Actor, Game } from "./helpers";

type StateMsg = Extract<ServerMessage, { t: "state" }>;
const states = (msgs: ServerMessage[]): StateMsg[] => msgs.filter((m): m is StateMsg => m.t === "state");

/** 값이 아니라 모양만 보는 키 경로 목록(배열 원소는 `[]` 로 합친다). */
function keyPathsOf(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item) => keyPathsOf(item, `${prefix}[]`));
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [`${prefix}.${key}`, ...keyPathsOf(child, `${prefix}.${key}`)]);
}
const uniqSorted = (paths: string[]): string[] => [...new Set(paths)].sort();
/** 키 경로 어느 마디에도 서버 전용 이름 notes 가 없다. */
const hasNotesKey = (value: unknown): boolean => keyPathsOf(value).some((path) => path.split(".").some((seg) => seg.replace(/\[\]$/, "") === "notes"));

/**
 * 역할에 따라 키가 달라지는 me 키(마피아의 동료·기록, 경찰·의사·마피아의 기록). 이 밖의 me 키는 마피아·시민이 같아야 한다.
 * 의심 포스트잇이 더하는 키(suspectTo)는 이 목록에 없다 — 역할을 흘리지 않는다는 뜻이다.
 */
const ROLE_ME_KEYS: readonly string[] = ["role", "allies", "records", "allyPicks"];
const viewShape = (msg: StateMsg): { top: string[]; me: string[]; day: string[]; players: string[] } => {
  const { me, day, players, ...rest } = msg.view as unknown as Record<string, unknown>;
  return {
    top: Object.keys(rest).sort(),
    me: Object.keys((me ?? {}) as object).filter((k) => !ROLE_ME_KEYS.includes(k)).sort(),
    day: uniqSorted(keyPathsOf(day)),
    players: uniqSorted(keyPathsOf(players)),
  };
};

const sleep = (ms: number): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 실제 착석 상태에서 원하는 일차와 단계로 옮긴다. */
async function gameAt(day: number, phase: "discussion" | "verdict" = "discussion"): Promise<Game> {
  const g = await startedGame("discussion");
  await toPhase(g.code, phase, (room) => ({ ...room, day }));
  for (const s of g.socks) await settle(s, mark(s));
  return g;
}

/** 한 사람이 suspect 를 보내고 모든 소켓의 프레임을 g.actors 순서로 돌려준다(보낸 쪽 flush 가 먼저다). */
async function suspectFrom(g: Game, from: Actor, target: number): Promise<ServerMessage[][]> {
  const marks = g.actors.map((a) => mark(a.sock));
  send(from.sock, { t: "suspect", target });
  const out: ServerMessage[][] = g.actors.map(() => []);
  const order = [from, ...g.actors.filter((a) => a !== from)];
  for (const a of order) out[g.actors.indexOf(a)] = await settle(a.sock, marks[g.actors.indexOf(a)]!);
  return out;
}

/** 방장이 아닌 마피아 한 명과 시민 한 명(역할은 무작위라 판마다 다른 좌석이다). 6명판은 마피아 둘·시민 둘이다. */
const pickPair = (g: Game): { m: Actor; c: Actor } => {
  const m = withRole(g, "mafia")[0]!;
  const c = withRole(g, "citizen")[0]!;
  return { m, c };
};
/** a·b 가 아닌 다른 사람 한 명(대상으로 쓴다). */
const otherThan = (g: Game, ...skip: Actor[]): Actor => g.actors.find((a) => !skip.includes(a))!;

describe("① 마피아·시민이 같은 suspect 를 보내면 프레임 종류·순서와 view 키 집합이 같다 (T-24-07)", () => {
  it("둘째 날 토론: 마피아 M 과 시민 C 가 각자 다른 참가자에게 붙이면 보낸 사람 프레임 열·view 모양이 같고, 지켜본 마피아·시민의 프레임도 같으며 day.suspects 는 모두 같다", async () => {
    const g = await gameAt(2);
    const { m, c } = pickPair(g);
    const tM = otherThan(g, m, c);
    const tC = otherThan(g, m, c, tM);
    const fromM = await suspectFrom(g, m, tM.seat);
    const fromC = await suspectFrom(g, c, tC.seat);
    const iM = g.actors.indexOf(m);
    const iC = g.actors.indexOf(c);

    // 보낸 사람 자신의 프레임: 종류·순서가 같다(둘 다 state 한 장).
    expect(summary(fromM[iM]!)).toBe("[state:discussion]");
    expect(summary(fromC[iC]!)).toBe(summary(fromM[iM]!));
    expect(viewShape(states(fromC[iC]!)[0]!)).toEqual(viewShape(states(fromM[iM]!)[0]!));

    // 지켜보는 쪽: 같은 사건(M 의 붙이기)을 마피아 동료와 시민 쪽이 받는 프레임이 같은 종류·모양이다.
    const otherMafia = withRole(g, "mafia").find((a) => a !== m)!;
    const watchCitizen = g.actors.find((a) => a.role !== "mafia" && a !== m && a !== c && a !== tM)!;
    const seenByMafia = fromM[g.actors.indexOf(otherMafia)]!;
    const seenByCitizen = fromM[g.actors.indexOf(watchCitizen)]!;
    expect(summary(seenByMafia)).toBe("[state:discussion]");
    expect(summary(seenByCitizen)).toBe(summary(seenByMafia));
    expect(viewShape(states(seenByCitizen)[0]!)).toEqual(viewShape(states(seenByMafia)[0]!));
    expect(states(seenByCitizen)[0]!.view.day?.suspects).toEqual(states(seenByMafia)[0]!.view.day?.suspects);
    expect(states(seenByCitizen)[0]!.view.day?.suspectLog).toEqual(states(seenByMafia)[0]!.view.day?.suspectLog);

    // 두 장이 붙은 뒤의 마지막 view: 어느 소켓이든 같은 두 줄이다.
    const wantSuspects = [{ to: tM.seat, from: m.seat }, { to: tC.seat, from: c.seat }];
    for (const a of g.actors) {
      const last = states(framesOf(a.sock)).at(-1)!;
      expect(last.view.day?.suspects, `seat ${a.seat}`).toEqual(wantSuspects);
    }
  });

  it("판 전체(붙이기·옮기기·찬반 단계까지)에서 모든 소켓이 받은 프레임의 어떤 키에도 notes 가 없다", async () => {
    const g = await gameAt(2);
    const { m, c } = pickPair(g);
    const tM = otherThan(g, m, c);
    const tC = otherThan(g, m, c, tM);
    await suspectFrom(g, m, tM.seat);
    await suspectFrom(g, c, tC.seat);
    await sleep(700); // 연타 간격(600ms)을 넘긴 뒤 옮긴다
    await suspectFrom(g, m, tC.seat);
    await toPhase(g.code, "verdict", (room) => room);
    for (const s of g.socks) await settle(s, mark(s));
    for (const a of g.actors) {
      const frames = framesOf(a.sock);
      expect(JSON.stringify(frames).includes('"notes"'), `seat ${a.seat} raw`).toBe(false);
      for (const msg of frames) expect(hasNotesKey(msg), `seat ${a.seat} ${msg.t}`).toBe(false);
    }
    // 공개 값은 있었다 — 검사가 살아 있음을 확인한다.
    expect(states(framesOf(c.sock)).some((st) => st.view.day?.suspects !== undefined)).toBe(true);
  });
});

describe("② 거절 응답은 사유와 역할에 따라 달라지지 않는다 (D-26, T-24-07)", () => {
  /** 마피아와 시민이 각자 같은 사유로 거절당한 응답을 비교한다(둘 다 [error:BAD_MESSAGE,state:phase], 나머지는 0프레임, 오류 프레임은 글자까지 같다). */
  async function rejectedSame(g: Game, m: Actor, c: Actor, targetOfM: number, targetOfC: number, phase: string): Promise<void> {
    const fromM = await suspectFrom(g, m, targetOfM);
    const fromC = await suspectFrom(g, c, targetOfC);
    const iM = g.actors.indexOf(m);
    const iC = g.actors.indexOf(c);
    expect(summary(fromM[iM]!)).toBe(`[error:BAD_MESSAGE,state:${phase}]`);
    expect(summary(fromC[iC]!)).toBe(summary(fromM[iM]!));
    const errM = fromM[iM]!.find((x) => x.t === "error");
    const errC = fromC[iC]!.find((x) => x.t === "error");
    expect(JSON.stringify(errC)).toBe(JSON.stringify(errM));
    expect(viewShape(states(fromC[iC]!)[0]!)).toEqual(viewShape(states(fromM[iM]!)[0]!));
    // 다른 소켓에는 어느 쪽 거절이든 한 프레임도 가지 않는다.
    g.actors.forEach((a, i) => {
      if (a !== m) expect(summary(fromM[i]!), `M→seat ${a.seat}`).toBe("[]");
      if (a !== c) expect(summary(fromC[i]!), `C→seat ${a.seat}`).toBe("[]");
    });
  }

  it("빈 좌석: 마피아·시민 응답이 같다", async () => {
    const g = await gameAt(2);
    const { m, c } = pickPair(g);
    await rejectedSame(g, m, c, 7, 7, "discussion");
  });

  it("죽은 대상: 마피아·시민 응답이 같다", async () => {
    const g = await gameAt(2);
    const { m, c } = pickPair(g);
    const dead = otherThan(g, m, c);
    await killSeats(g, [dead.seat]);
    await rejectedSame(g, m, c, dead.seat, dead.seat, "discussion");
  });

  it("자기 자신: 마피아·시민 응답이 같다", async () => {
    const g = await gameAt(2);
    const { m, c } = pickPair(g);
    await rejectedSame(g, m, c, m.seat, c.seat, "discussion");
  });

  it("찬반 단계: 마피아·시민 응답이 같다", async () => {
    const g = await gameAt(2, "verdict");
    const { m, c } = pickPair(g);
    const t = otherThan(g, m, c);
    await rejectedSame(g, m, c, t.seat, t.seat, "verdict");
  });

  it("거절된 판에서도 notes 키는 어떤 프레임에도 없다", async () => {
    const g = await gameAt(2);
    const { m } = pickPair(g);
    await suspectFrom(g, m, m.seat);
    for (const a of g.actors) expect(hasNotesKey(framesOf(a.sock)), `seat ${a.seat}`).toBe(false);
  });
});
