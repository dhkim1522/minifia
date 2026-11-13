---
phase: 20-map-expansion
verified: 2026-11-13T05:10:00Z
status: human_needed
score: 9/9 must-haves verified
covered_files:
  - ".planning/phases/20-map-expansion/20-01-PLAN.md"
  - ".planning/phases/20-map-expansion/20-01-SUMMARY.md"
  - ".planning/phases/20-map-expansion/20-02-PLAN.md"
  - ".planning/phases/20-map-expansion/20-02-SUMMARY.md"
  - ".planning/phases/20-map-expansion/20-03-PLAN.md"
  - ".planning/phases/20-map-expansion/20-03-SUMMARY.md"
  - ".planning/phases/20-map-expansion/20-04-PLAN.md"
  - ".planning/phases/20-map-expansion/20-04-SUMMARY.md"
  - ".planning/phases/20-map-expansion/20-05-PLAN.md"
  - ".planning/phases/20-map-expansion/20-05-SUMMARY.md"
  - ".planning/phases/20-map-expansion/20-06-PLAN.md"
  - ".planning/phases/20-map-expansion/20-06-SUMMARY.md"
  - ".planning/phases/20-map-expansion/20-07-PLAN.md"
  - ".planning/phases/20-map-expansion/20-07-SUMMARY.md"
  - ".planning/phases/20-map-expansion/20-08-PLAN.md"
  - ".planning/phases/20-map-expansion/20-08-SUMMARY.md"
  - ".planning/phases/20-map-expansion/20-09-PLAN.md"
  - ".planning/phases/20-map-expansion/20-09-SUMMARY.md"
  - ".planning/phases/20-map-expansion/20-10-PLAN.md"
  - ".planning/phases/20-map-expansion/20-10-SUMMARY.md"
  - "docs/decisions/0087-v3-town-map.md"
  - "scripts/e2e/town.mjs"
  - "shared/game/errand.ts"
  - "shared/game/map.ts"
  - "shared/game/mapTown.ts"
  - "shared/game/maps.ts"
  - "shared/game/world.ts"
  - "shared/game/zones.ts"
  - "shared/protocol.ts"
  - "src/world/cutaway.ts"
  - "src/world/maps/town.ts"
  - "src/world/runtime.ts"
  - "src/world/store.ts"
  - "test/worker/town.test.ts"
  - "test/worker/townDoor.test.ts"
  - "test/worker/townErrand.test.ts"
  - "test/worker/townLeak.test.ts"
  - "worker/room.ts"
