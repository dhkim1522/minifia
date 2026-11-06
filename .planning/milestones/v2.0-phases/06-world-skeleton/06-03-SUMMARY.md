---
phase: 06-world-skeleton
plan: "03"
subsystem: ui
tags: [camera, orthographic, projection, webgl-context-loss, state-machine, tdd, vitest]

requires:
  - phase: 06-world-skeleton/06-02
    provides: "shared/game/map.ts 의 WALK_HALF(5.8)·HEAD_TOP_Y(2.0335) — 가시성 검사가 걷는 영역 전체를 돈다"
provides:
  - "src/world/camera.ts — three 없는 정사영 카메라 수학: cameraBasis, groundToScreen, screenToGround, screenRay, stageRect, stageOffsetY, clampTarget, followStep 과 상수 PX_PER_UNIT 58.2·PAN_BOX ±4.8·PLATE_FAR 18.5·STAGE_SIZES 6개"
  - "src/world/status.ts — WebGL 맵 상태기계 mapStatusReducer(loading/ready/lost/recreating/failed/loadFailed/unsupported), shouldRecreate, inputBlocked, isSoftwareRenderer, MAP_STATUS_COPY"
  - "test/unit/camera.test.ts 44개(가시성 6크기 × 2304 격자점, 빈 배경 6크기 × 9목표 × 49표본) · test/unit/status.test.ts 41개"
affects: [06-10 three 렌더러(판 크기·카메라 상수·Vector3.project 대조), 06-12 E2E(이름표 실제 폭 대조), 06-13 월드 런타임(상태기계 효과 연결), 7페이즈 채팅 패널]

plan_head_before: 9eb26ef612e3612ca3a5be73563a8f1aa72475d1
plan_head_after: d2b40ebb36db2be9ea0a5dacd15025b94f78053b

actuals:
  tokens: 11700
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "순수 모듈 + 시각은 이벤트 인자로만 받는 리듀서(linkReducer 선례), 같은 상태면 같은 객체를 돌려준다"
    - "상수의 근거를 테스트가 도출한다: PAN_BOX 는 '0.1 단위 가장 좁은 통과값', PLATE_FAR 는 '0.5 단위 최소 + 2' 를 테스트가 다시 계산해 고정"
    - "RED 증거는 tap-flat + 단일 대상 -t, 한 줄 단언 메시지를 가진 테스트를 대상으로 삼는다"

key-files:
  created:
    - src/world/camera.ts
    - src/world/status.ts
    - test/unit/camera.test.ts
    - test/unit/status.test.ts
  modified: []

key-decisions:
  - "PAN_BOX = ±4.8, PLATE_FAR = 18.5 (근거 표는 아래). 계획의 '통과하는 가장 넓은 값' 은 방향이 거꾸로라 '가장 좁은 통과값' 으로 정했다"
  - "소실 중 다시 보였는데(visible, contextLost true) 여전히 소실이면 숨겨 둔 시간은 세지 않고 그 시각부터 새로 센다. recreating 중에는 시계를 되돌리지 않는다(재생성 한 번)"
  - "loading 중 소실·복구 이벤트는 무시한다 — 불러오기 실패는 loadError 로만 알린다. loadFailed 는 retry 로만 나간다"
  - "tick 이 듬성듬성 와서 lost 에서 곧바로 5초를 넘기면 재생성 없이 failed 로 간다(shouldRecreate false)"
  - "MAP_STATUS_COPY.action 은 버튼 글자만 두고 대괄호를 붙이지 않는다(UI-SPEC 의 [다시 시도] 는 버튼 표기)"

patterns-established:
  - "카메라 기저: back = 정규화(위치 − 주시점) = (0.5793, 0.5735, 0.5793), right = (√½, 0, −√½), up = (−0.4055, 0.8190, −0.4055). 바닥 1단위 이동 = 가로 41.15px 또는 세로 23.6px"
  - "스테이지 오프셋 offsetY = H/2 − (top + bottom)/2 (390×844 → 13). 양수면 장면이 위로 올라간다"

requirements-completed: [MAP-03, MAP-05]

