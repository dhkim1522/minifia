---
phase: 15-errand-and-trace
plan: "05"
subsystem: client-errand-screen
tags: [errand, world-store, runtime, onProject, walkTo, marker-layer, near-ring, errand-dock, minifia-v3, d-01, d-02, d-03, d-09]
status: complete

requires:
  - phase: 15-01
    provides: "me.errand(places·done)·view.map·MapDef.places·errand 단계·{t:'errand'}"
  - phase: 15-02
    provides: "near: true 근처 snap(보이는 사람 전부)·표본 알람"
  - phase: 15-04
    provides: "ErrandMarker·ErrandArrow·ErrandDock·errandView 순수 판정·hostLine errand 빛남 대상"
provides:
  - "WorldStore.applyFrame: near snap(같은 epoch·ready)은 사본을 통째로 바꾸고 새 좌석만 entered, 남은 좌석의 이동 응답 세기는 유지"
  - "WorldRuntimeDeps.onProject(project, now): 프레임마다 이름표 다음 한 번 — 바닥점 투영 함수. WorldRuntime.walkTo(x, z): 탭과 같은 링·목적지 경로"
  - "WorldStage errand prop(ErrandLayerProps) → .mf-world__errand 층(표지·화살표 칩·근처 링 svg data-near-ring), 프레임 투영은 DOM 직접 쓰기"
  - "src/net/useErrandPos.ts: 200ms 표본 + store 구독, actableId·nextId 가 바뀔 때만 상태 변경"
  - "GameMap errand 분기: 아래 패널 ErrandDock(유령·목록 없음은 같은 높이 빈 패널), [처리] → send({t:'errand'}), 빛남 전달"
affects: [15-06, 15-07, 15-08, 15-09, 15-10]

requirements-completed: [ERRAND-02, ERRAND-03, ERRAND-04]

actuals:
  tokens: 60000
  tasks: 3
  commits: 6

plan_head_before: b9a92197cd33e9b2dbd12e178662f8005dafe55e
plan_head_after: a1cde4bf24868fc9292081fb8fa7d48cba31b98c

tech-stack:
  added: []
  patterns:
    - "프레임 투영 쓰기는 값이 같으면 DOM 을 쓰지 않는다(transform 문자열·hidden·is-call 비교) — React 상태·리렌더 없음"
    - "React 가 처음 마운트 값만 쓰고(hidden·style display none) 이후 값은 런타임 콜백이 직접 쓴다 — props 가 늘 같아 React 가 되돌리지 않는다"
    - "독 줄·호스트 사각형은 250ms 간격으로 캐시해 프레임마다 레이아웃을 강제하지 않는다"

key-files:
  created:
    - src/net/useErrandPos.ts
    - test/client/errandScreen.test.tsx
  modified:
    - src/world/store.ts
    - src/world/runtime.ts
    - src/components/WorldStage.tsx
    - src/components/v2/ErrandMarker.tsx
    - src/screens/GameMap.tsx
    - src/styles/game.css
    - test/unit/worldStore.test.ts
    - test/client/worldStage.test.tsx

key-decisions:
  - "투영·빛·링은 런타임 한 곳(프레임 루프)에서 DOM 에 쓴다. 표지 3 + 화살표 1 + 링 24점, React 상태 없음 (T-15-22)"
  - "near snap 은 moveSeqs 를 지우지 않는다(남은 좌석 한정). 지우면 1초마다 오는 near snap 이 own.observe 에서 seq < base 로 'reset' 을 일으켜 걷는 도중 내 예측 구간·링이 끊긴다"
  - "WorldRuntime.walkTo 는 void 가 아니라 tap 과 같이 {x,z}|null 을 돌려주고, move 전송·notifyMoveSent 는 WorldStage 의 공유 sendWalk 가 한다(서버로 가는 메시지는 move 하나뿐)"
  - "표지 눌림 = WorldStage 가 walkTo + move 를 직접 처리하고 errand.onWalk(id)는 '눌렸다' 알림(선택). GameMap 은 처리 메시지를 보내지 않는다"
  - "errand 의 빛은 위치·진행으로만 정한다: callTargetsOf(view,{pos}) 결과를 callUsed·layerKind·kbOpen 과 무관하게 ErrandDock·errand.callPlace 로 전달"
  - "유령·목록 없음의 아래 패널은 같은 section(data-world-panel, 높이 84 + 안전 영역)이고 내용이 없다 — 판정은 view.me.errand 유무라 spectate 에 기대지 않는다"

metrics:
  duration: 약 55분
  completed: 2026-11-07
---

# Phase 15 Plan 05: errand 맵 화면 Summary

**errand 단계 화면이 완성됐다. 아래 패널은 ErrandDock, 맵 위에는 내 장소 표지·가장자리 화살표 칩·근처 반경 점선 링이 런타임 프레임 콜백으로 투영되어 그려지고, [처리]·표지 걷기·빛남이 서버 메시지(errand·move)로 이어진다. 근처 snap 은 월드 사본을 그 사람들로 통째로 바꿔 새 사람은 등장, 빠진 사람은 이름표와 함께 퇴장한다. 마피아·시민의 errand DOM 은 역할만 바꾼 렌더 네 번이 같다.**

