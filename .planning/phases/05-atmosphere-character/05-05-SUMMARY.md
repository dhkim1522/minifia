---
phase: 05-atmosphere-character
plan: 05
subsystem: e2e-pure-checks
tags: [e2e, pure-checks, tdd, UX-01, UX-02, LOOK-01, CONN-03]
status: complete

requires:
  - phase: 05-atmosphere-character
    provides: "05-01 의 src/game/scenes.ts TIMELESS_PHASES 와 [data-guide] DOM 계약, 05-03 의 .mf-backdrop__vignette·.mf-morningglow, 05-UI-SPEC §8.4·§11.3c·§15 검사 항목"
provides:
  - "scripts/e2e/lib.mjs: 5페이즈 계약 주석(여덟 검사 입력 모양), TIMELESS_PHASES, JOIN_FIT_MIN_H(640), DEFAULT_SIZES 끝의 360x560 probe"
  - "순수 검사 일곱: guideChecks(UX1)·docHeightChecks(UX2)·joinFitChecks(UX2-J)·pcCenterChecks(UX2-PC)·vignetteChecks(AT1)·glowChecks(AT2)·wakeLockChecks(WL1·WL2)"
  - "test/unit/e2eContract.test.ts: E2E 와 앱의 TIMELESS_PHASES 동일성"
affects: [05-06, 05-07, 05-09]

actuals:
  tokens: 7150
  tasks: 2
  commits: 4
plan_head_before: 9951639d21088cb742eb02df883f4582f02bf683
plan_head_after: b526b82385b4cb96cd5e5c9d17443fa77d109aae

tech-stack:
  added: []
  patterns:
    - "순수 검사는 기존 result 도우미·isNum·isOneLine 을 쓰고, 측정값이 없거나 숫자가 아니면 측정값 없음(…) 으로 실패한다(headerContrastChecks 선례)"
    - "앱 상수와 E2E 상수의 동일성은 단위 시험이 같은 import 방식으로 지킨다(EXPECTED_SCENE 선례)"

key-files:
  created:
    - test/unit/e2eContract.test.ts
  modified:
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs

key-decisions:
  - "joinFitChecks 는 화면 높이 640 미만 거부 규칙을 함수 안에 넣지 않았다. 계획대로 상수 JOIN_FIT_MIN_H 를 두고 부르는 흐름(05-06·05-07)이 지킨다."
  - "pcCenterChecks 의 최대 폭 430·가운데 오차 ±1 은 내보내지 않는 모듈 안 상수(PC_ROOT_MAX_W·PC_CENTER_EPS)로 뒀다. 기존 기준 수치 상수는 건드리지 않았다."
  - "vignetteChecks·glowChecks 의 expect 0 은 층 개수만 본다(탭·좌표 값 무시). expect 1 에서는 탭 판정(tapHitsTable·tagHit)이 boolean 이 아니면 측정값 없음으로 실패한다."

requirements-completed: []

duration: about 12min
completed: 2026-10-29
---

# Phase 5 Plan 05: 5페이즈 E2E 순수 검사 Summary

**UX1(안내 문장 하나·한 줄·타이머)·UX2(문서 높이)·UX2-J(링크 참가 한 화면)·UX2-PC(PC 가운데 열)·AT1(밤 비네팅)·AT2(아침 밝아짐)·WL1·WL2(화면 켜짐 유지) 여덟 검사의 판정을 `lib.mjs` 순수 함수로 만들어 `node --test` 로 경계까지 고정했고, 단 높이 probe `360x560` 을 기본 크기에 넣고 `TIMELESS_PHASES` 를 앱 상수와 단위 시험으로 묶었다.**

## 수행한 일

서버·와이어·새 의존성·에셋 변경 없음. 브라우저 코드(`browser.mjs`·`run.mjs`)는 이 계획 몫이 아니라 건드리지 않았다. 배포하지 않았다.

### Task 1 — 트레이서: TIMELESS_PHASES·UX1·UX2·360x560 (RED `014f0af` → GREEN `eb18f1a`)

- RED: 기본 sizes 를 네 개(`360x640`, `390x664`, `430x932`, `360x560`)로 바꿔 단언하고(`--sizes` 를 주면 그 값만), `guideChecks` 경계(0개·2개·공백·헤더 두 줄/1.6배 경계·타이머 없음/`TIMELESS_PHASES` 예외·측정값 없음 갈래)와 `docHeightChecks` 경계, 기준 수치 불변 단언, `test/unit/e2eContract.test.ts` 동일성 시험.
- GREEN: `DEFAULT_SIZES` 끝에 probe(주석: 05-UI-SPEC 11.3c, P5-3)와 `USAGE` 예시, `TIMELESS_PHASES = ["lobby","assigning","ended"]`, "5페이즈 계약" 주석 절(여덟 검사 입력 필드·단위, 처형 구간 계약 주석 바로 뒤), `guideChecks`·`docHeightChecks`.
- 트레이서 게이트: `<verify>` 가 모두 자동 명령이라 전부 재실행해 통과를 확인하고 Task 2 로 넘어갔다.

