// 아침 현장 판정(21페이즈 D-12~D-16·D-22) — 순수 모듈: 시각·전역 난수를 읽지 않고(난수는 인자) 입력 상태를 바꾸지 않는다.
// 불변식: 이 파일은 역할(Player.role)을 읽지 않는다. 단서는 의상·밤 선택·가로등·이웃 관계의 함수일 뿐이고 확정 증거가 아니다(D-12·D-14).
// 역할을 읽는 흐리기(마피아가 먼저 만진 지점)는 mafiaTouch.ts 의 markSmudge 한 곳이다 — actInspect 는 흐려진 지점이면 touched 를 줄 뿐 누가 흐렸는지 모른다.
// 서버 전용: RoomState.scene 의 steps·cloth·window·eyes·smudged 와 Player.clues(본인 view 의 me.clues 로만 복사). 공개되는 것은 scene.house 하나다(day.scene).
import type { ClueLine, PhaseId, TracePiece } from "../protocol";
import { isAlive } from "./alive";
import { DEFAULT_LOOK } from "./look";
import { UNIT } from "./map";
import { TOWN_CLUE_SPOTS } from "./mapTown";
import { roomMapId } from "./maps";
import { ERRAND_ACT_R } from "./phases";
import type { RoomState } from "./room";
import { TRACE_OF_OUTFIT, traceCandidates } from "./trace";

type RandInt = (n: number) => number;
type ClueSpot = 1 | 2 | 3;

/** 그날 낮 동안(아침~처형) 본인 단서가 남는 단계. 다음 저녁 진입(clearScene)이 지운다. */
export const CLUE_PHASES: readonly PhaseId[] = ["morning", "discussion", "nomination", "defense", "verdict", "execution"];

/** 집이 놓인 고리의 크기(마을 집 여덟, 북서 모서리부터 시계 방향으로 좌석 0~7). */
const HOUSE_RING = 8;

/** 옆집 둘(좌석 ±1, 7 다음 0 — 집이 시계 방향 고리로 놓여 있다). 낮은 쪽부터가 아니라 [앞집, 뒷집] 순이다. */
export function neighborsOf(house: number): [number, number] {
  return [(house + HOUSE_RING - 1) % HOUSE_RING, (house + 1) % HOUSE_RING];
}

/**
 * 현장 만들기(D-12·D-14·D-16). state 는 판정 전(nightPick 이 아직 있는) 밤 시작 상태, house 는 피해자 집(미수면 마피아 확정 대상의 집).
 * 풀 = traceCandidates(그 집을 고른 산 사람, 집 주인 제외, 좌석 오름차순), steps = 풀 크기.
 * 난수 호출 순서가 계약이다: 첫 난수 i = randInt(풀 크기) → cloth = 풀[i] 의 의상 조각. 풀이 둘 이상이면 둘째 난수 j = (i + 1 + randInt(풀 크기 − 1)) % 풀 크기 → window = 풀[j] 의 조각(cloth 와 다른 사람),
 * 풀이 하나면 난수를 더 부르지 않고 window = cloth. eyes = 이웃 중 판정 뒤 살아 있고(aliveAfter) 가로등 번호가 litNumbers 에 든 좌석. 풀이 비면 현장을 만들지 않고 난수도 부르지 않는다.
 */
export function buildScene(state: RoomState, house: number, randInt: RandInt, litNumbers: readonly number[], aliveAfter: readonly number[]): RoomState["scene"] {
  const pool = traceCandidates(state, house);
  if (pool.length === 0) return undefined;
  const pieceOf = (i: number): TracePiece => TRACE_OF_OUTFIT[pool[i]!.look ?? DEFAULT_LOOK];
  const i = randInt(pool.length);
  const cloth = pieceOf(i);
  const window = pool.length > 1 ? pieceOf((i + 1 + randInt(pool.length - 1)) % pool.length) : cloth;
  const eyes = neighborsOf(house)
    .filter((seat) => aliveAfter.includes(seat) && litNumbers.includes(seat))
    .sort((a, b) => a - b);
  return { house, steps: pool.length, cloth, window, eyes, smudged: [] };
}

const distSq = (a: { x: number; z: number }, b: { x: number; z: number }): number => (a.x - b.x) * (a.x - b.x) + (a.z - b.z) * (a.z - b.z);

/**
 * 현장 살피기(D-13). morning 단계 · 현장 있음 · 행위자가 방에 있는 산 사람 · 이 맵에 단서 지점 표가 있음(마을)일 때, 본인이 아직 안 살핀 지점 중 중심까지 ERRAND_ACT_R 안의 가장 가까운 것
 * (같으면 번호 작은 것) 하나를 살핀다: 흐려진 지점이면 touched, ① 은 footprint(n = 발자국 수), ② 는 cloth, ③ 은 eyes 에 행위자 좌석이 있으면 window 아니면 dark 를 본인 clues 끝에 더한다.
 * 그 밖은 사유를 가르지 않고 { ok: false } 하나다(D-21) — 응답이 오라클이 되지 않는다. 마피아의 흐리기는 호출하는 쪽이 이 결과에 markSmudge 를 적용한다.
 */
export function actInspect(state: RoomState, actorId: string, posFx: { x: number; z: number }): { ok: true; state: RoomState; spot: ClueSpot } | { ok: false } {
  const scene = state.scene;
  if (state.phase !== "morning" || scene === undefined) return { ok: false };
  const actor = state.players.find((p) => p.id === actorId);
  if (actor === undefined || !isAlive(actor)) return { ok: false };
  if (roomMapId(state) !== "town") return { ok: false };
  const spots = TOWN_CLUE_SPOTS[scene.house];
  if (spots === undefined) return { ok: false };
  const mine = actor.clues ?? [];
  const reach = ERRAND_ACT_R * UNIT;
  let best: ClueSpot | undefined;
  let bestD = Infinity;
  for (const spot of [1, 2, 3] as const) {
    if (mine.some((c) => c.spot === spot)) continue;
    const d = distSq(spots[spot - 1]!, posFx);
    if (d <= reach * reach && d < bestD) {
      bestD = d;
      best = spot;
    }
  }
  if (best === undefined) return { ok: false };
  const spot = best;
  let line: ClueLine;
  if (scene.smudged.includes(spot)) line = { spot, kind: "touched" };
  else if (spot === 1) line = { spot, kind: "footprint", n: scene.steps };
  else if (spot === 2) line = { spot, kind: "cloth", piece: scene.cloth };
  else line = scene.eyes.includes(actor.seat) ? { spot, kind: "window", piece: scene.window } : { spot, kind: "dark" };
  return {
    ok: true,
    spot,
    state: { ...state, players: state.players.map((p) => (p.id === actorId ? { ...p, clues: [...mine, line] } : p)) },
  };
}

/** 현장과 모든 단서를 지운다(새 저녁 진입, D-17). 지울 것이 없으면 같은 객체. */
export function clearScene(state: RoomState): RoomState {
  if (state.scene === undefined && !state.players.some((p) => "clues" in p)) return state;
  const { scene: _scene, ...rest } = state;
  return {
    ...rest,
    players: state.players.map((p) => {
      const { clues: _clues, ...kept } = p;
      return kept;
    }),
  };
}
