---
phase: 07-free-chat
plan: "20"
subsystem: e2e-harness
tags: [e2e, playwright, chat, harness-cleanup, day-table, gallery, contract-test]
status: complete

requires:
  - phase: 07-free-chat
    provides: "07-03 chatUi 치수 상수, 07-08 claim 단계 삭제, 07-13·07-15 로비·테이블 ChatPanel, 07-18 카메라 스테이지 사각형, 07-19 chat-ime·chat-keyboard 흐름"
provides:
  - "E2E 하네스에서 순차 주장·빠른 메시지·이모티콘·채팅 내역 모달 흐름과 판정이 사라졌다 (claimChatIssues·PANEL_H_DEFENSE_ME·K2·K3·변론 칩·승인 완화 P-PANEL-236·openChatHistory·waitTurnSeat·pickChip)"
  - "lib.mjs 의 채팅 패널 치수 사본(LOG_H_SHORT·LOG_H_TALL·LOG_H_KB·TALL_ROOM_MIN_H·LOBBY_PANEL_EXTRA·TABLE_PANEL_EXTRA·KB_PANEL_H·TYPING_PILL_H)과 logHeightFor·tablePanelHeight·lobbyPanelHeight·expectedPanelH"
  - "D6·T1·P5 가 채팅 패널 상태에서 LOG_H + 92(188·244), 그 밖은 157 을 기대하고 D7·T1 은 하단 모양이 같은 상태끼리 견준다"
  - "test/unit/e2eContract.test.ts 의 chatUi 사본 일치 describe (경계 779·780 포함)"
  - "로컬 E2E 전체 72개 흐름·크기 행 3813/3813 통과, 실패 0 (deployhold 는 기본 제외)"
  - "gallery.mjs 가 로비 채팅·토론 채팅·밤 마피아 채팅 화면을 찍는다 (exitIfV1 그대로)"
  - "낮 장면 높이 303~336 에서 맨 앞 이름표가 장면 밖으로 넘치던 v1.0 테이블 결함 수정 (360x640 채팅 패널 하단)"
affects: [07-21, 07-22]

actuals:
  tokens: 12179
  tasks: 2
  commits: 3
plan_head_before: 4b69d6c8eb50328cae1518da11f252e56dbda488
plan_head_after: 5dd1e193dd43bb3d685e416a81da8b8d2737702f

tech-stack:
  added: []
  patterns:
    - "E2E 사본 상수는 앱 상수와 같다는 것을 e2eContract 가 고정한다(05-05 규약을 채팅 패널 치수로 넓힘)"
    - "채팅 패널이 붙는 상태 기대는 dayChecks({ chat })·stageStable 항목의 chat·roomH 로 넘기고, 장면 비교는 같은 하단 모양끼리만 한다"
    - "낮은 스테이지의 목적지 탐색은 worldTapRanking 이 기준(거리 하한·걷는 길이 하한)을 한 쌍으로 정한다"

key-files:
  created: []
  modified:
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/flows.mjs
    - scripts/e2e/browser.mjs
    - scripts/gallery.mjs
    - test/unit/e2eContract.test.ts
    - src/game/dayTable.ts
    - src/components/TestTools.tsx
    - src/styles/testtools.css
    - test/unit/dayTable.test.ts
    - test/client/dayScene.test.tsx
    - test/client/dayTable.test.tsx
    - test/client/testToolsCompact.test.tsx
    - .planning/phases/07-free-chat/deferred-items.md

