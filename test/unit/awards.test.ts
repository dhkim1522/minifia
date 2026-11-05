// 11-02 칭호(END-04) 순수 규칙 시험. Task 1: 대체 칭호 경로(D-4). 서버 기록만으로 결정적으로 정하고 입력을 바꾸지 않는다.
import { describe, expect, it } from "vitest";
import { computeAwards, eliminationOf } from "../../shared/game/awards";
import { buildView } from "../../shared/game/view";
import { AWARD_MIN } from "../../shared/game/awards";
import type { AwardLine, RoleId, VoteLogEntry } from "../../shared/protocol";
import type { NightLogEntry } from "../../shared/game/room";
import { ROLES5, endedState, execDay } from "../helpers/awardsState";
import { startedAt } from "../helpers/voteState";

describe("칭호 — 대체 칭호 경로 (D-4)", () => {
  it("산 사람은 survivor(k 없음), 처형된 사람은 spectator(k=일차, at=day), 첫 밤 사망자 뒤에 밤에 죽은 사람은 spectator(at=night)", () => {
    const s = endedState({
      roles: ROLES5,
      dead: [2, 3, 4],
      voteLog: [execDay(1, [], 3)],
      nightLog: [{ n: 1, target: 4, died: true }, { n: 2, target: 2, died: true }],
      winner: "mafiaWin",
    });
    expect(eliminationOf(s, 3)).toEqual({ n: 1, at: "day" });
    expect(eliminationOf(s, 2)).toEqual({ n: 2, at: "night" });
    expect(eliminationOf(s, 0)).toBeUndefined();
    // 마피아 승리: 진 팀(시민 편: seat 1·2·3·4) 먼저, 이긴 팀(seat 0) 나중. 첫 밤 사망자(4)는 중간 칭호라 대체 칭호 뒤에 온다.
    expect(computeAwards(s)).toEqual<AwardLine[]>([
      { seat: 1, award: "survivor" },
      { seat: 2, award: "spectator", k: 2, at: "night" },
      { seat: 3, award: "spectator", k: 1, at: "day" },
      { seat: 4, award: "firstVictim", k: 1 },
      { seat: 0, award: "survivor" },
    ]);
  });

  it("참가자(role 있는 사람)만 한 장씩 받는다 — role 이 없는 사람은 없다", () => {
    const s = endedState({ roles: ["mafia", "police", "citizen", "citizen", undefined] });
    const awards = computeAwards(s);
    expect(awards.length).toBe(4);
    expect(awards.some((a) => a.seat === 4)).toBe(false);
  });

  it("시민 승리면 진 팀은 마피아 편이 먼저, 같은 팀은 낮은 좌석부터", () => {
    const s = endedState({ roles: ["citizen", "mafia", "doctor", "mafia", "police"], winner: "citizenWin" });
    expect(computeAwards(s).map((a) => a.seat)).toEqual([1, 3, 0, 2, 4]);
  });

  it("입력을 바꾸지 않고 같은 입력은 같은 출력이다", () => {
    const s = endedState({ roles: ROLES5, dead: [2], nightLog: [{ n: 1, target: 2, died: true }] });
    const before = JSON.stringify(s);
    const a = computeAwards(s);
    expect(JSON.stringify(s)).toBe(before);
    expect(computeAwards(s)).toEqual(a);
  });
});

describe("buildView — result.awards (D-4, L35)", () => {
  it("ended 의 result.awards 는 computeAwards 와 같고, ended 가 아닌 단계의 view 에는 result 도 awards 도 없다", () => {
    const s = endedState({ roles: ROLES5, dead: [3], voteLog: [execDay(1, [[0, 3]], 3)] });
    const view = buildView(s, s.players[0]!.id, 1_000);
    expect(JSON.stringify(view.result?.awards)).toBe(JSON.stringify(computeAwards(s)));
    for (const phase of ["roleReveal", "dayAnnounce", "discussion", "nomination"] as const) {
      const mid = startedAt(5, 3, phase);
      const text = JSON.stringify(buildView(mid, mid.players[0]!.id, 1_000));
      expect(`${phase}:${text.includes("awards")}:${text.includes("\"result\"")}`).toBe(`${phase}:false:false`);
    }
  });
});

