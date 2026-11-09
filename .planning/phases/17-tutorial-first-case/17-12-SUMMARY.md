---
phase: 17-tutorial-first-case
plan: "12"
subsystem: server-view-leak
tags: [view, worker-do, leak-test, tdd, tracer, mutation-check]
status: complete

requires:
  - phase: 17-tutorial-first-case
    provides: "17-01 의 tutorial 단계·tutorialProgress·markTutorialDone·allTutorialDone·clearTutorial·RoomState.tutorialPassed·프로토콜 타입"
provides:
  - "tutorial 단계 view.tutorial = { done, total, endsAt }(모든 소켓 같은 값)와 본인 me.tutorialDone: true(허용 목록 방식)"
  - "방 DO handleDisconnect 의 전원 완료 재검사(끊김 = 끝낸 것, 0080-10)"
  - "worldVisibleTo 의 tutorial(방 전원) — 광장 시작 snap 이 tutorial 단계에서도 간다(Pitfall 6)"
  - "경계 시험(순수 규칙·거절·멱등·봇·150초 알람·광장 snap·되돌리기)과 누설 검사 확장(TUTORIAL_PATHS·tutorialPassed·역할 시점 동일성)"
affects: [17-07, 17-09]

actuals:
  tokens: 11000
  tasks: 3
  commits: 5
plan_head_before: 68888c531dec2b9195807f20eab72ed2a3aa5b83
plan_head_after: aa1c71392f33d2c6ffb05353120f66271255d812

tech-stack:
  added: []
  patterns:
    - "공개 값은 허용 목록(필드별 대입)으로만 싣고, 누가 했는지의 서버 전용 목록(tutorialPassed)은 숫자·본인 여부로만 환원한다"
    - "끊김 재검사: detach 직후 단계가 tutorial 이면 applyTutorialDone 과 같은 tick({...state, phaseEndsAt: now}) + afterTransition 경로"
    - "새 공개 경로는 TUTORIAL_PATHS 허용 목록 + 접두 위반 함수 + 변이 확인으로 고정"

key-files:
  created:
    - test/unit/tutorial.test.ts
    - test/worker/tutorialLeak.test.ts
  modified:
    - shared/game/view.ts
    - shared/game/audience.ts
    - worker/room.ts
    - test/worker/tutorial.test.ts
    - test/unit/audience.test.ts
    - test/worker/leak.test.ts

key-decisions:
  - "view.tutorial.endsAt 은 state.phaseEndsAt, 없으면 now (계획 그대로)"
  - "tutorialLeak.test.ts 는 leak.test.ts 의 허용 목록을 가져오지 않고 같은 모양으로 지역 복사한다(테스트 파일끼리 import 하면 상대 describe 가 같이 돈다 — errandLeak 선례)"
  - "view 동일성 비교에서 serverNow(소켓마다 방송 시각이 다름)를 본인 값 셋과 함께 뺀다"

patterns-established:
  - "경계 시험은 RED 대상 셋(끊김 넘김·worldVisibleTo·광장 snap)과 특성 시험을 나눠 적는다"

requirements-completed: [TUT-02, TUT-05, DEPLOY-05]

duration: 약 10분
completed: 2026-11-09
---

# Phase 17 Plan 12: 공개 진행 값·경계·누설 검사 Summary

tutorial 단계 view 에 view.tutorial(done·total·endsAt)과 보낸 본인의 me.tutorialDone 을 허용 목록 방식으로 싣고, 끊김만으로도 전원 완료가 되면 assigning 으로 넘기며 광장 snap 이 tutorial 단계에서도 전원에게 가게 한 뒤, 누설 검사를 새 경로·서버 전용 이름·역할 시점 동일성까지 넓히고 변이 두 건으로 검사가 비어 있지 않음을 보였다.

## Accomplishments

