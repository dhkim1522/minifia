---
phase: 15-errand-and-trace
plan: "04"
subsystem: client-errand-parts
tags: [errand, parts, pure-rules, host-line, call-glow, minifia-v3, d-03, d-08, d-09]
status: complete

requires:
  - phase: 15-01
    provides: "me.errand(places·done)·view.map·MapDef.places·ERRAND_ACT_R·errand 단계"
  - phase: 14-09
    provides: "hostLine 문구 표·callTargetsOf·is-call 빛남"
provides:
  - "V2Icon: arrow·thread·장소 16개(placeGlass … placeStand, 임시 선 그림 — 같은 이름의 경로만 나중에 바꾼다)"
  - "src/game/placeText.ts: PLACE_NAME·placeIconOf·placeLabel"
  - "src/game/errandView.ts: ERRAND_TEXT·progressLabel·errandProgress·placeCentersOf·nextPlaceOf·actablePlaceOf·placeMarkerPlan(순수) + Rect 타입"
  - "ErrandMarker·ErrandArrow(ErrandMarker.tsx)·ErrandDock(ErrandDock.tsx) 와 v2.css .mv-errand-* 블록(파일 끝)"
  - "hostLine: errand.act/done/ghost 문구(UI-SPEC 원문), HostLocal.pos, CallTool errand·CallTarget place, hostKeyOf errand 분기·callTargetsOf errand.act, hostChimeOf 낮 시작→심부름 무음"
affects: [15-05, 15-07, 15-08, 15-09, 15-10]

requirements-completed: [ERRAND-02, ERRAND-04]

actuals:
  tokens: 14000
  tasks: 2
  commits: 4

plan_head_before: 6995e2895e6c03b5748d067be8e4b50d53a8fee4
plan_head_after: 415d2a0e0a4f140f6bcc1057b7f638dbc15a3ad2

tech-stack:
  added: []
  patterns:
    - "화면 거울 판정은 서버처럼 고정소수점(월드 × UNIT 반올림)의 정수 제곱거리로 잰다 — 같은 입력에서 actErrand 와 같은 결과(경계 포함)"
    - "표지 배치 계획은 입력 = 사각형·투영 좌표, 출력 = 그릴 표지 + 화살표 한 개의 순수 함수(DOM·측정은 15-05 가 한다)"
    - "빛 고리가 누르기 상자(44)가 아니라 원(36)을 감싸도록 .mv-errand-pin.is-call::before/::after { inset: 4px }"

key-files:
  created:
    - src/game/placeText.ts
    - src/game/errandView.ts
    - src/components/v2/ErrandMarker.tsx
    - src/components/v2/ErrandDock.tsx
    - test/unit/errandView.test.ts
    - test/client/errandParts.test.tsx
  modified:
    - src/components/v2/V2Icon.tsx
    - src/game/hostLine.ts
    - src/styles/v2.css
    - test/unit/hostLine.test.ts

key-decisions:
  - "장소 아이콘 수: 장소 아이콘은 16개(PLACE_IDS 16 = 재즈 바 후보 8 + 광장 후보 8), 새 V2IconName 은 arrow·thread 를 더해 18개. 계획 본문의 '16 vs 18' 은 서로 다른 것을 센 값이라 모두 맞다 — 시험이 둘 다 고정(16 = 맵 후보 합, 18 = 16 + 2)"
  - "hostChimeOf: 낮 시작 → 심부름은 울리지 않고 심부름 → 토론은 울린다(UI-SPEC U-15·사회자 표 비고). 낮 시작 → 토론(옛 흐름)도 그대로 무음. 15-01 이월 메모의 결정 사항을 이것으로 닫음"
  - "화살표 각도는 도 단위, 위쪽 0°·시계 방향(atan2(dx, -dy)). 화살표 위치는 중심에서 장소 방향으로 뻗은 선이 안쪽(inset+chip/2) 사각형과 만나는 점. 독 줄과 겹치면 y 만 독 아랫변 + chip/2 로 내린다"
  - "표지(.mv-errand-pin)는 position:absolute 의 44×44 상자이고 left/top 은 '좌상단' 값이다 — 15-05 가 중심 좌표에서 22 를 뺀 값을 style 로 넘긴다. 화살표 칩은 36×36 이라 18 을 뺀다"

metrics:
  duration: 약 40분
  completed: 2026-11-07
---

# Phase 15 Plan 04: 심부름 부품 Summary