// ---- Task 2: 열 개 칭호와 배정·정렬 규칙 (D-4, D-5, D-7, O-1) ----

/** seat → 받은 칭호 줄(없으면 undefined). */
const lineOf = (awards: AwardLine[], seat: number): AwardLine | undefined => awards.find((a) => a.seat === seat);
/** 칭호 id 를 받은 줄들(0~1장). */
const holders = (awards: AwardLine[], award: AwardLine["award"]): AwardLine[] => awards.filter((a) => a.award === award);
/** 1..n 일차가 지나갔음을 알리는 밤 기록(지목·사망 없음). */
const throughDay = (n: number): NightLogEntry[] => Array.from({ length: n }, (_, i) => ({ n: i + 1, died: false }));
/** 6명: 마피아 0·5, 경찰 1, 의사 2, 시민 3·4. */
const ROLES6: RoleId[] = ["mafia", "police", "doctor", "citizen", "citizen", "mafia"];

describe("칭호 최소 점수 표 (O-1)", () => {
  it("AWARD_MIN 은 표 그대로 한 곳에 있다", () => {
    expect(AWARD_MIN).toEqual({ actor: 1, detective: 2, angel: 1, whiff: 1, target: 3, firstVictim: 1, talker: 5, swapper: 2, whisperer: 2, mood: 3 });
  });
});

describe("actor — 거짓 주장 일수 (마피아, 최소 1)", () => {
  it("산 채로 지낸 날만, 주장은 바꿀 때까지 이어지고 none·mafia 주장은 거짓이 아니다", () => {
    // seat 0 마피아: 1일차 police 주장 → 3일차 none → 4일차 citizen. 4일차까지 산다.
    const s = endedState({ roles: ROLES6, nightLog: throughDay(4), badgeLogs: { 0: [{ n: 1, v: "police" }, { n: 3, v: "none" }, { n: 4, v: "citizen" }] } });
    expect(lineOf(computeAwards(s), 0)).toEqual({ seat: 0, award: "actor", k: 3 }); // 1·2·4일차
    const mafiaClaim = endedState({ roles: ROLES6, nightLog: throughDay(3), badgeLogs: { 0: [{ n: 1, v: "mafia" }] } });
    expect(holders(computeAwards(mafiaClaim), "actor")).toEqual([]);
  });

  it("탈락한 날까지만 센다 — 2일차 낮에 처형되면 1·2일차, 같은 날 밤에 죽어도 그날 낮은 산 채로", () => {
    const executed = endedState({
      roles: ROLES6, dead: [0], nightLog: throughDay(4),
      voteLog: [execDay(2, [[3, 0]], 0)],
      badgeLogs: { 0: [{ n: 1, v: "doctor" }] },
    });
    expect(lineOf(computeAwards(executed), 0)).toEqual({ seat: 0, award: "actor", k: 2 });
    const nightKilled = endedState({
      roles: ROLES6, dead: [0], nightLog: [{ n: 1, died: false }, { n: 2, target: 0, died: true }],
      badgeLogs: { 0: [{ n: 1, v: "citizen" }] },
    });
    expect(lineOf(computeAwards(nightKilled), 0)).toEqual({ seat: 0, award: "actor", k: 2 });
  });

  it("마피아가 아니면 주장해도 받지 않고, 주장이 없으면 받지 않는다(최소 1 미달)", () => {
    const s = endedState({ roles: ROLES6, nightLog: throughDay(3), badgeLogs: { 3: [{ n: 1, v: "police" }] } });
    expect(holders(computeAwards(s), "actor")).toEqual([]);
    expect(holders(computeAwards(endedState({ roles: ROLES6, nightLog: throughDay(3) })), "actor")).toEqual([]);
  });
});

