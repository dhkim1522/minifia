---
phase: 08-day-execution-ghost
plan: "20"
subsystem: client-logic-cleanup
tags: [cleanup, v1-logic, delete, static-guard, verdict, scenes, css, icon]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-19 가 v1.0 낮·처형 화면 파일 13개를 지워 이 계획이 지울 로직·CSS 의 소비자가 사라짐
provides:
  - 테이블 기하·후보 선택 기록 줄·빈 곳 탭 모듈(dayTable·recordRows·blankTap)이 저장소에 없다
  - src/game/verdict.ts 는 결과 화면·밤 패널·단계 안내가 쓰는 문구와 결과 연출 시각 둘만 남았다(606행 → 약 130행)
  - chatUi 의 채팅 패널 덧셈은 CHAT_PANEL_EXTRA(92)로 이름이 바뀌었고 tablePanelHeight 는 없다
  - daytable·verdict·urecord.css 와 쓰는 곳 없는 v1.0 아이콘 아홉 개, 아침 밝아짐 층이 없다
  - test/unit/dayStaticGuard.test.ts 가 지운 화면·로직 이름 열여섯 개의 재등장을 막는다(08-22 가 서버 이름을 더한다)
affects: [08-21·22 서버 옛 흐름·PhaseId 정리(dayStaticGuard 목록 확장, VERDICT_TEXT.announce 옛 세 단계 키 삭제, scenes PHASE_SCENE 옛 행 삭제), 08-24 E2E 재구성(scripts/e2e/lib.mjs·browser.mjs 의 옛 사본)]

actuals:
  tokens: 58600
  tasks: 3
  commits: 5
plan_head_before: b27a77737f461458bae7ab048e21779fd4a3a67d
plan_head_after: 17550bf8857d9afd3ffebd8b9899f7c1b624c7ed

tech-stack:
  added: []
  patterns:
    - "지운 이름의 정적 가드: 주석을 뺀 코드에서 단어 경계로 찾고, 도우미(stripComments·foundIdentifiers)는 chatStaticGuard 의 export 를 가져다 쓴다"
    - "삭제 계획의 TDD: 가드가 만들어지는 시점엔 이미 이름이 없어 처음부터 통과하므로, 일부러 이름을 넣은 사본에서 실패함을 확인한 뒤 되돌린다"

key-files:
  created:
    - test/unit/dayStaticGuard.test.ts
  modified:
    - src/game/verdict.ts
    - src/game/chatUi.ts
    - src/game/scenes.ts
    - src/components/Icon.tsx
    - src/styles/atmosphere.css
    - src/styles/result.css
    - src/debug/sheetDebug.ts
    - test/unit/verdict.test.ts
    - test/unit/scenes.test.ts
    - test/unit/atmosphereCss.test.ts
    - test/unit/chatUi.test.ts
    - test/unit/e2eContract.test.ts
    - test/unit/camera.test.ts
    - test/client/icon.test.tsx
    - test/client/guide.test.tsx
    - test/client/roleCard.test.tsx
    - scripts/e2e/lib.test.mjs
  deleted:
    - src/game/dayTable.ts
    - src/game/recordRows.ts
    - src/game/blankTap.ts
    - src/styles/daytable.css
    - src/styles/verdict.css
    - src/styles/urecord.css
    - test/unit/dayTable.test.ts
    - test/unit/recordRows.test.ts
    - test/client/blankTap.test.ts
    - test/unit/nyquist-05-seats-fit.test.ts
    - test/unit/verdictCss.test.ts

key-decisions:
  - "지울지 남길지는 export 마다 `git grep -w <이름> -- src scripts` 소비자 수로 정했다(A2). 판단표는 아래"
  - "day.css·night.css 는 이 계획이 지우지 않았다: NightPanel 이 import 하고 `.mf-claimpanel__title/__guide`·`.mf-nightpanel`·`.mf-pk` 를 쓴다. 안의 낮 장면 규칙(.mf-dayscene·.mf-sceneintro·.mf-morningcard·.mf-seg·.mf-turnpanel·.mf-ro)은 쓰는 곳이 없는 죽은 규칙이지만 e2eContract 가 day.css 의 157 값을 읽고 있어 08-24 가 E2E 와 함께 정리한다"
  - "VERDICT_TEXT.announce 의 옛 세 단계 키(execVote·candidateVote·candidateVoteReveal)와 scenes.ts PHASE_SCENE 옛 행은 RoomScreen 의 Record<PhaseId,…> 가 PhaseId 와 함께 08-21·22 에서 사라질 때까지 둔다"
  - "daytable.css 의 `.mf-figure--ghost`·`--role` 규칙은 지웠다: ResultScreen 은 result.css 가 `animation: none` 으로 덮어 쓰고 object-fit 은 ds.css `.mf-figure` 가 이미 contain 이다(08-19 가 DayTable 을 지운 뒤 이 CSS 는 import 0 으로 이미 로드되지 않고 있었다)"

