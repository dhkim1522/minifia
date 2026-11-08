---
phase: 16-tutorial-and-evidence
plan: "04"
subsystem: ui-icon-buttons
tags: [tool-labels, accessibility, aria-label, e2e, tdd, vitest]
requires:
  - phase: 16-01
    provides: EvidenceCard 스타일과 E2E VIEW_DAY_KEYS 계약(건드리지 않음)
provides:
  - ToolButton name(접근성 이름) 필수, 글·라벨 span 없음
  - 이름표 속성(data-tool-label)과 아이콘 아래 라벨 span 이 src 에 0건
  - 모든 닫기 단추는 × 아이콘 + aria-label "닫기"
  - toolLabels 불변식 시험(전 화면 이름표 0건, 모든 button 접근성 이름)
  - E2E toolLabelChecks 새 뜻(TL1 이름 없는 단추 0, TL2 이름표 속성·라벨 요소 0)과 readToolLabelCounts
affects: [16-05, 16-06, 16-10]
actuals:
  tokens: 25000
  tasks: 3
  commits: 4
plan_head_before: 0bb9fd35da5a3caa29fac7918234699f880aa41d
commits: 4
plan_head_after: 1ab7d7b8d98b7d94db9510dd3d28efe306d990e8
tech-stack:
  added: []
  patterns:
    - "아이콘 단추의 새 불변 규칙은 '모든 button 에 비어 있지 않은 접근성 이름' 하나다(면제 목록 없음)"
    - "E2E 셀렉터는 이름표 속성 대신 aria-label·data-float 표식을 쓴다"
key-files:
  created: []
  modified:
    - src/components/ToolButton.tsx
    - src/components/Button.tsx
    - src/components/Sheet.tsx
    - src/components/RoleCardButton.tsx
    - src/components/v2/SoundButton.tsx
    - src/components/v2/MapChip.tsx
    - src/components/v2/FloatAction.tsx
    - src/components/v2/ChatPanel.tsx
    - src/components/v2/DressSheet.tsx
    - src/components/v2/WillSheet.tsx
    - src/components/v2/RecordCard.tsx
    - src/components/v2/ResultPanel.tsx
    - src/game/chatText.ts
    - src/game/dressText.ts
    - src/screens/Lobby.tsx
    - src/screens/ResultScreen.tsx
    - src/screens/GameMap.tsx
    - test/client/toolLabels.test.tsx
    - test/client/chatPanel.test.tsx
    - test/client/gameMap.test.tsx
    - test/client/lobby.test.tsx
    - test/client/mapChip.test.tsx
    - test/client/recordTrace.test.tsx
    - test/client/resultPanel.test.tsx
    - test/client/resultScreen.test.tsx
    - test/client/roleCardFlow.test.tsx
    - test/client/soundButton.test.tsx
    - test/unit/e2eContract.test.ts
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/host.mjs
key-decisions:
  - "ToolButton 은 word·name 둘을 받던 것을 name 하나(필수)로 줄였다. 글 이름표가 없으니 word 가 필요 없다"
  - "FloatAction 의 word prop(보이는 낱말을 접근성 이름과 달리 쓰기)은 호출처가 없어 삭제했다"
  - "쓰이지 않게 된 낱말 상수(SoundButton·MapChip 의 TOOL_WORD, CHAT_TEXT.label)는 지웠다"
  - "toolLabelChecks 의 두 번째 인자는 { labelAttrs, labelEls } 개수다. 개수가 없으면 '측정값 없음' 으로 실패한다(공허 통과 금지)"
  - "CSS(v2.css·rolecard.css)의 라벨 규칙과 그것을 읽는 시험·E2E 높이 판정(TOOL_ROW_EXTRA 등)은 16-05 몫이라 그대로 뒀다"
requirements-completed: [TOOL-04]
status: complete
---

# Phase 16 Plan 04: 아이콘 단추 이름표 삭제 Summary

모든 화면에서 아이콘 단추 아래 글 이름표(`data-tool-label`·라벨 span)를 걷고, 접근성 이름(aria-label)을 필수 불변 규칙으로 바꿨다. 시험과 E2E 판정도 "이름표 0건 + 접근성 이름 있음" 으로 뒤집었다.

## 한 일

