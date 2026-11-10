---
phase: 18-quick-fixes
plan: "03"
subsystem: tutorial-screen
tags: [tutorial, GameMap, panelless, camera, tdd, sc-3]

requires:
  - phase: 16-errand
    provides: 심부름 단계 panelless 경로(useMapInsets 둘째 인자, 진행 점)
  - phase: 17-tutorial
    provides: TutorialScreen·tutorialScript·정적 가드
provides:
  - GameMap 선택 prop panelless?: boolean — 튜토리얼 지도 장면에서 아래 패널을 DOM 에서 뺀다
  - GameMap 선택 prop camera?: CameraMode — sceneLook 의 camera 칸만 덮어쓴다
  - TUTORIAL_FIXED_CAMERA·tutorialCameraOf(n) — 장면 2·5·6 광장 가운데 고정·줌 1
  - TutorialScreen 이 panelless·camera 를 넘기고 역할 카드 prop 을 넘기지 않음
affects: [18-08, tutorial-scene-5-link]

actuals:
  tokens: 9000
  tasks: 2
  commits: 4

plan_head_before: 686599871132c91c36932fe2086b1a8ea300b599
plan_head_after: 5bb3eee2016d48d5dea0e111cbbca594260b8cb1
commits: 4

tech-stack:
  added: []
  patterns:
    - "noPanel = errand || panelless prop: 한 값이 useMapInsets 둘째 인자와 패널 분기를 같이 정한다(errand 는 시작 카드·진행 점, 그 밖은 null)"
    - "선택 prop 덮어쓰기: camera prop 이 있을 때만 sceneLook 결과의 camera 칸을 덮는다 — presence.ts 불변"

key-files:
  created: []
  modified:
    - src/screens/GameMap.tsx
    - src/screens/TutorialScreen.tsx
    - src/game/tutorialScript.ts
    - test/client/tutorialScreen.test.tsx
    - test/client/tutorialGate.test.tsx
    - test/unit/tutorialScript.test.ts

key-decisions:
  - "튜토리얼 고정 카메라 경로는 GameMap 선택 prop camera 로 한다(cameraModeOf·sceneLook 은 고치지 않는다)"
  - "머리의 [기록] 단추(장면 4)는 UI-SPEC 숨김 범위(채팅 칸·입력줄·내 역할) 밖이라 그대로 둔다"
  - "TutorialScreen 의 ALWAYS_BLOCKED 는 그대로 — 없어진 요소의 선택자는 무해하다"

requirements-completed: [SC-3]

coverage:
  - id: D1
    description: "튜토리얼 지도 장면 2~6 에 [data-world-panel]·.mf-game__panel·[내 역할]·입력칸이 DOM 에 없고 머리·[건너뛰기]·사회자 띠는 남는다. 실제 판 GameMap(panelless 없음)의 패널은 그대로"
    requirement: "SC-3"
    verification:
      - kind: unit
        ref: "test/client/tutorialScreen.test.tsx#지도 장면에 아래 패널·[내 역할]이 없다 (D-06)"
        status: pass
      - kind: unit
        ref: "test/client/tutorialGate.test.tsx#장면 6: 이름표만 열린다"
        status: pass
    human_judgment: false
  - id: D2
    description: "튜토리얼 장면 2·5·6 은 광장 가운데 고정·줌 1, 3·4 는 따라가기. 실제 판 카메라 규칙(presence.ts)은 불변"
    requirement: "SC-3"
    verification:
      - kind: unit
        ref: "test/unit/tutorialScript.test.ts#튜토리얼 카메라 (P18-8, D-07)"
        status: pass
      - kind: unit
        ref: "test/client/tutorialScreen.test.tsx#튜토리얼 지도 장면의 카메라 (P18-8, D-07)"
        status: pass
    human_judgment: false
  - id: D3
    description: "늘어난 스테이지에서 폰 6종의 실제 구도(장면 5 선이 화면 안 도윤에게 닿는지)와 고정 카메라 target 미세 조정"
    requirement: "SC-3"
    verification: []
    human_judgment: true
    rationale: "렌더 측정과 눈 확인은 18-08 이 폰 6종으로 정한다 — 이 계획은 구조(패널 없음·고정 카메라 prop)만 만든다"
---

# Phase 18 Plan 03: 튜토리얼 패널 숨김과 고정 카메라 Summary

**튜토리얼 지도 장면 2~6 에서 채팅 칸·입력줄·[내 역할]을 DOM 에서 빼고(GameMap panelless prop), 장면 2·5·6 의 카메라를 광장 가운데 고정·줌 1 로 덮어쓰는 camera prop 을 더했다. 실제 판 동작은 그대로다.**

## 수행한 일

