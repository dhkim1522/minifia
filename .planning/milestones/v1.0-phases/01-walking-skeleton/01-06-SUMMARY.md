---
phase: 01-walking-skeleton
plan: 06
subsystem: ui
tags: [react, history-api, localStorage, polling, vitest, happy-dom, tdd]

requires:
  - phase: 01-walking-skeleton
    provides: "01-04 와이어 계약(RoomPreview.players, JoinRoomResponse), 01-05 Button·TextField·Backdrop·Toast·copy.ts·assets.ts·첫 화면"
provides:
  - "api.ts: getPreview(GET /api/rooms/{코드}), joinRoom(POST .../join) — request() 공통 처리"
  - "session.ts: minifia:session 한 칸·마지막 닉네임, 저장소 예외·전역 저장소 없음 시 메모리 대체, 모양 검사"
  - "App: /, /r/{코드} 경로 라우팅(라이브러리 없음), 입장 정보 이어받기(미리보기로 낡은 세션 확인), 방에서 나온 이유별 화면"
  - "S-01 코드 참가 줄(방 코드 칸 + [참가]), S-02 링크 참가(JoinByLink), ErrorScreen, Figure"
  - "ds.css: .mf-figure*, .mf-tag*, .mf-join__*, .mf-error*, .mf-entry__form"
affects: [01-09, 01-10, 01-11, 01-13, 01-14]

actuals:
  tokens: 17500
  tasks: 3
  commits: 6
plan_head_before: 42bef63ad167ea5de21981febc90a1e5833057bc
plan_head_after: f364a0c200f19f6b579ce859f257a0cc06f9d657

tech-stack:
  added: []
  patterns:
    - "라우터 라이브러리 없이 window.location.pathname + history API(replaceState/pushState/popstate)"
    - "폴링은 setTimeout 사슬(보일 때만, visibilitychange 복귀 즉시, inFlight 직렬화, 404·시작됨 중단, 언마운트 해제)"
    - "저장소는 호출 때마다 globalThis.localStorage 를 읽고 예외·없음이면 모듈 메모리로 대체"
    - "App.handleExit 의 switch default 가 알 수 없는 이유(replaced, 01-11 의 gaveUp)를 첫 화면으로 보냄"
    - "테스트: 실패 보고서를 기계가 읽도록 단언 메시지는 한 줄(singleLineErrors, JSON 문자열 비교)"

key-files:
  created:
    - src/net/session.ts
    - src/screens/JoinByLink.tsx
    - src/screens/ErrorScreen.tsx
    - src/components/Figure.tsx
    - test/unit/session.test.ts
    - test/client/joinByLink.test.tsx
    - test/helpers/memoryStorage.ts
    - test/helpers/singleLineErrors.ts
  modified:
    - src/net/api.ts
    - src/App.tsx
    - src/screens/Home.tsx
    - src/styles/ds.css
    - test/client/app.test.tsx
    - test/client/screens.test.tsx

key-decisions:
  - "입장 정보는 한 칸(minifia:session = {code, token}): 다른 방 링크는 이어받지 않고 그 방 S-02 를 보이며, 새 방에 들어가면 덮어쓴다"
  - "[처음으로](replaced·gaveUp)는 입장 정보를 지우지 않는다. 이어받기는 페이지를 새로 열 때(초기 로드)만 하고 popstate 로 / 에 온 경우는 첫 화면이다"
  - "S-01 은 카드 안에 폼 둘(방 만들기 / 코드 참가)로 나눠 코드 칸에서 Enter 가 방을 만들지 않게 한다"
  - "S-02 는 미리보기를 받기 전까지 입력 카드를 숨긴다(앉은 사람과 인원을 모른 채 참가하지 않게). 정원 초과는 자리가 날 수 있어 계속 받는다"
  - "API 요청 공통 처리를 request() 로 합쳐 GET·POST 가 같은 네트워크·파싱 실패 규칙을 쓴다"

patterns-established:
  - "화면은 서버 거절을 messageForApiError 의 place(nickname·code·card·toast)로 나눠 한 번에 하나만 보이고 칸을 고치면 지운다"
  - "토스트 안내(notice)는 화면 마운트 때 한 번 show"

