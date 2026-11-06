---
phase: 06-world-skeleton
plan: 18
subsystem: testing
tags: [e2e, playwright-core, reconnect, webgl-context-loss, render-budget, memory, chunk-failure, conn-04]

requires:
  - phase: 06-world-skeleton
    provides: "06-17 E2E 도우미(readWorld·tapWorld·손님 페이지·?e2e=1), 06-13 window.__mfWorld 훅(debug.loseContext/restoreContext/info), 06-14 ?perf=1 결과, 06-10 DRAW_CALL_BUDGET 120, 06-08 서버 이동, 06-15 로비 DOM"
provides:
  - "reconnectFlow(id reconnect): 끊김(오프라인 3초)·화면 껐다 켜기(frozen 5초)·새로 고침·WebGL 소실/복구·소실 후 방치(재생성) 각 10회 — 콘솔 경고·오류·띠 잔류·위치 어긋남·알림 재표시 0건"
  - "deployHoldFlow(id deployhold, skipByDefault): 로컬은 worker/room.ts 파일 시각만 갱신해 배포 직후를 흉내(소켓이 안 끊겨 미확인), 배포본은 1회·최대 6분 기다림(06-19 몫)"
  - "perfBudgetFlow(id perfbudget): 8명 로비·vote 스파이크 draw call ≤ 120·점광원 ≤ 3, 맵 5번 열고 닫기 메모리 원복, 월드 청크 실패 카드와 [다시 시도]"
  - "lib.mjs: reconnectChecks·reconnectSummary·consoleIssues(CONSOLE_ALLOW)·budgetChecks·memoryStableChecks·contextLeakChecks·chunkFailChecks·isWorldChunkUrl·paintedFromStats·isLocalOrigin·selectFlows"
  - "browser.mjs: reconnectInit·consoleCollector·setLifecycle·dropSockets·readLinkState·readPaintStats·openPerfPage·backToLobby·clearToasts, openHostPage preRoute"
  - "src/world/threeRenderer.ts: 잃은 컨텍스트에 forceContextLoss 를 부르지 않음(콘솔 경고 제거)"
affects: [06-19-deploy-e2e, 07-chat-layout]

plan_head_before: 1fd0edc784c5674412253260d288f41bc202bd43
plan_head_after: d95da7f2a168f5367c48835c39d8892c96258e0a

actuals:
  tokens: 18550
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "재접속 시험은 오프라인 전환과 함께 앱의 방 소켓(/api/rooms/…/ws)만 닫아 단절을 만든다 — 헤드리스 Chrome 은 오프라인 전환만으로 열린 소켓을 끊지 않고, vite HMR 소켓을 닫으면 페이지가 새로 불러와진다"
    - "콘솔 허용 목록(CONSOLE_ALLOW)은 항목마다 이유·적용 종류·로컬 한정을 갖고, 앱이 낸 경고·오류는 하나도 올리지 않는다(올린 것은 브라우저 자신의 기록뿐)"
    - "열고 닫기 메모리는 가만히 선 사람(봇 아님)으로 결정적 장면을 만들어 비교한다 — 봇은 걸어 다녀 화면에 든 캐릭터에 따라 geometries 가 29~52 로 달라진다"

key-files:
  created:
    - .planning/phases/06-world-skeleton/deferred-items.md
  modified:
    - scripts/e2e/flows.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/run.mjs
    - test/unit/e2eContract.test.ts
    - src/world/threeRenderer.ts
    - test/unit/ladder.test.ts

key-decisions:
  - "재접속 콘솔 기준 0건은 '앱이 낸 경고·오류 0건'으로 읽고, 브라우저가 스스로 남기는 세 가지(오프라인 중 네트워크 오류, 개발 서버 StrictMode 소켓 경고, v1.0 프리로드 미사용 경고)만 이유와 함께 허용했다 — 그 밖은 모두 실패"
  - "열고 닫기 메모리는 봇 대신 가만히 선 사람 4명으로 잰다(봇 장면은 비결정적) — 판정 기준은 처음 값 이하(증가 0)"
  - "deployhold 로컬 흉내는 worker/room.ts 의 파일 시각을 갱신해도 vite 가 worker 모듈만 핫 업데이트하고 소켓이 끊기지 않아 미확인(가정 A1) — 06-08 퇴거 복원 테스트와 06-19 의 실제 배포 1회로 갈음"

