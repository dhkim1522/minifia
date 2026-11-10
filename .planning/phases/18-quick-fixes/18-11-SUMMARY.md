---
phase: 18-quick-fixes
plan: "11"
subsystem: host-band-copy
tags: [copy, host-line, role-reveal, e2e-contract, tracer, tdd, sc-4]

requires:
  - phase: 18-quick-fixes
    provides: "18-04 가 SC-4 의 나머지 하나(목격자 없음 eyeOff 아이콘)를 마쳤다"
provides:
  - 밤 사회자 띠 네 문장(night.mafia·police·doctor·citizen)이 "얼굴을 눌러 주세요"를 말한다
  - E2E 사본 HOST_ACT_LINES 세 값(mafia·police·doctor)이 앱 문구와 같다
  - 역할 확인의 공개 예고 줄·4초 타이머·PRE_NOTICE_MS·.mf-reveal__pre CSS 삭제 (빈 .mf-reveal__hints 칸 유지)
affects: [18-08, 18-09, 18-10]

actuals:
  tokens: 5000
  tasks: 2
  commits: 4

plan_head_before: 2353f4d014c528a54708484ff1e4c49b6dbf0957
plan_head_after: a6a1f2d3fe698ce1355149a9ff9d7941285190d8
commits: 4

tech-stack:
  added: []
  patterns:
    - "문구 표 hostLine 을 고치면 E2E 사본 HOST_ACT_LINES 를 같이 고친다 — e2eContract 가 한 글자도 다르지 않음을 대조한다"
    - "빈 칸은 레이아웃을 지킨다: 요소 대신 빈 .mf-reveal__hints div 를 남겨 카드·머리 위치가 불변이다"

key-files:
  created: []
  modified:
    - src/game/hostLine.ts
    - test/unit/hostLine.test.ts
    - scripts/e2e/lib.mjs
    - src/screens/RoleReveal.tsx
    - src/game/resultText.ts
    - src/styles/phase.css
    - test/client/phaseScreens.test.tsx

key-decisions:
  - "nomination.act 의 '이름표'는 지목 단계에서 실제 이름표를 누르므로 그대로 둔다"
  - "RESULT_PANEL_TEXT.preNotice 는 귓속말 시트(LineSheet)가 쓰므로 남기고, 역할 확인 쪽만 지운다"

requirements-completed: [SC-4]

coverage:
  - id: D1
    description: "밤 사회자 띠 네 문장이 '얼굴을 눌러 주세요'로 바뀌고 지목 문장은 그대로이며, E2E 사본이 앱 문구와 같다"
    requirement: "SC-4"
    verification:
      - kind: unit
        ref: "test/unit/hostLine.test.ts#사회자 문구 표 > 밤 마피아·경찰·의사·시민"
        status: pass
      - kind: unit
        ref: "test/unit/e2eContract.test.ts#HOST_ACT_LINES 대조"
        status: pass
      - kind: command
        ref: "node --test scripts/e2e/lib.test.mjs (414 pass)"
        status: pass
    human_judgment: false
  - id: D2
    description: "역할 확인에 공개 예고 줄·타이머가 없고 빈 hints 칸 1개만 남아 4초 전후와 네 역할 모두 같다. 귓속말 시트 예고는 그대로 통과한다"
    requirement: "SC-4"
    verification:
      - kind: unit
        ref: "test/client/phaseScreens.test.tsx#공개 예고 없음 (18-11, D-09)"
        status: pass
      - kind: unit
        ref: "test/client/whisperUi.test.tsx (LineSheet 예고)"
        status: pass
    human_judgment: false
  - id: D3
    description: "빈 hints 칸이 실제 폰 화면에서 카드·머리 위치를 바꾸지 않는지(예전 4초 뒤 모습과 같은 높이)"
    requirement: "SC-4"
    human_judgment: true
    rationale: "자동 시험은 DOM 구조(빈 칸 1개)만 본다. 픽셀 위치는 18-10 의 E2E 전체 회귀와 실기기 검사에서 확인한다"

duration: 12 min
completed: 2026-11-10
status: complete
---

# Phase 18 Plan 11: 낡은 문구 정리 Summary

**밤 사회자 띠 네 문장의 "이름표"를 "얼굴"로 고치고(E2E 사본 포함), 역할 확인의 공개 예고 한 줄과 4초 타이머를 삭제했다.**

## 한 일

