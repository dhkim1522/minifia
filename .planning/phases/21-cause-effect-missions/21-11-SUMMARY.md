---
phase: 21-cause-effect-missions
plan: "11"
subsystem: evening-lamp-screen
tags: [ui, dock, errand, hold, skip, scene-dock]
requires:
  - phase: 21-cause-effect-missions
    provides: 21-05 의 errand hold 처리, 21-06 의 skipPhase·day.skipCount·me.skipPhase, 21-09 의 가로등 장소(lamp0~7)·lampLit, 21-10 의 저녁 노을 조명
provides:
  - SceneDock(저녁·아침 독) — 읽기 전용 기록 두 줄 + 금빛 [켜기](0.6초 길게 누르기 hold) + [건너뛰기] 토글, 역할 prop 없음
  - 확장판 저녁 화면 배선(독·[켜기] 반경 판정·진행 점 '등불 n/3'·시작 카드 '오늘 켤 등불'·켠 타일 불꽃 배지)
  - DOCK_H·DOCK_ROW_H·HOLD_MS 상수, 루트 --mf-dock-h 변수, ErrandLayerProps.dock 플래그
affects: [21-12, 21-13, 21-17]
requirements-completed: [D-05, D-06, D-23, D-24, D-27]
actuals:
  tokens: 12300
  tasks: 2
  commits: 4
plan_head_before: bb3d1c26df45d64d8d6c26648ed804fbcbc795c5
plan_head_after: dddfef3af7db878b17b22b817f04eed10361a651
commits: 4
tech-stack:
  added: []
  patterns:
    - "독 부품에는 역할 prop 이 없고 [켜기]의 채움 막대·마크업·속성이 누구에게나 같다. 길게 눌렀는지는 떼는 순간 onPress(hold) 인자 하나로만 나가고, 서버가 역할로 결과를 가른다(P21-8). 시험이 역할만 다른 네 렌더의 독·진행 점 outerHTML 이 밖·안·누르는 중 모두 같음을 고정한다"
    - "[켜기]의 비활성·빛남은 맵 층이 프레임마다 DOM 에 쓰지 않고 GameMap 이 같은 반경 판정 결과(errandPos.actableId)로 React prop 에 싣는다 — 그 값이 이미 표본이 바뀔 때만 상태로 바뀌어 같은 판정이고, 위치·투영을 몰라도 되는 독 단추라 층 쓰기가 필요 없다"
key-files:
  created:
    - src/components/v2/SceneDock.tsx
    - test/client/sceneDock.test.tsx
  modified:
    - src/components/WorldStage.tsx
    - src/components/v2/ErrandDots.tsx
    - src/components/v2/ErrandStartCard.tsx
    - src/components/v2/ErrandMarker.tsx
    - src/game/errandView.ts
    - src/game/placeText.ts
    - src/net/useMapInsets.ts
    - src/screens/GameMap.tsx
    - src/styles/v2.css
    - src/styles/game.css
    - test/client/errandScreen.test.tsx
    - test/client/errandParts.test.tsx
    - test/client/worldStage.test.tsx
    - test/client/callGlow.test.tsx
key-decisions:
  - "[켜기]의 data-call·aria-disabled 는 WorldStage 층이 쓰지 않고 GameMap 이 React prop 으로 준다(계획은 층 쓰기). 같은 반경 판정이고 가짜 WorldStage 시험에서도 보인다. WorldStage 는 errand.dock 플래그로 장소 위 [처리] 알약만 그리지 않는다(타일·화살표·링·빛은 그대로)"
  - "독은 확장판 + 저녁 + me.errand 가 있는 산 사람 + 튜토리얼 지도 장면이 아닐 때만(dockOn). 튜토리얼(panelless)은 옛 알약·진행 n/3·점 40 그대로라 회귀 없음. 진행 점 줄 위치는 독이 있을 때만 쓰는 --mf-dock-h 가 정한다(--mf-panel-h 는 패널 없는 단계에서 0px 라 쓰면 튜토리얼 점이 내려앉는다)"
  - "켠 타일의 배지는 가로등 장소(lamp0~7)만 불꽃·'켠 곳', 재즈 바·광장 장소는 체크·'처리함' 그대로(isLampPlace). 계획은 check → flame 전부였으나 확장판이 가로등 아닌 맵에도 올 수 있고 기존 시험이 그 모양을 고정한다"
  - "[건너뛰기] 거절은 skipSent(PICK_REPLY_MS) 로 알아보고 눌림만 서버 값으로 되돌린다 — 이유 글·거절 소리 없음(UI-SPEC error)"
  - "[건너뛰기]는 세로 배치(아이콘+수 위, '건너뛰기' 아래)로 너비 112 안에 넣었다. 한 줄이면 아이콘 22 + 글 약 64 + 수 약 40 이 112 에 안 들어가 [켜기] 폭 208 이 깨진다"
