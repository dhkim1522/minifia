---
phase: 08-day-execution-ghost
plan: "01"
subsystem: docs
tags: [decision-record, day-execution, ghost, nomination, verdict, stage-spot]
status: complete

requires:
  - phase: 07-free-chat
    provides: 결정 0058~0059 형식, 항목 단위 개정 표시 선례
provides:
  - 결정 0060 — 낮 처형(토론 끝내기·지목·변론·찬반·처형)과 유령 전송 범위 규칙 14항
  - 옛 결정 0034·0036·0037·0039·0040·0049·0056 의 개정·폐기 표시
affects: [08-02 이후 모든 계획의 "결정 0060-N" 인용, 8페이즈 서버·화면·시험, 9페이즈 밤·아침]

actuals:
  tokens: 6500
  tasks: 2
  commits: 2
plan_head_before: f1b11b8e81504964c01a748a03504c3309174cb4
plan_head_after: 2a8f97ed6e419ad9beb89bf74d1ee28805921bd4

tech-stack:
  added: []
  patterns:
    - "항목 단위 개정 표시: 원문 뒤에 '(2026-11-02 결정 0060-N 으로 … 했다: …)' 한 문장만 덧붙이고 지우지 않는다"

key-files:
  created:
    - docs/decisions/0060-v2-day-execution-ghost.md
  modified:
    - docs/decisions/0034-execution-vote-flow.md
    - docs/decisions/0036-execution-vote-wire.md
    - docs/decisions/0037-execution-screens.md
    - docs/decisions/0039-playtest-pacing.md
    - docs/decisions/0040-candidate-vote-cancel.md
    - docs/decisions/0049-v2-vote-display.md
    - docs/decisions/0056-v2-nickname8-v1-table-e2e.md

key-decisions:
  - "서버 단계는 discussion(90) → nomination(15) → defense(20) → verdict(10) → execution(5) → night(30) → morning(5), 값은 shared/game/phases.ts 한 곳"
  - "찬반 분모는 변론자를 뺀 산 사람 수 E, 찬성×2 > E 면 처형, 조기 종료 없이 마감(10초)까지 (사용자 확정 2026-11-02)"
  - "변론자는 무대 위 STAGE_SPOT(0,0, 높이 0.29)에 서는 이동 마스크 단일 예외 (사용자 확정 2026-11-02)"
  - "지목은 과반이어도 마감까지 바꿀 수 있고 같은 사람의 변경은 250ms 간격(UI-SPEC A3)"
  - "산 사람의 이동 프레임은 전원에게, 유령의 이동 프레임은 유령에게만 (GHOST-01·02)"
  - "밤·아침은 맵 위 임시 틀로 두고 9페이즈가 대체 (UI-SPEC A1)"

requirements-completed: [DAY-03, DAY-04, DAY-05, DAY-06, DAY-07, MAP-04, GHOST-01, GHOST-02]

coverage:
  - id: D1
    description: "결정 0060 이 서버 단계·메시지·찬반 분모·지목 간격·모이기 반지름·STAGE_SPOT·유령 전송 범위 등 14항을 번호로 고정한다"
    verification:
      - kind: other
        ref: "test -f 0060 && grep '^# 0060' STAGE_SPOT nomination '변론자를 뺀 산 사람' 250ms 2.65 2026-11-02; 번호 항목 14개"
        status: pass
    human_judgment: false
  - id: D2
    description: "옛 결정 일곱 곳에 0060 개정·폐기 표시가 있고 원문은 지워지지 않았다"
    verification:
      - kind: other
        ref: "for f in 0034 0036 0037 0039 0040 0049 0056: grep '결정 0060'; git diff --numstat 가 항목마다 변경 줄 수만큼 같은 줄을 덧붙임; 0034·0039·0056 줄 수 비감소"
        status: pass
    human_judgment: false
  - id: D3
    description: "공개 저장소 위생: 결정 문서에 금지 표현 없음"
    verification:
      - kind: other
        ref: "저장소 위생 검사 (0060 및 개정한 7개 문서) 결과 0건"
        status: pass
    human_judgment: false
  - id: D4
    description: "14항 규칙의 설계 타당성(수치·분기가 실제 판에서 맞는지)"
    verification: []
    human_judgment: true
    rationale: "문서만 쓴 계획이라 규칙의 체감은 뒤 계획 구현과 실기기 확인(모든 개발 뒤 한꺼번에)에서 본다"

duration: 10min
completed: 2026-11-02
---

# Phase 8 Plan 1: 결정 0060 — 낮 처형과 유령 규칙 Summary

**낮 처형(토론 끝내기 → 지목 → 변론 → 찬반 → 처형)과 유령 전송 범위 규칙 14항을 결정 0060 한 곳에 번호로 고정하고, 바뀌거나 사라지는 옛 결정 일곱 곳에 개정·폐기 표시를 붙였다.**

## Accomplishments

- `docs/decisions/0060-v2-day-execution-ghost.md` 신규: 서버 단계와 길이(90/15/20/10/5/30/5초), 메시지 `endDiscussion`·`point`·`verdict`, 찬반 분모(변론자를 뺀 산 사람), 조기 종료 없음, 지목 변경 250ms, 모이는 자리 반지름 2.65, 무대 위 `STAGE_SPOT` 단일 예외, 유령 위치는 유령에게만, 밤·아침 임시 틀, 처형 문구 번호 삭제, 옛 저장 방 정규화, 봇 시간표, 결정 0056 완화 삭제 예고를 14항으로 적었다. 배경에 사용자 확정 두 건과 UI-SPEC A1~A4 의 출처를 달았다.
- 옛 결정 0034(4곳)·0036(6곳)·0037(4곳)·0039(3곳)·0040(3곳)·0049(1곳)·0056(2곳)의 해당 항목 끝에 `(2026-11-02 결정 0060-N …)` 한 문장을 덧붙였다. 원문은 지우지 않았고 상태 줄도 바꾸지 않았다(`v1` 브랜치에서는 계속 유효).

## Task Commits

1. Task 1: 결정 0060 — `5dc1bf4`
2. Task 2: 옛 결정 일곱 곳 개정·폐기 표시 — `2a8f97e`

## Deviations from Plan

None - plan executed exactly as written. (참고: 두 작업 모두 `tdd="true"` 가 아닌 문서 작업이라 RED 시험 커밋은 없다. 0c 커밋 원장 파일은 첫 커밋 뒤에 만들어 base 를 첫 커밋의 부모 `f1b11b8` 로 기록했다.)

## Verification

- Task 1 automated 통과, `ls docs/decisions | tail -1` = 0060, 번호 항목 14개, `2026-11-02`·`250ms`·`2.65` 포함.
- Task 2 automated 통과, 7개 문서 모두 `결정 0060` 1건 이상, 줄 수 비감소.
- 저장소 위생 검사 대상 8개 문서 0건, 0060 에 금지 낱말 0건.
- `npx vitest run test/unit/handoff.test.ts` 2 passed.

## Known Stubs

None.

## Threat Flags

None.

## Next Phase Readiness

뒤 계획이 "결정 0060-1 ~ 0060-14" 로 규칙 번호를 인용할 수 있다. 가정 A1(단계 이름 `nomination`·`verdict`)은 되돌릴 때 정규화가 한 번 더 필요하다.

## Self-Check: PASSED

- FOUND: docs/decisions/0060-v2-day-execution-ghost.md
- FOUND commits: 5dc1bf4, 2a8f97e