requirements-completed: [ROOM-02, CONN-01]

coverage:
  - id: D1
    description: "참가 링크 /r/{코드}: 초대 문구·방 코드·먼저 앉은 사람(인물·이름표, 자리 순)·인원, 닉네임만 넣고 참가하면 방으로 들어가며 토큰은 localStorage 에만 저장된다"
    requirement: "ROOM-02"
    verification:
      - kind: unit
        ref: "test/client/joinByLink.test.tsx#링크 참가 화면 (S-02) 트레이서"
        status: pass
    human_judgment: true
    rationale: "배경 그림 위 인물·이름표 배치와 글자 대비가 화면설계서 S-02 와 같아 보이는지는 자동 테스트가 단언하지 않는다"
  - id: D2
    description: "S-01 코드 참가: 4자리 미만이면 [참가]만 꺼지고 초과 입력은 잘리며, 거절은 코드 칸/닉네임 칸 아래·토스트로, 같은 코드의 토큰이 있으면 요청 없이 같은 자리로"
    requirement: "ROOM-02"
    verification:
      - kind: unit
        ref: "test/client/screens.test.tsx#Home 코드 참가 (S-01)"
        status: pass
    human_judgment: false
  - id: D3
    description: "입장 정보 저장·이어받기: minifia:session 한 칸, 새로고침·링크 재진입 시 같은 자리, / 에서 미리보기로 방 생존 확인(404 면 삭제), 모양이 이상한 값 무시"
    requirement: "CONN-01"
    verification:
      - kind: unit
        ref: "test/unit/session.test.ts"
        status: pass
      - kind: unit
        ref: "test/client/app.test.tsx#App 입장 정보 이어받기 (E1 resume, Pitfall 22)"
        status: pass
    human_judgment: false
  - id: D4
    description: "마지막 닉네임이 첫 화면·링크 참가 화면 칸에 미리 채워지고 링크 참가 화면은 열리면 포커스와 전체 선택"
    requirement: "ROOM-02"
    verification:
      - kind: unit
        ref: "test/client/joinByLink.test.tsx#링크 참가 화면 닉네임 (D-06)"
        status: pass
    human_judgment: true
    rationale: "실기기(iOS Safari)에서 포커스·전체 선택과 키보드 올라옴이 의도대로 보이는지는 jsdom 계열 테스트로 알 수 없다"
  - id: D5
    description: "S-02 상태: 불러오는 중, 없는 방·시작됨·정원 초과 사유 화면, 10초 폴링(보일 때만·복귀 즉시·직렬화·중단 조건·언마운트 해제)"
    requirement: "ROOM-02"
    verification:
      - kind: unit
        ref: "test/client/joinByLink.test.tsx#링크 참가 화면 상태 / 미리보기 폴링"
        status: pass
    human_judgment: false
  - id: D6
    description: "방에서 나온 이유별 화면: kicked·room_closed 오류 화면, invalid_token 링크 참가+토스트, left·replaced 처리"
    requirement: "CONN-01"
    verification:
      - kind: unit
        ref: "test/client/app.test.tsx#방에서 나온 이유별 화면 (E3, D-07)"
        status: pass
    human_judgment: false
  - id: D7
    description: "8명이 앉은 방의 링크 참가 화면이 폭 360px 에서 인물·이름표가 겹치지 않고 한 줄 4명씩 두 줄로 접힌다(E2 overflow)"
    verification: []
    human_judgment: true
    rationale: "계획이 backstop(01-10 실기기·폭 360px 확인)으로 분류했고 레이아웃은 CSS(max-width 4×72+3×8, flex-wrap)로만 보장해 jsdom 으로 검증할 수 없다"

duration: 13min
completed: 2026-10-23
status: complete
---

# Phase 1 Plan 06: 링크·코드 참가 화면과 입장 정보 Summary

**history API 라우팅(/, /r/{코드}), 링크 참가 화면(S-02, 10초 미리보기 폴링)과 첫 화면 코드 참가 줄, minifia:session 한 칸 저장·이어받기, 내보내짐·방 닫힘·입장 정보 무효별 오류 화면**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-23T04:59:29Z
- **Completed:** 2026-10-23T05:12:09Z
- **Tasks:** 3 (트레이서 1 + 확장 2, 각 RED→GREEN 커밋)
- **Files modified:** 14 (생성 8, 수정 6)

