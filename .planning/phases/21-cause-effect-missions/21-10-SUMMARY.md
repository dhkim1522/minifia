---
phase: 21-cause-effect-missions
plan: "10"
subsystem: client-morning-scene-ui
tags: [cause-effect, morning, clue-spots, clue-cards, skip, tdd]
status: complete

requires:
  - phase: 21-cause-effect-missions
    provides: "21-04 의 TOWN_CLUE_SPOTS·me.scene(ClueLine)·day.scene.house, 21-05 의 inspect·skip 메시지·canMoveIn(cause 아침 걷기)·day.skipCount·me.skip, 21-08 의 ErrandAct label/icon prop·hostLine(scene.act·announcing·spots 갈래)·spotCentersOf, 21-09 의 개관 카메라(아침에 iso 로 복귀)"
provides:
  - "src/game/sceneView.ts: spotsOf(view)(지점 셋 + 상태 new|done|dim + 점선 사유 why)·actableSpotOf(pos, spots)(서버 inspectSpot 의 화면 거울)·clueCardsOf(view)(me.scene 순서 카드)·skipOf(view)([건너뛰기] 재료) — 역할을 읽지 않는 순수 파생"
  - "src/game/sceneText.ts: SPOT_NAME·CARD_TEXT·SPOT_STATE_TEXT·spotLabel·inspectLabel·footprintLabel·INSPECT_ACT_LOOK 글 표"
  - "ClueSpot(지름 52·아이콘 28·상태 넷, 점선 두 상태 같은 모양, data-clue-spot·data-state)·ClueCard(높이 56·여섯 모양, role=status, data-clue-card·data-count)·SkipPill(104x48·check + n/N·aria-pressed, data-skip·data-skip-count) + v2.css 규칙(토큰 변수만)"
  - "GamePanel.SkipSlot(skip 토글 전송·낙관 눌림): 아침은 채팅 입력줄 오른쪽 끝(trailing), 저녁은 GameMap 진행 점 옆(.mf-game__skip)"
  - "WorldStage clues 층(ClueLayerProps) — 심부름 층과 같은 투영·안쪽 8 inset·화살표 칩·[살펴보기] 알약·근처 링, 단서 카드·[건너뛰기] 사각형 피함. data-clue-layer"
  - "GameMap: 확장판 아침 걷기(canMoveIn rules), useMorningAnnouncing(큰 글 발표 동안 지점 숨김·HostLocal.announcing), [살펴보기] → send({t:inspect}), 카드 줄(.mf-game__clues), 현장 없는 밤의 토론 첫머리 큰 글(dayView.phaseEntry discussion)"
affects: [21-11, 21-12, 21-13]

requirements-completed: [SCENE-01, SCENE-02, SKIP-01]

estimate:
  tokens: 105000
  tasks: 3

actuals:
  tokens: 28100
  tasks: 3
  commits: 6

plan_head_before: 493fe944a3b1349be216a06024ed2b63ec5dbedf
plan_head_after: 7d4edf3bcda26278ee05de1e88f3897ddae561ae
commits: 6

tech-stack:
  added: []
  patterns:
    - "지점 표지·[살펴보기]는 심부름 층과 같은 규칙 한 벌(placeMarkerPlan·useErrandPos·writeNearRing·사각형 캐시)을 id 일반화(Id extends string)로 재사용한다 — 새 투영 코드를 만들지 않았다"
    - "표지 상태(new|done|dim)는 React 가, 위치·숨김·빛남(is-call)은 프레임 콜백이 쓴다(심부름 표지와 같은 분업)"
    - "아침 큰 글 발표 구간은 밤 → 아침 전환 렌더에서 시작하는 작은 상태 기계(wait → on → done)이고 사회자 띠(HostLocal.announcing)와 지점 층이 같은 값을 읽는다"

key-files:
  created:
    - src/game/sceneView.ts
    - src/game/sceneText.ts
    - src/components/v2/ClueSpot.tsx
    - src/components/v2/ClueCard.tsx
    - src/components/v2/SkipPill.tsx
    - src/net/useMorningAnnouncing.ts
    - test/unit/sceneView.test.ts
    - test/client/clueParts.test.tsx
    - test/client/skipPill.test.tsx
    - test/client/morningScene.test.tsx
  modified:
    - src/components/WorldStage.tsx
    - src/components/v2/ErrandAct.tsx
    - src/screens/GameMap.tsx
    - src/screens/GamePanel.tsx
    - src/screens/RoomScreen.tsx
    - src/game/dayView.ts
    - src/game/errandView.ts
    - src/net/useErrandPos.ts
    - src/styles/v2.css
    - src/styles/game.css
    - test/client/worldStage.test.tsx
    - test/client/callGlow.test.tsx

