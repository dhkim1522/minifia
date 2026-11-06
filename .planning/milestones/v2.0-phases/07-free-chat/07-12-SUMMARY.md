---
phase: 07-free-chat
plan: "12"
subsystem: realtime-chat
status: complete
tags: [free-chat, emoji-removal, deliver, audience, broadcastEvent-removal, leak-test, tdd, vitest, durable-object]

requires:
  - phase: 07-free-chat
    plan: "11"
    provides: "자유 채팅 서버 길(applyChat)과 빠른 메시지 제거 — 남은 emoji 경로를 이 계획이 걷어낸다"
  - phase: 07-free-chat
    plan: "10"
    provides: "deliver(audience) 한 길과 typing 중계 — 무차별 전송을 지울 수 있는 전제"
provides:
  - "와이어: ClientMessage·ServerMessage 에서 emoji 멤버, EMOJI_IDS·EmojiId 삭제. {t:'emoji', ...} 는 BAD_MESSAGE"
  - "shared/game/chat.ts·test/unit/chat.test.ts 삭제 (emote·쿨다운 규칙 전부)"
  - "worker/room.ts: handleEmoji·applyEmoji·broadcastEvent·broadcastEventTo 삭제 — 이벤트 프레임(world·typing·chat)은 deliver(audience) 한 길"
  - "shared/game/night.ts: nightChatRecipientIds 삭제 — 밤 수신자 의미는 audience 의 mafia 행이 맡음"
  - "RoomState.nextMessageSeq·nextNightSeq, Player.lastSendAt 삭제 (저장 방 정리는 07-14 normalizeStoredRoom)"
  - "src/net/useRoomConnection.ts: RoomEvent·화이트리스트·분기에서 emoji 제거 — 늦은 emoji 프레임은 모르는 t 로 버려짐"
affects: [07-13, 07-14, 07-15, 10-emotes]

actuals:
  tokens: 19000
  tasks: 3
  commits: 4

plan_head_before: a697e20962e337310efd2107c0c44078209c670a
plan_head_after: 5adfb17e1cacad4602101d5c40be3b4611377843
commits: 4

tech-stack:
  added: []
  patterns:
    - "와이어에서 멤버를 지울 때는 스키마 거절 시험(RED)을 먼저 커밋하고, 서버·타입·연결 훅 삭제를 한 GREEN 커밋으로 묶는다"
    - "무차별 전송 함수를 지워 이벤트 전송을 deliver 한 곳으로 모으고 grep 게이트(private broadcastEvent|broadcastEventTo()로 고정한다"

key-files:
  created: []
  deleted:
    - shared/game/chat.ts
    - test/unit/chat.test.ts
  modified:
    - shared/protocol.ts
    - shared/schemas.ts
    - shared/game/night.ts
    - shared/game/room.ts
    - shared/game/tick.ts
    - shared/game/testTools.ts
    - shared/game/audience.ts
    - worker/room.ts
    - src/net/useRoomConnection.ts
    - test/unit/schemas.test.ts
    - test/unit/gameRoom.test.ts
    - test/unit/night.test.ts
    - test/unit/testTools.test.ts
    - test/unit/tick.test.ts
    - test/unit/view.test.ts
    - test/unit/nyquist-04-multiday-flow.test.ts
    - test/client/useRoomConnection.test.tsx
    - test/client/roomScreen.test.tsx
    - test/worker/helpers.ts
    - test/worker/day.test.ts
    - test/worker/night.test.ts
    - test/worker/vote.test.ts
    - test/worker/leak.test.ts
    - test/worker/endgame.test.ts
    - test/worker/bots.test.ts
    - .planning/phases/07-free-chat/deferred-items.md

key-decisions:
  - "밤 수신자 의미(산 마피아 + 탈락자)는 audience.ts 의 mafia 행 하나로만 남기고, 그 주석에서 지운 nightChatRecipientIds 언급을 결정 0019·0021 로 고쳤다"
  - "view.test 의 서버 전용 키 목록 두 곳에서 lastSendAt·nextNightSeq 이름을 뺐다 — Task 2 acceptance(test/unit·test/client 0줄)가 우선. 옛 키를 지우는 검사는 07-14 normalizeStoredRoom 시험이 맡는다. worker 의 SERVER_ONLY_KEYS·FORBIDDEN_KEYS 는 그대로"
  - "leak.test 의 밤 emoji 집계는 지우기만 했다. 같은 자리의 typing on·off(마피아 A -> B 2건, 시민 편 0건)와 허용 목록 단언은 07-10 이 이미 갖고 있어 새로 더하지 않았다(가정 A2)"

patterns-established:
  - "밤 마피아 채널 시험: 같은 sendAndSettle 로 chat 과 typing 을 보내 '보낸 소켓 []·동료 [typing]·비마피아 []' 로 비교한다"

