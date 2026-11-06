---
phase: 08-day-execution-ghost
plan: "23"
subsystem: e2e-harness
tags: [e2e, lib, deletion, game-map-checks, approved-relaxations, 0056]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-22 옛 단계 이름 삭제와 옛 방 정규화, 08-20 화면 정리, 08-07 테스트 방 칩 이름
provides:
  - 결정 0056 승인 완화 다섯 항목(D9·D3b·G2·D2·P10 8ch)과 WIDE_NAME_GRAPHEMES·이름 폭 판정이 lib 에서 사라지고 G2 는 완화 없이 판정한다
  - 테이블 전용 판정·상수(PANEL_H 157·HEADER_H·TABLE_PANEL_EXTRA·dayChecks·후보 공개·빈 곳 탭 등)와 대응 시험 삭제, 채팅 패널 덧셈은 CHAT_PANEL_EXTRA 92
  - 옛 테이블 게임 흐름 열한 개와 전용 읽기 도우미 삭제 (남은 흐름 lobby·world·chat-lobby·chat-ime·chat-keyboard·reconnect·deployhold·perfbudget·pc·wakelock)
  - 맵 게임 판정 순수 함수 다섯(gamePanelHeight·pickButtonChecks·announceChecks·ghostDomChecks·verdictPanelChecks)과 GAME_PANEL_EXTRA
  - selectFlows 의 --only 가 쉼표로 여러 흐름을 받는다
affects: [08-24 새 맵 게임 흐름(day·ghost·noexec·night-roles·result·chat-game), 08-25 gallery.mjs]

actuals:
  tokens: 5636
  tasks: 3
  commits: 3
plan_head_before: 2ecdbd1377085a38c4f3377f3de378fbcac5fde1
plan_head_after: b1656a773dcb7157cdba60af7e4692c34c250f26

tech-stack:
  added: []
  patterns:
    - "순수 판정은 { id, label, ok, detail } 줄 목록을 돌려주고 값이 없으면 `측정값 없음(…)` 으로 실패한다(기존 규칙 그대로)"
    - "lib.mjs 의 앱 상수 사본은 test/unit/e2eContract.test.ts 가 앱 값과 비교한다 (GAME_PANEL_EXTRA 의 채팅·토론 값 포함)"

key-files:
  created: []
  modified:
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/flows.mjs
    - scripts/e2e/browser.mjs
    - test/unit/e2eContract.test.ts

key-decisions:
  - "삭제 기준은 export 마다 남은 흐름(flows.mjs 의 남는 흐름·gallery·perf-run)과 시험의 소비자 수다(계획 가정 A1). 판단표는 아래 '삭제·보존 판단표'"
  - "역할 카드·일지 판정(roleCardButtonChecks·roleCardTabChecks·journalChecks)도 소비 흐름이 0 이라 지웠다 — collectSnapshot 도 G 묶음과 테스트 시트 몫만 남겼다. 역할 카드 화면 검사가 필요해지면 맵 화면 기준으로 새로 짓는다"
  - "남은 승인 완화 네 항목(M1·D3a/D3b·D4·D3b-5)과 D3B_FLOOR_5_PLAYERS 상수는 그대로 둔다 — 사용자 승인 목록은 이 계획이 건드리지 않고 0056 다섯 항목만 지웠다"
  - "계획에 없던 selectFlows 쉼표 지원을 더했다(Rule 3): 계획의 검증 명령 `--only lobby,chat-lobby` 가 쉼표 목록을 쓰는데 옛 구현은 부분 문자열 하나만 받아 첫 흐름만 돌았다"

requirements-completed: [DAY-07]

duration: 약 85분
completed: 2026-11-03
---

# Phase 08 Plan 23: E2E 하네스에서 고정 테이블 걷어 내기와 맵 게임 판정 Summary

결정 0056 완화 다섯 항목과 테이블 전용 판정·상수·흐름·읽기 도우미를 E2E 하네스에서 지우고, 맵 게임 화면용 순수 판정 다섯 개(패널 높이·지목 버튼·결과 알림·유령 누설·찬반 패널)를 시험과 함께 먼저 고정했다.

## Accomplishments

