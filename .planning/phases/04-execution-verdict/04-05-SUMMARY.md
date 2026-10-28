---
phase: 04-execution-verdict
plan: 05
subsystem: game-server
tags: [chat, defense, templates, phrases, execution, tdd, pure-rules]

requires:
  - phase: 04-execution-verdict
    provides: "04-01 의 PhaseId 여섯 개·EXECUTION_PHRASE_COUNT·RoomState.verdict, 04-04 의 처형 진입 훅과 문구 추첨"
provides:
  - "변론 템플릿 여섯 개(defNotMe·defCitizen·defSuspect·defTrust·defRole·defPlead): TEMPLATE_IDS·QUICK_TEMPLATES(때 defense)·TEMPLATE_CHIP·messageText"
  - "chat.ts: 투표 두 단계·변론의 메시지 허용, 변론 중 say 는 verdict.candidate 만, 단계 → 때 함수 whenOf"
  - "DEFENSE_TEMPLATE_ORDER (D-13 번호 순서)"
  - "아침 탈락 문구 일곱 개(MORNING_PHRASE_COUNT 7), EXECUTION_TAILS(D-11 네 문장)·executionTitle"
affects: [04-06, 04-07, 04-09, 화면 계획(변론 패널·처형 카드)]

actuals:
  tokens: 7000
  tasks: 2
  commits: 6
plan_head_before: 56531b6402b92ee017f3d102ea12989714779107
plan_head_after: 1b2723d7244d94bc69c628d62dd6dc26e4ea9c7c
commits: 6

tech-stack:
  added: []
  patterns:
    - "템플릿의 쓸 수 있는 때(when)는 단계 → 때 함수 하나(whenOf)로 판정한다: night → night, defense → defense, 그 밖 → day"
    - "보낼 수 없는 사람의 거부는 WRONG_PHASE 한 규칙(밤의 비마피아와 변론의 비후보가 같은 코드) — 역할 정보를 주지 않는다"
    - "문구 표 길이는 서버 번호 상수와 단위 테스트로 묶는다(MORNING_PHRASE_COUNT·EXECUTION_PHRASE_COUNT)"

key-files:
  created: []
  modified:
    - shared/protocol.ts
    - shared/game/chat.ts
    - src/game/messageText.ts
    - src/game/eliminationText.ts
    - test/unit/chat.test.ts
    - test/unit/messageText.test.ts
    - test/unit/eliminationText.test.ts
    - test/unit/night.test.ts
    - test/client/morning.test.tsx
    - test/client/phaseScreens.test.tsx
    - design/screens/night-v1/SPEC.md
    - HANDOFF.md

key-decisions:
  - "변론 템플릿은 새 ID 여섯 개로 두고 기존 innocent 와 문구가 같아도 따로 둔다(when 이 한 값이라 판정이 단순하다, A11)"
  - "비후보의 변론 say 는 WRONG_PHASE, 후보 검사는 say 안에서 보낸 사람 확인 직후에 한다(이모티콘은 단계 검사만 거치므로 통과)"
  - "verdict 가 없는 변론 단계의 생존자 say 는 모두 WRONG_PHASE(후보가 정해지지 않음)"
  - "공개 구간·처형·종료는 SAY·EMOTE 단계 집합에 넣지 않아 탈락자도 WRONG_PHASE (A3)"

requirements-completed: []
requirements-server-rules-done: [COMM-03, VOTE-03, VOTE-04]  # 서버 규칙·문장 표만. 변론 패널·처형 카드 화면은 UI-SPEC 뒤 화면 계획 몫이라 REQUIREMENTS 체크박스는 열어 둔다

