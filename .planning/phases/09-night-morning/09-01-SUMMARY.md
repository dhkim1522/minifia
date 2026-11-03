---
phase: 09-night-morning
plan: "01"
subsystem: docs
tags: [decision-record, night, morning, mafia-confirm, will, note, chalk, home-memory]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 결정 0060 형식, 항목 단위 개정 표시 선례
provides:
  - 결정 0061 — 밤과 아침 규칙 19항 (와이어 이름·아침 길이 공식·보는 사람별 snap 규칙 고정)
  - 옛 결정 0044·0020·0019·0026·0036·0060 의 개정·폐기 표시
affects: [09-02 이후 모든 계획의 "결정 0061-N" 인용, 9페이즈 서버·화면·누설 검사]

actuals:
  tokens: 6000
  tasks: 2
  commits: 2
plan_head_before: e494a7b1e6a8e6425a4ea5463d275a6225f498fb
plan_head_after: c76a5a2e1ef656ecdcec839dc427d2875025c992

tech-stack:
  added: []
  patterns:
    - "항목 단위 개정 표시: 원문 뒤에 '(2026-11-03 결정 0061-N 으로 … 했다: …)' 한 문장만 덧붙이고 지우지 않는다"

key-files:
  created:
    - docs/decisions/0061-v2-night-morning.md
  modified:
    - docs/decisions/0044-v2-same-space.md
    - docs/decisions/0020-night-morning-contract.md
    - docs/decisions/0019-mafia-night-chat.md
    - docs/decisions/0026-role-card-journals.md
    - docs/decisions/0036-execution-vote-wire.md
    - docs/decisions/0060-v2-day-execution-ghost.md

key-decisions:
  - "밤 30초 조기 종료 없음, 밤 이동은 산 마피아와 유령만(canMoveIn), 비마피아 이동 요청은 오류 없이 버림"
  - "밤 진입 snap 은 보는 사람별: 시민 편 본인 한 칸, 산 마피아·유령 전원 (사용자 확정 Open Q2). 아침 snap 만 모든 소켓 동일"
  - "마피아 확정 = 산 마피아 전원 같은 대상, 도착 무관·연결 무시·난수 없음. 고르지 않고 끊긴 마피아가 있으면 무효, 고른 뒤 끊기면 선택 유지 (Open Q1)"
  - "와이어 이름: 메시지 will·note, view me.will·me.note·me.nightTally·me.nightSure·day.chalk·day.morning.saved, 채팅 줄 k, 서버 함수 afterTransition"
  - "아침 길이 5초 + 탈락 2 + 유언 2 + 쪽지 2, 상한 15초. 유언·쪽지 저장 간격 500ms"

requirements-completed: [NIGHT-07, NIGHT-08, NIGHT-09, NIGHT-10, NIGHT-11, NIGHT-12, MORN-01, MORN-02, MORN-03, MORN-04, WILL-01]

duration: 약 10분
completed: 2026-11-03
---

# Phase 9 Plan 01: 결정 0061 — 밤과 아침 규칙 Summary

**밤 보행·전원 일치 암살 확정·보는 사람별 위치 snap·아침 home 되돌림·분필/유언/쪽지 공개를 19항 번호로 고정하고, 옛 결정 여섯 곳에 개정 표시를 붙였다.**

## 한 일

- Task 1 (tracer, `2cd8919`): `docs/decisions/0061-v2-night-morning.md` 신규. 결정 19항 + 배경(UI-SPEC A1~A4, 연구 뒤 확정 Open Q1·Q2) + 결과.
- Task 2 (`c76a5a2`): 0044-13·18, 0020-1·3·4, 0019-3, 0026-4, 0036-11, 0060-6·7·9 끝에 개정·폐기 한 문장씩 추가. 원문은 지우지 않았고 상태 줄도 그대로다.

## 검증

- Task 1·2 automated 통과, 인수 기준(19항, 날짜·500ms·15초·"본인 한 칸" 문자열, 줄 수 비교) 통과.
- 위생 검사(`~/personal/CLAUDE.md` 의 검사 문자열을 `docs/decisions` 전체에 적용) 0건.
- `npx vitest run test/unit/handoff.test.ts` 2건 통과(문서만 바꿈).

## Deviations from Plan

None - plan executed exactly as written. (0044 의 13·18항은 줄 번호가 아니라 항목 번호로 찾아 33·43행에 붙였다.)

## Known Stubs

None.

## 다음 계획이 알아야 할 것

- 규칙 인용은 "결정 0061-N" (1~19). 이름은 위 key-decisions 그대로 쓴다.
- TDD 계획 아님(문서 계획). 이월할 코드 변경 없음.

## Self-Check: PASSED

- FOUND: docs/decisions/0061-v2-night-morning.md
- FOUND: 2cd8919, c76a5a2 (HEAD 의 조상)