- **옛 흐름 삭제 (커밋 98db069):** police5·citizen4·mafia8·doctor5·spec4·vote5·noexec·result-c·result-m·chat-table·chat-ghost 열한 흐름과 그 전용 도우미(flows.mjs 2674 → 1448줄), browser.mjs 의 테이블 장면·처형 구간 읽기(readTablePanel·tapSeat·inspectSeat·readVerdict·readStage·voteAs·pickCandidate 등)를 지웠다. `setBotVote` 선택자를 새 그룹 이름 "봇 찬반"·"봇 지목"으로 고쳤다(08-07).
- **lib 정리 (커밋 9626216):** APPROVED_RELAXATIONS 에서 0056 다섯 항목, WIDE_NAME_GRAPHEMES·isWideName·isWideTag, genericIssues 의 G2 완화 분기(`fixedTagName` 포함)를 지웠다. 테이블 판정·상수를 지우고 `export const CHAT_PANEL_EXTRA = 92` 로 이름을 맞췄다. lib.test.mjs 240 → 135개(지운 판정의 시험만 삭제), e2eContract 의 사본 검사는 CHAT_PANEL_EXTRA·LOBBY_PANEL_EXTRA·LOG_H_*·KB 값을 앱과 비교한다(day.css 157 읽기와 TABLE_PANEL_EXTRA 사본 검사 삭제).
- **맵 판정 다섯 (커밋 b1656a7):** `gamePanelHeight(roomH, kind)` = LOG_H + {talk 154, chat 92, verdictVoter 203, verdictViewer 111} (UI-SPEC 여섯 폰 값 표 전부 시험), `pickButtonChecks`(PK1 개수 1~8·PK2 44×44(G3 와 같은 0.5px 오차)·PK3 겹침 없음), `announceChecks`(AN1 36px·AN2 한두 줄·AN3 keep-all), `ghostDomChecks`(GH1~GH4 산 사람 화면 0건), `verdictPanelChecks`(VP1·VP2 투표자/보기/키보드 열림).
- **--only 쉼표:** `selectFlows` 가 `--only day,ghost` 처럼 쉼표 목록을 받는다(시험 추가).

## 삭제·보존 판단표 (A1)

| 대상 | 판단 | 근거 |
|------|------|------|
| dayChecks·morningCardIssues·dimChecks·morningGoneChecks·feltStable·feltGapChecks·stageStable·sceneIntroChecks·haloChecks·crownChecks·turnChecks·inspectChecks·noNightNoticeChecks·spectatorChecks·livingRoleArtChecks | 삭제 | 소비 흐름 0 (테이블 장면 전용) |
| voteChecks·introChecks·candidateChecks·revealChecks·defenseChecks·executionChecks·voidCardChecks·placementChecks·colorRuleChecks | 삭제 | 옛 처형 구간 전용 |
| INTRO_GONE_MS·CANDIDATE_REVEAL_TIMING·candidateRevealMs·CANDIDATE_GUIDE·BLANK_TAP_E2E_MARGIN·blankPointsOf·candidateGuideChecks·cancelTapChecks | 삭제 | 후보 공개·빈 곳 탭 (08-22 가 앱 쪽을 지움) |
| vignetteChecks·glowChecks·backdropSceneChecks·tagsOverlap | 삭제 | 소비 흐름 0 (읽기 도우미를 지움). EXPECTED_SCENE 은 scenes.test.ts 가 쓰므로 보존 |
| PANEL_H 157·HEADER_H 119.2·TABLE_PANEL_EXTRA·tablePanelHeight·expectedPanelH·AMBER_RGB·SIDE_GAP_MIN·FACE_RATIO·faceRegion | 삭제 | 테이블 기하 |
| roleCardButtonChecks·roleCardTabChecks·journalChecks | 삭제 | 소비 흐름 0 (계획의 '남길 후보'는 남은 흐름이 쓰면이라는 조건부였다) |
| rectsOverlap·rectInside·genericIssues·smallTextIssues·headerContrastChecks·resultChecks·guideChecks·docHeightChecks·world·lobby·reconnect·perf 판정 | 보존 | 남은 흐름이 쓰거나(resultChecks 는 A2, 08-24 결과 흐름이 쓴다) 시험·앱 사본 검사가 쓴다 |
| isOneLine·lineCount·ONE_LINE_FACTOR | 보존 | 링크 참가·헤더 안내 한 줄 판정이 쓴다 |
| D3B_FLOOR_5_PLAYERS·APPROVED_RELAXATIONS 네 항목 | 보존 | 사용자 승인 목록 — 이 계획은 0056 다섯 항목만 지운다 |

## T-08-54 확인 (E2E 기준·완화 목록 diff)

