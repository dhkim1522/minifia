---
phase: 22-cleanup-single-mode
plan: "05"
subsystem: town-map-removal
tags: [cleanup, town, zones, cutaway, overview-camera, legacy-room, e2e, perf]
requires: [22-04]
provides:
  - "MapId = bar | plaza. MODE_MAPS·startMapOf·shared/game/{mapTown,zones}.ts 없음. 시작 맵은 방장 선택(decideMap) 하나"
  - "프로토콜에서 RoomId·ROOM_IDS·ZoneId·ZONE_IDS, world door 프레임(vanish·appear), snap 의 zone 표시, PLACE_IDS 의 lamp0~lamp7 삭제 (PLACE_IDS 16개)"
  - "worker: 구역 동기화(syncZones·zoneMemo·nextZoneAt)·문 통과 알람(alarmBy)·구역으로 거르는 snapFrameFor/emitMove 삭제. 이동 프레임은 emitWorld 한 길"
  - "화면: town.ts·cutaway.ts·개관(overview) 카메라(CameraView·overviewFraming·집 문패 중심)·마을 조명 열·팔레트 마을 구역·__mfTown·문 연출(data-door)·벽 뒤 이름표 숨김·건물 누르기(rayAt)·roomsOpen 삭제"
  - "plaza.ts 는 buildPlaza 선택 인자·덧붙일 조각 없이 buildPlazaScene 하나로 그린다. 광장 메시·색·배치는 그대로"
  - "옛 방 표시: isLegacyV3Room 에 map/mapChoice === town 추가 — 판 중·끝난 방은 대기실로, 대기실 방의 mapChoice town 은 키를 지워 기본값으로. normalizeStoredRoom 이 맵 조회보다 먼저(T-22-08)"
  - "시험 도우미 lockModeMaps·openTown 은 내용 없는 껍데기(22-08 이 호출부와 함께 삭제). setup 의 맵 잠금은 PLAYABLE_MAPS 잠금만"
affects: [22-06, 22-07, 22-08, 22-14]
key-files:
  deleted:
    - shared/game/mapTown.ts
    - shared/game/zones.ts
    - src/world/maps/town.ts
    - src/world/cutaway.ts
    - scripts/e2e/town.mjs
    - test/helpers/mapRaster.ts
    - "시험 9개(unit 5: mapTown·townScene·zones·errandZone·cutaway / worker 4: town·townDoor·townErrand·townLeak)"
  modified:
    - shared/{protocol,game/{errand,map,maps,room,world}}.ts
    - worker/room.ts
    - src/world/{camera,palette,presence,renderer,runtime,store,testHooks,threeCamera,threeRenderer}.ts
    - src/world/maps/{plaza,types}.ts
    - src/components/WorldStage.tsx, src/components/v2/placeArt.tsx, src/screens/ResultScreen.tsx
    - src/game/placeText.ts, src/debug/perf/{scenario,perfScene}.ts, src/styles/world.css
    - scripts/{make-placeart,perf-run,perf-run.test,smoke}.mjs, scripts/e2e/{flows,lib,lib.test}.mjs
    - test/helpers/playable.ts, test/unit/setup.ts, test/worker/{setup,helpers}.ts
decisions:
  - "origin·walkHalf(MapDef 선택 필드)는 마을 전용이었지만 격자 일반 기능(map.ts 의 cellOfFx·limitFx)이라 남겼다. 쓰는 맵이 없어도 기본값 경로가 그대로라 동작이 같다."
  - "CameraView 와 view 인자를 통째로 지웠다(groundToScreen·screenRay·screenToGround·configureCamera·cameraBasis 는 경사 시점 하나). 개관은 마을 전용 시점이었다."
  - "nightloadDwell(map) 은 맵을 안 고른 판(null)이면 표 전부, 고른 판(bar·plaza)이면 errand 만 뺀다. 판 종류 자체는 22-07 이 지운다."
  - "한 커밋으로 묶었다: 앱 tsconfig 가 test/ 를 포함해 서버·화면·시험이 한 번에 맞아야 typecheck 가 초록이다."
metrics:
  tasks: 3
  duration: 약 2시간
status: complete
actuals:
  tokens: 150000
  tasks: 3
  commits: 1
plan_head_before: 1346abac7f23611c40605e97497ff5c918ac8263
plan_head_after: 5297b305cc27b25104ae2997823d925e57fe81af
commits: 1
---

