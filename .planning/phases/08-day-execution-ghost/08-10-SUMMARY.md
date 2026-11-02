---
phase: 08-day-execution-ghost
plan: "10"
subsystem: world-renderer-parts
tags: [tdd, tracer, three, character, ghost, hold-pose, ring, lighting, tension, camera-zoom]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-08 의 camera.ts zoom 인자·ZOOM_MAJORITY(1.08)와 presence.ts 의 LightingStage·GHOST_OPACITY(0.6)
provides:
  - character.ts WorldCharacter — setGhost(on, opacity?)·setOpacity(alpha)·holdPose("point" | null)·setRing(color | null)
  - renderer.ts — LightingPhase 다섯(talk·vote·trial·night·morning), CharacterHandle 의 같은 이름 optional 메서드, WorldRenderer 의 optional setTension·setZoom
  - maps/bar.ts — LIGHT_TUNE.trial·night·morning·tension({ lead, halfRoom }), 투명 원뿔 메시 trialCone, BarScene.setTension
  - threeCamera.ts configureCamera(…, zoom = 1), threeRenderer.ts setZoom·setTension
affects: [08-12 런타임 배선(presence 의 SceneLook 을 이 부품 호출로 옮김), 08-24 크롬 4× 스로틀 성능 측정, 실기기 백로그(조명 읽힘)]

actuals:
  tokens: 12000
  tasks: 3
  commits: 6
plan_head_before: 405ae5cd0c4159bbe0d627c810f8bce8a187f288
plan_head_after: 889ae0d184e309e4c354a53c79e68a691b530652

tech-stack:
  added: []
  patterns:
    - "공유 재질은 건드리지 않는다: 반투명이 필요한 캐릭터만 bodyMaterial.clone() 하나를 여섯 관절이 함께 쓰고, 끄거나 dispose 하면 그 복제 재질만 해제"
    - "단계 조명·긴장·예산을 applyLook 한 곳에서 합친다 — 셋 중 무엇이 바뀌어도 단계 값 위에서 다시 계산(긴장은 단계가 바뀌어도 유지)"
    - "새 광원 없이 장면 효과: 변론 한 줄기 빛은 투명 원뿔 메시, 긴장 선두 연출은 기존 무대 점광원을 옮기고 세기만 바꿈"
    - "동작 유지는 base → 유지 자세 → 재생 중 동작 순으로 쌓는다(유지 자세가 emotePose 의 base 가 되어 재생이 끝나면 유지로 복귀)"

key-files:
  created: []
  modified:
    - src/world/character.ts
    - src/world/renderer.ts
    - src/world/maps/bar.ts
    - src/world/threeRenderer.ts
    - src/world/threeCamera.ts
    - test/unit/character.test.ts
    - test/unit/barScene.test.ts
    - test/unit/cameraThree.test.ts

key-decisions:
  - "WorldRenderer 의 setTension·setZoom 은 optional 로 둔다 — 시험의 FakeRenderer 가 WorldRenderer 를 extends 하므로 required 면 가짜 객체를 모두 고쳐야 한다(계획의 '가짜 렌더러 호환'). 08-12 런타임이 ?. 로 부른다"
  - "원뿔 빛 메시는 trial 이면서 예산의 glows 가 켜져 있을 때만 보인다 — 빛 무리를 끄는 5단계에서는 같이 꺼 추가 투명 합성을 줄인다"
  - "고유 재질 수 시험의 상한을 12 에서 13 으로 올렸다 — 원뿔 빛은 정점 색·광원이 아닌 투명 가산 합성 재질이 따로 필요하다(시안처럼 박스마다 새 재질이 아니라는 취지는 그대로)"
  - "유령 기준 돋보기 유리(glassMaterial)는 복제하지 않는다 — 유령 복제 재질 하나만 두기로 한 계획 시험(dispose 한 번)을 지키고, 유리는 캐릭터 소품(돋보기)에만 달린다"
  - "2 단계 긴장의 실내 절반은 emissive.room 에만 곱한다(계획 문구 그대로). 빛 무리 쿼드(glow.room)는 단계 값 그대로 둔다"

requirements-completed: [DAY-04, DAY-05, GHOST-01]

