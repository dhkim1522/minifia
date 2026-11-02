---
phase: 08-day-execution-ghost
plan: "28"
subsystem: unit-tests
tags: [test-cleanup, old-flow-removal, meaning-mapping, no-skip]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-02 지목·찬반 규칙(nomination.ts·verdict.ts)과 그 시험, 08-07 새 view 필드(points·endCount·voted·verdict·me.verdictVote·me.endDiscussion)와 시험
provides:
  - 옛 처형 여부 투표·후보 선택 흐름 전용 unit 시험이 없는 상태(옛 흐름은 아직 살아 있음)
  - vote.test 의 뜻이 지목·찬반 규칙 시험으로 옮겨졌다는 대응표(아래)
affects: [08-11 흐름 전환(시험 도우미를 새 흐름으로 다시 짓기), 08-21 서버 옛 코드 삭제, 08-22 옛 단계 이름 삭제]

actuals:
  tokens: 30800
  tasks: 2
  commits: 2
plan_head_before: f02c6b6b81dba8eeb2d6affdefddf1cb80a7ae6a
plan_head_after: d7bb054057c48f962444fcc6a855a18cc78165a8

key-files:
  created: []
  modified:
    - test/unit/nomination.test.ts
    - test/unit/verdictRule.test.ts
    - test/unit/execution.test.ts
    - test/unit/discussion.test.ts
    - test/unit/view.test.ts
    - test/unit/bots.test.ts
    - test/unit/testTools.test.ts
  deleted:
    - test/unit/vote.test.ts

key-decisions:
  - "옛 view 필드(execTally·voteAgree·voteTarget) 시험은 08-07 의 새 필드 시험(받을 사람에게만, 값 비공개)이 같은 뜻을 지키므로 지웠다. 그 필드 이름을 쓰던 전수 검사 도우미(phaseKeyViolations·ME_KEYS·DAY_KEYS)에서도 옛 필드 검사를 뺐다"
  - "전수 검사 단계 목록(PHASES·REVEALING_PHASES·DAY_VIEW_PHASES)에서 옛 execVote·candidateVote·candidateVoteReveal 을 뺐다. 그 단계를 걷는 도우미(endedState·stateAt 의 tick 걷기)와 단계 표 행은 08-11·08-22 몫이라 남겼다"
  - "변론·처형·밤·종료 상태를 만드는 시험은 지우지 않고 옛 단계만 목록에서 줄였다. 새 지목·찬반 단계는 08-11 이 목록에 더한다"

requirements-completed: []

duration: 약 30분
completed: 2026-11-02
---

# Phase 08 Plan 28: 옛 처형 여부·후보 선택 흐름 전용 unit 시험 정리 Summary

vote.test.ts 를 뜻 대응표와 함께 지우고, 지목·찬반 규칙 시험에 빠졌던 뜻 일곱 개를 더하고, execution·discussion·view·bots·testTools 시험에서 옛 흐름만 검사하던 it 을 지웠다. 서버 코드와 worker 시험은 건드리지 않았고 전체 시험(151 파일, 4376 통과, 기존 조건부 skip 1)과 두 tsc 가 초록이다.

## 한 일

- **Task 1 (e184efc)**: vote.test.ts `git rm`. 새 규칙 시험에 단계 표 행 2개, 던져도 마감이 안 바뀜 2개, 끊긴 사람의 표를 센다 2개, 깊은 동결 2개, 4~8명 집계 1개를 더했다(nomination 5 + verdictRule 4, 총 9 it).
- **Task 2 (d7bb054)**: 다섯 unit 시험의 옛 흐름 전용 it 삭제(61줄 추가·828줄 삭제). 섞인 it 은 옛 단계를 목록에서 빼고 변론·처형만 남겼다.

## vote.test 뜻 대응표

