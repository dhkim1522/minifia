---
phase: 04-execution-verdict
plan: 33
subsystem: verdict-e2e-flows-back-half
tags: [e2e, flows.mjs, noexec, result-c, result-m, spec4, P5, P6, P7, P8, P9, rule-1, tally-copy, VOTE-01, VOTE-02, VOTE-03, VOTE-04, COMM-03, CONN-02, END-01, END-02]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-31 의 readVerdict·조작·관찰·표본 도우미, 04-32 의 기존 흐름 적응·vote5, 04-29·04-30 의 P1~P10 순수 검사, 04-15 봇 투표 고정 훅, 04-16~04-26 화면"
provides:
  - "noexec 흐름(5명, 방장 경찰): 처형 무효 카드 P7 — 회색 테두리·세 문구·1.8초 안 사라짐·밤 시작 문구가 카드 도착 1.5초 뒤·카드 위 밤 조작 클릭 통과·day.noExecution.reason notMajority"
  - "result-c 흐름(5명, 방장 마피아): 후보 본인 변론 P5(패널 236·칩 6개·`보냈어요 · 저 아니에요`) → 탈락 viewer 처형 P6 → 시민 팀 승리 결과 P8 → [처음으로] 로 입구"
  - "result-m 흐름(4명, 방장 마피아): 처형 → 밤 지목(N2) → 아침 G → 마피아 팀 승리 결과 P8(진홍 번짐 true) → [처음으로] 로 입구"
  - "spec4 확장: 탈락한 방장의 처형 여부 투표 화면 P9 + G"
  - "로컬 전체 E2E(10흐름 × 3폭 = 30작업) E2E OK, 253초"
  - "집계 줄 `모두 냈어요 · 마감까지 바꿀 수 있어요` (360 폭 한 줄) — 실제 화면 결함 Rule 1 수정"
affects: [04-34 (남은 화면 정리), 04-35 (배포본 E2E·smoke·verify-work)]

actuals:
  tokens: 7600
  tasks: 3
  commits: 2
plan_head_before: f1c5308fa84cfae60b3f37039a9edadfc828c5e2
plan_head_after: 8931d16ffbcf88a081c6b7064d0ab6132f3984ff

tech-stack:
  added: []
  patterns:
    - "공통 준비 verdictRoom / 공통 끝 tableChecksOf / 결과 상태 resultState: 새 흐름 셋이 방 만들기·봇 고정·D7·D9·T1·결과 검사·나가기를 한 곳에서 쓴다 (voteFlow 는 04-32 그대로 둠)"
    - "무효 카드 표본: 관찰자 + 80ms 표본기를 skipTo(night) 전에 시작, 카드 위 클릭은 클릭 완료 시각이 카드 사라진 시각보다 앞일 때만 인정, rebaseSeries 로 환산"
    - "결과 화면은 data-stage=done 이 된 뒤 읽고, 승자·요약 행 수는 서버가 정한 view.result 에서 구한다(T-04-74)"

key-files:
  created: []
  modified:
    - scripts/e2e/flows.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/run.mjs
    - src/game/verdict.ts
    - test/unit/verdict.test.ts
    - test/client/execVote.test.tsx
    - .planning/phases/04-execution-verdict/04-UI-SPEC.md
    - .planning/phases/04-execution-verdict/deferred-items.md

key-decisions:
  - "P9 의 `후광 0` 은 관전자에게 틀린 기준이었다: 관전자는 모든 직업을 보므로 마피아 자리의 진홍 후광(동료 표시)이 투표 장면에서도 남는다(D-33, UI-SPEC 12.4·549행). 흰·앰버 후광은 여전히 0 으로 둔다. 기준을 낮춘 것이 아니라 UI-SPEC 과 모순된 검사를 UI-SPEC 에 맞춘 것이고, 단위 시험(진홍 허용·흰/앰버 실패·살아 있는 viewer 는 진홍도 실패)과 UI-SPEC P9 행에 적었다"
  - "집계 줄 0명 남은 문구는 `모두 투표했어요` → `모두 냈어요`: 360 폭에서 앞 문구와 합쳐 15px 넘쳐 말줄임표로 잘렸다. 한 줄을 지키려고 줄였다(줄바꿈하면 마지막 사람이 던지는 순간 버튼이 20px 밀린다)"
  - "run.mjs 준비 실패 재시도 2 → 4번: 「살아 있는 방장」 흐름의 첫 밤 방장 탈락 무작위가 열 흐름 전체 실행을 자주 깼다(관찰: 전체 5회 중 3회가 citizen4 때문에 실패). 검사 기준과 무관"
  - "result-m 의 아침 이후는 skipTo(ended) 대신 waitPhaseIn(['ended']): 아침 마감이 승패를 정하는 분기 단계라 서버 시간표를 기다린다"