describe("detective — 적중 지목 수 (마피아 아님, 최소 2)", () => {
  const points = (seat: number, targets: number[]): VoteLogEntry[] => targets.map((t, i) => execDay(i + 1, [[seat, t]], undefined, false));
  it("마피아를 가리킨 지목 줄이 최소(2) 미만이면 없고, 2 부터 받는다", () => {
    expect(holders(computeAwards(endedState({ roles: ROLES6, voteLog: points(1, [0, 3]) })), "detective")).toEqual([]);
    expect(lineOf(computeAwards(endedState({ roles: ROLES6, voteLog: points(1, [0, 5]) })), 1)).toEqual({ seat: 1, award: "detective", k: 2 });
    expect(lineOf(computeAwards(endedState({ roles: ROLES6, voteLog: points(1, [0, 5, 0]) })), 1)).toEqual({ seat: 1, award: "detective", k: 3 });
  });
  it("마피아는 같은 편을 가리켜도 받지 않는다", () => {
    expect(holders(computeAwards(endedState({ roles: ROLES6, voteLog: points(5, [0, 0, 0]) })), "detective")).toEqual([]);
  });
});

describe("angel — 구출 수 (의사만, 최소 1)", () => {
  it("target 이 있고 died false 인 밤만 센다", () => {
    const s = endedState({ roles: ROLES6, nightLog: [{ n: 1, target: 3, died: false }, { n: 2, died: false }, { n: 3, target: 4, died: false }, { n: 4, target: 5, died: true }] });
    expect(lineOf(computeAwards(s), 2)).toEqual({ seat: 2, award: "angel", k: 2 });
  });
  it("구출이 없거나 의사가 아니면 받지 않는다", () => {
    expect(holders(computeAwards(endedState({ roles: ROLES6, nightLog: [{ n: 1, target: 3, died: true }] })), "angel")).toEqual([]);
    const noDoctor = endedState({ roles: ["mafia", "police", "citizen", "citizen"], nightLog: [{ n: 1, target: 2, died: false }] });
    expect(holders(computeAwards(noDoctor), "angel")).toEqual([]);
  });
});

describe("whiff — 헛다리 수 (마피아 아님, 최소 1)", () => {
  it("그날 처형된 비마피아를 가리킨 줄만 센다 — 점수가 같으면 낮은 좌석 한 명이 받는다", () => {
    const s = endedState({
      roles: ROLES6, dead: [4],
      voteLog: [execDay(1, [[3, 4], [1, 4], [2, 0]], 4)], // 3·1 이 시민 4 를 가리켜 처형됨, 2 는 마피아를 가리킴
    });
    const awards = computeAwards(s);
    expect(holders(awards, "whiff")).toEqual([{ seat: 1, award: "whiff", k: 1 }]);
    const only = endedState({ roles: ROLES6, dead: [4], voteLog: [execDay(1, [[3, 4], [2, 0]], 4)] });
    expect(lineOf(computeAwards(only), 3)).toEqual({ seat: 3, award: "whiff", k: 1 });
  });
  it("처형되지 않은 사람·처형된 마피아를 가리킨 줄, 마피아의 줄은 세지 않는다", () => {
    const s = endedState({
      roles: ROLES6, dead: [5],
      voteLog: [execDay(1, [[3, 4], [4, 5], [0, 4]], 5)], // 처형은 마피아 5, 3 이 가리킨 4 는 살아남음, 마피아 0 은 시민 4
    });
    expect(holders(computeAwards(s), "whiff")).toEqual([]);
  });
  it("마지막 3인 결전(last)으로 처형된 사람도 처형이다", () => {
    const last: VoteLogEntry = { n: 2, exec: { yes: 0, no: 0, passed: false }, cand: { votes: [{ seat: 3, target: 4 }, { seat: 4, target: 3 }], candidate: 4 }, last: true };
    const s = endedState({ roles: ROLES6, dead: [4], voteLog: [last] });
    expect(eliminationOf(s, 4)).toEqual({ n: 2, at: "day" });
    expect(lineOf(computeAwards(s), 3)).toEqual({ seat: 3, award: "whiff", k: 1 });
  });
  it("부결된 날(passed false, last 없음)의 후보는 처형이 아니다", () => {
    const s = endedState({ roles: ROLES6, voteLog: [execDay(1, [[3, 4]], 4, false)] });
    expect(eliminationOf(s, 4)).toBeUndefined();
    expect(holders(computeAwards(s), "whiff")).toEqual([]);
  });
});

