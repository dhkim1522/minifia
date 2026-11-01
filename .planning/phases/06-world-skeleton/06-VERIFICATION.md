---
phase: 06-world-skeleton
verified: 2026-11-01T09:20:00Z
status: passed
score: 7/7 must-haves verified
covered_files: [".planning/phases/06-world-skeleton/06-01-PLAN.md", ".planning/phases/06-world-skeleton/06-01-SUMMARY.md", ".planning/phases/06-world-skeleton/06-02-PLAN.md", ".planning/phases/06-world-skeleton/06-02-SUMMARY.md", ".planning/phases/06-world-skeleton/06-03-PLAN.md", ".planning/phases/06-world-skeleton/06-03-SUMMARY.md", ".planning/phases/06-world-skeleton/06-04-PLAN.md", ".planning/phases/06-world-skeleton/06-04-SUMMARY.md", ".planning/phases/06-world-skeleton/06-05-PLAN.md", ".planning/phases/06-world-skeleton/06-05-SUMMARY.md", ".planning/phases/06-world-skeleton/06-06-PLAN.md", ".planning/phases/06-world-skeleton/06-06-SUMMARY.md", ".planning/phases/06-world-skeleton/06-07-PLAN.md", ".planning/phases/06-world-skeleton/06-07-SUMMARY.md", ".planning/phases/06-world-skeleton/06-08-PLAN.md", ".planning/phases/06-world-skeleton/06-08-SUMMARY.md", ".planning/phases/06-world-skeleton/06-09-PLAN.md", ".planning/phases/06-world-skeleton/06-09-SUMMARY.md", ".planning/phases/06-world-skeleton/06-10-PLAN.md", ".planning/phases/06-world-skeleton/06-10-SUMMARY.md", ".planning/phases/06-world-skeleton/06-11-PLAN.md", ".planning/phases/06-world-skeleton/06-11-SUMMARY.md", ".planning/phases/06-world-skeleton/06-12-PLAN.md", ".planning/phases/06-world-skeleton/06-12-SUMMARY.md", ".planning/phases/06-world-skeleton/06-13-PLAN.md", ".planning/phases/06-world-skeleton/06-13-SUMMARY.md", ".planning/phases/06-world-skeleton/06-14-PLAN.md", ".planning/phases/06-world-skeleton/06-14-SUMMARY.md", ".planning/phases/06-world-skeleton/06-15-PLAN.md", ".planning/phases/06-world-skeleton/06-15-SUMMARY.md", ".planning/phases/06-world-skeleton/06-16-PLAN.md", ".planning/phases/06-world-skeleton/06-16-SUMMARY.md", ".planning/phases/06-world-skeleton/06-17-PLAN.md", ".planning/phases/06-world-skeleton/06-17-SUMMARY.md", ".planning/phases/06-world-skeleton/06-18-PLAN.md", ".planning/phases/06-world-skeleton/06-18-SUMMARY.md", ".planning/phases/06-world-skeleton/06-19-PLAN.md", ".planning/phases/06-world-skeleton/06-19-SUMMARY.md", ".planning/phases/06-world-skeleton/06-20-PLAN.md", ".planning/phases/06-world-skeleton/06-20-SUMMARY.md", ".planning/phases/06-world-skeleton/06-21-PLAN.md", ".planning/phases/06-world-skeleton/06-21-SUMMARY.md", ".planning/phases/06-world-skeleton/06-22-PLAN.md", ".planning/phases/06-world-skeleton/06-22-SUMMARY.md", ".planning/phases/06-world-skeleton/06-23-PLAN.md", ".planning/phases/06-world-skeleton/06-23-SUMMARY.md", "package.json", "scripts/check-deploy-target.mjs", "scripts/deploy-target.mjs", "scripts/deploy.mjs", "scripts/e2e/browser.mjs", "scripts/e2e/flows.mjs", "scripts/e2e/lib.mjs", "shared/game/bots.ts", "shared/game/map.ts", "shared/game/world.ts", "shared/nickname.ts", "shared/protocol.ts", "shared/schemas.ts", "src/components/WorldStage.tsx", "src/net/useRoomConnection.ts", "src/screens/Lobby.tsx", "src/screens/RoomScreen.tsx", "src/styles/world.css", "src/world/camera.ts", "src/world/input.ts", "src/world/runtime.ts", "src/world/status.ts", "src/world/store.ts", "src/world/tagOrder.ts", "src/world/threeRenderer.ts", "worker/room.ts", "wrangler.jsonc"]
covered_digest: "v3:sha256:acb1e0f293ac76484f39827458bd8057688f057809cca4ea134b380c95ad6ea1"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 6/7
  gaps_closed:
    - "SC3b 배포를 가로지르는 맵 로비 위치 이어짐(deployhold) — 배포본 699a8b8 에서 9/9"
    - "G-06-4 이름표 겹침('(나)' 가림) — 06-22, 배포본 world 21/21 x2 + NT3"
    - "G-06-6 배포본 재접속 띠 0회 — 06-23, 배포본 reconnect 35/35, 띠 10/10"
    - "코드 리뷰 수정 6건이 배포본에 없던 문제 — 699a8b8 에 모두 포함"
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "재검토 WR-01(deploy.mjs 직접 실행 판정이 심볼릭 링크 경로에서 거짓이면 조용히 0 종료)"
    category: other
    reason: "정상 경로에서는 699a8b8 배포가 실제로 일어남(deploy-gap.log). 06-REVIEW-DISPOSITION 에 open 으로 기록"
    evidence_status: "정적 분석·임시 스크립트 재현(06-REVIEW), 이 검증은 재현하지 않음"
  - finding: "재검토 WR-02(배포 신호 없을 때 DH0 행이 ok:true 라 종료 0)"
    category: other
    reason: "이번 deployhold 는 health version 이 5e6abf8→699a8b8 로 바뀐 실제 배포 신호가 있어 DH1 이 판정됨"
    evidence_status: "deployhold-gap.log"
  - finding: "재검토 WR-03(createActor tagFront 초기값 false — 퇴장 직후 같은 seat 재입장 때 외형만 어긋날 수 있음)"
    category: other
    reason: "확률 낮고 외형만. open 기록"
    evidence_status: "none provided"
