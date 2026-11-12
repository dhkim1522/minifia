---
phase: 19-game-modes
plan: "03"
subsystem: ui
tags: [game-mode, host-rail, mode-sheet, mode-chip, v2icon, room-diff, tdd, a11y]
status: complete

requires:
  - phase: 19-01 (판 종류 서버)
    provides: GameMode·view.mode·modeOf, 메시지 modePick(거절은 state 한 프레임)
provides:
  - "HostRail·hostRailLayout(n, maxH) — 방장 전용 왼쪽 줄 틀(왕관 표식·접기·테스트 방 아래로)"
  - "HostRailButton — 금빛 테두리 52 원 단추(눌림·토글·사용 불가), data-host-rail-btn"
  - "MapChip 의 rail·pressed 속성(방장 줄 변형)"
  - "ModeSheet — 판 종류 두 칸 시트(낙관 갱신 없음), data-mode-sheet·data-mode-card"
  - "ModeChip — 참가자 읽기 전용 칩, data-mode-chip"
  - "V2Icon deck·book·modeBasic·modeExtended"
  - "MODE_ORDER·MODE_TEXT(src/game/modeText.ts), modeToastOf(prev, next)(src/net/roomDiff.ts)"
  - "CSS .mf-hostrail*·.mv-hostrail-btn·.mf-modechip(v2.css), .mf-mode-sheet*·.mf-mode-card*(sheet.css)"
affects: [19-04, 19-05, 19-06, 19-08]

actuals:
  tokens: 16600
  tasks: 3
  commits: 7

plan_head_before: e33389c7c929d0187c9100eb350d0e13f36aa889
plan_head_after: 9923d593394351ebc078f4bbed3e2dd1fda21c95
commits: 7

tech-stack:
  added: []
  patterns:
    - "방장 전용 = 정지한 금빛 테두리(.mv-hostrail-btn), 지금 누를 것 = 깜빡이는 금빛(.is-call) — 둘을 가르는 것은 움직임이고 줄 단추는 .is-call 선택자에 넣지 않는다(시험이 고정)"
    - "선택 시트는 보내기만 한다: 고른 표시는 부모가 준 서버 값에서만 나오고 낙관 갱신이 없다(ModeSheet = DressSheet 맵 탭과 같은 방식)"
    - "읽기 전용 정적 요소의 접근성 글은 aria-label 이 아니라 .mf-sr-only 텍스트로 둔다(ModeChip)"
    - "줄 접기는 새 규칙을 만들지 않고 SideColumn 의 splitSideColumn·SIDE_CELL·SIDE_GAP 을 재사용한다"

key-files:
  created:
    - src/game/modeText.ts
    - src/components/v2/HostRailButton.tsx
    - src/components/v2/HostRail.tsx
    - src/components/v2/ModeChip.tsx
    - src/components/ModeSheet.tsx
    - test/client/hostRail.test.tsx
  modified:
    - src/components/v2/V2Icon.tsx
    - src/components/v2/MapChip.tsx
    - src/net/roomDiff.ts
    - src/styles/v2.css
    - src/styles/sheet.css
    - test/unit/roomDiff.test.ts

key-decisions:
  - "판 종류 시트의 면은 이 시트만 night-900 + 위 테두리 1px night-600 으로 둔다(.mf-sheet.mf-mode-sheet) — 공용 시트 틀은 night-800 이라 그대로 두면 칸(night-800)이 면과 구별되지 않는다. 시안과 UI-SPEC Color 표의 값이다"
  - "고른 칸은 테두리가 1px 굵어진 만큼 안쪽 여백을 1px 줄인다 — 선택이 옮겨 가도 칸 안의 그림·글이 움직이지 않는다"
  - "HostRail 은 단추가 0개면 아무것도 그리지 않는다 — 이름만 있는 빈 group 을 남기지 않는다"
  - "가상 뷰포트 이동 줄(lobby.css·result.css 의 --mf-vv-top 선택자)은 이 계획에서 고치지 않는다 — 화면 범위 선택자라 19-04·19-05 가 자기 화면 CSS 에서 더한다"

requirements-completed: [D-01, D-05, D-07, D-13, D-14, D-15, D-16]

