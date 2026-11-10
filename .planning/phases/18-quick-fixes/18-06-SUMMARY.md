---
phase: 18-quick-fixes
plan: "06"
subsystem: tutorial-screen
tags: [tutorial, spotlight, svg-mask, next-pill, ROLE_TEXT, clampPoint, tdd, sc-3]
status: complete

requires:
  - phase: 18-quick-fixes
    provides: 18-03 의 panelless·고정 카메라(스테이지가 늘어난 튜토리얼 지도 장면)
provides:
  - FocusRing 스포트라이트 층(svg mask, data-tutorial-dim·data-tutorial-hole), FocusGroup.lit, TUTORIAL_DIM_ALPHA = 0.5
  - TutorialNext 아래 가운데 알약(글 '다음' + chevronRight 20)과 장면 4 진행 점 숨김 규칙
  - 직업 카드 한 줄 = ROLE_TEXT[kind].desc, .tut-roles 아래 예약 96
  - clampPoint(p, w, h, inset = 8)와 장면 5 선 좌표 고정, .tut-links overflow hidden
affects: [18-08]

actuals:
  tokens: 21000
  tasks: 3
  commits: 6

plan_head_before: 0f8501e3c2687c654027543da1eb49e3c330d817
plan_head_after: 60965ad479ba11a025c43b5e9ef3ed50bca7558d
commits: 6

tech-stack:
  added: []
  patterns:
    - "스포트라이트: 측정 Box(+숫자 rx)를 그대로 mask 구멍으로 재사용 — 새 측정 루프 없음, 같은 same() 비교"
    - "lit 선택자: 같은 measure 로 재되 상자는 그리지 않고 구멍만 낸다"

key-files:
  created: []
  modified:
    - src/components/v2/FocusRing.tsx
    - src/screens/TutorialScreen.tsx
    - src/styles/tutorial.css
    - src/components/v2/TutorialNext.tsx
    - src/components/v2/TutorialRoleCards.tsx
    - src/components/v2/TutorialEvidence.tsx
    - test/client/focusRing.test.tsx
    - test/client/tutorialScenes.test.tsx
    - test/client/tutorialOpening.test.tsx

key-decisions:
  - "스포트라이트 마스크 id 는 고정 상수 tut-dim-mask 한 개(useId 의 콜론이 url(#…) 참조를 흔든다)"
  - "장면 4 lit 은 .mf-game__record 컨테이너 대신 실제 카드 .mf-game__record > .mv-record 를 쓴다"

requirements-completed: [SC-3]

coverage:
  - id: D1
    description: "포커스 상자가 있는 동안에만 대상 밖이 night-950 50% 로 어두워지고(흐림 없음) 구멍 = 상자 + lit 사각형. 장면 2·3·4·6 에서 1개, 5·7·[다음] 구간에서 0개"
    requirement: "SC-3"
    verification:
      - kind: unit
        ref: "test/client/focusRing.test.tsx#스포트라이트 (P18-5, D-04)"
        status: pass
      - kind: unit
        ref: "test/client/tutorialScenes.test.tsx#스포트라이트 구간 (P18-5, D-04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "[다음] 아래 가운데 알약(글 + chevron 20, transform 없는 가운데 정렬), 장면 4 진행 점 숨김"
    requirement: "SC-3"
    verification:
      - kind: unit
        ref: "test/client/tutorialScenes.test.tsx#[다음] 알약 (P18-6, D-05)"
        status: pass
    human_judgment: false
  - id: D3
    description: "직업 카드 한 줄이 ROLE_TEXT 와 같은 출처이고 정적 가드를 통과한다"
    requirement: "SC-3"
    verification:
      - kind: unit
        ref: "test/client/tutorialOpening.test.tsx#장면 7 직업 카드: 네 장 고정 2×2"
        status: pass
      - kind: unit
        ref: "test/unit/tutorialStaticGuard.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "장면 5 선 끝점이 화면 안쪽 8 안이고 선 층이 overflow hidden"
    requirement: "SC-3"
    verification:
      - kind: unit
        ref: "test/client/tutorialScenes.test.tsx#장면 5 선이 화면 안에서 끝난다 (D-07)"
        status: pass
    human_judgment: false
  - id: D5
    description: "첫 렌더의 쌓임(띠·머리·이름표 위아래 순서), 폰 6종 기하, 360×560·640 에서 장면 7 아래 줄과 [다음] 예약 겹침(알려진 한계)"
    requirement: "SC-3"
    verification: []
    human_judgment: true
    rationale: "jsdom 은 렌더 쌓임·실제 기하를 못 잰다. 18-08 이 폰 6종 E2E·스크린샷으로 z 값과 자리를 확인·조정한다"
