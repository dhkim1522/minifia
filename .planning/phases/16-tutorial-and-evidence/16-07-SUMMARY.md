---
phase: 16-tutorial-and-evidence
plan: "07"
subsystem: ui-errand-map
tags: [react, css, errand, place-tile, arrow, act-pill, e2e, tdd, vitest, ERRAND-07, ASSET-01]
requires:
  - phase: 16-02
    provides: 컬러 에셋 PlaceArt(장소 16)·PLACE_NAME
  - phase: 16-03
    provides: 서버 전용 errandFake(화면은 모른다, V-25)
  - phase: 16-06
    provides: 오른쪽 열 .mv-side·data-side-button·--mf-host-dock
provides:
  - placeMarkerPlan 새 계약(타일 64·발밑 화살표 56/48·장소 위 [처리] 알약 위/아래 뒤집기·피할 사각형)
  - ErrandMarker 64 컬러 타일(PlaceArt 44·체크 배지·data-rest 후광·is-call), ErrandArrow 40 글리프, ErrandAct 알약(신규)
  - WorldStage 층이 매 프레임 타일·화살표·알약 위치와 후광·빛을 쓴다(알약 층 z-tags+1 을 따로 둔다)
  - GameMap 이 actId·onAct 로 알약 전송(ui.tap 한 번 + { t:'errand' })
  - 아래 독의 [처리] 삭제(칩·n/3 만 남음), errand.act 문구 '빛나는 곳을 찾아 처리해 주세요.'
  - E2E EA3 재정의·EA7~EA10·EO 개편·ER1(errandParityChecks)·data-rest 표식
affects: [16-08, 16-09, 16-10]
actuals:
  tokens: 47500
  tasks: 3
  commits: 6
plan_head_before: 76685162d8e41c5ca679e5bb0f78b821f1b936d4
commits: 6
plan_head_after: 60032452b369501c12deff6e865fcb2d0a7b780e
tech-stack:
  added: []
  patterns:
    - "위치를 쓰는 요소(타일·화살표·알약)에는 transform 애니메이션·:active 변형을 걸지 않는다(inline transform 을 덮는다) — 그림·배지 같은 자식에만"
    - "빛남 우선은 층이 정한다: actId 가 있으면 알약만 is-call, 없으면 callPlace 인 가장 가까운 보이는 타일만, 화살표는 켜지지 않는다. data-rest 는 미처리·빛나지 않는 보이는 타일"
    - "피할 사각형은 [data-side-button] 전부(소리 단추 포함) + 내 이름표(화살표만), RECT_TTL_MS 캐시"
    - "ER1 마크업 동일은 구조 표식 개수·이름 집합만 견주고 상태 표식(data-done·call·rest·errand-act)은 허용 집합만 본다"
key-files:
  created:
    - src/components/v2/ErrandAct.tsx
    - test/client/mapInsetsPanelKey.test.tsx
  modified:
    - src/game/errandView.ts
    - src/components/v2/ErrandMarker.tsx
    - src/components/v2/ErrandDock.tsx
    - src/components/v2/V2Icon.tsx
    - src/components/WorldStage.tsx
    - src/screens/GameMap.tsx
    - src/net/useMapInsets.ts
    - src/game/hostLine.ts
    - src/styles/v2.css
    - src/styles/game.css
    - scripts/e2e/lib.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/errand.mjs
key-decisions:
  - "알약은 타일 층(z-tags−1)과 다른 형제 층 .mf-world__errand-act(z-tags+1)에 그린다 — 한 층 안에서는 z-index 를 둘로 나눌 수 없다"
  - "화살표는 스테이지 안쪽 8 + 20 안으로 가둔다(계획에 없던 한 줄) — 가장자리 근처에서 띠·화면 밖으로 나가지 않게"
  - "E2E EO1 은 화살표와 타일의 겹침을 보지 않는다 — 눌림을 통과하는 방향 표지라 다가가면 목표 타일 위를 지난다. 타일끼리·알약과 타일 겹침은 0 으로 본다"
  - "아래 패널 요소가 바뀔 때 useMapInsets 가 다시 재도록 panelKey 를 더했다(채팅 ↔ 심부름 독)"
