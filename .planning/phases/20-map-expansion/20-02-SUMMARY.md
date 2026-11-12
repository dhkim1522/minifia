---
phase: 20-map-expansion
plan: "02"
subsystem: server
tags: [map, town, zones, door-frame, snap, alarm, leak, world-store, tdd]
status: complete

requires:
  - phase: 20-map-expansion
    provides: "20-01 — 마을 맵 town·zoneOf·zoneAt·clipToZone·emitMove 구역 거르기, 시험 도우미 openTown"
provides:
  - "와이어: WorldFrame k door (e vanish — 좌석·방 id 뿐 / e appear — 그 구역 안 구간), snap 의 zone?: true"
  - "shared/game/zones.ts — nextCrossingAt · reconcileZones · settleZones · ZoneChange"
  - "WorldState.zones(구역 기억) — compactWorld·restoreWorld·despawnPlayer·respawnAll 처리"
  - "방 DO — syncZones · nextZoneAt · alarmBy · zoneMemo, snapFrameFor 구역 거르기, emitMove 는 구역 기억으로 나눈다"
  - "src/world/store.ts — door·zone snap 처리, takeDoor(): DoorEvent[]"
  - "시험 도우미(test/worker/helpers.ts): townGame · placeSeats(구역 기억도 맞춤) · actorOf · idOfSeat · memWorld · shiftSeg"
affects: [20-03, 20-05, 20-06, 20-10, 21]

actuals:
  tokens: 19800
  tasks: 2
  commits: 5

plan_head_before: 20e0d42c16cd817e51966e57b2ba4f0831a1c245
plan_head_after: 20e8843800d0086c5d0c600235b2e0334d4e999a
commits: 5

tech-stack:
  added: []
  patterns:
    - "구역 기억(world.zones)과 지금 위치의 차이가 곧 문 통과다 — syncZones 한 곳이 맞추면서 사라짐·나타남·본인 snap 을 낸다"
    - "문 통과는 알람이 낸다: 걷기 요청은 alarmBy(이를 때만), 그 밖은 reschedule 의 최솟값(nextZoneAt)"
    - "snap 은 구역 기억이 아니라 지금 위치로 거른다(맞추기 전에도 닫힌 쪽)"
    - "워커 시험: 프레임을 걷기 요청 전부터 모으고 구간 출발 시각을 당겨 문턱을 넘긴다(실제 시간을 기다리지 않는다)"

key-files:
  created:
    - test/unit/zones.test.ts
    - test/worker/townDoor.test.ts
  modified:
    - shared/protocol.ts
    - shared/game/zones.ts
    - shared/game/world.ts
    - worker/room.ts
    - src/world/store.ts
    - test/unit/worldStore.test.ts
    - test/worker/helpers.ts
    - test/worker/town.test.ts

key-decisions:
  - "snap(재접속·단계 진입·본인 zone snap)은 구역 기억이 아니라 구간의 지금 위치로 거른다 — 판 시작처럼 기억이 아직 없을 때도 맞고, 기억이 낡았을 때도 다른 구역 좌표가 실리지 않는다"
  - "처음 기억하는 것(알림 없음)만으로는 위치 저장 타이머를 걸지 않는다 — 문을 지나려면 먼저 걸어야 하고 그 걷기의 저장에 기억이 함께 실린다"
  - "단계 배치(syncLayout)는 알람을 따로 당기지 않고 통과 시각을 돌려준다 — 같은 흐름의 reschedule 과 알람 쓰기 순서가 엇갈려 이른 알람을 늦은 값으로 덮을 수 있어서다"
  - "통과 알람이 다른 알람 쓰기에 밀려 사라졌으면(기억과 지금 위치가 이미 다름) 다음 reschedule 이 알람을 지금으로 건다"
  - "문 프레임의 d 는 받는 쪽에서 본 문이다: 사라짐은 떠난 구역이 방이면 그 방, 나타남은 들어간 구역이 방이면 그 방(광장↔방 사이에서는 둘이 같다)"

requirements-completed: [D-14, D-15, D-16, D-22]

