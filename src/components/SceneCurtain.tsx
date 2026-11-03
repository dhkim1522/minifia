import type { RoomView } from "../../shared/protocol";

export interface SceneCurtainProps {
  view: RoomView;
  /** 서버시각 − 로컬시각(ms) */
  offset: number;
  reducedMotion: boolean;
  /** 이 시각(Date.now 기준)까지는 다음 단계 view 가 와도 막을 걷지 않는다(피해자 연출) */
  holdUntil?: number;
}

// RED 단계의 빈 틀 — 구현은 GREEN 에서 채운다(시험이 import 오류가 아닌 단언으로 실패하게 하는 최소 모양)
export function SceneCurtain(_props: SceneCurtainProps) {
  return null;
}