- `shared/game/view.ts`: `state.phase === "tutorial"` 일 때만 `view.tutorial = { ...tutorialProgress(state), endsAt: state.phaseEndsAt ?? now }`, 본인 id 가 `tutorialPassed` 에 있으면 `myInfo.tutorialDone = true`(거짓은 키 없음). id 목록은 싣지 않는다. 머리 주석에 받을 권리 한 줄.
- `worker/room.ts` handleDisconnect: detach 직후 `phase === "tutorial" && allTutorialDone` 이면 `tick({...room, phaseEndsAt: now})` + `afterTransition` 으로 넘기고, 아니면 지금처럼 `persistAndBroadcast`. 뒤의 reschedule·flushWorld 순서는 그대로다(afterTransition 이 reschedule 을 포함하고, 이어지는 `reschedule()` 은 멱등).
- `shared/game/audience.ts` worldVisibleTo: 방 전원 조건에 tutorial 추가, 머리 주석 갱신.
- 시험: 단위 `test/unit/tutorial.test.ts`(순수 규칙·단계 표·beginGame 난수 순서), `test/unit/audience.test.ts` tutorial 행, 워커 `test/worker/tutorial.test.ts` 두 describe("공개 진행 값"·"튜토리얼 경계"), `test/worker/leak.test.ts`(`"tutorialPassed"`·`TUTORIAL_PATHS`·`tutorialViolations`·허용 경로 시험), 신규 `test/worker/tutorialLeak.test.ts`.

## Task Commits

1. **Task 1 RED:** `61b3975f` — `test(17-12): 튜토리얼 공개 진행 값 실패 시험`
2. **Task 1 GREEN:** `e95834d4` — `feat(17-12): 튜토리얼 공개 진행 값 view.tutorial·me.tutorialDone`
3. **Task 2 RED:** `bcce672e` — `test(17-12): 튜토리얼 경계 실패 시험`
4. **Task 2 GREEN:** `ca8ec22b` — `feat(17-12): 튜토리얼 끊김 재검사·광장 snap`
5. **Task 3:** `aa1c7139` — `test(17-12): 튜토리얼 누설 검사 확장`

## TDD Gate Compliance

**Task 1 (트레이서) RED 증거** (커밋 `61b3975f`): `npx vitest run test/worker/tutorial.test.ts` 가 7개 중 2개 실패.
- "켜고 시작하면 모든 소켓의 view.tutorial = { done: 0, total: 4, endsAt: phaseEndsAt } 이고 me 에 tutorialDone 키가 없다" — 계획한 이유 그대로 `view.tutorial` 이 `undefined`.
- "손님 둘이 끝났음을 보내면 모든 소켓의 done 이 2 가 되고, 보낸 둘의 me 에만 tutorialDone === true 가 있다" — `done === 2` 인 tutorial state 프레임이 오지 않아 `nextFrame` 시간 초과.
- 나머지 둘(assigning·끄고 시작한 방에 키 없음)은 키가 없는 기존 동작을 지키는 시험이라 RED 에서도 통과(기대된 것).
- GREEN: 7개 통과, `npm run typecheck` 통과. 트레이서 게이트(auto 방식): `<verify>` 재실행 통과, "Tracer verified end-to-end — expanding".

**Task 2 RED 증거** (커밋 `bcce672e`):
- RED 대상 셋(구현 전 실패 확인):
  1. 끊김 넘김(워커) "사람 넷 중 둘이 끝낸 뒤 나머지 둘의 소켓이 닫히면 단계가 assigning 으로 넘어가고 roleReveal 까지 정상 진행한다" — 재검사가 없어 tutorial 에 머물러 `viewIn(assigning)` 시간 초과.
  2. worldVisibleTo tutorial(단위) "worldVisibleTo — 접속 스냅샷에 실릴 좌석 > tutorial: 방 전원" — 빈 집합(`''`).
  3. 광장 snap(워커) "광장 맵으로 켜고 시작하면 모든 소켓이 tutorial 단계에서 광장 입장 지점의 snap 을 받고…" — snap 0개(`expected [] to have a length of 1`).
- 특성 시험(처음부터 초록, 17-01 구현을 고정): 순수 규칙 단위(tutorialProgress 봇·끊김, markTutorialDone 단계·방 소속·멱등, allTutorialDone 0명, clearTutorial, PHASE_DEFS.tutorial, beginGame 난수 순서 보존), 대기실 tutorialDone → WRONG_PHASE(다른 소켓 0프레임), 덧붙은 키·잘못된 타입 BAD_MESSAGE, 손님 start NOT_HOST, 두 번 보낸 tutorialDone 멱등, 사람 둘+봇 둘 total 2, 150초(forceDue + 알람) 넘김, 테스트 방 testReset 되돌리기.
- GREEN: 관련 시험 3개 파일 138개 통과, typecheck 통과.

