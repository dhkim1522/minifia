---
phase: 07-free-chat
plan: "08"
subsystem: server-wire
tags: [removal, claim, phase-table, tick, normalize, bots, vitest, durable-object]

requires:
  - phase: 07-free-chat
    provides: "07-04 가 화면의 주장 장치를, 07-07 이 claim 단계 이름을 쓰던 seatFloats 를 먼저 지워 화면 쪽 남은 일이 단계 이름표 몇 줄뿐이었다"
provides:
  - "낮 시작 발표(dayAnnounce 2초) 마감 다음이 바로 낮 토론(discussion)이고 마감은 이전 마감 + DISCUSSION_MS 로 이어진다"
  - "PhaseId·PHASE_DEFS·tick 훅·buildView(turn)·봇 계획·와이어(ClientMessage claim, DayView.turn, ClaimTurn)·DO 처리기·RoomState 차례 상태에서 claim 이 없고 shared/game/claim.ts 가 없다"
  - "{t:'claim'} 메시지는 스키마가 BAD_MESSAGE 로 거부한다"
  - "normalizeStoredRoom 이 claim 으로 저장된 방을 discussion(now + DISCUSSION_MS)으로 옮기고 claimOrder·claimIdx·claimStart·claimPick·claimLog 를 어느 단계에서든 키째 지운다"
  - "DayView.claimLog 는 언제나 빈 배열(키 제거는 07-09), 누설 검사의 서버 전용 키 목록은 그대로"
affects: [07-09, 07-11, 07-12, 07-13, 08-day-07]

actuals:
  tokens: 30800
  tasks: 3
  commits: 5
  plan_head_before: d71ef95f2b70a1b4e56228c6248cfbbc52b0a8f2
  plan_head_after: 9dd34eaf07ec746bcd0bf3fbe62036dd1f58bdd1

tech-stack:
  added: []
  patterns:
    - "단계를 지울 때는 PhaseId 에서 빼고 LEGACY_PHASES 에 옛 이름을 올려 저장 방을 정규화 한 곳에서 옮긴다(claimReveal 이전과 같은 방식)"
    - "옛 서버 상태 키는 정규화에서 지역 교차 타입 구조 분해로 뺀다 — RoomState 필드 선언이 사라져도 컴파일되고, 어느 단계에 남았든 지운다"
    - "시드 고정 값 시험은 난수 호출 순서가 바뀐 이유를 이름에 적고, 호출 횟수 시험을 짝으로 둔다"

key-files:
  created: []
  deleted:
    - shared/game/claim.ts
    - test/unit/claim.test.ts
  modified:
    - shared/protocol.ts
    - shared/schemas.ts
    - shared/game/phases.ts
    - shared/game/tick.ts
    - shared/game/view.ts
    - shared/game/room.ts
    - shared/game/bots.ts
    - shared/game/chat.ts
    - worker/room.ts
    - src/screens/RoomScreen.tsx
    - src/game/scenes.ts
    - src/components/TestTools.tsx
    - scripts/e2e/lib.mjs

key-decisions:
  - "normalizeStoredRoom 은 claim 저장 방뿐 아니라 단계가 discussion 이어도 claim 계열 키가 남은 방의 키를 지운다 (플랜의 'claimOrder 만 있고 단계는 discussion 인 방' 경계)"
  - "chat.ts QUICK_TEMPLATES 의 when 유니온 'claim' 은 남긴다: 표시 전용 템플릿 claimRole·claimNone 이 그 값을 쓰고 서버가 받지 않는 표식이라서다. 07-11·07-12 가 템플릿과 파일을 지울 때 함께 사라진다"
  - "버려진 시험 중 일차 2 시작 자리 이동·탈락자 제외 같은 순차 주장 전용 모델 시험은 대체 시험 없이 지우고, nyquist-03.1 은 '여러 날 낮 흐름 + 일지 누적' 시험으로 바꿔 날마다 dayAnnounce 다음이 바로 토론임을 확인한다"

patterns-established:
  - "삭제 계획의 RED 는 '지워졌다'는 사실을 단언하는 시험(단계 표 길이·메시지 거부·정규화)으로 쓰고, 이미 다른 task 에서 초록이 된 보호 시험은 회귀 시험으로 남긴다"

requirements-completed: [CHAT-06]

