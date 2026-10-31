---
phase: 06-world-skeleton
plan: 13
subsystem: ui
tags: [react, three-runtime, rAF, tap-input, nametag-projection, webgl-context-recovery, e2e-hooks]

requires:
  - phase: 06-world-skeleton
    provides: "06-03 camera.ts·status.ts, 06-06 NETWORK_TEXT, 06-09 WorldStore, 06-10 WorldRenderer 인터페이스·threeRenderer, 06-11 characterKit, 06-12 HeadStack"
provides:
  - "createWorldRuntime: rAF 한 루프(서버 시각 positionOf → 캐릭터 → 카메라 → 렌더 → 이름표 투영), 링·손짓 링·등장/퇴장·상태기계 효과"
  - "loadWorld/preloadWorld: import() 두 줄로만 three 를 여는 지연 로드"
  - "WorldStage 컴포넌트(캔버스·입력 면·이름표 층·접근성 목록·가림막+MapStatusCard)와 MapStatusCard"
  - "createTapTracker/createTapGate 순수 탭 판정, worldTestHooksEnabled/installWorldTestHooks(window.__mfWorld)"
affects: [06-14-perf-spike, 06-15-lobby-frame, 06-17-e2e, 06-18-e2e, 07-chat-layout]

actuals:
  tokens: 25400
  tasks: 3
  commits: 7
plan_head_before: afeb580289fd499c3756aa059cb7002605e42ac4
plan_head_after: 03def30f485915d19f2d752f8eff9b7f2726daa6

tech-stack:
  added: []
  patterns:
    - "런타임이 DOM 이름표의 transform·opacity·z-index 를 직접 쓴다(React 상태에 위치를 넣지 않음), React 는 이름표 내용·접근성·누르기 버튼만"
    - "시각은 Date.now() 하나 + setTimeout/setInterval — 테스트는 가짜 타이머와 직접 쥔 rAF 로 프레임 사이 시간을 정한다"
    - "렌더러·캐릭터는 loadModules 로 주입(happy-dom 가짜, 06-14 시나리오 스토어)"

key-files:
  created:
    - src/world/runtime.ts
    - src/world/input.ts
    - src/world/testHooks.ts
    - src/components/WorldStage.tsx
    - src/components/MapStatusCard.tsx
    - src/styles/world.css
    - test/unit/input.test.ts
    - test/client/worldStage.test.tsx
  modified:
    - src/world/store.ts
    - test/unit/worldStore.test.ts

key-decisions:
  - "WorldStore 에 읽기 전용 currentEpoch() 를 더했다 — 새 연결의 첫 프레임을 알아봐 카메라·캐릭터를 날리지 않고 바로 붙이는 유일한 신호다"
  - "figForSeat 는 character.ts(three 를 끌고 옴)에서 가져오지 않고 characterData 의 FIGS 로 같은 식을 런타임에 둔다 — 메인 번들에 three 가 들어가지 않는다"
  - "이름표 위치는 머리 꼭대기 투영에서 NAMETAG_GAP(4px) 위, 장치 픽셀 반올림, z-index 는 발끝 화면 y 순위(0~7)이고 이름표 층이 z-tags 쌓임 맥락을 만든다"
  - "방을 나간 사람의 이름표는 WorldStage 가 view 가 바뀐 같은 렌더에서 EXIT_MS 동안 남겨 둔다(퇴장 페이드 보이게, 한 프레임도 비지 않음)"
  - "E2E 훅·소프트웨어 렌더러 허용은 같은 조건: ?e2e=1(sessionStorage 저장) 또는 import.meta.env.DEV"
  - "목적지 링은 렌더러에 마커 하나(MarkerKind 'ring')뿐이라 걷는 중 재탭은 새 목적지로 즉시 옮긴다(이전 링 120ms 별도 페이드는 만들지 않음)"

