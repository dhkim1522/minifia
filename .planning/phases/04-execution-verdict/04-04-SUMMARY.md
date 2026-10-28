---
phase: 04-execution-verdict
plan: 04
subsystem: game-server
tags: [vote, candidate, shuffle, execution, view, tdd, pure-rules]

requires:
  - phase: 04-execution-verdict
    provides: "04-01 의 tick 마감 분기(DeadlineResult.next)·execVote 규칙·와이어 타입, 04-02 의 단계 표 이전, 04-03 의 결정 0036"
provides:
  - "castCandidateVote·tallyCandidateVote (vote.ts): 자기 제외 후보 선택, 최다 한 명만 후보, 동률·0표는 후보 없음, 서버 Fisher-Yates 공개 순서"
  - "execution.ts: enterCandidateVoteReveal·routeAfterCandidateVote·enterExecution·noExecutionOf"
  - "tick 표 행: candidateVoteReveal·execution 진입 훅, candidateVoteReveal 마감 훅"
  - "view 필드: me.voteTarget, day.candidate, day.execution, day.noExecution, day.voteLog[].cand 채움"
  - "test/helpers/voteState.ts: 실제 투표 주입과 tick 으로 투표 이후 단계를 만드는 도우미"
affects: [04-05, 04-06, 04-07, 04-09, 04-10]

actuals:
  tokens: 13000
  tasks: 2
  commits: 6
plan_head_before: d59d155b6b61f406eb81a7af4a67833cb51b9a6c
plan_head_after: 7f60a43ae8a8a3023c9f746c0081897d09b63fa1
commits: 6

tech-stack:
  added: []
  patterns:
    - "처형 무효 이유는 새 상태 필드 없이 그날 공개 voteLog 에서 파생하고 night 단계 view 에서만 싣는다 — 수명 관리할 상태가 없다"
    - "공개 순서는 진입 훅에서 한 번 셔플해 votes 배열 순서로 기록 — 난수 호출 인자 [n, n-1, …, 2] 가 계약"
    - "테스트 상태는 손으로 짜지 않고 실제 투표 주입 + tick 으로 만든다(stateWithVerdict)"

key-files:
  created:
    - shared/game/execution.ts
    - test/unit/execution.test.ts
    - test/helpers/voteState.ts
  modified:
    - shared/game/vote.ts
    - shared/game/tick.ts
    - shared/game/view.ts
    - test/unit/vote.test.ts
    - test/unit/view.test.ts
    - HANDOFF.md

key-decisions:
  - "후보 선택 집계는 공개 구간 진입 훅에서 한 번에 한다(마감 훅에는 난수 인자가 없다)"
  - "공개 진입 때 Player.candidateVote 를 지운다 — 같은 내용이 voteLog.cand.votes 로 남는다"
  - "처형 문구는 아침 문구와 따로 센다(lastExecPhrase), 처형 진입 훅에서 한 번 추첨"
  - "여부 동률을 notMajority 로 묶는다(결정 0036 의 바뀔 수 있는 기본값, noExecutionOf 한 곳)"

requirements-completed: []
requirements-server-rules-done: [VOTE-02, VOTE-03, VOTE-04]  # 서버 규칙·view 만. 화면(화살표 공개·스포트라이트·발표·기록 카드)은 UI-SPEC 뒤 화면 계획 몫이라 REQUIREMENTS 체크박스는 열어 둔다

