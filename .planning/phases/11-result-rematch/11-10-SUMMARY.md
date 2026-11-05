---
phase: 11-result-rematch
plan: "10"
subsystem: world-renderer / plaza-scene
tags: [plaza, map-scene, light-tune, clock, perf-entry, tdd, MAP-06]
requires: ["11-06"]
provides:
  - "buildPlazaScene·PLAZA_LIGHT_TUNE·PLAZA_CLOCK_HOURS (src/world/maps/plaza.ts)"
  - "MapScene 타입 (src/world/maps/types.ts)"
  - "렌더러 옵션 mapId, 런타임 deps.mapId(), stageLiftY(pos, mapId), STAGE_TOPS"
  - "?perf=1&map=plaza, perf-run --map bar|plaza"
affects: [11-13, 11-14]
tech-stack:
  added: []
  patterns: ["맵 장면은 같은 인터페이스(MapScene)로 빌더 하나 등록", "맵 id 는 렌더러 생성 때 한 번 정해지고 바뀌면 새 런타임", "맵별 무대 윗면은 Record<MapId, ...> 표"]
key-files:
  created:
    - src/world/maps/plaza.ts
    - src/world/maps/types.ts
    - test/unit/plazaScene.test.ts
  modified:
    - src/world/maps/bar.ts
    - src/world/palette.ts
    - src/world/threeRenderer.ts
    - src/world/runtime.ts
    - src/world/presence.ts
    - src/components/WorldStage.tsx
    - src/debug/perf/scenario.ts
    - src/debug/perf/perfScene.ts
    - scripts/perf-run.mjs
    - test/unit/camera.test.ts
    - test/unit/presence.test.ts
    - test/unit/perfScenario.test.ts
    - test/client/worldStage.test.tsx
decisions:
  - "MapScene 은 BarScene 별칭이 아니라 BarScene 을 바탕으로 한 타입이다: lights.pendantB 를 선택으로(광장은 가로등 점광원 하나), update(dt,t) 훅을 선택으로 더했다. BarScene 은 그대로 대입된다"
  - "PhaseTune 칸 대응: pendant = 가로등 점광원, emissive.room·glow.room = 가로등, emissive.vote·glow.vote = 시계탑 조명(시계판 두 면 + 조명 구 + 빛 무리). 시계판은 꺼진 단계에도 읽히게 바닥값 0.25"
  - "연장 판은 바닥 판(윗면 −0.01, 아랫면 −0.11) 바로 아래 y −0.115 에 둔다(bar 의 −0.01 은 광장 바닥 판과 겹쳐 깜박인다). PLATE_FAR·카메라 수치는 바꾸지 않았다"
  - "시계 바늘은 MapScene.update(dt,t) 훅 — threeRenderer.render 가 update 가 있는 맵에서만 performance.now() 로 dt 를 재 부른다"
  - "WorldStage 의 런타임 생성 효과 의존을 [] 에서 [mapId] 로: 같은 마운트 안에서 맵이 바뀌면 새 런타임이 새 렌더러를 만든다(RoomScreen 은 건드리지 않음)"
metrics:
  duration: "약 50분"
  completed: "2026-11-05"
status: complete
commits: 6
plan_head_before: 9691be3b571319871749b0b66cf473e4a40ac77f
plan_head_after: 952f173c
actuals:
  tokens: 40000
  tasks: 3
  commits: 6
---

# Phase 11 Plan 10: 시계탑 광장 장면 Summary

시계탑 광장 3D 장면(`buildPlazaScene`)을 재즈 바와 같은 인터페이스·예산으로 만들고, 렌더러·런타임이 방의 맵 id 로 장면·이동 예측 마스크·입장 방향·무대 윗면 높이를 고르게 했다. PLAYABLE_MAPS 는 그대로 `["bar"]` 라 제품 동작은 바뀌지 않는다(11-13 이 연다).

## 한 일

- **Task 1 (트레이서)**: `maps/plaza.ts` — 자갈 바닥·두 단 연단(윗면 0.46)·놋쇠 표시 8·시계탑·가로등 4·건물 앞면 4·벤치 2·나무 2 를 재질별 버텍스 컬러 병합으로. `threeRenderer` 가 `mapId` 로 빌더를 고르고, `runtime` 이 `deps.mapId()` 로 렌더러 생성·예측 마스크(`mapOf`)·입장 방향을 고르고, `WorldStage` 가 `view.map ?? "bar"` 를 넘긴다.
- **Task 2**: `PLAZA_LIGHT_TUNE` 일곱 단계(흐린 보랏빛 회색 낮, 진홍 없음, 가로등 배율 talk 0·vote 1·trial 0.06·night 0.7), 시계(setLighting 이 목표 시각, update 가 감쇠 3/초로 따라감, trial 분침 30초 주기), 사다리 0→5→0, `stageLiftY(pos, mapId="bar")` 와 `STAGE_TOPS`(bar 0.29·1.18, plaza 0.46·1.05).
- **Task 3**: 광장 빈 배경 시험(바닥 판 ±20, 연장 판), 정적 예산 시험(8명 의상 섞음 + 동시 동작 4), `?perf=1&map=plaza`, `perf-run --map`.

## 시험