coverage:
  - id: D1
    description: "문을 지나는 순간 떠나는 구역의 산 사람은 좌표 없는 사라짐 하나, 들어가는 구역의 산 사람은 그 구역 안 구간의 나타남 하나, 본인은 새 구역 사람만 담긴 zone snap 하나를 받는다"
    requirement: "D-14"
    verification:
      - kind: integration
        ref: "test/worker/townDoor.test.ts#문으로 들어가는 순간 · 문으로 나오는 순간 · 같은 알람에서 두 사람이 엇갈려 넘는다"
        status: pass
      - kind: unit
        ref: "test/unit/zones.test.ts#다음 문 통과 시각 nextCrossingAt · 구역 기억 맞추기 reconcileZones·settleZones"
        status: pass
    human_judgment: false
  - id: D2
    description: "넘기 전에는 들어가는 쪽이 그 사람에 대해 아무것도 받지 않고, 밖의 산 사람이 받는 좌표는 모두 자기 구역이다"
    requirement: "D-14"
    verification:
      - kind: integration
        ref: "test/worker/townDoor.test.ts#넘기 전: 광장 먼 곳에서 방 안으로 걷기 시작한 직후(알람 전)…"
        status: pass
    human_judgment: false
  - id: D3
    description: "유령은 문 프레임·zone snap 없이 모든 산 사람의 전체 구간을 받고, 재접속 snap 도 전원이다"
    requirement: "D-16"
    verification:
      - kind: integration
        ref: "test/worker/townDoor.test.ts#유령은 문 프레임·zone snap 을 받지 않고… · 유령의 hello snap 은 구역과 상관없이…"
        status: pass
    human_judgment: false
  - id: D4
    description: "다음 문 통과 시각이 알람에 들어가고(이를 때만 다시 건다), 구역 기억은 위치 저장에 실려 재시작 뒤에도 알람이 놓친 통과를 낸다"
    requirement: "D-22"
    verification:
      - kind: integration
        ref: "test/worker/townDoor.test.ts#문 통과 시각의 알람과 구역 기억의 저장 · 알람 맞추기(reschedule)에 문 통과가 들어간다"
        status: pass
      - kind: unit
        ref: "test/unit/zones.test.ts#구역 기억의 저장·복원 world.zones (T-20-08)"
        status: pass
    human_judgment: false
  - id: D5
    description: "재접속(hello) snap 은 산 사람에게 같은 구역 사람만 그 구역 안으로 자른 구간으로 싣는다"
    requirement: "D-14"
    verification:
      - kind: integration
        ref: "test/worker/townDoor.test.ts#재접속 snap 도 구역으로 걸러진다 (T-20-06)"
        status: pass
    human_judgment: false
  - id: D6
    description: "클라이언트 저장소가 door 프레임과 zone snap 을 사라짐·나타남 목록(takeDoor)으로 넘기고 사라진 좌석의 마지막 구간을 남긴다"
    requirement: "D-15"
    verification:
      - kind: unit
        ref: "test/unit/worldStore.test.ts#WorldStore: 문 통과 프레임 door·zone snap 과 takeDoor (20페이즈 D-14·D-15)"
        status: pass
    human_judgment: false
  - id: D7
    description: "재즈 바·광장 판에는 문 프레임·zone 표시·구역 기억이 없고 기존 world 시험이 그대로다"
    requirement: "D-14"
    verification:
      - kind: integration
        ref: "test/worker/townDoor.test.ts#방이 없는 맵은 그대로다 — 재즈 바 판에는…"
        status: pass
      - kind: integration
        ref: "npx vitest run test/worker/world.test.ts test/worker/reconnect.test.ts test/worker/ghostLeak.test.ts test/worker/alarm.test.ts test/worker/errandNear.test.ts"
        status: pass
    human_judgment: false

duration: 48min
completed: 2026-11-13
---

# Phase 20 Plan 02: 문 통과 프레임과 구역 기억 Summary

**방 DO 의 `syncZones` 가 구역 기억(world.zones)을 지금 위치로 맞추면서, 문을 지난 사람마다 떠난 구역에는 좌표 없는 사라짐, 들어간 구역에는 그 구역 안 구간의 나타남, 본인에게는 새 구역 snap 을 보낸다. 통과 시각은 알람에 들어가고 구역 기억은 저장되며, 재접속 snap 도 같은 구역 사람만 싣는다.**

## Performance

- **Duration:** 48분
- **Started:** 2026-11-12T21:11:44Z
- **Completed:** 2026-11-12T22:00Z
- **Tasks:** 2 / 2
- **Files:** 10개(새 파일 2)
- **Commits:** 5 (test 3 · feat 2)

## Accomplishments

