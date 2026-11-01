---
phase: 07-free-chat
plan: "19"
subsystem: free-chat-keyboard-ime
tags: [chat, keyboard, visualViewport, ime, korean, lobby, day-scene, e2e, playwright, cdp]
status: complete

requires:
  - phase: 07-free-chat
    provides: "07-03 ChatPanel IME 제출·chatUi 상수, 07-05 useKeyboardLift·useChatLogHeight, 07-13 로비 ChatPanel·useChat, 07-15 테이블 ChatPanel, 07-18 카메라 스테이지 사각형"
provides:
  - "Lobby: useKeyboardLift 배선 — 루트 data-kb-open, 패널 mf-lobby__panel--kb, 기록 칸 72(compact), 행동 줄 숨김(D3), 스테이지 아래 끝 = 패널 높이 + lift"
  - "RoomScreen: 방 높이를 --mf-room-h(px)로 처음과 포커스 없는 resize 에서만 고정 (room.css 가 var(--mf-room-h, 100dvh 식))"
  - "WorldStage: 입력칸 포커스 중 탭은 blur 만 하고 걷지 않는다(D4)"
  - "DayScene·day.css: 채팅 패널이 있는 단계에서 패널만 키보드 위로 올라가고 장면은 다시 배치하지 않는다 (mf-dayscene__panel--kb)"
  - "ChatPanel: 보내기 버튼 mousedown 이 포커스를 옮기지 않는다 (버그 수정)"
  - "E2E 흐름 chat-ime(CDP imeSetComposition)·chat-keyboard(가상 visualViewport), 도우미 imeCompose·imeEnter·installFakeViewport·readKeyboardState"
affects: [07-20, 07-21]

actuals:
  tokens: 18500
  tasks: 3
  commits: 8
plan_head_before: 74475274f154216f3ae6492c923d7543aafc34d9
plan_head_after: 3b9eaf4a9934d786dab7eb9aa3704b14ed5150c3

tech-stack:
  added: []
  patterns:
    - "키보드 CSS 변수(--mf-kb-lift·--mf-vv-top)는 방 틀(.mf-room)에 쓴다 — 로비 안(헤더·패널)과 방 틀 직속(떠 있는 재접속 띠)이 같은 값을 읽는다"
    - "스테이지 아래 끝은 getter 로 넘긴다: WorldStage 가 프레임마다 읽는 순간의 lift 가 더해져 vv resize 마다 로비를 다시 그리지 않는다"
    - "테이블 패널은 relative bottom 으로 올리고 차지하던 자리는 margin-top 이 채운다 — 장면 높이 불변"
    - "E2E 가상 키보드: addInitScript 로 window.visualViewport 를 조종 가능한 EventTarget 으로 바꾸고 window.__mfVv.set(height, offsetTop)"

key-files:
  created: []
  modified:
    - src/screens/Lobby.tsx
    - src/screens/RoomScreen.tsx
    - src/screens/DayScene.tsx
    - src/components/WorldStage.tsx
    - src/components/v2/ChatPanel.tsx
    - src/styles/lobby.css
    - src/styles/room.css
    - src/styles/day.css
    - test/client/lobby.test.tsx
    - test/client/worldStage.test.tsx
    - test/client/dayScene.test.tsx
    - test/client/roomScreen.test.tsx
    - test/client/chatPanel.test.tsx
    - scripts/e2e/flows.mjs
    - scripts/e2e/browser.mjs

key-decisions:
  - "키보드 변수를 로비 루트가 아니라 가장 가까운 .mf-room 에 쓴다(없으면 로비 루트). 떠 있는 재접속 띠(.mf-reconnect--floating)가 로비 밖 방 틀 직속이라 같은 --mf-vv-top 을 읽어야 하기 때문"
  - "헤더 계열의 translateY(var(--mf-vv-top, 0px))는 data-kb-open 에 묶지 않고 변수에만 묶었다 — 포커스가 없으면 변수가 0 이라 움직이지 않고, offsetTop > 0 이 lift <= 80 에서 생겨도 헤더가 따라온다"
  - "방 높이 재측정은 resize·orientationchange 에서 채팅 입력칸 포커스가 없을 때만(한 프레임 뒤). PC 창 크기·주소창 변화는 예전처럼 따라가고 키보드만 무시한다"
  - "보내기 버튼 mousedown 의 기본 동작(포커스 이동)을 막는다 — Chromium·Android 에서 버튼이 포커스를 가져가면 키보드가 닫혀 패널이 손가락 밑에서 내려가 클릭이 빗나갔다"

