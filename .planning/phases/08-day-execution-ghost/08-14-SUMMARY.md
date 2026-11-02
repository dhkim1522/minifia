---
phase: 08-day-execution-ghost
plan: "14"
subsystem: socket-check-tools
tags: [tracer, smoke, uat, bots, websocket, leak-check, day-flow]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-07 endDiscussion·point·verdict 메시지와 view 필드(day.points·endCount·voted·verdict, me.endDiscussion·verdictVote), 봇 성향, 08-11 서버 낮 흐름 전환
provides:
  - smoke full 이 새 낮 흐름(토론 끝내기 과반 → 지목 → 변론 → 찬반 → 처형 → 밤 → 아침)으로 한 판을 ended 까지 돈다(4·5·8명 확인)
  - scripts/bots.mjs 손 봇의 토론 끝내기·지목·찬반 행동(서버 봇과 같은 성향)
  - uat-vote(두 판 69항목)·uat-day(19)·uat-test-bots(53)·uat-test-room(28)이 새 단계 이름과 새 메시지로 같은 확인을 함
affects: [08-23 E2E 도우미 라벨(browser.mjs), 08-21·22 옛 단계 삭제, 배포 뒤 배포본 smoke]

actuals:
  tokens: 33700
  tasks: 3
  commits: 3
plan_head_before: ef2e026a5c8255650709e6f41f1574598c2c967b
plan_head_after: c074116f8329d6528972f00382733ef5eb2f75d6

tech-stack:
  added: []
  patterns:
    - "소켓 검사는 낮 하루를 함수 하나(runExecutionDay)로 묶고, 일차·대상·산 사람 목록만 바꿔 여러 날에 다시 쓴다"
    - "서버 전용 키 표는 이름을 지우지 않고 공개 와이어 경로 예외(PUBLIC_KEY_PATHS: view.day.verdict·view.me.verdictVote)만 연다"
    - "탈락한 클라이언트는 단계 표지(ghostFrom)를 기록해 관전 정보(spectate)·탈락자 채널·밤 마피아 채널 도달을 그 이후 프레임에서만 허용한다"

key-files:
  created: []
  modified:
    - scripts/smoke.mjs
    - scripts/bots.mjs
    - scripts/uat-vote.mjs
    - scripts/uat-day.mjs
    - scripts/uat-test-bots.mjs
    - scripts/uat-test-room.mjs

key-decisions:
  - "smoke full 의 첫 낮은 마피아가 아닌 시민 중 가장 큰 seat 를 처형하고 그날 밤 가장 작은 산 시민을 암살한다. 마피아가 남은 날은 마피아 한 명을 처형해 판을 끝낸다(A1). 4·6명은 첫 밤 암살로 마피아 승, 5명은 2일차 처형으로 시민 승, 8명은 3일차 시민 승이라 어느 인원이든 ended 에 닿는다"
  - "FULL_TOTAL_LIMIT_MS 를 480초에서 720초로 늘렸다 — 낮이 최대 3번 돈다(5명 판 실측 2분 39초, 8명 판 약 5분)"
  - "밤 마피아 채널·입력 중은 산 마피아와 이미 탈락해 있던 관전자(처형된 시민)도 받는다(결정 0019·0021). smoke 의 '비마피아는 0건' 단언을 '마피아·그 밤의 관전자만'으로 고쳤다"
  - "uat-test-bots 1일차는 testBotVote {exec yes, pick host} 로 고정해 방장이 변론자가 되는 처형 구간을 결정적으로 돈다. 방장이 처형돼 이후 밤 검사는 방장 유령 시점으로 이어진다"

requirements-completed: [DAY-03, DAY-04, DAY-06, DAY-07]