- **와이어**: `WorldFrame` 에 `k: "door"` 두 줄(사라짐·나타남)과 snap 의 `zone?: true`. 사라짐에는 좌표 키가 없다.
- **순수 규칙**(`shared/game/zones.ts`): 다음 통과 시각 `nextCrossingAt`, 구역 기억 맞추기 `reconcileZones`·`settleZones`. `clipToZone` 과 같은 탐색(`scanZone`)을 함께 쓴다.
- **구역 기억**(`WorldState.zones`): 위치 저장에 실리고, 복원은 방에 있는 id·`ZONE_IDS` 값만 살린다. 퇴장은 그 칸만, 대기실 복귀는 전부 지운다.
- **방 DO**: `syncZones` 를 새 구간을 만들기 전(applyMove·syncLayout)·알람·재접속 snap 앞에서 부른다. 알람은 `reschedule` 의 최솟값에 `nextZoneAt`, 걷기 요청은 `alarmBy`(이를 때만).
- **snap 거르기**: 방이 있는 맵의 산 사람은 본인 + 지금 같은 구역 사람만, 걷는 중인 남의 구간은 그 구역 안으로 자른다. 유령은 전원 전체 구간.
- **클라이언트 저장소**: door·zone snap 을 받아 `takeDoor()` 목록으로 넘긴다. 사라진 좌석의 `lastSegOf` 는 남는다.

## 검증 결과

| 명령 | 결과 |
|------|------|
| Task 1 verify: `npx vitest run test/unit/zones.test.ts test/unit/worldStore.test.ts test/unit/world.test.ts test/unit/mapTown.test.ts test/client/worldStage.test.tsx` | 파일 5 통과 · 시험 548 통과 · 실패 0 |
| Task 2 verify: `npx vitest run test/worker/townDoor.test.ts test/worker/town.test.ts test/worker/world.test.ts test/worker/reconnect.test.ts test/worker/ghostLeak.test.ts test/worker/alarm.test.ts test/worker/errandNear.test.ts` | 파일 7 통과 · 시험 100 통과 · 실패 0 |
| `npm run typecheck` | 종료 0, `error TS` 0 |
| `npx vitest run --project worker` | 파일 55 통과 · 5 건너뜀, 시험 611 통과 · 78 건너뜀 · 실패 0 |
| `npm test` (마지막 커밋 `20e88438` 기준 1회차) | 종료 0 — 파일 286 통과 · 6 건너뜀, 시험 **8412 통과 · 261 건너뜀 · 실패 0** |
| `npm test` (같은 커밋 2회차) | 종료 1 — 시험 8411 통과 · **실패 1**: `test/worker/bots.test.ts` "discussion: 봇 셋이 모두 토론 끝내기를 누르면…" (`expected 2 to be 3`) |
| 위생 git grep(바뀐 파일 10개) | 결과 0 |

**`npm test` 의 간헐 실패 (실패를 통과로 적지 않는다)**: 이 계획의 코드로 `npm test` 를 모두 8번 돌렸고 5번 통과, 3번은 시험 1개가 실패했다.

- 실패 3번 가운데 2번은 `test/worker/bots.test.ts`(기본판·재즈 바 봇 방)의 서로 다른 시험이다: "기본판 봇 방 자동 완주"(`runDurableObjectAlarm` 이 false), "discussion: 봇 셋이…"(`planKinds` 2 ≠ 3). 둘 다 이전 페이즈 기록에 있는 알려진 간헐 실패와 같은 모양이다(09-VERIFICATION 113행, 19-VERIFICATION 300행 — 봇 계획 알람과 시험의 읽기 사이 경합).
- 나머지 1번(첫 실행)은 실패한 시험 이름을 남기지 못했다. 그 뒤 이 계획의 시험 가운데 실제 시간에 기대던 곳(문턱을 이미 지났으면 던지던 도우미, 알람 시각을 읽는 시험의 짧은 여유)을 `20e88438` 에서 고쳤다.
- 비교: 이 계획 전 커밋(`20e0d42c`)을 임시 체크아웃으로 4번 돌린 결과는 4번 모두 통과(8361)였다. 표본이 작아 이 계획이 빈도를 올렸는지는 가리지 못했다. 재즈 바 판에서 이 계획의 서버 코드는 모두 바로 돌아가는 분기라(방이 없는 맵) 동작이 같다 — 원인은 확정하지 않았다. `deferred-items.md` 에 적었다.
- `test/worker/bots.test.ts` 만 따로(마을 시험 두 파일과 함께) 돌리면 통과한다(55 통과 · 4 건너뜀).

## RED 증거