## Accomplishments

- 참가 링크를 열면 "미니피아에 초대받았어요 / 방 {코드}", 먼저 앉은 사람(세트 C 인물 72×96 + 이름표 알약, 자리 순)과 "{n} / 8명이 모였어요", 닉네임 카드가 보이고 닉네임만 넣으면 방에 들어간다. 토큰은 localStorage 와 (01-11 의) WebSocket hello 본문에만 있고 주소·화면·콘솔에 나오지 않는다(T-01-19).
- 첫 화면에 "또는" 아래 방 코드 줄을 더했다. 4자리 미만이면 [참가]만 꺼지고, 거절은 코드 칸/닉네임 칸 아래(2px --crimson-300)·토스트로 보이며 입력값은 지워지지 않는다. 같은 코드의 토큰을 이미 가졌으면 요청 없이 같은 자리로 돌아간다.
- `/` 를 새로 열 때 저장된 입장 정보가 있으면 `GET /api/rooms/{코드}` 로 방 생존을 먼저 확인한다(404 면 정보 삭제 후 첫 화면, 네트워크 실패는 방 화면의 연결 계층에 넘김). `/r/{코드}` 는 저장된 코드가 같을 때만 바로 방으로 간다(Pitfall 22).
- 링크 참가 화면은 미리보기를 10초마다 받되 보이는 동안만, 복귀 때 즉시 한 번, 요청은 직렬화, 404·시작됨이면 중단, 언마운트 시 해제한다(T-01-21). 없는 방·시작됨·정원 초과는 입력 카드 대신 사유 한 문장 + [처음으로]다.
- 방에서 나온 이유별로 left(정보 삭제·첫 화면), kicked·room_closed(정보 삭제·ErrorScreen), invalid_token(정보 삭제·같은 코드 S-02 + 토스트), 그 밖(replaced, 이후 gaveUp)은 정보를 유지한 채 첫 화면으로 간다.

## Task Commits

1. **Task 1 (tracer): 참가 링크로 방에 들어간다** — RED `2f3043a` (test), GREEN `57b8e4c` (feat)
2. **Task 2: 첫 화면 코드 참가·이어받기·마지막 닉네임** — RED `40c147e` (test), GREEN `8feb844` (feat)
3. **Task 3: 링크 참가 상태·폴링·오류 화면·나온 이유** — RED `88791c4` (test), GREEN `f364a0c` (feat)

**Plan metadata:** 이 SUMMARY 를 담은 docs(01-06) 커밋(아래 전달 보고서 참고). STATE.md·ROADMAP.md·REQUIREMENTS.md·HANDOFF.md 는 오케스트레이터 몫이라 건드리지 않았다.

## TDD Gate Compliance

세 Task 모두 `test(01-06)` → `feat(01-06)` 순서(RED → GREEN)로 커밋했고 REFACTOR 커밋은 없다(고칠 만한 정리가 없었다).

| Task | RED 증거(`gsd-tools check tdd-red-evidence`) | semanticAssessment |
| --- | --- | --- |
| 1 | tap-flat 보고서, `RED_EVIDENCE_OK` / `target_test_failed` | 대상 테스트(참가 링크를 열면 초대 문구…)가 실제로 실행되어 '방 {코드}·초대 문구' 단언에서 실패. App 이 항상 Home 을 그려서이며 로드·픽스처 오류가 아니다 |
| 2 | tap-flat 보고서, `RED_EVIDENCE_OK` (57개 중 21 실패) | 대상 테스트(코드 줄)가 '또는' 구분선 단언에서 실패. Home 에 코드 줄이 없어서이며 의도한 이유다. session 메모리 대체 테스트 1건은 Task 1 의 session.ts 버그(아래 Deviations)를 드러냈다 |
| 3 | tap-flat 보고서, `RED_EVIDENCE_OK` (37개 중 19 실패) | 대상 테스트(10초 뒤 GET 2회)가 "expected 1 to be 2" 로 실패. 폴링이 없어서이며 의도한 이유다 |

