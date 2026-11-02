---
phase: 07-free-chat
plan: "25"
subsystem: world-runtime
tags: [prediction, blend, runtime, character-pose, yaw, tdd, gap-closure]
gap_closure: true
gap_ids: [G-07-9]

requires:
  - phase: 07-free-chat
    provides: "07-24 의 planMoveSegment·predictSegment·blendRemaining·stepYaw·travelYaw·createOwnMoves·WorldStore.moveSeqOf"
provides:
  - "src/world/runtime.ts — 내 예측 구간·응답 추적·구간 교체 섞기·방향 회전·notifyMoveSent(at, dest)·shown(seat)"
  - "src/components/WorldStage.tsx — 보낸 목적지 정수를 notifyMoveSent 에 넘김"
  - "src/world/character.ts — 걷기·서기 자세 섞기 POSE_BLEND_MS(120ms)"
affects: [07-26, 07-27]

plan_head_before: aa5a83dbd1226a55987fba9b214ca91959849561
plan_head_after: 6657e044fcfb8e7471a823104623f99c71766f0b

actuals:
  tokens: 9900
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "그릴 구간(예측 또는 서버)이 바뀌면 '새 구간이 직전 프레임에도 이어졌다면 있었을 자리' 와 지금 그린 자리의 차이를 잡아 blendRemaining 으로 줄인다"
    - "응답 판정은 연결 단위 추적기(createOwnMoves) 하나, 응답 없음 시계도 런타임 단위 하나"

key-files:
  created: []
  modified:
    - src/world/runtime.ts
    - src/components/WorldStage.tsx
    - src/world/store.ts
    - src/world/character.ts
    - test/client/worldStage.test.tsx
    - test/unit/character.test.ts

key-decisions:
  - "구간 교체 때 화면 위치 차이는 계획 문장의 'a.pos − 지금 구간 위치' 가 아니라 'a.pos − 새 구간의 직전 프레임 시각 위치' 로 잡는다 — 앞의 식은 한 프레임 걸음(≈0.03)을 차이로 섞어 탭 첫 프레임에 한 번 멈추고 예측 경로와 1e-6 일치도 깨진다"
  - "notifyMoveSent 에 dest 가 없으면(성능 스파이크) 예측·추적 없이 이미 있는 내 서버 구간으로 링을 바로 맞춘다 — 추적기에 넣으면 이미 지난 응답을 기다리다 1.5초 알림이 뜬다"
  - "방향 목표 yawGoal 을 배우에 남겨 구간이 끝나도 돌던 중이면 마저 돌고, 멈춘 뒤에는 새로 정하지 않는다"

requirements-completed: [MAP-02]

coverage:
  - id: D1
    description: "탭 다음 프레임부터 내 캐릭터가 서버와 같은 길(predictSegment)로 걷고 서버 위치(positionOf)는 그대로다"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/client/worldStage.test.tsx#결정 0059: 탭하면 서버 구간을 기다리지 않고 다음 프레임부터 걷고 서버 위치는 그대로다"
        status: pass
      - kind: unit
        ref: "test/client/worldStage.test.tsx#결정 0059: 예측 중에는 매 프레임 서버와 같은 길(predictSegment)의 위치에 선다"
        status: pass
    human_judgment: false
  - id: D2
    description: "서버 구간이 늦게 와도 한 프레임에 튀지 않고 SEG_BLEND_MS 뒤 서버 위치에 맞으며, 응답이 없으면 알림 한 번과 150ms 되돌림"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/client/worldStage.test.tsx#결정 0059: 서버 구간이 RTT/2 늦게 와도 한 프레임에 튀지 않고 SEG_BLEND_MS 뒤 서버 위치에 맞는다"
        status: pass
      - kind: unit
        ref: "test/client/worldStage.test.tsx#결정 0059: 응답이 없으면 1.5초 뒤 알림 한 번, 링이 사라지고 내 캐릭터는 서버 위치로 150ms 에 걸쳐 돌아간다"
        status: pass
    human_judgment: false
  - id: D3
    description: "남은 예측하지 않고 섞기만, 순간이동은 바로, 둘째 탭이 첫 응답에 끌려가지 않음, 새 연결·모션 줄이기 처리"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/client/worldStage.test.tsx#G-07-9 섞기·방향 (결정 0059)"
        status: pass
    human_judgment: false
  - id: D4
    description: "방향이 한 프레임 YAW_TURN_RATE × dt 까지만 돌고, 걷기·서기 자세가 120ms 에 걸쳐 바뀐다"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/client/worldStage.test.tsx#결정 0059: +x 로 걸으면 방향은 한 프레임에 YAW_TURN_RATE × dt 까지만 돌고 150ms 안에 π/2 가 된다"
        status: pass
      - kind: unit
        ref: "test/unit/character.test.ts#자세 섞기 (결정 0059)"
        status: pass
    human_judgment: false
  - id: D5
    description: "실제 폰·배포본(RTT 약 155ms)에서 살짝 멈췄다 움직이는 느낌이 사라졌는지(UAT 9번)"
    requirement: MAP-02
    verification: []
    human_judgment: true
    rationale: "가짜 렌더러·가짜 시계 시험은 위치·방향 수치만 고정한다. 체감은 07-26 E2E 를 07-27 이 배포본에 돌리고 사람이 본다"

