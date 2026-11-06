---
phase: 06-world-skeleton
plan: "09"
subsystem: net
tags: [websocket, world-frame, epoch, client-store, reconnect, tdd, vitest]

requires:
  - phase: 06-world-skeleton/06-05
    provides: "shared/protocol.ts WorldFrame, shared/game/world.ts Segment·positionAt"
  - phase: 06-world-skeleton/06-08
    provides: "서버 world.move·snap 전송 ([state, snap] 순서, emitWorld)"
provides:
  - "src/net/useRoomConnection.ts — world 프레임 화이트리스트, RoomEvent 에 world, onEvent 리스너 두 번째 인자 { epoch }, 종료 상태에서 world 프레임 차단"
  - "src/world/store.ts — WorldStore(React 밖): 연결 단위 snap 통째 교체, 낡은/새 epoch move 폐기, 등장·퇴장 seat, 시각별 위치(shared positionAt)"
  - "test/client/useRoomConnection.test.tsx describe 'useRoomConnection: world 프레임 비간섭 (CONN-04)' 4개"
  - ".planning/DEFERRED-BUGS.md WR-01~04 줄 처리"
affects: [06-13 월드 런타임(onEvent((e, meta) => store.applyFrame(e, meta.epoch)) 로 잇는다), 06-18 E2E(재접속·끊김 반복 검증)]

plan_head_before: 66079e8f040c64f10075cb46174fac523b0ab82e
plan_head_after: e32af7265ad273d23fbea94cf1aac5b4cc7f1dcd

actuals:
  tokens: 7500
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "world 프레임은 상태로 쌓지 않고 onEvent 로만 흘린다(emoji·chat 과 같은 갈래). epoch 메타는 linkRef.current.epoch — emit 이 동기로 갱신하므로 state 다음 snap 은 새 epoch 를 받는다"
    - "스토어는 React 밖 클래스 + subscribe. 변화가 있을 때만 알린다(버려진 프레임·변화 없는 retain 은 알리지 않음)"
    - "epoch 규칙: 더 낡은 epoch 프레임 폐기 / 더 새 epoch 의 move 는 snap 전이라 폐기하고 준비 상태를 풀되 이전 구간은 snap 이 올 때까지 그대로 둔다"

key-files:
  created:
    - src/world/store.ts
    - test/unit/worldStore.test.ts
  modified:
    - src/net/useRoomConnection.ts
    - test/client/useRoomConnection.test.tsx
    - .planning/DEFERRED-BUGS.md
    - test/client/candidateVote.test.tsx
    - test/client/dayScene.test.tsx
    - test/client/defense.test.tsx
    - test/client/defenseChips.test.tsx
    - test/client/discussion.test.tsx
    - test/client/execVote.test.tsx
    - test/client/execution.test.tsx
    - test/client/nightScene.test.tsx
    - test/client/seatFloats.test.tsx
    - test/client/turnPanel.test.tsx

key-decisions:
  - "종료 상태(replaced·removed·failed)의 world 프레임은 구독자에게 보내지 않는다. replaced 는 socketRef 가 그대로라 기존 가드만으로는 막히지 않아 world 분기에만 isTerminal 검사를 더했다 (state·pong 동작은 그대로)"
  - "WorldStore 는 snap 에서 등장 대기를 비운다 — 첫 snap 이든 대기실 복귀 snap 이든 바로 맞추고 연출하지 않는다"
  - "새 epoch 의 move 가 snap 전에 오면 epoch 를 올리고 ready 를 푼다. 이로써 이후 낡은 epoch 프레임이 폐기되고, 그 연결의 snap 이 기준이 된다"
  - "A1(seat 재사용 구별)은 06-13 런타임 몫이다. store 는 seat 단위이고 retainSeats 가 view 와 맞춘다"

requirements-completed: [MAP-05, CONN-04]