- **Task 1 (트레이서, D-06)**: `GameMapProps.panelless` 와 `noPanel = view.phase === "errand" || panelless === true` 를 `useMapInsets` 둘째 인자와 패널 분기에 같이 쓴다(errand → 시작 카드·진행 점, 그 밖의 noPanel → null, 아니면 GamePanel). TutorialScreen 은 `panelless` 를 넘기고 역할 카드 prop 과 그 memo 를 지웠다. 스테이지는 띠 아래부터 화면 아래까지 늘어난다.
- **Task 2 (D-07)**: `TUTORIAL_FIXED_CAMERA`(`{ mode: "fixed", target: {0,0}, zoom: 1 }` = GATHER_CENTER)와 `tutorialCameraOf(n)`(2·5·6 → 고정, 그 밖 undefined). GameMap 의 scene useMemo 가 `camera` prop 이 있을 때만 sceneLook 결과의 camera 칸을 덮는다. TutorialScreen 이 `camera={tutorialCameraOf(cur.n)}` 를 넘긴다.
- `src/world/presence.ts` 는 4a5dabea 대비 diff 0 이다. `tutorialCameraOf` 는 `CameraMode` 를 type-only import 하고 camera.ts 를 import 하지 않는다(정적 가드 통과). 단위 시험이 target 이 GATHER_CENTER 와 같음을 고정한다.

## TDD 증거 (RED)

`gsd_run check tdd-red-evidence` 결과 두 번 모두 `RED_EVIDENCE_OK`(`target_test_failed`).

Task 1 RED (`05637205`) — `npx vitest run test/client/tutorialScreen.test.tsx test/client/tutorialGate.test.tsx --reporter=tap-flat`: 55 개 중 6 개 실패, 장면 2~6 각각 단언 `expected 1 to be 0`(`[data-world-panel]` 등 DOM 에 남음)과 tutorialGate 장면 6 의 "패널이 DOM 에 없다". 의미 점검: 대상 시험이 실행되어 계획한 단언(패널·[내 역할] 개수 0)에서 실패했다. import·타입·fixture 오류 아님. 실제 판 불변 시험은 RED 에서도 통과(패널 1개).

Task 2 RED (`ac08179f`, 자리 함수 `tutorialCameraOf` 는 늘 undefined) — 같은 reporter 로 96 개 중 5 개 실패: 단위 `장면 2·5·6 은 고정 카메라`(`expected false to be true`)와 클라이언트 `scene.camera` 가 장면 2·5 에서 `follow`. 장면 6 클라이언트 시험과 3·4 시험은 RED 에서도 통과한다(실제 판 sceneLook 이 지목 단계에서 이미 고정이고 errand 가 follow 라서) — 회귀 방지 시험으로 남는다.

GREEN: `8f924f17`(Task 1), `5bb3eee2`(Task 2). `npm run typecheck` 오류 0, `npm test` 7979 통과·261 건너뜀(마지막 실행 기준).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 차단] RED 시험 단언을 한 줄 메시지로**
- **Found during:** Task 1·2 RED
- **Issue:** `toHaveLength`·`toBeNull`·`toEqual` 단언이 DOM 덤프·이스케이프된 JSON 을 YAML 블록에 넣어 TAP 분류기가 `invalid_record`(Non-TAP data)로 거부했다.
- **Fix:** 시험 단언을 `.length` `toBe(0)`, 불리언 `toBe(true)` 같은 한 줄 비교로 바꿨다(시험 의도 동일).
- **Files modified:** test/client/tutorialScreen.test.tsx, test/client/tutorialGate.test.tsx, test/unit/tutorialScript.test.ts
- **Commit:** RED 커밋에 처음부터 반영

**Total deviations:** 1 auto-fixed (시험 표현). **Impact:** 없음.

## Issues Encountered

- `npm test` 전체를 처음 돌렸을 때 파일 1개 시험 1건이 실패했다가, 같은 코드로 재실행한 두 번은 모두 통과했다(7979 통과). 이 계획의 변경과 무관한 시간 의존 불안정으로 보며 원인 파일은 첫 실행 출력이 잘려 확인하지 못했다.
- 위생 검사(`git grep -nIiE "torder|티오더|조직|회사|~/project"`)가 `test/unit/gameRoom.test.ts` 635·636행(`seatOrdered` 변수명의 우연한 일치)을 잡는다. 이 계획이 만든 것이 아니고 범위 밖이라 두었다. 이 계획이 건드린 파일은 0 건이다.

## Known Stubs

None.

## Threat Flags

None — 새 네트워크·인증·파일 접근 경로 없음(T-18-07·T-18-08 은 정적 가드·실제 판 패널 시험·presence.ts diff 0 으로 확인).

## 다음 계획에 넘길 것

- 18-08: 고정 카메라 `target`(지금 GATHER_CENTER 와 같은 {0,0})과 도윤 자리(TUTORIAL_SPOTS[1])를 폰 6종 측정으로 조정. 늘어난 스테이지에서 FocusRing·눈 표시·선이 DOM 사각형을 다시 재는지 렌더로 확인.

## Self-Check: PASSED

- 수정 파일 6개 존재, 커밋 4개(05637205, 8f924f17, ac08179f, 5bb3eee2) 모두 HEAD 의 조상.
- 인수 기준: `panelless?: boolean` 1, TutorialScreen `panelless` 1, `roleCard=` 0, `TUTORIAL_FIXED_CAMERA` export 1, `camera?: CameraMode` 1, `tutorialCameraOf(cur.n)` 1, presence.ts diff 0, 각 task 의 vitest·typecheck 통과.
