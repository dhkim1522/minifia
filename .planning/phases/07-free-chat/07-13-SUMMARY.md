---
phase: 07-free-chat
plan: "13"
subsystem: client-chat-lobby
tags: [chat, lobby, useChat, ChatStore, ChatPanel, e2e, tracer, tdd, react-hooks]

requires:
  - phase: 07-free-chat
    provides: "07-03 ChatPanel·chatUi·CHAT_TEXT, 07-05 ChatStore·useChatLogHeight, 07-11 chat 와이어(ChatSendMessage·chatReject·chatLog)·phaseKey"
provides:
  - "src/net/useChat.ts: ChatStore·연결·view 를 ChatPanel 속성(messages·value·onSend·channel·sendDisabled·sendDim·notice·quiet)으로 잇는 훅"
  - "RoomScreen: ChatStore 를 연결과 같은 수명으로 만들어 chat·typing·chatLog·chatReject 를 구독하고 view 마다 setContext, 대기실 복귀 때 reset"
  - "Lobby: 아래 패널이 채팅 기록 + 입력줄 + 행동 줄로 바뀜(LOG_H + 154), 입장·퇴장이 기록 칸 시스템 줄로도 남음"
  - "E2E chat-lobby 흐름(6종 크기)과 도우미 typeAndSendChat·readChatLines·waitChatLine·readChatPanel"
affects: [07-14, 07-15, 07-18, 07-19, 07-21]

actuals:
  tokens: 15450
  tasks: 3
  commits: 5
  plan_head_before: 20fb1da5d2b94186431aa52cda7d0938d95dfa13
  plan_head_after: 5194e405cbba8a597a2e39621ff4a7fe72f3d688

tech-stack:
  added: []
  patterns:
    - "시간이 걸리는 화면 상태(보내기 흐림·막힘 알림 수명)는 훅이 쥐고, 저장소는 시각을 읽지 않는다(07-05 A2)"
    - "서버가 보낸 줄만 그린다 — 보낸 폰도 방송이 돌아온 뒤 '나' 로 나타난다(낙관적 표시 없음)"
    - "보내는 메시지는 본문과 pk 뿐, 채널 필드는 grep 게이트로 막는다"
    - "E2E 치수 판정은 UI-SPEC 표 값을 flows.mjs 에 사본으로 두고 DOM 측정과 견준다"

key-files:
  created:
    - src/net/useChat.ts
    - test/client/useChat.test.tsx
  modified:
    - src/screens/RoomScreen.tsx
    - src/screens/Lobby.tsx
    - src/styles/lobby.css
    - test/client/lobby.test.tsx
    - test/client/roomScreen.test.tsx
    - test/client/useRoomConnection.test.tsx
    - scripts/e2e/flows.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/lib.test.mjs

key-decisions:
  - "useChat 은 줄 앞 이름을 지금 방 사람의 닉네임으로 쓰고, 떠난 사람의 줄은 마지막으로 본 닉네임을 쓴다(ref 기억). 자리가 다른 사람으로 다시 쓰이면 옛 줄 이름이 새 사람으로 보일 수 있으나 로비 짧은 기록에서 감수한다"
  - "send 가 false 를 돌려주면(소켓이 막 닫힘) ChatPanel 이 이어서 칸을 비우므로, 마이크로태스크로 비어 있을 때만 보낸 글을 되돌린다 — 쓴 글이 사라지지 않게"
  - "입장·퇴장 시스템 줄은 diff.joined·diff.left 의 모든 항목에 만든다(토스트는 마지막 한 명뿐). 재접속 띠가 떠 있어도 기록은 남기고, epoch 가 바뀐 첫 view 는 prevView 가 비어 자연히 만들어지지 않는다"
  - "대기실 복귀 판정은 '직전 단계가 lobby 가 아니고 지금 lobby'(A2). reset 효과를 setContext 효과보다 먼저 선언해 같은 커밋에서 비운 뒤 문맥을 넣는다"

patterns-established:
  - "RoomScreen 이 연결 구독 하나로 world 와 채팅 프레임을 나눠 먹인다(구독 수 1 유지)"
  - "채팅 시스템 줄과 위 알림(TopToast)이 같은 문구 출처(CHAT_TEXT.joined·left)를 쓴다"

requirements-completed: [CHAT-01, CHAT-05]

