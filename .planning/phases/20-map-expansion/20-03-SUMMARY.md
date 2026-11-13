---
phase: 20-map-expansion
plan: "03"
subsystem: server
tags: [map, town, zones, errand, witness, leak, snap, tdd, flaky-tests]
status: complete

requires:
  - phase: 20-map-expansion
    provides: "20-02 — zones.ts(zoneOf·zoneAt·clipToZone·settleZones), 구역 기억 world.zones, 문 프레임, 시험 도우미(townGame·placeSeats·memWorld·shiftSeg)"
provides:
  - "shared/game/errand.ts — nearIdsOf·nearSnapFrame 의 map 인자(방이 있는 맵이면 같은 구역만, 근처 구간은 clipToZone), sampleErrand 가 방의 맵을 넘긴다"
  - "방 DO — 근처 snap 두 곳(snapFrameFor·syncErrandView)에 this.mapDef(), syncHome 의 순간이동 두 분기 뒤 settleZones"
  - "test/worker/townLeak.test.ts — 마을 한 판 world 프레임 전수 판정(judge 한 곳)"
  - "test/worker/helpers.ts — worldsIn·zonesOfPts·doorCount·zoneSnaps·snapLine·mentions·walkSeat·passDoor·alarmAndCollect"
  - "bots·errandLeak·errand 워커 시험의 간헐 실패 세 가지 원인 확정과 수정"
affects: [20-05, 20-06, 20-08, 20-09, 20-10, 21]

actuals:
  tokens: 19800
  tasks: 2
  commits: 5

plan_head_before: 06ed1eb45b06a96a7f358bd964598fe1c74d42bb
plan_head_after: 08113e84f036971a43fec3e624e6bf6b5238d7e8
commits: 5

tech-stack:
  added: []
  patterns:
    - "근처 = 반경 안 이고 같은 구역: nearIdsOf 한 함수에 맵을 넘기면 근처 snap·목격 줄·마지막 목격이 함께 막힌다"
    - "순간이동(밤·아침)은 문을 지나지 않는다 — settleZones 로 알림 없이 기억을 맞추고 snap 이 화면을 통째로 바꾼다"
    - "누설 전수 시험은 받는 사람이 받은 자기 구간을 따라가며 프레임 시각의 그 사람 구역으로 남의 좌표를 판정한다(서버 메모리를 다시 읽지 않는다)"
    - "구간을 쓰는 호출과 표본 알람 본문을 같은 호출 안에서 돌려 실제 시간이 끼지 않게 한다(runInDurableObject 안에서 instance.alarm())"

key-files:
  created:
    - test/unit/errandZone.test.ts
    - test/worker/townErrand.test.ts
    - test/worker/townLeak.test.ts
  modified:
    - shared/game/errand.ts
    - worker/room.ts
    - test/worker/helpers.ts
    - test/worker/townDoor.test.ts
    - test/unit/bots.test.ts
    - test/worker/bots.test.ts
    - test/worker/errandLeak.test.ts
    - test/worker/errand.test.ts
    - .planning/phases/20-map-expansion/deferred-items.md

key-decisions:
  - "nearIdsOf 의 map 인자는 선택 인자다 — 없거나 방이 없는 맵이면 거리만 본다(재즈 바·광장 시험과 호출 불변)"
  - "근처 구간은 truncateSegment 로 자른 뒤 clipToZone 으로 한 번 더 자른다: 같은 구역에 머무는 동안의 구간만 가고 본인 구간은 그대로다"
  - "누설 시험은 유령의 좌표 수신(D-16)과 방 안 사람의 공개 채팅이 광장에 가는 것까지 한 판 안에서 본다"
  - "간헐 실패는 시험 쪽 문제로 확정해 시험·도우미를 고쳤다 — 서버 코드는 고치지 않았다"

requirements-completed: [D-16, D-17, D-18, D-22]

