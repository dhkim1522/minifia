---
phase: 03-night-morning
plan: 06
subsystem: client-chat
tags: [tdd, tracer, night, chat, spectator, message-log, quick-message]
status: complete

requires:
  - phase: 03-night-morning/03-04
    provides: NIGHT_TEMPLATE_ORDER, 밤 TEMPLATE_CHIP, QUICK_TEMPLATES.when, nextNightSeq(밤 줄 번호 따로 세기)
provides:
  - CHAT_PHASES(discussion·night)와 (일차:단계) 열쇠로 비우는 useSeatFloats·useDayChat (src/net/seatFloats.ts)
  - MessageLog 의 systemLine(첫 줄 안내)·label(로그 이름)·more(^ 버튼 유무), SystemLineItem 부품 (src/components/MessageLog.tsx)
  - ChatHistorySheet 의 systemLine(모달 맨 위 안내, 빈 상태 문구 없음)
  - QuickMessageSheet·DiscussionControls 의 templates prop(밤은 NIGHT_TEMPLATE_ORDER)
  - ReadOnlyRow·READ_ONLY_TEXT(관전 하단 읽기 전용 안내 줄), .mf-msglog__item--sys·.mf-ro 스타일
affects: [03-07, 03-08, 03-09, 03-10, 03-11, 03-12]

tech-stack:
  added: []
  patterns:
    - "수집 단계 판정과 비움 열쇠를 chatKey(view) 하나로 둔다: 수집 단계일 때만 `${일차}:${단계}`, 아니면 undefined. 두 훅이 같은 열쇠를 쓰고 열쇠가 바뀌면(낮 → 밤, 밤 → 아침, 일차 변경) 줄·반전·이모티콘을 비운다"
    - "줄 번호의 중복 제거 기준(maxSeq)이 열쇠 단위라 밤 줄 번호가 낮과 따로 1부터 다시 세어져도 받는다"
    - "채팅 부품의 변형(안내 줄·이름·^ 버튼·문구 모음)은 새 부품이 아니라 선택 prop 으로 푼다 — 입력 없이 그린 낮 화면의 마크업은 그대로"

key-files:
  created:
    - src/components/ReadOnlyRow.tsx
    - test/client/nightChat.test.tsx
  modified:
    - src/net/seatFloats.ts
    - src/components/MessageLog.tsx
    - src/components/ChatHistorySheet.tsx
    - src/components/QuickMessageSheet.tsx
    - src/components/DiscussionControls.tsx
    - src/styles/day.css
    - test/client/seatFloats.test.tsx
    - test/client/quickMessageSheet.test.tsx

key-decisions:
  - "훅 이름은 그대로 두고 수집 단계를 CHAT_PHASES 로 넓혔다. 비우는 열쇠는 일차만 보던 것을 (일차, 단계)로 넓혔다 — 낮 → 밤 섞임과 밤이 끝난 뒤 남는 마피아 줄(T-03-19)을 같은 규칙 하나로 막는다"
  - "화면은 받은 밤 이벤트를 역할로 다시 거르지 않는다. 누가 받는지는 서버(03-07)가 정한다(결정 0002·0021)"
  - "시스템 안내 줄은 화면 문구라 seq 가 없고 MessageLog·ChatHistorySheet 가 SystemLineItem 하나를 공유한다. 안내가 있으면 빈 상태 문구는 쓰지 않는다"
  - "수집 단계가 아닌 단계에서 useDayChat 은 항상 빈 목록을 돌려준다(이전에는 같은 일차 안의 다른 단계에서 지난 줄이 남을 수 있었다)"

requirements-completed: []

duration: 약 25분
completed: 2026-10-25

