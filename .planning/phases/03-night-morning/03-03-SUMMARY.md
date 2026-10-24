---
phase: 03-night-morning
plan: 03
subsystem: game-core
tags: [tdd, tracer, night, morning, pick, resolve, recipients, randomness]
status: complete

requires:
  - phase: 03-night-morning/03-01
    provides: night·morning 단계, tick 의 RandInt·ON_ENTER 표, 밤 상태 필드(타입), MORNING_PHRASE_COUNT·InvestigationRecord·MorningView
provides:
  - pickTarget(state, actorId, target) — 밤 행동 한 종류 메시지의 검증(단계 → 행위자 → 역할 → 대상 → 마피아 자신·동료 → 같은 값), NightError (shared/game/night.ts)
  - enterNight(state) — nightPick·morning·nextNightSeq 키를 지우는 진입 훅
  - resolveNight(state, randInt)·enterMorning(state, randInt) — 규칙표 전 행을 한 번에 판정해 새 상태로 적용(탈락·경찰 기록·morning·lastPhrase, 모든 nightPick 제거)
  - pickRecipientIds(state, actorId)·nightChatRecipientIds(state) — 행위자 쪽(마피아는 생존 마피아 전원)+탈락자, 밤 채팅은 생존 마피아+탈락자
  - ON_ENTER 의 night·morning 두 행 (shared/game/tick.ts)
affects: [03-04, 03-05, 03-07, 03-09]

tech-stack:
  added: []
  patterns:
    - "판정은 입력(상태, randInt) → 결과의 순수 함수(resolveNight)로 분리하고 enterMorning 이 한 번의 새 상태로 적용한다. 난수는 필요할 때만 정해진 순서로 부른다(동률 → 문구, 인자 0 호출 없음)"
    - "키는 구조 분해로 뺀다(undefined 를 남기지 않는다) — enterNight·enterMorning 모두 nightPick·morning·nextNightSeq 를 키째 지운다"
    - "테스트의 실패 출력을 한 줄·비어 있지 않은 값으로 맞춘다 — spy 호출 기록은 [2,8] 처럼 대괄호로 감싸 빈 값이 TAP YAML 을 깨지 않게 한다"

key-files:
  created:
    - shared/game/night.ts
    - test/unit/night.test.ts
  modified:
    - shared/game/tick.ts

key-decisions:
  - "판정 규칙표(결정 0020 에 03-09 가 기록): 마피아는 고른 사람의 표만 센다(A2), 동률은 seat 오름차순 목록에서 randInt, 의사 보호=지목이면 morning {}(지목 없음과 구별 불가), 같은 밤 행동은 모두 동시 해결(A1: 지목되는 경찰의 조사·의사의 보호도 적용)"
  - "pickTarget 의 거부 코드는 한 규칙이다: 밤이 아니면 누구든 WRONG_PHASE, 밤에 방에 없거나 탈락한 행위자는 BAD_MESSAGE, 그다음 역할·대상. 쿨다운은 없다(연결당 속도 제한이 이미 있다)"
  - "pickRecipientIds 는 행위자 쪽(마피아면 생존 마피아 전원, 아니면 본인)에 탈락자(관전자, 결정 0021)를 더한다. nightChatRecipientIds 는 살아 있는 마피아와 탈락자 — 살아 있는 비마피아는 어느 쪽에도 들지 않는다"

requirements-completed: []

duration: 약 25분
completed: 2026-10-25

