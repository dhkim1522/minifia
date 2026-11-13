---
phase: 21-cause-effect-missions
plan: "03"
subsystem: town-map-places
tags: [protocol, town-map, lamps, place-art, e2e-copies]
requires:
  - phase: 21-cause-effect-missions
    provides: 21-02 의 확장판 하루 순서 위 초록 시험
provides:
  - 마을 판의 심부름 장소 8곳 = 가로등 lamp0~lamp7 (TOWN_LAMPS, TOWN_PLACES)
  - 가로등 n ↔ 좌석 n 의 집 고정 표, 기둥 자리(pole)
  - 새 장소 id 8개의 그림 별칭·낱말·E2E·smoke 사본
affects: [21-04, 21-05, 21-09, 21-10]
requirements-completed: [D-05, D-07, D-22]
actuals:
  tokens: 10400
  tasks: 2
  commits: 5
plan_head_before: f9856028dbb04422efdf3892bedb13f287e1327e
plan_head_after: 12577e370af30a54eaeb67302a67f03662d5cf48
commits: 5
tech-stack:
  added: []
  patterns:
    - "좌표는 정의식 + 시험이 찍어 주는 리터럴: MAP_PRINT=1 로 값을 찍고 시험이 정의식과 대조한다"
    - "장소 id 가 늘어도 그림 에셋은 늘리지 않는다 — 생성기가 별칭 표(PLACE_ART_ALIAS)를 쓴다"
key-files:
  created: []
  modified:
    - shared/protocol.ts
    - shared/game/mapTown.ts
    - scripts/make-placeart.mjs
    - src/components/v2/placeArt.tsx
    - src/game/placeText.ts
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/smoke.mjs
    - test/unit/mapTown.test.ts
    - test/unit/errandZone.test.ts
    - test/unit/errandView.test.ts
    - test/unit/placeArt.test.ts
    - test/client/placeArt.test.tsx
    - test/worker/townErrand.test.ts
    - test/worker/townLeak.test.ts
key-decisions:
  - "가로등 여덟 곳 모두 정의식 점 그대로였다 — 옮김 규칙(문 면을 따라 0.5씩)은 쓰이지 않았다"
  - "PLACE_IDS 는 기존 16 뒤에 가로등 8 을 붙인 24곳이고, 그림 에셋(design/v3.0/assets 25개)은 늘리지 않았다"
metrics:
  duration: 약 1시간 30분(전체 시험 4회·간헐 실패 가르기 포함)
  completed: 2026-11-13
status: complete
---

# Phase 21 Plan 03: 가로등 8곳 Summary

**마을 판의 심부름 장소를 방 안 넷·광장 넷에서 집 앞 가로등 8곳(lamp0~lamp7)으로 바꾸고, 가로등 n 이 좌석 n 의 집에 가장 가깝도록 고정 표로 묶었다. 새 id 는 와이어·그림 별칭·낱말·E2E·smoke 사본에 맞췄고, 마스크·방·집·문 앞 자리는 그대로다. `npm test` 8645 통과·실패 0, `npm run typecheck` 초록.**

## 한 일

### Task 1 — 가로등 데이터 (`21758765` RED · `ec01d27d` GREEN)
- `shared/protocol.ts`: `LAMP_PLACE_IDS`·`LampPlaceId`, `PLACE_IDS` = 기존 16 + 가로등 8(24곳).
- `shared/game/mapTown.ts`: `LampDef`·`TOWN_LAMPS`(리터럴 8줄)·`TOWN_PLACES = TOWN_LAMPS.map(({ id, x, z }) => ({ id, x, z }))`. 머리 주석에 다시 만드는 명령(`MAP_PRINT=1 npx vitest run test/unit/mapTown.test.ts -t 가로등`).
- `enterErrand`·`actErrand` 는 고치지 않았다 — `mapOf(roomMapId(state)).places` 가 마을 판의 후보를 가로등 8곳으로 바꾼다.
- 목격 기대(errandZone·townErrand·townLeak)의 장소 리터럴을 가로등 id 로 바꿨다(아래 표).

### Task 2 — 그림·낱말·사본 (`8128dfce` RED · `55edcc19` GREEN)
- `scripts/make-placeart.mjs` 가 `PLACE_ART_ALIAS`(lamp0~lamp7 → "lamp")·`placeArtOf(id)` 를 쓰고 `PLACE_ART` 키 타입에서 가로등 id 를 뺀다. `npm run placeart` 로 `placeArt.tsx` 를 다시 만들었다(`placeart:check` 종료 0, 직접 고치지 않음).
- `PLACE_NAME` 의 가로등 8곳은 모두 "가로등". `placeLabel` 은 그대로(켠 곳 문구는 21-10).
- E2E `ERRAND_PLACE_IDS`·smoke `PLACE_IDS` 24곳. `e2eContract` 의 기존 대조 시험은 고치지 않았고 초록이다.