requirements-completed: [MAP-05, CONN-04, MAP-01]

coverage:
  - id: D1
    description: "reconnect 흐름: 끊김·복귀, 화면 껐다 켜기, 새로 고침, WebGL 소실/복구, 소실 후 방치 각 10회 모두 복구하고 콘솔 경고·오류 0, 띠 잔류 0, 두 페이지 위치 어긋남 0, 알림 재표시 0 (끊김은 띠가 매번 뜸, WebGL 두 종류는 첫 프레임이 다시 그려짐)"
    requirement: CONN-04
    verification:
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 --only reconnect (35/35)"
        status: pass
    human_judgment: false
  - id: D2
    description: "복구 뒤 모든 캐릭터가 지금 위치로 이어진다(두 페이지 위치 차 0, 복구 전 대비 0)"
    requirement: MAP-05
    verification:
      - kind: e2e
        ref: "reconnect/{offline,frozen,reload,lose,lose-idle} RC3"
        status: pass
    human_judgment: false
  - id: D3
    description: "배포 직후 재접속(deployhold): 로컬 흉내는 소켓이 끊기지 않아 미확인. 실제 배포 직후 1회는 06-19 가 배포와 동시에 돌린다"
    requirement: CONN-04
    verification:
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 --only deployhold (DH0 미확인 행, E2E OK)"
        status: unknown
    human_judgment: true
    rationale: "로컬 dev 서버는 worker 파일 시각을 갱신해도 소켓을 끊지 않는다(가정 A1). 실제 배포 직후의 띠·위치·콘솔은 06-19 의 배포본 실행으로만 확인된다"
  - id: D4
    description: "렌더 예산: 8명 로비 draw call 33·점광원 3, vote 스파이크 draw call 60·점광원 3 (상한 120/3)"
    requirement: MAP-01
    verification:
      - kind: e2e
        ref: "perfbudget/talk B1·B2, perfbudget/vote B1·B2"
        status: pass
    human_judgment: false
  - id: D5
    description: "맵을 5번 열고 닫아도 geometries·textures 가 처음 값 이하(25/4 → 23/4 ×5)이고 'Too many active WebGL contexts' 경고가 없다"
    requirement: MAP-01
    verification:
      - kind: e2e
        ref: "perfbudget/reopen M1·M2"
        status: pass
    human_judgment: false
  - id: D6
    description: "월드 청크 요청을 막으면 '맵을 불러오지 못했어요' 카드와 [다시 시도]가 뜨고 캔버스가 없으며, 막기를 풀고 [다시 시도] 하면 맵이 열린다"
    requirement: MAP-01
    verification:
      - kind: e2e
        ref: "perfbudget/chunk E1·E1b"
        status: pass
    human_judgment: false
  - id: D7
    description: "로컬 E2E 전체(lobby·world·reconnect·perfbudget·v1.0 게임 흐름 전부, deployhold 제외) 초록"
    requirement: MAP-01
    verification:
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 (E2E OK, 624초, 흐름 × 크기 52개 작업 전부 통과)"
        status: pass
    human_judgment: false
  - id: D8
    description: "소실 후 방치의 재생성에서 three 의 'WEBGL_lose_context extension not supported' 콘솔 경고가 나지 않는다"
    requirement: CONN-04
    verification:
      - kind: unit
        ref: "test/unit/ladder.test.ts#recreate: 이미 잃은 컨텍스트에는 forceContextLoss 를 부르지 않는다, #dispose: 이미 잃은 컨텍스트에는…"
        status: pass
    human_judgment: false
  - id: D9
    description: "맵 소품 일부 재질만 실패하면 단색 재질로 대신해 맵이 열린다(캐릭터 모듈 실패는 맵 실패)"
    verification: []
    human_judgment: true
    rationale: "계획이 backstop 으로 둔 항목이다. 청크 전체 실패(D6)만 자동화했고 일부 재질 실패는 사람이 확인한다"

