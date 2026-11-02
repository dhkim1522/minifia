---
phase: 08-day-execution-ghost
plan: "11"
subsystem: server-flow-transition
tags: [tdd, tracer, tick-hooks, phase-table, flow-transition, test-migration, leak-scan]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-02 resolveNomination·resolveVerdict·enterDiscussion, 08-07 DO 핸들러·봇·toPhase, 08-09 syncLayout·새 유령 snap, 08-28 옛 흐름 전용 unit 시험 정리
provides:
  - 서버 낮 흐름 discussion(90000) → nomination(15000) → defense(20000) → verdict(10000) → execution(5000) → night, 옛 처형 여부·후보 선택·후보 공개 단계로는 어떤 tick 경로로도 가지 않는다
  - tick 표 ON_ENTER.discussion = enterDiscussion, ON_DEADLINE.nomination = resolveNomination, ON_DEADLINE.verdict = resolveVerdict
  - enterExecution 은 verdict.passed 일 때만 변론자 탈락, noExecutionOf 는 지목 0표(noVotes)·동률(tie)만 파생(notMajority 는 더 나오지 않는다)
  - 새 흐름으로 다시 지은 시험 도우미(stateWithVerdict "defense"|"verdict"|"execution", castPoints·castVerdicts, worker pointAll·verdictAll, driveToEnded 훅 nomination·verdict)
  - 실제 흐름 한 판 시험(trial.test "실제 흐름") 과 새 흐름 6명 한 판 누설 검사(leak.test)
affects: [08-12 이후 화면(서버가 새 단계를 실제로 보낸다), 08-21 서버 옛 코드·옛 표 도우미 삭제, 08-22 옛 단계 이름·정규화, 배포 전 정규화(A3)]

actuals:
  tokens: 52000
  tasks: 3
  commits: 4
plan_head_before: 92eddbf5d10069d3d90c35af3ea180379a966a50
plan_head_after: 49f10a67ebf4d6063e2aadc677192e035d1e5aae

tech-stack:
  added: []
  patterns:
    - "흐름 전환은 데이터 표(PHASE_DEFS next·길이)와 훅 표(ON_ENTER·ON_DEADLINE) 두 곳만 바꾸고 tick 루프·훅 타입은 건드리지 않는다"
    - "옛 단계 행·옛 훅 행은 닿지 않는 채로 표에 남긴다(A1) — 지우면 PhaseId 와 화면이 함께 깨지므로 08-21·22 가 나눠 지운다"
    - "개인 표(nominate·verdictVote)는 마감 훅이 키째 지우므로 넘긴 뒤 단언은 그날 voteLog 줄(cand.votes·exec)로 한다"
    - "상태 도우미는 손으로 필드를 채우지 않고 실제 castPoint·castVerdict 주입과 tick 으로 만든다(Pitfall 12)"

key-files:
  created:
    - test/unit/phases.test.ts
  modified:
    - shared/game/phases.ts
    - shared/game/tick.ts
    - shared/game/execution.ts
    - test/helpers/voteState.ts
    - test/unit/tick.test.ts
    - test/unit/execution.test.ts
    - test/unit/discussion.test.ts
    - test/unit/night.test.ts
    - test/unit/endgame.test.ts
    - test/unit/view.test.ts
    - test/unit/bots.test.ts
    - test/unit/testTools.test.ts
    - test/unit/nyquist-04-multiday-flow.test.ts
    - test/worker/helpers.ts
    - test/worker/trial.test.ts
    - test/worker/leak.test.ts
    - test/worker/alarm.test.ts
    - test/worker/chat.test.ts
    - test/worker/endgame.test.ts
    - test/worker/testTools.test.ts
    - test/worker/bots.test.ts
  deleted:
    - test/worker/vote.test.ts

