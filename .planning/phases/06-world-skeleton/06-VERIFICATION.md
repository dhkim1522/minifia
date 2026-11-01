---
phase: 06-world-skeleton
verified: 2026-11-01T06:00:00Z
status: human_needed
score: 6/7 must-haves verified
covered_files: [".planning/phases/06-world-skeleton/06-01-PLAN.md",".planning/phases/06-world-skeleton/06-01-SUMMARY.md",".planning/phases/06-world-skeleton/06-02-PLAN.md",".planning/phases/06-world-skeleton/06-02-SUMMARY.md",".planning/phases/06-world-skeleton/06-03-PLAN.md",".planning/phases/06-world-skeleton/06-03-SUMMARY.md",".planning/phases/06-world-skeleton/06-04-PLAN.md",".planning/phases/06-world-skeleton/06-04-SUMMARY.md",".planning/phases/06-world-skeleton/06-05-PLAN.md",".planning/phases/06-world-skeleton/06-05-SUMMARY.md",".planning/phases/06-world-skeleton/06-06-PLAN.md",".planning/phases/06-world-skeleton/06-06-SUMMARY.md",".planning/phases/06-world-skeleton/06-07-PLAN.md",".planning/phases/06-world-skeleton/06-07-SUMMARY.md",".planning/phases/06-world-skeleton/06-08-PLAN.md",".planning/phases/06-world-skeleton/06-08-SUMMARY.md",".planning/phases/06-world-skeleton/06-09-PLAN.md",".planning/phases/06-world-skeleton/06-09-SUMMARY.md",".planning/phases/06-world-skeleton/06-10-PLAN.md",".planning/phases/06-world-skeleton/06-10-SUMMARY.md",".planning/phases/06-world-skeleton/06-11-PLAN.md",".planning/phases/06-world-skeleton/06-11-SUMMARY.md",".planning/phases/06-world-skeleton/06-12-PLAN.md",".planning/phases/06-world-skeleton/06-12-SUMMARY.md",".planning/phases/06-world-skeleton/06-13-PLAN.md",".planning/phases/06-world-skeleton/06-13-SUMMARY.md",".planning/phases/06-world-skeleton/06-14-PLAN.md",".planning/phases/06-world-skeleton/06-14-SUMMARY.md",".planning/phases/06-world-skeleton/06-15-PLAN.md",".planning/phases/06-world-skeleton/06-15-SUMMARY.md",".planning/phases/06-world-skeleton/06-16-PLAN.md",".planning/phases/06-world-skeleton/06-16-SUMMARY.md",".planning/phases/06-world-skeleton/06-17-PLAN.md",".planning/phases/06-world-skeleton/06-17-SUMMARY.md",".planning/phases/06-world-skeleton/06-18-PLAN.md",".planning/phases/06-world-skeleton/06-18-SUMMARY.md",".planning/phases/06-world-skeleton/06-19-PLAN.md",".planning/phases/06-world-skeleton/06-19-SUMMARY.md",".planning/phases/06-world-skeleton/06-20-PLAN.md",".planning/phases/06-world-skeleton/06-20-SUMMARY.md",".planning/phases/06-world-skeleton/06-21-PLAN.md",".planning/phases/06-world-skeleton/06-21-SUMMARY.md","package.json","scripts/check-deploy-target.mjs","scripts/deploy-target.mjs","scripts/deploy.mjs","shared/game/bots.ts","shared/game/map.ts","shared/game/world.ts","shared/nickname.ts","shared/protocol.ts","shared/schemas.ts","src/components/WorldStage.tsx","src/net/useRoomConnection.ts","src/screens/Lobby.tsx","src/screens/RoomScreen.tsx","src/world/camera.ts","src/world/input.ts","src/world/runtime.ts","src/world/status.ts","src/world/store.ts","src/world/threeRenderer.ts","worker/room.ts","wrangler.jsonc"]
covered_digest: "v3:sha256:2be18f736d75fdbc1f1947ddb97a43997419222895542e8a8cd42b89b25e8cb3"
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "배포로 연결이 끊겼다 돌아와도 맵 로비의 모든 캐릭터가 지금 위치로 이어진다 (ROADMAP 성공 기준 3 중 배포 경로, MAP-05·CONN-04)"
    test: "맵 로비(두 페이지 이상)를 붙여 둔 채 다음 v2 배포(변경 없는 재배포 포함, 사용자 허락 필요)를 하고 `npm run e2e -- --only deployhold` 를 돌린다"
    expected: "배포 직후 띠가 떴다 사라지고, 걷던 캐릭터를 포함해 모든 캐릭터의 위치가 이어지며 콘솔 경고·오류가 0 이다"
    why_human: "지난 배포(350b7fb)는 DO 하이버네이션 때문에 소켓을 끊지 않았고 당시 배포본에는 맵이 없어 원 흐름이 setup 에서 실패했다. 소켓이 끊기는 경우의 복구는 로컬 reconnect 5종×10회와 worker 퇴거 복원 테스트가 덮지만, 배포를 가로지르는 맵 로비 경로 자체는 한 번도 실행되지 않았다. 코드가 있고 연결돼 있다는 것만으로는 이 상태 전이를 증명하지 못한다"
