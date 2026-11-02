---
phase: 07-free-chat
plan: "24"
subsystem: world-movement
tags: [prediction, blend, planMoveSegment, motion, WorldStore, tdd, gap-closure]
gap_closure: true
gap_ids: [G-07-9]

requires:
  - phase: 06
    provides: shared/game/world.ts requestMove·routeFx·positionAt 와 WorldStore (서버 권위 구간)
provides:
  - "shared/game/world.ts planMoveSegment — 서버 requestMove 와 클라이언트 예측이 같이 쓰는 경로 본체"
  - "src/world/motion.ts — predictSegment·blendRemaining·travelYaw·stepYaw·createOwnMoves 와 상수 SEG_BLEND_MS·BLEND_SNAP_DIST·YAW_TURN_RATE (결정 0059)"
  - "WorldStore.moveSeqOf(seat) — 이 연결의 snap 뒤 그 자리에 적용된 move 수"
affects: [07-25, 07-26, 07-27]

plan_head_before: 1cdae856d77fc57e23b063812257fc56bbd1312a
plan_head_after: 7413c2cfbf7f2f51bf1a63b39c29261fa0a2d678

actuals:
  tokens: 9000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "서버·클라이언트가 한 순수 함수(planMoveSegment)를 공유해 예측=서버 구간을 단위 시험으로 고정"
    - "시각을 인자로 받는 순수 모듈(three·DOM·Date 없음)"

key-files:
  created:
    - src/world/motion.ts
    - test/unit/motion.test.ts
  modified:
    - shared/game/world.ts
    - src/world/store.ts
    - test/unit/world.test.ts
    - test/unit/worldStore.test.ts

key-decisions:
  - "requestMove 간격 검사 뒤 본체를 글자 그대로 planMoveSegment 로 옮겨 서버 결과를 바꾸지 않았다 (T-07-57)"
  - "stepYaw/wrapAngle 은 이미 (−π, π] 안인 값은 그대로 돌려줘 목표값이 부동소수 오차로 흐트러지지 않게 했다"
  - "travelYaw 는 v ≤ 0 인 구간도 null (걷지 않음)"
  - "store.ts 머리 주석의 '예측 이동 없음' 문구는 계획대로 07-25 에서 고친다"

requirements-completed: [MAP-02]

coverage:
  - id: D1
    description: "planMoveSegment 가 서버 requestMove 본체이고 predictSegment 가 서버 구간과 깊은 비교로 같다 (서 있다 출발·걷는 중·막힌/맵 밖/NaN/제자리)"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/unit/world.test.ts#planMoveSegment — requestMove 본체와 같다(결정 0059)"
        status: pass
      - kind: unit
        ref: "test/unit/motion.test.ts#predictSegment"
        status: pass
      - kind: integration
        ref: "npx vitest run test/worker/world.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "섞기 남은 비율·방향 회전·걷는 방향 계산이 경계값까지 고정됨"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/unit/motion.test.ts#blendRemaining / stepYaw / travelYaw"
        status: pass
    human_judgment: false
  - id: D3
    description: "내 이동 응답 판정(createOwnMoves)과 WorldStore.moveSeqOf — 늦은 첫 응답이 마지막 탭 예측을 끊지 않음"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/unit/motion.test.ts#createOwnMoves"
        status: pass
      - kind: unit
        ref: "test/unit/worldStore.test.ts#WorldStore.moveSeqOf"
        status: pass
    human_judgment: false
  - id: D4
    description: "실제 화면에서 탭 즉시 걷고 튀지 않는지(UAT 9번)는 이 계획 범위가 아니다 — 07-25 연결 뒤 확인"
    requirement: MAP-02
    verification: []
    human_judgment: true
    rationale: "순수 계산 핵심만 만들었고 런타임·화면 연결이 없어 체감은 07-25·07-27 배포본에서 사람이 본다"

duration: 4min
completed: 2026-11-02
status: complete
---

# Phase 07 Plan 24: 이동 예측 순수 계산 핵심 Summary

**서버 경로 본체를 shared planMoveSegment 로 뽑아 클라이언트 predictSegment 가 서버와 같은 구간을 만들게 하고, 섞기·방향 회전·내 이동 응답 판정(createOwnMoves)·WorldStore.moveSeqOf 를 시각 인자 순수 모듈로 시험 고정**

## Performance

- **Duration:** 약 4분
- **Started:** 2026-11-02T05:23:07Z
- **Completed:** 2026-11-02T05:27Z
- **Tasks:** 3 (각각 RED test → GREEN feat)
- **Files modified:** 6 (created 2, modified 4)

## Accomplishments

- `requestMove` 간격 검사 뒤 본체를 한 글자도 바꾸지 않고 `planMoveSegment(cur, dest, now, map)` 로 이동. 서버가 이것을 부르고 `predictSegment` 도 같은 함수를 부른다. 서 있다 출발·걷는 중 새 목적지·막힌 목적지·맵 밖·NaN·제자리가 모두 서버 구간과 깊은 비교로 같다.
- `blendRemaining`(0ms=1, 150ms 이상=정확히 0, 사이 1−smoothstep, 최대 감소율 1.5/SEG_BLEND_MS), `stepYaw`(짧은 쪽, dt×YAW_TURN_RATE 제한, (−π, π]), `travelYaw`(interpFx 와 같은 누적 길이 규칙)와 상수 3개를 근거 주석과 함께 구현.
- `createOwnMoves`: observe 규칙 1~3 그대로. RTT > 탭 간격에서 앞선 탭의 늦은 응답이 마지막 탭의 예측을 끊지 않고, 첫 탭이 버려져도 끝점이 맞으면 answered, expire·reset·seq 감소 reset 처리.
- `WorldStore.moveSeqOf`: 실제 적용된 move(준비됨·같은 epoch)만 자리별로 세고 snap·reset·retainSeats 에서 비운다.
- worker/·shared/protocol.ts 는 기준선 d319105 대비 diff 0 (서버·와이어 불변).

