---
phase: 20-map-expansion
plan: "04"
subsystem: world-3d
tags: [map, town, three, scene, cutaway, atlas, palette, camera, tdd]
status: complete

requires:
  - phase: 20-map-expansion
    provides: "20-01 — shared/game/mapTown.ts 의 TOWN_ROOMS·TOWN_ROOM_OUTER·TOWN_OBSTACLES(room·cut 표시)·TOWN_PROPS·TOWN_HOUSES"
provides:
  - "src/world/maps/town.ts — buildTownScene(budget): MapScene, CUTAWAY_MS 250, TOWN_ATLAS·atlasUv·atlasCellAt, 아틀라스 그리기 함수 drawSignCell·drawSeatCell·drawBlankCell"
  - "MapScene 선택 훅 셋(src/world/maps/types.ts): setCutaway(open, instant) · setOwners(seats) · roofs()"
  - "src/world/palette.ts — SEAT_COLORS(--seat-1~8) · TOWN_PALETTE · TOWN_LIT(indoor·houseOwned)"
  - "src/world/camera.ts — panBoxOf(mapId) · plateFarOf(mapId) (마을 시작값 ±9.6 · 22)"
  - "src/world/maps/plaza.ts — buildPlaza(budget, opts)·PlazaOpts·PlazaPiece·PlazaPieceCtx (buildPlazaScene 결과는 그대로)"
affects: [20-05, 20-06, 20-08, 20-09, 21]

actuals:
  tokens: 20200
  tasks: 2
  commits: 4

plan_head_before: 7f2da588e3b2c39a224a29a1579332b3233f0fe3
plan_head_after: 6543f4263cbc20fe0093b47c5db43776f2430589
commits: 4

tech-stack:
  added: []
  patterns:
    - "맵 장면을 늘릴 때 가운데가 같으면 빌더를 복사하지 않는다 — buildPlaza 의 선택 인자(건물 앞면·바닥 판·연장 판)와 덧붙일 조각(PlazaPiece: 메시·재질 보정 대상·setLook·applyBudget·update·dispose·hooks)으로 얹는다"
    - "방·집의 벽·문·소품은 서버의 장애물 원문(TOWN_OBSTACLES 의 room·cut 표시)을 그대로 상자로 세운다 — 좌표를 두 벌 두지 않는다"
    - "글 없는 그림(간판·문패)은 아틀라스 한 장 + UV 로 가리킨다. 주인이 바뀌면 지오메트리를 다시 만들지 않고 UV 만 고친다"
    - "아틀라스 그리기는 캔버스 2D 문맥을 인자로 받는 함수 — 시험은 흉내 객체로 부르고, 캔버스가 없는 환경은 1×1 텍스처로 대신한다(UV·메시 구성은 같다)"
    - "걷힘은 재질 불투명도 하나: 1 = 불투명·깊이 쓰기 켬, 도중 = 투명·깊이 쓰기 끔, 0 = 메시 끔"

key-files:
  created:
    - src/world/maps/town.ts
    - test/unit/townScene.test.ts
  modified:
    - src/world/maps/plaza.ts
    - src/world/maps/types.ts
    - src/world/palette.ts
    - src/world/camera.ts
    - test/unit/palette.test.ts

key-decisions:
  - "마을 장면은 광장 빌더를 선택 인자로 다시 부른다(buildPlaza) — 방·집은 PlazaPiece 조각 하나로 덧붙고 단계 조명·핀 조명·강등·시계 틱·dispose 가 같은 흐름을 탄다"
  - "간판·문패·지붕 표식은 발광이 아니라 조명을 받는 재질이다(벽·연단과 같은 칠) — 램프 금빛 발광은 벽등·문턱 띠뿐이고 시민 편 밤에 간판이 혼자 빛나지 않는다"
  - "방 등·집 창의 배율은 TOWN_LIT 값에 가로등과 같은 어둡게 하기(핀 조명·긴장 2단계)를 곱한다 — 핀이 없으면 표 값 그대로다"
  - "걷힘 따라가기는 선형(1/0.25초)이다 — 도중에 방향이 바뀌어도 지금 값에서 이어가는 것을 먼저 지켰다"
  - "집 문패는 높이 1.25~1.75 에 붙인다 — 1.4~1.9 는 윗부분 0.1 이 지붕판 처마(1.8~1.96, 0.1 내밈)에 먹힌다"

