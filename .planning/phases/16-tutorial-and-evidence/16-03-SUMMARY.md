---
phase: 16-tutorial-and-evidence
plan: "03"
subsystem: game-rules-errand
tags: [errand, mafia, server-only, leak-test, tdd, vitest]
requires:
  - phase: 15-errand-and-record
    provides: actErrand·enterErrand·봇 errandGo/errandAct·me.errand
  - phase: 16-01
    provides: errandLast 서버 전용 이름 등록 방식(SERVER_ONLY_NEW·SERVER_ONLY_KEYS)
provides:
  - Player.errandFake(서버 전용) — 산 마피아의 가짜 심부름 장소 한 곳
  - assignErrandFake(state) — 난수 없이 (seat + day) % 목록 길이
  - actErrand 의 가짜 제외(반경 밖과 같은 { ok: false } 경로)
  - 봇 errandGo 의 가짜 마지막 순서
affects: [16-07, 16-09, 16-10]
actuals:
  tokens: 6200
  tasks: 3
  commits: 3
plan_head_before: 6e18ea38d7e4d0db8bec5875a534d5ae815c1029
commits: 3
plan_head_after: ea60e65e83f0cf4c3b0a451ecb067bf6c1ad8b77
tech-stack:
  added: []
  patterns:
    - "역할을 읽는 심부름 코드는 errandFake.ts 한 파일, 나머지는 errandFake 키 이름만 다룬다"
    - "ON_ENTER 훅을 순수 함수로 감싸 난수 호출 순서를 건드리지 않는다"
key-files:
  created:
    - shared/game/errandFake.ts
    - test/unit/errandFake.test.ts
  modified:
    - shared/game/room.ts
    - shared/game/errand.ts
    - shared/game/tick.ts
    - shared/game/night.ts
    - worker/room.ts
    - test/unit/errand.test.ts
    - test/unit/errandView.test.ts
    - test/unit/view.test.ts
    - test/worker/errand.test.ts
    - test/worker/errandLeak.test.ts
    - test/worker/leak.test.ts
key-decisions:
  - "가짜 고르기는 난수 없이 places[(seat + day) % 길이] — enterErrand 난수 호출 순서·봇 시드 고정 값 불변"
  - "봇 errandGo 는 가짜가 아닌 미완료 장소 중 가장 가까운 곳, 없을 때만 가짜(계획 단계에서 다듬음)"
  - "마피아는 3/3 불가 → me.record 없음. 기록 조건·기록 줄 모양은 고치지 않는다(A1)"
  - "화면(클라이언트 actablePlaceOf)은 가짜를 모른다 — 마피아의 [처리]가 가짜 곁에서 켜져도 안 차는 것은 본인만 본다(V-25)"
requirements-completed: [ERRAND-08, DEPLOY-04]
status: complete
---

# Phase 16 Plan 03: 마피아 가짜 장소 Summary

산 마피아는 시민과 같은 모양·개수의 심부름 목록을 받지만 그중 한 곳(`errandFake`, 서버 전용, 난수 없이 `(seat + day) % 3`)은 처리되지 않고, 가짜 곁 응답은 반경 밖 응답과 한 글자도 같으며 봇 마피아는 가짜를 마지막에 가서 2/3 에서 멈춘다.

## RED / GREEN / REFACTOR

- **RED** (`0ca34d20`): `test/unit/errandFake.test.ts`(신규 6건), `test/unit/errand.test.ts`(actErrand 가짜 4건), `test/worker/errand.test.ts`(봇 마피아 2/3·errandGo 목표·응답 동일성에 가짜 곁 응답 추가), `test/worker/errandLeak.test.ts`(⑧ 마피아·시민 me.errand 모양·가짜 응답 == 반경 밖 응답·errandFake 가 프레임 어디에도 없음, SERVER_ONLY_NEW 등록, ⑥ 음성 시험). 실패 13건. 증거 `.planning/phases/16-tutorial-and-evidence/.tdd/16-03-red.json`, `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK`(`target_test_failed`).
  - 대상 시험 `errandFake.test.ts > 모듈이 있고 함수를 내보낸다`: 계획한 이유(`expected 'undefined' to be 'function'`)로 실패.
  - semanticAssessment: 나머지 12건도 계획한 단언으로 실패 — 가짜 키 미배정(`'3:undefined' to be '3:record'`), 가짜 곁 처리 성공(`{"ok":true,...}` vs `{"ok":false}`), 봇 마피아 errandFake 없음(`to include undefined`), 시민 모양 비교 전 `fake === undefined` 가 마피아에서 true 였음. import·문법·수집 오류 없음(첫 시도는 멀티라인 toEqual 출력 때문에 `invalid_record` 였고, 시험을 한 줄 출력(JSON 문자열 비교)으로 고친 뒤 다시 돌려 통과).
