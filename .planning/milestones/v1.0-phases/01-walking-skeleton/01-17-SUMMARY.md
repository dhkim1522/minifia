---
phase: 01-walking-skeleton
plan: 17
subsystem: ui-entry-contrast
tags: [css, contrast, wcag, accessibility, gap-closure, tdd, g-01-1b]
status: complete
gap_closure: true
gap_ids: [G-01-1b]
gap_status: closed-pending-human-check

requires:
  - phase: 01-walking-skeleton
    provides: "첫 화면(Home)·TextField·ds.css 부품 스타일, 01-UAT.md G-01-1b"
provides:
  - "입력 라벨·구분선 글자 gray-100(13.7:1), 힌트 gray-300 불투명도 1(7.56:1), 구분선 선 gray-500(3.44:1), 꺼진 버튼 불투명도 0.6(5.4~6.1:1)"
  - "DOM 클래스 → ds.css 규칙 → 토큰 hex → WCAG 대비를 잇는 CSS 값 규칙 테스트(test/client/entryContrast.test.tsx)"
  - "글자 크기 14/16/24/36 과 hex 직접 지정 금지 회귀 가드"
  - "UI-SPEC 개정 표 R19(승인본과 달라진 대비 값)"
affects: [/gsd-verify-work 1 (G-01-1b 눈 확인), 디자인 시스템 아티팩트 보정(R19)]

actuals:
  tokens: 2300
  tasks: 2
  commits: 4
plan_head_before: e19f6e7c8db979c7c2842df7e2efea6a6cdf6dcb
plan_head_after: 81d793f5058acf269ab6940a27860ca7f3222b3e

tech-stack:
  added: []
  patterns:
    - "CSS 값은 vitest 에서 ?raw 로 읽으면 빈 문자열이라 readFileSync 로 읽고, 선택자 목록이 정확히 일치하는 규칙의 선언을 합쳐 토큰 → hex → 대비로 푼다"
    - "대비는 토큰 색과 불투명도를 night-800 면 위에 합성해 WCAG 2 상대 휘도로 계산한다"

key-files:
  created:
    - test/client/entryContrast.test.tsx
  modified:
    - src/styles/ds.css
    - .planning/phases/01-walking-skeleton/01-UI-SPEC.md

key-decisions:
  - "힌트는 gray-100 이 아니라 gray-300 불투명도 1 로 한다(입력된 글자 gray-100 과 구분 유지)"
  - "구분선의 선은 gray-700 에서 gray-500 으로 올린다(글자가 밝아져 옅은 선과 균형이 깨짐, UI 경계 3:1)"
  - "꺼진 버튼은 모든 버튼 공통 불투명도 하나만 0.4 → 0.6 으로 올린다(0.5 는 보조 버튼 4.23:1 로 4.5 미달)"
  - "글자 크기·폰트(G-01-1a)와 토큰은 건드리지 않는다"

requirements-completed: [ROOM-01, ROOM-02]

coverage:
  - id: D1
    description: "입력 라벨과 구분선 글자가 gray-100 이고 night-800 면 위 12:1 이상이다"
    requirement: "ROOM-02"
    verification:
      - kind: unit
        ref: "test/client/entryContrast.test.tsx#G-01-1b 입력 라벨, 구분선"
        status: pass
    human_judgment: false
  - id: D2
    description: "입력칸 힌트가 gray-300 불투명도 1 이고 면 위 7:1 이상이다"
    requirement: "ROOM-01"
    verification:
      - kind: unit
        ref: "test/client/entryContrast.test.tsx#G-01-1b 입력칸 힌트"
        status: pass
    human_judgment: false
  - id: D3
    description: "구분선의 선이 gray-500 으로 UI 경계 3:1 이상이다"
    requirement: "ROOM-01"
    verification:
      - kind: unit
        ref: "test/client/entryContrast.test.tsx#G-01-1b 구분선"
        status: pass
    human_judgment: false
  - id: D4
    description: "꺼진 주·보조 버튼이 켜진 버튼보다 흐리면서 글자 대비 4.5:1 이상이다"
    requirement: "ROOM-01"
    verification:
      - kind: unit
        ref: "test/client/entryContrast.test.tsx#G-01-1b 꺼진 버튼"
        status: pass
    human_judgment: false
  - id: D5
    description: "첫 화면 입력 카드가 '비활성처럼 느껴진다' 는 인상 없이 또렷하게 읽힌다"
    requirement: "ROOM-01"
    verification:
      - kind: unit
        ref: "비율은 위 D1~D4 테스트가 잼"
        status: pass
    human_judgment: true
    rationale: "화면 인상은 지각 판단이다. 단계 끝 UAT(human_verify_mode: end-of-phase)에서 폰으로 확인한다"