coverage:
  - id: D1
    description: "정사영 투영·역투영이 서로의 역이고(20점 × 6크기, 1e-6), 1단위가 58.2px, 스테이지 오프셋 13 을 반영한다"
    requirement: MAP-03
    verification:
      - kind: unit
        ref: "test/unit/camera.test.ts#screenToGround, #groundToScreen, #스테이지 사각형과 세로 오프셋"
        status: pass
    human_judgment: false
  - id: D2
    description: "followStep 이 350ms 에 거리의 90% 를 줄이는 프레임 독립 감쇠이고 모션 줄이기면 즉시 붙는다"
    requirement: MAP-03
    verification:
      - kind: unit
        ref: "test/unit/camera.test.ts#followStep (프레임 독립 감쇠, UI-SPEC E4)"
        status: pass
    human_judgment: false
  - id: D3
    description: "걷는 영역 0.25 간격 전 격자점(2304점) × 6개 폰 크기에서 발과 이름표(180×24)가 스테이지 사각형 안에 있다"
    requirement: MAP-03
    verification:
      - kind: unit
        ref: "test/unit/camera.test.ts#가시성: 걷는 영역 전 격자점 × 6개 폰 크기 (visible 360x640 … visible 402x874)"
        status: pass
    human_judgment: false
  - id: D4
    description: "PAN_BOX 9개 목표 × 스테이지 7×7 표본 광선이 모두 연장 판(PLATE_FAR) 안 바닥에 닿아 빈 배경이 없다"
    requirement: MAP-03
    verification:
      - kind: unit
        ref: "test/unit/camera.test.ts#빈 배경 없음 (blank 360x640 … blank 402x874)"
        status: pass
    human_judgment: false
  - id: D5
    description: "WebGL 소실→3초 재생성(한 번)→5초 실패, 복구, 불가 기기, 숨김 중 소실이 순수 리듀서로 판정되고 카드 문구가 UI-SPEC 과 글자 그대로 같다"
    requirement: MAP-05
    verification:
      - kind: unit
        ref: "test/unit/status.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "실제 폰에서 이름표 폭이 가정 A1(180px) 안인지, 연장 판 위 안개가 어색하지 않은지"
    verification: []
    human_judgment: true
    rationale: "이름표의 실제 폭은 06-12 E2E 가 재고, 판·안개의 시각 품질은 06-10 렌더러가 만든 뒤에야 눈으로 판단할 수 있다"

duration: 6min
completed: 2026-10-31
status: complete
---

# Phase 6 Plan 03: 정사영 카메라 수학과 WebGL 맵 상태기계 Summary

**three 없는 정사영 카메라 수학(58.2 px/단위 투영·역투영·스테이지 오프셋·감쇠)과, 6개 폰 크기 × 걷는 영역 2304점 검사로 확정한 이동 한계 ±4.8·연장 판 반폭 18.5, 그리고 소실·3초 재생성·5초 실패를 판정하는 WebGL 맵 상태기계를 순수 모듈 두 개로 확정했다.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-31T15:41:55Z
- **Completed:** 2026-10-31T15:48:12Z
- **Tasks:** 3 (트레이서 1 + auto 2, 모두 TDD)
- **Files modified:** 4 (모두 신규)

## Accomplishments

- `camera.ts`: `groundToScreen`/`screenToGround`/`screenRay` 가 `cameraBasis`(right·up·back) 하나에서 나오고, 바닥 점 20개 × 폰 6개 왕복 오차가 1e-6 미만이다. 390×844 에서 `stageOffsetY` = 13, 주시점이 캔버스 가운데(195, 422)로 간다.
- 걷는 영역 `[−5.8, 5.8]²` 의 0.25 간격 2304점(끝점 5.8 포함) × 6개 폰 크기에서 발과 이름표 상자(180×24, 머리 위 4px)가 스테이지 사각형 안에 있다. 시작값 ±4.0 은 54점(최악 58.2px)이 넘쳤다.
- 이동 한계 상자의 9개 목표 × 스테이지 7×7 표본 광선이 모두 `|x|,|z| ≤ 18.5` 안에 닿는다(빈 배경 없음). 캔버스 맨 위 줄(헤더 가림막 뒤)도 같은 판 안이다.
- `status.ts`: 소실 3000ms 에 `recreating`(소실 한 번에 정확히 한 번, 1ms tick 5100번을 흘려도 한 번), 5000ms 에 `failed`, `unsupported`·`failed` 는 끝, 소프트웨어 렌더러 세 이름 판정, 카드 문구 5종 글자 그대로.
- `npm run typecheck` 종료 0, 유닛 프로젝트 전체 52파일 1487 테스트 통과.

## 확정한 상수 (06-10 렌더러가 그대로 쓴다)

