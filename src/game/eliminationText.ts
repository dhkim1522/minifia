import type { MorningView } from "../../shared/protocol";

// 아침 알림의 문장 표 한 곳(결정 0061-17, UI-SPEC 다르게 하는 곳 1 — 사회자 문체 세 문장). 서버는 탈락 seat 와 saved 플래그만 보내고
// 문장은 화면이 만든다. v1.0 의 문구 번호·꼬리 문장 일곱 가지·카드 제목은 없어졌다(정적 가드가 막는다).
// 이름 뒤에는 받침과 상관없이 항상 ' 님이' 를 붙인다(받침 판정 없음). 문자열만 만든다 — 호출자가 React 텍스트로 그린다(HTML 해석 없음).
// 누가 살아났는지는 어떤 문장에도 쓰지 않는다(결정 0044-22): saved 는 고정 문장 하나다.
// 처형 발표는 이 파일이 아니라 dayView 의 DAY_COPY 가 둔다.

export const MORNING_TEXT = {
  /** 피해자가 있는 아침(다른 모두에게) */
  killed: (name: string): string => `${name} 님이 당했습니다`,
  /** 의사가 확정 대상을 지킨 아침. 누구인지는 없다 */
  saved: "누군가 살아났습니다",
  /** 아무도 안 죽고 아무도 안 지킨 아침 */
  quiet: "아무 일도 없었습니다",
  /** 피해자 본인에게만(36px 알림 한 번, 결정 NIGHT-11) */
  victim: "암살당했습니다",
} as const;

export interface MorningText {
  text: string;
  /** 알림 앞 아이콘. 아무 일 없음은 없다 */
  icon?: "target" | "heal";
}

/** 아침 알림 문장(공개 정보만). 피해자가 있고 닉네임을 찾으면 피해자 문장, saved 면 구출 문장, 아니면 무사 문장 */
export function morningText(morning: MorningView | undefined, nicknameOf: (seat: number) => string | undefined): MorningText {
  if (morning?.eliminated !== undefined) {
    const name = nicknameOf(morning.eliminated);
    if (name !== undefined) return { text: MORNING_TEXT.killed(name), icon: "target" };
  }
  if (morning?.saved === true && morning.eliminated === undefined) return { text: MORNING_TEXT.saved, icon: "heal" };
  return { text: MORNING_TEXT.quiet };
}
