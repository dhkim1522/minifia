---
phase: 07-free-chat
plan: "11"
subsystem: realtime-chat
tags: [free-chat, applyChat, audience, deliver, chatLog, bots, quick-message-removal, leak-test, tdd, vitest, durable-object]

requires:
  - phase: 07-free-chat
    plan: "02"
    provides: "sanitizeChatText·checkChatSend·appendLine·seatMask·toWire·audience·channelOf·phaseKey 순수 규칙과 chat 와이어 타입"
  - phase: 07-free-chat
    plan: "07"
    provides: "화면에서 옛 빠른 메시지 값을 걷어낸 상태 — 와이어 삭제가 빌드를 깨지 않는다"
  - phase: 07-free-chat
    plan: "10"
    provides: "deliver(audience) 한 길, handleTyping, 연결 훅의 typing 구독"
provides:
  - "worker/room.ts: handleChat·applyChat(단계 키 -> 채널 -> 정리 -> D5 -> 수신자·마스크 한 번 -> appendLine -> deliver), chatLog(메모리), chatRates"
  - "와이어: ClientMessage chat, ServerMessage chat(새 줄 모양)·chatReject·chatLog 타입 + ChatMessageSchema(본문 UTF-16 300·pk, strictObject)"
  - "shared/game/bots.ts: BOT_CHAT_LINES(8)·BOT_NIGHT_LINES(3)·BOT_DEFENSE_LINES(3), BotAct chat — 봇이 사람과 같은 applyChat 으로 말함"
  - "src/net/useRoomConnection.ts: chatReject·chatLog 구독, 끝난 연결의 늦은 채팅 프레임 버림"
  - "빠른 메시지(say)·템플릿·옛 줄/이벤트 타입이 서버·와이어에서 사라짐 (say 는 BAD_MESSAGE)"
  - "테스트 도우미 chatSend·chatsOf·chatMsg·resetChatRates·advanceToKeep"
affects: [07-12, 07-13, 07-14, 07-15, 08-vote-screens, 09-night-screens, 10-emotes, 11-reveal]

actuals:
  tokens: 46000
  tasks: 3
  commits: 6

plan_head_before: 30059bc35c57f4dc3661ac60208932d4da71d485
plan_head_after: 79e32010c96f85537b2d129a30258d7b18c89d7d
commits: 6

tech-stack:
  added: []
  patterns:
    - "채팅 전송 판정 순서 고정: 단계 키(pk) -> channelOf -> sanitize -> D5 제한 -> audience·seatMask 한 번 -> appendLine -> deliver. 받는 사람은 지역 변수로만 쓰고 다시 audience 를 부르지 않는다"
    - "거절은 보낸 소켓에만 chatReject{why}; 밤 산 시민의 전송과 CHAT_PHASES 밖·단계 어긋남은 모두 같은 phase 하나(역할을 말하지 않음), phase 일 때만 최신 state 한 번 더"
    - "봇도 applyChat 본체를 지난다(특권 없음) — 거절은 버림. 봇 문구는 고정 목록이고 난수 호출 순서가 계약이다(시드 고정 값 재고정)"
    - "누설 검사의 역할 단어 허용 경로는 '받을 권리 있는 소켓 조건'으로만 넓힌다 (.ch=mafia 는 밤의 산 마피아·탈락자 소켓만)"
    - "DO 메모리 상태(chatLog·chatRates)를 보는 시험은 evict 하지 않는 advanceToKeep 으로 단계를 넘긴다 (저장·복원은 07-14)"

key-files:
  created:
    - .planning/phases/07-free-chat/deferred-items.md
  modified:
    - shared/protocol.ts
    - shared/schemas.ts
    - shared/game/chat.ts
    - shared/game/bots.ts
    - worker/room.ts
    - src/net/useRoomConnection.ts
    - test/worker/chat.test.ts
    - test/worker/helpers.ts
    - test/worker/day.test.ts
    - test/worker/night.test.ts
    - test/worker/vote.test.ts
    - test/worker/leak.test.ts
    - test/worker/endgame.test.ts
    - test/worker/bots.test.ts
    - test/unit/schemas.test.ts
    - test/unit/chat.test.ts
    - test/unit/bots.test.ts
    - test/unit/view.test.ts
    - test/unit/nyquist-02-phase-matrix.test.ts
    - test/client/useRoomConnection.test.tsx

