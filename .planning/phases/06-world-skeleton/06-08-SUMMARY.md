---
phase: 06-world-skeleton
plan: "08"
subsystem: api
tags: [durable-object, websocket, world, server-authoritative-movement, hibernation, debounced-storage, tdd, vitest]

requires:
  - phase: 06-world-skeleton/06-05
    provides: "shared/game/world.ts 의 requestMove·spawnPlayer·despawnPlayer·respawnAll·compactWorld·restoreWorld·snapFrame·moveFrame·planWander·nextWanderAt·WORLD_FLUSH_MS, protocol 의 MoveMessage·WorldFrame, MoveMessageSchema"
  - phase: 06-world-skeleton/06-02
    provides: "shared/game/map.ts 의 BAR_MAP(입장 지점 8곳, 이동 마스크)"
provides:
  - "worker/room.ts — 로비 이동 구역: world 상태(별도 storage 키), handleMove/applyMove(사람·봇 공용 본체), emitWorld(world 프레임의 유일한 전송 경로, 로비 전용), hello 뒤 snap, 입장·퇴장·봇 수·리셋의 world 동기화, 2초 디바운스 저장과 즉시 저장 지점, 퇴거 복원, 테스트 방 봇 로비 배회"
  - "shared/protocol.ts·schemas.ts — ClientMessage 유니온과 ClientMessageSchema 에 move 멤버"
  - "test/worker/world.test.ts(신규 25개), 누출 검사 world 프레임 확장, 테스트 도우미 worldOf·flushWorld·worldDirty·wanderTimes"
affects: [06-09 클라이언트 스토어(world.move·snap 수신), 06-13 월드 런타임, 7~9페이즈(emitWorld 자리에 채널별 audience 함수가 들어온다), 11페이즈 다시 하기(testReset 의 respawnAll 과 같은 길)]

plan_head_before: 9a285aeb5cb8a1c8bfd530c1943d0b2cc4c27648
plan_head_after: 84efd7127d91448d73c1227b0e5ce29097ec3c62

actuals:
  tokens: 9700
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "소켓 껍데기(handleMove)와 본체(applyMove) 분리 — 봇 배회도 같은 본체를 지나 단계·150ms 간격·경로 검사를 받는다(결정 0024, 특권 없음)"
    - "world 프레임은 emitWorld 한 곳으로만 나간다(로비의 연결된 전원). broadcastEvent 를 world 에 쓰지 않는다 — 7~9페이즈 audience 함수가 들어올 자리"
    - "전송이 먼저, 저장은 뒤: 위치는 room 키와 분리된 world 키에 2초 디바운스 한 번(markWorldDirty), 나가기·내보내기·시작·마지막 사람 끊김·알람에서는 즉시(flushWorld)"
    - "테스트 방 봇 배회는 알람 하나(reschedule)에 합쳐진다: min(단계 마감·만료, 봇 행동, 배회). 사람 연결이 없으면 배회 시각을 알람에서 뺀다"

key-files:
  created:
    - test/worker/world.test.ts
  modified:
    - worker/room.ts
    - shared/protocol.ts
    - shared/schemas.ts
    - test/unit/schemas.test.ts
    - test/worker/helpers.ts
    - test/worker/leak.test.ts
    - test/worker/testTools.test.ts

key-decisions:
  - "MoveMessageSchema 선언을 ClientMessageSchema 앞으로 옮겼다(const 선언 순서 — 유니온이 멤버로 쓰려면 먼저 있어야 한다)"
  - "world 와 방 사람의 동기화는 syncWorldPlayers 한 함수로 한다(방에 있는데 world 에 없으면 입장 지점에 세우고, world 에 있는데 방에 없으면 지운다). testBots 가 새 봇의 한 점 move 를 seat 순으로 보내고 뺀 봇을 지운다"
  - "배회 계획(syncWanderPlan)은 계획이 없는 봇에게만 planWander 를 불러 첫 시각을 정한다 — planWander 가 처음 보는 봇은 이동 없이 계획만 세운다는 계약을 이용해, 알람이 걸리기 전에 wanderAt 이 존재하게 한다"
  - "연결된 사람이 0 이 되면 flushWorld 뒤 reschedule 해서 배회 알람을 방 만료로 되돌리고, 사람이 없던 방에 첫 사람이 hello 하면 reschedule 로 배회 알람을 건다"
  - "시작·리셋·나가기에서는 reschedule(알람) 을 먼저 하고 world 저장을 그 뒤에 한다 — 저장 쓰기 때문에 단계 마감 알람이 늦어지거나 기존 테스트의 알람 타이밍이 흔들리지 않게"

