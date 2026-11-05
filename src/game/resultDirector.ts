// 결과 화면 연출 디렉터 (11-05, 결정 D-1·D-11·D-25, UI-SPEC A-1·A-5). React·DOM·three 를 모르는 순수 모듈이다 — 시각은 모두 인자다.
// 화면(ResultScreen)은 여기서 나온 값을 그릴 뿐이다: 누가 어느 자리에 서는지(slotsFor), 언제 누가 뒤집히는지, 이긴 팀 조명·진 팀 어둠이 언제 켜지는지.
// 직업은 ended 의 result.seats 에서만 읽는다(T-11-15). 판 중 장면 경로(visibleSeats)에는 이 모듈을 쓰지 않는다.
// 직업 의상 대응은 ghostOutfit.ts 의 jobOutfit 한 곳을 재사용한다 — 새 표를 만들지 않는다.
import { ringSlots } from "../../shared/game/gather";
import { isAlive } from "../../shared/game/alive";
import { snapToWalkable, STAGE_SPOT } from "../../shared/game/map";
import { mapOf } from "../../shared/game/maps";
import type { RoleId } from "../../shared/game/roles";
import type { GameWinner, MapId, RoomView, WorldSeg } from "../../shared/protocol";
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

/** 확장 패널 높이의 상한(px) */
export const RESULT_PANEL_MAX_H = 520;

/** 확장된 결과 패널 높이(11-07, D-3): min(round(0.7 × 방 높이), 520). 방 높이를 모르면(0 이하) 상한을 돌려주지 않고 undefined — 부르는 쪽이 CSS 기본값을 쓴다 */
export function resultPanelHeight(roomH: number): number | undefined {
  return roomH > 0 ? Math.min(Math.round(0.7 * roomH), RESULT_PANEL_MAX_H) : undefined;
}

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
  /** 탭 행에 전체 말고 나머지 넷이 나와 있나(11-07, D-2): 첫 뒤집기 시각(1200ms)부터. 최종 상태·재접속은 처음부터 참 */
  tabsVisible: boolean;
  title: ResultTitleKey;
}