duration: 41min
completed: 2026-11-01
status: complete
---

# Phase 6 Plan 18: 재접속·렌더 예산 E2E Summary

**오프라인·frozen·새로 고침·WebGL 소실·소실 후 방치를 각 10회 반복해도 콘솔 경고·띠 잔류·위치 어긋남·알림 재표시가 0건임을 고정하고, draw call 예산·맵 5번 열고 닫기 메모리·청크 실패 카드까지 더해 로컬 E2E 전체를 초록으로 만들었다 — 이 과정에서 재생성 때 three 가 남기던 콘솔 경고 하나를 앱 코드에서 고쳤다.**

## Performance

- **Duration:** 41분
- **Started:** 2026-11-01T02:19:54Z
- **Completed:** 2026-11-01T03:01Z 무렵
- **Tasks:** 2
- **Files modified:** 8 (+ deferred-items.md)

## reconnect 종류별 10회 결과 (로컬, 390x664, 방장 + 손님, 손님이 한 번 걸은 뒤)

| 종류 | 복구 | 콘솔 경고·오류 | 띠 잔류 | 위치 차 최대 | 복구 전 대비 최대 | 띠 본 횟수 | 허용 목록 적용 |
|------|------|------|------|------|------|------|------|
| 끊김·복귀(오프라인 3초 + 방 소켓 닫기) | 10/10 | 0 | 0 | 0 | 0 | 10/10 | offline-net 32, preload-unused 170 |
| 화면 껐다 켜기(frozen 5초 → active) | 10/10 | 0 | 0 | 0 | 0 | 0(연결이 살아 있어 띠 없음, 정상) | 없음 |
| 새로 고침 | 10/10 | 0 | 0 | 0 | 0 | 0 | dev-strictmode-socket 10 |
| WebGL 소실 → 1초 → 복구 | 10/10 | 0 | 0 | 0 | 0 | 0 | preload-unused 170 |
| WebGL 소실 후 방치(3초 뒤 재생성) | 10/10 | 0 | 0 | 0 | 0 | 0 | preload-unused 170 |

- 라운드마다 복구 + 2.5초 뒤(앱 `RESTORED_MS` 2초 + 0.5초)에 두 페이지의 `.mf-reconnect` 가 없음, 위치 차는 두 페이지·두 캐릭터(방장·손님) 실시간 표본(상한 0.3), 입장·퇴장 토스트 재표시 0건. WebGL 두 종류는 복구 뒤 캔버스만 찍어 색이 8가지 이상·한 색 90% 미만임을 확인(RESEARCH A9: 같은 씬으로 다시 그려짐).
- 위치 차가 정확히 0 인 것은 둘 다 멈춘 뒤라서다(걷는 중 어긋남은 06-17 world 흐름이 본다). 새로 고침 뒤에도 손님이 서버 위치(걸어간 점)에 서 있음이 복구 전 대비 0 으로 확인된다.
- 허용 목록 적용 수는 판정 값이 아니라 기록이다. 라운드를 줄이거나 대기 시간을 늘려 만든 초록이 아니다(RC5 가 10회를 요구하고 상한 15초는 e2eContract 가 앱 재생성·포기 시각과 맞춰 고정).

## deployhold (배포 직후)

- 로컬 흉내(가정 A1): `worker/room.ts` 의 **파일 시각만** 갱신(`utimesSync`, 내용·`git diff` 그대로, localhost 에서만 — T-06-41). dev 서버 로그에 `(worker) hmr update virtual:cloudflare/worker-entry` 가 찍히지만 소켓은 끊기지 않아 40초 안에 두 페이지 어디에도 재접속 띠가 뜨지 않았다 → **미확인**(DH0 행, 실패 아님). 06-08 의 퇴거 복원 테스트와 06-19 의 실제 배포 1회로 갈음한다.
- 06-19 에서 쓸 때: 배포본 주소에서는 파일을 건드리지 않고 1회만, 띠가 두 페이지에 뜰 때까지 최대 6분 기다린 뒤 같은 `reconnectChecks`(RC1~RC6) 로 본다. `--only deployhold` 로만 돈다(`skipByDefault`).

