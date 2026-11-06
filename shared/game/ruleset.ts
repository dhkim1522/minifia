// 기본판 한 곳의 설정(결정 0072, D-05). 서버 흐름의 분기(tick 표·지목 마감·낮 시작 분기·저장 방 정규화)는 이 값만 읽는다.
// 직업 주장 배지(0066-1)·귓속말(0066-2)·순차 지목(0063-1)·동점 결선(0066-4)·마지막 3인 결전(0066-5) 코드는 지우지 않고 이 값으로 끈다.
// 판 이름·고르기 화면은 없다(D-01) — 정통 판(장치 켜기)은 나중 과제이고, 그때도 이 한 곳의 값만 바뀐다.
// 다른 모듈을 import 하지 않는다(순환 방지).

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

export const BASIC_RULESET: Ruleset = Object.freeze({
  badge: false,
  whisper: false,
  pickTurn: false,
  runoff: false,
  showdown: false,
});

export const RULESET: Ruleset = BASIC_RULESET;