requirements-completed: [ERRAND-07, ASSET-01]
coverage:
  - id: D1
    description: "내 장소 3곳이 64 컬러 타일(처리함 .55·체크 배지·테두리 3), 남은 곳 정지 후광(data-rest), 가장 가까운 곳 램프 빛, 화살표 56/48, 처리 반경 안 장소 위 [처리] 알약(위/아래 뒤집기·안쪽으로 밀기)"
    requirement: ERRAND-07
    verification:
      - kind: unit
        ref: "test/unit/errandView.test.ts#타일·화살표·알약 배치 계획"
        status: pass
      - kind: unit
        ref: "test/client/errandParts.test.tsx"
        status: pass
      - kind: unit
        ref: "test/client/worldStage.test.tsx#WorldStage: errand 층"
        status: pass
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 --only errand --sizes 360x640,390x844"
        status: pass
    human_judgment: false
  - id: D2
    description: "마피아와 시민의 심부름 화면이 같은 마크업(가짜 장소 표식 없음)이고 마피아가 가짜 곁에서 [처리]를 눌러도 새 문구·알림이 없다"
    requirement: ERRAND-07
    verification:
      - kind: unit
        ref: "test/client/errandScreen.test.tsx#errand 화면: 마피아와 시민은 같은 DOM"
        status: pass
      - kind: e2e
        ref: "errand/d03 EF7 (ER1) 390x844"
        status: pass
    human_judgment: false
  - id: D3
    description: "장소 아이콘이 컬러 에셋(PlaceArt)이다"
    requirement: ASSET-01
    verification:
      - kind: unit
        ref: "test/client/errandParts.test.tsx#그림은 PlaceArt 와 같다(16개 전부 서로 다르다)"
        status: pass
    human_judgment: false
  - id: D4
    description: "사회자 errand.act 줄이 새 문장이고 독의 [처리] 가 없다"
    requirement: ERRAND-07
    verification:
      - kind: unit
        ref: "test/unit/hostLine.test.ts"
        status: pass
      - kind: unit
        ref: "test/client/errandScreen.test.tsx#독에는 [처리] 단추가 없다"
        status: pass
    human_judgment: false
duration: 35min
completed: 2026-11-08
status: complete
---

# Phase 16 Plan 07: 장소 타일·발밑 화살표·[처리] 알약 Summary

**심부름 맵을 "보고 누르는" 화면으로 바꿨다: 내 장소 3곳이 64 컬러 타일로, 가장 가까운 곳은 램프 빛으로 빛나고, 내 발밑 화살표가 길을 가리키며, 처리 반경 안에서만 그 장소 위에 [처리] 알약이 뜬다.**

## Performance

- **Duration:** 약 35분
- **Completed:** 2026-11-08
- **Tasks:** 3 (모두 type=auto, TDD 2 + E2E 1)
- **Files:** 24개 변경 (+1100/−530), 새 파일 2개

## Accomplishments

- `placeMarkerPlan` 을 새 계약으로 바꿨다. 타일(64)은 안쪽 8 안이고 피할 사각형과 겹치지 않을 때만 그린다. 화살표는 내 발밑에서 목표 방향 56(겹치면 48 로 한 번만 당김)이고 스테이지 안쪽으로 가둔다. 알약은 타일 위 8 에 서고 위가 막히면 아래로 뒤집고 좌우는 안쪽 8 로 민다. 타일이 안 그려진 장소도 투영 점을 안쪽으로 당겨 알약을 세운다.
- `ErrandMarker` 는 `PlaceArt(44)` 를 쓰는 64 타일이다. 처리함은 불투명도 .55 + 24 체크 배지 + 테두리 3 brass-400, 남은 곳은 `data-rest` 정지 후광, 가장 가까운 곳은 `is-call`(테두리 3·번짐 26). `ErrandArrow` 는 시안 경로 `M12 2l7 10h-4v10H9V12H5z` 40 글리프다. `ErrandAct`(신규)는 `data-errand-act`·aria-label `{장소}에서 처리`·손 아이콘(V2Icon `hand`)이다.
- WorldStage 층이 매 프레임 `placeMarkerPlan` 결과로 타일·화살표·알약 위치와 빛을 쓴다(값이 같으면 쓰지 않는다). 알약은 별도 층(z-tags+1)이고 `actId` 가 있을 때만 DOM 에 있다. 빛남 우선: 알약이 있으면 알약만, 없으면 가장 가까운 보이는 타일만, 3곳 완료면 없음. 화살표는 켜지지 않는다.
- GameMap 은 `actId: errandPos.actableId`·`onAct` 를 넘기고, 누르면 `ui.tap` 신호 한 번과 `{ t: 'errand' }` 한 번을 보낸다(반경 밖에서는 알약이 없어 헛누름이 없고 거절·실패 알림은 없다). 아래 독에서 [처리] 와 그 prop 3개를 지웠다.
- `errand.act` 가 '심부름 시간입니다. 빛나는 곳을 찾아 처리해 주세요.' 이고 마피아도 같은 문장이다. 읽기 경로(HOST-05 기록)는 바뀌지 않았다.
- E2E: `errandChecks` EA3 를 띠 문장 + 독 단추 0 으로 고치고 EA7(타일 64±1)·EA8(반경 밖 알약 0·화살표 1 / 안 알약 1·화살표 0 / 완료 0)·EA9(빛남 우선)·EA10(후광 규칙)을 더했다. `errandOverlapChecks` 는 타일·화살표·알약과 오른쪽 열 단추·안쪽 8 기준이다. `errandParityChecks`(ER1)와 `readErrandSignature` 가 마피아·시민 판의 마크업 동일을 본다. `data-rest` 가 ERRAND_MARKERS(13개)·ERRAND_ATTRS 에 들었다.

