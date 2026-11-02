---
phase: 08-day-execution-ghost
plan: "21"
subsystem: server-legacy-removal
tags: [deletion, wire-protocol, schema, bots, view, test-helpers]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-11 흐름 전환과 새 시험 도우미, 08-19 RoomScreen 옛 분기 제거, 08-20 화면 정리, 08-28 옛 흐름 전용 unit 시험 삭제
provides:
  - 와이어·스키마에 처형 여부(execVote)·후보 선택(candidateVote) 메시지가 없다 — 옛 번들이 보내면 BAD_MESSAGE
  - 서버 옛 규칙 모듈 shared/game/vote.ts 삭제, tick 표·execution 훅·view 필드·Player 키·DO 핸들러·봇 행동에서 옛 코드 제거
  - BotAct 는 chat·pick·endDiscussion·point·verdict, skipPhase 봇 일괄은 night·nomination·verdict
  - botPointTarget(옛 botCandidateTarget 의 새 이름), VoteError 는 discussion.ts 에 둠
affects: [08-22 옛 단계 이름·정규화·처형 문구 번호 삭제와 정적 가드 서버 이름 목록, 08-23 e2e lib, 08-25 gallery]

actuals:
  tokens: 17800
  tasks: 2
  commits: 2
plan_head_before: eeb5d2b6ee71f9bff4db619c2991fd4f66387221
plan_head_after: 2d3b096b7f4351dd1150c8b866428c41b396e312

tech-stack:
  added: []
  patterns:
    - "옛 메시지는 새 메시지로 바꿔 받는 호환 길 없이 스키마가 거부한다(BAD_MESSAGE)"
    - "단계 이름(PhaseId·PHASE_DEFS·화면 표)은 이 계획에서 건드리지 않고 08-22 가 지운다"

key-files:
  created: []
  modified:
    - shared/protocol.ts
    - shared/schemas.ts
    - shared/game/room.ts
    - shared/game/tick.ts
    - shared/game/execution.ts
    - shared/game/view.ts
    - shared/game/bots.ts
    - shared/game/testTools.ts
    - shared/game/discussion.ts
    - shared/game/nomination.ts
    - shared/game/verdict.ts
    - worker/room.ts
    - test/unit/schemas.test.ts
    - test/unit/bots.test.ts
    - test/unit/testTools.test.ts
    - test/worker/trial.test.ts
    - test/helpers/voteState.ts
  deleted:
    - shared/game/vote.ts

key-decisions:
  - "VoteError(WRONG_PHASE|BAD_MESSAGE)는 vote.ts 가 지워지므로 discussion.ts 에 export 로 옮기고 nomination·verdict 가 거기서 import 한다"
  - "CandidateVoteLine 은 PointLine 과 모양이 같지만 합치지 않았다: VoteLogEntry.cand.votes 와 test/unit/verdict.test.ts 가 쓰고, 합치면 결과 화면 타입(Pitfall 12)과 시험 import 가 함께 바뀐다 — 합칠 필요가 생기면 08-22 이후 결정"
  - "view.ts 는 PhaseId 이름 목록(DAY_PHASES, 후보 조건의 candidateVoteReveal)은 그대로 둔다 — 08-22 가 PhaseId 와 함께 지운다"

requirements-completed: [DAY-07, DAY-06]

coverage:
  - id: D1
    description: "옛 번들의 execVote·candidateVote 메시지는 스키마가 거부하고 소켓은 보낸 사람에게만 BAD_MESSAGE 를 돌려주며 새 세 메시지는 그대로 받는다"
    requirement: DAY-07
    verification:
      - kind: unit
        ref: "test/unit/schemas.test.ts '옛 투표 메시지(execVote·candidateVote)는 와이어에서 사라졌다'"
        status: pass
      - kind: integration
        ref: "test/worker/trial.test.ts '옛 번들의 처형 여부·후보 선택 메시지는 보낸 소켓만 BAD_MESSAGE 를 받는다'"
        status: pass
    human_judgment: false
  - id: D2
    description: "서버 옛 처형 여부·후보 선택 코드(vote.ts, 후보 공개 훅, tick 옛 행, view 필드, Player 키, DO 핸들러, 봇 행동)가 사라지고 두 tsc·전체 vitest·스크립트 시험이 초록이다"
    requirement: DAY-07
    verification:
      - kind: command
        ref: "npm run typecheck; npx vitest run (135 파일 3685 통과, 1 skipped 는 이전부터); node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs (288 통과)"
        status: pass
    human_judgment: false
  - id: D3
    description: "누설 검사(leak.test 의 .view.day.verdict·.view.me.verdictVote 두 허용 경로)가 옛 필드 삭제 뒤에도 그대로 초록이다"
    requirement: DAY-06
    verification:
      - kind: integration
        ref: "test/worker/leak.test.ts (전체 vitest 안)"
        status: pass
    human_judgment: false