key-decisions:
  - "applyChat 은 DO 메서드 하나로 사람(handleChat)과 봇(actAsBot)이 같이 쓴다. 거절 반환형은 ChatRejectWhy 이고 phase 가 아닌 거절은 state 를 다시 보내지 않는다"
  - "chatLog·chatRates 는 메모리뿐이다(가정 A1) — 저장·재접속 복원은 07-14. 시험은 evict 하지 않는 advanceToKeep 으로 seq 이음을 본다"
  - "chat.ts 에는 emote·EMOTE_PHASES·senderOf·SERVER_MIN_SEND_GAP_MS·ChatError 만 남기고 SEND_COOLDOWN_MS(어디서도 안 씀)도 지웠다. 머리 주석에 07-12 가 지운다고 적음"
  - "view.test 의 낮 서버 전용 필드 채우기는 say 대신 emote 로 한다 — lastSendAt 이 view 에 새지 않는 검사의 힘을 유지하려고"
  - "봇 낮 토론 난수 순서를 randInt(지연 폭) -> randInt(8) 두 번으로 정했다(봇당 4번, 5봇 20번). 밤 마피아는 randInt(10) < 6 일 때만 randInt(6000) -> randInt(3)"
  - "leak.test 는 줄마다 보낸 사람을 달리하고, 시험이 빨라 600ms 가 안 지나는 한 곳에서만 resetChatRates 로 기록을 비운다(D5 규칙을 지키되 실제 시간을 기다리지 않음)"

patterns-established:
  - "worker 채팅 시험: observe(sender 먼저 settle, 나머지 뒤) 로 소켓별 프레임을 모으고 '좌석:채널/보낸좌석/번호/본문' 한 줄 문자열로 비교한다"
  - "거절 시험은 보낸 소켓 요약 '[chatReject]' + 다른 소켓 '[]' 로 '오지 않았음'을 증명한다"

requirements-completed: [CHAT-01, CHAT-02, CHAT-03, CHAT-05, CHAT-06]