## 렌더 예산·메모리·청크 실패 (perfbudget, 390x844)

| 항목 | 값 | 상한/기준 |
|------|----|----|
| 8명 로비(방장 + 봇 7, talk) info() | calls 33 · triangles 38,650 · geometries 31 · textures 4 · programs 7 · pointLights 3 | calls ≤ 120, 점광원 ≤ 3 |
| `?perf=1&scene=vote&minutes=0.1&e2e=1` 결과 | calls 60(callsMax 60) · triangles 75,436 · geometries 55 · textures 4 · pointLights 3 | calls ≤ 120, 점광원 ≤ 3 |
| 맵 열고 닫기 5번 | 처음 25/4 → 1~5번째 23/4 · 23/4 · 23/4 · 23/4 · 23/4 (geometries/textures) | 처음 값 이하 |
| 컨텍스트 경고 | 없음 | 'Too many active WebGL contexts' 없음 |
| 청크 실패 | 카드 '맵을 불러오지 못했어요' + [다시 시도] 보임, 캔버스 0개 → 막기 풀고 [다시 시도] 하면 맵 열림 | UI-SPEC E1 error |

- fps 는 헤드리스 소프트웨어 렌더러 환경이라 기록하지 않고 calls·메모리만 판정했다(가정 A2).
- 'Too many active WebGL contexts' 는 Chrome 이 컨텍스트 16개를 넘을 때 내는 경고라 5번 열고 닫기 안에서는 원래 거의 나지 않는다. 컨텍스트가 새는지는 이 경고보다 렌더러 해제 단위 테스트(ladder.test.ts)와 사람이 보는 실기기 확인이 더 직접적이다.

## 로컬 E2E 전체 (deployhold 제외, `--url http://localhost:5173`)

`E2E OK`, 걸린 시간 **624초**(전체 제한 900초 안, 제한은 건드리지 않음). 흐름 × 크기 통과/전체:

| 흐름 | 360x640 | 390x664 | 430x932 | 360x560 | 390x844 | 402x874 | 1280x800 |
|------|------|------|------|------|------|------|------|
| lobby | 34/34 | 34/34 | 34/34 | 33/33 | 34/34 | 34/34 | |
| world | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 | 20/20 | |
| police5 | 143/143 | 143/143 | 143/143 | 143/143 | | | |
| citizen4 | 135/135 | 135/135 | 135/135 | 135/135 | | | |
| mafia8 | 140/140 | 140/140 | 140/140 | 140/140 | | | |
| doctor5 | 139/139 | 139/139 | 139/139 | 139/139 | | | |
| spec4 | 52/52 | 52/52 | 52/52 | 52/52 | | | |
| vote5 | 115/115 | 132/132 | 132/132 | 132/132 | | | |
| noexec | 41/41 | 41/41 | 41/41 | 41/41 | | | |
| result-c | 42/42 | 42/42 | 42/42 | 42/42 | | | |
| result-m | 47/47 | 47/47 | 47/47 | 47/47 | | | |
| pc | | | | | | | 7/7 |
| wakelock | 2/2 | | | | | | |
| reconnect(고정 390x664) | | 35/35 | | | | | |
| perfbudget(고정 390x844) | | | | | 13/13 | | |

- 단위: `node --test scripts/e2e/lib.test.mjs` 218개 통과, 전체 `npx vitest run` 137 파일 3694 통과·1 skipped(06-17 SUMMARY 가 적은 기존 동적 건너뜀 1개, 이 계획이 더한 skip·todo 0건 — `git grep -F -e '.skip(' -e '.todo('` 이 계획 파일 0건), `tsc -p tsconfig.app.json` 오류 없음.
- 앱 결함으로 고친 것은 하나(아래 편차 1). 기준 수치와 반복 횟수는 낮추지 않았다. 완화는 결정 0056 개정 범위(06-17)만 그대로 적용됐고 이 계획에서 더한 완화는 없다.