coverage:
  - id: D1
    description: "심부름 근처 snap 은 근처 원 안이면서 같은 구역인 산 사람만 싣고, 걷는 근처 사람의 구간은 그 구역 안으로 자른다"
    requirement: "D-17"
    verification:
      - kind: unit
        ref: "test/unit/errandZone.test.ts#근처 판정 nearIdsOf 의 맵 인자 · 근처 snap nearSnapFrame 의 맵 인자"
        status: pass
      - kind: integration
        ref: "test/worker/townErrand.test.ts#심부름 근처 snap 은 같은 구역만 싣는다"
        status: pass
    human_judgment: false
  - id: D2
    description: "목격 기록(errandSeen·me.record)과 마지막 목격(errandLast)은 같은 구역 사람만 적는다"
    requirement: "D-18"
    verification:
      - kind: unit
        ref: "test/unit/errandZone.test.ts#목격 표본 sampleErrand 는 같은 구역 사람만 적는다"
        status: pass
      - kind: integration
        ref: "test/worker/townErrand.test.ts#목격 기록·마지막 목격은 같은 구역 사람만 적는다"
        status: pass
    human_judgment: false
  - id: D3
    description: "밤·아침 순간이동 뒤 구역 기억은 알림 없이 새 자리로 맞춰지고 아침 snap 은 같은 구역 사람만 싣는다"
    requirement: "D-18"
    verification:
      - kind: integration
        ref: "test/worker/townErrand.test.ts#밤·아침 순간이동 뒤 구역 기억 (settleZones, T-20-11)"
        status: pass
    human_judgment: false
  - id: D4
    description: "마을 한 판(심부름·토론·문 통과·재접속·지목 모이기·밤·아침)에서 산 사람이 받은 모든 world 프레임의 남의 좌표는 받는 사람 구역 안이다"
    requirement: "D-18"
    verification:
      - kind: integration
        ref: "test/worker/townLeak.test.ts#마을 한 판: 산 사람이 받은 모든 world 프레임의 남의 좌표는 받는 사람 구역 안이다"
        status: pass
    human_judgment: false
  - id: D5
    description: "유령은 방 안 좌표를 포함해 모두를 보고, 채팅은 구역과 무관하게 간다"
    requirement: "D-16"
    verification:
      - kind: integration
        ref: "test/worker/townLeak.test.ts#유령은 모두 보고, 채팅은 구역과 무관하다 (D-16)"
        status: pass
    human_judgment: false
  - id: D6
    description: "재즈 바·광장 판의 심부름·누설·밤 시험은 고치지 않은 채 통과한다"
    requirement: "D-17"
    verification:
      - kind: integration
        ref: "npx vitest run test/unit/errandNear.test.ts test/worker/errandNear.test.ts test/worker/errandLeak.test.ts test/worker/errand.test.ts test/worker/night.test.ts test/worker/nightLeak.test.ts"
        status: pass
    human_judgment: false

duration: "약 2시간 37분(사용량 한도 대기 포함)"
completed: 2026-11-13
---

# Phase 20 Plan 03: 심부름·목격·아침 snap 의 구역 거르기와 한 판 누설 전수 Summary

**`nearIdsOf`·`nearSnapFrame` 이 방의 맵을 받아 "반경 안 이고 같은 구역" 만 근처로 본다. 근처 snap·목격 줄·마지막 목격이 한 함수로 함께 막히고, 밤·아침 순간이동 뒤에는 `settleZones` 가 구역 기억을 알림 없이 맞춘다. 마을 한 판 전체의 world 프레임을 받는 사람 구역으로 판정하는 전수 시험이 서버 변이 7가지를 모두 잡는다. 전체 실행의 간헐 실패 세 가지도 원인을 확정해 시험 쪽을 고쳤다.**

## Performance

- **Duration:** 약 2시간 37분(2026-11-12T22:46Z 시작, 중간에 사용량 한도로 멈춘 시간 포함)
- **Tasks:** 2 / 2 (+ 계획 밖 조사 과제)
- **Files:** 11개(새 파일 3, deferred-items 제외)
- **Commits:** 5 (test 4 · feat 1)

## Accomplishments

