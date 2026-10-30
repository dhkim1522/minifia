---
phase: 02-day-discussion
plan: 12
subsystem: realtime-chat
tags: [websocket, durable-object, chat-event, rate-limit, tdd, gap-closure]
gap_closure: true
gap_ids: [G-02-1, G-02-2]
status: complete

requires:
  - phase: 02-day-discussion
    provides: say·emote 규칙 함수, handleSay·handleEmoji, broadcastEvent, useRoomConnection 이벤트 구독, normalizeStoredRoom
provides:
  - ChatEvent 프레임(`{ t: "chat" } & ChatLine`)과 ServerMessage 유니온 확장
  - 통과한 say 를 저장 없이 chat 이벤트로만 모든 소켓에 방송하는 handleSay
  - 서버 전송 간격 한도 SERVER_MIN_SEND_GAP_MS 1800 (클라이언트 잠금 SEND_COOLDOWN_MS 2000 유지)
  - messages 를 상태·뷰에 쓰지 않는 say 와 buildDay
  - 옛 저장 방의 messages 키를 깨어날 때 지우는 normalizeStoredRoom
affects: [02-15, 02-16, 02-17, 02-18]

actuals:
  tokens: 10994
  tasks: 3
  commits: 6
plan_head_before: 7dd3fcf54878b10088bac400c838f9e7c88859fe
plan_head_after: 556ce767009682ec8d188e188b6164613fdddc05

tech-stack:
  added: []
  patterns:
    - "공개 이벤트는 저장 뒤 broadcastEvent 로 앉은 모든 소켓에 보내고, 화면 값이 바뀌지 않으면 state 를 방송하지 않는다 (emoji → chat 으로 확장)"
    - "옛 저장 키 정리는 normalizeStoredRoom 에서 Object.hasOwn + 구조 분해로만 한다 (필드 선언이 사라져도 컴파일됨)"
    - "생성자는 정규화로 마감이 바뀐 경우에만 알람을 다시 건다"

key-files:
  created: []
  modified:
    - shared/protocol.ts
    - shared/game/chat.ts
    - shared/game/view.ts
    - shared/game/room.ts
    - worker/room.ts
    - src/net/useRoomConnection.ts
    - test/worker/day.test.ts
    - test/client/useRoomConnection.test.tsx
    - test/unit/chat.test.ts
    - test/unit/view.test.ts
    - test/unit/gameRoom.test.ts

key-decisions:
  - "통과한 빠른 메시지는 상태에 쌓지 않고 chat 이벤트로만 방송한다 (결정 0017-7, CONTEXT D-15 대체)"
  - "서버 한도는 SERVER_MIN_SEND_GAP_MS 1800, 클라이언트 잠금 SEND_COOLDOWN_MS 2000 (G-02-2)"
  - "normalizeStoredRoom 이 옛 messages 키를 지우고, 생성자는 마감이 바뀐 경우에만 알람을 다시 건다"

patterns-established:
  - "chat 프레임 키는 seq·seat·template·target?·claimedRole?·at 와 t 뿐이다. id·role 키 금지"
  - "worker 테스트는 저장 messages 를 타입 필드로 읽지 않고 지역 도우미(storedMessageCount)나 Object.keys 로 본다"

requirements-completed: [COMM-01, COMM-04]

duration: 약 10분
completed: 2026-10-24
---

# Phase 2 Plan 12: 채팅 방송 전환과 서버 한도 1800ms Summary

**통과한 빠른 메시지를 상태 보관 없이 chat 이벤트 프레임으로만 방송하고, 서버 전송 간격 한도를 1800ms 로 줄여(클라이언트 잠금 2000ms 유지) 정상 간격 전송의 RATE_LIMITED 오탐(G-02-2)을 닫았다.**

## Performance

- 태스크 3개, 커밋 6개 (RED 3 + GREEN 3), REFACTOR 없음
- 전체 `npx vitest run` 54개 파일 985개 테스트 통과, `npm run typecheck` 통과
- 화면(src/components, src/screens, src/styles)·연장 규칙·스키마는 바뀌지 않았다 (`git diff BASE` 비어 있음)

