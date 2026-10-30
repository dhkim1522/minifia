---
phase: 04-execution-verdict
plan: 15
subsystem: test-room-bot-vote
tags: [testBotVote, bots, test-tools, ws-message, view, leak, tdd]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-08 봇 투표 구현(botExecAgree·botCandidateTarget·botsVoteNow), 04-12 서버 완결"
provides:
  - "ClientMessage testBotVote { exec: random|yes|no, pick: random|host|other } 와 z.strictObject 스키마"
  - "RoomState.testBotVote?: { exec?, pick? } — 무작위가 아닌 값만 저장, resetToLobby 뒤에도 남음"
  - "setBotVote(state, actorId, exec, pick) — 검사 순서 BAD_MESSAGE → NOT_HOST → WRONG_PHASE → 값 범위"
  - "botExecAgree(randInt, fixed?)·botCandidateTarget(state, bot, randInt, pick?) — 계획(planFor)과 넘기기(botsVoteNow)가 같은 설정을 읽음"
  - "me.testBotVote — 테스트 방 방장의 대기실 view 에서 무작위가 아닌 값이 있을 때만"
  - "worker/room.ts handleTestBotVote — 방장 소켓에만 state"
affects: [04-17 시트의 봇 투표 줄, 04-31·04-32 E2E(처형 무효·처형 진행·결과 화면을 결정적으로 만듦)]

actuals:
  tokens: 21000
  tasks: 3
  commits: 5
plan_head_before: 1f2046fe7d058ce5ab8fdebae8f77af634885896
plan_head_after: 921451410ddfa0a75922ac1018c01848623fa6b9

tech-stack:
  added: []
  patterns:
    - "방장 도구 메시지는 절대값 한 메시지로 두 값을 함께 정한다(testBots 의 count 와 같은 방식 — 연타해도 같은 요청)"
    - "고정 값이면 결정 난수를 건너뛰고 지연 난수는 그대로 부른다 — 설정이 없으면 같은 시드의 계획이 한 글자도 바뀌지 않는다"
    - "소켓 한 줄 요약(summary)·settle 로 '프레임이 오지 않았음'을 증명한다"

key-files:
  created: []
  modified:
    - shared/protocol.ts
    - shared/schemas.ts
    - shared/game/room.ts
    - shared/game/view.ts
    - shared/game/bots.ts
    - shared/game/testTools.ts
    - worker/room.ts
    - test/unit/bots.test.ts
    - test/unit/testTools.test.ts
    - test/unit/view.test.ts
    - test/worker/testTools.test.ts
    - test/worker/leak.test.ts

key-decisions:
  - "P-13(확인 대기 기본값 그대로): 메시지 모양 { t: testBotVote, exec, pick } 한 개. 새 결정 기록은 04-34 의 결정 0037 이 한 곳에 적는다"
  - "pick other 는 방장도 자기도 아닌 살아 있는 사람 중 가장 낮은 seat. 조건이 안 맞으면(방장 탈락·후보 없음) 무작위로 돌아가 기존과 같이 randInt(길이) 한 번을 부른다"
  - "설정은 대기실에서만 바꾸고 testReset 뒤에도 남는다(testRole 과 같다)"

requirements-completed: []

