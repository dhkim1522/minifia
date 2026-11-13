---
phase: 20-map-expansion
plan: "05"
subsystem: world-runtime
tags: [map, town, cutaway, camera, runtime, e2e-hook, tdd]
status: complete

requires:
  - phase: 20-map-expansion
    provides: "20-02 — 서버 구역·문 프레임 / 20-04 — buildTownScene·setCutaway·setOwners·roofs·panBoxOf·plateFarOf"
provides:
  - "src/world/cutaway.ts — cutawayOf(zone, all) 순수 판정, sameRooms"
  - "WorldRenderer 선택 메서드 setCutaway?·setOwners?·roofs?, threeRenderer 의 mapId town → buildTownScene"
  - "런타임: 내 그려진 위치 구역 → setCutaway, 좌석 → setOwners, recreate 뒤 instant 복원, 따라가기 panBoxOf(mapId), deps.onTown"
  - "SceneLook.roomsOpen (유령 viewer·결과 화면)"
  - "window.__mfTown · installTownHook · TownHookState"
affects: [20-06, 20-08, 20-09, 20-10, 21]

actuals:
  tokens: 7100
  tasks: 2
  commits: 4

plan_head_before: df8e79c5325e631f5e97c4d64bb0771d96ef4be3
plan_head_after: 3f97fe4f39a93eed344f5f6376f8d09e958fb93b
commits: 4

tech-stack:
  added: []
  patterns:
    - "컷어웨이 판정은 three 를 import 하지 않는 순수 모듈 — 구역은 서버와 같은 shared zoneOf, 화면은 결과 집합만 받는다"
    - "렌더러에는 바뀐 집합만 보낸다: cutSent(null = 이 렌더러에 처음) 로 instant 를 정하고 recreated 이벤트가 cutSent·townKey 를 비워 다음 프레임에 지금 목표를 다시 놓는다"
    - "E2E 훅 값은 런타임이 이미 가진 값(내 그려진 위치의 구역·렌더러의 지붕 불투명도·view 좌석)에서만 계산하고 바뀔 때만 알린다"

key-files:
  created:
    - src/world/cutaway.ts
    - test/unit/cutaway.test.ts
  modified:
    - src/world/renderer.ts
    - src/world/threeRenderer.ts
    - src/world/camera.ts
    - src/world/runtime.ts
    - src/world/presence.ts
    - src/world/testHooks.ts
    - src/components/WorldStage.tsx
    - src/screens/ResultScreen.tsx
    - test/unit/camera.test.ts
    - test/unit/presence.test.ts
    - test/client/worldStage.test.tsx
    - test/client/resultScreen.test.tsx

key-decisions:
  - "마을 카메라 값은 20-04 시작값(PAN ±9.6 · 연장 판 22)이 가시성·빈 배경 검사가 정하는 가장 작은 값과 같아 바꾸지 않았다 — 근거 표를 camera.ts 주석과 아래에 남겼다"
  - "내 몸이 아직 그려지지 않았으면(첫 프레임 전) 컷어웨이를 보내지 않는다 — 장면은 덮인 채 시작하므로 빈 집합을 먼저 보내 'instant' 를 써 버리면 정작 처음 걷힘이 연출로 보인다. 유령·결과(roomsOpen)는 몸과 무관하게 바로 보낸다"
  - "방 윤곽 폭 시험은 UI-SPEC 의 '폭 360 안'(≈329px)을 기준으로 360−16 이하, 300 초과로 잡았다(계획의 360−32 = 328 은 실제 329.2 라 UI-SPEC 의 기하와 맞지 않는다)"

requirements-completed: [D-07, D-10, D-11, D-12, D-21]

