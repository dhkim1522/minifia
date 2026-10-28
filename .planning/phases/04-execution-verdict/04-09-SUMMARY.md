---
phase: 04-execution-verdict
plan: 09
subsystem: view-leak-sweep
tags: [leak-test, buildView, anonymity, differential, workerd, tdd, execution-vote, candidate-vote, ended-result]

requires:
  - phase: 04-execution-verdict
    provides: "04-03 투표 규칙, 04-04 voteState 도우미, 04-06 buildView 새 필드, 04-07 소켓 도우미·종료"
provides:
  - "test/unit/view.test.ts: 열네 단계 허용 키·받는 사람 규칙 전수(phaseKeyViolations), 여부 투표·후보 선택 익명 차분(4~8명 × 시드 3), 처형자 직업 비공개, 처형 무효 이유, ended result 동일성"
  - "test/worker/leak.test.ts: 처형·처형 무효·종료를 지나는 6명 한 판의 모든 실제 프레임 검사, SERVER_ONLY_KEYS 확장, ended 전용 허용 경로"
affects: [04-12, 화면 계획(결정 0036 계약을 지키는 회귀망)]

actuals:
  tokens: 14000
  tasks: 2
  commits: 2
plan_head_before: 4bd56550a95c98a80a183720fc53d87d75a6335c
plan_head_after: edd7551123246805aa94ae279debda2c931a7c7d
commits: 2

tech-stack:
  added: []
  patterns:
    - "분기 단계(후보 선택 이후)와 ended 는 실제 투표·tick 으로 만든다 — 표 없이 마감만 따라가면 닿지 못하고 끝없는 루프가 된다(stateAt 에 횟수 상한)"
    - "익명 차분: 집계가 같고 개인 배치만 다른 두 상태에서 제3자(안 던진 생존자·탈락 관전자) view JSON 이 같음 + 던진 본인은 받음 + 배치가 실제로 다름을 함께 단언"
    - "서버 전용 키 금지는 키 이름, view 와 이름이 겹치는 winner·execution 은 경로·단계로 검사"

key-files:
  created: []
  modified:
    - test/unit/view.test.ts
    - test/worker/leak.test.ts

key-decisions:
  - "ended 단계에서만 result.seats[].job 이 역할 단어 허용 경로에 더해진다(unit·worker 모두). ended 이전 프레임의 기존 허용 집합은 그대로"
  - "journalViolations 의 died 키 검사에서 result.* 경로는 뺀다 — 요약 밤 줄의 died 는 ended 에서 모두에게 같은 공개 정보다"

requirements-completed: []
requirements-server-rules-done: [VOTE-01, VOTE-02, VOTE-04, END-02]  # 비공개 경계의 서버 쪽 증명만. 화면이 걸린 요구사항이라 REQUIREMENTS 체크박스는 열어 둔다

