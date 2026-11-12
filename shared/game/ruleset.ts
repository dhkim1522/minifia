// 판 규칙 한 곳(결정 0072·0081-6). 판 종류는 방 상태 값이고 규칙은 rulesetOf 로 얻는다.
// 판 종류(GameMode)는 방장이 고르는 공개 값이다(19페이즈 D-01·D-05): 기본 마피아(basic)는 할 일·증거가 없고, 확장판(extended)은 심부름·목격 기록·밤 흔적이 있다.
// 직업 주장 배지(0066-1)·귓속말(0066-2)·순차 지목(0063-1)·동점 결선(0066-4)·마지막 3인 결전(0066-5) 코드는 지우지 않고 규칙 값으로 끈다 — 두 판 모두 꺼짐이다(정통 판은 이 선택과 별개의 나중 과제, 0081-6).
// 서버 흐름은 방 상태에서 얻은 규칙(rulesetOf(modeOf(state)))을 읽는다. 전역 상수 RULESET·BASIC_RULESET 은 옮기는 동안만 남아 있다(19-02 가 지운다).
// ../protocol(런타임 import 가 없는 와이어 모듈) 외에는 import 하지 않는다(순환 방지).
import { DEFAULT_MODE, GAME_MODES } from "../protocol";
import type { GameMode } from "../protocol";

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
  /** 낮 심부름 단계(결정 0074, 19페이즈 D-02). 꺼지면 낮 시작 발표 다음이 바로 토론이다(D-08). */
  readonly errand: boolean;
  /** 목격 기록과 아침의 마지막 목격(결정 0074·0079, D-02). 꺼지면 me.record·morning.seen 키가 없다. */
  readonly witness: boolean;
  /** 아침 밤 흔적(결정 0074·0079, D-02). 꺼지면 흔적 조각을 만들지도 싣지도 않는다. */
  readonly trace: boolean;
}

/** 정치 장치 다섯은 두 판 모두 꺼짐이다(D-02). */
const POLITICS_OFF = { badge: false, whisper: false, pickTurn: false, runoff: false, showdown: false } as const;

/** 판마다 얼린 규칙 객체 하나(D-02). Record 라 판 종류를 늘리면 여기서 컴파일이 실패한다. */
const RULESETS: Readonly<Record<GameMode, Ruleset>> = Object.freeze({
  basic: Object.freeze({ ...POLITICS_OFF, errand: false, witness: false, trace: false }),
  extended: Object.freeze({ ...POLITICS_OFF, errand: true, witness: true, trace: true }),
});

/** 판 종류의 규칙. 같은 판은 늘 같은 얼린 객체다. */
export function rulesetOf(mode: GameMode): Ruleset {
  return RULESETS[mode];
}

/**
 * 방 상태·view 의 판 종류를 읽는 한 곳(D-01·D-04). 값이 GAME_MODES 안이면 그 값, 없거나 허용 밖이면 기본값(extended) —
 * mode 없이 저장된 옛 방은 읽는 쪽 기본값이 받는다(RESEARCH Pattern 6).
 */
export function modeOf(holder: { readonly mode?: unknown }): GameMode {
  const mode = holder.mode;
  return (GAME_MODES as readonly unknown[]).includes(mode) ? (mode as GameMode) : DEFAULT_MODE;
}

/** 정치 장치 다섯 중 하나라도 켜졌는가. 객체 전체를 훑지 않는다 — errand·witness·trace 는 정치 장치가 아니다. */
export function politicsOn(rules: Ruleset): boolean {
  return rules.badge || rules.whisper || rules.pickTurn || rules.runoff || rules.showdown;
}

/** 19-02 가 지운다 — 옮기는 동안 기본 판(extended)의 규칙 객체를 가리킨다. 정치 장치 다섯은 두 판에서 같아 지금 읽는 곳의 동작은 그대로다. */
export const BASIC_RULESET: Ruleset = rulesetOf(DEFAULT_MODE);

/** 19-02 가 지운다 — 새 코드는 rulesetOf(modeOf(state)) 를 쓴다. */
export const RULESET: Ruleset = BASIC_RULESET;