coverage:
  - id: D1
    description: "로비·낮 단계의 자유 채팅 한 줄이 서버가 정리한 본문으로 방의 모든 소켓(보낸 사람 포함)에 같은 chat 프레임(ch all, 채널별 seq)으로 간다"
    requirement: CHAT-01
    verification:
      - kind: integration
        ref: "test/worker/chat.test.ts#채팅: 로비 손님의 줄이 정리되어 방장·손님 모두에게 같은 프레임으로 가고 state 방송은 없다"
        status: pass
      - kind: integration
        ref: "test/worker/chat.test.ts#단계: %s 에서 산 사람의 줄이 서버 audience 규칙대로 ch all 로 모두에게 간다"
        status: pass
    human_judgment: false
  - id: D2
    description: "밤 마피아 줄은 산 마피아와 탈락자에게만(ch mafia), 탈락자 줄은 탈락자에게만(ch ghost) 가고, 밤의 산 시민·경찰·의사와 단계 밖 전송은 chatReject phase 로 막힌다"
    requirement: CHAT-02
    verification:
      - kind: integration
        ref: "test/worker/chat.test.ts#채널: 밤에 산 마피아의 줄은 다른 산 마피아와 탈락자에게만 ch mafia 로 가고 시민·경찰·의사는 한 프레임도 받지 않는다"
        status: pass
      - kind: integration
        ref: "test/worker/chat.test.ts#채널: 밤에 산 시민·경찰·의사의 전송은 보낸 사람만 chatReject phase 와 state 를 받고 다른 소켓은 한 프레임도 받지 않는다"
        status: pass
      - kind: integration
        ref: "test/worker/leak.test.ts#모든 프레임·HTTP 응답에 남의 토큰·역할·동료가 없고 역할 수는 구성표와 같다"
        status: pass
    human_judgment: false
  - id: D3
    description: "화면이 없는 단계(처형 여부 투표~아침)에서도 서버가 audience 규칙대로 채팅을 받고, 최후 변론은 후보가 아닌 산 사람도 쓸 수 있다"
    requirement: CHAT-03
    verification:
      - kind: integration
        ref: "test/worker/chat.test.ts#단계: 최후 변론에서 후보가 아닌 산 사람 누구나 쓸 수 있다"
        status: pass
    human_judgment: false
  - id: D4
    description: "단계 키가 어긋난 줄은 더 넓은 채널로 돌리지 않고 폐기하며 보낸 소켓에만 chatReject{phase}+state 를 보낸다"
    requirement: CHAT-02
    verification:
      - kind: integration
        ref: "test/worker/chat.test.ts#단계 어긋남: 밤의 단계 키로 아침 이후 도착한 마피아 줄은 폐기되고 보낸 사람에게만 chatReject phase 와 state 가 가며 어느 소켓도 chat 을 받지 않는다"
        status: pass
    human_judgment: false
  - id: D5
    description: "빈 줄(other)·101자(length)·600ms 안(rate)·5초 6번째(rate)·같은 문장 3초 안(repeat)은 보낸 사람에게만 chatReject 로 막히고 다른 소켓에는 아무 프레임도 가지 않는다"
    requirement: CHAT-05
    verification:
      - kind: integration
        ref: "test/worker/chat.test.ts#거절: 공백뿐인 줄은 other 로 막히고 방장에게는 아무 프레임도 가지 않는다"
        status: pass
      - kind: integration
        ref: "test/worker/chat.test.ts#거절: 5초 안에 여섯 번째 줄은 rate 로 막힌다"
        status: pass
    human_judgment: false
  - id: D6
    description: "줄 번호 seq 는 채널마다 따로 이어져 공개 줄 번호에 마피아·유령 줄 때문에 생긴 틈이 없다"
    requirement: CHAT-02
    verification:
      - kind: integration
        ref: "test/worker/chat.test.ts#줄 번호: 낮 all 줄 번호에는 밤 마피아 줄 때문에 생긴 틈이 없고 mafia 번호는 판 내내 이어진다"
        status: pass
    human_judgment: false
  - id: D7
    description: "빠른 메시지(say)·템플릿·옛 줄/이벤트 타입이 서버·와이어에서 사라지고 say 는 BAD_MESSAGE 다"
    requirement: CHAT-06
    verification:
      - kind: unit
        ref: "test/unit/schemas.test.ts#빠른 메시지(say)는 와이어에서 사라졌다 (07-11, CHAT-06)"
        status: pass
      - kind: integration
        ref: "test/worker/day.test.ts#빠른 메시지(say)는 어떤 템플릿이든 보낸 소켓만 BAD_MESSAGE 를 받고 다른 소켓에는 chat 프레임이 가지 않는다 (CHAT-06)"
        status: pass
    human_judgment: false
  - id: D8
    description: "테스트 방 봇이 고정 문구 자유 채팅을 사람과 같은 applyChat 으로 보내고(특권 없음) 로비에서는 말하지 않으며 이모티콘·say 를 보내지 않는다"
    requirement: CHAT-01
    verification:
      - kind: unit
        ref: "test/unit/bots.test.ts#discussion 은 살아 있는 봇마다 정확히 chat 2개(BOT_CHAT_LINES 안, 토론 40초 안, 결정 0039)이고 같은 봇 간격이 8000 이상이며 사람과 같은 규칙을 모두 통과한다"
        status: pass
      - kind: integration
        ref: "test/worker/bots.test.ts#봇 chat: 밤에는 마피아 봇의 줄이 마피아 방장에게만 ch mafia 로 가고 손님은 한 프레임도 받지 않으며, 마피아가 아닌 봇의 줄은 버려진다"
        status: pass
    human_judgment: false
  - id: D9
    description: "연결 훅이 chat(새 모양)·chatReject·chatLog 를 구독자에게 흘리고 모르는 t·끝난 연결의 늦은 프레임은 버린다"
    requirement: CHAT-01
    verification:
      - kind: unit
        ref: "test/client/useRoomConnection.test.tsx#useRoomConnection: chat·chatReject·chatLog 프레임 (CHAT-01·05, 07-11)"
        status: pass
    human_judgment: false

duration: 24min
completed: 2026-11-01
status: complete
---

# Phase 7 Plan 11: 자유 채팅 서버 길과 빠른 메시지 제거 Summary

**방 DO 의 `applyChat`(단계 키 -> 채널 -> 정리 -> D5 -> 수신자·마스크 한 번 -> 채널별 seq -> deliver)으로 자유 채팅이 채널별로만 나가고, 빠른 메시지(say)는 서버·와이어에서 사라졌으며, 봇은 고정 문구로 같은 길을 지난다**

## Performance