coverage:
  - id: D1
    description: "[판 종류] 방장 단추(HostRailButton): 금빛 테두리 52 원·보이는 글 없음·접근성 이름은 받은 글, 눌림(aria-pressed)·토글(role=switch)·사용 불가(aria-disabled, 눌러도 0회), mousedown 기본 동작 차단, 기존 선택자(data-float=bots·data-tutorial-toggle) 잇기"
    requirement: D-14
    verification:
      - kind: unit
        ref: "test/client/hostRail.test.tsx#HostRailButton — 방장 원형 단추 (19-03, D-13·D-14, UI-SPEC A-3·A-4)"
        status: pass
    human_judgment: false
  - id: D2
    description: "판 종류 시트(ModeSheet): 제목 + 두 칸(기본 마피아·확장판, 순서 고정), 다른 칸을 누르면 onPick 한 번, 고른 표시는 서버 값만 따른다(낙관 갱신 없음). 이미 고른 칸·연결 끊김은 0회, [닫기]는 동작"
    requirement: D-05
    verification:
      - kind: unit
        ref: "test/client/hostRail.test.tsx#ModeSheet — 판 종류 두 칸 시트 (19-03, D-05·D-15, UI-SPEC B, P19-6)"
        status: pass
    human_judgment: false
  - id: D3
    description: "방장 줄 틀(HostRail·hostRailLayout): role=group '방장 전용', F-2 세 갈래(표식 한 열·표식 없는 한 열·splitSideColumn 두 열), 테스트 방 아래로(data-test-shift), 단추 0개면 미렌더"
    requirement: D-13
    verification:
      - kind: unit
        ref: "test/client/hostRail.test.tsx#hostRailLayout — 왕관 표식과 열 고르기 (19-03, UI-SPEC F-2, P19-2·P19-3)"
        status: pass
      - kind: unit
        ref: "test/client/hostRail.test.tsx#HostRail — 방장 줄 틀 (19-03, D-13, UI-SPEC A·F-2)"
        status: pass
    human_judgment: false
  - id: D4
    description: "맵 단추 줄 변형(MapChip rail·pressed): 색·표식만 방장 단추, rail 없으면 마크업 그대로(기존 화면 불변)"
    requirement: D-13
    verification:
      - kind: unit
        ref: "test/client/hostRail.test.tsx#MapChip 줄 변형 (19-03, P19-4)"
        status: pass
      - kind: unit
        ref: "test/client/mapChip.test.tsx (기존 시험 그대로 통과)"
        status: pass
    human_judgment: false
  - id: D5
    description: "참가자 칩(ModeChip): button 아님·포커스 없음·aria-label 없음, 글 '판 종류: {이름}'(앞 글은 화면에 안 보이는 텍스트), 아이콘 16"
    requirement: D-07
    verification:
      - kind: unit
        ref: "test/client/hostRail.test.tsx#ModeChip — 참가자 읽기 전용 칩 (19-03, D-07, UI-SPEC C)"
        status: pass
    human_judgment: false
  - id: D6
    description: "새 아이콘 넷(deck·book·modeBasic·modeExtended)이 시안 A 경로 그대로, 문구 한 곳(MODE_ORDER·MODE_TEXT)"
    requirement: D-15
    verification:
      - kind: unit
        ref: "test/client/hostRail.test.tsx#V2Icon 새 아이콘 넷 (19-03, P19-14)"
        status: pass
      - kind: unit
        ref: "test/client/hostRail.test.tsx#판 종류 문구 한 곳 (19-03, UI-SPEC Copywriting)"
        status: pass
    human_judgment: false
  - id: D7
    description: "판 종류 바뀜 알림 문구(modeToastOf): 서버 view 두 개의 차이로만, 방장 본인·첫 스냅샷에는 없음, mode 키 없음은 확장판"
    requirement: D-01
    verification:
      - kind: unit
        ref: "test/unit/roomDiff.test.ts#modeToastOf — 판 종류 바뀜 알림 (19-03, P19-9)"
        status: pass
    human_judgment: false
  - id: D8
    description: "생김새가 채택 시안 A 와 맞는가(금빛 줄·시트 두 칸·참가자 칩의 실제 화면) — 부품만 만들었고 화면에는 19-04·19-05 가 붙인다"
    requirement: D-16
    verification:
      - kind: unit
        ref: "test/client/hostRail.test.tsx#방장 줄·칩 CSS (19-03, UI-SPEC A-1·C-1·Color, T-19-12)"
        status: pass
    human_judgment: true
    rationale: "CSS 값은 문자열 시험으로 고정했지만 화면에 붙기 전이라 실제 생김새를 눈으로 본 적이 없다. 배선(19-04·19-05) 뒤 배포본에서 시안과 비교한다"

