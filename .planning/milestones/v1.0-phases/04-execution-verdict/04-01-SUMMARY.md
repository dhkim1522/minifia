---
phase: 04-execution-verdict
plan: 01
subsystem: game-server
tags: [durable-object, websocket, tick, vote, anonymity, tdd, tracer]

requires:
  - phase: 03-night-morning
    provides: pickTarget 검사 순서 패턴, buildView 허용 목록, tick 연쇄 마감, 방 DO 껍데기·본체 구조
provides:
  - 4페이즈 와이어 타입 전체(shared/protocol.ts 한 곳): 새 단계 여섯, execVote 메시지, VoteLogEntry·ExecutionView·SummaryRow·GameResult·NoExecutionReason
  - 단계 표 여섯 행과 시간 상수 다섯 개(phases.ts), discussion.next = execVote
  - tick 마감 분기(DeadlineResult.next?)와 진입 훅 세 번째 인자 at
  - shared/game/vote.ts 순수 규칙 네 개(castExecVote·execTallyOf·resolveExecVote·enterExecVote)
  - 방 DO 의 execVote 처리(값이 바뀌면 전원 방송)와 switch never 검사 두 곳
affects: [04-02, 04-03, 04-04, 04-05, 04-06, 04-07, 04-09, 04-10]

actuals:
  tokens: 16000
  tasks: 1
  commits: 3
plan_head_before: 8838b23410682e320c61f733a47d4c35a6c3bcdc
plan_head_after: 4c1c9adb2e1d64143d6f6db6582ad39a45702382
commits: 3

tech-stack:
  added: []
  patterns:
    - "마감 훅이 next 를 돌려주면 표의 기본 next 대신 그 단계로 간다 (표는 데이터만)"
    - "개인 표는 서버 전용 필드에 두고 마감 훅이 키째 지운다 — 익명을 데이터가 없다는 사실로 지킨다"
    - "실시간 집계와 마감 집계가 같은 함수(execTallyOf)"

key-files:
  created:
    - shared/game/vote.ts
    - test/unit/vote.test.ts
    - test/worker/vote.test.ts
  modified:
    - shared/protocol.ts
    - shared/game/phases.ts
    - shared/game/tick.ts
    - shared/game/room.ts
    - shared/game/view.ts
    - shared/schemas.ts
    - worker/room.ts
    - HANDOFF.md

key-decisions:
  - "분기는 마감 훅의 next? 로 표현하고 PHASE_DEFS.next 는 기본 다음 단계 데이터로 남긴다"
  - "여부 투표 개인 표는 resolveExecVote 가 집계 직후 키째 지운다 (재량 결정, 되돌리기 쉬움)"
  - "day.voteLog 는 타입 optional, 서버는 낮 단계마다 항상 싣는다"
  - "ended 도 DAY_PHASES 에 넣는다 (공개 정보뿐이라 누출 없음)"
  - "execVote 는 pick 과 달리 값이 바뀌면 모든 소켓이 각자 view 를 받는다 (집계 수가 전원 공개 정보)"

requirements-completed: [VOTE-01, CONN-02]

