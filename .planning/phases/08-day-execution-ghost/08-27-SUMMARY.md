---
phase: 08-day-execution-ghost
plan: "27"
subsystem: client-test-cleanup
tags: [tests, gamemap, cleanup, v1-screens, characterization]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-13~18 게임 맵 시험(gameMap·nominationScreen·verdictScreen·ghostView·nightMap)과 GameMap·GamePanel 라우팅, 08-13·08-18 이 먼저 옮기거나 지운 옛 화면 시험 정리
provides:
  - 옛 낮 토론·밤·변론 화면 시험에서 사용자에게 보이는 뜻을 gameMap·nightMap·verdictScreen 으로 옮김(it 10개)
  - 남는 화면 시험 아홉 파일(nightChat·atmosphere·guide·phaseArrival·stageBox·testTools·roomScreen·roleCardFlow·characterAudit)이 지울 v1.0 화면 모듈과 클래스에 기대지 않음
  - 고정 테이블 화면만 검사하던 시험 16파일과 test/helpers/verdictViews.ts 삭제(src 의 v1.0 화면 파일 열세 개는 그대로 — 08-19 가 지운다)
affects: [08-19 v1.0 고정 테이블·처형 화면 삭제 (아래 '08-19 로 넘기는 것' 참고), 08-24 E2E]

actuals:
  tokens: 36000
  tasks: 3
  commits: 3
plan_head_before: 48e9f81436e91060089b3cc350387befe4d6ba55
plan_head_after: c5e7f74b57291ebd00a4ade4e55057d0524f898e

tech-stack:
  added: []
  patterns:
    - "RoomScreen 을 거쳐 GameMap 을 그리고, 채팅 줄·입력 중 신호는 연결의 onEvent 구독자 전원에게 같은 프레임을 보내 흘린다(방 화면과 맵 화면이 각각 구독)"
    - "분위기(밤 어두움·아침 밝음) 시험은 DOM 층이 아니라 가짜 런타임이 받은 장면 표의 lighting 값으로 본다"

key-files:
  created: []
  modified:
    - test/client/gameMap.test.tsx
    - test/client/nightMap.test.tsx
    - test/client/verdictScreen.test.tsx
    - test/client/nightChat.test.tsx
    - test/client/atmosphere.test.tsx
    - test/client/guide.test.tsx
    - test/client/characterAudit.test.tsx
    - test/client/stageBox.test.tsx
    - test/client/phaseArrival.test.tsx
    - test/client/phaseScreens.test.tsx
    - test/client/testTools.test.tsx
  deleted:
    - "test/client/{candidateVote,dayScene,dayTable,defense,discussion,execIntro,execution,morning,nightScene,noExecution,reveal,revealLayer,sceneIntro,userRecordSheet,execVote,verdictStates}.test.tsx"
    - test/helpers/verdictViews.ts

key-decisions:
  - "phaseScreens.test.tsx 는 지우지 않고 남긴다: 08-13·08-18 이 낮·밤 DayScene 시험을 이미 맵 기준으로 옮겨서, 지금 이 파일 44개는 역할 확인·배정·대기실 연결·[역할 카드] 시트·단계 전환 같은 살아 있는 화면을 본다. 지우면 지울 화면과 무관한 시험을 잃는다"
  - "맵 화면의 '화면당 [data-guide] 하나' 예외는 08-18 이 알린 아침 외에 낮 시작·처형 두 단계가 더 있다(산 사람 0개, 유령만 하나). 08-UI-SPEC 단계표가 '안내 없음' 으로 정한 단계라 src 를 고치지 않고 점검표에 예외로 고정했다"
  - "분위기 시험(atmosphere)은 맵의 조명 값(talk·vote·trial·night·morning)으로 옮기고, 옛 비네팅·밝아짐 층이 맵 화면 어느 단계에도 없음을 함께 고정한다"

requirements-completed: []

duration: 15min
completed: 2026-11-02
---

# Phase 8 Plan 27: 옛 화면 시험 정리 Summary

**지울 v1.0 고정 테이블 화면의 시험 16파일과 verdictViews 도우미를 지우고, 남길 뜻은 게임 맵 시험(gameMap·nightMap·verdictScreen)으로 옮기고, 남는 화면 시험 아홉 파일은 GameMap 기준으로 다시 썼다 — v1.0 화면 파일은 그대로고 두 tsc·전체 시험(140파일 3931개)이 초록이다.**