coverage:
  - id: D1
    description: "smoke full 5명: 토론 끝내기 과반 → 지목 5줄 → 변론 → 찬반 4:0 → 처형 → 밤 → 아침 → 2일차 마피아 처형 → ended(citizenWin). 4명(mafiaWin)·8명(3일차 citizenWin)도 통과"
    requirement: DAY-07
    verification:
      - kind: command
        ref: "node scripts/smoke.mjs http://localhost:5173 --stage full --players 5 (4·8 도)"
        status: pass
    human_judgment: false
  - id: D2
    description: "smoke 누설 확인: 찬반 중 다른 소켓에 남의 값 없음(값 변경 프레임 0), 공개 값은 자기 단계에서만, 처형 view 에 역할 키 없음, 서버 전용 키(nominate·endVote·verdictVote·verdict)는 공개 와이어 경로 밖에 없음"
    requirement: DAY-06
    verification:
      - kind: command
        ref: "smoke full 의 '낮 처형 누설 단언' 블록과 runExecutionDay 의 찬반 값 변경 확인"
        status: pass
    human_judgment: false
  - id: D3
    description: "손 봇이 토론 30~60초에 endDiscussion, 지목 2~8초에 자기를 뺀 산 사람 point, 찬반 1~6초에 70% 찬성 verdict 를 보낸다(변론자는 찬반을 안 보냄)"
    requirement: DAY-04
    verification:
      - kind: command
        ref: "방장 스크립트 + bots.mjs --count 4 로컬 실행: 세 행동 로그와 방 단계 discussion → nomination(과반 토론 끝내기) → night 확인"
        status: pass
    human_judgment: false
  - id: D4
    description: "uat-vote: 지목 실시간 공개·자기 지목·취소(null) 거부·바꾸기, 0표·동률 → 밤, 변론자 찬반 거부, 분모(기권 포함), 값 변경 본인만, 처형 view 역할 없음, 끝 요약 4줄"
    requirement: DAY-06
    verification:
      - kind: command
        ref: "node scripts/uat-vote.mjs http://localhost:5173 (69/69 OK)"
        status: pass
    human_judgment: false
  - id: D5
    description: "uat-day 19/19, uat-test-bots 53/53(testBotVote 고정 처형 구간 포함), uat-test-room 28/28"
    requirement: DAY-03
    verification:
      - kind: command
        ref: "node scripts/uat-day.mjs / uat-test-bots.mjs / uat-test-room.mjs http://localhost:5173"
        status: pass
    human_judgment: false
  - id: D6
    description: "전체: vitest 152 파일 4343 통과(1 skipped 는 이전부터), npm run typecheck 통과, v1.0 가드 시험 33/33"
    verification:
      - kind: command
        ref: "npx vitest run; npm run typecheck; node --test scripts/deploy-target.test.mjs"
        status: pass
    human_judgment: false
  - id: D7
    description: "배포본(minifia-v2) 대상 smoke·uat 실행"
    verification: []
    human_judgment: true
    rationale: "이 계획은 로컬 서버에서만 돌렸다. 배포본 실행은 배포 뒤(정규화 08-22 이후)에 한다"

duration: 약 85분
completed: 2026-11-02
---

# Phase 08 Plan 14: 소켓 검사 도구를 새 낮 흐름으로 Summary

smoke full·손 봇·uat 스크립트 네 개를 08-11 의 새 낮 흐름(토론 끝내기 과반 → 지목 → 변론 → 찬반 → 처형)과 새 메시지(endDiscussion·point·verdict, day.points·voted·verdict)로 옮겨 로컬 서버에서 한 판이 ended 까지 도는 것을 소켓 수준으로 증명했다.

## 한 일

- **Task 1 트레이서 (6f0ad3c)**: smoke full 의 낮 구간을 `runExecutionDay(n, victim)` 로 다시 지었다. 과반만 토론 끝내기를 누르고(개수 공개·본인 값 본인만 확인, 토론 마감 90초를 기다리지 않음), 대상에게 지목을 몰아 주며(매 지목 뒤 모든 소켓 day.points 가 같은 목록), 변론(day.candidate)·찬반(변론자 거부, 첫 표는 day.voted 가 모두에게, 값 변경은 다른 소켓에 프레임 0)·처형(day.execution 키 2개, day.verdict 수, 탈락 alive)을 확인한다. 이후 밤·아침 단언은 처형된 시민과 암살당한 시민 두 탈락자를 허용하도록 고쳤고, 마피아가 남은 날은 마피아를 처형해 ended 에서 같은 승리 팀과 직업 목록을 확인한다. 트레이서 게이트로 `<verify>` 를 다시 돌려(5명 통과) 확장 작업으로 넘어갔다.
- **Task 2 (cc5fd75)**: bots.mjs 에 `endDiscussion`(30~60초)·`point`(2~8초, 자기 제외 산 사람)·`verdict`(1~6초, 70% 찬성, 변론자는 안 보냄)를 넣고 옛 분기를 지웠다. 로컬 방(방장 1 + 손 봇 4)에서 세 행동 로그와 단계 이동을 확인했다.
- **Task 3 (c074116)**: uat 네 스크립트를 새 규칙으로 바꿨다(아래 대응표).

