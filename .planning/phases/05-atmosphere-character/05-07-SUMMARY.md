---
phase: 05-atmosphere-character
plan: 07
subsystem: e2e-fixed-size-flows
tags: [e2e, pc-layout, wake-lock, UX-02, CONN-03]
status: complete

requires:
  - phase: 05-atmosphere-character
    provides: "05-05 의 pcCenterChecks(UX2-PC)·wakeLockChecks(WL1·WL2) 순수 검사, 05-02 의 useWakeLock, 05-06 의 E2E 배선과 ctx.roomCode"
provides:
  - "scripts/e2e/run.mjs: flow.size 가 있는 흐름은 크기 목록과 곱하지 않고 자기 크기로 작업 하나"
  - "scripts/e2e/browser.mjs: openHostPage({ mobile, initScripts })"
  - "scripts/e2e/flows.mjs: pcFlow(UX2-PC), wakeLockFlow(WL1·WL2), FLOWS 의 pc@1280x800·wakelock@360x640"
affects: [05-08, 05-09]

actuals:
  tokens: 3100
  tasks: 2
  commits: 2
plan_head_before: 7b945b8e6ce447212005ee335f3e4d68a6c51cec
plan_head_after: 3b2196de13b72f32d6ae892b936162323dce1dd7

tech-stack:
  added: []
  patterns:
    - "크기 고정 흐름: FLOWS 항목의 선택 속성 size 로 선언하면 실행기가 작업 하나만 만든다"
    - "브라우저 API 모의는 openHostPage 의 initScripts(함수 목록)로 시험 컨텍스트에만 넣는다 — src/ 는 건드리지 않는다"

key-files:
  created: []
  modified:
    - scripts/e2e/run.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/flows.mjs

key-decisions:
  - "startHost 도 ctx.size.mobile 이 false 이면 openHostPage 에 mobile: false 를 넘긴다. 계획은 pcFlow 에서 openHostPage 를 직접 부르라고 했지만, startHost 를 거치면 S1·S2 와 ctx.secrets 처리가 그대로 따라온다."

requirements-completed: []

completed: 2026-10-29
---

# Phase 5 Plan 07: 크기 고정 E2E 흐름(PC·Wake Lock) Summary

**화면 E2E 에 크기 고정 흐름 두 개를 더했다: `pc`(1280x800 데스크톱 창에서 홈·대기실·낮의 `#root` 가 430 이하이고 가운데 — UX2-PC)와 `wakelock`(Wake Lock 이 없는 브라우저에서 낮 토론까지 콘솔 오류 없이 진행 — WL1, 세는 가짜 Wake Lock 에서 대기실 요청과 가림 → 보임 복귀 재요청 정확히 1회 — WL2). 두 흐름은 폰 크기 목록과 곱하지 않고 한 번만 돈다. 로컬 dev 서버에서 `pc`·`wakelock`·`lobby` 모두 `E2E OK`.**

## 수행한 일

배포하지 않았다. 로컬 `npm run dev` 만 썼고 끝낸 뒤 껐다. `src/`·서버·와이어·의존성은 바꾸지 않았다.

### Task 1 — 크기 고정 규칙 + PC 흐름 (`81e7b33`)

- `run.mjs`: `flow.size` 가 있는 흐름은 자기 크기로 작업 하나만 만들고, 없는 흐름은 지금처럼 크기 목록과 곱한다. 시작 줄에 `크기 고정 pc@1280x800` 처럼 함께 찍는다. `--only` 는 그대로 동작한다.
- `browser.mjs`: `openHostPage` 에 `mobile = true`(거짓이면 `isMobile`·`hasTouch` 끔)와 `initScripts = []`(세션 init 스크립트 다음에 순서대로 `addInitScript`)를 더했다. 기존 호출은 그대로.
- `flows.mjs` `pcFlow`: 방 없이 데스크톱 컨텍스트로 홈 `/` 을 열어 `#root` 사각형을 재고(`finally` 에서 닫음), 방장으로 대기실 → 봇 3명 → 시작 → `skipTo claim` 의 낮까지 각각 `pc/home`·`pc/lobby`·`pc/day` 로 UX2-PC 를 기록한다. 대기실·낮은 `checkState` 로 G 공통 검사도 남기고 끝에 `resetAndLeave`.

### Task 2 — Wake Lock 흐름 + 로컬 실행 (`3b2196d`)

