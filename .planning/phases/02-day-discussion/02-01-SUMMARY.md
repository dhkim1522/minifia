---
phase: 02-day-discussion
plan: 01
subsystem: game-core
tags: [phases, tick, wire-contract, durable-object, react, tdd, day-loop]

requires:
  - phase: 01-walking-skeleton
    provides: PHASE_DEFS 단계 표, 순수 tick, buildView, RoomScreen·Table·PhaseBar·Timer, 알람 기반 DO
provides:
  - 2페이즈 와이어 계약 전체(PhaseId 7값, Claim, TEMPLATE_IDS, EMOJI_IDS, ChatLine, SeatClaim, DayView, MyInfo.claim, RoomView.day, ClientMessage claim·say·emoji·extend·skip, ServerMessage emoji, ALREADY_EXTENDED)
  - 낮 네 단계 표(dayAnnounce 2s → claim 15s → claimReveal 2s → discussion 90s → dayAnnounce 임시 루프)와 시간 상수 한 곳
  - tick 안의 진입 훅 표 ON_ENTER 와 enterDayAnnounce(일차 +1, 메시지 비움, 연장 초기화)
  - rolesInPlay(n) — 구성표에서만 파생한 이번 판 직업 목록
  - DayScene — claim·claimReveal·discussion 이 테이블을 다시 마운트하지 않고 공유하는 장면(위쪽 바·하단 패널 슬롯)
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07, 02-08, 02-09, 02-10, 02-11, phase-3-night]

actuals:
  tokens: 15355
  tasks: 3
  commits: 6
plan_head_before: 2eb0b0c32733b70399fb5a73b9e83669ba3c55f5
plan_head_after: 8fe644bc81c016a9c5b334cbd6c11e7b77ccf1d9

tech-stack:
  added: []
  patterns:
    - "단계 진입 전이는 tick 루프 안의 ON_ENTER 훅 표에 한 줄로 둔다 — 늦은 알람의 다단계 따라잡기에서도 중간 훅이 순서대로 돈다"
    - "새 상태 필드는 모두 optional(everConnected? 선례) — 읽는 쪽이 기본값을 쥐어 저장된 옛 방과 호환"
    - "한 장면을 공유하는 여러 서버 단계는 같은 래퍼 키(sceneKey)와 키 없는 장면 상자로 테이블을 유지하고 바·패널만 단계 키로 바꾼다"

key-files:
  created:
    - src/screens/DayScene.tsx
    - src/styles/day.css
    - .planning/phases/02-day-discussion/deferred-items.md
  modified:
    - shared/protocol.ts
    - shared/game/phases.ts
    - shared/game/tick.ts
    - shared/game/room.ts
    - shared/game/roles.ts
    - src/screens/RoomScreen.tsx
    - src/screens/Day.tsx
    - test/unit/tick.test.ts
    - test/unit/roles.test.ts
    - test/unit/view.test.ts
    - test/unit/gameRoom.test.ts
    - test/unit/preview.test.ts
    - test/worker/alarm.test.ts
    - test/worker/leak.test.ts
    - test/client/phaseScreens.test.tsx

key-decisions:
  - "claimReveal 을 2초짜리 별도 서버 단계로 분리(권장안 채택, reversibility costly) — 모든 폰이 같은 마감으로 연출을 시작·종료한다"
  - "discussion.next 를 dayAnnounce 로 둔 임시 낮 루프(D-19) — 3페이즈가 이 한 줄을 밤으로 바꾼다"
  - "ON_ENTER 훅은 tick 루프 안에서만 부른다(알람 핸들러·DO 에서 직접 부르지 않음)"
  - "nextMessageSeq 는 enterDayAnnounce 가 건드리지 않는다 — 날이 바뀌어도 메시지 번호가 줄지 않는다"
  - "DayScene 의 위쪽 바와 하단 패널 key 는 bar-·panel- 접두어로 구분한다(같은 부모의 형제가 같은 key 를 쓰면 React 가 둘을 섞는다)"