requirements-completed: [CHAT-06, CHAT-02, CHAT-03]

coverage:
  - id: D1
    description: "{t:'emoji', icon} 는 와이어 스키마에서 거부되고(BAD_MESSAGE), EMOJI_IDS·EmojiId·shared/game/chat.ts·DO 의 emoji 처리기가 서버·와이어에서 사라졌다"
    requirement: CHAT-06
    verification:
      - kind: unit
        ref: "test/unit/schemas.test.ts#텍스트 이모티콘(emoji)은 와이어에서 사라졌다 (07-12, CHAT-06)"
        status: pass
      - kind: command
        ref: "git grep -E 'EMOJI_IDS|EmojiId|nightChatRecipientIds|nextNightSeq|nextMessageSeq|lastSendAt' -- shared worker src (0줄)"
        status: pass
    human_judgment: false
  - id: D2
    description: "이벤트 프레임은 deliver(audience) 한 길로만 나가고 무차별 broadcastEvent·broadcastEventTo 가 없다. 밤 마피아 채팅·입력 중은 산 마피아 둘에게만 가고 시민 편 소켓은 chat·typing 을 받지 않는다"
    requirement: CHAT-02
    verification:
      - kind: command
        ref: "grep -n -E 'private broadcastEvent|broadcastEventTo\\(' worker/room.ts (0줄)"
        status: pass
      - kind: integration
        ref: "test/worker/night.test.ts#마피아의 밤 chat·입력 중은 살아 있는 마피아 둘에게만 가고 비마피아 네 소켓은 chat·typing 프레임을 받지 않는다"
        status: pass
      - kind: integration
        ref: "test/worker/leak.test.ts#모든 프레임·HTTP 응답에 남의 토큰·역할·동료가 없고 역할 수는 구성표와 같다"
        status: pass
    human_judgment: false
  - id: D3
    description: "늦게 오는 emoji 프레임은 연결 훅이 모르는 t 로 버려 구독자와 view 에 닿지 않는다"
    requirement: CHAT-06
    verification:
      - kind: component
        ref: "test/client/useRoomConnection.test.tsx#emoji 프레임은 모르는 t 로 버려져 리스너에 가지 않고 view 도 바뀌지 않는다 (07-12, CHAT-06)"
        status: pass
    human_judgment: false
  - id: D4
    description: "화면이 없는 단계(공개·변론·처형)의 자유 채팅 전달과 종료 뒤 거절은 이모티콘 없이도 그대로 유지된다"
    requirement: CHAT-03
    verification:
      - kind: integration
        ref: "test/worker/vote.test.ts (공개 중·최후 변론·처형 중 chat 시험)"
        status: pass
      - kind: integration
        ref: "test/worker/endgame.test.ts#종료 중 (D-28)"
        status: pass
    human_judgment: false
---

# Phase 7 Plan 12: 텍스트 이모티콘·무차별 전송 제거 Summary

**emoji 와이어·DO 처리기·shared/game/chat.ts·broadcastEvent 계열·옛 채팅 번호/쿨다운 필드를 서버에서 지워, 이벤트 프레임이 deliver(audience) 한 길로만 나간다.**

## 수행 내용

- **Task 1 (RED -> GREEN)**: `schemas.test` 에 emoji 거부 시험을 먼저 더해 실패를 확인하고(`RED_EVIDENCE_OK`) 커밋한 뒤, 와이어(`EMOJI_IDS`·`EmojiId`·양쪽 emoji 멤버)·스키마·`chat.ts`·`nightChatRecipientIds`·`handleEmoji`/`applyEmoji`·`broadcastEvent`/`broadcastEventTo`·`nextMessageSeq`/`nextNightSeq`/`lastSendAt`·연결 훅의 emoji 를 한 번에 지웠다.
- **Task 2**: unit·client 시험에서 옛 필드·함수 단언을 정리했다. `useRoomConnection` 의 "emoji 를 흘린다" 시험은 "모르는 t 로 버려진다" 단언으로 바꿨다.
- **Task 3**: worker 시험의 emoji 송신·기대를 지우고(`day` 의 이모티콘 describe 통째, `vote`·`endgame`·`night`·`bots`), 밤 마피아 시험은 typing 중계 단언으로 바꿨다. `backdateSends`(이미 쓰는 곳 없음)를 지웠고 leak.test 의 밤 emoji 집계를 걷어냈다.

## TDD Gate Compliance