patterns-established:
  - "화면이 만드는 값이 프레임마다 읽히는 곳(런타임 stageRect)으로 가면 상태 대신 getter 객체를 넘겨 다시 그리기를 피한다"
  - "E2E 판정은 앱 안의 측정(chatMock)을 밖에서 다시 한다: 패널 아래 ≤ 보이는 영역 아래, 캔버스 호스트 ResizeObserver 호출 수, 투영한 발·이름표 스택 사각형"

requirements-completed: [CHAT-05]

coverage:
  - id: D1
    description: "한글 조합 중 Enter 와 보내기가 문장을 한 번만 보내고 입력칸에 꼬리 글자가 남지 않는다 (Chromium CDP 실제 IME 경로)"
    requirement: CHAT-05
    verification:
      - kind: e2e
        ref: "scripts/e2e/flows.mjs chat-ime 390x844 (IME1~IME7)"
        status: pass
    human_judgment: false
  - id: D2
    description: "한글 조합 중 Enter·보내기가 iPhone 실기기에서도 깨지거나 두 번 전송되지 않는다"
    requirement: CHAT-05
    verification: []
    human_judgment: true
    rationale: "iOS WebKit 의 compositionend/Enter 순서와 실제 키보드는 Chromium CDP 가 흉내 내지 못한다 — 07-21 실기기 확인(합격 검사 4)"
  - id: D3
    description: "로비에서 포커스 + lift > 80 이면 data-kb-open, 행동 줄 숨김, 기록 칸 72, 패널이 키보드 바로 위, 스테이지 아래 끝 = 패널 + lift"
    requirement: CHAT-05
    verification:
      - kind: unit
        ref: "test/client/lobby.test.tsx#Lobby — 키보드가 열리면 패널이 올라가고 행동 줄이 숨는다"
        status: pass
      - kind: e2e
        ref: "scripts/e2e/flows.mjs chat-keyboard 6종 (KB1·KB2)"
        status: pass
    human_judgment: false
  - id: D4
    description: "키보드가 열리고 닫히는 동안 캔버스 px 크기 불변·ResizeObserver 호출 0, 방 높이는 px 고정"
    requirement: CHAT-05
    verification:
      - kind: unit
        ref: "test/client/roomScreen.test.tsx#RoomScreen: 방 높이 --mf-room-h"
        status: pass
      - kind: e2e
        ref: "scripts/e2e/flows.mjs chat-keyboard 6종 (KB3·KB13, 가짜 visualViewport)"
        status: pass
    human_judgment: false
  - id: D5
    description: "내 캐릭터 발과 이름표(입력 중 칸 포함)가 남은 스테이지 안에 보인다 (큰 폰 3종), 작은 폰 3종은 캐릭터 몸만"
    requirement: CHAT-05
    verification:
      - kind: e2e
        ref: "scripts/e2e/flows.mjs chat-keyboard 6종 (KB4)"
        status: pass
    human_judgment: false
  - id: D6
    description: "D4: 입력칸 포커스 중 맵 탭은 blur 만 하고 걷지 않으며, 닫힌 뒤의 탭부터 평소처럼 걷는다"
    requirement: CHAT-05
    verification:
      - kind: unit
        ref: "test/client/worldStage.test.tsx#WorldStage: 입력칸에 포커스가 있을 때의 탭은 키보드만 닫는다"
        status: pass
      - kind: e2e
        ref: "scripts/e2e/flows.mjs chat-keyboard 6종 (KB10·KB11·KB14)"
        status: pass
    human_judgment: false
  - id: D7
    description: "iOS 가 화면을 밀면(vv.offsetTop > 0) 헤더 계열이 offsetTop 만큼 내려와 맨 위에 머물고 window.scrollTo 로 되돌리지 않는다"
    requirement: CHAT-05
    verification:
      - kind: unit
        ref: "test/client/lobby.test.tsx#Lobby — 키보드 배치 스타일 계약"
        status: pass
      - kind: e2e
        ref: "scripts/e2e/flows.mjs chat-keyboard 6종 (KB5·KB6)"
        status: pass
    human_judgment: false
  - id: D8
    description: "보낸 뒤 입력칸 포커스가 유지되고 패널 위치가 변하지 않는다"
    requirement: CHAT-05
    verification:
      - kind: unit
        ref: "test/client/chatPanel.test.tsx#보내기 버튼을 누르는 순간(mousedown)이 포커스를 옮기지 않는다"
        status: pass
      - kind: e2e
        ref: "scripts/e2e/flows.mjs chat-keyboard 6종 (KB7~KB9)"
        status: pass
    human_judgment: false
  - id: D9
    description: "테이블 화면(낮 토론·변론·밤 마피아·탈락자)은 키보드가 열려도 장면을 다시 배치하지 않고 패널만 키보드 위로 올린다"
    requirement: CHAT-05
    verification:
      - kind: unit
        ref: "test/client/dayScene.test.tsx#DayScene 키보드 열림·닫힘"
        status: pass
    human_judgment: true
    rationale: "테이블 화면의 가상 키보드 E2E 는 이 계획 범위(로비)에 없다. 올라온 패널이 아래 인물을 가리는 정도와 실제 키보드 배치는 07-21 실기기 확인(합격 검사 7)"
  - id: D10
    description: "키보드가 열려도 입력줄이 가려지지 않고 닫을 때 화면이 튀지 않는다 (iPhone Safari·iOS용 Chrome·Android Chrome·삼성 인터넷·카카오톡 인앱)"
    requirement: CHAT-05
    verification: []
    human_judgment: true
    rationale: "실제 iOS·Android 키보드와 인앱 WebView 는 가짜 visualViewport 로 흉내 낼 수 없다(가정 A1) — 07-21 사람 확인, 미확인은 합격으로 세지 않음"

