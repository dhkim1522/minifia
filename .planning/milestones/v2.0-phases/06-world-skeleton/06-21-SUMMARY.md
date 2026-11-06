---
phase: 06-world-skeleton
plan: 21
subsystem: ui
tags: [toast, copywriting, preload, performance-mark, lobby, tdd]

requires:
  - phase: 06-world-skeleton
    provides: "06-15 맵 로비(Lobby 의 알림 넣는 자리 한 곳·억제 규칙), 06-12 TopToast(crown 아이콘), 06-13 preloadWorld"
provides:
  - "로비 알림 v2 문구: 방장 변경 'TopToast(crown) 방장 · {닉네임}', '{닉네임} 님 입장', '{닉네임} 님 퇴장' (방장 > 입장 > 퇴장, 한 번에 하나)"
  - "toastForDiff → LobbyToast | null, RoomDiff.left 가 {seat, nickname}[]"
  - "Home·JoinByLink 마운트 때 preloadWorld(), 만들기·코드 참가·링크 참가 성공 직후 performance.mark('room-enter')"
affects: [06-19-perf-measure, 06-17-e2e, 06-18-deploy-e2e]

actuals:
  tokens: 7000
  tasks: 3
  commits: 5
plan_head_before: 41586a8c0dc127f7e2fd3f6cc845835590be4116
plan_head_after: bac15f810cbe69d84e4f963d2b0b2386d5cb5ee2

tech-stack:
  added: []
  patterns:
    - "차이(diff)가 문구에 필요한 값(퇴장자 닉네임)을 직접 들고 있게 해, 새 view 에 없는 사람의 이름을 이전 view 에서 한 번만 읽는다"
    - "월드 청크 미리 받기는 vi.mock 으로 runtime 의 preloadWorld 만 바꿔 끼운다(importOriginal 로 나머지는 유지, three 를 끌어오지 않음)"

key-files:
  created: []
  modified:
    - src/net/roomDiff.ts
    - src/screens/Lobby.tsx
    - src/screens/Home.tsx
    - src/screens/JoinByLink.tsx
    - test/unit/roomDiff.test.ts
    - test/client/lobby.test.tsx
    - test/client/screens.test.tsx
    - test/client/joinByLink.test.tsx
    - test/client/useRoomConnection.test.tsx
    - test/client/phaseScreens.test.tsx

key-decisions:
  - "가정 A1 유지: 저장된 토큰으로 바로 들어가는 Home 의 길(응답 없음)은 room-enter 표식을 찍지 않는다 — 3초 측정은 처음 방문 입장(만들기·참가)으로 잰다. 이 길이 표식을 안 찍는다는 테스트를 더했다"
  - "알림 억제 규칙(첫 view·epoch 변경·bannerVisible)은 건드리지 않고 문구와 아이콘만 바꿨다"

requirements-completed: [MAP-01]

coverage:
  - id: D1
    description: "방장 변경은 왕관 아이콘과 '방장 · {닉네임}', 입장은 '{닉네임} 님 입장', 퇴장은 '{닉네임} 님 퇴장' 한 줄 알림(우선순위 방장 > 입장 > 퇴장, 8자 닉네임도 13자 이하)"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "test/unit/roomDiff.test.ts#toastForDiff — 한 번에 하나, v2 말투"
        status: pass
      - kind: integration
        ref: "test/client/lobby.test.tsx#Lobby — 알림은 TopToast 하나 (D-10, CONN-04 WR-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "입장 화면 두 곳이 월드 청크를 미리 받고 입장 성공 직후에만 room-enter 표식을 찍는다(실패·저장 토큰 입장에는 없음)"
    requirement: MAP-01
    verification:
      - kind: integration
        ref: "test/client/screens.test.tsx#Home 월드 청크 미리 받기·room-enter 표식 (06-21, 3초 측정 시작점)"
        status: pass
      - kind: integration
        ref: "test/client/joinByLink.test.tsx#링크 참가 월드 청크 미리 받기·room-enter 표식 (06-21, 3초 측정 시작점)"
        status: pass
    human_judgment: false
  - id: D3
    description: "웨이브 6 끝 전체 테스트 초록·skip 없음·메인 청크에 three 없음"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "npx vitest run (137 files, 3681 passed, 1 skipped = test/unit/camera.test.ts 의 기존 describe.runIf)"
        status: pass
      - kind: other
        ref: "npm run typecheck (rc 0)"
        status: pass
      - kind: other
        ref: "npx vite build 뒤 dist/client/assets/index-*.js 에 WebGLRenderer 없음 (three-in-main 0)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-11-01