key-decisions:
  - "하단 높이 기대값은 expectedPanelH({ roomH, chat }) 한 함수로 둔다 — 채팅 있으면 tablePanelHeight(logHeightFor(방 높이)), 없으면 PANEL_H 157. 방 높이는 스냅숏의 .mf-dayscene 높이(roomH)를 쓰고 없으면 뷰포트 높이"
  - "D7·T1 의 장면·테이블·캐릭터 비교는 채팅 패널 유무가 같은 항목끼리만 한다 — 하단이 31~92px 다르면 flex 1 장면 높이가 달라지는 것이 UI-SPEC 의 설계라서. 0.5px 허용과 패널 위 = 장면 아래 기준은 그대로"
  - "변론 후보 본인 패널 236 승인 완화(P-PANEL-236)는 변론 칩과 함께 지웠다 — 승인 목록은 열 건에서 아홉 건"
  - "사용자 위임에 따른 추천안 선택: 360x640 D2 실패는 판정을 낮추지 않고 앱의 맨 앞 이름표 기하 상수를 고쳤다(TABLE_FIT_MIN_H 299→303, TABLE_FULL_H 336)"
  - "chat-keyboard 를 DayScene 으로 넓히지 않는다 — 테이블 틀은 8페이즈에서 삭제되고 알려진 한계라 07-21 실기기 확인에 맡긴다"

requirements-completed: [CHAT-06, CHAT-01]

coverage:
  - id: D1
    description: "E2E 라이브러리·흐름·브라우저 도우미에 순차 주장·빠른 메시지·이모티콘·채팅 내역 흐름과 판정이 없다"
    requirement: "CHAT-06"
    verification:
      - kind: unit
        ref: "node --test scripts/e2e/lib.test.mjs (233 통과) + grep 인수 기준 두 건(rc=1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "채팅 패널 치수 사본이 src/game/chatUi.ts 와 같다"
    requirement: "CHAT-06"
    verification:
      - kind: unit
        ref: "test/unit/e2eContract.test.ts#E2E 채팅 패널 치수 사본과 src/game/chatUi.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "게임 흐름이 claim 없이 discussion 으로 가고 채팅 패널 상태의 하단 높이가 188·244, 그 밖은 157 로 판정된다"
    requirement: "CHAT-01"
    verification:
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 (police5·citizen4·mafia8·doctor5·spec4·vote5·noexec·result-c·result-m 6개 크기 전부 통과)"
        status: pass
    human_judgment: false
  - id: D4
    description: "로컬 E2E 전체가 초록이다 (lobby·world·reconnect·perfbudget·게임 흐름·chat-lobby·chat-table·chat-ime·chat-keyboard·chat-ghost)"
    requirement: "CHAT-06"
    verification:
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 → 72 행, 3813/3813, 실패 0, E2E OK, 695초"
        status: pass
    human_judgment: false
  - id: D5
    description: "gallery.mjs 가 로비 채팅·토론 채팅·밤 마피아 채팅 화면을 찍는다"
    requirement: "CHAT-01"
    verification:
      - kind: other
        ref: "node --check scripts/gallery.mjs + 로컬 주소 복사본으로 mafia 역할 전 단계 촬영(03b·11·27b 사진 확인, FAIL 줄 없음)"
        status: pass
    human_judgment: true
    rationale: "사진의 모양(줄 배치·여백)이 화면설계서용으로 충분한지는 사람이 본다. 자동으로는 촬영 성공만 확인했다"

duration: 72min
completed: 2026-11-02
---

# Phase 7 Plan 20: E2E 하네스 정리와 전체 초록 Summary

**순차 주장·빠른 메시지·이모티콘·채팅 내역 판정을 E2E 하네스에서 모두 지우고, 채팅 패널 상태의 하단 높이(188·244)와 앱 상수 사본 일치 시험을 더해 로컬 E2E 전체 3813/3813 을 초록으로 만들었다.**

## Performance

- **Duration:** 72분 (2026-11-01T16:46Z ~ 17:58Z)
- **Tasks:** 2/2
- **Files:** 13개 수정 + deferred-items.md
- **Commits:** 3 (Task 1 `10f0488`, 앱 수정 `7975afa`, Task 2 `5dd1e19`) + 이 SUMMARY 커밋

## Accomplishments

