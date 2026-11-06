---
phase: 07-free-chat
plan: "09"
subsystem: wire-protocol
tags: [removal, claimLog, protocol, view, leak-test, vitest, fixtures]

requires:
  - phase: 07-free-chat
    provides: "07-08 이 claim 단계를 서버·와이어에서 걷어내고 DayView.claimLog 를 언제나 빈 배열로 남겨 두었다"
provides:
  - "와이어에 주장 기록이 없다: DayView 에 claimLog 키가 없고 Claim·ClaimLogEntry 타입이 protocol 에서 사라졌다"
  - "buildDay 의 day 는 n·roles·voteLog 와 단계별 키(execTally·candidate·execution·noExecution·morning)만 싣는다"
  - "누설 검사의 역할 단어 허용 경로가 me.role·day.roles[] 둘로 좁아졌다(day.claimLog[].claim 삭제). 금지 키·서버 전용 키 목록은 그대로"
  - "화면 시험 픽스처·도우미 어디에도 claimLog 키가 없다"
affects: [07-10, 07-11, 07-12]

actuals:
  tokens: 8800
  tasks: 2
  commits: 2
  plan_head_before: 48878590626af45070066284adb13548198422a4
  plan_head_after: 2f72f7db1cab9d2f0f22ca72dc01a8c160c6974c

tech-stack:
  added: []
  patterns:
    - "와이어 키를 지울 때는 타입 선언 삭제로 두 tsc 가 남은 사용처를 알려 주게 하고, 픽스처는 줄 단위 치환(들여쓰기 보존)으로 한 번에 지운다"

key-files:
  created: []
  modified:
    - shared/protocol.ts
    - shared/game/view.ts
    - test/unit/view.test.ts
    - test/unit/execution.test.ts
    - test/unit/gameRoom.test.ts
    - test/worker/leak.test.ts
    - test/worker/vote.test.ts
    - test/worker/day.test.ts
    - test/worker/alarm.test.ts
    - test/helpers/verdictViews.ts
    - test/client/nightScene.test.tsx

key-decisions:
  - "claimLog 가 사라진 뒤 그 빈 배열을 단언하던 시험(view.test 의 '주장 줄' describe 한 블록 등)은 단언 대상이 없어 통째로 지웠다 — 키 부재는 day 키 목록 검사가 대신 지킨다"
  - "저장 방 정규화(room.ts)와 그 시험이 보는 claimLog 는 와이어가 아니라 옛 저장 상태 키라 그대로 둔다"

requirements-completed: [CHAT-06]

coverage:
  - id: D1
    description: "protocol 의 Claim·ClaimLogEntry·DayView.claimLog 와 buildDay 의 claimLog 가 없다"
    requirement: CHAT-06
    verification:
      - kind: unit
        ref: "test/unit/view.test.ts#dayAnnounce·discussion·night·morning 의 day 키는 n,roles,voteLog(...)"
        status: pass
      - kind: other
        ref: "npx tsc -p tsconfig.worker.json --noEmit && npm run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "누설 검사의 허용 경로에서 day.claimLog[].claim 만 빠져 허용 범위가 좁아졌고 금지 키·서버 전용 키 목록은 그대로다"
    requirement: CHAT-06
    verification:
      - kind: integration
        ref: "test/worker/leak.test.ts, test/worker/vote.test.ts (ROLE_PATHS_ALIVE), test/unit/view.test.ts, test/unit/execution.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "화면 시험 픽스처·도우미에서 claimLog 키가 사라지고 전체 vitest·빌드가 초록이다"
    requirement: CHAT-06
    verification:
      - kind: other
        ref: "npx vitest run (137 files, 3673 passed) && npx vite build"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-11-01
status: complete
---

# Phase 7 Plan 09: 와이어 claimLog 제거 Summary

**DayView.claimLog·ClaimLogEntry·Claim 을 와이어에서 지우고, 역할 단어 허용 경로를 me.role·day.roles[] 둘로 좁힌 채 서버 시험 단언과 화면 시험 픽스처의 claimLog 키를 한 번에 정리했다**

## Performance

- **Duration:** 약 5분
- **Started:** 2026-11-01T13:43:36Z
- **Completed:** 2026-11-01T13:46:17Z
- **Tasks:** 2
- **Files modified:** 29 (소스 2, 시험 27)

## Accomplishments

- `shared/protocol.ts` 에서 `Claim`, `ClaimLogEntry`, `DayView.claimLog` 를 지웠다. `buildDay` 는 claimLog 를 싣지 않는다.
- 누설 검사: `.day.claimLog[].claim` 허용 경로를 view.test·execution.test·leak.test·vote.test 에서 뺐다. `SERVER_ONLY_KEYS`·`FORBIDDEN_KEYS` 는 손대지 않았다.
- day 키 목록 기대값(view.test·execution.test·day.test)에서 claimLog 를 뺐고, claimLog 빈 배열 단언은 지웠다.
- 화면 시험 19개 파일의 `claimLog: []` 를 지웠고 nightScene makeView 의 claimLog 매개변수와 `ClaimLogEntry` import 를 걷어냈다.
- 검증: unit·worker 2082 통과, 전체 vitest 3673 통과(137 파일), 두 tsc 0 오류, vite build 성공, `.skip(`·`.todo(` 0건.

## Task Commits

