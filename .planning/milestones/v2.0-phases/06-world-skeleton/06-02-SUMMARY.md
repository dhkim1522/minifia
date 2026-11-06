---
phase: 06-world-skeleton
plan: "02"
subsystem: game-logic
tags: [navigation, a-star, fixed-point, ascii-mask, occlusion, tdd, vitest]

requires:
  - phase: 06-world-skeleton/06-01
    provides: 배포 대상 가드(이 계획과 코드 의존은 없음 — wave 1 병렬 계획)
provides:
  - "shared/game/map.ts — 재즈 바 28×28 ASCII 이동 마스크(BAR_MASK), 장애물 원문(BAR_OBSTACLES 24개), 입장 지점 8곳(BAR_SPAWNS), BAR_MAP"
  - "고정소수점(1/100) 경로: snapToWalkable → findPath(8방향 A*, 이진 힙) → smoothPath(그리디 시선) → 꼭짓점 당기기 → routeFx"
  - "lineWalkable: 정수 슈퍼커버(선분이 칸 경계·꼭짓점에 닿기만 해도 그 칸 검사)"
  - "test/unit/map.test.ts 60개 — 마스크 = 래스터화 동치, 200쌍 경로 속성, 가려짐 없음, 소스 순수성"
affects: [06-05 planMove, 06-08 방 DO 이동, 06-10 렌더러 입장 연출, 06-11 이후 성능 스파이크 시나리오, 8·9페이즈 무대 마스크 단계 분리]

plan_head_before: 76714fc6d6f809fe4db2cf47e131027397d847d0
plan_head_after: bf53105e86f124e413d8284b0a639e65342c682a

actuals:
  tokens: 12800
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "마스크 리터럴이 출처이고, 테스트의 래스터화가 글자 단위 동치를 지킨다(MAP_PRINT=1 로 다시 만든다)"
    - "고정소수점 정수 + Math.sqrt·사칙연산만(삼각함수·hypot·난수·시각 금지) — 소스 문자열 테스트로 고정"
    - "결정적 A*: 우선순위 (f, h, 칸 번호), 고정 이웃 순서"

key-files:
  created:
    - shared/game/map.ts
    - test/unit/map.test.ts
  modified: []

key-decisions:
  - "TO_CAMERA.y = 12.5 − 0.6 = 11.9 (카메라 위치 − 주시점). 계획의 12.5 는 카메라 높이일 뿐 시선 방향이 아니다"
  - "입장 지점에서 닿지 않는 닫힌 구멍(뒤쪽 구석 (2,2)·(3,2))은 마스크에서 막는다 — 보정이 그 칸을 고르면 캐릭터가 멈추기 때문"
  - "lineWalkable 은 선분이 칸에 닿기만 해도 그 칸을 검사하는 보수적 슈퍼커버이고, 점도 닿는 칸이 모두 걸을 수 있어야 걸을 수 있는 점이다"
  - "snapped 는 결과가 입력과 다르면 true (±580 자르기만 일어나도 true)"
  - "경로 꼭짓점 당기기(relaxPath)를 routeFx 에 더해 경로/직선 최댓값을 1.695 → 1.513 으로 줄였다(상한 1.6 은 그대로)"
  - "바 카운터는 몸통 1.0×6.2 로 막는다(윗판 1.2×6.4 의 0.1 돌출은 부풀리기 0.35 안)"

patterns-established:
  - "순수 공유 모듈 + 해석적 판정과 독립된 두 번째 판정(표본·행진)으로 이중 검증"
  - "RED 증거는 tap-flat + 단일 대상 -t 로 만든다(배열 diff 가 여러 줄이면 TAP 이 깨진다)"

requirements-completed: [MAP-02, MAP-01]

