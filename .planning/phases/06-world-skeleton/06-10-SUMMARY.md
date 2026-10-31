---
phase: 06-world-skeleton
plan: "10"
subsystem: world-renderer
tags: [three, orthographic-camera, merged-geometry, vertex-colors, shadow-bake, degrade-ladder, webgl-context, tdd]

requires:
  - phase: 06-world-skeleton
    provides: "06-03 camera.ts(PX_PER_UNIT·CAM_*·LOOK_Y·PLATE_FAR·STAGE_SIZES·groundToScreen·screenToGround)·status.ts(isSoftwareRenderer), 06-04 three 0.186.1 고정·v2 토큰"
provides:
  - "src/world/renderer.ts: WorldRenderer 인터페이스·Budget·LADDER(0~5)·nextLadderStep·pixelRatioFor·DRAW_CALL_BUDGET 120·CharacterKit/CharacterHandle(three 값 import 없음)"
  - "src/world/threeCamera.ts: camera.ts 와 같은 값을 내는 three 정사영 카메라(createCamera·configureCamera)"
  - "src/world/maps/bar.ts: 지하 재즈 바 병합 장면(buildBarScene)·LIGHT_TUNE·talk/vote 조명·applyBudget·링/손짓 링·연장 판"
  - "src/world/palette.ts: 3D 색 상수와 토큰 4색 연결"
  - "src/world/threeRenderer.ts: createThreeRenderer(WebGLRenderer·정적 그림자·소프트웨어 거부·소실/복구 알림·setBudget·recreate·info·debug 훅·dispose)"
affects: [06-11-character, 06-13-runtime, 06-14-perf-spike, 06-18-e2e, 06-19-device-gate]

actuals:
  tokens: 18580
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "맵 = 재질별·버텍스 컬러 병합 메시 10~11개(보이는 기준), 고유 재질 12, 삼각형 약 9.4k"
    - "emissive 는 MeshBasicMaterial + 정점에 굽는 색×밝기, 단계별 밝기는 재질 color 배율"
    - "빛 무리 = 카메라를 향해 미리 돌린 쿼드 병합 + Uint8Array DataTexture(정점 알파로 개별 밝기)"
    - "맵 그림자는 autoUpdate false, 조명 단계·예산·복구·재생성에서만 needsUpdate"
    - "렌더러 인터페이스 뒤에 three 를 가둠(탈출구, 결정 0046), 렌더러는 recreate 로 교체해도 씬 그래프를 재사용"
    - "WebGLRenderer 를 vi.mock 한 가짜 GL 로 예산·재생성·해제 경로를 node(happy-dom)에서 검사"

key-files:
  created:
    - src/world/renderer.ts
    - src/world/threeCamera.ts
    - src/world/threeRenderer.ts
    - src/world/maps/bar.ts
    - src/world/palette.ts
    - test/unit/cameraThree.test.ts
    - test/unit/barScene.test.ts
    - test/unit/palette.test.ts
    - test/unit/ladder.test.ts
  modified: []

key-decisions:
  - "emissive 는 MeshStandardMaterial.emissive 가 정점 색을 곱하지 않아 병합하면 색이 하나뿐이므로 MeshBasicMaterial+버텍스 컬러로 구현(밝기는 재질 color 배율)"
  - "BarScene.root 는 THREE.Scene 자체(배경·안개·조명 포함) — 5단계 '안개 null' 을 장면에서 직접 검사"
  - "펜던트 점광원은 core 에서 세기 0 + visible false(셰이더 광원 수까지 줄인다). info().pointLights 는 보이는 PointLight 수"
  - "applyBudget 은 BarScene 에 둬 node 에서 검사 가능, 그림자 맵 크기가 바뀌면 shadow.map dispose 후 null"
  - "캐릭터 자원은 만든 쪽(handle.dispose)이 정리, 렌더러 removeCharacter/dispose 는 장면에서 떼기만 한다"

