---
phase: 07-free-chat
plan: "05"
subsystem: client-chat-state
tags: [chat, store, visualViewport, keyboard, tdd, react-hooks]

requires:
  - phase: 07-free-chat
    provides: "07-02 채팅 와이어 타입(ChatLineWire·TypingFrame·ChatLogFrame·ChatRejectFrame·EMOTE_IDS), 07-03 시각 상수(chatUi.ts)·CHAT_TEXT"
provides:
  - "ChatStore: 줄·복원 합치기·100줄·채널별 표시 흐름·입력 중 만료·막힘 알림·시스템 줄의 React 밖 저장소"
  - "useKeyboardLift: 입력칸 포커스 게이트 visualViewport lift → --mf-kb-lift·--mf-vv-top, open 만 상태"
  - "useChatLogHeight: LOG_H 를 마운트·방향 변경 때만 정하는 훅"
  - "EMOTE_LABEL: 동작 9종 접근성 이름 표(10페이즈 재사용)"
affects: [07-06, 07-13, 07-15, 07-18, 07-19, 07-21]

actuals:
  tokens: 10150
  tasks: 3
  commits: 6
  plan_head_before: 092849ed159427ae656b58fa7368b80da7782901
  plan_head_after: e7eefb1438e79974c33172fdc7c7bc64359e620f

tech-stack:
  added: []
  patterns:
    - "WorldStore 와 같은 형태의 React 밖 저장소(subscribe·notify·revision·reset, epoch 낡은 프레임 버림)"
    - "시각을 저장소가 읽지 않고 now 로 받는다 — 만료 타이머는 부르는 쪽이 nextTypingExpiry(now?)·noticeExpiry() 로 건다"
    - "키보드 값은 React 상태가 아니라 CSS 변수로 쓰고 열림 여부만 상태로 둔다"

key-files:
  created:
    - src/net/chatStore.ts
    - src/net/useKeyboardLift.ts
    - test/client/chatStore.test.ts
    - test/client/keyboardLift.test.tsx
    - test/unit/chatText.test.ts
  modified:
    - src/game/chatText.ts

key-decisions:
  - "nextTypingExpiry 에 선택 인자 now 를 더했다: 타이머가 울린 직후 이미 지난 만료를 다시 받아 곧바로 또 거는 일을 막는다. 인자 없이 부르면 계획의 계약 그대로다"
  - "typingSeats 는 값을 읽기만 하고 정리하지 않는다. 만료된 항목은 다음 typing 적용 때 지운다(시험이 typingSeats(5500) 뒤에도 nextTypingExpiry()=5500 을 요구)"
  - "useKeyboardLift 는 입력칸 focus·blur 를 입력칸이 아니라 document 캡처로 듣고 e.target 으로 걸러, 입력칸이 나중에 그려져도 잡는다"
  - "시스템 줄 키는 sys:{일련번호}:{at}, reset 이 일련번호를 되돌리지 않는다"

patterns-established:
  - "visibleLines 는 표시 흐름 선택이지 보안 경계가 아니다 — 받을 권리 없는 줄은 서버가 보내지 않는다"
  - "채팅 줄은 서버 방송이 와야만 생긴다(낙관적 표시 없음), 시스템 줄만 화면이 addSystem 으로 만든다"

requirements-completed: [CHAT-01, CHAT-03, CHAT-04, CHAT-05]

coverage:
  - id: D1
    description: "ChatStore 가 chat 프레임을 줄 키 채널:seq:at 로 중복 없이 들고 구독자에게 알리며 낡은 epoch 는 버린다"
    requirement: "CHAT-01"
    verification:
      - kind: unit
        ref: "test/client/chatStore.test.ts#ChatStore: chat 프레임 한 줄 (CHAT-01 트레이서)"
        status: pass
    human_judgment: false
  - id: D2
    description: "chatLog 복원은 합집합·at 순·lastWasReplay, 화면 보관은 100줄(시스템 줄 포함) 상한"
    requirement: "CHAT-03"
    verification:
      - kind: unit
        ref: "test/client/chatStore.test.ts#ChatStore: chatLog 복원 합치기 (D2) / 100줄 상한 (T-07-10)"
        status: pass
    human_judgment: false
  - id: D3
    description: "visibleLines 의 all·mafia·ghost 표시 흐름과 저장소가 받지 않은 줄을 만들어 내지 않음"
    requirement: "CHAT-03"
    verification:
      - kind: unit
        ref: "test/client/chatStore.test.ts#ChatStore: 채널별 표시 흐름"
        status: pass
    human_judgment: false
  - id: D4
    description: "입력 중 4500ms 만료·끄는 조건(off·그 좌석 줄·setContext 변경)·좌석 8개 상한, 막힘 알림 2500ms 교체"
    requirement: "CHAT-04"
    verification:
      - kind: unit
        ref: "test/client/chatStore.test.ts#ChatStore: 입력 중 만료 (CHAT-04) / 막힘 알림"
        status: pass
    human_judgment: false
  - id: D5
    description: "useKeyboardLift 의 포커스 게이트 lift·열림 80 경계·블러 즉시 0·지연 재읽기·rAF 한 번·visualViewport 없음·scrollTo 미사용, useChatLogHeight 의 LOG_H 고정"
    requirement: "CHAT-05"
    verification:
      - kind: unit
        ref: "test/client/keyboardLift.test.tsx"
        status: pass
    human_judgment: true
    rationale: "가짜 visualViewport 로 식과 타이밍은 고정했지만 iOS 26.0 의 실제 키보드 값(Pitfall 8)은 실기기에서만 확인된다 — 07-21 사람 확인 몫(가정 A3)"
  - id: D6
    description: "EMOTE_LABEL 이 EMOTE_IDS 와 같은 키 순서 9종, 라벨이 UI-SPEC 표와 같다"
    requirement: "CHAT-01"
    verification:
      - kind: unit
        ref: "test/unit/chatText.test.ts"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-11-01