coverage:
  - id: D1
    description: "열네 단계 모든 view 의 최상위·me·day 키가 허용 목록 안이고, day 는 열한 단계(새 다섯 + ended)에만 있으며, execTally=execVote, voteAgree·voteTarget=본인·그 단계·생존, candidate=공개·변론·처형, execution=처형(seat·phrase), noExecution=처형 무효 밤(reason 하나), result=ended 에만 있다 (4~8명 × 시드 3 × 모든 viewer)"
    requirement: "VOTE-04"
    verification:
      - kind: unit
        ref: "test/unit/view.test.ts#buildView 전수 누출 검사 / 열네 단계 허용 키 전수"
        status: pass
    human_judgment: false
  - id: D2
    description: "여부 투표 개인 배치만 다르고 집계가 같은 두 상태에서 안 던진 생존 viewer·탈락 관전 viewer 의 view JSON 이 같고, 진행 중 후보 선택은 남의 선택만 다른 세 상태에서 제3자 view 가 같다. 마감 뒤에는 execVote·candidateVote 키가 어떤 플레이어에도 없고 voteLog exec 키는 no·passed·yes"
    requirement: "VOTE-01"
    verification:
      - kind: unit
        ref: "test/unit/view.test.ts#buildView 여부 투표 익명 차분 / 후보 선택 진행 중 비공개 차분"
        status: pass
    human_judgment: false
  - id: D3
    description: "처형 발표·그 뒤 밤·아침의 살아 있는 viewer 에게 역할 단어는 허용 경로에만 있고(처형자 직업 포함), result 는 처형 단계에서 승패가 이미 정해져도 ended 전에는 없다"
    requirement: "END-02"
    verification:
      - kind: unit
        ref: "test/unit/view.test.ts#buildView 처형자 직업 비공개 / 열네 단계 허용 키 전수 (result 는 ended 전 어느 단계에도 없다)"
        status: pass
    human_judgment: false
  - id: D4
    description: "실제 workerd 6명 한 판(1일차 여부 통과 → 후보 → 공개 → 변론 → 처형 → 의사가 지킨 밤 → 2일차 처형 무효 밤 → 3일차 마지막 마피아 처형 → 종료)의 모든 프레임: voteAgree·voteTarget 은 본인 경로·본인이 던진 값뿐, 집계는 모든 소켓이 같고, 진행 중 후보 선택은 투표자 소켓 밖에 프레임이 없고(탈락 관전자 포함), 공개 구간 votes 가 모든 소켓에 같고, 서버 전용 키 부재, result 는 ended 프레임에만, noExecution 은 2일차 밤에만, ended result 가 모든 소켓에 같고 요약에 1일차 의사가 지킨 밤과 2일차 불통과가 있다"
    requirement: "VOTE-02"
    verification:
      - kind: integration
        ref: "test/worker/leak.test.ts#6명 한 판: 처형·처형 무효·종료 전수 프레임 누출 검사"
        status: pass
    human_judgment: false

duration: 약 25분
completed: 2026-10-28
status: complete
---

# Phase 4 Plan 09: 열네 단계 view 전수와 처형·종료 한 판 프레임 누출 검사 Summary

**열네 단계 view 의 허용 키·받는 사람 규칙과 여부 투표·후보 선택 익명 차분을 4~8명 × 시드 3 전수로, 처형·처형 무효·종료를 지나는 6명 한 판의 모든 실제 소켓 프레임을 workerd 로 고정했고, 각 누출 단언이 의도적 변이에 실패함을 확인했다.**

## 진행 기록

Task 1 — 테스트 aef3657 / 변이 실패 증거 3건(아래) / `npx vitest run test/unit/view.test.ts` 62 통과(신규 11), tsc app·worker 0 / 남은 태스크: Task 2.
Task 2 — 테스트 edd7551 / 변이 실패 증거 2건(아래) / worker leak 2 통과, `npm test` 87 파일 2157 통과, tsc app·worker 0 / 남은 태스크 없음. (태스크별 체크포인트 커밋은 한 세션에서 연달아 끝나 따로 남기지 않았다.)

## Accomplishments

