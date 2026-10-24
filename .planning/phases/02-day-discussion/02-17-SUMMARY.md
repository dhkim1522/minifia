---
phase: 02-day-discussion
plan: 17
subsystem: day-bottom-panel
tags: [day-panel, claim-seg-chips, chat-history-sheet, discussion-controls, tdd, gap-closure, decision-0017]
gap_closure: true
gap_ids: [G-02-1]
status: complete

requires:
  - phase: 02-day-discussion
    provides: 02-14 의 DayTable 높이 적응, 02-15 의 방장 줄 제거, 02-16 의 useDayChat(폰이 그날 받은 chat 줄)
provides:
  - 하단 패널 높이 고정 calc(157px + 안전 영역) — 직업 공개·공개 연출·낮 토론 세 단계 같은 높이, flex none (손잡이 막대·max-height 여백 줄임 삭제)
  - ClaimPanel 한 줄 칩 (.mf-seg / .mf-seg__b / .mf-seg__ok 체크 배지), 2일차 안내 SPEC 문구
  - MessageLog 최근 세 줄 + 44폭 ^ 버튼(채팅 내역 크게 보기), ChatLineItem 공용 줄 부품
  - ChatHistorySheet 신규 (Sheet 틀, 폰이 받은 줄 전부, 열 때 맨 아래)
  - Sheet 선택 prop className
  - DiscussionControls 말하기 한 줄 — [빠른 메시지](아이콘 없음, 남은 폭)[이모티콘](44×44 아이콘만)
affects: [02-18]

requirements-completed: [DAY-02, COMM-01, COMM-02]

actuals:
  tokens: 11600
  tasks: 3
  commits: 6
plan_head_before: 1c4ebc788e03c35cafae7a487d4e29b88fe0c649
plan_head_after: 9eec2a58e9fd8b42d76fc9fda996d76f97f7e702

tech-stack:
  added: []
  patterns:
    - "한 줄 칩은 공용 Chip 을 쓰지 않고 패널 전용 버튼(.mf-seg__b)으로 만든다. 공용 Chip(앞 체크 아이콘, 줄바꿈)은 빠른 메시지 시트가 계속 쓴다"
    - "채팅 줄 모양은 ChatLineItem 하나로 하단 세 줄과 채팅 내역 모달이 함께 쓴다. MessageLog 가 모달 열림 상태를 쥐므로 단계가 바뀌어 패널이 언마운트되면 모달도 닫힌다"
    - "CSS 값 테스트는 규칙 블록을 뽑아 정규식 .test() 를 toBe(true/false) 로 단언한다 — toMatch 의 여러 줄 실패 보고서가 TAP RED 증거를 깨뜨린다 (02-16 과 같은 패턴)"

key-files:
  created:
    - src/components/ChatHistorySheet.tsx
  modified:
    - src/styles/day.css
    - src/components/ClaimPanel.tsx
    - src/components/MessageLog.tsx
    - src/components/Sheet.tsx
    - src/components/DiscussionControls.tsx
    - test/client/claimPanel.test.tsx
    - test/client/dayScene.test.tsx
    - test/client/discussion.test.tsx

key-decisions:
  - "패널 높이는 height 로 고정하고(최소 높이 아님) 높이 낮은 폰용 max-height 미디어 규칙을 모두 지웠다 — 단계마다 다르게 줄어 같은 높이를 깨기 때문"
  - "패널 안 로그는 마지막 세 줄만 그리고 안에서 스크롤하지 않는다. 맨 아래 붙이기 규칙은 모달이 이어받는다"
  - "[빠른 메시지]·[이모티콘] 은 compact(44) — 시안 157 이 44 버튼으로 계산돼 있다. 글자·색은 앱 Button 그대로"
  - "칩 눌림 효과(scale .96)는 계획대로 공용 Chip 과 같은 값으로 넣었다(시안 f4.css 에는 없는 앱 공통 눌림 피드백)"

duration: 약 10분
completed: 2026-10-24
---