- **근처 판정**(`shared/game/errand.ts`): `nearIdsOf(…, map?)` — 맵에 방이 있으면 viewer 위치와 대상 위치의 `zoneOf` 가 같을 때만 근처. 인자가 없거나 방이 없는 맵은 지금 그대로(재즈 바·광장 호출과 시험 불변).
- **근처 snap**: `nearSnapFrame(…, map?)` — 근처 사람 구간은 `truncateSegment` 뒤 `clipToZone` 으로 자른다(문턱 뒤 좌표가 가지 않는다). 본인 구간은 그대로.
- **목격**: `sampleErrand` 가 방의 맵을 `nearIdsOf` 에 넘긴다 — `errandNear`·`errandSeen`(me.record 재료)·`errandLast` 의 관찰자가 모두 같은 구역에서만 정해진다.
- **방 DO**: 근처 snap 두 곳(`snapFrameFor` 의 errand 분기, `syncErrandView`)에 `this.mapDef()`, `syncHome` 의 두 순간이동 분기(알람 따라잡기·정상) 뒤에 `settleZones(map, world, 옮겨진 id, now)`.
- **한 판 누설 전수**(`test/worker/townLeak.test.ts`): 광장에 선 V·우체국 안에 선 W 와 방을 드나드는 X·Y, 광장의 Z, 유령 G. 한 판을 한 번 걷고 산 사람 다섯 소켓이 받은 모든 world 프레임을 `judge` 한 곳에서 판정한다.

## 검증 결과

| 명령 | 결과 |
|------|------|
| Task 1 verify: `npx vitest run test/unit/errandZone.test.ts test/unit/errandNear.test.ts test/unit/errand.test.ts test/worker/townErrand.test.ts test/worker/errandNear.test.ts test/worker/errandLeak.test.ts test/worker/errand.test.ts test/worker/night.test.ts test/worker/nightLeak.test.ts` | 파일 9 통과 · 시험 150 통과 · 실패 0 |
| `npx vitest run test/unit test/worker/townDoor.test.ts test/worker/town.test.ts test/worker/witness.test.ts test/worker/reconnect.test.ts` | 파일 146 통과 · 1 건너뜀, 시험 4852 통과 · 106 건너뜀 · 실패 0 |
| Task 2 verify: `npx vitest run test/worker/townLeak.test.ts test/worker/townErrand.test.ts test/worker/townDoor.test.ts test/worker/town.test.ts test/worker/leak.test.ts test/worker/ghostLeak.test.ts test/worker/chatLeak.test.ts test/worker/emoteLeak.test.ts` | 파일 8 통과, 시험 75 통과 · 4 건너뜀 · 실패 0 |
| `npm run typecheck` | 종료 0 |
| `npm test` (마지막 커밋 `08113e84`) | 종료 0 — 시험 **8751 통과 · 261 건너뜀 · 실패 0** |
| 위생 git grep(바뀐 파일) | 결과 0 |

## RED 증거

기록은 gitignore 된 `.gsd/red/20-03-t1.json`(`gsd-tools check tdd-red-evidence` → `RED_EVIDENCE_OK`, `target_test_failed`).

- **Task 1 RED**: `npx vitest run test/unit/errandZone.test.ts test/worker/townErrand.test.ts --reporter=tap-flat` → 21 중 **not ok 13** · ok 8, 종료 1. 대상 "표본 알람: 우체국 안 사람의 근처 snap 에 문 밖 좌석이 없고 같은 방 좌석이 있다…" 가 `0: seats=0,1,2 others=[plaza>post] …`(벽 너머 좌석 실림)로 실패(기대 `0: seats=0,2 others=[post] …`). 통과한 8 은 지금도 성립하는 지킴 시험: 시험 자리 전제 1, 둘 다 광장이면 거리만·맵 인자 없음·재즈 바 불변(단위 3), 재즈 바 표본(단위 1), 맵 인자 없음·재즈 바 근처 snap(단위 2), 워커 아침 snap(20-02 가 snap 을 지금 위치로 거르므로 처음부터 통과).
- **Task 2 RED**: 이 task 는 시험이 계약이고 Task 1 이 서버를 이미 고쳐 놓았다 — `townLeak.test.ts` 처음 실행은 **8개 모두 통과**(RED 아님). 계획은 "실패가 있으면 서버를 고친다" 였고 실패가 없었다. 빈 시험이 통과로 읽히지 않는지 보려고 서버 변이 7가지를 하나씩 넣어 시험이 실패하는 것을 확인한 뒤 원복했다.

  | 변이 | 시험의 첫 위반(한 줄) |
  |------|----------------------|
  | 근처 snap 에 맵을 넘기지 않음 | `V: 4 좌석 2 · near · -25,-725 · post ≠ 받는 사람(좌석 0) plaza` |
  | 근처 판정이 구역을 보지 않음 | `V: 3 좌석 3 · near · -25,-725 · post ≠ 받는 사람(좌석 0) plaza` (+ 목격 시험 실패) |
  | snap 의 구역 거르기 제거 | `V: 7 좌석 2 · snap · -25,-825 · post ≠ 받는 사람(좌석 1) plaza` |
  | 이동을 자르지 않고 보냄 | `V: 2 좌석 2 · move · -825,-25 · police ≠ 받는 사람(좌석 0) plaza` |
  | 나타남을 자르지 않음 | `V: 3 좌석 4 · appear · 36,-700 · post ≠ 받는 사람(좌석 0) plaza` |
  | 근처 구간을 구역으로 자르지 않음 | `V: 2 좌석 3 · near · -25,-725 · post ≠ 받는 사람(좌석 1) plaza` |
  | 이동을 구역과 무관하게 모든 산 사람에게 | `V: 8 좌석 4 · move · 36,-698 · post ≠ 받는 사람(좌석 1) plaza` |

