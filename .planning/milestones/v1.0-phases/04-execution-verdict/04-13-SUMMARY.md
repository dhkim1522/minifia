---
phase: 04-execution-verdict
plan: 13
subsystem: screen-wave-pure-module
tags: [verdict, reveal-timeline, clinch, geometry, halo-cap, copy, pure-module, tdd]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-12 서버 웨이브 마무리(공유 타입 VoteLogEntry·SummaryRow·CandidateVoteLine, 배포 없음)"
provides:
  - "src/game/verdict.ts: 연출 상수 한 곳(UI-SPEC 13.1), 공개 시간표 revealPlan·revealStateAt, 확정 판정 clinchedTarget, 기하 candidateCenter·chipAnchor·arrowEndpoints, 후광 상한 capHalos, 문구 정본 VERDICT_TEXT 와 문구 함수"
  - "test/unit/verdict.test.ts: 85개 단위 시험(시간표 0~8명·폰 폭 4종×패널 2종 기하·문구 글자 일치)"
affects: [04-14 이후 화면 계획 전부(투표·공개·변론·처형·결과 부품이 이 파일만 import)]

actuals:
  tokens: 11200
  tasks: 2
  commits: 4
plan_head_before: 6984a2323069b9c29015340f6a01c550ce0143e9
plan_head_after: 5d6e911bd1ff631e973fc63aae2f8460868c177b

tech-stack:
  added: []
  patterns:
    - "DOM·현재 시각·난수 없는 순수 모듈: 시각은 인자(서버 시각), 같은 now 면 모든 폰이 같은 상태"
    - "좌표 공식은 dayTableGeometry·daySeatLayout 한 곳, verdict.ts 는 그 결과(x, y, scale)만 입력으로 쓴다"
    - "화면 부품은 문자열을 직접 쓰지 않고 VERDICT_TEXT·문구 함수를 읽는다 (UI-SPEC 문서와 글자 일치를 시험이 읽어 확인)"

key-files:
  created:
    - src/game/verdict.ts
    - test/unit/verdict.test.ts
  modified: []

key-decisions:
  - "revealStateAt 에 current(가장 최근 시작한 단계)를 더했다: 화살표가 사라진 틈(슬롯 500 중 400ms 이후)에도 문구가 직전 화살표를 유지하게 한다. 첫 화살표 전에는 revealCaption 이 null"
  - "capHalos 는 한 자리 하나 규칙을 일반화했다: 같은 자리의 요청 여럿은 가장 높은 우선순위 하나만 남긴다(흰+진홍 → 흰)"
  - "chipAnchor 는 가로를 [0, 장면 폭 − 칩 폭] 으로 민다. 4~8명 × 폰 4종에서는 밀림이 일어나지 않음을 시험이 확인한다"
  - "상한 상수는 dayTable 의 HALO_MAX_SIMULTANEOUS 를 그대로 쓴다(값 두 곳 방지)"

requirements-completed: []
requirements-pure-logic-done: [VOTE-01, VOTE-02, VOTE-03, VOTE-04, END-01, END-02]  # 시간표·문구 계산 몫만. 화면이 걸린 요구사항이라 REQUIREMENTS 체크박스는 열어 둔다

