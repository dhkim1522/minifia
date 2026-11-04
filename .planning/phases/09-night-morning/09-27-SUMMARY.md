---
phase: 09-night-morning
plan: "27"
subsystem: client-headcount
tags: [gap-closure, head-count, lobby-start, e2e-measure]
status: complete

requires:
  - phase: 09-night-morning
    provides: ActionButton(inactive 모양), seatColorVar(09-25)
provides:
  - src/components/v2/HeadCount.tsx — 숫자 '현재 / 최대' 부품(span.mv-count, role img)
  - ActionButton count 속성(dots 대신)
  - E2E readLobbyFrame start.countText · 게임 패널 verdictRow.hasCount
affects: [09-30]

key-files:
  created:
    - src/components/v2/HeadCount.tsx
  modified:
    - src/components/ActionButton.tsx
    - src/screens/GamePanel.tsx
    - src/screens/Lobby.tsx
    - src/styles/v2.css
    - src/styles/game.css
    - test/client/v2parts.test.tsx
    - test/client/lobby.test.tsx
    - test/client/gameMap.test.tsx
    - test/client/verdictScreen.test.tsx
    - scripts/e2e/browser.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/flows.mjs
  deleted:
    - src/components/v2/DotProgress.tsx

decisions:
  - "인원·진행 표시는 점 대신 숫자 '현재 / 최대'(16px 700, tabular-nums, 글자색 상속). 결정 0051-4 의 점 표기 개정은 09-30 의 결정 0062 가 남긴다"
  - "[시작] 비활성은 승인된 inactive 모양 그대로(open_design_question 기본값)"

metrics:
  completed: 2026-11-04
  tasks: 3
  commits: 4
  plan_head_before: 0d3882dc63979f2a78851797354f096795e127cf
  plan_head_after: 85cea7ec1cb8b978cb9d2d20267ae8b2a793a4ea
actuals:
  tokens: 14000
  tasks: 3
  commits: 4
---

# Phase 9 Plan 27: 인원·진행 숫자 표기 Summary

점 진행 부품(DotProgress)을 지우고 숫자 '현재 / 최대'(HeadCount)로 [시작]·[토론 끝내기]·찬반 줄 세 곳을 모두 바꿨다.

## 한 일

- **Task 1**: HeadCount 부품 신규(`.mv-count`, aria-label 기본 "3/8"). ActionButton 은 `count` 속성으로 라벨 뒤에 숫자를 그린다. GamePanel 의 찬반 줄(label "투표한 사람")과 [토론 끝내기]를 HeadCount 로 교체, 얼굴 목록 색은 `seatColorVar(p.seat)`. 점 진행 파일과 v2.css·game.css 의 점 규칙(주 버튼 안·눌림 상태 색 포함) 삭제, `.mv-count` 규칙 한 줄 추가.
- **Task 2**: Lobby [시작] 에 `count={{ count: connected, total: view.maxPlayers }}`. 활성 판정(`connected >= view.minPlayers`)·알림 "n명부터 시작해요"·접근성 이름은 그대로. 3명 → 4명으로 다시 그릴 때 "3 / 8" 비활성 → "4 / 8" 활성이 되어 누르면 start 를 보내는 시험을 더했다.
- **Task 3**: E2E 가 점 개수 대신 글자를 잰다. `lobbyStartChecks`(L8)는 `countText` 가 `n / max` 인지, `verdictPanelChecks`(VP2)는 `hasCount` 를 본다. 게임 패널 측정의 `end`·`verdictRow` 는 `{on,total}` 모양을 유지해 flows 의 DY·VD 판정은 그대로다.

## 검증

- 관련 vitest 7개 파일 328개 통과, `npm run typecheck` 0 오류, `node --test scripts/e2e/lib.test.mjs` 152 통과, `e2eContract` 통과.
- 전체 vitest: 4123 통과, 1 실패(`test/worker/testTools.test.ts` ended 단계 — 알려진 간헐 실패, 이 계획과 무관).
- `grep -rn mv-dots src` 는 `mv-typing-dots` 애니메이션 이름만 남는다.

## Deviations from Plan

없음 — 계획대로 실행. (참고: Task 1·2 의 RED 시험을 한 커밋 `b746e09` 로 묶었다. Task 2 의 구현은 Task 1 의 ActionButton `count` 속성에 의존해 GREEN 도 한 커밋 `8a511b8` 이다.)

## 이월 (09-30 등)

- 실제 E2E 실행은 09-30. L8 은 `start.countText`, VP2 는 `verdictRow.hasCount` 로 바뀌었다.
- 결정 0062(`docs/decisions/0062-*`)에서 0051-4 의 점 표기 개정을 기록할 것. 코드 주석(HeadCount.tsx)이 이미 0062 를 가리킨다.
- 사람용 디자인 시스템 아티팩트의 DotProgress 는 사용자가 고친다.
- 결과 화면·일지·이름표의 점(`mf-result__dot`, `mv-tag__dot`)은 좌석 색 점이라 그대로 둔다.

## Known Stubs

없음.

## Self-Check: PASSED

- FOUND: src/components/v2/HeadCount.tsx, DotProgress.tsx 삭제됨
- FOUND commits: b746e09, 8a511b8, 3411ee6, 85cea7e
