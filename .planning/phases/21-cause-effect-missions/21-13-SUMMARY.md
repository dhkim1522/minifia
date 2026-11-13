---
phase: 21-cause-effect-missions
plan: "13"
subsystem: morning-scene-investigation-screen
tags: [ui, morning, clue-spot, clue-card, lamp-off, dock, projection]
requires:
  - phase: 21-cause-effect-missions
    provides: 21-08 의 clueChipsOf·clueSpotStates·lampsOffOf·HostLocal.sceneOn, 21-06 의 me.clues·day.scene, 21-11 의 SceneDock·건너뛰기 훅, 21-12 의 투영 콜백 at(x, y, z)·useMapInsets panelKey
provides:
  - ClueSpot(지점 표식 52 · fresh·done·blurred)·ClueChip(칩 32 · 카드 44 한 부품)·LampOffMark(꺼진 등불 36)
  - SceneDock 아침 변형(primary.kind "scene" — 흰 알약 돋보기 [살펴보기], data-scene-act, 길게 누르기 없음)
  - WorldStage 현장 층(clues prop — 지점 y 0·꺼진 등불 y 2.6 투영, 화면 밖 지점은 ErrandArrow)
  - 확장판 아침 화면 배선(GameMap): 결과 알림 뒤 sceneOn 래치, 독·카드 줄·{t:"inspect"}·건너뛰기, 유령은 채팅 패널 + 꺼진 등불만
  - causalView sceneMorningOf·sceneDelayMs·sceneNearOf·clueSpotPointsOf, useSceneNear 훅, placeMarkerPlan 일반화
affects: [21-14, 21-16, 21-17]
requirements-completed: [D-08, D-13, D-14, D-15, D-16, D-23, D-26, D-27]
actuals:
  tokens: 23000
  tasks: 2
  commits: 4
plan_head_before: 90930dc2b569fcf1e0cfbda978013a7f50e7c355
plan_head_after: 072ec6ef786d04eb4f41a40d192105d854fbf790
commits: 4
tech-stack:
  added: []
  patterns:
    - "부품(ClueSpot·ClueChip·LampOffMark·SceneDock scene)에는 역할 prop 이 없고 같은 입력이면 같은 DOM 이다. 지점 상태·카드 글은 내가 받은 me.clues(clueSpotStates·clueChipsOf)뿐이고 꺼진 등불은 공개 값 day.lamps 와 좌석 목록뿐이다. 시험이 같은 view 의 마피아·시민·경찰·의사 렌더에서 지점 층·카드 줄·독 outerHTML 이 같음을 고정한다(T-21-31)"
    - "지점 층 위치는 층이 쓴다: 프레임 콜백(onProject)이 지점 셋(바닥 y 0)과 꺼진 등불(기둥 구 y 2.6)을 투영해 transform·hidden·is-call 만 DOM 에 직접 쓴다(심부름 층과 같은 방식)"
key-files:
  created:
    - src/components/v2/ClueSpot.tsx
    - src/components/v2/ClueChip.tsx
    - src/components/v2/LampOffMark.tsx
    - src/net/useSceneNear.ts
    - test/client/clueParts.test.tsx
    - test/client/sceneMorning.test.tsx
  modified:
    - src/components/v2/SceneDock.tsx
    - src/components/WorldStage.tsx
    - src/components/v2/HostBand.tsx
    - src/screens/GameMap.tsx
    - src/screens/RoomScreen.tsx
    - src/game/causalView.ts
    - src/game/errandView.ts
    - src/styles/v2.css
    - src/styles/game.css
    - test/client/sceneDock.test.tsx