key-decisions:
  - "enterExecution 은 state.verdict?.passed !== true 면 입력 그대로 돌려주고 난수를 부르지 않는다. 찬반이 부결이어도 처형 단계는 거치고(결과 발표는 처형 단계가 맡는다) 아무도 탈락하지 않는다"
  - "noExecutionOf 는 night 에서만, 그날 voteLog 줄의 cand 가 있고 cand.candidate 가 없을 때만 값을 준다: votes 비어 있음 → noVotes, 있음(최다 동률) → tie. 후보가 있었던 날(찬반 통과·부결 모두)은 키가 없다 — 부결은 처형 단계에서 이미 알렸다. 프로토콜 NoExecutionReason 의 notMajority 값은 08-21·22 가 지운다"
  - "옛 execVote·candidateVote·candidateVoteReveal 의 표 행과 훅 행(enterExecVote·resolveExecVote·enterCandidateVoteReveal·routeAfterCandidateVote)은 그대로 둔다(A1). 닿지 않는 코드로 08-21 이 지운다"
  - "옛 표 도우미(castExecVotes·castCandidateVotes)는 voteState.ts 에 남긴다 — 쓰는 곳은 없어졌고 08-21 이 지운다(A4)"
  - "stateWithVerdict 는 옛 시그니처·후보 지정 뜻(citizen·mafia·seat·tie·none)을 유지하고 phase 를 defense·verdict·execution 으로 바꿨다. verdict 는 새로 더했다"

requirements-completed: [DAY-03, DAY-05, DAY-06, DAY-07]

coverage:
  - id: D1
    description: "단계 길이와 기본 다음 단계 사슬(discussion 90000 → nomination 15000 → defense 20000 → verdict 10000 → execution 5000 → night 30000 → morning → dayAnnounce), 옛 세 단계로는 기본 경로로도 가지 않는다"
    requirement: DAY-07
    verification:
      - kind: unit
        ref: "test/unit/phases.test.ts (3 tests), test/unit/tick.test.ts 'PHASE_DEFS'"
        status: pass
    human_judgment: false
  - id: D2
    description: "tick 훅 표: 토론 마감 → 지목(+15000), 지목 마감 최다 한 명 → 변론(+20000)·동률/0표 → 밤, 찬반 마감은 부결이어도 처형(+5000), 늦은 알람이 지목에서 처형까지 따라잡아도 지목 훅 → 찬반 훅 순서"
    requirement: DAY-05
    verification:
      - kind: unit
        ref: "test/unit/tick.test.ts 'tick (순수 단계 진행)' 6개 + '늦은 알람' 계열"
        status: pass
    human_judgment: false
  - id: D3
    description: "실제 한 판(5명 소켓): 토론 끝내기 과반 → 지목(마감 = 그 시각 + 15000) → 4:1 → 변론(변론자 무대) → 찬반 3:1 → 처형(변론자 탈락·유령 snap 1개, 모든 view day.verdict {3,1,true}) → 밤. 0표 noVotes, 2:2 tie, 부결(2:2) 시 탈락 없음·밤 view noExecution 키 없음, 둘째 날 청소, 처형으로 승패(마피아 변론자) 시 ended"
    requirement: DAY-03
    verification:
      - kind: integration
        ref: "test/worker/trial.test.ts '실제 흐름 (결정 0060-1)' (8 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "새 흐름 6명 한 판 누설 검사: 토론 끝내기 → 지목 → 변론 → 찬반(한 사람이 값을 바꿈) → 처형 → 밤 → 2일차 지목 동률 밤 → 3일차 종료. 남의 verdictVote 값 0건, .view.day.verdict 는 execution 에서만, .view.me.verdictVote·endDiscussion 은 본인 값만, 처형 view 에 역할 키 0건"
    requirement: DAY-06
    verification:
      - kind: integration
        ref: "test/worker/leak.test.ts '6명 한 판: 낮 처형(…) 전수 프레임 누출 검사'"
        status: pass
    human_judgment: false
  - id: D5
    description: "전체: 앱·워커 타입 검사와 vitest 전체(151 파일 4366 통과, 1 skipped 는 이전부터)"
    verification:
      - kind: command
        ref: "npm run typecheck; npx vitest run (연속 2회)"
        status: pass
    human_judgment: false
  - id: D6
    description: "실제 낮 한 판의 박자(토론 90초·지목 15초·변론 20초·찬반 10초)가 몰입에 맞는지"
    verification: []
    human_judgment: true
    rationale: "서버 흐름과 길이만 정했다. 화면(08-13 이후)이 붙은 뒤 실기기 플레이테스트에서 본다"

