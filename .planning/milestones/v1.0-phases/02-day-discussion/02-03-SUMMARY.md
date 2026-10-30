---
phase: 02-day-discussion
plan: 03
subsystem: game-core
tags: [chat, quick-messages, emoji, cooldown, host-controls, tdd, pure-functions, server-authority]

requires:
  - phase: 02-day-discussion
    provides: 02-01 의 TEMPLATE_IDS·EMOJI_IDS·ChatLine, Player.lastSendAt·alive, RoomState.messages·nextMessageSeq·extendUsed, tick 진입 훅, EXTEND_MS, rolesInPlay
provides:
  - isAlive(p) — 서버·화면 공용 생존 판정 한 곳(alive !== false). 3페이즈가 탈락을 더한다
  - QUICK_TEMPLATES 데이터 표(다섯 행) — 행 하나만 더하면 문구가 늘어난다(D-11)
  - say — 단계 → 보낸 사람 → 템플릿 고유 속성 → 칸 과부족 → 대상 → 직업 → 쿨다운 순 검증, 필드별 리터럴 줄, 최근 20개 보관, seq 단조 증가
  - emote — say 와 같은 앞부분·같은 lastSendAt 로 합산 2초 쿨다운, messages 에는 남기지 않고 이벤트만 반환
  - extendDiscussion — NOT_HOST → WRONG_PHASE → ALREADY_EXTENDED, 낮마다 한 번 +30초
  - skipDiscussion — 마감을 now 로 놓고 tick 의 일반 전이 경로로 즉시 다음 낮 시작 발표
  - phaseDurationOf — 단계 표 길이에 discussion·extendUsed 일 때만 30000 을 더하는 파생(02-04 buildView 가 사용)
affects: [02-04, 02-05, 02-10, phase-3-elimination]

tech-stack:
  added: []
  patterns:
    - "검증 앞부분(단계 → 보낸 사람 존재·생존)은 내부 함수 senderOf 하나로 say·emote 가 같은 순서로 쓴다"
    - "줄은 입력을 펼쳐 복사하지 않고 필드 하나씩 쓴 리터럴로 만든다 — 알 수 없는 키·자유 문자열이 끼어들 수 없다"
    - "템플릿·아이콘 판정은 고유 속성/포함 검사로 한다 — constructor·toString 같은 프로토타입 키 우회 차단"
    - "마감을 바꾸는 순수 함수는 별도 전이 코드를 만들지 않고 tick 을 다시 불러 진입 훅을 그대로 탄다"

key-files:
  created:
    - shared/game/alive.ts
    - shared/game/chat.ts
    - shared/game/discussion.ts
    - test/unit/chat.test.ts
    - test/unit/discussion.test.ts
  modified: []

key-decisions:
  - "쿨다운 위반(A1)·형식 위반 요청은 입력 상태를 바꾸지 않는다 — 도배가 잠금을 늘리지 못한다(1999ms 거부, 2000ms 통과)"
  - "연장 중복은 ALREADY_EXTENDED(A2), 탈락자 거부는 이 페이즈에서 BAD_MESSAGE(A4) — 3페이즈가 코드를 확정한다"
  - "phaseEndsAt 이 비어 있는 discussion 은 연장에서 WRONG_PHASE 로 거부(비정상 상태 방어)"
  - "skipDiscussion 은 nextMessageSeq 를 건드리지 않는다 — enterDayAnnounce 가 messages 만 비운다(02-01 결정 유지)"

patterns-established:
  - "TDD RED 는 뼈대 모듈을 함께 커밋해 assertion 실패로 만들고, 결과 비교는 한 줄 문자열로 한다(02-02 선례 이어받음)"

requirements-completed: [COMM-01, COMM-02, COMM-04, DAY-01]

