---
phase: 06-world-skeleton
plan: 14
subsystem: ui
tags: [perf-spike, hud, cdp-throttle, auto-degrade, light-tune, chat-mock, visual-viewport, lazy-chunk]

requires:
  - phase: 06-world-skeleton
    provides: "06-13 createWorldRuntime·WorldStore 주입, 06-10 LADDER·nextLadderStep·info(), 06-11 playEmote, 06-02/05 routeFx·walkableCells·MOVE_V, 06-01 deploy-target exitIfV1"
provides:
  - "?perf=1 성능 스파이크: 제품과 같은 런타임·렌더러·3D 캐릭터로 재즈 바 + 8명이 같은 seed 면 같은 경로로 걷고 5초마다 박수·손사래, HUD·결과 카드·window.__mfPerf.result·하트비트"
  - "scripts/perf-run.mjs: 시스템 Chrome + CDP CPU 스로틀·DPR 로 결과 JSON·스크린샷 저장(v1 주소 거부)"
  - "제품 런타임 자동 강등(createAutoDegrade, 10초 평균 45fps 미만이면 1~3단계) + onFrame 훅 + characterOf(seat)"
  - "?chat-mock=1 하단 채팅 배치 시안(visualViewport·IME 기록 패널)"
  - "LIGHT_TUNE 을 승인 맵 그림 분위기로 다시 맞춘 값(390x844 전후 스크린샷)"
affects: [06-15-lobby-frame, 06-17-e2e, 06-18-e2e, 06-19-perf-verdict, 07-chat-layout]

actuals:
  tokens: 26000
  tasks: 3
  commits: 5
plan_head_before: d587f032ad55cf467772483c1425a733af5c923e
plan_head_after: 68f954bc4f2af98b7fdbec5deacb46735e1483c3

tech-stack:
  added: []
  patterns:
    - "측정 코드는 쿼리일 때만 import() 한 곳으로 내려받는다(perfProbe.initPerfDebug) — 메인 청크에 three·측정 코드 없음"
    - "시나리오는 자리마다 난수 흐름이 따로인 순수 이벤트 생성기(시각은 인자) — 같은 seed 면 같은 경로, 사람이 눌러도 다른 사람은 그대로"
    - "측정 단계 고정: 스파이크는 autoDegrade:false, 제품은 기본 true"

key-files:
  created:
    - src/debug/perfProbe.ts
    - src/debug/perf/perfScene.ts
    - src/debug/perf/scenario.ts
    - src/debug/perf/metrics.ts
    - src/debug/perf/hud.ts
    - src/debug/perf/tags.ts
    - src/debug/chatMock.ts
    - scripts/perf-run.mjs
    - test/unit/perfMetrics.test.ts
    - test/unit/perfScenario.test.ts
    - test/client/perfProbe.test.tsx
  modified:
    - src/main.tsx
    - src/world/runtime.ts
    - src/world/maps/bar.ts
    - test/unit/barScene.test.ts

key-decisions:
  - "동작 이벤트는 걷는 사람을 먼저 그 자리에 세운다(한 점 구간 move) — 8명이 거의 늘 걷고 있어 '걷지 않는 사람에게만' 을 그대로 지키면 5초 간격이 깨진다"
  - "프레임 기록 칸은 5분 × 150Hz 로 잡는다(기본 60×330 은 120Hz 폰에서 2분 45초에 가득 참) — 가득 차면 truncated 로 표시하고 멈춘다"
  - "측정 시계는 맵이 열린(ready) 뒤부터 흐른다 — 모듈 받기·맵 만들기는 따로 재서 결과에 적는다"
  - "탭 → 링 지연은 pointerup 의 timeStamp 에서 링이 그려진 첫 rAF 까지로 잰다(서버 왕복 없음, 화면 쪽 비용만)"
  - "LIGHT_TUNE 은 반구·달빛·노출·하늘 색만 올렸다(점광원·emissive·빛 무리는 그대로) — 따뜻한 빛은 벽등·촛불·무대에만 남는다"