## Task Commits

| # | 커밋 | 내용 |
|---|------|------|
| 1 RED | af11afe0 | `test(16-07): 장소 타일·화살표·[처리] 실패 시험` (14 실패 확인 후 커밋) |
| 1 GREEN | 462fe74f | `feat(16-07): 장소 타일·발밑 화살표·장소 위 [처리] 부품` |
| 2 RED | 416fd697 | `test(16-07): 맵 층 타일·화살표·알약·errand.act 문구 실패 시험` (23 실패 확인 후 커밋) |
| 2 GREEN | 5329520e | `feat(16-07): 맵 층 연결 — 타일·화살표·장소 위 [처리]` |
| fix | 5e415596 | `fix(16-07): 아래 패널이 바뀌면 스테이지 안전선을 다시 잰다` |
| 3 | 60032452 | `test(16-07): E2E 장소 타일·[처리] 판정` |

## 검증 결과

- Task 1·2 인수 기준 전부 통과(`ErrandAct.tsx` 있음, `PlaceArt` 2회, `placeIconOf` 0회, `hand:` 있음, 독 `data-errand-act` 0회, `TILE_HALF = 32`, `ErrandAct` 2회, 새 문장 1회).
- `npm run typecheck` 통과. `node --test scripts/e2e/lib.test.mjs` pass 379 / fail 0.
- **`npm test`: 262 파일 통과(6 skipped) / 7544 통과(261 skipped), 실패 0.** 기준선은 261 파일 / 7532 이었고 새 시험 파일 1(`mapInsetsPanelKey`)과 12개 시험이 늘었다. 알려진 `bots.test.ts` 불안정은 이번에는 나오지 않았다.
- **로컬 E2E `--only errand`**(개발 서버 `npm run dev`, 끝낸 뒤 종료): **360x640 21/21, 390x844 25/25 통과.** 360x640 도착 직후는 보이는 타일이 0개였고(화살표만 있음) 반경 안·mid 읽기에서 타일 1개가 나왔다. 390x844 에서 마피아/시민 ER1 통과. 실패하던 EO3·EO4 는 아래 [Rule 1] 수정 뒤 2회 연속 통과했다.
- **폰 6종 대신 2종만 돌렸다**(아래 편차 2).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] useMapInsets 가 옛 패널을 재서 스테이지 안전선이 옛 값에 멈춤**
- **Found during:** Task 3 (로컬 E2E EO3·EO4 실패: 타일이 띠 밑으로 13~24px 걸침)
- **Issue:** `useMapInsets` 의 재는 효과가 시작 때 패널 요소를 상수로 쥐는데, 낮 시작 → 심부름에서 아래 패널이 채팅 패널에서 심부름 독 패널로 다른 요소로 바뀐다. 쥔 요소가 떼어져 높이 0 이 되고 `measure()` 가 조기 반환해 insets 가 낮 시작 때 값(위 105.6·아래 244)에 멈췄다. 실제는 위 141.2·아래 84 라서 타일이 띠 밑에 그려지고 아래 160px 영역에는 그려지지 않았다. 15페이즈의 44 타일에서는 확률이 낮아 안 드러났고 이번 64 타일과 더 긴 errand.act 문장(띠 2줄)으로 드러났다.
- **Fix:** `useMapInsets(turnActive, panelKey)` 로 효과 의존성에 `panelKey` 를 더하고 GameMap 이 `view.phase === "errand" ? "errand" : "chat"` 을 넘긴다. 회귀 시험 `test/client/mapInsetsPanelKey.test.tsx`(키 있음 → 84 로 다시 잼, 키 없음 → 244 에 멈춤).
- **Files modified:** src/net/useMapInsets.ts, src/screens/GameMap.tsx, test/client/mapInsetsPanelKey.test.tsx
- **Commit:** 5e415596

### Plan-external edits (Rule 3, 같은 변경이 깨뜨린 시험·사본)

