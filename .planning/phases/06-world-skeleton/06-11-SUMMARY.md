---
phase: 06-world-skeleton
plan: "11"
subsystem: world-character
tags: [three, merged-geometry, vertex-colors, character, emotes, outfits, tdd]

requires:
  - phase: 06-world-skeleton
    provides: "06-05 shared/game/world.ts MOVE_SPEED 1.8(걸음 위상 비례), 06-10 renderer.ts CharacterKit/CharacterHandle 구조(import 하지 않고 구조만 맞춤)"
provides:
  - "src/world/characterData.ts: 원본 character.js(결정 0048)의 FIGS 5·OUTFITS 9·EMOTES 9·EMOTE_KEYS 14·FACE_IDS 7·SKIN/EYE/MOUTH 값 그대로"
  - "src/world/character.ts: createCharacter(figIndex, outfit)·characterKit·figForSeat(seat % 5)·CHAR_SCALE 0.83·WALK_PHASE_RATE(11 × MOVE_SPEED / 1.245)·WorldCharacter(update·setYaw·setDim·applyOutfit·playEmote·setFace·meshCount·dispose)"
affects: [06-13-runtime, 06-14-perf-spike, 06-18-e2e, 10-outfit-emote-ui]

actuals:
  tokens: 16258
  tasks: 3
  commits: 6
plan_head_before: 692665ab5168c16287f88a595735683d96eddbb8
plan_head_after: 23566cd3a2d8ef2480b8fc348f4867844d684da0

tech-stack:
  added: []
  patterns:
    - "원문 create 의 부품을 한 번 장면 그래프로 조립한 뒤 관절 기준 행렬로 구워(인물별 1회 캐시) 보이는 부품만 mergeGeometries — 지오메트리·위치·색은 원문 코드 그대로"
    - "보이기 규칙(applyOutfit)은 부품 태그(hat:·face:·badge:·prop:·acc:·ear·hair·hatHair·tie)로 옮김 — 병합에 넣을 부품 고르기"
    - "버텍스 컬러 단일 공유 재질(roughness 0.8) + 투명 조각(돋보기 유리)만 별도 재질 + 발밑 원판 재질 = 고유 재질 3"
    - "열린 면(챙·후드)은 뒤집힌 복사본을 덧붙인 닫힌 지오메트리로 DoubleSide 와 같은 모양을 냄(재질을 하나로 유지)"
    - "병합 캐시: 몸통·팔·다리는 의상 키, 머리는 (의상, 표정) 키, 원래 색 배열을 들고 있어 setDim 은 재질을 건드리지 않음"

key-files:
  created:
    - src/world/characterData.ts
    - src/world/character.ts
    - test/unit/character.test.ts
  modified: []

key-decisions:
  - "열린 면 DoubleSide 재질 대신 뒤집힌 복사본을 지오메트리에 덧붙임 — 병합 재질 하나(FrontSide)로 챙·후드가 원문처럼 앞뒤에서 보임"
  - "update() 는 자세가 정한 표정이 바뀔 때만 표정을 적용(lastPoseFace) — 원문 applyPose 는 매 프레임 setFace 로 덮어써 바깥 setFace 가 무의미했으나, 서 있는 동안 바깥에서 정한 표정이 유지되게 함. 동작·걷기 전환 시에는 원문과 같다"
  - "idlePose 의 c.pos.x 는 root.position.x 로 대응(원문은 장면이 pos 를 갱신) — 캐릭터마다 숨쉬기 위상이 어긋나는 원문 동작 유지"
  - "FaceId 는 계획대로 string, 모르는 표정·동작·의상 이름은 무시/기본값(Object.hasOwn 으로 prototype 키 차단). 알려진 이름의 유니온은 KnownFaceId 로 추가 노출"
  - "돋보기 유리(투명)만 별도 메시 — 탐정 의상에서만 메시 8, 그 외 7"

