---
phase: 21-cause-effect-missions
plan: "08"
subsystem: client-evening-ui
tags: [cause-effect, lamps, hold-press, host-line, call-targets, v2-icon, tdd]
status: complete

requires:
  - phase: 21-cause-effect-missions
    provides: "21-02 의 가로등 8곳·errandSpotsOf, 21-04 의 현장 지점(clueSpots)·day.scene·me.scene, 21-05 의 errand.hold 와이어, 21-07 의 lampView·가로등 3D"
provides:
  - "V2Icon flame·flameOff·footprint·window (UI-SPEC 새 아이콘 규격 경로, 선 2)"
  - "ErrandAct: label·icon·aria prop + onPress(hold) — 0.6초(ERRAND_HOLD_MS) 길게 누르기를 부품 안에서 가르고 떼는 순간 한 번만 알린다. 모든 역할이 같은 DOM"
  - "ErrandStartCard cause prop(\"오늘 켤 등불\"), roleHintOf(view)(마피아 본인 카드에만 \"길게 누르면 심지를 잘라요\")와 RoleCard·RoleCardSheet 의 hint 줄"
  - "hostLine 의 원인 흐름 키(errand.lamp.act·done, night.*.house 넷, scene.act·done·ghost, discussion.board), HostLocal.announcing, CallTarget places·houses·spots, CallTool inspect, 알림음 쌍 규칙"
  - "errandView: placeCentersOf 가 errandSpotsOf 로 가로등 중심을 읽음, spotCentersOf(현장 지점 월드 좌표), actablePlaceOf 제네릭화, LAMP_ACT_LOOK"
  - "WorldStage ErrandLayerProps callPlaces(안 켠 배정 등불 전부 깜빡임)·actLook·onAct(hold), GameMap 의 hold 전송(원인 흐름에서만 { t: \"errand\", hold: true })"
affects: [21-09, 21-10, 21-11]

actuals:
  tokens: 21000
  tasks: 3
  commits: 6

plan_head_before: fb740deb119eb0e1c04c4ea6bbaaa4d3a4c3fc47
plan_head_after: 56212d140223f057decf09e11aee642293fe9223
commits: 6

tech-stack:
  added: []
  patterns:
    - "길게 누르기 감지를 모든 역할의 같은 부품 안에: pointerdown 시각 → pointerup 에서 hold 판정·한 번 전송, 뒤따르는 click 은 삼킨다(키보드 click 은 hold false). 상태를 두지 않아 짧게·길게의 DOM 이 같다"
    - "문구·빛남 분기는 hostLine 한 곳의 causeOf(rulesetOf(modeOf(view)))뿐 — 역할을 읽는 곳은 밤 역할별 줄 분기뿐"

key-files:
  created:
    - test/client/lampParts.test.tsx
    - test/client/lampEvening.test.tsx
  modified:
    - src/components/v2/V2Icon.tsx
    - src/components/v2/ErrandAct.tsx
    - src/components/v2/ErrandStartCard.tsx
    - src/components/RoleCard.tsx
    - src/components/RoleCardSheet.tsx
    - src/screens/RoleReveal.tsx
    - src/game/roleText.ts
    - src/game/errandView.ts
    - src/game/hostLine.ts
    - src/components/WorldStage.tsx
    - src/screens/GameMap.tsx
    - test/unit/hostLine.test.ts
    - test/unit/errandView.test.ts
    - test/unit/e2eContract.test.ts
    - test/client/worldStage.test.tsx

key-decisions:
  - "새 문구 키는 기존 errand.act 의 문장을 바꾸지 않고 errand.lamp.act·errand.lamp.done 으로 따로 둔다 — 옛 확장판(원인 흐름 꺼짐)의 문장·시험이 그대로이기 때문"
  - "ErrandAct 의 hold 는 pointerup 에서 보낸다(pointerup 뒤 400ms 안의 click 은 삼킴). 일부 브라우저는 긴 누름 뒤 click 을 내지 않으므로 click 만으로는 길게 누르기를 받을 수 없다"
  - "hold 는 원인 흐름에서만 와이어로 보낸다(옛 확장판·기본판은 지금 메시지 { t: \"errand\" })"
  - "discussion.board 의 빛남은 지금까지처럼 chat 입력칸(UI-SPEC: [보드]는 빛나지 않고 닫힌 뒤 입력칸 빛남이 이어짐 — 보드 열림 상태는 21-11 이 다룬다)"

metrics:
  duration: 약 70분
  completed: 2026-11-15
---

# Phase 21 Plan 08: 저녁 등불 켜기 화면 Summary