human_verification:
  - test: "배포를 가로지르는 맵 로비 위치 이어짐(deployhold)"
    expected: "위 behavior_unverified_items 와 같다"
    why_human: "배포가 필요하고 사용자 허락이 필요하다. 이 검증은 배포하지 않았다"
  - test: "코드 리뷰 수정 6건(a9707d9·2f0974d·7e71d9c·167f62a·a50547b·60fa788)을 배포한 뒤 배포본 재확인(world E2E 와 smoke)"
    expected: "`npm run e2e -- --only world --sizes 390x664` 20/20, `node scripts/smoke.mjs --prod` 통과. 수정이 들어간 빌드에서 탭 간격 250ms·닉네임 스키마·숨은 탭 소실 타이머가 의도대로 동작한다"
    why_human: "수정은 로컬 단위·worker 테스트(3710 통과)로만 확인됐고 배포본(350b7fb)에는 없다. 06-PERF-RESULTS 의 모든 배포본 숫자는 수정 전 빌드의 것이다"
  - test: "WR-02 수정(숨은 탭 소실 타이머, `recreating` 중 복귀하면 5초 포기 시계를 복귀 시점부터 다시 센다)이 의도와 맞는지"
    expected: "iPhone 에서 화면 잠금 30초 뒤 복귀·카카오톡 전환 뒤 복귀·카메라 앱 뒤 복귀가 5초 안에 장면을 되살리거나 실패 카드를 보이고 흰·검은 화면이 남지 않는다"
    why_human: "기존 단위 테스트의 기대를 의도적으로 바꾼 상태 전이 변경이다(06-REVIEW-FIX 가 사람 확인 요청). 실기기 WebGL 복구 3종은 사용자가 건너뛰었다"
  - test: "8명이 모였을 때 폰 화면에서 닉네임(특히 내 이름표 '(나)')이 읽히는지, 360폭에서 가장자리 이름표가 잘리지 않는지"
    expected: "맨 앞 이름표가 전부 읽히고 걷는 영역 안에서 이름표가 화면 밖으로 나가지 않는다"
    why_human: "06-UI-REVIEW 가 360×640 8명 캡처에서 반투명 이름표가 겹쳐 '(나)' 가 가려지고 360×560 에서 가장자리 이름표가 잘리는 것을 경고했다. 이모지 8자 내 이름표 202.4px > NAMETAG_MAX_W 180 은 사용자가 '일단 허용'(2026-11-01)했다. 실기기 8명 읽힘은 건너뛰어 미확인이며 9페이즈 팀 테스트로 이월됐다"
  - test: "두 대 이상의 실제 폰으로 같은 방 로비에 들어가 서로의 캐릭터·닉네임이 보이고 탭한 쪽이 걸어가는 경로가 다른 폰에서도 같은지"
    expected: "보임, 같은 경로·속도, 지연 없음"
    why_human: "iPhone 두 기기 로비는 사용자가 건너뛰었다. 06-17 world E2E 두 페이지 시험과 배포본 world 20/20(위치 차 0.0000, 걷는 중 최대 0.0027)으로 갈음돼 있고 9페이즈 팀 테스트로 이월됐다"
