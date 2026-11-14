---
phase: 21-cause-effect-missions
plan: "02"
subsystem: server
tags: [cause-effect, evening, lamp-errand, town-map, place-ids, tdd]
status: complete

requires:
  - phase: 21-cause-effect-missions
    provides: "21-01 의 Ruleset.cause·원인 흐름 단계 사슬·시험 잠금 도우미(openCause·openTown)"
  - phase: 20-map-expansion
    provides: 마을 맵(TOWN_MAP)·집 여덟(TOWN_HOUSES)·걷는 칸 마스크
provides:
  - "PLACE_IDS 끝에 lamp0~lamp7(24개) — 이름 모두 '가로등', 그림은 기존 lamp 별칭, E2E·smoke 사본과 e2eContract 대조"
  - "MapDef.lamps(선택 키)와 TOWN_LAMPS 8곳 · TOWN_NEIGHBORS(짝집 표)·neighborOf · TOWN_MAP.lamps"
  - "errandSpotsOf(map, rules) — 원인 흐름이고 맵에 lamps 가 있으면 가로등, 아니면 장소. 배정·처리·목격 장소가 이 함수 하나로 후보를 정한다"
  - "nearestPlaceId 의 후보 목록 인자, placeCenterFx 가 places·lamps 둘 다에서 id 를 찾음(봇 errandGo 가 고치지 않고 가로등으로 걷는다)"
affects: [21-03, 21-04, 21-07, 21-08]

actuals:
  tokens: 12500
  tasks: 2
  commits: 4

plan_head_before: 61808968269d70bc76ec0c590816b86da7e67dd7
plan_head_after: dc70f08bc2f40da8e0abbb62e81a8cac85710c4a
commits: 4

tech-stack:
  added: []
  patterns:
    - "그림 별칭: 생성기가 새 그림·사본 svg 없이 PLACE_BASE_ART(그려진 16)를 펼치고 lamp0~lamp7 을 lamp 항목으로 가리키게 낸다 — 생성물은 손으로 고치지 않는다"
    - "후보 자리 한 함수(errandSpotsOf): 규칙 플래그 + 맵 선택 키로 분기해 배정·처리·목격이 같은 후보를 쓴다. 역할은 읽지 않는다"
    - "좌표는 정의식 대조 리터럴(TOWN_HOUSES.front 와 같은 방식) — 시험이 정의식과 비교한다"

key-files:
  created:
    - test/unit/lampErrand.test.ts
    - test/worker/lampErrand.test.ts
  modified:
    - shared/protocol.ts
    - src/game/placeText.ts
    - scripts/make-placeart.mjs
    - src/components/v2/placeArt.tsx
    - scripts/e2e/lib.mjs
    - scripts/smoke.mjs
    - shared/game/map.ts
    - shared/game/mapTown.ts
    - shared/game/errand.ts
    - test/unit/e2eContract.test.ts
    - test/unit/errandView.test.ts
    - test/unit/placeArt.test.ts
    - test/client/placeArt.test.tsx
    - test/unit/mapTown.test.ts
    - scripts/e2e/lib.test.mjs

key-decisions:
  - "가로등 id 는 PLACE_IDS 끝의 lamp0~lamp7(번호 = 집 좌석, 등불 i ↔ 집 i), 기존 lamp 는 그대로 (결정 0088, 계획의 선택 그대로)"
  - "그림은 별칭: 사본 svg 는 25개 그대로이고 placeArt.tsx 만 PLACE_ART 에서 lamp0~lamp7 이 lamp 항목을 가리킨다"
  - "가로등 좌표는 반경 4.6 정의식의 결과 리터럴(아래 표), 3D 기둥은 장식이라 마스크 불변"

metrics:
  duration: 약 40분
  completed: 2026-11-14
---

# Phase 21 Plan 02: 가로등 8곳과 저녁 배정 Summary

원인 흐름 마을 판의 저녁에서 산 사람마다 가로등 8곳(lamp0~lamp7) 중 서로 다른 3곳을 받고(역할과 무관), 가로등 반경 1.2 안에서 처리하며, 근처 목격 줄의 장소는 가장 가까운 가로등 id 가 된다. 가로등 id 는 프로토콜 닫힌 집합·이름·그림·E2E·smoke 사본에 같은 순서로 들어갔다.

## Performance

- **Duration:** 약 40분
- **Tasks:** 2 (각각 RED 시험 커밋 + GREEN 구현 커밋)
- **Files modified:** 17 (본 코드 9, 시험 8 — 새 파일 2 포함)

## Accomplishments