duration: 12min
completed: 2026-11-12
---

# Phase 19 Plan 03: 방장 줄·판 종류 선택 부품 Summary

**방장 전용 금빛 원형 단추 줄(HostRail·HostRailButton, 왕관 표식·접기)과 판 종류 두 칸 시트(ModeSheet, 낙관 갱신 없음), 참가자 읽기 전용 칩(ModeChip), 판 종류 바뀜 알림 문구(modeToastOf)를 부품으로 만들었다 — 화면에는 아직 붙이지 않았다.**

## 진행

- **걸린 시간:** 약 12분 (2026-11-12T12:34:24Z ~ 12:46Z)
- **Task:** 3/3
- **바뀐 파일:** 12 (새 파일 6, 고친 파일 6)
- **커밋:** 7 (test 4 + feat 3) — `e33389c7..9923d593`

## 한 일

- `src/game/modeText.ts`: 판 이름·한 줄 설명·접근성 글·알림 글을 한 곳에 뒀다(`MODE_ORDER`·`MODE_TEXT`).
- `V2Icon`: `deck`·`book`·`modeBasic`·`modeExtended` 를 UI-SPEC 표의 경로 그대로 더했다.
- `HostRailButton`: 지름 52 원·테두리 1.5px `--light-lamp`·바탕 `--night-700`. 눌림은 안쪽 2px 금빛 링, 켜진 토글은 금빛 채움 + `--night-900` 아이콘, 사용 불가 0.45, 누름은 `scale(0.94)` 하나뿐(모션 줄이기에서는 끔). 깜빡이지 않는다.
- `ModeSheet`: 제목 "판 종류" + 두 칸. 다른 칸을 누르면 `onPick(mode)` 한 번, 고른 표시는 부모가 준 서버 값에서만 나온다.
- `HostRail`·`hostRailLayout`: F-2 세 갈래(표식 한 열 / 표식 없는 한 열 / `splitSideColumn` 두 열), `testShift` → `data-test-shift`.
- `MapChip`: `rail`·`pressed` 속성. rail 이 없으면 마크업이 예전 그대로다.
- `ModeChip`: 읽기 전용 칩(아이콘 16 + 판 이름, 접근성 글 "판 종류: " 는 `.mf-sr-only` 텍스트).
- `modeToastOf(prev, next)`: 참가자에게만, view 두 개의 판 종류가 다를 때만 "판 종류: {이름}".
- 기존 화면(대기실·결과)은 바꾸지 않았다. 배선은 19-04·19-05.

## Task 커밋

1. **Task 1: 트레이서 — 판 종류 단추·시트** — `9d1b32cf` (test) → `3d7111ea` (feat)
2. **Task 2: 방장 줄 틀·맵 줄 변형·참가자 칩** — `17d98cf6` (test) → `16685402` (test, 실패 값 한 줄로) → `53003733` (feat)
3. **Task 3: 판 종류 바뀜 알림 문구** — `03cf94f2` (test) → `9923d593` (feat)

트레이서 관문: Task 1 뒤 verify 를 다시 돌려 통과(2 files · 63 tests, typecheck 0) — ⚡ Tracer verified end-to-end — expanding.

## RED 증거

기록은 `.gsd/red/19-03-t{1,2,3}.{tap,json}`(gitignore 된 로컬 파일). 셋 다 `gsd-tools check tdd-red-evidence` 가 `RED_EVIDENCE_OK`(target_test_failed)를 냈다.