deferred: []
---

# Phase 6: 월드 뼈대 Verification Report

**Phase Goal:** 친구들이 `minifia-v2` 주소로 들어와 로비 맵에서 서로의 캐릭터가 걷는 모습을 보고, 이 렌더링 방식이 실제 폰에서 버틴다는 것이 숫자로 확인된다
**Verified:** 2026-11-01
**Status:** human_needed
**Re-verification:** No — initial verification

## 요약

저장소 코드는 목표를 구현한다. 서버 권위 이동·저장·복원, 클라이언트 월드 스토어와 렌더러, 로비 교체, 배포 대상 가드, 닉네임 8자가 모두 실제 코드로 존재하고 서로 연결되어 있다. 이 검증에서 직접 돌린 `npx vitest run`(137 파일, 3710 통과·1 건너뜀), `npm run typecheck`(통과), `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs`(267 통과)가 모두 초록이다. 차단 수준(BLOCKER) 결함은 찾지 못했다.

다만 한 가지는 코드가 아니라 실행 증거가 없어 "검증됨"으로 올릴 수 없다. 배포를 가로지르는 맵 로비 위치 이어짐(deployhold)은 한 번도 실행되지 않았다. 또 코드 리뷰 수정 6건은 배포본에 들어가지 않았다. 이 때문에 상태는 `gaps_found` 가 아니라 `human_needed` 다.

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | SC1: v2.0 이 `minifia-v2` Worker 에 배포되어 다른 기기에서 방을 만들고 참가할 수 있고, 배포·검사 스크립트가 v1.0 주소를 덮어쓰거나 검사하지 않는다 (DEPLOY-02) | ✓ VERIFIED | `wrangler.jsonc` name `minifia-v2`, `scripts/prod-url.txt` 가 v2 주소. `deploy` 스크립트 체인 `check-account → vite build → check-deploy-target → deploy.mjs`. `assertNotV1` 이 끝 점·대소문자·경로·포트·`%2e`·전각 마침표·사용자 정보 변형을 거부(CR-01 수정 a9707d9, 테스트 통과). 9개 네트워크 스크립트(smoke·bots·gallery·perf-run·uat-day/night/vote/test-bots/test-room)와 e2e `resolveTarget` 이 모두 가드를 호출. `deploy.mjs` 는 추가 인자를 거부(WR-05). 배포 사실: Worker 버전 `86304aab…`, `/api/health` 가 `…+350b7fb`, smoke OK, 06-07 에서 사용자가 실제 폰으로 방 만들기·참가 확인. v1.0 무변경은 06-07 의 일회성 기록값(`…+cb6979c` 가 기준선과 같음)만 근거이며 이 검증은 v1.0 주소에 요청하지 않아 재확인하지 못했다(요청 금지 조건) |
| 2 | SC2: 폰 2대 이상이 같은 로비(지하 재즈 바)에서 서로의 캐릭터와 닉네임을 보고, 맵 탭이 모두에게 같은 경로·속도로 걷기로 보이며, 맵은 한 화면보다 조금 넓고 카메라가 내 캐릭터를 따른다 (MAP-01·02·03) | ✓ VERIFIED | 서버: `worker/room.ts` `handleMove → applyMove → requestMove(world.ts)`, 로비 단계에서만 적용, 150ms 간격·경로를 서버가 정함, `emitWorld(moveFrame)` 로 전원 전송. `test/worker/world.test.ts` 가 [state, snap] 순서·손님 move 가 두 소켓에 같은 프레임으로 감·보정·150ms 간격·형식 오류 거부를 workerd 에서 검증(전체 실행 통과). 클라이언트: `RoomScreen` 이 `onEvent → store.applyFrame` 으로 연결, `WorldStage` 가 탭 → `runtime.tap` → `send({t:"move", x, z})`(정수 둘만), 런타임이 `store.positionOf` 로 그림. 카메라 `followStep`(350ms 에 90%)·`clampTarget`(PAN_BOX ±4.8), 걷는 영역 ±5.8·연장 바닥 판 18.5 로 한 화면보다 넓음. 배포본 world E2E 20/20(두 페이지 위치 차 0.0000, 링 0.8ms, 구간 도착 62ms). 로컬 8인 로비 캡처(`scripts/e2e/out/lobby-8-360x640.png`)에서 3D 캐릭터와 닉네임 이름표 확인. 단, 실기기 두 대 로비·8명 읽힘은 미확인(human_verification) |
| 3 | SC3a: 화면 껐다 켜기·새로 고침·재접속이 돌아와도 모든 캐릭터가 지금 위치로 이어진다 (MAP-05) | ✓ VERIFIED | 서버: 위치를 room 키와 분리된 `world` 키에 2초 디바운스·퇴장 시 즉시 저장, 생성자가 `restoreWorld` 로 복원, 접속(hello)마다 lobby 단계면 `snapFrame` 전송(`room.ts:779`). `world.test.ts` "이동 → flush → 퇴거 → 재접속 hello 의 snap 이 퇴거 전과 같은 위치(진행 중 구간 포함)", "world 키가 없는 옛 방은 입장 지점 복원", "마지막 소켓이 닫히면 즉시 저장", "알람이 깨어나면 먼저 저장"이 통과. 클라이언트 `WorldStore` epoch 규칙(낡은 epoch 폐기, snap 통째 교체)은 `worldStore.test.ts`·`useRoomConnection.test.tsx` 통과. 로컬 E2E reconnect 5종×10회는 06-18 SUMMARY 기록이며 이 검증에서 재실행하지 않았다(서버를 띄우지 않는 제약) |
| 4 | SC3b: 배포로 연결이 끊겼다 돌아와도 맵 로비 캐릭터가 지금 위치로 이어진다 (MAP-05·CONN-04 의 배포 경로) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 코드 경로(소켓 끊김 → 재접속 → snap 복원)는 존재하고 위 3 이 덮는다. 그러나 `deployhold` 흐름은 실행된 적이 없다: 배포 전 실행은 setup 에서 실패(당시 배포본에 맵·훅 없음), 대체 탐침은 6분 동안 띠가 한 번도 뜨지 않아(DO 하이버네이션이 소켓을 끊지 않음) 이 전이를 관찰하지 못했다. 06-PERF-RESULTS 가 스스로 "통과도 실패도 아닌 미확인"이라 적었고 결정 0057 도 같다. 위 `behavior_unverified_items` 참조 |
| 5 | SC3c: 보류했던 연결 계층 경고(WR-01~04)가 더는 나지 않고, 시작 이후 한 판은 v1.0 흐름 그대로 끝까지 돈다 (CONN-04) | ✓ VERIFIED | WR-01~04 는 v1.0 1페이즈 리뷰 항목으로 커밋 `9b89310`·`2b308f4`·`735ef3a`·`efdf811` 이 모두 존재하고 v2 HEAD 의 조상임을 확인. `useRoomConnection.test.tsx` "world 프레임 비간섭 (CONN-04)" 와 linkReducer 테스트가 통과. `.planning/DEFERRED-BUGS.md` 표는 비어 있고 처리 기록이 남았다. 시작 이후 흐름: worker 테스트(start·day·night·vote·endgame·leak)가 v1.0 규칙대로 통과하고, 게임 중에는 world 프레임이 가지 않음을 `world.test.ts` 가 고정. E2E 의 v1.0 게임 흐름 초록은 결정 0056(개정)의 승인 완화(G2·D2·P10·D9·D3b, v1.0 고정 테이블 + 6자 이상 이름) 아래에서 얻은 것이다. 완화는 사용자가 승인했고 범위가 단위 테스트로 고정되어 있으며 8~9페이즈에 지운다. 이 검증은 E2E 를 재실행하지 않았다 |
| 6 | SC4: 렌더 성능 게이트 — 3D 맵 + 3D 캐릭터 8명이 사용자 폰과 크롬 CPU 4배에서 5분 평균 55fps 이상, 끊김·발열·메모리 경고 없이 돌고 로비 조작이 3초 안에 반응하며 결과가 결정 기록에 남는다 | ✓ VERIFIED | 숫자와 판정이 실제로 존재한다. 조건 B(Chrome CPU 4×, 하드웨어 GL): talk·vote 5분 60.00fps·끊김 0·draw call 최대 66~67(≤120)·점광원 3, 반응 입장→조작 760ms(≤3000)·탭→링 2.1ms·출발 66ms. 조건 A(iPhone 16 Pro, iOS용 Chrome): vote 5분 59.98fps·끊김 1·열감 "차갑다". 원자료 스크린샷 `perf/iphone-1-vote5.png` 를 직접 열어 평균 fps 60.0·끊김 1·프레임 17,993·calls 57(최대 69)·빌드 `…+350b7fb` 가 06-PERF-RESULTS 와 일치함을 확인. 기준은 낮추지 않았고 결정 0057(채택, 판정 a, 사다리 0단계)에 기록됨. `DEFAULT_BUDGET_STEP = 0`·`DRAW_CALL_BUDGET = 120` 코드 확인. 한계: 폰 측정은 vote 한 조합과 iOS용 Chrome(Safari 아님)뿐이고, 폰의 LTE 입장 3초·talk·WebGL 복구는 사용자가 건너뛰어 자동 측정으로 갈음됐다. 이 판정은 고사양 폰 한 대에 근거하며 저사양 보증이 아니다(결정 0057 이 스스로 명시). 사용자가 판정을 직접 골랐으므로 목표("숫자로 확인")는 충족으로 본다. 건너뛴 항목은 human_verification 에 남긴다 |
| 7 | MAP-07: 닉네임 1~8자, 머리 위 이름표는 8자에서도 말줄임하지 않고, 테스트 봇 이름은 8자 | ✓ VERIFIED | `shared/nickname.ts` `NICKNAME_MAX_GRAPHEMES = 8`(그래핌 기준), 스키마 상한은 UTF-16 256(WR-03 수정 7e71d9c, 초과 시 `NICKNAME_INVALID`). `BOT_NAMES` 7개가 모두 8자("봇가나다라마바사" 등). 이름표 코드(`HeadStack`)에 `ellipsis` 없음(`src` 전체에서 검색 결과 없음). 8자 이름표가 로컬 8인 캡처에서 말줄임 없이 표시됨. 이모지 8자 내 이름표 202.4px 가 `NAMETAG_MAX_W` 180 을 넘는 것은 사용자가 일단 허용(2026-11-01) |