RED 보고서 파싱을 위해 테스트 실패 메시지를 한 줄로 만드는 헬퍼(`test/helpers/singleLineErrors.ts`)와 JSON 문자열 비교를 썼다(Testing Library 의 여러 줄 DOM 덤프는 TAP 보고서를 깨뜨린다). 일부 단언(트레이서의 "앉은 사람 한 줄", Task 2 의 session 저장소 왕복 등)은 Task 1 이 session.ts 전체를 계획대로 한 번에 만들어서 RED 시점에 이미 통과했다. 대상 테스트는 모두 실패했다.

## Files Created/Modified

- `src/net/api.ts` — request() 공통 처리, getPreview·joinRoom 추가
- `src/net/session.ts` — 입장 정보 한 칸·마지막 닉네임, 저장소 예외·부재 시 메모리 대체, 모양 검사(코드 4자리·토큰 16~128자)
- `src/App.tsx` — 경로 라우팅, resuming 확인, handleExit 이유별 처리
- `src/screens/Home.tsx` — 코드 참가 줄, 서버 거절 위치별 오류, 마지막 닉네임
- `src/screens/JoinByLink.tsx` — S-02, 폴링, 사유 화면, 포커스·전체 선택
- `src/screens/ErrorScreen.tsx` — 사유 한 문장 + [처음으로]
- `src/components/Figure.tsx` — 세트 C 인물(figureSrc), 끊김은 CSS 흑백 60%
- `src/styles/ds.css` — 인물·이름표·S-02·오류 화면·입력 카드 폼 규칙(hex 없음, 진홍은 crimson-300 만)
- `test/unit/session.test.ts`, `test/client/{joinByLink,app,screens}.test.tsx`, `test/helpers/{memoryStorage,singleLineErrors}.ts`

## Decisions Made

- key-decisions 에 적은 대로. 특히 S-02 는 방 정보를 받기 전에 입력 카드를 숨기고(불러오는 중 문구만), 정원 초과는 `blocked: full` 로 보이되 폴링을 이어 자리가 나면 카드가 돌아온다.
- S-01 의 [참가]는 `type="submit"` 이고 코드 줄이 별도 폼이라 Enter 로 방 만들기가 실수로 실행되지 않는다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 테스트 환경에서 localStorage 가 undefined**
- **Found during:** Task 1 (RED)
- **Issue:** 이 PC 의 Node 26 은 `--localstorage-file` 없이 전역 `localStorage` 를 `undefined` 로 내서 happy-dom 환경에서도 `window.localStorage` 를 쓸 수 없다. 첫 RED 가 픽스처 오류(`Cannot read properties of undefined (reading 'clear')`)로 실패해 INVALID_RED 였다.
- **Fix:** 테스트 전용 메모리 저장소 헬퍼 `installMemoryStorage()` 를 만들어 저장소를 읽고 쓰는 테스트에서 심었다. session.ts 는 호출 때마다 전역을 읽어 없으면 메모리로 대체하므로 앱 코드는 영향 없다. vitest.config.ts 같은 공용 설정은 건드리지 않았다.
- **Files modified:** test/helpers/memoryStorage.ts
- **Committed in:** 2f3043a

**2. [Rule 1 - Bug] session.ts 가 저장소가 받아 준 값을 메모리 대체본에서 지움**
- **Found during:** Task 2 (RED 의 "전역 localStorage 가 없는 환경" 테스트가 드러냄)
- **Issue:** Task 1 에서 만든 write() 가 저장 성공 뒤 `memory.delete(key)` 를 했는데, 전역 저장소가 없으면 대체 저장소가 바로 그 메모리 맵이라 방금 쓴 값을 지웠다(저장소 없음 환경에서 입장 정보가 항상 null).
- **Fix:** 성공 뒤 대체본 삭제를 없앴다(대체본은 getItem 이 던질 때만 쓰이고 remove 가 비운다).
- **Files modified:** src/net/session.ts
- **Verification:** test/unit/session.test.ts 전체 통과
- **Committed in:** 8feb844

