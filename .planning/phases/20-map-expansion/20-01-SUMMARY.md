---
phase: 20-map-expansion
plan: "01"
subsystem: server
tags: [map, town, grid, zones, move-frame, leak, game-mode, tdd, tracer]
status: complete

requires:
  - phase: 19-game-modes
    provides: GameMode·modeOf·rulesetOf(판 종류), 워커 시험의 PLAYABLE_MAPS 잠금 방식(11-13)
provides:
  - "맵 id town — MAPS.town(TOWN_MAP): 48×48 · 칸 0.5 · 원점 −12 · 걷기 한계 ±10, 걷는 칸 943개"
  - "MapDef 의 맵별 격자(origin·walkHalf)·rooms, RoomDef, Obstacle 의 room·cut, cellOfFx·cellCenterFx 의 선택 map 인자"
  - "shared/game/mapTown.ts — TOWN_ROOM_OUTER·TOWN_ROOMS·TOWN_HOUSES(HouseDef)·TOWN_PROPS·TOWN_OBSTACLES·TOWN_DOOR_EXEMPT·TOWN_SPAWNS·TOWN_PLACES·TOWN_MASK·TOWN_MAP"
  - "shared/game/zones.ts — zoneOf·zoneAt·clipToZone"
  - "MODE_MAPS { extended: town }·startMapOf — 확장판 판은 늘 town 에서 시작(beginGame·rematch)"
  - "방 DO emitMove — 이동 프레임을 본인·유령 / 같은 구역 산 사람 / 다른 구역으로 나눠 보낸다"
  - "프로토콜: MapId 에 town, ROOM_IDS·RoomId·ZONE_IDS·ZoneId, MOVE_COORD_LIMIT 1200, MapChoice 는 MAP_CHOICES 값만"
  - "시험 도우미: rasterizeGrid(test/helpers/mapRaster.ts), lockModeMaps·openTown·SHIPPED_MODE_MAPS, test/unit/setup.ts"
affects: [20-02, 20-03, 20-04, 20-05, 20-06, 20-07, 20-08, 20-09, 20-10, 21]

actuals:
  tokens: 29400
  tasks: 2
  commits: 11

plan_head_before: bed376bed902c381e1bf8fd4b8b97465dd49e1da
plan_head_after: bfba7bd3462b1ae54d8a38e759fe7c1288b2f819
commits: 11

tech-stack:
  added: []
  patterns:
    - "맵별 격자: 격자 원점·이동 한계는 MapDef 에서 읽고(originFx·limitFx) 없으면 재즈 바 값 — 칸을 다루는 호출은 마지막 인자로 맵을 넘긴다"
    - "구역은 위치의 순수 함수(zoneOf) — 서버는 가진 구간의 지금 위치로 판정하고, 보낼 구간은 clipToZone 으로 문턱에서 자른다"
    - "판 종류의 고정 맵: decideMap 을 먼저 그대로 부르고 startMapOf 가 결과를 덮는다(난수 순서 불변)"
    - "시험 잠금: setup 파일이 MODE_MAPS 의 extended 칸을 지우고 마을 시험만 openTown() 으로 켠다(PLAYABLE_MAPS 잠금과 같은 방식)"

key-files:
  created:
    - shared/game/mapTown.ts
    - shared/game/zones.ts
    - test/helpers/mapRaster.ts
    - test/unit/mapTown.test.ts
    - test/unit/setup.ts
    - test/worker/town.test.ts
  modified:
    - shared/protocol.ts
    - shared/game/map.ts
    - shared/game/maps.ts
    - shared/game/room.ts
    - shared/game/world.ts
    - worker/room.ts
    - src/world/presence.ts
    - src/world/testHooks.ts
    - src/game/tutorialScript.ts
    - src/debug/perf/perfScene.ts
    - src/debug/perf/scenario.ts
    - test/helpers/playable.ts
    - test/worker/setup.ts
    - test/unit/schemas.test.ts
    - test/unit/world.test.ts
    - test/client/worldStage.test.tsx
    - vitest.config.ts