**Score:** 6/7 truths verified (1 present, behavior-unverified)

### Required Artifacts

`verify.artifacts` 를 21개 PLAN 전부에 돌린 결과 모든 plan 의 artifact 가 존재·충분(passed = total)이다.

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `scripts/deploy-target.mjs`, `scripts/check-deploy-target.mjs`, `scripts/deploy.mjs` | 배포 대상 단일 출처·산출물 검사·추가 인자 거부 | ✓ VERIFIED | 실제 로직, 267 스크립트 테스트 통과 |
| `shared/game/map.ts` (466줄), `shared/game/world.ts` (308줄) | 이동 격자·경로·구간 규칙 | ✓ VERIFIED | `positionAt`·`requestMove`·`snapFrame`·`restoreWorld` 등 구현, 서버·클라이언트가 공유 |
| `worker/room.ts` | move·snap·저장·복원·봇 배회 | ✓ VERIFIED | `applyMove`·`emitWorld`·`flushWorld` 연결, world.test.ts 통과 |
| `src/world/runtime.ts` (861줄), `store.ts`, `camera.ts`, `threeRenderer.ts`, `character.ts` (902줄) | 월드 런타임·스토어·카메라·three 렌더러·3D 캐릭터 | ✓ VERIFIED | 스텁 아님. 렌더러는 동적 import 로만 열리고 `dist/client` 초기 번들에 `WebGLRenderer` 없음(REVIEW-FIX 빌드 확인) |
| `src/components/WorldStage.tsx`, `src/screens/Lobby.tsx`, `src/screens/RoomScreen.tsx` | 로비 맵 화면 | ✓ VERIFIED | `Lobby → WorldStage → runtime`, `RoomScreen → store.applyFrame` 연결 확인 |
| `.planning/phases/06-world-skeleton/06-PERF-RESULTS.md`, `docs/decisions/0057-v2-render-gate.md` | 측정 숫자와 판정 기록 | ✓ VERIFIED | 존재, 내용이 원자료 스크린샷과 일치 |