metrics:
  duration: 약 50분
  completed: 2026-11-13
status: complete
---

# Phase 21 Plan 11: 저녁 · 등불 켜기 화면 Summary

**확장판 저녁의 아래가 독 하나가 됐다: 읽기 전용 기록 두 줄 + 금빛 [켜기](짧게 `{t:"errand"}`, 0.6초 이상 `{t:"errand",hold:true}`, 누구에게나 같은 채움 막대) + 눌림 토글 [건너뛰기](`{t:"skipPhase",on}`, 서버 수 day.skipCount / 산 사람 수). 진행 점은 독 위 16 의 '등불 n/3', 시작 카드는 '오늘 켤 등불', 켠 가로등 타일은 불꽃 배지·'가로등 장소, 켠 곳'. `npm test` 8870 통과·262 건너뜀·실패 0, `npm run typecheck` 초록.**

## RED 증거 (단일 줄)

- Task 1 (`e9cc4bc4`): `AssertionError: expected null not to be null` (독 기록 칸·단추 없음) · `AssertionError: expected '' to match /background: var\(--light-lamp\)/` (독 CSS 없음)
- Task 2 (`dc0fb6e2`): `AssertionError: expected '가로등 장소, 처리함' to be '가로등 장소, 켠 곳'` · `AssertionError: expected '오늘 갈 곳' to be '오늘 켤 등불'` · `AssertionError: expected +0 to be 1` (독 [켜기] 0개) · `AssertionError: expected '진행 1/3' to be '등불 1/3'` · `AssertionError: expected <button type="button" …(5)>…(1)</button> to have a length of +0 but got 1` (dock 플래그 때 알약)

## 독 높이·폰 6종 스테이지 (시험이 기존 패널 값과 대조)

독 = 위 14 + 기록 LOG_H 68 + 간격 10 + 행동 줄 56 + 아래 22 = **170**(`DOCK_H`, 기존 `.mf-game__panel` 패딩 14·22·간격 10 그대로). 스테이지 = 폰 높이 − 62 − 170, 주 단추 = 폭 − 32 − 112 − 8.

| 폰 | 스테이지 | [켜기] 폭 |
|----|----------|-----------|
| 360×560 | 328 | 208 |
| 360×640 | 408 | 208 |
| 390×664 | 432 | 238 |
| 390×844 | 612 | 238 |
| 402×874 | 642 | 250 |
| 430×932 | 700 | 278 |

(산식 검산이며 실기기·브라우저 측정이 아니다. 아래 "한계" 참고.)

## hold 판정 규칙

- pointerdown 시각을 기억하고 채움 막대(0.6초 선형)를 켠다. pointerup 에서 경과 ≥ `HOLD_MS`(600) 면 `onPress(true)`, 아니면 `onPress(false)`. 599ms = false, 600ms = true(시험 고정).
- pointercancel·pointerleave 는 보내지 않고 막대만 비운다. Enter·Space 는 길게 누르기 없이 `onPress(false)`.
- 손가락 눌림 뒤 따라오는 click 은 700ms 안이면 거른다(한 번만 나간다). 보조 기술이 포인터 없이 보내는 click 은 짧은 눌림이다.
- 모션 줄이기: 막대의 transition 이 없고 누르는 즉시 가득 찬다. 막대·마크업·속성은 역할과 무관하게 같다.
- GameMap `pressErrand(hold)`: `canSend` 이고 반경 안(actableId)일 때만 `ui.tap` 한 번 + `send(hold ? {t:"errand",hold:true} : {t:"errand"})`. 거절·실패 때 화면 변화·글 없음.

## Deviations from Plan

