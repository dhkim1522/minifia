---
phase: 04-execution-verdict
plan: 10
subsystem: socket-uat-scripts
tags: [smoke, uat, socket, exec-vote, candidate-vote, ending, local-only, decision-0036]

requires:
  - phase: 04-execution-verdict
    provides: "04-07 소켓 도우미·종료, 04-08 봇·테스트 방, 결정 0036 와이어 계약"
provides:
  - "scripts/smoke.mjs: 분기형 PHASE_NEXT, 여부 투표 집계 동일·남의 표 비공개·처형 무효 notMajority 검사, MORNING_PHRASE_COUNT 상수, 서버 전용 키 확장"
  - "scripts/uat-day.mjs, scripts/uat-night.mjs: execVote 단계를 지나는 새 단계 순서와 대기 시간"
  - "scripts/uat-vote.mjs(신규): 처형으로 끝나는 5명 판과 아침으로 끝나는 4명 판을 실제 소켓으로 끝까지 도는 UAT(로컬·배포 겸용)"
affects: [04-11, 04-12, 화면 계획(배포본 --prod 실행)]

actuals:
  tokens: 9000
  tasks: 2
  commits: 4
plan_head_before: 59314fdb6eebeff7e09049f1a9db669c9bd22b63
plan_head_after: 938990db410eb83ac15dc9e19ba4cf69c8b8d883
commits: 4

tech-stack:
  added: []
  patterns:
    - "스크립트의 TS 상수 사본은 파일 상단 상수 + 같은 값이라는 주석(MORNING_PHRASE_COUNT 7, EXECUTION_PHRASE_COUNT 4)"
    - "분기형 소켓 UAT: 단계 도착을 항상 시간 제한이 있는 waitUntil 로 기다린다(끝없는 while 없음). 승패가 정해지는 길은 시나리오에서 정한다"
    - "서버 객체 비교는 키 순서와 무관한 정규화(canon) 후 JSON 비교"

key-files:
  created:
    - scripts/uat-vote.mjs
  modified:
    - scripts/smoke.mjs
    - scripts/uat-day.mjs
    - scripts/uat-night.mjs
    - HANDOFF.md

key-decisions:
  - "스모크는 여부 투표 미통과 경로를 탄다(찬성 floor((N-1)/2)). 처형·종료 경로는 uat-vote 가 맡는다"
  - "로컬 dev 서버는 정적 에셋에 Cache-Control 을 주지 않으므로 smoke 마지막 에셋 헤더 단언이 로컬에서 실패한다(03.1-13 과 같은 알려진 제약). 단언은 느슨하게 하지 않고 스크래치 사본으로 확인했다"

requirements-completed: []
requirements-server-rules-done: [VOTE-01, VOTE-02, VOTE-03, VOTE-04, COMM-03, END-01, END-02, CONN-02]  # 소켓 수준 서버 증명만. 화면이 걸린 요구사항이라 REQUIREMENTS 체크박스는 열어 둔다

