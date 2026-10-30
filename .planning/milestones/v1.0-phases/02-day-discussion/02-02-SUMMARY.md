---
phase: 02-day-discussion
plan: 02
subsystem: game-core
tags: [claim, tick, tdd, pure-functions, day-loop, server-authority]

requires:
  - phase: 02-day-discussion
    provides: 02-01 의 ON_ENTER 진입 훅 표, Player 의 claim 필드(optional), rolesInPlay, 와이어 Claim 타입
provides:
  - claimOptions(n) — rolesInPlay(n) 뒤에 none 을 붙인 이번 판 선택지(D-07, 한 곳)
  - selectClaim — 단계 → 방 소속 → 구성 포함 순서 검증, 역할과 무관한 판정(D-10)
  - enterClaim — claim 진입 때 모든 플레이어의 claimChoice 키 제거(claimLast·claimShown 유지)
  - enterClaimReveal — 마감 순간 규칙표대로 claimShown·claimChanged·claimLast 일괄 확정(D-01, D-05, D-08, D-09)
  - currentClaim — claimChoice ?? claimLast
  - tick ON_ENTER 에 claim·claimReveal 등록(dayAnnounce 와 함께 세 훅이 늦은 알람에서도 순서대로)
affects: [02-04, 02-05, 02-08, 02-10, 02-11, phase-3-elimination]

tech-stack:
  added: []
  patterns:
    - "주장은 claimChoice(비공개) 에만 쌓이고 claimShown(공개) 으로의 이동은 claimReveal 진입 훅 한 곳에서만 일어난다"
    - "서버 판정 모듈(claim.ts)은 플레이어의 실제 역할 필드를 읽지 않는다 — grep 게이트와 4역할 x 5선택 20조합 테스트로 고정"
    - "TDD RED 의 로드 가능성을 위해 신규 모듈은 상태를 그대로 돌려주는 뼈대를 RED 커밋에 함께 둔다(assertion 이 실패해야 RED)"

key-files:
  created:
    - shared/game/claim.ts
    - test/unit/claim.test.ts
  modified:
    - shared/game/tick.ts
    - test/unit/tick.test.ts

key-decisions:
  - "하루 걸러 말 바꿈(A3): 어제 R → 오늘 none → 내일 R' 는 말 바꿈이 아니다(claimLast 가 매일 공개 값으로 덮이는 D-08 권장안의 직접 결과). 결정 0016(02-11)에 기록한다"
  - "같은 값 재선택은 입력 상태 객체를 그대로 돌려준다(저장·방송 생략 가능). 단 claimChoice 가 없고 claimLast 와 같은 값을 처음 고르는 것은 직접 선택이므로 상태가 바뀐다 — 그래야 완료 배지가 선다"
  - "enterClaimReveal 은 claimChoice 를 지우지 않는다 — 다음 낮 enterClaim 이 지운다"

patterns-established:
  - "TAP 보고서가 여러 줄 diff 없이 읽히도록 테스트는 한 줄 문자열로 비교한다(02-01 선례 이어받음) — 객체 toEqual 의 여러 줄 diff 는 RED 증거를 Malformed TAP 으로 만든다"

requirements-completed: [DAY-02]

