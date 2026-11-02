---
phase: 07-free-chat
plan: "26"
subsystem: e2e-harness
tags: [e2e, prediction, walk-start, jump, hooks, docs, tdd, gap-closure]
gap_closure: true
gap_ids: [G-07-9]

requires:
  - phase: 07-free-chat
    provides: "07-25 의 runtime.shown(seat)·예측·섞기, 07-23 의 E2E lib.mjs 변경"
provides:
  - "scripts/e2e/lib.mjs — walkStartChecks(W11·W12)와 상수 WORLD_MOVE_SPEED·WORLD_START_MAX_FRAMES·WORLD_START_MOVED_MIN·WORLD_JUMP_SPEED_MAX"
  - "scripts/e2e/browser.mjs — tapWorld 의 화면 위치 감시와 readWalkWatch"
  - "src/world/testHooks.ts — window.__mfWorld.shown(seat)"
  - "world 흐름이 손님 탭 한 번에 대해 W11·W12 를 기록"
  - "06-UI-SPEC 결정 0059 개정 표시(원문 유지)·architecture·screen-map 갱신"
affects: [07-27]

plan_head_before: be5c1b91a6bad8118f176254e0ba6289af2a2b01
plan_head_after: 04dfc3bb2a5213cc661dd0970f7c529f82f93481

actuals:
  tokens: 4200
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "페이지 안 rAF 감시가 프레임 시각(Date.now)·화면 위치를 모으고 Node 쪽 순수 함수가 판정한다 — 측정값 없음은 조용히 통과하지 않고 실패"
    - "회귀 고정 시험: 훅(shown)과 서버 구간(sample)의 구분, E2E 상수와 앱 상수의 동일성"

key-files:
  created: []
  modified:
    - src/world/testHooks.ts
    - scripts/e2e/browser.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/flows.mjs
    - test/client/worldStage.test.tsx
    - test/unit/e2eContract.test.ts
    - docs/screen-map.md
    - .planning/phases/06-world-skeleton/06-UI-SPEC.md
    - docs/architecture.md

key-decisions:
  - "W11·W12 는 손님 탭 한 번(worldFlow 의 tap)에만 붙이고 방장 탭에는 붙이지 않는다 — 계획대로"
  - "W12 는 프레임 간격 4~100ms 쌍만 재고 10쌍 미만이면 측정값 없음으로 실패한다(타이머 잡음·멈춤 구간 제외, 거짓 통과 방지)"
  - "문턱값(3프레임·5.4 단위/초)은 로컬 통과를 위해 조정하지 않았다 — 로컬에서 그대로 통과했다"

requirements-completed: [MAP-02]

coverage:
  - id: D1
    description: "E2E world 흐름이 손님 탭 한 번에 대해 W11(탭 뒤 3프레임 안 화면 출발)과 W12(걷는 동안 프레임 사이 속도 ≤ 5.4 단위/초)를 판정하고, 측정값이 없으면 실패한다"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "scripts/e2e/lib.test.mjs#walkStartChecks"
        status: pass
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 --only world (6개 크기 W11·W12 통과)"
        status: pass
    human_judgment: false
  - id: D2
    description: "__mfWorld.shown 은 마지막 프레임에 그린 위치와 프레임 시각이고 sample 은 서버 구간 값 그대로다. E2E 걷는 속도 상수가 앱 MOVE_SPEED 와 같다"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/client/worldStage.test.tsx#결정 0059: __mfWorld.shown(seat) 은 마지막 프레임에 그린 위치와 프레임 시각이고, sample 은 여전히 서버 구간 값이다"
        status: pass
      - kind: unit
        ref: "test/unit/e2eContract.test.ts#WORLD_MOVE_SPEED 는 shared/game/world.ts 의 MOVE_SPEED 와 같고"
        status: pass
    human_judgment: false
  - id: D3
    description: "06-UI-SPEC 잠금 문장 원문 유지 + 결정 0059 개정 표시 8곳, architecture·screen-map 이 0059 와 shown 훅을 반영한다"
    requirement: MAP-02
    verification:
      - kind: command
        ref: "grep -c '결정 0059' 06-UI-SPEC.md = 8, '예측 이동 없음' = 2, '보통 300ms 안, 최대 500ms' = 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "배포본(RTT 약 155ms)에서 예측·섞기가 실제로 W11·W12 를 통과하는지"
    requirement: MAP-02
    verification: []
    human_judgment: true
    rationale: "이 계획은 배포하지 않는다(금지 사항). 배포본 판정은 07-27 이 한다. 로컬은 RTT 수 ms 라 예측 없이도 통과할 수 있어 로컬 통과만으로 G-07-9 가 닫히지 않는다"

duration: 4min
completed: 2026-11-02
status: complete
---

# Phase 07 Plan 26: 탭 뒤 화면 출발·한 프레임 튐을 E2E W11·W12 로 판정 Summary

**런타임 shown 값을 E2E 훅으로 내고 tapWorld 가 프레임 단위로 모아 순수 판정 walkStartChecks 가 '3프레임 안 출발(W11)'과 '프레임 사이 속도 ≤ 5.4 단위/초(W12)'를 world 흐름에서 판정하며, 06-UI-SPEC 의 예측 금지 문장에는 원문을 둔 채 결정 0059 개정 표시를 달았다**

## Performance

- **Duration:** 약 4분
- **Tasks:** 3 (Task 1 tracer RED→GREEN, Task 2 회귀 시험 + 화면 지도, Task 3 문서)
- **Files modified:** 10
- **Commits:** 5 (측정값)

## Accomplishments

