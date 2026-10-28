---
phase: 04-execution-verdict
plan: 08
status: in-progress
---

# Phase 4 Plan 08: 테스트 방 봇 투표·변론·넘기기·복귀 Summary (작성 중)

## 진행 기록

Task 1 — RED 0b7f78c / GREEN 0704026 / unit 1001 통과(bots.test.ts 67: 신규 17), tsc app 범위 0 / 남은 태스크 2·3. 참고: `worker/room.ts` actAsBot 의 never 검사가 새 BotAct 두 변형 때문에 Task 3 GREEN 전까지 worker tsc 에서 실패한다(계획대로 Task 3 에서 잇는다).

Task 2 — RED cebbb57 / GREEN 9722c8a / unit 1012 통과(testTools.test.ts 신규 11, bots.test.ts 67), tsc app 범위 0 / 남은 태스크 3.
Task 3 — RED e90b906 / GREEN 2f1fbaf / worker 178 통과(신규 7), `npm test` 87 파일 2145 통과, tsc app·worker 0 / 남은 태스크 없음.

## TDD 기록

**Task 1 RED** (`test(04-08)`, 0b7f78c): `npx vitest run test/unit/bots.test.ts --reporter=tap-flat`, 종료 코드 1, 67개 중 10개 실패(`botCandidateTarget is not a function`, 새 단계 키가 null, 계획 행 0개). 의미 점검: 실패 이유는 구현 부재다. 기존 claim·discussion·night 계획 고정값(해시)은 HEAD 에서 먼저 뽑아 박았다.
**Task 1 GREEN** (`feat(04-08)`, 0704026): 67/67 통과, unit 전체 1001 통과.

**Task 2 RED** (`test(04-08)`, cebbb57): `npx vitest run test/unit/testTools.test.ts --reporter=tap-flat`, 종료 코드 1, 신규 11개 중 4개 실패(execVote 봇 표 없이 마감돼 `night/…` 가 되거나 votes 가 비어 있음). 나머지 7개(분기 단계 따라가기·ended WRONG_PHASE·봇 없는 방 난수 없음·대기실 복귀 키 목록)는 이미 맞는 회귀 가드로 통과.
**Task 2 GREEN** (`feat(04-08)`, 9722c8a): 141/141, unit 전체 1012 통과. resetToLobby 는 허용 목록 리터럴이라 코드 변경 없이 새 필드가 빠진다(테스트로 확인).