| 상수 | 값 | 근거 |
|------|----|------|
| `PAN_BOX` | 축마다 ±4.8 (minX −4.8 · maxX 4.8 · minZ −4.8 · maxZ 4.8) | 가시성을 통과하는 가장 좁은 0.1 단위 값. 폭 360 두 크기가 정했다 |
| `PLATE_FAR` | 18.5 (판 한 변 37) | 빈 배경 검사 최소 0.5 단위 값 16.5 + 여유 2 |
| `NAMETAG_MAX_W` × `NAMETAG_H` × `NAMETAG_GAP` | 180 × 24, 머리 위 4px | 가정 A1 (06-12 E2E 가 실제 폭을 잰다) |

크기별 필요 pan 과 가장 먼 바닥 점(`CAMERA_PRINT=1 npx vitest run --project unit test/unit/camera.test.ts -t "근거 표" --silent=false --reporter=verbose` 로 다시 출력):

| 폰 | 스테이지 | 가시성에 필요한 최소 pan | 판이 덮어야 하는 가장 먼 점(PAN ±4.8 목표) |
|----|----------|------------------------|--------------------------------------------|
| 360×640 | 360×490 | **4.8** (한계를 정함) | (−8.41, −12.78) |
| 360×560 | 360×410 | **4.8** (한계를 정함) | (−7.56, −11.94) |
| 390×664 | 390×514 | 4.6 | (−8.48, −13.22) |
| 390×844 | 390×694 | 4.6 | (−10.39, −15.13) |
| 402×874 | 402×724 | 4.5 | (−15.52, −10.63) |
| 430×932 | 430×782 | 4.3 | **(−16.30, −11.08)** (판 크기를 정함) |

한계를 정한 점: 걷는 영역 모서리 (5.8, −5.8) 근처. 폭 360 에서는 이름표 반폭 90px 를 빼면 가로 여유가 90px 뿐인데, 모서리에서 카메라가 멈추면 캐릭터가 가운데에서 `41.15 px × |dx − dz|` 만큼 벗어난다(pan 4.0 이면 148px). 세로는 360×560(스테이지 410)에서도 여유가 있어 한계를 정하지 않았다.

## Task Commits

1. **Task 1 트레이서: 투영·역투영·오프셋·한계·감쇠** — RED `da5fbe5` (test), GREEN `b661495` (feat)
2. **Task 2: 6개 폰 크기 × 전 격자점, PAN_BOX·PLATE_FAR 확정** — RED `0d7235a` (test), GREEN `2dac0a7` (feat)
3. **Task 3: 맵 상태기계와 카드 문구** — RED `1825920` (test), GREEN `d2b40eb` (feat)

**Plan metadata:** 이 SUMMARY 와 STATE/ROADMAP/REQUIREMENTS 를 담은 docs 커밋.

REFACTOR 커밋은 없다(각 GREEN 에서 한국어 JSDoc 을 함께 썼고 정리할 중복이 없었다).

## TDD Gate Compliance

세 작업 모두 `test(06-03)` → `feat(06-03)` 순서이고 각 RED 는 `gsd_run check tdd-red-evidence` 로 `RED_EVIDENCE_OK`(tap-flat, 단일 대상 `-t`)를 받았다.

| RED 대상 테스트 | 실패한 단언(semanticAssessment) |
|---|---|
| Task 1 `stageOffsetY(844, 62, 844−88) = … = 13` | 뼈대 `stageOffsetY` 가 0 을 돌려줘 `expected +0 to be 13` |
| Task 2 `visible 360x640` | PAN ±4.0 에서 이름표가 스테이지 오른쪽 밖으로 최대 58.2px 넘치는 점 54개(`expected 54 to be +0`) |
| Task 3 `소실 한 번에 일어나는 재생성은 정확히 한 번이다` | 뼈대 리듀서가 상태를 바꾸지 않고 `shouldRecreate` 가 항상 false 라 `expected +0 to be 1` |

RED 커밋의 뼈대(Task 1: 틀린 값을 돌려주는 함수, Task 3: 상태를 안 바꾸는 리듀서·빈 문구)는 같은 작업의 GREEN 에서 모두 실제 구현으로 바뀌었다. Task 2 의 RED 는 Task 1 GREEN 이 이미 넣은 `STAGE_SIZES` 와 시작값 ±4.0 으로 실패했다.

## Files Created/Modified

