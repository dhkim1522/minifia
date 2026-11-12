---
phase: 20-map-expansion
plan: "07"
subsystem: ui
tags: [map, mode, host-rail, dress-sheet, e2e, tdd]
status: complete

requires:
  - phase: 20-map-expansion
    provides: "20-01 — 서버의 판 종류 고정 맵(MODE_MAPS·startMapOf): 확장판 판은 방장 선택과 상관없이 마을에서 시작한다"
  - phase: 19-game-modes
    provides: "19-04·19-05 방장 줄(HostRail)·판 종류 시트, 19-06 E2E 도우미(pickModeViaRail·readHostRail·hostRailChecks)"
provides:
  - "Lobby·ResultScreen 의 mapsOn = 허용 맵 둘 이상 && modeOf(view) === basic — 확장판에는 방장 줄의 [맵] 단추와 꾸미기 시트의 맵 탭이 없다"
  - "DressSheet: 열린 채 host 가 거짓이 되면 의상 탭으로 돌아간다"
  - "scripts/e2e/mapselect.mjs — pickModeViaUi(page, tracker, mode) · mapRailChecks(TM11a·TM11b·TM11c-숨김·TM11c-복귀)"
  - "scripts/e2e/lib.mjs — railMapsOn(허용 맵 둘 이상, 판 종류): hostRailChecks 의 mapsOn 입력을 만드는 한 곳"
  - "map-select 흐름이 기본 마피아 판에서 돈다(확장판 숨김 → 기본 마피아 전환 → 맵 선택 → 결과 화면 숨김·복귀)"
affects: [20-08, 20-09, 20-10, 21]

actuals:
  tokens: 18774
  tasks: 2
  commits: 4

plan_head_before: ea2a6c837c8bd4612eb73d8d963f190c125fa349
plan_head_after: 20b583fa4cab698ef0b2ebba737c231fce91e9e2
commits: 4

tech-stack:
  added: []
  patterns:
    - "방장 줄의 칸 조건은 서버가 방송한 공개 값(view.mode)으로만 정한다 — 화면 숨김은 편의이고 판정은 서버(MODE_MAPS)가 한다"
    - "E2E 판정 입력 가운데 앱 조건의 사본(줄에 [맵] 이 있어야 하는가)은 lib.mjs 의 순수 함수 하나(railMapsOn)로 만들고 흐름은 서버 view.mode 를 넘긴다 — 화면에서 읽은 단추로 기대를 만들지 않는다"
    - "'없음' 판정은 읽기 자체가 실패한 화면이 통과하지 못하게 '있어야 하는 것'을 함께 본다(mapRailChecks 는 줄에 mode 단추가 있어야 한다)"

key-files:
  created: []
  modified:
    - src/screens/Lobby.tsx
    - src/screens/ResultScreen.tsx
    - src/components/v2/DressSheet.tsx
    - test/client/lobby.test.tsx
    - test/client/resultScreen.test.tsx
    - test/client/dressSheet.test.tsx
    - scripts/e2e/mapselect.mjs
    - scripts/e2e/mapselect.test.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/modes.mjs
    - scripts/e2e/tutorial.mjs

key-decisions:
  - "E2E 의 [맵] 칸 기대는 hostRailChecks 안을 고치지 않고 입력(mapsOn)을 railMapsOn(허용 맵 둘 이상, 판 종류)으로 만든다 — 단추 넷짜리 줄로 기하·접힘을 재는 기존 판정 시험 30여 개를 그대로 둔다"
  - "DressSheet 는 host 가 거짓이 되면 탭을 의상으로 되돌리고, 다시 참이 되어도 저절로 맵 탭으로 가지 않는다"
  - "pickModeViaUi 는 browser.mjs 의 pickModeViaRail 을 그대로 부르고 꾸미기 시트만 먼저 닫는다(셀렉터를 두 벌 두지 않는다)"

requirements-completed: [D-02]