coverage:
  - id: C1
    description: "마감 순간 규칙표 8행·끊긴 사람의 직접 선택·하루 걸러 규칙이 enterClaimReveal 로 확정되고, 마감 전에는 claimShown 이 바뀌지 않는다"
    requirement: "DAY-02"
    verification:
      - kind: unit
        ref: "test/unit/claim.test.ts#enterClaimReveal - 마감 확정 규칙표 (D-05, D-08, D-09)"
        status: pass
    human_judgment: false
  - id: C2
    description: "claim 마감에서 tick 이 claimReveal 에 들어가며 훅을 부르고, 늦은 알람이 discussion 에서 claimReveal 까지 따라잡아도 dayAnnounce → claim → claimReveal 훅이 순서대로 돈다"
    requirement: "DAY-02"
    verification:
      - kind: unit
        ref: "test/unit/claim.test.ts#tick - claim 마감에서 claimReveal 훅이 돈다"
        status: pass
      - kind: unit
        ref: "test/unit/tick.test.ts#tick - 늦은 알람의 따라잡기 훅 순서 (dayAnnounce → claim → claimReveal)"
        status: pass
    human_judgment: false
  - id: C3
    description: "선택지는 rolesInPlay 한 곳에서 나오고(4명판 의사 없음), selectClaim 은 단계·방 소속·구성 포함을 정해진 순서로 검사하며 입력을 바꾸지 않는다"
    requirement: "DAY-02"
    verification:
      - kind: unit
        ref: "test/unit/claim.test.ts#claimOptions - 이번 판 선택지 (D-07)"
        status: pass
      - kind: unit
        ref: "test/unit/claim.test.ts#selectClaim - 선택 검증 (D-03, D-10, T-02-05)"
        status: pass
    human_judgment: false
  - id: C4
    description: "서버 판정이 실제 역할과 무관하다 — 네 역할 모두가 모든 선택지를 고를 수 있고 claim.ts 는 역할 필드를 읽지 않는다"
    requirement: "DAY-02"
    verification:
      - kind: unit
        ref: "test/unit/claim.test.ts#selectClaim 서버는 참·거짓을 보지 않는다 (20조합)"
        status: pass
      - kind: command
        ref: "! grep -Eq '\\.role\\b' shared/game/claim.ts"
        status: pass
    human_judgment: false
  - id: C5
    description: "claim 진입 때 이번 낮 선택이 지워지고 어제 공개 값은 남아 내 화면 초기 선택(currentClaim)이 된다"
    requirement: "DAY-02"
    verification:
      - kind: unit
        ref: "test/unit/claim.test.ts#enterClaim - 이번 낮 선택 초기화 (D-03, D-09)"
        status: pass
      - kind: unit
        ref: "test/unit/claim.test.ts#currentClaim - 내 화면 초기 선택 (D-09)"
        status: pass
    human_judgment: false

actuals:
  tokens: 5100
  tasks: 2
  commits: 4
plan_head_before: e5a85a7f49f98e7d1d599c61711ba7b50e57f2ab
plan_head_after: e85b09a7b5a75062bf28f3ab5662115ec0b28261

duration: 5min
completed: 2026-10-24
status: complete
---

# Phase 2 Plan 02: 직업 공개 규칙 Summary

**직업 공개의 서버 규칙을 순수 함수로 확정했다 — 선택지는 rolesInPlay 한 곳에서, 선택 검증은 역할과 무관하게, 마감 순간 claimReveal 훅이 규칙표대로 공개 값·말 바꿈을 한꺼번에 정한다.**

## Performance

- **Duration:** 약 5 min
- **Completed:** 2026-10-24
- **Tasks:** 2 (트레이서 1 + auto 1, 모두 TDD)
- **Files:** 신규 2, 수정 2

## Accomplishments

- `enterClaimReveal`: 규칙표 8행 전부와 "끊긴 사람의 직접 선택은 공개", "하루 걸러(R → none → R') 는 말 바꿈 아님" 을 단위 테스트로 고정. 입력 불변, 마감 전 claimShown 불변(T-02-04).
- `claimOptions`/`selectClaim`/`currentClaim`/`enterClaim`: 검사 순서(단계 → 방 소속 → 구성 포함 → 같은 값 재선택은 같은 객체)를 계약으로 두고, 네 역할 × 다섯 선택 20조합이 모두 통과함을 확인(T-02-06). `claim.ts` 에는 `.role` 접근이 없다.
- `tick.ts` ON_ENTER 표에 `claim: enterClaim`, `claimReveal: enterClaimReveal` 등록. 늦은 알람이 discussion 에서 claimReveal 까지 한 번에 따라잡아도 세 훅이 순서대로 돈다(tick.test 따라잡기 케이스).
- 트레이서 게이트: 자동 검증만 있는 `<verify>` 를 다시 돌려 통과(`⚡ Tracer verified end-to-end — expanding`).

## Task Commits

1. **Task 1: 트레이서 — claimReveal 진입 훅** — RED `45303fe` (test) → GREEN `b6c6558` (feat)
2. **Task 2: 선택지·선택·이번 낮 초기화와 따라잡기 순서** — RED `842db68` (test) → GREEN `e85b09a` (feat)

REFACTOR 커밋은 없다(정리할 변경이 없었다).

## TDD Gate Compliance

| Task | RED | GREEN | 증거 |
|------|-----|-------|------|
| 1 | `45303fe` test(02-02) | `b6c6558` feat(02-02) | `gsd-tools check tdd-red-evidence` → `RED_EVIDENCE_OK`(tap-flat, 대상 "1일차, 직접 선택 R → R", 14건 실패). 뼈대 `enterClaimReveal` 이 상태를 그대로 돌려줘 `undefined/undefined/undefined` ≠ `police/false/police` 단언이 실패했다. import·로드 오류 아님 |
| 2 | `842db68` test(02-02) | `e85b09a` feat(02-02) | `RED_EVIDENCE_OK`(대상 `claimOptions` 4명판, 12건 실패). 뼈대 함수가 빈 목록·거부를 돌려줘 단언이 실패했다 |