coverage:
  - id: D1
    description: "고정 설정이 계획과 넘기기에서 같은 결정으로 쓰인다: yes/no 는 randInt(100) 없이, host/other 는 randInt(후보 수) 없이 결정되고 지연 난수는 그대로이며, 설정이 없으면 기존 시드 계약(고정 다이제스트)이 그대로다"
    requirement: "VOTE-01"
    verification:
      - kind: automated
        ref: "npx vitest run --project unit test/unit/bots.test.ts test/unit/testTools.test.ts test/unit/tick.test.ts (186 통과)"
        status: pass
    human_judgment: false
  - id: D2
    description: "setBotVote 검사 순서·같은 값은 입력 그대로·둘 다 random 이면 키 삭제·깊은 동결 입력 불변·resetToLobby 가 설정을 유지"
    requirement: "VOTE-02"
    verification:
      - kind: automated
        ref: "test/unit/testTools.test.ts(setBotVote, skipPhase: 봇 투표 설정을 따른다)"
        status: pass
    human_judgment: false
  - id: D3
    description: "me.testBotVote 는 테스트 방 방장의 대기실 view 에서 무작위가 아닌 값이 있을 때만 실리고 손님·일반 방·미리보기·게임 중 모든 단계에는 키 자체가 없다. 스키마는 모르는 값·빠진 키·추가 키를 BAD_MESSAGE 로 거부한다"
    requirement: "VOTE-02"
    verification:
      - kind: automated
        ref: "test/unit/view.test.ts(me 허용 키 목록 + 조건 밖 부재), test/worker/testTools.test.ts(testBotVote 6개)"
        status: pass
    human_judgment: false
  - id: D4
    description: "실제 방에서 넘기기가 설정을 따른다: exec no 는 notMajority 로 밤, exec yes + pick host 는 후보 선택을 거쳐 방장이 후보가 되어 변론으로 간다. 대기실 복귀 뒤에도 방장 view 에 설정이 남고 손님 프레임에는 키가 없다"
    requirement: "END-01"
    verification:
      - kind: automated
        ref: "test/worker/testTools.test.ts(testBotVote: 넘기기가 설정을 따른다 3개), test/worker/leak.test.ts(손님 프레임 키 열거)"
        status: pass
    human_judgment: false
  - id: D5
    description: "전체 게이트: npm test, npm run typecheck(tokens:check + wrangler types + tsc 앱·워커)"
    requirement: "END-02"
    verification:
      - kind: automated
        ref: "npm test (88 파일 2279 테스트 통과), npm run typecheck 종료 0"
        status: pass
    human_judgment: false
---

# Phase 4 Plan 15: 테스트 방 봇 투표 설정(testBotVote) Summary

**테스트 방 방장이 대기실에서 봇의 처형 여부 표(무작위·모두 찬성·모두 반대)와 후보 선택(무작위·방장·방장 아닌 사람)을 절대값 한 메시지로 고정할 수 있게 해, 넘기기와 알람이 같은 결정을 따르고 화면 E2E 가 처형 무효·처형 진행·결과 화면에 확률이 아니라 결정적으로 닿게 했다. 설정이 없으면 기존 봇 동작과 난수 호출 순서는 그대로다. 배포하지 않았다(D-26).**

## 한 일

세 작업을 TDD 로 진행했다(작업 1·2 는 RED → GREEN, 작업 3 은 구현이 이미 있어 통합 시험만 더했다).

### Task 1: 봇 규칙과 방장 도구 규칙 (RED fd120a3 → GREEN 33e23af)

- `shared/protocol.ts`: 값 타입 `BotVoteExec`, `BotVotePick` 두 개만 먼저 내보냈다(메시지 변형은 Task 2 — worker 의 `never` 검사가 중간에 깨지지 않게).
- `shared/game/room.ts`: `RoomState.testBotVote?: { exec?: "yes"|"no"; pick?: "host"|"other" }`. 서버 전용이고 무작위가 아닌 값만 저장한다.
- `shared/game/bots.ts`: `botExecAgree(randInt, fixed?)`, `botCandidateTarget(state, bot, randInt, pick?)`. 고정 값은 결정 난수를 부르지 않고 지연 난수는 그대로다. `planFor` 가 `state.testBotVote?.exec/pick` 을 넘긴다. 머리 주석의 난수 호출 순서 계약에 한 단락을 더했다. `EXEC_YES_PERCENT = 70` 과 기존 시그니처 호출은 그대로다.
- `shared/game/testTools.ts`: `setBotVote` 를 더했고, `botsVoteNow`(넘기기)가 같은 설정을 읽고, `resetToLobby` 의 허용 목록 리터럴이 `testBotVote` 를 `testRole` 옆에 조건부로 남긴다.
- 시험: randInt 호출 횟수 스파이(고정 0 회, 무작위 1 회), pick 세 갈래와 폴백(방장 탈락·방장 말고 후보 없음·후보 없음 → undefined), 설정 없음 = 빈 객체와 같은 계획, setBotVote 검사 순서·같은 값·지움·깊은 동결, skipPhase 의 yes/no/host/other.