---

# Phase 6: 월드 뼈대 Verification Report

**Phase Goal:** 친구들이 `minifia-v2` 주소로 들어와 로비 맵에서 서로의 캐릭터가 걷는 모습을 보고, 이 렌더링 방식이 실제 폰에서 버틴다는 것이 숫자로 확인된다
**Verified:** 2026-11-01
**Status:** passed
**Re-verification:** Yes — 이전 보고서(human_needed, 6/7)가 코드 리뷰 수정과 갭 닫기 06-22·06-23 이후 낡아서 다시 썼다

## 요약

이전 보고서의 유일한 미확인 truth(SC3b, 배포를 가로지르는 위치 이어짐)와 사람 확인 5건이 배포본 `699a8b8`(Version ID `ac0f005b-a027-4ec0-a80f-84c33179c12e`) 의 자동 실행 증거로 닫혔다. 이 검증이 직접 확인한 것은 다음이다.

- `git diff 699a8b8 HEAD` 에서 `.planning`·`docs` 밖의 파일 변경이 0건이다. 즉 현재 HEAD 의 코드는 배포본과 같고, 배포본 E2E 결과는 지금 코드에 대한 증거다.
- 이 검증에서 직접 돌린 `npx vitest run`(139 파일, 3733 통과·1 건너뜀), `npm run typecheck`(exit 0), `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs`(280 통과·실패 0)가 모두 초록이다.
- 배포본 로그를 직접 열어 확인했다(스크래치패드 `deployhold-gap.log` 9/9, `reconnect-gap.log` 35/35, `world-gap.log` 360x640·390x664 각 21/21, `smoke-gap.log` `SMOKE OK … +699a8b8`, `deploy-gap.log` Version ID).
- `phase uat-passed 06 --uat-only` 가 `passed: true` 를 돌려준다. UAT 6건 중 pass 4, issue 2(G-06-4·G-06-6) 이고 두 갭은 `resolved_by` 06-22·06-23 으로 닫혀 있다.
- 차단 수준 결함은 찾지 못했다. 사람이 해야 할 남은 항목은 없다. 다만 실기기 확인 3건은 사용자가 UAT 에서 자동 대체를 수용하고 9페이즈 팀 테스트로 옮겼다(아래 "이월된 실기기 확인").

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | SC1: v2.0 이 `minifia-v2` Worker 에 배포되어 다른 기기에서 방을 만들고 참가할 수 있고, 배포·검사 스크립트가 v1.0 주소를 덮어쓰거나 검사하지 않는다 (DEPLOY-02) | ✓ VERIFIED | `scripts/deploy-target.mjs` 가 `V1_HOST`/`V1_ORIGIN` 을 거부 상수로만 갖고(스크립트·worker·src 에서 `minifia.dhplay` 가 나오는 곳은 이 파일과 그 테스트 둘뿐), `scripts/deploy.mjs` 는 추가 인자를 거부하고 wrangler 에 `["wrangler","deploy"]` 고정 인자만 넘긴다. `deploy` 스크립트가 `check-account → vite build → check-deploy-target → deploy.mjs` 체인. 배포본 `deploy-gap.log`: "배포 대상 확인: minifia-v2", `Uploaded minifia-v2`, 배포 주소 `minifia-v2.dhplay.workers.dev`. 배포본 `smoke-gap.log` `SMOKE OK create code=3732 …+699a8b8`(방 만들기). 사용자가 06-07 에서 실제 폰으로 방 만들기·참가 확인. v1.0 주소 무변경은 이 검증이 v1.0 에 요청하지 않아(요청 금지) 재확인하지 못했고, 06-07 의 일회성 기록값과 스크립트 가드 단위 테스트(280 통과)가 근거다 |
| 2 | SC2: 폰 2대 이상이 같은 로비(지하 재즈 바)에서 서로의 캐릭터와 닉네임을 보고, 맵 탭이 모두에게 같은 경로·속도로 걷기로 보이며, 맵은 한 화면보다 넓고 카메라가 내 캐릭터를 따른다 (MAP-01·02·03) | ✓ VERIFIED | 서버 `worker/room.ts` `applyMove → requestMove(shared/game/world.ts)` 가 경로·속도를 정하고 `emitWorld` 로 전원 전송. 클라이언트 `RoomScreen → store.applyFrame`, `WorldStage` 탭 → `send({t:"move",x,z})`, 런타임이 `store.positionOf` 로 그림. 배포본 `world-gap.log` 360x640·390x664 각 21/21: W0 두 페이지가 서로의 이름표를 봄, W2/W10 두 페이지 위치 차(최대 0.0000/0.0207 ≤ 0.3), W3 링 0.6ms, W4 구간 시작 206ms, W6 도착 위치가 누른 점, W7 카메라가 따라가 발이 스테이지 안, NT4 내 이름표가 스테이지 안. 실제 폰 두 대 확인은 UAT 가 두 페이지 자동 시험으로 갈음하고 9페이즈 팀 테스트로 이월 |
| 3 | SC3a: 화면 껐다 켜기·새로 고침·재접속이 돌아와도 모든 캐릭터가 지금 위치로 이어진다 (MAP-05) | ✓ VERIFIED | 배포본 `reconnect-gap.log` 35/35: offline(끊김 3초)·frozen(화면 끔)·reload·lose·lose-idle 각 10회에서 RC5 모두 복구, RC1 콘솔 0, RC2 띠 잔류 0, RC3 두 페이지 위치 어긋남 0, RC4 알림 재표시 0, RC7 복구 뒤 같은 씬. 서버 쪽은 `test/worker/world.test.ts`(퇴거 후 재접속 snap 동일) 가 이번 전체 vitest 에서 통과 |
| 4 | SC3b: 배포로 연결이 끊겼다 돌아와도 맵 로비 캐릭터가 지금 위치로 이어진다 (MAP-05·CONN-04 의 배포 경로) | ✓ VERIFIED | 이전 보고서에서 미확인이던 항목. 배포본 `deployhold-gap.log` 9/9: 실제 배포(health version 이 `5e6abf8 → 699a8b8` 로 바뀐 창, 133초 관찰)에서 DH1 통과(띠 없이 소켓 유지), RC5 복구, RC3 위치 어긋남 0(복구 전 대비 최대 0), RC1 콘솔 0, RC2 띠 잔류 0. 제품 띠 경로는 같은 배포본 offline 10/10 에서 띠가 뜨고 사라지는 것으로 직접 관찰됨(RC6 통과, 띠 본 횟수 10). 주의: 이번 배포는 소켓을 끊지 않았다(띠 본 횟수 0). 즉 "배포가 소켓을 끊는 순간"을 직접 본 것이 아니라 "배포 중 소켓이 유지되고 위치가 이어짐" + "끊김→재접속→snap 복원" 각각을 다른 시험으로 본 것이다. 끊겼을 때의 복원은 서버 퇴거 복원 테스트와 reconnect 5종이 덮는다. 06-23 의 판정 규칙(띠가 안 뜨고 소켓 유지이거나, 띠가 떴으면 복구)이 이 구조를 반영하며 배포 신호 없으면 DH0 미확인으로 남는다 |
| 5 | SC3c: 보류했던 연결 계층 경고(WR-01~04)가 더는 나지 않고, 시작 이후 한 판은 v1.0 흐름 그대로 끝까지 돈다 (CONN-04) | ✓ VERIFIED | 이전 보고서가 확인한 WR-01~04 수정 커밋 `9b89310`·`2b308f4`·`735ef3a`·`efdf811` 은 그대로이고, 이번 전체 vitest(`useRoomConnection.test.tsx` "world 프레임 비간섭 (CONN-04)" 포함)가 통과한다. 배포본 reconnect·deployhold 의 RC1 콘솔 경고·오류 0건. 시작 이후 한 판은 worker 테스트(start·day·night·vote·endgame·leak)가 v1.0 규칙대로 통과한다. E2E 의 v1.0 게임 흐름 초록은 결정 0056(개정)의 승인 완화 아래에서 얻은 것이며 8~9페이즈에 지운다 |
| 6 | SC4: 렌더 성능 게이트 — 3D 맵 + 3D 캐릭터 8명이 사용자 폰과 크롬 CPU 4배에서 5분 평균 55fps 이상, 끊김·발열·메모리 경고 없이 돌고 로비 조작이 3초 안에 반응하며 결과가 결정 기록에 남는다 | ✓ VERIFIED | `06-PERF-RESULTS.md` 와 `docs/decisions/0057-v2-render-gate.md` 에 숫자·판정이 있다(조건 B: talk·vote 5분 60.00fps·끊김 0·draw call 최대 66~67 ≤ 120·반응 760ms ≤ 3000, 조건 A: iPhone 16 Pro vote 5분 59.98fps·끊김 1·열감 차갑다, 판정 a·사다리 0단계). 이전 검증이 원자료 스크린샷으로 대조 완료. 이후 변경(06-22 이름표 순위, 06-23 하네스)은 렌더 예산 코드를 건드리지 않았다(`DEFAULT_BUDGET_STEP`·`DRAW_CALL_BUDGET` 은 06-22 변경 파일 목록에 없음). 한계: 폰 측정은 고사양 한 대·vote 한 조합·iOS용 Chrome 이고 저사양 보증이 아니다(결정 0057 이 스스로 명시). 사용자가 판정을 직접 골랐으므로 목표("숫자로 확인")는 충족으로 본다 |
| 7 | MAP-07: 닉네임 1~8자, 머리 위 이름표는 8자에서도 말줄임하지 않고, 테스트 봇 이름은 8자 | ✓ VERIFIED | `shared/nickname.ts` 8 자소, `BOT_NAMES` 8자. 배포본 world NT1 "이름표가 잘리지 않음(말줄임 없음·14px 이상)" 양 크기 통과. 06-22 로 내 이름표가 맨 위(`rankTags`)가 되고 겹친 맨 앞 하나만 면이 `overlay-ink-strong`(`src/world/tagOrder.ts`, `runtime.ts:801-812` `writeTags` 가 `rankTags` 호출, `world.css:18` `data-front`) — 배포본 NT3 "내 이름표 맨 위·맨 앞 면 짙음·안 겹치면 80%" 방장·손님 시점 통과. 이모지 8자 이름표 202.4px 가 `NAMETAG_MAX_W` 180 을 넘는 것은 사용자가 일단 허용(NT2 참고 행). 다른 사람 이름표가 가장자리에서 잘리는 것과 [테스트]·알림 겹침은 사용자가 수용(G-06-4 decision) |

