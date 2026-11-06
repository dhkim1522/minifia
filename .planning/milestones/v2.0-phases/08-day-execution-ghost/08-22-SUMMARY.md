---
phase: 08-day-execution-ghost
plan: "22"
subsystem: legacy-removal-and-room-normalization
tags: [deletion, phase-id, normalizeStoredRoom, static-guard, wire-protocol, execution-phrase]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-11 흐름 전환, 08-20 화면 정리와 정적 가드, 08-21 서버 옛 투표 코드·메시지 삭제
provides:
  - 옛 처형 여부·후보 선택·후보 공개 단계로 저장된 방은 DO 가 깨어날 때 discussion(마감 now + 90000, 일차 유지)으로 옮겨지고 알람이 새 마감으로 걸린다
  - PhaseId 가 열두 단계(옛 세 이름 없음), PHASE_DEFS·CHAT_PHASES·DAY_PHASES·PHASE_SCENE·PHASE_ANNOUNCE·TEST_PHASE_LABEL·조명에서 옛 행 삭제
  - 후보 공개 길이 공식·상수(candidateRevealMs·CANDIDATE_*·EXEC_VOTE_MS·CANDIDATE_VOTE_MS)와 처형 문구 번호(EXECUTION_PHRASE_COUNT·lastExecPhrase·EXECUTION_TAILS·executionTitle) 삭제
  - ExecutionView = { seat }, NoExecutionReason = "tie" | "noVotes", 화면 처형 안내 "{닉네임} 님 처형", enterExecution 난수 호출 0
  - dayStaticGuard 에 서버·와이어 지운 이름 목록(SERVER_REMOVED_IDENTIFIERS)
affects: [08-23 e2e lib.mjs 의 옛 단계 사본(candidateRevealMs 등), 08-25 gallery.mjs, 배포(정규화가 들어간 뒤라 배포 가능)]

actuals:
  tokens: 23400
  tasks: 3
  commits: 3
plan_head_before: e2b3d3530d88d8796c38bdcb1799e9f937dfd4ba
plan_head_after: 039809dced62d546402d31d7db51ecbd724eb2a9

tech-stack:
  added: []
  patterns:
    - "옛 단계 이름은 PhaseId 에서 지워도 정규화가 phase as string 비교로 옛 저장 방을 토론으로 옮긴다(07-08 LEGACY_PHASES 방식)"
    - "정적 가드 예외는 파일 하나·줄 모양 정규식 여섯 개로 좁힌다(room.ts 정규화 표)"

key-files:
  created: []
  modified:
    - shared/game/room.ts
    - shared/protocol.ts
    - shared/game/phases.ts
    - shared/game/discussion.ts
    - shared/game/audience.ts
    - shared/game/view.ts
    - shared/game/tick.ts
    - shared/game/execution.ts
    - shared/game/movement.ts
    - src/game/scenes.ts
    - src/game/eliminationText.ts
    - src/game/verdict.ts
    - src/screens/RoomScreen.tsx
    - src/components/TestTools.tsx
    - src/world/presence.ts
    - test/unit/dayStaticGuard.test.ts
    - test/unit/gameRoom.test.ts
    - test/worker/trial.test.ts

key-decisions:
  - "옛 투표 단계 방을 옮길 때 오늘 일차 voteLog 줄은 지운다(지난 날 줄은 그대로): candidateVote·candidateVoteReveal 로 저장된 방에는 여부 투표 마감이 오늘 줄을 이미 쌓았고, 새 지목 마감이 같은 일차 줄을 다시 쌓으면 같은 일차 줄이 둘이 되어 결과 요약에 두 줄로 나올 수 있다"
  - "옛 투표 개인 키(execVote·candidateVote)와 방 키 lastExecPhrase 는 어느 단계로 저장됐든 키째 뺀다. 지목·찬반 개인 키(nominate·verdictVote·endVote)와 verdict·execution 은 옛 단계에서 옮길 때만 지운다(새 단계에서는 살아 있는 값이다)"
  - "dayStaticGuard 예외는 shared/game/room.ts 한 파일, 정규화 표 줄 모양 여섯 가지만 허용한다. 그 밖의 줄에 옛 이름이 나오면 실패한다"
  - "처형 안내 문구는 eliminationText 가 아니라 RoomScreen 이 `${닉네임} 님 처형` 으로 만든다(문구 표가 없어져 만들 문장이 하나뿐)"