patterns-established:
  - "루트 data 속성 계약: data-world-stage, data-ring=\"x,z\", 이름표 data-seat/data-me/data-away(켜졌을 때만 \"true\")"
  - "상태기계 효과는 dispatch 한 곳: 1초 tick(소실·재생성 중만), shouldRecreate 일 때만 recreate 1회, 'ready' 복귀 때 resync"

requirements-completed: [MAP-01, MAP-02, MAP-03, MAP-05, MAP-07]

coverage:
  - id: D1
    description: "바닥 탭 → 링 100ms 안 → move {x,z} 1/100 정수(±700)만 전송, 10px/350ms/두 번째 손가락/150ms 간격/canSend false/ready 아님은 무시"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/unit/input.test.ts#createTapTracker, createTapGate"
        status: pass
      - kind: unit
        ref: "test/client/worldStage.test.tsx#WorldStage: 탭 → move (MAP-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "서버 구간대로만 걷기(예측 이동 없음)·이동 방향으로 돌고 멈추면 유지·카메라 90%/350ms 추적, 처음·재접속·복귀는 바로 붙고 크기 변화는 180ms 에 다시 맞춤, 모션 줄이기는 감쇠 없음"
    requirement: MAP-03
    verification:
      - kind: unit
        ref: "test/client/worldStage.test.tsx#WorldStage: 서버 구간대로 걷기와 카메라, 카메라: 날아가지 않고 붙는다"
        status: pass
    human_judgment: true
    rationale: "걷는 화면의 부드러움·카메라 따라감의 체감은 실기기에서 사람이 본다(06-14 성능 스파이크·06-17 E2E)"
  - id: D3
    description: "이름표 층: 머리 꼭대기 투영·장치 픽셀 반올림·발 y 순위·8명 겹침 밀지 않음, 접근성 목록 '방에 있는 사람 N명', 방장의 끊긴 사람 내보내기 버튼, 닉네임은 텍스트로만"
    requirement: MAP-07
    verification:
      - kind: unit
        ref: "test/client/worldStage.test.tsx#이름표 층, 접근성 목록과 내보내기 이름표"
        status: pass
    human_judgment: true
    rationale: "happy-dom 은 글자 폭을 재지 못한다 — 전각 8자 + ' (나)' 이름표가 잘리지 않는지·8명이 모인 화면에서 맨 앞이 읽히는지는 06-17 E2E 폰 6종과 사람이 본다"
  - id: D4
    description: "첫 snap 은 등장 연출 없음, 뒤 입장은 420ms 내려앉기(크기 0.6→1·위 0.4→0·이름표 0→1), 퇴장 180ms, 끊김은 setDim, 모션 줄이기는 즉시"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "test/client/worldStage.test.tsx#등장·퇴장 연출, 끊김 어둡게"
        status: pass
    human_judgment: false
  - id: D5
    description: "링: 구간 끝점으로 180ms 보정, 도착 180ms 사라짐, 1.5초 응답 없음 알림 1회, 맥박 1100ms, 처음 방문 손짓 링 600ms 뒤 3번 맥박·첫 탭에 즉시 사라짐·모션 줄이기 2.5초 고정"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/client/worldStage.test.tsx#목적지 링 피드백, 처음 방문 손짓 링"
        status: pass
    human_judgment: false
  - id: D6
    description: "맵 상태 카드와 WebGL 상태: 불러오는 중→열림(첫 snap+렌더러 준비 뒤)·실패 [다시 시도]·열 수 없음 [나가기]·소실 40% 가림막·복구 즉시 맞춤·3초 재생성 1회·5초 [새로 고침]·숨김 복귀·나가는 가림막"
    requirement: MAP-05
    verification:
      - kind: unit
        ref: "test/client/worldStage.test.tsx#맵 상태 카드, WebGL 컨텍스트 소실·복구, 화면 숨김·복귀, 나가는 가림막"
        status: pass
    human_judgment: true
    rationale: "가짜 렌더러로 상태 전이만 증명했다 — 실제 iOS 컨텍스트 소실·복구와 흰/검은 화면 잔존 여부는 실기기(06-14 성능 게이트 WebGL 복구 행)와 06-17·06-18 E2E 가 확인한다"
  - id: D7
    description: "window.__mfWorld(sample·seats·ring·status·interactiveMs·screenOf·debug.*)는 ?e2e=1·개발 빌드에서만, performance.mark('map-interactive') 한 번"
    requirement: MAP-05
    verification:
      - kind: unit
        ref: "test/client/worldStage.test.tsx#E2E 훅 (T-06-27), 맵 상태 카드: 불러오는 중 → 열림"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-10-31