**장소 아이콘 16개(+arrow·thread)·낱말 표, 진행·다음 장소·처리 가능(서버 거울)·표지 배치 계획의 순수 판정, ErrandMarker·ErrandArrow·ErrandDock 부품과 스타일, 사회자 errand 문구 3줄·빛남 대상(place·errand)을 시험으로 고정했다. 마피아와 시민은 같은 입력에 같은 DOM·같은 키·같은 문장을 받는다.**

## 한 일

- **Task 1 (데이터·순수 판정)** — `test(15-04)` 로 시험 먼저, `feat(15-04)` 로 구현.
  - V2Icon 에 `arrow`·`thread`·장소 16개를 더함(파일 머리 주석에 "임시 선 그림" 명시). 한 맵 안에서 실루엣이 서로 다르게 그림.
  - `placeText.ts`(PLACE_NAME·placeIconOf·placeLabel), `errandView.ts`(진행·내 장소 좌표·다음 장소·처리 가능·표지 배치 계획).
  - `hostLine.ts`: 예약 `errand` 행을 `errand.act/done/ghost` 로 대체, 문구는 UI-SPEC 원문. errand 분기는 `me.role` 을 읽지 않고(유령 → ghost, 3곳 완료 → done, 그 밖 → act) `callTargetsOf` 는 처리 반경 안이면 `{tool:"errand"}`, 밖이면 `{place, 가장 가까운 미완료}`, 위치를 모르면 첫 미완료. 새로 읽는 값은 `me.errand.places·done`·`view.map`·`local.pos` 뿐이며 파일 머리 허용 목록 주석과 시험의 허용 목록에 더했다.
- **Task 2 (부품)** — `test(15-04)` 후 `feat(15-04)`.
  - `ErrandMarker`(button.mv-errand-pin, 원 36·누르기 44·아이콘 20, 처리하면 check)·`ErrandArrow`(span, aria-hidden, 눌림 통과, 안쪽 span 이 `rotate(angle deg)`)·`ErrandDock`(칩 N + `n/N` + 스크린리더용 `aria-live` + `[처리]` 단추 104×48, 높이 84).
  - 반경 밖(`canAct=false`)이나 3곳 완료 뒤에는 `aria-disabled="true"` 이고 `onAct` 를 부르지 않음. 3곳 완료 뒤 같은 `button[data-errand-act]` 가 check + "완료"·`data-done` 으로 남는다.
  - v2.css 새 블록은 파일 끝에 두었고 hex·새 토큰 없음, 키프레임은 transform·opacity 뿐, 모션 줄이기에서 채움 연출 즉시.

## 시험 결과

- Task 1 verify: `errandView·hostLine·icon·hostBand·hostChime·callGlow` 6파일 178 통과.
- Task 2 verify: `errandParts·faceList·callGlow·v2parts` 4파일 152 통과, 새 부품 시험 22 통과.
- `npx vitest run test/unit test/client` — 201 통과·1 실패. 실패는 `test/unit/testTools.test.ts "dayAnnounce 의 결과는 정상 마감 tick 과 마감 시각만 다르다"` 하나이며 `errandTickAt`(31000 vs 30500) 차이로, 동시에 돌고 있는 15-02(서버·`errandTickAt` 도입)의 진행 중 변경에서 온 것이다(이 계획이 건드린 파일과 무관, 15-02 몫).
- `npm run typecheck`: 이 계획 파일 오류 0. 남은 오류는 `worker/room.ts(1389): Cannot find name 'Player'` 하나로 15-02 가 편집 중인 파일이다.
- 인수 기준: errandView·placeText 존재, `placeGlass|placeClock|placeStand` 4, `errand.act|done|ghost` 8, errand 분기 `role` 0, `mv-errand` 24, 새 블록 hex 0, ErrandDock 표식 4, ErrandMarker 표식 2.
- 위생: 금지어 grep 새 적중 없음.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 계획 내 불일치] 장소 아이콘 수 16 vs 18**
- 목적·제목은 "18개", 본문은 "16개". 맵의 실제 후보는 8+8=16곳(PLACE_IDS 16)이라 장소 아이콘은 16개이고, `arrow`·`thread` 를 더한 새 V2IconName 이 18개다. 두 숫자를 시험(`errandView.test.ts` 첫 `it`)이 모두 단언한다(16 = 맵 후보 합 = PLACE_IDS, 18 = 16 + 2).

