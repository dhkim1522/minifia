---
phase: 19-game-modes
plan: "04"
subsystem: ui
tags: [game-mode, host-rail, lobby, mode-sheet, mode-chip, tutorial-toggle, panel-height, e2e-contract, tdd]
status: complete

requires:
  - phase: 19-01 (판 종류 서버)
    provides: view.mode·modeOf, 메시지 modePick, basic 방은 start 의 tutorial 을 무시
  - phase: 19-03 (방장 줄 부품)
    provides: HostRail·HostRailButton·MapChip rail·ModeSheet·ModeChip·MODE_TEXT·modeToastOf
provides:
  - "대기실 방장 줄(data-host-rail): [판 종류]·[맵]·[봇]·[튜토리얼 먼저], 오른쪽 열은 방장도 소리·옷장"
  - "판 종류 시트 배선: [판 종류] → ModeSheet → send({ t: 'modePick', mode }), 표시는 view.mode"
  - "참가자 읽기 전용 칩(data-mode-chip)과 판 종류 바뀜 알림 한 줄"
  - "[튜토리얼 먼저] 방장 줄 토글(data-host-rail-btn=tutorial, data-tutorial-toggle 유지), 기본 마피아면 미렌더·start tutorial false"
  - "lobbyPanelHeight(logH) — 방장 증분 없음(222), 앱·E2E 사본 같음"
affects: [19-05, 19-06, 19-07, 19-08]

actuals:
  tokens: 18449
  tasks: 2
  commits: 5

plan_head_before: b2c4a3c5475c6a7c88b8d05d312726f0a5a7c8fd
plan_head_after: b2ce1a599a6ddeeabfa58b502344048834bd57d1
commits: 5

tech-stack:
  added: []
  patterns:
    - "방장 전용 조작은 서버 view 의 isHost 로만 그린다 — 참가자 화면에는 줄 마크업이 없고(숨김 아님) 방장이 바뀌면 다음 view 에서 칩 ↔ 줄이 바뀐다"
    - "숨긴 토글의 값은 화면에 남기고 보내는 순간에 규칙을 건다: start 의 tutorial = tutorialOn && mode === 'extended'"
    - "지운 이름이 남았는지 검색으로 확인하는 계획에서는 시험이 그 이름을 조각으로 이어 만든다(검색 결과 0 을 지킨다)"

key-files:
  created: []
  modified:
    - src/screens/Lobby.tsx
    - src/styles/lobby.css
    - src/styles/tutorialRoom.css
    - src/game/chatUi.ts
    - scripts/e2e/lib.mjs
    - scripts/e2e/flows.mjs
    - scripts/e2e/lib.test.mjs
    - test/client/lobby.test.tsx
    - test/client/dressSheet.test.tsx
    - test/unit/chatUi.test.ts
    - test/unit/e2eContract.test.ts
  deleted:
    - src/components/v2/TutorialToggle.tsx

key-decisions:
  - "방장 줄의 [맵] 단추도 연결이 끊기면 aria-disabled 다(MapChip host={canSend}) — 줄 단추 전부가 같은 규칙을 따른다. 예전 오른쪽 열의 맵 단추는 끊겨도 눌렸다"
  - "방장을 넘겨주면 열려 있던 판 종류 시트를 닫는다 — 다시 방장이 됐을 때 시트가 저절로 뜨지 않게"
  - "오른쪽 열 표식 값(data-side-button)에서 bots 가 빠졌다: src 의 값은 sound·map·dress. E2E 사본 SIDE_ORDER 와 판정은 19-06 이 고친다"

requirements-completed: [D-05, D-07, D-10, D-13, D-14, D-15, D-17]

