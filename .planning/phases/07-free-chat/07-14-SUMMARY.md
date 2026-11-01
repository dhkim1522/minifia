---
phase: 07-free-chat
plan: "14"
subsystem: realtime-server
tags: [durable-objects, storage, chat, replay, leak-test, static-guard]

requires:
  - phase: 07-free-chat
    provides: "07-02 chatLog.ts 순수 규칙(appendLine·replayFor·restoreChatLog), 07-11 applyChat·deliver, 07-12 옛 필드 정리"
provides:
  - "DO storage 줄 단위 키 chat:000001… 저장(보내기 전 쓰기)과 생성자 복원"
  - "hello 직후 {t:'chatLog', lines} 한 프레임(state, 로비면 world snap 다음)"
  - "채널별 상한 삭제(128개씩 나눠 delete), 테스트 방 되돌리기·방 삭제 때 chat 정리(dropChat)"
  - "normalizeStoredRoom 이 옛 nextMessageSeq·nextNightSeq·lastSendAt 을 지움"
  - "누설 검사 (a)~(d), 복원 chatLog 키·권리 검사, 전송 길·삭제 식별자 정적 가드"
affects: [07-15, 11-result-reveal]

actuals:
  tokens: 15200
  tasks: 3
  commits: 5
plan_head_before: c48e09039458103944035e3aaf91741c2d391e37
plan_head_after: 72492e0eb28e2b9cac9d9dd7926b1c7d95834f44

tech-stack:
  added: []
  patterns:
    - "쓰기 뒤 전송: appendLine → put(chatKey) → 상한 삭제 → 미리 계산한 집합으로 deliver"
    - "복원은 보낼 때 저장한 마스크로만(replayFor), 지금의 역할·생존으로 다시 계산하지 않는다"
    - "정적 가드는 주석을 지운 소스에서 단어 경계로 식별자를 찾는다(stripComments)"

key-files:
  created:
    - test/worker/chatReplay.test.ts
    - test/worker/chatLeak.test.ts
    - test/unit/chatStaticGuard.test.ts
  modified:
    - worker/room.ts
    - shared/game/room.ts
    - test/worker/helpers.ts
    - test/worker/leak.test.ts
    - test/worker/world.test.ts
    - test/unit/gameRoom.test.ts

key-decisions:
  - "applyChat 을 async 로 바꾸고 handleChat·actAsBot 이 await 한다. 받는 사람 집합은 await 앞에서 계산한 그대로 deliver 에 넘긴다."
  - "chatLog 프레임은 로비가 아니어도 항상 보낸다(줄이 없으면 빈 배열). sendTo 로만 나가고 deliver 를 거치지 않는다."
  - "대량 줄 시험(35·101줄)은 소켓 대신 applyChat 본체를 DO 안에서 직접 부른다. 연결당 초당 20개 한도를 피하되 보관·복원은 같은 본체를 지난다."

patterns-established:
  - "worker 시험의 6명 판 시나리오 도우미(startedGame·withRole·killSeats·pause)는 helpers 에 둔다"

requirements-completed: [CHAT-01, CHAT-02, CHAT-03, CHAT-06]

