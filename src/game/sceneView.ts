// 아침 현장 화면의 순수 파생(21페이즈 D-13~D-16·D-26, UI-SPEC P21-10~P21-12·P21-16). DOM·window·시각을 읽지 않고 **역할을 읽지 않는다**(T-21-36).
// 읽는 값은 판 규칙(rulesetOf(modeOf))·단계·맵 id·공개 day.scene.house(spotCentersOf)·본인에게만 온 me.scene(내가 살핀 줄)뿐이다.
// 지점 상태는 me.scene 에 그 지점 줄이 없으면 new, r 가 clue·none 이면 done("내가 살핌" — none 은 카드가 "아무것도 없어요"로 알린다), touched·dark 면 dim.
// 두 dim 상태는 같은 모양이고 사유(why)는 접근성 이름에만 쓴다(D-15 — 먼저 손댄 흔적과 어두운 창은 같은 겉모양). 발자국 수는 내가 살핀 줄(r clue n)에만 있다(P21-16).
// 살필 수 있는 지점(actableSpotOf)은 서버 inspectSpot(shared/game/scene.ts)의 화면 거울이다 — 단추의 유무에만 쓰고 권위는 서버다(같은 고정소수점 거리·같은 반경·같은 순서).
import { ERRAND_ACT_R } from "../../shared/game/phases";
import { modeOf, rulesetOf } from "../../shared/game/ruleset";
import type { ClueLine, RoomView, SpotId, TracePiece } from "../../shared/protocol";
import { actablePlaceOf, spotCentersOf } from "./errandView";
import type { SpotCenter } from "./errandView";

/** 지점 표지 상태: 새(금빛) · 내가 살핌 · 점선(어두워서 못 봄·먼저 손댄 흔적) */
export type SpotState = "new" | "done" | "dim";

/** 점선 상태의 사유(접근성 이름에만 쓴다) */
export type DimWhy = "dark" | "touched";

/** 지점 한 곳: 월드 단위 좌표 + 상태 */
export interface SpotModel extends SpotCenter {
  state: SpotState;
  why?: DimWhy;
}

/**
 * 아침 지점 셋(발자국 → 옷 조각 → 창문). 원인 흐름 morning 이고 현장(day.scene)이 있을 때만이고 아니면 빈 배열.
 * 좌표는 서버와 같은 맵 표(clueSpots[house])이다.
 */
export function spotsOf(view: RoomView): SpotModel[] {
  if (view.phase !== "morning" || !rulesetOf(modeOf(view)).cause) return [];
  const lines = view.me.scene ?? [];
  return spotCentersOf(view).map((c) => {
    const line = lines.find((l) => l.spot === c.id);
    if (line === undefined) return { ...c, state: "new" as const };
    if (line.r === "touched" || line.r === "dark") return { ...c, state: "dim" as const, why: line.r };
    return { ...c, state: "done" as const };
  });
}

/**
 * 처리 반경(ERRAND_ACT_R) 안의 안 살핀(new) 지점 중 가장 가까운 것. 같은 거리면 앞(발자국 → 옷 조각 → 창문). 위치를 모르면 null.
 * 서버 inspectSpot 과 같은 판정이다(같은 반경·같은 순서).
 */
export function actableSpotOf(pos: { x: number; z: number } | null | undefined, spots: ReadonlyArray<SpotModel>): SpotId | null {
  const taken = spots.filter((s) => s.state !== "new").map((s) => s.id);
  return actablePlaceOf<SpotId>(pos, spots, taken, ERRAND_ACT_R);
}

/** 단서 카드 한 장: 어느 지점·결과 종류 + (발자국 수 | 조각). 단서 값은 내가 살핀 줄에서 그대로 온다 */
export interface ClueCardModel {
  spot: SpotId;
  kind: ClueLine["r"];
  n?: number;
  piece?: TracePiece;
}

/** 내가 받은 단서 카드들 — me.scene 순서(살핀 순서) 그대로. 원인 흐름이 아니거나 살핀 줄이 없으면 빈 배열 */
export function clueCardsOf(view: RoomView): ClueCardModel[] {
  if (!rulesetOf(modeOf(view)).cause) return [];
  return (view.me.scene ?? []).map((l) => ({
    spot: l.spot,
    kind: l.r,
    ...(l.r === "clue" && l.n !== undefined ? { n: l.n } : {}),
    ...(l.r === "clue" && l.piece !== undefined ? { piece: l.piece } : {}),
  }));
}
