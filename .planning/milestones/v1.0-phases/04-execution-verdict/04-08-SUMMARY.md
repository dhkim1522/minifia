---
phase: 04-execution-verdict
plan: 08
subsystem: test-room-bots
tags: [bots, test-tools, execution-vote, candidate-vote, defense, durable-object, workerd-integration, tdd]

requires:
  - phase: 04-execution-verdict
    provides: "04-03 투표 규칙(castExecVote·castCandidateVote), 04-05 변론 템플릿, 04-07 candidateVote 배선·applyExecVote/applyCandidateVote·소켓 도우미"
provides:
  - "shared/game/bots.ts: BotAct execVote/candidateVote, botExecAgree, botCandidateTarget, 여부·후보·변론 계획 분기와 계획 키, EXEC_YES_PERCENT 등 이름 붙인 상수"
  - "shared/game/testTools.ts: botsVoteNow — 투표 단계 넘기기 전에 안 던진 살아 있는 봇이 사람과 같은 본체로 던진다"
  - "worker/room.ts actAsBot: case execVote → applyExecVote, case candidateVote → applyCandidateVote (사람과 같은 본체, 특권 없음)"
  - "test/worker/helpers.ts: editRoom, mapPlayers, votesIn, until, skipOnce, skipThrough, driveToEnded / test/helpers/voteState.ts: startedFrom, stateWithVerdict 의 lobby 옵션"
affects: [04-09, 04-10, 화면 계획(테스트 방 한 판 확인), scripts/e2e]

actuals:
  tokens: 13000
  tasks: 3
  commits: 10
plan_head_before: aa85bb036db2cc7ca5cf5f36a24d700631978df3
plan_head_after: fb43bfec0c8a58314ef810c8c4fa96c25c0959e3
commits: 10

tech-stack:
  added: []
  patterns:
    - "봇 계획 난수는 새 단계 분기 안에서만 늘어난다 — 기존 claim·discussion·night 계획은 같은 시드에서 해시로 고정"
    - "넘기기의 봇 대신 던지기(botsVoteNow)는 계획과 같은 결정 함수(botExecAgree·botCandidateTarget)를 쓰되 지연 난수는 부르지 않는다"
    - "봇 무작위 표로 분기를 정할 수 없는 소켓 테스트는 저장된 표를 editRoom 으로 직접 정한다(통과 여부·후보)"

key-files:
  created:
    - .planning/phases/04-execution-verdict/deferred-items.md
  modified:
    - shared/game/bots.ts
    - shared/game/testTools.ts
    - worker/room.ts
    - test/helpers/voteState.ts
    - test/unit/bots.test.ts
    - test/unit/testTools.test.ts
    - test/worker/helpers.ts
    - test/worker/bots.test.ts
    - test/worker/testTools.test.ts
    - HANDOFF.md

key-decisions:
  - "봇 여부 투표 찬성 70%, 지연 여부 1000+[0,6000)·후보 1000+[0,9000)·변론 1000+[0,4000)ms. 모두 bots.ts 상수 한 곳이고 0036 의 바뀔 수 있는 기본값이다"
  - "후보 봇 대상은 자기를 뺀 살아 있는 seat 오름차순에서 randInt(길이) — 역할을 보지 않는다(봇이 마피아를 아는 척하지 않는다)"
  - "변론은 후보인 봇만 defNotMe·defCitizen·defPlead 중 하나(randInt(3)); 후보가 아닌 봇은 변론 중 아무것도 하지 않는다"

requirements-completed: []
requirements-server-rules-done: [VOTE-01, VOTE-02, VOTE-03, END-02]  # 테스트 방 봇·도구의 서버 쪽 증명만. 화면이 걸린 요구사항이라 REQUIREMENTS 체크박스는 열어 둔다

