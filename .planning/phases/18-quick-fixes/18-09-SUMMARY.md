---
phase: 18-quick-fixes
plan: "09"
subsystem: e2e-outfit
tags: [e2e, dress-lock, outfit-unique, trace-mark, tracer, tdd, sc-1, sc-5]
status: complete

requires:
  - phase: 18-quick-fixes
    provides: "18-01 시작 때 겹친 옷 해소(resolveLookConflicts)와 서버 잠금(lockedOutfits)"
  - phase: 18-quick-fixes
    provides: "18-05 DressSheet 잠긴 카드(data-taken·aria-disabled)"
  - phase: 18-quick-fixes
    provides: "18-08 E2E 판정 묶음 방식(순수 함수 + 읽기 필드 + 흐름 기록)"
provides:
  - E2E 순수 판정 dressLockChecks(AL1~AL3)·outfitUniqueChecks(OU1·OU2)
  - AVATAR_MARKERS 8개("data-taken" 추가)와 lib.test·e2eContract 동기화
  - avatar-dress 잠금 단계(방장 시트의 잠긴 카드 읽기 + 잠긴 카드 누름 뒤 방장 옷 확인), trace 흐름 아침 흔적 구간의 OU 기록
  - 로컬 avatar-dress·trace·errand·witness 폰 6종 전부 통과(실패 0, 간헐 재실행 없음)
affects: [18-10]

actuals:
  tokens: 3400
  tasks: 2
  commits: 4

plan_head_before: 6fa8b4011c0ad6d5389647659dd0205b151220e0
plan_head_after: 3f51f4f41865f2229e092e5ac39cecd06a46c0e5
commits: 4

tech-stack:
  added: []
  patterns:
    - "aria-disabled 카드를 누르는 E2E 는 Playwright 의 enabled 대기를 피하려 force 클릭을 쓴다(실제 누름 이벤트는 그대로 가고, 앱이 무시하는지가 판정 대상)"
    - "잠금 판정의 afterTap 은 서버 view 의 내 look 과 __mfLooks 훅이 일치할 때만 그 값을 쓴다(어긋나면 'view|훅' 으로 실패시킴)"

key-files:
  created: []
  modified:
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - test/unit/e2eContract.test.ts
    - scripts/e2e/avatar.mjs
    - scripts/e2e/errand.mjs
    - scripts/e2e/browser.mjs

key-decisions:
  - "방장 시트는 AD4(방장이 noir 선택) 직후 아직 열려 있으므로 다시 열지 않고 그 자리에서 AL 을 읽었다(계획은 '다시 열어 읽는다'였으나 열려 있는 시트를 읽는 것과 같다)"
  - "OU2 의 표시 좌석은 방장 화면의 data-trace-mark(morningMarks[0].trace)를 쓴다 — TC7 이 모든 사람이 같은 집합을 본다는 것을 이미 확인(TR7)한다"
  - "표식 목록과 시험 두 곳은 RED 커밋에서 먼저 8개로 바꾸고 GREEN 에서 lib.mjs 를 맞췄다(T-18-22)"

requirements-completed: [SC-1, SC-5]

coverage:
  - id: D1
    description: "avatar-dress 폰 6종: 손님이 mafia 를 고르면 방장 옷장의 mafia 카드만 data-taken 이고, 눌러도 1.5초 뒤 방장 옷이 noir 그대로이며 내 옷·coat 카드는 잠기지 않는다(AL1~AL3)"
    requirement: "SC-1"
    verification:
      - kind: unit
        ref: "scripts/e2e/lib.test.mjs#dressLockChecks AL1~AL3"
        status: pass
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 --only avatar-dress (AL1~AL3, 폰 6종 35/35)"
        status: pass
    human_judgment: false
  - id: D2
    description: "trace 폰 6종 아침 흔적 구간: 앉은 사람 모두의 옷이 서로 다르고(OU1) 같은 옷 표시 이름표가 많아야 1개(OU2)"
    requirement: "SC-1"
    verification:
      - kind: unit
        ref: "scripts/e2e/lib.test.mjs#outfitUniqueChecks OU1·OU2"
        status: pass
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 --only trace,errand,witness (OU1·OU2, 폰 6종 trace 53/53)"
        status: pass
    human_judgment: false
  - id: D3
    description: "AVATAR_MARKERS 8개와 lib.test·e2eContract 동기화, 증거 행 읽기에서 옛 숫자 0 선택자(.mv-evidence__zero) 제거"
    requirement: "SC-5"
    verification:
      - kind: unit
        ref: "test/unit/e2eContract.test.ts#AVATAR_MARKERS 가 8개이고 각 표식이 src 에 있다"
        status: pass
      - kind: command
        ref: "grep -c mv-evidence__zero scripts/e2e/browser.mjs → 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "바뀐 흐름 avatar-dress·trace·errand·witness 가 로컬 폰 6종에서 통과"
    requirement: "SC-5"
    verification:
      - kind: e2e
        ref: "로컬 E2E 결과 표(아래) — 실패 줄 0"
        status: pass
    human_judgment: false
---

