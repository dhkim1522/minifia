---
phase: 21-cause-effect-missions
plan: "09"
subsystem: town-3d
tags: [three, town, lamps, windows, decal, lighting, runtime, e2e-hook]
requires:
  - phase: 21-cause-effect-missions
    provides: 21-05 의 day.lamps, 21-06 의 day.scene, 21-08 의 causalView.windowsLitOf
provides:
  - 마을 장면 당번 가로등 8(기둥·갓·꺼진 구 정적 병합) + 켜진 구 dutyBulb + 빛 무리·웅덩이 dutyGlow + 현장 decal clueDecals
  - MapScene.setLamps(lit, instant)·setClue(house, instant), 창 켜짐 = 주인 ∧ 등불 켜짐
  - TOWN_LIT.lampLit 열(아침 houseOwned 0.6), PlazaOpts.decorLamps·dutyLamps
  - SceneLook.town({lamps, clue}) 와 townLampsOf·townClueOf, 런타임 연결, __mfTown.lamps·windows·clue
affects: [21-10, 21-11, 21-12, 21-13, 21-17]
requirements-completed: [D-04, D-06, D-07, D-08, D-13, D-24, D-26]
actuals:
  tokens: 19200
  tasks: 2
  commits: 4
plan_head_before: c57f1456e0dd68be104fd189e963c2fe8e1595e6
plan_head_after: bf4c3feb56003ffc808c362346c3939889bab55b
commits: 4
tech-stack:
  added: []
  patterns:
    - "켜진 등불은 등불마다 켜짐 정도(0~1)를 두고 update 틱이 따라간다 — 지오메트리는 켜지는·켜진·꺼지는 중인 등불 집합이 바뀔 때만 다시 만들고, 구는 정점 색, 빛 무리·웅덩이는 정점 알파에 정도를 곱한다(꺼지는 등불은 사라지기 전 그 불투명도로 내려간다)"
    - "런타임은 view 가 아니라 장면 표(SceneLook.town)의 공개 값만 읽는다 — 값이 바뀔 때만 렌더러에 보내고 첫 그리기·복구·모션 줄이기는 instant"
key-files:
  created: []
  modified:
    - src/world/maps/town.ts
    - src/world/maps/plaza.ts
    - src/world/maps/types.ts
    - src/world/palette.ts
    - src/world/presence.ts
    - src/world/renderer.ts
    - src/world/threeRenderer.ts
    - src/world/runtime.ts
    - src/world/testHooks.ts
    - test/unit/townScene.test.ts
    - test/unit/plazaScene.test.ts
    - test/unit/palette.test.ts
    - test/unit/presence.test.ts
    - test/client/worldStage.test.tsx
key-decisions:
  - "빛 웅덩이(0.03)·decal(0.02)은 UI-SPEC 높이 그대로면 가운데 자갈 칸(윗면 0.08, ±6.98)에 가려져 안 보인다 — 자갈 위로 올렸다(decal DECAL_Y 0.1 → 웅덩이 POOL_Y 0.12). 위에서 내려다보는 카메라라 차이는 보이지 않는다. 21-17 결정 기록에 옮긴다"
  - "등불·현장 값의 순수 함수(townLampsOf·townClueOf)는 계획의 runtime.ts 가 아니라 presence.ts 에 둔다 — 런타임은 view 를 받지 않고 장면 표(SceneLook)만 받는다. sceneLook 이 마을 + 확장판일 때만 town 키를 싣는다"
  - "setLamps 를 한 번도 안 부른 마을 판(기본 마피아)은 20페이즈 그대로 주인 있는 집 창이 모두 켜진다(litNow null = 연동 없음). 확장판에서는 단계가 낮 토론이어도 [] 를 보내 창이 꺼진다"
  - "강등 4단계는 dutyGlow 를 웅덩이 없는 지오메트리로 다시 만든다(웅덩이와 빛 무리가 한 메시라서) — 구·빛 무리·창은 유지, clueDecals 는 끈다"
metrics:
  duration: 약 70분
  completed: 2026-11-13
status: complete
---

# Phase 21 Plan 09: 마을 3D 당번 가로등·창·현장 Summary