확장판 저녁 화면의 클라이언트 쪽이 선다: 안 켠 배정 등불 표지 전부가 깜빡이고, 반경 안에서는 [켜기](불꽃 아이콘)가 빛나며, 짧게 누르면 `errand`·0.6초 길게 누르면 `errand + hold` 가 모든 역할에 같은 부품으로 간다. 시작 카드는 "오늘 켤 등불", 마피아 본인 역할 카드에만 "길게 누르면 심지를 잘라요" 한 줄이 있다. 밤·아침·토론의 사회자 문구 키와 빛남 대상(houses·spots)·알림음 쌍이 hostLine 한 곳에 정의됐고 21-09·21-10·21-11 이 소비한다.

## Accomplishments

- **Task 1 (부품):** V2Icon 넷, ErrandAct label·icon·aria·onPress(hold), ErrandStartCard `cause`, `roleHintOf` + RoleCard·RoleCardSheet·RoleReveal 의 `hint` 한 줄(마피아 본인·원인 흐름일 때만).
- **Task 2 (순수 규칙):** hostLine 의 원인 흐름 키 열 개, 저녁·밤·아침·토론 분기, `HostLocal.announcing`, `CallTarget` 세 갈래와 `CallTool` inspect, 처형 → 저녁 무음. errandView 는 서버와 같은 `errandSpotsOf` 로 가로등 중심을 읽고 `spotCentersOf` 로 현장 지점 좌표를 준다.
- **Task 3 (연결):** GameMap 이 `callPlaces`·`actLook`·`onAct(hold)` 를 WorldStage 에 넘기고, WorldStage 는 callPlaces 의 보이는 표지 전부를 `data-call`/`is-call` 로 깜빡이게 하며 알약이 서면 꺼진다(한 화면 한 종류). 알약은 `actLook` 으로 "켜기"·flame·"가로등에서 켜기".

## Task Commits

1. Task 1 RED `9e7e1fe0` test(21-08): 저녁 부품 실패 시험
2. Task 1 GREEN `dda6b487` feat(21-08): 저녁 부품 — 아이콘·[켜기] 길게 누르기·시작 카드·역할 카드 줄
3. Task 2 RED `b23bc817` test(21-08): 확장판 사회자 문구·빛남 실패 시험
4. Task 2 GREEN `230ceb4f` feat(21-08): 확장판 사회자 문구·빛남 규칙
5. Task 3 RED `28d247ad` test(21-08): 저녁 화면 연결 실패 시험
6. Task 3 GREEN `56212d14` feat(21-08): 저녁 등불 화면 연결

## TDD Gate Compliance

- **RED (Task 1):** `npx vitest run --project client test/client/lampParts.test.tsx --reporter=tap-flat` → **not ok 10 / 13**(아이콘 경로·라벨 prop·클릭·짧게/길게/취소 3건·시작 카드 cause·roleHintOf 3건). 이미 초록인 것은 prop 없는 "처리" 마크업 유지·outerHTML 동일(음성 단언)·cause 아닌 카드뿐. semanticAssessment: 실패는 구현 부재(`undefined` 함수·없는 prop)와 일치, import·구문 오류가 아니다.
- **RED (Task 2):** `npx vitest run --project unit test/unit/hostLine.test.ts test/unit/errandView.test.ts --reporter=tap-flat` → **not ok 12**(errandView 가로등 중심 1, hostLine P19-17 → 규칙 읽기 한 곳 1, 원인 흐름 줄 저녁·밤·아침·토론·길이 5, 빛남 저녁·밤·아침 3, 알림음 1, HOST-05 경로 1). 옛 확장판 저녁 줄·토론 빛남(chat)은 구현 전에도 참인 음성 단언이다.
- **RED (Task 3):** `npx vitest run --project client test/client/lampEvening.test.tsx test/client/worldStage.test.tsx --reporter=tap-flat` → **not ok 6**(lampEvening 4: callPlaces 빛남 2·actLook·hold 전송, worldStage 2: callPlaces 표지 전부 깜빡임·[켜기] 알약). 역할마다 같은 DOM·반경 밖 무전송·옛 확장판 단언은 음성이라 RED 에서 초록이었다.
- 세 task 모두 `test(21-08)` 가 `feat(21-08)` 보다 앞선다. REFACTOR 커밋 없음. `gsd check tdd-red-evidence` 분류기는 21-02~21-07 과 같이 따로 돌리지 않았다.

## 시험 결과 (실제 출력)

- `npx vitest run --project client` → **Test Files 92 passed, Tests 3133 passed | 77 skipped**
- `npx vitest run --project unit` → **Test Files 151 passed | 1 skipped, Tests 5026 passed | 107 skipped**
- `npm run typecheck` → exit 0 (error TS 없음)
- `npx vitest run --project worker`(이 계획이 shared·worker 를 안 건드렸지만 회귀 확인으로 돌림) → 전체 실행에서 test/worker/night.test.ts 의 기존 flaky 5000ms 시간 초과 2~3건(관전·탈락자 거부)만 실패, 같은 파일을 단독 실행하면 **19 passed**. 나머지 62개 파일 통과. 이 계획과 무관하다.
- 계약 대조: `grep -c "hold: true" GameMap.tsx` 1 · `grep -c '"places"' GameMap.tsx` 1 · hostLine 의 `kind: "(places|houses|spots)"` 3 · `errandSpotsOf` errandView 3 · `심지를 잘라요` roleText 1 · hex 새로 쓴 곳 없음.