coverage:
  - id: D1
    description: "마을 판이면 렌더러가 마을 장면을 올리고(__mfMap = town) 따라가기 카메라가 panBoxOf(town) 로 잘린다. 재즈 바·광장은 PAN_BOX 그대로"
    requirement: "D-12"
    verification:
      - kind: unit
        ref: "test/client/worldStage.test.tsx#마을 카메라 (20-05, D-12·P20-15)"
        status: pass
      - kind: e2e
        ref: "로컬 스크래치 스크립트(저장소 밖): __mfMap=\"town\" 확인, 390x844 스크린샷"
        status: pass
    human_judgment: false
  - id: D2
    description: "마을 PAN 은 걷는 영역 ±10 의 0.25 간격 81×81 격자점 × 폰 6종 가시성(이름표 + 입력 중 칸이 스테이지 안)을 통과하는 가장 좁은 0.1 단위 값(9.6)이고, 연장 판은 빈 배경 검사가 통과하는 가장 작은 0.5 단위 값 20 + 2 = 22 다"
    requirement: "D-21"
    verification:
      - kind: unit
        ref: "test/unit/camera.test.ts#마을 카메라 (20-05): 걷는 영역 ±10 격자점 × 6개 폰 크기 · 빈 배경 · 방 윤곽 폭"
        status: pass
    human_judgment: false
  - id: D3
    description: "방 하나의 바깥 윤곽(4.6×3.4)의 화면 가로 폭은 약 329px 로 가장 좁은 폰 폭 360 안에 다 들어온다(TM9 기하)"
    requirement: "D-21"
    verification:
      - kind: unit
        ref: "test/unit/camera.test.ts#방 하나의 바깥 윤곽(네 꼭짓점)은 화면 가로 폭이 가장 좁은 폰 폭 360 안에…"
        status: pass
    human_judgment: false
  - id: D4
    description: "내 그려진 위치가 방 안쪽이면 그 방만, 광장이면 모두 덮이고, 바뀔 때만 렌더러에 보낸다. 처음·recreate 뒤·모션 줄이기는 instant"
    requirement: "D-10"
    verification:
      - kind: unit
        ref: "test/unit/cutaway.test.ts · test/client/worldStage.test.tsx#마을 컷어웨이·집 주인·__mfTown (20-05, D-07·D-10·D-11)"
        status: pass
      - kind: e2e
        ref: "로컬 스크래치: 우체국 안 zone post·roofs.post 0 → 광장 roofs 전부 1 → 술집 zone pub·roofs.pub 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "유령·탈락자 관전과 결과 화면은 네 방 모두 걷힌다(roomsOpen). 산 사람 장면에는 키가 없다"
    requirement: "D-11"
    verification:
      - kind: unit
        ref: "test/unit/presence.test.ts#sceneLook 의 roomsOpen · test/client/resultScreen.test.tsx#장면: 마을의 네 방 모두 걷힌다"
        status: pass
      - kind: e2e
        ref: "로컬 스크래치: ended 화면 open 네 방·roofs 전부 0 (스크린샷으로 확인)"
        status: pass
    human_judgment: false
  - id: D6
    description: "판이 열리면 view 좌석 목록이 setOwners 로 가고(오름차순) 좌석이 바뀔 때만 다시 간다. 재즈 바·광장은 부르지 않는다"
    requirement: "D-07"
    verification:
      - kind: unit
        ref: "test/client/worldStage.test.tsx#집 주인: 좌석 [0,1,3] … · 재즈 바·광장에서는 setCutaway·setOwners 를 한 번도 부르지 않는다"
        status: pass
    human_judgment: false
  - id: D7
    description: "window.__mfTown 이 마을 판 + 훅 문맥에서만 zone·open·roofs(소수 둘째)·owners·veiled·door 를 싣는다. 남의 위치·구역은 싣지 않는다"
    requirement: "D-10"
    verification:
      - kind: unit
        ref: "test/client/worldStage.test.tsx#window.__mfTown …"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-11-13
---

# Phase 20 Plan 05: 렌더러 연결·카메라 확정·컷어웨이 Summary

**마을 장면을 렌더러에 올리고, 내 그려진 위치의 구역(서버와 같은 `zoneOf`)으로 방 하나를 0.25초에 걷고 덮는 런타임을 달았다. 유령·결과 화면은 네 방 모두, 집 주인은 view 좌석으로, `window.__mfTown` 훅으로 상태를 본다.**

## Performance

- **Duration:** 약 20분
- **Completed:** 2026-11-13
- **Tasks:** 2 (RED·GREEN 쌍 각 1)
- **Files modified:** 14 (새 파일 2)

## Accomplishments

