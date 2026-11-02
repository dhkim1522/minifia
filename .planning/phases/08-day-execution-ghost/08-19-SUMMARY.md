---
phase: 08-day-execution-ghost
plan: "19"
subsystem: client-screens-cleanup
tags: [cleanup, v1-screens, delete, assigning, roomscreen]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-27 이 옛 화면 시험을 먼저 지우거나 게임 맵 시험으로 옮김, 08-13~18 의 GameMap 라우팅
provides:
  - v1.0 고정 테이블 화면 코드(낮 장면·처형 여부 투표·후보 선택·한 표씩 공개 등) 열세 파일이 저장소에 없다
  - 역할 배정 화면은 테이블 없이 배경·머리 막대·빈 패널·맥박 링·안내 문구만 보인다(사용자 확정 임시 처리)
  - RoomScreen 은 게임 단계 전부를 GameMap 으로만 그리고 옛 투표 세 단계 분기가 없다
affects: [08-20 화면 로직 파일 정리 (game/dayTable·blankTap·day.css 등), 08-21·22 서버 옛 흐름·PhaseId 정리, 08-24 E2E]

actuals:
  tokens: 14000
  tasks: 2
  commits: 3
plan_head_before: 90e22a82bd3ab801424ff26220a6341225117dbf
plan_head_after: f02e25e52299345253a06f1b0cbbcb5eb6f4c70a

tech-stack:
  added: []
  patterns:
    - "지운 화면을 가리키던 부정 단언은 남기되 클래스 이름 대신 남는 부품(.mf-dt)과 맵 루트(main.mf-game)로 본다"

key-files:
  created: []
  modified:
    - src/screens/Assigning.tsx
    - src/styles/phase.css
    - src/screens/RoomScreen.tsx
    - src/components/TestTools.tsx
    - src/styles/testtools.css
    - test/client/stageBox.test.tsx
    - test/client/phaseScreens.test.tsx
    - test/client/roleCardFlow.test.tsx
    - test/client/gameMap.test.tsx
    - test/client/nightMap.test.tsx
    - test/client/verdictScreen.test.tsx
    - test/client/resultScreen.test.tsx
    - test/client/worldStage.test.tsx
    - test/client/icon.test.tsx
  deleted:
    - src/screens/DayScene.tsx
    - src/screens/verdictScene.tsx
    - src/components/DayTable.tsx
    - src/components/ExecVotePanel.tsx
    - src/components/CandidateVotePanel.tsx
    - src/components/ExecIntroCard.tsx
    - src/components/NoExecutionCard.tsx
    - src/components/RevealLayer.tsx
    - src/components/UserRecordSheet.tsx
    - src/components/ReadOnlyRow.tsx
    - src/components/SceneIntro.tsx
    - src/components/MorningCard.tsx
    - src/net/useRevealState.ts
    - test/client/testToolsCompact.test.tsx

key-decisions:
  - "역할 배정 화면은 사용자 확정(2026-11-02)대로 테이블 상자만 뺐다. 새 배치·장식을 만들지 않았고, 빈 패널은 margin-top auto 하나로 맨 아래 위치를 지켰다(테이블 상자가 flex 1 로 밀어 주던 자리)"
  - "[테스트] 버튼 좁힘(짧은 장면에서 글자 숨김)은 지운 낮 장면 상자(.mf-dayscene__scene)에서만 닿던 처리라 TestTools·testtools.css·그 시험을 함께 지웠다. testButtonCompact 함수 자체는 src/game/dayTable.ts 에 남아 08-20 이 그 파일과 함께 정리한다"

requirements-completed: []

duration: 12min
completed: 2026-11-03
---

# Phase 8 Plan 19: v1.0 낮·처형 화면 삭제 Summary

**역할 배정 화면에서 v1.0 테이블 상자를 빼고(사용자 확정 임시 처리), 낮 장면·처형 여부 투표·후보 선택·한 표씩 공개 화면 파일 열세 개를 지우고 RoomScreen 을 GameMap 단일 경로로 정리했다 — 두 tsc·전체 시험(139파일 3921개)·빌드가 초록이다.**

## Accomplishments