requirements-completed: []  # VOTE-01·02·03·04, COMM-03, CONN-02, END-01·02 는 04-35 의 배포본 검증 뒤에 체크한다(HANDOFF·사용자 지시)

coverage:
  - id: C1
    description: "처형 무효 카드가 실제 브라우저·세 폭에서 P7 을 통과한다 — 회색·문구·1.8초 안 사라짐·밤 문구 순서·터치 통과·이유 notMajority (VOTE-01, D-34, P-3)"
    requirement: "VOTE-01"
    verification:
      - kind: e2e
        ref: "로컬 npm run e2e -- --url http://localhost:5173 --only noexec: 세 폭 35/35, 전체 실행에서도 35/35 × 3"
        status: pass
    human_judgment: false
  - id: C2
    description: "후보 본인 변론·탈락 viewer 처형·시민 팀 승리 결과 화면이 세 폭에서 P5·P6·P8 을 통과하고 [처음으로] 가 입구로 돌아간다 (VOTE-03, COMM-03, END-01, END-02)"
    requirement: "END-01"
    verification:
      - kind: e2e
        ref: "--only result-c: 세 폭 32/32, 전체 실행에서도 32/32 × 3"
        status: pass
    human_judgment: false
  - id: C3
    description: "마피아 팀 승리 결과 화면(진홍 번짐 true 경로)이 세 폭에서 P8 을 통과한다 (END-01, END-02)"
    requirement: "END-02"
    verification:
      - kind: e2e
        ref: "--only result-m: 세 폭 39/39, 전체 실행에서도 39/39 × 3 (resultChecks 가 mafiaWin 이면 glow true 를 요구)"
        status: pass
    human_judgment: false
  - id: C4
    description: "탈락한 방장의 투표 화면이 버튼 0·`관전 중` 알약·집계 줄 보임·흰/앰버 후광 0 이다 (D-35)"
    requirement: "VOTE-02"
    verification:
      - kind: e2e
        ref: "--only spec4: 세 폭 52/52 (exec-vote P9·G 통과), 전체 실행에서도 52/52 × 3"
        status: pass
    human_judgment: false
  - id: C5
    description: "로컬 전체 E2E 와 단위 시험·타입 검사 유지"
    requirement: "VOTE-01"
    verification:
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 (최종 실행): 10흐름 × 3폭 30작업 모두 통과, E2E OK, 253초"
        status: pass
      - kind: unit
        ref: "npm test (102 파일 2777건) · node --test scripts/e2e/lib.test.mjs scripts/tsc-scoped.test.mjs (152건) · npm run typecheck (토큰 검사 + app/worker tsc)"
        status: pass
    human_judgment: false
---

# Phase 4 Plan 33: noexec·result-c·result-m 흐름과 spec4 투표 화면, 로컬 전체 E2E Summary

**처형 무효 카드·후보 본인 변론·시민 팀 승리와 마피아 팀 승리 결과 화면·탈락 방장의 투표 화면을 실제 브라우저 세 폭으로 검사하는 흐름 셋과 spec4 확장을 만들고, 열 흐름 전체 로컬 E2E 를 초록으로 만들었다. 그 과정에서 실제 화면 결함 하나(집계 줄 말줄임)를 TDD 로 고쳤고, UI-SPEC 과 모순이던 P9 기준 하나를 UI-SPEC 에 맞췄다.**

## 한 일

