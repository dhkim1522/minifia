// 아침 현장 조사(21페이즈 D-12~D-17·D-21, 결정 0088) — 순수 모듈: 시각을 읽지 않고(난수는 인자) 입력 상태를 바꾸지 않는다.
// 현장에서 역할을 읽는 유일한 파일이다(lamps.ts 가 등불에서 그러듯). night.ts 는 buildScene 을 부를 뿐 역할을 읽지 않고, 역할을 읽는 곳은 inspectSpot 의 "산 마피아가 살폈다" 한 줄이다.
// 현장은 서버 전용 RoomState.scene 이고 어떤 view 에도 그대로 싣지 않는다: 공개되는 것은 현장 집 좌석(day.scene.house)뿐이고, 받은 단서는 본인 Player.sceneSeen 에만 남아 me.scene 으로 간다.
// 지점 순서는 SPOT_IDS 와 맵의 단서 지점 표(MapDef.clueSpots) 순서가 같다 — 발자국(수) · 옷 조각(조각 하나) · 창문(짝집 창이 켜졌으면 조각 하나, 꺼졌으면 어두워서 못 봄).
import type { ClueLine, SpotId, TracePiece } from "../protocol";
import { SPOT_IDS } from "../protocol";
import { isAlive } from "./alive";
import { DEFAULT_LOOK } from "./look";
import { UNIT } from "./map";
import { mapOf, roomMapId } from "./maps";
import { neighborOf } from "./mapTown";
import { ERRAND_ACT_R } from "./phases";
import type { Player, RoomState, SceneState } from "./room";
import { modeOf, rulesetOf } from "./ruleset";
import { TRACE_OF_OUTFIT, traceCandidates } from "./trace";

type RandInt = (n: number) => number;

const pieceOf = (p: Player): TracePiece => TRACE_OF_OUTFIT[p.look ?? DEFAULT_LOOK];

/**
 * 아침 진입 때 현장 하나를 만든다. house 는 현장 집 좌석(피해자, 없으면 의사가 막은 확정 대상 — 호출하는 쪽이 정한다)이고, 없거나 맵에 그 집의 지점 표가 없으면 undefined(D-17·집 없는 맵).
 * state 는 nightPick 을 지우기 전의 상태여야 한다(풀은 그 밤 그 집을 고른 산 사람 — trace.ts 의 traceCandidates).
 * 발자국 = 후보 수. 옷 조각 = 후보가 있으면 randInt(n) 한 번으로 고른 사람의 조각. 창문 = n ≥ 2 면 randInt(n − 1) 로 옷 조각의 사람을 뺀 나머지 중 한 명의 조각, n = 1 이면 옷 조각과 같은 조각, n = 0 이면 없음.
 * 창문이 읽히려면 windowLit(짝집 창 불 = state.lamps[짝집 좌석])가 참이어야 한다 — 난수는 켜짐과 무관하게 부른다(호출 수는 후보 수의 함수). 난수는 원인 분기 안에서만 늘어난다(시드 계약).
 */
export function buildScene(state: RoomState, house: number | undefined, randInt: RandInt): SceneState | undefined {
  if (house === undefined || mapOf(roomMapId(state)).clueSpots?.[house] === undefined) return undefined;
  const pool = traceCandidates(state, house);
  let cloth: TracePiece | undefined;
  let window: TracePiece | undefined;
  if (pool.length > 0) {
    const first = randInt(pool.length);
    cloth = pieceOf(pool[first]!);
    if (pool.length === 1) {
      window = cloth;
    } else {
      const rest = pool.filter((_, i) => i !== first);
      window = pieceOf(rest[randInt(rest.length)]!);
    }
  }
  const pair = neighborOf(house);
  const windowLit = pair !== undefined && state.lamps?.[pair] === true;
  return { house, footprints: pool.length, ...(cloth === undefined ? {} : { cloth }), ...(window === undefined ? {} : { window }), windowLit, touched: {} };
}

/** 한 지점의 결과 줄(D-14·D-15). 먼저 손댄 흔적이 이기고, 발자국·옷 조각은 없으면 "none", 창문은 어두우면 "dark". */
function lineOf(scene: SceneState, spot: SpotId): ClueLine {
  if (scene.touched[spot] === true) return { spot, r: "touched" };
  if (spot === "footprint") return scene.footprints > 0 ? { spot, r: "clue", n: scene.footprints } : { spot, r: "none" };
  if (spot === "cloth") return scene.cloth !== undefined ? { spot, r: "clue", piece: scene.cloth } : { spot, r: "none" };
  if (!scene.windowLit) return { spot, r: "dark" };
  return scene.window !== undefined ? { spot, r: "clue", piece: scene.window } : { spot, r: "none" };
}

/**
 * 지점 살피기(D-13). 원인 흐름 morning 에서 scene 이 있고 행위자가 방에 있는 산 사람일 때, 반경 ERRAND_ACT_R 안의 아직 안 살핀 지점 중 가장 가까운 하나(같으면 발자국 → 옷 조각 → 창문 순)를
 * 살핀다 — 결과 줄을 본인 sceneSeen 끝에 더한다. 그 밖은 사유를 가르지 않고 { ok: false } 하나다(D-21, 응답이 오라클이 되지 않는다).
 * 결과를 계산한 **뒤** 행위자가 산 마피아면 그 지점을 touched 로 표시한다(D-15 — 마피아 자신은 평소 단서, 그 뒤에 살피는 사람은 흔적). 응답은 역할과 무관하게 같은 모양이다(상태 한 번 쓰기).
 */
export function inspectSpot(state: RoomState, actorId: string, posFx: { x: number; z: number }): { ok: true; state: RoomState } | { ok: false } {
  const scene = state.scene;
  if (state.phase !== "morning" || scene === undefined || !rulesetOf(modeOf(state)).cause) return { ok: false };
  const actor = state.players.find((p) => p.id === actorId);
  const spots = mapOf(roomMapId(state)).clueSpots?.[scene.house];
  if (actor === undefined || !isAlive(actor) || spots === undefined) return { ok: false };
  const seen = actor.sceneSeen ?? [];
  const reach = ERRAND_ACT_R * UNIT;
  let best: SpotId | undefined;
  let bestD = Infinity;
  SPOT_IDS.forEach((id, k) => {
    const at = spots[k];
    if (at === undefined || seen.some((l) => l.spot === id)) return;
    const d = (at.x - posFx.x) ** 2 + (at.z - posFx.z) ** 2;
    if (d <= reach * reach && d < bestD) {
      bestD = d;
      best = id;
    }
  });
  if (best === undefined) return { ok: false };
  const spot: SpotId = best;
  const line = lineOf(scene, spot);
  const nextScene: SceneState = actor.role === "mafia" ? { ...scene, touched: { ...scene.touched, [spot]: true } } : scene;
  return {
    ok: true,
    state: { ...state, scene: nextScene, players: state.players.map((p) => (p.id === actorId ? { ...p, sceneSeen: [...seen, line] } : p)) },
  };
}
