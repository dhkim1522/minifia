---
phase: 17-tutorial-first-case
plan: "01"
subsystem: server-protocol
tags: [protocol, phase-table, worker-do, zod, tdd, tracer]
status: complete

requires:
  - phase: 16-evidence
    provides: PhaseId·PHASE_DEFS·tick ON_ENTER 진입 훅 표, applyEndDiscussion 의 조기 종료 경로
provides:
  - "새 단계 tutorial(PhaseId·PHASE_DEFS: 150초, next assigning, revealsOwnRole false)과 TUTORIAL_MS"
  - "start 메시지의 tutorial 선택 불리언, 새 메시지 tutorialDone, 둘 다 z.strictObject"
  - "TutorialView·RoomView.tutorial·MyInfo.tutorialDone 프로토콜 타입(view 에 싣는 일은 17-12)"
  - "shared/game/tutorial.ts 순수 규칙 네 개, 서버 전용 RoomState.tutorialPassed"
  - "방 DO handleTutorialDone·applyTutorialDone, 전원 완료 시 tick 경로로 assigning"
  - "모든 Record<PhaseId> 표와 시험 표의 tutorial 행"
affects: [17-04, 17-12]

actuals:
  tokens: 3500
  tasks: 1
  commits: 2
plan_head_before: 5db965887c167e9da521ebfea375a5394cad59c5
plan_head_after: db4db6559432209ee8794f2276459eb6c8a085a2

tech-stack:
  added: []
  patterns:
    - "applyEndDiscussion 모양의 전원 완료 조기 전환(markX → allX → tick({...state, phaseEndsAt: now}) → afterTransition)"
    - "서버 전용 키는 다음 단계 진입 훅(ON_ENTER)에서 키째 지운다"

key-files:
  created:
    - shared/game/tutorial.ts
    - test/worker/tutorial.test.ts
  modified:
    - shared/protocol.ts
    - shared/schemas.ts
    - shared/game/phases.ts
    - shared/game/room.ts
    - shared/game/tick.ts
    - worker/room.ts
    - src/game/scenes.ts
    - src/screens/RoomScreen.tsx
    - src/components/TestTools.tsx
    - src/audio/director.ts
    - scripts/e2e/lib.mjs
    - test/unit/emotePhases.test.ts
    - test/unit/soundDirector.test.ts
    - test/unit/scenes.test.ts
    - test/unit/tick.test.ts
    - test/unit/soundProtocol.test.ts
    - test/client/phaseScreens.test.tsx

key-decisions:
  - "start 의 tutorial 은 서버 기본 꺼짐: 키가 없거나 false 면 지금처럼 곧장 assigning (0080-1)"
  - "역할은 beginGame 에서 그대로 배정하고(난수 순서 불변) tutorial 단계가 revealsOwnRole:false 라 view 에 role·allies 가 없다 (0080-2)"
  - "tutorialPassed 는 ON_ENTER.assigning = clearTutorial 로 지운다 (0080-11)"

patterns-established:
  - "Record<PhaseId> 연쇄는 PhaseId 를 더하는 GREEN 커밋 하나에 표와 시험 표를 모두 넣어 그 커밋에서 typecheck·npm test 가 초록이다"

requirements-completed: [TUT-02, TUT-05]

duration: 9 min
completed: 2026-11-09
---

# Phase 17 Plan 01: 함께 진행 서버 게이트 트레이서 Summary

방장이 start 에 tutorial: true 를 실으면 방이 150초 tutorial 단계(역할 없음)로 가고, 앉은 사람(봇 제외) 모두가 tutorialDone 을 보내는 순간 기존 tick 경로로 assigning → roleReveal 로 이어지는 서버 게이트를 메시지에서 방 DO·순수 규칙·단계 표·시험 표까지 한 줄로 이었다.

## Accomplishments

- 프로토콜: PhaseId 에 tutorial(lobby 다음, assigning 앞), ClientMessage `{ t: "start"; tutorial?: boolean }`·`{ t: "tutorialDone" }`, `TutorialView`·`RoomView.tutorial`·`MyInfo.tutorialDone`. 스키마는 start·tutorialDone 모두 `z.strictObject`(덧붙은 키 거부).
- 단계 표: `TUTORIAL_MS = 150_000`, `PHASE_DEFS.tutorial = { 150000, next assigning, revealsOwnRole false }`.
- 순수 규칙 `shared/game/tutorial.ts`: `tutorialProgress`·`markTutorialDone`(단계 → 방 소속 → 멱등 순서, 이미 표시됐으면 같은 객체)·`allTutorialDone`(연결된 사람 0명이어도 참)·`clearTutorial`(키가 없으면 같은 객체).
- 방 상태·시작: `RoomState.tutorialPassed`(서버 전용), `beginGame`·`startGame` 의 `opts.tutorial`(역할·맵 난수 순서는 그대로, rematch 는 opts 없이 불러 불변), `ON_ENTER.assigning = clearTutorial`.
- 방 DO: `handleStart(ws, tutorial)`, `handleTutorialDone`·`applyTutorialDone`(applyEndDiscussion 모양, 전원 완료 시 `tick({...state, phaseEndsAt: now})` + `afterTransition`). handleDisconnect 재검사는 계획대로 17-12.
- Record<PhaseId> 표 넷(PHASE_SCENE tutorial "lobby", PHASE_ANNOUNCE "튜토리얼", TEST_PHASE_LABEL "튜토리얼", BED_OF null)과 시험 표(emotePhases silent, phaseScreens, soundDirector, scenes, tick 단계 수 16·row 150000/assigning/false).