requirements-completed: [DAY-07, DAY-06]

coverage:
  - id: D1
    description: "옛 세 투표 단계로 저장된 방이 깨어날 때 discussion 으로 옮겨지고(일차 유지, 마감 now + DISCUSSION_MS), 옛 개인 투표 키·verdict·execution·lastExecPhrase 가 지워지고 지난 날 voteLog 는 남으며 알람이 새 마감으로 걸리고 재접속 view 단계가 discussion 이다"
    requirement: DAY-07
    verification:
      - kind: unit
        ref: "test/unit/gameRoom.test.ts 'normalizeStoredRoom — 옛 투표 단계로 저장된 방 (08-22, DAY-07)' (9 tests)"
        status: pass
      - kind: integration
        ref: "test/worker/trial.test.ts '옛 투표 단계로 저장된 방 (08-22, DAY-07)' (3 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "PhaseId·단계 표·채팅 단계·낮 단계·화면 표에서 옛 세 단계 이름이 없고, 후보 공개 상수·처형 문구 번호가 없으며, 처형 view 는 {seat} 뿐이고 enterExecution 은 난수를 부르지 않고 처형 무효 이유는 tie·noVotes 둘이다"
    requirement: DAY-07
    verification:
      - kind: unit
        ref: "test/unit/execution.test.ts, test/unit/tick.test.ts, test/unit/phases.test.ts, test/unit/view.test.ts, test/unit/scenes.test.ts, test/unit/audience.test.ts, test/unit/movement.test.ts"
        status: pass
      - kind: integration
        ref: "test/worker/trial.test.ts '실제 흐름' 첫 시험(처형 view 키 seat)"
        status: pass
    human_judgment: false
  - id: D3
    description: "정적 가드가 서버·와이어의 지운 이름(옛 세 단계·옛 두 메시지·ExecTally·옛 규칙 함수·후보 공개 길이·처형 문구 번호)이 주석 밖 코드에 0건임을 고정한다(room.ts 정규화 표 줄만 예외)"
    requirement: DAY-07
    verification:
      - kind: unit
        ref: "test/unit/dayStaticGuard.test.ts (15 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "누설 검사(leak·ghostLeak·chatLeak)가 그대로 초록이다"
    requirement: DAY-06
    verification:
      - kind: integration
        ref: "test/worker/leak.test.ts, ghostLeak.test.ts, chatLeak.test.ts (전체 vitest 안)"
        status: pass
    human_judgment: false
  - id: D5
    description: "전체: 두 tsc, vitest 전체(135 파일 3673 통과, 1 skipped 는 이전부터), 스크립트 시험(288 통과), vite build"
    verification:
      - kind: command
        ref: "npm run typecheck && npx vitest run && node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs && npx vite build"
        status: pass
    human_judgment: false

duration: 약 11분
completed: 2026-11-02
---

# Phase 08 Plan 22: 옛 단계 이름·후보 공개 상수·처형 문구 번호 삭제와 옛 방 정규화 Summary

normalizeStoredRoom 이 옛 처형 여부·후보 선택·후보 공개 단계의 저장 방을 토론으로 옮기게 한 뒤 PhaseId 와 단계·화면 표에서 옛 세 이름을 지우고, 후보 공개 길이 공식·처형 문구 번호를 없애 처형 view 를 `{seat}` 로 줄였으며, 정적 가드에 서버·와이어 지운 이름을 더했다. 두 tsc, vitest 전체, 스크립트 시험, vite build 가 초록이다.

## Performance

- **Duration:** 약 11분
- **Started:** 2026-11-02T15:34:00Z
- **Completed:** 2026-11-02T15:45Z
- **Tasks:** 3
- **Files modified:** 38

## Accomplishments