- `scripts/e2e/lib.mjs`: `claimChatIssues`·`PANEL_H_DEFENSE_ME`·K2(이모티콘·빠른 메시지·칩)·K3·`turnChecks` 의 차례 부분·변론 칩 판정을 지우고 `turnChecks` 는 K1(차례 표식 없음)·K4(후광)만 돌린다. 채팅 패널 치수 사본과 `logHeightFor`·`tablePanelHeight`·`lobbyPanelHeight`·`expectedPanelH` 를 더했다. `dayChecks`(D6)·`stageStable`(T1)·`defenseChecks`(P5)가 채팅 상태에서 `LOG_H + 92` 를 기대한다.
- `test/unit/e2eContract.test.ts`: 상수 여덟 개, 방 높이 0~2000(779·780 경계 포함)의 `logHeightFor`, `tablePanelHeight`·`lobbyPanelHeight`·`expectedPanelH`, day.css 의 157 이 chatUi 와 같음을 고정한다.
- `scripts/e2e/flows.mjs`·`browser.mjs`: 게임 흐름이 `dayAnnounce` 다음 `discussion` 으로 가고, police5 의 chat 상태는 보낸 줄이 기록 칸에 보이는지(C1·C2)를 본다. 변론 P5 는 후보 포함 누구나 기록 칸에 줄을 보낼 수 있는지 확인한다. 스냅숏은 옛 `.mf-msglog`·`stEmoji`·`quickBtn`·`legacyRows` 를 버리고 `hasChat`·`chatChannel`·`roomH` 를 싣는다.
- `scripts/gallery.mjs`: 주장·빠른 메시지·이모티콘·채팅 내역 단계를 로비 채팅(03b)·토론 채팅(11)·밤 마피아 채팅(27b) 촬영으로 바꿨다. `exitIfV1` 그대로.
- 로컬 E2E 전체: 72개 흐름·크기 행, 통과 3813 / 전체 3813, 실패 0, 695초(deployhold 는 기본 제외).
- 검증: `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs` 281 통과, `npx vitest run` 142 파일 3847 통과(1 건너뜀은 기존), `npm run typecheck`·`npx vite build` 통과. 인수 기준 grep(옛 식별자 0건·`.skip(`/`.todo(` 0건) 통과.

## Task Commits

1. **Task 1: lib·lib.test·e2eContract 정리와 치수 사본** — `10f0488` (test)
2. **앱 수정 (Rule 1, 아래 Deviations)** — `7975afa` (fix)
3. **Task 2: flows·browser·gallery 정리와 E2E 전체 초록** — `5dd1e19` (test)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 낮 장면 높이 299~336 에서 맨 앞(내 자리) 이름표가 장면 아래로 넘쳐 하단 패널과 겹침**
- **Found during:** Task 2, 첫 전체 E2E (360x640 의 discussion·밤 마피아·next-day 에서 D2 "자리 0 이름표가 장면 밖; 하단 패널과 겹침" 16건)
- **Issue:** `dayTable.ts` 의 `FRONT_TAG_BELOW_CY`·`TABLE_FIT_MIN_H` 가 이름표 높이 22(122·299)로 계산되는데 실제 DOM 상자는 26(압축 구간은 26 을 이미 씀)이다. 07-15 의 채팅 패널(188)로 360x640 의 장면이 332.8 이 되어 이 구간에 처음 들어왔고 이름표가 3.2px 넘쳤다. 그 전 v1.0 하단(157)에서는 장면이 363.8 이라 드러나지 않았다.
- **Fix:** 판정을 낮추지 않고 앱 상수를 실제 상자 기준으로 고쳤다. `FRONT_TAG_BELOW_CY = 100 + 0 + 26 = 126`, `TABLE_FIT_MIN_H` 299→303(303 경계에서 cy 가 이어져 기존 2.6px 불연속도 사라짐), `TABLE_FULL_H = 336` 추가. 승인 기하(cy 210)가 쓰이는 336 이상은 한 값도 바뀌지 않는다는 것을 336~700 × 폭 4종 × 4~8명 전수 시험으로 고정했다.
- **연쇄 수정:** 테이블이 위로 올라가는 336 미만에서 2번 자리 머리가 [테스트] 버튼과 4.7px 겹쳐(D4 허용 3px) 다시 실패해서, `testButtonCompact` 기준을 `TABLE_FIT_MIN_H` 에서 `TABLE_FULL_H`(336)로 올렸다(개발용 버튼의 글자만 숨겨 44px 로 좁힘, 위치 불변).
- **Files modified:** `src/game/dayTable.ts`, `src/components/TestTools.tsx`(주석), `src/styles/testtools.css`(주석), `test/unit/dayTable.test.ts`, `test/client/dayScene.test.tsx`, `test/client/dayTable.test.tsx`, `test/client/testToolsCompact.test.tsx`
- **Commit:** `7975afa`
- **결정 방식:** 계획 파일 목록 밖의 앱 코드 수정이고 "승인 기하 한 값도 안 바뀐다" 시험 문구와 부딪히는 변경이라 Rule 4 에 가깝지만, 사용자 위임(추천안 선택)에 따라 판정 완화(승인 필요) 대신 결함 수정을 택했다 — **사용자 위임에 따른 추천안 선택**. 대안이던 "승인 완화 항목 추가"는 사용자 승인이 필요하고 계획 prohibitions 와도 부딪힌다.