duration: 약 45분
completed: 2026-11-02
---

# Phase 08 Plan 11: 낮 흐름 전환(지목 → 변론 → 찬반 → 처형)과 시험 이전 Summary

phases.ts 의 길이·기본 다음 단계와 tick.ts 의 진입·마감 훅 표, execution.ts 의 처형 조건(찬반 통과일 때만 탈락)·처형 무효 이유(지목 0표 noVotes / 동률 tie)를 새 흐름으로 바꾸어 서버가 처음으로 토론 → 지목 → 변론 → 찬반 → 처형 → 밤을 끝까지 돌리게 했고, 깨진 unit·worker 시험과 상태 도우미를 skip 없이 새 흐름으로 옮겼다. 전체 시험(151 파일, 4366 통과, 기존 조건부 skip 1)과 두 tsc 가 초록이다.

## 한 일

- **Task 1 트레이서 (RED a3d159d → GREEN 8919348)**: phases.test.ts 신규 3개와 trial.test.ts "실제 흐름" 6개(이후 2개 더함)를 먼저 빨갛게 커밋하고, phases.ts(`DISCUSSION_MS = 90_000`, `DEFENSE_MS = 20_000`, discussion → nomination, defense → verdict)·tick.ts(`discussion: enterDiscussion`, `nomination: resolveNomination`, `verdict: resolveVerdict`)·execution.ts 를 바꿨다. 트레이서 게이트는 `<verify>` 를 다시 돌려 통과를 확인한 뒤 확장 작업으로 넘어갔다(자동 모드와 같은 취급, 사람 확인 항목 없음).
- **Task 2 (3925e64)**: 먼저 `npx vitest run --project unit` 을 돌려 실패 목록을 적었다 → 도우미를 다시 짓고 남은 실패를 옮겼다(아래).
- **Task 3 (49f10a6)**: `npx vitest run --project worker` 실패 목록을 적고 helpers·leak·endgame·bots·testTools·chat·alarm 을 옮기고 vote.test 를 지웠다.

## 실패 목록 (전환 직후)

| 시점 | 실패 | 원인 |
| --- | --- | --- |
| Task 1 GREEN 직후 | trial.test 3개 | 08-09 변론 시험이 `toPhase` 로 `verdict.candidate` 를 직접 세웠는데, 이제 지목 마감 훅이 실제로 돌아 표가 없으면 밤으로 간다 |
| Task 2 시작 unit | 9 파일 108개 → 도우미 재건 뒤 49개 | endgame 38, view 18, execution 15, bots 15, testTools 9, tick 7, nyquist-04 4, night 1, discussion 1 (대부분 stateWithVerdict·옛 단계 걷기) |
| Task 3 시작 worker | 7 파일 58개 | vote 27, testTools 8, endgame 7, bots 7, chat 6, leak 2, alarm 1 |

## 시험 도우미 재건 (A4)

- `stateWithVerdict(n, seed, "defense" | "verdict" | "execution", { candidate, lobby })`: 토론 마감 → 지목(후보 지정대로: citizen·mafia 는 그 직업 가장 낮은 seat, 숫자는 그 seat, 나머지 산 사람이 그 사람을 가리키고 그 사람은 다른 사람, tie 는 seat 0·1 이 서로, none 은 아무도 안 가리킴) → 변론 → 찬반(변론자 뺀 산 사람 전원 찬성) → 처형. tie·none 은 지목 마감이 night 로 가서 닿지 않는다(옛 도우미와 같은 제약).
- `castPoints`·`castVerdicts` 를 실제 `castPoint`·`castVerdict` 로 주입한다. view.test `stateAt`·`endedState`, bots.test `verdictAt`, testTools.test 도우미, nyquist-04 가 같은 방식으로 새 흐름을 걷는다.
- worker: `pointAll(code, actors, bySeat)`·`verdictAll(code, actors, bySeat)` 가 옛 `voteExec`·`voteCandidate` 를 대신하고(`votesIn` 키는 nominate·verdictVote), `driveToEnded` 의 훅 단계는 `"nomination" | "verdict"` 다.