- **test/unit/view.test.ts**
  - `PHASES` 14 단계(게임 진행 순서), `REVEALING_PHASES` 12 단계. `stateAt` 은 candidateVote 이후를 `stateWithVerdict`, `ended` 를 `endedState` 로 만든다 — 실제 여부 투표·후보 투표·tick 으로 승패가 날 때까지 날을 반복하고 횟수 상한(10일)을 둔다. 닿지 못하는 단계를 마감만으로 기다리면 끝없이 도는 `while` 이 되므로 `stateAt` 의 루프에도 상한(60)을 넣었다.
  - `richStateAt`: execVote·candidateVote 는 일부만 던진 상태, 공개 이후는 시드 홀짝으로 시민/마피아 후보, `ended` 는 시드 홀짝으로 두 팀의 승리를 번갈아 만든다.
  - `phaseKeyViolations`(단계별 허용 키·받는 사람 규칙 한 곳)를 기존 전수 누출 검사에 연결: 4~8명 × 14 단계 × 모든 viewer × 시드 3 = 3 × 14 × 30 view.
  - 신규 describe: 열네 단계 허용 키(day 존재·ended result 동일성·처형 단계 result 부재·후보 없는 공개 구간), 처형 무효 이유(notMajority·noVotes·tie 와 처형이 이뤄진 날 밤에는 없음), 여부 투표 익명 차분(투표자 2·3명, 안 던진 생존자 + 탈락 관전자), 후보 선택 진행 중 비공개 차분(없음·A·B 세 상태), 처형자 직업 비공개(처형 발표·밤·아침, 시민/마피아 후보).
  - `roleValueLeaks` 는 `ended` 일 때만 `result.seats[].job` 을 허용 경로로 더하고, 일지 검사의 `died` 키 규칙에서 `result.*` 를 뺐다. 아침 문구 상한은 `MORNING_PHRASE_COUNT` 로 바꿨다(하드코딩 8 제거).
- **test/worker/leak.test.ts**
  - `SERVER_ONLY_KEYS` 에 `execVote`·`candidateVote`·`verdict`·`nightLog`·`lastExecPhrase` 추가(기존 6명 두 밤 시나리오도 이 목록으로 돈다), `ROLE_PATH_ENDED`(`.view.result.seats[].job`)는 ended 프레임에서만 허용. 기존 시나리오의 문구 상한 8 을 `MORNING_PHRASE_COUNT` 로 바꿨다. 기존 단언은 느슨하게 하지 않았다.
  - 새 `it`(60초 제한 안에서 약 0.9초): 마피아 A 처형 → 의사가 지킨 밤 → 2일차 불통과(notMajority) 밤 → 3일차 마피아 B 처형 → `citizenWin`. 여부 표는 두 번에 나눠 던져 중간에 모든 소켓(탈락 관전자 포함)의 집계가 같고 안 던진 소켓에 `voteAgree` 가 없음을 보고, 후보 선택은 첫 표 직후 투표자 본인만 `[state:candidateVote]` 이고 나머지(1일차 전원, 3일차 탈락 관전자 포함)는 `[]` 임을 본다. 모든 프레임에서 토큰·FORBIDDEN_KEYS·players[] 다섯 키·서버 전용 키·역할 단어 경로를 검사하고, 받을 사람이 실제로 받았는지(voteAgree·voteTarget·noExecution·result·execution 을 여섯 소켓 모두) 센다.

## TDD 기록

구현은 앞 계획에서 끝났으므로 새 단언은 처음부터 통과했다(계획의 재량 결정). 대신 각 묶음마다 로컬 변이(커밋하지 않음, 원본은 복사본으로 복구하고 `git diff --stat HEAD -- shared worker src` 가 비어 있음을 확인)로 실패할 수 있음을 확인했다.

**Task 1 변이**
- ① buildView 가 `voteAgree` 를 남의 `execVote` 값으로 채움 → 2개 실패: `expected '4/1/execVote/seat2: me.voteAgree valu…' to be ''` (전수), `expected '4/1/k2/seat2: third-party view differ…' to be ''` (익명 차분).
- ② buildView 가 `voteTarget` 을 남의 `candidateVote` 값으로 채움 → 2개 실패: `expected '4/1/candidateVote/seat1: me.voteTarge…' to be ''` (전수), `expected '4/1/seat2: third-party view changed b…' to be ''` (비공개 차분).
- ③ result 를 `execution` 단계에도 실음 → 3개 실패: `expected '4/1/execution/seat0: result presence …' to be ''`, `expected '4/1/seat0: result in execution; 4/1/s…' to be ''`, `expected '4/1/citizen/execution/seat0: result.s…' to be ''`.