**2. [Rule 3 - Blocking] world 흐름이 360x560 에서 이동 목적지를 못 찾음 (07-18 에서 넘어온 항목)**
- **Found during:** Task 2, 첫 전체 E2E (`world/setup S4`)
- **Issue:** 로비 스테이지가 248 로 낮아져 두 화면에 보이는 칸이 모두 내 위치에서 3 단위 안이라 "3 단위 이상 먼 칸"이 0 개.
- **Fix:** `worldTapRanking` — 3 단위 이상 먼 칸이 있으면 기존 기준 그대로(1.5초 걷는 길이), 없을 때만 1.5 단위 이상 먼 칸과 걷는 길이 0.8초 하한을 쓴다. W5 라벨에 "낮은 스테이지 기준"을 표시한다. 걷는 길이 하한은 측정이 걷는 도중에 일어나게 하는 준비 조건이고 화면 판정 기준(누르기 44·글자 크기·가로 넘침·콘솔·출처)이 아니다. 단위 시험 추가. world 360x560 21/21.
- **Files modified:** `scripts/e2e/lib.mjs`, `scripts/e2e/lib.test.mjs`, `scripts/e2e/flows.mjs`
- **Commit:** `5dd1e19`

**3. [Rule 3 - Blocking] run.mjs extraSizes 시험이 chat-keyboard(07-19)를 몰라 실패 중이었음**
- **Found during:** Task 1, `node --test scripts/e2e/lib.test.mjs` (HEAD 에서 이미 실패)
- **Fix:** 기대 목록에 `chat-keyboard` 추가. **Commit:** `10f0488`

**4. 승인 완화 P-PANEL-236 삭제** — 변론 후보 본인 패널 236 은 변론 칩과 함께 없어졌으므로 `APPROVED_RELAXATIONS` 에서 지우고 시험을 갱신했다(열 건 → 아홉 건). 결정 0056 의 다섯 건(D9·D3b·G2·D2·P10)은 그대로다.

**Total deviations:** 3 auto-fixed (Rule 1 ×1, Rule 3 ×2) + 승인 완화 항목 삭제 1건. **Impact:** 앱 코드는 이름표 기하 상수와 개발용 [테스트] 버튼 좁힘 기준만 바뀌었고 승인 기하(장면 336 이상)는 불변이다. E2E 판정 기준(누르기 44·글자 14/16px·가로 넘침·콘솔·출처·0.5px 겹침)은 낮추지 않았다.