## Accomplishments

- **Task 1 (트레이서)**: `ChatEvent` 타입과 `ServerMessage` 유니온 확장. `handleSay` 는 통과하면 저장(lastSendAt·nextMessageSeq) 뒤 `broadcastEvent({ t: "chat", ...result.line })` 만 하고 state 를 방송하지 않는다. `useRoomConnection` 은 chat 프레임을 `RoomEvent` 로 허용하고 상태로 쌓지 않은 채 `onEvent` 구독자에게만 흘린다. 알 수 없는 t 는 계속 버린다.
- **Task 2**: `SERVER_MIN_SEND_GAP_MS = 1_800` 추가. `coolingDown` 이 이 값으로 판정하고(say·emote 합산, 거부는 lastSendAt 을 늘리지 않음) `SEND_COOLDOWN_MS = 2_000` 은 클라이언트 잠금으로 남았다. `say` 는 `messages` 를 쓰지 않고 `MESSAGE_KEEP` 를 지웠다. `buildDay` 가 `day.messages` 를 싣지 않는다. 뷰 누출 검사의 허용 경로에서 메시지 직업 칸이 빠졌다.
- **Task 3**: `normalizeStoredRoom` 이 `Object.hasOwn` 으로 옛 `messages` 키를 찾아 구조 분해로 뺀 새 객체를 돌려준다 (legacy `day` 정규화와 함께 동작, 둘 다 아니면 같은 객체). 워커 통합 테스트가 통과한 say 뒤 저장 줄 0, 옛 저장소 줄이 깨어날 때 지워짐을 고정한다.

## TDD 기록