## 옛 확인 → 새 확인 대응표 (A2)

| 스크립트 | 옛 확인 | 새 확인 |
| --- | --- | --- |
| uat-vote (a) | 여부 투표 번복·execTally 동일·남의 voteAgree 없음 | 찬반 값 변경은 본인에게만(다른 소켓 state 0)·day.voted 좌석 목록 동일·남의 verdictVote/agree 키 없음 |
| uat-vote (a) | 후보 선택 한 표 뒤 투표자 외 프레임 없음(비공개) | 지목은 공개라 반대 뜻으로 대체: 매 지목 뒤 모든 소켓 day.points 가 같은 공개 목록 |
| uat-vote (a) | 공개 구간 cand.votes 같은 순서·길이 5, 후보 = 마피아, 400+n×2000+600 길이 | 지목 최종 5줄(마피아 4표)·변론 후보 = 마피아·지목 15초 뒤 변론 |
| uat-vote (b) | 후보 취소(무효표)·고르기 전 취소는 프레임 없음 | 지목 취소(null)는 없다 → BAD_MESSAGE, 자기 지목 → BAD_MESSAGE, 바꾸기 |
| uat-vote (b) | 여부 불통과·D-34 notMajority | 0표 noVotes·동률 tie·부결(처형 단계가 알림, 밤에 noExecution 없음) 3일 + 분모(기권 포함) |
| uat-vote (b) | 아침 5초 뒤 ended(밤 암살로 마피아 승) | 3일차 밤 암살 + 4일차 처형 직후 ended(mafiaWin), 요약 4줄 |
| uat-day | 토론 40초·여부 투표 0표 → 밤 | 토론 90초·과반 토론 끝내기 → 지목·지목 0표 → 밤(+ 항목 2개 추가: 길이 90초, 과반 직후 진입) |
| uat-test-bots | 봇 여부 투표 execTally 합계 | 고정 testBotVote 로 봇 지목 day.points·변론 day.candidate·봇 찬반 day.voted·방장 처형 day.execution/verdict |
| uat-test-room | discussion → execVote(execTally 0:0) → night | discussion → nomination(day.points 빈 목록) → night(noVotes, 항목 1개 추가) |

## 이월 항목 처리 (carry_forward)

- 08-07 → 이 계획: `scripts/uat-test-bots.mjs` 는 칩 그룹 라벨 문자열을 직접 쓰지 않아 바꿀 곳이 없었다(옛 "봇 처형 투표"·"봇 후보 선택" 문자열 0건 확인). `scripts/e2e/browser.mjs` 의 press 라벨은 08-23 몫으로 남는다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 계획 문구 보정] 승패와 인원에 따른 판 길이**
- **Found during:** Task 1
- **Issue:** 계획은 "…→ 밤 … → ended" 로 가정했으나 첫 낮에 시민을 처형한 뒤의 밤 암살로 4·6명은 아침에 곧 ended 가 되고(마피아 ≥ 나머지), 5명은 2일차, 7·8명은 3일차 처형까지 가야 ended 다.
- **Fix:** smoke 가 승패 규칙(win.ts 와 같은 식)을 따라 다음 날 진입 또는 ended 를 스스로 정하게 했다. 전체 제한 시간을 720초로 늘렸다.
- **Files modified:** scripts/smoke.mjs
- **Commit:** 6f0ad3c

**2. [Rule 1 - 기대 보정] 밤 채널의 관전자 도달**
- **Found during:** Task 1 (실행에서 실패 확인)
- **Issue:** 옛 단언은 밤 마피아 채팅·입력 중이 마피아 외에게 0건이라 했으나, 결정 0019·0021 은 탈락자 관전자도 받게 한다. 첫 낮 처형으로 밤에 이미 탈락해 있는 시민이 생겨 옛 단언이 거짓 실패했다. 탈락자의 `me.chat` 도 `ghost` 다.
- **Fix:** '마피아 + 그 밤의 관전자'만 받는다·탈락자 `me.chat ghost` 허용으로 고쳤다(서버 쪽 규칙은 바뀌지 않았다).
- **Files modified:** scripts/smoke.mjs
- **Commit:** 6f0ad3c

