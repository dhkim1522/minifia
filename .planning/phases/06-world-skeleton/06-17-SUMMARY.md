---
phase: 06-world-skeleton
plan: 17
subsystem: testing
tags: [e2e, playwright-core, world-map, lobby, name-tag, approved-relaxations, decision-0056]

requires:
  - phase: 06-world-skeleton
    provides: "06-13 window.__mfWorld 훅·WorldStage, 06-15·06-16 맵 로비 DOM 계약, 06-21 로비 알림, 06-14 성능 스파이크, 06-08 서버 이동, 06-06 결정 0056"
provides:
  - "worldFlow(id world): 방장·손님 두 페이지가 서로의 이름표를 보고, 손님 탭 한 번이 같은 서버 시각 t 의 sample 로 0.3 단위 이내로 걷는 중·도착 뒤 일치"
  - "다시 쓴 lobbyFlow: 헤더 [나가기]·[공유] 44px(L7), [시작] 흐림/활성/점 8(L8), [테스트] 자리(L1·L2·L11), 방 코드는 공유 시트 안에서만(L10), 8자 이름표(NT1), H1·UX1·UX2"
  - "lib.mjs: worldSyncChecks·nameTagFitChecks·tagStackChecks·ownTagInStageChecks·lobbyHeaderChecks·lobbyStartChecks·parseBarMask·walkableCenters·pickTapTargets·LOBBY_SIZES·LOBBY_EXTRA_SIZES"
  - "browser.mjs: ?e2e=1 세션 플래그, 손님 페이지(joinTestRoom·openHostPage guest), readWorld·readLobbyFrame·tapWorld·sampleWorld·waitWorldReady"
  - "run.mjs 흐름별 extraSizes(lobby·world 는 6개 크기), 결정 0056 승인 완화 D9-8ch·D3b-8ch(범위 한정)"
  - "e2eContract: LOBBY_SIZES = STAGE_SIZES, map.ts 원문에서 읽은 마스크 = BAR_MASK, graphemeCount = countGraphemes"
affects: [06-18-e2e, 06-19-deploy-e2e, 07-chat-layout, 8~9페이즈 고정 테이블 삭제]

plan_head_before: b858f82e9c46c542e38b7629b61a3fd774204bb6
plan_head_after: b0f2b76d0f738f2c607bb2eac56587d074f5a845

actuals:
  tokens: 18500
  tasks: 1
  commits: 3

tech-stack:
  added: []
  patterns:
    - "캐릭터 위치는 DOM 이 아니라 window.__mfWorld.sample(seat, t) 로만 읽고, 두 페이지는 같은 서버 시각 t(구간 t0 + 받은 뒤 지난 시간)로 비교한다"
    - "E2E 가 TS 를 직접 import 하지 않고 map.ts 원문에서 BAR_MASK 를 정규식으로 읽으며, 계약 테스트가 원문 읽기 = 앱 상수임을 고정한다"
    - "승인 완화는 적용 범위를 데이터(이름표 title 의 그래핌 수)로 판정하고 통과 행에 적용 내용을 남긴다(relaxed 표시)"

key-files:
  created: []
  modified:
    - scripts/e2e/flows.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/run.mjs
    - test/unit/e2eContract.test.ts
    - src/components/WorldStage.tsx
    - test/client/worldStage.test.tsx

key-decisions:
  - "결정 0056(a) 적용: APPROVED_RELAXATIONS 에 D9-8ch·D3b-8ch(approved: 결정 0056)를 6 그래핌 이상 이름이 낀 이름표만 통과시키는 범위로 추가. 기준 수치 불변. 범위 밖(5자끼리, 이름 모름, 6자 미만 이름표 미달)은 그대로 실패"
  - "범위를 넘는 실패(G2·D2·P10)가 측정되어 완화 목록을 늘리지 않고 멈췄다 — 결정 0056 이 '범위를 넘으면 다시 사용자에게 묻는다' 고 정함"
  - "8명 한 점 모으기는 봇 걸음을 조종할 수 없어 자동화하지 못한다: 사람 둘을 한 점에 모아 겹친 이름표의 앞뒤(NT3)를 판정하고 8명 360 폭 사진을 남긴다(backstop 은 사람이 본다)"

requirements-completed: []