- `test/client/v2parts.test.tsx`: "놋쇠 토큰 없음" 규칙이 새 타일·알약의 brass(V-20~V-22)를 막아 `.mv-errand-(pin|act|arrow)` 를 예외 목록에 더했다(errandParts 시험이 따로 지킨다).
- `test/client/callGlow.test.tsx`: "빛남은 소리를 내지 않는다" 소스 검사가 `onErrandAct` 의 `emitSignal({kind:"tap"})`(눌림 소리, V-31)에 걸려 그 핸들러만 검사에서 뺐다.
- `test/unit/e2eContract.test.ts`: ERRAND_MARKERS 12 → 13(data-rest). `scripts/e2e/lib.mjs` ERRAND_LINES.act 사본을 새 문장으로 맞췄다(Task 2 커밋에 포함).
- `src/styles/game.css`: 알약 층 `.mf-world__errand-act` 규칙을 더했다(계획 files_modified 에 없음).

### 계획과 다르게 한 것(결정)

**2. E2E 폰 크기 2종(360x640·390x844)**: Task 3 인수 기준은 폰 6종이지만 오케스트레이터 지시(바뀐 흐름만 1~2 크기, 6종 전체는 16-10 이 한 번)를 따랐다. 6종 전체 결과는 16-10 몫이다.

**3. 화살표를 스테이지 안쪽에 가둠**: 계획에는 없던 clamp 한 줄. 내 발밑이 가장자리 가까이일 때 화살표가 띠·화면 밖으로 나가는 것을 막는다(E2E EO4 가 화살표도 안쪽 8 안으로 본다).

**4. 피할 사각형 = `[data-side-button]` 전부**: 계획은 "소리 독(열 첫 칸) 사각형". 16-06 이 소리 단추에도 `data-side-button="sound"` 를 달았고 SC2 가 오른쪽 열 전체와 교차 0 을 요구해 열 단추 전부를 피하게 했다. 옛 `.mv-host__dock` 줄 사각형은 더 쓰지 않는다.

**5. EO1 에서 화살표·타일 겹침은 보지 않음**: 화살표는 눌림을 통과하는 방향 표지고 목표 가까이에서는 56 떨어진 자리가 그 타일 위가 된다. UI-SPEC 가 막지 않아 타일끼리·알약과 타일의 겹침만 0 으로 본다(lib.mjs 주석에 이유).

**6. ER1 의 비교 범위**: 마피아·시민 판은 장소·위치가 달라 `data-rest`·`data-call`·`data-done`·`data-errand-act` 의 있고 없음이 판마다 다르다. 구조 표식 6종은 개수까지, 나머지는 이름 집합(상태 표식 제외)과 허용 집합·역할류 이름 없음만 견준다. "마피아가 가짜 곁에서 [처리]를 눌러도 새 문구·알림 없음"은 E2E 로 가짜 위치를 알 수 없어 client 시험(errandScreen 역할 4종 동일 + onAct 경로에 문구·알림 없음)이 지킨다.

**Total deviations:** 1 auto-fixed(Rule 1) + 시험·사본 4건(Rule 3) + 결정 5건. **Impact:** 핵심 범위는 그대로. [Rule 1] 수정은 심부름 화면의 스테이지 영역이 실제로 맞게 하는 데 필요했다(수정 전에는 아래 160px 에 타일이 안 그려졌다).

## Known Stubs

없음.

## Threat Flags

없음. 알약은 필드 없는 `{ t:'errand' }` 만 보내고(T-16-16), 타일 그림은 16-02 의 정적 JSX(PlaceArt)만 쓴다(T-16-17). 부품에 역할·가짜 prop 이 없고 화면은 `me.errand`(places·done)만 읽는다(T-16-15). 패키지 설치 없음(T-16-SC).

## 이월 메모

- `docs/decisions/0074-v3-errand-and-trace.md` 21행이 옛 errand.act 문장을 인용한다(이력이라 고치지 않았다). 16-09/10 에서 필요하면 고친다.
- `ErrandDock` 은 칩·n/3 만 남았고 아래 패널(높이 84)은 그대로다. 스테이지 아래 끝은 아직 그 패널 윗변이다.

## Self-Check: PASSED

- 파일: `src/components/v2/ErrandAct.tsx`, `test/client/mapInsetsPanelKey.test.tsx` 있음.
- 커밋: af11afe0, 462fe74f, 416fd697, 5329520e, 5e415596, 60032452 모두 HEAD 의 조상.
- 인수 기준·`npm run typecheck`·`npm test`·`lib.test.mjs`·로컬 E2E 재확인 완료.
