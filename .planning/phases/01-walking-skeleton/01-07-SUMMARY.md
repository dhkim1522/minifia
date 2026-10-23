---
phase: 01-walking-skeleton
plan: 07
subsystem: game-core
tags: [typescript, vitest, tdd, pure-functions, phase-table, role-assignment, information-hiding]

requires:
  - phase: 01-walking-skeleton
    provides: "01-04 의 RoomState·checkStart·connectedCount·buildView 허용 목록, roles.ts 의 assignRoles·ROLE_TABLE, seededRandInt"
provides:
  - "PHASE_DEFS 단계 표(lobby → assigning 3000ms → roleReveal 15000ms → day), ASSIGNING_MS, ROLE_REVEAL_MS"
  - "tick(state, now) 연쇄 마감 순수 진행, nextWakeAt(state) 알람 시각"
  - "startGame(state, actorId, now, randInt) 와 Player.role"
  - "buildView 의 phaseDurationMs·me.role·me.allies 와 플레이어별 전수 누출 검사"
affects: [01-09 방 DO 알람·방송, 01-13 역할 카드·타이머 화면, 01-14 스모크, 이후 페이즈의 PHASE_DEFS 행 추가]

actuals:
  tokens: 6800
  tasks: 3
  commits: 6
plan_head_before: 42bef63ad167ea5de21981febc90a1e5833057bc
plan_head_after: 4ac230b50f75d04282fa29bc3fd222f5dc2083ad

tech-stack:
  added: []
  patterns:
    - "단계 정의는 코드 분기가 아니라 데이터 표(PHASE_DEFS)에 둔다 — 이후 페이즈는 행만 더한다"
    - "순수 함수에 시각·난수를 인자로 주입한다(tick 의 now, startGame 의 randInt)"
    - "tick 은 변화가 없으면 입력과 같은 객체를 돌려줘 호출자가 저장·방송을 건너뛴다"
    - "뷰는 허용 목록으로 만들고 조건이 아니면 role·allies 키 자체를 만들지 않는다"

key-files:
  created:
    - shared/game/phases.ts
    - shared/game/tick.ts
    - test/unit/tick.test.ts
    - test/unit/view.test.ts
  modified:
    - shared/game/room.ts
    - shared/game/view.ts
    - test/unit/gameRoom.test.ts

key-decisions:
  - "tick 의 새 마감은 now 가 아니라 '이전 마감 + 다음 단계 길이' 로 연쇄 계산한다 — 알람이 늦어도 모든 폰의 마감이 같다"
  - "startGame 은 연결 여부와 무관하게 앉은 사람 전원을 seat 오름차순으로 assignRoles 에 넘긴다(결정 0012, D-16)"
  - "RED 단계 stub 은 검사 로직만 두고 결과는 비워 둔다(startGame 은 checkStart 만, tick 은 입력 그대로) — import 오류가 아니라 단언 실패로 RED 를 만든다"

patterns-established:
  - "TDD RED 보고서는 tap-flat 으로 받고, 단언 비교는 한 줄 문자열로 만든다(여러 줄 diff 나 빈 actual 은 TAP 분류기가 Malformed 로 거절한다)"
  - "플레이어별 뷰 누출 검사는 4~8명 × 단계 × 전원 × 시드 조합으로 token·id·connId·role/allies 키 경로·공개 키 집합·역할 값 개수를 훑는다"

requirements-completed: [GAME-01, ROLE-01, ROLE-02, ROOM-03]