status: complete
---

# Phase 6 Plan 13: 로비 맵 런타임·WorldStage Summary

**rAF 한 루프가 서버 시각 positionOf 로 3D 캐릭터·카메라·DOM 이름표를 놓고, 바닥 탭이 링 → move 정수 → 서버 구간 → 걷기로 이어지며, 소실·복구·재생성·숨김·불러오기 실패를 카드로 처리하는 로비 맵 화면 부품(가짜 렌더러 테스트 64개)**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-31T17:16:36Z
- **Completed:** 2026-10-31T17:30:05Z (코드 마지막 커밋 기준)
- **Tasks:** 3 (트레이서 1 + auto 2, 모두 TDD)
- **Files modified:** 10 (신규 8 + 06-09 store.ts·worldStore.test.ts 에 읽기 전용 getter)

## Accomplishments

- **트레이서(MAP-02·03):** 탭 → 링 즉시 → `move {x,z}`(1/100 정수, ±700 클램프)만 전송. 서버 구간이 오기 전에는 내 캐릭터가 움직이지 않고, 오면 `positionOf` 와 1e-6 이내로 놓이며 이동 방향(`atan2(dx,dz)`)으로 돌고 멈추면 유지. 카메라는 `clampTarget`·`followStep` 으로 따라가고 처음·새 epoch·복귀 프레임에는 바로 붙는다. 언마운트·StrictMode 에서 살아 있는 렌더러는 하나.
- **이름표·접근성(MAP-01·07):** 머리 꼭대기 투영(간격 4px 위)을 장치 픽셀에 반올림해 `translate(-50%,-100%)`, z-index 는 발끝 화면 y 순위(8명이 한 점에 모여도 좌표 동일·순위 8개 서로 다름, 밀지 않음). 보이지 않는 목록 "방에 있는 사람 N명"(", 방장"·", 나"·", 연결 끊김"), 방장은 끊긴 다른 사람 이름표를 44×44 이상 버튼("{닉네임} 님 내보내기")으로 눌러 내보내기. 닉네임은 텍스트 노드로만.
- **연출·링(MAP-01·02):** 첫 snap 은 등장 없음, 뒤 입장은 420ms 내려앉기, 퇴장은 180ms(이름표 페이드 포함), 끊김은 setDim. 링은 구간 끝점으로 180ms 보정·도착 180ms 소멸·1.5초 응답 없음 알림 1회·1100ms 맥박(모션 줄이기 고정). `mf-hint-walk` 없는 기기에서만 맵이 열린 600ms 뒤 손짓 링 3번 맥박.
- **상태·복구(MAP-05):** 첫 snap 과 렌더러가 모두 준비된 첫 프레임 뒤에만 열림(그전엔 카드만). 불러오기 실패 [다시 시도], 렌더러 생성 실패 [나가기](고정 테이블로 대체하지 않음), 소실 40% 가림막(GL 그리기 중단·이름표/서버 위치 계속), 복구 즉시 맞춤, 3초 재생성 정확히 1회, 5초 [새로 고침], 숨김 중 rAF 중단·복귀 시 `isContextLost` 확인 뒤 한 프레임, 나가기 420ms 가림막 뒤 dispose·onExited.
- **검사 가능성:** `window.__mfWorld`(sample·seats·ring·status·interactiveMs·screenOf·debug.loseContext/restoreContext/info/recreate)는 `?e2e=1`(세션 저장)·개발 빌드에서만, `performance.mark("map-interactive")` 는 열린 뒤 한 번. 훅이 켜진 때만 소프트웨어 렌더러 허용.