covered_digest: "v4:sha256:d74644733c13def2590ec964dfc5a177dc26a1232c444b660ef8eaf21a753cab"
behavior_unverified: 0
overrides_applied: 0
advisory:
  - finding: "브라우저 E2E(마을 흐름 다섯 TM1~TM10, 폰 6종 전 흐름 회귀)는 이 검증에서 다시 돌리지 않았다"
    category: other
    reason: "값은 20-08·20-10 SUMMARY 의 것이다(요약 근거). 같은 계약의 서버·클라이언트·장면 시험과 E2E 판정 함수 시험(e2eContract)은 이 검증에서 직접 돌려 통과했다"
    evidence_status: "요약 근거(직접 재실행 없음)"
  - finding: "perfbudget B2(점광원 4 > 3)·M1(지오메트리 35 > 25) 3건이 E2E 실패 줄로 남아 있다"
    category: other
    reason: "13페이즈부터 이어진 알려진 한계(결정 0087). 20페이즈가 만든 것이 아니다. 마을 nightload 의 점광원은 3 이다"
    evidence_status: "요약 근거"
  - finding: "E2E 간헐 실패: town-walk TM9(한 묶음에 폰 6종 흐름을 몰아 돌린 한 번, 세 크기에서 10초 한도 초과)와 politics-verdict 360x640 VT1(233ms). 단독 재실행은 모두 통과"
    category: other
    reason: "부하 간헐로 판단(앱 결함 증거 없음, 문턱 불변). 20-10 SUMMARY 에 기록됐고 결정 0087 에도 적혔다"
    evidence_status: "요약 근거"
  - finding: "결정 0087 '알려진 한계': 360×560 접힌 줄과 알림 겹침, 좌석 0·7 집의 문 앞 자리(문에서 약 1.3 떨어진 칸), 닫힌 방 안 암살의 분필이 밖에서 안 보임(P20-18), 밤·아침 순간이동에는 문 연출 없음, 말·채팅·감정표현은 구역과 무관(벽을 넘음), 이름표가 지붕 위에 겹칠 수 있음"
    category: other
    reason: "모두 결정 기록에 적힌 의도된 한계이거나 21페이즈로 넘긴 것이다. 채팅이 벽을 넘는 것은 D-16 이 정한 범위다(좌표가 아닌 글)"
    evidence_status: "결정 0087 + townLeak 시험이 채팅 구역 무관을 고정"
  - finding: "nightload 성능 근거는 헤드리스 소프트웨어 GL·CPU 4배 감속이다(rAF 60Hz 로 맞춰 돈다). 폰 GPU 채움·발열·셰이더 컴파일 끊김은 못 본다"
    category: other
    reason: "마을(59.8fps)이 광장 대조(59.7fps)와 같은 환경에서 거의 같아 '광장보다 무겁지 않다'는 비교는 유효하다. 절대값 해석에는 한계가 있어 실기기 항목으로 남긴다"
    evidence_status: "perf/nightload-390x844-x4-town.json 직접 확인"
  - finding: "test/worker 의 forceDue·editRoom·armBots 등에 위치 저장 타이머와 evict 가 겹칠 수 있는 낮은 확률의 간헐 후보가 남아 있다(deferred-items.md)"
    category: other
    reason: "관찰한 3건은 20-03 이 시험 쪽에서 고쳤고 서버 코드와 무관하다. 이 검증의 전체 시험 1회는 실패 0 이었다"
    evidence_status: "전체 npm test 1회 8569 통과·실패 0"
human_verification:
  - test: "폰 실기기(저사양 포함)에서 마을 맵으로 한 판을 끝까지 돌린다(지목·변론·찬반·처형 장면과 밤 포함)"
    expected: "끊김·발열이 진행에 지장 없고, 방·집·시계탑·사람 8명이 같이 보이는 최악 장면(그리기 호출 82)에서도 부드럽다"
    why_human: "성능 근거가 헤드리스 소프트웨어 GL 이라 폰 GPU 채움·발열·셰이더 컴파일 끊김을 볼 수 없다(사용자 방침: v3.0 끝 실테스트)"
  - test: "밤 조명에서 방 간판 그림(봉투·잔·십자·방패)과 집 문패(좌석 색 + 얼굴)가 읽히는지, 간판 뒤로 사람이 가려지는 느낌이 어떤지 본다"
    expected: "간판과 문패가 한눈에 읽히고, 지붕 위로 이름표가 겹쳐도 누가 누군지 알 수 있다"
    why_human: "시각 품질. 이름표는 DOM 층이라 3D 깊이를 몰라 지붕 위에 겹칠 수 있다(알려진 한계)"
  - test: "폰에서 방 지붕을 눌러 문 앞으로 가고 한 번 더 눌러 들어가기, 안에서 나오기, 밖에서 누가 문으로 들어가는 것(0.2초 옅어짐)을 본다"
    expected: "조작이 자연스럽고 안과 밖 사람이 서로 보이지 않으며, 문 연출이 어색하지 않다"
    why_human: "조작감·연출 체감. 술집·진료소는 문이 카메라 반대쪽이라 문 앞에서 한 번 더 눌러야 하는 방식(결정 0087)이 사용자 눈에 괜찮은지 확인 필요"
  - test: "마을 배치(시안 A: 방은 네 변 가운데, 집은 모서리에 둘씩)가 마음에 드는지 확인한다"
    expected: "사용자가 채택을 확인하거나 한 줄로 바꿀 곳을 말한다"
    why_human: "시안은 사용자 사전 위임('추천안 바로 구현')으로 채택됐고 사용자가 돌아와 바꿀 수 있다고 CONTEXT 에 적혀 있다 — 명시적 사후 확인은 아직 없다"