- **t1** `npx vitest run test/client/hostRail.test.tsx --reporter=tap-flat` → exit 1, 19개 중 not ok 19(전부 AssertionError). 대상: "ModeSheet … 다른 칸을 누르면 onPick 이 고른 값으로 정확히 한 번이고, 표시는 서버 값 그대로다" — 기대 `basic=false,extended=true`, 실제 빈 문자열(자리 부품이 칸을 그리지 않음).
- **t2** 같은 명령 → exit 1, 44개 중 not ok 21(전부 AssertionError), ok 23(Task 1 의 19 + 자리 부품으로도 참인 넷). 대상: "HostRail … 넉넉하면 role=group '방장 전용' 줄 하나에 왕관 표식 + 한 열" — 기대 `[data-host-rail]` 1개, 실제 0개. **첫 기록은 분류기가 `INVALID_RED`(invalid_record, Malformed TAP)로 거절했다** — 한 시험의 실패 값에 줄바꿈이 있었다. 그 값을 한 줄로 접고(`16685402`) 다시 돌린 기록이 통과본이다. 거절된 상태로는 구현을 시작하지 않았다.
- **t3** `npx vitest run test/unit/roomDiff.test.ts --reporter=tap-flat` → exit 1, 21개 중 not ok 4(전부 AssertionError). 대상: "modeToastOf … 참가자는 바뀐 판 이름 한 줄을 받는다: 확장판 → 기본 마피아" — 기대 `판 종류: 기본 마피아`, 실제 `null`. null 이 정답인 시험과 기존 시험 17개는 ok.

의미 판정: 세 번 모두 대상 시험이 실제로 돌았고 계획한 단언에서 실패했다. import·문법·fixture 오류는 없었다.

## 검증 결과

| 명령 | 결과 |
| --- | --- |
| `npx vitest run test/client/hostRail.test.tsx test/client/icon.test.tsx` (Task 1) | 통과 — 2 files · 63 tests |
| `npx vitest run test/client/hostRail.test.tsx test/client/lobby.test.tsx test/client/dressSheet.test.tsx` (Task 2) | 통과 — 3 files · 187 tests |
| `npx vitest run test/unit/roomDiff.test.ts test/client/hostRail.test.tsx` (Task 3) | 통과 — 2 files · 65 tests |
| 위 파일 + `resultScreen`·`mapChip` 묶음(마지막 확인) | 통과 — 7 files · 372 tests |
| `npx vitest run --project unit --project client` (전체 회귀, 계획 밖 추가) | 통과 — 229 files(1 skipped) · 7650 tests(183 skipped), 실패 0 |
| `npm run typecheck` | 통과 (exit 0) |
| 위생 git grep(바뀐 12개 파일) | 결과 없음 |
| 화면 CSS 의 새 hex | 0줄 (`grep -c "#" src/styles/sheet.css` 전 1 → 후 1, v2.css 전 0 → 후 0), 새 토큰 없음 |

돌리지 않은 것: worker 시험 묶음, E2E, 배포(서버 코드·화면 배선이 바뀌지 않았다 — E2E·배포는 19-06·19-08).

Acceptance: `data-mode-card`(ModeSheet) 1 · `modeExtended`(V2Icon) 4 · "증거를 찾아 추리해요"(modeText) 1 · `export function hostRailLayout` 1 · `splitSideColumn`(HostRail) 3 · `data-host-rail-btn`(MapChip) 1 · `mf-hostrail`(v2.css) 7 · `export function modeToastOf` 1.

## 부품 속성 표 (19-04·19-05 가 붙일 때)

