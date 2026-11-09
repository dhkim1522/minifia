---
phase: 17-tutorial-first-case
plan: "07"
subsystem: tutorial-together
tags: [tutorial, lobby, host-switch, room-screen, wait-screen, tdd, tracer, e2e-copy]
status: complete

requires:
  - phase: 17-01
    provides: start.tutorial·tutorialDone 메시지, view.tutorial·me.tutorialDone 타입, TUTORIAL_MS
  - phase: 17-04
    provides: TutorialScreen({ mode: "together", onEnd })
  - phase: 17-12
    provides: tutorial 단계 view 에 view.tutorial·me.tutorialDone 싣기
provides:
  - "TutorialToggle: 방장 대기실 [시작] 위 스위치 줄(role=switch), Lobby 로컬 상태가 [시작] 순간 { t: start, tutorial } 로 간다"
  - "RoomScreen tutorial 분기: TutorialScreen(together) → onEnd 에서 끝났음 연결 번호당 한 번 → TutorialWait, 재접속은 me.tutorialDone 으로 분기"
  - "TutorialWait: 사람 원·n / N·시간 막대(role=timer)·팁 두 장(남는 높이 모자라면 통째로 숨김)"
  - "tutorial 단계에서 실제 HostBand·HostDock·방 화면 useSound 끔, hostChimeOf 의 tutorial 거짓 규칙"
  - "LOBBY_HOST_TUTORIAL_EXTRA 76 (앱·E2E 사본·chat-lobby CP1 판정 같음), VIEW_TOP_KEYS·VIEW_ME_KEYS 사본 갱신, bots.mjs tutorial 끝났음"
affects: [17-08, 17-09, 17-10]

actuals:
  tokens: 10326
  tasks: 3
  commits: 6
plan_head_before: a5cded898ca797e50edadac8b622e197063be6a3
plan_head_after: a142012e05fb39545f051ba5ddc6083e3ce505b8

tech-stack:
  added: []
  patterns:
    - "방 화면 로컬 끝남 표시는 ref(같은 프레임 중복 방지) + state(다시 그리기) 쌍이고 연결 번호(epoch)로 비교하며 tutorial 단계를 벗어나면 비운다"
    - "팁 묶음은 루트 clientHeight − 아래 여백 − (카드 offsetTop + offsetHeight) 가 96 + 24 이상일 때만 그린다 — 그리기 전(useLayoutEffect)에 재서 깜빡임이 없다"
    - "E2E 낮은 폰 알려진 한계는 SHORT_PHONE_H 로 갈라 판정 문턱은 그대로 두고 건너뛴 단계를 infoRow 로 남긴다"

key-files:
  created:
    - src/components/v2/TutorialToggle.tsx
    - src/components/v2/TutorialWait.tsx
    - src/styles/tutorialRoom.css
    - test/client/tutorialWait.test.tsx
    - test/client/tutorialTogether.test.tsx
  modified:
    - src/screens/Lobby.tsx
    - src/screens/RoomScreen.tsx
    - src/game/hostLine.ts
    - src/game/chatUi.ts
    - scripts/bots.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/flows.mjs
    - test/client/lobby.test.tsx
    - test/unit/hostLine.test.ts
    - test/unit/e2eContract.test.ts
    - test/unit/view.test.ts

key-decisions:
  - "스위치는 화면 로컬 상태이고 서버로 아무것도 보내지 않는다 — 값은 [시작] 순간 start 메시지로만 간다(0080-1). 켬 초기값은 (round ?? 1) === 1 && !me.testMode"
  - "끝났음은 RoomScreen 의 ref 로 연결 번호당 한 번만 보내고(같은 프레임에 [다음]·[건너뛰기]가 겹쳐도 한 번), send 가 false 면 기다림으로 가지 않고 다시 누르면 다시 보낸다"
  - "로컬 끝남 표시는 tutorial 단계를 벗어나면 비운다 — 같은 연결에서 다음 판이 다시 튜토리얼을 거쳐도 기다림 화면으로 바로 가지 않는다(계획에 없던 보강)"
  - "기다림 화면의 '사라질 때 dur-fast 불투명도'는 따로 만들지 않았다 — 서버가 단계를 바꾸면 RoomScreen 이 다음 화면으로 바로 바꾸고 다음 화면의 phase-enter(300ms) 가 전환을 맡는다. 퇴장 연출 하나 때문에 직전 view 를 붙들어 두는 장치를 더하지 않았다"
  - "사람 원이 8개를 넘으면(9명 이상) 원은 8개로 자르고 끝낸 수는 같은 비율로 줄여 그린다. 정확한 값은 n / N 글자와 aria-label 이 말한다"
  - "world E2E 360x560: 방장 패널이 326 이 되어 방장 스테이지가 172 로 줄어 두 화면에 보이는 목적지가 없다 — 이 크기에서만 목적지를 손님 화면에서 고르고 방장이 같은 점으로 걷는 겹침 단계를 건너뛰어 infoRow 로 남긴다(UI Considerations #24 알려진 한계, 판정 문턱 불변)"
  - "개발용 봇 스크립트는 tutorial 단계에서 1~3초 뒤 끝났음을 한 번 보낸다(사람처럼 즉시 보내지 않음), 판이 바뀌면(lobby·assigning) 표시를 비운다"