coverage:
  - id: D1
    description: "world 흐름: 두 페이지가 서로의 이름표를 보고, 손님 탭 한 번에 링 100ms·구간 500ms 이내, 같은 서버 시각 t 의 위치 차 0.3 이하(걷는 중 5번·도착 뒤)와 실시간 위치 차 0.3 이하, 도착 뒤 내 이름표·발이 스테이지 안, 링 사라짐 — 6개 폰 크기"
    requirement: MAP-02
    verification:
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 --only world (6개 크기 19/19 씩 통과)"
        status: pass
    human_judgment: false
  - id: D2
    description: "lobby 흐름: 헤더 [나가기]·[공유] 44px·겹침 없음, [시작] 1~3명 흐림·4명 이상 활성·8명 점 8개, [테스트] 자리, 방 코드는 공유 시트 안, 8자 이름표 말줄임 없음, G·H·UX1·UX2 — 6개 폰 크기"
    requirement: MAP-07
    verification:
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 --only lobby (360x640·390x664·430x932·390x844·402x874 34/34, 360x560 33/33)"
        status: pass
    human_judgment: false
  - id: D3
    description: "카메라가 따라가 이동 뒤에도 내 이름표·발이 스테이지 사각형 안(NT4·W7), 한 점에 모인 이름표는 z-index 가 달라 앞뒤가 하나(NT3)"
    requirement: MAP-03
    verification:
      - kind: e2e
        ref: "world/arrived NT4·W7, world/stack NT3 (6개 크기)"
        status: pass
    human_judgment: false
  - id: D4
    description: "LOBBY_SIZES = STAGE_SIZES 계약, map.ts 원문 마스크 = BAR_MASK, 결정 0056 승인 완화 항목과 범위(6 그래핌 이상 이름만, 기준 수치 불변) 단위 테스트"
    requirement: MAP-07
    verification:
      - kind: unit
        ref: "test/unit/e2eContract.test.ts, scripts/e2e/lib.test.mjs (194개)"
        status: pass
    human_judgment: false
  - id: D5
    description: "v1.0 게임 흐름(police5·citizen4·mafia8·doctor5·spec4·vote5·noexec·result-c·result-m)이 새 로비에서 끝까지 돌고 로컬 초록"
    requirement: MAP-07
    verification:
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 --only <흐름> — pc·wakelock 만 통과, 아홉 흐름은 G2·D2(·P10) 실패"
        status: fail
    human_judgment: true
    rationale: "실패가 결정 0056 완화 범위(D9·D3b) 밖이다. 완화 목록을 늘리거나 DayTable 을 고치는 것은 사용자 결정 사안이다"
  - id: D6
    description: "8명이 한 점에 모였을 때 맨 앞 이름표가 전부 읽힌다(360 폭 스크린샷)"
    requirement: MAP-07
    verification: []
    human_judgment: true
    rationale: "봇은 걸음을 조종할 수 없어 8명을 한 점에 모을 수 없다. 사람 둘이 모인 사진(scripts/e2e/out/world-stack-360x640.png)과 8명 360 폭 사진(lobby-8-360x640.png)을 사람이 본다(backstop)"

duration: 약 35min
completed: 2026-11-01
status: halted
---

# Phase 6 Plan 17: 맵 로비·world E2E Summary

**world·lobby E2E 와 계약 테스트는 6개 폰 크기에서 초록이지만, v1.0 게임 흐름은 8자 봇 이름이 고정 테이블 옆자리 이름표를 화면 밖으로 밀어(G2·D2·P10) 결정 0056 완화 범위(D9·D3b)를 넘는 실패가 측정되어 멈췄다.**

## 멈춘 이유 (사용자 결정 필요)

오케스트레이터 지시("범위 밖 실패가 남으면 멈추고 보고, 완화 목록을 넓히지 않는다")와 결정 0056("잰 실패가 D9·D3b 를 넘으면 다시 사용자에게 묻는다")에 따라 Task 2 의 마지막 단계(v1.0 게임 흐름 로컬 초록)에서 멈췄다. 완화 항목 D9-8ch·D3b-8ch 는 넣었지만 **측정에서 D9·D3b 는 한 번도 실패하지 않았다(완화 미사용)**. 실제로 깨진 것은 완화 목록에 없는 검사다.