- **Duration:** 약 24분
- **Started:** 2026-11-01T13:58:00Z
- **Completed:** 2026-11-01T14:22:00Z
- **Tasks:** 3 (트레이서 1 + auto 2, 모두 TDD)
- **Files modified:** 20 (신규 문서 1 별도)

## Accomplishments

- 로비·낮의 한 줄이 서버에서 정리(공백 접기, 금지 문자 제거)되어 보낸 사람 포함 방의 모든 소켓에 같은 `{t:"chat", ch, seat, seq, text, at}` 한 프레임으로 간다. state 방송은 생기지 않는다.
- 밤 마피아 줄은 산 마피아 + 탈락자 소켓에만, 탈락자 줄은 탈락자에게만 간다. 밤의 산 시민·경찰·의사·`CHAT_PHASES` 밖·단계 키 어긋남은 모두 `chatReject{phase}` 하나(역할을 말하지 않음)이고 보낸 소켓에만 최신 state 가 한 번 더 간다. 어긋난 줄을 더 넓은 채널로 돌리는 일은 없다.
- 거절 이유 other·length·rate(600ms·5초 6번째)·repeat 가 보낸 사람에게만 가고, 다른 소켓에는 한 프레임도 가지 않는다. 줄 번호는 채널마다 따로 센다(공개 줄 번호에 틈 없음).
- 빠른 메시지: `TEMPLATE_IDS`·`TemplateId`·`DISPLAY_ONLY_TEMPLATE_IDS`·`ChatLine`·`ChatEvent`, ClientMessage say, chat.ts 의 `QUICK_TEMPLATES`·`say`·`SayInput`, DO 의 `handleSay`·`applySay` 가 사라졌다. say 는 스키마에서 BAD_MESSAGE.
- 봇: `BOT_CHAT_LINES`(8)·`BOT_NIGHT_LINES`(3)·`BOT_DEFENSE_LINES`(3)를 사람과 같은 `applyChat` 으로 보낸다. 이모티콘·say 는 더 이상 보내지 않고 로비에서는 말하지 않는다. 시드 고정 값은 새 호출 순서로 재고정(`622180622,76649671` -> `131523613,997718148`), execVote·candidateVote·defense 호출 수는 그대로다.
- 연결 훅이 chatReject·chatLog 를 구독자에게 흘리고, 끝난 연결의 늦은 chat·chatReject·chatLog 는 버린다.
- 누설 검사(leak.test 6명 한 판)가 chat 으로 돈다: 시민 편 소켓 mafia·ghost 줄 0건, 공개 줄 번호 1·2 틈 없음, mafia 번호는 판 내내 이어짐(1·2), chat 키는 t·ch·seat·seq·text·at 뿐, `.ch=mafia` 는 밤의 산 마피아·탈락자 소켓에서만, chatReject 는 보낸 소켓에만.

## Task Commits

TDD 게이트: 모든 태스크에서 `test(07-11)` 이 `feat(07-11)` 앞섰다.

1. **Task 1: 트레이서 — 로비 한 줄이 모든 소켓에 같은 chat 프레임으로 (CHAT-01)**
   - RED `60b8b01` (test): 스키마 chat 시험 + 로비 두 줄 시험 + 도우미. RED 증거: 대상 시험 `채팅: 이어서 방장의 줄은 seq 2 이다` 가 `expected ""`(chat 프레임 없음, 서버가 `chat` 을 BAD_MESSAGE 로 처리)로 단언 실패, `gsd_run check tdd-red-evidence` = `RED_EVIDENCE_OK`. 의미 판정: 대상이 실행되어 계획한 단언(chat 프레임 수신)으로 실패했다.
   - GREEN `5cfd63a` (feat): `ChatMessageSchema`, 와이어 타입, `handleChat`·`applyChat`.
2. **Task 2: 채널·거절·단계 키·D1 + 봇 자유 채팅 + 연결 훅 (CHAT-02·03·05·01)**
   - RED `9f73688` (test): 채널·거절·단계 어긋남·화면 없는 단계·seq 시험(Task 1 의 `applyChat` 이 이미 이 규칙을 구현해 이 worker 시험은 바로 통과해 규칙을 고정했다), 봇 계획·난수 순서·DO 전달, 연결 훅 시험. 봇·연결 훅 시험 16개가 대상 코드 부재(BOT_*_LINES 없음, 화이트리스트 누락)로 실패.
   - GREEN `8f1ee1f` (feat): 봇 고정 문구 + `actAsBot` chat + 시드 재고정 + 연결 훅.