coverage:
  - id: D1
    description: "여부 투표 봇 계획: 살아 있는 봇마다 execVote 한 행(시각 1000 이상 ~ 마감-500 미만), randInt 순서 봇마다 [100, 6000], 찬성은 randInt(100) < 70. 후보 선택 계획: 자기를 뺀 살아 있는 한 명, 순서 [후보 수, 9000], 다른 사람이 없으면 행·난수 없음. 후보가 봇인 변론: 그 봇만 템플릿 한 행(순서 [3, 4000]), 사람이면 빈 계획"
    requirement: "VOTE-01"
    verification:
      - kind: unit
        ref: "test/unit/bots.test.ts#봇 투표·변론 계획: execVote / candidateVote / defense"
        status: pass
    human_judgment: false
  - id: D2
    description: "기존 claim·discussion·night 계획이 같은 시드에서 예전과 같고(해시 고정) 탈락한 봇·사람이 모두 끊긴 방은 새 세 단계에서도 행동이 없으며 공개·처형·종료에는 계획 키가 없다"
    requirement: "VOTE-02"
    verification:
      - kind: unit
        ref: "test/unit/bots.test.ts#봇 투표·변론 계획: 키 / 회귀"
        status: pass
    human_judgment: false
  - id: D3
    description: "execVote·candidateVote 넘기기: 안 던진 봇이 먼저 던진 뒤 분기(통과 → candidateVote, 아니면 night, 후보 있으면 defense, 승패면 ended)를 따르고 이미 던진 사람·봇의 표와 난수는 건드리지 않으며 봇이 없는 방은 난수를 부르지 않는다. ended 넘기기는 WRONG_PHASE"
    requirement: "VOTE-03"
    verification:
      - kind: unit
        ref: "test/unit/testTools.test.ts#skipPhase: 투표 단계에서 안 던진 봇이 먼저 던진다 / 분기 단계를 따라 끝까지 넘어간다"
        status: pass
    human_judgment: false
  - id: D4
    description: "대기실 복귀는 execution·ended 에서도 voteLog·verdict·execution·lastExecPhrase·nightLog·winner 와 플레이어의 execVote·candidateVote 를 남기지 않는다(최상위·플레이어 키 목록 정확 비교, 소켓에서 저장소 키와 다시 시작 시 만료 시작 + 3시간)"
    requirement: "END-02"
    verification:
      - kind: unit
        ref: "test/unit/testTools.test.ts#resetToLobby: 투표·처형·종료 필드를 모두 지운다"
        status: pass
      - kind: integration
        ref: "test/worker/testTools.test.ts#ended 에서 testReset"
        status: pass
    human_judgment: false
  - id: D5
    description: "실제 소켓: 봇 여부 표마다 방장이 state 를 받고 집계 합계가 봇 수만큼 늘며 방장 view 에 남의 표가 없고, 후보 선택 표는 방장 소켓에 프레임이 없고 공개 구간 voteLog 에 봇 줄이 있으며, 후보가 봇이면 그 자리에서 온 chat 을 받는다. 투표·변론·처형·종료를 지나는 동안 방장·손님 프레임에 isBot·botPlan·봇 id·token 이 없다"
    requirement: "VOTE-02"
    verification:
      - kind: integration
        ref: "test/worker/bots.test.ts#봇 투표·변론 / 누출 없음: 투표·변론·처형·종료"
        status: pass
    human_judgment: false

duration: 약 35분
completed: 2026-10-28
status: complete
---

# Phase 4 Plan 08: 테스트 방 봇 투표·변론·넘기기·복귀 Summary

**서버 봇이 사람과 같은 처리기로 처형 여부 투표(찬성 70%)·후보 선택(자기를 뺀 한 명)·후보일 때의 변론을 던지고, 테스트 방 [다음 단계로 넘기기] 가 투표 단계에서 안 던진 봇 표를 먼저 채운 뒤 분기를 따르며, 대기실 복귀가 종료 단계에서도 새 필드를 남기지 않음을 실제 소켓(workerd)으로 증명했다.**

## 진행 기록

Task 1 — RED 0b7f78c / GREEN 0704026 / unit 1001 통과(bots.test.ts 67: 신규 17), tsc app 범위 0 / 체크포인트 c903fac. 참고: `worker/room.ts` actAsBot 의 never 검사가 새 BotAct 두 변형 때문에 Task 3 GREEN 전까지 worker tsc 에서 실패했다(계획대로 Task 3 에서 이었다).
Task 2 — RED cebbb57 / GREEN 9722c8a / unit 1012 통과(testTools.test.ts 신규 11, bots.test.ts 67), tsc app 범위 0 / 체크포인트 3a829ca.
Task 3 — RED e90b906 / GREEN 2f1fbaf / worker 178 통과(신규 7), `npm test` 87 파일 2145 통과, tsc app·worker 0 / 체크포인트 7bc347e / 남은 태스크 없음. HANDOFF 진행 줄 fb43bfe.

## Accomplishments