- `plazaScene.test.ts` 신규 24건(구조·좌표·점광원 3·표·시계·사다리·정적 예산), `presence`·`camera`·`perfScenario`·`worldStage` 보강. 대상 시험 11개 파일 702건 통과, `npm run typecheck` 내 파일 오류 없음, `npm run build` 통과.
- 실제 WebGL 한 번 확인(작은 입구 점검, `perf-run --map plaza --minutes 0.25 --throttle 1 --outfits mix --burst 4`): 60fps·끊김 0·**calls 52**(상한 120)·**pointLights 3**·textures 3·삼각형 80,680. 스크린샷으로 talk·vote 가 광장으로 그려짐을 확인했다. 합격선 측정(5분·CPU 4×)은 최종 계획 몫.

## Deviations from Plan

### Auto-fixed / 조정

**1. [Rule 3 - 구조] MapScene 별칭 대신 확장 타입** — 계획은 `type MapScene = BarScene` 이었으나 광장에는 `pendantB` 점광원이 없고(점광원 3 이하) 시계 갱신 훅이 필요해 `Omit<BarScene,"lights"> & {...}` 로 두 칸을 선택으로 했다. BarScene 은 그대로 대입된다.

**2. [Rule 3 - 블로커] bar.ts 에 export 만 추가** — 계획이 허용한 대로 `Bundle`·`tf`·`under`·`makeGlowTexture`·`CHALK_POINTS` 에 `export` 키워드만 더했다(동작 불변, barScene 시험 통과).

**3. [Rule 1 - 버그 예방] 연장 판 높이** — 광장 바닥 판 윗면이 −0.01 이라 bar 식 plate(y −0.01)가 겹쳐 깜박인다. 연장 판을 −0.115 로 두고 시험으로 고정했다.

**4. TDD 순서** — Task 1 트레이서에서 일곱 단계 표·시계까지 한 번에 만들어 Task 2 의 장면·런타임 시험은 RED 없이 바로 통과했다(진짜 RED 는 `stageLiftY` 맵 인자 하나). 같은 이유로 Task 3 의 camera·정적 예산 시험도 처음부터 통과했다(회귀 보호용).

**5. WorldStage 효과 의존** — 맵 id 변경 시 새 런타임을 만들려고 `[]` → `[mapId]` 로 바꿨다(계획의 "key 로 다시 마운트"는 RoomScreen 영역이라 11-07/08 과 충돌을 피해 이쪽에서 처리). `renderer.ts`·`camera.ts`·`motion.ts` 는 변경이 필요 없어 건드리지 않았다(`predictSegment` 는 이미 map 인자가 있다).

### Out of scope (기록만)
- `npm run typecheck` 가 `test/unit/rematch.test.ts` 오류를 낸다 — 병렬 실행기 11-08 의 진행 중 작업이다. 이 계획과 무관해 건드리지 않았다.

## Known Stubs

없음. 조명·시계 값은 기본값(육안 조정은 999.6 실기기 묶음)이며 스텁은 아니다.

## Threat Flags

없음 (새 네트워크·인증 경로 없음. 맵 id 는 서버가 모두에게 같게 보낸 공개 값만 읽는다).

## 이월 메모

- 장면: `src/world/maps/plaza.ts` 의 `buildPlazaScene(budget)`·`PLAZA_LIGHT_TUNE`·`PLAZA_CLOCK_HOURS`. 공통 타입 `MapScene`(`maps/types.ts`, `update?(dt,t)`·`lights.pendantB?`). 조명 값은 기본값이라 실기기 묶음(999.6)에서 조정한다.
- 런타임: `WorldRuntimeDeps.mapId?(): MapId`(기본 bar, 생성 때 한 번 읽음). 렌더러 옵션 `mapId`. `stageLiftY(pos, mapId="bar")`·`STAGE_TOPS`. WorldStage 는 `view.map ?? "bar"` 를 넘기고 맵이 바뀌면 새 런타임을 만든다.
- 11-13: `PLAYABLE_MAPS` 를 `["bar","plaza"]` 로 바꿀 때 `leak.test.ts`·`mapPick.test.ts` 단언 수정, `window.__mfMap` 훅 추가, 맵 선택 화면은 11-13 몫. 광장 스폰은 yaw 없음(카메라 쪽 π/4).
- 성능 측정: 브라우저 `?perf=1&map=plaza`(`bar` 기본), `node scripts/perf-run.mjs --map plaza ...`(결과 파일 이름 끝 `-plaza`, JSON runner·params 에 map). 최종 계획이 광장 nightload·perf 를 한 번 돈다. 이 계획은 1회 점검만(calls 52·pointLights 3·60fps).
- 결과 단계 조명은 night + 이긴 팀 스포트라이트(O-9) — 광장도 같은 `setLighting("night")` 규칙을 쓴다. 광장 전용 새 연출 코드는 없다.
- 이 계획과 11-13 은 한 쌍이다. 광장이 빠져도 나머지 계획은 재즈 바만으로 온전하며, PLAYABLE_MAPS 가 잠겨 있는 한 제품에는 광장이 노출되지 않는다.

## Self-Check: PASSED

- 파일 존재: src/world/maps/plaza.ts, src/world/maps/types.ts, test/unit/plazaScene.test.ts 확인.
- 커밋 존재(6개): ccb18b2a, 2f511388, e5bb1e03, d5182486, f2ea43ce, 952f173c 모두 HEAD 의 조상.
