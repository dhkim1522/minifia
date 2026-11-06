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
  - "run.mjs 흐름별 extraSizes(lobby·world 는 6개 크기), 결정 0056 승인 완화 D9-8ch·D3b-8ch·G2-8ch·D2-8ch·P10-8ch(범위 한정)"
  - "e2eContract: LOBBY_SIZES = STAGE_SIZES, map.ts 원문에서 읽은 마스크 = BAR_MASK, graphemeCount = countGraphemes"
affects: [06-18-e2e, 06-19-deploy-e2e, 07-chat-layout, 8~9페이즈 고정 테이블 삭제]

plan_head_before: b858f82e9c46c542e38b7629b61a3fd774204bb6
plan_head_after: d76db88210875dd37e52d14776ada3c2ea84e196

actuals:
  tokens: 21500
  tasks: 2
  commits: 6

tech-stack:
  added: []
  patterns:
    - "캐릭터 위치는 DOM 이 아니라 window.__mfWorld.sample(seat, t) 로만 읽고, 두 페이지는 같은 서버 시각 t(구간 t0 + 받은 뒤 지난 시간)로 비교한다"
    - "E2E 가 TS 를 직접 import 하지 않고 map.ts 원문에서 BAR_MASK 를 정규식으로 읽으며, 계약 테스트가 원문 읽기 = 앱 상수임을 고정한다"
    - "승인 완화는 적용 범위를 데이터(이름표 title 의 그래핌 수·요소가 고정 테이블 이름표 안쪽인지)로 판정하고 통과 행에 적용 내용을 남긴다(relaxed 표시)"

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
    - docs/decisions/0056-v2-nickname8-v1-table-e2e.md

key-decisions:
  - "결정 0056(a) 적용 후 개정(2026-11-01, 사용자 선택 1): 측정 결과 D9·D3b 는 한 번도 실패하지 않았고 G2·D2·P10 이 깨져, 같은 범위(v1.0 고정 테이블 + 6 그래핌 이상 이름)로 G2-8ch·D2-8ch·P10-8ch 를 더했다. 기준 수치 불변, 범위 밖은 그대로 실패, 고정 테이블을 지울 때 함께 지운다"
  - "완화 범위를 요소 단위로 좁혔다: G2 는 .mf-dt__tag 와 안쪽 요소만, D2 는 장면 밖만(패널 겹침은 실패), P10 은 칩-이름표 겹침만(헤더·패널·카드는 실패)"
  - "8명 한 점 모으기는 봇 걸음을 조종할 수 없어 자동화하지 못한다: 사람 둘을 한 점에 모아 겹친 이름표의 앞뒤(NT3)를 판정하고 8명 360 폭 사진을 남긴다(backstop 은 사람이 본다)"

requirements-completed: [MAP-01, MAP-02, MAP-03, MAP-07]

coverage:
  - id: D1
    description: "world 흐름: 두 페이지가 서로의 이름표를 보고, 손님 탭 한 번에 링 100ms·구간 500ms 이내, 같은 서버 시각 t 의 위치 차 0.3 이하(걷는 중 5번·도착 뒤)와 실시간 위치 차 0.3 이하, 도착 뒤 내 이름표·발이 스테이지 안, 링 사라짐 — 6개 폰 크기"
    requirement: MAP-02
    verification:
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 --only world (6개 크기 20/20 씩 통과)"
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
    description: "LOBBY_SIZES = STAGE_SIZES 계약, map.ts 원문 마스크 = BAR_MASK, 결정 0056 승인 완화 다섯 항목의 범위(6 그래핌 이상 이름·고정 테이블 이름표/칩만, 기준 수치 불변)를 범위 안·밖 양쪽에서 고정하는 단위 테스트"
    requirement: MAP-07
    verification:
      - kind: unit
        ref: "test/unit/e2eContract.test.ts, scripts/e2e/lib.test.mjs (197개)"
        status: pass
    human_judgment: false
  - id: D5
    description: "v1.0 게임 흐름(police5·citizen4·mafia8·doctor5·spec4·vote5·noexec·result-c·result-m·pc·wakelock)이 새 로비에서 끝까지 돌고 로컬 초록(결정 0056 개정 범위 안의 완화 행 포함)"
    requirement: MAP-07
    verification:
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 --only <흐름> 열한 개 모두 E2E OK"
        status: pass
    human_judgment: false
  - id: D6
    description: "8명이 한 점에 모였을 때 맨 앞 이름표가 전부 읽힌다(360 폭 스크린샷)"
    requirement: MAP-07
    verification: []
    human_judgment: true
    rationale: "봇은 걸음을 조종할 수 없어 8명을 한 점에 모을 수 없다. 사람 둘이 모인 사진(scripts/e2e/out/world-stack-360x640.png)과 8명 360 폭 사진(lobby-8-360x640.png)을 사람이 본다(backstop)"