patterns-established:
  - "perf-run.mjs: parseArgs·outputBase·targetUrl 이 순수 export, 직접 실행했을 때만 main() — 파일 이름 desktop-{scene}-dpr{dpr}-x{throttle}.json/.png"
  - "하트비트: sessionStorage minifia:perf:hb {state, at} 5초, 끝나면 finished — running 이 남아 있으면 이전 실행이 도중에 끝남(탭 폐기·새로 고침 포함)"

requirements-completed: [MAP-01, MAP-02, MAP-03]

coverage:
  - id: D1
    description: "?perf=1·?chat-mock=1 은 쿼리일 때만 측정 본체를 import() 하고 메인 청크에는 three·측정 코드가 없다"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "test/client/perfProbe.test.tsx#initPerfDebug: 지연 로드"
        status: pass
      - kind: other
        ref: "npx vite build + dist/client/assets/index-*.js 에 WebGLRenderer 없음(three-in-main 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "같은 seed 면 같은 이동 경로(routeFx 구간, v = MOVE_V, 입장 지점 시작), 5초마다 clap·deny 번갈아 한 명, 걷던 사람은 먼저 멈춘 뒤 동작"
    requirement: MAP-02
    verification:
      - kind: unit
        ref: "test/unit/perfScenario.test.ts#createScenario"
        status: pass
    human_judgment: false
  - id: D3
    description: "프레임 기록·평균 fps·끊김·백분위·rAF Hz·열 스로틀 비율·하트비트 판정 순수 계산"
    requirement: MAP-03
    verification:
      - kind: unit
        ref: "test/unit/perfMetrics.test.ts#FrameRecorder, avgFps·jankCount·percentile, rafHzGuess, thermalRatio, heartbeatVerdict, summarizeFrames"
        status: pass
    human_judgment: false
  - id: D4
    description: "제품 런타임 자동 강등: 10초 평균 45fps 미만이면 1 → 2 → 3 단계, 되돌리지 않음, 4단계 이상·꺼짐·숨었다 돌아온 간격은 건드리지 않음"
    requirement: MAP-03
    verification:
      - kind: unit
        ref: "test/unit/perfMetrics.test.ts#createAutoDegrade"
        status: pass
    human_judgment: false
  - id: D5
    description: "scripts/perf-run.mjs: v1 주소 거부, CDP CPU 스로틀·DPR, 결과 JSON·스크린샷 저장 — 로컬 연기 실행으로 확인"
    requirement: MAP-03
    verification:
      - kind: other
        ref: "node scripts/perf-run.mjs --url http://localhost:5173 --scene talk --minutes 0.25 --throttle 1 (JSON 생성, calls 66 ≤ 120)"
        status: pass
      - kind: other
        ref: "node scripts/perf-run.mjs --url https://minifia.dhplay.workers.dev → 종료 상태 1, 네트워크 요청 전에 거부"
        status: pass
    human_judgment: false
  - id: D6
    description: "HUD(1Hz 텍스트·접기)·결과 카드(스크린샷용)·window.__mfPerf.result"
    requirement: MAP-03
    verification:
      - kind: other
        ref: "perf-run 연기 실행: 결과 카드 스크린샷 perf/desktop-talk-dpr2-x1.png, window.__mfPerf.result JSON"
        status: pass
    human_judgment: true
    rationale: "HUD·결과 카드 DOM 은 자동 시험이 없다(연기 실행의 스크린샷으로만 확인). 실기기에서 글자 크기·접기·카드 읽힘은 06-19 가 본다"
  - id: D7
    description: "?chat-mock=1: 하단 패널이 visualViewport 기준으로 키보드 위에 붙고 캔버스는 고정, 측정 기록(RO 호출 수·정착 시간·튐·IME 순서)"
    requirement: MAP-03
    verification: []
    human_judgment: true
    rationale: "키보드·한글 조합은 실기기(iPhone Safari)에서만 재현된다. 헤드리스에서는 레이아웃과 기록 패널이 뜨는 것까지만 확인했다. 확인표는 06-19 가 채운다"
  - id: D8
    description: "LIGHT_TUNE 을 map-bar.png 분위기에 맞게 올림: 바닥 판자·캐릭터·무대 둘레가 읽히고 따뜻한 빛은 벽등·촛불·무대에만"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "test/unit/barScene.test.ts#조명 단계 데이터는 승인 맵 그림과 나란히 놓고 맞춘 값이다"
        status: pass
    human_judgment: true
    rationale: "조명 분위기와 읽힘은 화면 비교 판단이다(UI-SPEC: 맞추는 기준은 숫자가 아니라 시안). 전후 스크린샷은 perf/tune-{before,after}-{talk,vote}.png"