## 한 일

- **Task 1 (store·runtime)** — `test(15-05)` 먼저(RED 확인 후 커밋), `feat(15-05)` 로 구현.
  - store: `frame.near === true` 이고 ready·같은 epoch 면 새 segs 로 통째 교체, 이전에 없던 좌석만 `entered`. 그 밖(near 없는 snap·첫 snap·새 epoch)은 기존 규칙 그대로(회귀 시험 포함).
  - runtime: `onProject` 는 writeTags 다음 프레임당 한 번(`projectGround` 가 renderer.project 를 감싸고 유한하지 않으면 null). `walkTo` 는 tap 의 링 띄우기 부분(`startWalk`)을 공유한다. 등장·퇴장 연출은 기존 EXIT_MS·enter 를 그대로 썼고 이름표가 퇴장 동안 같이 흐려지고 EXIT_MS 뒤 0 이 되는 것을 시험으로 고정했다(연출 곡선 변경 없음).
- **Task 2 (WorldStage errand 층)** — `test(15-05)` 후 `feat(15-05)`.
  - `.mf-world__errand`(이름표 층 바로 아래 z, 눌림 통과·표지 버튼만 받음), 표지 버튼 N·화살표 칩 1·`svg[data-near-ring]`(24점 다각형, 굵기 2·gray-50 35% 점선, 정지 모양)를 항상 마운트하고 프레임마다 `writeErrandLayer` 가 hidden·transform·is-call/data-call·points 만 쓴다. 표지 위치는 투영 중심 −22, 화살표는 −18. 배치 계획은 15-04 의 `placeMarkerPlan`(스테이지 안쪽 8·독 줄 겹침).
  - ErrandMarker·ErrandArrow 에 처음 마운트용 `hidden` prop 만 더했다(없으면 DOM 이 이전과 같다).
- **Task 3 (GameMap)** — `test(15-05)` 후 `feat(15-05)`.
  - `useErrandPos`: 내 구간 표본(200ms + store 구독) → 처리 가능·다음 장소 id 가 바뀔 때만 setState. `callTargetsOf(view,{pos})` 로 빛 대상을 정해 [처리] 에는 `call`, 표지·화살표에는 `errand.callPlace` 로 전달한다.
  - 아래 패널: errand 단계면 `<section ref={panelRef} class="mf-game__panel mf-game__panel--errand" data-world-panel>` — 산 사람(목록 있음)은 ErrandDock, 아니면 내용 없음. GamePanel 은 errand 에서 그리지 않는다.
  - [처리]: `actableId !== null && canSend` 일 때만 `send({ t: "errand" })`. 반경 밖은 아무 일도 없다(알림 없음).

## 시험 결과

- Task 1 verify: `worldStore·worldStage·roomScreen` 342 통과(근처 snap 7·런타임 직접 6 신규).
- Task 2 verify: `worldStage·errandParts·stageBox` 295 통과(errand 층 11 신규).
- Task 3 verify: `errandScreen·gameMap·callGlow·phaseScreens·errandParts` 통과, errandScreen 18 신규. `nightMap` 1건 실패는 아래 "범위 밖 발견".
- `npm run typecheck` 오류 0.
- `npx vitest run test/unit test/client`: 6740 통과·1 실패(위 nightMap 건 하나).
- 인수 기준: store `near` 적중 2+, runtime `onProject|walkTo` 3+, 시험 `near` 1+, WorldStage `data-near-ring|mf-world__errand` 3, game.css `mf-world__errand|mf-world__ring` 6, 새 블록 hex 0, GameMap `ErrandDock|errandProgress` 4, `t: "errand"` 1, errand 분기 `me.role|allies` 0.
- 계획 검증 요청: 이 계획의 6개 커밋(652d7e79, bb491cc6, 29ee4d4e, 89145451, 61d593df, a1cde4bf) 모두 `git show --stat --format=%h -- worker shared` 가 비어 있다.
- 위생: 금지어 grep 새 적중 없음.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 계획 내 결함 예방] near snap 이 moveSeqs 를 비우지 않는다**
- 계획은 "기존 규칙 유지" 만 적었으나 snap 분기의 `moveSeqs.clear()` 를 그대로 두면 errand 에서 1초마다 오는 near snap 마다 `own.observe` 가 seq < base 로 "reset" 해 걷는 중의 예측 구간과 링을 끊는다. near snap 은 남은 좌석의 세기를 유지하고 빠진 좌석만 지운다(시험으로 고정).

