---
phase: 06-world-skeleton
plan: 15
subsystem: ui
tags: [react, lobby, worldstage, topToast, reconnect-banner, worldstore, tdd, client-tests]

requires:
  - phase: 06-world-skeleton
    provides: "06-13 WorldStage·runtime, 06-12 PhaseHeader·TopToast·DotProgress·ActionButton, 06-09 WorldStore·onEvent(world, epoch), 06-06 NETWORK 문구, 06-07 v2 첫 배포 표식"
provides:
  - "Lobby: WorldStage 위에 승인 로비 틀(위쪽 가림막·헤더 [나가기]/대기실/[공유]·TopToast·아래 패널 행동 줄)을 얹은 main.mf-lobby"
  - "RoomScreen: 연결과 같은 수명의 WorldStore 소유, 연결 훅 직후 world 프레임 구독, 로비 나가기 420ms 가림막"
  - "ReconnectBanner floating 속성 — 로비에서 맵 크기를 바꾸지 않고 헤더 아래 top 72 에 얹힘"
  - "test/helpers/fakeWorldStage.ts — 로비를 거치는 client 테스트의 가짜 WorldStage"
affects: [06-17-e2e, 06-18-deploy-e2e, 06-19, 06-21-lobby-copy, 07-chat-layout, 10-outfit]

actuals:
  tokens: 25500
  tasks: 3
  commits: 4
plan_head_before: aa691f3289ce5dbc3ba3a7d4f55b16e1e07b702f
plan_head_after: 4159296679e1889ec3a2403fc2b8dcbee45661c8

tech-stack:
  added: []
  patterns:
    - "WorldStage 가짜는 vi.mock 안에서 await import 로 가져온다(vi.mock 호이스팅 때문에 정적 import 를 factory 가 못 쓴다) — 공용 도우미 test/helpers/fakeWorldStage.ts"
    - "로비 알림 기준선 규칙: 첫 view·epoch 변경·재접속 띠(bannerVisible) 동안은 알림을 띄우지 않되 기준선은 계속 갱신"
    - "단계 전환 가림막은 RoomScreen 이 렌더 중 상태 보정(setState during render)으로 마지막 로비 view 를 쥐어, Lobby·맵이 다시 마운트되지 않는다"

key-files:
  created:
    - test/helpers/fakeWorldStage.ts
  modified:
    - src/screens/Lobby.tsx
    - src/screens/RoomScreen.tsx
    - src/components/ReconnectBanner.tsx
    - src/components/ActionButton.tsx
    - src/components/v2/PhaseHeader.tsx
    - src/components/WorldStage.tsx
    - src/components/TestTools.tsx
    - src/world/runtime.ts
    - src/styles/lobby.css
    - src/styles/room.css
    - src/styles/daytable.css
    - test/client/lobby.test.tsx
    - test/client/roomScreen.test.tsx
    - test/client/characterAudit.test.tsx
    - test/client/stageBox.test.tsx
    - test/client/guide.test.tsx
    - test/client/testTools.test.tsx
    - test/client/testToolsCompact.test.tsx
    - test/client/phaseScreens.test.tsx
    - test/client/useRoomConnection.test.tsx
  deleted:
    - src/net/useSeatTransitions.ts

key-decisions:
  - "안전 영역(env)을 로비에서 다시 더하지 않는다: #root 패딩과 .mf-room 높이가 이미 노치·홈 표시줄을 비켜 있어 plan 의 max(18px, env) / 22px+env 를 그대로 쓰면 두 번 계산된다. 헤더 위 18·패널 아래 22 로 두고 stageInsets 는 Lobby 가 재서 넘긴다"
  - "맵을 불러오는 동안에도 헤더가 보이고 눌리도록 .mf-lobby > .mf-world 에 자기 쌓임 맥락(z-world)을 준다 — 맵 안 가림막(z-modal)이 헤더(z-toast)를 덮지 않는다"
  - "[시작] 잠금(2초)·연결 안 됨·인원 모자람은 모두 inactive 모양이고, 모자람일 때만 '4명부터 시작해요' 알림을 낸다. 내가 누른 일의 답(나가기 실패 문구)은 재접속 띠 억제를 받지 않는다"
  - "PhaseHeader 에 guide 속성을 더해 안내 줄에 data-guide 를 둔다(화면당 안내 하나, UX-01 계약)"
  - "TestToolsButton 의 좁힘(compact)은 낮 테이블 장면에만 적용한다 — 맵 로비의 [테스트] 자리는 캐릭터 상자와 겹치지 않아 항상 누르기 영역 44 이상"
  - "EXIT_CURTAIN_MS(420)를 runtime.ts 한 곳에 두고 WorldStage 가림막과 RoomScreen 전환 지연이 같이 쓴다"