- **정규화 (먼저):** 옛 세 단계 방 → discussion · now + DISCUSSION_MS · 일차 유지. 옛 개인 투표 키·그날 verdict/execution·오늘 voteLog 줄 제거, 옛 투표 개인 키와 lastExecPhrase 는 어느 단계든 제거, 정상 방은 같은 객체(toBe). DO 재접속 시험이 view 단계 discussion 과 알람이 새 마감으로 걸림을 확인한다.
- **이름 삭제:** PhaseId 열두 단계. PHASE_DEFS·CHAT_PHASES·DAY_PHASES·PHASE_SCENE·PHASE_ANNOUNCE·TEST_PHASE_LABEL·조명 표의 옛 행, VERDICT_TEXT.announce 묶음, phaseDurationOf 의 공개 분기, phases.ts 의 옛 상수 모두 삭제.
- **처형 문구 번호 삭제:** ExecutionView `{ seat }`, enterExecution 난수 0, EXECUTION_TAILS·executionTitle 삭제, RoomScreen 안내 "{닉네임} 님 처형", NoExecutionReason `"tie" | "noVotes"`.
- **정적 가드:** SERVER_REMOVED_IDENTIFIERS 열세 개를 shared·worker·src 에 대해 0건으로 고정, room.ts 정규화 표는 줄 모양 여섯 가지만 예외.

## Task Commits

TDD 모드가 꺼져 있어(사용자 결정 workflow.tdd_mode=false) RED 전용 커밋 없이 일반 원자 커밋으로 했다.

1. **Task 1: 트레이서 — 옛 단계 저장 방 정규화** - `5bb10f2` (feat)
2. **Task 2: 옛 단계 이름·후보 공개 상수·처형 문구 번호 삭제** - `c4114fc` (refactor)
3. **Task 3: 시험 정리와 정적 가드** - `039809d` (test)

**Plan metadata:** 이 SUMMARY 와 STATE·ROADMAP 반영 커밋(docs)

## 트레이서 게이트

Task 1 `<verify>`(`npx vitest run test/unit/gameRoom.test.ts test/worker/trial.test.ts`, 115 통과)를 다시 돌려 통과를 확인한 뒤 확장 작업으로 넘어갔다.

## 지운 시험 표 (T-08-51)

| 파일 | 지운 것 | 이유 |
| --- | --- | --- |
| test/unit/tick.test.ts | 단계 표의 옛 세 행 단언·EXEC_VOTE_MS·CANDIDATE_VOTE_MS 단언, `describe("candidateRevealMs")` 중 공식 시험 넷(표 수별 길이·상수·정수 내림) | 단계 행·상수·공식이 없어졌다. 낮 처형 구간 50초 단언은 남겼다. 단계 수 단언은 열두 개로 고쳤다 |
| test/unit/eliminationText.test.ts | `EXECUTION_TAILS · executionTitle` describe 전체 | 처형 꼬리 문장 표가 없어졌다. 아침 문장 시험은 그대로 |
| test/unit/e2eContract.test.ts | candidateRevealMs 사본 검사 묶음 | 계획대로. lib.mjs 의 대응 상수는 08-23 |
| test/unit/execution.test.ts | 처형 문구 추첨·직전 문구 회피·`lastExecPhrase` 시험 셋 | 문구 번호가 없다. 대신 tick 으로 처형에 들어가도 난수 0 인 시험을 더함 |
| test/unit/audience.test.ts, movement.test.ts, scenes.test.ts, phases.test.ts, test/client/phaseScreens.test.tsx | 옛 세 단계 행 단언 | PhaseId 에서 없어졌다(movement·audience 표는 12종/새 단계로 맞춤) |
| test/unit/verdict.test.ts | `VERDICT_TEXT.announce` 값 단언 셋, `notMajority` 부제 단언 | 묶음과 이유 코드가 없어졌다(없음을 단언으로 바꿈) |

## Files Created/Modified

위 key-files 목록 참고. 시험·스크립트 쪽 수정(위 표 외): test/unit/{discussion,presence,testTools,view}.test.ts, test/client/{resultScreen,verdictScreen}.test.tsx 의 `phrase`·`lastExecPhrase` 정리, scripts/e2e/lib.mjs·lib.test.mjs 의 EXPECTED_SCENE.

## Decisions Made

