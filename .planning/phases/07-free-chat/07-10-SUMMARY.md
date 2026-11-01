---
phase: 07-free-chat
plan: "10"
subsystem: realtime-chat
tags: [typing, audience, deliver, me.chat, emitWorld, leak-test, tdd, vitest, durable-object]

requires:
  - phase: 07-free-chat
    plan: "02"
    provides: "audience·channelOf·phaseKey·typingRelay 순수 규칙과 TypingSendMessage·TypingFrame 타입"
  - phase: 07-free-chat
    plan: "09"
    provides: "와이어에서 claimLog 제거 — 새 메시지를 더할 깨끗한 유니온"
provides:
  - "worker/room.ts: deliver(ids, msg) — 이벤트 프레임의 유일한 전송 길, handleTyping(단계 키 대조·채널 결정·1.5초 간격), typingRelays"
  - "emitWorld 가 deliver(audience({k:'world'})) 를 지난다 (6페이즈 동작 그대로)"
  - "shared/schemas.ts: TypingMessageSchema(strictObject, pk 1~32자)"
  - "shared/game/view.ts + protocol.ts: view.me.chat — 서버가 정한 내 채널(본인에게만, 말할 수 없으면 키 없음)"
  - "src/net/useRoomConnection.ts: typing 을 RoomEvent·화이트리스트·분기 세 곳에 더해 구독자에게 흘림"
  - "test/worker/chat.test.ts(신규), helpers phaseKeyOf·typingSend, 누설 검사의 typing·me.chat 확장"
affects: [07-11, 07-12, 07-13, 07-14, 08-vote-screens, 09-night-screens, 10-emotes]

actuals:
  tokens: 12500
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "이벤트 프레임 전송은 deliver(audience(...)) 한 길 — 호출부는 받는 사람 집합에만 보내고 화면은 거르지 않는다"
    - "채널·단계는 클라이언트가 고르지 않는다: strictObject 가 덧붙은 키를 거부하고, 단계 키(pk) 불일치는 재분류 없이 조용히 폐기"
    - "허용 목록 방식 view.me.chat: channelOf 가 null 이면 키 자체를 만들지 않는다"
    - "누설 검사의 역할 단어 허용 경로는 '받을 권리 있는 소켓 조건'으로만 넓힌다 (me.chat=mafia 는 그 밤의 산 마피아 본인만)"

key-files:
  created:
    - test/worker/chat.test.ts
  modified:
    - shared/protocol.ts
    - shared/schemas.ts
    - shared/game/view.ts
    - worker/room.ts
    - src/net/useRoomConnection.ts
    - test/worker/helpers.ts
    - test/worker/leak.test.ts
    - test/unit/view.test.ts
    - test/unit/schemas.test.ts
    - test/unit/gameRoom.test.ts
    - test/worker/http.test.ts
    - test/client/useRoomConnection.test.tsx

key-decisions:
  - "handleTyping 의 폐기 순서: 첨부·방 없음 → 단계 키 불일치 → 채널 없음 → 간격 제한. 어느 것도 오류 프레임을 보내지 않는다"
  - "typingRelays 는 사람 id 키의 인메모리 맵이고 서버 타이머는 없다(A1·A2) — 하이버네이션으로 비면 한 번 더 중계될 뿐"
  - "보낸 사람은 audience 집합에서만 뺀다(A3) — 채널 규칙은 audience 가 그대로 정한다"
  - "view.test 의 역할 단어 검사는 me.chat=mafia 를 night·me.role=mafia·비탈락 조건으로만 허용한다"

patterns-established:
  - "DO 시험은 mark -> 행동 -> settle(ping/pong) 로 '오지 않았음'을 증명하고, 소켓별 typing 프레임을 한 줄 문자열로 비교한다"
  - "중계 기록의 시각은 runInDurableObject 로 typingRelays 를 과거로 당겨 1.5초를 실제로 기다리지 않는다"
  - "변이 검사: 채널을 all 로 돌리기·단계 키 검사 지우기·종료 연결 버림 지우기를 각각 넣어 해당 시험이 실패함을 확인"

requirements-completed: [CHAT-04, CHAT-02, CHAT-03]