- `src/world/camera.ts` — 상수, `cameraBasis`·`stageRect`·`stageOffsetY`·`groundToScreen`·`screenRay`·`screenToGround`·`clampTarget`·`followStep`. 계획의 export 목록에 `NAMETAG_GAP`, `V3`, `Canvas` 를 더했다.
- `src/world/status.ts` — 타입, `RECREATE_AFTER_MS`·`FAIL_AFTER_MS`, `initialMapStatus`, `mapStatusReducer`, `shouldRecreate`, `inputBlocked`, `isSoftwareRenderer`, `MAP_STATUS_COPY`
- `test/unit/camera.test.ts` — 44개. `CAMERA_PRINT=1` 일 때만 크기별 근거 표를 출력한다.
- `test/unit/status.test.ts` — 41개. 소스에 Date.now·난수·타이머·location 이 없음을 문자열 테스트로 고정한다.

## Decisions Made

- **PAN_BOX ±4.8** (편차 1). **PLATE_FAR 18.5**.
- `visible` 이벤트: ready 면 `lost(at)`, 이미 lost 이고 `at` 이 더 늦으면 소실 시계를 `at` 으로 다시 시작(숨겨 둔 시간은 세지 않음, linkReducer 의 visibility 규약과 같다), recreating 이면 그대로, `contextLost` false 는 어느 상태에서도 그대로(복구는 `restored` 로만).
- `loading` 중 소실·복구·재생성·tick 은 무시, `loadFailed` 는 `retry` 로만 나간다, `unsupported` 는 `loading` 에서만 들어간다. 06-13 런타임은 불러오는 중 컨텍스트가 죽으면 `loadError` 를 보내야 한다.
- 이름표 상자의 가운데는 머리 꼭대기 투영 x, 아래 끝은 머리 꼭대기 y 위 4px 로 계산한다(`NAMETAG_GAP`). 06-10 의 이름표 배치도 같은 값을 쓴다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 계획 논리 오류] PAN_BOX 를 "통과하는 가장 넓은 값" 으로 정하라는 지시**
- **Found during:** Task 2 (RED 가 pan 4.0 에서 실패하는 방향을 보고)
- **Issue:** 계획은 "±4.0 에서 시작해 가시성 검사가 통과하는 가장 넓은 값(0.1 단위)" 이라 했지만 이동 한계가 넓을수록 카메라가 캐릭터를 더 멀리까지 따라가 캐릭터가 가운데에 가까워진다. 즉 가시성은 pan 이 클수록 쉬워지고(5.8 이면 항상 통과) "가장 넓은 통과값" 은 한계 없음(5.8)이다. 줄이는 쪽(좁히는 쪽)이 실패하는 방향이다. 같은 이유로 "pan 을 아무리 줄여도 통과하지 않는 크기가 있으면 멈춰 보고" 조건은 성립하지 않는다(pan 을 줄이는 것이 아니라 늘려야 한다). 빈 배경은 판 크기로 해결되므로 pan 의 상한 압력이 없다.
- **Fix:** UI-SPEC 의 의도("카메라는 맵 한 화면보다 조금 넓게 따라가고, 어두운 바깥으로는 덜 나간다")에 맞춰 가시성을 통과하는 **가장 좁은** 0.1 단위 값 4.8 을 PAN_BOX 로 정했다. 테스트가 "4.7 로 좁히면 어느 한 크기가 넘친다" 를 함께 고정한다. 이동 한계 ±5.8(사용자 확정)은 건드리지 않았고, 멈춰 보고할 크기는 없었다.
- **Files modified:** src/world/camera.ts, test/unit/camera.test.ts
- **Committed in:** 2dac0a7

**2. [Rule 1 - 계획 값 갱신] PLATE_FAR 시작값 30 → 18.5**
- **Found during:** Task 2 GREEN
- **Issue:** 계획 규칙("통과하는 가장 작은 값 + 여유 2")을 pan 4.8 에 적용하면 가장 먼 점이 (−16.30, −11.08)이라 최소 16.5, 곧 18.5 다. 시작값 30 은 필요 이상으로 크다(판 한 변 60 대 37).
- **Fix:** 규칙대로 18.5. 테스트가 "최소 0.5 단위 값 + 2" 를 다시 계산해 고정한다.
- **Files modified:** src/world/camera.ts, test/unit/camera.test.ts
- **Committed in:** 2dac0a7

**3. [Rule 3 - 보완] 계획 export 목록 밖의 `NAMETAG_GAP`·`V3`·`Canvas`**
- **Found during:** Task 1·2
- **Issue:** 이름표 아래 끝과 머리 꼭대기 사이 4px 가 계획에 값으로만 있어 상수로 이름이 필요했고, `cameraBasis`·`screenRay` 의 시그니처가 `V3` 를 쓴다.
- **Fix:** 세 이름을 export 에 더했다. 목록의 기존 이름·시그니처는 그대로다.
- **Committed in:** b661495, 2dac0a7