semanticAssessment: 두 RED 모두 대상 테스트가 실제로 실행되어 계획된 단언(공개 값·선택지 목록)에서 의도한 이유로 실패했다. 모든 GREEN 이전에 RED 커밋이 먼저 있다.

## Files Created/Modified

- `shared/game/claim.ts` — 선택지·선택·초기화·마감 확정(신규, 순수 모듈, 머리 주석에 규칙표 출처와 하루 걸러 규칙)
- `shared/game/tick.ts` — ON_ENTER 에 claim·claimReveal 등록
- `test/unit/claim.test.ts` — 규칙표 행별 테스트, 선택 검증, 20조합 역할 무관, 초기화(신규)
- `test/unit/tick.test.ts` — 따라잡기 훅 순서 케이스

## Decisions Made

key-decisions 참조. 하루 걸러 말 바꿈 규칙은 알고 따른 가정이며 결정 0016(02-11)에 기록한다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RED 가 로드 오류가 되지 않도록 claim.ts 뼈대를 RED 커밋에 포함**
- **Found during:** Task 1·2 RED
- **Issue:** 신규 모듈 `shared/game/claim.ts` 가 없으면 테스트 import 가 로드 실패가 되어 INVALID_RED(`fixture_or_load_failure`) 다.
- **Fix:** 상태를 그대로 돌려주는 뼈대(Task 1)와 빈 목록·거부를 돌려주는 뼈대(Task 2)를 각 RED 커밋에 함께 두고 GREEN 에서 구현으로 교체했다. 계획이 정한 RED → GREEN 순서와 test 커밋이 feat 보다 먼저인 조건은 그대로다.
- **Files modified:** `shared/game/claim.ts`
- **Commit:** `45303fe`, `842db68`

**2. [Rule 3 - Blocking] RED 증거 보고서가 Malformed TAP 이 되는 객체 비교를 한 줄 문자열 비교로 교체**
- **Found during:** Task 1 RED 증거 검증
- **Issue:** `toEqual` 객체 비교의 여러 줄 diff 가 TAP 에 섞여 분류기가 `invalid_record`(Non-TAP data) 로 거부했다.
- **Fix:** 테스트 단언을 `공개/바뀜/last` 한 줄 문자열 비교로 바꿨다(02-01 의 "한 줄 문자열" 선례). 의미 변화 없음.
- **Files modified:** `test/unit/claim.test.ts`
- **Commit:** `45303fe`

---

**Total deviations:** 2 auto-fixed (Rule 3 x 2)
**Impact on plan:** 증거 형식과 로드 가능성을 맞춘 것뿐이며 범위 확장·계약 변경은 없다.

## Issues Encountered

None. 계획 검증 전부 통과: `npx vitest run test/unit/claim.test.ts test/unit/tick.test.ts`(50건), `npm run typecheck`, `npx vitest run --project unit`(355건), 전체 `npx vitest run`(43 파일, 735건). acceptance_criteria grep 전부 통과.

## Known Stubs

None. 이 계획은 순수 함수와 훅 등록만 다룬다. DO 핸들러 연결(02-05)과 뷰(02-04)는 후속 계획이다.

## Threat Flags

없음 — 새 네트워크 경로·인증·파일 접근 없음. 위협 완화 확인: T-02-04(마감 전 claimShown 불변 테스트), T-02-05(단계·방 소속·구성 검사와 입력 불변), T-02-06(`.role` 부재 grep 게이트 + 20조합), T-02-SC(새 패키지 없음).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 02-04 가 뷰에서 `claimChoice`(본인에게만, `currentClaim`), `claimDone`(완료 자리), 공개 뒤 `claimShown`·`claimChanged` 를 실을 수 있다.
- 02-05 가 DO 핸들러에서 `selectClaim` 결과가 입력과 같은 객체면 저장·방송을 생략할 수 있다.
- 3페이즈(ELIM-01)가 `selectClaim` 에 `isAlive` 검사를 더한다.

## Self-Check: PASSED

- `shared/game/claim.ts`, `test/unit/claim.test.ts` 존재 확인, `tick.ts`·`tick.test.ts` 수정 확인
- 커밋 4개(`45303fe`, `b6c6558`, `842db68`, `e85b09a`) 가 HEAD 의 조상임을 확인, `git rev-list --count` 로 측정한 `commits: 4`

---
*Phase: 02-day-discussion*
*Completed: 2026-10-24*