3. **Task 3: 빠른 메시지 제거 + say -> chat 전환 (CHAT-06·02·03)**
   - RED `fda8b51` (test): say 거부 시험(스키마 5 + worker 4), 전체 worker·unit·누설 검사 전환. RED 증거: `빠른 메시지(say)는 와이어에서 사라졌다 > 낮 문구 의 say 는 거부한다` 단언 실패(`expected false, got true`), `RED_EVIDENCE_OK`.
   - GREEN `79e3201` (feat): protocol·schemas·chat.ts·room.ts 에서 say 제거.

**Plan metadata:** 이 SUMMARY 를 담는 `docs(07-11)` 커밋 (아래 STATE/ROADMAP 갱신 포함)

_REFACTOR 커밋은 없다(정리할 만한 중복이 없었다)._

## Files Created/Modified

- `worker/room.ts` - `handleChat`·`applyChat`, `chatLog`·`chatRates`, 봇 chat 분기. `handleSay`·`applySay`·say 분기 삭제
- `shared/protocol.ts`, `shared/schemas.ts` - ClientMessage chat, 서버 프레임 셋, `ChatMessageSchema`. 템플릿·say·옛 줄 타입 삭제
- `shared/game/chat.ts` - 이모티콘만 남은 옛 모듈(07-12 가 지움)
- `shared/game/bots.ts` - 고정 문구 상수와 chat 행동, 난수 순서 계약 주석 갱신
- `src/net/useRoomConnection.ts` - chatReject·chatLog 구독, 종료 연결 버림
- `test/worker/chat.test.ts` - 트레이서·채널·거절·단계 어긋남·화면 없는 단계·채널별 seq
- `test/worker/helpers.ts` - `chatSend`·`chatsOf`·`chatMsg`·`resetChatRates`·`advanceToKeep`
- `test/worker/{day,night,vote,endgame,leak,bots}.test.ts`, `test/unit/{schemas,chat,bots,view,nyquist-02-phase-matrix}.test.ts`, `test/client/useRoomConnection.test.tsx` - say -> chat 전환과 새 규칙 시험
- `.planning/phases/07-free-chat/deferred-items.md` - 옛 와이어를 쓰는 개발 스크립트와 A1 한계(미룬 항목)

## Decisions Made

key-decisions 참조. 요점: 사람·봇이 `applyChat` 하나를 공유, 메모리 보관은 07-14 까지 의도적 한계, chat.ts 는 emote 만 남김, 봇 난수 호출 순서 계약 갱신.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 단계를 넘기는 도우미가 DO 를 evict 해 채널별 seq 가 1 로 돌아감**
- **Found during:** Task 2 (채널별 seq 시험), Task 3 (leak.test 전환)
- **Issue:** `advanceTo`/`forceDue`/`backdateSends` 는 DO 를 evict 하는데 `chatLog`·`chatRates` 는 메모리뿐(가정 A1)이라 단계를 넘길 때마다 줄 번호가 1 로 리셋되어 "공개 줄 번호 틈 없음/이어짐"을 시험할 수 없었다.
- **Fix:** chat.test 의 seq 시험은 evict 하지 않는 테스트 방 `skipThrough` 로, leak.test 는 새 도우미 `advanceToKeep`(저장소와 메모리 둘 다 마감을 당기고 알람만 돌림)으로 단계를 넘긴다. 저장·복원 이후 이음은 07-14 의 몫이다.
- **Files modified:** test/worker/helpers.ts, test/worker/chat.test.ts, test/worker/leak.test.ts
- **Verification:** 해당 시험 연속 3회 통과
- **Committed in:** 9f73688, fda8b51 (테스트 커밋)

**2. [Rule 1 - Bug] 시험 구성 오류 3건을 시험 안에서 바로잡음**
- **Found during:** Task 1·2 시험 작성
- **Issue:** (a) 입장 때 쌓인 state 가 늦게 도착해 채팅이 만든 것으로 센 오탐, (b) `voteExec` 가 후보 선택 state 를 이미 소비한 뒤 `advanceTo(candidateVote)` 가 다시 기다려 시간 초과, (c) 한 소켓이 1초에 20개 한도(RATE_LIMITED)에 걸림, (d) 여러 줄 `expected` 가 TAP 증거를 깨뜨림.
- **Fix:** 마킹 전에 settle 로 흘려 보냄, 중복 advanceTo 제거, 단계 넘기기 전 창 비우기(1.05초), 비교를 한 줄 문자열로.
- **Files modified:** test/worker/chat.test.ts
- **Committed in:** 5cfd63a, 9f73688

