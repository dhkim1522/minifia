// 11-02 Task 3: 칭호 속성 시험(END-04, T-11-06). 시드 난수로 4~8명 합성 판 300개를 만들어 어떤 판이든 지켜야 할 성질을 본다.
import { describe, expect, it } from "vitest";
import { computeAwards } from "../../shared/game/awards";
import { ROLE_IDS, ROLE_TABLE } from "../../shared/game/roles";
import type { NightLogEntry, WhisperRecord } from "../../shared/game/room";
import type { AwardLine, BadgeId, RoleId, VoteLogEntry } from "../../shared/protocol";
import { endedState } from "../helpers/awardsState";
import { seededRandInt } from "../helpers/seededRandom";

const CASES = 300;
const BADGES: readonly BadgeId[] = ["none", "mafia", "police", "doctor", "citizen"];
const TIER: Readonly<Record<AwardLine["award"], number>> = {
  survivor: 0, spectator: 0, talker: 1, swapper: 1, whisperer: 1, mood: 1, whiff: 2, target: 2, firstVictim: 2, actor: 3, detective: 3, angel: 3,
};

/** 한 판의 합성 기록: 직업·일차별 지목·처형·밤·주장·귓속말·통계가 모두 시드에서 나온다. */
function synthetic(seed: number) {
  const rand = seededRandInt(seed);
  const chance = (p: number): boolean => rand(1000) < p * 1000;
  const n = 4 + rand(5);
  const composition = ROLE_TABLE[n as 4 | 5 | 6 | 7 | 8];
  const roles: RoleId[] = ROLE_IDS.flatMap((r) => Array.from({ length: composition[r] }, () => r));
  for (let i = roles.length - 1; i > 0; i -= 1) {
    const j = rand(i + 1);
    [roles[i], roles[j]] = [roles[j]!, roles[i]!];
  }
  const alive = new Set(Array.from({ length: n }, (_, i) => i));
  const pickAlive = (): number => [...alive][rand(alive.size)]!;
  const voteLog: VoteLogEntry[] = [];
  const nightLog: NightLogEntry[] = [];
  const days = 1 + rand(4);
  for (let d = 1; d <= days && alive.size >= 2; d += 1) {
    const votes = [...alive].filter(() => chance(0.75)).map((seat) => {
      let target = pickAlive();
      if (target === seat) target = [...alive].find((x) => x !== seat)!;
      return { seat, target };
    });
    const candidate = chance(0.6) ? pickAlive() : undefined;
    const last = candidate !== undefined && chance(0.15);
    const passed = candidate !== undefined && !last && chance(0.7);
    voteLog.push({ n: d, exec: { yes: passed ? 3 : 0, no: passed ? 1 : 0, passed }, cand: { votes, ...(candidate === undefined ? {} : { candidate }) }, ...(last ? { last: true as const } : {}) });
    if (candidate !== undefined && (passed || last)) alive.delete(candidate);
    if (alive.size >= 2 && chance(0.7)) {
      const target = pickAlive();
      const died = chance(0.6);
      nightLog.push({ n: d, target, died });
      if (died) alive.delete(target);
    } else {
      nightLog.push({ n: d, died: false });
    }
  }
  const dead = Array.from({ length: n }, (_, i) => i).filter((s) => !alive.has(s));
  const stats: Record<number, { say: number; emote: number }> = {};
  const badgeLogs: Record<number, Array<{ n: number; v: BadgeId }>> = {};
  for (let s = 0; s < n; s += 1) {
    if (chance(0.7)) stats[s] = { say: rand(10), emote: rand(8) };
    const len = rand(5);
    let day = 1;
    badgeLogs[s] = Array.from({ length: len }, () => {
      day += rand(2);
      return { n: day, v: BADGES[rand(BADGES.length)]! };
    });
  }
  const whispers: WhisperRecord[] = Array.from({ length: rand(8) }, () => ({ n: 1 + rand(days), from: rand(n), to: rand(n), text: "x", at: 0 }));
  const winner = chance(0.5) ? ("mafiaWin" as const) : ("citizenWin" as const);
  return { n, roles, dead, spec: { roles, dead, voteLog, nightLog, whispers, stats, badgeLogs, winner } };
}