### Task 2: 와이어·스키마·뷰·방 DO 처리기 (RED 7127cc3 → GREEN 845e7d7)

- `ClientMessage` 에 `{ t: "testBotVote"; exec; pick }`, `MyInfo.testBotVote?: { exec; pick }`. `schemas.ts` 는 `z.strictObject` + `z.enum` 두 개(`satisfies` 검사가 타입과 일치를 지킨다).
- `view.ts`: 테스트 방 방장·대기실·무작위가 아닌 값이 있을 때만 두 값을 필드별로 읽어 싣는다(빠진 쪽은 `"random"`). 상태 객체를 펼쳐 복사하지 않는다.
- `worker/room.ts`: switch 에 `case "testBotVote"`, `handleTestBotVote` 는 `handleTestRole` 모양(`setBotVote` → 거부는 `rejectTestTool` → 같은 상태면 반환 → 저장 → 방장 소켓에만 `sendViewTo`). 마감이 안 바뀌므로 알람은 건드리지 않는다.
- 시험: `view.test.ts` 의 `me` 허용 키에 `testBotVote` 추가와 조건 밖 부재(값 없음·빈 객체·손님·일반 방·미리보기·대기실 밖 열세 단계), 소켓 6개(일반 방 BAD_MESSAGE, 손님 NOT_HOST, 게임 중 WRONG_PHASE, 모르는 값·빠진 키·추가 키 BAD_MESSAGE, 방장 성공은 방장 소켓에만 `[state:lobby]`, 같은 값은 프레임 없음·random 둘은 지움).

### Task 3: 한 판 소켓 시험과 누출 시험 (9214514)

- 방장(마피아) + 손님 1 + 봇 3 방에서 `exec:"no"` 로 execVote 까지 간 뒤 한 번 넘기면 봇 3명이 모두 반대라 `night` 이고 `day.noExecution.reason === "notMajority"`, 저장된 voteLog 마지막 줄이 `{"yes":0,"no":3,"passed":false}`.
- `exec:"yes"` + `pick:"host"` 이면 같은 과정에서 `candidateVote` → `candidateVoteReveal`(`day.candidate` = 방장 seat 0, 봇 표 `2>0,3>0,4>0`) → `defense`.
- 대기실로 되돌려도 방장 view 에 `me.testBotVote` 가 남고 손님이 받은 프레임에는 `testBotVote`·`testMode` 가 없다.
- `leak.test.ts`: 손님이 받은 모든 프레임의 키 경로에 `.testBotVote` 가 없고 방장의 대기실 밖 프레임에도 없다(허용 경로 목록은 넓히지 않았다).
- `test/worker/bots.test.ts` 는 고칠 필요가 없었다(기존 도우미로 충분).

## 시험 결과

- `npm test`: 88 파일 2279 통과(이 계획 전 2245).
- `npm run typecheck`(tokens:check + wrangler types + tsc 앱 + tsc 워커): 종료 0.
- `node scripts/tsc-scoped.mjs tsconfig.app.json '^(shared|test/unit/(bots|testTools))'`: OK.
- 워커 시험(testTools·leak·bots)은 세 번 연속 돌려 안정적임을 확인했다.
- 인수 기준: `testBotVote` 가 room.ts 1·bots.ts 3·testTools.ts 8·protocol.ts 2·schemas.ts 1·view.ts 3·worker/room.ts 1, `handleTestBotVote` 2, `EXEC_YES_PERCENT` 상수 1, `notMajority` 2, leak 시험 6.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 시험 환경] 워커 시험의 소켓당 메시지 한도(1초 20개)에 걸림**
- **Found during:** Task 3 시험 실행
- **Issue:** 한 판 시험에서 방장 소켓이 testBots·testRole·testBotVote·start·testSkip 여러 번을 보내자 세 번째 `testSkip` 이 `RATE_LIMITED` 로 버려져 `skipOnce` 가 시간 초과했다.
- **Fix:** 시험 안에서 `editRoom(code, room => room)` 으로 방 DO 를 내려 메모리 창을 비우는 작은 도우미(`resetRateWindow`)를 썼다(`driveToEnded` 가 이미 같은 효과를 얻는 방식). 서버 코드는 바꾸지 않았다.
- **Files modified:** test/worker/testTools.test.ts
- **Commit:** 9214514

