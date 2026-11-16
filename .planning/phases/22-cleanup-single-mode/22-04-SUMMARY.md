---
phase: 22-cleanup-single-mode
plan: "04"
subsystem: cause-flow-removal
tags: [cleanup, cause-flow, lamps, scene, skip, suspect-board, night-house-pick, legacy-room, e2e]
requires: [22-03]
provides:
  - "Ruleset 에 cause 필드·CAUSE_MODES 가 없다. nextPhaseOf 는 PHASE_DEFS.next 만 따르고(낮 시작 발표 → errand 분기 하나만 남음), afterDayOf() 는 인자 없이 늘 night (22-09 의 찬반 부결이 이 함수를 쓴다)"
  - "shared/game/{lamps,scene,skip}.ts, skip·inspect 메시지·스키마, errand 메시지의 hold, view 키(day.lamps·day.scene·day.skipCount·me.scene·me.skip), Player.{skipVote,errandCut,sceneSeen}, RoomState.{lamps,scene}, MapDef.{lamps,clueSpots,houseFronts}, houseHome 삭제"
  - "captureHomeNow 는 captureHome(토론이 끝난 자리) 하나만 쓴다 — 흰 분필 윤곽은 그대로(D-06)"
  - "isLegacyV3Room 표시에 lamps·scene(방 키)·skipVote·errandCut·sceneSeen(개인 키) 추가 — 대기실로 되돌림(T-22-06)"
  - "화면: 집 문패·단서 지점·단서 카드·[건너뛰기]·의심 보드·등불 켜기·길게 누르기·아침 큰 글 발표 구간 삭제, 밤은 모든 역할이 얼굴 목록(D-05)"
  - "시험 도우미 lockCause·openCause·lockCauseInFile·underCauseLock 은 no-op 껍데기(22-08 이 호출부와 함께 삭제)"
affects: [22-05, 22-06, 22-07, 22-08, 22-09, 22-14]
key-files:
  deleted:
    - shared/game/lamps.ts
    - shared/game/scene.ts
    - shared/game/skip.ts
    - "src/game/{boardView,houseView,lampView,sceneView,sceneText}.ts"
    - "src/components/v2/{ClueCard,ClueSpot,HouseTag,SkipPill,SuspectBoard}.tsx"
    - src/net/useMorningAnnouncing.ts
    - scripts/e2e/cause.mjs
    - "시험 27개(worker 8·unit 10·client 9)"
  modified:
    - shared/game/{ruleset,phases,tick,night,execution,discussion,errand,map,mapTown,room,view,audience,gather,movement,nomination,runoff,showdown,world}.ts
    - shared/protocol.ts
    - shared/schemas.ts
    - worker/room.ts
    - src/screens/{GameMap,GamePanel,RoomScreen,RoleReveal}.tsx
    - src/components/{WorldStage,RoleCard,RoleCardSheet}.tsx
    - src/components/v2/{ErrandAct,ErrandStartCard}.tsx
    - src/game/{hostLine,dayView,errandView,nightDark,roleText,scenes,timeOfDay}.ts
    - src/world/{presence,runtime,testHooks}.ts
    - src/styles/{v2,game}.css
    - scripts/e2e/{flows,lib,browser,town}.mjs, scripts/e2e/lib.test.mjs
    - scripts/{smoke,uat-test-room,perf-run}.mjs, scripts/smoke.test.mjs
    - test/helpers/playable.ts, test/unit/legacyRoom.test.ts