requirements-completed: []

duration: 15 min
completed: 2026-11-09
---

# Phase 17 Plan 07: 함께 진행 방 화면 Summary

방장이 대기실 [시작] 위 스위치 줄(첫 판 켜짐)로 '튜토리얼 후 진행'을 고르면 start 메시지에 값이 실리고, 켜면 모두의 방 화면이 첫 사건 화면(함께 모드)을 거쳐 끝났음 메시지를 연결 번호당 한 번만 보낸 뒤 n / N·사람 원·시간 막대 기다림 화면에서 서버가 역할 배정으로 넘길 때까지 기다린다.

## Accomplishments

- **방장 스위치 줄(Task 1)**: `TutorialToggle` — 줄 전체가 `button[role=switch][data-tutorial-toggle]`(높이 64, 아이콘 타일 40 + 두 줄 + 48×28 스위치). Lobby 가 방장·키보드 닫힘일 때만 [시작] 바로 위에 그린다. 연결이 끊기거나 [시작] 잠금 중이면 disabled. 값은 Lobby 로컬 `useState`, 서버 방송 없음(T-17-16).
- **tutorial 단계 분기(Task 1)**: `renderPhase` 의 `case "tutorial"` — `me.tutorialDone` 이거나 이 연결에서 보냈으면 `TutorialWait`, 아니면 `TutorialScreen mode="together"`. `onEnd` 가 부르는 `sendTutorialDone` 이 `connection.send({ t: "tutorialDone" })` 의 유일한 호출처이고 ref 로 epoch 당 한 번을 지킨다(T-17-17).
- **기다림 화면(Task 2)**: 사람 원(최대 8, 6명 이상 두 줄), `n / N`(`data-tutorial-count`), 막대 + `n초`(`role=timer`, `useCountdown(endsAt, TUTORIAL_MS)`), 팁 두 장(남는 높이가 96 + 24 보다 작으면 통째로 숨김). 재접속(T-20)은 연결 번호가 바뀌면 로컬 표시가 어긋나 서버 값(me.tutorialDone)만 따른다.
- **띠·알림음·소리 소유(Task 2)**: tutorial 단계에서 RoomScreen 은 HostBand·HostDock 을 그리지 않고 `useSound({ active })` 를 끈다(첫 사건 화면의 useSound 하나만 받는다). `hostChimeOf` 는 tutorial 로 들어가고 나오는 전환에서 거짓.
- **+76 사본(Task 3)**: `LOBBY_HOST_TUTORIAL_EXTRA = 76`, `lobbyPanelHeight(logH, host)` 로 방장 326/382. E2E lib 사본·lib.test·e2eContract 대조, chat-lobby CP1 은 방장 페이지에서 +76. `VIEW_TOP_KEYS` += tutorial, `VIEW_ME_KEYS` += tutorialDone (view.test 의 TOP_KEYS·ME_KEYS 와 같은 집합), view.test 에 tutorial 단계 전수 키 시험.
- **개발용 봇**: `scripts/bots.mjs` 가 tutorial 단계에서 me.tutorialDone 이 없을 때만 끝났음 한 번.

## Task Commits