coverage:
  - id: D1
    description: "단계 표(PHASE_DEFS)와 tick: 배정 3초 → 역할 확인 15초 → 낮이 서버 시각대로, 연쇄 마감·늦은 호출 따라잡기·멱등·멈춤·연결 무관으로 넘어간다"
    requirement: "GAME-01"
    verification:
      - kind: unit
        ref: "test/unit/tick.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "nextWakeAt: 단계 마감과 방 만료 가운데 이른 시각 하나로 DO 알람을 다룬다"
    requirement: "GAME-01"
    verification:
      - kind: unit
        ref: "test/unit/tick.test.ts#nextWakeAt"
        status: pass
    human_judgment: false
  - id: D3
    description: "startGame: 연결된 4명 이상이면 끊긴 사람을 포함한 전원에게 구성표대로 역할을 주고 assigning 단계·마감·방 수명을 갱신한다"
    requirement: "ROLE-01"
    verification:
      - kind: unit
        ref: "test/unit/gameRoom.test.ts#startGame"
        status: pass
    human_judgment: false
  - id: D4
    description: "buildView 가 roleReveal·day 에서만 본인 역할을, 마피아에게만 동료 seat 을 담고 phaseDurationMs 를 단계 표 길이로 보낸다"
    requirement: "ROLE-02"
    verification:
      - kind: unit
        ref: "test/unit/view.test.ts#buildView 내 역할·마피아 동료"
        status: pass
    human_judgment: false
  - id: D5
    description: "4~8명 × 4단계 × 전원 × 시드 3개 조합에서 뷰에 남의 token·id·역할·동료가 새지 않는다"
    requirement: "ROLE-02"
    verification:
      - kind: unit
        ref: "test/unit/view.test.ts#buildView 전수 누출 검사 (T-01-23)"
        status: pass
    human_judgment: false
  - id: D6
    description: "소켓 수준(시작 중 재접속이 같은 마감·역할을 받음)과 '모든 폰에서 같은 시각' 실측 허용 오차는 이 계획의 순수 함수 범위 밖"
    requirement: "GAME-01"
    verification: []
    human_judgment: true
    rationale: "01-09(DO 알람·방송)와 01-14(스모크 실측)에서 검증한다. 이 계획은 마감 값이 모든 폰에 같다는 순수 함수 쪽 증거만 낸다."

duration: 5min
completed: 2026-10-23
status: complete
---

# Phase 1 Plan 07: 단계 표·tick·startGame·역할 뷰 Summary

**데이터 표 PHASE_DEFS 와 순수 tick 이 배정 3초 → 역할 확인 15초 → 낮을 서버 시각대로 연쇄 계산하고, startGame 이 끊긴 사람까지 전원에게 역할을 주며, buildView 가 본인 역할과 마피아 동료만 실어 4~8명 전수 누출 검사로 고정했다.**

## Performance

- **Duration:** 약 5분
- **Started:** 2026-10-23T05:00:13Z
- **Completed:** 2026-10-23T05:04:49Z (SUMMARY 작성 직전 기준)
- **Tasks:** 3 (트레이서 1 + auto 2, 모두 TDD)
- **Files modified:** 7 (신규 4, 수정 3)

## Accomplishments

- `PHASE_DEFS`: lobby / assigning(3000ms) / roleReveal(15000ms) / day 네 행. 직업 공개 단계는 넣지 않았고 day 는 1페이즈의 끝(시간·다음 단계 없음).
- `tick`: 마감이 지난 동안 반복해 다음 단계로 넘기고 새 마감을 이전 마감 기준으로 쌓는다. 늦게 불리면 한 번에 따라잡고, 바뀐 게 없으면 같은 객체를 돌려주며, 연결 여부를 보지 않는다. `nextWakeAt` 은 `min(phaseEndsAt ?? ∞, expiresAt)`.
- `startGame`: `checkStart` 재사용, seat 오름차순 전원 id 를 주입된 `randInt` 로 `assignRoles` 에 넘겨 `Player.role` 을 붙이고 `assigning`·`now+3000`·`now+ROOM_TTL_MS` 로 바꾼다. 연결 4 + 끊김 2(자리 6) 방에서 6인 구성표(마피아 2·경찰 1·의사 1·시민 2)로 6명 모두 배정됨을 테스트로 고정.
- `buildView`: `phaseDurationMs` 를 표 길이로 채우고, `revealsOwnRole` 단계에서만 `me.role`, 마피아에게만 `me.allies`(다른 마피아 seat 오름차순, 혼자면 `[]`). 조건이 아니면 키 자체를 만들지 않는다.
- 전수 누출 검사(360개 뷰): token·id·connId 부재, `role` 키는 `me.role` 경로에만, `allies` 키는 `me.allies` 경로에만, `players[]` 키 집합이 정확히 `connected,isHost,nickname,seat`, 뷰 안의 역할 값 개수가 본인 것 하나 이하.