## Accomplishments

- **reconnect 흐름(CONN-04·MAP-05)**: 다섯 종류 × 10회를 방장·손님 두 페이지로 반복해 복구·콘솔·띠·위치·알림을 판정. 순수 판정 `reconnectChecks` 는 횟수가 모자라거나(라운드 9/10) 복구 못 한 회, 값을 못 읽은 회를 통과시키지 않는다.
- **deployhold 흐름**: 로컬은 파일 시각만 건드려 배포를 흉내(미확인이면 정직하게 기록), 배포본은 파일에 손대지 않고 1회·최대 6분 대기. `skipByDefault` 로 전체 실행에서 빠지고 `--only deployhold` 로만 돈다(`selectFlows`).
- **perfbudget 흐름(성공 기준 4 자동 몫)**: 로비 8명과 vote 스파이크의 draw call·점광원, 5번 열고 닫기 메모리, 청크 실패 카드와 복구.
- **앱 결함 하나 발견·수정**: 소실 후 방치의 재생성이 잃은 컨텍스트에서 `forceContextLoss()` 를 불러 three 가 콘솔 경고를 남기던 것(아래).

## Task Commits

1. **(Task 1 선행 수정) 잃은 WebGL 컨텍스트에 forceContextLoss 안 부름** — `45266ee` (fix)
2. **Task 1: reconnect 5종×10회·deployhold 흐름과 판정 함수** — `74f42f2` (feat)
3. **Task 2: perfbudget 흐름·청크 실패 카드·로컬 전체 초록** — `d95da7f` (feat)

**Plan metadata:** 이 SUMMARY 커밋(docs)

## Files Created/Modified

- `scripts/e2e/flows.mjs` — reconnectFlow·deployHoldFlow·perfBudgetFlow, openPair·collectRound, FLOWS 에 reconnect·deployhold(skipByDefault)·perfbudget
- `scripts/e2e/browser.mjs` — reconnectInit·consoleCollector·setLifecycle·dropSockets·readLinkState·clearToasts·readPaintStats·openPerfPage·backToLobby, openHostPage 의 preRoute
- `scripts/e2e/lib.mjs` — 재접속·예산·메모리·청크·콘솔 허용 목록·selectFlows
- `scripts/e2e/lib.test.mjs` — 218개(새 21개: 통과·실패·경계·허용 범위 양방향)
- `scripts/e2e/run.mjs` — `selectFlows` 로 흐름 고르기
- `test/unit/e2eContract.test.ts` — DRAW_CALL_BUDGET·복구 시각·청크 카드 문구·청크 모듈 이름 사본 계약
- `src/world/threeRenderer.ts`, `test/unit/ladder.test.ts` — releaseGl(잃은 컨텍스트에 forceContextLoss 생략)과 단위 테스트
- `.planning/phases/06-world-skeleton/deferred-items.md` — 프리로드 경고(범위 밖 발견)

## Decisions Made