coverage:
  - id: D1
    description: "BAR_MASK 28×28 이 BAR_OBSTACLES 래스터화(부풀리기 0.35·이동 한계 ±5.8·머리 꼭대기 가려짐·닫힌 구멍 메우기)와 글자 하나까지 같다"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/unit/map.test.ts#장애물 래스터화(부풀리기 0.35 + 이동 한계 ±5.8 + 머리 꼭대기 가려짐 + 닫힌 구멍 메우기)와 글자 하나까지 같다"
        status: pass
    human_judgment: false
  - id: D2
    description: "입장 지점 8곳이 ctx.talk 원문 좌표·yaw 그대로이고 모두 걸을 수 있으며 서로 이어지고 거리 ≥ 1.0"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "test/unit/map.test.ts#BAR_SPAWNS (ctx.talk 원문)"
        status: pass
    human_judgment: false
  - id: D3
    description: "routeFx 가 고정소수점 정수 꼭짓점 배열을 돌려주고 모든 선분이 막힌 칸을 지나지 않으며(슈퍼커버+표본) 같은 입력에 같은 출력(시드 200쌍)"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/unit/map.test.ts#routeFx 속성 테스트 (재즈 바, 시드 1..200)"
        status: pass
    human_judgment: false
  - id: D4
    description: "걸을 수 있는 모든 칸에서 머리 꼭대기 광선이 가구(펜던트 갓 포함)에 막히지 않는다(해석 판정과 행진 판정, 시선 y 11.9·12.5 모두)"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/unit/map.test.ts#가려짐 없음: 걸을 수 있는 모든 칸의 머리 꼭대기 광선"
        status: pass
    human_judgment: false
  - id: D5
    description: "막힌·범위 밖 목적지 보정(snapToWalkable)과 map.ts 의 삼각함수·hypot·난수·시각 금지"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/unit/map.test.ts#snapToWalkable, #map.ts 소스 규약"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-10-31
status: complete
---

# Phase 6 Plan 02: 재즈 바 이동 격자·입장 지점·고정소수점 경로 Summary

**재즈 바 28×28 ASCII 이동 마스크(걷기 412칸)와 입장 지점 8곳, 보정 → 8방향 A* → 시선 스무딩 → 꼭짓점 당기기로 이어지는 결정적 정수 경로를 순수 모듈 `shared/game/map.ts` 하나로 확정했다.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-31T15:24:50Z
- **Completed:** 2026-10-31T15:37:02Z
- **Tasks:** 3 (트레이서 1 + auto 2, 모두 TDD)
- **Files modified:** 2 (모두 신규)

## Accomplishments

- `BAR_MASK` 28줄 × 28글자, 걸을 수 있는 칸 **412 / 784**. 테스트 안의 래스터화(장애물 24개 부풀리기 + ±5.8 + 가려짐 + 닫힌 구멍 메우기)와 글자 하나까지 같다.
- 입장 지점 8곳(ctx.talk 원문) 모두 걸을 수 있고, 모든 쌍이 A* 로 이어지며 쌍 거리 ≥ 1.0.
- `routeFx` 시드 200쌍: 모든 선분이 `lineWalkable`(슈퍼커버)과 독립 표본 검사 둘 다 통과, 같은 입력은 같은 출력, 경로/직선 길이 **최댓값 1.5127**(상한 1.6).
- 걸을 수 있는 412칸 모두 머리 꼭대기 광선이 가구에 막히지 않음(해석 슬랩 판정 + 0.0005 간격 행진 판정, 시선 y 11.9 와 계획 원문 12.5 둘 다).
- 동률 칸(카운터 끝에서 정확히 0.35): (2,16)·(3,16) 두 칸 — 걸을 수 있는 쪽으로 정했고 테스트가 부동소수 잡음(1e-9)과 구분한다.
- `npm run typecheck` 통과, 유닛 프로젝트 전체 50파일 1403 테스트 통과.

## Task Commits

1. **Task 1 트레이서: 작은 격자 보정 → A* → 고정소수점 경로** — RED `f7a0647` (test), GREEN `9b0c0e5` (feat)
2. **Task 2: 장애물 원문·ASCII 마스크·입장 지점** — RED `696225a` (test), GREEN `8c0bec8` (feat)
3. **Task 3: 경로 속성·가려짐·순수성** — RED `f60192b` (test), GREEN `bf53105` (feat)

