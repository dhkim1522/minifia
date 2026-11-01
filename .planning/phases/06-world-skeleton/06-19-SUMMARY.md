---
phase: 06-world-skeleton
plan: 19
subsystem: testing
tags: [deploy, perf, cpu-throttle, fast-4g, iphone, render-gate, cloudflare-workers, deployhold]

requires:
  - phase: 06-world-skeleton
    provides: "06-14 ?perf=1 스파이크·perf-run, 06-17 world E2E, 06-18 reconnect·perfbudget E2E·deployhold 흐름, 06-21 room-enter·map-interactive 마크, 06-13 window.__mfWorld 훅"
provides:
  - "minifia-v2 배포(커밋 350b7fb, Version ID 86304aab-7b07-458d-bbe1-79627d5c3452) — 페이즈 6 결과물이 배포본에서 검증됨"
  - "scripts/perf-run.mjs --mode interactive: 제품 로비 경로(방 만들기 → room-enter → map-interactive → 탭 → 링·출발) Fast 4G·CPU 4× 3회 중앙값"
  - "06-PERF-RESULTS.md: 조건 B 4행·반응·조건 A(iPhone 16 Pro)·배포 직후 재접속·판정 a"
  - "렌더 성능 게이트 판정: a (통과, 사다리 0단계 + 자동 강등 1~3) — 사용자 선택"
affects: [06-20-decision-record, 07-chat-layout, 09-team-test]

plan_head_before: 25894697bbafa48d325069e7cdae18d5aba592e1
plan_head_after: 4efcea155a0384ef26aceb131cbe033c077c88b2

actuals:
  tokens: 9000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "제품 경로 반응 측정: 새 컨텍스트(캐시 없음) + CDP Network.emulateNetworkConditions(Fast 4G) + Emulation.setCPUThrottlingRate, 세션 저장소에 테스트 훅 플래그를 미리 써서 방 입장 뒤에도 훅 유지"
    - "배포 전 맵이 없는 빌드에는 원 deployhold 흐름이 성립하지 않으므로 같은 소켓 관찰을 축소 탐침으로 갈음하고 미확인으로 정직하게 기록"

key-files:
  created:
    - .planning/phases/06-world-skeleton/06-PERF-RESULTS.md
    - .planning/phases/06-world-skeleton/perf/desktop-talk-dpr2-x4.json
    - .planning/phases/06-world-skeleton/perf/desktop-vote-dpr2-x4.json
    - .planning/phases/06-world-skeleton/perf/desktop-talk-dpr1.5-x4.json
    - .planning/phases/06-world-skeleton/perf/interactive-dpr2-x4.json
    - .planning/phases/06-world-skeleton/perf/deployhold-oldclient.json
    - .planning/phases/06-world-skeleton/perf/iphone-1-vote5.json
  modified:
    - scripts/perf-run.mjs
    - .planning/phases/06-world-skeleton/perf/desktop-vote-dpr1.5-x4.json

key-decisions:
  - "렌더 성능 게이트 판정 a: 지금 예산(사다리 0단계, 자동 강등 1~3)으로 확정 — 사용자 선택, 조건 B 4행 통과 + 조건 A vote 5분 59.98fps·열감 차갑다 (결정 기록 번호·상수 반영은 06-20)"
  - "Fast 4G 프리셋은 DevTools NetworkManager.ts Fast4GConditions(9Mbps×0.9, 1.5Mbps×0.9, 165ms)로 고정하고 값·출처를 결과와 JSON 에 남김"
  - "deployhold 는 통과·실패가 아닌 미확인: 하이버네이션 DO 라 실제 배포가 소켓을 끊지 않음, 맵 로비 위치 이어짐은 열린 항목"

requirements-completed: [DEPLOY-02, MAP-01, MAP-02, MAP-03, MAP-05, CONN-04]