## 판정 기준에 대한 기록 (prohibitions 검증)

- 바뀐 판정: (a) 지운 기능의 판정(K2·K3·변론 칩·옛 흐름), (b) 채팅 패널 상태의 하단 높이 기대값(157 → 188·244), (c) D7·T1 의 장면 비교 단위(채팅 유무가 같은 항목끼리 — 하단이 다르면 장면 높이가 달라지는 것이 UI-SPEC 설계), (d) world 목적지 탐색의 거리·걷는 길이 하한(낮은 스테이지에서만).
- 그대로: 0.5px 겹침 허용, 44px 누르기, 14/16px 글자, 가로 넘침, 콘솔 오류, 다른 출처 요청, 157(채팅 없는 하단), 결정 0056 의 다섯 완화, T1 의 패널 위 = 장면 아래.

## 로컬 서버

- 이 계획이 `npm run dev` 를 띄웠다(PID 41672 → vite 41694 → workerd 41733). 최종 검증 뒤 세 PID 모두 종료했고 5173 포트가 닫혔음을 확인했다. 미리 떠 있던 서버는 없었다. 이전 세션의 멈춘 vitest 프로세스(17093·17098·17033·16956)는 건드리지 않았다.

## Issues Encountered

- 전체 병렬 실행 중 `reconnect/offline RC1`(콘솔 경고 0건)이 WebSocket 경고 5건으로 한 번 실패했고 단독 3회·전체 재실행에서 통과했다. 병렬 부하 민감도로 보이며 `deferred-items.md` 에 열린 항목으로 남겼다.
- gallery 의 citizen 역할은 [활동 기록] 탭이 없어 이 계획 이전부터 `rolecard` 단계에서 실패한다(기본 police·mafia 는 통과). 열린 항목으로 기록했다.
- 낮 시작 문구 `토론 전에 먼저 직업을 공개해요`·`곧 직업 공개가 시작돼요` 가 순차 주장 삭제 뒤에도 앱에 남아 있다. 문구는 사용자 확인 사항이라 고치지 않고 `deferred-items.md` 에 남겼다(E2E 는 앱 문구를 그대로 따른다).

## Deferred Items 처리

- 닫음: 07-15 옛 낮 화면 E2E 전제(claim·157 패널·채팅 내역 모달), 07-18 world 360x560, 07-17 gallery emoji 언급.
- 결정: 07-19 chat-keyboard 를 DayScene 으로 넓히지 않는다(07-21 실기기 확인이 맡음, 항목은 open 유지).
- 열림(신규): 낮 시작 옛 문구, reconnect RC1 병렬 flake, gallery citizen 탭.

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크 경로·인증·파일 접근·스키마 경계가 생기지 않았다. T-07-50(대상 주소 검사)은 `resolveTarget`·`exitIfV1` 을 그대로 두어 유지되고 `scripts/deploy-target.test.mjs`·`lib.test.mjs` 가 확인한다.

## Next Phase Readiness

- 07-21 이 같은 하네스로 배포본을 본다: `npm run e2e -- --url https://minifia-v2.dhplay.workers.dev`. 배포본에는 07-20 의 `dayTable.ts` 수정이 반영되어야 360x640 의 D2·D4 가 로컬과 같다.

## Self-Check: PASSED

- 커밋 존재: `10f0488`, `7975afa`, `5dd1e19` 모두 HEAD 의 조상.
- 파일 존재: `scripts/e2e/lib.mjs`, `scripts/e2e/flows.mjs`, `scripts/e2e/browser.mjs`, `scripts/gallery.mjs`, `test/unit/e2eContract.test.ts`, `src/game/dayTable.ts`.
- 인수 기준 재실행: 옛 식별자 grep rc=1, `TABLE_PANEL_EXTRA`·`LOBBY_PANEL_EXTRA`·`exitIfV1` 존재, `.skip(`/`.todo(` 0건.