1. **Task 1: 와이어에서 claimLog·ClaimLogEntry·Claim 지우기와 서버 시험 단언 정리** - `af4552a` (feat)
2. **Task 2: 화면 시험 픽스처의 claimLog 키 정리** - `2f72f7d` (test)

**Plan metadata:** 이 SUMMARY 와 함께 커밋 (docs: complete plan)

## Files Created/Modified

- `shared/protocol.ts` - Claim·ClaimLogEntry·DayView.claimLog 삭제
- `shared/game/view.ts` - buildDay 에서 claimLog 키와 주석 삭제
- `test/unit/view.test.ts` - 허용 경로·DAY_KEYS·day 키 목록 갱신, claimLog 빈 배열 단언 삭제(07-08 주장 줄 describe 한 블록 포함)
- `test/unit/execution.test.ts`, `test/worker/leak.test.ts`, `test/worker/vote.test.ts` - 허용 경로 축소
- `test/unit/gameRoom.test.ts`, `test/worker/day.test.ts`, `test/worker/alarm.test.ts` - view 의 claimLog 단언 삭제
- `test/helpers/verdictViews.ts`, `test/client/*.test.tsx`(19개) - 픽스처의 claimLog 키 삭제

## Decisions Made

- 빈 배열만 단언하던 시험은 대상 키가 없어져 지웠다. 키가 다시 생기는 회귀는 day 키 목록 검사(view.test·execution.test)가 잡는다.
- 저장 방 정규화가 지우는 옛 상태 키 `claimLog` 는 와이어 키가 아니라서 그 시험을 남겼다(아래 편차 2).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] test/worker/alarm.test.ts 가 DayView.claimLog 를 읽어 워커 tsc 가 실패했다**
- **Found during:** Task 1
- **Issue:** alarm.test.ts 218행이 `first.view.day?.claimLog` 를 읽는다. files 목록에 없어서 타입 삭제 뒤 TS2339 가 났다.
- **Fix:** 그 단언을 `phase:n` 만 보는 것으로 줄이고, 응답 JSON 에 "claimLog" 문자열이 없다는 단언을 더했다. 옛 저장 방 정규화 단언(키 다섯이 저장 객체에서 빠짐)은 그대로다.
- **Files modified:** test/worker/alarm.test.ts
- **Verification:** `npx tsc -p tsconfig.worker.json --noEmit`, `npx vitest run --project unit --project worker` 초록
- **Committed in:** af4552a

### 계획 기준과의 차이 (기록)

**2. Task 1·2 인수 기준 grep 이 문면 그대로는 5곳에 걸린다.** 기준의 제외 목록은 room.ts·gameRoom.test.ts·alarm.test.ts 셋이지만, 같은 종류(옛 저장 방 상태 키가 정규화에서 빠지는지 보는 시험)인 다섯 곳이 더 남았다: test/unit/nyquist-03.1-multiday.test.ts:68, test/unit/testTools.test.ts:292·294·297, test/unit/tick.test.ts:296, test/worker/testTools.test.ts:322. 모두 저장 객체의 옛 키 부재를 단언하는 것이라 와이어와 무관하고, 지우면 07-08 정규화의 회귀 방어가 줄어든다. 그래서 남겼다. 와이어 쪽 `DayView.claimLog`·`ClaimLogEntry`·`Claim` 참조는 shared·worker·src 에 0건이다.

**3. 계획의 view.test 줄 번호보다 단언이 더 있었다.** view.test 에 day 키 목록 단언이 네 곳 더(`claimLog,n,roles,voteLog` 문자열) 있어 함께 고쳤다. 누설 검사 목록은 줄이지 않았다.

---

**Total deviations:** 1 auto-fixed (Rule 3), 2 기록
**Impact on plan:** 범위 확장 없음. alarm.test.ts 한 줄이 추가됐다.

## Issues Encountered

- 첫 픽스처 치환(perl 한 번에 `\s*` 사용)이 줄바꿈과 다음 줄 들여쓰기를 삼켜 들여쓰기가 흐트러졌다. 커밋 전에 diff 로 발견해 되돌리고, 줄 단위 치환(줄 전체가 `claimLog: [],` 면 줄 삭제, 한 줄 모양은 `, claimLog: []` 등만 삭제)으로 다시 했다.

## Known Stubs

없음. (`TEMPLATE_IDS` 의 claimRole·claimNone 과 chat.ts·protocol.ts 주석 속 낱말 claimLog 는 07-11·07-12 몫이다.)

## Threat Flags

없음. T-07-17 은 허용 경로 축소로 완화했다(금지 키·서버 전용 키 목록 불변).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 와이어 계약이 주장 기록 없이 시작한다. 07-10 이후는 빠른 메시지·이모티콘 제거(07-11, 07-12 의 TEMPLATE_IDS·chat.ts 주석 정리)로 이어진다.
- 블로커 없음.

## Self-Check: PASSED

- 커밋 `af4552a`, `2f72f7d` 가 HEAD 의 조상임을 확인했다.
- `Claim`·`ClaimLogEntry`·`DayView.claimLog` 참조가 shared·worker·src 에 없음을 `git grep` 으로 확인했다.
- `SERVER_ONLY_KEYS`·`FORBIDDEN_KEYS` 가 leak.test.ts 에 남아 있다.

---
*Phase: 07-free-chat*
*Completed: 2026-11-01*