**Score:** 7/7 truths verified (0 behavior-unverified)

### Deferred Items

없음. 이 페이즈 truth 가운데 뒤 페이즈로 넘긴 것은 없다. (MAP-04 는 8페이즈, MAP-06 은 11페이즈 소관으로 이 페이즈 요구사항이 아니다.)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `scripts/deploy-target.mjs`, `scripts/check-deploy-target.mjs`, `scripts/deploy.mjs` | 배포 대상 단일 출처·산출물 검사·추가 인자 거부 | ✓ VERIFIED | 내용 확인, 280 스크립트 테스트 통과, 배포 로그에 가드 출력 |
| `shared/game/map.ts`, `shared/game/world.ts`, `worker/room.ts` | 격자·경로·서버 권위 이동·저장·복원 | ✓ VERIFIED | worker 테스트 통과(전체 vitest) |
| `src/world/runtime.ts`, `store.ts`, `camera.ts`, `threeRenderer.ts`, `tagOrder.ts` | 월드 런타임·스토어·카메라·렌더러·이름표 순위 | ✓ VERIFIED | `tagOrder.ts` 는 순수 함수 구현, `runtime.ts` 가 import·호출, `test/unit/tagOrder.test.ts` 통과 |
| `src/components/WorldStage.tsx`, `src/screens/Lobby.tsx`, `src/screens/RoomScreen.tsx` | 로비 맵 화면 | ✓ VERIFIED | 배포본 world E2E 가 실제 화면으로 통과 |
| `scripts/e2e/browser.mjs`, `flows.mjs`, `lib.mjs` | `dropSockets` 합성 close(1006), `deployHoldChecks`/`deployObservedOf` | ✓ VERIFIED | `browser.mjs:1151` 합성 `CloseEvent(1006)` 후 `ws.close()`, `lib.mjs:2109` `deployObservedOf`, 배포본 reconnect·deployhold 가 이 하네스로 통과 |
| `06-PERF-RESULTS.md`, `docs/decisions/0057-v2-render-gate.md` | 측정 숫자와 판정 | ✓ VERIFIED | 존재 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `npm run deploy` | `check-deploy-target.mjs` → `deploy.mjs` | package.json 체인 | WIRED | 배포 로그가 순서대로 출력 |
| `worker/room.ts` `applyMove` | `world.ts` `requestMove` | import·호출 | WIRED | 이전 확인 유지, 코드 변경 없음 |
| `RoomScreen` world 프레임 | `WorldStore.applyFrame` | `onEvent` | WIRED | 배포본 두 페이지 위치 일치 |
| `WorldStage` 탭 | `send({t:"move"})` | `onTap` | WIRED | 배포본 W3/W4 |
| `runtime.writeTags` | `rankTags` / `data-front` / `world.css` | import·속성 | WIRED | grep 확인 |
| e2e `dropSockets` | 앱 방 소켓 합성 close | `dispatchEvent` | WIRED | 배포본 offline 띠 10/10 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| 이름표 | `view.players[].nickname` | 서버 state | 예 | ✓ FLOWING |
| 캐릭터 위치 | `store.positionOf(seat)` | 서버 world.move/snap | 예(배포본 두 페이지 위치 차 0) | ✓ FLOWING |
| 재접속 위치 | `snapFrame(world)` | storage `world` 키 | 예(퇴거 복원 테스트, 배포본 RC3) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 단위·클라이언트·worker 테스트 | `npx vitest run` | 139 파일, 3733 통과·1 건너뜀 | ✓ PASS |
| 타입 검사 | `npm run typecheck` | exit 0 | ✓ PASS |
| 스크립트 테스트 | `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs` | 280 통과, 실패 0 | ✓ PASS |
| 코드 = 배포본 | `git diff --name-only 699a8b8 HEAD` 에서 `.planning`·`docs` 제외 | 0건 | ✓ PASS |
| UAT 판정 | `gsd query phase uat-passed 06 --uat-only` | `passed: true` | ✓ PASS |
| 배포본 E2E(deployhold·reconnect·world·smoke) | 서버를 띄우거나 배포하지 않음 — 오케스트레이터가 실행한 로그를 직접 열어 확인 | 9/9 · 35/35 · 21/21 x2 · SMOKE OK | ✓ PASS (로그 근거) |

