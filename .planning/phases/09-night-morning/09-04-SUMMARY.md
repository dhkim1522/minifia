---
phase: 09-night-morning
plan: "04"
subsystem: game-rules
tags: [world, home-memo, approach, tdd, persistence]
status: complete

requires:
  - phase: 09-night-morning
    provides: 결정 0061-3·4·5 (밤·아침 위치 되돌림, home 기억)
provides:
  - HomeMemo 타입과 WorldState.home?·StoredWorld.home? (서버 전용, 프레임에 싣지 않음)
  - captureHome(w, ids, day) — 같은 일차 멱등, 구간 끝점을 적음
  - teleportHome(w, ids, now) — home 점과 구간이 모두 있는 사람만 restSegment 로, lastMoveAt 불변, home 없으면 입력 그대로
  - parseStoredHome(내부) — 틀린 항목만 버림 (T-09-06)
  - approachPoint(target, from, distFx)·APPROACH_DIST_FX = 80
affects: [09-09 (지목 진입 때 captureHome·즉시 저장, 밤·아침 teleportHome), 09-07 이후 마피아 다가가기 화면·봇]

actuals:
  tokens: 9000
  tasks: 2
  commits: 4
plan_head_before: 11a662d3bd0c9e10a4e60114fec13caa6597dc07
plan_head_after: 1ba171ff7d2e0624dfbfe29fd9e29f6ae4ebcd41

tech-stack:
  added: []
  patterns:
    - "lay 선례를 따른 선택 키: 저장 v 는 1 그대로, 옛 저장값은 home 없이 읽힌다"
    - "순수 함수는 시각을 읽지 않는다 — home 은 시각 위치가 아니라 구간 끝점(연구 A1)"

key-files:
  created: []
  modified:
    - shared/game/world.ts
    - test/unit/world.test.ts

key-decisions:
  - "home 은 구간의 마지막 두 값(걷던 사람은 가던 곳)으로 기록한다 (가정 A1)"
  - "저장 키 v 는 1 로 두고 home 은 선택 키로 더한다 (가정 A2)"

requirements-completed: []

metrics:
  duration: 약 10분
  completed: 2026-11-03
---

# Phase 9 Plan 04: home 기억과 다가가기 목적지 Summary

토론이 끝난 자리를 구간 끝점으로 결정적으로 기록(captureHome)하고 저장·복원·순간이동(teleportHome)까지 잇는 순수 층과, 화면·봇 공용 마피아 다가가기 목적지 approachPoint 를 world.ts 에 추가했다.

## 한 일

- Task 1 (트레이서): HomeMemo, captureHome, teleportHome, parseStoredHome, compactWorld·restoreWorld 연결. 왕복·손상 저장값·옛 저장값·fail-safe 시험.
- Task 2: despawnPlayer 가 home.pos 에서 그 사람을 지움(Task 1 구현에 함께 들어갔고 Task 2 시험으로 고정), respawnAll 은 home 없음을 시험으로 고정, approachPoint·APPROACH_DIST_FX 추가.
- 커밋: c60ef0c(test) → 3fbecb9(feat) → test(approach·정리) → 1ba171f(feat).

## 검증

- `npx vitest run test/unit/world.test.ts` 144 통과, `npm run typecheck` 통과
- `npx vitest run --project unit` 2082 통과(1 skipped 기존), `--project worker` 303 통과

## Deviations from Plan

없음. 계획대로 실행했다. 단, despawnPlayer 의 home 정리는 compactWorld 변경과 같은 파일이라 Task 1 GREEN 커밋에 함께 들어갔다(시험은 Task 2 에서 고정).

## 요구사항

NIGHT-07·MORN-01 은 이 계획이 순수 층만 만들었고 DO 배선(지목 진입 때 기록·즉시 저장, 밤·아침 순간이동)이 09-09 라 완료 처리하지 않는다.

## Known Stubs

없음.

## Threat Flags

없음. home 은 서버 전용이고 프레임에 실리지 않는다. T-09-06 은 parseStoredHome 형태 검사와 시험으로 완화.

## Self-Check: PASSED

- shared/game/world.ts, test/unit/world.test.ts 존재 확인, 커밋 c60ef0c·3fbecb9·1ba171f 존재.