coverage:
  - id: D1
    description: "로비에서 손님이 보낸 한 줄이 실제 브라우저 두 개의 기록 칸에 한 번씩 나타나고, 손님 쪽 이름 '나'·방장 쪽 이름 손님 닉네임·채널 all·보낸 자리가 맞으며 보낸 입력칸이 비워진다"
    requirement: "CHAT-01"
    verification:
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 --only chat-lobby (CL1~CL5, 6종 크기 120/120)"
        status: pass
    human_judgment: false
  - id: D2
    description: "로비 패널이 6종 폰 크기에서 UI-SPEC 치수대로 선다: 패널 250/306, 기록 96/152, 입력칸·보내기 48, 입력칸 글자 16px, 보내기 누르기 44 이상, 스테이지 아래 끝 = 방 높이 − 패널; G 공통 검사 통과"
    requirement: "CHAT-01"
    verification:
      - kind: e2e
        ref: "chat-lobby CP1~CP6 + G (방장·손님 두 화면)"
        status: pass
      - kind: unit
        ref: "test/client/lobby.test.tsx#Lobby — 채팅 패널 / 아래 패널 안쪽 여백 (LOBBY_PANEL_EXTRA)"
        status: pass
    human_judgment: true
    rationale: "스테이지 사각형 아래 끝은 DOM(패널 위 끝)으로 잰다 — 카메라가 실제로 그 사각형에 맞는지(캐릭터 위치)는 기존 6페이즈 ownTagInStage 검사와 07-21 실기기 확인 몫"
  - id: D3
    description: "보내기 흐림 600ms(입력은 계속), 거절 알림 2.5초와 이유 다섯 문구, 입력칸이 비었을 때만 글 되돌리기, 거절 시 흐림 해제, 새 알림이 이전 알림을 교체"
    requirement: "CHAT-05"
    verification:
      - kind: unit
        ref: "test/client/useChat.test.tsx#useChat: 보내기 흐림 / 막힘 알림과 되돌리기"
        status: pass
    human_judgment: false
  - id: D4
    description: "연결 끊김(재접속 띠)에서 입력칸은 쓸 수 있고 보내기만 aria-disabled, 받은 줄 유지; 복원(chatLog) 직후 quiet(점·알림·입장 기록 없음)"
    requirement: "CHAT-05"
    verification:
      - kind: unit
        ref: "test/client/useChat.test.tsx#useChat: 연결 끊김과 복원; test/client/lobby.test.tsx#재접속 띠가 떠 있어도 입력칸은 쓸 수 있고"
        status: pass
    human_judgment: false
  - id: D5
    description: "RoomScreen 이 ChatStore 를 연결과 같은 수명으로 두고 한 구독으로 chat·chatLog·chatReject 를 먹이며, 대기실 복귀 때만 비운다(같은 판 대기실→대기실은 유지)"
    requirement: "CHAT-01"
    verification:
      - kind: unit
        ref: "test/client/roomScreen.test.tsx#RoomScreen: 채팅 저장소 연결"
        status: pass
    human_judgment: false
  - id: D6
    description: "로비 입장·퇴장이 위 알림과 같은 문구로 기록 칸 시스템 줄에 남고, 재연결 첫 상태·방장 변경에서는 만들지 않으며 StrictMode 에서 한 번만 남는다"
    requirement: "CHAT-01"
    verification:
      - kind: unit
        ref: "test/client/lobby.test.tsx#Lobby — 채팅 패널 (입장·퇴장 시스템 줄)"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-11-01
status: complete
---

# Phase 7 Plan 13: 로비 자유 채팅 연결 Summary

**RoomScreen 의 ChatStore 와 useChat 훅으로 로비 아래 패널을 기록 + 입력줄 + 행동 줄로 바꾸고, 600ms 보내기 흐림·2.5초 막힘 알림·글 되돌리기·입퇴장 시스템 줄을 갖춰 실제 브라우저 두 개 사이에 한 줄이 오가는 chat-lobby E2E 를 6종 폰 크기에서 통과시켰다**

## Performance

- **Duration:** 약 8분
- **Started:** 2026-11-01T14:34:01Z
- **Completed:** 2026-11-01T14:42Z
- **Tasks:** 3 (트레이서 1 + auto TDD 1 + auto 1)
- **Files modified:** 11 (신규 2, 수정 9)

## Accomplishments

