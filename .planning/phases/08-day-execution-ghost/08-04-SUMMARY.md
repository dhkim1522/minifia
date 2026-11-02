---
phase: 08-day-execution-ghost
plan: "04"
subsystem: game-rules
tags: [tdd, movement, audience, ghost, stage-spot, gather, pure-rules]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-02 의 PhaseId nomination·verdict, majorityOf, verdict.candidate·voteLog 모양
provides:
  - shared/game/movement.ts — MAP_PHASES, canMoveIn(단계, 생존), canMove(state, p)
  - shared/game/audience.ts — world 가 mover 기준(AudienceEvent.world.mover?), worldVisibleTo, CHAT_PHASES 의 nomination·verdict
  - shared/game/map.ts — STAGE_SPOT, STAGE_REACH_FX, MapDef.stage, 무대 단일 예외 lineWalkable·routeFx
  - shared/game/world.ts — forceSegment, LayoutMemo, WorldState.lay, StoredWorld.lay (compactWorld·restoreWorld 저장 복원)
  - shared/game/gather.ts — RING_RADIUS_FX, RING_SLOTS, ringSlots, assignSlots, layoutKey, layoutFor
affects: [08-05, 08-09 DO 배선(applyMove·emitWorld·syncLayout·hello 스냅샷), 08-11 흐름 전환, 08-21 옛 단계 삭제]

actuals:
  tokens: 17500
  tasks: 3
  commits: 6
plan_head_before: b34f7e6770e8955717a30e5f9ee2111b292c11a1
plan_head_after: 159dd5ca4aafddb479ecdfed3b2dcd18a9f4ad0b

tech-stack:
  added: []
  patterns:
    - "지도 단계 판정은 MAP_PHASES 한 곳 — 이동 권한과 위치 프레임 받는 사람이 같은 집합을 쓴다"
    - "무대 자리 예외는 lineWalkable 한 함수에 두고 snapToWalkable·parseStoredSegment·routeFx 가 공유한다 (본체는 lineWalkableBase)"
    - "배치는 '지금 단계가 요구하는 모습' 기준의 멱등 동기화 + 저장되는 기억(lay) 재사용 — 걷는 도중·퇴거 뒤에도 자리가 뒤섞이지 않는다"
    - "슬롯은 삼각함수 없는 상수 표, 각도 정렬은 정수 반평면·외적 비교"

key-files:
  created:
    - shared/game/movement.ts
    - shared/game/gather.ts
    - test/unit/movement.test.ts
    - test/unit/gather.test.ts
  modified:
    - shared/game/audience.ts
    - shared/game/map.ts
    - shared/game/world.ts
    - test/unit/audience.test.ts
    - test/unit/map.test.ts
    - test/unit/world.test.ts

key-decisions:
  - "무대 예외는 정확히 STAGE_SPOT(0,0) 한 점과 거리 300 이내 걸을 수 있는 점 사이 선분뿐이다. 25 간격 격자 전수와 110 간격 쌍 전수 시험으로 '예외 밖은 예외 없는 맵과 판정이 같다' 를 고정했다 (BAR_MASK 문자열 불변)"
  - "routeFx 가 무대를 드나들 때는 무대에서 300 이내 걸을 수 있는 칸 중심 하나(무대 ↔ 상대 직선 합이 최소인 칸)를 문으로 쓰고 나머지는 보통 A* 길이다. 일반 길은 칸 중심만 지나므로 무대 자리를 지나지 않는다"
  - "lay 복원은 항목 단위로 버린다: 키·slots 모양이 틀리면 lay 전체, 슬롯 좌표(정수·±700)나 방에 없는 id 가 틀리면 그 슬롯만"
  - "layoutFor 의 자리 재사용: 지목은 같은 키(같은 날 지목)의 기억만, 변론·찬반·처형은 같은 날 기억이면 쓴다. 기억에 없는 사람만 남은 자리를 현재 위치 sweep 으로 배정받는다"
  - "worldVisibleTo 는 옛 투표 단계(execVote 등)를 빈 집합으로 둔다 — 계획이 로비·assigning·roleReveal·지도 단계·ended 만 정해서 가정 A3(08-21 이 지울 때까지 그 단계는 아무도 움직이지 않는다)과 맞췄다"

requirements-completed: [MAP-04, GHOST-01, DAY-04, DAY-05]

