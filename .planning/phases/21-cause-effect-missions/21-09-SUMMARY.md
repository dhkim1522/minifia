---
phase: 21-cause-effect-missions
plan: "09"
subsystem: client-night-house-ui
tags: [cause-effect, night, overview-camera, house-tag, pick, tdd]
status: complete

requires:
  - phase: 21-cause-effect-missions
    provides: "21-05 의 밤 집 앞 순간이동·pick 규칙, 21-07 의 lampView(houseLitOf)·밤 조명 통일·visibleSeats 밤 빈 표, 21-08 의 callTargetsOf houses 갈래·night.*.house 키"
provides:
  - "camera.ts: CameraView(iso|overview) 모드별 기저(CAMERA_RIGS), groundToScreen·screenRay·screenToGround·cameraBasis 의 view 인자, overviewFraming(배율·offsetY·zoom), houseTagCenters, NIGHT_PANEL_HEIGHT 88·HOUSE_TAG_* 상수"
  - "threeCamera.configureCamera(view)·WorldRenderer.setCameraView — 순수 수학과 three 카메라가 같은 리그 표를 쓴다"
  - "presence.cameraModeOf: 원인 흐름 마을 밤 = { mode: overview }(산 사람·유령 모두), 런타임 개관 전환(어둠 가림 절반 210ms 에 기저 교체, 모션 줄이기·재접속 즉시), window.__mfCamera { mode, scale }"
  - "src/game/houseView.ts houseTagsOf(view, local) — 문패 8개의 button·lit(houseLitOf)·picked·call 을 역할 없이 파생"
  - "src/components/v2/HouseTag.tsx(data-house-tag·data-lit·data-picked·data-call, aria-pressed, 접근성 이름 '{닉네임}의 집, 불 켜짐|불 꺼짐(, 고름)') + v2.css 문패 규칙 + game.css 문패 층"
  - "WorldStage houses 층(개관 뒤에만 보임·프레임마다 투영 위치 씀)·개관 전환 어둠 가림(mf-world__dim), GameMap 문패 누름 → pick { target }, GamePanel 원인 흐름 밤 얼굴 목록 없음, dayView.headerFor 원인 흐름 밤 힌트 없음"
affects: [21-10, 21-11, 21-13]

requirements-completed: [HOUSE-01, HOUSE-02]

estimate:
  tokens: 110000
  tasks: 3

actuals:
  tokens: 17300
  tasks: 3
  commits: 6

plan_head_before: 73faafbe4e26cb0c5d29465b2da9720d283ffd5b
plan_head_after: d39114c47ee6d1c7a42e826d958d90e0c85cac2b
commits: 6

tech-stack:
  added: []
  patterns:
    - "시점(기저)은 맵·단계 상수 표(CAMERA_RIGS)이고 배율은 zoom(= 배율 ÷ PX_PER_UNIT)으로만 건넨다 — 기존 setZoom 길을 그대로 쓰고 순수 수학·three 가 한 표를 읽는다"
    - "DOM 문패는 개관 투영 식(houseTagCenters)과 같은 식으로 런타임 프레임 콜백에서 위치만 쓰고, 렌더러가 개관 기저로 바뀐 뒤(onCamera)에야 보인다"
    - "역할을 읽지 않는 순수 파생(houseTagsOf)이 문패·빛남·고름을 정하고 네 역할의 DOM 구조 서명을 시험으로 대조한다"

key-files:
  created:
    - src/game/houseView.ts
    - src/components/v2/HouseTag.tsx
    - test/unit/houseView.test.ts
    - test/client/houseTag.test.tsx
    - test/client/nightHouse.test.tsx
  modified:
    - src/world/camera.ts
    - src/world/threeCamera.ts
    - src/world/threeRenderer.ts
    - src/world/renderer.ts
    - src/world/presence.ts
    - src/world/runtime.ts
    - src/world/testHooks.ts
    - src/components/WorldStage.tsx
    - src/screens/GameMap.tsx
    - src/screens/GamePanel.tsx
    - src/game/dayView.ts
    - src/styles/v2.css
    - src/styles/game.css
    - src/styles/world.css
    - test/unit/camera.test.ts
    - test/unit/cameraThree.test.ts
    - test/client/worldStage.test.tsx

