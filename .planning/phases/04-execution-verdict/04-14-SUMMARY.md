---
phase: 04-execution-verdict
plan: 14
subsystem: screen-wave-foundation
tags: [tokens, scenes, backdrop, preload, e2e-expected-scene, tdd]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-13 판결 연출 순수 모듈(src/game/verdict.ts)"
provides:
  - "design/tokens.json·src/styles/tokens.css: amber-700 #7a5314, amber-900 #3a2508, cone-light #fff4d6 와 개정된 amber-400·crimson-500 usage (D-33)"
  - "src/game/scenes.ts: 투표·공개·변론·처형 다섯 단계 → dusk, ended → night. verdictDusk 는 등록만 남음"
  - "scripts/e2e/lib.mjs EXPECTED_SCENE 이 PHASE_SCENE 과 열네 단계 모두 같다"
  - "src/net/assets.ts: duskPreloadList·preloadDuskAssets, RoomScreen 이 discussion 진입 때 호출"
affects: [04-15 이후 화면 계획 전부(해질녘 배경과 앰버·원뿔 토큰 위에서 만든다)]

actuals:
  tokens: 4700
  tasks: 3
  commits: 5
plan_head_before: a680e5161ae60447daf06f63c321b62747ae9bee
plan_head_after: 226993c8a35e81d30105b10a3ee2ad242b7ce105

tech-stack:
  added: []
  patterns:
    - "새 색은 design/tokens.json 에만 적고 tokens.css 는 npm run tokens 로 만든다"
    - "앱 장면 표(PHASE_SCENE)와 E2E 기대 표(EXPECTED_SCENE)는 scenes.test.ts 가 같음을 단언해 묶는다"
    - "미리 받기 목록은 인자가 없는 고정 목록이라 요청 패턴으로 역할이 드러나지 않는다"

key-files:
  created: []
  modified:
    - design/tokens.json
    - src/styles/tokens.css
    - src/game/scenes.ts
    - test/unit/scenes.test.ts
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - src/net/assets.ts
    - test/unit/assets.test.ts
    - src/screens/RoomScreen.tsx
    - test/client/phaseScreens.test.tsx

key-decisions:
  - "P-1(확인 대기 기본값): 투표 다섯 단계 배경은 dusk. verdictDusk 그림에는 위에서 떨어지는 조명이 구워져 있어 D-29 와 맞지 않는다. 사용자가 원하면 조명을 지운 새 그림이 먼저고 표 한 줄만 바꾼다"
  - "P-2: ended 배경은 night (bg_game_night 와 bg_game_lobby 는 보이는 차이가 없다)"
  - "그림 파일과 ASSET_VERSION(i3)은 바꾸지 않았다"
  - "디자인 시스템 아티팩트(design/design-system/)는 고치지 않았다(P-12 후속, 04-34 가 HANDOFF 동기화 목록에 적는다)"

requirements-completed: []

coverage:
  - id: D1
    description: "amber-700·amber-900·cone-light 토큰이 tokens.json 에 amber-400 바로 뒤에 있고 tokens.css 가 npm run tokens 로 재생성되어 tokens:check 가 통과한다. amber-400·crimson-500 usage 가 D-33 색 의미와 같다"
    requirement: "VOTE-01"
    verification:
      - kind: automated
        ref: "npm run tokens:check, npx vitest run --project unit test/unit/backdropContrast.test.ts, test/unit/assets.test.ts (투표 화면 토큰 세 개)"
        status: pass
    human_judgment: false
  - id: D2
    description: "PHASE_SCENE 의 투표 다섯 단계가 dusk, ended 가 night 이고 verdictDusk 는 등록만 남으며, EXPECTED_SCENE 이 열네 단계 모두 같다"
    requirement: "VOTE-03"
    verification:
      - kind: automated
        ref: "npx vitest run --project unit test/unit/scenes.test.ts, node --test scripts/e2e/lib.test.mjs (107 통과)"
        status: pass
    human_judgment: false
  - id: D3
    description: "낮 토론 진입 때 dusk 배경 하나만 미리 받고, 목록은 인자 없는 고정 하나라 역할과 무관하다. 다른 단계·같은 단계 다시 그리기에서는 호출하지 않는다"
    requirement: "END-02"
    verification:
      - kind: automated
        ref: "test/unit/assets.test.ts(duskPreloadList·preload 호출), test/client/phaseScreens.test.tsx(discussion 에서 1회, 앞뒤 단계 0회)"
        status: pass
    human_judgment: false
  - id: D4
    description: "전체 게이트: npm test, npm run typecheck(tokens:check + tsc 앱·워커)"
    requirement: "VOTE-01"
    verification:
      - kind: automated
        ref: "npm test (88 파일 2245 테스트 통과), npm run typecheck 종료 0"
        status: pass
    human_judgment: false