coverage:
  - id: D1
    description: "useRoomConnection 이 world 프레임을 화이트리스트에 넣고 구독자에게 { epoch } 메타와 함께 흘리며, 알 수 없는 t 는 여전히 버린다"
    requirement: "CONN-04"
    verification:
      - kind: unit
        ref: "test/client/useRoomConnection.test.tsx#world 프레임은 구독자에게 { epoch } 메타와 함께 가고, 재연결하면 epoch 가 바뀐다"
        status: pass
      - kind: unit
        ref: "test/client/useRoomConnection.test.tsx#알 수 없는 t 는 world 가 화이트리스트에 들어와도 여전히 구독자에게 가지 않는다"
        status: pass
    human_judgment: false
  - id: D2
    description: "world 프레임 수신이 링크 상태·배너·epoch·offset·view·canSend 를 바꾸지 않고, 종료 상태에서 구독자·새 소켓을 만들지 않는다"
    requirement: "CONN-04"
    verification:
      - kind: unit
        ref: "test/client/useRoomConnection.test.tsx#world 프레임은 링크 상태·배너·epoch·offset·view 를 바꾸지 않는다"
        status: pass
      - kind: unit
        ref: "test/client/useRoomConnection.test.tsx#종료 상태(replaced)가 된 뒤 같은 소켓으로 world 프레임이 와도 새 소켓을 열지 않고 구독자도 부르지 않는다 (WR-02 회귀)"
        status: pass
    human_judgment: false
  - id: D3
    description: "WorldStore 가 연결 단위로 위치를 교체하고(snap 통째 교체, snap 전 move·낡은 epoch 폐기), 등장·퇴장 seat 와 시각별 위치를 준다"
    requirement: "MAP-05"
    verification:
      - kind: unit
        ref: "test/unit/worldStore.test.ts (15개)"
        status: pass
    human_judgment: false
  - id: D4
    description: "WR-01~04 보류 줄이 수정 커밋과 통과한 회귀 테스트를 근거로 정리됨"
    requirement: "CONN-04"
    verification:
      - kind: unit
        ref: "npx vitest run test/unit/linkReducer.test.ts test/client/useRoomConnection.test.tsx test/client/lobby.test.tsx"
        status: pass
    human_judgment: false
  - id: D5
    description: "끊김·복귀·화면 껐다 켜기·새로 고침·배포 직후 각 10회 반복 시 콘솔 경고 0 (화면 쪽 실제 확인)"
    requirement: "CONN-04"
    verification: []
    human_judgment: true
    rationale: "실제 폰·배포본에서의 반복 확인은 06-18 E2E 와 06-07 폰 확인의 몫이다. 이 계획은 단위 회귀 테스트까지만 증명한다"

duration: 10min
completed: 2026-11-01
status: complete
---

# Phase 6 Plan 09: 클라이언트 world 스토어와 연결 비간섭 Summary

**useRoomConnection 이 world 프레임을 epoch 메타와 함께 구독자에게만 흘리고(링크 상태 불변, 종료 상태 차단), React 밖 WorldStore 가 연결 단위로 snap 을 통째 교체하며 시각별 위치·등장·퇴장 seat 를 제공한다**

## Performance

- **Duration:** 약 10분
- **Completed:** 2026-10-31T16:35Z
- **Tasks:** 2 (tracer 1 + auto 1, 모두 TDD)
- **Files modified:** 15 (신규 2: store.ts, worldStore.test.ts)

## Accomplishments

- `useRoomConnection`: 화이트리스트와 `RoomEvent` 에 `world` 추가, `onEvent` 리스너가 `(e, { epoch })` 를 받는다. world 는 `setView`·`emit` 을 부르지 않는다.
- `WorldStore`: `applyFrame(frame, epoch)`, `reset`, `isReady`, `seats`, `segOf`, `positionOf`(shared `positionAt`), `takeEntered`, `retainSeats`, `subscribe`.
- 회귀 테스트: describe `useRoomConnection: world 프레임 비간섭 (CONN-04)` 4개 + `worldStore.test.ts` 15개.
- `DEFERRED-BUGS.md` 의 WR-01~04 열림 줄을 지우고 처리됨 한 줄(해시 4개와 회귀 테스트 위치)을 남겼다. `| 열림 |` 줄 수 1 → 0.

### CONN-04 근거 (실행 결과 그대로)

`npx vitest run test/client/useRoomConnection.test.tsx -t "world 프레임 비간섭"`:

```
Tests  4 passed | 33 skipped (37)
```

`npx vitest run test/unit/linkReducer.test.ts test/client/useRoomConnection.test.tsx test/client/lobby.test.tsx`: `Test Files 3 passed (3)`, `Tests 115 passed (115)`.
`npx vitest run test/unit/worldStore.test.ts test/unit/linkReducer.test.ts test/client/useRoomConnection.test.tsx test/client/lobby.test.tsx`: `Tests 130 passed (130)`. 전체 `npx vitest run`: `Test Files 126 passed`, `Tests 3421 passed | 1 skipped`. `npm run typecheck` 통과.