key-decisions:
  - "개관 리그: 방위 0(정남에서 북을 봄)·수평 거리 3.5·높이 20.6 = 약 80° 로 내려 봄. 계산 시험이 첫 값에서 통과해 기울기(시점)는 고치지 않았다"
  - "문패 세로 기준은 바닥 가운데가 아니라 지붕 높이 면(HOUSE_TAG_Y 1.96)의 가운데를 스테이지 세로 가운데에 둔다 — 계산 시험에서 360×560 띠 한 줄의 윗줄 문패(좌석 0·1)가 안쪽 8 inset 에 1px 닿지 못해 알았고, 배율이 아니라 세로 오프셋을 고쳤다"
  - "독 줄 밖 판정은 가로로 한다: 스테이지 위 끝이 띠 아랫변(B)이라 문패 윗줄이 세로로 독 줄(B~B+52) 안에 들 수밖에 없고, 독 줄에 놓이는 소리 단추(지름 52·오른쪽 16)와 문패 누르기 44 가 겹치지 않음을 검사한다"
  - "개관 전환 가림은 --scrim 0 → 1 → 0 의 CSS 애니메이션 한 번(--dur-med 420ms)이고 런타임이 절반(210ms)에 기저를 바꾼다 — 개관에서 돌아올 때(아침)도 같은 가림을 쓴다"
  - "이미 고른 집을 다시 눌러도 pick 을 보내지 않는다(FaceList·지목 이름표와 같은 규칙), 다른 집을 누르면 마지막 선택이 이긴다(서버 night.ts)"

metrics:
  duration: 약 25분
  completed: 2026-11-15
---

# Phase 21 Plan 09: 밤 집 찾기 화면 Summary

확장판 밤이 모든 역할에게 같은 고정 개관 시점(방위 고정·약 80° 위에서 본 마을 전체)이 되고, 집 지붕 위에 뜬 DOM 문패 단추(얼굴 32 + 자리색 테두리, 창 점, 고른 집의 금빛 테두리·check 배지)를 눌러 `pick { target }` 을 보낸다. 마피아·경찰·의사·시민의 문패 단추 수·속성·아래 패널 구조가 같고 FaceList·조준·눈/치료 아이콘·헤더 힌트는 원인 흐름 밤에서 사라졌다. 기본 마피아 밤은 그대로다.

## Accomplishments

- **Task 1 (개관 카메라):** `camera.ts` 가 시점별 기저(경사 `iso` 는 값 그대로, 새 `overview`)를 갖고 `overviewFraming(stage, canvas)` 가 배율 = `min(폭 − 16, 스테이지 높이 − 16) ÷ 19.2` 를 정한다. three 카메라·렌더러가 같은 `CAMERA_RIGS` 표로 서고 `cameraModeOf` 가 원인 흐름 마을 밤에 `overview` 를 돌려준다. 런타임은 어둠 가림의 한가운데(210ms)에 기저를 바꾸고(모션 줄이기·재접속은 즉시), 개관 동안 매 프레임 스테이지 사각형에서 배율·세로 위치를 다시 정한다. `window.__mfCamera` 가 mode·배율을 싣는다.
- **Task 2 (문패 파생·부품):** `houseTagsOf` 는 8개 문패마다 단추(산 사람의 집 + 내가 산 사람, 내 집 포함)·창 점(`houseLitOf` 와 같은 값)·고름(`local.pick ?? me.pick`)·빛남(안 골랐을 때 단추 전부)을 역할 없이 계산한다. `HouseTag` 는 단추/단추 아닌 문패(유령 화면·탈락자·주인 없음, `pointer-events: none`·흐림)를 같은 마크업 규칙으로 그린다.
- **Task 3 (연결):** `WorldStage` 의 문패 층이 개관 투영 위치를 프레임마다 DOM 에 쓰고(렌더러가 개관으로 바뀐 뒤에만 보임) 개관 전환 어둠 가림을 한 번 지나가게 한다. `GameMap` 이 문패 목록·누름 → `pick` 전송(알림·토스트·소리 없음)을 잇고, `GamePanel` 은 원인 흐름 밤에 얼굴 목록 없이 행 하나(쪽지·유언)만 둬 모든 역할의 패널 높이가 같다. `headerFor` 는 원인 흐름 밤에 제목만 돌려준다.

## 개관 배율·문패 간격 표 (함정 9, 계산 시험 출력)

스테이지 사각형 = 위 B(띠 한 줄 123 / 두 줄 144) ~ 화면 높이 − 밤 고정 패널 88. 모든 조합에서 문패 8개가 안쪽 8 inset·소리 단추 밖이고 인접쌍(0·7, 1·2, 3·4, 5·6) 최소 거리 = 전체 쌍 최소 거리다(≥ 44).