- **Task 1:** `PLACE_IDS` 24개(끝 여덟이 lamp0~lamp7), `PLACE_NAME` 여덟 모두 "가로등", 생성기 `make-placeart.mjs` 가 `LAMP_ALIASES` 로 별칭을 내고 `npm run placeart` 로 `placeArt.tsx` 를 다시 만들었다(`PLACE_BASE_ART` 16곳 + `PLACE_ART` 별칭 펼치기, 사본 svg 25개 그대로). E2E `ERRAND_PLACE_IDS`·smoke `PLACE_IDS` 사본을 같은 순서로 늘렸고 e2eContract 가 24개·끝 여덟을 대조한다.
- **Task 2:** `MapDef.lamps?`, `TOWN_LAMPS`, `TOWN_NEIGHBORS`(0,7)(1,2)(3,4)(5,6)·`neighborOf`, `errandSpotsOf`. `enterErrand`·`actErrand`·`sampleErrand`·`nearestPlaceId` 가 후보를 `errandSpotsOf` 로 정한다. 난수 호출 순서(seat 오름차순·사람마다 randInt(n−k))는 그대로이고 후보 수 n 만 8 이다(시험이 `8,7,6` 반복으로 고정).
- 잠금(옛 확장판) 아래 같은 시드의 마을 심부름은 지금 장소(TOWN_PLACES) 그대로이고, 재즈 바·광장은 `lamps` 가 없어 원인 규칙에서도 장소 그대로다.

## TOWN_LAMPS 좌표 표

정의식: 집 i 중심 방향으로 광장 가운데(0,0)에서 반경 4.6 인 점에 가장 가까운 걷는 칸 중심. 서로 최소 간격 2.12, 모두 걷는 칸, 입장 지점 0 에서 길이 닿음(끝점 0.3 안), 집 i 에 가장 가까운 등불이 lamp i(여덟 모두).

| id | x | z | 짝 집(좌석) |
|----|-------|-------|----|
| lamp0 | -2.25 | -3.75 | 0 |
| lamp1 | 2.25 | -3.75 | 1 |
| lamp2 | 4.25 | -2.25 | 2 |
| lamp3 | 3.75 | 2.25 | 3 |
| lamp4 | 2.25 | 3.75 | 4 |
| lamp5 | -2.25 | 4.25 | 5 |
| lamp6 | -3.75 | 2.25 | 6 |
| lamp7 | -3.75 | -2.25 | 7 |

참고: lamp2 는 기존 마을 장소 bench(4.6, −2.2)와 0.35 거리다. 두 목록은 판 종류·규칙으로 갈려 한 판에서 섞이지 않으므로(원인 흐름 = 가로등만, 옛 순서 = 장소만) 문제가 없다.

## Task Commits

1. **Task 1 RED:** `689ae6e6` test(21-02): 가로등 id 사본 실패 시험
2. **Task 1 GREEN:** `a81f1e8b` feat(21-02): 가로등 id 여덟과 사본
3. **Task 2 RED:** `fb9e2526` test(21-02): 가로등 좌표·배정 실패 시험
4. **Task 2 GREEN:** `dc70f08b` feat(21-02): 마을 가로등 8곳과 원인 흐름 저녁 배정

**RED 증거 (Task 1):** `npx vitest run test/unit/e2eContract.test.ts test/unit/errandView.test.ts test/unit/placeArt.test.ts --reporter=tap-flat` → not ok 5(e2eContract 2, errandView 2, placeArt 1), `node --test scripts/e2e/lib.test.mjs` → not ok 1(`ERRAND_PLACE_IDS.length` actual 16 expected 24). 목표 단언(24개·끝 여덟 lamp0~lamp7·이름 "가로등"·별칭 `lamp0: PLACE_BASE_ART.lamp`)에서 실패했고 준비·import 오류가 아니다.

**RED 증거 (Task 2):** `npx vitest run test/unit/mapTown.test.ts test/unit/lampErrand.test.ts test/worker/lampErrand.test.ts --reporter=tap-flat` → not ok 12(mapTown 5, lampErrand 단위 4, 워커 3), 나머지(잠금 아래 옛 경로·기본 마피아·마스크 943)는 통과. 새 export 는 자리 값(빈 목록·places 그대로)으로 두었고 실패는 가로등 목록이 비어 있거나 배정이 장소 id 라는 단언 실패다(예외 사유는 빈 목록에서 값을 꺼내는 TypeError 가 섞여 있으나 모두 구현 부재가 원인이다). `gsd check tdd-red-evidence` 는 따로 돌리지 않았다.

## 시험 결과 (실제 출력)

- `npx vitest run test/unit/mapTown.test.ts test/unit/lampErrand.test.ts test/unit/errand.test.ts test/unit/errandNear.test.ts test/unit/errandZone.test.ts test/worker/lampErrand.test.ts test/worker/errand.test.ts test/worker/townErrand.test.ts test/worker/errandLeak.test.ts` → **9 files passed, 182 tests passed**.
- `npx vitest run test/unit test/client` → **Test Files 236 passed | 1 skipped, Tests 8008 passed | 184 skipped**.
- `npx vitest run --project worker`(전체) → **Test Files 59 passed | 5 skipped (64), Tests 632 passed | 78 skipped** — 이번 실행에서는 night.test.ts 시간 초과가 나지 않았다(알려진 병렬 부하 간헐 실패는 이 계획과 무관).
- `node --test scripts/e2e/lib.test.mjs` → tests 465, pass 465, fail 0.
- `npm run typecheck`(tokens:check·placeart:check·wrangler types·tsc app·tsc worker) → exit 0, `error TS` 없음.