patterns-established:
  - "RED 증거: vitest tap-flat 출력을 gsd_run check tdd-red-evidence 에 넘긴다. 여러 줄 diff 메시지가 섞이면 TAP 이 깨지므로 스칼라 단언 한 테스트를 -t 로 골라 돌린다"
  - "ladder.test.ts 처럼 파일 머리 docblock(@vitest-environment happy-dom)과 vi.mock('three') 로 WebGL 없는 렌더러 검사"

requirements-completed: [MAP-01, MAP-03]

coverage:
  - id: D1
    description: "three 정사영 카메라가 camera.ts 순수 수학과 같은 화면 좌표(폰 6개 × 점 50개, 0.01px)·바닥 교점(1e-4)·프러스텀을 낸다"
    requirement: MAP-03
    verification:
      - kind: unit
        ref: "test/unit/cameraThree.test.ts#임의 점 50개 × 폰 6개 / Raycaster 바닥 교점 / 프러스텀 높이 / offsetY"
        status: pass
    human_judgment: false
  - id: D2
    description: "지하 재즈 바가 bar.js 좌표 그대로 병합 장면(보이는 메시 10~11, 재질 12, 앞쪽 높이 검사 통과, 연장 판 반폭 18.5)으로 만들어진다"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "test/unit/barScene.test.ts#재즈 바 장면 구조"
        status: pass
    human_judgment: true
    rationale: "시안과의 분위기·밝기 일치(LIGHT_TUNE 시작값 A1)는 06-14 가 화면을 찍어 승인 보드와 나란히 맞춘다. 단위 테스트는 구조·예산만 증명한다"
  - id: D3
    description: "talk/vote 조명 단계, 점광원 3·반구 1·달빛 1(그림자 1024 한 번만 굽기), 링·손짓 링 두 겹, 3D 색 4개가 토큰과 같음"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "test/unit/barScene.test.ts#조명 단계 · 목적지 링, test/unit/palette.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "강등 사다리 6단계·자동 강등 판정(0~3 만)·예산 재생성 없이 반영·recreate(같은 씬 재사용)·통계·해제·소프트웨어 렌더러 거부"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "test/unit/ladder.test.ts"
        status: pass
    human_judgment: true
    rationale: "가짜 WebGLRenderer 로 호출 순서만 증명한다. 진짜 컨텍스트 소실→재생성→첫 프레임 픽셀과 실기기 55fps 는 06-18 E2E·06-14/06-19 가 확인한다(가정 A2)"

duration: 12min
completed: 2026-11-01
status: complete
plan_head_before: 865283009ff53a53c6403cac8c6110338ae62241
plan_head_after: 3a9a72b37e0314afe17b8c7abe65633f21a6bc33
---

# Phase 6 Plan 10: three 정사영 카메라와 지하 재즈 바 병합 장면 Summary

**camera.ts 와 같은 값을 내는 three 정사영 카메라, bar.js 좌표를 재질별 버텍스 컬러 병합으로 옮긴 지하 재즈 바(보이는 메시 10~11·재질 12·삼각형 약 9.4k·점광원 3), 정적 그림자·강등 사다리 0~5·재생성 가능한 WebGL 렌더러 — 모두 WorldRenderer 인터페이스 뒤에서 node 로 검사된다.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-31T16:37:14Z
- **Completed:** 2026-10-31T16:49:43Z
- **Tasks:** 3 (Task 1 tracer, Task 2·3 auto, 모두 tdd)
- **Files:** 신규 9(소스 5·테스트 4), 수정 0

## Accomplishments