key-decisions:
  - "MapChoice 는 MAP_CHOICES 에서 뽑은 타입(bar·plaza·random)으로 좁혔다 — town 은 고를 수 없는 맵이라 맵 칩·카드 표에 가짜 town 칸을 넣지 않는다"
  - "방의 걷는 안쪽 70% 기준은 '소품이 없을 때 걷는 칸 대비'로 쟀다 — 벽 부풀림 0.35 때문에 안쪽 사각형 전체 칸 대비로는 소품 없이도 75% 가 한계다"
  - "문 앞·방 안·집 앞 자리의 정의식은 '가장 가까운 걷는 칸 중심(제곱거리 → 행 → 열)' — snapToWalkable 은 걷는 점이면 칸 중심이 아닌 입력을 그대로 돌려줘 쓰지 않았다"
  - "좌석 0·7 집의 문 앞 자리는 시계탑 뒤 머리 가림 때문에 문에서 약 1.3 떨어진 집 모서리 쪽 칸이다(배치는 승인 시안 그대로 두었다)"
  - "clipToZone 은 끝에 모든 꼭짓점의 구역을 다시 확인해 어긋나면 그 자리 한 점만 돌려준다(닫힌 쪽으로 실패)"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-13, D-14, D-19]

coverage:
  - id: D1
    description: "격자 일반화 — 재즈 바·광장의 마스크·좌표·길이 그대로이고 원점·이동 한계를 맵에서 읽는다"
    requirement: "D-04"
    verification:
      - kind: unit
        ref: "test/unit/mapTown.test.ts#격자 일반화 (D-04) — 재즈 바·광장은 그대로"
        status: pass
      - kind: unit
        ref: "test/unit/map.test.ts (고치지 않음)"
        status: pass
    human_judgment: false
  - id: D2
    description: "마을 맵 town — 방 넷·집 여덟·48×48 마스크·입장 지점·장소 8곳, 모든 자리가 문을 지나 서로 닿는다"
    requirement: "D-05"
    verification:
      - kind: unit
        ref: "test/unit/mapTown.test.ts#마을 마스크 · 방 넷 · 집 여덟 · 마을의 길 · 마을 장소 8곳"
        status: pass
    human_judgment: false
  - id: D3
    description: "구역 판정과 구간 자르기 — 방 안쪽이면 그 방, 문턱을 포함한 그 밖은 plaza"
    requirement: "D-13"
    verification:
      - kind: unit
        ref: "test/unit/mapTown.test.ts#구역 판정 zoneOf·zoneAt·clipToZone (D-13)"
        status: pass
    human_judgment: false
  - id: D4
    description: "확장판 판은 town 에서 시작하고(다시 하기 포함) 기본 마피아는 방장 선택대로, 대기실은 재즈 바"
    requirement: "D-02"
    verification:
      - kind: unit
        ref: "test/unit/mapTown.test.ts#판 종류의 고정 맵 MODE_MAPS·startMapOf (D-02·D-03)"
        status: pass
      - kind: integration
        ref: "test/worker/town.test.ts#확장판 판은 마을에서 시작한다 · 다시 하기로 시작한 확장판 판도 마을이다"
        status: pass
    human_judgment: false
  - id: D5
    description: "이동 프레임 구역 거르기 — 다른 구역 산 사람의 이동 좌표가 네트워크로 가지 않는다(T-20-01)"
    requirement: "D-14"
    verification:
      - kind: integration
        ref: "test/worker/town.test.ts#마을 판의 이동 프레임은 구역으로 걸러진다 (D-13·D-14·D-19, T-20-01)"
        status: pass
    human_judgment: false

duration: 26min
completed: 2026-11-13
---

# Phase 20 Plan 01: 마을 맵 서버 뼈대 Summary

**마을 맵 `town`(방 넷·집 여덟·48×48 격자)을 등록해 확장판 판이 그 위에서 시작하게 하고, 방 DO 가 이동 프레임을 구역(zoneOf·clipToZone)으로 걸러 다른 구역 산 사람의 좌표를 보내지 않는다.**

## Performance

- **Duration:** 26분
- **Started:** 2026-11-12T20:41:39Z
- **Completed:** 2026-11-12T21:08Z
- **Tasks:** 2 / 2
- **Files:** 23개(새 파일 6)
- **Commits:** 11 (test 6 · feat 5)

## Accomplishments