## Accomplishments

- **옮긴 뜻 (A2 '옮김')**: 낮 토론 아래 채팅 패널(채널 all, 입력칸·기록 칸, 단계 키 `1:discussion`, 서버 방송 줄), 입력 중 신호 4.5초, 방장 줄 없음(extend·skip 안 보냄)은 `gameMap.test` 로. 밤 대상 선택의 끊김·재선택·서버 값 우선·탈락 좌석 제외는 `nightMap.test` 로. 변론 채팅 단계 키 `1:defense` 는 `verdictScreen.test` 로.
- **남는 화면 시험 아홉 파일을 GameMap 기준으로**: nightChat(마피아·유령 채널, 시민 편 흔적 0, 밤 채널 불일치 방어) · guide(단계 × 시점 점검표 12단계) · atmosphere(조명 값) · characterAudit(맵 이름표 닉네임·산/탈락) · stageBox(낮 행 제거, 배정 행 유지) · phaseArrival(맵이 재마운트되지 않음) · testTools·roomScreen·roleCardFlow(의존 0, 주석만 정리).
- **삭제**: 시험 16파일(it 443개) + `test/helpers/verdictViews.ts`. 쓰는 곳이 지운 파일뿐이었던 도우미라 함께 지웠다. 누설 시험 3파일과 `src` 는 변경 0.
- **검증**: `npm run typecheck`(rc 0), `npx vitest run` 140파일 3931개 통과, `--project client` 44파일 1359개(08-18 끝 60파일 1854개), `.skip(`·`.todo(` 0건.

## 대응표 (지울 시험 17 + 도우미 1 = 18행)