coverage:
  - id: C1
    description: "마피아 지목이 밤 마감(tick)에 탈락과 아침 결과(탈락 seat·문구 번호)로 바뀌고, 아무도 안 고른 밤은 morning {} 으로 무사하며 randInt 를 부르지 않는다. 밤 진입은 선택·지난 아침·밤 채팅 번호를 지운다"
    requirement: "NIGHT-01, NIGHT-06"
    verification:
      - kind: unit
        ref: "test/unit/night.test.ts#밤 → 아침 한 줄 (NIGHT-01, NIGHT-06, D-08)"
        status: pass
    human_judgment: false
  - id: C2
    description: "pickTarget 의 모든 거부 경로가 계약 순서(단계 → 행위자 → 역할 → 대상 → 마피아 자신·동료)대로 막히고, 같은 값은 입력 객체 그대로 ok, 다른 값은 그 사람의 nightPick 만 바꾸며 마감은 그대로다"
    requirement: "NIGHT-05, ELIM-01"
    verification:
      - kind: unit
        ref: "test/unit/night.test.ts#pickTarget 검사 순서 (D-02, ELIM-01)"
        status: pass
    human_judgment: false
  - id: C3
    description: "밤 행동 뒤 state 를 받을 사람은 행위자(마피아면 생존 마피아 전원)와 탈락자뿐이고, 밤 채팅 받는 사람은 생존 마피아와 탈락자뿐이다"
    requirement: "ELIM-01"
    verification:
      - kind: unit
        ref: "test/unit/night.test.ts#받는 사람 (D-17, 결정 0021)"
        status: pass
    human_judgment: false
  - id: C4
    description: "판정 규칙표 전 행(다수·동률·일부 선택·방어적 재검증·의사 보호(자기 포함)·경찰 기록·동시 해결)과 난수 호출 순서([2,8]·[2,7]·인자 0 없음), 문구 연속 반복 없음(시드 1..200), 따라잡기"
    requirement: "NIGHT-01, NIGHT-02, NIGHT-03, NIGHT-06"
    verification:
      - kind: unit
        ref: "test/unit/night.test.ts#판정 규칙표 (NIGHT-01·02·03)"
        status: pass
      - kind: unit
        ref: "test/unit/night.test.ts#난수 계약 (T-03-09)"
        status: pass
      - kind: unit
        ref: "test/unit/night.test.ts#문구 번호 (D-18, NIGHT-06)"
        status: pass
      - kind: unit
        ref: "test/unit/night.test.ts#따라잡기"
        status: pass
    human_judgment: false
  - id: C5
    description: "서버 규칙이 실제 방(소켓·알람)에서 도는 것, 뷰에 선택·결과를 싣는 것, 화면은 이 계획 범위 밖이다 — 03-05(뷰)·03-07(소켓)·03-08/10(화면)·03-12(배포본 확인)"
    requirement: "NIGHT-01, NIGHT-02, NIGHT-03"
    human_judgment: true
    rationale: "이 계획은 순수 함수와 tick 훅까지다. 행동이 폰까지 오가는 경로는 아직 없다"

actuals:
  tokens: 10500
  tasks: 3
  commits: 6
plan_head_before: 8bec33b1dda8c85b896953d3a0d8976e0933b09c
plan_head_after: e37576df34af479f3d375571633e4975ecb3e8df
---

# Phase 3 Plan 03: 밤 판정 규칙 Summary

**마피아 지목·경찰 조사·의사 보호를 서버 순수 함수(pickTarget·enterNight·resolveNight·enterMorning)로 만들어 tick 의 night·morning 훅에 걸었다. 다수·동률 무작위·의사 구출 비공개·경찰 기록·동시 해결·문구 연속 반복 없음을 규칙표대로 지키고, 난수는 필요할 때만 정해진 순서로 쓴다.**

## Performance

- **Duration:** 약 25분 (2026-10-25)
- **Tasks:** 3 (Task 1 트레이서 TDD, Task 2 TDD, Task 3 TDD)
- **Files:** 소스 2개(night.ts 신규, tick.ts 훅 두 행), 테스트 1개(night.test.ts 신규, 41개 시나리오)

## Accomplishments

- `shared/game/night.ts`(신규, 순수 모듈): 현재 시각·전역 난수를 읽지 않고 입력을 바꾸지 않는다. 역할을 읽는 이유(행동 종류·마피아 표·조사 결과)는 주석에 적었고 역할 값은 어디에도 내보내지 않는다(반환에는 seat 와 isMafia 불리언뿐).
- `pickTarget` 검사 순서: 단계(night 아니면 WRONG_PHASE) → 행위자(방에 있고 생존) → 역할(마피아·경찰·의사) → 대상(정수·앉은 생존자) → 마피아의 자신·동료 → 같은 값이면 입력 상태 그대로 → 그 사람의 nightPick 만 바꾼 새 상태. 모두 골라도 phase·phaseEndsAt 은 그대로다(NIGHT-05).
- `resolveNight` 는 밤 시작 시점의 생존자 기준으로 한 번에 판정한다: 마피아 표(고른 사람만, 탈락자·동료를 가리키는 저장값은 방어적으로 제외) → 최다 하나면 그 대상, 동률이면 seat 오름차순 목록에서 `randInt` → 의사 보호가 지목과 같으면 탈락 없음(morning `{}`) → 경찰 조사 기록(`{n: day ?? 1, target, isMafia}`) → 탈락자가 있을 때만 `lastPhrase` 를 뺀 1..8 후보에서 문구 번호.
- `enterMorning` 은 한 번의 새 상태로 적용한다(탈락자 alive false, 경찰 investigations 뒤에 추가, morning 리터럴, lastPhrase, 모든 nightPick 키 제거). `enterNight` 는 nightPick·morning·nextNightSeq 키를 지우고 낮 채팅 번호는 건드리지 않는다.
- `pickRecipientIds`·`nightChatRecipientIds`: 밤 행동 뒤 state 와 밤 채팅을 받을 사람을 순수 함수로 정한다. 살아 있는 비행위자·비마피아는 들지 않고 탈락자(관전자, 결정 0021)만 더해진다.
- `tick.ts` 의 ON_ENTER 에 `night: enterNight`, `morning: enterMorning` 을 더했다. 늦은 알람이 한 바퀴를 따라잡아도 훅이 차례로 돌아 `morning {}` 이 남고 일차는 한 번만 오른다(테스트로 고정).
- 전체 회귀: `npx vitest run` 57 파일·1135 테스트 통과(기준선 1060 → 시나리오 41개 추가 외 03-02 분 포함), `npm run typecheck` 통과.

