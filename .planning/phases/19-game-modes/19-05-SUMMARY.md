---
phase: 19-game-modes
plan: "05"
subsystem: ui
tags: [game-mode, host-rail, result-screen, mode-sheet, mode-chip, toast, keyboard, tdd]
status: complete

requires:
  - phase: 19-01 (판 종류 서버)
    provides: view.mode·modeOf, 메시지 modePick(ended 단계의 방장만 받는다)
  - phase: 19-03 (방장 줄 부품)
    provides: HostRail·HostRailButton·MapChip rail·ModeSheet·ModeChip·MODE_TEXT·modeToastOf
  - phase: 19-04 (대기실 배선)
    provides: 배선 모양(초점 복원·알림 순서·방장 교체 시 시트 닫기)의 본보기
provides:
  - "결과 화면 방장 줄(data-host-rail): 연출이 끝난 뒤 [판 종류]·[맵], 오른쪽 열은 방장도 소리·옷장"
  - "결과 화면 판 종류 시트 배선: [판 종류] → ModeSheet → send({ t: 'modePick', mode }), 표시는 view.mode"
  - "결과 화면 참가자 읽기 전용 칩(data-mode-chip)과 판 종류 바뀜 알림 한 줄"
  - "줄·칩 숨김 조건: 연출 중·전체 기록 늘림·꾸미기 시트·키보드"
  - "result.css 가상 뷰포트 이동 줄에 .mf-hostrail·.mf-modechip"
affects: [19-06, 19-08]

actuals:
  tokens: 9673
  tasks: 2
  commits: 4

plan_head_before: 78274aaa93ec89d0a8ed85d412db9067ff6022c7
plan_head_after: 980780d8b78ec67b0c53e03fa065c3a783ef4ac5
commits: 4

tech-stack:
  added: []
  patterns:
    - "결과 화면의 방장 전용 조작도 서버 view 의 isHost 로만 그린다 — 참가자 화면에는 줄 마크업이 없고 방장이 바뀌면 다음 view 에서 칩 ↔ 줄이 바뀐다"
    - "화면 조작으로 닿지 않는 상태(기록 늘림)는 진짜 부품을 감싸 받은 props 를 쥐는 얇은 가짜로 시험한다 — DOM 은 달라지지 않는다"
    - "과거 시각으로 돌린 가짜 시계에서는 가짜 rAF 의 다음 프레임까지가 16~32ms 로 달라진다 — 키보드 시험은 다시 읽기(100ms)까지 넘긴다"

key-files:
  created: []
  modified:
    - src/screens/ResultScreen.tsx
    - src/styles/result.css
    - test/client/resultScreen.test.tsx

key-decisions:
  - "결과 화면 방장 줄의 [맵] 단추도 연결이 끊기면 aria-disabled 다(MapChip host={canSend}) — 대기실 줄과 같은 규칙. 예전 오른쪽 열의 맵 단추는 끊겨도 눌렸다"
  - "판 종류 바뀜 알림은 연출 중(5600 전)에도 참가자에게 뜬다 — 칩은 연출이 끝난 뒤에 바뀐 값으로 나온다"
  - "방장을 넘겨주면 결과 화면에서도 열려 있던 판 종류 시트를 닫는다"

requirements-completed: [D-05, D-06, D-07, D-13, D-14]