duration: 약 55min
completed: 2026-11-01
status: complete
---

# Phase 6 Plan 17: 맵 로비·world E2E Summary

**world·lobby E2E(6개 폰 크기)와 LOBBY_SIZES 계약을 더하고, v1.0 게임 흐름 아홉 개를 새 로비에서 로컬 초록으로 만들었다 — 8자 봇 이름이 고정 테이블 옆자리 이름표를 화면 밖으로 미는 G2·D2·P10 은 사용자가 고른 결정 0056 개정(같은 범위 완화)으로 다뤘다.**

## 결정 0056 개정 (2026-11-01)

처음 측정에서 v1.0 게임 흐름 아홉 개가 완화 범위(D9·D3b) 밖의 G2·D2·P10 으로 실패해 멈췄고, 사용자가 선택지 1(같은 범위로 넓히기)을 골랐다. `docs/decisions/0056-v2-nickname8-v1-table-e2e.md` 의 "개정" 절에 잰 숫자·감수하는 점·지우는 조건을 적었다.

- **잰 숫자:** 양옆 자리 8자 봇 이름표(약 133px)가 360·390 폭에서 왼쪽 10.8~17.7px, 오른쪽 약 15px 화면 밖(430 폭은 5명판 통과·mafia8 1.7px). P10 은 vote5 공개에서 칩-이름표 겹침 94/94 표본.
- **범위:** `G2-8ch`·`D2-8ch`·`P10-8ch`(approved: 결정 0056). v1.0 고정 테이블 이름표(`.mf-dt__tag` 와 안쪽 요소)·칩에 대해서만, 이름이 6 그래핌 이상일 때만. 기준 수치 불변.
  - G2: 그 이름표 요소만. 그 밖의 요소가 화면 밖이면 실패.
  - D2: 장면 밖만. 하단 패널 겹침은 실패.
  - P10: 칩-이름표 겹침만. 헤더·패널·카드 겹침은 실패.
- **감수:** 8~9페이즈에 고정 테이블을 지우기 전까지 v2 시험에서 6자 이상 이름의 양옆 이름표가 최대 약 18px 잘려 보인다. 고정 테이블을 지울 때 다섯 항목(D9·D3b·G2·D2·P10)을 함께 지운다.
- 단위 테스트가 범위 안(완화·표시)과 범위 밖(비이름표 요소 화면 밖, 5자 이름, 이름 모름, 패널·헤더·카드 겹침, 안쪽이면 표시 없음)을 양쪽에서 고정한다.

### 전후 비교 (로컬, 통과/전체)

| 흐름 | 360x640 전→후 | 390x664 전→후 | 430x932 전→후 | 360x560 전→후 | 완화 적용 행(G2·D2·P10, 크기 합) |
|------|------|------|------|------|------|
| mafia8 | 127→140/140 | 127→140/140 | 127→140/140 | 127→140/140 | 28·24·0 |
| police5 | 129→143/143 | 129→143/143 | 143/143 | 129→143/143 | 24·18·0 |
| citizen4 | 122→135/135 | 122→135/135 | 122→135/135 | 122→135/135 | 28·24·0 |
| doctor5 | 126→139/139 | 126→139/139 | 139/139 | 126→139/139 | 21·18·0 |
| spec4 | 45→52/52 | 45→52/52 | 45→52/52 | 45→52/52 | 16·12·0 |
| vote5 | 119→132/132 | 119→132/132 | 131/132→115/115 | 104/115→115/115 | 20·14·4 |
| noexec | 37→41/41 | 37→41/41 | 41/41 | 37→41/41 | 6·6·0 |
| result-c | 38→42/42 | 38→42/42 | 42/42 | 38→42/42 | 9·3·0 |
| result-m | 42→47/47 | 42→47/47 | 42→47/47 | 42→47/47 | 12·8·0 |
| pc (1280x800) | 7/7 → 7/7 | | | | 0 |
| wakelock (360x640) | 2/2 → 2/2 | | | | 0 |

