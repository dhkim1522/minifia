---
phase: 16-tutorial-and-evidence
plan: "05"
subsystem: ui-button-sizes
tags: [css, button-size, e2e, tdd, vitest, BTN-01]
requires:
  - phase: 16-04
    provides: 아이콘 단추 마크업(이름표 삭제, aria-label 필수), 닫기 단추 × 아이콘 하나
provides:
  - 머리 단추([나가기]·[공유]·[기록])와 [내 역할]이 44x44 정사각(radius-badge, night-800 면, 1px night-600 테두리)
  - 입력줄 [동작]·[보내기]·[유언]이 48(--control-input) 원, 입력칸은 가운데 정렬로 폭 360 에서 160
  - 닫기(.mv-closepill)가 × 가운데의 44x44 단추
  - CSS 에 아이콘 아래 라벨 규칙 0건(v2.css·rolecard.css)
  - E2E·계약 시험에서 이름표 높이 보정(TOOL_BUTTON_H·TOOL_ROW_EXTRA·labeled) 삭제
affects: [16-06, 16-10]
actuals:
  tokens: 32000
  tasks: 3
  commits: 5
plan_head_before: a8dabbc27d395186b602c08758284bb507d2d3d0
commits: 5
plan_head_after: bb6a3b1de3331ae211cc4296accb5e478609972c
tech-stack:
  added: []
  patterns:
    - "아이콘 단추는 단추 상자가 곧 면이다: .mv-tool 이 44x44 상자이고 .mv-tool__face 는 100%·border-radius inherit. 입력줄 단추만 .mv-chat__emote/send/will 이 48 원으로 덮는다"
    - "빛남(.is-call)의 ::after/::before 는 단추 상자의 모서리를 따른다 — 머리는 radius-badge, 유언은 pill"
key-files:
  created: []
  modified:
    - src/styles/v2.css
    - src/styles/rolecard.css
    - test/client/toolLabels.test.tsx
    - test/client/roleCardFlow.test.tsx
    - test/client/v2parts.test.tsx
    - test/client/chatPanel.test.tsx
    - test/client/emoteTray.test.tsx
    - test/unit/e2eContract.test.ts
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/flows.mjs
    - scripts/e2e/result.mjs
    - scripts/e2e/result.test.mjs
    - scripts/e2e/avatar.mjs
decisions:
  - "ChatPanel 변경 없음: 입력줄 단추 48 원은 CSS 만으로 된다(.mv-chat__emote·send·will 규칙)"
  - "머리 단추의 상자와 면을 한 크기로 합쳐 빛남 테두리가 면을 따라가게 했다(별도 .mv-tool.is-call 라벨 규칙 삭제)"
  - "다시 하기 판정의 입력줄 여백은 192(보내기 48 + 알약 96 + 간격 16 + 좌우 32)로 되돌렸다"
status: complete
---

# Phase 16 Plan 05: 단추 크기 규칙 Summary

머리 단추 44 정사각, 입력줄 단추 48 원, 닫기 × 44 를 CSS 로 맞추고, 이름표가 키웠던 높이 보정을 E2E·계약 시험에서 걷어 낸 뒤 높이 흐름을 로컬에서 돌렸다.

## 한 일

| 작업 | 내용 | 커밋 |
| --- | --- | --- |
| 1 RED | toolLabels·roleCardFlow·v2parts 의 CSS 기대를 새 값으로(8건 실패 확인) | 87234624 |
| 1 GREEN | v2.css·rolecard.css 크기 규칙, 라벨 규칙 삭제, 빛남 모서리 | 54374923 |
| 2 | lib·result·avatar·flows 의 보정 상수 삭제, 시험·계약 갱신 | 2c32283f |
| 3a | chatPanel·emoteTray 시험의 36 면 기대를 48 원 규칙으로(전체 시험에서 발견) | 5ac613b6 |
| 3b | 다시 하기 RM1 입력줄 여백 188 → 192 (로컬 E2E 에서 발견) | bb6a3b1d |