## 시드 고정값을 다시 고정한 곳

- bots.test "discussion·night 계획 고정값": 856098986·997718148 → 34804349·962657041. 토론이 90초가 되고 밤이 지목 마감 뒤에 닿아 두 계획의 시각(at)이 모두 달라졌다. 계획 규칙은 그대로다(난수 호출 수 25 단언은 그대로 통과).
- endgame.test·nyquist-04·leak.test 의 요약 `yes` 값: 변론자를 뺀 유권자 기준으로 바뀌었다(4명 판 4 → 3, 6명 판 1일차 4:1).

## vote.test (worker) 뜻 대응표 — 파일 삭제

| vote.test describe | 새 흐름의 같은 뜻 (파일 · 시험) | 처리 |
| --- | --- | --- |
| 여부 투표 방송 (집계 전원·내 표 본인만·차분) | trial.test "지목" 7개(전원 같은 공개 목록, 250ms 간격), "찬반 방송 규율" 6개(첫 표 전원·값 변경 본인만·남의 값 0건) | 이미 있음(08-07). 집계 비공개 차분은 옛 필드 전용이라 대체됨 |
| 스키마(문자열 agree·덧붙은 키)·단계 아님 WRONG_PHASE | trial.test "스키마: 덧붙은 키(seat)와 범위 밖 target(8)", "지목 단계가 아니면(discussion) WRONG_PHASE", unit schemas.test | 이미 있음 |
| 마감 분기(통과/불통과/0표) | trial.test "실제 흐름" — 3:1 통과, 2:2 부결, 지목 0표·동률, leak.test 2일차 동률 밤 | 새 흐름으로 옮김 |
| 마감 뒤 도착한 투표(WRONG_PHASE + 넘어간 단계 state, 저장 집계 그대로) | trial.test "마감 뒤 도착한 지목은 그 소켓에만 WRONG_PHASE…" | 이번에 더함 |
| 후보 선택은 투표자에게만·취소(결정 0040)·자기 자신·범위 밖 | 새 규칙은 지목이 모두에게 공개이고 취소(null)가 없다(결정 0060-3). 자기 자신·범위 밖은 trial.test 지목 시험 | 결정 0060 으로 대체 |
| 선택 공개(voteLog cand.votes 같은 순서·표 수 길이) | 공개 단계가 없다. 지목 줄은 좌석 오름차순 공개(nomination.test), 마감 뒤 voteLog 줄은 bots.test "nomination: … cand.votes" | 결정 0060 으로 대체 |
| 최후 변론 chat·say 거절·변론자 아닌 사람의 chat | trial.test "변론 중 변론자의 chat 은 모두에게 ch all…" (이번에 더함), chat.test D1 단계 목록의 defense | 옮김 |
| 처형 발표(day.execution {seat, phrase 1..4}·관전은 처형된 소켓만·역할 단어 경로) | trial.test 첫 실제 흐름 시험에 단언 더함 + leak.test 전수 검사 | 옮김 |
| 처형 무효 밤(tie·noVotes·notMajority) | trial.test 2:2 tie(+아침에는 키 없음)·0표 noVotes·부결 시 키 없음 | 옮김. notMajority 는 더 나오지 않는다 |
| 죽은 사람 거부 | trial.test "죽은 사람의 지목은 BAD_MESSAGE"(이번에 더함)·"죽은 사람의 찬반"·"유령의 토론 끝내기" | 옮김 |