coverage:
  - id: D1
    description: "canMove 표: 15단계 × {산 사람, 유령} 전수 — lobby 모두 true, 지도 단계에서 유령 언제나 true, 산 사람은 dayAnnounce·discussion 만 true, 그 밖은 false"
    verification:
      - kind: unit
        ref: "test/unit/movement.test.ts (36 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "위치 프레임 받는 사람: mover 산 사람이면 방 전원, 유령이면 유령만(산 사람 0명), mover 없음·방에 없음·지도 밖 단계는 빈 집합, worldVisibleTo 신분 표, CHAT_PHASES 에 nomination·verdict"
    verification:
      - kind: unit
        ref: "test/unit/audience.test.ts describe 'world mover(GHOST-01)'·'worldVisibleTo' (84 tests 중 신규 약 60)"
        status: pass
    human_judgment: false
  - id: D3
    description: "무대 단일 예외: STAGE_SPOT 한 점과 300 안 선분만 true, (10,0)·300 밖·막힌 점·무대 가로지르는 선분은 그대로 막힘, routeFx 무대 출입 경로 모든 선분 lineWalkable, 저장된 한 점 [0,0] 복원"
    verification:
      - kind: unit
        ref: "test/unit/map.test.ts 'STAGE_SPOT 단일 예외'; test/unit/world.test.ts 'restoreWorld — 무대 한 점 구간'"
        status: pass
    human_judgment: false
  - id: D4
    description: "forceSegment(간격·lastMoveAt 무시, 방에 없는 id 는 입력 그대로)와 배치 기억 lay 저장·복원(형태 검사, 옛 저장값 호환)"
    verification:
      - kind: unit
        ref: "test/unit/world.test.ts 'forceSegment'·'배치 기억 lay'"
        status: pass
    human_judgment: false
  - id: D5
    description: "ringSlots n=2..8 걷기 가능·간격 200 이상·무대 선분, 입장 지점 8곳 × 모든 슬롯 planMoveSegment 가 슬롯에서 끝남(backstop), layoutFor 지목·변론·찬반·처형 배치와 멱등"
    verification:
      - kind: unit
        ref: "test/unit/gather.test.ts (48 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "앱·워커 타입 검사와 단위·클라이언트·워커 시험 전체 통과"
    verification:
      - kind: command
        ref: "npm run typecheck; npx vitest run --project unit (2119 passed, 1 skipped 는 이전부터); --project client (1772 passed); --project worker (269 passed)"
        status: pass
    human_judgment: false
  - id: D7
    description: "슬롯 반지름 2.65 의 체감 간격·무대 자리 높이(0.29)와 실제 걷는 모습"
    verification: []
    human_judgment: true
    rationale: "순수 규칙 층만 만들었다. 화면 규칙(A4)과 걷는 연출은 08-08·08-09 이후 실기기 확인(개발 뒤 한꺼번에)에서 본다"

duration: 15min
completed: 2026-11-02
---

# Phase 8 Plan 4: 이동 권한·유령 위치 받는 사람·무대 예외·모이는 자리 Summary

**지도 단계 표(MAP_PHASES) 하나로 이동 권한(canMove)과 위치 프레임 받는 사람(mover 기준 audience)을 정하고, 무대 자리(0,0) 단일 예외·서버 주도 이동(forceSegment)·저장되는 배치 기억(lay)·둘레 자리 표/배정/멱등 배치(gather.ts)를 순수 함수와 단위 시험으로 고정했다.**

## Accomplishments

- **Task 1 (트레이서)** — `movement.ts`: `MAP_PHASES`(8단계), `canMoveIn(단계, 생존)`, `canMove`. `audience.ts`: `world` 이벤트에 `mover?`, 로비는 전원 / 지도 단계는 mover 가 산 사람이면 전원·유령이면 유령만 / mover 없음·방에 없음·그 밖 단계는 빈 집합, `worldVisibleTo(state, viewerId)`(접속 스냅샷용), `CHAT_PHASES` 에 `nomination`·`verdict`.
- **Task 2** — `map.ts`: `STAGE_SPOT`, `STAGE_REACH_FX = 300`, `MapDef.stage?`. 공개 `lineWalkable` 이 예외를 먼저 보고 본체(`lineWalkableBase`)로 넘어간다. `routeFx` 는 출발·도착이 무대일 때 직선(300 이내) 또는 가까운 문(칸 중심)을 거친다. `world.ts`: `forceSegment`, `LayoutMemo`/`WorldState.lay`/`StoredWorld.lay`, 저장·복원 형태 검사.
- **Task 3** — `gather.ts`: `RING_RADIUS_FX = 265`, n=2..8 상수 표, `assignSlots`(각도 순 sweep + 돌림 최소 거리 제곱합, 입력 순서 무관), `layoutKey`, `layoutFor`(지목 둘레 자리 / 변론·찬반 변론자 무대 + 나머지 자기 자리 / 처형 통과 시 무대 유지·부결 시 복귀, 기억 재사용으로 멱등).

