---
phase: 14-host-and-labels
plan: "06"
subsystem: ui-tool-labels
tags: [tool-label, tool-01, chat-input, sheet-close, result-tabs, minifia-v3, d-04]
status: complete

requires:
  - phase: 14-04
    provides: ChatPanel callInput·callWill(빛남), .is-call CSS 규칙
  - phase: 14-05
    provides: [내 역할] 이름표 단추 모양(면 36 + 4 + 라벨), 헤더 윗여백 토큰 간격 방식
provides:
  - ".mv-tool 공통 이름표 규칙(v2.css): 아이콘 면 .mv-tool__face 36 + 4 + 라벨 .mv-tool__label 14/400 gray-300, 폭 44~52·누르기 44 이상, 빛나면 라벨 700 brass-200, 막히면 불투명도 .45"
  - "data-tool-label 표식(값은 고정 낱말뿐): 동작·보내기·유언·새 글·닫기·전체·마피아·유령·기록·나가기"
  - "ToolButton 부품(src/components/ToolButton.tsx): 머리(헤더)의 아이콘 단추 한 모양 — 14-07 이 대기실 [나가기]·[공유] 에 재사용"
  - ".mv-closepill 시트 닫기 알약(× + '닫기', 높이 44), Button 의 data-tool-label prop"
  - "CHAT_TEXT.label { emote, send, will }, CHAT_TEXT.newDot '새 글'"
  - "test/client/toolLabels.test.tsx: expectToolLabel 계약 도우미 + 부품 단위 describe 둘(14-07 이 방 화면 전수로 넓힌다)"
affects: [14-07, 14-09]

requirements-completed: [TOOL-01]

actuals:
  tokens: 22000
  tasks: 2
  commits: 4

plan_head_before: 721b51d6fdb7eda8b4422d7e03e1f979a9fb8b2d
plan_head_after: 8f55df6c93dd026c2ecc5777eb47ca98ad19aa0f

tech-stack:
  added: []
  patterns:
    - "이름표 계약: data-tool-label = 보이는 글자(숫자·공백 제외), 접근성 이름은 그 낱말을 포함(WCAG 2.5.3). expectToolLabel 한 도우미가 이 셋을 한 번에 본다"
    - "이름표 단추는 단추 자신이 투명한 세로 상자(.mv-tool), 면(.mv-tool__face)이 아이콘 면 — 채팅 줄은 입력칸 48 을 아래 정렬(align-items: flex-end)"
    - "빛남 라벨 규칙은 .mv-tool.is-call 로 시작해 v2parts 의 '진홍·놋쇠 없음' 부품 규칙 시험에서 14-04 와 같은 방식으로 제외(빛남 신호)"

key-files:
  created:
    - src/components/ToolButton.tsx
    - test/client/toolLabels.test.tsx
  modified:
    - src/components/v2/ChatPanel.tsx
    - src/game/chatText.ts
    - src/components/Button.tsx
    - src/components/Sheet.tsx
    - src/components/v2/WillSheet.tsx
    - src/components/v2/ResultPanel.tsx
    - src/screens/ResultScreen.tsx
    - src/styles/v2.css
    - src/styles/sheet.css
    - src/styles/result.css
    - test/client/chatPanel.test.tsx
    - test/client/emoteTray.test.tsx
    - test/client/resultPanel.test.tsx
    - test/client/resultScreen.test.tsx
    - test/client/v2parts.test.tsx