coverage:
  - id: D1
    description: "방장 대기실: 왼쪽 줄 하나에 [판 종류]·[맵]·[봇]·[튜토리얼 먼저] 순서, 오른쪽 열은 방장도 [옷장] 하나(첫 칸은 소리 자리), 연결이 끊기면 줄 단추 전부 aria-disabled"
    requirement: D-13
    verification:
      - kind: unit
        ref: "test/client/lobby.test.tsx#Lobby — 방장 줄과 판 종류 (19-04, D-13·D-05·D-07)"
        status: pass
      - kind: unit
        ref: "test/client/lobby.test.tsx#Lobby — 오른쪽 한 줄 열: 방장도 둘(소리·옷장) (16-06 D-05 → 19-04 D-13, UI-SPEC A-12)"
        status: pass
      - kind: unit
        ref: "test/client/dressSheet.test.tsx#Lobby — 지도 칩과 맵 탭 (11-13, D-20·MAP-06)"
        status: pass
    human_judgment: false
  - id: D2
    description: "[판 종류] → 입력칸 blur → 시트, 칸을 누르면 modePick 한 번(canSend 일 때만), 표시는 서버 view.mode 로만 바뀌고 닫으면 초점이 [판 종류]로 돌아온다"
    requirement: D-05
    verification:
      - kind: unit
        ref: "test/client/lobby.test.tsx#[판 종류] → 시트가 열리고 확장판이 골라져 있다. [기본 마피아]를 누르면 modePick 이 한 번 가고 표시는 서버 값이 올 때까지 그대로다"
        status: pass
      - kind: unit
        ref: "test/client/lobby.test.tsx#시트를 [닫기]로 닫으면 초점이 [판 종류] 단추로 돌아온다"
        status: pass
    human_judgment: false
  - id: D3
    description: "참가자 대기실: 방장 줄 미렌더, 읽기 전용 칩 하나, 판 종류가 바뀌면 알림 한 줄(방장 본인·처음·재연결 직후·재접속 띠 동안은 없음, 순서 방장 변경 > 입장 > 퇴장 > 판 종류), 방장 교체 시 칩 ↔ 줄"
    requirement: D-07
    verification:
      - kind: unit
        ref: "test/client/lobby.test.tsx#참가자: 방장 줄 마크업이 없고(미렌더) 왼쪽 위에 읽기 전용 칩 하나 '판 종류: 확장판' (T-19-13)"
        status: pass
      - kind: unit
        ref: "test/client/lobby.test.tsx#알림이 없는 때: 방장 본인 · 처음 그릴 때 · 재연결 직후(epoch) · 재접속 띠가 떠 있는 동안"
        status: pass
    human_judgment: false
  - id: D4
    description: "[튜토리얼 먼저]가 방장 줄 토글(role=switch): 초기값 규칙 그대로, 누르면 알림·누름 소리, 기본 마피아면 미렌더·start tutorial false·값 유지, 연결 끊김·[시작] 잠금 동안 aria-disabled"
    requirement: D-10
    verification:
      - kind: unit
        ref: "test/client/lobby.test.tsx#Lobby — 방장 줄 토글 '튜토리얼 먼저' (19-04, D-10, P19-8)"
        status: pass
    human_judgment: false
  - id: D5
    description: "패널 스위치 줄 삭제: 방장 패널 = 참가자 패널 222, 방장 증분 상수·lobbyPanelHeight 두 번째 인자 없음(앱·E2E 사본)"
    requirement: D-10
    verification:
      - kind: unit
        ref: "test/unit/chatUi.test.ts#패널 높이 식 (18.1 B 계약 4 — 기록 칸 68 한 값)"
        status: pass
      - kind: unit
        ref: "test/unit/e2eContract.test.ts#E2E 채팅 패널 치수 사본과 src/game/chatUi.ts (07-20, 05-05 사본 일치 규약)"
        status: pass
      - kind: unit
        ref: "node --test scripts/e2e/lib.test.mjs (427 중 fail 0)"
        status: pass
    human_judgment: false
  - id: D6
    description: "꾸미기 시트·키보드가 열리면 줄·칩 미렌더, 테스트 방은 줄·칩이 48 아래에서 시작하고 줄 최대 높이도 48 줄어든다, [시작] 단추 불변"
    requirement: D-17
    verification:
      - kind: unit
        ref: "test/client/lobby.test.tsx#테스트 방은 줄 최대 높이도 48 줄어든다 — 왕관 표식까지 들어가던 높이에서 [테스트]가 있으면 표식이 빠진다 (F-1)"
        status: pass
      - kind: unit
        ref: "test/client/lobby.test.tsx#[시작] 단추는 그대로다: 패널 행동 줄 안, 같은 클래스·접근성 이름, 방장 줄에 들어가지 않는다 (D-17)"
        status: pass
    human_judgment: false
  - id: D7
    description: "실제 화면에서 방장 줄·칩이 시안 A(Main·Guest)와 맞고 폰 6종에서 패널·머리 단추·오른쪽 열과 겹치지 않는가"
    requirement: D-14
    verification: []
    human_judgment: true
    rationale: "이 계획에서는 앱을 띄워 보지 않았다(시험 환경은 레이아웃이 없다). 겹침은 19-06 의 E2E(mode-rail 폰 6종)가, 생김새는 배포본에서 시안과 눈으로 비교한다"

