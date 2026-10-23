---
phase: 01-walking-skeleton
plan: 15
subsystem: nickname-rules
tags: [nickname, cr-01, in-07, gap-closure, tdd, unicode]
status: complete
gap_closure: true

requires:
  - phase: 01-walking-skeleton
    provides: "01-03 닉네임 규칙(shared/nickname.ts)과 joinRoom 의 key 한 줄 판정, 01-VERIFICATION.md GAP-1(CR-01)"
provides:
  - "nicknameKey 가 채움 문자 5개·ZWJ·변형 선택자·결합 문자(M)를 지우고 NFKC 를 다시 적용해 위장 이름이 원래 이름과 같은 키가 된다"
  - "채움 문자(U+115F U+1160 U+3164 U+FFA0 U+2800)는 위치와 무관하게 INVALID_CHARS, 키가 비는 값(U+FF9E)도 INVALID_CHARS"
  - "shared/nickname.ts 소스에 보이지 않는 리터럴이 없다(IN-07) — 모든 특수 문자가 중괄호 코드 포인트 이스케이프"
affects: [1페이즈 재검증(gaps_found -> human_needed), 이후 페이즈의 투표·지목(이름이 공개 식별자)]

actuals:
  tokens: 2600
  tasks: 2
  commits: 4
plan_head_before: a84cd659f6941881c36983fbb1841b13358f3c83
plan_head_after: 358065c2cd19cf056e0ec0f507eabf44e79750bd

tech-stack:
  added: []
  patterns:
    - "키 계산용 전역 정규식(KEY_IGNORED_CHARS, replace 전용)과 검사용 비전역 정규식(INVISIBLE_FILLER, test 전용)을 분리해 lastIndex 오염을 피한다"
    - "표시 닉네임은 정규화 결과 그대로, 위장 방어는 비교 키에서만 한다"

key-files:
  created: []
  modified:
    - shared/nickname.ts
    - test/unit/nickname.test.ts
    - test/unit/gameRoom.test.ts
    - test/worker/join.test.ts

key-decisions:
  - "채움 문자는 위치와 무관하게 금지한다(01-REVIEW.md CR-01 Fix 제안). 글자 사이에 섞인 채움 문자가 만드는 '보이는 모습과 키의 어긋남' 위장 경로를 없앤다"
  - "ZWJ·변형 선택자·결합 문자는 표시 이름에 남기고 비교 키에서만 지운다. 키가 더 넓게 겹치는 쪽은 받아들인다(NICKNAME_TAKEN 으로 다른 이름을 고르게 할 뿐)"

requirements-completed: [ROOM-02]
---

# Phase 1 Plan 15: CR-01 닉네임 비교 우회·IN-07 이스케이프 Summary

**닉네임 비교 키가 ZWJ·변형 선택자·결합 문자·한글 채움 문자를 무시하고, 채움 문자 이름과 키가 비는 이름을 거부하도록 shared/nickname.ts 한 파일을 고쳐 "철"+ZWJ+"수" 같은 위장 중복 이름을 서버(방 규칙·HTTP)에서 막았다.**

## 결과 요약

| 항목 | 값 |
| --- | --- |
| 태스크 | 2/2 (트레이서 1 + 자동 1) |
| 커밋 | 4 (test 2 + feat 2, 각 태스크 test 가 feat 보다 먼저) |
| 전체 테스트 | 40 files, 617 tests 통과 (기준선 588 에서 +29) |
| 타입 검사 | `npm run typecheck` exit 0 |
| 고치지 않은 파일 | shared/game/room.ts, worker/, src/ (BASE 대비 diff 없음) |

## 태스크별 기록

### Task 1 (tracer) — ZWJ 한 경로

- RED `0110a16`: nickname 단위·joinRoom 방 규칙(순서 양방향)·HTTP 참가 409 케이스 추가. 4개 실패. `gsd-tools check tdd-red-evidence` 결과 `RED_EVIDENCE_OK`(target_test_failed).
  - semanticAssessment: 대상 테스트 "CR-01: ZWJ 를 끼운 이름은 원래 이름과 같은 키다" 가 키 비교 `toBe` 에서 실패(실제 값에 ZWJ 가 남음). 방 규칙·HTTP 케이스도 같은 이유로 실패. 설정·로드 오류 아님.