patterns-established:
  - "TDD 계획에서 계약·훅이 먼저 RED(tick.test), 이어 파생 함수(roles.test), 화면(phaseScreens.test) 순으로 RED → GREEN 을 세 번 돈다"
  - "서버 단계 이름에 묶인 테스트는 단계 표 변경과 같은 계획 안에서 옮긴다"

requirements-completed: [DAY-01, DAY-02]

coverage:
  - id: D1
    description: "역할 확인 뒤 서버가 낮 시작 발표 → 직업 공개 15초 → 공개 연출 2초 → 낮 토론 90초 → 다음 낮을 같은 마감으로 돌린다(단계 표·tick)"
    requirement: "DAY-01"
    verification:
      - kind: unit
        ref: "test/unit/tick.test.ts#PHASE_DEFS (단계 표, D-01·D-02·D-19·D-20)"
        status: pass
      - kind: integration
        ref: "test/worker/alarm.test.ts#낮 한 바퀴(dayAnnounce → claim → claimReveal → discussion → dayAnnounce)를 알람이 차례로 넘기고 저장된 일차는 2 가 된다"
        status: pass
    human_judgment: false
  - id: D2
    description: "단계 진입 훅(일차 +1·메시지 비움·연장 초기화)이 tick 루프 안에서 돌고 늦은 알람에도 중간 훅이 순서대로 돌며 멱등이다"
    requirement: "DAY-01"
    verification:
      - kind: unit
        ref: "test/unit/tick.test.ts#tick (순수 단계 진행)"
        status: pass
    human_judgment: false
  - id: D3
    description: "rolesInPlay 가 구성표에서만 파생해 4명판은 의사 없이, 5~8명은 넷 모두, 지원하지 않는 인원은 빈 배열을 돌려준다"
    requirement: "DAY-02"
    verification:
      - kind: unit
        ref: "test/unit/roles.test.ts#rolesInPlay - 이번 판 직업 목록 (D-07)"
        status: pass
    human_judgment: false
  - id: D4
    description: "새 단계·상태 필드가 어떤 뷰에도 새로 실리지 않는다(일곱 단계 전수 누출 검사와 실제 소켓 누출 검사)"
    verification:
      - kind: unit
        ref: "test/unit/view.test.ts#buildView 전수 누출 검사 (T-01-23)"
        status: pass
      - kind: integration
        ref: "test/worker/leak.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "낮 시작 발표가 서버 일차·보조 문구를 그리고, 직업 공개·공개 연출·낮 토론이 테이블을 다시 그리지 않는 한 장면으로 이어지며 역할에 따라 마크업이 달라지지 않는다"
    requirement: "DAY-01"
    verification:
      - kind: unit
        ref: "test/client/phaseScreens.test.tsx#S-06b·S-06c·S-07 한 장면 DayScene (DAY-01, UI-SPEC 장면)"
        status: pass
    human_judgment: false
  - id: D6
    description: "360×640 폰에서 세로 스크롤 없이 테이블 장면이 남는 높이에 맞춰 줄고 위쪽 바·패널 페이드가 자연스럽다"
    verification: []
    human_judgment: true
    rationale: "레이아웃 높이 계산과 페이드 체감은 단위 테스트가 단언하지 않는다. 실기기(UI-SPEC UI Considerations 실기기 확인 항목)에서 확인한다"

duration: 7min
completed: 2026-10-24
status: complete
---

# Phase 2 Plan 01: 낮 루프 트레이서 Summary

**서버 단계 표 → tick 진입 훅 → DO 알람 → DayScene 까지 한 줄로 관통하는 낮 루프(발표 2초 → 직업 공개 15초 → 공개 연출 2초 → 토론 90초 → 다음 낮)와 2페이즈 와이어 계약을 한 번에 정했다.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-23T17:40:54Z
- **Completed:** 2026-10-23T17:47:00Z
- **Tasks:** 3 (트레이서 1 + auto 2, 모두 TDD)
- **Files modified:** 17 (신규 2 + 보류 문서 1 포함 시 18)