- `shared/game/bots.ts`: `BotAct` 에 `{ t: "execVote"; agree }`·`{ t: "candidateVote"; target }`, `botExecAgree`(randInt(100) < `EXEC_YES_PERCENT` 70), `botCandidateTarget`(`botNightTarget` 모양, 자기 제외 생존자 seat 오름차순, 역할을 보지 않음), `botPlanKey` 에 execVote·candidateVote·defense, `planFor` 세 분기. 후보인 봇만 변론하고 후보 선택은 다른 사람이 없으면 난수를 부르지 않는다. 머리 주석의 행동 목록·난수 계약을 고쳤다.
- `shared/game/testTools.ts`: `botsVoteNow` — execVote 단계면 `execVote` 미정의 살아 있는 봇이 `castExecVote(botExecAgree)`, candidateVote 면 `castCandidateVote(botCandidateTarget)`(대상 없으면 건너뜀). `skipPhase` 가 밤(`botsPickNow`)에 더해 두 투표 단계에서 부른다. 분기 단계(공개·변론·처형·종료)는 코드 변경 없이 마감 훅의 결과를 따른다. `resetToLobby` 는 코드 변경이 필요 없었다(허용 목록 리터럴) — 테스트로 확인하고 주석에 새 필드 이름을 적었다.
- `worker/room.ts`: `actAsBot` 에 `case "execVote"` → `applyExecVote`, `case "candidateVote"` → `applyCandidateVote`. 다른 경로는 바꾸지 않았다.
- 테스트 도우미: `test/helpers/voteState.ts` 에 `startedFrom(lobby, seed, phase)` 와 `stateWithVerdict` 의 `lobby` 옵션(봇이 낀 방을 실제 전이로 투표 단계에 보낸다), `test/worker/helpers.ts` 에 `editRoom`·`mapPlayers`·`votesIn`·`until`·`skipOnce`·`skipThrough`·`driveToEnded`.

## TDD 기록

**Task 1 RED** (`test(04-08)`, 0b7f78c): `npx vitest run test/unit/bots.test.ts --reporter=tap-flat`, 종료 코드 1, 67개 중 10개 실패(`botCandidateTarget is not a function`, 새 단계 키가 null, 계획 행 0개). 의미 점검: 실패 이유는 구현 부재다. 기존 claim·discussion·night 계획의 고정값(해시)은 HEAD 에서 먼저 뽑아 박았다.
**Task 1 GREEN** (`feat(04-08)`, 0704026): 67/67 통과, unit 전체 1001 통과.

**Task 2 RED** (`test(04-08)`, cebbb57): `npx vitest run test/unit/testTools.test.ts --reporter=tap-flat`, 종료 코드 1, 신규 11개 중 4개 실패(봇 표 없이 마감돼 `night/…` 가 되거나 votes 가 비어 있음). 나머지 7개(분기 따라가기·ended WRONG_PHASE·봇 없는 방 난수 없음·대기실 복귀 키 목록)는 이미 맞는 회귀 가드로 통과.
**Task 2 GREEN** (`feat(04-08)`, 9722c8a): 141/141, unit 전체 1012 통과.

**Task 3 RED** (`test(04-08)`, e90b906): `npx vitest run --project worker test/worker/bots.test.ts test/worker/testTools.test.ts --reporter=tap-flat`, 종료 코드 1, 실패 2개 — execVote(`until: 봇 표 3개 이(가) 이뤄지지 않았다`), candidateVote(같은 이유). 의미 점검: 봇 계획은 이미 서지만 `actAsBot` 이 새 변형을 처리하지 않아 표가 안 들어간다. 변론(봇 say 는 기존 `case "say"`), 누출 확장, 넘기기·복귀·ended 넘기기는 이미 맞아 통과(회귀 가드). worker tsc 는 `worker/room.ts(515,15): TS2322 … not assignable to type 'never'` 로 실패 — never 검사가 빠뜨림을 잡았다.
**Task 3 GREEN** (`feat(04-08)`, 2f1fbaf): worker 178/178(세 번 반복 모두), `npm test` 통과, 두 tsc 0.

**REFACTOR**: 없음.

## Verification

| 명령 | 결과 |
|---|---|
| `npx vitest run test/unit/bots.test.ts` | 67 passed |
| `npx vitest run --project unit` | 37 파일 1012 passed |
| `npx vitest run --project worker test/worker/bots.test.ts test/worker/testTools.test.ts` | 통과(세 번 반복 모두) |
| `npx vitest run --project worker` | 178 passed (두 번 반복) |
| `npm test` | 87 파일 2145 passed, 실패 0 |
| `node scripts/tsc-scoped.mjs tsconfig.app.json '^(shared\|test/unit\|test/helpers)/'` | OK |
| `npx tsc -p tsconfig.app.json --noEmit` / `npx tsc -p tsconfig.worker.json --noEmit` | 종료 코드 0 / 0 |