- 콘솔 0건은 앱이 낸 경고·오류 0건이다. 허용한 세 가지는 모두 브라우저 자신의 기록이고 이유를 코드에 적었으며, 종류·로컬 한정으로 좁혀 단위 테스트가 허용 안 되는 쪽도 고정한다.
- 열고 닫기 메모리 판정 기준은 "처음 값 이하"이고, 장면은 가만히 선 사람 4명으로 결정적으로 만든다(편차 3).
- deployhold 로컬 미확인은 실패가 아니라 기록으로 남긴다(가정 A1). 06-19 의 실제 배포가 이 항목의 진짜 확인이다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 소실 후 방치의 재생성이 three 콘솔 경고를 남김**
- **Found during:** Task 1 (reconnect/lose 첫 실행, 라운드 1)
- **Issue:** `recreate()` 가 이미 잃은 컨텍스트에 three 의 `forceContextLoss()` 를 불러 `THREE.WebGLRenderer: WEBGL_lose_context extension not supported.` 경고(three 의 warnOnce)가 페이지당 한 번 남았다. CONN-04 기준(재접속 중 경고 0건)에 어긋남.
- **Fix:** `releaseGl()` — `dispose()` 뒤 컨텍스트가 이미 잃어졌으면 `forceContextLoss()` 를 부르지 않는다(잃은 컨텍스트는 놓을 것이 없음). 잃지 않은 컨텍스트는 그대로 부른다. 단위 테스트 2개(recreate·dispose, 잃음/안 잃음 양쪽)를 먼저 빨갛게 만든 뒤 고쳤다.
- **Files modified:** src/world/threeRenderer.ts (06-10 의 파일), test/unit/ladder.test.ts
- **Verification:** ladder·cameraThree 31개 통과, E2E reconnect/lose RC1 통과
- **Committed in:** 45266ee

**2. [Rule 3 - Blocking] 오프라인 전환만으로는 열린 소켓이 끊기지 않음**
- **Found during:** Task 1 (프로브: 3초 오프라인 뒤에도 띠가 한 번도 안 뜸)
- **Issue:** 계획의 "setOffline(true) 3초 → false(띠 reconnecting → restored → 사라짐)" 는 헤드리스 Chrome 에서 이미 열린 WebSocket 을 끊지 않아 재접속 경로를 타지 않는다. 첫 구현은 모든 소켓을 닫았다가 vite HMR 소켓까지 닫아 개발 서버가 페이지를 새로 불러왔다(띠 본 횟수 0, 위양성).
- **Fix:** init 스크립트 `reconnectInit` 이 `WebSocket` 을 감싸 소켓 목록을 모으고, `dropSockets` 가 앱의 방 소켓(`/api/rooms/…`)만 오프라인 전환 직후 닫는다(앱 코드는 바뀌지 않음). 오프라인 종류는 띠가 10번 모두 떠야 통과(RC6).
- **Files modified:** scripts/e2e/browser.mjs, scripts/e2e/flows.mjs, scripts/e2e/lib.mjs
- **Verification:** reconnect/offline 띠 본 횟수 10/10, RC1~RC6 통과
- **Committed in:** 74f42f2

**3. [Rule 3 - Blocking] 봇 장면은 열 때마다 geometries 가 달라 '늘었는지'를 못 가름**
- **Found during:** Task 2 (첫 실행 M1: 1번째 52 > 처음 31)
- **Issue:** 봇은 서버 배회로 걸어 다녀, 화면에 든 캐릭터·동작에 따라 업로드된 geometries 가 같은 세션에서 29·33·41·52 로 달랐다(프로브). "첫 번째와 같다"는 계획 문장을 봇 장면에서는 판정할 수 없다. 또 새 렌더러의 info 는 0 에서 시작하므로 이전 렌더러의 누수를 직접 보지도 못한다.
- **Fix:** 열고 닫기 구간은 봇을 모두 내리고 가만히 선 사람 손님 3명(방장 포함 4명 = 시작 최소 인원)으로 돈다. 장면이 결정적이라 25/4 → 23/4 ×5 로 재현됐고 기준은 "처음 값 이하"다. 8명 봇 로비는 예산(calls·점광원) 판정에만 쓴다.
- **Files modified:** scripts/e2e/flows.mjs
- **Verification:** perfbudget/reopen M1 통과, 프로브에서 사람 4명 6번 연속 23/4
- **Committed in:** d95da7f