---

# Phase 20: 맵 단계 확장: 실내 방 넷과 집 여덟 Verification Report

**Phase Goal:** 광장 가장자리에 실내 방 4곳과 좌석마다 집 1채(최대 8)를 더해 벽으로 시야가 나뉘는 맵을 만든다. 실내에 있는 사람은 같은 방 사람만 보고 밖에서는 안의 사람이 보이지 않는다(서버가 보이지 않는 사람의 좌표를 보내지 않는다). 21페이즈가 이 맵 위에서 돈다.
**Verified:** 2026-11-13T05:10:00Z
**Status:** human_needed — 코드·시험으로 확인되는 must-have 는 모두 통과했고, 남은 것은 실기기 눈 확인뿐이다(사용자 방침: v3.0 끝 실테스트).
**Re-verification:** No — initial verification

배포본 확인: `curl /api/health` → `2026-11-13T03:30:33Z+07d6afee`. `git diff --stat 07d6afee HEAD -- src public worker shared scripts test` 는 비어 있다(그 뒤 커밋은 문서·ROADMAP·STATE·HANDOFF 뿐). 배포본이 검증한 코드와 같다.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: 광장 가장자리 문 4개로 실내 방 4곳(우체국·술집·진료소·경찰서)에 들어가고, 들어가면 지붕과 앞벽이 걷힌다(장면 전환 없음, 좌표 하나) | ✓ VERIFIED | `shared/game/mapTown.ts` 의 `TOWN_ROOMS`(4곳, post·pub·clinic·police)·`TOWN_MAP`(48×48, origin −12, walkHalf 10, rooms 등록). 서버가 방 안 자리로 걷기 요청 시 문을 지나는 길을 정함(`town.test.ts` 통과). 클라이언트는 같은 맵 안 좌표 하나로 `cutawayOf(zone, all)`(`src/world/cutaway.ts`)이 내 구역 지붕·앞벽을 걷음, `runtime.ts` 가 `onTown`·`roofs` 를 내보냄, `threeRenderer.ts` 가 `opts.mapId === "town"` 이면 `buildTownScene` 사용. `townScene.test.ts`·`cutaway.test.ts`·`worldStage.test.tsx` 통과. 브라우저 TM2·TM3·TM6·TM10 은 요약 근거(20-08·20-10) |
| 2 | SC2: 실내 사람은 같은 방 사람만 보고, 밖에서는 안의 사람이 보이지 않는다(서버가 좌표를 보내지 않음) | ✓ VERIFIED | 아래 "누설 경로 전수" 표 — 좌표가 실리는 모든 경로가 구역으로 걸러진다. `townLeak.test.ts`(심부름부터 아침까지 한 판, 모든 소켓이 받은 모든 world 프레임을 판정)·`townDoor.test.ts`·`townErrand.test.ts`·`town.test.ts` 통과(직접 실행) |
| 3 | SC3: 광장 둘레에 좌석 수만큼 집이 있고 지붕·문패에 주인 얼굴이 보인다 | ✓ VERIFIED | `TOWN_HOUSES` 8채(좌석 0~7, 시안 README 좌표), `src/world/maps/town.ts` 의 `setOwners`·문패/표식 아틀라스 `drawSeatCell`·`faceSrc`(같은 출처 정적 파일만), `runtime.ts` 가 `renderer.setOwners` 로 좌석 목록 전달(`ownersKey` 변경 시만), 주인 없는 집은 빈 판. `townScene.test.ts`(669줄)·`worldStore.test.ts` 통과. 얼굴이 실제로 읽히는지는 human_verification 2 |
| 4 | SC4: 폰 6종에서 이동·카메라·이름표가 진행에 지장 없고 성능 게이트(평균 55fps)를 낮추지 않는다 | ✓ VERIFIED (헤드리스 근거) | 성능은 `perf/nightload-390x844-x4-town.json` 직접 확인: avgFps 59.795, jank 1(≤5), duringMax calls 82·pointLights 3·triangles 93,996, issues `[]`. 광장 대조 59.68fps·jank 2. 게이트 문턱(`baseline` 55/5)은 불변. 폰 6종 걷기·이름표는 `camera.test.ts`(마을 팬 상자·원거리값)·`presence.test.ts` 통과 + E2E 요약 근거(town-walk 6종 7/7, 이름표 스테이지 안·겹침 0, 걷는 데 5.0~5.7초). 폰 GPU 근거는 한계가 있어 human_verification 1·3 |
| 5 | SC5: 맵 원본 시안을 Design 캔버스로 승인받고 사본을 `design/` 에 둔다 | ✓ VERIFIED (사전 위임) | `design/v3.0/town-map/`(`Main.dc.html` 채택 A·`Corners.dc.html` B·`Cutaway.dc.html`·`canvas.json`·`README.md` 좌표표), 커밋 `2d7f48ab`. 사용자가 2026-11-12 에 "시안은 캔버스 2~3개 + 추천안 바로 구현"을 위임했다(20-CONTEXT 6행). 사후 명시 확인은 없다 → human_verification 4 |
| 6 | 재즈 바·광장의 마스크·좌표·기존 시험이 바뀌지 않았다 | ✓ VERIFIED | `git log -- test/unit/map.test.ts` 마지막 수정은 11-06(`2ce160f2`), 20-01 이후 수정 없음. `shared/game/mapPlaza.ts` 는 20-01 이후 diff 없음. `shared/game/map.ts` 의 변경은 격자 원점·한계를 `MapDef` 에서 읽게 한 일반화뿐이고 `BAR_MASK`·`BAR_OBSTACLES` 줄은 그대로(diff 확인), 값이 없으면 기존 `GRID_ORIGIN`·`WALK_HALF`. 기존 시험 중 20-01 이후 바뀐 것은 이동 좌표 한계 ±700→±1200(`schemas.test.ts`·`world.test.ts`, `MOVE_COORD_LIMIT` 은 마을 ±10 때문, 서버는 맵별 걷기 한계로 보정 — `town.test.ts` "좌표 한계 끝(±1200)" 시험 통과)과 새 시험 추가뿐이다. `mapTown.test.ts` 가 `BAR_MASK`·`PLAZA_MASK` 를 일반화 래스터화와 글자 하나까지 대조 |
| 7 | 확장판은 town 으로 시작하고 기본 마피아는 맵 선택이 유지된다. 대기실은 늘 재즈 바 | ✓ VERIFIED | `maps.ts` `MODE_MAPS = { extended: "town" }`·`startMapOf`·`roomMapId`(lobby → bar), `room.ts` `beginGame` 이 `decideMap` 을 먼저 불러 난수 순서를 유지한 뒤 덮음. `PLAYABLE_MAPS = ["bar","plaza"]` 불변(town 은 선택지에 없음). `town.test.ts`: 확장판 4소켓 `view.map === "town"`·대기실은 아님, 기본 마피아는 선택대로 bar, 다시 하기 후에도 town. 클라이언트 `Lobby.tsx`·`ResultScreen.tsx` 의 `mapsOn = PLAYABLE_MAPS.length > 1 && modeOf(view) === "basic"` 로 확장판에서 [맵] 숨김 |
| 8 | 유령(탈락자)은 모든 구역을 본다(결정 0021) | ✓ VERIFIED | `emitMove` 의 `whole` 집합(본인·`!isAlive`)은 전체 구간, `snapFrameFor` 는 `!isAlive(viewer)` 이면 구역 거르기 없이 반환, `syncZones` 는 유령에게 문 프레임·zone snap 을 보내지 않음. `townLeak.test.ts` "유령 소켓은 우체국 안·경찰서 안 좌표가 실린 프레임을 받고 문 프레임·zone snap 은 받지 않는다"·`townDoor.test.ts` "유령의 hello snap"·`town.test.ts` "유령은 구역과 상관없이 전체 구간" 통과. 산 사람의 state 프레임에 남의 역할 없음(역할 규칙 불변) 시험도 통과 |
| 9 | 전체 시험·타입 검사 통과, 배포본이 검증한 코드다 | ✓ VERIFIED | `npm run typecheck` 종료 0. `npm test` 1회: 파일 291 통과·6 건너뜀, 테스트 8,569 통과·262 건너뜀·실패 0(20-10 SUMMARY 값과 일치). 대상 시험 묶음 두 번(562건, 3,987건) 모두 통과. 배포 version `…+07d6afee` 와 코드 diff 없음 |