- `threeRenderer`: mapId `town` 이면 `buildTownScene`. `WorldRenderer` 에 선택 메서드 `setCutaway?`·`setOwners?`·`roofs?`(가짜 렌더러 호환)를 더해 장면 훅으로 넘긴다. 재즈 바·광장 장면은 이 훅이 없어 안전한 기본값(`roofs` 전부 1)만 돌려준다.
- `runtime`: 따라가기 카메라를 `panBoxOf(mapId)` 로 자른다. 프레임마다 내 액터의 그려진 위치 → `zoneOf(map, round(x·UNIT), round(z·UNIT))` → `cutawayOf(zone, look.roomsOpen === true)` → 이전 집합과 내용이 다를 때만 `setCutaway`. `syncPlayers` 가 좌석 목록(오름차순)이 바뀔 때만 `setOwners`. `recreated` 이벤트는 `cutSent`·`townKey` 를 비우고 집 주인을 다시 보내 다음 프레임이 지금 목표를 instant 로 놓는다.
- `cutaway.ts`: `cutawayOf`(방이면 그 방 하나·광장/null 은 빈 집합·all 이면 넷)와 `sameRooms`. three·DOM 을 읽지 않는다.
- `presence.sceneLook`: 유령 viewer(spectate 또는 내 좌석 탈락)면 `roomsOpen: true`, 산 사람은 키 없음(모이기 고정 카메라 단계도 같은 규칙). `ResultScreen.sceneOf` 는 늘 `roomsOpen: true`.
- `testHooks`·`WorldStage`: 마을 판 + 훅 문맥에서만 `window.__mfTown`(`installTownHook`, 해제는 다른 설치가 덮었으면 지우지 않음). `roofs` 는 소수 둘째로 반올림하고 값이 바뀔 때만 알린다. `veiled`·`door` 는 빈 배열(20-06 이 채운다).

## 확정한 카메라 값 (Task 1)

20-04 의 시작값이 가시성·빈 배경 검사의 "가장 작은 값"과 같아 **값은 바꾸지 않았다**. 대신 camera.test 에 마을 격자(±10, 81×81)·폰 6종 검사를 더해 값을 시험으로 고정했고 `camera.ts` 주석에 근거를 적었다.

| 크기 | 필요한 최소 pan | 목표 (−9.6,−9.6) 에서 가장 먼 바닥 |
|---|---|---|
| 360x640 | 9.0 | 16.2 |
| 390x664 | 8.8 | 16.6 |
| 430x932 | 8.5 | 19.7 (최대) |
| 360x560 | **9.6 (한계를 정한 크기)** | 15.3 |
| 390x844 | 8.8 | 18.5 |
| 402x874 | 8.7 | 18.9 |

- 마을 `PAN` = **±9.6** (0.1 더 좁은 9.5 는 360x560 이 넘친다). 걷는 영역 ±10 안쪽.
- 마을 연장 판 = **22** = ceil(19.68 × 2)/2 = 20 + 여유 2. 따라서 `townScene.test` 의 `plateFarOf("town")` 단언 22 는 그대로다.
- 방 윤곽 가로 폭(4.6×3.4 → (4.6+3.4)/√2 × 58.2) ≈ **329.2px**. 폭 360 안, 양옆 약 15px 여유.

## 런타임에 더한 상태 목록

`hasRooms`(맵에 방이 있나) · `panBox` · `cutSent`(렌더러에 마지막으로 보낸 열린 방 집합, null = 이 렌더러에 처음) · `ownerSeats`·`ownersKey`(마지막으로 보낸 집 주인 좌석·키) · `townKey`(`onTown` 에 마지막으로 알린 값의 JSON 키). 함수: `sendOwners(force)`·`updateTown(r, reduced)`.

## 검증 결과

| 명령 | 결과 |
|---|---|
| `npx vitest run test/unit/camera.test.ts test/unit/cameraThree.test.ts test/unit/townScene.test.ts test/client/worldStage.test.tsx` + `npm run typecheck` (Task 1 verify) | 4 파일 · 430 통과 · 2 건너뜀 · 실패 0, typecheck 종료 0 |
| `npx vitest run test/unit/cutaway.test.ts test/unit/presence.test.ts test/client/worldStage.test.tsx test/client/resultScreen.test.tsx` (Task 2 verify 의 일부) | 577 통과 · 실패 0 |
| `npx vitest run --project unit --project client` | 234 파일 통과 · 1 건너뜀 / 시험 7903 통과 · 184 건너뜀 · 실패 0 |
| `npm run typecheck` | 종료 0, `error TS` 0 |
| 위생 `git grep -nIiE "torder|티오더|조직|회사|~/project"` (바뀐 파일) | 결과 0 |

워커 시험·저장소의 E2E(`npm run e2e`)는 돌리지 않았다(이 계획은 서버를 건드리지 않고 마을 E2E 는 20-08 이다).

## RED 증거