coverage:
  - id: E1
    description: "빠른 메시지는 낮 토론 단계에서만, 생존자만, 다섯 템플릿 형식대로 받고 형식·대상·직업 위반은 BAD_MESSAGE 로 거부한다(구성 밖 직업·none·본인·빈 자리·범위 밖·탈락자 대상 포함). 거짓 주장은 그대로 받는다"
    requirement: "COMM-04"
    verification:
      - kind: unit
        ref: "test/unit/chat.test.ts#say - 단계 (D-13, 성공 기준 5)"
        status: pass
      - kind: unit
        ref: "test/unit/chat.test.ts#say - 형식·대상 위반은 BAD_MESSAGE (D-12, D-13, COMM-04)"
        status: pass
      - kind: unit
        ref: "test/unit/chat.test.ts#say - 통과한 메시지 (D-15)"
        status: pass
    human_judgment: false
  - id: E2
    description: "통과한 메시지는 서버가 찾은 보낸 사람 seat 와 필드별 리터럴 줄로 보관되고 최근 20개만 남으며 seq 가 줄지 않는다. 자유 문자열 키는 줄에 들어가지 않는다"
    requirement: "COMM-01"
    verification:
      - kind: unit
        ref: "test/unit/chat.test.ts#say - 보관 (D-15, overflow)"
        status: pass
      - kind: unit
        ref: "test/unit/chat.test.ts#say - 통과한 메시지 (D-15) > 자유 문자열 키가 끼어도 줄에는 들어가지 않는다 (T-02-07)"
        status: pass
      - kind: command
        ref: "! grep -Eq '\\.role\\b' shared/game/chat.ts"
        status: pass
    human_judgment: false
  - id: E3
    description: "이모티콘은 여덟 개 중 하나만 받고 메시지와 합산한 2초 쿨다운(1999ms 거부, 2000ms 통과, 거부는 잠금 연장 없음)을 쓰며 messages 에는 남지 않고 이벤트만 돌려준다"
    requirement: "COMM-02"
    verification:
      - kind: unit
        ref: "test/unit/chat.test.ts#emote - 이모티콘 (D-14, D-16, COMM-02)"
        status: pass
      - kind: unit
        ref: "test/unit/chat.test.ts#메시지·이모티콘 합산 쿨다운 (D-14)"
        status: pass
    human_judgment: false
  - id: E4
    description: "방장만 낮마다 한 번 토론을 +30초 연장하고 언제든 넘길 수 있으며(넘기면 즉시 다음 낮 시작 발표), 단계 길이는 연장을 반영해 90000/120000 으로 파생된다"
    requirement: "DAY-01"
    verification:
      - kind: unit
        ref: "test/unit/discussion.test.ts#extendDiscussion - 방장 연장 (D-18, DAY-01)"
        status: pass
      - kind: unit
        ref: "test/unit/discussion.test.ts#skipDiscussion - 방장 넘기기 (D-18, D-19)"
        status: pass
      - kind: unit
        ref: "test/unit/discussion.test.ts#phaseDurationOf - 단계 길이 파생 (Pitfall 3)"
        status: pass
    human_judgment: false

actuals:
  tokens: 7500
  tasks: 3
  commits: 6
plan_head_before: 6ca20bdc1bd468d79fff1f51562e2750fc900fd2
plan_head_after: 6dc76e846e67bd920b238e2c91455d1997ca14a7

duration: 7min
completed: 2026-10-24
status: complete
---

# Phase 2 Plan 03: 낮 토론 메시지·이모티콘·방장 조작 규칙 Summary

**낮 토론의 서버 규칙을 순수 함수로 확정했다 — 빠른 메시지·이모티콘은 낮 토론 중 생존자만 템플릿 형식대로 합산 2초에 한 번 보낼 수 있고, 방장만 낮마다 한 번 연장하고 언제든 넘길 수 있다.**

## Performance

- **Duration:** 약 7 min
- **Completed:** 2026-10-24
- **Tasks:** 3 (트레이서 1 + auto 2, 모두 TDD)
- **Files:** 신규 5(소스 3, 테스트 2), 수정 0

## Accomplishments