## 전수 시험이 지난 경로와 프레임 수

한 판 한 번(수치는 두 번 돌려 같았다). 프레임 수는 `world` 프레임 수/받은 전체 프레임 수이고, 심부름 표본이 실제 시간에 깨어나면 늘 수 있어 시험은 "있다"(V ≥ 12, W ≥ 10)로만 단언한다.

| 받는 사람 | world/전체 | near | snap | zone snap | move | appear | vanish | 지난 구역 |
|-----------|------------|------|------|-----------|------|--------|--------|-----------|
| 좌석 0 (V, 광장에 서 있음) | 18/41 | 2 | 3 | 0 | 4 | 3 | 2 | plaza |
| 좌석 1 (W, 우체국 안) | 14/38 | 2 | 1 | 1 | 2 | 1 | 1 | post>plaza>post |
| 좌석 2 (X, 방을 드나듦) | 11/33 | 4 | 1 | 1 | 0 | 0 | 0 | plaza>post>plaza>police>plaza>police |
| 좌석 4 (Y) | 19/43 | 0 | 2 | 2 | 3 | 2 | 1 | plaza>post>plaza |
| 좌석 5 (Z) | 17/38 | 0 | 2 | 0 | 4 | 3 | 2 | plaza |
| 유령 | 15/38 | 0 | 6 | 0 | 9 | 0 | 0 | — (전체 구간) |

지난 경로: 이동(move)·문 통과(vanish·appear·zone snap)·hello 재접속(V·W·유령)·지목 모이기의 강제 걷기(W·X 가 문을 지나 광장으로)·밤·아침 순간이동(zone snap 없음, 구역 기억 맞춤)·심부름 근처(near snap 둘, 문 앞·방 안·문으로 나가는 길)·목격(첫 표본에서 문 앞 사람은 V 에게만). 위반 0, 유령은 post·police 좌표를 받고 door·zone snap 은 받지 않는다. 우체국 안 W 의 공개 채팅은 광장 V 에게 간다. 산 사람 소켓의 state 에는 남의 역할이 없다.

## Task Commits

| Task | 커밋 | 내용 |
|------|------|------|
| 1 RED | `ad7020cb` test | 심부름 근처·목격 구역 실패 시험(+ 맵 인자 자리, townDoor 도우미를 helpers 로) |
| 1 GREEN | `eeef4502` feat | nearIdsOf·nearSnapFrame·sampleErrand 의 구역 거르기, 방 DO 연결·settleZones |
| 2 | `e2720e90` test | 마을 한 판 world 프레임 누설 전수(통과 시험, 변이로 검증) |
| 조사 | `899c568f` test | bots·errandLeak 간헐 실패 두 시험 파일의 난수·실제 시간 의존 제거 |
| 조사 | `08113e84` test | errand 응답 동일성 시험의 간헐 실패 제거 |

## 간헐 실패 조사 (계획 밖 과제)

**빈도.** 고치기 전 20-03 코드로 `npm test` 를 5번 돌려 **2번 실패**(각각 시험 1건)했다.

