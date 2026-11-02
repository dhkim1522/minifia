---
phase: 07-free-chat
plan: "23"
subsystem: ui
tags: [copy, scene-intro, guide-text, e2e-contract, vitest, tdd]

requires:
  - phase: 07-free-chat
    provides: "07-UAT 8번 사용자 결정(낮 보조줄 삭제, 하단 안내 '곧 토론이 시작돼요'), 07-REVIEW WR-03"
provides:
  - "낮 시작 막(SceneIntro)은 'N일차 / 낮이 되었습니다' 두 줄만 보인다"
  - "낮 시작 하단 패널은 '낮이 되었어요 / 곧 토론이 시작돼요' 이고 역할 무관"
  - "E2E N8 판정(INTRO_SPEC.day)이 제목 한 줄만 기대하고 세 번째 줄은 실패로 본다"
  - "결정 0030·0038 개정 표시, deferred-items 두 항목 닫힘, WR-03 resolved (07-23)"
affects: [07-27 배포본 E2E, design 시스템 사본 후속 수정]

actuals:
  tokens: 7300
  tasks: 3
  commits: 5

plan_head_before: 23c1229b8cc792ace1ff63a5a7c52d99f29d7b5e
plan_head_after: ebb718880a6715d5065fcc41b5d933741a8d48fa

tech-stack:
  added: []
  patterns:
    - "문구 변경은 단언하는 시험(단위·happy-dom·E2E 순수 판정)을 먼저 바꾸고(RED) 상수를 바꾼다(GREEN)"
    - "결정 기록은 원문을 지우지 않고 끝에 개정 표시를 덧붙인다"

key-files:
  created: []
  modified:
    - src/game/scenes.ts
    - src/components/SceneIntro.tsx
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - test/unit/scenes.test.ts
    - test/client/guide.test.tsx
    - test/client/sceneIntro.test.tsx
    - test/client/phaseScreens.test.tsx
    - docs/decisions/0030-visual-bundle.md
    - docs/decisions/0038-atmosphere-guide-wakelock.md
    - .planning/phases/07-free-chat/deferred-items.md
    - .planning/phases/07-free-chat/07-REVIEW-DISPOSITION.md

key-decisions:
  - "낮 시작 보조줄을 삭제하고 하단 안내를 '곧 토론이 시작돼요' 로 바꾼다 (07-UAT 8 사용자 결정 2026-11-02, 결정 0051 글 최소)"

patterns-established:
  - "SceneIntro 는 intro.sub 가 없으면 보조줄 p 를 그리지 않는다 — 코드 변경 없이 상수만 바꿔 처리"

requirements-completed: [CHAT-06]

coverage:
  - id: D1
    description: "낮 시작 막이 'N일차 / 낮이 되었습니다' 두 줄만 보이고 보조줄이 없다"
    requirement: CHAT-06
    verification:
      - kind: unit
        ref: "test/unit/scenes.test.ts#밤: 밤 톤·제목 `밤이 되었습니다`·보조줄 없음. 낮 시작: 낮 톤·제목 `낮이 되었습니다`·보조줄 없음"
        status: pass
      - kind: automated_ui
        ref: "test/client/sceneIntro.test.tsx, test/client/phaseScreens.test.tsx (happy-dom)"
        status: pass
    human_judgment: false
  - id: D2
    description: "낮 시작 하단 패널이 '낮이 되었어요 / 곧 토론이 시작돼요' 이고 다섯 시점·생존자·탈락자 모두 같다"
    requirement: CHAT-06
    verification:
      - kind: automated_ui
        ref: "test/client/guide.test.tsx, test/client/sceneIntro.test.tsx#낮 시작 하단은 생존자·탈락자 모두 같은 두 줄"
        status: pass
      - kind: unit
        ref: "test/unit/scenes.test.ts#낮 시작 하단 두 줄과 토론 헤더 문장이 상수 한 곳에 있다"
        status: pass
    human_judgment: false
  - id: D3
    description: "E2E N8 순수 판정이 제목 한 줄을 기대하고 세 번째 줄이 있으면 실패한다"
    requirement: CHAT-06
    verification:
      - kind: unit
        ref: "node --test scripts/e2e/lib.test.mjs (233 pass) · test/unit/e2eContract.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "실제 배포본 화면에서 N8(새 문구)이 통과한다"
    requirement: CHAT-06
    verification: []
    human_judgment: true
    rationale: "배포본은 아직 옛 문구다. 배포와 전체 E2E 는 07-27 이 한다. 이 계획은 순수 판정까지만 확인한다"
  - id: D5
    description: "결정 0030·0038 개정 표시, deferred-items 닫힘, WR-03 resolved (07-23)"
    verification:
      - kind: other
        ref: "grep 검사 (Task 3 verify, acceptance_criteria)"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-11-02
status: complete
---

# Phase 7 Plan 23: 낮 시작 문구 정리 Summary

**낮 시작 막은 제목 한 줄('낮이 되었습니다'), 하단 안내는 '곧 토론이 시작돼요' 로 바꿔 사라진 직업 공개 단계를 안내하던 두 문장을 앱·시험·E2E 판정에서 모두 없앴다**

## Performance