duration: 18min
completed: 2026-10-31
status: complete
---

# Phase 6 Plan 14: 성능 스파이크·조명 맞추기·채팅 시안 Summary

**`?perf=1` 이 제품과 같은 런타임으로 재즈 바 + 8명을 시드 고정 경로로 돌리며 HUD·결과 카드·하트비트를 남기고, 크롬 CPU 스로틀 자동 측정 스크립트·제품 자동 강등·`?chat-mock=1` 키보드 배치 시안·승인 그림에 맞춘 LIGHT_TUNE 을 갖춤(측정 코드는 쿼리일 때만 받는 지연 청크, 메인 청크에 three 없음)**

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-31T17:35:06Z
- **Completed:** 2026-10-31T17:53:40Z (코드 마지막 커밋 기준)
- **Tasks:** 3 (트레이서 1 + auto 2, 모두 TDD)
- **Files modified:** 15 (신규 11 + 수정 4) + perf/ 산출물 9개

## Accomplishments

- **트레이서(MAP-01·02):** `?perf=1&scene=talk|vote&minutes&dpr&budget&seed&chars&shot&nav` 가 `createWorldRuntime` 에 시나리오 `WorldStore` 를 넣어 제품과 같은 코드로 8명을 돌린다. 이름표는 제품 `mv-head > mv-tag` 마크업, 0번이 "나", 카메라는 0번을 따라간다. 사람이 누르면 같은 모양의 구간을 바로 넣어 탭 → 링 → 걷기 흐름도 잰다. 쿼리가 없으면 측정 코드를 내려받지 않는다(`import("./perf/perfScene")` 한 곳).
- **지표·HUD(성공 기준 4):** 평균 fps(프레임 수 ÷ 경과 초)·끊김(>50ms)·p50/p95/p99/최장·첫/마지막 1분 비율(<0.85 열 의심)·rAF 주기(120/90/60/30Hz, 30 이면 저전력 의심)·이름표 투영·쓰기 p95·render 호출 p95·맵 생성/모듈 받기 시간·`renderer.info`·JS 힙·탭 → 링·조작 가능 시각·하트비트·기기 정보. 텍스트는 1Hz, 접기 버튼, 끝나면 결과 카드와 `window.__mfPerf.result`. 서버로 보내는 곳 없음.
- **자동 강등(제품):** `createAutoDegrade` — 10초 평균 45fps 미만이면 1→2→3 단계를 한 단계씩, 되돌리지 않고 안내 문구 없음. 스파이크는 `autoDegrade:false`.
- **perf-run.mjs:** 시스템 Chrome 으로 `?perf=1` 을 열어 CDP `Emulation.setCPUThrottlingRate`·`setDeviceMetricsOverride` 를 걸고 결과 JSON·스크린샷 저장. `exitIfV1` 이 어떤 요청보다 먼저 v1.0 을 거부한다(확인: 종료 상태 1).
- **`?chat-mock=1`:** 기록 96~152 + 입력줄 48 + 행동 줄 52 패널(night-800 97%)을 `visualViewport` 로 키보드 위에 붙이고 캔버스는 고정(ResizeObserver 호출 수 기록), 카메라 `offsetY` 만 남은 영역으로 옮김. 이벤트마다 vv 값·가려짐·정착 시간·닫을 때 튐·조합/Enter 순서를 접이식 패널에 남긴다.
- **LIGHT_TUNE:** map-bar.png 와 나란히 보고 반구·달빛·노출·하늘 색을 올림(아래 표).

## 로컬 연기 실행 (판정 아님)

헤드리스 시스템 Chrome 156(Apple M3 Pro, ANGLE Metal), 15초 측정. 합격 판정은 06-19(실기기 + 5분)가 한다.