coverage:
  - id: D1
    description: "후보 선택 수신: 단계 → 행위자 → 대상 → 자기 자신 순서로 검사하고(자기·탈락자·없는 자리·정수 아님은 BAD_MESSAGE, 다른 단계는 WRONG_PHASE), 같은 값은 입력 그대로, 번복 가능, 마감 불변"
    requirement: "VOTE-02"
    verification:
      - kind: unit
        ref: "test/unit/vote.test.ts#castCandidateVote (VOTE-02, D-03) — 검사 순서"
        status: pass
    human_judgment: false
  - id: D2
    description: "집계: 최다 한 명만 후보, 동률·0표는 후보 없음(난수로 고르지 않음), 공개 순서는 seat 오름차순 뒤 Fisher-Yates, 난수 인자는 [n, n-1, …, 2] 이고 n ≤ 1 이면 호출 없음"
    requirement: "VOTE-02"
    verification:
      - kind: unit
        ref: "test/unit/vote.test.ts#tallyCandidateVote (VOTE-02, D-03, D-04, D-20) — 집계와 서버 셔플"
        status: pass
    human_judgment: false
  - id: D3
    description: "공개 구간 진입이 voteLog 그날 줄에 cand 를 싣고 verdict 를 정하며 candidateVote 키를 지우고, 후보 없음이면 공개 4초 뒤 night, 후보 있으면 변론 10초 → 처형 5초 → night"
    requirement: "VOTE-03"
    verification:
      - kind: unit
        ref: "test/unit/execution.test.ts#tick 연쇄: 후보 선택 → 공개 → 변론 → 처형 → 밤 (D-25, D-28)"
        status: pass
      - kind: unit
        ref: "test/unit/execution.test.ts#enterCandidateVoteReveal (VOTE-02, D-20, D-21)"
        status: pass
    human_judgment: false
  - id: D4
    description: "처형 진입: 후보만 탈락, 문구는 직전 문구를 뺀 후보에서 randInt 한 번, 직업은 어디에도 싣지 않음"
    requirement: "VOTE-04"
    verification:
      - kind: unit
        ref: "test/unit/execution.test.ts#enterExecution (VOTE-04, D-06, D-09, D-11)"
        status: pass
      - kind: unit
        ref: "test/unit/execution.test.ts#처형 직업 비공개 (D-09)"
        status: pass
    human_judgment: false
  - id: D5
    description: "처형 무효로 온 밤에만 day.noExecution {reason} 이 모두에게 같게 실리고(여부 0표 noVotes · 반대 다수·동률 notMajority · 후보 0표 noVotes · 후보 동률 tie), 처형이 이뤄진 날·다른 단계·아침 이후에는 없다"
    requirement: "VOTE-02"
    verification:
      - kind: unit
        ref: "test/unit/execution.test.ts#noExecutionOf · day.noExecution (D-34)"
        status: pass
    human_judgment: false
  - id: D6
    description: "진행 중 후보 선택은 본인 view 의 me.voteTarget 에만 있고 다른 viewer(관전자 포함)의 view 는 남의 선택과 무관하게 같다; 새 단계 전수 누출 검사"
    requirement: "VOTE-02"
    verification:
      - kind: unit
        ref: "test/unit/execution.test.ts#view: me.voteTarget (D-19, A7, T-04-10)"
        status: pass
      - kind: unit
        ref: "test/unit/execution.test.ts#새 단계 전수 누출 검사"
        status: pass
    human_judgment: false

duration: 약 10분
completed: 2026-10-28
status: complete
---

# Phase 4 Plan 04: 후보 선택·공개·변론·처형 규칙 Summary

**후보 선택 투표를 자기 제외·번복 가능·최다 한 명만 후보로 받아 공개 구간 진입 때 서버가 섞은 순서로 voteLog 에 싣고, 후보 없음은 공개 4초 뒤 밤으로, 후보 있음은 변론 → 처형(탈락·문구)으로 흘리며, 처형 무효 이유는 공개 투표 기록에서 파생해 그 밤 view 에만 싣는 순수 규칙과 view 필드를 만들었다.**

## 진행 기록

Task 1 — RED 21a81c0 / GREEN 069c459 / vote.test.ts 50 통과, tsc-scoped 0 / 체크포인트 5cd573c.
Task 2 — RED 5cbc690 / GREEN 6a1b20a / `npm test` 84 파일 1991 통과, tsc app·worker 0 / 남은 태스크 없음. HANDOFF 진행 줄 7f60a43(로컬 커밋만).
(Task 2 가 마지막이고 한 실행기가 이어서 끝내 별도 `progress checkpoint` 커밋은 Task 1 뒤에만 두었다.)

## Accomplishments