requirements-completed: [D-05, D-06, D-07, D-09, D-10, D-20, D-21]

coverage:
  - id: D1
    description: "마을 장면이 광장 가운데(연단·시계탑·가로등·시계 바늘·단계 조명 7칸)를 그대로 쓰고 광장 뒤 건물 앞면은 만들지 않으며 바닥 판은 24×24, 연장 판 반폭은 22 다. 광장 장면 결과는 바뀌지 않는다"
    requirement: "D-05"
    verification:
      - kind: unit
        ref: "test/unit/townScene.test.ts#마을 장면 구조 (D-05·D-06·D-07·D-21)"
        status: pass
      - kind: unit
        ref: "npx vitest run test/unit/plazaScene.test.ts (고치지 않은 채 32 통과)"
        status: pass
    human_judgment: false
  - id: D2
    description: "방 넷의 컷 메시가 바깥 윤곽 안에 서고 꼭대기 2.36, 뒷벽 2.2. 색은 TOWN_PALETTE(벽 #3a3f4b·지붕 #2a2f45·띠 #6b7180·바닥 널 #4a3f36/#42382f·소품 #6b5a48)"
    requirement: "D-06"
    verification:
      - kind: unit
        ref: "test/unit/townScene.test.ts#방 넷의 컷 메시(지붕·앞벽)가 방 id 이름으로 있고 바깥 윤곽 안에 서며 꼭대기가 2.36 이다"
        status: pass
      - kind: unit
        ref: "test/unit/palette.test.ts#마을 3D 팔레트 SEAT_COLORS · TOWN_PALETTE · TOWN_LIT"
        status: pass
    human_judgment: true
  - id: D3
    description: "집 여덟(꼭대기 1.96)의 문패·지붕 표식이 주인 좌석 칸(좌석 색 원 + 얼굴)을, 주인 없는 집은 빈 판 칸을 가리키고 창은 주인 있는 집만 켜진 묶음에 든다"
    requirement: "D-07"
    verification:
      - kind: unit
        ref: "test/unit/townScene.test.ts#집 주인 setOwners (D-07, P20-6)"
        status: pass
    human_judgment: true
  - id: D4
    description: "얼굴 그림이 오기 전에는 좌석 색 원만 그리고, 오면 그 칸만 다시 그려 텍스처를 올린다. 얼굴은 같은 출처 경로만 부르고 dispose 뒤에 온 것은 버린다"
    requirement: "D-07"
    verification:
      - kind: unit
        ref: "test/unit/townScene.test.ts#아틀라스 그리기 함수 (UI Considerations partial, D-20)"
        status: pass
    human_judgment: false
  - id: D5
    description: "방 벽등·문턱 띠는 TOWN_LIT.indoor, 주인 있는 집 창은 houseOwned 배율을 받고 시민 편 밤은 둘 다 0, 점광원은 3 그대로다"
    requirement: "D-09"
    verification:
      - kind: unit
        ref: "test/unit/townScene.test.ts#마을 조명 열 TOWN_LIT (D-09, P20-13)"
        status: pass
    human_judgment: false
  - id: D6
    description: "setCutaway 가 방마다 지붕·앞벽·간판을 0.25초에 걷고 덮는다(도중에 이어감·instant·0 이면 메시 끔). 뒷벽·바닥·소품·벽등은 남는다"
    requirement: "D-10"
    verification:
      - kind: unit
        ref: "test/unit/townScene.test.ts#컷어웨이 재질 따라가기 setCutaway (D-10, P20-7)"
        status: pass
    human_judgment: true
  - id: D7
    description: "간판 그림 넷(봉투·잔·십자·방패)은 어두운 판 위 램프 금빛 선 1.8·둥근 끝이고 글자가 없다. 방 간판은 자기 방의 아틀라스 칸을 가리킨다"
    requirement: "D-20"
    verification:
      - kind: unit
        ref: "test/unit/townScene.test.ts#간판 그림 넷은 어두운 판 위에 램프 금빛 선(굵기 1.8·둥근 끝)으로만 그린다"
        status: pass
    human_judgment: true
  - id: D8
    description: "마을 정적 그리기 호출 36 이하(잰 값 최대 30), 8명 포함 120 이하(최대 89), 건물은 그림자를 받기만, 강등 4단계는 간판·지붕 표식·방 소품을 끈다"
    requirement: "D-21"
    verification:
      - kind: unit
        ref: "test/unit/townScene.test.ts#마을 그리기 예산 (D-21, P20-17, T-20-15) · 마을 예산 사다리 (P20-17, 강등 4단계)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-11-13