duration: 약 2시간(벽시계, 사용량 한도 대기 포함)
completed: 2026-11-12
---

# Phase 19 Plan 04: 대기실 방장 줄 배선 Summary

**대기실의 방장 전용 조작([판 종류]·[맵]·[봇]·[튜토리얼 먼저])을 왼쪽 세로 줄로 옮기고 판 종류 시트를 붙여 modePick 을 보내게 했다. 참가자는 읽기 전용 칩과 알림 한 줄로 판 종류를 알고, 패널 안 튜토리얼 스위치 줄을 없애 방장 패널이 참가자와 같은 222 가 됐다.**

## 진행

- **걸린 시간:** 벽시계 약 2시간 (2026-11-12T12:49Z ~ 14:49Z). 중간에 사용량 한도로 멈췄다가 이어서 했다 — 실제 작업 시간은 이보다 짧고 따로 재지 않았다.
- **Task:** 2/2
- **바뀐 파일:** 12 (고친 파일 11, 지운 파일 1)
- **커밋:** 5 (test 2 + feat 2 + fix 1) — `b2c4a3c5..b2ce1a59`

## 한 일

- `Lobby`: 방장에게 `HostRail` 을 그린다 — 위에서부터 [판 종류](`deck`, 이름 "판 종류: {지금 값}") · [맵](`MapChip rail`, 허용 맵 둘 이상) · [봇](`view.me.testBots` 가 있을 때) · [튜토리얼 먼저](확장판일 때만, `book`, role=switch). 오른쪽 열(`SideColumn`)은 방장도 소리 자리 + [옷장]뿐이다.
- [판 종류]를 누르면 입력칸 포커스를 풀고 `ModeSheet` 를 연다. 칸을 누르면 `canSend` 일 때 `{ t: "modePick", mode }` 한 번. 고른 표시·단추 이름은 서버 `view.mode` 로만 바뀐다. 닫으면 초점이 [판 종류]로 돌아온다.
- 참가자에게는 줄 마크업이 없고 `ModeChip` 하나가 있다. 판 종류가 바뀐 view 가 오면 TopToast "판 종류: {이름}" — 입장·퇴장·방장 변경 알림이 같은 방송에 있으면 그쪽이 먼저다.
- [튜토리얼 먼저]: 값은 화면 로컬 상태 그대로(첫 판 켜짐, 2판째·테스트 방 꺼짐). 누르면 누름 소리 신호 + 알림 "튜토리얼 먼저 켰어요" / "튜토리얼 껐어요". 기본 마피아면 토글을 그리지 않고 [시작]은 `tutorial: false` 를 보낸다. 값은 남아 확장판으로 돌아오면 그대로 보인다.
- 꾸미기 시트·키보드가 열린 동안에는 줄·칩을 그리지 않는다. `testButton` 이 있으면 `testShift` 를 주고 줄 최대 높이를 48 줄인다.
- 패널 첫 자식이던 스위치 줄, `TutorialToggle` 부품, `.tut-toggle*` CSS, 방장 패널 증분 상수(앱·E2E 사본), `lobbyPanelHeight` 의 두 번째 인자를 지웠다. `flows.mjs` 의 대기실 패널 판정(CP1)은 방장·참가자 모두 222 를 기대한다.
- `lobby.css` 의 가상 뷰포트 이동 줄에 `.mf-lobby .mf-hostrail, .mf-lobby .mf-modechip` 을 더했다.

## Task 커밋

1. **Task 1: 트레이서 — 방장 줄·판 종류 시트·참가자 칩·알림** — `ed920af6` (test) → `81ef92db` (feat)
2. **(고침) 오른쪽 열 표식 값 계약** — `5ad16658` (fix) — 아래 "계획과 달라진 점" 2번
3. **Task 2: 튜토리얼 토글 이동·방장 패널 222** — `368b27fa` (test) → `b2ce1a59` (feat)

트레이서 관문: Task 1 커밋 뒤 verify 를 다시 돌려 통과(4 files · 261 tests, typecheck 0) — ⚡ Tracer verified end-to-end — expanding.

