---
phase: 09-night-morning
plan: "06"
subsystem: night-tension
tags: [tension, scheduler, tdd, static-guard, night-10]
status: complete

requires:
  - phase: 09-night-morning
    provides: UI-SPEC 밤 · 시민 편 긴장 비네트 규칙 (A3 ①, L3)
provides:
  - planTensionCues(rng) — 난수만으로 큐 시각(ms) 2~4개
  - startTension(opts) — 큐마다 타이머 예약·stop() 정리, 모션 줄이기면 예약 없음
  - TENSION_* 상수 9개 (박자 1300, 큐 최대 불투명도 0.95, 모션 줄이기 0.4 등)
  - tensionStaticGuard 시험 (GUARDED 목록 — 09-15 가 TensionVignette.tsx 를 더함)
affects: [09-15 TensionVignette 장착, 12페이즈 발소리(onCue 에 얹음)]

actuals:
  tokens: 6000
  tasks: 2
  commits: 3
plan_head_before: 6f7bf2ba4a1c42d349ee94797a47b231010fc65b
plan_head_after: 0659786677e961f93a522bb524e302854852e5d7

tech-stack:
  added: []
  patterns:
    - "서버 신호와 끊긴 연출은 import 0개 순수 모듈 + 주입형 rng·타이머로 만들고 정적 검사로 고정한다"

key-files:
  created:
    - src/world/tension.ts
    - test/unit/tension.test.ts
    - test/unit/tensionStaticGuard.test.ts
  modified: []

key-decisions:
  - "큐 창 상한 28000ms 는 지역 상수 — 서버 밤 길이 상수를 import 하지 않는다 (A1)"
  - "창을 넘는 큐는 버린다. 첫 큐 ≤ 8999 라 첫 두 큐(≤ 17999)는 항상 창 안이라 최소 2개가 남는다 (A2)"

requirements-completed: []
duration: 6min
completed: 2026-11-03
---

# Phase 9 Plan 06: 시민 편 긴장 큐 스케줄러 Summary

**난수·타이머·모션 줄이기만 입력으로 받는 import 0개 큐 스케줄러(planTensionCues·startTension)와, 서버 시각·프레임 이름이 생기면 실패하는 정적 가드 시험.**

## TDD

- **RED:** `test/unit/tension.test.ts` 8개. 모듈이 없으면 import 실패(INVALID_RED)라서, 값을 틀리게 돌려주는 임시 스텁을 로컬에만 두고(커밋 안 함) 실행해 planTensionCues 큐 규칙 3건·상수 1건이 어설션(`expected [] to deeply equal [5000, 9000]`, `expected +0 to be 1300`)으로 실패하는 것을 확인했다. semanticAssessment: 목표 시험이 계획한 단언에서 의도대로 실패(4 failed / 4 passed — startTension 시험 중 일부는 빈 스텁에서 빈 결과가 맞아 우연히 통과, GREEN 에서 실제 값으로 검증). `gsd_run check tdd-red-evidence` 는 실행하지 않았다(수동 확인).
- **GREEN:** `src/world/tension.ts` 구현 후 8개 통과.
- **REFACTOR:** 없음.
- **Task 2:** 시험만 추가(구현 변경 없음). 검사 함수가 import 줄·금지 이름을 실제로 잡는지 자기 시험으로 확인(가짜 소스 문자열) — 이 자기 시험이 RED 역할.

## 커밋

- `0e1ab90` test(09-06): 긴장 큐 스케줄러 실패 시험 추가
- `46832f2` feat(09-06): 시민 편 긴장 큐 스케줄러 구현
- `0659786` test(09-06): 긴장 연출 모듈 정적 가드 시험 추가

## 검증

- `npx vitest run test/unit/tension.test.ts test/unit/tensionStaticGuard.test.ts` — 13 통과
- `npm run typecheck` 통과, `npx vitest run --project unit` — 73 파일 / 2096 통과 (1 skipped, 기존)

## Deviations from Plan

None - 계획대로 실행. (RED 는 계획의 "시험 먼저 커밋" 순서를 지키되, 로드 실패를 RED 로 치지 않으려고 로컬 스텁으로 어설션 실패를 확인했다.)

## 요구사항

NIGHT-10 은 완료 처리하지 않았다 — 이 계획은 스케줄러만 만들고, 화면 비네트·장착은 09-15 몫이다.

## Known Stubs

없음.

## Threat Flags

없음. T-09-10 은 정적 가드 시험으로 완화(import 0개, 서버 시각 이름 0개).

## Self-Check: PASSED

- FOUND: src/world/tension.ts, test/unit/tension.test.ts, test/unit/tensionStaticGuard.test.ts
- FOUND: 0e1ab90, 46832f2, 0659786