coverage:
  - id: D1
    description: "setGhost: 그 캐릭터 관절만 복제 재질(transparent, opacity 0.6, depthWrite false), 다른 캐릭터·공유 bodyMaterial 불변, 발밑 원판 숨김, 끄면 공유 재질 복귀와 복제 재질 dispose 1회, 두 번 켜도 복제 하나, 켠 채 dispose 도 해제, setDim paint 병행"
    requirement: GHOST-01
    verification:
      - kind: unit
        ref: "test/unit/character.test.ts '유령 setGhost (GHOST-01)' (6 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "holdPose('point'): point 마지막 프레임을 3초 넘게 유지, POSE_BLEND_MS 에 걸쳐 섞여 들어가고 null 이면 평소 자세로 복귀, 유지 중 deny 한 번 재생 뒤 유지 복귀, 걷는 중에도 팔은 유지 자세"
    requirement: DAY-04
    verification:
      - kind: unit
        ref: "test/unit/character.test.ts '손가락 유지 자세 holdPose (DAY-04)' (6 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "setRing: 이름 'ring' 메시 하나를 root 에 붙이고 색만 바꾸며 투명 0.85·depthWrite false, 떼기·dispose 에서 지오메트리·재질 해제, meshCount +1"
    requirement: DAY-04
    verification:
      - kind: unit
        ref: "test/unit/character.test.ts '발밑 고리 setRing' (5 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "조명 단계 다섯: LIGHT_TUNE 행, 단계를 모두 바꿔도 광원 5개(새 광원 없음), 원뿔 메시는 trial 에서만 visible, 유령 8명(고리 포함) 있어도 호출 추정이 DRAW_CALL_BUDGET 이내, 새 단계 하늘 세 색이 talk 보다 밝지 않음"
    requirement: DAY-05
    verification:
      - kind: unit
        ref: "test/unit/barScene.test.ts '조명 단계 다섯 (trial · night · morning, 08-10)' (7 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "setTension: 1 = 점광원 (2.65, 3.0, 0) 선두 세기, 2 = 실내 emissive × 0.5, 0 = 단계 값·무대 중앙 복귀, 조명 단계를 바꿔도 유지, 초점 없으면 중앙"
    requirement: DAY-04
    verification:
      - kind: unit
        ref: "test/unit/barScene.test.ts '긴장 단계 setTension' (5 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "가정 A1 확인: zoom 1.08 에서 three Vector3.project 가 groundToScreen(zoom)과, 바닥 Raycaster 교점이 screenToGround(zoom)과 1e-4 이내로 같고(폰 6종 × 오프셋 × 표본 9점), 프러스텀은 PX_PER_UNIT × zoom 으로 나뉘며 offsetY 는 확대되지 않는 화면 픽셀"
    requirement: DAY-05
    verification:
      - kind: unit
        ref: "test/unit/cameraThree.test.ts '카메라 zoom = camera.ts zoom' (4 tests)"
        status: pass
    human_judgment: false
  - id: D7
    description: "전체: 앱·워커 타입 검사와 unit·client 프로젝트 전체(129 파일 4173 통과, 1 skipped 는 이전부터)"
    verification:
      - kind: command
        ref: "npm run typecheck; npx vitest run --project unit --project client"
        status: pass
    human_judgment: false
  - id: D8
    description: "새 조명 값(trial·night·morning·tension)의 읽힘과 분위기, 유령 반투명·고리가 실제 화면에서 보기 좋은지, 유령 8명의 실기기 성능"
    verification: []
    human_judgment: true
    rationale: "값은 기존 talk·vote 에서 파생한 시작값(가정 A2)이고 호출 수는 추정이다. 읽힘은 개발 뒤 실기기 확인에서, 성능 실측은 08-24 의 크롬 4× 스로틀 측정에서 본다(가정 A1)"

duration: 20min
completed: 2026-11-02
---

# Phase 8 Plan 10: 유령·유지 손가락·고리·단계 조명·확대 부품 Summary

**처형된 사람 한 명만 복제 재질로 반투명하게 만드는 setGhost, point 마지막 자세를 해제할 때까지 잡는 holdPose, 발밑 고리 setRing, 새 광원 없이 trial·night·morning 조명과 선두·과반 긴장, 그리고 three 정사영이 camera.ts 투영과 같은 배율임을 시험으로 확인한 zoom 을 렌더러 쪽에 준비했다.**

## Accomplishments