coverage:
  - id: D1
    description: "낮 토론 마감 뒤 execVote(10초)로 넘어가고 모든 소켓이 phaseDurationMs 10000 의 execVote state 를 받는다"
    requirement: "VOTE-01"
    verification:
      - kind: integration
        ref: "test/worker/vote.test.ts#execVote 단계에 들어가면 네 소켓 모두 phaseDurationMs 10000 과 day.execTally {0,0} 을 받는다"
        status: pass
    human_judgment: false
  - id: D2
    description: "값이 바뀔 때마다 전원이 같은 execTally 를 한 프레임씩 받고 me.voteAgree 는 본인에게만 있으며 같은 값 재전송은 무전송이다"
    requirement: "VOTE-01"
    verification:
      - kind: integration
        ref: "test/worker/vote.test.ts#A 의 찬성은 네 소켓 모두에게 정확히 한 프레임으로 가고 집계가 같다"
        status: pass
      - kind: integration
        ref: "test/worker/vote.test.ts#같은 값을 다시 보내면 네 소켓 모두 프레임이 없고, 반대로 바꾸면 모두 {0,1} 을 받는다"
        status: pass
    human_judgment: false
  - id: D3
    description: "익명 차분: 누가 던졌는지 구별할 정보가 프레임에 없다 (소켓 차분 + 순수 뷰 차분)"
    requirement: "VOTE-01"
    verification:
      - kind: integration
        ref: "test/worker/vote.test.ts#차분: 관찰자 O 가 A 의 투표 뒤 받은 view 와 B 의 투표 뒤 받은 view 는 serverNow·day.execTally 를 빼면 같다"
        status: pass
      - kind: unit
        ref: "test/unit/vote.test.ts#차분(기본형)"
        status: pass
    human_judgment: false
  - id: D4
    description: "마감 분기: 과반 초과면 candidateVote, 같거나 적거나 0표면 night. 마감은 이전 마감 + 길이로 이어지고 개인 표는 저장소에서 사라진다"
    requirement: "VOTE-01"
    verification:
      - kind: unit
        ref: "test/unit/vote.test.ts#tick 연쇄 (D-01·D-04·D-25)"
        status: pass
      - kind: integration
        ref: "test/worker/vote.test.ts#여부 투표 마감 분기 (D-04, T-04-02)"
        status: pass
    human_judgment: false
  - id: D5
    description: "끊긴 사람이 있어도 tick 이 마감대로 넘기고 던진 뒤 끊긴 사람의 표는 센다 (CONN-02)"
    requirement: "CONN-02"
    verification:
      - kind: unit
        ref: "test/unit/vote.test.ts#CONN-02 — 끊긴 사람이 있어도 타이머대로"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-10-26
status: complete
---

# Phase 4 Plan 01: 여부 투표 트레이서 Summary

**낮 토론 → 처형 여부 투표(10초) → 마감 분기(후보 선택 / 밤)를 와이어 타입·단계 표·tick 훅·순수 규칙·뷰·입력 스키마·방 DO·실제 소켓까지 한 줄로 꿰고, 값이 바뀔 때마다 전원에게 같은 집계를 방송하되 개인 표는 마감 훅에서 키째 지우는 익명 구조를 증명했다.**

## 진행 기록

Task 1 — RED cbc9657 / GREEN 11e0aeb / 검증 전부 통과(아래) / 남은 태스크 없음. HANDOFF 진행 줄 4c1c9ad(로컬 커밋만). 이어 가는 실행기는 04-02 부터.

## Performance

- **Duration:** 약 35분 (시작 시각을 따로 기록하지 못해 추정값)
- **Tasks:** 1 (tracer, tdd)
- **Files:** 신규 3(vote.ts, 테스트 2) · 수정 8 · 합계 11
- **BASE:** 8838b23410682e320c61f733a47d4c35a6c3bcdc

## Accomplishments

- `shared/protocol.ts` 한 곳에 4페이즈 와이어 계약을 정했다: PhaseId 여섯(execVote·candidateVote·candidateVoteReveal·defense·execution·ended), `EXECUTION_PHRASE_COUNT = 4`, `ExecTally`·`CandidateVoteLine`·`VoteLogEntry`·`ExecutionView`·`NoExecutionReason`·`SummaryRow`·`GameWinner`("citizenWin"|"mafiaWin")·`GameResult`, `MyInfo.voteAgree/voteTarget`, `DayView.voteLog/execTally/candidate/execution/noExecution`, `RoomView.result`, 메시지 `{t:"execVote", agree}`.
- 단계 표에 새 여섯 행과 상수 다섯 개(`EXEC_VOTE_MS` 등)를 더하고 `discussion.next = execVote`, `ended` 는 마감 없는 종단 행으로 뒀다.
- tick: `DeadlineResult { state, stay, next? }`. 훅이 next 를 주면 표의 기본 next 보다 앞선다. 진입 훅은 세 번째 인자 `at`(= 이전 마감)을 받는다. 알람 지연 따라잡기에서도 마감은 이전 마감 + 길이로 이어진다.
- `vote.ts`: `castExecVote`(단계 → 행위자 → 불리언 → 같은 값이면 입력 그대로, 마감 불변), `execTallyOf`(생존자의 true/false 만, undefined 를 반대로 세지 않음), `resolveExecVote`(찬성×2 > 던진 표, 집계 직후 execVote 키 삭제, voteLog 에는 `{n, exec:{yes,no,passed}}` 만), `enterExecVote`(흔적 청소).
- 뷰: `DAY_PHASES` 에 새 단계 여섯 모두(ended 포함), `day.voteLog` 항상(필드별 복사), `day.execTally` 는 execVote 단계에서 모든 viewer 에게 같은 값, `me.voteAgree` 는 생존한 본인에게만.
- 방 DO: `handleExecVote`(껍데기) / `applyExecVote`(본체). 값이 바뀌면 `persistAndBroadcast`, 같은 값이면 저장·전송 없음, 마감은 건드리지 않아 reschedule 없음. `webSocketMessage`·`actAsBot` 의 switch 끝에 `never` 검사 default 를 뒀다(새 메시지·봇 행동이 조용히 무시되지 않음).