key-decisions:
  - "새 와이어 형식 없음 — inspect·skip·me.scene·day.scene·day.skipCount 는 모두 21-04·21-05 가 이미 만든 것이라 test/worker/causeLeak.test.ts 의 ALLOWED_NEW/SERVER_ONLY_NAMES 는 그대로다"
  - "[살펴보기]는 ErrandAct 를 그대로 쓴다(id 를 선택 prop 으로 풀고 aria 를 직접 준다). 저녁 [켜기]의 길게 누르기(hold)는 아침에서 쓰지 않는다 — onPress 의 hold 인자를 무시한다"
  - "아침 [건너뛰기]는 채팅 패널의 trailing(입력줄 오른쪽 끝)에, 아래 패널이 없는 저녁은 진행 점 줄 오른쪽 끝에 놓는다(같은 SkipSlot). 저녁 표지·화살표는 [data-skip] 사각형을 피한다"
  - "유령은 지점 표지·카드 줄·[살펴보기]를 받지 않는다(심부름 표지가 산 사람에게만 있는 것과 같다) — 지켜보는 줄만"

metrics:
  duration: 약 55분
  completed: 2026-11-15
---

# Phase 21 Plan 10: 아침 현장 조사 화면과 [건너뛰기] Summary

확장판(원인 흐름) 아침이 큰 글 발표(띠 빈 줄) 뒤 피해자(미수) 집 앞 단서 지점 셋(발자국·옷 조각·창문)을 --dur-med 로 띄우고, 산 사람은 걸어가서 반경 안 [살펴보기]를 눌러 `inspect` 를 보내며, 살핀 줄은 패널 윗변 위 카드 줄(0~3장)로 쌓인다. 저녁·아침의 산 사람에게는 [건너뛰기](check + n/N, 한 번 더 누르면 취소)가 생겼고, 현장 없는 밤은 토론 첫머리 큰 글 한 번으로 넘어간다. 마피아·경찰·의사·시민의 표지·카드·알약·패널 DOM 은 같다.

## Accomplishments

- **Task 1 (파생·부품):** `spotsOf` 는 맵 표(clueSpots[house])의 세 점에 me.scene 으로 상태를 얹는다(줄 없음 new · clue/none done · touched/dark dim — 점선 두 상태는 사유 `why` 로만 접근성 이름이 갈리고 마크업은 같다). `actableSpotOf` 는 서버 inspectSpot 과 같은 고정소수점 거리·반경 1.2·순서(발자국 → 옷 → 창문). `ClueSpot`(52·28)·`ClueCard`(56, 받은 단서 light-lamp 실선 / 그 밖 gray-500 점선, 발자국은 숫자만)·v2.css 는 토큰 변수만이고 진홍·"범인"·"증거"·"확정"이 없다.
- **Task 2 ([건너뛰기]):** `SkipPill`(104×48·금빛 아님)과 연결 부품 `SkipSlot`(`{ t: "skip", on }` 토글, 낙관 눌림은 서버 me.skip 이 오면 서버 값이 이긴다). 아침은 채팅 입력줄 trailing, 저녁은 진행 점 옆. 유령·토론·기본판에는 없다.
- **Task 3 (연결):** WorldStage `clues` 층이 심부름 층과 같은 규칙으로 지점·화살표 칩·[살펴보기]·근처 링을 쓴다(카드·[건너뛰기] 사각형은 피한다 — 카드에 가려진 지점은 화살표 칩이 대신). GameMap 은 `canMoveIn(phase, alive, rules)` 로 아침 걷기를 열고, `useMorningAnnouncing` 으로 발표 동안 지점 층을 숨기고 띠를 비우며, 반경 안 지점이 있을 때만 [살펴보기]를 세우고 `send({t:"inspect"})` 를 보낸다. `dayView.phaseEntry` 의 새 `discussion` 분기가 원인 흐름 밤 → 토론(현장 없음)에 같은 큰 글("아무 일도 없었습니다")을 한 번 띄운다.

## TDD 증거 (RED 3줄)

- Task 1: `test(21-10)` `c1dd510d` — `--reporter=tap-flat` **not ok 2**(sceneView.test·clueParts.test 두 파일 모두 import 실패: sceneView.ts·ClueSpot·ClueCard 없음).
- Task 2: `test(21-10)` `372dc431` — **not ok 1**(skipPill.test import 실패: SkipPill 없음).
- Task 3: `test(21-10)` `7db90514` — **not ok 13 / ok 5**(ok 5 는 없어도 통과하는 보존 시험: 아침→토론에 큰 글 없음·0장 카드 줄 없음·유령에 표지 없음·네 역할 같은 서명 등).