- **setGhost / setOpacity (GHOST-01)**: 켜면 `bodyMaterial.clone()` 하나(transparent, depthWrite false, opacity 기본 0.6)를 그 캐릭터 여섯 관절이 함께 쓰고 발밑 원판을 숨긴다. 끄거나 dispose 하면 복제 재질만 해제한다. 공유 재질과 다른 캐릭터는 전혀 바뀌지 않는다.
- **holdPose (DAY-04)**: point 의 마지막 프레임(`emotePose` 에 시간 무한대)을 목표 자세로 두고 POSE_BLEND_MS 동안 섞는다. 유지 중 재생한 동작은 유지 자세를 기준으로 계산돼 끝나면 유지로 돌아온다. 동작 표는 바꾸지 않았다.
- **setRing**: `RingGeometry` + `MeshBasicMaterial`(0.85) 고리 하나. 두 번째 호출은 색만 바꾸고, 떼기·dispose 에서 해제한다. 색은 호출자가 넘긴다(가정 A3).
- **조명 단계 셋과 긴장**: `LIGHT_TUNE.trial`(실내 5%·무대 전구 유지)·`night`(달빛 위주·무대 점광원 0·실내 15%)·`morning`(talk 보다 낮은 반구·채도 낮은 하늘)과 `tension { lead 12, halfRoom 0.5 }`. 변론 한 줄기 빛은 광원이 아닌 투명 원뿔 메시(`trialCone`)다. 광원 5개는 단계·긴장이 바뀌어도 그대로다.
- **카메라 zoom**: `configureCamera(…, zoom)` 이 프러스텀을 `PX_PER_UNIT × zoom` 으로 나눈다. `setZoom` 은 threeRenderer 가 저장해 다음 구성에 넘긴다. 08-08 이 남긴 가정 A1 을 시험으로 확인했다.

### 조명 시작값 (가정 A2, 실기기 확인 대기)

| 단계 | hemi | moon | stage | pendant(×talk) | emissive room / vote | glow room / vote | sky [하늘, 땅, 배경] |
|------|------|------|-------|----------------|----------------------|------------------|----------------------|
| trial | 0.35π | 0.2π | 8 | 0.05 | 0.05 / 1 | 0.05 / 1 | #3a3464 #1c1428 #100d19 (vote 와 같음) |
| night | 0.45π | 0.7π | 0 | 0.15 | 0.15 / 0.1 | 0.15 / 0 | #2c2c58 #15122a #0a0b16 |
| morning | 0.85π | 0.4π | 0 | 0.6 | 0.7 / 0.2 | 0.6 / 0 | #4d4a6e #26202c #14111b |
| tension | lead 12(vote 무대 8 의 1.5 배, 초점 위 높이 3.0), halfRoom 0.5 | | | | | | |

노출 1.25·안개 20~44 는 모두 talk 와 같다. 원뿔: 반지름 1.2·높이 3.1·무대 윗면에서 시작, 가산 합성 불투명도 0.12.

## TDD Gate Compliance

세 작업 모두 RED → GREEN 순서로 커밋했다(`type: tdd` 플랜 게이트 충족). REFACTOR 커밋은 없다.

| 작업 | RED 커밋 | GREEN 커밋 | RED 증거 |
|------|----------|------------|----------|
| 1 (트레이서) | 7d4e4d7 | 1c3db15 | character.test.ts 48개 중 6 실패(새 describe 전부) |
| 2 | 111766e | bbedc82 | 59개 중 10 실패(대조 시험 1개는 유지 없이도 통과하는 것이 맞아 통과) |
| 3 | cfcc192 | 889ae0d | barScene·cameraThree 39개 중 10 실패 |

**semanticAssessment**: 세 RED 모두 import 오류가 아니라, 빈 메서드·신규 단계 행 복사본·zoom 을 무시하는 configureCamera 같은 중립 뼈대에 대해 계획한 행동 단언이 실패한 것이다(예: `expected +0 to be close to -1.55`, `expected 14.50 to be close to 13.43`). 뼈대 없이 시험만 두면 `is not a function` 계열이 되어 모호하므로 08-08 과 같이 RED 커밋에 뼈대를 함께 넣었다. `gsd_run check tdd-red-evidence` 는 이 환경에서 따로 돌리지 않았다.

**트레이서 게이트**: 작업 1 GREEN 뒤 `<verify>` 를 다시 돌려 통과를 확인하고 확장했다(⚡ Tracer verified end-to-end — expanding).

## Task Commits

| 작업 | 커밋 | 내용 |
|------|------|------|
| 1 RED | 7d4e4d7 | test: 유령 setGhost 실패 시험 + 빈 메서드 뼈대 |
| 1 GREEN | 1c3db15 | feat: setGhost·setOpacity, CharacterHandle optional |
| 2 RED | 111766e | test: holdPose·setRing 실패 시험 + 뼈대 |
| 2 GREEN | bbedc82 | feat: holdPose·setRing |
| 3 RED | cfcc192 | test: 조명 다섯·긴장·zoom 실패 시험 + 뼈대 |
| 3 GREEN | 889ae0d | feat: 조명 행 셋·원뿔·setTension·setZoom·configureCamera zoom |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 내 시험의 인물 번호 범위 오류**
- **Found during:** Task 3 RED
- **Issue:** 유령 8명 시험이 `createCharacter(i)` 에 i = 0~7 을 그대로 넘겨 인물이 5명뿐인 FIGS 를 벗어났다(시험 자체 결함).
- **Fix:** `figForSeat(i)` 로 바꿨다.
- **Files modified:** test/unit/barScene.test.ts
- **Commit:** cfcc192