## Task Commits

| Task | 커밋 | 내용 |
|------|------|------|
| 1 RED | `d1d063e` test(03-03) | 밤 → 아침 한 줄(night.ts 는 빈 뼈대) |
| 1 GREEN | `39d8e5a` feat(03-03) | enterNight·pickTarget(기본)·단일 지목 enterMorning, ON_ENTER 두 행 |
| 2 RED | `3268d3f` test(03-03) | 검사 순서 전 경로·받는 사람(뼈대는 빈 값 반환) |
| 2 GREEN | `f12ca95` feat(03-03) | 마피아 자신·동료 거부, pickRecipientIds·nightChatRecipientIds |
| 3 RED | `cbdff97` test(03-03) | 판정 규칙표·난수 계약·문구 번호·따라잡기 |
| 3 GREEN | `e37576d` feat(03-03) | resolveNight·enterMorning 을 규칙표대로 완성 |

`commits: 6` 은 `git rev-list --count ${plan_head_before}..HEAD` 로 측정한 값이다(HANDOFF 커밋 전).

## TDD Gate Compliance

| Task | RED | GREEN | 증거 |
|------|-----|-------|------|
| 1 | `d1d063e` test(03-03) | `39d8e5a` feat(03-03) | `gsd-tools check tdd-red-evidence` → `RED_EVIDENCE_OK`(tap-flat, 대상 "5명 판: 마피아가 시민을 지목하면 마감에 아침으로 넘어가 …", 5건 모두 실패) |
| 2 | `3268d3f` test(03-03) | `f12ca95` feat(03-03) | `RED_EVIDENCE_OK`(대상 "마피아가 자신 또는 동료를 고르면 BAD_MESSAGE 다(6명 판)", 21건 중 5건 실패) |
| 3 | `cbdff97` test(03-03) | `e37576d` feat(03-03) | `RED_EVIDENCE_OK`(대상 "마피아 둘이 다른 대상(동률)이면 randInt 첫 호출 인자가 2 …", 41건 중 12건 실패) |

semanticAssessment (Task 1): night.ts 는 빈 함수만 내보내는 뼈대라 모듈 로드 실패가 아니라 단언 실패로 RED 가 났다. 대상 테스트는 `picked.ok` 가 false(`expected false to be true`)로, 같은 RED 의 다른 단언들은 `morning` 이 undefined(`expected true to be false`) 등으로 실패했다. 뼈대는 import 가 해결되게 하려는 것이며 RED 커밋에 함께 들어 있다(계획이 허용한 방식).

semanticAssessment (Task 2): 이 RED 에서 pickTarget 쪽은 Task 1 의 GREEN 이 이미 단계·행위자·역할·대상·같은 값을 구현해 대부분 통과했고(16건), 실패한 것은 계획된 새 동작뿐이다 — 마피아 자신·동료 거부(`expected 'ok ok ok' to be 'BAD_MESSAGE BAD_MESSAGE BAD_MESSAGE'`)와 받는 사람 네 건(뼈대가 빈 값을 반환해 `expected '' to be …`). 통과한 단언들은 거부 경로를 회귀로 고정하는 용도다.

