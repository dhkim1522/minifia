// 등불·집 창 파생(21페이즈 D-04·D-07·D-24·D-25, 결정 0088 A2). 3D 장면(world/maps/town.ts 의 setLamps)과 DOM(21-09 의 문패 창 점)이 같은 값 하나에서 그리게 하는 순수 함수다.
// DOM·window·시각을 읽지 않고 역할도 읽지 않는다 — 읽는 값은 맵 id·판 규칙·단계·공개 day.lamps·내 심부름 진행(me.errand.done)뿐이다.
//   - 저녁(errand)에는 내가 켠 등불만 내 화면에서 켜진다(A2: 남의 켜짐은 서버가 방송하지 않는다).
//   - 밤부터는 서버가 밤 진입에 정한 공개 boolean 여덟(day.lamps, 등불 i = 집 i 창)을 모두가 같게 본다. 꺼진 이유(안 켬·잘림)는 어디에도 없다(D-21).
import { TOWN_LAMPS } from "../../shared/game/mapTown";
import { modeOf, rulesetOf } from "../../shared/game/ruleset";
import type { PhaseId, RoomView } from "../../shared/protocol";

/** 집 창이 day.lamps 를 따르기 시작하는 단계 앞쪽(저녁 앞): 이 단계에서는 집 창이 지금 주인 규칙이다 */
const BEFORE_NIGHT: ReadonlySet<PhaseId> = new Set<PhaseId>(["lobby", "tutorial", "assigning", "roleReveal", "dayAnnounce", "errand"]);

/** 원인 흐름이 켜진 마을 판인가 — 아니면 등불·집 창 파생은 모두 null(기본판·옛 확장판·재즈 바·광장) */
function causeTown(view: RoomView): boolean {
  return view.map === "town" && rulesetOf(modeOf(view)).cause;
}

/**
 * 가로등 8개의 켜짐(TOWN_LAMPS 순서). 원인 흐름 마을이 아니면 null.
 * errand 단계: 내 me.errand.done 에 든 등불만 true(내 화면만). 그 밖: view.day.lamps 의 사본(없으면 모두 false).
 */
export function lampLitOf(view: RoomView): boolean[] | null {
  if (!causeTown(view)) return null;
  if (view.phase === "errand") {
    const done = view.me.errand?.done ?? [];
    return TOWN_LAMPS.map((lamp) => done.some((id) => id === lamp.id));
  }
  const lamps = view.day?.lamps;
  return TOWN_LAMPS.map((_, i) => lamps?.[i] === true);
}

/**
 * 집 창 8개의 켜짐(집 i = 좌석 i). 원인 흐름 마을의 밤 이후 단계이고 서버가 day.lamps 를 준 때만 그 사본이고, 아니면 null(지금 주인 규칙).
 * 3D 창과 21-09 문패 창 점이 이 함수 하나를 쓴다(P21-4).
 */
export function houseLitOf(view: RoomView): boolean[] | null {
  if (!causeTown(view) || BEFORE_NIGHT.has(view.phase)) return null;
  const lamps = view.day?.lamps;
  if (lamps === undefined) return null;
  return TOWN_LAMPS.map((_, i) => lamps[i] === true);
}
