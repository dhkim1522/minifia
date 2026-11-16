// 판 규칙 한 곳(결정 0072·0089-12). 규칙은 상수 하나(RULES)이고 서버·화면 모두 이것을 직접 읽는다 — 판 종류는 없다(22-07, D-01).
// 직업 주장 배지(0066-1)·귓속말(0066-2)·동점 결선(0066-4)·마지막 3인 결전(0066-5) 코드는 지우지 않고 규칙 값으로 끈다 — 넷 모두 꺼짐이다(정통 판은 이 선택과 별개의 나중 과제, 0081-6).
// 순차 지목(0063-1)은 22페이즈(22-09, D-01·D-12)부터 기본 규칙이라 켜져 있다 — 동시 투표 코드는 지웠다. 낮 순서는 토론 → 찬반 → 순차 지목 → 유언 → 처형이다(0089-18).
// 이 모듈은 어떤 모듈도 import 하지 않는다(순환 방지).

export interface Ruleset {
  /** 직업 주장 배지(결정 0066-1). */
  readonly badge: boolean;
  /** 귓속말(결정 0066-2). */
  readonly whisper: boolean;
  /** 순차 지목(결정 0063-1). 22페이즈부터 기본 규칙(켜짐) — 산 사람이 좌석 순서로 한 명씩 차례로 고른다. */
  readonly pickTurn: boolean;
  /** 동점 결선(결정 0066-4). 꺼지면 동점·0표는 처형 없는 밤. */
  readonly runoff: boolean;
  /** 마지막 3인 결전(결정 0066-5). 꺼지면 산 셋도 토론으로 간다. */
  readonly showdown: boolean;
}

/** 규칙 상수 하나 — 얼린 객체다. 규칙이 하나뿐이라 서버 흐름·화면 모두 인자로 주고받지 않고 이것을 읽는다. */
export const RULES: Ruleset = Object.freeze({ badge: false, whisper: false, pickTurn: true, runoff: false, showdown: false });

/**
 * 정치 장치 넷(배지·귓속말·결선·결전) 중 하나라도 켜졌는가. 객체 전체를 훑지 않고 네 필드만 본다.
 * 순차 지목은 22페이즈부터 기본 규칙이라 빠진다 — 포함하면 누설 시험의 "꺼진 장치 키 0건" 구역이 조용히 통째로 skip 된다(22-09 Pitfall 2).
 */
export function politicsOn(rules: Ruleset): boolean {
  return rules.badge || rules.whisper || rules.runoff || rules.showdown;
}