- 격자를 맵마다 읽는다(D-04). `MapDef.origin`·`walkHalf` 가 없으면 재즈 바 값이라 재즈 바·광장의 마스크·좌표·시드 시험은 한 글자도 바뀌지 않았다. `test/unit/map.test.ts` 는 고치지 않았고, 일반화한 `rasterizeGrid` 가 `BAR_MASK`·`PLAZA_MASK` 를 그대로 낸다.
- 마을 맵 `town`: 가운데는 광장 그대로(가운데 24×24 칸이 `PLAZA_MASK` 와 같은 글자), 방 넷은 문 칸이 가운데 두 칸, 집 여덟은 몸통 전체가 막힘. 입장 지점 0 에서 31곳(입장 지점 7·방 안 4·방 문 앞 4·집 문 앞 8·장소 8) 모두에 닿는다.
- 구역 판정 `zoneOf`·`zoneAt` 와 구간 자르기 `clipToZone`.
- 확장판 판은 시작·다시 하기 모두 `view.map = "town"`. 기본 마피아는 방장 선택대로, 대기실은 재즈 바 그대로.
- 방 DO `emitMove`: 본인·유령은 전체 구간, 같은 구역 산 사람은 문턱에서 끝나는 구간, 다른 구역 산 사람은 프레임 없음. 서버 주도 배치(`syncLayout`)도 같은 길을 지난다.

## 검증 결과

| 명령 | 결과 |
|------|------|
| Task 1 verify: `npx vitest run test/unit/mapTown.test.ts test/unit/map.test.ts test/unit/maps.test.ts test/unit/schemas.test.ts test/unit/world.test.ts test/unit/errand.test.ts test/worker/town.test.ts test/worker/world.test.ts test/worker/mapPick.test.ts test/worker/modePick.test.ts` | 파일 10 통과 · 시험 600 통과 · 실패 0 |
| `npm run typecheck` | 종료 0, `error TS` 0 |
| Task 2 verify: `npm test` | 종료 0 — 파일 284 통과 · 6 건너뜀, 시험 **8361 통과 · 261 건너뜀 · 실패 0** |
| `npx vitest run test/worker/town.test.ts test/unit/mapTown.test.ts` (마지막 시험을 더한 뒤) | 파일 2 통과 · 시험 68 통과(단위 58 + 워커 10) |
| 위생 git grep(커밋마다 바뀐 파일) | 결과 0 |

`npm test` 전체 실행은 Task 2 의 마지막 시험 하나(기본 마피아 판 회귀)를 파일에 더하던 때와 겹쳤다. 그 시험이 그 실행에 들어갔는지는 가리지 않았고, 더한 뒤 두 마을 시험 파일을 따로 돌려 68/68 통과를 확인했다.

## RED 증거

모두 `--reporter=tap-flat` 출력을 `gsd-tools check tdd-red-evidence` 에 넘겨 `RED_EVIDENCE_OK`(target_test_failed)를 받았다. 기록은 gitignore 된 `.gsd/red/20-01-l*.json`.