patterns-established:
  - "RED 증거: tap-flat 출력 + 한 테스트 단언을 target 으로 넘긴다. toEqual 배열 비교의 여러 줄 diff 가 TAP 을 깨므로 스칼라/join 비교를 쓴다. 기록 파일은 프로젝트 안에 만들고 지운다"
  - "node 에서 장면 그래프·정점 색·dispose 스파이로 캐릭터 검사 — WebGL 불필요"

requirements-completed: [MAP-01, MAP-02]

coverage:
  - id: D1
    description: "기본 코트 인물이 관절 병합으로 한 명 보이는 메시 7개(관절 6 + 발밑 원판)이고, 공유 재질이며, 그림자를 던지지 않고, 원판 반지름 0.42·검정 0.3 이다"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "test/unit/character.test.ts#기본 코트 인물 하나 (트레이서)"
        status: pass
    human_judgment: false
  - id: D2
    description: "맵 위 크기 0.83, 머리 꼭대기 (2.45 + y) × 0.83, 걸음 위상 = 11 × MOVE_SPEED / 1.245 rad/s, 걷는 동안 다리가 위상을 따라 돌고, seat % 5 로 인물이 정해진다"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/unit/character.test.ts#기본 코트 인물 하나 (트레이서)"
        status: pass
    human_judgment: false
  - id: D3
    description: "의상 9종(모자는 잘린 머리카락, 후드는 귀 빠짐, 단발은 귀 없음, 마피아 선글라스·어르신 수염/흰 머리·후드 장갑, 소품 병합)과 표정 7종 병합 캐시·재사용, 전환해도 메시 수 불변"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "test/unit/character.test.ts#의상 9종 / 표정 병합 캐시"
        status: pass
    human_judgment: false
  - id: D4
    description: "setDim 은 채도 0 + 휘도 × 0.6 이고 투명하지 않으며 왕복·의상 전환에도 맞고, dispose 는 만든 지오메트리만 해제한다"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "test/unit/character.test.ts#끊긴 사람 표시 setDim / 해제 dispose"
        status: pass
    human_judgment: false
  - id: D5
    description: "동작 9종이 원문 키프레임·smoothstep(오차 < 1e-9)으로 돌고, 총 길이+hold 뒤 기본 자세로 돌아오며 걷기 시작이 동작을 끊는다"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/unit/character.test.ts#동작 9종"
        status: pass
    human_judgment: false
  - id: D6
    description: "병합한 인물이 원본 아티팩트와 같은 생김새로 보인다(모자가 머리를 덮는 방식, 단발 귀 없음, 눈썹 위치, 손이 얼굴에 닿지 않음) — 단일 재질(A1)로 피부/놋쇠 질감 차이가 합쳐진 것 포함"
    requirement: MAP-01
    verification: []
    human_judgment: true
    rationale: "WebGL 없이 장면 그래프·정점 수·색으로만 검사했다. 생김새 동일성은 06-14 의 시안 비교 스크린샷에서 사람이 판단한다(가정 A1)."

duration: 9min
completed: 2026-11-01
status: complete
---

# Phase 6 Plan 11: 3D 캐릭터 관절 병합 Summary

**원본 character.js(결정 0048)의 구·원통 인물 5명·의상 9종·표정 7종·동작 9종을 three@0.186.1 ES 모듈로 옮겨, 관절 단위 버텍스 컬러 병합으로 한 명 7 draw call(관절 6 + 발밑 원판)·공유 재질 하나로 만들었다.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-31T16:53:43Z
- **Completed:** 2026-10-31T17:03Z
- **Tasks:** 3 (트레이서 1 + auto/tdd 2)
- **Files:** 신규 3 (character.ts, characterData.ts, character.test.ts)

## 측정값 (기본 코트, 성능 게이트 입력)