## RED 증거

기록은 `.gsd/red/19-04-t{1,2}.{tap,json,verdict.json}`(gitignore 된 로컬 파일). 둘 다 `gsd-tools check tdd-red-evidence` 가 `RED_EVIDENCE_OK`(target_test_failed)를 냈다.

- **t1** `npx vitest run test/client/lobby.test.tsx test/client/dressSheet.test.tsx --reporter=tap-flat` → exit 1, 161개 중 not ok 21(전부 AssertionError), ok 140. 대상: "방장: 왼쪽 줄 하나에 위에서부터 [판 종류]·[맵]·[봇], 오른쪽 열은 [옷장] 하나(첫 칸은 소리 자리)다" — 기대 `[data-host-rail]` 1개, 실제 0개. 첫 실행에서는 네 시험이 단언이 아니라 "없는 요소를 누름" 오류로 실패해, 누르기 전에 단추가 하나 있음을 단언하게 고친 뒤 다시 돌린 기록이 이것이다.
- **t2** `npx vitest run test/client/lobby.test.tsx test/client/dressSheet.test.tsx test/unit/chatUi.test.ts test/unit/e2eContract.test.ts --reporter=tap-flat` → exit 1, 273개 중 not ok 18(전부 AssertionError), ok 255. 대상: "방장(첫 판·일반 방·확장판): 방장 줄 맨 아래 토글 하나 …" — 기대 `data-host-rail-btn` = tutorial, 실제 null. 같은 RED 에서 `node --test --test-reporter=tap scripts/e2e/lib.test.mjs` → exit 1, 427개 중 fail 1(패널 높이 시험, 276 ≠ 222) — 이 기록은 분류기에 넣지 않았고 `.gsd/red/19-04-t2-lib.tap` 에 따로 남겼다.

의미 판정: 두 번 모두 대상 시험이 실제로 돌았고 계획한 단언에서 실패했다. import·문법·fixture 오류는 없었다.

## 검증 결과

| 명령 | 결과 |
| --- | --- |
| `npx vitest run test/client/lobby.test.tsx test/client/dressSheet.test.tsx test/client/hostRail.test.tsx test/client/roomScreen.test.tsx` (Task 1) | 통과 — 4 files · 261 tests |
| `npx vitest run test/client/lobby.test.tsx test/unit/chatUi.test.ts test/unit/e2eContract.test.ts test/unit/camera.test.ts test/client/tutorialScreen.test.tsx test/client/dressSheet.test.tsx` (Task 2) | 통과 — 6 files · 405 tests(1 skipped) |
| `node --test scripts/e2e/lib.test.mjs` | 통과 — 427 tests, fail 0 |
| `node --check scripts/e2e/flows.mjs` (+ scripts/e2e 의 모든 .mjs) | 통과 |
| `npm run typecheck` | 통과 (exit 0) |
| `npx vitest run --project unit --project client` (전체 회귀, 계획 밖 추가) | 통과 — 229 files(1 skipped) · 7673 tests(183 skipped), 실패 0 |
| 위생 git grep(바뀐 파일) | 결과 없음 |

돌리지 않은 것: worker 시험 묶음, E2E, 배포. 앱을 브라우저에 띄워 보지도 않았다. **E2E 는 지금 상태로 돌리면 아래 "19-06 에 넘기는 E2E 판정"의 항목에서 실패할 것으로 본다(돌려서 확인하지는 않았다).**

Acceptance:
- Task 1: `grep -c "modePick"` 1 · `grep -c "ModeChip"` 2 · `grep -c 'side="bots"'` 0. `grep -c "<HostRail"` 는 **1 이 아니라 4** 다(아래 "계획과 달라진 점" 4번) — `grep -c "<HostRail "` 는 1.
- Task 2: `TutorialToggle.tsx` 없음 · 방장 증분 상수 `git grep -q … -- src test scripts` 종료 코드 1 · `tut-toggle`(tutorialRoom.css) 0 · `tut-wait` 19.
- `git grep -n "…\|TutorialToggle\|tut-toggle" -- src test scripts` 는 `scripts/e2e/tutorial.mjs:544` 한 줄만 남는다(19-06 에 넘김).

## 바뀐 표식·선택자

