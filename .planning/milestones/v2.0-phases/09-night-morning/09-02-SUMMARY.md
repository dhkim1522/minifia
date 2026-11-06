---
phase: 09-night-morning
plan: "02"
subsystem: game-rules
tags: [bots, night, mafia, tdd, test-room]
status: complete

requires:
  - phase: 09-night-morning
    provides: 결정 0061-18 (마피아 봇 협응)
provides:
  - botMafiaTarget(state, bot) — 난수 없는 마피아 봇 밤 대상 결정 함수
  - planFor·DO actAsBot·botsPickNow 세 경로가 같은 결정 함수를 씀
affects: [09-07 (밤 확정 규칙 교체), 봇만으로 도는 시험·smoke·E2E]

actuals:
  tokens: 9000
  tasks: 2
  commits: 4
plan_head_before: 950276cbb8508f01a1e18f9ab9caa0e0dd2808a4
plan_head_after: 01b2398a42d52208ad4a7c1a7c164c8862d61751

tech-stack:
  added: []
  patterns:
    - "계획 시점 대상은 대체값, 실행 시점 상태로 다시 구해 동료(사람 포함) 선택을 따라간다"

key-files:
  created: []
  modified:
    - shared/game/bots.ts
    - shared/game/testTools.ts
    - worker/room.ts
    - test/unit/bots.test.ts
    - test/unit/testTools.test.ts
    - test/worker/bots.test.ts

key-decisions:
  - "마피아 봇 대상: 다른 산 마피아가 고른 산 비마피아의 최소 seat, 없으면 산 비마피아 최소 seat (결정 0061-18, 난수 없음)"
  - "경찰·의사 봇은 기존대로 randInt(후보 수) — 협응 불필요(가정 A2)"

requirements-completed: []

duration: 25min
completed: 2026-11-03
---

# Phase 9 Plan 02: 마피아 봇 협응 Summary

마피아 봇이 난수 없이 동료 선택을 따라가거나 가장 낮은 산 비마피아를 골라, 새 밤 규칙(산 마피아 전원 일치만 확정)에서도 봇만으로 한 판이 끝까지 돈다.

## 한 일

- `botMafiaTarget` 을 새로 두고 `botNightTarget` 의 마피아 분기가 이를 쓰게 했다. 경찰·의사 분기의 난수 순서는 그대로다.
- 방 DO `actAsBot` 의 `pick` 은 마피아 봇이면 실행 시점 상태로 `botMafiaTarget` 을 다시 구하고, 값이 없으면 계획의 대상을 쓴다. 같은 `applyPick` 본체를 지난다(특권 없음).
- `botsPickNow`(넘기기)는 이미 `botNightTarget` 에 매번 갱신된 상태를 넘기고 있어 코드 변경 없이 새 규칙을 따른다. 주석에 결정 0061-18 과 난수 순서를 적었다.
- 마피아 봇의 대상 난수가 없어져 night 계획 시드 고정 값을 다시 고정했다(`962657041` → `554531902`, 채팅 난수 순서 `[5000,10,6000,3]`). 시험 이름에 "09-02 재고정" 을 적었다.

## TDD 기록

- RED(`6838db6`): 단위 9개 + worker 1개. 단위는 `botMafiaTarget` 미존재(TypeError)와 planFor 대상 불일치 단언 실패, worker 는 계획 대상이 서로 달라도 두 마피아 봇의 `nightPick` 이 같아야 한다는 단언 실패. `gsd_run check tdd-red-evidence` 분류기는 돌리지 않았다(수동 확인: 대상 시험이 의도한 이유로 실패).
- GREEN(`142a285`): 위 구현 + 시드 값 재고정.
- Task 2 시험(`633740a`)은 Task 1 이 구현을 이미 바꿨기 때문에 그대로는 통과한다. 옛 결정 함수(마피아 분기를 되돌린 사본)로 돌려 새 시험 3개가 실패함을 확인한 뒤 되돌렸다. 구현 변경은 주석뿐이라 `feat` 커밋(`01b2398`)은 주석 갱신이다.

## 검증

- `npm run typecheck`: 오류 0
- `npx vitest run --project unit`: 71 파일 2047 통과(1 skipped 는 기존)
- `npx vitest run --project worker`: 22 파일 298 통과
- `.skip(`/`.todo(` 없음

## Deviations from Plan

- Task 2 의 worker 시험(`test/worker/testTools.test.ts`)은 깨지지 않아 수정하지 않았고, 새 worker 시험도 더하지 않았다. 사람 마피아가 고른 대상을 봇이 따라가는 경로는 단위 시험(`skipPhase` 끝에서 끝)이 같은 순수 함수로 덮는다.
- Task 2 의 RED 는 위처럼 "구현이 먼저 들어간 뒤의 시험"이다(Task 1 에서 함수가 공유돼 넘기기 쪽에 따로 코드 변경이 필요 없었다).

## Known Stubs

없음.

## 이월 메모

- 마피아 봇은 실행 시점에 자기 계획 대상을 버리고 동료 선택을 따른다. 사람 마피아가 밤 끝까지 안 고르면 봇끼리는 가장 낮은 산 비마피아로 모이지만, 사람은 따로 고를 수 있어 불일치(아침 무효)가 날 수 있다 — 09-07 이후 시험에서 사람 마피아가 있는 방은 사람이 고르게 하거나 불일치를 기대값으로 둔다.
- 마피아 봇 pick 의 `at` 시각(1000~6000ms)은 그대로다. 사람이 그 전에 고르면 봇이 따라가고, 이후 고르면 사람이 마지막 선택이다.

## Self-Check: PASSED

- 수정 파일 모두 존재, 커밋 6838db6·142a285·633740a·01b2398 확인.