## 계약 대조

- `grep -c '"lamp0"' shared/protocol.ts` 1, `'"lamp7"'` 1 · `lamp7` lib.mjs 1, smoke.mjs 1, placeArt.tsx 1 이상 · `lamps` map.ts 1 이상 · `TOWN_LAMPS` mapTown.ts 2 이상 · `errandSpotsOf` errand.ts 4 · `grep -v '^\s*//' shared/game/errand.ts | grep -c "\.role"` = 0(역할을 읽지 않는 불변식).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 기존 시험 갱신] PLACE_IDS 24개가 만든 기대값 변경**
- **Found during:** Task 1
- **Issue:** 기존 시험이 "장소 16개·사본 25개"를 전제했다(errandView 의 16개·키 집합, placeArt 의 사본 파일 25개 = PLACE_IDS ∪ 조각·id 1:1·PLAZA 슬라이스, 클라이언트 placeArt 25개 렌더, errandParts 의 16개 서로 다른 그림 — 이 하나는 별칭이 같은 그림이라 그대로 16 이다, lib.test 의 `ERRAND_PLACE_IDS.length`).
- **Fix:** 숫자·범위를 24(그려진 16 + 별칭 8)에 맞췄다. 사본 svg 는 별칭이 없으므로 "파일 이름 집합 = 그려진 장소 16 ∪ 조각", PLAZA 범위는 `slice(8, 16)`, 클라이언트 렌더 33(장소 24 + 조각 9)이다. 약화가 아니라 닫힌 집합이 늘어난 만큼 기대값을 갱신하고 별칭 항목 동일성 단언을 더했다.
- **Files modified:** test/unit/errandView.test.ts, test/unit/placeArt.test.ts, test/client/placeArt.test.tsx, scripts/e2e/lib.test.mjs
- **Commit:** 689ae6e6, a81f1e8b

**2. [작은 구현 선택] actErrand 는 후보 자리에서 직접 중심을 구한다**
- 계획은 "placeCenterFx 가 places·lamps 둘 다 찾는다"를 정했고 그대로 했다. 다만 `actErrand` 는 배정된 id 가 이 판의 후보(errandSpotsOf)에 있을 때만 처리 대상으로 삼는다(`spots.find`) — 다른 목록의 id 가 남아 있어도 처리되지 않는 방어이고 응답은 같은 `{ ok: false }` 다.
- **Files modified:** shared/game/errand.ts
- **Commit:** dc70f08b

## Auth Gates

없음.

## Known Stubs

없음. 단, 클라이언트 `src/game/errandView.ts` 의 `placeCentersOf` 는 아직 `mapOf(mapId).places` 만 읽는다 — 원인 흐름 마을 판의 저녁 화면(장소 표식에 가로등 id 매핑)은 계획대로 21-07(3D 가로등)·21-08(저녁 화면)이 맡는다. 서버 배정·처리·와이어 id 는 이 계획에서 완성이다.

## Threat Flags

없음 — 새 네트워크 면·인증 경로·스키마 변경이 없다. T-21-04(역할별 목록 차이)는 소스 grep 0·단위 시험(마피아·시민 같은 키 집합·개수·처리 결과 모양)·워커 시험(소켓 넷 모두 같은 모양·길이 3)으로, T-21-05(처리 위치 위조)는 기존 계약(메시지에 좌표 없음)과 반경 밖·미배정 모두 `{ ok: false }` 단언으로, T-21-06(사본 불일치)은 e2eContract 와 `placeart:check` 로 완화했다.

## 위생·기타

- 사용자 규칙의 위생 git grep 파일은 이 PC 에서 찾아 실행하지 않았다(21-01 과 같이 건너뜀). 대신 바뀐 서버 코드 diff(`errand.ts`·`mapTown.ts`·`map.ts`)에서 소리 개념 낱말(소리·sound·audio·효과음)을 직접 검색해 0건을 확인했다.
- 진행 중이던 작업 트리는 계획 시작 때 깨끗했다(`git status` clean).

## Self-Check: PASSED

- FOUND: shared/game/mapTown.ts(TOWN_LAMPS), shared/game/errand.ts(errandSpotsOf), test/unit/lampErrand.test.ts, test/worker/lampErrand.test.ts
- FOUND commits: 689ae6e6, a81f1e8b, fb9e2526, dc70f08b (모두 HEAD 의 조상)