**Task 1 — noexec·spec4 확장** (`8931d16`)
- `noexec`: 5명, 방장 경찰, 봇 `모두 반대`. 여부 투표에서 방장도 `반대` → `armVerdictWatch` + 80ms `sampleSeries` 를 `skipTo(night)` 전에 시작 → 카드 위에서 `tapSeat` 으로 밤 지목(`me.pick` 반영 확인) → `rebaseSeries` 로 `voidCardChecks`(P7). `day.noExecution.reason === "notMajority"` 도 단언. 카드가 사라진 뒤에는 `stageChecks`(B1·H1)·`dayState`(G·D1~D8·T2)와 D7·D9·T1.
- `spec4`: 탈락한 방장이 된 뒤 `discussion` 다음에 `skipTo(execVote)` → 인트로 카드가 사라지길 기다려 `readVerdict` → `voteChecks(spectator: true)`(P9) + `checkState`(G). 기존 밤 블록은 그대로.

**Task 2 — result-c** (`8931d16`)
- 5명, 방장 마피아, 봇 `모두 찬성`·후보 `방장`. 방장은 `찬성`, 후보 선택에서 방장 아닌 한 명을 고른다 → 봇 4표가 방장에게 가 방장이 후보. 변론: `defenseChecks(isCandidate: true)`(패널 236·칩 6개)·`colorRuleChecks`(방장이 마피아라 화면 전체 진홍 허용)·G·B1·H1, 칩 `저 아니에요` 를 눌러 안내 줄이 `보냈어요 · 저 아니에요` 로 바뀜. 처형: `executionChecks(viewerAlive: false)`. `ended`: `data-stage="done"` 을 기다린 뒤 `checkState`(G)·`resultChecks`(winner `citizenWin`, n 5, 요약 행 수는 `view.result.summary` 에서 계산)·`leaveFromResult`.

**Task 3 — result-m, FLOWS 순서, 전체 E2E, deferred-items** (`8931d16`)
- 4명, 방장 마피아, 봇 `모두 찬성`·후보 `방장 아닌 사람`. 처형 뒤 생존 3(방장 포함)을 확인하고 밤에 방장이 비동료 한 명을 지목(N1·N4·N5 정적 검사 + N2 선택 후광; 4명판 마피아는 동료가 없어 N3 는 돌리지 않음) → `skipTo(morning)` → 아침 `checkState`(G) → `waitPhaseIn(ended)` → `resultChecks`(winner `mafiaWin`, 진홍 번짐 true) → `leaveFromResult`.
- `FLOWS` 순서: lobby, police5, citizen4, mafia8, doctor5, spec4, vote5, noexec, result-c, result-m.
- `deferred-items.md` 를 「모두 해결」 한 단락 + 남은 무작위 + E2E 로 못 본 것으로 바꿨다(「낮을 건너」 문구 삭제, grep 0).

## 로컬 전체 E2E 결과 (dev 서버, `--url http://localhost:5173`, 최종 실행)

**30작업(10흐름 × 3폭) 모두 통과, `E2E OK`, 253초**(한도 900초).

| 흐름 | 360x640 | 390x664 | 430x932 |
|---|---|---|---|
| lobby | 23/23 | 23/23 | 23/23 |
| police5 | 123/123 | 123/123 | 123/123 |
| citizen4 | 115/115 | 115/115 | 115/115 |
| mafia8 | 120/120 | 120/120 | 120/120 |
| doctor5 | 119/119 | 119/119 | 119/119 |
| spec4 | 52/52 | 52/52 | 52/52 |
| vote5 | 108/108 | 108/108 | 93/93 (처형 대상이 마피아라 `ended`) |
| noexec | 35/35 | 35/35 | 35/35 |
| result-c | 32/32 | 32/32 | 32/32 |
| result-m | 39/39 | 39/39 | 39/39 |

### 정직한 실행 이력 (이 표는 최종 실행만이다)

최종 초록에 이르기까지 전체 실행을 다섯 번 했다.
1. 1회: 29/30 — `citizen4` 430 이 `S4`(첫 밤에 방장 탈락, 재시도 한 번까지 연속).
2. 2회: 28/30 — `citizen4` 360·390 같은 이유.
3. (`run.mjs` 재시도 2 → 3) 3회: 29/30 — `citizen4` 430 같은 이유.
4. (재시도 3 → 4) 4회: 29/30 — **`vote5` 360 `exec-vote` G2 `화면 밖` — 실제 화면 결함**(아래 편차 2). 이 실행에서 `citizen4` 는 통과.
5. (결함 수정 후) 5회: 30/30 `E2E OK`.

