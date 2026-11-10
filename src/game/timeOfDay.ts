// 시간대 배지 표 한 곳(18.1 P181-5, UI-SPEC D). 입력은 공개 단계(view.phase) 하나 — 역할·좌석을 읽지 않는다.
// 그림은 장면 조명과 같은 lightingOf 로 고른다(그래서 투표·변론은 노을 = 저녁). 맵 하늘색·조명표와 연동하지 않는다(G-18-1 과 독립).
import type { PhaseId } from "../../shared/protocol";
import { ASSET_VERSION } from "../net/assets";

export type TimeOfDay = "morning" | "day" | "dusk" | "night";

export const TOD_ORDER: readonly TimeOfDay[] = ["morning", "day", "dusk", "night"];

export const TOD_LABEL: Record<TimeOfDay, string> = { morning: "아침", day: "낮", dusk: "저녁", night: "밤" };

// RED 자리 구현 — GREEN 에서 lightingOf 로 바꾼다
export function todOf(_phase: PhaseId): TimeOfDay {
  return "day";
}

export function todSrc(tod: TimeOfDay): string {
  return `/weather/weather-${tod}.svg?v=${ASSET_VERSION}`;
}