## Task Commits

1. **Task 1 (tracer, TDD): world 프레임 → epoch 메타 → WorldStore → positionOf**
   - RED `4e8efef` (test) — 세 대상 중 디스패치 테스트와 store snap 테스트가 단언에서 실패. `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (대상: 디스패치 테스트, store snap 테스트). 모르는 t·상태 불변 두 테스트는 현재 동작을 고정하는 회귀 가드라 RED 에서도 통과한다.
   - GREEN `0a46344` (feat)
   - 트레이서 게이트: `<verify>` 가 자동 검사뿐이라 재실행해 통과(`39 passed`) 확인 후 `⚡ Tracer verified end-to-end — expanding`.
2. **Task 2 (TDD): 연결 단위 교체·등장/퇴장·종료 상태, WR 줄 정리**
   - RED `23493cd` (test) — store 12개 중 6개가 단언에서 실패. `check tdd-red-evidence` → `RED_EVIDENCE_OK` (대상: "reset 뒤에는 준비되지 않고…", "새 epoch 의 move 가 snap 보다 먼저 오면…").
   - GREEN `9dbbd6e` (feat)
   - 문서 `e32af72` (docs) — DEFERRED-BUGS 정리

**Plan metadata:** 이 SUMMARY 와 STATE·ROADMAP·REQUIREMENTS 를 담은 `docs(06-09)` 커밋.

## TDD Gate Compliance

두 작업 모두 `test(06-09)` → `feat(06-09)` 순서다. REFACTOR 커밋은 없다(변경할 만한 정리 없음).

- RED 평가(semanticAssessment): 대상 테스트가 실제로 실행돼 계획한 단언(`called 1 times`/`expected true to be false`)에서 실패했다. 구문·로드 오류 아님.
- 예외: RED 커밋마다 `src/world/store.ts` 에 동작 없는 뼈대를 함께 넣었다. 모듈이 없으면 import 실패(`fixture_or_load_failure`)로 RED 가 무효가 되기 때문이다.
- Task 2 의 "종료 상태(replaced)" 테스트는 RED 에서 통과했다. 종료 상태 차단 분기를 Task 1 GREEN 에서 world 분기와 함께 넣었기 때문이다. 테스트가 실제로 막는지 확인하려고 그 한 줄을 임시로 지우고 돌려 `1 failed` 를 확인한 뒤 되돌렸다(변이 확인).

## Files Created/Modified

- `src/world/store.ts` — WorldStore 클래스와 epoch 규칙 주석
- `src/net/useRoomConnection.ts` — world 화이트리스트·epoch 메타·종료 상태 차단
- `test/unit/worldStore.test.ts` — 15개
- `test/client/useRoomConnection.test.tsx` — 비간섭 describe 4개, 기존 emoji·chat·error 단언에 `{ epoch: 1 }` 반영
- `test/client/*.test.tsx` 10개 — `onEvent` 를 흉내 내는 도우미의 리스너 타입·호출에 meta 인자 반영
- `.planning/DEFERRED-BUGS.md` — WR-01~04 처리

## Decisions Made

key-decisions 참고. 핵심은 (1) world 프레임을 종료 상태에서 차단, (2) snap 은 등장 연출 없이 통째 교체, (3) 새 epoch move 는 snap 전까지 폐기하되 이전 구간은 snap 이 올 때까지 남긴다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] onEvent 리스너 타입 변경이 기존 테스트 도우미 10개의 타입 검사를 깼다**
- **Found during:** Task 1 (GREEN, `npm run typecheck`)
- **Issue:** `onEvent` 리스너가 `(e, meta)` 가 되자 `(l: (e: RoomEvent) => void) => …` 로 쓴 가짜 `onEvent` 들이 `RoomConnection` 에 할당되지 않았다(콜백 인자 검사는 메서드 문법이어도 엄격). 계획은 "기존 구독자는 두 번째 인자를 무시한다" 만 언급했고 테스트 도우미는 다루지 않았다.
- **Fix:** 도우미의 리스너 타입을 `(e: RoomEvent, meta: { epoch: number }) => void` 로, 호출을 `l(e, { epoch: 1 })` 로 바꿨다. `execution.test.tsx` 의 캐스트는 `as unknown as RoomConnection["onEvent"]`. 대안(프로덕션 타입의 meta 를 선택 인자로)은 06-13 의 `meta.epoch` 사용을 약하게 만들어 택하지 않았다.
- **Files modified:** test/client/{candidateVote,dayScene,defense,defenseChips,discussion,execVote,execution,nightScene,seatFloats,turnPanel}.test.tsx
- **Verification:** `npm run typecheck` 통과, `npx vitest run test/client` 53 파일 1565개 통과
- **Committed in:** 0a46344

**2. [Rule 1 - 기존 테스트 단언] 기존 emoji·chat·error 구독 테스트의 `toHaveBeenCalledWith` 가 새 두 번째 인자 때문에 실패**
- **Found during:** Task 1 (GREEN)
- **Fix:** 세 단언을 `(frame, { epoch: 1 })` 로 갱신(계획이 모든 구독자에게 meta 를 준다고 정했다)
- **Files modified:** test/client/useRoomConnection.test.tsx
- **Committed in:** 0a46344

**3. [Rule 2 - 계획 보완] 종료 상태 차단은 기존 socketRef 가드만으로는 안 된다**
- **Found during:** Task 1 (설계)
- **Issue:** 계획은 "socketRef 가드" 로 종료 상태 프레임이 구독자에게 가지 않는다고 했지만, replaced 는 `socketRef` 를 비우지 않아(비우는 것은 failed·removed 뿐) 늦은 world 프레임이 구독자에게 갈 수 있었다.
- **Fix:** world 분기에 `isTerminal(linkRef.current.status)` 검사를 더했다. state·pong 동작은 그대로.
- **Files modified:** src/net/useRoomConnection.ts
- **Verification:** 가드를 임시로 지우면 종료 상태 테스트가 실패함을 확인
- **Committed in:** 0a46344

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug/test, 1 missing critical)
**Impact on plan:** 모두 계획의 의도(비간섭, 종료 상태 차단)를 지키기 위한 것. 범위 확장 없음.

## Issues Encountered

- `check tdd-red-evidence` 는 vitest `tap-flat` 보고서와 `파일 > describe > test` 형식의 정확한 이름, 한 줄 실패 메시지를 요구한다(배열 `toEqual` 의 여러 줄 diff 는 `invalid_record`). 한 줄 단언(`toBe`, `toHaveBeenCalledTimes`)을 대상으로 삼아 해결했다. 증거 파일은 프로젝트 안(.planning)에만 쓸 수 있어 임시로 쓰고 지웠다.

## Known Stubs

없음. (`src/world/store.ts` 의 RED 뼈대는 GREEN 커밋에서 모두 실제 구현으로 바뀌었다.)

## Threat Flags

없음. 새 네트워크 표면·인증 경로·스키마 변경 없음. T-06-21(낡은 연결 프레임 섞임)은 epoch 메타·snap 통째 교체·낡은/새 epoch move 폐기·종료 상태 차단으로, T-06-22(모르는 프레임)는 화이트리스트에 world 만 더하고 모르는 t 버림 테스트를 유지해 완화했다.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 06-13 런타임은 `connection.onEvent((e, meta) => { if (e.t === "world") store.applyFrame(e, meta.epoch); })` 로 잇고, view 가 바뀔 때 `store.retainSeats(view.players.map(p => p.seat))` 로 퇴장 연출을 얻으면 된다. 연결 종료·방 이동 시 `store.reset()`.
- 남은 확인: 화면 쪽 반복 검증(끊김·복귀·화면 껐다 켜기·새로 고침·배포 직후 각 10회, 콘솔 경고 0)은 06-18 E2E 의 몫(coverage D5).
- 06-07 은 폰 확인 체크포인트에서 멈춰 있고 이 계획과 무관하다(건드리지 않음).

## Self-Check: PASSED

- 파일: `src/world/store.ts`, `test/unit/worldStore.test.ts` 존재 확인.
- 커밋: 4e8efef, 0a46344, 23493cd, 9dbbd6e, e32af72 모두 HEAD 의 조상.
- 인수 기준: Task 1·2 의 grep 기준과 `-t "world 프레임 비간섭"` 4 passed, `| 열림 |` 0, `test(06-09)` 커밋 존재 모두 통과.

---
*Phase: 06-world-skeleton*
*Completed: 2026-11-01*
