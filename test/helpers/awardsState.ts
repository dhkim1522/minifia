// 칭호(11-02) 시험 도우미: 서버 기록만 가진 ended 상태를 손으로 짠다. 테스트에서만 import 한다.
import type { NightLogEntry, RoomState, WhisperRecord } from "../../shared/game/room";
import type { BadgeId, GameWinner, PhaseId, RoleId, VoteLogEntry } from "../../shared/protocol";
import { lobbyOf } from "./voteState";

/** 시험용 ended 상태. roles[i] 는 seat i 의 직업(undefined 면 참가자 아님), alive 에 든 seat 는 탈락. */
export interface EndedSpec {
  roles: ReadonlyArray<RoleId | undefined>;
  dead?: readonly number[];
  voteLog?: VoteLogEntry[];
  nightLog?: NightLogEntry[];
  whispers?: WhisperRecord[];
  stats?: Record<number, { say: number; emote: number }>;
  badgeLogs?: Record<number, Array<{ n: number; v: BadgeId }>>;
  winner?: GameWinner;
}

export function endedState(spec: EndedSpec): RoomState {
  const base = lobbyOf(spec.roles.length);
  const players = [...base.players]
    .sort((a, b) => a.seat - b.seat)
    .map((p) => {
      const role = spec.roles[p.seat];
      return {
        ...p,
        ...(role === undefined ? {} : { role }),
        ...(spec.dead?.includes(p.seat) === true ? { alive: false } : {}),
        ...(spec.stats?.[p.seat] === undefined ? {} : { stats: spec.stats[p.seat]! }),
        ...(spec.badgeLogs?.[p.seat] === undefined ? {} : { badgeLog: spec.badgeLogs[p.seat]! }),
      };
    });
  return {
    ...base,
    phase: "ended" as PhaseId,
    day: Math.max(1, ...(spec.voteLog ?? []).map((e) => e.n), ...(spec.nightLog ?? []).map((e) => e.n)),
    players,
    winner: spec.winner ?? "citizenWin",
    ...(spec.voteLog === undefined ? {} : { voteLog: spec.voteLog }),
    ...(spec.nightLog === undefined ? {} : { nightLog: spec.nightLog }),
    ...(spec.whispers === undefined ? {} : { whispers: spec.whispers }),
  };
}

/** 지목 줄 도우미: cand.votes 와 처형 후보. */
export const execDay = (n: number, votes: Array<[number, number]>, candidate: number | undefined, passed = true): VoteLogEntry => ({
  n,
  exec: { yes: passed ? 3 : 0, no: passed ? 1 : 0, passed },
  cand: { votes: votes.map(([seat, target]) => ({ seat, target })), ...(candidate === undefined ? {} : { candidate }) },
});

export const ROLES5: RoleId[] = ["mafia", "police", "doctor", "citizen", "citizen"];

