---
phase: 09-night-morning
plan: "21"
subsystem: e2e-helpers
tags: [e2e, lib, panel-height, markers, contract-test, tdd, night-morning]
status: complete

requires:
  - phase: 09-night-morning
    provides: 9페이즈 화면 표식(09-10~09-20)과 UI-SPEC 패널 표
provides:
  - faceListPanelH({w, n, wrappedRows}) — 밤 얼굴 목록 패널 높이 식 (UI-SPEC 160행)
  - GAME_PANEL_EXTRA.nightMafia(154), NIGHT_CITIZEN_PANEL_H(88), gamePanelHeight 의 nightCitizen·faceList kind
  - NIGHT_MARKERS(11개), tagInStage, faceNameFits
  - test/unit/e2eContract.test.ts "9페이즈 E2E 표식·패널(09-21)" 동기화 시험
affects: [09-22, 09-23]

actuals:
  tokens: 2787
  tasks: 2
  commits: 4
plan_head_before: 8f2d2c3d3cf6595e2ff7c5c96733f0b9f45a61a7
plan_head_after: aaae70ccbc919dc3cd35bf494c652fb3889f2ac1

tech-stack:
  added: []
  patterns:
    - "측정값이 없거나 숫자가 아니면 통과가 아니라 false (tagInStage·faceNameFits)"
    - "표식 목록은 git ls-files src 의 추적 파일 내용으로 앱과 동기화 — 이름 오타를 단위 시험이 막는다"

key-files:
  created: []
  modified:
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - test/unit/e2eContract.test.ts
    - .planning/phases/09-night-morning/09-UI-SPEC.md

key-decisions:
  - "gamePanelHeight(roomH, kind, opts) 에 세 번째 인자를 더한다. faceList 는 opts.w·n 이 없으면 던진다(조용히 틀린 값을 내지 않는다)"
  - "faceNameFits 의 rect 는 DOMRect 모양 {left,top,right,bottom}, tagInStage 의 tag 는 계획대로 {x,y,w,h}"

requirements-completed: []

coverage:
  - id: D1
    description: "얼굴 목록 패널 높이 식: 폭 360·390·402·430 에서 2행 310·325·331·345, 1행 200·208·211·218, 줄바꿈 행마다 +18; nightMafia = LOG_H+154, nightCitizen = 88"
    requirement: "NIGHT-09"
    verification:
      - kind: unit
        ref: "scripts/e2e/lib.test.mjs faceListPanelH·gamePanelHeight (node --test)"
        status: pass
  - id: D2
    description: "NIGHT_MARKERS 11개가 src/ 추적 파일에 실제로 있고 nightMafia 덧셈이 앱 LOBBY_PANEL_EXTRA 와 같다; tagInStage·faceNameFits 경계(1px)"
    requirement: "NIGHT-10"
    verification:
      - kind: unit
        ref: "test/unit/e2eContract.test.ts 9페이즈 E2E 표식·패널(09-21), scripts/e2e/lib.test.mjs tagInStage·faceNameFits"
        status: pass
---

# Phase 9 Plan 21: E2E 도우미를 9페이즈 화면 계약에 맞춤 Summary

**scripts/e2e/lib.mjs 가 밤 패널 세 종류의 기대 높이(얼굴 목록 식 포함)와 9페이즈 표식 11개·이름표/얼굴 이름 판정 함수를 갖고, 앱 소스와 어긋나면 단위 시험이 막는다.**

## 수행 내용

- **Task 1 (트레이서)**: `faceListPanelH` = `14 + 행들 + 행 사이 8 + 10 + 52 + 22 + 줄바꿈 행 × 18`(행 = `fw + 26.2`, `fw = (W−56)/4`). `GAME_PANEL_EXTRA.nightMafia = 154`, `gamePanelHeight` 가 `nightCitizen`(88 고정)·`faceList`(opts)를 처리하고 알 수 없는 kind 는 여전히 던진다.
- **Task 2**: `NIGHT_MARKERS`(11개, 얼림), `tagInStage`(1px 라도 밖이면 false), `faceNameFits`. `e2eContract.test` 가 `git ls-files src` 의 `.ts/.tsx/.css` 내용에서 각 표식을 찾고 `nightMafia === LOBBY_PANEL_EXTRA` 를 확인한다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] UI-SPEC 표의 폭 402 한 행 값 215 가 식과 어긋남**
- **Found during:** Task 1 GREEN
- **Issue:** 식(UI-SPEC 160행)으로 402 폭 1행은 14 + (86.5+26.2) + 10 + 52 + 22 = 210.7. 표는 215 로 적혀 있었다(2행 331 과 다른 세 폭의 1행 값은 식과 맞음). 계획의 "식 그대로" 와 "215" 가 충돌.
- **Fix:** 식을 따랐다(표는 식의 반올림이라고 UI-SPEC 이 밝힘). 시험은 211, UI-SPEC 표의 215 를 211 로 바로잡음.
- **Files modified:** scripts/e2e/lib.test.mjs, .planning/phases/09-night-morning/09-UI-SPEC.md
- **Commit:** 708d4a4

**Total:** 1건. 그 밖에는 계획대로.

## Known Stubs

없음.

## Threat Flags

없음.

## 이월

- 09-22: `gamePanelHeight(roomH, "faceList", { w, n, wrappedRows })` 는 안전 영역 제외 기대값이다. 가정 A1 대로 DOM 에서 잰 패널 높이와 ±2px 로 비교하고 스테이지는 DOM 값으로 정한다.
- `tagInStage` 의 tag 는 `{x,y,w,h}`, `faceNameFits` 의 cell·name 은 DOMRect 모양. 둘 다 측정값이 비면 false 를 돌려주니 호출 쪽에서 "측정값 없음" 줄로 바꿔 쓸 것.
- NIGHT-07·09·10·WILL-01 은 이 계획이 검사 도우미만 만들어 완료 처리하지 않음(구현 계획이 이미 처리했거나 공유 ID 게이트).

## Self-Check: PASSED

- node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs: 200 통과, 0 실패
- npx vitest run test/unit/e2eContract.test.ts: 19 통과
- 커밋 49e1269, 708d4a4, abf4683, aaae70c 존재
