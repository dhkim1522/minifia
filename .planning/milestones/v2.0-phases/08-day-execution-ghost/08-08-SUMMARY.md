---
phase: 08-day-execution-ghost
plan: "08"
subsystem: world-presence-camera
tags: [tdd, tracer, pure-module, presence, camera, zoom, ghost, execution-fade, nomination, lighting, tension]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-02 의 points·candidate 공개 필드와 DayView, 08-04 의 STAGE_SPOT·RING_SLOTS(ringSlots), 08-06 의 pointsTally·GHOST_RISE_MS·GHOST_FADE_END_MS
provides:
  - src/world/presence.ts(신규, three·DOM 없음) — 타입 LightingStage·CameraMode·Tension·SeatLook·SceneLook, 함수 visibleSeats·cameraModeOf·lightingOf·tensionOf·sceneLook·executionFade·ghostFloatY·stageLiftY·pointingOf·leaderShift, 상수 STAGE_TOP_R(1.18)·STAGE_TOP_Y(0.29)·GHOST_OPACITY(0.6)·EXEC_RISE_Y(1.2)·GHOST_BASE_Y(0.35)·GHOST_BOB_Y(0.08)
  - src/world/camera.ts — groundToScreen·screenRay·screenToGround 의 마지막 선택 인자 zoom(기본 1), GATHER_CENTER·ZOOM_MAJORITY(1.08)·ZOOM_MIN_STAGE_H(360)·GATHER_STACK_H(122)·GATHER_STACK_H_GHOST(154), gatherView(stage, canvas, {ghost, zoom}) → {target, offsetY}
  - test/unit/presence.test.ts(신규 80개), test/unit/camera.test.ts 에 zoom·gatherView 시험 추가
affects: [08-09 서버 쪽 유령 audience(위치를 보내지 않는 것은 서버 몫), 08-10 렌더러·캐릭터 확장(LightingPhase 확장, three 카메라 zoom 이 이 투영식과 같은 배율인지 cameraThree 시험으로 확인 — 가정 A1), 08-12 런타임 배선, 08-13 이후 화면]

actuals:
  tokens: 9800
  tasks: 3
  commits: 6
plan_head_before: 8e45c2c4282f1bc607070c276e94da908db9fd16
plan_head_after: 6e1fbb4ed17903ae499f4d9c95dc7b731264b273

tech-stack:
  added: []
  patterns:
    - "산 사람 viewer 의 좌석 표에는 탈락한 사람이 '숨김' 표시로도 없다 — 표에 키 자체가 없다(처형 연출이 끝나지 않은 좌석만 예외로 들어온다)"
    - "남의 지목은 서버가 공개한 값만 쓰고 내 낙관적 선택만 내 좌석 한 줄을 덮는다(내가 유령이거나 나를 가리키는 값은 덮지 않음)"
    - "시간 상수는 dayView.ts 한 출처(GHOST_RISE_MS·GHOST_FADE_END_MS), 무대 높이 규칙은 shared/game/map.ts 의 STAGE_SPOT 한 출처"
    - "고정 카메라 구도는 투영 함수를 그대로 써서 상자를 재고 offsetY 만 정한다 — 구도 규칙을 시험이 같은 투영으로 다시 재서 검증"

key-files:
  created:
    - src/world/presence.ts
    - test/unit/presence.test.ts
  modified:
    - src/world/camera.ts
    - test/unit/camera.test.ts

key-decisions:
  - "gatherView 의 '몸까지 포함' 기준은 숫자 380 이 아니라 '앞 발까지 포함한 상자가 스테이지에 들어가는가'다. 실제 상자는 산 사람 쌓임 기준 머리 상자 298.5, 발 포함 395.5 라서 UI-SPEC 의 '약 380' 을 그대로 쓰면 380~395 에서 윗부분이 잘린다"
  - "상자가 스테이지보다 높을 때(300 미만, 알려진 한계 E8 #28)는 앞 머리 꼭대기를 스테이지 아래 끝에 맞춘다 — 앞 사람 이름표가 우선, 뒤쪽 이름표가 위로 잘린다. 360x560 찬반 투표자(199)에서 위 끝은 스테이지 위보다 약 99px 위(값만 기록, 단언 없음)"
  - "executionFade 모션 줄이기는 떠오름(rise)을 끄고 0.6 반투명 상태만 2399ms 까지 유지한 뒤 2400ms 에 숨긴다(UI-SPEC: 배지 등장·유령 떠오름·카메라 전환은 끄고 반투명 상태는 그대로)"
  - "SeatLook 에서 plan 초안의 ring 필드는 만들지 않았다 — 값을 채울 공개 정보 근거와 시험 행동이 이 계획에 없고(밤 발밑 고리는 9페이즈 몫), 채워지지 않는 필드는 스텁이 된다"
  - "pointingOf 는 내가 산 사람이고 대상이 나 자신이 아닐 때만 mine 으로 덮는다 — 서버가 거절할 낙관적 선택을 미리 그리지 않는다"