key-decisions:
  - "접근성 이름은 보이는 낱말을 포함(WCAG 2.5.3): 이미 낱말을 품은 이름('동작 고르기'·'유언 쓰기'·'닫기'·'전체 대화'·'판 기록')은 그대로, 낱말이 없던 '새 메시지' 만 '새 글' 로 바꿨다. 결정 0073 문서는 아직 없어(docs/decisions 가 0072 까지) 14-09 가 이 해석을 기록한다"
  - "채팅 줄 깃펜의 여분 margin-left 8(보내기와 16 간격)을 없앴다: UI-SPEC 폭 360 줄(동작 44 + 입력칸 + 보내기 44 + 유언 44, 간격 8 → 입력칸 172)이 우선. 단추 면이 36 이라 눈에 보이는 면 사이 간격은 약 16 이다"
  - "머리 [나가기] 는 ToolButton(raw button, mf-btn 아님) — 면 night-800·gray-700 테두리·radius-md 는 옛 .mf-iconbtn 과 같은 값. 막힌 단추는 불투명도 .45 + 라벨 보임"
  - "시트 닫기 알약 폭은 약 84 라 .mf-sheet__title 오른쪽 여백을 44+8 → 88+8 로 넓혔다(제목과 겹침 방지)"
  - "결과 탭 안쪽 여백 10 → 8(토큰 space-sm): 라벨이 네 탭 모두에 붙어 폭이 늘었으므로. 합 약 302 + 오른쪽 -8 마진으로 폭 360 에 들어간다"

duration: 약 35분
completed: 2026-11-07
---

# Phase 14 Plan 06: 채팅 입력줄·시트 닫기·결과 화면 한 단어 이름표 Summary

채팅 입력줄의 [동작]·[보내기]·[유언]과 14px 알약 "새 글", 시트 닫기 "× 닫기" 알약, 결과 기록 탭 넷(항상 글자), 결과 머리 [나가기]에 아이콘 아래 한 단어 이름표를 달았다(TOOL-01, "도구를 모른다" 해소).

## 수행한 일

1. **Task 1 — 채팅 입력줄 (TOOL-01 목록 8~11, D-04)** — v2.css 에 공통 이름표 규칙 `.mv-tool`(면 36 + 4 + 라벨)을 두고 ChatPanel 의 동작·보내기·유언이 쓴다. 새 메시지 점은 14px 알약 "새 글"(누르기 44×44 투명 영역 유지, 맥박 모션 줄이기 규칙 그대로)로 바꿨고 `CHAT_TEXT.newDot` 이 "새 글". 입력줄은 입력칸 48 을 아래 정렬. 라벨 낱말은 `CHAT_TEXT.label` 한 곳. 저장됨 점은 면 안으로, 막힌 보내기·동작도 라벨 보임.
2. **Task 2 — 시트 닫기·결과 탭·결과 머리 (목록 1·12·14)** — `.mv-closepill`(× 20 + "닫기", 높이 44)을 `Sheet`·`WillSheet` 닫기에 적용(접근성 이름 "닫기" 그대로). `ResultPanel` 탭은 선택 여부와 무관하게 라벨을 그리고(`selected ? <span` 조건 제거) 선택된 탭만 gray-100 700. 결과 머리 [나가기] 는 새 `ToolButton`(면 36 + "나가기"), 머리 윗여백 18 → 8(토큰, 14-05 와 같은 방식).
3. 시험: `toolLabels.test` 신규(`expectToolLabel` + 부품 단위 describe 둘), chatPanel·emoteTray·resultPanel·resultScreen·v2parts 시험을 새 계약으로 갱신.

## 검증