## Task Commits

1. **Task 1 (tracer): 단계 표와 tick** — RED `689745a` (test) → GREEN `274a177` (feat)
2. **Task 2: startGame 역할 배정** — RED `789774b` (test) → GREEN `11fa5b8` (feat)
3. **Task 3: 뷰의 내 역할·마피아 동료·단계 길이** — RED `39c3e94` (test) → GREEN `4ac230b` (feat)

REFACTOR 커밋은 없다(정리할 항목 없음, 계획상 선택).

**Plan metadata:** 이 SUMMARY 커밋(`docs(01-07)`) — 해시는 오케스트레이터가 병합 후 확인.

## TDD Gate Compliance

세 사이클 모두 `test(01-07)` 가 `feat(01-07)` 보다 먼저 있다.

| 사이클 | RED | RED 증거 | GREEN |
|---|---|---|---|
| Task 1 | `689745a` | `gsd check tdd-red-evidence` → `RED_EVIDENCE_OK` (tap-flat, 대상: "마감과 정확히 같은 순간에 다음 단계로 넘어가고…", 11개 중 대상 포함 실패) | `274a177`, tick.test.ts 15개 통과 |
| Task 2 | `789774b` | `RED_EVIDENCE_OK` (대상: "연결 4 + 끊김 2(자리 6) — …6명 모두 역할을 받는다", 9개 실패·기존 37개 통과) | `11fa5b8`, gameRoom.test.ts 46개 통과 |
| Task 3 | `39c3e94` | `RED_EVIDENCE_OK` (대상: "roleReveal·day 에서 me.role 은 본인 역할이다", 3개 실패) | `4ac230b`, view.test.ts 6개 통과 |

의미 검사(semanticAssessment): 세 대상 모두 실제로 실행되어 import·문법·fixture 오류가 아니라 뼈대(stub)가 계획된 동작을 하지 않아서 계획된 단언(`phase`, 역할 개수, `me.role`)에서 실패했다. 전수 누출 테스트는 RED 시점에 아무것도 새지 않아 통과했지만, GREEN 이후 `roleReveal`·`day` 에서 허용 역할 값 개수(1)와 맞는지까지 같은 테스트가 계속 검사한다.

## Files Created/Modified

- `shared/game/phases.ts` - `PhaseDef`, `PHASE_DEFS` 단계 표, `ASSIGNING_MS`, `ROLE_REVEAL_MS`
- `shared/game/tick.ts` - 순수 `tick`, `nextWakeAt` (현재 시각 함수 호출 없음)
- `shared/game/room.ts` - `Player.role?`, `startGame`
- `shared/game/view.ts` - `buildView` 가 `phaseDurationMs`·`me.role`·`me.allies` 를 채움
- `test/unit/tick.test.ts` - 단계 표·tick·nextWakeAt (15개)
- `test/unit/gameRoom.test.ts` - `startGame` 케이스 9개 추가
- `test/unit/view.test.ts` - 단계 길이·역할·동료·전수 누출 검사

## Decisions Made

- 새 마감을 `now` 가 아닌 이전 마감 기준으로 쌓는다(계획대로). 알람 지연이 마감에 영향을 주지 않는다.
- `startGame` 의 새 플레이어 객체는 `role` 을 항상 값으로 채운다(앉은 전원이 배정 대상이므로 undefined 가 남지 않는다).
- RED stub 설계: import 오류를 피하려고 `phases.ts`·`tick.ts` 는 상수/형태만 있는 뼈대로, `startGame` 은 `checkStart` 만 하는 뼈대로 RED 커밋에 포함했다. GREEN 커밋이 이를 실제 구현으로 대체한다.