| 파일 | 조합 | 평균 fps | 끊김 | p95 | calls | triangles |
|------|------|---------|------|-----|-------|-----------|
| `.planning/phases/06-world-skeleton/perf/desktop-talk-dpr2-x1.json` | talk · DPR 2 · CPU 1× | 60.0 | 0 | 16.7ms | 66 | 83,836 |
| `.planning/phases/06-world-skeleton/perf/desktop-vote-dpr1.5-x4.json` | vote · DPR 1.5 · CPU 4× | 59.9 | 0 | 16.7ms | 67 | 83,838 |

calls 66~67 ≤ 예산 120. 이름표 투영·쓰기 p95 0.1ms, render 호출 CPU p95 0.3ms, 맵 생성 23ms·모듈 받기 27ms(모두 로컬 개발 서버). geometries 60·textures 4·programs 7·pointLights 3. 헤드리스 + 데스크톱 GPU 라 모바일 GPU 비용은 재지 못한다(RESEARCH R2.4 교훈 ②).

## LIGHT_TUNE 전후

기준: `design/v2.0/design-system/assets/Maps/map-bar.png`(바닥 판자·무대 둘레·벽등/촛불 웅덩이가 읽힘). 장면: 390×844·DPR 2·seed 90(0번이 무대 곁, 5명이 가까이 모인 구도)·10초 멈춤. 파일: `perf/tune-{before,after}-{talk,vote}.png`.

| 값 | talk 전 → 후 | vote 전 → 후 | 이유 |
|----|-------------|-------------|------|
| 반구광 `hemi` | 0.42π → 1.1π | 0.3π → 0.7π | 시안 세기 × π 로는 바닥 판자·캐릭터 등이 검게 묻힘 |
| 달빛 `moon` | 0.35π → 0.85π | 0.25π → 0.55π | 캐릭터 뒷모습·가구 윤곽 |
| 노출 `exposure` | 1.0 → 1.25 | 1.0 → 1.25 | 전체 톤 |
| 하늘색(반구 위) | #1a1830 → #524b84 | #161428 → #3a3464 | 차가운 달빛 기운 유지하며 밝힘 |
| 땅색(반구 아래) | #0b0a14 → #2a2034 | #09080f → #1c1428 | 바닥 판자가 읽히게 |
| 배경·안개색 | #120f1c → #15111f | #0e0c16 → #100d19 | 방 밖은 어둠 그대로 |
| 무대 점광원 `stage` | 0 → 0 | 6.4 → 8.0 | vote 에서 무대 둘레와 주변 캐릭터가 따뜻하게 읽히게 |

바꾸지 않은 것: 펜던트 점광원·emissive 배율·빛 무리·안개 거리(벽등·촛불 웅덩이는 이미 읽혔음). vote 는 talk 보다 어둡고 무대에만 점광원이 있다는 관계를 `barScene.test.ts` 가 지킨다. 최종 읽힘은 사람 확인(06-19).

## perf-run.mjs 인자·출력 이름

`node scripts/perf-run.mjs [--url][--scene talk|vote][--minutes 5][--dpr 2][--throttle 4][--size 390x844][--out .planning/phases/06-world-skeleton/perf/][--headed]` + 추가: `--budget 0~5`, `--seed`, `--shot [--file 이름]`(HUD 없이 10초에 멈춘 장면 PNG). 출력: `desktop-{scene}-dpr{dpr}-x{throttle}.json/.png`(`--shot` 은 앞에 `shot-`, `--file` 이면 그 이름). JSON 은 결과에 `runner`(Chrome 버전·헤드리스 여부·플랫폼)를 덧붙인다(가정 A1 기록). 종료 상태 1 = 인자·주소·Chrome·시간 초과·페이지 오류.

## 하단 채팅 확인표 (iPhone Safari — 06-19 가 채움)

| 확인 | iPhone Safari |
|------|---------------|
| 키보드가 열려도 입력줄이 가려지지 않음 | 미확인(실기기 필요) |
| 캔버스가 깜빡이거나 크기가 바뀌지 않음(ResizeObserver 호출 0회) | 미확인 |
| 내 캐릭터가 남은 영역 안에 보임 | 미확인 |
| 한글 조합 중 Enter 가 깨지지 않음(compositionend 와 Enter keydown 순서) | 미확인 |
| 닫을 때 화면이 위로 튀지 않음 | 미확인 |