describe("target — 받은 지목 수 (모두, 최소 3)", () => {
  const into = (target: number, from: number[]): VoteLogEntry[] => from.map((f, i) => execDay(i + 1, [[f, target]], undefined, false));
  it("2 표는 없고 3 표부터 받는다. 일차를 가리지 않고 합친다", () => {
    expect(holders(computeAwards(endedState({ roles: ROLES6, voteLog: into(3, [0, 1]) })), "target")).toEqual([]);
    expect(lineOf(computeAwards(endedState({ roles: ROLES6, voteLog: into(3, [0, 1, 2]) })), 3)).toEqual({ seat: 3, award: "target", k: 3 });
    expect(lineOf(computeAwards(endedState({ roles: ROLES6, voteLog: into(3, [0, 1, 2, 4]) })), 3)).toEqual({ seat: 3, award: "target", k: 4 });
  });
});

describe("firstVictim — 첫 밤 사망자 (점수 없음, k = 일차)", () => {
  it("died true 인 가장 이른 밤의 target 한 명만 받는다", () => {
    const s = endedState({ roles: ROLES6, dead: [4, 2], nightLog: [{ n: 1, target: 3, died: false }, { n: 2, target: 4, died: true }, { n: 3, target: 2, died: true }] });
    const awards = computeAwards(s);
    expect(holders(awards, "firstVictim")).toEqual([{ seat: 4, award: "firstVictim", k: 2 }]);
  });
  it("밤 사망이 없으면 없다", () => {
    expect(holders(computeAwards(endedState({ roles: ROLES6, nightLog: [{ n: 1, target: 3, died: false }] })), "firstVictim")).toEqual([]);
  });
  it("더 큰 칭호(target)를 받았으면 이 칭호는 이번 판에 없다", () => {
    const s = endedState({
      roles: ROLES6, dead: [3],
      nightLog: [{ n: 1, target: 3, died: true }],
      voteLog: [execDay(2, [[0, 3], [1, 3], [2, 3]], undefined, false)],
    });
    const awards = computeAwards(s);
    expect(lineOf(awards, 3)?.award).toBe("target");
    expect(holders(awards, "firstVictim")).toEqual([]);
  });
});

describe("talker·whisperer·mood — 작은 칭호 (최소 5·2·3)", () => {
  it("talker: say 4 는 없고 5 부터", () => {
    expect(holders(computeAwards(endedState({ roles: ROLES6, stats: { 3: { say: 4, emote: 0 } } })), "talker")).toEqual([]);
    expect(lineOf(computeAwards(endedState({ roles: ROLES6, stats: { 3: { say: 5, emote: 0 } } })), 3)).toEqual({ seat: 3, award: "talker", k: 5 });
  });
  it("mood: emote 2 는 없고 3 부터", () => {
    expect(holders(computeAwards(endedState({ roles: ROLES6, stats: { 3: { say: 0, emote: 2 } } })), "mood")).toEqual([]);
    expect(lineOf(computeAwards(endedState({ roles: ROLES6, stats: { 3: { say: 0, emote: 3 } } })), 3)).toEqual({ seat: 3, award: "mood", k: 3 });
  });
  it("whisperer: 보낸 건수 1 은 없고 2 부터, 받은 쪽은 세지 않는다", () => {
    const w = (from: number, to: number) => ({ n: 1, from, to, text: "x", at: 0 });
    expect(holders(computeAwards(endedState({ roles: ROLES6, whispers: [w(3, 4)] })), "whisperer")).toEqual([]);
    const s = endedState({ roles: ROLES6, whispers: [w(3, 4), w(3, 1), w(4, 3)] });
    expect(lineOf(computeAwards(s), 3)).toEqual({ seat: 3, award: "whisperer", k: 2 });
  });
});