### Key Link Verification

`verify.key-links` 는 21개 PLAN 중 다수가 `from:` 에 파일 경로가 아닌 설명을 써서 도구가 해석하지 못했다(도구 형식 문제이지 연결 끊김이 아니다). 핵심 연결을 직접 확인했다.

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `package.json` scripts.deploy | `check-deploy-target.mjs`·`deploy.mjs` | 체인 | WIRED | `check-account && vite build && check-deploy-target && deploy.mjs` |
| `worker/room.ts` `applyMove` | `shared/game/world.ts` `requestMove` | import | WIRED | `room.ts:28` import, `:876` 호출 |
| `worker/room.ts` 접속 | `snapFrame` | hello 후 전송 | WIRED | `:779`, lobby 단계 한정 |
| `useRoomConnection` world 프레임 | `WorldStore.applyFrame` | `onEvent` | WIRED | `RoomScreen.tsx:131-134`, epoch 메타와 함께 |
| `WorldStage` 탭 | `connection.send({t:"move"})` | `onTap` | WIRED | 정수 좌표 둘만 전송, 실패 시 `cancelMove` |
| `runtime` | `store.positionOf` / `positionAt` | 매 프레임 | WIRED | `runtime.ts:459,660,843` |
| `Lobby` | `WorldStage` | JSX | WIRED | `Lobby.tsx:140` |
| e2e `resolveTarget` | `assertNotV1` | import | WIRED | `lib.mjs:3,183` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `WorldStage` 이름표 | `view.players[].nickname` | 서버 state → `useRoomConnection` view | 예 | ✓ FLOWING |
| `runtime` 캐릭터 위치 | `store.positionOf(seat)` | 서버 world.move/snap 프레임 | 예(서버 `requestMove` 결과) | ✓ FLOWING |
| 재접속 위치 | `snapFrame(world)` | storage `world` 키 → `restoreWorld` | 예(worker 퇴거 복원 테스트) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 전체 단위·클라이언트·worker 테스트 | `npx vitest run` | 137 파일 통과, 3710 통과·1 건너뜀, exit 0 | ✓ PASS |
| 타입 검사 | `npm run typecheck` | exit 0 | ✓ PASS |
| 스크립트 테스트(배포 가드·e2e lib) | `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs` | 267 통과 | ✓ PASS |
| 이동·저장·복원·퇴거 후 snap 동일 | `test/worker/world.test.ts` (전체 실행에 포함) | 통과 | ✓ PASS |
| 서버를 띄우는 E2E(world·reconnect·perfbudget·deployhold) | — | 서버를 띄우지 않는 제약으로 실행하지 않음. SUMMARY·06-PERF-RESULTS 기록을 근거로 사용 | ? SKIP |