patterns-established:
  - "로비 DOM·CSS 계약: main.mf-lobby, .mf-lobby__header, .mf-lobby__panel[data-world-panel], .mf-lobby__test, [data-lobby-start], .mf-reconnect--floating, 안내 한 줄 .mv-phase__hint[data-guide]"

requirements-completed: [MAP-01, MAP-05, CONN-04]

coverage:
  - id: D1
    description: "대기실이 맵 위 승인 틀로 바뀜: 헤더([나가기]·대기실·[공유], 방 코드 없음), 접히는 안내 한 줄(맵 열린 뒤 2.5초), 아래 패널 행동 줄([시작]+점/손님 대기), 위쪽 가림막, [테스트] 자리"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "test/client/lobby.test.tsx#Lobby — 맵 로비 틀 (MAP-01, 06-15)"
        status: pass
      - kind: unit
        ref: "test/client/lobby.test.tsx#Lobby — 행동 줄: [시작] 과 점, 손님 (ROOM-03, UI-SPEC 행동 줄)"
        status: pass
      - kind: unit
        ref: "test/client/lobby.test.tsx#Lobby — 스타일 계약 (lobby.css)"
        status: pass
    human_judgment: true
    rationale: "승인 보드와 같은 첫인상·조작감은 폰 화면을 보고 판단한다(Task 3 human-check, 종료 시점 UAT 로 모음)"
  - id: D2
    description: "RoomScreen 이 WorldStore 를 연결 수명으로 소유하고 연결 훅 직후 world 프레임만 구독해 첫 snap 이 Lobby 에 넘긴 스토어에 들어감(world 외 프레임은 무시, 언마운트 시 구독 해제)"
    requirement: MAP-05
    verification:
      - kind: unit
        ref: "test/client/roomScreen.test.tsx#RoomScreen: 맵 로비 연결 (MAP-01, MAP-05, CONN-04, 06-15)"
        status: pass
    human_judgment: false
  - id: D3
    description: "로비 → 다른 단계: 420ms 동안 마지막 로비 view 로 Lobby 가 exiting 에 남은 뒤 v1.0 Assigning, 모션 줄이기면 바로, 대기실 복귀 시 맵 재생성, 로비 밖 전환에는 가림막 없음"
    requirement: MAP-05
    verification:
      - kind: unit
        ref: "test/client/roomScreen.test.tsx#로비 → assigning: 420ms 동안 마지막 로비 view 로 Lobby 가 나가는 가림막(exiting)에 남고, 그 뒤 Assigning 이 나온다"
        status: pass
    human_judgment: true
    rationale: "420ms 가림막의 보이는 모양과 WebGL 해제 뒤 Assigning 으로의 이음새는 실기기에서 본다(06-17·06-18 E2E)"
  - id: D4
    description: "재접속 띠가 로비에서 floating(top 72, 흐름을 밀지 않음), 다른 단계는 기존 흐름 안, 띠 동안 입장·방장 알림 억제(기준선은 갱신), 첫 view·epoch 변경 직후 알림 없음"
    requirement: CONN-04
    verification:
      - kind: unit
        ref: "test/client/roomScreen.test.tsx#로비의 재접속 띠는 떠 있는 변형이다(.mf-reconnect--floating)"
        status: pass
      - kind: unit
        ref: "test/client/useRoomConnection.test.tsx#재접속 띠가 떠 있는 동안(restored 2초)에는 알림이 없고, 띠가 사라진 뒤의 변화부터 다시 알린다 (CONN-04)"
        status: pass
      - kind: unit
        ref: "test/client/lobby.test.tsx#Lobby — 알림은 TopToast 하나 (D-10, CONN-04 WR-03)"
        status: pass
    human_judgment: false
  - id: D5
    description: "v1.0 로비만 검사하던 client 테스트 정리와 웨이브 5 게이트: 전체 client 1676 통과, skip·todo 없음, typecheck 통과"
    verification:
      - kind: other
        ref: "npx vitest run --project client && npm run typecheck && git grep -F -e '.skip(' -e '.todo(' -- test/client (rc 1)"
        status: pass
    human_judgment: false
  - id: D6
    description: "빌드 메인 청크(index-*.js)에 three(WebGLRenderer) 없음 — threeRenderer·three.core 는 지연 청크"
    verification:
      - kind: other
        ref: "npx vite build + node 검사 → three-in-main 0"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-11-01