## Deviations from Plan

None - plan executed exactly as written.

(참고: RED 증거 분류기가 vitest 기본 TAP 의 여러 줄 diff·빈 `actual` 을 `Malformed TAP` 으로 거절해, 테스트 단언을 한 줄 문자열 비교로 바꾸고 `tap-flat` 리포터를 썼다. 계획 범위 안의 테스트 작성 방식 조정이며 동작·커버리지는 그대로다.)

## Issues Encountered

- 첫 RED 시도에서 `tdd-red-evidence` 가 `invalid_record`(Malformed TAP)로 거절 — 위 참고대로 단언 출력 형식을 한 줄로 정리하고 `tap-flat` 으로 다시 받아 `RED_EVIDENCE_OK` 를 얻었다. 증거 JSON 은 프로젝트 안 임시 폴더(`.gsd-tmp/`)에서 검증한 뒤 삭제했고 커밋하지 않았다.

## Known Stubs

없음. RED 용 임시 뼈대는 모두 GREEN 커밋에서 실제 구현으로 대체됐다.

## Threat Flags

없음. 새 네트워크 경로·인증·파일 접근·스키마 변경이 없다. 계획 위협 T-01-23(뷰 누출), T-01-24(tick 위변조), T-01-25(배정 난수)는 모두 계획대로 완화했다: 누출은 전수 테스트, tick 은 `Date.now` 부재(grep 게이트)와 서버 시각 인자, 배정은 randInt 주입과 seat 정렬·호출 횟수 스파이 테스트.

## User Setup Required

None - no external service configuration required.

## Deferred to Orchestrator

- 계획에 웨이브 종료 시 HANDOFF.md 갱신·push 가 있다면 이 워크트리에서는 하지 않았다(지시에 따라). 병합 후 main 에서 오케스트레이터가 처리한다. STATE.md·ROADMAP.md 도 건드리지 않았다.

## Verification Results

- `npx vitest run test/unit/tick.test.ts test/unit/gameRoom.test.ts test/unit/view.test.ts`: 통과
- `npm run typecheck`: exit 0, `error TS` 0건
- `npx vitest run --project unit`: 14개 파일 192개 통과
- `npx vitest run test/worker/http.test.ts`: 13개 통과(lobby 뷰 모양 회귀 없음)
- `git log --grep "^test\(0?1-0?7\):"`: RED 커밋 3개가 각 feat 보다 앞선다
- `grep Date.now|Math.random shared/game/{tick,room,view,phases}.ts`: 코드에 없음(room.ts 주석 한 줄에서 `cryptoRandInt` 언급만)

## Next Phase Readiness

- 01-09(방 DO)는 `startGame(state, hostId, now, cryptoRandInt)`·`tick(state, now)`·`nextWakeAt(state)` 를 그대로 호출하면 된다. 알람은 `nextWakeAt` 하나로 단계 마감과 방 만료를 함께 다룬다.
- 01-13(화면)은 `RoomView.phaseDurationMs`·`phaseEndsAt`·`serverNow`·`me.role`·`me.allies` 를 그대로 쓴다. 마피아 혼자일 때 `allies` 는 `[]` 이므로 "혼자예요" 분기를 고를 수 있다.
- 열린 항목: "모든 폰에서 같은 시각" 실측 허용 오차(0.5초 미만)는 01-14 스모크가 잰다.

## Self-Check: PASSED

- 파일 7개 모두 존재(phases.ts, tick.ts, room.ts, view.ts, tick.test.ts, gameRoom.test.ts, view.test.ts)
- 커밋 6개(689745a, 274a177, 789774b, 11fa5b8, 39c3e94, 4ac230b) 모두 `plan_head_before..HEAD` 안에 있다
- 세 작업의 acceptance_criteria 명령 모두 성공

---
*Phase: 01-walking-skeleton*
*Completed: 2026-10-23*