## TDD 기록

**RED** (`test(04-01)`, cbc9657): `test/unit/vote.test.ts`(33개)·`test/worker/vote.test.ts`(10개). 명령 `npx vitest run test/unit/vote.test.ts --reporter=tap-flat` 와 `npx vitest run --project worker test/worker/vote.test.ts --reporter=tap-flat`, 둘 다 종료 코드 1.
- 단위: 33개 중 31개 실패, 2개는 회귀 가드라 통과(discussion 길이 90초, 비투표 단계 view 에 execTally 키 없음).
- 워커: 10개 전부 실패 — `advanceTo` 가 execVote 에 닿지 못하고 night 로 간다(`expected 'night' to be 'execVote'`), 메시지는 BAD_MESSAGE.
- `gsd_run check tdd-red-evidence` 결과 둘 다 `RED_EVIDENCE_OK / target_test_failed`.
- 의미 점검(semanticAssessment): 단위 목표 테스트(`단계 표 … 표대로다`)는 `PHASE_DEFS.execVote` 가 없어 단언에서 실패, 나머지는 `vote.ts` 껍데기가 던지거나 `stateAt(…, "execVote")` 가 닿지 못해 실패한다. 워커 목표 테스트(`A 의 찬성은 …`)는 단계가 없어 `advanceTo` 단언에서 실패. 모두 "기능이 없다" 는 의도한 이유다.
- RED 커밋에 `shared/game/vote.ts` 껍데기(던지는 함수 네 개)를 함께 넣었다. 모듈이 없으면 단위 파일 전체가 import 로 죽어 INVALID_RED(`fixture_or_load_failure`)가 되기 때문이다.

**GREEN** (`feat(04-01)`, 11e0aeb): 위 구현. 단위 33/33, 워커 10/10 통과.

**REFACTOR**: 없음.

## Verification

| 명령 | 결과 |
|---|---|
| `npx vitest run test/unit/vote.test.ts` | 33 passed |
| `npx vitest run --project worker test/worker/vote.test.ts` | 10 passed |
| `npx tsc -p tsconfig.worker.json --noEmit` | 종료 코드 0 |
| `node scripts/tsc-scoped.mjs tsconfig.app.json '^(shared\|test/unit\|test/helpers)/'` | OK (범위 밖 오류만 4건 = src 쪽 PhaseId 표, 04-02 가 닫음) |
| `npx vitest run test/unit/handoff.test.ts` | 통과, HANDOFF 2915바이트 |

수용 기준 그렙 전부 충족: `execVote: Object.freeze` 1, `next: "execVote"` 1, `DeadlineResult` 2, vote.ts 내보내기 4, `case "execVote"` 1, `: never` 2, `interface VoteLogEntry` 1, `"citizenWin"` 1, `NoExecutionReason` 2. `test(04-01)` 커밋이 `feat(04-01)` 커밋보다 먼저다. `04-01 완료` 가 HANDOFF 에 1줄.

전체 `npx vitest run`: **20 failed | 1912 passed (1932)**, 실패 파일 6개. 계획이 예고한 "옛 회귀 빨강"이며 아래 Deferred Issues 에 정리했다. `git push`·`npm run deploy` 는 실행하지 않았다: push 없음 — 04-05 가 웨이브 1·2·3 을 함께 push.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 차분 단위 테스트의 탈락 관전자 표본 준비 오류**
- **Found during:** GREEN 검증
- **Issue:** 탈락 관전자를 `n-1` 번 자리로 잡았는데 n=5 에서 그 자리가 S2 의 투표자(seat 4)라 두 상태의 집계가 달라졌다(테스트 준비 오류, 구현 결함 아님).
- **Fix:** 두 상태 모두 표를 안 던진 seat 0 을 탈락 관전자로 썼다.
- **Files modified:** test/unit/vote.test.ts
- **Commit:** 11e0aeb (feat 커밋에 포함)

