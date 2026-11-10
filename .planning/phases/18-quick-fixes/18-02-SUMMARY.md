---
phase: 18-quick-fixes
plan: "02"
subsystem: world-lighting
tags: [lighting, moonColor, plaza, bar, phase-tune, tdd, sc-2]

requires:
  - phase: 06-bar-scene
    provides: PhaseTune 조명 표·applyLook (재즈 바 장면 빌더)
provides:
  - PhaseTune.moonColor — 단계별 방향광 색 필수 칸 (src/world/maps/bar.ts, 광장도 같은 타입)
  - 두 맵 applyLook 의 moon.color.set(t.moonColor) — 단계 전환마다 방향광 색 갱신(광원 수 그대로)
  - 광장·재즈 바 talk·morning·vote 새 조명 값(흐린 보랏빛 회색 + 따뜻한 햇빛)
  - test/unit/lighting.test.ts — 허용 범위 1~3·밤 네 행 불변 시험(두 맵)
affects: [18-07, tutorial-map-scenes]

actuals:
  tokens: 9000
  tasks: 2
  commits: 4

plan_head_before: 7b170908969b2e537f2ab45b73bdbf874037e448
plan_head_after: 5429e1182b7e3ab404a8e16fc0898ac14fb1bf3c
commits: 4

tech-stack:
  added: []
  patterns:
    - "방향광 색도 표 한 줄: applyLook 이 moon.intensity 와 같은 자리에서 moon.color 를 정한다 — 단계 값은 모두 조명 표에서 온다"
    - "허용 범위(채도·휘도비·색온도)를 표 값에 대한 단위 시험으로 고정하고, 밤 네 행은 4a5dabea 시점 값을 옮겨 적어 불변을 지킨다"

key-files:
  created:
    - test/unit/lighting.test.ts
  modified:
    - src/world/maps/bar.ts
    - src/world/maps/plaza.ts
    - test/unit/plazaScene.test.ts
    - test/unit/barScene.test.ts

key-decisions:
  - "moonColor 는 필수 칸으로 일곱 행 모두에 둔다 — trial·night·nightCitizen·nightGhost 는 TOKEN_COLORS.moon(#c9d4ff) 그대로"
  - "UI-SPEC 시작값이 자기 허용 범위를 어기는 다섯 곳은 범위를 지키는 값으로 시작한다(아래 표). 최종 조정은 18-07 렌더 측정 몫"
  - "튜토리얼 지도 장면은 실제 GameMap 이라 이 표가 튜토리얼 낮 장면도 같이 고친다(별도 조명 없음)"

requirements-completed: [SC-2]

coverage:
  - id: D1
    description: "단계 전환마다 방향광 색이 표를 따른다(만든 직후 talk, night 에서 달빛 남색, 다시 talk 에서 원래 색, 광원 수 그대로) — 광장·재즈 바"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "test/unit/plazaScene.test.ts#방향광 색이 단계 표를 따른다"
        status: pass
      - kind: unit
        ref: "test/unit/barScene.test.ts#방향광 색이 단계 표를 따른다"
        status: pass
    human_judgment: false
  - id: D2
    description: "talk·morning·vote 가 허용 범위 1~3(채도 ≤ 0.20, 배경 휘도비 광장 8배·바 6배, 색온도 R ≥ B)을 지키고 밤 네 행은 4a5dabea 값 그대로"
    requirement: "SC-2"
    verification:
      - kind: unit
        ref: "test/unit/lighting.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "낮·아침·저녁 지목이 렌더에서 낮과 밤으로 구분되어 보이는지(허용 범위 4 휘도 순서, 5 가독)"
    requirement: "SC-2"
    verification: []
    human_judgment: true
    rationale: "렌더로 재는 값은 18-07 의 측정과 사람 눈 확인 몫이다 — 이 계획은 표 값만 고정한다"
---

# Phase 18 Plan 02: 낮 조명과 단계별 방향광 색 Summary

**방향광 색을 단계 표(PhaseTune.moonColor → applyLook → DirectionalLight)에서 오게 하고, 광장·재즈 바의 낮·아침·저녁 지목을 흐린 보랏빛 회색 하늘 + 따뜻한 햇빛으로 바꿨다. 밤 네 행은 그대로다.**

## 수행한 일

- **Task 1 (트레이서)**: `PhaseTune.moonColor` 칸, 두 맵 `applyLook` 의 `moon.color.set(t.moonColor)`, 생성자 `new DirectionalLight(T.talk.moonColor, …)`. talk 새 값(광장 hemi 1.05π·moon 0.9π·sky `#aaa4b8/#5c566a/#807a8e`, 바 sky `#908aa4/#4a4058/#38324a`, 두 맵 moonColor `#eadfd0`).
- **Task 2**: morning·vote 값(두 맵), `lighting.test.ts` 를 morning·vote 까지 넓혀 허용 범위 1~3 전부와 순서 감각(hemi talk ≥ morning ≥ vote, 배경 휘도 talk > morning > vote)을 고정.
- 광원 개수(반구 1·방향 1·점광원 4)는 그대로라 셰이더 재컴파일이 없다.

## TDD 증거 (RED)

Task 1 RED (`a3835a8e`, PhaseTune 에 `moonColor?` 선택 칸만 두고 값 없음) — `npx vitest run test/unit/lighting.test.ts test/unit/plazaScene.test.ts test/unit/barScene.test.ts --reporter=tap-flat` 가 값 단언에서 실패(타입 오류 아님):