- **Task 1 (역할 배정)**: Assigning 에서 테이블 컴포넌트·좌석 배열·장면 상자 div 를 지우고 머리 주석을 "08-19 에 뺐다 — 사용자 확정 임시 처리(UI-SPEC A1 과 같음)" 로 고쳤다. phase.css 장면 상자 규칙(넓은 폭·좁은 폭)을 지우고 머리 막대·빈 패널·어두운 막·맥박 링·안내 문구·`data-guide` 는 그대로 뒀다. `stageBox.test` 의 "좌우 여백 12 / flex 1" describe(역할 배정 장면 상자 한 행뿐)를 지웠다 — 지운 상자의 기하 단언이라 맵 화면에 대응하는 뜻이 없다(맵 틀 값은 gameMap 시험의 측정이 지킨다).
- **Task 2 (삭제)**: 13개 파일을 `git rm`. 지우기 직전 소비자 재grep 에서 interfaces 목록 밖 import 는 0 이었다(남은 이름 언급은 주석뿐). RoomScreen 은 DayScene import·`execVote`/`candidateVote`/`candidateVoteReveal` case·sceneKey "dayScene" 을 지웠고 옛 세 단계 이름은 default 의 연결 중 화면이다. `PHASE_ANNOUNCE` 의 옛 문구는 `game/verdict`(남는 모듈)를 쓰므로 그대로다.
- **남긴 것 확인**: PhaseBar·Timer·Backdrop·recordsSeen·NightPanel·Figure 모두 있음.

## 08-27 이 넘긴 시험의 분담 (carry-forward)

| 파일 | 처리 | 이유 |
|------|------|------|
| test/client/phaseScreens.test.tsx S-04 | 이 계획 | 배정 화면의 `.mf-assign__scene > .mf-dt` 단언을 "테이블·장면 상자 없음" 으로 뒤집음(RED 커밋 2704711). 그 파일의 `.mf-phasebar` CSS 단언은 PhaseBar 가 남아 그대로(통과) |
| test/client/stageBox.test.tsx 배정 행 | 이 계획 | 위 Task 1 |
| test/client/roleCardFlow.test.tsx | 이 계획 | "옛 투표 단계" 글자 모양 시험이 지운 execVote 화면에 의존 → 역할 확인(글자 있는 틀)로 옮김 |
| test/client/testToolsCompact.test.tsx | 이 계획 | 지운 낮 장면 상자 클래스를 앵커로 쓰던 [테스트] 버튼 좁힘 — 처리와 시험을 함께 지움(deviation 1) |
| test/client/resultScreen·gameMap·nightMap·verdictScreen·worldStage·icon·phaseScreens | 이 계획 | 지운 화면 이름이 남은 주석·부정 단언·describe 제목을 정리(인수: test/client 에 `mf-dayscene`·`DayTable`·`DayScene` 0건) |
| test/unit/{dayTable,verdict,verdictCss,e2eContract,nyquist-05-seats-fit}.test.ts | **08-20 로 남김** | 지운 건 화면 파일뿐이라 이 시험들이 읽는 `day.css`·`daytable.css`·`verdict.css`·`src/game/dayTable` 은 그대로 있고 전부 초록. 그 파일들은 game 로직·CSS 정리(08-20) 몫 |

## Deviations from Plan

**1. [Rule 3 - 막는 문제] [테스트] 버튼 좁힘 처리 삭제 (계획 files_modified 밖)**
- **Found during:** Task 2 인수 grep (`test/client` 에 `mf-dayscene` 0건)
- **Issue:** `src/components/TestTools.tsx` 의 `SCENE_SELECTOR = ".mf-dayscene__scene"` 가 지운 낮 장면 상자를 찾아 짧은 장면에서 버튼 글자를 숨겼다. 맵 화면에는 그 상자가 없어 이 코드는 어디서도 닿지 않고, 이를 검사하는 `testToolsCompact.test` 는 지운 클래스 이름 없이는 쓸 수 없었다.
- **Fix:** TestTools 의 `useLayoutEffect`·`compact` 상태·`data-compact`·`testButtonCompact` import 와 `testtools.css` 의 `[data-compact]` 두 규칙, `testToolsCompact.test.tsx` 를 지웠다. 맵 화면의 버튼은 변함 없음(좁힘은 늘 꺼져 있었다). `testButtonCompact` 함수와 `test/unit/dayTable.test.ts` 의 그 단위 시험은 08-20 이 `game/dayTable` 과 함께 정리한다.
- **Files modified:** src/components/TestTools.tsx, src/styles/testtools.css, test/client/testToolsCompact.test.tsx(삭제)
- **Commit:** f02e25e

