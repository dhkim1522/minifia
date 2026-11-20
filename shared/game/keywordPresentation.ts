import type { KeywordPresentation } from "../protocol";
import { BAR_SEATS_FX } from "./map";
import type { RoomState } from "./room";

// +x가 오른쪽, +z가 아래쪽인 원탁 평면에서 의자 0을 기준으로 시계 방향 각을 잰다.
export const BAR_CHAIR_CLOCKWISE_ANGLES: readonly number[] = BAR_SEATS_FX.map(([x, z]) => {
  const angle = Math.atan2(-x, z);
  return angle < 0 ? angle + 2 * Math.PI : angle;
});

/** 첫날 공개 차례의 현재 답만 고른다. 이전 형식으로 저장된 방에는 차례 인덱스가 없다. */
export function keywordPresentationOf(state: RoomState, now?: number): KeywordPresentation | undefined {
  const { keywordPresentationIndex: index, keywordAnswers: rows } = state;
  if (state.phase !== "dayAnnounce" || state.day !== 1 || state.keyword === undefined || index === undefined || rows === undefined) return undefined;
  if (state.phaseEndsAt === null || (now !== undefined && now >= state.phaseEndsAt)) return undefined;
  const row = rows[index];
  if (row === undefined) return undefined;
  return { order: index + 1, total: rows.length, seat: row.seat, text: row.text };
}
