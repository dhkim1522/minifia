---
phase: 18-quick-fixes
plan: "04"
subsystem: evidence-card
tags: [evidence, icon, eyeOff, tracer, tdd, sc-4]

requires:
  - phase: 16-errand
    provides: EvidenceCard 2행(마지막 목격)·data-lastseen-count
provides:
  - V2Icon eyeOff 선 아이콘(eye 윤곽·눈동자 + 사선)
  - NO_WITNESS_LABEL = "목격자 없음" (src/game/traceText.ts)
  - 증거 카드 2행 목격자 없음 = eyeOff 24 하나(role=img, gray-300), 숫자 0 스팬 삭제
affects: [18-09, 18-11]

actuals:
  tokens: 6000
  tasks: 1
  commits: 2

plan_head_before: 0684a4e6a89d9bf1f35cd213a7f5944c722a7dfa
plan_head_after: a467eabef59572a43850330f829b0a3463f13e3a
commits: 2

tech-stack:
  added: []
  patterns:
    - "목격자 유무로 눈 칸을 나눈다: null 이면 eyeOff 하나, 아니면 eye + 이름 + 장소"
    - "접근성 이름은 V2Icon 기존 label prop(role=img·aria-label)으로, 문구는 traceText.ts 한 곳에"

key-files:
  created: []
  modified:
    - src/components/v2/V2Icon.tsx
    - src/components/v2/EvidenceCard.tsx
    - src/game/traceText.ts
    - src/styles/evidence.css
    - test/client/icon.test.tsx
    - test/client/evidenceCard.test.tsx
    - test/client/recordTrace.test.tsx

key-decisions:
  - "목격자 없음 색은 .mv-evidence__eye--none 변형 클래스로 gray-300 토큰만 준다(hex 없음)"
  - "scripts/e2e/browser.mjs 의 옛 선택자(.mv-evidence__zero)는 18-09 가 정리한다 — 빈 선택자는 무해해 이 계획은 건드리지 않았다"

requirements-completed: [SC-4]

coverage:
  - id: D1
    description: "목격자 없는 아침 증거 카드 2행은 eyeOff 아이콘 24 하나('목격자 없음', role=img)만 보이고 숫자 0·장소·목격자 이름이 없으며 data-lastseen-count=0 이 유지된다. 목격자가 있으면 eye(aria-hidden)+이름+장소 그대로"
    requirement: "SC-4"
    verification:
      - kind: unit
        ref: "test/client/evidenceCard.test.tsx#목격자가 없으면 count=0, eyeOff 아이콘 하나"
        status: pass
      - kind: unit
        ref: "test/client/evidenceCard.test.tsx#목격자가 있으면 eye 아이콘(aria-hidden) + 이름 + 장소 svg"
        status: pass
      - kind: unit
        ref: "test/client/recordTrace.test.tsx#증거 카드 2행(마지막 목격)"
        status: pass
      - kind: unit
        ref: "test/client/icon.test.tsx#V2Icon eyeOff (18-04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "eyeOff 의 실제 모양(사선이 눈 윤곽과 어울리는지)·gray-300 의 어두운 카드 위 가독성과 폰 6종에서 2행이 짧아져도 타일과 겹치지 않는지"
    requirement: "SC-4"
    verification: []
    human_judgment: true
    rationale: "구조(svg 1개·클래스·접근성 이름)만 단위 시험이 고정한다. 눈 확인·폰 폭별 렌더는 증거 E2E(18-09)와 실기기 검사가 맡는다"
---

# Phase 18 Plan 04: 목격자 없음 아이콘 Summary

**아침 증거 카드 2행의 "눈 + 0" 을 eyeOff(눈에 사선) 아이콘 24 하나로 바꿨다. 접근성 이름은 "목격자 없음", 색은 gray-300 토큰이고 data-lastseen-count=0 은 유지된다. 목격자가 있는 카드는 그대로다.**

## 수행한 일