- `say`: 검사 순서(단계 → 보낸 사람 → 템플릿 고유 속성 → 칸 과부족 → 대상 → 직업 → 쿨다운)를 계약으로 두고 COMM-04 매트릭스를 단위 테스트로 고정. 줄은 필드별 리터럴이라 `text` 같은 키가 끼어도 줄에 들어가지 않는다(T-02-07). 보낸 사람 seat 는 actorId 로만 찾는다(T-02-08). `chat.ts` 에는 `.role` 접근이 없다.
- `emote`: `senderOf`·`coolingDown` 을 say 와 공유해 합산 쿨다운이 성립한다. 통과하면 `lastSendAt` 만 바뀌고 `messages`·`nextMessageSeq` 는 그대로다.
- `extendDiscussion`/`skipDiscussion`/`phaseDurationOf`: 방장 검사가 맨 먼저(T-02-10). 넘기기는 `tick` 을 다시 불러 진입 훅을 그대로 타고, 연장 뒤 넘겨 다음 낮 discussion 까지 tick 하면 `extendUsed` false·90000 으로 돌아오며 연장도 다시 쓸 수 있다.
- 트레이서 게이트: 자동 검증만 있는 `<verify>` 를 다시 돌려 통과(`⚡ Tracer verified end-to-end — expanding`).

## Task Commits

1. **Task 1: 트레이서 — say 검증·보관, isAlive** — RED `2572cc4` (test) → GREEN `6972f6b` (feat)
2. **Task 2: 이모티콘과 합산 쿨다운** — RED `d505295` (test) → GREEN `c306b65` (feat)
3. **Task 3: 방장 연장·넘기기, 단계 길이 파생** — RED `6e674b1` (test) → GREEN `6dc76e8` (feat)

REFACTOR 커밋은 없다(공통 앞부분 senderOf 는 Task 1 GREEN 에서 이미 뽑았다).

## TDD Gate Compliance

| Task | RED | GREEN | 증거 |
|------|-----|-------|------|
| 1 | `2572cc4` test(02-03) | `6972f6b` feat(02-03) | `gsd-tools check tdd-red-evidence` → `RED_EVIDENCE_OK`(tap, 대상 "suspect 는 target 만 담은 한 줄이 되고 키 집합이 정확하다", 42건 중 22건 실패). 뼈대 `say` 가 BAD_MESSAGE 를 돌려줘 "ok" 단언이 실패했다. import·로드 오류 아님 |
| 2 | `d505295` test(02-03) | `c306b65` feat(02-03) | `RED_EVIDENCE_OK`(대상 "여덟 아이콘이 모두 통과한다", 10건 실패). 뼈대 `emote` 가 BAD_MESSAGE 를 돌려줘 단언이 실패했다 |
| 3 | `6e674b1` test(02-03) | `6dc76e8` feat(02-03) | `RED_EVIDENCE_OK`(대상 "방장·discussion 이면 마감이 30초 늘고 extendUsed 가 true 다", 8건 실패). 뼈대가 NOT_HOST·null 을 돌려줘 단언이 실패했다 |

semanticAssessment: 세 RED 모두 대상 테스트가 실제로 실행되어 계획된 단언(통과 결과·이벤트·연장 반영)에서 의도한 이유로 실패했다. 모든 GREEN 이전에 RED 커밋이 먼저 있다.

## Files Created/Modified

- `shared/game/alive.ts` — isAlive(신규, 구조적 최소 타입)
- `shared/game/chat.ts` — 템플릿 표·say·emote(신규, 머리 주석에 순서 계약과 서버는 문장을 만들지 않는다는 원칙)
- `shared/game/discussion.ts` — extendDiscussion·skipDiscussion·phaseDurationOf(신규, 머리 주석에 "알람 재설정은 호출자(DO)의 몫" 규칙)
- `test/unit/chat.test.ts` — 단계·형식·대상·쿨다운 경계·보관·이모티콘·합산 쿨다운(신규)
- `test/unit/discussion.test.ts` — 연장·넘기기·단계 길이·다음 낮 복귀(신규)

## Decisions Made