coverage:
  - id: D1
    description: "결과 화면 방장: 연출이 끝난 뒤(5600) 왼쪽 줄 하나에 [판 종류]·[맵](허용 맵 둘 이상), [봇]·[튜토리얼 먼저] 없음. 오른쪽 열은 [옷장] 하나(첫 칸은 소리 자리), 연결이 끊기면 줄 단추 전부 aria-disabled"
    requirement: D-13
    verification:
      - kind: unit
        ref: "test/client/resultScreen.test.tsx#결과 화면 방장 줄과 판 종류 (19-05, D-06·D-13)"
        status: pass
      - kind: unit
        ref: "test/client/resultScreen.test.tsx#결과 단계 지도 칩과 맵 탭 (11-13, D-20·O-11)"
        status: pass
    human_judgment: false
  - id: D2
    description: "[판 종류] → 입력칸 blur → 시트, 칸을 누르면 modePick 한 번(canSend 일 때만), 표시는 서버 view.mode 로만 바뀌고 닫으면 초점이 [판 종류]로 돌아온다. [다시 하기]·[시작] 알약의 마크업·자리와 준비 수는 그대로"
    requirement: D-06
    verification:
      - kind: unit
        ref: "test/client/resultScreen.test.tsx#[판 종류] → 시트가 열리고 확장판이 골라져 있다. [기본 마피아]를 누르면 modePick 이 한 번 가고 표시는 서버 값이 올 때까지 그대로다 (D-05·D-06)"
        status: pass
      - kind: unit
        ref: "test/client/resultScreen.test.tsx#판 종류가 바뀌어도 방장 [시작] 알약의 마크업·자리(패널 안)와 준비 수는 그대로다 (D-06, P19-13)"
        status: pass
    human_judgment: false
  - id: D3
    description: "결과 화면 참가자: 방장 줄 미렌더, 연출 뒤 읽기 전용 칩 하나, 판 종류가 바뀌면 알림 한 줄(방장 본인·처음·재연결 직후는 없음, 방장 변경이 먼저), 방장 교체 시 칩 ↔ 줄"
    requirement: D-07
    verification:
      - kind: unit
        ref: "test/client/resultScreen.test.tsx#참가자: 방장 줄 마크업이 없고(미렌더) 읽기 전용 칩 하나 '판 종류: 확장판' (T-19-16)"
        status: pass
      - kind: unit
        ref: "test/client/resultScreen.test.tsx#알림이 없는 때: 방장 본인 · 처음 그릴 때(기본 마피아 방) · 재연결 직후(epoch)"
        status: pass
    human_judgment: false
  - id: D4
    description: "줄·칩 숨김: 연출이 끝나기 전·전체 기록이 늘어난 동안·꾸미기 시트·키보드가 열린 동안 미렌더, 닫히면 다시 그린다. result.css 가상 뷰포트 이동 줄에 줄·칩"
    requirement: D-13
    verification:
      - kind: unit
        ref: "test/client/resultScreen.test.tsx#방장: 키보드가 열리면(data-kb-open) 줄이 없고 닫히면 다시 있다"
        status: pass
      - kind: unit
        ref: "test/client/resultScreen.test.tsx#result.css: 가상 뷰포트 이동 줄(--mf-vv-top)에 방장 줄·판 종류 칩이 오른쪽 열과 함께 묶여 있다"
        status: pass
    human_judgment: false
  - id: D5
    description: "실제 결과 화면에서 방장 줄·칩이 시안 A 와 맞고 폰 6종에서 머리 단추·제목·아래 패널·오른쪽 열과 겹치지 않는가"
    requirement: D-14
    verification: []
    human_judgment: true
    rationale: "이 계획에서는 앱을 띄워 보지 않았다(시험 환경은 레이아웃이 없다). 겹침은 19-06 의 E2E 가, 생김새는 배포본에서 시안과 눈으로 비교한다"

duration: 약 12분
completed: 2026-11-13
---

# Phase 19 Plan 05: 결과 화면 방장 줄 배선 Summary

**결과 화면의 방장 조작을 대기실과 같은 왼쪽 줄로 옮겼다 — 연출이 끝나면 방장은 [판 종류]·[맵] 줄에서 다음 판 종류를 골라 modePick 을 보내고, 참가자는 읽기 전용 칩과 알림 한 줄로 다음 판 종류를 안다.**

## 진행

- **걸린 시간:** 약 12분 (2026-11-12T14:52Z ~ 15:04Z)
- **Task:** 2/2
- **바뀐 파일:** 3 (모두 고친 파일)
- **커밋:** 4 (test 2 + feat 2) — `78274aaa..980780d8`

## 한 일