## Task Commits

1. **Task 1: 트레이서** - RED `386b048` (test) → GREEN `4e57777` (feat)
2. **Task 2: 이름표·연출·링·손짓 링** - RED `4c34559` (test) → GREEN `fe3e038` (feat)
3. **Task 3: 상태 카드·복구·훅** - RED `83b7366` (test) → GREEN `583dfb6` (feat), 회귀 테스트 보강 `03def30` (test: 재접속·크기 변화 카메라)

**Plan metadata:** 이 SUMMARY 커밋(docs)과 STATE·ROADMAP·REQUIREMENTS 갱신 커밋.

## Files Created/Modified

- `src/world/runtime.ts` - 프레임 루프·캐릭터 배치·카메라·이름표 투영·링/손짓 링·상태기계 효과·`loadWorld`/`preloadWorld`
- `src/world/input.ts` - 탭 트래커(10px·350ms·두 번째 손가락)와 150ms 간격 게이트(순수)
- `src/world/testHooks.ts` - `worldTestHooksEnabled`(sheetProbe 와 같은 규칙)·`installWorldTestHooks`
- `src/components/WorldStage.tsx` - 캔버스 호스트·입력 면·이름표 층·접근성 목록·가림막+카드, 탭 → send
- `src/components/MapStatusCard.tsx` - `MAP_STATUS_COPY` 로 그리는 상태 카드(작은 형태 포함)
- `src/styles/world.css` - 토큰만 쓴 스타일(캔버스 inset 0, `touch-action: none`, 이름표 층 z-tags, 가림막 z-modal)
- `test/unit/input.test.ts`, `test/client/worldStage.test.tsx` - 12 + 64 개 테스트(가짜 렌더러·캐릭터·rAF 도우미 포함)
- `src/world/store.ts`, `test/unit/worldStore.test.ts` - `currentEpoch()` getter 와 테스트 1개

## Decisions Made

key-decisions 참고. 공통 원칙은 "위치의 진실은 서버 구간, 그리기는 한 루프, React 는 글과 틀만"이다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] WorldStore 에 `currentEpoch()` getter 추가**
- **Found during:** Task 1 (카메라를 새 연결 첫 프레임에 바로 붙이기)
- **Issue:** `epoch` 가 private 이고 스토어가 epoch 를 노출하지 않아, 같은 연결의 재-snap 이 아닌 "새 연결의 첫 snap" 을 구분할 방법이 없었다(`isReady()` 전이만으로는 재접속 때 ready 가 계속 true 라 놓친다).
- **Fix:** 읽기 전용 `currentEpoch(): number` 한 개와 단위 테스트 1개. 동작 변경 없음.
- **Files modified:** `src/world/store.ts`, `test/unit/worldStore.test.ts`
- **Verification:** `npx vitest run test/unit/worldStore.test.ts` 16개 통과
- **Committed in:** `4e57777`

**2. [Rule 2 - Missing Critical] `figForSeat` 를 character.ts 에서 가져오지 않고 같은 식을 런타임에 둠**
- **Found during:** Task 1
- **Issue:** `figForSeat` 는 `character.ts`(three 값 import)에 있어 정적으로 가져오면 메인 번들에 three 가 들어간다(plan 의 `from "three"` 0 건 기준과 번들 분리 목적 위배).
- **Fix:** three 를 쓰지 않는 `characterData.FIGS` 로 같은 식(`((seat % n) + n) % n`)을 런타임에 둔다. 주석으로 원본을 가리킨다.
- **Files modified:** `src/world/runtime.ts`
- **Committed in:** `4e57777`

