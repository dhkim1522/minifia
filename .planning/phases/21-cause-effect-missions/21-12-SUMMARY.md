---
phase: 21-cause-effect-missions
plan: "12"
subsystem: night-house-pick-screen
tags: [ui, night, house-pick, dock, camera, nearest-tap]
requires:
  - phase: 21-cause-effect-missions
    provides: 21-08 의 housePlatesOf·nearestPlate·CallTarget house·night.house 띠 키, 21-10 의 밤 고정 카메라·__mfTown.night, 21-11 의 SceneDock
provides:
  - HousePick(밤 집 판 40×40 · 최근접 누르기 28 · 고른 판 3px 금빛 · 내 집 점 8 · 합의 배지는 주면 있고 안 주면 DOM 에 없음)
  - SceneDock 밤 변형(variant "night": 안내 한 줄 24 + 행동 줄 52, 높이 122)
  - WorldStage 집 판 층(houses — 지붕 꼭대기 y 1.96 투영, 카메라가 멎으면 선다)·이름표 숨김(tagsOff)
  - 확장판 마을 밤 화면 배선(GameMap): 산 사람 = 밤 독 + 집 판, 유령 = 판 없이 유령 채팅 패널
  - nightViewOf(밤 고정 시점 세로 맞춤)·houseNightOf·NightActionRow·nightBadgesOf·runtime onProject 셋째 인자 at(x, y, z)
affects: [21-13, 21-16, 21-17]
requirements-completed: [D-10, D-11, D-25, D-27]
actuals:
  tokens: 25000
  tasks: 2
  commits: 6
plan_head_before: 611f9e7ab38c8e49b09889b19e9773ae548b10b5
plan_head_after: cd5477eae95c8b63f4628029f128504d6a7096ef
commits: 6
tech-stack:
  added: []
  patterns:
    - "판 부품은 역할 prop 이 없고 같은 입력이면 같은 DOM 이다. 합의 배지만 쓰는 쪽(nightBadgesOf — 산 마피아 본인 값만)이 줄 때 DOM 에 생긴다. 시험이 같은 view 에서 역할만 바꾼 네 렌더의 판 층·안내 줄 outerHTML 이 배지 칸을 빼면 같음을 고정한다(T-21-29)"
    - "판 위치는 층이 정한다: 프레임 콜백이 8채 지붕 꼭대기를 투영해 두 프레임 연속 0.5px 안으로 같으면(카메라 이동이 끝남) 그때 한 번 상태로 올린다. 그 전에는 판이 DOM 에 있으나 data-house-off(투명·누르기 없음)"
key-files:
  created:
    - src/components/v2/HousePick.tsx
    - test/client/housePick.test.tsx
  modified:
    - src/components/v2/SceneDock.tsx
    - src/components/WorldStage.tsx
    - src/screens/GameMap.tsx
    - src/screens/GamePanel.tsx
    - src/world/camera.ts
    - src/world/runtime.ts
    - src/game/causalView.ts
    - shared/game/mapTown.ts
    - src/styles/v2.css
    - src/styles/game.css
    - src/styles/world.css
    - test/client/sceneDock.test.tsx
    - test/client/nightMap.test.tsx
    - test/client/worldStage.test.tsx
    - test/unit/camera.test.ts
    - test/unit/cameraThree.test.ts
    - test/unit/causalView.test.ts