coverage:
  - id: D1
    description: "변론 템플릿 여섯 개가 TEMPLATE_IDS 16개·QUICK_TEMPLATES(대상·직업 칸·때 defense)·칩·문장 표에 있고 문장이 D-13 확정 문구와 같다"
    requirement: "COMM-03"
    verification:
      - kind: unit
        ref: "test/unit/chat.test.ts#QUICK_TEMPLATES - 템플릿 표 (D-11, COMM-01)"
        status: pass
      - kind: unit
        ref: "test/unit/messageText.test.ts#변론 문장 (D-13, COMM-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "최후 변론 중 후보만 변론 템플릿을 보낸다: 비후보 생존자 say 는 WRONG_PHASE, 후보의 낮 템플릿은 BAD_MESSAGE, 탈락자는 BAD_MESSAGE, verdict 없으면 WRONG_PHASE, 이모티콘은 생존자 누구나"
    requirement: "COMM-03"
    verification:
      - kind: unit
        ref: "test/unit/chat.test.ts#최후 변론 - 후보만 (COMM-03, VOTE-03, D-13, T-04-14)"
        status: pass
    human_judgment: false
  - id: D3
    description: "투표 두 단계는 생존자의 낮 템플릿·이모티콘만 통과하고(밤·변론 템플릿 BAD_MESSAGE), 공개·처형·종료는 누구의 say·이모티콘도 WRONG_PHASE, 합산 쿨다운 1.8초 유지"
    requirement: "VOTE-03"
    verification:
      - kind: unit
        ref: "test/unit/chat.test.ts#투표 두 단계의 메시지 (D-12, 결정 0036)"
        status: pass
      - kind: unit
        ref: "test/unit/chat.test.ts#공개·처형·종료 단계는 전면 거부 (A3, T-04-16)"
        status: pass
    human_judgment: false
  - id: D4
    description: "아침 문구 일곱 개(옮긴 문장 없음), 처형 문구 네 개와 두 제목 함수(항상 '님이', 범위 밖은 첫 문구), 길이가 서버 상수와 같다"
    requirement: "VOTE-04"
    verification:
      - kind: unit
        ref: "test/unit/eliminationText.test.ts#EXECUTION_TAILS · executionTitle (VOTE-04, D-11)"
        status: pass
      - kind: unit
        ref: "test/unit/eliminationText.test.ts#ELIMINATION_TAILS"
        status: pass
      - kind: component
        ref: "test/client/morning.test.tsx + test/client/phaseScreens.test.tsx (새 첫 문구 제목·안내)"
        status: pass
    human_judgment: false

duration: 약 25분
completed: 2026-10-28
status: complete
---

# Phase 4 Plan 05: 변론 템플릿·처형 문구 표 Summary

**변론 템플릿 여섯 개를 와이어·서버 검증·문장 표에 더해 최후 변론은 후보만 보낼 수 있게 하고, 투표·공개·처형·종료 단계의 메시지 허용 규칙을 고정했으며, 아침 탈락 문구를 일곱 개로 줄이고 처형 문구 네 개와 제목 함수를 만들었다.**

## 진행 기록

Task 1 — RED 2a91572 / GREEN 86c4ba2 / chat·messageText 119 통과, `npm test` 84 파일 2011 통과, tsc app·worker 0 / 체크포인트 4a08c68.
Task 2 — RED 3d5f32c / GREEN f1f1e65 / `npm test` 84 파일 2016 통과, tsc app·worker 0 / 남은 태스크 없음. HANDOFF 진행 줄 1b2723d, 웨이브 1~3 push 완료(`5b62679..1b2723d`).

## Accomplishments