patterns-established:
  - "world 프레임 누출 검사: 각 소켓에서 첫 로비 밖 state 이후 world 프레임 0, 모든 키 경로는 {t,k,s,p,t0,v,at,ents,ents[].s/p/t0/v}, 문자열 값은 t=world, k=move|snap 뿐, 로비에서 적어도 하나는 받았다(공허한 통과 방지)"
  - "RED 증거는 실패하는 단일 테스트를 -t 로 골라 vitest --reporter=tap-flat 으로 기록하고 gsd check tdd-red-evidence 가 RED_EVIDENCE_OK 를 준 뒤 GREEN"

requirements-completed: [MAP-01, MAP-02, MAP-05]

coverage:
  - id: D1
    description: "로비에서 손님의 move 한 번이 서버 경로(첫 점=지금 위치, 끝 점=보정된 목적지, v 180)가 되어 연결된 모든 소켓에 JSON 이 같은 world.move 로 간다"
    requirement: MAP-02
    verification:
      - kind: integration
        ref: "test/worker/world.test.ts#손님의 move 한 번은 방장·손님 소켓에 같은 world.move 로 가고 첫 점은 손님 위치, 끝 점은 목적지다"
        status: pass
      - kind: integration
        ref: "test/worker/world.test.ts#걸을 수 없는 무대 중심을 누르면 끝 점이 걸을 수 있는 곳으로 보정된다"
        status: pass
    human_judgment: false
  - id: D2
    description: "로비가 아닌 단계·150ms 안의 두 번째 move·hello 전 소켓의 move 는 오류 프레임 없이 조용히 버려지고, 형식이 틀린 move 는 BAD_MESSAGE"
    requirement: MAP-02
    verification:
      - kind: integration
        ref: "test/worker/world.test.ts#같은 손님이 100ms 뒤 다시 보낸 move 는 어느 소켓에도 새 프레임도 오류도 만들지 않는다"
        status: pass
      - kind: integration
        ref: "test/worker/world.test.ts#hello 전 소켓의 move 는 아무 프레임도 만들지 않는다"
        status: pass
      - kind: integration
        ref: "test/worker/world.test.ts#형식이 틀린 move(소수·덧붙은 seat)는 기존 규칙대로 BAD_MESSAGE 다"
        status: pass
      - kind: unit
        ref: "test/unit/schemas.test.ts#ClientMessageSchema move (06-08, 결정 0044-17)"
        status: pass
    human_judgment: false
  - id: D3
    description: "hello 를 마친 소켓은 같은 연결에서 state 다음에 world.snap 을 받고(로비일 때만), 참가·방 만들기·봇 추가 때 입장 지점에 서서 연결된 소켓이 한 점 world.move 를 받는다"
    requirement: MAP-01
    verification:
      - kind: integration
        ref: "test/worker/world.test.ts#방장 hello 의 프레임 순서는 [state, world.snap] 이고 snap 에 seat 0 이 입장 지점 한 점으로 있다"
        status: pass
      - kind: integration
        ref: "test/worker/world.test.ts#손님이 참가하면 방장 소켓이 state(2명) 다음에 그 손님의 한 점 world.move 를 받는다"
        status: pass
      - kind: integration
        ref: "test/worker/world.test.ts#봇 3 → 방장 소켓에 state 다음 봇 seat 별 한 점 world.move 3개, 봇 1 로 줄이면 뺀 봇은 world 에서 지워진다"
        status: pass
    human_judgment: false
  - id: D4
    description: "위치는 world 키에 2초 디바운스 한 번, 나가기·내보내기·시작·마지막 연결 끊김·알람에서 즉시 저장되고, 퇴거·배포 뒤 생성자가 되살려 같은 위치(진행 중 구간 포함)의 snap 을 준다. world 키 없는 옛 방은 입장 지점으로 복원된다"
    requirement: MAP-05
    verification:
      - kind: integration
        ref: "test/worker/world.test.ts#move 직후 storage world 는 아직 이전 값이고 타이머가 잡혀 있다. flush 뒤에는 compactWorld 모양으로 그 사람 구간이 들어 있다"
        status: pass
      - kind: integration
        ref: "test/worker/world.test.ts#이동 → flush → 퇴거 → 재접속 hello 의 snap 이 퇴거 전과 같은 위치(진행 중 구간 포함)다"
        status: pass
      - kind: integration
        ref: "test/worker/world.test.ts#storage 에 world 키가 없는 옛 방(room 키만)을 퇴거 뒤 깨우면 모든 사람이 입장 지점으로 복원된다"
        status: pass
      - kind: integration
        ref: "test/worker/world.test.ts#마지막 연결된 사람의 소켓이 닫히면 디바운스 대기 중이던 world 가 즉시 저장된다"
        status: pass
    human_judgment: false
  - id: D5
    description: "퇴장·내보내기·방 삭제·게임 시작·테스트 리셋에서 world 가 맞게 정리된다: 나간 사람 제거, 방 삭제 시 world 키 삭제, 시작 뒤 world 프레임 0, 리셋은 모두 입장 지점으로 되돌리고 state 다음 snap"
    requirement: MAP-01
    verification:
      - kind: integration
        ref: "test/worker/world.test.ts#퇴장·내보내기·방 삭제 (MAP-01)"
        status: pass
      - kind: integration
        ref: "test/worker/world.test.ts#게임 시작은 world 를 즉시 저장하고, 그 뒤로는 move 를 받아도 어느 소켓에도 world 프레임이 가지 않는다"
        status: pass
      - kind: integration
        ref: "test/worker/world.test.ts#테스트 리셋(대기실 복귀)은 모든 소켓이 state 다음 snap 을 받고 모든 사람이 입장 지점이다"
        status: pass
    human_judgment: false
  - id: D6
    description: "테스트 방 봇이 로비에서 사람이 연결되어 있을 때만 3~6초마다 사람과 같은 applyMove 로 배회하고, 알람 하나가 단계 마감·만료·봇 행동·배회 중 가장 이른 시각으로 잡힌다. 봇 배회도 150ms 간격 검사를 지난다"
    requirement: MAP-02
    verification:
      - kind: integration
        ref: "test/worker/world.test.ts#방장이 연결된 테스트 방에서 봇 wanderAt 이 되면 알람이 사람과 같은 규칙으로 봇의 world.move 를 보낸다"
        status: pass
      - kind: integration
        ref: "test/worker/world.test.ts#알람 시각은 방 만료와 가장 이른 wanderAt 의 최솟값이다"
        status: pass
      - kind: integration
        ref: "test/worker/world.test.ts#방장이 끊기면(연결된 사람 0) 배회 시각이 알람에 들어가지 않고 알람은 방 만료로 돌아간다"
        status: pass
      - kind: integration
        ref: "test/worker/world.test.ts#같은 봇의 wanderAt 을 연달아 당겨도 150ms 안에는 두 번째 프레임이 없다(특권 없음)"
        status: pass
    human_judgment: false
  - id: D7
    description: "6명 한 판 두 시나리오(두 밤·두 아침, 처형·종료까지) 전수 누출 검사: world 프레임은 첫 로비 밖 state 이전에만 있고 키 경로·문자열 값이 허용 목록 안이다(토큰·id·역할 없음)"
    requirement: MAP-02
    verification:
      - kind: integration
        ref: "test/worker/leak.test.ts#assertWorldFrames (두 describe 모두)"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-11-01