**Plan metadata:** 이 SUMMARY 와 STATE/ROADMAP/REQUIREMENTS 를 담은 docs 커밋.

REFACTOR 커밋은 없다: 계획의 REFACTOR(공개 함수 한국어 JSDoc 한 줄씩, 입력 단위 명시)는 각 GREEN 에서 함수를 쓸 때 함께 넣었다.

## TDD Gate Compliance

세 작업 모두 `test(06-02)` → `feat(06-02)` 순서이고 RED 가 먼저 커밋됐다. 각 RED 는 `gsd_run check tdd-red-evidence` 로 `RED_EVIDENCE_OK` 를 받았다(tap-flat, 단일 대상 `-t`).

| RED 대상 테스트 | 실패한 단언(semanticAssessment) |
|---|---|
| Task 1 `routeFx > 벽을 돌아가는 꼭짓점이 1개 이상…` | 뼈대 `routeFx` 가 `[]` 를 돌려줘 `length ≥ 6` 단언 실패 |
| Task 2 `BAR_MASK > 걸을 수 있는 칸의 중심은 모두…` | 자리표시 `BAR_MAP` 에 걸을 수 있는 칸이 0개라 `length > 0` 단언 실패 |
| Task 3 `routeFx 속성 > 경로 총 길이는 직선 길이 이상…` | 시드 119 에서 417.7 > 394.2 (비율 1.695) |
| Task 3 `가려짐 없음 > TO_CAMERA 는 제품 카메라…` | `TO_CAMERA.y` 12.5 ≠ 11.9 |

RED 커밋에 들어간 뼈대(Task 1: 틀린 값을 돌려주는 함수, Task 2: 빈 `BAR_*`)는 같은 작업의 GREEN 에서 모두 실제 구현으로 바뀌었다.

## Files Created/Modified

- `shared/game/map.ts` — 상수, 장애물·마스크·입장 지점 데이터, `parseMask`·`isWalkable`·`cellOfFx`·`cellCenterFx`·`walkableCells`·`snapToWalkable`·`findPath`·`lineWalkable`·`smoothPath`·`routeFx`(내부 `relaxPath`)
- `test/unit/map.test.ts` — 60개: 작은 격자 단위 테스트, 장애물 원문 대조, 마스크 = 래스터화 동치, 200쌍 경로 속성, 가려짐 이중 판정, 소스 순수성. `MAP_PRINT=1` 일 때만 래스터화 결과를 마스크 리터럴 모양으로 출력

## Decisions Made

- `TO_CAMERA.y` 는 카메라 높이 12.5 가 아니라 **위치 − 주시점 = 12.5 − 0.6 = 11.9** 다(아래 편차 3).
- 닫힌 구멍은 마스크에서 막는다(편차 2).
- `lineWalkable` 은 보수적 슈퍼커버(닿기만 해도 검사)이고 점 보정도 같은 기준이다. 칸 경계 위의 점이 막힌 칸에 닿으면 그 점은 가장 가까운 칸 중심으로 보정된다. 서버 쪽 영향은 없고(보정은 결정적) 클라이언트가 같은 함수를 쓰면 같은 결과다.
- `snapped` 는 결과 좌표가 입력과 다르면 true (±580 자르기만 일어나도 true). 06-05 가 링 미끄러짐 표시에 쓸 때 이 의미로 읽어야 한다.
- 바 카운터는 `box(1.0, 1.05, 6.2)` 몸통(y 0~1.13)으로 막는다. 윗판 1.2×6.4 로 막으면 (−4.75, z) 칸이 정확히 0.35 동률이 되고, 0.1 돌출은 부풀리기 안에 든다.
- 걸을 수 있는 칸이 1칸 폭 통로인 곳이 있다: 오른쪽 가장자리 x = 5.75 열(행 7~17 부근). 이동 한계 5.8 안이라 의도대로지만 06-10 이 카메라·이름표 확인 때 알아 두면 좋다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 계획 내부 모순] 작은 맵 테스트와 ±580 자르기**
- **Found during:** Task 1 GREEN
- **Issue:** 계획은 "원점부터 size 칸만 쓰는 6×6 테스트 맵"과 "snapToWalkable 은 ±580 으로 자른다"를 함께 요구한다. 6×6 맵은 x,z ∈ [−700, −400] 이라 칸 중심 −675·−625·−575 가 자르기에 걸려, 코너 칸을 쓰는 보정·경로 테스트가 성립하지 않았다.
- **Fix:** 제품 동작(자르기)은 계획대로 두고, 보정·경로 테스트는 6×6 무늬를 28×28 격자 한가운데(칸 11~16)에 놓고 나머지를 막은 `embed6` 로 바꿨다. `findPath`·`lineWalkable`·`smoothPath` 테스트는 자르기와 무관해 원점 6×6 그대로. `parseMask` 는 정사각이 아니면 던진다(`mask[r*size+c]` 색인이 size = 폭이어야 성립).
- **Files modified:** test/unit/map.test.ts, shared/game/map.ts
- **Committed in:** 9b0c0e5 (RED f7a0647 이후 GREEN 에서 테스트 픽스처를 고침 — RED 증거는 고치기 전 실패 단언 기준)