- `shared/protocol.ts`: `TEMPLATE_IDS` 에 변론 여섯 ID(열 개 → 열여섯 개), `MORNING_PHRASE_COUNT` 8 → 7(결정 0036 9항 주석).
- `shared/game/chat.ts`: `QUICK_TEMPLATES` 때 유니온에 `defense` 와 여섯 행, `SAY_PHASES`·`EMOTE_PHASES` 에 `execVote`·`candidateVote`·`defense`, 단계 → 때 함수 `whenOf`, say 안에서 보낸 사람 확인 직후 "변론 단계이고 후보가 아니면 WRONG_PHASE". 공개 구간·처형·종료는 단계 집합에 넣지 않았다.
- `src/game/messageText.ts`: 변론 칩 여섯 줄, `messageText` 여섯 case(`defRole` 은 `ROLE_TEXT` 이름, 비면 `[직업]`), `DEFENSE_TEMPLATE_ORDER`. 칩 목록을 시트에 연결하지 않았다(화면 계획 몫).
- `src/game/eliminationText.ts`: `ELIMINATION_TAILS` 일곱 개, `EXECUTION_TAILS`(D-11 네 문장)와 `executionTitle`. 옮긴 문장은 아침 표·주석 어디에도 남기지 않았다.
- `design/screens/night-v1/SPEC.md`: 아침 문구 목록을 일곱 개로 다시 번호 매기고 낮 처형 문구 줄을 확정 문구로 바꿨다. `.dc.html` 시안 사본은 그대로 뒀다.

## TDD 기록

**Task 1 RED** (`test(04-05)`, 2a91572): `npx vitest run test/unit/chat.test.ts test/unit/messageText.test.ts --reporter=tap-flat`, 종료 코드 1. 새 TemplateId 가 없는 상태에서 19개 실패(표 행·개수, 투표 두 단계 `WRONG_PHASE` 기대와 불일치, 변론 후보 규칙, 변론 문장·칩·`DEFENSE_TEMPLATE_ORDER` 가 undefined). 기존 케이스는 모두 통과. 실패 이유는 모두 의도한 기능 부재다(모듈 로드·픽스처 실패 아님).
**Task 1 GREEN** (86c4ba2): 119/119 통과, 전체 `npm test` 통과.

**Task 2 RED** (`test(04-05)`, 3d5f32c): `npx vitest run test/unit/eliminationText.test.ts test/client/morning.test.tsx test/client/phaseScreens.test.tsx --reporter=tap-flat`, 종료 코드 1. 88개 중 15개 실패(길이 7 기대, 일곱 문장 순서, 새 첫 문구 제목·안내, `EXECUTION_TAILS`·`executionTitle` 가 없어 TypeError). 나머지 73개는 통과.
**Task 2 GREEN** (f1f1e65): 대상 4파일 통과 후 전체 `npm test` 2016 통과.

**REFACTOR**: 없음.

## Verification

| 명령 | 결과 |
|---|---|
| `npx vitest run test/unit/chat.test.ts test/unit/messageText.test.ts` | 2 파일 119 passed |
| `npx vitest run test/unit/eliminationText.test.ts test/client/morning.test.tsx test/client/phaseScreens.test.tsx test/unit/night.test.ts` | 4 파일 passed |
| `npm test` | 84 파일 2016 passed, 실패 0 |
| `npx tsc -p tsconfig.app.json --noEmit` | 종료 코드 0 |
| `npx tsc -p tsconfig.worker.json --noEmit` | 종료 코드 0 |
| `npx vitest run test/unit/handoff.test.ts` | 2 passed, HANDOFF 2729바이트 |

수용 기준 그렙: `"defNotMe"` protocol.ts 1, `when: "defense" as const` chat.ts 6, `DEFENSE_TEMPLATE_ORDER` messageText.ts 1, 옛 문장 `이슬이 되어 사라졌습니다` eliminationText.ts·SPEC.md 각 0, `MORNING_PHRASE_COUNT = 7` 1, `EXECUTION_TAILS` 내보내기 1, `executionTitle` 내보내기 1, `형장의 이슬이 되었습니다` 1. `test(04-05)` 커밋이 각 `feat(04-05)` 커밋보다 먼저다.