## Task Commits

1. Task 1 RED `c1dd510d` test(21-10): 현장 표지·카드 실패 시험
2. Task 1 GREEN `8b284ecb` feat(21-10): 현장 표지·단서 카드
3. Task 2 RED `372dc431` test(21-10): 건너뛰기 실패 시험
4. Task 2 GREEN `ddddaf6e` feat(21-10): 저녁·아침 건너뛰기 단추
5. Task 3 RED `7db90514` test(21-10): 아침 현장 화면 실패 시험
6. Task 3 GREEN `7d4edf3b` feat(21-10): 아침 현장 조사 화면

## Deviations from Plan

### 계획에 없던 변경 (files_modified 밖)

**1. [Rule 3 - 막는 것 해소] 심부름 코드의 id 일반화.** 지점 id(`SpotId`)로 기존 투영·표본 코드를 재사용하려고 `placeMarkerPlan`·`nextPlaceOf`·`useErrandPos`·`ErrandAct`(id 선택 prop) 를 `Id extends string = PlaceId` 제네릭으로 풀었다. 기본 타입 매개변수가 `PlaceId` 라 기존 호출은 그대로이고 새 투영 식은 만들지 않았다. **Files:** src/game/errandView.ts, src/net/useErrandPos.ts, src/components/v2/ErrandAct.tsx. **Commit:** `7d4edf3b`.

**2. [Rule 2 - 계획이 말한 동작에 필요] 토론 첫머리 큰 글은 dayView 에서 만든다.** 계획은 GameMap 이라 했으나 큰 글 발표·알림 시각표는 `dayEvents`(RoomScreen 의 useDayFx)가 쥔 한 길이라 `dayView.phaseEntry` 에 `discussion` 분기를 더해 같은 길(announces)로 띄웠다(새 문장·채팅 줄 없음 — `MORNING_TEXT.quiet`). **Files:** src/game/dayView.ts. **Commit:** `7d4edf3b`.

**3. [Rule 3] RoomScreen·GameMap 의 HostLocal 타입에 `announcing` 추가.** 21-08 이 `HostLocal.announcing` 을 만들어 두었으나 켜는 곳이 없었다(계획 "21-10 이 켠다"). 방 화면의 `onHostLocal` 비교·타입을 넓혔다. **Files:** src/screens/RoomScreen.tsx.

**4. 새 훅 `src/net/useMorningAnnouncing.ts`.** 계획의 "OpeningFx 큰 글이 떠 있는 동안"은 튜토리얼 부품이고 실제 아침 큰 글은 결과 알림(ResultAnnounce, 지연 0.4~2.6초 뒤 뜸)이라, 밤 → 아침 전환 렌더에서 시작해 알림이 뜨고 사라질 때까지(알림이 안 오면 3.2초 뒤) true 인 작은 상태 기계로 만들었다. 재접속처럼 처음부터 아침이면 발표를 놓친 것이라 곧바로 지점이 보인다.

**5. 시험 보강·수정.**
- `test/client/worldStage.test.tsx` 에 아침 현장 층 시험 아홉 건을 더했다(투영 위치·화살표 칩·[살펴보기] 위치·빛남·카드/소리/[건너뛰기] 피함·링) — 계획 시험 넷에는 투영 논리를 진짜 런타임 가짜로 보는 시험이 없어서.
- `test/client/callGlow.test.tsx` 의 "빛남은 소리를 내지 않는다(소스 검사)" 가 GameMap 의 빛남 구간에서 `emitSignal` 을 막는데, 새 `onInspect` 핸들러(눌림 소리 ui.tap)가 그 구간에 들어와서 16-07 의 `onErrandAct` 와 같은 이유로 그 핸들러만 검사에서 뺐다(빛남 코드 `callTarget`·`callSpots` 는 그대로 검사). 검사를 약화하지 않고 대칭 예외만 더했다.

**6. 카드 줄 폭 규칙 보정.** UI-SPEC 의 "카드 최소 폭 96 × 3 + 간격 = 304" 대로면 카드 안 조각 이름 폭이 약 48 이라 "노란 연필 조각" 이 세 줄이 된다. 발자국 카드(아이콘 + 숫자)는 내용 폭(최소 72)으로 두고 조각 이름 카드(최소 96)가 남는 폭을 나눠 가진다(최소 합 280 ≤ 304, 이름 폭 약 62 → 두 줄). 창문 카드의 `window` 아이콘은 조각 그림 모서리에 작게(14) 얹는다. 높이 56 고정·두 줄 clamp 는 그대로. **실기기 눈 확인 필요**(알려진 한계 참고).