**3. [Rule 3 - 막힘 해소] 서버 전용 키 표의 같은 이름 공개 경로**
- **Found during:** Task 1
- **Issue:** 서버 전용 키 `verdict`·`verdictVote` 가 공개 와이어 경로(`view.day.verdict`, `view.me.verdictVote`)와 이름이 같아 그대로 두면 처형 단계 프레임이 거짓 실패한다. 인수 기준이 `execVote` 문자열 0건이라 옛 이름도 표에서 빠졌다.
- **Fix:** 표에서 옛 `execVote`·`candidateVote` 를 빼고 `nominate`·`endVote`·`verdictVote` 를 더했으며 정확한 경로 예외만 `PUBLIC_KEY_PATHS` 로 열었다. 금지 이름은 줄이지 않았다.
- **Commit:** 6f0ad3c

**Total deviations:** 3 auto-fixed (Rule 1 ×2, Rule 3 ×1). **Impact:** 범위 확장 없음. 서버 코드는 건드리지 않았다.

## Deferred Issues

- `node --test scripts/e2e/lib.test.mjs` 의 "EXPECTED_SCENE: 단계 열세 개가 모두 장면 id 로 정해져 있다" 1건이 실패한다. 이 계획이 건드린 파일이 아니다 — 08-02 (56132fb) 가 `scripts/e2e/lib.mjs` 의 EXPECTED_SCENE 에 `nomination`·`verdict` 행을 더했는데 시험의 기대 목록이 그대로다. E2E 도우미를 맡은 08-20~25 가 고쳐야 한다. 이 계획의 확인 중 이 시험 하나만 실패했고 나머지(`scripts/*.test.mjs` 포함) 287 건은 통과.
- `scripts/gallery.mjs` 가 브라우저 단계 이름 `execVote`·`candidateVote`·`candidateVoteReveal` 로 기다린다(이 계획의 파일 목록 밖, 화면 도구). 08-21·22 의 옛 단계 삭제 때 함께 새 흐름으로 옮겨야 한다.

## TDD Gate Compliance

이 계획의 세 작업은 `tdd="true"` 가 아니다(트레이서 1 + 일반 2, 대상은 소켓 검사 스크립트). 스크립트가 시험 대상이자 실행 확인이라 RED 커밋은 없다. 각 작업의 `<verify>` 를 로컬 서버에서 실제 실행해 통과를 확인했다.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크 입구·파일 접근이 없다. T-08-36: 매 작업마다 `scripts/deploy-target.test.mjs` 33/33 통과, 스크립트의 주소 해석(`exitIfV1`)은 바꾸지 않았다. T-08-37: 토큰·채팅 본문 출력 규칙 그대로. T-08-SC: 패키지를 설치하지 않았다.

## 로컬 서버

`curl` 로 확인했을 때 5173 이 꺼져 있어 `npm run dev` 를 백그라운드로 띄웠고(PID 51275, 로그는 저장소 밖 임시 폴더) 마지막 검증 뒤 그 PID 와 자식 프로세스를 끄고 포트가 비어 있음을 확인했다.

## Self-Check

- 수정 파일 6개 존재, `grep -c execVote` 가 smoke·bots·uat-vote·uat-day·uat-test-bots·uat-test-room 모두 0, `candidateVote` bots.mjs 0: 통과
- 인수 기준: smoke `endDiscussion`·`t: "verdict"` 있음, bots `"point"`·`"verdict"`·`"endDiscussion"` 있음, uat-vote `nomination`·uat-test-bots `verdict` 있음: 통과
- 커밋 6f0ad3c·cc5fd75·c074116 이 HEAD 조상에 있음, `git rev-list --count ef2e026..HEAD` = 3: 통과
- 실행: smoke full 5명 통과(4명·8명도), uat-vote 69/69, uat-test-bots 53/53, uat-test-room 28/28, uat-day 19/19, `npx vitest run` 4343 통과, `npm run typecheck` 통과, deploy-target 33/33: 통과
- `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs`: 이 계획 밖 기존 실패 1건(위 Deferred Issues)

## Self-Check: PASSED