**웨이브 1~3 push**: 조건 ① `04-02-SUMMARY.md` 존재 ② app·worker tsc 0, `npm test` 84 파일 2016 통과 ③ 메인 작업 트리(`git-dir` `.git`)의 `main` 확인 후 `git push origin main`(개인 원격, 개인 SSH 설정) 으로 올렸다(`5b62679..1b2723d`, 27 커밋). 푸시 뒤 `git status -sb` 첫 줄에 "ahead" 없음. 배포는 하지 않았다(D-26).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 회귀 이전] night.test.ts 의 하드코딩된 문구 상수**
- **Found during:** Task 2 GREEN (`npm test`)
- **Issue:** `test/unit/night.test.ts` "난수 계약" 테스트가 `[2,8]`·`[2,7]` 을 문자열로 단언해 `MORNING_PHRASE_COUNT` 가 7 이 되자 실패했다(계획의 파일 목록 밖이지만 verify 명령에 포함된 파일).
- **Fix:** 같은 파일 다른 단언처럼 `MORNING_PHRASE_COUNT` 상수로 바꿨다(단언 강도 유지). 테스트 이름도 상수 표기로 고쳤다.
- **Files modified:** test/unit/night.test.ts
- **Commit:** f1f1e65

**2. [Rule 1 - 테스트 버그] 변론 헬퍼의 기본 인자**
- **Found during:** Task 1 GREEN
- **Issue:** RED 테스트의 `defense(overrides, candidate = 1)` 에 `undefined` 를 넘기면 기본값이 적용돼 "verdict 없음" 케이스가 만들어지지 않았다.
- **Fix:** 후보 없음을 `null` 로 표현하게 헬퍼를 고쳤다.
- **Files modified:** test/unit/chat.test.ts
- **Commit:** 86c4ba2

**3. [계획 범위 내 보정] morning.test.tsx 의 번호**
- `phase 4 → 차갑게 식은 채 발견되었습니다` 케이스는 번호가 한 칸 당겨져 `phase 3` 으로 옮겼다(문장 단언 그대로).

**Total deviations:** 3 (Rule 1 ×2, 번호 보정 ×1). **Impact:** 범위 변화 없음.

## Known Stubs

없음. 변론 칩 목록(`DEFENSE_TEMPLATE_ORDER`)과 `executionTitle` 은 아직 화면에 연결되지 않았다. 계획이 명시한 대로 변론 패널·처형 카드는 시안 승인 → `/gsd-ui-phase 4` 뒤 화면 계획 몫이다(스텁이 아니라 후속 연결 대상).

## Threat Flags

없음. T-04-14(비후보 변론)는 `say` 의 후보 검사와 테스트로 닫았다(소켓 수준은 04-07). T-04-15(프로토타입 키)는 기존 `Object.hasOwn` 방어를 유지했고 새 ID 는 `z.enum(TEMPLATE_IDS)` 로만 들어온다. T-04-16(변론 도배)은 합산 쿨다운 1.8초 그대로이고 공개·처형·종료 전면 거부 테스트가 있다. 새 패키지 설치 없음(T-04-SC).

## Next Phase Readiness

Ready for 04-06. 열린 방의 옛 번들이 받는 아침 문구 번호 어긋남은 계획대로 최대 3시간·무해(범위 밖 번호는 첫 문구)로 받아들였다. `test/worker/leak.test.ts` 405행의 phrase 범위 하드코딩 8 은 이 계획에서 건드리지 않았다(04-09 이 상수로 바꾼다). 소켓 수준 후보 검사·변론 메시지 수신은 04-07 몫이다. 화면 계획이 `DEFENSE_TEMPLATE_ORDER`·`executionTitle` 을 소비한다.

## Self-Check: PASSED

- 수정 파일 존재: `shared/game/chat.ts`, `src/game/messageText.ts`, `src/game/eliminationText.ts`, `design/screens/night-v1/SPEC.md` 확인.
- 커밋 존재: 2a91572, 86c4ba2, 4a08c68, 3d5f32c, f1f1e65, 1b2723d 모두 HEAD 의 조상.