`--reporter=tap-flat` 출력을 `gsd-tools check tdd-red-evidence` 에 넘겨 둘 다 `RED_EVIDENCE_OK`(target_test_failed)를 받았다. 기록은 gitignore 된 `.gsd/red/20-02-t1.json`·`20-02-t2.json`.

- **Task 1 RED**: `npx vitest run test/unit/zones.test.ts test/unit/worldStore.test.ts --reporter=tap-flat` → 69 중 **not ok 21** · ok 48, 종료 1. 대상 "문 앞 → 방 안: 구간 안의 정수 ms 이고 그 시각은 post, 1ms 전은 plaza 다" 가 `null`(자리 함수)로 실패(기대 `true true post plaza`). 통과한 48 = 기존 worldStore 시험 36 + 자리 함수와 우연히 맞는 새 시험 12(null·같은 객체·빈 목록 기대).
- **Task 2 RED**: `npx vitest run test/worker/townDoor.test.ts --reporter=tap-flat` → 16 중 **not ok 10** · ok 6, 종료 1. 대상 "광장의 산 사람은 좌표 없는 사라짐 한 개, 방 안의 산 사람은 그 방 안 구간의 나타남 한 개를 받는다" 가 `0:  // 0: `(문 프레임 없음)로 실패. 재접속 시험은 `seats=1,2,3,4,5 others=[post>plaza]`(구역 거르기 없음)로 실패. 처음부터 통과한 6 은 지금도 성립하는 지킴 시험이다(유령 전체 구간, 넘기 전 무전송, 방 안 사람이 받는 문턱 앞 구간, 더 이른 알람 유지, 유령 hello snap, 재즈 바 불변).
- **GREEN 뒤에 더한 시험 2개**("알람 맞추기(reschedule)에 문 통과가 들어간다")는 RED 를 거치지 않았다. 대신 `reschedule` 의 최솟값에서 통과 시각을 뺀 변이로 둘 다 실패하는 것을 확인했다(`armed=false`, `0: `).
- Task 2 GREEN 의 첫 실행은 18개 모두 통과였다(시험 기대를 고치지 않았다).

## Task Commits

| Task | 커밋 | 내용 |
|------|------|------|
| 1 RED | `20d07e54` test | 문 통과 규칙·와이어 실패 시험(+ 타입·자리 함수) |
| 1 GREEN | `4feecbb4` feat | nextCrossingAt·reconcileZones·settleZones, world.zones 저장, 저장소 takeDoor |
| 2 RED | `1dbb5cd1` test | 문 통과 프레임 실패 시험(+ 마을 도우미를 helpers 로) |
| 2 GREEN | `14a95300` feat | syncZones·알람·재접속 구역 거르기(+ 알람 맞추기 시험 2개) |
| 2 다듬기 | `20e88438` test | 문 통과 시험이 느린 실행에서도 같은 결과를 내게 |

## 와이어 모양

| 프레임 | 키 | 받는 사람 | 비고 |
|--------|----|-----------|------|
| door vanish | `t:"world"` `k:"door"` `e:"vanish"` `s`(좌석) `d`(방 id) | 떠난 구역의 산 사람 | 좌표 키 없음(`p`·`t0`·`v` 없음) |
| door appear | 위 + `e:"appear"` `p` `t0` `v` | 들어간 구역의 산 사람 | `p` 는 그 구역 안으로 자른 구간(첫 점 = 보낸 순간 위치, `t0` = 그 시각). 이미 도착했으면 한 점 |
| zone snap | `t:"world"` `k:"snap"` `at` `ents` `zone:true` | 구역이 바뀐 본인 | `ents` = 본인(전체 구간) + 새 구역 사람(서 있으면 한 점, 걷는 중이면 그 구역 안 구간) |
| snap(재접속·단계 진입) | 그대로(`zone` 없음) | 보는 사람 | 방이 있는 맵의 산 사람은 본인 + 같은 구역 사람만 |

- `d` 는 받는 쪽에서 본 문이다. 광장 ↔ 방에서는 양쪽 모두 그 방이다.
- 없는 값은 키를 싣지 않는다. `zone` 과 `near` 는 함께 붙지 않는다(심부름의 근처 snap 은 그대로 나간다).
- 재즈 바·광장 판에는 door·`zone` 이 한 번도 나가지 않는다.

## syncZones 가 보내는 것

바뀜 = 산 사람이고 구간이 있는 사람 가운데 구역 기억과 지금 구역(`zoneAt(구간, now)`)이 다른 사람. 좌석 오름차순으로 처리한다.