coverage:
  - id: D1
    description: "페이즈 결과물이 가드 체인(npm run deploy)으로 minifia-v2 에 1회 배포되고 health·smoke --prod·world E2E 가 배포본에서 통과한다"
    requirement: DEPLOY-02
    verification:
      - kind: e2e
        ref: "curl /api/health (…+350b7fb) · node scripts/smoke.mjs --prod · npm run e2e -- --only world --sizes 390x664 (20/20)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Chrome CPU 4× 에서 talk·vote 5분(DPR 2)과 DPR 1.5 1분 4행이 모두 평균 ≥55fps·끊김 ≤5·draw call ≤120·점광원 3"
    requirement: MAP-01
    verification:
      - kind: other
        ref: "node scripts/perf-run.mjs (perf/desktop-{talk,vote}-dpr{2,1.5}-x4.json): 60.00/60.00/60.00/59.99fps, 끊김 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Fast 4G·CPU 4× 제품 로비 경로 처음 방문 반응: 입장 → 조작 760ms(≤3s), 탭 → 링 2.1ms(≤100ms), 탭 → 출발 66ms(≤500ms) 중앙값"
    requirement: MAP-02
    verification:
      - kind: other
        ref: "node scripts/perf-run.mjs --mode interactive --throttle 4 --runs 3 (perf/interactive-dpr2-x4.json, 3/3 성공)"
        status: pass
    human_judgment: false
  - id: D4
    description: "iPhone 16 Pro(iOS용 Chrome) vote 5분: 59.98fps·끊김 1·rAF 60Hz·열 저하 없음·열감 차갑다. talk 1분·WebGL 복구·LTE 3초·두 기기 로비·8명 읽힘·채팅 확인표는 미확인(이월)"
    requirement: MAP-01
    verification: []
    human_judgment: true
    rationale: "실기기 측정은 사람만 할 수 있고 사용자가 항목 1·2 만 측정했다. 미확인 항목은 06-18·06-17·Fast 4G 자동 결과로 갈음했고 실기기 확인은 9페이즈 팀 테스트, 채팅 확인표는 7페이즈로 이월"
  - id: D5
    description: "배포 직후 재접속(CONN-04 배포 경로): 실제 배포가 소켓을 끊지 않아 띠 사이클이 관찰되지 않았다. 맵 로비의 배포 가로지르는 위치 이어짐은 미확인"
    requirement: CONN-04
    verification:
      - kind: other
        ref: "perf/deployhold-oldclient.json (축소 탐침: 6분 관찰, 띠 0, 인원·자리 동일, 콘솔 0)"
        status: unknown
    human_judgment: true
    rationale: "당시 배포본에 맵이 없어 deployhold 흐름이 성립하지 않았고 DO 하이버네이션이라 배포가 소켓을 끊지 않는다. 확인하려면 맵 로비가 있는 배포본 위에서 사용자 허락을 받은 재배포가 필요"
  - id: D6
    description: "렌더 방식 판정: 사용자가 a(통과, 사다리 0단계·자동 강등 1~3 확정)를 골랐다"
    verification: []
    human_judgment: true
    rationale: "결정 0046·0055 가 판정을 사용자 선택으로 정했다"

duration: 약 50분 (자동 측정 + 사용자 실측 대기 제외)
completed: 2026-11-01
status: complete
---

# Phase 6 Plan 19: 배포·렌더 성능 게이트 측정 Summary

**minifia-v2 를 가드 체인으로 1회 배포(350b7fb)해 배포본 smoke·world 20/20 을 통과시키고, Chrome CPU 4× 4행(60fps·끊김 0)과 Fast 4G 제품 로비 반응(입장→조작 760ms)을 자동으로 재고, 사용자 iPhone 16 Pro vote 5분(59.98fps·열감 차갑다)을 더해 렌더 게이트를 사용자가 a(통과)로 판정했다.**

## Performance

- **Duration:** 자동 작업 약 50분(2026-11-01 12:05~12:55 KST 무렵) + 사용자 실측·판정 대기
- **Tasks:** 3 (Task 1 자동, Task 2 사람 실측 — 항목 1·2 만, Task 3 판정 a)
- **Files modified:** scripts/perf-run.mjs, 06-PERF-RESULTS.md, perf/ 원자료 14개

## 결과 요약 (상세는 06-PERF-RESULTS.md)