| 파일 | 판단 | 옮긴 it → 대상 / 이미 있음 | 이유 |
|------|------|--------------------------|------|
| test/client/candidateVote.test.tsx | 지움 | — | 후보 선택·테이블 면 클릭·기록 카드는 v1.0 흐름(결정 0040). 새 낮 흐름에 후보 선택 단계가 없다. 거절 알림은 nominationScreen·gameMap 이 봄 |
| test/client/dayScene.test.tsx | 지움 | 이미 있음: 키보드 열림(gameMap '스테이지 사각형 측정과 키보드'), 탈락자 이름표·읽기 전용 아래(ghostView), 마피아·시민 패널 동일(phaseScreens '마크업이 같다') | DayScene 장면 상자·패널 157·후광·말풍선·기록 카드·아침 어둡게 층·배경 장면은 v1.0 마크업·기하 |
| test/client/dayTable.test.tsx | 지움 | — | DayTable 부품 전용(좌표·후광·표수 칩·변론 무대·유령 전환). 지울 부품의 마크업·기하만 검사 |
| test/client/defense.test.tsx | 옮김(1) + 지움(1) | '변론 채팅 단계 키 1:defense' → verdictScreen '최후 변론 화면 — 채팅 단계 키' | 남은 2개 중 단계 키는 사용자에게 가는 메시지라 옮김, `candidateCenter` 소스 게이트는 DayTable 전용이라 지움. 나머지 14개는 08-13 선행(git show 8f8c983 의 이전 버전) |
| test/client/discussion.test.tsx | 옮김 | 채팅 패널 all·단계 키 `1:discussion`·서버 방송 줄·입력 중 4.5초·내 입력 중·방장 줄 없음·옛 연장 토스트 없음·dayAnnounce 후 시트 없음 → gameMap '낮 토론 채팅 패널·방장 줄 없음' (6 it) | '서버 채널이 없으면 하단 패널 없음' 은 맵이 낮에 채널 기본값 all 로 항상 패널을 그려(로비와 같은 방식) 뜻이 바뀌어 옮기지 않고 지움. 위 바 문구·--mf-chat-panel-h·day.css 단언은 v1.0 틀 |
| test/client/execIntro.test.tsx | 지움 | — | 처형 여부 인트로 카드(introCardGeometry·verdict.css 구역)는 v1.0 투표 흐름. 08-13 이 이미 6개 지움 |
| test/client/execution.test.tsx | 지움 | 이미 있음: 직업 비노출 → verdictScreen '역할 비공개(결정 0053-2)', 라우팅 같은 노드 → gameMap '한 장면 키' | 남은 4개가 모두 맵 쪽에 같은 뜻이 있다. 처형 카드·후광 상한은 08-13 이 먼저 지움 |
| test/client/morning.test.tsx | 지움 | 이미 있음: 아침 알림 제목·무사·사라짐·본인 유령 전환 → nightMap '아침 임시 틀', 탈락·무사 문구 표 → test/unit/eliminationText.test.ts | MorningCard 마크업·CSS·퇴장 지연·앰버 변형·테이블 후광·타이머 urgent 는 v1.0 부품(맵 헤더 링의 긴급 표시는 v2 PhaseHeader 몫) |
| test/client/nightScene.test.tsx | 옮김 | 끊김 시 대상 버튼 모두 aria-disabled·무전송, 같은 대상 재클릭 무전송 + 서버 값 우선, 탈락 좌석은 대상·이름표 아님 → nightMap '대상 선택의 끊김·재선택·탈락 좌석' (3 it) | 경찰·의사·시민·마피아 패널·유령 시점은 이미 있음(nightMap 역할별 패널·유령이 보는 밤 행동). 기록 카드·테이블 후광·관전자 직업 그림·night.css 값은 v1.0 마크업 |
| test/client/noExecution.test.tsx | 지움 | 이미 있음: 처형 없음 알림 1.4초 → nightMap '처형 없음' | NoExecutionCard 카드 단위·CSS·소스 시험만 남아 있었다(08-18 이 RoomScreen 시험 9개 먼저 지움) |
| test/client/phaseScreens.test.tsx | **유지**(지움 아님) + 지움(1) | `day.css .mf-dayscene__panel` 패널 여백 it 1개만 지움 | 08-13·08-18 이 낮·밤·아침 시험을 맵 기준으로 옮긴 뒤 남은 44개는 역할 확인·배정·대기실 연결·[역할 카드] 시트·단계 전환 등 살아 있는 화면이다. 아래 '계획과 다른 점' 1번 |
| test/client/reveal.test.tsx | 지움 | — | candidateVoteReveal·useRevealState·공개 화살표·확정 두근·진동은 v1.0 투표 흐름 |
| test/client/revealLayer.test.tsx | 지움 | — | RevealLayer 화살표 층·DayTable layer 슬롯은 v1.0 부품 |
| test/client/sceneIntro.test.tsx | 지움 | 이미 있음: 낮이 되었습니다 알림 2000ms → gameMap '낮 시작 결과 알림' | SceneIntro 밤·낮 문구 오버레이·배경 크로스페이드는 v1.0 부품. 맵에는 '밤이 되었습니다' 알림이 없다(08-18 은 마피아 시작 줄만 만듦 — UI-SPEC 대로이며 이 계획이 바꾸지 않음) |
| test/client/userRecordSheet.test.tsx | 지움 | — | UserRecordSheet(이름표 기록 카드)는 DayScene 에서만 쓰였고 새 낮 흐름에 없다 |
| test/client/execVote.test.tsx | 지움 | — | 처형 여부 투표 화면(찬성·반대 버튼·집계 줄·기록 카드). 새 찬반은 verdictScreen 이 봄 |
| test/client/verdictStates.test.tsx | 지움 | 이미 있음: 익명·직업 비노출 → gameMap·ghostView·verdictScreen | 남은 5칸이 모두 verdictViews 픽스처·v1.0 변론 후보 화면 전용. 도우미와 같이 지움 |
| test/helpers/verdictViews.ts | 지움 | — | 쓰는 곳이 verdictStates 와 (이 계획이 맵 픽스처로 바꾼) guide·characterAudit 뿐이라 `git grep` 0건 확인 뒤 지움 |

### 이미 08-13 이 먼저 처리한 것 (재작업 없음)

dayAnnounce·discussion·defense·execution 화면 시험, execIntro 카드 6개, guide 트레이서·변론/처형 부품·점검표 13→9단계, 단계별 verdictStates 24칸, characterAudit 낮 → 밤 이동. 파일별 표는 08-13-SUMMARY.md.

### 이미 08-18 이 먼저 처리한 것 (재작업 없음)

noExecution·verdictStates·phaseScreens·guide·roleCardFlow·testTools·characterAudit·execVote 8파일 49개 포팅·삭제(밤·아침이 맵으로 가며 깨진 것). 파일별 표는 08-18-SUMMARY.md. 이 계획은 그 나머지를 판단했다.

## 남는 화면 시험 아홉 파일 — 바꾼 것

