---
phase: 21-cause-effect-missions
plan: "10"
subsystem: scene-lighting-camera
tags: [lighting, camera, night-fixed, walk, e2e-hook, skip]
requires:
  - phase: 21-cause-effect-missions
    provides: 21-09 의 SceneLook.town·lampLit 열·__mfTown, 21-06 의 skipReached, 15페이즈 canMoveIn
provides:
  - 저녁(errand) 노을 조명(lightingOf vote)·시간대 dusk·장면 그림 dusk
  - 확장판 밤 산 사람 모두 같은 조명 night(lightingFor)·어둠 표식 없음(nightDarkOf)
  - nightZoomOf(stageW)·NIGHT_TARGET, cameraModeOf·sceneLook 의 stageW(확장판 밤 고정 시점)
  - 확장판 아침 걷기(GameMap canWalk 의 판 규칙 인자), __mfTown.night
  - 접속 끊김 때 건너뛰기 전원 눌림 재확인(handleDisconnect)
affects: [21-11, 21-12, 21-13, 21-17]
requirements-completed: [D-04, D-11, D-25, D-26]
actuals:
  tokens: 10100
  tasks: 2
  commits: 6
plan_head_before: 6bfb972eeb1b9af6306003bf5d0177f9e3c8e8ad
plan_head_after: 889621f30603355ec92bd41cdb5234da9a012944
commits: 6
tech-stack:
  added: []
  patterns:
    - "조명·어둠 표식·카메라 갈래는 판 규칙(rulesetOf(modeOf(view)).errand)을 역할보다 먼저 본다 — 같은 view 에서 role 만 바꾼 넷의 결과가 같다(T-21-25)"
    - "밤 고정 시점은 모이는 자리(STAGE_SPOT = 원점)와 같은 목표라 런타임의 gatherView 길을 그대로 타고 배율만 밤 배율이다. 훅은 배율 1 미만 고정을 밤으로 가른다"
key-files:
  created: []
  modified:
    - src/world/presence.ts
    - src/world/camera.ts
    - src/world/runtime.ts
    - src/world/testHooks.ts
    - src/game/nightDark.ts
    - src/game/scenes.ts
    - src/screens/GameMap.tsx
    - worker/room.ts
    - scripts/e2e/lib.mjs
    - scripts/e2e/polish.mjs
    - test/unit/presence.test.ts
    - test/unit/camera.test.ts
    - test/unit/timeOfDay.test.ts
    - test/unit/scenes.test.ts
    - test/unit/soundNight.test.ts
    - test/client/nightMap.test.tsx
    - test/client/gameMap.test.tsx
    - test/client/atmosphere.test.tsx
    - test/client/worldStage.test.tsx
    - test/worker/skipPhase.test.ts
key-decisions:
  - "확장판 밤 고정 카메라는 마을 맵일 때만 건다(view.map === \"town\"). 확장판이 재즈 바·광장에 올 수 있어 집 8채가 없는 맵에 밤 배율(0.25~0.3)을 걸면 화면이 비기 때문이다. stageW 가 없으면 따라가기"
  - "밤 고정 목표 (0,0) 은 모이는 자리(STAGE_SPOT)와 같은 점이라 런타임 카메라 갈래는 고치지 않았다 — 기존 gatherView 길이 target (0,0) 과 밤 배율을 그대로 쓴다. 훅 night.fixed 는 '고정 + 원점 + 배율 1 미만'(모이는 자리 구도 배율은 1·1.08·판결 확대로 1 이상)으로 가른다"
  - "판 종류가 없는 view 는 확장판(기본값)이다(결정 0071) — 옛 기본 마피아 밤 조명을 보는 시험(presence·atmosphere·soundNight)에 mode: \"basic\" 을 명시했다(21-08 과 같은 처리)"
metrics:
  duration: 약 55분
  completed: 2026-11-13
status: complete
---

# Phase 21 Plan 10: 단계 조명·시간대·밤 고정 시점·아침 걷기 Summary

