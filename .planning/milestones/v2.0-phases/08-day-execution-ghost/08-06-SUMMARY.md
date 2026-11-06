---
phase: 08-day-execution-ghost
plan: "06"
subsystem: day-view-effects
tags: [tdd, pure-module, point-diff, toast-queue, announce-timetable, header-copy]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-02 와이어(DayView points·verdict·candidate·noExecution·voteLog)와 majorityOf, phases.ts EXECUTION_MS
provides:
  - src/game/dayView.ts — DAY_COPY, headerFor, pointsTally, dayEvents, ToastQueue, 토스트·알림 시간 상수
  - 서버 view 두 개의 공개 정보 차이 → 채팅 줄·위 알림 재료·결과 알림·연출(ghostRise) 이벤트
affects: [08-13 화면 문구, 08-15 지목·찬반 화면, 08-16 처형·유령 연출]

actuals:
  tokens: 8900
  tasks: 3
  commits: 6
plan_head_before: 3550b9db2f7aeb69698e2e30ea6dc3f7dc436666
plan_head_after: 315127f80d9ada0a98aeabd0dede7e72514b14f5

tech-stack:
  added: []
  patterns:
    - "roomDiff 선례: 이전 view 가 없거나 reset(epoch 변경)이면 이벤트 없이 정상 상태(state)만 준다"
    - "지연 이벤트는 at(단계 진입 기준 ms)으로 표시하고 화면이 시계로 실행한다 — 모듈은 시각을 읽지 않는다"
    - "ToastQueue 는 시계를 now 인자로만 받아 가짜 시계 없이 결정적으로 시험한다"
    - "RED 커밋에 시험 + 이름만 있는 자리표시자를 함께 두어 불러오기 실패가 아니라 단언 실패로 RED"

key-files:
  created:
    - src/game/dayView.ts
    - test/unit/dayView.test.ts
  modified: []

key-decisions:
  - "위 알림은 합치기 창(400ms)이 닫힌 뒤에 나온다: 창 안의 같은 대상은 한 건으로 합치려면 첫 알림을 창 동안 붙잡아야 하기 때문이다. 대기(꺼내는 것 포함)가 2건 이상이면 0.8초, 1건이면 1.5초"
  - "결과 알림은 한 건이 아니라 announces 배열이다: 처형 단계가 '찬성 n · 반대 m'(0초)과 '처형/처형 없음'(2.0초) 두 알림을 만든다. 각 항목에 at(단계 진입 기준 ms)·ms"
  - "처음 지목으로 최다 득표 한 명이 생기면 vote 줄 뒤에 hot '앞서요' 도 만든다(선두 없음 → 있음도 '바뀜'). 선두 효과가 1표부터 켜지는 UI-SPEC 과 같다"
  - "정상 상태 state 에 candidate·executed(처형 단계에서 찬반이 통과했을 때 변론자)를 더해, 재접속 첫 스냅샷의 유령 상태를 이벤트 없이 상태로 그리게 한다"

requirements-completed: [DAY-04, DAY-05, DAY-06]

coverage:
  - id: D1
    description: "지목 차이: 새 지목·바꿈 vote 줄과 위 알림 재료, 선두·과반 hot 줄(동점이면 없음, 풀렸다 다시 닿으면 다시 만듦), 첫 스냅샷·reset 은 이벤트 없이 상태만"
    verification:
      - kind: unit
        ref: "test/unit/dayView.test.ts — pointsTally·dayEvents 지목 차이 21 tests"
        status: pass
    human_judgment: false
  - id: D2
    description: "ToastQueue: 같은 대상 399/400ms 경계, 이름 3/4명, 바꿈은 단독만, 줄 세우기와 건당 0.8/1.5초, 대기 4건 상한과 건너뛴 수"
    verification:
      - kind: unit
        ref: "test/unit/dayView.test.ts — ToastQueue 12 tests"
        status: pass
    human_judgment: false
  - id: D3
    description: "단계 진입 줄·결과 알림·유령 떠오름 시각, 처형 없음 경로, 개인 값 무관, 역할 단어 0건, 알림 시간표 ≤ EXECUTION_MS, headerFor 단계표"
    verification:
      - kind: unit
        ref: "test/unit/dayView.test.ts — 단계 진입·찬반 결과·공개 정보만·알림 시간표·headerFor 29 tests"
        status: pass
      - kind: command
        ref: "npm run typecheck; npx vitest run --project unit (73 files, 2187 passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "위 알림 합치기·0.8초·대기 4건 시작값과 알림 시각의 체감"
    verification: []
    human_judgment: true
    rationale: "시간값은 UI-SPEC 남은 위험 7 의 시작값이다. 규칙만 고정했고 체감은 화면 배선(08-15·08-16)과 9페이즈 팀 테스트에서 본다"

duration: 8min
completed: 2026-11-02
---

# Phase 8 Plan 6: 낮 처형 화면 연출 순수 모듈 Summary