| 받는 사람 | 조건 | 받는 것 |
|-----------|------|---------|
| 이번에 바뀌지 않은 산 사람 V | 그 사람을 볼 수 있고(`worldVisibleTo`) V 의 기억 구역 = 떠난 구역 | door vanish |
| 이번에 바뀌지 않은 산 사람 V | 볼 수 있고 V 의 기억 구역 = 들어간 구역 | door appear(`clipToZone(구간, now)`) |
| 이번에 바뀌지 않은 산 사람 V | 그 밖의 구역 | 없음 |
| 이번에 바뀐 산 사람(본인 포함) | — | 문 프레임 대신 `snapFrameFor` 한 개(`zone: true`, 근처 snap 이면 그대로) |
| 유령 | — | 없음(이미 전체 구간을 받는다) |
| 기억이 없던 사람(판 시작·저장값 없음) | — | 알림 없이 기억만 |

- 심부름·밤은 `worldVisibleTo` 가 본인뿐이라 문 프레임이 없다(본인은 snap 을 받는다).
- 부르는 곳: `applyMove`·`syncLayout`(새 구간을 만들기 전), `alarm`(봇 배회 다음·심부름 표본 앞), `handleHello`(snap 앞).

## 바뀐 시그니처

- `shared/protocol.ts`: `WorldFrame` 에 `{ t:"world"; k:"door"; e:"vanish"; s; d: RoomId }` · `{ …; e:"appear"; s; d: RoomId; p; t0; v }`, snap 에 `zone?: true`.
- `shared/game/zones.ts`: `nextCrossingAt(map, seg, after): number | null` · `reconcileZones(map, w, ids, now): { world: WorldState; changes: ZoneChange[] }` · `settleZones(map, w, ids, now): WorldState` · `interface ZoneChange { id; from: ZoneId; to: ZoneId }`. 내부 `scanZone`.
- `shared/game/world.ts`: `WorldState.zones?: Readonly<Record<string, ZoneId>>`, `StoredWorld.zones?`. `compactWorld`·`restoreWorld`·`despawnPlayer` 가 다룬다(`respawnAll` 은 빈 world 에서 시작해 저절로 지운다).
- `worker/room.ts`: `private syncZones(now)` · `private nextZoneAt(now): number | null` · `private async alarmBy(at)` · `private zoneMemo(id): ZoneId | undefined`. `snapFrameFor` 반환형은 snap 프레임으로 좁혔다. `syncLayout` 은 `number | null`(새 구간들의 가장 이른 통과 시각)을 돌려준다.
- `src/world/store.ts`: `export interface DoorEvent { seat: number; kind: "vanish" | "appear"; d?: RoomId }`, `takeDoor(): DoorEvent[]`.

## Deviations from Plan (계획과 달라진 점)

### Auto-fixed Issues

**1. [Rule 2 - 누설 방지] snap 은 구역 기억이 아니라 지금 위치로 거른다**
- **Found during:** Task 2
- **Issue:** 계획은 "본인 좌석 + 기억 구역이 같은 사람". 판 시작 snap 은 기억이 아직 없을 때 나가고, 순간이동 뒤 snap 은 기억이 낡았을 때 나간다 — 기억으로 거르면 앞은 본인만 남거나, 뒤는 다른 구역 좌표가 실릴 수 있다.
- **Fix:** `snapFrameFor` 는 보는 사람과 남 모두 `zoneAt(구간, now)` 로 판정한다. `syncZones` 를 먼저 부르는 경로(재접속·본인 zone snap)에서는 기억과 같은 값이다.
- **Files:** worker/room.ts · **Commit:** `14a95300`

**2. [Rule 1 - 경합] 단계 배치는 알람을 따로 당기지 않는다**
- **Found during:** Task 2
- **Issue:** 계획은 applyMove·syncLayout 모두 기다리지 않는 `alarmBy`. syncLayout 은 뒤에 `reschedule` 이 이어지는 흐름 안에서 불려, 떼어 놓은 `getAlarm → setAlarm` 이 `reschedule` 의 알람 쓰기와 엇갈리면 이른 알람(단계 마감·봇 행동)을 통과 시각으로 덮을 수 있다.
- **Fix:** `syncLayout` 은 통과 시각을 돌려준다. 전환 경로는 뒤따르는 `reschedule`(`nextZoneAt`)이 넣고, 전환 없는 `advance` 꼬리는 `await this.alarmBy(…)` 로 차례대로 건다. applyMove 는 계획대로다(그 경로에는 뒤따르는 알람 쓰기가 없다).
- **Files:** worker/room.ts · **Commit:** `14a95300`