- **Task 1 층 ① 격자**: `npx vitest run test/unit/mapTown.test.ts --reporter=tap-flat` → 7 중 **not ok 4** · ok 3, 종료 1. 대상 "origin 이 있는 맵이면 cellOfFx·cellCenterFx 가 그 원점을 쓴다" 가 재즈 바 원점으로 계산한 값을 받아 실패. 재즈 바·광장 동치 시험 셋은 처음부터 통과(도우미가 같은 식이라 그래야 한다).
- **Task 1 층 ② 구역**: 같은 명령 → 19 중 **not ok 7**, 종료 1. 대상 "밖에서 안으로: 문턱 안쪽 면(z −690)에서 끝나고…" 가 `[300,-500,25,-575,25,-825,100,-900] … zones=plaza,plaza,plaza,plaza`(자리 함수가 입력 그대로·늘 plaza)로 실패.
- **Task 1 층 ③ 마을**: `npx vitest run test/unit/mapTown.test.ts test/unit/schemas.test.ts --reporter=tap-flat` → 232 중 **not ok 31**, 종료 1. 대상 "입장 지점 0 에서 … 모두에 닿는다" 가 `7 spawn1,…`(자리 값: 마스크 전부 막힘·표 빔)로 실패. schemas 의 ±1200 시험 넷도 여기서 실패.
- **Task 1 층 ④ 고정 맵**: `npx vitest run test/unit/mapTown.test.ts --reporter=tap-flat` → 58 중 **not ok 4**, 종료 1. 대상 "확장판 판: 잠금 중에는 decideMap 결과, openTown 중에는 town…" 이 openTown 중에도 맵이 bar·plaza 라 실패.
- **Task 1 층 ⑤ 방 DO**: `npx vitest run test/worker/town.test.ts --reporter=tap-flat` → 9 중 **not ok 4**, 종료 1. 대상 "문 앞의 산 사람이 우체국 안으로 걸으면…" 이 `1: -25,-575,-25,-825 [plaza>post]` 를 세 소켓 모두 받아 실패(기대: 광장은 `-25,-575,-25,-690 [plaza]`, 방 안은 `0:`).
- **Task 2 RED(처음 실행 결과 그대로)**: 새 시험 "기본 마피아 판의 이동 요청은 모든 소켓이 같은 move 프레임 하나를 받고…" 는 **처음부터 통과**했다(RED 아님). 앞 층에서 이미 구현된 동작의 회귀 시험이다. `npm test` 에서 고칠 실패는 없었다.

## Task Commits

| 층 | 커밋 | 내용 |
|----|------|------|
| ① | `22b7b6f9` test · `ab4750de` feat | 격자 일반화(D-04) |
| ② | `32635719` test · `91385229` feat | 구역 판정(D-13·D-14) |
| ③ | `0f5571fe` test · `09d5b9bc` feat | 마을 맵 town(D-01·D-05~D-08), MOVE_COORD_LIMIT 1200 |
| ④ | `854a8fde` test · `e77524f9` feat | 판 종류의 고정 맵·시험 잠금(D-02·D-03) |
| ⑤ | `6ea55e2d` test · `e7b9cb38` feat | 방 DO 이동 프레임 구역 거르기(D-14·D-19) |
| Task 2 | `bfba7bd3` test | 맵 잠금·재즈 바·광장 불변 회귀 |

## 바뀐 시그니처

- `shared/protocol.ts`: `MapId = "bar" | "plaza" | "town"`, `ROOM_IDS = ["post","pub","clinic","police"]`·`RoomId`, `ZONE_IDS = ["plaza", ...ROOM_IDS]`·`ZoneId`, `MOVE_COORD_LIMIT = 1200`, `MapChoice = (typeof MAP_CHOICES)[number]`(town 없음).
- `shared/game/map.ts`: `MapDef` 에 `origin?`·`walkHalf?`·`rooms?`, id 합집합에 town. `RoomDef { id, inner{x0,z0,x1,z1}, door, front, inside }`(고정소수점). `Obstacle` 에 `room?`·`cut?: true`. `cellOfFx(xFx, zFx, map?)`·`cellCenterFx(c, r, map?)` — **map 을 안 주면 재즈 바 원점**이다. 내부 `originFx(map)`·`limitFx(map)`.
- `shared/game/zones.ts`: `zoneOf(map: Pick<MapDef,"rooms">, xFx, zFx): ZoneId` · `zoneAt(map, seg, t): ZoneId` · `clipToZone(map, seg, from): Segment`.
- `shared/game/maps.ts`: `MAPS.town`, `MODE_MAPS: Partial<Record<GameMode, MapId>> = { extended: "town" }`, `startMapOf(mode, decided): MapId`.
- `shared/game/mapTown.ts`: `TOWN_ROOM_OUTER: Record<RoomId, {x0,z0,x1,z1,door:"n"|"s"|"e"|"w"}>`(바깥 벽, 고정소수점), `TOWN_ROOMS`, `HouseDef { seat, x, z, face, front }`·`TOWN_HOUSES`, `TOWN_PROPS`(방 소품 9개), `TOWN_OBSTACLES`, `TOWN_DOOR_EXEMPT`(월드 단위), `TOWN_SPAWNS`, `TOWN_PLACES`, `TOWN_MASK`, `TOWN_MAP`.
- `worker/room.ts`: `private emitMove(me: Player, seg: Segment, now: number)` — `applyMove`·`syncLayout` 이 부른다.