- `ResultScreen`: 연출이 끝나면(5600, `finished`) 방장에게 `HostRail` 을 그린다 — 위에서부터 [판 종류](`deck`, 이름 "판 종류: {지금 값}") · [맵](`MapChip rail`, 허용 맵 둘 이상). [봇]·[튜토리얼 먼저]는 없다. 오른쪽 열(`SideColumn`)은 방장도 소리 자리 + [옷장]뿐이다(맵 단추가 열에서 줄로 옮겨 갔다).
- [판 종류]를 누르면 입력칸 포커스를 풀고 `ModeSheet` 를 연다. 칸을 누르면 `canSend` 일 때 `{ t: "modePick", mode }` 한 번. 고른 표시·단추 이름은 서버 `view.mode` 로만 바뀐다. 닫으면 초점이 [판 종류]로 돌아온다. [다시 하기]·[시작] 알약은 건드리지 않았다.
- 참가자에게는 줄 마크업이 없고 `ModeChip` 하나가 있다. 판 종류가 바뀐 view 가 오면 TopToast "판 종류: {이름}" — 방장 변경 알림이 같은 view 에 있으면 그쪽이 먼저다. 방장 본인·처음 그릴 때·재연결 직후에는 없다.
- 줄·칩은 연출이 끝나기 전, 전체 기록이 늘어난 동안(`expanded`), 꾸미기 시트·키보드가 열린 동안에는 그리지 않는다.
- `result.css` 의 가상 뷰포트 이동 줄에 `.mf-result .mf-hostrail, .mf-result .mf-modechip` 을 더했다.

## Task 커밋

1. **Task 1: 트레이서 — 결과 화면 방장 줄·판 종류 시트·참가자 칩·알림** — `ec20bdbf` (test) → `6f2ea9e1` (feat)
2. **Task 2: 줄·칩 숨김 조건과 화면 이동** — `b165014e` (test) → `980780d8` (feat)

트레이서 관문: Task 1 커밋 뒤 verify 를 다시 돌려 통과(2 files · 175 tests, typecheck 0) — ⚡ Tracer verified end-to-end — expanding.

## RED 증거

기록은 `.gsd/red/19-05-t{1,2}.{tap,json,verdict.json}`(gitignore 된 로컬 파일). 둘 다 `gsd-tools check tdd-red-evidence` 가 `RED_EVIDENCE_OK`(target_test_failed)를 냈다.

- **t1** `npx vitest run test/client/resultScreen.test.tsx --reporter=tap-flat` → exit 1, 131개 중 not ok 17(전부 AssertionError), ok 114. 대상: "방장(최종 상태): 왼쪽 줄 하나에 위에서부터 [판 종류]·[맵]뿐이고 …" — 기대 `[data-host-rail]` 1개, 실제 0개.
- **t2** 같은 명령 → exit 1, 138개 중 not ok 7(전부 AssertionError), ok 131. 대상: "방장: 키보드가 열리면(data-kb-open) 줄이 없고 닫히면 다시 있다" — 기대 줄·칩 수 `0,0`, 실제 `1,0`. **첫 실행에서는 이 시험이 준비 단계(`data-kb-open` 이 안 켜짐)에서 실패했다** — 아래 "계획과 달라진 점" 2번. 넘기는 시간을 고친 뒤 다시 돌린 기록이 통과본이고, 그 전 상태로는 구현을 시작하지 않았다.

의미 판정: 두 번 모두 대상 시험이 실제로 돌았고 계획한 단언에서 실패했다. import·문법·fixture 오류는 없었다(RED 상태에서 typecheck exit 0).

## 검증 결과

| 명령 | 결과 |
| --- | --- |
| `npx vitest run test/client/resultScreen.test.tsx test/client/hostRail.test.tsx && npm run typecheck` (Task 1) | 통과 — 2 files · 175 tests, typecheck exit 0 |
| `npx vitest run test/client/resultScreen.test.tsx && npm run typecheck && grep -c "mf-hostrail" src/styles/result.css` (Task 2) | 통과 — 1 file · 138 tests, typecheck exit 0, grep 2 |
| `npx vitest run test/unit/e2eContract.test.ts` (이월 메모: 오른쪽 열 표식 값 계약) | 통과 — 1 file · 88 tests(기대값을 고칠 필요가 없었다, 아래 "그 밖") |
| `npx vitest run --project unit --project client` (전체 회귀) | 통과 — 229 files(1 skipped) · 7695 tests(183 skipped), 실패 0 |
| 위생 git grep(바뀐 세 파일) | 결과 없음 |

돌리지 않은 것: worker 시험 묶음, `node --test scripts/e2e/lib.test.mjs`(E2E 사본을 고치지 않았다), E2E, 배포. 앱을 브라우저에 띄워 보지도 않았다. **E2E 는 지금 상태로 돌리면 아래 "19-06 에 넘기는 E2E 판정" 1번에서 실패할 것으로 본다(돌려서 확인하지는 않았다).**