- 지운 완화는 D9-8ch·D3b-8ch·G2-8ch·D2-8ch·P10-8ch 다섯뿐이고, 남은 목록은 `["M1", "D3a/D3b", "D4", "D3b-5"]` 로 시험이 고정한다. `grep '"(D9|D3b|G2|D2|P10)-8ch"'` 는 lib·시험에서 0건이다.
- 기준 수치: OVERLAP_EPS 0.5·TAP_MIN 44·ONE_LINE_FACTOR 1.6·HEADER_CONTRAST_MIN 4.5·D3B_FLOOR_5_PLAYERS 0.98 불변(시험이 고정). 이름표 8자 판·화면 가로 기준은 낮추지 않았고 G2 는 이제 이름 길이로 봐 주지 않는다(시험 추가).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] --only 쉼표 목록**
- **Found during:** Task 2 검증
- **Issue:** 계획 검증 명령 `--only lobby,chat-lobby` 가 쉼표 목록인데 옛 selectFlows 는 부분 문자열 하나만 받아 `lobby` 한 흐름만 돌았다(08-24 의 `--only day,ghost,...` 도 같은 문제)
- **Fix:** selectFlows 가 쉼표로 나눠 하나라도 맞으면 고르게 했다(단일 값 동작 불변), 시험과 USAGE 문구 갱신
- **Files modified:** scripts/e2e/lib.mjs, scripts/e2e/lib.test.mjs
- **Commit:** 9626216

**2. [Rule 3 - 순서] 커밋 순서를 Task 2 → Task 1 → Task 3 으로 했다**
- lib 에서 상수를 먼저 지우면 flows.mjs 의 import 가 깨져 중간 커밋이 돌지 않는다. 흐름을 먼저 지우고(98db069) lib 를 지웠다(9626216). 계획 내용은 같다.

**3. [Rule 1 - 범위] collectSnapshot 축소와 역할 카드 판정 삭제**
- 테이블 장면 읽기(collectSnapshot 의 좌석·이름표·후광·역할 카드 필드)는 남은 흐름의 소비가 G 묶음과 테스트 시트뿐이라 그 몫만 남겼다(계획 interfaces 가 'collectSnapshot 테이블 장면 읽기' 를 지울 대상으로 적음). 이 때문에 역할 카드·일지 판정도 소비자가 없어 함께 지웠다.

### 이 계획 범위 밖으로 둔 것

- `src/styles/day.css` 의 죽은 `.mf-dayscene`·`.mf-sceneintro` 규칙은 이 계획의 files_modified 밖이고 TestTools.tsx·night.css 도 이름을 언급해 건드리지 않았다. e2eContract 는 더 이상 day.css 의 157 을 읽지 않는다(후속 정리 후보).
- `scripts/gallery.mjs` 는 지운 browser.mjs 도우미(voteAs·pickCandidate·inspectSeat·tapSeat)를 구조 분해로 받는다 — 가정 A3 대로 돌지 않는 상태이고 08-25 가 맵 화면 기준으로 고친다.
- 08-24 가 결과 흐름에서 resultChecks 를 쓰려면 `readVerdict` 가 하던 결과 화면 읽기(`result` 객체)를 새 도우미로 다시 지어야 한다(옛 구현은 git 이력에 있다).

## 검증

- `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs` 195 통과 (lib.test.mjs 147개, 그중 새 판정 11개)
- `npx vitest run` 135 파일 중 134 통과 — test/worker/bots.test.ts 한 건이 전체 실행에서만 시간 초과로 실패했고 파일 단독 재실행은 22개 통과(알려진 flaky)
- `npm run typecheck` 통과
- 로컬 서버(`npm run dev`, 이 실행이 띄움)에서 남은 흐름 전체 `npm run e2e -- --url http://localhost:5173`: 356초, 'E2E OK' (lobby·world·chat-lobby·chat-keyboard 6개 크기 전부 통과, chat-ime·pc·wakelock·perfbudget·reconnect 통과)
- 인수 확인: 0056 문자열 0건, WIDE_NAME_GRAPHEMES 0건, `CHAT_PANEL_EXTRA = 92`, 옛 흐름 id 11건 0건, lobby·reconnect id 남음

## Known Stubs

없음.

## Threat Flags

없음 (패키지 설치 없음, 새 네트워크·신뢰 경계 없음).

## Self-Check: PASSED

- 커밋 존재: 98db069, 9626216, b1656a7 (모두 HEAD 의 조상)
- 파일 존재: scripts/e2e/lib.mjs (`export function pickButtonChecks`·`ghostDomChecks`·`gamePanelHeight`), scripts/e2e/lib.test.mjs, test/unit/e2eContract.test.ts (`CHAT_PANEL_EXTRA`)