status: complete
---

# Phase 7 Plan 05: 채팅 저장소와 키보드 배치 훅 Summary

**React 밖 ChatStore(복원 합치기·100줄·채널별 표시 흐름·4500ms 입력 중 만료·2500ms 막힘 알림)와 포커스 게이트 visualViewport 키보드 훅·LOG_H 고정 훅을 TDD 로 만들고 EMOTE_LABEL 9종을 더했다**

## Performance

- **Duration:** 약 10분
- **Started:** 2026-11-01T12:53:59Z
- **Completed:** 2026-11-01T13:03:42Z
- **Tasks:** 3 (트레이서 1 + auto 2)
- **Files modified:** 6 (신규 5, 수정 1)

## Accomplishments

- `ChatStore`: WorldStore 와 같은 형태. 줄 키 `채널:seq:at` 로 중복 제거, 낡은 epoch 버림, 서버 프레임이 와야만 사람 줄이 생김(낙관적 표시 없음)
- 재접속 복원(`chatLog`)은 합집합 병합 후 at 순 정렬이고 `lastWasReplay` 를 켠다. 실시간 줄이 오면 꺼지고, 이미 있는 줄의 중복은 상태를 바꾸지 않는다. 100줄 상한은 시스템 줄 포함
- `visibleLines`: all/null = all+공개 시스템, mafia = mafia+마피아 시스템, ghost = 전부 시간 순
- 입력 중은 받은 시각+4500ms 에 꺼지고 off·그 좌석 줄 도착·setContext 의 pk/channel/epoch 변경·더 새 epoch 에서 비워진다. 좌석은 8개 상한. 막힘 알림은 2500ms 에 하나만이고 기록과 별도 필드
- `useKeyboardLift`: 입력칸 포커스 중에만 `lift = max(0, innerHeight − (vv.height + vv.offsetTop))` 를 rAF 한 번으로 계산해 `--mf-kb-lift`·`--mf-vv-top` 에 쓴다. 열림은 lift>80, 블러 즉시 0, 포커스·블러 뒤 100·300·1000ms 재읽기, visualViewport 없으면 0. React 상태는 `open` 하나뿐
- `useChatLogHeight`: 마운트와 방향 변경(포커스 없을 때)만 LOG_H 를 정한다
- `EMOTE_LABEL`: 동작 9종 라벨(`목 긋기` 등)을 `EMOTE_IDS` 와 같은 키 순서로 고정

## Task Commits

1. **Task 1 (tracer): ChatStore chat 프레임 하나** — `ad946c8` (test, RED) → `78ecd2e` (feat, GREEN)
2. **Task 2: 복원·100줄·표시 흐름·입력 중·막힘 알림·시스템 줄·EMOTE_LABEL** — `4357ec3` (test, RED) → `94297d5` (feat, GREEN)
3. **Task 3: useKeyboardLift·useChatLogHeight** — `bf5ccb4` (test, RED) → `e7eefb1` (feat, GREEN)

**Plan metadata:** 이 SUMMARY 의 docs 커밋(아래 STATE·ROADMAP 갱신 커밋 포함)

## TDD Gate Compliance

세 작업 모두 RED(`test(07-05)`) → GREEN(`feat(07-05)`) 순서다. REFACTOR 커밋은 없다(정리할 변경 없음). RED 근거는 `gsd check tdd-red-evidence` 로 `RED_EVIDENCE_OK` 를 받았다.

- Task 1 RED: 대상 `chat 프레임을 적용하면 구독자가 한 번 알림을 받고 줄이 표시 흐름에 나온다` — 빈 뼈대라 구독자 0회 호출로 단언 실패
- Task 2 RED: 대상 `켜짐을 다시 받으면 만료가 새 시각 + 4500 으로 늘어난다` — 뼈대 `nextTypingExpiry` 가 null. 전체 실행의 여러 줄 diff 가 TAP 파서를 막아("Non-TAP data in report") 한 줄 메시지 시험만 `-t` 로 다시 실행해 근거로 썼다. 전체 25개 실패는 모두 계획된 단언 실패였다
- Task 3 RED: 대상 `포커스 중 lift 60 이면 60px 이고 열림은 아니다` — CSS 변수가 빈 문자열. 12개 실패 모두 계획된 단언 실패
- 각 RED 커밋은 시험이 단언에서 실패하도록 빈 뼈대(src)를 함께 넣어 타입 검사가 통과하는 상태로 남겼다