## Accomplishments

- 와이어 계약 고정: PhaseId 7값, Claim·TEMPLATE_IDS(5)·EMOJI_IDS(8)·ChatLine·SeatClaim·DayView, ClientMessage 5종·ServerMessage emoji·ALREADY_EXTENDED 를 `shared/protocol.ts` 에 값 import 없이 넣었다. ChatLine 키에 id·role 이름을 쓰지 않는 이유를 주석으로 남겼다.
- 단계 표와 진입 훅: 낮 네 행과 시간 상수를 `phases.ts` 한 곳에, `tick` 은 단계를 넘길 때마다 `ON_ENTER` 훅을 루프 안에서 적용한다. 훅은 `dayAnnounce: enterDayAnnounce` 한 줄이고 3·4페이즈가 같은 표에 행을 더한다. 변화가 없으면 입력 객체를 그대로 돌려준다.
- `rolesInPlay(n)` 을 `ROLE_TABLE` 에서만 파생(4명 = 마피아·경찰·시민, 5~8명 = 넷 모두, 지원 밖은 빈 배열).
- 단위·워커 회귀 이전: view 테스트가 일곱 단계 × 3 시드 × 30명 전수 누출 검사를 그대로 통과하고, 알람 테스트가 한 바퀴를 한 단계씩 넘겨 저장된 day 2 를 확인한다.
- 클라이언트: 낮 시작 발표가 서버 일차(없으면 1)와 "토론 전에 먼저 직업을 공개해요" 를 그리고, claim·claimReveal·discussion 은 한 `DayScene` 이 그린다(테이블 노드 유지, 바·패널만 단계마다 페이드). 4단계 aria-live 문구 반영.

## Task Commits

1. **Task 1: 트레이서 — 와이어 계약과 낮 네 단계, 진입 훅이 도는 tick** — RED `adf1707` (test) → GREEN `d10c617` (feat)
2. **Task 2: 서버 회귀를 새 낮 루프로 옮기고 rolesInPlay** — RED `db3ff77` (test) → GREEN `b97b5de` (feat)
3. **Task 3: 낮 시작 발표 개정과 DayScene** — RED `4c13fb6` (test) → GREEN `8fe644b` (feat)

REFACTOR 커밋은 없다(정리할 변경이 없었다).

## TDD Gate Compliance

| Task | RED | GREEN | 증거 |
|------|-----|-------|------|
| 1 | `adf1707` test(02-01) | `d10c617` feat(02-01) | `gsd-tools check tdd-red-evidence` → `RED_EVIDENCE_OK`(tap-flat, 대상 `enterDayAnnounce` 케이스, 9건 실패). 실패 원인은 단계 표 불일치와 `enterDayAnnounce is not a function` 의 단언이며 구문·로드 오류가 아니다 |
| 2 | `db3ff77` test(02-01) | `b97b5de` feat(02-01) | `RED_EVIDENCE_OK`(대상 `rolesInPlay` 4명 케이스). 기존 assignRoles 케이스는 통과해 로드 오류가 아니다. view/alarm/leak 이전은 기존 테스트의 단계 이름 이전이라 별도 RED 가 아니라 Task 1 변경(PhaseId)으로 이미 깨진 회귀를 옮긴 것이다 |
| 3 | `4c13fb6` test(02-01) | `8fe644b` feat(02-01) | `RED_EVIDENCE_OK`(대상 `낮 토론` 케이스, 17건 실패, 대상 단언은 heading 존재) |

모든 GREEN 이전에 RED 커밋이 먼저 있다. 계획 검증 항목("tdd 작업마다 test(02-01) 커밋이 feat(02-01) 보다 먼저") 충족.

## Files Created/Modified