---

# Phase 4 Plan 14: 화면 웨이브 바탕 — 색 토큰·장면 표·dusk 미리 받기 Summary

**앰버·원뿔 색 토큰 3종, 투표 다섯 단계를 dusk 한 장으로 묶는 장면 표(앱·E2E 동기), 낮 토론 진입 때 dusk 하나를 미리 받는 함수를 세워, 이후 화면 계획이 같은 배경과 같은 색 위에서 만들어지게 했다. 배포하지 않았다(D-26).**

## 한 일

세 작업을 TDD 로 진행했다(작업 1 은 설정 값이라 단일 커밋, 작업 2·3 은 RED → GREEN).

### Task 1: 색 토큰 (56a37e0)

- `design/tokens.json` 의 `amber-400` 바로 뒤에 `amber-700 #7a5314`, `amber-900 #3a2508`, `cone-light #fff4d6` 를 더하고 `npm run tokens` 로 `tokens.css` 를 다시 만들었다(직접 고치지 않음). 기존 값은 하나도 바꾸지 않았다.
- `amber-400` usage = "안 읽은 기록 표시, 낮의 공개 투표(…). 글자색으로는 쓰지 않는다 …". `crimson-500` usage = "진홍 면. 마피아 팀 결과 띠, 마지막 5초 타이머 막대, 카드 뒷면 마름모. 글자에는 쓰지 않는다."
- 인수 기준: `tokens.css` 변수 3, "낮의 공개 투표" 1, "처형·탈락 발표의 띠" 0.

### Task 2: 장면 표 (RED 0e0cd8e → GREEN fd516ef)

- `PHASE_SCENE`: `execVote`·`candidateVote`·`candidateVoteReveal`·`defense`·`execution` = `dusk`, `ended` = `night`. 나머지 행 그대로. `SCENE_IDS`·`SCENES` 에 `verdictDusk` 등록은 남기고 머리 주석을 새 규칙으로 고쳤다. `PHASE_INTRO` 위 주석은 "처형 투표 카드는 SceneIntro 가 아니라 전용 카드(UI-SPEC 9.1)다" 로 바꿨다.
- `scenes.test.ts`: 표 전체 단언을 새 값으로, "dusk 는 정확히 다섯 단계(이름 나열) / verdictDusk 는 등록만 남고 어떤 단계도 가리키지 않는다" 로 뒤집었다. EXPECTED_SCENE 동일성 단언은 그대로 둬 두 표를 묶는다.
- `scripts/e2e/lib.mjs` EXPECTED_SCENE 여섯 행과 `lib.test.mjs` 단언을 같은 값으로 바꿨다.
- 인수 기준: `"dusk"` 7, `execVote: "verdictDusk"` 두 파일 0, `ended: "night"` 두 파일 1, `verdictDusk` 3(등록 남음).

### Task 3: dusk 미리 받기 (RED b93cd76 → GREEN 226993c)