coverage:
  - id: D1
    description: "로비 손님의 입력 중 한 번이 보낸 사람 상태 -> 채널 -> audience -> deliver 로 방장 소켓에 {t,seat,on} 으로 가고 보낸 사람에게는 되돌아가지 않는다"
    requirement: "CHAT-04"
    verification:
      - kind: integration
        ref: "test/worker/chat.test.ts#입력 중 — 트레이서 (CHAT-04) (6건)"
        status: pass
      - kind: unit
        ref: "test/unit/schemas.test.ts#ClientMessageSchema typing (07-10, CHAT-04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "밤 산 마피아의 입력 중은 산 마피아와 탈락자에게만, 탈락자의 입력 중은 탈락자에게만, 밤의 산 비마피아·roleReveal 은 아무에게도 가지 않는다. 단계 키가 어긋난 신호(밤 키를 아침에)는 넓은 채널로 돌리지 않고 폐기된다"
    requirement: "CHAT-02"
    verification:
      - kind: integration
        ref: "test/worker/chat.test.ts#입력 중 — 밤의 채널 · 낮의 채널 · 단계 키 · 간격"
        status: pass
    human_judgment: false
  - id: D3
    description: "같은 사람의 켜짐은 1.5초에 한 번만 중계되고(1.5초 뒤 재중계), 켜짐 없는 꺼짐은 중계되지 않는다"
    requirement: "CHAT-04"
    verification:
      - kind: integration
        ref: "test/worker/chat.test.ts#입력 중: 같은 사람의 켜짐은 1.5초 안에 한 번만 …"
        status: pass
    human_judgment: false
  - id: D4
    description: "view.me.chat 이 단계 x 생존 x 역할 표대로 본인에게만 실린다(로비·낮 all, 탈락 ghost, 밤 산 마피아 mafia·산 비마피아 키 없음, assigning·roleReveal·ended 키 없음)"
    requirement: "CHAT-03"
    verification:
      - kind: unit
        ref: "test/unit/view.test.ts#buildView me.chat — 서버가 정한 내 채널 (07-10, CHAT-02·03)"
        status: pass
    human_judgment: false
  - id: D5
    description: "emitWorld 가 audience({k:'world'}) 와 deliver 를 지난 뒤에도 6페이즈 world 동작(로비에서만 방 전원)이 그대로다"
    requirement: "CHAT-04"
    verification:
      - kind: integration
        ref: "test/worker/world.test.ts (전체), test/worker/leak.test.ts#assertWorldFrames"
        status: pass
    human_judgment: false
  - id: D6
    description: "6명 한 판 누설 검사: 밤 마피아의 입력 중이 시민 편 소켓에 0건, typing 프레임 키는 t·seat·on 뿐, me.chat 값 mafia 는 그 밤의 산 마피아 소켓에서만"
    requirement: "CHAT-02"
    verification:
      - kind: integration
        ref: "test/worker/leak.test.ts#6명 한 판(두 밤·두 아침 …) 전수 누출 검사"
        status: pass
    human_judgment: false
  - id: D7
    description: "연결 훅이 typing 을 세 곳(RoomEvent·화이트리스트·분기)에 더해 구독자에게 { epoch } 메타와 함께 흘리고, 끝난 연결의 늦은 typing 과 모르는 t 는 버린다"
    requirement: "CHAT-04"
    verification:
      - kind: unit
        ref: "test/client/useRoomConnection.test.tsx#useRoomConnection: typing 프레임 (CHAT-04, 07-10)"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-11-01
status: complete
plan_head_before: f64b2c2ddd8d7f9e948ab179a713b718306ec53a
plan_head_after: 7ed5d3a7d669316fa36f8e638224c638e667ce6a
commits: 6
---

# Phase 7 Plan 10: 입력 중 서버 길(audience·deliver)과 me.chat Summary

**새 와이어 메시지 하나(입력 중)를 보낸 사람 상태 -> 채널 -> audience -> deliver -> 소켓까지 한 길로 잇고, 위치(world) 전송도 같은 길로 옮기며, view.me.chat 과 연결 훅 typing 까지 닿게 한 서버 트레이서.**

## Performance

- **Duration:** 약 9분
- **Started:** 2026-11-01T13:48:33Z
- **Completed:** 2026-11-01T13:58:00Z
- **Tasks:** 3 (트레이서 1 + auto 2, 모두 TDD)
- **Files modified:** 13 (신규 1, 수정 12)
- **Commits:** 6 (test 3 + feat 3)

## Accomplishments