key-decisions:
  - "밤 고정 시점의 세로 오프셋은 모이는 자리 구도(gatherView)가 아니라 새 nightViewOf 를 쓴다. gatherView 는 사람 8명 위 이름표 상자를 가운데에 두는 값이라 집 8채가 스테이지 가운데보다 약 50px 아래에 놓였다(21-10 이월 메모의 우려가 맞았다). nightViewOf 는 지붕 꼭대기 8점의 세로 가운데를 스테이지 세로 가운데에 둔다"
  - "집 판은 확장판 + 마을 맵(houseNightOf)일 때만이다. 카메라(cameraModeOf)와 같은 조건이라 집이 없는 맵의 확장판 밤은 지금의 얼굴 목록 패널 그대로다"
  - "판 층 눌림은 층 전체가 받는다(pointerup 좌표 → nearestPlate ≤ 28). 판 button 의 click 은 보조 기술(포인터 없이 오는 활성화)용이고 손가락 눌림 뒤 700ms 안의 click 은 거른다 — 한 번 눌러 pick 이 두 번 나가지 않는다"
  - "판 층은 투영이 멎을 때까지(두 프레임 연속 같은 자리) 숨긴다. 밤이 시작될 때 카메라가 따라가기에서 고정으로 0.9초쯤 움직이는 동안 판이 엉뚱한 곳에 떴다가 미끄러지지 않게 한다. 멎은 뒤 자리가 바뀌면(크기 변화) 따라간다"
  - "[쪽지]/[유언] 줄과 합의 배지 입력을 GamePanel 에서 NightActionRow·nightBadgesOf 로 떼어 기본 마피아 밤 패널과 확장판 밤 독이 같은 코드를 쓴다 — 역할을 읽는 곳은 그 둘뿐이고 GameMap·HousePick·SceneDock 은 역할을 읽지 않는다"
metrics:
  duration: 약 45분
  completed: 2026-11-13
status: complete
---

# Phase 21 Plan 12: 밤 · 집 하나 고르기 화면 Summary

**확장판 마을 밤은 얼굴 목록 대신 고정 시점 지도의 집 지붕(y 1.96) 위 40×40 판 8채로 집 하나를 고른다. 눌림은 가장 가까운 판 하나(≤ 28), 메시지는 지금 그대로 `{t:"pick",target}`, 고른 판은 3px 금빛 테두리·빛, 아래는 안내 한 줄 + [쪽지]/[유언] 줄의 독 122. 네 역할이 같은 판·같은 안내·같은 높이이고 이름표는 밤에 없다. `npm test` 8929 통과·262 건너뜀·실패 0, `npm run typecheck` 초록.**

## RED 증거 (단일 줄)

- Task 1 (`b2c93ed4`): `Error: Failed to resolve import "../../src/components/v2/HousePick" from "test/client/housePick.test.tsx"` · `TypeError: Cannot read properties of undefined (reading 'messages')` (밤 변형 없는 SceneDock) · `AssertionError: expected undefined to be NaN` (NIGHT_DOCK_H 없음) · `AssertionError: expected '' to match /width: 10px/` (범례 점 CSS 없음)
- Task 2 (`4419ad0e`): `TypeError: nightViewOf is not a function` · `TypeError: houseNightOf is not a function` · `AssertionError: expected [] to deeply equal [ +0, 1, 2, 3, 4, 5 ]` (확장판 밤 판 0개) · `Error: Unable to fire a "click" event - please provide a DOM element.` (판 없음) · `AssertionError: expected …(6) to have a length of +0 but got 6` (이름표가 그대로 있음) · `AssertionError: expected undefined to deeply equal { sx: 230, sy: 300.4 }` (onProject 셋째 인자 없음)

## 판 투영 방식

- 판 중심 = `TOWN_HOUSES[n]` 의 (x, z) 위 높이 `HOUSE_ROOF_TOP_Y`(1.96, mapTown 에서 내보냄) 점을 렌더러 `project` 로 투영한 화면 좌표. 심부름 층과 같은 프레임 콜백(`onProject`)에서 하되 바닥 전용이던 `project(x, z)` 에 더해 높이를 가진 셋째 인자 `at(x, y, z)` 를 런타임이 넘긴다.
- 8점을 0.1px 로 반올림해 두 프레임 연속 0.5px 안으로 같으면(카메라 이동이 끝남) React 상태로 한 번 올려 판이 선다(`HousePick` 의 `left`·`top`). 그 전에는 판이 DOM 에 있으나 `data-house-off`(투명·누르기 없음). 멎은 뒤 자리가 바뀌면(주소창 접힘 등) 따라간다. 판 층이 사라지면(아침) 좌표를 비워 다음 밤에 처음부터 다시 숨는다.
- 누르기: 판 층 전체가 pointerup 좌표(층 안쪽으로 환산)를 받아 `nearestPlate(점들, x, y)`(≤ 28, 같은 거리면 낮은 좌석)로 판 하나를 고르고 같은 좌석이면 부르지 않는다.
- 카메라 세로 맞춤(`nightViewOf`): gatherView 의 값은 폰 6종에서 집이 스테이지 가운데보다 약 49~50px 아래였다(예: 360×560 스테이지 62~438, 지붕점 sy 221~379 — 위 여백 159·아래 59). 새 값은 지붕 꼭대기 8점의 세로 가운데를 스테이지 세로 가운데에 둔다(오프셋 +14 ~ +10, 위·아래 여백이 같다).