### Task 1 (트레이서)
- **RED** `ab07908`: chat 프레임 키 집합, state 비방송(`chat,emoji` 순서만), 거짓 주장 프레임, 이모티콘 흐름의 chat 프레임 수, 클라이언트 onEvent 구독 테스트. `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (5개 실패, 대상 테스트 "suspect … chat 프레임 하나").
  - semanticAssessment: worker 대상은 `waitChat` 제한 시간 초과(chat 프레임이 오지 않음), client 대상은 리스너가 호출되지 않음 — 계획한 "chat 프레임이 오지 않는다/리스너가 받지 않는다" 단언에서 실패했다. import·문법·픽스처 오류 아님.
- **GREEN** `d90e292`: 위 구현. 트레이서 게이트는 자동화 `<verify>` 만이라 재실행으로 대체: worker·client 47개 통과, typecheck 통과.

### Task 2
- **RED** `61e0c50`: 1799/1800 경계(say·emote·합산), 상수 3개 단언, 보관 없음, 25개 seq, 뷰 day 키 집합. `RED_EVIDENCE_OK` (12개 실패, 대상 "1800ms 는 통과한다").
  - semanticAssessment: 대상은 `expected 'RATE_LIMITED' to be 'ok'` — 서버 한도가 아직 2000ms 라서 실패한 정확히 계획한 단언이다. 첫 시도는 객체 `toBe` 의 여러 줄 diff 때문에 `invalid_record`(Non-TAP data)였고, 단언을 `=== …` 불리언 비교로 바꿔 재수집해 통과했다.
- **GREEN** `d61bbcd`: 전체 980개 통과.

### Task 3
- **RED** `ffe9ffe`: normalizeStoredRoom messages 정리 3종 + 워커 통합 2종. `RED_EVIDENCE_OK` (대상 "messages 키가 있으면 … 지운 새 객체").
  - semanticAssessment: `expected true to be false` — 정규화 함수가 messages 키를 남겨 둔 채 같은 객체를 돌려주는 것이 실패 이유다.
- **GREEN** `556ce76`: 전체 985개 통과.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 생성자가 messages 정리만으로도 알람을 다시 걸어 알람 테스트가 깨짐**
- **Found during:** Task 3 GREEN 전체 실행
- **Issue:** 계획대로 "바뀌면 저장 + 같은 nextWakeAt 으로 setAlarm" 을 하면, 02-15 전까지 tick 의 낮 진입 훅이 매번 `messages: []` 를 쓰는 탓에 낮 방이 깨어날 때마다 정규화가 일어나 `setAlarm(과거 마감)` 이 대기 중인 알람을 덮어썼다. 알람이 즉시 실행되어 `test/worker/alarm.test.ts` 의 `runDurableObjectAlarm` 이 false 를 돌려줬다.
- **Fix:** 저장은 항상 하되 `normalized.phaseEndsAt !== stored.phaseEndsAt` 일 때만 `setAlarm` 한다. 기존 생성자 주석의 원칙("예외는 정규화로 마감이 바뀐 경우뿐")과 같다.
- **Files modified:** worker/room.ts
- **Commit:** 556ce76

**2. [Rule 1 - Bug] 기존 정규화 테스트가 tick 이 쓰는 messages 빈 배열 때문에 깨질 위험**
- **Found during:** Task 3 RED 작성
- **Issue:** "lobby·roleReveal·discussion 은 같은 객체를 돌려준다" 테스트의 discussion 상태가 tick 진입 훅의 `messages: []` 를 갖고 있어, 새 정규화 규칙에서는 같은 객체가 아니다.
- **Fix:** 그 테스트가 messages 키를 구조 분해로 뺀 상태의 동일성을 보게 바꿨다 (02-15 에서 tick 이 키를 더 이상 쓰지 않으면 이 분기는 자연히 무의미해진다).
- **Files modified:** test/unit/gameRoom.test.ts
- **Commit:** ffe9ffe

**3. [Rule 3 - Blocking] 알 수 없는 t 프레임 테스트가 chat 을 예로 쓰고 있었음**
- **Issue:** 기존 "알 수 없는 t 값" 테스트가 `{ t: "chat", text: "hi" }` 를 썼는데 이제 chat 은 허용 프레임이다.
- **Fix:** 예시를 `t: "unknown"` 으로 바꾸고, 계획대로 `chatx` 테스트를 더했다.
- **Files modified:** test/client/useRoomConnection.test.tsx
- **Commit:** ab07908

## Auth gates

없음.

## Known Stubs

없음. (화면의 메시지 로그는 서버 뷰 대신 이벤트를 받는 02-16 전까지 비어 보이는데, 계획이 명시한 범위 밖 사항이며 배포는 02-18 에서만 한다.)

## Threat Flags

없음. 위협 T-02-35~38 은 계획대로 완화했다: chat 프레임은 chat.ts 가 필드별로 만든 line 만 펼치고(키 집합 테스트), 보낸 사람 seat 는 소켓 첨부 playerId 로 찾으며, 한도 완화에도 거부는 lastSendAt 을 늘리지 않고, 옛 messages 키는 깨어날 때 지운다.

## 남은 연결 (다음 계획이 이어받음)

- `RoomState.messages?`·`extendUsed?` 필드 선언과 `shared/game/tick.ts` 의 `messages: []` 는 02-15 Task 3 이 지운다.
- `DayView.messages?` 타입은 02-16 Task 2 가 지운다. 서버는 이미 값을 싣지 않는다.
- 클라이언트가 chat 이벤트를 메모리에 쥐는 훅은 02-16, 스크립트·배포 확인(2000ms 간격 오탐 0)은 02-18.
- HANDOFF.md 갱신·push 는 이 계획의 단계에 없어서 하지 않았다 (페이즈 단위로 갱신).

## Self-Check: PASSED

- 파일: shared/protocol.ts, shared/game/chat.ts, shared/game/view.ts, shared/game/room.ts, worker/room.ts, src/net/useRoomConnection.ts 및 테스트 5개 모두 존재
- 커밋: ab07908, d90e292, 61e0c50, d61bbcd, ffe9ffe, 556ce76 모두 HEAD 의 조상
- RED(test) 커밋 3개가 각 GREEN(feat) 커밋보다 먼저
- 인수 기준 grep 점검 전부 통과, `git diff BASE -- src/components src/screens src/styles shared/schemas.ts shared/game/discussion.ts shared/game/phases.ts` 비어 있음