duration: 약 6분
completed: 2026-11-02
---

# Phase 08 Plan 21: 서버 옛 처형 여부·후보 선택 코드 삭제 Summary

와이어·스키마·DO·규칙 모듈(vote.ts 삭제)·tick 표·view·봇·테스트 도구에서 처형 여부 투표와 후보 선택 코드를 지우고, 옛 번들 메시지가 BAD_MESSAGE 로 거부됨을 스키마·소켓 시험으로 고정했다. 두 tsc, vitest 전체, 스크립트 시험이 초록이다.

## Performance

- **Duration:** 약 6분
- **Started:** 2026-11-02T15:27:54Z
- **Completed:** 2026-11-02T15:33Z
- **Tasks:** 2
- **Files modified:** 18 (1 삭제 포함, 순증감 +90 / -437)

## Accomplishments

- ClientMessage·ClientMessageSchema 에서 옛 두 투표 메시지를 지웠다. 옛 번들이 보내면 유니온에 없어 BAD_MESSAGE 다(소켓 시험).
- `shared/game/vote.ts` 를 `git rm`. tick 의 옛 진입·마감 훅 행과 import, execution.ts 의 후보 공개 훅 둘, view 의 execTally·voteAgree·voteTarget, protocol 의 ExecTally·DayView.execTally·MyInfo 두 키, Player 의 execVote·candidateVote 키를 지웠다.
- worker/room.ts 에서 switch 두 case, handle 두 함수, apply 두 본체, actAsBot 두 case 를 지웠다.
- 봇: BotAct 두 멤버, 옛 단계 계획 분기와 지연 상수를 지우고 botCandidateTarget 을 botPointTarget 으로 바꿨다. skipPhase 의 봇 일괄은 nomination·verdict 만 남았다.
- 시험 쪽: voteState.ts 옛 표 도우미 둘 삭제, bots.test·testTools.test 이름 바꾸기, schemas.test 거부 시험 교체.

## Task Commits

TDD 모드가 꺼져 있어(사용자 결정 workflow.tdd_mode=false) RED 전용 커밋 없이 일반 원자 커밋으로 했다.

1. **Task 1: 트레이서 — 옛 메시지 스키마 거부 → BAD_MESSAGE** - `c3da791` (refactor)
2. **Task 2: 옛 규칙·훅·view·봇·테스트 도구 코드 삭제와 시험 쪽 짝 정리** - `2d3b096` (refactor)

**Plan metadata:** 이 SUMMARY 와 STATE·ROADMAP 반영 커밋(docs)

## 트레이서 게이트

Task 1 `<verify>`(`npx vitest run test/unit/schemas.test.ts test/worker/trial.test.ts`, 124 통과)를 다시 돌려 통과를 확인한 뒤 Task 2 로 넘어갔다.

## Files Created/Modified

- `shared/protocol.ts` - ClientMessage 옛 두 멤버, ExecTally, DayView.execTally, MyInfo.voteAgree·voteTarget 삭제
- `shared/schemas.ts` - 옛 두 strictObject 삭제
- `shared/game/vote.ts` - 삭제
- `shared/game/{room,tick,execution,view,bots,testTools}.ts` - 옛 키·훅 행·분기·함수 삭제, 머리 주석을 새 흐름으로 고침
- `shared/game/{discussion,nomination,verdict}.ts` - VoteError 를 discussion.ts 로 옮김
- `worker/room.ts` - 옛 핸들러·본체·분기 삭제
- `test/unit/schemas.test.ts`, `test/worker/trial.test.ts` - 옛 메시지 거부 시험
- `test/helpers/voteState.ts`, `test/unit/bots.test.ts`, `test/unit/testTools.test.ts` - 옛 표 도우미 삭제와 이름 바꾸기

