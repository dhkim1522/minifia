---
phase: 15-errand-and-trace
plan: "02"
subsystem: server-errand-near-and-record
tags: [errand, near-snap, sampling, record, minifia-v3, d-02, d-04, d-08, leak-safe]
status: complete

requires:
  - phase: 15-01
    provides: "errand 단계·enterErrand·actErrand·nearestPlaceId·Player.errandPlaces/errandDone·me.errand"
provides:
  - "world.ts truncateSegment(seg, nowMs, horizonMs): 지금 위치에서 horizon 만큼만 남긴 짧은 구간(사칙·제곱근만)"
  - "errand.ts nearIdsOf·sampleErrand·nearSnapFrame: 근처 판정(경계 포함, 산 사람끼리)·1초 표본 목격 줄·본인 + 근처 snap(near: true). 역할을 읽지 않는다"
  - "audience: errand 의 산 mover → 본인 + 유령, worldVisibleTo: errand 의 산 viewer → 본인 한 칸"
  - "worker: snapFrameFor 한 곳(hello·snapEachViewer·snapNewGhosts), syncErrandView, runErrandTick(알람에 합침, 저장 한 번), afterTransition 의 errand 진입·이탈 snap"
  - "me.record: 토론 단계에서 3곳을 모두 처리한 산 본인에게만 {seat, place}[] (줄 0개여도 빈 배열), RecordLine·WorldFrame near 프로토콜"
affects: [15-03, 15-05, 15-06, 15-07, 15-08, 15-09, 15-10]

requirements-completed: [ERRAND-03, ERRAND-05]

actuals:
  tokens: 20000
  tasks: 2
  commits: 5

# commits 는 측정값: git log --grep='(15-02)' 216f83fe..HEAD (같은 시간대에 15-04 실행기가 다른 커밋을 같은 가지에 올려 rev-list 전체 개수와 다르다)
plan_head_before: 216f83fe8820ed3b6d8c30b427b3b76c7351e2e7
plan_head_after: 525961e7621a1d1f30ac15deca2d9835f420df40

tech-stack:
  added: []
  patterns:
    - "위치 전송은 사건(move)이 아니라 표본(snap): 근처 안 사람의 구간을 표본마다 잘라 보내고 표본에 없는 사람은 사라진 것으로 읽는다(클라이언트 15-05)"
    - "서버 전용 표본 상태(errandNear·errandSeen·errandTickAt)는 방 상태에 저장 — 알람이 깨우는 DO 가 메모리를 잃어도 이어진다. view 에 실리는 값이 없어 표본마다 state 를 방송하지 않고 저장만 한다"
    - "한 전환에 전체 snap 은 한 번: snapEachCount 로 syncHome 이 이미 보냈으면 진입·이탈 snap 을 건너뛴다"

key-files:
  created:
    - test/unit/errandNear.test.ts
    - test/worker/errandNear.test.ts
  modified:
    - shared/protocol.ts
    - shared/game/world.ts
    - shared/game/errand.ts
    - shared/game/audience.ts
    - shared/game/room.ts
    - shared/game/tick.ts
    - shared/game/discussion.ts
    - shared/game/night.ts
    - shared/game/view.ts
    - worker/room.ts
    - scripts/e2e/lib.mjs
    - test/unit/view.test.ts
    - test/unit/errand.test.ts
    - test/unit/testTools.test.ts
    - test/worker/leak.test.ts
    - test/worker/alarm.test.ts
    - test/worker/nightCatchup.test.ts

key-decisions:
  - "목격 줄의 장소는 '본 사람(B)에게 그 순간 가장 가까운 맵 후보 장소' — 내 목록 3곳에 한정하지 않는다(단서이지 증명이 아니다)"
  - "근처는 대칭이고 표본은 산 사람끼리만 센다. 거리는 고정소수점 유클리드 ≤ ERRAND_NEAR_R × UNIT(경계 포함)"
  - "errand 마감 전 알람은 errandTickAt 이 이르면 그 시각(nextWakeAt)에 걸린다 — 마감은 그대로 진입 + ERRAND_MS"
  - "알람 따라잡기로 늦게 errand 에 닿으면 errandTickAt 을 now + 1초로 옮긴다(진입 직후 snap 이 두 번 가지 않게)"
  - "snapFrameFor 는 보낼 좌석이 없는 단계(ended 등)에서 null 을 돌려 보내지 않는다 — 계획 문서의 반환형 WorldFrame 에서 null 만 더했다"

metrics:
  duration: 약 1시간 20분
  completed: 2026-11-07
---

# Phase 15 Plan 02: 근처 snap · 목격 표본 · me.record Summary