- **카메라(MAP-03):** `configureCamera` 가 `PX_PER_UNIT`·`CAM_*`·`LOOK_Y` 로 OrthographicCamera 를 구성(setViewOffset 로 offsetY). 폰 6개 × (offsetY 0, stageOffsetY) × 목표 2 × 점 50개에서 `Vector3.project` 가 `groundToScreen` 과 0.01px 이내, Raycaster 바닥 교점이 `screenToGround` 와 1e-4 이내.
- **재즈 바(MAP-01):** bar.js 의 바닥·벽·블라인드 창·바 카운터·술병 33·스툴 4·피아노·무대(놋쇠 테두리·서는 자리 8·마이크·전구 20)·탁자 5·의자 10·펜던트 2·벽등 4 를 원문 좌표로. 앞쪽(x+z>4)에 높이 1.2 초과 정점 없음.
- **예산:** 보이는 메시 talk 10 / vote 11(≤40), 고유 재질 12(≤12), 삼각형 약 9.4k. 캐릭터 8명(1인 ≤7 = 56)을 더해도 약 67 ≤ DRAW_CALL_BUDGET 120(그림자 패스는 한 번만 굽는다). 점광원 3 + 반구 1 + 달빛 1.
- **연장 판·안개:** 바닥 아래 y −0.01 정사각형 한 장(반폭 PLATE_FAR 18.5), 안개 20~44 가 먼 가장자리를 단계 배경색에 녹인다.
- **링·손짓 링:** 반지름 0.45·굵기 0.04·gray-50 + 윤곽 0.5·0.05·night-950(0.6), MeshBasicMaterial 두 겹, 바닥에 눕힘(x 축 −π/2), 처음엔 숨김.
- **사다리:** LADDER 6단계 누적, `nextLadderStep` 은 45fps 미만이면 0→3 까지만, `pixelRatioFor` = min(장치, 상한). `applyBudget` 으로 먼 소품(보이는 메시 −3)·펜던트 점광원·빛 무리·안개·그림자 맵 크기를 되돌릴 수 있게 반영.

사다리 단계별 보이는 메시 / 삼각형(talk): 0~3 → 10 / 9,428, 4 → 7 / 7,968, 5 → 6 / 7,948.

## Task Commits

1. **Task 1 (tracer): 카메라·렌더러 골격** — RED `852cf41` (test) → GREEN `1b7d3ae` (feat)
2. **Task 2: 재즈 바 장면·조명·링·팔레트** — RED `51562e6` (test) → GREEN `c198688` (feat)
3. **Task 3: 사다리·예산·재생성·통계** — RED `55c7db0` (test) → GREEN `3a9a72b` (feat)

**Plan metadata:** 이 SUMMARY 커밋(docs)

## TDD Gate Compliance

세 task 모두 RED(`test(06-10)`) → GREEN(`feat(06-10)`) 순서. REFACTOR 커밋 없음.

| Task | RED 증거 | semanticAssessment |
|------|----------|--------------------|
| 1 | `gsd_run check tdd-red-evidence` → RED_EVIDENCE_OK. 대상: 폰 6개×점 50개 project 차이 ≤0.01px, 8개 중 6개 실패 | 스텁 `configureCamera` 가 아무것도 안 해 차이 132.03px 로 계획한 단언이 실패(임포트·문법 오류 아님) |
| 2 | RED_EVIDENCE_OK. 대상: "점광원 3 · 반구광 1 · 달빛 방향광 1", 18개 중 15개 실패 | 빈 Scene 스텁이라 PointLight 0 개로 단언 실패 |
| 3 | RED_EVIDENCE_OK(대상: "화면 배율은 장치 배율과 단계 상한 중 작은 쪽", `-t` 로 단독 실행). 전체 실행에서는 21개 중 13개 실패 | 스텁 `pixelRatioFor` 가 1 을 돌려 "expected 1 to be 2" |

- Task 3 의 RED 는 전체 실행의 TAP 보고서에 여러 줄 diff 메시지(toEqual)가 섞여 분류기가 `invalid_record(Malformed TAP)` 로 거부했다. 테스트·구현은 그대로 두고, 스칼라 단언 한 테스트를 `-t` 로 단독 실행해 얻은 TAP 으로 RED_EVIDENCE_OK 를 받았다(증거 파일은 커밋하지 않고 지움). 테스트 커밋은 분류기 확인 전에 만들었지만 RED 상태(대상 테스트가 계획한 단언으로 실패)와 같은 트리를 분류했다.
- 각 RED 커밋에는 컴파일되는 스텁(타입·빈 구현)이 함께 들어 있다 — typecheck 가 각 커밋에서 통과하도록.

## Files Created/Modified