**Task 3 (시험만 변경, RED/GREEN 대신 변이 확인):** 새 시험이 처음부터 초록이어야 정상. 변이 확인 두 건(커밋 안 함, 되돌린 뒤 `git diff --quiet -- shared/` 성공):
- (a) `shared/game/view.ts` 의 view.tutorial 에 `passed: state.tutorialPassed` 임시 추가 → 실패한 시험: tutorialLeak "역할이 모두 다른 여섯이 시작부터 assigning 까지 받은 모든 프레임에서 tutorialPassed 가 없고 새 경로는 허용 목록 안이며…" (`.view.tutorial.passed` 허용 밖 경로). 같은 자리에 키 이름 `tutorialPassed` 로 더한 변형도 같은 시험이 서버 전용 이름으로 잡았다.
- (b) `shared/game/phases.ts` 의 `PHASE_DEFS.tutorial.revealsOwnRole` 임시 true → 실패한 시험 둘: tutorialLeak "역할이 모두 다른 여섯이 … 역할 낱말은 허용 경로 밖에 없다"(tutorial 단계에서 me.role 노출)와 "같은 순간 tutorial 단계 view 는 역할이 다른 모든 소켓에서 me.seat·me.isHost·me.tutorialDone 을 뺀 값이 같다"(역할 시점 동일성).

## Acceptance Criteria

| 기준 | 결과 |
|------|------|
| `grep -c tutorialProgress shared/game/view.ts` ≥ 1 | PASS (2) |
| `grep -c tutorialDone shared/game/view.ts` ≥ 1 | PASS (3) |
| `grep -c "공개 진행 값" test/worker/tutorial.test.ts` ≥ 1 | PASS (1) |
| Task 1 vitest + typecheck | PASS |
| `grep -c allTutorialDone worker/room.ts` ≥ 2 | PASS (4) |
| `grep -c '"tutorial"' shared/game/audience.ts` ≥ 1 | PASS (1) |
| `test -f test/unit/tutorial.test.ts` | PASS |
| Task 2 세 파일 vitest | PASS (138) |
| `grep -c tutorialPassed test/worker/leak.test.ts` ≥ 1 | PASS (3) |
| `grep -c TUTORIAL_PATHS test/worker/leak.test.ts` ≥ 2 | PASS (4) |
| `test -f test/worker/tutorialLeak.test.ts` | PASS |
| 변이 확인 두 건의 실패 시험 이름 | PASS (위) |
| `git diff --quiet -- shared/`, `npm run typecheck && npm test` | PASS (269 파일 통과·6 건너뜀, 7738 통과) |

## Deviations from Plan

None - plan executed exactly as written.

참고(편차 아님): 계획 files_modified 의 `shared/game/tutorial.ts` 는 17-01 의 순수 규칙이 단위·워커 특성 시험을 모두 통과해 고칠 곳이 없었다.

## Issues Encountered

없음. 전체 `npm test` 는 한 번에 통과했다(17-01 이 기록한 bots 시험의 흔들림은 이번에는 나타나지 않았다).

## Known Stubs

없음.

## Threat Flags

없음. 새 표면(view.tutorial·me.tutorialDone·handleDisconnect 전환·worldVisibleTo tutorial)은 계획의 위협 모델(T-17-28~30)에 모두 있고, T-17-28 은 허용 목록·누설 시험·변이 확인 둘로, T-17-29 는 끊김 넘김 시험(assigning → roleReveal 정상 진행까지)으로 확인했다.

## Next Phase Readiness

Ready for 17-07·17-09: 기다림 화면이 읽을 서버 공개 값 `view.tutorial = { done, total, endsAt }`·`me.tutorialDone` 이 있고, 끊김·150초·봇 경로가 서버에서 성립한다. wave 2 의 17-04 는 src/·test/client/ 만 건드려 이 계획과 파일이 겹치지 않는다.

## Self-Check: PASSED

- 파일 존재: shared/game/view.ts, shared/game/audience.ts, worker/room.ts, test/unit/tutorial.test.ts, test/worker/tutorialLeak.test.ts — FOUND
- 커밋 존재(`git merge-base --is-ancestor`): 61b3975f, e95834d4, bcce672e, ca8ec22b, aa1c7139 — FOUND
