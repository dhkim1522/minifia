// 판 규칙 한 곳(결정 0072·0089-12). 규칙은 상수 하나(RULES)이고 서버·화면 모두 이것을 직접 읽는다 — 판 종류는 없다(22-07, D-01).
// 직업 주장 배지(0066-1)·귓속말(0066-2)·순차 지목(0063-1)·동점 결선(0066-4)·마지막 3인 결전(0066-5) 코드는 지우지 않고 규칙 값으로 끈다 — 모두 꺼짐이다(정통 판은 이 선택과 별개의 나중 과제, 0081-6).
// pickTurn 은 낮 순서 개편과 동시 투표 코드 제거를 함께 하는 22-09 가 true 로 켠다(D-01 의 최종 값은 22-09 완료 시점).
// 이 모듈은 어떤 모듈도 import 하지 않는다(순환 방지).

export interface Ruleset {
  /** 직업 주장 배지(결정 0066-1). */
  readonly badge: boolean;
  /** 귓속말(결정 0066-2). */
  readonly whisper: boolean;
  /** 순차 지목(결정 0063-1). 꺼지면 투표는 산 사람 모두 동시에 15초. */
  readonly pickTurn: boolean;
  /** 동점 결선(결정 0066-4). 꺼지면 동점·0표는 처형 없는 밤. */
  readonly runoff: boolean;
  /** 마지막 3인 결전(결정 0066-5). 꺼지면 산 셋도 토론으로 간다. */
  readonly showdown: boolean;
}

/** 규칙 상수 하나 — 얼린 객체다. 규칙이 하나뿐이라 서버 흐름·화면 모두 인자로 주고받지 않고 이것을 읽는다. */
export const RULES: Ruleset = Object.freeze({ badge: false, whisper: false, pickTurn: false, runoff: false, showdown: false });

/** 정치 장치 다섯 중 하나라도 켜졌는가. 객체 전체를 훑지 않고 다섯 필드만 본다. */
export function politicsOn(rules: Ruleset): boolean {
  return rules.badge || rules.whisper || rules.pickTurn || rules.runoff || rules.showdown;
}