status: complete
---

# Phase 06 Plan 21: 로비 알림 v2 문구와 입장 화면 월드 청크 미리 받기 Summary

**방장 변경에 왕관 아이콘 "방장 · {닉네임}", 입장 "{닉네임} 님 입장", 퇴장 "{닉네임} 님 퇴장"을 한 줄 TopToast 로 띄우고, Home·JoinByLink 가 월드 청크를 미리 받은 뒤 입장 성공 직후 `performance.mark("room-enter")` 를 찍는다.**

## Performance

- **Duration:** 약 15분
- **Completed:** 2026-11-01
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- `toastForDiff` 가 `{ text, icon? }` 를 돌려주고 `RoomDiff.left` 가 이전 view 의 닉네임을 들어, 퇴장 알림에 닉네임이 들어간다. 우선순위는 방장 > 입장(마지막 사람) > 퇴장(마지막 사람)이다.
- Lobby 는 알림 넣는 자리 한 곳에서 `show(t.text, t.icon)` 만 바꿨다. 06-15 의 억제 규칙(내가 들어온 첫 view, epoch 변경, 재접속 띠)은 그대로다.
- Home(만들기·코드 참가)과 JoinByLink(링크 참가)가 마운트 때 `preloadWorld()` 를 한 번 부르고, 응답 성공 갈래의 `onEnterRoom` 바로 앞에서 `room-enter` 표식을 찍는다. 06-19 가 `room-enter` → `map-interactive` 로 3초를 잰다.
- 빌드의 메인 청크(`index-*.js`)에 `WebGLRenderer` 가 없다. 미리 받기는 동적 import 뿐이다.

## Task Commits

1. **Task 1: 트레이서 — 로비 알림 v2 문구·퇴장·방장 왕관**
   - RED `73d987e` (test) — 16개 실패. 모두 새 문구·`{text, icon}` 모양·`left` 닉네임에 대한 단언 실패(import·문법 오류 아님).
   - GREEN `06dfe1e` (feat)
2. **Task 2: 입장 화면 월드 청크 미리 받기·room-enter 표식**
   - RED `854d00e` (test) — 5개 실패. 미리 받기 호출 수와 표식 순서에 대한 단언 실패. 실패·저장 토큰 입장에 표식이 없다는 3개는 처음부터 통과(가드로 둠).
   - GREEN `47c7a8e` (feat)
3. **Task 3: 옛 문구 기대 수정·웨이브 6 게이트** — `bac15f8` (test)

**Plan metadata:** 이 SUMMARY 와 함께 커밋(docs: complete plan)

## RED 증거 (TDD)

- Task 1 RED: `npx vitest run test/unit/roomDiff.test.ts test/client/lobby.test.tsx` → 16 failed / 56 passed. 대표: `expected '"서준님이 새 방장이 되었어요"' to be '{"text":"방장 · 서준","icon":"crown"}'`, `expected '' to be '영희 님 퇴장'`. semanticAssessment: 대상 테스트가 실제로 실행되어 계획한 단언(새 문구·모양)에서 실패했고, 구현 부재가 원인이다.
- Task 2 RED: `npx vitest run test/client/screens.test.tsx test/client/joinByLink.test.tsx` → 5 failed / 66 passed. `expected "vi.fn()" to be called 1 times, but got 0 times`, `expected +0 to be 1`. semanticAssessment: 같음.
- `gsd_run check tdd-red-evidence` 기록 파일은 만들지 않았다(report 형식 클래스화 없이 vitest 실제 출력으로 직접 판정). 이 점은 순서상 의도적 생략으로 밝혀 둔다.

