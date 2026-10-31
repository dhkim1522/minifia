---
phase: 06-world-skeleton
plan: "06"
subsystem: nickname
tags: [nickname, grapheme, copy, bots, decision-record, e2e-relaxation]

requires:
  - phase: 06-01
    provides: scripts/bots.mjs·scripts/uat-test-bots.mjs 의 exitIfV1 가드(이 계획은 그 뒤에 이름 목록만 바꿈)
provides:
  - "shared/nickname.ts NICKNAME_MAX_GRAPHEMES = 8 (서버·클라이언트 공용, 위장 이름 거부 규칙은 그대로)"
  - "src/net/copy.ts NETWORK_TEXT export, 안내 문구 '1~8자로 입력해 주세요' 가 상수에서 나옴"
  - "JoinByLink placeholder '1~8자로 입력' 이 상수에서 나옴"
  - "테스트 봇 이름 7개 모두 정확히 8 그래핌, 세 목록 동일 (shared/game/bots.ts·scripts/bots.mjs·scripts/uat-test-bots.mjs)"
  - "docs/decisions/0056-v2-nickname8-v1-table-e2e.md (사용자 결정 a)"
affects: [06-12 이름표 부품, 06-13 이동 응답 없음 알림, 06-17 E2E 승인 완화 목록 추가, 8~9페이즈 고정 테이블 삭제]

plan_head_before: e21ddb09ee574f67e54c818e08d37177ebfe2d99
plan_head_after: 15a7d5d9117aa9acaf9e20032a0f4808066db7af

actuals:
  tokens: 5500
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "안내 문구의 숫자는 NICKNAME_MAX_GRAPHEMES 상수에서 만든다(하드코딩 제거)"
    - "스크립트(.mjs)의 배열 리터럴을 단위 테스트가 정규식으로 읽어 TS 상수와 같음을 단언"

key-files:
  created:
    - docs/decisions/0056-v2-nickname8-v1-table-e2e.md
  modified:
    - shared/nickname.ts
    - src/net/copy.ts
    - src/screens/JoinByLink.tsx
    - shared/game/bots.ts
    - scripts/bots.mjs
    - scripts/uat-test-bots.mjs
    - test/unit/nickname.test.ts
    - test/unit/copy.test.ts
    - test/unit/bots.test.ts
    - test/client/joinByLink.test.tsx
    - test/client/screens.test.tsx
    - test/worker/join.test.ts

key-decisions:
  - "Task 2 사용자 결정 a: 봇 이름 8자 적용, v1.0 고정 테이블 화면에 한해 E2E D9·D3b 를 '6자 이상 이름이 앉은 판' 범위로 승인 완화 목록에 올린다(기준 수치 불변, 8~9페이즈에 테이블과 함께 삭제). 결정 기록 0056"
  - "TextField 의 입력 버퍼 상한 32 는 닉네임 상한이 아니라 바꾸지 않았다(검증은 validateNickname)"
  - "APPROVED_RELAXATIONS 에 실제로 항목을 넣는 일은 이 계획 파일 범위 밖이라 06-17 이 한다(결정 0056 에 명시)"

requirements-completed: [MAP-07]

coverage:
  - id: D1
    description: "닉네임 1~8 그래핌: 8자 통과·9자 TOO_LONG, 전각·결합 문자·이모지 8개 통과, 채움·영폭 문자 거부 유지"
    requirement: MAP-07
    verification:
      - kind: unit
        ref: "test/unit/nickname.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "서버(참가 API)와 클라이언트가 같은 shared 규칙을 써서 9글자 참가가 400 NICKNAME_INVALID, 8글자는 통과"
    requirement: MAP-07
    verification:
      - kind: integration
        ref: "test/worker/join.test.ts#9글자 닉네임 참가는 400 NICKNAME_INVALID, 8글자는 통과"
        status: pass
    human_judgment: false
  - id: D3
    description: "안내 문구 '1~8자로 입력해 주세요'·placeholder '1~8자로 입력', NETWORK_TEXT export"
    requirement: MAP-07
    verification:
      - kind: unit
        ref: "test/unit/copy.test.ts, test/client/joinByLink.test.tsx, test/client/screens.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "봇 이름 7개 모두 정확히 8 그래핌·규칙 통과·비교 키 중복 없음, 세 목록 동일"
    requirement: MAP-07
    verification:
      - kind: unit
        ref: "test/unit/bots.test.ts#BOT_NAMES"
        status: pass
    human_judgment: false
  - id: D5
    description: "v1.0 고정 테이블의 8자 이름표 겹침을 E2E 가 어떻게 다룰지 사용자 결정(a)과 기록"
    requirement: MAP-07
    verification: []
    human_judgment: true
    rationale: "E2E 완화 범위는 사용자 승인 사안이다. 결정 0056 이 승인 내용을 담고, 실제 목록 반영과 실패 목록 측정은 06-17 이 한다"
  - id: D6
    description: "머리 위 이름표의 말줄임 없음(8자)"
    requirement: MAP-07
    verification: []
    human_judgment: false
    rationale: "06-12(이름표 부품)와 06-17(E2E)이 확인한다. 이 계획 몫 아님"

duration: 약 25min
completed: 2026-11-01
status: complete
---

# Phase 6 Plan 06: 닉네임 8자와 봇 이름 Summary

**NICKNAME_MAX_GRAPHEMES 를 5 → 8 로 바꾸고 안내 문구를 상수에서 만들며, 사용자 결정 a 에 따라 봇 이름 7개를 8 그래핌으로 바꾸고 결정 0056 을 남겼다**

## Accomplishments

