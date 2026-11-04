---
phase: 09-night-morning
plan: "25"
subsystem: client-chat-will-police
tags: [gap-closure, will-quill, ime, seat-color]
status: complete

requires:
  - phase: 09-night-morning
    provides: ChatPanel 깃펜(09-11), WillSheet·useComposedText·useWill(09-08·09-17), PoliceResultCard(09-18)
provides:
  - 낮 입력줄 [입력칸][보내기][깃펜] 순서, 깃펜 margin-left space-sm(보내기와 16px)
  - useComposedText.settle 대기 콜백 목록(키 중복 방지) — 저장 → 닫기가 차례로 실행
  - useWill.close 의 확인 대기 중 같은 글 재전송 생략
  - assets.seatColorVar(seat) — --seat-1~8 한 곳
affects: [09-27 GamePanel seatColor 수정, 09-30 결정 기록(0062 깃펜 위치 변경)]

requirements-completed: []

gap_closure: [feedback-11, review-IN-01, review-WR-02]

actuals:
  tokens: 5900
  tasks: 3
  commits: 6
plan_head_before: 7acb59e3164123ce17cfa3e9eaded228161ed10a
plan_head_after: 8f72c560c23fa3bc76adbc16d186046064be93a9

key-files:
  created: []
  modified:
    - src/components/v2/ChatPanel.tsx
    - src/styles/v2.css
    - src/net/useComposedText.ts
    - src/net/useWill.ts
    - src/components/v2/WillSheet.tsx
    - src/components/PoliceResultCard.tsx
    - src/net/assets.ts
    - test/client/chatPanel.test.tsx
    - test/client/willFlow.test.tsx
    - test/client/willSheet.test.tsx
    - test/client/killFx.test.tsx
    - test/unit/assets.test.ts

key-decisions:
  - "feedback-11: 깃펜을 form 마지막(보내기 뒤)으로 옮기고 .mv-chat__will 에 margin-left var(--space-sm) 를 더해 보내기와 16px(gap 8 + 8). 마크업·속성·이름은 그대로."
  - "IN-01: settle 이 대기 목록(콜백 배열 + 타이머 하나)을 갖고, 선택 인자 key(없으면 함수 참조)가 같으면 쌓지 않는다. WillSheet 의 save·close 는 매 렌더 새 함수라 key 'save'·'close' 를 준다(계획의 'WillSheet 쪽 ref' 대신 훅 인자로 같은 효과)."
  - "IN-01: useWill.close 가 같은 종류·같은 글이 확인 대기 중이면 submit 없이 kept 에 글을 남기고 닫는다(save 와 같은 검사). will 메시지는 1회, 오류 알림 없음."
  - "WR-02: seatColorVar 를 assets.ts 에 두고 PoliceResultCard 만 바꿨다. FaceList·WorldStage 는 이미 맞고 GamePanel 은 09-27."

metrics:
  duration: "약 20분"
  completed: 2026-11-04
---

# Phase 9 Plan 25: 깃펜 오른쪽 끝·조합 중 저장→닫기·경찰 카드 좌석 색 Summary

낮 유언 깃펜을 [입력칸][보내기][깃펜] 의 오른쪽 끝(보내기와 16px)으로 옮기고, 한글 조합 중 [저장] 뒤 [닫기]가 버려지던 문제와 경찰 결과 카드 대체 원의 좌석 색 변수 한 칸 어긋남을 고쳤다.

## 한 일

1. **feedback-11 (T-09-53)**: ChatPanel 의 깃펜 블록을 보내기 버튼 뒤로 옮기고 머리 주석·onWill 주석을 새 위치로 고쳤다. v2.css `.mv-chat__will` 에 `margin-left: var(--space-sm)`. 흐름 시험은 낮 토론에서 깃펜을 눌러 시트를 열고 쓰고 저장·닫는 동안 typing 0회와 깃펜이 form 의 마지막 요소임을 고정한다.
2. **IN-01 (T-09-54)**: `useComposedText` 가 조합 중 대기 콜백을 목록으로 쌓아 compositionend(또는 IME_WAIT_MS) 때 같은 DOM 값으로 차례로 한 번씩 부른다. 같은 키는 한 번만 쌓는다. `useWill.close` 는 확인 대기 중인 같은 글이면 다시 보내지 않고 닫는다.
3. **WR-02**: `seatColorVar(seat)` = `var(--seat-${((seat % 8) + 8) % 8 + 1})`. 경찰 카드 대체 원이 좌석 0 → seat-1, 5 → seat-6 을 쓴다.

## TDD

- RED 1 (`87abc27`): 깃펜 위치·margin-left·흐름 시험 3건이 기대 위치/규칙 어긋남 단언으로 실패. semanticAssessment: 대상 단언이 계획한 이유로 실패(구문·로드 오류 아님).
- RED 2 (`942312a`): IN-01 시험 4건(시트 3·흐름 1)이 onClose 0회·시트가 안 닫힘 단언으로 실패.
- RED 3 (`5be1b18`): seatColorVar 는 함수 부재(TypeError, 대상 시험 안), 경찰 카드는 `var(--seat-0)` ≠ `var(--seat-1)` 단언으로 실패.
- GREEN: `8a6deda`, `d7266fd`, `8f72c56`. REFACTOR 없음.

## 검증

- 대상 시험(chatPanel·willFlow·willSheet·nightChat·keyboardLift·killFx·assets) 통과, `npm run typecheck` 오류 없음.
- 전체 `vitest run`: 알려진 불안정 `testTools.test.ts`(ended) 실패, killFx(의사)·roleCardSheet(doctor) 는 부하 때 24초 시간 초과였고 단독 재실행에서 통과. 이번 변경과 무관.

## Deviations from Plan

IN-01 의 "같은 콜백" 판정을 함수 참조만으로 하지 않고 `settle(cb, key?)` 선택 인자를 추가했다(저장 두 번 방지를 WillSheet ref 대신 훅에서). 동작은 계획 behavior 와 같다. [Rule 3 - 계획의 대체 방식 중 하나]

결정 문서 `docs/decisions/0062-*` 는 이 계획에서 만들지 않았다(코드 주석이 0062 를 가리킴). 09-30 이 기록한다.

## Known Stubs

없음.

## Self-Check: PASSED

- 파일 12개 변경 확인, 커밋 6개(87abc27, 8a6deda, 942312a, d7266fd, 5be1b18, 8f72c56) 존재.