```
not ok - barScene > 방향광 색이 단계 표를 따른다…   expected '#c9d4ff' to be '#eadfd0'
not ok - plazaScene > 방향광 색이 단계 표를 따른다…  (같은 단언)
not ok - barScene > 조명 단계 데이터는…               expected [ '#524b84', … ] to deeply equal [ '#908aa4', … ]
not ok - lighting > 재즈 바 … 허용 범위 1             talk: expected 0.4318 to be less than or equal to 0.2
not ok - lighting > 재즈 바 … 허용 범위 2             talk: expected 1.822 to be greater than or equal to 6
not ok - lighting > … 허용 범위 3 / talk 새 값 / 밤 행 moonColor   expected undefined …
```

Task 2 RED (`e2d74878`) — morning·vote 가 지금 값으로 단언 실패:

```
광장 허용 범위 1  vote: expected 0.346 to be less than or equal to 0.2
광장 허용 범위 2  morning: expected 6.97 to be greater than or equal to 8
광장/바 허용 범위 3  morning: expected 201 to be greater than or equal to 255   (moonColor #c9d4ff)
바 허용 범위 1  morning: expected 0.327 to be less than or equal to 0.2
바 허용 범위 2  morning: expected 1.738 to be greater than or equal to 6
```

GREEN: `71186b2a`(Task 1), `5429e118`(Task 2). 전체 `npm test` 7960 통과, `npm run typecheck` 오류 0.

## 시작값 대비 조정 (UI-SPEC 시작값 → 실제 값)

| # | 곳 | UI-SPEC 시작값 | 실제 값 | 이유 |
|---|----|----------------|---------|------|
| 1 | 광장 vote sky[0] | #5c5078 (채도 0.333) | #625e72 (0.175) | 허용 범위 1 |
| 2 | 광장 morning moonColor | #dcd8e0 (R220 < B224) | #e0dad8 (R224 ≥ B216) | 허용 범위 3 |
| 3 | 바 morning moonColor | #dcd8e0 | #e0dad8 | 허용 범위 3 |
| 4 | 바 morning sky[0] | #7c7898 (0.211) | #7e7a96 (0.187) | 허용 범위 1 |
| 5 | 바 vote sky[0] | #3a3464 (0.480) | #3c3a48 (0.194) | 허용 범위 1 |

(바 vote moonColor 는 UI-SPEC 에 시작값이 없어 광장 vote 와 같은 해질녘 색 #d8b48a 로 채웠다 — 조정이 아니라 신규.)

## 최종 조명 표 (변경된 행)

| 맵 | 단계 | hemi / moon | moonColor | sky [하늘, 땅, 배경·안개] |
|----|------|-------------|-----------|---------------------------|
| 광장 | talk | 1.05π / 0.9π | #eadfd0 | #aaa4b8, #5c566a, #807a8e |
| 광장 | morning | 0.95π / 0.6π | #e0dad8 | #9a96ae, #4c485a, #6a6680 |
| 광장 | vote | 0.6π / 0.4π | #d8b48a | #625e72, #241a30, #2c2238 |
| 바 | talk | 1.1π / 0.85π (그대로) | #eadfd0 | #908aa4, #4a4058, #38324a |
| 바 | morning | 0.85π / 0.4π (그대로) | #e0dad8 | #7e7a96, #3a3446, #322c40 |
| 바 | vote | 0.7π / 0.55π (그대로) | #d8b48a | #3c3a48, #1c1428, #100d19 |
| 두 맵 | trial·night·nightCitizen·nightGhost | 그대로 | #c9d4ff | 그대로 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 바 "배경과 안개 색" 시험의 옛 talk 값**
- **Found during:** Task 1 GREEN
- **Issue:** `test/unit/barScene.test.ts` 의 "장면 배경과 안개 색은 같은 색이고 단계에 따라 바뀐다" 가 옛 talk 배경 `#15111f` 를 정확값으로 단언 — 새 talk 값 `#38324a` 와 모순(플랜이 열거한 깨지는 시험 목록에 없었다)
- **Fix:** 단언을 새 talk 배경 `#38324a` 로 갱신
- **Files modified:** test/unit/barScene.test.ts
- **Commit:** 71186b2a

**Total deviations:** 1 auto-fixed (시험 정확값 갱신). **Impact:** 없음 — 값 변경의 직접 결과.

## Known Stubs

없음.

## Threat Flags

없음 — 새 입력·경로 없음(조명 표 값과 색 설정 한 번뿐).

## 이월

- 허용 범위 4(렌더 휘도 순서)·5(가독)는 18-07 이 렌더로 재고 필요하면 이 값을 다시 고친다.
- 위생 검사(개인 작업 공통 지침의 위생 검사 명령)를 바꾼 파일에 돌려 결과 0.

## Self-Check: PASSED

- 파일: test/unit/lighting.test.ts, src/world/maps/bar.ts, src/world/maps/plaza.ts 존재
- 커밋: a3835a8e, 71186b2a, e2d74878, 5429e118 모두 HEAD 의 조상
- acceptance: `moon.color.set(t.moonColor)` 각 1, bar.ts moonColor 10, `"#d8b48a"` 각 1, bar.ts `"#e0dad8"` 1, `npm test` 전체 통과