**errand 중 산 사람은 반경 3.0 안 사람의 위치만 받고(산 mover 의 move 는 본인·유령에게만, 나머지는 서버가 1초마다 각자에게 따로 보내는 1.5초로 자른 근처 snap), 같은 1초 표본이 "내 근처에 새로 들어온 사람 + 그 순간 그 사람에게 가장 가까운 장소" 목격 줄을 쌓아 3곳을 마친 사람의 토론 view 에만 me.record 로 싣는다. 근처 판정·표본은 역할을 읽지 않는다.**

## 한 일

- **Task 1 (순수 규칙)** — `test(15-02)` 시험 먼저, `feat(15-02)` 구현.
  - `truncateSegment`(ㄱ자 경로·horizon 안 위치 ±1·끝난/서 있는/t0 앞 구간은 한 점·입력 불변), `nearIdsOf`, `sampleErrand`(들어옴 감지·재진입 새 줄·`RECORD_MAX` 상한에서 멈춤·errand 아닌 단계는 입력 그대로), `nearSnapFrame`(본인은 `snapFrame` 과 같은 접기, 근처는 잘림, `near: true`).
  - `audience`·`worldVisibleTo` 의 errand 규칙, `nextWakeAt` 이 errand 의 `errandTickAt` 을 후보에 넣음, `enterErrand(state, randInt, at)`, `enterDiscussion` 이 `errandTickAt` 을 지우고 `enterNight` 이 `errandNear·errandSeen` 도 지움, `view.me.record`(필드별 복사), `RecordLine`·`MyInfo.record`·`WorldFrame.near`, `VIEW_ME_KEYS`·`ME_KEYS` 에 `record`.
- **Task 2 (서버 연결)** — `test(15-02)` 워커 통합 시험, `feat(15-02)` 서버.
  - `snapFrameFor`(errand 의 산 viewer 는 근처 snap, 그 밖은 `worldVisibleTo` 거른 `snapFrame`)를 `handleHello`·`snapEachViewer`·`snapNewGhosts` 가 공유, `syncErrandView`, `runErrandTick`(알람에서 advance·봇 뒤, reschedule 앞), `afterTransition` 의 진입(근처 snap)·이탈(전체 snap).
  - 새 무차별 방송 길이 없다: 근처 snap 도 `deliver` 한 명씩. `emitWorld(` 호출 수 6 그대로, 소켓 직접 쓰기는 `sendTo` 하나.

## 시험 결과

- 단위: `errandNear.test.ts` 31건(구간 자르기·근처 판정·목격 표본·근처 snap·errand 받는 사람·tick/청소·me.record) 통과. 인수 기준 묶음(`errandNear·view·audience·world·tick·errand·e2eContract`) 523 통과.
- 워커: `errandNear.test.ts` 7건(반경 밖 좌석 0 · 모든 소켓 snap 모양 동일 · 목적지 좌표 부재 · 들어옴/나감 · errandTickAt +1초와 방 알람 · 산 mover move 가 본인·유령에게만 · 목격 줄 하나/재진입 새 줄 · 3곳 처리한 본인에게만 me.record 이고 다른 사람 프레임에 `"record"` 없음 · 토론 이탈 전체 snap · 진입 근처 snap · hello 근처/유령 전원) — 연속 3회 통과.
- `npm run typecheck`: shared/·worker/·내 시험 파일 0 오류. (15-04 실행기가 올린 `hostLine.test.ts`·`errandView.test.ts` 의 타입 오류는 이 계획 범위 밖이다.)
- 전체 `npm test`: 247 파일 통과·7186 통과·1 실패(`continuity.test.ts` "옛 방장이 같은 토큰으로 돌아오면…" 5초 시간 초과). **이 실패는 15-02 이전 커밋(6995e289) 워크트리에서도 같은 시험이 똑같이 실패하는 기존 문제**라 건드리지 않고 `deferred-items.md` 에 적었다.
- 인수 기준: `truncateSegment` 1, `nearIdsOf|sampleErrand|nearSnapFrame` 3, errand.ts `.role` 0(주석 제외), `record` in lib.mjs 1 / view.test.ts 43, `runErrandTick|syncErrandView|snapFrameFor` 9, `sampleErrand` in worker 2, `emitWorld(` 6, `ws.send|.send(JSON` 1.
- 위생: 금지어 grep 에 새 적중 없음.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 알람 따라잡기로 errand 에 닿으면 snap 이 중복으로 감**
- **Found during:** Task 2 뒤 전체 시험(`nightCatchup.test.ts`: 소켓마다 snap 이 하나)
- **Issue:** `syncHome` 의 `snapEachViewer`(지금 단계 규칙 = 근처 snap) + `afterTransition` 의 진입 snap + 이미 지난 `errandTickAt` 으로 곧바로 도는 표본이 겹쳐 snap 이 3번 감.
- **Fix:** `snapEachCount` 로 `syncHome` 이 이미 전체 snap 을 보냈으면 진입·이탈 snap 을 건너뛰고, 늦게 닿은 `errandTickAt`(≤ now)은 `now + ERRAND_TICK_MS` 로 옮김.
- **Files modified:** worker/room.ts
- **Commit:** 525961e7