coverage:
  - id: D1
    description: "스모크 4·5명이 새 흐름(discussion → execVote → 미통과면 night)을 통과: 매 표 뒤 모든 클라이언트의 execTally 동일, voteAgree 는 보낸 사람 view 에만, 마감 뒤 night 의 day.noExecution {reason:notMajority} 가 모두 같고 voteLog 마지막 줄 exec 키가 no·passed·yes"
    requirement: "VOTE-01"
    verification:
      - kind: integration
        ref: "node scripts/smoke.mjs http://localhost:5173 --stage full --players 5 / --players 4 (에셋 캐시 헤더 단언 제외 사본, 아래 편차 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "uat-day(5명)·uat-night(5명)가 execVote 단계를 지나는 새 단계 순서로 통과하고, uat-day 가 0표 미통과의 night 에서 noExecution {reason:noVotes} 와 단계 순서 discussion → execVote → night 를 본다"
    requirement: "CONN-02"
    verification:
      - kind: integration
        ref: "node scripts/uat-day.mjs … --players 5 (EXIT 0) / node scripts/uat-night.mjs … --players 5 (36/36 통과)"
        status: pass
    human_judgment: false
  - id: D3
    description: "uat-vote (a) 5명: 번복 포함 여부 통과 → 후보 선택(한 표 뒤 투표자 외 프레임 없음) → 공개 순서 동일 → 변론(후보만 defNotMe, 비후보 say WRONG_PHASE, 이모티콘 통과) → 처형(직업 없음) → 마피아 처형으로 citizenWin ended, 모든 클라이언트 같은 result"
    requirement: "VOTE-02"
    verification:
      - kind: integration
        ref: "node scripts/uat-vote.mjs http://localhost:5173 (48/48 OK, 처형 판 29항목)"
        status: pass
    human_judgment: false
  - id: D4
    description: "uat-vote (b) 4명: 시민 처형 → 밤 암살 → morning(탈락)을 먼저 받고 약 5초 뒤 mafiaWin ended, 요약 1일차 줄에 exec 와 night {target, died:true}"
    requirement: "END-01"
    verification:
      - kind: integration
        ref: "node scripts/uat-vote.mjs http://localhost:5173 (48/48 OK, 종료 판 19항목)"
        status: pass
    human_judgment: false

duration: 약 45분
completed: 2026-10-28
status: complete
---

# Phase 4 Plan 10: 소켓 스크립트를 처형 흐름에 맞추고 처형·종료를 끝까지 도는 UAT Summary

**스모크·uat-day·uat-night 를 여부 투표 단계와 분기형 전이 표에 맞추고, 처형으로 시민이 이기는 판과 밤 암살로 마피아가 이기는 판을 실제 소켓으로 끝까지 도는 uat-vote.mjs 를 새로 만들어 로컬 서버에서 모두 통과시켰다. 배포하지 않았다(D-26).**

## 진행 기록

- Task 1 — 커밋 b9737ad (체크포인트 b1fe9e5) / 로컬 실행: smoke 5·4명·uat-day·uat-night 통과 / 남은 태스크: 2
- Task 2 — 커밋 e672aab(uat-vote), 938990d(HANDOFF 진행 줄) / 로컬 실행: uat-vote 48/48 OK, `npm test` 87 파일 2157 통과, typecheck 0 / 남은 태스크 없음

## Accomplishments

- **scripts/smoke.mjs**
  - `PHASE_NEXT` 를 분기형으로 바꾸고(`execVote: ["candidateVote", "night"]` 등 14단계), `DAY_PHASES` 에 새 단계를 더했다. 시간 상수에 `EXEC_VOTE_MS` 와 `EXEC_VOTE_WAIT_MS` 를 더하고 `FULL_TOTAL_LIMIT_MS` 를 420초에서 480초로 늘렸다.
  - 토론 뒤 여부 투표 구간(13b)을 더했다. 찬성 `floor((N-1)/2)` 명, 나머지 반대(미통과 보장). 매 표 뒤 모든 클라이언트의 execTally 가 같고, `me.voteAgree` 는 보낸 사람 view 에만 있다. 마감 뒤 모든 클라이언트의 night 가 `day.noExecution = {reason:"notMajority"}` 를 같게 싣고, `voteLog` 마지막 줄 exec 키가 정확히 `no,passed,yes`, `cand` 와 `voteAgree` 는 없다.
  - 단계 순서 단언을 discussion → execVote → night → morning → dayAnnounce 로 고쳤다. `SERVER_ONLY_KEYS` 에 execVote·candidateVote·verdict·nightLog·lastExecPhrase 를 더했다(winner·execution 은 같은 이름의 view 키가 있어 넣지 않음).
  - 아침 문구 범위 검사를 상단 상수 `MORNING_PHRASE_COUNT`(7)로 바꿨다. 머리 주석을 새 흐름으로 고쳤다.