coverage:
  - id: D1
    description: "받아들인 채팅 줄이 보내기 전에 chat:000001… 키에 레코드로 저장되고, hello 뒤 새 소켓이 [state, snap, chatLog] 로 같은 줄을 돌려받는다(게임 중에는 snap 없음, 줄이 없으면 빈 chatLog)"
    requirement: CHAT-01
    verification:
      - kind: integration
        ref: "test/worker/chatReplay.test.ts#채팅 보관 — 트레이서 (D2, CHAT-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "DO 가 퇴거돼도 생성자가 chat: 키로 같은 줄·다음 seq 를 되살린다"
    requirement: CHAT-01
    verification:
      - kind: integration
        ref: "test/worker/chatReplay.test.ts#DO 가 퇴거돼도 같은 chatLog 를 받고 이어서 보낸 줄의 seq 는 2 이다"
        status: pass
    human_judgment: false
  - id: D3
    description: "복원은 채널별 최근 30줄이고 보낼 때의 마스크로만 거른다(시민 편은 mafia·ghost 0건, 막 탈락한 사람은 탈락 전 mafia 줄 0건)"
    requirement: CHAT-02
    verification:
      - kind: integration
        ref: "test/worker/chatReplay.test.ts#채팅 복원 — 채널별 30줄 / 보낼 때의 마스크로만"
        status: pass
      - kind: integration
        ref: "test/worker/chatLeak.test.ts#누설 검사 (d)"
        status: pass
    human_judgment: false
  - id: D4
    description: "채널별 상한(all 100·mafia 300·ghost 300) 초과 시 가장 오래된 20줄 삭제, 테스트 방 되돌리기와 방 삭제 때 chat: 키 제거"
    requirement: CHAT-01
    verification:
      - kind: integration
        ref: "test/worker/chatReplay.test.ts#채팅 보관 — 상한·리셋·방 삭제"
        status: pass
    human_judgment: false
  - id: D5
    description: "저장된 옛 방의 nextMessageSeq·nextNightSeq·lastSendAt 을 정규화가 지우고, 바뀐 것이 없으면 같은 객체"
    requirement: CHAT-06
    verification:
      - kind: unit
        ref: "test/unit/gameRoom.test.ts#07-14 저장된 옛 방의 nextMessageSeq·nextNightSeq·lastSendAt"
        status: pass
    human_judgment: false
  - id: D6
    description: "누설 검사 (a) 부채널 없음 (b) 탈락자 0건 (c) 단계 키 폐기 (d) 복원 audience, chatLog 프레임 키 허용 목록과 권리 조건"
    requirement: CHAT-03
    verification:
      - kind: integration
        ref: "test/worker/chatLeak.test.ts, test/worker/leak.test.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "전송 길 정적 가드: ws.send 는 sendTo 한 곳, chat·typing 프레임은 deliver 한 길, 지운 식별자와 무차별 전송 함수가 코드에 없다"
    requirement: CHAT-06
    verification:
      - kind: unit
        ref: "test/unit/chatStaticGuard.test.ts"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-11-01
status: complete
---

# Phase 7 Plan 14: 채팅 보관·재접속 복원과 누설 검사 Summary

**채팅 줄을 DO storage 의 줄 단위 chat: 키에 보내기 전에 저장하고, 재접속한 소켓에 보낼 때의 마스크로만 거른 채널별 30줄을 hello 직후 chatLog 한 프레임으로 되돌려 주며, 누설 검사 (a)~(d)와 전송 길 정적 가드로 비공개 채널이 라이브·복원·부채널 어디로도 새지 않음을 고정했다.**

## Performance

- **Duration:** 약 14분
- **Started:** 2026-11-01T14:44Z (대략)
- **Completed:** 2026-11-01T14:58Z
- **Tasks:** 3
- **Files modified:** 9 (신규 3 포함)

## Accomplishments

- `worker/room.ts`: 생성자가 `chat:` 키를 모두 읽어 `restoreChatLog` 로 되살리고, `applyChat` 이 `appendLine` 뒤 `put(chatKey)` → 상한 초과 키 128개씩 `delete` → 미리 계산한 집합으로 `deliver` 한다. `handleHello` 는 state(로비면 snap) 다음에 `replayFor` 결과를 `chatLog` 프레임으로 보낸다. `dropChat` 이 마지막 사람 퇴장·만료·테스트 대기실 되돌리기에서 메모리 사본·도배 기록·입력 중 기록을 비운다.
- `shared/game/room.ts`: `normalizeStoredRoom` 이 옛 방 키 `nextMessageSeq`·`nextNightSeq` 와 Player 키 `lastSendAt` 을 구조 분해로만 빼고, 바뀐 것이 없으면 같은 객체를 돌려준다.
- 복원 규칙 시험: 로비 35줄 → all 30줄(seq 6~35), 6명 판 마스크 시나리오(시민 C, 밤에 탈락한 X, 마피아 B), 상한 101줄 → all 81개, 테스트 리셋·방 삭제.
- 누설 검사: (a) 마피아 활동 유무로 시민 편 summary 가 같다 (b) 탈락자 채팅·입력 중이 산 사람에게 0건 (c) 단계 키 틀린 줄 폐기·미저장 (d) 재접속 chatLog 의 audience. `leak.test.ts` 는 6명 한 판 끝에서 모두 재접속해 chatLog 키 허용 목록, mafia·ghost 권리 조건, 라이브로 받은 줄과의 동일성을 본다.
- 정적 가드: `ws.send` 는 `sendTo` 한 곳, `t: "chat"`·`t: "typing"` 을 만드는 줄은 모두 `this.deliver(`, `chatLog` 는 hello 의 `sendTo`, 지운 식별자 17개와 무차별 전송 함수 이름이 주석 밖 코드에 0건, 연결 훅 화이트리스트에 emoji 가 없다.