### Auto-fixed / 계획 보완

**1. [계획 선택] [켜기] 상태를 맵 층이 아니라 GameMap prop 으로**
- 계획은 WorldStage `writeErrandLayer` 가 프레임마다 문서의 `[data-errand-act]` 에 data-call·aria-disabled 를 쓴다고 했다. 이 값은 `errandPos.actableId`(표본이 바뀔 때만 상태가 되는 같은 반경 판정)로 이미 GameMap 이 갖고 있고, 독 단추는 투영 위치를 몰라도 되므로 React prop 으로 준다. React 와 층이 같은 속성을 쓰는 충돌도 없다. 가짜 WorldStage 를 쓰는 errandScreen 시험에서 "반경 안이면 data-call·aria-disabled 없음, 밖이면 반대"가 직접 보인다. WorldStage 는 `errand.dock` 플래그로 알약만 그리지 않는다(worldStage.test 한 건).
- Commit: dddfef3a

**2. [Rule 1 - 계획 보완] 배지 불꽃은 가로등 장소만**
- 계획: ErrandMarker 완료 배지 check → flame. 재즈 바·광장 장소의 기존 시험이 체크·'처리함'을 고정하고 확장판이 가로등 아닌 맵에도 올 수 있어 `isLampPlace` 일 때만 불꽃·'켠 곳'으로 했다(가로등 장소는 계획 그대로).
- Commit: dddfef3a

**3. [Rule 3 - 블로킹] 독 ↔ 채팅 패널 교체 때 측정이 옛 요소를 쥔다**
- `useMapInsets` 의 측정 효과가 패널 요소를 시작 때 한 번 쥐므로 저녁 독이 토론 채팅 패널로 바뀌어도 `panelless` 가 같으면 떼어진 독을 재게 된다. 셋째 인자 `panelKey`(독 "dock")를 의존성에 더했다.
- Commit: dddfef3a

**4. [Rule 2 - 이유 글 없는 거절] 건너뛰기 거절 처리**
- 일반 WRONG_PHASE 거절은 알림 글·거절 소리를 낸다. UI-SPEC error("이유 글 없음")에 맞춰 건너뛰기를 보낸 직후(PICK_REPLY_MS)의 거절은 알림·소리 없이 눌림만 서버 값으로 되돌린다(`skipSent`).
- Commit: dddfef3a

**5. [계획 보완] 진행 점 변수 이름·건너뛰기 배치**
- 점 줄 위치는 `--mf-panel-h`(패널 없는 단계에서 0px)가 아니라 독이 있을 때만 쓰는 `--mf-dock-h` 를 읽는다(튜토리얼의 점 위치 불변). [건너뛰기]는 아이콘+수를 위, '건너뛰기'를 아래 두는 세로 배치로 너비 112 에 넣었다.

**6. [회귀 고침] 독 CSS 주석이 심부름 CSS 시험을 깼다**
- Task 1 커밋(215b0afb) 때 v2.css 주석에 쓴 `.mv-errand` 글자를 심부름 시험이 "첫 .mv-errand 부터 파일 끝"으로 찾아 색 약속·모션 시험 둘이 깨졌다(그 커밋 시점 errandParts 실패). 주석을 고쳐 Task 2 GREEN(dddfef3a)에서 해소했다.

**7. [옛 시험 갱신, 약화 없음]**
- errandScreen·errandParts: 옛 [처리] 알약 단언을 독의 [켜기]로(판 종류 없는 view 는 확장판이라 알약 없음), "진행 n/3"→"등불 n/3", 패널 없음→독 있음(유령은 그대로 패널·독·진행 점 없음). 알약·진행 n/3·점 40 은 튜토리얼 경로가 그대로 쓰므로 부품 시험은 유지.
- callGlow.test: "빛남은 소리를 내지 않는다" 소스 검사가 옛 핸들러(onErrandAct)만 빼던 것을 독 [켜기] 눌림 핸들러(pressErrand)도 뺀다(눌림 소리는 빛남이 아니다 — V-31 과 같은 이유).

## Known Stubs

없음.

## Threat Flags

없음(새 네트워크·인증·파일 접근 없음. hold 는 21-05 에서 열린 필드이고 T-21-28 은 서버가 막는다).

## 한계 (정직하게)

