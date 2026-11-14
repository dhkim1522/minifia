---
phase: 21-cause-effect-missions
plan: "03"
subsystem: server
tags: [cause-effect, lamp-cut, mafia-hold, house-lit, leak-test, wire, tdd]
status: complete

requires:
  - phase: 21-cause-effect-missions
    provides: "21-01 의 원인 흐름 단계 사슬(저녁 → 밤 → 아침 → 토론)과 21-02 의 가로등 8곳·저녁 배정(errandSpotsOf)"
provides:
  - "shared/game/lamps.ts — withCut(마피아 hold 만 서버 전용 errandCut)·houseLitOf(켠 사람 있음 + 자른 사람 없음, cut 이 이긴다). 등불에서 역할을 읽는 유일한 파일"
  - "actErrand(…, hold) — 받아들인 처리 뒤에 withCut 을 부를 뿐 errand.ts 는 역할을 읽지 않는다"
  - "enterNight 가 원인 흐름 + 맵에 lamps 가 있으면 RoomState.lamps(boolean 8) 를 정하고, enterErrand 가 lamps·errandCut 을 키째 지운다"
  - "와이어: ClientMessage errand.hold(boolean optional, strictObject), DayView.lamps(공개, 등불 i = 집 i 창), 방 DO handleErrand/applyErrand 의 hold 전달"
affects: [21-04, 21-07, 21-08, 21-09]

actuals:
  tokens: 21000
  tasks: 2
  commits: 4

plan_head_before: 6b3aebce2a7bc981e771b28f2244788f53614e6b
plan_head_after: 1c479078db01efadf1797517a0ff994c9a53f250
commits: 4

tech-stack:
  added: []
  patterns:
    - "역할을 읽는 파일 하나: lamps.ts(+ 기존 errandFake.ts). 소스 규약 시험이 errand.ts·enterNight 본문에 .role 이 없고 errand*/lamps* 파일 중 읽는 것이 errandFake.ts·lamps.ts 뿐임을 고정한다"
    - "응답 동일: hold·역할이 applyErrand 의 모양(저장 한 번 + 본인 state 한 프레임, 거절도 본인 state 한 프레임)을 바꾸지 않는다 — cut 은 같은 상태 쓰기에 실린다"
    - "공개 값은 판정 결과만: day.lamps 는 boolean 8개 필드 복사이고 view.ts 는 errandCut 을 읽지 않는다"

key-files:
  created:
    - shared/game/lamps.ts
    - test/unit/lamps.test.ts
    - test/worker/lampLeak.test.ts
  modified:
    - shared/game/errand.ts
    - shared/game/night.ts
    - shared/game/room.ts
    - shared/game/view.ts
    - shared/protocol.ts
    - shared/schemas.ts
    - worker/room.ts
    - test/unit/schemas.test.ts

key-decisions:
  - "A3: 켜짐은 cut 이 이긴다 — houseLitOf 는 한 줄 함수(결정 0088, 계획의 선택 그대로)"
  - "A2: 저녁 동안 남의 켜짐은 방송하지 않고 밤 진입 때 enterNight 가 RoomState.lamps 를 한 번 정한다. view 는 rules.cause 이고 state.lamps 가 있을 때만 day.lamps 를 싣는다"
  - "errandCut 은 enterNight 가 지우지 않고 다음 저녁 enterErrand 가 지운다(계획 그대로) — 서버 전용이라 view 에는 어느 단계에서도 없다"

metrics:
  duration: 약 45분
  completed: 2026-11-14
---

# Phase 21 Plan 03: 심지 자르기와 밤 집 창 불 Summary

원인 흐름 저녁에 산 마피아가 배정 등불에서 같은 단추를 길게 누르면(errand + hold) 서버가 처리(errandDone)와 함께 서버 전용 errandCut 에 기록하고, 밤이 시작되면 등불 8개의 켜짐(켠 사람 있음 + 자른 사람 없음)이 정해져 모든 소켓이 같은 boolean 여덟(`day.lamps`, 등불 i = 집 i 창)을 받는다. 응답 모양은 hold·역할과 무관하고 자른 사실은 어떤 프레임에도 없다.

## Performance

- **Duration:** 약 45분
- **Tasks:** 2 (각각 RED 시험 커밋 + GREEN 구현 커밋)
- **Files modified:** 11 (본 코드 8 — lamps.ts 새 파일 포함, 시험 3 — 새 파일 2 포함)

## Accomplishments