| vote.test describe | 새 규칙 시험의 같은 뜻 (파일 · it) | 처리 |
| --- | --- | --- |
| 단계 표 (D-01·D-25) | nomination.test · "단계 표: 지목은 15000ms…", verdictRule.test · "단계 표: 찬반은 10000ms…" (이번에 더함) | 새 행을 더함. 옛 단계 행 표는 tick.test 에 남아 있어 08-11 이 새 흐름으로 고침 |
| castExecVote — 검사 순서·같은 값 재전송·번복 | nomination · castPoint 검사 순서 6개(같은 값은 입력 그대로, 바꾸면 마지막 값, 죽은 행위자·방에 없는 사람, WRONG_PHASE 먼저), verdictRule · castVerdict 5개(변론자·유령 불가, agree 불리언) | 이미 있음 |
| execTallyOf — 안 던진 사람·탈락자 값은 세지 않음 | nomination · "죽은 사람이 던진 표와 죽은 대상을 가리킨 표는 세지 않는다", verdictRule · "유령이 던졌던 값은 세지 않는다"·"votedSeatsOf…" | 이미 있음. 안 던진 사람은 새 규칙에서 기권이 분모에 남는다(결정 0053-3) — "아무도 안 던지면 부결"이 지킴 |
| 마감 판정 규칙표 (던진 표 분모) | verdictRule · resolveVerdict 분모 유권자 수 6개 | 새 흐름에 없음 — 분모가 던진 표에서 유권자 수로 바뀜(결정 0053-3·0060). 대체됨 |
| resolveExecVote — 개인 표 삭제·voteLog 키·next·동결 | verdictRule · "집계 직후 모든 플레이어에서 verdictVote 키가 없다", "집계 뒤 그날 voteLog 줄의 exec…", "verdict 상태는 후보를 유지하고 passed…", "마감은 읽거나 바꾸지 않고 입력 상태도 바꾸지 않는다" + 이번에 깊은 동결 추가 | 이미 있음 + 동결 추가 |
| tick 연쇄 (discussion → execVote → 후보 선택 …) | 새 흐름 tick 연쇄는 tick 표 훅이 아직 없어 시험할 수 없다 | 08-11 몫(08-11 계획 tick.test: discussion → nomination → defense/night, verdict → execution, 늦은 알람 따라잡기). 옛 연쇄는 새 흐름에 없음 |
| enterExecVote — 남은 키 청소 | nomination · resolveNomination 이 nominate 키를 지움, 낮 시작 청소는 discussion.test · enterDiscussion "verdict·execution 과 모든 플레이어의 nominate·verdictVote·endVote 를 키째 지운다" | 이미 있음 |
| CONN-02 끊긴 사람이 있어도 타이머대로 | nomination · "던진 뒤 연결이 끊긴 사람의 표도 센다", verdictRule · "던진 뒤 연결이 끊긴 유권자의 표도 센다" (이번에 더함). 타이머대로 넘김은 tick.test "연결 끊김" 계열 | 더함 |
| 투표는 마감을 바꾸지 않는다 (D-28) | nomination · "던져도 마감은 그대로…", verdictRule · 같은 이름 (이번에 더함) | 더함 |
| 뷰 (D-02 익명, T-04-01) | view.test · "buildView 낮 처형 필드 (08-07)": 지목 줄 모든 viewer 같음, 찬반 voted 좌석만·값 없음, me.verdictVote 본인에게만, 서버 키 어느 경로에도 없음 | 이미 있음(08-07) |
| castCandidateVote — 검사 순서 | nomination · castPoint 검사 순서(자기 자신·죽은 대상·빈 좌석·정수 아님 BAD_MESSAGE) | 이미 있음 |
| tallyCandidateVote — 최다 한 명·동률·0표·탈락자 표 | nomination · tallyPoints 3:1:1 / 2:2:1 / 0표 / 죽은 표 + 이번에 "4~8명 한 명에게 몰린 판" 추가 | 이미 있음 + 추가 |
| tallyCandidateVote — 서버 셔플·난수 계약 | 새 흐름에 없음 — 한 표씩 공개가 없어 투표 순서를 섞지 않고 pointLinesOf 가 좌석 오름차순 | 결정 0060 으로 대체 |
| castCandidateVote 취소 (결정 0040) | 새 규칙은 취소(null)가 BAD_MESSAGE(nomination "…취소(null)는 BAD_MESSAGE"). 다른 지목으로 바꾸기는 지목 단계 마감까지 가능 | 결정 0060 으로 대체 |
| 취소 뒤 뷰 익명·결과(공개 길이 candidateRevealMs) | 뷰 익명은 위 "뷰" 행. 공개 길이는 새 흐름에 없음 | 결정 0060 으로 대체 |

## 다섯 파일에서 지운 it