# Phase 22 Plan 05: 마을 맵 삭제 Summary

마을 맵(결정 0087)과 부속 — 구역·벽 잘라 보기·문 프레임·구역 동기화·한눈(개관) 카메라·집 이름표 중심 — 을 서버·와이어·화면·시험·E2E·성능 스크립트에서 지웠다(결정 0089-13·14, D-02·D-04·D-07). 재즈 바·시계탑 광장·방장의 [맵] 선택·흰 분필 윤곽은 그대로다. 64개 파일, +228 −7688 줄(.planning 제외).

## 한 일

**Task 1 — 서버·와이어**
- `mapTown.ts`·`zones.ts` 삭제. `MapId` 에서 town, `RoomId`·`ZoneId` 와 상수, world `door` 프레임·snap 의 `zone` 표시, `MapDef.rooms`·`RoomDef`·`Obstacle.room/cut` 삭제. `MODE_MAPS`·`startMapOf` 삭제(`beginGame` 은 `decideMap` 하나).
- `errand.ts`: `nearIdsOf`·`nearSnapFrame` 의 구역 거르기(map 인자·`clipToZone`)를 지웠다(재즈 바·광장은 원래 거리만 봤다). `world.ts`: `zones` 구역 기억과 저장·복원 분기 삭제(옛 저장값의 `zones` 키는 복원이 무시한다).
- `worker/room.ts`: `syncZones`·`zoneMemo`·`nextZoneAt`·`emitMove`·`alarmBy` 와 `settleZones` 호출, `snapFrameFor` 의 구역 거르기를 지웠다. 이동 프레임은 `emitWorld(moveFrame(...))` 하나로 나가고 알람은 단계·봇·배회 셋만 합친다. 유령 위치 규칙(audience 의 world)은 그대로다(T-22-09).
- 옛 방 표시: `hasLegacyTown`(map 또는 mapChoice 가 문자열 town)을 `isLegacyV3Room` 에 더했다. 판 중·끝난 방은 `toLobbyFromLegacy` 로 대기실이 되고, 대기실 방의 mapChoice town 은 키를 지운다. DO 생성자에서 `normalizeStoredRoom` 이 `mapDef()`·`restoreWorld` 보다 먼저 돈다(worker/room.ts 136·161행). 구역·문 기억은 room 키가 아니라 world 저장소 키라 표시에 더할 것이 없었다.
- 시험 도우미 `lockModeMaps`·`openTown` 을 껍데기로 바꾸고 `SHIPPED_MODE_MAPS` 를 지웠다. `test/unit/setup.ts` 는 내용 없는 모듈, `test/worker/setup.ts` 는 PLAYABLE_MAPS 잠금만 남았다.
- 22-04 이월분: `PLACE_IDS` 의 `lamp0~lamp7`(+ `placeText`·`placeArt.tsx`·`make-placeart.mjs` 의 `LAMP_ALIASES`·`smoke.mjs`·E2E `ERRAND_PLACE_IDS`)을 지웠다. 장소 id 는 16개다. `placeart:check` 는 초록.

**Task 2 — 화면**
- `town.ts`·`cutaway.ts` 삭제. `camera.ts`: `TOWN_PAN_BOX`·`panBoxOf`·`TOWN_PLATE_FAR`·`plateFarOf`, `CameraView`·`CAMERA_RIGS`·`OVERVIEW_*`·`NIGHT_PANEL_HEIGHT`·`HOUSE_TAG_*`·`overviewFraming`·`houseTagCenters` 삭제(런타임은 `PAN_BOX` 직접 사용). `threeCamera`·`threeRenderer`·`renderer.ts`: `view` 인자·`setCameraView`·`setCutaway`·`setOwners`·`setLamps`·`roofs`·`rayAt` 삭제.
- `runtime.ts`: 문 연출(`DoorFade`·`readDoorEvents`)·벽 뒤 이름표 숨김(`veil`)·컷어웨이(`updateTown`)·집 주인(`sendOwners`)·개관 전환·건물 누르기 삭제(핀 조명은 `vis` 없이 몸 자리를 바로 쓴다). `store.ts`: `takeDoor`·door·zone snap 삭제. `presence.ts`: `CameraMode` 의 overview, `SceneLook.roomsOpen`, `STAGE_TOPS.town`. `palette.ts`: 마을 팔레트 구역 전체(`LAMP_LIT`·`LAMP_OFF`·`SEAT_COLORS`·`TOWN_PALETTE`·`TOWN_LIT`). `testHooks.ts`: `__mfTown`·`installTownHook`, `__mfCamera.mode` 값에서 overview. `WorldStage.tsx`: 마을 훅·개관 어둠 가림(`mf-world__dim`, `world.css` 규칙도).
- 이월분 `TOWN_LAMPS`·`setLamps`·`houseLit`·개관 카메라 기저·`HOUSE_TAG_*`/`houseTagCenters` 는 위에서 모두 받았다.
- `plaza.ts`: `PlazaOpts`·`PlazaPiece`·`PlazaPieceCtx`·`buildPlaza` 를 지우고 `buildPlazaScene` 하나로 합쳤다. 건물 앞면 네 장은 조건 없이 놓고 바닥 판 반폭 20·연장 판 `PLATE_FAR` 는 상수다. 메시·색·배치는 그대로다. `src/debug/perf/scenario.ts`: `?map=town` 삭제.

