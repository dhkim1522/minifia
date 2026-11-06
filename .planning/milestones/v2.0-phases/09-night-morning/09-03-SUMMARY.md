---
phase: 09-night-morning
plan: "03"
subsystem: game-rules
tags: [night, world, audience, movement, tdd, information-hiding]
status: complete

requires:
  - phase: 09-night-morning
    provides: 결정 0061-2 (밤 마피아 이동·위치 받는 사람), 0061-3 (밤 접속 snap)
provides:
  - canMoveIn(phase, alive, isMafia = false) — 밤은 산 마피아만 이동
  - audience world 밤 분기 — 산 마피아 mover 는 {산 마피아 + 유령}, 산 비마피아 mover 는 빈 집합
  - worldVisibleTo 밤 분기 — 산 시민·경찰·의사는 {본인}, 마피아는 산 사람 전원, 유령은 전원
affects: [09-09 (밤/아침 진입 위치 동기화), 09-13 (마피아 화면의 canMoveIn 세 번째 인자)]

actuals:
  tokens: 14000
  tasks: 2
  commits: 4
plan_head_before: 4394f046335895b5f689babb54c7e6af10e3c525
plan_head_after: 1e5821c8814214c8bdce149955ddf557e631e5a2

tech-stack:
  added: []
  patterns:
    - "숨길 위치는 화면에서 거르지 않고 받는 사람 집합(audience·worldVisibleTo)에서 뺀다"
    - "방어선 두 겹: canMove 가 먼저 거절하고 audience 도 비마피아 mover 에 빈 집합"

key-files:
  created: []
  modified:
    - shared/game/movement.ts
    - shared/game/audience.ts
    - test/unit/movement.test.ts
    - test/unit/audience.test.ts
    - test/worker/world.test.ts

key-decisions:
  - "탈락한 마피아는 유령으로 든다: 술어 !isAlive(p) || p.role === 'mafia' (가정 A1)"
  - "밤 재접속 첫 snap 도 live 프레임과 같은 worldVisibleTo 를 쓴다(L9) — room.ts 는 바꾸지 않았다"

requirements-completed: [NIGHT-07]

duration: 20min
completed: 2026-11-03
---

# Phase 9 Plan 03: 밤 받는 사람 규칙 Summary

밤에는 산 마피아만 움직일 수 있고, 마피아의 위치·걸음은 산 마피아와 유령에게만 가며, 시민 편은 재접속 첫 snap 에서도 본인 한 칸만 받는다.

## 한 일

- `movement.ts`: `canMoveIn` 에 `isMafia = false` 를 더해 `night` 에서 산 마피아만 true. `canMove` 는 `p.role === "mafia"` 를 넘긴다. 유령 규칙과 다른 단계 결과는 그대로다.
- `audience.ts` world 분기: 유령 mover 는 유령만(그대로), 밤이면 산 마피아 mover 는 `{산 마피아 + 유령}`, 그 밖의 산 mover 는 빈 집합(fail-closed). 다른 지도 단계·로비는 그대로다.
- `worldVisibleTo`: 밤이고 viewer 가 산 비마피아면 `{viewerId}`. 산 마피아는 산 사람 전원, 유령은 전원이다.
- 시험: 단위(movement 3건, audience world 밤 5건 + worldVisibleTo 밤 5건), worker 5건(마피아 move 가 마피아·유령 소켓에만 가고 시민 편 소켓은 world 프레임 0, 비마피아 move 는 프레임·오류 0, 밤 재접속 첫 snap 좌석이 시민·경찰·의사는 본인 하나, 마피아는 산 사람 전부, 유령은 전원).

## TDD 기록

- RED `b531716` (이동·audience), GREEN `13b3b6d`
- RED `cb65a7c` (worldVisibleTo·재접속 snap), GREEN `1e5821c`

## 검증

- `npm run typecheck` 통과, `npx vitest run --project unit` 2060 통과, `npx vitest run --project worker` 303 통과.
- `.skip(`·`.todo(` 0건, 회사 관련 표현 grep 0건.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 기존 시험 기대값] 밤 행 기대값 갱신**
- **Found during:** Task 1 GREEN, Task 2 RED
- **Issue:** `audience world mover(GHOST-01)` 의 night 항목(산 시민 mover 가 방 전원)과 `worldVisibleTo` 의 "산 사람이면 산 사람만" night 항목이 새 규칙과 어긋남
- **Fix:** 두 표에서 night 를 빼고 밤 전용 시험으로 옮김(건너뛰기 없음)
- **Files modified:** test/unit/audience.test.ts
- **Commit:** 13b3b6d, cb65a7c

**2. [Rule 3 - 시험 도우미] 재접속 시험에서 옛 소켓 닫힘**
- **Issue:** 같은 토큰으로 재접속하면 서버가 옛 소켓을 닫아, 그 뒤 `ghostsOf` 의 settle 이 닫힌 소켓에 보냄
- **Fix:** 탈락을 먼저 만들고 재접속을 한다
- **Commit:** 1e5821c

작업 중 `git stash` 를 한 번 잘못 실행해 즉시 `git stash pop` 으로 되돌렸다(스택에 내 항목뿐, 파일 손실 없음 확인).

## Known Stubs

없음.

## Threat Flags

없음. T-09-04·T-09-05 는 단위 표와 worker 0프레임·재접속 시험으로 완화했다.

## Self-Check: PASSED

- shared/game/movement.ts, shared/game/audience.ts, 세 시험 파일 존재 확인
- 커밋 b531716, 13b3b6d, cb65a7c, 1e5821c 가 HEAD 의 조상이다