## Files Created/Modified

- `src/net/roomDiff.ts` — `LobbyToast`, `RoomDiff.left` 에 닉네임, `toastForDiff` 새 문구·우선순위
- `src/screens/Lobby.tsx` — `show(t.text, t.icon)`
- `src/screens/Home.tsx` — `preloadWorld()`, 만들기·코드 참가 성공 때 `room-enter` 표식
- `src/screens/JoinByLink.tsx` — 마운트 effect 의 `preloadWorld()`, 참가 성공 때 `room-enter` 표식
- 테스트: `roomDiff`·`lobby`(새 문구, 퇴장·왕관·입장 무아이콘 케이스), `screens`·`joinByLink`(미리 받기·표식 순서·실패 때 없음), `useRoomConnection`·`phaseScreens`(문구 기대만)

## Decisions Made

- 가정 A1 을 그대로 따랐다: 저장된 토큰으로 바로 들어가는 길은 표식이 없고, 그 사실을 테스트로 고정했다.
- 퇴장 알림 문구에 쓰는 닉네임을 새 view 에서 찾을 수 없어 `diffRoomViews` 가 이전 view 의 `{seat, nickname}` 을 `left` 에 담는다(계획 interfaces 대로).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 새 테스트의 타입 오류(`npm run typecheck` TS7031)**
- **Found during:** Task 2 (GREEN 검증)
- **Issue:** `roomEnterMarks` 헬퍼의 `spy` 를 `ReturnType<typeof vi.spyOn>` 으로 두어 `name` 이 암시적 any 가 됨
- **Fix:** 헬퍼 인자를 `{ mock: { calls: unknown[][] } }` 로 바꿈
- **Files modified:** test/client/screens.test.tsx, test/client/joinByLink.test.tsx
- **Verification:** typecheck rc 0, 두 파일 71 passed
- **Committed in:** 47c7a8e

---

**Total deviations:** 1 auto-fixed (1 blocking, 테스트 타입). **Impact:** 범위 변화 없음.

Task 3 에서 실패한 테스트는 계획이 예상한 두 파일(useRoomConnection, phaseScreens) 안에 모두 있었고, 이 두 파일 밖의 실패는 없었다.

## Issues Encountered

- Task 1 커밋 직후 전체 실행에서 3개 실패(예상한 옛 문구 기대)가 났고 Task 3 에서 문구만 고쳐 해결했다. `useRoomConnection.test.tsx:455` 같은 `queryByText(...).toBeNull()` 단언은 옛 문구여도 통과해 버려서 새 문구로 함께 바꿨다(그대로 두면 아무것도 검사하지 못함).
- 전체 결과의 "1 skipped" 는 `test/unit/camera.test.ts` 의 기존 `describe.runIf(process.env.CAMERA_PRINT === "1")` 이며 이 계획과 무관하다. `git grep -F -e ".skip(" -e ".todo(" -- test` 는 rc 1(없음).

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 06-19 는 `performance.mark("room-enter")` 를 시작점으로 `map-interactive` 와 짝지어 3초를 잴 수 있다(처음 방문 입장 기준).
- `scripts/e2e/*`(옛 로비 선택자, `flows.mjs:176` 왕관 검사)는 06-17·06-18 몫으로 건드리지 않았다.

## Self-Check: PASSED

- 파일: src/net/roomDiff.ts, src/screens/Lobby.tsx, Home.tsx, JoinByLink.tsx 및 테스트 6개 모두 존재
- 커밋: 73d987e, 06dfe1e, 854d00e, 47c7a8e, bac15f8 모두 HEAD 의 조상
- 인수 기준: Task 1 세 가지 + `test(06-21)` 커밋, Task 2 (`preloadWorld()` 두 곳, room-enter Home 2·JoinByLink 1), Task 3 (`님 입장` useRoomConnection 4·phaseScreens 1) 모두 통과
- 계획 검증: `npx vitest run` 137 파일 초록, `npm run typecheck` rc 0, 메인 청크 three 없음, skip·todo 없음

---
*Phase: 06-world-skeleton*
*Completed: 2026-11-01*