requirements-completed: [DAY-07]

duration: 25min
completed: 2026-11-03
---

# Phase 8 Plan 20: 화면 로직·CSS·아이콘 정리와 정적 가드 Summary

**v1.0 테이블 기하·후보 선택 기록 줄·빈 곳 탭 모듈과 daytable·verdict·urecord CSS 를 지우고 verdict.ts 를 결과 화면용 문구만 남게 줄였으며, 지운 화면 이름 열여섯 개의 재등장을 막는 dayStaticGuard 정적 가드를 더했다 — typecheck·vitest 135파일 3690개·node 288개·vite build 초록.**

## Accomplishments

- **Task 1 (a50481c)**: `dayTable.ts`·`recordRows.ts`·`blankTap.ts` 를 `git rm`. `verdict.ts` 를 새로 써서 후보 공개 시간표(revealPlan·revealStateAt·clinch)·기하(candidateCenter·chip·arrow·introCard)·후광(capHalos)·칩/원뿔/카드 상수와 그 import(dayTable·phases 의 후보 공개 상수)를 지웠다. 머리 주석은 "결과 화면·밤 패널·단계 안내 문구만 남았다(08-20)". `chatUi`: `tablePanelHeight` 삭제, `TABLE_PANEL_EXTRA` → `CHAT_PANEL_EXTRA = 92`.
- **Task 2 (cce955a)**: `scenes.ts` 에서 PHASE_INTRO·IntroTone·SceneIntroDef·PHASE_GUIDE_FILL·SCENE_INTRO_MS·아침 밝아짐 상수(MORNING_GLOW_*·morningGlowGradient)와 DAY_ANNOUNCE_MS import 를 지웠다. `daytable.css`·`verdict.css`·`urecord.css` 삭제(import 0 확인), `atmosphere.css` 의 `.mf-morningglow` 두 규칙과 키프레임 삭제. `Icon.tsx` 의 쓰는 곳 없는 아홉 이름(diamond·skip·chat·changed·crown·chevronUp·target·notebook·speech) 삭제. 시험: scenes·atmosphereCss·icon·guide 를 남은 표 기준으로, verdictCss.test 는 파일과 함께 삭제.
- **Task 3 (cbac371, f00d151, 17550bf)**: `dayStaticGuard.test.ts` 신규(위 목록 열여섯 이름 + 지운 파일 열 개가 저장소에 없음). 대상과 함께 시험 삭제, `verdict.test` 는 결과 연출 시각·문구·요약 줄·T-04-40 만 남김(773 → 약 150행). `chatUi`·`e2eContract`·`camera` 시험은 CHAT_PANEL_EXTRA 로.
- **마무리 (17550bf)**: `sheetDebug.screenKind` 에서 지운 `main.mf-dayscene` 선택자를 뺐다. `main.mf-game` → "day" 동작은 그대로(08-13 carry-forward 유지).

## export 판단표 (A2)

| 파일 | 지움(소비자 0) | 남김(소비자) |
|------|----------------|--------------|
| verdict.ts | EXEC_INTRO_MS·NO_EXEC_*·REVEAL_*·CLINCH_*·VERDICT_MOVE/DIM/CONE/BLUR/SCALE·CONE_W/H·GHOST_FADE_MS·INTRO_*·CHIP_*·RESULT_BANNER_MS·RESULT_FLIP_MS·RESULT_REDUCED_FADE_MS, 전 후보 공개·기하·후광 함수/타입, candidateSeatLabel·defenseStatus·defenseDisconnected·defenseStartLine·defenseInstruction·execTallyText·revealIntroHint·revealCaption·revealResultLine, VERDICT_TEXT 의 execTitle 외 열세 키 | RESULT_FLIP_AT_MS·RESULT_SUMMARY_AT_MS·UNKNOWN_NAME·VERDICT_TEXT(candidateNone·votedSuffix·endedTitle·summaryTitle·homeButton·roomCloseNote·announce)·defenseAnnounce·noExecutionPrefix(+noExecutionText·endedAnnounce 내부)·winnerText·summaryLines·endedSubtitle (ResultScreen·RoomScreen·NightPanel) |
| scenes.ts | PHASE_INTRO·IntroTone·SceneIntroDef·PHASE_GUIDE_FILL·SCENE_INTRO_MS·MORNING_GLOW_*·morningGlowGradient | SCENES·SCENE_IDS·PHASE_SCENE·sceneOfPhase·TIMELESS_PHASES(E2E 사본 대조)·SCENE_FADE_MS·SCENE_IMAGE_WAIT_MS·HEADER_SCRIM_*·headerScrimGradient·NIGHT_VIGNETTE_*·nightVignetteGradient (Backdrop·assets·ResultScreen·backdropContrast 시험) |
| Icon.tsx | diamond·skip·chat·changed·crown·chevronUp·target·notebook·speech | back·share·close·copy·check·card·disconnected·plus·minus·wrench |