| 부품 | 파일 | 속성 | DOM |
| --- | --- | --- | --- |
| `HostRail` | `src/components/v2/HostRail.tsx` | `maxHeight: number`(오른쪽 열과 같은 `sideMaxH`), `testShift?: boolean`, `children`(위 → 아래, null 은 칸 아님) | `div.mf-hostrail[data-host-rail][role=group][aria-label="방장 전용"]` (+ `data-test-shift`) → (표식일 때) `span.mf-hostrail__crown[data-host-rail-crown][role=img]` → `div.mf-hostrail__cols` → `div.mf-hostrail__col` × 열. 자식 0개면 미렌더 |
| `hostRailLayout` | 같은 파일 | `(n, maxH, cell = 52, gap = 12, crown = 20)` → `{ crown: boolean; columns: number[] }` | — |
| `HostRailButton` | `src/components/v2/HostRailButton.tsx` | `id: "mode" \| "bots" \| "tutorial"`, `icon: V2IconName`, `label: string`, `pressed?`, `switchOn?`(주면 role=switch·aria-checked, aria-pressed 없음), `disabled?`, `onPress(el)`, `ref?` | `button.mv-hostrail-btn[data-host-rail-btn={id}]`. `bots` 는 `data-float="bots"`, `tutorial` 은 `data-tutorial-toggle=""` 도 단다 |
| `MapChip` | `src/components/v2/MapChip.tsx` | 기존 `choice`·`host`·`onPress` + `rail?: boolean`, `pressed?: boolean` | rail: `button.mf-mapchip.mv-hostrail-btn[data-map-chip][data-host-rail-btn="map"][aria-pressed]`, `data-side-button` 없음. rail 없음: 예전 그대로 |
| `ModeChip` | `src/components/v2/ModeChip.tsx` | `mode: GameMode`, `testShift?: boolean` | `div.mf-modechip[data-mode-chip={mode}]` (+ `data-test-shift`) → svg 16 · `span.mf-sr-only` "판 종류: " · `span.mf-modechip__name` |
| `ModeSheet` | `src/components/ModeSheet.tsx` | `mode: GameMode`(서버 값), `canSend: boolean`, `onPick(mode)`, `onClose()` | `dialog[aria-label="판 종류"]` → `.mf-sheet.mf-mode-sheet` → `div.mf-mode-sheet__body[data-mode-sheet]` → `h2` · `div.mf-mode-sheet__grid` → `button.mf-mode-card[data-mode-card=basic\|extended][aria-pressed]` × 2 (고른 칸만 `span.mf-mode-card__badge`) |

이름: `MODE_ORDER`·`MODE_TEXT`(`title`·`name`·`desc`·`aria(mode)`·`changed(mode)`·`tutorialOn`·`tutorialOff`·`rail`) — `src/game/modeText.ts`. `modeToastOf(prev, next): string | null` — `src/net/roomDiff.ts`.

## 참고 자료

| 경로 | 가져온 요소 |
| --- | --- |
| `design/v3.0/host-rail/README.md` | 채택안 A 규칙: 왼쪽 세로 줄·원형 단추·왕관 표식·금빛 테두리 1.5px·켜짐은 금빛 채움 + 어두운 아이콘·간격 12·왼쪽 여백 16 |
| `design/v3.0/host-rail/Main.dc.html` | 줄 구조(왕관 → 단추 세로), 테두리·아이콘 `#ffcf8a`(= `--light-lamp`), 바탕 `#1e2847`(= `--night-700`), 켜짐 아이콘 `#0e1326`(= `--night-900`), deck·book 경로 |
| `design/v3.0/host-rail/ModeSheet.dc.html` | 시트 면 `#0e1326` + 위 테두리 `#2a3760`, 두 칸 격자 간격 12, 칸 `#151c36`·테두리 `#2a3760`, 고른 칸 2px `#e6e8ee` + `#1e2847` + 오른쪽 위 V 배지, modeBasic·modeExtended 경로, 문구 |
| `design/v3.0/host-rail/Guest.dc.html` | 참가자 칩: 높이 32 알약·1px `#2a3760`·바탕 `#0e1326`·14px·아이콘 16 + 판 이름 |

열지 못한 참고 자료: 없음. 쓰지 않을 것(열지 않음): `RailLabel.dc.html`·`Drawer.dc.html`(채택하지 않은 B·C).

시안과 다르게 한 곳(모두 UI-SPEC 기본값 기록): 단추 지름 48 → 52(P19-1), 시트 제목·칸 이름 18·17 → 24·16(P19-7), 칸 안 간격 10 → 8, V 배지 26 → 24, 맵 단추 아이콘은 핀 대신 지금 맵 아이콘(P19-4), 칩 아이콘↔글 간격 6 → 8(UI-SPEC C-1), 칩 위 자리 +6 → +8(P19-11). 시트 [닫기]는 시안의 44 원 대신 공용 시트 틀의 닫기 알약 그대로다.

방향 한 줄: 방장 전용은 금빛 테두리 단추로 왼쪽에 모으고, 참가자 공용은 오른쪽에 그대로 두며, 글은 늘리지 않는다.

## 계획과 달라진 점

### 고친 것