**3. [Rule 1 - Bug, 테스트] act 안에서 기다려 화면이 바뀌지 않음 / 화면이 먼저 그려져 비동기 결과를 놓침**
- **Found during:** Task 1 (GREEN)
- **Issue:** `act(async)` 안에서 `vi.waitFor` 로 기다리면 갱신이 act 가 끝날 때까지 쌓여 영원히 안 보이고, 헤더 문구는 즉시 그려져 미리보기를 기다리지 못했다. RED 보고서 증거(대상 실패 이유는 그대로)는 유효하다.
- **Fix:** 짧게 act 로 흘려 보내며 다시 확인하는 `see()` 헬퍼로 바꾸고 인원 문구("2 / 8명이 모였어요")를 기다린 뒤 단언하게 했다.
- **Files modified:** test/client/joinByLink.test.tsx
- **Committed in:** 57b8e4c

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug, 1 test-only bug)
**Impact on plan:** 모두 정확성·검증 가능성에 필요했고 범위 확장은 없다.

## Issues Encountered

- 새 worktree 라 node_modules 가 없어 `npm ci`(lockfile 고정, 새 패키지 없음)로 설치했다. 패키지 추가는 없다(T-01-SC).
- 평소 쓰던 `gsd_run` 대신 `node ~/.claude-personal/gsd-core/bin/gsd-tools.cjs` 로 RED 증거를 검증했다.

## Known Stubs

없음. 하드코딩된 빈 값·자리표시 문구가 화면 데이터로 흘러가는 곳이 없다.

## Threat Flags

없음. 새 네트워크 표면은 계획의 trust boundary(미리보기·참가 호출, localStorage, 주소)를 벗어나지 않는다. T-01-19(토큰은 session.ts 에만, pathname·search 에 없음을 테스트가 확인), T-01-20(loadSession 모양 검사), T-01-21(폴링 상한) 완화를 적용했다.

## Backstop 항목 (미검증)

- **E2 overflow (폭 360px, 8명 두 줄)**: CSS(`max-width: calc(4 * 72px + 3 * var(--space-sm))`, `flex-wrap`)로 4명씩 접히게 했으나 레이아웃은 jsdom 으로 검증하지 못한다. 계획대로 01-10 실기기 확인에 맡긴다. `.planning/WINDOWS.md` 기록은 공용 파일이라 하지 않았다(오케스트레이터가 필요하면 `unrun-verify` 로 추가).
- 실기기 iOS Safari 의 열자마자 포커스·전체 선택, 키보드 올라올 때 세로 스크롤.

## Deferred (오케스트레이터 몫)

- HANDOFF.md 갱신·push 는 이 worktree 실행에서 하지 않았다(오케스트레이터가 병합 뒤 main 에서 수행).
- STATE.md·ROADMAP.md·REQUIREMENTS.md(ROOM-02, CONN-01 완료 표시) 갱신도 오케스트레이터 몫이다. 서버 쪽 `GET /api/rooms/{코드}` 미리보기·참가 라우트는 01-09, 배포본 확인은 01-14 에서 한다(이 계획은 fetch 스텁으로 증명).

## Next Phase Readiness

- 01-09(서버 참가·미리보기 라우트)가 와이어 계약대로 응답하면 이 화면이 그대로 붙는다. 01-11 은 RoomScreen 의 ExitReason 에 `gaveUp` 을 더해도 App.handleExit 의 default 가 처리한다.
- 01-10 은 `.mf-tag` 에 장면 위 절대 위치 변형을 더하면 된다(지금은 정적 알약).

## Self-Check: PASSED

- 생성 파일 확인: src/net/session.ts, src/screens/JoinByLink.tsx, src/screens/ErrorScreen.tsx, src/components/Figure.tsx, test/unit/session.test.ts, test/client/joinByLink.test.tsx, test/helpers/memoryStorage.ts, test/helpers/singleLineErrors.ts 모두 존재
- 커밋 확인: 2f3043a, 57b8e4c, 40c147e, 8feb844, 88791c4, f364a0c 모두 HEAD 의 조상
- 인수 기준: Task 1·2·3 의 grep 기준 모두 PASS, `crimson-300` 외 진홍 없음
- 계획 검증: `npm run typecheck` 통과, `npx vitest run --project unit --project client` 17 파일 246 테스트 통과, `vite build` 성공

---
*Phase: 01-walking-skeleton*
*Completed: 2026-10-23*