## TDD 기록

- **Task 1 (tracer)**
  - RED: `test/worker/chatReplay.test.ts` 6개 시험이 `c4c3ef6` 에서 모두 실패했다. 대상 시험 "손님의 줄은 보내기 전에 chat:000001 에 저장되고…" 는 `expected '' to be 'chat:000001'` 단언에서 실패했고 `gsd-tools check tdd-red-evidence` 가 `RED_EVIDENCE_OK` 를 냈다(대상만 `-t` 로 돌려 TAP 보고서가 깨지지 않게 했다). 의미 평가: 저장 구현이 없어서 chat: 키가 비어 있다는 이유이며 import·픽스처 오류가 아니다.
  - GREEN: `71a712e` (저장·복원·hello chatLog·dropChat·테스트 리셋 삭제).
  - 트레이서 게이트: auto 모드가 아니고 `human_verify_mode` 가 end-of-phase 이며 `<verify>` 가 automated 뿐이므로 `npx vitest run --project worker` 를 다시 돌려 통과(알려진 flaky 1건 제외)를 확인하고 확장했다.
- **Task 2**
  - RED: `c60658d`. `normalizeStoredRoom` 시험이 `RED_EVIDENCE_OK`(`got === stored` 단언 실패). DO 시험(채널별 30줄·마스크·상한·리셋·방 삭제)은 Task 1 GREEN 에서 이미 구현된 동작이라 바로 초록이었다(아래 편차 1).
  - GREEN: `0ec5432`.
- **Task 3**: 시험만 더하는 작업이라 구현 변경이 없다. `d`커밋은 `72492e0`. 시험이 실제로 잡는지 변이로 확인했다(아래).

## Task Commits

1. **Task 1: 트레이서** - `c4c3ef6` (test, RED) → `71a712e` (feat, GREEN)
2. **Task 2: 복원 규칙 전수·정규화** - `c60658d` (test, RED) → `0ec5432` (feat, GREEN)
3. **Task 3: 누설 검사·정적 가드** - `72492e0` (test)

**Plan metadata:** 이 SUMMARY 와 STATE·ROADMAP 커밋(docs)

## Files Created/Modified

- `worker/room.ts` - chat: 저장·복원·hello chatLog·상한 삭제·dropChat·테스트 리셋 삭제
- `shared/game/room.ts` - 옛 채팅 번호·쿨다운 필드 정규화
- `test/worker/chatReplay.test.ts` - 보관·복원·마스크·상한·리셋·방 삭제 시험(신규)
- `test/worker/chatLeak.test.ts` - 누설 검사 (a)~(d)(신규)
- `test/unit/chatStaticGuard.test.ts` - 전송 길·삭제 식별자 정적 가드(신규)
- `test/worker/helpers.ts` - chatKeysOf·chatRecordsOf·framesOf·chatLogOf·helloForLog·lineText, startedGame·withRole·killSeats·pause
- `test/worker/leak.test.ts` - chatLog 키 허용 목록·권리·라이브 동일성
- `test/worker/world.test.ts` - hello 프레임 순서 단언에 chatLog 반영
- `test/unit/gameRoom.test.ts` - 옛 채팅 필드 정규화 시험 3개

## Decisions Made