- `vote.ts`: `castCandidateVote`(단계 → 행위자 → 대상 → 자기 자신 → 같은 값이면 입력 그대로, 마감 불변)와 `tallyCandidateVote`(살아 있는 투표자·살아 있는 대상의 표만, seat 오름차순 → Fisher-Yates, 최다 한 명만 candidate 키). 난수 호출 계약은 함수 주석에 적었다: n ≥ 2 면 `randInt(n) … randInt(2)`, n ≤ 1 이면 호출 없음, `randInt(0)` 없음.
- `execution.ts`(신규): `enterCandidateVoteReveal`(그날 voteLog 줄에 `cand` 를 붙이고 verdict·candidateVote 청소), `routeAfterCandidateVote`(후보 없으면 `next: "night"`), `enterExecution`(후보만 alive false, `execution {seat, phrase}`, `lastExecPhrase`), `noExecutionOf`(밤 단계에서 그날 voteLog 줄로 이유 파생). role 을 읽지 않는다.
- `tick.ts`: ON_ENTER 에 `candidateVoteReveal`·`execution`, ON_DEADLINE 에 `candidateVoteReveal` 행과 머리 주석.
- `view.ts`: `me.voteTarget`(생존 본인·candidateVote 단계), `day.candidate`(공개·변론·처형, 후보 있을 때), `day.execution`(처형 단계, 필드별 복사), `day.noExecution`(밤 단계, `{reason}` 새 리터럴).
- `test/helpers/voteState.ts`: `lobbyOf`·`startedAt`·`castExecVotes`·`castCandidateVotes`·`stateWithVerdict`. 실제 투표 주입과 tick 만으로 투표 이후 네 단계에 닿는다.

## TDD 기록

**Task 1 RED** (`test(04-04)`, 21a81c0): `npx vitest run test/unit/vote.test.ts --reporter=tap-flat`, 종료 코드 1. 50개 중 17개 실패(`Error: not implemented`), 기존 33개 통과. `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK / target_test_failed`. 의미 점검(semanticAssessment): 모든 실패는 `castCandidateVote`·`tallyCandidateVote` 껍데기가 던지는 "기능이 없다" 이고, 모듈 로드·픽스처 실패가 아니다. 04-01 과 같이 import 가 되도록 던지는 껍데기를 RED 커밋에 함께 두었다(모듈 자체가 없으면 INVALID_RED).
**Task 1 GREEN** (069c459): 50/50 통과.

**Task 2 RED** (`test(04-04)`, 5cbc690): `npx vitest run test/unit/execution.test.ts --reporter=tap-flat`, 종료 코드 1. 34개 중 29개 실패, 5개는 아직 훅이 없어서 키가 없는 것이 맞는 부정 가드(남의 선택 차분, 서버 전용 키 이름 부재 등)라 통과. 목표 테스트 `noExecutionOf · day.noExecution (D-34) > 여부 0표 → 밤 view 에 {reason:'noVotes'}` → `RED_EVIDENCE_OK / target_test_failed`. 의미 점검: 훅 껍데기가 던지거나(`not implemented`), tick 이 훅 없이 흘러 `cand`·`execution`·`noExecution` 이 view 에 없어 단언에서 실패한다. 의도한 이유다.
**Task 2 GREEN** (6a1b20a): 35/35 통과, 전체 `npm test` 통과.

**REFACTOR**: 없음.

## Verification

| 명령 | 결과 |
|---|---|
| `npx vitest run test/unit/execution.test.ts test/unit/vote.test.ts test/unit/tick.test.ts` | 109 passed |
| `npx vitest run --project unit` | 35 파일 884 passed |
| `npm test` (unit·client·worker) | 84 파일 1991 passed, 실패 0 |
| `npx tsc -p tsconfig.app.json --noEmit` | 종료 코드 0 |
| `npx tsc -p tsconfig.worker.json --noEmit` | 종료 코드 0 |
| `node scripts/tsc-scoped.mjs tsconfig.app.json '^(shared\|test/unit\|test/helpers)/'` | OK |
| `npx vitest run test/unit/handoff.test.ts` | 통과, HANDOFF 2981바이트 |

수용 기준 그렙: execution.ts 내보내기 4, `noExecution` view.ts 4, tick 진입 훅 행 2, `voteTarget` view.ts 2, `randInt(0)` 주석 밖 0, vote.ts 내보내기 2, `voteState.ts` 존재. `test(04-04)` 커밋이 `feat(04-04)` 커밋보다 먼저다(두 쌍 모두). `git push`·배포는 실행하지 않았다(04-05 가 웨이브 1~3 을 함께 push).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RED 커밋에 던지는 껍데기 포함**
- **Found during:** Task 1·2 RED
- **Issue:** 없는 모듈·함수를 import 하면 파일 전체가 로드 실패라 `INVALID_RED` 가 된다(04-01 과 같은 이유).
- **Fix:** `vote.ts` 에 던지는 함수 둘, `execution.ts` 에 던지는 함수 넷을 RED 커밋에 두고 GREEN 에서 교체.
- **Commit:** 21a81c0, 5cbc690