**서버 view 두 개의 공개 정보 차이에서 지목 vote 줄·선두/과반 hot 줄·위 알림 재료·찬반 결과/처형/처형 없음 알림(지연 시각 포함)을 만드는 순수 모듈과, 8명이 몰려도 밀리지 않는 위 알림 합치기 큐, 단계표 그대로의 머리 문구 `headerFor` 를 가짜 시계 없이 시험 가능하게 고정했다.**

## Accomplishments

- `src/game/dayView.ts` 신규 (순수, 시각·난수·DOM 없음):
  - `DAY_COPY`: UI-SPEC Copywriting Contract 원문(채팅 줄·결과 알림·단계 제목·안내). 마침표·느낌표로 끝나는 문구 없음.
  - `pointsTally(view)`: 득표 수·선두(최다 한 명)·과반 수(`majorityOf` 한 출처)·`sure`(선두가 과반에 닿음). 지목 단계가 아닌 view 의 `points` 는 읽지 않는다.
  - `dayEvents(prev, cur, {reset})`: 첫 스냅샷·reset 이면 이벤트 없이 `state`(득표·선두·과반·변론자·처형된 사람)만. 아니면 지목 차이(vote 줄·"(바꿈)"·선두/과반 hot 줄·위 알림 재료)와 단계 진입 이벤트(낮 시작 "{N}일차"+"낮이 되었습니다", "지목 시작", hot "{이름} 님 {N}표 · 최후 변론", "찬반 시작", 찬반 결과, 처형, 처형 없음 두 경로).
  - `ToastQueue`: 합치기 창 400ms, 이름 3명 뒤 "…", 서로 다른 대상 줄 세우기, 대기 2건 이상이면 건당 0.8초, 대기 4건 상한과 `dropped()`.
  - 시간 상수 `ANNOUNCE_*`·`GHOST_RISE_MS`·`GHOST_FADE_END_MS`. 처형 단계 알림은 `EXECUTION_MS` 안으로 자른다.
  - `headerFor(view)`: 단계 × {산 사람, 변론자, 유령} 표.
- `test/unit/dayView.test.ts` 신규 62 tests. 개인 값(`me.verdictVote`·`endDiscussion`·`voteAgree`)과 `spectate` 를 넣어도 결과가 같음, 모든 단계 전이 출력에 역할 단어("마피아"·"시민"·"경찰"·"의사") 0건을 단언한다(T-08-22).

## TDD Gate Compliance

세 작업 모두 RED(`test(08-06)`) → GREEN(`feat(08-06)`) 순서다. REFACTOR 커밋은 없다.

| 작업 | RED 커밋 | RED 증거(`gsd_run check tdd-red-evidence` = RED_EVIDENCE_OK) | GREEN 커밋 |
| --- | --- | --- | --- |
| 1 지목 차이(트레이서) | `79bbda9` | dayView.test.ts 21개 중 18 실패. 대상 "새 지목은 vote 줄 '민준 → 도윤' …" 가 `lines` 비어 있음으로 실패(기대 `vote 민준 → 도윤`) | `e26aa3c` |
| 2 ToastQueue | `3ba1e82` | 33개 중 10 실패. 대상 "399ms 안의 같은 대상은 '지호·민준 → 도윤' 한 건으로 합친다" 가 `next` null 로 실패 | `9ea35ef` |
| 3 단계 진입·머리 문구 | `41996ea` | 62개 중 16 실패. 대상 "찬반 → 처형(통과): 즉시 '찬성 5 · 반대 2', 2.0초에 …" 가 `lines` 비어 있음으로 실패 | `315127f` |

semanticAssessment: 세 RED 모두 이름만 있는 자리표시자(`dayEvents`·`ToastQueue`·`headerFor` 가 빈 값 반환)를 RED 커밋에 함께 두어, 불러오기 실패가 아니라 계획한 단언에서 실패했다. 자리표시자가 우연히 맞춘 시험(같은 대상 재전송, 역할 단어 0건, 개인 값 무관 등 "없어야 한다" 류)은 RED 에서도 통과했다.

트레이서 게이트: 작업 1 의 `<verify>` 를 다시 돌려 통과를 확인하고(`⚡ Tracer verified end-to-end — expanding`) 확장 작업으로 넘어갔다.

## Task Commits

1. Task 1 RED `79bbda9` → GREEN `e26aa3c`
2. Task 2 RED `3ba1e82` → GREEN `9ea35ef`
3. Task 3 RED `41996ea` → GREEN `315127f`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 시험 비교 문자열에서 따옴표 제거**
- **Found during:** Task 1 RED
- **Issue:** 비교 보조 함수가 `JSON.stringify` 결과(큰따옴표·vitest 가 이스케이프한 작은따옴표)를 실패 진단에 실어, `gsd_run check tdd-red-evidence` 의 TAP YAML 파서가 `Non-TAP data`/`Malformed TAP` 로 INVALID_RED 판정을 냈다.
- **Fix:** `same()` 이 따옴표를 제거한 한 줄 문자열로 비교한다(`flat`). 시험 의미는 같고 실패 보고서가 파싱된다.
- **Files modified:** test/unit/dayView.test.ts
- **Commit:** 79bbda9