key-decisions:
  - "sceneOn(결과 알림 뒤)은 서버 시계로 정한다: 단계 시작(phaseEndsAt − 단계 길이) + 2.8초(큰 글 알림이 끝나는 때, 0.4초 뒤 2.4초). 알림이 아직 보이면(경찰 결과 알림 2.6초 뒤 2.2초 → 4.8초) 알림이 사라질 때까지 기다리고 4.8초가 지나면 무조건 선다. 역할을 읽지 않고 '알림이 떠 있는가' 하나만 본다. 재접속·늦은 합류는 연출 없이 바로 선다. (단계, 일차) 키 래치라 같은 아침의 다시 그리기로는 다시 서지 않는다"
  - "지점 표식은 TOWN_CLUE_SPOTS 를 shared 에서 바로 읽는다(clueSpotPointsOf, 고정소수점 ÷ 100). 화면 전용 사본을 만들지 않았다: WorldStage 는 이미 shared/game/mapTown 을 읽고(21-12 집 판) 사본은 서버 표와 어긋날 위험만 만든다"
  - "[살펴보기] 활성 판정은 프레임 DOM 쓰기가 아니라 위치 표본 훅(useSceneNear, 200ms + 구독)이다. 저녁 [켜기](21-11 useErrandPos)와 같은 방식이고 React 속성(aria-disabled·data-call)과 프레임 쓰기가 한 속성을 두고 다투지 않는다. 서버 판정과 같은 고정소수점 거리(ERRAND_ACT_R)"
  - "독은 아침 시작부터 있고(기록 두 줄 + 비활성 [살펴보기] + [건너뛰기]) 결과 알림이 끝나면 지점·카드·꺼진 등불이 선다. 알림이 끝나는 순간 아래 패널이 채팅 패널에서 독으로 바뀌어 스테이지가 흔들리는 일을 피한다"
  - "아침 [살펴보기] 는 길게 누르기가 없다: 채움 막대를 채우지 않고 onPress(false) 만 낸다. 저녁 [켜기] 만 hold 를 쓴다"
metrics:
  duration: 약 60분
  completed: 2026-11-13
status: complete
---

# Phase 21 Plan 13: 아침 · 현장 조사 화면 Summary

**확장판 아침(현장이 있을 때)은 큰 글 결과 알림이 끝나면 피해자(미수면 노린) 집 앞 지점 셋에 지름 52 표식(① 발자국 ② 옷 조각 ③ 창문)이 같은 fresh 모양으로 뜨고, 눌러 걸어가 독의 흰 알약 [살펴보기]로 `{t:"inspect"}` 를 보내면 내가 받은 결과대로 done·blurred 가 되고 카드 줄(최대 3)이 올라온다. 꺼진 등불(day.lamps 에 없는 주인 있는 집의 가로등)에는 점선 표식 36 이 뜬다. 부품은 역할을 모르고 마피아·시민 DOM 이 같다.**

## RED 증거 (단일 줄)

- Task 1 (`763b8b1c`): `Error: Failed to resolve import "../../src/components/v2/ClueChip" from "test/client/clueParts.test.tsx"` · `AssertionError: expected 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6…' to contain 'M10.5 4.5a6 6 0 110 12 6 6 0 010-12z'` (아침 단추가 eye 아이콘) · `AssertionError: expected 'scaleX(1)' to be 'scaleX(0)'` (아침 단추가 길게 누르기 막대를 채움)
- Task 2 (`921b085e`): `AssertionError: expected [] to deeply equal [ '1:fresh', '2:fresh', '3:fresh' ]` (지점 0개) · `AssertionError: expected [] to deeply equal [ +0, 2 ]` (꺼진 등불 표식 없음) · `AssertionError: expected null not to be null` (독 [살펴보기] 없음) · `AssertionError: expected '\n\n' to contain 'data-clue-spot'` (지점 층 없음)

## 투영 높이

- 단서 지점: 바닥(y 0) — `project(x, z)` 에 `TOWN_CLUE_SPOTS[house]` ÷ 100. 표식 중심 = 투영점, 상자 52 전체가 스테이지 안쪽(8) 안이고 오른쪽 열 단추를 피할 때만 그린다. 아니면 숨기고(`hidden`) 가장 가까운 안 살핀 지점이 그려지지 않았으면 기존 `ErrandArrow` 가 내 발밑에서 그쪽을 가리킨다.
- 꺼진 등불: 가로등 기둥 `TOWN_LAMPS[n].pole` 의 구 높이 y 2.6 — `at(x, 2.6, z)`(21-12 가 만든 높이 있는 투영). 36 상자가 안쪽에 있을 때만 그린다(화면 밖이면 표식도 화살표도 없다). 시험이 `at` 호출 높이가 모두 2.6 임을 고정한다.