| 파일 | 바꾼 내용 |
|------|-----------|
| nightChat | DayScene 대신 RoomScreen→GameMap. 마피아 밤 패널·시작 줄(StrictMode 포함)·기록 흐름·재접속, 시민 편 흔적 0, 밤 채널 불일치(시민 mafia·마피아 all·탈락자 all)에서 패널 없음, 유령 채널·기록 흐름·시작 줄. 지움: ExecVotePanel 등 소스를 읽는 '임시 입력줄 없음' 시험(지울 파일), D1 '입력줄 없는 단계'(맵은 모든 단계에서 채팅을 그림), 유령 시작 줄 '밤마다 반복' 2개(08-18 이 규칙을 '산 → 탈락 전환 때 한 번'으로 바꿈) |
| atmosphere | 밤 비네팅·아침 밝아짐 층 → 가짜 런타임 장면 표의 `lighting`(talk·vote·trial·night·morning)으로. 옛 층(`.mf-backdrop__vignette`·`.mf-morningglow`·`.mf-dt__dim`)이 맵 어느 단계에도 없음, 4역할·관전자 조명 동일(D-09). 결과 화면 비네팅 0은 그대로 |
| guide | verdictViews 의존 제거. 점검표를 12단계로(대기실·배정·역할 확인·낮 시작~아침 8단계·결과), 낮 시작·처형·아침의 산 사람은 0개 예외. 옛 투표 세 단계 안내 시험 지움. 처형 없이 온 밤·결과는 이 파일의 makeView 로 |
| phaseArrival | 훅 시험은 그대로, 맵이 역할 확인 → 낮 시작 → 토론 → 지목 → 밤을 재마운트 없이 따라가는 시험 추가, 주석 정리 |
| stageBox | 낮 장면 상자·테이블 여백 변수·낮 머리(PhaseBar) 행 지움, 역할 배정 장면 상자 행은 남김(08-19 몫) |
| testTools | 주석 한 줄(닻이 DayTable 밖) 만 |
| roomScreen·roleCardFlow | 의존 0곳이라 변경 없음 |
| characterAudit | verdictViews 의존 제거(NAMES 로컬, 결과 view 로컬). 옛 테이블 인물 src 시험 → 맵 이름표 닉네임·산/탈락 시험(5명·8명). figureSrc·결과·링크 참가 시험은 그대로 |
| phaseScreens(유지) | `day.css .mf-dayscene__panel` 패널 여백 it 1개만 지움(맵에 같은 뜻 없음) |

## TDD Gate Compliance

계획 전체가 **시험 이전·정리**라 특성 시험(characterization)이다 — 옮긴 it 은 이미 있는 GameMap 동작을 단언해 처음부터 통과한다. RED 커밋이 없는 것은 의도다(08-17 '특성 시험'과 같음). 새 it 이 실제로 단언을 거는지는 작성 중 두 번 실패로 확인했다: 낮 토론 '채널 없으면 패널 없음'(맵은 기본 all 로 그림)과 토스트 요소 '없음'(빈 라이브 영역이 항상 있음)을 맵의 실제 동작에 맞게 고쳤다.

## Task Commits

| 작업 | 커밋 | 내용 |
|------|------|------|
| 1 | 44306c9 | test: 옛 낮 토론·밤·변론 화면 시험의 남길 뜻을 게임 맵 시험으로 옮김 |
| 2 | a7ed515 | test: 남는 화면 시험 아홉 파일을 맵 화면 기준으로 |
| 3 | c5e7f74 | test: 지운 고정 테이블 화면만 검사하던 시험 16파일과 verdictViews 삭제 |

## Deviations from Plan

### 계획과 다른 점

**1. [Reconciliation] phaseScreens.test.tsx 를 지우지 않고 남김 (계획 Task 3 의 17파일 중 1개)**
- **Found during:** Task 1 판단
- **Issue:** 계획은 phaseScreens 를 '지울 v1.0 화면 시험'으로 보았다(HEAD 54 it). 08-13·08-18 이 DayScene 낮·밤·아침 시험을 이미 맵 기준으로 옮겨서, 지금 44개는 역할 확인·배정·대기실 연결·[역할 카드] 시트·sheetdebug 계측·단계 전환처럼 **지울 화면에 기대지 않는** 시험이다. 지우면 살아 있는 화면의 시험을 잃는다(계획 자신의 A2: 지운 부품만 보면 지움).
- **Fix:** 지우지 않고 대응표 밖에 '유지' 로 적었다. 판단이 비거나 표에 없는 파일은 지우지 않는다는 Task 3 규칙과 같다. Task 3 인수 기준 첫 항목(18개 모두 없음)은 이 1개 때문에 17개 확인으로 충족한다.
- **Files modified:** test/client/phaseScreens.test.tsx (day.css 패널 여백 it 1개만 지움)
- **Commit:** a7ed515

