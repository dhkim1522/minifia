---
phase: 17-tutorial-first-case
plan: "08"
subsystem: tutorial
tags: [tutorial, opening, role-cards, tdd, tracer, motion]
status: complete

requires:
  - phase: 17-05
    provides: TutorialScreen 의 renderSceneLayer 겹침 자리·장면 시계(startAt)·감독 훅과 정적 가드
  - phase: 17-04
    provides: 무대 장면(WorldStage 직접) 렌더·onReady 뒤 시계·TutorialNext
  - phase: 17-03
    provides: tutorialStageLook(1·7)·OPENING_LAMPS·장면 표(tut.lampOff·tut.scream·tut.flip 시각)
provides:
  - "src/components/v2/OpeningFx.tsx: OpeningFx({ victimAt })·MeasuredOpeningFx·useVictimAt — 램프 번짐 둘·어둠·진홍 번쩍임 1회·소리 링 셋·제목 '밤이 되었습니다'"
  - "src/components/v2/TutorialRoleCards.tsx: TutorialRoleCards() — [data-tutorial-role-card=citizen|mafia|doctor|police] 4장 2×2, 뒷면 마름모에서 뒤집기, 배지 대표 움직임"
  - "V2Icon mask·shield·lens(Roles.dc.html 경로 그대로)"
  - "TutorialScreen 장면 1 무대 모양 시각 전환(2.6초 서연 사라짐·3.3초 밤 조명)·장면 7 직업 카드 층·직업 그림 미리 받기(preloadRoleAssets)"
  - "tutorial.css .tut-opening*·.tut-roles·.tut-role* 와 모션 줄이기 규칙"
affects: [17-09, 17-10]

actuals:
  tokens: 14000
  tasks: 2
  commits: 4
plan_head_before: 021e4c13b63f44982d16e83d181f04cbf177a23d
plan_head_after: b6784fb34cf67f3465c382953f4a2c774ad0398c

tech-stack:
  added: []
  patterns:
    - "연출 층(OpeningFx)은 무대가 준비돼 장면 시계가 선 뒤에 마운트한다 — CSS 시간표(램프 0.8·1.3초·번쩍임 2.6초)와 대본 시계가 같은 때 시작한다"
    - "장면 1 무대 모양은 {at, step} 상태로 들고 at(장면 시계 시작)이 다르면 0 으로 읽는다 — 다시 보기로 장면 1 에 다시 들어와도 저절로 깨끗하다"
    - "서연 자리는 이름표 DOM 사각형을 rAF 로 재서 오버레이 안 px 로 바꾸고, 한 번 쟀으면 이름표가 사라져도 마지막 값을 쓴다(못 쟀으면 시안 비율 15%·70%)"
    - "직업 카드는 상수 표(CARDS)와 지연 표(FLIP_DELAYS_MS)뿐이고 view·역할을 받지 않는다"

key-files:
  created:
    - src/components/v2/OpeningFx.tsx
    - src/components/v2/TutorialRoleCards.tsx
    - test/client/tutorialOpening.test.tsx
  modified:
    - src/screens/TutorialScreen.tsx
    - src/components/v2/V2Icon.tsx
    - src/styles/tutorial.css
    - test/client/icon.test.tsx

key-decisions:
  - "서연이 사라진 뒤(2.6초) 이름표도 숨긴다 — 런타임은 몸 불투명도(SeatLook.opacity 0)만 따르고 이름표는 흐려지지 않아 빈자리에 '서연' 이름표가 떠 있게 된다. 화면 루트에 data-tutorial-gone=2 를 달고 CSS 가 그 이름표만 visibility hidden 으로 가린다"
  - "뒤집기는 뒷면 마름모 → 90°(모서리) → 앞면의 두 단계 한 키프레임(.6초)이다: 카드가 0→90° 돌고 50% 에서 뒷면 층이 사라지며 -90°→0 으로 앞면이 돌아 나온다. 계획의 'rotateY(90deg → 0)' 한 줄로는 뒷면에서 앞면으로 바뀌는 순간이 없어서다"
  - "모션 줄이기의 오프닝 어둠은 .9 로 정지했다가 3.3초에 바로 걷힌다(10ms 불투명도 한 단계, 움직임 없음). 번쩍임·링·램프 번짐은 부품이 아예 만들지 않는다"
  - "직업 카드 높이는 minmax(clamp(168, 남는 높이/2, 252), auto)다 — 작은 폰에서 글이 168 에 안 들어가면 잘리지 않고 늘어난다. 한 줄 설명은 두 줄로 자르지 않는다(폭 360 에서 3줄이 될 수 있다)"
  - "아래 줄 '낮에는 모두 함께 투표해요'에는 시안의 해 아이콘을 두지 않았다 — 계획이 새 아이콘으로 mask·shield·lens 셋만 정했다"
  - "preloadRoleAssets 는 장면 7 이 아니라 TutorialScreen 마운트 때 한 번 부른다 — 장면 7 까지 60~90초가 있어 그림이 미리 와 있다"