describe("swapper — 말 바꿈 수 (최소 2)", () => {
  it("첫 걸기는 바뀐 것이 아니고, none 으로 돌아가는 것은 바뀐 것, none 에서 거는 것은 아니다", () => {
    const one = endedState({ roles: ROLES6, badgeLogs: { 3: [{ n: 1, v: "police" }, { n: 2, v: "doctor" }] } });
    expect(holders(computeAwards(one), "swapper")).toEqual([]);
    const two = endedState({ roles: ROLES6, badgeLogs: { 3: [{ n: 1, v: "police" }, { n: 2, v: "doctor" }, { n: 3, v: "none" }, { n: 4, v: "citizen" }] } });
    expect(lineOf(computeAwards(two), 3)).toEqual({ seat: 3, award: "swapper", k: 2 });
    const firstOnly = endedState({ roles: ROLES6, badgeLogs: { 3: [{ n: 1, v: "police" }, { n: 2, v: "none" }, { n: 3, v: "doctor" }] } });
    expect(holders(computeAwards(firstOnly), "swapper")).toEqual([]); // police→none 1 번뿐
  });
});

describe("배정 — 한 사람에 한 칭호, 큰 칭호 우선, 넘김 (D-5)", () => {
  it("여러 조건을 채운 사람은 훑는 순서가 앞선 칭호 하나만 받고 나머지는 다음 후보에게 넘어간다", () => {
    const s = endedState({
      roles: ROLES6,
      voteLog: [execDay(1, [[1, 0]], undefined, false), execDay(2, [[1, 5]], undefined, false)], // 경찰 1 이 마피아를 두 번 맞힘
      stats: { 1: { say: 9, emote: 9 }, 3: { say: 6, emote: 0 } },
    });
    const awards = computeAwards(s);
    expect(lineOf(awards, 1)?.award).toBe("detective");
    expect(lineOf(awards, 3)).toEqual({ seat: 3, award: "talker", k: 6 }); // 1 이 빠졌으니 다음 후보
    expect(awards.length).toBe(6);
    expect(new Set(awards.map((a) => a.seat)).size).toBe(6);
  });

  it("후보가 없으면 그 칭호는 목록에 없고 모두 대체 칭호다", () => {
    const awards = computeAwards(endedState({ roles: ROLES6 }));
    expect(awards.every((a) => a.award === "survivor")).toBe(true);
  });
});

describe("동점 정렬 — 점수 → 생존자 → 늦은 탈락 → 낮은 좌석 (D-5)", () => {
  const talk = (say3: number, say4: number) => ({ 3: { say: say3, emote: 0 }, 4: { say: say4, emote: 0 } });
  it("① 점수 큰 쪽", () => {
    expect(holders(computeAwards(endedState({ roles: ROLES6, stats: talk(6, 7) })), "talker")[0]!.seat).toBe(4);
  });
  it("② 같은 점수면 살아남은 쪽(낮은 좌석이 죽었어도)", () => {
    const s = endedState({ roles: ROLES6, dead: [3], voteLog: [execDay(1, [[0, 3]], 3)], stats: talk(6, 6) });
    expect(holders(computeAwards(s), "talker")[0]!.seat).toBe(4);
  });
  it("③ 둘 다 탈락이면 더 늦게 탈락한 쪽, 같은 일차면 밤 탈락이 낮 탈락보다 늦다", () => {
    // seat 2 가 1일차 밤에 먼저 죽어 firstVictim 을 가져가므로 talker 경쟁은 3 과 4 둘이다.
    const base = { roles: ROLES6, dead: [2, 3, 4], stats: talk(6, 6) };
    const night = (n: number, target: number): NightLogEntry => ({ n, target, died: true });
    const later = endedState({ ...base, voteLog: [execDay(1, [[0, 3]], 3)], nightLog: [night(1, 2), night(2, 4)] });
    expect(holders(computeAwards(later), "talker")[0]!.seat).toBe(4);
    const sameDay = endedState({ ...base, voteLog: [execDay(2, [[0, 3]], 3)], nightLog: [night(1, 2), night(2, 4)] });
    expect(holders(computeAwards(sameDay), "talker")[0]!.seat).toBe(4);
    const earlier = endedState({ ...base, voteLog: [execDay(3, [[0, 3]], 3)], nightLog: [night(1, 2), night(2, 4)] });
    expect(holders(computeAwards(earlier), "talker")[0]!.seat).toBe(3);
  });
  it("④ 모두 같으면 낮은 좌석", () => {
    expect(holders(computeAwards(endedState({ roles: ROLES6, stats: talk(6, 6) })), "talker")[0]!.seat).toBe(3);
  });
});