requirements-completed: [DAY-04, DAY-05, GHOST-01, MAP-04]

coverage:
  - id: D1
    description: "visibleSeats: 산 사람 viewer 표에 유령 좌석 키가 없고(연출 중 좌석만 2399ms 까지 예외), 유령 viewer(spectate 또는 내 alive:false)는 모든 좌석에 탈락 좌석 ghost, 방에 없는 viewer 는 산 사람 규칙"
    requirement: GHOST-01
    verification:
      - kind: unit
        ref: "test/unit/presence.test.ts 'visibleSeats (GHOST-01, T-08-25)' (8 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "cameraModeOf·lightingOf·tensionOf·sceneLook: 단계표 전수, 지목 과반 + 스테이지 360 경계(359 → 1, 360 → 1.08), 3:1 선두 긴장 1, 과반 긴장 2, 동점 0, 찬반 긴장 1·초점 변론자"
    requirement: MAP-04
    verification:
      - kind: unit
        ref: "test/unit/presence.test.ts 'cameraModeOf'·'lightingOf'·'tensionOf'·'sceneLook (위를 묶는다)'"
        status: pass
    human_judgment: false
  - id: D3
    description: "executionFade 0/700/1399/1400/1900/2399/2400ms 경계와 모션 줄이기, ghostFloatY(0.35 ± 0.08, 주기 π, 줄이기 고정), stageLiftY 반경 경계(1.17 → 0.29, 1.19 → 0)"
    requirement: DAY-05
    verification:
      - kind: unit
        ref: "test/unit/presence.test.ts 'executionFade'·'ghostFloatY'·'stageLiftY'"
        status: pass
    human_judgment: false
  - id: D4
    description: "pointingOf(T-08-26: 남의 지목은 서버 값만, 내 것만 덮음, 유령·자기 자신 무시, 지목 단계 아니면 {})와 leaderShift(첫 스냅샷 null, 새 선두만 좌석, 동점·같은 선두 null)와 sceneLook 의 pointAt"
    requirement: DAY-04
    verification:
      - kind: unit
        ref: "test/unit/presence.test.ts 'pointingOf'·'leaderShift'·'sceneLook 의 pointAt'"
        status: pass
    human_judgment: false
  - id: D5
    description: "카메라 zoom: zoom 1·생략은 기존 결과와 같고(회귀 0), 1.08 은 화면 가운데에서 거리 1.08 배, groundToScreen 과 screenToGround 는 zoom 1·1.08 에서 서로의 역(1e-6)"
    requirement: MAP-04
    verification:
      - kind: unit
        ref: "test/unit/camera.test.ts 'zoom 인자 (UI-SPEC 카메라: 과반 연출 확대 1.08)' (5 tests) + 기존 카메라 시험 그대로 통과"
        status: pass
    human_judgment: false
  - id: D6
    description: "gatherView 가시성 backstop(E8 #31): STAGE_SIZES 6종 산 사람 채팅 패널 스테이지(310~626)에서 8슬롯 이름표 상자가 스테이지 세로 안에 들고, 과반 확대 1.08·몸 포함·유령 쌓임 154 에서도 들 수 있는 크기면 든다"
    requirement: MAP-04
    verification:
      - kind: unit
        ref: "test/unit/camera.test.ts 'gatherView (UI-SPEC 카메라: 이름표가 몸보다 우선, E8 #31 backstop)'"
        status: pass
    human_judgment: false
  - id: D7
    description: "전체: 앱·워커 타입 검사와 단위 프로젝트 전체(74 파일 2342 통과, 1 skipped 는 이전부터)"
    verification:
      - kind: command
        ref: "npm run typecheck; npx vitest run --project unit"
        status: pass
    human_judgment: false
  - id: D8
    description: "모이는 자리 구도·과반 확대·유령 떠오름이 실제 화면에서 보기 좋은지(이름표가 몸보다 우선인 구도, 조명 읽힘)"
    verification: []
    human_judgment: true
    rationale: "수학과 시간표만 시험으로 고정했고 렌더러·런타임 배선(08-10·08-12) 전이다. 구도·조명 체감은 개발 뒤 실기기 확인에서 본다. three 정사영 zoom 이 이 투영식과 같은 배율인지(가정 A1)는 08-10 의 cameraThree 시험 몫"