Acceptance:
- Task 1: `grep -c "modePick"` 1 · `grep -c "<MapChip"` 1(그 줄에 `rail` 있음). `grep -c "<HostRail"` 는 **1 이 아니라 2** 다(아래 "계획과 달라진 점" 3번) — `grep -c "<HostRail "` 는 1.
- Task 2: `grep -c "mf-hostrail" src/styles/result.css` 2(규칙 줄 1 + 주석 줄 1, 기준선 0) · `grep -c "kbOpen" src/screens/ResultScreen.tsx` 전 4 → 후 5.

## 바뀐 표식·선택자 (결과 화면)

| 무엇 | 전 | 후 |
| --- | --- | --- |
| 맵 단추 | 오른쪽 열 `.mf-mapchip[data-map-chip][data-side-button="map"]`(끊겨도 눌림) | 방장 줄 `.mf-mapchip.mv-hostrail-btn[data-map-chip][data-host-rail-btn="map"]`, `data-side-button` 없음, 연결이 끊기면 `aria-disabled` |
| 방장 오른쪽 열 | 소리 자리 · map · dress | 소리 자리 · dress (참가자와 같다) |
| 판 종류 | 없음 | 방장 `[data-host-rail] [data-host-rail-btn="mode"]` → `[data-mode-sheet]`·`[data-mode-card]`, 참가자 `[data-mode-chip={mode}]` |
| 나오는 때 | 열: `finished && !expanded && !dressOpen` | 열: 그대로. 줄·칩: `finished && !expanded && !dressOpen && !kbOpen` |
| 테스트 방 | — | 결과 화면의 줄·칩에는 `data-test-shift` 가 없다([테스트] 단추가 없다) |

## 참고 자료

| 경로 | 가져온 요소 |
| --- | --- |
| `design/v3.0/host-rail/README.md` | 규칙: 결과 화면의 방장 조작(판 종류·맵)도 같은 왼쪽 줄, 오른쪽 열은 [소리]·[옷장]만 |

열지 않은 참고 자료: `Guest.dc.html` — 칩의 생김새는 19-03 이 이 시안에서 이미 부품(`ModeChip`)으로 옮겼고, 이 계획은 그 부품을 조건에 맞춰 놓는 배선이라 README 의 규칙과 19-03·19-04 SUMMARY 로 충분했다. 실제 화면을 시안과 눈으로 비교하지는 않았다(coverage D5).

방향 한 줄: 방장 전용은 금빛 테두리 단추로 왼쪽에 모으고, 참가자 공용은 오른쪽에 그대로 두며, 글은 늘리지 않는다.

## 계획과 달라진 점

### 고친 것

**1. [Rule 3 - 막힘] 기록 늘림(expanded)은 화면 조작으로 만들 수 없어 시험이 `ResultPanel` 을 감싼다**
- **발견:** Task 2 RED 준비
- **문제:** 계획은 "765~800행의 expanded 를 만드는 방법"을 쓰라고 했지만, 18.1 뒤로 결과 화면은 탭 행이 없어(`RESULT_TABS_SHOWN` 이 전체 하나) 화면을 눌러서는 `expanded` 에 닿지 않는다. 그 구간의 시험은 오히려 "늘 `data-expanded=false`"를 단언한다
- **고침:** 시험 파일에서 진짜 `ResultPanel` 을 그대로 그리되 받은 props 를 쥐는 감싸개를 `vi.mock` 으로 두고, 숨김 시험 둘만 `onTab("mafia")` 를 직접 불러 늘린 뒤 무대 탭으로 접는다. DOM 은 달라지지 않아 기존 시험 131개는 그대로 통과한다. 앱 코드는 이 때문에 바꾸지 않았다
- **뜻:** 실제 사용에서는 지금 `expanded` 조건이 켜질 일이 없다 — 탭을 되살릴 때를 위한 조건이다(오른쪽 열의 같은 조건과 짝)
- **파일:** test/client/resultScreen.test.tsx · **커밋:** `b165014e`

