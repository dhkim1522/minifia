---
phase: 09-night-morning
plan: "11"
subsystem: chat-panel
tags: [chat, card, will, note, quill, tdd, tracer]
status: complete

requires:
  - phase: 09-night-morning
    provides: ChatLineWire.k (09-07), V2Icon quill·note·eye (09-05), WillSheet 시트 (09-08)
provides:
  - ChatStore kind "card" 줄(card will|note|eye, title, revealAt), CARD_HOLD_MS 2800·CARD_HOLD_EXEC_MS 2400
  - visibleLines(channel, now?) 보류 거르기, nextCardReveal(now), addLocalCard({icon:"eye",title,text,at})
  - useChat 카드 → ChatPanelMessage { kind:"card", card, title, icon, tone } + 공개 시각 타이머(cardTick)
  - CHAT_TEXT.cardWill(name)·cardNote·will·willSaved
  - ChatPanel card 블록 [data-card="will|note|eye"], 깃펜 버튼 [data-will-button] (onWill·willOpen·willSaved)
  - CSS .mv-chat__card(--mafia)·-title·-text, .mv-chat__will·-dot
affects: [09-14, 09-17, 09-18]

actuals:
  tokens: 11500
  tasks: 3
  commits: 5
plan_head_before: 220663e6a9b221a2aecbeb85c61f4d7b4318a0d2
plan_head_after: be1d706b20b9e507492001295532722cc63845d9

tech-stack:
  added: []
  patterns:
    - "시각 의존 목록은 저장소가 시각을 읽지 않고 visibleLines(ch, now)·nextCardReveal(now) 로 부르는 쪽이 타이머를 건다(nextTypingExpiry 선례)"
    - "카드 판별은 서버 k 필드 유무만 본다 — 본문 내용으로 카드를 만들지 않는다(위장 방지)"

key-files:
  created: []
  modified:
    - src/net/chatStore.ts
    - src/net/useChat.ts
    - src/components/v2/ChatPanel.tsx
    - src/game/chatText.ts
    - src/styles/v2.css
    - test/client/chatStore.test.ts
    - test/client/chatPanel.test.tsx
    - test/client/useChat.test.tsx
    - test/client/v2parts.test.tsx

key-decisions:
  - "라이브 카드의 보류는 저장소가 받은 시각(now) + 단계 키가 ':execution' 으로 끝나면 2400ms, 아니면 2800ms 로 기록하고, 재접속 chatLog 의 카드는 revealAt 없이 바로 보인다"
  - "카드 변형 클래스는 계획대로 .mv-chat__card--mafia (승인 원본의 is-mafia 대신)"

requirements-completed: []

duration: 25min
completed: 2026-11-03
---

# Phase 9 Plan 11: 채팅 카드와 입력줄 깃펜 Summary

서버가 만든 유언·쪽지 줄(k)을 보류 시간 뒤 채팅창 카드로 보여 주고, 이 화면만 가진 경찰 카드와 입력줄 왼쪽 깃펜(유언 쓰기) 버튼을 채팅 패널에 더했다.

## 작업 결과

1. **트레이서 (유언 카드 한 장)**: chat 프레임 k → ChatStore card 줄(보류) → useChat 메시지 → ChatPanel `data-card`. 입력 중 표시는 카드 프레임이 지우지 않는다. 본문은 React 텍스트 노드(`<b>x</b>` 가 글자 그대로).
2. **경찰 로컬 카드**: `addLocalCard` — 보류 없음, 재접속 복원 대상 아님, `reset()` 으로 사라짐. 사람 줄은 본문이 `[유언]…` 이어도 player.
3. **깃펜**: `onWill` 이 있을 때만 48×48 버튼. 저장됨이면 이름 "유언 쓰기, 저장됨"+점, 열림이면 `aria-pressed="true"`, mousedown 기본 동작 차단, onChange·typing 경로 미호출.

## TDD 기록

- **RED (트레이서)**: `f717705` — 대상 시험 12건이 계획한 단언(카드 kind·보류·typing 유지·메시지 매핑·`data-card`)이나 `store.nextCardReveal is not a function`(없는 심볼)으로 실패. 구문·수집 오류 없음. semanticAssessment: 계획한 동작의 부재로 실패, 정당한 RED.
- **GREEN**: `b4823f7`.
- **Task 2 RED**: `0446a04` — `addLocalCard`·eye 매핑이 Task 1 의 카드 매핑과 한 덩어리라 Task 1 GREEN 에 함께 들어갔고, 이 시험은 처음부터 통과한다(특성 시험). 계획의 "RED 먼저"를 지키지 못한 부분.
- **Task 3 RED**: `c631711` — 4건 실패(버튼 없음·이름·mousedown·CSS), GREEN `be1d706`.
- REFACTOR 없음.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] v2parts 진홍 검사 제외 목록에 `.mv-chat__card--mafia` 추가**
- **Found during:** Task 1 GREEN
- **Issue:** 쪽지 카드의 진홍 테두리(crimson-700)가 7페이즈 규칙 "진홍은 crimson-300 글자색뿐" 검사를 깨뜨림 (09-08 의 `.mv-will--mafia` 와 같은 사례)
- **Fix:** 제외 정규식과 주석에 한 줄 추가
- **Files modified:** test/client/v2parts.test.tsx (계획의 files_modified 밖)
- **Commit:** b4823f7

**2. [Rule 1 - Bug] Task 3 커밋에서 시험 파일 타입 오류**
- 시험의 `btn?.compareDocumentPosition` 가 TS2532. 같은 커밋을 amend 로 고쳐 `be1d706` 에 담음 (typecheck 통과 확인).

**3. 카드 제목 문구를 CHAT_TEXT 에 둠** — 계획 files_modified 에 `src/game/chatText.ts` 가 없으나 문구 한 곳 규칙을 따라 `cardWill`·`cardNote`·`will`·`willSaved` 를 거기에 추가.

## 요구사항 처리

- MORN-02·WILL-01 은 완료 처리하지 않았다. MORN-02 는 서버가 카드 줄을 만드는 09-14 와 화면 장착 뒤, WILL-01 은 서버 저장(09-12)·장착(09-17) 뒤에 완료한다.

## Known Stubs

없음. (`onWill`·`willOpen`·`willSaved`, `addLocalCard` 는 아직 부르는 쪽이 없다 — 09-17·09-18 에서 장착.)

## Threat Flags

없음. T-09-23(React 텍스트 노드, `<b>` 시험)·T-09-24(k 필드만 판별, 사람 줄 시험) 완화 확인.

## 검증

- `npm run typecheck` 통과, `npm run tokens:check` 통과, `npx vitest run --project client` 44 파일 통과(1420+ 통과, 6 skip 기존).

## Self-Check: PASSED

- 커밋 f717705, b4823f7, 0446a04, c631711, be1d706 존재.
- `data-card`·`data-will-button`·`nextCardReveal`·`addLocalCard`·`.mv-chat__card`·`.mv-chat__will` grep 성공.