### 측정한 실패 목록 (로컬, 흐름 × 크기, 4개 기본 크기)

| 흐름 | 인원 | 360x640 | 390x664 | 430x932 | 360x560 | 깨진 검사 |
|------|------|---------|---------|---------|---------|-----------|
| mafia8 | 8 | 127/140 | 127/140 | 127/140 | 127/140 | G2, D2 |
| police5 | 5 | 129/143 | 129/143 | 143/143 | 129/143 | G2, D2 |
| doctor5 | 5 | 126/139 | 126/139 | 139/139 | 126/139 | G2, D2 |
| vote5 | 5 | 119/132 | 119/132 | 131/132 | 104/115 | G2, D2, P10(전 크기) |
| citizen4 | 4 | 122/135 | 122/135 | 122/135 | 122/135 | G2, D2 |
| spec4 | 4 | 45/52 | 45/52 | 45/52 | 45/52 | G2, D2 |
| noexec | 5 | 37/41 | 37/41 | 41/41 | 37/41 | G2, D2 |
| result-c | 5 | 38/42 | 38/42 | 42/42 | 38/42 | G2, D2 |
| result-m | 5 | 42/47 | 42/47 | 42/47 | 42/47 | G2, D2 |
| pc | - | 7/7 (1280x800) | | | | 없음 |
| wakelock | - | 2/2 | | | | 없음 |

- **G2 "화면 밖"·D2 "이름표가 장면 안·패널 밖"**: 4~8명판 모두에서 양옆 자리의 8자 봇 이름표(`.mf-dt__tag`)가 화면 가로 밖으로 나간다. 360·390 폭에서 왼쪽 17.2~17.7px(4명판·8명판)·10.8px(5명판), 오른쪽 15.3px 안팎, 430 폭은 5명판 통과·8명판 1.7px. 이름 5자인 방장 이름표는 멀쩡하고 8자 봇 이름표(약 133px)만 문제다.
- **P10(vote5 reveal)**: 칩(자리 1)이 이름표(자리 2)와 겹친다(4개 크기 모두, 94/94 표본). 더 넓은 이름표 때문이다.
- **D9·D3b**: 모든 흐름·크기에서 통과(완화 적용 행 0개).

### 선택지 (결정 0056 후속)

1. 완화 목록에 G2·D2(와 P10)를 같은 범위("v1.0 고정 테이블 화면 + 6 그래핌 이상 이름")로 추가 — 8~9페이즈에 테이블과 함께 지운다. 가장 작은 변경이지만 실게임 8자 이름이 5~8명판에서 화면 밖으로 17px 나가는 것을 E2E 가 못 잡는 위험이 D9·D3b 보다 커진다.
2. 결정 0056 의 b: v1.0 `DayTable`·`daytable.css` 에서 이름표를 두 줄로(또는 옆자리 이름표만 안쪽으로) 고쳐 기준을 유지한다. 8~9페이즈에 지울 코드를 고치는 비용이 든다.
3. 결정 0056 의 c: v1.0 게임 흐름용 봇 이름만 5자로 되돌린다(앱 코드 수정 없이 해결되지만 `shared/game/bots.ts`·`scripts/bots.mjs` 한 목록이라 8자 최악 폭 시험이 게임 흐름에서 빠진다).

## Performance

- **Duration:** 약 35분 (시작 시각을 기록하지 못해 로그로 추정)
- **Completed:** 2026-11-01T01:06Z 무렵
- **Tasks:** 1 완료(트레이서) + 1 부분(Task 2: 코드·테스트·결정 적용 완료, v1.0 게임 흐름 초록은 멈춤)
- **Files modified:** 8

## Accomplishments