| 무엇 | 전 | 후 |
| --- | --- | --- |
| 튜토리얼 스위치 | 패널 안 `button.tut-toggle[data-tutorial-toggle]`(글 "튜토리얼 먼저", `disabled` 속성) | 방장 줄 `button.mv-hostrail-btn[data-host-rail-btn="tutorial"][data-tutorial-toggle]`(보이는 글 없음, `aria-disabled`). `role=switch`·`aria-checked`·이름 "튜토리얼 먼저" 는 그대로 |
| 봇 단추 | 오른쪽 열 `.mv-float[data-float="bots"][data-side-button="bots"]` | 방장 줄 `.mv-hostrail-btn[data-host-rail-btn="bots"][data-float="bots"]`, `data-side-button` 없음 |
| 맵 단추(대기실) | 오른쪽 열 `.mf-mapchip[data-map-chip][data-side-button="map"]` | 방장 줄 `.mf-mapchip.mv-hostrail-btn[data-map-chip][data-host-rail-btn="map"]`, `data-side-button` 없음, 연결이 끊기면 `aria-disabled` |
| 판 종류 | 없음 | 방장 `[data-host-rail-btn="mode"]` → `[data-mode-sheet]`·`[data-mode-card]`, 참가자 `[data-mode-chip={mode}]` |
| 테스트 방 | — | `[data-host-rail][data-test-shift]`, `[data-mode-chip][data-test-shift]` |
| 방장 대기실 패널 | 276 (스위치 줄 44 + 간격 10) | 222 (자식은 채팅 + 행동 줄 둘) |

## 참고 자료

| 경로 | 가져온 요소 |
| --- | --- |
| `design/v3.0/host-rail/README.md` | 규칙: 방장 전용은 왼쪽 세로 줄, 오른쪽 열은 [소리]·[옷장]만, [시작] 자리·모양 불변, 패널의 튜토리얼 스위치 한 줄은 줄의 토글로, 기본 마피아면 토글 숨김 |

열지 않은 참고 자료: `Main.dc.html`·`Guest.dc.html` — 부품의 생김새는 19-03 이 이 두 시안에서 이미 옮겼고, 이 계획은 부품을 순서대로 놓는 배선이라 README 의 규칙과 19-03 SUMMARY 의 부품 속성 표로 충분했다. 실제 화면을 시안과 눈으로 비교하지는 않았다(coverage D7).

방향 한 줄: 방장 전용은 금빛 테두리 단추로 왼쪽에 모으고, 참가자 공용은 오른쪽에 그대로 두며, 글은 늘리지 않는다.

## 계획과 달라진 점

### 고친 것

**1. [Rule 3 - 막힘] `test/client/dressSheet.test.tsx` 도 고쳤다(계획의 files_modified 밖)**
- **발견:** Task 1 RED
- **문제:** 이 파일의 대기실 시험 셋이 "맵 단추는 오른쪽 열에 있다"를 단언한다. 계획의 Task 1 verify 가 이 파일을 돌리는데 목록에는 없었다
- **고침:** 맵 단추 자리를 방장 줄로(`[data-host-rail] [data-map-chip]` 1개, 열에는 0개), 방장 열 기대를 `dress` 하나로, 줄 순서를 `mode,map,tutorial` 로
- **커밋:** `ed920af6`, `368b27fa`

**2. [Rule 1 - 버그] 오른쪽 열 표식 값 계약 시험이 Task 1 뒤에 깨져 있었다**
- **발견:** Task 2 RED 실행(Task 1 verify 는 `e2eContract.test.ts` 를 돌리지 않는다)
- **문제:** `test/unit/e2eContract.test.ts` 가 src 의 `data-side-button` 값이 `bots·dress·map·sound` 넷이라고 단언하는데, 봇 단추가 방장 줄로 가면서 `bots` 가 src 에서 사라졌다. **`81ef92db` 한 커밋에서는 이 시험 하나가 실패 상태다**
- **고침:** 기대를 `dress,map,sound` 로 바꾸고, 값이 E2E 사본 `SIDE_ORDER` 의 부분집합인지도 함께 본다. `SIDE_ORDER` 사본과 판정 함수는 건드리지 않았다(19-06)
- **커밋:** `5ad16658`. 이 커밋은 처음에 기대값 줄이 빠진 채 만들어져(`814a2ebf`) 곧바로 같은 커밋을 고쳐 다시 만들었다(push 전, 다른 커밋이 얹히기 전)