duration: 12min
completed: 2026-11-02
---

# Phase 8 Plan 8: 장면 상태(presence)와 모이는 자리 고정 카메라 Summary

**서버 view 하나에서 그 viewer 가 볼 좌석(산 사람 화면엔 유령 좌석 키 자체가 없음)·카메라·조명·긴장을 정하는 순수 모듈 presence 와, 처형 1.4초 떠오름 → 2.4초 사라짐 시간표·유령 떠다님·무대 높이·지목 손가락 방향, 그리고 zoom 인자를 받는 투영과 6개 폰 크기에서 8명의 이름표를 스테이지 안에 담는 고정 구도 gatherView 를 three 없이 단위 시험으로 고정했다.**

## Accomplishments

- **presence.ts(순수)**: `visibleSeats` 는 산 사람 viewer 에게 산 좌석(+ 처형 연출이 끝나지 않은 좌석)만, 유령 viewer 에게는 모든 좌석(탈락 좌석 ghost)을 준다. 서버가 보내지 않은 것을 '숨김'으로 들고 있지 않는다(T-08-25). `cameraModeOf`·`lightingOf`·`tensionOf`·`sceneLook` 이 UI-SPEC 카메라 표와 단계 조명 표를 그대로 옮긴다.
- **연출 수치**: `executionFade`(0~1400ms 불투명도 1 → 0.6·높이 0 → 1.2, 1400~2400ms 0.6 → 0, 2400 부터 숨김, 모션 줄이기 즉시 0.6), `ghostFloatY`(0.35 + sin(2t) × 0.08), `stageLiftY`(STAGE_SPOT 기준 반경 1.18 안이면 0.29).
- **지목 표현**: `pointingOf`(남의 지목은 서버 공개 값만, 내 낙관적 선택만 덮음, T-08-26), `leaderShift`(첫 스냅샷 null, 새 선두만 좌석 — 결정 0049 손사래 한 번).
- **camera.ts**: 투영 세 함수에 zoom(기본 1, 회귀 0), `gatherView` 가 8슬롯 이름표 상자(뒤 머리 꼭대기 − 쌓임 ~ 앞 머리 꼭대기)를 스테이지 세로 가운데에 두는 offsetY 를 정한다. 6종 폰 크기의 채팅 패널 스테이지(최소 310)에서 모두 들어간다.

## TDD Gate Compliance

세 작업 모두 RED → GREEN 순서로 커밋했다(`type: tdd` 플랜 게이트 충족). REFACTOR 커밋은 변경이 없어 만들지 않았다.

| 작업 | RED 커밋 | GREEN 커밋 | RED 증거 |
|------|----------|------------|----------|
| 1 (트레이서) | 1152943 | 7cd00cd | `gsd_run check tdd-red-evidence` → RED_EVIDENCE_OK (target_test_failed, 49개 중 25 실패) |
| 2 | 3b62351 | 55c65a0 | RED_EVIDENCE_OK (80개 중 19 실패, 대상 `executionFade ... 700ms`) |
| 3 | 660ce37 | 6e1fbb4 | RED_EVIDENCE_OK (zoom 1.08 배율·gatherView 가시성 실패) |

**semanticAssessment**: 세 RED 모두 모듈이 없어서 나는 import 오류가 아니라, 중립 값을 돌려주는 뼈대(presence 의 빈 좌석 표·follow 카메라, camera 의 zoom 무시·offsetY 0)에 대해 계획한 행동 단언이 실패한 것이다. 뼈대 없이 시험만 두면 import 실패(INVALID_RED)가 되므로 RED 커밋에 뼈대를 함께 넣었다. 일부 시험(0ms 경계 등)은 뼈대 값과 우연히 같아 RED 에서도 통과했으나 대상 시험은 모두 단언 실패였다.

**트레이서 게이트**: 작업 1 GREEN 뒤 `<verify>` 를 다시 돌려 통과를 확인하고 확장했다(⚡ Tracer verified end-to-end — expanding).