- `deliver(ids, msg)` 가 이벤트 프레임의 유일한 전송 길이다. 받는 사람은 `audience` 가 정하고, 화면에서 거르는 방식은 쓰지 않는다. `emitWorld` 도 `audience({k:"world"})` 를 지나며 world.test 전체와 world 누설 검사가 그대로 통과한다.
- `handleTyping`: 단계 키(pk)가 서버 단계 키와 다르면 재분류 없이 조용히 버린다. 채널은 `channelOf` 가 보낸 사람의 서버 상태로 정하고, 켜짐은 사람당 1.5초에 한 번만 중계하며 꺼짐은 켜져 있을 때만 중계한다. 보낸 사람 자신에게는 돌려보내지 않는다.
- `TypingMessageSchema`(strictObject): `seat`·`ch`·`id` 가 덧붙으면 BAD_MESSAGE, pk 는 1~32자.
- `view.me.chat`: 로비·낮 `all`, 탈락자 `ghost`, 밤의 산 마피아 `mafia`, 밤의 산 비마피아·assigning·roleReveal·ended 는 키 없음.
- 연결 훅: `typing` 을 세 곳에 더해 구독자에게 `{ epoch }` 메타와 함께 흘린다. 끝난 연결의 늦은 typing 은 world 와 같은 조건으로 버린다.
- 누설 검사: 6명 한 판 1일차 밤에 마피아 A 가 typing 을 보내면 B 만 2프레임(켜짐·꺼짐)을 받고 시민 편·A 자신은 0건이다. typing 프레임 키는 `.t .seat .on` 뿐이고, `me.chat` 값 `mafia` 는 그 밤의 산 마피아 소켓에서만 나온다.

## Task Commits

| Task | RED (test) | GREEN (feat) |
|------|-----------|--------------|
| 1. 트레이서 — 로비 입력 중 한 번이 audience 를 지나 방장 소켓으로 (CHAT-04) | `ceff99d` | `ea6a52c` |
| 2. 채널별 입력 중·간격·me.chat·emitWorld 전환·누설 검사 (CHAT-02·03·04) | `76aa904` | `5fef2b6` |
| 3. 연결 훅 세 곳에 typing (CHAT-04) | `66ae12d` | `7ed5d3a` |

REFACTOR 커밋은 없다(정리할 중복이 없었다).

**Plan metadata:** 이 SUMMARY 의 docs 커밋.

## TDD Gate Compliance

세 작업 모두 `test(07-10)` -> `feat(07-10)` 순서를 지켰다. 매 RED 의 증거는 `vitest --reporter=tap-flat` 보고서를 `gsd-tools check tdd-red-evidence` 에 넣어 `RED_EVIDENCE_OK`(reason `target_test_failed`)를 받았다.

| Task | 목표 테스트 | RED 결과 | 의미 평가(semanticAssessment) |
|------|------------|---------|------------------------------|
| 1 | `chat.test.ts > 입력 중: 로비 손님의 켜짐이 방장 소켓에 …` | 59 중 6 실패 | `expected '' to be '{"t":"typing","seat":1,"on":true}'` — 스키마가 typing 을 BAD_MESSAGE 로 거부해 방장이 프레임을 받지 못하는 계획한 이유로 실패 |
| 2 | `view.test.ts > buildView me.chat … 밤: 산 마피아는 mafia, 산 비마피아는 키 없음` | 12 + leak 1 실패 | `'0:- 1:- 2:- …' 대 '0:- 1:mafia 2:- 3:- 4:mafia 5:-'` — me.chat 이 아직 없어 계획한 어서션 실패. leak.test 도 `expected '' to be '2,3'`(sawChatMafia) 로 실패 |
| 3 | `useRoomConnection.test.tsx > typing 프레임은 구독자에게 …` | 4 중 1 실패 | `expected "vi.fn()" to be called 1 times, but got 0 times` — 화이트리스트가 typing 을 버려 계획한 이유로 실패 |

RED 에서 이미 통과한 시험은 다음과 같다. 이것들은 GREEN 을 이끈 시험이 아니라 회귀 방지 시험이다.

- Task 2 의 chat.test 채널·간격 시험 9건: 입력 중 채널 결정은 Task 1 의 `handleTyping` 이 이미 했으므로 첫 실행부터 통과한다. 대신 변이 검사로 시험이 헛돌지 않음을 확인했다(채널을 `all` 로 돌리면 3건, 단계 키 검사를 지우면 2건 실패).
- Task 3 의 종료 연결 버림 시험 2건: RED 에서는 화이트리스트가 typing 을 먼저 버려 통과한다. 분기에서 `typing` 을 종료 연결 조건에서 빼는 변이를 넣으면 2건이 실패함을 확인했다.

## Tracer 확인