## 가로등 8곳 좌표 표

정의식: 집 n 의 front 에서 (0,0) 쪽 단위 방향으로 1.5 간 점 → 가장 가까운 걷는 칸 중심. 기둥 = 장소 중심에서 집 중심 쪽 0.5. 단위는 월드 단위.

| 가로등 | 집 front | 정의식 점 | 최종 칸(장소 중심) | 옮김 | 기둥 자리 |
|---|---|---|---|---|---|
| lamp0 | -3.75, -6.75 | -3.02, -5.44 | -2.25, -5.25 | 없음 | -2.579, -5.627 |
| lamp1 | 4.75, -6.25 | 3.84, -5.06 | 3.25, -5.25 | 없음 | 3.493, -5.687 |
| lamp2 | 6.25, -5.25 | 5.10, -4.29 | 5.25, -4.25 | 없음 | 5.736, -4.366 |
| lamp3 | 6.25, 4.75 | 5.06, 3.84 | 5.25, 3.75 | 없음 | 5.715, 3.934 |
| lamp4 | 4.75, 6.25 | 3.84, 5.06 | 3.75, 5.25 | 없음 | 3.934, 5.715 |
| lamp5 | -5.25, 6.25 | -4.29, 5.10 | -4.25, 5.25 | 없음 | -4.366, 5.736 |
| lamp6 | -6.25, 4.75 | -5.06, 3.84 | -5.25, 3.25 | 없음 | -5.687, 3.493 |
| lamp7 | -6.75, -3.75 | -5.44, -3.02 | -5.25, -2.25 | 없음 | -5.627, -2.579 |

조건(시험이 지킨다): 걷는 칸 중심 · 구역 plaza · 가로등끼리 2.0 이상 · 자기 집 문 앞과 1.3 이상 · 입장 지점 0 에서 길이 닿음(끝점 0.3 안) · 집 n 의 문 앞에서 가장 가까운 가로등이 n(`0>0 1>1 … 7>7`) · TOWN_MASK 글자·걷는 칸 943개 그대로.

## RED 증거 (한 줄)

- Task 1 (`mapTown.test.ts -t 가로등`, 6개 실패): `expected '0/true/true/true/true/true' to be '8/true/true/true/true/true'` · `expected '0>-1 1>-1 2>-1 3>-1 4>-1 5>-1 6>-1 7>…' to be '0>0 1>1 2>2 3>3 4>4 5>5 6>6 7>7'` · `expected '16/16/' to be '24/24/lamp0,lamp1,…'`
- Task 2 (vitest 30개 실패 + `node --test` `# fail 1`): `expected 'false,false,false,false' to be 'true,true,true,true'`(placeArtOf 별칭) · `expected ',,,,,,,' to be '가로등,가로등,…'`(PLACE_NAME) · `TypeError: placeArtOf is not a function` · e2eContract 사본 대조 `expected [ 'glass', … (13) ] to deeply equal [ …(21) ]` · `not ok … ERRAND_PLACE_IDS 는 24곳`

## 고친 시험 표 (값을 지우거나 느슨하게 하지 않았다)

| 파일 | 시험 | 고친 값 | 이유 |
|---|---|---|---|
| mapTown.test | 「마을 장소 8곳」 둘(방 안 넷 + 광장 넷, indoorOk) | 「마을 가로등 8곳」(위 조건)로 교체, PLAZA_PLACES import 제거 | 새 규칙: 8곳 모두 plaza·집 짝·기둥 0.5 |
| errandZone.test (3곳) | 목격 줄·errandLast·구역이 같아진 표본 | `mail` → 좌석 0(문 안)을 본 줄 `lamp0`, 좌석 2(안쪽 깊은 곳)를 본 줄 `lamp1`, 문 안으로 들어온 좌석 1 `lamp0` | 장소가 가로등으로 바뀜 — 같은 자리에서 가장 가까운 가로등(손으로 거리 확인: IN_DOOR→lamp0 2.83, IN_DEEP→lamp1 4.3) |
| townErrand.test (3곳) | errandSeen·errandLast·토론 me.record, `done` 목록 | 같은 규칙으로 `lamp0`·`lamp1`, `done = ["lamp0","lamp1","lamp2"]` | 장소가 가로등으로 바뀜 |
| townLeak.test (1곳) | 첫 표본 목격 줄 | `mail` → `lamp0` | 문 앞(POST.front)에 선 사람이 가장 가까운 가로등 lamp0 |
| placeArt.test | 사본 개수·이름 집합·id·이름 1:1·본문 서로 다름 | 기준을 `PLACE_IDS − 가로등` 16곳(`ART_PLACE_IDS`)으로 | 그림 에셋은 16곳뿐(P21-17) |
| errandView.test | 장소 id 개수(16 → 24)·PLACE_NAME 키 | `[...BAR, ...PLAZA, ...LAMP_PLACE_IDS]` = PLACE_IDS | 계획 밖 파일(아래 편차) |
| client/placeArt.test | 렌더 25 → 33 | 장소 24 + 조각 9 | 계획 밖 파일(아래 편차) |
| lib.test.mjs | ERRAND_PLACE_IDS 16 → 24 | 길이·유일·뒤 8곳 단언 | 계획대로 |