## TDD Gate Compliance

세 작업 모두 RED(`test(08-04)`) → GREEN(`feat(08-04)`) 순서다. REFACTOR 커밋은 없다.

| 작업 | RED 커밋 | RED 증거(`gsd_run check tdd-red-evidence` = RED_EVIDENCE_OK) | GREEN 커밋 |
| --- | --- | --- | --- |
| 1 이동 권한·받는 사람 | `6c25e67` | movement+audience 120개 중 48 실패. 대상 "discussion: 산 사람 true · 유령 true" 가 `discussion:alive:false`(기대 `true`)로 실패 | `8df7502` |
| 2 무대 예외·forceSegment·lay | `a955f0f` | map+world+e2eContract 217개 중 23 실패(`-t "두 끝이 모두 STAGE_SPOT"` 로 좁힌 TAP 으로 판정). 대상 "lineWalkable: 두 끝이 모두 STAGE_SPOT 이면 true" 가 false(기대 true)로 실패 | `098e802` |
| 3 모이는 자리 | `5d61cab` | gather.test.ts 48개 중 38 실패. 대상 "ringSlots(8) 은 정해진 8좌표다" 가 빈 문자열(기대 8좌표 문자열)로 실패 | `159dd5c` |

semanticAssessment: 세 RED 모두 RED 커밋에 이름만 있는 자리표시자(wrong-answer 반환, 상수·타입 선언)를 함께 두어 불러오기 실패가 아니라 계획한 단언에서 실패했다. 작업 2·3 은 TAP 보고서가 `-t` 필터 없이는 `map.test.ts` 의 콘솔 출력(경로 통계)과 여러 줄 diff 때문에 `Non-TAP data` 로 거부되어, 대상 시험만 좁혀 돌린 보고서를 증거로 썼다(보고서를 편집하지 않았다). 몇몇 시험(자리표시자가 우연히 맞춘 "다른 점은 막혀 있다" 류)은 RED 에서도 통과했다.

트레이서 게이트: 작업 1 의 `<verify>` 를 다시 돌려 통과를 확인했고(`⚡ Tracer verified end-to-end — expanding`) 확장 작업으로 넘어갔다.

## Task Commits

1. Task 1 RED `6c25e67` → GREEN `8df7502`
2. Task 2 RED `a955f0f` → GREEN `098e802`
3. Task 3 RED `5d61cab` → GREEN `159dd5c`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 막힌 칸이라고 (0,0) 을 쓰던 기존 시험 4곳 갱신**
- **Found during:** Task 2 GREEN
- **Issue:** 계획이 `snapToWalkable(S) → {0,0,snapped:false}` 와 "기존 시험 그대로 통과" 를 함께 요구하는데, 기존 시험 넷은 (0,0) 이 막힌 칸이라는 전제로 쓰였다 (`map.test.ts` 막힌 도착점 경로, `world.test.ts` requestMove 막힌 목적지, restoreWorld 손상 표의 "한 점 [0,0]"·"끝점 [360,40,0,0]" 항목).
- **Fix:** 막힌 이웃 점 (10,0) 으로 옮기고, 무대 자리(0,0)는 단일 예외임을 이름에 적었다. `sameAsRequestMove` 표에는 (0,0)도 남겼다. 단언의 강도는 그대로다.
- **Files modified:** test/unit/map.test.ts, test/unit/world.test.ts
- **Commit:** 098e802

**2. [Rule 2 - Missing critical] lay 가 spawn·요청·배회·퇴장에서 사라지지 않게 `...w` 로 보존**
- **Found during:** Task 2 GREEN
- **Issue:** 계획은 compactWorld·restoreWorld 만 말했는데, `spawnPlayer`·`requestMove`·`planWander` 가 `{segs, lastMoveAt, wanderAt}` 리터럴을 새로 만들어 lay 를 조용히 지운다 — 재입장 한 번이면 변론자의 돌아올 자리가 사라진다.
- **Fix:** 세 함수가 `...w` 로 lay 를 이어받고, `despawnPlayer` 는 그 사람 슬롯만 지운다. `respawnAll`·`emptyWorld` 는 계획대로 lay 없음. 시험 추가.
- **Files modified:** shared/game/world.ts, test/unit/world.test.ts
- **Commit:** 098e802