- `.mv-tool` 은 44x44 상자(radius-badge)이고 면이 100% 로 채운다. 머리(`.mv-tool--head`)는 night-800 면 + 1px night-600. 입력줄 `.mv-chat__emote/send/will` 은 `--control-input` 원(pill).
- `.mv-closepill`/`.mf-btn.mv-closepill` 은 44x44, 안쪽 여백 0, 테두리 night-600.
- `.mf-btn.mf-rolecard-btn` 은 44x44 정사각, 면은 상자를 채우고 night-800·1px night-600. 점은 면 기준이라 그대로.
- 지운 라벨 규칙: `.mv-tool__label`, `.mv-float__label`, `.mf-mapchip__label`, `.mv-sound__label`, `.mv-closepill__label`, `.mf-rolecard-btn__label`, `.mv-tool.is-call .mv-tool__label`(놋쇠 글자 강조도 같이 사라져 v2parts 의 거르기 항목도 뺐다).
- 떠 있는 단추·맵 칩·소리 단추의 크기·자리는 건드리지 않았다(16-06). 라벨이 사라졌으므로 세 상자는 지금 면 크기 그대로다.
- ChatPanel 변경 없음.
- E2E: `TOOL_BUTTON_H`·`TOOL_ROW_EXTRA`·`CHAT_TOOL_ROW*`·`emoteTrayChecks` 의 `labeled` 삭제. CP1 = 기록 + 154, CP3 = 입력칸·보내기 48x48, `gamePanelHeight` = 기록 + 여분, RS5·RT3 = 188 · 244, 키보드 열림 패널 150(`KB_PANEL_H`, 앱 상수와 같음). e2eContract 는 게임 패널 높이 사본 = 기록 + 여분, CSS 단추 크기(머리 44·입력줄 48)를 견준다.

## TDD

- RED: toolLabels 의 5건·닫기 1건, roleCardFlow 의 역할 단추 1건, v2parts 의 놋쇠 규칙 거르기 1건이 계획한 CSS 단언(`width: var(--control-input)` 없음, 라벨 선택자 잔존 등)에서 의도대로 실패했다. 구문·불러오기 오류 아님.
- semanticAssessment: 대상 시험이 실행되어 계획한 단언에서 실패했고 이유가 맞다. `gsd check tdd-red-evidence` 는 vitest 의 `tap`/`tap-flat` 보고서를 "Non-TAP data in report / Malformed TAP" 으로 거부했다(한글 시험 이름이 든 vitest TAP 진단 형식으로 보임). 분류기 통과 기록은 남기지 못했고 자체 판단으로 RED 를 인정했다.
- GREEN: 54374923 (feat). REFACTOR 없음.

## 로컬 E2E (개발 서버, `--sizes 360x640,430x932`, 방 틀 고정 흐름은 고정 크기)

| 흐름 | 크기 | 통과 / 실패 |
| --- | --- | --- |
| lobby | 360x640, 430x932 | 22/0, 22/0 |
| chat-lobby | 360x640, 430x932 | 23/0, 23/0 |
| avatar-emote | 360x640, 430x932 | 36/0, 36/0 |
| emcee-tools | 390x844(고정) | 19/0 |
| result | 390x844(고정) | 14/0 |
| result-rematch | 360x560(고정) | 첫 실행 17/2 → 192 수정 뒤 19/0 |
| result-reveal (부분 일치로 같이 돎) | 360x640, 430x932 | 22/0, 22/0 |
| sound-result (부분 일치) | 390x844(고정) | 16/0 |
| result-awards (부분 일치) | 360x640, 430x932 | 19/1, 19/1 — AW5 실패(아래) |

알려진 간헐(perfbudget·night-sizes·ghost)은 이 흐름들에 해당하지 않아 나오지 않았다. 판정 문턱은 낮추지 않았다.

## 시험 결과