- **Duration:** 2 min
- **Started:** 2026-11-02T05:19:57Z
- **Completed:** 2026-11-02T05:22:00Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- `PHASE_INTRO.dayAnnounce` 에서 `sub` 를 지우고 `PHASE_GUIDE_FILL.dayAnnounce.guide` 를 '곧 토론이 시작돼요' 로 바꿨다. `SceneIntro` 는 `intro.sub` 가 없으면 보조줄을 그리지 않으므로 컴포넌트 코드는 그대로다(2초·톤·aria-hidden·data-guide 하나 규칙·NightPanel 구조 불변).
- 단위·happy-dom 시험 5개 파일과 E2E `INTRO_SPEC.day`·N8 시험이 새 문구를 기준으로 고정됐다. N8 은 세 번째 줄이 하나라도 있으면 실패한다.
- `git grep` 으로 `src`·`test`·`scripts` 에 옛 두 문장이 0줄이다. 결정 0030·0038 은 원문을 두고 개정 표시만 덧붙였고, deferred-items 의 두 항목이 닫히고 WR-03 이 `resolved (07-23)` 이다.

## TDD Gate Compliance

| Task | RED | GREEN |
|---|---|---|
| 1 (트레이서) | `2077f8f` test(07-23): 10 failed / 185 passed — 새 기대 단언(보조줄 없음, 새 하단 문구) 때문에 실패 | `69f27b6` feat(07-23): 195 passed |
| 2 | `03612cc` test(07-23): N8 시험 1건 실패 — good 입력(`2일차 / 낮이 되었습니다`)이 옛 INTRO_SPEC 의 세 줄 기대와 달라 `ok === false` | `e4ccb6d` feat(07-23): 233 pass, 0 fail |

RED 는 모두 계획한 단언에서 실패했다(구문·로드 오류 아님). `gsd_run check tdd-red-evidence` 기록 파일은 만들지 않았고 실행 출력을 직접 읽어 의미를 확인했다(`type: tdd` 계획이 아니라 tdd="true" 작업이므로 기록 의무 없음). Task 1 은 트레이서이며 자동 판정 `<verify>` 만 있어 재실행 통과 후 확장했다(⚡ Tracer verified end-to-end — expanding).

## Task Commits

1. **Task 1: 트레이서 — 낮 시작 막 제목 한 줄, 하단 '곧 토론이 시작돼요'** — `2077f8f` (test), `69f27b6` (feat)
2. **Task 2: E2E N8 새 문구 + SceneIntro 머리 주석** — `03612cc` (test), `e4ccb6d` (feat)
3. **Task 3: 결정 기록 개정 표시 · 미룬 항목 · WR-03** — `ebb7188` (docs)

**Plan metadata:** 이 SUMMARY 와 STATE·ROADMAP·REQUIREMENTS 갱신 커밋 (docs: complete plan)

## Files Created/Modified

- `src/game/scenes.ts` - `PHASE_INTRO.dayAnnounce` 보조줄 삭제, `PHASE_GUIDE_FILL.dayAnnounce.guide` 새 문구
- `src/components/SceneIntro.tsx` - 머리 주석의 낮 문구 예시를 제목 한 줄로(코드 불변)
- `scripts/e2e/lib.mjs` - `INTRO_SPEC.day.lines` 와 JSDoc
- `scripts/e2e/lib.test.mjs` - N8 시험(good 두 줄, bad 에 세 번째 줄·줄 부족)
- `test/unit/scenes.test.ts`, `test/client/guide.test.tsx`, `test/client/sceneIntro.test.tsx`, `test/client/phaseScreens.test.tsx` - 새 문구 단언(`DAY_TEXTS` 상수 삭제)
- `docs/decisions/0030-visual-bundle.md`, `0038-atmosphere-guide-wakelock.md` - 원문 유지, 끝에 2026-11-02 개정 표시
- `.planning/phases/07-free-chat/deferred-items.md`, `07-REVIEW-DISPOSITION.md` - 닫힘 / WR-03 resolved (07-23)

## Decisions Made

- 낮 시작 보조줄 삭제와 하단 안내 '곧 토론이 시작돼요' 는 07-UAT 8번 사용자 결정(2026-11-02)을 그대로 따랐다. 새 결정은 없다.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## 후속 항목 (메인 세션)

- 이 계획은 `design/` 을 고치지 않았다(`git diff d319105 -- design` 변화 없음). 옛 문장이 남은 위치: `design/design-system/components/PhaseCards/README.md` 5행 — 'SceneIntro ... 낮은 보조줄 "토론 전에 먼저 직업을 공개해요"'. 메인 세션이 디자인 시스템을 고칠 때 보조줄 문장을 지운다.
- 배포본은 아직 옛 문구이므로 07-27 배포 전에 전체 E2E 를 돌리면 N8 이 실패한다(예상된 동작).

## Known Stubs

None

## Threat Flags

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 07-27 이 배포 후 배포본 전체 E2E 로 N8(새 문구)을 확인한다.
- 같은 웨이브의 07-24 와 파일이 겹치지 않았다.

---
*Phase: 07-free-chat*
*Completed: 2026-11-02*

## Self-Check: PASSED

- FOUND: src/game/scenes.ts, scripts/e2e/lib.mjs, scripts/e2e/lib.test.mjs, docs/decisions/0030-visual-bundle.md, 07-REVIEW-DISPOSITION.md
- FOUND commits: 2077f8f, 69f27b6, 03612cc, e4ccb6d, ebb7188