- 실기기·실브라우저로 독 높이 170·폰 6종 스테이지·[켜기] 폭·채움 막대 모양·금빛 깜빡 테두리를 보지 못했다. 이 에이전트 환경의 happy-dom 시험은 CSS 규칙 값(문자열)과 DOM·이벤트만 본다. 산식(위 표)은 UI-SPEC 과 같다.
- 로컬 확인: `npm run dev` 로 띄워 `node scripts/e2e/run.mjs --url http://localhost:5173 --only errand --sizes 390x844` 를 한 번 돌렸다. errand 흐름은 옛 순서라 `S4 단계 도달: 낮 시작에 닿지 못함` 으로 4번 재시도 뒤 실패했고(21-17 이 새 순서로 고친다 — 이 계획의 실패로 세지 않는다), 화면이 뜬 시도에서 `EF0` 가 `점 줄 1, 점 3, 표지 3, 패널 1` 을 돌려줬다(옛 기대는 패널 0 — 독이 패널 자리에 하나 생긴 것이고 오류 카드는 없다). 내가 띄운 서버는 껐다.
- 길게 누르기 0.6초는 손가락 pointer 이벤트 기준이다. iOS/Android 실기기에서 길게 누를 때의 콜아웃·돋보기·컨텍스트 메뉴 억제(`user-select:none`·`-webkit-touch-callout:none`·contextmenu 막기)는 코드로만 적용했고 확인하지 못했다(실기기 검사는 끝에 몰아서 한다).
- E2E 흐름(errand.mjs·browser.mjs 의 알약 표식)은 갱신하지 않았다(21-17).

## 21-12·21-13 에 넘기는 것

- `SceneDock`(`src/components/v2/SceneDock.tsx`): `primary.kind: "lamp" | "scene"`(scene 은 아침 [살펴보기] 자리 — gray-100 알약·`data-scene-act`·눈 아이콘으로 뼈대만, 21-13 이 글·모양을 고친다), `skip`(null 이면 단추 없음), `log`(읽기 전용 기록), `panelRef`. 밤 변형(안내 한 줄 + 행동 줄 52, 높이 122)은 아직 없다 — 21-12 가 같은 부품에 더하거나 형제 부품으로 둔다. `DOCK_H`(170)·`DOCK_ROW_H`(56)·`HOLD_MS`(600)를 내보낸다.
- GameMap: `dockOn` = 확장판 저녁 + `view.me.errand` 있음 + `panelless !== true`. 독 높이는 루트의 `--mf-dock-h`(독이 있을 때만)와 기존 `--mf-panel-h`(독 높이와 같은 값, 떠 있는 묶음이 읽는다)로 읽는다. `useMapInsets(…, panelKey)` 의 셋째 인자로 패널 요소가 바뀌는 것을 알린다 — 아침 독·밤 독을 더하면 `panelKey` 에 종류를 넘긴다.
- 건너뛰기 상태 훅: GameMap 의 `skipPressed`(useViewChoice)·`toggleSkip`·`skipSent`(조용한 거절). 아침 독은 같은 값을 읽고 같은 메시지 `{t:"skipPhase",on}` 를 보내면 된다.
- 저녁 독의 [켜기]는 `data-errand-act`, 아침 주 단추는 `data-scene-act` 로 갈라 둔다. E2E(21-17)는 저녁에 독의 `[data-errand-act]`(aria-disabled 로 반경 판정)를 읽는다.
- ErrandLayerProps 에 `dock?: true` 가 생겼다(알약 미표시). srcClean 은 유지(src 에 lampCut·smudged·skipVote·mafiaTouch·낱말 cut·data-*cut* 없음).

## Self-Check: PASSED

- 파일: `src/components/v2/SceneDock.tsx`·`test/client/sceneDock.test.tsx` 있음, 수정 파일 모두 git 에 커밋됨.
- 커밋: e9cc4bc4(test), 215b0afb(feat), dc0fb6e2(test), dddfef3a(feat) 모두 HEAD 의 조상.
- `npx vitest run test/client/sceneDock.test.tsx test/unit/srcClean.test.ts` 28/28, 전체 `npm test` 8870 통과·실패 0, `npm run typecheck` 초록, 위생 grep(src·test) 결과 없음.