# Phase 2 Plan 17: 하단 패널 157 고정, 한 줄 칩, 채팅 세 줄 + 채팅 내역 모달, 말하기 한 줄 Summary

**낮 화면 하단 패널이 승인 시안(9차 .bt)대로 세 단계 모두 calc(157px + 안전 영역) 고정 높이가 되었고, 직업 공개는 제목 + 안내 + 같은 폭 한 줄 칩(체크 배지), 낮 토론은 최근 채팅 세 줄 + ^ 버튼(누르면 폰이 그날 받은 줄 전부가 같은 모양으로 나오는 '채팅 내역' 모달) + [빠른 메시지][이모티콘 44×44] 한 줄이다. 쿨다운 2초·오류 처리·시트 동작은 그대로다.**

## 수행 내용

- **Task 1 (트레이서, 결정 0017-6, D-07·D-09)**: `.mf-dayscene__panel` 을 flex none · border-box · `height: calc(157px + env(safe-area-inset-bottom))` · 간격 `--space-sm` · 여백 `10px var(--space-md) calc(12px + 안전 영역)` 로 바꾸고 손잡이(`::before`)·`@media (max-height: 680px/600px)` 규칙을 지웠다. `ClaimPanel` 은 공용 `Chip` 대신 `div.mf-seg`(group, 주장할 직업) 안의 `button.mf-seg__b`(flex 1, 높이 `--tap-min`, 알약, 간격 6, 14px 굵게 줄바꿈 없음, 눌림 반전, 꺼짐 .6, 눌린 채 꺼진 칩 1)와 고른 칩 오른쪽 위 18px 체크 배지(`.mf-seg__ok`, 12px 체크 아이콘)로 그린다. 2일차 안내는 SPEC 값 "바꾸지 않으면 어제 선택이 공개돼요" 로 고쳤다. 낙관적 선택·같은 칩 무시·공개 중 내 값만 또렷이·마피아/시민 HTML 동일(T-02-25)은 그대로다. 트레이서 게이트: 자동 모드가 아니고 `<verify>` 가 자동 검사뿐이라 GREEN 뒤 전체 테스트(56 파일)와 `npm run typecheck` 를 다시 돌려 통과를 확인한 뒤 Task 2 로 넘어갔다.
- **Task 2 (결정 0017-6·0017-7)**: `MessageLog` 를 면(`.mf-msglog`: night-700, 모서리 14, 여백 8 4 8 16) 안의 `ol.mf-msglog__list`(role log, aria-label "최근 채팅", 마지막 세 줄, 높이 `calc(3 * 1.4 * 14px + 2 * var(--space-xs))`)와 44폭 ^ 버튼(`aria-label="채팅 내역 크게 보기"`, 경로 M6 15l6-6 6 6)으로 바꿨다. 줄 모양은 `ChatLineItem` 으로 뽑아 모달과 공유한다. `ChatHistorySheet` 는 `Sheet label="채팅 내역" showClose className="mf-sheet--chat"` 안에 제목과 `ol.mf-chatlog`(전 줄, 높이 `min(500px, 80dvh)`)를 두고, 열릴 때 맨 아래로 내리며 새 줄은 맨 아래 근처일 때만 따라 내린다. `Sheet` 에 선택 prop `className` 을 더했다.
- **Task 3 (결정 0017-6, D-14)**: [빠른 메시지] 를 `compact` · 앞 아이콘 없음으로, [이모티콘] 을 `compact` · 22px 웃음 아이콘만 · `aria-label="이모티콘"` 으로 바꿨다. CSS 는 `.mf-discuss__quick` flex 1, `.mf-discuss__emoji` 폭·높이 `--tap-min`, `.mf-discuss__host` 규칙 삭제. 쿨다운(SEND_COOLDOWN_MS 2초)·RATE_LIMITED 재잠금·BAD_MESSAGE 토스트·끊김 중 꺼짐 로직은 건드리지 않았다.

