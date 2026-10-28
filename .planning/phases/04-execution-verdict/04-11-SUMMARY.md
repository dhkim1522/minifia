---
phase: 04-execution-verdict
plan: 11
subsystem: test-room-uat-scripts
tags: [uat, socket, manual-bots, test-room, exec-vote, branching-skip, local-only, decision-0036]

requires:
  - phase: 04-execution-verdict
    provides: "04-08 서버 봇·분기형 testSkip, 04-10 사람만 있는 방 스크립트와 uat-vote, 결정 0036 와이어 계약"
provides:
  - "scripts/bots.mjs: 수동 봇의 여부 투표(70% 찬성)·후보 선택(자기 제외 생존자)·후보 봇만의 변론 템플릿, 종료 단계에서는 무행동"
  - "scripts/uat-test-room.mjs: 분기형 PHASE_NEXT(배열), discussion → execVote → night 순서와 execTally 0:0 확인"
  - "scripts/uat-test-bots.mjs: 목표 단계 또는 ended 까지 되풀이하고 경로를 기록하는 넘기기 도우미, 봇 여부 투표 검사, 확장 누출 검사, ended 처리, g 방 재시도"
affects: [04-12, 화면 계획(배포본 --prod 실행)]

actuals:
  tokens: 14000
  tasks: 2
  commits: 4
plan_head_before: 9e55aea7423fd7cc6cb3aa87b618e8e5036aafe9
plan_head_after: bb00018c88ccf215a1e3489c43e6a4d3d6c4a737

tech-stack:
  added: []
  patterns:
    - "분기형 넘기기: 목표 단계 또는 ended 에서 멈추는 한도 있는 반복(MAX_SKIPS), ended 에서는 더 누르지 않아 멈추지 않는 반복이 없다"
    - "무작위 분기를 가진 UAT 는 결과를 적고 다음 검사를 잇는다(ended → testReset, 방장·동료 처형 → 대기실로 되돌려 재시도)"
    - "문자열 검색 누출 검사는 단계 이름 값과 겹치지 않게 키 꼴(따옴표+콜론)로 찾는다"

key-files:
  created: []
  modified:
    - scripts/bots.mjs
    - scripts/uat-test-room.mjs
    - scripts/uat-test-bots.mjs
    - HANDOFF.md

key-decisions:
  - "uat-test-bots 의 g 방(방장 마피아 + 봇 5)은 1일차 처형으로 방장이나 동료 마피아가 빠지면 목적(살아 있는 동료 봇의 밤 pick 이 방장에게 보임)을 볼 수 없으므로, 둘 다 살아 밤에 닿을 때까지 testReset 후 다시 시작한다(최대 6판)"
  - "uat-test-bots 의 R1 판이 마피아 처형으로 ended 에 닿으면 밤 pick 검사는 건너뛰고(g 방이 맡음) view.result 와 ended 에서의 testSkip WRONG_PHASE 를 대신 본다"
  - "전체 제한 시간을 240초에서 360초로 늘렸다(투표 단계 10~15초씩 더 지나고 g 방 재시도가 있을 수 있음)"

requirements-completed: []
requirements-server-rules-done: [VOTE-01, VOTE-02, VOTE-03, END-02]  # 테스트 방 소켓 수준 증명만. 화면이 걸린 요구사항이라 REQUIREMENTS 체크박스는 열어 둔다

coverage:
  - id: D1
    description: "수동 봇이 execVote 에 찬성·반대를, candidateVote 에 자기 제외 생존자를, defense 에서 후보일 때만 변론 템플릿을 보낸다. 종료 단계에서는 무행동"
    requirement: "VOTE-01"
    verification:
      - kind: manual
        ref: "테스트 방에 bots.mjs --count 3 을 붙여 execVote → candidateVote → defense 까지 넘긴 로그(아래), node --check scripts/bots.mjs"
        status: pass
    human_judgment: false
  - id: D2
    description: "uat-test-room 이 새 단계 순서(discussion → execVote → night)와 execTally 0:0 을 확인하고 종료 코드 0"
    requirement: "VOTE-03"
    verification:
      - kind: integration
        ref: "node scripts/uat-test-room.mjs http://localhost:5173 (28/28 통과, 종료 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "uat-test-bots 가 분기형 넘기기로 끝까지 돌고, 봇 네 자리의 여부 표가 방장 execTally 합계를 올리며 방장 프레임에 voteAgree·서버 전용 투표 키가 없다. ended 로 끝나도 testReset 으로 이어 종료 코드 0"
    requirement: "END-02"
    verification:
      - kind: integration
        ref: "node scripts/uat-test-bots.mjs http://localhost:5173 (10회 연속 종료 0, ended 두 번 포함)"
        status: pass
    human_judgment: false