**2. [Rule 1 - 시험 버그] 키보드 시험이 실행마다 결과가 달랐다**
- **발견:** Task 2 RED 첫 실행 — 방장 키보드 시험이 계획한 단언이 아니라 `data-kb-open` 준비에서 실패했고, 따로 돌리면 참가자 시험도 같이 실패했다
- **원인:** 이 시험 파일은 가짜 시계를 과거 시각(`NOW`)으로 돌린다. 그러면 가짜 `requestAnimationFrame` 의 다음 프레임까지가 16ms 고정이 아니라 16~32ms 사이로 실행마다 달라져, 대기실 시험에서 쓰는 20ms 로는 높이를 못 읽을 때가 있다
- **고침:** 키보드 높이를 바꾼 뒤 120ms 를 넘긴다(훅의 100ms 다시 읽기까지). 네 번 따로 돌려 같은 결과를 확인한 뒤 RED 기록을 다시 떠서 분류기에 넣었다
- **파일:** test/client/resultScreen.test.tsx · **커밋:** `b165014e`

**3. Acceptance `grep -c "<HostRail" src/screens/ResultScreen.tsx` = 1 은 글자 그대로는 맞출 수 없다**
- `<HostRailButton` 줄도 같은 글자로 시작해 결과가 2 다(19-04 와 같은 일). 의도(줄 틀이 한 번 쓰인다)는 `grep -c "<HostRail "` = 1 로 확인했다. 코드를 그 숫자에 맞추려고 바꾸지는 않았다

**4. Task 1 은 그리기 조건을 `finished`·`isHost` 까지만 넣고 나머지(`expanded`·`dressOpen`·`kbOpen`)는 Task 2 에서 넣었다**
- 계획의 context 는 조건 전체를 한 줄로 적었지만 Task 2 의 action 이 "빠진 항을 맞춘다"이고 acceptance 가 `kbOpen` 증가를 Task 2 에서 센다. Task 2 의 RED 가 진짜로 실패하도록 나눴다. `6f2ea9e1` 한 커밋에서는 꾸미기 시트·키보드 동안 줄·칩이 DOM 에 남는다(시트가 열리면 CSS 로는 숨는다)

### 계획에 없던 작은 선택

- [맵] 줄 단추에 `host={canSend}` 를 줬다 — 대기실 줄과 같은 규칙. 예전에는 연결이 끊겨도 결과 화면의 맵 단추가 눌렸다.
- 방장을 넘겨주면 열려 있던 판 종류 시트를 닫는 효과를 넣었다(대기실과 같다).
- 판 종류 알림은 연출 중에도 띄운다 — 계획은 칩이 나오는 때만 정했다. 알림 효과는 원래 `finished` 와 무관하게 방장 변경을 알리던 곳이라 같은 규칙을 따랐다.
- 결과 화면에는 재접속 띠 값(`bannerVisible`)이 내려오지 않아 "띠가 떠 있는 동안은 알림을 띄우지 않는다"는 대기실 규칙은 넣지 않았다(방장 변경 알림도 원래 그렇다).
- 기존 시험 이름 둘의 '손님'을 '참가자'로 바꿨다(고친 describe 안의 것만).
- 계획에 없는 시험을 더했다: 허용 맵 하나뿐인 줄, 연출 중 알림, 방장 변경과 겹친 알림 순서, 방장 교체 시 칩 ↔ 줄·시트 닫힘, 연결 끊김.
- SUMMARY 는 Task 2 의 feat 커밋에 넣지 않고 따로 커밋했다 — `commits`·`plan_head_after` 를 잰 값으로 적으려고(19-04 와 같다).

**합계:** 고친 것 4(Rule 1 하나, Rule 3 하나, acceptance 문구 하나, Task 나눔 하나), 작은 선택 7. 범위는 늘지 않았다.

## Threat 처리

| ID | 처리 |
| --- | --- |
| T-19-16 | 줄·시트는 `view.me.isHost` 일 때만 렌더한다. 시험이 참가자 DOM 에 `[data-host-rail], [data-host-rail-btn], [data-map-chip]` 0개와 시트 0개, 방장 교체 시 칩 ↔ 줄을 단언한다. 방장·단계 판정은 서버 몫 그대로다(19-01) |
| T-19-17 | accept 그대로 — 칩은 공개 값인 판 종류만 보인다 |
| T-19-SC | 저장소에 패키지를 설치하지 않았다(`package.json`·lock 변화 없음). 다만 확인 삼아 `npx eslint` 를 한 번 돌렸는데 이 저장소에는 ESLint 가 없어 npx 가 임시 사본(10.14.0)을 받아 실행했고 설정 파일이 없다는 오류로 끝났다 — 저장소 파일은 바뀌지 않았다 |