coverage:
  - id: D1
    description: "dayAnnounce 마감 다음이 바로 discussion 이고 마감은 이전 마감 + DISCUSSION_MS 다 (늦은 알람으로 여러 단계를 따라잡아도 같다)"
    requirement: CHAT-06
    verification:
      - kind: unit
        ref: "test/unit/tick.test.ts#07-08 dayAnnounce 마감 다음이 바로 discussion"
        status: pass
      - kind: integration
        ref: "test/worker/alarm.test.ts#낮 한 바퀴와 밤·아침(dayAnnounce → discussion → execVote → night → morning → dayAnnounce)"
        status: pass
    human_judgment: false
  - id: D2
    description: "claim 메시지는 스키마가 BAD_MESSAGE 로 거부하고 워커도 error BAD_MESSAGE 를 돌려준다"
    requirement: CHAT-06
    verification:
      - kind: unit
        ref: "test/unit/schemas.test.ts#07-08 claim 메시지(직업)는 거부한다"
        status: pass
      - kind: integration
        ref: "test/worker/day.test.ts#07-08 소켓이 claim 메시지를 보내면 error BAD_MESSAGE 가 온다"
        status: pass
    human_judgment: false
  - id: D3
    description: "배포 시점에 claim 으로 저장된 방은 깨어날 때 discussion 으로 열리고 claim 계열 키가 지워지며 알람이 새 마감으로 옮겨진다"
    requirement: CHAT-06
    verification:
      - kind: unit
        ref: "test/unit/gameRoom.test.ts#07-08 claim 으로 저장된 방은 discussion"
        status: pass
      - kind: integration
        ref: "test/worker/alarm.test.ts#07-08 claim 으로 저장된 방은 깨어날 때 discussion 으로 열리고"
        status: pass
    human_judgment: false
  - id: D4
    description: "봇 계획에서 주장 차례가 사라지고 discussion·night 시드 고정 값이 새 호출 순서로 다시 고정됐다(다른 단계 난수 호출 수는 그대로)"
    requirement: CHAT-06
    verification:
      - kind: unit
        ref: "test/unit/bots.test.ts#discussion·night 계획 고정값"
        status: pass
    human_judgment: false
  - id: D5
    description: "누설 검사의 서버 전용 키 목록을 줄이지 않은 채 6명 한 판이 주장 단계 없이 끝까지 돈다"
    requirement: CHAT-06
    verification:
      - kind: integration
        ref: "test/worker/leak.test.ts#모든 프레임·HTTP 응답에 남의 토큰·역할·동료가 없고"
        status: pass
    human_judgment: false
  - id: D6
    description: "화면 단계 이름표(RoomScreen·scenes.ts·TestTools)와 E2E 사본(lib.mjs EXPECTED_SCENE)에서 claim 이 사라지고 전체 vitest·두 tsc·빌드·스크립트 단위 시험이 초록이다"
    requirement: CHAT-06
    verification:
      - kind: unit
        ref: "test/unit/scenes.test.ts#E2E 기대 장면표(EXPECTED_SCENE)와 PHASE_SCENE"
        status: pass
      - kind: other
        ref: "npx vitest run (137 files, 3674 passed) && npm run typecheck && npx vite build && node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs (280 pass)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-11-01
status: complete
---

# Phase 7 Plan 08: 순차 주장 단계 제거(서버·와이어) Summary

**순차 직업 주장(claim) 단계를 PhaseId·단계 표·tick 훅·buildView·봇 계획·스키마·DO 처리기에서 걷어내 낮 시작 발표 다음이 바로 자유 채팅 토론이 되게 하고, 배포 시점에 claim 으로 저장된 방은 normalizeStoredRoom 이 discussion 으로 옮긴다**

## Performance

- **Duration:** 20 min
- **Started:** 2026-11-01T13:21:50Z
- **Completed:** 2026-11-01T13:41:00Z
- **Tasks:** 3 (Task 1 트레이서 + Task 2·3 정리)
- **Files modified:** 39 (삭제 2 포함)

## Accomplishments

- 단계 흐름이 `roleReveal → dayAnnounce(2초) → discussion(40초)` 이다. `DISCUSSION_MS` 는 40초 그대로이고 주석만 "7페이즈 자유 채팅 토론, 90초는 8페이즈 DAY-07" 로 고쳤다.
- `shared/game/claim.ts`·`test/unit/claim.test.ts` 삭제. 와이어에서 `ClaimTurn`·`DayView.turn`·ClientMessage `claim`·PhaseId `"claim"` 이, 서버에서 `CLAIM_TURN_MS`·`botClaimChoice`·`handleClaim`·`applyClaim`·RoomState 차례 상태 다섯 키가 사라졌다.
- `normalizeStoredRoom`: `LEGACY_PHASES.claim` 을 더해 claim 저장 방을 `discussion · now + DISCUSSION_MS` 로 옮기고, claim 계열 다섯 키를 단계와 무관하게 지운다. 바뀐 것이 없으면 같은 객체를 돌려주는 규칙을 지켰고 워커 시험으로 알람이 새 마감으로 옮겨지는 것까지 고정했다.
- 봇: discussion·night 계획의 시드 고정 값을 새 호출 순서로 다시 고정하고(`289874952,760964938` → `622180622,76649671`) 난수 호출 수 시험을 짝으로 더했다.
- 화면: RoomScreen `PHASE_ANNOUNCE`·`claimAnnounce`·`sceneKey`·`renderPhase`, `scenes.ts PHASE_SCENE`, `TestTools TEST_PHASE_LABEL`, `scripts/e2e/lib.mjs EXPECTED_SCENE` 의 claim 행을 지웠다.
- `DayView.claimLog` 키는 언제나 `[]` 로 남겼다(07-09 가 지운다). 누설 검사 `SERVER_ONLY_KEYS`(claimPick·claimOrder·claimIdx·claimStart 포함)는 그대로다.

