---
phase: 09-night-morning
plan: "23"
subsystem: docs-deploy-handoff
tags: [docs, architecture, device-checks, backlog, handoff, deploy-check, night-morning]
status: complete

requires:
  - phase: 09-night-morning
    provides: 밤·아침 서버 규칙과 화면(09-01~09-21), E2E night·nightload(09-22)
provides:
  - docs/architecture.md "밤과 아침 (9페이즈, 결정 0061)" 구역
  - .planning/phases/09-night-morning/09-DEVICE-CHECKS.md (표 A 배포본 자동 확인, 표 B 실기기 12항목, 표 C 다른 기기, 표 D 팀 한 판 관찰)
  - ROADMAP 백로그 Phase 999.6 (9페이즈 실기기·팀 테스트 이월)
  - HANDOFF.md 9페이즈 구현 완료 인계
affects: [verify-work-9, 10-character-motion-outfit, 12-polish]

requirements-completed: []

actuals:
  tokens: 14000
  tasks: 3
  commits: 3
plan_head_before: dce2f1d167eade1068d0261e0c190800a17e6715
plan_head_after: 477a5373f571cc194cbd5f9e0b1f83c196980ab1

key-files:
  created:
    - .planning/phases/09-night-morning/09-DEVICE-CHECKS.md
  modified:
    - docs/architecture.md
    - .planning/ROADMAP.md
    - HANDOFF.md

key-decisions:
  - "배포는 이 계획에서 하지 않는다(오케스트레이터 지시 — 사용자가 04e716b 를 이미 배포). 04e716b..HEAD 는 src·worker·shared·public 변경 0줄이라 배포본 앱 코드는 현재와 같다."
  - "배포본 smoke 와 E2E 간헐 실패는 문턱을 낮추거나 스크립트를 고치지 않고 표 A 에 사실대로 적는다(가정 A2 는 재배포가 필요한 수정에만 해당)."

metrics:
  duration: "약 1시간 30분(대부분 배포본 smoke·E2E 대기)"
  completed: 2026-11-03
---

# Phase 9 Plan 23: 문서·이월 목록·배포본 확인·인계 Summary

architecture 에 9페이즈 밤·아침 구조를 적고, 실기기·팀 테스트를 백로그 999.6 과 `09-DEVICE-CHECKS.md` 로 넘기고, 배포본(`04e716b`)을 읽기 전용으로 확인한 결과를 있는 그대로 기록했다. 배포본 smoke full 은 통과하지 못했다.

## 한 일

1. **문서**: `docs/architecture.md` 에 "밤과 아침" 구역(받는 사람·`worldVisibleTo`, `afterTransition` 순서, home 기억, 전원 일치 확정, 유언·쪽지 범위와 500ms, 카드·분필, 아침 길이 공식, 긴장 연출은 클라이언트 로컬 + 정적 가드, 누설 시험 위치).
2. **이월**: `09-DEVICE-CHECKS.md` 에 실기기 12항목(B1~B12, nightload 숫자를 기준과 나란히), 다른 기기·브라우저 표, 팀 한 판 관찰 ①~⑥ + 확정 실패 원인 칸, 절차, 체크리스트 14개. ROADMAP 에 Phase 999.6 블록. 이 페이즈를 막지 않는다.
3. **인계**: `HANDOFF.md` 를 9페이즈 구현 완료 상태로 고침(5.7KB, `handoff.test.ts` 통과). 해결된 9페이즈 항목은 지움.
4. **배포본 확인(읽기 전용)**: 아래 결과.

## 검증 결과

| 확인 | 결과 |
|------|------|
| 로컬 `npx vitest run` | 145 파일 4092 통과(건너뜀 1) |
| 로컬 `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs` | 200/200 |
| `npm run typecheck` | 통과 |
| health | `…+04e716b` (HEAD `dce2f1d` 와 다르지만 이후 커밋에 앱 코드 변경 없음) |
| 배포본 smoke full | **5회 모두 실패** (아래 이슈) |
| 배포본 E2E day·ghost·noexec·night·result·chat-game | 1회차 2건 실패(night-sizes 360x640 PK3, ghost 390x664 G2), 2회차 `--only night-sizes,ghost` `E2E OK` |
| 위생 `git grep` (이 계획이 쓴 문서) | 0건 |
| `handoff.test.ts` | 통과 |

## Deviations from Plan

### 계획대로 하지 못한 것

**1. [지시에 따른 생략] `npm run deploy` 미실행** — 오케스트레이터가 재배포를 금지했다. 영향: Task 1 의 "health 에 이 커밋 해시" 조건은 충족되지 않았다(`04e716b` 만 있음). `04e716b..dce2f1d` 의 `src`·`worker`·`shared`·`public` 차이는 0줄이라 기능상 같다.
**2. [지시에 따른 생략] `git push` 안 함** — 순차 실행 지시("Do NOT push"). Task 3 의 `origin/v2 = HEAD` 검증은 하지 못했다. 오케스트레이터가 push 해야 한다.
**3. 배포본 smoke full 미통과** — 5회 실행 실패 위치: ① `dayAnnounce 도착 편차 736ms ≥ 500ms`, ② 아침 뒤 `dayAnnounce(day.n 2)` 25초 초과(세 번), ③ 1일차 찬반 값 변경 방송 검사. 같은 시각 `/api/health` 가 0.8~6.7초로 느렸다. 디버그 사본(삭제함, 미커밋)으로 ② 를 확인하니 서버는 2일차 지목·변론까지 정상 진행했다. 원인은 확정하지 못했고(추정: 재접속한 클라이언트가 끊긴 사이 프레임을 못 받는 구조 + 느린 망), 문턱·스크립트는 건드리지 않았다.
**4. E2E 간헐 실패 2건** — 위 표. 재실행 통과. 원인 미확정.

### Auto-fixed Issues

None.

## Deferred Issues

- 빠른 망에서 배포본 smoke full 재확인 필요(위 3). 실패가 계속되면 smoke 의 재접속·프레임 대기 구조를 고친다.
- E2E 간헐 실패 2건(PK3 지목 버튼 겹침 360x640 마피아 밤, 지목 토스트 G2 폭 밖) 원인 조사 — 12페이즈 정리 후보.
- 실기기·팀 테스트 전부(999.6).

## Known Stubs

없음.

## Threat Flags

없음.

## 요구사항 공유 ID 게이트

이 계획은 `requirements-completed` 를 비웠다(지시). 보고 의견: WILL-01·NIGHT-12 를 선언한 마지막 계획(09-23)이 끝났고 구현 계획(09-12 서버, 09-17 화면, 09-19 smoke, 09-21·22 E2E)은 모두 완료됐으므로 공유 ID 게이트 기준으로는 `requirements.mark-complete WILL-01 NIGHT-12` 를 허용할 수 있다. 단 배포본 smoke full 이 미통과이므로 오케스트레이터가 판단한다.

## Self-Check: PASSED

- 파일: `09-DEVICE-CHECKS.md`, `docs/architecture.md`, `HANDOFF.md`, `.planning/ROADMAP.md` 확인
- 커밋: `84c6900`, `78eaaa4`, `477a537` 확인