(vote5 의 전체 행 수는 크기·실행마다 다르다 — 430x932·360x560 은 후보 공개 구간 표본 행이 적게 잡혀 115 행이다. 이전 실패는 모두 G2·D2·P10 이었다.) lobby 는 360x640·390x664·430x932·390x844·402x874 에서 34/34, 360x560 에서 33/33(높이 640 미만이라 링크 참가 probe 없음). world 는 6개 크기 모두 20/20. 모든 실행이 `--url http://localhost:5173` 이었고 v1.0 주소는 쓰지 않았다.

## Performance

- **Duration:** 약 55분 (시작 시각을 기록하지 못해 로그로 추정, 재개 포함)
- **Completed:** 2026-11-01T02:30Z 무렵
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- **world 흐름(MAP-01·02·03)**: 두 페이지가 같은 방에서 서로의 이름표를 보고(W0), 손님이 걸을 수 있는 칸 중 두 화면에 모두 보이는 가장 먼 곳을 한 번 탭하면 링 0.4~0.8ms(상한 100ms)·내 구간 도착 8~17ms(상한 500ms), 같은 서버 시각 t 의 두 페이지 위치 차 0.0000, 실시간 위치 차 최대 0.0009 단위(상한 0.3). 도착 뒤 카메라가 따라가 내 이름표·발이 스테이지 안(NT4·W7), 링 사라짐(W8), 방장이 같은 점으로 걸어 두 이름표가 겹쳐도 앞뒤가 정해진다(NT3).
- **lobby 흐름(MAP-07)**: 새 DOM 계약으로 다시 썼다. 6개 폰 크기 통과.
- **내 이름표 폭(열린 항목, 참고 행 NT2)**: 전각 8자 + " (나)" = **160.9px**(NAMETAG_MAX_W 180 안, 말줄임 없음). **이모지 8개 + " (나)" = 202.4px**(6개 크기 모두 같음, 06-12 측정 약 202px 와 일치, 180 보다 22.4px 큼). 이모지 닉네임은 판정에 쓰지 않는 참고 행이다. `src/world/camera.ts` 는 건드리지 않았다 — 사용자 결정 몫이다.
- **크기·계약**: `LOBBY_SIZES`(6개) = `STAGE_SIZES` 를 e2eContract 가 고정, lobby·world 는 `--sizes` 없이 돌면 6개 크기, v1.0 게임 흐름은 DEFAULT_SIZES 4개 그대로.
- **지움**: `lobbyShapeChecks`(L6)·대기실 왕관 W1(expect 1)·`grabLobbyStage("lobby")` 세 곳·readStage 의 로비 선택자와 그 테스트. `crownChecks` 는 게임 중 왕관 0개 검사로만 남겼다.

## Task Commits

1. **Task 1 (tracer): world 흐름·새 로비 흐름·도우미** — `7e311d0` (feat)
2. **Task 2: LOBBY_SIZES·계약 테스트·결정 0056 승인 완화(D9·D3b)** — `ffe5b09` (feat), `b0f2b76` (fix: 8명 사진을 시트 닫은 뒤에)
3. **Task 2 재개: 결정 0056 개정(G2·D2·P10) + 로컬 E2E 전체 초록** — `d76db88` (feat)
4. 중간 멈춤 기록: `688431b`·`5cdc0db` (docs)

**Plan metadata:** 이 SUMMARY 커밋(docs)

## Files Created/Modified

- `scripts/e2e/flows.mjs` — worldFlow, 다시 쓴 lobbyFlow, recD9·P10·G 의 완화 표시, FLOWS extraSizes
- `scripts/e2e/browser.mjs` — ?e2e=1 세션 플래그, 손님 페이지, readWorld·readLobbyFrame·tapWorld·sampleWorld·waitWorldReady, 새 로비 선택자, 이름표·칩 이름·fixedTagName 측정
- `scripts/e2e/lib.mjs` — 새 순수 검사, LOBBY_SIZES, 결정 0056 완화 다섯 항목(범위 한정), 로비 전용 v1 검사 삭제
- `scripts/e2e/lib.test.mjs` — 197개(새 검사·완화 범위 양방향·크기)
- `scripts/e2e/run.mjs` — 흐름별 extraSizes
- `test/unit/e2eContract.test.ts` — 크기·마스크·그래핌 계약
- `docs/decisions/0056-v2-nickname8-v1-table-e2e.md` — 2026-11-01 개정 절
- `src/components/WorldStage.tsx`, `test/client/worldStage.test.tsx` — 접근성 목록 mf-sr-only(편차 1)