## Deviations from Plan

### Auto-fixed / 계획과 다른 점

**1. [Rule 3 - Blocking] 옛 시험 계약 갱신(hostLine P19-17)**
- **Issue:** test/unit/hostLine.test.ts 의 "hostLine.ts 는 판 종류를 읽지 않는다(P19-17)" 가 이 계획의 `rulesetOf(modeOf(view))` 분기(계획이 명시)와 충돌.
- **Fix:** 단언을 "view.mode 직접 읽기 없음 + `rulesetOf(modeOf(` 가 코드에 정확히 한 곳"으로 바꿨다. 판 종류 읽기가 한 곳이라는 계약은 유지.
- **Files:** test/unit/hostLine.test.ts · **Commit:** b23bc817

**2. [Rule 3 - Blocking] "다른 키와 문장이 겹치는 키" 계산(hostLine 19-02, e2eContract 19-07)**
- **Issue:** 새 키 scene.done 이 errand.done 과 같은 문장("곧 토론이 시작됩니다")이라 `BASIC_FORBIDDEN_LINES` 대조(기본판 금지 문구 4개)가 깨졌다.
- **Fix:** 새 원인 흐름 키 열 개(기본판에서는 닿지 않는 키)를 "다른 키" 계산에서 뺐다(기본판 금지 문구 수 4·기본판이 새 키에 닿지 않는다는 단언은 추가). 사본 scripts/e2e/lib.mjs 는 건드리지 않았다.
- **Files:** test/unit/hostLine.test.ts, test/unit/e2eContract.test.ts · **Commit:** b23bc817, 230ceb4f

**2b. [Rule 2] 계획 files_modified 밖 변경**
- RoleCard.tsx·RoleCardSheet.tsx·RoleReveal.tsx: 마피아 카드 한 줄을 그리는 곳이 roleText 가 아니라 카드 컴포넌트라 `hint` prop 을 더했다.
- test/client/worldStage.test.tsx: 표지 `data-call`·[켜기] 알약 DOM 은 진짜 WorldStage 로만 볼 수 있어 errand 층 describe 에 시험 둘을 더했다(lampEvening 은 errandScreen 처럼 WorldStage 를 가짜로 둔다).
- ErrandMarker.tsx 는 바꾸지 않았다: `placeLabel` 이 이미 "가로등 장소" / "가로등 장소, 처리함" 을 만든다.

**3. 문구 키 이름:** UI-SPEC 표의 `errand.act`(확장판 문장 변경)는 옛 확장판 시험 보호를 위해 새 키 `errand.lamp.act`·`errand.lamp.done` 으로 구현(문장은 표 그대로).

**4. 아이콘 `window`:** 규격의 `<rect rx="1">` 은 V2Icon 의 부품 종류(원·경로)에 없어 같은 윤곽의 경로 `M5 5h14v14H5z`(모서리 반경 1 없음)로 그렸다. flameOff 의 "불꽃 gray-500 면 없음"은 면을 칠하지 않는 선 그림이라 해당 없음.

## Known Stubs / 미해결

- `HostLocal.announcing`·CallTarget `houses`·`spots`·CallTool `inspect` 는 정의와 시험만 있고 GameMap 이 아직 소비하지 않는다 — 21-09(밤 집)·21-10(아침 현장) 몫(계획대로).
- 저녁 표지 모양: UI-SPEC 은 36 원(누르기 44)이지만 기존 64 타일 표지(ErrandMarker)를 그대로 쓴다. 계획이 표지 모양 변경을 task 에 넣지 않았다. 시안 대조 후 크기를 줄일지는 이후 UI 검수에서 정한다.
- 길게 누르기의 실기기(터치) 동작은 happy-dom 시험으로 pointer 순서만 확인했다 — Android/iOS 에서 긴 누름 뒤 click 이 오지 않는 경우를 pointerup 이 처리하도록 짰지만 실기기 검증은 남았다.
- 스텁·TODO 로 목표를 막는 것은 없다.

## Threat Flags

없음 — 새 네트워크·인증·스키마 경계 없음(hold 필드는 21-05 가 이미 정의).

## Self-Check: PASSED

- 파일: lampParts.test.tsx · lampEvening.test.tsx · 21-08-SUMMARY.md 존재 확인
- 커밋 9e7e1fe0 · dda6b487 · b23bc817 · 230ceb4f · 28d247ad · 56212d14 가 HEAD 의 조상