coverage:
  - id: C1
    description: "밤에 받은 chat 은 useDayChat 줄이 되고 emoji·chat 은 useSeatFloats 이모티콘·반전이 된다. 낮 토론에서 받은 줄·반전·이모티콘은 같은 일차의 밤으로 바뀌면 보이지 않고, 밤 → 아침으로 바뀌면 모두 비워지며, 아침·직업 공개 중 온 이벤트는 버려진다. 밤 줄 번호는 낮과 따로 1부터 다시 센다(낮 seq 7 뒤에도 밤 seq 1·2 를 받는다)"
    requirement: "COMM-04"
    verification:
      - kind: unit
        ref: "test/client/seatFloats.test.tsx#밤 수집 (D-17, 결정 0019, RESEARCH Pitfall 4)"
        status: pass
    human_judgment: false
  - id: C2
    description: "MessageLog 는 systemLine 이 있으면 [안내, ...줄] 의 마지막 3줄을 그린다. 안내 li 는 점·이름 없이 본문만이고 최신이어도 --latest 가 붙지 않으며, 줄이 쌓이면 안내가 창 밖으로 밀리고, 안내가 있으면 '아직 메시지가 없어요' 가 없다. label 로 로그 이름을 바꾸고 more={false} 면 ^ 버튼이 없다. 채팅 내역 모달 맨 위에는 안내가 늘 있다"
    requirement: "NIGHT-04"
    verification:
      - kind: unit
        ref: "test/client/nightChat.test.tsx#MessageLog 안내 줄 (UI-SPEC N-2)"
        status: pass
      - kind: unit
        ref: "test/client/nightChat.test.tsx#모달 안내 줄·관전 하단 부품 (결정 0021)"
        status: pass
    human_judgment: false
  - id: C3
    description: "빠른 메시지 시트는 templates 로 받은 문구를 그 순서대로 칩으로 그리고 첫 칩이 선택돼 있다. 밤 세 문구는 대상이 나를 뺀 생존자(동료 포함)이고 직업 칸이 없으며 보내면 {template, target} 또는 {template} 만 담긴다. templates 를 주지 않으면 낮 다섯 칩 그대로다. DiscussionControls 가 templates 를 시트에 그대로 넘긴다"
    requirement: "COMM-04"
    verification:
      - kind: unit
        ref: "test/client/quickMessageSheet.test.tsx#QuickMessageSheet — 밤 문구 (D-17)"
        status: pass
      - kind: unit
        ref: "test/client/nightChat.test.tsx#밤 조작 줄·모달"
        status: pass
    human_judgment: false
  - id: C4
    description: "ReadOnlyRow 는 p.mf-ro 하나로 '탈락했어요 · 볼 수만 있어요' 를 그리고 버튼·포커스 가능한 요소가 없으며, .mf-ro 스타일이 시안 .ro 값(min-height --tap-min·night-700·gray-300·14px·--radius-md·가운데)이다"
    requirement: "ELIM-01"
    verification:
      - kind: unit
        ref: "test/client/nightChat.test.tsx#모달 안내 줄·관전 하단 부품 (결정 0021)"
        status: pass
    human_judgment: false
  - id: C5
    description: "마피아 채팅 안내 줄('마피아끼리만 보여요'·'관전 중 · 마피아 채팅')의 gray-500 글자가 실제 폰에서 읽을 수 있다"
    requirement: "NIGHT-04"
    verification:
      - kind: backstop
        ref: "03-12 배포본 확인"
        status: pending
    human_judgment: true
    rationale: "gray-500 은 시안 .lg li.sys 의 승인 값이다. 야외 밝기·실제 화면에서의 판독성은 코드 테스트로 알 수 없어 배포본에서 사람이 본다"
  - id: C6
    description: "이 계획의 부품을 장면에 꽂는 일(마피아·관전 하단 구성)과 밤 줄을 누구에게 보내는지는 범위 밖이다 — 03-08(하단)·03-07(서버 방송)"
    requirement: "NIGHT-04, ELIM-01, COMM-04"
    human_judgment: true
    rationale: "부품은 prop 만 받고 아직 어느 장면에도 꽂혀 있지 않다. 밤 화면 전체는 03-08 이후에 확인된다"

actuals:
  tokens: 6600
  tasks: 3
  commits: 6
plan_head_before: 7b99384e2562250123b3faa20a5a06075034e914
plan_head_after: c152e018a4b4fe67aa47c5302152c780f7811337
---

# Phase 3 Plan 06: 밤 마피아 채팅·관전 읽기 전용 채팅 부품 Summary

**낮 토론의 채팅 부품을 그대로 두고 수집 단계를 낮 토론·밤으로 넓히며(단계·일차가 바뀌면 비움), 로그에 안내 줄·이름·^ 버튼 선택권을, 빠른 메시지 시트에 문구 모음을, 관전 하단에 읽기 전용 안내 줄 부품을 더했다.**

## Performance

- **Duration:** 약 25분 (2026-10-25)
- **Tasks:** 3 (Task 1 트레이서 TDD, Task 2 TDD, Task 3 TDD)
- **Files:** 소스 7개(seatFloats·MessageLog·ChatHistorySheet·QuickMessageSheet·DiscussionControls·ReadOnlyRow·day.css), 테스트 3개

## Accomplishments

- `src/net/seatFloats.ts`: `CHAT_PHASES = {discussion, night}`, `chatKey(view)`(수집 단계일 때만 `${일차}:${단계}`). 두 훅이 같은 열쇠로 받고 비운다. 머리 주석의 규칙 목록을 밤·서버 방송·단계 전환 비움으로 고쳤다.
- `src/components/MessageLog.tsx`: `systemLine`·`label`(기본 "최근 채팅")·`more`(기본 true). 목록은 `[안내, ...줄]` 의 마지막 3줄. `SystemLineItem` 을 내보내 ChatHistorySheet 가 공유한다.
- `src/components/ChatHistorySheet.tsx`: `systemLine` 을 목록 맨 위에 두고, 있으면 빈 상태 문구를 쓰지 않는다.
- `src/components/QuickMessageSheet.tsx`·`DiscussionControls.tsx`: `templates`(기본 낮 TEMPLATE_ORDER). 대상·직업 칸 규칙은 QUICK_TEMPLATES 그대로라 밤 문구에는 직업 칸이 없다.
- `src/components/ReadOnlyRow.tsx`: `READ_ONLY_TEXT`·`ReadOnlyRow`(p.mf-ro). `src/styles/day.css`: `.mf-msglog__item--sys`(gray-500, --latest 규칙 뒤), `.mf-ro`(시안 E1 .ro, 관전 하단 높이 계산 주석).