- **Task 1 (트레이서)**: `src/game/hostLine.ts` 의 night.mafia·police·doctor·citizen 네 값을 "얼굴을 눌러 주세요"로, `scripts/e2e/lib.mjs` 의 `HOST_ACT_LINES` 세 값을 같은 문장으로 바꿨다. nomination.act 는 그대로다. hostLine·e2eContract·hostBand 시험과 `scripts/e2e/lib.test.mjs` 가 초록이다(트레이서 재확인 통과, 확장 진행).
- **Task 2**: `RoleReveal.tsx` 에서 예고 상태·타이머·`<p>`·import 를 지우고 `.mf-reveal__hints` 는 빈 `<div />` 로 남겼다. `resultText.ts` 의 `PRE_NOTICE_MS`, `phase.css` 의 `.mf-reveal__pre` 두 줄과 모션 줄이기 한 줄을 지웠다. `preNotice` 문구는 LineSheet 용으로 남았다.

## TDD 증거

### Task 1 RED
- 명령: `npx vitest run test/unit/hostLine.test.ts --reporter=tap-flat` (종료 코드 1)
- 실패: `사회자 문구 표 > 밤 마피아·경찰·의사·시민` 네 줄이 단언에서 실패 (`expected '…이름표를…' to be '…얼굴을…'`)
- `gsd-tools check tdd-red-evidence` → `RED_EVIDENCE_OK` (target_test_failed)
- semanticAssessment: 목표 시험이 실제로 실행되어 새 문장 단언에서 실패했고, 수입·구문·픽스처 오류가 아니다.

### Task 2 RED
- 명령: `npx vitest run test/client/phaseScreens.test.tsx --reporter=tap-flat` (종료 코드 1, 표준 출력만 기록)
- 실패 3건: 옛 역할 확인 시험의 `[data-pre-notice]` 0개 단언, 새 "공개 예고 없음" 두 시험이 `expected 1 to be +0`
- `gsd-tools check tdd-red-evidence` → `RED_EVIDENCE_OK`
- semanticAssessment: 예고 줄이 아직 남아 있어서 의도한 단언에서 실패했다.

### GREEN / REFACTOR
- 커밋: test(487a8d70) → feat(2b93b69a), test(bdaa8c3c) → feat(a6a1f2d3). REFACTOR 커밋 없음.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 도구] Task 2 RED 증거를 처음에 INVALID_RED 로 받음**
- **Found during:** Task 2 RED
- **Issue:** vitest 출력의 Node 경고 두 줄(stderr)이 TAP 보고서 앞에 섞여 분류기가 `Unsupported report format` 으로 거절했다. RED 커밋은 그 전에 이미 만들어졌다(명령을 `;` 로 이어 붙인 탓).
- **Fix:** 같은 상태(GREEN 편집 전)에서 `2>/dev/null` 로 표준 출력만 다시 받아 `RED_EVIDENCE_OK` 를 확인한 뒤 GREEN 으로 넘어갔다. 시험 내용은 바뀌지 않았다.
- **Files modified:** 없음
- **Commit:** bdaa8c3c (RED 커밋 그대로)

**2. [범위 밖 기록] 전체 `npm test` 첫 실행에서 시간 의존 시험 1건 실패**
- 첫 실행 `1 failed | 7979 passed`(`Date.now()` 경과 시간을 재는 시험), 재실행 두 번은 `7980 passed` 전부 통과. 이 계획의 변경과 무관한 부하 의존 시험이라 고치지 않았다.

**Total deviations:** 1 auto-fixed (도구), 1 범위 밖 기록. **Impact:** 코드 영향 없음.

## 이월·메모

- `scripts/e2e/lib.mjs` 의 `HOST_ACT_LINES` 세 값만 고쳤다(18-08 → 18-09 가 이어서 같은 파일을 고친다).
- 바뀐 흐름 E2E(emcee-band·night)는 이 계획에서 돌리지 않았다 — 18-10 의 전체 회귀가 확인한다.
- spec-less probe fallback 건너뜀: 요구사항 ID 없음.

## Known Stubs

없음.

## Threat Flags

없음. T-18-09 는 문장 글자만 바꾸고 역할별 줄 규칙은 그대로라 유지되며, e2eContract 가 두 표의 일치를 고정한다.

## Self-Check: PASSED

- 수정 파일 7개 모두 존재, 커밋 487a8d70·2b93b69a·bdaa8c3c·a6a1f2d3 가 HEAD 의 조상이다.
- 인수 기준: hostLine "얼굴을 눌러 주세요" 4 / "이름표를 눌러 주세요" 1 / lib.mjs "얼굴을 눌러 주세요" 3 / PRE_NOTICE_MS 0·0 / data-pre-notice 0 / mf-reveal__pre 0 / preNotice 1 — 모두 통과.
- `npm run typecheck`, `npm test`(7980 통과), `node --test scripts/e2e/lib.test.mjs`(414 통과) 초록. 위생 grep 결과 0.