- `npx vitest run --project client`: 74 파일 / 2464 통과, `npm run typecheck` 통과.
- `npm test` 전체: 7029 통과 + 1 시간 초과(`test/worker/continuity.test.ts` 방장 이양 — 병렬 부하 때문에 5초 초과, 단독 재실행 13/13 통과. 이 계획은 서버·공유를 건드리지 않음).
- `git diff --quiet 2736a336 -- worker shared` 성공(서버·공유 diff 0).
- 인수 기준 grep: ChatPanel `data-tool-label` 4, `"새 글"` 1, v2.css `mv-tool` 11, Sheet·WillSheet·ResultPanel 각 1, `selected ? <span` 0.
- 시각·실기기 확인(360 폭에서 입력칸 실제 폭 172, 결과 탭 넷 한 줄, 머리 단추 약 57 잘림 여부)은 실행하지 않았다 — happy-dom 은 치수를 재지 못해 자동 시험은 CSS 규칙·마크업 계약까지만 본다. 사용자 결정대로 실기기 검사는 끝에 몰아서 한다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 기존 시험 기대를 새 계약으로 갱신**
- **Found during:** Task 1·2 (RED 커밋)
- **Issue:** 새 메시지 점의 빈 글자·aria-label "새 메시지", 보내기의 "글자 라벨 없음", 깃펜 48×48 면·margin-left, 동작 버튼 48×48, 선택된 탭만 글자 시험이 새 이름표 계약과 충돌
- **Fix:** RED 커밋에서 새 계약(새 글 알약·라벨 있음·면 36·.mv-tool 폭·네 탭 라벨)으로 바꿈
- **Files modified:** test/client/chatPanel.test.tsx, emoteTray.test.tsx, resultPanel.test.tsx
- **Commit:** 3dbebe8e, d05272ad

**2. [Rule 3 - Blocking] v2parts '진홍·놋쇠 없음' 부품 규칙 시험에 빛남 라벨 규칙 제외 추가**
- **Found during:** Task 1
- **Issue:** `.mv-tool.is-call .mv-tool__label { color: var(--brass-200) }` 가 07페이즈의 "놋쇠 토큰 없음" 검사에 걸림(14-04 의 `.mv-tag.is-call` 도 같은 이유로 제외돼 있었다)
- **Fix:** 제외 정규식에 `^\s*\.mv-tool\.is-call` 한 항 추가(빛남은 역할 색이 아니라 모든 역할 같은 신호)
- **Files modified:** test/client/v2parts.test.tsx
- **Commit:** a781365c

**3. [Rule 3 - Blocking] ToolButton 신규 부품 추가(계획 files_modified 밖)**
- **Found during:** Task 2
- **Issue:** 결과 머리 [나가기] 와 14-07 대기실 [나가기]·[공유] 는 `Button` 부품에 이름표를 싣기 어렵다(아이콘 면 + 라벨 세로 배치, data-tool-label). 14-05 가 RoleCardButton 을 raw button 으로 둔 것과 같은 이유
- **Fix:** `src/components/ToolButton.tsx`(작은 부품)를 더하고 `Button` 에는 `data-tool-label` prop 만 더함(Sheet 닫기용)
- **Files modified:** src/components/ToolButton.tsx, src/components/Button.tsx
- **Commit:** 8f55df6c

### 계획 해석·선택 (편차 아님, 기록)

- 계획 인수 기준 "ResultScreen.tsx 의 `data-tool-label` grep ≥ 1": 속성은 `ToolButton` 이 단다(ToolButton.tsx 2). ResultScreen 에는 그 사실을 적은 주석으로 문자열이 있다. 렌더 시험(`resultScreen.test`)이 실제 DOM 의 `data-tool-label="나가기"` 를 본다.
- 계획 Task 2 RED 의 "resultScreen.test 294행 정규식을 /내 역할/ 로" 는 14-05 가 이미 해 두어 손대지 않았다.
- 접근성 이름 해석(WCAG 2.5.3)의 결정 기록은 결정 0073 파일이 아직 없어 이 SUMMARY 와 key-decisions 에만 둔다 — 14-09 마무리에서 0073 에 옮긴다.

## Known Stubs

없음.

## Threat Flags

없음. `data-tool-label` 값은 고정 낱말뿐이고(T-14-16) `toolLabels.test` 가 값 = 보이는 글자를 단언한다. 새 네트워크·인증·스키마 표면 없음.

## Self-Check: PASSED

- 파일: src/components/ToolButton.tsx, test/client/toolLabels.test.tsx, 이 SUMMARY 존재 확인.
- 커밋: 3dbebe8e, a781365c, d05272ad, 8f55df6c 모두 HEAD 의 조상.