| 구분 | 값 | 기준 | 판정 |
|------|----|------|------|
| 배포 | Worker `minifia-v2`, Version ID `86304aab-7b07-458d-bbe1-79627d5c3452`, 커밋 `350b7fb`, health `2026-11-01T03:11:53Z+350b7fb` | v1.0 `minifia` 미접촉 | 통과 |
| smoke --prod / world E2E | SMOKE OK / 20/20 | | 통과 |
| 조건 B talk·vote 5분 DPR 2 | 60.00fps·끊김 0 / 60.00fps·끊김 0 | ≥55·≤5 | 통과 |
| 조건 B talk·vote 1분 DPR 1.5 | 60.00·0 / 59.99·0 (최장 33.5ms) | | 통과 |
| 반응(Fast 4G·CPU 4×, 중앙값) | 입장→조작 760ms, 탭→링 2.1ms, 탭→출발 66ms | ≤3s·≤100ms·≤500ms | 통과 |
| 조건 A iPhone 16 Pro(iOS용 Chrome) vote 5분 | 59.98fps·끊김 1(최장 52ms)·60Hz·calls 57(최대 69)·탭→링 13~27ms·열감 차갑다 | | 통과 |
| 조건 A 나머지 | talk 1분·WebGL 복구·LTE 3초·두 기기 로비·8명 읽힘·채팅 확인표 | | 미확인(이월) |
| 판정 | **a — 통과** (사용자 선택) | | |

## Accomplishments

- **배포 1회와 배포본 검증**: `npm run deploy`(계정 확인 → vite build → 대상 확인 `minifia-v2` → wrangler) 1회, health 해시 일치, smoke --prod·world E2E 20/20.
- **perf-run `--mode interactive`**: 새 컨텍스트마다 제품 경로로 방을 만들고 room-enter → map-interactive, 탭 → 링·출발을 Fast 4G·CPU 4× 로 3회 재서 중앙값을 JSON 으로 저장.
- **조건 B 4행 측정**: 하드웨어 렌더러(ANGLE Metal, M3 Pro) 확인, 사다리 0단계에서 전부 통과.
- **사용자 실측과 판정 기록**: iPhone vote 5분 결과를 원자료로 보관하고, 미확인 항목을 갈음 근거와 이월처와 함께 정직하게 적었다.

## Task Commits

1. **Task 1 선행: perf-run --mode interactive** — `350b7fb` (feat, 배포된 커밋)
2. **Task 1: interactive 훅 결함 수정(배포 빌드)** — `52ce42e` (fix)
3. **Task 1: 결과 문서·측정 원자료** — `9441855` (docs)
4. **STATE 체크포인트 기록** — `5f52662` (docs)
5. **Task 2·3: iPhone 실측·판정 a 기록** — `4efcea1` (docs)

`c9f525e`(HANDOFF)는 오케스트레이터 커밋이라 위 목록에 없지만 `commits: 6` 측정치에 들어 있다.

**Plan metadata:** 이 SUMMARY 커밋(docs)

## Files Created/Modified

- `scripts/perf-run.mjs` — `--mode interactive`·`--runs`, `FAST_4G` 상수와 출처, 세션 훅 플래그, 실패 진단
- `.planning/phases/06-world-skeleton/06-PERF-RESULTS.md` — 조건 A·B·반응·복구·채팅 확인표·배포 직후·판정·열린 항목
- `.planning/phases/06-world-skeleton/perf/` — `desktop-*`, `interactive-dpr2-x4*`, `deployhold-oldclient.json`, `iphone-1-vote5.{json,png}`

## Decisions Made

- 렌더 게이트 판정 a(사용자 선택). 기준 수치는 하나도 낮추지 않았다. 결정 기록 번호·상수 반영은 06-20.
- 미확인 항목은 통과로 쓰지 않고 "미확인 + 갈음 근거 + 이월처"로 적었다(WebGL 복구 → 06-18 로컬 reconnect, LTE 3초 → Fast 4G 측정, 읽힘 → 06-17 E2E, 실기기 → 9페이즈, 채팅 확인표 → 7페이즈).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] perf-run interactive 가 배포 빌드에서 훅을 못 켬**
- **Found during:** Task 1 (배포본 interactive 첫 실행, 3회 모두 `waitForFunction` 시간 초과)
- **Issue:** 방에 들어가면 주소에서 `?e2e=1` 이 사라져 `window.__mfWorld` 가 없었다. 개발 서버는 훅이 항상 켜져 있어 로컬 점검에서 가려졌다.
- **Fix:** E2E 와 같이 세션 저장소에 플래그를 미리 쓴다. 실패 때 주소·훅·맵 상태·marks·보이는 글자를 오류에 담는다.
- **Files modified:** scripts/perf-run.mjs
- **Commit:** 52ce42e