**Total deviations:** 6 (제네릭화 1, 큰 글 위치 1, 타입 확장 1, 새 훅 1, 시험 2, 폭 보정 1 — 모두 와이어·서버 규칙 변화 없음).

## 검증 결과

- `npm run typecheck`(tokens:check·placeart:check·wrangler types·tsc 앱·worker) 통과(exit 0, `error TS` 0).
- `npx vitest run test/client test/unit` — **250 files passed | 1 skipped, 8315 tests passed | 184 skipped**(첫 실행의 1건 실패는 위 callGlow 소스 검사이고 고친 뒤 32/32 통과).
- Task 3 verify 묶음(morningScene·clueParts·skipPill·gameMap·phaseArrival·errandScreen·causeLeak) 7 files / 176 passed | 2 skipped.
- `npx vitest run test/worker/causeLeak.test.ts` 통과 — 와이어 형식은 바뀌지 않아 `ALLOWED_NEW`/`SERVER_ONLY_NAMES` 는 그대로다. worker 전체(`--project worker`)는 알려진 간헐 5000ms 타임아웃(night.test·errandLeak) 때문에 돌리지 않았다(이 계획은 클라이언트 전용 변경).
- acceptance: `t: "inspect"` GameMap 1, `ClueSpot` WorldStage 2, `ClueCard` GameMap 2, `t: "skip"` GamePanel 2, `SkipPill` GamePanel 2, `.role` 읽기(주석 제외, sceneView·ClueSpot·ClueCard) 0, `morningScene.test.tsx` 있음.
- 위생: 바뀐 파일 diff 에 hex 리터럴·innerHTML·'참가자' 없음, CSS 는 토큰 변수만(clueParts·skipPill 이 대조), LF 유지(CR 0).

## Known Stubs

없음.

## Threat Flags

없음 — 새 엔드포인트·메시지·서버 상태 없음(기존 `inspect`·`skip`). 위협 대응: T-21-35(ClueSpot 점선 두 상태가 접근성 이름 외 같은 마크업 — clueParts 가 대조), T-21-36(sceneView·ClueSpot·ClueCard 소스에 `.role` 0, 네 역할 렌더의 지점 층·카드 줄·패널 구조 서명 동일 — morningScene), T-21-37(의사가 막은 아침의 화면·접근성 이름에 직업 글자 없음 — morningScene), T-21-38(조각 이름·닉네임은 React 텍스트 노드·속성 문자열뿐).

## 알려진 한계·넘기는 것

- 아침 지점 표지·카드 줄·[건너뛰기]가 폰 6종 × 띠 한 줄/두 줄에서 서로·띠·소리 단추 줄·아래 패널에 가려지지 않는지는 UI Considerations 의 backstop 이다 — 투영·피함 규칙은 worldStage.test 가 가짜 렌더러로 고정했지만 실제 3D 위 모양(특히 360×560 아침 입력줄 trailing 때문에 좁아진 채팅 입력칸, 카드 폭 62px 이름 두 줄)은 눈으로 봐야 한다(21-13 E2E·v3.0 실테스트).
- 아침 입력줄에 104폭 [건너뛰기]가 들어가 360 폭에서 입력칸이 약 100px 로 좁다 — UI-SPEC 은 패널 높이만 정하고 입력줄 폭은 말하지 않았다. 불편하면 [건너뛰기]를 입력줄 위 별도 행으로 옮기는 것이 다음 선택지(패널 높이가 약 58 늘어 스테이지가 줄어듦).
- `actableSpotOf` 는 sceneView 의 순수 거울(시험으로 서버 규칙과 고정)이고 GameMap 은 같은 판정을 `useErrandPos<SpotId>` 의 표본(내부적으로 같은 `actablePlaceOf`)으로 쓴다 — 두 길이 한 함수를 지난다.
- E2E 표식 `data-clue-spot`·`data-clue-card`·`data-skip` 은 생겼으나 E2E 흐름 쪽 소비는 이 계획 범위 밖(21-13).

## Self-Check: PASSED

- 생성 파일 있음: src/game/sceneView.ts, src/game/sceneText.ts, src/components/v2/ClueSpot.tsx, src/components/v2/ClueCard.tsx, src/components/v2/SkipPill.tsx, src/net/useMorningAnnouncing.ts, test/unit/sceneView.test.ts, test/client/clueParts.test.tsx, test/client/skipPill.test.tsx, test/client/morningScene.test.tsx
- 커밋 6개 모두 HEAD 의 조상(`c1dd510d`·`8b284ecb`·`372dc431`·`ddddaf6e`·`7db90514`·`7d4edf3b`)