**3. [Rule 1 - 계획 안의 어긋남] Task 1 의 줄 순서 단언에서 [튜토리얼 먼저]를 뺐다가 Task 2 에서 넣었다**
- **문제:** Task 1 behavior 는 줄 순서를 `mode·map·bots·tutorial` 로 적었지만 같은 Task 의 action 은 토글을 Task 2 까지 패널에 둔다고 했다
- **고침:** Task 1 시험은 tutorial 을 걸러 낸 순서를, Task 2 RED 에서 걸러 내기를 없애 전체 순서(`mode,map,bots,tutorial`)를 단언한다

**4. Acceptance `grep -c "<HostRail" src/screens/Lobby.tsx` = 1 은 글자 그대로는 맞출 수 없다**
- `<HostRailButton` 줄도 같은 글자로 시작해 결과가 4 다. 의도(줄 틀이 한 번 쓰인다)는 `grep -c "<HostRail "` = 1 로 확인했다. 코드를 그 숫자에 맞추려고 바꾸지는 않았다

### 계획에 없던 작은 선택

- [맵] 줄 단추에 `host={canSend}` 를 줬다 — 계획의 "모든 줄 단추 disabled 에 !canSend" 를 맵 단추에도 맞춘 것이다. 예전에는 연결이 끊겨도 맵 단추가 눌렸다.
- 방장을 넘겨주면 열려 있던 판 종류 시트를 닫는 효과를 넣었다.
- 줄 최대 높이는 `Math.max(0, sideMaxH - 48)` 로 음수를 막았다.
- 시험은 지운 이름(옛 스위치 줄 클래스·옛 부품 이름·방장 증분 상수)을 조각으로 이어 만든다 — 계획의 "검색 결과 0줄"을 지키면서 "없음"을 단언하려고.
- `lobbyPanelHeight` 는 원래도 인자 길이가 1 이라(둘째가 기본값 인자) "두 번째 인자가 없다"는 길이로 단언할 수 없다. 대신 "둘째 인자로 true 를 줘도 222" 와 "증분 상수를 내보내지 않는다"로 단언했다.
- RED 명령에 `dressSheet.test.tsx` 를 더했다(1번).
- SUMMARY 는 Task 2 의 feat 커밋에 넣지 않고 따로 커밋했다 — `commits`·`plan_head_after` 를 잰 값으로 적으려고.
- 계획 밖으로 unit·client 전체 회귀를 두 번 돌렸다(2번을 찾은 것이 이 실행이다).

**합계:** 고친 것 4(Rule 1 둘, Rule 3 하나, acceptance 문구 하나), 작은 선택 8. 범위는 늘지 않았다.

## Threat 처리

| ID | 처리 |
| --- | --- |
| T-19-13 | 줄은 `view.me.isHost` 일 때만 렌더한다. 시험이 참가자 DOM 에 `[data-host-rail], [data-host-rail-btn]` 0개와 방장 교체 시 칩 ↔ 줄을 단언한다. 판정은 서버 몫 그대로다 |
| T-19-14 | 화면은 기본 마피아에서 `tutorial: false` 를 보낸다(토글 값이 켜져 있어도). 시험으로 고정. 서버 쪽 무시는 19-01 |
| T-19-15 | accept 그대로 — TopToast 는 한 개를 덮어쓴다 |
| T-19-SC | 패키지 설치 없음 |

새로 생긴 보안 표면: 없음(새 메시지·저장·권한 경로를 더하지 않았다. `modePick` 은 19-01 이 만든 메시지다).

## Known Stubs

없음.

## 다음 계획이 알아야 할 것

### 19-06 에 넘기는 E2E 판정

이 계획은 E2E 를 돌리지 않았고 아래를 고치지 않았다. 지금 돌리면 실패할 것으로 보는 곳이다.