## Decisions Made

- 결정 0056 a → 개정(사용자 선택 1)에 따른 범위 한정 완화(위 절). 앱 코드(DayTable)는 고치지 않았다.
- 8명을 한 점에 모으는 backstop 은 봇을 조종할 수 없어 대체했다(편차 2).

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
- **Fix:** 사람 둘(방장·손님)이 같은 점으로 걸어 겹친 이름표의 앞뒤를 판정(NT3)하고, 8명 방의 360 폭 사진을 시트 닫은 뒤 남긴다(`scripts/e2e/out/lobby-8-*.png`, `world-stack-*.png`, gitignore). 8명이 한 점에 모인 장면은 backstop(사람이 확인)으로 남는다
- **Files modified:** scripts/e2e/flows.mjs
- **Committed in:** 7e311d0, b0f2b76

**3. [Rule 4 - 결정] v1.0 게임 흐름이 완화 범위 밖(G2·D2·P10)으로 실패**
- **Found during:** Task 2
- **Issue:** 결정 0056 의 D9·D3b 만으로는 아홉 흐름이 초록이 되지 않았다(D9·D3b 는 실패 0)
- **Fix:** 멈추고 보고 → 사용자가 선택 1 을 골라 결정 0056 을 개정, G2-8ch·D2-8ch·P10-8ch 추가
- **Files modified:** docs/decisions/0056-v2-nickname8-v1-table-e2e.md, scripts/e2e/lib.mjs·browser.mjs·flows.mjs·lib.test.mjs
- **Committed in:** d76db88

---

**Total deviations:** 3 (Rule 1 1건, Rule 3 1건, Rule 4 1건 — 사용자 결정으로 해소)
**Impact on plan:** 성공 기준 2·3 을 브라우저로 고정했다. 8명 한 점 모임(backstop)만 사람 확인이 남는다.

## Issues Encountered

- 이 환경 Node 26 은 TS 를 직접 읽지만 `engines` 는 22.12 이상이라 E2E 가 `shared/game/map.ts` 를 import 하지 않고 원문을 읽는다(계약 테스트가 같음을 고정).
- 단위 프로젝트 전체 1789개 통과·1개 skipped 로 보고되나, 이 계획이 더한 skip·todo 는 없다(`git grep -F -e '.skip(' -e '.todo('` 이 계획 파일 0건, 그 1개는 `test/unit` 에 정적 skip 표기가 없는 기존 동적 건너뜀).

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크 표면·인증 경로 없음(E2E 는 로컬 `localhost:5173` 만, resolveTarget 가드 유지, 토큰은 ctx.secrets 로 가림).

## User Setup Required

없음.

## Next Phase Readiness

- 06-18(재접속·예산)은 이 계획의 도우미(readWorld·tapWorld·waitWorldReady·손님 페이지)를 그대로 쓸 수 있다.
- 06-19 가 배포본에 돌릴 때 6개 폰 크기·결정 0056 완화 표시가 그대로 나온다. 같은 머신 기준 0.3 단위는 실기기 두 대에는 0.5 또는 시계 오프셋 잔차 기록이 필요하다(가정 A2).
- 열린 항목: 이모지 8개 + " (나)" 이름표 202.4px > NAMETAG_MAX_W 180(camera.ts 는 그대로, 사용자 결정). 8~9페이즈에 고정 테이블을 지울 때 완화 다섯 항목을 함께 지운다.

---
*Phase: 06-world-skeleton*
*Completed: 2026-11-01*

## Self-Check: PASSED

- 파일 존재: scripts/e2e/{flows,browser,lib,lib.test,run}.mjs, test/unit/e2eContract.test.ts, docs/decisions/0056-v2-nickname8-v1-table-e2e.md — 확인
- 커밋 존재: 7e311d0·ffe5b09·b0f2b76·d76db88 — 확인
- 수용 기준: Task 1 두 줄 PASS, Task 2 첫 줄(LOBBY_SIZES·STAGE_SIZES·extraSizes) PASS, 둘째 줄(SUMMARY 에 흐름 × 크기 통과 수와 0056 적용 내용) PASS
- 플랜 검증: `node --test scripts/e2e/lib.test.mjs` 197 통과, `npx vitest run test/unit/e2eContract.test.ts` 통과, 로컬 E2E 열세 흐름 E2E OK