**저녁(errand)은 노을·dusk·dusk 장면으로 시작하고, 확장판 밤은 산 사람 네 역할 모두 같은 조명 `night`·어둠 표식 없음, 카메라는 목표 (0,0)·배율 `(스테이지 폭 − 32) / 1315` 로 고정(집 8채가 한 화면). 확장판 아침은 산 사람도 걷고 `__mfTown.night` 에 `{ zoom, fixed }` 가 실린다. 덤으로 마지막 미접속자가 끊겨도 건너뛰기가 막히지 않는다. `npm test` 8833 통과 · 262 건너뜀 · 실패 0, `npm run typecheck` 초록.**

## RED 증거 (단일 줄)

- Task 1 (`da2b3611`): `AssertionError: expected 'talk' to be 'vote'` (lightingOf errand) · `expected 'night,nightCitizen,nightCitizen,night…' to be 'night,night,night,night'` (확장판 밤 네 역할) · `errand: expected 'day' to be 'dusk'` (todOf)
- Task 2 (`ad0e4870`): `TypeError: nightZoomOf is not a function` · `expected 'follow' to be 'fixed'` (확장판 밤 cameraModeOf) · `expected 'morning:false,night:false,errand:true…' to be 'morning:true,…'` (확장판 아침 canWalk) · `expected undefined to be '{"zoom":0.272,"fixed":true}'` (__mfTown.night)
- 건너뛰기 재확인 (`a8a6eb16`): `expected '["errand","errand","errand"] ["errand…' to be '["errand","errand","errand"] ["night"…'`

## NIGHT_ZOOM 표 (nightZoomOf(폭), 시험이 0.001 안으로 고정)

| 폰 폭 | 360 | 390 | 402 | 430 |
|---|---|---|---|---|
| 배율 | 0.249 | 0.272 | 0.281 | 0.303 |

폰 6종(360x640·390x664·430x932·360x560·390x844·402x874)의 폭이 모두 이 표 안에 있다. 식은 반올림하지 않는다.

## 바뀐 시그니처

- `nightZoomOf(stageW: number): number`, `NIGHT_TARGET = { x: 0, z: 0 }` (src/world/camera.ts)
- `cameraModeOf(view, stageH, opts: { verdictZoom?, stageW? })` — 확장판 + 마을 + 밤 + stageW 면 `{ mode: "fixed", target: { x: 0, z: 0 }, zoom: nightZoomOf(stageW) }`
- `sceneLook(view, opts: { stageH, stageW?, … })`
- `isNightFixed(camera)`·`nightHookOf(camera)` (src/world/presence.ts, 런타임·훅이 읽음)
- `TownHookState.night: { zoom: number; fixed: boolean }` — 밤 고정이면 `{ 배율(소수 셋째), true }`, 아니면 `{ 1, false }`
- GameMap: `canWalk = canMoveIn(view.phase, meAlive, rulesetOf(modeOf(view)))`, `stageW = window.innerWidth` 를 장면에 넘김(useMemo 의존에 추가)
- 조명: `lightingOf("errand")` → `vote`, `lightingFor` 확장판 밤 산 사람 → `night`(유령 `nightGhost`), `nightDarkOf` 확장판이면 `false`

## 고친 옛 시험 표 (지우기·skip·약화 없음)

| 시험 | 바뀐 것 | 이유 |
|---|---|---|
| timeOfDay.test `errand` 열·todWordOf | day→dusk, 낮→저녁 | D-04 |
| scenes.test PHASE_SCENE·dusk 목록 | errand 를 dusk 로, 여섯 단계 → 일곱 단계 | D-04 |
| gameMap.test todOf 셀 `errand` | day/낮 → dusk/저녁 | 21-09 이월 메모 |
| presence.test 옛 밤 조명 셋 | `mode: "basic"` 명시(기본값이 확장판) | 기본 마피아 갈래는 그대로 |
| atmosphere.test makeView·soundNight.test view | `mode: "basic"` 명시 | 같은 이유 |
| worldStage.test `__mfTown` toEqual | `night: { zoom: 1, fixed: false }` 추가 | 훅 필드 |
| scripts/e2e lib.mjs EXPECTED_SCENE·polish.mjs TOD_BY_PHASE | errand 를 dusk 로 | 단위 시험이 사본 표 일치를 고정 |