status: complete
---

# Phase 6 Plan 15: 맵 로비 교체 Summary

**대기실을 지하 재즈 바 맵(WorldStage) 위의 승인 로비 틀(헤더·TopToast·행동 줄)로 바꾸고, RoomScreen 이 WorldStore 를 연결 수명으로 소유·구독하며 재접속 띠를 맵 위에 띄우고, 깨진 v1.0 로비 client 테스트를 skip 없이 정리했다.**

## Performance

- **Duration:** 약 20분
- **Started:** 2026-11-01T00:03Z 무렵 (시작 시각을 기록하지 못해 로그로 추정)
- **Completed:** 2026-11-01T00:25Z 무렵
- **Tasks:** 3
- **Files modified:** 22 (생성 1, 삭제 1 포함)

## Accomplishments

- **새 Lobby**: 루트 `main.mf-lobby` 안에 WorldStage(자기 쌓임 맥락)·위쪽 가림막(night-900 88%→60%@70px→0@120px)·헤더(`[나가기]` 44×44 / PhaseHeader "대기실" / `[공유]` 44×44)·TopToast·`.mf-lobby__test`·아래 패널(`data-world-panel`, night-800 97%, 14 16 22)을 얹었다. 방 코드는 공유 시트 안에서만 보인다. 안내 "바닥을 눌러 걸어요" 는 `onReady` 뒤 2.5초만 보이고 접힌다(`[data-guide]` 하나).
- **행동 줄**: 방장은 연결된 사람 ≥ 4 면 `[시작]`(play + 점 n/8, `aria-label` "게임 시작, n명 모임"), 모자라면 흐린 inactive(`aria-disabled`)이고 누르면 "4명부터 시작해요" 한 번, 누른 뒤 2초 잠금. 손님은 평평한 비활성 "방장을 기다리는 중…". 8명이면 점 8개 모두 켜짐.
- **RoomScreen**: `new WorldStore()` 를 연결 훅 바로 뒤에서 만들고 `onEvent` 로 world 프레임만 `applyFrame(e, meta.epoch)`. 로비 → 다른 단계에서 마지막 로비 view 로 `Lobby exiting` 을 420ms 더 그린 뒤 v1.0 단계로 넘어간다(모션 줄이기면 바로). `ReconnectBanner floating={로비}`, `bannerVisible` 로 로비 알림 억제.
- **재접속 띠**: 로비에서는 `.mf-reconnect--floating`(top 72, 가로 전체, z-overlay) — 캔버스 크기가 바뀌지 않는다. 다른 단계는 기존 흐름 안(클래스 문자열까지 같음).
- **테스트 정리**: 아래 표 참고. 전체 client 56 파일 1676 테스트 통과, 전체 `vitest run` 137 파일 3675 통과.

### 지운 테스트 → 대신하는 테스트