**Score:** 9/9 truths verified (0 present, behavior-unverified)

### 누설 경로 전수 (직접 코드 확인, 20-CONTEXT D-14·D-17·D-18)

좌표가 실리는 모든 world 프레임 송신 지점을 `worker/room.ts` 에서 전수 확인했다.

| 경로 | 지점 | 구역 거르기 | 시험 |
|------|------|-------------|------|
| 이동 `move.p` | `emitMove`(applyMove·syncLayout 만 호출) | 본인·유령은 전체, 같은 구역 산 사람은 `clipToZone` 으로 문턱에서 끝나는 구간, 나머지·기억 불일치는 빈 집합(닫힌 쪽 실패) | town.test.ts, townLeak |
| 문 `appear` 의 `p` | `syncZones` | 들어간 구역 사람(`worldVisibleTo` 로 볼 수 있는 사람)에게만, `clipToZone` 으로 그 구역 안 구간만. `vanish` 는 좌표 없음(좌석·방) | townDoor |
| `snap.ents[].p` | `snapFrameFor` | 산 viewer 는 본인 + `zoneAt` 이 같은 사람만, 걷는 중이면 `clipToZone`. 기억이 아니라 지금 위치로 판정 | townDoor, townLeak |
| 근처 snap(심부름) | `nearSnapFrame`·`nearIdsOf` | 반경 안 AND 같은 구역, 근처 사람 구간은 자른 뒤 `clipToZone` | townErrand |
| 재접속 snap | `handleHello` → `syncZones` 후 `snapFrameFor` | 위와 같음 | townDoor, townErrand, townLeak(reconnect) |
| 아침·밤 순간이동 snap | `snapEachViewer` → `snapFrameFor`, `settleZones` 로 기억 맞춤 | 위와 같음, 가짜 문 통과 없음 | townErrand |
| 목격 기록 | `sampleErrand`(`errandSeen`·`errandLast`) | `nearIdsOf(…, map)` 같은 구역만 | townErrand, townLeak |
| 로비 전송(emitWorld 직접) | `room.ts` 227·1132·1192 | 로비 단계는 `roomMapId` 가 bar 라 방이 없고 전원 한 구역(입장 지점) | town.test.ts(방이 없는 맵 불변) |
| 채팅·감정표현·입력 중 | `deliver` | 좌표가 없고 구역 무관이 D-16 의 정한 범위 | townLeak "채팅은 구역과 무관" |