requirements-completed: []

coverage:
  - id: D1
    description: "장면 1 오프닝: 실제 무대 위 램프 번짐 둘(0.8·1.3초)·어둠·진홍 번쩍임 1회·소리 링 셋·제목, 2.6초 서연 사라짐·3.3초 밤 조명, 4.6초 뒤 장면 2 자동"
    requirement: TUT-03
    verification:
      - kind: unit
        ref: "test/client/tutorialOpening.test.tsx#장면 1 오프닝"
        status: pass
    human_judgment: true
    rationale: "시간표·개수·불투명도 상한은 시험이 고정하지만 번쩍임·어둠이 4초 안에 '밤이 왔다'를 느끼게 하는지는 실기기 눈 확인 몫이다"
  - id: D2
    description: "장면 7 직업 카드 4장(시민·마피아·의사·경찰) 2×2, 뒷면 마름모에서 뒤집기, 이름·한 줄·그림·배지 대표 움직임, 아래 줄은 높이 700 이상만, [다음] → 혼자 onEnd(done)"
    requirement: TUT-04
    verification:
      - kind: unit
        ref: "test/client/tutorialOpening.test.tsx#장면 7 직업 카드"
        status: pass
      - kind: unit
        ref: "test/client/icon.test.tsx#V2Icon 직업 배지 아이콘 (17-08)"
        status: pass
    human_judgment: true
    rationale: "작은 폰(360×560·640)에서 카드 아래·[다음] 겹침과 3초 규칙은 실기기 확인 몫이다(UI Considerations #14, 알려진 한계로 둠)"
  - id: D3
    description: "카드·오프닝은 고정 상수이고 진홍은 .tut-opening·.tut-role 선택자에만 있다(T-18), 모션 줄이기에서 움직임 없음"
    requirement: TUT-03
    verification:
      - kind: unit
        ref: "test/unit/tutorialStaticGuard.test.ts"
        status: pass
      - kind: unit
        ref: "test/client/tutorialOpening.test.tsx#모션 줄이기"
        status: pass
    human_judgment: false

duration: 약 25분
completed: 2026-11-09
---

# Phase 17 Plan 08: 오프닝·직업 카드 Summary

장면 1 은 실제 3D 광장에서 램프 번짐 둘이 꺼지고 어둠이 내려온 뒤 2.6초에 진홍 번쩍임 1회와 소리 링 셋 속에서 서연이 사라지고 3.3초에 밤 조명이 켜지며(4.6초 뒤 아침 장면으로 자동), 장면 7 은 시민·마피아·의사·경찰 카드 4장이 0.35초 간격으로 역할 카드 뒷면 마름모에서 뒤집히고 배지가 직업마다 대표 움직임 하나를 돈다.

## Accomplishments