coverage:
  - id: D1
    description: "revealPlan 슬롯 = floor(min(500, 3600/n)), 0~8명 모두 마지막 슬롯 끝이 단계 시작 + 3800ms 이하, 단계 시각(시작·닿음 +280·사라짐 +120), 입력 순서 유지"
    requirement: "VOTE-03"
    verification:
      - kind: automated
        ref: "npx vitest run --project unit test/unit/verdict.test.ts (revealPlan 블록)"
        status: pass
    human_judgment: false
  - id: D2
    description: "revealStateAt 가 같은 서버 시각이면 같은 칩 수·팝·선두·확정 후보를 돌려주고 중간 합류도 지금 시각의 상태, clinchedTarget 판정(c1 > c2 + 남은 표), 확정 사건"
    requirement: "VOTE-03"
    verification:
      - kind: automated
        ref: "test/unit/verdict.test.ts (revealStateAt·clinchedTarget 블록)"
        status: pass
    human_judgment: false
  - id: D3
    description: "후보 위치·칩·화살표 기하가 폰 폭 4종 × 패널 157/236 에서 장면 안, 시안 RA2 와 일치"
    requirement: "VOTE-02"
    verification:
      - kind: automated
        ref: "test/unit/verdict.test.ts (candidateCenter·chipAnchor·arrowEndpoints 블록)"
        status: pass
    human_judgment: false
  - id: D4
    description: "capHalos 가 한 화면 최대 3개를 흰 > 앰버 > 진홍으로 남기고 흰은 항상 남긴다"
    requirement: "VOTE-03"
    verification:
      - kind: automated
        ref: "test/unit/verdict.test.ts (capHalos 블록)"
        status: pass
    human_judgment: false
  - id: D5
    description: "새 문구가 VERDICT_TEXT 와 문구 함수 한 곳에 있고 UI-SPEC 7.2 와 글자까지 같다. 닉네임은 평문으로만 이어 붙인다(T-04-40)"
    requirement: "END-02"
    verification:
      - kind: automated
        ref: "test/unit/verdict.test.ts (VERDICT_TEXT·문구 함수·T-04-40 블록, UI-SPEC 문서 대조 포함)"
        status: pass
    human_judgment: false
  - id: D6
    description: "전체 게이트: npm test, tsc 두 설정, 범위 타입 검사"
    requirement: "END-01"
    verification:
      - kind: automated
        ref: "npm test (88 파일 2242 테스트 통과), npx tsc -p tsconfig.app.json --noEmit 0, npx tsc -p tsconfig.worker.json --noEmit 0, node scripts/tsc-scoped.mjs tsconfig.app.json '^(src/game|test/unit)/verdict' OK"
        status: pass
    human_judgment: false
---

# Phase 4 Plan 13: 판결 연출 순수 모듈 Summary

**화면 웨이브의 첫 계획으로, 시간표·확정 판정·기하·후광 상한·문구를 DOM 없는 순수 모듈 `src/game/verdict.ts` 한 곳에 세우고 85개 단위 시험으로 고정했다. 이후 모든 화면 계획이 같은 수치와 같은 문구를 읽는다.**

## 한 일

TDD 로 두 작업을 RED → GREEN 순서로 커밋했다(작업마다 RED 1, GREEN 1).

### Task 1: 상수·공개 시간표·확정 판정·기하·후광 상한 (RED 97b8b4f → GREEN f327c0a)

- 상수: UI-SPEC 13.1 값 그대로 36개(`EXEC_INTRO_MS` … `RESULT_REDUCED_FADE_MS`), 줄마다 근거 주석. 연출 수치(어둡게 45%·흐림 3px 등)는 이 파일 한 곳에서만 고친다(D-38).
- `revealPlan(votes, startMs)`: 슬롯 `floor(min(500, 3600/n))`(n=8 → 450, n≤7 → 500, n=0 → 단계 없음). 단계 k 의 시작 = `startMs + 200 + k×슬롯`, 닿음 +280, 사라짐 끝 +120. 투표 순서는 입력 배열 그대로, 입력은 바꾸지 않는다. 확정 사건(`clinch`)과 최종 결과 종류(`leader`·`tie`·`none`)를 plan 이 미리 계산한다.
- `revealStateAt(plan, now)`: 칩 수·화살표 하나(선형 진행, 사라지는 중 불투명도)·팝 대상·선두(동률은 null, P-14)·확정 후보·끝 상태. 같은 `now` 면 어느 폰에서나 같은 결과이고 중간 합류도 지금 시각의 상태다.
- `clinchedTarget(counts, remaining)`: `c1 > c2 + remaining` 일 때만 1위.
- `candidateCenter`: x = 장면 폭/2, 발 y = `min(cy+80, sceneH−34)`, 배율 1.7, 이름표 위 = 발 y + 8. 390 폭·높이 387.8 에서 발 y 290. 폰 폭 4종 × 패널 157/236 여덟 장면 모두에서 이름표 아래끝 ≤ 장면 높이 − 4.
- `chipAnchor`·`arrowEndpoints`: `dayTableGeometry`·`daySeatLayout` 결과(x, y, scale)만 쓴다. 4~8명 × 8장면에서 칩이 [0, 장면 폭] 안, 위 ≥ 4.
- `capHalos`: 흰 > 앰버 > 진홍, 상한 3(`HALO_MAX_SIMULTANEOUS`), 낮은 순위부터·같은 순위는 자리 번호가 큰 쪽부터 끈다, 흰은 항상 남는다.