duration: 약 35분
completed: 2026-10-28
status: complete
---

# Phase 4 Plan 11: 수동 봇과 테스트 방 UAT 를 투표 단계와 분기에 맞춘 Summary

**수동 봇(bots.mjs)이 여부 투표·후보 선택·후보 변론을 서버 봇과 같은 성향으로 하고, uat-test-room 과 uat-test-bots 가 새 단계 순서와 분기(통과·불통과·무후보·ended)를 따르도록 고쳐 로컬 서버에서 모두 통과시켰다. 배포하지 않았다(D-26).**

## 진행 기록

- Task 1 — 커밋 de19011 (체크포인트 afd1203) / 로컬 실행: uat-test-room 28/28 통과, bots.mjs 수동 로그 확보 / 남은 태스크: 2
- Task 2 — 커밋 adb3582(uat-test-bots), bb00018(HANDOFF 진행 줄) / 로컬 실행: uat-test-bots 10회 연속 종료 0, `npm test` 87 파일 2157 통과, tsc app·worker 0 / 남은 태스크 없음

## Accomplishments

- **scripts/bots.mjs**: 단계 키 `${일차}:${단계}` 로 한 번만 행동한다. execVote 이면 0.5~6초 뒤 70% 찬성/30% 반대, candidateVote 이면 자기 자신이 아닌 살아 있는 한 명을 1~9초 뒤, defense 이면 `view.day.candidate` 가 자기 seat 일 때만 defNotMe·defCitizen·defPlead 중 하나를 1~4초 뒤. 탈락한 봇은 멈추고(기존), 대기실·배정에서는 투표 키도 비운다(테스트 방 대기실 복귀 뒤 새 판에서도 행동). 공개·처형·ended 에서는 토론 타이머만 정리한다. 머리 주석을 고쳤다.
- **scripts/uat-test-room.mjs**: `PHASE_NEXT` 값을 배열로 바꾸고 `skipTo` 순서 확인이 포함 여부를 본다. discussion 다음 `execVote` 를 거쳐(집계 `day.execTally` 가 0:0 인지 새 검사로 본다) 표가 없으니 곧장 night. 단계 순서 결과 줄이 `discussion → execVote → night` 로 바뀌었다.
- **scripts/uat-test-bots.mjs**
  - `skipPhase` 가 목표 단계 또는 `ended` 까지 되풀이하고 `{ended, path}` 를 돌려준다. `ended` 에서는 더 누르지 않는다(`WRONG_PHASE` 로 멈추지 않는 반복이 없음).
  - 새 검사: execVote 에서 9초 안에 봇 네 자리의 표가 방장 `day.execTally` 합계에 오름(방장은 안 던짐), 방장 `me.voteAgree` 키 없음, 방장 프레임 어디에도 `"voteAgree"` 키가 없음.
  - `LEAK_NEEDLES` 에 `"execVote":`, `"candidateVote":`, `"verdict":`, `"nightLog":`, `"lastExecPhrase":` 를 키 꼴로 더했다(단계 이름 값 `"phase":"execVote"` 와 겹치지 않음).
  - R1: 1일차 execVote 이후 경로를 출력한다. 판이 `ended` 로 끝나면(마피아 처형) 결과에 적고 `view.result` 와 ended 에서의 testSkip `WRONG_PHASE` 를 확인한 뒤 testReset 으로 f 검사를 잇는다.
  - g 방(방장 마피아 + 봇 5): 방장이나 동료 봇 마피아가 처형되면 대기실로 되돌려 다시 시작한다(최대 6판). 밤에 닿은 판에서 claimLog·allies·allyPicks 검사를 한다.
- **HANDOFF.md**: 4페이즈 진행 줄을 `04-11 까지 완료(웨이브 7). 배포 금지(D-26)` 로 바꿨다(2727바이트).

## 로컬 실행 결과

dev 서버: 이 계획이 `npm run dev` 로 띄운 PID 24900 과 그 자식만 `pkill -P` + `kill` 로 껐다(이름으로 찾아 죽이지 않음). 끝난 뒤 `/api/health` 가 응답하지 않음을 확인했다.

| 명령 | 마지막 줄 / 종료 코드 |
|---|---|
| `node --check` 세 스크립트 | 모두 0 |
| `node scripts/uat-test-room.mjs http://localhost:5173` | `28/28 통과` / `UAT TEST-ROOM OK`, 종료 0 |
| `node scripts/uat-test-bots.mjs http://localhost:5173` 10회 | 매번 `UAT TEST-BOTS OK`, 종료 0 (44/44 ~ 46/46 통과) |
| `npx vitest run test/unit/handoff.test.ts` | 2 passed |
| `npm test` | 87 파일 2157 passed |
| `npx tsc -p tsconfig.app.json --noEmit` / `tsconfig.worker.json` | 둘 다 종료 0 |

