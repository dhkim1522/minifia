---
phase: 01-walking-skeleton
plan: 04
subsystem: game-core
tags: [typescript, vitest, pure-functions, lobby, preview, tdd]

requires:
  - phase: 01-walking-skeleton
    provides: "01-02 방 상태 코어(createRoomState·attach/detach·buildView), 01-03 닉네임 규칙(validateNickname)·역할 타입(RoleId)"
provides:
  - "대기실 전이 순수 함수: joinRoom, leaveRoom, kickPlayer, hostOf"
  - "시작 조건: connectedCount(서버·클라이언트 공용), checkStart"
  - "비인증 미리보기 허용 목록 빌더 buildPreview"
  - "와이어 계약 확장: PreviewPlayer, RoomPreview.players, MyInfo.role?·allies?, RoleId 재수출"
affects: [01-06, 01-07, 01-09, 01-10, 01-14]

actuals:
  tokens: 7400
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "순수 전이 함수는 { ok, state } | { ok: false, error } 판별 합집합으로 돌려주고 입력을 바꾸지 않는다"
    - "공개 모양은 객체 리터럴 허용 목록으로만 만든다(Player 를 펼쳐 복사하지 않는다)"
    - "거절 검사 순서가 계약이다 — 순서 자체를 테스트로 고정한다"

key-files:
  created:
    - test/unit/preview.test.ts
  modified:
    - shared/protocol.ts
    - shared/game/room.ts
    - shared/game/view.ts
    - test/unit/gameRoom.test.ts

key-decisions:
  - "방장 승계(D-17 구체화, 결정 0012): 방장이 [나가기] 하면 남은 사람 중 연결된 사람의 joinSeq 최소가 이어받고, 연결된 사람이 없으면 전체 joinSeq 최소가 이어받는다. 끊긴 사람이 방장이 되면 자동 이양이 없어(v2 CONNX-01) 아무도 시작할 수 없는 방이 될 수 있기 때문이다. 방장이 끊긴 것만으로는 승계하지 않는다. 01-14 가 HANDOFF 에 옮긴다."
  - "자리 재사용은 비어 있는 가장 낮은 번호, joinSeq 는 방이 끝날 때까지 계속 늘어난다(D-09)"
  - "정원(ROOM_FULL)은 끊긴 사람을 포함한 자리 수이고, 시작 인원(checkStart)은 연결된 사람 수다(결정 0012)"
  - "미리보기 players 는 대기실에서만 채운다(리서치 Open Question 5). 닉네임 노출의 4자리 코드 열거 위험은 친구 게임 MVP 에서 수용하고 속도 제한은 LAUNCH 로 미룬다(T-01-15)"
  - "NOT_IN_ROOM 은 leaveRoom 내부 전용 코드다. 01-09 의 방 DO 가 BAD_MESSAGE 로 바꾼다"

patterns-established:
  - "테스트의 거절 단언은 outcome(r) 도우미로 한 단어(ok 또는 오류 코드)로 비교한다 — 실패 보고서가 한 줄로 남아 TAP 증거로 쓸 수 있다"
  - "누출 검사는 미래 필드(role)를 붙인 상태를 as unknown as RoomState 로 만들어 새 필드가 생겨도 새지 않는지 본다"

requirements-completed: [ROOM-02, ROOM-03, ROLE-02]