**4. [순서 편차] STAGE_SIZES 를 Task 1 GREEN 에서 채움**
- 계획은 Task 2 에서 `STAGE_SIZES` 를 다룬다. 시그니처 한 줄이라 Task 1 에서 함께 채웠고, Task 2 의 RED 는 pan ±4.0 으로 정상적으로 실패했다. 영향 없음.

---

**Total deviations:** 3 auto-fixed (3 × Rule 1·3) + 순서 편차 1
**Impact on plan:** 공개 이름·시그니처는 계획과 같고(추가 3개), 상수 두 값만 테스트가 도출한 값으로 정해졌다. 범위 확장 없음.

## Issues Encountered

- `-t` 필터는 정규식이라 `stageOffsetY(844, …)` 를 이스케이프하지 않으면 전부 SKIP 이 되어 첫 RED 시도가 종료 0 이었다. 괄호를 이스케이프해 해결했다.
- macOS `sed -i` 가 인자 없이 실패해 Task 3 RED 테스트 제목의 "1000번"(실제 5100번) 오타 수정이 GREEN 커밋으로 넘어갔다. RED 증거는 커밋된 제목 기준으로 이미 `RED_EVIDENCE_OK` 였다.

## Known Stubs

없음. RED 커밋의 뼈대는 같은 작업의 GREEN 에서 모두 구현으로 바뀌었다.

## Threat Flags

없음. 새 네트워크·인증·파일 접근 표면이 없다(순수 모듈, 저장소·네트워크 미사용: T-06-07 수용). T-06-06(재생성 폭주)는 완화됨: `shouldRecreate` 가 lost → recreating 전이에서만 참이고, 1ms tick 5100번·소실 반복 시나리오에서도 소실당 정확히 한 번이며, 5초 뒤 `failed` 로 끝난다. T-06-SC(패키지 설치 없음) 해당 없음.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 06-10 은 `camera.ts` 의 상수로 three `OrthographicCamera`(프러스텀 높이 = 캔버스 높이 ÷ 58.2)를 만들고, `Vector3.project` 결과가 `groundToScreen` 과 같음을 증명하면 된다. 연장 판은 y = −0.01, 반폭 `PLATE_FAR` 18.5 의 정사각형 한 장이다(걸을 수 없는 영역, 먼 가장자리는 안개).
- 06-12 E2E 는 이름표 실제 폭을 잰다. 180px 를 넘으면 `NAMETAG_MAX_W` 를 고치고 가시성 테스트를 다시 돌려 `PAN_BOX` 를 갱신해야 한다(폭 360 폰이 한계를 정하므로 폭이 커질수록 pan 이 5.8 에 가까워진다: 반폭 100 이면 약 4.9).
- 06-13 런타임은 `mapStatusReducer` 에 `tick`(예: 250ms 간격)·`lost`/`restored`/`recreated`·`visible` 을 넣고, `shouldRecreate(prev, next)` 가 참일 때만 렌더러를 한 번 다시 만든다. 불러오는 중 컨텍스트가 죽으면 `loadError` 를 보낸다.
- 7페이즈 채팅 패널이 자라면 `stageRect(c, panelHeight)` 에 패널 높이를 넘긴다. 이때 짧은 폰(360×560)의 스테이지가 줄어드는 만큼 가시성 테스트를 새 패널 높이로 다시 돌려야 한다(UI-SPEC 이월).

## Self-Check: PASSED

- 파일 존재: src/world/camera.ts, src/world/status.ts, test/unit/camera.test.ts, test/unit/status.test.ts
- 커밋 존재: da5fbe5, b661495, 0d7235a, 2dac0a7, 1825920, d2b40eb (모두 HEAD 의 조상)
- 인수 기준: Task 1·2·3 의 grep 명령 모두 통과(`402x874` 2회, three import 0, `RECREATE_AFTER_MS = 3000` 등)
- 계획 검증: `npx vitest run --project unit test/unit/camera.test.ts test/unit/status.test.ts` 85 중 84 통과 1 건너뜀(근거 표 출력은 `CAMERA_PRINT=1` 일 때만), `npm run typecheck` 종료 0, 유닛 전체 1487 통과

---
*Phase: 06-world-skeleton*
*Completed: 2026-10-31*