**2. [Rule 1 - 계획 내부 모순] 닫힌 구멍이 있으면 "걸을 수 있는 칸은 한 덩어리"가 깨짐**
- **Found during:** Task 2 GREEN (래스터화 출력 확인)
- **Issue:** 원시 래스터화에 뒤쪽 구석 (c=2,3, r=2) 두 칸이 바 카운터·피아노 부풀린 영역에 갇힌 채 걸을 수 있음으로 남았다. 계획의 연결성 진리("한 덩어리")와 "마스크 = 래스터화" 가 동시에 성립하지 않는다. 그 칸이 마스크에 남으면 그 근처를 누른 목적지가 거기로 보정돼 캐릭터가 멈춘다.
- **Fix:** 래스터화 규칙에 "입장 지점 0번에서 4방향으로 닿지 않는 걸을 수 있는 칸은 막는다"를 더했다(제품 코드에는 마스크 리터럴만 있다). 메운 칸이 정확히 (2,2)·(3,2) 두 칸임을 별도 테스트가 고정한다. 입장 지점은 하나도 막히지 않았으므로 "장애물 근사를 바꾸지 말고 멈추라" 조건은 걸리지 않았다.
- **Files modified:** test/unit/map.test.ts, shared/game/map.ts
- **Committed in:** 8c0bec8

**3. [Rule 1 - 계획 상수 오류] TO_CAMERA 의 y**
- **Found during:** Task 3 (가려짐 검사를 시선 y 12.5 와 실제 카메라 방향 둘 다로 돌려 봄)
- **Issue:** 계획의 `TO_CAMERA = (12.0208153, 12.5, 12.0208153)` 에서 12.5 는 카메라 **높이**다. 시안·06-03·06-10·UI-SPEC 의 카메라는 `lookAt(target.x, 0.6, target.z)` 라 시선 방향은 위치 − 주시점 = (12.02, **11.9**, 12.02) 이다. 더 납작한 실제 광선은 칸 (20,5)(x 3.25, z −4.25)에서 펜던트 갓 (4.4, −3.2)에 막힌다. 계획 값으로 만든 마스크는 이 자리를 걸을 수 있다고 했다.
- **Fix:** `TO_CAMERA.y = 11.9` 로 바꾸고 마스크를 다시 만들어 (20,5) 를 막았다(row 5: `###########.........###...##`). 계획 원문 방향(12.5)으로도 가려짐이 없음을 별도 테스트가 계속 확인한다. `TO_CAMERA` 를 쓰는 다른 계획은 없다(grep).
- **Files modified:** shared/game/map.ts (TO_CAMERA, BAR_MASK), test/unit/map.test.ts
- **Committed in:** bf53105 (RED f60192b)