**2. [Rule 1 - Bug] 테스트 보고서가 TAP 으로 읽히지 않음**
- **Found during:** Task 2 RED 증거 검사
- **Issue:** `toStrictEqual` 로 객체를 비교하면 실패 진단이 여러 줄이 되고, 빈 문자열 `actual:` 은 YAML 진단을 깨서 `gsd_run check tdd-red-evidence` 가 `invalid_record` 로 거부했다.
- **Fix:** 객체 비교를 `JSON.stringify` 문자열 비교로 바꾸고(vote.test.ts 포함), 빈 값은 `"-"` 로 표현했다. 단언 강도는 같다.
- **Files modified:** test/unit/execution.test.ts, test/unit/vote.test.ts
- **Commit:** 5cbc690

**3. [Rule 1 - 회귀 이전] 표 없이 지나온 밤의 day 키 단언 갱신**
- **Found during:** Task 2 GREEN (`--project unit`)
- **Issue:** `view.test.ts` 의 `stateAt("night")` 은 여부 투표 0표로 지나온 밤이라 이제 `day.noExecution` 이 실린다. `day` 키 정확 일치 단언 둘이 실패(계획 파일 목록 밖).
- **Fix:** 두 단언을 `claimLog,n,noExecution,roles,voteLog` 로 옮겼다(정확 일치 유지, 느슨하게 하지 않음). 이는 D-34 의 의도된 결과다.
- **Files modified:** test/unit/view.test.ts
- **Commit:** 6a1b20a

**4. [Rule 2 - 계획 보완] 새 단계 전수 누출 검사 추가**
- 계획의 행동 목록에 없던 4~8명 × 투표 이후 네 단계 × 모든 viewer × 시드 3 전수 검사(token·id·role·allies·서버 전용 키·day 키 허용 목록·voteTarget 수신자)를 `execution.test.ts` 끝에 더했다. 04-02 가 "새 단계 전수 검사는 04-04 몫" 으로 넘긴 것이다. 04-09 의 소켓 전수 검사를 대체하지 않는다.

**Total deviations:** 4 (Rule 3 ×1, Rule 1 ×2, Rule 2 ×1). **Impact:** 범위 변화 없음, 단언은 더 강해졌다.

## Known Stubs

없음.

## Threat Flags

없음. 새 표면은 순수 규칙과 view 필드뿐이며 소켓 메시지·핸들러는 04-07 몫이다. T-04-09(자기·탈락자·없는 자리 지목)·T-04-10(진행 중 선택 누출)·T-04-11(처형자 직업)·T-04-12(noExecution 범위·수명)·T-04-13(공개 순서 조작: 순서는 진입 훅에서 한 번 정해 votes 배열에 실리고 호출 계약 테스트가 인자를 고정)을 단위 테스트로 닫았다. 소켓 수신자 한정과 전수 소켓 검사는 04-07·04-09 에서 이어진다.

## Next Phase Readiness

Ready for 04-05. 04-05 가 변론 메시지 규칙(chat.ts)과 웨이브 1~3 push 를 맡는다. 04-06 은 `execution`·`morning` 마감 훅에 승패 분기(`routeAfter*`)와 `enterEnded` 를 더하며 `tick.ts` 의 ON_DEADLINE 에 `execution` 행을 새로 더한다(이 계획은 그 행을 두지 않았다). 04-07 은 `candidateVote` 메시지·소켓 수신자(본인만)·봇 투표를 더한다. `noExecutionOf` 는 `ended` 를 포함해 night 가 아니면 항상 undefined 다.

## Self-Check: PASSED

- 생성 파일 존재: `shared/game/execution.ts`, `test/unit/execution.test.ts`, `test/helpers/voteState.ts` 확인.
- 커밋 존재: 21a81c0, 069c459, 5cd573c, 5cbc690, 6a1b20a, 7f60a43 모두 HEAD 의 조상.
