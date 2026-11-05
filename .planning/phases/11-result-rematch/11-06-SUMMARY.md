---
phase: 11-result-rematch
plan: "06"
subsystem: shared-game / worker-room
tags: [map-select, plaza, mapPick, leak-L40, leak-L42, tdd]
requires: ["11-04"]
provides:
  - "MAPS·mapOf·PLAYABLE_MAPS·decideMap·pickMap·roomMapId (shared/game/maps.ts)"
  - "PLAZA_OBSTACLES·PLAZA_MASK·PLAZA_SPAWNS·PLAZA_MAP (shared/game/mapPlaza.ts)"
  - "mapPick 와이어, view.mapChoice / view.map, 방 DO mapDef()"
affects: [11-08, 11-10, 11-13]
tech-stack:
  added: []
  patterns: ["맵은 데이터 표 한 줄 등록", "허용 맵은 PLAYABLE_MAPS 한 곳에서 잠금", "거절은 오류 없이 보낸 소켓 state 한 프레임"]
key-files:
  created:
    - shared/game/maps.ts
    - shared/game/mapPlaza.ts
    - test/unit/maps.test.ts
    - test/worker/mapPick.test.ts
  modified:
    - shared/protocol.ts
    - shared/schemas.ts
    - shared/game/map.ts
    - shared/game/room.ts
    - shared/game/view.ts
    - shared/game/testTools.ts
    - worker/room.ts
    - test/unit/map.test.ts
    - test/unit/gather.test.ts
    - test/unit/schemas.test.ts
    - test/unit/testTools.test.ts
    - test/unit/view.test.ts
    - test/worker/leak.test.ts
decisions:
  - "연단 막힘 반지름은 아래 단 윗면 1.4 (계약의 1.45 가 아니다) — 1.45 면 RUNOFF_SPOTS 가 막힌 칸에 닿는다"
  - "광장 시작 snap 은 emitWorld 가 아니라 snapEachViewer 로 보낸다 (assigning 은 world 받는 사람 집합이 비어 있다)"
  - "MapDef.id 는 import 없이 \"bar\" | \"plaza\" 합집합으로 적는다 (map.ts 소스 규약 시험이 import 를 금지한다)"
metrics:
  duration: "약 20분"
  completed: "2026-11-05"
status: complete
actuals:
  tokens: 13000
  tasks: 3
  commits: 7
plan_head_before: 942d0c689c953aaa7e01ce01317a8bcbcc63817a
plan_head_after: 6e96692dc5100018bdd7ce338285d88a9a7f7cf6
---

# Phase 11 Plan 06: 맵 선택 서버·공용 쪽 Summary

맵 표(MAPS)에 지하 재즈 바와 시계탑 광장을 등록하고, 방장의 mapPick·시작 때 서버가 정하는 map·방의 맵을 읽는 이동 판정을 세웠다. `PLAYABLE_MAPS = [bar]` 로 광장 노출을 잠가 두어 random 은 늘 bar, mapPick plaza 는 거절된다.

## 한 일

- **Task 1 (트레이서)**: `MapId`·`MapChoice`·`mapPick`(strictObject enum)·`view.mapChoice`(항상)·`view.map`(시작 뒤에만). `startGame` 이 역할 난수 뒤에 `decideMap` 으로 `map` 결정(허용 맵이 하나라 난수 호출 추가 없음, 시드 시험 불변). `resetToLobby` 는 `mapChoice` 유지·`map` 버림. 방 DO 는 `BAR_MAP` 직접 참조 아홉 곳을 `mapDef()` 한 헬퍼로 바꿨다. 트레이서 검증 재실행 통과 후 확장.
- **Task 2**: `mapPlaza.ts` — 장애물 원문 12개(plaza.js), 28x28 마스크(재즈 바와 같은 규칙으로 만든 래스터화, 닫힌 구멍 0), 입장 지점 8곳, `PLAZA_MAP`. `MAPS` 를 `Record<MapId, MapDef>` 로 좁혀 plaza 등록. 모든 n=2..8 둘레 자리·결선 자리·무대 자리가 광장 마스크에서 걸을 수 있고 입장 지점에서 경로가 이어진다. 워커 시험이 광장 판에서 광장 마스크로 이동이 판정됨을 확인.
- **Task 3**: 누설 L42(시작 전 map 키 0건, 시작 뒤 신분 무관 동일, 새 view 경로는 `.view.mapChoice`·`.view.map` 둘뿐), L40(대기실·판 중·결과 단계의 모든 거절이 보낸 소켓 state 한 프레임, 오류·다른 소켓 0프레임), 광장 시작 snap 시험.

## 시험

`npx vitest run` 대상: maps·gameRoom·testTools·view·schemas·map·gather·e2eContract(단위), start·testTools·bots·mapPick·leak(워커) 전부 통과. `npm run typecheck` 는 이 계획 파일 오류 0 (남은 오류는 11-05 의 resultLogStore.test.ts 진행 중 작업).

## Deviations from Plan

**1. [Rule 1 - Bug] 광장 시작의 snap 이 아무에게도 가지 않음**
- **Found during:** Task 3 (snap 시험이 0건을 받았다)
- **Issue:** 계약은 시작 뒤 `emitWorld(snapFrame)` 이었으나 `assigning` 은 MAP_PHASES 가 아니라 `audience(world)` 가 빈 집합이다.
- **Fix:** `respawnAll` 뒤 `markWorldDirty` + `snapEachViewer(now)`(보는 사람 한 명씩 `worldVisibleTo`, assigning 은 방 전원).
- **Files:** worker/room.ts — **Commit:** 049a6938