## TDD 게이트

세 태스크 모두 RED(`test(02-17)`) 커밋이 GREEN(`feat(02-17)`) 보다 먼저다. RED 증거는 `gsd_run check tdd-red-evidence` 로 검증해 셋 다 `RED_EVIDENCE_OK`.

| Task | RED | GREEN | RED 의미 평가 |
| --- | --- | --- | --- |
| 1 | a66077f | ba48b4e | 대상 `4명판: 칩 그룹은 .mf-seg 한 줄…` 이 `.mf-seg` 클래스 단언(기대 true, 실제 false)에서 실패 — 현재 앱은 `.mf-chips/.mf-chip` 이다. 같은 이유로 체크 배지·2일차 문구·공개 연출 배지·칩 CSS 값·패널 높이 CSS·손잡이/미디어 규칙 테스트도 RED. 짧은 장면 배선(맨 앞 이름표) 테스트는 02-14·02-16 의 기존 동작이라 RED 에서도 통과 |
| 2 | 2f87901 | c723996 | 대상 `chat 이벤트 다섯 줄 → 패널 로그 세 줄` 이 aria-label "최근 채팅" 로그를 찾지 못해 실패(새 마크업이 없음). 모달·버튼·CSS 테스트도 같은 이유로 RED. 기존 `log()` 헬퍼를 이름 있는 로그로 바꾼 탓에 옛 로그 테스트 6개가 RED 에서 함께 실패했고 GREEN 에서 통과 |
| 3 | 1f96751 | 9eec2a5 | 대상 `말하기 줄에는 버튼이 둘뿐…` 이 [빠른 메시지] 의 `mf-btn--compact` 단언(기대 true, 실제 false)에서 실패. CSS 테스트는 `.mf-discuss__emoji` 의 `width: var(--tap-min)` 부재로 실패 |

REFACTOR 커밋은 따로 없다. 첫 RED 시도에서 `toMatch` 의 여러 줄 보고서 때문에 `INVALID_RED(invalid_record)` 가 나서 RED 커밋 전에 `.test()` 단언으로 고쳤다.

## 커밋

| 커밋 | 내용 |
| --- | --- |
| a66077f | test(02-17): 하단 패널 157 고정·직업 공개 한 줄 칩 실패 테스트 (RED) |
| ba48b4e | feat(02-17): 하단 패널 높이 157 고정과 직업 공개 한 줄 칩·체크 배지 (GREEN) |
| 2f87901 | test(02-17): 채팅 최근 세 줄·채팅 내역 모달 실패 테스트 (RED) |
| c723996 | feat(02-17): 채팅 최근 세 줄 + 채팅 내역 모달 (GREEN) |
| 1f96751 | test(02-17): 말하기 한 줄 실패 테스트 (RED) |
| 9eec2a5 | feat(02-17): 말하기 줄 한 줄 (GREEN) |

## 검증

- `npx vitest run` 전체 56 파일 1052 테스트 통과, `npm run typecheck`·`npm run build` 통과.
- 인수 기준: `calc(157px + env(safe-area-inset-bottom))` 1, `mf-dayscene__panel::before` 0, `max-height: 680px` 0, ClaimPanel `mf-seg__ok` 1, 2일차 문구 1, `채팅 내역 크게 보기` 1, ChatHistorySheet `label="채팅 내역"` 존재, Sheet `className?: string` 1, `mf-sheet--chat` 1, `mf-discuss__host` 0, `width: var(--tap-min)` 1, [빠른 메시지] 에 `icon=` 0, `src/screens src/net shared worker scripts` 는 BASE 와 동일.
- 번들 CSS 순서: ds.css(`.mf-btn`)·sheet.css(`.mf-sheet`) 가 day.css 보다 앞이라 `.mf-discuss__emoji` 의 padding 0 · `.mf-sheet.mf-sheet--chat` 높이가 이긴다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RED 보고서가 TAP 으로 읽히지 않아 CSS 단언 방식 변경**
- **Found during:** Task 1 RED
- **Issue:** CSS 값 `toMatch` 가 실패 때 CSS 전체를 담은 여러 줄 메시지를 만들어 `tdd-red-evidence` 가 `INVALID_RED(invalid_record)` 를 냈다.
- **Fix:** `expect(/정규식/.test(규칙)).toBe(true)` 한 줄 단언으로 바꿨다. 검사 내용은 같다.
- **Files modified:** test/client/claimPanel.test.tsx, test/client/dayScene.test.tsx
- **Commit:** a66077f (RED 커밋 이전에 고침)

