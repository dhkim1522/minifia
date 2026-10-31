---
phase: 06-world-skeleton
plan: "05"
subsystem: api
tags: [world, segment-interpolation, fixed-point, wire-protocol, zod, tdd, vitest]

requires:
  - phase: 06-world-skeleton/06-02
    provides: "shared/game/map.ts 의 routeFx·snapToWalkable·lineWalkable·walkableCells·cellCenterFx·BAR_MAP — 이동 요청이 경로와 보정을 그대로 쓴다"
provides:
  - "shared/game/world.ts — 구간(Segment) 보간 positionAt/positionAtFx/segmentEndsAt, 이동 요청 requestMove(150ms 간격·걷는 중 재요청·막힌 목적지 보정), 입장/퇴장/복귀, 저장 compactWorld·복원 restoreWorld, 스냅샷 snapFrame, 이동 프레임 moveFrame, 봇 배회 planWander·nextWanderAt (서버·클라이언트 공용 순수 모듈)"
  - "shared/protocol.ts — MOVE_COORD_LIMIT(700), MoveMessage, WorldSeg, WorldFrame(move|snap), ServerMessage 에 WorldFrame 멤버"
  - "shared/schemas.ts — MoveMessageSchema(strictObject, 정수 ±700)"
  - "test/unit/world.test.ts 90개 + schemas.test.ts 이동 입력 묶음"
affects: [06-08 방 DO(requestMove·restoreWorld·compactWorld·snapFrame·planWander 호출, ClientMessage 에 MoveMessage 추가), 06-09 클라이언트 스토어(WorldFrame 수신·positionAt), 06-13 월드 런타임, 7~9페이즈 채널별 전송]

plan_head_before: 384f29cbd9493876fd0cebb1f82e6f181bfb2a62
plan_head_after: b3ea3d7c28d95b10444b4f4c0449491accd0e95d

actuals:
  tokens: 11600
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "시각은 인자 now, 난수는 인자 randInt 로만 받는 순수 규칙 모듈(bots.ts 선례). 모든 갱신은 새 객체, 입력은 deepFreeze 해도 던지지 않는다"
    - "unknown 저장값은 zod 없이 손으로 형태 검사한다(shared/game 은 클라이언트 번들에도 들어간다). 통과한 구간도 p·t0·v 만 새로 만들어 덧붙은 키를 버린다"
    - "와이어 좌표는 1/100 정수, 거리는 Math.sqrt·사칙연산만 — 서버와 폰이 같은 위치를 얻는다. -0 은 + 0 으로 없앤다"
    - "RED 뼈대: 같은 커밋의 wrong-value 스텁이 단언에서 실패하게 해 tdd-red-evidence 가 RED_EVIDENCE_OK 를 주게 한다"

key-files:
  created:
    - shared/game/world.ts
    - test/unit/world.test.ts
  modified:
    - shared/protocol.ts
    - shared/schemas.ts
    - test/unit/schemas.test.ts

key-decisions:
  - "구간 v 는 고정소수점 거리/초(180 = 1.8 단위/초)이고 진행 거리 = v × (t − t0) / 1000 이다. segmentEndsAt 은 t0 + 총길이 × 1000 / v 를 ms 로 올린다"
  - "requestMove 는 도달 불가·제자리·길이 0 경로를 모두 한 점 구간(restSegment)으로 접는다. 거절(UNKNOWN_PLAYER·TOO_SOON)은 상태도 간격 시계도 바꾸지 않는다"
  - "restoreWorld 의 유효성은 모든 선분(한 점이면 그 점)이 lineWalkable 인지로 본다. 끝점 셀만 보는 것보다 엄격하고 routeFx·snapToWalkable 이 만든 값과 같은 기준이다. v 상한은 1000, 정수 ±700 밖 좌표는 손상"
  - "planWander 의 난수 순서 계약: seat 오름차순 봇마다 때가 된 봇은 [셀 randInt(셀 수), 간격 randInt(3000)], 처음 보는 봇은 [간격]뿐, 때가 안 된 봇은 난수를 쓰지 않는다. 걸을 수 있는 셀이 없으면 randInt(0) 없이 간격만 정한다"
  - "MoveMessageSchema 는 ClientMessageSchema 에 넣지 않았다 — ClientMessage 유니온과 worker never 가드 처리는 계획대로 06-08 이 함께 한다"