**2. [Rule 1 - 해석] 연단 막힘 반지름 1.45 → 1.4**
- **Found during:** Task 2 (결선 자리 시험 실패)
- **Issue:** 계약 r1.45 로 만든 마스크에서 RUNOFF_SPOTS (10,200)·(200,10)(gather.ts 상수, 이 계획이 고치지 않는다)이 격자선 위라 막힌 칸(중심 거리 1.768 < 1.8)에 닿아 서 있을 수 없다. plaza.js 연단 아래 단은 `cyl(1.4, 1.45)` 로 윗면 1.4·밑면 1.45 다.
- **Fix:** 막힘 반지름을 윗면 1.4 로(1.75 에서 그 칸이 열린다, 차 0.018). 계획이 허용한 "연단 반지름 점검" 범위이며 MapDef 의 ring 표는 필요 없었다.
- **Files:** shared/game/mapPlaza.ts, test/unit/map.test.ts — **Commit:** 2ce160f2

**3. [Rule 3 - 막힘] map.ts 에 import 를 둘 수 없음**
- `MapDef.id` 를 `MapId` 로 넓히려고 넣은 `import type` 이 map.ts 소스 규약 시험(import 금지)을 깼다. 같은 합집합 `"bar" | "plaza"` 를 직접 적었다(어긋나면 `MAPS: Record<MapId, MapDef>` 가 컴파일에서 잡는다). 23e5df9e 에는 이 import 가 있었고 2ce160f2 에서 고쳤다(중간 한 커밋에서 map.test 소스 규약이 빨갰다).

**4. [Rule 3] 선행 typecheck 오류 수정**
- test/worker/leak.test.ts 11-04 의 `rec.left` 읽기가 `StoredRoom` 에 `seat` 가 없어 typecheck 를 막았다. 캐스팅으로 고침 (80102a06).

## 하지 않은 것

- STATE.md·ROADMAP.md·REQUIREMENTS.md 갱신/커밋은 요청대로 건너뜀. MAP-06 은 선택 화면(11-13)까지 끝나야 완료다.
- 전체 회귀·nightload·웨이브 게이트(build, ui.safety-gate, schema-drift)는 요청대로 돌리지 않음.
- 알려진 flaky(workers testTools 'ended')는 한 번 실패 후 단독 재실행에서 통과.

## 이월 메모

- 맵 표·규칙: `shared/game/maps.ts` — `MAPS`, `mapOf(id)`, `PLAYABLE_MAPS`(지금 `["bar"]`), `decideMap(choice, randInt, playable?)`, `pickMap(state, actorId, choice, playable?)`, `roomMapId(state)`. 광장 데이터: `shared/game/mapPlaza.ts` 의 `PLAZA_MAP`(`PLAZA_MASK`·`PLAZA_SPAWNS`·`PLAZA_OBSTACLES`).
- 와이어: `ClientMessage {t:"mapPick", map: MapChoice}`, 타입 `MapId = "bar"|"plaza"`, `MapChoice = MapId|"random"`, 값 목록 `MAP_CHOICES`(protocol.ts). 거절은 오류 프레임 없이 보낸 소켓에 state 한 프레임(L40).
- view 키: `view.mapChoice`(항상, 기본 random), `view.map`(시작 뒤에만, 대기실엔 키 없음). RoomState: `mapChoice?`·`map?`. `resetToLobby` 는 mapChoice 유지·map 버림.
- 방 DO: `mapDef()` = `mapOf(roomMapId(room))` (대기실은 늘 bar). 광장 시작은 `handleStart` 안 `respawnAll` + `snapEachViewer` — emitWorld 는 assigning 에서 빈 집합이라 쓰지 않는다.
- `PLAYABLE_MAPS` 를 `["bar","plaza"]` 로 바꾸는 시점은 **11-13**(광장 장면 11-10·선택 화면 뒤). 바꾸면 random 이 광장을 뽑아 `leak.test.ts`·`mapPick.test.ts` 의 "PLAYABLE=[bar]" 단언(`decideMap`/`pickMap` 단위 시험 포함)을 함께 고쳐야 한다. 광장 시작 시험은 `PLAYABLE_MAPS` 배열을 임시로 push 해 우회한다.
- 11-08 rematch 는 시작과 같은 방식으로 `decideMap(state.mapChoice ?? "random", randInt)` → `respawnAll(..., mapOf(map))` → `snapEachViewer` 를 부르면 된다(다시 하기가 대기실 로비를 거치면 로비 위치는 bar).
- 광장 마스크는 장애물이 바뀌면 `MAP_PRINT=1 npx vitest run test/unit/map.test.ts -t 래스터화` 의 PLAZA 출력으로 다시 만든다. 광장 왼쪽 위(시계탑 뒤) 넓은 영역은 카메라 쪽 광선 규칙으로 막혀 있다.
- 11-10 광장 장면은 `PLAZA_SPAWNS` yaw 없음(카메라 쪽 π/4)과 연단 막힘 반지름 1.4(보이는 연단 밑면은 1.45)를 알아야 한다.

## Self-Check: PASSED

- 파일 존재: shared/game/maps.ts, shared/game/mapPlaza.ts, test/unit/maps.test.ts, test/worker/mapPick.test.ts 확인.
- 커밋 존재: 241594db, 23e5df9e, 80102a06, ddab5744, 2ce160f2, 57231a4d, 049a6938 모두 HEAD 의 조상.