`citizen4` 첫 밤 방장 탈락은 04-32 가 적은 기존 무작위인데, 관찰된 빈도가 4명판 1/3 에서 예상한 것보다 높았다(시도마다 약 1/2). 원인은 확인하지 않았다(범위 밖, 서버 `botNightTarget` 은 비마피아에게 균등). 재시도를 4번으로 늘려 대응했고 `deferred-items.md` 에 남겼다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 검사 기준이 UI-SPEC 과 모순] P9 가 관전자의 마피아 동료 진홍 후광을 거부함**
- **Found during:** Task 1 (`spec4` 투표 화면 첫 실행, 세 폭 모두 `후광 1개 ≠ 0`)
- **Issue:** `voteChecks(spectator)` 는 `haloImgs` 가 비어 있어야 통과했다. 그러나 탈락한 방장은 `spectate` 로 모든 직업을 받고 마피아 봇 자리에는 동료 표시(진홍 후광·마름모)가 투표 장면에서도 남는다(D-33, UI-SPEC 212·541·549행; 화면 코드 `DayScene.isAllySeat`). 후광 1개는 그 마피아 봇이었다(DOM 으로 확인: `mf-figure--halo-crimson`, `aria-label="…마피아, 주장 기록 보기"`). 같은 실행에서 나온 `찬성|반대|투표` 글자 1개는 아직 떠 있던 인트로 카드 `처형 투표`(1.8초)로 스크립트 쪽 문제였다.
- **Fix (TDD):** 단위 시험을 먼저 썼다(관전자 진홍 후광 통과 · 흰/앰버 실패 · 진홍+흰 섞이면 실패 · 살아 있는 viewer 는 진홍도 실패) → 빨강 확인 → `voteChecks` 가 `spectator` 일 때만 진홍을 제외. 흰·앰버 후광 0 과 익명 글자 0 은 그대로. UI-SPEC P9 행에 한 줄. 인트로 카드는 `.mf-vintro` 가 사라질 때까지 기다린 뒤 읽는다(스크립트).
- **Files modified:** scripts/e2e/lib.mjs, scripts/e2e/lib.test.mjs, scripts/e2e/flows.mjs, .planning/phases/04-execution-verdict/04-UI-SPEC.md
- **Commit:** 8931d16 (UI-SPEC 행은 11d9965)

**2. [Rule 1 - Bug] 처형 여부 투표 집계 줄이 360 폭에서 잘림**
- **Found during:** Task 3 전체 실행 4회차 (`vote5/exec-vote` 360x640 G2 `화면 밖: span "모두 투표했어요 · 마감까지 바꿀 수" (113.3~361.7)`)
- **Issue:** 봇이 모두 던져 남은 수가 0 이 되면 뒤 문구 `모두 투표했어요 · 마감까지 바꿀 수 있어요`(247px, 14px 글꼴 측정)가 앞 문구 `찬성 N · 반대 M`(굵게 88.5px) + 간격 8 과 합쳐 360 폭 패널 안 폭 328 을 넘는다. `.mf-execvote__tally` 가 `overflow hidden + ellipsis` 라 사용자는 말줄임표로 잘린 문장을 본다. 봇 투표 시각에 따라 일부 실행에서만 나타났다(12번 연속 통과하던 vote5 가 그 예).
- **Fix (TDD):** `execTallyText` 시험 두 개의 기대 문구를 먼저 바꿔 빨강 확인 → `모두 냈어요 · 마감까지 바꿀 수 있어요`(220.9px, 360 폭 여유 약 10px). 줄바꿈 대신 줄임을 택했다(마지막 사람이 던지는 순간 [찬성]/[반대] 버튼이 20px 밀리는 것을 피함). `execVote.test.tsx` 와 UI-SPEC 7.2 도 맞췄다. `vote5` 는 이제 읽기 전에 `모두 냈어요` 가 뜰 때까지(최대 6초) 기다려 최악의 폭을 결정적으로 본다. **양성 대조**: 옛 문구로 되돌려 같은 vote5 를 360 으로 돌리면 G2 가 결정적으로 실패(`113.3~361.7`)하고 새 문구에서는 통과한다.
- **Files modified:** src/game/verdict.ts, test/unit/verdict.test.ts, test/client/execVote.test.tsx, .planning/phases/04-execution-verdict/04-UI-SPEC.md, scripts/e2e/flows.mjs
- **Commit:** 11d9965 (화면·시험·UI-SPEC), 8931d16 (E2E 대기)