- **Task 1 (트레이서, D-10)**: `V2Icon` 에 `eyeOff`(eye 의 두 부품 + `M4 4l16 16`)를 더했다. `traceText.ts` 에 `NO_WITNESS_LABEL`. `EvidenceCard` 2행은 `witness === null` 이면 `.mv-evidence__eye.mv-evidence__eye--none` 안에 `V2Icon eyeOff size=24 label={NO_WITNESS_LABEL}` 하나만, 아니면 eye 칸 + 이름 + 장소를 그린다. 숫자 0 스팬과 CSS 규칙은 지웠고 `evidence.css` 에 `.mv-evidence__eye--none { color: var(--gray-300); }` 를 더했다.
- 목격자 없는 행은 피해자 이름(취소선) + eyeOff 만 남아 짧아진다. 장소 타일 요소는 없으므로 겹치지 않는다(구조 확인, 렌더 확인은 D2 로 이월).

## TDD 증거 (RED)

RED 커밋 `f68d3649` — 유니온·ICONS 에 `eyeOff: []` 만 먼저 둔 상태에서 `npx vitest run test/client/icon.test.tsx test/client/evidenceCard.test.tsx test/client/recordTrace.test.tsx --reporter=tap-flat`:

- `not ok 4` evidenceCard "목격자가 없으면 count=0, eyeOff 아이콘 하나…"
- `not ok 50` icon "V2Icon eyeOff (18-04) > 24 격자 선 그림이고 path 가 둘 이상…"
- `not ok 77` recordTrace "증거 카드 2행(마지막 목격)… '목격자 없음' 아이콘"

실패 3건 모두 `name: "AssertionError"` 단언 실패다(import·타입·fixture 오류 아님, 타입 오류는 빈 경로 자리로 미리 막음). eyeOff 의 label 속성 시험과 "목격자가 있으면" 시험은 RED 에서도 통과한다(빈 아이콘도 label 을 받고, 목격자 있는 경로는 안 바뀌므로) — 회귀 방지로 남는다.

GREEN `a467eabe` — 세 시험 파일 92 통과, `npm run typecheck` 0, `npm test` 전체 279 파일 통과·7982 테스트 통과(261 건너뜀).

## Deviations from Plan

### Auto-fixed Issues

**1. [시험 확인 방식] RED 분류기 미실행**
- **Found during:** Task 1 RED
- **Issue:** `gsd_run check tdd-red-evidence` 는 RED 시점의 기록 파일로 돌려야 하는데, 이 실행에서는 TAP 출력을 눈으로 확인(위 3건·`AssertionError`)하고 분류기에 넘기지 않았다. GREEN 커밋 뒤에는 되돌려 재현하지 않았다.
- **Fix:** 없음(TAP 출력 직접 확인으로 대체, 위에 기록).
- **Files modified:** 없음

**Total deviations:** 1 (검증 절차 생략, 코드 영향 없음). **Impact:** 없음.

## Issues Encountered

- 위생 검사(`git grep -nIiE "torder|티오더|조직|회사|~/project"`)는 이전 계획이 남긴 기존 일반 용례(`.planning/milestones/...` "공식 조직 패키지" 등)만 잡는다. 이 계획이 건드린 파일은 0 건이다.

## Known Stubs

None.

## Threat Flags

None — 새 DOM 은 고정 문구 상수와 아이콘뿐이고 닉네임은 기존처럼 텍스트 노드로만 그린다(T-18-10). 패키지 설치 없음(T-18-SC).

## 다음 계획에 넘길 것

- 18-09: `scripts/e2e/browser.mjs` 2104행에 `.mv-evidence__zero` 옛 선택자가 남아 있다(무해). 증거 E2E 를 다루며 정리하고, 목격자 없음 행이 폰 6종에서 겹치지 않는지 렌더로 확인한다.
- 18-11: SC-4 의 나머지(밤 띠 "이름표"→"얼굴", 역할 확인 공개 예고 삭제). SC-4 는 이 계획과 18-11 이 함께 가진 요구사항이다.

## Self-Check: PASSED

- 수정 파일 7개 존재, 커밋 f68d3649·a467eabe 모두 HEAD 의 조상.
- 인수 기준: `grep -c eyeOff V2Icon.tsx` 4(≥2), `grep -c NO_WITNESS_LABEL EvidenceCard.tsx` 2(≥1), `mv-evidence__zero` EvidenceCard.tsx 0·evidence.css 0, vitest·typecheck 통과.
- 계획 검증: `npm run typecheck && npm test` 통과(E2E 는 계획대로 18-10 이 확인).