수용 기준 그렙: `export function botCandidateTarget` bots.ts 1(기준선 0), `t: "execVote"; agree: boolean` bots.ts 1, `function botsVoteNow` testTools.ts 1, `applyCandidateVote(step.botId`·`applyExecVote(step.botId` room.ts 각 1. 커밋 순서: `test(04-08): bots vote`(0b7f78c) → `feat(04-08): bots vote`(0704026), `test(04-08): test-room skip`(cebbb57) → `feat(04-08): test-room skip`(9722c8a), `test(04-08): bots and test tools`(e90b906) → `feat(04-08): bots act`(2f1fbaf). 배포하지 않았다(D-26).

## 계획과 달라진 점·알아 둘 것

- **계획 순서 때문에 worker tsc 가 Task 1 GREEN~Task 3 GREEN 사이 두 커밋 동안 실패했다.** `BotAct` 변형이 늘면 `actAsBot` 의 never 검사가 컴파일을 막는 설계(Pitfall 15)가 그대로 작동한 것이고 Task 3 에서 이어 해소했다. 최종 상태는 두 tsc 모두 0.
- **변론에 새 DO 코드가 필요 없었다.** 후보 봇의 변론은 기존 `case "say"` 로 나가 `applySay` 의 후보 검사(04-05)를 그대로 지난다.
- **봇 표가 무작위라 소켓 테스트는 저장된 표를 `editRoom` 으로 정했다**("여부 통과"·"봇이 후보"를 고정하려고). 봇 자신의 투표 동작은 `forceBotsDue` 로 실제 알람 경로를 태워 따로 증명했다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 넘기기 변경이 만든 기존 워커 테스트의 무작위성**
- **Found during:** Task 3 (RED 단계 전체 worker 반복 실행, 한 번 실패)
- **Issue:** Task 2 로 `testSkip` 이 여부 투표에서 봇 표를 채우게 되자 `test/worker/bots.test.ts` 의 "밤: 마피아 봇이 저절로 pick …" 과 "누출 없음" 이 낮을 건너뛰는 동안 봇 표 70% 찬성 → 후보 선택 → 처형 경로를 무작위로 타, 방장(마피아)이 처형되거나 판이 `ended` 로 끝나 `night` 에 닿지 못했다(전체 실행 7번 중 1번 실패).
- **Fix:** `skipDayToNight` 도우미 — 여부 투표에서 봇 전원 반대를 저장소에 정해 두고 넘겨 밤으로 곧장 가게 했다. 두 테스트가 이 도우미를 쓴다(테스트 의도·단언은 그대로).
- **Files modified:** test/worker/bots.test.ts
- **Commit:** e90b906

### 범위 밖(미룸)

- `scripts/uat-test-bots.mjs`·`scripts/e2e/browser.mjs` 도 같은 가정(봇 낀 방에서 `testSkip` 으로 낮을 건너 밤)을 하므로 04-08 이후 무작위로 처형·종료를 만날 수 있다. 배포본 수동·E2E 용이라 이번에 돌리지 않았다. `deferred-items.md` 에 적었다 — 화면 웨이브에서 E2E 를 4페이즈 흐름에 맞출 때 고친다.

## Auth gates

없음.

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크 입구·인증 경로·신뢰 경계 변경이 없다. 봇은 사람과 같은 `castExecVote`·`castCandidateVote`·`applyExecVote`·`applyCandidateVote` 를 지나므로(T-04-27) 자기 지목은 BAD_MESSAGE 로 막히고, 허용 목록 view 가 그대로라 봇 표시가 프레임에 없음을 투표·종료까지 소켓으로 확인했다(T-04-28). 일반 방의 넘기기는 기존 `checkTestHost` 로 BAD_MESSAGE(T-04-29).

## Self-Check: PASSED

- 파일: bots.ts, testTools.ts, room.ts, voteState.ts, 단위·워커 테스트 파일 여섯, helpers.ts, deferred-items.md 모두 존재.
- 커밋: 0b7f78c, 0704026, cebbb57, 9722c8a, e90b906, 2f1fbaf 모두 HEAD 의 조상.