decisions:
  - "원인 흐름 지운 뒤 확장판은 옛 순서(dayAnnounce → errand → discussion, 처형·0표 뒤 night)로 돈다. 판 종류 기본값은 아직 extended 이고 22-07 이 하나로 만든다."
  - "errand 메시지의 hold(길게 누르기)와 ErrandAct 의 길게 누르기 제스처도 심지 자르기 기능이라 함께 지웠다 — 스키마는 { t: 'errand' } strict 라 옛 클라이언트의 hold 는 BAD_MESSAGE 로 거절된다."
  - "enterNight 는 인자를 받지 않는다(심부름 키 유지 분기가 원인 흐름 전용이었다). enterMorning 의 rules 는 trace·witness 때문에 남는다."
  - "canMoveIn 은 (단계, 생존) 두 인자, nearPhaseOf 는 errand 만 근처 단계다."
  - "E2E 단계 그래프 사본 CAUSE_PHASE_GRAPHS 를 PHASE_GRAPHS 로 이름을 바꾸고 extended 를 옛 확장판 순서로 되돌렸다. smoke·uat-test-room 의 확장판 표도 같다(22-08 이 판 종류째 지운다)."
  - "마을 3D 가로등 기둥 좌표(TOWN_LAMPS)·렌더러 setLamps·팔레트 houseLit·개관 카메라 기저는 마을 렌더러 부품이라 이 계획에서 건드리지 않고 22-05 가 마을째 지운다."
metrics:
  tasks: 3
  duration: 약 2시간
status: complete
actuals:
  tokens: 174000
  tasks: 3
  commits: 3
plan_head_before: 782b422fcd606f7cf6232d81ea99ee4760f47a63
plan_head_after: e0c91fa082beb8013d1bf4d5620b72b799077f33
commits: 3
---

# Phase 22 Plan 04: 원인 흐름 판 삭제 Summary

원인→결과 하루 순서·등불(심지 자르기)·밤 집 고르기·아침 현장 조사·건너뛰기·의심 보드를 서버·와이어·화면·시험·E2E 에서 지우고, 확장판을 옛 순서로 되돌렸으며, 흰 분필 윤곽은 토론이 끝난 자리(captureHome)로 남겼다(결정 0089-13, D-04·D-05·D-06). 변경 119개 파일, +401 −10406 줄(.planning 제외).

## 한 일

**Task 1 — 서버·와이어 (`e50e0f16`)**
- `lamps.ts`·`scene.ts`·`skip.ts` 삭제. `Ruleset.cause`·`CAUSE_MODES`·`RULES_NO_CAUSE` 삭제(rulesetOf 는 판마다 얼린 객체 하나).
- `phases.ts`: nextPhaseOf 의 cause 분기 삭제, `afterDayOf(): PhaseId`(늘 night — nomination·runoff·showdown 호출 인자 삭제), `MORNING_SCENE_MS`·`SKIP_MIN_GAP_MS` 삭제. `discussion.ts` morningMsOf·`execution.ts` noExecutionOf 의 원인 분기, `tick.ts` 훅 표의 errand·morning 원인 줄과 `clearSkip`, `night.ts` enterNight 의 등불 켜짐·enterMorning 의 buildScene·sceneSeen, `errand.ts` 의 withCut·hold·errandCut·lamps 키, `gather.ts` 의 토론 `:board` 배치 키, `movement.ts` 의 아침 걷기·nearPhaseOf 의 원인 아침 삭제.
- `view.ts`·`protocol.ts`·`schemas.ts`·`room.ts`: 지운 view 키·메시지·상태 키·`SceneState`·`SPOT_IDS`·`ClueLine` 삭제. WR-03 의 아침 표본 시각 보충(needsMorningTick)도 원인 아침 전용이라 삭제. `MapDef.lamps`·`clueSpots`·`houseFronts`, `mapTown.ts` 의 짝집 표·단서 지점 24점, `world.ts` 의 houseHome 삭제.
- `worker/room.ts`: skip·inspect 핸들러, errand hold, captureHomeNow 의 houseHome 분기, 아침 표본 분기 삭제.
- 옛 방 표시: `LEGACY_V3_ROOM_KEYS` += lamps·scene, `LEGACY_V3_PLAYER_KEYS` += skipVote·errandCut·sceneSeen. `legacyRoom.test.ts` 에 4건(등불 키 판 중 방 → 대기실, 현장 키 → 대기실, 개인 키 셋 각각 → 대기실, 대기실 방의 현장·등불 키는 지워지고 나머지는 그대로).
- 시험 도우미 `playable.ts` 를 no-op 껍데기로, `test/worker/helpers.ts` 의 `startedGame` 은 늘 dayAnnounce 로 들어간다. 서버 원인 흐름 시험 8개 삭제(워커 tsc 를 이 태스크에서 닫으려고 Task 3 의 A 목록 일부를 앞당김).