patterns-established:
  - "world 프레임 키 집합 고정: move {t,k,s,p,t0,v}, snap {t,k,at,ents[{s,p,t0,v}]} — 테스트가 키 집합과 JSON 에 playerId 가 없음을 고정한다"
  - "저장 모양 {v:1, segs} 에는 lastMoveAt·wanderAt 이 없고, 끝난 구간은 한 점으로 접힌다(snapFrame 과 같은 foldSegment)"

requirements-completed: [MAP-02, MAP-05]

coverage:
  - id: D1
    description: "구간 보간 positionAt/positionAtFx/segmentEndsAt — 출발 전·끝 이후·꺾인 구간·한 점·길이 0 선분·v ≤ 0 모두 같은 입력이면 서버와 폰에서 같은 위치"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/unit/world.test.ts#positionAt — 누적 길이 선형 보간 (MAP-02)"
        status: pass
      - kind: unit
        ref: "test/unit/world.test.ts#segmentEndsAt"
        status: pass
    human_judgment: false
  - id: D2
    description: "requestMove — 150ms 간격(149 거절/150 통과), 걷는 중 재요청은 지금 위치에서 새 경로, 막힌·맵 밖 목적지는 보정점이 끝점, 클라이언트 값은 목적지뿐"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/unit/world.test.ts#requestMove — 목적지 하나가 지금 위치에서 서버 구간이 된다 (MAP-02, T-06-10)"
        status: pass
    human_judgment: false
  - id: D3
    description: "MoveMessageSchema — 정수 ±700 두 좌표만 받고 소수·범위 밖·덧붙은 키·빠진 키·비수치를 거부"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/unit/schemas.test.ts#MoveMessageSchema (strictObject, 정수 ±700)"
        status: pass
    human_judgment: false
  - id: D4
    description: "world 프레임(moveFrame·snapFrame)에 playerId·토큰·역할 자리가 없다 (키 집합과 JSON 내용으로 고정)"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/unit/world.test.ts#moveFrame — 누설 표면 0 (T-06-09 와 짝)"
        status: pass
      - kind: unit
        ref: "test/unit/world.test.ts#snapFrame — 접속 때 모두의 지금 구간 (MAP-01)"
        status: pass
    human_judgment: false
  - id: D5
    description: "compactWorld/restoreWorld — 끝난 구간 접기, 8명 저장 JSON < 4096, 왕복 후 같은 위치, 손상값(모르는 모양·방에 없는 사람·막힌 점·범위 밖·v ≤ 0)은 그 사람만 입장 지점"
    requirement: MAP-05
    verification:
      - kind: unit
        ref: "test/unit/world.test.ts#compactWorld — 저장 모양 (MAP-05, RESEARCH R6)"
        status: pass
      - kind: unit
        ref: "test/unit/world.test.ts#restoreWorld — 하이버네이션·배포 뒤 복원 (MAP-05, T-06-11)"
        status: pass
    human_judgment: false
  - id: D6
    description: "planWander/nextWanderAt — 시드 고정 난수로 결정적, 봇마다 3~6초 간격, 걸을 수 있는 셀 중심 목적지, 사람과 같은 requestMove 를 거치도록 이동을 직접 적용하지 않음"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/unit/world.test.ts#planWander"
        status: pass
      - kind: unit
        ref: "test/unit/world.test.ts#nextWanderAt"
        status: pass
    human_judgment: false
  - id: D7
    description: "실제 폰에서 같은 구간이 같은 경로·속도로 보이고 재접속 뒤 이어지는 체감(DO 연결·렌더링은 06-08·06-13 이후)"
    verification: []
    human_judgment: true
    rationale: "이 계획은 순수 규칙·와이어 계약만 확정한다. 화면에서의 체감 동기화는 DO 와 런타임이 붙은 뒤 실기기로만 확인할 수 있다."