**3. [Rule 3 - 전체 실행을 막음] `citizen4` 첫 밤 방장 탈락 무작위로 전체 E2E 가 자주 실패**
- **Found during:** Task 3 전체 실행 1~3회차
- **Fix:** `run.mjs` 준비 실패 재시도 2 → 4번(`MAX_ATTEMPTS`). 검사 항목·기준은 건드리지 않았다. 새 방에서 다시 도는 것뿐이라 준비 실패(SetupError)만 늘어난 횟수의 영향을 받는다.
- **Files modified:** scripts/e2e/run.mjs
- **Commit:** 8931d16

### 계획과 달라진 점 (편차 아님)

- Task 1~3 이 `flows.mjs` 한 파일이라 한 커밋(`8931d16`)이다.
- `result-m` 은 `nightActions` 를 쓰지 않았다: 그 함수의 마피아 분기는 N3(동료 탭 안 됨)가 동료 ≥ 1 을 요구하는데 4명판 마피아는 동료가 없다. 정적 검사(N1·N4·N5)는 `nightStaticChecks` 를 그대로 쓰고 지목(N2)만 직접 했다.
- `result-m` 의 마지막 전환은 `skipTo(ended)` 대신 `waitPhaseIn(["ended"])` — 아침 마감 훅이 승패를 정하는 분기 단계라 넘기기 목표로 쓰지 않았다.
- `result-c` 는 후보 선택 구간에서 `candidateChecks` 를 돌리지 않았다(계획에 없음, vote5 가 봄).
- `noexec` 는 밤에서 `turnChecks` 를 돌리지 않았다: 카드 위 클릭으로 지목 후광(흰)이 남아 있어 「차례 없음」 검사와 의미가 겹치지 않고, vote5 의 밤이 이미 본다. `dayState`(G·D1~D8·T2)와 B1·H1·D7·D9·T1 은 돌렸다.

## 이 계획으로 검증된 것과 아직 보지 못한 것

**검증됨(로컬 dev, Chrome headless, 세 폭):** P7(처형 무효 카드 전 항목), P5 후보 본인(236·칩 6개·`보냈어요`), P6 탈락 viewer, P8 두 가지 승자(시민 승 `glow` false·마피아 승 `glow` true), P9, [처음으로] → 입구, 서버가 정한 `view.result.winner`·`summary` 가 화면과 일치.

**아직 E2E 로 못 본 것:**
- 모션 줄이기(`prefers-reduced-motion`)의 결과·공개 연출 — 에뮬레이션을 켜서 돌리는 흐름이 없다.
- 관전자(후보가 아닌 탈락자)가 보는 변론 화면·공개 단계의 칩/화살표. spec4 는 여부 투표 화면까지, result-c 는 후보 본인 변론과 처형당한 viewer 의 처형·결과까지.
- 진홍 번짐의 시각 품질(존재 여부만 `glow` 로 봄), 결과 화면의 사진 비교.
- 배포본, 실기기, iOS(`backdrop-filter`, 진동) — 04-35 이후. 배포하지 않았다(D-26).
- 요약 행 수 기대값은 서버 `summary` 에서 계산해 비교했다. 여러 일차에 걸친 판(요약 행이 여럿)은 result-m(1일차 처형 + 밤)까지이고 더 긴 판은 없다.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크·인증·파일 경로 없음. T-04-74(결정성 훅에 기댄 거짓 통과)는 result 흐름이 `view.result.winner`·`summary` 를 서버 값으로 단언하고, `noexec` 는 서버가 정한 `reason` 을 단언해 mitigate 했다. 새 패키지 설치 없음(T-04-SC).

## Self-Check: PASSED

- 파일: scripts/e2e/flows.mjs, scripts/e2e/lib.mjs, scripts/e2e/lib.test.mjs, scripts/e2e/run.mjs, src/game/verdict.ts, test/unit/verdict.test.ts, test/client/execVote.test.tsx, .planning/phases/04-execution-verdict/04-UI-SPEC.md, .planning/phases/04-execution-verdict/deferred-items.md — 존재 확인
- 커밋: 11d9965, 8931d16 — `HEAD` 의 조상 확인
