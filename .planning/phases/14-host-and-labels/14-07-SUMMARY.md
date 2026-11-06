---
phase: 14-host-and-labels
plan: "07"
subsystem: ui-tool-labels
tags: [tool-label, tool-01, header-buttons, float-buttons, sound-button, dress-sheet, room-sweep, minifia-v3, d-04]
status: complete

requires:
  - phase: 14-05
    provides: "[내 역할] 이름표 단추, 헤더 윗여백 토큰 간격 방식"
  - phase: 14-06
    provides: ".mv-tool·.mv-closepill·ToolButton·expectToolLabel, data-tool-label 계약, 결과 머리 [나가기]"
provides:
  - "머리·떠 있는 단추 이름표: 대기실 [나가기]·[공유](ToolButton), 맵 칩 '맵', 옷장 '옷장', 넘기기 '넘기기'(k/n 유지), 소리 '소리'"
  - "DRESS_TEXT.open '옷장' — 단추 라벨·접근성 이름·시트 이름(group aria-label)이 한 곳에서 바뀐다. 옷장 시트 탭 '맵'·'의상', 닫기는 .mv-closepill 알약"
  - "FloatAction: 둥근 면(.mv-float__face 48) + 아래 라벨(.mv-float__label), 선택 prop word(보이는 낱말이 접근성 이름과 달라야 할 때만)"
  - "소리 단추 표식 계약 갱신: data-sound-button·data-sound-state·data-tool-label 셋(역할·좌석 값 없음)"
  - "방 화면 전수 이름표 시험(toolLabels.test, 면제 상수 E-1·E-2): 대기실·배정·역할 확인·낮 6단계·밤·아침·유령·결과 + 옷장·내 역할·유언 시트 + [소리]"
affects: [14-09]

requirements-completed: [TOOL-01]

actuals:
  tokens: 21000
  tasks: 2
  commits: 3

plan_head_before: 0c7ed37ca825ac04d4d78487a11c5e6f40317f91
plan_head_after: c988c823773cb1aa00995e1cc4f711c8e70110b0

tech-stack:
  added: []
  patterns:
    - "이름표 단추의 면과 라벨 분리: 단추는 투명한 세로 상자, 면(.mv-tool__face·.mv-float__face·.mf-mapchip__disc·.mv-sound__face)이 아이콘 면, 라벨은 면 아래. 막힌 단추는 단추에 불투명도만"
    - "전수 시험은 isVisible(aria-hidden·hidden·닫힌 dialog 제외) + visibleWord(숫자·공백·'/' 제외)로 센다. 면제는 시험 안 상수 하나(EXEMPT, E-1·E-2). 검사가 실제로 잡는지 가짜 단추로 확인하는 시험이 함께 있다"
    - "소리 잠김 알약 예외: 알약이 떠 있는 8초는 글자가 '소리 켜기' 라 라벨 '소리' 를 따로 두지 않는다(낱말로 시작하면 통과), 접히면 '소리' 라벨"

key-files:
  created: []
  modified:
    - src/components/v2/SoundButton.tsx
    - src/components/v2/MapChip.tsx
    - src/components/v2/FloatAction.tsx
    - src/components/v2/DressSheet.tsx
    - src/game/dressText.ts
    - src/screens/Lobby.tsx
    - src/styles/v2.css
    - src/styles/lobby.css
    - test/client/toolLabels.test.tsx
    - test/client/soundButton.test.tsx
    - test/client/mapChip.test.tsx
    - test/client/dressSheet.test.tsx
    - test/client/lobby.test.tsx
    - test/client/resultScreen.test.tsx
    - test/unit/e2eContract.test.ts
    - test/unit/tokensV2.test.ts

