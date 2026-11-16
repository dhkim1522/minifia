---
phase: 23-keyword-day-one
plan: "03"
subsystem: game-rules
tags: [keyword, guard, nfkc, choseong, static-guard, tdd]
requires: []
provides:
  - "shared/game/keywordGuard.ts: normalizeForGuard·choseongOf·violatesKeyword·KeywordForms (순수, import 없음)"
  - "shared/game/answerRules.ts: ANSWER_MAX_GRAPHEMES=20·ANSWER_MIN_GAP_MS=400 (클라이언트 import 가능)"
  - "test/unit/keywordStaticGuard.test.ts: src 가 서버 전용 키워드 모듈을 import 하지 않는 정적 가드(keywordModuleImports 순수 함수 포함)"
affects: [23-04, 23-06]
actuals:
  tokens: 5000
  tasks: 2
  commits: 4
plan_head_before: e733e723d9a8301c856ace47b21dfa40eff3d349
plan_head_after: da346676da5de346d03fc129a08c4ad13c989b37
tech-stack:
  added: []
  patterns:
    - "구조 타입 KeywordForms 로 keywords.ts 를 import 하지 않고 판정(클라이언트 import 그래프를 작게, 병렬 계획 독립)"
    - "정규화는 String.prototype.normalize('NFKC') 만 쓴다(직접 매핑 표 없음)"
    - "정적 가드는 stripComments 로 주석을 지운 import·export from·동적 import·require 지정자만 검사하고, 가짜 본문으로 자기 검사한다"
key-files:
  created:
    - shared/game/keywordGuard.ts
    - shared/game/answerRules.ts
    - test/unit/keywordGuard.test.ts
    - test/unit/keywordStaticGuard.test.ts
  modified: []
requirements: [SC2, SC7]
status: complete
---

# Phase 23 Plan 03: 금지어 판정과 클라이언트 import 가드 Summary

NFKC·글자숫자 외 제거·소문자 정규화 뒤 부분 포함, 3글자 이상 음절 키워드는 초성열까지 막는 순수 함수 `violatesKeyword` 와, 답 길이·간격 상수, 서버 전용 키워드 모듈의 클라이언트 import 정적 가드를 시험부터 만들었다.

## 한 일

- **Task 1 (TDD)**: RESEARCH P3 실행 확인 표 전부(해.리.포.터·Harry_Potter·전각·해리potter·초성·공백/하이픈/영폭 공백·부분 포함 막힘, hery foter·a해b리c포d터·ㅎㄹ·ㅎㄹㅍ·무관 설명 통과)와 경계 사례(숫자·2글자·영어 키워드, 길이 1 별칭 무시, 빈 답·기호뿐 답, NFD·호환 자모, `ﬁ` 류 길이 변화, 고양이↔가을이 알려진 한계)를 단언했다.
  - RED: 모듈이 없어 시험 파일 1개 실패(`Test Files 1 failed`, 테스트 0개 실행).
  - GREEN: 31개 통과.
- **Task 2 (TDD)**: `answerRules.ts` 상수와 정적 가드 시험.
  - RED: `answerRules` 모듈이 없어 시험 파일 1개 실패.
  - GREEN: 두 파일 합쳐 45개 통과(chatStaticGuard 에서 가져온 `stripComments` 때문에 그 파일의 시험도 함께 도는 것은 dayStaticGuard 와 같은 선례).

## 검증 결과

- `npx vitest run test/unit/keywordStaticGuard.test.ts test/unit/keywordGuard.test.ts` → 2 files, 45 tests passed.
- `npm run typecheck` → 종료 코드 0 (GREEN 커밋 두 개 시점 모두).
- 수용 기준: `export function violatesKeyword` 1건, `normalize("NFKC")` 1건, keywordGuard.ts 의 `^import` 0건, `ANSWER_MAX_GRAPHEMES … 20`·`ANSWER_MIN_GAP_MS … 400` 각 1건, `git grep -qE "shared/game/(keywords|keywordGuard|keywordAnswer)" -- src` 종료 코드 1(일치 없음).
- 사설 레포 위생 grep(변경 파일 대상) 결과 없음.

## Deviations from Plan

None - 계획대로 실행했다. 다음 두 가지는 판단 사항으로 적어 둔다.

- 시험 이름의 "알려진 한계, 0091 에 기록"은 계획대로 시험 이름에 남겼다. 0091 결정 기록 파일 자체는 이 계획의 범위가 아니라 만들지 않았다(이월).
- RED 시험 커밋(`b20c471d`, `3365c0de`)은 모듈이 없어 그 시점에는 `npm run typecheck` 가 실패한다(TDD RED 의 본질). 각 GREEN 커밋 이후에는 초록이다.

## Carry-overs

- 0091 결정 기록의 "알려진 한계"에 한 줄 필요: 3글자 키워드의 초성열이 흔한 단어와 우연히 겹쳐 시민이 이유 없이 거절될 수 있다(예: 고양이 ㄱㅇㅇ ↔ 가을이). D-08 문언대로 막는다.
- 23-06 이 `violatesKeyword` 를 서버 답 제출에 붙이고, 23-04 가 목록 자기 검사에 쓴다. 이 계획은 판정 함수까지만 만들었다.
- `ANSWER_MIN_GAP_MS` 의 간격 측정(초안·확정 각각)은 방 DO(23-06) 몫이다. 이 파일은 상수만 있다.

## Known Stubs

없음.

## Threat Flags

없음. T-23-09(우회)·T-23-10(정규식 선형)·T-23-11(src import)은 계획대로 시험·구현으로 완화했다. 패키지 설치는 없다.

## Self-Check: PASSED

- 파일 존재: `shared/game/keywordGuard.ts`, `shared/game/answerRules.ts`, `test/unit/keywordGuard.test.ts`, `test/unit/keywordStaticGuard.test.ts`.
- 커밋: `b20c471d`(RED), `9b953722`(GREEN), `3365c0de`(RED), `da346676`(GREEN) 모두 HEAD 의 조상.