**2. [Rule 1 - 레이아웃] 빈 패널에 `margin-top: auto`**
- **Issue:** 테이블 상자가 `flex: 1` 로 남는 높이를 차지해 빈 패널을 아래로 밀고 있었다. 상자를 빼면 패널이 머리 바로 밑으로 올라온다.
- **Fix:** 패널 규칙에 `margin-top: auto` 한 줄. 새 배치가 아니라 "지금 화면에서 테이블 상자만 뺀 모양" 을 지키는 것이다. 주석도 그에 맞게 고쳤다.
- **Commit:** 5b529d4

**3. [Reconciliation] `roleCardFlow` 의 "옛 투표 단계" 행은 지우지 않고 역할 확인으로 옮김** — 글자 모양(아이콘 20 + 글자 `역할 카드`) 단언은 살아 있는 역할 확인 화면에서 같은 뜻이라 건너뛰기·삭제 대신 옮겼다.

## TDD Gate Compliance

Task 1 의 화면 변경은 RED(2704711, 배정 화면에 테이블 상자 없음 단언이 실패) → GREEN(5b529d4) 순서를 지켰다. Task 2 는 삭제 계획이라 새 동작이 없고 기존 시험이 게이트다.

## Task Commits

| 작업 | 커밋 | 내용 |
|------|------|------|
| 1 RED | 2704711 | test: 역할 배정 화면에 테이블 상자가 없음을 고정 |
| 1 GREEN | 5b529d4 | feat: 역할 배정 화면에서 v1.0 테이블 상자를 뺌 |
| 2 | f02e25e | refactor: v1.0 낮·처형 화면 파일 13개 삭제와 RoomScreen 정리 |

## Verification

- `npm run typecheck`(tokens:check·wrangler types·두 tsc, 시험 포함) 통과 · `npx vite build` 통과
- `npx vitest run` 139파일 3921개 통과(1 skipped 는 `camera.test.ts` 의 기존 출력용 항목). 단 `test/worker/testTools.test.ts` 의 "ended 에서 testReset / testSkip" 이 전체 실행에서 번갈아 시간 초과(`nextFrame: 제한 시간 안에 맞는 프레임이 오지 않았다`)로 실패했다. 단독 실행은 31개 모두 통과(두 번 중 한 번 실패, 한 번 통과)하는 부하 의존 불안정이고, 워커·shared 코드와 이 계획의 `src` 변경은 무관하다(워커 시험은 `src/` 를 import 하지 않음). 이 계획이 고치지 않는다 — 아래 Deferred
- 인수 기준: 13개 삭제 확인 · 남길 6개 있음 · 지운 파일 import 0(`git grep` rc 1) · `test/client` 에 `mf-dayscene`·`DayTable`·`DayScene` 0건(rc 1) · 누설 시험 3파일 `git diff --quiet HEAD` 성공 · `.skip(`·`.todo(` 0건 · Assigning 에 `mf-assign__pulse`·`data-guide`·`mf-assign__panel` 유지

## Deferred Issues

- `test/worker/testTools.test.ts` 전체 실행 시 간헐 시간 초과(`driveToEnded` 가 단독 실행에서도 약 30초 걸리는 무거운 시험). 부하 조건에서만 실패. 별도 정리 대상(타임아웃 또는 시험 분할)이며 이 계획 범위 밖이다.
- `src/game/blankTap.ts`·`src/debug/sheetDebug.ts`·`src/styles/{day,daytable,night,verdict,atmosphere}.css` 에 지운 화면의 이름·클래스가 주석이나 죽은 규칙으로 남아 있다 — 08-20(화면 로직 파일·CSS 정리) 몫.

## Known Stubs

None.

## Threat Flags

None — 코드 삭제만. 새 네트워크·인증 경로 없음, 패키지 설치 없음(T-08-SC). 누설 시험 3파일 diff 0(T-08-48).

## Self-Check: PASSED

- 파일 있음: src/screens/Assigning.tsx, src/screens/RoomScreen.tsx, src/components/{PhaseBar,Timer,Backdrop,NightPanel,Figure}.tsx, src/net/recordsSeen.ts
- 삭제 확인: 화면 파일 13개와 test/client/testToolsCompact.test.tsx 없음
- 커밋 3개 HEAD 의 조상: 2704711, 5b529d4, f02e25e