**2. [Rule 1 - 계획 형태 보정] 결과 알림은 `announce?` 가 아니라 `announces[]`**
- **Found during:** Task 1 설계 (계획 Task 1 의 반환 형태 `announce?: DayAnnounce` 와 Task 3 의 처형 단계 두 알림이 충돌)
- **Issue:** 처형 단계는 0초 "찬성 n · 반대 m" 과 2.0초 "{이름} 님 처형"/"처형 없음" 두 알림을 지연 시각과 함께 만들어야 한다.
- **Fix:** `DayEvents.announces: DayAnnounce[]`(각 항목 `at`·`ms`). 타입 이름 `DayAnnounce` 는 계획 그대로.

**3. [Rule 1 - 계획 형태 보정] PointToast 에 이름 포함, DayEvents.state 확장**
- **Issue:** 계획 예시 `{to, from}` 만으로는 ToastQueue 가 "지호·민준 → 도윤" 을 만들 수 없다(`push(t, now)` 가 이름 표를 받지 않는다). 첫 스냅샷의 유령 상태도 담을 자리가 필요하다.
- **Fix:** `PointToast = {to, from, toName, fromNames, changed?}`, `DayEvents.state: DayState = PointsTally + candidate? + executed?`.

**4. [Rule 3 - 계획 순서 편차] RED 시점의 자리표시자**
- RED 커밋마다 이름만 있는 자리표시자를 함께 두었다(08-02 선례). 앱 타입 검사는 모든 커밋 시점에서 통과했다.

**Total deviations:** 4 (모두 형태·도구 보정, 범위 확장 없음). **Impact:** 계획의 truths·acceptance 는 그대로 충족.

## Assumptions

- **A1**(계획): 과반이 풀렸다 다시 닿으면 hot "과반" 을 다시 만든다. 선두 줄도 선두가 바뀔 때마다. 시험으로 고정.
- **A2**(계획): 변론 진입 줄의 {N}표는 그날 `voteLog` 줄의 `cand.votes` 에서 변론자를 가리킨 수다. 줄이 없으면 이전 view 의 지목 집계로 대신한다(이 대체는 이 계획이 더한 방어).
- **A3**(계획): 알림 시간은 표시 시간이며 처형 단계 안에서 끝난다(`fitExecution`). 단계 경계에서 잘리는 것은 다음 알림이 바꾸는 화면 몫.
- **A4**(이 계획): 처음 지목 한 표로 선두가 생기는 것도 "선두가 바뀜" 이라 vote 줄 뒤에 hot "앞서요" 를 만든다(UI-SPEC "최다 득표가 한 명"과 같은 기준). 채팅이 번거로우면 화면(08-13)이 첫 표만 거를 수 있도록 줄이 분리돼 있다.
- **A5**(이 계획): 합치기 창이 열려 있는 동안 알림을 붙잡는다 — 모든 위 알림이 최대 400ms 늦게 나온다. 그 대신 "같은 대상 400ms 안 합치기" 가 성립한다.

## Verification

- `npx vitest run test/unit/dayView.test.ts` 62 passed.
- `npm run typecheck` 통과(앱·워커), `npx vitest run --project unit` 73 files / 2187 passed (1 skipped 는 이전부터 있던 것).
- 인수 기준: `export function dayEvents`·`majorityOf`·`TOAST_MERGE_MS = 400`·`TOAST_QUEUE_MAX = 4`·`ANNOUNCE_TALLY_MS = 2000`·`export function headerFor`·`EXECUTION_MS`·"이야기하며 마피아를 찾아요" 존재, `git log --grep="^test\(0?8-06\):"` 3줄.
- 위생: 저장소 위생 검사 이 두 파일에서 0건.

## Known Stubs

None. (RED 커밋의 자리표시자는 같은 작업의 GREEN 커밋이 전부 구현으로 바꿨다. 이 모듈은 화면에 아직 배선되지 않았다 — 배선은 08-13·08-15·08-16 계획 몫이며 스텁이 아니다.)

## Threat Flags

None. (T-08-22 개인 값·spectate 를 넣어도 결과 동일, 출력 전체 역할 단어 0건을 단위 시험으로 확인. T-08-23 합치기·대기 4건·건너뛰기를 `ToastQueue` 시험으로 고정. T-08-SC 패키지 설치 없음.)

## Next Phase Readiness

화면 배선 계획이 `dayEvents(prevView, curView, {reset: epoch 변경})` 를 view 도착 때마다 부르고, `lines` 는 `at` 에 맞춰 채팅 저장소(`kind` "system"|"vote"|"hot", 07-/08-05)에 넣고, `toasts` 는 `ToastQueue.push`, `announces`/`fx` 는 단계 진입 시각 기준 타이머로 실행하면 된다. 위 알림 아이콘은 `point`, 길이는 `next()` 가 준다.

## Self-Check: PASSED

- FOUND: src/game/dayView.ts, test/unit/dayView.test.ts
- FOUND commits: 79bbda9, e26aa3c, 3ba1e82, 9ea35ef, 41996ea, 315127f
- 커밋 수 측정: `git rev-list --count 3550b9d..HEAD` = 6