duration: 6min
completed: 2026-11-02
status: complete
---

# Phase 07 Plan 25: 이동 예측·섞기를 로비 런타임에 잇기 Summary

**로비 런타임이 탭하자마자 서버와 같은 길로 내 캐릭터를 걷게 하고, 서버 구간·응답 없음으로 바뀔 때 화면 위치 차이를 150ms 에 줄이며, 방향(반 바퀴 120ms)·걷기/서기 자세(120ms)를 짧게 섞는다**

## Performance

- **Duration:** 약 6분
- **Tasks:** 3 (각각 RED test → GREEN feat)
- **Files modified:** 6 (런타임 4, 시험 2)

## Accomplishments

- `runtime.ts`: 배우마다 그린 구간(`seg`)·화면 위치 차이(`off`)·`offAt`·`yawGoal` 을 들고, 내 자리는 `own.effective(server)`(예측 중이면 예측), 남은 언제나 서버 구간을 그린다. 구간이 바뀌면 차이를 잡고 `blendRemaining` 으로 줄이며 3 단위 넘는 차이·복귀 프레임·모션 줄이기는 바로 맞춘다.
- 응답 판정을 `store.moveSeqOf` + `createOwnMoves.observe` 로 모아 `ACK_SLACK_MS`·`baseSeg`·링 타이머를 없앴다. 둘째 탭의 링과 예측이 첫 탭의 늦은 응답에 끌려가지 않는다. 응답 없음 시계는 런타임 단위 하나(`ackTimer`)이고, 새 연결(epoch)이면 예측·링·시계를 알림 없이 거둔다.
- `notifyMoveSent(at, dest?)`·`shown(seat)` 추가. `WorldStage.onTap` 은 clamp 한 목적지 정수를 `send` 와 `notifyMoveSent` 에 같은 값으로 넘기며 보내는 메시지는 `{t:"move", x, z}` 그대로다. `sample()` 은 서버 값 그대로.
- 방향: `travelYaw` 목표로 `stepYaw` 만큼만 돌고 모션 줄이기면 바로 돈다. 멈춘 뒤에는 새로 정하지 않는다.
- `character.ts`: `POSE_BLEND_MS = 120` 과 `walkMix` 로 서기↔걷기 자세를 선형 보간(0·1 에서는 자세 객체 그대로). 동작 끊김·머리 높이는 섞인 자세 기준.
- worker/·shared/protocol.ts 는 기준선 d319105 대비 diff 0.

## TDD Gate Compliance

| Task | RED | GREEN |
| --- | --- | --- |
| 1 트레이서 | `c6d733e` test(07-25) | `959b6ba` feat(07-25) |
| 2 섞기·방향 | `b089355` test(07-25) | `ba2b247` feat(07-25) |
| 3 자세 섞기 | `ac6a604` test(07-25) | `6657e04` feat(07-25) |

RED 근거(대상 시험이 계획한 단언에서 실패함을 vitest 출력으로 확인, import 오류 아님):
- Task 1: 예측 출발(거리 0)·경로 일치(0.02 차)·응답 한 프레임 이동 0.063·응답 없음(거리 0) 네 시험이 단언에서 실패.
- Task 2: 방향 시험 3건(한 프레임 회전 0.67·2.47 rad > 제한 0.42)만 실패. **이미 Task 1 이 만족**해 RED 근거에서 뺀 시험: 남 예측 없음, 남 섞기, 순간이동, 둘째 탭, 새 epoch, 모션 줄이기 섞기 없음, 모션 줄이기 방향(마지막은 즉시 setYaw 라 통과).
- Task 3: 비율 시험(1 이 아닌 값 기대)·멈춘 첫 프레임·머리 높이 3건이 실패. `POSE_BLEND_MS` 만 먼저 내보내 import 깨짐(INVALID_RED)을 피함.
- 이 프로젝트는 tdd_mode 가 꺼져 있어 `tdd-red-evidence` 기록 파일은 만들지 않았다.