**2. [Rule 1 - 계약 정리] `runtime.walkTo` 반환값**
- 계획 인터페이스는 `walkTo(x,z): void` 였으나 move 전송은 WorldStage 가 하므로 tap 과 같이 `{x,z}|null` 을 돌려주고 WorldStage 의 공유 `sendWalk` 가 보낸다(서버 메시지는 move 하나뿐이라는 계획 의도 그대로). `errand.onWalk` 는 필수가 아니라 선택 알림으로 두었다.

**3. [Rule 3 - 타입] 링 svg 숨김**
- SVG 요소에는 `hidden` 속성 타입(및 기본 스타일)이 없어 처음 마운트 값과 프레임 쓰기를 `style.display` 로 했다. 시험은 `ring.style.display` 를 본다.

**4. [Rule 1 - 계획 내 문장] 표지 걷기 시험의 좌표**
- 서버 이동 한계(MOVE_COORD_LIMIT 700)에 걸리지 않도록 시험 장소 좌표를 x=5 로 잡았다(제품 코드 변경 없음, bar 맵 장소는 모두 한계 안).

### 범위 밖 발견 (이 계획이 만들지 않음)

- `test/client/nightMap.test.tsx` "산 마피아는 밤에 바닥을 눌러 걷는다(NIGHT-07)…" 가 실패한다. 동시에 실행된 15-03 의 커밋 36443193 이 `canMoveIn` 에서 밤 마피아 걷기를 없앴기 때문이다(`shared/game/movement.ts` 주석: "클라이언트 GameMap 호출이 15-08 에서 바뀐 뒤 지운다"). 이 시험(마피아 밤 걷기 기대)과 GameMap 의 `canMoveIn(..., view.me.role === "mafia")` 호출은 15-08(밤 화면) 몫이라 건드리지 않았다. GameMap 의 이 호출은 errand 분기가 아니라 기존 줄이다.

## 이월 메모 (다음 계획용)

- **15-06/09 (E2E 선택자)**: 표지 `button[data-errand-place="{id}"]`(+`data-done`·`data-call`·보일 때 `hidden` 아님, 투영 transform), 화살표 `[data-errand-arrow]`(+`data-call`), 링 `svg[data-near-ring="3"]`(숨김은 `style.display:none`). 아래 패널은 `section.mf-game__panel--errand[data-world-panel]` 안의 `[data-errand-dock]`. 표지를 눌러도 처리 메시지는 가지 않고 move 가 간다. 렌더 후 표지가 보이는 것은 첫 프레임 뒤다(처음 마운트는 모두 hidden).
- **15-08**: `GameMap` 의 `canMoveIn(view.phase, meAlive, view.me.role === "mafia")` 호출을 두 인자로 줄이고(movement.ts 의 `_isMafia` 도 지운다) nightMap 의 밤 마피아 걷기 시험을 "누구도 못 걷는다" 로 바꿔야 한다. 밤 world 는 본인 한 칸뿐이다(15-03).
- **15-07**: 목격 기록·흔적 층은 이 계획이 만든 errand 층·`ErrandLayerProps` 와 별개다. errand 층은 `props.errand` 가 있을 때만 DOM 에 있다.
- **15-10 (결정 0074)**: ① 투영은 런타임 onProject 한 곳, DOM 직접 쓰기(React 상태 없음) ② near snap 은 moveSeqs 를 유지 ③ 표지 위치 중심 −22·화살표 −18, 독 줄·호스트 사각형 250ms 캐시 ④ 링은 24점 월드 반경 3(ERRAND_NEAR_R) 점선 정지 ⑤ 유령 패널은 높이 84 빈 section ⑥ errand 빛은 위치·진행으로만. 성능(5분 평균 55fps)은 15-10 에서 재야 한다.
- **알려진 한계**: 내 위치 표본은 서버 구간(`store.positionOf`) 기준이라 내 예측 구간보다 한 박자(수십~수백 ms) 늦게 [처리]·빛이 바뀐다(서버 판정과는 같다). 위치 표본 훅은 errand 단계에서만 돈다.

## Known Stubs

없음. (표지 아이콘은 15-04 의 임시 선 그림이며 같은 이름의 경로만 나중에 바꾼다.)

## Threat Flags

없음 — 새 네트워크 표면 없음. T-15-19(near snap 통째 교체·반경 밖 좌석이 seats·segOf·positionOf 에 없음을 store 시험이 고정, 보조 표시 없음), T-15-20(역할만 바꾼 네 렌더의 아래 패널 HTML·속성 집합·errand prop 이 같음, errand 분기·useErrandPos 에 역할 읽기 0), T-15-21(층 pointer-events none·표지 버튼만 auto, 장소 id 닫힌 집합), T-15-22(프레임 쓰기 3+1+24점, 값이 같으면 쓰지 않음)를 시험·구조로 고정했다.

## Self-Check: PASSED

- 파일: src/net/useErrandPos.ts, test/client/errandScreen.test.tsx, 수정 파일 8개 FOUND
- 커밋: 652d7e79, bb491cc6, 29ee4d4e, 89145451, 61d593df, a1cde4bf FOUND