## TDD Gate Compliance

| Gate | Commit | 내용 |
|------|--------|------|
| RED (Task 1) | `1d85c74` test(07-08) | tick·schemas·gameRoom·worker day 의 "07-08" 시험 9건이 의도한 단언(`claim/58000` vs `discussion/90000`, claim 메시지 수용, 정규화 키 잔존, claim 단계 state 수신)에서 실패 |
| GREEN (Task 1) | `c492885` feat(07-08) | 같은 9건 통과(`vitest -t "07-08"`) |
| RED (Task 3) | `46b5659` test(07-08) | `scenes.test` 3건이 의도한 단언(표 키 13개 기대 vs 14개)에서 실패 |
| GREEN (Task 3) | `9dd34ea` feat(07-08) | 화면 표·E2E 사본 정리로 통과 |

- **RED 의미 평가(semanticAssessment):** 모든 RED 실패는 대상 시험이 실제로 돌아 계획된 동작(claim 없는 흐름·거부·정규화)에서 단언이 틀려 난 것이다. 문법/로드/픽스처 오류 아님. Task 3 의 alarm.test 두 시험(연쇄·claim 방 깨우기)은 Task 1 의 서버 변경으로 이미 통과해 회귀 보호 시험으로 남겼다.
- `gsd_run check tdd-red-evidence` 는 돌리지 않았다: vitest 기본 리포터 출력은 이 분류기가 받는 TAP/JUnit 보고서가 아니고, 보고서를 만들어도 같은 결론이라 위 수동 의미 평가로 대신했다. 분류기 통과 기록은 없다.
- REFACTOR 커밋 없음(정리는 Task 2·3 의 시험/표 삭제에 포함).

## Task Commits

1. **Task 1: 트레이서 (dayAnnounce → discussion)** — `1d85c74` (test, RED) → `c492885` (feat, GREEN)
2. **Task 2: unit 시험 정리** — `5e616c9` (test)
3. **Task 3: worker 시험 정리 + 화면 단계 이름표·E2E 사본** — `46b5659` (test, RED) → `9dd34ea` (feat, GREEN)

**Plan metadata:** 이 SUMMARY 를 담은 docs 커밋

## Files Created/Modified

- `shared/game/phases.ts` - claim 행·CLAIM_TURN_MS 삭제, `dayAnnounce.next = "discussion"`, DISCUSSION_MS 주석
- `shared/game/room.ts` - RoomState 차례 상태 삭제, `LEGACY_PHASES.claim` 정규화와 claim 키 제거
- `shared/game/tick.ts`·`view.ts`·`bots.ts`·`chat.ts` - claim 진입/마감 훅, turn, 봇 주장 계획, claim 단계 이모티콘 허용 제거
- `shared/protocol.ts`·`schemas.ts` - PhaseId·ClaimTurn·DayView.turn·ClientMessage claim 제거
- `worker/room.ts` - handleClaim·applyClaim·봇 claim 분기 제거
- `src/screens/RoomScreen.tsx`·`src/game/scenes.ts`·`src/components/TestTools.tsx`·`scripts/e2e/lib.mjs` - claim 단계 이름 표 행 삭제
- 시험 26개 - 주장 전용 시험 삭제, 단계 목록·연쇄·키 목록 기대값 수정, 봇 시드 재고정, 신규 07-08 시험

## Decisions Made