헤드리스(키보드 없음)에서는 값이 변하지 않는 기준선만 확인했다: vv.h=844·패널 가려짐 0·RO 호출 0·내 캐릭터가 영역 안.

## Task Commits

1. **Task 1: 트레이서** - RED `9b20213` (test) → GREEN `b514583` (feat)
2. **Task 2: 지표·HUD·자동 강등·perf-run** - RED `1608cab` (test) → GREEN `6da89d4` (feat)
3. **Task 3: chat-mock·LIGHT_TUNE** - `68f954b` (feat)

**Plan metadata:** 이 SUMMARY 커밋(docs)과 STATE·ROADMAP·REQUIREMENTS 갱신.

## Files Created/Modified

- `src/debug/perfProbe.ts` - 쿼리 판정과 지연 import 한 곳(운영 번들 몫)
- `src/debug/perf/perfScene.ts` - 스파이크 장면: 런타임·시나리오 스토어·이름표·탭·nav·shot
- `src/debug/perf/scenario.ts` - mulberry32·시나리오 이벤트 생성기·쿼리 해석
- `src/debug/perf/metrics.ts` - FrameRecorder·지표·하트비트 판정(순수)
- `src/debug/perf/hud.ts` - HUD·결과 카드·하트비트·`window.__mfPerf`
- `src/debug/perf/tags.ts` - 두 디버그 화면이 같이 쓰는 이름표 마크업
- `src/debug/chatMock.ts` - 하단 채팅 배치 시안과 측정 기록
- `scripts/perf-run.mjs` - 크롬 CPU 스로틀 자동 측정
- `src/main.tsx` - `initPerfDebug()` 가 true 면 App 을 렌더하지 않음
- `src/world/runtime.ts` - `createAutoDegrade`·`autoDegrade`·`onFrame`·`characterOf`
- `src/world/maps/bar.ts` - LIGHT_TUNE 값
- `test/unit/perfMetrics.test.ts`·`perfScenario.test.ts`, `test/client/perfProbe.test.tsx`, `test/unit/barScene.test.ts`(시작값 고정 → 맞춘 값 고정)

## Decisions Made

key-decisions 참고. 공통 원칙은 "제품과 같은 코드로 재고, 재는 코드는 쿼리가 있을 때만 받는다".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 5초 동작 간격이 "걷지 않는 사람에게만" 과 충돌**
- **Found during:** Task 1 (시나리오 테스트, 120초 실행)
- **Issue:** 3~6초마다 새 목적지로 걷는 8명은 5초 슬롯의 일부에서 모두 걷고 있어(60초에 2번) 걷지 않는 사람이 없었다. 건너뛰면 "5초마다 하나" 가 깨진다.
- **Fix:** 돌아가는 차례의 사람이 걷고 있으면 그 자리에 선다(한 점 구간 move 프레임, 같은 시각) → 동작. 동작이 끝나기 전(2초)에는 다시 걷지 않는다.
- **Files modified:** `src/debug/perf/scenario.ts`, `test/unit/perfScenario.test.ts`
- **Verification:** `perfScenario.test.ts` — 5초마다 12회·clap/deny 번갈아·동작 시점에 항상 서 있음·8명이 돌아가며 받음
- **Committed in:** `b514583`

**2. [Rule 2 - Missing Critical] 프레임 기록 칸을 120Hz 폰의 5분에 맞게 키움**
- **Found during:** Task 2 (HUD)
- **Issue:** 기본 60×330 = 19,800칸은 120Hz 에서 2분 45초에 가득 차 5분 측정이 잘린다(측정이 거짓으로 끝남).
- **Fix:** HUD 는 `minutes × 60 × 150` 칸을 잡고(5분 = 45,000칸, 180KB), 가득 차면 `truncated: true` 로 표시하며 끝낸다.
- **Files modified:** `src/debug/perf/hud.ts`
- **Committed in:** `6da89d4`