**3. [Rule 1 - 저장] 처음 기억하는 것만으로는 저장 타이머를 걸지 않는다**
- **Found during:** Task 2
- **Issue:** 계획은 "바뀌었으면 markWorldDirty". 알림 없는 첫 기억에도 2초 타이머가 걸려, 마을 판 워커 시험이 판마다 4초씩 늘었다(evict 가 타이머를 기다린다).
- **Fix:** 문 통과가 있을 때만 `markWorldDirty`. 문을 지나려면 먼저 걸어야 하고 그 걷기의 저장(applyMove·syncLayout)에 기억이 함께 실리므로 재시작 뒤 통과를 놓치지 않는다("저장 뒤 DO 가 내려갔다 다시 깨어나도…" 시험).
- **Files:** worker/room.ts · **Commit:** `14a95300`

**4. [Rule 2 - 견고함] 밀린 통과 알람을 다음 알람 맞추기가 깨운다**
- **Issue:** 통과 시각의 알람이 깨어나기 직전에 다른 경로의 `reschedule` 이 알람을 다시 쓰면 그 통과가 다음 알람(단계 마감)까지 알려지지 않는다.
- **Fix:** `nextZoneAt` 은 기억과 지금 구역이 이미 다른 사람이 있으면 `now` 를 돌려준다(곧바로 알람). 시험 "통과 시각의 알람이 다른 알람 쓰기에 밀려 사라졌어도…".
- **Files:** worker/room.ts · **Commit:** `14a95300`

**5. [Rule 2 - 닫힌 쪽] emitMove 는 움직인 사람의 기억이 새 구간의 지금 구역과 같을 때만 같은 구역에 보낸다**
- 정상 흐름에서는 늘 같다(부르는 쪽이 먼저 `syncZones`). 어긋난 상태면 보내지 않고 다음 `syncZones` 가 문 프레임으로 알린다.

### 계획의 모양을 바꾼 곳

**6. 문 프레임의 `d`** — 계획: "from·to 중 plaza 가 아닌 방". 광장 ↔ 방에서는 같다. 방 → 방(알람이 아주 늦어 두 문을 한 번에 지난 것으로 보일 때)은 사라짐에 떠난 방, 나타남에 들어간 방을 싣는다.

**7. 저장소의 가장자리 동작(더한 것)** — 없는 좌석의 vanish 는 버린다(목록·알림 없음). zone·near 가 없는 snap 은 아직 꺼내지 않은 문 목록을 비운다(등장 대기와 같은 규칙). `retainSeats` 는 방을 떠난 좌석을 문 목록에서도 뺀다. appear 는 그 좌석을 등장 대기에서 뺀다.

**8. 시험 도우미를 helpers 로 옮겼다** — `townGame`·`placeSeats`·`actorOf`·`idOfSeat` 를 `test/worker/town.test.ts` 에서 `test/worker/helpers.ts` 로 옮기고 `memWorld`·`shiftSeg` 를 더했다(계획의 파일 목록 밖 두 파일). `placeSeats` 는 이제 **구역 기억도 그 자리로 맞춘다** — 시험이 사람을 놓은 것이 문 통과로 알려지지 않게.

**9. 시험 요령** — 계획: "t0 를 2초 앞당기고 알람". 실제: 통과 시각 바로 뒤가 되게 당기고(`passDoor`) 프레임을 걷기 요청 전부터 모은다. 제때 깨어난 알람이 통과를 냈어도 결과가 같다. 알람 시각을 읽는 시험은 문턱까지 7초 넘게 걸리는 자리에서 출발한다.

**10. 계획에 없던 시험** — 두 사람이 엇갈려 넘음, 재시작 뒤 놓친 통과, 더 이른 알람 유지, 단계 배치로 나오는 길, 밀린 알람, 유령 hello snap, 심부름 단계.

**11. 커밋 수** — Task 2 는 test·feat 한 쌍에 시험 다듬기 커밋 하나가 더 있다.

**12. 할 일이 없던 것** — 계획 Task 1 의 "planWander 의 `cellCenterFx(…, map)`" 는 20-01(`ab4750de`)이 이미 했다.

---