## sceneOn 시각 규칙

위 key-decisions 첫 줄과 같다. 순수 함수 `sceneDelayMs(view, serverNow, announceShown)`(기본 시각 `SCENE_ON_AFTER_MS` = 2800, 최대 `SCENE_ON_MAX_MS` = 4800)가 정하고 GameMap 이 남은 시간만큼 타이머를 걸어 (일차:마감) 키로 래치한다. `HostLocal.sceneOn` 으로 방 화면 → 사회자 띠(`scene.act` '빛나는 곳을 살펴보세요')에도 같은 값이 간다(RoomScreen·HostBand 의 `Pick<HostLocal, …>` 에 `sceneOn` 추가).

## 가정 (정직하게)

1. **이름표 겹침은 그대로 둔다**: 한 집 앞에 사람이 몰려 이름표가 지점 표식과 겹치는 일(UI Considerations unresolved)은 DOM 층이라 허용했다(20 의 이름표 겹침 규칙). 실기기에서 심하면 다음 페이즈에서 아침 동안 남의 이름표 불투명도를 낮추는 안을 낸다.
2. **주인 없는 집의 가로등은 꺼진 등불 표식이 없다**: `lampsOffOf(day.lamps, 앉은 좌석)` — 좌석 수 < 8 판에서 빈 집의 가로등(아무도 켜지 않아도 되는 장식)을 소음으로 만들지 않는다. 탈락한 사람의 집은 좌석이 남아 있어 켜지지 않았으면 표식이 선다.

## Deviations from Plan

### Auto-fixed / 계획 보완

**1. [Rule 3 - 계획 보완] sceneOn 은 traceOn 의 흔적 구간 방식이 아니라 알림 끝 시각 규칙**
- **Found during:** Task 2 시작 전
- **Issue:** 계획은 "지금 traceOn 을 정하던 방식·시각을 따른다" 인데 traceOn 은 기본 판 아침의 마지막 5초 흔적 구간(`morning.trace`)이라 확장판 30초 아침에는 값이 없다
- **Fix:** 서버 시계 기준 단계 시작 + 결과 알림이 끝나는 때(`sceneDelayMs`, 알림이 아직 보이면 기다림). 시험이 순수 함수와 화면(알림 전 0개 → 후 3개, 재접속 즉시)을 고정
- **Commit:** 072ec6ef

**2. [계획 보완] [살펴보기] 활성·빛남은 프레임 DOM 쓰기가 아니라 위치 표본 훅**
- 계획은 WorldStage 가 프레임마다 독 `[data-scene-act]` 에 data-call·aria-disabled 를 쓴다고 했다. 그 속성은 독 부품(React)이 이미 `primary.disabled`·`primary.call` 로 그리므로 두 곳이 한 속성을 쓰면 다툰다. 저녁 [켜기](21-11 `useErrandPos`)와 같은 방식인 `useSceneNear`(200ms 표본 + 구독, act·next 가 바뀔 때만 상태)로 정했다. 지점의 `is-call`(가장 가까운 안 살핀 한 곳, 반경 밖일 때만)만 프레임 층이 쓴다
- **Commit:** 072ec6ef

**3. [계획 보완] TOWN_CLUE_SPOTS 화면 전용 사본을 만들지 않았다**
- 이월 메모는 화면 자체 사본(재생성 명령 주석)을 말했으나 WorldStage 는 이미 `shared/game/mapTown` 을 읽는다(21-12). 서버 표를 `clueSpotPointsOf` 가 월드 단위로 읽으면 사본이 서버와 어긋날 위험이 없다. 화면 번들에 새로 들어가는 서버 전용 값 없음(srcClean 초록)
- **Commit:** 072ec6ef