---

# Phase 20 Plan 04: 마을 3D 장면 Summary

**광장 빌더를 선택 인자로 다시 불러 가운데를 그대로 쓰고, 방 넷(걷히는 지붕·앞벽·지붕 위 간판)과 집 여덟(문패·지붕 표식·주인 창)을 병합 묶음으로 덧붙인 `buildTownScene` — 정적 그리기 호출 최대 30, 점광원 3 그대로.**

## Performance

- **Duration:** 약 20분
- **Started:** 2026-11-12T22:04:45Z
- **Completed:** 2026-11-12T22:25:00Z
- **Tasks:** 2
- **Files modified:** 7 (새 파일 2)

## Accomplishments

- `buildTownScene(budget)`: 광장 가운데(연단·시계탑·벤치·나무·가로등·시계·단계 조명 7칸)를 복사 없이 다시 쓰고 건물 앞면 넷은 뺐다. 바닥 판 24×24, 연장 판 44×44.
- 방 넷: 서버의 장애물 원문(`TOWN_OBSTACLES` 의 `room`·`cut`)을 그대로 세운 뒷벽·앞벽·이마·지붕, 실내 바닥 널 두 색, 소품, 벽등 하나, 문턱 띠, 지붕 위 간판(봉투·잔·십자·방패 — 글 없음).
- 집 여덟: 몸·지붕판·문 칸·창(면마다 둘), 문 위 문패와 지붕 위 표식(같은 아틀라스 칸).
- `setCutaway(open, instant)`·`roofs()`: 방마다 지붕·앞벽·간판의 불투명도가 0.25초에 목표를 따라간다(도중에 이어감, instant, 0 이면 메시 끔).
- `setOwners(seats)`: 켜진 창·꺼진 창 묶음을 다시 만들고 문패·표식의 UV 를 좌석 칸(좌석 색 원 + 얼굴)이나 빈 판 칸으로 돌린다. 얼굴이 오기 전에는 좌석 색 원만 보인다.
- 팔레트 셋(`SEAT_COLORS`·`TOWN_PALETTE`·`TOWN_LIT`)과 카메라 맵별 표(`panBoxOf`·`plateFarOf`).

## 검증 결과

| 명령 | 결과 |
|---|---|
| `npx vitest run test/unit/townScene.test.ts test/unit/plazaScene.test.ts test/unit/barScene.test.ts test/unit/palette.test.ts test/unit/camera.test.ts test/unit/lighting.test.ts test/unit/ladder.test.ts` (Task 1 verify) | 7 파일 · 245 통과 · 1 건너뜀 · 실패 0 |
| `npx vitest run test/unit/townScene.test.ts test/unit/plazaScene.test.ts test/unit/palette.test.ts` (Task 2 verify) | 3 파일 · 72 통과 · 실패 0 (townScene 33 · plazaScene 32 · palette 7) |
| `npx vitest run --project unit --project client` | 232 파일 통과 · 1 건너뜀 / 시험 7837 통과 · 183 건너뜀 · 실패 0 |
| `npm run typecheck` | 종료 0, `error TS` 0 |
| 위생 `grep -nIiE …` (바뀐 파일) | 결과 0 |

plazaScene.test.ts 는 고치지 않았다(32 통과) — 광장 장면 결과 불변.
워커 시험(`--project worker`)과 E2E 는 돌리지 않았다(이 계획은 서버·화면 연결을 건드리지 않는다).

