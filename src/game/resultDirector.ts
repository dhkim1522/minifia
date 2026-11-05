// 결과 화면 연출 디렉터 (11-05, 결정 D-1·D-11·D-25, UI-SPEC A-1·A-5). React·DOM·three 를 모르는 순수 모듈이다 — 시각은 모두 인자다.
// 화면(ResultScreen)은 여기서 나온 값을 그릴 뿐이다: 누가 어느 자리에 서는지(slotsFor), 언제 누가 뒤집히는지, 이긴 팀 조명·진 팀 어둠이 언제 켜지는지.
// 직업은 ended 의 result.seats 에서만 읽는다(T-11-15). 판 중 장면 경로(visibleSeats)에는 이 모듈을 쓰지 않는다.
// 직업 의상 대응은 ghostOutfit.ts 의 jobOutfit 한 곳을 재사용한다 — 새 표를 만들지 않는다.
import { ringSlots } from "../../shared/game/gather";
import { isAlive } from "../../shared/game/alive";
import type { RoleId } from "../../shared/game/roles";
import type { GameWinner, RoomView, WorldSeg } from "../../shared/protocol";
import type { OutfitId } from "../world/characterData";
import { jobOutfit } from "../world/ghostOutfit";

/**
 * 결과 시간표(ms, 연출 시계는 각자 폰 안): 0~1200 모두 자기 자리로 모임 · 1200+400i 좌석 오름차순 i 번째가 뒤집힘 ·
 * 4600 이긴 팀 조명(진 팀 어둠)과 박수 + 중앙 승리 알림 · 5200 알림 끝 · 5600 시상식 시작(11-09 가 쓴다)이고 헤더가 승리 한 줄이 된다.
 */
export const RESULT_TIMELINE = {
  gatherMs: 1200,
  flipStartMs: 1200,
  flipGapMs: 400,
  lightAtMs: 4600,
  announceEndMs: 5200,
  ceremonyStartMs: 5600,
} as const;

/** 시상식 시작 시각(11-09 가 이 상수를 읽는다) */
export const CEREMONY_START_MS = RESULT_TIMELINE.ceremonyStartMs;

/** 박수는 이긴 팀 좌석 오름차순 최대 이만큼(동시 재생 상한, T-11-17) */
export const CLAP_MAX = 4;

export type ResultTeam = "mafia" | "citizen";

/** 직업 mafia 는 마피아 편, 나머지는 시민 편 */
export function teamOf(job: RoleId): ResultTeam {
  return job === "mafia" ? "mafia" : "citizen";
}

/** 이긴 팀. mafiaWin → 마피아 편 */
export function winningTeam(winner: GameWinner): ResultTeam {
  return winner === "mafiaWin" ? "mafia" : "citizen";
}

export interface CastMember {
  seat: number;
  job: RoleId;
  team: ResultTeam;
  /** 판이 끝났을 때 살아 있었나(탈락자는 유령 반투명 모양에 직업 의상을 입는다) */
  alive: boolean;
}

/** 헤더 제목 키. 문구는 verdict.ts 의 RESULT_TEXT 에서 읽는다 */
export type ResultTitleKey = "result" | "citizenWin" | "mafiaWin";

/** 연출 단계: 4개 구간(gather·flip·light·announce) + final */
export type ResultStage = "gather" | "flip" | "light" | "announce" | "final";

export interface ResultState {
  stage: ResultStage;
  /** 뒤집힌 좌석(좌석 오름차순 = 뒤집힌 순서). 이 사람들의 RoleChip 이 보이고 직업 의상을 입는다 */
  flipped: number[];
  /** 좌석 → 입을 직업 의상(뒤집힌 사람만) */
  costumes: Record<number, OutfitId>;
  /** 어두워질 좌석(조명이 켜진 뒤의 진 팀) */
  dimmed: number[];
  /** 이긴 팀 조명(무대 가운데 점 조명)이 켜져 있나 */
  lit: boolean;
  /** 박수를 칠 좌석(이긴 팀 오름차순 최대 CLAP_MAX). 조명이 켜진 순간부터 최종 상태 전까지 */
  clap: number[];
  /** 중앙 승리 알림이 떠 있나 */
  announce: boolean;
  title: ResultTitleKey;
}

/** ended view 의 result 와 players 로 출연자 표를 만든다(좌석 오름차순). 직업은 result.seats 에서만 읽는다 */
export function castOf(view: RoomView & { result: NonNullable<RoomView["result"]> }): CastMember[] {
  const aliveBySeat = new Map(view.players.map((p) => [p.seat, isAlive(p)]));
  return [...view.result.seats]
    .sort((a, b) => a.seat - b.seat)
    .map((s) => ({ seat: s.seat, job: s.job, team: teamOf(s.job), alive: aliveBySeat.get(s.seat) ?? true }));
}

/** 좌석 → 둘레 자리(고정소수점 [x, z]). 좌석 오름차순 i 번째 → ringSlots(n)[i] — 모든 폰이 같은 배치다 */
export function slotsFor(cast: readonly CastMember[]): Record<number, readonly [number, number]> {
  const table = ringSlots(cast.length);
  const out: Record<number, readonly [number, number]> = {};
  cast.forEach((c, i) => {
    out[c.seat] = table[i] ?? [0, 265];
  });
  return out;
}

const costumeOf = (cast: readonly CastMember[], seats: readonly number[]): Record<number, OutfitId> => {
  const out: Record<number, OutfitId> = {};
  const want = new Set(seats);
  for (const c of cast) if (want.has(c.seat)) out[c.seat] = jobOutfit(c.job);
  return out;
};

const losersOf = (cast: readonly CastMember[], winner: GameWinner): number[] => cast.filter((c) => c.team !== winningTeam(winner)).map((c) => c.seat);

/** 최종 상태(A-5): 모두 서 있고 칩이 뒤집혀 있고 직업 의상, 진 팀 어둠, 이긴 팀 조명. 박수·승리 알림은 없다. 재접속·처음 마운트·모션 줄이기가 곧바로 이 상태다 */
export function finalState(cast: readonly CastMember[], winner: GameWinner): ResultState {
  const seats = cast.map((c) => c.seat);
  return {
    stage: "final",
    flipped: seats,
    costumes: costumeOf(cast, seats),
    dimmed: losersOf(cast, winner),
    lit: true,
    clap: [],
    announce: false,
    title: winner,
  };
}

/** 한 점 구간 snap 의 구간들: 자리마다 p = [x, z] 한 점, 모두 같은 t0. 최종 상태·건너뛰기가 쓴다 */
export function holdSnap(slots: Record<number, readonly [number, number]>, t0: number): WorldSeg[] {
  return Object.keys(slots)
    .map(Number)
    .sort((a, b) => a - b)
    .map((s) => ({ s, p: [slots[s]![0], slots[s]![1]], t0, v: 0 }));
}