## TDD

### RED

- Task 1: `seatFloats.test.tsx` "밤 수집" 묶음 + `nightChat.test.tsx` "MessageLog 안내 줄". 목표 테스트 "CHAT_PHASES 는 discussion·night 두 개다" 가 `expected '' to be 'discussion,night'` 로 실패(12건 실패·21건 통과). `gsd check tdd-red-evidence` → RED_EVIDENCE_OK. 의미 평가: CHAT_PHASES 가 아직 없어 빈 집합으로 비교되어 계획한 단언에서 실패했다. import·문법 오류가 아니다. 나머지 실패도 모두 단언 실패(안내 li·label 없음, 밤 단계 수집 안 함).
- Task 2: `quickMessageSheet.test.tsx` "밤 문구 (D-17)" + `nightChat.test.tsx` "밤 조작 줄·모달". 목표 "templates NIGHT_TEMPLATE_ORDER … 낮 문구 칩은 없다" 가 낮 다섯 칩 문자열과 밤 세 칩 문자열의 비교에서 실패(4건 실패·26건 통과). RED_EVIDENCE_OK. 의미 평가: templates prop 이 없어 낮 칩이 그려진 것이 실패 원인이다.
- Task 3: `nightChat.test.tsx` "모달 안내 줄·관전 하단 부품". 목표 "ReadOnlyRow 는 p.mf-ro …" 가 `expected 'undefined.undefined|0' to be 'P.mf-ro|1'` 로 실패(5건 실패·8건 통과). RED_EVIDENCE_OK. 의미 평가: ReadOnlyRow 파일이 없어 `import.meta.glob` 이 빈 객체를 주고 빈 부품이 그려졌다 — 파일 로드를 지키려고 RED 에서만 glob 으로 읽었고, GREEN 에서 정적 import 로 바꿨다.

### GREEN

각 태스크의 최소 구현으로 통과. `npx vitest run`(58 파일·1212 테스트)·`npm run typecheck`·`npm run build` 통과. 낮 토론 통합 테스트(`discussion.test.tsx`)와 `dayScene.test.tsx` 는 고치지 않고 초록이다.

### REFACTOR

없음.

### Commits

- 9ad590f test(03-06): night chat lines and system line in log
- c3ab2f4 feat(03-06): night chat collection and system line
- d884f16 test(03-06): night templates in quick message sheet
- 8b5dc2b feat(03-06): night templates in quick message sheet
- 539fd62 test(03-06): spectator log and read-only row
- c152e01 feat(03-06): system line in chat history, spectator log options and read-only row

## Deviations from Plan

### Auto-fixed Issues

없음 — 계획대로 실행했다. 다음 두 가지는 계획 문구와 다르게 푼 곳이라 적어 둔다(동작 변경 없음).

1. **Task 3 RED 의 ReadOnlyRow 읽기 방식**: 계획은 RED 에서 새 파일을 import 하라고 하지만, 없는 모듈의 정적 import 는 파일 전체를 로드 실패(INVALID_RED)로 만든다. RED 에서는 `import.meta.glob` 으로 읽고 GREEN 커밋에서 정적 import 로 바꿨다.
2. **`SystemLineItem` 내보내기**: 계획은 "MessageLog 가 모달을 열 때 systemLine 을 넘긴다" 와 "같은 안내 li" 만 정했다. 두 곳의 마크업이 갈라지지 않게 MessageLog 에서 `SystemLineItem` 을 내보내 둘이 공유한다.

## Known Stubs

없음. 새 부품은 prop 이 없을 때 지금 그대로 동작하고, 장면에 꽂는 일은 03-08 의 일이다(이 계획의 범위 밖).

## Threat Flags

없음. 새 네트워크 경로·권한 검사·스키마 변경이 없다. T-03-18(허용 키 복사·모르는 template 버림)은 `toChatLine` 그대로이고 기존 T-02-45 테스트가 통과한다. T-03-19(낮 줄·밤 줄 섞임, 밤이 끝나도 남는 줄)는 `chatKey` 열쇠로 막고 Task 1 의 테스트가 확인한다.

## Self-Check: PASSED

- 파일: src/components/ReadOnlyRow.tsx, test/client/nightChat.test.tsx, 이 SUMMARY 존재 확인
- 커밋: 9ad590f, c3ab2f4, d884f16, 8b5dc2b, 539fd62, c152e01 모두 HEAD 의 조상
- 각 태스크에서 `test(03-06)` 커밋이 짝이 되는 `feat(03-06)` 커밋보다 먼저다
