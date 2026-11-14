---
phase: 21-cause-effect-missions
plan: "01"
subsystem: server
tags: [cause-effect, day-flow, ruleset, tick, phases, header, tdd, tracer]
status: complete

requires:
  - phase: 19-game-modes
    provides: GameMode·modeOf·rulesetOf(판 종류), 규칙으로 갈리는 nextPhaseOf·hooksOf
  - phase: 20-map-expansion
    provides: 마을 맵·MODE_MAPS 시험 잠금 방식(lockModeMaps·openTown)
provides:
  - "Ruleset.cause(확장판 true, 기본 마피아 false) + CAUSE_MODES(시험이 잠그는 판 종류 표, 제품 값 [extended]) — 잠금 상태별로 같은 판의 cause 만 다른 얼린 규칙 객체 둘"
  - "phases.ts — nextPhaseOf 원인 분기(roleReveal→errand, errand→night, morning→discussion, execution→errand)·afterDayOf(rules)·MORNING_SCENE_MS(30초)"
  - "tick.ts — 훅 표를 규칙 객체별 지연 WeakMap(hooksFor)으로, 확장판 errand 진입 = 일차 +1 → enterErrand(가짜 장소 없음), night 진입이 규칙을 받음"
  - "처형 없는 낮(nomination·runoff·showdown)의 다음 단계가 afterDayOf(규칙) 하나, noExecutionOf 가 원인 흐름에서는 저녁(errand)에서 지난 낮(일차 − 1) 줄을 읽음"
  - "morningMsOf — 현장 없는 밤 0(같은 tick 안에서 토론까지), 현장 있는 밤 발표 길이 + 현장 30초"
  - "공개 증거 끄기(morning.trace·seen·day.evidence 없음, 저녁 errandLast 안 쌓음), enterNight 가 심부름 키를 토론까지 유지"
  - "headerFor 제목: 확장판 errand '등불 켜기'·morning '현장 조사'(DAY_COPY.causeTitles), RoomScreen PHASE_ANNOUNCE.errand 같은 분기"
  - "시험 도우미 lockCause·openCause·SHIPPED_CAUSE_MODES, test/client/setup.ts, 세 setup 이 잠근 채 시작"
  - "docs/decisions/0088-v3-cause-effect-day.md — 이 페이즈의 위임 선택 19줄"
affects: [21-02, 21-03, 21-04, 21-05, 21-06, 21-07, 21-13, 21-14]

actuals:
  tokens: 19500
  tasks: 2
  commits: 4

plan_head_before: 7b4f85452392eaff8e354aa593057053cc532fa5
plan_head_after: 9a4b1d3a97009a73cf93a7d5721147d39d445aaa
commits: 4

tech-stack:
  added: []
  patterns:
    - "규칙 플래그 + 시험 잠금 표: 제품 값은 바꿀 수 있는 모듈 표(CAUSE_MODES)이고 시험이 setup 에서 잠근다 — MODE_MAPS 와 같은 방식, 훅 표는 규칙 객체 키로 지연 계산해 잠금을 언제 바꿔도 맞다"
    - "처형 없는 낮의 다음 단계 리터럴을 afterDayOf(rules) 하나로 모은다 — 마감 훅 세 모듈(nomination·runoff·showdown)이 같은 함수를 부른다"
    - "길이 0 단계는 tick 루프가 같은 호출에서 마감 훅까지 지나게 한다 — 승패 판정은 morning 마감 훅 그대로"

key-files:
  created:
    - test/client/setup.ts
    - test/unit/dayFlow.test.ts
    - test/worker/causeFlow.test.ts
    - docs/decisions/0088-v3-cause-effect-day.md
  modified:
    - shared/game/ruleset.ts
    - shared/game/phases.ts
    - shared/game/tick.ts
    - shared/game/nomination.ts
    - shared/game/runoff.ts
    - shared/game/showdown.ts
    - shared/game/execution.ts
    - shared/game/discussion.ts
    - shared/game/night.ts
    - shared/game/errand.ts
    - src/game/dayView.ts
    - src/screens/RoomScreen.tsx
    - test/helpers/playable.ts
    - test/unit/setup.ts
    - test/worker/setup.ts
    - vitest.config.ts
    - test/unit/ruleset.test.ts
    - test/unit/dayView.test.ts
    - test/unit/discussion.test.ts
    - test/worker/leak.test.ts

key-decisions:
  - "확장판 하루는 roleReveal → errand → night → morning → discussion … execution(또는 처형 없음) → errand, 일차는 errand 진입에서 +1 (결정 0088-1)"
  - "시험 잠금은 CAUSE_MODES 표 + 규칙 객체별 훅 표(WeakMap) — 단위·워커·화면 setup 이 잠근 채 시작, 새 흐름 시험만 openCause() (결정 0088-2)"
  - "현장 없는 밤은 morning 길이 0 으로 건너뛰고 현장이 있으면 발표 + 30초 (결정 0088-3)"
  - "공개 증거·가짜 장소를 끄고 심부름 키를 토론까지 유지 (결정 0088-4·5·6)"