`emitMove` 외에 산 사람 폰으로 이동 좌표를 직접 보내는 경로는 없다(`emitWorld(moveFrame…)` 는 로비·봇 추가뿐, 봇은 `applyMove` 를 지나 `emitMove` 로 간다). `townLeak.test.ts` 는 한 판 전체에서 모든 소켓이 받은 모든 world 프레임을 `check()` 로 받는 사람의 구역과 대조하고, 근처·이동·문 사라짐·나타남·zone snap 이 실제로 한 번씩 왔는지도 단언해 시험이 비어 있지 않음을 고정한다.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/game/mapTown.ts` | TOWN_ROOMS·HOUSES·OBSTACLES·MASK·PLACES·MAP | ✓ VERIFIED | 249줄, 4개 방·8채 집·마스크 48×48, `TOWN_MAP` 이 `MAPS.town` 으로 등록, `mapTown.test.ts` 가 마스크를 장애물 래스터화와 대조 |
| `shared/game/zones.ts` | zoneOf·zoneAt·clipToZone·nextCrossingAt·reconcileZones·settleZones | ✓ VERIFIED | 순수 모듈, `worker/room.ts` 와 `errand.ts` 가 사용, `zones.test.ts` 통과 |
| `shared/game/maps.ts` | MAPS.town·MODE_MAPS·startMapOf | ✓ VERIFIED | `room.ts` beginGame 에서 호출 |
| `test/helpers/mapRaster.ts` | 일반화 래스터화 | ✓ VERIFIED | `mapTown.test.ts` 가 사용 |
| `test/worker/town*.test.ts` | 트레이서·문·심부름·누설 | ✓ VERIFIED | 모두 통과 |
| `src/world/maps/town.ts` | 마을 3D 장면 | ✓ WIRED | `threeRenderer.ts` 가 mapId town 에서 `buildTownScene` 호출 |
| `src/world/cutaway.ts` | 구역별 컷어웨이·누르기 목적지 | ✓ WIRED | `runtime.ts` 가 `cutawayOf`·`headVeiled`·`tapTarget` 사용 |
| `src/world/store.ts` | door·zone snap 처리, `takeDoor` | ✓ WIRED | `runtime.ts` 가 문 연출에 사용 |
| `scripts/e2e/town.mjs` | 마을 E2E 다섯 흐름 | ✓ EXISTS (실행은 요약 근거) | 619줄, TM1~TM10 판정 |
| `docs/decisions/0087-v3-town-map.md` | 결정 기록 | ✓ VERIFIED | 116줄, 알려진 한계·성능·폰 6종 실측 기록 |
| `design/v3.0/town-map/` | 시안 사본 | ✓ VERIFIED | 캔버스 3보드 + README |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `room.ts beginGame` | `maps.ts startMapOf` | decideMap 먼저 → 고정 맵으로 덮음 | ✓ WIRED |
| `worker/room.ts applyMove·syncLayout` | `zones.ts clipToZone` | `emitMove` 가 받는 사람을 3갈래로 나눔 | ✓ WIRED |
| `worker/room.ts` | `zones.ts reconcileZones·nextCrossingAt` | `syncZones`·`nextZoneAt`·`alarmBy`·`reschedule` | ✓ WIRED |
| `errand.ts sampleErrand·nearSnapFrame` | `zones.ts` | `nearIdsOf` 에 맵 전달 | ✓ WIRED |
| `shared/protocol.ts` door/zone 프레임 | `src/world/store.ts` | `k:"door"`·`zone: true` 처리 | ✓ WIRED |
| `WorldStage.tsx` | `runtime.ts` | `installTownHook`(`__mfTown`) | ✓ WIRED |
| `Lobby.tsx`·`ResultScreen.tsx` | `modeOf(view) === "basic"` | 확장판에서 [맵] 숨김 | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| 집 문패·표식 | 주인 좌석 목록 | `runtime.ts` ownerSeats ← 서버 view 의 좌석 | 예 | ✓ FLOWING |
| 컷어웨이 | 내 구역 | `zoneOf` 를 내 몸 위치로 호출(서버와 같은 순수 함수) | 예 | ✓ FLOWING |
| 문 연출 | 서버 door 프레임 | `store.takeDoor()` | 예 | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 타입 검사 | `npm run typecheck` | 종료 0 | ✓ PASS |
| 누설·문·심부름·트레이서·구역·마을 맵·맵 불변·화면 시험 | `npx vitest run test/worker/townLeak.test.ts townDoor townErrand town test/unit/zones mapTown map maps errandZone test/client/worldStage` | 10 파일 562 통과 | ✓ PASS |
| 장면·컷어웨이·카메라·저장소·팔레트·스키마·세계·봇·클라이언트 전체 | `npx vitest run` (townScene·cutaway·camera·worldStore·palette·perfScenario·e2eContract·presence·schemas·world·bots·test/client) | 101 파일 3,987 통과·95 건너뜀 | ✓ PASS |
| 전체 시험 1회 | `npm test` | 291 파일·8,569 통과·262 건너뜀·실패 0 | ✓ PASS |
| 배포 version | `curl /api/health` + 코드 diff | `…+07d6afee`, 이후 코드 diff 없음 | ✓ PASS |
| 성능 JSON | `perf/nightload-390x844-x4-town.json` | 59.795fps·jank 1·calls 82·점광원 3 | ✓ PASS |
| 브라우저 E2E | (다시 돌리지 않음) | 20-08·20-10 SUMMARY 값 | ? 요약 근거 |

### Probe Execution

Step 7c: 이 페이즈는 `scripts/*/tests/probe-*.sh` 를 선언하지 않았고 PLAN 도 probe 를 언급하지 않는다 — 해당 없음.

### Requirements Coverage

ROADMAP 의 Requirements 는 TBD 이고 REQUIREMENTS.md 에 20페이즈로 매핑된 항목이 없다(`grep` 0건, 고아 요구사항 없음). 계획 프런트매터의 requirements 는 20-CONTEXT 의 결정 id(D-01~D-23)다. 결정별 근거는 위 truths·누설 경로 표에 있다: D-01~D-08(맵 등록·확장판 town·격자 일반화·방·집·입장 지점) → truth 1·3·6·7, D-10~D-12(컷어웨이) → truth 1, D-13~D-18(구역·누설) → truth 2·8, D-19~D-21(걷기·성능) → truth 1·4, D-22·D-23(검증·배포) → truth 9. 미충족 결정 없음.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (없음) | — | 핵심 구현 파일(mapTown·zones·maps·room·town.ts·cutaway·runtime·store·town.mjs·누설 시험)에서 TBD·FIXME·XXX 0건 | — | — |
| 위생 | — | 20페이즈 문서·코드·시험에서 회사·조직 표현 `git grep` 0건(저장소 전체의 기존 일반 용례는 이 페이즈 밖) | — | — |

### Human Verification Required

#### 1. 폰 실기기에서 마을 한 판

**Test:** 폰(저사양 포함)에서 확장판 마을 한 판을 지목·변론·찬반·처형·밤까지 돌린다.
**Expected:** 끊김·발열이 진행에 지장 없다(최악 장면 그리기 호출 82).
**Why human:** 성능 근거가 헤드리스 소프트웨어 GL·CPU 4배 감속이라 폰 GPU 채움·발열·셰이더 컴파일 끊김을 못 본다.

#### 2. 밤 조명의 간판·문패 가독성

**Test:** 밤에 방 간판(봉투·잔·십자·방패)과 집 문패(좌석 색 + 얼굴)를 본다.
**Expected:** 한눈에 읽히고 지붕 위 이름표 겹침이 거슬리지 않는다.
**Why human:** 시각 품질, 이름표가 DOM 층이라 3D 깊이를 모르는 알려진 한계.

#### 3. 방 드나들기 조작감

**Test:** 지붕 누르기 → 문 앞 → 한 번 더 누르기로 입장, 퇴장, 밖에서 문 연출 관찰.
**Expected:** 자연스럽고 안팎이 서로 보이지 않으며 술집·진료소의 "문 앞에서 한 번 더 누르기"가 괜찮다.
**Why human:** 조작감·연출 체감.

#### 4. 시안 A 채택 사후 확인

**Test:** 마을 배치(방은 네 변 가운데, 집은 모서리에 둘씩)를 확인한다.
**Expected:** 사용자가 그대로 두거나 바꿀 곳을 말한다.
**Why human:** 사전 위임으로 채택, 명시 확인 없음.

### Gaps Summary

must-have 가 실패한 곳은 없다(gaps 0). 서버가 보이지 않는 사람의 좌표를 보내지 않는다는 핵심 약속은 모든 좌표 송신 경로를 코드에서 직접 읽고, 한 판 전체를 모든 소켓에서 판정하는 `townLeak` 시험과 함께 확인했다. 재즈 바·광장 불변(기존 map 시험 무수정, 마스크 대조), 확장판 town 시작·기본 마피아 선택 유지, 성능 수치(JSON 직접)도 확인했다. 브라우저 E2E 와 폰 6종 실측은 요약 근거이고, 폰 GPU·시각 품질·조작감은 사용자 방침대로 v3.0 끝 실테스트로 남아 status 가 `human_needed` 다. 알려진 한계(결정 0087)는 gap 이 아니라 advisory 로 적었다.

---

_Verified: 2026-11-13T05:10:00Z_
_Verifier: Claude (gsd-verifier)_