- `wakeLockFlow` WL1: init 스크립트로 `Navigator.prototype.wakeLock` 을 지운 방 → `"wakeLock" in navigator`(`hasApi`) → 봇 3명 → 시작 → `skipTo discussion` → 추적 단계가 `discussion` 인지(`reachedPhase`)와 `takeIssues().console`(`consoleErrors`)로 `wakeLockChecks(unsupported)`.
- WL2: `request` 호출 수를 `window.__mfWakeLock.requests` 에 세고 EventTarget 기반 가짜 sentinel(`released`, `release()`)을 돌려주는 가짜로 바꾼 방 → 대기실에서 요청 ≥ 1 이 잡힐 때까지 최대 3초 기다리고 300ms 쉰 뒤 `requestsAtLobby` 를 읽는다 → 페이지 안에서 가짜 잠금을 풀린 상태로 만들고 `release` 이벤트를 보낸 뒤 `visibilityState` 를 hidden → visible 로 바꿔 `visibilitychange` 를 보내고 200ms 뒤 `requestsAfterVisible` → `wakeLockChecks(spy)`.
- 두 방 토큰 모두 `ctx.secrets` 에 넣었다(T-05-16). 첫 방의 컨텍스트는 WL2 방을 열기 전에 `finally` 에서 닫는다.

## 로컬 E2E 결과 (`--url http://localhost:5173`)

| 실행 | 작업 수 | 항목 | 마지막 줄 | 걸린 시간 |
|------|---------|------|-----------|-----------|
| `--only pc` | 1 (`pc 1280x800`) | 7/7 (UX2-PC 홈·대기실·낮 통과, S1·S2, G 두 건) | `E2E OK` | 11초 |
| `--only wakelock` | 1 (`wakelock 360x640`) | 2/2 (WL1, WL2 통과) | `E2E OK` | 15초 |
| `--only lobby` | 4 (기본 네 크기) | 360x640 26/26, 390x664 26/26, 430x932 26/26, 360x560 25/25 | `E2E OK` | 17초 |

`lobby` 실행에 `pc`·`wakelock` 작업이 섞이지 않았고(요약 표에 lobby 네 줄만), 기존 열 흐름 × 네 크기 구성은 바뀌지 않았다. 앱 결함은 나오지 않았다 — 미지원 환경에서 콘솔 오류 0, `useWakeLock` 은 05-02 계약대로 동작해 `src/net/useWakeLock.ts` 를 건드릴 일이 없었다. 로컬 dev 는 CSS 를 압축하지 않으므로 CSS 에 기대는 검사의 최종 판정은 05-09 배포본 실행이 한다.

## 시험 결과

| 검사 | 결과 |
|------|------|
| `node --check` run·browser·flows | 모두 통과 |
| `node --test scripts/e2e/lib.test.mjs` | 168건 통과 |
| `npm test` | 109 파일, 2957건 통과 (HANDOFF 6KB 시험 포함) |

인수 기준 grep: `flow.size` run.mjs 에 있음, `pcCenterChecks` flows.mjs 에 있음(import + 호출), `id: "pc"` 1, `initScripts` browser.mjs 3, `wakeLockChecks` flows.mjs 에 import + 호출 2회 이상, `id: "wakelock"` 1.

## 계획과 다르게 한 것

1. **startHost 가 mobile 을 전달**: 계획은 `createTestRoom` + `openHostPage(…, { mobile: false })` 를 pcFlow 안에서 직접 부르라고 했다. 대신 `startHost` 가 `ctx.size.mobile !== false` 를 `openHostPage` 에 넘기게 해서 S1·S2·토큰 가림 처리를 그대로 재사용했다. 결과는 같다(`mobile` 이 없는 크기는 지금처럼 모바일).
2. 커밋 분리를 위해 Task 1 커밋에는 wakeLockFlow 를 빼고 올렸다가 Task 2 에서 더했다. 최종 파일은 같다.

## 남은 일 / 알림

- 실제 기기의 화면 꺼짐 방지 동작은 E2E 로 증명하지 않는다 — 05-09 HANDOFF 의 실기기 확인 목록으로 남는다(CONTEXT Deferred).
- 새 흐름 두 개는 기본 실행(`npm run e2e`, `--only` 없음)에도 들어간다. 전체 실행 시간은 약 26초(pc 11초 + wakelock 15초) 늘고 병렬이면 더 적다.
- 요구사항 UX-02·CONN-03 은 이 계획에서 완료 표시하지 않는다(전체 로컬 판정은 05-08, 배포본 판정은 05-09).

## 인증 게이트

없음.

## 알려진 스텁

없음.

## 위협 표면 점검

시험용 init 스크립트는 `scripts/e2e/` 의 함수이고 `addInitScript` 로 시험 컨텍스트에만 들어간다(T-05-15). `src/` 변경 없음, 새 엔드포인트·인증 경로 없음. 두 방 토큰은 `ctx.secrets` 로 출력에서 가려진다(T-05-16). 새 패키지 설치 없음(T-05-SC).

## Self-Check: PASSED

- `scripts/e2e/run.mjs`, `browser.mjs`, `flows.mjs` 수정 확인, 커밋 `81e7b33`·`3b2196d` 가 HEAD 의 조상임.
