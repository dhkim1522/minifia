import type { ReactElement } from "react";
import "../styles/day.css";

/** 관전 하단 읽기 전용 안내 문구(Copywriting 표의 한 곳) */
export const READ_ONLY_TEXT = "탈락했어요 · 볼 수만 있어요";

// 관전자(탈락자) 하단 — 보내기 줄 대신. 눌리지 않는 일반 문단이다(결정 0021, 시안 E1 .ro).
// text 를 주면 그 문구를 쓴다(투표 단계의 관전 알약, 04-16). 안 주면 기존 문구라 기존 호출은 바뀌지 않는다.
// guide 가 참이면 이 줄이 그 화면의 "지금 할 일 한 문장"이다(UX-01 data-guide 계약). 관전 알약처럼 제목이 따로 안내를 맡는 곳에서는 켜지 않는다.
export function ReadOnlyRow({ text = READ_ONLY_TEXT, guide = false }: { text?: string; guide?: boolean } = {}): ReactElement {
  return (
    <p className="mf-ro" {...(guide ? { "data-guide": "" } : {})}>
      {text}
    </p>
  );
}