key-decisions:
  - "꾸미기 → 옷장은 DRESS_TEXT.open 한 곳만 바꿔 단추·접근성 이름·시트 이름이 함께 바뀐다. 시험의 '꾸미기' 이름 질의는 모두 '옷장' 으로 갱신(describe 제목의 옛 말은 설명용이라 그대로)"
  - "FloatAction 의 둥근 지름 48 은 단추가 아니라 면(.mv-float__face)이 맡는다. 단추 폭은 그대로 48(--control-input)이라 e2eContract 의 폭 토큰 검사는 유지하고 tokensV2 의 높이 48 검사만 면 규칙으로 옮겼다"
  - "맵 칩: 36 원 자리는 그대로(위 안쪽 여백 4 + 음수 여백 -4), 그 아래에 '맵'. 손님(aria-disabled)은 흐림 없이 읽기 전용 그대로 — 라벨만 보인다"
  - "옷장 시트 탭은 아이콘 20 + 라벨 14 세로(높이 44 안), 선택된 탭 라벨만 700. 손님에게는 탭이 없다"
  - "대기실 머리 윗여백 18 → 8(14-05·14-06 과 같은 방식). 띠는 HostBand 가 헤더 단추 아랫변까지 재서 붙는다"
  - "FloatAction 의 선택 prop word 는 지금 호출처가 쓰지 않는다(옷장·넘기기는 label 과 같다). 귓속말·배지 float 은 기본판 방 화면 어느 단계에서도 단추가 나오지 않아 전수 시험에서 0건이다 — 나오는 판이 생기면 word 로 짧은 낱말을 준다"

duration: 약 30분
completed: 2026-11-07
---

# Phase 14 Plan 07: 머리·떠 있는 단추·옷장 시트 이름표와 방 화면 전수 검사 Summary

대기실 [나가기]·[공유], 맵 칩, 옷장, 넘기기, 소리 단추와 옷장 시트(탭·닫기)에 아이콘 아래 한 단어를 붙이고, 방 화면 전체(단계 × 시점 + 시트 셋)에서 "보이는 글자가 없는 단추"가 면제 밖에 0건임을 렌더 시험으로 고정했다(TOOL-01 완료).

## 수행한 일

1. **Task 1 — 머리·떠 있는 단추·옷장 시트 (TOOL-01 목록 1~5·7·12·13)** — `Lobby` 머리 [나가기]·[공유] 를 14-06 의 `ToolButton` 으로 바꾸고 윗여백을 토큰 간격으로 맞췄다. `MapChip` 은 36 원 아래 '맵', `FloatAction` 은 둥근 면 + 아래 라벨(옷장·넘기기, 위 'k / n' 유지), `SoundButton` 은 면 아래 '소리'(잠김 알약 8초 동안은 알약이 글자). `DRESS_TEXT.open` 을 '옷장' 으로. `DressSheet` 방장 탭 둘은 아이콘 + '맵'·'의상', 닫기는 `.mv-closepill`. 소리 단추 표식 계약에 `data-tool-label` 하나만 더하고(soundButton·e2eContract) 이유를 주석으로 적었다.
2. **Task 2 — 방 화면 전수 검사** — `toolLabels.test` 에 RoomScreen 을 단계 × 시점으로 그리는 describe 를 더했다(대기실 방장·손님·코드 없음, 배정, 역할 확인 앞면 전·후, 낮 6단계 × 역할 넷 + 유령 × 변론자 본인·남, 밤·아침, 결과 승리 팀 둘 × 산 사람·유령, 옷장·[내 역할]·유언 시트를 연 상태, [소리]). 위반 메시지는 화면 이름 + 단추 접근성 이름. 면제는 상수 `EXEMPT`(E-1 `.mf-world__kick`, E-2 `.mf-tt-sheet__step`), E-3 은 단추가 아니라 대상 밖. data-tool-label 값 집합이 고정 낱말 허용 목록 안인지(T-14-16)와, 검사가 가짜 단추(글자 없음·낱말 불포함)를 실제로 잡고 E-1 은 거르는지도 시험한다.

## 검증