key-decisions 참고. 요약: (1) 정규화는 단계와 무관하게 claim 키를 지운다, (2) `QUICK_TEMPLATES.when` 의 `"claim"` 표식은 표시 전용 템플릿이 남아 있는 동안 둔다, (3) 순차 주장 전용 모델 시험은 대체 없이 지우고 다일 시험은 새 흐름 단언으로 바꿨다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 계획 파일 목록 밖 시험 3곳이 claim 을 참조해 tsc·테스트가 깨짐**
- **Found during:** Task 3 (`npm run typecheck`, `node --test`)
- **Issue:** `test/client/phaseScreens.test.tsx`(Record<PhaseId,true> 에 claim), `test/unit/audience.test.ts`(SILENT_PHASES 의 "claim"), `scripts/e2e/lib.test.mjs`(EXPECTED_SCENE 14개 기대)가 PhaseId 에서 claim 이 빠지며 컴파일/단언 실패
- **Fix:** 각 시험에서 claim 항목만 제거(기대 개수 14 → 13). 화면 시험 픽스처의 나머지 정리는 계획대로 07-09 몫으로 남김
- **Files modified:** test/client/phaseScreens.test.tsx, test/unit/audience.test.ts, scripts/e2e/lib.test.mjs
- **Verification:** `npm run typecheck`, `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs`(280 pass)
- **Committed in:** `9dd34ea`

**2. [Rule 1 - Bug] view.test 의 "claimLog 가 없는 옛 방" 시험이 RoomState 에서 claimLog 선언이 사라져 컴파일 실패**
- **Found during:** Task 3 (`npm run typecheck`)
- **Fix:** "옛 claimLog·claimOrder 키가 남은 방도 view 의 claimLog 는 [] 이고 서버 전용 키는 실리지 않는다" 시험으로 교체(캐스트로 옛 키 주입)
- **Files modified:** test/unit/view.test.ts
- **Committed in:** `9dd34ea`

### Plan 지시와 다르게 처리한 항목

- **chat.ts `when` 유니온의 `"claim"`**: 계획 step 9 는 유니온에서 빼라고 했으나, 표시 전용 템플릿 `claimRole`·`claimNone` 이 그 값을 쓰고 있어 빼면 두 템플릿의 `when` 을 바꿔야 하며 `day` 로 바꾸면 서버가 받게 되어 기존 보호 시험(표시 전용 템플릿은 BAD_MESSAGE)을 깬다. `EMOTE_PHASES`·주석에서만 claim 을 지우고 유니온은 07-11·07-12 에 맡겼다.
- **Task 2 커밋 시점의 `vitest --project unit`**: Task 3 의 RED 인 `scenes.test` 3건이 실패 상태였다(의도됨). 최종 전체 실행은 초록이다.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug) + 2 계획 대비 조정
**Impact on plan:** 모두 PhaseId 변경의 직접 결과. 범위 확장 없음.

## Issues Encountered

- 초기에 `npx vitest run --project unit` 가 120초 넘게 멈췄다: `testTools.test`·`night.test` 의 `stateAt(…, "claim")` 이 더는 닿을 수 없는 단계를 마감으로만 기다리는 루프였다. 해당 시험을 정리한 뒤 해소됐다. 이후에는 파일별로 perl alarm 래퍼를 써서 실행했다.
- 후속 계획 참고: `scripts/e2e/lib.mjs` 에 `claimChatIssues`·claim 후광 주석 등 E2E 쪽 claim 흔적이 남아 있고 단위 시험도 그대로 통과한다. 이 계획 범위(단계 이름 표 사본)는 아니라 건드리지 않았다.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. (`DayView.claimLog: []` 고정은 의도된 중간 상태이며 07-09 가 와이어에서 지운다 — 이 상태는 배포되지 않는다.)

## Next Phase Readiness

- 07-09: `DayView.claimLog`·`ClaimLogEntry`·`Claim` 타입과 화면 시험 픽스처 정리, `leak.test` 의 `ROLE_PATHS_ALIVE` claimLog 경로 제거가 남았다.
- 07-11·07-12: `TEMPLATE_IDS` 의 claimRole·claimNone·`DISPLAY_ONLY_TEMPLATE_IDS`, `QUICK_TEMPLATES.when` 의 `"claim"`, chat.ts 파일 삭제.
- 차단 요소 없음.

## Self-Check: PASSED

- 파일 확인: phases.ts·room.ts·worker/room.ts·leak.test.ts·scenes.test.ts 있음, claim.ts·claim.test.ts 없음
- 커밋 확인: 1d85c74, c492885, 5e616c9, 46b5659, 9dd34ea 모두 HEAD 의 조상
- 인수 기준: `git grep` 금지 이름 0건, `claim: "day"` 0건, SERVER_ONLY_KEYS·`"claimPick"` 유지, `.skip(`·`.todo(` 0건
- 전체 검증: `npx vitest run` 137 파일 3674 통과(1 skipped 는 기존), `npm run typecheck`, `npx vite build`, `node --test` 280 통과

---
*Phase: 07-free-chat*
*Completed: 2026-11-01*