## RED 증거

`--reporter=tap-flat` 출력을 `gsd-tools check tdd-red-evidence` 에 넘겼다. 기록은 gitignore 된 `.gsd/red/20-04-t1*`·`20-04-t2*`.

- **Task 1 RED**: `npx vitest run test/unit/townScene.test.ts --reporter=tap-flat` → 17 중 **not ok 13** · ok 4, 종료 1, `RED_EVIDENCE_OK`(target_test_failed). 대상 "방 넷의 컷 메시(지붕·앞벽)가 방 id 이름으로 있고…" 가 `post: expected undefined to be an instance of Mesh`(자리 장면이 광장 그대로라 컷 메시 없음)로 실패. 통과한 4개는 광장에서도 참인 것(점광원 3·가운데 소품·재질 수·setLighting)이다. palette.test 의 새 시험 3개도 같은 실행에서 실패했다(`expected [] to have a length of 8 but got +0` 등 — 두 파일을 함께 넘긴 기록은 여러 줄 YAML 때문에 분류기가 `invalid_record` 로 읽지 못해 townScene 만으로 다시 기록했다).
- **Task 2 RED**: 같은 명령 → 32 중 **not ok 10** · ok 22, 종료 1, `RED_EVIDENCE_OK`. 대상 "처음에는 넷 모두 덮여 있다. 한 방을 열면 0.25초에 따라간다…" 가 `expected 1 to be close to 0.6`(setCutaway 가 자리라 그대로 1)로 실패. 그 밖: `CUTAWAY_MS` `expected undefined to be 250`, 켜진 창 `expected +0 to be 24`, `drawSeatCell is not a function`.

## Task Commits

1. **Task 1 RED** — `55e3104f` test(20-04): 마을 장면 실패 시험
2. **Task 1 GREEN** — `30eb26f4` feat(20-04): 마을 장면 — 방 넷·집 여덟·간판·문패·조명 열
3. **Task 2 RED** — `fa430d49` test(20-04): 컷어웨이·집 주인 실패 시험
4. **Task 2 GREEN** — `6543f426` feat(20-04): 컷어웨이 재질 따라가기·집 주인 창·문패

## 참고 자료 (design-refs)

| 경로 | 가져온 요소 |
|---|---|
| `design/v3.0/town-map/README.md` | A 안의 방·집 자리(값은 mapTown 표로 읽음), 색 규칙(낮은 채도 남색·회색, 간판 그림만 램프 금빛, 실내 바닥 따뜻한 갈색, 방마다 등 하나, 집은 방보다 어둡고 작음), 컷어웨이(남·동 벽과 지붕 0.25초) |
| `design/v3.0/town-map/Cutaway.dc.html` | 방 몸 `#3a3f4b` + 윤곽 `#6b7180` + 지붕 가운데 금빛 봉투(`rect 5 7 14 11 rx 2` · `M5 9l7 5 7-5`, 선 1.8·둥근 끝), 안 바닥 `#4a3f36`·소품 `#6b5a48`, 문 앞 금빛 띠 |
| `design/v3.0/town-map/Main.dc.html` | 배치 확인(방은 변 가운데·문은 광장 쪽 금빛 띠·집은 모서리 둘씩 `#2b2f38` + `#6b7180`). 보드의 글자·집 원 색은 쓰지 않음 |
| `public/characters/faces/face-2.png` | 얼굴 그림 구도 확인(머리·어깨가 200×200 을 채움) — 원의 바깥 사각형에 맞춰 얹고 원으로 자른다. 다시 그리지 않음 |

열지 못한 참고 자료: 없음. 쓰지 않은 것: 시안 B(`Corners.dc.html`), 보드의 글자·금빛 점선, 진홍.

## 그리기 단위

광장 것(shell·furniture·furnitureFar·brass·emissiveRoom·emissiveTower·glowRoom·glowTower·plate·시계 바늘 4)에 더한 메시다. 마을에는 `emissiveRoomFar`(건물 창)가 없다.

