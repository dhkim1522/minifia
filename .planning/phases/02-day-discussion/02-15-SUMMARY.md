---
phase: 02-day-discussion
plan: 15
subsystem: day-discussion-server-wire
tags: [remove-host-controls, wire-contract, tdd, gap-closure, decision-0017-5]
gap_closure: true
gap_ids: [G-02-1]
status: complete

requires:
  - phase: 02-day-discussion
    provides: 02-12 의 채팅 방송 프레임(chat)·messages 비저장 전환, 결정 0017-5·0017-7
provides:
  - extend·skip 이 빠진 ClientMessageSchema — 옛 탭이 보내도 BAD_MESSAGE 만 돌아오고 상태는 그대로
  - 단계 표 길이만 돌려주는 phaseDurationOf (shared/game/discussion.ts 의 유일한 export)
  - extend·skip·연장 중복 오류 코드·DayView.extendUsed 가 없는 와이어 계약(shared/protocol.ts)
  - extendUsed·messages 선언이 없는 RoomState, 일차만 올리는 enterDayAnnounce
  - 방장 줄·연장 토스트가 없는 DiscussionControls (말하기 줄·쿨다운·오류 처리 유지)
affects: [02-16, 02-17, 02-18]

requirements-completed: [DAY-01]

actuals:
  tokens: 7645
  tasks: 3
  commits: 6
plan_head_before: 19ca6905fcb2ac5aa2223450df8c23bf2c19674b
plan_head_after: 7deecdf0078b222c043706c14c5119075434aa53

tech-stack:
  added: []
  patterns:
    - "옛 저장 방·옛 탭 호환은 타입 선언이 아니라 키 이름으로만 다룬다 — 테스트 픽스처는 단언 캐스트로 옛 키를 넣고 Object.keys 로 확인한다"
    - "DOM 노드를 단언 대상으로 넘기지 않는다(toBeNull 이 노드 전체를 쏟아 TAP 이 깨진다) — 개수·문자열 스칼라로 단언한다"

key-files:
  created: []
  modified:
    - shared/schemas.ts
    - shared/protocol.ts
    - shared/game/discussion.ts
    - shared/game/phases.ts
    - shared/game/view.ts
    - shared/game/room.ts
    - shared/game/tick.ts
    - worker/room.ts
    - src/components/DiscussionControls.tsx
    - test/worker/day.test.ts
    - test/worker/helpers.ts
    - test/client/discussion.test.tsx
    - test/unit/discussion.test.ts
    - test/unit/view.test.ts
    - test/unit/tick.test.ts

key-decisions:
  - "extend·skip 은 스키마에서 빠져 BAD_MESSAGE 가 된다 — 별도 오류 코드·핸들러를 두지 않는다 (결정 0017-5)"
  - "phaseDurationOf 는 지우지 않고 단계 표 길이를 돌려주는 한 줄 함수로 남겼다 — 뷰가 길이를 한 곳에서 얻는 구조를 3·4페이즈가 이어 쓴다"
  - "plus·skip 아이콘과 옛 저장 방의 extendUsed 값은 지우지 않았다 (읽는 곳이 없어 해가 없고 되돌리기 쉽다, 계획 재량)"

duration: 약 9분
completed: 2026-10-24
---

# Phase 2 Plan 15: 방장 연장·넘기기 제거 Summary

**방장 전용 +30초 연장과 넘기기를 화면·서버 핸들러·입력 스키마·와이어 계약·방 상태·규칙 함수에서 모두 없애, extend·skip 을 소켓으로 보내면 BAD_MESSAGE 만 돌아오고 단계·마감·알람이 그대로이며 낮 토론은 서버 타이머대로만 끝난다 (결정 0017-5).**

## 수행 내용