status: complete
---

# Phase 6 Plan 08: 방 DO 로비 이동 연결 Summary

**move 한 번이 서버 경로가 되어 로비 전원에게 같은 world.move 로 나가고, 위치는 별도 world 키에 2초 디바운스로 저장되어 퇴거 뒤에도 되살아나며, 테스트 방 봇은 사람과 같은 본체로 로비를 배회한다**

## Performance

- **Duration:** 17 min
- **Started:** 2026-10-31T16:10:00Z
- **Completed:** 2026-10-31T16:27:30Z
- **Tasks:** 3 (트레이서 1 + auto 2)
- **Files modified:** 8 (신규 1 포함)

## Accomplishments

- `move` 가 ClientMessage 유니온과 ClientMessageSchema 의 멤버가 되었다. 방 DO 는 소켓 첨부 playerId 만 신뢰하고, 로비가 아니거나 방에 없거나 150ms 안이거나 hello 전이면 오류 프레임 없이 조용히 버린다. 형식이 틀린 move(소수·덧붙은 seat)는 기존 규칙대로 BAD_MESSAGE.
- `emitWorld` 가 world 프레임의 유일한 전송 경로다(로비의 연결된 전원). hello 뒤에는 state 다음에 그 소켓에만 snap 이 가고, 참가·방 만들기·봇 추가 때는 입장 지점의 한 점 구간이 간다. 게임이 시작되면 어떤 world 프레임도 나가지 않는다 — 6명 한 판 두 시나리오 전수 검사로 고정했다.
- 위치는 room 키와 분리된 `world` 키에 `markWorldDirty`(2초 디바운스 한 번)로 저장하고, 나가기·내보내기·로비를 떠나는 시작·마지막 사람 연결 끊김·알람 시작에서는 즉시 `flushWorld` 한다. 생성자가 room·world 를 한 번에 읽어 `restoreWorld` 로 되살린다(world 키 없는 옛 방은 입장 지점).
- 테스트 방 봇이 로비·사람 연결 중에만 3~6초마다 배회한다. `applyMove` 본체를 지나므로 150ms 간격·경로 검사를 같이 받고, 알람은 단계 마감·만료·봇 행동·배회 중 가장 이른 시각 하나다. 사람이 없으면 배회 시각을 알람에서 빼 버려진 테스트 방이 깨어나지 않는다.