**3. [Rule 2 - Missing Critical] view.test 의 서버 전용 필드 검사 힘 유지**
- **Found during:** Task 3
- **Issue:** `say` 로 채우던 낮 상태의 `lastSendAt` 이 사라지면 "view 가 lastSendAt 을 싣지 않는다" 검사가 빈 상태를 검사하게 된다.
- **Fix:** `speak`(say) 대신 `react`(emote)로 같은 필드를 채웠다. emote 는 07-12 까지 남는다.
- **Files modified:** test/unit/view.test.ts
- **Committed in:** fda8b51

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug, 1 missing critical) — 모두 시험 쪽. 프로덕션 코드는 계획대로다.
**Impact on plan:** 범위 확대 없음. 계획 Task 2 verify 가 말한 worker 채널 시험은 Task 1 의 `applyChat` 이 규칙을 이미 구현해 RED 에서 통과했다(규칙을 고정하는 시험). 의미 있는 RED 는 봇·연결 훅·say 거부 시험이 맡았다.

## Issues Encountered

- `gsd_run check tdd-red-evidence` 는 TAP 보고의 `expected` 값이 여러 줄이면 `invalid_record`(Malformed TAP)로 거절한다. 시험 비교를 한 줄 문자열로 바꾸면 해결된다.
- 계획 Task 3 verify 첫 명령의 `--project worker` 는 unit 시험 파일에 맞지 않는 프로젝트 이름이라 전체 `npx vitest run` 으로 대신 확인했다(138 파일 3726 통과, 1 skipped 는 기준선과 같다).

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크 표면은 계획의 `<threat_model>`(T-07-23~29)에 있는 chat 경로뿐이다. 서버 로그에 채팅 본문·닉네임을 남기지 않는다(grep 게이트 통과).

## Deferred Issues

`.planning/phases/07-free-chat/deferred-items.md` 참조: `scripts/bots.mjs`·`smoke.mjs`·`uat-day/night/vote.mjs` 가 옛 say·옛 chat 프레임 키를 쓴다(vitest 밖, `.planning/WINDOWS.md` 에 todo 로 기록). 채팅 보관은 메모리뿐(A1)이라 evict 시 seq·제한 기록이 비며 07-14 가 저장한다.

## TDD Gate Compliance

세 태스크 모두 `test(07-11)` -> `feat(07-11)` 순서다. `git log --grep="^test\(0?7-11\):"` 3건, `--grep="^feat\(0?7-11\):"` 3건, `refactor` 는 없다.

## Self-Check: PASSED

- 파일 존재: `worker/room.ts`(applyChat), `shared/game/bots.ts`(BOT_CHAT_LINES), `.planning/phases/07-free-chat/deferred-items.md` 확인.
- 커밋 존재: 60b8b01, 5cfd63a, 9f73688, 8f1ee1f, fda8b51, 79e3201 모두 HEAD 의 조상이다.
- 검증: `npx vitest run` 138 파일 3726 통과(1 skipped 는 기준선과 같음), `npm run typecheck` 종료 0(두 tsc 포함), `npx vite build` 성공.
- acceptance: 옛 심볼 `git grep` 0건, `case "say"|handleSay|applySay` 0건, 본문 로그 grep 0건, `.skip(`/`.todo(` 0건.

## Next Phase Readiness

- 07-12(텍스트 이모티콘·옛 번호 필드·무차별 전송 정리): `emoji`·`EMOJI_IDS`·`emote`·`broadcastEvent(To)`·`nightChatRecipientIds`·`nextMessageSeq`·`nextNightSeq`·`lastSendAt`·`backdateSends` 가 아직 살아 있다. chat.ts 는 emote 만 남아 있어 파일째 지우면 된다.
- 07-14: `chatLog`·`chatRates` 저장과 접속 직후 chatLog 프레임 보내기를 같은 `appendLine` 결과에 더한다. 연결 훅과 타입은 이미 준비됐다.
- 개발 스크립트(`scripts/*.mjs`)는 옛 와이어를 쓰므로 배포 스모크 전에 새 모양으로 바꿔야 한다(deferred-items.md).

---
*Phase: 07-free-chat*
*Completed: 2026-11-01*