duration: 8min
completed: 2026-10-31
status: complete
---

# Phase 6 Plan 05: 월드 이동 규칙·와이어 계약 Summary

**1/100 정수 구간(p·t0·v) 누적 길이 보간 positionAt 을 서버·폰이 공유하고, 150ms 간격 requestMove·손상 저장값 복원 restoreWorld·누설 없는 world 프레임·결정적 봇 배회 planWander 를 TDD 로 확정했다**

## Performance

- **Duration:** 약 8분
- **Started:** 2026-10-31T15:50Z (대략)
- **Completed:** 2026-10-31T15:58Z
- **Tasks:** 3 (트레이서 1 + auto 2, 모두 tdd)
- **Files modified:** 5 (신규 2, 수정 3)

## Accomplishments

- `shared/game/world.ts` 신규 — 구간 보간, 이동 요청, 입장/퇴장/복귀, 저장/복원, 스냅샷, 봇 배회를 시각·난수 인자 주입의 순수 함수로 확정. 서버와 클라이언트가 같은 `positionAt` 을 import 한다.
- `shared/protocol.ts` 에 `MOVE_COORD_LIMIT`·`MoveMessage`·`WorldSeg`·`WorldFrame` 을 더하고 `ServerMessage` 에 `WorldFrame` 을 붙였다. `ClientMessage` 는 건드리지 않아 worker 의 never 가드가 그대로 컴파일된다(06-08 몫).
- `MoveMessageSchema`(strictObject, 정수 ±700)로 덧붙은 키(seat·v·t0·p)와 소수·범위 밖 좌표를 거부한다.
- 전체 `npx vitest run` 121 파일 3348 통과, `npm run typecheck` 오류 0.

## Task Commits

TDD 라 작업마다 RED → GREEN 두 커밋이다(REFACTOR 는 변경이 없어 없음).

1. **Task 1: 트레이서 — 보간·간격·스키마** — RED `2b2c23e` (test) → GREEN `6855e9c` (feat)
2. **Task 2: 입장·퇴장·복귀와 저장/복원·스냅샷** — RED `77df751` (test) → GREEN `5402314` (feat)
3. **Task 3: 봇 배회 계획** — RED `7833ee4` (test) → GREEN `b3ea3d7` (feat)

**Plan metadata:** 이 SUMMARY 를 담은 docs 커밋 (아래 최종 커밋 참고)

## TDD Gate Compliance

세 작업 모두 `test(06-05)` → `feat(06-05)` 순서로 커밋됐다. RED 증거는 vitest `--reporter=tap-flat` 과 단일 대상 `-t` 로 잡아 `gsd_run check tdd-red-evidence` 가 `RED_EVIDENCE_OK`(`target_test_failed`)를 준 뒤에 GREEN 을 썼다.

| Task | RED 대상 테스트 | 실패 단언 | semanticAssessment |
|------|----------------|-----------|-------------------|
| 1 | `segmentEndsAt > t0 + 길이 / v 초 (ms 올림)` | `expected 1000 to be 2000` | 뼈대가 t0 를 돌려줘 계획한 단언에서 실패. import·구문 오류 아님 |
| 2 | `snapFrame > {t:'world', k:'snap', at, ents} 이고 at 은 now 다` | `expected +0 to be 12345` | 뼈대 snapFrame 이 at 0 을 돌려줘 계획한 단언에서 실패 |
| 3 | `nextWanderAt > 주어진 봇들의 wanderAt 최솟값` | `expected null to be 4000` | 뼈대가 null 을 돌려줘 계획한 단언에서 실패 |