coverage:
  - id: D1
    description: "확장판이면 대기실·결과 화면 방장 줄의 [맵] 단추와 꾸미기 시트의 맵 탭이 없고, 기본 마피아로 되돌리면 이전 mapChoice 와 함께 다시 나타난다. 참가자 화면은 두 판 모두 [맵] 이 없다"
    requirement: "D-02"
    verification:
      - kind: unit
        ref: "test/client/lobby.test.tsx#Lobby — 확장판의 [맵] 숨김 (20-07, D-02·P20-16)"
        status: pass
      - kind: unit
        ref: "test/client/resultScreen.test.tsx#결과 화면 방장 줄과 판 종류 (19-05, D-06·D-13) — 20-07 시험 넷"
        status: pass
      - kind: e2e
        ref: "node scripts/e2e/run.mjs --url http://localhost:5173 --only map-select (폰 6종, TM11a·TM11b·TM11c-숨김·TM11c-복귀)"
        status: pass
    human_judgment: false
  - id: D2
    description: "꾸미기 시트가 맵 탭으로 열려 있다가 확장판이 되면 탭 줄이 사라지고 의상 탭이 된다"
    requirement: "D-02"
    verification:
      - kind: unit
        ref: "test/client/dressSheet.test.tsx#맵 탭으로 열려 있다가 host 가 거짓이 되면(확장판이 됐다) 탭 줄이 사라지고 의상 탭이 된다"
        status: pass
      - kind: unit
        ref: "test/client/lobby.test.tsx#기본 마피아에서 [맵]으로 시트를 맵 탭으로 연 뒤 view 가 확장판으로 바뀌면 탭 줄이 없고 의상 카드가 보인다 (P20-16)"
        status: pass
    human_judgment: false
  - id: D3
    description: "E2E map-select 가 기본 마피아로 바꾼 뒤 맵을 고르고 시작하며 폰 6종에서 통과한다. 시작한 판의 맵은 bar·plaza 이고 마을이 아니다"
    requirement: "D-02"
    verification:
      - kind: e2e
        ref: "node scripts/e2e/run.mjs --url http://localhost:5173 --only map-select (6종 각 82/82)"
        status: pass
      - kind: unit
        ref: "node --test scripts/e2e/mapselect.test.mjs (18/18)"
        status: pass
    human_judgment: false
  - id: D4
    description: "mode-rail 이 확장판에서 단추 하나가 줄어든 방장 줄 배치(판 종류·봇·튜토리얼)로 폰 6종에서 통과한다 — 줄 접기 규칙은 그대로"
    verification:
      - kind: e2e
        ref: "node scripts/e2e/run.mjs --url http://localhost:5173 --only mode-rail (6종, 39/39 넷 · 41/41 둘)"
        status: pass
      - kind: unit
        ref: "scripts/e2e/lib.test.mjs#HR4(20-07): 흐름이 넘기는 mapsOn = railMapsOn(허용 맵 둘 이상, 판 종류)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-11-13
---

# Phase 20 Plan 07: 확장판에서 [맵] 단추·맵 탭 숨김 Summary

**방장 줄의 [맵] 단추와 꾸미기 시트의 맵 탭을 기본 마피아 판에만 그리고(`mapsOn = 허용 맵 둘 이상 && modeOf(view) === "basic"`), map-select E2E 를 기본 마피아 판으로 옮겨 숨김·복귀(TM11)를 대기실과 결과 화면에서 판정한다.**

## Performance

- **Duration:** 약 20분
- **Started:** 2026-11-12T22:27:41Z
- **Completed:** 2026-11-12T22:48:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- 확장판(서버 기본값, `mode` 키가 없는 view 포함)의 방장 대기실·결과 화면에는 [맵] 단추가 없다. 대기실 줄은 [판 종류]·[봇]·[튜토리얼 먼저], 결과 화면 줄은 [판 종류] 하나다.
- 기본 마피아로 바꾸면 [맵] 이 이전에 고른 맵(`view.mapChoice`)과 함께 다시 나타난다. `view.mapChoice` 는 화면이 건드리지 않는다.
- 꾸미기 시트가 맵 탭으로 열려 있다가 확장판이 되면 탭 줄이 사라지고 의상 카드가 보인다. 기본 마피아로 되돌려도 저절로 맵 탭으로 넘어가지 않는다.
- 참가자 화면은 두 판 모두 그대로다([맵] 단추·맵 탭 없음). 새 글·새 아이콘·새 단추는 없다. `PLAYABLE_MAPS` 는 `["bar", "plaza"]` 그대로다(town 없음).
- E2E `map-select` 가 확장판에 [맵]·맵 탭이 없음을 본 뒤 방장 줄의 [판 종류] 로 기본 마피아를 골라 맵을 고르고, 결과 화면에서 확장판 ↔ 기본 마피아를 오가며 숨김·복귀를 본다.