Task 1 은 `type="tracer"` 라 expansion(Task 2·3) 전에 `<verify>` 를 다시 돌렸다. 자동 모드는 꺼져 있고 `gate` 가 `blocking-human` 이 아니며 verify 가 자동 검사뿐이라 체크포인트 없이 `npx vitest run test/worker/chat.test.ts test/unit/schemas.test.ts`(59 통과)와 `npm run typecheck`(통과)를 확인하고 이어서 확장했다.

## Files Created/Modified

- `worker/room.ts` - `typingRelays`, `deliver`, `handleTyping`, `case "typing"`, `emitWorld` 의 audience 전환
- `shared/schemas.ts` - `TypingMessageSchema` 와 유니온 멤버
- `shared/protocol.ts` - `ClientMessage`·`ServerMessage` 유니온에 `TypingSendMessage`·`TypingFrame`, `MyInfo.chat`
- `shared/game/view.ts` - `channelOf` 결과를 `myInfo.chat` 에(허용 목록 방식)
- `src/net/useRoomConnection.ts` - typing 을 타입·화이트리스트·분기와 종료 연결 버림에 추가
- `test/worker/chat.test.ts`(신규) - 입력 중 트레이서·채널·단계 키·간격 DO 시험(07-11·07-14 가 채팅 줄 시험을 더한다)
- `test/worker/helpers.ts` - `phaseKeyOf`, `typingSend`
- `test/worker/leak.test.ts` - typing 키 허용 목록, 시민 편 0건, `.view.me.chat` 조건부 허용
- `test/unit/view.test.ts` - me.chat 표 시험, `ME_KEYS`·`roleValueLeaks` 확장
- `test/unit/schemas.test.ts`, `test/client/useRoomConnection.test.tsx` - 스키마·연결 훅 시험
- `test/unit/gameRoom.test.ts`, `test/worker/http.test.ts` - 대기실 `me` 기대값에 `chat: "all"` 반영

## Decisions Made

- 폐기 순서는 첨부·방 없음 -> 단계 키 불일치 -> 채널 없음 -> 간격 제한이며 어느 것도 오류 프레임을 보내지 않는다(UI-SPEC "서버가 막은 신호에 문구 없음").
- 서버에는 입력 중 타이머가 없다(A1). `typingRelays` 는 메모리 맵이라 하이버네이션으로 비면 새로 센다(A2, 수용).
- 보낸 사람 제외는 `deliver` 에 넘기기 전에 audience 집합에서 뺀다(A3). `audience` 자체는 채널 규칙만 안다.
- `me.chat` 의 값 `mafia` 는 역할 단어(`ROLE_WORDS`)와 겹친다. 누설 검사 두 곳(leak.test, view.test)에서 단순 허용 경로로 넓히지 않고 "그 밤의 산 마피아 본인" 조건과 함께 허용했다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 회귀] 대기실 `me` 정확 일치 시험 두 건이 `chat: "all"` 때문에 깨졌다**
- **Found during:** Task 2 (전체 `npx vitest run`)
- **Issue:** `test/unit/gameRoom.test.ts` 와 `test/worker/http.test.ts` 가 대기실 `view.me` 를 `{ seat: 0, isHost: true }` 로 정확 비교했다. 이 계획이 대기실 view 에 `me.chat = "all"` 을 싣는 것은 truths 가 요구하는 동작이다.
- **Fix:** 기대값을 `{ seat: 0, isHost: true, chat: "all" }` 로 갱신했다. 계획의 files_modified 밖 파일이지만 이 계획의 변경이 직접 일으킨 기대값 변화다.
- **Files modified:** `test/unit/gameRoom.test.ts`, `test/worker/http.test.ts`
- **Verification:** 두 파일 통과, 전체 3717 통과
- **Committed in:** `5fef2b6`

**2. [Rule 3 - 차단 해소] view.test 의 me 키 허용 목록과 역할 단어 검사 확장**
- **Found during:** Task 2 (GREEN 직후 view.test 5건 실패)
- **Issue:** `ME_KEYS` 가 `chat` 을 몰랐고, `roleValueLeaks` 가 `me.chat=mafia` 를 역할 값 누출로 보았다.
- **Fix:** `ME_KEYS` 에 `chat` 을 더하고 `phaseKeyViolations` 에 "me.chat 이 channelOf 와 같고 me 밖에는 chat 키가 없다" 검사를 더했다. `roleValueLeaks` 는 night·`me.role=mafia`·비탈락 조건에서만 `me.chat=mafia` 를 허용한다.
- **Files modified:** `test/unit/view.test.ts`
- **Committed in:** `5fef2b6`

