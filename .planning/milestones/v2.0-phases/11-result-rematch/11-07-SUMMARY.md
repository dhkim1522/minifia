---
phase: 11-result-rematch
plan: "07"
subsystem: src/net + src/components/v2 + src/screens + src/game + scripts/e2e
tags: [result-panel, tabs, resultLog, pre-notice, clock-pause, tdd, e2e]
requires: [11-03, 11-05]
provides: [ResultLogStore, ResultPanel(탭 다섯·확장·점 표식), resultText(RESULT_PANEL_TEXT), stateAt.tabsVisible, resultPanelHeight, V2Icon timeline, 공개 예고 두 곳, result-reveal E2E, resultTabChecks]
affects: [11-09, 11-11, 11-12]
tech-stack:
  added: []
  patterns: [resultLog 프레임을 연결 수명 저장소(useSyncExternalStore)로 모으고 탭을 열 때만 그린다, 확장 중 대기 타이머 취소·경과 보존 후 이어 걸기, 최종 상태에서 탭 기하를 잰다]
key-files:
  created:
    - src/net/resultLogStore.ts
    - src/components/v2/ResultPanel.tsx
    - src/game/resultText.ts
    - test/unit/resultLogStore.test.ts
    - test/client/resultPanel.test.tsx
  modified:
    - src/screens/ResultScreen.tsx
    - src/screens/RoomScreen.tsx
    - src/screens/RoleReveal.tsx
    - src/components/v2/LineSheet.tsx
    - src/components/v2/V2Icon.tsx
    - src/game/resultDirector.ts
    - src/net/useRoomConnection.ts
    - src/world/testHooks.ts
    - src/styles/result.css
    - src/styles/phase.css
    - src/styles/v2.css
    - scripts/e2e/result.mjs
    - scripts/e2e/result.test.mjs
    - scripts/e2e/flows.mjs
    - scripts/e2e/lib.test.mjs
    - test/unit/resultDirector.test.ts
    - test/unit/e2eContract.test.ts
    - test/client/resultScreen.test.tsx
    - test/client/icon.test.tsx
    - test/client/phaseScreens.test.tsx
    - test/client/whisperUi.test.tsx
    - test/client/atmosphere.test.tsx
decisions:
  - "접힌 패널은 188/244 를 지킨다: 탭 행 44 가 패널 위 안쪽 여백(14)을 먹고(음수 위 여백) 채팅 기록 칸이 LOG_H − 40(56 · 112)이 된다. 키보드가 열리면 탭 행을 DOM 에서 빼 키보드 열림 높이 150 을 그대로 둔다."
  - "탭 스타일은 v2.css 가 아니라 result.css 에 둔다 — v2parts 정적 시험이 v2.css 의 진홍을 crimson-300 글자색 하나로 묶는다. 진홍은 마피아 탭 아이콘(crimson-300)에만 쓴다."
  - "공개 예고는 RoleReveal 에서 4초 뒤 사라지는 것이 아니라 data-state shown → gone 으로 접힌다(opacity + max-height, 모션 줄이기는 전이만 없이 같은 4초). 귓속말 시트(peer 가 있을 때)에는 data-state 없이 항상 있다. 마지막 한마디 시트(title)에는 두지 않는다."
  - "확장 높이 계산은 resultDirector.resultPanelHeight(방 높이 = 화면 루트 clientHeight)에 둔다. 화면 방향·크기가 바뀔 때만 다시 잰다."
  - "연출 시계 정지: ResultScreen 이 clock{base,since} 로 경과를 쥐고, 확장되면 대기 타이머를 취소해 경과를 보존, 접히면 schedule(경과)로 남은 표시각을 다시 건다. 연출이 아닌 마운트는 타이머가 없어 아무 일도 없다."
status: complete
commits: 6
plan_head_before: 049a69386895aeead3f94de98393c2216ead9228
plan_head_after: 090819188f5c909df427d58e8fc5c7b0d7ab9dfa
actuals:
  tokens: 24500
  tasks: 3
  commits: 6
completed: 2026-11-05
---

# Phase 11 Plan 07: 결과 탭 패널 Summary

결과 채팅창을 아이콘 탭 다섯(전체·마피아·유령·귓속말·기록)으로 바꿨다. 숨은 기록은 `resultLog` 프레임을 저장소에 모아 두었다가 탭을 눌러야만 DOM 에 그려지고, 전체가 아닌 탭은 패널이 `min(round(0.7 × 방 높이), 520)` 로 확장되며 연출 시계가 멈춘다. 판이 끝나면 공개된다는 한 줄을 역할 확인(4초)과 귓속말 시트(항상)에 모두에게 같게 보인다.

## 커밋 (6)

