---
phase: 04-execution-verdict
plan: 17
subsystem: test-tools-screen
tags: [testBotVote, TestToolsSheet, Chip, tdd, e2e-selector-contract]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-15 의 ClientMessage testBotVote({exec, pick}), BotVoteExec·BotVotePick, MyInfo.testBotVote(서버 훅)"
provides:
  - "테스트 시트(대기실 구역)의 `봇 처형 투표`(무작위·모두 찬성·모두 반대)와 `봇 후보 선택`(무작위·방장·방장 아닌 사람) 칩 그룹 두 개"
  - "E2E 선택자 계약: role=group + aria-label `봇 처형 투표`·`봇 후보 선택`, 칩 이름은 위 문구 그대로"
affects: [04-31 — E2E 도우미가 이 두 그룹을 이름으로 눌러 처형 무효·처형·결과 화면 흐름을 결정적으로 만든다]

actuals:
  tokens: 2900
  tasks: 1
  commits: 2
plan_head_before: 5055c0940409d317f274c76fe1136577923b34cd
plan_head_after: b34455c5eb6f3dbdf7c2eb76ed20b40ff0838d9d

tech-stack:
  added: []
  patterns:
    - "내 직업 칸과 같은 낙관적 선택 { view, exec, pick } — pending.view === view 일 때만 쓰고, 새 view 객체가 오면 서버 값(me.testBotVote ?? random 한 쌍)이 이긴다"
    - "절대값 한 쌍 전송: 칩 하나를 눌러도 다른 그룹의 현재(낙관적 포함) 값을 함께 싣는다"

key-files:
  created: []
  modified:
    - src/components/TestTools.tsx
    - src/styles/testtools.css
    - test/client/testTools.test.tsx

key-decisions:
  - "칩 문구·값 표는 컴포넌트 안 상수(BOT_EXEC_CHIPS·BOT_PICK_CHIPS)로 둔다. E2E 선택자 계약이라 한 곳에서만 고친다"
  - "봇이 0명이어도 칩은 켜 둔다(계획 재량 결정). 꺼지는 조건은 canSend 거짓 하나뿐"

requirements-completed: []  # VOTE-01·VOTE-02 는 04-35 의 배포본 검증 뒤에 체크한다(사용자 지시)

coverage:
  - id: D1
    description: "대기실 방장 testMode 시트에 봇 처형 투표·봇 후보 선택 두 그룹이 있고 기본은 둘 다 무작위, 서버 me.testBotVote({no, host})면 모두 반대·방장이 눌려 있다. 게임 중 시트에는 없다"
    requirement: "VOTE-01"
    verification:
      - kind: unit
        ref: "npx vitest run --project client test/client/testTools.test.tsx (53 통과, 새 시험 12개)"
        status: pass
    human_judgment: false
  - id: D2
    description: "칩 하나를 누르면 {t:testBotVote, exec, pick} 한 메시지에 다른 그룹 현재 값을 함께 싣고(모두 찬성 → yes/random, 이어 방장 아닌 사람 → yes/other), 같은 칩 재누름은 무전송, 새 view 는 서버 값이 이기며 !canSend 면 꺼진다"
    requirement: "VOTE-02"
    verification:
      - kind: unit
        ref: "test/client/testTools.test.tsx (절대값 한 쌍·재누름 무시·새 view·canSend 시험)"
        status: pass
    human_judgment: false
---

# Phase 4 Plan 17: 테스트 시트 봇 투표 선택 칩 Summary

**대기실 테스트 시트에 `봇 처형 투표`·`봇 후보 선택` 칩 그룹 두 개를 더해, 화면 E2E 가 사람 손 없이 투표 분기(처형 무효·통과·후보=방장)를 이름으로 골라 누를 수 있게 했다. 칩 하나가 항상 절대값 한 쌍 `{exec, pick}` 을 보낸다.**

## 한 일

**Task 1** — RED `08a6a55` → GREEN `b34455c`
- `TestTools.tsx`: 대기실 구역 `봇` 스테퍼 아래, 두 동작 버튼 위에 `.mf-tt-sheet__botvote` 구역 두 개. 각 구역은 `.mf-tt-sheet__label` + `.mf-chips`(`role="group"`, `aria-label` 이 그룹 이름) 안에 공용 `Chip` 세 개.
- 낙관적 선택은 내 직업 칸(`choose`)과 같은 방식: `{view, exec, pick}` 을 쥐고 `pending.view === view` 일 때만 쓰며, 아니면 `view.me.testBotVote ?? {random, random}`. 눌린 칩과 같은 값이면 무시하고, 아니면 pending 을 정한 뒤 전체 한 쌍을 `send({t:"testBotVote", exec, pick})` 로 보낸다. `canSend` 가 거짓이면 여섯 칩이 모두 꺼진다.
- `testtools.css`: `.mf-tt-sheet__botvote` 한 줄(세로 flex, gap `--space-sm` — `.mf-tt-sheet__roles` 와 같은 간격). 색·글자 크기 추가 없음.
- 시험(`test/client/testTools.test.tsx`): 새 describe 12개. 기존 시험은 `makeView` 에 `testBotVote` 선택 인자 하나만 더했고 나머지는 한 줄도 바꾸지 않았다.

## 검증

- `npx vitest run --project client test/client/testTools.test.tsx`: 53 통과(기존 41 + 새 12). RED 단계에서 11개 실패 확인.
- `npm test`: 89 파일 2310 통과. `npm run typecheck`(토큰 검사 + wrangler types + 두 tsc): 통과.
- 수용 기준 grep: `testBotVote` in TestTools.tsx 3(기준 2 이상), `봇 처형 투표` TestTools.tsx 2·testTools.test.tsx 4(각 1 이상).

### 확인하지 못한 것

브라우저에서 시트를 열어 실제 렌더·360px 폭 줄바꿈·80dvh 시트 안 스크롤은 보지 않았다(단위 시험과 타입 검사만). 칩 줄은 기존 `내 직업` 칩 줄과 같은 `.mf-chips` 라 줄바꿈은 같은 방식이지만 `방장 아닌 사람` 칩이 좁은 폭에서 어떻게 감기는지 눈으로 확인하지 않았다. 실제 서버(04-15 훅)와의 왕복도 이 계획에서는 하지 않았다 — 서버 쪽은 04-15 시험이 덮고, 왕복은 04-31 E2E 가 처음 밟는다.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크 경로·권한 경로·스키마 변경이 없다(T-04-50 accept: 시트는 방장 + me.testMode 일 때만 마운트, 서버가 다시 거부).

## Self-Check: PASSED

- 파일: `src/components/TestTools.tsx`, `src/styles/testtools.css`, `test/client/testTools.test.tsx` 존재.
- 커밋: `08a6a55`, `b34455c` 모두 HEAD 의 조상.