---

# Phase 18 Plan 06: 튜토리얼 스포트라이트·[다음] 알약·직업 문구·선 고정 Summary

**포커스 상자 구간에만 대상 밖을 night-950 50% 로 덮는 svg mask 스포트라이트(흐림 없음), 아래 가운데 "다음" 알약, ROLE_TEXT 에서 읽는 직업 카드 문구, 화면 안쪽 8 로 고정되는 장면 5 선을 만들었다.**

## 수행한 일

- **Task 1 (트레이서, D-04)**: FocusRing 의 Box 에 숫자 `rx`(pill 은 height/2)를 더하고, 묶음의 lit 선택자를 같은 measure 로 따로 재어 구멍만 낸다. 포커스 상자가 하나라도 측정될 때만 `.tut-focus-layer` 맨 앞에 `svg.tut-dim[data-tutorial-dim]`(aria-hidden, pointer-events none, z = --z-overlay, dur-fast 불투명도 전환)을 그린다. 흰 전체 rect + 구멍별 검은 둥근 rect 의 mask(`tut-dim-mask`) 라 겹쳐도 밝고, 채움 fill-opacity 는 `TUTORIAL_DIM_ALPHA`(0.5). 모션 줄이기는 전환 없음. 장면 4 suspect 묶음에 lit(기록 카드·눈 표시)을 달았다. 구간은 기존 포커스 창 그대로라 장면 2(0~2.6초)·3·4(1.9~3.4초)·6 에서 켜지고 5·7·[다음] 구간에서 꺼진다.
- **Task 2 (D-05·D-08)**: `.tut-next` 를 `left:0; right:0; margin-inline:auto; width:min(240px, calc(100% - 48px)); height:56px; bottom:28px; radius-pill` 알약으로 바꾸고 안에 `.tut-next__label` "다음" + chevronRight 20(light-lamp)을 넣었다. transform 없이 가운데 정렬, `tut-fadeup` 등장, `::before` 테두리는 `border-radius: inherit`. `[data-tutorial-screen]:has([data-tutorial-next]) .mv-errand-dots { display: none; }` 로 진행 점을 숨긴다. 직업 카드 한 줄은 `ROLE_TEXT[c.kind].desc`, `.tut-roles` 아래 padding 96.
- **Task 3 (D-07 선 부분)**: `clampPoint` 를 TutorialEvidence 에 export 하고 measureLines 의 from·to 를 고정했다(선 색·굵기·시간·수식 줄은 그대로). `.tut-links` 는 overflow hidden.

## TDD 증거 (RED)

세 번 모두 `gsd_run check tdd-red-evidence` 가 `RED_EVIDENCE_OK`(`target_test_failed`).

