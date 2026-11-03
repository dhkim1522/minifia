---
phase: 09-night-morning
plan: "08"
subsystem: ui-parts
tags: [will-sheet, ime, use-composed-text, v2-css, tdd, tracer]
status: complete

requires:
  - phase: 09-night-morning
    provides: V2Icon quill·note (09-05), 승인 v2.0 WillSheet (design/v2.0/design-system/components)
provides:
  - WillSheet 부품 — props { title?, icon?, tone?, value, onChange, onSave(text), saved?, max?, placeholder?, onClose(text), compact?, disabled? }
  - useComposedText(ref) → { composing, settle, bind } — 조합이 끝난 값을 기다려 콜백
  - CSS .mv-will, __head, __title, __close, __text, __foot, __count, __save, --mafia
  - 표식 data-will-sheet="will|note", V2Icon close
affects: [09-17 유언·쪽지 화면 장착(깃펜·[유언]·[쪽지], 서버 저장, me.will, 키보드 위치)]

actuals:
  tokens: 16000
  tasks: 2
  commits: 3
plan_head_before: 1af94237156ddb9d325226f82c527776641bd6a2
plan_head_after: d1572cfa6f0de277fc17175b0703764326c2353d

tech-stack:
  added: []
  patterns:
    - "시트는 서버로 가는 길(채팅 보내기·입력 중 신호)을 props 에 두지 않는다 — 콜백은 onChange·onSave·onClose 뿐"
    - "조합 중 저장·닫기는 compositionend 또는 IME_WAIT_MS 중 먼저 오는 쪽의 DOM 값으로 한 번만 부른다"

key-files:
  created:
    - src/components/v2/WillSheet.tsx
    - src/net/useComposedText.ts
    - test/client/willSheet.test.tsx
  modified:
    - src/components/v2/V2Icon.tsx
    - src/styles/v2.css
    - test/client/v2parts.test.tsx

key-decisions:
  - "그래핌 자르기는 부품 안의 Intl.Segmenter 로 한다(shared/nickname 의 segmenter 는 export 가 없어 countGraphemes 만 재사용). 조합 중에는 값을 가공하지 않고 compositionend 에서 자른다"
  - "기다리는 중 다시 눌러도 처음 콜백 하나만 부른다(저장 직후 닫기 눌러도 두 번 가지 않음)"
  - ".mv-will__text 반경은 승인 bundle.css 값(radius-md)을 따랐다 — 계획 문구의 radius-sm 보다 승인 치수 그대로 옮기라는 지시를 우선"

requirements-completed: []

metrics:
  duration: 약 12분
---

# Phase 9 Plan 08: 유언·쪽지 시트 부품 Summary

승인 WillSheet 를 React 19 로 옮기고, 한글 조합 중 저장·닫기를 조합이 끝난 확정 값으로 한 번만 부르는 훅 useComposedText 를 새로 만들었다.

## 한 일

- **Task 1 (트레이서)**: 열면 textarea 초점, role dialog·aria-label, 100 그래핌 상한(그래핌 기준 자르기), 빈 값 저장, saved 면 "저장됨" 비활성, disabled 면 aria-disabled 로 눌러도 무반응, 조합 중 저장·닫기 대기. 시트 소스에 send·typing·HTML 주입 경로가 없음을 시험이 소스 검사로 확인한다.
- **Task 2**: tone mafia → `data-will-sheet="note"`·`mv-will--mafia`, compact → rows 2, v2.css 의 `.mv-will*` 규칙(토큰 변수만, hex 없음). crimson 토큰은 `.mv-will--mafia` 로 시작하는 규칙에만 있고 시험이 v2.css 를 읽어 검사한다.

## 커밋

- 164ed88 test(09-08): 실패 시험 추가 (RED)
- 5e8e57f feat(09-08): WillSheet·useComposedText·V2Icon close (GREEN, Task 1)
- d1572cf feat(09-08): v2.css 규칙 (Task 2)

## 검증

- `npx vitest run test/client/willSheet.test.tsx test/client/faceList.test.tsx` 통과
- `npm run typecheck` 오류 0, `npm run tokens:check` 통과
- `npx vitest run --project client` 44개 파일 1390개 시험 통과

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 막힘] V2Icon 에 close 가 없음**
- **Found during:** Task 1
- **Issue:** 닫기 버튼 아이콘(승인 bundle.js `close`)이 V2Icon 표에 없어 타입 오류 위험
- **Fix:** 승인 경로 그대로 `close` 추가
- **Files modified:** src/components/v2/V2Icon.tsx
- **Commit:** 5e8e57f

**2. [Rule 3 - 막힘] 기존 진홍 검사가 .mv-will--mafia 를 막음**
- **Found during:** Task 2 (전체 client 실행)
- **Issue:** test/client/v2parts.test.tsx 의 "진홍은 crimson-300 글자색 하나뿐" 검사가 8페이즈 부품만 제외해서 9페이즈 쪽지 진홍 테두리에 실패
- **Fix:** 8페이즈가 한 것과 같은 방식으로 `.mv-will--mafia` 규칙도 제외(진홍 범위는 willSheet.test 가 따로 지킴)
- **Files modified:** test/client/v2parts.test.tsx
- **Commit:** d1572cf

**3. [참고] .mv-will__text 반경**: 계획 문구 radius-sm 과 승인 bundle.css 의 radius-md 가 달라 승인 값을 따랐다(위 결정 참고).

## Auth gates

없음.

## Known Stubs

없음.

## Threat Flags

없음. T-09-15(본문 React 텍스트·100 그래핌)·T-09-16(시트에 send·입력 중 경로 없음, 시험 확인) 완화 완료.

## 요구사항

WILL-01·NIGHT-12 는 부품만 끝났다. 서버 저장(09-12)과 화면 장착(09-17)이 남아 완료 처리하지 않았다.

## Self-Check: PASSED

- 파일 존재: WillSheet.tsx, useComposedText.ts, willSheet.test.tsx 확인
- 커밋 164ed88·5e8e57f·d1572cf 확인