## 지운 시험 파일

| 파일 | 이유 |
|------|------|
| test/unit/dayTable.test.ts | 대상(game/dayTable) 삭제 |
| test/unit/recordRows.test.ts | 대상(game/recordRows) 삭제 |
| test/client/blankTap.test.ts | 대상(game/blankTap) 삭제 — 테이블 빈 곳 탭 |
| test/unit/nyquist-05-seats-fit.test.ts | 테이블 좌석 배치(daySeatLayout) 전용 |
| test/unit/verdictCss.test.ts | 지운 verdict.css·낮 장면 클래스 전용 |
| test/client/testToolsCompact.test.tsx | 08-19 에서 이미 삭제(A1: testButtonCompact 뜻 소멸) |

## Deviations from Plan

**1. [Rule 3 - 막는 문제] 계획이 닿지 않은 시험·스크립트 시험 보정**
- **Found during:** Task 3 전체 검증
- **Issue:** `test/client/roleCard.test.tsx` 의 아이콘 목록에 `diamond`(지운 이름), `test/unit/camera.test.ts` 가 `tablePanelHeight`(지운 함수)를 씀. `scripts/e2e/lib.test.mjs` 의 한 시험이 지운 verdict.ts 상수 원문(VERDICT_DIM_PERCENT 등)을 읽어 NaN.
- **Fix:** roleCard 목록에서 diamond 제거, camera 시험은 `logHeightFor(h) + CHAT_PANEL_EXTRA`, lib.test 는 원문 대조 대신 같은 값(45%·3px·1.7)을 리터럴로 고정(변론 검사 D* 자체는 08-24 가 다시 짓는다).
- **Files modified:** test/client/roleCard.test.tsx, test/unit/camera.test.ts, scripts/e2e/lib.test.mjs
- **Commit:** f00d151

**2. [Rule 3 - 막는 문제] 이 계획과 무관한 기존 실패 하나 수정**
- **Issue:** `scripts/e2e/lib.test.mjs` 의 "EXPECTED_SCENE: 단계 열세 개" 가 08-02 가 lib.mjs 에 `nomination`·`verdict` 행을 더한 뒤로 실패(단계 15개). 이 계획의 변경과 무관하지만 계획 검증 명령(`node --test …`)에 들어 있어 통과해야 한다.
- **Fix:** 기대 목록에 두 단계 추가(열다섯 개).
- **Commit:** f00d151

**3. [계획 사실 보정] GamePanel·camera.ts·TestTools·NightPanel 은 바꿀 것이 없었다**
- 계획은 `TABLE_PANEL_EXTRA` 를 GamePanel·camera.ts 가 쓴다고 적었으나 src 에서 `chatUi` 안 자기 자신 외 소비자가 없었다(채팅 패널 높이는 GameMap 이 `LOG_H_KB`·logH 로 다룬다). TestTools 의 testButtonCompact 는 08-19 가 이미 지웠고 NightPanel 은 이미 남은 키(candidateNone·votedSuffix)만 쓴다. 그래서 이 네 파일은 수정하지 않았다.

**4. [Rule 2 - 정합성] result.css 주석, atmosphere.css, sheetDebug 선택자**
- result.css 주석이 지운 상수 `RESULT_BANNER_MS` 를 가리켜 이름만 뺐다. atmosphere.css 는 아침 밝아짐 규칙이 상수 삭제와 함께 완전히 죽어 같이 지웠다. sheetDebug 의 `main.mf-dayscene` 선택자는 `main.mf-game` 만 남겼다(동작 불변, carry-forward 유지).