| 파일 | 지운 it (요약) | 이유 | 새 흐름 같은 뜻 위치 |
| --- | --- | --- | --- |
| execution.test | enterCandidateVoteReveal 6개, routeAfterCandidateVote 1개 | 후보 공개 진입·경로 훅은 옛 전용 함수 | nomination.test resolveNomination (후보·동률·0표 분기), 훅 연쇄는 08-11 tick.test |
| execution.test | tick 연쇄 4개(후보 선택 → 공개 → 변론 → 처형 → 밤) | 후보 선택 단계에서 출발 | 08-11 tick.test (verdict 마감 → execution). enterExecution 단위 시험은 그대로 |
| execution.test | me.voteTarget 3개, "후보가 없으면(동률) 공개 구간 view…" 1개 | 옛 view 필드·후보 공개 단계 view | view.test 낮 처형 필드(08-07) |
| execution.test | noExecution 의 여부 0표·1:1·후보 0표·동률 이유·아침 뒤 이유 5개 | 옛 처형 여부·후보 선택에서 나온 처형 무효 이유 | 새 흐름의 이유 코드는 08-11 이 정함(결정 필요 시 그때) |
| execution.test (줄임) | 서버 전용 키·day.candidate·day.execution·밤이 아닌 단계·누설 전수 | 옛 단계를 목록에서 뺌, 변론·처형만 남김. "후보가 없으면 입력 그대로"는 후보 선택 대신 변론 상태에서 verdict 의 candidate 를 지워 만듦 | 같은 파일 |
| discussion.test | phaseDurationOf 공개 단계 길이 describe 7개 | 후보 공개·후보 선택 단계 길이 | 새 흐름에 공개 단계 없음(결정 0060) |
| view.test | 단계 길이의 공개 단계 it, 허용 키 전수의 "후보가 없는 공개 구간", 처형 무효 이유의 "여부 반대 다수…", 여부 투표 익명 차분 1개, 후보 선택 진행 중 비공개 차분 1개 | 옛 view 필드(execTally·voteAgree·voteTarget)·옛 단계 view | 08-07 새 필드 시험이 받을 권리 있는 사람에게만·값 비공개를 지킴 |
| view.test (줄임) | 단계 길이 표, 허용 키 전수, 처형이 이뤄진 날의 밤, 마감 뒤 서버 전용 키, 변론부터 votes, 내 채널 each | 옛 세 단계를 목록에서 뺌. 도우미(phaseKeyViolations·ME_KEYS·DAY_KEYS·richStateAt)의 옛 필드 검사·단계 분기 제거 | 같은 파일 |
| bots.test | execVote 계획 3개, candidateVote 계획 2개(botCandidateTarget 2개는 남김), botExecAgree 2개, planBotSteps 고정 설정 4개 | 옛 봇 계획 분기 | 08-07 bots 지목(point)·찬반(verdict) 계획 시험이 이미 같은 파일 끝에 있음 |
| bots.test (줄임) | 계획 키·syncBotPlan·탈락/끊김·say·emoji·난수 호출 수 | execVote·candidateVote·candidateVoteReveal 항목만 뺌 | 같은 파일 |
| testTools.test | skipPhase 의 discussion → 여부 투표, execVote 두 갈래 3개, "투표 단계에서 안 던진 봇" describe 5개, "봇 투표 설정을 따른다" describe 5개, 후보 공개 단계 넘김 1개, 봇 없는 execVote 넘기기 1개 | skipPhase 옛 단계 봇 일괄 | 같은 파일의 "지목·찬반에서 안 던진 봇이 먼저 던진다"(08-07) |

## 08-11 로 넘기는 것 (A2: 애매한 it 은 지우지 않고 남김)

- test/unit/tick.test.ts 의 단계 표(열다섯 단계, 옛 execVote·candidateVote 행)와 view.test "마감은 이전 마감 + 단계 길이로 이어진다"(execVote +13000), bots.test "같은 단계 키로 다시 부르면…"(discussion → execVote 걷기)는 흐름 전환과 함께 새 단계로 고쳐야 한다.
- 도우미: view.test endedState·stateAt, bots.test verdictAt(…, "candidateVote"), voteState.ts stateWithVerdict 의 옛 단계 걷기. 이 계획은 건드리지 않았다.
- 옛 view 필드 시험 중 새 필드로 옮겨야 할 뜻은 없었다(08-07 시험이 모두 지킴).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 막힘 해소] 전수 검사 도우미에서 옛 필드 이름 제거**
- **Found during:** Task 2
- **Issue:** 인수 기준이 view.test 에서 execTally·voteAgree·voteTarget 단어를 0 으로 요구하는데, 단어가 ME_KEYS·DAY_KEYS 허용 목록과 phaseKeyViolations 검사 안에 있어 it 만 지워서는 0 이 되지 않았다. 허용 목록에서 빼면 옛 단계 view 가 목록 밖 키로 걸린다
- **Fix:** 허용 목록과 검사에서 옛 필드를 빼고, 그 필드를 싣는 옛 세 단계를 전수 검사 단계 목록에서 뺐다
- **Files modified:** test/unit/view.test.ts
- **Commit:** d7bb054

**2. [Rule 2 - 누락 보완] 새 규칙 시험에 vote.test 뜻 보강**
- vote.test 의 단계 표·마감 불변·끊긴 사람 표·깊은 동결 뜻이 새 규칙 시험에 없어 9개 it 을 더했다(계획의 "없던 뜻은 더한다"와 같다)
- **Commit:** e184efc

## Known Stubs

없음.

## Threat Flags

없음 (시험만 바꿨고 새 입력 경로가 없다).

## Self-Check

- vote.test.ts 없음, shared/game/vote.ts 있음, protocol.ts 에 candidateVoteReveal 있음: 통과
- 옛 view 필드·옛 전용 규칙 함수 grep 0, .skip(·.todo( grep 0, 누설 시험 3개 diff 0: 통과
- npx tsc (app·worker), npx vitest run 전체: 통과 (151 파일, 4376 통과)
- 커밋 e184efc, d7bb054 이 HEAD 조상에 있음

## Self-Check: PASSED