### Probe Execution

해당 없음(이 페이즈는 `probe-*.sh` 를 선언하지 않았고 `scripts/*/tests/probe-*.sh` 도 없다).

### Requirements Coverage

23개 PLAN frontmatter 의 requirements 를 합치면 DEPLOY-02(4)·MAP-01(16)·MAP-02(9)·MAP-03(7)·MAP-05(9)·MAP-07(5)·CONN-04(5) 로 7개 ID 모두 최소 하나의 PLAN 이 주장한다. REQUIREMENTS.md 의 Phase 6 매핑 7개와 일치하며 고아 요구사항은 없다. REQUIREMENTS.md 체크박스·추적표도 7개 모두 Complete 다. MAP-04(8페이즈)·MAP-06(11페이즈)는 이 페이즈 소관이 아니다.

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| DEPLOY-02 | 06-01, 06-07, 06-19, 06-20 | 별도 Worker 배포, 스크립트가 v1.0 을 덮어쓰거나 검사하지 않음 | ✓ SATISFIED | 진실 1 |
| MAP-01 | 06-02·04·08·10~22 | 로비 맵에서 서로의 캐릭터·닉네임을 봄 | ✓ SATISFIED | 진실 2·7 |
| MAP-02 | 06-02·05·08·11·13·14·17·19·20 | 탭하면 걷고 같은 경로·속도 | ✓ SATISFIED | 진실 2 |
| MAP-03 | 06-03·10·13·14·17·19·20 | 맵이 한 화면보다 넓고 카메라가 따름 | ✓ SATISFIED | 진실 2 |
| MAP-05 | 06-03·05·08·09·13·15·18·19·23 | 껐다 켜기·재접속에도 위치 이어짐 | ✓ SATISFIED | 진실 3·4 |
| MAP-07 | 06-06·12·13·17·22 | 닉네임 1~8자, 말줄임 없음, 봇 이름 8자 | ✓ SATISFIED | 진실 7 |
| CONN-04 | 06-09·15·18·19·23 | 연결 계층 경고 WR-01~04 수정 | ✓ SATISFIED | 진실 4·5 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| 이 페이즈 변경 파일 | — | `TBD`/`FIXME`/`XXX` | — | 이전 검증에서 0건, 이후 변경(06-22·06-23)은 추가한 표식 없음(SUMMARY 의 Known Stubs: None) |
| `scripts/deploy.mjs` | 30 | 직접 실행 판정이 심볼릭 링크 경로에서 거짓이면 조용히 0 종료(재검토 WR-01) | ⚠️ Warning (advisory) | 정상 경로는 699a8b8 배포로 동작 확인. 사용자 결정으로 열린 채 기록 |
| `scripts/e2e/lib.mjs` | 2125-2134 | DH0 미확인 행이 `ok:true` 라 종료 0(재검토 WR-02) | ⚠️ Warning (advisory) | 이번 deployhold 는 실제 배포 신호가 있어 DH1 로 판정됨 |
| `src/world/runtime.ts` | 482, 806-810 | `tagFront` 초기값 false(재검토 WR-03) | ⚠️ Warning (advisory) | 외형만, 확률 낮음 |
| `src/world/store.ts`, `worker/room.ts`, `threeRenderer.ts`, 헤더 주석 등 | — | IN-01~06 (열림) | ℹ️ Info | 목표를 막지 않음. 06-REVIEW-DISPOSITION 에 기록 |
| 로비 | — | "preloaded but not used" 콘솔 경고 | ⚠️ Warning | v1.0 기존 동작, E2E `CONSOLE_ALLOW` 에 이유와 함께 허용(`preload-unused`) |