## 검증 결과

| 명령 | 결과 |
|------|------|
| `npx vitest run test/client/lobby.test.tsx test/client/resultScreen.test.tsx test/client/dressSheet.test.tsx test/client/hostRail.test.tsx test/client/mapChip.test.tsx` | 5 파일 364/364 통과 |
| `npx vitest run --project unit --project client` | 232 파일 통과·1 건너뜀, 7848 통과·183 건너뜀, 실패 0 |
| `npm run typecheck` | 종료 0 (error TS 0) |
| `node --test scripts/e2e/*.test.mjs` | 592/592 통과 |
| `node --test scripts/e2e/mapselect.test.mjs scripts/e2e/lib.test.mjs` | 472/472 통과 (mapselect 18 · lib 454) |
| 위생 `git grep -nIiE` (바뀐 파일 12개) | 결과 없음 |

### E2E (로컬 개발 서버 `http://localhost:5173`, 이미 떠 있던 서버를 그대로 썼고 끄지 않았다)

| 흐름 | 360x560 | 360x640 | 390x664 | 390x844 | 402x874 | 430x932 | 걸린 시간 |
|------|---------|---------|---------|---------|---------|---------|-----------|
| `--only map-select` | 82/82 | 82/82 | 82/82 | 82/82 | 82/82 | 82/82 | 72초 |
| `--only mode-rail` | 41/41 | 39/39 | 39/39 | 41/41 | 39/39 | 39/39 | 15초 |
| `--only tutorial-together` (입력 한 줄을 고쳐 확인차) | — | — | — | 34/34 | — | — | 13초 |

- map-select 는 폰 6종을 두 번 돌렸다(줄을 못 읽은 화면 방지 조건을 더하기 전·후). 두 번 모두 6종 82/82, 남은 실패 0. 간헐 실패는 없었다.
- map-select 의 새 판정 줄: `TM11a`(대기실 확장판 숨김) · `TM11p`(기본 마피아 전환이 방장·참가자에 닿음) · `TM11b`(대기실 복귀 + 맵 선택 그대로) · `TM11q` · `TM11c-숨김` · `TM11r` · `TM11c-복귀`(결과 화면). 기존 MC·MS·SC·HR·CH·R-* 줄은 그대로이고 문턱을 낮춘 곳이 없다.
- mode-rail 의 크기별 줄 수 차이(39·41)는 키보드 열림 단계가 두 크기(360x560·390x844)에만 있어서다(19-06 그대로).

### 잰 값 (mode-rail·map-select 의 HRM 참고 줄, 테스트 방 대기실 = 줄이 48 내려온 방)

| 크기 | 줄 최대 높이 | 단추 수 (확장판 / 기본 마피아) | 표식 | 열 | 19-06(단추 넷) 대비 |
|------|--------------|-------------------------------|------|----|---------------------|
| 360x560 | 164.4 | 3 / 3 | 없음 | [2,1] | 여전히 두 열(전에는 [2,2]) |
| 360x640 | 244.4 | 3 / 3 | 있음 | [3] | 한 열 + 표식 |
| 390x664 | 268.4 | 3 / 3 | 있음 | [3] | 한 열 + 표식 |
| 390x844 | 448.4 | 3 / 3 | 있음 | [3] | 한 열 + 표식 |
| 402x874 | 478.4 | 3 / 3 | 있음 | [3] | 한 열 + 표식 |
| 430x932 | 536.4 | 3 / 3 | 있음 | [3] | 한 열 + 표식 |