**1. [Rule 1 - 버그] RED 시험의 실패 값에 줄바꿈이 있어 TAP 보고가 깨졌다**
- **발견:** Task 2 RED — 분류기가 `INVALID_RED`(invalid_record: Non-TAP data, Malformed TAP)
- **원인:** "시트 층 숨김" 시험이 선택자 목록을 줄바꿈째로 단언해 실패 값이 여러 줄이 됐다
- **고침:** 공백을 접어 한 줄로 만들고 다시 돌려 `RED_EVIDENCE_OK` 를 받은 뒤에 구현했다. 같은 Task 에서 `ruleOf` 도우미도 "줄 머리에서 시작하는 선택자만" 보도록 좁혔다(다른 규칙의 선택자 목록 끝에 붙은 같은 이름과 섞이지 않게) — 이것은 RED 커밋 전에 고쳤다
- **파일:** test/client/hostRail.test.tsx
- **커밋:** `16685402` — 그래서 커밋이 Task 마다 한 쌍(6)이 아니라 7이다

**2. [Rule 1 - 생김새] 시트 면 색**
- **발견:** Task 1 GREEN
- **문제:** UI-SPEC Color 표는 "시트 면 night-900(기존 시트)"라고 적었지만 공용 틀 `.mf-sheet` 의 실제 면은 `--night-800` 이다. 그대로 두면 칸(`--night-800`)이 면과 같은 색이 되어 시안과 달라진다
- **고침:** 이 시트에만 `.mf-sheet.mf-mode-sheet { background: var(--night-900); border-top: 1px solid var(--night-600); }` — 시안 값 그대로. 다른 시트는 건드리지 않았다
- **파일:** src/styles/sheet.css · **커밋:** `3d7111ea`

### 계획에 없던 작은 선택

- 고른 칸의 안쪽 여백을 1px 줄였다(`calc(var(--space-md) - 1px) 11px`) — 테두리 1 → 2px 로 칸 안이 1px 밀리는 것을 막는다.
- `div[data-mode-sheet]` 에 클래스 `mf-mode-sheet__body`(세로, 간격 16)를 줬다 — 제목과 격자 사이 간격을 내려면 감싸는 요소에 규칙이 필요하다.
- 고른 칸의 이름만 `--gray-50`(UI-SPEC B-2 가 허용한 값), V 배지 안 check 선 2.4(UI-SPEC B-2).
- `HostRail` 은 자식이 0개면 `null` 을 그린다(계획은 `hostRailLayout` 의 n ≤ 0 만 정했다).
- `MapChip.tsx` 주석에서 표식 이름을 풀어 썼다 — acceptance 의 `grep -c "data-host-rail-btn"` = 1 을 맞추려고.
- 모션 줄이기 규칙(`.mv-hostrail-btn:active { transform: none }`)은 단추 CSS 와 함께 Task 1 에서 넣었다(시험은 Task 2 에 있다).
- 전체 unit·client 회귀를 Task 마다 한 번씩 더 돌렸다(정적 검사 시험이 새 CSS·문구를 잡는지 보려고).

**합계:** 고친 것 2(둘 다 Rule 1), 작은 선택 7. 범위는 늘지 않았다.

## Threat 처리

| ID | 처리 |
| --- | --- |
| T-19-10 | 부품은 화면 조작뿐이다 — `ModeSheet` 는 `onPick` 만 부르고 표시는 `mode` 속성에서만 나온다. "누른 뒤에도 표시가 서버 값 그대로" 시험으로 고정 |
| T-19-11 | 표식 값 집합을 시험이 단언한다: `data-host-rail-btn` ⊂ {mode, map, bots, tutorial}, `data-mode-card`·`data-mode-chip` ⊂ {basic, extended} |
| T-19-12 | `.is-call` 이 든 규칙에 `mv-hostrail-btn`·`mf-hostrail` 이 없음을 CSS 문자열 시험으로 고정. 줄·칩 규칙에 animation·transition 0 |
| T-19-SC | 패키지 설치 없음 |

새로 생긴 보안 표면: 없음(네트워크·저장·권한 경로를 더하지 않았다).

## Known Stubs

없음 — RED 커밋의 자리 부품(null·빈 값)은 같은 Task 의 feat 커밋에서 모두 채웠다(`grep "19페이즈 자리"` 0줄). 부품이 화면에 아직 쓰이지 않는 것은 이 계획의 범위다(배선은 19-04·19-05).

## 다음 계획이 알아야 할 것