**Task 2 — 화면 (`67065d20`)**
- 부품·뷰 모듈 10개와 `useMorningAnnouncing` 삭제. `GameMap`(보드 단추·카드, 집 문패 층, 단서 층, 길게 누르기, 건너뛰기 칸), `GamePanel`(`SkipSlot`, 집 문패 밤 분기), `RoomScreen`(PHASE_ANNOUNCE 의 등불 제목, 띠 로컬 상태의 announcing), `WorldStage`(clues·houses 층과 쓰기 함수, callPlaces·actLook·hold) 정리. 밤은 모든 역할이 같은 얼굴 목록(D-05).
- `hostLine.ts`: 키 `errand.lamp.*`·`scene.*`·`night.*.house`·`discussion.board` 와 `causeOf`·`seenSpotsOf`, `CallTarget` 의 places·houses·spots, `CallTool` 의 inspect, 처형 → 저녁 알림음 예외 삭제. `dayView.ts` 의 `causeTitles`·원인 아침 큰 글·원인 밤 제목, `scenes.ts`·`timeOfDay.ts`·`presence.ts` 의 저녁 조명, `nightDark.ts`·`roleText.ts`(roleHintOf)·`RoleCard`·`RoleCardSheet`·`RoleReveal`(심지 안내 줄) 정리.
- `runtime.ts`·`testHooks.ts`: 가로등·집 창 켜짐 보내기(sendLamps)와 `__mfTown` 의 houseLit·lampLit 삭제. `v2.css`·`game.css`: 문패·단서·건너뛰기·보드·층 선택자 블록 삭제.

**Task 3 — 시험·E2E (`e0c91fa0`)**
- E2E: `cause.mjs`(삭제는 `67065d20` 에 함께 들어감)·flows 의 cause-* 흐름 여섯 등록·import, `lib.mjs` 의 원인 흐름 판정 구역(약 510줄)·errandChecks 의 lamp 프로필, `browser.mjs` 의 읽기·조작 도우미, `lib.test.mjs` 의 원인 흐름 시험 삭제. `smoke.mjs`·`uat-test-room.mjs`·`smoke.test.mjs` 의 확장판 전이 표·첫날 사슬을 옛 순서로, `perf-run.mjs`·`town.mjs` 의 집 문패·보드 조작 삭제.
- 워커 시험 `modeBasic`·`modePick` 의 확장판 첫 단계 기대(역할 확인 → 낮 시작 발표 → 심부름), `leak.test.ts` 의 서버 전용 이름 목록에서 지운 키 6개 제거(T-22-07).

## 시험 분류 표

| 분류 | 파일 | 처리 |
| --- | --- | --- |
| A 삭제 (27) | worker: causeFlow·causeBots·causeLeak·causeMove·causeSkip·lampErrand·lampLeak·sceneLeak / unit: dayFlow·causeMove·lamps·lampErrand·lampView·scene·sceneView·skip·boardView·houseView / client: houseTag·nightHouse·morningScene·lampEvening·lampParts·clueParts·suspectBoard·boardDiscussion·skipPill | 파일째 삭제(머리 주석으로 원인 흐름 전용 확인) |
| A 부분 삭제 | ruleset("원인 흐름 플래그" 묶음)·tick("확장판 원인 흐름의 단계 연쇄")·gameMode(원인 흐름 갈래 C 시험 6건·WR-03 묶음)·timeOfDay·scenes·lighting("원인 흐름 밤·저녁 조명")·camera("원인 흐름 마을 밤은 개관")·errandView("원인 흐름 마을은 가로등 중심")·hostLine("원인 흐름 사회자 줄")·mapTown(단서 지점·짝집 묶음)·worldStage(아침 현장 층·집 문패 층·가로등 setLamps)·gameMap·roleCardSheet·schemas(skip·inspect·errand hold → "거부한다"로 바꿈)·soundProtocol(메시지 목록)·e2eContract(원인 흐름 사본 계약 묶음) | 해당 묶음만 삭제 |
| B 사슬 수정 | nyquist-03.1-multiday(두 흐름 반복 → 옛 흐름 하나)·nyquist-04-multiday-flow(처형 뒤 errand → night)·gameMode(동점 뒤 errand → night)·dayView·movement(canMoveIn 인자 수)·e2eContract(전이 표 기대)·modeBasic·modePick·worker/helpers.ts(startedGame) | 옛 순서 기준으로 기대값만 고침 |
| C 그대로 | lockCause*·underCauseLock·openCause 를 import 하던 약 107개 시험 파일(호출부) | 껍데기 아래 그대로 통과 — 호출부 제거는 22-08 |
| 신규 | legacyRoom.test 4건 | 위 "옛 방 표시" |