- `shared/protocol.ts` — 2페이즈 와이어 계약 전체
- `shared/game/phases.ts` — 낮 네 행과 시간 상수 5개(DAY_ANNOUNCE_MS·CLAIM_MS·CLAIM_REVEAL_MS·DISCUSSION_MS·EXTEND_MS)
- `shared/game/tick.ts` — ON_ENTER 훅 표, `enterDayAnnounce`, 루프 안 훅 적용
- `shared/game/room.ts` — Player·RoomState 에 optional 낮 상태 필드(주석에 뷰 노출 규칙 명시)
- `shared/game/roles.ts` — `rolesInPlay`
- `src/screens/DayScene.tsx` — 낮 세 단계가 공유하는 장면(신규)
- `src/styles/day.css` — 보조 문구·DayScene 배치(신규, 색 직접 지정 없음)
- `src/screens/Day.tsx` — `view`·`myRoleButton` props, 서버 일차, 보조 문구
- `src/screens/RoomScreen.tsx` — `PHASE_ANNOUNCE` 함수화, `sceneKey`, 새 case
- 테스트: `tick`·`roles`·`view`·`gameRoom`·`preview`·`alarm`·`leak`·`phaseScreens`

## Decisions Made

key-decisions 참조. 가장 무거운 둘: claimReveal 을 서버 단계로 분리한 것(되돌리기 어려움), discussion.next 를 dayAnnounce 로 둔 임시 루프(3페이즈가 교체).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 계획 behavior 의 마감 산술 오류 수정**
- **Found during:** Task 1 (RED 작성)
- **Issue:** behavior 에 "roleReveal(19000) 에서 tick(s, 19000+2000+15000+2000) → claimReveal 이고 phaseEndsAt 38000+2000" 이라고 적혀 있다. 실제 마감은 dayAnnounce 21000 → claim 36000 → claimReveal 38000 → discussion 이므로 now 38000 이면 이미 discussion 이고 `38000+2000` 인 마감은 존재하지 않는다. 같은 식으로 "discussion(T) 에서 T+2000+15000+2000+90000 → 다시 discussion" 도 마감 T+109000 과 같은 순간이라 다음 dayAnnounce(day 3)가 된다.
- **Fix:** 의도(여러 단계를 따라잡아도 훅이 루프 안에서 정확히 한 번씩 돈다)를 지키되 now 를 37000(claimReveal 한가운데, phaseEndsAt 38000)과 T+20000(discussion 한가운데, phaseEndsAt T+109000, day 2)으로 바꿨다. T+109000 경계는 "한 바퀴가 끝나는 순간 다음 낮(day 3)" 케이스로 따로 단언했다. 또 "assigning 4000 에서 now 30000" 계열 단언의 기대 단계를 day → claim(마감 36000)으로 맞췄다.
- **Files modified:** `test/unit/tick.test.ts`
- **Verification:** `npx vitest run test/unit/tick.test.ts` 19건 통과
- **Committed in:** `adf1707`·`d10c617`

**2. [Rule 3 - Blocking] 타입 검사가 깨지는 계획 밖 테스트 두 개 수정**
- **Found during:** Task 1 직후 `npm run typecheck`
- **Issue:** `test/unit/gameRoom.test.ts`·`test/unit/preview.test.ts` 가 PhaseId `"day"` 를 쓴다. 계획 files_modified 에 없지만 `day` 가 사라지면 `tsc` 가 실패한다.
- **Fix:** 비-대기실 단계 예시일 뿐이라 `dayAnnounce` 로 바꾸고, preview 누출 검사는 낮 네 단계 모두를 돌게 넓혔다.
- **Files modified:** `test/unit/gameRoom.test.ts`, `test/unit/preview.test.ts`
- **Verification:** `npm run typecheck` 통과, 두 파일 통과
- **Committed in:** `b97b5de`