| 태스크 | 내용 | 커밋 |
| --- | --- | --- |
| 1 RED | toolLabels 시험을 새 불변식(이름표 속성·라벨 요소 0건, 모든 button 접근성 이름)으로 다시 씀. 31개 중 21개 실패 확인 | 94e32708 |
| 1 GREEN | ToolButton `name` 필수·글 없음, 이름표 속성·라벨 span 삭제(부품 12개·화면 3개), 닫기는 × 만 | 5bcb4e06 |
| 2 | 화면·부품 시험 9개와 e2eContract 의 이름표 기대를 뒤집음(라벨 0건·aria-label) | 0da5f2e3 |
| 3 | E2E toolLabelChecks 새 뜻, 면제 목록 삭제, HOST_MARKERS 정리, 셀렉터 aria-label·data-float 로 | 1ab7d7b8 |

- 결과 탭 4·꾸미기 탭 2 는 탭 안 글을 그대로 두고 이름표 속성만 지웠다(선택 표시 aria-selected 그대로).
- 새 글 알약("새 글")·잠김 알약("소리 켜기")·넘기기의 'k / n' 숫자는 그대로다.
- `git diff 9d6dba72 -- shared/game/ruleset.ts` 변화 없음.

## 검증

- `npx vitest run test/client/toolLabels.test.tsx` 31/31, `npm run typecheck` 0 오류
- `npm test`: 260 파일 통과 / 6 건너뜀, 7504 통과 / 261 건너뜀(기준선과 같음). 알려진 `bots.test.ts` 마피아 봇 flake 는 이번 실행에서 나오지 않았다
- `node --test scripts/e2e/lib.test.mjs` 366/366, `npx vitest run test/unit/e2eContract.test.ts` 69/69
- acceptance grep: `data-tool-label` src 0줄, 라벨 클래스 src 0줄, `<ToolButton word=` 0줄, `<ToolButton name=` 4곳, `TOOL_LABEL_EXEMPT` 0, host.mjs `data-tool-label="` 0

### 로컬 E2E 결과 (개발 서버, 배포 아님)

`npm run e2e -- --url http://localhost:5173 --only emcee-tools,emcee-band --sizes 360x640,390x664` — 40초, `E2E OK`, 실패 0건. emcee-tools 는 흐름이 390x844 로 크기가 고정이라 그 크기 하나만 돈다.

| 흐름 | 크기 | 통과/전체 |
| --- | --- | --- |
| emcee-tools | 390x844 | 19/19 (TL 판정: 대기실 10·옷장 시트 20·역할 확인 3·토론 7·내 역할 시트 10·유언 시트 8·투표 11·밤 9·아침 5·시상식 10·결과 패널 10개 단추 모두 이름 없는 것 0건, 이름표 속성·라벨 요소 0건. TL3 탭 글 보임 통과) |
| emcee-band | 360x640 | 31/31 |
| emcee-band | 390x664 | 31/31 |

높이 판정을 쓰는 흐름(lobby·chat-lobby·avatar-emote·result·result-rematch)과 6종 전체 회귀는 계획대로 돌리지 않았다(16-05·16-10).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] recordTrace.test 를 Task 1 GREEN 커밋에 함께 넣음**
- **Found during:** Task 1 GREEN (typecheck)
- **Issue:** `ToolButton word=` 를 쓰는 recordTrace.test 가 타입 오류를 내 Task 1 의 `npm run typecheck` 초록 조건을 막았다. 계획상 이 파일은 Task 2 몫이다.
- **Fix:** `word=` → `name=`, 속성 목록의 `data-tool-label` 삭제 두 줄만 GREEN 커밋(5bcb4e06)에 포함. 나머지 recordTrace 기대(`[data-tool-label='기록']` 셀렉터 등)는 Task 2 에서 고쳤다.
- **Files modified:** test/client/recordTrace.test.tsx
- **Commit:** 5bcb4e06

**2. [Rule 2 - Critical] 시험의 "접근성 이름은 고정 문구" 검사를 이름표 허용 목록 대신 놓음**
- **Found during:** Task 1 RED
- **Issue:** 14 의 "data-tool-label 값 집합이 허용 목록 안" 시험(T-14-16)은 속성이 없어지면 공허해진다. 위협 T-16-11 의 완화(접근성 이름에 역할·좌석 값이 없음)가 시험에서 빠질 뻔했다.
- **Fix:** 머리·입력줄·닫기·소리·맵 단추의 aria-label 을 전 화면(대기실·토론·밤·결과)에서 모아 seat·nonce·token·역할 영문 id 가 없고 비어 있지 않음을 검사하도록 바꿨다.
- **Files modified:** test/client/toolLabels.test.tsx
- **Commit:** 94e32708