| 이름 | 재질 | 병합한 것 | 강등 4단계 |
|---|---|---|---|
| `roomStatic` | 광장 소품 재질(공유) | 뒷벽·뒷벽에 난 문의 벽 조각과 이마 12 + 바닥 널 28 | 유지 |
| `roomProps` | 광장 소품 재질(공유) | 방 소품 9 | **끔** |
| `cut-post`·`cut-pub`·`cut-clinic`·`cut-police` | 방마다 하나(불투명도용, 소품 재질 복제) | 지붕판 1 + 가장자리 띠 4 + 앞벽 둘(문이 앞벽이면 벽 조각 둘·이마) | 유지 |
| `sign-{방}` × 4 | 방마다 하나(아틀라스 텍스처 공유) | 간판 판 1 + 기둥 1 | **끔** |
| `emissiveIndoor` | 발광 하나(`TOWN_LIT.indoor`) | 벽등 구 4 + 문턱 띠 4 | 유지 |
| `glowIndoor` | 빛 무리 하나(같은 열, 5단계에서 끔) | 빛 무리 쿼드 4 | 유지 |
| `houseBody` | 광장 소품 재질(공유) | 몸 8 + 지붕판 8 + 문 칸 8 | 유지 |
| `houseWinLit` | 발광 하나(`TOWN_LIT.houseOwned`) | 주인 있는 집 × 창 8 (없으면 꺼짐) | 유지 |
| `houseWinDark` | 광장 소품 재질(공유) | 주인 없는 집 × 창 8 (없으면 꺼짐) | 유지 |
| `housePlate` | 아틀라스 재질 하나(알파 시험) | 문 위 문패 8 | 유지 |
| `houseMark` | 같은 아틀라스 재질 | 지붕 표식 8 + 기둥 8 | **끔** |

## 잰 값

| 무엇 | 값 |
|---|---|
| 정적 그리기 호출(보이는 메시, 캐릭터 없음) — 단계별 | 주인 0·8명: 26~29 · 주인 3명(창 두 묶음 다 보임): 27~**30** (최대는 trial) — 상한 36 |
| 광장 장면 같은 값 | 12~14 |
| 8명 포함 보이는 메시 + 그림자 메시 | 85~**89** — 상한 120 |
| 네 방 모두 걷힘(trial) | 정적 21~22 (방마다 둘씩 준다) |
| 강등 4단계(trial) | 정적 22~23 |
| 보이는 삼각형(캐릭터 없음) | 약 7100 (광장 약 5170) |
| 고유 재질 · 텍스처 | 25 · 2(빛 무리 + 아틀라스) |
| 점광원 | 3 (그대로) |

## 시안과 다르게 한 곳 (UI-SPEC 기본값 기록을 그대로 따른 것)

- **P20-4** 간판은 문 위 벽이 아니라 지붕 위 판(1.2×1.2, 기둥 0.3) — 지붕과 함께 걷힌다.
- **P20-5** 우체국은 우체통이 아니라 봉투(시안 Cutaway 의 경로 그대로).
- **P20-6** 집 문패는 문 위 벽 + 지붕 위 표식 두 곳, 같은 그림.
- **P20-7** 금빛 점선 테두리는 3D 에 옮기지 않았다.

## Deviations from Plan (계획과 달라진 점)

### 구현이 정한 것