coverage:
  - id: D1
    description: "createRoomState 와 joinRoom 이 같은 validateNickname 으로 닉네임을 검사·정규화하고 nicknameKey 를 그 key 로 저장한다 (grapheme 길이, NFKC 전각 key)"
    requirement: "ROOM-02"
    verification:
      - kind: unit
        ref: "test/unit/gameRoom.test.ts#createRoomState 닉네임은 shared/nickname.ts 규칙으로 정규화되고 nicknameKey 는 그 결과 key 다"
        status: pass
    human_judgment: false
  - id: D2
    description: "joinRoom 이 GAME_STARTED → ROOM_FULL(끊긴 사람 포함 8자리) → NICKNAME_INVALID → NICKNAME_TAKEN 순서로 거절하고, 성공하면 비어 있는 가장 낮은 자리에 connected false 로 앉는다"
    requirement: "ROOM-02"
    verification:
      - kind: unit
        ref: "test/unit/gameRoom.test.ts#joinRoom (거절 순서)"
        status: pass
      - kind: unit
        ref: "test/unit/gameRoom.test.ts#joinRoom (성공 경로)"
        status: pass
    human_judgment: false
  - id: D3
    description: "leaveRoom 방장 승계(연결된 사람 우선 joinSeq 최소, 전원 끊김이면 전체 joinSeq 최소)·마지막 사람 null·WRONG_PHASE, kickPlayer NOT_HOST·CANNOT_KICK 규칙"
    requirement: "ROOM-03"
    verification:
      - kind: unit
        ref: "test/unit/gameRoom.test.ts#leaveRoom"
        status: pass
      - kind: unit
        ref: "test/unit/gameRoom.test.ts#kickPlayer"
        status: pass
    human_judgment: false
  - id: D4
    description: "connectedCount 와 checkStart: 연결 4+끊김 2 시작 가능, 연결 3+끊김 5 NOT_ENOUGH_PLAYERS, NOT_HOST → WRONG_PHASE → NOT_ENOUGH_PLAYERS 순서"
    requirement: "ROOM-03"
    verification:
      - kind: unit
        ref: "test/unit/gameRoom.test.ts#checkStart"
        status: pass
      - kind: unit
        ref: "test/unit/gameRoom.test.ts#connectedCount"
        status: pass
    human_judgment: false
  - id: D5
    description: "buildPreview 가 대기실에서만 자리 순 {seat, nickname} 을 내고, 네 단계 모두에서 토큰·내부 id·역할·connected 문자열이 직렬화에 없다"
    requirement: "ROLE-02"
    verification:
      - kind: unit
        ref: "test/unit/preview.test.ts#buildPreview 누출 검사"
        status: pass
      - kind: unit
        ref: "test/unit/preview.test.ts#buildPreview (대기실)"
        status: pass
    human_judgment: false
  - id: D6
    description: "shared/protocol.ts 와이어 계약 확장(PreviewPlayer, RoomPreview.players, MyInfo.role?·allies?, RoleId 타입 재수출, 값 import 없음)"
    verification:
      - kind: other
        ref: "npm run typecheck (exit 0), grep 'players: PreviewPlayer\\[\\]' shared/protocol.ts"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-10-23
status: complete
plan_head_before: f05be82611f7742219100f8b5d2b834543481d74
plan_head_after: 498ecdaa366ff18b1865d4097b5fbd555c322827
commits: 6
---

# Phase 1 Plan 04: 대기실 규칙과 비인증 미리보기 Summary

**대기실의 참가·나가기·내보내기·방장 승계와 연결된 4명 기준 시작 조건을 서버 순수 함수로 확정하고, 앉은 사람 닉네임만 보여 주는 비인증 미리보기 빌더를 네 단계 누출 검사로 고정했다**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-23T04:47:00Z (대략)
- **Completed:** 2026-10-23T04:56:00Z
- **Tasks:** 3 (트레이서 1 + auto 2, 모두 TDD)
- **Files modified:** 5 (신규 1: `test/unit/preview.test.ts`)

## Accomplishments

- `joinRoom` 이 시작됨 → 정원(끊긴 사람 포함 8자리) → 닉네임 형식 → 닉네임 중복 순으로 거절하고, 성공하면 비어 있는 가장 낮은 자리에 앉힌다. `createRoomState` 와 같은 `validateNickname` 을 쓰고 임시 `normalizeNickname` 은 지웠다.
- `leaveRoom` 이 대기실에서만 통하고 방장 승계를 "연결된 사람 우선, 없으면 전체, joinSeq 최소"로 정한다. `kickPlayer` 는 방장만 대기실에서 끊긴 다른 사람에게만 통한다.
- `connectedCount`(서버·클라이언트 공용)와 `checkStart` 가 연결된 사람 4명 이상일 때만 시작을 허락한다. 연결 4+끊김 2 는 가능, 연결 3+끊김 5 는 거절이다.
- `buildPreview` 가 대기실에서만 `{seat, nickname}` 두 키로 앉은 사람을 내고, lobby·assigning·roleReveal·day 네 단계에서 토큰·내부 id·역할·connected 문자열 부재를 테스트로 확인한다.
- 이후 계획이 기댈 와이어 타입(`PreviewPlayer`, `RoomPreview.players`, `MyInfo.role?`·`allies?`, `RoleId` 재수출)을 먼저 고정했다.

## Task Commits

1. **Task 1: 트레이서 — 링크로 들어온 사람이 미리보기와 뷰에 나타난다**
   - RED `0abee61` (test) → GREEN `6a7ed2d` (feat)
2. **Task 2: 참가 거절 순서·나가기·내보내기·방장 승계**
   - RED `284a65c` (test) → GREEN `4728474` (feat)
3. **Task 3: 연결된 사람 수와 시작 조건, 미리보기 누출 검사**
   - RED `51299b8` (test) → GREEN `498ecda` (feat)

REFACTOR 커밋은 없다(정리할 중복이 없었다). **Plan metadata:** 이 SUMMARY 를 담은 docs 커밋.