key-decisions 참조. 가정 A1(쿨다운 위반은 lastSendAt 불변)·A2(ALREADY_EXTENDED)·A4(탈락자 BAD_MESSAGE)를 그대로 구현·테스트로 고정했다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RED 가 로드 오류가 되지 않도록 뼈대 모듈을 RED 커밋에 포함**
- **Found during:** Task 1·2·3 RED
- **Issue:** 신규 모듈이 없으면 테스트 import 가 로드 실패가 되어 INVALID_RED(`fixture_or_load_failure`) 다.
- **Fix:** Task 1 은 `alive.ts`(항상 true)·`chat.ts`(BAD_MESSAGE 반환), Task 2 는 `emote` 뼈대, Task 3 은 `discussion.ts` 뼈대를 각 RED 커밋에 함께 두고 GREEN 에서 구현으로 교체했다. test 커밋이 feat 보다 먼저인 순서는 그대로다.
- **Files modified:** `shared/game/alive.ts`, `shared/game/chat.ts`, `shared/game/discussion.ts`
- **Commit:** `2572cc4`, `d505295`, `6e674b1`

**2. [Rule 3 - Blocking] RED 증거가 Malformed TAP 이 되지 않도록 객체 비교를 한 줄 문자열 비교로 작성**
- **Found during:** Task 1 RED 작성
- **Issue:** `toEqual` 객체 비교의 여러 줄 diff 가 TAP 에 섞이면 분류기가 `invalid_record` 로 거부한다(02-02 선례).
- **Fix:** 결과를 `outcome()`(ok 또는 오류 코드)·`brief()`·JSON 문자열 한 줄로 비교하도록 처음부터 작성했다. 의미 변화 없음.
- **Files modified:** `test/unit/chat.test.ts`, `test/unit/discussion.test.ts`
- **Commit:** `2572cc4`, `6e674b1`

**3. [Rule 1 - Bug] 테스트의 null 단언이 `join` 에서 빈 문자열이 되던 것을 수정**
- **Found during:** Task 3 GREEN
- **Issue:** `phaseDurationOf` 결과 배열을 `join(",")` 하면 lobby 의 `null` 이 빈 문자열이 되어 기대값 "…,null" 과 어긋났다(구현이 아닌 테스트 버그).
- **Fix:** `rows.map(String).join(",")` 로 바꿨다.
- **Files modified:** `test/unit/discussion.test.ts`
- **Commit:** `6dc76e8`

---

**Total deviations:** 3 auto-fixed (Rule 3 x 2, Rule 1 x 1)
**Impact on plan:** 증거 형식·로드 가능성·테스트 오타 정리일 뿐 범위 확장이나 계약 변경은 없다.

## Issues Encountered

None. 계획 검증 전부 통과: `npx vitest run test/unit/chat.test.ts test/unit/discussion.test.ts`(66건), `npm run typecheck`, `npx vitest run --project unit`(22 파일, 421건). acceptance_criteria grep 전부 통과.

## Known Stubs

None. 세 모듈은 완성된 순수 함수다. 뷰(02-04)·DO 핸들러와 알람 재설정(02-05)·대상 후보 시트(02-10)는 후속 계획이다.

## Threat Flags

없음 — 새 네트워크 경로·인증·파일 접근 없음. 위협 완화 확인: T-02-07(필드별 리터럴 줄 + `text` 키 주입 테스트), T-02-08(입력에 보낸 사람 필드 없음, actorId 로 seat 조회 테스트), T-02-09(합산 2초 쿨다운·거부 불변·20개 보관), T-02-10(방장 검사 최우선·낮마다 1회 테스트), T-02-11(정수·앉은 seat·본인 아님·생존·rolesInPlay·고유 속성 검사 테스트), T-02-SC(새 패키지 없음).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 02-04 의 `buildView` 가 `phaseDurationOf(state)` 로 `phaseDurationMs` 를 만들고, `QUICK_TEMPLATES`·`isAlive` 를 화면과 공유할 수 있다.
- 02-05 DO 핸들러는 `extendDiscussion`·`skipDiscussion` 성공 뒤 반드시 알람을 다시 걸어야 한다(Pitfall 4 — discussion.ts 머리 주석). `emote` 의 `event` 는 저장 없이 방송한다.
- 02-10 시트의 대상 후보는 `isAlive`·본인 제외 규칙을 같은 기준으로 쓴다. 3페이즈는 `isAlive` 에 탈락을 더하고 탈락자 거부 코드를 확정한다(A4).

## Self-Check: PASSED