- 대기실 줄은 이제 어느 판에서도 단추가 셋이다(확장판: 판 종류·봇·튜토리얼, 기본 마피아: 판 종류·맵·봇). 봇 도구가 없는 일반 방은 둘이다.
- 결과 화면(기본 마피아, 단추 둘): 줄 최대 높이 274.4 · 354.4 · 378.4 · 558.4 · 588.4 · 646.4, 6종 모두 표식 + [2]. 확장판 결과 화면은 단추 하나다.
- 360x560 확장판 대기실은 접힌 줄의 둘째 열([튜토리얼 먼저])이 위 알림과 겹치는 알려진 한계(`HOST_RAIL_KNOWN_LIMITS` fold-toast) 줄이 그대로 나온다(판정 아님, 받아들인 한계).

## RED 증거

`gsd-tools check tdd-red-evidence` 에 넘겨 셋 모두 `RED_EVIDENCE_OK`(target_test_failed). 기록은 gitignore 된 `.gsd/red/20-07-t1*`·`20-07-t2*`.

- **Task 1 RED**: `npx vitest run test/client/lobby.test.tsx test/client/resultScreen.test.tsx test/client/dressSheet.test.tsx --reporter=tap-flat` → 316 중 **not ok 12** · ok 304, 종료 1(전부 단언 실패). 대상 "방장: 확장판(mode 키 없음 = 기본값, extended)이면 [맵] 단추가 없고 기본 마피아면 하나 있다" 가 `expected '키 없음: [맵] 1' to be '키 없음: [맵] 0'` 로 실패.
  - 이 첫 실행은 표준 오류가 섞여 분류기가 `invalid_record`(Unsupported report format)로 읽지 못했다. 구현 커밋 뒤 시험 커밋(`e880d96d`)의 소스 세 파일로 되돌려 lobby.test 만 표준 출력으로 다시 받았다: 134 중 not ok 7 · ok 127, 종료 1, `RED_EVIDENCE_OK`. 분류기 확인이 구현 뒤에 이루어진 것은 순서상 어긋난 점이다(실패 자체는 구현 전에 확인했다).
- **Task 2 RED (mapselect)**: `node --test --test-reporter=tap scripts/e2e/mapselect.test.mjs` → 17 중 **not ok 6** · ok 11, 종료 1, 전부 `ERR_ASSERTION`. 대상 "TM11a: 확장판 줄에 map 이 없고 시트에 맵 탭이 없으면 통과한다" 가 `expected: 1, actual: 0`(자리 함수가 판정 줄을 내지 않음)으로 실패.
- **Task 2 RED (lib)**: `node --test --test-reporter=tap scripts/e2e/lib.test.mjs` → 454 중 **not ok 2** · ok 452, 종료 1. 대상 "railMapsOn(20-07, D-02·P20-16) …" 가 `expected: false, actual: true`(자리 함수가 옛 동작대로 허용 맵 수만 봄)로 실패.

## Task Commits

1. **Task 1: [맵] 단추·맵 탭 숨김** — `e880d96d` (test) · `0f85be7d` (feat)
2. **Task 2: E2E pickModeViaUi·TM11·폰 6종 실행** — `78bd5c90` (test) · `20b583fa` (feat)

## Files Created/Modified

- `src/screens/Lobby.tsx`·`src/screens/ResultScreen.tsx` — `mapsOn` 에 판 종류 조건. 칩과 시트의 `host` 인자는 그대로 `mapsOn` 을 따른다
- `src/components/v2/DressSheet.tsx` — `host` 가 거짓이 되면 탭을 의상으로
- `test/client/lobby.test.tsx`·`resultScreen.test.tsx`·`dressSheet.test.tsx` — 새 시험과 기존 시험의 판 종류 명시
- `scripts/e2e/mapselect.mjs` — `pickModeViaUi`·`mapRailChecks`·흐름의 TM11 단계·`readMapHidden`
- `scripts/e2e/mapselect.test.mjs` — `mapRailChecks` 사례 7개
- `scripts/e2e/lib.mjs`·`lib.test.mjs` — `railMapsOn` 과 그 값을 넘긴 HR4 실제 줄 모양 시험
- `scripts/e2e/modes.mjs`·`tutorial.mjs` — `mapsOn` 입력을 `railMapsOn` 으로