**2. [Rule 3 - Blocking] 기존 시험 기대값을 새 계약으로 갱신(느슨하게 하지 않음)**
- `test/unit/errand.test.ts` — `enterErrand` 세 번째 인자(at).
- `test/worker/alarm.test.ts` — errand 에서는 알람이 마감보다 이른 표본 시각(진입 + `ERRAND_TICK_MS`)에 걸린다. 마감 단언은 그대로.
- `test/worker/leak.test.ts` — world 허용 키에 `.near`(값 true 뿐) 를 이유 주석과 함께 더함. 산 좌석 검사는 그대로.
- `test/unit/testTools.test.ts` — `skipPhase` 와 정상 `tick` 비교에서 `errandTickAt` 도 마감처럼 시각에서 정해지는 값이라 `phaseEndsAt` 과 같이 뺌.
- `test/worker/nightCatchup.test.ts` — 따라잡기가 errand 에 닿으면(D-02) 산 사람의 snap 은 본인 + home 좌표상 근처 좌석이 기대값.

### 계획 대비 달라진 점

- `snapFrameFor` 반환형이 `WorldFrame` 이 아니라 `WorldFrame | null`(보낼 좌석이 없는 단계). 호출부 세 곳이 null 이면 보내지 않는다(기존 동작과 같다).
- RED 를 눈으로 확인하는 단계는 15-01 선례를 따라 구현 초안을 먼저 만들고 시험 커밋 → 구현 커밋 순으로 나눠 커밋했다.

## 이월 메모 (다음 계획용)

- **15-05 (클라이언트)**: `near: true` 인 snap 은 "표본에 없는 사람은 사라진 것" 으로 읽는다(새로 보이는 사람은 등장, 빠진 사람은 퇴장). 근처 사람의 구간은 지금(`t0 = snap at`)부터 1.5초 길이라 1초 간격 표본 사이에 끊기지 않지만, 마지막 꼭짓점에서 멈춘 모습이 보일 수 있다. `ERRAND_VIEW_HORIZON_MS`(phases.ts)만 고치면 된다. errand 에서 다른 산 사람의 `world.move` 는 오지 않으니 낮 단계의 move 로 위치를 갱신하던 코드는 errand 에서 본인 move 만 받는다.
- **15-03 / 15-07 (me.record 소비)**: 토론에서 `me.record` 는 `{seat, place}[]`(시간순, 상한 6)이고 키 자체가 없으면 "못 마침/유령/다른 단계" 다. 같은 낮의 지목 등 이후 토론 단계에도 `errandDone` 이 남아 있어 record 가 계속 실린다(밤 진입에서 지움).
- **15-06/09**: errand 중 알람이 1초마다 깬다(표본). 상태 저장은 표본당 한 번(40회/낮). E2E 가 알람 시각을 단정한다면 errand 에서는 마감이 아니라 `errandTickAt` 이다.
- **15-10 (결정 0074)**: ① 위치 전송은 사건이 아니라 표본 ② 목격 줄 장소는 B 에게 가장 가까운 맵 후보 ③ 근처 대칭·산 사람끼리·경계 포함 ④ 표본 상태는 방 상태에 저장(`errandNear·errandSeen` Player, `errandTickAt` RoomState) ⑤ 늦게 닿은 첫 표본은 `now + 1초`.
- **기존 문제(범위 밖)**: `test/worker/continuity.test.ts` "옛 방장이 같은 토큰으로 돌아오면…" 가 baseline 에서도 5초 시간 초과(`deferred-items.md`). `test/worker/bots.test.ts` 일부 시험은 병렬 실행기 부하 때 간헐 실패(단독 연속 8회·5회는 통과) — 15-02 이전 baseline 8/8 통과, 이후 단독 연속 실행에서 일부 실행이 한 번씩 실패한 적이 있어 시간 민감 시험(계획 단계 `at` 이 곧 지나감)이 알람 빈도에 영향받을 가능성은 남아 있다. 15-06 전체 회귀에서 다시 보라.

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크 표면은 기존 `world` 프레임의 `near` 표시 하나이고 T-15-05~08 완화(받는 사람 집합·근처 snap·구간 자르기·record 키 조건·역할 미참조 grep)를 시험이 고정한다.

## Self-Check: PASSED

- 파일: shared/game/errand.ts(`truncateSegment`는 world.ts), test/unit/errandNear.test.ts, test/worker/errandNear.test.ts FOUND
- 커밋: 31067f32, 80157f9f, 3d518325, 1cda6950, 525961e7 FOUND