# Phase 18 Plan 09: 옷 중복 해소와 옷장 잠금 E2E 확인 Summary

avatar-dress 에서 다른 참가자가 고른 옷만 방장 옷장에 잠기고 눌러도 옷이 안 바뀌는 것(AL1~AL3)을, trace 에서 한 판 옷이 모두 다르고 같은 옷 표시 이름표가 많아야 1개인 것(OU1·OU2)을 순수 판정 함수와 폰 6종 실제 흐름으로 확인했다.

## 수행한 일

- **Task 1 (트레이서, avatar-dress 한 길):** `dressLockChecks` 와 `AVATAR_MARKERS` 의 `data-taken` 을 더하고, avatar-dress 가 AD4 직후 방장 시트의 카드별 `taken·disabled·pressed` 를 읽고(`readDressUi.cardStates`) 잠긴 mafia 카드를 눌러 1.5초 뒤 방장 옷을 서버 view·`__mfLooks` 로 읽어 판정한다. 폰 6종 통과 뒤에야 Task 2 로 넘어갔다.
- **Task 2:** `outfitUniqueChecks` 를 더하고 traceFlow 아침 흔적 구간(TC7 과 같은 순간)에서 방장 view 와 방장 화면의 표시 좌석으로 한 번 기록한다. `readTrace` 의 증거 행 읽기에서 18-04 가 없앤 `.mv-evidence__zero` 를 뺐다.

## TDD 증거 (RED)

- Task 1 RED(`cb9e83ff`): `node --test scripts/e2e/lib.test.mjs` 에서 `AVATAR_MARKERS` 목록 시험(7개 ≠ 8개, `data-taken` 없음)과 `dressLockChecks AL1~AL3`(자리 함수가 `''` 를 돌려 `'' !== 'AL1,AL2,AL3'`)이 단언에서 실패했다. `npx vitest run test/unit/e2eContract.test.ts` 는 `expected 7 to be 8` 로 실패했다.
- Task 2 RED(`bd531fc3`): `outfitUniqueChecks OU1·OU2` 시험이 `'' !== 'OU1,OU2'` 로 실패했다(420 통과·1 실패).
- GREEN 뒤: lib.test 421 통과·0 실패, e2eContract 78 통과.

## 로컬 E2E 결과 (http://localhost:5173, 폰 6종)

| 실행 | 흐름 | 크기별 통과/전체 | 실패 |
| --- | --- | --- | --- |
| `--only avatar-dress` | avatar-dress(AL1~AL3 포함) | 360x640 35/35 · 390x664 35/35 · 430x932 35/35 · 360x560 35/35 · 390x844 35/35 · 402x874 35/35 | 0 |
| `--only trace,errand,witness` | trace(OU1·OU2·TC7 포함) | 6종 모두 53/53 | 0 |
| 〃 | errand | 22/22 (390x844 만 27/27, 나머지 5종 22/22) | 0 |
| 〃 | witness | 6종 모두 13/13 | 0 |

알려진 간헐(errand EO4·witness 시간 초과)은 이번 실행에서 나오지 않아 재실행하지 않았다. 판정 문턱은 낮추지 않았다.

## 검증

- `node --test scripts/e2e/lib.test.mjs` 421 통과·0 실패
- `npx vitest run test/unit/e2eContract.test.ts` 78 통과
- `npm run typecheck` 통과
- `npm test` 279 파일 통과·6 건너뜀, 8012 통과·261 건너뜀(알려진 bots 간헐 없이 통과)
- 인수 기준: `"data-taken"` 1건, `dressLockChecks` avatar.mjs 2건, `outfitUniqueChecks` errand.mjs 2건, `mv-evidence__zero` browser.mjs 0건
- 위생: `git grep -nIiE "torder|티오더|조직|회사|~/project"` 결과 0
- spec-less probe fallback 건너뜀: 요구사항 ID 가 SC-1·SC-5 로 기존 계획 기준이며 별도 spec 이 없어 건너뜀(보이는 건너뜀 기록).

## Deviations from Plan

None - plan executed exactly as written. (방장 시트를 "다시 열어" 읽는 단계는 AD4 직후 시트가 열려 있어 그대로 읽었다 — 결정 기록 참고, 판정·문턱 변화 없음.)

## Known Stubs

None.

## Threat Flags

None — 새 네트워크 경로·권한 경로 없음. T-18-21(AL·OU 결과 줄 detail 은 옷 id·좌석 번호·개수만, 역할·닉네임 없음)과 T-18-22(표식 목록·lib.test·e2eContract 동기화, 각 표식이 git 추적 src 에 있음을 e2eContract 가 확인)를 시험으로 고정했다. 패키지 설치 없음(T-18-SC).

## 다음 계획 준비

18-10 이 전체 회귀(폰 6종 전체 흐름)를 한 번 돈다. 이 계획이 띄운 로컬 개발 서버는 끝에 껐다.

## Self-Check: PASSED

- 수정 파일 6개 모두 존재, 커밋 4개(`cb9e83ff`·`57e6dd2e`·`bd531fc3`·`3f51f4f4`) 확인.