**3. [순서 조정] `autoDegrade: false` 를 Task 1 이 아니라 Task 2 에서 넣음**
- 플랜 분리 지점 1 은 Task 1 의 deps 에 `autoDegrade:false` 가 있다고 적었지만 옵션 자체가 Task 2 의 산출이라 Task 1 에서는 없는 prop 이 된다(typecheck 실패). Task 2 에서 옵션과 함께 perfScene 이 넘기도록 했다. 자동 강등은 그 전에는 없었으므로 Task 1 의 동작은 같다.

**4. [인터페이스 확장] 플랜에 없던 것**
- `scripts/perf-run.mjs` 에 `--budget`·`--seed`·`--shot`·`--file`(조명 대조 스크린샷을 같은 도구로 찍기 위해), `src/debug/perf/tags.ts`(perfScene·chatMock 이 이름표 마크업을 나눠 씀), `createWorldRuntime` 의 `onFrame` 훅(플랜 명시)과 `PlayableCharacter` 타입, `scenario.retarget`(사람이 누른 구간을 시나리오가 알도록, 자리마다 난수 흐름을 따로 둠).
- `test/unit/barScene.test.ts` 의 "시안 × π 시작값" 고정 테스트를 맞춘 값으로 바꿨다(그 테스트는 값을 고정하는 시험이라 조정되는 값이 바뀌면 함께 바뀐다). 장면 예산·점광원 개수 테스트는 그대로 통과.

---

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 2) + 순서 조정·인터페이스 확장
**Impact on plan:** 범위 확대 없음. 두 수정은 측정의 신뢰(5초 간격·5분 기록)를 지키기 위한 것.

## 명세와 다르게 단순화한 곳

- **탭 → 내 캐릭터 출발 500ms** (합격 기준 표): 스파이크는 서버가 없어 구간을 바로 넣으므로 "출발" 지연이 화면 쪽 비용으로만 남는다. 측정하는 것은 탭 → 링(pointerup 에서 링이 그려진 첫 rAF)뿐이고, 서버 왕복이 낀 출발 지연은 06-17·06-18 E2E 와 06-19 가 배포본에서 본다.
- **방 입장 → 맵 조작 가능 3초**: 스파이크는 방 입장이 없다. `performance.mark("map-interactive")` 시각(페이지 시작 기준)을 `interactiveMs` 로 적는다(LTE·Fast 4G 처음 방문은 06-19 가 배포본에서).
- **메모리 "맵 열고 닫기 5회"**: 이 계획의 자동 검사는 만들지 않았다(JS 힙 시작·1분마다·끝만 기록, iOS 는 하트비트로 갈음). 열고 닫기 반복 검사는 06-18 E2E(`__mfWorld.debug.info()`)의 몫이다.

## TDD 게이트 준수

- RED 커밋 2개(`9b20213`·`1608cab`) 모두 GREEN 앞에 있다. 계획 유형은 `execute`(task 단위 `tdd="true"`)라 게이트는 권고지만 지켰다. Task 3 은 `tdd` 가 아니다.
- **Task 1 RED:** 실패하는 18개는 모두 껍데기 구현에 대한 단언 실패(모듈 부재가 아님). 단 `gsd_run check tdd-red-evidence` 의 TAP 기록은 만들지 않았다(Task 2 에서 TAP 기록을 만들며 vitest 의 여러 줄 diff 가 TAP 파서를 깨뜨린다는 것을 알았고, 대상 테스트 하나만 `-t` 로 돌려 기록해야 한다).
- **Task 2 RED:** `-t "push 가 쌓이고"` 한 개로 만든 TAP 기록이 `RED_EVIDENCE_OK`(`target_test_failed`). 전체 30개 중 23개가 단언 실패, 7개는 껍데기가 이미 만족하는 회귀 고정용(꺼짐·변화 없음)이었다.
- 껍데기(스텁)는 RED 커밋에 함께 들어갔다(`test(...)` 커밋이 소스 파일을 포함하는 예외 — 06-13 Task 3 과 같은 방식).

## Issues Encountered