/** ended view 의 result 와 players 로 출연자 표를 만든다(좌석 오름차순). 직업은 result.seats 에서만 읽는다 */
export function castOf(view: RoomView & { result: NonNullable<RoomView["result"]> }): CastMember[] {
  const aliveBySeat = new Map(view.players.map((p) => [p.seat, isAlive(p)]));
  // 쉬었다가 합류한 사람(sat, 11-12)은 참가자가 아니다 — 링 자리·직업 칩·승패·시상 어디에도 들지 않는다(서버도 result.seats 에 싣지 않는다, 여기서 한 번 더 막는다)
  const sat = new Set(view.players.filter((p) => p.sat === true).map((p) => p.seat));
  return [...view.result.seats]
    .filter((s) => !sat.has(s.seat))
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

/** 쉬었던 사람(sat)이 서는 바깥 원 반지름(고정소수점 3.6). 참가자 링(2.65)보다 바깥이다 */
export const SAT_RADIUS_FX = 360;

/**
 * 쉬었던 사람(sat)의 자리 표(11-12, UI-SPEC A-5): 좌석 오름차순 i 번째가 바깥 원 위 π/4 + 2πi/k 각도에 서고, 걸을 수 있는 가까운 칸으로 보정한다(snapToWalkable).
 * 모든 폰이 같은 표를 만든다(서버 상태가 아니라 이 폰의 연출). 값은 고정소수점 [x, z]. 맵 id 는 방의 맵(view.map, 없으면 bar)
 */
export function satSlots(seats: readonly number[], mapId: MapId): Record<number, readonly [number, number]> {
  const sorted = [...seats].sort((a, b) => a - b);
  const map = mapOf(mapId);
  const out: Record<number, readonly [number, number]> = {};
  sorted.forEach((seat, i) => {
    const angle = Math.PI / 4 + (2 * Math.PI * i) / sorted.length;
    const at = snapToWalkable(map, { x: Math.round(Math.cos(angle) * SAT_RADIUS_FX), z: Math.round(Math.sin(angle) * SAT_RADIUS_FX) });
    out[seat] = [at.x, at.z];
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
    tabsVisible: true,
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

/**
 * 시각 t(연출 시계 ms)의 상태 — 시간표 표(UI-SPEC A-1). 단계 이름은 구간 넷 + final:
 * gather [0,1200) · flip [1200,4600) · light [4600,5200) · announce [5200,5600) · final [5600,).
 * 좌석 오름차순 i 번째가 1200+400i 에 뒤집히고 직업 의상을 입는다. 4600 에 이긴 팀 조명·진 팀 어둠·박수 대상(최대 CLAP_MAX)·승리 알림이 켜지고
 * 5200 에 알림이 꺼지며 5600 부터 헤더 제목이 승리 한 줄이 된다. 걷기(모임)는 화면 몫이고(walkSnap) 여기에는 걷는 중이라는 값만 단계 gather 로 있다.
 */
export function stateAt(t: number, cast: readonly CastMember[], winner: GameWinner): ResultState {
  const tl = RESULT_TIMELINE;
  const at = Math.max(0, t);
  if (at >= tl.ceremonyStartMs) return finalState(cast, winner);
  const stage: ResultStage = at < tl.flipStartMs ? "gather" : at < tl.lightAtMs ? "flip" : at < tl.announceEndMs ? "light" : "announce";
  const count = at < tl.flipStartMs ? 0 : Math.min(cast.length, Math.floor((at - tl.flipStartMs) / tl.flipGapMs) + 1);
  const flipped = cast.slice(0, count).map((c) => c.seat);
  const lit = at >= tl.lightAtMs;
  const winners = cast.filter((c) => c.team === winningTeam(winner)).map((c) => c.seat);
  return {
    stage,
    flipped,
    costumes: costumeOf(cast, flipped),
    dimmed: lit ? losersOf(cast, winner) : [],
    lit,
    clap: stage === "light" ? winners.slice(0, CLAP_MAX) : [],
    announce: stage === "light",
    tabsVisible: at >= tl.flipStartMs,
    title: "result",
  };
}

/** 상태가 바뀌는 시각(오름차순, 중복 없음). 화면은 마크마다 setTimeout 으로 단계를 바꾼다 — 프레임마다 다시 그리지 않는다. n = 참가자 수, awardN = 시상 칭호 수(11-09, 없으면 0) */
export function markTimes(n: number, awardN = 0): number[] {
  const tl = RESULT_TIMELINE;
  const times = new Set<number>([0, tl.lightAtMs, tl.announceEndMs, tl.ceremonyStartMs]);
  for (let i = 0; i < n; i++) times.add(tl.flipStartMs + tl.flipGapMs * i);
  for (const m of ceremonyMarks(awardN)) times.add(m);
  return [...times].sort((a, b) => a - b);
}

/**
 * 모임 걷기 snap 의 구간들: 시작 위치(월드 단위, 스토어에 있던 마지막 위치)에서 자리까지 gatherMs 안에 도착한다.
 * 시작 위치가 없거나 이미 자리면 한 점 구간(자리 그대로). p 는 고정소수점 정수, v 는 도착이 gatherMs 를 넘지 않게 올림한 고정소수점 거리/초다. 모두 같은 t0 다
 */
export function walkSnap(slots: Record<number, readonly [number, number]>, starts: Readonly<Record<number, { x: number; z: number } | undefined>>, t0: number): WorldSeg[] {
  const seconds = RESULT_TIMELINE.gatherMs / 1000;
  return Object.keys(slots)
    .map(Number)
    .sort((a, b) => a - b)
    .map((s) => {
      const [sx, sz] = slots[s]!;
      const from = starts[s];
      if (from === undefined) return { s, p: [sx, sz], t0, v: 0 };
      const x0 = Math.round(from.x * 100);
      const z0 = Math.round(from.z * 100);
      const dist = Math.hypot(sx - x0, sz - z0);
      if (dist === 0) return { s, p: [sx, sz], t0, v: 0 };
      return { s, p: [x0, z0, sx, sz], t0, v: Math.max(1, Math.ceil(dist / seconds)) };
    });
}

// ---------- 시상식 (11-09, 결정 D-7·D-24·D-25, UI-SPEC B-3) ----------
// 시간표: 5600 에 시작, i 번째 칭호 창은 [5600 + 2500i, 5600 + 2500(i + 1)). 창 시작 0ms 앞사람은 자기 자리로 걷고 이번 사람은 무대 가운데로 걷기 시작(0~900),
// 900ms 에 패가 뜨고 나머지 최대 4명이 박수, 2500ms 에 다음 창. 마지막 창이 끝나면 모두 자리 복귀 걷기, +600ms 에 직업 의상이 걷힌다(고른 look 으로).
// 서버가 정렬해 보낸 칭호 순서를 그대로 쓴다 — 여기서 재정렬하지 않는다. 시각은 모두 인자다.

export const CEREMONY = {
  /** 한 명당 길이 */
  windowMs: 2500,
  /** 무대 가운데로 걷는 시간(= 스포트라이트를 받는 구간) */
  walkMs: 900,
  /** 패가 뜨는 시각(창 시작 기준) */
  plateAtMs: 900,
  /** 마지막 창이 끝나고 직업 의상이 걷히기까지 */
  redressDelayMs: 600,
} as const;

/** 무대 가운데(서버 고정소수점). 서버 이동 마스크에는 예외 점이고 로컬 연출 구간이라 판정과 무관하다 */
export const CEREMONY_CENTER: readonly [number, number] = [STAGE_SPOT.x, STAGE_SPOT.z];

/** i 번째 창이 시작하는 시각 */
export const ceremonyWindowStart = (i: number): number => CEREMONY_START_MS + CEREMONY.windowMs * i;
/** n 개 창이 모두 끝나는 시각(= done 시작, 복귀 걷기 시작) */
export const ceremonyEnd = (n: number): number => ceremonyWindowStart(n);

/** 시상식에서 상태가 바뀌는 시각(창 시작·패 등장·끝·의상 복귀). 칭호가 없으면 빈 목록 */
export function ceremonyMarks(n: number): number[] {
  if (n <= 0) return [];
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(ceremonyWindowStart(i), ceremonyWindowStart(i) + CEREMONY.plateAtMs);
  out.push(ceremonyEnd(n), ceremonyEnd(n) + CEREMONY.redressDelayMs);
  return out;
}

export type CeremonyState =
  | {
      phase: "award";
      /** 지금 창의 목록 index */
      index: number;
      total: number;
      /** 지금 무대로 나온 사람 */
      seat: number;
      /** 앞사람(자리로 돌아간다). 첫 창은 null */
      prevSeat: number | null;
      /** 창 시작 0~900: 걷는 중 */
      walking: boolean;
      /** 패가 떠 있나(900 이후) */
      plate: boolean;
      /** 박수 대상: 패가 뜬 뒤 나머지 중 좌석 오름차순 최대 CLAP_MAX (탈락자 포함) */
      clap: number[];
    }
  | {
      phase: "done";
      total: number;
      /** 모두 자리 복귀 걷기 시작 시각 */
      returnAt: number;
      /** 직업 의상이 걷히는 시각(returnAt + 600) */
      redressAt: number;
      redressed: boolean;
      /** 마지막으로 무대에 있던 사람(복귀 걷기 대상) */
      lastSeat: number | null;
    };

/** 시각 t(연출 시계 ms)의 시상식 상태. 5600 이전이거나 칭호가 없으면 null (재접속·옛 서버는 시상식이 없다) */
export function ceremonyAt(t: number, awards: readonly { seat: number }[], cast: readonly CastMember[]): CeremonyState | null {
  const n = awards.length;
  if (n === 0 || t < CEREMONY_START_MS) return null;
  const rel = t - CEREMONY_START_MS;
  if (rel >= CEREMONY.windowMs * n) {
    const returnAt = ceremonyEnd(n);
    return { phase: "done", total: n, returnAt, redressAt: returnAt + CEREMONY.redressDelayMs, redressed: t >= returnAt + CEREMONY.redressDelayMs, lastSeat: awards[n - 1]?.seat ?? null };
  }
  const index = Math.floor(rel / CEREMONY.windowMs);
  const local = rel - index * CEREMONY.windowMs;
  const seat = awards[index]!.seat;
  const plate = local >= CEREMONY.plateAtMs;
  return {
    phase: "award",
    index,
    total: n,
    seat,
    prevSeat: index > 0 ? awards[index - 1]!.seat : null,
    walking: !plate,
    plate,
    clap: plate ? cast.filter((c) => c.seat !== seat).slice(0, CLAP_MAX).map((c) => c.seat) : [],
  };
}

/**
 * 건너뛰기(D-25): 현재 창을 즉시 끝내고 다음 창 0ms(마지막 창이면 done 시작)의 시각을 돌려준다. 시상식 밖이면 t 그대로.
 * 부르는 쪽이 돌려받은 시각을 새 마크로 쓰므로 같은 프레임에 여러 번 눌러도 한 칸씩 안전하게 간다.
 */
export function skipAward(t: number, n: number): number {
  if (n <= 0 || t < CEREMONY_START_MS) return t;
  const rel = t - CEREMONY_START_MS;
  if (rel >= CEREMONY.windowMs * n) return t;
  return ceremonyWindowStart(Math.floor(rel / CEREMONY.windowMs) + 1);
}

/**
 * 시상식 걷기 snap 의 구간들. 모든 좌석을 한 snap 에 담는다(snap 은 구간을 통째로 바꾼다):
 * moves 에 있는 좌석은 to 로 ms 안에 도착하게 걷고(출발 위치를 모르거나 ms 가 0 이거나 이미 거기면 한 점 구간 = 순간 이동), 나머지는 자기 둘레 자리에 서 있다.
 * p 는 고정소수점 정수, v 는 도착이 ms 를 넘지 않게 올림한 고정소수점 거리/초. 모두 같은 t0.
 */
export function ceremonySnap(
  slots: Record<number, readonly [number, number]>,
  starts: Readonly<Record<number, { x: number; z: number } | undefined>>,
  t0: number,
  moves: Readonly<Record<number, { to: readonly [number, number]; ms: number } | undefined>>,
): WorldSeg[] {
  return Object.keys(slots)
    .map(Number)
    .sort((a, b) => a - b)
    .map((s) => {
      const move = moves[s];
      const [sx, sz] = slots[s]!;
      if (move === undefined) return { s, p: [sx, sz], t0, v: 0 };
      const [tx, tz] = move.to;
      const from = starts[s];
      if (from === undefined || move.ms <= 0) return { s, p: [tx, tz], t0, v: 0 };
      const x0 = Math.round(from.x * 100);
      const z0 = Math.round(from.z * 100);
      const dist = Math.hypot(tx - x0, tz - z0);
      if (dist === 0) return { s, p: [tx, tz], t0, v: 0 };
      return { s, p: [x0, z0, tx, tz], t0, v: Math.max(1, Math.ceil(dist / (move.ms / 1000))) };
    });
}