- `npm run typecheck` 통과. `node --test scripts/e2e/lib.test.mjs scripts/e2e/result.test.mjs` 438 통과. `npm test`: 마지막 전체 실행은 worker 의 bots 시험 2건(알려진 간헐 "봇 chat: 밤에는 마피아 봇의 줄이…" 와 시간 초과 한 건)과 botTyping 한 건이 실패했고, 재실행하자 전부 통과했다(27 통과). 한 번은 leak.test 가 5초 시간 제한에 걸렸다가 단독 실행에서 통과. 이 계획은 worker·shared 를 바꾸지 않았다(`git diff --quiet 9d6dba72 -- shared/game/ruleset.ts` 같음). 기준선 대비 시험 수 7504 → 7505.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] chatPanel·emoteTray 시험이 옛 36 면·44 min-width 를 기대**
- **Found during:** Task 3 (npm test)
- **Issue:** 계획 파일 목록 밖의 두 시험이 `.mv-tool__face` 36x36 과 `min-width: var(--tap-min)` 를 단언했다.
- **Fix:** 면이 상자를 채우고(100%) 입력줄 단추가 48 원이라는 새 규칙으로 바꿈
- **Files modified:** test/client/chatPanel.test.tsx, test/client/emoteTray.test.tsx
- **Commit:** 5ac613b6

**2. [Rule 1 - Bug] 다시 하기 RM1 입력줄 여백이 이름표 단추 44 기준(188)**
- **Found during:** Task 3 (E2E result-rematch)
- **Issue:** 보내기가 48 원이 되어 입력칸 폭 = 폭 − 192 인데 판정이 188 이었다(360x560 에서 168 ≠ 172).
- **Fix:** result.mjs `READY_PILL.inputExtra` 192, result.test.mjs·e2eContract 갱신
- **Files modified:** scripts/e2e/result.mjs, scripts/e2e/result.test.mjs, test/unit/e2eContract.test.ts
- **Commit:** bb6a3b1d

**3. [Rule 1 - Bug] 키보드 열림 패널(`KB_PANEL_H`)·판정 문구에 같은 이름표 보정이 남아 있었다**
- **Found during:** Task 2
- **Fix:** flows.mjs `KB_PANEL_H` = 150, result.mjs 의 RS5·RT3 문구와 flows 의 panelRow 문구에서 "이름표 줄 11.6" 삭제
- **Commit:** 2c32283f

## Deferred Issues

- **result-awards AW5**(시상식 [넘기기] 상자 높이 71.6 기대): 16-04 가 라벨을 지운 뒤 이미 실제 상자는 48x48 이다. 계획의 흐름 목록 밖이고 [넘기기]는 16-06(오른쪽 열 52 원)이 크기를 다시 정하므로 `AWARD_PLATE.floatH` 기대는 16-06 에서 52 기준으로 한 번에 고친다.
- 머리 [기록] 아이콘이 `V2Icon size={22}`(GameMap.tsx, 계획 파일 밖)라 V-1 의 24 와 2 어긋난다. 막지 않는 가장자리 차이라 고치지 않았다.

## Known Stubs

없음.

## Threat Flags

없음(표시 전용 CSS·시험 변경). T-16-27: 머리 44·입력줄 48·닫기 44 로 누르기 영역이 모두 44 이상이고 CSS 시험과 E2E CP3·EB1 이 검사한다.

## Self-Check: PASSED

- src/styles/v2.css, src/styles/rolecard.css, scripts/e2e/lib.mjs 존재
- 커밋 87234624, 54374923, 2c32283f, 5ac613b6, bb6a3b1d 모두 HEAD 의 조상
- `grep -rnE "mv-tool__label|mv-float__label|mf-mapchip__label|mv-sound__label|mv-closepill__label|mf-rolecard-btn__label" src` exit 1, `TOOL_ROW_EXTRA` 0건, `TOOL_BUTTON_H` 0, `labeled`(avatar.mjs) 0