## 검증 결과 (모두 실제 실행)

| 명령 | 결과 |
| --- | --- |
| Task 1 verify: `npx vitest run test/unit/{legacyRoom,ruleset,phases,tick}.test.ts test/worker/morningCards.test.ts` + `npx tsc -p tsconfig.worker.json --noEmit` | 76 통과·4 건너뜀 / tsc 오류 0 |
| Task 2 verify: `npm run typecheck` + `npx vitest run test/unit/{hostLine,dayView,scenes,timeOfDay}.test.ts` | 종료 0 / 통과 |
| Task 3 verify(끝 상태): `npx vitest run`(전체) | 273 파일 8255 통과·262 건너뜀·실패 0 |
| `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` | pass 662 / fail 0 (22-03 의 682 에서 원인 흐름 판정·등불 프로필 시험 20건이 빠짐) |
| `npm run typecheck`(tokens·placeart·wrangler types·app·worker) | 종료 0 |
| 분필 윤곽: `morningCards`·`night` 워커 시험 | 통과 |
| 수용 기준 | lamps·scene·skip 모듈 없음 / `grep -c cause shared/game/ruleset.ts` 0 / `afterDayOf([a-zA-Z]` 호출 0, `afterDayOf(): PhaseId` 1 / `houseHome` in worker/room.ts 0 / 도우미 4개 export 유지 / src 의 10개 모듈 0 / `data-(house-tag\|clue\|skip\|board)` src·scripts 0 / hostLine 의 `scene.`·`discussion.board`·`errand.lamp` 0 / `causeTitles` 0 / cause.mjs 없음 / flows 의 `cause-` 0 |

워커 전체 실행에서 부하 flake 는 이번에 나타나지 않았다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 서버 원인 흐름 시험 8개를 Task 1 에서 삭제**
- **Found during:** Task 1 verify (`tsc -p tsconfig.worker.json` 가 `TOWN_CLUE_SPOTS`·`SKIP_MIN_GAP_MS`·`ClueLine` 를 가져오는 시험에서 실패)
- **Fix:** Task 3 의 A 목록 중 워커 8개를 앞당겨 같은 커밋에서 삭제.

**2. [Rule 2 - 누락된 정리] errand 의 hold 와 길게 누르기 제스처를 함께 삭제**
- **Issue:** 계획 파일 목록에 없지만 심지 자르기(D-04)의 일부라 `protocol.ts`·`schemas.ts`·`errand.ts`(`actErrand` 인자)·`worker/room.ts`·`ErrandAct.tsx`(제스처)·`GameMap.tsx` 에 hold 가 남으면 죽은 기능이 된다.
- **Fix:** `{ t: "errand" }` strict 로 줄이고 `ErrandAct` 는 단순 클릭 단추로 만들었다. `ErrandStartCard` 의 `cause` 제목과 `RoleCard` 의 hint 프롭도 지웠다.