- **Task 1 (순수 규칙):** `lamps.ts` 의 `withCut`(hold 이고 산 마피아이고 원인 흐름일 때만 그 사람의 `errandCut` 에 id 를 더한 새 상태, 아니면 입력 그대로 — 같은 객체)와 `houseLitOf`. `actErrand(state, actorId, posFx, hold = false)` 는 받아들인 처리 뒤에 `withCut` 을 부른다(`errand.ts` 는 역할을 읽지 않는다). `enterNight` 는 원인 흐름이고 맵에 lamps 가 있을 때 `houseLitOf` 로 `RoomState.lamps` 를 정하고, `enterErrand` 는 `lamps` 와 모든 사람의 `errandCut` 을 키째 지운다. 잠금(옛 확장판) 아래에서는 `lamps` 키가 만들어지지 않는다.
- **Task 2 (와이어):** `ClientMessage` 의 `{ t: "errand"; hold?: boolean }`, 스키마 `z.strictObject({ t, hold: z.boolean().optional() })`, `DayView.lamps?: boolean[]`, view.ts 의 day.lamps 게이트(`rules.cause && state.lamps !== undefined`, 필드 복사 `map(lit => lit === true)`), 방 DO `handleErrand(ws, hold)` → `applyErrand(playerId, now, hold)`. 저장·전송 횟수는 그대로(받아들이면 put 한 번 + 본인 `sendViewTo`, 거절이면 본인 `sendViewTo`). 봇 `errandAct` 는 기본값 hold false.

## Task Commits

1. **Task 1 RED:** `fe91e640` test(21-03): 심지 자르기·등불 켜짐 실패 시험
2. **Task 1 GREEN:** `acbe149c` feat(21-03): 심지 자르기와 밤 등불 켜짐 순수 규칙
3. **Task 2 RED:** `ca682b22` test(21-03): 등불 와이어·누설 실패 시험
4. **Task 2 GREEN:** `1c479078` feat(21-03): errand.hold 와 day.lamps 와이어

## TDD Gate Compliance

- **RED 증거 (Task 1):** `npx vitest run test/unit/lamps.test.ts --reporter=tap-flat` → 15 중 not ok 9(houseLitOf cut 우선 2, 마피아 hold errandCut 1, 키 집합 차이 1, 밤 진입 lamps 1, 같은 등불 cut 우선 1, 다음 저녁 청소 1, 소스 규약 2). 실패 메시지는 목표 단언(`expected 'false,false,false' to be 'true,true,false'`, `expected 'lamp3/' to be 'lamp3/lamp3'`, `expected '0/true/' to be '8/true/…'`, `expected 'errandFake.ts' to be 'errandFake.ts,lamps.ts'`)이고 import·준비 오류가 아니다. `withCut`·`houseLitOf` 는 자리 함수(입력 그대로·모두 false)였다. semanticAssessment: 목표 단언 실패가 의도된 이유(구현 부재)와 일치한다. 이미 초록이던 6개는 "hold 없음·시민은 키 없음·잠금 아래 lamps 없음·night.ts 본문 .role 없음" 등 구현 전에도 참이어야 하는 음성 단언이다. `gsd check tdd-red-evidence` 는 따로 돌리지 않았다(21-02 와 같음).
- **RED 증거 (Task 2):** `npx vitest run test/unit/schemas.test.ts test/worker/lampLeak.test.ts --reporter=tap-flat` → not ok 5(schemas 2: `{t:"errand",hold:true}`·`hold:false` 가 거부됨, 워커 3). 워커 시험의 실패는 hold 메시지에 `error error state error` 가 돌아온 것·`day.lamps` 길이 0(`expected '0/true' to be '8/true'`)·밤~토론 프레임에 lamps 가 없음(`expected 0 to be greater than 0`)이다. semanticAssessment: 모두 hold 스키마·day.lamps 부재라는 의도된 이유이고 준비 오류가 아니다.
- RED 커밋이 GREEN 커밋보다 앞서 두 task 모두 `test(21-03)` → `feat(21-03)` 순서가 지켜졌다. REFACTOR 커밋은 없다.

## 시험 결과 (실제 출력)