1. **방 등·집 창의 배율에 가로등과 같은 어둡게 하기를 곱한다** — 계획은 `TOWN_LIT` 배율만 적었다. 핀 조명·긴장 2단계 때 가로등은 어두워지는데 방 등·집 창만 밝게 남으면 핀이 약해진다. 핀이 없으면 표 값 그대로다(시험이 둘 다 고정).
2. **간판·문패·표식은 조명을 받는 재질**(`MeshStandardMaterial` + 아틀라스) — 계획·UI-SPEC 은 발광 여부를 정하지 않았다. 조명 표에 간판 열이 없고 시민 편 밤에 간판만 빛나면 안 되므로 벽과 같은 칠로 두었다. 낮·밤에 그림이 잘 읽히는지는 20-05 연결 뒤 화면에서 확인할 것.
3. **걷힘 따라가기는 선형** — UI-SPEC P20-7 은 `--ease-out` 이고 계획은 "1/0.25초 속도로 따라가고 지금 값에서 이어간다"다. 계획을 따랐다.
4. **집 문패 높이 1.25~1.75** — 계획·UI-SPEC 은 1.4~1.9. 지붕판 처마(1.8~1.96, 0.1 내밈)에 윗부분이 먹혀 지붕판 아래로 내렸다(문 꼭대기 1.2 위).
5. **간판·표식 판의 아랫변을 기둥 꼭대기(0.3·0.25)에 맞췄다** — UI-SPEC 의 "지붕 위 0.35 띄움"과 0.05 차이. 기둥과 판 사이 틈을 없앴다.
6. **술집 벽등은 서벽의 문 옆** — "뒷벽 가운데"가 아니다. 북벽 가운데에는 술병 선반(높이 1.3~1.7)이 걸려 있고 서벽 가운데는 문이다. 나머지 셋은 뒷벽 가운데(우체국 북벽, 진료소·경찰서 서벽).
7. **지붕 가장자리 띠는 지붕판과 같은 두께의 둘레 띠**(안쪽 판 + 띠 넷) — 띠를 위에 얹으면 꼭대기가 2.36 을 넘는다.

### 계획의 시험을 고친 곳

- Task 1 RED 시험의 재질 수 상한 24 → **26**(잰 값 25 = 광장 13 + 컷 4 + 간판 4 + 방 발광·집 창·빛 무리·아틀라스 4). RED 를 쓸 때 광장 재질 수를 잘못 세었다.
- Task 1 RED 시험의 "강등 4단계에서 켜진 창이 남는다" 단언을 Task 2 시험으로 옮겼다 — 켜진 창은 `setOwners` 가 채워져야 생긴다.

### 더한 것

- 시험 "캔버스가 있는 환경: …"(문서·Path2D·Image 를 흉내 내 아틀라스의 브라우저 경로를 끝까지 돈다). Task 2 GREEN 뒤에 더한 회귀 시험이라 RED 가 없다.
- `plaza.ts` 의 `applyBudget` 은 `emissiveRoomFar` 가 없을 때를 건너뛴다(마을에는 건물 창 묶음이 없다 — 빈 묶음은 병합할 수 없다).
- SUMMARY 는 Task 2 커밋이 아니라 별도 docs 커밋이다(실행 규칙).

## 알려진 한계

- **화면에 아직 안 나온다**: `threeRenderer` 는 town 을 재즈 바 장면으로 그린다. 연결은 20-05. 이 계획의 장면은 단위 시험으로만 확인했고 **실제 화면(색·간판 읽힘·걷힘 연출)은 보지 못했다**.
- **브라우저의 아틀라스 경로는 흉내 객체로만 시험했다**(캔버스 2D·Path2D·Image). 실제 캔버스에 그려진 그림은 20-05 연결 뒤 확인.
- **불투명 ↔ 투명 전환은 `material.needsUpdate` 를 건다** — 첫 걷힘 때 투명 변형 셰이더가 한 번 컴파일된다(방 넷이 같은 프로그램을 나눠 쓴다). 끊김이 보이면 20-05 가 맵을 올릴 때 미리 컴파일한다.
- **자갈 판(±6.98)이 방 안쪽(±6.9)으로 0.08 들어온다** — 문 벽 안쪽에 높이 0.08·폭 0.08 의 자갈 띠가 보인다(문턱처럼 읽힌다). 실내 바닥 널은 UI-SPEC 대로 바닥 판 위 0.02 다.
- **간판 판은 지붕보다 약 1.3 높다** — 남·동 방(진료소·술집)의 간판이 그 뒤 바닥에 선 사람의 아랫몸을 조금 더 가린다(머리 가림 마스크는 지붕까지만 본다, P20-4 가 정한 크기).
- **집 창 가운데 북·서 면의 것은 카메라에서 안 보인다**(뒷면). 치수표 C 대로 면마다 둘을 만들었다.
- 분필(P20-18)은 고치지 않았다 — 닫힌 방 안의 분필은 밖에서 안 보인다(21 이 정한다).

