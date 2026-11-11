// 헤더 시간대 낱말 표 한 곳(결정 0083-1). 입력은 공개 단계(view.phase) 하나 — 역할·좌석을 읽지 않는다.
// 시간대는 장면 조명과 같은 lightingOf 로 고른다(그래서 투표·변론은 노을 = 저녁). 맵 하늘색·조명표와 연동하지 않는다(G-18-1 과 독립).
import type { PhaseId } from "../../shared/protocol";
import { lightingOf } from "../world/presence";

export type TimeOfDay = "morning" | "day" | "dusk" | "night";

export const TOD_ORDER: readonly TimeOfDay[] = ["morning", "day", "dusk", "night"];

export const TOD_LABEL: Record<TimeOfDay, string> = { morning: "아침", day: "낮", dusk: "저녁", night: "밤" };

/** 장면 조명 하나(lightingOf)에서 시간대를 고른다. 밤은 역할과 무관하게 한 갈래 — 같은 밤이면 모두 같은 값 */
export function todOf(phase: PhaseId): TimeOfDay {
  switch (lightingOf(phase)) {
    case "morning":
      return "morning";
    case "night":
    case "nightCitizen":
    case "nightGhost":
      return "night";
    case "vote":
    case "trial":
      return "dusk";
    case "talk":
      return "day";
  }
}

/** 헤더 단계 이름 앞의 옅은 낱말. 단계 이름이 같은 낱말이면(밤·아침) 한 단어라 null */
export function todWordOf(phase: PhaseId, title: string): string | null {
  const word = TOD_LABEL[todOf(phase)];
  return word === title ? null : word;
}