## 고친 기존 화면 시험 (20개 — 확장판 기본값에서 [맵] 을 보던 곳)

같은 것을 계속 보도록 판 종류를 기본 마피아로 명시했다. 기대를 느슨하게 한 곳은 없다.

- **dressSheet.test — "Lobby — 지도 칩과 맵 탭" 묶음(6개)**: `hostView`·`guestView` 의 기본 판 종류를 basic 으로. 마지막 시험만 기대가 바뀌었다: `mode,map,tutorial` → 기본 마피아 `mode,map` + 확장판 `mode,tutorial`([맵] 과 [튜토리얼 먼저]는 이제 한 줄에 함께 있을 수 없다).
- **lobby.test — "방장 줄과 판 종류" 묶음(3개)**: "방장: 왼쪽 줄 …" 은 확장판 `mode,bots,tutorial` 로, 기본 마피아 `mode,map,bots` 는 새 시험으로 갈랐다. "봇 도구가 없는 방장 …" 은 두 판 모두(`mode,tutorial` · `mode,map`), "기본 마피아를 고르면 …" 은 [튜토리얼 먼저]가 사라지고 [맵] 이 생기는 것으로.
- **resultScreen.test — "결과 단계 꾸미기"(1개)·"결과 단계 지도 칩과 맵 탭"(5개 + 통과하던 3개도 basic 으로)·"결과 화면 방장 줄과 판 종류"(5개)**: `basicView`·`withMode(…, "basic")` 로 명시. "방장(최종 상태) …" 은 기본 마피아 `mode,map` 으로 두고 확장판 `mode` 는 새 시험으로 갈랐다. "허용 맵이 하나뿐이면 …" 두 시험은 basic 으로 명시해 허용 맵 수 조건을 계속 본다(확장판이면 다른 이유로 통과해 버린다).

## Decisions Made

- **E2E 의 [맵] 칸 기대는 입력에서 만든다.** `hostRailChecks` HR4 는 `mapsOn` 입력을 그대로 보고, 흐름이 `railMapsOn(허용 맵 둘 이상, 서버 view.mode)` 를 넘긴다. HR4 안에서 판 종류를 보게 하면 단추 넷짜리 줄로 기하·색·접힘을 재는 기존 lib 시험 30여 개의 정상값을 다시 짜야 한다. 기대는 여전히 화면에서 읽은 단추가 아니라 서버 값에서 나온다.
- **탭 되돌리기는 한 방향이다.** `host` 가 거짓이 될 때만 의상 탭으로 가고, 다시 참이 되어도 맵 탭으로 저절로 돌아가지 않는다.
- **`pickModeViaUi` 는 얇은 감싸기다.** 꾸미기 시트를 닫고 `pickModeViaRail` 을 부른다.

## Deviations from Plan (계획과 달라진 점)

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 방장 줄 판정의 `mapsOn` 입력이 상수 true 였다**
- **Found during:** Task 2
- **Issue:** `modes.mjs`(`MAPS_ON = true`)·`mapselect.mjs`·`tutorial.mjs` 가 `hostRailChecks` 에 `mapsOn: true` 를 넘겨 HR4 가 확장판 줄에도 [맵] 을 기대했다. 그대로면 mode-rail 이 폰 6종에서 실패한다. 계획의 files_modified 에는 `mapselect.mjs`·`mapselect.test.mjs` 만 있었다.
- **Fix:** `lib.mjs` 에 `railMapsOn(playableMany, mode)`(앱 조건의 사본)을 더하고 세 흐름이 그것으로 입력을 만든다. `lib.test.mjs` 에 함수 시험과 실제 줄 모양(확장판 `mode·bots·tutorial`, 기본 마피아 `mode·map·bots`, 결과 화면 확장판 `mode`) 시험을 더했다. HR4 라벨·주석도 맞췄다.
- **Files modified:** scripts/e2e/lib.mjs, scripts/e2e/lib.test.mjs, scripts/e2e/modes.mjs, scripts/e2e/tutorial.mjs
- **Verification:** `node --test scripts/e2e/*.test.mjs` 592/592, mode-rail 폰 6종 통과, tutorial-together 34/34
- **Committed in:** `78bd5c90`(시험·자리 함수) · `20b583fa`