- `applyChat` 을 async 로 바꾸되 `this.chatLog` 는 `await` 앞에서 갱신하고 받는 사람 집합도 앞에서 계산한다. 저장이 길어져도 같은 집합·같은 순서로 나간다.
- `chatLog` 는 로비가 아니어도 항상 보낸다. 게임 중 재접속은 `[state, chatLog]` 이고 world snap 은 나가지 않는다(T-06-16 유지).
- 부피가 필요한 시험(35·101줄)은 DO 안에서 `applyChat` 본체를 직접 부른다. 소켓 경로의 개별 규칙은 07-11 시험이 이미 증명했다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking/순서] Task 2 의 테스트 리셋 삭제를 Task 1 GREEN 에서 함께 구현**
- **Found during:** Task 1
- **Issue:** `handleTestReset` 의 chat: 삭제와 `dropChat` 은 계획상 Task 2 몫이지만, `dropChat` 을 Task 1 에서 방 삭제 두 길에 쓰도록 만들며 리셋 삭제까지 같은 커밋에 들어갔다. 그 결과 Task 2 의 DO 시험 중 리셋·방 삭제·상한·마스크 시험은 RED 없이 바로 초록이 되었다.
- **Fix:** Task 2 의 RED 를 실제로 실패한 `normalizeStoredRoom` 시험으로 증명하고, 나머지 DO 시험은 변이 확인으로 대신했다. 리셋 삭제 줄 제거, `replayFor` 의 마스크 무시, 상한 삭제 제거 각각에서 해당 시험이 실패함을 확인한 뒤 원복했다.
- **Files modified:** worker/room.ts
- **Committed in:** 71a712e

**2. [Rule 1 - Bug] world.test 의 hello 프레임 순서 단언 갱신**
- **Found during:** Task 1 GREEN 검증
- **Issue:** chatLog 프레임이 hello 뒤에 추가되어 "state,world" 순서 단언이 `chatLog,state,world` 를 받았다(방장 소켓이 읽지 않은 chatLog 가 쌓임).
- **Fix:** 첫 시험은 기대 순서를 `[state, world.snap, chatLog]` 로 바꾸고, 둘째 시험은 mark 전에 chatLog 를 먼저 읽는다. reconnect·join·start·webSocketClose 시험은 깨지지 않아 바꾸지 않았다.
- **Files modified:** test/worker/world.test.ts
- **Committed in:** 71a712e

---

**Total deviations:** 2 (Rule 3 순서 1, Rule 1 시험 갱신 1)
**Impact on plan:** 범위 변화 없음. 증거의 모양(RED 가 일부 시험에서 변이 확인으로 바뀜)만 다르다.

## Issues Encountered

- 전체 `npx vitest run` 에서 알려진 flaky `test/worker/bots.test.ts` "봇 chat: 밤에는 마피아 봇의 줄이…" 가 한 번 실패했다. 지시대로 파일만 다시 돌려 통과했다(19/19). 이 계획의 변경과 무관하다.
- `npm run typecheck` 통과(`wrangler types` 가 `worker-configuration.d.ts` 를 다시 쓰지만 추적 파일 차이는 없었다).
- 첫 RED 증거 기록은 TAP 보고서에 타임아웃 시험의 여러 줄 메시지가 섞여 `INVALID_RED`(Malformed TAP)가 되었다. 대상 시험만 `-t` 로 돌려 보고서를 분리했다.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크 표면은 `chatLog` 프레임 하나이며 계획의 T-07-35·36 에 이미 있고 시험으로 고정했다.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 07-15 가 이어서 돌 수 있다. 클라이언트의 chatLog 구독은 07-11·07-13 에 이미 있다.
- 11페이즈 END-03 공개는 `ChatRecord`(g·ch·seq·seat·text·at·n·r) 모양을 읽는다. 모양을 바꾸면 chatLog.ts·이 DO·11페이즈 코드를 함께 고쳐야 한다.
- 남은 이월 항목은 `deferred-items.md` 참고(개발용 스크립트가 옛 와이어를 보냄, bots.test flake). "채팅 줄 번호는 DO 메모리뿐" 항목은 이 계획에서 닫혔다.

## Self-Check: PASSED

- 생성 파일 3개와 SUMMARY 존재를 확인했다.
- 커밋 5개(c4c3ef6, 71a712e, c60658d, 0ec5432, 72492e0)가 HEAD 의 조상이다.
- 전체 `npx vitest run`: bots flaky 1건 외 통과(재실행 통과), `npm run typecheck` 통과.
- acceptance: Task 1 grep 4종, Task 2 `dropChat`·`nextNightSeq`·`lastSendAt`, Task 3 파일·`"chatLog"`·`.skip(`/`.todo(` 0건 모두 통과.

---
*Phase: 07-free-chat*
*Completed: 2026-11-01*
