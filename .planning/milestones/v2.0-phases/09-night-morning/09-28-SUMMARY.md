---
phase: 09-night-morning
plan: "28"
subsystem: client-timer
tags: [gap-closure, timer, tone, feedback-4]
status: complete

requires:
  - phase: 09-night-morning
    provides: 역할 확인 막대 타이머(Timer.tsx), 게임 화면 머리 시간 링(PhaseHeader.tsx)
provides:
  - src/net/countdown.ts — WARN_MS(10초)·TimerTone·timerTone(remainingMs, durationMs)
  - 시간 링 is-warn·is-urgent, 막대 타이머 mf-timer--warn
affects: [09-30]

key-files:
  modified:
    - src/net/countdown.ts
    - src/components/Timer.tsx
    - src/components/v2/PhaseHeader.tsx
    - src/styles/v2.css
    - src/styles/phase.css
    - test/unit/countdown.test.ts
    - test/client/timer.test.tsx
    - test/client/v2parts.test.tsx

decisions:
  - "모든 단계 타이머 색 규칙은 timerTone 하나: 남은 10초 이하 놋쇠(brass-400 막대·brass-200 숫자), 5초 이하 진홍(crimson-500 막대·crimson-400 숫자). 사용자 확정값(노랑 10초·빨강 5초, 단계가 문턱보다 짧으면 그 색 건너뜀)을 따름"
  - "노랑은 v2.0 이 앰버를 쓰지 않으므로 놋쇠 토큰"

metrics:
  tasks: 2
  commits: 4
  completed: 2026-11-04

actuals:
  tokens: 14000
  tasks: 2
  commits: 4
plan_head_before: fec7d45ef6ce4035b942f86145b13920b7987f44
plan_head_after: 12055c8fcf91f4ce9f7ad4b0e93a82c4ba394371
---

# Phase 9 Plan 28: 단계 타이머 색 규칙 하나(timerTone) Summary

시간 링(게임 화면 머리)과 막대 타이머(역할 확인)가 `countdown.ts` 의 `timerTone` 하나로 색을 정한다: 마지막 10초 놋쇠, 마지막 5초 진홍, 단계 전체가 문턱 이하로 짧으면 그 색은 건너뛴다.

## TDD

- **RED 1** `08f597a`: `timerTone`/`WARN_MS` 가 없어 `timerTone is not a function` 으로 12건 실패(대상 시험이 의도한 이유로 실패, 이미 있던 19건은 통과).
- **GREEN 1** `e2d87be`: `WARN_MS`·`TimerTone`·`timerTone` 추가, 31건 통과. `countdown().urgent` 는 그대로.
- **RED 2** `8f0bc2c`: Timer 경고/임박, PhaseHeader 링 클래스, CSS 규칙 5건 단언 실패.
- **GREEN 2** `12055c8`: PhaseHeader 의 따로 둔 5초 상수 제거 후 timerTone 사용, Timer 클래스 `mf-timer--warn`, v2.css·phase.css 규칙 추가. client 48파일 1544건 통과, typecheck 오류 없음.

## Deviations from Plan

**1. [Rule 1 - 계획 시험 데이터 오류] time 12 는 경고가 아님**
- 계획의 behavior "time 12·total 60 → is-warn" 은 10초 문턱 밖이라 모순. 시험을 time 9(경고)·10(경계 포함 경고)·11(색 없음)으로 바로잡음.

**2. [Rule 3 - 기존 계약 시험] 이름표 색 계약**
- `v2parts.test.tsx` 의 "놋쇠 토큰 없음·진홍은 crimson-300 하나" 검사에서 `.mv-ring.is-warn/.is-urgent` 규칙을 8페이즈 부품 규칙처럼 제외(주석으로 근거). 나머지 검사는 그대로.

## Known Stubs

없음.

## Threat Flags

없음. 색은 공개 값(단계 마감·길이)으로만 정해져 역할마다 다르지 않다(T-09-58).

## 이월 메모

- 육안 확인 필요: 놋쇠 링(10초)·진홍 링(5초)과 막대 색은 로컬 E2E·실기기(09-30)에서.
- `Timer` 의 `calm` 속성은 이제 강제 끄기용으로만 남음(짧은 단계의 생략은 timerTone 이 처리).
- 모든 요구사항 `requirements: []` 라 완료 표시 없음.

## Self-Check: PASSED

- 커밋 08f597a, e2d87be, 8f0bc2c, 12055c8 존재 확인.