**2. [Rule 1 - Bug] 모달 줄 문장 기대값 오류**
- **Found during:** Task 2 GREEN
- **Issue:** 내가 쓴 테스트가 둘째 줄(자리 2 → 대상 2)의 문장을 "하윤 의심돼요" 로 잘못 적었다(실제 "민지 의심돼요", 대상이 자리 2 이므로 올바른 동작).
- **Fix:** 기대값을 "민지 의심돼요" 로 고쳤다. 앱 코드 변경 없음.
- **Files modified:** test/client/discussion.test.tsx
- **Commit:** c723996

**Total deviations:** 2 (Rule 1 2건, 모두 테스트 쪽). **Impact:** 동작·범위 변화 없음. 계획 밖 파일 변경 없음(`dayScene.test.tsx` 는 계획 목록에 있음).

## Auth gates

없음.

## Known Stubs

없음. 이모티콘 아이콘은 02-15 이전부터의 임시 형태(D-16)이며 이 계획이 새로 만든 스텁이 아니다.

## Threat Flags

없음. 새 네트워크 경로나 신뢰 경계 변화 없음. T-02-46(모달은 이 폰이 받은 줄만, 서버에 내역을 요청하는 경로 없음)과 T-02-47(모달 줄의 닉네임·문장은 React 텍스트·title 로만, `<img>`·`<script>`·알 수 없는 text 필드가 그려지지 않음)은 `discussion.test.tsx` 로 고정했다.

## 남은 일·주의 (후속 계획 참고)

- **실기기 시각 확인(backstop, 사람, 02-18)**: 360×640 폰과 390 폭 폰(주소창 포함)에서 직업 공개·낮 토론 화면이 스크롤 없이 테이블·이름표·하단 패널이 한 화면에 들어오는지, 하단 패널 높이가 세 단계에서 같아 테이블이 움직이지 않는지, ^ 모달이 시안 U 처럼 보이는지. 이 환경에서는 브라우저로 직접 보지 못했고 자동 검사(CSS 값, 짧은 장면 352×340 에서 맨 앞 이름표 top + 46 ≤ 340)만 했다.
- 패널 안 내용이 157 보다 길어지는 경우는 없다(직업 공개: 제목 28.8 + 안내 최대 2줄 40 + 칩 44 + 간격 16 + 여백 22 = 약 151, 낮 토론: 세 줄 면 82.8 + 44 + 8 + 22 ≈ 157).
- ChatHistorySheet 와 MessageLog 는 서로를 import 한다(ChatLineItem 공유, 계획의 산출물 위치). 둘 다 함수 본문 안에서만 쓰므로 순환 평가 문제는 없고 vitest·vite build 로 확인했다.
- **02-18**: `scripts/smoke.mjs`·`uat-day.mjs` 는 아직 extend·skip 을 보내므로 02-18 전에 돌리지 않는다. 배포는 02-18.

## Self-Check: PASSED

- 파일: `src/components/ChatHistorySheet.tsx`, `src/components/MessageLog.tsx`, `src/components/ClaimPanel.tsx`, `src/components/Sheet.tsx`, `src/components/DiscussionControls.tsx`, `src/styles/day.css`, 테스트 3개 존재 확인.
- 커밋: a66077f, ba48b4e, 2f87901, c723996, 1f96751, 9eec2a5 모두 HEAD 의 조상임을 확인.