**마을 3D 가 원인과 결과를 한 화면에 그린다: 당번 가로등 8(켜지면 구·빛 무리·바닥 빛 웅덩이), 등불을 따르는 집 창, 아침 피해자 집 문 앞 decal 셋, 새 조명 열 `lampLit`. 런타임은 장면 표의 공개 값이 바뀔 때만 렌더러에 보내고 `__mfTown` 에 `lamps`·`windows`·`clue` 를 싣는다. `npm test` 8813 통과 · 262 건너뜀 · 실패 1(알려진 창문 시험 불규칙 실패, 단독 3회 재실행 모두 통과), `npm run typecheck` 초록.**

## RED 증거 (단일 줄)

- Task 1: `TypeError: t.setLamps is not a function` · `AssertionError: 기둥 lamp0: expected false to be true` · `AssertionError: expected 0 to be greater than or equal to 1188` (23건 실패: palette 1·plaza 2·town 20)
- Task 2: `TypeError: townLampsOf is not a function` · `AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times` · `AssertionError: expected { Object (zone, open, ...) } to deeply equal { Object (zone, open, ...) }` (11건 실패)

## 만든 것

- **장면(`maps/town.ts`)**: 기둥·갓·꺼진 구(paneDark)는 광장 빌더의 정적 묶음 `furniture` 에 병합(+0). `dutyBulb`(lampBulb × 1.5 × 켜짐 정도 × `lampLit`)·`dutyGlow`(빛 무리 1.4 알파 0.7 + 웅덩이 2.6×2.6 알파 0.35, 같은 재질)·`clueDecals`(발자국 타원 둘 · 다섯 꼭짓점 옷 조각 · 0.6×0.6 창 빛 조각, 알파 0.55/0.9/0.35). 켜짐 0.4초·꺼짐 0.8초·decal 0.3초는 `update(dt)` 틱이 따라가고 instant 면 바로.
- **창 연동**: `setOwners` 가 주인 집합을, `setLamps` 가 켜진 번호를 기억하고 `refreshWindows()` 가 `houseWinLit`·`houseWinDark` 를 교집합으로 다시 만든다(호출 수 변화 없음).
- **조명(`palette.ts`)**: `TOWN_LIT.lampLit` 열(talk 0·vote 1·trial 0.3·night 1·nightCitizen 0·nightGhost 1·morning 0.7), 아침 `houseOwned` 0.6, `TOWN_PALETTE.footprint #0a0e1c`(UI-SPEC 표 값).
- **광장 장식 가로등(`plaza.ts`)**: `PlazaOpts.decorLamps: "lit"|"dark"`(기본 lit — 광장 맵 그대로)·`dutyLamps`. 마을은 dark: 구는 paneDark 로 정적 병합, `emissiveRoom`·`glowRoom` 메시가 없다(빈 묶음은 만들지 않는다).
- **갈래**: `MapScene`·`WorldRenderer`·`threeRenderer` 선택 메서드 `setLamps`·`setClue`.
- **런타임**: `presence.ts` 의 `townLampsOf(view)`·`townClueOf(view)` 와 `SceneLook.town`(마을 + 확장판에서만) → `runtime.ts` `updateTownCause` 가 값이 바뀔 때만 보낸다. instant = 이 렌더러에 처음 보냄(첫 그리기·재접속·단계 중간 합류) ∨ 컨텍스트 복구(`recreated`) ∨ 모션 줄이기.
- **훅**: `__mfTown.lamps`(마지막으로 장면에 넘긴 값)·`windows`(확장판 = 주인 ∩ lamps, 그 밖의 마을 = 주인 전부)·`clue`(decal 보임).

## 그리기 호출 실측 (보이는 메시 수, 캐릭터 제외, 단계 talk·vote·trial·night·nightCitizen·nightGhost·morning 순)

| 예산 | 상태 | 7단계 값 |
|------|------|----------|
| LADDER[0] | 주인 0·등불 0·현장 없음 | 26, 26, 27, 26, 25, 26, 26 |
| LADDER[0] | 주인 8·등불 0·현장 없음 | 26, 26, 27, 26, 25, 26, 26 |
| LADDER[0] | 주인 8·등불 8·현장 1 (가장 무거움) | 27, 29, 30, 29, 26, 29, 29 |
| LADDER[4] props reduced | 주인 0 | 19, 19, 20, 19, 18, 19, 19 |
| LADDER[4] props reduced | 주인 8·등불 8·현장 1 | 19, 21, 22, 21, 18, 21, 21 |