**3. [시험 작성 보정] 계획의 "execution 도 산 사람은 all" 표를 탈락자 반영으로 고쳤다**
- 처형 발표(execution) 단계 상태에는 방금 처형된 사람이 이미 탈락 상태라 그 사람은 `ghost` 다. 산 사람 `all`, 탈락자 `ghost` 로 기대를 만들었다.

**4. [시험 작성 보정] Task 2 의 RED 에 `MyInfo.chat` 타입을 함께 넣었다**
- 07-02 선례와 같다: 타입 없이는 시험이 컴파일되지 않아 `npm run typecheck` 가 깨지므로 타입(동작 없음)을 RED 커밋에 두었다. 이전에 Task 1 의 RED 에도 유니온 멤버 두 개를 같은 이유로 넣었다.

---

**Total deviations:** 4 (Rule 1 회귀 1, Rule 3 차단 해소 1, 시험 작성 보정 2)
**Impact on plan:** 계획의 모든 truths·acceptance 를 만족한다. 기능 범위가 늘지 않았고 기존 시험의 기대값만 새 동작에 맞췄다.

## Issues Encountered

- 대기실에서 `settle` 만으로는 첫 신호의 중계 프레임이 두 번째 `mark` 뒤로 밀려 꺼짐 시험이 두 프레임을 보았다. 첫 신호 뒤에 두 소켓을 flush 한 다음 `mark` 를 잡도록 시험을 고쳤다(구현 문제 아님).
- 변이 검사에서 `ch === null` 검사를 지워도 시험이 실패하지 않았다. `audience` 가 빈 집합을 돌려줘 관찰 결과가 같은 동치 변이이기 때문이며, 그 검사는 타입 좁히기와 방어 장치 역할이다.

## Known Stubs

없음. 새 코드는 모두 서버 상태와 연결되어 있다.

## Threat Flags

없음. 새 네트워크 표면(typing 메시지·프레임)은 계획의 위협 모델에 이미 있다. 완화 상태는 T-07-18(채널·audience·deliver 한 길, 밤 시민 소켓 0건 DO 시험·6명 누설 검사), T-07-19(strictObject 가 덧붙은 키 거부), T-07-20(pk 불일치 폐기, 밤 키를 아침에 보내는 시험), T-07-21(world 전환 후 world.test·leak 의 world 검사 통과), T-07-22(사람당 켜짐 1.5초 1회와 연결당 20/초), T-07-SC(패키지를 설치하지 않음)이다.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 07-11 이 채팅 줄(`chat`/`chatReject`)을 같은 `deliver(audience(...))` 길 위에 얹으면 된다. `chat.test.ts` 에 채팅 줄 시험을 더하는 자리가 있다.
- 07-12 가 `broadcastEvent`·`broadcastEventTo`·`nightChatRecipientIds` 를 지울 수 있다(applySay·applyEmoji 가 아직 쓴다).
- 이월: `view.me.chat` 은 서버가 채웠지만 화면은 아직 읽지 않는다(패널은 07-13~). 연결 훅의 typing 구독자(입력 중 "…" 표시 저장소)는 07-05 와 이후 계획의 몫이다.
- 전체 범위 검증: `npm run typecheck` 통과, `npx vitest run` 138 파일 3717 통과 1 건너뜀(전 계획부터 있던 건너뜀, 이 계획의 `.skip(`·`.todo(` 는 0건).

## Self-Check: PASSED

- 파일: `worker/room.ts`, `shared/schemas.ts`, `shared/game/view.ts`, `shared/protocol.ts`, `src/net/useRoomConnection.ts`, `test/worker/chat.test.ts`, `test/worker/helpers.ts`, `test/worker/leak.test.ts`, `test/unit/view.test.ts`, `test/unit/schemas.test.ts`, `test/client/useRoomConnection.test.tsx` 모두 존재.
- 커밋: `ceff99d`, `ea6a52c`, `76aa904`, `5fef2b6`, `66ae12d`, `7ed5d3a` 모두 HEAD 의 조상. `commits: 6` 은 `git rev-list --count f64b2c2..HEAD` 로 측정했다.
- 수락 기준: 작업별 grep 기준(`private deliver(`, `case "typing"`, `phaseKey(`, `TypingMessageSchema`, `k: "world"`, `myInfo.chat`, `.view.me.chat`, FORBIDDEN_KEYS 줄, `"typing"` 3곳 이상)과 `test(07-10)` 커밋 3건 통과, `.skip(`·`.todo(` 0건.
- 삭제 커밋 없음.

---
*Phase: 07-free-chat*
*Completed: 2026-11-01*