### 계획과 다르게 정한 것 (key-decisions 에도 기록)

- WorldRenderer 의 `setTension`·`setZoom` 은 optional(계획의 '가짜 렌더러 호환').
- 기존 시험 `고유 재질 수 ≤ 12` 를 13 으로 올렸다(원뿔 빛 재질 하나가 늘어남).
- 원뿔은 trial 이면서 예산 glows 일 때만 보인다.
- 돋보기 유리 재질은 유령에서 복제하지 않는다(알려진 한계 참고).

**Total deviations:** 1 auto-fixed (Rule 1), 4 설계 결정. **Impact:** 공개 이름·시그니처는 계획 그대로다.

### 실행 중 알림

`npx biome check` 를 한 번 불러 프로젝트에 없는 `biome@0.3.3` 이 npx 캐시에 내려받아졌다(프로젝트 파일·package.json·lock 은 변하지 않았고 git status 로 확인함). 이 레포에는 lint 스크립트가 없으니 이후 쓰지 않았다. 캐시(`~/.npm/_npx`)에 남은 항목은 필요하면 지워도 된다.

## Verification

- `npx vitest run test/unit/barScene.test.ts test/unit/cameraThree.test.ts test/unit/character.test.ts` — 98 통과
- `npm run typecheck && npx vitest run --project unit --project client` — 통과(129 파일 4173 통과, 1 skipped 는 이전부터)
- 인수 기준: `setGhost(on`·`setGhost?`·`holdPose(id`·`setRing(color`·`"trial"`(renderer.ts)·`setZoom`(threeRenderer.ts)·`setTension`(bar.ts) grep 성공, characterData.ts 변경 0, bar.ts diff 에 새 광원 0건(grep rc 1), 시험에 `.skip(`·`.todo(` 없음(rc 1), `test(08-10):` 커밋 3건
- 레포 위생 grep: `src` 에 결과 없음. `test/unit/gameRoom.test.ts` 의 `seatOrdered`(이름 일부가 대소문자 무시로 일치한 이전부터의 일반 식별자)만 걸렸고 이 계획과 무관함

## Known limitations

- 유령에서 돋보기 소품의 투명 유리 조각은 공유 glassMaterial 의 0.6 을 그대로 쓴다(몸이 0.3 이하로 더 흐려지면 유리가 몸보다 짙다). 유령 캐릭터가 돋보기 의상(경찰)을 입는 경우에 한한 사소한 차이이고 실기기에서 거슬리면 08-12 이후에 다룬다.
- "그리기 호출 ≤ 120" 시험은 WebGL 이 없는 환경이라 `info().calls` 대신 (보이는 메시 + 그림자를 드리우는 메시)로 추정한다. 실측은 08-24 몫이다.
- 단계 조명 값은 시작값이다. 특히 night 의 읽힘(반구 0.45π)은 실기기 확인 전이다.

## Known Stubs

없음.

## Threat Flags

없음. T-08-27(재질 복제·원뿔·고리 자원)은 캐릭터당 복제 하나·dispose 시험, 호출 추정 시험, 새 광원 0 diff 게이트로 고정했고, T-08-SC 는 패키지를 설치하지 않았다(위 npx 캐시 알림 제외 — 프로젝트 의존성 변화 없음).

## Next Phase Readiness

08-12 가 presence 의 SceneLook(조명·긴장·유령·고리·유지 자세·확대)을 `setLighting`·`setTension?.()`·`setZoom?.()`·`setGhost?.()`·`holdPose?.()`·`setRing?.()` 호출로 옮기면 된다.

## Self-Check: PASSED

- FOUND: src/world/character.ts(setGhost·holdPose·setRing), src/world/renderer.ts(trial·setTension·setZoom), src/world/maps/bar.ts(trial:·tension·trialCone), src/world/threeRenderer.ts(setZoom), src/world/threeCamera.ts(zoom), test/unit/barScene.test.ts, test/unit/cameraThree.test.ts, test/unit/character.test.ts
- FOUND 커밋: 7d4e4d7, 1c3db15, 111766e, bbedc82, cfcc192, 889ae0d