| 항목 | 값 |
| --- | --- |
| 1인 보이는 메시 | 7 (몸통·머리·팔 2·다리 2 + 발밑 원판). 탐정(돋보기 유리)만 8 |
| 고유 재질 | 3 (병합 재질 · 발밑 원판 · 투명 조각 유리), 병합 재질은 모든 캐릭터가 공유 |
| 1인 정점 / 삼각형 | 지호·민준 5,717 / 8,986 · 서연 5,387 / 8,482 · 도윤 6,978 / 10,906 · 하은 6,648 / 10,402 |
| 8명(seat 0~7 = 인물 0,1,2,3,4,0,1,2) | draw call 56 · 정점 약 47.3k · 삼각형 약 65.2k |
| 의상별 삼각형(지호) | 코트 8,986 · 의사 8,998 · 누아르 10,906 · 경찰 11,202 · 마피아 11,398 · 기자 11,402 · 어르신 9,582 · 후드 11,606 · 탐정 14,134 |
| 키 | 지호 코트 1.73 (원본 약 2.1 × 0.83) |

삼각형은 원문 분할 수(머리 32×24, 머리카락 32×16 ×3, 얼굴 12×10 등)를 그대로 둔 값이다. 06-14 실기기 측정에서 정점 부하가 문제면 생김새를 바꾸지 않는 분할 수 축소가 첫 후보다.

## Accomplishments

- 원문 create 를 장면 그래프로 한 번 조립해 부품을 관절 기준 좌표로 구워(인물별 캐시) 두고, 의상·표정에 맞는 부품만 `mergeGeometries` 로 합침 — 치수·색·모자가 머리를 덮는 방식·단발 귀 없음이 원문 코드 그대로
- 의상 전환은 몸통·팔·다리 의상 키 캐시, 머리 (의상, 표정) 키 캐시 — 같은 조합으로 돌아오면 같은 지오메트리 객체 재사용
- setDim 이 재질을 건드리지 않고 병합 정점 색을 원래 색에서 다시 계산(채도 0 + 휘도 × 0.6), 켜고 끄기 왕복 후 원래 색 정확 복원
- 동작 9종 키프레임·smoothstep 보간을 원문 함수와 1e-9 이내로 일치시켰고, 걷기 시작이 동작을 끊음
- 06-10 렌더러 CharacterKit 모양(`create(figIndex, outfitId)` → root·update·setYaw·setDim·dispose)에 맞는 `characterKit`

## Task Commits

1. **Task 1: 트레이서 — 기본 코트 관절 병합·걷기·머리 높이** — RED `2e018d0` (test) → GREEN `19c0d6e` (feat)
2. **Task 2: 의상 9종·표정 캐시·어둡게·해제** — RED `9fb1cb0` (test) → GREEN `20ddb26` (feat)
3. **Task 3: 동작 9종 키프레임·걷기가 동작을 끊음** — RED `dabb4b3` (test) → GREEN `23566cd` (feat)

REFACTOR 커밋 없음(공개 함수에 한국어 JSDoc 이 GREEN 에 이미 포함됨).

## TDD Gate Compliance

세 작업 모두 RED(`test(06-11)`) → GREEN(`feat(06-11)`) 순서이다.

| RED | target test (gsd_run check tdd-red-evidence = RED_EVIDENCE_OK) | 의미 평가 |
| --- | --- | --- |
| 2e018d0 | `걸음 주기는 이동 속도에 비례한다…` (WALK_PHASE_RATE 0 ≠ 15.9036) | 뼈대 스텁(createCharacter 가 throw)이라 12개 모두 실패. 대상 테스트는 값 단언으로 실패 |
| 9fb1cb0 | `표정을 바꾸면 머리 병합 지오메트리가 바뀌고…` (같은 객체) | 빈 자리 스텁이라 10개가 단언 실패. 스텁이 빈 동작이라 메시 수 불변·모르는 이름·왕복 등 7개는 RED 에서도 통과(대상 아님) |
| dabb4b3 | `보간은 원문 smoothstep 과 1e-9 안에서 같다…` (오차 2.23) | playEmote 가 빈 자리라 4개 단언 실패, 나머지 3개(데이터 키 이름·모르는 동작·서 있는 표정)는 RED 에서 통과 |

RED 커밋에 src 뼈대 변경이 함께 들어 있다(import 실패를 피해 대상 테스트가 단언으로 실패하게 하려는 스텁).

## Files Created/Modified