| 회차 | 결과 | 실패한 시험 |
|------|------|-------------|
| 1 | 통과 | — |
| 2 | 실패 1 | `test/worker/bots.test.ts` "discussion: 봇 셋이 모두 토론 끝내기를 누르면 산 넷의 과반(3)이라…" — `expected 2 to be 3` |
| 3·4 | 통과 | — |
| 5 | 실패 1 | `test/worker/errandLeak.test.ts` "② 위치 비공개 … 근처 사람의 snap 구간 마지막 꼭짓점은 반경 안이다" — `expected undefined to be defined` |

20-02 에서 본 "기본판 봇 방 자동 완주" 는 이번 5번에는 안 나왔지만 아래 원인 ②를 별도로 재현했다. 고친 뒤 5번은 4번 통과 · 1번 실패(`test/worker/errand.test.ts` "거절 이유가 여섯 가지여도, 마피아든 시민이든 응답은 같다…" — `expected 2 to be 1`, 원인 ④)였고 그것도 고친 뒤 마지막 커밋의 전체 실행은 통과(8751)다.

**원인은 서로 무관한 네 가지였다. 모두 시험 쪽이고 서버 코드는 고치지 않았다.** 20-02 의 알람 다시 걸기(`alarmBy`·`reschedule`·`syncZones`)는 원인이 아니다 — 재즈 바 판에서 그 분기는 방이 없는 맵이라 바로 돌아가고, 20-02 전 커밋(`20e0d42c`)에서도 ④는 20번 중 1번 실패했다. `MODE_MAPS` 잠금 누수도 아니다(잠금은 파일 setup 이 한 번 건다).

1. **bots "discussion: 봇 셋이…"** — 시험이 토론 마감을 60초 뒤로 둔다(`toPhase` 기본값). 봇의 끝내기는 계획 시각 + 30~60초에 서고, 마감 − 500ms 이상인 행동은 계획에서 빠진다(`planBotSteps`). 끝내기 난수가 `29500 − (toPhase 와 계획 사이 걸린 ms)` 이상이면 봇 하나의 끝내기가 없다(약 5~8%). 단위 시험 "마감 여유"(`0,4,4,4`)가 조건을 고정하고 워커 시험은 마감을 제품의 토론 길이(90초)로 둔다.
2. **bots `forceBotsDue` — "기본판 봇 방 자동 완주" 등** — 위치 저장 타이머(2초)가 걸린 DO 를 `evict` 하면 타이머가 끝날 때까지 기다린다. 투표 단계는 모이기 배치가 타이머를 걸고 봇 표는 진입 + 2000ms + [0, 6000) 에 선다. 가장 이른 봇 표가 타이머가 끝난 직후 4~10ms 에 서 있으면 기다림이 끝나는 순간 제때 깨어난 알람이 돌고 있어, `runDurableObjectAlarm` 이 "걸린 알람 없음"(false)을 돌려준다. 알람 시각을 `진입 + 2000 + offset` 으로 걸어 offset −4~+1·+12 이상은 통과, **+2~+10 은 실패** 하는 창을 직접 재현했다(실행마다 창이 1~2ms 움직인다). 도우미가 evict 앞에서 `flushWorld` 로 타이머를 풀고, 그래도 false 면 때가 된 행동이 모두 실행될 때까지 기다린다. 회귀 시험 "위치 저장 타이머가 끝난 직후에 알람이 걸려 있어도…" 는 고치기 전 도우미로는 +4~+10 에서 실패한다.
3. **errandLeak "근처 사람의 snap 구간 마지막 꼭짓점"** — 걷는 사람이 근처 반경의 경계(정확히 R)에서 "지금" 출발한 구간을 쓰고 따로 표본 알람을 돌렸다. 그 사이 5ms 만 지나도 반경을 벗어나 근처 snap 에서 빠진다(0ms 면 한 점으로 와서 다른 단언이 실패). 경계에서 출발해 0·5·10·20ms 뒤 표본을 돌리면 모두 실패하는 것을 확인했다. 반경 안쪽 0.2 자리에서 0.1초 전에 출발한 구간을 쓰고 같은 호출 안에서 표본 알람 본문을 돌리게 고쳤다.
4. **errand "응답 동일성"** — 여러 번 누르며 몇 초 걸리는 시험에서 1초 간격 표본 알람(실제 시간)의 근처 snap 이 누름 창에 끼면 프레임 모양이 달라진다. 이 시험 동안 `errandTickAt` 을 한 시간 뒤로 미룬다. 단독 20번 중 2번 실패(20-02 전 커밋은 20번 중 1번) → 고친 뒤 30번 중 0번. 이 메커니즘(표본이 창에 낀다)은 코드를 읽어 세운 가설이고, 끼어든 프레임을 직접 잡지는 않았다 — 고친 뒤 빈도 변화가 근거다.