duration: 28min
completed: 2026-11-02
---

# Phase 7 Plan 19: 한글 조합·키보드 배치 Summary

**로비 키보드 위 패널·D3 compact·D4 탭 blur·방 높이 px 고정과 테이블 패널 lift 를 붙이고, Chromium CDP 한글 조합(chat-ime)과 가상 visualViewport(chat-keyboard) E2E 로 합격 검사 1~4·6 의 자동 몫을 초록으로 고정했다.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-11-01T16:14:00Z (추정)
- **Completed:** 2026-11-01T16:43:00Z
- **Tasks:** 3 (트레이서 1 + auto 2)
- **Files modified:** 15

## Accomplishments

- **한글 조합(트레이서, Task 1)**: CDP `Input.imeSetComposition` 으로 "안녕하세요" 를 조합하다 마지막 글자 조합 중 Enter(keyCode 229) → 확정 → Enter, 또 "반가워요" 를 조합하다 조합 중 보내기. 두 경우 모두 두 페이지 기록에 줄이 정확히 한 번, 입력칸에 꼬리 글자가 없고 1초 뒤에도 그대로다(10/10). ChatPanel 의 조합 처리(07-03)는 고치지 않았다 — 실제 IME 경로에서 이미 맞았다.
- **로비 키보드 배치(Task 2)**: `useKeyboardLift` 를 방 틀에 걸어 열림이면 루트 `data-kb-open`, 패널 `--kb`(bottom `--mf-kb-lift`, 아래 여백 8, 높이 150), 기록 칸 72, 행동 줄 숨김. 스테이지 아래 끝은 패널 높이 + lift 이고 getter 로 넘겨 vv resize 마다 다시 그리지 않는다. 헤더·가림막·[테스트]·위 알림·재접속 띠는 `translateY(var(--mf-vv-top))`.
- **방 높이 px 고정**: RoomScreen 이 `--mf-room-h` 를 마운트와 포커스 없는 resize 에서만 px 로 쓰고 room.css 가 그 변수를 쓴다(없으면 100dvh 식).
- **D4**: WorldStage 가 손가락을 대는 순간 입력칸에 포커스가 있었으면 떼는 탭에서 blur 만 한다(걷기 요청·링 없음).
- **테이블 패널 lift(Task 3)**: DayScene 이 채팅 패널이 있을 때만 훅을 켜고, `.mf-dayscene__panel--kb` 가 relative bottom 으로 올리되 차지하던 자리를 margin-top 이 채워 장면 높이가 변하지 않는다. 위쪽 바도 vv.offsetTop 만큼 내려온다.
- **chat-keyboard E2E**: 6개 크기 22~23/22~23. 포커스 300·1000ms 패널/입력줄 아래 ≤ 보이는 영역 아래, 캔버스 불변·ResizeObserver 0, 큰 폰 3종 발+이름표 스택(입력 중 칸 포함)이 남은 스테이지 안(남은 스테이지 296~384px), 작은 폰은 몸만, offsetTop 120 헤더, 보낸 뒤 포커스·패널 불변, D4 탭, 닫힌 뒤 복귀·걷기.