**3. [Rule 2 - Missing Critical] 보내지 못한 move 의 링 정리, 퇴장 중 이름표 유지, 불러오는 중 소실 처리**
- **Found during:** Task 2·3
- **Issue:** (a) `send` 가 false(소켓 닫힘)면 링과 응답 없음 시계가 남는다 (b) 나간 사람 이름표가 view 에서 바로 사라져 페이드가 안 보인다 (c) 불러오는 중 컨텍스트 소실은 06-03 리듀서가 무시해 카드가 영원히 "불러오는 중" 으로 남는다(06-03 SUMMARY 가 런타임 몫으로 넘긴 항목).
- **Fix:** (a) `cancelMove()` 로 링을 알림 없이 거둠 (b) WorldStage 가 view 변경과 같은 렌더에서 나간 사람을 `EXIT_MS + 30ms` 동안 남김 (c) `onRendererStatus` 가 loading 중 lost 를 `loadError` 로 보내고 렌더러를 정리.
- **Files modified:** `src/world/runtime.ts`, `src/components/WorldStage.tsx`
- **Verification:** 각각 `worldStage.test.tsx` 테스트(보내지 못했으면 링 거둠, 나간 사람 이름표, 불러오는 중에 컨텍스트를 잃으면)
- **Committed in:** `fe3e038`, `583dfb6`

**4. [인터페이스 확장] plan `<interfaces>` 에 없던 이음새**
- `WorldRuntimeDeps.onRing`(루트 `data-ring` 갱신), `WorldRuntime.cancelMove/ring/status/interactiveMs`(훅·보낸 실패 처리), `WorldStageProps.reload`(테스트가 바꿔 끼우는 [새로 고침]). 모두 선택적이거나 추가 멤버라 plan 의 시그니처를 깨지 않는다. `installWorldTestHooks(runtime, store)` 는 plan 의 3인자에서 `serverNow` 를 뺐다(런타임 `sample` 이 이미 서버 시각을 쓴다).

---

**Total deviations:** 3 auto-fixed (1 Rule 3, 2 Rule 2) + 인터페이스 확장
**Impact on plan:** 모두 plan 의 truths(재접속 바로 붙음, three 분리, 흰/검은 화면 없음)를 지키기 위한 것. 범위 확대 없음.

## 명세와 다르게 단순화한 곳

- **걷는 중 재탭의 "이전 링 120ms 에 사라짐"** (UI-SPEC 터치해서 걷기 6): 렌더러 `MarkerKind` 에 `"ring"` 이 하나뿐이라 새 목적지로 링을 즉시 옮긴다. 두 링을 겹쳐 보여 주려면 06-10 렌더러에 마커를 더해야 한다(범위 밖).
- **등장 때 발밑 그림자 0→0.3**: 그림자 원판은 캐릭터 root 안에 있어 root 크기 0.6→1 과 함께 자랄 뿐 불투명도를 따로 올리지 않는다(06-11 몫).
- **맵 소품 일부 재질 실패 → 단색 대체** (backstop 진리값): 소품이 코드 생성이라 일어나기 어렵다(plan 가정 A3). 모듈 import 실패는 `loadError`, 렌더러 생성 실패는 `unsupported` 로 간다. 06-18 이 월드 청크 요청을 막아 확인한다.

## TDD 게이트 준수

- RED 커밋 3개(`386b048`·`4c34559`·`83b7366`) 모두 GREEN 앞에 있다. 계획 유형은 `execute`(task 단위 `tdd="true`)라 게이트는 권고이지만 지켰다.
- **Task 1 의 RED 는 모듈 부재(import 해석 실패)다.** 대상 모듈(`input.ts`·`WorldStage.tsx`)이 아직 없어 단언까지 가지 못했다 — tdd.md 기준으로 엄밀한 RED 증거(단언 실패)는 아니다. Task 2 RED 는 21개가 단언 실패(이름표 층이 없다 등), Task 3 RED 는 껍데기 `testHooks.ts` 를 두어 16개가 단언 실패로 갔다.
- 구현이 이미 만족하는 테스트(맥박·보낸 뒤 알림 없음 등)는 RED 에서 통과했다 — 회귀 고정용이다.

## Issues Encountered