1. **Task 1 RED:** `1ce76961` — `test(17-07): 함께 진행 화면 트레이서 실패 시험`
2. **Task 1 GREEN (tracer):** `4753ab4c` — `feat(17-07): 방장 스위치·함께 진행 분기·끝났음 한 번`
3. **Task 2 RED:** `e9839277` — `test(17-07): 기다림 화면·띠/알림음·재접속 실패 시험`
4. **Task 2 GREEN:** `9ec3a39f` — `feat(17-07): 기다림 화면·재접속 분기·튜토리얼 단계 띠·소리 정리`
5. **Task 3 RED:** `7347348a` — `test(17-07): 방장 패널 +76·view 키 사본 실패 시험`
6. **Task 3 GREEN + E2E:** `a142012e` — `test(17-07): 방장 패널 +76 사본·E2E 판정`

## TDD Gate Compliance

- **Task 1 RED** (`1ce76961`): `npx vitest run test/client/lobby.test.tsx test/client/tutorialTogether.test.tsx` — 15개 실패(스위치 초기값·role·start 메시지 `{ tutorial }` 모양·키보드 숨김, tutorial 단계가 연결 중… 화면이라 `[data-tutorial-screen]` 없음). 기존 `{ t: "start" }` 단언 세 곳은 `{ t: "start", tutorial: true }` 로 고쳐 RED 에 포함했다.
- **Task 1 GREEN:** lobby·tutorialTogether·errandScreen·tutorialStaticGuard 162개 통과, typecheck 0.
- **트레이서 게이트:** 자동 모드가 아니고 `<verify>` 가 자동 항목뿐이라 재실행해 통과를 확인하고 `Tracer verified end-to-end — expanding` 으로 Task 2 에 들어갔다.
- **Task 2 RED** (`e9839277`): tutorialWait 6개·hostLine 1개·tutorialTogether 1개 실패(`TutorialWait` 원·시간·팁 없음, `hostChimeOf("lobby","tutorial")` 가 참, tutorial 단계에 실제 띠 존재). 재접속·다음 판 분기 시험은 Task 1 구현이 이미 만족해 특성 시험으로 통과 상태로 들어갔다.
- **Task 2 GREEN:** tutorialWait·tutorialTogether·hostLine·hostBand·useSound 185개 통과, `node --check scripts/bots.mjs` 통과, typecheck 0.
- **Task 3 RED** (`7347348a`): e2eContract 2개 실패(방장 패널 326 기대·VIEW 키 집합 차이), `lib.test.mjs` 는 `LOBBY_HOST_TUTORIAL_EXTRA` 내보내기 없음으로 파일 전체가 SyntaxError.
- **Task 3 GREEN:** e2eContract·view 192개 통과, `node --test scripts/e2e/lib.test.mjs` 387 통과, typecheck 0, `npm test` 전체 통과(277 파일 통과·6 건너뜀, 7896 시험).
- REFACTOR: 없음.

## 로컬 E2E 결과 (바뀐 대기실 흐름만, `npm run dev` 로 띄운 http://localhost:5173)

`npm run e2e -- --url http://localhost:5173 --only lobby,world,map-select,chat-keyboard` (--only 부분 문자열이라 chat-lobby 포함) 후 world 360x560 만 재실행.

| 흐름 | 360x640 | 390x664 | 430x932 | 360x560 | 390x844 | 402x874 |
|------|---------|---------|---------|---------|---------|---------|
| lobby | 40/40 | 40/40 | 40/40 | 39/39 | 40/40 | 40/40 |
| chat-lobby (방장 CP1 = 기록 + 154 + 76) | 23/23 | 23/23 | 23/23 | 23/23 | 23/23 | 23/23 |
| world | 23/23 | 23/23 | 23/23 | 21/21 (재실행, 아래 참고) | 23/23 | 23/23 |
| map-select | 51/51 | 51/51 | 51/51 | 51/51 | 51/51 | 51/51 |
| chat-keyboard | 22/22 | 22/22 | 23/23 | 22/22 | 23/23 | 23/23 |