## Task Commits

1. **Task 1: 트레이서 chat-ime** - `92c6f70` (test)
2. **Task 2: 로비 키보드 배치** - RED `6ba7d13` (test) → GREEN `b28bb99` (feat)
3. **Task 3: 테이블 패널 lift** - RED `afda7f9` (test) → GREEN `8f71691` (feat)
4. **Task 3 중 발견한 버그 수정**: RED `333d96c` (test) → `00521e1` (fix, ChatPanel 보내기 mousedown)
5. **Task 3: chat-keyboard E2E** - `3b9eaf4` (test)

**Plan metadata:** 이 SUMMARY 와 STATE·ROADMAP·REQUIREMENTS 갱신은 docs 커밋으로 따로 남는다.

## TDD 기록 (Task 2·3, tdd=true 또는 같은 규율)

- **RED (Task 2, `6ba7d13`)**: 12개가 계획한 단언에서 실패했다 — `data-kb-open` null(기대 "true"), `--mf-kb-lift`/`--mf-vv-top` 빈 문자열, `.mf-lobby__panel--kb`·`translateY(var(--mf-vv-top…)`·`var(--mf-room-h…)` 규칙 없음, `--mf-room-h` 빈 문자열, D4 탭이 move 를 보냄. 구문·import·픽스처 오류가 아니다(수준 단언 실패 메시지로 확인). 의미 판정: 의도한 이유로 실패. (이 계획은 `type: execute` 라 `check tdd-red-evidence` 분류기는 쓰지 않았다.)
- **RED (Task 3, `afda7f9`)**: 열림 클래스 없음·`--mf-kb-lift` 빈 문자열·스타일 규칙 없음 4개 실패, 의도한 이유.
- **GREEN**: 위 RED 가 모두 초록, 전체 vitest 3841 통과.
- **RED/GREEN (ChatPanel, `333d96c` → `00521e1`)**: mousedown 기본 동작이 막히지 않음(`expected true to be false`) → `onMouseDown` preventDefault.
- 한 가지 시험 도구 함정: 가짜 `requestAnimationFrame`은 `vi.setSystemTime` 뒤에 20ms 안에 돌지 않아(훅이 프레임마다 한 번 읽는 길) dayScene 시험에서 setSystemTime 을 쓰지 않았다.

## Files Created/Modified

- `src/screens/Lobby.tsx` — useKeyboardLift 배선, data-kb-open, compact, ActionRow 숨김, 스테이지 아래 getter
- `src/screens/RoomScreen.tsx` — useFixedRoomHeight(--mf-room-h)
- `src/screens/DayScene.tsx` — 채팅 패널 단계에서만 훅, 패널 --kb 클래스, 기록 칸 72
- `src/components/WorldStage.tsx` — D4 포커스 중 탭은 blur 만
- `src/components/v2/ChatPanel.tsx` — 보내기 mousedown 포커스 유지
- `src/styles/lobby.css`·`room.css`·`day.css` — 패널 --kb, vv-top translateY, --mf-room-h
- `test/client/lobby|worldStage|dayScene|roomScreen|chatPanel.test.tsx` — 위 동작의 시험
- `scripts/e2e/flows.mjs`·`browser.mjs` — chat-ime·chat-keyboard 흐름과 도우미

## Decisions Made

key-decisions 참조. 이 계획에서 결정 확인이 필요한 checkpoint:decision 은 없었다(사용자 위임에 따른 추천안 선택 없음).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 보내기 버튼 누르는 순간 포커스가 옮겨 가 키보드가 닫히고 클릭이 빗나감**
- **Found during:** Task 3 (chat-keyboard E2E 의 KB7~KB9)
- **Issue:** Chromium(과 Android)에서 버튼 mousedown 이 포커스를 가져가 입력칸이 blur → 키보드 닫힘 → 패널이 336px 내려가 손가락 밑 버튼이 사라져 mouseup 이 빗나감. 줄이 전송되지 않고 입력칸에 글자가 남았다. 합격 검사 6(보낸 뒤 포커스 유지, 패널 위치 불변) 위반.
- **Fix:** 보내기 버튼 `onMouseDown={(e) => e.preventDefault()}`. 클릭·제출은 그대로다.
- **Files modified:** src/components/v2/ChatPanel.tsx, test/client/chatPanel.test.tsx
- **Verification:** chatPanel 54/54, chat-keyboard 6종 전부 초록
- **Committed in:** `333d96c`(RED), `00521e1`(fix)