- `src/world/renderer.ts` — 인터페이스·예산·사다리·`nextLadderStep`·`pixelRatioFor`·`UnsupportedRendererError`·`CharacterKit`(three 는 import type 만)
- `src/world/threeCamera.ts` — `createCamera`·`configureCamera`
- `src/world/threeRenderer.ts` — `createThreeRenderer`(지연 로드 청크 전용)
- `src/world/maps/bar.ts` — `buildBarScene`·`LIGHT_TUNE`·`BarScene`·`MarkerRing`
- `src/world/palette.ts` — `PALETTE`·`TOKEN_COLORS`
- `test/unit/cameraThree.test.ts`·`barScene.test.ts`·`palette.test.ts`·`ladder.test.ts`

## Decisions Made

- **emissive = MeshBasicMaterial + 정점 색(색×밝기를 굽는다).** `MeshStandardMaterial.emissive` 는 버텍스 컬러를 곱하지 않아 병합하면 술병 4색·창유리·촛불을 한 메시에 못 담는다. 단계별 밝기는 재질 `color.setScalar` 배율. 시안과 달리 emissive 면이 조명을 받지 않는다(작은 구슬·유리라 영향 작음).
- **`BarScene.root` 가 Scene 자체**라 배경·안개·광원이 한 곳에 있고 5단계의 "scene.fog null" 을 그대로 검사한다.
- **점광원 core 는 세기 0 + `visible=false`** 로 셰이더 광원 수까지 줄인다(`info().pointLights` 는 보이는 PointLight 수).
- **`applyBudget` 을 BarScene 에 둠** — 그림자 맵 크기가 바뀌면 `shadow.map.dispose()` 후 `null`(three 는 map 이 있으면 크기를 다시 맞추지 않는다).
- 캐릭터 그룹은 렌더러의 `characters` Group 이 `bar.root` 아래 가진다. 캐릭터 자원 정리는 만든 쪽(06-11/06-13) 몫.

## Deviations from Plan

### Auto-fixed / 계획 해석

**1. [Rule 2 - 계획 의도 보강] 선반 아래 emissive 띠 추가**
- **Found during:** Task 2
- **Issue:** 시안의 카운터 위 점광원(0.8)을 점광원 예산(3개) 밖으로 빼면 카운터 쪽이 어두워진다. 계획은 "바 카운터 등은 emissive 로 굽기" 라고만 적었다.
- **Fix:** 선반 아래 얇은 띠(5.6×0.03×0.04, light-lamp)와 카운터 위 빛 무리 쿼드 하나를 더했다. 둘 다 소품 reduced 에서 빠지는 쪽(emissiveRoomFar)·빛 무리 묶음에 속한다.
- **Files modified:** src/world/maps/bar.ts
- **Verification:** barScene.test.ts(보이는 메시 ≤40, 앞쪽 높이 검사)
- **Committed in:** c198688

**2. [Rule 2 - 계획 의도 보강] talk 단계 무대 전구를 0.2 배로 켜 둠**
- **Found during:** Task 2 (map-bar.png 확인)
- **Issue:** 시안 그룹 vote 는 talk 에서 0 이라 전구가 검은 구슬로 보이는데, 승인 맵 이미지는 무대 테두리에 점선 구슬이 희미하게 보인다.
- **Fix:** `LIGHT_TUNE.talk.emissive.vote = 0.2` (A1 시작값, 06-14 가 맞춘다).
- **Committed in:** c198688

**3. [해석] Task 1 의 `LADDER` 는 한 단계만으로 시작**
- 계획은 Task 1 에서 "함수 골격과 기본 테스트", Task 3 에서 LADDER 6단계를 요구한다. Task 3 의 RED 가 실제로 실패하도록 Task 1·2 에서는 0 단계만 두고 Task 3 에서 채웠다.

**4. [범위 보강] `ladder.test.ts` 가 가짜 WebGLRenderer 로 렌더러 경로까지 검사**
- 계획의 `ladder.test.ts` 는 사다리 표·판정·node 장면 검사였다. recreate 순서(옛 렌더러 dispose·forceContextLoss·캔버스 교체·같은 씬 재사용·옛 캔버스 이벤트 차단), setBudget, info, debug 훅, dispose, 소프트웨어 렌더러 거부를 `vi.mock("three")` 로 같이 검사한다. 테스트 파일 수는 그대로(4개).