- **scripts/uat-day.mjs**: 2일차 대기를 190초로, 단계 도착 차이 표에 execVote1 을 더했다. 표를 안 던지는 봇이므로 night 의 `noExecution {reason:"noVotes"}` 와 단계 순서(discussion → execVote → night)를 새 검사로 본다.
- **scripts/uat-night.mjs**: 하루마다 execVote 10초를 지나도록 대기 한도와 전체 한도를 늘렸다. 아침 문구 범위는 `MORNING_PHRASE_COUNT` 를 쓴다(주석 포함).
- **scripts/uat-vote.mjs(신규)**: uat-night 와 같은 형식(전지적, 결과 표, 토큰 미출력, Node 내장 fetch·WebSocket 만). 두 판을 차례로 돈다.
  - (a) 5명 처형 판: 한 명이 반대 → 찬성으로 번복하고 넷 찬성·하나 반대. 후보 선택은 마피아가 아닌 넷이 마피아를, 마피아는 다른 사람을 고른다. 한 표 뒤 투표자 외 클라이언트가 그 사이 state 를 받지 않았음을 표마다 본다. 공개 순서가 모든 클라이언트에서 같고 길이 5, 후보 = 마피아. 변론에서 비후보 say 는 WRONG_PHASE, 후보 defNotMe 와 비후보 이모티콘은 모두에게. 처형 발표 `{seat, phrase 1..4}` 가 같고, 처형까지 살아 있는 클라이언트 프레임에 허용 경로 밖 직업 문자열이 없다. 약 5초 뒤 `ended` — citizenWin, 5자리, 요약 1줄. 종료 중 say 는 WRONG_PHASE.
  - (b) 4명 종료 판: 후보 선택에서 마피아를 빼고 시민 하나를 처형 → 밤에 마피아가 남은 비마피아 하나 지목 → 모든 클라이언트가 morning(탈락)을 먼저 받고 약 5초(4986ms) 뒤 `ended`, mafiaWin, 요약 1일차 줄에 `exec` 와 `night {target, died:true}`. 단계 순서는 execution → night → morning → ended.
  - `ended` 프레임의 직업 문자열은 허용 경로와 `result.seats[].job` 뿐이고, `result` 는 ended 단계 프레임에만 있다.
- **HANDOFF.md**: 4페이즈 진행 줄을 `04-10 까지 완료(웨이브 6). 배포 금지(D-26)` 로 바꿨다(2727바이트).

## 로컬 실행 결과

dev 서버: 이 계획이 `npm run dev` 로 띄운 PID 37787 과 그 자식만 `pkill -P` + `kill` 로 껐다(이름으로 찾아 죽이지 않음). 끝난 뒤 포트 5173 이 비었음을 확인했다. 실행은 같은 서버에 병렬로 돌렸다(방이 서로 독립이라 도착 편차 0ms 로 영향 없음).

| 명령 | 마지막 줄 / 종료 코드 |
|---|---|
| `node scripts/smoke.mjs http://localhost:5173 --stage full --players 5` (저장소 파일 그대로) | 모든 게임 단언 통과 후 에셋 헤더에서 `SMOKE FAIL: …fig1_boy_brown_default%402x.png 의 Cache-Control 에 max-age=86400 이 없음: no-cache`, 종료 1 (편차 1) |
| 같은 명령 `--players 4` (저장소 파일 그대로) | 동일하게 에셋 헤더 단언에서만 종료 1 |
| 스크래치 사본(캐시 헤더 단언 두 곳만 끔) 5명 | `SMOKE OK full code=7692 players=5 spread=0ms discSpread=0ms`, 종료 0 |
| 스크래치 사본 4명 | `SMOKE OK full code=9526 players=4 spread=0ms discSpread=0ms`, 종료 0 |
| `node scripts/uat-day.mjs http://localhost:5173 --players 5` | 새 검사 2건 통과, 종료 0 |
| `node scripts/uat-night.mjs http://localhost:5173 --players 5` | `36/36 통과`, 종료 0 |
| `node scripts/uat-vote.mjs http://localhost:5173` | `48/48 OK`, 종료 0 |
| `npx vitest run test/unit/handoff.test.ts` | 2 passed |
| `npm test` | 87 파일 2157 passed, 실패 0 |
| `npm run typecheck`(tokens:check + wrangler types + tsc app + tsc worker) | 종료 0, `worker-configuration.d.ts` 변경 없음 |