## Task Commits

| 작업 | 커밋 | 내용 |
|------|------|------|
| 1 RED | 1152943 | test: 보이는 좌석·카메라·조명·긴장 실패 시험 + presence 뼈대 + camera 공유 상수 |
| 1 GREEN | 7cd00cd | feat: visibleSeats·cameraModeOf·lightingOf·tensionOf·sceneLook |
| 2 RED | 3b62351 | test: 처형 시간표·유령 떠다님·무대 높이·지목 방향·선두 바뀜 |
| 2 GREEN | 55c65a0 | feat: executionFade·ghostFloatY·stageLiftY·pointingOf·leaderShift, sceneLook 에 pointAt |
| 3 RED | 660ce37 | test: zoom 투영·gatherView 가시성 |
| 3 GREEN | 6e1fbb4 | feat: zoom 인자·gatherView |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 내 시험의 undefined 비교 오류**
- **Found during:** Task 1 GREEN
- **Issue:** `same(seats[0]?.fadeAt, undefined)` — 비교 도우미가 `JSON.stringify(undefined)` 에 `.replaceAll` 을 불러 시험 자체가 예외를 냈다(구현 결함 아님).
- **Fix:** `expect(...).toBeUndefined()` 로 교체.
- **Files modified:** test/unit/presence.test.ts
- **Commit:** 7cd00cd

### 계획과 다르게 정한 것(결정 사항으로 위 key-decisions 에도 기록)

- **`ring` 필드 없음**: 계획 문구의 `SeatLook { show; ghost; pointAt?; ring?; fadeAt? }` 에서 `ring` 은 채울 근거와 시험 행동이 없어 만들지 않았다(채워지지 않는 필드는 스텁이 된다). 밤 발밑 고리는 9페이즈에서 필요할 때 더한다.
- **gatherView 몸 포함 기준**: UI-SPEC 의 '≥ 약 380' 대신 '앞 발까지 포함한 상자가 들어가는가'로 정했다(실측 395.5).
- **RED 커밋에 뼈대**: 위 TDD 절 참고.

**Total deviations:** 1 auto-fixed (Rule 1), 3 설계 결정. **Impact:** 공개 이름·시그니처는 계획 그대로다(`ring` 제외).

## Verification

- `npx vitest run test/unit/camera.test.ts test/unit/presence.test.ts` — 통과(155 통과, 1 skipped 는 camera 이전 시험에서 이미 있던 것)
- `npm run typecheck && npx vitest run --project unit` — 통과(74 파일 2342 통과)
- 인수 기준: `export function visibleSeats`·`cameraModeOf`·`executionFade`·`gatherView`·`GHOST_FADE_END_MS`·`STAGE_TOP_R = 1.18`·`ZOOM_MAJORITY = 1.08` grep 성공, presence.ts 에 three·document·window 없음(grep rc 1), 테스트에 `.skip(`·`.todo(` 없음, `test(08-08):` 커밋 3건
- 레포 위생 grep(금지 표현) 결과 없음

## Known limitations (미해결로 둔 것 — 계획 가정과 같음)

- A2(E8 #29): 360 폭에서 모이는 원 양끝 이름표가 가장자리에서 잘린다 — 고치지 않음.
- A3(E8 #28): 360x560 찬반 투표자 스테이지 199 에서는 위쪽 이름표가 잘린다. gatherView 는 앞 머리 꼭대기 기준으로 맞춘다(위 끝이 스테이지 위보다 약 99px 위, 시험이 값만 출력).

## Known Stubs

없음.

## Threat Flags

없음. T-08-25(산 사람 상태에 유령 좌석 없음)·T-08-26(남의 지목은 서버 값만)은 시험으로 고정됐고, T-08-SC 는 패키지를 설치하지 않았다.

## Next Phase Readiness

08-09(서버 유령 audience)·08-10(렌더러가 SceneLook·executionFade·ghostFloatY·stageLiftY·gatherView 를 읽음, three 카메라 zoom 배율 확인 A1)·08-12(런타임 배선)가 이 모듈을 그대로 가져다 쓴다.

## Self-Check: PASSED

- FOUND: src/world/presence.ts, test/unit/presence.test.ts, src/world/camera.ts(gatherView·ZOOM_MAJORITY), test/unit/camera.test.ts
- FOUND 커밋: 1152943, 7cd00cd, 3b62351, 55c65a0, 660ce37, 6e1fbb4