**3. [Rule 3 - Blocking] 계획 목록 밖 파일 수정**
- `scripts/smoke.mjs`·`scripts/smoke.test.mjs`·`scripts/uat-test-room.mjs`: e2eContract 가 두 전이 표를 `nextPhaseOf` 와 대조하고 smoke 의 확장판 첫날 사슬(저녁 → 밤)이 새 서버와 어긋나서 옛 순서로 되돌림. `scripts/perf-run.mjs`·`scripts/e2e/town.mjs`: 수용 기준(`scripts` 에 `data-house-tag`·`data-board` 0건)을 위해 집 문패·보드 조작 삭제. `shared/game/{audience,gather,movement,world,mapTown,map}.ts`·`src/world/{runtime,testHooks,presence}.ts`·`src/components/v2/{ErrandAct,ErrandStartCard}.tsx`·`RoleCard*`·`RoleReveal`: 지운 키·인자를 가리키던 곳.
- `scripts/e2e/cause.mjs` 삭제가 Task 3 가 아니라 Task 2 커밋(`67065d20`)에 들어갔다(앞서 `git rm` 으로 스테이징돼 있었음). 내용 영향 없음.

**4. [Rule 1 - 회귀 시험 정리] 옛 확장판 순서 기대의 일부 시험은 삭제 대신 기대값 수정**
- nyquist-03.1·04, gameMode, modeBasic, modePick 등(분류 B). 사유와 변경은 위 표.

## Deferred / 알려둘 것 (다음 계획이 받는다)

- **22-05(마을)**: `TOWN_LAMPS`(3D 가로등 기둥 좌표, `mapTown.test` 의 기둥 시험 포함)·렌더러 `setLamps`(`renderer.ts`·`threeRenderer.ts`·`maps/{town,plaza,types}.ts`)·팔레트 `TOWN_LIT.houseLit`·개관(overview) 카메라 기저와 `camera.ts` 의 `HOUSE_TAG_*`·`houseTagCenters`·`OVERVIEW_*` 는 마을 렌더러 부품이라 그대로 뒀다. `PLACE_IDS` 의 `lamp0~lamp7`·`placeArt`·`placeText` 의 가로등 별칭도 그렇다(장소 id 닫힌 집합은 22-05·22-06).
- **22-06(심부름)**: `scripts/e2e/errand.mjs` 는 원인 흐름 저녁(등불 켜기) 기준으로 쓰여 있어 지금 앱과 어긋난다(`profile: "lamp"` 는 lib 에서 지워 무시됨). E2E 는 이 계획에서 실행하지 않았고 errand 흐름은 22-06 이 흐름째 지운다. `V2Icon` 의 flame·flameOff·footprint·window 아이콘, `perf-run.mjs` 의 `NIGHTLOAD_DWELL_CAUSE`·`scripts/e2e/host.mjs`·`sound.mjs` 주석의 cause-* 언급도 이월.
- **22-07/22-08**: `scripts/smoke.mjs`·`uat-test-room.mjs` 의 `--mode`·판 종류별 표는 판 종류째 지운다. `test/helpers/playable.ts` 의 도우미 4개와 107개 시험 파일의 호출부는 22-08.
- **22-09**: `afterDayOf()` 한 함수가 처형 없는 낮의 다음 단계다(D-10).
- **22-14**: `docs/screen-map.md` 등 문서의 등불·현장·보드 설명은 손대지 않았다(결정 0090 에서 정리).
- 실기기·배포본·Playwright E2E 는 실행하지 않았다(UAT 는 끝에 몰아서 — 사용자 메모).

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크 경로·권한 경로를 만들지 않았고 와이어 입력만 줄었다(skip·inspect·errand hold 는 BAD_MESSAGE). 옛 방 읽기 경로는 T-22-06 의 표시 추가로 `legacyRoom.test.ts` 가 막고, 누설 시험의 서버 전용 이름 목록은 지운 키만큼 줄였다(T-22-07).

## Self-Check: PASSED

- 3개 커밋 모두 HEAD 의 조상: `e50e0f16`·`67065d20`·`e0c91fa0` (`git merge-base --is-ancestor`).
- 삭제 대상 파일(`shared/game/{lamps,scene,skip}.ts`, `scripts/e2e/cause.mjs`, src 부품 10개) 부재, `test/helpers/playable.ts` 도우미 4개 export 존재 확인.
- STATE.md·ROADMAP.md·state.json·milestone.lock·`Claude outputs/` 는 스테이징하지 않았다. 금지어 git grep 결과 0건.