**Task 3 — 시험·E2E·성능**
- 시험 삭제 9개(위 목록)와 `test/helpers/mapRaster.ts`(마을 래스터 전용, 쓰는 곳 없음). 시험 수정: `camera`(마을 카메라·개관 블록)·`cameraThree`(개관 기저)·`worldStage`(마을 컷어웨이·문 연출·벽 뒤 이름표 세 묶음, 개관 세 건, 가짜 렌더러의 마을 훅)·`worldStore`(문·zone 묶음)·`presence`(roomsOpen)·`resultScreen`(roomsOpen)·`palette`(마을 팔레트)·`e2eContract`(TOWN_E2E·장소 id 16)·`perfScenario`(map=town 셋)·`placeArt`·`errandView`(장소 24 → 16)·`legacyRoom`(마을 5건 추가).
- E2E: `town.mjs`, `flows.mjs` 의 import·펼침·`town-*` 등록 다섯·`beforeStart`(town-room 전용 옵션), `lib.mjs` 의 `TOWN_E2E`·`townChecks`(마을 판정 구역 전체, 약 160줄), `lib.test.mjs` 의 마을 판정 시험. `perf-run.mjs`: `--map town`·`NIGHTLOAD_DWELL_CAUSE`(마을 전용 표)·마을 기대 맵 확인.

## 시험 분류

| 분류 | 처리 |
| --- | --- |
| 삭제(파일째) | unit: mapTown·townScene·zones·errandZone·cutaway / worker: town·townDoor·townErrand·townLeak (머리 주석으로 마을 전용 확인) |
| 부분 삭제 | camera·cameraThree·worldStage·worldStore·presence·resultScreen·palette·e2eContract·perfScenario·lib.test.mjs·perf-run.test.mjs |
| 기대값만 수정 | placeArt(33→25)·errandView(24→16)·e2eContract(PLACE_IDS 24→16)·lib.test.mjs(ERRAND_PLACE_IDS 24→16, extraSizes 목록에서 town-walk 빠짐) |
| 그대로 | `openTown`·`lockModeMaps` 를 부르던 시험(껍데기 아래 재즈 바로 통과) |
| 신규 | legacyRoom 마을 5건(map town 판 중 → 대기실 + roomMapId bar / ended 방 / 판 중 mapChoice town / 대기실 mapChoice town 정규화 / 정상 방은 같은 객체) + isLegacyV3Room 판정에 town 한 줄 |

## 검증 결과 (모두 실제 실행)

| 명령 | 결과 |
| --- | --- |
| Task 1 verify: `npx vitest run test/unit/{legacyRoom,maps,map}.test.ts test/worker/mapPick.test.ts` + `npx tsc -p tsconfig.worker.json --noEmit` | 4 파일 145 통과 / tsc 오류 0 |
| Task 2 verify: `npm run typecheck`(placeart:check·tokens·wrangler types·app·worker tsc 포함) | 종료 0 |
| Task 3 verify: `npx vitest run`(전체) | 264 파일 통과·6 건너뜀, 7913 통과(e2eContract 한 건을 고친 뒤 그 파일 93 통과를 따로 확인)·실패 0 |
| `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` | pass 651 / fail 0 (22-04 의 662 에서 마을 판정·TOWN_E2E 시험 11건이 빠짐) |
| 수용 기준 | mapTown·zones·town.ts·cutaway·town.mjs 없음 / `MODE_MAPS` 0 / protocol·maps 의 `"town"` 0 / setup 의 lockModeMaps 0 / `TOWN_PLATE_FAR` 0 / plaza.ts 의 `PLAZA_SPAWNS` 0 / flows 의 `id: "town-` 0 / `mapTown\|cutaway` 0 / `"town"` 잔여(legacy 제외) 0 |
| 위생: `git grep -nIiE "torder\|티오더\|조직\|회사\|~/project"` (변경 파일) | 결과 없음 |