describe("칭호 속성 시험 (T-11-06)", () => {
  it(`합성 판 ${CASES}개: 한 사람에 한 장·결정성·좌석 중복 없음·마지막 패는 이긴 팀·정렬 단조·대체 칭호는 맞는 사람에게만`, () => {
    const bad: string[] = [];
    for (let seed = 1; seed <= CASES; seed += 1) {
      const { n, roles, dead, spec } = synthetic(seed);
      const state = endedState(spec);
      const before = JSON.stringify(state);
      const awards = computeAwards(state);
      const tag = `seed ${seed} (n=${n})`;
      if (JSON.stringify(state) !== before) bad.push(`${tag}: 입력이 바뀜`);
      if (JSON.stringify(computeAwards(state)) !== JSON.stringify(awards)) bad.push(`${tag}: 결정적이 아님`);
      // ① 정확히 한 장 ③ 좌석 중복 없음
      const seats = awards.map((a) => a.seat);
      if (awards.length !== n) bad.push(`${tag}: 패 ${awards.length} != 참가자 ${n}`);
      if (new Set(seats).size !== seats.length) bad.push(`${tag}: 좌석 중복 ${seats.join(",")}`);
      if ([...seats].sort((a, b) => a - b).join(",") !== Array.from({ length: n }, (_, i) => i).join(",")) bad.push(`${tag}: 좌석 집합 ${seats.join(",")}`);
      // ④ 마지막 패는 이긴 팀
      const mafiaWon = spec.winner === "mafiaWin";
      const teamOf = (seat: number): number => ((roles[seat] === "mafia") === mafiaWon ? 1 : 0);
      if (teamOf(awards.at(-1)!.seat) !== 1) bad.push(`${tag}: 마지막 패가 진 팀`);
      // ⑤ 정렬 키 단조 (팀 → 단계 → 좌석)
      for (let i = 1; i < awards.length; i += 1) {
        const a = awards[i - 1]!;
        const b = awards[i]!;
        const ka = [teamOf(a.seat), TIER[a.award], a.seat];
        const kb = [teamOf(b.seat), TIER[b.award], b.seat];
        const ordered = ka[0]! < kb[0]! || (ka[0] === kb[0] && (ka[1]! < kb[1]! || (ka[1] === kb[1] && ka[2]! < kb[2]!)));
        if (!ordered) bad.push(`${tag}: 순서 위반 ${ka.join("/")} → ${kb.join("/")}`);
      }
      // ⑥ spectator 는 탈락자만, survivor 는 산 사람만. 칭호별 한 장 이하.
      for (const a of awards) {
        if (a.award === "spectator" && !dead.includes(a.seat)) bad.push(`${tag}: 산 사람 ${a.seat} 이 spectator`);
        if (a.award === "survivor" && dead.includes(a.seat)) bad.push(`${tag}: 탈락자 ${a.seat} 이 survivor`);
        if (a.award === "spectator" && (a.k === undefined || a.at === undefined)) bad.push(`${tag}: spectator 에 k·at 없음`);
      }
      const counts = new Map<string, number>();
      for (const a of awards) counts.set(a.award, (counts.get(a.award) ?? 0) + 1);
      for (const [award, count] of counts) if (count > 1 && award !== "survivor" && award !== "spectator") bad.push(`${tag}: ${award} 가 ${count} 장`);
    }
    expect(bad).toEqual([]);
  });

  it("합성 판이 모든 칭호를 실제로 만들어 낸다(시험이 비어 있지 않다)", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= CASES; seed += 1) for (const a of computeAwards(endedState(synthetic(seed).spec))) seen.add(a.award);
    expect([...seen].sort()).toEqual(
      ["actor", "angel", "detective", "firstVictim", "mood", "spectator", "survivor", "swapper", "talker", "target", "whiff", "whisperer"].sort(),
    );
  });
});