- **열린 발견(사용자 결정 대기, 06-12 이월):** 내 이름표 + 이모지 8개는 " (나)" 포함 약 202px 로 `NAMETAG_MAX_W` 180 을 넘는다. 이 계획은 `camera.ts` 의 `PAN_BOX`·`NAMETAG_MAX_W` 를 건드리지 않았다. 런타임은 이름표 폭에 의존하지 않고(머리 꼭대기 한 점에 놓음) 최대 폭을 쓰는 곳은 06-03 의 가시성 계산뿐이다. PAN_BOX 여유 재유도 여부는 06-17 E2E 의 실제 폭 측정 뒤 사용자가 정한다.
- happy-dom 에서 `clientHeight` 가 0 이라 런타임은 크기 0 이면 `window.innerWidth/Height` 로 대체한다(실브라우저에서는 호스트 크기를 쓴다). `stageOffsetY` 는 `H` 와 무관하게 `(패널 − 위)/2` 라, 스테이지 사각형의 위/아래 여백이 바뀔 때만 카메라 중심이 180ms 에 걸쳐 움직이고 순수한 높이 변화는 `renderer.resize` 만 일으킨다.

## Known Stubs

없음. 의도적 빈 값·가짜 데이터가 사용자 화면으로 흐르는 곳이 없다(가짜 렌더러·캐릭터는 테스트 파일 안에만 있다).

## Threat Flags

없음. 새 네트워크 표면 없음. `window.__mfWorld` 는 plan 의 T-06-27(`?e2e=1`·개발 빌드에서만, 꺼진 상태 테스트 있음)로 이미 다뤘고, 보내는 값은 `{t:"move", x, z}` 정수뿐(T-06-28), 닉네임은 텍스트 노드·aria-label 문자열(T-06-29)이다.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **06-14(성능 스파이크):** `createWorldRuntime` 을 시나리오 스토어와 `loadModules`(또는 기본 `loadWorld`)로 돌리면 제품과 같은 코드로 잰다. `performance.mark("map-interactive")`·`__mfWorld.interactiveMs()`·`debug.info()` 로 숫자를 읽는다.
- **06-15(로비 틀):** `WorldStage` 를 `Lobby` 에 놓고 `stageInsets`(헤더 아래 끝·패널 높이)를 재서 넘기고, `RoomScreen` 이 `store.reset()`·`onEvent((e, meta) => store.applyFrame(e, meta.epoch))`·`preloadWorld()`·`onReady`(PhaseHeader 안내 접기)·`exiting`/`onExited`(게임 시작 가림막)를 이어야 한다. WorldStage 는 아직 어느 화면에서도 쓰이지 않는다.
- **06-17·06-18(E2E):** `[data-world-stage]`·`data-ring`·`.mf-world__tags [data-seat]`·`window.__mfWorld` 계약을 쓴다. 실제 GL 소실·복구, 이름표 폭(전각 8자 + 이모지), 캔버스 크기 불변은 브라우저에서 확인할 몫.
- 실제 WebGL 로 확인하지 못한 것: 카메라 감쇠 체감, 8명 모인 화면의 이름표 가독, 복구 후 흰/검은 화면 잔존 없음(가짜 렌더러로는 상태 전이까지만 증명).

## Self-Check: PASSED

- 파일: `src/world/runtime.ts`·`input.ts`·`testHooks.ts`, `src/components/WorldStage.tsx`·`MapStatusCard.tsx`, `src/styles/world.css`, `test/unit/input.test.ts`·`test/client/worldStage.test.tsx` 모두 존재.
- 커밋: 386b048, 4e57777, 4c34559, fe3e038, 83b7366, 583dfb6, 03def30 모두 HEAD 의 조상. `evaluation-scope --plan 06-13 --commits-only` 가 이 브랜치의 커밋을 확인.
- 인수 기준: Task 1·2·3 의 grep 기준 전부 성공(`from "three` 0건), `test(06-13)` 커밋 존재.
- 검증: `npx vitest run test/unit/input.test.ts test/client/worldStage.test.tsx` 통과(76개), 전체 `npx vitest run` 134 파일 통과 / `npm run typecheck` 종료 0.

---
*Phase: 06-world-skeleton*
*Completed: 2026-10-31*