- `useChat({ store, connection, view })`: `useSyncExternalStore` 로 저장소 변화를 받아 `visibleLines(view.me.chat)` 를 ChatPanel 줄로 바꾼다. 사람 줄 이름은 방 사람의 닉네임, 내 자리면 `me`(ChatPanel 이 '나' 로 그림). 보내기는 `connection.canSend` 일 때만 `{ t: "chat", text, pk: phaseKey(...) }` 를 보내고 채널 필드는 없다.
- `RoomScreen`: `new ChatStore()` 를 WorldStore 옆에 두고 같은 `onEvent` 구독 하나로 `chat`·`typing`·`chatLog`·`chatReject` 를 `Date.now()` 와 함께 먹인다. view·epoch 가 바뀔 때마다 `setContext({ pk, channel, epoch })`, 직전 단계가 대기실이 아니고 지금 대기실이면 `chat.reset()`.
- `Lobby`: 패널 안에 `ChatPanel`(+`useChatLogHeight` 로 정한 기록 칸 높이) 위, 기존 ActionRow 아래. 패널 높이는 기존 ResizeObserver 측정이 `stageInsets.bottom` 으로 넘겨 스테이지 사각형이 따라간다.
- 보내기 흐림(SEND_DIM_MS), 서버 거절 알림(2.5초, `role="status"`, 기록 칸 맨 아래)과 입력칸이 비었을 때만 글 되돌리기, 거절 시 흐림 즉시 해제, 연결 끊김에서 보내기만 막힘, 복원 직후 `quiet`.
- 입장·퇴장은 위 알림과 같은 문구로 기록 칸 시스템 줄에도 남는다(한 번에 여러 명이면 모두). 방장 변경은 남기지 않는다(A1).
- E2E `chat-lobby`: 방장·손님 두 페이지, 손님이 "안녕하세요" 를 보내면 두 기록 칸에 한 번씩(CL1~CL5), 이어서 패널 치수 6항목(CP1~CP6)과 G 공통 검사. 6종 크기로 돈다.

## Task Commits

1. **Task 1 (tracer): 로비 한 줄이 서버를 지나 방장 화면에 보인다** — `2c3875e` (feat). 트레이서 게이트(`human_verify_mode=end-of-phase`, 자동 검증만): `<verify>` 의 E2E(390x664)·vitest 재실행 통과 → "Tracer verified end-to-end — expanding".
2. **Task 2: useChat 마무리** — `8f4b334` (test, RED) → `5c47581` (feat, GREEN) → `3c90520` (test, 타입 검사용 보정)
3. **Task 3: 로비 패널 크기 6종 E2E** — `5194e40` (test)

**Plan metadata:** 이 SUMMARY 와 STATE·ROADMAP·REQUIREMENTS 갱신 커밋(docs)이 따른다.

## TDD Gate Compliance

Task 2 는 RED(`test(07-13)`) → GREEN(`feat(07-13)`) 순서다. REFACTOR 커밋은 없다(정리할 변경 없음).

- RED 대상: `test/client/useChat.test.tsx > useChat: 막힘 알림과 되돌리기 (CHAT-05) > 거절되면 입력칸이 비어 있을 때 마지막 보낸 글이 되돌아온다` — `gsd check tdd-red-evidence` 가 `RED_EVIDENCE_OK`(reason `target_test_failed`)
- RED 의미 평가(semanticAssessment): 시험이 실제로 돌았고(18개 중 대상 1개 실행, `-t`) 훅이 거절 이벤트를 모르는 Task 1 구현이라 `expected '' to be '같은 말'` 단언에서 실패했다. 구문·로드·픽스처 오류가 아니라 계획한 이유로 실패. 전체 RED 는 13건 실패(useChat 6, 로비 입퇴장 6, RoomScreen 알림 1), 나머지 114건은 통과.
- 예외: 계획 RED 목록의 "discussion → lobby 에서 `chat.reset()`" 과 "가짜 소켓 chat 프레임이 store 에 들어간다" 시험은 RED 시점에 이미 통과했다. RoomScreen 의 구독·reset·setContext 연결을 Task 1 트레이서(화면까지 한 길로 잇는 일)에서 함께 넣었기 때문이다. 시험은 Task 2 에서 추가해 고정했다. 사이클 의미는 훼손되지 않았다(훅의 시간 상태·로비 시스템 줄은 RED 에서 실제로 실패).
- `3c90520`: RED 시험의 `vi.fn(() => true)` 가 `mock.calls[0]` 타입 오류를 내 타입 검사를 막아 `(_msg: ClientMessage) => true` 로 보정했다(동작 변경 없음).