describe("패 순서 (D-7)", () => {
  // 시민 승리: 진 팀 = 마피아(0·5) 먼저. 이긴 팀(1~4) 안에서 대체 → 작은 → 중간 → 큰, 낮은 좌석.
  const rich = (winner: "citizenWin" | "mafiaWin") =>
    endedState({
      roles: ROLES6, winner,
      nightLog: [{ n: 1, target: 3, died: false }], // 의사 2 angel(큰)
      voteLog: [execDay(1, [[0, 4], [1, 4], [5, 4]], undefined, false)], // 4 는 target 3 표(중간), 같은 날 지목한 0·5 는 마피아
      stats: { 3: { say: 6, emote: 0 } }, // 시민 3 talker(작은)
    });
  it("시민 승리: 마피아(진 팀)가 먼저, 이긴 팀은 대체 → 작은 → 중간 → 큰 순이며 마지막 패가 이긴 팀의 가장 큰 칭호", () => {
    const awards = computeAwards(rich("citizenWin"));
    expect(awards).toEqual<AwardLine[]>([
      { seat: 0, award: "survivor" },
      { seat: 5, award: "survivor" },
      { seat: 1, award: "survivor" },
      { seat: 3, award: "talker", k: 6 },
      { seat: 4, award: "target", k: 3 },
      { seat: 2, award: "angel", k: 1 },
    ]);
  });
  it("마피아 승리: 이긴 팀은 마피아 편 — 시민 편이 먼저 나온다", () => {
    const seats = computeAwards(rich("mafiaWin")).map((a) => a.seat);
    expect(seats.slice(0, 4).sort()).toEqual([1, 2, 3, 4]);
    expect(seats.slice(4)).toEqual([0, 5]);
  });
});

// ---- Task 3: 읽기 키 집합 (L37, T-11-04) ----

/** computeAwards 가 읽어도 되는 경로(배열 칸은 [] 로 접는다). 이 밖의 경로를 읽으면 숨은 정보를 건드린 것이다. */
const ALLOWED_READS: ReadonlySet<string> = new Set([
  "players", "players[].seat", "players[].role", "players[].alive", "players[].stats", "players[].stats.say", "players[].stats.emote",
  "players[].badgeLog", "players[].badgeLog[].n", "players[].badgeLog[].v",
  "voteLog", "voteLog[].n", "voteLog[].exec", "voteLog[].exec.passed", "voteLog[].cand", "voteLog[].cand.votes",
  "voteLog[].cand.votes[].seat", "voteLog[].cand.votes[].target", "voteLog[].cand.candidate", "voteLog[].last",
  "nightLog", "nightLog[].n", "nightLog[].target", "nightLog[].died",
  "whispers", "whispers[].from", "whispers[].n",
  "winner",
]);

/** 읽기·열거·in 검사를 모두 기록하는 깊은 프록시. 배열 안쪽(length·메서드)은 기록하지 않고 칸 접근만 `[]` 경로로 이어 간다. */
function spy<T extends object>(root: T, reads: Set<string>): T {
  const wrap = (value: unknown, path: string): unknown => {
    if (value === null || typeof value !== "object") return value;
    const isArray = Array.isArray(value);
    return new Proxy(value as object, {
      get(target, key, receiver) {
        const v: unknown = Reflect.get(target, key, receiver);
        if (typeof key === "symbol") return v;
        if (isArray) return /^\d+$/.test(key) ? wrap(v, `${path}[]`) : v;
        const next = path === "" ? key : `${path}.${key}`;
        reads.add(next);
        return wrap(v, next);
      },
      has(target, key) {
        if (!isArray && typeof key === "string") reads.add(`${path}::has:${key}`);
        return Reflect.has(target, key);
      },
      ownKeys(target) {
        if (!isArray) reads.add(`${path}::ownKeys`);
        return Reflect.ownKeys(target);
      },
    });
  };
  return wrap(root, "") as T;
}