## Files Created/Modified

- `shared/protocol.ts` - `PreviewPlayer`, `RoomPreview.players`, `MyInfo.role?`·`allies?`, `RoleId` 타입 재수출 (값 import 없음)
- `shared/game/room.ts` - `joinRoom`, `leaveRoom`, `kickPlayer`, `connectedCount`, `checkStart`, `hostOf`, `JoinError`/`LeaveError`/`KickError`/`StartError`; 임시 `normalizeNickname` 삭제
- `shared/game/view.ts` - `buildPreview` (객체 리터럴 허용 목록)
- `test/unit/gameRoom.test.ts` - 참가·거절 순서·나가기·방장 승계·내보내기·시작 조건 단위 테스트 (손으로 만든 상태 도우미 `room`/`fullRoom`/`outcome`)
- `test/unit/preview.test.ts` - 미리보기 모양과 네 단계 누출 검사

## TDD Gate Compliance

| Task | RED 커밋 | GREEN 커밋 | REFACTOR |
|------|----------|------------|----------|
| 1 | `0abee61` | `6a7ed2d` | 없음 |
| 2 | `284a65c` | `4728474` | 없음 |
| 3 | `51299b8` | `498ecda` | 없음 |

모든 RED 가 GREEN 보다 먼저다. 각 RED 는 `gsd_run check tdd-red-evidence` 에서 `RED_EVIDENCE_OK` 를 받았다(TAP 보고서, `--reporter=tap-flat`).

- **Task 1 RED:** 대상 `createRoomState > 닉네임은 shared/nickname.ts 규칙으로 정규화되고 nicknameKey 는 그 결과 key 다`. 기대 `minsu`, 실제 `ｍｉｎｓｕ`. `semanticAssessment`: 대상 테스트가 실행되어 전각 닉네임의 NFKC key 단언에서 실패했다. 임시 `normalizeNickname` 이 `toLowerCase` 만 쓰기 때문이며 의도한 이유다. 같은 실행의 `joinRoom`/`buildPreview` 테스트는 없는 함수라 TypeError 로 실패했다.
- **Task 2 RED:** 대상 `joinRoom (거절 순서) > 자리 8개가 찬 방 ... ROOM_FULL`. 기대 `ROOM_FULL`, 실제 `ok`. `semanticAssessment`: 정원 검사가 아직 없어 9번째가 앉았다. 의도한 이유다. `leaveRoom`/`kickPlayer` 테스트는 없는 함수라 TypeError 로 실패했다.
- **Task 3 RED:** 대상 `checkStart > 연결 3 + 끊김 5(자리 8)는 NOT_ENOUGH_PLAYERS`. `semanticAssessment`: `checkStart` 가 아직 export 되지 않아 TypeError 로 실패했다. 새 함수의 RED 로서 의도한 이유다(JS 에는 없는 심볼의 컴파일 오류가 없다). 누출 검사 테스트는 Task 1 의 허용 목록이 이미 지켜 RED 단계에서 이미 통과했다. 이는 누출 방지가 Task 1 설계에서 이미 성립했음을 확인하는 회귀 고정이다.

트레이서 게이트(auto 모드 아님, `end-of-phase`, 검증이 `<automated>` 뿐): Task 1 의 `<verify>` 두 줄을 다시 돌려 통과를 확인한 뒤 확장 Task 로 넘어갔다 (Tracer verified end-to-end — expanding).

## Decisions Made

- 방장 승계 구체화(D-17 → 결정 0012 연결자 기준): **연결된 사람의 joinSeq 최소 → 연결된 사람이 없으면 전체 joinSeq 최소.** 끊긴 사람이 방장이 되면 아무도 시작할 수 없는 방이 될 수 있어서다. 끊긴 방장의 자동 이양은 여전히 넣지 않았다(v2 CONNX-01). **01-14 가 이 항목을 HANDOFF 에 옮긴다.**
- `ROOM_FULL` 은 자리 수(끊긴 사람 포함), `NOT_ENOUGH_PLAYERS` 는 연결된 사람 수 기준이다. 둘이 서로 다른 단위임을 01-09·01-10 이 알아야 한다.
- `NOT_IN_ROOM` 은 내부 전용이다. 01-09 방 DO 가 `BAD_MESSAGE` 로 바꿔 응답한다.
- 미리보기의 닉네임 열거 위험(4자리 코드를 아는 누구나 앉은 사람 닉네임을 본다)은 수용 위험으로 두고 속도 제한은 LAUNCH 로 미룬다(T-01-15).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 워크트리에 의존성이 없어 `npm ci` 로 설치**
- **Found during:** Task 1 시작 전 (기준선 테스트 실행)
- **Issue:** 새 워크트리에 `node_modules` 가 없어 vitest 를 돌릴 수 없었다.
- **Fix:** 잠금 파일 그대로 `npm ci` 를 실행했다. 새 패키지를 추가하거나 이름을 바꿔 설치하지 않았다(T-01-SC 유지). `package.json`·`package-lock.json` 변경 없음.
- **Files modified:** 없음 (`node_modules` 는 추적 대상 아님)
- **Verification:** 기준선 unit 92개·`test/worker/http.test.ts` 13개 통과를 확인한 뒤 시작.