새로 생긴 보안 표면: 없음(새 메시지·저장·권한 경로를 더하지 않았다. `modePick` 은 19-01 이 만든 메시지다).

## Known Stubs

없음.

## 다음 계획이 알아야 할 것

### 19-06 에 넘기는 E2E 판정

이 계획은 E2E 를 돌리지 않았고 아래를 고치지 않았다(19-04 SUMMARY 의 목록에 더하는 결과 화면 몫이다).

1. **`mapselect.mjs` 371행 — 결과 화면 열 판정.** `sideColumnChecks({ screen: "result", host: isHost, mapsOn: true, botsOn: false, expectHead: 1 })` 가 방장 열에 맵을 기대한다(SC3 "방장은 맵 …"). 이제 결과 화면 방장도 오른쪽 열이 소리·옷장 둘이다. 위 주석("방장 소리·맵·옷장")도 같이 고친다.
2. **`mapselect.mjs` 144~153행·MS14 — 결과 화면 맵 단추 자리.** `[data-map-chip]` 선택자와 이름(`맵 광장`)은 그대로 잡히지만 단추가 왼쪽 줄(왼쪽 16)에 있고 클래스에 `.mv-hostrail-btn` 이 붙었으며 `data-side-button` 이 없다. 자리(오른쪽 열 안)·열 순서를 재는 판정이 있으면 줄 기준으로 바꾼다. 373행의 "칩을 눌러 맵 탭 열기"는 그대로 통할 것이다.
3. **줄·칩이 나오는 때.** `data-result-stage="final"`(5600) 뒤, 그리고 `expanded`·꾸미기 시트·키보드가 아닐 때만 DOM 에 있다. 시트가 열리면 오른쪽 열과 함께 사라지므로 시트를 열기 전에 읽는다. 판 종류 시트가 열린 동안에는 줄이 DOM 에 남고 CSS(`visibility: hidden`)로만 숨는다.
4. **새 겹침 판정 대상(mode-rail 폰 6종).** 방장: 줄(왕관 표식 + 두 칸, 허용 맵이 하나면 한 칸) vs 머리 [나가기]·제목·아래 패널·오른쪽 열·TopToast. 참가자: 칩(높이 32, 왼쪽 16, 위 = 머리 아래 + 20) vs 같은 것들. 결과 화면 줄은 `data-test-shift` 가 없다.
5. **결과 화면에서 modePick 을 보내는 흐름.** [판 종류] → `[data-mode-card="basic"]` → 참가자 칩 `[data-mode-chip="basic"]`·알림 "판 종류: 기본 마피아" → [다시 하기]로 시작한 다음 판이 기본 마피아인지(서버 유지는 19-01).
6. 줄 단추의 사용 불가는 `aria-disabled` 다(`disabled` 속성 아님).

### 그 밖

- **`MapChip` 의 줄 아닌 변형은 이제 어느 화면도 쓰지 않는다**(대기실·결과 둘 다 `rail`). 부품 안의 `data-side-button="map"` 가지는 남아 있어 `test/unit/e2eContract.test.ts` 의 표식 값 계약(`dress,map,sound`)은 고치지 않고 통과한다. 이 가지를 지우면 src 의 값이 `dress,sound` 가 되어 그 시험의 기대와 E2E 사본 `SIDE_ORDER` 를 같이 고쳐야 한다(19-06·19-08 판단).
- `docs/screen-map.md` 의 결과 화면 영역(오른쪽 열에 맵)도 19-08 이 고친다.
- `resultScreen.test.tsx` 에서 키보드를 여는 시험은 describe 안의 `withKeyboard` 도우미를 쓴다(120ms 넘김). 20ms 로 줄이면 실행마다 결과가 달라진다.
- 옛 전역 규칙 상수 이름·지운 부품 이름은 이 계획의 파일 어디에도 없다. push·배포는 하지 않았다(19-08).

## Self-Check: PASSED

- 파일: src/screens/ResultScreen.tsx · src/styles/result.css · test/client/resultScreen.test.tsx — 모두 있음
- 커밋: ec20bdbf · 6f2ea9e1 · b165014e · 980780d8 — 모두 HEAD 의 조상
- `git rev-list --count 78274aaa..HEAD` = 4 (SUMMARY 커밋 전 측정)