**4. [계획 해석 보정] "기존 허용 목록 그대로"인데 경고용 허용 목록이 없었음**
- **Found during:** Task 1
- **Issue:** 계획은 콘솔 수집이 기존 허용 목록을 쓴다고 했지만 기존 E2E 는 콘솔 오류만 보고 허용 목록이 없었다. 경고까지 보니 앱과 무관한 브라우저 기록이 잡혔다.
- **Fix:** `CONSOLE_ALLOW` 세 항목(이유·종류·로컬 한정 명시, 단위 테스트가 허용 안 되는 쪽도 고정): 오프라인 중 `ERR_INTERNET_DISCONNECTED`(offline 종류만), 개발 서버 StrictMode 의 "closed before the connection is established"(reload 종류·localhost 만), v1.0 프리로드 미사용 경고 17개 묶음(범위 밖, deferred-items.md). 그 밖의 경고·오류는 모두 실패다.
- **Files modified:** scripts/e2e/lib.mjs, scripts/e2e/lib.test.mjs
- **Committed in:** 74f42f2

---

**Total deviations:** 4 (Rule 1 1건, Rule 3 2건, 계획 해석 보정 1건)
**Impact on plan:** 반복 횟수·대기 시간·기준 수치는 그대로이고 앱 결함 하나(경고)를 코드로 고쳤다. 메모리 장면만 결정적으로 바꿨다.

## Issues Encountered

- 프리로드 경고 17개 묶음이 로비에서 라운드마다 반복된다(offline·lose·lose-idle 종류에서 10회 × 17 = 170건, frozen·reload 종류에서는 적게 잡힘). 원인 추정과 후보 처리는 `deferred-items.md` 에 적었고 이 계획에서는 고치지 않았다(v1.0 프리로드 설계 판단이 필요).
- `attempt()` 에 `waitForFunction`/`waitForSelector`(핸들을 돌려줌)를 그대로 넘기면 `ok` 가 undefined 로 실패로 읽혀 한 번 위음성이 났다 — `async` 로 감싸 핸들을 버리도록 고쳤다.
- dev 서버를 이 계획 시작 때 띄워 마지막에 내렸다(5173 비어 있음 확인). 배포·`npm run deploy`·v1.0 주소 접속은 없다. `worker/room.ts` 는 파일 시각만 바뀌었고 `git diff` 는 깨끗하다.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크 표면·인증 경로 없음(E2E 는 localhost:5173 만, 토큰은 ctx.secrets 로 가림). T-06-41: 파일 시각 갱신은 `isLocalOrigin` 일 때만, 내용은 건드리지 않음.

## User Setup Required

없음.

## Next Phase Readiness

- 06-19 는 같은 흐름을 배포본에 돌린다: `reconnect`·`perfbudget` 는 전체 실행에 포함되고, `deployhold` 는 배포와 동시에 `--only deployhold` 로 돌려 실제 배포 직후의 띠·위치·콘솔을 확인한다(로컬 미확인 항목의 진짜 확인). 배포본에서는 `dev-strictmode-socket` 허용이 꺼지고(localhost 한정) 개발 서버와 달리 StrictMode 경고가 없는지도 함께 드러난다.
- 전체 실행은 624초로 제한(900초)의 70% 다. 흐름이 더 늘면 `OVERALL_LIMIT_MS` 를 올려야 할 수 있다(기준 수치가 아니라 중단 한도).
- 열린 항목: 프리로드 경고(deferred-items.md), 부분 재질 실패의 단색 대체(D9, 사람 확인).

---
*Phase: 06-world-skeleton*
*Completed: 2026-11-01*

## Self-Check: PASSED

- 파일 존재: scripts/e2e/{flows,browser,lib,lib.test,run}.mjs, test/unit/{e2eContract,ladder}.test.ts, src/world/threeRenderer.ts, deferred-items.md — 확인
- 커밋 존재: 45266ee·74f42f2·d95da7f — 확인
- 수용 기준: Task 1 첫 줄(reconnectFlow·deployHoldFlow·reconnectChecks) PASS, Task 2 첫 줄(perfBudgetFlow·budgetChecks·memoryStableChecks) PASS, SUMMARY 항목(종류별 10회 표·deployhold 미확인과 이유·info() 수치·5번 열고 닫기 표·전체 결과) 포함
- 플랜 검증: `node --test scripts/e2e/lib.test.mjs` 218 통과, 로컬 E2E 전체 `E2E OK`(624초), deployhold 단독 `E2E OK`(DH0 미확인)