### Task 2 — UX2-J·UX2-PC·AT1·AT2·WL1·WL2 (RED `7136be5` → GREEN `b526b82`)

- RED: 다섯 함수와 `JOIN_FIT_MIN_H === 640` 의 경계 시험(링크 참가 docH 640/733·버튼 620/685·앉은 수 6, PC left 425/0/폭 1280, 비네팅 0·1·2개/auto/none 배경/탭 막힘/expect 0, 밝아짐 경계 ±0.5/헤더로 올라감/탭 막힘/expect 0, WL1 hasApi·콘솔 오류, WL2 요청 0/증가 0/증가 2, 갈래마다 측정값 없음).
- GREEN: `joinFitChecks`·`pcCenterChecks`·`vignetteChecks`·`glowChecks`·`wakeLockChecks`(mode `unsupported`→WL1, `spy`→WL2, 그 밖은 실패)와 `JOIN_FIT_MIN_H`. 실패 내용에 측정값 숫자와 재는 자리(`where`)가 들어간다. 기존 함수·기준 수치는 불변.

## 시험·검증 결과

| 검사 | 결과 |
|------|------|
| `node --test scripts/e2e/lib.test.mjs` | 168건 통과, 실패 0 (이 계획 전 142건 → 26건 추가) |
| `node --check scripts/e2e/lib.mjs` | 성공 |
| `npx vitest run --project unit test/unit/e2eContract.test.ts test/unit/scenes.test.ts` | 2 파일, 29건 통과 |
| `npm test` | 108 파일, 2944건 통과 |
| `npm run typecheck` | 종료 코드 0 |

인수 기준: `"360x560"` 1, `export const TIMELESS_PHASES` 1, `guideChecks|docHeightChecks` export 2, `joinFitChecks|pcCenterChecks|vignetteChecks|glowChecks|wakeLockChecks` export 5, `JOIN_FIT_MIN_H` export 1, 검사 ID 문자열(`UX2-J|UX2-PC|AT1|AT2|WL1|WL2`) 19건(6 이상). 기준 수치 불변 확인 명령(`OVERLAP_EPS 0.5`·`TAP_MIN 44`·`ONE_LINE_FACTOR 1.6`·`FACE_RATIO 0.45`·`PANEL_H 157`·`HEADER_CONTRAST_MIN 4.5`) 종료 코드 0. `APPROVED_RELAXATIONS`·E2E 한도 불변. 실행 전 기존 검사 ID(`"UX`·`"AT`·`"WL`)는 HEAD 에서 0건이었다.

## 계획과 달라진 점

### 자동 수정한 것

없음 - 계획대로 실행했다. (구현 중 `isNum` 도우미가 `lib.mjs` 에 이미 있어 새로 선언했던 것을 지우고 기존 것을 썼다. 동작 변화 없음.)

### 계획 문구와 다르게 한 것

1. **`lib.test.mjs` 변경:** 계획이 가리킨 85-92행 단언뿐 아니라 시험 제목도 "세 크기" → "세 폭 기준 + 단 높이 probe" 로 고쳤다.

## 남은 알림

- `npm run e2e` 가 인자 없이 `360x560` 까지 돌게 되었다(실행 시간 약 1/3 증가). 아직 `browser.mjs`·흐름은 이 값을 읽는 코드를 갖지 않는다 — 05-06·05-07 이 `stageChecks` 에 UX1·UX2, 링크 참가·PC 흐름에 UX2-J·UX2-PC, 밤·아침에 AT1·AT2, WL 흐름을 연결한다. 그 전까지 `360x560` 에서 기존 검사(D5 등)가 어떻게 판정되는지는 배포본 실측 전이라 알 수 없다.
- 요구사항 UX-01·UX-02·LOOK-01·CONN-03 은 이 계획에서 완료 표시하지 않는다(브라우저 판정은 05-06 이후).

## 인증 게이트

없음.

## 알려진 스텁

없음.

## 위협 표면 점검

새 엔드포인트·인증 경로·파일 접근·스키마 변경 없음(순수 함수와 시험만). T-05-11(측정값 없음 은닉)은 새 검사 전부가 필드 누락·숫자 아님을 `측정값 없음(…)` 실패로 돌려주고 시험이 갈래마다 단언해 닫았다. T-05-12(단계 목록 어긋남)는 `e2eContract.test.ts` 동일성 시험으로 닫았다. T-05-SC 는 새 패키지 없음.

## 사람이 할 일 · 이어지는 계획

- 05-06·05-07: 위 검사에 넣을 값을 브라우저에서 계약 모양 그대로 읽어 연결.

## Self-Check: PASSED

- 만든 파일 `test/unit/e2eContract.test.ts`, 수정한 `scripts/e2e/lib.mjs`·`scripts/e2e/lib.test.mjs`, 이 SUMMARY 존재 확인.
- 커밋 `014f0af`·`eb18f1a`·`7136be5`·`b526b82` 가 HEAD 의 조상임을 확인.
- `commits: 4` 는 `git rev-list --count 9951639..HEAD` 로 쟀다(이 SUMMARY 의 docs 커밋 전). `actuals.tokens` 는 변경 diff 추가 줄 28.6k 자 / 4.