describe("읽기 키 집합 — 공개 사실만 읽는다 (L37, T-11-04)", () => {
  /** 숨은 정보 필드를 모두 채운 한 판. 읽으면 프록시가 잡는다. */
  function loaded() {
    const base = endedState({
      roles: ROLES6, dead: [3, 4], winner: "mafiaWin",
      voteLog: [execDay(1, [[1, 0], [3, 4], [2, 5]], 4), { ...execDay(2, [[1, 3], [2, 3]], 3, false), last: true }],
      nightLog: [{ n: 1, target: 3, died: false }, { n: 2, target: 3, died: true }],
      whispers: [{ n: 1, from: 3, to: 4, text: "비밀", at: 5 }, { n: 1, from: 3, to: 1, text: "또", at: 6 }],
      stats: { 3: { say: 6, emote: 3 }, 1: { say: 1, emote: 9 } },
      badgeLogs: { 0: [{ n: 1, v: "police" }], 3: [{ n: 1, v: "police" }, { n: 2, v: "doctor" }, { n: 3, v: "none" }] },
    });
    const players = base.players.map((p) => ({
      ...p,
      investigations: [{ n: 1, target: 0, isMafia: true }],
      assassinations: [{ n: 1, target: 3, died: true }],
      treatments: [{ n: 1, target: 3 }],
      nightPick: 3, verdictVote: true, nominate: 2, runoffVote: 1, showdownPick: 2, will: "유언", endVote: true as const,
      nickname: "별명", token: "secret-token", id: "secret-id", connId: "c", badge: "police" as const,
    }));
    return { ...base, players, verdict: { passed: true, candidate: 4, ballots: { yes: [0, 1], no: [2] } }, hostId: "secret-host", pickTurn: { order: [0], i: 0 } };
  }

  it("접근한 키 경로는 허용 목록의 부분집합이고, 수사·치료·밤 선택·개인 표·ballots 는 읽지 않는다", () => {
    const state = loaded();
    const reads = new Set<string>();
    const awards = computeAwards(spy(state, reads));
    const outside = [...reads].filter((r) => !ALLOWED_READS.has(r));
    expect(outside).toEqual([]);
    // 시험이 비어 있지 않다: 핵심 경로는 실제로 읽혔다
    for (const must of ["players[].role", "players[].alive", "voteLog[].cand.votes[].target", "voteLog[].cand.candidate", "nightLog[].died", "whispers[].from", "players[].stats.say", "players[].badgeLog[].v", "winner"]) {
      expect(`${must}:${reads.has(must)}`).toBe(`${must}:true`);
    }
    // 프록시를 거쳐도 결과는 같다
    expect(awards).toEqual(computeAwards(state));
  });

  it("숨은 정보만 다른 두 판의 칭호는 같다(수사·치료·밤 선택·개인 표·ballots·유언·귓속말 본문은 결과에 영향이 없다)", () => {
    const a = loaded();
    const b = {
      ...a,
      players: a.players.map((p) => ({ ...p, investigations: [], assassinations: [], treatments: [], nightPick: 0, verdictVote: false, nominate: 0, runoffVote: 0, showdownPick: 0, will: "", endVote: undefined })),
      verdict: { passed: false, ballots: { yes: [], no: [0, 1, 2] } },
      whispers: a.whispers!.map((w) => ({ ...w, text: "다른 말", at: 0, to: 0 })),
    };
    expect(computeAwards(b)).toEqual(computeAwards(a));
  });
});