## 이월 항목 처리 (carry_forward)

- **08-07 → 이 계획**: unit testTools.test 의 "넘긴 뒤 nominate/verdictVote 가 남는다" 단언을 voteLog 줄 기준(지목 `cand.votes`, 찬반 `exec`)으로 옮겼다. 마감 훅 순서는 지목 → 찬반이며 tick.test "늦은 알람이 지목에서 처형까지 따라잡아도…" 가 voteLog 줄을 지목 훅이 만들고 찬반 훅이 채움을 지킨다. (worker/testTools.test.ts 에는 그 단언이 없었고 같은 뜻의 skipPhase 시험은 unit 에 있다.)
- **08-28 → 이 계획**: tick.test 단계 표·view.test 마감 연쇄(execVote +13000 → nomination +15000)·bots.test "같은 단계 키로 다시 부르면…"(nomination 키)·`stateWithVerdict`·`verdictAt(…)` 를 모두 새 단계로 고쳤다.
- **08-09 → 이 계획**: 변론·처형 배치 시험(trial.test "모이기·무대 배치")이 `verdict.candidate` 직접 주입 대신 산 사람 전원의 `nominate` 를 저장해 두고 실제 지목 마감 훅(resolveNomination)으로 변론에 들어간다. 처형 배치(execution)는 그날 voteLog 줄을 먼저 보므로 찬반 결과를 voteLog 줄에도 함께 맞춘다.
- 알려진 불안정 시험(`test/worker/bots.test.ts` "봇 chat: 밤에는 마피아 봇의 줄…")은 이번 변경으로 결정적으로 실패하지 않았다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 막힘 해소] trial.test 의 08-09 변론 시험을 실제 마감 훅 경로로**
- **Found during:** Task 1 GREEN
- **Issue:** 흐름 전환으로 지목 마감 훅이 돌아, `toPhase("nomination", verdict.candidate)` 만 세운 시험이 표 0 → 밤으로 갔다. 또 처형 배치는 voteLog 줄(exec.passed)을 verdict 보다 먼저 봐서 통과/부결 시험의 입력도 줄을 함께 맞춰야 했다
- **Fix:** `pointedAt(target)` 로 저장 상태에 지목 표를 두고 실제 마감 훅으로 변론에 들어가게 했고, 처형 시험은 voteLog 줄도 함께 patch 했다
- **Files modified:** test/worker/trial.test.ts
- **Commit:** 8919348

**2. [Rule 3 - 막힘 해소] 계획에 없던 시험 파일 수정**
- test/unit/night.test.ts: 늦은 알람 따라잡기의 마감 합(EXEC_VOTE_MS → NOMINATION_MS)이 틀려 고쳤다. 계획의 files 목록에 gameRoom.test·nyquist-03.1-multiday.test 는 있었으나 두 파일은 옛 단계에 기대지 않아 바뀌지 않았고 night.test 가 더해졌다
- **Commit:** 3925e64

**3. [Rule 3 - 막힘 해소] worker 시험 시간 한도**
- **Issue:** 낮이 지목·변론·찬반·처형으로 길어져(단계 넘김 4번 더) 한 판을 끝까지 돌리는 시험이 기본 5초를 넘었고, 전체 시험을 동시에 돌릴 때 `skipOnce` 의 3초 프레임 대기가 testTools "ended 에서 testReset" 에서 두 번 초과했다
- **Fix:** endgame.test 는 파일 안에서 `vi.setConfig({ testTimeout: 20_000 })`, helpers.ts `skipOnce` 의 프레임 대기 한도를 10초로 넓혔다. 긴 대기 없이 forceDue 로 넘기는 방식은 그대로다. 수정 뒤 전체 시험 연속 2회 초록
- **Files modified:** test/worker/endgame.test.ts, test/worker/helpers.ts
- **Commit:** 49f10a6