워커 전체 실행의 부하 flake 는 이번에 나타나지 않았다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 한 커밋으로 묶음**
- 앱 tsconfig 가 `test/` 를 포함하고 서버·화면·시험이 서로 물려 있어 Task 1 만, 또는 Task 1·2 만 커밋하면 `npm run typecheck` 가 빨갛다. 계획이 Task 3 끝의 verify 초록 뒤 한 커밋을 지시한 것과 같게 세 태스크를 하나(`5297b305`)로 냈다.

**2. [Rule 2 - 누락된 정리] 계획 파일 목록 밖 수정**
- `src/world/store.ts`(door·zone snap 처리)·`palette.ts`(마을 팔레트)·`world.css`(개관 어둠 가림 규칙)·`src/screens/ResultScreen.tsx`·`src/game/placeText.ts`·`src/components/v2/placeArt.tsx`·`src/debug/perf/perfScene.ts`·`scripts/{make-placeart,smoke}.mjs`·`scripts/perf-run.test.mjs`·`test/helpers/mapRaster.ts`(삭제): 마을 부속을 가리키던 곳이라 남기면 죽은 코드가 된다. 22-04 SUMMARY 가 이월한 항목(`TOWN_LAMPS`·`setLamps`·`houseLit`·개관 카메라·`HOUSE_TAG_*`·`PLACE_IDS` lamp0~7)이 대부분이다.

**3. [Rule 1 - 회귀 방지] `nightloadDwell` 의미 변경**
- 마을 표(`NIGHTLOAD_DWELL_CAUSE`)가 맵을 안 고른 판의 기본 표였다. 마을이 없어 기본 표를 `NIGHTLOAD_DWELL`(errand 포함, 확장판 순서) 전부로 하고 `--map` 을 준 판만 errand 를 뺀다. 맵을 안 준 판은 시작 뒤 맵 확인을 건너뛴다(방장 선택 맵이 랜덤이라 기대값이 없다).

## 실행하지 못했거나 이월하는 것

- **E2E 실제 실행(Playwright)은 돌리지 않았다.** town-* 흐름은 삭제했고, 남은 흐름이 마을 삭제 뒤에도 도는지는 배포본 E2E 가 필요한 일이라 이 계획에서 하지 않았다. `scripts/e2e/mapselect.mjs` 등의 주석("확장판은 늘 마을")은 판 종류 삭제(22-07)에서 흐름째 정리한다.
- **docs 이월(22-14)**: `docs/architecture.md`(판 종류의 고정 맵·구역 판정·마을 격자)·`docs/screen-map.md`(마을 화면·훅·개관 카메라·town-* 흐름) 의 마을 서술이 낡았다. 22-14 가 문서를 고친다.
- `MapDef.origin`·`walkHalf` 선택 필드와 `map.ts` 의 `cellOfFx`/`cellCenterFx` 격자 인자는 일반 기능이라 남겼다(마을만 쓰던 값). 지우려면 map.test 의 격자 시험을 함께 손봐야 해서 이 계획에서 건드리지 않았다.
- `perf-run.mjs` 의 선택 단계(`optional`·`skipOnce`·`skippedScenes`)는 `NIGHTLOAD_DWELL_CAUSE` 삭제로 호출될 일이 없는 죽은 분기가 됐다. 판 종류 정리(22-07/08)에서 perf-run 을 다시 만질 때 함께 지운다.
- `src/styles/tokens.css` 의 `--town-far` 등은 배경 색 토큰이라(`design/tokens.json` 생성물) 건드리지 않았다.

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크·인증·저장 표면은 없다. T-22-08(옛 town 방)은 `legacyRoom.test` 로, T-22-09(유령 위치 누설)는 audience 의 world 규칙 불변과 기존 누설 시험(worker 전체 통과)으로 확인했다.

## Self-Check: PASSED

- 삭제 파일 부재 확인(`mapTown`·`zones`·`town.ts`·`cutaway`·`town.mjs`), 커밋 `5297b305` 가 HEAD 의 조상임을 확인.
