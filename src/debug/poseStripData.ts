// 포즈 스트립(?pose-strip=1) 격자 정의 — 순수 모듈(three·DOM 을 모른다). 10-06, D-8·O-11.
// 운영 번들의 perfProbe 가 게이트 판정을 위해 가져오므로 characterData·character(three)를 가져오지 않는다:
// 의상 목록은 OUTFIT_ORDER 로 되풀이해 두고 test/unit/poseStrip.test.ts 가 OUTFITS 와 어긋남을 잡는다.
import { EMOTE_MS } from "../../shared/game/emote";
import { MOVE_SPEED } from "../../shared/game/world";
import { EMOTE_IDS, type EmoteId } from "../../shared/protocol";
import { worldTestHooksEnabled } from "../world/testHooks";
import type { StorageLike } from "../net/session";

export const POSE_STRIP_PARAM = "pose-strip";
/** 샘플 시각 열 수 */
export const STRIP_COLS = 4;
/** 인물 수(characterData.FIGS 와 같다 — 시험이 확인) */
export const FIG_COUNT = 5;
/** 의상 9종(characterData.OUTFITS 키 순서 — 시험이 확인) */
export const OUTFIT_ORDER = ["coat", "police", "doctor", "detective", "noir", "mafia", "reporter", "elder", "hood"] as const;
export type StripOutfit = (typeof OUTFIT_ORDER)[number];

export type StripRow = EmoteId | "idle" | "walk";
export type StripView = "strip" | "combos";
export type StripPose = "idle" | "walk";

/** 동작 행 샘플 위치(길이 대비 비율) */
const EMOTE_FRACTIONS = [0.15, 0.4, 0.65, 0.9] as const;
/** idle 행 샘플 시각(초) */
const IDLE_TIMES = [0, 0.5, 1, 1.5] as const;
/** 걷기 위상 하나의 걸음 속도(character.WALK_PHASE_RATE 와 같다 — 시험이 확인). dt = 위상 / 이 값 */
export const WALK_RATE = (11 * MOVE_SPEED) / 1.245;

/** ?pose-strip=1 이고 개발 빌드이거나 ?e2e=1(세션 저장 포함) 문맥일 때만 참 (T-10-19) */
export function poseStripEnabled(search: string, storage: StorageLike | null, dev = false): boolean {
  if (new URLSearchParams(search).get(POSE_STRIP_PARAM) !== "1") return false;
  return worldTestHooksEnabled(search, storage, dev);
}

/** 행: 동작 아홉(EMOTE_IDS 순서) + 서기 + 걷기 */
export function stripRows(): StripRow[] {
  return [...EMOTE_IDS, "idle", "walk"];
}

export interface SamplePlan {
  kind: "emote" | "idle" | "walk";
  id?: EmoteId;
  /** emote: 재생 시작 뒤 초 · idle: 초 · walk: 걷기 위상 / WALK_RATE (dt) */
  t: number;
  /** walk 만: 걷기 위상(rad) */
  phase?: number;
}

export type SampleCell = { view: "strip"; row: StripRow } | { view: "combos"; pose: StripPose };

function walkPlan(phase: number): SamplePlan {
  return { kind: "walk", t: phase / WALK_RATE, phase };
}

/** 칸 하나의 자세 계획. strip 은 col 이 샘플 시각(0~3), combos 는 자세가 칸마다 같다 */
export function samplePlan(cell: SampleCell, col: number): SamplePlan {
  if (cell.view === "combos") return cell.pose === "walk" ? walkPlan(Math.PI / 2) : { kind: "idle", t: 0 };
  const c = Math.min(Math.max(Math.trunc(col), 0), STRIP_COLS - 1);
  if (cell.row === "idle") return { kind: "idle", t: IDLE_TIMES[c] };
  if (cell.row === "walk") return walkPlan((c * Math.PI) / 2);
  return { kind: "emote", id: cell.row, t: (EMOTE_MS[cell.row] / 1000) * EMOTE_FRACTIONS[c] };
}

export interface PoseStripParams {
  fig: number;
  outfit: StripOutfit;
  view: StripView;
  pose: StripPose;
}

/** 선택값: 잘못된 값은 기본값(0·coat·strip·idle) */
export function parsePoseStripParams(search: string): PoseStripParams {
  const q = new URLSearchParams(search);
  const figRaw = q.get("fig");
  const fig = figRaw !== null && /^\d+$/.test(figRaw) && Number(figRaw) < FIG_COUNT ? Number(figRaw) : 0;
  const outfitRaw = q.get("outfit");
  const outfit = (OUTFIT_ORDER as readonly string[]).includes(outfitRaw ?? "") ? (outfitRaw as StripOutfit) : "coat";
  const view: StripView = q.get("view") === "combos" ? "combos" : "strip";
  const pose: StripPose = q.get("pose") === "walk" ? "walk" : "idle";
  return { fig, outfit, view, pose };
}