## Task Commits

TDD 라 작업마다 RED → GREEN 두 커밋이다(REFACTOR 는 Task 3 GREEN 에 world 구역 머리 주석으로 합쳤다).

1. **Task 1: 트레이서 — move → 두 소켓 같은 world.move, hello 뒤 snap** — RED `eb3411f` (test) → GREEN `81f353a` (feat)
2. **Task 2: world 키 디바운스·즉시 저장·퇴거 복원·퇴장/내보내기/봇 수/대기실 복귀** — RED `b05fdb1` (test) → GREEN `ab59e3c` (feat)
3. **Task 3: 테스트 방 봇 로비 배회(알람)와 world 프레임 누출 검사 확장** — RED `eefabd1` (test) → GREEN `84efd71` (feat)

**Plan metadata:** 이 SUMMARY 와 STATE/ROADMAP/REQUIREMENTS 를 담은 docs 커밋 (아래 최종 커밋)

## TDD Gate Compliance

세 작업 모두 `test(06-08)` → `feat(06-08)` 순서다. RED 증거는 실패하는 단일 테스트를 `-t` 로 골라 vitest `--reporter=tap-flat` 으로 기록하고 `gsd_run check tdd-red-evidence` 가 `RED_EVIDENCE_OK`(`target_test_failed`)를 준 뒤에 GREEN 을 썼다.