- 첫 실행에서 `world/setup · 360x560 · S4` 가 `탭할 목적지를 찾지 못함(두 화면에 보이는 칸 2개, 1.5 단위 이상 먼 칸 0개)` 로 실패했다. 원인은 방장 패널 +76 으로 360×560 방장 스테이지가 248 → 172 로 줄어든 것이라 계획대로 알려진 한계(UI Considerations #24)다. 판정 문턱은 건드리지 않고 이 크기에서만 목적지 선택을 손님 화면으로 한정하고 방장이 같은 점으로 걷는 겹침 단계(NT3)를 건너뛰어 infoRow 로 남겼다(`fix` 가 아니라 Task 3 커밋에 포함). 재실행 21/21 통과.
- 다른 흐름은 테스트 방(me.testMode)을 쓰므로 스위치 초기값이 꺼짐이라 [시작] 이 곧장 역할 배정으로 간다 — 이 네 흐름에서 튜토리얼로 새지 않음을 확인했다.
- 개발 서버는 끝낸 뒤 껐다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - 누락 보강] 같은 연결에서 다음 판이 튜토리얼을 다시 거치면 기다림 화면으로 바로 가는 문제**
- **Found during:** Task 2 시험 설계(재접속 분기 점검)
- **Issue:** `tutorialSentEpoch === epoch` 비교만 있으면 같은 연결(epoch 불변)에서 다시 하기 뒤 튜토리얼이 또 열릴 때 지난 판의 끝남 표시가 남아 장면 1 을 건너뛴다.
- **Fix:** tutorial 단계를 벗어나면 ref·state 를 비운다. 시험 한 개("같은 연결에서 다음 판이 다시 tutorial 을 거치면…")로 고정.
- **Files modified:** src/screens/RoomScreen.tsx, test/client/tutorialTogether.test.tsx
- **Commit:** 4753ab4c

**2. [Rule 3 - 막힘] world E2E 360x560 설정 단계가 방장 스테이지 축소로 실패**
- **Found during:** Task 3 로컬 E2E
- **Issue:** 위 표 설명 참고. 계획이 알려진 한계로 둔 겹침이 E2E 의 두 화면 공통 목적지 선택을 막았다.
- **Fix:** `SHORT_PHONE_H` 미만에서만 목적지 선택·방장 겹침 단계를 방장 화면 조건에서 풀고 infoRow 로 기록. 손님 쪽 걷기·동기 판정은 그대로.
- **Files modified:** scripts/e2e/flows.mjs
- **Commit:** a142012e

### 계획과 다르게 정한 곳

- 기다림 화면 퇴장 불투명도(`dur-fast`)는 별도로 구현하지 않았다(key-decisions 참고). 다음 화면의 phase-enter 가 전환을 맡는다.
- 계획의 test 파일 목록에 있던 `test/client/errandScreen.test.tsx` 는 수정 없이 회귀로만 돌렸다. 기존 lobby 키보드 시험의 행동 줄 개수 선택자는 스위치 단추를 제외하도록 고쳤다(`:not([data-tutorial-toggle])`).

## Known Stubs

없음. 팁 두 장·화면 문구는 고정 문자열이고 모든 값은 서버 공개 값(view.tutorial)에서 온다.

## 이월 메모 (다음 계획·실테스트용)

- **17-10 회귀**: 일반 방(테스트 방 아님) 첫 판에서 방장이 [시작]을 누르면 이제 기본이 튜토리얼이다. `scripts/e2e/browser.mjs` 의 `startGame` 은 [시작]만 누르므로 일반 방을 쓰는 흐름이 있으면 스위치를 끄고 시작하거나 17-09 가 만드는 tutorial-together 흐름에서 켜야 한다. 이번에 돈 네 흐름은 모두 테스트 방이라 영향 없음을 확인했다. 전체 6종 회귀에서 다른 흐름도 같은지 한 번 본다.
- **360×560 방장 대기실**: 패널 326 으로 스테이지 172(알려진 한계 #24). world 흐름의 방장 겹침 단계는 이 크기에서 건너뛴다.
- 실기기에서 기다림 화면의 팁 숨김 경계(남는 높이)와 스위치 줄의 누르기 감을 한 번 본다(실기기 검사는 끝에 몰아서).

## Threat Flags

없음. 새 네트워크 경로·인증·파일 접근은 없다. T-17-15(손님 start.tutorial)는 서버 checkStart 와 손님에게 스위치를 그리지 않는 시험으로, T-17-16(값 방송 없음)은 `send` 호출 0 시험으로, T-17-17(끝났음 외 send 0)은 tutorialTogether 시험으로 덮었다.

## Self-Check: PASSED

- 생성 파일 존재: TutorialToggle.tsx, TutorialWait.tsx, tutorialRoom.css, tutorialWait.test.tsx, tutorialTogether.test.tsx — FOUND
- 커밋 존재(1ce76961, 4753ab4c, e9839277, 9ec3a39f, 7347348a, a142012e) — FOUND
- `git rev-list --count a5cded89..HEAD` = 6 (frontmatter `commits: 6` 과 같음)
