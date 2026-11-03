---
phase: 09-night-morning
plan: "07"
subsystem: game-rules
tags: [night, morning, confirmedTarget, morningMsOf, view, protocol, tdd]

requires:
  - phase: 09-night-morning
    provides: "09-02 botMafiaTarget (마피아 봇이 동료 선택을 따름 — 전원 일치가 봇 방에서 성립하는 근거)"
provides:
  - "confirmedTarget(state): 산 마피아 전원 일치일 때만 확정 대상 (연결 상태 미참조)"
  - "resolveNight(state)·enterMorning(state): 난수·문구 번호 제거, saved 공개, 탈락 없는 밤의 nightNote 폐기"
  - "enterNight 가 nightNote·chalk 도 지움"
  - "morningMsOf(state): 아침 길이 = 5초 + 탈락 2 + 유언 2 + 쪽지 2, 상한 15초 (phaseDurationOf 가 morning 이면 사용)"
  - "view: day.morning 은 { eliminated } / { saved: true } / {} , 산 마피아 본인 밤 me.nightTally·me.nightSure"
  - "9페이즈 와이어 타입(MorningView.saved, DayView.chalk, MyInfo.nightTally·nightSure·will·note, ChatLineWire.k)과 서버 전용 상태 타입(Player.will, RoomState.nightNote·chalk)"
affects: [09-08, 09-09, 09-12, 09-13, 09-14, 09-15, 09-18]

actuals:
  tokens: 11196
  tasks: 3
  commits: 6
plan_head_before: 8f8d00f9a8597b4abc626cfb7251590f7125972d
plan_head_after: c69f992eca96d754f273d6e133f3aab81ab8a993

tech-stack:
  added: []
  patterns:
    - "밤 판정은 순수 함수 하나(confirmedTarget)가 정하고 resolveNight·view 가 같은 함수를 부른다"
    - "아침 길이는 공개 내용만 읽는 함수(L6) — 구출·무효 밤은 쪽지를 지워 길이가 5초로 같다"

key-files:
  created: []
  modified:
    - shared/game/night.ts
    - shared/game/room.ts
    - shared/protocol.ts
    - shared/game/phases.ts
    - shared/game/discussion.ts
    - shared/game/view.ts
    - test/unit/night.test.ts
    - test/unit/phases.test.ts
    - test/unit/tick.test.ts
    - test/unit/discussion.test.ts
    - test/unit/view.test.ts
    - test/unit/testTools.test.ts
    - test/unit/nyquist-03-night-chain.test.ts
    - test/worker/night.test.ts
    - test/worker/leak.test.ts

key-decisions:
  - "A3 유지: MORNING_MS 이름은 그대로 두고 뜻만 '아침 기본 길이' 로 주석을 고쳤다"
  - "산 마피아에게 밤 내내 me.nightTally 를 항상 싣는다(선택이 없으면 []). nightSure 는 확정일 때만 키가 있다"
  - "MorningView.phrase 타입은 남겼다(화면이 아직 읽음). 서버는 채우지 않으며 09-18 이 화면과 함께 지운다"

patterns-established:
  - "규칙 변경 시 깨지는 기존 시험은 건너뛰지 않고 새 규칙 기대값으로 고친다(.skip·.todo 0건)"

requirements-completed: [NIGHT-08, MORN-03, MORN-04]

coverage:
  - id: D1
    description: "마피아 전원 일치 확정 confirmedTarget (1·2·3명, 일부 미선택, 불일치, 끊긴 마피아, 탈락·마피아 대상)"
    requirement: "NIGHT-08"
    verification:
      - kind: unit
        ref: "test/unit/night.test.ts#confirmedTarget — 마피아 전원 일치"
        status: pass
      - kind: integration
        ref: "test/worker/night.test.ts#마피아 전원 일치 (NIGHT-08, 결정 0061-6)"
        status: pass
    human_judgment: false
  - id: D2
    description: "의사 구출을 morning.saved 로 공개하고 구출·무효 밤의 쪽지를 폐기"
    requirement: "MORN-03"
    verification:
      - kind: unit
        ref: "test/unit/night.test.ts#아침 결과 morning / 쪽지 폐기 / buildView 아침 day.morning"
        status: pass
    human_judgment: false
  - id: D3
    description: "아침 길이 공식 morningMsOf 와 tick 마감 반영 (탈락·유언·쪽지 가산, 상한 15초)"
    requirement: "MORN-04"
    verification:
      - kind: unit
        ref: "test/unit/discussion.test.ts#morningMsOf; test/unit/tick.test.ts#tick: 아침 마감 = 진입 + morningMsOf"
        status: pass
    human_judgment: false
  - id: D4
    description: "산 마피아 본인 밤 view 에만 me.nightTally·me.nightSure (다른 신분·유령·낮·아침에는 키 없음)"
    requirement: "NIGHT-08"
    verification:
      - kind: unit
        ref: "test/unit/view.test.ts#마피아 집계 me.nightTally·me.nightSure"
        status: pass
      - kind: integration
        ref: "test/worker/leak.test.ts#6명 한 판 전수 누출 검사 (마피아 조건부 경로 허용)"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-11-03
status: complete
---

# Phase 09 Plan 07: 밤 판정 전원 일치와 아침 길이 Summary

**마피아 전원 일치로만 확정되는 난수 없는 밤 판정(confirmedTarget), 구출을 saved 하나로 공개하는 아침, 공개 내용만으로 정해지는 아침 길이(morningMsOf), 산 마피아 본인에게만 가는 선택 집계(nightTally·nightSure)를 순수 함수와 시험으로 고정했다.**