**2. [Rule 1 - Bug] 거절 단언을 `outcome()` 한 단어 비교로 바꿈 (RED 증거 형식)**
- **Found during:** Task 2 RED
- **Issue:** 처음에는 `expect(join(...)).toEqual({ ok: false, error })` 로 썼다. 실패할 때 vitest TAP 보고서에 여러 줄 객체 덤프가 들어가 `check tdd-red-evidence` 가 `invalid_record`(Malformed TAP)로 거절했다.
- **Fix:** `outcome(r)` 도우미(성공이면 "ok", 거절이면 오류 코드)를 두고 `expect(outcome(...)).toBe("ROOM_FULL")` 로 바꿨다. 테스트 의미는 같고 실패 보고서가 한 줄이 된다. RED 커밋 전에 고쳐 커밋에는 최종 형태만 있다.
- **Files modified:** `test/unit/gameRoom.test.ts`
- **Verification:** 다시 돌려 `RED_EVIDENCE_OK`.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug in test form)
**Impact on plan:** 범위 확대 없음. 둘 다 실행 환경·증거 형식 문제였고 프로덕션 코드에는 영향이 없다.

## Issues Encountered

- 워크트리 샌드박스가 `git`을 포함한 복합 셸 명령과 heredoc 을 거부해 명령을 단일 호출로 나누고 파일은 Write/Edit 로 만들었다. 작업 내용에는 영향이 없다.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. 이 계획의 모든 함수는 실제 로직이다. `MyInfo.role?`·`allies?` 는 타입만 고정했고 값을 채우는 일은 계획대로 01-07 몫이다(스텁이 아니라 후속 계획이 채울 선택 필드).

## Threat Flags

None - 새 네트워크 엔드포인트·인증 경로·파일 접근·스키마가 없다. 계획의 T-01-13~T-01-16 완화는 모두 테스트로 고정했다.

| Threat | 완화 | 근거 테스트 |
|--------|------|-------------|
| T-01-13 | 판정 입력은 actorId 와 서버 상태뿐 | `checkStart` NOT_HOST, `kickPlayer` NOT_HOST |
| T-01-14 | 연결 수를 서버 상태로 다시 계산 | 연결 3+끊김 5 거절 |
| T-01-15 | 객체 리터럴 허용 목록, 대기실에서만 채움 | 네 단계 누출 검사 |
| T-01-16 | MAX_PLAYERS 로 9번째 거부 | ROOM_FULL 테스트 |

## Next Phase Readiness

- 01-07 은 `checkStart` 위에 시작·배정을 얹고 `MyInfo.role`·`allies` 를 채운다.
- 01-09 는 `joinRoom`/`leaveRoom`/`kickPlayer`/`checkStart` 의 오류 문자열을 그대로 응답에 쓰고 `NOT_IN_ROOM` 만 `BAD_MESSAGE` 로 바꾼다. `worker/room.ts` 는 이 계획에서 건드리지 않았다(`createRoomState` 시그니처 불변, `test/worker/http.test.ts` 13개 회귀 통과).
- 01-06·01-10 은 `RoomPreview.players` 와 `connectedCount` 를 화면에 쓴다.
- 막는 것은 없다.

## Self-Check: PASSED

- 파일: `shared/protocol.ts`, `shared/game/room.ts`, `shared/game/view.ts`, `test/unit/gameRoom.test.ts`, `test/unit/preview.test.ts` 모두 존재
- 커밋: `0abee61`, `6a7ed2d`, `284a65c`, `4728474`, `51299b8`, `498ecda` 모두 HEAD 의 조상
- 검증: `npx vitest run test/unit/gameRoom.test.ts test/unit/preview.test.ts` 통과(46), `npm run typecheck && npx vitest run --project unit` 통과(129), `npx vitest run test/worker/http.test.ts` 통과(13)
- 인수 기준 grep 전부 통과, RED(test) 커밋이 각 GREEN(feat) 커밋보다 먼저

---
*Phase: 01-walking-skeleton*
*Completed: 2026-10-23*