## Files Created/Modified

- `src/net/chatStore.ts` — ChatStore·ChatStoreLine, 줄·복원·입력 중·알림·시스템 줄
- `src/net/useKeyboardLift.ts` — useKeyboardLift, useChatLogHeight
- `src/game/chatText.ts` — EMOTE_LABEL 과 EmoteId 타입 import, 머리 주석 갱신
- `test/client/chatStore.test.ts` — 저장소 시험 35건
- `test/client/keyboardLift.test.tsx` — 훅 시험 15건
- `test/unit/chatText.test.ts` — EMOTE_LABEL 시험 2건

## Decisions Made

- `nextTypingExpiry(now?)` 에 선택 인자를 더했다. 계획의 계약(인자 없음)과 호환되고, 타이머 재설정 루프를 막는다
- `typingSeats` 는 읽기 전용으로 두고 만료 항목 정리는 다음 typing 적용 때 한다(시험이 요구한 순서)
- 키보드 훅은 focus·blur 를 document 캡처로 듣는다(입력칸이 나중에 그려져도 잡힘)
- 시스템 줄 키 일련번호는 reset 후에도 이어 간다

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] LOG_H 훅 시험이 렌더마다 새 ref 객체를 만들어 훅이 다시 정함**
- **Found during:** Task 3 GREEN
- **Issue:** `방 높이가 바뀌어도 방향 이벤트가 없으면 다시 정하지 않는다` 시험이 `rootRef()` 를 렌더마다 호출해 deps 가 바뀌어 효과가 다시 돌았다. 훅이 아니라 시험의 결함
- **Fix:** 훅마다 ref 를 하나만 만드는 `hook()` 도우미로 시험을 고침
- **Files modified:** test/client/keyboardLift.test.tsx
- **Verification:** 15건 통과
- **Committed in:** e7eefb1

**2. [Rule 3 - Blocking] RED 근거의 TAP 파서가 여러 줄 diff 를 거부**
- **Found during:** Task 2 RED
- **Issue:** 배열 `toEqual` 실패 메시지가 여러 줄이라 분류기가 `invalid_record` 로 막음
- **Fix:** 한 줄 메시지를 내는 대상 시험만 `-t` 로 재실행해 근거로 사용(코드 변경 없음)
- **Committed in:** 해당 없음(절차)

---

**Total deviations:** 2 auto-fixed (Rule 1 하나, Rule 3 하나)
**Impact on plan:** 범위 확장 없음. 인터페이스 변화는 `nextTypingExpiry` 선택 인자 하나뿐이고 계약과 호환된다.

## Issues Encountered

- 계획 `estimate.tokens` 55000 대비 실제 변경량은 chars/4 약 10150 으로 훨씬 작다(시험 코드 비중이 큰 계획이었지만 구현 규모가 예상보다 작았음)

## User Setup Required

None - no external service configuration required.

## Known Stubs

없음. RED 커밋에만 있던 빈 뼈대는 같은 작업의 GREEN 에서 모두 구현으로 바뀌었다.

## Threat Flags

없음. 새 네트워크 경로·인증·파일 접근 없음(T-07-10 줄 100개·입력 중 좌석 8개 상한을 구현으로 완화, T-07-11 은 저장소가 받지 않은 줄을 만들지 않음을 시험으로 고정, T-07-SC 패키지 설치 없음).

## Next Phase Readiness

- 07-06 은 이 계획과 files_modified 가 겹치지 않아 바로 이어 갈 수 있다
- 연결 붙이기는 07-13(로비)·07-15(테이블)·07-18(입력 중 타이머는 `nextTypingExpiry(now)` 사용)·07-19(`lift()` 를 stageInsets 에 사용)
- 남은 위험: iOS 26.0 실기기의 visualViewport 값은 07-21 사람 확인에서만 검증된다(가정 A3)

## Self-Check: PASSED

- 파일 존재: src/net/chatStore.ts, src/net/useKeyboardLift.ts, test/client/chatStore.test.ts, test/client/keyboardLift.test.tsx, test/unit/chatText.test.ts, src/game/chatText.ts 확인
- 커밋 6개(ad946c8, 78ecd2e, 4357ec3, 94297d5, bf5ccb4, e7eefb1)가 HEAD 의 조상임을 확인
- 수용 기준 전부 통과, `npm run typecheck` 종료 0, `npx vitest run --project client --project unit` 126 파일 3675 통과

---
*Phase: 07-free-chat*
*Completed: 2026-11-01*