- **Task 1 (트레이서, 결정 0017-5)**: `ClientMessageSchema` 에서 extend·skip 변형을 지우고, `worker/room.ts` 의 두 case·두 핸들러·discussion 모듈 import 를 지웠다. `DiscussionControls` 에서 방장 줄 마크업, 연장 사용·넘기기 중 상태, 연장 토스트 효과와 문구 상수, plus·skip 아이콘 사용을 지우고 머리 주석의 쿨다운 설명을 "보낸 순간 + 2초, 서버 한도 1.8초(G-02-2)" 로 고쳤다. 워커 통합 테스트는 방장·손님 모두 extend·skip 에 error BAD_MESSAGE 만 받고(state 프레임 없음, 다른 소켓에는 아무 프레임도 가지 않음), 저장된 `phase:phaseEndsAt:day` 와 알람이 불변임을 고정한다. 타이머대로 dayAnnounce 로 넘어가는 "방장이 끊겨 있어도" 테스트는 남겼다. 클라이언트 테스트는 방장에게도 연장·넘기기·이미 연장했어요 버튼이 없고 `.mf-discuss__host` 가 없으며 옛 서버가 연장 표시를 보내도 토스트가 없음을 고정한다.
- **Task 2 (결정 0017-5)**: `extendDiscussion`·`skipDiscussion`·`DiscussionError`·`EXTEND_MS` 를 지우고 `phaseDurationOf` 는 `PHASE_DEFS[phase].durationMs` 를 돌려준다. `buildDay` 의 discussion 분기(extendUsed)는 남는 것이 없어 지웠다. 단위 테스트는 길이 표(discussion 90000, claim 15000, claimReveal 2000, dayAnnounce 2000, lobby null), 옛 extendUsed 가 있어도 90000, 모듈 export 가 phaseDurationOf 하나, EXTEND* 이름 없음, 뷰 day 키 목록(discussion·claimReveal `claims,n,roles` / claim `claimDone,n,roles`)을 고정한다.
- **Task 3 (결정 0017-5·0017-7)**: `ClientMessage` 의 extend·skip, `WsErrorCode` 의 연장 중복 코드, `DayView.extendUsed` 를 지웠다(`DayView.messages` 는 02-16 이 지울 때까지 남김, `NOT_HOST` 는 시작·내보내기용으로 유지). `RoomState` 의 extendUsed·messages 선언과 ChatLine import 를 지웠고 `nextMessageSeq` 는 남겼다. `enterDayAnnounce` 는 `{ ...state, day: (state.day ?? 0) + 1 }` 만 돌려준다. 테스트의 `StoredRoom` 선언도 정리했다.

## TDD 게이트

세 태스크 모두 RED(`test(02-15)`) 커밋이 GREEN(`feat(02-15)`) 보다 먼저다. RED 증거는 `gsd_run check tdd-red-evidence` 로 검증해 모두 `RED_EVIDENCE_OK`.

| Task | RED | GREEN | RED 의미 평가 |
| --- | --- | --- | --- |
| 1 | 9f4c0f0 | ee47a31 | 대상 `extend·skip 뒤에도 알람은 원래 마감 그대로다` 가 BAD_MESSAGE error 프레임이 오지 않아 `nextFrame` 시간 초과로 실패(extend 가 아직 스키마를 통과해 error 대신 state 가 옴). 클라이언트 두 테스트는 `+30초 연장` 버튼과 연장 토스트가 실제로 있어 단언 실패. 셋업·임포트 결함 아님 |
| 2 | 386ccb8 | bc8644c | 대상 `옛 상태에 연장 표시가 남아 있어도 discussion 길이는 90000 이다` 가 값 단언(기대 90000, 실제 120000)에서 실패. 모듈 export·EXTEND 이름·뷰 day 키 목록 테스트도 의도한 이유로 실패 |
| 3 | c5a4a47 | 7deecdf | 대상 `enterDayAnnounce: … 결과에 messages·extendUsed 키가 없다` 가 훅이 두 키를 만들어 키 부재 단언(false 기대, true 실제)에서 실패 |

REFACTOR 커밋은 없다.

## 커밋

| 커밋 | 내용 |
| --- | --- |
| 9f4c0f0 | test(02-15): extend·skip 은 BAD_MESSAGE, 방장 줄·연장 토스트 없음 (RED) |
| ee47a31 | feat(02-15): 스키마·핸들러·방장 줄·연장 토스트 삭제 (GREEN) |
| 386ccb8 | test(02-15): phaseDurationOf 표 길이·뷰 day 에 extendUsed 없음 (RED) |
| bc8644c | feat(02-15): 연장 규칙 함수·상수 삭제, phaseDurationOf 단순화 (GREEN) |
| c5a4a47 | test(02-15): 진입 훅이 messages·extendUsed 키를 더하지 않음 (RED) |
| 7deecdf | feat(02-15): 와이어 계약·방 상태·진입 훅 정리 (GREEN) |

