---
phase: 09-night-morning
plan: "09"
subsystem: server-room-do
tags: [night-leak, home-memory, after-transition, world-snap, tdd, tracer]
status: complete

requires:
  - phase: 09-night-morning
    provides: worldVisibleTo 밤 분기 (09-03), captureHome·teleportHome·HomeMemo (09-04), 아침 morning.eliminated (09-07)
provides:
  - 방 DO afterTransition(now) — 단계 마감·토론 끝내기·테스트 넘기기가 모두 지나는 전환 뒤처리 한 곳
  - captureHomeNow() — 그날 첫 비걷기 지도 단계에서 captureHome 후 즉시 flushWorld
  - syncHome(now) — 키 '{일차}:night'·'{일차}:morning' 비교로 멱등인 home 순간이동 + 보는 사람 한 명씩 snap
  - 시험 도우미(export) observe·stable·VOLATILE·moveAs·pickAs·snapSeatsOf·homeBySeat·segEndsBySeat
  - test/worker/nightLeak.test.ts (09-16 이 구간 A/B 메타모픽을 같은 파일에 더한다)
affects: [09-10, 09-12, 09-14, 09-16, 09-17]

actuals:
  tokens: 8100
  tasks: 3
  commits: 6
plan_head_before: ff13f3096467af0f261123e23c50edefc8deb3fc
plan_head_after: 3cbb944d20ca0a23f14248fedc15d323b3168b72

tech-stack:
  added: []
  patterns:
    - "위치 동기화는 단계 전환 이벤트가 아니라 지금 단계 키와 world.lay.key 비교로 멱등 — 알람 따라잡기·퇴거에 안전"
    - "보내는 길은 새로 만들지 않는다: 소켓마다 worldVisibleTo 로 거른 snapFrame 을 deliver 한 명씩"
    - "home 기록은 지목 배치(syncLayout)보다 먼저, 기록 즉시 flushWorld (디바운스에 기대지 않음)"

key-files:
  created:
    - test/worker/nightLeak.test.ts
  modified:
    - worker/room.ts
    - test/worker/helpers.ts
    - test/worker/world.test.ts
    - test/worker/ghostLeak.test.ts
    - test/worker/night.test.ts

key-decisions:
  - "advance 의 무변화 경로(단계가 안 바뀐 알람·메시지 앞 따라잡기)는 syncHome·syncLayout 만 부르고 snapNewGhosts 는 전환 때만 부른다 — 계획의 syncPositions 통째 호출은 퇴거 뒤 ghostSnapped 가 비어 깨어날 때마다 유령에게 같은 snap 을 다시 보내는 회귀를 만든다"
  - "morning 순간이동 대상은 산 사람 + room.morning.eliminated 좌석의 사람. 피해자는 아침 snap 으로 ghostSnapped 에 올라 snapNewGhosts 가 같은 snap 을 두 번 보내지 않는다 (가정 A3)"
  - "lay.key 를 밤·아침 키로 덮어쓰되 lay.slots 는 그대로 둔다 (가정 A2, 다음 날 '{일차+1}:ring' 과 안 겹침)"

requirements-completed: [NIGHT-07]

metrics:
  duration: 약 40분
---

# Phase 9 Plan 09: 밤·아침 home 기억과 위치 동기화 (방 DO) Summary

방 DO 의 전환 뒤처리를 afterTransition 하나로 합치고, 그날 첫 비걷기 지도 단계에서 각자 토론이 끝난 자리를 기록·즉시 저장하며, 밤에는 시민 편 소켓에 본인 한 칸 snap, 아침에는 산 사람 소켓 모두에 같은 home snap 을 보낸다.

## 한 일

- **Task 1 (트레이서)**: applyEndDiscussion·handleTestSkip·advance 의 복제된 뒤처리를 afterTransition(`captureHomeNow` → 저장·방송 → `syncPositions` → reschedule)으로 합침. 밤 진입에서 산 사람 전원을 home 으로 순간이동하고 시민·경찰·의사 소켓엔 본인 한 칸(home), 마피아엔 산 사람 여섯, 유령엔 전원 snap. DO 퇴거 뒤에도 home 유지.
- **Task 2**: 아침 키 분기 — 산 사람 + 피해자 home 으로 되돌려 마피아 걸음 폐기, 산 사람 다섯 소켓 snap 이 stable() 비교로 동일, 피해자는 여섯 좌석 snap 정확히 하나. 토론에서 지목·밤을 건너뛴 한 번의 알람 따라잡기에서도 아침 위치가 home. 직접 불변식 L1(밤 마피아 move×3·pick·chat·typing 동안 비마피아 네 소켓 `[]`).
- **Task 3**: testSkip·토론 끝내기 과반 경로 동일성, 밤·아침 중간 hello 첫 프레임 열 [state, world snap, chatLog] 과 좌석 규칙(L9).