metrics:
  duration: 약 30분
  completed: 2026-11-14
---

# Phase 21 Plan 01: 원인 흐름 뼈대 Summary

확장판 하루를 `Ruleset.cause` 하나로 저녁(등불 켜기) → 밤 → 아침(현장 조사) → 토론으로 재배선했다: 단계 표 분기·일차·처형 없는 낮·아침 길이·공개 증거·심부름 키·헤더 제목까지 서버와 헤더 뼈대가 서고, 시험 잠금 아래에서 옛 확장판 순서와 기본 마피아 사슬은 그대로다.

## Performance

- **Duration:** 약 30분
- **Tasks:** 2 (Task 1 트레이서, Task 2 나머지 분기·결정 0088)
- **Files modified:** 24 (본 코드 12, 시험 12 — 새 파일 4 포함)

## Accomplishments

- 트레이서: 소켓이 받은 state 프레임 수열이 `assigning → roleReveal → errand → night`(첫 저녁 1일차)이고 `dayAnnounce` 가 한 번도 없다. 아무도 안 고른 밤은 `night → discussion` 이다(D-17). 잠금 아래는 옛 순서(`roleReveal → dayAnnounce`).
- 처형 없는 낮(투표 동률·0표·결선·결전 무승부)과 처형(execution) 뒤의 다음 단계가 모두 저녁(errand)이고 일차가 하루에 한 번씩 오른다(voteLog n 1·2, nightLog 같은 날 밤).
- 아침: 피해자 있는 밤은 발표 길이 + 30초(의사가 막은 밤은 기본 길이 + 30초), 공개 흔적·마지막 목격 없음, 마피아 가짜 장소 없음.
- 3곳을 끝낸 산 사람의 `view.me.record` 가 밤·아침을 지나 토론에 있고 밤·아침 view 에는 심부름 키가 없다(T-21-01).
- 결정 0088: 이 페이즈 전체의 위임 선택 19줄(시험 잠금·가로등 id·cut 우선·창문 지점 기준·건너뛰기 과반 등).

## Task Commits

1. **Task 1 RED:** `c5b57cb6` test(21-01): 원인 흐름 트레이서 실패 시험
2. **Task 1 GREEN:** `261e43fd` feat(21-01): 원인 흐름 트레이서 — cause 플래그·단계 분기·일차·헤더
3. **Task 2 RED:** `15349282` test(21-01): 원인 흐름 분기 실패 시험
4. **Task 2 GREEN:** `9a4b1d3a` feat(21-01): 처형 없는 낮·아침 길이·공개 증거·심부름 키 분기와 결정 0088

**RED 증거 (Task 1):** `npx vitest run test/unit/ruleset.test.ts test/unit/dayView.test.ts test/worker/causeFlow.test.ts --reporter=tap-flat` → 128 중 not ok 5(통과 123). 목표 시험 `causeFlow > 역할 확인 → 저녁(errand) → 밤으로 돌고 …` 이 `actual "assigning → roleReveal → dayAnnounce → errand → discussion → nomination → night"` / `expected "assigning → roleReveal → errand → night"` 단언으로 실패. `gsd check tdd-red-evidence` → `RED_EVIDENCE_OK`(target_test_failed). semanticAssessment: 목표 시험이 실행되어 계획된 단계 수열 단언에서 실패했고 setup·import·fixture 오류가 아니다(처음 한 번은 참가 방송이 늦게 닿아 수열 앞에 lobby 가 끼는 시험 도우미 결함을 고쳐 다시 돌린 뒤의 증거다).

**RED 증거 (Task 2):** `npx vitest run test/unit/dayFlow.test.ts --reporter=tap-flat` → 15 중 not ok 8(통과 7 — Task 1 이 이미 세운 처형 → 저녁·밤 → 토론·옛 순서 보호 시험). 목표 시험 `피해자가 있는 밤 뒤의 morning 은 발표 길이 + 현장 30초 …` 이 `expected 12000 to be 37000` 단언으로 실패. `gsd check tdd-red-evidence` → `RED_EVIDENCE_OK`. semanticAssessment: 계획된 길이 단언에서 실패했고 나머지 not ok 도 사슬·키·길이 단언 실패다(예외·준비 오류 아님 — 처음에 ended 단계에서 던지던 걷기 도우미는 단언으로 실패하도록 고친 뒤의 증거다).

## 시험 결과 (실제 출력)

- `npx vitest run test/unit test/client`: **Test Files 235 passed | 1 skipped, Tests 7968 passed | 184 skipped**.
- `npm run typecheck`: `error TS` 없음.
- 검증 명령(Task 1): `ruleset·gameMode·phases·tick·dayView·causeFlow·modeBasic` → 7 파일 통과(233 passed | 4 skipped).
- `npx vitest run test/worker` (전체): 실행마다 night.test.ts 의 시간 제한 5000ms 초과 2~3건이 난다(`관전 > 다음 밤 …`, `탈락자 거부 …`), 한 번은 chat·leak 에서도 났다. **이 계획 이전 커밋(7b4f8545)을 따로 체크아웃해 같은 명령으로 돌려도 night.test.ts 의 같은 3건이 난다** — 병렬 부하에서만 나는 기존 시간 초과이고 `night.test.ts`·`chat.test.ts`·`leak.test.ts` 를 단독으로 돌리면 모두 통과한다(night 19 passed, chat+leak 55 passed). 이 계획이 만든 회귀가 아니다.