**3. [Rule 3 - Blocking] e2eContract 의 HOST_MARKERS 기대와 lib.mjs 를 한 흐름에서 맞춤**
- **Issue:** Task 2 의 e2eContract 가 `data-tool-label` 을 뺀 목록을 기대하는데 lib.mjs 는 Task 3 몫이라, `npm test` 가 Task 2 시점에 초록이 되려면 lib.mjs 의 HOST_MARKERS 도 같이 바뀌어야 했다.
- **Fix:** 작업 트리에서는 함께 바꿨고, 커밋만 계획대로 Task 2(테스트)와 Task 3(E2E 스크립트)으로 나눴다. Task 2 커밋 단독 체크아웃에서는 e2eContract 의 HOST_MARKERS 시험이 한 커밋 동안 어긋난다.
- **Commit:** 0da5f2e3, 1ab7d7b8

**4. [범위 해석] CSS 를 읽는 시험은 그대로 둠**
- toolLabels 안의 `.mv-tool`·`.mv-closepill`·`.mf-mapchip`·`.mv-float` 크기 규칙 시험과 e2eContract 의 `.mv-tool__label` CSS·`TOOL_ROW_EXTRA` 기대, roleCardFlow 의 `.mf-rolecard-btn__label` CSS 기대는 CSS 가 남아 있어 계속 통과한다. 16-05 가 CSS 를 바꿀 때 함께 고친다(계획 경계대로). 라벨 글자 CSS(14px·gray-300 등)만 보던 toolLabels 의 기대는 "라벨 요소 0건" 으로 바꾸고 지웠다.

## Known Stubs

없음.

## Threat Flags

없음. 새 속성·새 메시지 없이 지우기만 했고, 접근성 이름은 고정 문구다(T-16-11, T-16-12 는 toolLabels 전수 시험과 E2E TL1 이 전 화면에서 검사).

## 이월 메모 (16-05·16-06)

- 머리 단추(ToolButton)·입력줄 단추(ChatPanel)·소리·맵 칩·떠 있는 단추·내 역할은 이제 면(face) 하나뿐인 아이콘 단추다. 라벨 span 이 없으니 `.mv-tool` 등의 세로 배치(flex-direction: column)·max-width 52·라벨 높이 보정은 모양만 남은 규칙이다. 16-05 가 44 정사각·입력줄 48 원으로 바꾸면 된다.
- 16-05 가 지울 CSS 라벨 규칙: `.mv-tool__label`, `.mv-float__label`, `.mf-mapchip__label`, `.mv-sound__label`, `.mv-closepill__label`, `.mf-rolecard-btn__label`(+ `.mv-tool.is-call .mv-tool__label` 의 글자색 강조). 지울 때 같이 고칠 시험: e2eContract 182~183행(`.mv-tool__label` CSS), `TOOL_ROW_EXTRA`·`gamePanelHeight` 사본, roleCardFlow 의 라벨 CSS 시험, v2parts.test 379행 주석.
- 닫기 단추 4곳(Sheet·WillSheet·DressSheet·RecordCard)은 이제 `.mv-closepill` 안에 × svg 하나뿐이다(가로 알약 CSS 는 아직 남음). 크기는 16-05 에서 × 44 로.
- E2E 높이 판정(CP1·CP3·EB1·결과 패널·TOOL_ROW_EXTRA)은 손대지 않았다 — 마크업 높이가 줄었으니 16-05 가 보정 상수와 함께 맞추기 전까지 lobby·chat-lobby·avatar-emote·result·result-rematch 는 돌리지 않는다.
- 새 E2E 도우미: `readToolLabelCounts(page)`(browser.mjs). 닫기·옷장·넘기기 셀렉터는 `button[aria-label="닫기"]`·`[data-float="dress"]`·`[data-float="skip"]`.

## Self-Check: PASSED

- 커밋 94e32708, 5bcb4e06, 0da5f2e3, 1ab7d7b8 모두 HEAD 의 조상으로 확인
- 수정 파일 존재와 acceptance grep 확인(위 검증 절)