## Files Created/Modified

- `src/net/useChat.ts` — 신규. ChatBinding·ChatConnection·useChat
- `src/screens/RoomScreen.tsx` — ChatStore 생성·구독·setContext·대기실 복귀 reset, Lobby 에 `chat` 전달
- `src/screens/Lobby.tsx` — `chat` 속성, 패널의 ChatPanel, 입퇴장 시스템 줄
- `src/styles/lobby.css` — 패널 주석 갱신(LOG_H + 154). 규칙 값은 6페이즈 그대로 14/16/22·gap 10 을 유지
- `test/client/useChat.test.tsx` — 신규, 훅 시험 18건
- `test/client/lobby.test.tsx`·`roomScreen.test.tsx`·`useRoomConnection.test.tsx` — 채팅 시험 추가, `chat` 속성 주입, 알림 단언을 TopToast 로 좁힘
- `scripts/e2e/flows.mjs`·`browser.mjs` — chat-lobby 흐름, 도우미 4개, 패널 치수 판정
- `scripts/e2e/lib.test.mjs` — extraSizes 흐름 목록에 chat-lobby 추가

## Decisions Made

- 위 key-decisions 4건. 특히 입퇴장 시스템 줄은 토스트와 달리 diff 의 모든 항목에 만든다.
- 로컬 개발 서버: 이 계획이 `npm run dev` 를 띄웠다(PID 15392, 처음엔 5173 이 응답하지 않았다). 마지막 검증 뒤 그 PID 와 자식 프로세스를 끝냈고 5173 응답 없음을 확인했다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lobby 를 직접 그리는 기존 시험이 새 필수 속성 `chat` 때문에 깨짐**
- **Found during:** Task 1 (타입 검사·기존 시험)
- **Issue:** `Lobby` 가 `chat: ChatStore` 를 필수로 받게 되어 `lobby.test.tsx` 의 헬퍼와 `useRoomConnection.test.tsx` 의 Harness 가 타입·동작 오류. 손님 행동 줄 시험은 패널 안 버튼 수를 1 로 세어 보내기 버튼(2) 때문에 실패, 패널 높이 시험은 옛 88 을 기대
- **Fix:** 헬퍼에 시험마다 새로 만드는 ChatStore 를 주입, 버튼 수 단언은 `button:not([data-chat-send])` 로, 높이 시험은 `LOBBY_PANEL_EXTRA` 와 견주도록 갱신
- **Files modified:** test/client/lobby.test.tsx, test/client/useRoomConnection.test.tsx
- **Verification:** client·unit 전체 119 파일 통과
- **Committed in:** 2c3875e

**2. [Rule 3 - Blocking] 알림 단언이 같은 문구의 기록 시스템 줄과 겹침**
- **Found during:** Task 2 GREEN (전체 client 실행)
- **Issue:** `useRoomConnection.test.tsx` 의 "지아 님 입장" 단언이 문서 전체에서 글을 찾아 TopToast 와 기록 칸 시스템 줄 두 곳에 걸림(같은 문구를 쓰는 것은 계획 요구). 띠가 떠 있을 때 알림이 없다는 단언도 기록 줄을 알림으로 읽음
- **Fix:** 두 시험이 `.mv-toast__text` 만 읽도록 좁힘(의미는 "알림이 뜬다/안 뜬다" 그대로)
- **Files modified:** test/client/useRoomConnection.test.tsx
- **Committed in:** 5c47581

**3. [Rule 3 - Blocking] scripts/e2e/lib.test.mjs 의 extraSizes 흐름 목록 시험**
- **Found during:** Task 3 (계획 파일 목록에 없음)
- **Issue:** 이 시험이 `extraSizes: LOBBY_EXTRA_SIZES` 를 가진 FLOWS 항목을 `["lobby","world"]` 로 고정해 chat-lobby 에 extraSizes 를 주면(계획 Task 3) 스크립트 단위 시험이 실패
- **Fix:** 기대 목록을 `["lobby","world","chat-lobby"]` 로, 제목 갱신
- **Files modified:** scripts/e2e/lib.test.mjs
- **Committed in:** 5194e40