- `shared/nickname.ts` 상한 8. 서버(방 만들기·참가)와 클라이언트가 같은 파일을 쓰므로 동시에 적용된다. 보이지 않는 문자·채움 문자·비교 키·중복 금지 규칙은 건드리지 않았고, 새 테스트가 8자 안에 채움·영폭 문자가 섞이면 여전히 INVALID_CHARS 임을 고정한다(T-06-12).
- `src/net/copy.ts` 의 `NICKNAME_RANGE_TEXT` 와 `JoinByLink` placeholder 를 `NICKNAME_MAX_GRAPHEMES` 에서 만들고 `NETWORK_TEXT` 를 export(06-13 용).
- 봇 이름: 봇가나다라마바사 · 봇아자차카타파하 · 봇갸냐댜랴먀뱌샤 · 봇야쟈챠캬탸퍄햐 · 봇거너더러머버서 · 봇어저처커터퍼허 · 봇고노도로모보소. 세 목록이 같음을 `bots.test.ts` 가 스크립트 텍스트에서 읽어 비교한다.
- 결정 기록 `docs/decisions/0056-v2-nickname8-v1-table-e2e.md` (번호는 `ls docs/decisions` 상 다음 번호 0056 그대로).

## Task 2 사용자 결정 (체크포인트 해결)

오케스트레이터가 실행 전에 사용자에게 물었고 답은 **a** 였다: 봇 이름 8자 적용, v1.0 고정 테이블 화면에 한해 D9·D3b 를 "6자 이상 이름이 앉은 판" 범위로 승인 완화 목록에 올린다. 기준 수치는 바꾸지 않는다. 그래서 `DayTable`·`daytable.css`·`REQUIREMENTS.md` 는 건드리지 않았다(각각 b·c 갈래 몫).

## Task Commits

1. **Task 1 (tracer, TDD)** — RED `6e43c0f` (test: 14개 실패, 단언 실패) → GREEN `ecca557` (feat)
2. **Task 2 (checkpoint:decision)** — 사용자 답 a, 커밋 없음
3. **Task 3 (TDD)** — RED `0173ba8` (test: 봇 이름 8 그래핌 단언 실패) → GREEN `15a7d5d` (feat, 봇 이름·결정 0056·worker 테스트)

트레이서 게이트: 자동 모드 여부와 무관하게 `<verify>` 둘(대상 4개 테스트 파일 131개, `--project unit` 1615개)이 GREEN 직후 통과해 확장(Task 3)으로 넘어갔다.

## Verification

- `npx vitest run` 전체: 123 파일 3367 통과, 1 skip(기존).
- `npm run typecheck` 통과.
- 인수 기준: `NICKNAME_MAX_GRAPHEMES = 8` PASS, `export const NETWORK_TEXT` PASS, `git grep "1~5자" -- src shared` 없음 PASS, `test(06-06)` 커밋 존재 PASS, 결정 기록 파일 1건 PASS, 세 목록 `봇가나다라마바사` PASS.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 서버 참가 테스트가 5자 경계를 단언**
- **Found during:** Task 3 전체 테스트 실행 직전 `git grep` 점검 (Task 1 의 `--project unit` 은 worker 프로젝트를 돌리지 않아 놓침)
- **Issue:** `test/worker/join.test.ts` 가 6글자 거부·5글자 통과(결정 0017-4)를 단언해 상한 변경 후 깨질 상태
- **Fix:** 9글자 거부·8글자 통과(결정 0052-1)로 바꿈
- **Files modified:** test/worker/join.test.ts
- **Commit:** `15a7d5d`

**2. [Rule 3 - 보조] 계획에 없던 테스트 갱신**
- `test/unit/nickname.test.ts` 의 "6글자는 TOO_LONG" 과 `test/client/screens.test.tsx` 의 "6글자 닉네임" 입력값을 9글자로 바꿈(상한 변경의 직접 결과, 계획 files 목록 안의 파일).

**Total deviations:** 1 auto-fixed (Rule 1), 1 보조. **Impact:** 범위 변화 없음.

## Issues Encountered

- 계획 지시의 `gsd-plan-head-before-06-06` 원장 파일이 첫 커밋 전에 만들어지지 않아 RED 커밋 직후 `HEAD~1`(e21ddb0)로 기록했다. 값은 이 계획 시작 시점의 HEAD 와 같다.
- `gsd check tdd-red-evidence` 는 실행하지 않았다(셸 함수 미사용 환경). 대신 RED 단계 실패가 모두 단언 실패(`expected ... to be ...`)임을 출력으로 확인했다.

## Known Stubs

없음.

## Deferred / 다음 계획에 넘기는 것

- 06-17: `scripts/e2e/lib.mjs` `APPROVED_RELAXATIONS` 에 D9·D3b 를 "v1.0 고정 테이블 화면 + 6자 이상 이름" 범위로 추가하고 `lib.test.mjs` 로 고정. 잰 실패가 D9·D3b 를 넘으면 사용자에게 다시 묻는다(결정 0056).
- 이 계획 이후 8자 봇 이름이 v1.0 고정 테이블 E2E 를 깰 수 있으나, 06-17 의 완화 항목이 들어가기 전까지는 `npm run e2e` 가 D9·D3b 에서 실패할 수 있다.
- 8~9페이즈: 고정 테이블과 함께 완화 항목 삭제.

## Threat Flags

없음 (패키지 설치 없음, 새 네트워크 표면 없음).

## Self-Check: PASSED

- 파일 존재: shared/nickname.ts, src/net/copy.ts, docs/decisions/0056-v2-nickname8-v1-table-e2e.md 확인.
- 커밋 존재: 6e43c0f, ecca557, 0173ba8, 15a7d5d 모두 HEAD 의 조상.