**4. [Rule 1 - 성능 기준 미달] 경로/직선 길이 비율 1.695**
- **Found during:** Task 3
- **Issue:** 칸 중심 경로 + 그리디 스무딩만으로는 시드 119(출발이 의자 사이 틈)에서 1.695 로 상한 1.6 을 넘었다. 계획은 "스무딩을 고쳐라, 상한을 올리지 마라".
- **Fix:** 그리디 스무딩 뒤에 `relaxPath`(안쪽 꼭짓점을 이웃 연결선 쪽으로 8분의 k 만큼 당기되 양쪽 선분이 걸을 수 있는 가장 큰 k, 4번 반복 후 `smoothPath` 로 다시 정리)를 더했다. 시드 200쌍 최댓값 1.5127, 상한 1.6 은 그대로. `smoothPath` 자체는 계획대로 그리디이고 `relaxPath` 는 내부 함수라 export 목록은 계획과 같다.
- **Files modified:** shared/game/map.ts
- **Committed in:** bf53105

---

**Total deviations:** 4 auto-fixed (4 × Rule 1, 모두 계획 내부 모순 또는 계획 값 오류)
**Impact on plan:** 마스크가 계획 초안보다 1칸 더 막히고(412칸), 구멍 2칸이 메워졌다. 공개 함수·상수 이름·시그니처는 계획과 같다. 범위 확장 없음.

## Issues Encountered

- `check tdd-red-evidence` 가 vitest `tap` 보고서를 "Non-TAP data" 로 거부했다(배열 diff 가 여러 줄). 해결: `--reporter=tap-flat` 와 단일 대상 `-t` 로 한 줄 실패 메시지의 테스트를 대상으로 삼았다. 같은 계획의 이후 RED 에도 이 방식을 썼다.
- 사용한 한 번의 셸 실수(stdin 을 먹는 `cat`)로 첫 RED 증거 시도가 멈췄다가 정리했다(저장소 변경 없음).

## Known Stubs

없음. RED 커밋의 뼈대·자리표시는 같은 작업의 GREEN 에서 모두 구현으로 바뀌었다.

## Threat Flags

없음. 새 네트워크·인증·파일 접근 표면이 없다(순수 모듈). 위협 모델: T-06-04 (좌표를 ±580 으로 자르고 막힌 칸 결정적 보정, 모든 선분 슈퍼커버 검사) 완화됨. T-06-05 (784칸 고정 격자, 이진 힙 A*, 당기기는 4회 × 꼭짓점 수 × 8 × 선분 검사 2) 요청당 비용 상한이 작다. T-06-SC (패키지 설치 없음) 해당 없음.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 06-05(planMove)·06-08(방 DO)은 `routeFx(BAR_MAP, from, to)` 를 그대로 호출하면 된다. 입력은 고정소수점 정수 점, 출력은 `[x0,z0,x1,z1,…]` 정수 배열이다.
- 06-10(렌더러)은 입장 지점 `BAR_SPAWNS`(월드 단위, yaw 없는 곳은 카메라 쪽 π/4)를 쓴다. 마스크를 디버그 오버레이로 겹칠 때 줄 = z, 글자 = x 이고 첫 칸 중심이 −6.75 이다.
- 8페이즈 무대 오르기 때는 무대 원기둥을 마스크에서 단계별로 나눈다(가정 A3).

## Self-Check: PASSED

- 파일 존재: shared/game/map.ts, test/unit/map.test.ts
- 커밋 존재: f7a0647, 9b0c0e5, 696225a, 8c0bec8, f60192b, bf53105 (모두 HEAD 의 조상)
- 인수 기준: Task 1·2·3 의 grep/node 명령 모두 통과(`28 28` 출력 포함)
- 계획 검증: `npx vitest run --project unit test/unit/map.test.ts` 60 통과, `npm run typecheck` 종료 0

---
*Phase: 06-world-skeleton*
*Completed: 2026-10-31*