## 마스크 통계

- 격자 48×48(2304칸) 가운데 **걷는 칸 943**.
- **면제 덕분에 열린 칸 8** = 방마다 문턱 두 칸(문 위 이마·지붕이 머리를 덮는 칸). 그 밖의 면제 사각형 안 칸은 면제 없이도 열려 있다.
- **메운 칸 13** = 북서 모서리 가장자리(x −9.75 줄의 z −9.75…−6.75, z −9.75 줄의 x −9.75…−6.75). 북서 모서리 마당은 시계탑(높이 5.8) 뒤라 머리가 가려져 막히고, 남은 가장자리가 닿지 않아 메웠다. 북동·남동·남서 모서리 마당은 열려 있다.
- 방 안쪽 걷는 칸(소품 있음 / 소품 없음 / 안쪽 사각형 전체 칸): 우체국 22/30/40 · 술집 25/30/40 · 진료소 24/30/40 · 경찰서 26/30/40.
- 좌표(고정소수점): 방 문 앞 = 우체국 (−25,−575) · 술집 (575,−25) · 진료소 (−25,575) · 경찰서 (−575,−25). 방 안 자리 = (−25,−825) · (825,−25) · (−25,825) · (−825,−25). 집 문 앞 = 0 (−375,−675) · 1 (475,−625) · 2 (625,−525) · 3 (625,475) · 4 (475,625) · 5 (−525,625) · 6 (−625,475) · 7 (−675,−375).
- 장소(월드 단위): mail (0.75,−8.75) 우체국 · glass (8.75,−0.75) 술집 · flower (0.75,8.75) 진료소 · poster (−7.75,−1.25) 경찰서 · clock·bench·tree·fountain 은 광장 좌표 그대로.

## Deviations from Plan (계획과 달라진 곳)

### 구조

**1. Task 1 을 다섯 층의 test·feat 쌍으로 나눴다**
- 계획은 Task 마다 test·feat 한 쌍이지만, 범위가 커 중간에 끊겨도 이어 갈 수 있게 층마다 RED → GREEN 으로 커밋했다(실행 지시). 층마다 관련 시험이 초록인 상태로 끝난다.
- 예외 하나: 층 ③ 의 `09d5b9bc` 에서 `MOVE_COORD_LIMIT` 를 올리면서 화면 시험 `test/client/worldStage.test.tsx` 의 ±700 단언 한 줄이 깨졌고, 층 ④ 의 `e77524f9` 에서 고쳤다. 그 사이 한 커밋 동안 client 프로젝트에 실패 1개가 있었다(층 ③ 에서 unit 프로젝트만 돌렸다).

### Auto-fixed Issues

**2. [Rule 3 - 컴파일] MapChoice 를 고를 수 있는 값으로 좁혔다**
- **Issue:** `MapId` 에 town 을 더하면 `MapChoice = MapId | "random"` 에도 town 이 들어가 `MapChip`·`dressText` 의 표가 town 칸을 요구했다. 계획은 화면 고칠 곳을 두 줄로 봤다.
- **Fix:** `MapChoice = (typeof MAP_CHOICES)[number]`. town 은 방장이 고르는 값이 아니므로(D-02, P20-16) 가짜 이름·아이콘을 만들지 않았다. `src/game/tutorialScript.ts` 의 가짜 view 캐스트 한 줄을 `MapChoice` 로 맞췄다.
- **Commit:** `0f5571fe`

**3. [Rule 1 - 정확성] 칸 중심을 구하는 다른 호출도 맵을 넘긴다**
- **Issue:** `cellCenterFx` 를 맵 없이 부르면 재즈 바 원점이라, 마을에서 봇 배회·성능 장면의 목적지가 5칸씩 어긋난다.
- **Fix:** `shared/game/world.ts` planWander, `src/debug/perf/perfScene.ts`·`scenario.ts` 에 map 인자.
- **Commit:** `ab4750de`