## 바뀐 시그니처

- `shared/protocol.ts`: `LAMP_PLACE_IDS`, `LampPlaceId`, `PLACE_IDS`(24)
- `shared/game/mapTown.ts`: `LampDef { seat; id: LampPlaceId; x; z; pole }`, `TOWN_LAMPS`, `TOWN_PLACES`(가로등)
- `src/components/v2/placeArt.tsx`(생성물): `PLACE_ART_ALIAS`, `placeArtOf(id: PlaceId)`, `PLACE_ART: Record<Exclude<PlaceId, LampPlaceId>, ArtEntry>`
- `src/game/placeText.ts`: `PLACE_NAME` 24 키

## 21-04·21-05·21-09 에 넘기는 것

- 가로등 번호 n = 좌석 n 의 집. 장소 중심은 `TOWN_LAMPS[n].{x,z}`, 기둥 자리는 `TOWN_LAMPS[n].pole`(걷기 장애물이 아니다 — TOWN_OBSTACLES·TOWN_MASK 에 없다).
- 마을 판의 `enterErrand` 후보와 목격 줄 place 는 이제 가로등 id 다. 광장 장식 가로등 자리 `lamp` 는 광장 판에서 그대로 쓰인다.
- 21-02 의 임시 옮겨 심기(`eveningRowsOf`·`regraftEvening`)는 이 계획에서 건드리지 않았다 — 21-04 몫.
- 방 안 넷(우체국·술집·진료소·경찰서)은 이제 심부름 장소가 없지만 방·문·집 앞 길은 그대로다(20페이즈 걷기·구역 규칙 불변).

## 편차 (Deviations from Plan)

**1. [Rule 3 - 막는 것] 계획의 파일 목록 밖 시험 두 개**
- **발견:** Task 2 verify(`test/client/placeArt.test.tsx`)와 전체 `npm test`(`test/unit/errandView.test.ts`).
- **문제:** 두 시험이 장소 id 를 16곳(렌더 25개)으로 고정해 24곳 변경 뒤 실패했다.
- **고침:** 같은 성질(키·낱말·렌더·별칭)을 지키며 개수만 24(그림 16 + 가로등 8)·33으로. 값을 지우거나 건너뛰지 않았고 별칭 단언(`placeArtOf(lamp0..7) === PLACE_ART.lamp`)을 더했다.
- **커밋:** `8128dfce`(client 시험), `12577e37`(errandView).

**2. [정의식 시험 기대] 모든 가로등이 정의식 점 그대로**
- 계획이 허용한 옮김 규칙은 쓰이지 않았다(`옮김 0칸` 8곳). 시험에는 규칙을 구현해 두었지만 이 맵에서는 작동하지 않는다.

그 밖에는 계획대로 실행했다.

## 간헐 실패 관찰 (범위 밖, deferred-items.md 에 기록)

전체 `npm test` 4회 중 첫 두 회에서 `v2Marker`(1개)·`townLeak`(`advanceTo` 알람 false, 8개)가 각각 한 번 실패했고 단독·재실행에서는 통과(마지막 전체 실행 8645 통과·실패 0). 가로등 변경과 무관한 부하 때 시간 경쟁으로 보여 고치지 않았다.

## Threat Flags

없음 — 새 네트워크 표면 없음. T-21-06(목격 줄 place 는 공개 지리, 역할·좌표 없음)·T-21-07(생성물은 생성기로만 바뀜, `placeart:check` 초록)은 계획대로.

## Known Stubs

없음.

## Self-Check: PASSED

- 생성·수정 파일 존재 확인, 커밋 5개(`21758765`·`ec01d27d`·`8128dfce`·`55edcc19`·`12577e37`)가 HEAD 의 조상임.
- `npm run typecheck` 초록(tokens·placeart 검사 포함), `npm test` 8645 통과·실패 0, `node --test scripts/e2e/lib.test.mjs` 465 통과.