- 8명이 거의 늘 걷는다는 점(Deviation 1) 외에는 막힌 곳 없음. 사용자 결정 대기 중인 열린 발견(내 이름표 + 이모지 8개 ≈ 202px > `NAMETAG_MAX_W` 180)은 `camera.ts` 를 건드리지 않았다.
- **배포본에는 아직 `?perf=1` 이 없다.** 이 계획은 배포 권한이 없어 배포하지 않았다. 06-19 가 `perf-run.mjs --url https://minifia-v2.dhplay.workers.dev` 로 재려면 이 코드가 먼저 배포되어야 한다(또는 `vite preview` 로컬). 로컬 연기 실행은 `vite dev` 서버로 했다.
- 조명 대조는 map-bar.png(560×320, 사람 없는 전경)와 390×844 장면을 눈으로 비교했다. 화면설계서 보드(.dc.html)는 열지 않았다(가정 A2).

## Known Stubs

없음. 의도적 빈 값·가짜 데이터가 사용자 화면으로 흐르는 곳이 없다. `?perf=1`·`?chat-mock=1` 의 서 있는 8명·예시 메시지·닉네임은 디버그 화면 안에만 있고 제품 로비·런타임에는 들어가지 않는다(제품 로비는 `characterOf`·`playEmote` 를 부르지 않는다).

## Threat Flags

없음. 새 네트워크 표면 없음: 두 디버그 화면은 서버에 연결하지 않고(T-06-30), 결과는 결과 카드·로컬 JSON 으로만 남기며 수집 엔드포인트를 만들지 않았다(T-06-31), `perf-run.mjs` 는 `exitIfV1` 을 통과한 주소에만 연다(T-06-32), 패키지를 설치하지 않았다(T-06-SC). 닉네임·메시지는 `textContent` 로만 넣는다.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **06-15(로비 틀):** `WorldStage` 는 이제 `createWorldRuntime` 의 `autoDegrade` 기본 true 로 돌아간다(제품 자동 강등). 로비는 `characterOf`·시나리오·perf 모듈을 쓰지 않는다. main 청크에 three 없음을 계속 지켜야 한다(`vite build` 뒤 `index-*.js` 에 `WebGLRenderer` 가 없는지).
- **06-19(성능 판정):** `node scripts/perf-run.mjs --scene vote --minutes 5 --throttle 4 --dpr 1.5`(+ `--dpr 2`, talk) 로 B 조건, 실기기는 `?perf=1&scene=vote&minutes=5` 를 열어 결과 카드를 스크린샷. `heartbeat`·`frames.rafHz`(저전력 30Hz 의심)·`frames.thermalSuspect`·`truncated` 를 먼저 본다. 하단 채팅은 `?chat-mock=1` 을 iPhone Safari 에서 열어 위 확인표를 채운다. 조명 분위기(D8)는 사람이 `tune-after-*.png` 와 map-bar.png 를 나란히 본다.
- **07페이즈:** `chatMock.ts` 의 패널 치수·`visualViewport` 배치 계산(`bottom = innerHeight − (vv.height + vv.offsetTop)`)과 카메라 `stageRect` 연동이 입력 배치의 출발점이다. 지원 하한 방 높이는 7페이즈 UI-SPEC 이 다시 정한다.

## Self-Check: PASSED

- 파일: `src/debug/perfProbe.ts`·`perf/{perfScene,scenario,metrics,hud,tags}.ts`·`chatMock.ts`, `scripts/perf-run.mjs`, `test/unit/{perfMetrics,perfScenario}.test.ts`, `test/client/perfProbe.test.tsx`, `perf/tune-{before,after}-{talk,vote}.png`, `perf/desktop-{talk-dpr2-x1,vote-dpr1.5-x4}.json` 모두 존재.
- 커밋: 9b20213, b514583, 1608cab, 6da89d4, 68f954b 모두 HEAD 의 조상. `evaluation-scope --plan 06-14 --commits-only` 가 이 브랜치의 커밋을 확인.
- 인수 기준: Task 1·2·3 의 grep 기준 전부 성공, `test(06-14)` 커밋 2개, perf/ 에 tune 4장.
- 검증: `npx vitest run` 137 파일 통과(3,675 tests, 1 skipped), `npm run typecheck` 0, `vite build` 메인 청크 three-in-main 0, `node --check scripts/perf-run.mjs` 통과.

---
*Phase: 06-world-skeleton*
*Completed: 2026-10-31*