**4. [Rule 1 - 시험] 좌표 한계를 고정하던 시험을 새 한계로**
- `test/unit/world.test.ts` 의 저장 슬롯 한계 두 줄(701 → 1201), `test/client/worldStage.test.tsx` 의 보내는 좌표 한계 한 줄(±700 → ±1200). 계획이 정한 한계 변경을 따라간 것이고 재즈 바·광장의 좌표·시드 시험은 고치지 않았다.
- **Commits:** `09d5b9bc`, `e77524f9`

### 계획의 단언을 바꾼 곳

**5. 걷는 안쪽 70% 의 분모**
- 계획: "안쪽 사각형 안 칸 중심 가운데 걷는 칸이 70% 이상". 벽 부풀림 0.35 때문에 소품이 없어도 30/40 = 75% 가 한계라, 치수표 B 의 소품(예: 분류함 2.0×0.4)을 두면 맞출 수 없다.
- 시험: **소품이 없을 때 걷는 칸 대비 70% 이상 · 8칸 이상**(UI-SPEC P20-19 의 "70% 이상 남아야 한다"). 실제 73%·83%·80%·87%. 전체 칸 대비로는 55%·62.5%·60%·65% 다.

**6. 문 앞·방 안·집 앞 자리의 정의식**
- 계획: "snapToWalkable(TOWN_MAP, 정의식의 점) 과 같은 리터럴". `snapToWalkable` 은 걷는 점이면 입력을 그대로 돌려줘 칸 중심이 아니다(예: 집 앞 (−500,−620)).
- 시험: 가장 가까운 걷는 칸 중심(정수 제곱거리 → 행 → 열, `snapToWalkable` 의 보정 순서와 같다)과 같은지 대조한다.

**7. "닫힌 구멍 없음" 대신 메운 칸 13개를 고정**
- 북서 모서리 가장자리 13칸이 닿지 않아 메워진다. 시험은 메운 칸이 그 가장자리뿐이고 걷는 칸이 943개임을 지킨다.

**8. Task 2 의 재즈 바 프레임 시험은 두 가지로**
- 잠금 아래 확장판 판(재즈 바)과, 고정 맵을 켠 채 고른 기본 마피아 판 둘 다 "모든 소켓이 같은 프레임 하나"를 본다.

### 더한 것

- `TOWN_ROOM_OUTER`·`TOWN_PROPS` 를 내보낸다(20-04 가 벽·소품을 그릴 때 쓴다. 소품을 뺀 래스터화에도 쓴다).
- `rasterizeGrid` 결과에 `exempted`(면제 덕분에 열린 칸).
- `clipToZone` 의 `t0` 는 `max(from, seg.t0)`. 끝에 모든 꼭짓점의 구역을 다시 확인해 어긋나면 그 자리 한 점만 돌려준다.
- `SHIPPED_MODE_MAPS`(잠그기 전 제품 표 사본) — 잠긴 시험에서도 제품 값 `{ extended: "town" }` 을 확인한다.
- 워커 시험에 유령(전체 구간)·서버 주도 배치(syncLayout)·좌표 한계 보정(T-20-02) 시험.

## 알려진 한계

- **좌석 0·7 집의 문 앞**: 문 바로 앞 칸이 시계탑 뒤라 머리 가림으로 막혀 있다. 문 앞 자리가 문 중심에서 약 1.3 떨어진 집 모서리 쪽 칸(좌석 0 은 (−3.75,−6.75), 좌석 7 은 (−6.75,−3.75))이다. 21페이즈의 집 앞 조사 자리를 정할 때 확인이 필요하다. 배치(승인 시안)는 바꾸지 않았다.
- **북서 모서리 마당**은 걸을 수 없다(시계탑 뒤).
- **화면**: 장면은 20-04 가 만든다. 지금 `threeRenderer` 는 town 을 재즈 바 장면으로 그린다 — 20-04 전에는 배포하지 않는다.

## 20-02 에 넘기는 것

- **아직 없는 것**: 문 통과 프레임(사라짐·나타남), 문 통과 시각의 알람, 구역별 snap.
  - 문턱에서 끝난 구간을 받은 사람에게는 방에 들어간 사람이 **문턱에 서 있는 것으로 남는다**. 방 안의 사람에게는 밖에서 들어오는 사람이 보이지 않는다(들어온 뒤의 다음 이동부터 보인다).
  - 방에서 나온 사람은 방에 있던 동안의 광장 사람들 위치를 받지 못해 낡은 위치를 갖고 있다.