### 계획 파일 밖 추가

- **시험 추가**: `test/client/roomScreen.test.tsx`(--mf-room-h)·`test/client/chatPanel.test.tsx`(mousedown)는 계획의 files_modified 에 없지만 새 동작의 시험이라 더했다.
- **헤더 계열 이동을 data-kb-open 에 묶지 않음**: 계획 문구는 `.mf-root[data-kb-open] …` 였으나 재접속 띠가 로비 밖이라 변수(방 틀)에 묶었다. 포커스가 없으면 변수가 0 이라 동작은 같다.
- **E2E (b) 조합 중 보내기**: Playwright click 대신 `button.click()`(DOM)로 눌렀다. iOS 터치처럼 포커스를 옮기지 않아 "조합 중 제출" 경로(compositionend 대기)를 그대로 시험한다.
- **DayScene 위쪽 바 vv.offsetTop 이동**: UI-SPEC "헤더 계열은 보이는 영역 위쪽" 을 테이블 틀에도 맞추려 더했다(CSS 한 줄, 단위 시험은 문자열 계약).

---

**Total deviations:** 1 auto-fixed (Rule 1 버그) + 위 추가 4건
**Impact on plan:** 버그 수정은 합격 검사 6 에 필요했다. 범위 확장 없음.

## Issues Encountered

- chat-ime 두 번째 글이 첫 시도에서 서버 `CHAT_MIN_GAP_MS`(600ms) 거절로 돌려받아 입력칸이 남았다 — 글 사이 대기를 1000ms 로 늘렸다(하네스 대기 문제, 앱 결함 아님).
- `--only world` 의 360x560 실패(S4 목적지 없음)는 07-18 에 기록된 기존 실패 그대로다(다른 5개 크기 21/21). 이 계획의 변경과 무관하다.

## 확인 환경과 남은 몫

| 환경 | 이 계획에서 확인한 것 | 남은 것 |
| --- | --- | --- |
| Chromium(시스템 Chrome 헤드리스) 가짜 visualViewport K=336 | 로비 6종 크기 합격 검사 1·2·3·6 의 자동 몫 | — |
| Chromium CDP imeSetComposition | 합격 검사 4 의 자동 몫 | iPhone 필수(07-21) |
| 테이블 화면(DayScene) | 단위 시험(클래스·변수·자리 불변) | 가상 키보드 E2E 없음, 실기기 07-21 |
| iPhone Safari·iOS용 Chrome·Android·삼성 인터넷·카카오톡 인앱 | 없음 | 07-21 사람 확인(미확인은 합격으로 세지 않음) |

- 로컬 서버: 이 계획이 `npm run dev` 를 띄웠다(PID 50617). 마지막 검증 뒤 끄고 포트 5173 닫힘을 확인했다.
- 측정 시 참고: 이 세션 내내 이전 실행에서 남은 vitest 작업 프로세스 두 개(PID 17093·17098)가 CPU 를 쓰고 있었다. 이 계획은 fps·성능 측정을 하지 않았다.

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크 경로·인증·파일 접근·스키마 변경이 없다(T-07-48 IME 중복 제출은 chat-ime 으로, T-07-49 키보드 가림은 chat-keyboard 로 완화 확인).

## Next Phase Readiness

- 07-20(E2E 하네스 정리)이 가져갈 것: 기존 deferred 항목(world 360x560 목적지, 옛 낮 화면 흐름 단언) 그대로. 이 계획의 두 흐름은 옛 도우미를 쓰지 않는다.
- 07-21(사람 확인)이 볼 것: 위 표의 남은 몫과 UI-SPEC "검사 실패 때 내리는 순서"(1단계 innerHeight 변화 대체 등).

---
*Phase: 07-free-chat*
*Completed: 2026-11-02*

## Self-Check: PASSED

- 만든·고친 파일 15개 모두 존재, 커밋 8개(`92c6f70` `6ba7d13` `b28bb99` `afda7f9` `8f71691` `333d96c` `00521e1` `3b9eaf4`) 모두 HEAD 의 조상.
- 모든 acceptance 재실행 통과(grep 기준선, window.scrollTo 0건, .skip/.todo 0건), `npx vitest run` 3841 통과, `npm run typecheck` 0, `npx vite build` 성공, `npm run e2e --only chat`(chat-lobby·chat-table·chat-ghost·chat-ime·chat-keyboard) 전부 통과.