**3. [Rule 1 - Bug] DayScene 형제 요소 key 중복**
- **Found during:** Task 3 GREEN
- **Issue:** 위쪽 바 래퍼와 하단 패널에 둘 다 `key={view.phase}` 를 주면 같은 부모의 형제 key 가 겹쳐 React 가 두 요소를 섞어 "단계마다 새 노드" 단언이 깨졌다.
- **Fix:** `bar-${phase}`·`panel-${phase}` 로 구분했다.
- **Files modified:** `src/screens/DayScene.tsx`
- **Verification:** `phaseScreens.test.tsx` 40건 통과
- **Committed in:** `8fe644b`

---

**Total deviations:** 3 auto-fixed (Rule 1 ×2, Rule 3 ×1)
**Impact on plan:** 모두 정확성·빌드 통과에 필요한 수정이다. 범위 확장 없음. 의도한 계약은 그대로다.

## Issues Encountered

- `scripts/smoke.mjs` 가 종착 단계 `day` 를 가정한다(PHASE_ORDER, 마지막 단계, day 전환 편차). 이 도구는 배포 주소에 붙는 스크립트이고 02-01 파일 목록 밖이라 고치지 않고 `deferred-items.md` 와 `.planning/WINDOWS.md`(todo)에 남겼다. 서버 변경이 배포되는 계획에서 낮 루프 기준으로 바꿔야 한다.

## Known Stubs

| 파일 | 내용 | 해소 계획 |
|------|------|-----------|
| `src/screens/DayScene.tsx` (하단 패널 `section.mf-dayscene__panel`) | 내용이 비어 있다(손잡이 막대만) | 02-08(직업 공개 ClaimPanel)·02-09(낮 토론 MessageLog·DiscussionControls)가 채운다. 의도된 슬롯이며 이 계획의 목표(뼈대 관통)는 막지 않는다. `.planning/WINDOWS.md` #2 에 기록 |

또한 `view.day` 는 02-04 가 채우기 전까지 서버가 싣지 않아 화면은 `view.day?.n ?? 1` 로 읽는다(계획의 명시적 가정).

## Threat Flags

없음 — 새 네트워크 경로·인증·파일 접근 없음. T-02-01(tick 은 now 인자만, `Date.now` 호출 없음 grep 게이트 통과)과 T-02-03(일곱 단계 전수 누출 검사 통과)의 완화를 확인했다. 새 패키지 설치 없음(T-02-SC).

## User Setup Required

None - no external service configuration required.

## Verification Results

- `npx vitest run test/unit/tick.test.ts test/unit/roles.test.ts test/unit/view.test.ts` 통과
- `npx vitest run test/worker/alarm.test.ts test/worker/leak.test.ts` 통과
- `npx vitest run test/client/phaseScreens.test.tsx` 통과(40건)
- `npm run typecheck && npx vitest run` 통과(42 파일, 704건)
- 계획 acceptance_criteria 전부 통과(상수·훅·계약 grep, `Date.now` 부재, DayScene·문구·`#hex` 없음 grep)
- 트레이서 게이트: 자동 검증만 있는 `<verify>` 를 다시 돌려 통과(`⚡ Tracer verified end-to-end — expanding`)

## Next Phase Readiness

- 02-02 가 같은 ON_ENTER 표에 claim·claimReveal 항목을 더할 수 있고, 02-04 가 `view.day` 를 채우면 화면이 바로 그 값을 쓴다.
- 02-05 가 DO 생성자에서 옛 방 정규화를 맡는다(이 계획과 그 사이에 배포 없음 가정).
- 실기기에서 360×640 세로 스크롤 없음·페이드 체감을 확인해야 한다(coverage D6).

## Self-Check: PASSED

- 파일 15개(수정·신규) 존재 확인
- 커밋 6개(`adf1707`, `d10c617`, `db3ff77`, `b97b5de`, `4c13fb6`, `8fe644b`) 가 HEAD 의 조상임을 확인, `evaluation-scope --commits-only` 가 6건 반환

---
*Phase: 02-day-discussion*
*Completed: 2026-10-24*