- `walkStartChecks(watch)`: 출발점은 upWall 이전 마지막 프레임(없으면 첫 프레임). upWall 뒤 프레임을 세어 0.005 이상 떨어진 첫 프레임이 3번째 이내면 W11 통과(실패 설명에 N번째 프레임·ms). W12 는 at 간격 4~100ms 인 이웃 쌍의 최대 속도가 5.4 이하면 통과(실패 설명에 최대 속도와 손 뗀 뒤 ms). watch 없음·upWall 없음·프레임 없음·쌍 10개 미만은 `측정값 없음` 실패.
- `__mfWorld.shown(seat)` 훅 추가(설치 조건은 기존과 동일, `sample` 은 서버 구간 그대로).
- `tapWorld` 가 같은 evaluate 안에서 `window.__walkWatch` 를 심고 rAF 로 프레임마다 shown 을 모은다(손 뗌 1500ms 뒤 또는 설치 5000ms 뒤 종료). 반환값은 불변. `readWalkWatch(page)` 로 읽는다.
- `worldFlow` 손님 탭 갈래에서 도착 뒤 기다림 다음에 W11·W12 를 시나리오 `world/walk` 로 기록.
- 로컬 개발 서버 `--only world` 6개 크기(360x640·390x664·430x932·360x560·390x844·402x874) 모두 W11·W12 와 기존 행 통과, 실패 표 비어 있음.
- 회귀 고정: shown/sample 구분 시험, `WORLD_MOVE_SPEED === MOVE_SPEED`·`WORLD_JUMP_SPEED_MAX === 3 × MOVE_SPEED` 시험.
- 06-UI-SPEC 8곳(잠금 행·터치해서 걷기 3·5·8번·합격 기준 반응 행·E3 loading/error·쓰지 않을 것)에 `→ 결정 0059 개정(2026-11-02)` 을 덧붙임. 원문 문장 삭제 0. architecture.md 클라이언트 줄과 screen-map.md 검사 계약(shown, W11·W12)을 갱신.

## TDD

- **RED:** `170a2f9` — lib.test.mjs 의 walkStartChecks 시험 6개(통과 경로·W11 10번째 프레임 실패·경계 3/4번째·W12 튐 실패·간격 제외와 10쌍 미만·측정값 없음)가 껍데기(`아직 없음` 실패)에 대해 단언 불일치로 실패(240개 중 6 실패, 상수 시험은 상수가 이미 있어 통과). 구문 오류·발견 0개가 아닌 대상 시험의 단언 실패. semanticAssessment: 의도한 이유(판정 미구현)로 실패함.
- **GREEN:** `4cef795` — 구현 후 240 통과.
- **REFACTOR:** 없음.
- Task 2 는 plan 지시대로 회귀 고정 시험이라 처음부터 통과(`1cc0693`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] HookRuntime 에 shown 이 필수가 되어 기존 시험의 가짜 런타임이 타입 오류**
- **Found during:** Task 1 (tsc -p tsconfig.app.json)
- **Issue:** `test/client/worldStage.test.tsx` 의 `installWorldTestHooks` 직접 호출 시험이 shown 없는 객체를 넘김 → TS2741
- **Fix:** 가짜 런타임에 `shown: () => null` 추가
- **Files modified:** test/client/worldStage.test.tsx
- **Commit:** 4cef795

**2. [시험 오타] RED 시험의 W12 튐 입력**
- **Found during:** Task 1 GREEN
- **Issue:** 처음 시험이 `+0.14` 를 걸음 0.03 위에 더해 한 프레임 0.17(10.6 단위/초)이 되어 설명서의 8.75(0.14/16ms) 와 다름
- **Fix:** 튐분을 0.11 로 고쳐 한 프레임 0.14 가 되게 함(판정 코드는 영향 없음)
- **Files modified:** scripts/e2e/lib.test.mjs
- **Commit:** 4cef795

**Total deviations:** 2 (Rule 3 한 건, 시험 입력 정정 한 건). **Impact:** 범위 변화 없음.

## Issues Encountered

- 작업 중 `sed -i '<주소>s/…/'` 가 BSD sed 에서 접미사 인자로 해석돼 실패해 python 으로 바꿔 수정. 파일 변경 없음.
- 로컬 W12 는 한 번에 통과해 07-25 섞기·방향 결함 조사는 필요 없었다.

## Authentication Gates

없음.

## Known Stubs

없음.

## Threat Flags

없음. 새 훅 `shown` 은 기존 훅과 같은 조건(worldTestHooksEnabled)에서만 설치되고 화면에 이미 그려진 위치·프레임 시각만 내놓는다(T-07-63). E2E 는 localhost 만 대상으로 돌렸다(T-07-64). 패키지 설치 없음(T-07-SC).

## Next Phase Readiness

- 07-27: 배포 후 배포본 주소로 `--only world` 를 돌려 W11·W12 를 판정한다(지금 배포본은 예측 전 코드라 이 계획 시점에서는 실패하는 것이 맞다). 로컬은 RTT 가 수 ms 라 예측 없이도 통과할 수 있으므로 로컬 통과만으로 G-07-9 를 닫지 않는다.

## Self-Check: PASSED

- 생성·수정 파일 10개 존재 확인, 커밋 `170a2f9`·`4cef795`·`1cc0693`·`80ce804`·`04dfc3b` 가 HEAD 조상.
- `node --test scripts/e2e/lib.test.mjs` 240 통과, `npx vitest run` 143 파일 3897 통과, `tsc -p tsconfig.app.json` 통과, 로컬 `--only world` 6개 크기 FAIL 없음.
- 인수 기준: walkStartChecks 1, readWalkWatch 1, `__mfWorld.shown` 참조, `WORLD_SYNC_TOL = 0.3` 불변, test(07-26) 커밋 2개, UI-SPEC 개정 표시 8곳·원문 유지.