### 보조 산출물 확인

| 산출물 | 내용 | 평가 |
| ------ | ---- | ---- |
| `06-SECURITY.md` | `threats_open: 0` | 존재 확인(재감사하지 않음) |
| `06-UI-REVIEW.md` | 18/24, 경고 중 이름표 겹침은 06-22 로 해결 | 이름표 겹침(경고 1)·가장자리/알림 겹침(경고 2)은 사용자 결정으로 수용 |
| `06-VALIDATION.md` | `nyquist_compliant: true` | 존재 확인 |

### 이월된 실기기 확인 (사용자 수용, 차단 아님)

아래 3건은 자동 시험으로 갈음된 것을 UAT 에서 사용자가 수용했고 실기기 확인은 9페이즈 팀 테스트로 옮겼다. 이 검증이 새로 만든 요구가 아니고, 수용된 대체의 한계를 숨기지 않기 위해 적는다.

1. 실제 폰 두 대 이상의 로비 — 두 페이지 E2E 로 갈음(UAT 테스트 5).
2. WR-02(숨은 탭 소실 타이머) 실기기 복귀 — 배포본 frozen/lose/lose-idle 각 10/10 으로 갈음(UAT 테스트 3).
3. 360폭 실제 폰에서 8명 이름표 읽힘 — 06-22 가 사용자 결정대로 코드·E2E 로 고정(NT3), 가장자리 잘림은 수용.

이 항목들은 페이즈 목표("실제 폰에서 버틴다는 것이 숫자로 확인")의 숫자 근거(SC4 의 iPhone 16 Pro 측정)와는 별개다.

### Human Verification Required

없음. (위 이월 항목은 사용자가 UAT 에서 자동 증거를 수용하고 9페이즈로 옮긴 것이라 이 페이즈의 열린 사람 확인이 아니다.)

### Gaps Summary

목표를 막는 격차는 없다. 이전 보고서의 미확인 truth(SC3b)는 배포본의 실제 배포 중 deployhold 통과와 offline 띠 10/10 으로 닫혔고, UAT 갭 G-06-4·G-06-6 은 06-22·06-23 으로 닫혀 배포본에서 확인됐다. 현재 코드는 배포본과 동일하며 로컬 자동 검사가 모두 초록이다. 열린 것은 재검토 경고 3·참고 6뿐이고 모두 권고 수준으로 기록됐다.

---

_Verified: 2026-11-01_
_Verifier: Claude (gsd-verifier)_
