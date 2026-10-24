import type { ReactElement } from "react";
import "../styles/day.css";

/** 관전 하단 읽기 전용 안내 문구(Copywriting 표의 한 곳) */
export const READ_ONLY_TEXT = "탈락했어요 · 볼 수만 있어요";

// 관전자(탈락자) 하단 — 보내기 줄 대신. 눌리지 않는 일반 문단이다(결정 0021, 시안 E1 .ro).
export function ReadOnlyRow(): ReactElement {
  return <p className="mf-ro">{READ_ONLY_TEXT}</p>;
}