- `src/world/characterData.ts` — 원문 값 그대로(머리 주석에 원본 경로·결정 0048)
- `src/world/character.ts` — 부품 굽기·관절 병합·자세·동작·표정·의상·어둡게·해제, characterKit
- `test/unit/character.test.ts` — 36개 검사(장면 그래프·정점 색·dispose 스파이·원문 기준 구현 비교)

## Decisions Made

- 열린 면(챙·후드·경찰 챙)의 원문 `DoubleSide` 재질은 뒤집힌 복사본을 지오메트리에 덧붙여 대신함 — 병합 재질을 하나(FrontSide)로 유지하면서 앞뒤에서 같은 모양으로 보임. 삼각형은 해당 부품만 2배
- `update()` 는 자세가 정한 표정이 바뀔 때만 표정을 적용 — 원문 applyPose 는 매 프레임 `setFace(p.face)` 라 바깥 `setFace` 가 다음 프레임에 지워짐. 10페이즈 UI 가 서 있는 캐릭터의 표정을 정할 수 있게 하되 동작·걷기 시작/끝 전환은 원문과 같다
- 숨쉬기 위상용 원문 `c.pos.x` 는 `root.position.x`(렌더러가 놓는 월드 x)로 대응
- 모르는 의상·동작·표정 이름은 `Object.hasOwn` 으로 걸러 무시(기본 코트·기본 표정 유지)

## Deviations from Plan

None - plan executed exactly as written. 위 Decisions 는 계획이 열어 둔 구현 선택이며 계약(truths, 인터페이스)을 바꾸지 않았다. `characterData.ts` 가 계획 목록 외에 `SKIN`·`EYE`·`MOUTH`·`PoseKey`·`Fig`·`Outfit`·`EmoteDef`·`KnownFaceId` 를 추가로 내보낸다(character.ts 가 쓰는 원문 데이터와 타입).

**Total deviations:** 0
**Impact on plan:** 없음.

## Issues Encountered

- `gsd_run check tdd-red-evidence` 가 `toEqual` 배열 비교의 여러 줄 diff 때문에 TAP 을 `Non-TAP data` 로 거부 → 테스트 단언을 스칼라(`join`) 비교로 바꿔 해결.
- 증거 기록 파일은 프로젝트 디렉토리 안에만 허용됨 → 임시 폴더를 만들고 검사 뒤 지움(커밋에 들어가지 않음).

## Known Stubs

None. 로비 제품 화면은 동작을 부르지 않는다(UI-SPEC); `playEmote` 는 06-14 성능 스파이크(clap·deny)와 10페이즈가 부른다.

## Threat Flags

None. 새 네트워크·인증·파일 경로 없음(T-06-25 완화: 관절 병합으로 1인 draw call 7, 공유 재질, 그림자 비투사, 병합 캐시; T-06-SC: 패키지 설치 없음).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 06-13 런타임: `characterKit.create(figForSeat(seat), "coat")` 로 만들고 `update(dt, t, moving)` 의 `headY` 로 이름표 높이, `setYaw`, `setDim`, `dispose` 사용. 걸음 주기는 `WALK_PHASE_RATE` 가 이미 MOVE_SPEED 에 비례.
- 06-14 성능 스파이크: 8명 = draw call 56·삼각형 약 65k·정점 약 47k 가 렌더 예산 입력. 생김새 동일성(D6)은 시안 비교 스크린샷으로 사람이 판단.

## Self-Check: PASSED

- 파일: `src/world/character.ts`, `src/world/characterData.ts`, `test/unit/character.test.ts` 존재
- 커밋: 2e018d0, 19c0d6e, 9fb1cb0, 20ddb26, dabb4b3, 23566cd 모두 HEAD 의 조상
- `npx vitest run --project unit test/unit/character.test.ts` 36/36 통과, 단위 전체 61 파일 1719 통과, `npm run typecheck` 통과
- 인수 조건 grep(createCharacter·characterKit·mergeGeometries·character.js 경로·applyOutfit·setDim·setFace·playEmote·throat·dance) 모두 성공

---
*Phase: 06-world-skeleton*
*Completed: 2026-11-01*