**4. [Rule 2 - Missing critical] 소켓이 막 닫혀 못 보낸 글 보존**
- **Found during:** Task 2 구현 (UI-SPEC "쓴 글이 사라지지 않게")
- **Issue:** `send` 가 `false` 를 돌려주면 ChatPanel 이 그래도 칸을 비워 글이 사라진다
- **Fix:** 못 보낸 경우 보내기 흐림·마지막 보낸 글 갱신을 건너뛰고 마이크로태스크로 비어 있을 때 글을 되돌림
- **Files modified:** src/net/useChat.ts
- **Committed in:** 5c47581 (전용 시험은 없음 — `canSend` 거짓 경로는 시험됨, `send()===false` 경합은 happy-dom 에서 재현이 어려워 코드 검토로 둠)

---

**Total deviations:** 4 auto-fixed (Rule 3 셋, Rule 2 하나)
**Impact on plan:** 범위 확장 없음. lib.test.mjs 한 파일이 계획 파일 목록 밖이다.

## Issues Encountered

- `gsd check tdd-red-evidence` 는 증거 JSON 이 프로젝트 디렉토리 밖이면 거부해(`path escapes its allowed directory`) 임시 파일을 `.planning/` 에 잠깐 두고 지웠다. 대상 이름은 `tap-flat` 이 내는 `파일 > 묶음 > 시험` 전체 이름이어야 했다.
- 계획 `estimate.tokens` 75000 대비 실제 변경량은 chars/4 약 15450 이다(훅·연결이 기존 부품 위에 얇게 얹혀 예상보다 작았다).

## User Setup Required

None - no external service configuration required.

## Known Stubs

없음. 이 계획이 만든 값은 모두 서버 프레임·view·연결 상태에서 온다.

## Threat Flags

없음. 새 네트워크 경로·인증·파일 접근 없음. T-07-32(렌더 변조)는 useChat 이 문자열을 가공하지 않고 ChatPanel 텍스트 노드 규칙 그대로 넘기는 것으로, T-07-33(보내는 메시지 스푸핑)은 채널 필드를 보내지 않는 grep 게이트와 시험(`JSON.stringify` 정확히 `{t,text,pk}`)으로, T-07-34(연타)는 600ms 흐림으로 완화했고 서버 D5 가 최종 판정이다. T-07-SC: 패키지 설치 없음.

## Next Phase Readiness

- 07-14 는 서버 저장·복원(`chatLog` seq)이라 이 화면 연결과 독립이다. 07-15(테이블 화면)는 `useChat`·`RoomScreen` 의 `chat` 을 DayScene 에 넘기면 된다 — 훅은 단계 키를 view 에서 읽어 로비 밖에서도 그대로 쓴다.
- 07-18(입력 중)·07-19(키보드 `compact`·`inputId`·포커스 훅)는 `ChatBinding` 이 의도적으로 빼 둔 속성(`compact`, `onInputFocus`·`onInputBlur`·`onComposingChange`)을 화면 틀에서 붙이면 된다.
- 남은 위험: 실제 한글 조합과 iOS 키보드는 이 계획의 E2E(`fill`)가 만들지 않는다 — 07-19(Chromium CDP)·07-21(iPhone 실기기) 몫. E2E 의 패널 치수 판정은 DOM 기준이고 카메라 안착은 기존 ownTagInStage 검사가 본다.
- 개발용 스크립트(`scripts/bots.mjs` 등)와 프레임 단위 옛 E2E 의 옛 채팅 사용은 `deferred-items.md` 에 이미 적힌 대로 남아 있다(이 계획의 chat-lobby 는 새 길만 쓴다).

## Self-Check: PASSED

- 파일 존재: src/net/useChat.ts, test/client/useChat.test.tsx 확인(수정 파일 9개는 git diff 로 확인)
- 커밋 5개(2c3875e, 8f4b334, 5c47581, 3c90520, 5194e40) 모두 HEAD 의 조상
- 수용 기준 통과: `new ChatStore`·`<ChatPanel`·`id: "chat-lobby"`, `phaseKey(`, 채널 필드 grep(0건), `chat.reset()`·`addSystem(`·시험 파일, `LOBBY_EXTRA_SIZES`, `.skip(`·`.todo(` git grep 0건
- 전체 검증: `npx vitest run` 138 파일 3736 통과(1 skipped 는 이전부터), `npm run typecheck` 종료 0, `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs` 280 통과, `npm run e2e -- --only chat-lobby` 6종 크기 모두 20/20 `E2E OK`

---
*Phase: 07-free-chat*
*Completed: 2026-11-01*