- Task 1 RED (`3561cdd8`) — `npx vitest run test/client/focusRing.test.tsx test/client/tutorialScenes.test.tsx --reporter=tap-flat`: 스포트라이트 단언 실패(`expected +0 to be 1` — 막이 아직 없음, CSS 규칙 없음). 의미 점검: 자리 상수(TUTORIAL_DIM_ALPHA·lit)만 있고 렌더가 없어 대상 시험이 계획한 단언에서 실패했다. import·타입 오류 아님.
- Task 2 RED (`08b990b2`) — 5 개 실패(`.tut-next` 알약 규칙·라벨·진행 점 숨김·직업 문구 ROLE_TEXT·`.tut-roles` 96). 의미 점검: 단언 실패, 시험 로드 오류 아님.
- Task 3 RED (`49f07093`, 자리 함수 clampPoint 는 입력 그대로) — 3 개 실패(clamp 값·선 좌표·overflow). 의미 점검: 단언 실패.

GREEN: `5524b301`(Task 1), `579666ba`(Task 2), `60965ad4`(Task 3). `npm run typecheck` 오류 0, `npm test` 8009 통과·261 건너뜀.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 장면 4 lit 선택자를 카드 본체로**
- **Found during:** Task 1
- **Issue:** 계획의 `.mf-game__record` 는 띠 아래부터 화면 아래 예약선까지 늘어나는 pointer-events none 컨테이너다. 구멍으로 쓰면 카드 한 장이 아니라 큰 영역이 밝아져 스포트라이트 의도(상자·카드·눈만 밝게)가 깨진다.
- **Fix:** `.mf-game__record > .mv-record`(실제 RecordCard 루트)로 바꿨다. 눈 표시는 계획대로 `[data-tutorial-eye]`.
- **Files modified:** src/screens/TutorialScreen.tsx
- **Commit:** 5524b301

**2. [Rule 3 - 차단] RED 시험 단언을 한 줄 TAP 으로**
- **Found during:** Task 1 RED
- **Issue:** `toMatch` 정규식 단언과 `\"` 이스케이프·테스트 이름 속 `#` 가 TAP 분류기에서 `invalid_record` 로 거부됐다(18-03 과 같은 증상).
- **Fix:** 단언을 `expect(조건).toBe(true)` 형태로, 테스트 이름에서 `#` 를 뺐다(시험 의도 동일).
- **Files modified:** test/client/focusRing.test.tsx 외 시험 파일
- **Commit:** RED 커밋에 반영

**Total deviations:** 2 auto-fixed. **Impact:** 없음(구현 범위·인수 기준 동일).

## Issues Encountered

None. (알려진 불안정 bots.test 는 이번 `npm test` 에서 통과했다.)

## Known Stubs

None.

## Threat Flags

None — 새 네트워크·인증·파일 접근 경로 없음. T-18-13(ROLE_TEXT 정적 표, tutorialStaticGuard 통과)·T-18-14(기존 rAF 루프·same() 재사용)·T-18-15(막 pointer-events none·aria-hidden)로 확인.

## 다음 계획에 넘길 것

- 18-08: 폰 6종에서 스포트라이트 z 순서(띠가 어두워지거나 머리가 안 어두워지면 `.tut-dim` z 값만 조정, RESEARCH 가정 A1), 구멍이 상자·기록 카드·눈 표시에 맞는지, [다음] 알약이 360 폭에서 240 인지, 장면 7 직업 카드 아래 줄과 [다음] 예약(96) 겹침(UI Considerations #12 — 알려진 한계 유지)을 확인한다.

## Self-Check: PASSED

- 수정 파일 9개 존재, 커밋 6개(3561cdd8, 5524b301, 08b990b2, 579666ba, 49f07093, 60965ad4) HEAD 의 조상.
- 인수 기준: `data-tutorial-dim` 1, `TUTORIAL_DIM_ALPHA = 0.5` 1, `tut-dim` 4(≥3), `lit: [` 1, `tut-next__label` 1, `ROLE_TEXT` 3(≥2), `min(240px, calc(100% - 48px))` 1, `.mv-errand-dots { display: none; }` 1, `export function clampPoint` 1, `clampPoint(` 3(≥3). 각 task 의 vitest·typecheck·전체 `npm test` 통과, 위생 git grep 0.