| Task | RED 대상 테스트 | 실패 단언 | semanticAssessment |
|------|----------------|-----------|--------------------|
| 1 | `schemas.test.ts > ClientMessageSchema move (06-08, 결정 0044-17) > 받는다: 정수 ±700 목적지` | `success` 가 true 여야 하는데 false(move 가 유니온에 없음) | 대상 테스트가 실행되어 계획한 단언에서 실패. import/구문/설정 오류 아님. (워커 쪽 world 테스트 8개도 프레임이 오지 않아 실패 확인) |
| 2 | `world.test.ts > 테스트 방 봇 수·시작·대기실 복귀 > 봇 3 → 방장 소켓에 state 다음 봇 seat 별 …` | 기대 `state,world.move,world.move,world.move`, 실제 `state` | 대상이 실행되어 프레임 순서 단언에서 실패. 봇 입장 시 world 동기화 미구현이 원인. RED 커밋의 `flushWorld`·`worldFlushTimer` 뼈대는 비어 있어 타입만 맞춘다 |
| 3 | `world.test.ts > 봇 로비 배회 (결정 0024) > 알람 시각은 방 만료와 가장 이른 wanderAt 의 최솟값이다` | wanderAt 항목이 3개여야 하는데 0개 | 대상이 계획한 단언까지 실행되어 실패. 배회 계획 미구현이 원인 |

참고: 한 파일에서 여러 테스트가 동시에 실패하는 보고서는 vitest 가 여러 줄 객체를 YAML 로 내보내 분류기가 거절할 수 있어(06-05 경험) 단일 스칼라 단언 테스트를 골랐다. Task 3 의 leak 확장과 일부 가드 테스트(hello 전 move, BAD_MESSAGE, 시작 뒤 배회 없음)는 RED 시점에 이미 통과한다 — 회귀 방지 가드이고 RED 대상이 아니다.

## Files Created/Modified

- `worker/room.ts` — world 필드·타이머, createRoom/join 스폰, handleMove/applyMove/emitWorld, hello 뒤 snap, 저장(markWorldDirty·flushWorld·dropWorld), syncWorldPlayers, 봇 배회(wanderActive·wanderBots·syncWanderPlan·runBotWander), reschedule 알람 합치기
- `shared/protocol.ts` — ClientMessage 에 `| MoveMessage`
- `shared/schemas.ts` — MoveMessageSchema 를 ClientMessageSchema 앞으로 옮기고 유니온 멤버로 추가
- `test/worker/world.test.ts` (신규) — 이동·순서·조용한 거절·저장·퇴거 복원·퇴장·봇 수·시작·리셋·봇 배회 25개
- `test/worker/helpers.ts` — `worldOf`·`flushWorld`·`worldDirty`·`wanderTimes`
- `test/worker/leak.test.ts` — `assertWorldFrames`(두 6명 한 판 시나리오에 호출)
- `test/unit/schemas.test.ts` — ClientMessageSchema 의 move 받기/거부
- `test/worker/testTools.test.ts` — 리셋 뒤 알람 기대값 갱신(아래 Deviations)

## Decisions Made

- `syncWorldPlayers` 한 함수로 방 인원과 world 를 맞춘다. testBots 는 이를 부르고 새 봇만 한 점 move 를 보낸다.
- 배회 계획은 `planWander` 가 처음 보는 봇에게 이동 없이 계획만 세운다는 계약을 이용해, reschedule 안에서 계획 없는 봇에게만 불러 `wanderAt` 이 알람 이전에 존재하게 했다.
- 시작·리셋·나가기는 알람 재설정을 먼저 하고 world 저장을 뒤에 한다(저장 쓰기가 알람 타이밍을 흔들지 않게).
- 연결된 사람이 0 이 될 때 reschedule 로 배회 알람을 만료 쪽으로 되돌리고, 사람이 없던 방에 첫 사람이 hello 하면 reschedule 로 배회 알람을 건다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 기존 testTools 테스트의 알람 기대가 배회 알람 때문에 깨짐**
- **Found during:** Task 3 (전체 suite 확인)
- **Issue:** `testTools.test.ts` "ended 에서 testReset …" 이 리셋 뒤 알람이 `room.expiresAt` 이라고 단언한다. 리셋 뒤 방은 봇이 남은 연결된 테스트 방이라 이 계획의 설계(알람 = min(만료, 배회))대로 알람이 배회 시각이 되어 기대가 어긋났다.
- **Fix:** 기대값을 `min(room.expiresAt, …wanderTimes)` 로 바꾸고 helpers 에 `wanderTimes` 를 더했다. 이 테스트의 의도(알람이 옛 종료 단계 마감이 아니라 대기실 기준으로 옮겨졌다)는 그대로다. 계획의 A3("기존 worker 테스트 중 새 로비 프레임·동작 때문에 깨지면 기대값을 반영해 고친다")와 같은 취지다.
- **Files modified:** test/worker/testTools.test.ts, test/worker/helpers.ts
- **Verification:** 전체 vitest 125 파일 3402 통과
- **Committed in:** 84efd71