**Total deviations:** 4 (Rule 3 두 건, 계획 사실 보정 한 건, 정합성 한 건). **Impact:** 범위가 파일 몇 개 넓어졌을 뿐 동작 변화 없음.

## TDD Gate Compliance

Task 3 의 dayStaticGuard 는 삭제 이후에 만들어서 이름이 이미 없으므로 처음부터 통과한다. RED 증거는 `src/game/chatUi.ts` 에 `export const tablePanelHeight = 1;` 를 임시로 넣어 "src·shared 의 .ts·.tsx 주석 밖 코드에 지운 이름이 없다" 가 `AssertionError: expected 'src/game/chatUi.ts:tablePanelHeight' to be ''` 로 실패함을 확인한 뒤 되돌린 것이다(커밋하지 않음). 가드 커밋(cbac371, test) → 정리 커밋(f00d151, refactor) 순서다. Task 1·2 는 삭제·이름 바꾸기라 새 동작이 없고 기존 시험이 게이트다.

## Task Commits

| 작업 | 커밋 | 내용 |
|------|------|------|
| 1 | a50481c | refactor: 테이블·후보 선택 로직 삭제, verdict.ts 축소, CHAT_PANEL_EXTRA |
| 2 | cce955a | refactor: 장면 표·CSS 3개·아이콘·아침 밝아짐 정리 |
| 3 가드 | cbac371 | test: dayStaticGuard |
| 3 정리 | f00d151 | refactor: 지운 화면 로직 시험 삭제와 남은 시험 정리 |
| 마무리 | 17550bf | refactor: sheetDebug 선택자 |

## Verification

- `npm run typecheck`(tokens:check·wrangler types·두 tsc, 시험 포함) 통과
- `npx vitest run` 135파일 3690개 통과(1 skipped 는 `camera.test.ts` 의 기존 출력용 항목). 08-19 가 적은 `test/worker/testTools.test.ts` 간헐 시간 초과는 이번 전체 실행에서 나오지 않았다
- `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs` 288개 통과 · `npx vite build` 통과
- 인수 기준: dayTable·recordRows·blankTap 없음 · `CHAT_PANEL_EXTRA = 92` 있음 · summaryLines·winnerText 유지 · CSS 3개 없음 · src 에 daytable/verdict/urecord.css 참조 0(rc 1) · sceneOfPhase 유지 · dayStaticGuard 있음(`foundIdentifiers` 포함) · 지운 시험 5개 없음 · test 에 `.skip(`·`.todo(` 0(rc 1)

## Deferred Issues

- `src/styles/day.css`·`night.css` 안의 낮 장면 죽은 규칙(.mf-dayscene·.mf-sceneintro·.mf-morningcard·.mf-seg·.mf-turnpanel·.mf-ro 등)과 `testtools.css` 주석의 DayTable 언급: 08-24(E2E 재구성)가 `e2eContract` 의 day.css 157 대조와 함께 정리한다. 코드가 아니라 CSS 규칙·주석이라 dayStaticGuard 에는 걸리지 않는다.
- `scripts/e2e/lib.mjs`·`browser.mjs` 의 옛 사본(TABLE_PANEL_EXTRA·tablePanelHeight·CANDIDATE_GUIDE·BLANK_TAP_E2E_MARGIN·INTRO_GONE_MS·`.mf-dayscene` 선택자): 08-24 몫. e2eContract 는 `lib.TABLE_PANEL_EXTRA` 를 `CHAT_PANEL_EXTRA` 와 대조하도록 이미 맞췄다.
- 주석에 남은 지운 이름(useDayFx·useChat·GameMap·RoomScreen·Backdrop 의 DayScene/DayTable 언급): 가드가 주석을 허용하므로 두었다.

## Known Stubs

None.

## Threat Flags

None — 코드 삭제와 시험 정리뿐. 새 네트워크·인증 경로 없음, 패키지 설치 없음(T-08-SC). T-08-49 는 dayStaticGuard 로, T-08-50 은 결과 화면 문구 export 유지와 vite build 통과로 막았다.

## Self-Check: PASSED

- 파일 있음: test/unit/dayStaticGuard.test.ts, src/game/verdict.ts, src/game/chatUi.ts, src/game/scenes.ts
- 삭제 확인: src/game/{dayTable,recordRows,blankTap}.ts, src/styles/{daytable,verdict,urecord}.css
- 커밋 5개 HEAD 의 조상: a50481c, cce955a, cbac371, f00d151, 17550bf