남은 후보 세 곳은 `deferred-items.md` 에 적었다(관찰하지 못해 고치지 않았다).

## Deviations from Plan (계획과 달라진 점)

### Auto-fixed Issues

**1. [Rule 3 - 시험 도우미] 마을 프레임 도우미를 helpers 로 옮겼다**
- **Found during:** Task 1 RED
- **Issue:** `townErrand`·`townLeak` 이 `townDoor.test.ts` 의 지역 도우미(`zonesOfPts`·`doorCount`·`zoneSnaps`·`snapLine`·`mentions`·`walkSeat`·`passDoor`·`alarmAndCollect`)를 쓴다 — 20-02 SUMMARY 가 "다른 파일에서 쓰면 helpers 로" 라고 넘긴 것.
- **Fix:** `test/worker/helpers.ts` 로 옮기고 `townDoor.test.ts` 는 import 로 바꿨다(`worlds` 는 `worldsIn as worlds` 별칭). townDoor·town 시험 28개 그대로 통과.
- **Commit:** `ad7020cb`

**2. [Rule 1 - 시험이 실제 시간에 기댐] 간헐 실패 네 가지 수정** — 위 "간헐 실패 조사". **Commits:** `899c568f`(1·2·3), `08113e84`(4)

### 계획의 모양을 바꾼 곳

**3. RED 단계에서 `nearIdsOf`·`nearSnapFrame` 에 맵 인자 자리(`_map?`)만 더했다** — 시험이 새 인자로 호출해도 컴파일되게. GREEN 에서 `map` 으로 바꿔 읽는다.

**4. 한 판을 한 번만 걷는다** — 계획은 시험마다 흐름을 만드는 모양이지만 마을 한 판은 시험당 8초쯤 걸려, `play()` 로 한 번 걷고 시험 여덟이 같은 기록을 본다(describe 순서와 무관하게 한 번만 돈다).

**5. 계획의 "토론에서 X 가 경찰서로, Y 가 우체국으로" 에 더해 재접속·채팅을 토론 안에 넣었다** — V·W·유령이 새 소켓으로 hello(`Tape.reconnect` 가 소켓이 바뀌어도 프레임을 이어서 모은다), W 가 공개 채팅을 한 줄 보낸다.

**6. Task 2 는 RED 가 없다** — 위 "RED 증거". 계획대로 "실패가 있으면 서버를 고친다" 였고 처음 실행에서 모두 통과해 `fix(20-03)` 커밋이 없다. 대신 서버 변이 7가지로 시험이 실제 판정함을 확인했다(변이는 커밋하지 않고 원복).

**7. 아침 snap 시험(`townErrand`)은 처음부터 통과했다** — 20-02 가 `snapFrameFor` 를 지금 위치로 거르게 해 둔 덕분이다. 이 계획이 더한 것은 순간이동 뒤 구역 기억 맞춤이고, 그것은 "밤" 시험(`snaps=2 zoneSnaps=1` → `1 0`)이 RED 로 잡았다.

**8. 커밋에 붙인 공저자 줄** — 앞 세 커밋은 `Co-Authored-By: Claude Fable 5.2`, 마지막 두 커밋은 `Claude Sonnet 5.5` 다(중간에 실행 모델 표기가 바뀌었다).

---

**Total deviations:** 자동 수정 2(시험 도우미 1 · 간헐 실패 1), 모양 바꿈 6
**Impact on plan:** 서버 규칙은 계획 그대로다. 서버 코드는 `errand.ts`·`room.ts` 의 계획된 곳만 바뀌었고, 나머지는 시험·도우미다.

## 알려진 한계