## Deviations from Plan

### Auto-fixed / 추가

**1. [Rule 2 - 21-06/21-08 이월] 접속 끊김 때 건너뛰기 재확인**
- **Found during:** 시작 때 이월 메모(계획은 침묵)
- **Issue:** 아직 안 누른 마지막 접속자가 끊기면 `skipReached` 가 참이 되지만 다시 보는 곳이 없어 누른 사람들이 더 누를 일이 없을 때 단계가 마감까지 멈춘다
- **Fix:** `handleDisconnect` 가 저녁·아침(SKIP_PHASES)·확장판에서 `skipReached` 를 다시 보고 `applySkipPhase` 와 같은 경로(마감을 지금으로 당긴 tick + afterTransition)로 넘긴다. 워커 시험 한 건(RED → GREEN 한 쌍)
- **Files modified:** worker/room.ts, test/worker/skipPhase.test.ts
- **Commit:** a8a6eb16(RED), 889621f3(GREEN)
- 나가기(`handleLeave`)는 대기실·결과 단계 전용이라 저녁·아침에 해당하지 않는다

**2. [Rule 1 - 계획 보완] 판 종류 없는 옛 시험·E2E 사본 표**
- 판 종류가 없는 view 는 확장판이라 옛 기본 마피아 밤 시험 일곱 곳과 E2E 사본 표 두 곳이 어긋났다 — 표의 "고친 옛 시험" 대로 `mode: "basic"` 명시·사본 표 동기화(지우기·약화 없음). Commit: 60596f40

**3. [계획 선택 보완] 밤 고정은 마을 맵일 때만**
- 계획은 확장판 밤이면 고정이라 했으나 확장판이 다른 맵에 올 수 있어 `view.map === "town"` 을 더했다(key-decisions). 마을 + 확장판 밤은 계획 그대로다

계획의 런타임 카메라 갈래 수정은 필요 없었다(밤 목표가 모이는 자리와 같은 원점) — 런타임은 훅 필드만 더했다.

## Known Stubs

없음.

## Threat Flags

없음. T-21-25: 조명·어둠 표식·카메라 모두 role 만 바꾼 넷의 결과 동일을 시험이 단언한다(presence·nightMap·soundNight).

## 21-12 에 넘기는 것

- 밤 집 판은 이 고정 카메라의 투영(목표 (0,0), 배율 `nightZoomOf(폭)`)을 쓴다. 런타임의 `r.setZoom` 과 `gatherView` 길이 그대로라 화면 오프셋(`offsetY`)은 밤 배율로 구한 모이는 자리 구도다 — 집 8채가 정확히 가운데인지 실기기·E2E 로 확인이 필요하다(오차가 크면 밤 전용 오프셋 갈래를 둔다)
- 이름표는 밤에 그리지 않는다는 UI-SPEC 줄은 21-12 가 한다. 확장판 밤 좌석 표(`visibleSeats`)는 아직 `me.role` 로 시민 편 나만 보이게 갈린다 — 밤 집 판이 모든 산 사람에게 같은 표를 쓰게 21-12 에서 판 규칙 갈래를 정할 것(조명·카메라는 이미 역할을 읽지 않는다)
- `__mfTown.night` 는 21-11 이 E2E 에서 읽는다: 밤 `{ zoom: nightZoomOf(폭), fixed: true }`, 그 밖 `{ zoom: 1, fixed: false }`

## Self-Check: PASSED

- src/world/camera.ts `nightZoomOf` 1 · presence.ts `nightZoomOf` 사용 확인, GameMap `canMoveIn(..., rulesetOf(` 확인, nightDark.ts `rulesetOf` 확인
- 커밋 여섯 개 존재(da2b3611·60596f40·ad0e4870·a7129aee·a8a6eb16·889621f3), `npm test`·`npm run typecheck` 초록