| 커밋 | 내용 |
| --- | --- |
| 6e96692d | test: 탭 패널 RED (ResultLogStore·ResultPanel·마피아 탭 확장·timeline 아이콘) |
| fabfa41e | feat: 트레이서 GREEN (저장소·패널·확장·연결 허용 목록·`__mfResult.tab`) |
| 9d699774 | test: 탭 등장 시각·점 표식·시계 정지·공개 예고 RED |
| e851cde7 | feat: tabsVisible·확장 중 시계 정지·무대 탭 접기·공개 예고 두 곳 GREEN |
| a27a0f43 | test: E2E 판정 RT1~RT13·표식 계약 RED |
| 09081918 | feat: result-reveal 흐름·resultTabChecks·readResultTabs GREEN |

`plan_head_before` 는 ledger 값이다. 병렬 실행기(11-06·11-08·11-10)의 커밋이 사이에 끼어 `rev-list` 수(15)는 이 계획 몫이 아니다. 이 계획의 커밋은 `--grep="(11-07)"` 로 센 6개다.

## 검증

- 시험: `resultLogStore`(8)·`resultPanel`(18)·`resultScreen`·`roomScreen`·`icon`·`resultDirector`·`phaseScreens`·`whisperUi`·`e2eContract`·`lobby`·`atmosphere`·`useRoomConnection`·`v2parts` 13개 파일 546개 통과, `node --test scripts/e2e/result.test.mjs scripts/e2e/lib.test.mjs` 289 통과 / 0 실패.
- `npm run typecheck`: 이 계획 파일의 오류 0. 남은 오류(`rematch.test.ts`·`plazaScene.test.ts`·`perfScenario.test.ts`)는 병렬 실행기(11-08·11-06/11-10)의 진행 중 작업이다.
- **E2E** `node scripts/e2e/run.mjs --url http://localhost:5183 --only result-reveal --sizes 360x560,430x932` (개발 서버 5183, 끝난 뒤 껐다):

| 흐름 | 크기 | 통과/전체 |
| --- | --- | --- |
| result-reveal | 360x560 | 22/22 |
| result-reveal | 430x932 | 22/22 |
| result (--only 부분 일치로 함께 돎, 11-05 회귀) | 390x844 | 25/25 |

실패 0. RT1~RT13(탭 44 이상·접힌 188/244·확장 392/520·입력칸 없음·마피아만 진홍·`{n}밤`·점 3→2·헤더 가림 없음·탭 1→5·판 중 0건·시계 정지·확장 중 무대 탭 접기·접힌 무대 탭 건너뜀) + RT14~RT17(탭 안 내용·접힘 복귀)이 모두 통과했다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 연결 훅이 resultLog 를 버리고 있었다**
- **Found during:** Task 1 (11-03 이월 메모가 예고한 일)
- **Fix:** `parseServerMessage` 허용 목록·구독 분기·종료된 연결 가드·`RoomEvent` 에 `resultLog` 추가
- **Files modified:** src/net/useRoomConnection.ts
- **Commit:** fabfa41e

**2. [Rule 3 - Blocking] 목록 밖 파일의 낡은 기대값·타입**
- `test/client/atmosphere.test.tsx` 가 `ResultScreen` 을 직접 그려 새 필수 prop `resultLog` 가 없어 typecheck 실패 → 저장소를 넘김(fabfa41e).
- `scripts/e2e/lib.test.mjs` 가 `extraSizes` 흐름 목록을 못박아 `result-reveal` 등록으로 실패 → 목록에 더함(09081918).
- `src/world/testHooks.ts` 에 `ResultHookState.tab` 추가(계획 파일 목록 밖, 훅 계약).
- `src/styles/phase.css`(공개 예고 모양, RoleReveal 의 스타일 자리)·`src/styles/v2.css`(`.mv-line__notice`)는 계획 파일 목록 밖이지만 안내 줄 스타일이 사는 곳이다.

**3. [Rule 1 - 낡은 시험 기대값 갱신 (제품 아님)]**
- `resultScreen.test.tsx` 의 `__mfResult` 동등 검사에 `tab: "all"` 추가, `resultDirector.test.ts` t=0 동등 검사에 `tabsVisible: false` 추가, `e2eContract.test.ts`·`result.test.mjs` 의 `RESULT_MARKERS`·패널 표식 위치(`data-result-panel` 이 ResultScreen → ResultPanel 로 이동)를 갱신.

**4. [계획 해석] 탭 스타일 위치와 접힌 높이**
- 계획은 v2.css 를 말하지만 `v2parts` 정적 시험이 v2.css 의 진홍을 crimson-300 글자색 하나로 묶고 `result.css` 는 14·16·24·36 글자 크기만 허용해, 탭 행·점·구분선·확장 규칙은 result.css 에 두었다(토큰만, hex·새 토큰 없음).
- 접힌 188/244 를 지키려고 채팅 기록 칸을 LOG_H − 40 으로 줄였다(UI-SPEC G 의 "로그 약 56, 두 줄" 과 일치).