- 누설 전수는 판 한 번의 한 시나리오다. 구역 기억이 어긋난 채(저장·복원)로 다시 깬 경우의 한 판 전체 전수는 없다(20-02 의 개별 시험이 본다).
- 판정 함수는 받는 사람의 구역을 "받은 자기 구간의 지금 위치" 로 따라가므로 서버가 본인 구간을 틀리게 보내는 버그는 이 시험으로 잡지 못한다(그것은 `townDoor` 의 본인 snap 시험이 본다).
- 실제 시간에 깨어나는 알람(문 통과·심부름 표본)이 끼는 만큼 프레임 수는 판마다 달라진다. 시험은 개수에 기대지 않고 "있다" 와 위반 0 만 단언한다.
- 간헐 실패의 남은 후보 세 곳(`deferred-items.md`)은 고치지 않았다.

## 20-05·20-06·20-08·20-09·20-10 에 넘기는 것

- **서버 쪽 구역 규칙은 완료다.** 좌표가 실리는 모든 경로(이동·문 나타남·snap·재접속 snap·근처 snap·밤·아침 snap)가 구역으로 걸러지고 한 판 전수 시험이 고정한다. 화면 연출(20-05·06)과 E2E(20-08)가 남았다.
- **E2E(20-08)**: 마을 판은 시작할 때 심부름 단계의 근처 snap 이 같은 구역만 싣는다 — 화면 검사가 "벽 너머 사람이 근처 원 안에 보이지 않음" 을 기대해도 된다. 밤·아침 순간이동에는 문 프레임·zone snap 이 오지 않으므로 문 연출(20-06 `takeDoor`)은 밤·아침 전환에 나오지 않는다(snap 이 화면을 통째로 바꾼다).
- **시험 요령(워커)**: 구간을 쓰고 표본 알람을 돌리려면 `runInDurableObject` 안에서 `instance.alarm()` 을 구간 쓰기와 같은 호출에 넣는다(`townErrand.test.ts` 의 `sampleWalking`). 시험이 몇 초 걸리며 프레임 모양을 보면 `errandTickAt` 을 멀리 미룬다(`errand.test.ts` 의 `deferErrandTicks`). evict 하는 도우미(`advanceTo`·`killSeats`) 앞에서는 `flushWorld`.
- **`forceBotsDue` 는 이제 evict 앞에서 `flushWorld` 한다** — 위치 저장 타이머를 보는 시험이 이 도우미를 쓰면 타이머가 풀린 채 시작한다(bots.test 안에서만 쓰는 도우미라 다른 파일에는 영향 없음).
- **20-09 perf-run·nightload**: 근처 판정에 `zoneOf` 가 하나 더 붙었다(표본 한 번 = 산 사람 N 명 × N 번). 마을 8명에서는 무시할 수준이지만 측정 때 표본 알람 시간을 같이 본다.

## Threat Flags

없음. 새 끝점·인증 경로가 없다. T-20-10(근처 snap·목격)·T-20-11(아침 snap)·T-20-12(한 판 전체)를 시험으로 고정했다. T-20-13(기록은 서버 표본이 정한다)은 변하지 않았다.

## Known Stubs

없음. RED 커밋의 `_map?` 인자 자리는 GREEN 커밋에서 실제 구현으로 바뀌었다.

## 그 밖

- spec-less probe fallback 건너뜀: 요구사항 ID 가 D-nn 결정 번호라 ROADMAP 성공 기준과 20-CONTEXT 로 대신했다.
- 옛 전역 규칙 상수 이름은 바뀐 파일에 적지 않았다. 소리 개념 낱말도 새 서버 코드에 없다.
- push·배포·HANDOFF 갱신은 하지 않았다(20-10).
- 기준선 비교용 임시 체크아웃은 저장소 밖 임시 폴더에 만들었다가 지웠다(`git worktree list` 는 본 작업 폴더 하나).

## Self-Check: PASSED

- 새 파일 3개(`test/unit/errandZone.test.ts`, `test/worker/townErrand.test.ts`, `test/worker/townLeak.test.ts`)가 있다.
- 커밋 5개(`ad7020cb` · `eeef4502` · `e2720e90` · `899c568f` · `08113e84`)가 모두 HEAD 의 조상이다.
- 수용 기준: `zoneOf` in errand.ts 4 · `settleZones` in room.ts 4 · `nearSnapFrame(…this.mapDef())` 2 · townLeak 의 `zoneOf` 사용.