key-decisions 참고.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 옛 단계 방 정규화가 같은 일차 voteLog 줄을 둘로 만들 수 있다**
- **Found during:** Task 1
- **Issue:** 계획은 "voteLog 그대로" 였으나 candidateVote·candidateVoteReveal 로 저장된 방은 오늘 줄이 이미 있어서, 새 지목 마감이 같은 일차 줄을 또 쌓는다
- **Fix:** 옮길 때 오늘 일차 줄만 지우고 지난 날 줄은 그대로 둔다(줄이 없으면 같은 배열). 시험으로 고정
- **Files modified:** shared/game/room.ts, test/unit/gameRoom.test.ts
- **Commit:** 5bb10f2

**2. [Rule 3 - 막힘 해소] 계획 files 밖 파일 수정**
- `test/worker/leak.test.ts` 한 줄: 처형 view 키 단언 `phrase,seat` → `seat` (인수 기준은 "누설 시험 파일 그대로" 이나 이 단언 자체가 지운 필드를 기대한다. 단언을 더 엄격하게 바꿨고 누설 금지 키 목록은 건드리지 않았다. 변경은 정확히 1줄)
- `scripts/e2e/lib.mjs` EXPECTED_SCENE 옛 세 행과 `scripts/e2e/lib.test.mjs` 해당 시험: `test/unit/scenes.test.ts` 가 두 표의 동일성을 단언하므로 PHASE_SCENE 에서 지우면 어긋난다. 08-23 의 나머지 lib.mjs 정리와 겹치지 않는 3행뿐
- `test/unit/verdict.test.ts`, `test/client/{phaseScreens,resultScreen,verdictScreen}.test.tsx`, `test/unit/{presence,testTools}.test.ts`: tsc 가 알려 준 삭제 필드 참조 정리
- **Commit:** 039809d

**3. [계획 보정] test(08-22) 커밋 인수 기준·leak 파일 diff 인수 기준**
- `git log --grep="^test\(0?8-22\):"` 는 `039809d test(08-22)` 한 줄로 충족하지만 RED 전용 커밋은 아니다(사용자 결정: TDD 모드 끔)

**Total deviations:** 3 (Rule 1 ×1, Rule 3 ×2) + 계획 보정. **Impact:** 범위 변화 작음. 모두 시험·스크립트 표 정리와 정규화 정확성 보강.

## Issues Encountered

- 전체 vitest 한 번은 test/worker/bots.test.ts 의 "verdict: 변론자가 아닌 봇만 던지고…" 가 시간 초과 성격으로 한 번 실패했으나 그 파일만 다시 돌리면 22개 모두 통과했고, 이어 전체를 다시 돌려 135 파일이 모두 통과했다(이전부터 알려진 불안정 계열).

## 이월 항목

- scripts/e2e/flows.mjs·lib.mjs 의 옛 단계 이름·candidateRevealMs 사본은 08-23, scripts/gallery.mjs 의 옛 단계 대기는 08-25 몫으로 두었다(스크립트 시험·타입 검사는 통과). 서버가 이제 옛 세 단계를 만들지 않으므로 그 흐름 스크립트는 지금 실행해도 해당 단계에 닿지 못한다.
- scripts/uat-vote.mjs·uat-night.mjs 의 EXECUTION_PHRASE_COUNT·EXEC_VOTE_MS 로컬 사본도 같은 이유로 손대지 않았다.
- 배포 전 확인: 정규화가 들어갔으므로 08-11 이 남긴 "배포 전 정규화(A3)" 선행 조건은 충족됐다.

## Known Stubs

없음.

## Threat Flags

없음. T-08-52(옛 저장 방)는 unit·worker 시험으로, T-08-53(처형 view)은 `{seat}` 키 단언과 leak 시험으로 완화했다.

## Self-Check

- PhaseId 에 `"execVote"`·`"candidateVote"` 없음, `| "nomination"` 있음, 정규화 표에 `"candidateVoteReveal"` 문자열 있음, `candidateRevealMs`·`EXECUTION_PHRASE_COUNT`·`executionTitle` 이 shared·src·worker 에 0건, dayStaticGuard 에 `candidateRevealMs`·`EXECUTION_PHRASE_COUNT` 있음, `.skip(`·`.todo(` 0건: 통과
- 커밋 5bb10f2·c4114fc·039809d 가 HEAD 조상에 있음: 통과
- `npm run typecheck`(오류 0), `npx vitest run`(135 파일 3673 통과), `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs`(288 통과), `npx vite build`: 통과

## Self-Check: PASSED