| 지운/바꾼 테스트 (파일 > 이름) | 대신하는 테스트 (파일 > 이름) |
|---|---|
| characterAudit > CHAR-01: 대기실 — 5명·8명 모두 닉네임과 서로 다른 인물 (2건) | worldStage.test > 이름표 층 (MAP-01, MAP-07); character.test > figForSeat 분배. 8명에게 5명의 인물을 나눠 쓰는 것이 06-11 결정이라 '자리마다 서로 다른 인물' 은 더 성립하지 않는다 |
| stageBox > 대기실 시트 height calc(157px + 안전 영역) | lobby.test > 스타일 계약: 아래 패널 안쪽 여백 14 16 22·간격 10 → 높이 88 |
| stageBox > 세 패널 같은 면·모서리 + 대기실 손잡이 막대 없음 (세 패널 → 두 패널) | lobby.test > 스타일 계약: 아래 패널 night-800 97%·위 모서리 radius-lg |
| stageBox > 대기실 시트 안쪽 여백이 낮 패널과 같다 | lobby.test > 스타일 계약: 아래 패널 안쪽 여백 |
| stageBox > 대기실 바와 배정 바 119.2 (→ 배정 바만) | lobby.test > 스타일 계약: 헤더 위 18·높이 62·맵 탭 통과 |
| stageBox > 대기실 장면 상자 flex 1·padding 0 12px / 0 4px | 장면 상자 자체가 없다(맵이 본문을 채움) — lobby.test > 구조: main.mf-lobby 안 WorldStage·헤더·패널 |
| stageBox > 대기실 배경 flex 1 1 0·height auto / 세 화면 100dvh 없음 (→ 두 화면) | lobby.test > 구조: `.mf-backdrop` 없음 |
| testTools > 버튼은 .mf-lobby__scene 안 .mf-tt-anchor 에 있다 | testTools > 버튼은 맵 로비의 [테스트] 자리(.mf-lobby__test) 안에 있다 |
| testToolsCompact > mf-lobby__scene 행 (3건) | mf-dayscene__scene 행으로 좁힘 + 새 it '맵 로비의 [테스트] 자리에서는 붙지 않는다' |
| guide > lobby 안내 요소 `.mf-lobby__guide` | guide > lobby 방장·손님: `[data-guide]` 는 헤더 안내 한 줄 `.mv-phase__hint` |
| lobby.test 옛 DayTable 로비 전체(테이블·8명 기하·시트 인원 글자·좌석 전이·옛 토스트) | lobby.test 새 계약(구조·헤더·행동 줄·TopToast 알림·나가기·공유·내보내기·스타일), worldStage.test(이름표·등장/퇴장 연출) |

로비가 아닌 단계의 기대값은 하나도 바꾸지 않았다. 건너뛰기·할 일 표시는 쓰지 않았다.

## Task Commits

1. **Task 1 (tracer, TDD)** — RED: `699339d` (test) → GREEN: `8402862` (feat)
2. **Task 2** — `a372a58` (test)
3. **Task 3** — `4159296` (test)

**Plan metadata:** 이 SUMMARY 와 STATE·ROADMAP·REQUIREMENTS 를 담은 `docs(06-15)` 커밋.

## TDD 기록 (Task 1)

- **RED**: 새 lobby.test.tsx(WorldStage 가짜)·roomScreen.test.tsx 신규 케이스를 먼저 커밋. 구현 전 실행에서 51건 실패·34건 통과이고 실패는 모두 계획한 단언(`store` 없음 → WorldStage 가짜가 그려지지 않음, 방 코드·옛 테이블 존재, TopToast 알림 없음, `EXIT_CURTAIN_MS` 없음, floating 클래스 없음 등)이었다. import·문법·fixture 오류는 없었다. 이 계획은 `type: execute` 라 `check tdd-red-evidence` 분류기는 쓰지 않았고 실패 목록을 직접 읽어 확인했다.
- **GREEN**: Lobby·RoomScreen·ReconnectBanner 구현 후 두 파일 85/85 통과.
- **tracer 게이트**: `HUMAN_VERIFY_MODE=end-of-phase` + 자동 검증만 있는 verify → 다시 돌려 통과, 확장(Task 2·3)으로 진행.

## Files Created/Modified

위 frontmatter 의 key-files 와 같다. 핵심은 `src/screens/Lobby.tsx`(재작성), `src/screens/RoomScreen.tsx`(스토어·가림막·띠), `src/styles/lobby.css`(재작성), `test/client/lobby.test.tsx`(재작성).

## Decisions Made

- 안전 영역을 로비에서 다시 더하지 않음(아래 이탈 1).
- 맵 안 가림막이 헤더를 덮지 않도록 `.mf-world` 에 쌓임 맥락을 줌.
- 내가 누른 일의 답(나가기 실패 문구)은 재접속 띠 억제 대상이 아님. 억제는 서버 view 차이에서 온 입장·방장 알림에만 건다.
- compact(좁힘)는 낮 테이블 장면에만 적용.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 안전 영역 이중 계산 방지**
- **Found during:** Task 1 (CSS 작성)
- **Issue:** plan 은 헤더 위 `max(18px, env(safe-area-inset-top))`, 패널 아래 `22px + env(safe-area-inset-bottom)` 를 지시한다. 그런데 `#root` 가 이미 `env()` 패딩을 갖고 `.mf-room` 높이도 `100dvh − 안전 영역` 이라 로비는 안전 영역 안에서 시작한다. 그대로 쓰면 노치 폰에서 헤더가 약 59px 더 내려가고 패널이 불필요하게 커진다(A2 가정은 앱 틀이 이미 비킨다는 사실을 몰랐다).
- **Fix:** 헤더 위 18, 패널 아래 22 로 고정. 스테이지 사각형은 Lobby 가 재서 넘기므로 카메라 구도는 맞는다.
- **Files modified:** src/styles/lobby.css
- **Verification:** lobby.test 스타일 계약(헤더 62·패널 14 16 22)
- **Committed in:** 8402862