**2. [Rule 3 - Blocking] MoveMessageSchema 를 ClientMessageSchema 앞으로 이동**
- **Found during:** Task 1 (GREEN)
- **Issue:** 06-05 가 MoveMessageSchema 를 ClientMessageSchema 뒤에 선언해 두어, 유니온 멤버로 쓰면 const 초기화 순서(TDZ)로 깨진다.
- **Fix:** 선언 위치만 옮겼다(내용 불변).
- **Files modified:** shared/schemas.ts
- **Committed in:** 81f353a

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** 둘 다 계획의 설계를 그대로 따른 파생 수정이다. 범위 확대 없음. `files_modified` 에 없던 `test/worker/testTools.test.ts` 한 곳만 더 건드렸다.

## Issues Encountered

- 첫 시도에서 RED 증거 JSON 을 scratchpad 에 쓰자 분류기가 "프로젝트 디렉터리 밖" 으로 거절했다. 프로젝트 안 임시 파일로 두고 분류 뒤 지워 해결했다(커밋 안 됨).
- hello 뒤 snap 이 아직 오는 중에 `mark` 를 잡아 프레임 수가 어긋나는 시험 흐름 문제가 있어, 해당 테스트는 mark 전에 `settle` 로 비운다.

## User Setup Required

None - no external service configuration required. 배포하지 않았다(이 계획은 배포 권한이 없다).

## Known Stubs

없음. RED 커밋의 `flushWorld`·`worldFlushTimer` 뼈대는 같은 작업의 GREEN 에서 구현으로 바뀌었다.

## Threat Flags

없음. 새 네트워크 엔드포인트·인증 경로 없음. move 입력 신뢰 경계(T-06-16~20)는 계획의 threat_model 이 이미 다룬다: 로비 단계 가드(emitWorld·snap)와 6명 한 판 누출 검사(T-06-16), 첨부 playerId 만 사용·strictObject(T-06-17), 연당 20/s + 150ms 조용한 버림(T-06-18), 2초 디바운스·room 키 분리·사람 연결 중 배회만(T-06-19), 봇도 applyMove 본체(T-06-20).

## Next Phase Readiness

- 06-09 클라이언트 스토어가 받는 프레임의 출처가 준비되었다: hello 뒤 `[state, world.snap]` 순서, 입장 때 `world.move`(한 점), 로비 밖 world 프레임 0.
- 7~9페이즈는 `emitWorld` 의 수신자 순회 자리에 채널별 audience 함수를 넣으면 된다(머리 주석에 명시).
- 알려둘 점: 배회 알람이 테스트 방 로비에서 3~6초마다 깬다. 일반 방에는 봇이 없어 영향 없고, 사람이 없는 테스트 방은 알람을 걸지 않는다.

## Self-Check: PASSED

- 생성·수정 파일 존재: `test/worker/world.test.ts`, `worker/room.ts`, `shared/protocol.ts`, `shared/schemas.ts`, `test/worker/helpers.ts`, `test/worker/leak.test.ts`, `test/unit/schemas.test.ts`, `test/worker/testTools.test.ts` 확인(아래 점검).
- 커밋 6개 모두 HEAD 의 조상: eb3411f, 81f353a, b05fdb1, ab59e3c, eefabd1, 84efd71.
- 전체 `npx vitest run` 125 파일 3402 통과(1 건너뜀은 기존), `npm run typecheck` 통과, 작업별 acceptance_criteria grep 통과.

---
*Phase: 06-world-skeleton*
*Completed: 2026-11-01*