| 폰 | 띠 | 배율 px/단위 | 최소 문패 간격 px |
|----|----|--------------|-------------------|
| 360×640 | 한 줄 / 두 줄 | 17.92 / 17.92 | 85.5 / 85.5 |
| 390×664 | 한 줄 / 두 줄 | 19.48 / 19.48 | 93.0 / 93.0 |
| 430×932 | 한 줄 / 두 줄 | 21.56 / 21.56 | 102.9 / 102.9 |
| 360×560 | 한 줄 / 두 줄 | 17.34 / 16.25 | 82.8 / 77.6 |
| 390×844 | 한 줄 / 두 줄 | 19.48 / 19.48 | 93.0 / 93.0 |
| 402×874 | 한 줄 / 두 줄 | 20.10 / 20.10 | 95.9 / 95.9 |

UI-SPEC 의 예상(360×560 한 줄 약 17.3·83, 두 줄 약 78)과 일치한다.

## TDD 증거 (RED 3줄)

- Task 1: `test(21-09)` `9cb946f4` — `--reporter=tap-flat` **not ok 43**(overviewFraming·houseTagCenters·overview 기저 없음), 기존 ok 117 은 그대로.
- Task 2: `test(21-09)` `cdc610fe` — **not ok 2**(houseView.test·houseTag.test 두 파일 모두 import 실패: houseView.ts·HouseTag.tsx 없음).
- Task 3: `test(21-09)` `680d0bff` — **not ok 13 / ok 2**(ok 2 는 이미 통과해야 하는 보존 시험: 기본판 밤 그대로·마피아 [쪽지]/그 밖 [유언] 줄).

## Task Commits

1. Task 1 RED `9cb946f4` test(21-09): 개관 카메라 계산 실패 시험
2. Task 1 GREEN `645a3362` feat(21-09): 밤 개관 카메라
3. Task 2 RED `cdc610fe` test(21-09): 집 문패 실패 시험
4. Task 2 GREEN `47e17d00` feat(21-09): 집 문패 부품
5. Task 3 RED `680d0bff` test(21-09): 밤 집 찾기 화면 실패 시험
6. Task 3 GREEN `d39114c4` feat(21-09): 밤 집 찾기 화면

## Deviations from Plan

### 계획 해석·재량 (Rule 번호 없음, 결정으로 기록)

**1. 독 줄 밖 = 가로 검사.** 계획 문구는 "독 줄(띠 아래 + 52) 밖" 이지만 스테이지 위 끝이 띠 아랫변(B)이고 윗줄 집(좌석 0·1)의 문패는 B 에서 약 28~32px 라 세로로는 독 줄(B~B+52)을 벗어날 수 없다(배율 17.3 은 UI-SPEC 이 정한 값). 독 줄에 실제로 놓이는 것은 오른쪽 끝 소리 단추(지름 52·오른쪽 16)라, 그 사각형과 문패 누르기 44 가 겹치지 않음을 시험(camera.test)으로 고정했다. 문패 윗줄은 소리 단추의 왼쪽에 있다(폰 6종 × 띠 두 가지 모두 통과). 독 줄에 단추가 더 붙는 단계는 이 시험 밖이다.

**2. [Rule 1 - 계산 시험이 잡은 어긋남] 문패 세로 기준.** 첫 구현은 마을 가운데 바닥 점을 스테이지 세로 가운데에 뒀는데 360×560 띠 한 줄에서 좌석 0·1 문패가 안쪽 8 inset 에 닿지 못했다(지붕 높이 1.96 만큼 문패가 위로 떠 보여 윗줄만 위쪽에 닿음). 계획 "어긋나면 배율이 아니라 시점을 고친다" 에 따라 배율은 그대로 두고 `overviewFraming` 이 지붕 높이 면의 가운데를 스테이지 세로 가운데에 놓도록 offsetY 를 고쳤다. 기울기(리그 3.5 / 20.6)는 처음 값 그대로 통과했다. 바닥(3D 마을)은 이 보정으로 약 4px 아래로 간다.
- **Files modified:** src/world/camera.ts · **Commit:** `645a3362`

### 계획에 없던 추가

**3. [Rule 3 - 막는 것 해소] `WorldRenderer.setCameraView`·`CameraView` 타입.** 기저를 바꾸는 길이 렌더러 인터페이스에 없어 optional 메서드로 더했다(다른 optional 메서드와 같은 시험 가짜 렌더러 호환 규칙). 개관 전환의 어둠 가림 길이(`--dur-med` 420ms)와 런타임 절반 시각(210ms)은 한 값에서 나온 두 곳이라 주석으로 서로를 가리킨다.