- `duskPreloadList()` = `[{ href: backdropUrl("game","dusk") }]` (인자 없음, 약 25KB), `preloadDuskAssets()` 는 기존 `preloadImages` 를 쓴다. `rolePreloadList` 주석은 "해질녘 배경은 낮 토론 진입 때 따로 받는다" 로 고쳤다.
- `RoomScreen`: `phase === "discussion"` 일 때만 `preloadDuskAssets()` 를 부르는 효과 하나를 더했다(의존성 `[phase]` 라 같은 단계 다시 그리기에서는 부르지 않음). 기존 `preloadRoleAssets` 효과는 건드리지 않았다.
- 시험: `assets.test.ts` 에 목록 고정·매번 같음·인자 없음·react-dom preload 1회, "실제 파일과의 일치" 에 dusk 목록 포함. `phaseScreens.test.tsx` 에 `preloadDuskAssets` spy 를 더해 lobby·assigning·roleReveal·dayAnnounce·claim 0회 → discussion 1회 → 다시 그리기 1회 → night 1회(늘지 않음)를 단언.
- `ASSET_VERSION` 은 `"i3"` 그대로(그림 변경 없음).

## 시험 결과

- `npm test`: 88 파일 2245 통과(이 계획 전 2242).
- `npm run typecheck`(tokens:check + wrangler types + tsc 앱 + tsc 워커): 종료 0.
- `node --test scripts/e2e/lib.test.mjs`: 107 통과, 0 실패.
- `node scripts/tsc-scoped.mjs tsconfig.app.json '^(src/game/scenes|test/unit/scenes)'`: OK.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 일지 토큰 순서 시험이 새 토큰 때문에 깨짐**
- **Found during:** Task 3 시험 실행(Task 1 직후 전체 시험을 돌리지 않아 이때 발견)
- **Issue:** `test/unit/assets.test.ts` 의 "color.tokens 맨 끝 12개가 순서와 값 그대로 들어 있다" 가 `slice(-12)` 로 꼬리를 읽었다. 계획대로 `amber-400` 바로 뒤에 새 토큰 셋을 끼우자 꼬리 12개가 달라져 실패했다. 코드가 아니라 시험이 위치에 기대고 있었다.
- **Fix:** 이름으로 찾아 순서와 값을 단언하도록 고치고(끼어든 토큰이 있어도 순서 확인은 유지), 새 토큰 셋이 `amber-400` 바로 뒤에 있고 `tokens.css` 에도 있음을 단언하는 시험을 더했다. 계획의 `files_modified` 에 이 파일이 이미 있다.
- **Files modified:** test/unit/assets.test.ts
- **Commit:** b93cd76

그 밖에는 계획대로 실행했다.

## Known Stubs

없음.

## Threat Flags

없음. T-04-42(dusk 목록은 인자 없는 고정 하나, 시험이 매번 같음 단언), T-04-43(scenes.test.ts 가 EXPECTED_SCENE 동일성 단언)은 시험으로 고정했다. 새 패키지 설치 없음.

## 다음 계획이 알아둘 점

- 투표 다섯 단계 화면은 `dusk` 배경이다. 빛은 배경 그림이 아니라 원뿔 층 하나(`cone-light` 55% → 20%)로 낸다(D-29).
- `verdictDusk` 는 등록과 그림 파일만 남고 어떤 단계도 쓰지 않는다. 사용자가 P-1 을 뒤집으면 조명을 지운 새 그림이 먼저고, 그때 `ASSET_VERSION` 을 올린다.
- E2E 의 B1 은 이제 투표·종료 단계에서 `dusk`·`night` 를 기대한다. 화면이 그려질 때(후속 계획) 같이 확인된다.

## Self-Check: PASSED

- 변경한 10개 파일 존재 확인(`git diff --stat` 로 확인).
- 커밋 56a37e0·0e0cd8e·fd516ef·b93cd76·226993c 가 HEAD 의 조상(`plan_head_before..HEAD` 5개).
- 배포 없음(D-26). 관련 없는 변경 파일(`.planning/milestone.lock`, `.planning/state.json`, `Claude outputs/`)은 커밋하지 않았다.