`commits: 6` 은 `git rev-list --count 19ca690..HEAD` 로 잰 값이다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RED 보고서가 TAP 으로 읽히지 않아 클라이언트 단언을 스칼라로 변경**
- **Found during:** Task 1 RED
- **Issue:** `expect(screen.queryByRole(...)).toBeNull()` 이 실패하면 DOM 노드 전체(여러 줄)를 보고서에 쏟아 `tdd-red-evidence` 가 `Non-TAP data in report` 로 `INVALID_RED` 를 냈다.
- **Fix:** 버튼 라벨 문자열에 정규식 `.test()` 결과, 요소 개수, `queryAllByRole(...).length` 를 단언하도록 바꿨다. 검사 내용은 같다.
- **Files modified:** test/client/discussion.test.tsx
- **Commit:** 9f4c0f0 (RED 커밋 이전에 고침)

**2. [Rule 3 - Blocking] tick.test.ts 의 EXTEND_MS 단언 삭제를 Task 2 로 당김**
- **Found during:** Task 2 GREEN
- **Issue:** `test/unit/tick.test.ts` 가 `EXTEND_MS` 를 import 해 값(30000)을 단언했다. 상수를 지우자 PHASE_DEFS 테스트가 실패하고 typecheck 가 깨졌다(계획은 이 파일을 Task 3 몫으로만 적었다).
- **Fix:** 해당 import 와 단언 한 줄을 Task 2 GREEN 커밋에서 지웠다. Task 3 의 messages·extendUsed 수정은 그대로 Task 3 에서 했다.
- **Files modified:** test/unit/tick.test.ts
- **Commit:** bc8644c

**Total deviations:** 2 auto-fixed (Rule 3 2건). **Impact:** 동작·범위 변화 없음.

## 남겨 둔 것 (다음 계획 몫)

- `src/styles/day.css` 의 `.mf-discuss__host` 규칙 두 줄은 쓰는 곳이 없어졌지만 남겼다. Task 3 의 불변 조건(`src/styles` 무변경)이 있어서다. 02-17 이 하단 패널 CSS 를 다시 쓸 때 지운다.
- `scripts/smoke.mjs`(448행 부근)·`scripts/uat-day.mjs` 는 아직 extend·skip 을 보내고 연장 오류 코드를 기대한다. 02-18 이 타이머를 기다리게 바꾼다(배포 전까지 이 스크립트를 돌리면 실패한다).
- `DayView.messages` 타입과 그것을 읽는 `src/net/seatFloats.ts`·`src/screens/DayScene.tsx` 는 02-16. 결정 0016 문서·ROADMAP 성공 기준 2·REQUIREMENTS DAY-01 문구 정정은 02-18.
- `Icon.tsx` 의 plus·skip 아이콘은 계획대로 남겼다.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크 경로·신뢰 경계 변화 없음. 계획의 완화 항목을 테스트로 고정했다.

- T-02-42: 방장·손님의 extend·skip 이 BAD_MESSAGE 이고 `phase:phaseEndsAt:day`·알람이 불변임을 워커 통합 테스트로 고정.
- T-02-43: 옛 탭의 extend·skip 은 상태 변화 없이 오류만 받고, 화면은 서버 state 를 그대로 따른다(옛 연장 표시가 와도 토스트·버튼 없음).
- T-02-SC: 새 패키지 설치 없음.

## 검증

- `npx vitest run` — 56 파일 1045 테스트 통과
- `npm run typecheck` — 통과
- 수락 기준: schemas 의 extend/skip 리터럴 0, `handleExtend|handleSkip` 0, `mf-discuss__host`(주석 밖 tsx) 0, `결정 0017-5` day.test 2, `.extendUsed` 읽기 0, discussion.ts 의 extend/skipDiscussion 0, phases.ts EXTEND_MS 0, view.ts extendUsed 0, `claims,n,roles` 3 / `claimDone,n,roles` 2, 연장 중복 오류 코드 shared·src·worker·test 0 파일, protocol 의 `t: "extend|skip"` 0, enterDayAnnounce 의 messages|extendUsed 0, room.ts 선언 0, 전체 `.(messages|extendUsed)` 속성 읽기 0, helpers.ts 선언 0
- 불변: `git diff --quiet 19ca690 -- src/screens src/net src/styles scripts` exit 0
- 브라우저·배포본에서는 열어 보지 않았다(서버·계약 정리이고 화면 모양 변경은 02-17, 배포 확인은 02-18).

## Self-Check: PASSED

- FOUND: .planning/phases/02-day-discussion/02-15-SUMMARY.md 의 변경 파일 15개 모두 HEAD 에 반영
- FOUND: 9f4c0f0, ee47a31, 386ccb8, bc8644c, c5a4a47, 7deecdf (HEAD 의 조상)
- test(02-15) 커밋이 각 feat(02-15) 보다 먼저