**3. [Rule 1 - 계산] 슬롯 표의 대칭 반올림**
- n=3, n=6 의 (±229, -132.5) 를 계산 그대로 반올림하면 한쪽만 -132 가 된다. 좌우 대칭이 되게 둘 다 -133 으로 적었다 (반지름 오차 0.5 이하, 간격·걷기 가능 시험 통과).

**4. [처리 메모] 가정 A1 의 대비책(걷기 불가 슬롯 시 22.5° 회전)은 필요하지 않았다.** n=2..8 전부 처음 표에서 걸을 수 있고, 입장 지점 8곳 × 슬롯 전 조합의 `planMoveSegment` 끝점이 슬롯과 같았다.

**5. [처리 메모] 패키지 설치 시도 1건.** 슬롯 걷기 가능 점을 확인하려 `npx vite-node` 를 한 번 실행했는데 npx 가 패키지를 내려받아 실행했다(프로젝트 `package.json`·락 파일은 바뀌지 않았고 npx 캐시에만 남는다). 이 계획은 패키지를 설치하지 않는다는 T-08-SC 의 취지에 어긋나므로 기록한다. 이후에는 설치 없이 `node -e` 와 vitest 만 썼다.

**Total deviations:** 3 auto-fixed(Rule 3 하나·Rule 2 하나·Rule 1 하나) + 처리 메모 2. **Impact:** 범위 확장 없음. 무대 예외는 계획대로 한 점이고, 단언은 약해지지 않았다.

## Verification

- `npx vitest run test/unit/movement.test.ts test/unit/audience.test.ts` 120 passed; `map.test.ts`·`world.test.ts`·`e2eContract.test.ts` 통과(BAR_MASK 줄 diff 0건); `gather.test.ts` 48 passed.
- `npm run typecheck` 통과(앱·워커). `npx vitest run --project unit` 72 files / 2119 passed (1 skipped 는 이전부터 있던 것), `--project client` 1772 passed, `--project worker` 269 passed.
- 인수 기준: `canMove`·`worldVisibleTo`·`mover` 존재, `"nomination",` 1건, `STAGE_SPOT`·`forceSegment`·`lay?` 존재, BAR_MASK 줄 diff 없음, `layoutFor`·`RING_RADIUS_FX = 265` 존재, `gather.ts` 에 `Math.sin|cos|atan2` 없음, 시험에 `.skip(`·`.todo(` 없음, `test(08-04)` 커밋 3건 — 모두 통과.
- 위생: `git grep -nIiE "저장소 위생 패턴"` 이 계획이 건드린 코드·시험에서 0건.

## Known Stubs

None. (RED 커밋의 자리표시자는 같은 작업의 GREEN 커밋이 전부 구현으로 바꿨다.)

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: client-reachable-stage-spot | shared/game/map.ts, shared/game/world.ts | 무대 예외가 공용 `lineWalkable`/`routeFx` 에 있으므로 클라이언트가 목적지로 정확히 (0,0) 을 보내면 `requestMove` 가 무대 자리를 받아들인다(로비·유령처럼 이동이 허용되는 때). 산 사람 변론자 자리와의 겹침·로비에서 무대 위에 서는 일이 생길 수 있다. 08-09 의 `applyMove` 가 클라이언트 입력 목적지가 STAGE_SPOT 이면 거절하거나 한 칸 비켜 보내도록 막아야 한다(이 계획은 순수 규칙 층이라 서버 입력 경로를 건드리지 않았다). |

(T-08-17 mover·viewer 신분 표 전수 시험, T-08-18 무대 예외 격자 전수·BAR_MASK 불변, T-08-19 lay·segs 형태 검사는 계획대로 시험으로 고정했다.)

## Next Phase Readiness

08-09 가 DO 에서 `canMove` 를 `applyMove` 에, `audience(state, {k:"world", mover})` 를 `emitWorld` 에, `worldVisibleTo` 를 `handleHello` 스냅샷 거름에 건다. 또 `syncLayout(now)` 에서 `layoutFor(room, world, now)` 의 `moves` 를 `planMoveSegment` + `forceSegment` 로 적용한 뒤 `world.lay = { key, slots }` 로 기억해 저장한다(`compactWorld` 가 싣는다). 위 Threat Flag 의 클라이언트 (0,0) 입력 차단도 같은 자리에서 한다.

## Self-Check: PASSED

- FOUND: shared/game/movement.ts, shared/game/gather.ts, test/unit/movement.test.ts, test/unit/gather.test.ts
- FOUND commits: 6c25e67, 8df7502, a955f0f, 098e802, 5d61cab, 159dd5c
- 커밋 수 측정: `git rev-list --count b34f7e6..HEAD` = 6