### 계획 전제 오류 (Rule 4 아님, 문서화)

**2. deployhold 원 흐름이 배포 전에는 성립하지 않음**
- **Found during:** Task 1 (배포 전 `--only deployhold` → setup S4 실패)
- **Issue:** 계획의 "배포본 = 지금 v2" 와 달리 당시 배포본은 06-07 빌드(맵·훅 없음)였다.
- **Fix:** 구 배포본에 두 페이지를 로비로 붙인 임시 축소 탐침(저장소 밖)으로 배포 1회 후 6분을 관찰했다. 띠는 한 번도 뜨지 않았고(소켓은 DO 하이버네이션이라 끊기지 않음) 인원·자리·콘솔은 이상 없었다. 결과를 **미확인**으로 기록하고 맵 로비 위치 이어짐을 열린 항목으로 남겼다. 배포는 1회로 유지했다.
- **Files modified:** (원자료만) perf/deployhold-oldclient.json
- **Commit:** 9441855

**Total deviations:** 1 auto-fixed(Rule 1), 1 계획 전제 오류
**Impact on plan:** 기준·횟수는 그대로. deployhold 의 "배포 직후" 항목만 미확인으로 남음.

## Issues Encountered

- 사용자 측정 브라우저가 Safari 가 아니라 iOS용 Chrome(CriOS 156, WebKit 엔진)이었다. 결과 문서에 그대로 적었다.
- 조건 A 의 항목 3~7 은 사용자가 건너뛰었다(미확인).
- Fast 4G 반응 측정은 첫 화면의 `preloadWorld()` 선행(약 1.7초)을 포함한다. 선행 없는 최악 경우는 재지 않았다.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크 표면·인증 경로 없음(측정은 minifia-v2 에만, v1.0 미접촉). T-06-38: 가드 체인 통과·출력에서 `minifia-v2` 확인·v1 주소 미사용. T-06-39: 원자료(JSON·스크린샷 경로)와 판정을 06-PERF-RESULTS.md 에 남김.

## User Setup Required

없음.

## Next Phase Readiness

- 06-20: 판정 a 를 다음 번호 결정 기록으로 남기고(상수 변경 없음 — 사다리 0단계 유지) 후속 반영.
- 열린 항목: 맵 로비 배포 가로지르는 위치 이어짐(변경 없는 재배포 시 `--only deployhold`, 사용자 허락 필요), 부분 재질 실패의 단색 대체(06-18 D9, 사람 확인), 프리로드 경고(deferred-items.md).
- 이월: iPhone 실기기 항목과 저가 Android 등은 9페이즈 팀 테스트, `?chat-mock=1` 확인표는 7페이즈.

---
*Phase: 06-world-skeleton*
*Completed: 2026-11-01*

## Self-Check: PASSED

- 파일 존재: scripts/perf-run.mjs, 06-PERF-RESULTS.md, perf/{desktop-talk-dpr2-x4,desktop-vote-dpr2-x4,desktop-talk-dpr1.5-x4,interactive-dpr2-x4,deployhold-oldclient,iphone-1-vote5}.json — 확인
- 커밋 존재: 350b7fb·52ce42e·9441855·5f52662·4efcea1 — 확인
- 수용 기준: `Fast 4G`·`deployhold|배포 직후` 가 06-PERF-RESULTS.md 에 있음, `interactive` 가 perf-run.mjs 에 있음 — PASS
- 플랜 검증: 배포본 `/api/health` 가 배포 해시 350b7fb 를 포함(HEAD 는 docs 커밋으로 이동했으므로 배포 해시로 대조), smoke --prod OK, world E2E 20/20 — PASS
- 이 계획이 더한 skip·todo: 0건