## 20-05 에 넘기는 것

- **장면 만들기**: `import { buildTownScene, CUTAWAY_MS } from "./maps/town"` → `threeRenderer` 의 mapId 선택에 `town` 을 더한다. 돌려주는 것은 `MapScene` 이고 마을에서만 `setCutaway`·`setOwners`·`roofs` 가 있다(다른 맵은 `undefined` — `scene.setCutaway?.(…)` 로 부른다).
- **`setCutaway(open: ReadonlySet<RoomId>, instant: boolean)`**: 열 방의 집합을 넘긴다(목표만 바뀜). 따라가기는 `scene.update(dt, t)` 가 한다 — **매 프레임 `update` 를 불러야 걷힌다**(광장 시계와 같은 훅, dt 는 초). 언제 걷을지는 런타임 몫이다: 내 몸의 그려진 위치가 방 안쪽이면 그 방(`zoneOf(TOWN_MAP, xFx, zFx)`), 유령·탈락자 관전·결과 화면은 `new Set(ROOM_IDS)`, 그 밖은 빈 집합.
- **instant 를 쓸 곳**: 맵 처음 올림·재접속·WebGL 컨텍스트 복원(`recreate`) 뒤 — 장면을 새로 만들면 네 방 모두 덮인 상태(1)로 시작하므로 지금 목표를 `instant: true` 로 한 번 놓는다. 모션 줄이기도 `instant: true`.
- **`setOwners(seats: readonly number[])`**: 이번 판에 앉은 좌석 번호(0~7). 판 시작·재접속·`recreate` 뒤에 한 번. 부르기 전에는 모든 집이 주인 없는 집이다. 얼굴은 장면이 스스로 부른다(`faceSrc`).
- **`roofs(): Record<RoomId, number>`**: 지금 불투명도(1 덮임 ~ 0 걷힘) — `__mfTown` 시험 훅이 읽는다.
- **`CUTAWAY_MS = 250`**: 20-08 의 E2E 기다림·문 통과 연출(0.2초)과 맞출 때 읽는다.
- **카메라**: `panBoxOf("town")` ±9.6 · `plateFarOf("town")` 22 는 **시작값**이다. camera.test 의 가시성·빈 배경 검사를 마을 격자로 돌려 확정하고(P20-15), 값을 바꾸면 `townScene.test` 의 `plateFarOf("town")` 단언 22 도 같이 고친다. 연장 판은 장면이 `plateFarOf("town")` 로 만든다.
- **메시 이름**(`scene.meshes`): `roomStatic`·`roomProps`·`cut-{방}`·`sign-{방}`·`emissiveIndoor`·`glowIndoor`·`houseBody`·`houseWinLit`·`houseWinDark`·`housePlate`·`houseMark`. 지붕·집 누르기(20-06, P20-11)의 광선 시험은 메시가 아니라 `TOWN_ROOM_OUTER`·`TOWN_HOUSES` 의 상자로 하는 편이 낫다(걷힌 방의 컷 메시는 꺼져 있다).
- **그림자**: 건물은 드리우지 않는다. 달빛 그림자 카메라는 광장 값 ±12 그대로라 걷는 영역 ±10 을 덮는다.
- **확인할 것(화면)**: 간판·문패가 낮·밤에 읽히는지, 실내 바닥이 바깥보다 밝게 보이는지, 안개가 먼 모서리 집을 너무 흐리지 않는지(광장 안개 값 그대로다).

## Threat Flags

없음 — 얼굴 그림은 계획의 T-20-16 그대로 같은 출처의 정적 경로만 읽는다(시험이 경로를 고정).

## Known Stubs

없음. (Task 1 커밋 `30eb26f4` 시점의 `setCutaway`·`setOwners` 자리는 `6543f426` 에서 채웠다.)

## Self-Check: PASSED

- 파일: `src/world/maps/town.ts` · `test/unit/townScene.test.ts` · `.planning/phases/20-map-expansion/20-04-SUMMARY.md` 있음
- 커밋: `55e3104f` · `30eb26f4` · `fa430d49` · `6543f426` 모두 HEAD 의 조상