- Task 1 verify: `npx vitest run test/unit/lamps.test.ts test/unit/lampErrand.test.ts test/unit/errand.test.ts test/unit/errandFake.test.ts test/unit/night.test.ts test/unit/dayFlow.test.ts` → **6 files passed, 146 tests passed**; `npm run typecheck` exit 0.
- `npx vitest run --project unit --project client`(마지막 확인) → **Test Files 237 passed | 1 skipped (238), Tests 8030 passed | 184 skipped (8214)**.
- Task 2 worker: `npx vitest run --project worker test/worker/lampLeak.test.ts test/worker/lampErrand.test.ts test/worker/errandLeak.test.ts test/worker/errand.test.ts test/worker/leak.test.ts test/worker/night.test.ts test/worker/townErrand.test.ts` → **7 files passed, 67 tests passed | 4 skipped**.
- `npx vitest run --project worker`(전체) 두 번: 첫 번째는 **Test Files 1 failed | 59 passed, Tests 3 failed | 632 passed**(실패 파일 이름은 `tail` 에 가려 확인하지 못했다 — 작업 지침이 알린 night.test.ts 5000ms 시간 초과 간헐 실패로 추정하며 이 계획의 시험은 그 실행에서도 단독 실행으로 통과했다). 두 번째는 **Test Files 60 passed | 5 skipped, Tests 635 passed | 78 skipped** 로 전부 통과.
- `npm run typecheck`(tokens:check·placeart:check·wrangler types·tsc app·tsc worker) → exit 0.
- 계약 대조: `grep -c withCut errand.ts` 3, `grep -c houseLitOf night.ts` 3, `grep -c errandCut room.ts` 1, `grep -c hold schemas.ts` 2, `grep -c "lamps?: boolean\[\]" protocol.ts` 1, `grep -v '^\s*//' view.ts | grep -c errandCut` **0**(가드).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 시험 설계] "errand.ts·night.ts 의 주석 아닌 줄에 .role 이 없고" 를 enterNight 본문으로 좁혔다**
- **Found during:** Task 1 RED 작성
- **Issue:** 계획의 소스 규약 단언은 `night.ts` 전체에 `.role` 이 없다고 했지만 `night.ts` 는 처음부터 판정(`confirmedTarget`·`resolveNight` 등)에서 역할을 읽는 파일이다(머리 주석에 이유가 있다). 전체 단언은 현 코드에서도 거짓이다.
- **Fix:** 이 계획이 더한 부분(밤 진입의 등불 켜짐 확정)이 있는 `enterNight` 함수 본문에만 `.role` 이 없다고 단언하고, `errand.ts` 전체·`errand*`/`lamps*` 파일 중 역할을 읽는 것이 `errandFake.ts`·`lamps.ts` 뿐임은 그대로 단언했다. 약화가 아니라 원래 의도(등불 켜짐 계산이 역할을 읽지 않는다)를 정확한 범위로 옮긴 것이다.
- **Files modified:** test/unit/lamps.test.ts
- **Commit:** fe91e640

**2. [Rule 1 - 시험 불안정] 시험 판의 무작위 등불 겹침**
- **Found during:** Task 2 GREEN 확인
- **Issue:** 워커 시험 "밤 진입" 에서 시민이 켠 등불이 마피아가 두 번째로 자른 등불과 같으면(무작위 배정) cut 이 이겨 꺼져 시험이 간헐 실패했다(6회 중 1회 재현). 구현 오류가 아니라 시험 기대값이 규칙(cut 우선)과 어긋난 것이다.
- **Fix:** 시민이 켜는 등불을 마피아가 hold 로 자르는 두 등불과 겹치지 않게 고르고, 같은 등불 cut 우선은 단위 시험(lamps.test)이 따로 증명한다. 고친 뒤 같은 파일 6회 연속 통과.
- **Files modified:** test/worker/lampLeak.test.ts
- **Commit:** 1c479078

**3. [작은 구현 선택] hold 판정은 응답 모양을 바꾸지 않으므로 워커 시험은 구조(키 경로)로 비교한다**
- 마피아·시민의 프레임을 그대로 비교하면 `me.role` 등 역할별 공개 필드가 다르다. 시험은 `.view.me.errand`·`.view.day` 아래 키 경로 집합과 프레임 종류·개수를 마피아·시민·hold 유무·거절 사이에서 비교한다(`shapeOf`).
- **Files modified:** test/worker/lampLeak.test.ts

## Auth Gates

없음.

## Known Stubs

없음. 클라이언트는 아직 `errand` 에 `hold` 를 싣지 않고 `day.lamps` 를 그리지 않는다 — 길게 누르기 입력과 3D 창·가로등·밤 문패 창 점은 21-07·21-08·21-09 가 맡는다. 서버 규칙·와이어는 이 계획에서 완성이다.

## Threat Flags

없음 — 새 네트워크 면은 기존 errand 메시지의 optional boolean 하나와 공개 boolean 배열 하나이고 계획의 위협 모형이 이미 다룬다. T-21-07(응답 동일)은 워커 시험이 마피아·시민·hold 유무·거절의 응답 구조·프레임 수·다른 소켓 0프레임으로, T-21-08(day.lamps)은 모든 소켓(유령 포함) 같은 boolean 8개·자른 등불 false·안 켠 등불 false 와 view.ts 의 errandCut 부재 grep 0 으로, T-21-09(저녁 방송)는 저녁 중 다른 소켓 프레임 0 과 저녁 view 의 lamps 키 부재로, T-21-10(스키마)은 schemas 시험으로 완화했다. T-21-11 은 기존 ERRAND_MIN_GAP_MS 간격 그대로다.

## 위생·기타

- 소리 낱말(소리·sound·audio·효과음)은 바뀐 서버 코드 diff 에서 0건이다. 사용자 위생 git grep 스크립트는 21-01·21-02 와 같이 이 PC 에서 찾아 실행하지 않았다.
- 작업 트리는 계획 시작 때 깨끗했고 마지막에도 `git status` 가 깨끗하다.

## Self-Check: PASSED

- FOUND: shared/game/lamps.ts(withCut·houseLitOf), test/unit/lamps.test.ts, test/worker/lampLeak.test.ts
- FOUND commits: fe91e640, acbe149c, ca682b22, 1c479078 (모두 HEAD 의 조상)