**2. [Rule 2 - Missing Critical] `mapRailChecks` 가 줄을 못 읽은 화면을 통과시킬 수 있었다**
- **Found during:** Task 2 (첫 폰 6종 실행 뒤 판정을 다시 읽다가)
- **Issue:** "[맵] 없음"은 줄 단추가 0개여도 참이다. 줄 읽기가 실패한 화면이 TM11a 를 통과할 수 있었다.
- **Fix:** 두 판 모두 줄에 `mode` 단추가 있어야 한다는 조건과 시험 하나("줄을 못 읽었으면 …")를 더했다. 이 시험은 구현과 같은 커밋에 들어갔다(따로 RED 를 남기지 않았다).
- **Files modified:** scripts/e2e/mapselect.mjs, scripts/e2e/mapselect.test.mjs
- **Verification:** mapselect.test 18/18, map-select 폰 6종 다시 82/82
- **Committed in:** `20b583fa`

### 그 밖에 계획과 다른 곳

- **`mapRailChecks` 의 판정 id.** 계획은 TM11a·TM11b·TM11c 셋을 말했다. 결과 화면은 숨김과 복귀가 따로 실패할 수 있어 `TM11c-숨김`·`TM11c-복귀` 두 줄로 냈고, 판 종류 전환이 닿았는지는 흐름 줄 `TM11p`·`TM11q`·`TM11r` 로 따로 남긴다.
- **`mapRailChecks` 입력.** 계획의 예(`{ mode, railButtons, tabs }`)에 `screen`·`viewMode`(서버 값, 주면 기대 판 종류와 같아야 한다)·`prevChoice`·`chipId` 를 더했다. 계획의 예 그대로 불러도 통과한다.
- **기존 시험 한 곳의 기대가 바뀌었다.** dressSheet.test 의 `mode,map,tutorial` 은 새 규칙에서 있을 수 없는 줄이라 두 판으로 갈랐다(위 목록).
- **RED 커밋에 자리 함수 둘.** `mapRailChecks`(빈 배열)·`railMapsOn`(옛 동작)을 시험 커밋에 넣어 실패가 가져오기 오류가 아니라 단언 실패가 되게 했다(19-06 과 같은 방식).

---

**Total deviations:** 2 auto-fixed (Rule 3 하나, Rule 2 하나)
**Impact on plan:** 계획 범위 밖 파일 넷(E2E 판정·흐름)을 고쳤다. 앱 코드는 계획대로 세 파일이다. 판정 문턱을 낮춘 곳은 없다.

## Issues Encountered

- RED 기록 형식: 표준 오류를 섞어 받은 TAP 은 분류기가 읽지 못한다. 표준 출력만 받아야 한다(위 RED 증거).

## 돌리지 않은 것

- `chat-keyboard`: 새 단추가 없어 돌리지 않았다(UI-SPEC 방장 줄 절).
- `mode-pick`·`mode-basic`·`tutorial-solo` 와 그 밖의 흐름: 이 계획에서 돌리지 않았다. `modes.mjs` 의 `railArgs` 한 곳을 고쳤으므로 mode-pick 의 HR4 줄(기본 마피아 대기실·결과)은 20-10 의 전체 회귀에서 처음 돈다.
- `perf-run.mjs --map plaza`: 고치지 않았다(20-09). 지금은 확장판 방에서 [맵] 칩을 찾지 못해 실패한다.
- 실기기 확인: 없음.

## User Setup Required

None - no external service configuration required.

## 알려진 한계

- `scripts/e2e/lib.test.mjs` 의 방장 줄 정상값(`railIn`)은 단추 넷(mode·map·bots·tutorial)짜리 확장판 줄이다. 앱에서는 더 나오지 않는 줄이고 기하·색·접힘 판정용 입력으로 남겼다(주석에 적었다). 실제 줄 모양은 "HR4(20-07)" 시험이 본다.
- `docs/screen-map.md` 의 방장 줄 설명(27·45행: [맵](허용 맵이 둘 이상), 순서 [판 종류]·[맵]·[봇]·[튜토리얼 먼저])과 19-06 실측 표는 아직 옛 내용이다. 20-10 의 문서 단계가 고친다.