## 폰 6종 판 간격 표 (nightViewOf + NIGHT_ZOOM, 스테이지 = 폰 높이 − 62 − 독 122)

| 폰 | 배율 | 판 중심 최소 거리(쌍) | 위·아래 여백(판 40 포함) | 좌우 여백 |
|----|------|------------------------|---------------------------|-----------|
| 360×560 | 0.249 | 40.0(1–2·5–6, 닿기만 함) | 89.1 | 22.4 |
| 360×640 | 0.249 | 40.0 | 129.1 | 22.4 |
| 390×664 | 0.272 | 43.7 | 133.9 | 24.9 |
| 390×844 | 0.272 | 43.7 | 223.9 | 24.9 |
| 402×874 | 0.281 | 45.2 | 236.0 | 25.8 |
| 430×932 | 0.303 | 48.6 | 258.3 | 28.1 |

UI-SPEC 표의 "약 41·45·47·50" 은 어림이고 실제 계산은 위와 같다(가장 좁은 360 폭에서 40.0 — 판 40 과 딱 닿는다). 판이 닿아도 최근접 누르기라 오작동이 없다. 값은 `test/unit/camera.test.ts`(순수 수학)와 `test/unit/cameraThree.test.ts`(실제 렌더러가 쓰는 three 정사영 카메라의 `Vector3.project`)가 고정한다: 지붕 8점 세로 가운데 ±0.5px, 판 가장자리 8 이상 안쪽, 중심 거리 ≥ 39.9.

## 바뀐 시그니처

- `HousePick({ plates: HousePlateView[], value?, call?, tally?, sure?, disabled?, onPick? })`, `HousePlateView = { seat, name, img, color, me, x?, y? }` — 역할 prop 없음
- `SceneDock(props: SceneDockProps | SceneDockNightProps)`, `SceneDockNightProps = { variant: "night", picked, actions, lifted?, veiled?, panelRef? }`, 상수 `NIGHT_GUIDE_H` 24·`NIGHT_ROW_H` 52·`NIGHT_DOCK_H` 122
- `WorldStage` 새 prop `houses?: HouseLayerProps`(= HousePick 의 plates 에서 좌표를 뺀 것 + 나머지), `tagsOff?: boolean`
- `createWorldRuntime` 의 `onProject(project, now, at)` — `at(x, y, z)` 높이 있는 투영
- `nightViewOf(stage, canvas, zoom)`(camera.ts), `houseNightOf(view)`(causalView.ts), `NightActionRow`·`nightBadgesOf(view)`(GamePanel.tsx), `HOUSE_ROOF_TOP_Y`(mapTown.ts)
- GameMap: `houseNight = houseNightOf(view)`, `houseDockOn = houseNight && 산 사람`, 밤 독 `useMapInsets` 의 `panelKey` 는 "night"

## Deviations from Plan

### Auto-fixed / 계획 보완

**1. [Rule 1 - 계획 보완] 밤 카메라 세로 오프셋 새로 정함 (nightViewOf)**
- **Found during:** Task 2 시작 전(21-10 이월 메모의 확인 요청)
- **Issue:** 21-10 은 밤 고정을 기존 `gatherView`(사람 8명 이름표 상자 기준)로 두었다. 집 8채 지붕이 스테이지 가운데보다 약 50px 아래로 치우쳐 판이 아래 독 쪽으로 몰린다
- **Fix:** `nightViewOf` 를 새로 두고 런타임의 고정 카메라 갈래가 밤 고정(`isNightFixed`)이면 그 값을 쓴다. 다른 고정 구도(지목·변론·찬반·처형)는 그대로 gatherView. 순수 수학 시험 + three 카메라 시험(폰 6종)으로 고정
- **Files modified:** src/world/camera.ts, src/world/runtime.ts, test/unit/camera.test.ts, test/unit/cameraThree.test.ts
- **Commit:** a45e6b18(GREEN)