### Probe Execution

해당 없음(이 페이즈는 `probe-*.sh` 를 선언하지 않았고 `scripts/*/tests/probe-*.sh` 도 없다).

### Requirements Coverage

21개 PLAN frontmatter 의 requirements 를 합치면 7개 ID 모두 최소 하나의 PLAN 이 주장한다. REQUIREMENTS.md 의 Phase 6 매핑(DEPLOY-02, MAP-01, MAP-02, MAP-03, MAP-05, MAP-07, CONN-04)과 일치하고 고아 요구사항은 없다. MAP-04(8페이즈)·MAP-06(11페이즈)는 이 페이즈 소관이 아니다.

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| DEPLOY-02 | 06-01, 06-07, 06-19, 06-20 | v2 는 다른 Worker 에 배포, 스크립트가 v1.0 을 덮어쓰거나 검사하지 않음 | ✓ SATISFIED | 진실 1. v1.0 무변경은 기록값 근거 |
| MAP-01 | 06-02·04·08·10~21 | 로비 맵에서 서로의 캐릭터와 닉네임을 봄 | ✓ SATISFIED | 진실 2. 실기기 8명 읽힘은 human_verification |
| MAP-02 | 06-02·05·08·11·13·14·17·19·20 | 탭하면 걷고 다른 폰에도 같은 경로·속도 | ✓ SATISFIED | 진실 2 |
| MAP-03 | 06-03·10·13·14·17·19·20 | 맵이 한 화면보다 넓고 카메라가 따름 | ✓ SATISFIED | 진실 2 |
| MAP-05 | 06-03·05·08·09·13·15·18·19 | 껐다 켜기·재접속에도 위치 이어짐 | ✓ SATISFIED (배포 경로는 미확인) | 진실 3·4. 요구사항 문구(껐다 켜기·재접속)는 충족, 배포 경로만 미확인 |
| MAP-07 | 06-06·12·13·17 | 닉네임 1~8자, 8자 말줄임 없음, 봇 이름 8자 | ✓ SATISFIED | 진실 7 |
| CONN-04 | 06-09·15·18·19 | 연결 계층 경고 WR-01~04 수정 | ✓ SATISFIED | 진실 5. 요구사항 문구는 충족. HANDOFF 가 "배포 경로 미확인인 채 완료 표시"라고 판단을 맡긴 부분은 판단 결과 "요구사항 자체는 충족, 배포 경로는 SC3b 로 분리해 미확인으로 남긴다" |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| 이 페이즈가 바꾼 `src/world`·`worker/room.ts`·`shared/game/world.ts`·`map.ts`·`scripts/deploy*.mjs`·`WorldStage`·`RoomScreen`·`Lobby` | — | `TBD`/`FIXME`/`XXX` | — | 없음(grep 결과 0건) |
| `src/world/store.ts` | 48-56 | `WorldStore.reset()` 호출처 없음(IN-04, 열림) | ℹ️ Info | epoch 규칙이 틀린 위치를 막아 무해 |
| `worker/room.ts` | 309-314, 687-691 | 방 삭제 중 고아 `world` 키 가능성(IN-02, 열림) | ℹ️ Info | 무해, 기록만 |
| `src/world/threeRenderer.ts` | 63-102 | `build()` 중간 실패 시 GL 컨텍스트 정리 누락(IN-05, 열림) | ℹ️ Info | 낮은 확률 |
| `scripts/check-deploy-target.mjs` | 3-5 | 헤더 주석이 실제 동작과 다름(IN-01, 열림) | ℹ️ Info | 사용자가 기록만 하기로 결정 |
| 로비 | — | "preloaded but not used" 콘솔 경고 17개(deferred-items.md) | ⚠️ Warning | v1.0 기존 동작, E2E `CONSOLE_ALLOW` 에 이유와 함께 허용. 목표를 막지 않음 |