**Total deviations:** 자동 수정 5(누설 방지 1 · 경합 1 · 저장 1 · 견고함 2), 모양 바꿈 7.
**Impact:** 와이어와 받는 사람 규칙은 계획 그대로다. 달라진 것은 snap 의 구역 판정 기준(지금 위치), 알람을 거는 자리, 저장 타이머다.

## 알려진 한계

- **서버가 사람을 한꺼번에 옮기는 곳(밤·아침의 `teleportHome`)은 아직 구역 기억을 맞추지 않는다.** 방 안에 있던 사람이 옮겨지면 다음 `syncZones` 가 그것을 문 통과로 알린다(사라짐·나타남·zone snap). snap 자체는 지금 위치로 거르므로 좌표가 새지는 않는다. 20-03 이 `settleZones` 로 막는다.
- **심부름의 근처 snap(`nearSnapFrame`)은 아직 구역으로 거르지 않는다** — 벽 너머라도 반경 안이면 실린다(T-20-01 의 남은 표면, 20-03).
- **화면**: 런타임은 `takeDoor` 를 읽지 않는다. 지금은 사라짐 = 기존 퇴장 연출, 나타남 = 등장 연출 없이 바로 서 있음. 20-06 이 문 연출로 바꾼다.
- 생성자의 단계 마감 보정 알람(`nextWakeAt` 만)은 통과 시각을 넣지 않는다 — 다음 알람이 맞춘다.
- `advance` 꼬리의 `alarmBy`(전환 없이 배치만 맞춘 경우)는 시험이 없다.
- 두 번의 맞추기 사이에 방 → 광장 → 다른 방을 지나면 방 → 방 한 번으로 알려진다.

## 20-03 에 넘기는 것

- **심부름 근처 snap 의 구역 거르기(D-17)**: `nearSnapFrame` 을 쓰는 세 곳 — `syncErrandView`, `snapFrameFor` 의 errand 분기(재접속·`syncZones` 의 본인 snap 도 이 분기를 지난다). "반경 안 **이고** 지금 같은 구역"(`zoneAt(map, 구간, now)`)이어야 싣고, 걷는 중인 남의 구간은 `clipToZone(map, 구간, now)` 로 자른다. `snapFrameFor` 의 일반 분기가 같은 일을 하는 본보기다.
- **목격 기록(D-18)**: `sampleErrand` 에 넘기는 위치 함수(`runErrandTick`)에서 같은 구역 사람만 적게 한다.
- **순간이동 뒤 `settleZones`**: `syncHome` 의 `teleportHome` 두 곳 다음, `snapEachViewer` 앞에서 `this.world = settleZones(this.mapDef(), this.world, 옮긴 id들, now)`. 대기실 복귀·다시 하기는 `respawnAll` 이 기억을 지우고 맵도 방 없는 맵이라 할 일이 없다.
- **한 판 누설 전수**: 좌표가 실리는 프레임은 넷이다 — `move`(`p`), `door` appear(`p`), `snap`(`ents[].p`), 근처 snap(`near`). door vanish 에는 좌표가 없다. 보는 사람의 구역은 서버 메모리(`memWorld(code).segs` + `zoneOf`)로 구한다.
- **시험 도우미**(`test/worker/helpers.ts`): `townGame(phase, guests)` · `placeSeats(code, {좌석: 위치})`(구역 기억도 맞춤, 메모리에만 쓴다 — evict 하는 도우미 앞에서는 `flushWorld`) · `memWorld(code)` · `shiftSeg(code, 좌석, ms)` · `actorOf` · `idOfSeat`. `test/worker/townDoor.test.ts` 의 지역 도우미 `scene`·`walkSeat`(메모리 구간 직접 쓰기 — 알람이 안 걸린다)·`passDoor`·`alarmAndCollect`·`doorLine`·`snapLine`·`mentions` 는 다른 파일에서 쓰면 helpers 로 옮긴다.
- **시험 시간**: 마을 판에서 world 를 더럽힌 채(`markWorldDirty`) evict 하면 저장 타이머 2초를 기다린다. 걷기 요청 뒤 `advanceTo`·`killSeats` 를 부르기 전에 `flushWorld` 한다.
- **알람**: 통과 시각 알람은 실제 시간에 깨어난다(들어가는 길 0.6초쯤). 프레임을 걷기 요청 전부터 모으면 누가 냈든 같다.

## 20-05 · 20-06 에 넘기는 것 (화면)