**2. [Reconciliation] 삭제는 시험 16파일 + 도우미 1개 = 17개, 대응표는 계획대로 18행**
- 위 1번의 결과. phaseScreens 도 판단 한 줄(유지)을 표에 두어 행 수 게이트(≥ 18)를 채운다.

**3. [Reconciliation] 낮 토론 '채널이 없으면 하단 패널 없음' 은 옮기지 못함**
- **Issue:** 옛 DayScene 은 서버 `me.chat` 이 없으면 낮 토론 하단이 비었다. GameMap 은 낮 단계에서 `view.me.chat ?? "all"` 로 항상 채팅 패널을 그린다(로비와 같은 기본값). 밤은 `GamePanel` 의 `chatChannelOk` 가 서버 값을 기준으로 막는다(nightMap·nightChat 이 봄).
- **Fix:** 낮 단계의 이 it 만 지우고 이유를 남겼다. src 는 고치지 않는다(계획 prohibition). 서버는 게임 중 항상 `me.chat` 을 보내므로 실제 영향은 없다.

**4. [Rule 1 - 시험 오류] 옮기면서 맵의 실제 동작과 다른 단언 두 개를 고침** — 위 TDD 절. 커밋 전에 고쳤다.

### Auto-fixed Issues

없음(src 변경 없음).

## 08-19 로 넘기는 것

- **지울 화면 파일 열세 개를 읽는 시험이 더 있다(이 계획 범위 밖)**: `test/unit/{dayTable,verdict,verdictCss,e2eContract,nyquist-05-seats-fit}.test.ts` 가 `src/game/dayTable`·`day.css`·`daytable.css`·`verdict.css` 를 읽는다. `test/client/{testToolsCompact,resultScreen}.test.tsx` 는 `mf-dayscene__scene`·`.mf-dt` 클래스 문자열을 쓴다. `test/client/phaseScreens.test.tsx` 의 S-04(배정 `.mf-dt`)와 `.mf-phasebar` CSS 단언, `stageBox.test.tsx` 의 역할 배정 행은 Assigning·PhaseBar 정리와 함께 08-19 가 맞춘다.
- 이 계획 인수 grep 은 `test/client` 아홉 파일만 대상이라 위 파일들은 일부러 건드리지 않았다.

## Known Stubs

None.

## Threat Flags

None — 시험 정리만. 새 네트워크·인증 경로 없음, 패키지 설치 없음(T-08-SC). 누설 시험 3파일 diff 0(T-08-61), `.skip`·`.todo` 0건.

## Verification

- `npm run typecheck` rc 0 · `npx vitest run` 140파일 3931 통과(1 skipped 는 `test/unit/camera.test.ts` 의 `describe.runIf(CAMERA_PRINT)` 출력용 기존 항목) · `npx vitest run --project client` 44파일 1359 통과
- 대응표 행 수: `grep -c -E '^\|[^|]*test/(client|helpers)/'` = 18(시험 17 + 도우미 1). 이 중 phaseScreens 는 '유지'(위 1번)
- Task 3 인수 기준 '18개 모두 없음' 은 phaseScreens 를 뺀 17개가 없음으로 확인했다(`test ! -e`)
- 인수 grep(Task 2): 아홉 파일에서 지울 화면 의존 0건(`git grep` rc 1)
- 누설 시험 3파일 `git diff --quiet HEAD` 성공, `src/screens/DayScene.tsx`·`src/components/DayTable.tsx` 존재

## Self-Check: PASSED

- 파일 있음: test/client/gameMap.test.tsx, nightMap, verdictScreen, nightChat, atmosphere, guide, characterAudit, stageBox, phaseArrival, phaseScreens, testTools
- 삭제 확인: 16 시험 파일 + test/helpers/verdictViews.ts 없음, phaseScreens 있음(의도)
- 커밋 3개 HEAD 의 조상: 44306c9, a7ed515, c5e7f74