## Decisions Made

key-decisions 참고. 특히 CandidateVoteLine 은 소비자 grep 결과(VoteLogEntry.cand.votes, test/unit/verdict.test.ts) 때문에 PointLine 과 합치지 않았다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 막힘 해소] Task 1 에서 apply 본체와 actAsBot 분기를 남김**
- **Found during:** Task 1
- **Issue:** 계획은 Task 1 에서 handle/apply 네 함수를 모두 지우라고 했으나, apply 본체는 actAsBot 의 두 case 가 쓰고 그 case 는 BotAct 멤버(Task 2 범위)에 묶여 있어 지우면 Task 1 커밋이 컴파일되지 않는다
- **Fix:** Task 1 은 switch case 와 handle 두 함수까지, apply 두 본체와 actAsBot case 는 BotAct 와 함께 Task 2 에서 지웠다
- **Commit:** c3da791, 2d3b096

**2. [Rule 3 - 막힘 해소] 계획 files 밖 시험 파일 수정**
- test/unit/testTools.test.ts: `botCandidateTarget` 이름을 `botPointTarget` 으로 바꿨다(이름이 사라져 tsc 가 깨진다)
- test/worker/trial.test.ts: 계획은 "파일이 files 밖이면 schemas.test 로 대신" 이라 했지만 must_haves 가 소켓 시험을 요구해 trial.test 에 한 케이스를 더했다
- **Commit:** c3da791, 2d3b096

**3. [계획 보정] test(08-21) 커밋 인수 기준**
- Task 1 인수 기준 `git log --grep="^test\(0?8-21\):"` 한 줄 이상은 충족하지 않는다. 사용자가 TDD 모드를 끄고 RED 전용 커밋을 만들지 말라고 결정했다. 시험은 코드 삭제와 같은 커밋(refactor)에 들어 있다

**Total deviations:** 3 (Rule 3 ×2, 계획 보정 ×1). **Impact:** 범위 변화 없음.

## Issues Encountered

없음. 전체 vitest 와 타입 검사는 첫 실행에 초록이었다.

## 이월 항목

- 단계 이름(PhaseId 의 execVote·candidateVote·candidateVoteReveal)과 PHASE_DEFS·audience·view DAY_PHASES·presence.ts·화면 표 행, 후보 공개 길이 상수, 처형 문구 번호, protocol `notMajority` 는 08-22 가 지운다.
- 옛 저장 방 정규화(Player 옛 키 execVote·candidateVote 가 저장본에 남을 수 있음)는 08-22 normalizeStoredRoom 이 맡는다 — 이 키는 이제 Player 타입에 없으므로 08-22 는 지역 교차 타입으로 구조 분해해야 한다.
- scripts/gallery.mjs 의 옛 단계 이름 대기는 이 계획에서 건드리지 않았다(스크립트 시험·타입 검사 영향 없음). 08-25 에서 다룬다.

## Known Stubs

없음.

## Threat Flags

없음. 입력 경로를 줄이기만 했다. T-08-10(옛 번들 메시지)은 스키마 거부 시험으로, T-08-51(시험 삭제)은 옛 이름 0·skip 0 grep 으로 확인했다.

## Self-Check

- `shared/game/vote.ts` 없음, 옛 이름 grep(shared·worker·src: execTallyOf·voteAgree·voteTarget·enterCandidateVoteReveal, test/unit·helpers·client: 옛 도우미) 0건, `.skip(`·`.todo(` 0건, botPointTarget 이 bots.ts 와 bots.test.ts 에 있음, 스키마에 옛 literal 0건: 통과
- 커밋 c3da791·2d3b096 이 HEAD 조상에 있음: 통과
- `npm run typecheck`(오류 0), `npx vitest run`(135 파일 3685 통과), `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs`(288 통과): 통과

## Self-Check: PASSED