**2. [Rule 1 - 계획 내 산수] 독 안쪽 여백**
- UI-SPEC 의 "높이 84 + 안쪽 `16 16 24`" 는 [처리] 높이 48 과 합하면 88 이라 맞지 않는다. 높이 84 를 지키고 안쪽 여백을 `12 16 24`(위 12, 아래 24 + 안전 영역)로 했다(12페이즈 `.mv-speak-sheet` 의 `12px var(--space-md)` 선례). 가로 약 300 ≤ 328.

**3. [Rule 2 - 일관성] `pin?: 36 …` 리터럴 타입을 number 로**
- `placeMarkerPlan` 입력의 pin·tap·inset·chip 은 계약에서 리터럴(36·44·8·36)이었으나 시험이 크기 인자를 바꿔 볼 수 있도록 `number` 로 넓혔다(기본값은 계약 그대로). `pin` 은 계산에 쓰이지 않고 `tap` 상자만 쓴다.

### 계획 대비 메모

- RED 를 눈으로 확인한 단계: errandView·errandParts 시험은 구현 없이 먼저 돌려 모듈 없음으로 실패하는 것을 확인했다. hostLine 시험은 구현 전 실패 11건을 확인했다.
- 통합 시험은 아님: `GameMap`·`WorldStage`·world store 는 건드리지 않았다(계획대로 15-05 몫).

## 이월 메모 (다음 계획용)

- **15-05 (통합)**: 표지(.mv-errand-pin)는 `position:absolute` 44×44 이고 `style={{left, top}}` 는 좌상단이다(투영 중심에서 22 빼기, 화살표 칩은 18 빼기). 투영 좌표 → `placeMarkerPlan({stage, dock, items, nextId})` → pins 를 `ErrandMarker` 로, arrow 를 `ErrandArrow angle={arrow.angle}` 로 그린다. `nextId = nextPlaceOf(pos, placeCentersOf(view), done)`, `canAct = actablePlaceOf(...) !== null`, 빛남은 `callTargetsOf(view, { pos })` 가 돌려주는 `{kind:"place"}` → 해당 표지·화살표 `call`, `{kind:"tool",tool:"errand"}` → `ErrandDock call`. `HostLocal.pos` 는 내 월드 좌표(클라이언트 상태)로 GameMap 이 넘긴다. 독 줄 사각형·스테이지 사각형은 `useMapInsets` 에서 얻는다. 표지의 `onWalk` 는 바닥 탭과 같은 걷기.
- **15-07**: `HOST_LINES.witness`·`trace` 는 아직 빈 문자열이고 hostKeyOf 가 돌려주지 않는다. `CallTool` 에 `"record"` 를 더할 때 같은 곳에 이어 쓴다.
- **15-09**: E2E 선택자는 `data-errand-dock`·`data-errand-chip="{n}"`(+`data-done`)·`data-errand-progress="n/N"`·`button[data-errand-act]`(+`aria-disabled`·완료 때 `data-done`)·`data-errand-place="{id}"`(+`data-done`)·`data-errand-arrow` 이다. 완료 뒤 [처리] 는 같은 요소가 "완료" 글자로 남는다.
- **15-10**: 결정 0074 에 적을 것 — 장소 아이콘 16 + 새 이름 18, 임시 선 그림, 화살표 각도·위치 규칙, hostChimeOf 규칙(낮 시작→심부름 무음·심부름→토론 소리), 독 안쪽 여백 `12 16 24`.

## Known Stubs

없음. (장소·arrow·thread 아이콘은 계획대로 "임시 선 그림"으로 의도된 것이며 같은 이름의 경로만 나중에 바꾼다. 부품은 아직 화면에 끼워지지 않았고 15-05 가 연결한다.)

## Threat Flags

없음 — 새 네트워크 표면 없음. T-15-15(허용 목록·역할 미참조: 기록 Proxy·필드 제거·역할 제거 시험), T-15-16(부품 prop 에 역할·좌석 없음·같은 HTML·속성 값 제한 시험), T-15-17(id 는 닫힌 집합·aria-label 은 React 속성), T-15-18(같은 표본 20개로 서버 actErrand 와 일치 시험)을 고정했다.

## Self-Check: PASSED

- 파일: errandView.ts·placeText.ts·ErrandMarker.tsx·ErrandDock.tsx·errandView.test.ts·errandParts.test.tsx FOUND
- 커밋: 216f83fe, 73048ad5, cf437626, 415d2a0e FOUND