- 새 메시 셋(켜진 구·빛 무리+웅덩이·decal)은 켜질 때만 +3, 합격선은 36 에서 +3 = **≤ 39**(시험이 지킨다). 광장 장식 가로등이 구·빛 무리 메시 둘을 잃어 20페이즈 대비 순증은 +1(최대 30). 점광원 3 그대로. 고유 재질은 26 이하(시험 통과).
- 강등 4단계에서 decal 이 꺼지고(−1) 웅덩이는 지오메트리에서 빠진다(구·빛 무리 메시는 남음).

## 강등 방식

`dutyBulb`·`dutyGlow` 는 한 메시 안에 빛 무리와 웅덩이가 함께 있으므로 `applyBudget` 에서 props reduced 가 바뀌면 `rebuildDuty()` 가 **웅덩이 없는 지오메트리로 다시 만든다**(0 으로 돌아오면 웅덩이가 돌아온다). 강등 중에 `setLamps` 를 불러도 웅덩이 없이 만든다. `clueDecals` 는 `visible = false`.

## 런타임 갈래 함수

- `townLampsOf(view)`: 확장판 ∧ 단계가 errand·night·morning 이면 `day.lamps` 오름차순 사본, 그 밖 `[]`.
- `townClueOf(view)`: 확장판 ∧ morning ∧ `day.scene` 이 있으면 `scene.house`, 아니면 null.
- 둘 다 `view.me.role` 을 읽지 않는다(시험: 마피아·시민 같은 값). `sceneLook` 은 `view.map === "town"` ∧ 확장판일 때만 `town` 키를 싣는다.

## Headless 검증 (실제 Chrome + vite dev, 이 세션에서 한 것과 못 한 것)

- **한 것**: `scripts/e2e/browser.mjs` 도우미로 테스트 방(봇 4)을 만들어 errand → night → morning 을 넘기며 `__mfTown` 을 읽었다. 방장이 등불 한 곳을 켜자 `lamps [3]`·`windows [3]`, 밤에도 `[3]`, 아침에 `clue true`(그 전에는 `lamps []`·`windows []`·`clue false`). 마을 판이 아닌 맵에서 훅이 없고 첫 `start` 에서는 20페이즈 그대로 `windows = owners`.
- 화면 확인: 저녁 조명을 임시로 노을(vote)로 바꿔(커밋 안 함, 되돌림) 찍은 사진에서 켠 등불 둘레의 따뜻한 빛 번짐과 그 집의 켜진 창이 보였다. 낮 조명(지금 errand 가 talk 조명)에서는 창만 보이고 등불 빛은 `lampLit 0` 이라 안 보인다(정상).
- **못 한 것**: 밤 장면의 켜진 등불(밤 조명은 21-10 이 확장판 모두 같게 만든다 — 지금은 시민/마피아 조명이 갈려 방장 화면이 `nightCitizen` 어둠), 아침 decal 의 실제 모양(방장이 암살당해 유령 화면이 덮음), `perf-run.mjs --mode nightload --map town` 프레임·`calls` ≤ 120 측정(서버·장시간 필요 — 21-17 에서). 실기기·실제 GPU 체감은 하지 않았다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 빛 웅덩이·decal 높이를 자갈 위로 올림**
- **Found during:** Task 1 (장면 구성)
- **Issue:** UI-SPEC 치수표의 웅덩이 y 0.03·decal y 0.02 는 가운데 자갈 칸 윗면(0.08, 범위 ±6.98)보다 낮아 대부분의 당번 가로등 둘레와 단서 지점(x·z ±6.25~6.75)에서 가려진다.
- **Fix:** `DECAL_Y 0.1`·`POOL_Y 0.12` (decal 위에 빛이 더해진다). 자갈 윗면보다 높음을 시험으로 지킨다.
- **Files modified:** src/world/maps/town.ts, test/unit/townScene.test.ts
- **Commit:** 9a662d69