- **읽는 곳**: `store.takeDoor(): DoorEvent[]` — `{ seat, kind: "vanish" | "appear", d? }` 를 받은 순서대로, 한 번 꺼내면 비워진다. 런타임의 좌석 맞추기 고리(`store.takeEntered()` 를 읽는 곳) 앞에서 읽는다.
- **사라짐**: 그 좌석은 `store.seats()`·`segOf` 에서 이미 빠졌다. 옅어질 자리는 `store.lastSegOf(seat)` — 서버가 문턱에서 끝나게 자른 구간이라 끝점이 문 앞이다. 지금은 구간이 없어진 배우를 `beginExit` 이 퇴장시키므로, 문 목록에 있는 좌석은 문 연출(0.2초 옅어짐, D-15)로 돌린다.
- **나타남**: `segOf(seat)` 에 구간이 들어 있고 `takeEntered()` 에는 없다(등장 연출 대상이 아니다). 첫 점이 나타날 자리다.
- **`d`**: 문의 방 id. 문 위치는 `TOWN_ROOMS.find((r) => r.id === d)!.door`(고정소수점). 내가 구역을 넘어 받은 zone snap 에서 온 항목에는 `d` 가 없다 — 그 사람들은 문을 지난 것이 아니라 내 시야가 바뀐 것이다.
- **내가 문을 지날 때**: zone snap 한 개가 온다. 내 좌석의 구간은 전체 그대로이고 이동 응답 세기(`moveSeqOf`)도 이어진다(내 예측 구간이 끊기지 않는다).
- **순서**: 같은 구역에 있던 사람은 문턱에서 끝나는 `move` 를 먼저 받고, 넘는 순간 `door vanish` 를 받는다. 들어가는 쪽은 넘기 전에 아무것도 받지 않는다.
- **유령 화면**: 문 프레임이 오지 않는다. 늘 모두의 전체 구간이 온다.
- **zone·near 가 없는 snap** 은 아직 꺼내지 않은 문 목록을 비운다(바로 맞춘다).
- client 프로젝트 시험에는 고정 맵 잠금이 없다.

## Deferred Issues

- `test/worker/bots.test.ts` 의 간헐 실패(위 "검증 결과"). 이 계획의 범위 밖이라 고치지 않고 `.planning/phases/20-map-expansion/deferred-items.md` 에 적었다.

## Threat Flags

없음. 새 끝점·인증 경로가 없다. 저장 모양의 새 키 `zones` 는 계획의 T-20-08 이 다룬다(방에 있는 id·`ZONE_IDS` 값만 복원). T-20-05(나타남은 통과 시각에만, 구간은 그 구역 안)·T-20-06(사라짐에 좌표 없음, 재접속 snap 구역 거르기)·T-20-07(알람은 이를 때만, 저장은 기존 디바운스)·T-20-08 을 구현하고 시험으로 고정했다. T-20-01 의 남은 표면(심부름 근처 snap)은 "20-03 에 넘기는 것"에 적었다.

## Known Stubs

없음. RED 커밋의 자리 함수(`nextCrossingAt`·`reconcileZones`·`settleZones`, 저장소 `takeDoor`)는 구현 커밋에서 실제 구현으로 바뀌었다. `settleZones` 는 구현·시험이 있고 서버에서 부르는 곳은 20-03 이 더한다.

## 그 밖

- spec-less probe fallback 건너뜀: 요구사항 ID 없음 — ROADMAP 성공 기준과 20-CONTEXT D-nn 으로 대신했다.
- `docs/architecture.md` 의 world 프레임 설명에는 door·구역을 더하지 않았다(이 계획의 범위 밖).
- push·배포·HANDOFF 갱신은 하지 않았다(20-10).
- 기준선 비교용 임시 체크아웃은 저장소 밖 임시 폴더에 만들었다가 지웠다(`git worktree list` 는 본 작업 폴더 하나).

## Self-Check: PASSED

- 새 파일 2개(`test/unit/zones.test.ts`, `test/worker/townDoor.test.ts`)와 SUMMARY 가 있다.
- 커밋 5개(`20d07e54` · `4feecbb4` · `1dbb5cd1` · `14a95300` · `20e88438`)가 모두 HEAD 의 조상이다.
- 수용 기준: `k: "door"` 2 · `zone?: true` 1 · zones.ts 의 export 함수 3 · world.ts 의 `zones` 9 이상 · `takeDoor` 2 · `private syncZones` 1 · `this.syncZones(` 4 · `nextCrossingAt|nextZoneAt` 7 · townDoor.test 의 `vanish` 8 이상.