- **트레이서(Task 1, 장면 1)**: `OpeningFx` 가 램프 번짐 `OPENING_LAMPS`(2)개(0.8·1.3초, 왼쪽·오른쪽 가장자리, 높이 26.7%)·전체 어둠(0.4초부터 0 → .9, 3.3초부터 dur-slow 로 걷힘)·진홍 번쩍임(서연 이름표 중심 radial, 2.6초에 1.4초 1회, 정점 .6)·소리 링 셋(0.25초 간격 1회)·제목(serif 36 light-moon, 0.3초 fadeup)을 그린다. TutorialScreen 은 무대 준비(onReady) 뒤 시계에서 2.6초에 `tutorialStageLook(1, {night:false, victimGone:true})`, 3.3초에 `{night:true, victimGone:true}` 로 실제 WorldStage 장면을 바꾼다. 서연이 사라진 뒤 이름표도 숨긴다. 사회자 문장은 재생 내내 0.
- **장면 7 직업 카드(Task 2)**: `TutorialRoleCards` 4장은 고정 표(CARDS)다 — `data-tutorial-role-card` 값 citizen·mafia·doctor·police, 접근성 이름 "{직업} 카드", 실제 역할 그림(`roleArtSrc`, 3:4 자리 고정·로드 후 불투명도만), 이름(시민 brass-200·마피아 crimson-300·의사 seat-3·경찰 seat-1), 한 줄, 지름 40 배지(눈 깜빡 3초·가면 진홍 연기 2.4초·방패 숨쉬기 1.8초·돋보기 훑기 2.6초). 뒤집기 지연 .1/.45/.8/1.15초(`--tut-flip-delay`), 소리 tut.flip 은 대본이 같은 시각에 낸다. 아래 줄 "낮에는 모두 함께 투표해요"는 창 높이 700 이상만. 마피아만 카드 테두리 crimson-700.
- **V2Icon** `mask`·`shield`·`lens`: Roles.dc.html icon 경로를 그대로(24 격자, 선 2).
- **모션 줄이기**: 오프닝은 번쩍임·링·램프 번짐 없이 어둠 정지 → 3.3초에 바로 걷힘·밤 조명, 직업 카드는 뒷면·뒤집기 없이 즉시 앞면, 배지 움직임 클래스 없음. 새 키프레임(`tut-opening-*`·`tut-role-*`)의 속성은 transform·opacity·filter 뿐이고 시험이 고정한다.
- **그림 미리 받기**: TutorialScreen 마운트 때 `preloadRoleAssets()` 한 번(혼자 하기에서도 장면 7 전에 그림이 온다).

## Task Commits

1. **Task 1 RED:** `fd549f15` — `test(17-08): 오프닝 연출 실패 시험`
2. **Task 1 GREEN (tracer):** `7821ae7a` — `feat(17-08): 오프닝 — 램프·비명·밤`
3. **Task 2 RED:** `a0df7d15` — `test(17-08): 직업 카드 실패 시험`
4. **Task 2 GREEN:** `b6784fb3` — `feat(17-08): 직업 카드 4종 뒤집기·대표 움직임`

## TDD Gate Compliance

- **Task 1 RED** (`fd549f15`): `npx vitest run test/client/tutorialOpening.test.tsx` — 12개 중 11개 실패. 실패 이유는 `expected  to have a length of 1 but got +0`(오프닝 층 없음)·`.tut-opening__flash 규칙이 있어야 한다: expected '' to match /animation:/`·`expected 'night' not to be 'night'`(장면 1 조명이 처음부터 night)·`Cannot read properties of undefined (reading 'style')`. 통과한 1개는 소리 시험(lampOff 두 번·scream 한 번·문장 0)으로, 대본이 17-04 부터 이미 하던 일이라 RED 대상이 아니다.
- **Task 1 GREEN:** tutorialOpening·tutorialScreen·tutorialScenes·tutorialGate·정적 가드 5파일 116개 통과, `npm run typecheck` 종료 코드 0.
- **트레이서 게이트:** Task 1 `<verify>` 는 자동 항목뿐(`HUMAN_VERIFY_MODE` 기본 end-of-phase, 자동 모드 아님)이라 재실행해 통과를 확인하고 `Tracer verified end-to-end — expanding` 으로 Task 2 에 들어갔다.
- **Task 2 RED** (`a0df7d15`): `npx vitest run test/client/tutorialOpening.test.tsx test/client/icon.test.tsx` — 13개 실패(`expected [] to deeply equal [ 'citizen', 'mafia', 'doctor', … ]`, `expected [] to deeply equal [ '100ms', '450ms', … ]`, `expected '건너뛰기소리 켜기' to contain '낮에는 모두 함께 투표해요'`, 아이콘 mask·shield·lens 의 path 없음, `preloadRoleAssets` 호출 0). 카드가 0장이라 for-each 가 비어 통과하던 시험 하나는 카드 4장 단언을 더해 실패하게 고친 뒤 RED 로 삼았다. 이미 참이던 항목은 tut.flip 네 번·1500ms 사회자 문장(대본이 17-04 부터 함).
- **Task 2 GREEN:** 6파일 167개 통과 → 시험 수정 1건(마피아 테두리 선택자 `.tut-role--mafia .tut-role__face`) 뒤 전부 통과. `npm run typecheck` 0, `npm test` 전체 통과(278 파일 통과·6 건너뜀, 7924 시험).
- REFACTOR: 없음.