uat-test-bots 10회에서 1일차 execVote 이후 경로가 모두 나왔다: 통과 → 후보 → 변론 → 처형 → night(다수), 통과 후 후보 없음(candidateVoteReveal → night), 불통과(night 직행), 마피아 처형으로 `ended`(2회, 모두 `citizenWin`, 44/44). g 방은 방장이나 동료가 처형되어 2판째에 밤에 닿은 적이 4회 있다.

### bots.mjs 수동 확인 로그(테스트 방 + `--count 3`)

```
[bots] 봇자차카타: 여부 투표 찬성
[bots] 봇마바사아: 여부 투표 찬성
[bots] 봇가나다라: 여부 투표 반대
집계: {"yes":2,"no":1}
execVote -> candidateVote
[bots] 봇자차카타: 후보 선택 0
[bots] 봇가나다라: 후보 선택 3
[bots] 봇마바사아: 후보 선택 3
candidateVote -> candidateVoteReveal -> defense
[bots] 봇자차카타: 변론 defCitizen     (후보 seat 3 = 봇자차카타)
defense -> execution
```

### uat-test-room 마지막 줄

```
e | roleReveal → dayAnnounce → claim(차례 하나씩) → discussion → execVote → night 를 네 소켓 모두 3초 안에 받음 | 통과 | dayAnnounce → claim → discussion → execVote → night (1298ms, ...)
28/28 통과
UAT TEST-ROOM OK
```

### uat-test-bots 마지막 줄(마피아 처형으로 ended 에 닿은 판)

```
1일차 execVote 이후 경로: candidateVote > candidateVoteReveal > defense > execution > ended
이 판은 밤 pick 검사 전에 ended 로 끝남 — 밤 검사는 g 방이 맡음
d | 판이 ended 로 끝남(마피아 처형 등) — 방장 view.result 가 있고 testSkip 은 WRONG_PHASE | 통과 | 승자 citizenWin
44/44 통과
UAT TEST-BOTS OK
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - 누락된 검증] g 방 재시도 루프 추가**
- **Found during:** Task 2 설계
- **Issue:** 계획은 R1 의 ended 처리만 말했다. g 방도 넘기기가 봇 표를 채워 1일차 처형이 일어나므로 방장이나 동료 봇 마피아가 처형되면 `allyPicks` 를 볼 수 없어 불규칙하게 실패한다.
- **Fix:** 둘 다 살아 밤에 닿을 때까지 testReset → start 를 되풀이한다(최대 6판, 한도 있는 반복). 시도 횟수와 경로를 출력하고 결과 표에 적는다.
- **Files modified:** scripts/uat-test-bots.mjs
- **Commit:** adb3582

**2. [Rule 3 - 블로킹] 전체 제한 시간 240초 → 360초**
- **Found during:** Task 2
- **Issue:** 하루마다 투표 단계(10~15초)가 더 지나고 g 방 재시도가 있을 수 있어 예전 한도로는 빠듯하다.
- **Fix:** `OVERALL_LIMIT_MS` 를 360초로 늘리고 이유를 주석에 적었다. 실제 실행은 약 2~3분.
- **Files modified:** scripts/uat-test-bots.mjs
- **Commit:** adb3582

### 미룬 항목(이 계획 범위 밖, 고치지 않음)

- `scripts/uat-test-bots.mjs` 의 "testSkip 이 day → night 로 간다는 가정" 은 이 계획으로 해결됐다(deferred-items.md 첫 항목의 앞 절). `scripts/e2e/browser.mjs`·`flows.mjs` 는 어느 서버 계획도 맡지 않으므로 화면 웨이브에서 4페이즈 흐름에 맞춘다(열어 둠).

## Auth gates

없음.

## Known Stubs

없음.

## Threat Flags

없음. 스크립트만 바꿨고 새 서버 표면은 없다. 토큰은 어떤 출력에도 찍지 않으며(T-04-36) dev 서버는 이 계획이 띄운 PID 로만 껐다(T-04-37).

## Self-Check: PASSED

- 수정한 파일 확인: scripts/bots.mjs, scripts/uat-test-room.mjs, scripts/uat-test-bots.mjs, HANDOFF.md 모두 존재.
- 커밋 확인: de19011, afd1203, adb3582, bb00018 모두 HEAD 의 조상.