## Task Commits

1. **Task 1 (tracer): 탭 예측·교정 섞기·응답 없음 되돌림** — `c6d733e` (test), `959b6ba` (feat)
2. **Task 2: 짧은 방향 회전** — `b089355` (test), `ba2b247` (feat)
3. **Task 3: 걷기·서기 자세 섞기** — `ac6a604` (test), `6657e04` (feat)

## Decisions Made

- 트레이서 게이트: `<verify>` 가 자동뿐이고 `HUMAN_VERIFY_MODE` 기본(end-of-phase)이라 `worldStage·motion` 시험을 다시 돌려 통과를 확인하고 확장했다(체크포인트 없음).
- 위 key-decisions 3건.

## Deviations from Plan

**1. [Rule 1 - Bug] 구간 교체 차이를 새 구간의 직전 프레임 시각 위치로 잡음**
- **Found during:** Task 1 (GREEN 설계 단계, 시험 behavior 와의 충돌)
- **Issue:** 계획의 `off = a.pos − live(지금 시각)` 은 한 프레임 걸음(≈0.03)을 차이로 취급해 탭 첫 프레임에 멈추고, behavior 의 '예측 경로와 매 프레임 1e-6 일치'·'첫 프레임 ≥0.01 이동'을 만족할 수 없다.
- **Fix:** `off = a.pos − positionAt(eff, sNow − gapMs)`. 새 구간이 직전 프레임에도 이어졌다면 있었을 자리와의 차이만 섞는다. 나머지 판정(스냅 3 단위·resync·모션 줄이기)은 계획 그대로.
- **Files modified:** src/world/runtime.ts
- **Commit:** `959b6ba`

**2. [Rule 1 - Bug] dest 없는 notifyMoveSent 는 링을 바로 맞춘다**
- **Found during:** Task 1 ((7) 단계 구현)
- **Issue:** 성능 스파이크(`perfScene`)는 store 에 move 를 먼저 넣고 dest 없이 부른다. 추적기에 `sent` 를 넣으면 이미 지난 응답을 기다려 1.5초 뒤 링이 사라지고 알림이 뜬다.
- **Fix:** dest 가 없으면 `own.sent`·타이머 없이, 링이 있고 ack 전이며 내 서버 구간이 있으면 `ackRing` 만 한다. 컴파일·동작 모두 그대로.
- **Files modified:** src/world/runtime.ts
- **Commit:** `959b6ba`

**Total deviations:** 2 auto-fixed (Rule 1 둘). **Impact:** 계획의 의도(탭 즉시 걷기·튀지 않는 교정)를 충족하기 위한 내부 계산식 수정이며 공개 모양·시험 기대는 그대로다.

## Issues Encountered

None. 전체 `npx vitest run`(143 파일, 3895 통과, 1 skipped — 07-24 부터 있던 것)과 `npm run typecheck`, `npm run build` 초록. 메인 청크에 `WebGLRenderer` 없음(three-in-main 0).

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크 표면·권한 경로 없음. T-07-60(예측이 서버 판정을 대신함)은 예측을 화면 위치에만 쓰고 메시지가 바뀌지 않음을 시험과 worker diff 0 으로 확인. T-07-61(남 예측 없음)은 시험으로 고정.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

07-26 이 `runtime.shown(seat)` 로 E2E 훅을 만들고 07-27 이 배포본(RTT 약 155ms)에서 W11·W12 를 돌린다. UAT 9번의 체감 확인(D5)은 그때 사람이 본다. 막힘 없음.

## Self-Check: PASSED

- 파일: src/world/runtime.ts, src/components/WorldStage.tsx, src/world/store.ts, src/world/character.ts, test/client/worldStage.test.tsx, test/unit/character.test.ts 모두 존재
- 커밋: c6d733e, 959b6ba, b089355, ba2b247, ac6a604, 6657e04 모두 HEAD 의 조상
- 수락 기준: createOwnMoves( 1·predictSegment( 1·notifyMoveSent(…offset, 1·ACK_SLACK_MS 0·baseSeg 0·예측 금지 문구 0, stepYaw( 1·travelYaw( 1, `결정 0059` 시험 5건 이상, `G-07-9` 1, POSE_BLEND_MS 내보내기 1, `.skip(`·`.todo(` 없음, test(07-25) 커밋 3, worker·protocol diff 0, 전체 시험·타입 검사·빌드 초록