semanticAssessment (Task 3): 12건이 계획된 규칙에서 실패했다 — 동률(`expected undefined to be 2`), 의사 보호(탈락이 그대로 생김), 경찰 기록(`undefined`), 문구 후보(lastPhrase 를 빼지 않음: `expected 1 to be 2`), 시드 1..200 연속 반복(27 시드에서 같은 번호), 따라잡기 포함. Task 1 이 단일 지목·단순 문구까지만 구현해 두었기 때문에 이 RED 가 정직하다. 첫 시도에서 spy 호출 기록이 빈 문자열일 때 TAP 의 `actual:` 줄이 비어 `INVALID_RED(invalid_record)` 가 났다 — 호출 기록을 `[2,8]` 처럼 대괄호로 감싸고, `JSON.stringify(undefined)` 비교는 `String(...)` 로 감싸 값이 항상 비어 있지 않은 문자열이 되게 고쳐 `RED_EVIDENCE_OK` 를 받았다(구현 코드는 그 전에 건드리지 않았다).

트레이서 게이트: auto 모드가 아니고 `human_verify_mode` 가 end-of-phase 이며 Task 1 의 `<verify>` 가 자동 검사뿐이라 `npx vitest run test/unit/night.test.ts test/unit/tick.test.ts`(28건 통과)·`npm run typecheck` 를 다시 돌려 통과를 확인하고 Task 2 로 넘어갔다 — Tracer verified end-to-end.

## Deviations from Plan

None - plan executed exactly as written.

세부 선택(편차 아님): (1) Task 1 RED 에 night.ts 빈 뼈대를 함께 커밋했다(계획이 허용: "내보내기만 있는 빈 함수로 먼저 만들어 단언 실패로 RED"). Task 2 RED 도 같은 이유로 받는 사람 두 함수의 빈 뼈대를 넣었다. (2) Task 1 GREEN 은 계획대로 최소만 구현했다 — 동률은 지목 없음으로 두고 문구는 `1 + randInt(8)` 만 쓰다가 Task 3 에서 규칙표대로 바꿨다. 이래야 Task 3 RED 가 정직하게 실패한다. (3) `requirements mark-complete` 는 부르지 않았다: 이 계획은 순수 서버 규칙까지고 뷰(03-05)·소켓(03-07)·화면이 아직 없어 NIGHT-01·02·03 이 사용자 경로로 끝나지 않았고, ELIM-01·NIGHT-04 는 지시대로 보류한다. NIGHT-05·06 은 03-01 이 이미 처리했다.

## Issues Encountered

없음. RED 증거 기록의 형식 문제 한 건은 위 TDD 절에 적었다.

## Known Stubs

없음. 이 계획이 만든 코드에는 빈 값·자리표시자가 화면으로 흐르는 곳이 없다. 4페이즈 전까지 승패가 없어 시민이 모두 탈락해도 판이 계속 도는 것은 의도다(RESEARCH Pitfall 9).

## Threat Flags

없음. 새 네트워크 입구·인증 경로가 없고(night.ts 는 순수 함수, 소켓 배선은 03-07), 계획의 T-03-06·07·08·09·10·34 완화가 모두 적용됐다: 시민·탈락자의 행동 거부와 응답이 역할을 드러내지 않음, 마피아 자신·동료 거부와 저장 지목 방어적 재검증, night.ts 에 Math.random·Date.now·crypto 없음(grep 0), 인자 0 호출 없음 테스트, morning 은 eliminated·phrase 두 키뿐이고 의사 구출과 지목 없음이 같은 `{}`, 받는 사람 함수가 살아 있는 비행위자·비마피아를 넣지 않음.

## Self-Check: PASSED

- `shared/game/night.ts`·`test/unit/night.test.ts`·`shared/game/tick.ts` 존재 확인, 커밋 6개(`d1d063e`, `39d8e5a`, `3268d3f`, `f12ca95`, `cbdff97`, `e37576d`) 모두 HEAD 의 조상임을 확인
- 계획 인수 기준 통과: `night: enterNight|morning: enterMorning` 2건, night.ts 의 전역 난수·시각 호출 0건, `MORNING_PHRASE_COUNT` 3건, A1·A2 주석 6건, export 함수 두 개, 각 `test(03-03)` 커밋이 해당 `feat(03-03)` 커밋보다 앞
- 전체 검증: `npx vitest run` 1135 통과, `npm run typecheck` 통과

## Next Phase Readiness

03-04(밤 채팅)는 `nightChatRecipientIds` 와 `nextNightSeq` 초기화를, 03-05(뷰)는 `morning`·`nightPick`·`investigations` 값을, 03-07(워커)은 `pickTarget`·`pickRecipientIds` 를 그대로 쓴다. 규칙 가정 A1·A2 와 판정 규칙표는 03-09 가 결정 0020 에 기록한다. HANDOFF.md 갱신과 push 는 이 SUMMARY 뒤에 처리한다.