### Task 2: 문구 정본 (RED 69890a0 → GREEN 5d6e911)

- `VERDICT_TEXT`: UI-SPEC 7.2 의 고정 문구 전부(하단 제목·안내·관전 알약·카드 제목·결과 화면·기록 카드)와 단계 안내 고정 문구 세 개. 시험이 UI-SPEC 문서를 읽어 모든 값이 문서에 글자까지 그대로 있음을 확인한다.
- 문구 함수: `execTallyText`, `revealCaption`·`revealResultLine`, `noExecutionText`·`noExecutionPrefix`, `winnerText`·`endedAnnounce`, `summaryLines`, `endedSubtitle`, `defenseStatus`·`defenseDisconnected`·`defenseInstruction`·`defenseSent`·`defenseAnnounce`, `candidateSeatLabel`. 이름을 못 찾으면 예외 없이 `알 수 없는 사람`(`UNKNOWN_NAME`). 닉네임은 평문으로만 이어 붙인다(T-04-40).
- `eliminationText.ts` 의 `executionTitle` 은 다시 만들지 않았다.

## 시험 결과

- `npx vitest run --project unit test/unit/verdict.test.ts`: 85 통과.
- `npm test`: 88 파일 2242 통과(이 계획 전 87 파일 2157).
- `npx tsc -p tsconfig.app.json --noEmit` 0, `npx tsc -p tsconfig.worker.json --noEmit` 0, 범위 검사 OK.
- 인수 기준 grep: 함수 7개·상수 4개·순수성 0 / 함수 6개·`VERDICT_TEXT` 1·`처형이 끝났어요` 1·`곧 밤이 시작돼요` 2.

## Deviations from Plan

None - plan executed exactly as written. 아래는 계획이 열어 둔 부분의 해석이다.

- **시안 RA2 "6px 안"**: 계획의 식(시작 = 몸 중심에서 32, 끝 = 대상 몸 중심에서 26 앞)으로 계산하면 (100.7, 309.4) → (178.7, 211.9) 다. 시안 값 (98.9, 306.2) → (174.4, 207) 과 각 축 차이가 최대 4.9 로 6 안이다(유클리드 거리로는 끝점이 6.5). 시험은 축별 6 미만으로 고정했다. 시안 좌표가 반올림·다른 몸 중심 가정으로 나온 값으로 보이고, 식은 계획 그대로 두었다.
- 계획에 없는 보조 필드를 더했다: `RevealState.current`(문구 유지용), `RevealPlan.finalLeader`·`finalLeaderVotes`(끝 문구용). 화면 계획이 `revealCaption` 을 쓰기 위한 최소 입력이다.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크·인증·파일 접근 표면 없음. T-04-40(평문 이어 붙이기)·T-04-41(9표 이상·중복 자리 입력, 길이 한정·n=0 분기)은 시험으로 고정했다.

## 다음 계획이 알아둘 점

- `revealStateAt` 의 `arrow.progress` 는 선형이다. `ease-out` 은 화면이 입힌다.
- 확정(`clinched`) 순간의 진동·두근 키프레임 시작은 화면이 `RevealState.clinched` 가 null 에서 값으로 바뀌는 것(또는 `plan.clinch.atMs`)을 보고 건다.
- 화살표 사이 틈(슬롯 500 중 사라짐 이후)에는 `arrow` 가 null 이고 `current` 는 직전 단계라 `revealCaption` 이 직전 문구를 유지한다.

## Self-Check: PASSED

- `src/game/verdict.ts`·`test/unit/verdict.test.ts` 존재 확인.
- 커밋 97b8b4f·f327c0a·69890a0·5d6e911 이 HEAD 의 조상.
- 배포 없음(D-26). 관련 없는 변경 파일(`.planning/milestone.lock`, `.planning/state.json`, `Claude outputs/`)은 커밋하지 않았다.