**2. [계획 보완] 집 판은 확장판 + 마을 맵일 때만**
- 계획은 확장판 밤이면 판이라 했으나 집은 마을 맵에만 있고 카메라도 마을에서만 고정이다. `houseNightOf`(같은 조건)가 아니면 지금의 얼굴 목록 패널 그대로(시험: 맵 bar 의 확장판 밤)
- **Commit:** a45e6b18

**3. [계획 보완] [쪽지]/[유언]·합의 배지 입력을 GamePanel 에서 떼어냄**
- 계획은 "GamePanel 에 방어 줄" 정도였으나 독이 같은 줄을 써야 해서 `NightActionRow`·`nightBadgesOf` 로 떼어 기본 마피아 밤 패널(GamePanel)과 독이 같은 코드를 쓴다. GamePanel 의 DOM·동작은 불변(기존 시험 전부 통과). GamePanel 은 확장판 밤 얼굴 목록 방어 줄을 따로 두지 않았다 — 판 종류가 없는 옛 view 도 확장판이라 `rulesetOf` 로 막으면 옛 패널 시험이 깨지는데, 부르는 쪽(GameMap)이 확장판 마을 밤의 산 사람에게 GamePanel 자체를 그리지 않아 얼굴 목록이 나올 길이 없다
- **Commit:** a45e6b18

**4. [계획 보완] 판 층을 투영이 멎을 때까지 숨김**
- 계획에 없다. 밤이 시작될 때 카메라가 따라가기에서 고정으로 옮겨 가는 약 0.9초 동안 판이 엉뚱한 곳에 떴다가 미끄러지면 "집 위에 있는 판"으로 읽히지 않는다. 두 프레임 연속 같은 자리일 때 선다(시험이 이동 중이면 숨음·멎으면 지붕 투영점에 섬을 고정)
- **Commit:** a45e6b18

**5. [계획 보완] 유령도 밤 이름표를 그리지 않음**
- 계획 "밤에는 이름표를 그리지 않는다" 는 산 사람만으로도 읽히나 UI-SPEC "유령·탈락자: 같은 고정 시점·같은 3D 장면"이고 배율 0.25 에서 이름표 8장은 겹친다. 확장판 마을 밤은 `tagsOff` 를 유령에게도 준다(기본 마피아 밤의 유령 직업 칩은 그대로)
- **Commit:** a45e6b18

### 하지 않은 것

- 판 위 창 상태 점(시안 Night 의 8px 노랑/어두운 점)은 계획·UI-SPEC 에 없어 넣지 않았다 — 창 켜짐은 3D 집의 창이 말하고 독 범례와 짝이다.
- 자동 시험(happy-dom)은 CSS 를 계산하지 않아, 실제 브라우저 값은 아래 "한계" 의 headless Chromium 정적 확인으로 갈음했다.

## Known Stubs

없음.

## Threat Flags

없음(새 네트워크·인증·파일 접근 없음. `pick` 메시지는 그대로이고 T-21-29 는 네 역할 DOM 동일 시험이 막는다).

## 한계 (정직하게)