**4. 시험 보강(files_modified 밖).** `test/client/worldStage.test.tsx` 에 개관 전환(210ms 절반 교체·돌아올 때 iso·모션 줄이기 즉시)·문패 층 준비 전/후 위치·어둠 가림 생김/안 생김 시험 네 건과 가짜 렌더러의 `setCameraView` 를 더했다(런타임 쪽 논리가 계획 시험 다섯에는 없어서).

**5. nightHouse 구조 서명은 읽어 주기 전용 글(`mf-sr-only`)을 뺀다.** 마피아 [쪽지] 아래 안내("암살 대상을 모두 같게 고르면 쓸 수 있어요")는 화면 자리가 없는 sr-only 글이라 패널 높이와 무관하고 본인(마피아) 기기에만 있다. 패널 구조·문패 속성은 네 역할이 같다는 시험은 그대로이다.

**Total deviations:** 5 (해석 1, 계산 시험이 잡은 보정 1, 필요한 추가 3). **Impact:** 와이어·서버 규칙 변화 없음, 계획의 성공 기준 모두 충족.

## 검증 결과

- `npm run typecheck`(tokens:check·placeart:check·wrangler types·tsc 앱·worker) 통과(`error TS` 0).
- `npx vitest run test/client test/unit` — **246 files passed | 1 skipped, 8245 tests passed | 184 skipped**.
- Task 3 verify 묶음(nightHouse·houseTag·nightMap·gameMap·phaseScreens·dayView·worldStage) 7 files / 658 passed.
- `npx vitest run test/worker/causeLeak.test.ts` 6 passed — 와이어 형식은 바뀌지 않아 `ALLOWED_NEW`/`SERVER_ONLY_NAMES` 는 그대로다. worker 전체(`--project worker`)는 알려진 간헐 5000ms 타임아웃(night.test·errandLeak) 때문에 돌리지 않았다(이 계획은 클라이언트 전용 변경).
- acceptance: `overview` camera.ts 9·presence.ts 4·camera.test.ts 12 (≥2), `HouseTag` WorldStage+GameMap 4 (≥2), `houseTagsOf` GameMap 3 + WorldStage 1 (≥1), `.role` 읽기 0, `data-house-tag` HouseTag.tsx 2, nightHouse.test.tsx 있음.
- 위생: 바뀐 파일 diff 에 hex 리터럴·innerHTML·'참가자' 없음, CSS 는 토큰 변수만(houseTag.test 가 대조), LF 유지.

## Known Stubs

없음.

## Threat Flags

없음 — 새 엔드포인트·메시지·서버 상태 없음(기존 `pick` 그대로). 위협 대응: T-21-31(houseTagsOf·HouseTag 소스에 `.role` 0, 네 역할 DOM 서명 동일), T-21-32(고름은 서버가 본인에게만 보낸 me.pick·내 즉시 선택만), T-21-33(닉네임은 aria-label 속성 문자열, innerHTML 없음 — 악성 문자열 시험), T-21-34(밤 visibleSeats 빈 표 그대로 — 개관 시점에 몸·이름표 없음, cameraModeOf 시험이 확인).

## 알려진 한계·넘기는 것

- 개관 시점의 실제 모양(3D 마을이 폰에서 어떻게 보이는지·바닥 4px 이동·지붕에 가린 집 창)은 시험 환경(가짜 렌더러)이 아니라 눈으로 봐야 한다 — v3.0 실테스트 눈 확인 항목.
- 문패 위치는 `houseTagCenters`(순수 식)로 쓰고 렌더러의 `project` 를 쓰지 않는다. 두 식이 같다는 증명은 cameraThree.test(1px)이다.
- E2E(`?e2e=1`) 표식 `data-house-tag`·`__mfCamera` 는 생겼으나 E2E 흐름 쪽 소비는 이 계획 범위 밖(21-13).

## Self-Check: PASSED

- 생성 파일 있음: src/game/houseView.ts, src/components/v2/HouseTag.tsx, test/unit/houseView.test.ts, test/client/houseTag.test.tsx, test/client/nightHouse.test.tsx
- 커밋 6개 모두 HEAD 의 조상(`9cb946f4`·`645a3362`·`cdc610fe`·`47e17d00`·`680d0bff`·`d39114c4`)