- **Task 1 RED** (`eecc74a6`): camera.test 의 마을 시험은 20-04 시작값이 이미 가장 좁은 값이라 **처음부터 통과**했다(RED 없음 — 값 시험은 확정 시험으로 남김). 실패하는 시험은 따라가기 연결: `npx vitest run test/client/worldStage.test.tsx -t "마을 카메라"` → 2 중 **not ok 1**, `AssertionError: expected 5.4 to be close to 9.6`(런타임이 아직 `PAN_BOX` 로 자름).
- **Task 2 RED** (`be6ba0d3`): `npx vitest run test/unit/cutaway.test.ts test/unit/presence.test.ts test/client/worldStage.test.tsx test/client/resultScreen.test.tsx --reporter=tap-flat` → **not ok 12**. cutaway.test 는 `Cannot find module '../../src/world/cutaway'`, presence·resultScreen 은 `expected undefined to be true`(roomsOpen 없음), worldStage 는 `expected "vi.fn()" to be called 1 times, but got 0 times`(setCutaway·setOwners 를 부르지 않음). 통과한 것은 재즈 바·광장이 부르지 않는다는 시험 등 처음부터 참인 단언이다.

## Task Commits

1. `eecc74a6` test(20-05): 마을 카메라 가시성 실패 시험
2. `f03e6a82` feat(20-05): 마을 렌더러 연결·카메라 한계 확정
3. `be6ba0d3` test(20-05): 컷어웨이 연결 실패 시험
4. `3f97fe4f` feat(20-05): 내 구역 컷어웨이·유령/결과 전체 걷힘·집 주인·__mfTown

## 화면에서 본 것

저장소 밖 스크래치 스크립트(playwright, `scripts/e2e/browser.mjs` 도우미 재사용)로 로컬 dev(`http://localhost:5173`)에 방을 만들고 봇 5명 + 방장으로 390x844 에서 한 판을 열어 스크린샷을 찍었다. 배포본은 쓰지 않았다. 헤드리스(소프트웨어 GL)라 프레임 끊김은 판단할 수 없다.

- **걷힘**: 광장(네 방 덮임, `roofs` 전부 1) → 우체국 안(`zone post`·`open [post]`·`roofs.post` 0) → 광장으로 나오면 다시 덮임 → 술집 안(`zone pub`). 걷힌 방은 뒷벽(북·서)이 남아 안을 감싸고 벽등·소품·바닥 널이 보인다. 시안(Cutaway)과 크게 어긋난 곳 없음.
- **결과 화면**: `open` 네 방·`roofs` 전부 0. 마을 한복판 연단·시계탑 둘레의 지붕이 걷힌 채다.
- **간판·문패**: 어두운 판 위 금빛 선 그림(봉투·잔)이 가로등 빛 아래에서 읽힌다. 집 문패·지붕 표식의 좌석 색 원 + 얼굴이 낮 토론 조명에서 보인다. 밤 조명은 보지 못했다.
- **먼 모서리 집**: 광장 안개로 어둡지만 흐려 읽히지 않을 정도는 아니었다.
- **진료소·술집 간판이 뒤쪽 사람의 아랫몸을 가리는지**: 찍은 장면에서는 가리지 않았다(우체국 간판이 UI 단추와 겹치는 것은 DOM 쪽이다). 사람이 간판 뒤에 서는 자리는 보지 못했다.
- **방 안쪽 자갈 띠**: 따로 눈에 띄지 않았다(금빛 문턱 띠는 보인다).
- **셰이더 컴파일 끊김**: 헤드리스에서는 알 수 없어 미리 컴파일은 넣지 않았다(실기기 확인으로 이월).

## Deviations from Plan (계획과 달라진 점)

### 구현이 정한 것