## Task Commits

1. **Task 1 RED:** `5ad25f15` — `test(17-01): 함께 진행 게이트 실패 시험`
2. **Task 1 GREEN:** `db4db655` — `feat(17-01): 함께 진행 tutorial 단계 게이트`

## TDD Gate Compliance

- RED 증거(커밋 `5ad25f15`): `npx vitest run test/worker/tutorial.test.ts` 가 3개 중 2개 실패 — "방장이 tutorial: true 로 시작하면 모두 tutorial 단계…"와 "전원이 tutorialDone 을 보내면 assigning 으로…". 계획한 이유 그대로, 현재 스키마(`z.object({ t: "start" })`)가 tutorial 키를 버려 방이 tutorial 이 아니라 assigning 으로 가므로 `nextFrame` 이 tutorial state 를 기다리다 시간 초과. 세 번째 "tutorial 키 없는 start 는 곧장 assigning" 은 기존 동작 보호 시험이라 RED 에서도 통과(기대된 것).
- GREEN: 같은 파일 3개 통과, `npm run typecheck`·`npm test` 전체 초록(264 파일 통과·6 건너뜀, 7604 통과).
- REFACTOR: 없음.

## Acceptance Criteria

| 기준 | 결과 |
|------|------|
| `grep -c '"tutorial"' shared/protocol.ts` ≥ 1 | PASS (1) |
| `grep -c TUTORIAL_MS shared/game/phases.ts` ≥ 2 | PASS (2) |
| tutorial.ts 존재, `export function` ≥ 4 | PASS (4) |
| `grep -c tutorialDone worker/room.ts` ≥ 2 | PASS (2) |
| `grep -c clearTutorial shared/game/tick.ts` ≥ 1 | PASS (2) |
| `grep -c "16:assigning" test/unit/tick.test.ts` = 1 | PASS (1) |
| `npm run typecheck && npm test` 전체 통과 | PASS |
| SUMMARY 에 RED 증거 | PASS (위) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] scripts/e2e/lib.mjs 의 EXPECTED_SCENE 에 tutorial 행 추가**
- **Found during:** Task 1, 전체 `npm test`
- **Issue:** `test/unit/scenes.test.ts` 의 "EXPECTED_SCENE 이 모든 단계에서 PHASE_SCENE 과 같다"가 키 목록 비교로 실패 — 계획의 files 목록에는 없는 Record 연쇄의 마지막 조각.
- **Fix:** EXPECTED_SCENE 에 `tutorial: "lobby"` 한 줄(PHASE_SCENE 과 같은 값).
- **Files modified:** scripts/e2e/lib.mjs
- **Commit:** db4db655

**2. [Rule 3 - Blocking] test/unit/soundProtocol.test.ts 의 클라이언트 메시지 종류 목록에 tutorialDone 추가**
- **Found during:** Task 1, 전체 `npm test`
- **Issue:** "클라이언트 메시지 종류 목록이 12페이즈 시작 때와 같다"가 새 메시지로 실패. 15페이즈 errand 가 한 줄씩 더한 선례가 있는 목록이다(소리가 만든 메시지가 없다는 고정이라 새 메시지는 소리와 무관함을 주석으로 남김).
- **Fix:** `"tutorialDone"` 한 줄과 주석. 판정을 넓히거나 시험을 건너뛰지 않았다.
- **Files modified:** test/unit/soundProtocol.test.ts
- **Commit:** db4db655

**Total deviations:** 2 auto-fixed (Rule 3 둘, 모두 PhaseId·메시지 유니온 확장이 부르는 키 목록 시험). **Impact:** 범위 확장 없음, 계획이 "다른 시험이 키 목록 비교로 깨지면 그 기대에 tutorial 행을 더한다"고 한 조항 안이다.

## Issues Encountered

- 첫 전체 `npm test` 에서 `test/worker/bots.test.ts` 의 토론 끝내기 시험 1건이 한 번 실패했다(봇 계획 끝내기 수 2 ≠ 3). 단독 실행과 이후 전체 재실행에서는 통과 — 부하 때 시간에 민감한 기존 시험의 흔들림으로 보이며 이 계획의 변경과 무관하다(봇 계획 키 `botPlanKey` 에 tutorial 이 없어 영향 없음). 수정하지 않았다.

## Known Stubs

없음. tutorial 단계의 화면은 기존 화면이 대기실 장면·"튜토리얼" 알림으로 아는 것까지이고, 튜토리얼 화면 자체는 17-04 이후 계획의 몫이다(의도된 범위).

## Threat Flags

없음. 새 표면(start.tutorial·tutorialDone)은 계획의 위협 모델(T-17-01~05)에 모두 있다. 경계·멱등·거절 시험과 view 공개 값 싣기는 계획대로 17-12.

## Next Phase Readiness

Ready for 17-12(wave 2): view.tutorial·me.tutorialDone 싣기, 광장 snap, handleDisconnect 의 전원 완료 재검사, 누설 검사 확장, 같은 test/worker/tutorial.test.ts 에 경계 시험 추가. 프로토콜 이름은 모두 있고 컴파일 연쇄가 끝나 있다.

## Self-Check: PASSED

- 파일 존재: shared/game/tutorial.ts, test/worker/tutorial.test.ts — FOUND
- 커밋: 5ad25f15, db4db655 — 현재 브랜치(v3) 조상으로 확인