IN-01~06(06-REVIEW-DISPOSITION)은 사용자가 기록만 남기기로 결정한 항목이고 이 페이즈 목표를 막지 않는다. 치명 1·경고 5는 모두 수정 커밋이 있고(a9707d9·60fa788·a50547b·7e71d9c·167f62a·2f0974d) 수정 후 전체 테스트가 초록이다. 단, 이 6건은 배포본에 없다.

### 보조 산출물 확인

| 산출물 | 내용 | 평가 |
| ------ | ---- | ---- |
| `06-SECURITY.md` | `threats_open: 0`, ASVS L1 | 존재 확인(내용은 재감사하지 않음) |
| `06-UI-REVIEW.md` | 18/24, 경고 3개 우선순위(이름표 겹침·작은 폰 알림 충돌·빈 구도) | ⚠️ 경고. MAP-01 의 "닉네임이 보인다"를 8명에서 위협. 차단은 아님 |
| `06-VALIDATION.md` | `nyquist_compliant: true`, `validated` | 존재 확인 |

### Human Verification Required

#### 1. 배포를 가로지르는 맵 로비 위치 이어짐 (deployhold)

**Test:** 맵 로비에 두 페이지를 붙여 두고 다음 v2 배포(변경 없는 재배포 가능, 사용자 허락 필요) 중·후에 `npm run e2e -- --only deployhold` 를 돌린다
**Expected:** 띠가 뜨면 사라지고 걷던 캐릭터를 포함해 모든 캐릭터가 이어진 위치에 있으며 콘솔 경고·오류 0
**Why human:** 배포가 필요하다. 이 검증은 배포하지 않았다. 지난 배포는 소켓을 끊지 않아 전이가 관찰되지 않았다