**2. [Rule 3 - Blocking] RED 커밋에 vote.ts 던지는 껍데기 포함**
- **Found during:** RED
- **Issue:** 계획은 "없는 모듈을 import 하므로 실패" 라 했지만, 그러면 단위 파일 전체가 로드 실패라 `INVALID_RED` 로 분류돼 GREEN 을 허가하지 못한다.
- **Fix:** `shared/game/vote.ts` 에 던지는 함수 네 개를 둬 import 는 되고 단언에서 실패하게 했다. GREEN 에서 전부 교체.
- **Commit:** cbc9657

**Total deviations:** 2 (Rule 1 ×1, Rule 3 ×1). **Impact:** 범위 변화 없음.

## Deferred Issues

계획이 예고한 "옛 회귀 빨강"(전체 20건). 이 중 일부는 **04-02 의 파일 목록에 없는 파일**이다 — 04-02 가 `npm test` 초록을 약속하려면 범위를 넓혀야 한다.

| 파일 | 건수 | 원인 | 04-02 목록 |
|---|---|---|---|
| test/unit/tick.test.ts | 6 | 단계 키 8개 단언, discussion → night 직결, 마감 연쇄 숫자 | 있음 |
| test/worker/alarm.test.ts | 1 | steps 표에서 discussion 다음 night | 있음 |
| test/unit/scenes.test.ts | 2 | PHASE_SCENE·EXPECTED_SCENE 에 새 단계 행 없음 | 있음 |
| test/unit/view.test.ts | 8 | `day` 키 단언이 `claimLog,n,roles` 정확 일치(이제 `voteLog` 가 항상 붙는다), 단계 목록 `PHASES`·`stateAt`·`richStateAt`·`nightActions` 가 discussion → night 직결 전제, 단계별 마감 시각 | **없음** |
| test/unit/claim.test.ts | 2 | `day` 키 정확 일치(`claimLog,n,roles(,turn)`) 에 `voteLog` 추가 필요 | **없음** |
| test/unit/night.test.ts | 1 | `따라잡기` 테스트가 discussion 마감 + 밤 + 아침 + 2초로 claim 에 닿는다고 가정(execVote 10초가 끼어듦) | **없음** (04-06 은 night.test 를 건드리지만 다른 이유) |

수정은 모두 기계적이다(`voteLog` 키 추가, execVote 10초 반영, 단계 목록에 새 단계 추가). 04-04 가 `view.test.ts` 의 `stateAt` 을 다루지만(Pitfall 12) 그 전에 04-02 의 초록 확인과 04-05 의 push 가 먼저라, 04-02 에 위 세 파일을 더하는 편이 안전하다.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크 표면은 `execVote` 메시지 하나이며 위협 모델 T-04-01~05 가 다룬다.

- T-04-01(집계 방송 누출): 허용 목록 뷰 + 소켓 차분·순수 차분 테스트 통과. 소규모 산술 추론은 알려진 한계(결정 0036 에 기록 예정, 04-03).
- T-04-02(마감 뒤 표 잔존): 단위·워커 테스트가 저장소에 `execVote` 키 부재를 단언.
- T-04-03(남의 이름): 메시지에 seat·id 없음, strictObject 가 덧붙은 키 거부(테스트 통과).
- T-04-04(마감 뒤·틀린 단계): `advance` 선행 tick 으로 WRONG_PHASE, 마감 불변 테스트 통과.

## Next Phase Readiness

Ready for 04-02. 뒤 계획이 의존하는 이름·필드·분기 방식이 고정됐다. 주의: `nightLog`·`NightLogEntry` 타입과 `Player.candidateVote`·`RoomState.verdict.candidate` 필드는 정의만 했고 채우는 일은 04-04·04-06 몫이다. 후보 선택 메시지 `{t:"candidateVote"}` 는 04-07 이 더한다.

## Self-Check: PASSED

- 생성 파일 존재: `shared/game/vote.ts`, `test/unit/vote.test.ts`, `test/worker/vote.test.ts` 확인.
- 커밋 존재: cbc9657(RED), 11e0aeb(GREEN), 4c1c9ad(HANDOFF) 모두 HEAD 의 조상.