- **GREEN** (`c5135120`): `errandFake.ts`(assignErrandFake), `Player.errandFake?`, `ON_ENTER.errand` 감싸기, `actErrand` 후보 순회에서 `id === actor.errandFake` 건너뛰기, `enterErrand`·`enterNight` 구조분해에 키 삭제, 봇 `errandGo` 두 번 순회(가짜 아닌 것 → 없으면 가짜). 4개 대상 파일 61건 통과.
- **REFACTOR**: 없음(정리할 중복 없음, 커밋 만들지 않음). 대신 전체 시험에서 드러난 거울 시험을 고쳤다(아래 Deviations, `ea60e65e`).

## Commits

- `0ca34d20` test(16-03): 마피아 가짜 장소 실패 시험
- `c5135120` feat(16-03): 마피아 가짜 장소 — 배정·처리 제외·봇 순서
- `ea60e65e` test(16-03): 화면 거울 시험이 가짜 장소를 모르는 기본 규칙만 견주게

## 시험 결과

- `npm run typecheck` 통과.
- `npm test` 전체: 첫 실행은 1건 실패(거울 시험, 아래 Deviations) → 수정 뒤 다시 돌려 **260 파일 통과 / 7504 시험 통과**(6 파일·261 건은 기존 skip). 알려진 `bots.test.ts` 불안정 시험은 두 번 모두 실패하지 않았다.
- 위험 확인: `git diff --quiet 9d6dba72 -- shared/game/bots.ts shared/game/ruleset.ts` 변경 없음. `errand.ts` 주석 제외 본문의 `.role` 0건. `git grep` 위생 검사에서 새 일치 없음.
- 로컬 E2E `npm run e2e -- --url http://localhost:5173 --only errand --sizes 360x640,390x664`: **360x640 19/19, 390x664 19/19, E2E OK**(개발 서버는 끔). 전체 6폰 회귀·nightload·배포는 하지 않았다(16-10).

## Deviations from Plan

**1. [Rule 1 - Bug] 화면 거울 시험이 가짜 장소 때문에 깨짐**
- **Found during:** Task 3 (`npm test`)
- **Issue:** `test/unit/errandView.test.ts` 의 "actablePlaceOf 는 서버 actErrand 와 같은 표본에서 같은 판정" 이 첫 마피아(시드 11)의 가짜 장소에서 서버는 거절, 클라이언트는 장소를 돌려줘 어긋났다.
- **Fix:** 클라이언트는 errandFake 를 모르는 것이 의도(V-25, 화면 불변)이므로 거울 시험의 서버 상태에서 errandFake 를 뺐다. 가짜 제외는 errand.test.ts 가 따로 본다. 제품 코드 변경 없음.
- **Files modified:** test/unit/errandView.test.ts
- **Commit:** `ea60e65e`

**2. [계획 보강] 시험 보조**: `test/unit/view.test.ts` 의 `SERVER_ONLY_KEYS`, `test/worker/leak.test.ts` 의 `SERVER_ONLY_KEYS` 에도 `errandFake` 를 등록했다(계획의 files 목록 밖이지만 서버 전용 이름 등록 규칙).

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크 표면 없음. T-16-07(응답 동일)·T-16-08(errandFake 서버 전용)·T-16-09(봇 한자리 서기)는 시험으로 고정했다.

## Self-Check: PASSED

- 생성 파일 `shared/game/errandFake.ts`, `test/unit/errandFake.test.ts` 존재.
- 커밋 `0ca34d20`, `c5135120`, `ea60e65e` 가 HEAD 의 조상.