#### 2. 코드 리뷰 수정 배포 후 배포본 재확인

**Test:** 수정 6건을 배포한 뒤 `npm run e2e -- --only world --sizes 390x664`, `node scripts/smoke.mjs --prod`
**Expected:** world 20/20, smoke OK, 탭 간격 250ms 로 거짓 "연결 불안정" 알림이 없음
**Why human:** 배포가 필요하다. 지금 배포본은 수정 전 빌드다

#### 3. WR-02 상태 전이 변경의 실기기 확인

**Test:** iPhone 에서 화면 잠금 30초·카카오톡 전환·카메라 앱 뒤 복귀
**Expected:** 5초 안에 장면 복구 또는 실패 카드, 흰·검은 화면 없음
**Why human:** 기존 테스트 기대를 바꾼 전이 변경이며 실기기 WebGL 복구 3종이 건너뛰어졌다

#### 4. 8명 읽힘과 가장자리 이름표

**Test:** 실제 폰(360폭 포함)에서 8명이 모인 로비의 이름표
**Expected:** 맨 앞 이름표가 모두 읽히고 가장자리에서 잘리지 않음
**Why human:** UI 감사 경고. 202px 이모지 이름표는 사용자가 일단 허용했지만 실기기 8명 읽힘은 미확인

#### 5. 실제 폰 두 대 이상의 로비

**Test:** 두 폰이 같은 방 로비에서 서로를 보고 탭 이동이 같은 경로로 보이는지
**Expected:** 보임, 같은 경로·속도, 지연 없음
**Why human:** iPhone 두 기기 확인이 건너뛰어졌고 E2E 두 페이지 시험으로 갈음됨

### Gaps Summary

목표를 막는 격차(gap)는 없다. 코드는 실제로 존재하고 연결되어 있으며 자동 검사가 모두 초록이다. 렌더 게이트 숫자는 원자료로 확인했고 결정 0057 이 기록됐다.

사람이 판단해야 할 것은 다섯 가지다. 가장 중요한 것은 배포 경로 위치 이어짐이 한 번도 실행되지 않았다는 점이고, 두 번째는 리뷰 수정 6건이 배포본에 아직 없다는 점이다. 나머지는 사용자가 건너뛴 iPhone 항목들(결정 0057 이 9페이즈 팀 테스트로 이월)이다.

참고: 06-PERF-RESULTS 와 결정 0057 이 이월을 명시해 두어 이 항목들은 숨겨지지 않았다. ROADMAP.md 의 Phase 6 체크박스는 아직 `[ ]` 이므로 사람 확인 결과에 따라 오케스트레이터가 갱신하면 된다.

---

_Verified: 2026-11-01_
_Verifier: Claude (gsd-verifier)_