**2. [Rule 3 - Blocking] 순수 함수 위치를 runtime.ts → presence.ts 로**
- **Found during:** Task 2
- **Issue:** 런타임은 `view` 를 받지 않고 호출자(WorldStage)가 `sceneLook(view)` 로 만든 `SceneLook` 만 받는다. 계획의 "runtime.ts 에서 view 로 계산"은 런타임 인터페이스를 크게 바꿔야 한다.
- **Fix:** `townLampsOf`·`townClueOf` 를 presence.ts 에 두고 `SceneLook.town` 으로 런타임에 건넨다. 계획 files_modified 에 presence.ts 가 더해졌다(21-10 도 이 파일을 건드리니 함께 읽는다).
- **Commit:** bf4c3feb

**3. [Rule 3 - Blocking] types.ts 를 Task 1 에서 먼저 고침**
- **Issue:** `MapScene.setLamps?`·`setClue?` 선언이 장면 시험의 타입 검사에 필요해 Task 2 가 아니라 Task 1 GREEN 에 넣었다.

### 옛 시험 고침 (지우기·skip·약화 없음)

- `townScene.test.ts` 의 "광장 그대로" 시험에서 `emissiveRoom` 이름을 뺐다(마을은 장식 가로등 구가 없어 그 메시가 없다 — P21-3). 36 → 39 시험은 새 상태(등불 8·현장)까지 포함하도록 넓혔다.
- `palette.test.ts` TOWN_LIT 기대값을 세 열로, `worldStage.test.tsx` 의 `__mfTown` toEqual 에 새 세 필드를 더했다.

## Auth gates

없음.

## Known Stubs

없음.

## Threat Flags

없음. 장면은 `day.lamps`·`day.scene.house`(공개 값)만 읽고 서버 전용 이름·역할을 쓰지 않는다(srcClean 초록, 단위 시험: 마피아·시민 같은 값). decal 은 모든 집에서 정점 수·알파 구성이 같다(개수·종류를 담지 않음).

## 21-10~21-13 에 넘기는 것

- **조명 연결(21-10)**: `lightingOf("errand")` 와 `lightingFor`(확장판 밤 모두 `night`)를 바꾸면 켜진 등불 빛이 낮 단계(`talk` lampLit 0)가 아니라 노을·밤에 보인다. 지금은 errand 가 talk 조명이라 빛이 안 보이고, 확장판 밤은 역할 갈래라 시민 쪽이 lampLit 0 이다. 21-08 이월 메모대로 21-10 이 errand 를 dusk 로 만들 때 `gameMap.test.tsx` 의 `todOf` errand 칸(`["errand","day","낮","등불 켜기"]`)을 저녁/dusk 로 고친다(이 계획은 errand 조명·시간대를 바꾸지 않았다).
- **`__mfTown.night`(21-11)**: `TownHookState` 에 필드와 `installTownHook` 초기값 줄을 더한다(`lamps`·`windows`·`clue` 와 같은 자리).
- **decal 자리(21-12·21-13)**: 화면 표식과 같은 자리 `TOWN_CLUE_SPOTS[house]`(cm). 3D decal 은 `y 0.1`, 발자국 길이는 광장 가운데를 향한다.
- 화면 층이 읽는 공개 값은 그대로 `day.lamps`·`day.scene.house`·`me.clues` — 3D 는 `me.clues` 를 읽지 않는다.
- 렌더러 `setLamps`/`setClue` 는 마을 장면에서만 동작한다(다른 장면은 optional 로 건너뜀).
- `nightload` 마을 프레임·`calls` 측정은 21-17(결정 기록과 함께).

## 시험 수치

- 새 시험: townScene 21 · plazaScene 3 · presence 5 · worldStage 6 (palette 1 고침).
- `npm test` 8813 통과 · 262 건너뜀 · 1 실패(`test/worker/scene.test.ts` 창문 — deferred-items.md 의 알려진 불규칙 실패, 단독 3회 연속 10/10 통과). `npm run typecheck` 초록.
- 위생 `git grep -nIiE "torder|티오더|조직|회사|~/project"` 결과 없음.

## Self-Check: PASSED

- 파일: src/world/maps/town.ts, plaza.ts, types.ts, palette.ts, presence.ts, renderer.ts, threeRenderer.ts, runtime.ts, testHooks.ts 모두 존재·수정됨.
- 커밋: 84a11d11 · 9a662d69 · 23f33e05 · bf4c3feb 모두 HEAD 의 조상.