## 계약 대조

- `grep -v '^\s*//' shared/game/ruleset.ts | grep -c cause` = 7(≥4), `CAUSE_MODES` 4(≥2), `rules.cause` phases 3(≥1), `MORNING_SCENE_MS` 정의 1, `openCause·lockCause` export 2, `setupFiles` 3, 등불 켜기 2(≥1), `afterDayOf` nomination 3·runoff 4·showdown 4(합 11 ≥ 6), 세 파일의 `next: "night"` 0, `MORNING_SCENE_MS` discussion 3, `cause` night 3, 결정 0088 줄 19(≥12).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 막힘] 현장 없는 밤의 아침 길이 0 을 Task 1 로 당겼다**
- **Found during:** Task 1 RED 설계
- **Issue:** 트레이서의 D-17 시험(아무도 안 고른 밤 → 다음 프레임이 discussion)은 morning 길이 0 없이는 초록이 될 수 없는데, 계획은 아침 길이를 Task 2 에 두었다.
- **Fix:** Task 1 에서 `morningMsOf` 의 "cause 이고 피해자도 구출도 없으면 0" 한 줄을, Task 2 에서 현장 있는 아침의 +30초·흔적 구간 제외를 더했다.
- **Files modified:** shared/game/discussion.ts
- **Commit:** 261e43fd, 9a4b1d3a

**2. [Rule 1 - 기존 시험 갱신] 새 플래그가 만든 기대값 변경 세 곳**
- **test/unit/ruleset.test.ts:** 규칙 값 표가 아홉 값(cause)으로, 내보내는 이름 목록 단언이 `Ruleset,CAUSE_MODES,rulesetOf,modeOf,politicsOn` 으로 바뀌었다(계획이 `CAUSE_MODES` export 를 정했으므로 "대문자 상수 없음" 시험의 범위를 이 표 하나로 명시). 약화가 아니라 기대값 갱신이다.
- **test/worker/leak.test.ts:** `allOn: Ruleset` 리터럴에 `cause: true` 를 더했다(필수 필드, 타입 검사).
- **test/unit/discussion.test.ts:** "MORNING_MAX_MS 로 자른다" 시험은 `vi.resetModules()` 뒤 규칙 모듈을 새로 읽어 setup 잠금이 사라진다 — 현장 시간이 붙지 않는 `mode: "basic"` 상태로 상한을 확인하도록 바꿨다(상한 단언은 그대로).
- **Commit:** 261e43fd, 9a4b1d3a

**3. [작은 구현 선택] enterNight 의 규칙은 감싸기로 넘긴다**
- `hooksOf` 의 `night: (s) => enterNight(s, rules)` — 훅의 세 번째 자리 인자(진입 시각)가 규칙 자리로 들어가지 않게(`morning` 선례). `enterNight` 의 규칙 인자 기본값은 방 상태에서 얻는다.

## Auth Gates

없음.

## Known Stubs

없음 — 이 계획은 서버 흐름과 헤더 제목만이고 화면 단계의 실제 등불·현장 연출은 21-02 이후다.

## Threat Flags

없음 — 새 네트워크 면·인증 경로·스키마 변경이 없다. 위협 T-21-01(심부름 키 노출 확대)은 dayFlow 시험이 night·morning view 에 `me.record`·`me.errand` 가 없음을 단언해 완화했고, T-21-02(아침 길이 0 루프)는 한 tick 결과 단계 단언으로 확인했다.

## 위생·기타

- 사용자 규칙 파일의 위생 git grep 은 이 PC 에서 찾아 실행하지 않았다(건너뜀). 대신 바뀐 코드 diff 에서 소리 개념 낱말(소리·sound·audio·효과음)과 옛 전역 규칙 상수 이름 검색을 직접 돌려 0건을 확인했다(후자는 ruleset.test.ts 의 전수 검사도 통과).
- 진행 중이던 확장판 방(배포 시점)은 다음 마감부터 새 순서를 따른다 — 결정 0088-19 에 기록.
- STATE.md 의 `M` 표시는 이 계획 시작 전부터 있던 작업 트리 변경이다.

## Self-Check: PASSED

- FOUND: shared/game/ruleset.ts, test/helpers/playable.ts, test/client/setup.ts, test/unit/dayFlow.test.ts, test/worker/causeFlow.test.ts, docs/decisions/0088-v3-cause-effect-day.md
- FOUND commits: c5b57cb6, 261e43fd, 15349282, 9a4b1d3a (모두 HEAD 의 조상)