## Acceptance Criteria

| 기준 | 결과 |
|------|------|
| Task 1: `test -f src/components/v2/OpeningFx.tsx` | PASS |
| Task 1: `grep -c "tut-opening" src/styles/tutorial.css` ≥ 1 | PASS (22) |
| Task 1: `npx vitest run test/client/tutorialOpening.test.tsx` 통과 | PASS |
| Task 2: `test -f src/components/v2/TutorialRoleCards.tsx` | PASS |
| Task 2: `grep -c '"mask"\|"shield"\|"lens"' src/components/v2/V2Icon.tsx` ≥ 3 | PASS (4, 아래 편차 참고) |
| Task 2: `grep -c "data-tutorial-role-card" src/components/v2/TutorialRoleCards.tsx` ≥ 1 | PASS (1) |
| Task 2: `npm test` 전체 통과 | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 서연이 사라진 뒤 이름표만 빈자리에 남음**
- **Found during:** Task 1 (WorldStage·runtime 읽기)
- **Issue:** `SeatLook.opacity` 0 은 몸만 투명하게 하고 이름표는 연출(fadeAt)만 따른다(runtime.ts 의 bodyFade·tagAlpha). 장면 1 의 3.3~4.6초에 밤 장면이 드러날 때 서연 이름표가 떠 있게 된다.
- **Fix:** 서연이 사라지는 2.6초부터 화면 루트에 `data-tutorial-gone="2"` 를 달고 tutorial.css 가 그 이름표만 `visibility: hidden`.
- **Files modified:** src/screens/TutorialScreen.tsx, src/styles/tutorial.css
- **Commit:** `7821ae7a`

**2. [Rule 3 - Blocking] 인수 기준 grep 이 한 줄 타입 목록만 세던 문제**
- **Found during:** Task 2 인수 기준 확인
- **Issue:** `grep -c '"mask"\|"shield"\|"lens"'` 가 1(타입 합집합 한 줄)이라 기준 ≥ 3 에 모자랐다.
- **Fix:** ICONS 표의 세 키를 따옴표 키(`"mask": [` 등)로 썼다(동작 동일, 다른 키와 표기만 다름).
- **Files modified:** src/components/v2/V2Icon.tsx
- **Commit:** `b6784fb3`

**Total deviations:** 2 auto-fixed (Rule 1 하나, Rule 3 하나). **Impact:** 동작·범위 변화 없음. 이름표 숨김은 계획에 없던 작은 CSS 한 줄과 속성 하나다.

## Open Items

- **알려진 한계(UI Considerations #14)**: 360×560·360×640 에서 직업 카드 아래가 [다음]과 겹칠 수 있다. 계획 가정대로 손대지 않았다. 아래 줄은 높이 700 미만에서 아예 없다.
- **실기기 눈 확인(끝 실테스트 몫)**: 오프닝 4초 연출의 분위기·번쩍임 세기, 서연 이름표 사라짐 시각, 뒤집기 두 단계 모양, 폭 360 에서 한 줄 설명이 3줄이 되는지.
- 직업 카드 한 줄 설명은 두 줄로 자르지 않는다(UI-SPEC 의 '두 줄까지'보다 글이 잘리지 않는 쪽을 택함).

## Known Stubs

없음. 오프닝·직업 카드의 글·개수는 모두 상수이고 실제 화면에 연결돼 있다.

## Threat Flags

없음. 새 네트워크 경로·입력·저장 없음(T-17-18 직업 카드는 상수 표라 view 를 받지 않음을 정적 가드가 자동으로 확인, T-17-19 번쩍임은 1회·1.4초·정점 .6 이하·모션 줄이기에서 없음을 시험이 고정).

## Next Phase Readiness

장면 1~7 이 모두 실제 부품 + 연출로 채워졌다. 17-09(E2E)가 튜토리얼 트리 밖에 `data-tutorial-role-card` 0건과 폰 폭별 화면을 확인한다. TUT-03·TUT-04 는 17-09·10·11 이 같은 ID 를 선언해 ready-ids 가 막혀 있어 표시하지 않았다.

## Self-Check: PASSED

- 파일: OpeningFx.tsx·TutorialRoleCards.tsx·tutorialOpening.test.tsx FOUND
- 커밋: fd549f15·7821ae7a·a0df7d15·b6784fb3 모두 HEAD 의 조상