### uat-vote 결과 표(전체)

```
처형 | 역할 구성: 마피아 1명 | OK | 마피아 1
처형 | execVote 마감이 모든 클라이언트에서 같고 길이 10초 | OK | 1종
처형 | 매 표 뒤 모든 클라이언트의 execTally 가 같음 (최종 찬성 4 반대 1) | OK |
처형 | me.voteAgree 는 보낸 사람 view 에만 있고 남의 표는 어느 프레임에도 없음 | OK |
처형 | 여부 통과: voteLog 마지막 줄 exec {yes:4, no:1, passed:true} 가 모두에게 같음 | OK | {"n":1,"exec":{"yes":4,"no":1,"passed":true}}
처형 | candidateVote 마감 길이 15초, 개인 표(voteAgree)·execTally 는 더 이상 없음 | OK |
처형 | 후보 선택: 한 표 뒤 투표자 외 클라이언트는 그 사이 state 를 받지 않음 | OK |
처형 | me.voteTarget 은 본인이 고른 값뿐(남의 선택을 받은 프레임 없음) | OK |
처형 | voteTarget 키는 view.me.voteTarget 경로뿐 | OK | view.me.voteTarget
처형 | 공개: 모든 클라이언트의 cand.votes 가 같은 순서이고 길이 5 | OK | [{"seat":0,"target":4},{"seat":1,"target":4},{"seat":3,"target":4},{"seat":4,"target":0},{"seat":2,"target":4}]
처형 | 공개된 표가 던진 표와 같음(5표, 빠진·바뀐 표 없음) | OK | 0>4 1>4 2>4 3>4 4>0
처형 | 후보 = 마피아(최다 득표 4표) | OK | 후보 4, 마피아 4
처형 | 공개 구간에는 개인 선택(voteTarget)이 따로 없음 | OK |
처형 | 변론: 비후보의 say → WRONG_PHASE | OK | WRONG_PHASE
처형 | 변론: 후보의 defNotMe 가 모든 클라이언트에 chat 프레임으로 감 | OK |
처형 | 변론: 비후보의 이모티콘이 모든 클라이언트에 감 | OK |
처형 | 처형: 모든 클라이언트 day.execution {seat=마피아, phrase 1..4} | OK | {"seat":4,"phrase":1}
처형 | 처형: 처형자만 탈락(players[].alive)이 모든 클라이언트에서 같음 | OK |
처형 | 처형까지 살아 있는 클라이언트 프레임에 허용 경로 밖 직업 문자열 없음(처형자 직업 비공개) | OK |
처형 | 처형 약 5초 뒤 ended | OK | 5000ms
처형 | ended: 모든 클라이언트가 같은 result | OK |
처형 | result.winner = citizenWin | OK | citizenWin
처형 | result.seats 가 5자리이고 job 이 실제 직업과 같음 | OK |
처형 | result.summary 가 1줄이고 기대 내용과 같음 | OK | [{"n":1,"exec":{"yes":4,"no":1,"passed":true,"candidate":4}}]
처형 | ended 프레임의 직업 문자열은 허용 경로와 result.seats[].job 뿐 | OK |
처형 | result 는 ended 단계 프레임에만 있음 | OK |
처형 | 종료 중 say → WRONG_PHASE | OK | WRONG_PHASE
처형 | 종료 뒤에도 소켓이 열려 있고 마지막 단계가 ended | OK |
처형 | 다른 사람의 토큰이 프레임에 없음 | OK |
종료 | 역할 구성: 마피아 1·경찰 1·시민 2 | OK | 시민 2
종료 | 매 표 뒤 모든 클라이언트의 execTally 가 같음 (최종 찬성 4 반대 0) | OK |
종료 | me.voteAgree 는 보낸 사람 view 에만 있고 남의 표는 어느 프레임에도 없음 | OK |
종료 | 공개: 후보 = 처형될 시민, 모든 클라이언트 같은 voteLog | OK |
종료 | 처형: 모든 클라이언트 day.execution 이 같고 seat = 시민 | OK | {"seat":1,"phrase":1}
종료 | 처형이 성립한 날의 밤에는 day.noExecution 이 없음 | OK |
종료 | 밤 시작 시 살아 있는 비마피아 둘(경찰·남은 시민) | OK | 2명
종료 | 아침(탈락)을 ended 보다 먼저 받음: 모든 클라이언트 같은 day.morning, 탈락 = 지목한 사람 | OK | {"eliminated":2,"phrase":2}
종료 | 아침 약 5초 뒤 ended (바로 끝나지 않음) | OK | 4986ms
종료 | 단계 순서가 모든 클라이언트에서 같고 execution → night → morning → ended | OK | lobby>assigning>roleReveal>dayAnnounce>claim>discussion>execVote>candidateVote>candidateVoteReveal>defense>execution>night>morning>ended
종료 | ended: 모든 클라이언트가 같은 result | OK |
종료 | result.winner = mafiaWin | OK | mafiaWin
종료 | result.seats 가 4자리이고 job 이 실제 직업과 같음 | OK |
종료 | result.summary 가 1줄이고 기대 내용과 같음 | OK | [{"n":1,"exec":{"yes":4,"no":0,"passed":true,"candidate":1},"night":{"target":2,"died":true}}]
종료 | ended 프레임의 직업 문자열은 허용 경로와 result.seats[].job 뿐 | OK |
종료 | result 는 ended 단계 프레임에만 있음 | OK |
종료 | ended 이전 살아 있는 클라이언트 프레임에 허용 경로 밖 직업 문자열 없음 | OK |
종료 | 소켓이 예상 밖으로 닫히지 않음 | OK |
종료 | 다른 사람의 토큰이 프레임에 없음 | OK |

48/48 OK
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 블로킹] 로컬 dev 서버에서는 smoke 의 에셋 Cache-Control 단언이 항상 실패한다**
- **Found during:** Task 1 검증
- **Issue:** vite dev 서버는 `public/_headers` 를 적용하지 않아 `Cache-Control: no-cache` 를 준다. smoke 의 마지막 단계(그림·배경 `max-age=86400` 단언)가 모든 게임 단언이 통과한 뒤에 실패한다. 03.1-13 SUMMARY 편차 1 에 기록된 것과 같은 알려진 제약이다(이 계획이 만든 문제가 아니다).
- **Fix:** 단언을 느슨하게 하지 않았다. 저장소의 `scripts/smoke.mjs` 는 그 단언을 그대로 가진다. 스크래치 폴더(저장소 밖)에 그 두 줄만 끈 사본을 만들어 4·5명에서 `SMOKE OK full` 을 확인했다. 실제 캐시 헤더는 배포본(화면 계획 뒤 배포 때)에서 본다.
- **Files modified:** 없음(스크래치 사본만)
- **Commit:** 해당 없음

**2. [Rule 2 - 누락된 검증] uat-day 에 새 단계 검사 두 건 추가**
- **Found during:** Task 1
- **Issue:** 계획은 uat-day 에 단계 순서 배열과 대기 시간만 고치라고 했으나, 단순히 시간만 늘리면 execVote 가 실제로 끼어들었는지 보이지 않는다.
- **Fix:** 1일차 night 의 `noExecution {reason:"noVotes"}` 가 모든 폰에서 같고, 단계 순서가 discussion → execVote → night 임을 보는 검사 두 건을 더했다. 기존 검사는 그대로.
- **Files modified:** scripts/uat-day.mjs
- **Commit:** b9737ad

**3. [Rule 2 - 누락된 검증] ended 프레임의 직업 문자열 경로 검사 추가**
- **Found during:** Task 2
- **Issue:** 계획의 종료 단언은 result 동일성·요약 위주였다. 종료 단계에서 `result.seats[].job` 말고 다른 경로로 직업이 새지 않는지는 별도로 보지 않았다.
- **Fix:** `endedChecks` 에 ended 프레임의 직업 문자열이 허용 경로와 `view.result.seats[].job` 뿐인지 보는 항목을 더했다(두 판 모두).
- **Files modified:** scripts/uat-vote.mjs
- **Commit:** e672aab

**총 편차:** 3건(Rule 3 하나, Rule 2 둘). 계획의 구조·범위·성공 기준은 바뀌지 않았다.

## 04-08 이 미룬 항목(deferred-items.md) 확인

`scripts/uat-test-bots.mjs` 와 `scripts/e2e/browser.mjs` 의 "testSkip 이 낮에서 곧장 밤으로 간다" 가정은 **이 계획의 범위 밖**이다.
- `scripts/uat-test-bots.mjs`: 04-11 계획이 맡는다(분기형 넘기기 도우미, ended 에 닿으면 testReset 으로 이어 가기).
- `scripts/e2e/browser.mjs`·`flows.mjs`: 04-10·04-11·04-12 어느 계획도 다루지 않는다. 화면 계획이 E2E 를 4페이즈 흐름에 맞출 때 고쳐야 한다(여부 투표에서 방장이 반대 표를 먼저 던지거나 처형을 단계 진행으로 받아들이게). `deferred-items.md` 의 항목은 그대로 열어 둔다.
- 이 계획이 새로 만든 uat-vote·갱신한 스모크는 `testSkip` 을 쓰지 않고 실제 타이머로만 돈다. 끝없이 도는 `while (phase !== X) tick` 루프도 없다. 모든 대기는 시간 제한이 있는 `waitUntil` 이고, 마피아 승·시민 승 경로는 시나리오가 표로 정한다.

## Known Stubs

없음. 스크립트에 임시값·TODO·빈 데이터가 없다.

## Threat Flags

없음. 새 네트워크 입구·인증 경로·신뢰 경계 변경이 없다(테스트 클라이언트 스크립트만). T-04-33(토큰 미출력): `grep -nE 'console\.(log|error|warn)\(.*token' scripts/uat-vote.mjs` 출력이 비었고 토큰은 어떤 출력에도 없으며 프레임에 남의 토큰이 없음을 두 판 모두 확인한다. T-04-34: 이 계획이 띄운 PID 와 자식만 종료. T-04-35: `--prod`·`npm run deploy` 를 실행하지 않았다(D-26).

## 다음 계획에 알릴 것

- 04-11: uat-test-room·uat-test-bots. 이 계획의 uat-vote 와 같은 방식(시간 제한이 있는 대기, `canon` 정규화 비교)을 쓸 수 있다.
- 04-12: HANDOFF 소켓 확인 명령은 `node scripts/uat-vote.mjs http://localhost:5173`(약 7~9분, 실제로는 병렬 실행 포함 약 7분). 배포본 실행(`--prod`)은 화면 계획 뒤 배포 때 한다.
- 화면 계획: E2E(`scripts/e2e/browser.mjs`·`flows.mjs`)는 아직 낮에서 곧장 밤을 가정한다.

## Self-Check: PASSED

- 파일: scripts/uat-vote.mjs, scripts/smoke.mjs, scripts/uat-day.mjs, scripts/uat-night.mjs, HANDOFF.md 존재(수정은 git 으로 확인).
- 커밋: b9737ad, b1fe9e5, e672aab, 938990d 모두 HEAD 의 조상.