## 다음 계획이 알아야 할 것

### 20-08 (마을 E2E)

- **확장판 방의 방장 대기실 줄은 [판 종류]·[봇]·[튜토리얼 먼저] 셋이다.** `[data-host-rail-btn="map"]`·`[data-map-chip]` 은 없다. 방장 줄을 `hostRailChecks` 로 잴 때는 `mapsOn: railMapsOn(true, 서버 view.mode)`(lib.mjs)를 넘긴다 — `true` 를 그대로 넘기면 HR4 가 실패한다.
- **마을 판은 판 종류를 건드리지 않고 시작하면 된다**(확장판이 서버 기본값). 기본 마피아 판이 필요하면 `pickModeViaUi(hp, ht, "basic")`(mapselect.mjs) 또는 `pickModeViaRail`(browser.mjs), `openGame(ctx, id, { mode: "basic" })`.
- **map-select 는 기본 마피아 판만 본다.** 시작한 판의 `view.map`·`__mfMap` 은 bar·plaza 다. 확장판 판이 `town` 으로 시작하는지는 map-select 가 보지 않는다 — 20-08 몫이다.
- 판 종류를 바꾸면 참가자 화면에 알림 한 줄이 1.5초 뜬다. 바꾼 직후 기하를 재려면 `readHostRail(gp).toast === null` 을 기다린다(map-select 가 그렇게 한다).
- 판 종류와 맵 선택은 테스트 도구의 "대기실로 되돌리기"와 다시 하기 뒤에도 방에 남는다.
- 360x560 테스트 방 대기실은 단추 셋이어도 두 열([2,1])로 접힌다.

### 20-09 (perf-run)

- `perf-run.mjs` 의 `--map bar|plaza` 는 `pickMapViaUi` 앞에 `await pickModeViaUi(page, tracker, "basic")` 를 불러야 한다(확장판 방에는 [맵] 칩이 없다). `--map town` 은 판 종류를 바꾸지 않는다.

### 20-10 (문서·전체 회귀)

- `docs/screen-map.md`: 방장 줄 행(확장판 [판 종류]·[봇]·[튜토리얼 먼저] / 기본 마피아 [판 종류]·[맵]·[봇], 결과 화면 [판 종류](+ 기본 마피아 [맵])), 위 실측 표, map-select 의 TM11 줄, `railMapsOn`.
- 전체 회귀에서 mode-pick·mode-basic·tutorial-solo 를 처음 돌린다.

## Threat Flags

없음. 새 네트워크 끝점·인증 경로·저장 스키마가 없다. T-20-23(숨김은 편의, 서버 `pickMap`·`MODE_MAPS` 가 판정)은 서버를 고치지 않아 그대로다. T-20-24: 새 판정 줄(TM11*)의 내용은 표식 이름·개수·맵 id·판 종류뿐이다. T-20-25: E2E 는 로컬 개발 서버로만 돌렸다. T-20-SC: 패키지를 설치하지 않았다.

## Known Stubs

없음. RED 커밋의 자리 함수 둘(`mapRailChecks`·`railMapsOn`)은 구현 커밋에서 실제 구현으로 바뀌었다.

## Self-Check: PASSED

- 파일: 바뀐 12개 모두 디스크에 있다.
- 커밋: `e880d96d`·`0f85be7d`·`78bd5c90`·`20b583fa` 모두 HEAD 의 조상이다. `git rev-list --count ea2a6c83..20b583fa` = 4.
- Acceptance(Task 1): `grep -c modeOf` Lobby 3 · ResultScreen 3, `PLAYABLE_MAPS` 리터럴 1.
- Acceptance(Task 2): `export async function pickModeViaUi` 1 · `TM11` 3 이상(mapselect.mjs) · E2E 표에 map-select·mode-rail 폰 6종, 남은 실패 0.

---
*Phase: 20-map-expansion*
*Completed: 2026-11-13*