- **world 흐름(MAP-01·02·03)**: 두 페이지가 같은 방에서 서로의 이름표를 보고(W0), 손님이 걸을 수 있는 칸 중 두 화면에 모두 보이는 가장 먼 곳을 한 번 탭하면 링 0.4~0.8ms(상한 100ms)·내 구간 도착 8~17ms(상한 500ms), 같은 서버 시각 t 의 두 페이지 위치 차 0.0000, 실시간 위치 차 최대 0.0009 단위(상한 0.3)다(6개 크기 모두 19/19). 도착 뒤 카메라가 따라가 내 이름표·발이 스테이지 안(NT4·W7), 링 사라짐(W8), 방장이 같은 점으로 걸어가 두 이름표가 겹쳐도 앞뒤가 정해진다(NT3).
- **lobby 흐름(MAP-07)**: 새 DOM 계약으로 다시 썼다. 6개 크기 모두 통과(360x560 은 링크 참가 probe 가 높이 640 미만이라 33개, 나머지 34개).
- **내 이름표 폭 측정(열린 항목)**: 전각 8자 + " (나)" = **160.9px**(NAMETAG_MAX_W 180 안, 말줄임 없음). 이모지 8개 + " (나)" = **202.4px**(6개 크기 모두 같음, 06-12 측정 약 202px 와 일치, NAMETAG_MAX_W 180 보다 22.4px 큼). 이모지 8개 닉네임은 판정에 쓰지 않고 참고 행(NT2)으로만 남겼다. `src/world/camera.ts` 는 건드리지 않았다 — 사용자 결정 몫이다.
- **크기·계약**: `LOBBY_SIZES`(6개) = `STAGE_SIZES`를 e2eContract 가 고정, lobby·world 는 `--sizes` 없이 돌면 6개 크기, v1.0 게임 흐름은 DEFAULT_SIZES 4개 그대로.
- **지움**: `lobbyShapeChecks`(L6)·대기실 왕관 W1(expect 1)·`grabLobbyStage("lobby")` 세 곳·readStage 의 로비 선택자와 그 테스트. `crownChecks` 는 게임 중 왕관 0개 검사로만 남겼다.

## Task Commits

1. **Task 1 (tracer): world 흐름·새 로비 흐름·도우미** — `7e311d0` (feat)
2. **Task 2: LOBBY_SIZES·계약 테스트·결정 0056 승인 완화** — `ffe5b09` (feat), `b0f2b76` (fix: 8명 사진을 시트 닫은 뒤에)

**Plan metadata:** 이 SUMMARY 커밋(docs)

## Files Created/Modified

- `scripts/e2e/flows.mjs` — worldFlow, 다시 쓴 lobbyFlow, recD9(완화 표시 포함), FLOWS extraSizes
- `scripts/e2e/browser.mjs` — ?e2e=1 세션 플래그, 손님 페이지, readWorld·readLobbyFrame·tapWorld·sampleWorld·waitWorldReady, 새 로비 선택자
- `scripts/e2e/lib.mjs` — 새 순수 검사, LOBBY_SIZES, 결정 0056 완화(범위 한정), 로비 전용 v1 검사 삭제
- `scripts/e2e/lib.test.mjs` — 194개(새 검사·완화 범위·크기), 지운 검사의 테스트 삭제
- `scripts/e2e/run.mjs` — 흐름별 extraSizes
- `test/unit/e2eContract.test.ts` — 크기·마스크·그래핌 계약
- `src/components/WorldStage.tsx`, `test/client/worldStage.test.tsx` — 접근성 목록 mf-sr-only(아래 편차 1)

## Decisions Made

- 결정 0056 a 를 그대로 적용하되 범위를 데이터로 판정한다: 이름표 `title` 의 그래핌 수 ≥ 6 인 이름표가 낀 D9 겹침·D3b 미달만 통과(+표시). 이름을 모르는 이름표, 6자 미만끼리의 겹침은 실패 그대로. 단위 테스트가 목록·범위·바닥 수치 불변을 고정한다.
- 8명을 한 점에 모으는 backstop 은 봇을 조종할 수 없어 대체했다(편차 2).
- 멈춤: 범위 밖 실패이므로 완화 목록·기준 수치를 건드리지 않았다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WorldStage 접근성 목록이 E2E G2 에 "화면 밖"으로 잡힘**
- **Found during:** Task 1 (world 흐름 첫 실행)
- **Issue:** `.mf-world__sr`(1px, margin −1px)이 화면 왼쪽 −1px 로 나가 G2 가 실패. `.mf-sr-only` 와 같은 CSS 인데 E2E 허용 선택자에 없었다(06-13 의 파일)
- **Fix:** ul 에 `mf-sr-only` 클래스를 함께 줌(허용 목록은 늘리지 않음), client 테스트 1개 추가
- **Files modified:** src/components/WorldStage.tsx, test/client/worldStage.test.tsx
- **Verification:** worldStage 65개 통과, world·lobby G 통과
- **Committed in:** 7e311d0