**5. [Rule 3 - 도구] 추가 export**
- `renderer.ts`: `RendererStatusEvent`(onStatus 이벤트 유니온 이름), `pixelRatioFor`, `AUTO_LADDER_MAX`·`AUTO_DEGRADE_FPS`. `bar.ts`: `MarkerRing`, `BarScene.meshes/exposure/applyBudget/budget`. 인터페이스(`<interfaces>`)에 적힌 이름과 모양은 그대로다.

---

**Total deviations:** 2 보강(Rule 2) + 3 해석/범위. **Impact:** 계획의 truths·인터페이스를 바꾸지 않고, 06-11(`CharacterKit`)·06-13(런타임)이 쓰는 면은 그대로다.

## Issues Encountered

- 테스트가 `import.meta.url` 로 소스 파일을 읽으면 happy-dom 환경에서 "URL must be of scheme file" 로 실패해 `process.cwd()` 기준 경로로 바꿨다.
- 위 TDD Gate 절의 TAP 분류 거부(Task 3).

## Authentication Gates

없음.

## Known Stubs

없음. (RED 커밋의 스텁은 같은 task 의 GREEN 커밋에서 모두 실제 구현으로 바뀌었다.)

## Threat Flags

없음 — 네트워크·인증·파일 접근 표면 추가 없음. 지오메트리·텍스처가 모두 코드 생성이고(`DataTexture`), 소스에 URL·로더·캔버스·fetch 가 없음을 `barScene.test.ts` 가 검사한다(T-06-24). 부하 완화(T-06-23)는 예산·사다리·자동 강등 판정까지이고 실기기 확인은 06-14·06-19.

## User Setup Required

없음.

## Next Phase Readiness

- **06-11(캐릭터):** `CharacterKit`/`CharacterHandle` 는 `src/world/renderer.ts` 에 계획 그대로. 렌더러는 `addCharacter(seat, handle)` 로 `handle.root` 를 `bar.root` 아래 그룹에 붙이고, 그림자는 캐릭터가 던지지 않는다(발밑 원판은 캐릭터 몫). 캐릭터는 보이는 메시 1인당 7 이하로 맞출 것(합 56 → 총 약 67 ≤ 120).
- **06-13(런타임):** `threeRenderer.ts` 는 `import()` 로만 연다(렌더러 인터페이스는 renderer.ts). 소실→3초→`recreate()`→`recreated`, `restored` 이벤트는 `MapStatusEvent` 와 같은 이름. 디버그 훅(`debugLoseContext/Restore`)은 `?e2e=1` 에서만 노출.
- **06-14(성능):** `LIGHT_TUNE`(A1 시작값)을 승인 보드와 나란히 놓고 맞출 것. `info()` 의 `calls`(그림자 패스 제외)·`pointLights` 로 예산을 잰다. 사다리는 `setBudget(step)`.
- 실제 WebGL 로 확인하지 못한 것(남은 위험): ① 새 렌더러로 같은 씬을 다시 쓸 때 three 가 자원을 다시 올리는지(A2) ② emissive 를 MeshBasicMaterial 로 바꾼 뒤의 밝기 균형 ③ 연장 판 위 안개 녹임 정도 ④ 그림자 bias(−0.0015)가 병합 메시에서도 여드름 없이 맞는지.

## Self-Check: PASSED

- 생성 파일 9개 모두 존재, 커밋 6개(852cf41·1b7d3ae·51562e6·c198688·55c7db0·3a9a72b) 모두 HEAD 의 조상.
- `npx vitest run test/unit/cameraThree.test.ts test/unit/barScene.test.ts test/unit/palette.test.ts test/unit/ladder.test.ts` 47개 통과, `--project unit` 전체 1683 통과(1 skip, 기존), `npm run typecheck` 통과.
- 각 task `<acceptance_criteria>` grep 통과, `evaluation-scope --plan 06-10 --commits-only` 가 이 브랜치의 커밋을 확인.

---
*Phase: 06-world-skeleton*
*Completed: 2026-11-01*