**4. [계획 보완] 독은 아침 시작부터 있고 [살펴보기] 는 처음엔 비활성**
- 계획은 sceneOn 전에는 [살펴보기] 를 그리지 않는다고 했다. 알림이 끝나는 순간 아래 패널이 채팅 패널에서 독으로 바뀌면 스테이지가 흔들리므로 독(기록 두 줄 + 비활성 단추 + [건너뛰기])은 처음부터 있다. 지점·카드·꺼진 등불은 sceneOn 뒤에만 선다
- **Commit:** 072ec6ef

**5. [계획 보완] CSS 블록 위치·소스 검사 위치**
- 21-13 CSS 블록은 파일 끝이 아니라 심부름 부품 블록 앞에 둔다: `errandParts.test` 가 첫 `.mv-errand` 부터 끝까지에서 `light-lamp` 를 쓰는 선택자를 `mv-errand-*` 로 제한한다(시험을 고치지 않았다). `pressScene`(눌림 소리 emitSignal)은 `callGlow.test` 의 소스 검사 구간(`callTargetsOf(view)` ~ `const stageTagProps`) 밖, 그 뒤에 둔다
- **Commit:** e1f5fc50·072ec6ef

**6. [계획 보완] 작은 일반화**
- `placeMarkerPlan` 을 장소 id 에 묶지 않는 제네릭(`<I extends string = PlaceId>`, 기본값이 있어 기존 호출은 그대로)으로 만들어 지점(문자열 id)에 재사용했고, 층 사각형 측정을 `measureLayerCache` 로 뽑아 심부름 층·현장 층이 같이 쓴다(동작 불변, 기존 시험 전부 통과)
- 카드 올라옴 keyframes 는 `from` 만 있다(`to` 를 두면 점선 카드의 불투명도 0.75 가 애니메이션 끝에서 1 → 0.75 로 튄다)
- 아침 카드 줄은 단서 카드만 그린다(`clueChipsOf(clues, undefined)` 에서 '단서 없음' 칩 제외 — 카드가 0장이면 줄이 없다). 목격·단서 없음은 21-14 의 보드 몫
- **Commit:** 072ec6ef·e1f5fc50

### 하지 않은 것

- 3D decal·꺼진 등불의 3D 상태(이미 21-09·21-10 소관)는 건드리지 않았다. 이 계획은 DOM 표식·카드·독이다.
- E2E 스크립트(scripts/e2e)의 아침 흐름은 갱신하지 않았다(21-16·21-17).

## Known Stubs

없음.

## Threat Flags

없음(새 네트워크·인증·파일 접근 없음. `inspect`·`skipPhase` 는 필드 없는/기존 메시지이고 결과는 서버가 정한다. T-21-31 은 네 역할 DOM 동일 시험이, T-21-32 는 srcClean 이 막는다).

## 한계 (정직하게)

- **실제 게임 흐름(저녁 → 밤 → 아침)을 실브라우저·실기기로 끝까지 돌려 본 것이 아니다.** 새 순서 E2E 는 21-16·21-17 소관이다. 대신 headless Chromium(playwright-core 의 chromium-headless-shell)으로 실제 CSS(tokens·v2·game·world.css)와 폰 폭 360×560 에서 지점 셋(안 살핌 금빛 2px + 빛·살핌 gray-500 + V 배지 20·먼저 손댄 흔적 점선 + 0.6)·꺼진 등불 36(점선 0.6, 눌림 통과)·카드 줄(두 줄 높이 96, 카드 44·둥근 14·14/700, 점선 카드 0.75)·흰 알약 [살펴보기] 56 의 정적 마크업을 그려 크기·테두리·불투명도 값을 측정하고 스크린샷으로 모양을 확인했다. 값은 UI-SPEC 그대로였다.
- 이 정적 확인은 실제 three 렌더 위의 표식 겹침·카메라가 나를 따라갈 때의 위치·깜빡임·화살표의 체감을 보지 못한다. 투영 쓰기(지점 y 0·꺼진 등불 y 2.6, 화면 밖 숨김·화살표)는 가짜 투영 함수로 한 DOM 시험이고 실제 카메라 값으로 본 것이 아니다(실기기 검사는 끝에 몰아서 한다).
- 360×560 에서 카드 줄(최대 96)이 스테이지 아래를 덮을 수 있고 좌석 0·7 집 지점이 서버 보정 좌표를 그대로 쓰는 것은 UI-SPEC backstop 대로 고치지 않았다.