- RED: `892717e test(07-12)` — `ClientMessageSchema` 가 `{t:"emoji", icon:"smile"|"exclaim"}` 를 받아들이는 상태에서 "웃는 얼굴/느낌표 의 emoji 는 거부한다" 두 건이 `expected true to be false` 로 실패(70건 중 2건). `gsd_run check tdd-red-evidence` 가 `RED_EVIDENCE_OK`(target_test_failed). semanticAssessment: 대상 시험이 실제로 실행돼 계획한 단언(success === false)에서 실패했고, 모르는 아이콘 사례는 이미 거부라 통과 — 의도한 부분집합만 실패.
- GREEN: `e89d954 feat(07-12)` — `schemas.test` 70건 통과, `vite build` 통과.
- REFACTOR: 없음.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 2 files 밖의 시험 두 곳이 지운 `chat.ts` 를 import 했다**
- **Found during:** Task 2 (`tsc -p tsconfig.app.json`)
- **Issue:** `test/unit/view.test.ts`(`emote` 로 `lastSendAt` 채우기)와 `test/unit/nyquist-04-multiday-flow.test.ts`(종료 뒤 `emote` WRONG_PHASE)가 삭제된 `shared/game/chat` 를 불러 모듈 해석 오류.
- **Fix:** view.test 는 `emote` 전이 의존(`react`·`DAY1_START`·`discussionStartsAt`)을 지우고 토론 상태를 `stateAt` 그대로 쓰게 했다. nyquist-04 는 `emote` 한 건을 빼고 기대 배열을 세 건으로 줄였다.
- **Files modified:** test/unit/view.test.ts, test/unit/nyquist-04-multiday-flow.test.ts
- **Commit:** 1c050bc

**2. [Rule 3 - Blocking] 계획 files 밖의 `audience.ts` 주석이 지운 함수를 가리켰다**
- **Found during:** Task 1
- **Fix:** `shared/game/audience.ts` mafia 행 주석을 결정 0019·0021 설명으로 고쳤다(코드 변경 없음). 그래야 acceptance grep(`nightChatRecipientIds` 0줄)이 `shared` 전체에서 통과한다.
- **Commit:** e89d954

**3. [Rule 3 - Blocking] `test/worker/bots.test.ts`·`test/client/roomScreen.test.tsx` 의 emoji 참조**
- **Issue:** bots.test 가 `m.t === "emoji"` 로 비교해 tsc 의 타입 겹침 오류, roomScreen.test 는 제목 문구만.
- **Fix:** bots.test 의 emoji 조건 삭제, roomScreen.test 제목에서 emoji 제거.
- **Commit:** 5adfb17, 1c050bc

### 계획과 달리 한 일 (의도된 선택)

- view.test 의 서버 전용 키 목록에서 `lastSendAt`·`nextNightSeq` 이름을 뺐다(Task 2 acceptance 우선). worker 의 `SERVER_ONLY_KEYS`·`FORBIDDEN_KEYS` 는 줄지 않았다. 상세는 `deferred-items.md`.
- leak.test 가정 A2: 밤 typing on·off 와 시민 편 0건 단언은 07-10 이 이미 같은 자리에 갖고 있어, emoji 행동·집계를 지우기만 했다.

**Total deviations:** 3 auto-fixed (Rule 3 x3). **Impact:** 모두 삭제된 모듈을 가리키던 시험·주석 정리라 범위 확장은 없다.

## 미룬 항목 (`deferred-items.md`)

- emoji 를 보내거나 기다리는 개발용 스크립트·E2E(`scripts/*.mjs`, `scripts/e2e/*`) — 07-11 항목과 함께 정리.
- `test/worker/bots.test.ts` "봇 chat: 밤에는 마피아 봇의 줄이..." 의 무작위 flake(07-12 와 무관, 전체 worker 한 번에서 1회 재현, 단독 3회·이어진 전체 실행 통과).

## Known Stubs

없음.

## Threat Flags

없음. 위협 T-07-30(무차별 전송)·T-07-31(옛 번들 emoji)은 함수 삭제와 스키마 거부 시험으로 완화됐다.

## 검증

- `npx vitest run`: 137 파일, 3699 통과 (1 skipped 는 기존).
- `npm run typecheck`(두 tsc 포함), `npx vite build` 통과.
- acceptance: `chat.ts`·`chat.test.ts` 없음, `private broadcastEvent|broadcastEventTo(` 0줄, `EMOJI_IDS|EmojiId|nightChatRecipientIds|nextNightSeq|nextMessageSeq|lastSendAt` 가 shared·worker·src 에서 0줄(test/unit·test/client 도 0줄), `"emoji"` 가 useRoomConnection.ts·test/worker 에서 0줄, `SERVER_ONLY_KEYS`·`FORBIDDEN_KEYS` 유지, `.skip(`·`.todo(` 0줄, `test(07-12)` 커밋 존재.

## Self-Check: PASSED

- 삭제 확인: `shared/game/chat.ts`·`test/unit/chat.test.ts` 없음.
- 커밋 확인: 892717e(RED), e89d954(GREEN), 1c050bc, 5adfb17 모두 HEAD 의 조상.