- **실제 게임 흐름(방 → 저녁 → 밤)을 실브라우저·실기기로 돌려 본 것이 아니다.** 이 환경에는 새 순서를 끝까지 도는 E2E(21-16·21-17 소관)가 아직 없다. 대신 headless Chromium(playwright-core, 설치된 chromium-headless-shell)으로 위 실제 CSS(tokens·v2·game·world.css)와 폰 폭 360×560·390×844 의 판 좌표(nightViewOf + 투영)로 만든 정적 마크업을 그려 측정했다: 독 122·안내 24·행동 줄 52·판 40×40·고른 판 테두리 3px·내 집 점 8×8 모두 값이 맞고 스크린샷에서 판 8이 스테이지 안에 대칭으로 놓였으며 합의 배지(숫자 2, 확정 체크)와 고른 판 금빛이 보였다. 이 정적 확인은 실제 three 렌더 위의 겹침·깜빡임·카메라 이동 중 숨김의 체감을 보지 못한다.
- 투영 맞춤은 순수 수학과 실제 three 정사영 카메라(`Vector3.project`)가 같은 값임을 시험으로 고정했다. WebGL 로 그려진 집 몸통과 판이 시각적으로 겹치는지는 실기기로 본 적 없다(실기기 검사는 끝에 몰아서 한다).
- 판 깜빡임(`is-call`)·고른 판 빛의 실제 번짐은 기존 `.is-call` 규칙 재사용이고 눈으로 확인하지 않았다.
- E2E 스크립트(scripts/e2e)의 밤 흐름은 갱신하지 않았다(21-16·21-17).

## 21-13·21-16 에 넘기는 것

- E2E 표식(21-16): 판 `[data-house-pick="{seat}"]`(button), `aria-pressed`(고른 판), `data-call`(고르기 전 전체), `data-me`(내 판), 투영 전 판은 `data-house-off`(숨김·누르기 없음 — 선 판만 눌러야 한다), 판 층 `[data-house-layer]`, 밤 독 `[data-dock-night]`·안내 `[data-dock-guide]`(`[data-dock-legend="lit|dark"]`)·행동 줄 `[data-dock-actions]`, 훅 `__mfTown.night = { zoom, fixed }`(고정 카메라). 밤 이름표(`.mf-world__tag`)는 확장판 마을 밤에 없다.
- 판을 누르는 E2E 는 `data-house-off` 가 없어진 뒤(카메라가 멎은 뒤 약 1초) 판 중심 좌표를 `getBoundingClientRect` 로 읽어 누르면 된다. 판은 `pointerup` 으로 처리되므로 합성 `click` 만 보내도 되고(보조 기술 경로) 둘이 겹쳐도 pick 은 한 번이다.
- `SceneDock` 은 이제 `variant: "night"` 를 가진다(`picked`·`actions`·`lifted`·`veiled`·`panelRef`). 아침 변형(21-13)은 같은 부품의 `DaySceneDock` 쪽 `primary.kind "scene"` 이고 `variant` 가 없으면 낮 독이다.
- `GameMap` 의 `houseNight`(확장판 마을 밤)·`houseDockOn`(+ 산 사람)·`useMapInsets` 의 `panelKey` 는 "night". 아침 독을 더하면 `panelKey` 에 종류를 넘긴다. 건너뛰기 훅(`skipPressed`·`toggleSkip`·`skipSent`)은 그대로 있다.
- srcClean 은 유지(src 에 lampCut·smudged·skipVote·mafiaTouch·낱말 cut·data-*cut* 없음). HousePick·SceneDock·GameMap 의 밤 경로는 역할을 읽지 않는다(역할은 `NightActionRow`·`nightBadgesOf` 안에서만).
- 알려진 간헐 실패(deferred-items.md: bots mafiaBot, v2Marker, townLeak 알람 경쟁, scene.test 창문 무작위 역할)는 이번 전체 실행에서 나오지 않았다.

## Self-Check: PASSED

- 파일: `src/components/v2/HousePick.tsx`·`test/client/housePick.test.tsx` 있음, 수정 파일 모두 git 에 커밋됨.
- 커밋: b2c93ed4(test)·b6ef6b43(feat)·4419ad0e(test)·a45e6b18(feat)·7c7beb98(test)·cd5477ea(주석 정리) 모두 HEAD 의 조상.
- `npx vitest run test/client/nightMap.test.tsx test/client/housePick.test.tsx` 통과, 전체 `npm test` 8929 통과·실패 0, `npm run typecheck` 초록, 위생 grep(src·test) 결과 없음.
