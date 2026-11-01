---
phase: 07-free-chat
plan: "01"
subsystem: docs
tags: [decision-record, chat, retention, durable-object, audience-mask]

requires:
  - phase: 06-world-skeleton
    provides: world 키 분리 선례, 결정 0057 형식
provides:
  - 결정 0058 — 채팅 서버 보관과 재접속 채널별 30줄 복원 규칙 (숫자 포함)
  - 옛 결정 0016-7·0017-7·0019-1·0020·0023-5 의 개정·폐기 표시
affects: [07-02 chatLog.ts, 07-14 DO 저장·복원, 07-22 HANDOFF, 11페이즈 END-03]

actuals:
  tokens: 3500
  tasks: 2
  commits: 2
plan_head_before: 1b4f67506f6f29253b93a032ac55cc11e58a983f
plan_head_after: e5ad62757451e902b40366ccd1e145caf93e85d2

tech-stack:
  added: []
  patterns:
    - "수신자 마스크 복원: 줄마다 보낼 때 audience 결과 좌석 비트를 저장하고 복원은 마스크로만 한다"
    - "채널별 연번: 비공개 채널 줄 수가 공개 줄 번호 틈으로 새지 않게 한다"

key-files:
  created:
    - docs/decisions/0058-v2-chat-retention.md
  modified:
    - docs/decisions/0016-day-loop-structure.md
    - docs/decisions/0017-day-table-redesign.md
    - docs/decisions/0019-mafia-night-chat.md
    - docs/decisions/0020-night-morning-contract.md
    - docs/decisions/0023-sequential-claims.md

key-decisions:
  - "채팅 줄은 DO storage chat:NNNNNN 키에 보관하고 줄마다 보낼 때 수신자 좌석 마스크를 같이 저장한다"
  - "복원은 채널별 최근 30줄(CHAT_REPLAY_PER_CHANNEL = 30, 최대 90줄), 새 탈락자에게 탈락 이전 마피아 줄은 복원하지 않는다(0021-2 유지)"
  - "보관 상한 all 100 · mafia 300 · ghost 300, 20줄 묶음 삭제, 연번은 채널별"
  - "0017-7 개정, 0016-7·0019-1·0020·0023-5 폐기 표시 (원문 보존)"

requirements-completed: [CHAT-01, CHAT-02, CHAT-03]

coverage:
  - id: D1
    description: "결정 기록 0058 이 보관 대상·마스크·30줄 복원·상한·연번·삭제 시점·END-03 연결을 숫자와 함께 정한다"
    requirement: "CHAT-02"
    verification:
      - kind: other
        ref: "test -f docs/decisions/0058-v2-chat-retention.md && grep CHAT_REPLAY_PER_CHANNEL = 30 / 0021-2 / END-03 / all 100 / mafia 300 / ghost 300 / DISCUSSION_MS (결정 항목 10개)"
        status: pass
    human_judgment: false
  - id: D2
    description: "옛 결정 다섯 곳에 0058 개정·폐기 표시가 있고 원문은 보존된다"
    requirement: "CHAT-03"
    verification:
      - kind: other
        ref: "for f in 0016 0017 0019 0020 0023: grep -c '결정 0058' >= 1; grep '채팅 내역은 서버에 저장하지 않는다' 0017"
        status: pass
    human_judgment: false
  - id: D3
    description: "결정 문장의 설계 타당성(보관 상한 수치, 복원 범위가 11페이즈 공개에 충분한지)"
    verification: []
    human_judgment: true
    rationale: "상한 수치는 리서치 가정 A4 를 옮긴 것이고 실제 판 길이로만 검증된다. 07-14 구현과 11페이즈 공개 때 확인한다"

duration: 5min
completed: 2026-11-01
status: complete
---

# Phase 7 Plan 01: 결정 0058 — 채팅 서버 보관·재접속 30줄 복원 Summary

**채팅 줄을 DO storage `chat:` 키에 수신자 마스크와 함께 보관하고 재접속 때 채널별 최근 30줄만 마스크로 되돌려 주는 규칙을 결정 0058 로 확정하고, 옛 결정 다섯 곳에 개정·폐기 표시를 연결했다.**

## Performance

- **Duration:** 약 5분
- **Completed:** 2026-11-01
- **Tasks:** 2
- **Files modified:** 6 (신규 1, 수정 5)

## Accomplishments

- `docs/decisions/0058-v2-chat-retention.md` 신규. 결정 10항: 보관 대상·키, 수신자 마스크, 30줄 복원, 상한(all 100 / mafia 300 / ghost 300, 20줄 묶음 삭제), 채널별 연번, 와이어 비노출, 삭제 시점, 로그 무본문, END-03 연결, 옛 결정 개정.
- 결정 0021-2 "탈락 시점부터"를 지켜 새 탈락자에게 탈락 이전 마피아 줄을 복원하지 않는다고 명시(사용자 결정 2). 복원이 라이브보다 넓은 규칙은 적지 않았다.
- `DISCUSSION_MS` 40초 유지, 90초는 8페이즈 DAY-07 이라는 참고 줄을 남겼다(사용자 결정 3).
- 0016-7·0017-7·0019-1·0020·0023-5 에 기존 문체의 괄호 표시를 덧붙였다. 원문은 지우지 않았다.

## Task Commits

1. **Task 1: 결정 기록 0058** - `8024650` (docs)
2. **Task 2: 옛 결정 다섯 곳 표시** - `e5ad627` (docs)

**Plan metadata:** 이 SUMMARY 와 STATE/ROADMAP 갱신 커밋 (docs: complete plan)

## Files Created/Modified

- `docs/decisions/0058-v2-chat-retention.md` - 채팅 보관·재접속 복원 결정
- `docs/decisions/0016-day-loop-structure.md` - 7항 끝에 0058 표시
- `docs/decisions/0017-day-table-redesign.md` - 7항 끝에 0058 개정 표시
- `docs/decisions/0019-mafia-night-chat.md` - 1항에 저장 부분 폐기 표시
- `docs/decisions/0020-night-morning-contract.md` - 밤 줄 저장 문장에 폐기 표시
- `docs/decisions/0023-sequential-claims.md` - 5항 끝에 폐기 표시

## Decisions Made

플랜의 10항을 그대로 기록했다. 새로 정한 것은 없다. 가정 A1(상한 수치는 리서치 A4 값)과 A2(서버 로그에 본문 없음)는 결정 4항·8항에 반영했다.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. 플랜 지시대로 문서 전용 계획이라 vitest·tsc 는 돌리지 않았다(검증 항목에 없음, 코드 변경 없음).

## Known Stubs

없음.

## Threat Flags

없음. T-07-01 은 결정 2·6·8·9항(마스크 복원, 와이어 비노출, 로그 무본문, 마스크 밖 전송 금지)으로 고정했다. T-07-SC: 패키지 설치 없음.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 07-02(`chatLog.ts` 순수 규칙)가 이 기록의 상수(`CHAT_REPLAY_PER_CHANNEL`=30, 상한 100/300/300, 묶음 20, 접두어 `chat:`)를 그대로 구현할 수 있다.
- 07-14(DO 저장·복원)와 11페이즈 END-03 이 이 보관 규칙에 기댄다. 막힌 것은 없다.

## Self-Check: PASSED

- FOUND: docs/decisions/0058-v2-chat-retention.md
- FOUND: 8024650, e5ad627 (HEAD 의 조상)
- 인수 기준 전부 통과(결정 항목 10개, 상한 문구, DISCUSSION_MS, 다섯 파일 표시, 0017 원문 보존)

---
*Phase: 07-free-chat*
*Completed: 2026-11-01*