**2. [Rule 3 - Blocking] 봇 7명을 한 점에 모으는 스크린샷을 만들 수 없음**
- **Found during:** Task 1 (lobby 흐름)
- **Issue:** 계획은 봇 7명을 한 점 근처로 모은다고 했지만 봇의 걸음은 서버 배회로만 움직여 E2E 가 조종할 수 없다
- **Fix:** 사람 둘(방장·손님)이 같은 점으로 걸어 겹친 이름표의 앞뒤를 판정(NT3)하고, 8명 방의 360 폭 사진을 시트 닫은 뒤 남긴다(`scripts/e2e/out/lobby-8-*.png`, `world-stack-*.png`). 8명이 한 점에 모인 장면은 backstop(사람이 확인)으로 남는다
- **Files modified:** scripts/e2e/flows.mjs
- **Committed in:** 7e311d0, b0f2b76

**3. [Rule 4 - 결정 필요] v1.0 게임 흐름이 완화 범위 밖(G2·D2·P10)으로 실패**
- **Found during:** Task 2
- **Issue:** 위 "멈춘 이유" 참조. 앱 결함을 코드로 고치는 길(DayTable 수정)은 결정 0056 3항이 막고, 완화 확대는 지시가 막는다
- **Fix:** 없음(멈춤, 사용자 결정 대기)

---

**Total deviations:** 3 (Rule 1 1건, Rule 3 1건, Rule 4 1건)
**Impact on plan:** world·lobby·계약은 완료, v1.0 게임 흐름 초록(성공 기준 3)은 결정 후 재실행으로 닫는다.

## Issues Encountered

- 이 환경 Node 26 은 TS 를 직접 읽지만 `engines` 는 22.12 이상이라 E2E 가 `shared/game/map.ts` 를 import 하지 않고 원문을 읽는다(계약 테스트가 같음을 고정).
- 단위 프로젝트 전체 1789개 통과·1개 skipped 로 보고되나, 이 계획이 더한 skip·todo 는 없다(`git grep -F -e '.skip(' -e '.todo('` 에서 이 계획 파일 0건, 그 1개는 `test/unit` 에 정적 skip 표기가 없는 기존 동적 건너뜀).

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크 표면·인증 경로 없음(E2E 는 로컬 `localhost:5173` 만, resolveTarget 가드 유지, 토큰은 ctx.secrets 로 가림).

## User Setup Required

없음.

## Next Phase Readiness

- 06-18(재접속·예산)은 이 계획의 도우미(readWorld·tapWorld·waitWorldReady·손님 페이지)를 그대로 쓸 수 있다.
- **막힘**: v1.0 게임 흐름 초록은 위 선택지 1~3 중 사용자 결정 뒤 재실행해야 06-19(배포본 E2E)가 의미가 있다. 결정 뒤 해야 할 일: 선택에 맞춰 APPROVED_RELAXATIONS(+테스트)·DayTable·봇 이름 중 하나를 고치고 `npm run dev` 로컬에서 아홉 흐름을 `--only` 로 다시 돌린다.
- 열린 항목: 이모지 8개 + " (나)" 이름표 202.4px > NAMETAG_MAX_W 180 (이 E2E 의 world 흐름은 전각 8자 손님이라 스테이지 안 판정을 통과한다. camera.ts 는 그대로).

---
*Phase: 06-world-skeleton*
*Completed: 2026-11-01 (halted at v1.0 game flows)*

## Self-Check: PASSED

- 파일 존재: scripts/e2e/{flows,browser,lib,lib.test,run}.mjs, test/unit/e2eContract.test.ts — 확인
- 커밋 존재: 7e311d0·ffe5b09·b0f2b76 — 확인
- 수용 기준: Task 1 두 줄 PASS, Task 2 첫 줄(LOBBY_SIZES·STAGE_SIZES·extraSizes) PASS, Task 2 둘째 줄(SUMMARY 에 흐름 × 크기 통과 수와 0056 적용 내용) PASS
- 미달(자기 점검 실패가 아니라 계획 미완): v1.0 게임 흐름 로컬 초록 — 위 "멈춘 이유"