## 21-14·21-16 에 넘기는 것

- **E2E 표식(21-16)**: 저녁 `[data-errand-act]`, 아침 `[data-scene-act]`(독 단추, 비활성이면 `aria-disabled="true"`, 반경 안 안 살핀 지점이 있으면 `data-call`, 다 살폈으면 보이는 글 '완료'). 지점 `button[data-clue-spot="1|2|3"]`(`data-state="fresh|done|blurred"`, 가장 가까운 안 살핀 한 곳은 `data-call`, 투영 전·화면 밖은 `hidden`), 지점 층 `[data-clue-layer]`, 카드 줄 `[data-clue-row]`(0장이면 DOM 없음)·카드 `[data-clue-chip="footprint|cloth|window|touched|dark"]`, 꺼진 등불 `[data-lamp-off="{가로등 번호}"]`(접근성 이름 '꺼진 등불'), 건너뛰기 `[data-skip-phase]`. sceneOn 은 단계 시작 후 약 2.8초(경찰 알림이 있으면 최대 4.8초)이므로 E2E 는 `[data-clue-spot]` 이 생길 때까지 기다린다. 지점은 `hidden` 이 풀린 것만 눌러 걷는다.
- **ClueChip(21-14 보드)**: `<ClueChip kind icon text size="chip" />` — props 는 `clueChipsOf` 가 준 `kind`·`icon`·`text` 그대로(점선 `is-faint` 는 kind 가 touched·dark·none 이면 부품이 정한다). 칩 32 는 `--light-lamp` 테두리, 카드 44 는 `--night-800` 면. 보드는 `none`('단서 없음')·`witness`('목격 n') 칩도 쓴다.
- **me.record 줄과 같은 아침 탈락자(21-14 결정)**: `me.record` 는 토론 단계에만 오고 줄이 그 아침 탈락한 좌석을 가리킬 수 있다(공개 사실). 이 계획은 record 를 쓰지 않는다. 권고: 보드 얼굴 칸은 산 사람만, 목격 줄은 탈락자도 이름 그대로 두되 얼굴 그림만 유령 회색(전용 새 글 없음).
- `useSceneNear(store, seat, serverNow, house, inspected, enabled)`·`sceneNearOf`·`sceneMorningOf`·`sceneDelayMs`·`clueSpotPointsOf` 는 causalView/net 에 있어 21-14·E2E 훅이 그대로 쓸 수 있다. `HostLocal.sceneOn` 은 GameMap → RoomScreen → HostBand 로 흐른다.
- srcClean 유지(lampCut·smudged·skipVote·mafiaTouch·낱말 cut·data-*cut* 없음). 화면은 day.lamps·day.scene.house·day.skipCount·me.clues·me.skipPhase 만 읽고 역할로 갈라지지 않는다.

## Self-Check: PASSED

- 파일: ClueSpot·ClueChip·LampOffMark·useSceneNear·clueParts.test·sceneMorning.test 있음, 수정 파일 모두 git 에 커밋됨.
- 커밋: 763b8b1c(test)·e1f5fc50(feat)·921b085e(test)·072ec6ef(feat) 모두 HEAD 의 조상.
- 인수 기준: WorldStage 의 `ClueSpot` 9·`TOWN_CLUE_SPOTS` 1(주석에서 clueSpotPointsOf 가 읽는 표로 명시)·GameMap `"inspect"` 2·ClueChip `data-clue-chip` 1·SceneDock `data-scene-act` 2, SUMMARY 가정 두 줄.
- `npm test` 8973 통과·262 건너뜀·실패 0(알려진 간헐 실패 네 건은 이번 실행에서 나오지 않음), `npm run typecheck` 초록, srcClean 초록, 위생 grep(바뀐 파일) 새 결과 없음.