1. **`sideColumnChecks` 의 방장 대기실 기대**(`scripts/e2e/lib.mjs` 2328행 근처, `SIDE_ORDER` 2305행) — 방장도 오른쪽 열이 소리·옷장 둘이다. `mapsOn`·`botsOn` 으로 맵·봇을 열에서 기대하는 부분과 `SIDE_ORDER` 의 `bots` 를 고친다. 부르는 곳: `flows.mjs` 250행(대기실 열 판정), `mapselect.mjs` 250행.
2. **`mapselect.mjs` 의 맵 단추 자리** — `[data-map-chip]` 선택자는 그대로 잡히지만 단추가 왼쪽 줄에 있고 클래스에 `.mv-hostrail-btn` 이 붙었다. 자리(오른쪽 열 안)·원 크기를 재는 판정이 있으면 줄 기준으로 바꾼다.
3. **`tutorial.mjs` 의 토글 판정** — TG0·TG1·TG2 는 `[data-tutorial-toggle]`·`aria-checked` 라 그대로 통할 것이다. **TG3(543~544행, `.tut-toggle__title`·줄 높이 44·기록 칸 폭)** 은 옛 스위치 줄의 치수 판정이라 다시 써야 한다. 635행 `toggle2` 도 확인한다. 토글이 사용 불가인지 `:disabled`·`isDisabled()` 로 보는 곳이 있으면 `aria-disabled` 로 바꾼다.
4. **`flows.mjs` 대기실 열 판정(250~251행)** — 1번과 같은 호출이다. 패널 높이 판정(CP1)은 이 계획에서 222 한 값으로 고쳤다(`chatPanelRows(m)` 인자 하나).
5. 방장 패널이 276 → 222 가 되어 방장 화면의 스테이지 사각형이 54 커졌다 — 방장 화면 기준으로 박아 둔 스테이지 높이 기대가 있으면 다시 잰다.
6. `docs/screen-map.md` 42행은 아직 276 과 옛 상수 이름을 적고 있다(19-08 의 몫).

### 19-05(결과 화면)

- 대기실에서 쓴 모양 그대로 붙이면 된다: 조건 `isHost && !dressOpen && !kbOpen`(결과는 `expanded` 도), 줄 `<HostRail maxHeight={…} testShift={…}>`, 참가자 `<ModeChip mode={modeOf(view)} testShift={…} />`, 시트 `onPick` 은 `canSend` 일 때만 `send({ t: "modePick", mode })`.
- 초점 복원은 `HostRailButton` 의 `ref` + "닫을 때 플래그, 시트 상태가 바뀐 뒤 effect 에서 focus" 로 했다(`Lobby.tsx` 의 `modeBtnRef`·`restoreModeFocus`). 줄은 시트가 열려 있어도 DOM 에 남아 있어(CSS 로만 숨는다) 닫힌 직후 바로 초점을 받는다.
- 알림은 기존 diff 효과에서 `prev` 를 덮어쓰기 전에 잡아 `toastForDiff` 결과가 없을 때만 `modeToastOf(prev, view)` 를 띄운다. 재접속 띠가 떠 있으면 띄우지 않되 기준선은 갱신한다.
- `result.css` 의 가상 뷰포트 이동 줄에 `.mf-result .mf-hostrail, .mf-result .mf-modechip` 을 더해야 한다(대기실은 `lobby.css` 42행에 넣었다).
- 결과 화면의 `data-side-button` 값이 바뀌면 `test/unit/e2eContract.test.ts` 의 표식 값 계약(지금 `dress,map,sound`)이 다시 깨진다 — 결과 화면의 맵 단추까지 줄로 옮기면 `map` 이 src 에서 사라지는지 확인하고 기대를 맞춘다.
- `sideMaxH` 는 측정 전 `Infinity` 다(`useMapInsets`). 0 을 넘기지 않는다.

### 그 밖

- 옛 전역 규칙 상수 이름은 이 계획의 파일 어디에도 없다. push·배포는 하지 않았다(19-08).

## Self-Check: PASSED

- 파일: src/screens/Lobby.tsx · src/styles/lobby.css · src/styles/tutorialRoom.css · src/game/chatUi.ts · scripts/e2e/lib.mjs · scripts/e2e/flows.mjs · scripts/e2e/lib.test.mjs · test/client/lobby.test.tsx · test/client/dressSheet.test.tsx · test/unit/chatUi.test.ts · test/unit/e2eContract.test.ts — 모두 있음. src/components/v2/TutorialToggle.tsx — 없음(의도한 삭제)
- 커밋: ed920af6 · 81ef92db · 5ad16658 · 368b27fa · b2ce1a59 — 모두 HEAD 의 조상
- `git rev-list --count b2c4a3c5..HEAD` = 5 (SUMMARY 커밋 전 측정)