**2. [Rule 3 - Blocking] PhaseHeader `guide`·ActionButton `data` 속성 추가**
- **Found during:** Task 1
- **Issue:** `[data-guide]`(UX-01 화면당 하나)와 `[data-lobby-start]`(E2E 계약)를 06-12 부품이 내보낼 방법이 없었다.
- **Fix:** `PhaseHeader guide?: boolean`, `ActionButton data?: Record<data-*, string>` 선택 속성만 더함(기존 사용처 불변).
- **Files modified:** src/components/v2/PhaseHeader.tsx, src/components/ActionButton.tsx
- **Verification:** lobby.test·guide.test·v2parts.test 통과
- **Committed in:** 8402862

**3. [Rule 3 - Blocking] `EXIT_CURTAIN_MS` 를 runtime.ts 로 옮겨 공유**
- **Found during:** Task 1
- **Issue:** 420ms 가 WorldStage 안 지역 상수였고 RoomScreen 이 같은 값을 써야 한다. RoomScreen 이 WorldStage 에서 가져오면 WorldStage 를 가짜로 바꾸는 테스트가 export 를 잃는다.
- **Fix:** `src/world/runtime.ts` 에 `export const EXIT_CURTAIN_MS = 420` 하나, WorldStage 와 RoomScreen 이 import.
- **Files modified:** src/world/runtime.ts, src/components/WorldStage.tsx, src/screens/RoomScreen.tsx
- **Committed in:** 8402862

**4. [Rule 3 - Blocking] `.mf-room { position: relative }`**
- **Found during:** Task 1
- **Issue:** 떠 있는 재접속 띠(absolute)는 RoomScreen 루트에 형제로 붙는데 `.mf-room` 이 위치 기준이 아니라 뷰포트 기준으로 얹힐 뻔했다.
- **Fix:** room.css 의 `.mf-room` 에 `position: relative` 한 줄.
- **Files modified:** src/styles/room.css
- **Committed in:** 8402862

**5. [Rule 3 - Blocking] 대체된 v1.0 코드 정리**
- **Found during:** Task 1·2
- **Issue:** ROADMAP 공통 조건(대체한 v1.0 코드는 같은 페이즈에서 지운다). `useSeatTransitions` 는 옛 Lobby 만 쓰던 훅이고, `TestToolsButton` 의 `.mf-lobby__scene` 선택자는 사라진 DOM 을 가리켰다.
- **Fix:** `src/net/useSeatTransitions.ts` 삭제(쓰는 곳·전용 테스트 없음 확인), daytable.css 주석 정리, TestTools 선택자에서 `.mf-lobby__scene` 제거.
- **Files modified:** src/net/useSeatTransitions.ts(삭제), src/styles/daytable.css, src/components/TestTools.tsx
- **Committed in:** 8402862, a372a58

**6. [Rule 3 - Blocking] 기존 roomScreen.test 의 `role="status"` 질의 3건 교체**
- **Found during:** Task 1
- **Issue:** TopToast 는 비어 있어도 `role="status"` 영역을 항상 그린다(06-12 설계). 로비에서 `getByRole("status")` 가 재접속 띠와 알림을 모두 잡아 여러 개로 깨졌다.
- **Fix:** 재접속 띠 질의를 `.mf-reconnect` 선택자로 바꿨다(띠 기대값 자체는 그대로).
- **Files modified:** test/client/roomScreen.test.tsx
- **Committed in:** 8402862

### plan 이 지목하지 않았으나 같은 규칙으로 고친 파일