1. **마을 카메라 값 불변** — 계획은 "통과하는 가장 작은 값으로 camera.ts 의 town 값을 고친다"고 했으나 시작값(9.6·22)이 이미 그 값이다. 시험과 근거 주석만 더했다. 그래서 Task 1 의 RED 는 camera.test 가 아니라 worldStage.test 의 따라가기 연결 시험이다.
2. **방 윤곽 폭 상한 328 → 344** — 계획은 360−32 = 328 이하였으나 실제 폭은 (4.6+3.4)/√2·58.2 = 329.2 라 UI-SPEC 의 "폭 360 안(≈329px)"과 모순이다. UI-SPEC 의 기하를 따라 360−16 = 344 이하, 300 초과로 단언한다.
3. **내 몸이 없으면 컷어웨이를 보내지 않는다** — 계획은 "내 액터가 아직 없으면 zone null(모두 덮임)"이었다. 빈 집합을 먼저 보내면 "처음 보냄 = instant" 를 거기서 써 버려 첫 프레임에 방 안인 사람의 처음 걷힘이 연출로 보인다. 장면은 덮인 채 시작하므로 보내지 않고 기다린다(유령·결과 `roomsOpen` 은 몸과 무관하게 바로 보낸다). 시험이 고정.
4. **`sameRooms` 보조 함수** — 계획의 `cutawayOf` 외에 집합 내용 비교를 한 곳에 두려고 같은 파일에 더했다.

### 더한 것

- `test/client/resultScreen.test.tsx` 에 `roomsOpen true` 시험 하나(계획의 파일 목록에는 없으나 결과 화면 조건을 거기서 가장 가깝게 본다).
- `worldStage.test` 가짜 렌더러에 `setCutaway`·`setOwners`·`roofs` 기록 메서드(optional 이라 다른 시험은 영향 없음).
- Task 2 GREEN 파일(`cutaway.ts`·`presence.ts`·`ResultScreen.tsx`)을 RED 시험보다 먼저 써 두었으나, 커밋 전에 되돌려 RED 가 실패하는 것을 확인한 뒤 복원했다.

## 20-06 에 넘기는 것

- **`veiled`·`door` 를 채울 자리**: `deps.onTown` 의 상태(`runtime.ts` `updateTown`)에는 `zone`·`open`·`roofs`·`owners` 만 있다. `veiled`·`door` 는 `installTownHook().patch({ veiled, door })` 로 채우면 된다 — `WorldStage` 의 `townHook` 변수가 이미 있고 `onTown` 은 `patch(state)` 라 `veiled`·`door` 는 덮어쓰지 않는다(키가 없으면 그대로 남는다). 문 프레임 저장소는 서버 쪽 `store.takeDoor()`(20-02).
- **내 구역·열린 방**: 런타임의 `updateTown` 안 `zone`·`open` 값이 벽 뒤 규칙(이름표 숨김)의 입력이다. 내 구역은 `zoneOf(map, round(pos·UNIT), …)` 로 내 그려진 위치에서 구하고, 서버가 같은 구역 사람만 보내므로 방 안에서는 방 안 사람만, 광장에서는 광장 사람만 온다.
- **탭 매핑(지붕 누르기)**: 광선 시험은 메시가 아니라 `TOWN_ROOM_OUTER`·`TOWN_HOUSES` 상자로 한다(20-04 메모 그대로). 걷힌 방의 컷 메시는 꺼져 있다. 렌더러의 `project`·`groundAt` 으로 지붕 위 점을 화면에 옮길 수 있다.
- **`CUTAWAY_MS` 250** 은 런타임이 아니라 장면이 쥔다. 문 통과 연출(0.2초)과 맞출 때 `import { CUTAWAY_MS } from "./maps/town"`.
- **E2E(20-08)**: 훅은 `?e2e=1`(또는 개발 빌드) + 마을 판에서만 생긴다. `__mfTown.roofs` 가 0 이 되는 데 모션 줄이기 없이 약 0.25초. 방 안에서 `zone` 은 안쪽 사각형 엄격한 안쪽일 때만 방 id 다(문턱·벽은 `plaza`).
- **셰이더 컴파일 끊김**은 실기기에서 첫 걷힘 때 확인해 끊기면 맵 올릴 때 `gl.compile` 로 투명 변형을 미리 만든다(20-04 한계 항목과 같다).

## Threat Flags

없음 — 계획의 T-20-17(`__mfTown` 은 훅 문맥에서만·DOM 속성 아님·이미 받은 값뿐)을 시험으로 고정했다. 새 끝점·인증 경로·파일 접근 없음.

## Known Stubs

- `window.__mfTown` 의 `veiled: []`·`door: []` 는 20-06 이 채운다(계획이 정한 의도된 자리).

## Self-Check: PASSED

- 파일: `src/world/cutaway.ts` · `test/unit/cutaway.test.ts` · `.planning/phases/20-map-expansion/20-05-SUMMARY.md` 있음
- 커밋: `eecc74a6` · `f03e6a82` · `be6ba0d3` · `3f97fe4f` 모두 HEAD 의 조상