### 이월 확인 (11-05 메모)
- `test/client/lobby.test.tsx` 의 "host changed" 3줄은 이 계획 시작 시점에 이미 통과한다(11-04 작업이 끝난 상태). 수정 없음.
- E2E 의 `result-reveal` 첫 뒤집기 전(RT2)은 모임 구간(1.2초)을 읽어야 해서 구간을 놓치면 "측정값 없음" 으로 실패한다(문턱을 낮추지 않음). 이번 두 크기에서는 놓치지 않았다.

## Known Stubs

- `ResultPanel` 의 `logSlot`(기록 탭 몸통)과 `pill`(알약 자리)은 의도된 빈 자리다: 11-11 이 기록 탭 타임라인을, 11-12 가 알약을 채운다. 지금 기록 탭을 열면 빈 몸통이다.

## Threat Flags

없음. 새 네트워크 입구는 이미 서버가 ended 에서만 보내는 `resultLog`(11-03)를 클라이언트가 받는 것뿐이고, 닉네임·본문은 React 텍스트 노드/`alt` 속성으로만 그린다(T-11-22). T-11-23(판 중 탭 DOM 0건)은 E2E RT10 이, T-11-24(안내 문구·시간 동일)는 역할 4종 렌더 비교 시험이 지킨다.

## 이월 메모

- `ResultPanel` props: `tab·onTab·expanded·expandedHeight?·tabsVisible·lines(ResultLogSnapshot)·contacts(Map<seat,닉네임>)·opened(Set<탭>)·allSlot·logSlot?(기록 탭, 11-11)·pill?(알약, 11-12 — 확장일 때만 폭 전체로 렌더)·panelRef?·kb?`. `<section data-result-panel data-expanded data-tab>` 를 ResultPanel 이 그린다. 전체 탭은 `allSlot`(ChatPanel, 기록 칸 `logH − 40`) 그대로이고 알약은 입력줄 쪽이 아니라 확장 `pill` 자리에 넣는다.
- `ResultLogStore` (src/net/resultLogStore.ts): `apply(frame, epoch)·snapshot()·reset()·subscribe(cb)·revision()·currentEpoch()`. 스냅샷 `{mafia,ghost,whisper,claim,ballots}` 각 `{lines, complete}`(프레임 i 순서). RoomScreen 이 연결 수명으로 만들고 `phase → lobby` 때 `reset()`, ResultScreen 이 `resultLog` prop 으로 받는다(`claim`·`ballots` 는 11-11 이 읽는다).
- ResultScreen 이 쥐는 것: `tab`·`opened`(점 표식)·`roomH`(루트 clientHeight)·`expanded = tab !== "all"`·연출 `clock{base,since}`+`pausedAt`(확장 시 타이머 취소, 접힘 시 `schedule(경과)`). 무대 탭 `onStageTap` 은 `tab !== "all"` 이면 접기만, 아니면 `skip()`. 11-09 시상식 시계도 같은 pause 위에 올리면 된다(`schedule` 한 곳).
- `resultText.ts`: `RESULT_TABS·ResultTabId·RESULT_PANEL_TEXT{tab,tabName,preNotice}·nightDivider(n)·dayDivider(n)·PRE_NOTICE_MS(4000)`. `resultDirector`: `stateAt(...).tabsVisible`(t ≥ 1200, 최종 true)·`resultPanelHeight(roomH)`·`RESULT_PANEL_MAX_H`.
- 표식: `data-result-tab`(5)·`data-result-dot`·`data-result-divider`·`data-result-body`·`data-result-whisper`·`data-expanded`·`data-pre-notice`(`data-state` shown|gone, 시트는 없음)·`window.__mfResult.tab`. 줄은 `.mv-chat__msg` 클래스를 재사용한다(ChatPanel 은 건드리지 않음).
- `result.mjs` 새 export: `RESULT_TAB_IDS·resultTabChecks({layout?,reveal?})·readResultTabs(page)`. `RESULT_MARKERS` 에 탭 표식 3개 추가. flows.mjs 에 `resultRevealFlow` 등록(`--only result-reveal`, `--only result` 도 함께 돈다).
- 11-12 에 알림: 마피아 탭 아이콘만 진홍(crimson-300)이고 v2.css 의 진홍 시험은 그대로다. 알약 자리가 생기면 `.mf-result__pill > *` 가 폭 전체로 늘어난다. 키보드가 열리면(kb) 탭 행이 DOM 에서 빠진다.

## Self-Check: PASSED

- 파일 존재: src/net/resultLogStore.ts · src/components/v2/ResultPanel.tsx · src/game/resultText.ts · test/unit/resultLogStore.test.ts · test/client/resultPanel.test.tsx 확인.
- 커밋 6개(6e96692d, fabfa41e, 9d699774, e851cde7, a27a0f43, 09081918) 존재, HEAD 의 조상.