- `npm test`(unit + client + worker): 242 파일 통과 / 7047 통과(14-05 기준선 7015 + 14-06·14-07 신규 시험), `npm run typecheck` 통과.
- `git diff --quiet 2736a336 -- worker shared` 성공(서버·공유 diff 0).
- 인수 기준 grep: `open: "옷장"` 1, `data-tool-label` SoundButton 2·MapChip 1·FloatAction 1·DressSheet 2·Lobby 주석 1(속성은 ToolButton 이 단다)·e2eContract 1, `E-1|E-2` 9, `RoomScreen` 3.
- 시각·실기기 확인(헤더 단추 약 57 이 62 를 넘는 모양, 소리 독 높이가 늘어난 것, 떠 있는 단추 라벨과 패널 간격, 옷장 시트 탭 세로 배치)은 실행하지 않았다 — happy-dom 은 치수를 재지 못해 시험은 마크업·CSS 규칙·접근성 계약까지만 본다. 사용자 결정대로 실기기 검사는 끝에 몰아서 한다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 기존 시험 기대를 새 계약으로 갱신**
- **Found during:** Task 1 (RED 커밋)
- **Issue:** 소리 단추 '글자 없음'·표식 둘뿐, 맵 칩 '글자 없음', '꾸미기' 이름 질의(dressSheet·resultScreen), 떠 있는 단추 지름 48 이 단추 규칙에 있다는 tokensV2 검사, 대기실 헤더 윗여백 18·'18 + 44', 옷장 시트의 '읽을 글은 카드 이름뿐' 이 새 이름표 계약과 충돌
- **Fix:** 새 계약(라벨 '소리'·'맵', 표식 셋, '옷장', 면 규칙, 윗여백 8, 닫기 알약 글자 '닫기' 는 이름표)으로 바꿨다
- **Files modified:** test/client/soundButton.test.tsx, mapChip.test.tsx, dressSheet.test.tsx, lobby.test.tsx, resultScreen.test.tsx, test/unit/e2eContract.test.ts, tokensV2.test.ts
- **Commit:** eb318478, 03c1e879

### 계획 해석·선택 (편차 아님, 기록)

- Task 2 의 전수 시험은 작성 즉시 초록이었다(14-05·14-06·Task 1 이 모든 단추를 이미 덮었다). "RED 를 본다" 대신 검사 자체가 잡는지 확인하는 시험(가짜 단추 넷)을 더해 거짓 통과를 막았고, 단추 수 하한(배정 화면 제외 1개 이상)으로 빈 화면 통과도 막았다.
- 소리 단추의 잠김 알약은 보이는 글자가 '소리 켜기' 라 "data-tool-label 값 = 보이는 글자" 가 아니라 "보이는 글자가 낱말로 시작" 으로 판정한다(plan 의 "같다" 를 알약 한 곳만 완화, 접히면 같다).
- 계획 인수 기준 "Lobby.tsx 의 `data-tool-label` grep ≥ 1": 속성은 `ToolButton` 이 단다. Lobby 에는 그 사실을 적은 주석이 있고 `lobby.test` 가 실제 DOM 을 본다.
- 귓속말·배지 `FloatAction`(GameMap)은 기본판 흐름에서 나오지 않아 전수 시험에 단추가 없다. 기존 label 이 그대로 보이는 글자가 되는 규칙이라, 그 float 이 다시 나오는 판이 생기면 `word` prop 으로 짧은 낱말을 주어야 한다(옷장·넘기기는 해당 없음).
- 결정 0073 에 접근성 이름 해석(WCAG 2.5.3)을 옮기는 일은 14-09 에 남긴다(0073 파일이 아직 없다). `HANDOFF.md` 갱신도 이 계획이 하지 않았다.

## Known Stubs

없음.

## Threat Flags

없음. `data-tool-label` 값은 고정 낱말뿐이고 전수 시험이 허용 집합 밖 값·seat/nonce/token 문자열을 단언으로 막는다(T-14-16). 손님 맵 칩·막힌 단추는 aria-disabled 동작(눌러도 무반응)을 그대로 두고 라벨만 보인다(T-14-18, mapChip 시험 유지).

## Self-Check: PASSED

- 파일: test/client/toolLabels.test.tsx, src/game/dressText.ts, 이 SUMMARY 존재 확인.
- 커밋: eb318478, 03c1e879, c988c823 모두 HEAD 의 조상.