- **아직 구역으로 거르지 않는 world 프레임**: `snapFrameFor(viewer, now)` 한 곳(handleHello·snapEachViewer·snapNewGhosts 가 쓴다)과 심부름의 `nearSnapFrame`(syncErrandView). 마을에서 재접속한 광장의 산 사람은 지금 방 안 사람의 구간도 받는다 — T-20-01 의 남은 표면이다.
- **쓸 수 있는 것**: `emitMove(me, seg, now)` 가 구역을 나누는 한 곳이다. 문턱을 넘는 시각은 `segmentEndsAt(clipToZone(map, seg, now))` 로 얻는다(들어가는 길은 안쪽 면 좌표에서, 나오는 길은 그 1 앞에서 끝난다). 구역은 `zoneAt(map, seg, t)`.
- **시험 도우미**: `openTown()`(마을 판 켜기, 되돌리는 함수 반환), `test/worker/town.test.ts` 의 지역 도우미 `townGame(phase, guests)`·`placeSeats(code, {좌석: 위치})`·`movesOf`·`zonesOf`·`line`(여러 파일에서 쓰게 되면 helpers 로 옮긴다).

## 20-04·20-07 에 넘기는 것

- **20-04(3D 장면)**: 벽은 `TOWN_ROOM_OUTER`(바깥 벽·문 있는 면) + 벽 두께 0.3·문 폭 1.5·벽 높이 2.2·이마 2.0~2.2·지붕판 2.2~2.36. `TOWN_OBSTACLES` 의 방 장애물은 `room`(방 id)·`cut`(지붕·남벽·동벽과 그 이마)로 표시되어 있다. 소품 치수는 `TOWN_PROPS`. 집은 `TOWN_HOUSES`(중심·문 있는 면·문 앞) + 몸통 2.4×2.4×1.8·지붕판 2.6×2.6(1.8~1.96). 칸 좌표는 `cellCenterFx(c, r, TOWN_MAP)` 처럼 **반드시 맵을 넘긴다**. 내 방 판정은 `zoneOf(TOWN_MAP, xFx, zFx)`.
- **20-07(맵 단추)**: `view.map` 은 town 이 될 수 있지만 `view.mapChoice`·`MapChoice` 에는 town 이 없다. `PLAYABLE_MAPS` 에도 없다. 판 종류의 고정 맵 여부는 `MODE_MAPS[mode]` 로 읽을 수 있다(시험에서는 잠겨 있으니 `openTown()`).
- **공통**: 단위·워커 시험은 고정 맵이 잠겨 확장판 판이 재즈 바에서 돈다. client 프로젝트에는 잠금이 없다(지금 깨지는 시험 없음).

## Threat Flags

없음. 새 네트워크 끝점·인증 경로·저장 스키마 변경이 없다. T-20-01(emitMove 구역 나누기)·T-20-02(±1200 스키마 + 맵 이동 한계·마스크 보정)·T-20-03(구역은 서버가 가진 구간의 위치로만 판정, 클라이언트 메시지에 구역 값 없음)은 구현하고 시험으로 고정했다. T-20-01 의 남은 표면(snap)은 위 "20-02 에 넘기는 것"에 적었다.

## Known Stubs

없음. RED 커밋의 자리 함수·자리 값(zones.ts, mapTown.ts, MODE_MAPS·startMapOf)은 모두 구현 커밋에서 실제 구현으로 바뀌었다.

## 그 밖

- spec-less probe fallback 건너뜀: 요구사항 ID 없음 — ROADMAP 성공 기준과 20-CONTEXT D-nn 으로 대신했다.
- `docs/architecture.md` 의 맵 줄(`PLAYABLE_MAPS = ["bar","plaza"]`)은 그대로 맞다. town·MODE_MAPS 설명은 더하지 않았다(이 계획의 범위 밖).
- push·배포·HANDOFF 갱신은 하지 않았다(20-10).

## Self-Check: PASSED

- 새 파일 6개와 SUMMARY 가 있다.
- 커밋 11개(`22b7b6f9` … `bfba7bd3`)가 모두 HEAD 의 조상이다.
