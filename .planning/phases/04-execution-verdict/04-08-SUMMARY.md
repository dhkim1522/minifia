---
phase: 04-execution-verdict
plan: 08
status: in-progress
---

# Phase 4 Plan 08: 테스트 방 봇 투표·변론·넘기기·복귀 Summary (작성 중)

## 진행 기록

Task 1 — RED 0b7f78c / GREEN 0704026 / unit 1001 통과(bots.test.ts 67: 신규 17), tsc app 범위 0 / 남은 태스크 2·3. 참고: `worker/room.ts` actAsBot 의 never 검사가 새 BotAct 두 변형 때문에 Task 3 GREEN 전까지 worker tsc 에서 실패한다(계획대로 Task 3 에서 잇는다).

## TDD 기록

**Task 1 RED** (`test(04-08)`, 0b7f78c): `npx vitest run test/unit/bots.test.ts --reporter=tap-flat`, 종료 코드 1, 67개 중 10개 실패(`botCandidateTarget is not a function`, 새 단계 키가 null, 계획 행 0개). 의미 점검: 실패 이유는 구현 부재다. 기존 claim·discussion·night 계획 고정값(해시)은 HEAD 에서 먼저 뽑아 박았다.
**Task 1 GREEN** (`feat(04-08)`, 0704026): 67/67 통과, unit 전체 1001 통과.