duration: 8min
completed: 2026-10-23
---

# Phase 1 Plan 17: 입력 화면 글자 대비 (G-01-1b) Summary

**첫 화면·링크 참가 입력 카드의 라벨·"또는"을 gray-100, 힌트를 불투명도 1, 구분선 선을 gray-500, 꺼진 버튼을 불투명도 0.6 으로 올려 모두 WCAG 기준(본문 4.5:1, UI 경계 3:1) 이상으로 만들고, 토큰 색에서 대비를 직접 계산하는 테스트와 글자 크기·hex 가드를 더했다.**

## 결과 요약

| 항목 | 값 |
| --- | --- |
| 태스크 | 2/2 완료 (Task 1 tracer, Task 2 auto) |
| 커밋 | 4 (test 2 + feat 2, 각 태스크 RED 가 GREEN 보다 먼저) |
| 전체 테스트 | vitest 41 files, 635 통과 (기준선 40 files 617 + 01-16 증가분 + 이 plan 5건), `npm run typecheck` 통과 |
| 변경 파일 | 3 (ds.css, entryContrast.test.tsx 신규, 01-UI-SPEC.md) |
| 갭 상태 | G-01-1b 자동 검증 완료. 눈으로 보는 확인만 단계 끝 UAT 로 남음 |

## 태스크별 기록

| 태스크 | 이름 | 커밋 |
| --- | --- | --- |
| 1 RED | 입력 라벨 gray-100 대비 트레이서 테스트 | 465c4b3 |
| 1 GREEN | `.mf-field__label` 색 gray-300 → gray-100 | 2df7065 |
| 2 RED | 힌트·구분선·꺼진 버튼 대비와 글자 크기·hex 가드 테스트 | b24162b |
| 2 GREEN | 힌트 불투명도·구분선·꺼진 버튼 값 조정, UI-SPEC R19 | 81d793f |

### 바뀐 값 (ds.css)

| 규칙 | 전 | 후 | 대비(night-800 면) |
| --- | --- | --- | --- |
| `.mf-field__label` 글자 | gray-300 | gray-100 | 7.56 → 13.70 |
| `.mf-entry__divider` 글자 | gray-300 | gray-100 | 7.56 → 13.70 |
| `.mf-field__input::placeholder` 불투명도 | 0.7 | 1 | 4.39 → 7.56 |
| `.mf-entry__divider::before/::after` 선 | gray-700 | gray-500 | 1.59 → 3.44 |
| `.mf-btn:disabled` 불투명도 | 0.4 | 0.6 | 보조 3.22 → 5.43, 주 3.43 → 6.07 |

토큰(`design/tokens.json`, `src/styles/tokens.css`)·클래스 이름·마크업·글자 크기·굵기는 그대로다. `npm run typecheck` 안의 `tokens:check` 가 통과한다.

## TDD 기록

- **RED 1 (465c4b3):** `check tdd-red-evidence` → `RED_EVIDENCE_OK`(target_test_failed). 의미 평가: 대상 테스트가 실행되어 `.mf-field__label` 색 토큰 이름 단언에서 `gray-300 != gray-100` 으로 실패. 설정·import·픽스처 오류 아님.
- **RED 2 (b24162b):** 실패한 Test 2·3·4 각각을 대상으로 `RED_EVIDENCE_OK` 3건. 의미 평가: 힌트 불투명도 `0.7 != 1`, 구분선 글자 `gray-300 != gray-100`, 꺼진 주 버튼 글자 대비 `3.45 < 4.5` 로 모두 계획한 이유로 실패. Test 5(가드)는 계획대로 HEAD 에서도 초록.
- **REFACTOR:** 정리할 것이 없어 커밋하지 않음.
- **트레이서 게이트:** `human_verify_mode: end-of-phase` 이고 트레이서 `<verify>` 가 자동 검증만 가져 재실행했다. 통과(라벨 테스트 + 화면 테스트 87건)해 확장했다.

## 수용 기준 검증