## Performance

- **Duration:** 약 9분
- **Tasks:** 3 (트레이서 1 + TDD 2)
- **Commits:** 6 (RED 3 + GREEN 3)
- **전체 시험:** `npx vitest run` 138 파일 3809 통과, 1 skipped(기존). `npm run typecheck` 통과.

## TDD 기록

### Task 1 (tracer) — 한 밤 판정
- **RED:** `test/unit/night.test.ts` 를 새 규칙표로 바꿨다. 65개 중 40개 실패(`confirmedTarget is not a function`, `randInt is not a function`, 기대 `{saved:true}` 인데 `{}`, 기대 `eliminated` 인데 `eliminated,phrase`). 분류기 `RED_EVIDENCE_OK`. 의미 평가: 실패는 계획한 새 동작(전원 일치 확정, 난수 없는 시그니처, saved·쪽지 폐기)이 아직 없어서 나는 것이고 구문·픽스처 오류가 아니다. 지운(대체한) describe 이름: "판정 규칙표 (NIGHT-01·02·03)" 안의 다수결·동률 시험, "난수 계약 (T-03-09)", "문구 번호 (D-18, NIGHT-06)".
- **GREEN:** `confirmedTarget`·`resolveNight(state)`·`enterMorning(state)`·`enterNight` 정리, protocol·room 타입, `buildDay` 의 `saved`. 규칙 변경으로 깨진 `view.test.ts`·`testTools.test.ts` 의 기대값을 마피아 전원 일치 방식으로 고쳤다.

### Task 2 — 아침 길이
- **RED:** `morningMsOf`·상수·tick 마감 시험 추가, 10개 실패(`morningMsOf is not a function`, 마감 135000 대신 139000 기대). 분류기 `RED_EVIDENCE_OK`. 의미 평가: 계획한 길이 공식이 없어서 실패.
- **GREEN:** `phases.ts` 상수 4개, `discussion.ts` 의 `morningMsOf`·`phaseDurationOf` 아침 분기.

### Task 3 — 마피아 집계 view
- **RED:** `view.test.ts` 의 "마피아 집계" describe, 워커 night·leak 시험. 유닛 6개·워커 2개 실패(`nightTally` 가 `undefined`). 분류기 `RED_EVIDENCE_OK`. 의미 평가: 집계 키가 없어서 실패.
- **GREEN:** `view.ts` 에 `nightTally`·`nightSure`.
- **REFACTOR:** 없음.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] discussion 모듈 내보내기 목록 시험**
- **Found during:** Task 2 RED
- **Issue:** `test/unit/discussion.test.ts` 가 모듈 내보내기 이름을 정확히 비교해 `morningMsOf` 추가 시 실패한다(계획 파일 목록에 없음).
- **Fix:** 기대 목록에 `morningMsOf` 추가.
- **Commit:** 3860963

**2. [Rule 1 - Bug] 규칙 변경 여파로 깨진 기존 시험 정리 (계획 Task 3 에서 하려던 일을 Task 1 GREEN 에 앞당김)**
- **Found during:** Task 1 GREEN 전체 유닛 실행
- **Issue:** `view.test.ts` 의 `morningWithVictim` 등이 마피아 한 명만 골라 탈락을 기대했고, `testTools.test.ts` 가 문구 번호를 단언했다.
- **Fix:** 마피아 전원이 같은 대상을 고르게 하고 `{saved:true}`·`{eliminated}` 기대값으로 수정. 매 커밋 시점에 유닛 전체가 초록이도록 앞당겼다.
- **Commit:** c48a1d5

**3. [Rule 2 - 시험 보강] 2일차 leak 시험의 구출 아침 기대값**
- `{}` → `{"saved":true}` (의사가 지킨 밤). Commit 84c5eeb.

nyquist-03 은 기존 무작위 판 시험이 그대로 통과해 기대값을 바꾸지 않고, 키 허용 목록 단언과 "전원 일치 + 의사 유무" 사슬 시험을 더했다.

## Known Stubs

없음. `MyInfo.will`·`note`, `DayView.chalk`, `ChatLineWire.k`, `Player.will`, `RoomState.nightNote`·`chalk` 는 타입만 두었고 값은 뒤 계획이 채운다(09-12 유언·쪽지, 09-14 분필). `morningMsOf` 는 `will`·`nightNote` 가 생기면 그대로 반영한다.

## Threat Flags

없음. T-09-11~14 모두 시험으로 고정(저장된 nightPick 재검증, 세 밤 길이 동일, buildDay 필드별 리터럴, 집계는 산 마피아 본인 조건 + leak 마피아 조건부 경로).

## Next Phase Readiness

- 09-12(유언·쪽지 저장)는 `Player.will`·`RoomState.nightNote` 를 쓰면 아침 길이가 자동으로 늘어난다.
- 09-13(마피아 화면)은 `me.nightTally`·`me.nightSure` 를 읽는다.
- 09-18 은 `MorningView.phrase` 타입·`MORNING_PHRASE_COUNT`·`src/game/eliminationText.ts`·`scripts/smoke.mjs`·`scripts/uat-night.mjs` 의 문구 번호 참조를 화면과 함께 지워야 한다(서버는 이미 채우지 않는다).

## Self-Check: PASSED

- 생성·수정 파일 존재, 커밋 6개(e73295e, c48a1d5, 3860963, 0e7f168, 84c5eeb, c69f992) 확인.