## TDD 기록

- **RED 1** (7ec83ba): nightLeak 트레이서 3건 + world.test home 1건 실패. 실패 지점은 모두 계획 단언(home `none`, 밤 world 프레임 0개). semanticAssessment: 대상 시험이 실제로 실행되어 계획한 단언에서 실패, 문법·픽스처 오류 아님.
- **GREEN 1** (6de1a2f): afterTransition·밤 분기. (아침 분기는 Task 2 RED 가 먼저 오도록 일부러 뺐다.)
- **RED 2** (0509ca5): 아침 3건 + ghostLeak 새 기대값 실패(마피아 걸음 좌표가 아침 snap 에 남음, 아침 snap 없음 `none`). L1 은 09-03 의 audience 규칙으로 이미 초록(회귀 방지 시험, 의도한 "미리 초록").
- **GREEN 2** (5f6d3c6): 아침 분기.
- **Task 3 시험** (29413bb): 세 경로·재접속 시험은 afterTransition·syncHome 이 이미 있어 처음부터 초록. 시험이 실제로 경로를 잡는지 handleTestSkip 을 옛 코드로 되돌리는 변이로 확인(실패 확인 후 복구).
- 리팩터 커밋 없음. 별도 `fix` 커밋(3cbb944) 1건.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] advance 무변화 경로의 중복 유령 snap**
- **Found during:** Task 3 (worker 전체 실행)
- **Issue:** 계획대로 무변화 경로에서 syncPositions(= snapNewGhosts 포함)를 부르면, 퇴거로 비워진 ghostSnapped 때문에 깨어난 뒤 첫 메시지·알람마다 유령 소켓에 같은 world snap 이 다시 간다. trial.test "유령의 토론 끝내기는 BAD_MESSAGE" 가 `[world,error,...]` 로 깨져 드러남.
- **Fix:** 무변화 경로는 `syncHome` + `syncLayout` 만. snapNewGhosts 는 afterTransition 에서만.
- **Files modified:** worker/room.ts
- **Commit:** 3cbb944

**2. [Rule 1 - 기대값 갱신] night.test 마감 뒤 pick**
- 아침 진입에서 산 사람 소켓 모두가 snap 을 받으므로 기대 열이 `[state:morning,world,error:WRONG_PHASE,state:morning]`(보낸 쪽)·`[state:morning,world]`(나머지)로 바뀜 (계획이 지목한 "옛 기대 단언" 갱신, 건너뛰기 없음).
- **Commit:** 3cbb944

**3. [계획 순서 조정]** Task 1 GREEN 에 아침 분기를 넣지 않고 Task 2 에서 더했다 — 아침 기대값 변화(ghostLeak)가 Task 2 RED 에 속해야 RED 가 의미를 갖기 때문.

## Known Stubs

없음.

## Threat Flags

없음 — 새 전송 길 없음(deliver 한 명씩 + worldVisibleTo). T-09-17~20 mitigate: 밤 snap 좌석 시험, 아침 stable 동일 시험, 퇴거 유지 시험, 세 경로 시험으로 덮음.

## 검증

- `npm run typecheck` 통과
- `--project unit --project client` 117 파일 3523 통과
- `--project worker` 23 파일: 단독 실행 전부 통과. 전체 병렬 실행에서 `testTools.test.ts` 의 ended 시험(testSkip·testReset, driveToEnded 10초 nextFrame 한도)이 부하 때 가끔 실패한다 — 이월 메모의 기존 불안정(9페이즈 이전 커밋에서도 동일). 파일 단독·재실행에서는 초록.
- `.skip(`/`.todo(` 0건.

## Self-Check: PASSED

- worker/room.ts afterTransition 호출 4곳(정의 1 + advance·applyEndDiscussion·handleTestSkip), teleportHome·captureHome·":night" 키 확인
- test/worker/nightLeak.test.ts 존재, 커밋 7ec83ba·6de1a2f·0509ca5·5f6d3c6·29413bb·3cbb944 모두 HEAD 조상