**Task 2 변이**
- ① `applyCandidateVote` 를 `persistAndBroadcast` 로 바꿈(전원 방송) → 실패: `AssertionError: expected '[state:candidateVote]' to be '[]'` (투표자가 아닌 소켓이 프레임을 받음, T-04-32).
- ② `enterExecution` 이 `execution` 에 직업을 싣고 buildView 가 `state.execution` 을 펼쳐 복사 → 실패: `AssertionError: expected '4 job,phrase,seat' to be '4 phrase,seat'`. (현재 buildView 는 필드별 복사라 enterExecution 변이만으로는 와이어에 닿지 않는다 — 이 구조가 한 겹 더 방어함을 확인한 셈이다. 직업이 실렸다면 역할 단어 경로 검사도 `.view.day.execution.job` 에서 잡는다.)

진짜 누출은 나오지 않아 `fix(04-09)` 커밋은 없다.

## Verification

| 명령 | 결과 |
|---|---|
| `npx vitest run test/unit/view.test.ts` | 62 passed (기준선 51) |
| `npx vitest run --project worker test/worker/leak.test.ts` | 2 passed |
| `npm test` | 87 파일 2157 passed, 실패 0 |
| `npx tsc -p tsconfig.app.json --noEmit` / `npx tsc -p tsconfig.worker.json --noEmit` | 종료 코드 0 / 0 |
| `git diff --stat HEAD -- shared worker src` | 비어 있음(변이 복구 확인) |

수용 기준 그렙: `"candidateVoteReveal"` view.test.ts 13(기준선 0), `ended` 30(기준선 0), `phrase ?? 0) <= 8` 0, `MORNING_PHRASE_COUNT` view.test.ts 3 / leak.test.ts 3, `lastExecPhrase` leak.test.ts 1, `result.seats` leak.test.ts 2. 배포하지 않았다(D-26).

## 계획과 달라진 점·알아 둘 것

- **view.test.ts 의 `stateAt` 이 분기 단계를 직접 만든다.** 계획이 짚은 Pitfall 12 대로 표 없이는 candidateVote 이후에 닿지 못해, 이 단계들은 `voteState` 도우미(`stateWithVerdict`)와 새 `endedState` 로 만든다. `stateAt` 의 마감 따라가기 루프에는 횟수 상한을 넣어 승패가 나는 판에서 끝없이 돌지 않게 했다.
- **태스크별 `docs(04-09): progress checkpoint` 커밋은 남기지 않았다.** 한 세션에서 두 태스크가 연달아 끝났고 이 SUMMARY 의 진행 기록이 같은 정보를 담는다.
- **요약 밤 줄의 died 키**: ended 의 `result.summary[].night.died` 는 일지 검사(마피아 view 밖에 died 키 금지)와 겹쳐, 일지 검사에서 `result.*` 경로를 뺐다. 결과는 ended 에서 모두에게 같은 공개 정보다(D-17).
- `endedState` 는 밤 행동 없이 반복하므로 요약 밤 줄은 단언하지 않는다. 의사가 지킨 밤 요약은 worker 시나리오에서 `{target: X, died: false}` 로 고정했다(D-27).

## Deviations from Plan

None - plan executed exactly as written (변이 실패 확인이 계획대로 로컬에서만 이뤄졌고, 위 "알아 둘 것" 은 계획 범위 안의 구현 선택이다).

## Auth gates

없음.

## Known Stubs

없음.

## Threat Flags

없음 — 테스트 파일만 바꿨고 새 네트워크 입구·인증 경로·신뢰 경계 변경이 없다. 위협 T-04-30(여부 표 익명)·T-04-31(ended 전 직업·결과·밤 기록)·T-04-32(후보 선택 타이밍)는 unit 차분·worker 프레임 검사와 변이 실패 확인으로 완화 증거를 갖췄다.

## Self-Check: PASSED

- 파일: test/unit/view.test.ts, test/worker/leak.test.ts 존재.
- 커밋: aef3657, edd7551 모두 HEAD 의 조상.