RED 커밋에는 같은 파일의 wrong-value 뼈대(`world.ts`)가 함께 들어 있고 GREEN 에서 모두 구현으로 바뀌었다. 첫 시도에서 여러 테스트를 한꺼번에 돌린 TAP 보고서는 vitest 가 여러 줄 객체 `actual/expected` 를 YAML 로 잘못 내보내 `invalid_record`(Malformed TAP)로 거절됐다. 한 줄 스칼라 단언을 가진 테스트 하나를 `-t` 로 골라 다시 기록했다 — 증거를 고치거나 가장하지 않았다.

## Files Created/Modified

- `shared/game/world.ts` — 구간·보간·이동 요청·저장/복원·스냅샷·봇 배회(순수)
- `shared/protocol.ts` — 이동 메시지·world 프레임 타입, `MOVE_COORD_LIMIT`, `ServerMessage` 에 `WorldFrame`
- `shared/schemas.ts` — `MoveMessageSchema`
- `test/unit/world.test.ts` — 보간·이동 요청·프레임 키·저장/복원 손상 표·스냅샷·배회 90개
- `test/unit/schemas.test.ts` — 이동 입력 수용/거부 묶음

## Decisions Made

key-decisions 참고. 요약: v 는 고정소수점 거리/초, 도달 불가·제자리 경로는 한 점 구간, 복원은 모든 선분의 `lineWalkable` 로 판정, 배회 난수 순서를 계약으로 고정, `ClientMessageSchema` 편입은 06-08 로 남김.

## Deviations from Plan

None - plan executed exactly as written.

(세부 선택 두 가지는 계획이 열어 둔 구현 자유도 안이다: 복원 유효성을 끝점 셀이 아니라 모든 선분의 `lineWalkable` 로 본 것, RED 뼈대를 같은 커밋에 둔 것. 계획의 인수 기준과 truths 를 모두 만족한다.)

## Issues Encountered

- 다중 실패 TAP 보고서가 `Malformed TAP` 으로 거절됨 → 단일 대상 `-t` 실행으로 해결(TDD Gate Compliance 참고).
- 본 계획 전용 이슈 외에 전체 테스트·타입 검사에서 새로 깨진 곳 없음.

## Known Stubs

없음. RED 커밋의 뼈대는 같은 작업의 GREEN 에서 모두 구현으로 바뀌었다.

## Threat Flags

없음. 새 네트워크 엔드포인트·인증 경로·파일 접근·스키마 변경 없음(이동 입력 스키마는 계획의 T-06-09 완화 그대로, `ClientMessageSchema` 에는 아직 연결하지 않았다).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 06-08(방 DO)이 `requestMove`·`restoreWorld`·`compactWorld`·`snapFrame`·`planWander` 를 그대로 호출하고, 그때 `ClientMessage` 유니온과 `ClientMessageSchema` 에 `MoveMessage`/`MoveMessageSchema` 를 더하면서 worker never 가드 처리를 함께 넣는다.
- 06-09·06-13 은 `WorldFrame` 을 받아 같은 `positionAt` 으로 링을 그린다.
- 걷는 중 재요청의 출발점이 반올림 정수라 아주 드물게 셀 경계에서 `snapToWalkable` 이 출발점을 옮길 수 있다(`routeFx` 첫 점이 지금 위치와 1셀 이내로 다를 수 있음). 현재 테스트 맵·입장 지점에서는 관찰되지 않았다.

## Self-Check: PASSED

- `shared/game/world.ts`, `test/unit/world.test.ts` 존재 확인
- 커밋 `2b2c23e` `6855e9c` `77df751` `5402314` `7833ee4` `b3ea3d7` 모두 HEAD 의 조상
- 인수 기준 grep(Task 1·2·3) 모두 통과, `test(06-05)` 커밋 존재
- 계획 검증: `npx vitest run test/unit/world.test.ts test/unit/schemas.test.ts` 123 통과, `npm run typecheck` 오류 0, 전체 `npx vitest run` 3348 통과

---
*Phase: 06-world-skeleton*
*Completed: 2026-10-31*