## TDD Gate Compliance

| Task | RED | GREEN |
| --- | --- | --- |
| 1 트레이서 | `46df06e` test(07-24) | `bbaa876` feat(07-24) |
| 2 섞기·방향 | `c142d3f` test(07-24) | `3ff533a` feat(07-24) |
| 3 응답 판정·moveSeqOf | `6a88d95` test(07-24) | `7413c2c` feat(07-24) |

RED 근거(대상 시험이 계획한 단언에서 실패함을 tap-flat 보고서로 확인, import 오류·0건 발견 아님):
- Task 1: world.test 의 planMoveSegment 4건·motion.test 의 predictSegment 2건이 깊은 비교(`toEqual`) 불일치로 실패. 항상 `{p:[0,0],v:0}`/null 을 돌려주는 껍데기를 먼저 두어 INVALID_RED(import 깨짐)를 피함. semanticAssessment: 의도한 단언(서버 구간과 동일)에서 실패.
- Task 2: 상수 범위·blendRemaining 경계·stepYaw 4건·travelYaw 3건이 단언 실패(단조성 시험은 SEG_BLEND_MS=0 껍데기에서 공전이라 통과했으나 GREEN 에서 의미를 가짐).
- Task 3: createOwnMoves 9건·moveSeqOf 2건이 단언 실패(껍데기 effective=server, observe=null, 0 반환).
- 이 프로젝트는 tdd_mode 가 켜져 있지 않아 `gsd_run check tdd-red-evidence` 기록 파일은 만들지 않고 vitest 보고서로 직접 확인했다.

## Task Commits

1. **Task 1 (tracer): planMoveSegment·predictSegment** — `46df06e` (test), `bbaa876` (feat)
2. **Task 2: blendRemaining·stepYaw·travelYaw** — `c142d3f` (test), `3ff533a` (feat)
3. **Task 3: createOwnMoves·moveSeqOf** — `6a88d95` (test), `7413c2c` (feat)

**Plan metadata:** 이 SUMMARY 를 담은 docs(07-24) 커밋

## Files Created/Modified

- `shared/game/world.ts` - planMoveSegment 추출, requestMove 가 위임
- `src/world/motion.ts` - 예측·섞기·방향·응답 판정 순수 계산(신규)
- `src/world/store.ts` - moveSeqs 맵과 moveSeqOf
- `test/unit/world.test.ts` - planMoveSegment 동일성 시험
- `test/unit/motion.test.ts` - motion 전체 시험(신규)
- `test/unit/worldStore.test.ts` - moveSeqOf 시험

## Decisions Made

- 트레이서 게이트: 자동 `<verify>` 만 있고 `HUMAN_VERIFY_MODE` 기본(end-of-phase)이라 `world·motion·worker world` 시험을 다시 돌려 통과를 확인하고 이어 갔다(체크포인트 없음).
- wrapAngle 은 범위 안 값을 그대로 둬 `stepYaw(0, π/2, 1) === π/2` 가 부동소수 오차 없이 성립.
- 그 밖에는 계획 그대로.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. 전체 `npx vitest run`(143 파일, 3878 통과, 1 skipped)과 `npm run typecheck` 초록. 계획 기준선 d319105 는 저장소에 존재하고 worker·shared/protocol.ts 가 그대로임을 확인.

## Known Stubs

없음. (RED 단계 껍데기는 모두 GREEN 에서 구현으로 교체됨.) `src/world/store.ts` 머리 주석의 "예측 이동 없음" 문구는 계획에 따라 07-25 가 고친다.

## Threat Flags

없음. 새 네트워크 표면·권한 경로 없음. T-07-57(본체 추출 변조)은 동일성 시험·기존 world·worker 시험·worker diff 0 으로 완화.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

07-25 가 런타임 프레임 루프에 `predictSegment`·`createOwnMoves.observe(store.moveSeqOf(내 자리), store.segOf(내 자리))`·`blendRemaining`·`stepYaw`·`travelYaw` 를 연결하면 된다. 막힘 없음.

## Self-Check: PASSED

- 파일 존재: shared/game/world.ts, src/world/motion.ts, src/world/store.ts, test/unit/motion.test.ts, test/unit/world.test.ts, test/unit/worldStore.test.ts 모두 FOUND
- 커밋 존재: 46df06e, bbaa876, c142d3f, 3ff533a, 6a88d95, 7413c2c 모두 HEAD 의 조상
- 수락 기준: planMoveSegment 정의 1·위임 호출 2, motion.ts 순수(three/Date/Math.random/document/window 없음), test(07-24) 커밋 3개, worker·protocol diff 0 모두 통과

---
*Phase: 07-free-chat*
*Completed: 2026-11-02*