- GREEN `a1934a6`: ZWJ 상수 리터럴을 `"\u{200D}"` 로 교체, `KEY_IGNORED_CHARS`(이 시점엔 ZWJ 하나) 추가, nicknameKey 가 NFKC 뒤 지운다. 80 tests 통과. 트레이서 게이트(자동 모드 아님, 인터랙티브): `<verify>` 가 자동 검증뿐이라 재실행 통과로 확장 진행.

### Task 2 — 나머지 변형 입력

- RED `58def63`: 변형 선택자·결합 문자·자모 재결합 키, 채움 문자 5개와 섞임·공백·반복(TOO_LONG 아님), U+FF9E 빈 키, 방 규칙(joinRoom·createRoomState), HTTP 409/400, 정상 입력 회귀(하트·무지개 깃발·피부색·한글 음절·NFD 한·가족 이모지 8개). 19개 실패, 회귀 케이스는 RED 시점에도 초록(현재 동작 고정). `RED_EVIDENCE_OK`.
  - semanticAssessment: 대상 "CR-01: 변형 선택자(U+FE0F)를 끼운 이름은 원래 이름과 같은 키다" 가 키 비교 단언에서 실패. 채움 문자·빈 키 케이스는 `ok` 가 나와 INVALID_CHARS 단언에서 실패. 모두 계획한 이유.
- GREEN `358065c`: `KEY_IGNORED_CHARS` 를 채움 문자 5개·U+200D·U+FE00–FE0F·`\p{M}` 로 확장, nicknameKey 를 NFKC → 제거 → NFKC → 소문자로, 비전역 `INVISIBLE_FILLER` 를 hasForbiddenChar 에 추가, validateNickname 에서 키가 비면 INVALID_CHARS(길이 검사보다 앞). 파일 머리 주석 한국어 갱신.

## 수용 기준 확인

- `\u{200d}`·`\u{3164}`·`\u{2800}`·`\p{M}`·`KEY_IGNORED_CHARS`(2)·`INVISIBLE_FILLER`(2)·두 번째 NFKC(2) 모두 shared/nickname.ts 에서 확인.
- 보이지 않는 리터럴 perl 검사: shared/nickname.ts 0(기준선 1), nickname.test.ts 4(기준선 4 그대로), gameRoom.test.ts 1(BASE 와 동일), join.test.ts 0.
- `git diff --numstat BASE`: 테스트 세 파일 삭제 줄 0(추가만), `git diff --quiet BASE -- shared/game/room.ts worker src` exit 0, `p.nicknameKey === checked.key` 1건 그대로.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 워크트리 베이스가 계획 파일보다 앞섬**
- **Found during:** 시작 시
- **Issue:** 워크트리 HEAD(d176884)에 01-15-PLAN.md 가 없었다(main 의 a84cd65 에만 있음).
- **Fix:** main 이 HEAD 의 직계 후손(docs 커밋 2건만 차이)임을 확인하고 `git merge --ff-only main` 으로 맞췄다. BASE(plan_head_before)는 a84cd65.
- **Files modified:** 없음(문서 커밋만 따라옴)

**2. [Rule 3 - Blocking] 워크트리에 node_modules 없음**
- **Fix:** `npm ci`(잠금 파일 기준, 새 패키지 없음)로 설치.

그 외 계획대로 실행했다.

### 구현 메모

- 방 규칙 테스트에서 "채움 문자 → NICKNAME_INVALID" 를 방장(createRoomState)과 참가(joinRoom) 양쪽에 두었다.
- 이스케이프 규칙 때문에 모든 새 테스트·소스 리터럴을 `\u{...}` 로 썼다. 기존 shared/nickname.ts 의 ZWJ 리터럴은 perl 치환으로 이스케이프로 바꿨다.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크·인증·파일 접근 표면 없음. 계획의 T-01-53~56 은 테스트로 고정됐고 T-01-57(옛 키가 남은 방)은 계획대로 accept(재배포 범위 밖).

## 후속

- 재배포는 이 계획 범위 밖이라 하지 않았다. 재배포 전까지 배포본은 옛 규칙이다.
- 1페이즈 재검증(`/gsd-verify-work` 또는 verifier)에서 CR-01 재현 입력 4개 확인 필요.

## Self-Check: PASSED

- FOUND: shared/nickname.ts, test/unit/nickname.test.ts, test/unit/gameRoom.test.ts, test/worker/join.test.ts
- FOUND commits: 0110a16, a1934a6, 58def63, 358065c