**4. [Rule 1 - 계획 문구 보정] 토론 끝내기 숫자**
- 계획의 행동에 "4명 endDiscussion → 4번째(과반 3 넘음)" 이 있으나 5명 판의 과반은 3 이라 세 번째 표가 단계를 넘긴다. 시험은 3명으로 쓰고 6명 판(leak.test)은 과반 4 로 쓴다. 지목 마감 = 그 시각 + 15000(±50) 단언은 그대로다
- **Commit:** a3d159d

**5. [Rule 2 - 누락 보완] 새 단계를 전수 검사 목록에 더함**
- view.test 의 PHASES·REVEALING_PHASES·DAY_VIEW_PHASES 에 nomination·verdict 를 더하고(08-28 이 08-11 로 넘긴 일), `day.candidate` 기대를 변론·찬반·처형으로 고쳤다. 전수 검사 단계는 열 개 → 열두 개다
- **Commit:** 3925e64

**Total deviations:** 5 (Rule 3 ×3, Rule 1 ×1, Rule 2 ×1). **Impact:** 서버 코드 변경은 계획대로(phases·tick·execution 세 파일)이고 나머지는 시험·도우미 범위다.

## TDD Gate Compliance

| 작업 | RED 커밋 | GREEN 커밋 |
| --- | --- | --- |
| Task 1 (트레이서) | a3d159d `test(08-11)` — phases.test 3개·trial.test 실제 흐름 7개가 의도한 이유로 실패(예: `expected 40000 to be 90000`, `expected 'execVote' to be 'nomination'`) | 8919348 `feat(08-11)` |
| Task 2·3 (시험 이전) | 3925e64·49f10a6 — 코드가 이미 바뀐 뒤의 시험 이전이라 빨간 상태는 Task 1 GREEN 직후의 실패 목록(위 표)이 RED 역할을 했다 | 같은 커밋 |

REFACTOR 커밋은 없다.

## Known Stubs

없음.

## Threat Flags

없음 (서버 규칙 호출 순서와 시험만 바꿨고 새 입력 경로가 없다). 위협 T-08-28(조기 종료·마감 연쇄)은 "과반 직후 마감 = 그 시각 + 15000" 과 늦은 알람 따라잡기 시험으로, T-08-29(새 흐름 view 누설)는 leak.test 새 흐름 6명 한 판으로 완화했다. 누설 검사의 금지 키·역할 단어 목록은 줄이지 않았고(`FORBIDDEN_KEYS` 그대로), `SERVER_ONLY_KEYS` 에 `nominate`·`verdictVote`·`endVote` 를 더했으며, 같은 이름의 공개 와이어 경로 두 개(`.view.day.verdict`: 처형 단계 모두에게 같은 집계, `.view.me.verdictVote`: 그 소켓 본인 값)만 이유 주석과 함께 허용했다.

## 다음 계획에 넘기는 것

- 서버가 이제 새 단계를 실제로 보낸다. 옛 세 단계의 화면·메시지·표 행·훅 행·`castExecVotes`·`castCandidateVotes`·protocol `notMajority` 는 닿지 않는 채로 남아 있다 — 08-21·22 가 지운다.
- 배포 전에 진행 중인 방의 정규화(A3)가 필요하다(08-22). 그 전까지 배포하지 않는다.

## Self-Check

- test/unit/phases.test.ts·test/worker/trial.test.ts·phases.ts·tick.ts·execution.ts·voteState.ts·worker helpers.ts 있음, test/worker/vote.test.ts 없음: 통과
- 커밋 a3d159d·8919348·3925e64·49f10a6 이 HEAD 조상에 있음, `test(08-11)` 커밋 3개: 통과
- 인수 기준(grep: DISCUSSION_MS 90_000·nomination: resolveNomination·discussion: enterDiscussion·next: "nomination" 1건, .skip/.todo 0건, 40000 리터럴 0건, FORBIDDEN_KEYS 줄 그대로, vote.test 없음): 통과
- `npm run typecheck` 와 `npx vitest run`(연속 2회, 151 파일 4366 통과): 통과

## Self-Check: PASSED