plan Task 3 의 네 파일 밖에서 깨진 client 테스트는 없었다. 다만 phaseScreens(대기실 연결 describe)·useRoomConnection 의 로비 질의와 testToolsCompact 는 plan 이 지목한 대로 고쳤고, app.test.tsx·phaseArrival.test.tsx 는 로비를 실제로 그리지 않아 수정이 필요 없었다.

---

**Total deviations:** 6 auto-fixed (1 bug, 5 blocking)
**Impact on plan:** 모두 plan 의 truths 를 충족하거나 ROADMAP 공통 조건을 지키는 데 필요한 최소 변경이다. 새 의존성·구조 변경 없음.

## Issues Encountered

- 열린 항목(건드리지 않음): 사용자 본인 NameTag 이모지 8개가 약 202px 로 `NAMETAG_MAX_W` 180 보다 넓다. 지시대로 camera.ts 는 바꾸지 않았다.
- 전체 `vitest run` 의 "1 skipped" 는 이 계획 이전부터 있던 `test/unit/camera.test.ts` 의 `describe.runIf(CAMERA_PRINT === "1")`(환경 변수 게이트)다. `test/client` 에는 skip·todo 가 없다(`git grep` rc 1).

## Known Stubs

없음. 새 하드코딩 빈 값·자리표시 문구 없음.

## Threat Flags

없음. 새 네트워크 엔드포인트·인증 경로·스키마 변경 없음. T-06-33(시작·내보내기 표시는 표시일 뿐, 판정은 서버)은 그대로이고 내보내기 이름표는 WorldStage 가 방장 화면에서만 버튼으로 만든다. T-06-SC: 패키지 설치 없음.

## Deferred (이 계획 범위 밖)

- `scripts/e2e/flows.mjs:232`(`.mf-lobby__count`)·`scripts/e2e/browser.mjs:428`(`.mf-lobby__code`)는 옛 로비 DOM 을 가리킨다 — E2E 계약 갱신은 06-17·06-18 몫.
- DayTable 의 `slide`·`hostCrown`·`transition` 입장/퇴장 처리와 해당 CSS 는 이제 로비에서 쓰이지 않는다(dayTable.test 가 컴포넌트 자체로 검사 중). 사용처가 없는지 확인한 뒤 페이즈 끝 정리에서 지울 것.
- 노치 폰에서 캔버스가 안전 영역 밖(앱 틀 패딩 구간)까지 번지지 않는다 — UI-SPEC 의 '화면 전체 캔버스' 와 다르다. 실기기 확인(06-18) 후 필요하면 앱 틀 변경으로 따로 다룬다.
- 로비 알림 문구(v2 말투)·방장 왕관·입장 화면 월드 청크 미리 받기·`room-enter` 표식은 06-21.

## 사람이 확인할 것 (Task 3 human-check, end-of-phase 모음)

`npm run dev` 로 390×844 에서 방을 만들고 테스트 방이면 봇을 늘려 맵 로비를 본다. 기대: 헤더(나가기·대기실·공유), 맵 위 캐릭터·이름표, 아래 `[시작]`+점, 바닥을 누르면 링과 함께 내 캐릭터가 가구를 돌아 걷고 카메라가 따라간다. 사람 판단 항목(승인 보드와 같은 느낌)이라 종료 시점 UAT 로 넘긴다.

## Next Phase Readiness

- 06-17·06-18 이 쓸 DOM 계약이 준비됨: `main.mf-lobby`, `.mf-lobby__header`, `.mf-lobby__panel[data-world-panel]`, `.mf-lobby__test`, `[data-lobby-start]`, `.mf-reconnect--floating`, `[data-guide]`.
- 06-21 은 `Lobby` 의 `show(text)` 한 곳과 `toastForDiff`(미변경)를 이어받는다.
- 막힘 없음.

## Self-Check: PASSED

- 만든·바꾼 파일 존재 확인, `useSeatTransitions.ts` 삭제 확인
- 커밋 `699339d` `8402862` `a372a58` `4159296` 모두 HEAD 의 조상
- Task 1 acceptance 4개(grep) 통과, `test(06-15)` 커밋 존재
- plan 검증: `npx vitest run` 전체 통과(skip 은 camera.test 의 환경 변수 게이트 1건뿐), `npm run typecheck` 오류 없음, `git grep` 로 test/client 의 skip·todo 없음(rc 1), 빌드 후 메인 청크 three 없음(`three-in-main 0`)

---
*Phase: 06-world-skeleton*
*Completed: 2026-11-01*