| 기준 | 결과 |
| --- | --- |
| `.mf-btn:disabled { opacity: 0.6` 줄 수 1 | PASS (1) |
| `opacity: 0.7` 0, `opacity: 0.4` 0 | PASS (0, 0) |
| `var(--gray-300)` 5 | PASS (5) |
| UI-SPEC `R19` 1 이상, 삭제 줄 수 0 | PASS (1, numstat 1/0) |
| `G-01-1b` 테스트 파일 내 3 이상(Task 1 직후 3, 이후 증가) | PASS |
| test 커밋이 같은 태스크 feat 커밋보다 먼저, test 2 / feat 2 | PASS |
| 불변: `git diff --quiet BASE -- src/components src/screens src/styles/tokens.css design worker shared` | PASS (exit 0) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ds.css·tokens.css 의 `?raw` import 가 테스트 환경에서 빈 문자열**
- **Found during:** Task 1 (RED 첫 실행)
- **Issue:** 계획은 `sheet.test.tsx` 처럼 `?raw` 로 CSS 원문을 읽으라고 했지만, vitest 가 CSS 를 처리해 빈 문자열이 되어 `tokens.css 에 --night-800 색 토큰이 없다` 오류로 시작도 못 했다(01-16 이 같은 사정을 sheet.test.tsx 에서 이미 만났다).
- **Fix:** `/// <reference types="node" />` 와 `readFileSync("src/styles/ds.css" | "tokens.css", "utf8")` 로 읽는다. 도우미(`tokenHex`, `declsOf`)는 토큰이나 규칙이 없으면 오류를 던지므로 빈 CSS 는 통과하지 못한다.
- **Files modified:** test/client/entryContrast.test.tsx
- **Commit:** 465c4b3 (RED 커밋 이전에 고쳐 첫 커밋부터 올바른 형태)

**Total deviations:** 1 auto-fixed (Rule 3 1건). **Impact:** 테스트 입력 경로만 바뀌었고 계획한 단언·값은 그대로다.

### 계획과 다르게 남겨 둔 것

- **01-UAT.md 의 G-01-1b 상태는 고치지 않았다.** 계획의 `files_modified` 에 없고, 눈으로 보는 확인(`<human-check>`)이 남아 있어 `/gsd-verify-work 1` 이 닫는다.

## 사람이 볼 것 (단계 끝 UAT)

PC 에서 `npm run dev` 후 폰 폭(360×640) 또는 폰 브라우저(LAN 주소)로 `/` 와 `/r/{방 코드}` 를 연다. 기대: "닉네임"·"방 코드" 라벨과 "또는" 이 본문 글자처럼 또렷하고, 방 코드 칸의 "4자리 숫자" 힌트가 읽히면서 입력한 숫자와 구분되며, 꺼진 [참가]·[방 만들기] 가 읽히되 켜진 버튼보다 분명히 흐리다. "비활성처럼 느껴진다" 는 인상이 없어야 한다.

## 디자인 후속 (이 plan 범위 밖)

- 승인본(`design/screens/03_B3_Entry.png`, `bundle.css`)과 값이 달라졌다. 디자인 시스템 아티팩트의 힌트 규칙·꺼진 버튼 규칙, tokens 의 gray-300 사용처 설명("라벨")은 디자인 세션에서 R19 값으로 보정한다(R18 보정 목록과 함께).
- G-01-1a(전체 폰트 테마·글자 크기), G-01-2, G-01-5 는 디자인 결정·그림 에셋이 필요해 데스크톱 디자인 세션 몫이다.
- 재배포는 이 plan 범위 밖이다. 01-16 이 열려 있으므로 `npm run deploy` → 배포본 스모크 → `/gsd-verify-work 1` 은 G-01-9 재진단 뒤로 미룬다.

## Known Stubs

없음.

## Threat Flags

없음. CSS 선언 값만 바뀌었고 새 엔드포인트·인증 경로·스키마 변화가 없다. T-01-60(가용성: 글자 대비)과 T-01-61(디자인 계약 drift: R19 기록, 토큰 불변)은 계획대로 완화했다.

## Self-Check: PASSED

- 파일: `test/client/entryContrast.test.tsx`, `src/styles/ds.css`, `.planning/phases/01-walking-skeleton/01-UI-SPEC.md` 존재 확인.
- 커밋: 465c4b3, 2df7065, b24162b, 81d793f 가 HEAD 의 조상임을 확인.
- `npx vitest run test/client/entryContrast.test.tsx` 5건 통과, `npx vitest run` 635건 통과, `npm run typecheck` 통과.