- **19-04(대기실)**: 방장에게 `<HostRail maxHeight={sideMaxH} testShift={테스트 방}>` 안에 순서대로 `HostRailButton id="mode" icon="deck" label={MODE_TEXT.aria(modeOf(view))} pressed={시트 열림}` · `MapChip rail pressed={맵 탭 열림}` · `HostRailButton id="bots" icon="bot" label="봇"` · (확장판만) `HostRailButton id="tutorial" icon="book" label="튜토리얼 먼저" switchOn={값}`. 참가자에게는 `<ModeChip mode={modeOf(view)} testShift={…} />`. 조건부 단추는 `null` 로 넘기면 칸으로 세지 않는다.
- **시트**: `<ModeSheet mode={modeOf(view)} canSend={canSend} onPick={(mode) => send({ t: "modePick", mode })} onClose={…} />`. 시트는 칸을 눌러도 닫히지 않는다. 열 때 입력칸 blur·닫을 때 [판 종류] 단추로 초점 복원은 부르는 쪽 몫이다(`onPress(el)` 이 단추 요소를 준다, `ref` 도 받는다).
- **알림**: `modeToastOf(prevView, nextView)` 가 문자열을 주면 TopToast `show(text)`. 방장·첫 스냅샷은 이미 null 이다. 튜토리얼 토글 알림은 `MODE_TEXT.tutorialOn`·`tutorialOff`.
- **옛 TutorialToggle 과 다른 점**: `HostRailButton` 은 누름 소리 신호(`emitSignal({ kind: "tap" })`)를 내지 않고, 사용 불가는 `disabled` 속성이 아니라 `aria-disabled` 다. 소리를 유지하려면 `onPress` 에서 낸다. E2E·시험이 `toBeDisabled`·`:disabled` 로 보던 곳은 `aria-disabled` 로 바꾼다.
- **선택자 변화**: 봇 단추는 `data-float="bots"` 를 그대로 달지만 클래스가 `.mv-float` → `.mv-hostrail-btn` 이고 `data-side-button="bots"` 가 없다. 줄 변형 맵 단추도 `data-side-button="map"` 이 없다 — 오른쪽 열 판정(E2E `SIDE_MARKERS`·`[data-side-button]`)에서 방장 화면의 맵·봇이 빠진다(19-06 이 판정을 고친다).
- **CSS**: 가상 뷰포트 이동 줄에 줄·칩을 더해야 한다 — lobby.css 41행(`.mf-lobby .mv-side` 가 있는 줄)에 `.mf-lobby .mf-hostrail, .mf-lobby .mf-modechip`, result.css 28행에 `.mf-result .mf-hostrail, .mf-result .mf-modechip`. 시트 층 숨김(`.mf-room:has([data-sheet-layer])`)은 v2.css 에 이미 넣었다. 키보드·꾸미기 시트가 열린 동안 안 그리는 것(P19-16)은 화면이 조건으로 한다.
- `.mf-sr-only` 는 phase.css 에 있다(RoomScreen 이 불러온다) — 방 화면 밖에서 `ModeChip` 을 쓰면 그 CSS 가 필요하다.
- `hostRailLayout` 은 최대 높이가 유한하지 않으면(측정 전) 표식 한 열을 준다. 0 이하 값이 오면 두 칸씩 접힌다 — 측정 전 값이 0 이라면 화면에서 `Infinity` 로 바꿔 넘긴다.
- 시험에서 CSS 규칙을 꺼낼 때는 `test/client/hostRail.test.tsx` 의 `ruleOf`(줄 머리 선택자만) 모양을 쓴다. 실패 값은 한 줄이어야 RED 분류기가 받는다.
- 옛 전역 규칙 상수 이름은 이 계획의 파일 어디에도 없다. push·배포·E2E 는 하지 않았다(19-08).

## Self-Check: PASSED

- 파일: src/game/modeText.ts · src/components/v2/HostRailButton.tsx · src/components/v2/HostRail.tsx · src/components/v2/ModeChip.tsx · src/components/ModeSheet.tsx · test/client/hostRail.test.tsx — 모두 있음
- 커밋: 9d1b32cf · 3d7111ea · 17d98cf6 · 16685402 · 53003733 · 03cf94f2 · 9923d593 — 모두 HEAD 의 조상
- `git rev-list --count e33389c7..HEAD` = 7 (SUMMARY 커밋 전 측정)