**2. [Rule 1 - 시험 가정 오류] 한 판 시험의 기대 합계**
- **Found during:** Task 3
- **Issue:** 방이 사람 2(방장·손님) + 봇 3 이라 봇 표가 `seat 1~4` 가 아니라 `2~4` 이고 반대 합계가 4 가 아니라 3 이다. 서버 코드 문제가 아니라 시험 기대가 틀렸다.
- **Fix:** 기대값을 `2>0,3>0,4>0`, `{"yes":0,"no":3,...}` 로 고쳤다.
- **Commit:** 9214514

**3. [Rule 1 - 시험 가정 오류] 후보 선택 단위 시험의 난수**
- **Found during:** Task 1 GREEN
- **Issue:** `tallyCandidateVote` 는 표 공개 순서를 섞느라 `randInt` 를 부른다. pick 시험에서 `THROWING` 을 넘기면 서버 규칙이 아니라 시험이 터졌다.
- **Fix:** 넘기기 시험에는 `seededRandInt(9)` 를 쓰고(봇 선택 쪽의 난수 0 회는 `botCandidateTarget` 단위 시험이 따로 단언한다), 표는 seat 로 정렬해 비교한다.
- **Commit:** 33e23af

그 밖에는 계획대로 실행했다. 계획이 파일 목록에 둔 `test/worker/bots.test.ts` 는 바뀐 것이 없다.

## 에이전트 주의

- 소켓 한 줄 요약 방식을 그대로 썼고, 모든 단계 이동 반복문은 상한(40회)이 있는 `skipThrough`·`advanceTo` 만 썼다. 팀이 이긴 뒤 단계가 영영 바뀌지 않는 `while (phase !== X) tick` 반복문은 새로 만들지 않았다.

## Known Stubs

없음.

## Threat Flags

없음. T-04-44(testBotVote 권한 상승)는 세 거부 코드를 단위·소켓 시험이, T-04-45(me.testBotVote 누출)는 view 조건 시험과 손님 프레임 키 열거 시험이, T-04-46(스키마 밖 값·추가 키)은 strictObject + enum 시험과 setBotVote 의 범위 재검사가 고정한다. 새 패키지 설치 없음.

## 다음 계획이 알아둘 점

- 04-17(시트)은 `me.testBotVote`(없으면 둘 다 `"random"` 으로 간주)를 읽고 `{ t: "testBotVote", exec, pick }` 를 **둘 다 함께** 보낸다. 한 줄만 바꾸려면 다른 쪽의 현재 값을 같이 보내야 한다(절대값 메시지).
- E2E(04-31·04-32): 처형 무효 = `exec:"no"`, 처형 진행 = `exec:"yes"`, 결과 화면 = `exec:"yes"` + `pick:"host"` + 방장 직업 마피아. 설정은 대기실에서만 바뀌고 `testReset` 뒤에도 남는다.
- 결정 기록은 04-34 의 결정 0037 이 한 곳에 적는다. 이 계획은 결정 파일을 만들지 않았다.
- 이 서버 변경은 배포하지 않았다(04-35 에서 화면과 한 단위로).

## Self-Check: PASSED

- 변경한 12개 파일 존재 확인(`git diff --stat plan_head_before..HEAD`).
- 커밋 fd120a3·33e23af·7127cc3·845e7d7·9214514 가 HEAD 의 조상(`plan_head_before..HEAD` 5개).
- 배포 없음(D-26). 관련 없는 변경 파일(`.planning/milestone.lock`, `.planning/state.json`, `Claude outputs/`)은 커밋하지 않았다.
